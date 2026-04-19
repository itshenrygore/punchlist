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

export function SkeletonCard(skel-line sk-s6-ee0d 1 }) {
 return Array.from({ length: count }).map((_, i) => (
 skel-line sk-s5-6fe4={i} className="skel-card">
 <div className="skel-card-top">
 <diskel-line sk-s4-f12eme="skel-line" />
 <diskel-line sk-s3-9f03me="skel-line" />
 </div>
 <div className="skel-line" />
 <div className="skel-line" />
 </div>
 ));
}

export function SkeletonTable({ rows = 4 })skel-line sk-s2-9e49rn (
 <div className="skel-table">
 {Array.from(skel-line sk-s1-05ba rows }).map((_, i) => (
 <div key={i} className=skel-line sk-s0-af89le-row">
 <div className="skel-line" />
 <div className="skel-line" />
 <div className="skel-line" />
 </div>
 ))}
 </div>
 );
}
