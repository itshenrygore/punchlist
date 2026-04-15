/* ═══════════════════════════════════════════════════════════════════
   PUNCHLIST — Design Tokens (Phase 0)
   SINGLE SOURCE OF TRUTH for fonts, type scale, motion, radii, spacing.
   Imported first in index.css. Cascade-safe with existing tokens.
   ─────────────────────────────────────────────────────────────────────
   Rule: nothing in this file changes existing visual output. It only
   establishes stable variables and metric-matched font fallbacks so
   later phases consume a consistent system and CLS stays at zero.
   ═══════════════════════════════════════════════════════════════════ */

/* ───────────────────────────────────────────────────────────────
   FONT FACES — CLS-safe fallbacks via size-adjust
   ─────────────────────────────────────────────────────────────
   Fontshare serves Clash Display + Satoshi. Google serves Inter.
   We declare local-only fallback faces whose metrics are adjusted
   to match the real fonts, so when the WOFF2 swaps in, layout
   doesn't shift. Values derived from f-mod tooling.
   ─────────────────────────────────────────────────────────────── */

@font-face {
  font-family: 'Clash Display Fallback';
  src: local('Arial Black'), local('Helvetica Neue Bold'), local('Arial Bold');
  font-weight: 500 800;
  font-style: normal;
  size-adjust: 96%;
  ascent-override: 94%;
  descent-override: 23%;
  line-gap-override: 0%;
}

@font-face {
  font-family: 'Inter Fallback';
  src: local('Arial'), local('Helvetica Neue'), local('Helvetica');
  font-weight: 100 900;
  font-style: normal;
  size-adjust: 107%;
  ascent-override: 90%;
  descent-override: 22%;
  line-gap-override: 0%;
}

/* ───────────────────────────────────────────────────────────────
   DESIGN TOKENS
   Scoped to :root so they merge with existing tokens in index.css
   without overriding visual colors (those stay authoritative in
   index.css until Phase 6 consolidates them here).
   ─────────────────────────────────────────────────────────────── */

:root {
  /* ── Typography stacks ────────────────────────────────────── */
  --font-display:
    'Clash Display', 'Clash Display Fallback',
    -apple-system, BlinkMacSystemFont, 'SF Pro Display',
    'Segoe UI', system-ui, sans-serif;

  --font-body:
    'Inter', 'Inter Fallback',
    -apple-system, BlinkMacSystemFont, 'SF Pro Text',
    'Segoe UI', system-ui, sans-serif;

  --font-mono:
    ui-monospace, SFMono-Regular, 'SF Mono', Menlo,
    Consolas, 'Liberation Mono', monospace;

  /* ── Unified type scale (body-oriented; display uses larger sizes) ─
     Existing --fs-* tokens in index.css remain the authority for
     component-level sizing. The --text-* tokens below are the
     forward-facing scale for Phase 1+ primitives.             */
  --text-2xs: 0.6875rem;   /* 11px */
  --text-xs:  0.75rem;     /* 12px */
  --text-sm:  0.8125rem;   /* 13px */
  --text-base:0.875rem;    /* 14px */
  --text-md:  0.9375rem;   /* 15px */
  --text-lg:  1rem;        /* 16px */
  --text-xl:  1.125rem;    /* 18px */
  --text-2xl: 1.25rem;     /* 20px */
  --text-3xl: 1.5rem;      /* 24px */
  --text-4xl: 1.875rem;    /* 30px */
  --text-5xl: 2.25rem;     /* 36px */
  --text-6xl: 3rem;        /* 48px */
  --text-7xl: 3.75rem;     /* 60px */

  /* ── Line heights (paired with type scale) ────────────────── */
  --lh-tight:   1.1;
  --lh-snug:    1.25;
  --lh-normal:  1.5;
  --lh-relaxed: 1.625;

  /* ── Letter spacing (display tightens, body neutral) ──────── */
  --tracking-tighter: -0.03em;
  --tracking-tight:   -0.02em;
  --tracking-normal:  -0.005em;
  --tracking-loose:   0.02em;

  /* ── Spacing rhythm (forward-facing, 4px base) ────────────── */
  --space-0:  0;
  --space-1:  0.25rem;  /* 4  */
  --space-2:  0.5rem;   /* 8  */
  --space-3:  0.75rem;  /* 12 */
  --space-4:  1rem;     /* 16 */
  --space-5:  1.25rem;  /* 20 */
  --space-6:  1.5rem;   /* 24 */
  --space-8:  2rem;     /* 32 */
  --space-10: 2.5rem;   /* 40 */
  --space-12: 3rem;     /* 48 */
  --space-16: 4rem;     /* 64 */
  --space-20: 5rem;     /* 80 */
  --space-24: 6rem;     /* 96 */

  /* ── Warm-tint shadow ladder (layered depth, no flat sections) ── */
  --elev-0: none;
  --elev-1: 0 1px 2px rgba(28, 20, 12, 0.04),
            0 1px 3px rgba(28, 20, 12, 0.06);
  --elev-2: 0 2px 4px rgba(28, 20, 12, 0.05),
            0 4px 10px rgba(28, 20, 12, 0.07);
  --elev-3: 0 4px 8px rgba(28, 20, 12, 0.06),
            0 10px 24px rgba(28, 20, 12, 0.09);
  --elev-4: 0 6px 14px rgba(28, 20, 12, 0.08),
            0 18px 40px rgba(28, 20, 12, 0.12);
  --elev-hover:
            0 4px 10px rgba(28, 20, 12, 0.06),
            0 12px 28px rgba(28, 20, 12, 0.10);

  /* ── Motion curves & durations (system-wide) ──────────────── */
  --ease-standard: cubic-bezier(0.32, 0.72, 0, 1);      /* primary UI curve */
  --ease-emphasis: cubic-bezier(0.22, 1, 0.36, 1);      /* entrance/exits */
  --ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1);   /* playful tap */
  --ease-out:      cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in:       cubic-bezier(0.7, 0, 0.84, 0);

  --dur-instant: 80ms;
  --dur-fast:    140ms;
  --dur-base:    220ms;
  --dur-slow:    360ms;
  --dur-slower:  560ms;

  --stagger-step: 60ms;  /* children delay increment */

  /* ── Focus ring (accessible + brand-tinted) ──────────────── */
  --ring:       0 0 0 3px var(--brand-glow, rgba(249, 115, 22, 0.20));
  --ring-focus: 0 0 0 3px rgba(249, 115, 22, 0.35);

  /* ── Container widths ─────────────────────────────────────── */
  --container-sm: 640px;
  --container-md: 768px;
  --container-lg: 1024px;
  --container-xl: 1200px;
  --container-2xl:1320px;
}

/* ───────────────────────────────────────────────────────────────
   LIGHT-MODE SHADOW TINT ADJUSTMENT
   On warm off-white bg, shadows want slightly warmer tint.
   ─────────────────────────────────────────────────────────────── */
[data-theme="light"] {
  --elev-1: 0 1px 2px rgba(40, 28, 16, 0.05),
            0 1px 3px rgba(40, 28, 16, 0.07);
  --elev-2: 0 2px 5px rgba(40, 28, 16, 0.06),
            0 5px 12px rgba(40, 28, 16, 0.08);
  --elev-3: 0 4px 10px rgba(40, 28, 16, 0.07),
            0 12px 28px rgba(40, 28, 16, 0.10);
  --elev-4: 0 6px 16px rgba(40, 28, 16, 0.09),
            0 20px 44px rgba(40, 28, 16, 0.13);
  --elev-hover:
            0 4px 12px rgba(40, 28, 16, 0.07),
            0 14px 32px rgba(40, 28, 16, 0.11);
}

/* ───────────────────────────────────────────────────────────────
   UTILITY CLASSES (Phase 0 — additive only)
   ─────────────────────────────────────────────────────────────── */

/* Display font — use on headings across the app for consistency */
.font-display {
  font-family: var(--font-display);
  letter-spacing: var(--tracking-tight);
  font-feature-settings: 'ss01', 'ss02', 'cv01';
}

/* Tabular numerics — use on any count-up or monetary display to
   prevent width jumping as digits change. Pair with min-width. */
.tabular {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum';
}

/* Stable-width number container. Pair with --min-ch custom prop.
   Example: <span class="num-stable" style="--min-ch: 8ch">$12,847</span> */
.num-stable {
  display: inline-block;
  min-width: var(--min-ch, 6ch);
  text-align: inherit;
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum';
}

/* Animation isolation — apply to any container that holds animated
   elements so layout NEVER reflows around transform/opacity motion. */
.motion-isolate {
  position: relative;
  contain: layout paint;
  transform: translateZ(0);  /* promote to own layer; prevents paint leaks */
  will-change: auto;         /* promote only per-element, not the container */
}

/* Stable min-height helper for cards containing dynamic content */
.min-stable { min-height: var(--min-h, auto); }

/* Hide visually but keep for screen readers */
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Skip-to-main navigation link — hidden until focused by keyboard */
.skip-to-main {
  position: absolute;
  top: -100%;
  left: var(--space-4);
  z-index: 9999;
  padding: var(--space-2) var(--space-4);
  background: var(--brand);
  color: #fff;
  font-size: var(--text-sm);
  font-weight: 700;
  border-radius: 0 0 var(--r-sm) var(--r-sm);
  text-decoration: none;
  transition: top var(--dur-fast) var(--ease-standard);
}
.skip-to-main:focus {
  top: 0;
  outline: 3px solid #fff;
  outline-offset: 2px;
}

/* ───────────────────────────────────────────────────────────────
   REDUCED-MOTION SAFETY
   Anything that uses .motion-* classes respects user preference.
   Phase 1+ components consume these automatically.
   ─────────────────────────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  :root {
    --dur-instant: 0ms;
    --dur-fast:    0ms;
    --dur-base:    0ms;
    --dur-slow:    0ms;
    --dur-slower:  0ms;
    --stagger-step: 0ms;
  }
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
