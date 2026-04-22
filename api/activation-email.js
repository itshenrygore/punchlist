import { createClient } from '@supabase/supabase-js';
import { blocked, getClientIp } from './_rate-limit.js';

/**
 * Activation Email Sequence
 * 
 * Called by the frontend on dashboard load (fire-and-forget).
 * Checks what emails the user has received and sends the next one in sequence.
 * 
 * Sequence:
 *   Day 0: Welcome — "Your first quote is ready to build" (if no quotes sent)
 *   Day 1: Social proof — "Here's what contractors are building"
 *   Day 3: Payments — "Your customers can pay monthly"
 *   Day 7: Progress OR re-engage based on activity
 *   Day 14: Upgrade nudge (only if active)
 * 
 * Stores: last_activation_email (int 0-5) and last_activation_email_at (timestamp)
 * in the profiles table.
 */

const SEQUENCE = [
  {
    id: 0,
    minDays: 0,
    subject: 'Your first quote is ready to build',
    condition: (profile, stats) => stats.sentQuotes === 0,
    html: (profile) => {
      const baseUrl = process.env.APP_URL || 'https://punchlist.ca';
      return emailWrap(`
      <h2 style="margin:0 0 12px;font-size:20px;font-weight:800;color:#1a1a19">Your first quote takes under 4 minutes</h2>
      <p style="color:#6b6b67;font-size:14px;line-height:1.7;margin:0 0 20px">
        Hi${profile.full_name ? ' ' + profile.full_name.split(' ')[0] : ''},
      </p>
      <p style="color:#6b6b67;font-size:14px;line-height:1.7;margin:0 0 20px">
        Describe the job. Punchlist builds the quote. Your customer approves and signs from their phone.
      </p>
      <a href="${baseUrl}/app/quotes/new" style="display:inline-block;background:#F97316;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Build your first quote →</a>
    `);
    },
  },
  {
    id: 1,
    minDays: 1,
    subject: 'Contractors are closing jobs faster with Punchlist',
    condition: () => true,
    html: (profile) => {
      const baseUrl = process.env.APP_URL || 'https://punchlist.ca';
      return emailWrap(`
      <h2 style="margin:0 0 12px;font-size:20px;font-weight:800;color:#1a1a19">What other contractors are seeing</h2>
      <p style="color:#6b6b67;font-size:14px;line-height:1.7;margin:0 0 16px">
        Hi${profile.full_name ? ' ' + profile.full_name.split(' ')[0] : ''},
      </p>
      <div style="background:#f8f7f5;border-radius:10px;padding:16px 20px;margin:0 0 16px">
        <p style="color:#3d3d3a;font-size:13px;line-height:1.7;margin:0;font-style:italic">
          "Sent a $5,200 panel quote from the job site. Customer approved and signed before I finished loading the van."
        </p>
        <p style="color:#9c9a92;font-size:12px;margin:6px 0 0">— Electrician, Edmonton</p>
      </div>
      <p style="color:#6b6b67;font-size:14px;line-height:1.7;margin:0 0 20px">
        The monthly payment option is what gets larger quotes approved. Your customer sees the total and a manageable monthly — you get paid in full.
      </p>
      <a href="${baseUrl}/app/quotes/new" style="display:inline-block;background:#F97316;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Try it on your next job →</a>
    `);
    },
  },
  {
    id: 2,
    minDays: 3,
    subject: 'Your customers can pay monthly — you get paid in full',
    condition: (profile) => !profile.stripe_connect_onboarded,
    html: (profile) => {
      const baseUrl = process.env.APP_URL || 'https://punchlist.ca';
      return emailWrap(`
      <h2 style="margin:0 0 12px;font-size:20px;font-weight:800;color:#1a1a19">Bigger jobs close easier with monthly payments</h2>
      <p style="color:#6b6b67;font-size:14px;line-height:1.7;margin:0 0 20px">
        Hi${profile.full_name ? ' ' + profile.full_name.split(' ')[0] : ''}, when you connect Stripe, your customers see a monthly payment option on every quote over $500. They pick what works for them — you get the full amount deposited. Takes 2 minutes to set up.
      </p>
      <a href="${baseUrl}/app/payments/setup" style="display:inline-block;background:#F97316;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Connect Stripe →</a>
    `);
    },
  },
  {
    id: 3,
    minDays: 7,
    subject: 'Your first week with Punchlist',
    condition: (profile, stats) => true,
    html: (profile, stats) => {
      const baseUrl = process.env.APP_URL || 'https://punchlist.ca';
      if (stats.sentQuotes > 0) {
        const rate = stats.sentQuotes > 0 ? Math.round((stats.approvedQuotes / stats.sentQuotes) * 100) : 0;
        return emailWrap(`
          <h2 style="margin:0 0 12px;font-size:20px;font-weight:800;color:#1a1a19">Your first week with Punchlist</h2>
          <p style="color:#6b6b67;font-size:14px;line-height:1.7;margin:0 0 16px">
            Hi${profile.full_name ? ' ' + profile.full_name.split(' ')[0] : ''}, here's how your first week went:
          </p>
          <div style="background:#f8f7f5;border-radius:10px;padding:16px 20px;margin:0 0 20px">
            <div style="font-size:28px;font-weight:800;color:#1a1a19">${rate}%</div>
            <div style="font-size:12px;color:#9c9a92;margin-top:2px">${stats.approvedQuotes} of ${stats.sentQuotes} quotes approved</div>
          </div>
          <a href="${baseUrl}/app/analytics" style="display:inline-block;background:#F97316;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">View your analytics →</a>
        `);
      }
      return emailWrap(`
        <h2 style="margin:0 0 12px;font-size:20px;font-weight:800;color:#1a1a19">Still haven't sent a quote?</h2>
        <p style="color:#6b6b67;font-size:14px;line-height:1.7;margin:0 0 20px">
          Hi${profile.full_name ? ' ' + profile.full_name.split(' ')[0] : ''}, your account is ready. Describe any job — a faucet replacement, a panel upgrade, a roof repair — and Punchlist builds the quote with pricing from real contractor data.
        </p>
        <a href="${baseUrl}/app/quotes/new" style="display:inline-block;background:#F97316;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Build your first quote →</a>
      `);
    },
    getSubject: (profile, stats) => stats.sentQuotes > 0 ? `Your close rate this week: ${Math.round((stats.approvedQuotes / Math.max(1, stats.sentQuotes)) * 100)}%` : 'Your first quote is still waiting',
  },
  {
    id: 4,
    minDays: 14,
    subject: 'Ready to go unlimited?',
    condition: (profile, stats) => stats.sentQuotes >= 2 && !profile.subscription_plan?.includes('pro'),
    html: (profile, stats) => {
      const baseUrl = process.env.APP_URL || 'https://punchlist.ca';
      return emailWrap(`
      <h2 style="margin:0 0 12px;font-size:20px;font-weight:800;color:#1a1a19">You've been using Punchlist — here's what Pro unlocks</h2>
      <p style="color:#6b6b67;font-size:14px;line-height:1.7;margin:0 0 16px">
        Hi${profile.full_name ? ' ' + profile.full_name.split(' ')[0] : ''}, you've sent ${stats.sentQuotes} quotes so far. Pro gives you unlimited quotes, quote view tracking, customer pay-over-time, deposits, scheduling, invoicing, and analytics.
      </p>
      <a href="${baseUrl}/pricing" style="display:inline-block;background:#F97316;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">See Pro plans →</a>
    `);
    },
  },
];

function emailWrap(content) {
  const baseUrl = process.env.APP_URL || 'https://punchlist.ca';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f5f4f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:40px 20px">
  <div style="margin-bottom:24px"><a href="${baseUrl}" style="color:#F97316;font-size:18px;font-weight:800;text-decoration:none;letter-spacing:-.03em">Punchlist</a></div>
  <div style="background:white;border-radius:12px;padding:28px 24px;border:1px solid #e8e6e1">
    ${content}
  </div>
  <div style="text-align:center;margin-top:24px;font-size:11px;color:#9c9a92;line-height:1.6">
    <a href="${baseUrl}" style="color:#9c9a92">punchlist.ca</a> · Quote-to-cash for trades contractors
    <br>
    <a href="${baseUrl}/app/settings" style="color:#9c9a92">Manage notification preferences</a>
  </div>
</div></body></html>`;
}

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (blocked(res, `act:${getClientIp(req)}`, 5, 60_000)) return;

  const { user_id } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' });
  if (!process.env.RESEND_API_KEY) return res.status(200).json({ ok: true, skipped: 'no_email_key' });

  let supabase;
  try { supabase = getSupabase(); } catch { return res.status(500).json({ error: 'Config error' }); }

  try {
    // Fetch profile
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user_id).maybeSingle();
    if (!profile) return res.status(200).json({ ok: true, skipped: 'no_profile' });

    // Get email from auth
    const { data: { user: authUser } } = await supabase.auth.admin.getUserById(user_id);
    const email = authUser?.email;
    if (!email) return res.status(200).json({ ok: true, skipped: 'no_email' });

    // Check sequence position
    const lastEmailId = profile.last_activation_email ?? -1;
    const lastEmailAt = profile.last_activation_email_at ? new Date(profile.last_activation_email_at) : null;
    const accountAge = Math.floor((Date.now() - new Date(profile.created_at || Date.now()).getTime()) / 86400000);

    // Find next email to send
    const nextEmail = SEQUENCE.find(e => {
      if (e.id <= lastEmailId) return false;
      if (accountAge < e.minDays) return false;
      return true;
    });

    if (!nextEmail) return res.status(200).json({ ok: true, skipped: 'sequence_complete' });

    // Cooldown: don't send more than one per day
    if (lastEmailAt && (Date.now() - lastEmailAt.getTime()) < 86400000) {
      return res.status(200).json({ ok: true, skipped: 'cooldown' });
    }

    // Get stats for conditional emails
    const { data: quotes } = await supabase.from('quotes').select('status').eq('user_id', user_id);
    const allQuotes = quotes || [];
    const stats = {
      sentQuotes: allQuotes.filter(q => q.status !== 'draft').length,
      approvedQuotes: allQuotes.filter(q => ['approved','approved_pending_deposit','scheduled','completed','invoiced','paid'].includes(q.status)).length,
    };

    // Check condition
    if (!nextEmail.condition(profile, stats)) {
      // Skip this email, mark as sent so we move forward
      await supabase.from('profiles').update({
        last_activation_email: nextEmail.id,
        last_activation_email_at: new Date().toISOString(),
      }).eq('id', user_id);
      return res.status(200).json({ ok: true, skipped: 'condition_not_met' });
    }

    // Build email
    const subject = nextEmail.getSubject ? nextEmail.getSubject(profile, stats) : nextEmail.subject;
    const html = typeof nextEmail.html === 'function' ? nextEmail.html(profile, stats) : nextEmail.html;

    // Send via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'notifications@punchlist.ca',
        to: email,
        subject,
        html,
        reply_to: 'hello@punchlist.ca',
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text().catch(() => '');
      console.warn('[activation-email] Resend failed:', emailRes.status, errText);
      return res.status(200).json({ ok: true, skipped: 'send_failed' });
    }

    // Update profile
    await supabase.from('profiles').update({
      last_activation_email: nextEmail.id,
      last_activation_email_at: new Date().toISOString(),
    }).eq('id', user_id);

    return res.status(200).json({ ok: true, sent: nextEmail.id, subject });
  } catch (err) {
    console.error('[activation-email] Error:', err);
    return res.status(200).json({ ok: true, skipped: 'error' });
  }
}
