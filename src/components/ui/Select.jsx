import { forwardRef } from 'react';

/**
 * <Select> — Phase 2 primitive.
 *
 * Wraps a native <select> with:
 *   • Consistent sizing matching <Input>
 *   • Custom chevron indicator
 *   • Focus ring from design tokens
 *   • Error state (red border + message)
 *   • Optional label + hint text
 *
 * Usage:
 *   <Select label="Province" value={province} onChange={e => set(e.target.value)}>
 *     <option>AB</option><option>BC</option>
 *   </Select>
 */
const Select = forwardRef(function Select(
  {
    label,
    hint,
    error,
    size = 'md',
    dense = false,
    children,
    className = '',
    id,
    style,
    ...rest
  },
  ref
) {
  const selectId = id || (label ? `pl-select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  const sizeClass = {
    sm: 'pl-select--sm',
    md: '',
    lg: 'pl-select--lg',
  }[size] || '';

  const classes = [
    'pl-select-field',
    'input',
    sizeClass,
    dense ? 'input--dense' : '',
    error ? 'pl-select--error' : '',
    className,
  ].filter(Boolean).join(' ');

  const select = (
    <div className="pl-select-wrap-inner">
      <select
        ref={ref}
        id={selectId}
        className={classes}
        aria-invalid={!!error}
        aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
        style={style}
        {...rest}
      >
        {children}
      </select>
      <span className="pl-select-chevron" aria-hidden="true" />
    </div>
  );

  if (!label && !hint && !error) return select;

  return (
    <div className="pl-select-wrap">
      {label && (
        <label className="pl-select-label" htmlFor={selectId}>
          {label}
        </label>
      )}
      {select}
      {error && (
        <div className="pl-input-error" id={`${selectId}-error`} role="alert">
          {error}
        </div>
      )}
      {hint && !error && (
        <div className="pl-input-hint" id={`${selectId}-hint`}>
          {hint}
        </div>
      )}
    </div>
  );
});

export default Select;
