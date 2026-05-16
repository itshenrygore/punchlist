# v100 Milestone 6.5 — Dashboard Visual & Interaction Polish

**Released:** April 14, 2026
**Shipped as:** `punchlist-v100-m6.5.zip`
**Predecessor:** `punchlist-v100-m6.zip`
**Spec:** M6.5 prompt (dashboard craft pass)
**Next:** M7

M6.5 is a **craft pass**, not a feature pass. Structure and data are
unchanged from M4. What changed is the feel: hierarchy, rhythm,
density control, motion, and the thousand small decisions that
separate a functional dashboard from a premium one.

More entries are refinements and removals than additions. That is
the point.

---

## Files touched

| File | Action |
|---|---|
| `src/pages/dashboard-page.jsx` | Refactored (895 → 809 lines) |
| `src/styles/dashboard-v2.css` | Clean rewrite (751 → 973 lines) |
| `src/components/dashboard/action-list-row.jsx` | **New** — extracted |
| `src/components/dashboard/headline-stat.jsx` | **New** — extracted |
| `src/components/dashboard/empty-state.jsx` | **New** — extracted |

No changes to: M4 `dashboard_bundle` RPC, `api/stripe-webhook.js`,
`api/public-quote-action.js`, `dashboard-page-v1.jsx`, or any other
page. No new npm dependencies.

---

## (a) Typography & numeric hierarchy

- **Micro-labels are now 11px.** Every section title, card label, day
  label, and revenue sublabel uses `var(--text-2xs)` (11px) with
  `.05em` tracking and uppercase. Previously these were inconsistent
  — some 12px, some 13px, one at 11px with inline `font-size: 11px`.
- **Revenue numerics got promoted to display scale.** Was
  `var(--text-xl)` (18px); now `clamp(1.5rem, 3vw, 1.875rem)` using
  `var(--font-display)` with `var(--tracking-tight)`. The two
  revenue stats (month / week) now visually own their card.
- **Greeting headline clamp-scaled up.** Was
  `clamp(1.35rem, 3.5vw, 1.75rem)` (22–28px); now
  `clamp(1.75rem, 4vw, 2.5rem)` (28–40px). Single line, no wrap,
  truncates with ellipsis if the first name is absurdly long.
- **Currency never wraps mid-number.** Every currency display now
  has `white-space: nowrap` — row numerics, revenue values, week-job
  values, caught-up $ on the line, section meta.
- **Tabular-nums everywhere numbers live.** Direct `font-variant-
  numeric: tabular-nums` on every currency/count site, not relying
  on a utility class to be remembered.
- **Removed inline font-size literals.** The action list previously
  had `font-size: 11px` and `font-size: 16px` hardcoded. Both now
  pull from `--text-2xs` / `--text-lg` tokens.

## (b) Spatial rhythm & density

- **`--dash-gap` is now responsive.** Desktop: 24px (`--space-6`).
  Mobile (<768px): 16px (`--space-4`). Previously hard-coded 16px
  everywhere.
- **Row 1 gets an extra bottom spacer.** `--dash-row1-spacer`
  (24px) pushes Row 2 down. Row 1 is the visual anchor; it earns
  the breathing room.
- **Row 5 (insights) gets a hairline divider.** `.dv2-hairline-top`
  adds a 1px top border and extra padding only when insights
  render. Signals "this is meta, not core."
- **Killed all `<br>` and empty `<div>` spacers.** Vertical rhythm
  comes from margin/gap tokens only. (There were three `<br>`s in
  the invoice prompt modal and action-row secondary line markup.)
- **Action list rows use a grid.** `grid-template-columns: auto 1fr
  auto auto` gives the four zones (dot, labels, numeric, actions)
  stable positions with no flex margins. Numerics right-align
  automatically.
- **Card padding matched to content density.** Action rows: tight
  (`--space-3` vertical, `--space-5` horizontal). Week + revenue
  cards: default (Card primitive `padding="default"` = `--space-5`).

**Design decision logged:** chose 24px desktop `--dash-gap` over
20px because the action list needed more vertical breathing room
to read under 2 seconds. 16px felt cramped; 32px felt diffuse.

## (c) Action list rebuild

Extracted to `src/components/dashboard/action-list-row.jsx`. New row
anatomy (left → right):

1. **Status dot** — 8px, urgency-coloured via token classes
   (`--red` / `--amber` / `--blue` / `--green` / `--muted`). 1.5px
   halo against panel for colour-blind lift.
2. **Label stack** — primary title at `--text-base` weight 600;
   secondary "why" line at `--text-xs` muted.
3. **Numeric** — right-aligned, tabular, nowrap. Hidden on ≤480px
   (secondary line shows the amount).
4. **Action cluster** — primary/ghost button + dismiss ×.

Other changes:

- **Row height is stable.** 64px desktop / 72px mobile via
  `--dv2-row-h-desktop` / `--dv2-row-h-mobile` tokens. Previously
  rows auto-sized and jumped.
- **"Text Kristine" signature move.** Primary button label is now
  derived from the customer's first name when a phone is present:
  `Text Kristine`, `Text Mike`. Falls back to `Email` / `Open`.
- **Top 1–2 rows get primary CTA variant.** Rest are ghost. Never
  more than two primary buttons visible.
- **Hover is now whole-row.** Surface fills to `var(--panel-2)` via
  a pseudo-element opacity fade (not a `background` transition).
  Row cursor is pointer; click anywhere on the labels/numeric
  opens the entity.
- **Dismiss × appears on row hover** (desktop) / always visible
  (touch devices via `@media (hover: none)`). Uses `lucide-react`
  `X` icon at 14px. Focus-visible always reveals it.
- **Secondary line is the "why."** "Sent 4 days ago, 2 views since"
  — not just "Sent 4d ago." Pulls from `last_followup_at` /
  `sent_at` / `view_count` and composes with ` · ` separators.
- **Empty state**: "You're all caught up. Next quote is a good
  one." with `CheckCircle2` at 48px muted colour and a CTA link.

Old classes removed (no external consumers — grep clean):
`dv2-action-item`, `dv2-action-body`, `dv2-action-icon`,
`dv2-action-title`, `dv2-action-sub`, `dv2-action-value`,
`dv2-action-btns`, `dv2-btn-nudge`, `dv2-btn-dismiss`,
`dv2-caught-up-cta` (renamed to preserve in section empty).
Replaced with the `dv2-arow-*` family.

**Preserved for external consumers:** `dv2-classic-link` (app-shell
sidebar), `dv2-root`, `dv2-row1`, and `data-testid="dash-job-form"`.

## (d) Motion & transitions

- **CSS-only entrance stagger.** `.dv2-enter` with
  `animation-delay: calc(var(--i) * 80ms)` drives headline → job
  input → action list → pipeline → secondaries. No JS
  orchestration. Action rows receive `--i` from the map index.
- **Only transform + opacity animate.** Hover surfaces on rows and
  upsell strip use a pseudo-element opacity fade for the
  shadow/background reveal. No more `background-color` or
  `border-color` transitions on the row itself.
  - Known exception: the `<Card>` primitive still transitions
    `box-shadow` + `border-color`. This is a Phase 0 primitive and
    out of scope for M6.5. See "Design-token gaps" below.
- **`transform: translateX(2px)` on week-job hover.** Replaces the
  previous colour-only hint; faster scan, lighter paint.
- **Usage bar drives progress via `transform: scaleX(var(--fill))`,
  not `width` transition.** The element's `width: 100%` is fixed;
  `--fill` is a normalized 0–1 value set inline.
- **`prefers-reduced-motion` honoured.** Every `@keyframes` block
  has a matching `@media (prefers-reduced-motion: reduce)` override
  to zero the animation. Tokens.css already zeroes all durations
  globally — the `.dv2-enter` override also flips opacity to 1 so
  nothing gets stuck invisible.
- **Count-up is unchanged.** All numeric displays flow through the
  existing `<Stat>` primitive's `useCountUp` or render as static
  formatted strings with `tabular-nums` reserving width.

## (e) Dark/light theme parity

- **Light-mode override block lives beside each selector**, not in
  a bottom mega-block. Makes it obvious at a glance which elements
  have light-specific tuning.
- **Status dot halo uses `var(--panel)`** — automatically resolves
  to warm off-white (#FFFFFF) in light and dark panel (#1A1A1D) in
  dark. The explicit light-mode redeclaration documents intent for
  future editors.
- **Muted-text AA bumps.** `--muted` in light mode (#667085) is
  borderline against `--panel-2` warm off-white. Three sites now
  escalate to `--text-2` (#344054, AAA) in light:
  `.dv2-section-empty-sub`, `.dv2-week-more`, `.dv2-revenue-lbl`.
- **Headline metric chip gets firmer light-mode border.** Uses
  `--line-2` against `--panel-2` so it reads with equivalent
  visual weight.
- **Elevation uses tokens.** All shadow surfaces use `--elev-*` or
  pseudo-element fades — no inline `box-shadow: 0 2px 12px rgba(…)`
  anywhere in the rewrite.

---

## Design decisions logged

- **24px vs 20px desktop `--dash-gap`:** chose 24 — action list
  needed more breathing room; 20 compressed the between-card
  space after row heights grew from 48 to 64px.
- **64/72 row height:** 64 desktop / 72 mobile hits the WCAG
  2.5.5 44×44 touch target with room for a two-line label stack.
- **11px micro-labels:** per M6.5 spec explicitly. Not 12, not 13.
  Letter-spacing `.05em` uppercase gives them the "these label
  something important" weight.
- **Revenue numerics at 24–30px `clamp()`:** small enough to fit
  two side-by-side in the card at 768px; large enough to hero at
  1440px. Display font + tight tracking gives contractor-tool
  confidence.
- **`display: contents` on action-row body link:** lets the three
  body children (dot, labels, numeric) participate in the parent
  grid without a subgrid declaration (Safari subgrid support is
  still patchy). Trade-off: the link's focus ring can't wrap all
  three; the parent `:focus-within` on `.dv2-arow` compensates.
- **Primary CTA on top 2 rows, ghost on rest:** preserves the
  "never more than 2 primary buttons visible" spec rule while
  still lifting the most-urgent items.
- **Pipeline `viewed` segment is now amber, not violet (#A78BFA):**
  the hardcoded violet was the last non-token colour in the file.
  Amber reinforces the "this is waiting on the customer" story.

---

## Design-token gaps (file for v101 design system pass)

- **`<Card>` primitive transitions `box-shadow` and `border-color`
  directly.** Against the iron rule. Needs a pseudo-element
  shadow-reveal pattern applied at the primitive level, which
  would then flow automatically to every page that uses `<Card>`.
  Not fixed in M6.5 because primitive changes ripple beyond scope.
- **No `--elev-hover` pseudo-element pattern in tokens.css.** I
  inlined the pseudo-element technique in dashboard-v2.css. If
  two more pages adopt this, lift it into a utility class
  (`.pl-hover-lift` or similar) in tokens.css.
- **`--ring-focus` is under-used.** Only the job input consumes it
  in this file. Pipeline segments, classic-view link, and action
  buttons use `outline` or nothing. A single focus-ring pattern
  belongs at the token level.
- **No `--status-dot-*` tokens.** The `.dv2-arow-dot--red/amber/…`
  pattern is dashboard-local; a shared dot token family would let
  other pages (quotes list urgency, invoice list) inherit the
  same colour mapping.
- **`.dv2-caught-up` is duplicative of `.dv2-section-empty`.** Kept
  both because they serve subtly different stories (green-check
  "all clear" vs. neutral "nothing here yet"), but a v101
  consolidation pass could merge them with a `tone` prop.

---

## Placeholder fields noted (v101 bundle additions)

None needed — M4 bundle shape was sufficient. Every field the UI
reads (`today_actions[].customer_phone`, `.customer_email`,
`.view_count`, `.last_followup_at`, `.sent_at`, `.days_overdue`,
`.scheduled_for`) already exists.

---

## Out-of-scope items skipped (per M6.5 meta-instruction)

- No new widgets (weather, quote-of-the-day, AI tips).
- No onboarding/empty-account wizard redesign.
- No `/app/analytics` redesign.
- No icon library migration (stayed on `lucide-react`).
- No copy-writing overhaul — only the action-button label
  ("Text Kristine") was adjusted; full tone pass is v101.

---

## Validation (manual — no automated test harness in repo)

- [x] Brace/paren balance verified across all 5 touched files.
- [x] No unused imports in `dashboard-page.jsx`.
- [x] No stale references to removed helpers (`TodayIcon`,
      `ActionItem`, `HeadlineMetric`, `followupUrgency`,
      `urgencyColor`, `handleMarkDone`, `handleNudge`).
- [x] No external consumers of removed class names (grep clean
      across `**/*.{js,jsx,ts,tsx,css,html}` minus the
      dashboard files themselves).
- [x] `dv2-classic-link` preserved for `app-shell.jsx`.
- [x] `data-testid="dash-job-form"` preserved for any future e2e.
- [x] Classic-view escape hatch (`dashboard-page-v1.jsx`)
      untouched.
- [x] No new npm dependencies introduced.
- [ ] **Visual QA not performed** — no screenshots were attached
      to the M6.5 prompt, so dark/light/mobile/desktop visual
      check was done from the code's intended state, not its
      rendered state. Recommend re-running with screenshots
      before shipping to production.
- [ ] **Vite build not run** — `node_modules` was absent in the
      packaging environment and network was disabled. Syntax
      was verified by manual inspection + balance check; full
      type/lint/build needs to run in a dev environment before
      merge.
- [ ] **CLS = 0 not measured** — structural guards (skeleton
      `--skel-h` heights, `--min-ch` on revenue values, stable
      row min-heights) are in place, but real CLS measurement
      needs the running app.
- [ ] **WCAG AA spot-check on light theme** pending visual QA.

---

## Upgrade path (from M6 to M6.5)

Pure code update — no database changes, no new env vars, no
migrations. Deploy the new bundle and the dashboard refresh on
next load.

Rollback: `dashboard-page-v1.jsx` remains untouched. The Classic
view escape hatch continues to work as designed until its 30-day
sunset lands in the M8 cleanup.
