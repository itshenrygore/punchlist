# v100 Milestone 7 — QA (Device matrix + visual regression)

**Released:** April 14, 2026
**Shipped as:** `punchlist-v100-m7.zip`
**Predecessor:** `punchlist-v100-m6.5.zip`
**Spec:** M7 prompt (QA harness)
**Next:** M8 — release cut

M7 is a **QA infrastructure milestone**, not a feature milestone. No
product surface changed. What shipped: the test harness the human
operator needs to run device-matrix visual regression, performance
benchmarks, and accessibility sweeps against v100 before M8.

The operational split for M7 is honest and important: Claude generated
the specs and executed everything that can be executed without a real
browser (the smoke suite, static analysis, the scroll-trap cleanup).
The Playwright runs happen on the operator's machine — that's what
M7's own prompt said the milestone would be.

---

## Files touched

| File | Action |
|---|---|
| `playwright.config.ts` | **New** — 5-viewport matrix |
| `tests/v100-visual.spec.ts` | **New** — 140-snapshot sweep |
| `tests/v100-perf.spec.ts` | **New** — dashboard_bundle p95 benchmark |
| `tests/v100-a11y.spec.ts` | **New** — axe WCAG 2.1 AA sweep |
| `tests/helpers/routes.ts` | **New** — route manifest (28 routes) |
| `tests/helpers/context.ts` | **New** — theme/auth seeding, motion disable |
| `deploy-scripts/smoke-test.sh` | Refactored — added §13, §14, §15; v100-M7 banner |
| `src/styles/index.css` | Scroll-trap cleanup at line 681 |
| `package.json` | `axe-core` devDep + 5 new `test:*` scripts |
| `V100-QA-REPORT.md` | **New** — full QA findings report |

**No changes to** any product page, any component (M6.5 extractions
intact), any API handler, any Supabase migration, or the dashboard
CSS.

---

## (a) Device matrix — Playwright visual spec

**File:** `tests/v100-visual.spec.ts` + `playwright.config.ts`

Sweep: **14 routes × 5 viewports × 2 themes = 140 snapshots** in the
default run.

The M7 prompt targeted 240 (24 routes × 5 × 2). The delta is 10
routes that require fixtures not present in a clean deploy:

- 5 public share-token routes (`/public/:token`, `/project/:token`,
  `/public/aw/:token`, `/public/amendment/:token`,
  `/public/invoice/:token`) — need a live token in Supabase.
- 5 parameterized `/app/quotes/:id` / `:id/edit` / `/job-details` /
  `/build-scope/:id` / `/review/:id` and `/app/invoices/:id`,
  `/app/additional-work/:id` variants — need a seeded row.

These are documented in `tests/helpers/routes.ts` with `skipReason`
so the matrix stays on paper. When the operator seeds fixtures, they
unset the `skipReason` and the sweep expands to 240.

Viewports (`playwright.config.ts`):

| Project              | Device           | Viewport    |
|----------------------|------------------|-------------|
| `mobile-iphone`      | iPhone SE        | 375 × 667   |
| `mobile-iphone-14`   | iPhone 14 Pro    | 393 × 852   |
| `tablet-ipad`        | iPad gen 7       | 768 × 1024  |
| `desktop-chrome`     | Desktop Chrome   | 1280 × 800  |
| `desktop-large`      | Desktop HiDPI    | 2560 × 1440 |

Existing scripts (`test:e2e:desktop`, `test:e2e:mobile`) still resolve
to `desktop-chrome` and `mobile-iphone` — project names are unchanged.

### Snapshot hygiene

Three stability guards per-snapshot:

1. **Motion disabled per-test** via `disableMotion()` — zeroes CSS
   animations and transitions, including M6.5's `.dv2-enter` stagger
   which is keyed off a CSS custom property (`--i`) and isn't caught
   by Playwright's default animation pauser.
2. **Fonts ready** — await `document.fonts.ready` before capture.
   Text antialiasing shifts 1–2 pixels between runs without this.
3. **Per-route masks** for live data: timestamps, recharts SVGs,
   headline revenue values. Any unmasked pixel is under test.

Pixel tolerance: `maxDiffPixelRatio: 0.002` (0.2%).

Snapshots land at
`tests/__screenshots__/v100/{testFilePath}/{arg}-{projectName}.png`.
Estimated first-run baseline: ~45 MB committed. The operator picks
between committing baselines to the repo or a separate
`-visual-baselines` repo — M7 ships specs, not storage policy.

## (b) Performance benchmark

**File:** `tests/v100-perf.spec.ts`
**Target:** `dashboard_bundle` RPC p95 < 200ms (§4.3 / §10)

Methodology:
- Warm connection pool with a `/login` navigation.
- Navigate `settings → dashboard` 15 times; listen for
  `POST /rest/v1/rpc/dashboard_bundle`, record
  `request.timing().responseEnd`.
- Discard first 5 samples as warm-up; p50/p95/max from the remaining 10.
- Attach raw samples for postmortem. Fail if p95 ≥ 200ms.

Runs `desktop-chrome` only — device-emulation overhead skews the
measurement by 5–15ms and isn't representative of real API latency.

## (c) Smoke test updates

**File:** `deploy-scripts/smoke-test.sh`
**Version banner:** `v61` → `v100-M7`

Three new sections:

**§13 — v100 endpoint shape** greps the handler contracts for
`/api/send-followup`, `/api/mark-messages-read`, and the
`dashboard_bundle` RPC. Catches drift between UI call sites and
handler signatures. All 5 checks pass.

**§14 — v100 test harness** verifies every Playwright spec, config,
and helper is present. Prevents accidental deletion before a deploy.
Both checks pass.

**§15 — scroll-trap cleanup guard** greps for the properties removed
in §d below. If they come back, the smoke test fails with a pointer
back to `V100-QA-REPORT.md §4`. Both checks pass.

**Full run results (packaged repo, no node_modules):**
`13 PASS  6 FAIL  9 WARN  (28 checks)`.

Every FAIL and WARN pre-exists in the M6.5 baseline. Checked against
the unmodified M6.5 zip. Itemized in `V100-QA-REPORT.md §3.3`.

No M7-introduced failures.

## (d) Scroll-trap investigation — cleanup applied

**File:** `src/styles/index.css` line 681

The M7 prompt asked to profile `.app-main` with
`-webkit-overflow-scrolling: touch` and `overscroll-behavior-y: contain`.

**Finding:** Both are vestigial, neither caused the audit-reported
trap. `-webkit-overflow-scrolling: touch` only has effect on elements
that themselves have `overflow: auto/scroll`; `.app-main` doesn't —
body is the scrolling element. `overscroll-behavior-y: contain` is
already on body (line 675); duplicating it on a non-scrolling
descendant has caused touch-gesture propagation bugs in older Safari.

**Action:** removed both from `.app-main`; kept
`scroll-behavior: smooth` and the entrance animation. Inline comment
documents why. Full root-cause writeup in `V100-QA-REPORT.md §4`.

**Regression guard:** smoke §15 will fail if either property returns.

## (e) Accessibility pass — spec delivered

**File:** `tests/v100-a11y.spec.ts`
**Tool:** axe-core (added as devDependency)

Ruleset: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`. Runs `desktop-chrome`
only — a11y violations are almost never viewport-dependent and the
visual sweep already covers the device matrix.

**Allowlist policy:** three rule IDs are allowlisted with a
node-count cap. Growth past the cap fails the test; known-offender
violations don't block M7.

| Rule ID | Cap | Reason |
|---|:---:|---|
| `color-contrast` | 10 | Light-theme muted text is AA-borderline. M6.5 lifted 3 sites to `--text-2` AAA. Remainder is v101 design-token pass. |
| `landmark-one-main` | 5 | App shell uses `<div class="app-main">` not `<main>`. Lift in v101. |
| `region` | 5 | Same root cause as `landmark-one-main`. |

This shape is deliberately conservative: M7 locks in non-regression,
v101 grinds the allowlist to zero.

---

## What was executed in this session

- Smoke suite: full run, all M7-added checks pass.
- Static analysis: JSX balance, import integrity, API export matching,
  duplicate exports, storage hygiene, pricing integrity, dialog usage,
  endpoint contract shape.
- Scroll-trap root-cause trace through the M6.5 CSS.

## What was NOT executed (requires a real browser)

- The 140-snapshot Playwright visual run. Specs written, baselines
  not. First run produces baselines.
- The `dashboard_bundle` p95 benchmark. Requires seeded Pro account
  with ~100 quotes.
- The axe sweep. Requires `node_modules` with `axe-core` installed.

This is the same shape M6.5 shipped with and matches the M7 prompt's
own framing: *"Claude cannot do this alone — the prompt generates
the test plan and Playwright specs; the human runs them."*

---

## Deferred to v101 (surfaced during M7)

1. Vercel function count (19 of 12 Hobby max). Consolidate or upgrade plan.
2. `public/landing.html` missing since v99. Either restore or remove from critical-file list.
3. `upgrade-prompt.jsx` hardcoded `$29/$249` — import from `billing.js` PRICING.
4. Full a11y zero-violation pass — M7 catches regressions, v101 grinds to zero.
5. JSX balance false-positives at ±1 in the smoke test — improve the counter to recognize ternary fragments.

(Items 4–5 of M6.5's own deferred list also remain on the v101 docket.)

---

## Upgrade path (from M6.5 to M7)

Pure additive. No database changes, no env vars, no migrations, no
product code touched. Deploy the new bundle — dashboard and every
other page behaves identically.

Rollback: delete `tests/`, `playwright.config.ts`; revert
`deploy-scripts/smoke-test.sh`, `src/styles/index.css`, `package.json`.
Nothing depends on the new files in production.

## Upgrade path for the operator's CI

```bash
npm install
npx playwright install --with-deps chromium webkit

# First-time baseline capture (public routes only)
npm run test:visual

# Expand to authenticated routes
export PL_TEST_ACCESS_TOKEN=...     # see V100-QA-REPORT.md §7.3
export PL_TEST_REFRESH_TOKEN=...
export PL_TEST_USER_ID=...
export PL_SUPABASE_PROJECT_REF=...
npm run test:visual

# Perf & a11y (both require auth env vars above)
npm run test:perf
npm run test:a11y
```

---

## Validation

- [x] Smoke suite §1–§15 run end-to-end; all 10 new M7 checks pass.
- [x] Every M7 FAIL traced to the M6.5 baseline — none are new.
- [x] `.app-main` scroll cleanup applied; regression guard active.
- [x] Route manifest covers all 28 routes in `src/app/router.jsx`.
- [x] Viewports match §10 exactly (375 / 393 / 768 / 1280 / 2560).
- [x] Default sweep is opt-out on fixture-dependent routes with
      documented reasons, not silently skipped.
- [x] Both themes covered.
- [x] Brace/paren balance verified on the scroll-trap CSS edit.
- [x] No new product code; M6.5 dashboard extractions untouched.
- [x] No new npm runtime dependencies (axe-core is devDep only).
- [ ] Playwright snapshot baselines not captured — first run writes them.
- [ ] `dashboard_bundle` p95 not measured — requires seeded account.
- [ ] axe sweep not run — requires `node_modules`.

Full report: `V100-QA-REPORT.md` at repo root.
