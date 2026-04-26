import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, X, MessageSquare } from 'lucide-react';
import { currency as formatCurrency } from '../lib/format';
import PublicPageShell from '../components/public-page-shell';
import PublicLoadingState from '../components/public-loading-state';
import PublicErrorState from '../components/public-error-state';

export default function PublicAdditionalWorkPage() {
  const { shareToken } = useParams();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState(null); // 'question' | 'decline'
  const [feedback, setFeedback] = useState('');
  const [sending, setSending] = useState(false);
  const [actionDone, setActionDone] = useState('');
  
  // Country-aware currency formatter bound to request's country
  const currency = (n) => formatCurrency(n, request?.country);

  useEffect(() => {
    fetch(`/api/public-additional-work?token=${shareToken}`)
      .then(async r => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Could not load');
        return j.request;
      })
      .then(setRequest)
      .catch(e => setError('This request could not be loaded. Try refreshing the page.'))
      .finally(() => setLoading(false));
  }, [shareToken]);

  async function handleAction(action, body = {}) {
    setSending(true); setError('');
    try {
      const r = await fetch('/api/public-additional-work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: shareToken, action, ...body }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Could not process');
      setRequest(prev => ({ ...prev, status: data.status }));
      setMode(null); setFeedback(''); setActionDone(action);
    } catch (e) { setError('This request could not be loaded. Try refreshing the page.'); }
    finally { setSending(false); }
  }

  if (loading) return <PublicLoadingState label="Loading request…" />;

  if (error && !request) return (
    <PublicErrorState
      docType="additional-work"
      contractorName={null}
      onRetry={() => window.location.reload()}
    />
  );

  if (!request) return null;

  const items = request.additional_work_items || [];
  const isApproved = request.status === 'approved';
  const isDeclined = request.status === 'declined';
  const isNeedsReview = request.status === 'needs_review';
  const canAct = !isApproved && !isDeclined;

  const statusBanner = isApproved
    ? { bg: 'var(--green-bg)', border: 'rgba(21,128,61,.2)', Icon: Check, color: 'var(--green)', title: 'Additional work approved', sub: 'Your contractor will proceed with the extra work.' }
    : isNeedsReview
    ? { bg: 'var(--blue-bg)', border: 'rgba(72,120,208,.2)', Icon: MessageSquare, color: 'var(--blue)', title: 'Question sent', sub: 'Your contractor will reply to your question.' }
    : isDeclined
    ? { bg: 'var(--red-bg)', border: 'rgba(180,35,24,.15)', Icon: X, color: 'var(--red)', title: 'Additional work declined', sub: 'This extra work will not be performed.' }
    : null;

  return (
    <PublicPageShell contractorName={request.contractor_company || request.contractor_name} logoUrl={null}>
    <div className="doc-shell">

      <main className="container public-quote-layout">
        <section className="stack-lg">

          {/* Context banner */}
          <div className="panel" style={{ display: 'flex', gap: 12, padding: '14px 18px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div className="muted small" style={{ marginBottom: 3 }}>Original Quote</div>
              <div className="aw-status-label aw-status--approved">Approved</div>
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div className="muted small" style={{ marginBottom: 3 }}>Additional Work</div>
              <div className={`aw-status-label ${isApproved ? 'aw-status--approved' : isDeclined ? 'aw-status--declined' : 'aw-status--pending'}`}>
                {isApproved ? 'Approved' : isDeclined ? 'Declined' : isNeedsReview ? 'Question Sent' : 'Pending Approval'}
              </div>
            </div>
          </div>

          {statusBanner && (
            <div className="panel" style={{ background: statusBanner.bg, border: `1px solid ${statusBanner.border}`, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: statusBanner.color, display: 'inline-flex' }}><statusBanner.Icon size={20} /></span>
                <div>
                  <strong style={{ color: statusBanner.color, display: 'block' }}>{statusBanner.title}</strong>
                  <span className="muted small">{statusBanner.sub}</span>
                </div>
              </div>
            </div>
          )}

          {/* Hero card */}
          <div className="panel public-hero-card">
            <div className="eyebrow" style={{ color: 'var(--amber)' }}>Additional Work Approval</div>
            <h1 style={{ fontSize: 'clamp(1.3rem,3vw,1.8rem)', margin: '10px 0 14px', letterSpacing: '-.02em' }}>{request.title}</h1>

            <div className="quote-meta-grid public-quote-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
              <div><span className="muted small">Prepared for</span><div style={{ fontWeight: 600 }}>{request.customer_name || 'You'}</div></div>
              <div><span className="muted small">Related to</span><div style={{ fontWeight: 600 }}>{request.original_quote_title || 'Original quote'}</div></div>
              {request.contractor_phone && (
                <div><span className="muted small">Contact</span><div style={{ fontWeight: 600 }}><a href={`tel:${request.contractor_phone}`} style={{ color: 'var(--brand-dark)' }}>{request.contractor_phone}</a></div></div>
              )}
            </div>
          </div>

          {/* Reason / context */}
          {request.reason && (
            <div className="panel">
              <div className="eyebrow">Why this is needed</div>
              <p style={{ marginTop: 8, lineHeight: 1.65 }}>{request.reason}</p>
            </div>
          )}

          {/* Line items */}
          <div className="panel stack">
            <div className="eyebrow">Additional items</div>
            {items.map(item => (
              <div key={item.id} className="list-card">
                <div style={{ flex: 1 }}>
                  <strong>{item.name}</strong>
                  {item.notes && <div className="muted small" style={{ marginTop: 3 }}>{item.notes}</div>}
                </div>
                <div className="list-card-right" style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="muted small">{item.quantity} &times; {currency(item.unit_price)}</div>
                  <strong>{currency(Number(item.quantity || 0) * Number(item.unit_price || 0))}</strong>
                </div>
              </div>
            ))}
            <div className="totals-card" style={{ marginTop: 8 }}>
              <div className="total-row"><span>Additional subtotal</span><strong>{currency(request.subtotal)}</strong></div>
              <div className="total-row"><span>Tax</span><strong>{currency(request.tax)}</strong></div>
              <div className="total-row grand"><span>Additional total</span><strong>{currency(request.total)}</strong></div>
            </div>
            {request.original_quote_total && (
              <div className="aw-combined-total">
                <div className="muted small" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Original quote total</span>
                  <span>{currency(request.original_quote_total)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 6 }}>
                  <span>New combined total</span>
                  <span>{currency(Number(request.original_quote_total || 0) + Number(request.total || 0))}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Sidebar actions */}
        <aside className="stack-lg public-actions-sidebar">

          {actionDone === 'approve' && (
            <div className="notice-banner" style={{ background: 'var(--green-bg)', borderColor: 'rgba(21,128,61,.2)', color: 'var(--green)' }}>
              <strong>&check; Additional work approved.</strong> Your contractor will proceed.
            </div>
          )}
          {actionDone === 'question' && (
            <div className="notice-banner" style={{ background: 'var(--blue-bg)', borderColor: 'rgba(72,120,208,.2)', color: 'var(--blue)' }}>
              <strong>Question sent.</strong> Your contractor will reply directly.
            </div>
          )}
          {actionDone === 'decline' && (
            <div className="notice-banner" style={{ background: 'var(--red-bg)', borderColor: 'rgba(180,35,24,.15)', color: 'var(--red)' }}>
              <strong>Declined.</strong> This work will not be performed.
            </div>
          )}

          <div className="panel sticky-panel">
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              {isApproved ? 'Approved' : isDeclined ? 'Declined' : isNeedsReview ? 'Question sent' : 'Review additional work'}
            </div>
            <div className="muted small" style={{ marginBottom: 16, lineHeight: 1.55 }}>
              {isApproved ? 'Your contractor will proceed with the extra work.'
                : isDeclined ? 'This extra work will not be performed.'
                : isNeedsReview ? 'Your contractor will respond to your question.'
                : 'Approving confirms you accept the additional scope and cost.'}
            </div>
            <div className="stack">
              {canAct && !isNeedsReview && (
                <button className="btn btn-primary full-width" type="button" disabled={sending && !mode} onClick={() => handleAction('approve')}>
                  {sending && !mode ? 'Submitting\u2026' : 'Approve additional work'}
                </button>
              )}

              {canAct && (
                <>
                  <button className="btn btn-secondary full-width" type="button" onClick={() => { setMode(mode === 'question' ? null : 'question'); setFeedback(''); }}>
                    {mode === 'question' ? 'Cancel' : 'Ask a question'}
                  </button>
                  {mode === 'question' && (
                    <div className="stack" style={{ marginTop: 4 }}>
                      <textarea className="input textarea-md" value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="What would you like to know? Your contractor will reply directly." rows={3} />
                      <button className="btn btn-primary full-width" type="button" disabled={sending || !feedback.trim()} onClick={() => handleAction('question', { feedback })}>
                        {sending ? 'Sending\u2026' : 'Send question'}
                      </button>
                    </div>
                  )}
                </>
              )}

              {canAct && !isNeedsReview && (
                <>
                  <button className="btn btn-secondary full-width aw-decline-btn" type="button" onClick={() => { setMode(mode === 'decline' ? null : 'decline'); setFeedback(''); }}>
                    {mode === 'decline' ? 'Cancel' : 'Decline additional work'}
                  </button>
                  {mode === 'decline' && (
                    <div className="stack" style={{ marginTop: 4 }}>
                      <textarea className="input textarea-md" value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Optional: reason for declining." rows={2} />
                      <button className="btn btn-secondary full-width" type="button" style={{ color: 'var(--red)' }} disabled={sending} onClick={() => handleAction('decline', { feedback })}>
                        {sending ? '\u2026' : 'Confirm decline'}
                      </button>
                    </div>
                  )}
                </>
              )}

              {error && <div className="aw-error">{error}</div>}
            </div>
          </div>

          <div className="panel soft-panel">
            <div className="eyebrow">Prepared by</div>
            <div className="stack" style={{ marginTop: 8 }}>
              <div><strong>{request.contractor_name || 'Your contractor'}</strong></div>
              {request.contractor_company && <div className="muted small">{request.contractor_company}</div>}
              {request.contractor_phone && <a className="btn btn-secondary" href={`tel:${request.contractor_phone}`} style={{ textAlign: 'center' }}>{request.contractor_phone}</a>}
            </div>
          </div>

          {request.original_quote_token && (
            <a className="btn btn-secondary full-width" href={`/public/${request.original_quote_token}`} style={{ textAlign: 'center' }}>
              View original quote
            </a>
          )}
        </aside>

        {/* Mobile bottom bar */}
        {canAct && !isNeedsReview && (
          <div className="public-actions-mobile-bar">
            <button className="btn btn-primary" style={{ flex: 1 }} type="button" disabled={sending} onClick={() => handleAction('approve')}>
              {sending ? '\u2026' : 'Approve'}
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }} type="button" onClick={() => setMode(mode === 'question' ? null : 'question')}>
              Ask a question
            </button>
          </div>
        )}
        {(isApproved || isDeclined || isNeedsReview) && (
          <div className="public-actions-mobile-bar">
            <div className="aw-mobile-status">
              {isApproved ? 'Approved' : isDeclined ? 'Declined' : 'Question sent'}
            </div>
          </div>
        )}
      </main>
    </div>
    </PublicPageShell>
  );
}
