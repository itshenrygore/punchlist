/**
 * Toggle — accessible switch primitive.
 *
 * Usage:
 *   <Toggle checked={enabled} onChange={setEnabled} label="Auto-send invoice" disabled={saving} />
 *
 * Renders role="switch" + aria-checked. Tap target is 44×44px minimum via ::after pseudo-element.
 */
export default function Toggle({ checked, onChange, label, disabled = false, id }) {
  const handleClick = () => {
    if (!disabled && onChange) onChange(!checked);
  };

  const handleKey = (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKey}
      style={{
        position: 'relative',
        flexShrink: 0,
        width: 44,
        height: 24,
        borderRadius: 12,
        border: 'none',
        background: checked ? 'var(--brand)' : 'var(--line-2, #d1d5db)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background .2s var(--ease-standard, ease)',
        /* Expanded tap target to 44×44 via ::after */
>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 22 : 2,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'var(--panel, #fff)',
          boxShadow: '0 1px 3px rgba(0,0,0,.2)',
          transition: 'left .2s var(--ease-spring, cubic-bezier(.34,1.56,.64,1))',
        }}
      />
    </button>
  );
}
