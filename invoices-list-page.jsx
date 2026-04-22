import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';
import { getProfile } from '../lib/api';
import useScrollLock from '../hooks/use-scroll-lock';

/* Only show Foreman FAB on screens where it adds value */
const FOREMAN_ROUTES = ['/app', '/app/quotes'];
function shouldShowForeman(pathname) {
  if (FOREMAN_ROUTES.includes(pathname)) return true;
  // Hide on all quote builder/edit variants — Foreman is inline there
  if (pathname === '/app/quotes/new') return false;
  if (pathname.startsWith('/app/quotes/build-scope/')) return false;
  if (pathname.startsWith('/app/quotes/review/')) return false;
  if (pathname.startsWith('/app/quotes/') && pathname.endsWith('/edit')) return false;
  if (pathname.startsWith('/app/quotes/') && pathname.endsWith('/job-details')) return false;
  // Show on quote detail pages
  if (pathname.startsWith('/app/quotes/') && pathname !== '/app/quotes') return true;
  return false;
}

const STARTERS = [
  "Describe the job \u2014 I\u2019ll build the quote",
  "Describe the issue \u2014 I\u2019ll help troubleshoot",
  "Add a photo \u2014 I\u2019ll scope it with you",
];

const STORAGE_KEY = 'pl_foreman_msgs';

function loadMessages() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveMessages(msgs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-40))); } catch (e) { console.warn("[PL]", e); }
}

export default function Foreman() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  useScrollLock(open);
  const [messages, setMessages] = useState(loadMessages);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [profile, setProfile] = useState(null);
  const [photoB64, setPhotoB64] = useState(null);
  const [quoteContext, setQuoteContext] = useState(null);
  const [triggerPos, setTriggerPos] = useState({ bottom: 136, right: 16 });
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const inputRef = useRef(null);
  const dragRef = useRef(null);

  // Allow external trigger (sidebar button or quote builder)
  // Supports optional context: { prefill, starters }
  useEffect(() => {
    const orig = window.__punchlistOpenForeman;
    window.__punchlistOpenForeman = (ctx) => {
      setOpen(true);
      if (ctx?.quoteContext) {
        setQuoteContext(ctx.quoteContext);
      }
      if (ctx?.prefill && !messages.length) {
        // Auto-send the contextual prompt
        setTimeout(() => send(ctx.prefill), 300);
      }
      if (ctx?.starters) {
        window.__foremanContextStarters = ctx.starters;
      } else {
        window.__foremanContextStarters = null;
      }
    };
    return () => { window.__punchlistOpenForeman = orig; };
  }, [messages.length]);

  useEffect(() => {
    if (user) getProfile(user.id).then(setProfile).catch(e => console.warn('[PL]', e));
  }, [user]);

  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open, sending]);

  useEffect(() => {
    if (open && inputRef.current) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Persist messages
  useEffect(() => { saveMessages(messages); }, [messages]);

  // Draggable trigger
  const dragMoved = useRef(false);

  function handleDragStart(e) {
    e.preventDefault();
    dragMoved.current = false;
    const startX = e.touches ? e.touches[0].clientX : e.clientX;
    const startY = e.touches ? e.touches[0].clientY : e.clientY;
    const startRight = triggerPos.right;
    const startBottom = triggerPos.bottom;
    function move(ev) {
      const x = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const y = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const dx = startX - x;
      const dy = startY - y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) dragMoved.current = true;
      setTriggerPos({
        right: Math.max(8, Math.min(window.innerWidth - 56, startRight + dx)),
        bottom: Math.max(136, Math.min(window.innerHeight - 56, startBottom + dy)),
      });
    }
    function end() {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', end);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end);
    }
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', end);
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end);
  }

  function handleTriggerClick() {
    if (!dragMoved.current) setOpen(true);
  }

  const trade = profile?.trade || 'Other';
  const contextStarters = typeof window !== 'undefined' ? window.__foremanContextStarters : null;
  const starters = contextStarters || STARTERS;

  const send = useCallback(async (text, photo = null) => {
    if (!text?.trim() && !photo) return;
    const userMsg = { role: 'user', content: text || '', photo: photo || null, ts: Date.now() };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setPhotoB64(null);
    setSending(true);

    try {
      const r = await fetch('/api/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content, photo: m.photo || null })),
          userId: user?.id,
          trade: profile?.trade || 'Other',
          province: profile?.province || 'AB',
          country: profile?.country || 'CA',
          labourRate: Number(profile?.default_labour_rate || 0),
          quoteContext: quoteContext || null,
        }),
      });
      const data = await r.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.content || 'No response.', appLinks: data.appLinks || [], ts: Date.now() }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Try again.', ts: Date.now() }]);
    } finally {
      setSending(false);
    }
  }, [messages, user, profile, quoteContext]);

  function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoB64((reader.result.split(',')[1] || '').slice(0, 200000));
    reader.readAsDataURL(file);
  }

  function handleVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'en-US'; rec.continuous = true; rec.interimResults = true;
    rec.onresult = e => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setInput(text);
    };
    // Don't auto-send — let user review the transcription
    rec.start();
    const stop = () => { rec.stop(); document.removeEventListener('click', stop); };
    setTimeout(() => document.addEventListener('click', stop), 400);
  }

  function clearChat() {
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { console.warn("[PL]", e); }
  }

  if (!user) return null;
  const showTrigger = open || shouldShowForeman(location.pathname);

  return (
    <>
      {/* Draggable floating trigger — only on relevant screens */}
      {!open && showTrigger && (
        <button
          type="button"
          className="fm-trigger"
          style={{ bottom: triggerPos.bottom, right: triggerPos.right }}
          onClick={handleTriggerClick}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          ref={dragRef}
          aria-label="Open Foreman"
        >
          <span className="fm-trigger-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z"/></svg></span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fm-overlay" onClick={() => setOpen(false)}>
          <div className="fm-panel" onClick={e => e.stopPropagation()} role="dialog" aria-label="Foreman assistant" aria-modal="true">
            {/* Header */}
            <div className="fm-header">
              <div className="fm-header-left">
                <span className="fm-header-title">Foreman</span>
                <span className="fm-header-sub">Your trades assistant</span>
              </div>
              <div className="fm-header-actions">
                {messages.length > 0 && <button type="button" className="fm-header-btn" onClick={clearChat} title="New conversation" aria-label="New conversation">↺</button>}
                <button type="button" className="fm-header-btn" onClick={() => setOpen(false)} aria-label="Close Foreman">×</button>
              </div>
            </div>

            {/* Messages */}
            <div className="fm-messages" ref={scrollRef}>
              {messages.length === 0 && (
                <div className="fm-welcome">
                  <div className="fm-welcome-title">What can I help with?</div>
                  <div className="fm-starters">
                    {starters.map((s, i) => (
                      <button type="button" key={i} className="fm-starter" onClick={() => send(s)}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`fm-msg fm-msg-${msg.role}`}>
                  {msg.photo && <div className="fm-msg-photo">Photo attached</div>}
                  <div className="fm-msg-text">{msg.content}</div>
                  {msg.appLinks?.length > 0 && (
                    <div className="fm-msg-links">
                      {msg.appLinks.map((link, j) => {
                        const label = link.includes('/quotes/') && link.includes('/edit') ? 'Edit quote'
                          : link.includes('/quotes/new') ? 'Start new quote'
                          : link.includes('/quotes/') ? 'View quote'
                          : link.includes('/bookings') ? 'View schedule'
                          : link.includes('/contacts') ? 'View contacts'
                          : link.includes('/settings') ? 'Open settings'
                          : 'Open in app';
                        return <Link key={j} to={link} className="fm-msg-link" onClick={() => setOpen(false)}>{label} →</Link>;
                      })}
                    </div>
                  )}
                </div>
              ))}
              {sending && (
                <div className="fm-msg fm-msg-assistant">
                  <div className="fm-typing"><span /><span /><span /></div>
                </div>
              )}
            </div>

            {/* Photo preview */}
            {photoB64 && (
              <div className="fm-photo-preview">
                Photo ready
                <button type="button" onClick={() => setPhotoB64(null)} className="fm-photo-remove" aria-label="Remove photo">×</button>
              </div>
            )}

            {/* Input */}
            <div className="fm-input-bar">
              <button className="fm-input-btn" type="button" onClick={() => fileRef.current?.click()} aria-label="Attach photo"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></button>
              <input hidden ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} />
              <button className="fm-input-btn" type="button" onClick={handleVoice} aria-label="Voice input"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg></button>
              <input
                ref={inputRef}
                className="fm-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input, photoB64); } }}
                placeholder="Ask anything…"
                disabled={sending}
              />
              <button className="fm-send" type="button" disabled={sending || (!input.trim() && !photoB64)} onClick={() => send(input, photoB64)} aria-label="Send message">↑</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
