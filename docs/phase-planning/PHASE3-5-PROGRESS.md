# Phase 3.5 — Progress

**Status:** Part B is **partially complete**. Six of roughly eleven slices have
shipped. The UI rewrite, send-path work, voice input, telemetry, coachmarks,
and timing validation remain.

## What's in this package

### Part A — Correctness patches (shipped earlier)
See `CHANGELOG-PATCHES-CORRECTNESS.md` at repo root.
- A1: webhook status regression guard
- A2: webhook idempotency via column not internal_notes
- A3: atomic status transitions on customer actions

### Part B — Slice 1: Backend plumbing
See `CHANGELOG-PHASE3-5-SLICE-BACKEND.md` and `PHASE3-5-AUDIT-SLICE-BACKEND.md`.
- `getQuotingDefaults(userId)` helper in `src/lib/api/quotes.js`
- `useCustomers` hook + `fuzzyScore` + `searchCustomers` in `src/hooks/use-customers.js` (new file, no consumers yet)
- H1: line-item upsert preserving IDs across saves in `src/lib/api/quotes.js`
- H4: atomic status update after Resend 200 in `api/send-quote-email.js`

### Part B — Slice 2: Smart-defaults wiring
See `CHANGELOG-PHASE3-5-SLICE-DEFAULTS-WIRING.md`.
- Wired `getQuotingDefaults` into `src/pages/quote-builder-page.jsx` load effect
- Precedence: smart defaults > `profile.default_*` > hardcoded

### Part B — Slice 3: M7 duplicate customer check (+ UUID retry fix)
See `CHANGELOG-PHASE3-5-SLICE-3.md`.
- `findCustomerByContact(userId, {phone, email})` helper in `src/lib/api/customers.js`
- Quick-create handler extracted from inline JSX and wired to call the helper before `createCustomer`; toasts "Using existing contact: {name}" on match
- **Drive-by fix:** `createQuote` line-items retry now strips `_lineItemsBadCols` from already-normalized rows instead of re-calling `normalizeLineItems` on raw draft. Prevents fresh UUIDs being minted on retry, preserving H1's stable-ID contract.

### Part B — Slice 4: `isNetworkError` helper + autosave retune
See `CHANGELOG-PHASE3-5-SLICE-4.md`.
- `isNetworkError(err)` export in `src/lib/offline.js` covers offline, `TypeError`, `AbortError`, 502/503/504, and common message patterns
- Builder's save catch consumes the helper
- 30s autosave `setInterval` replaced with 800ms debounce + `visibilitychange`/`pagehide` flush
- Confirmed `syncOfflineDrafts` is already wired in `app-shell.jsx` L51 — no additional wiring needed

### Part B — Slice 5: H4 client reconciliation
See `CHANGELOG-PHASE3-5-SLICE-5.md` and `PHASE3-5-AUDIT-SLICE-5.md`.
- `confirmSend` now merges server-authoritative `q.status` and `q.sent_at` into draft state after `save('sent')` returns
- **Audit flag:** the builder's send modal only offers `text` and `copy`; the email delivery method is not yet in the UI, so the server's main H4 branch remains unexercised from the builder. End-to-end H4 verification defers to slice 7 or whichever slice adds the email option.

### Part B — Slice 6: M8 keyboard-safe Send CSS
See `CHANGELOG-PHASE3-5-SLICE-6.md` and `PHASE3-5-AUDIT-SLICE-6.md`.
- `.rq-footer` padding now includes `env(keyboard-inset-height, 0px)` on the base rule and the mobile (<=768px) media override
- **Audit flag:** plan named `src/styles/phase1-builder.css` but the `.rq-footer` rule lives in `src/styles/index.css` around L3005; edit landed in index.css
- Real-device verification pending (record in `PHASE3-5-TIMING.md`)

### Part B — Slice 7: Send-path rewrite (optimistic + 3s undo + C3 sms: fallback + email delivery)
See `CHANGELOG-PHASE3-5-SLICE-7.md` and `PHASE3-5-AUDIT-SLICE-7.md`.
- `src/components/toast.jsx` — new `showUndo(msg, durationMs, onCommit, onUndo)` API with 50ms countdown tick and animated progress bar; `show()`/`clear()` unchanged
- `src/styles/index.css` — `.toast-undo`, `.toast-undo-bar`, `.toast-undo-btn` CSS rules
- `src/pages/quote-builder-page.jsx`:
  - `handleConfirmSend` kicks off the 3s undo window via `showUndo`; `actualSend` fires after the window expires
  - Unmount cleanup effect cancels any in-flight undo timer (prevents send firing after navigation)
  - **C3:** When Twilio fails, native SMS app opens and a confirm card ("Did you send it? Yes / No") is shown; only "Yes" commits `sent_at`; "No" rolls back to `draft` via `updateQuote`
  - **Email delivery method** added to `rq-send-methods`; routes through `sendQuoteEmail(quoteId, to)` with H4 `{status, sent_at}` reconciliation (resolves `PHASE3-5-AUDIT-SLICE-5.md` flag)
  - `_markSent()` helper consolidates post-send bookkeeping (analytics, localStorage, phase flip)
- **A3 re-verified:** no server-side guards touched; undo window does not write `status='sent'` client-side; see changelog table

## What still needs to ship for Part B "done"

1. **Slice 8 — B13 telemetry** — six events with a shared `session_id`, small
3. **Slice 9 — B11 coachmarks + B12 keyboard shortcuts** — combined, small each
4. **Slice 10 — B5 voice input + parallel AI pre-warm** — medium
5. **Slice 11 — B4 customer picker UI consuming `useCustomers`** — medium
6. **Slice 12 — B2/B3 single-page layout rewrite** — the centerpiece, high risk, prefer local dev
7. **Slice 13 — Timing validation** — requires real browser + emulated iPhone SE + throttle; cannot be done in a chat session

See `PHASE3-5-NEXT-SESSIONS.md` for each slice's prompt.
