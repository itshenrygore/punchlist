import { getSmartSuggestions } from '../../../shared/smartCatalog';

/* ═══════════════════════════════════════════════════════════
   Quote builder shared utilities.
   Extracted from the former 1,641-line god component.
   Pure functions — no React, no side effects.
   ═══════════════════════════════════════════════════════════ */

// ── Smart title generator ─────────────────────────────────
export function generateTitle(desc) {
  if (!desc?.trim()) return '';
  const text = desc.trim();
  const patterns = [
    [/^replace\s+(?:the\s+|a\s+|an\s+|old\s+|existing\s+|my\s+)?(.+?)(?:\.|,|\band\b|\bfor\b|\bcustomer\b|\bin\b|\bwith\b|$)/i, 1, 'Replacement'],
    [/^install\s+(?:a\s+|an\s+|new\s+)?(.+?)(?:\.|,|\band\b|\bfor\b|\bcustomer\b|\bin\b|$)/i, 1, 'Installation'],
    [/^repair\s+(?:the\s+|a\s+|an\s+|my\s+)?(.+?)(?:\.|,|\band\b|\bfor\b|\bcustomer\b|$)/i, 1, 'Repair'],
    [/^fix\s+(?:the\s+|a\s+|an\s+|my\s+)?(.+?)(?:\.|,|\band\b|\bfor\b|$)/i, 1, 'Repair'],
    [/^add\s+(?:a\s+|an\s+|new\s+)?(.+?)(?:\.|,|\band\b|\bfor\b|\bin\b|$)/i, 1, 'Installation'],
    [/^remove\s+(?:the\s+|a\s+|an\s+|old\s+)?(.+?)(?:\.|,|\band\b|\bfor\b|$)/i, 1, 'Removal'],
  ];
  for (const [re, idx, suffix] of patterns) {
    const m = text.match(re);
    if (m) { const o = _cleanObj(m[idx]); if (o) return _tc(`${o} ${suffix}`); }
  }
  const upgradeMatch = text.match(/^upgrade\s+(?:the\s+|a\s+)?(.+?)\s+to\s+(.+?)(?:\.|,|\band\b|\bfor\b|$)/i);
  if (upgradeMatch) { const t = _cleanObj(upgradeMatch[2]); if (t) return _tc(`${t} Upgrade`); }
  const brokenMatch = text.match(/^(.+?)\s+(?:not\s+working|is\s+broken|is\s+leaking|won't\s+|doesn't\s+)/i);
  if (brokenMatch) { const o = _cleanObj(brokenMatch[1]); if (o) return _tc(`${o} Diagnostic & Repair`); }
  const nounActionMatch = text.match(/^(.+?)\s+(upgrade|install(?:ation)?|replacement|repair|removal|service|maintenance)\s*(?:for\b|$)/i);
  if (nounActionMatch) { const s = _cleanObj(nounActionMatch[1]); const a = nounActionMatch[2].charAt(0).toUpperCase() + nounActionMatch[2].slice(1).toLowerCase(); if (s) return _tc(`${s} ${a}`); }
  const fc = text.split(/[.!?\n,]/)[0]?.trim();
  if (fc && fc.length <= 50) return _tc(fc);
  return _tc(text.split(/\s+/).slice(0, 5).join(' '));
}

function _cleanObj(s) {
  if (!s) return '';
  return s
    .replace(/\b(the|a|an|my|our|their|its|some)\b/gi, '')
    .replace(/\b(customer|client|homeowner|owner)\b.*/gi, '')
    .replace(/\b(wants?|needs?|has|have|had|with|from)\b.*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 40);
}

function _tc(s) {
  if (!s) return '';
  const sm = new Set(['a','an','the','and','or','but','in','on','at','to','for','of','with','by']);
  return s.split(' ').filter(Boolean).map((w, i) => {
    if (/^[A-Z]{2,5}$/.test(w)) return w;
    const lw = w.toLowerCase();
    return i === 0 || !sm.has(lw) ? lw.charAt(0).toUpperCase() + lw.slice(1) : lw;
  }).join(' ');
}

// ── Item classification ───────────────────────────────────
const LABOUR_KW = ['labour','labor','install','replace','remove','repair','upgrade','finish','maintenance','swap','hook','connect','disconnect','mount','demolish','frame','drywall','patch','diagnostic','service call','setup','startup','commission','calibrat','test','inspect'];
const MATERIAL_KW = ['material','supply','supplies','part','parts','fitting','fittings','allowance','hose','connector','adapter','valve','ring','bolt','wire','cable','pipe','duct','filter','sealant','caulk','primer','paint','shingle','lumber','screw','nail','bracket','flashing','wax ring','tape','panel','breaker','conduit','switch','outlet','fixture','fan','light','thermostat','pump','tank','heater','coil','compressor','lineset','meter','fastener','hardware','equipment','unit','device'];
const SERVICE_KW = ['permit','inspection','disposal','cleanup','haul','delivery','coordination','scheduling','warranty','protection','certification','compliance','removal','commissioning','testing','patching','grounding','bonding'];

export function classifyItem(name, category) {
  const cat = (category || '').toLowerCase();
  if (cat === 'labour' || cat === 'labor') return 'labour';
  if (cat === 'materials' || cat === 'material') return 'materials';
  if (['services','service','permit','disposal'].includes(cat)) return 'services';
  const text = `${name || ''} ${category || ''}`.toLowerCase();
  if (SERVICE_KW.some(w => text.includes(w))) return 'services';
  if (MATERIAL_KW.some(w => text.includes(w))) return 'materials';
  if (LABOUR_KW.some(w => text.includes(w))) return 'labour';
  if (/^(install|replace|remove|repair|upgrade|connect|mount|build|frame|patch|prep)/i.test(name || '')) return 'labour';
  return 'services';
}

export function normSuggestion(raw, i) {
  const lo = Number(raw.lo || raw.typical_range_low || 0);
  const hi = Number(raw.hi || raw.typical_range_high || 0);
  const mid = Number(raw.unit_price || raw.mid || Math.round((lo + hi) / 2) || 0);
  const name = raw.description || raw.name || 'Item';
  const cat = raw.category || '';
  const confidence = (raw.include_confidence || 'high').toLowerCase();
  const tier = (raw.tier || 'standard').toLowerCase();
  return {
    id: `sug_${i}_${Date.now()}`,
    name,
    category: cat,
    tab: classifyItem(name, cat),
    unit_price: mid,
    quantity: Math.max(1, Number(raw.quantity || 1)),
    typical_low: lo,
    typical_high: hi,
    why: raw.why || raw.reason || '',
    when_needed: raw.when || '',
    when_not_needed: raw.skip || '',
    notes: raw.pricing_basis || '',
    confidence,
    tier,
    source: raw.source_label || 'Based on similar jobs',
    selected: tier === 'optional' ? false : confidence !== 'low',
  };
}

// ── Smart catalog fallback ────────────────────────────────
export function smartCatalogFallback(ctx, province) {
  const result = getSmartSuggestions({
    description: ctx.description || '',
    title: ctx.title || '',
    trade: ctx.trade || 'Other',
    province: province || 'AB',
  });
  const hasDispatch = [...result.core, ...result.related].some(
    i => /dispatch|diagnostic|service call/i.test(i.name)
  );
  if (!hasDispatch && result.core.length > 0) {
    const dp = {
      Plumber: { lo: 90, hi: 120, mid: 105 },
      Electrician: { lo: 90, hi: 110, mid: 100 },
      HVAC: { lo: 120, hi: 150, mid: 135 },
      'General Contractor': { lo: 60, hi: 80, mid: 70 },
    };
    const d = dp[ctx.trade] || { lo: 90, hi: 130, mid: 110 };
    result.related.unshift({
      id: `disp_${Date.now()}`,
      name: 'Dispatch / diagnostic',
      desc: 'Service call, travel, initial assessment',
      category: 'Services',
      lo: d.lo, hi: d.hi, mid: d.mid,
      score: 999,
      tier: 'related',
      reason: 'Standard on every job',
      why: 'Covers travel, site assessment, and initial diagnosis',
      pricing_basis: 'Market rate from contractor data',
    });
  }
  return result;
}

// ── Scope hints per trade ─────────────────────────────────
export const SCOPE_HINTS = {
  Plumber: ['Disposal fees', 'Shut-off valve replacement', 'Permit', 'Patch/repair after access', 'Cleanup'],
  Electrician: ['Permit & inspection', 'Panel labelling', 'Patching/repair', 'Disposal', 'GFCI/AFCI upgrades'],
  HVAC: ['Duct modification', 'Electrical hookup', 'Permit', 'Refrigerant handling', 'Thermostat wiring'],
  General: ['Disposal', 'Cleanup', 'Permit', 'Material delivery', 'Touch-up / patching'],
  Carpenter: ['Hardware/fasteners', 'Finishing/stain', 'Disposal', 'Touch-up paint', 'Delivery'],
  Painter: ['Surface prep', 'Primer coat', 'Caulking', 'Furniture moving', 'Drop cloths/protection'],
  Roofing: ['Permit', 'Disposal/dump fees', 'Flashing', 'Ice & water shield', 'Ventilation'],
};

// ── Description placeholders ──────────────────────────────
export const DESC_PLACEHOLDERS = {
  Plumber: 'Replace 50-gallon hot water tank in utility room. Drain, disconnect, and haul away old tank.',
  Electrician: 'Upgrade 100A panel to 200A service and reconnect existing circuits.',
  HVAC: 'Replace furnace with high-efficiency unit. Install new smart thermostat.',
  'General Contractor': 'Frame basement mechanical room and patch surrounding drywall.',
  Roofing: 'Replace damaged shingles around vent stack and inspect flashing.',
  Painter: 'Prep and paint main floor walls. Patch minor nail holes, sand, prime.',
  Carpenter: 'Install baseboard and door casing trim throughout main floor.',
  Other: 'Replace 50-gallon hot water tank in tight utility room.',
};
