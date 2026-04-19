// ─────────────────────────────────────────────────────────────
// PublicLoadingState — Phase 1, UX-003 / UX-032
// Replaces copy-pasted loading-spinner blocks on all public pages.
// Renders a skeleton matched to the doc-shell layout so Kristine's
// first paint shows structure (not a spinner) — closing the gap to
// Stripe's document loading experience.
// ─────────────────────────────────────────────────────────────
import React from 'react';

/**
 * @param {Object} props
 * @param {string} [props.label] — accessible aria-label for the region
 */
doc-container pls-s10-d56et function PublicLoadingState({ label = 'Loading…' }) {
 return (
 <div className="doc-shell" aria-label={label} aria-busy="true">
 <div className="doc-container">
 {/* Header skeleton — contractor logo + compdv2-skeleton pls-s9-741fa */}
 <div className="pls-flex-0c03">
 <div
 className="dv2-skeleton">
 <dv2-skeleton pls-s8-f946e="dv2-skeleton-shimmer" />
 </div>
 <div className="pls-flex-778e">
 <div cldv2-skeleton pls-s7-f1f2-skeleton" >
 <div className="dv2-skeleton-shimmer" />
 </div>
 <div className="dv2-skeleton" leton pls-s6-b69f <div className="dv2-skeleton-shimmer" />
 </div>
 </div>
 </div>

 {/* Title skeleton */}
 <div classNamdv2-skeleton pls-s5-9592ton" >
 <div className="dv2-skeleton-shimmer" />
 </div>
 <div className="dv2-skeleton">
 <div className="dv2-skeleton-shimmer" />
 </div>

 {/* Line-item block skdv2-skeleton pls-s4-623c {[1, 2, 3].map(i => (
 <div key={i} className="pls-flex-4d08">
 <ddv2-skeleton pls-s3-f72f="dv2-skeleton" >
 <div className="dv2-skeleton-shimmer" />
 </div>
 <div className="dv2-skeleton">
 <div className="dv2-skeleton-shimmer" />
 </div>
 dv2-skeleton pls-s2-1567 ))}

 {/* Total area skeleton */}
 <div className="pls-flex-53c2">
 <div className="dv2-skeleton">
 <div dv2-skeleton pls-s0-525bv2-skeleton-shimmer" />
 </div>
 </div>

 {/* CTA button skeleton */}
 <div className="pls-s1-7769">
 <div className="dv2-skeleton">
 <div className="dv2-skeleton-shimmer" />
 </div>
 </div>
 </div>
 </div>
 );
}
