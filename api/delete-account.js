// ═══════════════════════════════════════════════════════════════
// Punchlist — Account deletion
//
// Wipes everything a contractor account touches: every quote +
// line item, every invoice + invoice item, every customer record,
// every notification / template / payment / quote view, every
// uploaded photo + logo, then the profile row, then the auth user.
//
// Service role only — RLS would block the cross-table cleanup
// otherwise, and the previous client-side attempt couldn't call
// auth.admin.deleteUser at all (anon key has no admin scope).
//
// Auth: requires a valid JWT for the user whose account is being
// deleted. We trust the JWT-resolved user.id, NOT the body, so a
// caller can't ask us to wipe somebody else's data.
// ═══════════════════════════════════════════════════════════════
import { createClient } from './_supabase.js';
import { blocked, getClientIp } from './_rate-limit.js';

function getServiceClient() {
  // Tests inject a stub via this global so we don't have to monkey-patch
  // ESM imports or stand up a fake Postgres. Production never sets it.
  if (globalThis.__PUNCHLIST_TEST_SUPABASE__) {
    return globalThis.__PUNCHLIST_TEST_SUPABASE__;
  }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Storage prefixes to wipe — each bucket stores files namespaced under
// {userId}/... so listing the prefix and removing every path is enough.
const STORAGE_BUCKETS = ['quote-photos', 'logos'];

// Delete every object inside `prefix` from `bucket`. Supabase Storage's
// list() defaults to 100 entries and returns folders + files mixed; we
// iterate until empty so a contractor with 200+ photos still gets fully
// cleaned up.
async function purgeBucketPrefix(supabase, bucket, prefix) {
  const removed = [];
  for (let pass = 0; pass < 20; pass++) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) {
      console.warn(`[delete-account] list ${bucket}/${prefix}:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    const paths = data.map(d => `${prefix}/${d.name}`);
    const { error: rmErr } = await supabase.storage.from(bucket).remove(paths);
    if (rmErr) {
      console.warn(`[delete-account] remove ${bucket}/${prefix}:`, rmErr.message);
      break;
    }
    removed.push(...paths);
    if (data.length < 1000) break;
  }
  return removed.length;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit per IP — account deletion isn't a hot path, but a
  // misconfigured client looping retries shouldn't bury Supabase.
  if (blocked(res, `del-acct:${getClientIp(req)}`, 5, 60_000)) return;

  const supabase = getServiceClient();
  if (!supabase) {
    console.error('[delete-account] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({ error: 'Server not configured' });
  }

  // Resolve the user from the bearer token. Never trust the request body
  // for the userId — that's how cross-account deletion would happen.
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const { data: { user: authedUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authedUser?.id) return res.status(401).json({ error: 'Unauthorized' });
  const userId = authedUser.id;

  // Optional safety: require the client to echo back the user's email as
  // confirmation. The client already gates the destructive button behind
  // two confirm dialogs, but a typo'd POST shouldn't nuke an account.
  const bodyEmail = String(req.body?.confirm_email || '').trim().toLowerCase();
  if (bodyEmail && authedUser.email && bodyEmail !== authedUser.email.toLowerCase()) {
    return res.status(400).json({ error: 'Confirmation email does not match' });
  }

  const report = {
    user_id: userId,
    deleted: {},
    storage_removed: {},
    errors: [],
  };

  // ── 1. Pull every quote + invoice id so we can wipe child rows
  // (line_items, invoice_items, quote_views, payments) by FK rather than
  // by user_id — those tables may not carry user_id directly.
  let quoteIds = [];
  let invoiceIds = [];
  try {
    const { data: q } = await supabase.from('quotes').select('id').eq('user_id', userId);
    quoteIds = (q || []).map(r => r.id);
  } catch (e) { report.errors.push('list quotes: ' + e.message); }
  try {
    const { data: inv } = await supabase.from('invoices').select('id').eq('user_id', userId);
    invoiceIds = (inv || []).map(r => r.id);
  } catch (e) { report.errors.push('list invoices: ' + e.message); }

  // ── 2. Wipe child tables BEFORE the parents, in dependency order.
  // Each delete is best-effort: log the failure into `report.errors` but
  // keep going. A partial wipe is still better than leaving the auth
  // user in place with half its data.
  async function wipe(table, column, ids) {
    if (!ids?.length) { report.deleted[table] = 0; return; }
    // Supabase's `.in()` filter caps at 1000 — chunk just in case.
    const CHUNK = 500;
    let count = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const { error, count: c } = await supabase
        .from(table)
        .delete({ count: 'exact' })
        .in(column, slice);
      if (error) report.errors.push(`${table}.${column}: ${error.message}`);
      count += c || 0;
    }
    report.deleted[table] = count;
  }
  async function wipeBy(table, column, value) {
    const { error, count } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .eq(column, value);
    if (error) report.errors.push(`${table}.${column}: ${error.message}`);
    report.deleted[table] = count || 0;
  }

  // Quote/invoice children first.
  await wipe('line_items',    'quote_id',   quoteIds);
  await wipe('quote_views',   'quote_id',   quoteIds);
  await wipe('invoice_items', 'invoice_id', invoiceIds);
  // payments may reference either quotes or invoices depending on flow.
  await wipe('payments',      'quote_id',   quoteIds);
  await wipe('payments',      'invoice_id', invoiceIds);

  // Parents.
  await wipeBy('invoices',          'user_id', userId);
  await wipeBy('quotes',            'user_id', userId);
  await wipeBy('customers',         'user_id', userId);

  // Per-user admin / messaging tables.
  await wipeBy('notifications',     'user_id', userId);
  await wipeBy('job_templates',     'user_id', userId);
  await wipeBy('message_templates', 'user_id', userId);

  // ── 3. Storage — uploaded photos + logo files under {userId}/.
  for (const bucket of STORAGE_BUCKETS) {
    try {
      const n = await purgeBucketPrefix(supabase, bucket, userId);
      report.storage_removed[bucket] = n;
    } catch (e) {
      report.errors.push(`storage ${bucket}: ${e.message}`);
    }
  }

  // ── 4. Profile row (keyed on auth user id).
  await wipeBy('profiles', 'id', userId);

  // ── 5. Auth user itself — last step. If this fails the next sign-in
  // would land them on an "account with no data" state, so retry once.
  let authDeleted = false;
  for (let attempt = 0; attempt < 2 && !authDeleted; attempt++) {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (!error) { authDeleted = true; break; }
    report.errors.push(`auth admin delete (attempt ${attempt + 1}): ${error.message}`);
  }
  report.auth_deleted = authDeleted;

  return res.status(200).json(report);
}
