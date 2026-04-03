import { supabase, friendly, _badCols, stripBadCols, learnBadColumns, _lineItemsBadCols } from './shared.js';
import { calculateTotals } from '../pricing';
import { makeId } from '../utils';
import { summarizeDiff } from '../workflow';

const QUOTE_SELECT = [
  'id', 'title', 'status', 'total', 'subtotal', 'tax', 'created_at', 'updated_at', 'sent_at',
  'customer_id', 'share_token', 'description', 'scope_summary',
  'follow_up_at', 'trade', 'expires_at',
  'deposit_required', 'deposit_amount', 'deposit_status',
  'revision_number', 'revision_summary',
  'view_count', 'first_viewed_at', 'last_viewed_at', 'delivery_method', 'internal_notes',
  'signature_data', 'signed_at', 'signer_name', 'archived_at',
  'quote_number',
  'line_items:line_items(id)',
  'customer:customers(name,email,phone)',
].join(',');

export async function listQuotes(_userId) {
  const { data, error } = await supabase
    .from('quotes')
    .select(QUOTE_SELECT)
    .order('updated_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(friendly(error));
  return (data || []).map(q => ({ ...q, item_count: q.line_items?.length || 0 }));
}

export async function listQuotesPaginated(_userId, { cursor = null, limit = 30, status = null } = {}) {
  let q = supabase
    .from('quotes')
    .select(QUOTE_SELECT)
    .order('updated_at', { ascending: false })
    .limit(limit + 1);
  if (status) q = q.eq('status', status);
  if (cursor) q = q.lt('updated_at', cursor);
  const { data, error } = await q;
  if (error) throw new Error(friendly(error));
  const rows = data || [];
  const hasMore = rows.length > limit;
  const quotes = rows.slice(0, limit).map(r => ({ ...r, item_count: r.line_items?.length || 0 }));
  const nextCursor = hasMore && quotes.length ? quotes[quotes.length - 1].updated_at : null;
  return { quotes, nextCursor, hasMore };
}

function buildQuotePayload(userId, draft) {
  const province = draft.province || 'ON';
  const country = draft.country || 'CA';
  const totals = calculateTotals(draft.line_items || [], province, country);
  const discount = Math.max(0, Number(draft.discount || 0));
  const discountedSubtotal = Math.max(0, totals.subtotal - discount);
  const discountedTax = discountedSubtotal * totals.rate;
  const discountedTotal = discountedSubtotal + discountedTax;
  const expiryDays = Number(draft.expiry_days || 14);
  const depositRequired = Boolean(draft.deposit_required);
  const depositPercent = Number(draft.deposit_percent || 0);
  const manualAmount = Number(draft.deposit_amount || 0);
  const depositAmount = depositRequired && depositPercent > 0 ? Math.round(discountedSubtotal * depositPercent / 100) : manualAmount;
  const depositStatus = depositRequired ? (draft.deposit_status || (depositAmount > 0 ? 'requested' : 'not_required')) : 'not_required';
  const payload = {
    user_id: userId,
    customer_id: draft.customer_id || null,
    title: draft.title || draft.description?.slice(0, 80) || 'Untitled quote',
    description: draft.description || '',
    status: draft.status || 'draft',
    total: discountedTotal,
    trade: draft.trade || null,
    province,
    deposit_required: depositRequired,
    deposit_amount: depositAmount,
    deposit_percent: depositPercent,
    deposit_status: depositStatus,
    expiry_days: expiryDays,
    updated_at: new Date().toISOString(),
    subtotal: totals.subtotal,
    tax: discountedTax,
    discount,
    scope_summary: draft.scope_summary || '',
    assumptions: draft.assumptions || '',
    exclusions: draft.exclusions || '',
    internal_notes: draft.internal_notes || '',
    follow_up_at: draft.follow_up_at || null,
    confidence_score: draft.confidence_score || null,
    country: draft.country || 'CA',
    delivery_method: draft.delivery_method || 'email',
    quick_notes: draft.quick_notes || null,
    schedule_window: draft.schedule_window || null,
    revision_summary: draft.revision_summary || null,
    photo_url: draft.photo_url || null,
  };
  if (draft.status === 'draft') {
    payload.expires_at = null;
  } else if (expiryDays > 0) {
    payload.expires_at = draft.expires_at || new Date(Date.now() + expiryDays * 86400000).toISOString();
  }
  if (draft.status === 'approved' && depositRequired && depositStatus !== 'paid') payload.status = 'approved_pending_deposit';
  // Set lifecycle timestamps when status transitions occur.
  // Uses draft.sent_at / draft.approved_at to check existing values (populated via merge in updateQuote).
  if (payload.status === 'sent' && !draft.sent_at) payload.sent_at = new Date().toISOString();
  if (['approved', 'approved_pending_deposit'].includes(payload.status) && !draft.approved_at) payload.approved_at = new Date().toISOString();
  return { payload: stripBadCols(payload), totals };
}

function normalizeLineItems(items, quoteId) {
  return (items || [])
    .filter((i) => {
      // Drop truly blank items — they damage customer trust on the public quote
      if (!(i.name || i.title || '').trim()) {
        console.warn('[normalizeLineItems] Dropping blank item (no name/title)', i);
        return false;
      }
      return true;
    })
    .map((item, index) => {
      const row = {
        quote_id: quoteId,
        sort_order: index,
        name: item.name || item.title,
        quantity: Number(item.quantity || 1),
        unit_price: Number(item.unit_price || 0),
        notes: item.notes || null,
        category: item.category || null,
        included: item.included !== false,
        item_type: item.item_type || (item.included === false ? 'optional' : 'included'),
      };
      if (!_lineItemsBadCols.has('pricing_basis')) row.pricing_basis = item.pricing_basis || null;
      if (!_lineItemsBadCols.has('typical_range_low')) row.typical_range_low = item.typical_range_low ?? null;
      if (!_lineItemsBadCols.has('typical_range_high')) row.typical_range_high = item.typical_range_high ?? null;
      if (!_lineItemsBadCols.has('source_hint')) row.source_hint = item.source_hint || null;
      if (!_lineItemsBadCols.has('price_note')) row.price_note = item.price_note || null;
      return row;
    });
}

async function getExistingQuoteSnapshot(quoteId) {
  const { data, error } = await supabase.from('quotes').select('*, line_items(*)').eq('id', quoteId).maybeSingle();
  if (error) throw new Error(friendly(error));
  if (!data) throw new Error('Quote not found. It may have been deleted.');
  return data;
}

export async function createQuote(userId, draft) {
  let payload, totalsResult;
  for (let attempt = 0; attempt < 3; attempt++) {
    const built = buildQuotePayload(userId, draft);
    payload = built.payload;
    totalsResult = built.totals;
    payload.share_token = makeId();
    payload.revision_number = Number(draft.revision_number || 1);
    const { data: quote, error } = await supabase.from('quotes').insert(payload).select().single();
    if (error) {
      if (learnBadColumns(error) && attempt < 2) {
        console.warn('[Punchlist] Retrying createQuote without:', [..._badCols]);
        continue;
      }
      console.error('[Punchlist] createQuote error:', JSON.stringify(error, null, 2));
      console.error('[Punchlist] payload keys:', Object.keys(payload));
      throw new Error(error.message || 'Failed to save quote');
    }
    const items = normalizeLineItems(draft.line_items, quote.id);
    if (items.length) {
      let { error: ie } = await supabase.from('line_items').insert(items);
      if (ie && learnBadColumns(ie)) {
        const retryItems = normalizeLineItems(draft.line_items, quote.id);
        const r2 = await supabase.from('line_items').insert(retryItems);
        ie = r2.error;
      }
      if (ie) {
        console.error('[Punchlist] line_items error:', ie.message);
        throw new Error('Quote saved but items failed to save. Please try saving again.');
      }
    }
    return quote;
  }
  throw new Error('Failed to save quote after retries');
}

// ── Save mutex: prevents concurrent updateQuote calls from colliding on line items ──
let _saveMutex = Promise.resolve();

export async function updateQuote(quoteId, draft) {
  // Serialize saves: wait for any in-flight save to finish before starting a new one.
  // This prevents the duplication race where two concurrent saves both read the same
  // oldIds, both insert new items, then both try to delete the same old items.
  const release = _saveMutex;
  let resolve;
  _saveMutex = new Promise(r => { resolve = r; });
  await release;

  try {
    return await _updateQuoteInner(quoteId, draft);
  } finally {
    resolve();
  }
}

async function _updateQuoteInner(quoteId, draft) {
  const existing = await getExistingQuoteSnapshot(quoteId);

  // Merge: existing DB record is the base, incoming draft overrides only what it provides.
  // This prevents partial callers (build-scope-page, autosave) from wiping fields they omit.
  const { line_items: _existingItems, customer: _cust, ...existingFields } = existing;
  const merged = { ...existingFields, ...draft };

  for (let attempt = 0; attempt < 3; attempt++) {
    const { payload } = buildQuotePayload(undefined, merged);
    delete payload.user_id;
    const nextItems = normalizeLineItems(draft.line_items ?? existing.line_items, quoteId);
    const isRevision = ['revision_requested', 'declined'].includes(existing.status) || Boolean(draft.force_revision);
    if (isRevision) {
      payload.revision_number = Number(existing.revision_number || 1) + 1;
      payload.revision_summary = draft.revision_summary || summarizeDiff(existing.line_items || [], nextItems) || 'Scope and pricing updated.';
    }
    const { data: quote, error } = await supabase.from('quotes').update(payload).eq('id', quoteId).select().single();
    if (error) {
      if (learnBadColumns(error) && attempt < 2) {
        console.warn('[Punchlist] Retrying updateQuote without:', [..._badCols]);
        continue;
      }
      console.error('[Punchlist] updateQuote error:', JSON.stringify(error, null, 2));
      throw new Error(error.message || 'Failed to update quote');
    }

    // ── SAFE LINE ITEMS UPDATE (insert-first for data safety) ──
    // Phase 1: Insert new items while old items still exist as safety net.
    // Phase 2: Only delete old items AFTER new ones are confirmed saved.
    // If insert fails, old items remain intact — no data loss.
    // The save mutex above prevents concurrent saves from producing duplicates.
    if (nextItems.length) {
      // Snapshot old item IDs before insert
      const { data: oldItems } = await supabase.from('line_items').select('id').eq('quote_id', quoteId);
      const oldIds = (oldItems || []).map(i => i.id);

      // Phase 1: Insert new items
      let { error: ie } = await supabase.from('line_items').insert(nextItems);
      if (ie && learnBadColumns(ie)) {
        const retryItems = normalizeLineItems(draft.line_items ?? existing.line_items, quoteId);
        const r2 = await supabase.from('line_items').insert(retryItems);
        ie = r2.error;
      }
      if (ie) {
        // Insert failed — old items are still intact, no data loss
        console.error('[Punchlist] updateQuote line_items insert error:', ie.message);
        throw new Error('Quote saved but items failed to update. Your previous items are still intact — try saving again.');
      }

      // Phase 2: Insert succeeded — safe to remove old items by their specific IDs
      if (oldIds.length) {
        const { error: delErr } = await supabase.from('line_items').delete().in('id', oldIds);
        if (delErr) {
          // Delete failed — we have duplicates. Attempt cleanup of old items.
          console.error('[Punchlist] line_items delete failed after insert:', delErr.message);
          // Non-fatal: duplicates will be resolved on next save. Log but don't throw.
          console.warn('[Punchlist] Duplicate items may exist — will be cleaned on next save.');
        }
      }
    } else {
      // No new items — just delete old ones (user intentionally cleared all items)
      await supabase.from('line_items').delete().eq('quote_id', quoteId);
    }
    return quote;
  }
  throw new Error('Failed to update quote after retries');
}

export async function updateQuoteStatus(quoteId, updates) {
  const next = { ...updates };
  if (next.status === 'sent' && !next.sent_at) next.sent_at = new Date().toISOString();
  if (['approved','approved_pending_deposit'].includes(next.status) && !next.approved_at) next.approved_at = new Date().toISOString();
  if (next.status === 'approved' && next.deposit_required && next.deposit_status !== 'paid') next.status = 'approved_pending_deposit';
  const { data, error } = await supabase.from('quotes').update(next).eq('id', quoteId).select().single();
  if (error) throw new Error(friendly(error));
  return data;
}

export async function getQuote(quoteId) {
  const { data, error } = await supabase.from('quotes').select('*, customer:customers(*), line_items(*)').eq('id', quoteId).maybeSingle();
  if (error) throw new Error(friendly(error));
  if (!data) throw new Error('Quote not found. It may have been deleted.');
  return data;
}

export async function deleteQuote(quoteId) {
  const { error } = await supabase.from('quotes').delete().eq('id', quoteId);
  if (error) throw new Error(friendly(error));
}

export async function duplicateQuote(userId, quote) {
  // Strip lifecycle fields — only carry structure, content, and line items
  const { id, share_token, status, sent_at, approved_at, declined_at, signed_at, 
          signature_data, signer_name, signer_ip, archived_at, deposit_status, 
          deposit_paid_at, deposit_session_id, deposit_payment_intent_id,
          view_count, first_viewed_at, last_viewed_at, conversation, 
          selected_optional_ids, quote_number, created_at, updated_at, 
          customer, line_items: _li, ...content } = quote;
  return createQuote(userId, { 
    ...content, 
    status: 'draft', 
    title: `${quote.title || 'Quote'} (Copy)`, 
    line_items: (quote.line_items || []).map(i => ({
      name: i.name, quantity: i.quantity, unit_price: i.unit_price,
      notes: i.notes, category: i.category, included: i.included,
      item_type: i.item_type, pricing_basis: i.pricing_basis,
      typical_range_low: i.typical_range_low, typical_range_high: i.typical_range_high,
    })),
    deposit_status: 'not_required',
    revision_number: 1, 
    revision_summary: null,
    internal_notes: '',
  });
}

export async function sendQuoteEmail(quoteId, to) {
  // Include auth token so the server can verify the caller owns this quote
  const headers = { 'Content-Type': 'application/json' };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  } catch {}
  const r = await fetch('/api/send-quote-email', { method: 'POST', headers, body: JSON.stringify({ quoteId, to }) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Unable to send');
  return d;
}

export async function replyToCustomer(shareToken, reply, userId) {
  const r = await fetch('/api/public-quote-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: shareToken, action: 'contractor_reply', reply, contractor_user_id: userId }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Unable to send reply');
  return d;
}

export async function renewQuoteExpiry(quoteId, expiryDays = 14) {
  const expiresAt = new Date(Date.now() + expiryDays * 86400000).toISOString();
  const { data, error } = await supabase.from('quotes').update({ expires_at: expiresAt, status: 'draft', expiry_days: expiryDays }).eq('id', quoteId).select().single();
  if (error) throw new Error(friendly(error));
  return data;
}

export async function listQuotesByStatus(_userId, statuses = []) {
  let q = supabase.from('quotes').select('id,title,status,total,updated_at,customer:customers(name)');
  if (statuses.length) q = q.in('status', statuses);
  const { data, error } = await q.order('updated_at', { ascending: false });
  if (error) throw new Error(friendly(error));
  return data || [];
}

export async function getWonQuoteContext(_userId, limit = 5) {
  try {
    const { data } = await supabase
      .from('quotes')
      .select('title, total, trade, line_items(name, unit_price, quantity)')
      .in('status', ['approved', 'approved_pending_deposit', 'scheduled', 'completed', 'invoiced', 'paid'])
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (!data?.length) return [];
    return data.map(q => ({
      title: q.title,
      total: q.total,
      items: (q.line_items || []).map(i => `${i.name} ($${i.unit_price})`).join(', '),
    }));
  } catch { return []; }
}

export async function markFollowedUp(quoteId) {
  const { data, error } = await supabase
    .from('quotes')
    .update({ follow_up_at: new Date().toISOString() })
    .eq('id', quoteId).select('follow_up_at').single();
  if (error) throw new Error(friendly(error));
  return data;
}

export async function addInternalNote(quoteId, note) {
  const { data: q } = await supabase.from('quotes').select('internal_notes').eq('id', quoteId).maybeSingle();
  const existing = q?.internal_notes || '';
  const updated = note + (existing ? '\n' + existing : '');
  const { data, error } = await supabase.from('quotes').update({ internal_notes: updated }).eq('id', quoteId).select('internal_notes').single();
  if (error) throw new Error(friendly(error));
  return data;
}

export async function uploadQuotePhoto(quoteId, file) {
  const ext = file.name?.split('.').pop() || 'jpg';
  const path = `${quoteId}/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage
    .from('quote-photos')
    .upload(path, file, { cacheControl: '2592000', upsert: false });
  if (error) throw new Error(friendly(error));
  const { data: urlData } = supabase.storage.from('quote-photos').getPublicUrl(data.path);
  return { path: data.path, url: urlData.publicUrl };
}

export async function listQuotePhotos(quoteId) {
  const { data, error } = await supabase.storage
    .from('quote-photos')
    .list(quoteId, { limit: 50, sortBy: { column: 'created_at', order: 'desc' } });
  if (error) return [];
  return (data || []).map(f => {
    const { data: urlData } = supabase.storage.from('quote-photos').getPublicUrl(`${quoteId}/${f.name}`);
    return { name: f.name, path: `${quoteId}/${f.name}`, url: urlData.publicUrl, created: f.created_at };
  });
}

export async function deleteQuotePhoto(path) {
  const { error } = await supabase.storage.from('quote-photos').remove([path]);
  if (error) throw new Error(friendly(error));
}

// Expire stale quotes client-side (no-cron solution).
// Call fire-and-forget on dashboard load to keep DB status accurate.
export async function expireStaleDrafts() {
  const now = new Date().toISOString();
  await supabase
    .from('quotes')
    .update({ status: 'expired' })
    .in('status', ['sent', 'viewed'])
    .lt('expires_at', now)
    .not('expires_at', 'is', null);
}
