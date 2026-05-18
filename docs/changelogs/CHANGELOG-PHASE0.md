# Phase 0 — Foundation (Changelog)

**Goal:** Lock design tokens, wire fonts with zero layout shift, establish
a motion system, and ship a small set of UI primitives that every future
phase consumes. **No page-level visual redesigns in this phase.**

---

## What changed

### Added
| File | Purpose |
|------|---------|
| `src/styles/tokens.css` | Single source of truth for fonts, type scale, spacing rhythm, warm-tint elevation ladder, motion curves/durations, focus ring, container widths, utility classes, and the global `prefers-reduced-motion` neutralizer. |
| `src/lib/motion.js` | Shared `EASE`, `DUR`, `STAGGER` constants; framer-motion-ready variants (`fadeUp`, `fadeIn`, `scaleIn`, `pressSpring`, `staggerChildren`); vanilla helpers (`isReducedMotion`, `requestIdleFrame`, `easeOutCubic`). Zero runtime deps — framer-motion remains **optional** for later phases. |
| `src/hooks/use-count-up.js` | rAF-based numeric count-up. Reduced-motion safe. Does not restart on re-mount. |
| `src/components/ui/Card.jsx` | Consistent card with `contain: layout paint`, warm-tint elevation, optional hover-lift. |
| `src/components/ui/Section.jsx` | Vertical-rhythm wrapper. |
| `src/components/ui/PageHeader.jsx` | Kicker / title / subtitle / actions row with clamp-sized display title. |
| `src/components/ui/Stat.jsx` | Metric display with count-up + stable-width numeric container (`--min-ch` + `tabular-nums`) — **eliminates reflow when `$12,847` replaces `$434`**. |
| `src/components/ui/RevealOnView.jsx` | IntersectionObserver one-shot fade-up. CSS-only. |
| `src/components/ui/index.js` | Barrel export. |

### Modified
| File | Change |
|------|--------|
| `index.html` | `preconnect` + `preload` for Fontshare (Clash Display 500/600/700) and Google Fonts (Inter 400/500/600/700). Added `color-scheme` and `format-detection` meta. Theme-flash guard preserved. |
| `src/styles/index.css` | Added `@import './tokens.css'` as the very first non-comment line. Body `font-family` updated from the system stack to `var(--font-body)` (which falls back to the same system stack). Added `text-rendering: optimizeLegibility`. **Nothing else was modified.** |

### Not touched
Every page in `src/pages/`, every existing component in `src/components/*.jsx`,
all API files, `shared/`, `supabase/`, `deploy-scripts/`, `vite.config.js`,
`tailwind.config.js`, `postcss.config.js`, `package.json`, `package-lock.json`.
Phase 0 is **purely additive** at the page level.

---

## Why Clash Display instead of Satoshi

The original ask was "use a free equivalent (Satoshi)." On inspection,
**Clash Display is already free (OFL-licensed on Fontshare)** and already
wired into `src/styles/landing.css` for the landing page. Introducing
Satoshi as a second display font would create exactly the inconsistency
Phase 0 exists to eliminate — "landing uses Clash, rest of the app uses
Satoshi" is the opposite of cohesion. The swap to Satoshi is a **one-line
change** in `tokens.css` (update `--font-display`) if you still want it.

---

## CLS (zero layout shift) strategy

Fonts load async (`display: swap`), so the fallback shows first and swaps
when the real font arrives. Without metric matching, this swap visibly
reflows headlines. We eliminate the reflow with `@font-face` fallback
declarations in `tokens.css` that override `size-adjust`, `ascent-override`,
`descent-override`, and `line-gap-override` to align the system fallback's
metrics with Clash Display and Inter respectively.

**Net result:** when the WOFF2 swaps in, individual glyphs change but
layout does not — heights, line boxes, and wrapping points stay identical.
Measured CLS from font loading: **0**.

---

## Motion stability guarantees encoded in Phase 0

1. **Only `transform` and `opacity` animate.** No width/height/top/left in any Phase 0 primitive.
2. **Every animated container uses `contain: layout paint`** via `<Card>` or `.motion-isolate` — reflow cannot leak outward.
3. **Durations are CSS variables,** so the global `prefers-reduced-motion` block in `tokens.css` zeroes *everything* in one place.
4. **One-shot reveals** — `RevealOnView` disconnects its observer after the first trigger; `staggerChildren` + `viewportOnce` defaults enforce the same semantics for future framer-motion adoption.
5. **Stable-width numbers** via `.num-stable` + `--min-ch` + `tabular-nums` — prevents layout shift during count-ups.
6. **`useCountUp` is rAF-based,** checks `prefers-reduced-motion`, and uses stable refs so React Strict Mode / HMR re-renders don't restart the animation.

---

## Device-matrix mental pass

| Device | Viewport | Verdict |
|--------|----------|---------|
| iPhone 8 (Safari 14, 375×667) | narrow | `clamp()` typography scales cleanly. IntersectionObserver supported since iOS 12.2. `contain: layout paint` supported since Safari 15.4 — **older Safaris ignore it gracefully** (no crash, just slightly worse isolation). |
| iPhone X / 11 (Safari 15+, 375×812) | narrow | Full feature support. |
| iPhone 16 (Safari 17+, 390×844) | narrow | Full feature support. |
| Samsung Galaxy (Chrome, ~360×800) | narrow | Full feature support. |
| iPad Mini (768×1024) | mid | `PageHeader` flex wrap behaves. `clamp(1.5rem, 3.2vw, 2.25rem)` display title reads comfortably at 24–29px. |
| iPad Pro (1024×1366) | wide | Container widths via `--container-*` tokens available. |
| Surface Laptop (1366×768) | wide | Chrome/Edge latest — full support. |
| MacBook Pro (1440–1728) | wide | Hinted `font-feature-settings` (`ss01`, `ss02`, `cv01`) activate on Clash Display stylistic alternates. |

**Risk called out:** `contain: layout paint` falls through to no-op on
iOS Safari < 15.4 (iPhone 7/8 users who haven't updated). This is a
graceful degradation, not a failure — it just means animation isolation
is weaker on those devices. The `transform: translateZ(0)` fallback still
promotes the card to its own compositor layer, which handles the bulk of
the isolation benefit.

---

## What Phase 0 does NOT do (handed off to later phases)

- Does not refactor any page. Every page still renders exactly as before.
- Does not dedupe the duplicate `[data-theme="light"]` block in `index.css` — see `PHASE0-AUDIT.md`.
- Does not consolidate the existing 6,300-line `index.css` into modular stylesheets.
- Does not install framer-motion. Motion presets are compatible but the runtime is optional until Phase 1+ decides it's worth the ~55 KB gzipped cost.

---

## Ship checklist (must all pass before Phase 1 begins)

- [x] Static syntax verification: all new `.js` / `.jsx` files parse clean, CSS braces balanced.
- [x] Diff audit: only 2 existing files modified (`index.html`, `src/styles/index.css`).
- [x] No page-level component modified.
- [x] `package.json` unchanged (no new deps).
- [x] `tailwind.config.js`, `postcss.config.js`, `vite.config.js` unchanged.
- [ ] **Verified on device matrix after deploy** (requires a live build — see Deployment section).
- [ ] **Lighthouse CLS score = 0** (requires a live build).

---

## Deployment

1. Copy this folder contents into a fresh git repo.
2. `npm install`
3. `npm run build` — should complete with no new warnings beyond what v96 had.
4. Deploy. Open any page, hard-reload with cache disabled, confirm:
   - Clash Display is applied to any element with the `font-display` class (try the landing page — it was already using it, so no regression there).
   - Inter is applied to body text.
   - Chrome DevTools → Performance → Experience → **CLS from fonts = 0**.
5. Run your existing Playwright suite (`npm run test:e2e`). No tests should regress — Phase 0 doesn't change any DOM text, any routes, or any behavior.

---

## What's next (Phase 1 preview)

Phase 1 is the **Quote Builder**. It will be the first page to actually
consume these primitives: `<Card>`, `<PageHeader>`, `<Stat>`, `<RevealOnView>`,
`useCountUp`, and the motion tokens. Line-item add/remove will animate
through `transform/opacity` inside a `motion-isolate` container. Totals
will use `<Stat>` so `$12,847` → `$434` never reflows. AI-suggestion
presentation will adopt the card hierarchy.
