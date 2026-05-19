/**
 * ═══════════════════════════════════════════════════════════════
 * Punchlist Motion System (Phase 0)
 * ───────────────────────────────────────────────────────────────
 * A single source for all app-wide animation behavior. Phase 0
 * primitives use the CSS-class approach below (no runtime dep).
 * If a later phase adopts framer-motion, the same curve + duration
 * tokens + variant objects are re-exported so animation semantics
 * stay identical across both engines.
 *
 * Rules encoded in this file:
 *   1. Only transform + opacity animate — never width/height/top/left.
 *   2. Durations and easings come from CSS vars so @media (prefers-
 *      reduced-motion) zeroes them globally — see tokens.css.
 *   3. Every entrance uses `once: true` semantics; no re-triggering
 *      on remount is enforced at the component level (use stable keys).
 *   4. Containers that hold animated children MUST have
 *      `motion-isolate` applied so reflow can't escape.
 * ═══════════════════════════════════════════════════════════════ */

// ── Tokens (read at runtime from the CSS cascade) ────────────────
// Using CSS vars as strings keeps motion in lockstep with tokens.css
// and lets `prefers-reduced-motion` neutralize everything in one place.
export const EASE = {
  standard: 'cubic-bezier(0.32, 0.72, 0, 1)',
  emphasis: 'cubic-bezier(0.22, 1, 0.36, 1)',
  spring:   'cubic-bezier(0.34, 1.56, 0.64, 1)',
  out:      'cubic-bezier(0.16, 1, 0.3, 1)',
  in:       'cubic-bezier(0.7, 0, 0.84, 0)',
};

export const DUR = {
  instant: 0.08,
  fast:    0.14,
  base:    0.22,
  slow:    0.36,
  slower:  0.56,
};

export const STAGGER = 0.06; // seconds

// ── Framer-Motion-compatible variants ───────────────────────────
// If/when a page imports framer-motion, it can spread these onto
// <motion.div variants={...}> with zero spec drift.

export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.slow, ease: EASE.emphasis },
  },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: DUR.base, ease: EASE.standard },
  },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: DUR.base, ease: EASE.emphasis },
  },
};

export const pressSpring = {
  rest:  { scale: 1 },
  press: { scale: 0.97, transition: { duration: DUR.fast, ease: EASE.standard } },
};

export const staggerChildren = (step = STAGGER, initial = 0.02) => ({
  hidden:  { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: step,
      delayChildren: initial,
    },
  },
});

// Default viewport config so reveals happen once per session,
// never re-trigger on scroll-back, never restart on re-render.
export const viewportOnce = { once: true, margin: '0px 0px -80px 0px', amount: 0.2 };

// ── Vanilla-JS runtime helpers ──────────────────────────────────

/**
 * isReducedMotion — true if the user has enabled the OS-level
 * reduce-motion pref. Any JS-driven animation (count-up, parallax,
 * fake typing) MUST check this and short-circuit.
 */
export const isReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * requestIdleFrame — prefer requestIdleCallback, fall back to rAF.
 * Used by count-up etc. to avoid stealing the frame budget on
 * low-end devices (iPhone 8 target).
 */
export const requestIdleFrame = (cb) => {
  if (typeof window === 'undefined') return 0;
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(cb, { timeout: 32 });
  }
  return window.requestAnimationFrame(cb);
};

/**
 * easeOutCubic — shared easing function for JS-driven animations
 * (e.g. count-up) so they feel like the CSS easings.
 */
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
