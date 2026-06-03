// ═══════════════════════════════════════════════════════════════
// Delete-account endpoint — verifies it wipes every table + bucket
// for the authed user (and ONLY that user) and doesn't leak access
// to the cross-user attack via the request body.
//
//   node tests/delete-account.test.mjs
// ═══════════════════════════════════════════════════════════════
import handler from '../api/delete-account.js';

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; }
  else { fail++; console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

// Mock Supabase service client — tracks every table.delete + storage op
// so we can assert what the endpoint touched.
function mockSupabase({ alice, bob, storageFiles }) {
  const deletions = [];
  const remaining = JSON.parse(JSON.stringify({ alice, bob }));
  const storageOps = [];
  function tableHandle(table) {
    let pending = { select: null, op: null, eqCol: null, eqVal: null, inCol: null, inVals: null, count: false };
    const api = {
      select(cols) { pending.select = cols; return api; },
      delete(opts) { pending.op = 'delete'; pending.count = !!opts?.count; return api; },
      eq(col, val) { pending.eqCol = col; pending.eqVal = val; return run(); },
      in(col, vals) { pending.inCol = col; pending.inVals = vals; return run(); },
    };
    function run() {
      const arrFor = (user) => {
        const rows = remaining[user]?.[table] || [];
        return rows;
      };
      const allRows = [...arrFor('alice'), ...arrFor('bob')];
      let matching = allRows;
      if (pending.eqCol) matching = matching.filter(r => r[pending.eqCol] === pending.eqVal);
      if (pending.inCol) matching = matching.filter(r => (pending.inVals || []).includes(r[pending.inCol]));
      if (pending.op === 'delete') {
        for (const user of ['alice', 'bob']) {
          if (!remaining[user]?.[table]) continue;
          const before = remaining[user][table].length;
          remaining[user][table] = remaining[user][table].filter(r => !matching.includes(r));
          const after = remaining[user][table].length;
          if (before !== after) deletions.push({ table, col: pending.eqCol || pending.inCol, val: pending.eqVal ?? pending.inVals, user, removed: before - after });
        }
        return Promise.resolve({ data: matching, error: null, count: matching.length });
      }
      // select
      return Promise.resolve({ data: matching, error: null });
    }
    return api;
  }
  const sb = {
    from: tableHandle,
    storage: {
      from(bucket) {
        return {
          list(prefix, _opts) {
            const all = storageFiles[bucket] || {};
            const files = (all[prefix] || []).map(name => ({ name }));
            return Promise.resolve({ data: files, error: null });
          },
          remove(paths) {
            storageOps.push({ bucket, paths });
            for (const p of paths) {
              const [prefix, name] = p.split('/');
              const list = storageFiles[bucket]?.[prefix] || [];
              const idx = list.indexOf(name);
              if (idx >= 0) list.splice(idx, 1);
            }
            return Promise.resolve({ data: paths, error: null });
          },
        };
      },
    },
    auth: {
      getUser(_token) { return Promise.resolve({ data: { user: { id: 'alice', email: 'alice@example.com' } }, error: null }); },
      admin: {
        deleteUser(uid) {
          deletions.push({ table: '__auth_users__', col: 'id', val: uid });
          return Promise.resolve({ error: null });
        },
      },
    },
  };
  return { sb, deletions, remaining, storageOps };
}

// The endpoint reads `globalThis.__PUNCHLIST_TEST_SUPABASE__` first when
// resolving its service-role client — purely a test affordance that
// production never sets. Lets this test stay process-pure without
// monkey-patching ESM imports or spinning a fake Postgres.

const ALICE_DATA = {
  quotes: [{ id: 'q1', user_id: 'alice' }, { id: 'q2', user_id: 'alice' }],
  invoices: [{ id: 'inv1', user_id: 'alice' }],
  customers: [{ id: 'c1', user_id: 'alice' }, { id: 'c2', user_id: 'alice' }],
  notifications: [{ id: 'n1', user_id: 'alice' }],
  job_templates: [{ id: 't1', user_id: 'alice' }],
  message_templates: [{ id: 'mt1', user_id: 'alice' }],
  line_items: [{ id: 'li1', quote_id: 'q1' }, { id: 'li2', quote_id: 'q2' }],
  invoice_items: [{ id: 'ii1', invoice_id: 'inv1' }],
  quote_views: [{ id: 'qv1', quote_id: 'q1' }],
  payments: [{ id: 'p1', quote_id: 'q1' }, { id: 'p2', invoice_id: 'inv1' }],
  profiles: [{ id: 'alice' }],
};
const BOB_DATA = {
  // Bob is a different user — none of his data should be touched.
  quotes: [{ id: 'qb1', user_id: 'bob' }],
  invoices: [],
  customers: [{ id: 'cb1', user_id: 'bob' }],
  notifications: [],
  job_templates: [],
  message_templates: [],
  line_items: [{ id: 'lib1', quote_id: 'qb1' }],
  invoice_items: [],
  quote_views: [],
  payments: [],
  profiles: [{ id: 'bob' }],
};

const { sb: mockSb, remaining, deletions, storageOps } = mockSupabase({
  alice: ALICE_DATA,
  bob: BOB_DATA,
  storageFiles: {
    'quote-photos': { alice: ['a.jpg', 'b.jpg', 'c.jpg'], bob: ['ignore.jpg'] },
    'logos':        { alice: ['logo.png'],                 bob: ['ignore.png'] },
  },
});

// Install the stub the endpoint looks for, then import the handler.
globalThis.__PUNCHLIST_TEST_SUPABASE__ = mockSb;
const { default: deleteAccountHandler } = await import('../api/delete-account.js');

// ── Run the endpoint ──
function mockReq({ token = 'bearer-mock', body = {} } = {}) {
  return {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body,
  };
}
function mockRes() {
  const res = { headers: {}, statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.end = () => res;
  return res;
}

// 1. Happy path — Alice deletes her account.
{
  const res = mockRes();
  await deleteAccountHandler(mockReq({ body: { confirm_email: 'alice@example.com' } }), res);
  check('happy path returns 200', res.statusCode === 200, JSON.stringify(res.body));
  check('every Alice quote gone', (remaining.alice.quotes || []).length === 0);
  check('every Alice line_item gone', (remaining.alice.line_items || []).length === 0);
  check('every Alice invoice gone', (remaining.alice.invoices || []).length === 0);
  check('every Alice invoice_item gone', (remaining.alice.invoice_items || []).length === 0);
  check('every Alice customer gone', (remaining.alice.customers || []).length === 0);
  check('every Alice notification gone', (remaining.alice.notifications || []).length === 0);
  check('every Alice job_template gone', (remaining.alice.job_templates || []).length === 0);
  check('every Alice message_template gone', (remaining.alice.message_templates || []).length === 0);
  check('every Alice payment gone', (remaining.alice.payments || []).length === 0);
  check('every Alice quote_view gone', (remaining.alice.quote_views || []).length === 0);
  check('Alice profile row gone', (remaining.alice.profiles || []).length === 0);
  // Auth user — endpoint reports auth_deleted: true
  check('auth user marked deleted', res.body?.auth_deleted === true, JSON.stringify(res.body?.errors));
  check('storage quote-photos under alice purged', (storageOps.find(o => o.bucket === 'quote-photos')?.paths || []).length === 3);
  check('storage logos under alice purged', (storageOps.find(o => o.bucket === 'logos')?.paths || []).length === 1);
  // Crucial isolation check — Bob's data MUST be untouched.
  check('Bob quotes untouched', (remaining.bob.quotes || []).length === 1);
  check('Bob line_items untouched', (remaining.bob.line_items || []).length === 1);
  check('Bob customers untouched', (remaining.bob.customers || []).length === 1);
  check('Bob profile untouched', (remaining.bob.profiles || []).length === 1);
  check('Bob storage untouched', !storageOps.some(o => o.paths.some(p => p.startsWith('bob/'))));
}

// 2. Missing token → 401.
{
  const res = mockRes();
  await deleteAccountHandler({ method: 'POST', headers: {}, body: {} }, res);
  check('missing token → 401', res.statusCode === 401);
}

// 3. Confirmation email mismatch → 400 (and no deletion happens).
{
  // Reset Bob (Alice is already gone from previous run — that's fine).
  remaining.bob = JSON.parse(JSON.stringify(BOB_DATA));
  // We need a fresh state for this assertion. The previous run already
  // wiped Alice's data; re-seed so the mismatch path can be checked.
  remaining.alice = JSON.parse(JSON.stringify(ALICE_DATA));
  const res = mockRes();
  await deleteAccountHandler(mockReq({ body: { confirm_email: 'wrong@example.com' } }), res);
  check('wrong confirmation → 400', res.statusCode === 400);
  check('mismatched confirm keeps Alice data intact', (remaining.alice.quotes || []).length === 2);
}

// 4. Endpoint never reads userId from body (cross-account attack guard).
{
  remaining.bob = JSON.parse(JSON.stringify(BOB_DATA));
  remaining.alice = JSON.parse(JSON.stringify(ALICE_DATA));
  const res = mockRes();
  // Caller sends Bob's id in the body. Our mock auth still resolves the
  // bearer token to Alice — so the endpoint should delete Alice, NOT Bob.
  await deleteAccountHandler(mockReq({ body: { user_id: 'bob', confirm_email: 'alice@example.com' } }), res);
  check('body user_id ignored — Alice (the authed user) gets wiped', (remaining.alice.quotes || []).length === 0);
  check('Bob data still safe under body-id attack', (remaining.bob.quotes || []).length === 1);
}

console.log(`\n${pass} passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
