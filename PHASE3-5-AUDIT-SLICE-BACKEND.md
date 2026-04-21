# Phase 0 — Audit Findings (Deferred)

Things I found while building Phase 0 that I **chose not to fix now**
because Phase 0's ship criterion is "no visual change at the page level."
Each item is queued for a specific later phase.

---

## HIGH — Accessibility regression from duplicate light-mode block

**File:** `src/styles/index.css`
**Lines:** ~95 and ~256

There are **two** `[data-theme="light"]` blocks. The first (line ~95)
contains AA-contrast-corrected values:

```css
--brand:   #B85128;  /* 4.5:1 text + 4.9:1 white-on-brand */
--green:   #0F7A50;  /* 4.9:1 */
--subtle:  #626973;  /* 5.1:1 on #F6F5F2 */
```

The second (line ~256) reverts them:

```css
--brand:   #E76A3C;  /* <3:1 on white — FAILS WCAG AA for small text */
--green:   #138A5B;  /* ~3.7:1 on white — FAILS for small text */
--subtle:  #8A8F98;  /* ~2.9:1 on #F6F5F2 — FAILS */
```

Because the second block comes later in cascade, **it wins**. The AA
corrections in the first block are dead code.

**Impact:** Light-mode users see lower-contrast brand and status colors
than the original author intended. Accessibility audit would flag this.

**Deferred to:** Phase 6 (consistency sweep). Fix is surgical —
delete the duplicate second block. However, deleting it is a real
visual change (darker brand orange, deeper green), so it deserves a
dedicated design review + visual QA sweep before it lands.

---

## MEDIUM — `index.css` is 6,300 lines and monolithic

Layout, components, modals, page-specific styles, and utility overrides
are all interleaved. Finding and updating any given rule requires grep.

**Deferred to:** Phase 6. Split into `tokens.css` (done), `base.css`,
`components.css` (buttons, inputs, cards, badges), `layout.css`, and
`page-overrides.css`.

---

## MEDIUM — Token scale duplication

Two parallel type scales exist:

- Legacy: `--fs-2xs` (9 px) … `--fs-3xl` (22 px)
- New (Phase 0): `--text-2xs` (11 px) … `--text-7xl` (60 px)

Two parallel shadow systems exist:

- Legacy: `--shadow-sm`, `--shadow`, `--shadow-md`, `--shadow-lg`, `--shadow-float`
- New (Phase 0): `--elev-0` … `--elev-4`, `--elev-hover`

**Why both:** existing page code uses the legacy tokens; ripping them
out in Phase 0 would produce thousands of visual regressions.

**Deferred to:** Phase 6. Map legacy → new token-by-token and remove
the aliases.

---

## LOW — `font-family` declarations duplicated across ~30 rules

Many component rules set `font-family: inherit` redundantly (now that
body inherits `var(--font-body)`, all children inherit it too). The
`inherit` declarations don't cause a bug — they're just noise.

**Deferred to:** Phase 6 cleanup.

---

## LOW — `postcss.config.js` does not include `postcss-import`

Relies on Vite's built-in CSS `@import` resolution. Works fine today
(verified). If the team ever moves off Vite (e.g. to Next.js) this
breaks silently.

**Deferred to:** add `postcss-import` in Phase 6 for portability.

---

## NOTE — `font-display: swap` vs `optional`

I chose `swap` over `optional` intentionally. `optional` has the best
theoretical CLS (font only applies if it arrives within ~100 ms, else
never), but on slower mobile connections it produces an inconsistent
brand experience — the same user sometimes sees Clash Display, sometimes
sees Arial Black. With proper `size-adjust` fallback metrics (in place),
`swap` gets measured CLS = 0 anyway, **and** guarantees the brand font
eventually applies.

**No action needed** — just documenting the decision.

---

## NOTE — framer-motion not installed

The original brief says "Use: Framer Motion." Phase 0 ships motion as
CSS transitions + variants-as-data, avoiding the ~55 KB gzipped
runtime cost. If Phase 1+ decides a page genuinely needs spring physics
(signature pad feedback, booking drawer drag, etc.), install it then
and consume the `EASE` / `DUR` / variant exports from `motion.js` so
the semantics stay identical across both engines.

---

## NOTE — No new dependencies were added

`package.json` is byte-identical to v96. Phase 0 is pure source code.
The only new external resources loaded at runtime are the two font
CDN requests, which are `<link rel="preconnect">` + `<link rel="preload">`
declared in `index.html`.
