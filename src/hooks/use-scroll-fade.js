/* ═══════════════════════════════════════════════════════════
   useScrollFade — horizontal scroll affordance indicator
   v103 Phase 4: Status pills + settings tabs scroll hint

   Toggles CSS classes on a scrollable container to control
   gradient masks that hint at off-screen content:

   - No class        → right fade only (default: content to the right)
   - .scrolled-mid   → both left AND right fade (content both sides)
   - .scrolled-end   → no fade (all the way right, or no overflow)

   CSS uses these to apply/remove -webkit-mask-image gradients.

   Usage:
     const ref = useScrollFade();
     <div className="pl-tabstrip" ref={ref}>...</div>
   ═══════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef } from 'react';

const TOLERANCE = 20; // px tolerance for "at edge" detection

export function useScrollFade() {
  const ref = useRef(null);

  const check = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    const noOverflow = el.scrollWidth <= el.clientWidth + 1; // +1 for sub-pixel rounding
    const atStart = el.scrollLeft <= TOLERANCE;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - TOLERANCE;

    // Remove all state classes first
    el.classList.remove('scrolled-end', 'scrolled-mid');

    if (noOverflow || (atStart && atEnd)) {
      // All content fits — no mask needed
      el.classList.add('scrolled-end');
    } else if (atEnd) {
      // Scrolled to the right edge — no right fade needed
      el.classList.add('scrolled-end');
    } else if (!atStart) {
      // In the middle — content on both sides
      el.classList.add('scrolled-mid');
    }
    // else: at start, not at end → default CSS applies (right fade only)
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Initial check — delayed one frame so layout is settled
    const raf = requestAnimationFrame(check);

    el.addEventListener('scroll', check, { passive: true });

    // ResizeObserver catches container size changes
    const ro = new ResizeObserver(check);
    ro.observe(el);

    // MutationObserver catches child additions/removals
    // (e.g. filter pill count badges updating, tabs added/removed)
    const mo = new MutationObserver(check);
    mo.observe(el, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('scroll', check);
      ro.disconnect();
      mo.disconnect();
    };
  }, [check]);

  return ref;
}
