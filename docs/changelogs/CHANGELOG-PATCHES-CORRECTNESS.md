# Correctness Patches — quote flow

Three pinpoint fixes from the Phase 3.5 sprint prompt's Part A. Ships
independently of any Part B work; each change is individually revertable.

## Summary

| ID | File | What changed | Why it matters |
|----|------|--------------|----------------|
| A1 | `api/stripe-webhook.js` (`markDepositPaid`) | Status transition is now gated — `status` only flips to `approved` when current is `approved_pending_deposit`. Post-approval statuses (`scheduled` / `completed` / `invoiced` / `paid`) and unexpected pre-approval statuses leave `status` untouched. | A late or replayed Stripe webhook would previously rewind a `scheduled` quote back to `approved`, flashing a stale state to the contractor and re-triggering any status-driven workflow downstream. |
| A2 | `api/stripe-webhook.js` (both `markDepositPaid` and `markInvoicePaidViaStripe`) | Idempotency is now driven by the `deposit_session_id` / `stripe_session_id` column read, not by a substring scan of `internal_notes`. `markInvoicePaidViaStripe` no longer AND-gates the short-circuit with `status === 'paid'`. | Previous behavior: if the contractor cleared their internal notes, a Stripe webhook retry fired duplicate notifications, SMS, emails, and (on the invoice path) inserted a duplicate row into `payments`. Columns are authoritative; contractors can't overwrite them. |
| A3 | `api/public-quote-action.js` (APPROVE, REVISION_REQUESTED, DECLINE branches) | Fetch-then-check-then-update replaced with a single atomic UPDATE carrying a status-whitelist predicate (`.in('status', ACTIONABLE_STATUSES)`). APPROVE additionally guards `signed_at IS NULL`. If the UPDATE matches 0 rows, the request returns 409 without firing any side effects. Downstream notifications are now wrapped in a single try/catch so a provider outage doesn't 500 the customer-facing response. | Previous behavior: two concurrent approves (double-tap, or same-customer in two tabs within ~500ms) would both pass the in-memory guard, both commit, and both fire contractor SMS + email + push + in-app notification + customer confirmation email. The atomic predicate is the only race-condition-safe fix short of a database transaction. |

## Details

### A1 — `markDepositPaid` no longer regresses quote status

**Before:**
```js
await supabase.from('quotes').update({
  …
  status: 'approved',   // unconditional
}).eq('id', quoteId);
```

**After:**
```js
const POST_APPROVAL = ['scheduled', 'completed', 'invoiced', 'paid'];
const updatePayload = { /* deposit_* fields + internal_notes + audit */ };
if (quote.status === 'approved_pending_deposit') {
  updatePayload.status = 'approved';
} else if (POST_APPROVAL.includes(quote.status)) {
  // Leave status alone — quote has already moved past approval.
} else {
  console.warn('[stripe-webhook] Deposit received on quote', quoteId,
    'with unexpected status:', quote.status);
}
await supabase.from('quotes').update(updatePayload).eq('id', quoteId);
```

The pre-approval branch (status is `draft`/`sent`/`viewed` etc.) is a
defensive path — it shouldn't happen in production because deposit
sessions aren't created until approval, but if it does we log and
preserve whatever status is on the row rather than silently overwriting.

### A2 — Idempotency via column, not text search

**Before (deposit):**
```js
const { data: quote } = await supabase.from('quotes')
  .select('internal_notes').eq('id', quoteId).maybeSingle();
const current = String(quote?.internal_notes || '');
if (current.includes(session.id)) return;   // ← fragile
```

**After (deposit):**
```js
const { data: quote } = await supabase.from('quotes')
  .select('internal_notes,status,deposit_session_id')
  .eq('id', quoteId).maybeSingle();
if (!quote) return;
if (quote.deposit_session_id === session.id) return;   // ← column-driven
```

**Before (invoice):**
```js
if (invoice.status === 'paid' && invoice.stripe_session_id === session.id) return;
```

**After (invoice):**
```js
if (invoice.stripe_session_id === session.id) return;
```

The invoice change is subtle but important: the original AND-gate meant
a webhook retry against a still-`partial` invoice would not
short-circuit, and the handler would insert a duplicate row into the
`payments` table. Now we short-circuit on session-id match regardless
of the current invoice status.

### A3 — Atomic status transition on customer actions

**Before (approve, representative of all three branches):**
```js
if (['approved', 'approved_pending_deposit', 'scheduled', 'completed']
    .includes(quote.status)) {
  return res.status(400).json({ error: 'Already approved' });
}
// … build updatePayload …
const { data: updated, error: ue } = await supabase.from('quotes')
  .update(safePayload).eq('id', quote.id)
  .select('status,deposit_status').single();
// … fire notifications / emails / SMS … (always runs on success)
```

**After:**
```js
// Fast-path guard kept as-is for nicer 400 error copy.
// Atomic UPDATE adds a status-whitelist predicate as race-condition backstop.
const { data: updated, error: ue } = await supabase.from('quotes')
  .update(safePayload).eq('id', quote.id)
  .in('status', ACTIONABLE_STATUSES)
  .is('signed_at', null)           // approve-only: race-proofs signature check
  .select('status,deposit_status')
  .maybeSingle();
if (!updated) {
  return res.status(409).json({ error: 'Already approved or no longer valid' });
}
try {
  // … fire notifications / emails / SMS …
} catch (notifyErr) {
  console.warn('[public-quote-action] approve notifications failed:', notifyErr?.message);
}
```

`ACTIONABLE_STATUSES` is a module-level constant:
```js
const ACTIONABLE_STATUSES = ['draft', 'sent', 'viewed',
  'question_asked', 'revision_requested', 'declined'];
```
Matches the inverse of the existing pre-approval list so behavior is
unchanged for non-racing requests — a customer changing their mind from
`declined` or `revision_requested` can still approve.

The notification try/catch is a correctness improvement too: previously,
if Resend or Twilio returned an error mid-fan-out, the handler would
500 and the customer would see a failure screen even though their
approval had already committed to the database. Now the write commits,
the response returns 200, and any notification failure is logged
server-side.

Same pattern applied to `REVISION_REQUESTED` and `DECLINE`.

## Testing

Static:
- `node --check api/stripe-webhook.js` → pass
- `node --check api/public-quote-action.js` → pass

Live (required before merge — must be run against a non-prod Stripe +
Supabase pair):

1. **A1:** Create a quote, approve it, pay the deposit, manually
   advance its status to `scheduled` in Supabase. Use the Stripe CLI to
   replay the `checkout.session.completed` event for that quote's
   session:
   ```
   stripe events resend evt_...
   ```
   Verify in Supabase that `status` is still `scheduled` — not
   `approved`. Verify `deposit_paid_at` is unchanged (should be, since
   A2 short-circuits before reaching the update).

2. **A2:** Create a paid-deposit quote. In Supabase, set
   `internal_notes = ''` on that quote row. Replay the webhook:
   ```
   stripe events resend evt_...
   ```
   Verify no new notifications appear in the `notifications` table for
   that `user_id` in the last minute. Verify no duplicate SMS sends in
   Twilio's log. Verify `deposit_session_id` is unchanged.

3. **A3:** Open a public quote URL in two browser tabs. In Chrome
   devtools, throttle network to Slow 3G. Click Approve in both tabs
   within 500ms. Verify:
   - Exactly one row in `notifications` with `type='quote_approved'`
     for that `user_id`.
   - One `signature_data` write.
   - One entry in the contractor's Twilio log.
   - One `signed_confirmation` email in the Resend log.
   - The second tab receives a 409 response (inspect in devtools
     Network panel).

Repeat step 3 for the DECLINE and REVISION_REQUESTED actions.

## Revert

Each fix is a self-contained edit to one function:
- A1 + A2 are adjacent in `markDepositPaid`; revert both together by
  reverting `api/stripe-webhook.js`. The parallel A2 in
  `markInvoicePaidViaStripe` is a separate 2-line change.
- A3 reverts cleanly by restoring the three `single()` updates and
  removing the `ACTIONABLE_STATUSES` constant.

Nothing in Part B depends on these patches, but Part B's optimistic
send UX will *expose* the A3 race more frequently if A3 is reverted,
because the new flow fires approvals faster than the current modal
flow.
