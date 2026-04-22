import { useEffect, useRef } from 'react';
import SignaturePad from './signature-pad';
import useScrollLock from '../hooks/use-scroll-lock';

/**
 * SignatureModal — Phase 2 wrapper around <SignaturePad/>.
 *
 * Structural change introduced in Phase 2: approval flow is now a focus-
 * trapped modal overlay rather than an inline block. SignaturePad itself
 * (canvas/drawing internals, Draw/Type tabs, handleSave payload shape)
 * is unchanged — this component only owns the presentation shell.
 *
 * Motion contract:
 *   • Enter: opacity 0→1 + transform scale(.96)→scale(1). No height/width
 *     animation, no layout shift of siblings.
 *   • Exit: reverse of enter, shorter duration.
 *   • Respects prefers-reduced-motion via the CSS class (snaps to final).
 *
 * A11y contract:
 *   • role="dialog" aria-modal="true" aria-labelledby on the title.
 *   • Focus moved into the dialog on open, restored on close.
 *   • Focus trap — Tab cycles inside the dialog only.
 *   • Escape closes, backdrop click closes.
 *   • Body scroll locked while open (stacks safely with ActionSheet).
 */
export default function SignatureModal({
  open,
  onClose,
  onSave,
  sending,
  error,
  contractorName,
  displayTotal,
  currency,
  hasTerms,
  termsAccepted,
  defaultName,
}) {
  const dialogRef = useRef(null);
  const firstFocusableRef = useRef(null);
  const returnFocusRef = useRef(null);

  useScrollLock(Boolean(open));

  // Capture the element to return focus to on close.
  useEffect(() => {
    if (open) {
      returnFocusRef.current = typeof document !== 'undefined' ? document.activeElement : null;
    } else if (returnFocusRef.current && typeof returnFocusRef.current.focus === 'function') {
      try { returnFocusRef.current.focus(); } catch (e) { /* element may have unmounted */ }
    }
  }, [open]);

  // ESC closes + focus trap (Tab / Shift+Tab cycle inside dialog).
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll(
          'button, [href], input, textarea, select, canvas, [tabindex]:not([tabindex="-1"])'
        );
        const list = Array.from(focusables).filter(el => !el.disabled && el.offsetParent !== null);
        if (list.length === 0) return;
        const first = list[0];
        const last = list[list.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  // Initial focus — nudge focus into the dialog after enter animation
  // kicks off (matching ActionSheet's 350 ms pattern for iOS keyboard).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const target = firstFocusableRef.current
        || dialogRef.current?.querySelector('input, textarea, button');
      try { target?.focus(); } catch (e) { /* noop */ }
    }, 80);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="pl-sig-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pl-sig-modal-title"
      onClick={onClose}
    >
      <div
        className="pl-sig-modal"
        ref={dialogRef}
        onClick={e => e.stopPropagation()}
      >
        <div className="pl-sig-modal-head">
          <h2 id="pl-sig-modal-title" className="pl-sig-modal-title font-display">
            Approve &amp; sign
          </h2>
          <button
            type="button"
            className="pl-sig-modal-close"
            aria-label="Close signature dialog"
            onClick={onClose}
            ref={firstFocusableRef}
          >
            ✕
          </button>
        </div>

        <div className="pl-sig-modal-total" aria-live="polite">
          <span className="pl-sig-modal-total-label">You are approving</span>
          <strong className="pl-sig-modal-total-val tabular">{currency(displayTotal)}</strong>
        </div>

        <div className="pl-sig-modal-body">
          <SignaturePad
            onSave={onSave}
            onCancel={onClose}
            hasTerms={hasTerms}
            termsAccepted={termsAccepted}
            saveLabel={sending ? 'Signing…' : 'Sign & Approve Quote'}
            legalText={`By signing, you authorize ${contractorName} to proceed with the work described above at the quoted price.`}
            defaultName={defaultName}
          />
          {error && (
            <div className="pl-sig-modal-error" role="alert">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
