import { createClient } from '@supabase/supabase-js';
import { blocked, getClientIp } from './_rate-limit.js';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing database configuration');
  return createClient(url, key);
}

async function notifyContractorAmendment({ contractorEmail, contractorName, customerName, quoteTitle, amendmentTitle, action, appUrl, quoteId }) {
  if (!process.env.RESEND_API_KEY || !contractorEmail) return;

  const actionMap = {
    approved: {
      subject: `✓ Amendment approved: ${amendmentTitle}`,
      headline: `${customerName || 'Your customer'} approved the amendment`,
      body: `The amendment "${amendmentTitle}" for ${quoteTitle} has been signed and approved.`,
      cta: 'View quote', ctaColor: '#15803d',
    },
    declined: {
      subject: `Amendment declined: ${amendmentTitle}`,
      headline: `${customerName || 'Your customer'} declined the amendment`,
      body: `The amendment "${amendmentTitle}" for ${quoteTitle} was declined. The original scope is unchanged.`,
      cta: 'View quote', ctaColor: '#667085',
    },
  };

  const info = actionMap[action];
  if (!info) return;

  const quoteUrl = `${appUrl}/app/quotes/${quoteId}`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'notifications@punchlist.ca',
      to: [contractorEmail],
      subject: info.subject,
      html: `
        <div style="font-family:Inter,-apple-system,Arial,sans-serif;max-width:540px;margin:0 auto;padding:32px 24px;color:#14161a">
          <p style="color:#f97316;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:11px;margin:0 0 8px">Punchlist notification</p>
          <h1 style="font-size:22px;margin:0 0 12px;letter-spacing:-.03em">${info.headline}</h1>
          <p style="color:#667085;margin-bottom:24px;line-height:1.6">${info.body}</p>
          <a href="${quoteUrl}" style="display:inline-block;background:${info.ctaColor};color:white;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:700">${info.cta} →</a>
          <hr style="border:none;border-top:1px solid #e8e6e1;margin:28px 0">
          <p style="color:#aaa;font-size:11px;margin:0">Punchlist · ${contractorName || 'Your workspace'}</p>
        </div>
      `,
    }),
  }).catch(() => {});
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Rate limit: 60/min for GETs, 10/min for mutations (approve/decline)
  const rlIp = getClientIp(req);
  if (req.method === 'POST') {
    if (blocked(res, `pam:mut:${rlIp}`, 10, 60_000)) return;
  } else {
    if (blocked(res, `pam:get:${rlIp}`, 60, 60_000)) return;
  }

  let supabase;
  try {
    supabase = getSupabase();
  } catch (e) {
    console.error('[public-amendment] Config error:', e.message);
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // GET — fetch amendment by share_token for public page
  if (req.method === 'GET') {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Missing share token' });

    try {
      // Fetch amendment
      const { data: amendment, error: aErr } = await supabase
        .from('amendments')
        .select('*')
        .eq('share_token', token)
        .maybeSingle();

      if (aErr) {
        console.error('[public-amendment] Amendment query error:', aErr.message);
        return res.status(500).json({ error: 'Database error' });
      }
      if (!amendment) return res.status(404).json({ error: 'Amendment not found' });

      // Fetch the original quote with line items
      const { data: quote, error: qErr } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', amendment.quote_id)
        .maybeSingle();

      if (qErr || !quote) return res.status(404).json({ error: 'Original quote not found' });

      // Fetch line items
      let lineItems = [];
      try {
        const { data: items } = await supabase
          .from('line_items')
          .select('*')
          .eq('quote_id', quote.id)
          .order('sort_order', { ascending: true });
        lineItems = items || [];
      } catch {}

      // Fetch customer
      let customer = null;
      if (quote.customer_id) {
        const { data: cust } = await supabase
          .from('customers')
          .select('*')
          .eq('id', quote.customer_id)
          .maybeSingle();
        customer = cust;
      }

      // Fetch contractor profile
      let contractor = null;
      if (quote.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', quote.user_id)
          .maybeSingle();
        contractor = profile;
      }

      return res.status(200).json({
        amendment: {
          id: amendment.id,
          title: amendment.title || 'Amendment',
          reason: amendment.reason || '',
          status: amendment.status,
          items: amendment.items || [],
          subtotal: Number(amendment.subtotal) || 0,
          tax: Number(amendment.tax) || 0,
          total: Number(amendment.total) || 0,
          share_token: amendment.share_token,
          signature_data: amendment.signature_data || null,
          signed_at: amendment.signed_at || null,
          signer_name: amendment.signer_name || null,
          created_at: amendment.created_at,
          province: amendment.province || 'ON',
          country: amendment.country || 'CA',
        },
        quote: {
          id: quote.id,
          title: quote.title || '',
          scope_summary: quote.scope_summary || '',
          status: quote.status,
          subtotal: Number(quote.subtotal) || 0,
          tax: Number(quote.tax) || 0,
          total: Number(quote.total) || 0,
          discount: Number(quote.discount) || 0,
          trade: quote.trade || '',
          province: quote.province || '',
          country: quote.country || 'CA',
          created_at: quote.created_at,
          signature_data: quote.signature_data || null,
          signed_at: quote.signed_at || null,
          signer_name: quote.signer_name || null,
          line_items: lineItems,
        },
        customer_name: customer?.name || null,
        contractor_name: contractor?.full_name || contractor?.company_name || null,
        contractor_company: contractor?.company_name || contractor?.full_name || null,
        contractor_phone: contractor?.phone || null,
        contractor_email: contractor?.email || null,
        contractor_logo: contractor?.logo_url || null,
      });
    } catch (err) {
      console.error('[public-amendment] GET error:', err.message);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // POST — approve or decline amendment
  if (req.method === 'POST') {
    const { token, action, signature_data, signer_name } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Missing token' });
    if (!action || !['approve', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    try {
      const { data: amendment, error: aErr } = await supabase
        .from('amendments')
        .select('*')
        .eq('share_token', token)
        .maybeSingle();

      if (aErr || !amendment) return res.status(404).json({ error: 'Amendment not found' });

      // Prevent double-action
      if (['approved', 'declined'].includes(amendment.status)) {
        return res.status(400).json({ error: `Amendment already ${amendment.status}` });
      }

      // Fetch quote and contractor for notifications
      const { data: quote } = await supabase.from('quotes').select('*, customer:customers(*)').eq('id', amendment.quote_id).maybeSingle();
      let contractor = null;
      if (amendment.user_id) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', amendment.user_id).maybeSingle();
        contractor = p;
      }

      const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || 'https://punchlist.ca';

      if (action === 'approve') {
        if (!signature_data) return res.status(400).json({ error: 'Signature required' });
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';

        const { error: ue } = await supabase.from('amendments').update({
          status: 'approved',
          signature_data,
          signer_name: signer_name || '',
          signed_at: new Date().toISOString(),
          signer_ip: ip,
        }).eq('id', amendment.id);

        if (ue) throw ue;

        await notifyContractorAmendment({
          contractorEmail: contractor?.email,
          contractorName: contractor?.full_name,
          customerName: quote?.customer?.name,
          quoteTitle: quote?.title || 'Quote',
          amendmentTitle: amendment.title,
          action: 'approved',
          appUrl,
          quoteId: amendment.quote_id,
        });

        return res.status(200).json({ status: 'approved' });
      }

      if (action === 'decline') {
        const { error: ue } = await supabase.from('amendments').update({
          status: 'declined',
        }).eq('id', amendment.id);

        if (ue) throw ue;

        await notifyContractorAmendment({
          contractorEmail: contractor?.email,
          contractorName: contractor?.full_name,
          customerName: quote?.customer?.name,
          quoteTitle: quote?.title || 'Quote',
          amendmentTitle: amendment.title,
          action: 'declined',
          appUrl,
          quoteId: amendment.quote_id,
        });

        return res.status(200).json({ status: 'declined' });
      }
    } catch (err) {
      console.error('[public-amendment] POST error:', err.message);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
