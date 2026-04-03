import { supabase, friendly } from './shared.js';
import { calculateTotals } from '../pricing';
import { makeId } from '../utils';

export async function listAmendments(quoteId) {
  const { data, error } = await supabase
    .from('amendments')
    .select('*')
    .eq('quote_id', quoteId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(friendly(error));
  return data || [];
}

export async function getAmendment(amendmentId) {
  const { data, error } = await supabase
    .from('amendments')
    .select('*')
    .eq('id', amendmentId)
    .maybeSingle();
  if (error) throw new Error(friendly(error));
  return data;
}

export async function createAmendment(userId, draft) {
  const province = draft.province || 'ON';
  const country = draft.country || 'CA';
  const totals = calculateTotals(
    (draft.items || []).map(i => ({ ...i, included: true })),
    province, country
  );
  const { data: amendment, error } = await supabase
    .from('amendments')
    .insert({
      user_id: userId,
      quote_id: draft.quote_id,
      title: draft.title || 'Amendment',
      reason: draft.reason || '',
      status: draft.status || 'draft',
      items: (draft.items || []).filter(i => (i.name || '').trim()).map((item, idx) => ({
        sort_order: idx,
        name: item.name,
        quantity: Number(item.quantity || 1),
        unit_price: Number(item.unit_price || 0),
        notes: item.notes || null,
        category: item.category || null,
      })),
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      province,
      country,
      share_token: makeId(),
      sent_at: draft.status === 'sent' ? new Date().toISOString() : null,
    })
    .select()
    .single();
  if (error) throw new Error(friendly(error));
  return amendment;
}

export async function updateAmendment(amendmentId, draft) {
  const province = draft.province || 'ON';
  const country = draft.country || 'CA';
  const totals = calculateTotals(
    (draft.items || []).map(i => ({ ...i, included: true })),
    province, country
  );
  const payload = {
    title: draft.title || 'Amendment',
    reason: draft.reason || '',
    status: draft.status || 'draft',
    items: (draft.items || []).filter(i => (i.name || '').trim()).map((item, idx) => ({
      sort_order: idx,
      name: item.name,
      quantity: Number(item.quantity || 1),
      unit_price: Number(item.unit_price || 0),
      notes: item.notes || null,
      category: item.category || null,
    })),
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total,
    province,
    country,
  };
  if (draft.status === 'sent' && !draft.sent_at) {
    payload.sent_at = new Date().toISOString();
  }
  const { data: amendment, error } = await supabase
    .from('amendments')
    .update(payload)
    .eq('id', amendmentId)
    .select()
    .single();
  if (error) throw new Error(friendly(error));
  return amendment;
}

export async function deleteAmendment(amendmentId) {
  const { error } = await supabase.from('amendments').delete().eq('id', amendmentId);
  if (error) throw new Error(friendly(error));
}

export async function sendAmendment(amendmentId) {
  const { data, error } = await supabase
    .from('amendments')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', amendmentId)
    .select()
    .single();
  if (error) throw new Error(friendly(error));
  return data;
}
