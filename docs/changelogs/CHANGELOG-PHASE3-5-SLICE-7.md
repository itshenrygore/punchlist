# Phase 3.5 Slice 7 — Send-path rewrite: optimistic + 3s undo + C3 sms: fallback

**Status:** Shipped.
**Plan ref:** PHASE3-5-PLAN.md §2.7 (B8) + §2.8 (C3) + §2.11 (H4 email path)
**Files changed:**
- `src/components/toast.jsx` — new `showUndo` API with countdown bar
- `src/styles/index.css` — `.toast-undo`, `.toast-undo-bar`, `.toast-undo-btn` CSS rules
- `src/pages/quote-builder-page.jsx` — send-path rewrite: optimistic + 3s undo + C3 sms confirm card + email delivery method

---

## Change 1 — `showUndo` toast API (`src/components/toast.jsx`)

The existing toast only had `show(message, type, action)` and `clear()`.
The `action` prop supported an arbitrary button but had no countdown and
no auto-dismiss timing that coordinated with the action.

**Added `showUndo(message, durationMs, onCommit, onUndo)`:**

```jsx
// Before — only show() and clear() existed. No countdown support.
const { show: toast } = useToast();
toast('Link copied', 'success');

// After — showUndo is also available
const { show: toast, showUndo } = useToast();

// Show a 3s undo window. onCommit fires if user does nothing; onUndo fires if they tap Undo.
const cancel = showUndo(
  'Texting quote…',
  3000,
  () => actualSend(),
  () => toast('Send cancelled', 'info'),
);
// cancel() can be called imperatively (e.g. on unmount) to abort the timer.
```

**Implementation details:**
- A 50ms `setInterval` ticks down `undoMs` state for the progress bar.
- A `setTimeout` fires `onCommit` at `durationMs`.
- `showUndo` returns a cancel function that clears both timers and hides
  the toast — used by the builder's unmount cleanup effect.
- `clearUndo()` is called at the start of every `show()` and `showUndo()`
  call so a new toast always cleanly supersedes a prior undo countdown.
- `useEffect(() => () => { clearInterval/clearTimeout }, [])` cleans up
  if `ToastProvider` itself unmounts.
- The `show()` and `clear()` signatures are unchanged — no existing callers need updating.

**New toast variant CSS (`src/styles/index.css`):**

```css
/* Before — no undo styles */

/* After */
.toast-undo { background: rgba(15,15,16,.97); color: var(--text);
  border: 1px solid rgba(255,255,255,.12); position: relative;
  overflow: hidden; padding-bottom: 18px; }
.toast-undo-bar { position: absolute; bottom: 0; left: 0; height: 3px;
  background: var(--brand); border-radius: 0 0 var(--r) var(--r);
  transition: width 50ms linear; }
.toast-undo-btn { background: none; border: 1px solid rgba(255,255,255,.25);
  border-radius: var(--r-sm); padding: 4px 12px; font-size: 12px;
  font-weight: 700; color: var(--text); cursor: pointer; margin-left: auto; }
.toast-undo-btn:hover { background: rgba(255,255,255,.1);
  border-color: rgba(255,255,255,.4); }
```

---

## Change 2 — Optimistic send + 3s undo (`src/pages/quote-builder-page.jsx`)

**Before:** Tapping the confirm button in the send modal called `confirmSend()`
which immediately called `save('sent')` and fired the delivery method.
No undo was possible once the button was tapped.

**After:** The confirm button calls `handleConfirmSend()`, which closes the
modal and starts the undo window. The actual network calls happen only in
`actualSend()`, which is passed as `onCommit` to `showUndo`.

```jsx
// Before
async function confirmSend() {
  setShowSend(false); setSending(true);
  try {
    const q = await save('sent');
    // ... immediate send
  } catch (e) { ... }
}

// After — two stages
function handleConfirmSend() {
  setShowSend(false);
  const methodLabel = deliveryMethod === 'text' ? 'Texting quote…'
    : deliveryMethod === 'email' ? 'Emailing quote…' : 'Sending quote…';
  const cancelFn = showUndo(
    methodLabel,
    3000,
    () => { actualSend(); },         // fires after 3s if not undone
    () => { toast('Send cancelled', 'info'); }
  );
  undoCancelRef.current = cancelFn;  // stored for unmount cleanup
}

async function actualSend() {
  setSending(true);
  try {
    const q = await save('sent');
    if (!q) { setSending(false); return; }
    // H4 reconciliation (same slice-5 pattern)
    if (q.status || q.sent_at) {
      setDraft(d => ({ ...d,
        status: q.status ?? d.status,
        sent_at: q.sent_at ?? d.sent_at,
      }));
    }
    // ... delivery-method routing
  } catch (e) { setError(e?.message || 'Send failed'); }
  finally { setSending(false); }
}
```

**Unmount safety:** A `useEffect(() => () => { undoCancelRef.current?.(); }, [])`
ensures that if the user navigates away during the 3s window, the timer is
cleared and `actualSend` never fires.

**A3 re-verification (double-tap race):** The undo window does NOT write
`status='sent'` client-side during the countdown — the draft status stays
unchanged until `actualSend → save('sent') → updateQuote` completes
server-side. The server's A3 predicate (`.in('status', ACTIONABLE_STATUSES)`
in `api/public-quote-action.js`) is unchanged. The Send path writes to
`status='sent'`, which does not intersect with the approve/decline/revision
actions guarded by A3 — so double-tap from two tabs resolves to exactly
one committed `status='sent'` and one no-op (the second `save('sent')` on
an already-`sent` quote is idempotent via `updateQuote`'s `eq('id', ...)`,
and Supabase's row-level update is atomic). No server-side A3 guards were
removed or weakened.

---

## Change 3 — C3 SMS confirm card (`src/pages/quote-builder-page.jsx`)

**Before:** When Twilio failed (or `VITE_TWILIO_DISABLED`), the builder opened
`sms:<number>?body=…` via `window.open` and immediately wrote `sent_at`,
with no confirmation that the user actually tapped Send in the native app.

```jsx
// Before
else {
  window.open(`sms:${selCustomer?.phone}?body=...`, '_self');
  toast('Opening messages…', 'info');
  // sent_at already committed — regardless of whether user sent
}
```

**After:** When Twilio fails, `smsConfirmPending` state is set, which renders
a confirm card. `sent_at` is only committed after the user taps "Yes, sent".

```jsx
// After — actualSend(), sms: path
const result = await smsNotify.customMessage({ to: selCustomer?.phone, body: finalBody });
if (result?.ok) {
  toast(`Quote texted to ${firstName}`, 'success');
  _markSent();
} else {
  // C3: open native SMS, show confirm card — do NOT commit sent_at yet
  window.open(`sms:${selCustomer?.phone}?body=${encodeURIComponent(finalBody)}`, '_self');
  setSmsConfirmPending({ url, phone: selCustomer?.phone, body: finalBody,
                          quoteId: q.id, firstName });
  // _markSent() is NOT called here — deferred to user confirmation
}

// Confirm card handlers:
async function handleSmsConfirm() {
  setSmsConfirmPending(null);
  _markSent();   // commits analytics + local phase flip; status already 'sent' from save()
  toast(`Quote sent to ${pending.firstName || pending.phone}`, 'success');
}

async function handleSmsCancel() {
  setSmsConfirmPending(null);
  // Roll back: server and local state revert to 'draft'
  await updateQuote(quoteId, { status: 'draft', sent_at: null });
  setDraft(d => ({ ...d, status: 'draft', sent_at: null }));
  setPhase('building');
  toast('Send cancelled — quote is still a draft', 'info');
}
```

The confirm card is a modal overlay with no dismiss-on-backdrop-click —
the user must explicitly choose Yes or No.

---

## Change 4 — Email delivery method (`src/pages/quote-builder-page.jsx`)

**Before:** The send modal's `rq-send-methods` list only had `text` and `copy`.
The server's H4 main branch in `api/send-quote-email.js` was unreachable
from the builder UI (flagged in `PHASE3-5-AUDIT-SLICE-5.md`).

```jsx
// Before
[{ v: 'text', l: 'Text message', icon: '💬' },
 { v: 'copy', l: 'Copy link',    icon: '🔗' }]
```

**After:** Email added as the second option. Routes through `sendQuoteEmail`
with the same H4 `{status, sent_at}` reconciliation pattern from slice 5.

```jsx
// After
[{ v: 'text',  l: 'Text message', icon: '💬' },
 { v: 'email', l: 'Email',        icon: '✉️' },
 { v: 'copy',  l: 'Copy link',    icon: '🔗' }]

// In actualSend():
} else if (deliveryMethod === 'email') {
  const cust = customers.find(c => c.id === draft.customer_id);
  const response = await sendQuoteEmail(q.id, cust?.email);
  // H4 reconciliation
  if (response.status || response.sent_at) {
    setDraft(d => ({ ...d,
      status: response.status ?? d.status,
      sent_at: response.sent_at ?? d.sent_at,
    }));
  }
  toast(`Quote emailed to ${firstName || cust?.email}`, 'success');
  _markSent();
}
```

A gate check was added to `handleSend()` that requires `cust?.email` when
`deliveryMethod === 'email'`, mirroring the existing phone check for `text`.

`sendQuoteEmail` was added to the import from `../lib/api` (it was already
exported from `src/lib/api/quotes.js` → `src/lib/api/index.js`).

---

## A3 race condition re-verification

| Scenario | Expected | Mechanism |
|---|---|---|
| Double-tap Send in the same tab within 3s | Second tap is a no-op — undo window is already open | `showUndo` replaces any prior undo state; the modal is closed |
| Double-tap Send in two tabs within 500ms | Exactly one committed `status='sent'`; second update is a no-op | Server: `updateQuote` is a `PATCH eq('id', quoteId)` — last-write-wins, both write `'sent'`, idempotent. Customer-action A3 (`.in(ACTIONABLE_STATUSES)`) is in `api/public-quote-action.js` and is untouched. |
| Customer approves while contractor is in 3s undo window | No conflict — `'sent'` and approve/decline/revision don't intersect | Contractor hasn't written `'sent'` yet; A3 on customer side guards `'approved'`/`'declined'`/`'revision_requested'` |
| User navigates away during 3s undo window | `actualSend` does not fire | `undoCancelRef.current?.()` in unmount `useEffect` clears the timer |

No server-side A3 guards were removed. `api/public-quote-action.js` and
`api/stripe-webhook.js` were not touched.

---

## Testing

1. **3s undo — cancel.** Open builder with a valid draft. Tap send → confirm.
   Undo toast appears with countdown bar. Tap "Undo" within 3s. Expect toast
   "Send cancelled", quote status remains `'draft'` in DB.

2. **3s undo — commit.** Same flow. Let timer expire. Expect send fires,
   quote status becomes `'sent'` in DB, success toast appears.

3. **Unmount during countdown.** Start send, navigate away before 3s. Expect
   no network request fires after navigation (check DevTools Network tab).

4. **C3 — SMS confirm: Yes.** With Twilio disabled (`VITE_TWILIO_DISABLED=1`
   or a Twilio 4xx from `/api/send-sms`), tap send via "Text message". Native
   SMS app opens. Confirm card appears. Tap "Yes, sent". Expect quote
   `status='sent'` in DB, success toast.

5. **C3 — SMS confirm: No.** Same setup. Tap "No, cancel". Expect quote
   `status='draft'` in DB (rolled back via `updateQuote`), info toast.

6. **Email delivery.** Select "Email" in the send methods. Tap confirm. Let
   3s pass. Expect `/api/send-quote-email` called with `{quoteId, to}`. DB
   `status='sent'` and `sent_at` populated with server-authoritative timestamp.

7. **Email gate — no email address.** Customer has no email. Select "Email".
   Expect error "This customer has no email address." without opening modal.

8. **A3 double-tap.** Open builder in two tabs, tap Send→Confirm in both
   within 500ms. Expect exactly one Resend email fires (verify in Resend
   dashboard or server logs). DB `sent_at` should be a single timestamp.

9. **Backwards compat — `show()` toast.** Save a draft. Expect "Saved" success
   toast still works as before (no regression from toast refactor).

---

## Revert

```bash
git checkout HEAD -- src/components/toast.jsx src/styles/index.css src/pages/quote-builder-page.jsx
```

Or manually:

**`src/components/toast.jsx`:** Remove `showUndo`, `handleUndo`, `clearUndo`,
`undoMs`, `undoIntervalRef`, `undoTimerRef` and the cleanup `useEffect`.
Restore `show()` and `clear()` as the only exports. Restore the original
single-import of `useState, useCallback, useContext`. Remove `showUndo` from
`useToast()` fallback return.

**`src/styles/index.css`:** Remove the four `.toast-undo*` rules added after
`.toast-icon`.

**`src/pages/quote-builder-page.jsx`:**
- Remove `showUndo` from `useToast()` destructure.
- Remove `sendQuoteEmail` from the `../lib/api` import.
- Remove `smsConfirmPending` state and `undoCancelRef`.
- Remove the second `useScrollLock(!!smsConfirmPending)` call.
- Remove the unmount cleanup `useEffect` for `undoCancelRef`.
- Replace `handleConfirmSend`, `actualSend`, `_markSent`, `handleSmsConfirm`,
  `handleSmsCancel` with the original `confirmSend` function.
- Revert the send modal JSX: remove the `email` option from `rq-send-methods`,
  change `onClick={handleConfirmSend}` back to `onClick={confirmSend}`,
  remove the email help text block, remove the C3 SMS confirm card JSX.
- Revert `handleSend`'s email gate check.
