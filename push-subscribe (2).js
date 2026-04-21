import { createClient } from '@supabase/supabase-js';
import { blocked, getClientIp } from './_rate-limit.js';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || 'https://punchlist.ca';

// Default platform fee — can be overridden per-contractor via profile
const DEFAULT_PLATFORM_FEE_PERCENT = 2.5;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY' });
  if (blocked(res, `pay:${getClientIp(req)}`, 10, 60_000)) return;

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { type, quoteId, invoiceId, shareToken } = req.body || {};

  if (!type || !['deposit', 'invoice'].includes(type)) {
    return res.status(400).json({ error: 'type must be "deposit" or "invoice"' });
  }

  try {
    // ── DEPOSIT payment on a quote ──
    if (type === 'deposit') {
      if (!quoteId || !shareToken) return res.status(400).json({ error: 'Missing quoteId or shareToken' });

      // Get quote + verify share token
      const { data: quote, error: qErr } = await supabase
        .from('quotes')
        .select('id, user_id, customer_id, share_token, total, deposit_amount, deposit_required, deposit_status, status, quote_number, title, country')
        .eq('id', quoteId)
        .maybeSingle();

      if (qErr || !quote) return res.status(404).json({ error: 'Quote not found' });
      if (quote.share_token !== shareToken) return res.status(403).json({ error: 'Invalid token' });
      if (quote.deposit_status === 'paid') return res.status(400).json({ error: 'Deposit already paid' });
      if (!quote.deposit_required || !quote.deposit_amount) return res.status(400).json({ error: 'No deposit required' });

      // Get contractor profile + connect info
      const { data: contractor } = await supabase
        .from('profiles')
        .select('id, stripe_connect_account_id, stripe_connect_onboarded, platform_fee_percent, company_name, full_name, country')
        .eq('id', quote.user_id)
        .maybeSingle();

      if (!contractor?.stripe_connect_account_id || !contractor.stripe_connect_onboarded) {
        return res.status(400).json({ error: 'Contractor has not connected Stripe payments' });
      }

      // Get customer for receipt
      const { data: customer } = await supabase
        .from('customers')
        .select('name, email')
        .eq('id', quote.customer_id)
        .maybeSingle();

      const amountCents = Math.round(Number(quote.deposit_amount) * 100);
      const feePercent = Number(contractor.platform_fee_percent) || DEFAULT_PLATFORM_FEE_PERCENT;
      const feeCents = Math.round(amountCents * feePercent / 100);
      const currency = (contractor.country || quote.country || 'CA') === 'US' ? 'usd' : 'cad';
      const contractorName = contractor.company_name || contractor.full_name || 'Contractor';
      const description = `Deposit — ${quote.title || quote.quote_number || 'Quote'}`;

      // Build Checkout Session params
      const params = new URLSearchParams({
        mode: 'payment',
        'line_items[0][price_data][currency]': currency,
        'line_items[0][price_data][product_data][name]': description,
        'line_items[0][price_data][unit_amount]': String(amountCents),
        'line_items[0][quantity]': '1',
        'payment_intent_data[application_fee_amount]': String(feeCents),
        'payment_intent_data[transfer_data][destination]': contractor.stripe_connect_account_id,
        'metadata[payment_type]': 'quote_deposit',
        'metadata[quote_id]': quoteId,
        'metadata[contractor_id]': contractor.id,
        success_url: `${appUrl}/public/${shareToken}?deposit=success`,
        cancel_url: `${appUrl}/public/${shareToken}`,
      });

      // Add customer email for Stripe receipt
      if (customer?.email) params.append('customer_email', customer.email);

      // Enable BNPL + cards — Affirm first to highlight monthly option
      params.append('payment_method_types[]', 'affirm');
      params.append('payment_method_types[]', 'klarna');
      params.append('payment_method_types[]', 'card');

      // Punchlist branding + monthly nudge on deposit checkout
      params.append('custom_text[submit][message]', `Choose "Pay with Affirm" above to split this into monthly payments. Processed securely for ${contractorName} via Punchlist.`);
      params.append('custom_text[after_submit][message]', `${contractorName} will be notified immediately. Thank you!`);

      const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      const session = await response.json();
      if (!response.ok) {
        console.error('[create-payment-session] Stripe error:', session.error);
        // If Affirm/Klarna not available for this amount/currency, retry with card only
        if (session.error?.message?.includes('payment_method_types')) {
          params.delete('payment_method_types[]');
          params.append('payment_method_types[]', 'card');
          const retry = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
          });
          const retryData = await retry.json();
          if (!retry.ok) return res.status(500).json({ error: retryData.error?.message || 'Stripe checkout failed' });
          return res.status(200).json({ url: retryData.url, sessionId: retryData.id });
        }
        return res.status(500).json({ error: session.error?.message || 'Stripe checkout failed' });
      }

      return res.status(200).json({ url: session.url, sessionId: session.id });
    }

    // ── INVOICE payment ──
    if (type === 'invoice') {
      if (!invoiceId) return res.status(400).json({ error: 'Missing invoiceId' });

      // Get invoice
      const { data: invoice, error: iErr } = await supabase
        .from('invoices')
        .select('id, user_id, customer_id, quote_id, total, status, invoice_number, title, country, share_token')
        .eq('id', invoiceId)
        .maybeSingle();

      if (iErr || !invoice) return res.status(404).json({ error: 'Invoice not found' });
      if (invoice.status === 'paid') return res.status(400).json({ error: 'Invoice already paid' });

      // Verify share token if provided
      if (shareToken && invoice.share_token && invoice.share_token !== shareToken) {
        return res.status(403).json({ error: 'Invalid token' });
      }

      // Calculate balance (subtract existing payments)
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('invoice_id', invoiceId);
      const totalPaid = (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);

      // Also credit deposit if applicable + get quote share_token for redirect
      let depositCredit = 0;
      let quoteShareToken = null;
      if (invoice.quote_id) {
        const { data: q } = await supabase.from('quotes').select('deposit_amount, deposit_status, share_token').eq('id', invoice.quote_id).maybeSingle();
        if (q?.deposit_status === 'paid') depositCredit = Number(q.deposit_amount || 0);
        quoteShareToken = q?.share_token || null;
      }

      const balance = Math.max(0, Number(invoice.total || 0) - totalPaid - depositCredit);
      if (balance <= 0) return res.status(400).json({ error: 'No balance due' });

      // Get contractor
      const { data: contractor } = await supabase
        .from('profiles')
        .select('id, stripe_connect_account_id, stripe_connect_onboarded, platform_fee_percent, company_name, full_name, country')
        .eq('id', invoice.user_id)
        .maybeSingle();

      if (!contractor?.stripe_connect_account_id || !contractor.stripe_connect_onboarded) {
        return res.status(400).json({ error: 'Contractor has not connected Stripe payments' });
      }

      // Get customer
      const { data: customer } = await supabase
        .from('customers')
        .select('name, email')
        .eq('id', invoice.customer_id)
        .maybeSingle();

      const amountCents = Math.round(balance * 100);
      const feePercent = Number(contractor.platform_fee_percent) || DEFAULT_PLATFORM_FEE_PERCENT;
      const feeCents = Math.round(amountCents * feePercent / 100);
      const currency = (contractor.country || invoice.country || 'CA') === 'US' ? 'usd' : 'cad';
      const contractorName = contractor.company_name || contractor.full_name || 'Contractor';
      const description = `Payment — ${invoice.title || invoice.invoice_number || 'Invoice'}`;

      const params = new URLSearchParams({
        mode: 'payment',
        'line_items[0][price_data][currency]': currency,
        'line_items[0][price_data][product_data][name]': description,
        'line_items[0][price_data][unit_amount]': String(amountCents),
        'line_items[0][quantity]': '1',
        'payment_intent_data[application_fee_amount]': String(feeCents),
        'payment_intent_data[transfer_data][destination]': contractor.stripe_connect_account_id,
        'metadata[payment_type]': 'invoice_payment',
        'metadata[invoice_id]': invoiceId,
        'metadata[contractor_id]': contractor.id,
        success_url: quoteShareToken
          ? `${appUrl}/public/${quoteShareToken}?tab=payments&payment=success`
          : `${appUrl}/public/invoice/${invoice.share_token}?payment=success`,
        cancel_url: quoteShareToken
          ? `${appUrl}/public/${quoteShareToken}?tab=payments`
          : `${appUrl}/public/invoice/${invoice.share_token}`,
      });

      if (customer?.email) params.append('customer_email', customer.email);

      // Affirm first to highlight monthly option
      params.append('payment_method_types[]', 'affirm');
      params.append('payment_method_types[]', 'klarna');
      params.append('payment_method_types[]', 'card');

      // Punchlist branding + monthly nudge on invoice checkout
      params.append('custom_text[submit][message]', `Choose "Pay with Affirm" above to split this into monthly payments. Processed securely for ${contractorName} via Punchlist.`);
      params.append('custom_text[after_submit][message]', `${contractorName} will be notified immediately. Thank you!`);

      const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      const session = await response.json();
      if (!response.ok) {
        // Fallback to card-only if BNPL not available for this amount/currency
        if (session.error?.message?.includes('payment_method_types')) {
          params.delete('payment_method_types[]');
          params.append('payment_method_types[]', 'card');
          const retry = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
          });
          const retryData = await retry.json();
          if (!retry.ok) return res.status(500).json({ error: retryData.error?.message || 'Stripe checkout failed' });
          return res.status(200).json({ url: retryData.url, sessionId: retryData.id });
        }
        return res.status(500).json({ error: session.error?.message || 'Stripe checkout failed' });
      }

      return res.status(200).json({ url: session.url, sessionId: session.id });
    }

  } catch (err) {
    console.error('[create-payment-session] error:', err?.message);
    return res.status(500).json({ error: err?.message || 'Payment session error' });
  }
}
