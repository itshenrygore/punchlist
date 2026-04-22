# Phase 3.5 Slice 8 — B13 Telemetry

**Status:** Shipped.  
**Plan ref:** PHASE3-5-PLAN.md §B13 + §5.4  
**Files changed:**
- `src/lib/analytics.js` — B13 session management + six `quote_flow_*` helpers
- `src/pages/quote-builder-page.jsx` — wire events at all lifecycle points
- `src/pages/dashboard-page.jsx` — fire `quote_flow_started` on all "new quote" entry points

---

## Summary

Six new `quote_flow_*` events share a `session_id` UUID generated at flow
start. All events are fire-and-forget; the main flow is never blocked. Each
event (except `abandoned`) fires at most once per session via a `Set` dedup
guard. `abandoned` uses `sendBeacon` / `fetch-keepalive` for reliable
delivery during page unload.

---

## Changes — `src/lib/analytics.js`

### Before (relevant excerpt)

```js
// file ended after getActivationTimings()
// no quote_flow_* exports existed
```

### After — new exports added

```
trackQuoteFlowStarted({ quoteId?, source? })
setQuoteFlowQuoteId(quoteId)
trackQuoteFlowCustomerSelected(customerId)
trackQuoteFlowDescriptionCommitted(descriptionLength)
trackQuoteFlowScopeReady(itemCount)
trackQuoteFlowSent({ deliveryMethod, total })
trackQuoteFlowAbandoned()
endQuoteFlowSession()
hasActiveFlowSession()   ← session introspection helper
restoreFlowSession(quoteId)  ← sessionStorage restore helper
```

**Session lifecycle:**

| Call | Effect |
|---|---|
| `trackQuoteFlowStarted(…)` | Generates UUID, resets `_firedInSession`, optionally persists to `sessionStorage` keyed by quoteId |
| `setQuoteFlowQuoteId(id)` | Associates a newly-created DB id with the running session; persists |
| Any `trackQuoteFlow*` | `_trackQF()` guard: no-op if no session or event already fired |
| `trackQuoteFlowSent(…)` | Fires event + calls `_clearSession()` (clears module vars + sessionStorage) |
| `trackQuoteFlowAbandoned()` | Fires via `sendBeacon`→`fetch-keepalive`; no-op if already sent |
| `endQuoteFlowSession()` | Alias for `trackQuoteFlowAbandoned()` — used on React unmount |

**Abandoned-event delivery:**
`sendBeacon` is attempted first. Because PostgREST requires the `apikey`
header and `sendBeacon` cannot set custom headers, the key is passed as a
`?apikey=` query-string parameter (supported by supabase-js's PostgREST).
`fetch` with `keepalive: true` is the fallback. The Supabase URL and key are
read from the already-imported `supabase` client object (`.supabaseUrl` /
`.supabaseKey`) to avoid a circular import with `./env`.

---

## Changes — `src/pages/quote-builder-page.jsx`

### Import line (before → after)

**Before:**
```js
import { identify, ..., getVariant } from '../lib/analytics';
```

**After:**
```js
import { identify, ..., getVariant,
  trackQuoteFlowStarted, setQuoteFlowQuoteId,
  trackQuoteFlowCustomerSelected, trackQuoteFlowDescriptionCommitted,
  trackQuoteFlowScopeReady, trackQuoteFlowSent,
  trackQuoteFlowAbandoned, endQuoteFlowSession,
  hasActiveFlowSession, restoreFlowSession,
} from '../lib/analytics';
```

### Fallback session bootstrap (mount effect, new-quote path)

```js
// Before: nothing
// After (inside load useEffect):
if (!existingQuoteId) {
  if (!hasActiveFlowSession()) {
    trackQuoteFlowStarted({ source: 'builder_direct' });
  }
} else {
  const restored = restoreFlowSession(existingQuoteId);
  if (!restored) {
    trackQuoteFlowStarted({ quoteId: existingQuoteId, source: 'builder_direct' });
  }
}
```

### `handleBuildScope` — `setQuoteFlowQuoteId` (already present in shipped code)

```js
// After createQuote() resolves:
setQuoteFlowQuoteId(draftId); // B13: associate the new DB id with the session
```

### `handleBuildScope` — `trackQuoteFlowScopeReady` (already present in shipped code)

```js
trackQuoteFlowScopeReady(newLineItems.length); // B13
```

### Description textarea — `quote_flow_description_committed`

**Before:**
```jsx
<textarea … onChange={e => setDescription(e.target.value)} … />
```

**After:**
```jsx
<textarea
  …
  onChange={e => setDescription(e.target.value)}
  onBlur={() => {
    if (description.trim() && !descCommittedRef.current) {
      descCommittedRef.current = true;
      trackQuoteFlowDescriptionCommitted(description.trim().length);
    }
  }}
  …
/>
```

`descCommittedRef` (a `useRef(false)`) is the React-side dedup guard;
`_trackQF` inside analytics provides the second layer.

### `handleQuickCreateCustomer` — `quote_flow_customer_selected`

**Before:**
```js
ud('customer_id', existing.id);
setShowNewCust(false);
```

**After:**
```js
ud('customer_id', existing.id);
trackQuoteFlowCustomerSelected(existing.id); // B13
setShowNewCust(false);
```

Same pattern applied to the new-customer creation branch:
```js
ud('customer_id', c.id);
trackQuoteFlowCustomerSelected(c.id); // B13
```

### Customer pill click (review phase) — `quote_flow_customer_selected`

**Before:**
```jsx
onClick={() => { ud('customer_id', c.id); setCustomerSearch(''); }}
```

**After:**
```jsx
onClick={() => { ud('customer_id', c.id); trackQuoteFlowCustomerSelected(c.id); setCustomerSearch(''); }}
```

### `_markSent()` — `quote_flow_sent`

**Before:**
```js
function _markSent() {
  setSentSuccess(true); setPhase('sent');
  …
  const newCount = sentThisMonth + 1; setSentThisMonth(newCount);
}
```

**After:**
```js
function _markSent() {
  setSentSuccess(true); setPhase('sent');
  …
  const newCount = sentThisMonth + 1; setSentThisMonth(newCount);
  // B13
  sentRef.current = true;
  trackQuoteFlowSent({ deliveryMethod: deliveryMethodRef.current, total: grandTotal });
}
```

`sentRef.current = true` ensures the `pagehide` handler's `!sentRef.current`
guard agrees with the analytics module's internal `_firedInSession` state.
`deliveryMethodRef` (already kept in sync via a `useEffect` in slice 7) lets
the event capture the correct method inside the sync `_markSent` call.

### Abandoned `pagehide` listener (already present in shipped code)

```js
useEffect(() => {
  function onPageHide() {
    if (!sentRef.current) { trackQuoteFlowAbandoned(); }
  }
  window.addEventListener('pagehide', onPageHide);
  return () => {
    window.removeEventListener('pagehide', onPageHide);
    if (!sentRef.current) { endQuoteFlowSession(); }
  };
}, []);
```

---

## Changes — `src/pages/dashboard-page.jsx`

### Import

**Before:** `import { identify, getVariant } from '../lib/analytics';`  
**After:** `import { identify, getVariant, trackQuoteFlowStarted } from '../lib/analytics';`

### `handleJobInputSubmit` (job description quick-entry)

**Before:**
```js
function handleJobInputSubmit(e) {
  e.preventDefault();
  const val = jobInput.trim();
  navigate('/app/quotes/new', val ? { state: { prefill: val } } : undefined);
}
```

**After:**
```js
function handleJobInputSubmit(e) {
  e.preventDefault();
  const val = jobInput.trim();
  trackQuoteFlowStarted({ source: 'dashboard_job_input' }); // B13
  navigate('/app/quotes/new', val ? { state: { prefill: val } } : undefined);
}
```

### "New quote" header link

**Before:** `<Link to="/app/quotes/new" className="btn btn-primary">New quote</Link>`  
**After:** `<Link … onClick={() => trackQuoteFlowStarted({ source: 'dashboard_header' })}>New quote</Link>`

### "Build your next quote →" caught-up link

**Before:** `<Link to="/app/quotes/new" className="v2-caught-up-link">Build your next quote →</Link>`  
**After:** `<Link … onClick={() => trackQuoteFlowStarted({ source: 'dashboard_caught_up' })}>Build your next quote →</Link>`

---

## Event schema

All six events insert into the existing `events` table with the standard
`{ event, user_id, properties, created_at }` shape. `properties` for flow
events always includes `session_id` and `quote_id`.

| event | extra properties |
|---|---|
| `quote_flow_started` | `source` |
| `quote_flow_customer_selected` | `customer_id` |
| `quote_flow_description_committed` | `description_length` |
| `quote_flow_scope_ready` | `item_count` |
| `quote_flow_sent` | `delivery_method`, `total` |
| `quote_flow_abandoned` | _(none beyond session/quote ids)_ |

---

## Testing guidance

### 1. Happy path — all six events fire in sequence

1. Open the app, navigate to the dashboard.
2. Click **"New quote"** (header button). Open DevTools → Network → filter `events`.
3. Verify `quote_flow_started` INSERT with `source: "dashboard_header"`.
4. In the builder, type a description and **blur** the textarea.
5. Verify `quote_flow_description_committed` fires once (check `description_length`).
6. Click **"Build Quote →"**; wait for AI scope.
7. Verify `quote_flow_scope_ready` fires with `item_count` matching the list.
8. Add a customer via the picker.
9. Verify `quote_flow_customer_selected` fires once.
10. Send the quote (any method).
11. Verify `quote_flow_sent` fires with correct `delivery_method` and `total`.
12. Verify **no** `quote_flow_abandoned` fires.
13. All six events share the same `session_id`.

### 2. Abandoned — pagehide fires if quote never sent

1. Start a new quote, describe job, blur textarea.
2. Close the tab / navigate away before sending.
3. In Supabase dashboard → Table `events`, filter `event = 'quote_flow_abandoned'`.
4. Confirm the row exists with the correct `session_id`.
5. Confirm no `quote_flow_sent` row exists for that session.

### 3. Dedup — description committed only once

1. Start a new quote. Fill in description and blur → event fires.
2. Edit description again; blur again.
3. Confirm second `quote_flow_description_committed` does **not** appear.

### 4. Dedup — customer selected only once

1. Pick customer A → `quote_flow_customer_selected` fires.
2. Click **Change**, pick customer B.
3. Confirm second event does **not** appear (first pick wins for funnel analysis).

### 5. Direct-link / deep-link fallback

1. Navigate directly to `/app/quotes/new` (no dashboard click).
2. Verify `quote_flow_started` fires with `source: "builder_direct"`.

### 6. Session isolation across tabs

1. Open tab 1 → start a quote → note `session_id` A.
2. Open tab 2 → start a different quote → note `session_id` B.
3. Confirm A ≠ B and events in each tab carry their own id.

### 7. No regression — existing `trackQuoteSent` / `trackFirstSend` still fire

After sending, verify both the new `quote_flow_sent` AND the existing
`quote_sent` rows appear in the `events` table (they are independent).

---

## Post-ship SQL (§5.4 targets — run at Day 7 and Day 14)

```sql
-- Funnel conversion rates and timing
WITH sessions AS (
  SELECT
    properties->>'session_id' AS session_id,
    MIN(created_at) FILTER (WHERE event = 'quote_flow_started')             AS started_at,
    MIN(created_at) FILTER (WHERE event = 'quote_flow_description_committed') AS described_at,
    MIN(created_at) FILTER (WHERE event = 'quote_flow_scope_ready')          AS scope_at,
    MIN(created_at) FILTER (WHERE event = 'quote_flow_customer_selected')    AS customer_at,
    MIN(created_at) FILTER (WHERE event = 'quote_flow_sent')                 AS sent_at,
    BOOL_OR(event = 'quote_flow_abandoned')                                  AS abandoned
  FROM events
  WHERE event LIKE 'quote_flow_%'
    AND created_at >= NOW() - INTERVAL '7 days'
  GROUP BY 1
)
SELECT
  COUNT(*)                                       AS total_sessions,
  ROUND(100.0 * COUNT(*) FILTER (WHERE sent_at IS NOT NULL) / COUNT(*), 1) AS completion_rate_pct,
  PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (sent_at - started_at))
  )                                              AS p50_seconds,
  PERCENTILE_CONT(0.9) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (sent_at - started_at))
  )                                              AS p90_seconds
FROM sessions
WHERE started_at IS NOT NULL;
```

**Pass criteria (§5.4):** `p50_seconds ≤ 90`, `p90_seconds ≤ 150`,
`completion_rate_pct ≥ 85`.

---

## Revert instructions

```bash
# Revert all three files atomically:
git checkout HEAD -- src/lib/analytics.js \
                     src/pages/quote-builder-page.jsx \
                     src/pages/dashboard-page.jsx
```

Or surgically:

- **`analytics.js`**: Delete everything from the `// ── B13` comment block
  down through `endQuoteFlowSession()`. Remove the ten new exports from any
  import statements in other files.
- **`quote-builder-page.jsx`**: Remove the `onBlur` prop from the description
  textarea; remove `trackQuoteFlowCustomerSelected(…)` from the two customer
  set-sites and the pill click; remove `sentRef.current = true` and
  `trackQuoteFlowSent(…)` from `_markSent()`; remove the B13 bootstrap block
  from the load `useEffect`; trim the import line.
- **`dashboard-page.jsx`**: Remove `trackQuoteFlowStarted` from the import;
  remove the three `trackQuoteFlowStarted(…)` call-sites; remove the
  `onClick` props from the two `<Link>` elements.
