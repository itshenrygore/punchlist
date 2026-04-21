# Phase 3.5 Slice 5 — H4 Client Reconciliation

**Status:** Shipped (partial — see audit).
**Plan ref:** PHASE3-5-PLAN.md §2.11 (client-side portion)
**Files changed:**
- `src/pages/quote-builder-page.jsx` — merge server-authoritative `{status, sent_at}` into draft after send

---

## Context

Slice 2 shipped the server-side H4 change in `api/send-quote-email.js`: after
`resend.emails.send` returns 200, the server performs an atomic status
update gated on `.in('status', ['draft', 'sent', 'viewed'])`, then returns
`{success, status, sent_at}` with the authoritative values.

This slice closes the loop on the client: the builder's `confirmSend` now
trusts those server values over any optimistic local flip.

## Change

**Before (`src/pages/quote-builder-page.jsx`, `confirmSend`):**

```js
async function confirmSend() {
  setShowSend(false); setSending(true);
  try {
    const q = await save('sent'); if (!q) { setSending(false); return; }
    const url = `${window.location.origin}/public/${q.share_token}`;
    // …
```

`save('sent')` invokes `updateQuote(quoteId, { ...draft, status: 'sent' })`.
The returned `q` is the DB row, so `q.status` and `q.sent_at` are already
whatever the server committed. But the builder ignored them — the local
`draft.status` was whatever the in-memory state said.

If the server held the status (for example, the quote was already
`approved`, or the `.in(…)` predicate rejected the transition), the client
still rendered "sent" locally until the next page load reconciled.

**After:**

```js
async function confirmSend() {
  setShowSend(false); setSending(true);
  try {
    const q = await save('sent'); if (!q) { setSending(false); return; }
    // H4 client reconciliation: trust the server's authoritative status/sent_at
    // over any optimistic local flip. If the server held the status (e.g. quote
    // was already 'approved'), the draft reflects that instead of silently
    // pretending it flipped to 'sent'.
    if (q.status || q.sent_at) {
      setDraft(d => ({
        ...d,
        status: q.status ?? d.status,
        sent_at: q.sent_at ?? d.sent_at,
      }));
    }
    const url = `${window.location.origin}/public/${q.share_token}`;
    // …
```

## Scope

This covers the `text` and `copy` delivery paths, which route through
`updateQuote` and return a DB row that already reflects server state.

The `email` delivery path (which would call `sendQuoteEmail` → the main
branch of `api/send-quote-email.js`, where H4 lives) is not yet reachable
from the builder UI. See `PHASE3-5-AUDIT-SLICE-5.md`.

## Testing

1. **Normal send.** Send a draft via text. Expect `draft.status` to become `'sent'` and `draft.sent_at` to be populated with an ISO timestamp.
2. **Server holds status.** In Supabase, manually set a quote's status to `'approved'`. Open it in the builder, try to re-send via "Copy link". Expect the local state to reflect `'approved'` (server wins), not `'sent'`. Verify in the UI that the status badge shows approved.
3. **Idempotent re-send.** Send, then click send again. `sent_at` should either remain stable or reflect the later server-committed value — but it must match the DB, not a client-only fabrication.

## Revert

```
git checkout HEAD -- src/pages/quote-builder-page.jsx
```

Or delete the `if (q.status || q.sent_at) { setDraft(...) }` block in
`confirmSend`.
