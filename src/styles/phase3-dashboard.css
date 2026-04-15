/* ═══════════════════════════════════════════════════════════════
   Phase 3 — Dashboard + Quotes List additive styles.
   Imported after phase2-public-quote.css. Additive only — no
   existing class in index.css, document.css, phase1-builder.css,
   or phase2-public-quote.css is overridden or shadowed.
   Adds: dashboard stat grid (2-up → 4-up), transform-only hover
         lift on stat cells, page-header kicker row tweak, empty
         + error Card frames, iOS-zoom-safe search row, tabstrip
         with sliding-underline (pseudo-element, translate3d +
         scaleX — never width), quotes-list skeleton rows, stable
         hover wrap for SwipeableRow, semantic status chips
         (dot + label, never color-only), stable-height list
         container.
   Every keyframe animates transform + opacity only — never
   width / height / top / left / margin. Every animated class
   has a prefers-reduced-motion override.
   ═══════════════════════════════════════════════════════════════ */

/* ── Dashboard stat grid — 2-up phone, 4-up desktop ────────── */
.pl-stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3, 12px);
  contain: layout paint;
  margin: 0 0 var(--space-5, 20px);
}
@media (min-width: 720px) {
  .pl-stat-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-4, 16px);
  }
}

/* Stat cell — transform-only hover lift. The <Card> primitive
   already paints the surface; this class adds the hover delta. */
.pl-stat-cell {
  text-decoration: none;
  color: inherit;
  will-change: transform;
  transform: translate3d(0, 0, 0);
  transition:
    transform var(--dur-base, 220ms) var(--ease-standard, cubic-bezier(.2,.7,.3,1)),
    box-shadow var(--dur-base, 220ms) var(--ease-standard, cubic-bezier(.2,.7,.3,1)),
    border-color var(--dur-fast, 140ms) var(--ease-standard, cubic-bezier(.2,.7,.3,1));
}
.pl-stat-cell:hover,
.pl-stat-cell:focus-visible {
  transform: translate3d(0, -2px, 0);
  border-color: var(--brand, #ff7a3b);
}
.pl-stat-cell:focus-visible {
  outline: 2px solid var(--brand, #ff7a3b);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .pl-stat-cell,
  .pl-stat-cell:hover,
  .pl-stat-cell:focus-visible {
    transform: none;
    transition: border-color var(--dur-fast, 140ms) linear;
  }
}

/* ── Dashboard page header tweak ─────────────────────────── */
/* Consumed on the greeting PageHeader to tighten to the stat
   grid below. Does not override PageHeader's own inline style —
   just adds a small-screen bump when kicker wraps. */
.pl-dash-header {
  /* reserved for future — currently a no-op marker class */
}

/* ── Empty-state / error Card frames (dashboard + quotes) ── */
.pl-empty-card {
  display: grid;
  place-items: center;
  text-align: center;
  gap: var(--space-3, 12px);
  contain: layout paint;
}
.pl-empty-card .pl-empty-glyph {
  font-size: 32px;
  line-height: 1;
  opacity: 0.9;
}
.pl-empty-card .pl-empty-title {
  font-size: clamp(1.125rem, 2.4vw, 1.375rem);
  line-height: var(--lh-tight, 1.15);
  letter-spacing: var(--tracking-tight, -0.01em);
  margin: 0;
  color: var(--text, #14161a);
  font-weight: 600;
}
.pl-empty-card .pl-empty-body {
  margin: 0;
  max-width: 48ch;
  font-size: var(--text-md, 15px);
  line-height: var(--lh-normal, 1.5);
  color: var(--text-2, #4a5060);
}
.pl-empty-card .pl-empty-actions {
  display: flex;
  gap: var(--space-2, 8px);
  flex-wrap: wrap;
  justify-content: center;
  margin-top: var(--space-2, 8px);
}

.pl-err-card {
  display: grid;
  place-items: center;
  text-align: center;
  gap: var(--space-2, 8px);
  contain: layout paint;
}
.pl-err-card .pl-err-title {
  margin: 0;
  font-weight: 600;
  color: var(--red, #ef4444);
}
.pl-err-card .pl-err-body {
  margin: 0;
  color: var(--text-2, #4a5060);
  font-size: var(--text-md, 15px);
  max-width: 48ch;
}

/* ── iOS-zoom-safe search input row ──────────────────────── */
/* Any <input> inside gets 16px minimum on phones to defeat
   Safari's auto-zoom on focus. Container participates in the
   flex row that already exists — just relaxes font-size. */
.pl-search-safe {
  display: flex;
  gap: var(--space-2, 8px);
  align-items: center;
  margin-bottom: var(--space-3, 12px);
  contain: layout paint;
}
.pl-search-safe .input,
.pl-search-safe input[type="search"],
.pl-search-safe input[type="text"] {
  font-size: 16px;  /* iOS zoom threshold */
}
@media (min-width: 720px) {
  .pl-search-safe .input,
  .pl-search-safe input[type="search"],
  .pl-search-safe input[type="text"] {
    font-size: var(--text-md, 15px);
  }
}

/* ── Tabstrip (quotes-list status tabs) ──────────────────── */
/* Scrollable horizontally on phones. Active indicator is a
   pseudo-element positioned at bottom; animates via
   translate3d + scaleX only — never width / left. */
.pl-tabstrip {
  position: relative;
  display: flex;
  gap: 2px;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding: 0 0 2px;
  margin: 0 0 var(--space-3, 12px);
  border-bottom: 1px solid var(--line, #e4e6eb);
  contain: layout paint;
}
.pl-tabstrip::-webkit-scrollbar { display: none; }

.pl-tab {
  position: relative;
  flex: 0 0 auto;
  padding: 10px 14px;
  font-size: var(--text-sm, 13px);
  font-weight: 600;
  color: var(--text-2, #4a5060);
  background: transparent;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  border-radius: 10px 10px 0 0;
  transition:
    color var(--dur-fast, 140ms) var(--ease-standard, cubic-bezier(.2,.7,.3,1)),
    background var(--dur-fast, 140ms) var(--ease-standard, cubic-bezier(.2,.7,.3,1));
  font-family: inherit;
}
.pl-tab::after {
  content: '';
  position: absolute;
  left: 10%;
  right: 10%;
  bottom: -1px;
  height: 2px;
  background: var(--brand, #ff7a3b);
  border-radius: 2px 2px 0 0;
  transform: translate3d(0, 0, 0) scaleX(0);
  transform-origin: 50% 50%;
  transition: transform var(--dur-base, 220ms) var(--ease-emphasis, cubic-bezier(.22,1,.36,1));
  pointer-events: none;
  will-change: transform;
}
.pl-tab:hover {
  color: var(--text, #14161a);
  background: var(--surface-2, rgba(0,0,0,0.04));
}
.pl-tab.is-active {
  color: var(--brand, #ff7a3b);
}
.pl-tab.is-active::after {
  transform: translate3d(0, 0, 0) scaleX(1);
}
.pl-tab:focus-visible {
  outline: 2px solid var(--brand, #ff7a3b);
  outline-offset: -2px;
}
@media (prefers-reduced-motion: reduce) {
  .pl-tab,
  .pl-tab::after {
    transition: none;
  }
  .pl-tab.is-active::after {
    transform: translate3d(0, 0, 0) scaleX(1);
  }
}

/* ── Quotes-list row wrapper — stable min-height, hover ──── */
.pl-ql-list {
  contain: layout paint;
}
.pl-ql-row-wrap {
  position: relative;
  min-height: 64px;
  contain: layout paint;
  transform: translate3d(0, 0, 0);
  transition: transform var(--dur-fast, 140ms) var(--ease-standard, cubic-bezier(.2,.7,.3,1));
  will-change: transform;
}
.pl-ql-row-wrap:hover {
  transform: translate3d(0, -1px, 0);
}
@media (prefers-reduced-motion: reduce) {
  .pl-ql-row-wrap,
  .pl-ql-row-wrap:hover {
    transform: none;
    transition: none;
  }
}

/* Stable-height list container — prevents layout jump between
   loading skeleton, empty state, and populated list. */
.pl-ql-container {
  min-height: 240px;
  contain: layout paint;
}

/* ── Skeleton rows (loading state, opacity-pulse only) ───── */
.pl-skel-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
  contain: layout paint;
}
.pl-skel-row {
  height: 64px;
  border-radius: var(--r, 14px);
  background: linear-gradient(
    90deg,
    var(--surface-2, rgba(0,0,0,0.04)) 0%,
    var(--line, #e4e6eb) 50%,
    var(--surface-2, rgba(0,0,0,0.04)) 100%
  );
  animation: pl-skel-pulse 1.4s ease-in-out infinite;
  will-change: opacity;
}
.pl-stat-skel {
  min-height: 92px;
  border-radius: var(--r-lg, 18px);
  background: var(--surface-2, rgba(0,0,0,0.04));
  border: 1px solid var(--line, #e4e6eb);
  animation: pl-skel-pulse 1.4s ease-in-out infinite;
  will-change: opacity;
}
@keyframes pl-skel-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.55; }
}
@media (prefers-reduced-motion: reduce) {
  .pl-skel-row,
  .pl-stat-skel {
    animation: none;
    opacity: 0.8;
  }
}

/* ── Semantic status chips — dot + label, never color-only ─ */
.pl-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px 3px 8px;
  font-size: var(--text-xs, 11px);
  font-weight: 600;
  letter-spacing: var(--tracking-loose, 0.02em);
  border-radius: 999px;
  background: var(--surface-2, rgba(0,0,0,0.04));
  color: var(--text-2, #4a5060);
  border: 1px solid var(--line, #e4e6eb);
  white-space: nowrap;
  line-height: 1.4;
}
.pl-chip::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
  flex: 0 0 auto;
}
.pl-chip--draft     { color: var(--muted, #8a90a0); }
.pl-chip--sent      { color: var(--blue, #3b82f6); }
.pl-chip--viewed    { color: #a78bfa; }
.pl-chip--approved  { color: var(--green, #22c55e); }
.pl-chip--scheduled { color: var(--brand, #ff7a3b); }
.pl-chip--declined  { color: var(--red, #ef4444); }
.pl-chip--expired   { color: var(--amber, #f59e0b); }
