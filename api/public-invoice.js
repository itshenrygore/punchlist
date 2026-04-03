import { createClient } from '@supabase/supabase-js';
import { blocked, getClientIp } from './_rate-limit.js';

// Defensive Supabase client factory — never created at module level
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (blocked(res, `pinv:${getClientIp(req)}`, 60, 60_000)) return;

  const supabase = getSupabase();
  if (!supabase) {
    console.error('[public-invoice] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({ error: 'Database not configured' });
  }

  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Missing share token' });

  try {
    // Use wildcard select — NEVER fails due to missing columns
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*, customer:customers(*), invoice_items(*)')
      .eq('share_token', token)
      .maybeSingle();

    if (error || !invoice) return res.status(404).json({ error: 'Invoice not found' });

    // Get contractor info
    let contractor = null;
    if (invoice.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', invoice.user_id)
        .maybeSingle();
      contractor = profile;
    }

    // Sort items
    const sortedItems = [...(invoice.invoice_items || [])].sort(
      (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
    );

    // Fetch payments for this invoice (Phase 5E)
    const { data: payments } = await supabase
      .from('payments')
      .select('id,amount,method,notes,paid_at')
      .eq('invoice_id', invoice.id)
      .order('paid_at', { ascending: true });

    // Mark as viewed if sent
    if (invoice.status === 'sent') {
      supabase
        .from('invoices')
        .update({ status: 'viewed' })
        .eq('id', invoice.id)
        .then(() => {})
        .catch(() => {});
    }

    const payload = {
      ...invoice,
      invoice_items: sortedItems,
      payments: payments || [],
      country: contractor?.country || invoice.country || 'CA',
      customer_name: invoice.customer?.name || null,
      customer_email: invoice.customer?.email || null,
      customer_address: invoice.customer?.address || null,
      contractor_name: contractor?.full_name || contractor?.company_name || null,
      contractor_company: contractor?.company_name || null,
      contractor_phone: contractor?.phone || null,
      contractor_email: contractor?.email || null,
      contractor_logo: contractor?.logo_url || null,
      payment_methods: contractor?.payment_methods || [],
      payment_instructions: contractor?.payment_instructions || '',
      etransfer_email: contractor?.etransfer_email || '',
      venmo_zelle_handle: contractor?.venmo_zelle_handle || '',
      square_payment_link: contractor?.square_payment_link || '',
      paypal_link: contractor?.paypal_link || '',
      contractor_stripe_link: contractor?.stripe_payment_link || '',
      stripe_invoices_enabled: contractor?.stripe_invoices_enabled || false,
    };

    return res.status(200).json({ invoice: payload });
  } catch (err) {
    console.error('public-invoice error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
