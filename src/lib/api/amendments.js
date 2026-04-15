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

  // Fire email + SMS to customer (fire-and-forget — don't block the UI)
  if (data?.quote_id) {
    (async () => {
      try {
        // Get quote → customer + contractor context
        const { data: quote } = await supabase.from('quotes')
          .select('user_id, country, province, customer:customers(name,email,phone)')
          .eq('id', data.quote_id).maybeSingle();
        if (!quote) return;

        const { data: profile } = await supabase.from('profiles')
          .select('full_name, company_name, phone, email, country')
          .eq('id', quote.user_id).maybeSingle();

        const customerEmail = quote.customer?.email;
        const customerPhone = quote.customer?.phone;
        const contractorName = profile?.company_name || profile?.full_name || '';
        const country = quote.country || profile?.country || 'CA';

        // Email
        if (customerEmail) {
          fetch('/api/send-quote-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'send_amendment',
              customerEmail,
              customerName: quote.customer?.name || '',
              contractorName,
              contractorPhone: profile?.phone || '',
              title: data.title || 'Amendment',
              total: data.total || 0,
              reason: data.reason || '',
              shareToken: data.share_token,
              country,
            }),
          }).catch(() => {});
        }

        // SMS
        if (customerPhone && data.share_token) {
          const { smsNotify } = await import('../sms.js');
          smsNotify.amendment({
            to: customerPhone,
            contractorName: contractorName || 'Your contractor',
            title: (data.title || 'amendment').slice(0, 40),
            shareToken: data.share_token,
          });
        }
      } catch (e) { console.warn("[PL]", e); }
    })();
  }

  return data;
}
