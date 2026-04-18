/* ═══════════════════════════════════════════════════════════════
 *  QuoteProgressBar styles
 *  Mobile-first: optimized for 375px (iPhone X)
 *  Design system: Rugged Graphite + brand orange #c65d21
 * ═══════════════════════════════════════════════════════════════ */

/* ── Stepper ── */
.qpb-stepper {
  display: flex;
  align-items: flex-start;
  padding: 16px 0 12px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.qpb-stepper::-webkit-scrollbar { display: none; }

.qpb-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  min-width: 0;
  flex: 1;
}

.qpb-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--panel-2, #f1f1f0);
  border: 2px solid var(--line, #e0e0de);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted, #888);
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

.qpb-dot-inner {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--muted, #888);
  opacity: 0.3;
}

.qpb-step--done .qpb-dot {
  background: var(--brand, #c65d21);
  border-color: var(--brand, #c65d21);
  color: #fff;
}

.qpb-step--current .qpb-dot {
  background: var(--brand, #c65d21);
  border-color: var(--brand, #c65d21);
  color: #fff;
  box-shadow: 0 0 0 3px rgba(198, 93, 33, 0.18);
}

.qpb-step--danger .qpb-dot {
  background: var(--red, #e24b4a);
  border-color: var(--red, #e24b4a);
  color: #fff;
}

.qpb-step-label {
  font-size: 10px;
  color: var(--muted, #888);
  margin-top: 4px;
  white-space: nowrap;
  letter-spacing: 0.02em;
  transition: color 0.15s;
}

.qpb-step--current .qpb-step-label {
  color: var(--text, #1a1a19);
  font-weight: 600;
}

.qpb-step--done .qpb-step-label {
  color: var(--brand, #c65d21);
}

.qpb-step--danger .qpb-step-label {
  color: var(--red, #e24b4a);
  font-weight: 600;
}

/* Connector line between dots */
.qpb-connector {
  position: absolute;
  top: 12px;
  left: calc(50% + 12px);
  right: calc(-50% + 12px);
  height: 2px;
  background: var(--line, #e0e0de);
  z-index: 0;
  transition: background 0.2s;
}

.qpb-connector--done {
  background: var(--brand, #c65d21);
}


/* ── Context line ── */
.qpb-context {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 0 12px;
}

.qpb-context-text {
  font-size: 13px;
  color: var(--muted, #888);
  line-height: 1.4;
  margin: 0;
}

.qpb-signals {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.qpb-signal {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 99px;
  background: var(--panel-2, #f1f1f0);
  color: var(--muted, #888);
  white-space: nowrap;
}

.qpb-signal-icon {
  font-size: 11px;
  line-height: 1;
}

.qpb-signal--info    { background: #e6f1fb; color: #185fa5; }
.qpb-signal--success { background: #eaf3de; color: #3b6d11; }
.qpb-signal--warning { background: #faeeda; color: #854f0b; }
.qpb-signal--danger  { background: #fcebeb; color: #a32d2d; }


/* ── Action bar ── */
.qpb-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0 4px;
  border-top: 1px solid var(--line, #e0e0de);
}

.qpb-primary-btn {
  flex: 1;
  min-height: 44px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
  border-radius: 8px;
}

.btn-warning {
  background: #faeeda;
  color: #854f0b;
  border: 1px solid #efc06e;
}
.btn-warning:hover  { background: #f5dfc0; }
.btn-warning:active { background: #efd5a8; }


/* Waiting state (not a button) */
.qpb-waiting {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  padding: 10px 14px;
  font-size: 13px;
  color: var(--muted, #888);
  background: var(--panel-2, #f1f1f0);
  border-radius: 8px;
  min-height: 44px;
}

.qpb-waiting-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--blue, #378add);
  animation: qpb-pulse 2s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes qpb-pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.9); }
  50%      { opacity: 1;   transform: scale(1.1); }
}


/* ── Overflow menu ── */
.qpb-overflow {
  position: relative;
}

.qpb-overflow-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--muted, #888);
  border: 1px solid var(--line, #e0e0de);
  background: transparent;
  transition: background 0.15s;
  padding: 0;
  -webkit-appearance: none;
  appearance: none;
}

.qpb-overflow-trigger:hover,
.qpb-overflow-trigger--open {
  background: var(--panel-2, #f1f1f0);
}

.qpb-overflow-menu {
  position: absolute;
  right: 0;
  top: 48px;
  min-width: 180px;
  background: var(--bg, #fff);
  border: 1px solid var(--line, #e0e0de);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  z-index: 50;
  padding: 4px;
  display: flex;
  flex-direction: column;
  animation: qpb-menu-in 0.12s ease-out;
}

@keyframes qpb-menu-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.qpb-overflow-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  font-size: 13px;
  color: var(--text, #1a1a19);
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s;
}

.qpb-overflow-item:hover  { background: var(--panel-2, #f1f1f0); }
.qpb-overflow-item:active { background: var(--line, #e0e0de); }

.qpb-overflow-item--danger {
  color: var(--red, #e24b4a);
}

/* Focus-visible for keyboard navigation */
.qpb-primary-btn:focus-visible,
.qpb-overflow-trigger:focus-visible,
.qpb-overflow-item:focus-visible {
  outline: 2px solid var(--brand, #c65d21);
  outline-offset: 2px;
}


/* ── Compact timeline ── */
.qpb-timeline {
  padding: 8px 0 12px;
  display: flex;
  flex-direction: column;
}

.qpb-timeline-event {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 5px 0;
  font-size: 12px;
  color: var(--muted, #888);
  border-left: 2px solid var(--line, #e0e0de);
  padding-left: 12px;
  margin-left: 6px;
}

.qpb-timeline-event:last-child {
  border-left-color: transparent;
}

.qpb-timeline-icon {
  font-size: 12px;
  flex-shrink: 0;
  width: 16px;
  text-align: center;
}

.qpb-timeline-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qpb-timeline-time {
  flex-shrink: 0;
  font-size: 11px;
  opacity: 0.7;
}


/* ── Bottom spacer (prevents sticky bar from covering content) ── */
.qpb-bottom-spacer {
  height: 0;
}


/* ── Closed-out banner (public page) ── */
.doc-status--closed {
  background: var(--panel-2, #f1f1f0);
  border: 1px solid var(--line, #e0e0de);
  color: var(--muted, #888);
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  margin-bottom: 12px;
}

.doc-status--closed .doc-status-icon {
  color: var(--brand, #c65d21);
}


/* ═══════════════════════════════════════════════════════════════
 *  Mobile — 375px iPhone X
 * ═══════════════════════════════════════════════════════════════ */
@media (max-width: 480px) {
  .qpb-stepper {
    padding: 12px 0 8px;
  }

  /* Readable minimum — never below 10px */
  .qpb-step-label {
    font-size: 10px;
  }

  /* Slightly smaller dots */
  .qpb-dot {
    width: 20px;
    height: 20px;
  }

  /* FIX: connector offset matches 20px dot (center = 10px) */
  .qpb-connector {
    top: 10px;
    left: calc(50% + 10px);
    right: calc(-50% + 10px);
  }

  /* Sticky bottom action bar */
  .qpb-actions {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
    background: var(--bg, #fff);
    border-top: 1px solid var(--line, #e0e0de);
    box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);
    z-index: 40;
  }

  /* Overflow menu opens UPWARD on mobile (not clipped by bottom) */
  .qpb-overflow-menu {
    top: auto;
    bottom: 48px;
    animation: qpb-menu-in-up 0.12s ease-out;
  }

  @keyframes qpb-menu-in-up {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* Spacer so content isn't hidden behind sticky bar */
  .qpb-bottom-spacer {
    height: calc(60px + env(safe-area-inset-bottom));
  }
}


/* ═══════════════════════════════════════════════════════════════
 *  Dark mode
 * ═══════════════════════════════════════════════════════════════ */
@media all {
  [data-theme="dark"] .qpb-signal--info    { background: #0c447c; color: #b5d4f4; }
  [data-theme="dark"] .qpb-signal--success { background: #27500a; color: #c0dd97; }
  [data-theme="dark"] .qpb-signal--warning { background: #633806; color: #fac775; }
  [data-theme="dark"] .qpb-signal--danger  { background: #791f1f; color: #f7c1c1; }

  [data-theme="dark"] .btn-warning {
    background: #633806;
    color: #fac775;
    border-color: #854f0b;
  }
  [data-theme="dark"] .btn-warning:hover  { background: #724010; }
  [data-theme="dark"] .btn-warning:active { background: #7d4812; }

  [data-theme="dark"] .qpb-waiting {
    background: var(--panel-2, #2a2a28);
  }

  [data-theme="dark"] .qpb-overflow-menu {
    background: var(--bg, #1a1a19);
    border-color: var(--line, #333);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  }

  [data-theme="dark"] .qpb-overflow-trigger:hover,
  [data-theme="dark"] .qpb-overflow-trigger--open {
    background: var(--panel-2, #2a2a28);
  }

  [data-theme="dark"] .doc-status--closed {
    background: var(--panel-2, #2a2a28);
    border-color: var(--line, #333);
  }
}
