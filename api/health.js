import { createClient } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
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
    public_quote_columns: null,
    public_invoice_columns: null,
  };

  if (!url || !key) {
    return res.status(500).json({ ok: false, error: 'Missing env vars', checks });
  }

  // Probe a single column to confirm it exists. Returns "exists" or the
  // PostgREST error message.
  async function probe(supabase, table, col) {
    const { error } = await supabase.from(table).select(col).limit(1);
    return error ? error.message : 'exists';
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

    // Test 2: check invoice_id column exists on quotes (the bug that
    // surfaced as a 500 with a SQL error mentioning invoice_id + uuid).
    const invIdResult = await probe(supabase, 'quotes', 'invoice_id');
    checks.invoice_id_column = invIdResult;

    // Test 3: every column public-quote.js selects from profiles. The
    // public quote endpoint silently drops missing ones at runtime, but
    // listing them here makes it obvious which migration is unapplied.
    const profileCols = [
      'stripe_connect_account_id','stripe_connect_onboarded','terms_conditions',
      'sms_notifications_enabled','push_subscription',
    ];
    const profileProbes = {};
    for (const c of profileCols) profileProbes[c] = await probe(supabase, 'profiles', c);
    checks.public_quote_columns = profileProbes;

    // Test 4: every column public-invoice.js selects on invoices.
    const invoiceCols = ['remaining_balance','sent_at','recurring_interval','discount','deposit_credited'];
    const invoiceProbes = {};
    for (const c of invoiceCols) invoiceProbes[c] = await probe(supabase, 'invoices', c);
    checks.public_invoice_columns = invoiceProbes;

  } catch (e) {
    checks.db = { ok: false, error: e.message };
    return res.status(500).json({ ok: false, error: 'Exception', checks });
  }

  // Overall health: green only if every column probe says "exists".
  const allExists = (obj) => Object.values(obj || {}).every(v => v === 'exists');
  const allOk = checks.invoice_id_column === 'exists'
    && allExists(checks.public_quote_columns)
    && allExists(checks.public_invoice_columns);

  return res.status(allOk ? 200 : 503).json({ ok: allOk, checks });
}
