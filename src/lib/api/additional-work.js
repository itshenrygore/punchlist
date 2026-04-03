import { supabase, friendly } from './shared.js';
import { calculateTotals } from '../pricing';
import { makeId } from '../utils';

export async function listAdditionalWork(quoteId) {
  const { data, error } = await supabase
    .from('additional_work_requests')
    .select('*, additional_work_items(*), customer:customers(name,email,phone)')
    .eq('quote_id', quoteId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(friendly(error));
  return data || [];
}

export async function listAllAdditionalWork(_userId) {
  const { data, error } = await supabase
    .from('additional_work_requests')
    .select('*, additional_work_items(id), customer:customers(name,email,phone), quote:quotes(title)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(friendly(error));
  return (data || []).map(r => ({ ...r, item_count: r.additional_work_items?.length || 0 }));
}

export async function getAdditionalWork(requestId) {
  const { data, error } = await supabase
    .from('additional_work_requests')
    .select('*, additional_work_items(*), customer:customers(*), quote:quotes(title, share_token, status, total, trade, province)')
    .eq('id', requestId)
    .maybeSingle();
  if (error) throw new Error(friendly(error));
  if (data?.additional_work_items) {
    data.additional_work_items.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }
  return data;
}

export async function createAdditionalWork(userId, draft) {
  const province = draft.province || 'ON';
  const country = draft.country || 'CA';
  const totals = calculateTotals(
    (draft.items || []).map(i => ({ ...i, included: true })),
    province, country
  );
  const { data: request, error } = await supabase
    .from('additional_work_requests')
    .insert({
      user_id: userId,
      quote_id: draft.quote_id,
      booking_id: draft.booking_id || null,
      customer_id: draft.customer_id || null,
      title: draft.title || 'Additional Work',
      reason: draft.reason || '',
      status: draft.status || 'draft',
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

  const items = (draft.items || [])
    .filter(i => (i.name || '').trim())
    .map((item, idx) => ({
      additional_work_request_id: request.id,
      sort_order: idx,
      name: item.name,
      quantity: Number(item.quantity || 1),
      unit_price: Number(item.unit_price || 0),
      notes: item.notes || null,
      category: item.category || null,
    }));
  if (items.length) {
    const { error: ie } = await supabase.from('additional_work_items').insert(items);
    if (ie) throw new Error(friendly(ie));
  }
  return request;
}

export async function updateAdditionalWork(requestId, draft) {
  const province = draft.province || 'ON';
  const country = draft.country || 'CA';
  const totals = calculateTotals(
    (draft.items || []).map(i => ({ ...i, included: true })),
    province, country
  );
  const payload = {
    title: draft.title || 'Additional Work',
    reason: draft.reason || '',
    status: draft.status || 'draft',
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total,
    province,
    country,
  };
  if (draft.status === 'sent' && !draft.sent_at) {
    payload.sent_at = new Date().toISOString();
  }
  const { data: request, error } = await supabase
    .from('additional_work_requests')
    .update(payload)
    .eq('id', requestId)
    .select()
    .single();
  if (error) throw new Error(friendly(error));

  // ── SAFE ADDITIONAL WORK ITEMS UPDATE (insert-first) ──
  const newItems = (draft.items || [])
    .filter(i => (i.name || '').trim())
    .map((item, idx) => ({
      additional_work_request_id: requestId,
      sort_order: idx,
      name: item.name,
      quantity: Number(item.quantity || 1),
      unit_price: Number(item.unit_price || 0),
      notes: item.notes || null,
      category: item.category || null,
    }));

  if (newItems.length) {
    const { data: oldItems } = await supabase.from('additional_work_items').select('id').eq('additional_work_request_id', requestId);
    const oldIds = (oldItems || []).map(i => i.id);

    const { error: ie } = await supabase.from('additional_work_items').insert(newItems);
    if (ie) {
      // Insert failed — old items still intact
      throw new Error('Request saved but items failed to update. Your previous items are still intact — try again.');
    }

    // Insert succeeded — safe to remove old items
    if (oldIds.length) {
      const { error: delErr } = await supabase.from('additional_work_items').delete().in('id', oldIds);
      if (delErr) {
        console.error('[Punchlist] additional_work_items delete failed after insert:', delErr.message);
        try {
          await supabase.from('additional_work_items').delete().eq('additional_work_request_id', requestId).not('id', 'in', `(${oldIds.join(',')})`);
        } catch {}
        throw new Error('Request saved but items may be duplicated. Please refresh.');
      }
    }
  } else {
    // No new items — clear old ones
    await supabase.from('additional_work_items').delete().eq('additional_work_request_id', requestId);
  }
  return request;
}

export async function deleteAdditionalWork(requestId) {
  const { error } = await supabase.from('additional_work_requests').delete().eq('id', requestId);
  if (error) throw new Error(friendly(error));
}

export async function sendAdditionalWork(requestId) {
  const { data, error } = await supabase
    .from('additional_work_requests')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', requestId)
    .select()
    .single();
  if (error) throw new Error(friendly(error));
  return data;
}

// Enhanced invoice creation that includes approved additional work AND amendments
export async function createInvoiceFromQuoteWithAdditionalWork(userId, quote) {
  const invNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
  const quoteItems = (quote.line_items || []).filter(i => i.included !== false && (i.name || '').trim());

  const { data: awrs } = await supabase
    .from('additional_work_requests')
    .select('*, additional_work_items(*)')
    .eq('quote_id', quote.id)
    .eq('status', 'approved');

  const approvedAWRs = awrs || [];
  let extraSubtotal = 0;
  let extraTax = 0;
  const extraItems = [];
  for (const awr of approvedAWRs) {
    extraSubtotal += Number(awr.subtotal || 0);
    extraTax += Number(awr.tax || 0);
    for (const item of (awr.additional_work_items || [])) {
      extraItems.push({
        name: item.name,
        quantity: Number(item.quantity || 1),
        unit_price: Number(item.unit_price || 0),
        notes: item.notes || null,
        category: 'Additional Work',
      });
    }
  }

  let amendSubtotal = 0;
  let amendTax = 0;
  const amendItems = [];
  try {
    const { data: amendments } = await supabase
      .from('amendments')
      .select('*')
      .eq('quote_id', quote.id)
      .eq('status', 'approved')
      .order('created_at', { ascending: true });
    for (const amend of (amendments || [])) {
      amendSubtotal += Number(amend.subtotal || 0);
      amendTax += Number(amend.tax || 0);
      for (const item of (amend.items || [])) {
        amendItems.push({
          name: item.name,
          quantity: Number(item.quantity || 1),
          unit_price: Number(item.unit_price || 0),
          notes: item.notes || null,
          category: `Amendment: ${amend.title || 'Amendment'}`,
        });
      }
    }
  } catch {}

  const totalSubtotal = Number(quote.subtotal || 0) + extraSubtotal + amendSubtotal;
  const totalTax = Number(quote.tax || 0) + extraTax + amendTax;
  const totalTotal = Number(quote.total || 0) + extraSubtotal + extraTax + amendSubtotal + amendTax;

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      user_id: userId,
      quote_id: quote.id,
      customer_id: quote.customer_id || null,
      invoice_number: invNumber,
      title: quote.title || 'Invoice',
      description: quote.scope_summary || '',
      subtotal: totalSubtotal,
      tax: totalTax,
      total: totalTotal,
      province: quote.province || 'ON',
      country: quote.country || 'CA',
      status: 'draft',
      issued_at: new Date().toISOString(),
      due_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      payment_methods: quote.payment_methods || [],
      payment_instructions: quote.payment_instructions || '',
      deposit_credited: quote.deposit_status === 'paid' ? Number(quote.deposit_amount || 0) : 0,
    })
    .select()
    .single();
  if (error) throw new Error(friendly(error));

  const allInvItems = [
    ...quoteItems.map((item, i) => ({
      invoice_id: invoice.id, sort_order: i, name: item.name,
      quantity: Number(item.quantity || 1), unit_price: Number(item.unit_price || 0),
      notes: item.notes || null, category: item.category || 'Original Work', included: true,
    })),
    ...extraItems.map((item, i) => ({
      invoice_id: invoice.id, sort_order: quoteItems.length + i, name: item.name,
      quantity: item.quantity, unit_price: item.unit_price,
      notes: item.notes, category: 'Additional Work', included: true,
    })),
    ...amendItems.map((item, i) => ({
      invoice_id: invoice.id, sort_order: quoteItems.length + extraItems.length + i, name: item.name,
      quantity: item.quantity, unit_price: item.unit_price,
      notes: item.notes, category: item.category, included: true,
    })),
  ];

  if (allInvItems.length) {
    const { error: ie } = await supabase.from('invoice_items').insert(allInvItems);
    if (ie) throw new Error(friendly(ie));
  }

  await supabase.from('quotes').update({ status: 'invoiced' }).eq('id', quote.id);
  return invoice;
}
