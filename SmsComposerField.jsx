/**
 * QbCoachmarks — Phase 3.5 Slice 9 (B11)
 *
 * A 3-step dismissible spotlight overlay shown to first-time users.
 * Gates on:
 *   - !localStorage.pl_has_sent_quote  (skip for users who already sent)
 *   - !localStorage.pl_coachmarks_dismissed (skip once dismissed)
 *
 * Steps spotlight three elements by ID:
 *   1. #qb-desc           — the description textarea
 *   2. #qb-line-items     — the line-items list container
 *   3. #qb-send-btn       — the Send button in the sticky footer
 *
 * Respects prefers-reduced-motion (no fade-in animation when set).
 * Renders null on server / before mount via isMounted pattern.
 */
import { useEffect, useRef, useState } from 'react';

const STEPS = [
  {
    targetId: 'qb-desc',
    title: 'Describe the job',
    body: 'Type or speak the job — AI builds the scope for you.',
  },
  {
    targetId: 'qb-line-items',
    title: 'Review items',
    body: 'Add, edit, or remove items. Prices are editable.',
  },
  {
    targetId: 'qb-send-btn',
    title: 'Send',
    body: 'Send as a text, email, or shareable link.',
  },
];

function getSpotlightRect(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const PAD = 8;
  return {
    top: r.top + window.scrollY - PAD,
    left: r.left + window.scrollX - PAD,
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
    elTop: r.top,
    elBottom: r.bottom,
    elLeft: r.left,
    elRight: r.right,
  };
}

export default function QbCoachmarks() {
  const [isMounted, setIsMounted] = useState(false);
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const reducedMotion = useRef(false);

  // isMounted guard — never render on server or before hydration
  useEffect(() => {
    setIsMounted(true);
    reducedMotion.current =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Decide whether to show coachmarks after mount
  useEffect(() => {
    if (!isMounted) return;
    try {
      const alreadySent = !!localStorage.getItem('pl_has_sent_quote');
      const dismissed = !!localStorage.getItem('pl_coachmarks_dismissed');
      if (!alreadySent && !dismissed) setShow(true);
    } catch {
      // localStorage unavailable (private mode etc.) — skip silently
    }
  }, [isMounted]);

  // Re-measure spotlight target when step changes
  useEffect(() => {
    if (!show) return;
    const measure = () => setRect(getSpotlightRect(STEPS[step].targetId));
    measure();
    // Also scroll the target into view
    const el = document.getElementById(STEPS[step].targetId);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
    };
  }, [show, step]);

  if (!isMounted || !show) return null;

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem('pl_coachmarks_dismissed', '1');
    } catch { /* ignore */ }
  }

  function advance() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      // Final step completed — mark dismissed too
      dismiss();
    }
  }

  const current = STEPS[step];

  // Tooltip positioning: prefer below the target; fall back to above.
  let tooltipStyle = { position: 'fixed', zIndex: 10002 };
  if (rect) {
    const BELOW_MARGIN = 16;
    const TOOLTIP_HEIGHT = 140; // rough estimate
    const spaceBelow = window.innerHeight - rect.elBottom;
    if (spaceBelow >= TOOLTIP_HEIGHT + BELOW_MARGIN) {
      tooltipStyle.top = rect.elBottom + BELOW_MARGIN;
    } else {
      tooltipStyle.bottom = window.innerHeight - rect.elTop + BELOW_MARGIN;
    }
    // Horizontal: align with target left, clamped to viewport
    const rawLeft = rect.elLeft;
    tooltipStyle.left = Math.max(12, Math.min(rawLeft, window.innerWidth - 280 - 12));
  } else {
    // Target not found — centre vertically
    tooltipStyle.top = '50%';
    tooltipStyle.left = '50%';
    tooltipStyle.transform = 'translate(-50%, -50%)';
  }

  const animClass = reducedMotion.current ? '' : 'qb-cm-fade-in';

  return (
    <>
      {/* Backdrop with spotlight cut-out via clip-path / box-shadow */}
      <div
        className="qb-cm-backdrop"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          backgroundColor: 'rgba(0,0,0,0.45)',
          pointerEvents: 'auto',
        }}
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Spotlight highlight box */}
      {rect && (
        <div
          style={{
            position: 'absolute',
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            zIndex: 10001,
            borderRadius: 6,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        />
      )}

      {/* Tooltip */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Step ${step + 1} of ${STEPS.length}: ${current.title}`}
        className={`qb-cm-tooltip ${animClass}`}
        style={tooltipStyle}
        onClick={e => e.stopPropagation()}
      >
        <div className="qb-cm-step-label">
          Step {step + 1} of {STEPS.length}
        </div>
        <div className="qb-cm-title">{current.title}</div>
        <div className="qb-cm-body">{current.body}</div>
        <div className="qb-cm-actions">
          <button
            type="button"
            className="qb-cm-skip"
            onClick={dismiss}
          >
            Skip
          </button>
          <button
            type="button"
            className="qb-cm-next btn btn-primary btn-sm"
            onClick={advance}
          >
            {step < STEPS.length - 1 ? 'Next →' : 'Got it ✓'}
          </button>
        </div>
      </div>
    </>
  );
}
