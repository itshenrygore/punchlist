import { useEffect, useRef } from 'react';
import useScrollLock from '../hooks/use-scroll-lock';

/**
 * OverlayShell — single shared overlay primitive.
 *
 * Props:
 *   open       — boolean, controls visibility
 *   onClose    — () => void, called on backdrop click or Escape
 *   variant    — 'modal' | 'drawer' | 'sheet' (default: 'modal')
 *   zIndex     — number (default: 200)
 *   className  — extra class on the content container
 *   children   — content
 *   label      — aria-label for the dialog
 */

/* ── Z-index tiers (standardized across the app) ──
 *   100  — base modals (confirm, send-quote)
 *   200  — search, scheduling, notifications
 *   250  — Foreman
 *   300  — booking drawer
 *   999  — mobile menu (always on top)
 */

const VARIANT_STYLES = {
  modal: {
    backdrop: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    content: { width: 'min(440px, 100%)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' },
  },
  drawer: {
    backdrop: { display: 'flex', justifyContent: 'flex-end' },
    content: { width: 400, maxWidth: '100%', height: '100%' },
  },
  sheet: {
    backdrop: { display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
    content: { width: '100%', maxHeight: '90vh', borderRadius: '16px 16px 0 0', overflowY: 'auto' },
  },
};

export default function OverlayShell({ open, onClose, variant = 'modal', zIndex = 200, className = '', children, label }) {
  const contentRef = useRef(null);
  useScrollLock(open);

  // Escape key
  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Focus trap (basic: focus content on open)
  useEffect(() => {
    if (open && contentRef.current) {
      const first = contentRef.current.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      first?.focus();
    }
  }, [open]);

  if (!open) return null;

  const v = VARIANT_STYLES[variant] || VARIANT_STYLES.modal;

  return (
    <div
      className="overlay-shell-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        background: 'rgba(0,0,0,.6)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'overlay-fade-in .15s ease',
        // Safe-area: pad content away from notches/home indicators
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
        ...v.backdrop,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        ref={contentRef}
        className={`overlay-shell-content ${className}`}
        style={{
          background: 'var(--panel, #232326)',
          border: '1px solid var(--line, rgba(255,255,255,0.06))',
          borderRadius: 'var(--r-lg, 16px)',
          boxShadow: 'var(--shadow-float, 0 12px 40px rgba(0,0,0,.4))',
          animation: variant === 'sheet' ? 'overlay-slide-up .2s ease' : variant === 'drawer' ? 'overlay-slide-right .2s ease' : 'overlay-scale-in .2s ease',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          ...v.content,
        }}
        role="dialog"
        aria-modal="true"
        aria-label={label || 'Dialog'}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
