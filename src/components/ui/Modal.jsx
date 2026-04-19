import { useEffect, useRef } from 'react';
import useScrollLock from '../../hooks/use-scroll-lock';

/**
 * <Modal> — Phase 2 primitive.
 *
 * Unifies the 3 hand-rolled modal patterns:
 *   • .modal-overlay + .modal-content (dashboard, quote-detail)
 *   • .qb-modal-bg + .qb-modal (quote builder, send flow)
 *   • .sched-modal-overlay + .sched-modal (bookings)
 *
 * Features:
 *   • Scroll lock (body) while open
 *   • Focus trap (Tab cycles within modal)
 *   • Backdrop click to close (opt-out via `persistent`)
 *   • Escape key to close
 *   • Bottom-sheet on mobile (opt-in via `sheet`)
 *   • Entrance/exit animation via CSS classes
 *
 * Usage:
 *   <Modal open={showSend} onClose={() => setShowSend(false)} title="Send Quote">
 *     <p>content</p>
 *     <Modal.Actions>
 *       <button className="btn btn-primary">Confirm</button>
 *     </Modal.Actions>
 *   </Modal>
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 520,
  sheet = false,         // bottom sheet on mobile
  persistent = false,    // prevent backdrop click close
  className = '',
  ...rest
}) {
  const panelRef = useRef(null);

  // Scroll lock
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

  // Focus trap
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const el = panelRef.current;
    const focusable = el.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length) focusable[0].focus();

    function trapTab(e) {
      if (e.key !== 'Tab') return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    el.addEventListener('keydown', trapTab);
    return () => el.removeEventListener('keydown', trapTab);
  }, [open]);

  if (!open) return null;

  const panelClasses = [
    'pl-modal-panel',
    sheet ? 'pl-modal-panel--sheet' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      className="pl-modal-backdrop"
      onClick={persistent ? undefined : onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        className={panelClasses}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title || undefined}
        style={{ maxWidth }}
        {...rest}
      >
        {title && (
          <div className="pl-modal-header">
            <h3 className="pl-modal-title">{title}</h3>
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
        <div className="pl-modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * <Modal.Actions> — footer slot for action buttons.
 * Renders a flex row at the bottom of the modal body.
 */
Modal.Actions = function ModalActions({ children, className = '' }) {
  return (
    <div className={`pl-modal-actions ${className}`}>
      {children}
    </div>
  );
};
