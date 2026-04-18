import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { currency as formatCurrency, formatDate, formatQuoteNumber } from '../lib/format';
import { estimateMonthly, showFinancing } from '../lib/financing';
import { getCustomerActions } from '../lib/workflow';
import { MessageSquare, Pencil, Link2, Phone } from 'lucide-react';
import ConvAvatar from './conv-avatar';
import PublicPageShell from './public-page-shell';
import SignatureModal from './signature-modal';
import { Card, Stat, RevealOnView, TermsBody, CopyChip } from './ui';
import useScrollLock from '../hooks/use-scroll-lock';

/*
 * PublicQuoteView — shared quote view + interaction logic.
 * Consumed by:
 *   - pages/public-quote-page.jsx   (mode="standalone")
 *   - pages/project-portal-page.jsx QuoteTab  (mode="portal-tab")
 *
 * Props:
 *   quote          already-fetched quote object
 *   shareToken     public share token string
 *   isPreview      bool — disables actions in preview mode
 *   onQuoteUpdate  fn(updatedQuote) — called when quote state changes
 *   onSwitchTab    fn(tabId) — portal-only: switch portal tabs
 *   mode           "standalone" | "portal-tab"
 */

/* ── Optional Item Toggle ── */
function OptionalItemRow({ item, selected, onToggle, currency }) {
  const price = Number(item.quantity || 1) * Number(item.unit_price || 0);
  return (
    <div className={`pq-optional-item pl-opt-row ${selected ? 'pq-optional-item--on' : ''}`}>
      <div style={{ flexShrink: 0 }}>
        <button type="button" onClick={() => onToggle(item.id)} className={`pq-toggle ${selected ? 'pq-toggle--on' : ''}`} aria-label={selected ? 'Remove this add-on' : 'Add this add-on'}>
          <span className="pq-toggle-knob" />
        </button>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="doc-item-name" style={{ color: selected ? 'var(--doc-text)' : 'var(--doc-muted)' }}>{item.name}</div>
        {item.notes && <div className="doc-item-note">{item.notes}</div>}
        {Number(item.quantity) > 1 && <div className="doc-item-qty">{item.quantity} × {currency(item.unit_price)}</div>}
      </div>
      <div style={{ minWidth: 70, textAlign: 'right', fontWeight: 700, fontSize: 'var(--text-md)' }}>
        {selected ? <span style={{ color: 'var(--doc-accent, var(--brand))' }}>+{currency(price)}</span> : <span style={{ color: 'var(--doc-muted)' }}>{currency(price)}</span>}
      </div>
    </div>
  );
}

/* ── Conversation Thread ── */
function ConversationThread({ thread, threadRef }) {
  if (!thread || thread.length === 0) return null;
  return (
    <div className="pq-conversation" ref={threadRef}>
      <div className="pq-conversation-header"><MessageSquare size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Questions &amp; Replies</div>
      <div className="pq-conversation-body">
        {thread.map(entry => (
          <div key={entry.id} className={`pq-msg ${entry.role === 'contractor' ? 'pq-msg--right' : ''}`}>
            <div className={`pq-msg-avatar ${entry.role === 'contractor' ? 'pq-msg-avatar--contractor' : ''}`}>
              <ConvAvatar role={entry.role} name={entry.name} logoUrl={entry.contractor_logo} size={32} />
            </div>
            <div style={{ maxWidth: '78%' }}>
              <div className="pq-msg-meta" style={{ textAlign: entry.role === 'contractor' ? 'right' : 'left' }}>
                <strong>{entry.name || (entry.role === 'customer' ? 'You' : 'Contractor')}</strong>
                {' · '}{new Date(entry.timestamp).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className={`pq-msg-bubble ${entry.role === 'contractor' ? 'pq-msg-bubble--contractor' : ''}`}>
                {entry.text}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Bottom Sheet ── */
// §6.2 — Change categories for structured amendment_request
const CHANGE_CATEGORIES = ['Scope', 'Pricing', 'Timeline', 'Materials', 'Other'];

function ActionSheet({ type, onSubmit, onClose, sending }) {
  const [text, setText] = useState('');
  const [kbOpen, setKbOpen] = useState(false);
  // §6.2 — structured amendment_request: selected category chips
  const [selectedCategories, setSelectedCategories] = useState([]);
  const textareaRef = useRef(null);
  const overlayRef = useRef(null);
  const config = {
    question: { title: 'Ask a question', placeholder: 'What would you like to know about this quote?', button: 'Send question', Icon: MessageSquare },
    changes: { title: 'Request changes', placeholder: 'A couple of lines is plenty — pricing, materials, scope, whatever\u2019s on your mind.', button: 'Send request', Icon: Pencil },
    decline: { title: 'Decline this quote', placeholder: 'What would make this work? (optional — helps your contractor adjust)', button: 'Confirm decline', Icon: null },
  };
  const c = config[type] || config.question;
  const required = type !== 'decline';

  function toggleCategory(cat) {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  }

  // Delayed focus to let the sheet animate in first
  useEffect(() => {
    const t = setTimeout(() => textareaRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  // Detect keyboard via visualViewport
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function onResize() {
      const isKb = vv.height < window.innerHeight * 0.75;
      setKbOpen(isKb);
    }
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className={`pq-sheet-overlay${kbOpen ? ' keyboard-open' : ''}`} ref={overlayRef} onClick={onClose}>
      <div className="pq-sheet" onClick={e => e.stopPropagation()}>
        <div className="pq-sheet-handle" />
        <div className="pq-sheet-header">
          {c.Icon && <c.Icon size={20} style={{ flexShrink: 0 }} />}
          <h3 className="font-display" style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 700, letterSpacing: '-.02em' }}>{c.title}</h3>
        </div>
        {/* §6.2 — Category chips for structured amendment_request */}
        {type === 'changes' && (
          <div className="pq-changes-categories" role="group" aria-label="What needs to change?">
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--doc-muted)', width: '100%', marginBottom: 4 }}>What needs to change?</div>
            {CHANGE_CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                className={`pq-changes-chip${selectedCategories.includes(cat) ? ' pq-changes-chip--active' : ''}`}
                onClick={() => toggleCategory(cat)}
                aria-pressed={selectedCategories.includes(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
        <textarea ref={textareaRef} className="pq-sheet-textarea" value={text} onChange={e => setText(e.target.value)} placeholder={c.placeholder} rows={4} />
        <div className="pq-sheet-footer">
          <button type="button" className="doc-cta-secondary" onClick={onClose} style={{ flex: 0, padding: '12px 20px' }}>Cancel</button>
          <button type="button" className={`doc-cta-primary ${type === 'decline' ? 'pq-btn-danger' : ''}`} style={{ flex: 1 }}
            disabled={sending || (required && !text.trim())}
            onClick={() => onSubmit(text.trim(), selectedCategories)}>
            {sending ? 'Sending…' : c.button}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PublicQuoteView({
  quote: initialQuote,
  shareToken,
  isPreview = false,
  onQuoteUpdate,
  onSwitchTab,
  mode = 'standalone',
}) {
  // Internal quote state — synced from parent on mount
  // setQuote patched to also call onQuoteUpdate
  const [_quote, _setQuoteRaw] = useState(initialQuote);
  const quote = _quote || initialQuote;
  function _setQuote(updater) {
    _setQuoteRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (onQuoteUpdate) onQuoteUpdate(next);
      return next;
    });
  }
  const [searchParams] = useSearchParams();
  const currency = (n) => formatCurrency(n, quote?.country);
  const [activeSheet, setActiveSheet] = useState(null);
  const [showSignature, setShowSignature] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [actionDone, setActionDone] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const optStorageKey = `pl_optionals_${shareToken}`;
  const [selectedOptionals, setSelectedOptionals] = useState(() => {
    try {
      const saved = sessionStorage.getItem(`pl_optionals_${shareToken}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [payLoading, setPayLoading] = useState(false);
  const [depositConfirming, setDepositConfirming] = useState(false);
  const [depositTimedOut, setDepositTimedOut] = useState(false);

  async function handleConnectPay() {
    setPayLoading(true);
    try {
      const r = await fetch('/api/create-payment-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'deposit',
          quoteId: quote.id,
          shareToken: quote.share_token,
        }),
      });
      const data = await r.json();
      if (data.url) window.location.href = data.url;
      else setError('Couldn\u2019t start payment. Try again, or contact your contractor.');
    } catch { setError('Couldn\u2019t reach the payment processor. Try again in a moment.'); }
    finally { setPayLoading(false); }
  }

  // Lock body scroll when overlay is open (prevents iOS background scroll)\n  useScrollLock(Boolean(activeSheet));\n\n  // Refs for scroll targets\n  const topRef = useRef(null);\n  const signRef = useRef(null);\n  const threadRef = useRef(null);\n  const termsRef = useRef(null);\n  const readFiredRef = useRef(false);\n\n  // §5.2 — Mark messages as read when thread scrolls into view\n  useEffect(() => {\n    if (!shareToken || !threadRef.current || readFiredRef.current) return;\n    const el = threadRef.current;\n    const observer = new IntersectionObserver(\n      (entries) => {\n        if (entries[0]?.isIntersecting && !readFiredRef.current) {\n          readFiredRef.current = true;\n          fetch('/api/mark-messages-read', {\n            method: 'POST',\n            headers: { 'Content-Type': 'application/json' },\n            body: JSON.stringify({ token: shareToken }),\n          }).catch(e => console.warn('[PL]', e));\n          observer.disconnect();\n        }\n      },\n      { threshold: 0.3 }\n    );\n    observer.observe(el);\n    return () => observer.disconnect();\n  }, [shareToken, quote?.id]);

  // Note: data fetching is handled by the parent page.

  useEffect(() => {
    if (!quote) return;
    const contractor = quote.contractor_company || quote.contractor_name || 'Punchlist';
    document.title = `${quote.title || 'Quote'} — ${contractor}`;
    return () => { document.title = 'Punchlist'; };
  }, [quote?.id, quote?.title]);

  // ── Deposit polling: after Stripe checkout redirect, poll until webhook updates status ──
  useEffect(() => {
    if (!quote || searchParams.get('deposit') !== 'success') return;
    if (quote.deposit_status === 'paid') return; // Already confirmed
    setDepositConfirming(true);
    let attempts = 0;
    const maxAttempts = 10; // 10 x 3s = 30s max
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        setDepositConfirming(false);
        setDepositTimedOut(true);
        return;
      }
      try {
        const r = await fetch(`/api/public-quote?token=${shareToken}`);
        if (!r.ok) return;
        const j = await r.json();
        if (j.quote?.deposit_status === 'paid') {
          _setQuote(prev => ({ ...prev, deposit_status: 'paid', status: j.quote.status || prev.status }));
          clearInterval(interval);
          setDepositConfirming(false);
        }
      } catch (e) { console.warn("[PL]", e); }
    }, 3000);
    return () => clearInterval(interval);
  }, [quote?.id, searchParams.get('deposit')]);

  const isExpired = useMemo(() => quote?.expires_at && new Date(quote.expires_at) < new Date() &&
    !['approved','approved_pending_deposit','scheduled','completed'].includes(quote?.status), [quote]);

  const optionalItems = useMemo(() => (quote?.line_items || []).filter(i => i.included === false || i.item_type === 'optional'), [quote]);
  const includedItems = useMemo(() => (quote?.line_items || []).filter(i => i.included !== false && i.item_type !== 'optional'), [quote]);

  const selectedOptionalsTotal = useMemo(() =>
    optionalItems.filter(i => selectedOptionals.has(i.id)).reduce((sum, i) => sum + (Number(i.quantity || 1) * Number(i.unit_price || 0)), 0),
  [optionalItems, selectedOptionals]);

  // Derive tax rate from quote totals so optional add-ons display with tax
  const effectiveTaxRate = useMemo(() => {
    const sub = Number(quote?.subtotal || 0) - Number(quote?.discount || 0);
    const tax = Number(quote?.tax || 0);
    return sub > 0 && tax > 0 ? tax / sub : 0;
  }, [quote]);

  function toggleOptional(id) {
    setSelectedOptionals(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      try { sessionStorage.setItem(optStorageKey, JSON.stringify([...n])); } catch (e) { console.warn("[PL]", e); }
      return n;
    });
    // Flash the total row to give price feedback
    try {
      const el = document.querySelector('.doc-total-row--grand');
      if (el) { el.classList.remove('total-flash'); void el.offsetWidth; el.classList.add('total-flash'); }
    } catch (e) { console.warn('[PL]', e); }
  }

  const optionalsTaxed = selectedOptionalsTotal * (1 + effectiveTaxRate);
  const adjustedTotal = (Number(quote?.total) || 0) + optionalsTaxed;
  const displayTotal = selectedOptionalsTotal > 0 ? adjustedTotal : Number(quote?.total || 0);

  // FIX #6, #16: Scroll to signature pad when it opens
  function openSignature() {
    setShowSignature(true);
    // Wait for React render + paint before scrolling
    requestAnimationFrame(() => {
      setTimeout(() => signRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    });
  }

  async function submitSignature(sigData) {
    setSending(true); setError('');
    try {
      const r = await fetch('/api/public-quote-action', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: shareToken, status: 'approved', ...sigData, selected_optional_ids: Array.from(selectedOptionals) }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed');
      _setQuote(prev => ({ ...prev, status: data.status || 'approved', deposit_status: data.deposit_status || prev.deposit_status, signed_at: new Date().toISOString(), signature_data: sigData.signature_data, signer_name: sigData.signer_name }));
      setShowSignature(false); setActionDone('approved');
      try { sessionStorage.removeItem(optStorageKey); } catch (e) { console.warn("[PL]", e); }
      // FIX #13: Scroll to top so customer sees the success banner
      setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    } catch (e) { setError(e.message || 'Could not submit'); } finally { setSending(false); }
  }

  async function handleSheetSubmit(text, categories = []) {
    setSending(true); setError('');
    try {
      const type = activeSheet;
      let body;
      if (type === 'question') body = { token: shareToken, action: 'question', question: text };
      else if (type === 'changes') {
        // §6.2 — structured amendment_request: includes categories for contractor triage
        body = {
          token: shareToken,
          status: 'revision_requested',
          feedback: text,
          amendment_request: {
            feedback: text,
            categories: categories.length > 0 ? categories : ['Other'],
            submitted_at: new Date().toISOString(),
          },
        };
      }
      else if (type === 'decline') body = { token: shareToken, status: 'declined', feedback: text };

      const r = await fetch('/api/public-quote-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed');

      if (type === 'question' && data.conversation) _setQuote(prev => ({ ...prev, conversation: data.conversation, status: data.status || prev.status }));
      if (type === 'changes') _setQuote(prev => ({ ...prev, status: 'revision_requested' }));
      if (type === 'decline') _setQuote(prev => ({ ...prev, status: 'declined' }));

      setActiveSheet(null);
      setActionDone(type === 'changes' ? 'revision_requested' : type);

      // FIX #13, #14: Scroll to relevant place after action
      // Use double-rAF to ensure React has committed the state update and the DOM has painted
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (type === 'question') {
            // Scroll to conversation thread — may be newly rendered if first question
            threadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          } else {
            // Scroll to top for decline/revision (banner is at top)
            topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        });
      });
    } catch (e) { setError(e.message || 'Could not submit'); } finally { setSending(false); }
  }

  function downloadSignedPdf() {
    const url = `/api/export-pdf?token=${shareToken}`;
    const a = document.createElement('a'); a.href = url;
    a.download = `${(quote?.title || 'quote').replace(/[^a-z0-9]/gi, '-').toLowerCase()}-signed.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  const groupedItems = useMemo(() => {
    const groups = {};
    includedItems.forEach(item => { const key = item.category || 'Scope'; groups[key] = groups[key] || []; groups[key].push(item); });
    return groups;
  }, [includedItems]);

  const effectivePaymentMethods = useMemo(() => {
    if (!quote) return [];
    const base = Array.isArray(quote.payment_methods) ? [...quote.payment_methods] : [];
    if (quote.contractor_stripe_link && !base.some(m => /credit|debit|card|stripe/i.test(m))) base.unshift('Credit/Debit Card');
    return base;
  }, [quote]);


  if (error && !quote) return (
    <PublicErrorState
      docType="quote"
      contractorName={null}
      onRetry={() => window.location.reload()}
    />
  );

  if (!quote) return null;

  const depositSuccess = searchParams.get('deposit') === 'success';
  const { canAct: _canAct, canSign: _canSign, showDepositButton, isClosedOut } = isPreview
    ? { canAct: false, canSign: false, showDepositButton: false, isClosedOut: false }
    : getCustomerActions(quote);
  const canAct = _canAct;
  const isSigned = Boolean(quote.signed_at);
  const isApproved = ['approved','approved_pending_deposit'].includes(quote.status);
  const waitingOnDeposit = quote.deposit_required && quote.deposit_status !== 'paid';
  const isDeclined = quote.status === 'declined';
  const isRevisionRequested = quote.status === 'revision_requested';
  const isCompleted = quote.status === 'completed';
  const isScheduled = quote.status === 'scheduled';
  const daysValid = quote.expires_at ? Math.max(0, Math.ceil((new Date(quote.expires_at) - new Date()) / 86400000)) : null;
  const discount = Number(quote.discount || 0);
  const hasDiscount = discount > 0;
  const hasTerms = Boolean(quote.terms_conditions?.trim());
  const conversation = Array.isArray(quote.conversation) ? quote.conversation : [];
  const canSign = _canSign && !isRevisionRequested && (!hasTerms || termsAccepted);
  const contractorDisplayName = quote.contractor_company || quote.contractor_name || 'your contractor';

  const groupOrder = ['Labour', 'Materials', 'Services'];
  const sortedGroupKeys = Object.keys(groupedItems).sort((a, b) => {
    const ai = groupOrder.indexOf(a); const bi = groupOrder.indexOf(b);
    if (ai >= 0 && bi >= 0) return ai - bi; if (ai >= 0) return -1; if (bi >= 0) return 1;
    return a.localeCompare(b);
  });
  const showGroupHeaders = sortedGroupKeys.length > 1;

  const _inner = (
    <div className="doc-shell">
      <div className="doc-container">
        {/* FIX #13: scroll target for success banners */}
        <div ref={topRef} />

        <div className="doc-card">

          {/* Preview banner */}
          {isPreview && (
            <div className="pq-preview-banner">
              <span style={{ display:"inline-flex", color:"var(--doc-muted)" }}><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></span>
              <div style={{ flex: 1 }}><strong>Preview mode</strong> — this is what your customer will see. Actions are disabled.</div>
              <button type="button" onClick={() => window.close()} style={{ background: 'none', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '6px 14px', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', color: 'var(--doc-text)', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>✕ Close preview</button>
            </div>
          )}

          {/* Header */}
          <div className="doc-header">
            <div className="doc-brand">
              {quote.contractor_logo && <img src={quote.contractor_logo} alt="" className="doc-logo" />}
              <div className="doc-company">{contractorDisplayName}</div>
              {quote.contractor_name && quote.contractor_name !== quote.contractor_company && <div className="doc-contractor-name">{quote.contractor_name}</div>}
              <div className="doc-contact">
                {quote.contractor_phone && <a href={`tel:${quote.contractor_phone}`}>{quote.contractor_phone}</a>}
                {quote.contractor_email && <a href={`mailto:${quote.contractor_email}`}>{quote.contractor_email}</a>}
              </div>
            </div>
            <div className="doc-meta">
              <div className="doc-type">Proposal{quote.quote_number ? ` ${formatQuoteNumber(quote.quote_number)}` : ''}</div>
              <div className="doc-date">{formatDate(quote.created_at)}</div>
              {(quote.revision_number || 1) > 1 && <div className="doc-number">Revision {quote.revision_number}</div>}
            </div>
          </div>

          {/* ── Status banners ── */}
          {isExpired && <div className="doc-status doc-status--warning"><span className="doc-status-icon">⏰</span><span>This quote has expired. Contact {contractorDisplayName} for an updated quote.</span></div>}

          {/* Persistent approved state — shows on refresh when quote is already signed */}
          {isApproved && !actionDone && (
            <div className="pq-success-banner">
              <div className="pq-success-check">✓</div>
              <div>
                <strong style={{ display: 'block', fontSize: 'var(--text-xl)' }}>Quote approved</strong>
                <span style={{ fontSize: 'var(--text-sm)', opacity: .85, display: 'block', marginTop: 4, lineHeight: 1.6 }}>
                  Signed{quote.signer_name ? ` by ${quote.signer_name}` : ''}{quote.signed_at ? ` on ${formatDate(quote.signed_at)}` : ''}.
                  {waitingOnDeposit ? ` A deposit of ${currency(quote.deposit_amount)} is required to get started.` : ` ${contractorDisplayName} will be in touch to schedule.`}
                </span>
              </div>
            </div>
          )}

          {actionDone === 'approved' && (
            <div className="pq-success-banner">
              <div className="pq-success-check">✓</div>
              <div>
                <strong style={{ display: 'block', fontSize: 'var(--text-xl)' }}>You're all set — quote approved</strong>
                <span style={{ fontSize: 'var(--text-sm)', opacity: .85, display: 'block', marginTop: 4, lineHeight: 1.6 }}>
                  {contractorDisplayName} has been notified and will reach out shortly to confirm scheduling.
                  {quote.deposit_required && quote.deposit_status !== 'paid' ? ' A deposit is required to get started — see below.' : ''}
                </span>
                {/* Clear next steps so customer knows exactly what happens */}
                <div className="pq-next-steps" style={{ marginTop: 12 }}>
                  <div className="pq-next-step pq-next-step--done">
                    <span className="pq-next-step-num">✓</span>
                    <span className="pq-next-step-text">Quote approved — {contractorDisplayName} has been notified</span>
                  </div>
                  {quote.deposit_required && quote.deposit_status !== 'paid' && (
                    <div className="pq-next-step pq-next-step--active">
                      <span className="pq-next-step-num">2</span>
                      <span className="pq-next-step-text">Pay the {currency(quote.deposit_amount)} deposit to confirm your booking</span>
                    </div>
                  )}
                  <div className="pq-next-step">
                    <span className="pq-next-step-num">{quote.deposit_required && quote.deposit_status !== 'paid' ? '3' : '2'}</span>
                    <span className="pq-next-step-text">{contractorDisplayName} will contact you to schedule</span>
                  </div>
                  <div className="pq-next-step">
                    <span className="pq-next-step-num">{quote.deposit_required && quote.deposit_status !== 'paid' ? '4' : '3'}</span>
                    <span className="pq-next-step-text">Work begins — you'll receive an invoice when complete</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, fontSize: 'var(--text-xs)', color: 'var(--doc-muted)' }}>
                  <span>✓ Signed {quote.signer_name ? `by ${quote.signer_name}` : ''}</span>
                  <span>✓ {contractorDisplayName} notified</span>
                  {!quote.deposit_required && <span>✓ No payment required now</span>}
                </div>
              </div>
            </div>
          )}
          {actionDone === 'question' && (
            <div className="pq-success-banner pq-success-banner--blue">
              <div className="pq-success-check" style={{ background: 'var(--doc-blue-soft)', color: 'var(--doc-blue)' }}><MessageSquare size={16} /></div>
              <div>
                <strong style={{ display: 'block' }}>Question sent</strong>
                <span style={{ fontSize: 'var(--text-sm)', opacity: .85, display: 'block', marginTop: 2 }}>
                  {contractorDisplayName} has been notified and will reply directly.
                </span>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 'var(--text-xs)', opacity: .75 }}>
                  <span>✓ Email notification sent</span>
                  <span>✓ Your reply will appear below</span>
                </div>
                {(quote.contractor_phone || quote.contractor_email) && (
                  <div style={{ marginTop: 8, fontSize: 'var(--text-xs)', opacity: .8 }}>
                    Need a faster response?{' '}
                    {quote.contractor_phone && <a href={`tel:${quote.contractor_phone}`} style={{ color: 'var(--doc-blue)', fontWeight: 600 }}>Call</a>}
                    {quote.contractor_phone && <>{' or '}<a href={`sms:${quote.contractor_phone}`} style={{ color: 'var(--doc-blue)', fontWeight: 600 }}>text {quote.contractor_phone}</a></>}
                  </div>
                )}
              </div>
            </div>
          )}
          {actionDone === 'revision_requested' && (
            <div className="pq-success-banner pq-success-banner--amber">
              <div className="pq-success-check" style={{ background: 'var(--amber-bg, #fef3c7)', color: 'var(--amber-text, #92400e)' }}><Pencil size={16} /></div>
              <div>
                <strong style={{ display: 'block' }}>Changes requested</strong>
                <span style={{ fontSize: 'var(--text-sm)', opacity: .85, display: 'block', marginTop: 2 }}>{contractorDisplayName} will revise the quote and send you an updated version.</span>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 'var(--text-xs)', opacity: .75 }}>
                  <span>✓ {contractorDisplayName} notified</span>
                  <span>✓ You'll receive an updated quote by email</span>
                </div>
              </div>
            </div>
          )}
          {actionDone === 'decline' && (
            <div className="pq-success-banner pq-success-banner--muted">
              <div className="pq-success-check" style={{ background: 'var(--panel-2)', color: 'var(--muted)' }}>✕</div>
              <div><strong style={{ display: 'block' }}>Quote declined</strong><span style={{ fontSize: 'var(--text-sm)', opacity: .85 }}>{contractorDisplayName} has been notified.</span></div>
            </div>
          )}
          {actionDone === 'decline' && !isPreview && (
            <div style={{ padding: '0 28px 8px', textAlign: 'center' }}>
              <button className="pq-btn-secondary" type="button" style={{ width: '100%' }} onClick={() => setActiveSheet('question')}>
                <MessageSquare size={14} style={{verticalAlign:'middle',marginRight:6}}/>Changed your mind? Message {contractorDisplayName}
              </button>
            </div>
          )}

          {!actionDone && isSigned && <div className="doc-status doc-status--approved"><span className="doc-status-icon">✓</span><span>Signed and approved{quote.signer_name ? ` by ${quote.signer_name}` : ''}{quote.signed_at ? ` · ${formatDate(quote.signed_at)}` : ''}</span></div>}
          {!actionDone && isApproved && !isSigned && <div className="doc-status doc-status--approved"><span className="doc-status-icon">✓</span><span>Quote approved{waitingOnDeposit ? ' — deposit required to proceed' : ''}</span></div>}
          {!actionDone && isRevisionRequested && <div className="doc-status doc-status--info"><span className="doc-status-icon" style={{display:"inline-flex"}}><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span><span>Changes requested — {contractorDisplayName} will send an update</span></div>}
          {!actionDone && isDeclined && <div className="doc-status doc-status--warning"><span className="doc-status-icon">✗</span><span>Quote declined</span></div>}
          {!actionDone && isDeclined && !isPreview && (
            <div style={{ padding: '0 28px 8px', textAlign: 'center' }}>
              <button className="pq-btn-secondary" type="button" style={{ width: '100%' }} onClick={() => setActiveSheet('question')}>
                <MessageSquare size={14} style={{verticalAlign:'middle',marginRight:6}}/>Changed your mind? Message {contractorDisplayName}
              </button>
            </div>
          )}
          {!actionDone && isClosedOut && !isSigned && <div className="doc-status doc-status--approved"><span className="doc-status-icon">✓</span><span>This job has been completed.</span></div>}
          {depositSuccess && (
            <div className="doc-status doc-status--approved" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="doc-status-icon">✓</span>
                <span style={{ fontWeight: 700 }}>Deposit received — you're all set.</span>
              </div>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--doc-muted)', lineHeight: 1.5, paddingLeft: 22 }}>
                {contractorDisplayName} has been notified and will be in touch to confirm the start date.
              </p>
            </div>
          )}
          {depositConfirming && <div className="doc-status" style={{ background: 'var(--doc-accent-soft)', color: 'var(--doc-accent)' }}><span className="doc-status-icon" style={{ animation: 'doc-spin 0.8s linear infinite', display: 'inline-flex' }}><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg></span><span>Confirming your payment — just a moment…</span></div>}
          {depositTimedOut && <div className="doc-status doc-status--info"><span className="doc-status-icon">ℹ</span><span>Payment received — confirmation may take a moment. Refresh this page or contact {contractorDisplayName} if you have questions.</span></div>}

          {quote.revision_summary && <div className="doc-revision"><strong>Updated:</strong> {quote.revision_summary}</div>}

          {/* ── PRICING HERO — above the fold ── */}
          <div className="doc-pricing-hero">
            <h1 className="doc-title font-display">{quote.title || 'Work Quote'}</h1>
            <div className="doc-customer">For <strong>{quote.customer_name || 'you'}</strong></div>

            {/* Price block — Total and Monthly as equal-weight <Stat>s.
                Count-up fires once when the block enters the viewport
                via <RevealOnView> (one-shot IO). Both stats reserve
                stable width via --min-ch + tabular-nums, so the
                block cannot reflow as digits change. */}
            <RevealOnView className="pl-reveal-once">
            <div className="doc-price-block pl-hero-stats">
              <Stat
                label="Total"
                value={Number(displayTotal) || 0}
                prefix="$"
                align="center"
                decimals={Number.isInteger(Number(displayTotal)) ? 0 : 2}
              />
              {showFinancing(displayTotal) && (() => {
                const mo = estimateMonthly(displayTotal);
                return (
                  <>
                    <span className="pl-hero-divider" aria-hidden="true">or</span>
                    <Stat
                      label="Monthly from"
                      value={Number(mo) || 0}
                      prefix="$"
                      suffix="/mo"
                      align="center"
                      tone="brand"
                      decimals={Number.isInteger(Number(mo)) ? 0 : 2}
                      hint="Subject to approval · Choose at checkout"
                    />
                  </>
                );
              })()}
            </div>
            {showFinancing(displayTotal) && (
              <div className="pl-affirm-line">
                Pay over time with Affirm or Klarna — choose at checkout.
              </div>
            )}
            </RevealOnView>

            {/* Trust signals — above the fold, always visible. */}
            <div className="pl-hero-trust" role="list" aria-label="Quote reassurances">
              <span role="listitem">✓ No payment now</span>
              <span role="listitem">✓ Price locked in</span>
              <span role="listitem">✓ Cancel anytime before work starts</span>
            </div>

            {quote.deposit_required && Number(quote.deposit_amount) > 0 && quote.deposit_status !== 'paid' && (
              <div className="doc-price-deposit">Deposit to get started: <strong>{currency(quote.deposit_amount)}</strong></div>
            )}

            {/* Primary CTA — right in the hero */}
            {canAct && !isApproved && !isRevisionRequested && !showSignature && (
              <div className="doc-hero-cta">
                <button className="doc-cta-primary pl-cta-approve" type="button" onClick={openSignature} disabled={!canSign}
                  data-approved="false"
                  title={hasTerms && !termsAccepted ? 'Tick the terms box to continue' : ''}>
                  <span className="pl-cta-label">
                    {hasTerms && !termsAccepted ? 'Accept Terms to Continue' : 'Approve & Sign'}
                  </span>
                  <span className="pl-cta-approved" aria-hidden="true">
                    <span className="pl-cta-check">✓</span> Approved
                  </span>
                </button>
                <div className="doc-hero-reassurance">
                  <span>✓ No payment required now</span>
                  <span>✓ Price locked in</span>
                  <span>✓ Cancel before work starts, no obligation</span>
                </div>
              </div>
            )}

            {/* When approved, show the transformed CTA in-place (zero layout shift
                from the canAct state above — same container height reserved). */}
            {(isApproved || actionDone === 'approved') && !isRevisionRequested && (
              <div className="doc-hero-cta" aria-hidden="false">
                <div className="doc-cta-primary pl-cta-approve" data-approved="true" role="status" aria-live="polite">
                  <span className="pl-cta-label">Approve &amp; Sign</span>
                  <span className="pl-cta-approved">
                    <span className="pl-cta-check">✓</span> Approved
                  </span>
                </div>
              </div>
            )}

            {/* Compact meta */}
            <div className="doc-meta-row">
              {daysValid !== null && daysValid <= 7 && daysValid >= 0 && !isExpired && (
                <span className={`doc-meta-chip ${daysValid <= 3 ? 'doc-meta-chip--urgent' : 'doc-meta-chip--soon'}`}>
                  {daysValid === 0 ? 'Expires today' : `${daysValid} day${daysValid !== 1 ? 's' : ''} left`}
                </span>
              )}
              <span className="doc-meta-chip">{formatDate(quote.created_at)}</span>
              {quote.trade && <span className="doc-meta-chip">{quote.trade}</span>}
            </div>
          </div>

          {/* Scope summary */}
          {quote.scope_summary && (
            <RevealOnView className="pl-reveal-once">
              <div className="doc-section"><h2 className="doc-section-title font-display">Scope of Work</h2><div className="doc-section-body"><p style={{ overflowWrap: 'anywhere' }}>{quote.scope_summary}</p></div></div>
            </RevealOnView>
          )}

          {/* ── Amendment display (Phase 2) ──
              If the quote carries an approved amendment, show the ORIGINAL
              scope followed by the AMENDMENT with clear section labels.
              Kept in prose/list form (no table) so it works on 360 px. */}
          {quote.amendment && (quote.amendment.status === 'approved' || quote.amendment.approved_at) && (
            <RevealOnView className="pl-reveal-once">
              <div className="pl-amendment-frame" role="region" aria-label="Amendment details">
                <div>
                  <div className="pl-amendment-label">Original scope</div>
                  {quote.original_scope_summary || quote.scope_summary ? (
                    <p className="pl-amendment-summary">
                      {quote.original_scope_summary || quote.scope_summary}
                    </p>
                  ) : (
                    <p className="pl-amendment-summary">See the line items above for the original agreed scope.</p>
                  )}
                </div>
                <div>
                  <div className="pl-amendment-label pl-amendment-label--new">
                    ＋ Amendment
                    {quote.amendment.title ? ` — ${quote.amendment.title}` : ''}
                  </div>
                  {quote.amendment.summary && (
                    <p className="pl-amendment-summary">{quote.amendment.summary}</p>
                  )}
                  {Array.isArray(quote.amendment.line_items) && quote.amendment.line_items.length > 0 && (
                    <ul className="pl-amendment-list">
                      {quote.amendment.line_items.map(li => (
                        <li key={li.id || `${li.name}-${li.unit_price}-${li.quantity}`}>
                          <span className="pl-amendment-name">{li.name}</span>
                          <span className="pl-amendment-price">
                            {currency(Number(li.quantity || 1) * Number(li.unit_price || 0))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {Number(quote.amendment.total) > 0 && (
                    <div className="pl-amendment-list" style={{ borderTop: '1px solid var(--doc-border)', paddingTop: 8, marginTop: 8, fontWeight: 800 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span>Amendment total</span>
                        <span className="pl-amendment-price">{currency(quote.amendment.total)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </RevealOnView>
          )}

          {/* §6.2 — Mobile: financing tile above the fold, before line items.
              On desktop this block is hidden via CSS (.pq-financing-above-fold display:none
              at ≥641px). The in-hero monthly stat already covers desktop. */}
          {showFinancing(displayTotal) && (() => {
            const mo = estimateMonthly(displayTotal);
            return (
              <div className="pq-financing-above-fold" aria-hidden="false">
                <div className="pq-financing-above-fold-label">Pay monthly</div>
                <div className="pq-financing-above-fold-value">from {currency(mo)}<span style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>/mo</span></div>
                <div className="pq-financing-above-fold-hint">Subject to approval · Choose at checkout with Affirm or Klarna</div>
              </div>
            );
          })()}

          {/* Line items — collapsed by default */}
          <RevealOnView className="pl-reveal-once">
          <details className="doc-items-collapse">
            <summary className="doc-items-toggle">
              <span>View full breakdown</span>
              <span className="doc-items-toggle-count">{(quote.line_items || []).filter(i => i.included !== false).length} items</span>
            </summary>
            <div className="doc-items">
              <div className="doc-items-header"><h2 className="doc-section-title font-display">Work Breakdown</h2></div>
              {sortedGroupKeys.map(category => (
                <div key={category} className="doc-group pl-scope-group">
                  {showGroupHeaders && (
                    <div className="pl-scope-group-head">
                      <span className="doc-group-label pl-scope-group-label">{category}</span>
                      <span className="pl-scope-group-count">
                        {groupedItems[category].length} item{groupedItems[category].length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  {groupedItems[category].map(item => (
                    <div key={item.id} className="doc-item">
                      <div className="doc-item-left">
                        <div className="doc-item-name">{item.name}</div>
                        {item.notes && <div className="doc-item-note">{item.notes}</div>}
                        {Number(item.quantity) > 1 && <div className="doc-item-qty">{item.quantity} × {currency(item.unit_price)}</div>}
                      </div>
                      <div className="doc-item-right tabular">{currency(Number(item.quantity || 1) * Number(item.unit_price || 0))}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </details>
          </RevealOnView>

          {optionalItems.length > 0 && (
            <div className="doc-items" style={{ paddingTop: 0 }}>
              <div className="doc-group doc-group--optional">
                <div className="pq-optionals-header">
                  <span className="doc-group-label" style={{ padding: 0 }}>Optional Add-ons</span>
                  {canAct && <span className="pq-optionals-hint">Toggle to include</span>}
                </div>
                {optionalItems.map(item => canAct ? (
                  <OptionalItemRow key={item.id} item={item} selected={selectedOptionals.has(item.id)} onToggle={toggleOptional} currency={currency} />
                ) : (
                  <div key={item.id} className="doc-item doc-item--optional">
                    <div className="doc-item-left"><div className="doc-item-name">{item.name}</div>{item.notes && <div className="doc-item-note">{item.notes}</div>}</div>
                    <div className="doc-item-right">{currency(item.unit_price)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totals — wrapped in a stable container so rows toggling
              (discount, add-ons, monthly, deposit) cannot reflow the
              actions block below. All value cells use .tabular so the
              grand-total row doesn't jitter as add-ons are toggled. */}
          <div className="pl-totals-card-wrap">
          <div className="doc-totals"><div className="doc-totals-inner">
            <div className="doc-total-row"><span>Subtotal</span><strong className="tabular">{currency(quote.subtotal || quote.total)}</strong></div>
            {hasDiscount && <div className="doc-total-row doc-total-row--discount"><span>Discount</span><strong className="tabular">−{currency(discount)}</strong></div>}
            {selectedOptionalsTotal > 0 && <div className="doc-total-row" style={{ color: 'var(--doc-accent, var(--brand))' }}><span>Selected add-ons</span><strong className="tabular">+{currency(selectedOptionalsTotal)}</strong></div>}
            {Number(quote.tax) > 0 && <div className="doc-total-row"><span>Tax</span><strong className="tabular">{currency(Number(quote.tax) + (selectedOptionalsTotal * effectiveTaxRate))}</strong></div>}
            <div className="doc-total-row doc-total-row--grand" aria-live="polite"><span>Total</span><strong className="tabular pl-totals-grand-num">{currency(displayTotal)}</strong></div>
            {showFinancing(displayTotal) && (
              <div className="doc-total-row doc-total-row--monthly-highlight">
                <span>or from {currency(estimateMonthly(displayTotal))}/mo</span>
                <strong>Pay monthly at checkout →</strong>
              </div>
            )}
            {quote.deposit_required && Number(quote.deposit_amount) > 0 && (
              <div className="doc-total-row doc-total-row--deposit">
                <span>{quote.deposit_status === 'paid' ? 'Deposit paid' : 'Deposit to confirm'}</span>
                <strong className="tabular">{currency(quote.deposit_amount)}</strong>
              </div>
            )}
          </div></div>
          </div>

          {/* ═══ APPROVE CTA — immediately after totals, before info blocks ═══ */}
          {canAct && !isApproved && !isRevisionRequested && !showSignature && (
            <div className="pq-actions" style={{ paddingBottom: 12 }}>
              {/* Inline terms — checkbox next to CTA. aria-describedby
                  ties the checkbox to the terms text so AT announces
                  the terms content when the checkbox is focused. */}
              {hasTerms && !isSigned && (
                <div className="pq-inline-terms pl-terms-wrap" ref={termsRef}>
                  <label className="pq-inline-terms-label">
                    <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)}
                      aria-describedby="pl-terms-text"
                      style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--doc-accent, var(--brand))', flexShrink: 0 }} />
                    <span>I agree to the <button type="button" className="pq-terms-link" onClick={() => setActiveSheet(null) || document.querySelector('.pq-terms-expand')?.click?.()}>terms & conditions</button></span>
                  </label>
                  <details className="pq-terms-detail">
                    <summary className="pq-terms-expand">Read terms ▸</summary>
                    <TermsBody id="pl-terms-text" compact>{quote.terms_conditions}</TermsBody>
                  </details>
                </div>
              )}
              <button className="doc-cta-primary pl-cta-approve" type="button" onClick={openSignature} disabled={!canSign}
                data-approved="false"
                title={hasTerms && !termsAccepted ? 'Tick the terms box to continue' : ''}
                style={{ fontSize: 'var(--text-lg)', padding: '14px 20px', fontWeight: 700 }}>
                <span className="pl-cta-label">
                  {hasTerms && !termsAccepted ? 'Accept Terms to Approve' : 'Approve & Sign'}
                </span>
                <span className="pl-cta-approved" aria-hidden="true">
                  <span className="pl-cta-check">✓</span> Approved
                </span>
              </button>
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--doc-muted)' }}>No payment required now · Price locked in · Cancel anytime before work starts</div>
                {showFinancing(displayTotal) && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--doc-accent)', fontWeight: 600, marginTop: 6 }}>Pay monthly option available — choose at checkout</div>
                )}
              </div>
            </div>
          )}

          {/* Info blocks — below the CTA, for careful readers */}
          {(quote.assumptions || quote.exclusions || quote.payment_instructions || effectivePaymentMethods.length > 0) && (
            <details className="doc-info-collapse">
              <summary className="doc-info-toggle pl-toggle-row" style={{ listStyle:'none', padding:'12px 28px' }}>
                <span style={{ fontWeight:600, fontSize: 'var(--text-base)' }}>Details & assumptions</span>
                <span className="pl-chevron" />
              </summary>
              <div className="doc-info-grid" style={
                [quote.assumptions, quote.exclusions, (quote.payment_instructions || effectivePaymentMethods.length > 0)].filter(Boolean).length === 1
                  ? { gridTemplateColumns: '1fr', maxWidth: 480, margin: '0 auto', padding: '0 28px 24px' }
                  : undefined
              }>
                {quote.assumptions && <div className="doc-info-block"><div className="doc-info-label">Assumptions</div><div className="doc-info-body"><p style={{whiteSpace:'pre-line'}}>{quote.assumptions}</p></div></div>}
                {quote.exclusions && <div className="doc-info-block"><div className="doc-info-label">Not included</div><div className="doc-info-body"><p style={{whiteSpace:'pre-line'}}>{quote.exclusions}</p></div></div>}
                {(quote.payment_instructions || effectivePaymentMethods.length > 0) && (
                  <div className="doc-info-block"><div className="doc-info-label">Payment</div><div className="doc-info-body">
                    {quote.payment_instructions && <p>{quote.payment_instructions}</p>}
                    {effectivePaymentMethods.length > 0 && <div className="doc-payment-methods">{effectivePaymentMethods.map(m => <span key={m} className="doc-payment-tag">{m}</span>)}</div>}
                    {quote.etransfer_email && (
                      <p className="pl-etransfer-row" style={{ marginTop: 8 }}>
                        <span className="pl-etransfer-label">E-Transfer to:</span>
                        <strong className="pl-etransfer-email">{quote.etransfer_email}</strong>
                        <CopyChip value={quote.etransfer_email} label="Copy" copiedLabel="Copied" />
                      </p>
                    )}
                  </div></div>
                )}
              </div>
            </details>
          )}

          {/* Photos — if the quote carries a photos[] array of URLs, show
              a responsive gallery. Images are loaded lazily (below-the-fold)
              and decoded asynchronously so the first paint is not delayed. */}
          {Array.isArray(quote.photos) && quote.photos.filter(Boolean).length > 0 && (
            <RevealOnView className="pl-reveal-once">
              <div className="doc-section" style={{ paddingBottom: 8 }}>
                <h2 className="doc-section-title font-display">Photos</h2>
              </div>
              <div className="pl-photos" role="list" aria-label="Photos from the job site">
                {quote.photos.filter(Boolean).map((p, i) => {
                  const url = typeof p === 'string' ? p : (p && (p.url || p.src)) || '';
                  const caption = typeof p === 'object' && p ? (p.caption || p.alt || '') : '';
                  if (!url) return null;
                  return (
                    <a
                      key={`ph-${url}-${i}`}
                      href={url}
                      target="_blank" rel="noreferrer"
                      rel="noreferrer"
                      className="pl-photo"
                      role="listitem"
                      aria-label={caption || `Photo ${i + 1}`}
                    >
                      <img
                        src={url}
                        alt={caption || ''}
                        loading="lazy"
                        decoding="async"
                      />
                    </a>
                  );
                })}
              </div>
            </RevealOnView>
          )}

          {/* FIX #14: Conversation thread with scroll ref */}
          {conversation.length > 0 && (
            <div style={{ padding: '0 28px' }}>
              <ConversationThread thread={conversation} threadRef={threadRef} />
            </div>
          )}

          {/* Signed display */}
          {isSigned && quote.signature_data && (
            <div className="pq-signature-display">
              <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--doc-muted)', marginBottom: 8 }}>Customer Acceptance</div>
              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <img src={quote.signature_data} alt="Signature" style={{ maxHeight: 60, maxWidth: 200 }} />
                  <div style={{ borderTop: '1px solid var(--doc-border)', paddingTop: 4, marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--doc-text)' }}>{quote.signer_name}</div>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--doc-muted)' }}>Signed {formatDate(quote.signed_at)}</div>
              </div>
            </div>
          )}

          {/* Trust signals — contextual, not boilerplate */}
          <div className="doc-signals">
            {!isExpired && daysValid !== null && daysValid > 0 && daysValid <= 7 && <div className="doc-signal doc-signal--urgent" data-urgent="true">Valid for {daysValid} more day{daysValid !== 1 ? 's' : ''}</div>}
            {!isExpired && daysValid !== null && daysValid > 7 && <div className="doc-signal">This quote is valid until {quote.expires_at ? new Date(quote.expires_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : ''}</div>}
            {!isExpired && canAct && !isApproved && <div className="doc-signal">No payment required to approve — signing is free</div>}
            {!isExpired && canAct && !isApproved && <div className="doc-signal">You can ask questions or request changes at any time</div>}
            {quote.contractor_phone && <div className="doc-signal">Questions? Call {contractorDisplayName} at <a href={`tel:${quote.contractor_phone}`} style={{ color: 'var(--doc-accent)', fontWeight: 600 }}>{quote.contractor_phone}</a></div>}
          </div>

          {/* ═══════════════════════════════════════════
              ACTIONS
              ═══════════════════════════════════════════ */}
          <div className="pq-actions">

            {/* Deposit — post-approval */}
            {waitingOnDeposit && isApproved && !isPreview && (
              <div className="pq-deposit-block">
                <div className="pq-deposit-header">
                  <strong>Deposit required: {currency(quote.deposit_amount)}</strong>
                  <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', opacity: .85 }}>{contractorDisplayName} will begin work after deposit is received.</p>
                </div>
                {/* ── Punchlist Connect payment (primary when available) ── */}
                {quote.stripe_connect_enabled ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                    <button className="doc-cta-primary" onClick={handleConnectPay} disabled={payLoading} style={{ textAlign: 'center', border: 'none', cursor: 'pointer' }}>
                      {payLoading ? 'Loading…' : `Pay ${currency(quote.deposit_amount)} →`}
                    </button>
                    <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--doc-muted)', textAlign: 'center' }}>Credit card, debit, or pay in installments</span>
                  </div>
                ) : (quote.contractor_stripe_link || quote.square_payment_link || quote.paypal_link) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                    {quote.contractor_stripe_link && <a href={quote.contractor_stripe_link} target="_blank" rel="noreferrer" className="doc-cta-primary" style={{ textDecoration: 'none', textAlign: 'center' }}>Pay {currency(quote.deposit_amount)} Online →</a>}
                    {quote.square_payment_link && <a href={quote.square_payment_link} target="_blank" rel="noreferrer" className="doc-cta-primary" style={{ background: 'var(--doc-text)', textDecoration: 'none', textAlign: 'center' }}>Pay via Square</a>}
                    {quote.paypal_link && <a href={quote.paypal_link.startsWith('http') ? quote.paypal_link : `https://paypal.me/${quote.paypal_link}`} target="_blank" rel="noreferrer" className="doc-cta-primary" style={{ background: 'var(--paypal-blue, #0070ba)', textDecoration: 'none', textAlign: 'center' }}>Pay via PayPal</a>}
                  </div>
                ) : !quote.payment_instructions && !quote.etransfer_email && effectivePaymentMethods.length === 0 ? (
                  /* No payment methods at all — show a clear contact CTA */
                  <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--doc-line-soft)', borderRadius: 10, fontSize: 'var(--text-sm)', color: 'var(--doc-text-2)', lineHeight: 1.6 }}>
                    <strong style={{ display: 'block', marginBottom: 4 }}>To pay your deposit, contact {contractorDisplayName} directly:</strong>
                    {quote.contractor_phone && <div><a href={`tel:${quote.contractor_phone}`} style={{ color: 'var(--doc-accent)' }}>{quote.contractor_phone}</a></div>}
                    {quote.contractor_email && <div><Phone size={13} style={{verticalAlign:'middle',marginRight:4,display:'none'}}/><a href={`mailto:${quote.contractor_email}`} style={{ color: 'var(--doc-accent)' }}>{quote.contractor_email}</a></div>}
                  </div>
                ) : null}
                {(quote.payment_instructions || effectivePaymentMethods.length > 0 || quote.etransfer_email) && (
                  <div style={{ marginTop: 10, fontSize: 'var(--text-sm)', color: 'var(--doc-muted)', lineHeight: 1.6 }}>
                    {(quote.stripe_connect_enabled || quote.contractor_stripe_link || quote.square_payment_link || quote.paypal_link) && <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 600, marginBottom: 6 }}>Or pay directly:</div>}
                    {quote.payment_instructions && <p style={{ margin: '0 0 6px' }}>{quote.payment_instructions}</p>}
                    {effectivePaymentMethods.length > 0 && <div className="doc-payment-methods">{effectivePaymentMethods.map(m => <span key={m} className="doc-payment-tag">{m}</span>)}</div>}
                    {quote.etransfer_email && (
                      <p className="pl-etransfer-row" style={{ marginTop: 6 }}>
                        <span className="pl-etransfer-label">E-Transfer to:</span>
                        <strong className="pl-etransfer-email">{quote.etransfer_email}</strong>
                        <CopyChip value={quote.etransfer_email} label="Copy" copiedLabel="Copied" />
                      </p>
                    )}
                    {quote.venmo_zelle_handle && <p style={{ marginTop: 4 }}>Venmo/Zelle: <strong>{quote.venmo_zelle_handle}</strong></p>}
                  </div>
                )}
              </div>
            )}

            {/* Download signed copy */}
            {isSigned && !isPreview && (
              <button className="doc-cta-secondary" type="button" onClick={downloadSignedPdf}>Download Signed Copy</button>
            )}

            {/* Signature area — the actual pad lives in a modal rendered
                at the page root (see <SignatureModal/> below). signRef is
                preserved for the existing scroll-into-view handler. */}
            <div ref={signRef} aria-hidden="true" />

            {/* FIX #11: Secondary actions — responsive, wraps on small screens */}
            {canAct && !showSignature && (
              <div className="pq-secondary-actions">
                <div className="pq-secondary-label">Have questions?</div>
                <div className="pq-secondary-buttons">
                  <button className="pq-btn-secondary" type="button" onClick={() => setActiveSheet('question')}><MessageSquare size={14} style={{verticalAlign:'middle',marginRight:6}}/>Ask a question</button>
                  <button className="pq-btn-secondary" type="button" onClick={() => setActiveSheet('changes')}><Pencil size={14} style={{verticalAlign:'middle',marginRight:6}}/>Request changes</button>
                </div>
              </div>
            )}

            {/* Question for signed/approved quotes */}
            {!canAct && !isPreview && !isCompleted && !isScheduled && !isClosedOut && (isSigned || isApproved) && (
              <button className="pq-btn-secondary" type="button" onClick={() => setActiveSheet('question')} style={{ width: '100%' }}><MessageSquare size={14} style={{verticalAlign:'middle',marginRight:6}}/>Ask a question</button>
            )}

            {/* Decline */}
            {canAct && !isApproved && !isDeclined && !showSignature && (
              <div style={{ borderTop: '1px solid var(--doc-line)', paddingTop: 20, marginTop: 8 }}>
                <button className="pq-btn-decline" type="button" onClick={() => setActiveSheet('decline')}>Not the right fit — decline this quote</button>
              </div>
            )}

            {error && !showSignature && <div style={{ color: 'var(--doc-red)', fontSize: 'var(--text-sm)', textAlign: 'center', marginTop: 6 }}>{error}</div>}
          </div>

          {/* Footer */}
          <div className="doc-footer">
            <div>
              <div style={{ fontWeight: 600, color: 'var(--doc-text)' }}>{contractorDisplayName}</div>
              {quote.contractor_phone && <div style={{ marginTop: 2 }}>{quote.contractor_phone}</div>}
              {quote.contractor_email && <div style={{ marginTop: 2 }}>{quote.contractor_email}</div>}
            </div>
            <div className="doc-footer-actions">
              <button type="button" className="doc-footer-link" onClick={() => {
                const url = `/api/export-pdf?token=${quote.share_token || shareToken}`;
                const a = document.createElement('a'); a.href = url;
                a.download = `${(quote?.title || 'quote').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
              }}>Download PDF</button>
              <button type="button" className="doc-footer-link" onClick={() => window.print()}>Print</button>
            </div>
          </div>

          {/* Print signature area */}
          <div className="doc-signature-print">
            {isSigned && quote.signature_data ? (
              <div className="doc-sig-box">
                <img src={quote.signature_data} alt="Signature" style={{ maxHeight: 50, maxWidth: 180 }} />
                <div className="doc-sig-label">{quote.signer_name} · {formatDate(quote.signed_at)}</div>
              </div>
            ) : (
              <>
                <div className="doc-sig-box"><div className="doc-sig-line"></div><div className="doc-sig-label">Customer signature / date</div></div>
                <div className="doc-sig-box"><div className="doc-sig-line"></div><div className="doc-sig-label">Contractor signature / date</div></div>
              </>
            )}
          </div>
        </div>

      {/* Mobile sticky CTA stays during signing to show total */}
      {canAct && !isApproved && !isRevisionRequested && !isExpired && (
        <div className="doc-sticky-cta">
          <div className="doc-sticky-total">
            {showFinancing(displayTotal) ? (
              <>from {currency(estimateMonthly(displayTotal))}<span className="doc-sticky-per">/mo</span><span className="doc-sticky-full">or {currency(displayTotal)}</span></>
            ) : (
              currency(displayTotal)
            )}
          </div>
          {!showSignature ? (
            hasTerms && !termsAccepted ? (
              <button className="doc-cta-primary" type="button"
                onClick={() => termsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                Accept Terms to Continue ↑
              </button>
            ) : (
              <button className="doc-cta-primary" type="button" onClick={openSignature}>
                Approve & Sign
              </button>
            )
          ) : (
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--doc-accent)', textAlign: 'center', flex: 1 }}>Complete signature above ↑</div>
          )}
        </div>
      )}
      {waitingOnDeposit && isApproved && !isPreview && (
        <div className="doc-sticky-cta">
          <div className="doc-sticky-total">Deposit: {currency(quote.deposit_amount)}</div>
          {quote.stripe_connect_enabled ? (
            <button className="doc-cta-primary" onClick={handleConnectPay} disabled={payLoading} style={{ textDecoration: 'none', textAlign: 'center', border: 'none', cursor: 'pointer' }}>
              {payLoading ? 'Loading…' : `Pay ${currency(quote.deposit_amount)} →`}
            </button>
          ) : quote.contractor_stripe_link ? (
            <a href={quote.contractor_stripe_link} target="_blank" rel="noreferrer" className="doc-cta-primary" style={{ textDecoration: 'none', textAlign: 'center' }}>Pay {currency(quote.deposit_amount)} →</a>
          ) : quote.square_payment_link ? (
            <a href={quote.square_payment_link} target="_blank" rel="noreferrer" className="doc-cta-primary" style={{ textDecoration: 'none', textAlign: 'center' }}>Pay via Square</a>
          ) : quote.paypal_link ? (
            <a href={quote.paypal_link.startsWith('http') ? quote.paypal_link : `https://paypal.me/${quote.paypal_link}`} target="_blank" rel="noreferrer" className="doc-cta-primary" style={{ textDecoration: 'none', textAlign: 'center' }}>Pay via PayPal</a>
          ) : (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--doc-muted)' }}>
              {effectivePaymentMethods.length > 0
                ? `Pay via ${effectivePaymentMethods.join(', ')}`
                : quote.contractor_phone
                  ? <a href={`tel:${quote.contractor_phone}`} style={{ color: 'var(--doc-accent)', fontWeight: 600 }}>Call to arrange payment</a>
                  : `Contact ${contractorDisplayName}`}
            </span>
          )}
        </div>
      )}
      </div>
      {/* Modals/sheets are siblings of doc-container, inside doc-shell */}
      {activeSheet && <ActionSheet type={activeSheet} onSubmit={handleSheetSubmit} onClose={() => setActiveSheet(null)} sending={sending} />}

      <SignatureModal
        open={showSignature}
        onClose={() => setShowSignature(false)}
        onSave={submitSignature}
        sending={sending}
        error={error}
        contractorName={contractorDisplayName}
        displayTotal={displayTotal}
        currency={currency}
        hasTerms={hasTerms}
        termsAccepted={termsAccepted}
        defaultName={quote.customer_name || ''}
      />
    </div>
  );

  if (mode === 'portal-tab') return _inner;
  return (
    <PublicPageShell contractorName={contractorDisplayName} logoUrl={quote.contractor_logo}>
      {_inner}
    </PublicPageShell>
  );
}
