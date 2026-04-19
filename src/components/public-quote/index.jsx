import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { currency as formatCurrency, formatDate, formatQuoteNumber } from '../../lib/format';
import { estimateMonthly, showFinancing } from '../../lib/financing';
import { getCustomerActions } from '../../lib/workflow';
import { MessageSquare, Pencil } from 'lucide-react';
import PublicPageShell from '../public-page-shell';
import SignatureModal from '../signature-modal';
import { Card, Stat, RevealOnView, TermsBody, CopyChip } from '../ui';
import useScrollLock from '../../hooks/use-scroll-lock';
import PublicErrorState from '../public-error-state';

import { PublicQuoteProvider } from './public-quote-context';
import QuoteHeader from './quote-header';
import QuoteLineItems from './quote-line-items';
import QuoteAddOns from './quote-add-ons';
import QuoteTotals from './quote-totals';
import QuoteActions from './quote-actions';
import ConversationThread from './conversation-thread';

/* ═══════════════════════════════════════════════════════════
   PublicQuoteView — Phase 5 orchestrator.

   Thin shell (~250 lines) that:
     1. Owns all state and handlers
     2. Provides context to child components
     3. Renders the document structure

   The original 1,171-line file is split into 7 child
   components that each own their own rendering.
   ═══════════════════════════════════════════════════════════ */

/* ── ActionSheet (bottom sheet for question/changes/decline) ── */
const CHANGE_CATEGORIES = ['Scope', 'Pricing', 'Timeline', 'Materials', 'Other'];

function ActionSheet({ type, onSubmit, onClose, sending }) {
  const [text, setText] = useState('');
  const [kbOpen, setKbOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const textareaRef = useRef(null);

  const config = {
    question: { title: 'Ask a question', placeholder: 'What would you like to know about this quote?', button: 'Send question', Icon: MessageSquare },
    changes: { title: 'Request changes', placeholder: 'A couple of lines is plenty — pricing, materials, scope, whatever\u2019s on your mind.', button: 'Send request', Icon: Pencil },
    decline: { title: 'Decline this quote', placeholder: 'What would make this work? (optional — helps your contractor adjust)', button: 'Confirm decline', Icon: null },
  };
  const c = config[type] || config.question;
  const required = type !== 'decline';

  useEffect(() => {
    const t = setTimeout(() => textareaRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function onResize() { setKbOpen(vv.height < window.innerHeight * 0.75); }
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className={`pq-sheet-overlay${kbOpen ? ' keyboard-open' : ''}`} onClick={onClose}>
      <div className="pq-sheet" onClick={e => e.stopPropagation()}>
        <div className="pq-sheet-handle" />
        <div className="pq-sheet-header">
          {c.Icon && <c.Icon size={20} className="pqv-icon-shrink" />}
          <h3 className="font-display pqv-sheet-title">{c.title}</h3>
        </div>
        {type === 'changes' && (
          <div className="pq-changes-categories" role="group" aria-label="What needs to change?">
            <div className="pqv-change-label">What needs to change?</div>
            {CHANGE_CATEGORIES.map(cat => (
              <button key={cat} type="button"
                className={`pq-changes-chip${selectedCategories.includes(cat) ? ' pq-changes-chip--active' : ''}`}
                onClick={() => setSelectedCategories(p => p.includes(cat) ? p.filter(c => c !== cat) : [...p, cat])}
                aria-pressed={selectedCategories.includes(cat)}>{cat}</button>
            ))}
          </div>
        )}
        <textarea ref={textareaRef} className="pq-sheet-textarea" value={text} onChange={e => setText(e.target.value)} placeholder={c.placeholder} rows={4} />
        <div className="pq-sheet-footer">
          <button type="button" className="doc-cta-secondary pqv-cancel-btn" onClick={onClose}>Cancel</button>
          <button type="button" className={`doc-cta-primary pqv-submit-btn ${type === 'decline' ? 'pq-btn-danger' : ''}`}
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
    try { const s = sessionStorage.getItem(optStorageKey); return s ? new Set(JSON.parse(s)) : new Set(); }
    catch { return new Set(); }
  });
  const [payLoading, setPayLoading] = useState(false);
  const [depositConfirming, setDepositConfirming] = useState(false);
  const [depositTimedOut, setDepositTimedOut] = useState(false);

  useScrollLock(Boolean(activeSheet));
  const topRef = useRef(null);
  const signRef = useRef(null);
  const threadRef = useRef(null);
  const readFiredRef = useRef(false);

  // ── Derived state ──
  const isExpired = useMemo(() => quote?.expires_at && new Date(quote.expires_at) < new Date() &&
    !['approved','approved_pending_deposit','scheduled','completed'].includes(quote?.status), [quote]);
  const optionalItems = useMemo(() => (quote?.line_items || []).filter(i => i.included === false || i.item_type === 'optional'), [quote]);
  const requiredItems = useMemo(() => (quote?.line_items || []).filter(i => i.included !== false && i.item_type !== 'optional'), [quote]);
  const selectedOptionalsTotal = useMemo(() =>
    optionalItems.filter(i => selectedOptionals.has(i.id)).reduce((sum, i) => sum + (Number(i.quantity || 1) * Number(i.unit_price || 0)), 0),
    [optionalItems, selectedOptionals]);
  const effectiveTaxRate = useMemo(() => {
    const sub = Number(quote?.subtotal || 0) - Number(quote?.discount || 0);
    const tax = Number(quote?.tax || 0);
    return sub > 0 && tax > 0 ? tax / sub : 0;
  }, [quote]);
  const optionalsTaxed = selectedOptionalsTotal * (1 + effectiveTaxRate);
  const adjustedTotal = (Number(quote?.total) || 0) + optionalsTaxed;
  const isApproved = ['approved','approved_pending_deposit'].includes(quote?.status);
  const isDeclined = quote?.status === 'declined';
  const isRevisionRequested = quote?.status === 'revision_requested';
  const waitingOnDeposit = quote?.deposit_required && quote?.deposit_status !== 'paid';
  const contractorDisplayName = quote?.contractor_company || quote?.contractor_name || 'your contractor';
  const hasTerms = Boolean(quote?.terms_conditions?.trim());
  const canSign = !isRevisionRequested && (!hasTerms || termsAccepted);

  const groupedItems = useMemo(() => {
    const groups = {};
    requiredItems.forEach(item => { const key = item.category || 'Scope'; groups[key] = groups[key] || []; groups[key].push(item); });
    return groups;
  }, [requiredItems]);
  const groupOrder = ['Labour', 'Materials', 'Services'];
  const sortedGroupKeys = Object.keys(groupedItems).sort((a, b) => {
    const ai = groupOrder.indexOf(a); const bi = groupOrder.indexOf(b);
    if (ai >= 0 && bi >= 0) return ai - bi; if (ai >= 0) return -1; if (bi >= 0) return 1;
    return a.localeCompare(b);
  });
  const showGroupHeaders = sortedGroupKeys.length > 1;

  // ── Handlers ──
  function toggleOptional(id) {
    setSelectedOptionals(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      try { sessionStorage.setItem(optStorageKey, JSON.stringify([...n])); } catch (e) { console.warn('[PL]', e); }
      return n;
    });
    try {
      const el = document.querySelector('.doc-total-row--grand');
      if (el) { el.classList.remove('total-flash'); void el.offsetWidth; el.classList.add('total-flash'); }
    } catch (e) { console.warn('[PL]', e); }
  }

  function openSignature() {
    setShowSignature(true);
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
      try { sessionStorage.removeItem(optStorageKey); } catch (e) { console.warn('[PL]', e); }
      setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    } catch (e) { setError(e.message || 'Could not submit'); } finally { setSending(false); }
  }

  async function handleSheetSubmit(text, categories = []) {
    setSending(true); setError('');
    try {
      const type = activeSheet;
      let body;
      if (type === 'question') body = { token: shareToken, action: 'question', question: text };
      else if (type === 'changes') body = { token: shareToken, status: 'revision_requested', feedback: text, amendment_request: { feedback: text, categories: categories.length > 0 ? categories : ['Other'], submitted_at: new Date().toISOString() } };
      else if (type === 'decline') body = { token: shareToken, status: 'declined', feedback: text };
      const r = await fetch('/api/public-quote-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed');
      if (type === 'question' && data.conversation) _setQuote(prev => ({ ...prev, conversation: data.conversation, status: data.status || prev.status }));
      if (type === 'changes') _setQuote(prev => ({ ...prev, status: 'revision_requested' }));
      if (type === 'decline') _setQuote(prev => ({ ...prev, status: 'declined' }));
      setActiveSheet(null);
      setActionDone(type === 'changes' ? 'revision_requested' : type);
      requestAnimationFrame(() => { requestAnimationFrame(() => {
        if (type === 'question') threadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        else topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }); });
    } catch (e) { setError(e.message || 'Could not submit'); } finally { setSending(false); }
  }

  async function handleConnectPay() {
    setPayLoading(true);
    try {
      const r = await fetch('/api/create-payment-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'deposit', quoteId: quote.id, shareToken: quote.share_token }) });
      const data = await r.json();
      if (data.url) window.location.href = data.url;
      else setError('Couldn\u2019t start payment. Try again, or contact your contractor.');
    } catch { setError('Couldn\u2019t reach the payment processor. Try again in a moment.'); }
    finally { setPayLoading(false); }
  }

  // ── Effects ──
  useEffect(() => {
    if (!quote) return;
    document.title = `${quote.title || 'Quote'} — ${contractorDisplayName}`;
    return () => { document.title = 'Punchlist'; };
  }, [quote?.id, quote?.title]);

  useEffect(() => {
    if (!quote || searchParams.get('deposit') !== 'success' || quote.deposit_status === 'paid') return;
    setDepositConfirming(true);
    let attempts = 0;
    const interval = setInterval(async () => {
      if (++attempts > 10) { clearInterval(interval); setDepositConfirming(false); setDepositTimedOut(true); return; }
      try {
        const r = await fetch(`/api/public-quote?token=${shareToken}`);
        if (!r.ok) return;
        const j = await r.json();
        if (j.quote?.deposit_status === 'paid') {
          _setQuote(prev => ({ ...prev, deposit_status: 'paid', status: j.quote.status || prev.status }));
          clearInterval(interval); setDepositConfirming(false);
        }
      } catch (e) { console.warn('[PL]', e); }
    }, 3000);
    return () => clearInterval(interval);
  }, [quote?.id]);

  useEffect(() => {
    if (!shareToken || !threadRef.current || readFiredRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !readFiredRef.current) {
        readFiredRef.current = true;
        fetch('/api/mark-messages-read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: shareToken }) }).catch(e => console.warn('[PL]', e));
        observer.disconnect();
      }
    }, { threshold: 0.3 });
    observer.observe(threadRef.current);
    return () => observer.disconnect();
  }, [shareToken, quote?.id]);

  // ── Error / empty state ──
  if (error && !quote) return <PublicErrorState docType="quote" contractorName={null} onRetry={() => window.location.reload()} />;
  if (!quote) return null;

  // ── Context value ──
  const ctxValue = {
    quote, currency, shareToken, isPreview, contractorDisplayName,
    isExpired, isApproved, isDeclined, isRevisionRequested, waitingOnDeposit,
    actionDone, error, showSignature,
    termsAccepted, setTermsAccepted,
    selectedOptionals, toggleOptional, optionalItems, requiredItems,
    selectedOptionalsTotal, adjustedTotal,
    openSignature, setActiveSheet,
    sortedGroupKeys, showGroupHeaders,
    handleConnectPay, payLoading, depositConfirming, depositTimedOut,
  };

  const inner = (
    <PublicQuoteProvider value={ctxValue}>
      <div className="doc-shell">
        <div className="doc-container">
          <div ref={topRef} />
          <div className="doc-card">
            <QuoteHeader />

            {/* Scope of work */}
            {quote.scope_summary && (
              <div className="doc-section">
                <h2 className="doc-section-title font-display">Scope of Work</h2>
                <div className="doc-section-body"><p className="pqv-scope-text">{quote.scope_summary}</p></div>
              </div>
            )}

            {/* Required line items */}
            <QuoteLineItems />

            {/* Totals */}
            <QuoteTotals />

            {/* Optional add-ons (Phase 5: below totals, not interleaved) */}
            <QuoteAddOns />

            {/* Conversation thread (Phase 5: collapsed, hidden when empty) */}
            <div ref={threadRef}>
              <ConversationThread />
            </div>

            {/* Details & assumptions */}
            {(quote.assumptions || quote.exclusions || quote.terms_conditions) && (
              <details className="doc-info-section">
                <summary className="doc-info-toggle pl-toggle-row pqv-details-toggle">
                  <span className="pqv-details-toggle-label">Details & assumptions</span>
                  <span className="pl-chevron" />
                </summary>
                <div className="doc-info-content">
                  {quote.assumptions && <div className="doc-info-block"><div className="doc-info-label">Assumptions</div><div className="doc-info-body"><p className="pqv-pre-line">{quote.assumptions}</p></div></div>}
                  {quote.exclusions && <div className="doc-info-block"><div className="doc-info-label">Not included</div><div className="doc-info-body"><p className="pqv-pre-line">{quote.exclusions}</p></div></div>}
                  {quote.terms_conditions && <div className="doc-info-block"><div className="doc-info-label">Terms & Conditions</div><div className="doc-info-body"><TermsBody text={quote.terms_conditions} /></div></div>}
                </div>
              </details>
            )}

            {/* Approve/Sign CTA (Phase 5: sticky bottom bar) */}
            <QuoteActions />

            {/* Signature modal */}
            {showSignature && (
              <div ref={signRef}>
                <SignatureModal
                  open={showSignature}
                  onClose={() => setShowSignature(false)}
                  onSubmit={submitSignature}
                  sending={sending}
                  contractorName={contractorDisplayName}
                  total={adjustedTotal}
                  currency={currency}
                />
              </div>
            )}

            {/* Contractor footer */}
            <div className="doc-footer">
              <div className="pqv-contractor-name">{contractorDisplayName}</div>
              {quote.contractor_phone && <div className="pqv-contractor-detail">{quote.contractor_phone}</div>}
              {quote.contractor_email && <div className="pqv-contractor-detail">{quote.contractor_email}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Action sheet (question / changes / decline) */}
      {activeSheet && (
        <ActionSheet
          type={activeSheet}
          onSubmit={handleSheetSubmit}
          onClose={() => setActiveSheet(null)}
          sending={sending}
        />
      )}
    </PublicQuoteProvider>
  );

  if (mode === 'portal-tab') return inner;
  return <PublicPageShell>{inner}</PublicPageShell>;
}
