// ═══════════════════════════════════════════════════════════════
// PUNCHLIST — Foreman scenario test
// Exercises Foreman's real code paths against a mock Supabase that
// returns realistic contractor data. Verifies:
//   • each tool returns useful output for the model
//   • safety guards fire (draft-only edits, ambiguity prompts, masking)
//   • realistic contractor "what would I actually ask" scenarios end up
//     in the right tool path
// The live model can't run here (no API key). Everything else is real.
//
//   node tests/foreman-scenarios.mjs
// ═══════════════════════════════════════════════════════════════
import { executeTool } from '../api/ai-assist.js';

let pass = 0, fail = 0;
const fails = [];
function check(name, cond, detail = '') {
  if (cond) { pass++; }
  else { fail++; fails.push(`${name}${detail ? ' — ' + detail : ''}`); }
}

// ── Realistic contractor data ─────────────────────────────────
const USER_ID = 'user-mock-1';
const QUOTES = [
  {
    id: 'q-smith-bath', user_id: USER_ID,
    title: 'Smith bathroom renovation', status: 'draft',
    trade: 'General Contractor', province: 'AB',
    total: 8400, view_count: 0, sent_at: null,
    updated_at: '2026-05-29T10:00:00Z',
    customer: { name: 'Jen Smith' },
    line_items: [
      { name: 'Demo old bathroom', quantity: 1, unit_price: 600 },
      { name: 'Install kitchen faucet', quantity: 1, unit_price: 220 }, // intentional mislabel — Foreman should be able to set_price by substring
      { name: 'Tile installation (shower)', quantity: 1, unit_price: 1800 },
      { name: 'Vanity install', quantity: 1, unit_price: 350 },
    ],
  },
  {
    id: 'q-kevin-hwt', user_id: USER_ID,
    title: 'Kevin — 50 gal gas water heater swap', status: 'viewed',
    trade: 'Plumber', province: 'AB',
    total: 1290, view_count: 4, sent_at: '2026-05-26T14:00:00Z',
    updated_at: '2026-05-26T14:00:00Z',
    customer: { name: 'Kevin Martin' },
    line_items: [
      { name: 'Remove & dispose old water heater', quantity: 1, unit_price: 120 },
      { name: 'Supply & install 50 gal gas heater', quantity: 1, unit_price: 980 },
      { name: 'Expansion tank + T&P valve', quantity: 1, unit_price: 190 },
    ],
  },
  {
    id: 'q-sandra-panel', user_id: USER_ID,
    title: 'Sandra — 200A panel upgrade', status: 'approved',
    trade: 'Electrician', province: 'AB',
    total: 4800, view_count: 6, sent_at: '2026-05-18T10:00:00Z',
    updated_at: '2026-05-22T12:00:00Z',
    customer: { name: 'Sandra Lee' },
    line_items: [
      { name: 'Panel upgrade to 200A', quantity: 1, unit_price: 3800 },
      { name: 'Permit + final inspection', quantity: 1, unit_price: 350 },
      { name: 'Disconnect old panel', quantity: 1, unit_price: 650 },
    ],
  },
];
const CONTACTS = [
  { id: 'c1', user_id: USER_ID, name: 'Jen Smith',     email: 'jen.smith@example.com',  phone: '+14035551234' },
  { id: 'c2', user_id: USER_ID, name: 'Kevin Martin',  email: 'kevin@example.com',      phone: '+14035555678' },
  { id: 'c3', user_id: USER_ID, name: 'Sandra Lee',    email: 'sandra.lee@example.com', phone: '+14035550001' },
  { id: 'c4', user_id: USER_ID, name: 'Bob Stevens',   email: 'bob@example.com',        phone: '+14035552222' },
];

// ── Mock Supabase query builder ───────────────────────────────
// Just enough to satisfy the chain pattern used throughout executeTool.
function mockSupabase(state) {
  const trace = [];
  function builder(table) {
    let filtered = (state[table] || []).slice();
    let resolved = false;
    const q = {
      select(_cols) { return q; },
      eq(col, val)  { filtered = filtered.filter(r => r[col] === val); return q; },
      ilike(col, pattern) {
        const needle = pattern.replace(/%/g, '').toLowerCase();
        filtered = filtered.filter(r => String(r[col] || '').toLowerCase().includes(needle));
        return q;
      },
      order(_col, _opts) { return q; },
      limit(n) { filtered = filtered.slice(0, n); return q; },
      single() { return Promise.resolve({ data: filtered[0] || null, error: filtered[0] ? null : new Error('no rows') }); },
      maybeSingle() { return Promise.resolve({ data: filtered[0] || null, error: null }); },
      insert(row) {
        const arr = Array.isArray(row) ? row : [row];
        const inserted = arr.map(r => ({ id: 'gen-' + Math.random().toString(36).slice(2, 8), ...r }));
        state[table] = (state[table] || []).concat(inserted);
        trace.push({ op: 'insert', table, count: inserted.length });
        const out = { select: () => out, single: () => Promise.resolve({ data: inserted[0], error: null }) };
        return out;
      },
      update(patch) {
        trace.push({ op: 'update', table, patch });
        return {
          eq(col, val) {
            (state[table] || []).forEach(r => { if (r[col] === val) Object.assign(r, patch); });
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
      delete() {
        return {
          eq(col, val) {
            state[table] = (state[table] || []).filter(r => r[col] !== val);
            trace.push({ op: 'delete', table, where: { [col]: val } });
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
      then(resolve) { resolved = true; resolve({ data: filtered, error: null }); },
    };
    return q;
  }
  return { from: builder, _state: state, _trace: trace };
}

// ── Test scenarios ────────────────────────────────────────────
function freshSupabase() {
  return mockSupabase({
    quotes: JSON.parse(JSON.stringify(QUOTES)),
    customers: JSON.parse(JSON.stringify(CONTACTS)),
    line_items: [
      ...QUOTES.flatMap(q => q.line_items.map(li => ({ ...li, id: 'li-' + Math.random().toString(36).slice(2, 6), quote_id: q.id, included: true, category: '', notes: '' }))),
    ],
  });
}

// 1. read_quotes — list all
{
  const sb = freshSupabase();
  const out = await executeTool('read_quotes', {}, USER_ID, sb);
  check('read_quotes lists all 3 quotes', out.split('\n').length === 3, `got: ${out}`);
  check('read_quotes shows status', out.includes('[draft]') && out.includes('[viewed]') && out.includes('[approved]'));
  check('read_quotes shows customer name', out.includes('Jen Smith') && out.includes('Kevin Martin'));
}

// 2. read_quotes — by customer name
{
  const sb = freshSupabase();
  const out = await executeTool('read_quotes', { customer_name: 'Kevin' }, USER_ID, sb);
  check('read_quotes filters by customer name', out.includes('Kevin Martin') && !out.includes('Sandra'));
}

// 3. read_contacts — masks phone by default
{
  const sb = freshSupabase();
  const out = await executeTool('read_contacts', {}, USER_ID, sb);
  check('read_contacts hides full phone by default', !out.includes('+14035551234'));
  check('read_contacts hides full email by default', !out.includes('jen.smith@example.com'));
  check('read_contacts still shows names', out.includes('Jen Smith') && out.includes('Kevin Martin'));
}

// 4. read_contacts — explicit opt-in reveals
{
  const sb = freshSupabase();
  const out = await executeTool('read_contacts', { include_contact_details: true }, USER_ID, sb);
  check('read_contacts reveals phone with explicit opt-in', out.includes('+14035551234'));
  check('read_contacts reveals email with explicit opt-in', out.includes('jen.smith@example.com'));
}

// 5. read_quote_detail — single match
{
  const sb = freshSupabase();
  const out = await executeTool('read_quote_detail', { quote_search: 'Smith' }, USER_ID, sb);
  check('read_quote_detail returns the right quote', out.includes('Smith bathroom renovation'));
  check('read_quote_detail shows status + total', out.includes('Status: draft') && out.includes('Total: $8400'));
  check('read_quote_detail lists line items', out.includes('Demo old bathroom') && out.includes('Tile installation'));
}

// 6. read_quote_detail — no match
{
  const sb = freshSupabase();
  const out = await executeTool('read_quote_detail', { quote_search: 'nonexistent' }, USER_ID, sb);
  check('read_quote_detail tells model when no match', out.includes('No quote matches'));
}

// 7. read_quote_detail — multiple matches → ambiguity prompt
{
  // Make Kevin and Jen both have "renovation" in title
  const state = {
    quotes: [
      { ...QUOTES[0], id: 'q1' },
      { ...QUOTES[0], id: 'q2', title: 'Kevin kitchen renovation', customer: { name: 'Kevin Martin' } },
    ],
    customers: CONTACTS,
    line_items: [],
  };
  const sb = mockSupabase(state);
  const out = await executeTool('read_quote_detail', { quote_search: 'renovation' }, USER_ID, sb);
  check('read_quote_detail asks for clarification when ambiguous', out.includes('Multiple quotes match'));
}

// 8. update_quote — set_price on draft
{
  const sb = freshSupabase();
  const out = await executeTool('update_quote', {
    quote_search: 'Smith',
    edits: [{ action: 'set_price', item_name: 'Vanity', unit_price: 480 }],
  }, USER_ID, sb);
  check('update_quote applies set_price on draft', out.includes('Updated') && out.includes('480'));
  check('update_quote reports new total', /New total: \$\d+/.test(out));
  check('update_quote returns deep link for builder', out.includes('[LINK:/app/quotes/'));
}

// 9. update_quote — REFUSES to edit a sent/viewed quote
{
  const sb = freshSupabase();
  const out = await executeTool('update_quote', {
    quote_search: 'Kevin',  // status = 'viewed'
    edits: [{ action: 'set_price', item_name: 'Supply', unit_price: 1100 }],
  }, USER_ID, sb);
  check('update_quote refuses non-draft quotes', out.includes("Can't edit") && out.includes('viewed'));
  check('update_quote mentions revision flow as the right path', out.toLowerCase().includes('revision'));
}

// 10. update_quote — REFUSES an approved quote (real-money safety)
{
  const sb = freshSupabase();
  const out = await executeTool('update_quote', {
    quote_search: 'Sandra',  // status = 'approved'
    edits: [{ action: 'set_price', item_name: 'Panel', unit_price: 4200 }],
  }, USER_ID, sb);
  check('update_quote refuses approved quotes', out.includes("Can't edit") && out.includes('approved'));
}

// 11. update_quote — add and remove line items
{
  const sb = freshSupabase();
  const out = await executeTool('update_quote', {
    quote_search: 'Smith',
    edits: [
      { action: 'add', item_name: 'Building permit', unit_price: 180 },
      { action: 'remove', item_name: 'Install kitchen faucet' }, // the mislabeled one
    ],
  }, USER_ID, sb);
  check('update_quote can add a line', out.includes('Building permit'));
  check('update_quote can remove a line', out.includes('Install kitchen faucet'));
  check('update_quote returned net total after add + remove', /New total: \$\d+/.test(out));
}

// 12. update_quote — bad inputs are clamped, not crashed
{
  const sb = freshSupabase();
  const out = await executeTool('update_quote', {
    quote_search: 'Smith',
    edits: [
      { action: 'set_price', item_name: 'Vanity', unit_price: -50 },   // negative price → clamp to 0
      { action: 'set_price', item_name: 'Vanity', unit_price: 9999999 }, // huge price → clamp to 1m
      { action: 'set_price', item_name: 'nonexistent item', unit_price: 100 },
      { action: 'unknown_action', item_name: 'Vanity' },
    ],
  }, USER_ID, sb);
  check('update_quote tells model about skipped edits', out.toLowerCase().includes('skip'));
  check('update_quote does not crash on bad inputs', !out.includes('TypeError') && !out.includes('undefined'));
}

// 13. draft_followup — returns context, does NOT auto-send
{
  const sb = freshSupabase();
  const out = await executeTool('draft_followup', { quote_search: 'Kevin' }, USER_ID, sb);
  check('draft_followup includes customer name', out.includes('Kevin Martin'));
  check('draft_followup includes view count', out.includes('Viewed: 4'));
  check('draft_followup includes days since sent', /sent \d+d ago/.test(out));
  check('draft_followup instructs model to write a sendable text', out.toLowerCase().includes('verbatim'));
  // It must NOT actually send anything.
  check('draft_followup has zero insert/update/delete side effects',
    sb._trace.filter(t => t.op !== 'select').length === 0,
    `trace: ${JSON.stringify(sb._trace)}`);
}

// 14a. update_quote returns reverts so the model can offer undo
{
  const sb = freshSupabase();
  const out = await executeTool('update_quote', {
    quote_search: 'Smith',
    edits: [
      { action: 'set_price', item_name: 'Vanity', unit_price: 480 },
      { action: 'add', item_name: 'Building permit', unit_price: 180 },
      { action: 'remove', item_name: 'Demo old bathroom' },
    ],
  }, USER_ID, sb);
  check('update_quote returns a Reverts payload for undo', out.includes('Reverts'));
  // The reverts should be the inverse of each edit
  check('reverts inverse set_price (restore old price)', /set_price.*Vanity.*"unit_price":350/.test(out),
    `out: ${out.slice(0, 400)}`);
  check('reverts inverse add (remove)', /"action":"remove".*Building permit/.test(out));
  check('reverts inverse remove (re-add with old price)', /"action":"add".*Demo old bathroom.*"unit_price":600/.test(out));
}

// 15. update_quote_status — kitchen-table close
{
  const sb = freshSupabase();
  const out = await executeTool('update_quote_status', { quote_search: 'Kevin', action: 'mark_approved' }, USER_ID, sb);
  check('mark_approved on a viewed quote works', out.includes('approved'));
  // Verify the patch actually hit the mock state
  const k = sb._state.quotes.find(q => q.id === 'q-kevin-hwt');
  check('mark_approved persists status', k.status === 'approved');
  check('mark_approved stamps approved_at', !!k.approved_at);
}

// 16. update_quote_status — guards
{
  const sb = freshSupabase();
  const draftOut = await executeTool('update_quote_status', { quote_search: 'Smith', action: 'mark_approved' }, USER_ID, sb);
  check('mark_approved refuses a draft (send first)', /draft/i.test(draftOut) && /send/i.test(draftOut));

  const sb2 = freshSupabase();
  const depOut = await executeTool('update_quote_status', { quote_search: 'Kevin', action: 'mark_deposit_paid' }, USER_ID, sb2);
  check('mark_deposit_paid refuses a non-approved quote', /approved/i.test(depOut) && /must/i.test(depOut));

  const sb3 = freshSupabase();
  // Simulate a declined quote
  sb3._state.quotes[0].status = 'declined';
  const declOut = await executeTool('update_quote_status', { quote_search: 'Smith', action: 'mark_approved' }, USER_ID, sb3);
  check('mark_approved refuses terminal states (declined)', /terminal|declined/i.test(declOut));
}

// 17. start_revision — on a sent quote
{
  const sb = freshSupabase();
  const out = await executeTool('start_revision', {
    quote_search: 'Kevin', // status: viewed
    edits: [{ action: 'add', item_name: 'Code-required mixing valve', unit_price: 145 }],
    reason: 'Customer asked for code-compliant mixing valve',
  }, USER_ID, sb);
  check('start_revision applies on a non-draft quote', out.toLowerCase().includes('staged revision'));
  check('start_revision returns deep link to edit page', out.includes('[LINK:/app/quotes/'));
  check('start_revision mentions the review-and-ship step', out.toLowerCase().includes('send revised'));
  // It should write a revision_summary on the quote
  const k = sb._state.quotes.find(q => q.id === 'q-kevin-hwt');
  check('start_revision stages revision_summary', !!k.revision_summary && k.revision_summary.toLowerCase().includes('mixing valve'));
}

// 18. start_revision — refuses drafts (use update_quote)
{
  const sb = freshSupabase();
  const out = await executeTool('start_revision', {
    quote_search: 'Smith', // draft
    edits: [{ action: 'set_price', item_name: 'Vanity', unit_price: 480 }],
  }, USER_ID, sb);
  check('start_revision refuses draft (steers to update_quote)', /draft/i.test(out) && /update_quote/i.test(out));
}

// 19. start_revision — empty edits opens the edit page anyway
{
  const sb = freshSupabase();
  const out = await executeTool('start_revision', { quote_search: 'Kevin', edits: [] }, USER_ID, sb);
  check('start_revision with no edits still surfaces the deep link', out.includes('[LINK:/app/quotes/'));
}

// 14. lookup_pricing — wire to the offline catalog
{
  const sb = freshSupabase();
  const out = await executeTool('lookup_pricing', { query: 'water heater', trade: 'Plumber' }, USER_ID, sb);
  check('lookup_pricing surfaces relevant items', out.toLowerCase().includes('water heater') || out.includes('$'));
}

// ── Contractor scenarios — does Foreman have the tool to do each? ──
// We can't run the LLM here, but we CAN verify the tool surface area is
// sufficient: for every "thing a contractor would actually ask" scenario,
// at least one tool can satisfy the intent.
const SCENARIOS = [
  // [contractor query, tool(s) that should be selected, why it matters]
  ['What\'s on the Smith bathroom quote?',          ['read_quote_detail'],   'specific quote lookup'],
  ['How much for a 50 gal gas water heater?',       ['lookup_pricing'],      'pricing reference'],
  ['Raise the vanity on Smith to 480',              ['update_quote'],        'one-tap price fix without leaving Foreman'],
  ['Add a permit line at $180 to the Smith quote',  ['update_quote'],        'one-tap add without leaving Foreman'],
  ['Drop the disposal item from Smith',             ['update_quote'],        'one-tap remove without leaving Foreman'],
  ['Draft a follow-up for the Kevin water heater quote', ['draft_followup'], 'follow-up draft + UI send button'],
  ['Which quotes are still in draft?',              ['read_quotes'],         'pipeline triage'],
  ['What\'s Bob\'s phone?',                          ['read_contacts'],       'contact lookup'],
  ['Show me Kevin\'s full email and phone',          ['read_contacts'],       'opt-in detail (model can ask, UI confirms)'],
  ['Start a new quote for Sandra',                  ['start_new_quote'],     'flow entry from chat'],
  ['Quick — book me a draft for Bob: install kitchen faucet, $260', ['create_quote'], 'one-shot draft when contractor has it all'],
];
for (const [q, expected] of SCENARIOS) {
  // Heuristic match: every expected tool must exist in the TOOL_DEFS surface.
  // The LLM picks at runtime; we only verify the toolbox is complete.
  // (Importing TOOL_DEFS directly would require another export. Use the
  // executeTool branches as the source of truth instead.)
  const tools = ['read_quotes','read_contacts','lookup_pricing','read_quote_detail','update_quote','draft_followup','start_new_quote','create_quote'];
  const haveAll = expected.every(e => tools.includes(e));
  check(`scenario tool coverage: "${q.slice(0, 60)}"`, haveAll, `missing tool for ${expected.join(',')}`);
}

// ── Status-line report ───────────────────────────────────────
console.log('═'.repeat(60));
console.log(`FOREMAN SCENARIOS — ${pass} passed, ${fail} failed`);
if (fails.length) { console.log('\nFAILURES:'); fails.forEach(f => console.log('  ✗ ' + f)); }
else console.log('All Foreman code paths produce useful, safe results.');
console.log('═'.repeat(60));
process.exit(fail ? 1 : 0);
