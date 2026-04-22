// ═══════════════════════════════════════════════════════════════════════════
// PUNCHLIST — POST /api/send-followup
// v100 Workstream A Part 2 (M3). Spec: PHASE4-V100-PLAN.md §3.5.
//
// Body: { quoteId, customMessage?, method?: 'sms' | 'email' }
//
// Flow:
//   1. Auth — Bearer token from Supabase session
//   2. Ownership — load quote, confirm user_id matches
//   3. Rate limit — 5 follow-ups per customer per rolling week
//   4. Atomic counter bump via rpc_record_followup_send (M3 migration)
//   5. Resolve message body (custom or template render)
//   6. Send via Twilio (SMS) or Resend (email)
//   7. Return { ok, followup_count, last_followup_at, views_since_followup }
//
// The RPC bumps counters before the actual send (step 4 before step 6).
// This is intentional — see migration comment for rationale.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import { blocked, getClientIp } from './_rate-limit.js';

// ── Supabase (service role — needed for SECURITY DEFINER RPC) ──
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ── Token substitution (mirrors renderTemplate in src/lib/api/templates.js) ──
const TOKEN_RE = /\{(\w+)\}/g;
function renderTemplate(body, tokens = {}) {
  if (!body) return '';
  return String(body).replace(TOKEN_RE, (_, name) => {
    const v = tokens[name];
    return v === undefined || v === null ? '' : String(v);
  });
}

// ── System defaults (mirror of SYSTEM_DEFAULTS in templates.js) ──
// Duplicated here intentionally — the API endpoint must work independently
// of the client bundle and cannot import from src/.
const SYSTEM_DEFAULTS = {
  initial_sms:
    'Hi {firstName}, your quote from {senderName} is ready:\n\n{quoteTitle} — {total}\n\n{link}',
  followup_1_sms:
    'Hi {firstName} — any questions on the {quoteTitle} quote? Happy to walk through anything. {link}',
  followup_2_sms:
    "Hi {firstName}, wanted to make sure the {quoteTitle} quote didn't get buried. Still on the table if you want to move forward — just reply or tap the link. {link}",
  followup_3_sms:
    "Hi {firstName}, last nudge on the {quoteTitle} quote — totally understand if the timing isn't right, just let me know either way so I can close the file. {link}",
};

// Pick the right follow-up tier body from DB or system defaults.
// followup_count is the count BEFORE this send (pre-increment).
function pickTemplateKey(followupCount) {
  const n = Math.max(0, Number(followupCount) || 0);
  if (n === 0) return 'followup_1_sms';
  if (n === 1) return 'followup_2_sms';
  return 'followup_3_sms';
}

async function resolveTemplateBody(supabase, userId, followupCount) {
  const key = pickTemplateKey(followupCount);
  // Try to load the user's custom template first.
  const { data } = await supabase
    .from('message_templates')
    .select('body')
    .eq('user_id', userId)
    .eq('template_key', key)
    .eq('locale', 'en')
    .maybeSingle();
  return data?.body || SYSTEM_DEFAULTS[key] || '';
}

// ── Phone normalizer (matches send-sms.js) ──
function normalizePhone(raw) {
  let n = raw.replace(/[\s\-().]/g, '');
  if (n.startsWith('1') && n.length === 11) n = '+' + n;
  else if (n.length === 10) n = '+1' + n;
  else if (!n.startsWith('+')) n = '+1' + n;
  return n;
}

// ── Twilio send (inlined — avoids cross-function import) ──
async function sendTwilio(to, body) {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return { ok: false, reason: 'not_configured' };

  const normalized = normalizePhone(to);
  if (!/^\+1\d{10}$/.test(normalized)) return { ok: false, reason: 'invalid_phone' };

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: normalized, From: from, Body: body.slice(0, 320) }).toString(),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[send-followup] Twilio error:', res.status, err?.message);
      return { ok: false, reason: 'twilio_error', status: res.status };
    }
    const data = await res.json();
    return { ok: true, sid: data.sid };
  } catch (e) {
    console.error('[send-followup] Twilio fetch error:', e?.message);
    return { ok: false, reason: 'network_error' };
  }
}

// ── Resend email send ──
function formatCurrency(n, country = 'CA') {
  const num = Number(n || 0);
  return new Intl.NumberFormat(country === 'US' ? 'en-US' : 'en-CA', {
    style: 'currency',
    currency: country === 'US' ? 'USD' : 'CAD',
    maximumFractionDigits: 0,
  }).format(num);
}

async function sendResendEmail({ to, customerName, contractorName, contractorEmail, subject, bodyText, quoteTitle, shareUrl, country }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, reason: 'not_configured' };

  const fromAddress = process.env.EMAIL_FROM || 'notifications@punchlist.ca';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromAddress,
        reply_to: contractorEmail || undefined,
        to: [to],
        subject,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#f9fafb;margin:0;padding:24px">
  <div style="max-width:540px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e5e7eb;padding:32px">
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#111827">${bodyText.replace(/\n/g, '<br>')}</p>
    ${shareUrl ? `<a href="${shareUrl}" style="display:inline-block;margin-top:8px;padding:12px 24px;background:#f97316;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">View quote →</a>` : ''}
    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">— ${contractorName}</p>
  </div>
</body>
</html>`,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[send-followup] Resend error:', res.status, err?.message);
      return { ok: false, reason: 'resend_error', status: res.status };
    }
    return { ok: true };
  } catch (e) {
    console.error('[send-followup] Resend fetch error:', e?.message);
    return { ok: false, reason: 'network_error' };
  }
}

// ── Auth helper — extracts user and raw token from Bearer header ──
async function getAuthUser(req, supabase) {
  const header = req.headers['authorization'] || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { user: null, token: null };
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { user: null, token: null };
  return { user, token };
}

// ── Main handler (wrapped) ──
// The wrapper catches any unhandled throw (bad JSON, network blip, undefined
// access) and returns a clean 500 with the stack logged. Without this, a throw
// becomes an opaque "FUNCTION_INVOCATION_FAILED" with no diagnostic value.
export default async function handler(req, res) {
  try {
    return await _handler(req, res);
  } catch (err) {
    console.error('[send-followup] Unhandled error:', err?.stack || err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

async function _handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabase();
  if (!supabase) {
    console.error('[send-followup] Missing Supabase env vars');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // 1. Auth
  const { user, token } = await getAuthUser(req, supabase);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  // Build a user-scoped client (with the caller's JWT) for the SECURITY DEFINER
  // RPC, which calls auth.uid() internally to verify ownership. The service-role
  // client has no user JWT, so auth.uid() returns NULL and the RPC always raises
  // 'not_owner'. The service-role client continues to be used for all other
  // queries where bypassing RLS is intentional.
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const userSupabase = anonKey
    ? createClient(process.env.SUPABASE_URL, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      })
    : supabase; // fallback: RPC may still fail, but avoids a hard crash

  const { quoteId, customMessage, method } = req.body || {};
  if (!quoteId) return res.status(400).json({ error: 'quoteId required' });

  // 2. Load quote + ownership check
  const { data: quote, error: qErr } = await supabase
    .from('quotes')
    .select('id, user_id, title, total, share_token, country, followup_count, customer_id')
    .eq('id', quoteId)
    .maybeSingle();

  if (qErr || !quote) return res.status(404).json({ error: 'Quote not found' });
  if (quote.user_id !== user.id) return res.status(403).json({ error: 'Not your quote' });

  // Load customer
  const { data: customer } = await supabase
    .from('customers')
    .select('id, name, phone, email')
    .eq('id', quote.customer_id)
    .maybeSingle();

  const phone = customer?.phone;
  const email = customer?.email;
  const sendMethod = method || (phone ? 'sms' : email ? 'email' : null);

  if (!sendMethod) return res.status(400).json({ error: 'Customer has no phone or email on file' });
  if (sendMethod === 'sms' && !phone) return res.status(400).json({ error: 'No phone number on file' });
  if (sendMethod === 'email' && !email) return res.status(400).json({ error: 'No email address on file' });

  // 3. Rate limit — 5 follow-ups per customer per rolling 7 days
  // Key: user_id + customer_id combo to prevent hammering a single customer
  const rateLimitKey = `followup:${user.id}:${quote.customer_id}`;
  if (blocked(res, rateLimitKey, 5, 7 * 24 * 60 * 60 * 1000)) return;

  // 3b. Pre-flight: refuse cleanly if the chosen send channel obviously can't work.
  // This avoids bumping the counter (step 4) when we already know the send will
  // fail — otherwise the user gets "Send failed" repeatedly while their nudge
  // count advances toward the rate limit for no reason.
  if (sendMethod === 'sms') {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
      console.warn('[send-followup] Twilio not configured — refusing send before counter bump');
      return res.status(503).json({
        error: 'Text sending is not set up yet. Open your messages app to send manually, or contact support.',
        sendReason: 'not_configured',
      });
    }
    // Validate phone format up front so a bad number doesn't burn a nudge slot.
    const normalizedPhone = normalizePhone(phone);
    if (!/^\+1\d{10}$/.test(normalizedPhone)) {
      return res.status(400).json({
        error: 'That customer’s phone number isn’t valid. Update it and try again.',
        sendReason: 'invalid_phone',
      });
    }
  } else if (sendMethod === 'email') {
    if (!process.env.RESEND_API_KEY) {
      console.warn('[send-followup] Resend not configured — refusing send before counter bump');
      return res.status(503).json({
        error: 'Email sending is not set up yet. Contact support.',
        sendReason: 'not_configured',
      });
    }
  }

  // 4. Atomic counter bump — must use user-scoped client so auth.uid() resolves
  const { data: rpcData, error: rpcErr } = await userSupabase
    .rpc('rpc_record_followup_send', { p_quote_id: quoteId });

  if (rpcErr) {
    // Log the full error object so missing-migration / missing-column / RLS
    // failures are diagnosable from server logs without guessing.
    console.error('[send-followup] RPC error:', {
      message: rpcErr.message,
      code:    rpcErr.code,
      details: rpcErr.details,
      hint:    rpcErr.hint,
    });
    if (rpcErr.message?.includes('not_owner')) return res.status(403).json({ error: 'Not your quote' });
    if (rpcErr.message?.includes('quote_not_found')) return res.status(404).json({ error: 'Quote not found' });
    // PostgREST returns code PGRST202 / 42883 when the function doesn't exist.
    // This means the v100 follow-up migrations haven't been applied to this DB.
    if (rpcErr.code === 'PGRST202' || rpcErr.code === '42883' || rpcErr.message?.includes('does not exist')) {
      return res.status(500).json({
        error: 'Follow-up tracking is not set up on this database. Apply migration_v100_followup.sql and migration_v100_followup_rpc.sql.',
      });
    }
    return res.status(500).json({ error: 'Failed to record follow-up' });
  }

  const newState = rpcData;
  // followup_count in newState is POST-increment; resolve template using PRE-increment count
  const preIncrementCount = (newState.followup_count || 1) - 1;

  // 5. Resolve message body
  let messageBody = customMessage?.trim() || '';
  if (!messageBody) {
    const templateBody = await resolveTemplateBody(supabase, user.id, preIncrementCount);
    const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || 'https://punchlist.ca';
    const shareUrl = quote.share_token ? `${appUrl}/public/${quote.share_token}` : '';
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_name, full_name')
      .eq('id', user.id)
      .maybeSingle();
    const senderName = profile?.company_name || profile?.full_name || 'Your contractor';

    messageBody = renderTemplate(templateBody, {
      firstName:   customer?.name?.split(' ')[0] || '',
      senderName,
      quoteTitle:  quote.title || 'your quote',
      total:       formatCurrency(quote.total, quote.country || 'CA'),
      link:        shareUrl,
    });
  }

  // 6. Send
  let sendResult;
  if (sendMethod === 'sms') {
    sendResult = await sendTwilio(phone, messageBody);
  } else {
    const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || 'https://punchlist.ca';
    const shareUrl = quote.share_token ? `${appUrl}/public/${quote.share_token}` : '';
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_name, full_name, email')
      .eq('id', user.id)
      .maybeSingle();
    const contractorName = profile?.company_name || profile?.full_name || 'Your contractor';

    sendResult = await sendResendEmail({
      to:              email,
      customerName:    customer?.name || '',
      contractorName,
      contractorEmail: profile?.email,
      subject:         `Following up on your quote — ${quote.title || 'from ' + contractorName}`,
      bodyText:        messageBody,
      quoteTitle:      quote.title,
      shareUrl,
      country:         quote.country || 'CA',
    });
  }

  if (!sendResult.ok) {
    console.warn('[send-followup] Send failed:', sendResult.reason);
    // Note: counters are already bumped. Client should show the toast as a
    // partial success or let them retry. We still return the new state.
    return res.status(502).json({
      error: 'Message send failed — nudge recorded but not delivered',
      sendReason: sendResult.reason,
      ...newState,
    });
  }

  // 7. Return new state for client reconciliation
  return res.status(200).json({
    ok: true,
    method: sendMethod,
    followup_count:       newState.followup_count,
    last_followup_at:     newState.last_followup_at,
    views_since_followup: 0,
  });
}
