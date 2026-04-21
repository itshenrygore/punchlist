# Phase 3.5 Slice 5 — Audit

## Flagged: email delivery method is not in the builder UI

`api/send-quote-email.js` has a main branch (non-demo, non-receipt,
non-reminder, non-booking) that implements H4: after `resend.emails.send`
returns 200, it performs the atomic status update and returns
`{success, status, sent_at}`.

Slice 5 was scoped to wire the client to consume those fields.
`src/lib/api/quotes.js` `sendQuoteEmail(quoteId, to)` already returns the
whole JSON, no changes needed there.

**The gap:** the builder's send modal only offers two delivery methods:

```jsx
<div className="rq-send-methods">
  {[
    { v: 'text', l: 'Text message', icon: '💬' },
    { v: 'copy', l: 'Copy link', icon: '🔗' }
  ].map(o => (…))}
</div>
```

No `email` option. Neither the `text` nor the `copy` path calls
`sendQuoteEmail`. The main-branch H4 code on the server is reachable from
`src/lib/api/amendments.js`, `src/lib/api/bookings.js`,
`src/lib/api/integrations.js`, and `src/lib/api/invoices.js` — but **not**
from the quote builder's send flow.

**What this slice did ship:** the generic reconciliation pattern. After
`save('sent')` returns the DB row, `confirmSend` now merges
`q.status` and `q.sent_at` into local draft state. This works for the
`text` and `copy` delivery paths because `updateQuote` itself returns the
authoritative row.

**What this slice did not ship:** an end-to-end exercise of the
server's H4 main branch from the builder. That requires the email
delivery method UI to exist.

## Recommendation

The email delivery method UI lands in one of:
- **Slice 7** — Send-path rewrite. Reasonable fit, since slice 7 is
  already rewriting this code path and could add the third method
  alongside the optimistic + undo UX.
- **Slice 11** — B4 customer picker UI. Unlikely fit; scope is different.

When the email option is added, the corresponding client code should
look like:

```js
if (deliveryMethod === 'email') {
  const response = await sendQuoteEmail(q.id, selCustomer.email);
  if (response.status || response.sent_at) {
    setDraft(d => ({
      ...d,
      status: response.status ?? d.status,
      sent_at: response.sent_at ?? d.sent_at,
    }));
  }
}
```

And a gate check analogous to the current `if (deliveryMethod === 'text' && … !cust?.phone)` — require `cust?.email` for the email option.

## Deferred risks

- Until the email path is exercised end-to-end, a regression in the
  server's H4 branch (introduced by slice 2) would go undetected from the
  primary UI. Manual verification via direct POST to `/api/send-quote-email`
  with `{quoteId, to}` is possible but not part of any existing test.
- The `/api/send-quote-email` main-branch code path is still technically
  orphaned from the builder; if a later refactor removed it assuming it
  was dead, H4 would vanish silently.
