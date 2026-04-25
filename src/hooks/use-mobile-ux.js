/* ═══════════════════════════════════════════════════════════
   Mobile UX Utilities
   Haptic feedback, scroll-to-top, pull-to-refresh
   ═══════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef } from 'react';

/* ── Haptic feedback (vibration API) ── */
export function haptic(style = 'light') {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    const patterns = {
      light: [8],
      medium: [15],
      heavy: [25],
      success: [10, 50, 10],
      error: [20, 40, 20, 40, 20],
      selection: [5],
    };
    navigator.vibrate(patterns[style] || patterns.light);
  } catch (e) { console.warn("[PL]", e); }
}

/* ── Scroll to top on header tap ── */
export function useScrollToTop(headerRef) {
  useEffect(() => {
    const el = headerRef?.current;
    if (!el) return;
    let lastTap = 0;
    function handleTap(e) {
      // Only trigger on the header bar itself, not child buttons
      if (e.target.closest('button, a, input')) return;
      const now = Date.now();
      if (now - lastTap < 300) {
        // Double-tap: scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        haptic('light');
      }
      lastTap = now;
    }
    el.addEventListener('click', handleTap, { passive: true });
    return () => el.removeEventListener('click', handleTap);
  }, [headerRef]);
}

/* ── Pull to refresh ── */
export function usePullToRefresh(onRefresh, { threshold = 80, enabled = true } = {}) {
  const startY = useRef(0);
  const pulling = useRef(false);
  const indicator = useRef(null);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    // Only enable when scrolled to top
    function onTouchStart(e) {
      if (window.scrollY > 5) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
    function onTouchMove(e) {
      if (!pulling.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy < 0) { pulling.current = false; return; }
      if (dy > 10 && !indicator.current) {
        indicator.current = document.createElement('div');
        indicator.current.className = 'ptr-indicator';
        indicator.current.textContent = '↓';
        document.body.prepend(indicator.current);
      }
      if (indicator.current) {
        const progress = Math.min(dy / threshold, 1);
        indicator.current.style.transform = `translateY(${Math.min(dy * 0.4, 60)}px) rotate(${progress * 180}deg)`;
        indicator.current.style.opacity = progress;
        if (progress >= 1) indicator.current.textContent = '↻';
      }
    }
    function onTouchEnd(e) {
      if (!pulling.current) return;
      pulling.current = false;
      const dy = (e.changedTouches?.[0]?.clientY || 0) - startY.current;
      if (indicator.current) {
        indicator.current.remove();
        indicator.current = null;
      }
      if (dy >= threshold) {
        haptic('medium');
        onRefreshRef.current?.();
      }
    }
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [threshold, enabled]);
}
