export const STATUS_META = {
  draft:                    { label: 'Draft',           chip: 'Draft',          tone: 'draft',    bucket: 'needs_action' },
  sent:                     { label: 'Sent',            chip: 'Sent',           tone: 'sent',     bucket: 'waiting' },
  viewed:                   { label: 'Viewed',          chip: 'Sent',           tone: 'sent',     bucket: 'waiting' },
  revision_requested:       { label: 'Needs changes',  chip: 'Needs Changes',  tone: 'revision', bucket: 'needs_action' },
  declined:                 { label: 'Declined',        chip: 'Declined',       tone: 'declined', bucket: 'needs_action' },
  approved:                 { label: 'Approved',        chip: 'Approved',       tone: 'approved', bucket: 'booked' },
  approved_pending_deposit: { label: 'Approved',        chip: 'Approved',       tone: 'approved', bucket: 'booked' },
  scheduled:                { label: 'Scheduled',       chip: 'Scheduled',      tone: 'scheduled',bucket: 'booked' },
  completed:                { label: 'Completed',       chip: 'Completed',      tone: 'completed',bucket: 'closed' },
  invoiced:                 { label: 'Invoiced',        chip: 'Invoiced',       tone: 'invoiced', bucket: 'closed' },
  paid:                     { label: 'Paid',            chip: 'Paid',           tone: 'paid',     bucket: 'closed' },
  partial:                  { label: 'Partial',         chip: 'Partial',        tone: 'invoiced', bucket: 'closed' },
  overdue:                  { label: 'Overdue',         chip: 'Overdue',        tone: 'overdue',  bucket: 'needs_action' },
  expired:                  { label: 'Expired',         chip: 'Expired',        tone: 'declined', bucket: 'closed' },
  needs_review:             { label: 'Needs Review',    chip: 'Needs Review',   tone: 'revision', bucket: 'needs_action' },
  cancelled:                { label: 'Cancelled',       chip: 'Cancelled',      tone: 'declined', bucket: 'closed' },
};

export const DEPOSIT_META = {
  not_required: { label: 'No deposit required', tone: 'draft' },
  requested:    { label: 'Deposit requested',   tone: 'deposit' },
  pending:      { label: 'Deposit pending',     tone: 'deposit' },
  paid:         { label: 'Deposit paid',        tone: 'approved' },
};

export const BUCKET_META = {
  needs_action: { label: 'Needs Action', color: 'var(--amber)', empty: "You're all caught up 👍" },
  waiting:      { label: 'Waiting',      color: '#2563eb',      empty: 'No quotes waiting on customers' },
  booked:       { label: 'Booked',       color: 'var(--green)', empty: 'No approved or scheduled jobs' },
  closed:       { label: 'Closed',       color: 'var(--muted)', empty: 'No completed or declined quotes' },
};

export function labelForStatus(status) {
  return STATUS_META[status]?.label || String(status || 'Draft').replace(/_/g, ' ');
}

export function chipForStatus(status) {
  return STATUS_META[status]?.chip || labelForStatus(status);
}

export function labelForDeposit(status) {
  return DEPOSIT_META[status]?.label || String(status || 'not_required').replace(/_/g, ' ');
}

export function toneForStatus(status) {
  return STATUS_META[status]?.tone || 'draft';
}

export function bucketForStatus(status) {
  return STATUS_META[status]?.bucket || 'needs_action';
}

export function getNextStep(quote = {}) {
  if (!quote.customer_id) return 'Link a customer';
  if (!quote.line_items?.length && !quote.item_count) return 'Add scope items';
  if (quote.status === 'draft') return 'Finish & send';
  if (quote.status === 'sent') return 'Waiting for reply';
  if (quote.status === 'viewed') return 'Follow up';
  if (quote.status === 'revision_requested') return 'Update & resend';
  if (quote.status === 'declined') return 'Review or duplicate';
  if (quote.deposit_required && quote.deposit_status !== 'paid' &&
      ['approved','approved_pending_deposit'].includes(quote.status)) return 'Collect deposit';
  if (['approved','approved_pending_deposit'].includes(quote.status)) return 'Schedule job';
  if (quote.status === 'scheduled') return 'Prepare for job';
  if (quote.status === 'completed') return 'Create invoice';
  if (quote.status === 'invoiced') return 'Follow up on payment';
  if (quote.status === 'paid') return 'Job complete';
  return 'Keep it moving';
}

export function getQuoteSignals(quote = {}) {
  const signals = [];
  if (quote.view_count > 0 && ['sent','viewed'].includes(quote.status)) {
    const ago = quote.last_viewed_at ? relativeTimeShort(quote.last_viewed_at) : null;
    signals.push({ icon: '👀', text: ago ? `Viewed ${ago}` : `Viewed ${quote.view_count}×` });
  }
  if (quote.deposit_required && !['paid','not_required'].includes(quote.deposit_status || '')) {
    signals.push({ icon: '💰', text: 'Deposit pending' });
  }
  const daysLeft = quote.expires_at
    ? Math.ceil((new Date(quote.expires_at) - Date.now()) / 86400000)
    : null;
  if (daysLeft !== null && daysLeft <= 3 && daysLeft >= 0 && !['approved','approved_pending_deposit','scheduled','completed'].includes(quote.status)) {
    signals.push({ icon: '⏳', text: daysLeft === 0 ? 'Expires today' : `Expires in ${daysLeft}d` });
  }
  // Check for customer questions/notes in internal_notes
  const hasQuestion = String(quote.internal_notes || '').includes('Question');
  if (hasQuestion) signals.push({ icon: '💬', text: 'Customer question' });
  return signals;
}

function relativeTimeShort(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return null;
}

export function summarizeDiff(previousItems = [], nextItems = []) {
  const before = new Map(previousItems.map(i => [String(i.name || '').trim().toLowerCase(), i]));
  const after  = new Map(nextItems.map(i => [String(i.name || '').trim().toLowerCase(), i]));
  const changes = [];
  for (const [key, item] of after) {
    if (!before.has(key)) { changes.push(`Added ${item.name}`); continue; }
    const old = before.get(key);
    const oldTotal = Number(old.quantity||0)*Number(old.unit_price||0);
    const newTotal = Number(item.quantity||0)*Number(item.unit_price||0);
    if (Math.abs(oldTotal-newTotal) > 0.01) changes.push(`Updated ${item.name}`);
  }
  for (const [key, item] of before) {
    if (!after.has(key)) changes.push(`Removed ${item.name}`);
  }
  return changes.slice(0,5).join(' • ');
}

/* ═══════════════════════════════════════════
   Smart Follow-Up Timing — Phase 4D
   Pattern-based follow-up suggestions
   ═══════════════════════════════════════════ */

export function getFollowUpAdvice(quote = {}) {
  if (!['sent', 'viewed'].includes(quote.status)) return null;

  const views = quote.view_count || 0;
  const daysSinceSent = Math.floor((Date.now() - new Date(quote.updated_at || quote.created_at).getTime()) / 86400000);
  const daysSinceLastView = quote.last_viewed_at
    ? Math.floor((Date.now() - new Date(quote.last_viewed_at).getTime()) / 86400000)
    : null;
  const channel = quote.delivery_method || 'email';
  const hasFollowedUp = Boolean(quote.follow_up_at);
  const daysSinceFollowUp = quote.follow_up_at
    ? Math.floor((Date.now() - new Date(quote.follow_up_at).getTime()) / 86400000)
    : null;

  // Pattern: Actively comparing — viewed multiple times recently
  if (views >= 3 && daysSinceLastView !== null && daysSinceLastView <= 2) {
    return {
      emoji: '🔥',
      headline: 'Hot lead — they keep coming back',
      advice: `Viewed ${views} times in ${daysSinceSent} day${daysSinceSent !== 1 ? 's' : ''}. They're likely comparing quotes. A quick call or text offering to answer questions could close this.`,
      urgency: 'high',
    };
  }

  // Pattern: Opened once, went quiet
  if (views >= 1 && daysSinceLastView !== null && daysSinceLastView >= 3 && daysSinceLastView <= 7) {
    return {
      emoji: '❄️',
      headline: 'Going cold — re-engage now',
      advice: `Opened ${daysSinceLastView} days ago but hasn't come back. Try a different channel${channel === 'email' ? ' — a text message might cut through' : ' — an email recap with updated info could help'}.`,
      urgency: 'medium',
    };
  }

  // Pattern: Never opened
  if (views === 0 && daysSinceSent >= 2) {
    const channelTip = channel === 'email'
      ? 'Email may have been missed or filtered. Try sending via text.'
      : 'Text might not have been seen. Try sending by email.';
    return {
      emoji: '📭',
      headline: 'Never opened',
      advice: `Sent ${daysSinceSent} days ago with no views. ${channelTip}${daysSinceSent >= 5 ? ' Verify the contact info is correct.' : ''}`,
      urgency: daysSinceSent >= 5 ? 'high' : 'medium',
    };
  }

  // Pattern: Viewed once, recently — still in consideration
  if (views === 1 && daysSinceLastView !== null && daysSinceLastView <= 2) {
    return {
      emoji: '👀',
      headline: 'Viewed once — give them space',
      advice: 'They opened it recently. Give it another day or two before following up — you don\'t want to come across as pushy.',
      urgency: 'low',
    };
  }

  // Pattern: Already followed up, but no response
  if (hasFollowedUp && daysSinceFollowUp !== null && daysSinceFollowUp >= 3 && views <= 1) {
    return {
      emoji: '🔄',
      headline: 'Follow-up didn\'t land',
      advice: `You followed up ${daysSinceFollowUp} days ago with no response. Consider a phone call — it stands out when everyone else is just texting.`,
      urgency: 'medium',
    };
  }

  // Pattern: Multiple views over many days — extended comparison
  if (views >= 2 && daysSinceSent >= 5) {
    return {
      emoji: '⚖️',
      headline: 'Extended consideration',
      advice: `${views} views over ${daysSinceSent} days — they're seriously considering it. Offer a time-limited incentive or ask if they have questions.`,
      urgency: 'medium',
    };
  }

  // Default: too soon
  if (daysSinceSent < 2) {
    return {
      emoji: '⏱️',
      headline: 'Just sent',
      advice: 'Give it a day or two. Most customers respond within 48 hours.',
      urgency: 'low',
    };
  }

  return null;
}

export function buildQuickTemplatePacks(trade = 'Other') {
  const base = {
    Plumbing: [
      { name: 'Site protection and cleanup', category: 'Prep', unit_price: 95 },
      { name: 'Materials and fittings', category: 'Materials', unit_price: 185 },
      { name: 'Disposal and haul-away', category: 'Finish', unit_price: 65 },
    ],
    HVAC: [
      { name: 'Equipment setup and protection', category: 'Prep', unit_price: 120 },
      { name: 'Material and fasteners', category: 'Materials', unit_price: 220 },
      { name: 'Commissioning and final checks', category: 'Finish', unit_price: 110 },
    ],
    Electrical: [
      { name: 'Circuit isolation and safety setup', category: 'Prep', unit_price: 90 },
      { name: 'Materials and connectors', category: 'Materials', unit_price: 160 },
      { name: 'Testing and tidy-up', category: 'Finish', unit_price: 80 },
    ],
    Other: [
      { name: 'Site prep and protection', category: 'Prep', unit_price: 90 },
      { name: 'Materials', category: 'Materials', unit_price: 150 },
      { name: 'Cleanup and disposal', category: 'Finish', unit_price: 65 },
    ],
  };
  return base[trade] || base.Other;
}

// ════════════════════════════════════════════
// PHASE 6: Quote Event Timeline
// ════════════════════════════════════════════

/**
 * buildTimeline — derives a chronological event list from a quote object.
 * @param {object} quote   Full quote row (with line_items, customer, etc.)
 * @param {object[]} bookings  All bookings (filtered by quote_id externally)
 * @param {object|null} invoice  Linked invoice, if any
 * @returns {Array<{date, label, icon, detail}>}
 */
export function buildTimeline(quote, bookings = [], invoice = null) {
  const events = [];

  function push(iso, label, icon, detail = null) {
    if (!iso) return;
    events.push({ date: new Date(iso), label, icon, detail });
  }

  // Created
  push(quote.created_at, 'Quote created', '📝', quote.title || null);

  // Sent — infer from first_viewed_at being set or status progression
  // We don't store sent_at explicitly; use updated_at when status became sent
  // Best proxy: if status is not draft, there was a send event around creation
  if (quote.status !== 'draft' && quote.created_at) {
    // Sent usually happens same day or shortly after creation
    // Use updated_at as "last modified" — if > created_at, show it
    const updatedAt = new Date(quote.updated_at);
    const createdAt = new Date(quote.created_at);
    if (updatedAt - createdAt > 30000) { // more than 30s gap = meaningful update
      push(quote.updated_at, 'Quote last updated', '✏️');
    }
  }

  // First viewed
  if (quote.first_viewed_at) {
    const viewDetail = quote.view_count > 1 ? `Viewed ${quote.view_count} times total` : null;
    push(quote.first_viewed_at, 'Customer viewed quote', '👀', viewDetail);
  }

  // Conversation entries
  const conversation = Array.isArray(quote.conversation) ? quote.conversation : [];
  for (const entry of conversation) {
    if (!entry.timestamp) continue;
    if (entry.role === 'customer') {
      push(entry.timestamp, `Customer question`, '💬', entry.text?.slice(0, 80) || null);
    } else if (entry.role === 'contractor') {
      push(entry.timestamp, 'You replied', '↩️', entry.text?.slice(0, 80) || null);
    }
  }

  // Revision requested
  if (quote.status === 'revision_requested') {
    push(quote.updated_at, 'Revision requested', '🔄', quote.revision_summary || null);
  }

  // Signed / approved
  if (quote.signed_at) {
    push(quote.signed_at, `Signed by ${quote.signer_name || 'customer'}`, '✍️');
  } else if (quote.approved_at) {
    push(quote.approved_at, 'Quote approved', '✅');
  }

  // Declined
  if (quote.declined_at) {
    push(quote.declined_at, 'Quote declined', '❌');
  }

  // Bookings
  for (const b of bookings) {
    const label = b.status === 'cancelled'
      ? `Job cancelled`
      : b.status === 'completed'
      ? `Job completed`
      : `Job scheduled`;
    const icon = b.status === 'cancelled' ? '🚫' : b.status === 'completed' ? '🏁' : '📅';
    push(b.scheduled_for, label, icon, b.notes || null);
  }

  // Invoiced
  if (['invoiced','paid'].includes(quote.status) && invoice) {
    push(invoice.issued_at || invoice.created_at, `Invoice ${invoice.invoice_number || 'created'}`, '🧾', null);
    if (invoice.status === 'paid' && invoice.paid_at) {
      push(invoice.paid_at, 'Invoice paid', '💰', null);
    }
  }

  // Sort ascending by date
  events.sort((a, b) => a.date - b.date);

  return events;
}
