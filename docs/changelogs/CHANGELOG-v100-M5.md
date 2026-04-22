# v100 Milestone 5 — Workstream C (Flow closures)

**Released:** April 14, 2026
**Shipped as:** `punchlist-v100-m5.zip`
**Predecessor:** `punchlist-v100-m4.zip`
**Spec:** `PHASE4-V100-PLAN.md` §5.1–5.7
**Next:** M6 — Workstream D (Quoting & review flow)

Seven small closures, ordered lowest-risk first. Each is its own logical commit.
All touch only the files listed per-section. `api/stripe-webhook.js` and
`api/public-quote-action.js` are **untouched** (deposit receipt ships via the
Supabase DB webhook path per the M5 decision below).

---

## §5.7 Lifecycle progress strip — LOWEST RISK

**Files:** `src/pages/quote-detail-page.jsx`, `src/styles/index.css`

A persistent horizontal strip at the top of quote detail showing the full
lifecycle: **Sent → Viewed → Approved → Scheduled → Complete → Paid**.

- Steps before the current state show as green with a filled dot.
- The current step shows in brand orange with a glowing dot.
- Future steps are muted grey.
- Strip is scroll-friendly (overflow-x auto, no scrollbar) — works on 375px.
- Hidden on Draft status (strip only appears once the quote is sent).
- `prefers-reduced-motion` honoured — glow suppressed.

**Before:** Mobile users missed the sidebar badge showing current state.
**After:** Lifecycle is visible at the top of every sent quote, one glance.

```jsx
// Before: no strip
<div className="qd-hero"> …

// After:
{!isDraft && (
  <div className="ql-strip" role="progressbar">
    {lifecycleSteps.map((step, i) => (
      <div key={step.key} style={{display:'flex',alignItems:'center'}}>
        <div className={`ql-step${step.done?' ql-step--done':step.current?' ql-step--active':''}`}>
          <div className="ql-dot" />
          <span>{step.label}</span>
        </div>
        {i < lifecycleSteps.length - 1 && <div className={`ql-connector${step.done?' ql-connector--done':''}`} />}
      </div>
    ))}
  </div>
)}
```

---

## §5.5 Auto-send invoice on complete

**Files:** `src/pages/quote-detail-page.jsx`, `src/pages/settings-page.jsx`,
`supabase/migration_v100_m5.sql`

New profile preference `auto_send_invoice_on_complete boolean DEFAULT true`.

When `completeAndInvoice()` fires and the pref is `true`, `sendInvoiceEmail()`
is called immediately after `createInvoiceFromQuoteWithAdditionalWork()`. If the
email send fails, the invoice is still created and the contractor sees a warning
toast rather than an error — the invoice exists and can be manually sent.

**Settings → Preferences tab (new tab):** A toggle switch with current-state
description: *"Invoice is sent automatically when you complete a job."* /
*"Invoice is created but not sent — you review and send it manually."*
Saved immediately to `profiles.auto_send_invoice_on_complete` via `updateProfile`.

**Schema addition** (`supabase/migration_v100_m5.sql`):
```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auto_send_invoice_on_complete boolean NOT NULL DEFAULT true;
```

**Before:** `completeAndInvoice` always just created the invoice and navigated away.
**After:** Invoice creation + send is one tap by default; opt-out in Settings.

---

## §5.4 Approval → schedule gap closure

**Files:** `src/pages/quote-detail-page.jsx`

In the approved phase banner, **Schedule** is now always the primary CTA,
regardless of deposit status. When a deposit is still pending, a secondary
`btn-secondary` "Mark deposit paid" button appears below it.

**Before:**
```jsx
{quote.deposit_required && quote.deposit_status !== 'paid'
  ? <button onClick={markDepositPaid}>Mark deposit paid</button>
  : <button onClick={() => setShowScheduleModal(true)}>📅 Schedule</button>}
```

**After:**
```jsx
<div style={{display:'flex',gap:6,flexDirection:'column'}}>
  <button className="btn btn-primary" onClick={() => setShowScheduleModal(true)}>📅 Schedule</button>
  {quote.deposit_required && quote.deposit_status !== 'paid' &&
    <button className="btn btn-secondary btn-sm" onClick={markDepositPaid}>Mark deposit paid</button>}
</div>
```

Mobile send bar at the bottom already had Schedule as primary — now desktop matches.

---

## §5.1 Quote send completion feedback

**Files:** `src/pages/quote-detail-page.jsx`, `src/styles/index.css`

After `handleSendText()` succeeds, a preview card renders for 15 seconds showing:
- Label: *"📤 Sent to [customer name]"*
- The actual SMS body in a blue speech bubble (same style as iMessage)
- Phone number + timestamp

The body is now resolved from the `initial_sms` template (fetched at mount via
`listTemplates`) with proper token substitution — same copy the API uses.
Falls back to the inline hardcoded string if templates haven't loaded.

**State:**
```js
const [lastSentSmsBody, setLastSentSmsBody] = useState(null);
const [lastSentSmsTime, setLastSentSmsTime] = useState(null);
// Cleared after 15 seconds: setTimeout(() => setLastSentSmsBody(null), 15000)
```

**Before:** SMS sent into a black box — contractor saw only a toast.
**After:** Contractor sees exactly what the customer received.

---

## §5.3 Decline / question contextual actions

**Files:** `src/pages/quote-detail-page.jsx`, `src/styles/index.css`

**On `status === 'declined'`:** A contextual action bar appears below the customer
feedback block with three inline buttons:
- ✏️ **Revise & resend** → navigates to editor
- 📋 **Duplicate as new** → calls `handleDuplicate()`
- **Archive** → triggers the delete/archive confirm flow

**On `status === 'question_asked'`:** A contextual prompt reads
*"Customer has a question — reply in the feed below"* with an optional
**✨ Draft a reply** button (shown only when the AI assist API key is configured).
The button calls the existing `/api/ai-assist` endpoint with a `reply_draft`
type, passes the customer's question + quote context, and pre-fills the reply
textarea with the returned draft.

**Before:** Contractor got a banner saying "Changes requested" with no clear next step.
**After:** Contextual triage actions are surfaced inline — one tap to the right path.

---

## §5.2 Message read receipts

**Files:** `src/pages/public-quote-page.jsx`, `src/pages/quote-detail-page.jsx`,
`api/mark-messages-read.js` (new), `supabase/migration_v100_m5.sql`

**Customer side (public-quote-page):** An `IntersectionObserver` fires once when
the conversation thread scrolls into view (threshold 0.3). It calls
`POST /api/mark-messages-read` with the share token. Fires only once per page
load (`readFiredRef`).

**API endpoint (`api/mark-messages-read.js`):**
- Public — share-token auth (same pattern as `public-quote-action.js`)
- Rate limited: 20 calls/hr per token+IP
- Updates `quotes.messages_last_read_at = now()` and increments `messages_read_count`

**Contractor side (quote-detail-page):** Outbound contractor message bubbles
show **"✓ Read Xm ago"** below the bubble if `messages_last_read_at` is later
than the message's timestamp.

**Schema additions:**
```sql
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS messages_last_read_at timestamptz,
  ADD COLUMN IF NOT EXISTS messages_read_count integer NOT NULL DEFAULT 0;
```

**Before:** Contractor could see customer replies but not whether their own messages were read.
**After:** "✓ Read 5m ago" appears on outbound bubbles once the customer scrolls the thread.

---

## §5.6 Deposit receipt SMS to customer — HIGHEST RISK

**Files:** `supabase/functions/send-deposit-receipt/index.ts` (new),
`supabase/migration_v100_m5.sql`

### Decision: Supabase DB webhook path (zero Stripe webhook edits)

**Evaluated both paths per the M5 spec:**

| Path | Pros | Cons |
|------|------|------|
| Additive branch in `api/stripe-webhook.js` | One file to deploy | Requires editing the immutable webhook handler; any mistake in the branch breaks the whole handler; hard to test in isolation |
| Supabase DB webhook → Edge Function | Zero changes to existing code; isolated; independently deployable; re-runnable if Twilio flakes | Requires a separate dashboard webhook registration step |

**Chose the DB webhook path.** The `stripe-webhook.js` handler is immutable by
project convention, and the DB webhook approach has equivalent latency (< 1s
from `markDepositPaid` updating the row to the Edge Function firing).

### How it works

1. `api/stripe-webhook.js` fires `markDepositPaid()` (existing — unchanged).
2. `markDepositPaid()` writes `deposit_status = 'paid'` to `public.quotes`.
3. Supabase DB webhook (registered in the dashboard) fires on UPDATE to
   `public.quotes` where `new.deposit_status = 'paid'` and `old.deposit_status != 'paid'`.
4. Edge Function `send-deposit-receipt` runs:
   - Checks `deposit_receipt_sent_at` — skips if already set (idempotent).
   - Loads full quote + customer + profile.
   - Resolves `deposit_received_sms` template (custom or system default).
   - Resolves `{nextStep}` to the scheduled booking date if one exists, else
     *"I'll be in touch this week about scheduling."*
   - Sends SMS to the **customer** (not contractor) from the contractor's business name.
   - Calls `rpc_mark_deposit_receipt_sent()` to set `deposit_receipt_sent_at`.

**Schema additions:**
```sql
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS deposit_receipt_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.rpc_mark_deposit_receipt_sent(p_quote_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.quotes SET deposit_receipt_sent_at = now()
   WHERE id = p_quote_id AND deposit_receipt_sent_at IS NULL;
END; $$;
```

### Registering the DB webhook

In the Supabase dashboard → Database → Webhooks → Create a new hook:
```
Name:        send-deposit-receipt
Table:       public.quotes
Event:       UPDATE
Filter:      new.deposit_status = 'paid'
URL:         https://<project>.supabase.co/functions/v1/send-deposit-receipt
Method:      POST
Header:      Authorization: Bearer <SUPABASE_ANON_KEY>
```

### Template rendered (system default)

```
Thanks {firstName} — your {depositAmount} deposit came through.
{nextStep} I'll take it from here.
```

Resolves to e.g.:
*"Thanks Sarah — your $400 deposit came through. See you Thursday Apr 18. I'll take it from here."*

Sent from the contractor's Twilio number. Contractor-as-sender per §9.5.

**Before:** Customer paid deposit → got a dry Stripe receipt from "Stripe" — cold, branded wrong.
**After:** Customer gets a warm, branded SMS from the contractor within seconds of payment.

---

## Database migration

```bash
psql $DATABASE_URL -f supabase/migration_v100_m5.sql
```

Adds:
- `profiles.auto_send_invoice_on_complete boolean DEFAULT true`
- `quotes.messages_last_read_at timestamptz`
- `quotes.messages_read_count integer DEFAULT 0`
- `quotes.deposit_receipt_sent_at timestamptz`
- `rpc_mark_deposit_receipt_sent(uuid)` function

Rollback:
```sql
ALTER TABLE public.profiles   DROP COLUMN auto_send_invoice_on_complete;
ALTER TABLE public.quotes     DROP COLUMN messages_last_read_at, DROP COLUMN messages_read_count, DROP COLUMN deposit_receipt_sent_at;
DROP FUNCTION IF EXISTS public.rpc_mark_deposit_receipt_sent(uuid);
```

---

## Files changed

| File | Change |
|------|--------|
| `src/pages/quote-detail-page.jsx` | §5.7 strip, §5.1 preview, §5.3 contextual, §5.4 schedule CTA, §5.2 read receipt display, §5.5 auto-send |
| `src/pages/public-quote-page.jsx` | §5.2 IntersectionObserver → mark-messages-read |
| `src/pages/settings-page.jsx` | §5.5 Preferences tab + auto-send toggle |
| `src/styles/index.css` | §5.7 `.ql-strip` styles, §5.1 `.qd-sms-preview`, §5.3 `.qd-contextual-actions`, §5.2 `.qd-feed-msg-read` |
| `api/mark-messages-read.js` | New — §5.2 read receipt endpoint |
| `supabase/migration_v100_m5.sql` | New — schema additions for §5.5, §5.2, §5.6 |
| `supabase/functions/send-deposit-receipt/index.ts` | New — §5.6 deposit receipt Edge Function |
| `deploy-scripts/smoke-test.sh` | Added `api/mark-messages-read.js`, `api/send-followup.js`, edge function to critical files check |
| `api/stripe-webhook.js` | **Untouched** |
| `api/public-quote-action.js` | **Untouched** |
