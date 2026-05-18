# Phase 3.5 Part B — Backend slice — audit

Deviations, deferred items, and risks flagged during the backend
plumbing slice. To be merged into `PHASE3-5-AUDIT.md` when the full
sprint closes.

## D — Plan deviations

### D1. `getQuotingDefaults` uses `.eq('user_id', userId)` where peers rely on RLS

**What:** Every other helper in `src/lib/api/quotes.js`
(`listQuotes`, `getWonQuoteContext`, `listQuotesByStatus`, etc.)
accepts a `_userId` parameter with an underscore — deliberately
unused, because RLS on the `quotes` table already scopes by
`auth.uid()`. The new `getQuotingDefaults` follows PHASE3-5-PLAN.md
§2.4 verbatim, which writes `.eq('user_id', userId)` explicitly.

**Why it's fine:** Under RLS the extra predicate is a no-op cost
(≤ 1 index seek against the user_id column that's already part of
RLS filter planning). No correctness hazard.

**Why flag it:** If someone later ports this helper to a context
without a live session (e.g. a server-side summary job), the
`.eq('user_id', userId)` is load-bearing there in a way that other
helpers in this file aren't. Future editors should know the
asymmetry is intentional.

**Recommended resolution:** Leave as-is. Plan is authoritative.

### D2. H4 bumps `sent_at` on every re-send

**What:** The H4 update is:
```js
.update({ status: 'sent', sent_at: new Date().toISOString() })
.eq('id', quoteId)
.in('status', ['draft', 'sent', 'viewed'])
```

A re-send against a row already in 'sent' or 'viewed' will update
`sent_at` to the re-send time. Plan §2.11 specifies this exact shape;
I shipped it verbatim rather than deviating silently.

**Why it could matter:** Any downstream metric treating `sent_at` as
"quote-first-sent-at" (e.g. time-to-approve calculations,
`time_to_view_seconds` which is computed relative to send time) would
reset on re-send. Scan of the codebase did not find such a consumer,
but the shape of the data invites one.

**Alternative considered:** Two-pass —
```js
const { data: cur } = await supabase.from('quotes').select('sent_at').eq('id', quoteId).maybeSingle();
.update({ status: 'sent', sent_at: cur?.sent_at || new Date().toISOString() })
```
Preserves the first-send timestamp. Plan doesn't ask for it;
deferred.

**Recommended resolution:** If Phase 4 adds funnel analytics
("median hours from send → view → approve"), revisit and
choose explicitly.

## H — Other risks surfaced

### H1-adj. `existing.line_items` may arrive without id if schema changes

The H1 rewrite trusts `existing.line_items[*].id` to be present (it
is — `line_items.id` is `uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4()`).
If a future migration ever makes id nullable or adds a soft-delete
column that `select *` skips, the `previousIds` array goes wrong and
we'd either duplicate rows on upsert or fail to delete removed ones.

**Recommended resolution:** If the line_items schema is ever touched
in a way that affects id, re-read `_updateQuoteInner` before merging
that migration.

### H1-adj. Fallback UUID generator requires `crypto.getRandomValues`

The `genLineItemId` fallback uses `crypto.getRandomValues`, which is
universal in modern browsers but could be missing in:
- Very old Node-SSR contexts if this file is ever imported server-side (it isn't today)
- Webview shells with restricted crypto (rare, but tradespeople do use odd field tools)

If fallback is missing, `genLineItemId` throws. The upstream
`updateQuote` call would surface "Failed to update quote." For
defense-in-depth a future edit could fall back to a pseudo-UUID from
`Math.random()`, but any real corruption of line-item IDs is worse
than a clean error; preferring the throw.

## Still deferred from the sprint (UI slice / send-path slice)

Unchanged from the sprint prompt's out-of-scope list. Not re-stated
here to keep this audit focused on what this slice touched.

- M7 dup-check (UI slice — fires at quick-create)
- M8 keyboard layout (UI slice)
- C3 sms: confirmation (send-path slice)
- C5 `isNetworkError` helper (send-path slice)
- All of B2–B13 UI work
- Timing validation (`PHASE3-5-TIMING.md`)
- H3 / H5 / M1–M6 / M9 / L1–L8 — unchanged, still deferred per sprint §Part C
