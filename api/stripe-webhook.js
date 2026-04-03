import { createClient } from '@supabase/supabase-js';

// Defensive Supabase client factory — never created at module level
function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
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
  const note = `[SYSTEM] Deposit paid via Stripe on ${paidAt}. Session ${session.id}.`;

  // Get current internal_notes so we can append without overwriting
  const { data: quote } = await supabase
    .from('quotes')
    .select('internal_notes')
    .eq('id', quoteId)
    .maybeSingle();

  const current = String(quote?.internal_notes || '');

  // Idempotency: don't double-process the same session
  if (current.includes(session.id)) return;

  const nextNotes = [current.trim(), note].filter(Boolean).join('\n');

  await supabase.from('quotes').update({
    internal_notes: nextNotes,
    deposit_status: 'paid',
    deposit_paid_at: paidAt,
    deposit_session_id: session.id,
    deposit_payment_intent_id: session.payment_intent,
    status: 'approved',
  }).eq('id', quoteId);
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

  // Get invoice to check idempotency
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id,status,total,quote_id,customer_id,user_id,invoice_number,title,payment_method,country,stripe_session_id')
    .eq('id', invoiceId)
    .maybeSingle();

  if (!invoice) return;
  // Idempotency: don't double-process
  if (invoice.status === 'paid' && invoice.stripe_session_id === session.id) return;

  const amountPaid = (session.amount_total || 0) / 100;

  // Record payment in payments table
  await supabase.from('payments').insert({
    invoice_id: invoiceId,
    user_id: invoice.user_id,
    amount: amountPaid,
    method: 'Stripe',
    notes: `Stripe session ${session.id}`,
    paid_at: paidAt,
  });

  // Recalculate total payments
  const { data: payments } = await supabase.from('payments').select('amount').eq('invoice_id', invoiceId);
  const totalPaid = (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  const invoiceTotal = Number(invoice.total || 0);

  const newStatus = totalPaid >= invoiceTotal ? 'paid' : 'partial';
  const updates = {
    status: newStatus,
    stripe_session_id: session.id,
    stripe_payment_intent_id: session.payment_intent || null,
  };
  if (newStatus === 'paid') {
    updates.paid_at = paidAt;
    updates.payment_method = 'Stripe';
  }

  await supabase.from('invoices').update(updates).eq('id', invoiceId);

  // If fully paid, mark quote as paid too
  if (newStatus === 'paid' && invoice.quote_id) {
    await supabase.from('quotes').update({ status: 'paid' }).eq('id', invoice.quote_id);
  }

  // 5D: Send payment receipt email
  if (invoice.customer_id && invoice.user_id) {
    try {
      const { data: customer } = await supabase.from('customers').select('name,email').eq('id', invoice.customer_id).maybeSingle();
      const { data: profile } = await supabase.from('profiles').select('full_name,company_name,phone,email,country').eq('id', invoice.user_id).maybeSingle();
      if (customer?.email && process.env.RESEND_API_KEY) {
        const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || 'https://punchlist.ca';
        const country = profile?.country || invoice.country || 'CA';
        const fmt = (n) => {
          const num = Number(n || 0);
          if (country === 'US') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
          return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(num);
        };
        const contractorName = profile?.company_name || profile?.full_name || 'Your contractor';

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'notifications@punchlist.ca',
            to: [customer.email],
            subject: `Payment received — ${invoice.invoice_number || 'Invoice'}`,
            html: `
              <div style="font-family:Inter,-apple-system,Arial,sans-serif;max-width:540px;margin:0 auto;padding:32px 24px;color:#14161a">
                <p style="color:#22C55E;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:11px;margin:0 0 8px">Payment Receipt</p>
                <h1 style="font-size:22px;margin:0 0 12px;letter-spacing:-.03em">Thank you for your payment!</h1>
                <p style="color:#667085;margin-bottom:24px;line-height:1.6">
                  <strong style="color:#14161a">${contractorName}</strong> has received your payment for <strong>${invoice.title || invoice.invoice_number || 'services rendered'}</strong>.
                </p>
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:24px">
                  <div style="display:grid;gap:12px">
                    <div><div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Amount paid</div><div style="font-size:22px;font-weight:800;color:#14161a">${fmt(amountPaid)}</div></div>
                    <div><div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Payment method</div><div style="font-size:14px;font-weight:600">Stripe</div></div>
                    <div><div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Date</div><div style="font-size:14px;font-weight:600">${new Date(paidAt).toLocaleDateString(country === 'US' ? 'en-US' : 'en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}</div></div>
                    <div><div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Invoice</div><div style="font-size:14px;font-weight:600">${invoice.invoice_number || ''}</div></div>
                  </div>
                </div>
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
  }

  // Create in-app notification for contractor
  try {
    await supabase.from('notifications').insert({
      user_id: invoice.user_id,
      type: 'payment_received',
      title: 'Payment received',
      body: `${invoice.invoice_number || 'Invoice'} — Stripe payment of $${amountPaid.toFixed(0)} received`,
      link: `/app/invoices/${invoiceId}`,
      read: false,
    });
  } catch {}
}

// ── Subscription lifecycle ──
async function activateSubscription(session) {
  const supabase = getSupabase();
  if (!supabase) return;

  const customerId = session.customer;
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
    const sub = await stripe.subscriptions.retrieve(session.subscription);
    const interval = sub?.items?.data?.[0]?.price?.recurring?.interval;
    plan = interval === 'year' ? 'pro_annual' : 'pro_monthly';
  } catch { /* fallback to 'pro' */ }

  // Find profile by email (auth.users email matches)
  const { data: users } = await supabase.auth.admin.listUsers();
  const matchedUser = users?.users?.find(u => u.email === email);
  if (!matchedUser) {
    console.error('[stripe-webhook] No user found for email:', email);
    return;
  }

  await supabase.from('profiles').upsert({
    id: matchedUser.id,
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
