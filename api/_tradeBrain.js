// ═══════════════════════════════════════════════════════════
// PUNCHLIST — Trade Intelligence (Simplified)
// Regional pricing, trade inference, and utility functions
// AI handles scope generation — this provides supporting context
// ═══════════════════════════════════════════════════════════

// ── Supported Trades (used for dropdowns and trade detection) ──
export const TRADES = [
  'Plumber',
  'Electrician', 
  'HVAC',
  'Carpenter',
  'General Contractor',
  'Landscaping',
  'Roofing',
  'Painter',
  'Handyman',
  'Other',
];

// ── Trade Aliases for auto-detection ──
const TRADE_ALIASES = {
  Plumber: ['plumb','plumber','plumbing','drain','faucet','toilet','water heater','hot water','leak','pipe','sewer','fixture','tap','shower','bathtub','sink','garburator','sump'],
  Electrician: ['electric','electrician','electrical','wiring','outlet','panel','breaker','light','switch','fixture','ev charger','ev outlet','pot light','recessed','ceiling fan','smoke detector'],
  HVAC: ['hvac','furnace','air conditioner','ac ','a/c','heat pump','thermostat','ductwork','no heat','no cool','mini split','humidifier','boiler','fireplace'],
  Carpenter: ['carpenter','carpentry','trim','baseboard','door','crown','moulding','cabinet','deck','framing','closet','shelf','railing','stair'],
  'General Contractor': ['gc ','general contractor','renovation','reno','remodel','bathroom reno','kitchen reno','basement','addition','demo','demolition'],
  Landscaping: ['landscape','landscaping','lawn','sod','patio','fence','deck','retaining wall','mulch','planting','tree','shrub','irrigation','sprinkler'],
  Roofing: ['roof','roofing','shingle','soffit','fascia','eavestrough','gutter','downspout','flashing','leak roof'],
  Painter: ['painter','painting','paint','repaint','stain','primer','ceiling paint','exterior paint','interior paint'],
  Handyman: ['handyman','handy','odd job','small repair','fix ','repair ','mount','install ','assemble'],
};

// ── Regional Pricing Multipliers ──
// Base = Alberta (1.0). Other provinces/states adjusted.
const REGIONAL_MULTIPLIERS = {
  // Canada
  AB: 1.0,    // Alberta (baseline)
  BC: 1.18,   // BC higher COL
  ON: 1.12,   // Ontario GTA influence
  QC: 1.05,   // Quebec moderate
  MB: 0.95,   // Manitoba slightly lower
  SK: 0.97,   // Saskatchewan similar
  NB: 0.92,   // Maritimes lower
  NS: 0.94,
  NL: 0.98,   // Newfoundland
  PE: 0.90,   // PEI lowest
  NT: 1.25,   // Territories higher
  NU: 1.30,
  YT: 1.22,
  // US States (sampling)
  CA: 1.35,   // California highest
  NY: 1.30,   // New York
  WA: 1.18,   // Washington
  MA: 1.22,   // Massachusetts
  CO: 1.12,   // Colorado
  TX: 0.95,   // Texas lower
  FL: 1.05,   // Florida moderate
  AZ: 1.02,
  IL: 1.08,   // Illinois
  PA: 1.05,   // Pennsylvania
  GA: 0.98,   // Georgia
  NC: 0.96,   // North Carolina
  VA: 1.08,   // Virginia
  NJ: 1.25,   // New Jersey
  CT: 1.20,   // Connecticut
  OH: 0.90,   // Ohio lower
  MI: 0.95,   // Michigan
  MN: 1.02,   // Minnesota
  OR: 1.12,   // Oregon
  NV: 1.08,   // Nevada
  MD: 1.15,   // Maryland
  SC: 0.92,   // South Carolina
  TN: 0.90,   // Tennessee
  IN: 0.88,   // Indiana
  MO: 0.88,   // Missouri
  WI: 0.95,   // Wisconsin
  KY: 0.87,   // Kentucky
  LA: 0.88,   // Louisiana
  AL: 0.85,   // Alabama
  OK: 0.85,   // Oklahoma
  IA: 0.88,   // Iowa
  KS: 0.87,   // Kansas
  AR: 0.84,   // Arkansas
  MS: 0.82,   // Mississippi (lowest)
  NE: 0.90,   // Nebraska
  NM: 0.92,   // New Mexico
  UT: 1.02,   // Utah
  WV: 0.83,   // West Virginia
  ID: 0.95,   // Idaho
  HI: 1.40,   // Hawaii (highest)
  AK: 1.35,   // Alaska
  NH: 1.10,   // New Hampshire
  ME: 1.02,   // Maine
  VT: 1.05,   // Vermont
  RI: 1.12,   // Rhode Island
  DE: 1.05,   // Delaware
  MT: 0.95,   // Montana
  WY: 0.95,   // Wyoming
  ND: 0.92,   // North Dakota
  SD: 0.90,   // South Dakota
  DC: 1.28,   // Washington DC
};

const REGION_LABELS = {
  AB:'Alberta', BC:'British Columbia', ON:'Ontario', QC:'Quebec', MB:'Manitoba',
  SK:'Saskatchewan', NB:'New Brunswick', NS:'Nova Scotia', NL:'Newfoundland',
  PE:'PEI', NT:'NWT', NU:'Nunavut', YT:'Yukon',
  CA:'California', NY:'New York', TX:'Texas', FL:'Florida', WA:'Washington',
  CO:'Colorado', IL:'Illinois', OH:'Ohio', PA:'Pennsylvania', GA:'Georgia',
  AZ:'Arizona', MA:'Massachusetts', NJ:'New Jersey', CT:'Connecticut',
  VA:'Virginia', NC:'North Carolina', SC:'South Carolina', MD:'Maryland',
  MI:'Michigan', MN:'Minnesota', WI:'Wisconsin', IN:'Indiana', MO:'Missouri',
  TN:'Tennessee', KY:'Kentucky', LA:'Louisiana', AL:'Alabama', MS:'Mississippi',
  OR:'Oregon', NV:'Nevada', UT:'Utah', NM:'New Mexico', NE:'Nebraska',
  IA:'Iowa', KS:'Kansas', OK:'Oklahoma', AR:'Arkansas', WV:'West Virginia',
  ID:'Idaho', MT:'Montana', WY:'Wyoming', SD:'South Dakota', ND:'North Dakota',
  HI:'Hawaii', AK:'Alaska', NH:'New Hampshire', VT:'Vermont', ME:'Maine',
  RI:'Rhode Island', DE:'Delaware', DC:'Washington DC',
};

// ═══════════════════════════════════════════════════════════
// EXPORTED FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Infer the trade from job description
 * Falls back to selectedTrade if no match found
 */
export function inferTrade(description, selectedTrade) {
  if (selectedTrade && selectedTrade !== 'Other' && TRADES.includes(selectedTrade)) {
    return selectedTrade;
  }
  const text = String(description || '').toLowerCase();
  for (const [trade, aliases] of Object.entries(TRADE_ALIASES)) {
    if (aliases.some(alias => text.includes(alias))) {
      return trade;
    }
  }
  return selectedTrade || 'Other';
}

/**
 * Get regional price adjustment for an item
 * Returns adjusted { lo, mid, hi } with price note
 */
export function regionalize(item, province = 'AB') {
  const mult = REGIONAL_MULTIPLIERS[province] || 1.0;
  const label = REGION_LABELS[province] || province;
  
  // Handle items that might only have lo/hi (from systemCatalog)
  const lo = item.lo || 0;
  const hi = item.hi || 0;
  const mid = item.mid || Math.round((lo + hi) / 2);
  
  if (mult === 1.0) {
    return {
      lo, mid, hi,
      price_source: 'system',
      price_note: null,
    };
  }
  return {
    lo: Math.round(lo * mult),
    mid: Math.round(mid * mult),
    hi: Math.round(hi * mult),
    price_source: 'regional',
    price_note: `Adjusted for ${label}`,
  };
}

/**
 * Detect signals in job description for AI context
 */
export function inferSignals(description = '') {
  const text = String(description || '').toLowerCase();
  return {
    customerSupplied: /customer supplied|client supplied|i already bought|owner supplied/.test(text),
    urgency: /today|urgent|asap|immediately|same day|right away/.test(text),
    hiddenRisk: /behind wall|concealed|unknown|maybe|might|not sure|investigate|diagnostic|access/.test(text),
    budgetSensitive: /cheap|cheaper|budget|lowest|basic|good enough/.test(text),
    premium: /best|premium|high end|clean finish|top quality|best value/.test(text),
  };
}

/**
 * Generate price spread from a mid-point value
 */
export function priceSpread(mid) {
  const m = Number(mid) || 100;
  return { lo: Math.round(m * 0.78), mid: m, hi: Math.round(m * 1.28) };
}

/**
 * Summarize historical quotes for AI context (few-shot pricing)
 */
export function summarizeHistory(historicalQuotes) {
  const quotes = Array.isArray(historicalQuotes) ? historicalQuotes : [];
  if (!quotes.length) return { frequent: [], dominantTrade: null, quoteCount: 0, wonCount: 0 };
  
  const tradeCounter = new Map();
  const itemMap = new Map();
  let quoteCount = 0, wonCount = 0;
  
  for (const row of quotes) {
    if (!row || typeof row !== 'object') continue;
    quoteCount++;
    if (row.trade) tradeCounter.set(row.trade, (tradeCounter.get(row.trade) || 0) + 1);
    if (['approved', 'scheduled', 'completed'].includes(row.status)) wonCount++;
    
    const items = Array.isArray(row.line_items) ? row.line_items : (Array.isArray(row.items) ? row.items : []);
    for (const item of items) {
      if (!item) continue;
      const desc = String(item.name || item.description || '').trim();
      if (!desc) continue;
      const key = desc.toLowerCase();
      const price = Number(item.unit_price || item.price || 0);
      const qty = Number(item.quantity || 1);
      const cur = itemMap.get(key) || { description: desc, count: 0, total: 0, wins: 0 };
      cur.count += qty;
      cur.total += price * qty;
      if (['approved', 'scheduled'].includes(row.status)) cur.wins++;
      itemMap.set(key, cur);
    }
  }
  
  const frequent = [...itemMap.values()]
    .filter(r => r.count >= 1 && r.total > 0)
    .map(r => ({ description: r.description, count: r.count, avg: Math.round(r.total / r.count), wins: r.wins }))
    .sort((a, b) => (b.wins * 5 + b.count) - (a.wins * 5 + a.count))
    .slice(0, 10);
  
  const dominantTrade = [...tradeCounter.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  
  return { frequent, dominantTrade, quoteCount, wonCount };
}

// ═══════════════════════════════════════════════════════════
// LEGACY EXPORTS (for backwards compatibility)
// These are minimal stubs to prevent import errors
// ═══════════════════════════════════════════════════════════

// TRADE_BASELINES is now just a simple map for trade dropdown/demo
export const TRADE_BASELINES = TRADES.reduce((acc, trade) => {
  acc[trade] = {
    display: trade,
    aliases: TRADE_ALIASES[trade] || [],
    starterPrompts: getStarterPrompts(trade),
  };
  return acc;
}, {});

function getStarterPrompts(trade) {
  const prompts = {
    Plumber: [
      'Replace kitchen faucet — customer has new Moen faucet ready.',
      'Gas water heater replacement — 50 gallon, power vent.',
      'Toilet running constantly, need to diagnose and repair.',
    ],
    Electrician: [
      'Install EV charger outlet in garage — 50A circuit needed.',
      'Add 4 pot lights in living room ceiling.',
      'Panel upgrade from 100A to 200A service.',
    ],
    HVAC: [
      'Furnace not igniting — need diagnostic and repair.',
      'Replace central AC condenser — system is 18 years old.',
      'Install smart thermostat — Ecobee or Nest.',
    ],
    Carpenter: [
      'Install baseboard trim throughout main floor — ~120 linear feet.',
      'Replace interior door — pre-hung, including casing.',
      'Build closet organizer system with shelves and rods.',
    ],
    'General Contractor': [
      'Bathroom renovation — gut and rebuild, 5x8 space.',
      'Basement development — framing, electrical, drywall.',
      'Kitchen cabinet replacement with new countertops.',
    ],
    Landscaping: [
      'Install patio pavers — 200 sq ft area.',
      'Replace front lawn with sod — ~1000 sq ft.',
      'Build 4-foot cedar fence — 60 linear feet.',
    ],
    Roofing: [
      'Repair roof leak around vent stack.',
      'Replace missing shingles after wind damage.',
      'Install new eavestrough and downspouts.',
    ],
    Painter: [
      'Repaint two bedrooms — walls and trim, prep included.',
      'Exterior trim paint — scrape, prime, two coats.',
      'Kitchen cabinet refinishing — sand and repaint.',
    ],
    Handyman: [
      'Mount 65" TV on wall with cord concealment.',
      'Fix squeaky stairs and loose railing.',
      'Install smart doorbell and deadbolt.',
    ],
    Other: [
      'Describe the job in detail for AI-powered scope generation.',
    ],
  };
  return prompts[trade] || prompts.Other;
}

// Stub functions that were used by ai-scope fallback
// Now they just return empty/minimal results since AI handles everything
export function pickJob(description, trade) {
  return {
    baseline: TRADE_BASELINES[trade] || TRADE_BASELINES.Other,
    job: { name: 'Custom job', items: [], insights: [], assumptions: [] },
  };
}

export function applyHistoryToSeed(seed, hist) {
  // Just return the seed unchanged - AI handles pricing context
  return seed;
}

// Empty SYSTEM_CATALOG - use systemCatalog.js instead
export const SYSTEM_CATALOG = [];

// ═══════════════════════════════════════════════════════════
// PRICE ANCHORS — server-side copy for AI prompt generation
// ═══════════════════════════════════════════════════════════

export const JOB_PRICE_RANGES = {
  Plumber:     { simple: { lo: 200, hi: 550 }, medium: { lo: 500, hi: 1800 }, complex: { lo: 1500, hi: 5000 } },
  Electrician: { simple: { lo: 200, hi: 600 }, medium: { lo: 500, hi: 2000 }, complex: { lo: 1800, hi: 8000 } },
  HVAC:        { simple: { lo: 200, hi: 600 }, medium: { lo: 500, hi: 3000 }, complex: { lo: 3000, hi: 12000 } },
  Carpenter:   { simple: { lo: 200, hi: 600 }, medium: { lo: 500, hi: 2000 }, complex: { lo: 1500, hi: 6000 } },
  'General Contractor': { simple: { lo: 300, hi: 1000 }, medium: { lo: 800, hi: 4000 }, complex: { lo: 3000, hi: 15000 } },
  Roofing:     { simple: { lo: 300, hi: 800 }, medium: { lo: 800, hi: 3000 }, complex: { lo: 3000, hi: 15000 } },
  Painter:     { simple: { lo: 200, hi: 600 }, medium: { lo: 500, hi: 2000 }, complex: { lo: 1500, hi: 6000 } },
  Landscaping: { simple: { lo: 200, hi: 500 }, medium: { lo: 400, hi: 2000 }, complex: { lo: 1500, hi: 8000 } },
};

const _ANCHORS = {
  Plumber:     { Labour: 260, Materials: 160, Services: 102 },
  Electrician: { Labour: 370, Materials: 166, Services: 110 },
  HVAC:        { Labour: 530, Materials: 376, Services: 114 },
  Carpenter:   { Labour: 280, Materials: 200, Services: 90 },
  'General Contractor': { Labour: 280, Materials: 213, Services: 93 },
  Roofing:     { Labour: 400, Materials: 350, Services: 120 },
  Painter:     { Labour: 250, Materials: 120, Services: 80 },
  Landscaping: { Labour: 200, Materials: 150, Services: 80 },
};

export function getAIPricingContext(trade) {
  const ranges = JOB_PRICE_RANGES[trade] || JOB_PRICE_RANGES['Plumber'];
  const a = _ANCHORS[trade] || _ANCHORS['Plumber'];
  return `Job totals: simple $${ranges.simple.lo}-$${ranges.simple.hi}, medium $${ranges.medium.lo}-$${ranges.medium.hi}, complex $${ranges.complex.lo}-$${ranges.complex.hi}. `
    + `Line item avgs: labour $${a.Labour}, materials $${a.Materials}, service call $${a.Services}.`;
}
