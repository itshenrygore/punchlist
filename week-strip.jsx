/* ═══════════════════════════════════════════════════════════════
   Phase 1 — Quote Builder additive styles.
   Imported after index.css. Does not override existing rules.
   Adds: line-item enter/leave animations, suggestions panel,
         stable-min-height helpers, totals panel refinements.
   ═══════════════════════════════════════════════════════════════ */

/* ── Line-item animated list container ────────────────────── */
/* The container gets contain:layout paint so motion can't leak. */
.pl-items-motion {
  position: relative;
  contain: layout paint;
  transform: translateZ(0);
}

/* Each item fades/translates in once on mount. Stable key from
   item.id means React never unmounts/remounts a row on edit,
   so the animation runs exactly once per row. */
.pl-item-enter {
  animation: pl-item-in var(--dur-slow, 360ms) var(--ease-emphasis, cubic-bezier(.22,1,.36,1)) both;
  will-change: transform, opacity;
}
@keyframes pl-item-in {
  from { opacity: 0; transform: translate3d(0, 8px, 0); }
  to   { opacity: 1; transform: translate3d(0, 0, 0); }
}

/* Leaving row — applied just before unmount via timeout. */
.pl-item-leave {
  animation: pl-item-out var(--dur-base, 220ms) var(--ease-standard, cubic-bezier(.32,.72,0,1)) both;
  will-change: transform, opacity;
  pointer-events: none;
}
@keyframes pl-item-out {
  from { opacity: 1; transform: translate3d(0, 0, 0); }
  to   { opacity: 0; transform: translate3d(0, -4px, 0); }
}

/* Reduced motion — snap to final state, never animate. */
@media (prefers-reduced-motion: reduce) {
  .pl-item-enter,
  .pl-item-leave { animation: none !important; }
}

/* ── AI Foreman Suggestions panel ─────────────────────────── */
/* Lives beside/below line items. Uses muted tones, brand only for CTAs. */
.pl-sug-panel {
  display: grid;
  gap: 8px;
}
.pl-sug-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}
.pl-sug-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--muted);
}
.pl-sug-count {
  font-size: 11px;
  color: var(--subtle);
  font-weight: 600;
}
.pl-sug-list {
  display: grid;
  gap: 6px;
}
.pl-sug-item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: var(--r, 12px);
  transition: border-color var(--dur-fast, 140ms) var(--ease-standard), opacity var(--dur-base, 220ms) var(--ease-standard);
}
.pl-sug-item:hover { border-color: var(--brand-line); }
.pl-sug-item-main { min-width: 0; display: grid; gap: 2px; }
.pl-sug-item-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  overflow-wrap: anywhere;
}
.pl-sug-item-meta {
  font-size: 11px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.pl-sug-item-why {
  font-size: 11px;
  color: var(--subtle);
  margin-top: 2px;
  overflow-wrap: anywhere;
}
.pl-sug-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.pl-sug-btn {
  min-width: 44px;
  min-height: 36px;
  padding: 6px 10px;
  border-radius: var(--r-sm, 10px);
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--dur-fast, 140ms) var(--ease-standard);
}
.pl-sug-btn:hover { border-color: var(--line-2); color: var(--text); }
.pl-sug-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--brand-glow, rgba(249,115,22,.3));
}
.pl-sug-btn-add {
  background: var(--brand-bg, rgba(249,115,22,.1));
  border-color: var(--brand-line, rgba(249,115,22,.3));
  color: var(--brand);
}
.pl-sug-btn-add:hover {
  background: var(--brand);
  color: #fff;
  border-color: var(--brand);
}
.pl-sug-item.pl-sug-leaving {
  animation: pl-item-out var(--dur-base, 220ms) var(--ease-standard) both;
  pointer-events: none;
}
.pl-sug-empty {
  padding: 14px;
  text-align: center;
  font-size: 12px;
  color: var(--subtle);
}
@media (max-width: 640px) {
  .pl-sug-actions { gap: 2px; }
  .pl-sug-btn { min-width: 44px; padding: 6px 8px; font-size: 11px; }
}
@media (prefers-reduced-motion: reduce) {
  .pl-sug-item,
  .pl-sug-item.pl-sug-leaving { animation: none !important; transition: none !important; }
}

/* ── Stable min-heights for dynamic-content cards ─────────── */
/* Describe intake card: matches roughly the height of the textarea
   + helpers row + details, so toggling error/hint doesn't shift. */
.pl-describe-stable { min-height: 280px; }
@media (max-width: 480px) { .pl-describe-stable { min-height: 260px; } }

/* Building (loading) card: fixed min-height so it doesn't shrink
   when scopeLoadingMsg text changes. */
.pl-building-stable { min-height: 380px; }

/* Totals panel: reserve height so Add/Remove rows don't shift it. */
.pl-totals-stable { min-height: 220px; }

/* Items section: reserves an empty-state-sized block so switching
   between empty and populated doesn't shift page content above. */
.pl-items-stable { min-height: 180px; }

/* ── Totals / Stats stacking inside totals card ──────────── */
.pl-totals-stats {
  display: grid;
  gap: 10px;
}
.pl-totals-stat-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}
.pl-totals-stat-row .pl-stat-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--muted);
  flex-shrink: 0;
}
/* The numeric value cell reserves space so the longest expected
   total width is always held — prevents $10,000 vs $434 reflow. */
.pl-totals-stat-row .pl-stat-val {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum';
  display: inline-block;
  min-width: var(--min-ch, 8ch);
  text-align: right;
  font-weight: 800;
  letter-spacing: -.02em;
  color: var(--text);
}
.pl-totals-stat-row.pl-grand .pl-stat-val {
  color: var(--brand);
  font-size: 20px;
}

/* ── Voice recording indicator (transform/opacity only) ──── */
.pl-voice-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--red-bg, rgba(220,38,38,.1));
  border: 1px solid var(--red-line, rgba(220,38,38,.3));
  color: var(--red, #dc2626);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .04em;
  text-transform: uppercase;
  opacity: 0;
  transform: scale(.9);
  transition: opacity var(--dur-base, 220ms) var(--ease-emphasis), transform var(--dur-base, 220ms) var(--ease-emphasis);
}
.pl-voice-indicator[data-on="true"] {
  opacity: 1;
  transform: scale(1);
}
.pl-voice-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: currentColor;
  animation: pl-voice-pulse 1.2s ease-in-out infinite;
}
@keyframes pl-voice-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: .4; transform: scale(.75); }
}
@media (prefers-reduced-motion: reduce) {
  .pl-voice-dot { animation: none !important; }
  .pl-voice-indicator { transition: none !important; }
}
