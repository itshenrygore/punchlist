import { blocked, getClientIp } from './_rate-limit.js';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;

const E164_RE = /^\+[1-9]\d{7,14}$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (blocked(res, `sms:${getClientIp(req)}`, 20, 60_000)) return;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
    return res.status(200).json({ ok: false, reason: 'not_configured' });
  }

  const { to, body } = req.body || {};
  if (!to || !body) return res.status(400).json({ error: 'Missing to or body' });

  const phone = String(to).trim();
  if (!E164_RE.test(phone)) {
    return res.status(200).json({ ok: false, reason: 'invalid_phone' });
  }

  try {
    const params = new URLSearchParams({ To: phone, From: TWILIO_FROM, Body: String(body).slice(0, 1600) });
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
