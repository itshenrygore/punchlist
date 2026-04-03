import { createClient } from '@supabase/supabase-js';
import { blocked, getClientIp } from './_rate-limit.js';

// Defensive Supabase client factory — never created at module level
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function notifyContractor({ contractorEmail, contractorName, customerName, title, action, feedback, appUrl, quoteId }) {
  if (!process.env.RESEND_API_KEY || !contractorEmail) return;
  const actionMap = {
    approved: { subject: `✓ Additional work approved: ${title}`, headline: `${customerName || 'Your customer'} approved the additional work`, body: 'The additional work has been approved. You can proceed.', cta: 'View quote', ctaColor: '#15803d' },
    needs_review: { subject: `Question about additional work: ${title}`, headline: `${customerName || 'Your customer'} has a question`, body: feedback ? `"${feedback}"` : 'They left a question about the additional work.', cta: 'View & respond', ctaColor: '#2563eb' },
    declined: { subject: `Additional work declined: ${title}`, headline: `${customerName || 'Your customer'} declined the additional work`, body: feedback ? `Their reason: "${feedback}"` : 'No reason given.', cta: 'View quote', ctaColor: '#667085' },
  };
  const info = actionMap[action];
  if (!info) return;
  const quoteUrl = `${appUrl}/app/quotes/${quoteId}`;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'notifications@punchlist.ca', to: [contractorEmail], subject: info.subject,
      html: `<div style="font-family:Inter,-apple-system,Arial,sans-serif;max-width:540px;margin:0 auto;padding:32px 24px;color:#14161a"><p style="color:#f97316;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:11px;margin:0 0 8px">Punchlist notification</p><h1 style="font-size:22px;margin:0 0 12px;letter-spacing:-.03em">${info.headline}</h1><p style="color:#667085;margin-bottom:24px;line-height:1.6">${info.body}</p><a href="${quoteUrl}" style="display:inline-block;background:${info.ctaColor};color:white;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:700">${info.cta} →</a><hr style="border:none;border-top:1px solid #e8e6e1;margin:28px 0"><p style="color:#aaa;font-size:11px;margin:0">Punchlist · ${contractorName || 'Your workspace'}</p></div>`,
    }),
  }).catch(() => {});
}

// Phase 4B: Create in-app notification alongside email
async function createInAppNotification(supabase, { userId, type, title, body, link }) {
  if (!userId || !supabase) return;
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
    console.warn('[public-additional-work] Notification insert failed:', err?.message);
  }
}

async function handleGet(req, res) {
  if (blocked(res, `paw:${getClientIp(req)}`, 60, 60_000)) return;
  
  const supabase = getSupabase();
  if (!supabase) {
    console.error('[public-additional-work] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({ error: 'Database not configured' });
  }

  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Missing share token' });
  try {
    const { data: awr, error } = await supabase.from('additional_work_requests')
      .select('*, customer:customers(*), quote:quotes(title, total, share_token, trade, user_id), additional_work_items(*)')
      .eq('share_token', token).maybeSingle();
    if (error || !awr) return res.status(404).json({ error: 'Request not found or link has expired' });
    let contractor = null;
    if (awr.quote?.user_id) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', awr.quote.user_id).maybeSingle();
      contractor = profile;
    }
    const sortedItems = [...(awr.additional_work_items || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    if (awr.status === 'sent') { supabase.from('additional_work_requests').update({ status: 'viewed', viewed_at: new Date().toISOString() }).eq('id', awr.id).then(() => {}).catch(() => {}); }
    return res.status(200).json({ request: { ...awr, additional_work_items: sortedItems, country: contractor?.country || awr.country || 'CA', customer_name: awr.customer?.name || null, contractor_name: contractor?.full_name || contractor?.company_name || null, contractor_company: contractor?.company_name || null, contractor_phone: contractor?.phone || null, original_quote_title: awr.quote?.title || null, original_quote_total: awr.quote?.total || null, original_quote_token: awr.quote?.share_token || null } });
  } catch (err) { console.error('[public-additional-work] GET error:', err); return res.status(500).json({ error: 'Server error' }); }
}

async function handlePost(req, res) {
  const { token, action, feedback } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Missing token' });
  if (blocked(res, `pawa:${token}`, 20, 60_000)) return;
  
  const supabase = getSupabase();
  if (!supabase) {
    console.error('[public-additional-work] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    const { data: awr, error: fe } = await supabase.from('additional_work_requests').select('*, customer:customers(*)').eq('share_token', token).maybeSingle();
    if (fe || !awr) return res.status(404).json({ error: 'Request not found' });
    let contractorEmail = null, contractorName = null, customerName = awr.customer?.name;
    let contractorUserId = null;
    if (awr.quote_id) {
      const { data: q } = await supabase.from('quotes').select('user_id').eq('id', awr.quote_id).maybeSingle();
      if (q?.user_id) {
        contractorUserId = q.user_id;
        const { data: p } = await supabase.from('profiles').select('*').eq('id', q.user_id).maybeSingle();
        contractorEmail = p?.email; contractorName = p?.full_name;
      }
    }
    const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || 'https://punchlist.ca';
    const ce = contractorEmail, cn = contractorName, cusn = customerName;

    if (action === 'approve') {
      if (['approved', 'cancelled'].includes(awr.status)) return res.status(400).json({ error: 'Already processed' });
      const { data: u, error: ue } = await supabase.from('additional_work_requests').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', awr.id).select('status').single();
      if (ue) throw ue;
      await notifyContractor({ contractorEmail: ce, contractorName: cn, customerName: cusn, title: awr.title, action: 'approved', appUrl, quoteId: awr.quote_id });
      await createInAppNotification(supabase, { userId: contractorUserId, type: 'additional_work_approved', title: `Additional work approved: ${awr.title}`, body: `${cusn || 'Customer'} approved the additional work.`, link: `/app/quotes/${awr.quote_id}` });
      return res.status(200).json({ status: u.status });
    }
    if (action === 'question') {
      if (!feedback?.trim()) return res.status(400).json({ error: 'Message is required' });
      const { data: u, error: ue } = await supabase.from('additional_work_requests').update({ status: 'needs_review', customer_message: feedback }).eq('id', awr.id).select('status').single();
      if (ue) throw ue;
      await notifyContractor({ contractorEmail: ce, contractorName: cn, customerName: cusn, title: awr.title, action: 'needs_review', feedback, appUrl, quoteId: awr.quote_id });
      await createInAppNotification(supabase, { userId: contractorUserId, type: 'customer_question', title: `Question: ${awr.title}`, body: `${cusn || 'Customer'}: "${feedback.slice(0, 120)}"`, link: `/app/quotes/${awr.quote_id}` });
      return res.status(200).json({ status: u.status });
    }
    if (action === 'decline') {
      const { data: u, error: ue } = await supabase.from('additional_work_requests').update({ status: 'declined', declined_at: new Date().toISOString(), customer_message: feedback || null }).eq('id', awr.id).select('status').single();
      if (ue) throw ue;
      await notifyContractor({ contractorEmail: ce, contractorName: cn, customerName: cusn, title: awr.title, action: 'declined', feedback, appUrl, quoteId: awr.quote_id });
      await createInAppNotification(supabase, { userId: contractorUserId, type: 'additional_work_declined', title: `Additional work declined: ${awr.title}`, body: feedback ? `"${feedback.slice(0, 120)}"` : `${cusn || 'Customer'} declined.`, link: `/app/quotes/${awr.quote_id}` });
      return res.status(200).json({ status: u.status });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) { console.error('[public-additional-work] POST error:', err); return res.status(500).json({ error: 'Server error' }); }
}

export default async function handler(req, res) {
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}
