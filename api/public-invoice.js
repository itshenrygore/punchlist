import { createClient } from './_supabase.js';
import { blocked, getClientIp } from './_rate-limit.js';

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowed = ['https://www.punchlist.ca', 'https://punchlist.ca'];
  const isVercel = origin.endsWith('.vercel.app') || origin.includes('punchlist');
  if (allowed.includes(origin) || isVercel) res.setHeader('Access-Control-Allow-Origin', origin);
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

  // Retry-on-missing-column helper: PostgREST errors with a recognizable
  // message when a column doesn't exist (typically because a migration
  // hasn't been applied). We strip the offending column and try again so
  // the public page degrades gracefully instead of 500'ing.
  async function selectWithFallback(table, cols, filter) {
    let list = [...cols];
    for (let attempt = 0; attempt <= cols.length; attempt++) {
      const q = supabase.from(table).select(list.join(','));
      const built = filter(q);
      const { data, error } = await built;
      if (!error) return { data, error: null, cols: list };
      const missing =
        error.message?.match(/column[s]? ["']?(\w+)["']? (of relation|does not exist)/i)?.[1] ||
        error.message?.match(/Could not find the '(\w+)' column/i)?.[1];
      if (missing && list.includes(missing)) {
        console.warn(`[public-invoice] ${table} column missing, retrying without: ${missing}`);
        list = list.filter(c => c !== missing);
        continue;
      }
      return { data: null, error, cols: list };
    }
    return { data: null, error: { message: 'all columns failed' }, cols: list };
  }

  try {
    const INVOICE_COLS = [
      'id','invoice_number','quote_id','customer_id','user_id','title','description',
      'status','subtotal','tax','discount','total','deposit_credited','remaining_balance',
      'province','country','due_at','issued_at','paid_at','payment_method','notes',
      'share_token','updated_at',
    ];
    const { data: invoice, error: invErr } = await selectWithFallback(
      'invoices',
      INVOICE_COLS,
      q => q.eq('share_token', token).maybeSingle(),
    );

    if (invErr) {
      console.error('[public-invoice] invoice query error:', invErr.message, invErr.code, invErr.hint);
      return res.status(500).json({
        error: 'Database error',
        detail: invErr.message,
        code: invErr.code || null,
        hint: invErr.hint || null,
      });
    }
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    // Fetch invoice items (best-effort)
    let invoiceItems = [];
    try {
      const { data: items, error: itemsErr } = await supabase
        .from('invoice_items')
        .select('id,name,quantity,unit_price,notes,category,sort_order,included')
        .eq('invoice_id', invoice.id)
        .order('sort_order', { ascending: true });
      if (itemsErr) console.warn('[public-invoice] items error:', itemsErr.message);
      invoiceItems = (items || []).filter(i => i.included !== false);
    } catch (e) { console.warn('[public-invoice] items fetch threw:', e.message); }

    // Fetch payments (best-effort)
    let payments = [];
    try {
      const { data: pays, error: payErr } = await supabase
        .from('payments')
        .select('id,amount,method,notes,paid_at')
        .eq('invoice_id', invoice.id)
        .order('paid_at', { ascending: true });
      if (payErr) console.warn('[public-invoice] payments error:', payErr.message);
      payments = pays || [];
    } catch (e) { console.warn('[public-invoice] payments fetch threw:', e.message); }

    // Fetch customer (best-effort)
    let customer = null;
    if (invoice.customer_id) {
      try {
        const { data: cust, error: custErr } = await supabase
          .from('customers')
          .select('name,email,phone,address')
          .eq('id', invoice.customer_id)
          .maybeSingle();
        if (custErr) console.warn('[public-invoice] customer error:', custErr.message);
        else customer = cust;
      } catch (e) { console.warn('[public-invoice] customer fetch threw:', e.message); }
    }

    // Fetch contractor profile (with column fallback)
    let contractor = null;
    if (invoice.user_id) {
      const PROFILE_COLS = [
        'full_name','company_name','phone','email','logo_url','payment_methods',
        'payment_instructions','etransfer_email','venmo_zelle_handle',
        'square_payment_link','paypal_link','stripe_payment_link',
        'stripe_connect_account_id','stripe_connect_onboarded',
      ];
      const { data: profile, error: profErr } = await selectWithFallback(
        'profiles',
        PROFILE_COLS,
        q => q.eq('id', invoice.user_id).maybeSingle(),
      );
      if (profErr) console.warn('[public-invoice] profile error:', profErr.message);
      else contractor = profile;
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
    console.error('[public-invoice] Error:', err.message, err.stack);
    return res.status(500).json({
      error: 'Server error',
      detail: err?.message || String(err),
      code: err?.code || null,
      hint: err?.hint || null,
    });
  }
}
