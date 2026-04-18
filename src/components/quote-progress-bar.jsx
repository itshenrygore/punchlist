import { useState, useEffect, useRef } from 'react';
import { getPhase, getProgressSteps, getPrimaryAction, getSecondaryActions, getContextLine, getSignals, PHASES } from '../lib/workflow';

/* ═══════════════════════════════════════════════════════════════
 *  QuoteProgressBar
 *
 *  Replaces: StatusBadge + "Next step" text + scattered buttons.
 *
 *  Shows:
 *    1. Horizontal stepper (Draft → Sent → Approved → Active → Invoice → Done)
 *    2. Context line ("Customer viewed 3×, 2h ago")
 *    3. Signal badges (deposit pending, viewed, signed)
 *    4. ONE primary action button
 *    5. "⋯" overflow menu for secondary actions
 *
 *  Mobile (375px): stepper compacts, action goes sticky-bottom.
 * ═══════════════════════════════════════════════════════════════ */

export default function QuoteProgressBar({ quote, onAction }) {
  const phase = getPhase(quote);
  const steps = getProgressSteps(quote);
  const primary = getPrimaryAction(quote);
  const secondary = getSecondaryActions(quote);
  const context = getContextLine(quote);
  const signals = getSignals(quote);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close overflow on outside click/tap
  useEffect(() => {
    if (!menuOpen) return;
    function close(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  function handleAction(action) {
    setMenuOpen(false);
    if (onAction) onAction(action);
  }

  return (
    <>
      {/* ── Progress stepper ── */}
      <div className="qpb-stepper" role="progressbar" aria-label={`Quote progress: ${PHASES[phase]?.label || phase}`}>
        {steps.map((step, i) => (
          <div
            key={step.label}
            className={[
              'qpb-step',
              step.done    && 'qpb-step--done',
              step.current && 'qpb-step--current',
              step.variant === 'danger' && 'qpb-step--danger',
            ].filter(Boolean).join(' ')}
          >
            <div className="qpb-dot">
              {step.done ? (
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M2.5 6L5 8.5L9.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <span className="qpb-dot-inner" />
              )}
            </div>
            <span className="qpb-step-label">{step.label}</span>
            {i < steps.length - 1 && (
              <div className={`qpb-connector${step.done ? ' qpb-connector--done' : ''}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── Context + signals ── */}
      <div className="qpb-context">
        {context && <p className="qpb-context-text">{context}</p>}
        {signals.length > 0 && (
          <div className="qpb-signals">
            {signals.map((sig, i) => (
              <span key={i} className={`qpb-signal qpb-signal--${sig.tone}`}>
                <span className="qpb-signal-icon" aria-hidden="true">{sig.icon}</span>
                {sig.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Action bar ── */}
      <div className="qpb-actions">
        {primary && primary.action !== 'wait' && (
          <button
            type="button"
            className={`btn qpb-primary-btn ${
              primary.variant === 'primary' ? 'btn-primary' :
              primary.variant === 'warning' ? 'btn-warning' :
              'btn-secondary'
            }`}
            onClick={() => handleAction(primary.action)}
          >
            {primary.label}
          </button>
        )}

        {primary && primary.action === 'wait' && (
          <div className="qpb-waiting">
            <span className="qpb-waiting-dot" aria-hidden="true" />
            {primary.label}
          </div>
        )}

        {/* Overflow menu — state-managed, not <details> */}
        {secondary.length > 0 && (
          <div className="qpb-overflow" ref={menuRef}>
            <button
              className={`qpb-overflow-trigger${menuOpen ? ' qpb-overflow-trigger--open' : ''}`}
              onClick={() => setMenuOpen(v => !v)}
              aria-label="More actions"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              type="button"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <circle cx="4" cy="9" r="1.5" fill="currentColor"/>
                <circle cx="9" cy="9" r="1.5" fill="currentColor"/>
                <circle cx="14" cy="9" r="1.5" fill="currentColor"/>
              </svg>
            </button>
            {menuOpen && (
              <div className="qpb-overflow-menu" role="menu">
                {secondary.map(act => (
                  <button
                    key={act.action}
                    role="menuitem"
                    className={`qpb-overflow-item${act.destructive ? ' qpb-overflow-item--danger' : ''}`}
                    onClick={() => handleAction(act.action)}
                    type="button"
                  >
                    {act.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
