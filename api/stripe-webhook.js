import { createClient } from './_supabase.js';

// Defensive Supabase client factory — never created at module level
function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Shared server-side SMS send (fire-and-forget). Never throws.
async function sendSMS(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from || !to) return;
  let n = String(to).replace(/[\s\-().]/g, '');
  if (n.startsWith('1') && n.length === 11) n = '+' + n;
  else if (n.length === 10) n = '+1' + n;
  else if (!n.startsWith('+')) n = '+1' + n;
  if (!/^\+1\d{10}$/.test(n)) return;
  try {
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: n, From: from, Body: String(body).slice(0, 320) }).toString(),
    });
  } catch { /* fire-and-forget */ }
}

async function markDepositPaid(session) {
  const quoteId = session?.metadata?.quote_id;
  if (!quoteId) return;

  const supabase = getSupabase();
  if (!supabase) {
    console.error('[stripe-webhook] Cannot mark deposit paid - Supabase not configured');
    return;
  }

  const paidAt = new Date().toISOString();
  const isConnect = Boolean(session?.metadata?.contractor_id);
  const methodLabel = isConnect ? 'Punchlist Payments' : 'Stripe';
  const note = `[SYSTEM] Deposit paid via ${methodLabel} on ${paidAt}. Session ${session.id}.`;

  // Fetch status + existing deposit_session_id + notes so we can (1) gate the
  // status transition, (2) short-circuit idempotently, (3) append audit note.
  const { data: quote } = await supabase
    .from('quotes')
    .select('internal_notes,status,deposit_session_id')
    .eq('id', quoteId)
    .maybeSingle();

  if (!quote) return;

  // ── A2: Idempotency via column, not text-search on internal_notes ──
  // Stripe retries or replays will carry the same session.id. Previously this
  // check scanned internal_notes for the session id; if the contractor ever
  // cleared their notes the webhook would fire duplicate SMS / email /
  // in-app notification on the next retry. Now driven by the dedicated
  // deposit_session_id column which contractors can't overwrite.
  if (quote.deposit_session_id === session.id) return;

  // ── A1: Don't regress status on late webhooks ──
  // Only promote status → 'approved' if the quote is still in
  // approved_pending_deposit. If the quote has already advanced (scheduled,
  // completed, invoiced, paid) the deposit event is informational only;
  // update deposit_* fields but leave status alone. Also defend against the
  // unexpected case where a deposit arrives before approval (log a warning).
  const POST_APPROVAL = ['deposit_paid', 'converted_to_invoice', 'paid'];
  const updatePayload = {
    internal_notes: [String(quote.internal_notes || '').trim(), note].filter(Boolean).join('\n'),
    deposit_status: 'paid',
    deposit_paid_at: paidAt,
    deposit_session_id: session.id,
    deposit_payment_intent_id: session.payment_intent,
    stripe_connect_session_id: isConnect ? session.id : null,
  };
  if (quote.status === 'approved_pending_deposit') {
    updatePayload.status = 'deposit_paid';
  } else if (POST_APPROVAL.includes(quote.status)) {
    // Leave status alone — quote has already moved past approval.
  } else {
    // Unexpected: deposit arrived on a quote that wasn't pending deposit.
    // Don't touch status; just record the payment and log for investigation.
    console.warn('[stripe-webhook] Deposit received on quote', quoteId, 'with unexpected status:', quote.status);
  }

  await supabase.from('quotes').update(updatePayload).eq('id', quoteId);

  // Propagate deposit credit to linked invoice (if one already exists)
  try {
    const { data: linkedInvoice } = await supabase
      .from('invoices')
      .select('id, total, deposit_credited')
      .eq('quote_id', quoteId)
      .maybeSingle();
    if (linkedInvoice) {
      const depositAmt = Number(quote.deposit_amount || 0);
      const { data: payments } = await supabase.from('payments').select('amount').eq('invoice_id', linkedInvoice.id);
      const totalPaid = (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
      const remaining = Math.max(0, Number(linkedInvoice.total || 0) - depositAmt - totalPaid);
      await supabase.from('invoices').update({ deposit_credited: depositAmt, remaining_balance: remaining }).eq('id', linkedInvoice.id);
    }
  } catch {}

  // Notify contractor that deposit was received
  try {
    const { data: fullQuote } = await supabase.from('quotes')
      .select('title, total, user_id, deposit_amount, customer_id, share_token, customer:customers(name,phone)')
      .eq('id', quoteId).maybeSingle();
    if (fullQuote?.user_id) {
      const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || 'https://punchlist.ca';
      const custName = fullQuote.customer?.name || 'Customer';
      const depAmt = Number(fullQuote.deposit_amount || 0);
      const country = session?.metadata?.country || 'CA';
      const fmtDep = country === 'US'
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(depAmt)
        : new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(depAmt);

      // In-app notification
      supabase.from('notifications').insert({
        user_id: fullQuote.user_id,
        type: 'deposit_paid',
        title: 'Deposit received',
        body: `${custName} paid ${fmtDep} deposit on "${(fullQuote.title || 'quote').slice(0, 40)}"`,
        link: `/app/quotes/${quoteId}`,
        read: false,
      }).then(() => {}).catch(() => {});

      // SMS to contractor (if they have SMS enabled)
      if (process.env.TWILIO_ACCOUNT_SID) {
        const { data: profile } = await supabase.from('profiles')
          .select('phone, sms_notifications_enabled')
          .eq('id', fullQuote.user_id).maybeSingle();
        if (profile?.sms_notifications_enabled && profile?.phone) {
          const sid = process.env.TWILIO_ACCOUNT_SID;
          const token = process.env.TWILIO_AUTH_TOKEN;
          const from = process.env.TWILIO_PHONE_NUMBER;
          if (sid && token && from) {
            let normalized = profile.phone.replace(/[\s\-().]/g, '');
            if (normalized.startsWith('1') && normalized.length === 11) normalized = '+' + normalized;
            else if (normalized.length === 10) normalized = '+1' + normalized;
            else if (!normalized.startsWith('+')) normalized = '+1' + normalized;
            if (/^\+1\d{10}$/.test(normalized)) {
              fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
                method: 'POST',
                headers: {
                  Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  To: normalized, From: from,
                  Body: `💰 ${custName} paid the ${fmtDep} deposit on "${(fullQuote.title || 'your quote').slice(0, 40)}". Book the job: ${appUrl}/app/quotes/${quoteId}`,
                }).toString(),
              }).catch(() => {});
            }
          }
        }
      }

      // Receipt to the CUSTOMER who just paid — previously they got
      // nothing on a deposit (invoice payments send a receipt; deposits
      // didn't). A confirmation text closes that trust gap.
      const contractorLabel = session?.metadata?.contractor_name
        || (await supabase.from('profiles').select('company_name,full_name').eq('id', fullQuote.user_id).maybeSingle()).data?.company_name
        || 'your contractor';
      if (fullQuote.customer?.phone) {
        await sendSMS(
          fullQuote.customer.phone,
          `Payment received — thanks ${custName.split(' ')[0]}! ${contractorLabel} confirmed your ${fmtDep} deposit. They'll be in touch to schedule. View: ${appUrl}/public/${fullQuote.share_token || ''}`
        );
      }
    }
  } catch {}
}

// Phase 5B: Mark invoice as paid via Stripe
async function markInvoicePaidViaStripe(session) {
  const invoiceId = session?.metadata?.invoice_id;
  if (!invoiceId) return;

  const supabase = getSupabase();
  if (!supabase) {
    console.error('[stripe-webhook] Cannot mark invoice paid - Supabase not configured');
    return;
  }

  const paidAt = new Date().toISOString();
  const isConnect = Boolean(session?.metadata?.contractor_id);
  const methodLabel = isConnect ? 'Punchlist Payments' : 'Stripe';

  // Get invoice to check idempotency
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id,status,total,quote_id,customer_id,user_id,invoice_number,title,payment_method,country,stripe_session_id,share_token')
    .eq('id', invoiceId)
    .maybeSingle();

  if (!invoice) return;
  // ── A2 audit: Idempotency via session_id column only ──
  // Previously this gate required BOTH status=='paid' AND session match.
  // That meant a webhook retry against a still-partial invoice would insert
  // a duplicate row into `payments`. Now we short-circuit the moment we see
  // the same session id, regardless of current status.
  if (invoice.stripe_session_id === session.id) return;

  const amountPaid = (session.amount_total || 0) / 100;

  // ── Payment insert dedup ──
  // Stripe retries webhooks. Two concurrent retries previously raced on
  // `select … ilike notes` and both passed the gate, producing duplicate
  // payments rows. With migration_audit_pass.sql in place there's a
  // unique index on payments.stripe_session_id, so we can use upsert and
  // let the database arbitrate.
  const { error: payErr } = await supabase
    .from('payments')
    .upsert({
      invoice_id: invoiceId,
      user_id: invoice.user_id,
      amount: amountPaid,
      method: methodLabel,
      notes: `${methodLabel} session ${session.id}`,
      paid_at: paidAt,
      stripe_session_id: session.id,
    }, { onConflict: 'stripe_session_id', ignoreDuplicates: true });
  if (payErr) {
    // Treat the upsert as successful (and idempotent) when the failure
    // looks like the unique-constraint catching a true duplicate. Any
    // other error means the schema cache / column is genuinely missing —
    // fall back to the old fuzzy match BUT also stamp stripe_session_id
    // on the insert so a concurrent fallback can still be arbitrated by
    // the unique index.
    const isDup = payErr.code === '23505' || /duplicate key/i.test(payErr.message || '');
    if (!isDup) {
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('invoice_id', invoiceId)
        .ilike('notes', `%${session.id}%`)
        .maybeSingle();
      if (!existingPayment) {
        await supabase.from('payments').insert({
          invoice_id: invoiceId,
          user_id: invoice.user_id,
          amount: amountPaid,
          method: methodLabel,
          notes: `${methodLabel} session ${session.id}`,
          paid_at: paidAt,
          stripe_session_id: session.id,
        });
      }
    }
  }

  // Recalculate total payments
  const { data: payments } = await supabase.from('payments').select('amount').eq('invoice_id', invoiceId);
  const totalPaid = (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  const invoiceTotal = Number(invoice.total || 0);

  // Also account for deposit credit from linked quote
  let depositCredited = 0;
  if (invoice.quote_id) {
    const { data: q } = await supabase.from('quotes').select('deposit_amount, deposit_status').eq('id', invoice.quote_id).maybeSingle();
    if (q?.deposit_status === 'paid') depositCredited = Number(q.deposit_amount || 0);
  }

  const remainingBalance = Math.max(0, invoiceTotal - depositCredited - totalPaid);
  const newStatus = remainingBalance <= 0 ? 'paid' : 'partial';
  const updates = {
    status: newStatus,
    remaining_balance: remainingBalance,
    stripe_session_id: session.id,
    stripe_payment_intent_id: session.payment_intent || null,
    stripe_connect_session_id: isConnect ? session.id : null,
  };
  if (newStatus === 'paid') {
    updates.paid_at = paidAt;
    updates.payment_method = methodLabel;
  }

  await supabase.from('invoices').update(updates).eq('id', invoiceId);

  // If fully paid, mark quote as paid too
  if (newStatus === 'paid' && invoice.quote_id) {
    await supabase.from('quotes').update({ status: 'paid' }).eq('id', invoice.quote_id);
  }

  // 5D: Send payment receipt email
  if (invoice.customer_id && invoice.user_id) {
    try {
      const { data: customer } = await supabase.from('customers').select('name,email,phone').eq('id', invoice.customer_id).maybeSingle();
      const { data: profile } = await supabase.from('profiles').select('full_name,company_name,phone,email,country').eq('id', invoice.user_id).maybeSingle();
      // review_link is a newer column — fetch it in isolation so a not-yet-applied
      // migration can never break the receipt send.
      let reviewLink = null;
      try {
        const { data: rl } = await supabase.from('profiles').select('review_link').eq('id', invoice.user_id).maybeSingle();
        reviewLink = (rl?.review_link || '').trim() || null;
      } catch { /* column absent — skip review CTA */ }
      if (customer?.email && process.env.RESEND_API_KEY) {
        const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || 'https://punchlist.ca';
        const country = profile?.country || invoice.country || 'CA';
        const fmt = (n) => {
          const num = Number(n || 0);
          if (country === 'US') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
          return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(num);
        };
        const contractorName = profile?.company_name || profile?.full_name || 'Your contractor';
        // Partial vs full shapes the whole receipt: subject, headline, and
        // whether we show a remaining balance or ask for a review.
        const isFullyPaid = newStatus === 'paid';
        const subject = isFullyPaid
          ? `Payment received — ${invoice.invoice_number || 'Invoice'}`
          : `Partial payment received — ${fmt(remainingBalance)} still due`;
        const headline = isFullyPaid ? 'Thank you for your payment!' : 'Thanks — partial payment received';
        const safeReview = reviewLink && /^https?:\/\//i.test(reviewLink) ? reviewLink : null;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'notifications@punchlist.ca',
            to: [customer.email],
            subject,
            html: `
              <div style="font-family:Inter,-apple-system,Arial,sans-serif;max-width:540px;margin:0 auto;padding:32px 24px;color:#14161a">
                <p style="color:#22C55E;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:11px;margin:0 0 8px">Payment Receipt</p>
                <h1 style="font-size:22px;margin:0 0 12px;letter-spacing:-.03em">${headline}</h1>
                <p style="color:#667085;margin-bottom:24px;line-height:1.6">
                  <strong style="color:#14161a">${contractorName}</strong> has received ${isFullyPaid ? 'your payment' : 'a payment'} for <strong>${invoice.title || invoice.invoice_number || 'services rendered'}</strong>.
                </p>
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:24px">
                  <div style="display:grid;gap:12px">
                    <div><div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Amount paid</div><div style="font-size:22px;font-weight:800;color:#14161a">${fmt(amountPaid)}</div></div>
                    <div><div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Payment method</div><div style="font-size:14px;font-weight:600">${methodLabel}</div></div>
                    <div><div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Date</div><div style="font-size:14px;font-weight:600">${new Date(paidAt).toLocaleDateString(country === 'US' ? 'en-US' : 'en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}</div></div>
                    <div><div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Invoice</div><div style="font-size:14px;font-weight:600">${invoice.invoice_number || ''}</div></div>
                    ${!isFullyPaid ? `<div style="border-top:1px solid #bbf7d0;padding-top:12px"><div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Remaining balance</div><div style="font-size:18px;font-weight:800;color:#b45309">${fmt(remainingBalance)} still due</div></div>` : ''}
                  </div>
                </div>
                ${invoice.share_token ? `
                <a href="${appUrl}/i/${invoice.share_token}" style="display:block;text-align:center;background:#14161a;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 20px;border-radius:10px;margin:0 0 24px">${isFullyPaid ? 'View invoice &amp; receipt' : `View invoice &amp; pay remaining ${fmt(remainingBalance)}`}</a>
                <p style="color:#aaa;font-size:11px;text-align:center;margin:-16px 0 24px">Bookmark this link to check your invoice or balance anytime.</p>
                ` : ''}
                ${isFullyPaid && safeReview ? `
                <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:18px 20px;margin:0 0 24px;text-align:center">
                  <div style="font-size:20px;letter-spacing:2px;margin-bottom:6px">★★★★★</div>
                  <div style="font-size:15px;font-weight:700;margin-bottom:4px">How did ${contractorName} do?</div>
                  <p style="color:#92740a;font-size:13px;line-height:1.5;margin:0 0 14px">A quick review means the world to a local business — it takes 30 seconds.</p>
                  <a href="${safeReview}" style="display:inline-block;background:#f59e0b;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 22px;border-radius:9px">Leave a review</a>
                </div>
                ` : ''}
                <hr style="border:none;border-top:1px solid #e8e6e1;margin:0 0 20px"/>
                <div style="font-size:13px;color:#667085">
                  <strong style="color:#14161a">${contractorName}</strong><br/>
                  ${profile?.phone ? `${profile.phone}<br/>` : ''}
                  ${profile?.email ? `${profile.email}<br/>` : ''}
                </div>
                <p style="color:#aaa;font-size:11px;margin:20px 0 0">Powered by Punchlist · Keep this email as your receipt.</p>
              </div>
            `,
          }),
        });
      }
    } catch (emailErr) {
      console.error('[stripe-webhook] receipt email error:', emailErr?.message);
    }

    // SMS — payment receipt to customer
    try {
      const { data: custForSms } = !invoice.customer_id ? { data: null } :
        await supabase.from('customers').select('phone').eq('id', invoice.customer_id).maybeSingle();
      if (custForSms?.phone && process.env.TWILIO_ACCOUNT_SID) {
        const { data: profForSms } = await supabase.from('profiles').select('company_name,full_name,country').eq('id', invoice.user_id).maybeSingle();
        const cName = profForSms?.company_name || profForSms?.full_name || 'Your contractor';
        const cCountry = profForSms?.country || invoice.country || 'CA';
        const fmtSms = (n) => cCountry === 'US'
          ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
          : new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);
        const fmtAmt = fmtSms(amountPaid);
        const smsBody = newStatus === 'paid'
          ? `Payment received! ${cName} confirmed your payment of ${fmtAmt}. Thank you.`
          : `Partial payment of ${fmtAmt} received by ${cName}. ${fmtSms(remainingBalance)} still due. Thank you.`;
        // Use the same Twilio helper as public-quote-action.js
        const sid = process.env.TWILIO_ACCOUNT_SID;
        const token = process.env.TWILIO_AUTH_TOKEN;
        const from = process.env.TWILIO_PHONE_NUMBER;
        if (sid && token && from) {
          let normalized = custForSms.phone.replace(/[\s\-().]/g, '');
          if (normalized.startsWith('1') && normalized.length === 11) normalized = '+' + normalized;
          else if (normalized.length === 10) normalized = '+1' + normalized;
          else if (!normalized.startsWith('+')) normalized = '+1' + normalized;
          if (/^\+1\d{10}$/.test(normalized)) {
            fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
              method: 'POST',
              headers: {
                Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                To: normalized, From: from,
                Body: smsBody,
              }).toString(),
            }).catch(() => {});
          }
        }
      }
    } catch {}
  }

  // Notify the contractor they got paid — in-app + SMS (was in-app only,
  // so a contractor with the app closed had no idea an invoice was paid).
  try {
    const ctryC = invoice.country || 'CA';
    const fmtC = (n) => ctryC === 'US'
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
      : new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);
    const amtC = fmtC(amountPaid);
    await supabase.from('notifications').insert({
      user_id: invoice.user_id,
      type: 'payment_received',
      title: 'Payment received',
      body: `${invoice.invoice_number || 'Invoice'} — ${methodLabel} payment of ${amtC} received`,
      link: `/app/invoices/${invoiceId}`,
      read: false,
    });

    const { data: payeeProfile } = await supabase.from('profiles')
      .select('phone, sms_notifications_enabled').eq('id', invoice.user_id).maybeSingle();
    if (payeeProfile?.sms_notifications_enabled && payeeProfile?.phone) {
      const appUrlC = process.env.APP_URL || process.env.VITE_APP_URL || 'https://punchlist.ca';
      const label = newStatus === 'paid'
        ? `💰 You got paid! ${amtC} received on ${invoice.invoice_number || 'your invoice'}.`
        : `💰 Partial payment: ${amtC} received on ${invoice.invoice_number || 'your invoice'} (${fmtC(remainingBalance)} still due).`;
      await sendSMS(payeeProfile.phone, `${label} ${appUrlC}/app/invoices/${invoiceId}`);
    }
  } catch {}
}

// ── Connect: Update onboarding status when account becomes active ──
async function handleAccountUpdated(account) {
  if (!account?.id) return;

  const supabase = getSupabase();
  if (!supabase) return;

  const onboarded = Boolean(account.charges_enabled && account.payouts_enabled);

  // Update the profile that has this connect account
  await supabase.from('profiles').update({
    stripe_connect_onboarded: onboarded,
  }).eq('stripe_connect_account_id', account.id);
}

// ── Subscription lifecycle ──
async function activateSubscription(session) {
  const supabase = getSupabase();
  if (!supabase) return;

  const customerId = session.customer;
  const subscriptionId = session.subscription;
  const email = session.customer_details?.email || session.customer_email;
  if (!email) {
    console.error('[stripe-webhook] No email in subscription checkout session');
    return;
  }

  // Determine plan from the price — check interval
  let plan = 'pro';
  try {
    const stripeModule = await import('stripe');
    const stripe = new stripeModule.default(process.env.STRIPE_SECRET_KEY);
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const interval = sub?.items?.data?.[0]?.price?.recurring?.interval;
    plan = interval === 'year' ? 'pro_annual' : 'pro_monthly';
  } catch { /* fallback to 'pro' */ }

  // ── Idempotency: skip if this subscription is already recorded ──
  // Check by subscription_id first (handles Stripe retries / replays).
  const { data: existingBySub } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  if (existingBySub) {
    // Customer already linked — just ensure plan is up-to-date
    await supabase.from('profiles').update({ subscription_plan: plan }).eq('id', existingBySub.id);
    return;
  }

  // ── Find user: prefer client_reference_id (set at checkout), fall back to email scan ──
  let matchedUserId = session.client_reference_id || null;

  if (matchedUserId) {
    // Verify the user actually exists in profiles
    const { data: profileCheck } = await supabase.from('profiles').select('id').eq('id', matchedUserId).maybeSingle();
    if (!profileCheck) matchedUserId = null; // invalid ref, fall back to email
  }

  if (!matchedUserId) {
    // Fall back to email scan with bounded page size
    const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const matchedUser = users?.users?.find(u => u.email === email);
    if (!matchedUser) {
      console.error('[stripe-webhook] No user found for email:', email);
      return;
    }
    matchedUserId = matchedUser.id;
  }

  await supabase.from('profiles').upsert({
    id: matchedUserId,
    subscription_plan: plan,
    stripe_customer_id: customerId,
  }, { onConflict: 'id' });
}

async function deactivateSubscription(subscription) {
  const supabase = getSupabase();
  if (!supabase) return;

  const customerId = subscription.customer;
  // Find profile by stripe_customer_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  if (!profile) return;

  await supabase.from('profiles').update({
    subscription_plan: 'free',
  }).eq('id', profile.id);
}

async function updateSubscriptionPlan(subscription) {
  const supabase = getSupabase();
  if (!supabase) return;

  const customerId = subscription.customer;
  const interval = subscription?.items?.data?.[0]?.price?.recurring?.interval;
  const plan = interval === 'year' ? 'pro_annual' : 'pro_monthly';

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  if (!profile) return;

  await supabase.from('profiles').update({
    subscription_plan: plan,
  }).eq('id', profile.id);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const signature = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  // If webhook secret not configured, acknowledge but don't process (prevents crashes in dev)
  if (!process.env.STRIPE_SECRET_KEY || !secret) {
    return res.status(200).json({ received: true, note: 'Webhook secret not configured.' });
  }

  // Read raw body for signature verification
  let payload;
  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    payload = Buffer.concat(chunks);
  } catch (err) {
    return res.status(400).json({ error: 'Could not read request body' });
  }

  // Verify Stripe signature
  let event;
  try {
    const stripeModule = await import('stripe');
    const stripe = new stripeModule.default(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    console.error('Stripe signature verification failed:', err?.message);
    return res.status(400).json({ error: `Webhook signature failed: ${err.message}` });
  }

  // Handle event
  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.payment_status === 'paid') {
        if (session?.metadata?.payment_type === 'quote_deposit') {
          await markDepositPaid(session);
        } else if (session?.metadata?.payment_type === 'invoice_payment') {
          await markInvoicePaidViaStripe(session);
        }
      }
      // Subscription checkout — update profile with plan info
      if (session.mode === 'subscription' && session.customer && session.subscription) {
        await activateSubscription(session);
      }
    }

    // ── Connect: Handle account onboarding completion ──
    if (event.type === 'account.updated') {
      await handleAccountUpdated(event.data.object);
    }

    // Handle subscription cancellation / expiry
    if (event.type === 'customer.subscription.deleted') {
      await deactivateSubscription(event.data.object);
    }
    // Handle subscription update (plan change)
    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object;
      if (sub.status === 'active') {
        await updateSubscriptionPlan(sub);
      } else if (sub.cancel_at_period_end) {
        // Will cancel at end of period — don't deactivate yet
      }
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Stripe webhook processing error:', err?.message);
    // Return 500 so Stripe retries — the event was valid but processing failed
    return res.status(500).json({ error: 'Processing failed, will retry' });
  }
}
