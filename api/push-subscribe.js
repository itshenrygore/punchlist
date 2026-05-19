import { createClient } from './_supabase.js';
import { blocked, getClientIp } from './_rate-limit.js';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing database configuration');
  return createClient(url, key);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (blocked(res, `push:${getClientIp(req)}`, 10, 60_000)) return;

  let supabase;
  try {
    supabase = getSupabase();
  } catch (e) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Auth — derive user_id from the session token; never trust it from the body.
  // Accepting user_id from the client would let any caller overwrite any user's
  // push subscription (subscribe them to an attacker-controlled endpoint, or
  // disable their notifications entirely).
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' });
  const user_id = user.id;

  const { subscription, action } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

  try {
    // Unsubscribe: clear the push_subscription
    if (action === 'unsubscribe') {
      await supabase.from('profiles').update({ push_subscription: null }).eq('id', user_id);
      return res.status(200).json({ ok: true });
    }

    // Subscribe: store the push subscription JSON.
    //
    // We validate the shape carefully before persisting because
    // web-push.sendNotification will later POST to whatever URL is in
    // subscription.endpoint — a malicious caller could point that at
    // an internal service (SSRF). Allowlist real push providers.
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Missing subscription data' });
    }
    let endpointUrl;
    try { endpointUrl = new URL(subscription.endpoint); } catch {
      return res.status(400).json({ error: 'Invalid subscription endpoint' });
    }
    if (endpointUrl.protocol !== 'https:') {
      return res.status(400).json({ error: 'Endpoint must be https' });
    }
    const ALLOWED_HOSTS = [
      'fcm.googleapis.com',                         // Chrome / Android
      'updates.push.services.mozilla.com',          // Firefox
      'web.push.apple.com',                         // Safari
    ];
    const ALLOWED_SUFFIXES = [
      '.notify.windows.com',                        // Edge / Windows
      '.push.apple.com',                            // Safari mobile
      '.push.services.mozilla.com',
    ];
    const host = endpointUrl.hostname.toLowerCase();
    if (!ALLOWED_HOSTS.includes(host) && !ALLOWED_SUFFIXES.some(s => host.endsWith(s))) {
      return res.status(400).json({ error: 'Unsupported push service' });
    }
    // Defensive caps on key shape + size. A real subscription is ~400-700 bytes.
    const keys = subscription.keys || {};
    if (typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') {
      return res.status(400).json({ error: 'Subscription keys missing' });
    }
    if (keys.p256dh.length > 200 || keys.auth.length > 64) {
      return res.status(400).json({ error: 'Subscription keys too large' });
    }
    if (JSON.stringify(subscription).length > 2048) {
      return res.status(400).json({ error: 'Subscription payload too large' });
    }

    await supabase.from('profiles').update({
      push_subscription: {
        endpoint: subscription.endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
        expirationTime: subscription.expirationTime ?? null,
      },
    }).eq('id', user_id);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[push-subscribe] Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
