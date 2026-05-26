import { createClient } from './_supabase.js';

// ═══════════════════════════════════════════════════════════════
// send-followup.js — automated quote follow-up nudges (cron-driven)
//
// Invoked by the Vercel cron declared in vercel.json. Scans quotes
// that are still open (sent/viewed), and for each contractor who has
// opted in (profiles.auto_followup_enabled), sends the next nudge in
// their cadence (default 2 / 4 / 7 days after send, capped at 3).
//
// Runs as the service role — there is no user session, so it does NOT
// call rpc_record_followup_send (that RPC enforces auth.uid() and is
// for the contractor-triggered "send nudge" button). Instead it bumps
// the counters directly with an optimistic lock so overlapping runs
// can't double-send.
// ═══════════════════════════════════════════════════════════════

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing database configuration');
  return createClient(url, key);
}

const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || 'https://punchlist.ca';

// System default bodies — kept in sync with src/lib/api/templates.js
// (that module is browser-only, so the strings are duplicated here).
const DEFAULTS = {
  followup_1_sms:
    'Hi {firstName} — any questions on the {quoteTitle} quote? Happy to walk through anything. {link}',
  followup_2_sms:
    "Hi {firstName}, wanted to make sure the {quoteTitle} quote didn't get buried. Still on the table if you want to move forward — just reply or tap the link. {link}",
  followup_3_sms:
    "Hi {firstName}, last nudge on the {quoteTitle} quote — totally understand if the timing isn't right, just let me know either way so I can close the file. {link}",
};

const DEFAULT_CADENCE = { nudge_1: 2, nudge_2: 4, nudge_3: 7 };
const MAX_NUDGES = 3;
const DAY_MS = 86_400_000;

const TOKEN_RE = /\{(\w+)\}/g;
function renderTemplate(body, tokens) {
  if (!body) return '';
  return String(body).replace(TOKEN_RE, (_, name) => {
    const v = tokens[name];
    return v === undefined || v === null ? '' : String(v);
  });
}

function firstName(name) {
  const f = String(name || '').trim().split(/\s+/)[0];
  return f || 'there';
}

function fmtCurrency(n, country = 'CA') {
  const num = Number(n || 0);
  const cfg = country === 'US'
    ? { locale: 'en-US', currency: 'USD' }
    : { locale: 'en-CA', currency: 'CAD' };
  return new Intl.NumberFormat(cfg.locale, { style: 'currency', currency: cfg.currency, maximumFractionDigits: 0 }).format(num);
}

// Server-side Twilio send (no user session). Returns true on success.
async function sendSMS(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from || !to) return false;

  let normalized = String(to).replace(/[\s\-().]/g, '');
  if (normalized.startsWith('1') && normalized.length === 11) normalized = '+' + normalized;
  else if (normalized.length === 10) normalized = '+1' + normalized;
  else if (!normalized.startsWith('+')) normalized = '+1' + normalized;
  if (!/^\+1\d{10}$/.test(normalized)) return false;

  try {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: normalized, From: from, Body: String(body).slice(0, 320) }).toString(),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      console.warn('[send-followup] Twilio error:', data.message || r.status);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[send-followup] SMS failed:', err?.message);
    return false;
  }
}

export default async function handler(req, res) {
  // Same guard as process-recurring: Vercel attaches this header
  // automatically when CRON_SECRET is set on the project.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.TWILIO_ACCOUNT_SID) {
    return res.status(200).json({ sent: 0, reason: 'sms_not_configured' });
  }

  const supabase = getSupabase();
  const now = Date.now();
  const nowIso = new Date().toISOString();

  try {
    // 1. Open quotes that haven't exhausted their nudges.
    const { data: quotes, error } = await supabase
      .from('quotes')
      .select('id, user_id, customer_id, title, total, share_token, status, sent_at, created_at, followup_count, last_followup_at')
      .in('status', ['sent', 'viewed'])
      .lt('followup_count', MAX_NUDGES)
      .not('share_token', 'is', null);

    if (error) throw error;
    if (!quotes?.length) return res.status(200).json({ sent: 0 });

    // 2. Batch-load contractors, customers, and any custom templates.
    const userIds = [...new Set(quotes.map(q => q.user_id))];
    const custIds = [...new Set(quotes.map(q => q.customer_id).filter(Boolean))];

    const [{ data: profiles }, { data: customers }, { data: templates }] = await Promise.all([
      supabase.from('profiles')
        .select('id, company_name, full_name, country, auto_followup_enabled, followup_cadence_days')
        .in('id', userIds),
      custIds.length
        ? supabase.from('customers').select('id, name, phone').in('id', custIds)
        : Promise.resolve({ data: [] }),
      supabase.from('message_templates')
        .select('user_id, template_key, body')
        .in('user_id', userIds)
        .in('template_key', ['followup_1_sms', 'followup_2_sms', 'followup_3_sms']),
    ]);

    const profById = new Map((profiles || []).map(p => [p.id, p]));
    const custById = new Map((customers || []).map(c => [c.id, c]));
    const tplBy = new Map((templates || []).map(t => [`${t.user_id}:${t.template_key}`, t.body]));

    let sent = 0;
    let skipped = 0;

    for (const q of quotes) {
      const prof = profById.get(q.user_id);
      if (!prof?.auto_followup_enabled) { skipped++; continue; }  // opt-in only

      const cust = custById.get(q.customer_id);
      if (!cust?.phone) { skipped++; continue; }                 // need a phone

      const count = Number(q.followup_count || 0);               // 0, 1, or 2
      const slot = count === 0 ? 'nudge_1' : count === 1 ? 'nudge_2' : 'nudge_3';
      const cad = (prof.followup_cadence_days && typeof prof.followup_cadence_days === 'object')
        ? prof.followup_cadence_days : DEFAULT_CADENCE;
      const days = Math.max(1, Number(cad[slot] ?? DEFAULT_CADENCE[slot]));

      // Cadence is measured cumulatively from the send date, matching
      // the "Day 2 / Day 4 / Day 7" framing in the template hints.
      const anchor = new Date(q.sent_at || q.created_at).getTime();
      if (!anchor || now < anchor + days * DAY_MS) { skipped++; continue; }

      // Guard against multiple cron runs in one day (Pro can run sub-daily).
      if (q.last_followup_at && (now - new Date(q.last_followup_at).getTime()) < 20 * 3600 * 1000) {
        skipped++; continue;
      }

      // Bump first, with an optimistic lock on followup_count + an
      // active-status guard. If the customer just approved (status moved)
      // or another run already bumped, this matches 0 rows and we skip —
      // so we never double-text. A send failure after this means the
      // customer simply misses one nudge (safer than spamming).
      const { data: locked, error: lockErr } = await supabase
        .from('quotes')
        .update({
          followup_count: count + 1,
          last_followup_at: nowIso,
          views_since_followup: 0,
          updated_at: nowIso,
        })
        .eq('id', q.id)
        .eq('followup_count', count)
        .in('status', ['sent', 'viewed'])
        .select('id');

      if (lockErr || !locked?.length) { skipped++; continue; }

      const key = count === 0 ? 'followup_1_sms' : count === 1 ? 'followup_2_sms' : 'followup_3_sms';
      const body = renderTemplate(tplBy.get(`${q.user_id}:${key}`) || DEFAULTS[key], {
        firstName: firstName(cust.name),
        senderName: prof.company_name || prof.full_name || 'your contractor',
        quoteTitle: q.title || 'your quote',
        total: fmtCurrency(q.total, prof.country),
        link: `${appUrl}/q/${q.share_token}`,
      });

      const ok = await sendSMS(cust.phone, body);
      if (ok) {
        sent++;
        // Best-effort contractor notification — never blocks the loop.
        await supabase.from('notifications').insert({
          user_id: q.user_id,
          type: 'followup_sent',
          title: `Follow-up sent to ${cust.name || 'your customer'}`,
          body: `Nudge ${count + 1} of ${MAX_NUDGES} for "${q.title || 'your quote'}" went out by text.`,
          link: `/app/quotes/${q.id}`,
          read: false,
        }).then(() => {}, () => {});
      }
    }

    return res.status(200).json({ sent, skipped });
  } catch (err) {
    console.error('[send-followup]', err?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
}
