# v100 Milestone 3 — Workstream A Part 2 (Template consumption + follow-up modal)

**Released:** April 14, 2026
**Shipped as:** `punchlist-v100-m3.zip`
**Predecessor:** `punchlist-v100-m2.zip`
**Spec:** `PHASE4-V100-PLAN.md` §3.4, §3.5, §3.6, §9.2
**Next:** M4 — Dashboard revamp (Workstream B)

M2 built the substrate (schema, templates API, Settings Messages tab). M3
wires it into the places where messages are actually sent. After this
milestone, the follow-up system is end-to-end functional: the quote builder
uses the contractor's `initial_sms` template, and quote detail has a proper
"Nudge" modal that tracks counter state atomically and colour-codes urgency.

---

## (a) Quote builder consumes `initial_sms` template

**Files changed:** `src/pages/quote-builder-page.jsx`

### Before
`proceedToSend()` built the SMS body with a hardcoded template literal:

```js
setSmsBody(`Hi${firstName ? ' ' + firstName : ''}, your quote from ${senderName} is ready:\n\n${title || draft.title || 'Your quote'} — ${currency(grandTotal, country)}\n\n[link will be added automatically]`);
```

### After
At component mount the user's `initial_sms` template is fetched via
`listTemplates()` and stored in `initialSmsTemplate` state. `proceedToSend()`
now calls `renderTemplate()` with the fetched body (or the system default if
the fetch failed / user is offline):

```js
const templateBody = initialSmsTemplate || getSystemDefaults().initial_sms;
setSmsBody(renderTemplate(templateBody, {
  firstName,
  senderName,
  quoteTitle: title || draft.title || 'Your quote',
  total: totalFormatted,
  link: '[link will be added automatically]',
}));
```

**Offline behaviour:** if `listTemplates()` rejects (no network), `initialSmsTemplate`
stays `null` and the system default is used — the contractor always gets
a sensible pre-fill.

**Pro note:** Pro users who have customised `initial_sms` in Settings → Messages
will now see their custom copy appear in the send modal automatically.

---

## (b) New follow-up modal component

**File:** `src/components/followup-modal.jsx` (new)

### Props
```
quote          — full quote object (followup_count, last_followup_at,
                 views_since_followup, customer, share_token, title, total)
userProfile    — { company_name, full_name }
templates      — listTemplates() output; falls back to system defaults
onClose()      — close without sending
onSent(state)  — called with { followup_count, last_followup_at, views_since_followup }
```

### Tier selection
`followup_count` on the quote is the number of nudges **already sent**.

| `followup_count` before this send | Template key used |
|---|---|
| 0 | `followup_1_sms` — "any questions?" |
| 1 | `followup_2_sms` — "didn't get buried" |
| 2+ | `followup_3_sms` — "last nudge, totally understand" |

### Context block (§3.4 colour coding)
```
green  — nudged 0–1 days ago (fresh — wait)
amber  — nudged 2–4 days ago (due now)
red    — nudged 5+ days ago  (overdue)
neutral — never nudged yet
```

Shows: "Last nudge {N}d ago · {views_since_followup} views since"

### Character counter
- 0–159 chars: muted count
- 160–319 chars: amber ("2 SMS segments")
- 320 chars: red ("At limit"), hard-capped

### Send path
Posts `POST /api/send-followup` with auth header. On success calls
`onSent(state)` — the parent merges the returned counter values into
`quote` state without a full refetch.

---

## (c) New API endpoint `api/send-followup.js`

**File:** `api/send-followup.js` (new)

### Request
```json
POST /api/send-followup
Authorization: Bearer <supabase-session-token>
Content-Type: application/json

{
  "quoteId": "uuid",
  "customMessage": "optional override body",
  "method": "sms" | "email"
}
```

`method` defaults to `sms` if the customer has a phone, else `email`.

### Response (200)
```json
{
  "ok": true,
  "method": "sms",
  "followup_count": 2,
  "last_followup_at": "2026-04-14T18:30:00Z",
  "views_since_followup": 0
}
```

### Auth
Extracts user from `Authorization: Bearer <token>` via `supabase.auth.getUser()`.
Returns 401 if missing/invalid.

### Ownership
Loads the quote and confirms `quote.user_id === user.id`. Returns 403 if mismatch.

### Rate limit
5 follow-ups per `(user_id, customer_id)` pair per rolling 7-day window, using
the existing `api/_rate-limit.js` `blocked()` helper. Key:
`followup:<userId>:<customerId>`.

This prevents a contractor from accidentally hammering a single customer.
The limit is per-customer (not global) so they can still nudge other quotes.

### Atomic counter bump
Before sending, calls `rpc_record_followup_send(p_quote_id)` which atomically:
- Increments `followup_count`
- Sets `last_followup_at = now()`
- Resets `views_since_followup = 0`
- Returns new values for client reconciliation

The RPC runs **before** the Twilio/Resend call (see migration rationale for why).

### Template resolution
1. If `customMessage` is provided, use it.
2. Otherwise: load the user's custom template for the tier key from
   `message_templates`, fall back to `SYSTEM_DEFAULTS` if not found.
3. Run `renderTemplate()` with tokens: `{firstName, senderName, quoteTitle, total, link}`.

### Send
- **SMS:** inline Twilio REST call (same pattern as `api/send-sms.js`; no SDK).
- **Email:** Resend with branded HTML wrapper (orange CTA button).

If the send fails (502), counters are already bumped and the error response
still includes the new state. The client toasts the failure separately.

---

## (d) New Supabase migration `supabase/migration_v100_followup_rpc.sql`

```sql
CREATE OR REPLACE FUNCTION public.rpc_record_followup_send(
  p_quote_id  uuid,
  p_sent_at   timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
```

**Ownership check:** even though the function is SECURITY DEFINER (bypasses RLS),
it manually verifies `quote.user_id = auth.uid()` and raises `not_owner` (SQLSTATE
42501) on mismatch. The API catches this and returns 403.

**Returns:**
```json
{
  "quote_id": "uuid",
  "followup_count": 2,
  "last_followup_at": "2026-04-14T18:30:00Z",
  "views_since_followup": 0
}
```

### How to run
```bash
# Supabase dashboard → SQL Editor, paste and run the file, or:
psql $DATABASE_URL -f supabase/migration_v100_followup_rpc.sql

# Verify:
SELECT proname, prosecdef FROM pg_proc WHERE proname = 'rpc_record_followup_send';
-- prosecdef should be: t
```

---

## (e) Quote detail page wiring

**File:** `src/pages/quote-detail-page.jsx`

### New imports
```js
import FollowupModal from '../components/followup-modal';
import { listTemplates } from '../lib/api/templates';
```

### New state
```js
const [showNudgeModal, setShowNudgeModal] = useState(false);
const [userTemplates, setUserTemplates] = useState(null);
```

### Template fetch
Added alongside existing `getProfile()` call in the mount `useEffect`:
```js
listTemplates(user.id).then(setUserTemplates).catch(() => setUserTemplates([]));
```

### Button replacement (sent + viewed banners)
**Before:**
```jsx
<button ... onClick={handleFollowUp}>💬 Text {firstName}</button>
```

**After:**
```jsx
<button ... onClick={openNudgeModal}>💬 Nudge {firstName}</button>
```

The word "Nudge" is used throughout per §9.2 decision ("Nudge me to follow up"
framing — contractor stays the sender, app is the calendar).

### Context block (§3.4)
Rendered inline in the sent/viewed banners when `followup_count > 0`:
```jsx
<div className="qd-followup-context">
  <span style={{ color: urgColor }}>Last nudge {N}d ago</span>
  <span>{views_since_followup} views since</span>
</div>
```

Colour coding: green < 2d, amber 2–4d, red ≥ 5d.

### On successful send
```js
function handleNudgeSent(newState) {
  setShowNudgeModal(false);
  setQuote(prev => ({
    ...prev,
    followup_count:       newState.followup_count,
    last_followup_at:     newState.last_followup_at,
    views_since_followup: 0,
  }));
  showToast('Nudge sent ✓', 'success');
  haptic('success');
}
```

No refetch needed — the API returns the new state and the quote is reconciled
in place.

---

## (f) Dashboard integration scaffolding

**File:** `src/pages/dashboard-page.jsx`

Minimal change per §3.6 — no layout changes (that's M4).

### Before
```js
function getLastFollowedUp(q) {
  const conv = Array.isArray(q.conversation) ? q.conversation : [];
  const lastContractorMsg = [...conv].reverse().find(m => m.role === 'contractor');
  return lastContractorMsg?.timestamp ? relativeTime(lastContractorMsg.timestamp) : null;
}
```

### After
```js
function getLastFollowedUp(q) {
  // Prefer last_followup_at (new M3 column) over conversation timestamps
  if (q.last_followup_at) return relativeTime(q.last_followup_at);
  const conv = Array.isArray(q.conversation) ? q.conversation : [];
  const lastContractorMsg = [...conv].reverse().find(m => m.role === 'contractor');
  return lastContractorMsg?.timestamp ? relativeTime(lastContractorMsg.timestamp) : null;
}
```

The dashboard's "Needs follow-up" feed already renders `lastFollowedUp` in the
`FeedItem` component (line 54: `v2-feed-followup-ts`). This change ensures that
label now reflects actual API-tracked nudges rather than just conversation
messages.

---

## Styling additions

**File:** `src/styles/index.css` (appended)

New classes: `.followup-modal`, `.followup-modal__*`, `.qd-followup-context`,
`.qd-followup-context__stat`. All respect `prefers-reduced-motion`.

---

## What's unchanged

Per hard constraints:
- `api/stripe-webhook.js` — untouched
- `api/public-quote-action.js` — untouched
- No new npm dependencies
- No dashboard layout changes (M4)
- All existing class names, state shapes, handler signatures preserved

---

## Testing checklist

- [ ] Send a quote → open in builder send modal → confirm SMS body uses
  `initial_sms` template (check Settings → Messages for expected copy)
- [ ] Change `initial_sms` template in Settings (Pro account) → re-open
  builder send modal → confirm new copy appears
- [ ] Go offline → open builder send modal → confirm SMS body uses system
  default (no error)
- [ ] On a sent quote (detail page): confirm "Nudge" button opens modal
- [ ] Modal shows correct tier label (First/Second/Last nudge) based on
  `followup_count`
- [ ] Send nudge → toast "Nudge sent ✓" → modal closes → context block
  updates with new `last_followup_at`
- [ ] Send 6th nudge to same customer within 7 days → confirm 429 response
- [ ] Viewed quote: confirm context block shows green/amber/red correctly
- [ ] Dashboard "Needs follow-up" feed: confirm "Last followed up" label
  shows API timestamp (not just conversation timestamp)
- [ ] Run migration on staging before prod:
  `psql $DATABASE_URL -f supabase/migration_v100_followup_rpc.sql`
