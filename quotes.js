import { useEffect } from 'react';

/**
 * Locks body scroll when `active` is true.
 * Handles stacking (multiple overlays open) via a counter.
 * - Mobile/touch: position:fixed technique (prevents iOS momentum scrolling)
 * - Desktop: overflow:hidden (preserves scroll inside overlay panels)
 */
let lockCount = 0;
let savedScrollY = 0;
let savedStyles = {};

const isTouchDevice = () =>
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

export default function useScrollLock(active) {
  useEffect(() => {
    if (!active) return;
    if (lockCount === 0) {
      savedScrollY = window.scrollY;
      savedStyles = {
        overflow: document.body.style.overflow,
        position: document.body.style.position,
        top: document.body.style.top,
        width: document.body.style.width,
      };
      if (isTouchDevice()) {
        // iOS Safari: overflow:hidden alone doesn't prevent momentum scrolling
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${savedScrollY}px`;
        document.body.style.width = '100%';
      } else {
        // Desktop: just hide overflow — position:fixed breaks nested scroll
        document.body.style.overflow = 'hidden';
      }
    }
    lockCount++;
    return () => {
      lockCount--;
      if (lockCount === 0) {
        document.body.style.overflow = savedStyles.overflow;
        document.body.style.position = savedStyles.position;
        document.body.style.top = savedStyles.top;
        document.body.style.width = savedStyles.width;
        if (isTouchDevice()) {
          window.scrollTo(0, savedScrollY);
        }
      }
    };
  }, [active]);
}
