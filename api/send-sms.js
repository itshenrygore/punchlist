import { createClient } from '@supabase/supabase-js';
import { blocked, getClientIp } from './_rate-limit.js';

/* ═══════════════════════════════════════════════════════════════════════════
   PUNCHLIST — Twilio SMS Notification Engine
   
   Central endpoint for all SMS notifications. Every email touchpoint in the
   app has a parallel SMS path that routes through here.
   
   Env vars required:
     TWILIO_ACCOUNT_SID   — Twilio Account SID
     TWILIO_AUTH_TOKEN     — Twilio Auth Token
     TWILIO_PHONE_NUMBER   — Twilio phone number (E.164 format, e.g. +16475551234)
     SUPABASE_URL          — Supabase project URL
     SUPABASE_SERVICE_ROLE_KEY — Supabase service role key
   
   Rate limits:
     - 20 SMS/min per IP (prevents abuse)
     - Twilio's own rate limits apply (~1 msg/sec per number)
   
   Design principles:
     - SMS is for ALERTS, not content. Keep under 160 chars when possible.
     - Always include a deep link so the recipient can act immediately.
     - Never send SMS without explicit opt-in (contractor enables in Settings).
     - Customer SMS only when contractor has customer phone on file.
   ═══════════════════════════════════════════════════════════════════════════ */

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function formatCurrency(n, country = 'CA') {
  const num = Number(n || 0);
  if (country === 'US') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(num);
}

// ── Twilio REST API (no SDK — keeps bundle small for Vercel) ──
async function sendTwilioSMS(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    console.warn('[send-sms] Twilio not configured — skipping SMS');
    return { ok: false, reason: 'not_configured' };
  }

  // Normalize phone to E.164 — handle common Canadian/US formats
  let normalized = to.replace(/[\s\-().]/g, '');
  if (normalized.startsWith('1') && normalized.length === 11) normalized = '+' + normalized;
  else if (normalized.length === 10) normalized = '+1' + normalized;
  else if (!normalized.startsWith('+')) normalized = '+1' + normalized;

  // Validate: must be a plausible NA number
  if (!/^\+1\d{10}$/.test(normalized)) {
    console.warn('[send-sms] Invalid phone format:', to, '→', normalized);
    return { ok: false, reason: 'invalid_phone' };
  }

  // Truncate body to SMS limits (1600 chars max for concatenated SMS, but aim for 320 = 2 segments)
  const safeBody = body.slice(0, 320);

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: normalized, From: from, Body: safeBody }).toString(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[send-sms] Twilio error:', res.status, err?.message || err?.code);
      return { ok: false, reason: 'twilio_error', status: res.status, code: err?.code };
    }

    const data = await res.json();
    console.log('[send-sms] Sent to', normalized.slice(0, 6) + '****', 'sid:', data.sid?.slice(0, 12));
    return { ok: true, sid: data.sid };
  } catch (err) {
    console.error('[send-sms] Fetch error:', err?.message);
    return { ok: false, reason: 'network_error' };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   MESSAGE TEMPLATES
   
   Each template is a function that returns a string under 320 chars.
   Deep links go to either the public page (customer) or the app (contractor).
   ═══════════════════════════════════════════════════════════════════════════ */

function templates(appUrl) {
  const u = appUrl || 'https://punchlist.ca';
  return {
    // ── Customer-facing ──
    quote_ready: ({ contractorName, quoteTitle, total, shareToken, country }) =>
      `${contractorName} sent you a quote for ${quoteTitle}${total ? ' (' + formatCurrency(total, country) + ')' : ''}. Review and approve here: ${u}/public/${shareToken}`,

    booking_confirmation: ({ contractorName, date, time }) =>
      `Your job with ${contractorName} is confirmed for ${date} at ${time}. They'll be there on time. Questions? Reply to this text.`,

    booking_reschedule: ({ contractorName, date, time }) =>
      `${contractorName} rescheduled your appointment to ${date} at ${time}. If this doesn't work, reply to this text.`,

    booking_cancel: ({ contractorName, date }) =>
      `${contractorName} cancelled the appointment that was set for ${date}. They'll follow up to reschedule.`,

    invoice_ready: ({ contractorName, invoiceTitle, total, shareToken, country }) =>
      `${contractorName} sent you an invoice for ${invoiceTitle || 'completed work'}${total ? ': ' + formatCurrency(total, country) : ''}. View & pay: ${u}/public/invoice/${shareToken}`,

    payment_reminder: ({ contractorName, invoiceNumber, balance, daysPastDue, shareToken, country }) =>
      `Reminder: Your payment of ${formatCurrency(balance, country)} to ${contractorName} is ${daysPastDue} days overdue.${shareToken ? ' Pay here: ' + u + '/public/invoice/' + shareToken : ''}`,

    payment_receipt: ({ contractorName, amount, country }) =>
      `Payment received! ${contractorName} confirmed your payment of ${formatCurrency(amount, country)}. Thank you.`,

    contractor_reply: ({ contractorName, quoteTitle, shareToken }) =>
      `${contractorName} replied to your question about "${quoteTitle}". View the response: ${u}/public/${shareToken}`,

    additional_work: ({ contractorName, title, total, shareToken, country }) =>
      `${contractorName} found additional work needed: ${title}${total ? ' (' + formatCurrency(total, country) + ')' : ''}. Review: ${u}/public/aw/${shareToken}`,

    amendment: ({ contractorName, title, shareToken }) =>
      `${contractorName} proposed an amendment to your quote: ${title}. Review & sign: ${u}/public/amendment/${shareToken}`,

    signed_confirmation: ({ contractorName, quoteTitle, shareToken }) =>
      `Your quote for "${quoteTitle}" with ${contractorName} is signed and confirmed. View: ${u}/public/${shareToken}`,

    // ── Custom (contractor-edited message) ──
    custom: ({ body }) => (body || '').slice(0, 320),

    // ── Contractor-facing ──
    customer_approved: ({ customerName, quoteTitle, total, quoteId, country }) =>
      `🎉 ${customerName || 'Customer'} approved "${quoteTitle}"${total ? ' for ' + formatCurrency(total, country) : ''}! Book the job: ${u}/app/quotes/${quoteId}`,

    customer_question: ({ customerName, quoteTitle, question, quoteId }) =>
      `💬 ${customerName || 'Customer'} asked about "${quoteTitle}": "${(question || '').slice(0, 80)}${question?.length > 80 ? '…' : ''}" Reply: ${u}/app/quotes/${quoteId}`,

    customer_revision: ({ customerName, quoteTitle, quoteId }) =>
      `✏️ ${customerName || 'Customer'} requested changes to "${quoteTitle}". Revise: ${u}/app/quotes/${quoteId}`,

    customer_declined: ({ customerName, quoteTitle, quoteId }) =>
      `${customerName || 'Customer'} declined "${quoteTitle}". View details: ${u}/app/quotes/${quoteId}`,

    quote_viewed: ({ customerName, quoteTitle, viewCount, quoteId }) =>
      `👀 ${customerName || 'Customer'} viewed "${quoteTitle}"${viewCount > 1 ? ' (' + viewCount + '×)' : ''}. Follow up: ${u}/app/quotes/${quoteId}`,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   HANDLER
   ═══════════════════════════════════════════════════════════════════════════ */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth — require a valid Supabase session to prevent unauthenticated Twilio abuse
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Server configuration error' });
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' });

  // Fail gracefully if Twilio isn't configured
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return res.status(200).json({ ok: false, skipped: true, reason: 'Twilio not configured' });
  }

  if (blocked(res, `sms:${getClientIp(req)}`, 20, 60_000)) return;

  const body = req.body || {};
  const { action, to, data: msgData } = body;

  if (!action || !to) {
    return res.status(400).json({ error: 'Missing action or to' });
  }

  const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || 'https://punchlist.ca';
  const tmpl = templates(appUrl);
  const templateFn = tmpl[action];

  if (!templateFn) {
    return res.status(400).json({ error: `Unknown SMS action: ${action}` });
  }

  // ── Opt-in check for contractor-facing SMS ──
  // Contractor must have sms_notifications_enabled = true in their profile
  const CONTRACTOR_ACTIONS = ['customer_approved', 'customer_question', 'customer_revision', 'customer_declined', 'quote_viewed'];
  if (CONTRACTOR_ACTIONS.includes(action)) {
    const supabase = getSupabase();
    if (supabase && msgData?.contractorUserId) {
      try {
        const { data: profile } = await supabase.from('profiles')
          .select('sms_notifications_enabled')
          .eq('id', msgData.contractorUserId)
          .maybeSingle();
        if (!profile?.sms_notifications_enabled) {
          return res.status(200).json({ ok: false, skipped: true, reason: 'SMS notifications disabled' });
        }
      } catch {
        // If column doesn't exist yet, skip silently
        return res.status(200).json({ ok: false, skipped: true, reason: 'Could not check SMS preference' });
      }
    }
  }

  const message = templateFn(msgData || {});
  const result = await sendTwilioSMS(to, message);

  // Log SMS send for audit trail (fire-and-forget)
  if (result.ok) {
    const supabase = getSupabase();
    if (supabase) {
      supabase.from('sms_log').insert({
        action,
        to_phone: to.replace(/\d(?=.{4})/g, '*'), // Mask all but last 4
        message_preview: message.slice(0, 60),
        twilio_sid: result.sid || null,
        quote_id: msgData?.quoteId || null,
        user_id: msgData?.contractorUserId || null,
      }).then(() => {}).catch(() => {});
    }
  }

  return res.status(200).json(result);
}
