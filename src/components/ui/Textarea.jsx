import { forwardRef, useRef, useCallback, useEffect, useImperativeHandle } from 'react';

/**
 * <Textarea> — Phase 2 primitive.
 *
 * Wraps a native <textarea> with:
 *   • Optional auto-grow (grows with content, up to maxH)
 *   • Char count display
 *   • Focus ring from design tokens
 *   • Error state
 *   • Optional label + hint text
 *   • Size variants matching Input (sm, md, lg)
 *
 * Usage:
 *   <Textarea label="Description" value={desc} onChange={setDesc} autoGrow charCount />
 *   <Textarea rows={4} placeholder="Notes for your records only" />
 */
const Textarea = forwardRef(function Textarea(
  {
    label,
    hint,
    error,
    size = 'md',
    autoGrow = false,
    charCount = false,
    maxLength,
    className = '',
    id,
    value,
    onChange,
    style,
    ...rest
  },
  ref
) {
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);

  const textareaId = id || (label ? `pl-textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  // ── Auto-grow ──
  const grow = useCallback(() => {
    const el = innerRef.current;
    if (!el || !autoGrow) return;
    el.style.height = 'auto';
    const maxH = Math.round(
      (typeof window !== 'undefined' ? window.innerHeight : 800) / 2
    );
    el.style.height = `${Math.min(el.scrollHeight, maxH)}px`;
  }, [autoGrow]);

  useEffect(() => { grow(); }, [value, grow]);

  const sizeClass = {
    sm: 'pl-textarea--sm',
    md: '',
    lg: 'pl-textarea--lg textarea-lg',
  }[size] || '';

  const classes = [
    'pl-textarea-field',
    'input',
    sizeClass,
    error ? 'pl-input--error' : '',
    autoGrow ? 'pl-textarea--auto' : '',
    className,
  ].filter(Boolean).join(' ');

  function handleChange(e) {
    if (typeof onChange === 'function') {
      // Support both onChange(value) and onChange(event) patterns
      onChange.length > 0 && typeof e === 'object' && e.target
        ? onChange(e.target.value)
        : onChange(e);
    }
  }

  const len = typeof value === 'string' ? value.length : 0;

  const textarea = (
    <textarea
      ref={innerRef}
      id={textareaId}
      className={classes}
      value={value}
      onChange={handleChange}
      aria-invalid={!!error}
      aria-describedby={error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined}
      maxLength={maxLength}
      style={style}
      {...rest}
    />
  );

  if (!label && !hint && !error && !charCount) return textarea;

  return (
    <div className="pl-textarea-wrap">
      {label && (
        <label className="pl-input-label" htmlFor={textareaId}>
          {label}
        </label>
      )}
      {textarea}
      {(charCount || error || hint) && (
        <div className="pl-textarea-footer">
          {error && (
            <div className="pl-input-error" id={`${textareaId}-error`} role="alert">
              {error}
            </div>
          )}
          {hint && !error && (
            <div className="pl-input-hint" id={`${textareaId}-hint`}>
              {hint}
            </div>
          )}
          {charCount && (
            <span className="pl-textarea-count">
              {len}{maxLength ? `/${maxLength}` : ''} chars
            </span>
          )}
        </div>
      )}
    </div>
  );
});

export default Textarea;
