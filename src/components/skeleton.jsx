/**
 * Skeleton — shimmer loading placeholders
 * Usage: <Skeleton lines={3} /> or <Skeleton type="card" count={3} />
 */
export function Skeleton({ lines = 3, style }) {
  return (
    <div className="skel-block" style={style}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skel-line" style={{ width: i === lines - 1 ? '60%' : '100%' }} />
      ))}
    </div>
  );
}

export function SkeletonCard({ count = 1 }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className="skel-card">
      <div className="skel-card-top">
        <div className="skel-line" style={{ width: '45%', height: 14 }} />
        <div className="skel-line" style={{ width: '20%', height: 14 }} />
      </div>
      <div className="skel-line" style={{ width: '70%', marginTop: 8 }} />
      <div className="skel-line" style={{ width: '40%', marginTop: 6 }} />
    </div>
  ));
}

export function SkeletonTable({ rows = 4 }) {
  return (
    <div className="skel-table">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skel-table-row">
          <div className="skel-line" style={{ width: '55%' }} />
          <div className="skel-line" style={{ width: '15%' }} />
          <div className="skel-line" style={{ width: '20%' }} />
        </div>
      ))}
    </div>
  );
}
