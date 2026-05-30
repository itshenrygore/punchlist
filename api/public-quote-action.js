import { createClient } from './_supabase.js';
import { blocked, getClientIp } from './_rate-limit.js';
import { h, safeHeader, safeSmsSegment } from './_escape.js';

// Trust only Vercel's verified edge header. `X-Forwarded-For` is set by
// any HTTP client, so a signer could spoof the IP recorded in their
// signature audit trail. Vercel writes the verified client IP into
// `x-vercel-forwarded-for` after stripping client-supplied entries.
function clientIp(req) {
  const v = req.headers?.['x-vercel-forwarded-for'];
  if (v) return String(v).split(',')[0].trim();
  // Fallback for non-Vercel deployments — still better than nothing.
  const xff = req.headers?.['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers?.['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing database configuration');
  return createClient(url, key);
}

// ── A3: Statuses a customer-facing action can legally transition FROM ──
// Used as an atomic `.in('status', ...)` predicate on the UPDATE so two
// concurrent requests (e.g. a double-tap on Approve) cannot both succeed.
// The CLOSED_STATUSES guard earlier in the handler already rejects terminal
// states with a 400; this list is the race-condition backstop for the
// window between fetch and update. Statuses past approval
// (approved, approved_pending_deposit) are excluded so a late duplicate
// can't overwrite signature data or re-fire notifications.
const ACTIONABLE_STATUSES = ['draft', 'sent', 'viewed', 'revision_requested'];

// ── Server-side SMS helper (fire-and-forget, uses Twilio REST directly) ──
async function sendSMS(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from || !to) return;

  let normalized = to.replace(/[\s\-().]/g, '');
  if (normalized.startsWith('1') && normalized.length === 11) normalized = '+' + normalized;
  else if (normalized.length === 10) normalized = '+1' + normalized;
  else if (!normalized.startsWith('+')) normalized = '+1' + normalized;
  if (!/^\+1\d{10}$/.test(normalized)) return;

  try {
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: normalized, From: from, Body: body.slice(0, 320) }).toString(),
    });
  } catch (err) {
    console.warn('[sms] Failed:', err?.message);
  }
}

// Check if contractor has SMS notifications enabled
async function contractorSmsEnabled(supabase, userId) {
  if (!userId) return false;
  try {
    const { data } = await supabase.from('profiles').select('sms_notifications_enabled,phone').eq('id', userId).maybeSingle();
    return data?.sms_notifications_enabled && data?.phone ? data.phone : false;
  } catch { return false; }
}

function fmtCurrency(n, country = 'CA') {
  const num = Number(n || 0);
  if (country === 'US') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(num);
}

async function sendSignedConfirmationToCustomer({ customerEmail, customerName, contractorName, contractorPhone, contractorEmail: cEmail, quoteTitle, quoteTotal, shareToken, signedAt, country, appUrl }) {
  if (!process.env.RESEND_API_KEY || !customerEmail) return;

  const fmt = (n) => {
    const num = Number(n || 0);
    if (country === 'US') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(num);
  };

  const quoteUrl = `${appUrl}/public/${shareToken}`;
  const signedDate = signedAt ? new Date(signedAt).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' }) : new Date().toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${(contractorName || 'Confirmation').replace(/[<>\r\n"]/g, '').slice(0, 60)} via Punchlist <${(process.env.EMAIL_FROM || 'notifications@punchlist.ca').replace(/^.*<|>$/g, '')}>`,
      reply_to: cEmail || undefined,
      to: [customerEmail],
      subject: safeHeader(`Your signed quote — ${quoteTitle}`),
      html: `
        <div style="font-family:Inter,-apple-system,Arial,sans-serif;max-width:540px;margin:0 auto;padding:32px 24px;color:#14161a">
          <p style="color:#f97316;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:11px;margin:0 0 8px">Quote Confirmation</p>
          <h1 style="font-size:22px;margin:0 0 12px;letter-spacing:-.03em">Your quote is signed ✓</h1>
          <p style="color:#667085;margin-bottom:24px;line-height:1.6">
            Thanks for signing your quote with <strong style="color:#14161a">${h(contractorName) || 'your contractor'}</strong>.
            Your approval has been recorded and they'll be in touch to confirm scheduling.
          </p>
          <div style="background:#f8f7f4;border-radius:12px;padding:20px;margin-bottom:24px">
            <div style="font-size:13px;color:#667085;margin-bottom:4px">Project</div>
            <div style="font-size:17px;font-weight:700;margin-bottom:12px">${h(quoteTitle)}</div>
            <div style="display:flex;justify-content:space-between;border-top:1px solid #e8e6e1;padding-top:12px">
              <span style="font-size:13px;color:#667085">Total approved</span>
              <strong style="font-size:17px">${fmt(quoteTotal)}</strong>
            </div>
            <div style="font-size:12px;color:#aaa;margin-top:6px">Signed ${h(signedDate)}</div>
          </div>
          <a href="${h(quoteUrl)}" style="display:inline-block;background:#f97316;color:white;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:700;margin-bottom:24px">View signed quote →</a>
          <hr style="border:none;border-top:1px solid #e8e6e1;margin:0 0 20px">
          <div style="font-size:13px;color:#667085">
            <strong style="color:#14161a">${h(contractorName) || 'Your contractor'}</strong><br/>
            ${contractorPhone ? `${h(contractorPhone)}<br/>` : ''}
            ${cEmail ? `${h(cEmail)}<br/>` : ''}
          </div>
          <p style="color:#aaa;font-size:11px;margin:20px 0 0">Powered by Punchlist · Keep this email for your records.</p>
        </div>
      `,
    }),
  }).catch((error) => { console.error('[email-fail] sendSignedConfirmationToCustomer', error.message); });
}

async function notifyContractor({ contractorEmail, contractorName, contractorPhone, customerName, quoteTitle, action, feedback, appUrl, quoteId }) {
  if (!process.env.RESEND_API_KEY || !contractorEmail) return;

  const shortTitle = (quoteTitle || 'your quote').slice(0, 40);
  // Customer-controlled strings (customerName, feedback, quoteTitle) get
  // HTML-escaped before they enter the body, and stripped of CR/LF before
  // they enter the Subject header.
  const safeCustomer = h(customerName || 'Your customer');
  const safeFeedback = h(feedback || '');
  const actionMap = {
    approved: { subject: safeHeader(`✅ ${customerName || 'Customer'} approved: ${shortTitle}`), headline: `${safeCustomer} approved the quote`, body: 'The quote has been approved. Book the job while it\'s fresh.', cta: 'Book the job', ctaColor: '#15803d', urgent: true },
    revision_requested: { subject: safeHeader(`✏️ Changes requested: ${shortTitle}`), headline: `${safeCustomer} requested changes`, body: feedback ? `Their feedback: "${safeFeedback}"` : 'They asked for scope or pricing changes.', cta: 'Revise quote', ctaColor: '#f97316', urgent: true },
    declined: { subject: safeHeader(`${customerName || 'Customer'} declined: ${shortTitle}`), headline: `${safeCustomer} declined the quote`, body: feedback ? `Their reason: "${safeFeedback}"` : 'No reason given.', cta: 'View quote', ctaColor: '#667085', urgent: false },
    question: { subject: safeHeader(`💬 ${customerName || 'Customer'} asked about: ${shortTitle}`), headline: `${safeCustomer} has a question`, body: feedback ? `"${safeFeedback}"` : 'They left a question on your quote.', cta: 'View & respond', ctaColor: '#2563eb', urgent: true },
  };

  const info = actionMap[action];
  if (!info) return;

  const quoteUrl = `${appUrl}/app/quotes/${quoteId}`;

  // Build contact-back section if customer has contact info
  const contactBackHtml = (action === 'approved' || action === 'question') ? `
    <div style="background:#f8f7f4;border-radius:10px;padding:14px;margin:20px 0 0">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#667085;margin-bottom:8px">Quick response</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a href="${h(quoteUrl)}" style="display:inline-block;background:${info.ctaColor};color:white;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:700;font-size:13px">${h(info.cta)} →</a>
      </div>
    </div>
  ` : '';

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'notifications@punchlist.ca',
      to: [contractorEmail],
      subject: info.subject,
      headers: info.urgent ? { 'X-Priority': '1', 'Importance': 'high' } : undefined,
      html: `
        <div style="font-family:Inter,-apple-system,Arial,sans-serif;max-width:540px;margin:0 auto;padding:32px 24px;color:#14161a">
          <p style="color:#f97316;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:11px;margin:0 0 8px">Punchlist notification</p>
          <h1 style="font-size:22px;margin:0 0 12px;letter-spacing:-.03em">${info.headline}</h1>
          <p style="color:#667085;margin-bottom:24px;line-height:1.6">${info.body}</p>
          <a href="${h(quoteUrl)}" style="display:inline-block;background:${info.ctaColor};color:white;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:700">${h(info.cta)} →</a>
          ${contactBackHtml}
          <hr style="border:none;border-top:1px solid #e8e6e1;margin:28px 0">
          <p style="color:#aaa;font-size:11px;margin:0">Punchlist · ${h(contractorName || 'Your workspace')}</p>
        </div>
      `,
    }),
  }).catch((error) => { console.error('[email-fail] notifyContractor', error.message); });
}

// Phase 4B: Create in-app notification alongside email
async function createInAppNotification(supabase, { userId, type, title, body, link }) {
  if (!userId) return;
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: type || 'general',
      title: title || '',
      body: body || '',
      link: link || null,
      read: false,
    });
  } catch (err) {
    console.warn('[public-quote-action] Notification insert failed:', err?.message);
  }
}

// Phase 7B: Send Web Push notification to contractor if they have a subscription
async function sendPushNotification(supabase, { userId, title, body, url }) {
  if (!userId) return;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail = process.env.VAPID_EMAIL || 'mailto:hello@punchlist.ca';
  if (!vapidPublic || !vapidPrivate) return;

  try {
    const { data: profile } = await supabase.from('profiles').select('push_subscription').eq('id', userId).maybeSingle();
    if (!profile?.push_subscription?.endpoint) return;

    const webpush = await import('web-push');
    webpush.default.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);

    const payload = JSON.stringify({
      title: title || 'Punchlist',
      body: body || '',
      url: url || '/app',
      tag: 'punchlist-' + Date.now(),
    });

    await webpush.default.sendNotification(profile.push_subscription, payload);
  } catch (err) {
    // If subscription is expired/invalid, clear it
    if (err?.statusCode === 410 || err?.statusCode === 404) {
      await supabase.from('profiles').update({ push_subscription: null }).eq('id', userId).catch(() => {});
    }
    console.warn('[push] Failed:', err?.message);
  }
}

export default async function handler(req, res) {
  // CORS — allow punchlist.ca and any Vercel deployment URL
  const origin = req.headers.origin || '';
  const allowed = ['https://www.punchlist.ca', 'https://punchlist.ca'];
  const isVercel = origin.endsWith('.vercel.app') || origin.includes('punchlist');
  if (allowed.includes(origin) || isVercel) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let { token, action, status, feedback, decline_reason } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Missing token' });

  // ── Public input size caps ──
  // These fields come from a (presumed) customer browser hitting a
  // share-token URL. Cap each before it ever reaches the DB so a
  // malicious caller can't write megabytes into the row.
  const cap = (v, n) => (typeof v === 'string' ? v.slice(0, n) : v);
  feedback = cap(feedback, 1000);
  decline_reason = cap(decline_reason, 1000);
  if (typeof req.body?.signer_name === 'string') req.body.signer_name = req.body.signer_name.slice(0, 100);
  if (typeof req.body?.question === 'string') req.body.question = req.body.question.slice(0, 1000);
  if (typeof req.body?.reply === 'string') req.body.reply = req.body.reply.slice(0, 4000);
  // signature_data is a base64 data URL. Cap to ~300KB which is plenty
  // for a typed/drawn signature, and reject anything that isn't a
  // data:image/... prefix so a caller can't just store arbitrary text.
  if (typeof req.body?.signature_data === 'string') {
    if (req.body.signature_data.length > 300_000 || !/^data:image\//.test(req.body.signature_data)) {
      return res.status(400).json({ error: 'Invalid signature data' });
    }
  }
  if (Array.isArray(req.body?.selected_optional_ids)) {
    // Must be UUID strings; cap count.
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    req.body.selected_optional_ids = req.body.selected_optional_ids
      .filter(s => typeof s === 'string' && UUID.test(s))
      .slice(0, 50);
  }

  // Rate limit: 40 requests/min per IP for views, 10/min for mutations
  const ip = getClientIp(req);
  const isMutation = action !== 'view';
  if (blocked(res, `pqa:${isMutation ? 'mut' : 'view'}:${ip}`, isMutation ? 10 : 40, 60_000)) return;

  let supabase;
  try {
    supabase = getSupabase();
  } catch (e) {
    console.error('[public-quote-action] Config error:', e.message);
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const { data: quote, error: fetchError } = await supabase
      .from('quotes')
      .select('*, customer:customers(*)')
      .eq('share_token', token)
      .maybeSingle();

    if (fetchError || !quote) return res.status(404).json({ error: 'Quote not found' });

    // Fetch contractor info separately
    let contractor = null;
    if (quote.user_id) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', quote.user_id).maybeSingle();
      contractor = p;
    }

    const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || 'https://punchlist.ca';
    const contractorEmail = contractor?.email;
    const contractorName = contractor?.full_name;
    const customerName = quote.customer?.name;
    // Normalize: frontend sends feedback, some callers may send decline_reason
    const reason = feedback || decline_reason || '';

    // GUARD: reject mutating actions on terminal statuses
    const CLOSED_STATUSES = ['converted_to_invoice', 'paid', 'expired', 'deposit_paid'];
    const PASSTHROUGH_ACTIONS = ['view', 'question'];
    if (CLOSED_STATUSES.includes(quote.status) && !PASSTHROUGH_ACTIONS.includes(action)) {
      return res.status(400).json({ error: 'This quote is no longer accepting actions.', status: quote.status });
    }
    if (quote.status === 'declined' && !PASSTHROUGH_ACTIONS.includes(action) && action !== 'undo_decline') {
      return res.status(400).json({ error: 'This quote was declined.', status: quote.status });
    }

    // GUARD: reject sign/approve on already-signed quotes
    if (quote.signed_at && ['approve', 'sign'].includes(action)) {
      return res.status(400).json({ error: 'This quote has already been signed.', signed_at: quote.signed_at });
    }

    // VIEW
    //
    // The whole branch is wrapped in try/catch + best-effort sub-calls so
    // ANY failure (constraint violation, missing column, push provider
    // outage, etc.) returns 200 to the customer's browser. Bookkeeping
    // is best-effort; the customer must never see a 500 just because a
    // contractor-side analytics insert misfired.
    if (action === 'view') {
      try {
        const ip = clientIp(req);
        const ua = (req.headers?.['user-agent'] || '').slice(0, 200);
        const updates = { last_viewed_at: new Date().toISOString(), view_count: (quote.view_count || 0) + 1 };
        if (!['viewed', 'approved', 'approved_pending_deposit', 'deposit_paid', 'converted_to_invoice', 'paid'].includes(quote.status)) updates.status = 'viewed';
        const isFirstView = !quote.first_viewed_at;
        if (isFirstView) {
          updates.first_viewed_at = new Date().toISOString();
          if (quote.created_at) {
            updates.time_to_view_seconds = Math.round((Date.now() - new Date(quote.created_at).getTime()) / 1000);
          }
        }
        const { error: viewUpdErr } = await supabase.from('quotes').update(updates).eq('id', quote.id);
        if (viewUpdErr) console.warn('[public-quote-action] view update failed:', viewUpdErr.message);

        supabase.from('quote_views').insert({ quote_id: quote.id, viewer_ip: ip, user_agent: ua }).then(() => {}).catch(() => {});

        if (isFirstView) {
          try {
            await createInAppNotification(supabase, {
              userId: quote.user_id,
              type: 'quote_viewed',
              title: `Quote viewed: ${quote.title || 'Untitled'}`,
              body: `${customerName || 'Your customer'} opened your quote.`,
              link: `/app/quotes/${quote.id}`,
            });
          } catch (e) { console.warn('[public-quote-action] notif failed:', e?.message); }

          // Push payloads land on the LOCK screen. Don't put the
          // customer's name or the $ amount there — anyone glancing
          // at the phone (in a customer's home, a coworker's hand)
          // would see it. The contractor can tap in to see details.
          sendPushNotification(supabase, {
            userId: quote.user_id,
            title: 'Quote viewed',
            body: 'A customer opened one of your quotes.',
            url: `/app/quotes/${quote.id}`,
          }).catch(() => {});

          try {
            const viewSmsPhone = await contractorSmsEnabled(supabase, quote.user_id);
            if (viewSmsPhone) {
              sendSMS(viewSmsPhone, `👀 ${customerName || 'Your customer'} just opened "${(quote.title || 'your quote').slice(0, 40)}". Follow up: ${appUrl}/app/quotes/${quote.id}`);
            }
          } catch (e) { console.warn('[public-quote-action] view SMS failed:', e?.message); }
        }
      } catch (e) {
        console.warn('[public-quote-action] view branch failed:', e?.message);
      }
      return res.status(200).json({ ok: true });
    }

    // APPROVE (with signature)
    if (status === 'approved') {
      if (['approved', 'approved_pending_deposit', 'deposit_paid', 'converted_to_invoice', 'paid'].includes(quote.status))
        return res.status(400).json({ error: 'Already approved' });
      const nextStatus = quote.deposit_required && quote.deposit_status !== 'paid' ? 'approved_pending_deposit' : 'approved';
      const nextDepositStatus = quote.deposit_required && quote.deposit_status === 'not_required' ? 'requested' : quote.deposit_status;
      const updatePayload = {
        status: nextStatus,
        deposit_status: nextDepositStatus,
        approved_at: new Date().toISOString(),
      };
      // Compute time_to_respond_seconds from quote creation
      if (quote.created_at) {
        updatePayload.time_to_respond_seconds = Math.round((Date.now() - new Date(quote.created_at).getTime()) / 1000);
      }
      // Store signature if provided
      const { signature_data, signer_name, selected_optional_ids } = req.body || {};
      if (signature_data) {
        updatePayload.signature_data = signature_data;
        updatePayload.signed_at = new Date().toISOString();
        updatePayload.signer_name = signer_name || '';
        updatePayload.signer_ip = clientIp(req);
      }
      // 2B: Store which optional items the customer selected + recalculate total
      if (Array.isArray(selected_optional_ids) && selected_optional_ids.length > 0) {
        updatePayload.selected_optional_ids = selected_optional_ids;

        // ── Prompt 8: recalculate total to include selected optionals ──
        const { data: items } = await supabase
          .from('line_items')
          .select('*')
          .eq('quote_id', quote.id);

        const optTotal = (items || [])
          .filter(i => selected_optional_ids.includes(i.id))
          .reduce((sum, i) => sum + (Number(i.quantity || 1) * Number(i.unit_price || 0)), 0);

        if (optTotal > 0) {
          updatePayload.total = Number(quote.total || 0) + optTotal;
          // approved_total / original_total stored separately as best-effort
          // (columns may not exist — don't let missing columns break customer approval)
          updatePayload._approvedTotal = updatePayload.total;
          updatePayload._originalTotal = Number(quote.total || 0);
        }

        // Mark selected optionals as included in scope
        await supabase
          .from('line_items')
          .update({ included: true })
          .eq('quote_id', quote.id)
          .in('id', selected_optional_ids);
      }
      // Strip best-effort fields from main payload before update
      const { _approvedTotal, _originalTotal, ...safePayload } = updatePayload;
      // ── A3: Atomic status transition ──
      // The .in('status', ACTIONABLE_STATUSES) + .is('signed_at', null)
      // predicates make the UPDATE race-proof. If another request (or a
      // double-tap) has already flipped status past approval or written a
      // signature, this UPDATE matches 0 rows and we return 409 without
      // firing any downstream notifications / emails / SMS.
      const { data: updated, error: ue } = await supabase
        .from('quotes')
        .update(safePayload)
        .eq('id', quote.id)
        .in('status', ACTIONABLE_STATUSES)
        .is('signed_at', null)
        .select('status,deposit_status')
        .maybeSingle();
      if (ue) throw ue;
      if (!updated) {
        // Another request won the race — status changed between our fetch
        // and our update, or the quote was signed concurrently.
        return res.status(409).json({ error: 'Already approved or no longer valid' });
      }
      // Wrap downstream side-effects in a single try/catch so a single
      // notification failure doesn't bubble up and 500 the response
      // (the customer-facing write has already committed successfully).
      try {
        // Best-effort: store approved_total/original_total if columns exist
      if (_approvedTotal !== undefined) {
        supabase.from('quotes').update({ approved_total: _approvedTotal, original_total: _originalTotal }).eq('id', quote.id).then(() => {}).catch(() => {});
      }
      await notifyContractor({ contractorEmail, contractorName, contractorPhone: contractor?.phone, customerName, quoteTitle: quote.title, action: 'approved', appUrl, quoteId: quote.id });
      // 4B: In-app notification
      await createInAppNotification(supabase, {
        userId: quote.user_id,
        type: 'quote_approved',
        title: `Quote approved: ${quote.title || 'Untitled'}`,
        body: `${customerName || 'Customer'} approved your quote.`,
        link: `/app/quotes/${quote.id}`,
      });
      // 7B: Push notification — generic strings only on the lock screen.
      await sendPushNotification(supabase, {
        userId: quote.user_id,
        title: 'Quote approved',
        body: 'A customer approved one of your quotes.',
        url: `/app/quotes/${quote.id}`,
      });
      // 1C: Auto-send confirmation email to customer after signing
      const customerEmail = quote.customer?.email;
      if (customerEmail) {
        await sendSignedConfirmationToCustomer({
          customerEmail,
          customerName: quote.customer?.name || '',
          contractorName: contractor?.full_name || contractor?.company_name || '',
          contractorPhone: contractor?.phone || '',
          contractorEmail: contractor?.email || '',
          quoteTitle: quote.title || 'Your quote',
          quoteTotal: updatePayload.total ?? quote.total ?? 0,
          shareToken: quote.share_token,
          signedAt: updatePayload.signed_at || new Date().toISOString(),
          country: quote.country || 'CA',
          appUrl,
        });
      }
      // 9A: SMS — notify contractor of approval
      const contractorSmsPhone = await contractorSmsEnabled(supabase, quote.user_id);
      if (contractorSmsPhone) {
        sendSMS(contractorSmsPhone, `🎉 ${customerName || 'Customer'} approved "${(quote.title || 'your quote').slice(0, 40)}"${quote.total ? ' for ' + fmtCurrency(updatePayload.total ?? quote.total, quote.country) : ''}! Book the job: ${appUrl}/app/quotes/${quote.id}`);
      }
      // 9B: SMS — send signed confirmation to customer
      if (quote.customer?.phone) {
        sendSMS(quote.customer.phone, `Your quote for "${(quote.title || 'your project').slice(0, 40)}" with ${contractor?.company_name || contractor?.full_name || 'your contractor'} is signed and confirmed. View: ${appUrl}/public/${quote.share_token}`);
      }
      } catch (notifyErr) {
        // Notifications are best-effort; the approval itself has committed.
        // Don't 500 — the customer shouldn't see a failure screen because
        // an SMS provider was down.
        console.warn('[public-quote-action] approve notifications failed:', notifyErr?.message);
      }
      return res.status(200).json({ status: updated.status, deposit_status: updated.deposit_status });
    }

    // REVISION REQUEST
    if (status === 'revision_requested') {
      const note = reason ? `Change request: ${reason}` : 'Customer requested changes.';
      const existing = quote.internal_notes || '';
      const nextNotes = [note, existing].filter(Boolean).join('\n');
      const revisionPayload = { status: 'revision_requested', internal_notes: nextNotes };
      if (quote.created_at) {
        revisionPayload.time_to_respond_seconds = Math.round((Date.now() - new Date(quote.created_at).getTime()) / 1000);
      }
      // ── A3: Atomic transition (see APPROVE branch for rationale) ──
      const { data: updated, error: ue } = await supabase
        .from('quotes')
        .update(revisionPayload)
        .eq('id', quote.id)
        .in('status', ACTIONABLE_STATUSES)
        .select('status')
        .maybeSingle();
      if (ue) throw ue;
      if (!updated) {
        return res.status(409).json({ error: 'Quote is no longer in a state that accepts revision requests' });
      }
      try {
        await notifyContractor({ contractorEmail, contractorName, contractorPhone: contractor?.phone, customerName, quoteTitle: quote.title, action: 'revision_requested', feedback: reason, appUrl, quoteId: quote.id });
        // 4B: In-app notification
        await createInAppNotification(supabase, {
          userId: quote.user_id,
          type: 'revision_requested',
          title: `Changes requested: ${quote.title || 'Untitled'}`,
          body: reason ? `"${reason.slice(0, 120)}"` : `${customerName || 'Customer'} wants changes.`,
          link: `/app/quotes/${quote.id}`,
        });
        // 9A: SMS — notify contractor of revision request
        const revSmsPhone = await contractorSmsEnabled(supabase, quote.user_id);
        if (revSmsPhone) {
          sendSMS(revSmsPhone, `✏️ ${safeSmsSegment(customerName || 'Customer')} requested changes to "${safeSmsSegment((quote.title || 'your quote').slice(0, 40))}".${reason ? ' "' + safeSmsSegment(reason.slice(0, 80)) + '"' : ''} Revise: ${appUrl}/app/quotes/${quote.id}?tab=messages`);
        }
      } catch (notifyErr) {
        console.warn('[public-quote-action] revision notifications failed:', notifyErr?.message);
      }
      return res.status(200).json({ status: updated.status });
    }

    // DECLINE
    if (status === 'declined') {
      const note = reason ? `Declined: ${reason}` : 'Customer declined.';
      const existing = quote.internal_notes || '';
      const nextNotes = [note, existing].filter(Boolean).join('\n');
      const declinePayload = { status: 'declined', internal_notes: nextNotes, declined_at: new Date().toISOString() };
      if (quote.created_at) {
        declinePayload.time_to_respond_seconds = Math.round((Date.now() - new Date(quote.created_at).getTime()) / 1000);
      }
      // ── A3: Atomic transition (see APPROVE branch for rationale) ──
      const { data: updated, error: ue } = await supabase
        .from('quotes')
        .update(declinePayload)
        .eq('id', quote.id)
        .in('status', ACTIONABLE_STATUSES)
        .select('status')
        .maybeSingle();
      if (ue) throw ue;
      if (!updated) {
        return res.status(409).json({ error: 'Quote is no longer in a state that accepts a decline' });
      }
      try {
        await notifyContractor({ contractorEmail, contractorName, contractorPhone: contractor?.phone, customerName, quoteTitle: quote.title, action: 'declined', feedback: reason, appUrl, quoteId: quote.id });
        // 4B: In-app notification
        await createInAppNotification(supabase, {
          userId: quote.user_id,
          type: 'quote_declined',
          title: `Quote declined: ${quote.title || 'Untitled'}`,
          body: reason ? `"${reason.slice(0, 120)}"` : `${customerName || 'Customer'} declined.`,
          link: `/app/quotes/${quote.id}`,
        });
        // 7B: Push notification — generic on the lock screen.
        await sendPushNotification(supabase, {
          userId: quote.user_id,
          title: 'Quote declined',
          body: 'A customer declined one of your quotes.',
          url: `/app/quotes/${quote.id}`,
        });
        // 9A: SMS — notify contractor of decline
        const decSmsPhone = await contractorSmsEnabled(supabase, quote.user_id);
        if (decSmsPhone) {
          sendSMS(decSmsPhone, `${safeSmsSegment(customerName || 'Customer')} declined "${safeSmsSegment((quote.title || 'your quote').slice(0, 40))}".${reason ? ' Reason: "' + safeSmsSegment(reason.slice(0, 60)) + '"' : ''} ${appUrl}/app/quotes/${quote.id}`);
        }
      } catch (notifyErr) {
        console.warn('[public-quote-action] decline notifications failed:', notifyErr?.message);
      }
      return res.status(200).json({ status: updated.status });
    }

    // QUESTION — store in structured conversation array + notify contractor
    if (action === 'question') {
      const { question } = req.body || {};
      if (!question?.trim()) return res.status(400).json({ error: 'Question is required' });
      const existingConversation = Array.isArray(quote.conversation) ? quote.conversation : [];
      const newEntry = {
        id: Date.now().toString(),
        role: 'customer',
        text: question.trim(),
        timestamp: new Date().toISOString(),
        name: quote.customer?.name || 'Customer',
      };
      const updatedConversation = [...existingConversation, newEntry];
      // Also append to internal_notes as a fallback audit trail
      const timestamp = new Date().toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const note = `Question (${timestamp}): ${question}`;
      const existing = quote.internal_notes || '';
      const updated_notes = note + (existing ? '\n' + existing : '');
      // Try to save conversation array — if column doesn't exist, fall back to internal_notes only
      // Also set status to question_asked (unless already in a terminal/approved state)
      const KEEP_STATUS = ['approved','approved_pending_deposit','deposit_paid','converted_to_invoice','paid','revision_requested','declined'];
      const questionStatusUpdate = KEEP_STATUS.includes(quote.status) ? {} : { status: 'revision_requested' };
      let conversationSaved = true;
      const { error: convErr } = await supabase.from('quotes').update({ conversation: updatedConversation, internal_notes: updated_notes, ...questionStatusUpdate }).eq('id', quote.id);
      if (convErr && convErr.message?.includes('conversation')) {
        // conversation column doesn't exist — save to internal_notes only
        console.warn('[public-quote-action] conversation column missing, using internal_notes fallback');
        await supabase.from('quotes').update({ internal_notes: updated_notes }).eq('id', quote.id);
        conversationSaved = false;
      }
      await notifyContractor({ contractorEmail, contractorName, contractorPhone: contractor?.phone, customerName, quoteTitle: quote.title, action: 'question', feedback: question, appUrl, quoteId: quote.id });
      // 4B: In-app notification
      await createInAppNotification(supabase, {
        userId: quote.user_id,
        type: 'customer_question',
        title: `Question: ${quote.title || 'Untitled'}`,
        body: `${customerName || 'Customer'}: "${question.slice(0, 120)}"`,
        link: `/app/quotes/${quote.id}`,
      });
      // 7B: Push notification — keep customer text / quote details
      // off the lock screen.
      await sendPushNotification(supabase, {
        userId: quote.user_id,
        title: 'New question on your quote',
        body: 'A customer left a question.',
        url: `/app/quotes/${quote.id}`,
      });
      // 9A: SMS — notify contractor of customer question
      const qSmsPhone = await contractorSmsEnabled(supabase, quote.user_id);
      if (qSmsPhone) {
        sendSMS(qSmsPhone, `💬 ${safeSmsSegment(customerName || 'Customer')} asked about "${safeSmsSegment((quote.title || 'your quote').slice(0, 30))}": "${safeSmsSegment(question.slice(0, 80))}${question.length > 80 ? '…' : ''}" Reply: ${appUrl}/app/quotes/${quote.id}?tab=messages`);
      }
      // If conversation column was saved, return the full thread for real-time display.
      // If not, return empty array — the client will show a success banner but not a thread
      // that would vanish on next page load.
      return res.status(200).json({ ok: true, conversation: conversationSaved ? updatedConversation : [], status: questionStatusUpdate.status || quote.status });
    }

    // CONTRACTOR REPLY — appends to conversation and emails customer
    //
    // Auth: the previous implementation trusted a client-supplied
    // `contractor_user_id` field, which is IDOR — anyone who knows the
    // share token plus the owner's UUID can impersonate them. Now we
    // require the contractor's session JWT in the Authorization header
    // and resolve the user from Supabase, then verify ownership.
    if (action === 'contractor_reply') {
      const { reply } = req.body || {};
      if (!reply?.trim()) return res.status(400).json({ error: 'Reply is required' });

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const token = authHeader.slice(7);
      const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !authUser || authUser.id !== quote.user_id) {
        return res.status(403).json({ error: 'Not authorized to reply on this quote' });
      }
      const existingConversation = Array.isArray(quote.conversation) ? quote.conversation : [];
      const newEntry = {
        id: Date.now().toString(),
        role: 'contractor',
        text: reply.trim(),
        timestamp: new Date().toISOString(),
        name: contractorName || contractor?.company_name || 'Your contractor',
      };
      const updatedConversation = [...existingConversation, newEntry];
      // Try to save conversation — fall back if column doesn't exist
      let conversationSaved = true;
      const { error: convErr } = await supabase.from('quotes').update({ conversation: updatedConversation }).eq('id', quote.id);
      if (convErr && convErr.message?.includes('conversation')) {
        // conversation column missing — save to internal_notes instead
        const note = `Contractor reply: ${reply.trim()}`;
        const existing = quote.internal_notes || '';
        await supabase.from('quotes').update({ internal_notes: note + (existing ? '\n' + existing : '') }).eq('id', quote.id);
        conversationSaved = false;
      }
      // Email customer if they have an email
      const customerEmail = quote.customer?.email;
      if (customerEmail && process.env.RESEND_API_KEY) {
        const quoteUrl = `${appUrl}/public/${quote.share_token}`;
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: `${(contractor?.company_name || contractor?.full_name || 'Reply').replace(/[<>\r\n"]/g, '').slice(0, 60)} via Punchlist <${(process.env.EMAIL_FROM || 'notifications@punchlist.ca').replace(/^.*<|>$/g, '')}>`,
            reply_to: contractor?.email || undefined,
            to: [customerEmail],
            subject: safeHeader(`Reply to your question — ${quote.title || 'your quote'}`),
            html: `
              <div style="font-family:Inter,-apple-system,Arial,sans-serif;max-width:540px;margin:0 auto;padding:32px 24px;color:#14161a">
                <p style="color:#f97316;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:11px;margin:0 0 8px">Response from your contractor</p>
                <h1 style="font-size:22px;margin:0 0 12px;letter-spacing:-.03em">${h(contractorName) || 'Your contractor'} replied</h1>
                <div style="background:#f8f7f4;border-radius:12px;padding:20px;margin-bottom:24px;font-size:15px;line-height:1.6;color:#14161a">
                  ${h(reply.trim()).replace(/\n/g, '<br/>')}
                </div>
                <a href="${h(quoteUrl)}" style="display:inline-block;background:#f97316;color:white;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:700;margin-bottom:24px">View your quote →</a>
                <hr style="border:none;border-top:1px solid #e8e6e1;margin:0 0 20px"/>
                <div style="font-size:13px;color:#667085">
                  <strong style="color:#14161a">${h(contractorName) || 'Your contractor'}</strong><br/>
                  ${contractor?.phone ? `${h(contractor.phone)}<br/>` : ''}
                  ${contractor?.email ? `${h(contractor.email)}<br/>` : ''}
                </div>
                <p style="color:#aaa;font-size:11px;margin:20px 0 0">Powered by Punchlist</p>
              </div>
            `,
          }),
        }).catch((error) => { console.error('[email-fail] contractor_reply', error.message); });
      }
      // 9B: SMS — notify customer of contractor's reply
      if (quote.customer?.phone) {
        const cName = contractorName || contractor?.company_name || 'Your contractor';
        sendSMS(quote.customer.phone, `${cName} replied to your question about "${(quote.title || 'your quote').slice(0, 40)}". View: ${appUrl}/public/${quote.share_token}`);
      }
      return res.status(200).json({ ok: true, conversation: conversationSaved ? updatedConversation : [] });
    }

    // UNDO DECLINE — customer changes their mind within 48 hours
    if (action === 'undo_decline') {
      if (quote.status !== 'declined') {
        return res.status(400).json({ error: 'Quote is not declined' });
      }
      const declinedAt = quote.declined_at ? new Date(quote.declined_at).getTime() : 0;
      const hoursSince = declinedAt ? (Date.now() - declinedAt) / 3600000 : Infinity;
      if (hoursSince > 48) {
        return res.status(400).json({ error: 'The window to undo has passed. Please contact your contractor directly.' });
      }
      const { data: updated, error: ue } = await supabase
        .from('quotes')
        .update({ status: 'viewed', declined_at: null })
        .eq('id', quote.id)
        .eq('status', 'declined')
        .select('status')
        .maybeSingle();
      if (ue) throw ue;
      if (!updated) return res.status(409).json({ error: 'Could not undo decline' });
      try {
        await createInAppNotification(supabase, {
          userId: quote.user_id,
          type: 'decline_undone',
          title: `Decline reversed: ${quote.title || 'Untitled'}`,
          body: `${customerName || 'Customer'} changed their mind and wants to proceed.`,
          link: `/app/quotes/${quote.id}`,
        });
        await sendPushNotification(supabase, {
          userId: quote.user_id,
          title: 'Decline reversed',
          body: 'A customer changed their mind on one of your quotes.',
          url: `/app/quotes/${quote.id}`,
        });
        if (contractorEmail) {
          await notifyContractor({ contractorEmail, contractorName, contractorPhone: contractor?.phone, customerName, quoteTitle: quote.title, action: 'approved', feedback: 'Customer reversed their decline and wants to proceed.', appUrl, quoteId: quote.id });
        }
        const undoSmsPhone = await contractorSmsEnabled(supabase, quote.user_id);
        if (undoSmsPhone) {
          sendSMS(undoSmsPhone, `🔄 ${customerName || 'Customer'} changed their mind on "${(quote.title || 'your quote').slice(0, 40)}" — they want to proceed! ${appUrl}/app/quotes/${quote.id}`);
        }
      } catch (notifyErr) {
        console.warn('[public-quote-action] undo_decline notifications failed:', notifyErr?.message);
      }
      return res.status(200).json({ status: updated.status });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('public-quote-action:', err);
    return res.status(500).json({
      error: 'Server error',
      detail: err?.message || String(err),
      code: err?.code || null,
      hint: err?.hint || null,
    });
  }
}
