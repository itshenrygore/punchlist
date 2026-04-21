import { supabase, friendly, _badCols, stripBadCols, learnBadColumns, _lineItemsBadCols } from './shared.js';
import { calculateTotals } from '../pricing';
import { makeId } from '../utils';
import { summarizeDiff } from '../workflow';

// RFC4122 v4 UUID. Used for line_items.id (which is a Postgres uuid column,
// NOT the base64 id from makeId()). Prefers native crypto.randomUUID when
// available (Chrome 92+, Safari 15.4+, Firefox 95+); falls back to a
// getRandomValues-based generator for older iOS Safari and anything else
// that exposes crypto but not randomUUID.
function genLineItemId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const buf = new Uint8Array(16);
  (typeof crypto !== 'undefined' ? crypto : globalThis.msCrypto).getRandomValues(buf);
  buf[6] = (buf[6] & 0x0f) | 0x40; // version 4
  buf[8] = (buf[8] & 0x3f) | 0x80; // variant 10
  const h = Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function mode(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  let best = null;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) { best = v; bestCount = c; }
  }
  return best;
}

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
    // When sending/re-sending, always compute a fresh expiry from now.
    // Only preserve existing expires_at if the quote was already sent and hasn't expired.
    const existingExpiry = draft.expires_at ? new Date(draft.expires_at) : null;
    const isStillValid = existingExpiry && existingExpiry > new Date();
    const isNewSend = payload.status === 'sent' && !draft.sent_at;
    const isResend = payload.status === 'sent' && draft.sent_at;
    if (isNewSend || !isStillValid) {
      // Fresh send or expired quote being resent — set new expiry
      payload.expires_at = new Date(Date.now() + expiryDays * 86400000).toISOString();
    } else {
      payload.expires_at = draft.expires_at;
    }
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
      // H1: Preserve incoming id; generate a client-side UUID for new items.
      // Upsert relies on this id being present and stable across saves.
      const row = {
        id: item.id || genLineItemId(),
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
    let items = normalizeLineItems(draft.line_items, quote.id);
    if (items.length) {
      let { error: ie } = await supabase.from('line_items').insert(items);
      if (ie && learnBadColumns(ie)) {
        // Strip newly-learned bad columns from the SAME normalized rows.
        // Do NOT renormalize from raw draft — genLineItemId() would mint
        // fresh UUIDs for items without incoming ids, breaking the H1
        // stable-ID contract and making retries non-deterministic.
        items = items.map(row => {
          const clean = { ...row };
          for (const col of _lineItemsBadCols) delete clean[col];
          return clean;
        });
        const r2 = await supabase.from('line_items').insert(items);
        ie = r2.error;
      }
      if (ie) {
        console.error('[Punchlist] line_items error:', ie.message);
        throw new Error('Quote saved, but the line items didn\u2019t. Save again to sync them.');
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

    // ── H1: LINE ITEMS UPSERT (preserves IDs across saves) ──
    // Strategy: upsert by primary key, then delete only the specific IDs the
    // user removed. This preserves line_items.id across saves — critical for
    // selected_optional_ids references in public-quote-action approval flow.
    //
    // Previous strategy (insert-then-delete-old) nuked all IDs on every save,
    // orphaning any ID reference held elsewhere (signed quotes with optionals,
    // telemetry IDs, etc.).
    //
    // Safety: the save mutex above still serializes concurrent saves. normalizeLineItems
    // assigns a client-side UUID to any new item so upsert's onConflict can match.
    const previousIds = (existing.line_items || []).map(i => i.id);
    const nextIds = new Set(nextItems.map(i => i.id));
    const removedIds = previousIds.filter(id => !nextIds.has(id));

    if (nextItems.length) {
      // Upsert: inserts new rows (new UUIDs), updates rows whose id already exists.
      let { error: ue } = await supabase.from('line_items').upsert(nextItems, { onConflict: 'id' });
      if (ue && learnBadColumns(ue)) {
        const retryItems = normalizeLineItems(draft.line_items ?? existing.line_items, quoteId);
        const r2 = await supabase.from('line_items').upsert(retryItems, { onConflict: 'id' });
        ue = r2.error;
      }
      if (ue) {
        // Upsert failed — old items are still intact (nothing deleted yet), no data loss.
        console.error('[Punchlist] updateQuote line_items upsert error:', ue.message);
        throw new Error('Quote saved but items failed to update. Your previous items are still intact — try saving again.');
      }
    }

    // Delete only the items the user explicitly removed. If nextItems is empty
    // and previousIds has entries, removedIds == previousIds — user cleared everything.
    if (removedIds.length) {
      const { error: delErr } = await supabase
        .from('line_items')
        .delete()
        .eq('quote_id', quoteId)
        .in('id', removedIds);
      if (delErr) {
        console.error('[Punchlist] line_items delete of removed ids failed:', delErr.message);
        // Non-fatal: stale items will show up in UI until next successful save.
      }
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
  } catch (e) { console.warn("[PL]", e); }
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

// Smart defaults for new quotes — mode of the last 5 non-draft quotes.
// Returns null when the user has no history; caller should fall back to
// profile.default_* then hardcoded (14 days / 20% / no deposit).
//
// Only use this when creating a NEW quote, never when loading an existing one.
export async function getQuotingDefaults(userId) {
  if (!userId) return null;
  const { data: recent, error } = await supabase
    .from('quotes')
    .select('deposit_required, deposit_percent, deposit_amount, expiry_days')
    .eq('user_id', userId)
    .neq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(5);
  if (error || !recent?.length) return null;

  // deposit_required: majority of last 5 (>= 3)
  const depositedCount = recent.filter(q => q.deposit_required).length;
  const depositRequired = depositedCount >= 3;

  // deposit_percent: mode among the ones that took a deposit
  const pcts = recent
    .filter(q => q.deposit_required)
    .map(q => Number(q.deposit_percent))
    .filter(p => p > 0);
  const depositPercent = pcts.length ? mode(pcts) : 20;

  // expiry_days: mode across all 5
  const days = recent.map(q => Number(q.expiry_days)).filter(d => d > 0);
  const expiryDays = days.length ? mode(days) : 14;

  return { depositRequired, depositPercent, expiryDays };
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
