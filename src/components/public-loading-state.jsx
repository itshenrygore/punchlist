// ─────────────────────────────────────────────────────────────
// PublicLoadingState — Phase 1, UX-003 / UX-032
// Replaces copy-pasted loading-spinner blocks on all public pages.
// Renders a skeleton matched to the doc-shell layout so Kristine's
// first paint shows structure (not a spinner) — closing the gap to
// Stripe's document loading experience.
// ─────────────────────────────────────────────────────────────
import React from 'react';

/**
 * @param {Object}  props
 * @param {string}  [props.label]   — accessible aria-label for the region
 */
export default function PublicLoadingState({ label = 'Loading…' }) {
  return (
    <div className="doc-shell" aria-label={label} aria-busy="true">
      <div className="doc-container" style={{ paddingTop: 32, paddingBottom: 48 }}>
        {/* Header skeleton — contractor logo + company name area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div
            className="dv2-skeleton"
            style={{ '--skel-h': '48px', width: 48, borderRadius: '50%', flexShrink: 0 }}
          >
            <div className="dv2-skeleton-shimmer" />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="dv2-skeleton" style={{ '--skel-h': '14px', width: '40%' }}>
              <div className="dv2-skeleton-shimmer" />
            </div>
            <div className="dv2-skeleton" style={{ '--skel-h': '12px', width: '28%' }}>
              <div className="dv2-skeleton-shimmer" />
            </div>
          </div>
        </div>

        {/* Title skeleton */}
        <div className="dv2-skeleton" style={{ '--skel-h': '28px', width: '60%', marginBottom: 12 }}>
          <div className="dv2-skeleton-shimmer" />
        </div>
        <div className="dv2-skeleton" style={{ '--skel-h': '16px', width: '38%', marginBottom: 32 }}>
          <div className="dv2-skeleton-shimmer" />
        </div>

        {/* Line-item block skeletons */}
        {[1, 2, 3].map(i => (
          <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center' }}>
            <div className="dv2-skeleton" style={{ '--skel-h': '14px', flex: 3 }}>
              <div className="dv2-skeleton-shimmer" />
            </div>
            <div className="dv2-skeleton" style={{ '--skel-h': '14px', flex: 1 }}>
              <div className="dv2-skeleton-shimmer" />
            </div>
          </div>
        ))}

        {/* Total area skeleton */}
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
          <div className="dv2-skeleton" style={{ '--skel-h': '32px', width: '30%' }}>
            <div className="dv2-skeleton-shimmer" />
          </div>
        </div>

        {/* CTA button skeleton */}
        <div style={{ marginTop: 32 }}>
          <div className="dv2-skeleton" style={{ '--skel-h': '48px', width: '100%', borderRadius: 8 }}>
            <div className="dv2-skeleton-shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}
