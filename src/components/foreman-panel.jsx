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

/* ─── Contextual quick actions based on current page ─── */
function getQuickActions(pathname, quoteContext) {
  if (quoteContext) {
    const trade = quoteContext.trade?.toLowerCase() || 'this';
    return [
      { key: 'missing',  label: "What's missing?",        send: `What items am I missing from this ${trade} quote?` },
      { key: 'pricing',  label: 'Check my pricing',       send: 'Are my prices reasonable for this scope? Flag anything too high or too low.' },
      { key: 'scope',    label: 'Scope check',            send: 'Do a quick scope review — anything I should add, remove, or clarify?' },
      { key: 'upsell',   label: 'Smart upsells',          send: 'What optional add-ons could I offer the customer to increase this quote value?' },
    ];
  }
  if (pathname === '/app' || pathname === '/app/') {
    return [
      { key: 'today',    label: 'What should I do today?', send: 'What should I focus on today? Check my pipeline and schedule.' },
      { key: 'followup', label: 'Who needs a follow-up?',  send: 'Which quotes need follow-up? Show me the most urgent ones.' },
      { key: 'schedule', label: 'My schedule',             send: 'Show me my schedule for this week.' },
      { key: 'revenue',  label: 'How am I doing?',         send: 'Give me a quick business snapshot — close rate, pipeline, revenue.' },
    ];
  }
  if (pathname.startsWith('/app/quotes')) {
    return [
      { key: 'new',      label: 'Start a new quote',       send: 'Help me start a new quote.' },
      { key: 'followup', label: 'Who needs follow-up?',    send: 'Which of my sent quotes need follow-up?' },
      { key: 'pricing',  label: 'Look up pricing',         send: '' },
      { key: 'tips',     label: 'Closing tips',            send: 'Give me 2-3 tips to improve my close rate based on my recent quotes.' },
    ];
  }
  if (pathname.startsWith('/app/customers')) {
    return [
      { key: 'search',   label: 'Find a customer',         send: '' },
      { key: 'history',  label: 'Customer history',         send: '' },
    ];
  }
  return [
    { key: 'today',    label: 'What should I do today?', send: 'What should I focus on today?' },
    { key: 'pricing',  label: 'Look up pricing',         send: '' },
    { key: 'schedule', label: 'My schedule',             send: 'Show me my schedule for this week.' },
    { key: 'new',      label: 'Start a quote',           send: 'Help me start a new quote.' },
  ];
}

/* ─── Follow-up suggestions after an AI response ─── */
function getFollowUps(lastMsg, quoteContext) {
  if (!lastMsg || lastMsg.role !== 'assistant') return [];
  const text = (lastMsg.content || '').toLowerCase();
  const chips = [];

  if (text.includes('want me to quote') || text.includes('want me to scope'))
    chips.push({ label: 'Yes, scope it', send: 'Yes, scope it out.' });
  if (text.includes('schedule') || text.includes('scheduled'))
    chips.push({ label: 'Show full week', send: 'Show me the full week schedule.' });
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
      {!isUser && <div className="fm-msg-avatar">F</div>}
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
      <div className="fm-msg-avatar">F</div>
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
  function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast('Photo too large (max 10MB)', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result);
      setPhotoBase64(reader.result.split(',')[1]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
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

    const apiMessages = [...messages, { role: 'user', content: msg, photo: photoBase64 || undefined }]
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
      const resp = await fetch('/api/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.content || 'No response.',
        appLinks: data.appLinks || [],
      }]);
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
      <div className="fm-panel" role="dialog" aria-label="Foreman AI assistant">

        {/* ── Header ── */}
        <div className="fm-header">
          <div className="fm-header-left">
            <div className="fm-logo">F</div>
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
              <div className="fm-empty-logo">F</div>
              <h3 className="fm-empty-title">
                {greetName ? `Hey ${greetName}` : 'Hey'} — what are we working on?
              </h3>
              <p className="fm-empty-body">
                {hasQuote
                  ? 'I can see your quote. Tap below or just ask.'
                  : 'Pricing, scoping, schedule, follow-ups — tap or type.'}
              </p>

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
