/**
 * Punchlist Logo — uses CSS variables for theme-reactive colors
 */
export default function Logo({ size = 'md', dark, tagline = false }) {
  const scales = { sm:.75, md:1, lg:1.35 };
  const s = scales[size] || 1;
  // Use CSS variable reference — this makes the logo reactive to theme changes
  // without needing re-render. The SVG text uses fill="var(--text)" which
  // automatically adapts when [data-theme] changes.
  const explicitDark = dark !== undefined ? dark : null;
  const textColor = explicitDark === true ? '#f0ede8' : explicitDark === false ? '#111210' : 'var(--text, #f0ede8)';
  const subColor = explicitDark === true ? '#7a7875' : explicitDark === false ? '#6b6a65' : 'var(--muted, #7a7875)';

  return (
    <svg
      width={Math.round(200 * s)}
      height={Math.round(tagline ? 52 * s : 38 * s)}
      viewBox={`0 0 200 ${tagline ? 52 : 38}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Punchlist"
      role="img"
    >
      <rect x="0" y="0" width="5" height={tagline ? 44 : 36} rx="2" fill="#d45a1a"/>
      <rect x="8" y="0" width="2" height={tagline ? 44 : 36} rx="1" fill="#d45a1a" opacity="0.35"/>
      <text
        x="18" y="27"
        fontFamily="-apple-system,BlinkMacSystemFont,'SF Pro Display',system-ui,sans-serif"
        fontSize="24" fontWeight="800" letterSpacing="-1"
        fill={textColor}
      >
        punchlist
      </text>
      {tagline && (
        <text
          x="18" y="46"
          fontFamily="-apple-system,system-ui,sans-serif"
          fontSize="9" fontWeight="500" letterSpacing=".08em"
          fill={subColor}
        >
          CONTRACTOR QUOTING
        </text>
      )}
    </svg>
  );
}

export function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Punchlist" role="img">
      <rect x="6"  y="4" width="5"  height="24" rx="2"   fill="#d45a1a"/>
      <rect x="14" y="4" width="2"  height="24" rx="1"   fill="#d45a1a" opacity="0.38"/>
      <rect x="19" y="4" width="7"  height="5"  rx="1.5" fill="var(--text, #f0ede8)"/>
      <rect x="19" y="13" width="9" height="5"  rx="1.5" fill="var(--text, #f0ede8)" opacity="0.55"/>
      <rect x="19" y="22" width="5" height="5"  rx="1.5" fill="var(--text, #f0ede8)" opacity="0.3"/>
    </svg>
  );
}
