import { inferTrade, regionalize, getAIPricingContext } from './_tradeBrain.js'

// ── Server-side category classification ──
const _LABOUR_KW = ['labour','labor','install','replace','remove','repair','upgrade','diagnostic','service call','setup','startup','swap','connect','disconnect','mount','frame','drywall','patch','commission','calibrat'];
const _MATERIAL_KW = ['material','supply','supplies','fitting','fittings','valve','connector','hose','adapter','wire','cable','pipe','duct','filter','sealant','caulk','primer','shingle','lumber','bracket','flashing','wax ring','bolt','ring','tape','parts','allowance'];
const _SERVICE_KW = ['permit','inspection','disposal','cleanup','haul','delivery','coordination','scheduling','warranty','protection','certification','compliance','testing','closeout'];

function classifyItemServer(name) {
  const t = (name || '').toLowerCase();
  if (_SERVICE_KW.some(w => t.includes(w))) return 'services';
  if (_MATERIAL_KW.some(w => t.includes(w))) return 'materials';
  if (_LABOUR_KW.some(w => t.includes(w))) return 'labour';
  if (/^(install|replace|remove|repair|upgrade|connect|mount|build|frame|patch|prep)/i.test(name || '')) return 'labour';
  return 'services';
}

function normalizeItems(items) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const lo = Math.max(1, Number(item.lo || 0));
    const hi = Math.max(lo, Number(item.hi || 0));
    // Use the AI's mid if it provided one, otherwise calculate 55th percentile
    const aiMid = Number(item.mid || item.unit_price || item.price || 0);
    const calcMid = hi > lo ? Math.round(lo + (hi - lo) * 0.55) : aiMid;
    const mid = aiMid > 0 ? aiMid : calcMid;
    
    return {
      description: String(item.description || '').slice(0, 220),
      category: item.category || classifyItemServer(item.description),
      quantity: Math.max(0.01, Number(item.quantity || 1)),
      unit_price: Math.max(1, mid),
      lo, mid: Math.max(1, mid), hi: Math.max(mid, hi),
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
  // 20s hard abort for text (Haiku), 25s for photos (Sonnet).
  const timeoutMs = hasPhoto ? 25000 : 20000;
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
        max_tokens: hasPhoto ? 1500 : 1200,
        temperature: 0,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    clearTimeout(timeout);
    const text = await response.text();

    if (!response.ok) {
      console.error('[ai-scope] Claude error:', response.status, text.slice(0, 300));
      throw new Error(`Claude ${response.status}`);
    }

    const data = JSON.parse(text);
    let raw = data.content?.[0]?.text || '{}';
    // Strip any markdown fencing
    raw = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    // If Claude added any preamble before {, strip it
    const jsonStart = raw.indexOf('{');
    if (jsonStart > 0) raw = raw.slice(jsonStart);
    const parsed = JSON.parse(raw);

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
      console.error('[ai-scope] Claude timed out (9.2s limit)');
      throw new Error('AI timed out');
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

    // Apply regional pricing adjustments
    if (province && province !== 'AB' && result.items?.length) {
      result.items = result.items.map(item => {
        const adj = regionalize(item, province);
        return { ...item, lo: adj.lo, mid: adj.mid, hi: adj.hi, unit_price: adj.mid };
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
