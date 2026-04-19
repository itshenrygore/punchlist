/* ═══════════════════════════════════════════════════════════════
   Phase 2 — Public Quote page additive styles.
   Imported after phase1-builder.css. Does not override existing
   document.css or pq-* rules — wraps and supplements.
   Adds: signature modal, CTA → approved transform, pricing-card
         stable reservations, amendment section frame, photo
         gallery, trust-signal row, scope group cards, count-up
         number stability for hero + totals, optional-item toggle
         transform-only feedback.
   ═══════════════════════════════════════════════════════════════ */

/* ── Signature modal (primary structural change) ────────────── */
/* Full-screen overlay, centred dialog. Only opacity + transform
   animate — never width/height/top/left. Body scroll-locked via
   useScrollLock. Stacks above .pq-sheet-overlay (z 200) at 210. */
.pl-sig-overlay {
  position: fixed;
  inset: 0;
  z-index: 210;
  background: rgba(10, 12, 16, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(12px, 4vw, 32px);
  animation: pl-sig-backdrop-in var(--dur-base, 220ms) var(--ease-emphasis, cubic-bezier(.22,1,.36,1)) both;
  overscroll-behavior: contain;
  will-change: opacity;
}
@keyframes pl-sig-backdrop-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.pl-sig-modal {
  position: relative;
  width: 100%;
  max-width: 520px;
  max-height: calc(100vh - 48px);
  max-height: calc(100dvh - 48px);
  display: flex;
  flex-direction: column;
  background: var(--doc-card, #fff);
  color: var(--doc-text, #14161a);
  border-radius: 18px;
  box-shadow: var(--elev-3, 0 24px 64px rgba(0,0,0,0.24));
  overflow: hidden;
  animation: pl-sig-modal-in var(--dur-slow, 360ms) var(--ease-emphasis, cubic-bezier(.22,1,.36,1)) both;
  contain: layout paint;
  transform-origin: 50% 40%;
  will-change: transform, opacity;
}
@keyframes pl-sig-modal-in {
  from { opacity: 0; transform: translate3d(0, 0, 0) scale(0.96); }
  to   { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
}

@media (max-width: 480px) {
  /* Full-height sheet feel on phones without animating height:
     the container is already full-height via max-height; scale
     origin moves to bottom for a sheet-like rise. */
  .pl-sig-overlay { padding: 0; align-items: flex-end; }
  .pl-sig-modal {
    max-height: calc(100vh - 24px);
    max-height: calc(100dvh - 24px);
    border-radius: 18px 18px 0 0;
    transform-origin: 50% 100%;
  }
  @keyframes pl-sig-modal-in {
    from { opacity: 0; transform: translate3d(0, 24px, 0) scale(1); }
    to   { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
  }
}

.pl-sig-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px 8px;
  flex-shrink: 0;
}
.pl-sig-modal-title {
  margin: 0;
  font-size: clamp(1.125rem, 3vw, 1.375rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: var(--lh-tight, 1.15);
  color: var(--doc-text, #14161a);
}
.pl-sig-modal-close {
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  border: 1px solid var(--doc-border, rgba(0,0,0,0.08));
  background: var(--doc-line-soft, #f6f5f2);
  color: var(--doc-muted, #667085);
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: background var(--dur-fast, 140ms) var(--ease-standard),
              color var(--dur-fast, 140ms) var(--ease-standard);
}
.pl-sig-modal-close:hover { color: var(--doc-text, #14161a); }
.pl-sig-modal-close:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--brand-glow, rgba(249,115,22,0.3));
}

.pl-sig-modal-total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin: 0 20px 4px;
  padding: 10px 14px;
  background: var(--doc-line-soft, #f6f5f2);
  border: 1px solid var(--doc-border, rgba(0,0,0,0.06));
  border-radius: 12px;
  flex-shrink: 0;
}
.pl-sig-modal-total-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--doc-muted, #667085);
}
.pl-sig-modal-total-val {
  font-size: 18px;
  font-weight: 800;
  color: var(--doc-text, #14161a);
  letter-spacing: -0.02em;
  display: inline-block;
  min-width: var(--min-ch, 8ch);
  text-align: right;
}

.pl-sig-modal-body {
  padding: 12px 20px 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.pl-sig-modal-error {
  margin-top: 10px;
  padding: 10px 12px;
  background: rgba(220,38,38,0.08);
  border: 1px solid rgba(220,38,38,0.25);
  border-radius: 10px;
  color: #b91c1c;
  font-size: 13px;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .pl-sig-overlay,
  .pl-sig-modal { animation: none !important; }
}

/* ── CTA → Approved transform (zero layout shift) ───────────── */
/* The primary Approve button stays in its cell; on approval, its
   inner span swaps via opacity+transform only. Container reserves
   a min-height so the transform-only swap cannot collapse the row. */
.pl-cta-approve {
  position: relative;
  min-height: 52px;
  transition: background var(--dur-base, 220ms) var(--ease-standard),
              color var(--dur-base, 220ms) var(--ease-standard);
}
.pl-cta-label,
.pl-cta-approved {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: opacity var(--dur-base, 220ms) var(--ease-emphasis),
              transform var(--dur-base, 220ms) var(--ease-emphasis);
  will-change: transform, opacity;
}
.pl-cta-approved {
  position: absolute;
  inset: 0;
  opacity: 0;
  transform: scale(0.94);
  pointer-events: none;
}
.pl-cta-approve[data-approved="true"] .pl-cta-label {
  opacity: 0;
  transform: scale(1.02);
}
.pl-cta-approve[data-approved="true"] .pl-cta-approved {
  opacity: 1;
  transform: scale(1);
}
.pl-cta-approve[data-approved="true"] {
  background: var(--doc-green, #0F7A50) !important;
  color: #fff !important;
  cursor: default;
}
.pl-cta-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  font-size: 13px;
  font-weight: 900;
  line-height: 1;
}
@media (prefers-reduced-motion: reduce) {
  .pl-cta-label,
  .pl-cta-approved { transition: none !important; }
}

/* ── Pricing hero Stat row (Total + Monthly equal weight) ───── */
.pl-hero-stats {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: clamp(16px, 5vw, 40px);
  flex-wrap: wrap;
  margin: 0 auto;
  /* Reserve vertical space so count-up entering can't shift
     the CTA below. ~92 px fits the Stat's clamp font + label + hint. */
  min-height: 104px;
}
.pl-hero-stats .pl-stat {
  align-items: center;
  text-align: center;
  min-width: 0;
}
.pl-hero-stats .pl-stat [class*="font-display"] {
  font-size: clamp(1.75rem, 5vw, 2.25rem) !important;
}
.pl-hero-divider {
  align-self: center;
  color: var(--doc-muted, #667085);
  font-size: 13px;
  font-weight: 600;
  padding-top: 28px;
  flex-shrink: 0;
}
@media (max-width: 480px) {
  .pl-hero-divider { display: none; }
}

.pl-hero-trust {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 14px;
  margin: 10px auto 0;
  max-width: 520px;
  font-size: 12px;
  color: var(--doc-muted, #667085);
  font-weight: 600;
}
.pl-hero-trust > span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.pl-affirm-line {
  margin-top: 6px;
  font-size: 11px;
  color: var(--doc-muted, #667085);
  text-align: center;
  font-weight: 500;
  letter-spacing: 0.01em;
}

/* ── Totals card — stable totals + count-up ─────────────────── */
.pl-totals-card-wrap {
  /* Reserve min-height so toggling Discount/Add-ons rows cannot
     reflow the actions block below it. Five possible rows × ~28 px
     + grand row ~48 + padding. */
  min-height: 220px;
  contain: layout paint;
}

.pl-totals-grand-num {
  display: inline-block;
  min-width: var(--min-ch, 9ch);
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum';
}

/* ── Optional-item toggle: transform-only selected feedback ──── */
/* Feedback is a scale bump on the knob only — no height changes. */
.pl-opt-row {
  transition: border-color var(--dur-fast, 140ms) var(--ease-standard),
              background var(--dur-fast, 140ms) var(--ease-standard);
  will-change: auto;
}
.pl-opt-row .pq-toggle {
  transition: background var(--dur-fast, 140ms) var(--ease-standard);
}
.pl-opt-row .pq-toggle-knob {
  transition: transform var(--dur-base, 220ms) var(--ease-emphasis, cubic-bezier(.22,1,.36,1));
  will-change: transform;
}
@media (prefers-reduced-motion: reduce) {
  .pl-opt-row,
  .pl-opt-row .pq-toggle,
  .pl-opt-row .pq-toggle-knob { transition: none !important; }
}

/* ── Scope category grouping card ───────────────────────────── */
.pl-scope-group {
  /* Sits inside the existing .doc-items flow; adds a subtle frame
     so category blocks read as distinct without changing heights. */
  margin-top: 4px;
}
.pl-scope-group-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 6px;
}
.pl-scope-group-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--doc-muted, #667085);
}
.pl-scope-group-count {
  font-size: 11px;
  color: var(--doc-muted, #667085);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* ── Amendment display section (Original vs Amendment) ──────── */
.pl-amendment-frame {
  display: grid;
  gap: 14px;
  margin: 0 28px 18px;
  padding: 14px;
  background: var(--doc-line-soft, #f6f5f2);
  border: 1px solid var(--doc-border, rgba(0,0,0,0.08));
  border-radius: 14px;
}
.pl-amendment-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--doc-muted, #667085);
  margin: 0 0 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.pl-amendment-label--new {
  color: var(--doc-accent, #ea580c);
}
.pl-amendment-summary {
  font-size: 13px;
  color: var(--doc-text-2, #4b5563);
  line-height: 1.6;
  margin: 0;
  overflow-wrap: anywhere;
}
.pl-amendment-list {
  list-style: none;
  padding: 0;
  margin: 6px 0 0;
  display: grid;
  gap: 6px;
}
.pl-amendment-list li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  padding: 6px 0;
  border-bottom: 1px dashed var(--doc-border, rgba(0,0,0,0.08));
}
.pl-amendment-list li:last-child { border-bottom: none; }
.pl-amendment-list .pl-amendment-name {
  overflow-wrap: anywhere;
  min-width: 0;
  flex: 1;
}
.pl-amendment-list .pl-amendment-price {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
@media (max-width: 480px) {
  .pl-amendment-frame { margin: 0 16px 14px; padding: 12px; }
}

/* ── Photo gallery (lazy-load below fold) ───────────────────── */
.pl-photos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(160px, 100%), 1fr));
  gap: 8px;
  margin: 8px 28px 18px;
}
.pl-photo {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: 12px;
  background: var(--doc-line-soft, #f6f5f2);
  border: 1px solid var(--doc-border, rgba(0,0,0,0.06));
  cursor: pointer;
  transition: transform var(--dur-fast, 140ms) var(--ease-standard);
  will-change: transform;
}
.pl-photo:hover { transform: translateY(-1px); }
.pl-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.pl-photo:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--brand-glow, rgba(249,115,22,0.35));
}
@media (max-width: 480px) {
  .pl-photos { margin: 8px 16px 14px; grid-template-columns: repeat(2, 1fr); }
}
@media (prefers-reduced-motion: reduce) {
  .pl-photo { transition: none !important; }
}

/* ── Terms checkbox descriptor link ─────────────────────────── */
/* aria-describedby ties the checkbox to the terms <pre>; no visual
   change beyond a small focus-visible highlight. */
.pl-terms-wrap { position: relative; }
.pl-terms-wrap input[type="checkbox"]:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--brand-glow, rgba(249,115,22,0.35));
  border-radius: 4px;
}

/* ── One-shot reveal wrappers (defensive — in addition to the
   <RevealOnView> component's own inline transitions) ────────── */
.pl-reveal-once { will-change: transform, opacity; }
@media (prefers-reduced-motion: reduce) {
  .pl-reveal-once {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }
}

/* ── Stable containers wrapping dynamic message regions ─────── */
.pl-status-stack {
  /* Holds the stack of doc-status / pq-success-banner items. Reserves
     zero height when empty and lets each banner own its own height;
     contain:layout paint stops sibling reflow. */
  contain: layout paint;
  transform: translateZ(0);
}
