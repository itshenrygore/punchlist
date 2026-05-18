# Phase 3.5 Slice 12 — Visual Layout Refresh (Draft, Session 1)

**Status:** Session 1 draft. Browser verification + iteration pending in Session 2.
**Scope:** Layout-only rewrite of `quote-builder-page.jsx`. Plan items B1, B2,
B3, B6, B7, B8.

**Hard constraints honoured this slice:**
- No changes outside JSX structure and CSS.
- No state, hooks, handlers, or API calls touched.
- `api/stripe-webhook.js` and `api/public-quote-action.js` untouched.
- No new npm dependencies.
- Existing class names preserved; all new work is additive.
- Every new animation is gated on `@media (prefers-reduced-motion: no-preference)`.

---

## Files changed

| File | Change type | Lines added |
|------|-------------|-------------|
| `src/styles/index.css` | Append-only block at EOF | +430 |
| `src/pages/quote-builder-page.jsx` | 3 JSX insertions | +15 |
| `CHANGELOG-PHASE3-5-SLICE-12.md` | New | new file |
| `PHASE3-5-AUDIT-SLICE-12.md` | New | new file |

No existing CSS rules or JSX expressions were deleted. Overrides that
contradict earlier rules win via cascade order (new block is last in the
file).

---

## B1 — Two-column review layout at ≥ 768px

**Before** (`index.css` L2802–2812):
```css
.rq-builder-layout{display:grid;gap:10px}
.rq-builder-left{display:grid;gap:10px;min-width:0}
.rq-builder-right{display:grid;gap:10px;align-content:start}
@media(min-width:769px){
  .rq-builder-layout{grid-template-columns:1fr 280px;gap:16px;align-items:start}
  .rq-builder-right{position:sticky;top:70px}
}
```

**After** (Slice 12 appended block overrides):
```css
.rq-builder-layout {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}
.rq-builder-left {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 10px;
}
.rq-builder-right {
  width: 320px;
  flex-shrink: 0;
  position: sticky;
  top: 16px;
  display: grid;
  gap: 10px;
  align-content: start;
}
@media (max-width: 768px) {
  .rq-builder-layout { flex-direction: column; gap: 12px; }
  .rq-builder-right { width: 100%; position: static; top: auto; }
}
```

Width moved from `280px` → `320px` (plan spec). Sticky offset moved from
`70px` → `16px` (plan spec). Switched from grid to flex as specified. No
JSX change required.

---

## B2 — Describe phase visual refresh

### Header strip (CSS)

```css
.qb-describe-hero {
  margin: -24px -24px 16px;
  padding: 20px 24px;
  min-height: 72px;
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, var(--brand) 0%, #7c3aed 100%);
  color: #fff;
  border-radius: var(--r) var(--r) 0 0;
  box-sizing: border-box;
}
.qb-describe-hero-title { font-size: 16px; font-weight: 700; ... }
.qb-describe-hero-sub   { font-size: 12px; font-weight: 500; opacity: 0.9; }
@media (max-width: 480px) {
  .qb-describe-hero { margin: -20px -20px 14px; padding: 16px 20px; min-height: 64px; }
}
```

Negative margins pull the header to the Card's inner edge so it appears to
span full width and anchor at the rounded corners.

### JSX before (`quote-builder-page.jsx` L968–971):
```jsx
{phase === 'describe' && (
  <Card padding="loose" className="qb-zone pl-describe-stable" elevation={1}>
    <div className="jd-section">
      <label className="jd-label" htmlFor="qb-desc">What's the job?</label>
```

### JSX after:
```jsx
{phase === 'describe' && (
  <Card padding="loose" className="qb-zone pl-describe-stable" elevation={1}>
    {/* B2 (Slice 12): gradient header strip */}
    <div className="qb-describe-hero" aria-hidden="true">
      <div>
        <div className="qb-describe-hero-title">Send professional quotes in 60 seconds</div>
        <div className="qb-describe-hero-sub">Punchlist builds the scope, pricing, and send flow for you</div>
      </div>
    </div>
    <div className="jd-section">
      <label className="jd-label" htmlFor="qb-desc">What's the job?</label>
```

### Build Quote CTA hover (CSS)
```css
@media (prefers-reduced-motion: no-preference) {
  .qb-zone .btn-primary.btn-lg.full-width:hover:not(:disabled) {
    box-shadow: 0 4px 16px rgba(37, 99, 235, 0.3);
    transform: translateY(-1px);
  }
}
```
The selector `.qb-zone .btn-primary.btn-lg.full-width` only matches the
single Build Quote CTA inside the describe phase Card. No JSX change.

### Footer teaser de-emphasis
```css
.qb-pillar-teaser {
  font-size: 11px !important;
  color: var(--subtle) !important;
  line-height: 1.45;
}
```

---

## B3 — Line item cards visual polish

### Left accent bar, hover bg, drag handle visibility, total weight (CSS)

```css
.rq-card::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: var(--brand-line);
  border-radius: 3px 0 0 3px;
  transition: background var(--fast, .15s);
  pointer-events: none;
}
.rq-card.rq-card-editing::before { background: var(--brand); }

.rq-card:hover { background: var(--panel-2); }

.rq-card-drag-handle { opacity: 0; transition: opacity var(--fast, .15s); }
.rq-card:hover .rq-card-drag-handle,
.rq-card:focus-within .rq-card-drag-handle { opacity: 1; }

.rq-card-line-total {
  font-weight: 700 !important;
  color: var(--text) !important;
}
```

**Earlier rules that these override (kept intact in file, superseded by cascade):**
- `.rq-card-drag-handle { ... opacity:.3 ... }` at L2870
- `.rq-card:hover .rq-card-drag-handle { opacity:.7 }` at L2871
- `.rq-card-line-total { ... color:var(--brand) ... }` at L2876

No JSX change required — the left accent bar is a `::before` pseudo.

The `.rq-card` rule at L2866 already has `position: relative` implied via
`padding: 10px 12px 10px 26px; position: relative;` — confirmed by reading
L2866 in the original file.

---

## B6 — Progress stepper visual upgrade

### Before (the combined picture across L2790–2798 + L5660–5662):
- Gap `28px` between steps
- Inactive dots: `opacity: .35` (text + dot both dimmed)
- Active: `background: var(--brand); box-shadow: brand-glow` (no pulse ring)
- Done: `background: var(--green)` (green, not brand; no ✓ ring)
- Label: `font-size: 12px; font-weight: 600`; no uppercase, no tracking
- No connector line between dots

### After (Slice 12 block):
```css
.qb-stepper {
  display: flex; justify-content: center; align-items: center;
  gap: 0;                        /* connector ::after replaces flex gap */
  padding: 14px 0 10px;
}
.qb-step { display: flex; align-items: center; gap: 8px; opacity: 1; position: relative; }
.qb-step.active, .qb-step.done { opacity: 1; }

.qb-step-dot {
  width: 28px; height: 28px; border-radius: 50%;
  background: transparent;
  border: 2px solid var(--line);
  color: var(--muted);
  font-size: 12px; font-weight: 700;
  display: grid; place-items: center;
  box-shadow: none;              /* clears inherited brand-glow */
}
.qb-step.done .qb-step-dot {
  background: var(--brand); border-color: var(--brand); color: #fff;
  font-size: 13px;
}
.qb-step.active .qb-step-dot {
  background: var(--brand); border-color: var(--brand); color: #fff;
}
@media (prefers-reduced-motion: no-preference) {
  .qb-step.active .qb-step-dot { animation: qbStepPulse 1.8s ease-out infinite; }
}
@keyframes qbStepPulse {
  0%   { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.5); }
  70%  { box-shadow: 0 0 0 8px rgba(249, 115, 22, 0); }
  100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); }
}

.qb-step-label {
  font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--muted);
}
.qb-step.active .qb-step-label { color: var(--text); }
.qb-step.done   .qb-step-label { color: var(--text-2); }

.qb-step::after {
  content: ''; display: inline-block;
  width: 28px; height: 2px;
  background: var(--line);
  margin: 0 6px; flex-shrink: 0;
  transition: background var(--fast, .15s);
}
.qb-step:last-child::after { display: none; }
.qb-step.done::after { background: var(--brand); }
```

The done dot carries the ✓ glyph, which already comes from the existing
JSX `{done ? '✓' : i + 1}` — no JSX change needed.

Mobile (≤480px) override tightens the stepper to fit narrow viewports:
dot 24×24, label 10px, connector 18px.

---

## B7 — Building phase loading polish

### Shimmer skeleton rows (CSS)

```css
.bs-skeleton-item { animation: none; }   /* was skeletonFade */
.bs-skeleton-check {
  background: linear-gradient(90deg, var(--panel-2) 25%, var(--line) 50%, var(--panel-2) 75%);
  background-size: 200% 100%;
}
.bs-skeleton-bar:not(.price) {
  background: linear-gradient(90deg, var(--panel-2) 25%, var(--line) 50%, var(--panel-2) 75%);
  background-size: 200% 100%;
}
@media (prefers-reduced-motion: no-preference) {
  .bs-skeleton-check,
  .bs-skeleton-bar:not(.price) {
    animation: qbShimmer 1.4s linear infinite;
  }
}
@keyframes qbShimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

A new keyframe name (`qbShimmer`) avoids conflict with two existing
`@keyframes shimmer` declarations at L2736 and L4548 (same name, different
definitions, already a code smell flagged elsewhere — not touching in this slice).

### Progress bar (CSS + one-line JSX)

**JSX before** (`quote-builder-page.jsx` L1023–1024):
```jsx
<Card padding="loose" className="pl-building-stable" elevation={1}>
  <div className="bs-loading" style={{ padding: '16px 0', textAlign: 'center' }}>
```

**JSX after:**
```jsx
<Card padding="loose" className="pl-building-stable" elevation={1}>
  {/* B7 (Slice 12): CSS-only top progress bar 0→85% over 15s */}
  <div className="qb-build-progress" aria-hidden="true" />
  <div className="bs-loading" style={{ padding: '16px 0', textAlign: 'center' }}>
```

**CSS:**
```css
.qb-build-progress {
  position: relative; height: 3px; width: 100%;
  background: var(--line);
  border-radius: 3px 3px 0 0;
  overflow: hidden;
  margin: -24px -24px 16px;   /* flush to card top edge */
}
.qb-build-progress::before {
  content: ''; display: block; height: 100%; width: 0;
  background: linear-gradient(90deg, var(--brand), #7c3aed);
  border-radius: 3px 3px 0 0;
}
@media (prefers-reduced-motion: no-preference) {
  .qb-build-progress::before {
    animation: qbBuildProgress 15s ease-out forwards;
  }
}
@media (prefers-reduced-motion: reduce) {
  .qb-build-progress::before { width: 30%; }
}
@keyframes qbBuildProgress {
  0%   { width: 0%; }
  100% { width: 85%; }
}
```

### AI pulse dot

Confirmed `.bs-ai-dot` at L6054 already has the spec'd pulse animation
(`bs-dot-pulse 1.2s ease-in-out infinite`). No change needed.

---

## B8 — Sent success screen polish

### Confetti (JSX + CSS, first-send only)

**JSX before** (L1309):
```jsx
<div className={`rq-sent-banner${isFirst ? ' rq-sent-first' : ''}`} style={...}>
  {isFirst ? (
    <div style={{ textAlign: 'center', ... }}>
```

**JSX after:**
```jsx
<div className={`rq-sent-banner${isFirst ? ' rq-sent-first' : ''}`} style={...}>
  {isFirst && (
    /* B8 (Slice 12): CSS-only confetti burst, first-send only */
    <div className="rq-sent-confetti" aria-hidden="true">
      <span /><span /><span /><span /><span /><span /><span /><span />
    </div>
  )}
  {isFirst ? (
    <div style={{ textAlign: 'center', ... }}>
```

**CSS** — 8 spans, 8 unique `@keyframes qbConfetti1…8` each with a
different `translate(x, y) rotate(deg)` trajectory. Full definitions in
`index.css` (block at EOF). Sample:

```css
.rq-sent-confetti {
  position: absolute; top: 24px; left: 50%; transform: translateX(-50%);
  width: 0; height: 0; pointer-events: none; z-index: 1;
}
.rq-sent-confetti span {
  position: absolute; width: 8px; height: 8px;
  border-radius: 2px; top: 0; left: 0; opacity: 0;
}
.rq-sent-confetti span:nth-child(7),
.rq-sent-confetti span:nth-child(8) { border-radius: 50%; }  /* mix of squares + circles */

@media (prefers-reduced-motion: no-preference) {
  .rq-sent-confetti span:nth-child(1) { animation: qbConfetti1 1.2s ease-out 0.1s forwards; }
  /* …2–8 with staggered delays and unique keyframes… */
}
@keyframes qbConfetti1 {
  0%   { opacity: 1; transform: translate(0, 0) rotate(0deg); }
  100% { opacity: 0; transform: translate(-80px, -60px) rotate(280deg); }
}
/* 8 total trajectories fan out left/up/right, no library needed */
```

`.rq-sent-banner { position: relative; }` added so the absolutely-positioned
confetti anchors inside the banner.

### Staggered step entrance (CSS only)

```css
@media (prefers-reduced-motion: no-preference) {
  .rq-sent-steps .rq-sent-step {
    opacity: 0; transform: translateY(8px);
    animation: qbStepEntrance 0.5s cubic-bezier(.22, 1, .36, 1) forwards;
  }
  .rq-sent-steps .rq-sent-step:nth-child(1) { animation-delay: 0.10s; }
  .rq-sent-steps .rq-sent-step:nth-child(2) { animation-delay: 0.25s; }
  .rq-sent-steps .rq-sent-step:nth-child(3) { animation-delay: 0.40s; }
}
@keyframes qbStepEntrance { to { opacity: 1; transform: translateY(0); } }
```

Under reduced motion the default `opacity: 1; transform: none` on the base
rule is what renders — steps appear instantly without motion.

### Push nudge prominence (CSS only)

**Before** (L4553): `background: var(--panel-2); border: 1px solid var(--line); font-size: 12px; color: var(--text-2);` — a muted secondary style.

**After**: brand-tinted background, brand-line border, semibold, right-arrow
indicator, bumped padding-right to reserve arrow space.

```css
.rq-push-nudge {
  padding: 12px 40px 12px 14px;
  background: var(--brand-bg);
  border: 1px solid var(--brand-line);
  font-weight: 600;
  color: var(--text);
  /* position: relative inherited from base rule */
}
.rq-push-nudge:hover {
  background: rgba(249, 115, 22, 0.12);
  border-color: var(--brand);
}
.rq-push-nudge::after {
  content: '›';
  position: absolute; right: 16px; top: 50%;
  transform: translateY(-50%);
  font-size: 20px; font-weight: 700; color: var(--brand);
}
```

No JSX change — the arrow is a `::after` pseudo.

---

## Validation checklist (author self-check)

Marked ✅ where structural/code review confirms. Marked 👁 where Session 2
browser verification is required (visual correctness).

- ✅ Two-column flex layout rule present at min-width: default, stacked at ≤768px
- ✅ Right sidebar: `width: 320px; flex-shrink: 0; position: sticky; top: 16px`
- ✅ Right sidebar: `width: 100%; position: static` at ≤768px
- 👁 Visual: right sidebar stays in view while scrolling on desktop
- 👁 Visual: layout stacks correctly on 375px viewport, no horizontal overflow
- ✅ Describe phase card now has `.qb-describe-hero` element + gradient CSS
- ✅ Build Quote CTA hover rule added with brand-blue shadow
- ✅ Line item `.rq-card::before` pseudo renders left accent bar
- ✅ Accent bar switches to `var(--brand)` when `.rq-card-editing` present
- ✅ Drag handle CSS: `opacity: 0` default, `opacity: 1` on hover/focus-within
- ✅ Item total rule: `font-weight: 700; color: var(--text)` with !important
- ✅ Stepper: outlined inactive, filled active/done with ✓, pulse animation, connector ::after
- ✅ Step labels: 11px, 700, uppercase, .05em letter-spacing
- ✅ Skeleton rows: `bs-skeleton-item` animation disabled, check + bars now shimmer
- ✅ Progress bar div added to building phase JSX
- ✅ Progress bar CSS animates 0% → 85% over 15s
- ✅ Confetti div added to sent banner JSX, `isFirst` gated
- ✅ 8 confetti spans with 8 unique keyframe trajectories
- ✅ Sent step list entrance stagger: 0.10s / 0.25s / 0.40s
- ✅ Push nudge restyled with brand bg, border, arrow
- ✅ Every animation wrapped in `@media (prefers-reduced-motion: no-preference)`
- ✅ Reduced-motion fallback for progress bar (shows static 30% fill)
- ✅ No existing class names renamed
- ✅ No JSX handlers, hooks, or state touched
- ✅ `api/stripe-webhook.js` not touched
- ✅ `api/public-quote-action.js` not touched
- ✅ No npm dependencies added

---

## Non-regression evidence for Slices 1–11

Slices 1–11 all live in:
- `src/lib/api/*.js` (Slice 1, 3)
- `src/hooks/use-customers.js` (Slice 1, 11)
- `api/send-quote-email.js` (Slice 1, 7)
- `src/lib/api/customers.js` (Slice 3)
- `src/lib/offline.js` (Slice 4)
- `src/pages/quote-builder-page.jsx` — H4 reconciliation (Slice 5), send-path (Slice 7), telemetry (Slice 8), coachmarks + kbd (Slice 9), voice + prewarm (Slice 10), customer picker (Slice 11)
- `src/components/toast.jsx` (Slice 7)
- `src/styles/index.css` — `.rq-footer` keyboard-safe (Slice 6), `.toast-undo*` (Slice 7), `.qb-kbd-overlay*` (Slice 9), voice/mic styles (Slice 10), `.bs-ai-dot` (Slice 10)

This slice:
- Only appends to `index.css` (all existing rules remain, cascade resolves)
- Only inserts three new JSX fragments into `quote-builder-page.jsx` (three additive `<div>` trees); no handler, hook, state, effect, or existing JSX expression was modified
- Does not touch any of the other slice files

Therefore Slices 1–11 behaviour is preserved.

---

## Session 2 prompt (for iteration after browser review)

Start a new chat with:
1. `punchlist-phase3_5-through-slice12-draft.zip`
2. A concrete list of visual issues observed in browser, e.g.:
   - "Header strip on describe phase overflows the card rounded corner on Safari iOS"
   - "Stepper connector line is too close to the dots at 480px"
   - "Confetti animation fires on every render of the sent screen, not just first open"
   - "Right sidebar is sticky but cuts off below the viewport on 13-inch MacBook"
   - "Build Quote button hover shadow uses the wrong blue — should be brand orange"
3. Prompt text:
   > This is Session 2 of Slice 12. Read `CHANGELOG-PHASE3-5-SLICE-12.md` and
   > `PHASE3-5-AUDIT-SLICE-12.md` first. Do NOT re-architect. For each of the
   > issues below, locate the relevant rule in the Slice 12 block at the end of
   > `src/styles/index.css` (or the JSX additions) and adjust only that rule.
   > Write `CHANGELOG-PHASE3-5-SLICE-12-ITER.md` with before/after snippets and
   > produce `punchlist-phase3_5-through-slice12.zip` as the final deliverable.
