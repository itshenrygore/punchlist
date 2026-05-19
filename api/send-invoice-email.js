import { createClient } from './_supabase.js';
import { h, safeHeader } from './_escape.js';
import { blocked, getClientIp } from './_rate-limit.js';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || 'https://punchlist.ca';

function fmt(n, country = 'CA') {
  const num = Number(n || 0);
  if (country === 'US') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(num);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: 'Email service not configured' });
  if (blocked(res, `sie:${getClientIp(req)}`, 20, 60_000)) return;

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  // Auth: must be signed-in contractor
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.slice(7));
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

  const { invoiceId } = req.body || {};
  if (!invoiceId) return res.status(400).json({ error: 'Missing invoiceId' });

  try {
    // Fetch invoice (ownership enforced)
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('id, user_id, customer_id, quote_id, total, status, invoice_number, title, due_at, share_token, country, deposit_credited')
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (invErr || !invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (!invoice.share_token) return res.status(400).json({ error: 'Invoice has no share token' });

    // Fetch customer
    const { data: customer } = await supabase.from('customers').select('name, email, phone').eq('id', invoice.customer_id).maybeSingle();
    if (!customer?.email) return res.status(400).json({ error: 'Customer has no email address' });

    // Fetch contractor profile
    const { data: profile } = await supabase.from('profiles').select('company_name, full_name, phone, email, country').eq('id', user.id).maybeSingle();

    const country = invoice.country || profile?.country || 'CA';
    const contractorName = profile?.company_name || profile?.full_name || 'Your contractor';
    const depositCredited = Number(invoice.deposit_credited || 0);

    // Calculate balance (total minus deposit credit minus payments already recorded)
    const { data: payments } = await supabase.from('payments').select('amount').eq('invoice_id', invoiceId);
    const totalPaid = (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
    const invoiceBalance = Math.max(0, Number(invoice.total || 0) - depositCredited - totalPaid);

    const invoiceUrl = `${appUrl}/i/${invoice.share_token}`;
    const dueStr = invoice.due_at
      ? new Date(invoice.due_at).toLocaleDateString(country === 'US' ? 'en-US' : 'en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
      : '';
    const firstName = (customer.name || '').split(' ')[0] || '';

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'notifications@punchlist.ca',
        reply_to: profile?.email || undefined,
        to: [customer.email],
        subject: safeHeader(`Invoice from ${contractorName}: ${invoice.title || invoice.invoice_number}`),
        text: [
          `INVOICE FROM ${contractorName.toUpperCase()}`,
          invoice.title || invoice.invoice_number || 'Invoice',
          '',
          `Balance due: ${fmt(invoiceBalance, country)}`,
          dueStr ? `Due: ${dueStr}` : '',
          '',
          `View and pay: ${invoiceUrl}`,
          '',
          contractorName,
          profile?.phone || '',
          profile?.email || '',
        ].filter(Boolean).join('\n'),
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',sans-serif;max-width:540px;margin:0 auto;color:#18181b;background:#ffffff">
            <div style="padding:32px 28px 20px;border-bottom:1px solid #f0efec">
              <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#ea580c;background:#fff7ed;padding:4px 10px;border-radius:6px;display:inline-block;border:1px solid rgba(234,88,12,.15);margin-bottom:12px">Invoice</div>
              <h1 style="font-size:22px;margin:0 0 6px;letter-spacing:-.03em;color:#18181b">${invoice.title || invoice.invoice_number || 'Your invoice is ready'}</h1>
              <p style="font-size:14px;color:#3f3f46;margin:0">${firstName ? `Hi ${h(firstName)} — ` : ''}here's your invoice from <strong style="color:#18181b">${h(contractorName)}</strong>.</p>
            </div>
            <div style="padding:24px 28px">
              <div style="background:#fafaf9;border:1px solid #f0efec;border-radius:12px;padding:20px;display:grid;gap:12px">
                ${depositCredited > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:#71717a"><span>Deposit credited</span><strong style="color:#16a34a">−${fmt(depositCredited, country)}</strong></div>` : ''}
                <div style="display:flex;justify-content:space-between;align-items:baseline;${depositCredited > 0 ? 'padding-top:12px;border-top:1px solid #e4e4e7;' : ''}">
                  <span style="font-size:14px;color:#71717a;font-weight:500">Balance due</span>
                  <strong style="font-size:24px;font-weight:800;letter-spacing:-.02em;color:#18181b">${fmt(invoiceBalance, country)}</strong>
                </div>
                ${dueStr ? `<div style="font-size:13px;color:#71717a">Due <strong style="color:#18181b">${dueStr}</strong></div>` : ''}
              </div>
            </div>
            <div style="padding:0 28px 28px;text-align:center">
              <a href="${invoiceUrl}" style="display:inline-block;background:#ea580c;color:#ffffff;padding:16px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;box-shadow:0 2px 8px rgba(234,88,12,.2)">
                View &amp; Pay Invoice →
              </a>
            </div>
            <div style="border-top:1px solid #f0efec;padding:20px 28px;text-align:center">
              <div style="font-size:13px;color:#3f3f46;font-weight:600">${h(contractorName)}</div>
              ${profile?.phone ? `<div style="font-size:12px;color:#71717a;margin-top:2px">${profile.phone}</div>` : ''}
              ${profile?.email ? `<div style="font-size:12px;color:#71717a;margin-top:2px">${profile.email}</div>` : ''}
              <div style="font-size:11px;color:#a1a1aa;margin-top:12px">Powered by <a href="https://punchlist.ca" style="color:#a1a1aa;text-decoration:none">Punchlist</a></div>
            </div>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text().catch(() => '');
      console.error('[send-invoice-email] Resend error:', errText);
      return res.status(500).json({ error: 'Failed to send invoice email' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[send-invoice-email] error:', err?.message);
    return res.status(500).json({ error: err?.message || 'Email send failed' });
  }
}
