// ═══════════════════════════════════════════════════════════════════════════
// PUNCHLIST — POST /api/mark-messages-read
// v100 Workstream C §5.2 — Customer-side read receipts
//
// Auth: share token (same pattern as /api/public-quote-action).
//       NOT session auth — this is called from the public quote page,
//       where the customer is not logged in.
//
// Body: { token: string }
//
// Effect:
//   - Sets quotes.messages_last_read_at = now()
//   - Increments quotes.messages_read_count
//   - Returns { ok: true, read_at: <iso> }
//
// The contractor-side quote detail page reads messages_last_read_at
// to show "Read Xm ago" on outbound message bubbles.
//
// Rate limit: 20 calls per token per hour (the customer might scroll
// in and out of the thread area repeatedly; we don't want to hammer the DB).
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import { blocked, getClientIp } from './_rate-limit.js';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.body || {};
  if (!token || typeof token !== 'string' || token.length < 8) {
    return res.status(400).json({ error: 'token required' });
  }

  // Rate limit: keyed by share token + IP so a bot can't spam receipts
  const ip = getClientIp(req);
  const rlKey = `mark-read:${token}:${ip}`;
  if (blocked(res, rlKey, 20, 60 * 60 * 1000)) return; // 20/hr per token+IP

  const supabase = getSupabase();
  if (!supabase) {
    console.error('[mark-messages-read] Missing Supabase env vars');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Resolve quote from share token
  const { data: quote, error: qErr } = await supabase
    .from('quotes')
    .select('id, messages_read_count')
    .eq('share_token', token)
    .maybeSingle();

  if (qErr || !quote) {
    // Don't reveal whether the token is valid — just 404
    return res.status(404).json({ error: 'Not found' });
  }

  const readAt = new Date().toISOString();

  const { error: uErr } = await supabase
    .from('quotes')
    .update({
      messages_last_read_at: readAt,
      messages_read_count: (Number(quote.messages_read_count) || 0) + 1,
    })
    .eq('id', quote.id);

  if (uErr) {
    console.error('[mark-messages-read] Update error:', uErr.message);
    return res.status(500).json({ error: 'Failed to record read receipt' });
  }

  return res.status(200).json({ ok: true, read_at: readAt });
}
