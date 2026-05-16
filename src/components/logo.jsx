/**
 * Punchlist Logo — punch-bar + checklist mark
 *
 * The brand mark: an orange impact bar and echo line on the left,
 * three horizontal checklist rows on the right with an orange
 * checkmark on the first item. Housed in a soft glass container.
 *
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
   BrandMark — punch bar + checklist icon in a glass container.
   All geometry scales proportionally from the `size` prop.
   Based on the 512×512 favicon viewBox.
─────────────────────────────────────────────────────────────── */
function BrandMark({ size = 32 }) {
  const r = Math.max(6, Math.round(size * 0.22));

  /* Adapt list-row color to light/dark context */
  const rowFill =
    'var(--logo-row-fill, #4a4f57)';

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
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Impact bar (the "punch") */}
        <rect x="100" y="80" width="60" height="352" rx="18" fill="#d45a1a" />
        {/* Echo line */}
        <rect x="176" y="80" width="20" height="352" rx="10" fill="#d45a1a" opacity="0.3" />
        {/* Checklist rows */}
        <rect x="224" y="112" width="180" height="44" rx="12" fill={rowFill} />
        <rect x="224" y="192" width="140" height="44" rx="12" fill={rowFill} opacity="0.55" />
        <rect x="224" y="272" width="160" height="44" rx="12" fill={rowFill} opacity="0.3" />
        {/* Checkmark on first item */}
        <path
          d="M248 126 L262 142 L292 116"
          stroke="#d45a1a"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </span>
  );
}
