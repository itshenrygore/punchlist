/* ═══════════════════════════════════════════════════════════════
   Foreman — AI field assistant slide-over

   Design principles:
   - Feels like texting a knowledgeable coworker, not using a chatbot
   - Context-aware: knows what page you're on, what quote you're editing
   - One-tap actions over typing when possible
   - Brief responses with structured action cards
   - Non-intimidating for contractors who aren't tech-savvy
   ═══════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';
import { useToast } from './toast';
import { supabase } from '../lib/supabase';
import { smsNotify } from '../lib/sms';
import { currency } from '../lib/format';
import ForemanLogo from './foreman-logo';

/* ─── Contextual quick actions based on current page ───
 * These are the entry-point prompts contractors see before they type.
 * Each one is a sentence that gets sent verbatim to the model, so the
 * wording matters — they need to read as something a real contractor
 * would ask in the moment, and they need to surface Foreman's most
 * valuable capabilities (scope review, missed items, pricing checks,
 * follow-up drafts, field diagnosis, pipeline triage).
 */
function getQuickActions(pathname, quoteContext) {
  // ── In the quote builder / quote detail, with a live scope ───
  if (quoteContext) {
    const tradeWord = quoteContext.trade?.toLowerCase() || 'this';
    return [
      { key: 'review',  label: 'Review this scope',
        send: `Review this ${tradeWord} scope end-to-end. Flag anything missing (permits, disposal, common code items), anything underbid for my province, and any line items that don't belong.` },
      { key: 'missing', label: "What am I missing?",
        send: `What line items do contractors typically forget on a ${tradeWord} job like this? Be specific with item names and a fair price range so I can add them.` },
      { key: 'pricing', label: 'Check my pricing',
        send: 'Walk through my line items and tell me which prices look low, high, or right for my province. Use catalog ranges, not gut feel.' },
      { key: 'code',    label: 'Code & permit check',
        send: `What permits and code items are likely required for this ${tradeWord} job? Cover the provincial baseline, then ask me which city the job is in — some permits are municipal — and call out anything that would fail inspection if left out.` },
      { key: 'upsell',  label: 'Smart upsells',
        send: `Based on this scope, what 2-3 optional upsells should I offer the customer? Pick add-ons they're likely to say yes to and explain why each one matters.` },
    ];
  }

  // ── On a specific quote detail page (no live scope context yet) ──
  if (/^\/app\/quotes\/[^/]+$/.test(pathname) || /^\/app\/quotes\/[^/]+\/edit$/.test(pathname)) {
    return [
      { key: 'followup', label: 'Draft a follow-up',
        send: 'Draft a short follow-up text I can send the customer on this quote — friendly, specific, no pressure. Mention the monthly option if it makes sense.' },
      { key: 'objection', label: 'Likely objections',
        send: 'What objections should I be ready for on this quote? Give me a one-line response to each.' },
      { key: 'close',    label: 'How do I close this?',
        send: 'This quote has been sitting. What can I do to move it forward without dropping price?' },
      { key: 'pricing',  label: 'Check my pricing',
        send: 'Quick pricing check on this quote — anything off for my province?' },
    ];
  }

  // ── Dashboard ─────────────────────────────────────────────
  if (pathname === '/app' || pathname === '/app/') {
    return [
      { key: 'today',    label: 'What should I focus on today?',
        send: "Look at my pipeline. What are the 2-3 highest-value things I should do today — quotes to follow up on, deposits to chase, jobs to schedule." },
      { key: 'risk',     label: 'Jobs at risk',
        send: 'Which of my open quotes are at risk of going cold or being declined? What should I do about each?' },
      { key: 'pricing',  label: 'Look up a price',
        send: '' },
      { key: 'snapshot', label: 'How am I doing?',
        send: 'Give me a 3-sentence business snapshot — close rate this month, pipeline value, and the one thing to fix to grow.' },
    ];
  }

  // ── Quote builder index / list ────────────────────────────
  if (pathname.startsWith('/app/quotes')) {
    return [
      { key: 'scope-help', label: 'Help me scope a job',
        send: '' },
      { key: 'followup',   label: 'Who needs a follow-up?',
        send: 'Which of my sent quotes need follow-up right now? Sort by urgency and tell me what to say to each.' },
      { key: 'pricing',    label: 'Look up a price',
        send: '' },
      { key: 'close-rate', label: 'Boost my close rate',
        send: 'Look at my last 10 quotes. What patterns do you see in the ones that closed vs the ones that didn\'t? Give me 2-3 concrete changes.' },
    ];
  }

  // ── Customers ─────────────────────────────────────────────
  if (pathname.startsWith('/app/customers')) {
    return [
      { key: 'top',         label: 'Top customers',
        send: 'Who are my top 5 customers by lifetime revenue, and what kind of work do they buy?' },
      { key: 'reengage',    label: 'Who to reach back out to',
        send: "Which customers haven't I quoted in 60+ days that are worth reaching out to again? Suggest a one-line message for each." },
      { key: 'open',        label: 'Anyone with open quotes?',
        send: 'List every customer with at least one open or viewed quote, and what stage each one is at.' },
      { key: 'history',     label: 'Customer history',
        send: '' },
    ];
  }

  // ── Invoices ──────────────────────────────────────────────
  if (pathname.startsWith('/app/invoices')) {
    return [
      { key: 'unpaid',   label: 'Who hasn\'t paid?',
        send: 'Which invoices are unpaid? Sort by days overdue and draft a polite follow-up I can send for each one.' },
      { key: 'cashflow', label: 'My cash flow this month',
        send: 'What\'s my cash flow situation this month — paid, expected, overdue. One short paragraph.' },
      { key: 'fix',      label: 'Fix a bad invoice',
        send: '' },
      { key: 'late-fee', label: 'When to add a late fee',
        send: 'When is it appropriate to add a late fee on an unpaid invoice, and how do I word it without burning the relationship?' },
    ];
  }

  // ── Analytics ─────────────────────────────────────────────
  if (pathname.startsWith('/app/analytics')) {
    return [
      { key: 'underprice', label: 'Am I underpricing?',
        send: 'Compare my recent quote totals to what\'s typical in my trade and province. Where am I leaving money on the table?' },
      { key: 'win',        label: 'Why am I winning?',
        send: 'Look at my won quotes vs declined ones. What jobs do I close best? What jobs should I stop quoting?' },
      { key: 'pricing',    label: 'Reprice an old job',
        send: '' },
      { key: 'grow',       label: 'Where to grow',
        send: 'Based on my close rate by trade and job type, what kind of work should I be chasing more of?' },
    ];
  }

  // ── Default catch-all (settings, billing, etc.) ───────────
  // The most-seen empty state across the app. Tilt these toward the things
  // a contractor needs in the moment — not just business-coaching prompts.
  return [
    { key: 'price',    label: 'Look up a price',
      send: '' },
    { key: 'diag',     label: 'Diagnose something',
      send: "I'm looking at a problem in the field — can I describe it (or send a photo) and you tell me likely cause and fix with cost?" },
    { key: 'code',     label: 'Code or permit question',
      send: '' },
    { key: 'spec',     label: 'Material or spec lookup',
      send: '' },
  ];
}

/* ─── Follow-up suggestions after an AI response ─── */
function getFollowUps(lastMsg, quoteContext) {
  if (!lastMsg || lastMsg.role !== 'assistant') return [];
  const text = (lastMsg.content || '').toLowerCase();
  const chips = [];

  if (text.includes('want me to quote') || text.includes('want me to scope'))
    chips.push({ label: 'Yes, scope it', send: 'Yes, scope it out.' });
  if (text.includes('follow') && text.includes('up'))
    chips.push({ label: 'Show all follow-ups', send: 'Show me all quotes that need follow-up.' });
  if (quoteContext && (text.includes('missing') || text.includes('add') || text.includes('suggest')))
    chips.push({ label: 'Add all to quote', send: 'Add all suggested items to the quote.' });
  if (text.includes('follow') || text.includes('nudge'))
    chips.push({ label: 'Draft a nudge text', send: 'Draft a follow-up text I can send.' });
  // Capability-true pricing follow-up — Foreman can reason about whether a
  // line is low/high using catalog ranges. (Replaced "Compare to my area",
  // which promised location-specific data it doesn't have and replied
  // "I can't do that" — a trust-killer.)
  if (text.includes('price') || text.includes('$'))
    chips.push({ label: 'Which items look underpriced?', send: 'Which of these line items look underpriced for my province, and what would you charge?' });

  return chips.slice(0, 3);
}

/* ─── Parse pricing items from AI response for "Add to quote" ───
 * Claude formats line items inconsistently — sometimes hyphen bullets,
 * sometimes asterisks, sometimes plain numbered lines; sometimes "$120–$160"
 * with an en-dash, sometimes "$120 to $160", sometimes just "$140".
 * The old parser required exactly one shape and silently dropped the rest,
 * so most "+ Add" buttons never appeared. This is shape-tolerant: any
 * bulleted / numbered line that ends with a recognisable price wins. */
function parseAddToQuote(text) {
  const items = [];
  const seen = new Set();
  const lines = String(text || '').split(/\r?\n/);
  // bullet/number prefix → name → (optional :) → ($lo - $hi) | (~$mid) | ($mid)
  // Names cap at ~80 chars so a sentence with a stray "$" doesn't get picked.
  const rx = /^\s*(?:[-*•·]|\d+[.)])\s+(.{2,80}?)\s*[:–—-]?\s*~?\$\s?([\d,]+)(?:\s*(?:[–—-]|to)\s*\$?\s?([\d,]+))?\s*$/;
  for (const raw of lines) {
    const m = raw.match(rx);
    if (!m) continue;
    const lo = Number(m[2].replace(/,/g, ''));
    const hi = m[3] ? Number(m[3].replace(/,/g, '')) : lo;
    if (!Number.isFinite(lo) || lo <= 0) continue;
    const high = Math.max(lo, hi);
    const mid = Math.round(lo + (high - lo) * 0.55);
    // Strip markdown emphasis / trailing punctuation from the name.
    const name = m[1].replace(/[*_`]/g, '').replace(/[.,;]$/, '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ name, unit_price: mid, lo, hi: high });
  }
  return items;
}

/* ─── Detect a quoted draft message — the model emits draft texts in
 * quotes when draft_followup runs, but it also quotes example responses
 * in normal answers. So we only treat it as a sendable draft when (a)
 * the message has a clear "send" framing in the surrounding text and
 * (b) the quoted body is short (text-length, not paragraph length). */
function extractDraftReply(text) {
  if (!text) return null;
  const hint = /\b(follow ?up|send|text|message|nudge|draft)\b/i.test(text);
  if (!hint) return null;
  // First “quoted block” — straight or smart quotes. Cap at 280 chars so
  // we don't pull in a multi-paragraph rationale.
  const m = text.match(/[“"](.{20,280}?)[”"]/);
  if (!m) return null;
  // Strip trailing prompt-completion artifacts ("...send this:") that
  // sometimes sneak into the quoted body.
  return m[1].trim();
}

/* ─── Message bubble ─── */
function MessageBubble({ msg, onNavigate, onAddItem, addedItems, customerPhone, onSendSms, sentDrafts }) {
  const isUser = msg.role === 'user';
  const items = !isUser ? parseAddToQuote(msg.content || '') : [];
  const draft = !isUser ? extractDraftReply(msg.content || '') : null;
  const draftKey = draft ? draft.slice(0, 60) : null;
  const draftSent = draftKey ? sentDrafts?.has(draftKey) : false;

  return (
    <div className={`fm-msg ${isUser ? 'fm-msg--user' : 'fm-msg--ai'}`}>
      {!isUser && <div className="fm-msg-avatar"><ForemanLogo size={14} stroke /></div>}
      <div className="fm-msg-body">
        {msg.photo && (
          <div className="fm-msg-photo">
            <img src={msg.photo} alt="Uploaded" />
          </div>
        )}
        <div className="fm-msg-text">
          {(msg.content || '').split('\n').map((line, i) => (
            <p key={i}>{line || ' '}</p>
          ))}
        </div>
        {msg.appLinks?.length > 0 && (
          <div className="fm-msg-links">
            {msg.appLinks.map((link, i) => (
              <button key={i} className="fm-link-btn" onClick={() => onNavigate(link)}>
                Open →
              </button>
            ))}
          </div>
        )}
        {items.length > 0 && onAddItem && (
          <div className="fm-msg-actions">
            {items.map((item, i) => {
              const wasAdded = addedItems.has(item.name);
              return (
                <button
                  key={i}
                  className={`fm-add-item-btn${wasAdded ? ' fm-add-item-btn--added' : ''}`}
                  onClick={() => !wasAdded && onAddItem(item)}
                  disabled={wasAdded}
                >
                  {wasAdded
                    ? <><span className="fm-check">✓</span> Added</>
                    : <><span className="fm-plus">+</span> {item.name} · {currency(item.unit_price)}</>}
                </button>
              );
            })}
          </div>
        )}
        {/* Foreman-drafted follow-up text → one-tap send via SMS when the
            active quote has a customer phone. Sending is the contractor's
            explicit action, not Foreman's — no auto-send anywhere. */}
        {draft && customerPhone && onSendSms && (
          <div className="fm-msg-actions">
            <button
              type="button"
              className={`fm-add-item-btn${draftSent ? ' fm-add-item-btn--added' : ''}`}
              onClick={() => !draftSent && onSendSms(draft)}
              disabled={draftSent}
              title={`Sends to ${customerPhone}`}
            >
              {draftSent
                ? <><span className="fm-check">✓</span> Sent</>
                : <><span className="fm-plus">↗</span> Send to customer via text</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="fm-msg fm-msg--ai">
      <div className="fm-msg-avatar"><ForemanLogo size={14} stroke /></div>
      <div className="fm-msg-body">
        <div className="fm-typing"><span /><span /><span /></div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function ForemanPanel({ open, onClose, quoteContext, onAddItemToQuote, openRequest, consumeOpenRequest }) {
  const { user } = useAuth();
  const { show: toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Persist the chat across panel open/close + page reloads so the
  // contractor can revisit a pricing question they asked an hour ago.
  // Stored per-user under pl_foreman_chat:<userId>. Auto-trims to the
  // last 30 messages to keep localStorage payload small. Cleared by
  // the New Chat button or when the user signs out (handled by the
  // browser session-storage on logout).
  // ── Conversation hygiene ──
  // The chat is persisted so a contractor can revisit yesterday's pricing
  // question, but two things go wrong if we just keep it forever:
  //   1. Stale context bleeds in — yesterday's kitchen-reno thread riding
  //      along when today's question is about a 50A breaker.
  //   2. Every turn ships up to 20 previous messages to the model, which
  //      gets expensive and dilutes the system prompt's instructions.
  // Compromise: keep messages persisted, but when the gap since the last
  // turn exceeds AUTO_ARCHIVE_HOURS, treat the prior thread as history —
  // it stays visible in the panel as a collapsed "Earlier today" /
  // "Yesterday" divider, but is excluded from the next API call so the
  // model starts fresh.
  const AUTO_ARCHIVE_HOURS = 4;
  const MAX_PERSISTED = 30;
  const _fmStorageKey = user?.id ? `pl_foreman_chat:${user.id}` : null;
  const [messages, setMessages] = useState(() => {
    if (!_fmStorageKey) return [];
    try {
      const raw = localStorage.getItem(_fmStorageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(-MAX_PERSISTED) : [];
    } catch { return []; }
  });
  useEffect(() => {
    if (!_fmStorageKey) return;
    try {
      if (messages.length === 0) localStorage.removeItem(_fmStorageKey);
      else localStorage.setItem(_fmStorageKey, JSON.stringify(messages.slice(-MAX_PERSISTED)));
    } catch { /* private mode / quota */ }
  }, [messages, _fmStorageKey]);
  // Index of the first message in the CURRENT session (everything before
  // is archived context — visible but not sent on the wire).
  const sessionStartIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const t = messages[i]?.ts;
      const prev = messages[i - 1]?.ts;
      if (!t || !prev) continue;
      if ((t - prev) / 36e5 >= AUTO_ARCHIVE_HOURS) return i;
    }
    return 0;
  })();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [addedItems, setAddedItems] = useState(new Set());
  // Track drafts already sent in this session so the Send button locks
  // out a duplicate tap if the contractor accidentally hits it twice.
  const [sentDrafts, setSentDrafts] = useState(() => new Set());
  const [listening, setListening] = useState(false);
  // First-time intro card. Persists dismissal in localStorage so it
  // doesn't reappear after the user has seen it, even if they never
  // actually send a message.
  const [showIntro, setShowIntro] = useState(() => {
    try { return !localStorage.getItem('pl_foreman_intro_seen'); }
    catch { return true; }
  });
  function dismissIntro() {
    setShowIntro(false);
    try { localStorage.setItem('pl_foreman_intro_seen', '1'); } catch { /* private mode */ }
  }

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const profile = useRef(null);
  const recognitionRef = useRef(null);

  // ── Load profile once ──
  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('trade, province, country, default_city, default_labour_rate, company_name, full_name')
      .eq('id', user.id).single().then(({ data }) => { if (data) profile.current = data; });
  }, [user]);

  // ── Focus input on open ──
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  // ── Consume one-shot open-with-prefill requests ──
  // Used by "Ask Foreman about this item" on a line item and by anywhere
  // else in the app that wants to drop the contractor into Foreman with
  // a starter question already typed.
  useEffect(() => {
    if (!open || !openRequest || !consumeOpenRequest) return;
    const req = consumeOpenRequest();
    if (!req) return;
    if (req.prefill) {
      setInput(req.prefill);
      // Microtask gives the textarea a frame to mount before we put the
      // cursor at the end so the user can keep typing or just hit send.
      setTimeout(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(req.prefill.length, req.prefill.length);
        }
      }, 60);
    }
  }, [open, openRequest, consumeOpenRequest]);

  // ── Auto-scroll to bottom ──
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  // ── Auto-resize textarea ──
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [input]);

  // ── Contextual quick actions ──
  const quickActions = getQuickActions(location.pathname, quoteContext);
  const lastMsg = messages[messages.length - 1];
  const followUps = messages.length > 0 && !loading ? getFollowUps(lastMsg, quoteContext) : [];

  // ── Greeting name ──
  const greetName = profile.current?.full_name?.split(' ')[0]
    || profile.current?.company_name?.split(' ')[0]
    || '';

  // ── Photo handling ──
  // The image is forwarded to Claude as base64 inside a serverless
  // function body. Both Vercel (~4.5MB body) and Anthropic (~5MB
  // image) impose limits, and base64 inflates the raw bytes ~33%.
  // Accept up to 4MB raw, then downscale on a canvas to a sensible
  // dimension and recompress to JPEG so the resulting base64 is
  // comfortably under the body cap.
  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast('Photo too large (max 4 MB) — try cropping or compressing it', 'error');
      return;
    }
    try {
      const dataUrl = await downscalePhoto(file, 1600, 0.85);
      setPhotoPreview(dataUrl);
      setPhotoBase64(dataUrl.split(',')[1]);
    } catch (err) {
      console.warn('[foreman] photo downscale failed', err?.message);
      toast('Could not load that photo — try a different one', 'error');
    }
  }

  // Returns a JPEG data URL no wider than `maxEdge`, recompressed until
  // the data URL is under ~3MB (sized for Vercel's request body limit).
  function downscalePhoto(file, maxEdge, initialQuality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('decode failed'));
        img.onload = () => {
          const ratio = Math.min(1, maxEdge / Math.max(img.width, img.height));
          const w = Math.round(img.width * ratio);
          const h = Math.round(img.height * ratio);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          let q = initialQuality;
          let url = canvas.toDataURL('image/jpeg', q);
          while (url.length > 3_000_000 && q > 0.4) {
            q -= 0.1;
            url = canvas.toDataURL('image/jpeg', q);
          }
          resolve(url);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  function clearPhoto() { setPhotoPreview(null); setPhotoBase64(null); }

  // ── Voice input via Web Speech API ──
  function toggleVoice() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast('Voice not supported in this browser', 'info');
      return;
    }
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(prev => (prev ? prev + ' ' : '') + transcript);
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  // ── Send message ──
  const send = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg && !photoBase64) return;
    if (loading) return;

    const userMsg = { role: 'user', content: msg, photo: photoPreview || null, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Only ship the CURRENT session to the model — anything older than the
    // archive boundary stays visible to the contractor but is not in the
    // wire payload, so the model can't accidentally hallucinate continuity
    // with yesterday's conversation.
    const sessionMsgs = messages.slice(sessionStartIdx);
    const apiMessages = [...sessionMsgs.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: msg, photo: photoBase64 || undefined }]
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-20);

    const p = profile.current || {};
    const body = {
      messages: apiMessages,
      userId: user?.id,
      trade: quoteContext?.trade || p.trade || 'Other',
      province: quoteContext?.province || p.province || 'ON',
      country: p.country || 'CA',
      defaultCity: p.default_city || '',
      labourRate: p.default_labour_rate || 0,
      quoteContext: quoteContext ? {
        description: quoteContext.description,
        title: quoteContext.title,
        trade: quoteContext.trade,
        items: quoteContext.items,
        total: quoteContext.total,
      } : null,
    };

    clearPhoto();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      const hdrs = { 'Content-Type': 'application/json' };
      if (authToken) hdrs['Authorization'] = `Bearer ${authToken}`;
      const resp = await fetch('/api/ai-assist', {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({ ...body, stream: true }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || 'Something went wrong');
      }

      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') && resp.body) {
        const placeholder = { role: 'assistant', content: '', appLinks: [], ts: Date.now() };
        setMessages(prev => [...prev, placeholder]);
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const payload = line.slice(6);
              if (payload === '[DONE]') break;
              try {
                const parsed = JSON.parse(payload);
                if (parsed.token) {
                  accumulated += parsed.token;
                  setMessages(prev => {
                    const next = [...prev];
                    next[next.length - 1] = { ...next[next.length - 1], content: accumulated };
                    return next;
                  });
                }
                if (parsed.appLinks) {
                  setMessages(prev => {
                    const next = [...prev];
                    next[next.length - 1] = { ...next[next.length - 1], appLinks: parsed.appLinks };
                    return next;
                  });
                }
              } catch {}
            }
          }
        }
        if (!accumulated) {
          setMessages(prev => {
            const next = [...prev];
            next[next.length - 1] = { ...next[next.length - 1], content: 'No response.' };
            return next;
          });
        }
      } else {
        const data = await resp.json();
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.content || 'No response.',
          appLinks: data.appLinks || [],
          ts: Date.now(),
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Connection error — try again in a sec.',
        ts: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, photoBase64, photoPreview, loading, user, quoteContext]);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function handleNavigate(path) { navigate(path); onClose(); }

  async function handleSendDraftSms(draftText) {
    const phone = quoteContext?.customerPhone;
    if (!phone || !draftText) return;
    try {
      await smsNotify.customMessage({ to: phone, body: draftText });
      setSentDrafts(prev => new Set(prev).add(draftText.slice(0, 60)));
      toast('Sent to customer', 'success');
    } catch (e) {
      toast(e?.message || 'Could not send the text', 'error');
    }
  }

  function handleAddItem(item) {
    if (onAddItemToQuote) {
      onAddItemToQuote(item);
      setAddedItems(prev => new Set(prev).add(item.name));
      toast(`Added: ${item.name}`, 'success');
    } else {
      toast('Open a quote first to add items', 'info');
    }
  }

  function handleQuickAction(action) {
    if (action.send) {
      send(action.send);
    } else {
      setInput(action.label + ' ');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleNewChat() {
    setMessages([]); setInput(''); clearPhoto(); setAddedItems(new Set());
  }

  if (!open) return null;

  const hasQuote = !!quoteContext;

  return (
    <>
      <div className="fm-overlay" onClick={onClose} />
      <div className="fm-panel" role="dialog" aria-label="Foreman assistant">
        {/* Drag handle — visual affordance that this is a dismissable
            bottom sheet on mobile. Tapping it closes the sheet for
            users who don't notice the X in the corner. */}
        <button
          type="button"
          className="fm-drag-handle"
          onClick={onClose}
          aria-label="Close Foreman"
        >
          <span className="fm-drag-handle-bar" />
        </button>

        {/* ── Header ── */}
        <div className="fm-header">
          <div className="fm-header-left">
            <div className="fm-logo"><ForemanLogo size={18} stroke /></div>
            <div>
              <div className="fm-header-title">Foreman</div>
              <div className="fm-header-sub">{hasQuote ? 'Quote assistant' : 'Your field assistant'}</div>
            </div>
          </div>
          <div className="fm-header-actions">
            {messages.length > 0 && (
              <button className="fm-header-btn" onClick={handleNewChat} title="New chat">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            )}
            <button className="fm-header-btn" onClick={onClose} title="Close (Esc)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {/* ── Quote context bar ── */}
        {hasQuote && (
          <div className="fm-context-bar">
            <span className="fm-context-dot" />
            <span className="fm-context-text">
              {quoteContext.title || quoteContext.trade || 'Quote'} · {quoteContext.items?.length || 0} items · {currency(quoteContext.total || 0)}
            </span>
          </div>
        )}

        {/* ── Messages ── */}
        <div className="fm-messages" ref={scrollRef}>

          {/* Empty state — warm and brief */}
          {messages.length === 0 && (
            <div className="fm-empty">
              <div className="fm-empty-logo"><ForemanLogo size={28} stroke /></div>
              <h3 className="fm-empty-title">
                {greetName ? `Hey ${greetName}` : 'Hey'} — what are we working on?
              </h3>
              {/* Hide the generic subtitle while the first-time intro
                  is showing — they convey the same thing and the
                  doubled copy pushed the prompt chips off the sheet. */}
              {!(showIntro && !hasQuote) && (
                <p className="fm-empty-body">
                  {hasQuote
                    ? 'I can see your quote. Tap below or just ask.'
                    : 'Pricing, scoping, schedule, follow-ups — tap or type.'}
                </p>
              )}

              {/* First-time intro — one tight paragraph so the prompts
                  below stay visible above the keyboard. Dismissed
                  permanently via the X or implicitly once the user
                  starts a real conversation. */}
              {showIntro && !hasQuote && (
                <div className="fm-intro">
                  <button
                    type="button"
                    className="fm-intro-close"
                    onClick={dismissIntro}
                    aria-label="Dismiss"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                  <p className="fm-intro-lead">
                    I review your scopes, draft customer follow-ups, look up prices, and help diagnose what you see in the field.
                  </p>
                </div>
              )}

              {/* Quick actions — contextual to current page */}
              <div className="fm-quick-actions">
                {quickActions.map(a => (
                  <button key={a.key} className="fm-quick-btn" onClick={() => handleQuickAction(a)}>
                    {a.label}
                  </button>
                ))}
              </div>

              {/* Photo CTA — feels natural, not techy */}
              <button className="fm-photo-cta" type="button" onClick={() => fileRef.current?.click()}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                Snap a photo for diagnosis
              </button>
            </div>
          )}

          {/* Chat messages — archived earlier-session messages remain
              visible so the contractor can scroll back, but a divider
              makes it clear Foreman is starting fresh below. */}
          {messages.map((msg, i) => {
            const showDivider = i === sessionStartIdx && sessionStartIdx > 0;
            return (
              <div key={i}>
                {showDivider && (
                  <div className="fm-session-divider">
                    <span>Earlier conversation</span>
                  </div>
                )}
                <MessageBubble
                  msg={msg}
                  onNavigate={handleNavigate}
                  onAddItem={onAddItemToQuote ? handleAddItem : null}
                  addedItems={addedItems}
                  customerPhone={quoteContext?.customerPhone}
                  onSendSms={quoteContext?.customerPhone ? handleSendDraftSms : null}
                  sentDrafts={sentDrafts}
                />
              </div>
            );
          })}

          {loading && <TypingIndicator />}

          {/* Follow-up suggestion chips after AI response */}
          {followUps.length > 0 && !loading && (
            <div className="fm-followups">
              {followUps.map((chip, i) => (
                <button key={i} className="fm-followup-chip" onClick={() => send(chip.send)}>
                  {chip.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Photo preview ── */}
        {photoPreview && (
          <div className="fm-photo-preview">
            <img src={photoPreview} alt="Preview" />
            <button className="fm-photo-remove" onClick={clearPhoto} aria-label="Remove photo">×</button>
          </div>
        )}

        {/* ── Input bar ── */}
        <div className="fm-input-bar">
          <input type="file" ref={fileRef} accept="image/*" capture="environment" onChange={handlePhoto} hidden />
          <button
            className="fm-input-icon-btn"
            onClick={() => fileRef.current?.click()}
            title="Snap a photo for diagnosis"
            aria-label="Snap a photo for diagnosis"
            type="button"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </button>
          <textarea
            ref={inputRef}
            className="fm-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={photoPreview ? 'What do you see?' : hasQuote ? 'Ask about this quote…' : 'Ask anything…'}
            rows={1}
          />
          {!input.trim() && !photoBase64 ? (
            <button
              className={`fm-input-icon-btn fm-voice-btn${listening ? ' fm-voice-btn--active' : ''}`}
              onClick={toggleVoice}
              title={listening ? 'Stop listening' : 'Voice input'}
              type="button"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            </button>
          ) : (
            <button
              className="fm-send-btn"
              onClick={() => send()}
              disabled={loading || (!input.trim() && !photoBase64)}
              type="button"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
