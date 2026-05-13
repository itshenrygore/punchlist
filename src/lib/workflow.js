/* ═══════════════════════════════════════════════════════════════
 *  Punchlist 2.0 — Simplified quote lifecycle
 *
 *  4 statuses. No phase engine. No bucket system.
 *
 *    draft    → "Finish and send this quote"
 *    sent     → "Waiting on customer"
 *    approved → "Customer said yes"
 *    paid     → "Money received — done"
 *
 *  Derived states (no dedicated status needed):
 *    viewed   → quote.first_viewed_at is not null
 *    expired  → quote.expires_at < now() AND status = 'sent'
 *    declined → terminal (kept as status for filtering)
 * ═══════════════════════════════════════════════════════════════ */

// ── Status metadata ──────────────────────────────────────────

export const STATUS_META = {
  draft:    { label: 'Draft',    chip: 'Draft',    tone: 'draft',    color: 'var(--muted, #667085)' },
  sent:     { label: 'Sent',     chip: 'Sent',     tone: 'sent',     color: 'var(--blue, #3B82F6)' },
  approved: { label: 'Approved', chip: 'Approved',  tone: 'approved', color: 'var(--green, #0F7A50)' },
  paid:     { label: 'Paid',     chip: 'Paid',      tone: 'paid',    color: 'var(--green, #0F7A50)' },
  declined: { label: 'Declined', chip: 'Declined',  tone: 'declined', color: 'var(--red, #DC2626)' },
  expired:  { label: 'Expired',  chip: 'Expired',   tone: 'declined', color: 'var(--muted, #667085)' },
};

// Legacy status mapping — old statuses fold into 4 core states
const LEGACY_MAP = {
  draft: 'draft',
  sent: 'sent',
  viewed: 'sent',
  revision_requested: 'draft',
  needs_review: 'draft',
  declined: 'declined',
  approved: 'approved',
  approved_pending_deposit: 'approved',
  scheduled: 'approved',
  completed: 'approved',
  invoiced: 'paid',
  paid: 'paid',
  overdue: 'approved',
  expired: 'expired',
  cancelled: 'declined',
};

/**
 * Normalize any legacy status to 2.0 status.
 * Safe to call on already-normalized statuses.
 */
export function normalizeStatus(status) {
  return LEGACY_MAP[status] || status || 'draft';
}

export function toneForStatus(status) {
  const s = normalizeStatus(status);
  return STATUS_META[s]?.tone || 'draft';
}

export function chipForStatus(status) {
  const s = normalizeStatus(status);
  return STATUS_META[s]?.chip || status || 'Unknown';
}

export function colorForStatus(status) {
  const s = normalizeStatus(status);
  return STATUS_META[s]?.color || 'var(--muted)';
}

// ── Primary action per status ────────────────────────────────

export function getNextAction(quote) {
  if (!quote) return { label: 'Create quote', action: 'create' };
  const s = normalizeStatus(quote.status);

  switch (s) {
    case 'draft':    return { label: 'Send quote', action: 'send' };
    case 'sent':     return { label: 'Nudge customer', action: 'nudge' };
    case 'approved': return { label: 'View details', action: 'view' };
    case 'paid':     return { label: 'Done', action: 'none' };
    case 'declined': return { label: 'Duplicate & re-send', action: 'duplicate' };
    case 'expired':  return { label: 'Duplicate & re-send', action: 'duplicate' };
    default:         return { label: 'View', action: 'view' };
  }
}

// ── Context actions (overflow menu) ──────────────────────────

export function getContextActions(quote) {
  if (!quote) return [];
  const s = normalizeStatus(quote.status);
  const actions = [];

  if (s !== 'paid') actions.push({ label: 'Edit quote', action: 'edit' });
  if (s === 'sent') actions.push({ label: 'Nudge', action: 'nudge' });
  if (s !== 'draft') actions.push({ label: 'Copy link', action: 'copy_link' });
  actions.push({ label: 'Duplicate', action: 'duplicate' });
  actions.push({ label: 'Download PDF', action: 'pdf' });
  if (['draft', 'expired', 'declined'].includes(s)) {
    actions.push({ label: 'Delete', action: 'delete', danger: true });
  }

  return actions;
}

// ── Signals (badges, not statuses) ──────────────────────────

export function getSignals(quote) {
  if (!quote) return [];
  const signals = [];

  // Viewed signal
  if (quote.first_viewed_at && normalizeStatus(quote.status) === 'sent') {
    const views = quote.view_count || 1;
    signals.push({
      type: 'viewed',
      label: views === 1 ? 'Viewed' : `Viewed ${views}×`,
      tone: 'info',
    });
  }

  // Deposit signal
  if (quote.deposit_required && normalizeStatus(quote.status) === 'approved') {
    if (quote.deposit_status === 'paid') {
      signals.push({ type: 'deposit', label: 'Deposit paid', tone: 'success' });
    } else {
      signals.push({ type: 'deposit', label: 'Deposit pending', tone: 'warning' });
    }
  }

  // Expiring soon
  if (quote.expires_at && normalizeStatus(quote.status) === 'sent') {
    const daysLeft = Math.ceil((new Date(quote.expires_at) - new Date()) / 86400000);
    if (daysLeft <= 3 && daysLeft > 0) {
      signals.push({ type: 'expiring', label: `Expires in ${daysLeft}d`, tone: 'warning' });
    } else if (daysLeft <= 0) {
      signals.push({ type: 'expired', label: 'Expired', tone: 'danger' });
    }
  }

  return signals;
}

// ── Quote locked check ──────────────────────────────────────

const LOCKED_STATUSES = ['approved', 'paid'];

export function isQuoteLocked(quote) {
  if (!quote) return false;
  return LOCKED_STATUSES.includes(normalizeStatus(quote.status)) || !!quote.signed_at;
}

// ── Timeline steps (for quote detail progress bar) ──────────

export function getTimelineSteps(quote) {
  if (!quote) return [];
  const s = normalizeStatus(quote.status);
  const stepOrder = ['draft', 'sent', 'approved', 'paid'];
  const currentIdx = stepOrder.indexOf(s);

  if (['declined', 'expired'].includes(s)) {
    return [
      { label: 'Draft', done: true, current: false },
      { label: 'Sent', done: true, current: false },
      { label: STATUS_META[s]?.label || 'Closed', done: false, current: true, variant: 'danger' },
    ];
  }

  return stepOrder.map((step, i) => ({
    label: STATUS_META[step]?.label || step,
    done: i < currentIdx,
    current: i === currentIdx,
  }));
}

// ═══════════════════════════════════════════
// LEGACY STUBS — Functions removed in 2.0 that existing components
// still reference. These return safe empty/default values so the app
// doesn't crash. Remove as each component is refactored.
// ═══════════════════════════════════════════

// Used by quote-progress-bar.jsx
export function getPhase(quote) {
  return normalizeStatus(quote?.status);
}

export const PHASES = {
  draft:    { label: 'Draft',    tone: 'gray',   step: 0 },
  sent:     { label: 'Sent',     tone: 'blue',   step: 1 },
  approved: { label: 'Approved', tone: 'teal',   step: 2 },
  paid:     { label: 'Paid',     tone: 'green',  step: 3 },
};

export function getProgressSteps(quote) {
  return getTimelineSteps(quote);
}

export function getPrimaryAction(quote) {
  return getNextAction(quote);
}

export function getSecondaryActions(quote) {
  return [];
}

export function getContextLine(quote) {
  if (!quote) return '';
  const s = normalizeStatus(quote.status);
  if (s === 'sent' && quote.first_viewed_at) return 'Customer has viewed this quote';
  if (s === 'sent') return 'Waiting for customer response';
  if (s === 'approved') return 'Customer approved — ready for payment';
  return '';
}

// Used by public-quote-view.jsx
export function getCustomerActions(quote) {
  if (!quote) return [];
  const s = normalizeStatus(quote.status);
  if (s === 'sent') return [{ action: 'approve', label: 'Approve Quote' }];
  if (s === 'approved') return [{ action: 'pay', label: 'Pay Now' }];
  return [];
}

// Used by api/quotes.js
export function summarizeDiff() { return ''; }
