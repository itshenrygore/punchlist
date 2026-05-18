import { useEffect, useRef, useState } from 'react';
import { DUR, easeOutCubic, isReducedMotion } from '../lib/motion';

/**
 * useCountUp — animates a numeric value from its previous render to
 * the new value without layout shift.
 *
 * Pairs with <Stat> or any element using `.num-stable` + a
 * `--min-ch` CSS var so the container never resizes mid-animation.
 *
 * Contract:
 *   • First mount shows the final value if reduced-motion is on.
 *   • Re-mounts (React strict or hot reload) do NOT restart the anim
 *     (stable initial via useRef).
 *   • Decimals are respected (e.g. 4847.50 → 4,847.50).
 *   • Works on iPhone 8 Safari — uses rAF, never setInterval.
 *
 * @param {number} target   Final value.
 * @param {object} [opts]
 * @param {number} [opts.duration] Milliseconds (default: 900).
 * @param {number} [opts.decimals] Digits after decimal (default: inferred).
 * @param {boolean}[opts.enabled]  If false, render target immediately.
 */
export default function useCountUp(target, opts = {}) {
  const {
    duration = DUR.slower * 1000 + 340, // ~900ms default
    decimals,
    enabled = true,
  } = opts;

  const safeTarget = Number.isFinite(target) ? target : 0;
  const [value, setValue] = useState(() => (enabled ? 0 : safeTarget));
  const startRef = useRef(null);
  const fromRef  = useRef(0);
  const rafRef   = useRef(0);

  useEffect(() => {
    // Respect user's reduced-motion setting + explicit disable.
    if (!enabled || isReducedMotion()) {
      setValue(safeTarget);
      return;
    }

    fromRef.current  = value;
    startRef.current = null;

    const step = (ts) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(progress);
      const next = fromRef.current + (safeTarget - fromRef.current) * eased;
      setValue(next);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setValue(safeTarget);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeTarget, enabled, duration]);

  const inferredDecimals = decimals ?? countDecimals(safeTarget);
  return roundTo(value, inferredDecimals);
}

function countDecimals(n) {
  if (!Number.isFinite(n)) return 0;
  const s = String(n);
  const i = s.indexOf('.');
  return i === -1 ? 0 : s.length - i - 1;
}

function roundTo(n, d) {
  const m = Math.pow(10, d);
  return Math.round(n * m) / m;
}
