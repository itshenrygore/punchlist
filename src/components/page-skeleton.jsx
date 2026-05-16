/**
 * PageSkeleton — reusable loading placeholder with layout variants.
 * Uses existing skel-card, skel-card-top, skel-line, skel-block CSS classes.
 */
export default function PageSkeleton({ variant = 'cards' }) {
  if (variant === 'list') {
    return (
      <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skel-line" style={{ width: '100%', height: 40, borderRadius: 'var(--r)' }} />
        ))}
      </div>
    );
  }

  if (variant === 'form') {
    return (
      <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skel-block">
            <div className="skel-line" style={{ width: '30%', height: 12 }} />
            <div className="skel-line" style={{ width: '100%', height: 38, borderRadius: 'var(--r)' }} />
          </div>
        ))}
      </div>
    );
  }

  // Default: variant="cards"
  return (
    <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="skel-card">
          <div className="skel-card-top">
            <div className="skel-line" style={{ width: '45%', height: 14 }} />
            <div className="skel-line" style={{ width: '20%', height: 14 }} />
          </div>
          <div className="skel-line" style={{ width: '70%', marginTop: 8 }} />
          <div className="skel-line" style={{ width: '40%', marginTop: 6 }} />
        </div>
      ))}
    </div>
  );
}
