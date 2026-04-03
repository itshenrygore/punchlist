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

  const { user_id, subscription, action } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

  let supabase;
  try {
    supabase = getSupabase();
  } catch (e) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

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
