import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const url = process.env.SUPABASE_URL  || process.env.VITE_SUPABASE_URL  || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const checks = {
    env: {
      SUPABASE_URL: url  ? `set — ${url.slice(0, 35)}…` : 'MISSING',
      SUPABASE_SERVICE_ROLE_KEY: key
        ? `set — starts with ${key.slice(0, 8)}, length ${key.length}`
        : 'MISSING',
    },
    db: null,
    invoice_id_column: null,
  };

  if (!url || !key) {
    return res.status(500).json({ ok: false, error: 'Missing env vars', checks });
  }

  try {
    const supabase = createClient(url, key);

    // Test 1: basic DB connectivity
    const { count, error: dbErr } = await supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true });

    if (dbErr) {
      checks.db = { ok: false, error: dbErr.message, code: dbErr.code, hint: dbErr.hint };
      return res.status(500).json({ ok: false, error: 'DB query failed', checks });
    }
    checks.db = { ok: true, quote_count: count };

    // Test 2: check invoice_id column exists on quotes
    const { data: sample } = await supabase
      .from('quotes')
      .select('id, status, invoice_id')
      .limit(1);
    checks.invoice_id_column = sample !== null ? 'exists' : 'query returned null';

  } catch (e) {
    checks.db = { ok: false, error: e.message };
    return res.status(500).json({ ok: false, error: 'Exception', checks });
  }

  return res.status(200).json({ ok: true, checks });
}
