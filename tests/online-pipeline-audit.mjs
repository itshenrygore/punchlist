// ═══════════════════════════════════════════════════════════════
// PUNCHLIST — Online (AI) Pipeline Audit
// The live model can't run without an API key, but the code that
// turns a model response into confident line items IS testable:
//   • repairTruncatedJson — salvage a max_tokens-cut response
//   • normalizeItems      — clamp/shape items into a safe quote row
//   • classifyItemServer  — Labour / Materials / Services bucketing
// This is the path that decides how trustworthy online results are.
//
//   node tests/online-pipeline-audit.mjs
// ═══════════════════════════════════════════════════════════════
import { repairTruncatedJson, normalizeItems, classifyItemServer } from '../api/ai-scope.js';

let pass = 0, fail = 0;
const fails = [];
function check(name, cond, detail = '') {
  if (cond) { pass++; }
  else { fail++; fails.push(`${name}${detail ? ' — ' + detail : ''}`); }
}

// ── 1. classifyItemServer ──
const CLASSIFY = [
  ['Install gas furnace — 96% AFUE', 'labour'],
  ['Supply & install central AC condenser', 'labour'],
  ['Faucet supply lines', 'materials'],
  ['Copper pipe and fittings', 'materials'],
  ['City permit + final inspection', 'services'],
  ['Old equipment disposal and haul-away', 'services'],
  ['Dispatch / diagnostic', 'services'],
  ['Replace P-trap', 'labour'],
  ['Wax ring', 'materials'],
  ['Drywall patch and paint', 'labour'],
];
for (const [n, want] of CLASSIFY) {
  check(`classify "${n}"`, classifyItemServer(n) === want, `got ${classifyItemServer(n)}, want ${want}`);
}

// ── 2. normalizeItems — confidence + safety ──
const rawItems = [
  // well-formed
  { description: 'Install gas furnace — 96% AFUE, 80k BTU', quantity: 1, unit_price: 4180, lo: 3800, mid: 4180, hi: 4600, category: 'Labour', why: 'Core unit', include_confidence: 'high' },
  // missing prices → must clamp to ≥1, derive mid
  { description: 'Dispatch / diagnostic', lo: 120, hi: 160 },
  // $0 / negative price → must clamp to ≥1
  { description: 'Free site visit credit', unit_price: 0, lo: 0, hi: 0 },
  // hi < lo (model error) → hi must be reconciled to ≥ mid
  { description: 'Lineset and flue liner', lo: 600, hi: 200 },
  // missing category → must classify
  { description: 'Ecobee smart thermostat' },
  // empty description → must be dropped
  { description: '' },
  // absurdly long description → must truncate to 220
  { description: 'X'.repeat(500), lo: 50, hi: 90 },
];
const norm = normalizeItems(rawItems);
check('drops empty-description items', norm.length === 6, `got ${norm.length}`);
check('every item unit_price ≥ 1', norm.every(i => i.unit_price >= 1));
check('every item lo ≤ mid ≤ hi', norm.every(i => i.lo <= i.mid && i.mid <= i.hi),
  JSON.stringify(norm.find(i => !(i.lo <= i.mid && i.mid <= i.hi))));
check('every item has a category', norm.every(i => i.category && i.category.length));
check('truncates description to ≤ 220 chars', norm.every(i => i.description.length <= 220));
check('$0 line clamped to ≥ 1', (norm.find(i => i.description.startsWith('Free')) || {}).unit_price >= 1);

// ── 3. repairTruncatedJson — the #1 real-world AI failure ──
// A Haiku response cut off by max_tokens mid-way through "assumptions".
const truncated = `{"jobType":"replace","scope_summary":"Replace 50 gal gas water heater","items":[
  {"description":"Remove & dispose old water heater","quantity":1,"unit_price":120,"lo":90,"mid":120,"hi":160,"category":"Services"},
  {"description":"Supply & install 50 gal gas heater","quantity":1,"unit_price":1290,"lo":1100,"mid":1290,"hi":1500,"category":"Labour"},
  {"description":"Expansion tank + T&P valve","quantity":1,"unit_price":185,"lo":150,"mid":185,"hi":230,"category":"Materials"}
],"gaps":["Confirm venting type","Check expans`;
const repaired = repairTruncatedJson(truncated);
check('repairs truncated response', repaired && Array.isArray(repaired.items) && repaired.items.length === 3,
  repaired ? `got ${repaired.items?.length} items` : 'returned null');
check('repaired items normalize confidently', (() => {
  if (!repaired) return false;
  const n = normalizeItems(repaired.items);
  return n.length === 3 && n.every(i => i.unit_price >= 1 && i.lo <= i.hi);
})());

// Truncated mid-object (last item incomplete) → should still salvage the complete ones.
const midObject = `{"items":[
  {"description":"Panel upgrade to 200A","quantity":1,"unit_price":2800,"lo":2400,"mid":2800,"hi":3200,"category":"Labour"},
  {"description":"Permit + ESA inspection","quantity":1,"unit_price":350,"lo":300,"mid":3`;
const repaired2 = repairTruncatedJson(midObject);
check('salvages complete items, drops incomplete tail', repaired2 && repaired2.items.length === 1,
  repaired2 ? `got ${repaired2.items?.length}` : 'null');

// Garbage in → null out (caller then falls back to offline engine).
check('unrepairable garbage → null', repairTruncatedJson('not json at all {[') === null);
check('empty string → null', repairTruncatedJson('') === null);

// ── 4. End-to-end: realistic complete AI responses across trades ──
const E2E = [
  { trade: 'Plumber', raw: '{"jobType":"replace","items":[{"description":"Remove old faucet","lo":40,"hi":80,"category":"Labour"},{"description":"Install kitchen faucet","lo":150,"hi":220,"category":"Labour"},{"description":"Supply lines","lo":15,"hi":30,"category":"Materials"}]}' },
  { trade: 'Electrician', raw: '{"items":[{"description":"Install EV charger circuit","lo":600,"hi":900,"category":"Labour"},{"description":"50A breaker","lo":40,"hi":70,"category":"Materials"},{"description":"Permit","lo":120,"hi":180,"category":"Services"}]}' },
  { trade: 'Roofing', raw: '{"items":[{"description":"Replace vent boot","lo":120,"hi":200,"category":"Labour"},{"description":"Roof sealant","lo":15,"hi":35,"category":"Materials"}]}' },
];
for (const c of E2E) {
  let parsed; try { parsed = JSON.parse(c.raw); } catch { parsed = repairTruncatedJson(c.raw); }
  const items = normalizeItems(parsed?.items || []);
  check(`e2e ${c.trade}: ≥2 confident items`, items.length >= 2 && items.every(i => i.unit_price >= 1 && i.description),
    `got ${items.length}`);
}

// ── Report ──
console.log('\n' + '═'.repeat(60));
console.log(`ONLINE PIPELINE — ${pass} passed, ${fail} failed`);
if (fails.length) { console.log('\nFAILURES:'); fails.forEach(f => console.log('  ✗ ' + f)); }
else console.log('All online-pipeline transforms produce confident, safe line items.');
console.log('═'.repeat(60));
process.exit(fail ? 1 : 0);
