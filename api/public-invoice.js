import { createClient } from '@supabase/supabase-js';
import { blocked, getClientIp } from './_rate-limit.js';

export default async function handler(req, res) {
  const allowed = ['https://www.punchlist.ca', 'https://punchlist.ca'];
  const origin = req.headers.origin;
  if (allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (blocked(res, `pi:${getClientIp(req)}`, 60, 60_000)) return;

  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Missing share token' });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Server configuration error' });

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('id,invoice_number,quote_id,customer_id,user_id,title,description,status,subtotal,tax,discount,total,deposit_credited,remaining_balance,province,country,due_at,issued_at,paid_at,payment_method,notes,share_token,updated_at')
      .eq('share_token', token)
      .maybeSingle();

    if (invErr) return res.status(500).json({ error: 'Database error', detail: invErr.message });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    // Fetch invoice items
    let invoiceItems = [];
    const { data: items } = await supabase
      .from('invoice_items')
      .select('id,name,quantity,unit_price,notes,category,sort_order,included')
      .eq('invoice_id', invoice.id)
      .order('sort_order', { ascending: true });
    invoiceItems = (items || []).filter(i => i.included !== false);

    // Fetch payments
    let payments = [];
    const { data: pays } = await supabase
      .from('payments')
      .select('id,amount,method,notes,paid_at')
      .eq('invoice_id', invoice.id)
      .order('paid_at', { ascending: true });
    payments = pays || [];

    // Fetch customer
    let customer = null;
    if (invoice.customer_id) {
      const { data: cust } = await supabase
        .from('customers')
        .select('name,email,phone,address')
        .eq('id', invoice.customer_id)
        .maybeSingle();
      customer = cust;
    }

    // Fetch contractor profile
    let contractor = null;
    if (invoice.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name,company_name,phone,email,logo_url,payment_methods,payment_instructions,etransfer_email,venmo_zelle_handle,square_payment_link,paypal_link,stripe_payment_link,stripe_connect_account_id,stripe_connect_onboarded')
        .eq('id', invoice.user_id)
        .maybeSingle();
      contractor = profile;
    }

    const payload = {
      id: invoice.id,
      invoice_number: invoice.invoice_number || '',
      quote_id: invoice.quote_id || null,
      title: invoice.title || '',
      description: invoice.description || '',
      status: invoice.status || 'draft',
      subtotal: Number(invoice.subtotal) || 0,
      tax: Number(invoice.tax) || 0,
      discount: Number(invoice.discount) || 0,
      total: Number(invoice.total) || 0,
      deposit_credited: Number(invoice.deposit_credited) || 0,
      remaining_balance: Number(invoice.remaining_balance) || 0,
      province: invoice.province || 'ON',
      country: invoice.country || 'CA',
      due_at: invoice.due_at || null,
      issued_at: invoice.issued_at || invoice.updated_at,
      paid_at: invoice.paid_at || null,
      payment_method: invoice.payment_method || null,
      notes: invoice.notes || '',
      share_token: invoice.share_token,
      invoice_items: invoiceItems,
      payments,
      customer_name: customer?.name || null,
      customer_email: customer?.email || null,
      customer_phone: customer?.phone || null,
      customer_address: customer?.address || null,
      contractor_name: contractor?.full_name || contractor?.company_name || null,
      contractor_company: contractor?.company_name || contractor?.full_name || null,
      contractor_phone: contractor?.phone || null,
      contractor_email: contractor?.email || null,
      contractor_logo: contractor?.logo_url || null,
      payment_methods: Array.isArray(contractor?.payment_methods) ? contractor.payment_methods : [],
      payment_instructions: contractor?.payment_instructions || '',
      etransfer_email: contractor?.etransfer_email || '',
      venmo_zelle_handle: contractor?.venmo_zelle_handle || '',
      square_payment_link: contractor?.square_payment_link || '',
      paypal_link: contractor?.paypal_link || '',
      contractor_stripe_link: contractor?.stripe_payment_link || '',
      stripe_connect_enabled: Boolean(contractor?.stripe_connect_account_id && contractor?.stripe_connect_onboarded),
    };

    return res.status(200).json({ invoice: payload });
  } catch (err) {
    console.error('[public-invoice] Error:', err.message);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
}
