// ═══════════════════════════════════════════════════════════════
// PUNCHLIST — Offline Quote Suggestion Audit
// Exercises getSmartSuggestions() across realistic jobs in every
// trade and reports coverage + sanity so we can validate the
// offline engine against real contractor knowledge.
//
//   node tests/quote-suggestion-audit.mjs           # full report
//   node tests/quote-suggestion-audit.mjs --fails    # only problems
// ═══════════════════════════════════════════════════════════════
import { getSmartSuggestions } from '../shared/smartCatalog.js';

const FAILS_ONLY = process.argv.includes('--fails');

// Each case: { trade, desc, expect?: [substrings that SHOULD appear in
// some suggested item name], avoid?: [substrings that should NOT appear] }
// `expect` is a soft signal — a contractor-knowledge sanity anchor.
const CASES = [
  // ── PLUMBING ──
  { trade: 'Plumber', desc: 'Replace 50 gallon gas water heater, old one is leaking', expect: ['water heater'], avoid: ['urinal','panel'] },
  { trade: 'Plumber', desc: 'Replace kitchen faucet, customer has a new Moen ready', expect: ['faucet'] },
  { trade: 'Plumber', desc: 'Running toilet, needs diagnosis and repair', expect: ['toilet'] },
  { trade: 'Plumber', desc: 'Whole home poly b repipe to PEX, 1990 house, 2 bathrooms', expect: ['pex','repipe','pipe'], avoid: ['urinal','faucet aerator'] },
  { trade: 'Plumber', desc: 'Clogged kitchen sink drain, water backing up', expect: ['drain','snake','auger'] },
  { trade: 'Plumber', desc: 'Install sump pump in basement with battery backup', expect: ['sump'] },
  { trade: 'Plumber', desc: 'Tankless water heater install, Navien, convert from tank', expect: ['tankless','water heater'] },
  { trade: 'Plumber', desc: 'Frozen burst pipe in basement, copper, needs repair', expect: ['pipe'] },
  { trade: 'Plumber', desc: 'Add gas line for new BBQ on the deck', expect: ['gas'] },
  { trade: 'Plumber', desc: 'Relocate kitchen sink plumbing to island, rough-in new drain and vent', expect: ['rough','drain','vent'] },
  { trade: 'Plumber', desc: 'Garburator not working, replace garbage disposal', expect: ['garburator','disposal'] },
  { trade: 'Plumber', desc: 'Sewer line backing up, need camera inspection and auger', expect: ['sewer','camera','auger'] },
  { trade: 'Plumber', desc: 'Install new shower valve and trim kit, leaking behind wall', expect: ['shower','valve'] },

  // ── ELECTRICAL ──
  { trade: 'Electrician', desc: 'Upgrade electrical panel from 100A to 200A service', expect: ['panel','200'], avoid: ['water heater'] },
  { trade: 'Electrician', desc: 'Install EV charger in garage, NEMA 14-50, 50A circuit', expect: ['ev','charger','circuit'] },
  { trade: 'Electrician', desc: 'Add 6 pot lights in living room ceiling on a dimmer', expect: ['pot light','recessed','dimmer'] },
  { trade: 'Electrician', desc: 'Dead outlet in bedroom, not working, troubleshoot', expect: ['outlet'] },
  { trade: 'Electrician', desc: 'Install ceiling fan in master bedroom, no existing box', expect: ['fan','box'] },
  { trade: 'Electrician', desc: 'Whole home rewire, knob and tube, 1940s house', expect: ['rewire','wire'] },
  { trade: 'Electrician', desc: 'Hot tub wiring, 240v GFCI disconnect, 60A', expect: ['hot tub','disconnect','gfci'] },
  { trade: 'Electrician', desc: 'Install hardwired smoke detectors, interconnected, 5 units', expect: ['smoke'] },
  { trade: 'Electrician', desc: 'Add subpanel in detached garage, trench and conduit', expect: ['subpanel','conduit'] },
  { trade: 'Electrician', desc: 'Generator transfer switch install with interlock', expect: ['transfer switch','generator','interlock'] },
  { trade: 'Electrician', desc: 'Breaker keeps tripping in kitchen, diagnose', expect: ['breaker'] },

  // ── HVAC ──
  { trade: 'HVAC', desc: 'Furnace not igniting, no heat, need diagnostic and repair', expect: ['furnace','ignitor','igniter','flame sensor'] },
  { trade: 'HVAC', desc: 'Replace central AC condenser, 3 ton, 18 years old', expect: ['condenser','ac','air condition'] },
  { trade: 'HVAC', desc: 'Install ductless mini split, single zone wall mount', expect: ['mini split','line set'] },
  { trade: 'HVAC', desc: 'Install Ecobee smart thermostat, has C wire', expect: ['thermostat'] },
  { trade: 'HVAC', desc: 'AC not cooling, blowing warm air, low refrigerant suspected', expect: ['refrigerant','capacitor','ac'] },
  { trade: 'HVAC', desc: 'Replace furnace and AC full system, 96 AFUE, 16 SEER', expect: ['furnace','condenser','ac'] },
  { trade: 'HVAC', desc: 'Boiler not working, no heat, hydronic system', expect: ['boiler'] },
  { trade: 'HVAC', desc: 'Install whole home humidifier on furnace', expect: ['humidifier'] },
  { trade: 'HVAC', desc: 'Install garage unit heater with gas line', expect: ['garage heater','heater'] },
  { trade: 'HVAC', desc: 'Annual furnace tune up and maintenance', expect: ['furnace','tune','service','maintenance'] },

  // ── CARPENTER ──
  { trade: 'Carpenter', desc: 'Install baseboard trim throughout main floor, 120 linear feet', expect: ['baseboard'] },
  { trade: 'Carpenter', desc: 'Replace prehung interior bedroom door with casing', expect: ['door'] },
  { trade: 'Carpenter', desc: 'Build a 12x16 cedar deck with railing and stairs', expect: ['deck','railing'] },
  { trade: 'Carpenter', desc: 'Build 6 foot privacy fence, 60 linear feet cedar', expect: ['fence'] },
  { trade: 'Carpenter', desc: 'Install crown moulding in living and dining room', expect: ['crown'] },
  { trade: 'Carpenter', desc: 'Squeaky stairs and loose handrail, repair', expect: ['stair','rail'] },

  // ── ROOFING ──
  { trade: 'Roofing', desc: 'Replace missing shingles after wind storm', expect: ['shingle'] },
  { trade: 'Roofing', desc: 'Roof leak around plumbing vent stack, replace boot', expect: ['vent boot','boot','flashing'] },
  { trade: 'Roofing', desc: 'Install new eavestrough and downspouts, full house', expect: ['gutter','eavestrough','downspout'] },
  { trade: 'Roofing', desc: 'Chimney flashing leak, reflash and seal', expect: ['chimney','flashing'] },
  { trade: 'Roofing', desc: 'Replace rotten soffit and fascia on north side', expect: ['soffit','fascia'] },

  // ── PAINTER ──
  { trade: 'Painter', desc: 'Repaint two bedrooms, walls and ceiling, prep included', expect: ['paint','primer'] },
  { trade: 'Painter', desc: 'Kitchen cabinet refinishing, sand and spray', expect: ['cabinet'] },
  { trade: 'Painter', desc: 'Exterior house repaint, scrape prime two coats', expect: ['exterior','paint'] },
  { trade: 'Painter', desc: 'Stain and seal the back deck', expect: ['stain','deck'] },

  // ── LANDSCAPING ──
  { trade: 'Landscaping', desc: 'Install 200 sq ft paver patio with base', expect: ['patio','paver'] },
  { trade: 'Landscaping', desc: 'Replace front lawn with sod, 1000 sq ft', expect: ['sod','lawn'] },
  { trade: 'Landscaping', desc: 'Build 24 inch retaining wall, 30 feet, block', expect: ['retaining','wall'] },
  { trade: 'Landscaping', desc: 'Install irrigation sprinkler system, 4 zones', expect: ['irrigation','sprinkler'] },

  // ── GENERAL CONTRACTOR ──
  { trade: 'General Contractor', desc: 'Gut and rebuild bathroom, 5x8, new tile and fixtures', expect: ['bathroom'] },
  { trade: 'General Contractor', desc: 'Develop basement, framing electrical drywall', expect: ['basement','framing','drywall'] },
  { trade: 'General Contractor', desc: 'Office tenant improvement, partition walls and drop ceiling', expect: ['partition','drop ceiling','wall'] },

  // ── SECONDARY TRADES (no OBJECTS taxonomy — relies on keyword fallback) ──
  { trade: 'Drywall', desc: 'Patch and repair drywall hole in hallway, tape and mud', expect: ['drywall','patch','mud'] },
  { trade: 'Flooring', desc: 'Install luxury vinyl plank, 600 sq ft main floor', expect: ['vinyl','plank','floor'] },
  { trade: 'Flooring', desc: 'Tile kitchen backsplash, subway tile, 30 sq ft', expect: ['tile','backsplash'] },
  { trade: 'Garage Doors', desc: 'Replace broken garage door spring, 16 foot door', expect: ['garage','spring'] },
  { trade: 'Appliance Install', desc: 'Install dishwasher, hook up water and drain', expect: ['dishwasher'] },
  { trade: 'Fencing', desc: 'Install 100 feet of chain link fence with gate', expect: ['fence','chain'] },
  { trade: 'Siding', desc: 'Replace damaged vinyl siding on the gable end', expect: ['siding'] },
  { trade: 'Windows & Doors', desc: 'Replace 5 vinyl windows, double hung', expect: ['window'] },
  { trade: 'Concrete', desc: 'Pour 20x20 concrete driveway with rebar', expect: ['concrete','driveway'] },
  { trade: 'Restoration', desc: 'Water damage cleanup in basement, extract and dry', expect: ['water','dry','extract','restoration'] },
  { trade: 'Handyman', desc: 'Mount 65 inch TV on wall and conceal cords', expect: [] },

  // ── HARD / EDGE CASES (trade left as Other — must infer) ──
  { trade: 'Other', desc: 'Replace kitchen faucet and shutoff valves', expect: ['faucet'] },
  { trade: 'Other', desc: 'Install pot lights and a dimmer in the kitchen', expect: ['pot light','recessed'] },
  { trade: 'Other', desc: 'Furnace making a loud noise and short cycling', expect: ['furnace'] },
];

function fmt$(n) { return '$' + Math.round(n).toLocaleString(); }
function lc(s) { return String(s || '').toLowerCase(); }

let totalCore = 0, zeroCore = 0, zeroAll = 0, expectMiss = 0, avoidHit = 0;
const problems = [];

for (const c of CASES) {
  const r = getSmartSuggestions({ description: c.desc, trade: c.trade, province: 'AB' });
  const ctx = r.context;
  const allItems = [...r.core, ...r.related, ...r.optional];
  const allNames = allItems.map(i => lc(i.name));
  const coreTotal = r.core.reduce((s, i) => s + (i.mid || 0), 0);
  const grandTotal = allItems.reduce((s, i) => s + (i.mid || 0), 0);

  totalCore += r.core.length;
  if (r.core.length === 0) zeroCore++;
  if (allItems.length === 0) zeroAll++;

  // Expect check: at least one expected substring appears somewhere
  let expectOk = true;
  if (c.expect && c.expect.length) {
    expectOk = c.expect.some(e => allNames.some(n => n.includes(lc(e))));
    if (!expectOk) expectMiss++;
  }
  // Avoid check
  let avoidBad = [];
  if (c.avoid && c.avoid.length) {
    avoidBad = c.avoid.filter(a => allNames.some(n => n.includes(lc(a))));
    if (avoidBad.length) avoidHit++;
  }

  const isProblem = r.core.length === 0 || allItems.length === 0 || !expectOk || avoidBad.length > 0;
  if (isProblem) {
    problems.push({ c, r, ctx, expectOk, avoidBad, coreTotal, grandTotal });
  }

  if (FAILS_ONLY && !isProblem) continue;

  const flag = isProblem ? '  ⚠️ ' : '  ✓ ';
  console.log(`\n${flag}[${c.trade}] "${c.desc}"`);
  console.log(`     ctx → trade:${ctx.trade} type:${ctx.jobType || '—'} conf:${ctx.confidence} objects:[${ctx.objects.join(', ') || '—'}]`);
  console.log(`     core(${r.core.length}) related(${r.related.length}) optional(${r.optional.length})  total≈${fmt$(grandTotal)}`);
  for (const i of r.core)     console.log(`       ● ${i.name}  ${fmt$(i.lo)}–${fmt$(i.hi)}   « ${i.reason}`);
  for (const i of r.related)  console.log(`       ○ ${i.name}  ${fmt$(i.lo)}–${fmt$(i.hi)}   « ${i.reason}`);
  for (const i of r.optional) console.log(`       · ${i.name}  ${fmt$(i.lo)}–${fmt$(i.hi)}`);
  if (!expectOk)      console.log(`     ⚠️ EXPECTED one of [${c.expect.join(', ')}] — none found`);
  if (avoidBad.length) console.log(`     ⚠️ AVOID violated: matched [${avoidBad.join(', ')}]`);
}

console.log('\n' + '═'.repeat(64));
console.log(`SUMMARY — ${CASES.length} jobs`);
console.log(`  avg core items/job : ${(totalCore / CASES.length).toFixed(2)}`);
console.log(`  jobs with 0 core   : ${zeroCore}`);
console.log(`  jobs with 0 items  : ${zeroAll}`);
console.log(`  expected-miss      : ${expectMiss}`);
console.log(`  avoid-violations   : ${avoidHit}`);
console.log(`  TOTAL PROBLEM JOBS : ${problems.length} / ${CASES.length}`);
console.log('═'.repeat(64));
