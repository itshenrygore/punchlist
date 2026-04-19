// ═══════════════════════════════════════════════════════════════════════════
// PUNCHLIST — SmsComposerField (UX-055)
// Extracted from followup-modal.jsx. Reusable SMS composition textarea with:
//   - Character counter
//   - SMS-segment-boundary awareness (160 / 320 thresholds)
//   - "Quote link added automatically" helper (conditionally shown)
//   - prefers-reduced-motion respected via motion.js
//
// Props:
//   id         (string)  — for label association
//   value      (string)  — controlled value
//   onChange   (fn)      — (nextValue: string) => void
//   rows       (number)  — textarea rows, default 5
//   label      (string)  — visible label text, default 'Message'
//   showLinkHint (bool)  — show "Quote link is added automatically" hint, default true
//   autoFocus  (bool)    — focus textarea on mount, default false
//   disabled   (bool)    — pass-through
//   className  (string)  — extra class on the root wrapper
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef } from 'react';
import { DUR, isReducedMotion } from '../../lib/motion';

// GSM-7 segment boundaries
const WARN_CHARS = 160;  // 2-segment threshold
const CAP_CHARS  = 320;  // hard display cap (3 segments would be unusual; we match followup-modal)

function segmentLabel(len) {
  if (len >= CAP_CHARS)  return 'At limit';
  if (len >= WARN_CHARS) return '2 SMS segments';
  return null;
}

export default function SmsComposerField({
  id = 'sms-composer',
  value = '',
  onChange,
  rows = 5,
  label = 'Message',
  showLinkHint = true,
  autoFocus = false,
  disabled = false,
  className = '',
}) {
  const textareaRef = useRef(null);
  const len = value.length;

  // Auto-focus with motion-respecting delay (mirrors followup-modal pattern)
  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(
      () => textareaRef.current?.focus(),
      isReducedMotion() ? 0 : DUR.SHORT * 1000,
    );
    return () => clearTimeout(t);
  }, [autoFocus]);

  const segment   = segmentLabel(len);
  const countColor =
    len > 280 ? 'var(--red)'
    : len > 160 ? 'var(--amber)'
    : 'var(--muted)';

  const hint = segment
    ?? (showLinkHint ? 'Quote link is added automatically if missing' : null);

  return (
    <div className={`sms-composer-field${className ? ` ${className}` : ''}`}>
      <label className="sms-composer-field__label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        ref={textareaRef}
        className="jd-input jd-textarea sms-composer-field__textarea"
        value={value}
        onChange={e => onChange?.(e.target.value.slice(0, CAP_CHARS))}
        rows={rows}
        maxLength={CAP_CHARS}
        disabled={disabled}
      />
      <div className="sms-composer-field__char-row">
        {hint && (
          <span
            className="sms-composer-field__hint"
            style={{ color: segment ? (len >= CAP_CHARS ? 'var(--red)' : 'var(--amber)') : undefined }}
          >
            {hint}
          </span>
        )}
        <span
          className="sms-composer-field__count"
          style={{ color: countColor }}
          aria-live="polite"
          aria-atomic="true"
        >
          {len}/{CAP_CHARS}
        </span>
      </div>
    </div>
  );
}
