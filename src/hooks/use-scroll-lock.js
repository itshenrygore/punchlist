import { useEffect } from 'react';

/**
 * Locks body scroll when `active` is true.
 * Handles stacking (multiple overlays open) via a counter.
 * Restores original overflow when all locks are released.
 */
let lockCount = 0;
let savedOverflow = '';

export default function useScrollLock(active) {
  useEffect(() => {
    if (!active) return;
    if (lockCount === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    lockCount++;
    return () => {
      lockCount--;
      if (lockCount === 0) {
        document.body.style.overflow = savedOverflow;
      }
    };
  }, [active]);
}
