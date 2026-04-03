import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { currency as formatCurrency, formatDate, formatQuoteNumber } from '../lib/format';
import PublicPageShell from '../components/public-page-shell';
import SignaturePad from '../components/signature-pad';
import useScrollLock from '../hooks/use-scroll-lock';
import '../styles/document.css';

/* ═══════════════════════════════════════════════════════════════════════════
   PUNCHLIST — Premium Public Quote Page v3
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Terms & Conditions ── */
function TermsSection({ terms, accepted, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="pq-terms">
      <button type="button" onClick={() => setExpanded(v => !v)} className="pq-terms-toggle">
        <span>📋 Terms &amp; Conditions</span>
        <span style={{ fontSize: 12, color: 'var(--doc-muted)', fontWeight: 400 }}>{expanded ? 'Hide ▲' : 'Read ▼'}</span>
      </button>
      {expanded && (
        <div className="pq-terms-body">
          <pre style={{ fontFamily: 'inherit', fontSize: 13, lineHeight: 1.7, color: 'var(--doc-text)', whiteSpace: 'pre-wrap', margin: '12px 0' }}>{terms}</pre>
        </div>
      )}
      <div className="pq-terms-accept">
        <input type="checkbox" id="terms-accept" checked={accepted} onChange={e => onToggle(e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#ea580c' }} />
        <label htmlFor="terms-accept" style={{ fontSize: 13, color: 'var(--doc-text)', cursor: 'pointer', userSelect: 'none', lineHeight: 1.4 }}>
          I have read and agree to the terms &amp; conditions
        </label>
      </div>
    </div>
  );
}

/* ── Optional Item Toggle ── */
function OptionalItemRow({ item, selected, onToggle, currency }) {
  const price = Number(item.quantity || 1) * Number(item.unit_price || 0);
  return (
    <div className={`pq-optional-item ${selected ? 'pq-optional-item--on' : ''}`}>
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
      <div style={{ minWidth: 70, textAlign: 'right', fontWeight: 700, fontSize: 15 }}>
        {selected ? <span style={{ color: '#ea580c' }}>+{currency(price)}</span> : <span style={{ color: 'var(--doc-muted)' }}>{currency(price)}</span>}
      </div>
    </div>
  );
}

/* ── Conversation Thread ── */
function ConversationThread({ thread, threadRef }) {
  if (!thread || thread.length === 0) return null;
  return (
    <div className="pq-conversation" ref={threadRef}>
      <div className="pq-conversation-header">💬 Questions &amp; Replies</div>
      <div className="pq-conversation-body">
        {thread.map(entry => (
          <div key={entry.id} className={`pq-msg ${entry.role === 'contractor' ? 'pq-msg--right' : ''}`}>
            <div className={`pq-msg-avatar ${entry.role === 'contractor' ? 'pq-msg-avatar--contractor' : ''}`}>
              {entry.role === 'customer' ? '👤' : '🔧'}
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
function ActionSheet({ type, onSubmit, onClose, sending }) {
  const [text, setText] = useState('');
  const config = {
    question: { title: 'Ask a question', placeholder: 'What would you like to know about this quote?', button: 'Send question', icon: '💬' },
    changes: { title: 'Request changes', placeholder: 'What should be different? (scope, pricing, timeline…)', button: 'Send request', icon: '✏️' },
    decline: { title: 'Decline this quote', placeholder: 'Reason (optional — helps your contractor improve)', button: 'Confirm decline', icon: '✕' },
  };
  const c = config[type] || config.question;
  const required = type !== 'decline';

  return (
    <div className="pq-sheet-overlay" onClick={onClose}>
      <div className="pq-sheet" onClick={e => e.stopPropagation()}>
        <div className="pq-sheet-handle" />
        <div className="pq-sheet-header">
          <span style={{ fontSize: 20 }}>{c.icon}</span>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-.02em' }}>{c.title}</h3>
        </div>
        <textarea className="pq-sheet-textarea" value={text} onChange={e => setText(e.target.value)} placeholder={c.placeholder} rows={4} autoFocus />
        <div className="pq-sheet-footer">
          <button type="button" className="doc-cta-secondary" onClick={onClose} style={{ flex: 0, padding: '12px 20px' }}>Cancel</button>
          <button type="button" className={`doc-cta-primary ${type === 'decline' ? 'pq-btn-danger' : ''}`} style={{ flex: 1 }}
            disabled={sending || (required && !text.trim())} onClick={() => onSubmit(text.trim())}>
            {sending ? 'Sending…' : c.button}
          </button>
        </div>
      </div>
    </div>
  );
}


export default function PublicQuotePage() {
  const { shareToken } = useParams();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get('preview') === '1';
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const currency = (n) => formatCurrency(n, quote?.country);
  const [activeSheet, setActiveSheet] = useState(null);
  const [showSignature, setShowSignature] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [actionDone, setActionDone] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [selectedOptionals, setSelectedOptionals] = useState(new Set());

  // Lock body scroll when overlay is open (prevents iOS background scroll)
  useScrollLock(Boolean(activeSheet));

  // Refs for scroll targets
  const topRef = useRef(null);
  const signRef = useRef(null);
  const threadRef = useRef(null);

  useEffect(() => {
    fetch(`/api/public-quote?token=${shareToken}`)
      .then(async r => {
        const text = await r.text();
        let j; try { j = JSON.parse(text); } catch { throw new Error('Server error'); }
        if (!r.ok) throw new Error(j.error || 'Quote not found');
        return j.quote;
      })
      .then(q => {
        setQuote(q);
        if (!isPreview) {
          // Deduplicate view tracking: only fire once per session per quote
          const viewKey = `pl_viewed_${shareToken}`;
          const alreadyViewed = sessionStorage.getItem(viewKey);
          if (!alreadyViewed) {
            fetch('/api/public-quote-action', { method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: shareToken, action: 'view' }) }).catch(() => {});
            try { sessionStorage.setItem(viewKey, '1'); } catch {}
          }
        }
        if (searchParams.get('print') === '1') setTimeout(() => window.print(), 600);
      })
      .catch(e => setError(e.message || 'Could not load quote'))
      .finally(() => setLoading(false));
  }, [shareToken]);

  // ── Deposit polling: after Stripe checkout redirect, poll until webhook updates status ──
  useEffect(() => {
    if (!quote || searchParams.get('deposit') !== 'success') return;
    if (quote.deposit_status === 'paid') return; // Already confirmed
    let attempts = 0;
    const maxAttempts = 10; // 10 x 3s = 30s max
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) { clearInterval(interval); return; }
      try {
        const r = await fetch(`/api/public-quote?token=${shareToken}`);
        if (!r.ok) return;
        const j = await r.json();
        if (j.quote?.deposit_status === 'paid') {
          setQuote(prev => ({ ...prev, deposit_status: 'paid', status: j.quote.status || prev.status }));
          clearInterval(interval);
        }
      } catch {}
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

  function toggleOptional(id) {
    setSelectedOptionals(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const adjustedTotal = (Number(quote?.total) || 0) + selectedOptionalsTotal;
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
      setQuote(prev => ({ ...prev, status: data.status || 'approved', deposit_status: data.deposit_status || prev.deposit_status, signed_at: new Date().toISOString(), signature_data: sigData.signature_data, signer_name: sigData.signer_name }));
      setShowSignature(false); setActionDone('approved');
      // FIX #13: Scroll to top so customer sees the success banner
      setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    } catch (e) { setError(e.message || 'Could not submit'); } finally { setSending(false); }
  }

  async function handleSheetSubmit(text) {
    setSending(true); setError('');
    try {
      const type = activeSheet;
      let body;
      if (type === 'question') body = { token: shareToken, action: 'question', question: text };
      else if (type === 'changes') body = { token: shareToken, status: 'revision_requested', feedback: text };
      else if (type === 'decline') body = { token: shareToken, status: 'declined', feedback: text };

      const r = await fetch('/api/public-quote-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed');

      if (type === 'question' && data.conversation) setQuote(prev => ({ ...prev, conversation: data.conversation }));
      if (type === 'changes') setQuote(prev => ({ ...prev, status: 'revision_requested' }));
      if (type === 'decline') setQuote(prev => ({ ...prev, status: 'declined' }));

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

  if (loading) return (
    <div className="doc-shell"><div className="doc-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', color: 'var(--doc-muted)' }}><div className="loading-spinner" style={{ margin: '0 auto 12px' }} />Loading your quote…</div>
    </div></div>
  );

  if (error && !quote) return (
    <div className="doc-shell"><div className="doc-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', maxWidth: 340 }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>🔗</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>Quote unavailable</h2>
        <p style={{ fontSize: 14, color: 'var(--doc-muted)', lineHeight: 1.6, margin: '0 0 20px' }}>This link may have expired. Contact your contractor.</p>
        <button className="doc-cta-secondary" onClick={() => window.location.reload()}>Try again</button>
      </div>
    </div></div>
  );

  if (!quote) return null;

  const depositSuccess = searchParams.get('deposit') === 'success';
  const isSigned = Boolean(quote.signed_at);
  const isApproved = ['approved','approved_pending_deposit'].includes(quote.status);
  const waitingOnDeposit = quote.deposit_required && quote.deposit_status !== 'paid';
  const isDeclined = quote.status === 'declined';
  const isRevisionRequested = quote.status === 'revision_requested';
  const isCompleted = quote.status === 'completed';
  const isScheduled = quote.status === 'scheduled';
  const isClosedOut = ['invoiced', 'paid', 'expired'].includes(quote.status);
  const canAct = !isPreview && !isExpired && !isDeclined && !isCompleted && !isScheduled && !isSigned && !isApproved && !isClosedOut;
  const daysValid = quote.expires_at ? Math.max(0, Math.ceil((new Date(quote.expires_at) - new Date()) / 86400000)) : null;
  const discount = Number(quote.discount || 0);
  const hasDiscount = discount > 0;
  const hasTerms = Boolean(quote.terms_conditions?.trim());
  const conversation = Array.isArray(quote.conversation) ? quote.conversation : [];
  const canSign = canAct && !isRevisionRequested && (!hasTerms || termsAccepted);
  const contractorDisplayName = quote.contractor_company || quote.contractor_name || 'your contractor';

  const groupOrder = ['Labour', 'Materials', 'Services'];
  const sortedGroupKeys = Object.keys(groupedItems).sort((a, b) => {
    const ai = groupOrder.indexOf(a); const bi = groupOrder.indexOf(b);
    if (ai >= 0 && bi >= 0) return ai - bi; if (ai >= 0) return -1; if (bi >= 0) return 1;
    return a.localeCompare(b);
  });
  const showGroupHeaders = sortedGroupKeys.length > 1;

  return (
    <PublicPageShell contractorName={contractorDisplayName} logoUrl={quote.contractor_logo}>
    <div className="doc-shell">
      <div className="doc-container">
        {/* FIX #13: scroll target for success banners */}
        <div ref={topRef} />

        <div className="doc-card">

          {/* Preview banner */}
          {isPreview && (
            <div className="pq-preview-banner">
              <span style={{ fontSize: 16 }}>👁</span>
              <div><strong>Preview mode</strong> — this is what your customer will see. Actions are disabled.</div>
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

          {actionDone === 'approved' && (
            <div className="pq-success-banner">
              <div className="pq-success-check">✓</div>
              <div><strong style={{ display: 'block', fontSize: 16 }}>Quote signed and approved</strong>
              <span style={{ fontSize: 13, opacity: .85 }}>{contractorDisplayName} has been notified and will be in touch to confirm scheduling.</span></div>
            </div>
          )}
          {actionDone === 'question' && (
            <div className="pq-success-banner pq-success-banner--blue">
              <div className="pq-success-check" style={{ background: 'var(--doc-blue-soft)', color: 'var(--doc-blue)' }}>💬</div>
              <div><strong style={{ display: 'block' }}>Question sent</strong><span style={{ fontSize: 13, opacity: .85 }}>{contractorDisplayName} will reply directly — check your email.</span></div>
            </div>
          )}
          {actionDone === 'revision_requested' && (
            <div className="pq-success-banner pq-success-banner--amber">
              <div className="pq-success-check" style={{ background: '#fef3c7', color: '#92400e' }}>✏️</div>
              <div><strong style={{ display: 'block' }}>Changes requested</strong><span style={{ fontSize: 13, opacity: .85 }}>{contractorDisplayName} will revise the quote and send you an updated version.</span></div>
            </div>
          )}
          {actionDone === 'decline' && (
            <div className="pq-success-banner pq-success-banner--muted">
              <div className="pq-success-check" style={{ background: '#f4f4f5', color: '#71717a' }}>✕</div>
              <div><strong style={{ display: 'block' }}>Quote declined</strong><span style={{ fontSize: 13, opacity: .85 }}>{contractorDisplayName} has been notified.</span></div>
            </div>
          )}

          {!actionDone && isSigned && <div className="doc-status doc-status--approved"><span className="doc-status-icon">✓</span><span>Signed and approved{quote.signer_name ? ` by ${quote.signer_name}` : ''}{quote.signed_at ? ` · ${formatDate(quote.signed_at)}` : ''}</span></div>}
          {!actionDone && isApproved && !isSigned && <div className="doc-status doc-status--approved"><span className="doc-status-icon">✓</span><span>Quote approved{waitingOnDeposit ? ' — deposit required to proceed' : ''}</span></div>}
          {!actionDone && isRevisionRequested && <div className="doc-status doc-status--info"><span className="doc-status-icon">📝</span><span>Changes requested — {contractorDisplayName} will send an update</span></div>}
          {!actionDone && isDeclined && <div className="doc-status doc-status--warning"><span className="doc-status-icon">✗</span><span>Quote declined</span></div>}
          {!actionDone && isClosedOut && !isSigned && <div className="doc-status doc-status--approved"><span className="doc-status-icon">✓</span><span>This job has been completed.</span></div>}
          {depositSuccess && <div className="doc-status doc-status--approved"><span className="doc-status-icon">✓</span><span>Deposit received — thank you!</span></div>}

          {quote.revision_summary && <div className="doc-revision"><strong>Updated:</strong> {quote.revision_summary}</div>}

          {/* ── Project hero ── */}
          <div className="doc-hero">
            <h1 className="doc-title">{quote.title || 'Work Quote'}</h1>
            <div className="doc-customer">Prepared for <strong>{quote.customer_name || 'you'}</strong></div>
            {quote.customer_address && <div className="doc-address">{quote.customer_address}</div>}
            <div className="doc-meta-grid">
              <div className="doc-meta-item"><div className="doc-meta-label">Quote date</div><div className="doc-meta-value">{formatDate(quote.created_at)}</div></div>
              <div className="doc-meta-item"><div className="doc-meta-label">Valid until</div><div className={`doc-meta-value ${isExpired ? 'doc-meta-value--danger' : daysValid !== null && daysValid <= 3 ? 'doc-meta-value--danger' : ''}`}>{quote.expires_at ? formatDate(quote.expires_at) : 'No expiry'}{daysValid !== null && daysValid <= 3 && daysValid >= 0 && !isExpired ? ` (${daysValid}d left)` : ''}</div></div>
              {quote.trade && <div className="doc-meta-item"><div className="doc-meta-label">Trade</div><div className="doc-meta-value">{quote.trade}</div></div>}
              {quote.schedule_window && <div className="doc-meta-item"><div className="doc-meta-label">Availability</div><div className="doc-meta-value">{quote.schedule_window}</div></div>}
            </div>
          </div>

          {/* Scope summary */}
          {quote.scope_summary && <div className="doc-section"><h2 className="doc-section-title">Scope of Work</h2><div className="doc-section-body"><p>{quote.scope_summary}</p></div></div>}

          {/* Line items */}
          <div className="doc-items">
            <div className="doc-items-header"><h2 className="doc-section-title">Work Breakdown</h2></div>
            {sortedGroupKeys.map(category => (
              <div key={category} className="doc-group">
                {showGroupHeaders && <div className="doc-group-label">{category}</div>}
                {groupedItems[category].map(item => (
                  <div key={item.id} className="doc-item">
                    <div className="doc-item-left">
                      <div className="doc-item-name">{item.name}</div>
                      {item.notes && <div className="doc-item-note">{item.notes}</div>}
                      {Number(item.quantity) > 1 && <div className="doc-item-qty">{item.quantity} × {currency(item.unit_price)}</div>}
                    </div>
                    <div className="doc-item-right">{currency(Number(item.quantity || 1) * Number(item.unit_price || 0))}</div>
                  </div>
                ))}
              </div>
            ))}

            {optionalItems.length > 0 && (
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
            )}
          </div>

          {/* Totals */}
          <div className="doc-totals"><div className="doc-totals-inner">
            <div className="doc-total-row"><span>Subtotal</span><strong>{currency(quote.subtotal || quote.total)}</strong></div>
            {hasDiscount && <div className="doc-total-row doc-total-row--discount"><span>Discount</span><strong>−{currency(discount)}</strong></div>}
            {Number(quote.tax) > 0 && <div className="doc-total-row"><span>Tax</span><strong>{currency(quote.tax)}</strong></div>}
            {selectedOptionalsTotal > 0 && <div className="doc-total-row" style={{ color: '#ea580c' }}><span>Selected add-ons</span><strong>+{currency(selectedOptionalsTotal)}</strong></div>}
            <div className="doc-total-row doc-total-row--grand"><span>Total</span><strong>{currency(displayTotal)}</strong></div>
            {quote.deposit_required && Number(quote.deposit_amount) > 0 && (
              <div className="doc-total-row doc-total-row--deposit">
                <span>{quote.deposit_status === 'paid' ? '✓ Deposit paid' : 'Deposit to confirm'}</span>
                <strong>{currency(quote.deposit_amount)}</strong>
              </div>
            )}
          </div></div>

          {/* Info blocks */}
          {(quote.assumptions || quote.exclusions || quote.payment_instructions || effectivePaymentMethods.length > 0) && (
            <div className="doc-info-grid">
              {quote.assumptions && <div className="doc-info-block"><div className="doc-info-label">What this price assumes</div><div className="doc-info-body"><p>{quote.assumptions}</p></div></div>}
              {quote.exclusions && <div className="doc-info-block"><div className="doc-info-label">Not included</div><div className="doc-info-body"><p>{quote.exclusions}</p></div></div>}
              {(quote.payment_instructions || effectivePaymentMethods.length > 0) && (
                <div className="doc-info-block"><div className="doc-info-label">Payment</div><div className="doc-info-body">
                  {quote.payment_instructions && <p>{quote.payment_instructions}</p>}
                  {effectivePaymentMethods.length > 0 && <div className="doc-payment-methods">{effectivePaymentMethods.map(m => <span key={m} className="doc-payment-tag">{m}</span>)}</div>}
                  {quote.etransfer_email && <p style={{ marginTop: 8, fontSize: 12 }}>E-Transfer: {quote.etransfer_email}</p>}
                </div></div>
              )}
            </div>
          )}

          {/* Terms */}
          {hasTerms && !isSigned && (
            <div style={{ padding: '0 28px' }}>
              <TermsSection terms={quote.terms_conditions} accepted={termsAccepted} onToggle={setTermsAccepted} />
            </div>
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
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--doc-muted)', marginBottom: 8 }}>Customer Acceptance</div>
              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <img src={quote.signature_data} alt="Signature" style={{ maxHeight: 60, maxWidth: 200 }} />
                  <div style={{ borderTop: '1px solid var(--doc-border)', paddingTop: 4, marginTop: 4, fontSize: 12, color: 'var(--doc-text)' }}>{quote.signer_name}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--doc-muted)' }}>Signed {formatDate(quote.signed_at)}</div>
              </div>
            </div>
          )}

          {/* FIX #9: Stronger trust signals with contractor name, no "Questions?" collision */}
          <div className="doc-signals">
            {!isExpired && daysValid !== null && daysValid > 0 && <div className="doc-signal">This quote is valid for {daysValid} more day{daysValid !== 1 ? 's' : ''}</div>}
            {!isExpired && canAct && !isApproved && <div className="doc-signal">Signing is free — no payment required until work begins</div>}
            {quote.contractor_phone && <div className="doc-signal">Reach {contractorDisplayName} directly at {quote.contractor_phone}</div>}
            {canAct && !isApproved && effectivePaymentMethods.length > 0 && <div className="doc-signal">Accepted payment: {effectivePaymentMethods.join(', ')}</div>}
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
                  <p style={{ margin: '4px 0 0', fontSize: 13, opacity: .85 }}>{contractorDisplayName} will begin work after deposit is received.</p>
                </div>
                {(quote.contractor_stripe_link || quote.square_payment_link || quote.paypal_link) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                    {quote.contractor_stripe_link && <a href={quote.contractor_stripe_link} target="_blank" rel="noreferrer" className="doc-cta-primary" style={{ textDecoration: 'none', textAlign: 'center' }}>Pay {currency(quote.deposit_amount)} Online →</a>}
                    {quote.square_payment_link && <a href={quote.square_payment_link} target="_blank" rel="noreferrer" className="doc-cta-primary" style={{ background: 'var(--doc-text)', textDecoration: 'none', textAlign: 'center' }}>Pay via Square</a>}
                    {quote.paypal_link && <a href={quote.paypal_link.startsWith('http') ? quote.paypal_link : `https://paypal.me/${quote.paypal_link}`} target="_blank" rel="noreferrer" className="doc-cta-primary" style={{ background: '#0070ba', textDecoration: 'none', textAlign: 'center' }}>Pay via PayPal</a>}
                  </div>
                )}
                {(quote.payment_instructions || effectivePaymentMethods.length > 0 || quote.etransfer_email) && (
                  <div style={{ marginTop: 10, fontSize: 13, color: 'var(--doc-muted)', lineHeight: 1.6 }}>
                    {(quote.contractor_stripe_link || quote.square_payment_link || quote.paypal_link) && <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Or pay directly:</div>}
                    {quote.payment_instructions && <p style={{ margin: '0 0 6px' }}>{quote.payment_instructions}</p>}
                    {effectivePaymentMethods.length > 0 && <div className="doc-payment-methods">{effectivePaymentMethods.map(m => <span key={m} className="doc-payment-tag">{m}</span>)}</div>}
                    {quote.etransfer_email && <p style={{ marginTop: 6 }}>E-Transfer to: <strong>{quote.etransfer_email}</strong></p>}
                    {quote.venmo_zelle_handle && <p style={{ marginTop: 4 }}>Venmo/Zelle: <strong>{quote.venmo_zelle_handle}</strong></p>}
                  </div>
                )}
              </div>
            )}

            {/* Download signed copy */}
            {isSigned && !isPreview && (
              <button className="doc-cta-secondary" type="button" onClick={downloadSignedPdf}>⬇ Download Signed Copy</button>
            )}

            {/* FIX #16, #19: Signature area with total context */}
            <div ref={signRef}>
              {/* PRIMARY: Sign & Approve */}
              {canAct && !isApproved && !isRevisionRequested && !showSignature && (
                <button className="doc-cta-primary" type="button" onClick={openSignature} disabled={!canSign}
                  title={hasTerms && !termsAccepted ? 'Please accept the terms & conditions first' : ''}>
                  {hasTerms && !termsAccepted ? '🔒 Accept Terms to Sign' : 'Sign & Approve Quote'}
                </button>
              )}

              {/* FIX #17, #19: Signature pad with pre-filled name and total display */}
              {showSignature && (
                <div className="pq-sign-context">
                  <div className="pq-sign-total-bar">
                    <span>You are approving</span>
                    <strong>{currency(displayTotal)}</strong>
                  </div>
                  <SignaturePad
                    onSave={submitSignature}
                    onCancel={() => setShowSignature(false)}
                    hasTerms={hasTerms}
                    termsAccepted={termsAccepted}
                    saveLabel="Sign & Approve Quote"
                    legalText={`By signing, you authorize ${contractorDisplayName} to proceed with the work described above at the quoted price.`}
                    defaultName={quote.customer_name || ''}
                  />
                  {error && <div style={{ color: 'var(--doc-red)', fontSize: 13, textAlign: 'center', padding: '8px 16px' }}>{error}</div>}
                </div>
              )}
            </div>

            {/* FIX #11: Secondary actions — responsive, wraps on small screens */}
            {canAct && !showSignature && (
              <div className="pq-secondary-actions">
                <div className="pq-secondary-label">Not ready to sign?</div>
                <div className="pq-secondary-buttons">
                  <button className="pq-btn-secondary" type="button" onClick={() => setActiveSheet('question')}>💬 Ask a question</button>
                  <button className="pq-btn-secondary" type="button" onClick={() => setActiveSheet('changes')}>✏️ Request changes</button>
                </div>
              </div>
            )}

            {/* Question for signed/approved quotes */}
            {!canAct && !isPreview && !isCompleted && !isScheduled && !isClosedOut && (isSigned || isApproved) && (
              <button className="pq-btn-secondary" type="button" onClick={() => setActiveSheet('question')} style={{ width: '100%' }}>💬 Ask a question</button>
            )}

            {/* Decline */}
            {canAct && !isApproved && !isDeclined && !showSignature && (
              <button className="pq-btn-decline" type="button" onClick={() => setActiveSheet('decline')}>Decline this quote</button>
            )}

            {error && !showSignature && <div style={{ color: 'var(--doc-red)', fontSize: 13, textAlign: 'center', marginTop: 6 }}>{error}</div>}
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

      {/* FIX #16: Mobile sticky CTA stays during signing to show total */}
      {canAct && !isApproved && !isRevisionRequested && !isExpired && (
        <div className="doc-sticky-cta">
          <div className="doc-sticky-total">{currency(displayTotal)}</div>
          {!showSignature ? (
            <button className="doc-cta-primary" type="button" onClick={openSignature} disabled={!canSign}>
              {hasTerms && !termsAccepted ? '🔒 Accept Terms' : 'Sign & Approve'}
            </button>
          ) : (
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--doc-accent)', textAlign: 'center', flex: 1 }}>Complete signature above ↑</div>
          )}
        </div>
      )}
      {waitingOnDeposit && isApproved && !isPreview && (
        <div className="doc-sticky-cta">
          <div className="doc-sticky-total">Deposit: {currency(quote.deposit_amount)}</div>
          {quote.contractor_stripe_link ? (
            <a href={quote.contractor_stripe_link} target="_blank" rel="noreferrer" className="doc-cta-primary" style={{ textDecoration: 'none', textAlign: 'center' }}>Pay {currency(quote.deposit_amount)} →</a>
          ) : quote.square_payment_link ? (
            <a href={quote.square_payment_link} target="_blank" rel="noreferrer" className="doc-cta-primary" style={{ textDecoration: 'none', textAlign: 'center' }}>Pay via Square</a>
          ) : quote.paypal_link ? (
            <a href={quote.paypal_link.startsWith('http') ? quote.paypal_link : `https://paypal.me/${quote.paypal_link}`} target="_blank" rel="noreferrer" className="doc-cta-primary" style={{ textDecoration: 'none', textAlign: 'center' }}>Pay via PayPal</a>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--doc-muted)' }}>{effectivePaymentMethods.length > 0 ? `Pay via ${effectivePaymentMethods.join(', ')}` : `Contact ${contractorDisplayName}`}</span>
          )}
        </div>
      )}
      </div>
    </div>

    {activeSheet && <ActionSheet type={activeSheet} onSubmit={handleSheetSubmit} onClose={() => setActiveSheet(null)} sending={sending} />}

    </PublicPageShell>
  );
}
