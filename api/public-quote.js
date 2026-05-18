import { createClient } from '@supabase/supabase-js';
import { blocked, getClientIp } from './_rate-limit.js';

export default async function handler(req, res) {
  // CORS headers for all responses
  const allowed = ['https://www.punchlist.ca', 'https://punchlist.ca']; const origin = req.headers.origin; if (allowed.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 60 requests/min per IP
  if (blocked(res, `pq:${getClientIp(req)}`, 60, 60_000)) return;

  const { token } = req.query;
  
  if (!token) {
    return res.status(400).json({ error: 'Missing share token' });
  }

  // Check environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('[public-quote] Missing env vars:', { 
      hasUrl: !!supabaseUrl, 
      hasKey: !!supabaseKey 
    });
    return res.status(500).json({ 
      error: 'Server configuration error',
      detail: 'Database connection not configured'
    });
  }

  let supabase;
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (e) {
    console.error('[public-quote] Failed to create Supabase client:', e.message);
    return res.status(500).json({ 
      error: 'Server configuration error',
      detail: 'Could not connect to database'
    });
  }

  try {
    // Step 1: Fetch the quote
    // console.log('[public-quote] Fetching quote with token:', token.slice(0, 8) + '...');
    
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('share_token', token)
      .maybeSingle();

    if (quoteError) {
      console.error('[public-quote] Quote query error:', quoteError.message, quoteError.code, quoteError.details);
      return res.status(500).json({ 
        error: 'Database error',
        detail: quoteError.message
      });
    }

    if (!quote) {
      // console.log('[public-quote] No quote found for token');
      return res.status(404).json({ error: 'Quote not found' });
    }

    // console.log('[public-quote] Found quote:', quote.id);

    // Inline expiry: update status to 'expired' if past expires_at
    // This is the no-cron solution — runs on every public quote load
    if (
      quote.expires_at &&
      new Date(quote.expires_at) < new Date() &&
      ['sent', 'viewed'].includes(quote.status)
    ) {
      await supabase
        .from('quotes')
        .update({ status: 'expired' })
        .eq('id', quote.id);
      quote.status = 'expired';
    }

    // Step 2: Fetch line items separately (more reliable than joins)
    let lineItems = [];
    try {
      const { data: items, error: itemsError } = await supabase
        .from('line_items')
        .select('*')
        .eq('quote_id', quote.id)
        .order('sort_order', { ascending: true });
      
      if (itemsError) {
        console.error('[public-quote] Line items error:', itemsError.message);
        // Continue without line items rather than failing
      } else {
        lineItems = items || [];
      }
    } catch (e) {
      console.error('[public-quote] Line items fetch failed:', e.message);
      // Continue without line items
    }

    // console.log('[public-quote] Found', lineItems.length, 'line items');

    // Step 3: Fetch customer separately
    let customer = null;
    if (quote.customer_id) {
      try {
        const { data: cust, error: custError } = await supabase
          .from('customers')
          .select('*')
          .eq('id', quote.customer_id)
          .maybeSingle();
        
        if (custError) {
          console.error('[public-quote] Customer error:', custError.message);
        } else {
          customer = cust;
        }
      } catch (e) {
        console.error('[public-quote] Customer fetch failed:', e.message);
      }
    }

    // Step 4: Fetch contractor profile separately
    let contractor = null;
    if (quote.user_id) {
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', quote.user_id)
          .maybeSingle();
        
        if (profileError) {
          console.error('[public-quote] Profile error:', profileError.message);
        } else {
          contractor = profile;
        }
      } catch (e) {
        console.error('[public-quote] Profile fetch failed:', e.message);
      }
    }

    // Step 5: View recording removed from GET handler.
    // The client-side POST to /api/public-quote-action with action:'view' is the
    // single source of truth for view_count, first_viewed_at, status transitions,
    // and in-app notifications. Running it here too caused double/triple counting.

    // Step 6: Build response payload
    const payload = {
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
      line_items: lineItems,
      customer: customer,
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
      // Signature fields
      signature_data: quote.signature_data || null,
      signed_at: quote.signed_at || null,
      signer_name: quote.signer_name || null,
      view_count: quote.view_count || 0,
      // 2A: Terms & conditions from contractor profile
      terms_conditions: contractor?.terms_conditions || '',
      // 2B: Optional items toggling — returned as-is in line_items
      // 2C: Conversation thread
      conversation: Array.isArray(quote.conversation) ? quote.conversation : [],
    };

    // console.log('[public-quote] Success, returning quote');
    return res.status(200).json({ quote: payload });

  } catch (err) {
    console.error('[public-quote] Unexpected error:', err.message, err.stack);
    return res.status(500).json({ 
      error: 'Server error',
      detail: err.message || 'Unknown error'
    });
  }
}

