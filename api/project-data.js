import { createClient } from '@supabase/supabase-js';
import { blocked, getClientIp } from './_rate-limit.js';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing database configuration');
  return createClient(url, key);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (blocked(res, `proj:${getClientIp(req)}`, 60, 60_000)) return;

  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Missing share token' });

  let supabase;
  try { supabase = getSupabase(); } catch (e) {
    console.error('[project-data] Config error:', e.message);
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // 1. Fetch quote by share_token
    const { data: quote, error: qErr } = await supabase
      .from('quotes').select('*').eq('share_token', token).maybeSingle();
    if (qErr) { console.error('[project-data] Quote query error:', qErr.message); return res.status(500).json({ error: 'Database error' }); }
    if (!quote) return res.status(404).json({ error: 'Project not found' });

    // Inline expiry
    if (quote.expires_at && new Date(quote.expires_at) < new Date() && ['sent', 'viewed'].includes(quote.status)) {
      await supabase.from('quotes').update({ status: 'expired' }).eq('id', quote.id);
      quote.status = 'expired';
    }

    // 2. Parallel fetches: line items, customer, contractor, amendments, additional work, invoices
    // Each wrapped to never reject — if a table doesn't exist or a query fails, we get null
    const safe = (promise) => promise.then(r => r).catch(() => ({ data: null }));
    const [
      { data: lineItems },
      { data: customer },
      { data: contractor },
      { data: amendments },
      { data: additionalWork },
      { data: invoices },
    ] = await Promise.all([
      safe(supabase.from('line_items').select('*').eq('quote_id', quote.id).order('sort_order', { ascending: true })),
      quote.customer_id
        ? safe(supabase.from('customers').select('*').eq('id', quote.customer_id).maybeSingle())
        : Promise.resolve({ data: null }),
      quote.user_id
        ? safe(supabase.from('profiles').select('*').eq('id', quote.user_id).maybeSingle())
        : Promise.resolve({ data: null }),
      safe(supabase.from('amendments').select('*').eq('quote_id', quote.id).order('created_at', { ascending: true })),
      safe(supabase.from('additional_work_requests').select('*, additional_work_items(*)').eq('quote_id', quote.id).order('created_at', { ascending: true })),
      safe(supabase.from('invoices').select('*, invoice_items(*)').eq('quote_id', quote.id).order('created_at', { ascending: true })),
    ]);

    // 3. Fetch payments for all invoices
    const invoiceIds = (invoices || []).map(i => i.id);
    let allPayments = [];
    if (invoiceIds.length > 0) {
      try {
        const { data: payments } = await supabase.from('payments').select('*').in('invoice_id', invoiceIds).order('paid_at', { ascending: true });
        allPayments = payments || [];
      } catch { /* payments table may not exist yet */ }
    }

    // 4. Build response
    const c = contractor || {};
    const cust = customer || {};

    const quotePayload = {
      id: quote.id,
      title: quote.title || '',
      scope_summary: quote.scope_summary || '',
      assumptions: quote.assumptions || '',
      exclusions: quote.exclusions || '',
      status: quote.status || 'draft',
      subtotal: Number(quote.subtotal) || 0,
      tax: Number(quote.tax) || 0,
      total: Number(quote.total) || 0,
      discount: Number(quote.discount) || 0,
      deposit_required: Boolean(quote.deposit_required),
      deposit_amount: Number(quote.deposit_amount) || 0,
      deposit_status: quote.deposit_status || 'not_required',
      expires_at: quote.expires_at || null,
      revision_summary: quote.revision_summary || null,
      revision_number: quote.revision_number || 1,
      share_token: quote.share_token,
      trade: quote.trade || '',
      province: quote.province || '',
      country: quote.country || 'CA',
      created_at: quote.created_at,
      schedule_window: quote.schedule_window || '',
      line_items: lineItems || [],
      customer_name: cust.name || null,
      customer_email: cust.email || null,
      customer_phone: cust.phone || null,
      customer_address: cust.address || null,
      contractor_name: c.full_name || c.company_name || null,
      contractor_company: c.company_name || c.full_name || null,
      contractor_phone: c.phone || null,
      contractor_email: c.email || null,
      contractor_logo: c.logo_url || null,
      payment_methods: Array.isArray(c.payment_methods) ? c.payment_methods : [],
      payment_instructions: c.payment_instructions || '',
      etransfer_email: c.etransfer_email || '',
      venmo_zelle_handle: c.venmo_zelle_handle || '',
      square_payment_link: c.square_payment_link || '',
      paypal_link: c.paypal_link || '',
      contractor_stripe_link: c.stripe_payment_link || '',
      stripe_connect_enabled: Boolean(c.stripe_connect_account_id && c.stripe_connect_onboarded),
      signature_data: quote.signature_data || null,
      signed_at: quote.signed_at || null,
      signer_name: quote.signer_name || null,
      view_count: quote.view_count || 0,
      terms_conditions: c.terms_conditions || '',
      conversation: Array.isArray(quote.conversation) ? quote.conversation : [],
      quote_number: quote.quote_number || null,
    };

    const amendmentsPayload = (amendments || []).map(a => ({
      id: a.id,
      title: a.title || 'Amendment',
      reason: a.reason || '',
      status: a.status,
      items: a.items || [],
      subtotal: Number(a.subtotal) || 0,
      tax: Number(a.tax) || 0,
      total: Number(a.total) || 0,
      share_token: a.share_token,
      signature_data: a.signature_data || null,
      signed_at: a.signed_at || null,
      signer_name: a.signer_name || null,
      created_at: a.created_at,
      province: a.province || 'ON',
      country: a.country || 'CA',
    }));

    const additionalWorkPayload = (additionalWork || []).map(aw => {
      const items = (aw.additional_work_items || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      return {
        id: aw.id,
        title: aw.title || '',
        reason: aw.reason || '',
        status: aw.status,
        subtotal: Number(aw.subtotal) || 0,
        tax: Number(aw.tax) || 0,
        total: Number(aw.total) || 0,
        share_token: aw.share_token,
        created_at: aw.created_at,
        approved_at: aw.approved_at || null,
        items,
        country: c.country || aw.country || 'CA',
      };
    });

    const invoicesPayload = (invoices || []).map(inv => {
      const items = (inv.invoice_items || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const payments = allPayments.filter(p => p.invoice_id === inv.id);
      return {
        id: inv.id,
        title: inv.title || inv.invoice_number || 'Invoice',
        invoice_number: inv.invoice_number || '',
        description: inv.description || '',
        status: inv.status,
        subtotal: Number(inv.subtotal) || 0,
        tax: Number(inv.tax) || 0,
        total: Number(inv.total) || 0,
        discount: Number(inv.discount) || 0,
        deposit_credited: Number(inv.deposit_credited) || 0,
        share_token: inv.share_token,
        issued_at: inv.issued_at,
        due_at: inv.due_at,
        paid_at: inv.paid_at || null,
        payment_method: inv.payment_method || null,
        province: inv.province || '',
        country: c.country || inv.country || 'CA',
        notes: inv.notes || '',
        invoice_items: items,
        payments,
        contractor_stripe_link: c.stripe_payment_link || '',
        stripe_connect_enabled: Boolean(c.stripe_connect_account_id && c.stripe_connect_onboarded),
        square_payment_link: c.square_payment_link || '',
        paypal_link: c.paypal_link || '',
      };
    });

    // Count unread items for tab badges
    const pendingAmendments = amendmentsPayload.filter(a => ['sent', 'viewed'].includes(a.status)).length;
    const pendingAW = additionalWorkPayload.filter(a => !['approved', 'declined', 'cancelled'].includes(a.status)).length;
    const unpaidInvoices = invoicesPayload.filter(i => !['paid', 'void'].includes(i.status)).length;
    const unreadMessages = quotePayload.conversation.length;

    return res.status(200).json({
      quote: quotePayload,
      amendments: amendmentsPayload,
      additional_work: additionalWorkPayload,
      invoices: invoicesPayload,
      badges: {
        updates: pendingAmendments + pendingAW,
        payments: unpaidInvoices,
        messages: unreadMessages,
      },
    });

  } catch (err) {
    console.error('[project-data] Unexpected error:', err.message, err.stack);
    return res.status(500).json({ error: 'Server error' });
  }
}
