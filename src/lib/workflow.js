/* ═══════════════════════════════════════════════════════════════
 *  Punchlist 2.0 — Quote lifecycle
 *
 *  8 active statuses + 2 terminal:
 *
 *    draft                  → "Finish and send this quote"
 *    sent                   → "Waiting on customer"
 *    viewed                 → Customer opened it
 *    revision_requested     → Customer asked for changes
 *    approved               → Customer said yes (no deposit)
 *    approved_pending_deposit → Approved, deposit outstanding
 *    deposit_paid           → Deposit received, work starting
 *    declined               → Customer said no (terminal)
 *    converted_to_invoice   → Invoice created (terminal)
 *    paid                   → Money received — done (terminal)
 *    expired                → Quote lapsed (terminal)
 * ═══════════════════════════════════════════════════════════════ */

// ── Status metadata ──────────────────────────────────────────

export const STATUS_META = {
  draft:                    { label: 'Draft',             chip: 'Draft',             tone: 'draft',    color: 'var(--muted, #667085)' },
  sent:                     { label: 'Sent',              chip: 'Sent',              tone: 'sent',     color: 'var(--blue, #3B82F6)' },
  viewed:                   { label: 'Viewed',            chip: 'Viewed',            tone: 'sent',     color: 'var(--blue, #3B82F6)' },
  revision_requested:       { label: 'Revision',          chip: 'Revision',          tone: 'draft',    color: 'var(--amber, #D97706)' },
  approved:                 { label: 'Approved',          chip: 'Approved',          tone: 'approved', color: 'var(--green, #0F7A50)' },
  approved_pending_deposit: { label: 'Deposit pending',   chip: 'Deposit pending',   tone: 'approved', color: 'var(--amber, #D97706)' },
  deposit_paid:             { label: 'Deposit paid',      chip: 'Deposit paid',      tone: 'approved', color: 'var(--green, #0F7A50)' },
  declined:                 { label: 'Declined',          chip: 'Declined',          tone: 'declined', color: 'var(--red, #DC2626)' },
  converted_to_invoice:     { label: 'Invoiced',          chip: 'Invoiced',          tone: 'paid',     color: 'var(--green, #0F7A50)' },
  paid:                     { label: 'Paid',              chip: 'Paid',              tone: 'paid',     color: 'var(--green, #0F7A50)' },
  expired:                  { label: 'Expired',           chip: 'Expired',           tone: 'declined', color: 'var(--muted, #667085)' },
  // Invoice display statuses (derived at render time, not stored)
  partial:                  { label: 'Partial',           chip: 'Partial',           tone: 'approved', color: 'var(--amber, #D97706)' },
  overdue:                  { label: 'Overdue',           chip: 'Overdue',           tone: 'declined', color: 'var(--red, #DC2626)' },
};

// Legacy status mapping — old statuses fold into canonical 2.0 statuses
const LEGACY_MAP = {
  draft: 'draft',
  sent: 'sent',
  viewed: 'viewed',
  revision_requested: 'revision_requested',
  needs_review: 'revision_requested',
  question_asked: 'revision_requested',
  declined: 'declined',
  approved: 'approved',
  approved_pending_deposit: 'approved_pending_deposit',
  deposit_paid: 'deposit_paid',
  scheduled: 'approved',
  completed: 'deposit_paid',
  invoiced: 'converted_to_invoice',
  converted_to_invoice: 'converted_to_invoice',
  paid: 'paid',
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
    case 'draft':                    return { label: 'Send quote', action: 'send' };
    case 'sent':                     return { label: 'Nudge customer', action: 'nudge' };
    case 'viewed':                   return { label: 'Nudge customer', action: 'nudge' };
    case 'revision_requested':       return { label: 'Update quote', action: 'edit' };
    case 'approved':                 return { label: 'Create invoice', action: 'invoice' };
    case 'approved_pending_deposit': return { label: 'Mark deposit paid', action: 'deposit' };
    case 'deposit_paid':             return { label: 'Create invoice', action: 'invoice' };
    case 'converted_to_invoice':     return { label: 'View invoice', action: 'view_invoice' };
    case 'paid':                     return { label: 'Done', action: 'none' };
    case 'declined':                 return { label: 'Duplicate & re-send', action: 'duplicate' };
    case 'expired':                  return { label: 'Duplicate & re-send', action: 'duplicate' };
    default:                         return { label: 'View', action: 'view' };
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

const LOCKED_STATUSES = ['approved', 'approved_pending_deposit', 'deposit_paid', 'converted_to_invoice', 'paid'];

export function isQuoteLocked(quote) {
  if (!quote) return false;
  return LOCKED_STATUSES.includes(normalizeStatus(quote.status)) || !!quote.signed_at;
}

// ── Timeline steps (for quote detail progress bar) ──────────

export function getTimelineSteps(quote) {
  if (!quote) return [];
  const s = normalizeStatus(quote.status);
  const stepOrder = ['draft', 'sent', 'approved', 'deposit_paid', 'converted_to_invoice'];
  const currentIdx = stepOrder.indexOf(s);

  if (['declined', 'expired'].includes(s)) {
    return [
      { label: 'Draft', done: true, current: false },
      { label: 'Sent', done: true, current: false },
      { label: STATUS_META[s]?.label || 'Closed', done: false, current: true, variant: 'danger' },
    ];
  }

  if (s === 'revision_requested') {
    return [
      { label: 'Draft', done: true, current: false },
      { label: 'Sent', done: true, current: false },
      { label: 'Revision', done: false, current: true, variant: 'warning' },
    ];
  }

  if (s === 'approved_pending_deposit') {
    return [
      { label: 'Draft', done: true, current: false },
      { label: 'Sent', done: true, current: false },
      { label: 'Approved', done: true, current: false },
      { label: 'Deposit pending', done: false, current: true },
    ];
  }

  const displaySteps = ['draft', 'sent', 'approved', 'deposit_paid', 'converted_to_invoice'];
  return displaySteps.map((step, i) => ({
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
  if (!quote) return { canAct: false, canSign: false, showDepositButton: false, isClosedOut: false };
  const s = normalizeStatus(quote.status);
  const ACTIONABLE = new Set(['sent', 'viewed', 'revision_requested']);
  const CLOSED = new Set(['declined', 'expired']);
  const canAct = ACTIONABLE.has(s);
  const canSign = canAct;
  const showDepositButton = s === 'approved_pending_deposit' && quote.deposit_required && quote.deposit_status !== 'paid';
  const isClosedOut = CLOSED.has(s);
  return { canAct, canSign, showDepositButton, isClosedOut };
}

// Used by api/quotes.js
export function summarizeDiff() { return ''; }
