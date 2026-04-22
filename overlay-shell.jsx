/**
 * skel-base.jsx — shared skeleton primitives for Phase 2 per-page skeletons.
 *
 * Uses the .dv2-skeleton / .dv2-skeleton-shimmer pattern already established
 * in dashboard-v2.css. All shimmer respects the existing
 * `prefers-reduced-motion` rule in that stylesheet (animation pauses, static
 * placeholder remains visible).
 *
 * These are composable building blocks — not exported as a public API. Each
 * page skeleton imports only what it needs.
 */

/** A shimmer block. height and width are CSS values (strings or numbers in px). */
export function SkelBlock({ h = 14, w = '100%', r = 'var(--r-sm)', style, className = '' }) {
  return (
    <div
      className={`dv2-skeleton ${className}`}
      style={{
        '--skel-h': typeof h === 'number' ? `${h}px` : h,
        width: typeof w === 'number' ? `${w}px` : w,
        borderRadius: r,
        flexShrink: 0,
        ...style,
      }}
      aria-hidden="true"
    >
      <div className="dv2-skeleton-shimmer" />
    </div>
  );
}

/** A horizontal row of two blocks (label left, value right). */
export function SkelRow({ leftW = '45%', rightW = '20%', h = 13, gap = 8 }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap }}>
      <SkelBlock h={h} w={leftW} />
      <SkelBlock h={h} w={rightW} />
    </div>
  );
}

/** A card shell using the existing .skel-card class. */
export function SkelCard({ children, style }) {
  return (
    <div className="skel-card" style={style}>
      {children}
    </div>
  );
}

/** A stack of evenly-spaced skel lines — list-row pattern. */
export function SkelListRows({ count = 5, h = 44 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkelBlock key={i} h={h} w="100%" r="var(--r)" />
      ))}
    </div>
  );
}

/** A 2-column stat area. */
export function SkelStatGrid({ cols = 3 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
      {Array.from({ length: cols }).map((_, i) => (
        <SkelCard key={i}>
          <SkelBlock h={11} w="55%" />
          <SkelBlock h={28} w="70%" style={{ marginTop: 6 }} />
        </SkelCard>
      ))}
    </div>
  );
}

/** Wrapper that mimics app-shell content area padding — use inside AppShell. */
export function SkelPage({ children }) {
  return (
    <div style={{ paddingTop: 20, paddingBottom: 40, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {children}
    </div>
  );
}
