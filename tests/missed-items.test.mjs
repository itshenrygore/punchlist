// ═══════════════════════════════════════════════════════════════
// Smart commonly-missed-items — confirms buildConfidence uses the
// OBJECTS taxonomy to surface job-specific gaps instead of the old
// stock "Cleanup not listed" on every quote.
//
//   node tests/missed-items.test.mjs
// ═══════════════════════════════════════════════════════════════
import { buildConfidence } from '../src/lib/pricing.js';

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; }
  else { fail++; console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

function names(arr) { return arr.map(i => (i.label || '').toLowerCase()); }

// Water-heater swap — expansion tank, T&P valve, shutoff valve should be flagged
{
  const items = [
    { name: 'Remove & dispose old water heater', unit_price: 120, quantity: 1 },
    { name: 'Supply & install 50 gal gas heater', unit_price: 980, quantity: 1 },
  ];
  const c = buildConfidence(items, [], {
    hasCustomer: true, hasScope: true,
    description: 'Replace 50 gallon gas water heater',
    trade: 'Plumber', province: 'AB',
  });
  const labels = names(c.checks || []);
  const surfaced = labels.filter(l => l.includes('not listed'));
  check('water heater: at least one missed item surfaces', surfaced.length >= 1, JSON.stringify(labels));
  check('water heater: surface IS context-specific (not generic cleanup)',
    surfaced.some(l => /expansion|t&p|shutoff|gas line|venting|anode|thermocouple|mixing/i.test(l)),
    `surfaced: ${surfaced.join(' | ')}`);
  check('water heater: does NOT show stock "Cleanup not listed" when smart items found',
    !labels.includes('cleanup not listed') || surfaced.length === 0,
    `labels: ${labels.join(' | ')}`);
}

// Panel upgrade — surge, ground rod, breaker, meter
{
  const items = [
    { name: 'Panel upgrade to 200A', unit_price: 3800, quantity: 1 },
  ];
  const c = buildConfidence(items, [], {
    hasCustomer: true, hasScope: true,
    description: '200 amp panel upgrade in Calgary',
    trade: 'Electrician', province: 'AB',
  });
  const labels = names(c.checks || []);
  const surfaced = labels.filter(l => l.includes('not listed'));
  check('panel upgrade: surfaces electrician-specific items', surfaced.length >= 1, JSON.stringify(labels));
  check('panel upgrade: items relate to panels',
    surfaced.some(l => /breaker|wire|ground rod|surge protector|subpanel|meter|disconnect/i.test(l)),
    `surfaced: ${surfaced.join(' | ')}`);
}

// Kitchen faucet swap — supply lines, p-trap, shutoff valve
{
  const items = [
    { name: 'Install kitchen faucet', unit_price: 220, quantity: 1 },
  ];
  const c = buildConfidence(items, [], {
    hasCustomer: true, hasScope: true,
    description: 'Replace kitchen faucet — customer supplied',
    trade: 'Plumber', province: 'AB',
  });
  const labels = names(c.checks || []);
  const surfaced = labels.filter(l => l.includes('not listed'));
  check('kitchen faucet: surfaces companion items', surfaced.length >= 1, JSON.stringify(labels));
  check('kitchen faucet: items relate to faucet plumbing',
    surfaced.some(l => /supply|p-trap|shutoff|drain|cartridge|caulk/i.test(l)),
    `surfaced: ${surfaced.join(' | ')}`);
}

// Furnace + AC replacement — refrigerant, thermostat, condenser pad, filter
{
  const items = [
    { name: 'Remove & dispose old furnace + AC', unit_price: 475, quantity: 1 },
    { name: 'Supply & install gas furnace', unit_price: 4180, quantity: 1 },
    { name: 'Supply & install central AC', unit_price: 4625, quantity: 1 },
  ];
  const c = buildConfidence(items, [], {
    hasCustomer: true, hasScope: true,
    description: 'Furnace and AC replacement — full system',
    trade: 'HVAC', province: 'AB',
  });
  const labels = names(c.checks || []);
  const surfaced = labels.filter(l => l.includes('not listed'));
  check('furnace+ac: surfaces HVAC companion items', surfaced.length >= 1, JSON.stringify(labels));
  check('furnace+ac: items relate to HVAC',
    surfaced.some(l => /thermostat|filter|refrigerant|condenser|line set|condensate|ignitor|capacitor/i.test(l)),
    `surfaced: ${surfaced.join(' | ')}`);
}

// EV charger — what should surface
{
  const items = [
    { name: 'Install EV charger', unit_price: 800, quantity: 1 },
  ];
  const c = buildConfidence(items, [], {
    hasCustomer: true, hasScope: true,
    description: 'EV charger install Tesla wall connector',
    trade: 'Electrician', province: 'AB',
  });
  const labels = names(c.checks || []);
  const surfaced = labels.filter(l => l.includes('not listed'));
  check('EV charger: surfaces something', surfaced.length >= 1, JSON.stringify(labels));
}

// Blank quote — should fall back to legacy generic warnings (cleanup,
// pricing, etc.) since there's no object to detect.
{
  const c = buildConfidence([], [], {
    hasCustomer: false, hasScope: false,
    description: '', trade: 'Other',
  });
  const labels = names(c.checks || []);
  check('blank quote: still flags missing customer + no items', labels.length >= 2 && labels.some(l => /no customer|no scope/i.test(l)));
}

// Smart-derived items carry a smartTerm field that the UI uses to add
// the right line item via the + Add button. Verify presence.
{
  const items = [{ name: 'Install kitchen faucet', unit_price: 220, quantity: 1 }];
  const c = buildConfidence(items, [], {
    description: 'Replace kitchen faucet',
    trade: 'Plumber', hasCustomer: true,
  });
  const smartChecks = (c.checks || []).filter(x => x.smartTerm);
  check('smart checks carry smartTerm for one-tap add',
    smartChecks.length >= 1 && smartChecks.every(s => typeof s.smartTerm === 'string'),
    JSON.stringify(smartChecks.slice(0, 2)));
}

console.log(`\n${pass} passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
