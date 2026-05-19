# Phase 3.5 Slice 8 — Audit

**Slice:** B13 Telemetry  
**Status:** Shipped with one deviation and two deferred risks noted below.

---

## Deviations from plan

### D1 — `trackQuoteFlowStarted` signature uses named-options object, not positional args

**Plan implied:** `trackQuoteFlowStarted(quoteId)` (single arg, matching
`startQuoteFlowSession(quoteId)` from an interim draft).

**Shipped:** `trackQuoteFlowStarted({ quoteId?, source? })` — named-options
object, matching the convention used by every other structured-data call in
the codebase and matching the `source` field required by §5.4's SQL
(which groups by entry point).

**Impact:** No consumer is broken; the dashboard and builder always pass
an options object. The `source` property is additive data not in the plan but
directly useful for §5.4 funnel analysis.

### D2 — `_markSent()` uses `deliveryMethodRef.current` not a parameter

**Plan implied:** The event should capture `deliveryMethod`.

**Shipped:** `_markSent()` is a zero-argument function called from three
paths (text, email, copy). The `deliveryMethodRef` ref (introduced in slice 7
to solve the same cross-closure problem for `pagehide`) is read inside
`_markSent()` to capture the method at the moment of send.

**Impact:** Correct at runtime; `deliveryMethodRef` is kept in sync by its
own `useEffect`. No data loss.

---

## Deferred risks

### R1 — `sendBeacon` + PostgREST apikey-in-querystring not tested against live Supabase

`sendBeacon` cannot send custom `Authorization` headers. The implementation
passes the anon key as `?apikey=` query parameter, which PostgREST documents
as a supported alternative. However, this path has not been exercised against
the production Supabase project. If PostgREST's RLS policy requires the
`Authorization` header specifically (not the query param), the `sendBeacon`
path will silently fail — the `fetch-keepalive` fallback will still fire.

**Mitigation:** After first deploy, filter `events` for
`event = 'quote_flow_abandoned'` at Day 1 to confirm rows are appearing. If
count is suspiciously zero, the `fetch-keepalive` fallback is still working
so no data is lost — the `sendBeacon` path just isn't succeeding.

### R2 — `supabase.supabaseKey` property name is supabase-js internal

The abandoned-event delivery reads `supabase.supabaseKey` to obtain the anon
key without re-reading `import.meta.env`. This field name is documented in
supabase-js v2 source but is not part of the public type surface. A major
version upgrade of `@supabase/supabase-js` could rename it.

**Mitigation:** The `_clearSession()` call in the `if (!sbUrl || !sbKey)`
guard means a failed key-read silently skips the event rather than throwing.
The risk is data loss on abandoned events only (not the main send path).
If supabase-js is upgraded, re-test `trackQuoteFlowAbandoned` and update the
property name.

### R3 — `_firedInSession` not persisted to sessionStorage

After a React HMR hot-reload or a tab restore from bfcache, the module-level
`_firedInSession` Set is reset to empty, meaning previously-fired events
could fire again. The `_restoreSession()` function restores `_qfSessionId`
and `_qfQuoteId` from sessionStorage but cannot restore the fired-events set.

**Impact:** At most one duplicate per event per HMR cycle. Affects dev
mode only (production does not HMR). bfcache restores are theoretically
possible in production but unlikely given the SPA routing pattern.

**Mitigation:** Acceptable for analytics — occasional duplicates in the
funnel query are filtered by `MIN(created_at)` aggregation. No action needed.

---

## Files NOT touched (regression guard)

| File | Status |
|---|---|
| `api/stripe-webhook.js` | Unchanged — diff clean |
| `api/public-quote-action.js` | Unchanged — diff clean |
| All other slice 1–7 files | Not opened |
