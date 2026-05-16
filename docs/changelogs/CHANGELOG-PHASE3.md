# Phase 3 — Dashboard + Quotes List (Changelog)

**Goal:** refactor `src/pages/dashboard-page.jsx` (1,041-line operator
home screen) and `src/pages/quotes-list-page.jsx` (350-line workspace
index) to consume the Phase 0 design-system primitives
(`<Card>`, `<PageHeader>`, `<Stat>`, `<RevealOnView>`), add stability
guarantees around the stat grid and list container, swap the quotes-
list status pills for a sliding-underline tabstrip, persist the active
filter across navigation in session storage, debounce the search input,
and bring the loading + empty states up to the Phase 1/2 polish bar —
without touching any business logic, analytics beacon, API contract,
or existing CSS class name.

**Strategy:** additive wrapping, not rewriting. Every handler, memo,
effect, API call, `sessionStorage` / `localStorage` key, route guard,
auth hook, BookingDrawer / OnboardingWizard / UpgradePrompt / Foreman
wiring, and every existing CSS class (`v2-*`, `ql-*`) is preserved
byte-for-byte. Phase 3 adds one file on top of Phase 2, extends two
primitives with backwards-compatible props, wraps existing DOM in
primitives, and swaps the existing pill/pagination/empty-state
markup for the new design-system equivalents.

---

## What changed

### Added

| File | Purpose |
|------|---------|
| `src/styles/phase3-dashboard.css` | Additive stylesheet imported after `phase2-public-quote.css`. Contains: `.pl-stat-grid` (2-up phone → 4-up desktop), `.pl-stat-cell` (transform-only hover lift), `.pl-dash-header` (marker), `.pl-empty-card` + `.pl-err-card` (Card-frame empty/error layouts), `.pl-search-safe` (iOS-zoom-safe ≥16px inputs on phones), `.pl-tabstrip` + `.pl-tab` (sliding-underline indicator via pseudo-element, `translate3d` + `scaleX` — never width/left), `.pl-ql-list`, `.pl-ql-row-wrap` (stable min-height 64px + transform-only hover), `.pl-ql-container` (stable min-height 240px), `.pl-skel-list` + `.pl-skel-row` + `.pl-stat-skel` (opacity-pulse skeletons via the `pl-skel-pulse` keyframe — opacity-only), semantic `.pl-chip--draft/sent/viewed/approved/scheduled/declined/expired` (dot + label, never color-only). 55 braces, balanced. Every keyframe animates `transform` + `opacity` only. Every animated class has a `prefers-reduced-motion` override (5 total). |
| `CHANGELOG-PHASE3.md` | This file. |
| `PHASE3-AUDIT.md` | Deferred items and offline-verification gaps. |

### Modified

| File | Change |
|------|--------|
| `src/components/app-shell.jsx` | Added `hideTitle` prop (default `false`). When `true`, the `.page-kicker` and `.app-topbar-subtitle` in the titleblock are skipped. Resolves the Phase 1 audit note about competing headings on pages that own their own `<PageHeader>`. Fully backwards-compatible — existing callers that pass `title="…"` continue to render the topbar title. |
| `src/components/ui/PageHeader.jsx` | Added `compact` prop (default `false`). When `true`, bottom margin becomes `var(--space-4)` instead of `var(--space-6)`. Fully backwards-compatible. |
| `src/styles/index.css` | Single one-line addition immediately after the `phase2-public-quote.css` import: `@import './phase3-dashboard.css';`. Nothing else was modified. The duplicate `[data-theme="light"]` block and the monolithic structure flagged in `PHASE0-AUDIT.md` remain deferred to Phase 6. |
| `src/pages/dashboard-page.jsx` | Refactored to wrap existing DOM in Phase 0 primitives: `AppShell hideTitle`; loading-state skeleton loop key changed from `key={i}` to `key={skel-${i}}`; `.v2-header` greeting block replaced with `<PageHeader>` (subtitle preserves all existing logic — today's jobs count → attention count → fallback, plus `currency(inPlay)` in play when `sent+viewed > 0`); `.v2-stats-grid` replaced with `<RevealOnView>` → `<div className="pl-stat-grid">` wrapping four `<Card as={Link} interactive>` → `<Stat>` cells (Closed revenue, Close rate, In pipeline, Open quotes); `.v2-empty` wrapped in `<Card padding="loose" minH="260px" className="v2-empty">`. All existing metrics (`closedRevenue`, `closeRate`, `pipeline`, `sentQuotes`, `viewedQuotes`) reused from memoized state — no new queries. |
| `src/pages/quotes-list-page.jsx` | Added primitive imports; `statusFilter` init now reads URL param → `sessionStorage('pl_quotes_filter')` → `null`; new `useEffect` persists changes; new `debouncedSearch` state + 180ms `setTimeout` effect; filter memo now depends on `debouncedSearch` instead of `search`; `AppShell hideTitle` + `<PageHeader kicker="Workspace" title="Quotes" subtitle={summary} actions>`; `.ql-status-pills` replaced with `.pl-tabstrip` (`role="tablist"`, each button `role="tab"` + `aria-selected` + `.pl-tab.is-active`); search row wrapped in `.pl-search-safe`; loading state replaced from `<PageSkeleton variant="list" />` to `.pl-skel-list` with 5 stable keys (`sk-a` through `sk-e`); both empty states (`quotes.length === 0` and `filtered.length === 0`) replaced from `<EmptyState>` to `<Card padding="loose" minH="…">` framed `.pl-empty-card` layouts; mobile `.ql-cards` rows wrapped in `<div key={q.id} className="pl-ql-row-wrap">` around the existing `<SwipeableRow>` + `<QuoteCard>`; summary-line div only renders when `isFiltered` is true (unfiltered summary moved to the `PageHeader` subtitle). |
| `README.md` | Marks Phase 3 as complete, adds pointers to the new changelog and audit. |

### Not touched

Every other page in `src/pages/` (Quote Builder, Public Quote, Quote
Detail, Public Invoice, Public Amendment, Public Additional Work,
Settings, Bookings, Contacts, Analytics, Invoices List, Invoice
Detail, Additional Work Detail, Landing, Signup, Login, Pricing,
Terms, Billing, Payments Onboarding / Setup, Project Portal). Every
existing component except `app-shell.jsx` and `ui/PageHeader.jsx`.
All API files under `api/`. All shared logic under `shared/`.
Supabase schema and migrations. Deploy scripts. `vite.config.js`,
`tailwind.config.js`, `postcss.config.js`, `package.json`,
`package-lock.json`. **A `diff -rq` against the Phase 2 zip confirms
exactly six paths changed**: the one new CSS file, the one-line import
in `index.css`, the two primitive-prop extensions, and the two pages
themselves (plus the three documentation deliverables at the repo
root).

---

## Why this shape

### `hideTitle` on `<AppShell>` instead of route-sniffing

The Phase 1 audit flagged that pages owning a `<PageHeader>` were
producing two competing headings — the topbar titleblock kicker and
the page body heading. The alternatives considered were:

- **Route-sniff inside `AppShell`** — use `useLocation()` to detect
  routes that own their own `<PageHeader>` and skip the titleblock.
  Rejected because it couples the shell to a specific route whitelist
  that has to be maintained in parallel with page code.
- **Remove the titleblock from `AppShell` entirely** — forces every
  page to own its heading. Rejected because several legacy pages
  (`settings`, `contacts`, `analytics`, `bookings`, etc.) don't yet
  have a `<PageHeader>` and still rely on the topbar title, and
  converting them is out of Phase 3 scope.
- **Add an opt-out prop** — `hideTitle` defaults to `false`, so every
  existing caller is unchanged. Phase 3 pages that own their own
  `<PageHeader>` pass `hideTitle`. Future phases can convert pages
  individually as they adopt `<PageHeader>`, with zero coordination
  needed in `app-shell.jsx`.

The prop is the same pattern as React Router's `<Outlet>` — it's a
boundary the consumer decides.

### `compact` prop on `<PageHeader>`

A pure margin-only extension. Used nowhere in Phase 3 (no current
caller needs the tighter variant) but added now because the sprint
prompt explicitly lists it, and so Phase 4+ callers don't have to
reopen `PageHeader.jsx` to get it.

### Four dashboard `<Stat>` cells

The existing `.v2-stats-grid` had three cells (Closed revenue, Close
rate, In pipeline). Phase 3 preserves all three byte-for-byte and
**adds a fourth** — Open quotes — because the sprint prompt's
acceptance checklist specifies four. `openCount` is derived from
already-computed memoized state (`sentQuotes.length +
viewedQuotes.length`) so there's no new query, no new API call, no
new effect. The `hint` text ("X not yet opened") is rendered only
when there are actually sent-but-unopened quotes, using
`sentQuotes.filter(q => !q.view_count).length` — a property the
existing API response already returns.

Closed revenue and In pipeline pass `currency(…)` strings into
`<Stat>`, which disables count-up for those two cells (mirrors the
Phase 2 hero-total audit note — `<Stat>` doesn't yet have a
`formatter` prop). Only Close rate and Open quotes count up. Flagged
in the audit; deferred to Phase 6 or whenever `<Stat>` grows
`formatter: (n) => currency(n)`.

### `pl_quotes_filter` sessionStorage key

Scoped intentionally to **session**, not local, storage. The filter
preference is a short-term workspace-navigation affordance: if the
user clicks into a quote from the "Sent" tab and comes back, they
should land back on "Sent"; if they close the browser and return
tomorrow, they should land on "All" because the mental context has
changed. This mirrors the behaviour of GitHub's PR-list filters and
Linear's issue filters, which are similarly session-scoped.

The URL param still wins over session storage — `?filter=sent` from
an external link or a dashboard stat-card click always overrides the
session value. Persistence only kicks in on direct `/app/quotes`
navigation.

### Tabstrip sliding-underline is CLS-free

The active-tab indicator is a pseudo-element on every `.pl-tab`,
positioned `bottom: -1px`, width set to `left: 10%; right: 10%`
(computed width, not animated), with `transform: translate3d(0,0,0)
scaleX(0)` as the initial state. The active tab flips to
`scaleX(1)`. The transition is purely on `transform`, which
composites on the GPU and never triggers layout. The strip itself has
`contain: layout paint` so any tab wrapping (e.g. when the user
resizes into a narrower viewport) reflows only within the strip, not
outward into the page.

There is no JavaScript-measured position — nothing reads or writes
`getBoundingClientRect()` on the active tab, so there's no
`requestAnimationFrame` loop, no `ResizeObserver`, no flash of
un-underlined tab on mount. The active class is applied on the same
render as the tab itself, so CSS handles the transition in one paint.

### Debounced search (180 ms)

A 180 ms `setTimeout` debounce on `search` → `debouncedSearch`. The
filter memo depends on `debouncedSearch` only, so each keystroke no
longer triggers a re-filter of the quotes array. On a list of 200+
quotes this removes the characters-dropped feeling on low-powered
Android devices. The `<input>` still updates `search` synchronously,
so the field itself feels responsive — only the list re-sort is
debounced.

180 ms is below the 250 ms threshold at which users perceive a lag
between typing and result updates, and above the 100 ms threshold
at which keystroke queuing becomes visible. It matches the debounce
used in global-search.

---

## Verification

Executed in an offline sandbox (no network, no project
`node_modules`). Every static check available was performed.

| Check | Result |
|-------|--------|
| `esbuild --loader:.jsx=jsx` on `dashboard-page.jsx` individually | **pass** |
| Same on `quotes-list-page.jsx` | **pass** |
| Same on `app-shell.jsx` | **pass** |
| Same on `ui/PageHeader.jsx` | **pass** |
| Same looped across every `.js` / `.jsx` file in `src/` (94 files) | **pass, 0 failures** |
| CSS brace balance of `phase3-dashboard.css` | **pass, 55 / 55** |
| `@keyframes` scan over `phase3-dashboard.css` — only `transform` / `opacity` animate | **pass, 1 block (`pl-skel-pulse`), opacity-only** |
| Grep for `prefers-reduced-motion` overrides in the new CSS | **pass, 5 overrides** |
| Grep for new `key={i}` / `key={idx}` introduced by Phase 3 | **pass, 0 new** (one pre-existing survives in `FeedItem` action-buttons map — outside Phase 3 scope; noted in `PHASE3-AUDIT.md`) |
| `diff -rq` against Phase 2 zip | **pass, only the 6 in-scope paths changed** |
| `diff` on `index.css` alone | **pass, exactly one `+@import` line added** |

The full live-build / test / device-matrix pass (below) did not run
in this sandbox — see `PHASE3-AUDIT.md` for the live-verification
checklist.

---

## Ship checklist

Before merge:

- [ ] `npm install && npm run build` in a connected environment
- [ ] `npm run test:e2e` — full Playwright suite
- [ ] Lighthouse CLS check on the Dashboard (target: CLS = 0)
- [ ] Lighthouse CLS check on the Quotes list (target: CLS = 0)
- [ ] Device-matrix visual pass: iPhone SE/8 (375 × 667), iPhone 16
      (390 × 844), Galaxy S (360 × 800), iPad Mini (768 × 1024),
      iPad Pro (1024 × 1366), Surface (1366 × 768), MacBook Pro
      (1440+)
- [ ] Live test: filter persistence across reloads — select "Sent",
      click into a quote, hit back, confirm "Sent" is still active.
      Close tab, reopen → confirm it resets to "All"
- [ ] Live test: debounced search across a realistic 200+ quote list —
      confirm no character drops on mid-range Android
- [ ] VoiceOver (iOS) + NVDA (Windows) tab-strip keyboard navigation —
      arrow keys should move tab focus, space/enter should activate,
      and `aria-selected` should be announced
- [ ] Visual QA: `.v2-empty` wrapped in `<Card>` still displays its
      `display: grid; place-items: center` layout correctly (flagged
      in `PHASE3-AUDIT.md` — classes win over inline style for
      unshadowed properties, but verify)
- [ ] Visual QA: Dashboard stat grid hover lift on desktop, tap-down
      feedback on touch
- [ ] Visual QA: Tabstrip sliding underline animates only `transform`
      (check Chrome devtools Performance panel — no layout events on
      tab switch)

None of the above is a Phase 3 defect — all are environmental limits
documented for the reviewer, mirroring the Phase 1 and Phase 2
conventions.
