/* ═══════════════════════════════════════════════════════════
   useKeyboardVisible — iOS/Android virtual keyboard detection
   v103 Phase 3: Sticky bar consolidation + keyboard handling

   Uses visualViewport API to detect when the software keyboard
   is open. Sets data-keyboard="open" on <html> so CSS can
   hide bottom nav, send bars, and other fixed elements.

   Edge cases handled:
   - Device rotation: baseHeight recalculates on orientationchange
   - Desktop: only activates on viewports ≤ 768px
   - iOS URL bar collapse: threshold set to 0.70 to avoid false
     positives when the URL bar collapses (~50px on iPhone)
   - Cleanup: always resets data-keyboard on unmount
   ═══════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react';

// Keyboard occupies ~30-50% of screen height on most devices.
// 0.70 avoids false positives from iOS URL bar collapse (~7% of viewport).
const KEYBOARD_THRESHOLD = 0.70;

export function useKeyboardVisible() {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const baseHeight = useRef(window.innerHeight);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return; // Unsupported browser — degrade gracefully

    // Only activate on mobile-width viewports
    function isMobile() {
      return window.innerWidth <= 768;
    }

    let rafId = null;

    function onResize() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!isMobile()) {
          // Desktop — always closed
          if (document.documentElement.getAttribute('data-keyboard') === 'open') {
            document.documentElement.setAttribute('data-keyboard', 'closed');
            setKeyboardVisible(false);
          }
          return;
        }

        const isOpen = vv.height < baseHeight.current * KEYBOARD_THRESHOLD;
        setKeyboardVisible(prev => {
          if (prev !== isOpen) {
            document.documentElement.setAttribute('data-keyboard', isOpen ? 'open' : 'closed');
            return isOpen;
          }
          return prev;
        });
      });
    }

    // Recalculate base height on orientation change / window resize
    // This prevents false positives when rotating from portrait to landscape
    function onOrientationChange() {
      // Wait for the resize to settle (orientation change fires before resize)
      setTimeout(() => {
        baseHeight.current = window.innerHeight;
      }, 300);
    }

    // Initial state
    document.documentElement.setAttribute('data-keyboard', 'closed');

    vv.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onOrientationChange);
    // Also catch desktop window resizes that change innerHeight
    window.addEventListener('resize', onOrientationChange);

    return () => {
      vv.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onOrientationChange);
      window.removeEventListener('resize', onOrientationChange);
      if (rafId) cancelAnimationFrame(rafId);
      document.documentElement.setAttribute('data-keyboard', 'closed');
    };
  }, []);

  return { keyboardVisible };
}
