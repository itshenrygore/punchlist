import { useEffect, useRef, useCallback } from 'react';
import useScrollLock from '../hooks/use-scroll-lock';

/**
 * ConfirmModal — shared confirmation dialog replacing all window.confirm/prompt calls.
 * Rugged Graphite design system. ~70 lines.
 *
 * Props:
 *   open: boolean
 *   onConfirm: () => void
 *   onCancel: () => void
 *   title: string
 *   message: string
 *   confirmLabel: string (default "Confirm")
 *   cancelLabel: string (default "Cancel")
 *   variant: 'default' | 'danger'
 */
export default function ConfirmModal({
  open,
  onConfirm,
  onCancel,
  title = 'Confirm',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
}) {
  const confirmRef = useRef(null);
  useScrollLock(open);

  // Auto-focus confirm button on open
  useEffect(() => {
    if (open && confirmRef.current) confirmRef.current.focus();
  }, [open]);

  // Keyboard: Escape to cancel, Enter to confirm
  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') { e.preventDefault(); onCancel?.(); }
    else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); onConfirm?.(); }
  }, [onCancel, onConfirm]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, handleKey]);

  if (!open) return null;

  const isDanger = variant === 'danger';

  return (
    <div className="modal-overlay" onClick={onCancel} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{title}</h3>
        {message && (
          <p style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.5, color: 'var(--muted)', whiteSpace: 'pre-line' }}>
            {message}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="qb-btn-ghost"
            onClick={onCancel}
            style={{ padding: '8px 18px', borderRadius: 'var(--r)', fontSize: 14, fontWeight: 600, cursor: 'pointer', background: 'var(--panel-3)', color: 'var(--text)', border: '1px solid var(--line)' }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            style={{
              padding: '8px 18px', borderRadius: 'var(--r)', fontSize: 14, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: isDanger ? '#ef4444' : 'var(--accent)', color: '#fff',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
