/* ═══════════════════════════════════════════════════════════
   useHideOnScroll — Auto-hide topbar on scroll down, show on scroll up
   v103 Phase 3: Viewport reclaim on mobile

   Tracks scroll direction and sets data-scrolled="down" on <html>
   when scrolling down past a threshold. CSS uses this to
   translateY(-100%) the topbar. On scroll up, it reappears.

   Design decisions:
   - Throttled via rAF — no per-pixel jank
   - Only active on mobile viewports (≤768px)
   - Skips when keyboard is open (data-keyboard="open") to avoid
     fighting with keyboard state changes
   - Near-top always shows (users expect to see nav at page top)
   - Cleans up data-scrolled on unmount and desktop resize
   ═══════════════════════════════════════════════════════════ */

import { useEffect, useRef } from 'react';

const SCROLL_THRESHOLD = 80; // px scrolled before hiding begins
const SCROLL_DELTA = 8;      // minimum px change to trigger show/hide

export function useHideOnScroll({ enabled = true } = {}) {
  const lastY = useRef(0);
  const ticking = useRef(false);
  const hidden = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    function isMobile() {
      return window.innerWidth <= 768;
    }

    function isKeyboardOpen() {
      return document.documentElement.getAttribute('data-keyboard') === 'open';
    }

    function show() {
      if (hidden.current) {
        document.documentElement.removeAttribute('data-scrolled');
        hidden.current = false;
      }
    }

    function hide() {
      if (!hidden.current) {
        document.documentElement.setAttribute('data-scrolled', 'down');
        hidden.current = true;
      }
    }

    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        ticking.current = false;

        // Desktop — always show, don't process scroll
        if (!isMobile()) {
          show();
          lastY.current = window.scrollY;
          return;
        }

        // Keyboard open — don't change topbar state to avoid
        // visual conflicts with keyboard hide/show animations
        if (isKeyboardOpen()) {
          lastY.current = window.scrollY;
          return;
        }

        const currentY = window.scrollY;
        const delta = currentY - lastY.current;

        if (currentY < SCROLL_THRESHOLD) {
          // Near top — always show
          show();
        } else if (delta > SCROLL_DELTA) {
          // Scrolling down — hide
          hide();
        } else if (delta < -SCROLL_DELTA) {
          // Scrolling up — show
          show();
        }

        lastY.current = currentY;
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      show(); // Always clean up
    };
  }, [enabled]);
}
