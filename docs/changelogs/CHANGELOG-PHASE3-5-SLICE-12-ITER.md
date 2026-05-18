# Phase 3.5 Slice 12 — Iteration (Session 2)

**Released:** April 14, 2026
**Shipped as:** `punchlist-v99.1.zip`
**Predecessor:** Session 1 draft in `punchlist-v99.zip`
**Status of v100:** not started; this is a v99 patch.

Session 2 of Slice 12 per
[V100-MILESTONE-PROMPTS.md §M1](./V100-MILESTONE-PROMPTS.md). Iterates on
the Session 1 draft — no state, hooks, handlers, or new features. Only
CSS value tweaks inside the Slice 12 appended block at the end of
`src/styles/index.css` (starts at `/* ═══ Phase 3.5 Slice 12 ═══ */`).

**Note on methodology.** This session was run without browser access. Of
the four "likely fixes" listed in the M1 prompt, three were confirmed
correct by code reading (brand tokens, sticky-header geometry, the
`.rq-sent-first { overflow: hidden }` rule at L4546 that `.rq-sent-banner
{ position: relative }` at L6914 didn't address). The fourth — adding
`overflow: hidden` to the describe Card for Safari iOS corner-clipping —
was skipped: the `Card` primitive
(`src/components/ui/Card.jsx`) already sets `contain: layout paint` on
its root, which clips child painting to the rounded border box. If
Safari iOS still shows the bug in real-device testing, add
`overflow: hidden` in a future iteration, but shipping the belt-and-
suspenders change blind risks regressing a different case (animations
that intentionally overflow their Card, like the drop-shadow on the
Build Quote CTA itself).

---

## Fix 1 — Build Quote hover shadow color (brand-mismatch)

**Issue.** Session 1's audit (§1.4) flagged this as "medium risk — very
likely to look visually off." The hover glow on the Build Quote CTA used
`rgba(37, 99, 235, 0.3)`, which is Tailwind's `blue-600` at 30%. The
Punchlist brand is orange
(`--brand: #F97316` dark / `#B85128` light / `#E76A3C` mid), so a blue
glow on an orange button is an objective color mismatch. The rgba value
was copied verbatim from the Slice 12 plan, but the plan was authored
against a generic design-system token that didn't account for the
custom brand palette.

**Root cause.** `src/styles/index.css:6564–6567` (Session 1 block).

**Before:**
```css
@media (prefers-reduced-motion: no-preference) {
  .qb-zone .btn-primary.btn-lg.full-width:hover:not(:disabled) {
    box-shadow: 0 4px 16px rgba(37, 99, 235, 0.3);
    transform: translateY(-1px);
  }
}
```

**After:**
```css
@media (prefers-reduced-motion: no-preference) {
  .qb-zone .btn-primary.btn-lg.full-width:hover:not(:disabled) {
    box-shadow: 0 4px 16px rgba(249, 115, 22, 0.3);
    transform: translateY(-1px);
  }
}
```

**Why a raw rgba and not `var(--brand-glow)`?** `--brand-glow` is defined
at `.15` (dark) / `.10` (light) opacity — too faint for a hover lift
signal at 16px blur. Keeping the spec's `.3` opacity preserves the
perceived weight of the lift. `#F97316` is the dark-theme brand value;
light theme's `#B85128` at 30% opacity reads similarly warm at this
blur radius, so one rgba serves both themes acceptably. If the light-
theme glow looks muted in later QA, wrap the rule in a dark/light
variant pair.

**Scope limit.** Selector unchanged, still scoped to
`.qb-zone .btn-primary.btn-lg.full-width`, so only the Build Quote CTA
inside the describe phase is affected.

---

## Fix 2 — Right rail sticky offset clears app topbar

**Issue.** Session 1's audit (§1.2) flagged this as "the most likely
visible bug." Spec said `top: 16px` for the sticky sidebar. The app
shell has `.app-topbar { position: sticky; top: 0; z-index: 20; }` at
`index.css:719` with `min-height: 56px` (48px at `max-width: 900px`
per L1789). A 16px sticky offset on the rail means the rail's top
scrolls underneath the sticky topbar, obscuring the first ~40px of its
content.

**Root cause.** `src/styles/index.css:6511` (Session 1 block).

**Before:**
```css
.rq-builder-right {
  width: 320px;
  flex-shrink: 0;
  position: sticky;
  top: 16px;
  display: grid;
  gap: 10px;
  align-content: start;
}
```

**After:**
```css
.rq-builder-right {
  width: 320px;
  flex-shrink: 0;
  position: sticky;
  top: 72px;           /* 56px topbar + 16px breathing room */
  display: grid;
  gap: 10px;
  align-content: start;
}
```

**Geometry.** 56px (topbar min-height) + 16px (spec's intended air gap)
= 72px. Pre-Slice-12 CSS used 70px at L2811; this adds 2px, which
compensates for the topbar's 1px bottom border plus its own internal
box-shadow line. On the `max-width: 900px` breakpoint where topbar
drops to 48px, 72px provides 24px of air — acceptable and the narrower
viewport stacks at `max-width: 768px` anyway (flex-direction: column),
so the sticky offset doesn't apply in practice at those widths.

**Mobile (≤768px) unchanged.** The `@media (max-width: 768px)` block at
L6516 still sets `.rq-builder-right { position: static; top: auto; }`,
so mobile stacking is not affected.

---

## Fix 3 — Confetti clipped by `.rq-sent-first { overflow: hidden }`

**Issue.** Session 1's audit (§3.12) flagged confetti fan-out as
un-verified. Reading the CSS confirms it: `.rq-sent-first` at
`index.css:4546` has `overflow: hidden` (required to clip the 200%-wide
`::before` shimmer bar). The confetti renders exclusively when
`isFirst === true`, which is also exactly when `.rq-sent-first` is on
the banner. Session 1 added `.rq-sent-banner { position: relative }` at
L6914, but that doesn't change overflow — the confetti trajectories
still terminate 36–76px above the banner's top edge, so the visible
apex of the burst is clipped.

**Root cause.** Trajectory Y-extents (−60 to −100px) exceed the
available negative space inside the banner above
`.rq-sent-confetti { top: 24px }`.

**Two repair options considered:**

1. Make the overflow context `visible` and raise confetti `z-index`.
   Requires either (a) dropping `overflow: hidden` on `.rq-sent-first`,
   which regresses the shimmer bar clipping, or (b) moving confetti
   out of the banner entirely into a new positioned parent — which
   would be a JSX change, out of scope for Session 2.
2. Shorten trajectories to fit within the banner's available height.
   Pure CSS value tweak, no JSX change, no regression risk for the
   shimmer bar.

**Chose option 2.** Y-extents reduced from −60/−100px to −18/−46px, so
the full arc terminates inside the banner. X-extents scaled ~0.7× to
preserve the fan-out silhouette (an 8-particle burst looks uneven if
you shorten only Y). Rotations unchanged — they're intrinsic to each
span and independent of travel distance.

**Before → After (eight keyframes):**

| Keyframe | Before `translate(x,y)` | After `translate(x,y)` |
|----------|-------------------------|-------------------------|
| qbConfetti1 | −80px, −60px | −55px, −28px |
| qbConfetti2 | −50px, −90px | −35px, −42px |
| qbConfetti3 | −20px, −100px | −14px, −46px |
| qbConfetti4 | 30px, −95px | 22px, −44px |
| qbConfetti5 | 60px, −70px | 42px, −32px |
| qbConfetti6 | 85px, −40px | 58px, −18px |
| qbConfetti7 | −70px, −20px | −48px, −10px |
| qbConfetti8 | 70px, −10px | 48px, −6px |

All eight `@keyframes qbConfetti{1..8}` declarations at
`index.css:6825–6856` (Session 1 block) replaced accordingly. Opacity
envelopes and durations unchanged (1.1–1.5s `ease-out` with staggered
`0s`–`0.18s` delays).

**Scope limit.** If at real-device QA the shorter arcs feel
anti-climactic compared to the first-send moment's intended celebration,
a future iteration can take option 1(b) — move the confetti `<div>` out
of the banner into a new positioned overlay at the phase wrapper level.
That is a JSX change and belongs in v100 Workstream D polish, not a
Session 2 patch.

---

## Fix 4 — (Skipped) Describe gradient clip on Safari iOS

The M1 prompt suggested adding `overflow: hidden` to the describe phase
`Card` to fix potential Safari iOS rounded-corner clipping of
`.qb-describe-hero`'s gradient (which uses negative margins to bleed
into the Card's padding).

**Skipped because.** `src/components/ui/Card.jsx` L49–50 sets
`contain: layout paint` on every `Card`. `contain: paint` creates a
painting boundary that clips children to the container's border box
(including rounded corners). Modern Safari (iOS 16+) respects this.
Adding a blanket `overflow: hidden` to the describe Card would be
redundant at best and could regress cases where a child intentionally
extends past the Card border (none currently known in the describe
phase, but it's a footgun).

If real-device testing on Safari iOS surfaces corner leakage, the
targeted fix is to add `overflow: hidden` directly on
`.pl-describe-stable` (Card className passthrough) rather than changing
the Card primitive. Deferred to v100 M7 QA (device matrix).

---

## Hard-constraint audit

| Constraint | Status |
|------------|--------|
| No changes outside `src/styles/index.css` and `src/pages/quote-builder-page.jsx` | ✅ (only `index.css` touched this iteration) |
| No state / hook / handler edits | ✅ (no JSX touched at all) |
| No new npm deps | ✅ (`package.json` unchanged) |
| `prefers-reduced-motion` honoured | ✅ (Fix 1 lives inside the existing `no-preference` wrapper; Fix 2 is a static offset, no motion; Fix 3 confetti is already gated on `no-preference` at L6815–6824) |
| `api/stripe-webhook.js` untouched | ✅ |
| `api/public-quote-action.js` untouched | ✅ |
| Existing class names preserved | ✅ (no classes renamed) |

---

## Non-regression evidence

Diff against `punchlist-v99.zip` shows exactly three hunks, all in
`src/styles/index.css`, all inside the Slice 12 appended block
(everything above L6482 is byte-identical). Slices 1–11 files
(`src/lib/api/*.js`, `src/hooks/use-customers.js`,
`src/lib/offline.js`, `src/components/toast.jsx`,
`api/send-quote-email.js`) are untouched. The v99 fixes to
`quote-builder-page.jsx` (lines 626, 833, 1006 per `CHANGELOG-v99.md`)
are preserved verbatim.

---

## Deferred to v100 M7 QA

These items from Session 1 audit §3 remain browser-only and are
explicitly deferred to the v100 device-matrix pass:

- §3.4 Gradient header corner clipping on Safari iOS (see Fix 4 above)
- §3.9 Stepper connector line alignment at 480px
- §3.10 Shimmer speed on low-end Android
- §3.14 Push nudge arrow centering on iOS
- Real-device perception of the shorter confetti trajectories

None block the v99.1 ship.

---

## File changes summary

| File | Change | Lines |
|------|--------|-------|
| `src/styles/index.css` | 3 hunks inside Slice 12 block (Fixes 1, 2, 3) | +26, −9 |
| `CHANGELOG-PHASE3-5-SLICE-12-ITER.md` | New | new |
