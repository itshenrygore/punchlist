import { createClient } from '@supabase/supabase-js';
import { blocked, getClientIp } from './_rate-limit.js';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
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

    // Subscribe: store the push subscription JSON
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Missing subscription data' });
    }

    await supabase.from('profiles').update({
      push_subscription: subscription,
    }).eq('id', user_id);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[push-subscribe] Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
