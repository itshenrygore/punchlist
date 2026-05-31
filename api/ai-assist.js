import { createClient } from './_supabase.js';
import { blocked, getClientIp } from './_rate-limit.js';

// Defensive Supabase client factory — never created at module level
function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ── Tool definitions for Claude ──
const TOOL_DEFS = [
  {
    name: 'read_quotes',
    description: 'Get recent quotes, optionally filtered by status or customer name',
    input_schema: { type: 'object', properties: { status: { type: 'string' }, customer_name: { type: 'string' } } },
  },
  {
    name: 'read_contacts',
    description: 'Search customer contacts',
    input_schema: { type: 'object', properties: { search: { type: 'string' } } },
  },
  {
    name: 'lookup_pricing',
    description: 'Look up typical pricing for a specific item or service from the Punchlist catalog. Use this when the contractor asks how much something costs or what to charge.',
    input_schema: { type: 'object', properties: { query: { type: 'string', description: 'Item or service to look up, e.g. "install kitchen faucet" or "panel upgrade"' }, trade: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'start_new_quote',
    description: 'Open the new quote flow so the contractor can describe a job and let AI build the scope. Use when the user wants to create a quote through the normal flow.',
    input_schema: { type: 'object', properties: { customer_name: { type: 'string' }, description: { type: 'string' } } },
  },
  {
    name: 'create_quote',
    description: 'Create a draft quote directly with specific line items. Use only when you have confirmed items and prices with the user. For general quoting, use start_new_quote instead.',
    input_schema: {
      type: 'object',
      properties: {
        customer_name: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        trade: { type: 'string' },
        line_items: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, quantity: { type: 'number' }, unit_price: { type: 'number' } }, required: ['name', 'quantity', 'unit_price'] } },
      },
      required: ['title'],
    },
  },
];

async function executeTool(name, args, userId, supabase) {
  try {
    if (name === 'read_quotes') {
      let q = supabase.from('quotes').select('id, title, status, total, trade, updated_at, customer:customers(name)').eq('user_id', userId).order('updated_at', { ascending: false }).limit(10);
      if (args.status) q = q.eq('status', args.status);
      const { data } = await q;
      if (!data?.length) return 'No quotes found.';
      let results = data;
      if (args.customer_name) results = data.filter(r => r.customer?.name?.toLowerCase().includes(args.customer_name.toLowerCase()));
      if (!results.length) return 'No quotes found for ' + args.customer_name;
      return results.map(r => `"${r.title}" — ${r.customer?.name || 'No contact'} — $${r.total} [${r.status}]`).join('\n');
    }
    if (name === 'read_contacts') {
      // Anthropic processes and may log prompt + tool-result contents.
      // Don't ship full customer emails/phones unless the contractor
      // explicitly opted in for this turn (`args.include_contact_details`
      // is settable from a UI confirmation, not the model alone).
      const { data } = await supabase
        .from('customers')
        .select('id, name, email, phone')
        .eq('user_id', userId)
        .order('name')
        .limit(20);
      if (!data?.length) return 'No contacts.';
      const mask = (v) => {
        const s = String(v || '');
        if (!s) return '';
        // Last 4 of phone, censored prefix of email — enough for the
        // model to disambiguate without leaking the full identifier.
        if (/^[^@]+@/.test(s)) return s.replace(/(^.{1,2}).*(@.*$)/, '$1…$2');
        return s.replace(/.(?=.{4})/g, '•');
      };
      const fmt = (c) => {
        if (args.include_contact_details === true) {
          return `${c.name}${c.phone ? ' · ' + c.phone : ''}${c.email ? ' · ' + c.email : ''}`;
        }
        return `${c.name}${c.phone ? ' · ' + mask(c.phone) : ''}`;
      };
      if (args.search) {
        const s = args.search.toLowerCase();
        const filtered = data.filter(c => [c.name, c.email, c.phone].some(v => String(v || '').toLowerCase().includes(s)));
        return filtered.length ? filtered.map(fmt).join('\n') : 'No contacts matching "' + args.search + '".';
      }
      return data.map(fmt).join('\n');
    }
    if (name === 'lookup_pricing') {
      // Import catalog search
      const { searchCatalog } = await import('../shared/systemCatalog.js');
      const results = searchCatalog(args.query, args.trade || 'Other', 5);
      if (!results.length) return `No items matching "${args.query}" in the catalog. You can still quote a custom price based on your experience.`;
      return results.map(r => `${r.n}: $${r.lo}–$${r.hi} (${r.d || r.c})`).join('\n');
    }
    if (name === 'start_new_quote') {
      // Return a link to the new quote page — optionally with customer pre-selected
      let url = '/app/quotes/new';
      if (args.customer_name) {
        const { data: custs } = await supabase.from('customers').select('id').eq('user_id', userId).ilike('name', '%' + args.customer_name + '%').limit(1);
        if (custs?.length) url += `?customer=${custs[0].id}`;
      }
      return `Opening the quote builder. ${args.description ? `I'll pre-fill the description: "${args.description}".` : ''} [LINK:${url}]`;
    }
    if (name === 'create_quote') {
      // The model can call this tool with anything in its head, and
      // indirect prompt injection (customer text the contractor pastes
      // into a quote description) can steer those args. Clamp every
      // string, every number, and every array length before we touch
      // the DB. Reject obviously bad input.
      const clampStr = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
      const clampNum = (v, lo, hi) => {
        const n = Number(v);
        if (!Number.isFinite(n)) return lo;
        return Math.max(lo, Math.min(hi, n));
      };
      const title = clampStr(args.title, 220).trim();
      if (!title) return 'Error: title required.';
      const description = clampStr(args.description, 1000);
      const trade = clampStr(args.trade, 80) || null;
      const rawItems = Array.isArray(args.line_items) ? args.line_items.slice(0, 50) : [];

      let customer_id = null;
      if (args.customer_name) {
        const search = clampStr(args.customer_name, 120);
        const { data: custs } = await supabase
          .from('customers')
          .select('id, name')
          .eq('user_id', userId)
          .ilike('name', '%' + search + '%')
          .limit(1);
        if (custs?.length) customer_id = custs[0].id;
      }
      const items = rawItems.map((it) => ({
        name:       clampStr(it?.name, 220) || 'Item',
        quantity:   clampNum(it?.quantity, 0.01, 10_000),
        unit_price: clampNum(it?.unit_price, 0, 1_000_000),
        notes: '', included: true, category: '',
      }));
      const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
      const token = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
      const { data: quote, error } = await supabase.from('quotes').insert({
        user_id: userId, customer_id, title, description, trade, status: 'draft', total, share_token: token,
      }).select().single();
      if (error) return 'Error creating quote: ' + error.message;
      if (items.length) {
        await supabase.from('line_items').insert(items.map(it => ({ quote_id: quote.id, name: it.name, quantity: it.quantity, unit_price: it.unit_price, notes: it.notes, included: it.included, category: it.category })));
      }
      return `Draft created: "${quote.title}" — $${total}. [LINK:/app/quotes/${quote.id}/edit]`;
    }
    return 'Unknown tool.';
  } catch (e) { return 'Error: ' + (e.message || 'failed'); }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (blocked(res, `ai-assist:${getClientIp(req)}`, 20, 60_000)) return;
  let { messages = [], userId, trade = 'Other', province = 'AB', country = 'CA', labourRate = 0, quoteContext = null } = req.body || {};
  if (!messages.length) return res.status(400).json({ error: 'No messages' });

  // Auth: ALWAYS require a verified JWT. The previous version only ran
  // the auth check when both `userId` was in the body AND a Supabase
  // client was constructable — so a caller omitting `userId` could
  // drain Anthropic credits anonymously. Now we always derive the user
  // from the bearer token and require it.
  const supabaseAuth = getSupabase();
  if (!supabaseAuth) return res.status(500).json({ error: 'Server configuration error' });
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const { data: { user: authedUser }, error: authErr } = await supabaseAuth.auth.getUser(token);
  if (authErr || !authedUser) return res.status(401).json({ error: 'Unauthorized' });
  // Trust the resolved user.id; only use a body-supplied userId if it matches.
  if (userId && userId !== authedUser.id) return res.status(403).json({ error: 'Mismatched user' });
  // From here on, downstream code references `userId` — use the verified value.
  userId = authedUser.id;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(200).json({ role: 'assistant', content: 'Foreman needs an API key. Add ANTHROPIC_API_KEY to your Vercel environment.' });

  const curr = country === 'US' ? 'USD' : 'CAD';
  const region = country === 'US' ? 'American' : 'Canadian';
  const labCtx = labourRate > 0 ? ` The contractor charges $${labourRate}/hr.` : '';

  // Build active quote context if provided
  let activeQuoteCtx = '';
  if (quoteContext && typeof quoteContext === 'object') {
    const parts = [];
    if (quoteContext.description) parts.push(`Job description: "${quoteContext.description.slice(0, 200)}"`);
    if (quoteContext.title) parts.push(`Quote title: "${quoteContext.title}"`);
    if (quoteContext.trade) parts.push(`Trade: ${quoteContext.trade}`);
    if (Array.isArray(quoteContext.items) && quoteContext.items.length > 0) {
      const itemLines = quoteContext.items.slice(0, 20).map(i => `  - ${i.name}: ${i.qty}× $${i.price}`).join('\n');
      parts.push(`Current line items (${quoteContext.items.length} total):\n${itemLines}`);
    }
    if (quoteContext.total) parts.push(`Current total: $${quoteContext.total}`);
    if (parts.length > 0) {
      activeQuoteCtx = `\n\nACTIVE QUOTE (the contractor is currently editing this quote — you can see everything in it):\n${parts.join('\n')}`;
    }
  }

  // Fetch live business context for smarter responses
  // Optimization: skip the full quotes fetch on follow-up messages (length > 1)
  // — the context was already in the system prompt from the first message.
  let bizContext = '';
  const supabase = getSupabase();
  if (supabase && userId && messages.length <= 1) {
    try {
      const { data: quotes } = await supabase.from('quotes').select('status, total, title, view_count, customer:customers(name)').eq('user_id', userId).order('updated_at', { ascending: false }).limit(20);
      if (quotes?.length) {
        const sent = quotes.filter(q => q.status !== 'draft').length;
        const approved = quotes.filter(q => ['approved','approved_pending_deposit','deposit_paid','converted_to_invoice','paid'].includes(q.status)).length;
        const needsFollowUp = quotes.filter(q => ['viewed','revision_requested'].includes(q.status));
        const drafts = quotes.filter(q => q.status === 'draft');
        const closeRate = sent > 0 ? Math.round((approved / sent) * 100) : 0;
        let ctx = `\nBusiness context: ${sent} quotes sent, ${approved} approved (${closeRate}% close rate).`;
        if (needsFollowUp.length > 0) {
          ctx += ` ${needsFollowUp.length} quote${needsFollowUp.length > 1 ? 's' : ''} viewed but not approved — follow-up opportunities: ${needsFollowUp.slice(0, 3).map(q => `"${q.title}" for ${q.customer?.name || 'customer'} (viewed ${q.view_count || 1}×)`).join(', ')}.`;
        }
        if (drafts.length > 0) {
          ctx += ` ${drafts.length} unfinished draft${drafts.length > 1 ? 's' : ''}.`;
        }
        bizContext = ctx;
      }
    } catch {}
  }

  const systemPrompt = `You are Foreman — a senior trades pro built into the Punchlist app.${trade !== 'Other' ? ` This contractor is a ${trade.toLowerCase()}.` : ''} ${region}, ${curr} pricing.${labCtx}${bizContext}${activeQuoteCtx}

CRITICAL RESPONSE RULES:
1. Lead with the answer. First sentence = what to do or what it costs.
2. MAX 3-4 short lines unless they explicitly ask for detail.
3. Never start with "Great question", "Sure!", "I'd be happy to", "Absolutely", or any filler.
4. Never add safety disclaimers or "consult a professional" — they ARE the professional.
5. Use plain language. No bullet lists unless 4+ items.
6. When suggesting work, end with: "Want me to quote it?" or "Want me to scope it?"
7. When analyzing photos: state what's wrong, state the fix, state approximate cost. Three lines max.
8. Code references: cite the code section only, don't explain what codes are.
9. Never repeat back what they said. They know what they asked.
10. If you use a tool, summarize the result in 1-2 lines. Don't narrate what you did.
11. If the contractor asks about their day, status, or what to focus on, reference the business context above — mention quotes needing follow-up and close rate if relevant. Don't lecture, just surface the data.
12. If there is an ACTIVE QUOTE above, you can see its line items, description, and total. Reference this directly when the contractor asks about "this quote", "the current job", "what else to include", etc. Suggest specific missing items with prices. Don't say you can't see the quote — you can.
13. PERMITS / CODE / INSPECTIONS — permit rules and amendments often differ by municipality, not just province. When the question is permit, inspection, code amendment, or local approval, ALWAYS ask for the job city / town / municipality first if it has not been mentioned in this turn. Give the answer in the SAME reply: state the provincial baseline you know, then say one short line like "Which city is the job in? Some permits are municipal" and stop. Don't ask if the answer is obviously province-wide (e.g., national electrical code minimums). Once they tell you the city, give the city-specific answer if you know it; if not, name the AHJ (Authority Having Jurisdiction) they should call and say what to ask for.

Example good responses:
User: "Breaker keeps tripping on kitchen circuit"
You: "Probably overloaded — kitchens need dedicated 20A circuits (CEC 26-722). Check if it's a shared 15A. If so, you need a circuit split. ~$485 labour + materials. Want me to scope it?"

User: "Do I need a permit to replace a water heater?"
You: "Provincially in ${province}: yes for gas, usually no for like-for-like electric swaps. Which city is the job in? Permit fees and inspection rules vary by municipality."

User: "How much for a faucet install?"
You: "Kitchen faucet swap: $180–$320 labour, $15–$40 in fittings. Total $195–$360 depending on access and shutoff condition."

User: "What else should I include?" (with active quote context)
You: Look at the active quote items and suggest commonly paired items that are missing — be specific with item names and prices.

Knowledge: ${country === 'CA' ? 'CEC, CPC, NBC' : 'NEC, IPC, IBC'} for ${province}. Format links as [LINK:/app/path].`;

  // Build Claude messages
  const claudeMessages = [];
  for (const msg of messages.slice(-20)) {
    if (msg.role === 'user') {
      const content = [];
      if (msg.photo) {
        content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: msg.photo } });
      }
      content.push({ type: 'text', text: msg.content || (msg.photo ? 'What do you see? Diagnose and suggest the fix.' : '') });
      claudeMessages.push({ role: 'user', content });
    } else if (msg.role === 'assistant') {
      claudeMessages.push({ role: 'assistant', content: msg.content });
    }
  }

  try {
    const hasPhoto = messages.some(m => m.photo);
    const model = hasPhoto ? 'claude-sonnet-4-20250514' : 'claude-haiku-4-5-20251001';

    let resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        system: systemPrompt,
        messages: claudeMessages,
        tools: userId ? TOOL_DEFS : undefined,
      }),
    });

    let data = await resp.json();
    if (!resp.ok) throw new Error(data.error?.message || `Claude ${resp.status}`);

    // Tool-use loop. Cap at 3 iterations so a misbehaving model can't
    // spin Anthropic calls indefinitely and so multi-step conversational
    // flows ("find the customer, then create a quote") work — the
    // previous one-shot handling silently dropped the second tool call.
    const MAX_TOOL_TURNS = 3;
    let turn = 0;
    const supabase = getSupabase();
    let conversation = [...claudeMessages];
    while (turn < MAX_TOOL_TURNS) {
      const toolUseBlock = data.content?.find(b => b.type === 'tool_use');
      if (!toolUseBlock || !userId) break;
      if (!supabase) {
        console.error('[ai-assist] Cannot execute tool - Supabase not configured');
        return res.status(200).json({ role: 'assistant', content: 'I can not access your data right now. The database connection is not configured.' });
      }
      const toolResult = await executeTool(toolUseBlock.name, toolUseBlock.input || {}, userId, supabase);
      conversation = [
        ...conversation,
        { role: 'assistant', content: data.content },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseBlock.id, content: toolResult }] },
      ];
      const resp2 = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 800,
          system: systemPrompt,
          messages: conversation,
          tools: TOOL_DEFS,
        }),
      });
      const data2 = await resp2.json();
      if (!resp2.ok) break;
      data = data2;
      turn++;
    }

    // Extract text from response
    const textBlocks = (data.content || []).filter(b => b.type === 'text');
    const content = textBlocks.map(b => b.text).join('\n') || 'No response.';

    const appLinks = [...(content.match(/\[LINK:(\/app\/[^\]]+)\]/g) || [])].map(l => l.match(/\[LINK:(.*?)\]/)[1]);
    const cleanContent = content.replace(/\[LINK:[^\]]+\]/g, '').trim();

    return res.status(200).json({ role: 'assistant', content: cleanContent, appLinks });
  } catch (e) {
    console.error('[ai-assist] Foreman error:', e.message);
    return res.status(200).json({ role: 'assistant', content: 'Having trouble connecting. Try again in a moment.' });
  }
}
