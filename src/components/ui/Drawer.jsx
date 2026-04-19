import { useEffect, useRef } from 'react';
import useScrollLock from '../../hooks/use-scroll-lock';

/**
 * <Drawer> — Phase 2 primitive.
 *
 * Bottom sheet on mobile, side panel on desktop.
 * Replaces hand-rolled drawer patterns in bookings, settings,
 * and the send flow.
 *
 * Features:
 *   • Slides up from bottom on mobile (< 768px)
 *   • Slides in from right on desktop
 *   • Scroll lock while open
 *   • Backdrop click to close
 *   • Escape key to close
 *   • Optional drag-to-dismiss handle (mobile)
 *
 * Usage:
 *   <Drawer open={showDetails} onClose={() => setShowDetails(false)} title="Details">
 *     <p>content</p>
 *   </Drawer>
 */
export default function Drawer({
  open,
  onClose,
  title,
  children,
  side = 'right',        // 'right' | 'bottom' (auto on mobile)
  width = 400,           // desktop width
  className = '',
  ...rest
}) {
  const panelRef = useRef(null);

  useScrollLock(open);

  // Escape key
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape' && onClose) {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Focus first focusable on open
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length) focusable[0].focus();
  }, [open]);

  if (!open) return null;

  const panelClasses = [
    'pl-drawer-panel',
    `pl-drawer-panel--${side}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      className="pl-drawer-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        className={panelClasses}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title || undefined}
        style={side === 'right' ? { width, maxWidth: '90vw' } : undefined}
        {...rest}
      >
        {/* Mobile drag handle */}
        <div className="pl-drawer-handle" aria-hidden="true">
          <div className="pl-drawer-handle-bar" />
        </div>

        {title && (
          <div className="pl-drawer-header">
            <h3 className="pl-drawer-title">{title}</h3>
            {onClose && (
              <button
                className="pl-modal-close"
                type="button"
                onClick={onClose}
                aria-label="Close"
              >
                ×
              </button>
            )}
          </div>
        )}
        <div className="pl-drawer-body">
          {children}
        </div>
      </div>
    </div>
  );
}
