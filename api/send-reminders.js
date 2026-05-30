import { createClient } from './_supabase.js';

// ═══════════════════════════════════════════════════════════════
// send-reminders.js — daily cron for two customer reminders:
//   1. Overdue invoices  → "your invoice is past due" (SMS + email)
//   2. Expiring quotes    → "your quote expires soon" (SMS)
//
// Service-role, CRON_SECRET-guarded, fire-and-forget. Invoice sends are
// gated by invoices.last_reminder_sent_at (≥3 days apart). Quote-expiry
// uses a 24h send window (expires in 24–48h) so a daily cron fires it
// about once without needing a new column.
// ═══════════════════════════════════════════════════════════════

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing database configuration');
  return createClient(url, key);
}

const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || 'https://punchlist.ca';
const DAY = 86_400_000;

function fmt(n, country) {
  return new Intl.NumberFormat(country === 'US' ? 'en-US' : 'en-CA',
    { style: 'currency', currency: country === 'US' ? 'USD' : 'CAD', maximumFractionDigits: 0 }).format(Number(n || 0));
}
function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || 'there'; }

async function sendSMS(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from || !to) return;
  let n = String(to).replace(/[\s\-().]/g, '');
  if (n.startsWith('1') && n.length === 11) n = '+' + n;
  else if (n.length === 10) n = '+1' + n;
  else if (!n.startsWith('+')) n = '+1' + n;
  if (!/^\+1\d{10}$/.test(n)) return;
  try {
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: n, From: from, Body: String(body).slice(0, 320) }).toString(),
    });
  } catch { /* fire-and-forget */ }
}

async function sendEmail(to, fromName, subject, html) {
  if (!process.env.RESEND_API_KEY || !to) return;
  const addr = (process.env.EMAIL_FROM || 'notifications@punchlist.ca').replace(/^.*<|>$/g, '');
  const safeName = String(fromName || 'Punchlist').replace(/[<>\r\n"]/g, '').slice(0, 60);
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${safeName} via Punchlist <${addr}>`, to: [to], subject, html }),
    });
  } catch { /* fire-and-forget */ }
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = getSupabase();
  const now = Date.now();
  const nowIso = new Date().toISOString();
  let invoiceReminders = 0, quoteReminders = 0;

  try {
    // ── 1. OVERDUE INVOICES ──
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, user_id, customer_id, invoice_number, title, total, remaining_balance, due_at, status, share_token, country, last_reminder_sent_at')
      .not('status', 'in', '("paid","cancelled","draft")')
      .not('due_at', 'is', null)
      .lt('due_at', nowIso);

    const overdue = (invoices || []).filter(i =>
      !i.last_reminder_sent_at || (now - new Date(i.last_reminder_sent_at).getTime()) >= 3 * DAY);

    if (overdue.length) {
      const uids = [...new Set(overdue.map(i => i.user_id))];
      const cids = [...new Set(overdue.map(i => i.customer_id).filter(Boolean))];
      const [{ data: profs }, { data: custs }] = await Promise.all([
        supabase.from('profiles').select('id, company_name, full_name').in('id', uids),
        cids.length ? supabase.from('customers').select('id, name, email, phone').in('id', cids) : Promise.resolve({ data: [] }),
      ]);
      const pById = new Map((profs || []).map(p => [p.id, p]));
      const cById = new Map((custs || []).map(c => [c.id, c]));

      for (const inv of overdue) {
        const cust = cById.get(inv.customer_id);
        if (!cust) continue;
        const prof = pById.get(inv.user_id);
        const biz = prof?.company_name || prof?.full_name || 'your contractor';
        const bal = Number(inv.remaining_balance ?? inv.total ?? 0);
        if (bal <= 0) continue;
        const due = fmt(bal, inv.country);
        const link = inv.share_token ? `${appUrl}/i/${inv.share_token}` : appUrl;
        const daysOver = Math.floor((now - new Date(inv.due_at).getTime()) / DAY);

        if (cust.phone) {
          await sendSMS(cust.phone, `Hi ${firstName(cust.name)}, a friendly reminder that your ${due} invoice from ${biz}${daysOver > 0 ? ` is ${daysOver} day${daysOver !== 1 ? 's' : ''} past due` : ' is due'}. Pay securely: ${link}`);
        }
        if (cust.email) {
          await sendEmail(cust.email, biz, `Reminder: ${due} invoice from ${biz}`, `
            <div style="font-family:-apple-system,Arial,sans-serif;max-width:520px;margin:0 auto;padding:0;color:#14161a">
              <div style="background:#161616;color:#fff;padding:20px 24px;border-radius:14px 14px 0 0;font-weight:800;font-size:16px">${biz}</div>
              <div style="padding:26px 24px 30px;border:1px solid #e8e6e1;border-top:none;border-radius:0 0 14px 14px">
                <h1 style="font-size:20px;margin:0 0 10px">Payment reminder</h1>
                <p style="color:#667085;line-height:1.6;margin:0 0 20px">Hi ${firstName(cust.name)}, this is a friendly reminder about your invoice for <strong style="color:#14161a">${inv.title || inv.invoice_number || 'services'}</strong>${daysOver > 0 ? ` — now <strong>${daysOver} day${daysOver !== 1 ? 's' : ''} past due</strong>` : ''}.</p>
                <div style="background:#FBF0EA;border:1px solid rgba(184,81,40,.18);border-radius:12px;padding:18px;margin:0 0 22px">
                  <div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.06em">Balance due</div>
                  <div style="font-size:24px;font-weight:800;color:#B85128">${due}</div>
                </div>
                <a href="${link}" style="display:block;text-align:center;background:#B85128;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 20px;border-radius:10px">Pay ${due} now</a>
                <p style="color:#aaa;font-size:11px;margin:20px 0 0">Already paid? Please disregard. · Powered by Punchlist</p>
              </div>
            </div>`);
        }
        await supabase.from('invoices').update({ last_reminder_sent_at: nowIso }).eq('id', inv.id);
        invoiceReminders++;
      }
    }

    // ── 2. EXPIRING QUOTES (expires in 24–48h, still open) ──
    const winStart = new Date(now + DAY).toISOString();
    const winEnd = new Date(now + 2 * DAY).toISOString();
    const { data: quotes } = await supabase
      .from('quotes')
      .select('id, user_id, customer_id, title, share_token, status, expires_at, customer:customers(name,phone)')
      .in('status', ['sent', 'viewed'])
      .gte('expires_at', winStart)
      .lte('expires_at', winEnd);

    if (quotes?.length) {
      const uids = [...new Set(quotes.map(q => q.user_id))];
      const { data: profs } = await supabase.from('profiles').select('id, company_name, full_name').in('id', uids);
      const pById = new Map((profs || []).map(p => [p.id, p]));
      for (const q of quotes) {
        if (!q.customer?.phone) continue;
        const prof = pById.get(q.user_id);
        const biz = prof?.company_name || prof?.full_name || 'your contractor';
        const link = q.share_token ? `${appUrl}/q/${q.share_token}` : appUrl;
        await sendSMS(q.customer.phone, `Hi ${firstName(q.customer.name)}, your quote for "${(q.title || 'your project').slice(0, 40)}" from ${biz} expires soon. Review or approve here: ${link}`);
        quoteReminders++;
      }
    }

    return res.status(200).json({ invoiceReminders, quoteReminders });
  } catch (err) {
    console.error('[send-reminders]', err?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
}
