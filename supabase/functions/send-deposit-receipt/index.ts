// ═══════════════════════════════════════════════════════════════════════════
// Punchlist v100 M5 §5.6 — Deposit Receipt Edge Function
// supabase/functions/send-deposit-receipt/index.ts
//
// Triggered by a Supabase Database Webhook on:
//   Table: public.quotes
//   Event: UPDATE
//   Filter: deposit_status = 'paid'
//
// To register the DB webhook in the Supabase dashboard:
//   1. Go to Database → Webhooks → Create a new hook
//   2. Name: send-deposit-receipt
//   3. Table: public.quotes, Event: UPDATE
//   4. Filter: new.deposit_status = 'paid' AND old.deposit_status != 'paid'
//   5. Webhook URL: <your-project>.supabase.co/functions/v1/send-deposit-receipt
//   6. HTTP method: POST
//   7. Add secret header: Authorization: Bearer <SUPABASE_ANON_KEY>
//
// This is the §5.6 "zero Stripe webhook edit" path. The stripe-webhook.js
// handler fires markDepositPaid() which writes deposit_status='paid' to quotes.
// That column write triggers this DB webhook automatically — same effect as
// adding code to the Stripe handler, no changes to the Stripe handler required.
//
// Idempotency: checks deposit_receipt_sent_at before sending. If already set,
// returns 200 with { skipped: true }.
//
// Template: uses deposit_received_sms from user's message_templates,
// falling back to the system default.
//
// Framing: sent FROM the contractor's business name per §9.5 decision.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SYSTEM_DEFAULT_DEPOSIT_SMS =
  "Thanks {firstName} — your {depositAmount} deposit came through. {nextStep} I'll take it from here.";

const TOKEN_RE = /\{(\w+)\}/g;
function renderTemplate(body: string, tokens: Record<string, string>): string {
  return body.replace(TOKEN_RE, (_, name) => tokens[name] ?? '');
}

function normalizePhone(raw: string): string {
  let n = raw.replace(/[\s\-().]/g, '');
  if (n.startsWith('1') && n.length === 11) n = '+' + n;
  else if (n.length === 10) n = '+1' + n;
  else if (!n.startsWith('+')) n = '+1' + n;
  return n;
}

function fmt(n: number, country = 'CA'): string {
  return new Intl.NumberFormat(country === 'US' ? 'en-US' : 'en-CA', {
    style: 'currency', currency: country === 'US' ? 'USD' : 'CAD', maximumFractionDigits: 0,
  }).format(n);
}

async function sendTwilio(to: string, body: string): Promise<{ ok: boolean; reason?: string }> {
  const sid   = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from  = Deno.env.get('TWILIO_PHONE_NUMBER');
  if (!sid || !token || !from) return { ok: false, reason: 'not_configured' };

  const normalized = normalizePhone(to);
  if (!/^\+1\d{10}$/.test(normalized)) return { ok: false, reason: 'invalid_phone' };

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`${sid}:${token}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: normalized, From: from, Body: body.slice(0, 320) }).toString(),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('[send-deposit-receipt] Twilio error:', res.status, (err as any)?.message);
    return { ok: false, reason: 'twilio_error' };
  }
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  // The DB webhook POSTs a JSON body with { type, table, schema, record, old_record }
  const payload = await req.json().catch(() => null);
  if (!payload) {
    return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
  }

  const quote = payload.record; // the NEW row after UPDATE
  if (!quote?.id) {
    return new Response(JSON.stringify({ error: 'No quote record in payload' }), { status: 400 });
  }

  // Guard: only fire when deposit_status just became 'paid'
  if (quote.deposit_status !== 'paid') {
    return new Response(JSON.stringify({ skipped: true, reason: 'not_paid' }), { status: 200 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, serviceKey);

  // Idempotency: abort if receipt was already sent
  const { data: current } = await supabase
    .from('quotes')
    .select('deposit_receipt_sent_at')
    .eq('id', quote.id)
    .maybeSingle();

  if (current?.deposit_receipt_sent_at) {
    return new Response(JSON.stringify({ skipped: true, reason: 'already_sent' }), { status: 200 });
  }

  // Load full quote + customer + profile
  const { data: fullQuote } = await supabase
    .from('quotes')
    .select('id, title, total, deposit_amount, user_id, customer_id, country, share_token')
    .eq('id', quote.id)
    .maybeSingle();

  if (!fullQuote) {
    return new Response(JSON.stringify({ error: 'Quote not found' }), { status: 404 });
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('name, phone')
    .eq('id', fullQuote.customer_id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_name, full_name')
    .eq('id', fullQuote.user_id)
    .maybeSingle();

  const customerPhone = customer?.phone;
  if (!customerPhone) {
    console.warn('[send-deposit-receipt] No customer phone for quote', quote.id);
    return new Response(JSON.stringify({ skipped: true, reason: 'no_phone' }), { status: 200 });
  }

  // Load contractor's custom template (falls back to system default)
  const { data: tmpl } = await supabase
    .from('message_templates')
    .select('body')
    .eq('user_id', fullQuote.user_id)
    .eq('template_key', 'deposit_received_sms')
    .eq('locale', 'en')
    .maybeSingle();

  const templateBody = tmpl?.body || SYSTEM_DEFAULT_DEPOSIT_SMS;

  // Resolve {nextStep}: check for a scheduled booking
  const { data: bookings } = await supabase
    .from('bookings')
    .select('scheduled_for')
    .eq('quote_id', quote.id)
    .order('scheduled_for', { ascending: true })
    .limit(1);

  const scheduledDate = bookings?.[0]?.scheduled_for;
  let nextStep = "I'll be in touch this week about scheduling.";
  if (scheduledDate) {
    const d = new Date(scheduledDate);
    const opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' };
    nextStep = `See you ${d.toLocaleDateString('en-CA', opts)}.`;
  }

  const country    = fullQuote.country || 'CA';
  const firstName  = (customer?.name || '').split(' ')[0] || '';
  const senderName = profile?.company_name || profile?.full_name || 'Your contractor';
  const depositAmt = fmt(Number(fullQuote.deposit_amount || 0), country);

  const messageBody = renderTemplate(templateBody, {
    firstName,
    senderName,
    depositAmount: depositAmt,
    nextStep,
    quoteTitle: fullQuote.title || 'your project',
    total: fmt(Number(fullQuote.total || 0), country),
  });

  // Send SMS to CUSTOMER (not contractor — this is the branded receipt)
  const sendResult = await sendTwilio(customerPhone, messageBody);

  if (sendResult.ok) {
    // Mark as sent for idempotency
    await supabase.rpc('rpc_mark_deposit_receipt_sent', { p_quote_id: quote.id });
    console.log('[send-deposit-receipt] Receipt sent for quote', quote.id, 'to', customerPhone);
  } else {
    console.error('[send-deposit-receipt] Send failed:', sendResult.reason, 'quote:', quote.id);
    // Don't mark as sent — allows retry on next webhook delivery
    return new Response(
      JSON.stringify({ ok: false, reason: sendResult.reason }),
      { status: 502 }
    );
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
