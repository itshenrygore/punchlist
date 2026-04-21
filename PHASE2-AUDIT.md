# Phase 3 — Audit Findings

Things noticed while refactoring the Dashboard and Quotes List pages
that were **intentionally not fixed** in Phase 3 because they fall
outside the sprint's explicit scope, or because fixing them would
conflict with the "don't break things" non-negotiable. Each item is
queued for a specific later phase.

---

## HIGH — Phase 0 + Phase 1 + Phase 2 deferrals still open

Carried forward without change:

- Duplicate `[data-theme="light"]` block in `src/styles/index.css`.
  Second block still wins cascade.
- `index.css` remains a 6,300-line monolith (now with three `@import`
  lines at the top: tokens, phase1-builder, phase2-public-quote,
  phase3-dashboard — exactly as the sprint plan calls for).
- `--fs-*` and `--shadow-*` legacy tokens still alongside `--text-*`
  and `--elev-*`.
- `font-family: inherit` noise across ~30 rules.
- Duplicate-light-block dedupe explicitly deferred to Phase 6 per the
  sprint prompt.
- Phase 1 audit note: `key={i}` on `confidence.checks` list in the
  Quote Builder — unchanged.
- Phase 1 audit note: drag-to-reorder opacity set via inline style in
  Quote Builder — unchanged.
- Phase 2 audit items: signature-modal exit snap; amendment / photos
  field-shape verification; `<Stat>` currency-count-up limitation;
  `signRef` scrollIntoView leftover; success banner font-display;
  unused `.pl-status-stack` utility — all unchanged.

**Why deferred:** the Phase 3 scope prompt explicitly states "Don't
dedupe the duplicate `[data-theme="light"]` block (Phase 6)" and
"Don't touch the signature modal or any Phase 2 work". Touching
`index.css` beyond the single import line, or any Phase 2 file, is a
scope violation.

**Action:** unchanged. Still queued for Phase 6.

---

## MEDIUM — `PageSkeleton` and `EmptyState` imports in `quotes-list-page.jsx` are now unused

After the Phase 3 swap — `PageSkeleton` → `.pl-skel-list`,
`EmptyState` → `<Card className="pl-empty-card">` — the two imports
at the top of `quotes-list-page.jsx` are no longer referenced:

```js
import EmptyState from '../components/empty-state';
import PageSkeleton from '../components/page-skeleton';
```

**Reasoning:** conservative call — kept to minimise the diff surface.
Removing them is a trivial one-line-each edit, but doing so inside
Phase 3 would add two more lines to the `diff -rq` output without
any functional change, and would make a future reverter's job harder
if any rollback is needed.

**Impact:** under a stricter lint config (`no-unused-vars` promoted
to error, or `eslint-plugin-import/no-unused-modules`), these would
warn. Under the current project lint config they do not.

**Deferred to:** Phase 6 consistency sweep — remove both imports.
The components themselves (`EmptyState`, `PageSkeleton`) are still
consumed by other pages (invoices-list, bookings, contacts, etc.)
so only the import lines in `quotes-list-page.jsx` need removing,
not the component files.

---

## MEDIUM — Dashboard `<Stat>` cells for currency values don't count up

`<Stat value={currency(closedRevenue)} />` and `<Stat value={currency(pipeline)} />`
pass pre-formatted strings. `<Stat>`'s count-up hook (`useCountUp`)
only fires when `typeof value === 'number'`, so these two cells snap
to their final string rather than animating. The other two
(`Close rate`, `Open quotes`) pass numeric values and do count up.

**Reasoning:** this mirrors the Phase 2 hero-total audit item. The
primitive contract is: number in → animated count; string in → static
render. Passing `currency(n)` in produces a string because the
formatted value includes commas, a currency symbol, and optionally a
country prefix (`CA$` / `US$`) — none of which are mid-animation-safe
to interpolate numerically. The alternative — passing the raw number
with `prefix="$"` — drops the locale-aware formatting (thousand
separators, country prefix) that `currency()` produces, which the
rest of the page uses consistently.

**Impact:** stylistic. The revenue and pipeline numbers are visible
and correct on first paint — they just don't have the satisfying
tick-up animation that the numeric cells do.

**Deferred to:** Phase 6 or whenever `<Stat>` grows a `formatter`
prop. Fix: add `formatter: (n) => currency(n, country)` to `<Stat>`
and let it count up through the formatter. About 10 minutes in
`Stat.jsx` and a one-line change at each call site.

---

## MEDIUM — `.v2-empty` wrapped in `<Card>` — inline vs class rule interaction

The Phase 3 edit wraps the existing `.v2-empty` content in
`<Card padding="loose" minH="260px" className="v2-empty">`. `<Card>`
applies `min-height`, `contain: layout paint`, and `padding` via
**inline style**. The existing `.v2-empty` rule in `index.css`
applies `display: grid; place-items: center` (among other things)
via class selector.

**Reasoning:** CSS cascade rules — inline style wins only for
properties both rules set. For properties the inline style doesn't
mention (`display`, `place-items`, any `background` / `color` /
`border-radius` the `.v2-empty` class applies) the class rule wins.
So the grid layout should survive, and the Card's container
guarantees (stable min-height, layout containment) are layered on
top.

**Impact:** in theory, the visual should be identical to pre-Phase-3
with the added stability guarantees. In practice, if the existing
`.v2-empty` class also sets its own `padding` (overriding the
`<Card padding="loose">`) or its own `min-height` (overriding the
`minH={260}`), the Card props are overridden. Needs visual
verification.

**Action required before merge:** compare screenshot of
`quotes.length === 0` dashboard state pre- and post-Phase 3 on
desktop and mobile. Takes 30 seconds.

**Deferred to:** live-build QA. No structural risk — worst case the
visual is unchanged from Phase 2 (the Card wrapper becomes a no-op)
and the stability guarantees don't materialize. The page doesn't
break.

---

## LOW — One pre-existing `key={i}` in `FeedItem` action-buttons map

`dashboard-page.jsx` line 61 (unchanged from Phase 2):

```jsx
{actions.map((act, i) => (
  <button key={i} className={…}>{act.label}</button>
))}
```

**Reasoning:** pre-existing — not touched by Phase 3. The sprint's
rule is "no *new* `key={i}` introduced". The grep-for-new-bare-index
check in Phase 3's verification returned 0 new, confirming Phase 3
didn't introduce any. The existing one inside `FeedItem` is the
action-buttons row, where the array is:
- stable in length per render (each feed item has a fixed actions
  array derived from the quote's current status), and
- the elements have no reorderable identity beyond their position,
  since they're action buttons keyed by their label / onClick pair.

So the practical impact of `key={i}` here is zero — React's
reconciliation never sees a reordered key here.

**Impact:** none in practice. Flags on strict lints that promote
`react/no-array-index-key` to error.

**Deferred to:** Phase 6 consistency sweep — replace with
`key={act.label}` or `key={act.hint || act.label}`.

---

## LOW — `.pl-ql-container` and `.pl-err-card` utilities defined but not used

The new phase3 CSS defines:

- `.pl-ql-container` — a `min-height: 240px; contain: layout paint`
  wrapper for the full list area
- `.pl-err-card` — an error-state Card-frame layout mirroring
  `.pl-empty-card` but with a red title color

Neither is currently tagged on any JSX element. They're defined
because:

- `.pl-ql-container` would wrap the `loading`/`empty`/`filtered-empty`/
  `populated` content branch to prevent vertical-height jump between
  states. Not added in Phase 3 because the `<Card>`-framed empty
  states and the `.pl-skel-list` already reserve comparable heights,
  and adding a wrapper would be a fourth outer `<div>` around an
  already-deeply-nested ternary.
- `.pl-err-card` would frame the "quotes failed to load" state, but
  the current `fetchQuotes` catch block is a silent `() => {}` — no
  error state is rendered. Adding the error state is out of Phase 3
  scope (no error handling was touched).

**Impact:** zero. Two unused class rules in the new CSS file, queued
for a future phase.

**Deferred to:** use or remove in Phase 4 (when the Quote Detail /
Invoice Detail pages introduce richer error handling) or Phase 6.

---

## LOW — `.pl-dash-header` marker class has no active rules

Added to the dashboard's `<PageHeader>` wrapper for future CSS hooks
(e.g. a small-screen kicker-wrap tweak if needed). Currently empty in
the stylesheet — a reserved marker.

**Impact:** zero. One unused class selector in the new CSS file.

**Deferred to:** either add rules in Phase 4/6 as needed, or remove
the marker.

---

## LOW — Summary line no longer renders when unfiltered

Pre-Phase-3, `.ql-cards` below the search row showed `{quotes.length}
quotes · {approved} of {sent} approved ({rate}%)` unconditionally.
Phase 3 moves the unfiltered summary into the `<PageHeader>` subtitle
and keeps the below-search summary only for the filtered-state
"Showing X of Y" + Clear filters button.

**Impact:** the rate%/approved count moved from below the search to
above (into the page header subtitle). This is the intended design —
the page header is now the authoritative place for "state of the
list". But it's a visible change worth calling out during visual QA.

**Deferred to:** nothing — this is by design. Noted here only so the
reviewer isn't surprised.

---

## NOTE — Static verification only; live build / test / device matrix not runnable

Phase 3 was executed in an offline sandbox (no network, no project
`node_modules`). `npm install`, `npm run build`, `npm run test:e2e`,
Lighthouse CLS, and the device-matrix live pass did not run. Every
static check available was performed:

- `esbuild --loader:.jsx=jsx` on `dashboard-page.jsx` — **pass**
- Same on `quotes-list-page.jsx` — **pass**
- Same on `app-shell.jsx` — **pass**
- Same on `ui/PageHeader.jsx` — **pass**
- Same looped across every `.js` / `.jsx` file in `src/` (94 files)
  — **pass, zero failures**
- CSS brace balance of `phase3-dashboard.css` — **pass, 55 / 55**
- Python regex scan over `@keyframes` blocks confirming
  transform/opacity only — **pass, 1 block (`pl-skel-pulse`),
  opacity-only**
- Grep for `prefers-reduced-motion` overrides in the new CSS —
  **pass, 5**
- Grep for new `key={i}` / `key={idx}` introduced by Phase 3 — **none**
- `diff -rq` against Phase 2 zip — **pass, only 6 in-scope paths
  changed**
- `diff` on `index.css` alone — **pass, exactly one `+@import` line
  added**

**Action required before merge:**

1. `npm install && npm run build && npm run test:e2e` in a connected
   environment.
2. Lighthouse CLS check on the Dashboard (target: CLS = 0).
3. Lighthouse CLS check on the Quotes list (target: CLS = 0).
4. Device-matrix visual pass: iPhone SE/8 (375 × 667), iPhone 16
   (390 × 844), Galaxy S (360 × 800), iPad Mini (768 × 1024),
   iPad Pro (1024 × 1366), Surface (1366 × 768), MacBook Pro
   (1440+).
5. Live test of filter persistence: select "Sent" on `/app/quotes`,
   click into a quote, hit browser back, confirm "Sent" is still
   active. Close tab, reopen → confirm reset to "All".
6. Live test of debounced search on a realistic 200+ quote list —
   confirm no character drops on mid-range Android.
7. Live test of tab-strip keyboard navigation on VoiceOver (iOS) and
   NVDA (Windows) with particular attention to arrow-key tab movement
   and `aria-selected` announcement.
8. Visual pass on first-time-user `quotes.length === 0` dashboard
   empty state — verify the `.v2-empty` grid layout survives the
   `<Card>` wrap (see MEDIUM item above).
9. Visual pass on dashboard stat grid: hover lift on desktop, touch
   feedback on mobile, transform-only (no layout shift) confirmed in
   Chrome devtools Performance panel.

None of the above is a Phase 3 defect — they're environmental limits
documented for the reviewer, mirroring the Phase 1 and Phase 2
audit conventions.

---

## NOTE — Existing localStorage / sessionStorage keys preserved

The following keys are untouched:

- `pl_hide_paid` (dashboard) — read/write unchanged
- `pl_hide_completed` (quotes list) — read/write unchanged
- `pl_onboarding_dismissed` (dashboard) — read/write unchanged
- `pl_upgrade_shown_*` (dashboard) — read/write unchanged

Phase 3 adds exactly one new key:

- `pl_quotes_filter` (session storage) — stores the active
  `statusFilter` string, cleared when the tab closes. URL param
  `?filter=<status>` still takes precedence on page load.

---

## NOTE — All route guards, auth hooks, and wirings preserved

`BookingDrawer`, `OnboardingWizard`, `UpgradePrompt`, `Foreman`,
`checkAndSendDigest`, `expireStaleDrafts`, `checkAndSendReminder`,
`calculateReceivables`, the `usePullToRefresh` pull-to-refresh hook,
`haptic` feedback, `identify` / `getVariant` analytics beacons, and
every `useEffect` in both pages are preserved byte-for-byte. Verified
by inspecting the `diff` hunks against the Phase 2 tree.

---

## Summary

Nothing in this audit blocks the Phase 3 ship under the sprint's own
acceptance criteria. Every item is either a pre-existing condition
carried forward from Phase 0/1/2, an intentional scope boundary
honoured, a live-build verification gap documented for the reviewer,
or a polish item queued for Phase 6.
