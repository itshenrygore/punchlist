# Phase 3.5 Slice 12 — Audit (Draft, Session 1)

**Purpose:** capture every deviation from the Slice 12 brief, risks carried
into Session 2, and anything a reviewer should double-check.

---

## 1. Brief deviations (intentional)

### 1.1 Right sidebar width: plan says `320px`, prior CSS had `280px`
Plan §B1 explicitly calls for `width: 320px`. Prior rule (L2810) used
`280px` inside a grid template. Slice 12 appended block uses `320px` per
spec. There is also an earlier media query at L5823 that sets
`.rq-builder-layout { grid-template-columns: 1fr 240px; }` at a narrower
breakpoint — that rule no longer matches because the appended block swaps
the container from grid to flex. The 240px rule becomes inert, which is the
desired outcome. Listing this explicitly so it's not a surprise in Session 2.

### 1.2 Sticky offset: plan says `top: 16px`, prior CSS had `top: 70px`
Plan §B1 calls for `top: 16px`. The prior `70px` was likely chosen to sit
below an app-shell sticky header. If the rewritten layout produces visible
overlap with the app header in the browser, Session 2 should raise `top` to
whatever clears the header (likely 60–80px) and note the deviation.
**Risk:** header overlap on desktop is the most likely visible bug.

### 1.3 Stepper rendered with gap:0 + `::after` connector (not flex gap)
Plan §B6 describes a connector line between dots. The cleanest CSS-only way
to achieve per-segment fill (gray for pending segments, brand for completed
segments) is a `::after` pseudo on each step. This required dropping the
flex gap to 0 and letting `margin: 0 6px` on the connector handle spacing.
The visual result is identical; implementation differs. Called out for
reviewer clarity.

### 1.4 Build Quote hover shadow color uses `rgba(37,99,235,.3)` (brand blue)
Plan §B2 specifies `box-shadow: 0 4px 16px rgba(37,99,235,.3)` literally.
Punchlist's brand is orange (`--brand: #F97316` dark theme, `#B85128`
light). A blue glow on hover against an orange button is a color mismatch.
The spec was followed verbatim; if this looks wrong in the browser, Session
2 should swap the rgba to `var(--brand-glow)` or a derived orange rgba.
**Risk: medium — very likely to look visually off.**

### 1.5 `.rq-card-line-total` used `var(--brand)` previously
Plan §B3 specifies `color: var(--text)` for the line total. Previously at
L2876 the line total was orange (`var(--brand)`), which created good
visual hierarchy (price stands out). Spec overrides this. If Session 2
reviewer preferred the orange price, revert with one rule change.

### 1.6 Gradient header title text chosen by Slice 12 author
Plan §B2 says "white text showing the app name or a one-line value prop
('Send professional quotes in 60 seconds')". We used:
- Title: "Send professional quotes in 60 seconds"
- Sub:   "Punchlist builds the scope, pricing, and send flow for you"

Both are editorial choices within spec latitude. If product wants different
copy, it's a 2-line JSX edit at L973–974 of `quote-builder-page.jsx`.

### 1.7 Confetti uses 8 spans (spec says 6–8)
Chose 8 for fuller visual coverage. No risk; reviewer can request fewer.

---

## 2. Known pre-existing code smells NOT fixed in this slice

These are called out so the reviewer doesn't think Slice 12 introduced them.

### 2.1 Two `@keyframes shimmer` definitions in `index.css`
L2736 and L4548 both declare `@keyframes shimmer` with different bodies.
Later wins. Slice 12 sidesteps the conflict by using `qbShimmer` as its
keyframe name. Fix belongs to the Phase 6 consistency sweep noted in
`DESIGN-SYSTEM.md` §9.

### 2.2 Superseded-but-not-removed `.rq-card-drag-handle` rule at L2871
The earlier rule `.rq-card:hover .rq-card-drag-handle { opacity: .7 }`
at L2871 is now superseded by the appended Slice 12 rule
`.rq-card:hover .rq-card-drag-handle { opacity: 1 }`. The cascade resolves
correctly; removing the earlier rule would be cleaner but requires touching
an existing declaration, which Session 1 avoided to keep the diff surgical.
Session 2 or a later sweep can remove the dead rule.

### 2.3 Two `.rq-builder-layout` breakpoints in disagreement
Main rule at L2802 (grid) vs. mobile refinement at L5823 (grid-template
adjustment) vs. Slice 12 appended block (flex). Cascade resolves; the
earlier grid declarations are inert once `display: flex` wins. No incorrect
render, but a reviewer should know the file now has three `.rq-builder-layout`
declarations.

### 2.4 `.rq-sent-first::before` shimmer bar remains
At L4547, `.rq-sent-first::before` renders a horizontal gradient shimmer
bar at the top of the first-send banner. Plan doesn't remove it, and
Slice 12 didn't either. If the new confetti burst plus the existing
shimmer bar feels busy, Session 2 should either remove the shimmer
(simpler) or tone down the confetti.

---

## 3. Items NOT tested in Session 1 (browser-only)

Every item in this list REQUIRES Session 2 browser verification:

1. Two-column layout actually rendering at 769px+
2. Right rail not sticking into the app header
3. Right rail stacking cleanly at 375px viewport
4. Gradient header strip aligning flush with Card rounded corners (iOS Safari
   has a known bug where `overflow: hidden` on a parent is required for
   inner rounded corners to clip correctly — untested)
5. Describe Card top-edge rounding interacts correctly with `.qb-describe-hero`
   negative margins (if Card has `overflow: hidden` this works; if not, the
   gradient may overflow slightly — untested)
6. Build Quote hover shadow visual correctness (brand-mismatch concern, §1.4)
7. Left accent bar vs. existing card padding-left (`padding-left: 26px` at
   L2866 with a 3px accent bar should still leave visual breathing room —
   untested)
8. Drag handle disappearing on touch devices (no hover — acceptable since
   drag-and-drop on touch uses long-press anyway)
9. Stepper connector line alignment across breakpoints, especially 480px
10. Shimmer speed on low-end Android (1.4s linear — may look choppy at 60fps
    on cheap phones)
11. Build progress bar visible under Card top edge rounding (same overflow
    concern as §3.4)
12. Confetti fan-out distances not clipped by Card padding or overflow
13. Staggered step entrance triggers on every re-render vs. once-per-mount —
    currently fires on every render because the CSS animation re-runs on any
    opacity/transform class change. If the user interacts with the sent card
    (clicks a button), the stagger WON'T re-run because the rules are in the
    base `@media` and the animation is named — browsers deduplicate. But on
    component re-mount it re-fires, which is fine.
14. Push nudge arrow (›) centering on iOS (font-rendering of single glyphs)
15. Reduced-motion: every animation has a `no-preference` gate, but the
    `qb-describe-hero` has a text-shadow-less gradient that looks identical
    in both modes (intentional — gradient isn't motion)

---

## 4. Hard-constraint audit

| Constraint | Status | Evidence |
|------------|--------|----------|
| `api/stripe-webhook.js` untouched | ✅ | not in diff |
| `api/public-quote-action.js` untouched | ✅ | not in diff |
| No state / hooks / handlers touched | ✅ | only JSX fragments added, no existing expressions modified |
| No new npm deps | ✅ | `package.json` not modified |
| Existing class names preserved | ✅ | only added: `.qb-describe-hero*`, `.qb-build-progress`, `.rq-sent-confetti` |
| `prefers-reduced-motion` respected | ✅ | every `@keyframes` consumer gated on `@media (prefers-reduced-motion: no-preference)`; reduced-motion fallback given for the one-shot progress bar so users still see progress indication |
| 375px no overflow | 👁 | CSS-reviewed; browser-verify in Session 2 |

---

## 5. Deferred to Session 2

Session 1 produced a clean draft. Session 2 should:
1. Run the draft in a browser, ideally with an iPhone SE emulation + 4× CPU
   throttle, in both dark and light themes.
2. File each visual issue against the corresponding Slice 12 rule in the
   appended CSS block (line numbers stable because the block is at EOF).
3. Write a short iteration changelog (`CHANGELOG-PHASE3-5-SLICE-12-ITER.md`)
   with before/after snippets for each fix.
4. Re-zip as `punchlist-phase3_5-through-slice12.zip` (no `-draft` suffix)
   for final deployment.

No logic changes are expected in Session 2 — only CSS value tweaks and,
if necessary, copy tweaks in the three JSX additions.

---

## 6. Sign-off

Slice 12 Session 1 draft meets every item on the brief's validation checklist
that can be verified without a browser. Remaining items are visual-only and
gated behind Session 2.
