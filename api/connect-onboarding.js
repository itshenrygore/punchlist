import { createClient } from '@supabase/supabase-js';
import { blocked, getClientIp } from './_rate-limit.js';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || 'https://punchlist.ca';

async function stripePost(endpoint, params) {
  const res = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Stripe error ${res.status}`);
  return data;
}

async function stripeGet(endpoint) {
  const res = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Stripe error ${res.status}`);
  return data;
}

/**
 * Derive a clean payment state from Stripe account status.
 * Returns: 'not_started' | 'stripe_onboarding_started' | 'pending_review' | 'active' | 'action_required' | 'restricted'
 */
function derivePaymentState(account) {
  if (!account) return 'not_started';

  const { charges_enabled, payouts_enabled, requirements } = account;
  const currentlyDue = requirements?.currently_due || [];
  const pastDue = requirements?.past_due || [];
  const disabled = requirements?.disabled_reason;

  if (charges_enabled && payouts_enabled) return 'active';
  if (disabled === 'requirements.past_due' || pastDue.length > 0) return 'restricted';
  if (currentlyDue.length > 0) return 'action_required';
  if (requirements?.pending_verification?.length > 0) return 'pending_review';
  return 'stripe_onboarding_started';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY' });
  if (blocked(res, `conn:${getClientIp(req)}`, 10, 60_000)) return;

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { action, userId, termsVersion, returnPath } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, company_name, email, phone, country, stripe_connect_account_id, stripe_connect_onboarded, payments_terms_accepted_at, payments_terms_version')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  // Build return/refresh URLs dynamically
  const basePath = returnPath || '/app/payments/setup';
  const refreshUrl = `${appUrl}${basePath}${basePath.includes('?') ? '&' : '?'}connect=refresh`;
  const returnUrl = `${appUrl}${basePath}${basePath.includes('?') ? '&' : '?'}connect=complete`;

  try {
    // ── ACCEPT_TERMS: Store legal acknowledgment ──
    if (action === 'accept_terms') {
      const ip = getClientIp(req) || 'unknown';
      await supabase.from('profiles').update({
        payments_terms_accepted_at: new Date().toISOString(),
        payments_terms_version: termsVersion || 'unknown',
        payments_terms_ip: ip,
      }).eq('id', userId);

      return res.status(200).json({ ok: true });
    }

    // ── CREATE: Create Express connected account + return onboarding URL ──
    if (action === 'create') {
      let accountId = profile.stripe_connect_account_id;

      if (!accountId) {
        const accountParams = {
          type: 'express',
          country: profile.country === 'US' ? 'US' : 'CA',
          'capabilities[card_payments][requested]': 'true',
          'capabilities[transfers][requested]': 'true',
          'business_type': 'individual',
        };
        // Prefill known info (Stripe best practice)
        if (profile.email) accountParams.email = profile.email;
        if (profile.company_name) accountParams['business_profile[name]'] = profile.company_name;
        if (profile.company_name) accountParams['business_profile[url]'] = appUrl;
        if (profile.full_name) {
          const parts = profile.full_name.trim().split(/\s+/);
          if (parts.length >= 2) {
            accountParams['individual[first_name]'] = parts[0];
            accountParams['individual[last_name]'] = parts.slice(1).join(' ');
          }
        }
        if (profile.email) accountParams['individual[email]'] = profile.email;
        if (profile.phone) accountParams['individual[phone]'] = profile.phone;

        const account = await stripePost('accounts', accountParams);
        accountId = account.id;

        await supabase.from('profiles').update({
          stripe_connect_account_id: accountId,
          stripe_connect_onboarded: false,
        }).eq('id', userId);
      }

      const link = await stripePost('account_links', {
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });

      return res.status(200).json({ url: link.url, accountId });
    }

    // ── STATUS: Enriched status check ──
    if (action === 'status') {
      if (!profile.stripe_connect_account_id) {
        return res.status(200).json({
          connected: false,
          onboarded: false,
          paymentState: 'not_started',
          termsAccepted: Boolean(profile.payments_terms_accepted_at),
        });
      }

      const account = await stripeGet(`accounts/${profile.stripe_connect_account_id}`);
      const onboarded = Boolean(account.charges_enabled && account.payouts_enabled);
      const paymentState = derivePaymentState(account);

      if (onboarded !== profile.stripe_connect_onboarded) {
        await supabase.from('profiles').update({
          stripe_connect_onboarded: onboarded,
        }).eq('id', userId);
      }

      return res.status(200).json({
        connected: true,
        onboarded,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        accountId: profile.stripe_connect_account_id,
        paymentState,
        termsAccepted: Boolean(profile.payments_terms_accepted_at),
        requirements: account.requirements?.currently_due || [],
        pastDue: account.requirements?.past_due || [],
      });
    }

    // ── DASHBOARD: Get Express Dashboard login link ──
    if (action === 'dashboard') {
      if (!profile.stripe_connect_account_id) {
        return res.status(400).json({ error: 'No connected account' });
      }
      const loginLink = await stripePost('accounts/' + profile.stripe_connect_account_id + '/login_links', {});
      return res.status(200).json({ url: loginLink.url });
    }

    // ── REFRESH: Re-create onboarding link ──
    if (action === 'refresh') {
      if (!profile.stripe_connect_account_id) {
        return res.status(400).json({ error: 'No connected account. Use action=create first.' });
      }
      const link = await stripePost('account_links', {
        account: profile.stripe_connect_account_id,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });
      return res.status(200).json({ url: link.url });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (err) {
    console.error('[connect-onboarding] error:', err?.message);
    return res.status(500).json({ error: err?.message || 'Stripe Connect error' });
  }
}
