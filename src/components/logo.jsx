/**
 * Punchlist Logo — premium glass-mark design
 *
 * The brand mark is a glass square (translucent, soft border, inset
 * highlight) wrapping the orange tally-bars wordmark. The orange bars
 * stay constant — they're the brand. The glass adapts to background:
 * • dark backgrounds (landing hero, dark mode) → white-translucent
 * • light backgrounds (app shell, light mode) → dark-translucent
 *
 * Adaptation is driven by CSS variables defined in tokens.css:
 * --logo-glass-bg, --logo-glass-border, --logo-glass-highlight
 *
 * Pass `dark={true|false}` to override theme detection (e.g., the
 * landing hero sets dark={true} regardless of the user's OS theme).
 */

const SIZES = {
 sm: { mark: 26, gap: 8, font: 17, sub: 9 },
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
 <GlassMark size={dims.mark} />
 <span className="logo-inline-flex-3eba">
 <span
 style={{
 fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display',Inter,system-ui,sans-serif",
 fontSize: dims.font,
 fontWeight: 700,
 letterSpacing: '-0.02em',
 color: textColor,
>
 punchlist
 </span>
 {tagline && (
 <span
 style={{
 fontFamily: "-apple-system,system-ui,sans-serif",
 fontSize: dims.sub,
 fontWeight: 500,
 letterSpacing: '0.08em',
 textTransform: 'uppercase',
 color: subColor,
>
 Contractor Quoting
 </span>
 )}
 </span>
 </span>
 );
}

/** Glass square + tally bars only (no wordmark). For sidebars, favicons, tight UI. */
export function LogoMark({ size = 32 }) {
 return <GlassMark size={size} />;
}

/* ───────────────────────────────────────────────────────────────
 GlassMark — the shared visual primitive.
─────────────────────────────────────────────────────────────── */
function GlassMark({ size = 32 }) {
 const radius = Math.max(6, Math.round(size * 0.24));
 const padding = Math.round(size * 0.22);
 const barW = Math.max(2, Math.round(size * 0.13));
 const barThinW = Math.max(1.5, Math.round(size * 0.075));
 const barH = size - padding * 2;
 const barGap = Math.round(size * 0.13);
 const bar1X = padding;
 const bar2X = bar1X + barW + barGap;

 return (
 <span
 className="pl-logo-mark">
 <svg
 width={size}
 height={size}
 viewBox={`0 0 ${size} ${size}`}
 fill="none"
 xmlns="http://www.w3.org/2000/svg"
 aria-hidden="true"
 >
 <rect
 x={bar1X} y={padding} width={barW} height={barH}
 rx={Math.max(1, barW / 2)}
 fill="#d45a1a"
 />
 <rect
 x={bar2X} y={padding} width={barThinW} height={barH}
 rx={Math.max(0.75, barThinW / 2)}
 fill="#d45a1a"
 opacity="0.45"
 />
 </svg>
 </span>
 );
}
