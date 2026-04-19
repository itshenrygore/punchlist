import useCountUp from '../../hooks/use-count-up';

/**
 * <Stat> — Phase 0 primitive.
 *
 * Metric display with three stability guarantees:
 *   1. Animated count-up that never reflows (uses --min-ch + tabular-nums).
 *   2. Respects prefers-reduced-motion — snaps to final value when set.
 *   3. Works with both numeric and pre-formatted string values.
 *
 *   <Stat label="Monthly payment" value={434} prefix="$" suffix="/mo" />
 *   <Stat label="Open quotes"     value={12} />
 *   <Stat label="Close rate"      value={72} suffix="%" />
 *
 * If `value` is a string, count-up is disabled and the string is
 * shown as-is (still inside a stable-width container).
 */
export default function Stat({
  label,
  value,
  prefix = '',
  suffix = '',
  decimals,
  hint,
  tone = 'default',            // 'default' | 'success' | 'warning' | 'danger' | 'brand'
  align = 'start',             // 'start' | 'center' | 'end'
  className = '',
  countUp = true,
  style,
}) {
  const isNumeric = typeof value === 'number' && Number.isFinite(value);
  const animatedValue = useCountUp(isNumeric ? value : 0, {
    enabled: countUp && isNumeric,
    decimals,
  });

  const displayed = isNumeric
    ? formatNumber(animatedValue, decimals)
    : String(value ?? '');

  const finalString = `${prefix}${displayed}${suffix}`;

  // Reserve width for the final rendered string so the container
  // never changes width mid-animation. ch units approximate digit width.
  const minCh = Math.max(
    4,
    String(prefix + formatNumber(isNumeric ? value : value, decimals) + suffix).length
  );

  const toneColor = {
    default: 'var(--text)',
    success: 'var(--green)',
    warning: 'var(--amber)',
    danger:  'var(--red)',
    brand:   'var(--brand)',
  }[tone] ?? 'var(--text)';

  const wrap = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: align === 'center' ? 'center' : align === 'end' ? 'flex-end' : 'flex-start',
    gap: 'var(--space-1)',
    minWidth: 0,
    ...style,
  };

  return (
    <div className={`pl-stat ${className}`} style={wrap}>
      {label && (
        <div
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            letterSpacing: 'var(--tracking-loose)',
            textTransform: 'uppercase',
            color: 'var(--muted)',
}}>
          {label}
        </div>
      )}
      <div
        className="font-display num-stable tabular">
        {finalString}
      </div>
      {hint && (
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--muted)',
            lineHeight: 'var(--lh-normal)',
}}>
          {hint}
        </div>
      )}
    </div>
  );
}

function formatNumber(n, decimals) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return String(n ?? '');
  const d = typeof decimals === 'number' ? decimals : countDecimals(n);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

function countDecimals(n) {
  const s = String(n);
  const i = s.indexOf('.');
  return i === -1 ? 0 : Math.min(4, s.length - i - 1);
}
