# Punchlist Design System

> Authoritative reference for tokens, primitives, and motion.
> When this document and the code disagree, **the code wins** —
> but please open a PR to reconcile.

---

## 1. Typography

### Stacks (see `src/styles/tokens.css`)
- `--font-display` → **Clash Display** (500 / 600 / 700) · Fontshare CDN
- `--font-body` → **Inter** (400 / 500 / 600 / 700) · Google Fonts CDN
- `--font-mono` → system monospace stack

### Fallbacks (CLS-safe)
`Clash Display Fallback` and `Inter Fallback` are declared with
`size-adjust`, `ascent-override`, and `descent-override` so the system
fallback occupies the same box as the real font. When the real WOFF2
swaps in, glyphs change but layout does not.

**Rule:** any heading that you want styled as a display heading must
get `className="font-display"` (or `style={{ fontFamily: 'var(--font-display)' }}`).
Everything else inherits `--font-body` from `body`.

### Scale
Use `--text-*` tokens for new code. Existing `--fs-*` tokens
(`--fs-xs`, `--fs-base`, etc.) remain authoritative until Phase 6.

| Token | Size | Use |
|-------|------|-----|
| `--text-2xs` | 11 px | badges, timestamps |
| `--text-xs` | 12 px | labels, captions |
| `--text-sm` | 13 px | dense UI |
| `--text-base` | 14 px | body default |
| `--text-md` | 15 px | comfortable body |
| `--text-lg` | 16 px | lede paragraphs, mobile body |
| `--text-xl` | 18 px | section heads |
| `--text-2xl` | 20 px | card titles |
| `--text-3xl` | 24 px | page h2 |
| `--text-4xl` | 30 px | page h1 (small) |
| `--text-5xl` | 36 px | page h1 (mid) |
| `--text-6xl` | 48 px | hero h1 |
| `--text-7xl` | 60 px | landing hero |

Display titles should use `clamp()` for fluid scaling:
```css
font-size: clamp(1.5rem, 3.2vw, 2.25rem);
line-height: var(--lh-tight);
letter-spacing: var(--tracking-tight);
```

---

## 2. Spacing rhythm

4 px base. Always use tokens; never hard-code `margin: 17px`.

| Token | px |
|-------|----|
| `--space-1` | 4 |
| `--space-2` | 8 |
| `--space-3` | 12 |
| `--space-4` | 16 |
| `--space-5` | 20 |
| `--space-6` | 24 |
| `--space-8` | 32 |
| `--space-10` | 40 |
| `--space-12` | 48 |
| `--space-16` | 64 |
| `--space-20` | 80 |
| `--space-24` | 96 |

---

## 3. Elevation (warm-tint shadows)

Five levels, both dark and light themed. The light theme uses a warmer
tint (`rgba(40, 28, 16, …)`) to avoid the "Bootstrap gray" flat look.

```css
--elev-1   /* cards at rest */
--elev-2   /* raised cards */
--elev-3   /* modals, sticky panels */
--elev-4   /* floating action, toast */
--elev-hover   /* interactive card hover */
```

Never stack `box-shadow`s manually — always reach for a token.

---

## 4. Motion

### Durations
```
--dur-instant  80 ms  · tap press
--dur-fast    140 ms  · hover
--dur-base    220 ms  · standard transitions
--dur-slow    360 ms  · entrances
--dur-slower  560 ms  · hero entrances, count-ups
```

### Easings
```
--ease-standard  UI default          cubic-bezier(.32,.72,0,1)
--ease-emphasis  entrances/exits     cubic-bezier(.22,1,.36,1)
--ease-spring    playful taps        cubic-bezier(.34,1.56,.64,1)
--ease-out       accelerated out     cubic-bezier(.16,1,.3,1)
--ease-in        accelerated in      cubic-bezier(.7,0,.84,0)
```

### Iron rules
1. Only `transform` and `opacity` animate. Never height/width/top/left.
2. Any container of animated children needs `contain: layout paint` or the `.motion-isolate` utility.
3. Reveals are **one-shot** — `viewportOnce: { once: true }`.
4. Honour `prefers-reduced-motion` — the global override in `tokens.css` zeroes all durations, but JS animations must also check `isReducedMotion()`.
5. Count-up numbers use `<Stat>` or `.num-stable` with a `--min-ch` var to prevent reflow.

---

## 5. Primitives

All live in `src/components/ui/`. Import via barrel:

```jsx
import { Card, Section, PageHeader, Stat, RevealOnView } from '../components/ui';
```

### `<Card>`
```jsx
<Card interactive padding="loose" elevation={2} minH="120px">
  …
</Card>
```
- `interactive` (bool) — opt-in hover lift (tune in Phase 1 CSS when primary page adopts it).
- `padding` — `'none' | 'tight' | 'default' | 'loose'`.
- `elevation` — `0 | 1 | 2 | 3 | 4`.
- `minH` — string; reserves height so dynamic content can't collapse.
- `as` — change the tag (defaults to `div`).

Always use `<Card>` for any surface-level box. Never nest cards more than two deep.

### `<Section>`
Vertical rhythm wrapper.
```jsx
<Section spacing="default">…</Section>
```
`spacing`: `'none' | 'tight' | 'default' | 'loose' | 'hero'`.

### `<PageHeader>`
```jsx
<PageHeader
  kicker="Dashboard"
  title="Good morning, Mike"
  subtitle="3 quotes waiting on follow-up"
  actions={<button className="btn btn-primary">New quote</button>}
/>
```

### `<Stat>`
```jsx
<Stat label="Monthly payment" value={434} prefix="$" suffix="/mo" />
<Stat label="Close rate"      value={72}  suffix="%" tone="success" />
<Stat label="Open quotes"     value={12}  hint="3 viewed · 2 approved" />
```
- Numeric `value` → count-up enabled by default.
- Width is reserved via `--min-ch` and `font-variant-numeric: tabular-nums`.
- Pass `countUp={false}` to skip the animation.

### `<RevealOnView>`
```jsx
<RevealOnView delay={120}>
  <Card>…</Card>
</RevealOnView>
```
- IntersectionObserver one-shot.
- `distance` (default 12 px) — translate-up distance.
- Respects reduced motion.

---

## 6. Utility classes from `tokens.css`

| Class | Does |
|-------|------|
| `.font-display` | Clash Display + tight tracking + stylistic alternates |
| `.tabular` | `font-variant-numeric: tabular-nums` |
| `.num-stable` | `inline-block` + `min-width: var(--min-ch, 6ch)` + tabular-nums |
| `.motion-isolate` | `contain: layout paint` + layer promotion |
| `.min-stable` | `min-height: var(--min-h)` |
| `.sr-only` | Screen-reader-only |

---

## 7. Theme switching

`<html data-theme="dark">` vs `<html data-theme="light">` is the only
switch. The pre-paint script in `index.html` reads `pl_theme` from
`localStorage` and applies it before any CSS parses — prevents FOUC.

Token values flip automatically. Never branch on theme in component code.

---

## 8. Adopting this system in new pages (Phase 1+)

Minimum viable adoption for any new page:

1. Wrap the page body in `<PageHeader>` + one or more `<Section>`s.
2. Use `<Card>` instead of ad-hoc `.panel` / `div` + inline styles.
3. Replace every `<div className="stat-number">{n}</div>` pattern with `<Stat>`.
4. Wrap any metric or amount that animates or updates in `.num-stable` with a `--min-ch` reservation.
5. Wrap large off-screen content in `<RevealOnView>`.
6. Import motion constants from `src/lib/motion.js` — never inline easing strings.

---

## 9. Known deferrals (see `PHASE0-AUDIT.md`)

- Duplicate `[data-theme="light"]` block in `index.css` (line ~256 overrides the AA-corrected one at line ~95).
- 6,300-line `index.css` needs modular split.
- `--fs-*` ↔ `--text-*` scale unification.
- `--shadow-*` ↔ `--elev-*` consolidation.

Each is queued for Phase 6 (consistency sweep).
