import { createClient } from '@supabase/supabase-js';
import { blocked, getClientIp } from './_rate-limit.js';

// Defensive Supabase client factory — never created at module level
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Country-aware currency formatting
function formatCurrency(n, country = 'CA') {
  const num = Number(n || 0);
  if (country === 'US') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
  }
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(num);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: 'Email service not configured' });

  const supabase = getSupabase();
  if (!supabase) {
    console.error('[send-quote-email] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({ error: 'Database not configured' });
  }

  // Rate limit: 30 requests/min per IP (prevents email abuse)
  if (blocked(res, `sqe:${getClientIp(req)}`, 30, 60_000)) return;

  const body = req.body || {};

  // Demo quote email — landing page conversion
  if (body.action === 'demo_quote') {
    return handleDemoQuoteEmail(req, res, body);
  }

  // 5C: Payment reminder email
  if (body.action === 'payment_reminder') {
    const { customerEmail, customerName, contractorName, contractorPhone, contractorEmail: cEmail,
            invoiceNumber, invoiceTitle, invoiceTotal, invoiceBalance, dueAt, daysPastDue, shareToken, country } = body;
    if (!customerEmail) return res.status(400).json({ error: 'Missing customerEmail' });

    const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || 'https://punchlist.ca';
    const invoiceUrl = shareToken ? `${appUrl}/public/invoice/${shareToken}` : '';
    const fmt = (n) => formatCurrency(n, country);
    const dueStr = dueAt ? new Date(dueAt).toLocaleDateString(country === 'US' ? 'en-US' : 'en-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'notifications@punchlist.ca',
        reply_to: cEmail || undefined,
        to: [customerEmail],
        subject: `Payment reminder — ${invoiceNumber || 'Invoice'} (${daysPastDue} days overdue)`,
        html: `
          <div style="font-family:Inter,-apple-system,Arial,sans-serif;max-width:540px;margin:0 auto;padding:32px 24px;color:#14161a">
            <p style="color:#EF4444;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:11px;margin:0 0 8px">Payment Reminder</p>
            <h1 style="font-size:22px;margin:0 0 12px;letter-spacing:-.03em">Your payment is ${daysPastDue} days overdue</h1>
            <p style="color:#667085;margin-bottom:24px;line-height:1.6">
              This is a friendly reminder that payment for <strong style="color:#14161a">${invoiceTitle || invoiceNumber || 'your invoice'}</strong> from <strong style="color:#14161a">${contractorName || 'your contractor'}</strong> was due on <strong>${dueStr}</strong>.
            </p>
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px;margin-bottom:24px">
              <div style="display:grid;gap:12px">
                <div><div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Balance due</div><div style="font-size:22px;font-weight:800;color:#14161a">${fmt(invoiceBalance || invoiceTotal)}</div></div>
                <div><div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Due date</div><div style="font-size:14px;font-weight:600;color:#EF4444">${dueStr}</div></div>
              </div>
            </div>
            ${invoiceUrl ? `<div style="margin-bottom:24px"><a href="${invoiceUrl}" style="display:inline-block;background:#f97316;color:white;padding:14px 20px;border-radius:14px;text-decoration:none;font-weight:700;font-size:15px">View and pay invoice →</a></div>` : ''}
            <p style="color:#667085;font-size:13px;line-height:1.6;margin-bottom:20px">If you've already sent payment, please disregard this reminder.</p>
            <hr style="border:none;border-top:1px solid #e8e6e1;margin:0 0 20px"/>
            <div style="font-size:13px;color:#667085">
              <strong style="color:#14161a">${contractorName || 'Your contractor'}</strong><br/>
              ${contractorPhone ? `${contractorPhone}<br/>` : ''}
              ${cEmail ? `${cEmail}<br/>` : ''}
            </div>
            <p style="color:#aaa;font-size:11px;margin:20px 0 0">Powered by Punchlist</p>
          </div>
        `,
      }),
    });
    if (!emailRes.ok) {
      const err = await emailRes.text().catch(() => '');
      console.error('[send-quote-email] payment_reminder failed:', err);
      return res.status(500).json({ error: 'Failed to send reminder' });
    }
    return res.status(200).json({ ok: true });
  }

  // 5D: Payment receipt email
  if (body.action === 'payment_receipt') {
    const { customerEmail, customerName, contractorName, contractorPhone, contractorEmail: cEmail,
            invoiceNumber, invoiceTitle, amount, paymentMethod, paidAt, country } = body;
    if (!customerEmail) return res.status(400).json({ error: 'Missing customerEmail' });

    const fmt = (n) => formatCurrency(n, country);
    const paidDate = paidAt ? new Date(paidAt).toLocaleDateString(country === 'US' ? 'en-US' : 'en-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'notifications@punchlist.ca',
        reply_to: cEmail || undefined,
        to: [customerEmail],
        subject: `Payment received — ${invoiceNumber || 'Invoice'}`,
        html: `
          <div style="font-family:Inter,-apple-system,Arial,sans-serif;max-width:540px;margin:0 auto;padding:32px 24px;color:#14161a">
            <p style="color:#22C55E;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:11px;margin:0 0 8px">Payment Receipt</p>
            <h1 style="font-size:22px;margin:0 0 12px;letter-spacing:-.03em">Thank you for your payment!</h1>
            <p style="color:#667085;margin-bottom:24px;line-height:1.6">
              <strong style="color:#14161a">${contractorName || 'Your contractor'}</strong> has received your payment for <strong>${invoiceTitle || invoiceNumber || 'services rendered'}</strong>.
            </p>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:24px">
              <div style="display:grid;gap:12px">
                <div><div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Amount paid</div><div style="font-size:22px;font-weight:800;color:#14161a">${fmt(amount)}</div></div>
                ${paymentMethod ? `<div><div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Payment method</div><div style="font-size:14px;font-weight:600">${paymentMethod}</div></div>` : ''}
                <div><div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Date</div><div style="font-size:14px;font-weight:600">${paidDate}</div></div>
                <div><div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Invoice</div><div style="font-size:14px;font-weight:600">${invoiceNumber || ''}</div></div>
              </div>
            </div>
            <hr style="border:none;border-top:1px solid #e8e6e1;margin:0 0 20px"/>
            <div style="font-size:13px;color:#667085">
              <strong style="color:#14161a">${contractorName || 'Your contractor'}</strong><br/>
              ${contractorPhone ? `${contractorPhone}<br/>` : ''}
              ${cEmail ? `${cEmail}<br/>` : ''}
            </div>
            <p style="color:#aaa;font-size:11px;margin:20px 0 0">Powered by Punchlist · Keep this email as your receipt.</p>
          </div>
        `,
      }),
    });
    if (!emailRes.ok) {
      const err = await emailRes.text().catch(() => '');
      console.error('[send-quote-email] payment_receipt failed:', err);
      return res.status(500).json({ error: 'Failed to send receipt' });
    }
    return res.status(200).json({ ok: true });
  }

  // 2D: Booking confirmation email — separate action dispatched from createBooking
  if (body.action === 'booking_confirmation') {
    const { customerEmail, customerName, contractorName, contractorPhone, contractorEmail: cEmail,
            quoteTitle, scheduledFor, durationMinutes, bookingNotes } = body;
    if (!customerEmail) return res.status(400).json({ error: 'Missing customerEmail' });

    const dateObj = new Date(scheduledFor);
    const dateStr = dateObj.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: true });
    const durationHrs = Math.floor((durationMinutes || 120) / 60);
    const durationMins = (durationMinutes || 120) % 60;
    const durationStr = durationHrs > 0
      ? `${durationHrs}h${durationMins > 0 ? ` ${durationMins}min` : ''}`
      : `${durationMins}min`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'notifications@punchlist.ca',
        reply_to: cEmail || undefined,
        to: [customerEmail],
        subject: `Job confirmed — ${dateStr}`,
        html: `
          <div style="font-family:Inter,-apple-system,Arial,sans-serif;max-width:540px;margin:0 auto;padding:32px 24px;color:#14161a">
            <p style="color:#f97316;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:11px;margin:0 0 8px">Booking Confirmation</p>
            <h1 style="font-size:22px;margin:0 0 12px;letter-spacing:-.03em">Your job is scheduled ✓</h1>
            <p style="color:#667085;margin-bottom:24px;line-height:1.6">
              <strong style="color:#14161a">${contractorName || 'Your contractor'}</strong> will be there on the date below.
              ${quoteTitle ? `This is for: <strong>${quoteTitle}</strong>.` : ''}
            </p>
            <div style="background:#f8f7f4;border-radius:12px;padding:20px;margin-bottom:24px">
              <div style="display:grid;gap:12px">
                <div>
                  <div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Date</div>
                  <div style="font-size:16px;font-weight:700">${dateStr}</div>
                </div>
                <div>
                  <div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Time</div>
                  <div style="font-size:16px;font-weight:700">${timeStr}</div>
                </div>
                <div>
                  <div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Estimated duration</div>
                  <div style="font-size:16px;font-weight:700">${durationStr}</div>
                </div>
                ${bookingNotes ? `
                <div style="border-top:1px solid #e8e6e1;padding-top:12px">
                  <div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Notes</div>
                  <div style="font-size:14px;color:#14161a;line-height:1.5">${bookingNotes}</div>
                </div>` : ''}
              </div>
            </div>
            <hr style="border:none;border-top:1px solid #e8e6e1;margin:0 0 20px"/>
            <div style="font-size:13px;color:#667085">
              <strong style="color:#14161a">${contractorName || 'Your contractor'}</strong><br/>
              ${contractorPhone ? `${contractorPhone}<br/>` : ''}
              ${cEmail ? `${cEmail}<br/>` : ''}
            </div>
            <p style="color:#aaa;font-size:11px;margin:20px 0 0">Powered by Punchlist · Keep this email for your records.</p>
          </div>
        `,
      }),
    });
    if (!emailRes.ok) {
      const err = await emailRes.text().catch(() => '');
      console.error('[send-quote-email] booking_confirmation failed:', err);
      return res.status(500).json({ error: 'Failed to send booking confirmation' });
    }
    return res.status(200).json({ ok: true });
  }

  // 4C: Booking reschedule email
  if (body.action === 'booking_reschedule') {
    const { customerEmail, customerName, contractorName, contractorPhone, contractorEmail: cEmail,
            quoteTitle, scheduledFor, durationMinutes, bookingNotes, previousDate } = body;
    if (!customerEmail) return res.status(400).json({ error: 'Missing customerEmail' });

    const dateObj = new Date(scheduledFor);
    const dateStr = dateObj.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: true });
    const prevDateStr = previousDate ? new Date(previousDate).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' }) : '';

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'notifications@punchlist.ca',
        reply_to: cEmail || undefined,
        to: [customerEmail],
        subject: `Job rescheduled — ${dateStr}`,
        html: `
          <div style="font-family:Inter,-apple-system,Arial,sans-serif;max-width:540px;margin:0 auto;padding:32px 24px;color:#14161a">
            <p style="color:#f97316;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:11px;margin:0 0 8px">Schedule Update</p>
            <h1 style="font-size:22px;margin:0 0 12px;letter-spacing:-.03em">Your appointment has been rescheduled</h1>
            <p style="color:#667085;margin-bottom:24px;line-height:1.6">
              <strong style="color:#14161a">${contractorName || 'Your contractor'}</strong> has updated your appointment${quoteTitle ? ` for <strong>${quoteTitle}</strong>` : ''}.
              ${prevDateStr ? `<br/><span style="text-decoration:line-through;color:#aaa">Previously: ${prevDateStr}</span>` : ''}
            </p>
            <div style="background:#f8f7f4;border-radius:12px;padding:20px;margin-bottom:24px">
              <div style="display:grid;gap:12px">
                <div>
                  <div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">New date</div>
                  <div style="font-size:16px;font-weight:700">${dateStr}</div>
                </div>
                <div>
                  <div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Time</div>
                  <div style="font-size:16px;font-weight:700">${timeStr}</div>
                </div>
                ${bookingNotes ? `<div style="border-top:1px solid #e8e6e1;padding-top:12px"><div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Notes</div><div style="font-size:14px;color:#14161a;line-height:1.5">${bookingNotes}</div></div>` : ''}
              </div>
            </div>
            <p style="color:#667085;font-size:13px;line-height:1.6;margin-bottom:20px">If this time doesn't work for you, please reach out directly.</p>
            <hr style="border:none;border-top:1px solid #e8e6e1;margin:0 0 20px"/>
            <div style="font-size:13px;color:#667085">
              <strong style="color:#14161a">${contractorName || 'Your contractor'}</strong><br/>
              ${contractorPhone ? `${contractorPhone}<br/>` : ''}
              ${cEmail ? `${cEmail}<br/>` : ''}
            </div>
            <p style="color:#aaa;font-size:11px;margin:20px 0 0">Powered by Punchlist</p>
          </div>
        `,
      }),
    });
    if (!emailRes.ok) {
      const err = await emailRes.text().catch(() => '');
      console.error('[send-quote-email] booking_reschedule failed:', err);
      return res.status(500).json({ error: 'Failed to send reschedule email' });
    }
    return res.status(200).json({ ok: true });
  }

  // 4C: Booking cancellation email
  if (body.action === 'booking_cancel') {
    const { customerEmail, customerName, contractorName, contractorPhone, contractorEmail: cEmail,
            quoteTitle, scheduledFor } = body;
    if (!customerEmail) return res.status(400).json({ error: 'Missing customerEmail' });

    const dateObj = new Date(scheduledFor);
    const dateStr = dateObj.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'notifications@punchlist.ca',
        reply_to: cEmail || undefined,
        to: [customerEmail],
        subject: `Appointment cancelled — ${dateStr}`,
        html: `
          <div style="font-family:Inter,-apple-system,Arial,sans-serif;max-width:540px;margin:0 auto;padding:32px 24px;color:#14161a">
            <p style="color:#ef4444;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:11px;margin:0 0 8px">Schedule Update</p>
            <h1 style="font-size:22px;margin:0 0 12px;letter-spacing:-.03em">Your appointment has been cancelled</h1>
            <p style="color:#667085;margin-bottom:24px;line-height:1.6">
              <strong style="color:#14161a">${contractorName || 'Your contractor'}</strong> has cancelled the appointment${quoteTitle ? ` for <strong>${quoteTitle}</strong>` : ''} that was scheduled for <strong>${dateStr}</strong>.
            </p>
            <p style="color:#667085;font-size:13px;line-height:1.6;margin-bottom:20px">They'll follow up to reschedule. If you have questions, reach out directly.</p>
            <hr style="border:none;border-top:1px solid #e8e6e1;margin:0 0 20px"/>
            <div style="font-size:13px;color:#667085">
              <strong style="color:#14161a">${contractorName || 'Your contractor'}</strong><br/>
              ${contractorPhone ? `${contractorPhone}<br/>` : ''}
              ${cEmail ? `${cEmail}<br/>` : ''}
            </div>
            <p style="color:#aaa;font-size:11px;margin:20px 0 0">Powered by Punchlist</p>
          </div>
        `,
      }),
    });
    if (!emailRes.ok) {
      const err = await emailRes.text().catch(() => '');
      console.error('[send-quote-email] booking_cancel failed:', err);
      return res.status(500).json({ error: 'Failed to send cancellation email' });
    }
    return res.status(200).json({ ok: true });
  }

  // 7E: Daily digest email
  if (body.action === 'daily_digest') {
    const { contractorEmail, contractorName, quotesNeedingAction, todaysJobs, overdueInvoices, appUrl: dAppUrl } = body;
    if (!contractorEmail) return res.status(400).json({ error: 'Missing contractorEmail' });

    const aUrl = dAppUrl || process.env.APP_URL || 'https://punchlist.ca';
    const quotesHtml = (quotesNeedingAction || []).length > 0
      ? `<div style="margin-bottom:20px"><div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;font-weight:700">Quotes needing action</div>${quotesNeedingAction.map(q => `<div style="padding:8px 0;border-bottom:1px solid #e8e6e1"><a href="${aUrl}/app/quotes/${q.id}" style="color:#14161a;text-decoration:none;font-weight:600">${q.title || 'Untitled'}</a> <span style="color:#667085;font-size:12px">· ${q.status}</span></div>`).join('')}</div>`
      : '';
    const jobsHtml = (todaysJobs || []).length > 0
      ? `<div style="margin-bottom:20px"><div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;font-weight:700">Today's jobs</div>${todaysJobs.map(j => `<div style="padding:8px 0;border-bottom:1px solid #e8e6e1"><strong>${j.customerName || 'Job'}</strong> <span style="color:#667085;font-size:12px">· ${j.time}</span></div>`).join('')}</div>`
      : '';
    const invoicesHtml = (overdueInvoices || []).length > 0
      ? `<div style="margin-bottom:20px"><div style="font-size:12px;color:#ef4444;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;font-weight:700">Overdue invoices</div>${overdueInvoices.map(i => `<div style="padding:8px 0;border-bottom:1px solid #e8e6e1"><a href="${aUrl}/app/invoices/${i.id}" style="color:#14161a;text-decoration:none;font-weight:600">${i.invoice_number || 'Invoice'}</a> <span style="color:#ef4444;font-size:12px">· ${formatCurrency(i.total)} · ${i.daysPastDue}d overdue</span></div>`).join('')}</div>`
      : '';

    const hasContent = quotesNeedingAction?.length || todaysJobs?.length || overdueInvoices?.length;
    if (!hasContent) return res.status(200).json({ ok: true, skipped: true });

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'notifications@punchlist.ca',
        to: [contractorEmail],
        subject: `Your daily summary — ${new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'short', day: 'numeric' })}`,
        html: `
          <div style="font-family:Inter,-apple-system,Arial,sans-serif;max-width:540px;margin:0 auto;padding:32px 24px;color:#14161a">
            <p style="color:#f97316;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:11px;margin:0 0 8px">Daily Digest</p>
            <h1 style="font-size:22px;margin:0 0 20px;letter-spacing:-.03em">Good morning${contractorName ? ', ' + contractorName : ''}</h1>
            ${quotesHtml}
            ${jobsHtml}
            ${invoicesHtml}
            <a href="${aUrl}/app" style="display:inline-block;background:#f97316;color:white;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:700;margin-top:8px">Open Punchlist →</a>
            <hr style="border:none;border-top:1px solid #e8e6e1;margin:28px 0">
            <p style="color:#aaa;font-size:11px;margin:0">You're receiving this because you enabled daily digests in Settings. <a href="${aUrl}/app/settings" style="color:#aaa">Manage preferences</a></p>
          </div>
        `,
      }),
    });
    if (!emailRes.ok) {
      const err = await emailRes.text().catch(() => '');
      console.error('[send-quote-email] daily_digest failed:', err);
      return res.status(500).json({ error: 'Failed to send digest' });
    }
    return res.status(200).json({ ok: true });
  }

  if (body.action === 'send_invoice') {
    const { customerEmail, customerName, contractorName, contractorPhone, contractorEmail: cEmail,
            invoiceNumber, invoiceTitle, invoiceTotal, invoiceBalance, dueAt, shareToken, country,
            depositCredited } = body;
    if (!customerEmail) return res.status(400).json({ error: 'Missing customerEmail' });

    const appUrl = process.env.APP_URL || 'https://punchlist.ca';
    const invoiceUrl = shareToken ? `${appUrl}/public/invoice/${shareToken}` : '';
    const fmt = (n) => {
      const num = Number(n || 0);
      if (country === 'US') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
      return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(num);
    };
    const dueStr = dueAt ? new Date(dueAt).toLocaleDateString(country === 'US' ? 'en-US' : 'en-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    const firstName = (customerName || '').split(' ')[0] || '';

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'notifications@punchlist.ca',
        reply_to: cEmail || undefined,
        to: [customerEmail],
        subject: `Invoice from ${contractorName || 'your contractor'}: ${invoiceTitle || invoiceNumber}`,
        text: [
          `INVOICE FROM ${(contractorName || 'YOUR CONTRACTOR').toUpperCase()}`,
          invoiceTitle || invoiceNumber || 'Invoice',
          '',
          `Balance due: ${fmt(invoiceBalance || invoiceTotal)}`,
          dueStr ? `Due: ${dueStr}` : '',
          '',
          invoiceUrl ? `View and pay: ${invoiceUrl}` : '',
          '',
          contractorName || '',
          contractorPhone || '',
          cEmail || '',
        ].filter(l => l !== '').join('\n'),
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',sans-serif;max-width:540px;margin:0 auto;color:#18181b;background:#ffffff">
            <!-- Header -->
            <div style="padding:32px 28px 20px;border-bottom:1px solid #f0efec">
              <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#ea580c;background:#fff7ed;padding:4px 10px;border-radius:6px;display:inline-block;border:1px solid rgba(234,88,12,.15);margin-bottom:12px">Invoice</div>
              <h1 style="font-size:22px;margin:0 0 6px;letter-spacing:-.03em;color:#18181b">${invoiceTitle || invoiceNumber || 'Your invoice is ready'}</h1>
              ${customerName ? `<p style="font-size:14px;color:#3f3f46;margin:0">${firstName ? `Hi ${firstName} — ` : ''}here's your invoice from <strong style="color:#18181b">${contractorName || 'your contractor'}</strong>.</p>` : `<p style="font-size:14px;color:#3f3f46;margin:0"><strong style="color:#18181b">${contractorName || 'Your contractor'}</strong> has sent you an invoice.</p>`}
            </div>

            <!-- Amount card -->
            <div style="padding:24px 28px">
              <div style="background:#fafaf9;border:1px solid #f0efec;border-radius:12px;padding:20px;display:grid;gap:12px">
                ${depositCredited > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:#71717a"><span>Deposit credited</span><strong style="color:#16a34a">−${fmt(depositCredited)}</strong></div>` : ''}
                <div style="display:flex;justify-content:space-between;align-items:baseline;padding-top:${depositCredited > 0 ? '12px' : '0'};${depositCredited > 0 ? 'border-top:1px solid #e4e4e7;' : ''}">
                  <span style="font-size:14px;color:#71717a;font-weight:500">Balance due</span>
                  <strong style="font-size:24px;font-weight:800;letter-spacing:-.02em;color:#18181b">${fmt(invoiceBalance || invoiceTotal)}</strong>
                </div>
                ${dueStr ? `<div style="font-size:13px;color:#71717a">Due <strong style="color:#18181b">${dueStr}</strong></div>` : ''}
              </div>
            </div>

            <!-- CTA -->
            ${invoiceUrl ? `
              <div style="padding:0 28px 28px;text-align:center">
                <a href="${invoiceUrl}" style="display:inline-block;background:#ea580c;color:#ffffff;padding:16px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;box-shadow:0 2px 8px rgba(234,88,12,.2)">
                  View & Pay Invoice →
                </a>
              </div>
            ` : ''}

            <!-- Footer -->
            <div style="border-top:1px solid #f0efec;padding:20px 28px;text-align:center">
              <div style="font-size:13px;color:#3f3f46;font-weight:600">${contractorName || 'Your contractor'}</div>
              ${contractorPhone ? `<div style="font-size:12px;color:#71717a;margin-top:2px">${contractorPhone}</div>` : ''}
              ${cEmail ? `<div style="font-size:12px;color:#71717a;margin-top:2px">${cEmail}</div>` : ''}
              <div style="font-size:11px;color:#a1a1aa;margin-top:12px">Powered by <a href="https://punchlist.ca" style="color:#a1a1aa;text-decoration:none">Punchlist</a></div>
            </div>
          </div>
        `,
      }),
    });
    if (!emailRes.ok) return res.status(500).json({ error: 'Failed to send invoice email' });
    return res.status(200).json({ ok: true });
  }

  if (body.action === 'send_additional_work') {
    const { customerEmail, customerName, contractorName, contractorPhone,
            title, total, shareToken, country } = body;
    if (!customerEmail) return res.status(400).json({ error: 'Missing customerEmail' });
    const appUrl = process.env.APP_URL || 'https://punchlist.ca';
    const awrUrl = shareToken ? `${appUrl}/public/aw/${shareToken}` : '';
    const fmt = (n) => {
      const num = Number(n || 0);
      if (country === 'US') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
      return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(num);
    };
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'notifications@punchlist.ca',
        reply_to: cEmail || undefined,
        to: [customerEmail],
        subject: `Additional work request: ${title}`,
        html: `<div style="font-family:Inter,-apple-system,Arial,sans-serif;max-width:540px;margin:0 auto;padding:32px 24px;color:#14161a">
          <p style="color:#f59e0b;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:11px;margin:0 0 8px">Additional Work</p>
          <h1 style="font-size:22px;margin:0 0 12px;letter-spacing:-.03em">Additional work needs your approval</h1>
          <p style="color:#667085;margin-bottom:24px;line-height:1.6">
            While working on your job, <strong style="color:#14161a">${contractorName || 'your contractor'}</strong> found additional work that requires your approval before proceeding.
          </p>
          <div style="background:#f8f7f4;border-radius:12px;padding:20px;margin-bottom:24px">
            <div style="font-size:16px;font-weight:700;margin-bottom:8px">${title}</div>
            <div style="display:flex;justify-content:space-between;border-top:1px solid #e8e6e1;padding-top:12px;margin-top:8px">
              <span style="font-size:13px;color:#667085">Total</span>
              <strong>${fmt(total)}</strong>
            </div>
          </div>
          ${awrUrl ? `<div style="margin-bottom:24px"><a href="${awrUrl}" style="display:inline-block;background:#f97316;color:white;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:700">Review and approve →</a></div>` : ''}
          <hr style="border:none;border-top:1px solid #e8e6e1;margin:0 0 20px"/>
          <div style="font-size:13px;color:#667085"><strong style="color:#14161a">${contractorName}</strong><br/>${contractorPhone ? contractorPhone + '<br/>' : ''}</div>
          <p style="color:#aaa;font-size:11px;margin:20px 0 0">Powered by Punchlist</p>
        </div>`,
      }),
    });
    if (!emailRes.ok) return res.status(500).json({ error: 'Failed to send AWR email' });
    return res.status(200).json({ ok: true });
  }

  // ── Follow-up email: branded reminder for quotes that haven't been acted on ──
  if (body.action === 'follow_up') {
    const { customerEmail, customerName, contractorName, contractorPhone, contractorEmail: cEmail,
            quoteTitle, total, shareToken, country } = body;
    if (!customerEmail) return res.status(400).json({ error: 'Missing customerEmail' });
    const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || 'https://punchlist.ca';
    const quoteUrl = shareToken ? `${appUrl}/public/${shareToken}` : '';
    const fmt = (n) => formatCurrency(n, country);
    const firstName = (customerName || '').split(' ')[0];

    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${contractorName || 'Your contractor'} via Punchlist <quotes@punchlist.ca>`,
          to: customerEmail,
          reply_to: cEmail || undefined,
          subject: `Following up: ${quoteTitle || 'your quote'}${total ? ' — ' + fmt(total) : ''}`,
          html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
            <p style="color:#344054;font-size:15px;line-height:1.6;margin:0 0 16px">Hi${firstName ? ' ' + firstName : ''},</p>
            <p style="color:#344054;font-size:15px;line-height:1.6;margin:0 0 16px">Just checking in on the quote${quoteTitle ? ' for <strong>' + quoteTitle + '</strong>' : ''} I sent over. Happy to answer any questions or walk through the scope together.</p>
            ${quoteUrl ? `<div style="text-align:center;margin:24px 0"><a href="${quoteUrl}" style="display:inline-block;padding:14px 32px;background:#E76A3C;color:#fff;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none">Review Quote${total ? ' — ' + fmt(total) : ''}</a></div>` : ''}
            <p style="color:#667085;font-size:13px;line-height:1.6;margin:0 0 8px">From that link you can approve, request changes, or ask any questions.</p>
            ${contractorPhone ? `<p style="color:#667085;font-size:13px;line-height:1.6;margin:0">Or call/text me at <a href="tel:${contractorPhone}" style="color:#E76A3C;font-weight:600">${contractorPhone}</a></p>` : ''}
            <p style="color:#344054;font-size:15px;line-height:1.6;margin:24px 0 0">Thanks,<br/>${contractorName || ''}</p>
            <hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px"/>
            <p style="color:#98a2b3;font-size:11px;text-align:center">Sent via <a href="https://punchlist.ca" style="color:#98a2b3">Punchlist</a></p>
          </div>`,
        }),
      });
      if (!emailRes.ok) {
        const err = await emailRes.json().catch(() => ({}));
        console.error('[send-quote-email] follow_up failed:', err);
        return res.status(500).json({ error: 'Failed to send follow-up email' });
      }
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[send-quote-email] follow_up error:', err);
      return res.status(500).json({ error: 'Follow-up email failed' });
    }
  }

  if (body.action === 'send_amendment') {
    const { customerEmail, customerName, contractorName, contractorPhone,
            title, total, reason, shareToken, country } = body;
    if (!customerEmail) return res.status(400).json({ error: 'Missing customerEmail' });
    const appUrl = process.env.APP_URL || 'https://punchlist.ca';
    const amendmentUrl = shareToken ? `${appUrl}/public/amendment/${shareToken}` : '';
    const fmt = (n) => {
      const num = Number(n || 0);
      if (country === 'US') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
      return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(num);
    };
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'notifications@punchlist.ca',
        to: [customerEmail],
        subject: `Quote amendment: ${title}`,
        html: `<div style="font-family:Inter,-apple-system,Arial,sans-serif;max-width:540px;margin:0 auto;padding:32px 24px;color:#14161a">
          <p style="color:#3b82f6;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:11px;margin:0 0 8px">Amendment</p>
          <h1 style="font-size:22px;margin:0 0 12px;letter-spacing:-.03em">Your quote has been amended</h1>
          <p style="color:#667085;margin-bottom:24px;line-height:1.6">
            <strong style="color:#14161a">${contractorName || 'Your contractor'}</strong> has proposed an amendment to your original quote that requires your signature.
            ${reason ? `<br/><br/><em>${reason}</em>` : ''}
          </p>
          <div style="background:#f8f7f4;border-radius:12px;padding:20px;margin-bottom:24px">
            <div style="font-size:16px;font-weight:700;margin-bottom:8px">${title}</div>
            <div style="display:flex;justify-content:space-between;border-top:1px solid #e8e6e1;padding-top:12px;margin-top:8px">
              <span style="font-size:13px;color:#667085">Amendment total</span>
              <strong>${fmt(total)}</strong>
            </div>
          </div>
          ${amendmentUrl ? `<div style="margin-bottom:24px"><a href="${amendmentUrl}" style="display:inline-block;background:#f97316;color:white;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:700">Review and sign →</a></div>` : ''}
          <hr style="border:none;border-top:1px solid #e8e6e1;margin:0 0 20px"/>
          <div style="font-size:13px;color:#667085"><strong style="color:#14161a">${contractorName}</strong><br/>${contractorPhone ? contractorPhone + '<br/>' : ''}</div>
          <p style="color:#aaa;font-size:11px;margin:20px 0 0">Powered by Punchlist</p>
        </div>`,
      }),
    });
    if (!emailRes.ok) return res.status(500).json({ error: 'Failed to send amendment email' });
    return res.status(200).json({ ok: true });
  }

  const { quoteId, to } = body;
  if (!quoteId || !to) return res.status(400).json({ error: 'Missing quoteId or recipient' });

  try {
    const { data: quote, error } = await supabase
      .from('quotes')
      .select('*, customer:customers(*), line_items(*)')
      .eq('id', quoteId)
      .maybeSingle();

    if (error || !quote) return res.status(404).json({ error: 'Quote not found' });

    // Auth check: verify the request comes from the quote owner via Supabase JWT
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const token = authHeader.slice(7);
    const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authUser || authUser.id !== quote.user_id) {
      return res.status(403).json({ error: 'Not authorized to send this quote' });
    }

    // Fetch contractor profile separately (wildcard — never fails)
    let contractor = null;
    if (quote.user_id) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', quote.user_id).maybeSingle();
      contractor = p;
    }

    // ── Server-side free plan limit enforcement ──
    // Only check for free-plan users sending a quote for the first time (status not already 'sent')
    const plan = contractor?.subscription_plan || 'free';
    const isPro = ['pro', 'pro_monthly', 'pro_annual', 'yearly', 'monthly'].includes(plan);
    if (!isPro && quote.status !== 'sent') {
      const FREE_LIMIT = 5;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count: sentCount, error: countErr } = await supabase
        .from('quotes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', quote.user_id)
        .in('status', ['sent', 'viewed', 'approved', 'approved_pending_deposit', 'scheduled', 'completed', 'invoiced', 'paid'])
        .gte('sent_at', monthStart);
      if (!countErr && sentCount >= FREE_LIMIT) {
        return res.status(403).json({ error: 'limit_reached', used: sentCount, limit: FREE_LIMIT });
      }
    }

    // Determine country for currency formatting
    const country = contractor?.country || quote.country || 'CA';
    const fmt = (n) => formatCurrency(n, country);

    const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || 'https://punchlist.ca';
    const shareUrl = `${appUrl}/public/${quote.share_token}`;
    const contractorName = contractor?.company_name || contractor?.full_name || 'Your contractor';
    const contractorPhone = contractor?.phone || '';

    const includedItems = (quote.line_items || [])
      .filter(i => i.included !== false)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    const optionalItems = (quote.line_items || [])
      .filter(i => i.included === false)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    // Group items by category for professional presentation
    const groupOrder = ['Labour', 'Materials', 'Services'];
    const groups = {};
    includedItems.forEach(item => {
      const key = item.category || 'Scope of Work';
      groups[key] = groups[key] || [];
      groups[key].push(item);
    });
    const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
      const ai = groupOrder.indexOf(a); const bi = groupOrder.indexOf(b);
      if (ai >= 0 && bi >= 0) return ai - bi; if (ai >= 0) return -1; if (bi >= 0) return 1;
      return a.localeCompare(b);
    });
    const showGroups = sortedGroupKeys.length > 1;

    const lineItemsHtml = sortedGroupKeys.map(category => {
      const items = groups[category];
      const groupTotal = items.reduce((s, i) => s + (Number(i.quantity || 1) * Number(i.unit_price || 0)), 0);
      return `
        ${showGroups ? `
          <tr>
            <td colspan="3" style="padding:18px 0 6px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#ea580c;border-bottom:2px solid #fed7aa">
              ${category}
            </td>
          </tr>
        ` : ''}
        ${items.map(item => `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f0efec">
              <div style="font-weight:600;color:#18181b">${item.name}</div>
              ${item.notes ? `<div style="color:#71717a;font-size:12px;margin-top:3px;font-style:italic">${item.notes}</div>` : ''}
            </td>
            <td style="padding:10px 0;border-bottom:1px solid #f0efec;text-align:right;white-space:nowrap;vertical-align:top;color:#71717a;font-size:13px">${item.quantity > 1 ? `${item.quantity} × ${fmt(item.unit_price)}` : ''}</td>
            <td style="padding:10px 0;border-bottom:1px solid #f0efec;text-align:right;white-space:nowrap;vertical-align:top;font-weight:700;color:#18181b">${fmt(item.quantity * item.unit_price)}</td>
          </tr>
        `).join('')}
        ${showGroups ? `
          <tr>
            <td colspan="2" style="padding:6px 0 14px;text-align:right;font-size:12px;color:#71717a">${category} subtotal</td>
            <td style="padding:6px 0 14px;text-align:right;font-size:13px;font-weight:700;color:#3f3f46">${fmt(groupTotal)}</td>
          </tr>
        ` : ''}
      `;
    }).join('');

    const optionalHtml = optionalItems.length ? `
      <tr>
        <td colspan="3" style="padding:20px 0 8px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#71717a;border-bottom:1px dashed #e4e4e7">
          Optional Add-ons
        </td>
      </tr>
      ${optionalItems.map(item => `
        <tr>
          <td style="padding:8px 0;color:#71717a">${item.name}</td>
          <td style="padding:8px 0;text-align:right;color:#71717a;font-size:13px">${item.quantity > 1 ? `${item.quantity} × ${fmt(item.unit_price)}` : ''}</td>
          <td style="padding:8px 0;text-align:right;color:#71717a;font-weight:600">${fmt((item.quantity || 1) * item.unit_price)}</td>
        </tr>
      `).join('')}
    ` : '';

    const depositHtml = quote.deposit_required && Number(quote.deposit_amount) > 0 ? `
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px;margin-top:20px">
        <div style="font-weight:700;font-size:14px;color:#92400e;margin-bottom:4px">Deposit to confirm: ${fmt(quote.deposit_amount)}</div>
        <div style="color:#a16207;font-size:13px;line-height:1.5">Pay the deposit when you approve the quote. Work begins after deposit is received.</div>
      </div>
    ` : '';

    const revisionBanner = quote.revision_summary ? `
      <div style="background:#fff7ed;border-left:3px solid #ea580c;padding:14px 16px;margin-bottom:20px;border-radius:0 8px 8px 0">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#ea580c;margin-bottom:4px">Revised</div>
        <div style="font-size:14px;color:#3f3f46;line-height:1.5">${quote.revision_summary}</div>
      </div>
    ` : '';

    const expiryHtml = quote.expires_at ? `<p style="color:#71717a;font-size:13px;margin-top:16px">This quote is valid until <strong style="color:#18181b">${new Date(quote.expires_at).toLocaleDateString(country === 'US' ? 'en-US' : 'en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>.</p>` : '';

    const logoHtml = contractor?.logo_url
      ? `<img src="${contractor.logo_url}" alt="${contractorName}" style="max-height:48px;max-width:180px;object-fit:contain;margin-bottom:16px" />`
      : '';

    const customerName = quote.customer?.name || '';
    const firstName = customerName.split(' ')[0] || '';

    const emailHtml = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',sans-serif;max-width:640px;margin:0 auto;color:#18181b;background:#ffffff">
        <!-- Header -->
        <div style="padding:32px 28px 24px;border-bottom:1px solid #f0efec">
          ${logoHtml}
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#ea580c;margin-bottom:8px">Quote${quote.quote_number ? ` ${quote.quote_number.toString().padStart(4,'0')}` : ''}</div>
          <h1 style="font-size:clamp(22px,4vw,28px);line-height:1.15;margin:0 0 8px;letter-spacing:-.03em;color:#18181b">${quote.title}</h1>
          ${customerName ? `<p style="font-size:15px;color:#3f3f46;margin:0">Prepared for <strong style="color:#18181b">${customerName}</strong></p>` : ''}
        </div>

        <!-- Meta -->
        <div style="padding:16px 28px;display:flex;gap:24px;flex-wrap:wrap;border-bottom:1px solid #f0efec;font-size:13px">
          <div><span style="color:#71717a">From</span><br><strong>${contractorName}</strong></div>
          <div><span style="color:#71717a">Date</span><br><strong>${new Date(quote.created_at).toLocaleDateString(country === 'US' ? 'en-US' : 'en-CA', { year:'numeric', month:'long', day:'numeric' })}</strong></div>
          ${quote.expires_at ? `<div><span style="color:#71717a">Valid until</span><br><strong>${new Date(quote.expires_at).toLocaleDateString(country === 'US' ? 'en-US' : 'en-CA', { month:'long', day:'numeric' })}</strong></div>` : ''}
        </div>

        ${revisionBanner ? `<div style="padding:20px 28px 0">${revisionBanner}</div>` : ''}

        <!-- Scope -->
        ${quote.scope_summary ? `
          <div style="padding:24px 28px 0">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#71717a;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #f4f4f5">Scope of Work</div>
            <p style="font-size:14px;color:#3f3f46;line-height:1.65;margin:0">${quote.scope_summary}</p>
          </div>
        ` : ''}

        <!-- Line Items -->
        <div style="padding:24px 28px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#71717a;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #f4f4f5">Work Breakdown</div>
          <table style="width:100%;border-collapse:collapse">
            ${lineItemsHtml}
            ${optionalHtml}
          </table>
        </div>

        <!-- Totals -->
        <div style="padding:0 28px 24px">
          <div style="background:#fafaf9;border-radius:10px;padding:16px 20px;margin-left:auto;max-width:300px">
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;color:#3f3f46"><span>Subtotal</span><strong>${fmt(quote.subtotal || quote.total)}</strong></div>
            ${Number(quote.discount) > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;color:#16a34a"><span>Discount</span><strong>−${fmt(quote.discount)}</strong></div>` : ''}
            ${Number(quote.tax) > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;color:#3f3f46"><span>Tax</span><strong>${fmt(quote.tax)}</strong></div>` : ''}
            <div style="display:flex;justify-content:space-between;padding:12px 0 4px;margin-top:8px;border-top:2px solid #ea580c;font-size:20px;font-weight:800;letter-spacing:-.02em">
              <span style="color:#18181b">Total</span><span style="color:#ea580c">${fmt(quote.total)}</span>
            </div>
          </div>
        </div>

        ${depositHtml ? `<div style="padding:0 28px 24px">${depositHtml}</div>` : ''}
        ${expiryHtml ? `<div style="padding:0 28px">${expiryHtml}</div>` : ''}

        ${(contractor?.payment_methods?.length || contractor?.payment_instructions) ? `
          <div style="padding:0 28px 16px">
            <div style="background:#fafaf9;border:1px solid #f0efec;border-radius:10px;padding:14px 16px">
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#71717a;margin-bottom:6px">Payment Methods</div>
              ${Array.isArray(contractor.payment_methods) && contractor.payment_methods.length ? `<div style="color:#3f3f46;font-size:13px">${contractor.payment_methods.join(' · ')}</div>` : ''}
              ${contractor.payment_instructions ? `<div style="color:#71717a;font-size:12px;margin-top:6px;line-height:1.5">${contractor.payment_instructions}</div>` : ''}
              ${contractor.etransfer_email ? `<div style="color:#71717a;font-size:12px;margin-top:4px">E-Transfer: <strong style="color:#3f3f46">${contractor.etransfer_email}</strong></div>` : ''}
            </div>
          </div>
        ` : ''}

        <!-- CTA -->
        <div style="padding:12px 28px 28px;text-align:center">
          <a href="${shareUrl}" style="display:inline-block;background:#ea580c;color:#ffffff;padding:16px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;letter-spacing:-.01em">
            Review & Approve Quote →
          </a>
          <p style="color:#71717a;font-size:13px;margin:16px 0 0;line-height:1.6">
            Review the full scope, ask questions, or approve — all from the link above.
            ${contractorPhone ? `<br>Questions? Call <a href="tel:${contractorPhone}" style="color:#ea580c;font-weight:600;text-decoration:none">${contractorPhone}</a>.` : ''}
          </p>
        </div>

        <!-- Footer -->
        <div style="border-top:1px solid #f0efec;padding:20px 28px;text-align:center">
          <div style="font-size:13px;color:#3f3f46;font-weight:600">${contractorName}</div>
          ${contractorPhone ? `<div style="font-size:12px;color:#71717a;margin-top:2px">${contractorPhone}</div>` : ''}
          ${contractor?.email ? `<div style="font-size:12px;color:#71717a;margin-top:2px">${contractor.email}</div>` : ''}
          <div style="font-size:11px;color:#a1a1aa;margin-top:12px">Powered by <a href="https://punchlist.ca" style="color:#a1a1aa;text-decoration:none">Punchlist</a></div>
        </div>
      </div>
    `;

    // Plain text fallback for better deliverability
    const plainTextItems = sortedGroupKeys.map(cat => {
      const items = groups[cat];
      const lines = items.map(i => `  • ${i.name} — ${fmt((i.quantity||1) * (i.unit_price||0))}`).join('\n');
      return showGroups ? `${cat.toUpperCase()}\n${lines}` : lines;
    }).join('\n\n');

    const plainText = [
      `QUOTE${quote.quote_number ? ' #' + quote.quote_number.toString().padStart(4,'0') : ''} FROM ${contractorName.toUpperCase()}`,
      `${quote.title}`,
      customerName ? `Prepared for ${customerName}` : '',
      '',
      quote.scope_summary || '',
      '',
      'WORK BREAKDOWN',
      plainTextItems,
      '',
      `Subtotal: ${fmt(quote.subtotal || quote.total)}`,
      Number(quote.tax) > 0 ? `Tax: ${fmt(quote.tax)}` : '',
      `TOTAL: ${fmt(quote.total)}`,
      '',
      `Review and approve: ${shareUrl}`,
      '',
      contractorName,
      contractorPhone || '',
      contractor?.email || '',
    ].filter(l => l !== '').join('\n');

    const subject = quote.revision_summary
      ? `Updated quote: ${quote.title}`
      : `Quote: ${quote.title}`;

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'quotes@punchlist.ca',
        reply_to: contractor?.email || undefined,
        to: [to],
        subject,
        html: emailHtml,
        text: plainText,
      }),
    });

    const data = await emailResponse.json();
    if (!emailResponse.ok) return res.status(500).json({ error: data.message || 'Unable to send email' });

    // ── H4: atomic status update ──
    // The email was delivered (Resend returned 200). Transition the quote to
    // 'sent' server-side, using a status-whitelist predicate so replays and
    // concurrent requests can't regress an already-approved/scheduled quote.
    // Mirrors the A3 pattern used in public-quote-action.js.
    //
    // This is intentionally fire-and-forget on failure: if the status update
    // fails, the email has already gone out and the client can reconcile on
    // next load. We still log so ops can spot systemic issues.
    let nextStatus = quote.status;
    let nextSentAt = quote.sent_at;
    try {
      const { data: updated, error: upErr } = await supabase
        .from('quotes')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', quoteId)
        .in('status', ['draft', 'sent', 'viewed'])
        .select('status, sent_at')
        .maybeSingle();
      if (upErr) {
        console.warn('[send-quote-email] status update error:', upErr.message);
      } else if (updated) {
        nextStatus = updated.status;
        nextSentAt = updated.sent_at;
      }
      // If updated is null, the predicate matched 0 rows — quote has moved past
      // 'viewed' (approved / scheduled / completed etc). That's expected for
      // re-sends against a closed quote; we don't regress status.
    } catch (e) {
      console.warn('[send-quote-email] status update threw:', e?.message);
    }

    return res.status(200).json({ success: true, status: nextStatus, sent_at: nextSentAt });
  } catch (err) {
    console.error('[send-quote-email] Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// ── Demo quote email — sends a real quote preview to the visitor's email ──
// This captures the lead email and shows them what their customers would receive.
async function handleDemoQuoteEmail(req, res, body) {
  // Tight rate limit: 3/hour per IP
  if (blocked(res, `demo:${getClientIp(req)}`, 3, 3600_000)) return;

  const { email, trade, description, items, total } = body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
  if (!items?.length) return res.status(400).json({ error: 'No items' });

  const fmt = (n) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(Number(n || 0));
  const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || 'https://punchlist.ca';

  const itemRows = items.slice(0, 10).map(i =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px">${i.name}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:right;font-weight:700">${fmt(i.unit_price || i.price)}</td></tr>`
  ).join('');

  const html = `
    <div style="font-family:Inter,-apple-system,Arial,sans-serif;max-width:540px;margin:0 auto;padding:32px 24px;color:#14161a">
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#e76a3c;margin-bottom:8px">Quote Preview</div>
        <h1 style="margin:0;font-size:24px;letter-spacing:-.03em">Here's your sample quote</h1>
        <p style="color:#667085;margin:8px 0 0;font-size:14px">This is what your customers would receive when you send a quote with Punchlist.</p>
      </div>

      <div style="background:#fafafa;border:1px solid #e8e6e1;border-radius:12px;overflow:hidden;margin-bottom:24px">
        <div style="padding:14px 16px;border-bottom:1px solid #e8e6e1;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:12px;font-weight:800;color:#14161a">Your Business Name</div>
            <div style="font-size:11px;color:#667085;margin-top:2px">${trade || 'Contractor'}</div>
          </div>
          <div style="font-size:10px;font-weight:700;color:#138a5b;background:#f0fdf4;border:1px solid #bbf7d0;padding:3px 10px;border-radius:20px">Quote</div>
        </div>
        ${description ? `<div style="padding:10px 16px;font-size:12px;color:#667085;border-bottom:1px solid #e8e6e1;font-style:italic">${description.slice(0, 120)}${description.length > 120 ? '…' : ''}</div>` : ''}
        <table style="width:100%;border-collapse:collapse">
          ${itemRows}
        </table>
        <div style="padding:14px 16px;background:#f5f4f1;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:14px;font-weight:800">Quote Total</span>
          <span style="font-size:18px;font-weight:800;color:#14161a">${fmt(total)}</span>
        </div>
        <div style="padding:12px 16px;text-align:center">
          <div style="display:inline-block;padding:12px 32px;background:linear-gradient(180deg,#15a065,#138a5b);color:#fff;font-size:14px;font-weight:700;border-radius:10px">✓ Approve & Sign</div>
          <div style="font-size:11px;color:#999;margin-top:8px">Your customers approve and sign right from their phone.</div>
        </div>
      </div>

      <div style="text-align:center;padding:20px 0;border-top:1px solid #e8e6e1">
        <p style="font-size:14px;color:#344054;font-weight:600;margin:0 0 12px">Ready to send quotes like this?</p>
        <a href="${appUrl}/signup" style="display:inline-block;padding:14px 32px;background:linear-gradient(180deg,#ed7648,#e76a3c);color:#fff;font-size:15px;font-weight:700;border-radius:10px;text-decoration:none;box-shadow:0 4px 14px rgba(231,106,60,.2)">Create free account →</a>
        <p style="font-size:12px;color:#999;margin:12px 0 0">No credit card · 5 free quotes/month · Takes 30 seconds</p>
      </div>

      <div style="font-size:11px;color:#aaa;text-align:center;margin-top:16px">
        Sent by <a href="${appUrl}" style="color:#e76a3c;text-decoration:none;font-weight:600">Punchlist</a> · Quote-to-cash for trades contractors
      </div>
    </div>
  `;

  try {
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'notifications@punchlist.ca',
        to: [email],
        subject: `Your sample quote — ${fmt(total)} · Punchlist`,
        html,
      }),
    });

    if (!emailResponse.ok) {
      const d = await emailResponse.json();
      return res.status(500).json({ error: d.message || 'Unable to send' });
    }

    // Store the lead email for follow-up (fire-and-forget)
    const supabase = getSupabase();
    if (supabase) {
      supabase.from('demo_leads').insert({
        email,
        trade: trade || null,
        description: (description || '').slice(0, 200),
        total: Number(total || 0),
        item_count: items.length,
        ip: getClientIp(req),
        created_at: new Date().toISOString(),
      }).then(() => {}).catch(() => {});
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[demo-quote-email] Error:', err?.message);
    return res.status(500).json({ error: 'Could not send email' });
  }
}
