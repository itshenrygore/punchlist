import { createClient } from '@supabase/supabase-js';
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
    name: 'read_schedule',
    description: 'Get upcoming scheduled jobs for the contractor',
    input_schema: { type: 'object', properties: { days_ahead: { type: 'number', description: 'Days to look ahead (default 7)' } } },
  },
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
  {
    name: 'schedule_job',
    description: 'Schedule a job on the calendar',
    input_schema: {
      type: 'object',
      properties: { customer_name: { type: 'string' }, date: { type: 'string' }, duration_minutes: { type: 'number' }, notes: { type: 'string' } },
      required: ['date'],
    },
  },
];

async function executeTool(name, args, userId, supabase) {
  try {
    if (name === 'read_schedule') {
      const days = args.days_ahead || 7;
      const from = new Date().toISOString();
      const to = new Date(Date.now() + days * 86400000).toISOString();
      const { data } = await supabase.from('bookings').select('*, customer:customers(name)').eq('user_id', userId).gte('scheduled_for', from).lte('scheduled_for', to).order('scheduled_for');
      if (!data?.length) return 'No jobs scheduled in the next ' + days + ' days.';
      return data.map(b => `${b.customer?.name || 'Direct'} — ${new Date(b.scheduled_for).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })} at ${new Date(b.scheduled_for).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })} (${b.duration_minutes || 120}min) [${b.status}]${b.notes ? ' — ' + b.notes : ''}`).join('\n');
    }
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
      const { data } = await supabase.from('customers').select('id, name, email, phone').eq('user_id', userId).order('name').limit(20);
      if (!data?.length) return 'No contacts.';
      if (args.search) {
        const s = args.search.toLowerCase();
        const filtered = data.filter(c => [c.name, c.email, c.phone].some(v => String(v || '').toLowerCase().includes(s)));
        return filtered.length ? filtered.map(c => `${c.name}${c.phone ? ' · ' + c.phone : ''}${c.email ? ' · ' + c.email : ''}`).join('\n') : 'No contacts matching "' + args.search + '".';
      }
      return data.map(c => `${c.name}${c.phone ? ' · ' + c.phone : ''}`).join('\n');
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
      let customer_id = null;
      if (args.customer_name) {
        const { data: custs } = await supabase.from('customers').select('id, name').eq('user_id', userId).ilike('name', '%' + args.customer_name + '%').limit(1);
        if (custs?.length) customer_id = custs[0].id;
      }
      const items = (args.line_items || []).map((it, i) => ({ id: 'f_' + i, name: it.name, quantity: it.quantity || 1, unit_price: it.unit_price || 0, notes: '', included: true, category: '' }));
      const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
      const { data: quote, error } = await supabase.from('quotes').insert({
        user_id: userId, customer_id, title: args.title, description: args.description || '', trade: args.trade || null, status: 'draft', total, share_token: Math.random().toString(36).slice(2, 10),
      }).select().single();
      if (error) return 'Error creating quote: ' + error.message;
      // Insert line items separately
      if (items.length) {
        await supabase.from('line_items').insert(items.map(it => ({ ...it, quote_id: quote.id })));
      }
      return `Draft created: "${quote.title}" — $${total}. [LINK:/app/quotes/${quote.id}/edit]`;
    }
    if (name === 'schedule_job') {
      let customer_id = null;
      if (args.customer_name) {
        const { data: custs } = await supabase.from('customers').select('id').eq('user_id', userId).ilike('name', '%' + args.customer_name + '%').limit(1);
        if (custs?.length) customer_id = custs[0].id;
      }
      const { error } = await supabase.from('bookings').insert({ user_id: userId, customer_id, scheduled_for: args.date, duration_minutes: args.duration_minutes || 120, status: 'scheduled', notes: args.notes || '' });
      if (error) return 'Error scheduling: ' + error.message;
      return `Scheduled for ${new Date(args.date).toLocaleDateString('en-CA', { weekday: 'long', month: 'short', day: 'numeric' })}. [LINK:/app/bookings]`;
    }
    return 'Unknown tool.';
  } catch (e) { return 'Error: ' + (e.message || 'failed'); }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (blocked(res, `ai-assist:${getClientIp(req)}`, 20, 60_000)) return;
  const { messages = [], userId, trade = 'Other', province = 'AB', country = 'CA', labourRate = 0 } = req.body || {};
  if (!messages.length) return res.status(400).json({ error: 'No messages' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(200).json({ role: 'assistant', content: 'Foreman needs an API key. Add ANTHROPIC_API_KEY to your Vercel environment.' });

  const curr = country === 'US' ? 'USD' : 'CAD';
  const region = country === 'US' ? 'American' : 'Canadian';
  const labCtx = labourRate > 0 ? ` The contractor charges $${labourRate}/hr.` : '';

  const systemPrompt = `You are Foreman — a senior trades pro built into the Punchlist app.${trade !== 'Other' ? ` This contractor is a ${trade.toLowerCase()}.` : ''} ${region}, ${curr} pricing.${labCtx}

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

Example good responses:
User: "Breaker keeps tripping on kitchen circuit"
You: "Probably overloaded — kitchens need dedicated 20A circuits (CEC 26-722). Check if it's a shared 15A. If so, you need a circuit split. ~$485 labour + materials. Want me to scope it?"

User: "How much for a faucet install?"
You: "Kitchen faucet swap: $180–$320 labour, $15–$40 in fittings. Total $195–$360 depending on access and shutoff condition."

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

    // Check if Claude wants to use a tool
    const toolUseBlock = data.content?.find(b => b.type === 'tool_use');

    if (toolUseBlock && userId) {
      // Create supabase client for tool execution
      const supabase = getSupabase();
      if (!supabase) {
        console.error('[ai-assist] Cannot execute tool - Supabase not configured');
        return res.status(200).json({ role: 'assistant', content: 'I can not access your data right now. The database connection is not configured.' });
      }
      
      const toolResult = await executeTool(toolUseBlock.name, toolUseBlock.input || {}, userId, supabase);

      // Send tool result back to Claude for final response
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
          messages: [
            ...claudeMessages,
            { role: 'assistant', content: data.content },
            { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseBlock.id, content: toolResult }] },
          ],
          tools: TOOL_DEFS,
        }),
      });

      const data2 = await resp2.json();
      if (resp2.ok) data = data2;
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
