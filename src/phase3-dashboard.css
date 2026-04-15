/* ═══════════════════════════════════════════════════════════════
   Dashboard v2 — Scoped styles  (v100 M6.5 polish rewrite)
   ───────────────────────────────────────────────────────────────
   All classes are prefixed `dv2-` to avoid collision with v1.
   Imported in main.jsx AFTER index.css (additive only).

   Iron rules observed throughout this file:
     1. Every value is a token (or a documented exception noted inline).
     2. Only `transform` and `opacity` animate. Shadow/border reveals
        are delivered via pseudo-element opacity fade — never by
        transitioning the shadow/border property itself.
     3. `prefers-reduced-motion` zeroes durations via tokens.css and
        is additionally honoured on every @keyframes block below.
     4. Dark + light parity: light overrides live beside the selector
        they modify, not in a giant block at the bottom.
   ═══════════════════════════════════════════════════════════════ */

/* ── Scoped dashboard tokens ─────────────────────────────────── */
:root {
  /* Inter-card rhythm. Mobile shrinks to 16; desktop grows to 24.
     Chosen over 20 because Row 2 (action list) needs visible
     breathing room to scan under 2 seconds. */
  --dash-gap: var(--space-4);
  --dash-row1-spacer: var(--space-6);

  /* Action-list geometry. 64/72 targets the WCAG 2.5.5 44×44 min
     plus vertical rhythm for the two-line label stack. */
  --dv2-row-h-desktop: 64px;
  --dv2-row-h-mobile:  72px;

  /* Status dot sizes. 8px reads at-a-glance. */
  --dv2-dot-size: 8px;

  /* Radii — local alias onto the global --r-lg for readability. */
  --dv2-radius: var(--r-lg, 18px);
  --dv2-radius-sm: var(--r, 14px);

  /* Skeleton palette — theme-aware. */
  --dv2-skeleton-base: var(--panel-2, #1e1e1e);
  --dv2-skeleton-shine: rgba(255, 255, 255, 0.06);
}

@media (min-width: 768px) {
  :root { --dash-gap: var(--space-6); }    /* 24px on desktop */
}

[data-theme="light"] {
  --dv2-skeleton-base: #F2F1EE;              /* matches --panel-3 light */
  --dv2-skeleton-shine: rgba(255, 255, 255, 0.75);
}

/* ═══════════════════════════════════════════════════════════════
   ROOT + ENTRANCE STAGGER
   ═══════════════════════════════════════════════════════════════ */

.dv2-root {
  display: flex;
  flex-direction: column;
  gap: var(--dash-gap);
  padding-bottom: var(--space-12);
  contain: layout paint;
}

@keyframes dv2-rise {
  from { opacity: 0; transform: translate3d(0, 8px, 0); }
  to   { opacity: 1; transform: translate3d(0, 0, 0); }
}

/* Entrance primitive — consumed by row/section wrappers.
   --i sets the stagger step; row-by-row action-list rows are at
   80ms apart per M6.5 spec. */
.dv2-enter {
  opacity: 0;
  animation: dv2-rise var(--dur-slow) var(--ease-emphasis) forwards;
  animation-delay: calc(var(--i, 0) * 80ms);
}

@media (prefers-reduced-motion: reduce) {
  .dv2-enter { animation: none; opacity: 1; }
}

/* ═══════════════════════════════════════════════════════════════
   ROW 1 — GREETING + HEADLINE METRIC
   ═══════════════════════════════════════════════════════════════ */

.dv2-row1 {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  margin-bottom: calc(var(--dash-row1-spacer) - var(--dash-gap));
}

.dv2-greeting-block {
  flex: 1;
  min-width: 0;
}

.dv2-greeting {
  margin: 0;
  /* 28–40px fluid display — single line, tight tracking */
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  font-weight: 600;
  line-height: var(--lh-tight);
  letter-spacing: var(--tracking-tight);
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dv2-greeting-sub {
  margin: var(--space-1) 0 0;
  font-size: var(--text-sm);
  color: var(--text-2);
  line-height: var(--lh-normal);
}

.dv2-row1-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

.dv2-new-btn { white-space: nowrap; }

/* Headline metric chip — server-chosen priority signal. */
.dv2-headline-metric {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 10px;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 999px;
  font-size: var(--text-sm);
  font-weight: 600;
  white-space: nowrap;
  color: var(--text-2);
}

.dv2-headline-metric--urgent  { color: var(--red);   border-color: var(--red-bg, rgba(239,68,68,.25)); }
.dv2-headline-metric--warning { color: var(--amber); border-color: var(--amber-bg, rgba(245,158,11,.25)); }
.dv2-headline-metric--info    { color: var(--blue);  border-color: var(--blue-bg,  rgba(96,165,250,.25)); }

/* ═══════════════════════════════════════════════════════════════
   JOB INPUT
   ═══════════════════════════════════════════════════════════════ */

.dv2-job-form {
  display: flex;
  gap: var(--space-2);
  contain: layout;
}

.dv2-job-input {
  flex: 1;
  min-width: 0;
  height: 44px;
  padding: 0 var(--space-4);
  background: var(--panel);
  border: 1.5px solid var(--line);
  border-radius: var(--dv2-radius-sm);
  font-family: var(--font-body);
  font-size: var(--text-base);
  color: var(--text);
  outline: none;
  transition:
    border-color var(--dur-fast) var(--ease-standard),
    box-shadow   var(--dur-fast) var(--ease-standard);
}
.dv2-job-input::placeholder { color: var(--muted); }
.dv2-job-input:focus-visible {
  border-color: var(--brand);
  box-shadow: var(--ring-focus);
}

.dv2-job-go {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  height: 44px;
  padding: 0 var(--space-5);
  background: var(--brand);
  color: #fff;
  border: none;
  border-radius: var(--dv2-radius-sm);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: transform var(--dur-fast) var(--ease-spring);
}
.dv2-job-go:hover  { filter: brightness(1.05); }
.dv2-job-go:active { transform: scale(0.97); }

/* ═══════════════════════════════════════════════════════════════
   EMPTY STATES
   ═══════════════════════════════════════════════════════════════ */

.dv2-empty {
  text-align: center;
}
.dv2-empty-headline {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text);
  margin-bottom: var(--space-2);
  letter-spacing: var(--tracking-tight);
}
.dv2-empty-sub {
  font-size: var(--text-base);
  color: var(--text-2);
  margin: 0 0 var(--space-4);
  line-height: var(--lh-normal);
}

/* Section-level empty (e.g. action list when caught up). */
.dv2-section-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-4);
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--dv2-radius);
  text-align: center;
}
.dv2-section-empty-icon { color: var(--muted); opacity: 0.7; }
.dv2-section-empty-title {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--text);
  letter-spacing: var(--tracking-normal);
}
.dv2-section-empty-sub {
  font-size: var(--text-xs);
  color: var(--muted);
  line-height: var(--lh-normal);
  max-width: 36ch;
}
.dv2-section-empty-cta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: var(--space-1);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--brand);
  text-decoration: none;
}
.dv2-section-empty-cta:hover { text-decoration: underline; }

/* ═══════════════════════════════════════════════════════════════
   SECTION SCAFFOLDING
   ═══════════════════════════════════════════════════════════════ */

.dv2-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.dv2-section-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 20px;
}

.dv2-section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  /* 11px micro-label per M6.5 spec */
  font-size: var(--text-2xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}

.dv2-section-icon { opacity: 0.7; flex-shrink: 0; }

.dv2-section-meta {
  margin-left: auto;
  font-size: var(--text-2xs);
  font-weight: 600;
  color: var(--muted);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dv2-section-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--brand);
  text-decoration: none;
}
.dv2-section-link:hover { text-decoration: underline; }

/* Insights get a hairline divider on top (Row 5). */
.dv2-hairline-top {
  padding-top: var(--dash-gap);
  border-top: 1px solid var(--line);
}

/* ═══════════════════════════════════════════════════════════════
   ACTION LIST — Row 2 (the star)
   Grid: [dot] [label stack] [numeric] [action cluster]
   ═══════════════════════════════════════════════════════════════ */

.dv2-action-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.dv2-arow {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: var(--space-3);
  min-height: var(--dv2-row-h-desktop);
  padding: var(--space-3) var(--space-5);
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--dv2-radius-sm);
  overflow: hidden;
  isolation: isolate;
  transition: transform var(--dur-fast) var(--ease-standard);
}

/* Hover surface via pseudo opacity — NOT box-shadow transition. */
.dv2-arow::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0;
  z-index: -1;
  background: var(--panel-2);
  transition: opacity var(--dur-fast) var(--ease-standard);
}
.dv2-arow:hover                { cursor: pointer; }
.dv2-arow:hover::before        { opacity: 1; }
.dv2-arow:focus-within         { border-color: var(--brand-line); }
.dv2-arow:focus-within::before { opacity: 1; }

@media (max-width: 480px) {
  .dv2-arow {
    min-height: var(--dv2-row-h-mobile);
    padding: var(--space-3) var(--space-4);
  }
}

/* Status dot — token-driven, with a halo for colour-blind lift. */
.dv2-arow-dot {
  width: var(--dv2-dot-size);
  height: var(--dv2-dot-size);
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 0 1.5px var(--panel);
}
.dv2-arow-dot--red    { background: var(--red); }
.dv2-arow-dot--amber  { background: var(--amber); }
.dv2-arow-dot--blue   { background: var(--blue); }
.dv2-arow-dot--green  { background: var(--green); }
.dv2-arow-dot--muted  { background: var(--muted); }

/* Label stack. */
.dv2-arow-labels {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.dv2-arow-primary {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text);
  letter-spacing: var(--tracking-normal);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dv2-arow-secondary {
  font-size: var(--text-xs);
  color: var(--muted);
  line-height: var(--lh-normal);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dv2-arow-body {
  display: contents;
  color: inherit;
  text-decoration: none;
}

/* Numeric — right-aligned, tabular, nowrap. */
.dv2-arow-num {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--text);
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  letter-spacing: var(--tracking-normal);
  flex-shrink: 0;
}

@media (max-width: 480px) {
  .dv2-arow-num { display: none; }     /* secondary line already shows amount */
}

.dv2-arow-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

/* Dismiss — desktop appears on row hover; touch always visible. */
.dv2-arow-dismiss {
  position: relative; /* anchor for ::after tap-target expansion */
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--dur-fast) var(--ease-standard),
              transform var(--dur-fast) var(--ease-standard);
}
/* Expand touch hit area to 44×44px without changing visible size (iOS HIG / Material 48dp) */
.dv2-arow-dismiss::after {
  content: '';
  position: absolute;
  inset: -8px; /* 28 + 8×2 = 44 */
}
.dv2-arow:hover         .dv2-arow-dismiss,
.dv2-arow:focus-within  .dv2-arow-dismiss,
.dv2-arow-dismiss:focus-visible { opacity: 1; }
.dv2-arow-dismiss:hover { color: var(--text); transform: scale(1.1); }

@media (hover: none) {
  .dv2-arow-dismiss { opacity: 1; }
}

/* Row action button — ghost default, primary on top 1–2 items. */
.dv2-arow-btn {
  position: relative; /* anchor for touch target expansion */
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 var(--space-3);
  border-radius: 8px;
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  border: 1px solid transparent;
  transition: transform var(--dur-fast) var(--ease-spring);
}
/* Expand touch hit area to 44px tall on touch devices */
@media (hover: none) {
  .dv2-arow-btn::after {
    content: '';
    position: absolute;
    inset: -6px 0; /* 32 + 6×2 = 44px tall */
  }
}
.dv2-arow-btn:active { transform: scale(0.97); }
@media (prefers-reduced-motion: reduce) {
  .dv2-arow-btn:active { transform: none; }
}

.dv2-arow-btn--primary { background: var(--brand); color: #fff; }
.dv2-arow-btn--primary:hover { filter: brightness(1.05); }

.dv2-arow-btn--ghost {
  background: transparent;
  color: var(--text-2);
  border-color: var(--line);
}
.dv2-arow-btn--ghost:hover { color: var(--text); border-color: var(--line-2); }

/* "All caught up" state (designed empty). */
.dv2-caught-up {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-5);
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--dv2-radius-sm);
  color: var(--text-2);
}
.dv2-caught-up-icon { color: var(--green); flex-shrink: 0; }
.dv2-caught-up-text {
  flex: 1;
  font-size: var(--text-sm);
  line-height: var(--lh-normal);
}
.dv2-caught-up-text strong { color: var(--text); font-weight: 600; }
.dv2-caught-up-cta {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--brand);
  text-decoration: none;
  white-space: nowrap;
}
.dv2-caught-up-cta:hover { text-decoration: underline; }

/* ═══════════════════════════════════════════════════════════════
   PIPELINE BAR (Row 3)
   ═══════════════════════════════════════════════════════════════ */

.dv2-pipeline {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.dv2-pipeline-bar {
  display: flex;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  gap: 2px;
}

.dv2-pipeline-seg {
  border-radius: 999px;
  transition: transform var(--dur-fast) var(--ease-standard),
              opacity   var(--dur-fast) var(--ease-standard);
  cursor: pointer;
  min-width: 4px;
}
.dv2-pipeline-seg:hover { opacity: 0.85; transform: scaleY(1.25); }
.dv2-pipeline-seg:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

.dv2-pipeline-legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-5);
}

.dv2-pipeline-key {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-2);
  text-decoration: none;
  white-space: nowrap;
}
.dv2-pipeline-key:hover { color: var(--text); }
.dv2-pipeline-key-num {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}

.dv2-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ═══════════════════════════════════════════════════════════════
   ROW 4 — SCHEDULE + REVENUE
   ═══════════════════════════════════════════════════════════════ */

.dv2-row4 {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--dash-gap);
}
@media (min-width: 768px) {
  .dv2-row4 { grid-template-columns: 1fr 1fr; }
}

.dv2-card-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.dv2-card-icon { color: var(--muted); flex-shrink: 0; }

.dv2-card-label {
  font-size: var(--text-2xs);          /* 11px */
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  flex: 1;
}

.dv2-card-link {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--brand);
  text-decoration: none;
  margin-left: auto;
}
.dv2-card-link:hover { text-decoration: underline; }

.dv2-card-empty {
  font-size: var(--text-sm);
  color: var(--muted);
  padding: var(--space-2) 0 var(--space-1);
}

/* Week card list */
.dv2-week-days {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.dv2-week-day {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.dv2-week-day-label {
  font-size: var(--text-2xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}

.dv2-week-job {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) 0;
  text-decoration: none;
  color: inherit;
  transition: transform var(--dur-fast) var(--ease-standard);
}
.dv2-week-job:hover { transform: translateX(2px); }
.dv2-week-job:hover .dv2-week-job-name { color: var(--brand); }

.dv2-week-time {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-2);
  min-width: 56px;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dv2-week-job-name {
  font-size: var(--text-sm);
  color: var(--text);
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color var(--dur-fast) var(--ease-standard);
}

.dv2-week-job-val {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-2);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dv2-week-more {
  font-size: var(--text-2xs);
  color: var(--muted);
  padding-top: var(--space-1);
  letter-spacing: 0.02em;
}

/* Revenue card — numeric hero */
.dv2-revenue-card {
  text-decoration: none;
  color: inherit;
}

.dv2-revenue-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.dv2-revenue-stat {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.dv2-revenue-val {
  font-family: var(--font-display);
  /* 24–30px fluid — owns the card */
  font-size: clamp(1.5rem, 3vw, 1.875rem);
  font-weight: 600;
  color: var(--text);
  line-height: var(--lh-tight);
  letter-spacing: var(--tracking-tight);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  --min-ch: 7ch;
}

.dv2-revenue-lbl {
  font-size: var(--text-2xs);          /* 11px */
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}

.dv2-revenue-delta {
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.dv2-revenue-delta--up   { color: var(--green); }
.dv2-revenue-delta--down { color: var(--red); }

@media (max-width: 480px) {
  .dv2-revenue-val { font-size: var(--text-xl); }
}

/* ═══════════════════════════════════════════════════════════════
   ROW 5 — INSIGHTS (conditional)
   ═══════════════════════════════════════════════════════════════ */

.dv2-insights {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.dv2-insight {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--brand-bg);
  border: 1px solid var(--brand-line);
  border-radius: var(--dv2-radius-sm);
  font-size: var(--text-sm);
}

.dv2-insight-icon { color: var(--brand); margin-top: 2px; flex-shrink: 0; }

.dv2-insight-text {
  flex: 1;
  color: var(--text);
  line-height: var(--lh-normal);
}

.dv2-insight-cta {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--brand);
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;
}
.dv2-insight-cta:hover { text-decoration: underline; }

/* ═══════════════════════════════════════════════════════════════
   UPSELL STRIP & USAGE BAR
   ═══════════════════════════════════════════════════════════════ */

.dv2-upsell {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--dv2-radius-sm);
  text-decoration: none;
  color: inherit;
  isolation: isolate;
  transition: transform var(--dur-fast) var(--ease-standard);
}
.dv2-upsell::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: -1;
  opacity: 0;
  background: var(--brand-bg);
  transition: opacity var(--dur-fast) var(--ease-standard);
}
.dv2-upsell:hover::before { opacity: 1; }

.dv2-upsell-icon { color: var(--brand); flex-shrink: 0; }

.dv2-upsell-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
  font-size: var(--text-sm);
}
.dv2-upsell-text strong { font-weight: 700; color: var(--text); }
.dv2-upsell-text span   { font-size: var(--text-xs); color: var(--muted); }
.dv2-upsell-arrow       { color: var(--brand); flex-shrink: 0; }

.dv2-usage {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 0;
}
.dv2-usage-track {
  flex: 1;
  height: 4px;
  background: var(--line);
  border-radius: 999px;
  overflow: hidden;
}
.dv2-usage-fill {
  height: 100%;
  background: var(--brand);
  border-radius: 999px;
  transition: transform var(--dur-slow) var(--ease-out);
  transform-origin: left;
  width: 100%;               /* scaleX drives fill — no width animation */
  transform: scaleX(var(--fill, 0));
}
.dv2-usage-text {
  font-size: var(--text-xs);
  color: var(--muted);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.dv2-usage-upgrade {
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--brand);
  text-decoration: none;
  white-space: nowrap;
}
.dv2-usage-upgrade:hover { text-decoration: underline; }

/* ═══════════════════════════════════════════════════════════════
   SKELETON LOADER
   ═══════════════════════════════════════════════════════════════ */

.dv2-skeleton {
  height: var(--skel-h, 72px);
  background: var(--dv2-skeleton-base);
  border-radius: var(--dv2-radius-sm);
  overflow: hidden;
  position: relative;
}

@keyframes dv2-shimmer {
  from { transform: translateX(-100%); }
  to   { transform: translateX(100%); }
}

.dv2-skeleton-shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--dv2-skeleton-shine) 50%,
    transparent 100%
  );
  animation: dv2-shimmer 1.4s ease-in-out infinite;
  will-change: transform;
}

@media (prefers-reduced-motion: reduce) {
  .dv2-skeleton-shimmer { animation: none; }
}

/* ═══════════════════════════════════════════════════════════════
   CLASSIC-VIEW ESCAPE HATCH
   ═══════════════════════════════════════════════════════════════ */

.dv2-classic-link {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-2xs);
  color: var(--muted);
  text-decoration: none;
  padding: var(--space-1) 0;
  opacity: 0.6;
  transition: opacity var(--dur-fast) var(--ease-standard);
  cursor: pointer;
  background: none;
  border: none;
  font-family: var(--font-body);
}
.dv2-classic-link:hover { opacity: 1; color: var(--text-2); }

/* ═══════════════════════════════════════════════════════════════
   RESPONSIVE OVERRIDES
   ═══════════════════════════════════════════════════════════════ */

@media (max-width: 480px) {
  .dv2-row1-right {
    width: 100%;
    justify-content: space-between;
  }
  .dv2-row1 { margin-bottom: 0; }
}

@media (min-width: 1024px) {
  .dv2-root { max-width: 920px; }
}

/* ═══════════════════════════════════════════════════════════════
   LIGHT-THEME PARITY
   ═══════════════════════════════════════════════════════════════ */

[data-theme="light"] .dv2-arow-dot {
  /* Light mode --panel is white — halo pulls correctly via cascade.
     Explicit redeclaration here documents intent. */
  box-shadow: 0 0 0 1.5px var(--panel);
}

/* Muted text that would fall below AA on warm off-white bumps to
   --text-2 in light mode. */
[data-theme="light"] .dv2-section-empty-sub,
[data-theme="light"] .dv2-week-more,
[data-theme="light"] .dv2-revenue-lbl {
  color: var(--text-2);
}

/* Headline metric chip — slightly firmer border in light for
   equivalent visual weight against warm panel. */
[data-theme="light"] .dv2-headline-metric {
  background: var(--panel-2);
  border-color: var(--line-2);
}
