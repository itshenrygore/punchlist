/**
 * Punchlist Logo — refined brand mark
 *
 * The mark: three graduated vertical bars in the brand orange,
 * ascending left-to-right like a project coming together.
 * Housed in a soft glass container that adapts to light/dark.
 *
 * The orange gradient (#E07A32 → #B85D1E) is the brand constant.
 * The glass adapts via CSS variables from tokens.css:
 *   --logo-glass-bg, --logo-glass-border, --logo-glass-highlight
 *
 * Pass `dark={true|false}` to override theme detection.
 */

const SIZES = {
  sm: { mark: 26, gap: 8,  font: 17, sub: 9  },
  md: { mark: 34, gap: 10, font: 22, sub: 10 },
  lg: { mark: 44, gap: 12, font: 28, sub: 11 },
};

export default function Logo({ size = 'md', dark, tagline = false }) {
  const dims = SIZES[size] || SIZES.md;

  const textColor =
    dark === true ? '#f5f3ee' :
    dark === false ? '#1a1a1a' :
    'var(--text, #1a1a1a)';

  const subColor =
    dark === true ? 'rgba(245,243,238,0.55)' :
    dark === false ? 'rgba(26,26,26,0.55)' :
    'var(--muted, rgba(26,26,26,0.55))';

  return (
    <span
      className="pl-logo"
      data-force-theme={dark === true ? 'dark' : dark === false ? 'light' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: dims.gap,
        lineHeight: 1,
        verticalAlign: 'middle',
      }}
      aria-label="Punchlist"
      role="img"
    >
      <BrandMark size={dims.mark} />
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, lineHeight: 1 }}>
        <span
          style={{
            fontFamily: "'Clash Display',-apple-system,BlinkMacSystemFont,'SF Pro Display',Inter,system-ui,sans-serif",
            fontSize: dims.font,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            color: textColor,
          }}
        >
          punchlist
        </span>
        {tagline && (
          <span
            style={{
              fontFamily: "'Inter',-apple-system,system-ui,sans-serif",
              fontSize: dims.sub,
              fontWeight: 500,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: subColor,
            }}
          >
            Contractor Quoting
          </span>
        )}
      </span>
    </span>
  );
}

/** Mark only (no wordmark). For sidebars, favicons, tight UI. */
export function LogoMark({ size = 32 }) {
  return <BrandMark size={size} />;
}

/* ───────────────────────────────────────────────────────────────
   BrandMark — the shared visual primitive.
   Three ascending bars in a soft glass container.
─────────────────────────────────────────────────────────────── */
function BrandMark({ size = 32 }) {
  const r = Math.max(6, Math.round(size * 0.22));
  const pad = Math.round(size * 0.22);
  const barW = Math.max(2.5, Math.round(size * 0.14));
  const gap = Math.max(1.5, Math.round(size * 0.08));

  /* Three bars, ascending: 48%, 72%, 100% of available height */
  const maxH = size - pad * 2;
  const heights = [maxH * 0.48, maxH * 0.72, maxH];

  /* Center the bar group horizontally */
  const groupW = barW * 3 + gap * 2;
  const startX = (size - groupW) / 2;

  /* Unique gradient ID per instance */
  const gradId = `pl-g-${size}`;

  return (
    <span
      className="pl-logo-mark"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: r,
        background: 'var(--logo-glass-bg, rgba(255,255,255,0.16))',
        border: '1px solid var(--logo-glass-border, rgba(255,255,255,0.28))',
        boxShadow:
          'inset 0 1px 0 var(--logo-glass-highlight, rgba(255,255,255,0.24)), 0 1px 3px rgba(0,0,0,0.06)',
        backdropFilter: 'blur(14px) saturate(120%)',
        WebkitBackdropFilter: 'blur(14px) saturate(120%)',
        flexShrink: 0,
        transition: 'background .2s ease, border-color .2s ease',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E07A32" />
            <stop offset="100%" stopColor="#B85D1E" />
          </linearGradient>
        </defs>
        {heights.map((h, i) => {
          const x = startX + i * (barW + gap);
          const y = pad + (maxH - h);
          const rx = Math.max(1.2, barW * 0.38);
          const opacity = 0.4 + i * 0.3; /* 0.4, 0.7, 1.0 */
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={rx}
              fill={`url(#${gradId})`}
              opacity={opacity}
            />
          );
        })}
      </svg>
    </span>
  );
}
