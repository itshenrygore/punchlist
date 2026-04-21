# v100 Milestone 4 — Workstream B (Dashboard revamp)

**Released:** April 14, 2026
**Shipped as:** `punchlist-v100-m4.zip`
**Predecessor:** `punchlist-v100-m3.zip`
**Spec:** `PHASE4-V100-PLAN.md` §4.1–4.4, §9.4
**Next:** M5 — Workstream C (Flow closures)

M3 completed the follow-up system end-to-end. M4 replaces the dashboard with a
leaner layout built around one principle: every card answers a question a contractor
asks out loud. It ships default-on (§9.4 decision) with a 30-day "Classic view"
escape hatch.

---

## (a) `supabase/migration_v100_dashboard.sql` — new

Two schema changes:

### `profiles.dashboard_version`
```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dashboard_version text NOT NULL DEFAULT 'v2'
    CHECK (dashboard_version IN ('v1','v2'));
```
- `'v2'` = new dashboard (default for all users per §9.4 — defaults win).
- `'v1'` = Classic view. Written when the contractor clicks the escape hatch.

### `public.dismissed_dashboard_items`
```sql
CREATE TABLE public.dismissed_dashboard_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_id     uuid NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, quote_id)
);
```
Replaces the previous `localStorage`-only dismiss state. Persists across
devices and sessions. RLS locks rows to the owning user. Items dismissed
7+ days ago are filtered client-side (a weekly cron can also purge them
from the table — example cron command in the migration file).

**How to run:**
```bash
psql $DATABASE_URL -f supabase/migration_v100_dashboard.sql

# Verify:
SELECT column_name, column_default
  FROM information_schema.columns
 WHERE table_name = 'profiles' AND column_name = 'dashboard_version';
-- Should return: dashboard_version | 'v2'
```

---

## (b) `supabase/function_dashboard_bundle.sql` — new

One RPC (`rpc_dashboard_bundle`) replaces 4–6 sequential API calls.
Returns a single JSON object:

```json
{
  "today_actions":       [...],   // urgency-sorted action items
  "pipeline_counts":     {...},   // count per status
  "week_scheduled":      [...],   // next 7 days of bookings
  "revenue_this_week":   0,
  "revenue_this_month":  0,
  "revenue_last_period": 0,
  "headline_metric":     {...},   // server-computed priority metric
  "insights":            [...],   // threshold-triggered observations
  "generated_at":        "..."
}
```

### today_actions sources (merged + urgency-sorted)
| Source | Condition | Priority |
|--------|-----------|----------|
| Overdue nudges | `last_followup_at` 5+ d ago or sent 2+ d ago | 0 (red) or 1 (amber) |
| Viewed 2+ times but not approved | `view_count >= 2` | 1 |
| Invoices 14+ days unpaid | `due_at < now - 14d` | 0 |
| Jobs today / tomorrow | `scheduled_for within 48h` | 2 |

### headline_metric priority function
```
followups due  >  pending deposits  >  scheduled today  >  close rate
```
Chosen server-side so the client never has to reimplement the logic.

### insights (threshold-triggered, may be empty)
- "Average follow-up takes N days — under 2 days doubles close rate"
  (fires when 30-day average > 2 days)
- "N quotes expired this week without a follow-up"
  (fires when count > 0)

### Performance indexes added (idempotent)
```sql
CREATE INDEX IF NOT EXISTS quotes_user_status_idx
  ON public.quotes (user_id, status) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS quotes_user_followup_idx
  ON public.quotes (user_id, last_followup_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS bookings_user_scheduled_idx
  ON public.bookings (user_id, scheduled_for) WHERE status NOT IN ('cancelled','completed');
CREATE INDEX IF NOT EXISTS invoices_user_status_due_idx
  ON public.invoices (user_id, status, due_at);
```
Target: p95 < 200ms against a 100-quote user. Run `EXPLAIN ANALYZE` with
the benchmark query at the top of the file if performance degrades.

**How to run:**
```bash
psql $DATABASE_URL -f supabase/function_dashboard_bundle.sql

# Verify:
SELECT proname FROM pg_proc WHERE proname = 'rpc_dashboard_bundle';
```

---

## (c) `src/pages/dashboard-page-v1.jsx` — preserved

The old `dashboard-page.jsx` is renamed verbatim to `dashboard-page-v1.jsx`.
Zero changes to its content — it is the instant rollback path.

If opt-out rate exceeds 20% in the first 24h post-release:
1. Edit `src/app/router.jsx` — swap the default `ver === 'v1'` condition.
2. Redeploy. No database change needed.

---

## (d) `src/pages/dashboard-page.jsx` — full rewrite

### Layout (5 rows)
```
Row 1  Greeting + headline metric + "New quote" button
Row 2  "Today" — urgency-sorted action list (primary attention)
Row 3  Pipeline bar (clickable segments → filtered quote list)
Row 4  This week schedule  |  Revenue this week / this month
Row 5  Insights (conditional — only renders when array is non-empty)
```

### Key design decisions
- **Every number** uses `.tabular` + `font-variant-numeric: tabular-nums` — no layout
  shift when values update.
- **Skeleton loaders** per card — no CLS. `--skel-h` CSS variable drives height.
- **Single RPC** with graceful fallback: if `rpc_dashboard_bundle` throws (migration
  not run yet), the component falls back to `Promise.all([listQuotes, listBookings,
  listInvoices, listCustomers])` and derives equivalent data client-side.
- **Lucide icons** throughout — no emoji used as icons in the default render path.
- **Dismiss state** writes to `dismissed_dashboard_items` table with localStorage
  fallback if the migration hasn't run.
- **No new npm dependencies** — `lucide-react` was already in `package.json`.

### Before (v1 data fetch)
```js
Promise.all([listQuotes, listBookings, listInvoices, listCustomers])
// 4 sequential-or-parallel calls, derived everything client-side
```

### After (v2 data fetch)
```js
Promise.all([fetchDashboardBundle(user.id), getProfile(user.id)])
// 1 RPC + 1 profile call; falls back to 4-call path if RPC unavailable
```

---

## (e) `src/styles/dashboard-v2.css` — new scoped file

All new classes are prefixed `dv2-` — no collision with v1 `v2-*` classes.

Key additions:
- `--dash-gap` token for uniform row spacing
- `.dv2-skeleton` + `@keyframes dv2-shimmer` — per-card loading placeholder
- `.dv2-action-item` — left-accent border (`--dv2-action-accent-w: 3px`) driven by urgency color
- `.dv2-pipeline-*` — clickable pipeline bar (same visual, now with lucide icons in legend)
- `.dv2-week-card` / `.dv2-revenue-card` — side-by-side on desktop (`grid-template-columns: 1fr 1fr`), stacked on mobile
- `.dv2-insight` — brand-tinted insight strip
- `.dv2-classic-link` — "Classic view" escape hatch in sidebar
- `prefers-reduced-motion` overrides on every keyframe

Imported in `src/main.jsx` after `index.css` — additive only.

---

## (f) `src/components/app-shell.jsx` — "Classic view" escape hatch

### New state
```js
const V100_RELEASE = new Date('2026-04-14T00:00:00Z');
const ESCAPE_HATCH_DAYS = 30;
const showClassicLink = (Date.now() - V100_RELEASE.getTime()) / 86400000 < ESCAPE_HATCH_DAYS;
const [dashVersion, setDashVersion] = useState(() => {
  try { return localStorage.getItem('pl_dash_version') || 'v2'; } catch { return 'v2'; }
});
```

### New handler
```js
async function handleClassicView() {
  const next = dashVersion === 'v2' ? 'v1' : 'v2';
  setDashVersion(next);
  localStorage.setItem('pl_dash_version', next);
  // Persist to profile.dashboard_version via Supabase
  supabase.from('profiles').update({ dashboard_version: next }).eq('id', user.id);
  if (next === 'v1') {
    track('dashboard_downgrade', { from: 'v2', to: 'v1' });
  }
  window.location.reload();
}
```

### Sidebar addition
A `← Classic view` / `→ New dashboard` link appears in the sidebar between the
flex spacer and the Sign out button. Clicking it fires `handleClassicView()`.

The link auto-hides after `ESCAPE_HATCH_DAYS` (30) days by checking wall-clock
against `V100_RELEASE`. Remove the block entirely in the M8 cleanup session.

---

## (g) `src/app/router.jsx` — feature flag wiring

```js
const DashboardPage = lazy(() => {
  let ver = 'v2';
  try { ver = localStorage.getItem('pl_dash_version') || 'v2'; } catch { /* no-op */ }
  return ver === 'v1'
    ? import('../pages/dashboard-page-v1')
    : import('../pages/dashboard-page');
});
```

Both bundles are lazy-loaded so the v1 code is never fetched unless the contractor
has explicitly switched. Router import path for `/app` is unchanged — no other files
required updating.

---

## What's unchanged (per hard constraints)

- `api/stripe-webhook.js` — untouched
- `api/public-quote-action.js` — untouched
- No new npm dependencies (lucide-react was already installed)
- All existing class names in v1 dashboard preserved (it ships as-is)
- All handler signatures in other components are unchanged

---

## Testing checklist

- [ ] Run migration on staging: `psql $DATABASE_URL -f supabase/migration_v100_dashboard.sql`
- [ ] Run RPC: `psql $DATABASE_URL -f supabase/function_dashboard_bundle.sql`
- [ ] Load dashboard — confirm v2 layout renders (5 rows visible)
- [ ] Confirm skeleton loaders appear while data loads (throttle network in DevTools)
- [ ] Action item with red urgency shows red left border; amber shows amber
- [ ] Click pipeline bar segment → navigates to `/app/quotes?filter=<status>`
- [ ] "This week" card shows correct jobs; "Revenue" card shows month + delta
- [ ] Dismiss an action item → item disappears; reload → still dismissed
- [ ] Click "← Classic view" in sidebar → v1 dashboard loads; click "→ New dashboard" → v2 returns
- [ ] Verify `telemetry.track('dashboard_downgrade')` fires on switch to v1 (check Supabase events table)
- [ ] Confirm `profiles.dashboard_version` column updated in DB after toggle
- [ ] Disconnect network → fallback path used → dashboard still renders (degraded)
- [ ] Run `EXPLAIN ANALYZE SELECT public.rpc_dashboard_bundle('<uuid>')` against staging with 100 quotes — confirm p95 < 200ms
- [ ] Dark theme: all cards render correctly
- [ ] Light theme: skeleton shimmer uses correct light palette
- [ ] 375px viewport (iPhone SE): Row 4 stacks vertically, `.dv2-action-value` hidden
- [ ] 1280px viewport: Row 4 side-by-side, max-width 860px constrains root
- [ ] Verify no regressions on Quotes, Settings, Quote Detail, Builder pages
