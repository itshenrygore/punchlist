import { createClient } from './_supabase.js';
import { blocked, getClientIp } from './_rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (blocked(res, `mr:${getClientIp(req)}`, 30, 60_000)) return;

  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Missing token' });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'Not configured' });

  const supabase = createClient(url, key);

  try {
    const { data: quote } = await supabase
      .from('quotes')
      .select('id, conversation')
      .eq('share_token', token)
      .maybeSingle();

    if (!quote) return res.status(404).json({ error: 'Not found' });

    const convo = Array.isArray(quote.conversation) ? quote.conversation : [];
    let changed = false;
    const updated = convo.map(msg => {
      if (msg.role === 'contractor' && !msg.read_at) {
        changed = true;
        return { ...msg, read_at: new Date().toISOString() };
      }
      return msg;
    });

    if (changed) {
      await supabase
        .from('quotes')
        .update({ conversation: updated })
        .eq('id', quote.id);
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[mark-messages-read]', e.message);
    return res.status(500).json({ error: 'Server error' });
  }
}
