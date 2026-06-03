import { inferTrade, regionalize, getAIPricingContext } from './_tradeBrain.js'

/**
 * Repair truncated JSON from max_tokens cutoff.
 * Extracts the "items" array even if the rest of the JSON is cut off.
 * This handles the most common failure: Haiku generates items correctly
 * but runs out of tokens while writing gaps/assumptions at the end.
 */
export function repairTruncatedJson(raw) {
  try {
    if (!raw || typeof raw !== 'string') return null;
    const itemsStart = raw.indexOf('"items"');
    if (itemsStart === -1) return null;
    const arrStart = raw.indexOf('[', itemsStart);
    if (arrStart === -1) return null;

    // Walk the array, tracking string state so braces inside strings don't
    // skew depth counting. Record the position right after each complete
    // object as a candidate cut point for the salvageable items.
    let depth = 0, inStr = false, esc = false, lastClose = -1, arrClosed = -1;
    for (let i = arrStart; i < raw.length; i++) {
      const ch = raw[i];
      if (inStr) {
        if (esc) { esc = false; continue; }
        if (ch === '\\') { esc = true; continue; }
        if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') { inStr = true; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) lastClose = i; }
      else if (ch === ']' && depth === 0) { arrClosed = i; break; }
    }
    if (lastClose === -1) return null;

    const itemsJson = raw.slice(arrStart, lastClose + 1) + ']';
    let items;
    try { items = JSON.parse(itemsJson); } catch { return null; }
    if (!Array.isArray(items) || items.length === 0) return null;

    const jtMatch = raw.match(/"jobType"\s*:\s*"([^"]*)"/);
    const ssMatch = raw.match(/"scope_summary"\s*:\s*"([^"]*)"/);
    return {
      jobType: jtMatch ? jtMatch[1] : '',
      scope_summary: ssMatch ? ssMatch[1] : '',
      items,
      gaps: [],
      assumptions: [],
      optional_upgrades: [],
    };
  } catch {
    return null;
  }
}

// ── Server-side category classification ──
// Ordering matters: a service-call/dispatch item names "install" too, so
// the service patterns run first (anchored when they would otherwise be
// ambiguous). "Supply & install …" is a labour line — the contractor is
// installing the thing the model is also listing as supplied; the material
// is captured separately. Without the anchor, the broad "supply" kw wins.
const _SERVICE_RE = /\b(dispatch|service\s*call|trip\s*charge|callout|permit|inspection|disposal|cleanup|haul|delivery|coordination|scheduling|warranty|protection|certification|compliance|testing|closeout|assessment)\b/i;
const _LABOUR_RE  = /\b(install|replace|remove|repair|upgrade|diagnostic|setup|startup|swap|connect|disconnect|mount|frame|patch|commission|calibrat|labour|labor|hang|build|prep|paint|finish|run|wire(?:\s|$))\b/i;
const _MATERIAL_RE = /\b(material|supply\s*lines?|supplies|fitting|fittings|valve|connector|hose|adapter|cable|pipe|duct|filter|sealant|caulk|primer|shingle|lumber|bracket|flashing|wax\s*ring|bolt|tape|parts|allowance|thermostat|breaker|fixture|panel\s*board)\b/i;

export function classifyItemServer(name) {
  const t = String(name || '');
  if (_SERVICE_RE.test(t)) return 'services';
  if (_LABOUR_RE.test(t)) return 'labour';
  if (_MATERIAL_RE.test(t)) return 'materials';
  if (/^(install|replace|remove|repair|upgrade|connect|mount|build|frame|patch|prep)/i.test(t)) return 'labour';
  return 'services';
}

export function normalizeItems(items) {
  return (Array.isArray(items) ? items : []).map((item) => {
    // Reconcile lo/hi if the model returned them out of order — without this
    // a hi < lo response can produce a $1 mid on a $600 item.
    let lo = Math.max(1, Number(item.lo || 0));
    let hi = Math.max(1, Number(item.hi || 0));
    if (hi < lo) { const t = lo; lo = hi; hi = t; }
    const aiMid = Number(item.mid || item.unit_price || item.price || 0);
    const calcMid = hi > lo ? Math.round(lo + (hi - lo) * 0.55) : (aiMid > 0 ? aiMid : lo);
    const mid = Math.max(1, aiMid > 0 ? aiMid : calcMid);

    return {
      description: String(item.description || '').slice(0, 220),
      category: item.category || classifyItemServer(item.description),
      quantity: Math.max(0.01, Number(item.quantity || 1)),
      unit_price: mid,
      lo, mid, hi: Math.max(mid, hi),
      why: String(item.why || '').slice(0, 220),
      when: String(item.when || '').slice(0, 180),
      skip: String(item.skip || '').slice(0, 180),
      pricing_basis: String(item.pricing_basis || '').slice(0, 220),
      include_confidence: String(item.include_confidence || 'high').slice(0, 30),
      source_label: String(item.source_label || 'AI estimate').slice(0, 60),
      tier: String(item.tier || 'standard').slice(0, 20),
    };
  }).filter((item) => item.description)
}

// ── Claude API call — optimized for Vercel 60s maxDuration ──
async function callClaude({ description, trade, apiKey, country = 'CA', photo = null, wonQuotes = [], labourRate = 0 }) {
  const curr = country === 'US' ? 'USD' : 'CAD';
  const region = country === 'US' ? 'American' : 'Canadian';
  const hasPhoto = photo && typeof photo === 'string' && photo.length > 100;

  const historyCtx = Array.isArray(wonQuotes) && wonQuotes.length
    ? `\nRecent won quotes: ${wonQuotes.slice(0, 3).map(q => `"${q.title}" $${q.total}`).join('; ')}`
    : '';
  const labourCtx = labourRate > 0 ? `\nLabour rate: $${labourRate}/hr.` : '';

  const pricingCtx = getAIPricingContext(trade || 'Plumber');

  // Trade-specific missed-scope checks from 400 real contractor jobs
  const MISSED_SCOPE = {
    Plumber: 'shutoff valve condition, supply line age, caulking/seal finish, venting, drywall restoration',
    Electrician: 'box fill capacity, arc fault/GFCI requirements, wire path/access, dimmer compatibility, circuit labeling',
    HVAC: 'combustion safety, filter restriction, condensate line service, venting condition, coil cleanliness',
    'General Contractor': 'texture matching, insulation behind wall, stain-blocking primer, plumbing/electrical coordination',
  };
  const missedScope = MISSED_SCOPE[trade] || '';

  const systemPrompt = `Senior ${trade || 'trades'} estimator, ${region}. Return ONLY valid JSON.

{"jobType":"string","scope_summary":"1 sentence","items":[{"description":"3-8 words, specific","quantity":number,"unit_price":number,"lo":number,"mid":number,"hi":number,"why":"1 sentence - why this item is needed for THIS job","when":"when to include this item","skip":"when to skip this item","pricing_basis":"how you arrived at this price","category":"Labour|Materials|Services","include_confidence":"high|medium|low","tier":"standard|optional"}],"optional_upgrades":[{"description":"string","unit_price":number,"why":"string","category":"string"}],"gaps":["things to verify on site"],"assumptions":["assumptions made"]}

CRITICAL PRICING RULES — anchored to real ${trade || 'trades'} contractor quoting data (${region} 2026):
- Return 3-5 standard line items total. Real quotes have 3-4 items, NOT 8-12.
- Typical job structure: 1 service (dispatch/diagnostic), 1-2 labour items, 1 material item.
- ALWAYS include "Dispatch / diagnostic" as the first service item ($90-$150).
- DO NOT include the fixture/appliance itself unless contractor supplies it.
- DO NOT pad with tangential items. A faucet job does NOT need "relocate plumbing".

${trade || 'Trade'} pricing anchors: ${pricingCtx}

- lo = budget, mid = standard, hi = premium. hi should be ~1.4x lo, not 2-3x.
- Labour: per-job flat rate. If contractor set a labour rate, use it.
- Be specific: "Install Moen single-handle faucet" not "Install faucet".
- include_confidence=high means essential. medium = recommended addon. low = optional upsell.
- 0-2 optional_upgrades max.
${missedScope ? `\nIn "gaps", flag these common missed items for ${trade}: ${missedScope}.` : ''}${historyCtx}${labourCtx}`;

  // Build message content
  const userContent = [];
  if (hasPhoto) {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: photo },
    });
  }
  userContent.push({
    type: 'text',
    text: `${String(description || '').slice(0, 1200)}\nTrade: ${trade}`,
  });

  const controller = new AbortController();
  // 30s for text (Haiku), 45s for photos (Sonnet) — non-streaming needs more time
  const timeoutMs = hasPhoto ? 45000 : 30000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: hasPhoto ? 'claude-sonnet-4-20250514' : 'claude-haiku-4-5-20251001',
        max_tokens: hasPhoto ? 2500 : 2000,
        temperature: 0,
        // NO streaming — direct JSON response is more reliable in Vercel serverless
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('[ai-scope] Claude API error:', response.status, errText.slice(0, 500));
      throw new Error(`Claude API returned ${response.status}: ${errText.slice(0, 100)}`);
    }

    // Direct JSON parse — no streaming complexity
    const data = await response.json();
    let raw = '';

    if (data.content && Array.isArray(data.content)) {
      raw = data.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');
    } else {
      console.error('[ai-scope] Unexpected response shape:', JSON.stringify(data).slice(0, 300));
      throw new Error('Unexpected API response format');
    }

    if (!raw.trim()) {
      console.error('[ai-scope] Empty text from Claude');
      throw new Error('Claude returned empty response');
    }
    // Strip any markdown fencing
    raw = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    // If Claude added any preamble before {, strip it
    const jsonStart = raw.indexOf('{');
    if (jsonStart > 0) raw = raw.slice(jsonStart);

    // ── JSON repair: handle truncated responses from max_tokens cutoff ──
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      console.warn(`[ai-scope] JSON parse failed, attempting repair. Raw length: ${raw.length}`);
      console.warn(`[ai-scope] Raw start: ${raw.slice(0, 200)}`);
      console.warn(`[ai-scope] Raw end: ...${raw.slice(-200)}`);
      parsed = repairTruncatedJson(raw);
      if (!parsed || !parsed.items?.length) {
        console.error('[ai-scope] JSON repair failed');
        throw new Error('AI response was not valid JSON — retry or add items manually');
      }
      console.log(`[ai-scope] JSON repair salvaged ${parsed.items.length} items`);
    }

    const model = hasPhoto ? 'claude-sonnet-4' : 'claude-haiku-4.5';
    console.log(`[ai-scope] Claude returned ${(parsed.items || []).length} items, model: ${model}`);

    return {
      jobType: parsed.jobType || '',
      items: normalizeItems(parsed.items),
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 5) : [],
      insights: Array.isArray(parsed.insights) ? parsed.insights.slice(0, 5) : [],
      assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions.slice(0, 4) : [],
      scope_summary: parsed.scope_summary || '',
      optional_upgrades: Array.isArray(parsed.optional_upgrades) ? parsed.optional_upgrades.slice(0, 3) : [],
      source: 'ai',
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      console.error(`[ai-scope] Claude timed out after ${timeoutMs/1000}s`);
      throw new Error('AI timed out — try a shorter description or retry');
    }
    throw err;
  }
}

// Vercel Pro: allow up to 60s for AI responses
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const { blocked: rl, getClientIp: gip } = await import('./_rate-limit.js');
  if (rl(res, `ai:${gip(req)}`, 10, 60_000)) return;

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth — require a valid Supabase session before touching the Anthropic API
  const { createClient } = await import('./_supabase.js');
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Server configuration error' });
  const serviceSupabase = createClient(supabaseUrl, supabaseKey);
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const { data: { user }, error: authErr } = await serviceSupabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { description, trade = 'Other', province = 'AB', country = 'CA', photo = null, wonQuotes = [], labourRate = 0 } = req.body || {};
  if (!String(description || '').trim()) return res.status(400).json({ error: 'description required', items: [] });

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // No API key — return empty state, let user add items manually
  if (!apiKey) {
    console.log('[ai-scope] No ANTHROPIC_API_KEY — returning empty state');
    return res.status(200).json({
      trade: inferTrade(description, trade),
      items: [],
      gaps: [],
      insights: ['Add ANTHROPIC_API_KEY in Vercel settings for AI-powered scope generation.'],
      assumptions: [],
      optional_upgrades: [],
      source: 'none',
      warning: 'AI not configured. Add items manually or configure API key.',
    });
  }

  // Call Claude AI
  try {
    const result = await callClaude({ description, trade, apiKey, country, photo, wonQuotes, labourRate });

    // Apply regional pricing adjustments. Re-clamp unit_price to ≥1
    // because regionalize() can return 0 for outlier regions (Yukon,
    // Nunavut) when its multiplier table doesn't have a rate — and a
    // $0 line item makes it through to the quote builder unflagged.
    if (province && province !== 'AB' && result.items?.length) {
      result.items = result.items.map(item => {
        const adj = regionalize(item, province);
        return {
          ...item,
          lo: Math.max(1, adj.lo || 0),
          mid: Math.max(1, adj.mid || 0),
          hi: Math.max(1, adj.hi || 0),
          unit_price: Math.max(1, adj.mid || 0),
        };
      });
    }

    return res.status(200).json({ ...result, source: 'ai' });
  } catch (error) {
    console.error('[ai-scope] Claude failed:', error.message);
    
    // AI failed — return empty state with error info
    return res.status(200).json({
      trade: inferTrade(description, trade),
      items: [],
      gaps: [],
      insights: [],
      assumptions: [],
      optional_upgrades: [],
      source: 'error',
      warning: 'AI temporarily unavailable. Add items manually and try again later.',
    });
  }
}
