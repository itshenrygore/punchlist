# v100 UX Phase 10.1 — Audit Fixes Applied

This package was audited and three runtime-breaking bugs were fixed. Full changelog below.

## Bug 1: Settings page crash — `ReferenceError: Cannot access 'N' before initialization`

**File:** `src/pages/settings-page.jsx`

**Root cause:** Temporal Dead Zone (TDZ). The `useEffect` that lazy-loads message templates (originally lines ~272-288) referenced the state variable `settingsTab` in its body *and* in its dependency array, but `settingsTab` was declared further down the component at line ~502. In development, React's render cycle sometimes tolerated this, but in a minified production build the deps array is evaluated synchronously during the very first render — before the `useState` call for `settingsTab` — which threw `ReferenceError: Cannot access 'N' before initialization` (where `N` is the minified name for `settingsTab`).

**Fix:** Moved `const [settingsTab, setSettingsTab] = useState(...)` from line 502 up to line 176, so it is initialized before any effect that reads it. Removed the duplicate declaration at the original location.

## Bug 2: Quote edit (quote builder) crash — same TDZ pattern

**File:** `src/pages/quote-builder-page.jsx`

**Root cause:** `useScrollLock(!!smsConfirmPending)` was called at line 187, but the state `const [smsConfirmPending, setSmsConfirmPending] = useState(null)` was declared at line 191. In production builds this threw a TDZ error identical in nature to the settings bug, crashing any page that loads the quote builder — i.e. `/app/quotes/new` and `/app/quotes/:id/edit`.

**Fix:** Moved the `smsConfirmPending` state declaration above the `useScrollLock` call.

## Bug 3: Public quote view — JSX syntax error

**File:** `src/components/public-quote-view.jsx`

**Root cause:** Malformed JSX structure at the end of the `_inner` expression (around original lines 1152-1173). The `ActionSheet` and `SignatureModal` components were placed *outside* the `doc-shell` wrapper div as bare sibling expressions, which is not valid JSX, and two trailing `</div>` tags had been added to try to rebalance. The TypeScript parser reported:
- `error TS1005: ')' expected.`
- `error TS1128: Declaration or statement expected.`
- `error TS1109: Expression expected.`

This would have broken the production build entirely (Vite/Rollup would fail the bundle) or, if somehow transpiled, crashed on render of every customer-facing quote link.

**Fix:** Restructured the JSX so `ActionSheet` and `SignatureModal` live inside `doc-shell` as siblings of `doc-container` (their correct parent), and removed the extra stray `</div>` tags.

## Verification

After all three fixes, the following checks all pass:

- `tsc --noEmit` (with `--jsx preserve --allowJs`) over the entire `src/`, `shared/`, and `api/` trees: **0 errors**
- All 100% of relative imports resolve to real files on disk
- All named imports match real named exports (no missing symbols)
- No circular imports anywhere in `src/` (one harmless self-loop in `src/lib/sms.js` was pre-existing and benign)
- Custom TDZ scanner reports 0 real hits (2 false positives explicitly verified: a string literal `'loading'` in `payments-onboarding-page.jsx`, and a URL-param destructuring alias `{ quoteId: existingQuoteId }` in `quote-builder-page.jsx`)

## NOT in code — still action required on Supabase DB

Your production console also showed:

- `404` on `/rest/v1/rpc/rpc_dashboard_bundle`
- `400` on `/rest/v1/dismissed_dashboard_items`

The code for these is correct; the SQL objects are **missing from your Supabase project**. Apply these two migration files (already included in this package) via the Supabase SQL editor or CLI:

1. `supabase/migration_v100_dashboard.sql` — creates the `dismissed_dashboard_items` table with RLS
2. `supabase/function_dashboard_bundle.sql` — creates the `rpc_dashboard_bundle` RPC

Until these are applied, the dashboard will throw 404/400s on load. The dashboard will render most of its UI regardless (it uses defensive fallbacks), but the "just-for-you" pipeline bundle will not populate.

## Deploy steps

1. Drop this folder into an empty git repo and commit.
2. Set env vars on Vercel (project → Settings → Environment Variables):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL`, `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_VAPID_PUBLIC_KEY`
   - Plus server-side vars required by the `/api/*` functions (Stripe secret key, Resend key, Supabase service role, etc. — see individual api/*.js files).
3. Import into Vercel, framework preset "Vite" (already configured by `vercel.json`).
4. Apply the two SQL migration files above to your Supabase project.
5. `npm install && npm run build` locally first if you want a sanity check before pushing.
