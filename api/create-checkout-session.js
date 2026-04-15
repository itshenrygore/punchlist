import { createClient } from '@supabase/supabase-js';
import { blocked, getClientIp } from './_rate-limit.js';

// Defensive Supabase client factory — never created at module level
function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || 'https://punchlist.ca';

const PRICES = {
  monthly: process.env.STRIPE_PRICE_MONTHLY,
  yearly:  process.env.STRIPE_PRICE_YEARLY,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY' });
  if (blocked(res, `chk:${getClientIp(req)}`, 10, 60_000)) return;

  const body = req.body || {};

  // ── BILLING PORTAL (Stripe Customer Portal for Pro subscribers) ──
  if (body.action === 'billing_portal') {
    const { customerId } = body;
    if (!customerId) return res.status(400).json({ error: 'Missing customerId' });

    const configId = process.env.STRIPE_PORTAL_CONFIG_ID || null;

    const params = new URLSearchParams({
      customer: customerId,
      return_url: `${appUrl}/app/billing`,
    });
    if (configId) params.append('configuration', configId);

    try {
      const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });
      const data = await response.json();
      if (!response.ok) return res.status(500).json({ error: data.error?.message || 'Portal failed' });
      return res.status(200).json({ url: data.url });
    } catch (err) {
      console.error('[create-checkout-session] portal error:', err?.message);
      return res.status(500).json({ error: 'Could not open billing portal.' });
    }
  }

  // ── DEPOSIT CHECKOUT — DEPRECATED ──
  // Deposits now handled via contractor's own Stripe payment link or manual payment.
  // This path is kept as a no-op for backwards compatibility with any in-flight requests.
  if (body.quoteId && body.shareToken) {
    return res.status(410).json({ error: 'Deposit checkout has been replaced with direct payment. Please refresh the page.' });
  }

  // ── INVOICE PAYMENT — DEPRECATED ──
  // Invoice payments now use contractor's own payment links (Square, PayPal, Stripe link, etc.)
  if (body.invoiceId && body.paymentType === 'invoice_payment') {
    return res.status(410).json({ error: 'Invoice payment checkout has been replaced with direct payment. Please refresh the page.' });
  }

  // ── SUBSCRIPTION CHECKOUT ──
  const { priceKey } = body;
  const price = PRICES[priceKey];
  if (!price) return res.status(400).json({ error: `Unknown price key: ${priceKey}. Must be 'monthly' or 'yearly'.` });

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        mode: 'subscription',
        'line_items[0][price]': price,
        'line_items[0][quantity]': '1',
        success_url: `${appUrl}/app`,
        cancel_url: `${appUrl}/pricing`,
      }),
    });
    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'Stripe checkout failed' });
    return res.status(200).json({ url: data.url });
  } catch (err) {
    console.error('[create-checkout-session] subscription error:', err?.message);
    return res.status(500).json({ error: 'Could not create checkout session.' });
  }
}
