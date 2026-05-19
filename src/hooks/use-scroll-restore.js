/* ═══════════════════════════════════════════════════════════
   useScrollRestore — preserve and restore scroll position
   v103 Phase 5: Scroll position preservation on back navigation

   Saves scrollY to sessionStorage keyed by route path when
   the component unmounts. On mount, restores the saved
   position after a short delay to let content render.

   Usage:
     useScrollRestore('/app/quotes');

   Design decisions:
   - Uses sessionStorage (survives refresh, cleared on tab close)
   - 100ms delay on restore to let lazy-loaded content settle
   - Only restores if the saved position is reasonable (< docHeight)
   - Cleans up stale entries automatically
   ═══════════════════════════════════════════════════════════ */

import { useEffect, useRef } from 'react';

const STORAGE_PREFIX = 'pl_scroll_';

export function useScrollRestore(routeKey) {
  const key = STORAGE_PREFIX + routeKey;
  const savedOnMount = useRef(false);

  useEffect(() => {
    // Restore scroll position on mount
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const y = parseInt(raw, 10);
        if (!isNaN(y) && y > 0) {
          // Delay to let content render (lazy-loaded lists, etc.)
          const timer = setTimeout(() => {
            // Only restore if the document is tall enough
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            if (y <= maxScroll + 100) { // +100px tolerance for slight layout differences
              window.scrollTo(0, y);
            }
            savedOnMount.current = true;
          }, 100);
          return () => clearTimeout(timer);
        }
      }
    } catch { /* sessionStorage blocked */ }

    savedOnMount.current = true;
    return undefined;
  }, [key]);

  // Save scroll position on unmount
  useEffect(() => {
    return () => {
      try {
        const y = window.scrollY;
        if (y > 10) {
          sessionStorage.setItem(key, String(Math.round(y)));
        } else {
          sessionStorage.removeItem(key);
        }
      } catch { /* sessionStorage blocked */ }
    };
  }, [key]);
}
