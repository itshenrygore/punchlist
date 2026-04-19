import { forwardRef } from 'react';

/**
 * <Input> — Phase 2 primitive.
 *
 * Wraps a native <input> with:
 *   • Consistent sizing via `size` prop (sm, md, lg)
 *   • Focus ring from design tokens (orange glow)
 *   • Error state (red border + message)
 *   • Optional label + hint text
 *   • Dense variant for compact table rows
 *
 * Replaces raw <input className="input"> throughout the app.
 *
 * Usage:
 *   <Input label="Phone" value={phone} onChange={setPhone} error="Required" />
 *   <Input size="sm" placeholder="Search…" icon={<Search size={14} />} />
 */
const Input = forwardRef(function Input(
  {
    label,
    hint,
    error,
    size = 'md',           // 'sm' | 'md' | 'lg'
    dense = false,         // compact table variant
    icon,                  // left icon element
    suffix,                // right element (unit label, button)
    className = '',
    id,
    style,
    ...rest
  },
  ref
) {
  const inputId = id || (label ? `pl-input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  const sizeClass = {
    sm: 'pl-input--sm',
    md: '',
    lg: 'pl-input--lg',
  }[size] || '';

  const classes = [
    'pl-input-field',
    'input',                // existing .input class for backward compat
    sizeClass,
    dense ? 'input--dense' : '',
    error ? 'pl-input--error' : '',
    icon ? 'pl-input--has-icon' : '',
    className,
  ].filter(Boolean).join(' ');

  const input = (
    <input
      ref={ref}
      id={inputId}
      className={classes}
      aria-invalid={!!error}
      aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
      style={style}
      {...rest}
    />
  );

  // No label — return bare input (optionally with icon/suffix wrapper)
  if (!label && !hint && !error && !icon && !suffix) return input;

  return (
    <div className="pl-input-wrap">
      {label && (
        <label className="pl-input-label" htmlFor={inputId}>
          {label}
        </label>
      )}
      {icon || suffix ? (
        <div className="pl-input-adorned">
          {icon && <span className="pl-input-icon">{icon}</span>}
          {input}
          {suffix && <span className="pl-input-suffix">{suffix}</span>}
        </div>
      ) : (
        input
      )}
      {error && (
        <div className="pl-input-error" id={`${inputId}-error`} role="alert">
          {error}
        </div>
      )}
      {hint && !error && (
        <div className="pl-input-hint" id={`${inputId}-hint`}>
          {hint}
        </div>
      )}
    </div>
  );
});

export default Input;
