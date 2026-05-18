# Phase 3.5 Part B — Backend plumbing slice

First slice of Part B. Ships independently of the UI rewrite. Each
change is individually revertable and does not cross into the three
functions Part A patched.

## Summary

| ID | File | What changed | Why |
|----|------|--------------|-----|
| — | `src/lib/api/quotes.js` | Added `getQuotingDefaults(userId)`. Added `genLineItemId()` + `mode()` helpers. `normalizeLineItems` now preserves incoming `id` and generates a UUID for new items. | Smart defaults feed the Total card in the UI slice; stable IDs are a precondition for H1. |
| H1 | `src/lib/api/quotes.js` (`_updateQuoteInner`) | Line-item save rewritten from insert-then-delete-old to upsert-by-id + targeted delete of only the IDs the user removed. | Preserves `line_items.id` across saves. Eliminates the orphan-race where a save during/after approval could invalidate `selected_optional_ids` references in the public-quote-action approval flow. |
| — | `src/hooks/use-customers.js` (new) | Module-cache-backed hook, `fuzzyScore`, `searchCustomers`, `invalidateCustomers`. | Customer section needs to render instantly from cache on re-entry and search without a network round-trip per keystroke. |
| H4 | `api/send-quote-email.js` (main branch, L.859) | After Resend 200, atomic `UPDATE ... WHERE status IN ('draft','sent','viewed')` sets `status='sent'` and `sent_at=now`. Returns `{status, sent_at}` in the response. | Brings the orphaned main branch alive; server is now the authoritative source of `sent` transitions. Predicate prevents regression of approved/scheduled quotes (A3-style idempotency). |

## Details

### getQuotingDefaults

New helper in `src/lib/api/quotes.js`:

```js
export async function getQuotingDefaults(userId) {
  if (!userId) return null;
  const { data: recent, error } = await supabase
    .from('quotes')
    .select('deposit_required, deposit_percent, deposit_amount, expiry_days')
    .eq('user_id', userId)
    .neq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(5);
  if (error || !recent?.length) return null;
  // … mode-of-5 for deposit_required / deposit_percent / expiry_days
}
```

Returns `null` when the user has no sent-or-later quotes (fresh account)
so the caller falls through to `profile.default_*` and then hardcoded
fallbacks (14 / 20% / false). Intended for **new-quote** mount only.

Deviation from file conventions: other helpers in this module take
`_userId` (unused, RLS-only). The plan's code in PHASE3-5-PLAN.md §2.4
explicitly uses `.eq('user_id', userId)`. Followed verbatim. See audit
item D1.

### H1 — line item upsert

Before: insert all new items, then delete all old items by ID snapshot.
Every save produced fresh IDs; any external reference to a line_items.id
(notably `selected_optional_ids` written by the public-quote-action
approve flow) could be invalidated by a subsequent contractor save.

After: client-side UUIDs (via `genLineItemId()`, prefers
`crypto.randomUUID()` with an RFC4122 getRandomValues fallback for
pre-15.4 iOS Safari). `normalizeLineItems` stamps an id onto every row,
preserving existing ones. `_updateQuoteInner` diffs
`existing.line_items` vs `nextItems` by id, upserts the nextItems batch,
then deletes only the removed ids.

```js
const previousIds = (existing.line_items || []).map(i => i.id);
const nextIds = new Set(nextItems.map(i => i.id));
const removedIds = previousIds.filter(id => !nextIds.has(id));

if (nextItems.length) {
  await supabase.from('line_items').upsert(nextItems, { onConflict: 'id' });
}
if (removedIds.length) {
  await supabase.from('line_items').delete()
    .eq('quote_id', quoteId).in('id', removedIds);
}
```

Mutex retained (`_saveMutex` in `updateQuote`) — still useful as
defense against concurrent saves. `_lineItemsBadCols` retry path
preserved with `.upsert()` call shape.

Edge cases:
- **New quote with no previous items** → `previousIds = []`, `removedIds = []`, upsert inserts fresh rows with new UUIDs. Same net effect as before.
- **User clears all items** → `nextItems = []`, skip upsert, `removedIds = previousIds`, delete all. Same net effect.
- **Upsert fails** → nothing deleted yet, no data loss. Error surfaced as before.
- **Delete of `removedIds` fails** → stale items show in UI until next save cleans them. Non-fatal. (Previous behavior had the same failure mode for the full delete.)

### useCustomers hook

New file `src/hooks/use-customers.js`. Module-scoped `CACHE` with
5-minute TTL. `inflight` promise coalesces concurrent mounts (React
StrictMode). Stale cache stays in place on refetch error — better UX
than going empty on a transient network blip.

Also exports `fuzzyScore(query, candidate)` and
`searchCustomers(list, query, limit)`. Score model:
- contains match scores 1000 − position (exact match gets +500)
- in-order subsequence match scores by chars matched
- no match scores 0

Verified manually against expected "smih → Smith" case: subsequence
match returns 4 (4 chars matched in order), which sorts above customers
with no hit. Not as clever as real Levenshtein; deliberate — it's 20
lines instead of a dependency.

### H4 — atomic email status

Before: main branch at L.579–861 of `api/send-quote-email.js` sent the
email via Resend and returned `{success: true}` without touching the
quote. The client had already flipped `status` to `'sent'` via
`updateQuote` pre-call, which means on email-send failure the quote
was wrongly marked sent.

After: after Resend 200, the server atomically updates:

```js
await supabase.from('quotes')
  .update({ status: 'sent', sent_at: new Date().toISOString() })
  .eq('id', quoteId)
  .in('status', ['draft', 'sent', 'viewed'])
  .select('status, sent_at').maybeSingle();
```

Response body now carries `{ success, status, sent_at }` so the
upcoming UI slice can reflect the authoritative state. Failures to
update are logged but don't fail the request — the email has already
gone out.

Behavior change to flag: a re-send against a still-'sent' quote will
bump `sent_at` to the re-send time. Followed the plan verbatim; see
audit item D2 for the "first-send" alternative.

## Testing

Static parse — all three files clean:
- `node --check src/lib/api/quotes.js` → pass
- `node --check src/hooks/use-customers.js` → pass
- `node --check api/send-quote-email.js` → pass

Live (required before merge, staging Supabase):

1. **H1 — ID preservation:**
   Create a quote with three items. Save. In Supabase, copy the three
   `line_items.id` values. Edit one item's name, save again. Verify
   the three IDs are unchanged. Add an item, save. Verify the three
   original IDs unchanged, fourth has a new UUID. Delete the second
   item, save. Verify IDs 1/3/4 unchanged, ID 2 gone.

2. **H1 — approval orphan race regression:**
   Create a quote with one included + one optional item. Send, approve
   with the optional selected on the public quote page (inspect
   `quotes.selected_optional_ids` in Supabase — should reference the
   optional's id). As the contractor, open builder, make a trivial
   edit (change description), save. Verify `selected_optional_ids`
   still references an id that exists in `line_items`. Under the old
   code path this reference could dangle.

3. **getQuotingDefaults smoke:**
   New user with 0 quotes → returns null. User with one sent quote at
   20% / 14 days → returns `{ depositRequired: false, depositPercent: 20, expiryDays: 14 }` (not-deposited-on fewer than 3 of 5). User with 3+ of last 5 taking a 30% deposit → `depositRequired: true, depositPercent: 30`.

4. **useCustomers cache:**
   Mount a consumer, confirm network call. Unmount, remount within 5
   minutes → no new network call, list renders from cache. Call
   `invalidate()`, remount → fresh network call.

5. **H4 — atomic status on email send:**
   Create a 'draft' quote. `curl` the `/api/send-quote-email` endpoint
   with a valid auth header. Verify status flips to 'sent' with a
   fresh `sent_at`. Re-send → status stays 'sent', `sent_at` bumps.
   Manually set status='approved' in Supabase, re-send → email still
   sends (Resend 200), but status stays 'approved'. Response body
   reflects `status: 'approved'`.

6. **H4 × A3 interaction:**
   Confirm the status predicate `['draft','sent','viewed']` doesn't
   permit flipping back from any post-approval state. Mirrors Part A's
   A1 webhook predicate.

## Revert

Each change is localized:
- `getQuotingDefaults` / `genLineItemId` / `mode` / normalize id change: three hunks in `quotes.js`, revert together.
- H1 upsert: one hunk replacing the insert-then-delete block in `_updateQuoteInner`. Revert to restore previous behavior. The mutex stays either way.
- `use-customers.js`: delete the file. No existing consumers.
- H4: one hunk in the main-branch return of `send-quote-email.js`. Revert to restore `{success: true}`-only response.

## What this slice does NOT do

Per the session scope:
- No UI changes. The builder page still imports the old API surface; `getQuotingDefaults` / `useCustomers` / `fuzzyScore` have no consumers yet. Wired in the UI slice.
- No C5 `isNetworkError` helper (send-path slice).
- No M7 dup-check (UI slice — it lives at the quick-create interaction point).
- No M8 keyboard handling, optimistic send, C3 sms fallback, coachmarks, telemetry, voice input, phase-machine collapse. All UI or send-path slice.
