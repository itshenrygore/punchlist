import { blocked, getClientIp } from './_rate-limit.js';
import { createClient } from './_supabase.js';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;

const E164_RE = /^\+[1-9]\d{7,14}$/;

function normalize(phone) {
  let p = String(phone || '').trim().replace(/[\s\-().]/g, '');
  if (/^\d{10}$/.test(p)) p = '+1' + p;
  else if (/^1\d{10}$/.test(p)) p = '+' + p;
  return p;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (blocked(res, `sms:${getClientIp(req)}`, 20, 60_000)) return;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
    return res.status(200).json({ ok: false, reason: 'not_configured' });
  }

  // Auth: require the contractor's session JWT and confirm the
  // destination phone belongs to either themselves or one of their
  // customers. Previously this endpoint was open — anyone could POST
  // arbitrary to/body and burn the Twilio balance.
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'Server configuration error' });
  const supabase = createClient(url, key);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.slice(7));
  if (authErr || !user) return res.status(401).json({ error: 'Invalid session' });

  const { to, body } = req.body || {};
  if (!to || !body) return res.status(400).json({ error: 'Missing to or body' });

  const normalizedTo = normalize(to);
  // The phone must be on the authenticated user's profile or one of
  // their customers — otherwise we'd be a free SMS gateway.
  const [{ data: profile }, { data: customers }] = await Promise.all([
    supabase.from('profiles').select('phone').eq('id', user.id).maybeSingle(),
    supabase.from('customers').select('phone').eq('user_id', user.id).not('phone', 'is', null),
  ]);
  const allowed = new Set();
  if (profile?.phone) allowed.add(normalize(profile.phone));
  for (const c of (customers || [])) if (c.phone) allowed.add(normalize(c.phone));
  if (!allowed.has(normalizedTo)) {
    return res.status(403).json({ ok: false, reason: 'recipient_not_allowed' });
  }

  if (!E164_RE.test(normalizedTo)) {
    return res.status(200).json({ ok: false, reason: 'invalid_phone' });
  }

  try {
    const params = new URLSearchParams({ To: normalizedTo, From: TWILIO_FROM, Body: String(body).slice(0, 1600) });
    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      },
    );

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('[send-sms] Twilio error:', data.message || r.status);
      return res.status(200).json({ ok: false, reason: 'twilio_error' });
    }

    return res.status(200).json({ ok: true, sid: data.sid });
  } catch (err) {
    console.error('[send-sms] error:', err?.message);
    return res.status(200).json({ ok: false, reason: 'twilio_error' });
  }
}
