/**
 * FunnelChart — conversion funnel visualization.
 * Extracted from analytics-page.jsx.
 *
 * Usage:
 *   <FunnelChart data={[{ label: 'Sent', count: 42, pct: null }, { label: 'Viewed', count: 30, pct: 71 }, ...]} />
 *
 * Props:
 *   data  Array<{ label: string, count: number, pct: number|null }>
 *         pct is the conversion % vs previous step; null for first row
 *   colors  optional array of CSS color strings (defaults to --chart-* tokens with brand fallbacks)
 */

const DEFAULT_COLORS = [
  'var(--chart-1, var(--brand))',
  'var(--chart-2, var(--amber, #f59e0b))',
  'var(--chart-3, var(--blue, #3b82f6))',
  'var(--chart-4, var(--green))',
  'var(--chart-5, var(--purple, #8b5cf6))',
];

export default function FunnelChart({ data, colors = DEFAULT_COLORS }) {
  const max = data[0]?.count || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((row, i) => (
        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Label */}
          <div
            className="analytics-funnel-label">
            {row.label}
          </div>

          {/* Bar track */}
          <div
            style={{
              flex: 1,
              background: 'var(--line)',
              borderRadius: 4,
              height: 22,
              overflow: 'hidden',
              position: 'relative',
}}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                width: max > 0 ? `${Math.max(2, (row.count / max) * 100)}%` : '2%',
                background: colors[i % colors.length],
                borderRadius: 4,
                transition: 'width .5s var(--ease-emphasis, ease)',
              }}
            />
          </div>

          {/* Count */}
          <div
            style={{
              width: 36,
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
              color: 'var(--text)',
              textAlign: 'right',
}}>
            {row.count}
          </div>

          {/* Conversion % */}
          {i > 0 && row.pct !== null ? (
            <div
              style={{
                width: 36,
                fontSize: 'var(--text-2xs)',
                color: 'var(--muted)',
                textAlign: 'right',
}}>
              {row.pct}%
            </div>
          ) : (
            <div style={{ width: 36 }} />
          )}
        </div>
      ))}
    </div>
  );
}
