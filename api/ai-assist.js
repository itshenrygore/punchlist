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
    name: 'read_quote_detail',
    description: 'Pull the full scope of one specific quote — every line item with its quantity and price, the customer name, status, total, and view count. Use this when the contractor asks about a specific quote by title or customer ("what is on the Smith quote", "look at the bathroom reno for Maria") and you do not already have an ACTIVE QUOTE in context. Prefer this over read_quotes when you need item-level detail.',
    input_schema: { type: 'object', properties: { quote_search: { type: 'string', description: 'Quote title fragment or customer name to disambiguate which quote to load.' } }, required: ['quote_search'] },
  },
  {
    name: 'update_quote',
    description: 'Apply a focused edit to one of the contractor\'s draft quotes: change the price of an existing line item, add a new line item, or remove a line item by name. Only operates on DRAFT quotes — never touches sent or approved quotes. Use this when the contractor explicitly tells you to make a change ("raise the faucet to 280", "add a permit line at 180", "drop the disposal line"). Always confirm the new total in your reply.',
    input_schema: {
      type: 'object',
      properties: {
        quote_search: { type: 'string', description: 'Quote title fragment or customer name to identify which draft to edit.' },
        edits: {
          type: 'array',
          description: 'List of edits to apply. Each edit must target a line item by name (case-insensitive substring match) or be marked as an addition.',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['set_price', 'add', 'remove'] },
              item_name: { type: 'string', description: 'Name to match for set_price/remove, or the new line item name for add.' },
              unit_price: { type: 'number', description: 'New price (set_price) or starting price (add). Required for set_price and add.' },
              quantity: { type: 'number', description: 'Quantity for add. Defaults to 1.' },
            },
            required: ['action', 'item_name'],
          },
        },
      },
      required: ['quote_search', 'edits'],
    },
  },
  {
    name: 'draft_followup',
    description: 'Compose a short, ready-to-send follow-up text for ONE specific quote based on its status, age, and view count. Returns the draft text — does NOT auto-send. The frontend renders it with a one-tap Send button. Use when the contractor asks "draft a follow-up for X" or "what should I send the Smith customer".',
    input_schema: {
      type: 'object',
      properties: {
        quote_search: { type: 'string', description: 'Quote title fragment or customer name.' },
        tone: { type: 'string', enum: ['friendly', 'firm', 'closing'], description: 'friendly = soft nudge; firm = it has been a while; closing = decision-time. Defaults to friendly.' },
      },
      required: ['quote_search'],
    },
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
    // Helper: resolve a search fragment to one quote owned by the user.
    // Returns { quote, ambiguous, none } so callers can branch on each
    // case and surface a useful message to the model.
    async function findOneQuote(search) {
      const s = String(search || '').trim().toLowerCase();
      if (!s) return { none: true };
      // Pull recent quotes and rank by title / customer-name match. Limited
      // to the most recent 80 to keep the payload bounded even for
      // contractors with hundreds of quotes.
      const { data: rows } = await supabase
        .from('quotes')
        .select('id, title, status, total, trade, province, view_count, sent_at, updated_at, customer:customers(name), line_items')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(80);
      if (!rows?.length) return { none: true };
      const matches = rows.filter(r => {
        const title = String(r.title || '').toLowerCase();
        const cust  = String(r.customer?.name || '').toLowerCase();
        return title.includes(s) || cust.includes(s);
      });
      if (!matches.length) return { none: true };
      if (matches.length > 1) {
        // Prefer an exact title match over a substring tie; otherwise tell
        // the model the list so it can ask the contractor to clarify.
        const exact = matches.find(r => String(r.title || '').toLowerCase() === s);
        if (exact) return { quote: exact };
        return { ambiguous: matches.slice(0, 5) };
      }
      return { quote: matches[0] };
    }

    if (name === 'read_quote_detail') {
      const found = await findOneQuote(args.quote_search);
      if (found.none) return `No quote matches "${args.quote_search}".`;
      if (found.ambiguous) {
        return 'Multiple quotes match — ask which one:\n'
          + found.ambiguous.map(r => `- "${r.title}" — ${r.customer?.name || 'no contact'} — $${r.total} [${r.status}]`).join('\n');
      }
      const q = found.quote;
      const items = Array.isArray(q.line_items) ? q.line_items : [];
      const itemLines = items.slice(0, 30).map(li =>
        `  - ${li.name}: ${Number(li.quantity || 1)}× $${Number(li.unit_price || 0)} = $${Number(li.quantity || 1) * Number(li.unit_price || 0)}`
      ).join('\n');
      return [
        `Quote: "${q.title}"`,
        `Customer: ${q.customer?.name || '—'}`,
        `Status: ${q.status} · Total: $${q.total} · Viewed ${q.view_count || 0}×`,
        `Trade: ${q.trade || '—'} · Province: ${q.province || '—'}`,
        items.length ? `\nLine items (${items.length}):\n${itemLines}` : '\nNo line items yet.',
      ].join('\n');
    }

    if (name === 'update_quote') {
      const found = await findOneQuote(args.quote_search);
      if (found.none) return `No quote matches "${args.quote_search}".`;
      if (found.ambiguous) {
        return 'Multiple quotes match — ask which one:\n'
          + found.ambiguous.map(r => `- "${r.title}" — ${r.customer?.name || 'no contact'} [${r.status}]`).join('\n');
      }
      const q = found.quote;
      // Hard guard: only drafts. A sent quote has been seen by the customer
      // and may have a signature / deposit attached — silently rewriting it
      // would be a real-money mistake. Force the contractor through the
      // revision flow instead.
      if (q.status !== 'draft') {
        return `Can't edit "${q.title}" — status is ${q.status}, not draft. The contractor needs to send a revision through the quote page so the customer sees the change.`;
      }
      const rawEdits = Array.isArray(args.edits) ? args.edits.slice(0, 10) : [];
      if (!rawEdits.length) return 'No edits provided.';

      // Load current items from the line_items table (source of truth) — the
      // `line_items` field on the quote row can drift.
      const { data: dbItems } = await supabase
        .from('line_items').select('id, name, quantity, unit_price, notes, included, category')
        .eq('quote_id', q.id);
      const items = (dbItems || []).map(li => ({ ...li }));

      const applied = [];
      const skipped = [];
      const clampNum = (v, lo, hi, dflt) => {
        const n = Number(v);
        return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
      };
      const clampStr = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

      for (const ed of rawEdits) {
        const action = String(ed?.action || '').toLowerCase();
        const itemName = clampStr(ed?.item_name, 220).trim();
        if (!itemName) { skipped.push('blank item_name'); continue; }
        if (action === 'set_price') {
          const target = items.find(li => li.name.toLowerCase().includes(itemName.toLowerCase()));
          if (!target) { skipped.push(`no line item matches "${itemName}"`); continue; }
          const newPrice = clampNum(ed.unit_price, 0, 1_000_000, null);
          if (newPrice === null) { skipped.push(`bad price on "${itemName}"`); continue; }
          const oldPrice = Number(target.unit_price || 0);
          target.unit_price = newPrice;
          await supabase.from('line_items').update({ unit_price: newPrice }).eq('id', target.id);
          applied.push(`${target.name}: $${oldPrice} → $${newPrice}`);
        } else if (action === 'add') {
          const newPrice = clampNum(ed.unit_price, 0, 1_000_000, 0);
          const qty = clampNum(ed.quantity, 0.01, 10_000, 1);
          const ins = { quote_id: q.id, name: itemName, quantity: qty, unit_price: newPrice, included: true, category: '', notes: '' };
          const { data: inserted } = await supabase.from('line_items').insert(ins).select().single();
          if (inserted) {
            items.push(inserted);
            applied.push(`+ ${itemName} (${qty}× $${newPrice})`);
          } else { skipped.push(`could not add "${itemName}"`); }
        } else if (action === 'remove') {
          const target = items.find(li => li.name.toLowerCase().includes(itemName.toLowerCase()));
          if (!target) { skipped.push(`no line item matches "${itemName}"`); continue; }
          await supabase.from('line_items').delete().eq('id', target.id);
          items.splice(items.indexOf(target), 1);
          applied.push(`− ${target.name}`);
        } else {
          skipped.push(`unknown action "${action}"`);
        }
      }

      // Recompute total and write back.
      const newTotal = items.reduce((s, li) => s + Number(li.quantity || 1) * Number(li.unit_price || 0), 0);
      await supabase.from('quotes').update({ total: newTotal, updated_at: new Date().toISOString() }).eq('id', q.id);

      const out = [
        `Updated "${q.title}". New total: $${newTotal}.`,
        applied.length ? `Applied:\n  ${applied.join('\n  ')}` : null,
        skipped.length ? `Skipped:\n  ${skipped.join('\n  ')}` : null,
        `[LINK:/app/quotes/${q.id}/edit]`,
      ].filter(Boolean).join('\n');
      return out;
    }

    if (name === 'draft_followup') {
      const found = await findOneQuote(args.quote_search);
      if (found.none) return `No quote matches "${args.quote_search}".`;
      if (found.ambiguous) {
        return 'Multiple quotes match — ask which one:\n'
          + found.ambiguous.map(r => `- "${r.title}" — ${r.customer?.name || 'no contact'} [${r.status}]`).join('\n');
      }
      const q = found.quote;
      // Don't return a tool result that pretends to send. Hand back the
      // facts and let the model compose the message in its reply — the
      // frontend renders it with a confirm-and-send affordance.
      const daysSent = q.sent_at ? Math.max(0, Math.round((Date.now() - new Date(q.sent_at).getTime()) / 86_400_000)) : null;
      const tone = ['friendly','firm','closing'].includes(args.tone) ? args.tone : 'friendly';
      return [
        `Follow-up context for "${q.title}":`,
        `  Customer: ${q.customer?.name || '—'}`,
        `  Status: ${q.status}${daysSent !== null ? ` (sent ${daysSent}d ago)` : ''}`,
        `  Viewed: ${q.view_count || 0}× · Total: $${q.total}`,
        `  Requested tone: ${tone}`,
        '',
        'Write the text the contractor can send verbatim — 1-2 short sentences, no "Hi there", reference the job specifically. Put the message in quotes so the contractor can copy it cleanly.',
      ].join('\n');
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
  let { messages = [], userId, trade = 'Other', province = 'AB', country = 'CA', defaultCity = '', labourRate = 0, quoteContext = null } = req.body || {};
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
  const cityCtx = defaultCity ? ` Primary city: ${defaultCity.slice(0, 80)}.` : '';

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

  const systemPrompt = `You are Foreman — a senior trades pro built into the Punchlist app.${trade !== 'Other' ? ` This contractor is a ${trade.toLowerCase()}.` : ''} ${region}, ${curr} pricing.${cityCtx}${labCtx}${bizContext}${activeQuoteCtx}

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
13. PERMITS / CODE / INSPECTIONS — permit rules and inspection authorities often differ by municipality, not just province. ${defaultCity ? `The contractor's primary city is ${defaultCity}; answer for ${defaultCity} by default, but ask which city if THIS job is somewhere else.` : 'When the question is permit, inspection, code amendment, or local approval, give the provincial baseline you know, then ask one short line like "Which city is the job in? Some permits are municipal." Don\'t ask if the answer is obviously province-wide (e.g. national electrical code minimums).'} When you don't know the city-specific rule, name the AHJ (Authority Having Jurisdiction) and say what to ask for.

TOOLS AVAILABLE — reach for them aggressively:
- read_quote_detail when asked about a specific named quote and there's no ACTIVE QUOTE above.
- update_quote when the contractor tells you to change a price, add a line, or remove a line on a DRAFT quote ("raise the faucet to 280", "add a permit line at 180"). After the tool runs, confirm the new total in one short line.
- draft_followup when asked to draft / write / send a follow-up for a specific quote.
- lookup_pricing for any "how much" or "what should I charge" question — use it before guessing.
- start_new_quote when the contractor wants to begin a brand-new job.
Never narrate the tool call. Just give the answer using its result.

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

  // ── Stream-aware Claude caller ──
  // Calls Anthropic with stream:true and reconstructs the full content[]
  // array client-side. On each text_delta, invokes onText so the handler
  // can forward tokens through the SSE pipe. Tool_use blocks come down as
  // partial input_json_delta events — buffered and parsed at content_block_stop.
  // Returns { content, stop_reason } in the same shape as a non-streaming call.
  async function callClaudeStream({ model, system, messages: msgs, max_tokens, tools, onText }) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({ model, system, messages: msgs, max_tokens, tools, stream: true }),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      throw new Error(`Claude ${r.status}: ${errText.slice(0, 160)}`);
    }
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const blocks = [];   // accumulated content blocks
    let cur = null;      // currently-building block
    let toolJsonBuf = '';
    let stopReason = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === '[DONE]') continue;
        let ev;
        try { ev = JSON.parse(payload); } catch { continue; }
        if (ev.type === 'content_block_start') {
          cur = { ...ev.content_block };
          if (cur.type === 'text') cur.text = '';
          if (cur.type === 'tool_use') { cur.input = {}; toolJsonBuf = ''; }
        } else if (ev.type === 'content_block_delta') {
          if (ev.delta?.type === 'text_delta' && cur?.type === 'text') {
            cur.text += ev.delta.text || '';
            onText?.(ev.delta.text || '');
          } else if (ev.delta?.type === 'input_json_delta' && cur?.type === 'tool_use') {
            toolJsonBuf += ev.delta.partial_json || '';
          }
        } else if (ev.type === 'content_block_stop') {
          if (cur?.type === 'tool_use') {
            try { cur.input = JSON.parse(toolJsonBuf || '{}'); } catch { cur.input = {}; }
          }
          if (cur) blocks.push(cur);
          cur = null;
        } else if (ev.type === 'message_delta') {
          if (ev.delta?.stop_reason) stopReason = ev.delta.stop_reason;
        }
      }
    }
    return { content: blocks, stop_reason: stopReason };
  }

  // Non-streaming caller — kept for the no-stream code path.
  async function callClaudeOnce({ model, system, messages: msgs, max_tokens, tools }) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, max_tokens, system, messages: msgs, tools }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `Claude ${r.status}`);
    return j;
  }

  try {
    const hasPhoto = messages.some(m => m.photo);
    const model = hasPhoto ? 'claude-sonnet-4-20250514' : 'claude-haiku-4-5-20251001';
    const wantStream = req.body?.stream === true;
    const MAX_TOOL_TURNS = 3;
    const supabase = getSupabase();

    // SSE setup if streaming. Tokens flow as `{"token":"..."}`; appLinks
    // and the [DONE] sentinel come at the end. Frontend already understands
    // this shape (foreman-panel.jsx parses both token and appLinks events).
    if (wantStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      // Vercel/Cloudflare proxies sometimes hold SSE without this hint.
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();
    }

    let turn = 0;
    let conversation = [...claudeMessages];
    let fullText = '';

    while (turn <= MAX_TOOL_TURNS) {
      const callOpts = {
        model,
        system: systemPrompt,
        messages: conversation,
        max_tokens: turn === 0 ? 1200 : 800,
        tools: userId ? TOOL_DEFS : undefined,
      };

      let resp;
      if (wantStream) {
        resp = await callClaudeStream({
          ...callOpts,
          onText: (chunk) => {
            fullText += chunk;
            // Hold back [LINK:...] markers from the wire — they're internal
            // routing, not user-visible content. Send everything else as
            // tokens. Imperfect mid-marker boundary handling: a [LINK that
            // arrives split across two deltas may flash briefly. Fine for
            // a perceived-speed win; the cleanup at end normalises.
            const clean = chunk.replace(/\[LINK:[^\]]+\]/g, '');
            if (clean) res.write(`data: ${JSON.stringify({ token: clean })}\n\n`);
          },
        });
      } else {
        resp = await callClaudeOnce(callOpts);
      }

      const toolUseBlock = resp.content?.find(b => b.type === 'tool_use');
      if (!toolUseBlock || !userId || turn === MAX_TOOL_TURNS) {
        // No more tools to run — extract final text and emit appLinks.
        const finalText = (resp.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
        const usedText = wantStream ? fullText : finalText;
        const appLinks = [...(usedText.match(/\[LINK:(\/app\/[^\]]+)\]/g) || [])].map(l => l.match(/\[LINK:(.*?)\]/)[1]);
        const cleanContent = usedText.replace(/\[LINK:[^\]]+\]/g, '').trim() || 'No response.';

        if (wantStream) {
          if (appLinks.length) res.write(`data: ${JSON.stringify({ appLinks })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }
        return res.status(200).json({ role: 'assistant', content: cleanContent, appLinks });
      }

      if (!supabase) {
        const msg = 'I can not access your data right now. The database connection is not configured.';
        if (wantStream) {
          res.write(`data: ${JSON.stringify({ token: msg })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }
        return res.status(200).json({ role: 'assistant', content: msg });
      }

      const toolResult = await executeTool(toolUseBlock.name, toolUseBlock.input || {}, userId, supabase);
      conversation = [
        ...conversation,
        { role: 'assistant', content: resp.content },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseBlock.id, content: toolResult }] },
      ];
      turn++;
    }
  } catch (e) {
    console.error('[ai-assist] Foreman error:', e.message);
    if (req.body?.stream === true && !res.writableEnded) {
      try {
        res.setHeader('Content-Type', 'text/event-stream');
      } catch { /* headers already sent */ }
      res.write(`data: ${JSON.stringify({ token: 'Having trouble connecting. Try again in a moment.' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }
    return res.status(200).json({ role: 'assistant', content: 'Having trouble connecting. Try again in a moment.' });
  }
}
