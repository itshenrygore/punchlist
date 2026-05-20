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
        send: `What line items do contractors typically forget on a ${tradeWord} job like this? Be specific with item names and a fair price range.` },
      { key: 'upsell',  label: 'Smart upsells',
        send: `Based on this scope, what 2-3 optional upsells should I offer the customer? Pick add-ons they're likely to say yes to and explain why each one matters.` },
      { key: 'pricing', label: 'Check my pricing',
        send: 'Walk through my line items and tell me which prices look low, high, or right for my province. Use catalog ranges, not gut feel.' },
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
  return [
    { key: 'today',    label: 'What should I focus on today?',
      send: 'What should I focus on today? Check my pipeline and follow-ups.' },
    { key: 'pricing',  label: 'Look up a price',
      send: '' },
    { key: 'scope',    label: 'Help me scope a job',
      send: '' },
    { key: 'followup', label: 'Who needs a follow-up?',
      send: 'Which quotes need follow-up right now?' },
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
  if (text.includes('price') || text.includes('$'))
    chips.push({ label: 'Compare to my area', send: 'How do these prices compare to my area specifically?' });

  return chips.slice(0, 3);
}

/* ─── Parse pricing items from AI response for "Add to quote" ─── */
function parseAddToQuote(text) {
  const items = [];
  const rx = /(?:^|\n)\s*[-•]\s*(.+?):\s*\$?([\d,]+)\s*[–-]\s*\$?([\d,]+)/g;
  let m;
  while ((m = rx.exec(text)) !== null) {
    const lo = Number(m[2].replace(/,/g, ''));
    const hi = Number(m[3].replace(/,/g, ''));
    const mid = Math.round(lo + (hi - lo) * 0.55);
    items.push({ name: m[1].trim(), unit_price: mid, lo, hi });
  }
  return items;
}

/* ─── Message bubble ─── */
function MessageBubble({ msg, onNavigate, onAddItem, addedItems }) {
  const isUser = msg.role === 'user';
  const items = !isUser ? parseAddToQuote(msg.content || '') : [];

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
export default function ForemanPanel({ open, onClose, quoteContext, onAddItemToQuote }) {
  const { user } = useAuth();
  const { show: toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [addedItems, setAddedItems] = useState(new Set());
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
    supabase.from('profiles').select('trade, province, country, default_labour_rate, company_name, full_name')
      .eq('id', user.id).single().then(({ data }) => { if (data) profile.current = data; });
  }, [user]);

  // ── Focus input on open ──
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

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

    const userMsg = { role: 'user', content: msg, photo: photoPreview || null };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const apiMessages = [...messages.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: msg, photo: photoBase64 || undefined }]
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-20);

    const p = profile.current || {};
    const body = {
      messages: apiMessages,
      userId: user?.id,
      trade: quoteContext?.trade || p.trade || 'Other',
      province: quoteContext?.province || p.province || 'ON',
      country: p.country || 'CA',
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
        const placeholder = { role: 'assistant', content: '', appLinks: [] };
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
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Connection error — try again in a sec.',
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, photoBase64, photoPreview, loading, user, quoteContext]);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function handleNavigate(path) { navigate(path); onClose(); }

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
              <p className="fm-empty-body">
                {hasQuote
                  ? 'I can see your quote. Tap below or just ask.'
                  : 'Pricing, scoping, schedule, follow-ups — tap or type.'}
              </p>

              {/* First-time intro — explains what Foreman does in three
                  short lines. Hidden after the user dismisses it, or
                  permanently after the user actually sends a message. */}
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
                  <p className="fm-intro-lead">A few things I'm good at:</p>
                  <ul className="fm-intro-list">
                    <li><span className="fm-intro-dot" /> Reviewing your scope before you send — flag missing items, check pricing for your province</li>
                    <li><span className="fm-intro-dot" /> Drafting customer follow-ups when a quote stalls</li>
                    <li><span className="fm-intro-dot" /> Looking up prices or helping you diagnose what you're seeing in the field</li>
                  </ul>
                  <p className="fm-intro-tail">Tap a prompt below or just type a question.</p>
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

          {/* Chat messages */}
          {messages.map((msg, i) => (
            <MessageBubble
              key={i}
              msg={msg}
              onNavigate={handleNavigate}
              onAddItem={onAddItemToQuote ? handleAddItem : null}
              addedItems={addedItems}
            />
          ))}

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
            title="Attach photo"
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
