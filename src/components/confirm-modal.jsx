import { useEffect, useRef, useCallback } from 'react';
import useScrollLock from '../hooks/use-scroll-lock';

/**
 * ConfirmModal — shared confirmation dialog replacing all window.confirm/prompt calls.
 * Rugged Graphite design system. ~70 lines.
 *
 * Props:
 * open: boolean
 * onConfirm: () => void
 * onCancel: () => void
 * title: string
 * message: string
 * confirmLabel: string (default "Confirm")
 * cancelLabel: string (default "Cancel")
 * variant: 'default' | 'danger'
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
 const cancelRef = useRef(null);
 useScrollLock(open);

 // Auto-focus: cancel for danger actions (safety), confirm for normal
 useEffect(() => {
 if (open) {
 if (variant === 'danger' && cancelRef.current) cancelRef.current.focus();
 else if (confirmRef.current) confirmRef.current.focus();
 }
 }, [open, variant]);

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

 retumodal-content cm-s0-50fa className="modal-overlay" onClick={onCancel} role="dialog" aria-modal="true" aria-label={title}>
 <div className="modal-content" onClick={(e) => e.stopPropagation()} >
 <h3 className="cm-fs-xl-3581">{title}</h3>
 {message && (
 <p className="cm-fs-base-7a67">
 {message}
 </p>
 )}
 <div className="cm-flex-dba1">
 <button
 ref={cqb-btn-ghost cm-fs-base-f664 type="button"
 className="qb-btn-ghost"
 onClick={onCancel}
 
 >
 {cancelLabel}
 </button>
 <button
 ref={confirmRef}
 type="button"
 onClick={onConfirm}
 style={{
 padding: '8px 18px', borderRadius: 'var(--r)', fontSize: 'var(--text-base)', fontWeight: 600, cursor: 'pointer', border: 'none',
 background: isDanger ? 'var(--red)' : 'var(--accent)', color: 'var(--always-white, #fff)',
}}>
 {confirmLabel}
 </button>
 </div>
 </div>
 </div>
 );
}
