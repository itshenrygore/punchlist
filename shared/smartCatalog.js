// ═══════════════════════════════════════════════════════════════
// PUNCHLIST — SMART CATALOG FILTER v1
// Context-aware catalog scoring + ranking.
// Replaces keyword-spray with structured object/trade/jobtype matching.
// ═══════════════════════════════════════════════════════════════

import C from './systemCatalog.js';
import { extractJobContext, getRelatedObjects, getLocationObjects, OBJECTS } from './jobContext.js';
import { normalizeTrade, regionalize, roundPrice, anchorPrice } from './tradeBrain.js';

// ═══════════════════════════════════════════════════════════════
// ITEM SCORING — how relevant is this catalog item to the job?
// ═══════════════════════════════════════════════════════════════

/**
 * Score a single catalog item against job context.
 * Returns 0 (irrelevant) to 300+ (perfect match).
 */
// Word-boundary match for short terms to prevent false positives
const _shortTermCache = new Map();
function hayMatch(hay, term) {
  const t = term.toLowerCase();
  if (t.length <= 2) {
    let re = _shortTermCache.get(t);
    if (!re) {
      re = new RegExp(`(?:^|[\\s,/|(])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[\\s,/|)]|$)`, 'i');
      _shortTermCache.set(t, re);
    }
    return re.test(hay);
  }
  return hay.includes(t);
}

// Generic terms that match too broadly in related-term checks
const GENERIC_TERMS = new Set(['drain','pipe','valve','supply','hose','wire','box','duct','filter','gas','vent']);

/**
 * Pre-compute negative-object synonyms for a given trade/context.
 * Called once per query, passed to all scoreItem calls.
 */
function buildNegativeObjects(ctx, normalizedTrade) {
  if (!ctx.objects.length || !normalizedTrade || normalizedTrade === 'Other') return [];
  const negSyns = [];
  for (const [otherKey, otherDef] of Object.entries(OBJECTS)) {
    if (ctx.objects.includes(otherKey)) continue;
    if (otherDef.trade !== normalizedTrade) continue;
    const longSyns = otherDef.syn.filter(s => s.length > 4);
    if (longSyns.length) negSyns.push(longSyns);
  }
  return negSyns;
}

// Pre-compute searchable text for each catalog item (once at module load)
const _itemHay = new Map();
for (const item of C) {
  _itemHay.set(item, [item.n, item.d, ...(item.syn || [])].join(' ').toLowerCase());
}

function scoreItem(item, ctx, relatedTerms, locationObjects, negativeObjects, normalizedTrade) {
  // ── FAST TRADE GATE — skip before any string work ──
  if (normalizedTrade && normalizedTrade !== 'Other' && item.t !== normalizedTrade) {
    return { score: 0, hasContextSignal: false, hasObjectSignal: false };
  }

  let score = normalizedTrade && normalizedTrade !== 'Other' ? 50 : 0;
  let hasContextSignal = false;
  const hay = _itemHay.get(item);

  // ── OBJECT MATCH (strongest signal) ──
  let objectMatch = false;
  for (const obj of ctx.objects) {
    const objDef = OBJECTS[obj];
    if (!objDef) continue;

    // Direct synonym match: item mentions the exact object
    const directMatch = objDef.syn.some(s => hayMatch(hay, s));
    if (directMatch) {
      score += 120; // direct object match is the #1 signal
      objectMatch = true;
      hasContextSignal = true;
      break;
    }
  }

  // ── NEGATIVE-OBJECT PENALTY ──
  // Uses pre-computed negative object lists (computed once per query)
  if (!objectMatch && negativeObjects.length > 0) {
    for (const synList of negativeObjects) {
      if (synList.some(s => hayMatch(hay, s))) {
        score -= 80;
        break;
      }
    }
  }

  // Related object match (weaker but still relevant)
  let hasRelatedSignal = false;
  if (!objectMatch && relatedTerms.length > 0) {
    let relatedHits = 0;
    let specificHits = 0;
    for (const term of relatedTerms) {
      if (hayMatch(hay, term)) {
        relatedHits++;
        // A "specific" hit is one that's not a generic single word
        if (!GENERIC_TERMS.has(term.toLowerCase()) && term.length > 5) {
          specificHits++;
        }
      }
    }
    // Require either: 2+ related hits, or 1 specific (non-generic) hit
    if (specificHits > 0 || relatedHits >= 2) {
      score += 40 + (Math.min(relatedHits, 4) * 12);
      hasContextSignal = true;
      hasRelatedSignal = true;
    }
  }

  // ── JOB TYPE MATCH ──
  if (ctx.jobType) {
    const jobTypeTerms = {
      install: ['install', 'mount', 'add', 'new', 'hook', 'connect', 'wire', 'run'],
      replace: ['replace', 'swap', 'upgrade', 'new', 'remove old'],
      repair: ['repair', 'fix', 'patch', 'seal', 'troubleshoot', 'diagnose', 'clear', 'unclog'],
      remove: ['remove', 'demo', 'disconnect', 'tear', 'gut', 'strip', 'cap'],
      maintain: ['service', 'tune', 'clean', 'inspect', 'test', 'maintain', 'annual', 'seasonal'],
      relocate: ['relocat', 'rough-in', 'rough in', 'extend', 'reroute', 're-route', 'new line', 'move', 'run new'],
    };
    const terms = jobTypeTerms[ctx.jobType] || [];
    if (terms.some(t => hay.includes(t))) {
      score += 25;
      hasContextSignal = true;
    }
  }

  // ── RELOCATION BOOST — relocate/move jobs need rough-in, pipe runs, venting, inspection ──
  if (ctx.jobType === 'relocate') {
    const relocTerms = ['relocat', 'rough-in', 'rough in', 'extend', 'reroute', 'new line',
                         'pex', 'abs', 'pvc', 'copper', 'pipe', 'inspection', 'permit',
                         'vent', 'air admittance', 'subfloor', 'penetrat', 'core drill',
                         'supply line', 'drain pipe', 'fitting', 'cap off', 'abandon',
                         'new drain', 'drain run', 'waste line'];
    let relocHits = 0;
    for (const rt of relocTerms) {
      if (hay.includes(rt)) relocHits++;
    }
    if (relocHits > 0) {
      score += 60 + (Math.min(relocHits, 4) * 15); // strong boost for relocation-relevant items
      hasContextSignal = true;
      if (!objectMatch) hasRelatedSignal = true; // treat as related signal so it gets a tier
    }
  }

  // ── NEGATIVE RELEVANCE — demote items that don't fit the job verb ──
  if (ctx.jobType === 'relocate' || ctx.jobType === 'install') {
    const repairOnly = ['snake', 'unclog', 'clear', 'camera inspect', 'thaw', 'diagnos', 'leak detect'];
    if (repairOnly.some(t => hay.includes(t))) {
      score -= 120;
    }
  }
  if (ctx.jobType === 'repair') {
    const installOnly = ['rough-in', 'rough in', 'relocat', 'new construction'];
    if (installOnly.some(t => hay.includes(t))) {
      score -= 120;
    }
  }
  // Demo/removal jobs: demote install items, boost removal/disconnect/dispose items
  if (ctx.jobType === 'remove') {
    const removeTerms = ['remove', 'disconnect', 'dispose', 'demo', 'tear', 'strip', 'gut',
                          'cap off', 'abandon', 'decommission', 'haul', 'dump', 'salvage',
                          'drain and disconnect', 'old', 'existing', 'debris'];
    const nameLower = item.n.toLowerCase();
    // Demote items whose name starts with install/build/construct verbs
    const installStarts = ['install ', 'mount ', 'build ', 'construct ', 'run ', 'add '];
    if (installStarts.some(t => nameLower.startsWith(t)) && !removeTerms.some(t => nameLower.includes(t))) {
      score -= 150;
    }
    // Boost items with removal/disconnect/demo language
    let removeHits = 0;
    for (const rt of removeTerms) {
      if (hay.includes(rt)) removeHits++;
    }
    if (removeHits > 0) {
      score += 40 + (Math.min(removeHits, 3) * 15);
    }
  }

  // ── LOCATION MATCH — only boost if item is also object-related ──
  // Prevents "common in kitchen jobs" on unrelated items
  if (locationObjects.length > 0 && hasContextSignal) {
    for (const locObj of locationObjects) {
      if (hay.includes(locObj.toLowerCase())) {
        score += 10;
        break;
      }
    }
  }

  // ── KEYWORD MATCH (weakest signal — tiebreaker only) ──
  let keywordHits = 0;
  for (const kw of ctx.keywords) {
    if (hay.includes(kw)) keywordHits++;
  }
  if (keywordHits > 0) {
    score += Math.min(keywordHits * 3, 12); // reduced from 5*20 to 3*12
  }

  // ── POPULARITY BONUS — small, only for tiebreaking ──
  score += Math.round((item.p || 50) * 0.08); // reduced from 0.15

  return { score, hasContextSignal, hasObjectSignal: objectMatch || hasRelatedSignal };
}


// ═══════════════════════════════════════════════════════════════
// TIER ASSIGNMENT — Core / Related / Optional
// ═══════════════════════════════════════════════════════════════

function assignTier(score, hasContextSignal, hasObjectSignal, item, ctx) {
  // ALL tiers require object or related-object signal
  if (!hasObjectSignal) return null;

  // ── Subscription/upsell blacklist — never core ──
  // These are recurring service plans or upsell products, not job line items.
  const nameLower = (item.n || '').toLowerCase();
  const NEVER_CORE = ['maintenance plan', 'service plan', 'protection plan', 'warranty plan',
    'annual plan', 'subscription', 'membership'];
  if (NEVER_CORE.some(t => nameLower.includes(t))) return 'optional';

  // ── Price sanity gate ──
  const MAJOR_OBJECTS = new Set([
    'panel', 'water heater', 'furnace', 'boiler', 'air conditioner', 'condenser',
    'mini split', 'heat pump', 'sewer line', 'main line', 'hot tub', 'ev charger',
    'deck', 'fence', 'roof', 'bathroom', 'kitchen', 'basement',
  ]);
  const COMPONENT_KEYWORDS = new Set([
    'ignitor', 'igniter', 'sensor', 'thermocouple', 'valve', 'capacitor',
    'contactor', 'relay', 'board', 'motor', 'blower', 'fan', 'filter',
    'element', 'anode', 'flapper', 'fill', 'gasket', 'seal', 'switch',
    'fuse', 'breaker', 'outlet', 'gfci', 'tune-up', 'tuneup', 'maintenance',
    'cleaning', 'flush', 'diagnostic', 'diagnosis', 'inspection', 'repair',
    'not heating', 'not cooling', 'not working', 'analysis', 'service',
    'recharge', 'charge', 'coil', 'clean',
    'circuit', 'pump', 'fluorescent', 'led', 'wiring', 'wire',,
  ]);
  const hasMajorObject = ctx.objects.some(o => MAJOR_OBJECTS.has(o));
  const hasComponent = ctx.keywords.some(k => COMPONENT_KEYWORDS.has(k));
  const applyGate = !hasMajorObject || hasComponent;

  if (applyGate && score >= 180) {
    const itemMid = ((item.lo || 0) + (item.hi || 0)) / 2;
    const SIMPLE_CEILING = {
      Plumber: 500, Electrician: 500, HVAC: 500, Carpenter: 500,
      'General Contractor': 800, Roofing: 800, Painter: 500, Landscaping: 400,
    };
    const ceiling = SIMPLE_CEILING[item.t] || 500;
    if (itemMid > ceiling) return 'related';
  }

  if (score >= 180) return 'core';
  if (score >= 100) return 'related';
  if (score >= 70) return 'optional';

  return null;
}

/**
 * Compute a human-readable reason for why this item is shown.
 */
function computeReason(item, ctx) {
  const hay = [item.n, ...(item.syn || [])].join(' ').toLowerCase();

  // Check direct object match first (strongest reason)
  for (const obj of ctx.objects) {
    const objDef = OBJECTS[obj];
    if (!objDef) continue;
    if (objDef.syn.some(s => hay.includes(s.toLowerCase()))) {
      const jobLabel = ctx.jobType ? `${ctx.jobType} · ` : '';
      return `${jobLabel}${obj}`;
    }
  }

  // Check related match (companion item)
  for (const obj of ctx.objects) {
    const objDef = OBJECTS[obj];
    if (!objDef) continue;
    for (const r of objDef.related) {
      if (hay.includes(r.toLowerCase())) {
        return `often needed with ${obj}`;
      }
    }
  }

  // Job type match
  if (ctx.jobType) {
    return `${ctx.trade} · ${ctx.jobType}`;
  }

  // Trade fallback (should rarely reach here given hasContextSignal gate)
  return `${ctx.trade}`;
}


// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

/**
 * SMART CATALOG SUGGESTIONS
 *
 * Given a job description, trade, and province, returns scored + ranked
 * catalog items grouped into tiers: core, related, optional.
 *
 * This replaces smartCatalogFallback in build-scope-page.jsx.
 *
 * @param {object} opts
 * @param {string} opts.description - Job description text
 * @param {string} opts.title - Job title (optional)
 * @param {string} opts.trade - Selected trade
 * @param {string} opts.province - Province/state for pricing
 * @returns {{ context, core[], related[], optional[], reason }}
 */
export function getSmartSuggestions({ description, title, trade, province }) {
  const fullText = [title, description].filter(Boolean).join('. ');
  const ctx = extractJobContext(fullText, trade);
  const relatedTerms = getRelatedObjects(ctx.objects);
  const locationObjects = getLocationObjects(ctx.locations);
  const negativeObjects = buildNegativeObjects(ctx, normalizeTrade(ctx.trade));
  const nTrade = normalizeTrade(ctx.trade);

  // Score every catalog item
  const scored = [];
  for (const item of C) {
    const { score, hasContextSignal, hasObjectSignal } = scoreItem(item, ctx, relatedTerms, locationObjects, negativeObjects, nTrade);
    if (score <= 0) continue;

    const tier = assignTier(score, hasContextSignal, hasObjectSignal, item, ctx);
    if (!tier) continue;

    const adj = regionalize(item, province);
    const rawLo = adj.lo || item.lo || 0;
    const rawHi = adj.hi || item.hi || 0;
    // Use anchor-based compression for realistic market pricing
    const anchored = anchorPrice(rawLo, rawHi, nTrade, item.c);
    const itemReason = computeReason(item, ctx);
    scored.push({
      id: `smart_${item.n.replace(/\s+/g, '_').toLowerCase().slice(0, 30)}_${Math.random().toString(36).slice(2, 6)}`,
      name: item.n,
      desc: item.d || '',
      category: item.c || '',
      lo: anchored.lo,
      hi: anchored.hi,
      mid: anchored.mid,
      score,
      tier,
      reason: itemReason,
      // ── Prompt 7A: contextual enrichment for catalog fallback display ──
      why: itemReason,
      pricing_basis: `${item.t || ''} · ${item.c || 'General'} · ${province || 'CA'} market range`,
      ...(tier === 'related' ? { when_needed: 'Common companion item for this type of job' } : {}),
      ...(tier === 'optional' ? {
        when_needed: 'Include if scope requires it',
        when_not_needed: 'Skip if not part of the current scope',
      } : {}),
    });
  }

  // Sort by score within tiers
  scored.sort((a, b) => b.score - a.score);

  // Group by tier with limits — real contractor jobs average 3-4 line items total.
  // Cap tightly to prevent scope bloat that inflates quotes beyond market rates.
  let core = scored.filter(s => s.tier === 'core').slice(0, 3);
  let related = scored.filter(s => s.tier === 'related').slice(0, 2);
  let optional = scored.filter(s => s.tier === 'optional').slice(0, 2);

  // ── KEYWORD FALLBACK ──
  // When object-based scoring returns < 3 core items, fall back to keyword
  // matching within the trade. This catches descriptions that don't match
  // any object in the taxonomy (e.g. "Replace P-trap", "Combustion analysis").
  if (core.length < 3 && nTrade && nTrade !== 'Other' && ctx.keywords.length > 0) {
    const existingNames = new Set([...core, ...related, ...optional].map(i => i.name.toLowerCase()));
    const STOP = new Set(['install','replace','repair','fix','new','old','need','remove','add','the','for','and','with']);
    const sigWords = ctx.keywords.filter(w => w.length > 2 && !STOP.has(w));

    if (sigWords.length > 0) {
      const kwResults = [];
      for (const item of C) {
        if (item.t !== nTrade) continue;
        if (existingNames.has(item.n.toLowerCase())) continue;
        const hay = _itemHay.get(item);
        
        let kwScore = 0;
        let matchedWords = 0;
        for (const w of sigWords) {
          if (hay.includes(w)) { kwScore += 25; matchedWords++; }
        }
        // Require at least 1 significant word match
        if (matchedWords === 0) continue;
        // Bonus for matching multiple words
        if (matchedWords >= 2) kwScore += 20;
        // Bonus for name match (stronger than description match)
        const nameLower = item.n.toLowerCase();
        for (const w of sigWords) {
          if (nameLower.includes(w)) kwScore += 15;
        }
        kwScore += (item.p || 50) * 0.1;

        // ── Verb-context adjustment in keyword fallback ──
        if (ctx.jobType === 'remove') {
          const installStarts = ['install ', 'mount ', 'build ', 'construct ', 'run ', 'add '];
          if (installStarts.some(t => nameLower.startsWith(t))) kwScore -= 40;
          const removeTerms = ['remove', 'disconnect', 'dispose', 'demo', 'tear', 'strip', 'cap', 'haul', 'old', 'debris'];
          if (removeTerms.some(t => hay.includes(t))) kwScore += 25;
        }
        if ((ctx.jobType === 'relocate' || ctx.jobType === 'install') && 
            ['snake', 'unclog', 'clear', 'diagnos'].some(t => hay.includes(t))) {
          kwScore -= 40;
        }

        if (kwScore >= 30) {
          const adj = regionalize(item, province);
          const kwAnchored = anchorPrice(adj.lo || item.lo || 0, adj.hi || item.hi || 0, nTrade, item.c);
          const kwReason = `keyword: ${sigWords.slice(0, 3).join(', ')}`;
          kwResults.push({
            id: `kw_${item.n.replace(/\s+/g, '_').toLowerCase().slice(0, 30)}_${Math.random().toString(36).slice(2, 6)}`,
            name: item.n, desc: item.d || '', category: item.c || '',
            lo: kwAnchored.lo, hi: kwAnchored.hi,
            mid: kwAnchored.mid,
            score: kwScore, tier: 'core',
            reason: kwReason,
            // ── Prompt 7A: enrich keyword fallback items ──
            why: kwReason,
            pricing_basis: `${item.t || ''} · ${item.c || 'General'} · ${province || 'CA'} market range`,
          });
        }
      }
      // Sort keyword results by score, take top items to fill gaps
      kwResults.sort((a, b) => b.score - a.score);
      const needed = Math.max(0, 3 - core.length);
      const kwCore = kwResults.slice(0, Math.min(needed, 3));
      const kwRelated = kwResults.slice(kwCore.length, kwCore.length + 2);
      core = [...core, ...kwCore];
      related = [...related, ...kwRelated];
    }
  }

  // Within each tier, sort: Labour first, then Materials, then Services
  const catOrder = { Labour: 0, Materials: 1, Services: 2 };
  const sortWithinTier = (arr) => arr.sort((a, b) => {
    const catDiff = (catOrder[a.category] ?? 3) - (catOrder[b.category] ?? 3);
    if (catDiff !== 0) return catDiff;
    return b.score - a.score;
  });

  sortWithinTier(core);
  sortWithinTier(related);
  sortWithinTier(optional);

  // Build reason string for the header
  const parts = [];
  if (ctx.objects.length) parts.push(ctx.objects.join(' + '));
  if (ctx.jobType) parts.push(ctx.jobType);
  if (ctx.locations.length) parts.push(ctx.locations.join(', '));
  const reason = parts.length ? `Based on: ${parts.join(' · ')}` : `Based on ${ctx.trade} trade`;

  // ── JOB-LEVEL PRICE CLAMP ──
  // After scoring and tier assignment, check if the core total is wildly
  // outside the realistic range for this trade. If so, proportionally scale
  // all core item prices to land in the right ballpark.
  // This catches both over-pricing (simple jobs) and under-pricing (complex jobs).
  if (core.length > 0) {
    const coreTotal = core.reduce((s, i) => s + (i.mid || 0), 0);
    const ranges = {
      Plumber:     { simple: 300, medium: 900, complex: 2500 },
      Electrician: { simple: 200, medium: 700, complex: 3000 },
      HVAC:        { simple: 200, medium: 800, complex: 5000 },
      Carpenter:   { simple: 250, medium: 700, complex: 2000 },
      'General Contractor': { simple: 250, medium: 900, complex: 3000 },
      Roofing:     { simple: 500, medium: 1500, complex: 5000 },
      Painter:     { simple: 250, medium: 700, complex: 2000 },
      Landscaping: { simple: 250, medium: 700, complex: 2000 },
    };
    const tradeRange = ranges[nTrade] || ranges['Plumber'];

    // Detect job complexity from objects and keywords
    const COMPLEX_OBJECTS = new Set(['panel', 'water heater', 'furnace', 'boiler', 'condenser',
      'mini split', 'heat pump', 'sewer line', 'main line', 'hot tub', 'ev charger',
      'deck', 'roof', 'bathroom', 'kitchen', 'basement']);
    const COMPONENT_KW = new Set(['ignitor', 'igniter', 'sensor', 'valve', 'capacitor',
      'contactor', 'relay', 'board', 'motor', 'blower', 'fan', 'filter',
      'element', 'anode', 'flapper', 'fill', 'gasket', 'seal', 'switch',
      'fuse', 'breaker', 'outlet', 'gfci', 'tune-up', 'tuneup', 'maintenance',
      'cleaning', 'flush', 'diagnostic', 'diagnosis', 'inspection', 'repair',
      'not heating', 'not cooling', 'not working', 'analysis', 'service',
      'recharge', 'charge', 'coil', 'clean',
    'circuit', 'pump', 'fluorescent', 'led', 'wiring', 'wire',]);
    const hasMajor = ctx.objects.some(o => COMPLEX_OBJECTS.has(o));
    const hasComp = ctx.keywords.some(k => COMPONENT_KW.has(k));
    // No objects = always simple (keyword-only matches are inherently imprecise)
    const isComplex = hasMajor && !hasComp && ctx.objects.length > 0;
    const targetMid = isComplex ? tradeRange.complex : tradeRange.simple;
    const targetCeiling = targetMid * 1.5;

    // Only clamp DOWN (prevent over-pricing). Don't inflate under-priced results.
    if (coreTotal > targetCeiling && !isComplex) {
      const scale = targetMid / coreTotal;
      core = core.map(item => ({
        ...item,
        lo: roundPrice((item.lo || 0) * scale),
        hi: roundPrice((item.hi || 0) * scale),
        mid: roundPrice((item.mid || 0) * scale),
      }));
    }
  }

  return {
    context: ctx,
    core,
    related,
    optional,
    reason,
    totalCount: core.length + related.length + optional.length,
  };
}


/**
 * SMART MANUAL SEARCH
 *
 * When user searches manually in the catalog, still use context to boost
 * relevant items to the top — but show broader results.
 *
 * @param {string} query - User's search text
 * @param {object} ctx - Job context from extractJobContext
 * @param {string} province
 * @param {number} limit
 */
export function smartSearch(query, ctx, province, limit = 25) {
  if (!query || query.length < 2) return [];

  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/);
  const normalizedTrade = normalizeTrade(ctx.trade);
  const relatedTerms = getRelatedObjects(ctx.objects);

  return C
    .map(item => {
      const hay = [item.n, item.d, ...(item.syn || [])].join(' ').toLowerCase();

      // Basic text match (required)
      const allMatch = words.every(w => {
        if (w.length <= 3) return hay.includes(w);
        return hay.includes(w) || hay.includes(w.slice(0, -1));
      });
      if (!allMatch) return null;

      let score = 0;

      // Trade match (boost, not gate — manual search is broader)
      if (normalizedTrade && normalizedTrade !== 'Other') {
        if (item.t === normalizedTrade) score += 80;
        else score += 10; // still show cross-trade items, just ranked lower
      }

      // Name match > description match
      if (item.n.toLowerCase().includes(q)) score += 50;

      // Context boost: items related to the current job get boosted
      const isRelated = relatedTerms.some(t => hay.includes(t.toLowerCase()));
      if (isRelated) score += 30;

      // Object match from context
      for (const obj of ctx.objects) {
        const objDef = OBJECTS[obj];
        if (objDef && objDef.syn.some(s => hay.includes(s.toLowerCase()))) {
          score += 40;
          break;
        }
      }

      // Synonym match
      if ((item.syn || []).some(s => s.toLowerCase().includes(q))) score += 25;

      // Popularity
      score += (item.p || 50);

      const adj = regionalize(item, province);
      const sAnchored = anchorPrice(adj.lo || item.lo || 0, adj.hi || item.hi || 0, normalizedTrade || item.t, item.c);
      return {
        name: item.n,
        desc: item.d || '',
        category: item.c || '',
        trade: item.t,
        lo: sAnchored.lo,
        hi: sAnchored.hi,
        mid: sAnchored.mid,
        score,
        isContextRelevant: isRelated || score >= 120,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
