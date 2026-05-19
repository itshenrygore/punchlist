# Phase 1 — Audit Findings

Things noticed while refactoring the Quote Builder that were
**intentionally not fixed** in Phase 1 because they fall outside
the sprint's explicit scope, or because fixing them would conflict
with the "don't break things" non-negotiable. Each item is queued
for a specific later phase.

---

## HIGH — Phase 0 deferrals still open

These are carried forward from `PHASE0-AUDIT.md` without change:

- Duplicate `[data-theme="light"]` block in `src/styles/index.css`. The second block (line ~256) still wins in cascade, overriding the AA-corrected values.
- `index.css` remains a 6,300-line monolith.
- `--fs-*` and `--shadow-*` legacy tokens still live alongside `--text-*` and `--elev-*`.
- `font-family: inherit` noise across ~30 rules.

**Why deferred:** the Phase 1 scope prompt explicitly states "Don't dedupe the duplicate light-mode CSS block (deferred to Phase 6)" and "Preserve existing CSS class names." Touching `index.css` would have been a scope violation.

**Action:** unchanged. Still queued for Phase 6.

---

## MEDIUM — `PageHeader` primitive evaluated but not used on the builder

The Phase 1 scope said "Use `<PageHeader>` + `<Section>` for structure." `<Section>` is used (as the outer body wrapper). `<PageHeader>` is not, because `<AppShell>` already renders a page kicker (`title`) and subtitle in the topbar via the props `QuoteBuilderPage` already passes: `<AppShell title={...} subtitle={subtitle}>`. Adding a second page-level heading inside the body would have produced two competing display titles on the same screen, which would *reduce* visual consistency, not increase it.

**Impact:** minor — on pages where `AppShell` does not render a subtitle (if that ever changes), Phase 1 would need a body-level `<PageHeader>` re-introduced.

**Options going forward:**
1. Leave as-is and document the convention: "`<PageHeader>` is used on pages where the topbar does not carry the page title."
2. Move the title/subtitle responsibility from `<AppShell>` into page bodies via `<PageHeader>` in Phase 3 (Dashboard) when it gets its first natural use — "Good morning, Mike" is a kicker/title pattern that *belongs* in the page body, not the topbar.

**Recommendation:** option 2 — Phase 3 is the right place to make the switch. Phase 1 doesn't need to initiate it.

**Action:** `PageHeader` import removed from the Quote Builder file to avoid an unused-import warning. This is purely cosmetic — no runtime impact.

---

## MEDIUM — Pre-existing `key={i}` in confidence-checks list (not introduced by Phase 1)

Line 885 of `quote-builder-page.jsx`:

```jsx
{(confidence.checks || [])
  .filter(c => c.state !== 'good')
  .map((c, i) => <span key={i} className={...}>{c.label}</span>)}
```

This is the readiness-check badge list inside the optional confidence `<details>`. The non-negotiable build rule says "Stable React keys on any mapped list — never use array index unless the list is static." This list is effectively static — it comes from `buildConfidence(lineItems, [], {...})` which returns a fixed set of check objects in a deterministic order, and it never reorders. The filter just hides 'good' ones. So the current use is defensible, but it's not *ideal*.

**Pre-existing:** yes. This `key={i}` was in the Phase 0 code at the same line, unchanged. Phase 1 did not touch this block.

**Impact:** zero in practice. React will reconcile correctly because the list is static-ordered.

**Deferred to:** Phase 6 consistency sweep. Fix is one line: `key={c.label}` (labels are unique per the `buildConfidence` implementation) or `key={c.id}` if an id is added to the check objects.

---

## LOW — The existing `addCatalogItem` catalog-result loop uses a composite string key

Line 782:

```jsx
catalogResults.map((item, i) => (
  <div key={`${item.name}-${i}`} ...>
```

Name-plus-index is stable enough when the list is debounce-regenerated on each search, but two items with the same name (rare but possible in catalog data) would collide. Pre-existing.

**Deferred to:** Phase 6. Catalog data already has a stable `id` generated at map-time (`id: 'cs_' + makeId()`) — switching the key to `item.id` is a one-line fix.

---

## LOW — Line-item drag-to-reorder opacity is set via inline style

The existing `onDragStart`/`onDragEnd` handlers set `e.currentTarget.style.opacity = '0.5' / '1'`. This conflicts philosophically with the "animations use class toggles" approach Phase 1 established for enter/leave, but changing it would risk breaking the existing drag UX which is already stable and working.

**Deferred to:** Phase 6 or a dedicated follow-up. The right fix is a `.rq-card--dragging` class + a CSS transition.

---

## LOW — The `jd-row` wrapping the trade/province selects in describe phase is an inline-styled flex row

Pre-existing. It works on all tested breakpoints. Not worth touching.

**Deferred to:** Phase 6.

---

## NOTE — Static verification only; live build/test not runnable

Phase 1 was executed in an offline sandbox (no network, no project `node_modules`). `npm install`, `npm run build`, and `npm run test:e2e` did not run. Every static check available was performed:

- `esbuild --loader:.jsx=jsx` transform on `quote-builder-page.jsx` — **pass**.
- Same transform looped across every `.js` / `.jsx` file in `src/` — **pass** (zero failures).
- Brace-balance check on `phase1-builder.css` — **pass** (55/55).
- Grep for `transform`/`opacity`-only animation — **pass**.
- Grep for `prefers-reduced-motion` overrides on every new animation class — **pass** (3).
- Grep for new `key={i}` or `key={idx}` introduced by Phase 1 — **none**.

**Action required before merge:** run `npm install && npm run build && npm run test:e2e` in a connected environment. Listed explicitly as un-ticked boxes in `CHANGELOG-PHASE1.md`'s ship checklist. This is not a Phase 1 defect — it's a sandbox limitation.

---

## NOTE — Foreman-suggestions panel data source

The panel surfaces `suggestions.filter(s => !s.selected && !alreadyInLineItems && !dismissed)`. In the existing `handleBuildScope` code:

- Items with `selected: true` (the AI's confident picks) are auto-added to `lineItems` — this behavior is **preserved byte-for-byte**. Users who previously clicked "Build Quote" and saw items appear still see exactly that.
- Items with `selected: false` come from two sources: (a) items the AI returned with `include_confidence: 'low'`, and (b) the entire `optional_upgrades[]` array. These were previously loaded into `suggestions` state but never rendered anywhere in the UI — the `suggestions` state was essentially dead data for the contractor until this sprint.
- The new panel turns that dead data into an interactive surface. No backend change was needed.

**Implication:** on quotes where the AI returned only `selected: true` items, the panel will be empty and the `<Card>` is hidden entirely (gated on `visibleSuggestions.length > 0`). No visual regression for those quotes.

**Implication:** contractors who previously did not realise the AI had flagged upgrades will now see them. This is a UX gain, not a regression. Worth mentioning in sales/onboarding collateral when the phase ships.

---

## NOTE — `DUR.base` timer is ~220 ms; keep in sync with the CSS

The leave-animation timer in `removeItem` reads `DUR.base` from `src/lib/motion.js` (0.22 seconds) and multiplies by 1000. The CSS `pl-item-leave` animation in `phase1-builder.css` reads `var(--dur-base, 220ms)` — the fallback is hardcoded to 220 ms. If the `--dur-base` token is retuned in `tokens.css` in a future phase, the JS and CSS will stay in lockstep **only if the `DUR.base` constant in `motion.js` is retuned to match**. `motion.js`'s comment warns about exactly this. Not a bug today — a note for anyone who changes motion tokens later.

---

## NOTE — Suggestion "Why" text could be long

The AI-generated `why` strings from `api/ai-scope.js` can be a sentence or two. The suggestion row uses `overflow-wrap: anywhere` via the component's `.pl-sug-item-why` class (inherited from rules in `phase1-builder.css`). Long text wraps rather than overflowing. On a very narrow phone (360 px), a three-line `why` + the Add/Dismiss buttons will make the row taller than typical — but won't clip, won't overflow, and won't reflow siblings thanks to the `motion-isolate` wrapper.

No action needed. Called out so nobody is surprised.

---

## NOTE — `window.__punchlistOpenForeman` hook preserved

The "Ask Foreman" button in `.rq-add-triggers` still calls `window.__punchlistOpenForeman(ctx)` with the same context shape as before. This is the bridge between the Quote Builder and the global `<Foreman />` component rendered by `<AppShell>`. Phase 1 did not modify this bridge — it only added a parallel in-page suggestions surface.

---

## Summary

Nothing in this audit blocks the Phase 1 ship under the sprint's own
acceptance criteria. Every item is either a pre-existing condition
carried forward from Phase 0, an intentional scope boundary honored,
or an environmental limit (no live build) documented for the reviewer.
