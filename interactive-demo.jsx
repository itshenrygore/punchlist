/* ═══════════════════════════════════════════════════════════════
 *  workflow.js — Phase-based quote lifecycle engine
 *
 *  The database keeps granular statuses for querying but the UI
 *  collapses them into 6 PHASES, each with exactly ONE primary
 *  action the contractor should take next.
 *
 *  Phases:
 *    draft    → "Finish and send this quote"
 *    sent     → "Waiting on customer"
 *    approved → "Schedule the job"
 *    active   → "Do the work, then mark complete"
 *    invoice  → "Send invoice, get paid"
 *    closed   → "Done — nothing to do"
 *
 *  Detours (not phases — they loop back):
 *    revision_requested → back to "draft" phase
 *    declined / expired → dead end, can duplicate
 * ═══════════════════════════════════════════════════════════════ */

// ── Phase mapping ────────────────────────────────────────────

const PHASE_MAP = {
  draft:                    'draft',
  sent:                     'sent',
  viewed:                   'sent',
  revision_requested:       'draft',
  needs_review:             'draft',
  declined:                 'closed',
  approved:                 'approved',
  approved_pending_deposit: 'approved',
  scheduled:                'active',
  completed:                'active',
  invoiced:                 'invoice',
  paid:                     'closed',
  overdue:                  'invoice',
  expired:                  'closed',
  cancelled:                'closed',
};

export function getPhase(quote) {
  if (!quote) return 'draft';
  return PHASE_MAP[quote.status] || 'draft';
}

// ── Phase metadata ──────────────────────────────────────────

export const PHASES = {
  draft:    { label: 'Draft',    tone: 'gray',   step: 0, bucket: 'needs_action' },
  sent:     { label: 'Sent',     tone: 'blue',   step: 1, bucket: 'waiting' },
  approved: { label: 'Approved', tone: 'teal',   step: 2, bucket: 'booked' },
  active:   { label: 'Active',   tone: 'purple', step: 3, bucket: 'booked' },
  invoice:  { label: 'Invoice',  tone: 'green',  step: 4, bucket: 'needs_action' },
  closed:   { label: 'Closed',   tone: 'amber',  step: 5, bucket: 'closed' },
};

// ── Status display metadata (backward compat: badges, filters) ──

export const STATUS_META = {
  draft:                    { label: 'Draft',           chip: 'Draft',          tone: 'draft',    bucket: 'needs_action' },
  sent:                     { label: 'Sent',            chip: 'Sent',           tone: 'sent',     bucket: 'waiting' },
  viewed:                   { label: 'Viewed',          chip: 'Sent',           tone: 'sent',     bucket: 'waiting' },
  revision_requested:       { label: 'Needs changes',   chip: 'Needs Changes',  tone: 'revision', bucket: 'needs_action' },
  declined:                 { label: 'Declined',        chip: 'Declined',       tone: 'declined', bucket: 'closed' },
  approved:                 { label: 'Approved',        chip: 'Approved',       tone: 'approved', bucket: 'booked' },
  approved_pending_deposit: { label: 'Deposit pending', chip: 'Approved',       tone: 'approved', bucket: 'booked' },
  scheduled:                { label: 'Scheduled',       chip: 'Scheduled',      tone: 'scheduled',bucket: 'booked' },
  completed:                { label: 'Completed',       chip: 'Completed',      tone: 'completed',bucket: 'booked' },
  invoiced:                 { label: 'Invoiced',        chip: 'Invoiced',       tone: 'invoiced', bucket: 'needs_action' },
  paid:                     { label: 'Paid',            chip: 'Paid',           tone: 'paid',     bucket: 'closed' },
  overdue:                  { label: 'Overdue',         chip: 'Overdue',        tone: 'overdue',  bucket: 'needs_action' },
  expired:                  { label: 'Expired',         chip: 'Expired',        tone: 'declined', bucket: 'closed' },
  needs_review:             { label: 'Needs Review',    chip: 'Needs Review',   tone: 'revision', bucket: 'needs_action' },
  cancelled:                { label: 'Cancelled',       chip: 'Cancelled',      tone: 'declined', bucket: 'closed' },
};

export function toneForStatus(status) {
  return STATUS_META[status]?.tone || 'draft';
}

export function chipForStatus(status) {
  return STATUS_META[status]?.chip || status || 'Unknown';
}

// ── Deposit helpers ─────────────────────────────────────────

export function labelForDeposit(depositStatus) {
  if (depositStatus === 'paid') return 'Paid';
  if (depositStatus === 'pending') return 'Pending';
  return 'Not required';
}

export function isDepositBlocking(quote) {
  return quote?.deposit_required && quote?.deposit_status !== 'paid';
}

// ── Primary action per phase ────────────────────────────────
// Returns { action, label, variant } — the ONE thing to show

export function getPrimaryAction(quote) {
  if (!quote) return null;
  const phase = getPhase(quote);
  const s = quote.status;

  switch (phase) {
    case 'draft':
      if (s === 'revision_requested') return { action: 'edit', label: 'Revise & resend', variant: 'primary' };
      if (s === 'needs_review')       return { action: 'edit', label: 'Review & send', variant: 'primary' };
      return { action: 'edit', label: 'Finish quote', variant: 'primary' };

    case 'sent':
      if ((quote.view_count || 0) > 0) return { action: 'follow_up', label: 'Follow up', variant: 'secondary' };
      return { action: 'wait', label: 'Waiting on customer', variant: 'muted' };

    case 'approved':
      if (isDepositBlocking(quote)) return { action: 'deposit', label: 'Deposit pending', variant: 'warning' };
      return { action: 'schedule', label: 'Schedule job', variant: 'primary' };

    case 'active':
      if (s === 'completed') return { action: 'invoice', label: 'Create invoice', variant: 'primary' };
      return { action: 'complete', label: 'Mark complete', variant: 'primary' };

    case 'invoice':
      if (s === 'overdue') return { action: 'remind', label: 'Send reminder', variant: 'warning' };
      return { action: 'collect', label: 'Awaiting payment', variant: 'secondary' };

    case 'closed':
      if (s === 'declined' || s === 'expired') return { action: 'duplicate', label: 'Duplicate quote', variant: 'secondary' };
      return null; // paid / cancelled — truly done

    default:
      return null;
  }
}

// ── Secondary actions (overflow menu) ───────────────────────

export function getSecondaryActions(quote) {
  if (!quote) return [];
  const phase = getPhase(quote);
  const actions = [];

  if (phase !== 'closed') {
    actions.push({ action: 'share', label: 'Copy link' });
  }

  switch (phase) {
    case 'draft':
      actions.push({ action: 'preview', label: 'Preview' });
      actions.push({ action: 'delete', label: 'Delete', destructive: true });
      break;
    case 'sent':
      actions.push({ action: 'resend', label: 'Resend' });
      actions.push({ action: 'edit', label: 'Edit quote' });
      break;
    case 'approved':
      actions.push({ action: 'additional_work', label: 'Add work' });
      break;
    case 'active':
      actions.push({ action: 'additional_work', label: 'Add work' });
      actions.push({ action: 'photos', label: 'Job photos' });
      break;
    case 'invoice':
      actions.push({ action: 'mark_paid', label: 'Mark as paid' });
      break;
    case 'closed':
      break;
  }

  actions.push({ action: 'duplicate', label: 'Duplicate' });
  if (phase !== 'draft') {
    actions.push({ action: 'pdf', label: 'View PDF' });
  }

  return actions;
}

// ── Context line ────────────────────────────────────────────
// FIX: viewed status no longer produces double-space when view_count === 1
// FIX: added needs_review and cancelled statuses

export function getContextLine(quote) {
  if (!quote) return '';
  const s = quote.status;
  const name = quote.customer?.name?.split(' ')[0] || 'Customer';

  if (s === 'draft')              return 'Not sent yet';
  if (s === 'needs_review')       return 'AI-generated — needs your review';
  if (s === 'sent')               return 'Sent — waiting for response';
  if (s === 'viewed') {
    const views = quote.view_count || 1;
    const ago = timeAgo(quote.last_viewed_at);
    return views > 1 ? `${name} viewed ${views}× ${ago}`.trim() : `${name} viewed ${ago}`.trim();
  }
  if (s === 'revision_requested') return `${name} requested changes`;
  if (s === 'declined')           return `${name} declined${quote.decline_reason ? ' — ' + quote.decline_reason : ''}`;
  if ((s === 'approved' || s === 'approved_pending_deposit') && isDepositBlocking(quote)) {
    return 'Approved — waiting on deposit';
  }
  if (s === 'approved' || s === 'approved_pending_deposit') return `${name} approved — ready to schedule`;
  if (s === 'scheduled') {
    const when = quote.scheduled_for ? formatShortDate(quote.scheduled_for) : 'TBD';
    return `Scheduled for ${when}`;
  }
  if (s === 'completed') return 'Job done — create invoice';
  if (s === 'invoiced')  return 'Invoice sent — awaiting payment';
  if (s === 'overdue')   return 'Payment overdue';
  if (s === 'paid')      return 'Paid in full';
  if (s === 'expired')   return 'Quote expired';
  if (s === 'cancelled') return 'Cancelled';
  return '';
}

// ── Progress stepper data ───────────────────────────────────
// FIX: last step label "Done" instead of "Closed" — more positive

export function getProgressSteps(quote) {
  const phase = getPhase(quote);
  const currentStep = PHASES[phase]?.step ?? 0;

  // Dead-end statuses: show a short 3-step path
  if (['declined', 'expired', 'cancelled'].includes(quote?.status)) {
    return [
      { label: 'Draft', done: true, current: false },
      { label: 'Sent',  done: true, current: false },
      { label: STATUS_META[quote.status]?.label || 'Closed', done: false, current: true, variant: 'danger' },
    ];
  }

  return [
    { label: 'Draft',    done: currentStep > 0, current: phase === 'draft' },
    { label: 'Sent',     done: currentStep > 1, current: phase === 'sent' },
    { label: 'Approved', done: currentStep > 2, current: phase === 'approved' },
    { label: 'Active',   done: currentStep > 3, current: phase === 'active' },
    { label: 'Invoice',  done: currentStep > 4, current: phase === 'invoice' },
    { label: 'Done',     done: currentStep > 5, current: phase === 'closed' },
  ];
}

// ── Signals (badges, not statuses) ──────────────────────────

export function getSignals(quote) {
  if (!quote) return [];
  const signals = [];

  if (quote.view_count > 0) {
    signals.push({ icon: '👁', label: `Viewed ${quote.view_count}×`, tone: 'info' });
  }

  if (quote.deposit_required) {
    if (quote.deposit_status === 'paid') {
      signals.push({ icon: '✓', label: 'Deposit paid', tone: 'success' });
    } else {
      signals.push({ icon: '$', label: 'Deposit pending', tone: 'warning' });
    }
  }

  if (quote.signed_at) {
    signals.push({ icon: '✍', label: 'Signed', tone: 'success' });
  }

  if (quote.expires_at && !['paid', 'completed', 'invoiced', 'expired'].includes(quote.status)) {
    const daysLeft = Math.ceil((new Date(quote.expires_at) - new Date()) / 86400000);
    if (daysLeft <= 3 && daysLeft > 0) {
      signals.push({ icon: '⏳', label: `Expires in ${daysLeft}d`, tone: 'warning' });
    }
  }

  if (quote.followed_up_at) {
    signals.push({ icon: '↩', label: `Followed up ${timeAgo(quote.followed_up_at)}`, tone: 'info' });
  }

  return signals;
}

// ── Follow-up advice ────────────────────────────────────────
// FIX: uses sent_at when available instead of updated_at

export function getFollowUpAdvice(quote) {
  if (!quote) return null;
  if (!['sent', 'viewed'].includes(quote.status)) return null;

  const sentDate = quote.sent_at || quote.updated_at;
  const daysSinceSent = Math.floor((Date.now() - new Date(sentDate)) / 86400000);
  const viewed = quote.view_count > 0;

  if (viewed && daysSinceSent >= 2) return { urgency: 'high',   message: 'They looked but haven\'t decided. Follow up now.' };
  if (!viewed && daysSinceSent >= 3) return { urgency: 'medium', message: 'No views yet. Resend or call.' };
  if (viewed && daysSinceSent < 2)   return { urgency: 'low',    message: 'Recently viewed — give them a day.' };
  return { urgency: 'low', message: 'Just sent — check back tomorrow.' };
}

// ── Public page: customer action gating ─────────────────────

export function getCustomerActions(quote) {
  if (!quote) return { canAct: false, canSign: false, canPay: false, showDepositButton: false, isClosedOut: true };

  const closedStatuses = ['invoiced', 'paid', 'expired', 'completed', 'scheduled', 'cancelled'];
  const isClosedOut = closedStatuses.includes(quote.status);
  const isSigned = !!quote.signed_at;
  const isApproved = ['approved', 'approved_pending_deposit'].includes(quote.status);
  const isDeclined = quote.status === 'declined';

  const canAct = !isClosedOut && !isSigned && !isApproved && !isDeclined;
  const canSign = canAct; // canAct already requires !isSigned
  const showDepositButton = isApproved && quote.deposit_required && quote.deposit_status !== 'paid';
  const canPay = showDepositButton;

  return { canAct, canSign, canPay, showDepositButton, isClosedOut };
}

// ── Quote lock check ────────────────────────────────────────

const LOCKED_STATUSES = ['approved', 'approved_pending_deposit', 'scheduled', 'completed', 'invoiced', 'paid'];

export function isQuoteLocked(quote) {
  if (!quote) return false;
  return LOCKED_STATUSES.includes(quote.status) || !!quote.signed_at;
}

// ── Dashboard bucket assignment ─────────────────────────────

export function getDashboardBucket(quote) {
  const phase = getPhase(quote);
  return PHASES[phase]?.bucket || 'needs_action';
}

// ── Timeline builder ────────────────────────────────────────
// FIX: word-boundary truncation with ellipsis character

export function buildTimeline(quote, bookings, invoice, amendments, additionalWork) {
  if (!quote) return [];
  const events = [];

  if (quote.created_at) events.push({ time: quote.created_at, label: 'Quote created', icon: '📝', type: 'system' });
  if (quote.sent_at || (quote.status !== 'draft' && quote.updated_at)) {
    events.push({ time: quote.sent_at || quote.updated_at, label: 'Sent to customer', icon: '📤', type: 'system' });
  }
  if (quote.first_viewed_at) events.push({ time: quote.first_viewed_at, label: `Customer opened${quote.view_count > 1 ? ` (viewed ${quote.view_count}×)` : ''}`, icon: '👁', type: 'system' });
  if (quote.signed_at) events.push({ time: quote.signed_at, label: `Signed by ${quote.signer_name || quote.customer?.name || 'customer'}`, icon: '✍', type: 'milestone' });
  if (quote.deposit_status === 'paid' && quote.deposit_paid_at) {
    events.push({ time: quote.deposit_paid_at, label: 'Deposit paid', icon: '💰', type: 'milestone' });
  }
  if (quote.status === 'revision_requested') {
    events.push({ time: quote.updated_at, label: 'Customer requested changes', icon: '✏️', type: 'action_needed' });
  }
  if (quote.status === 'declined') {
    events.push({ time: quote.updated_at, label: 'Customer declined', icon: '⚠️', type: 'action_needed' });
  }

  // Conversation entries
  if (Array.isArray(quote.conversation)) {
    quote.conversation.forEach(entry => {
      if (!entry.timestamp) return;
      const text = entry.text || '';
      const truncated = text.length > 80 ? text.slice(0, 80).replace(/\s+\S*$/, '') + '…' : text;
      const who = entry.role === 'customer' ? (quote.customer?.name?.split(' ')[0] || 'Customer') : 'You';
      events.push({
        time: entry.timestamp,
        label: `${who}: "${truncated}"`,
        icon: entry.role === 'customer' ? '💬' : '↩',
        type: entry.role === 'customer' ? 'customer_message' : 'contractor_message',
        data: entry,
      });
    });
  }

  // Bookings
  if (Array.isArray(bookings)) {
    bookings.forEach(b => {
      events.push({ time: b.created_at || b.scheduled_for, label: `Job scheduled for ${new Date(b.scheduled_for).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`, icon: '📅', type: 'milestone', data: b });
    });
  }

  // Amendments
  if (Array.isArray(amendments)) {
    amendments.forEach(a => {
      events.push({ time: a.created_at, label: `Amendment: ${a.title}`, icon: '📋', type: a.status === 'approved' ? 'milestone' : 'system', data: a, subtype: 'amendment' });
      if (a.signed_at) events.push({ time: a.signed_at, label: `Amendment signed by ${a.signer_name || 'customer'}`, icon: '✍', type: 'milestone' });
    });
  }

  // Additional work
  if (Array.isArray(additionalWork)) {
    additionalWork.forEach(aw => {
      events.push({ time: aw.created_at, label: `Additional work: ${aw.title}`, icon: '🔧', type: aw.status === 'approved' ? 'milestone' : 'system', data: aw, subtype: 'additional_work' });
      if (aw.approved_at) events.push({ time: aw.approved_at, label: 'Additional work approved', icon: '✓', type: 'milestone' });
    });
  }

  // Invoice
  if (invoice) {
    events.push({ time: invoice.created_at || invoice.issued_at, label: `Invoice ${invoice.invoice_number || ''} created`, icon: '🧾', type: 'system', data: invoice, subtype: 'invoice' });
    if (invoice.status === 'paid' && invoice.paid_at) events.push({ time: invoice.paid_at, label: 'Invoice paid in full', icon: '💰', type: 'milestone' });
  }

  if (quote.completed_at) events.push({ time: quote.completed_at, label: 'Job completed', icon: '🏁', type: 'milestone' });

  return events.sort((a, b) => new Date(a.time) - new Date(b.time));
}

// ── Helpers (exported for timeline display) ─────────────────

export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7)  return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export function summarizeDiff(oldItems = [], newItems = []) {
  const added = newItems.filter(n => !oldItems.some(o => o.description === n.description));
  const removed = oldItems.filter(o => !newItems.some(n => n.description === o.description));
  const parts = [];
  if (added.length) parts.push(`Added ${added.length} item${added.length > 1 ? 's' : ''}`);
  if (removed.length) parts.push(`Removed ${removed.length} item${removed.length > 1 ? 's' : ''}`);
  const priceChanged = newItems.some(n => {
    const match = oldItems.find(o => o.description === n.description);
    return match && match.unit_price !== n.unit_price;
  });
  if (priceChanged) parts.push('Pricing adjusted');
  return parts.join('. ') || '';
}

export function formatShortDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

// ── Smart follow-up message drafting ────────────────────────
// Generates contextual follow-up text based on quote state.
// Not AI-branded — contractor sees a well-written message and taps send.

export function draftFollowUp(quote, contractorName, quoteUrl) {
  const fn = quote.customer?.name?.split(' ')[0] || '';
  const hi = fn ? `Hi ${fn}` : 'Hi there';
  const title = quote.title || 'the work we discussed';
  const cn = contractorName || '';
  const sentDate = quote.sent_at || quote.updated_at;
  const daysSince = Math.floor((Date.now() - new Date(sentDate)) / 86400000);
  const views = quote.view_count || 0;
  const total = Number(quote.total || 0);

  // Monthly estimate at 12 months (matching Affirm/Klarna typical terms)
  const mo = total >= 500 ? Math.ceil(total / 12) : 0;
  const moLine = mo ? `\n\nJust so you know — there's a monthly payment option at about $${mo}/mo if that's easier.` : '';

  let body = '';

  if (views >= 3 && daysSince >= 2) {
    // High intent — multiple views, they're interested but hesitating
    body = `${hi}, I noticed you've looked at the quote for ${title} a few times. If anything's holding you back — pricing, timing, scope — I'm happy to work through it with you.${moLine}\n\nHere's the link: ${quoteUrl}\n\n${cn}`;
  } else if (views >= 1 && total >= 500 && daysSince >= 2) {
    // Viewed, sitting on it, high-value — lead with monthly option
    body = `${hi}, just following up on the quote for ${title}. Wanted to make sure you saw the monthly payment option — it works out to about $${mo}/mo instead of ${total > 999 ? '$' + Math.round(total).toLocaleString() : '$' + total} upfront.\n\nYou can approve right from the quote: ${quoteUrl}\n\n${cn}`;
  } else if (views >= 1 && daysSince >= 2) {
    // Viewed once, moderate value
    body = `${hi}, checking in on the quote for ${title}. Let me know if you'd like to adjust anything or have any questions — happy to make changes.${moLine}\n\n${quoteUrl}\n\n${cn}`;
  } else if (views === 0 && daysSince >= 3) {
    // Never opened — might have missed it
    body = `${hi}, wanted to make sure you got the quote I sent for ${title}. You can view and approve it here: ${quoteUrl}${moLine}\n\nLet me know if you'd like to go over it.\n\n${cn}`;
  } else if (views >= 1 && daysSince < 2) {
    // Recently viewed — gentle nudge
    body = `${hi}, following up on the quote for ${title}. I've got availability coming up and wanted to see if you're ready to get this scheduled: ${quoteUrl}\n\n${cn}`;
  } else {
    body = `${hi}, following up on the quote for ${title}: ${quoteUrl}${moLine}\n\n${cn}`;
  }

  return body;
}
