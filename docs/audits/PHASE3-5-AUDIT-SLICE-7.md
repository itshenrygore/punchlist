# Phase 3.5 Slice 7 — Audit

## Email delivery method: added (resolves PHASE3-5-AUDIT-SLICE-5.md flag)

`PHASE3-5-AUDIT-SLICE-5.md` flagged that the builder's send modal only offered
`text` and `copy`, leaving the server's H4 main branch in
`api/send-quote-email.js` unreachable from the primary UI.

**This slice adds the `email` option** to `rq-send-methods`. It routes through
`sendQuoteEmail(quoteId, to)` in `actualSend()` and applies the same
`{status, sent_at}` reconciliation pattern slice 5 established for the
`text`/`copy` paths. The H4 server branch is now exercisable end-to-end
from the builder UI.

The audit-5 flag is considered resolved. Manual verification via the email
path (test item 6 in the slice-7 changelog) should be run before closing.

---

## Plan deviation: `confirmSend` renamed; new intermediate functions introduced

**PHASE3-5-PLAN.md §2.7** names the functions `handleSend` / `actualSend`
and shows a `pendingSend` state object. This slice implements the same
semantic but with a different shape:

- `pendingSend` state was **not** added. Instead, the undo timer is managed
  entirely inside `ToastProvider` (via `undoTimerRef`) and the builder
  holds only `undoCancelRef` — a ref to the imperative cancel function
  returned by `showUndo`. This avoids a second React re-render cycle and
  keeps the timer logic co-located with the toast.
- `confirmSend` was renamed to `handleConfirmSend` (kicks off undo window)
  and `actualSend` (the deferred real send). The rename is non-breaking —
  `confirmSend` was only called from the modal's confirm button, which now
  calls `handleConfirmSend`.
- `_markSent()` is a new private helper that consolidates the
  post-send bookkeeping (localStorage, analytics, `setSentSuccess`,
  `setPhase`, `setSentThisMonth`) that was previously inlined in
  `confirmSend`. This was needed because three paths now reach "definitively
  sent": Twilio success, email success, and the C3 SMS confirm card's
  "Yes, sent" tap.

These are implementation-level divergences from the plan's pseudocode, not
semantic ones. The observable contract (3s undo window, C3 sms confirm,
H4 reconciliation) matches the plan exactly.

---

## C3 rollback: `updateQuote` called with `{status: 'draft', sent_at: null}`

When the user taps "No, cancel" on the SMS confirm card, `handleSmsCancel`
calls `updateQuote(quoteId, { status: 'draft', sent_at: null })` to roll
back the server row that `save('sent')` already committed.

**Risk:** If this rollback fails (network error, RLS policy, etc.), the DB
row stays `status='sent'` while the local UI reverts to `'draft'`. The user
would see a draft but the customer's share link would show a live quote.

**Mitigation applied:** The rollback is wrapped in `try/catch` with a
`console.warn`. A future slice could add a toast warning if the rollback
fails (e.g. "Couldn't cancel — quote may still appear sent to your customer").
This is recorded as a deferred risk below.

**Why not avoid writing `status='sent'` until confirmation?** The 3s undo
window fires `actualSend` unconditionally (it doesn't know which delivery
method will be used). Splitting `save('sent')` to happen only after the C3
confirm would require `actualSend` to know its own delivery path before
starting, and would mean the quote isn't saved at all during the SMS app
open window — a worse UX failure mode if the user backgrounds the app. The
current design (write early, rollback if cancelled) is the safer tradeoff.

---

## A3 race guard: verified intact

See the A3 re-verification table in `CHANGELOG-PHASE3-5-SLICE-7.md`.
Summary: no server-side guards were touched. The undo window does not
write `status='sent'` client-side during the countdown. The Send path
writes to `'sent'` which doesn't intersect with the customer-action
statuses guarded by `api/public-quote-action.js`'s `.in(ACTIONABLE_STATUSES)`
predicate.

---

## Deferred risks

1. **C3 rollback failure is silent.** If `updateQuote` in `handleSmsCancel`
   throws (network error), the DB stays `sent` while local UI shows `draft`.
   A warning toast should be added in a future slice.

2. **Email delivery: no message body customisation.** The `text` path lets
   the contractor edit the SMS body before sending. The `email` path sends
   whatever `api/send-quote-email.js` composes server-side. Adding an
   optional email message field to the send modal is a future UX improvement,
   not a correctness issue.

3. **Undo toast `durationMs` is hardcoded to `3000` in `handleConfirmSend`
   but the progress bar denominator in `toast.jsx` is also hardcoded to
   `3000`.** If the duration is ever changed, both must be updated. A
   `SEND_UNDO_MS` constant shared between the two files would be cleaner —
   deferred to avoid cross-file churn now.

4. **Real-device C3 verification pending.** Whether `window.open('sms:...',
   '_self')` reliably suspends the PWA and returns to it (triggering the
   confirm card) varies by iOS/Android version and browser. Record results
   in `PHASE3-5-TIMING.md` during the timing validation pass (slice 13).
