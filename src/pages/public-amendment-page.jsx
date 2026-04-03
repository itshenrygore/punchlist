import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { currency as formatCurrency, formatDate } from '../lib/format';
import PublicPageShell from '../components/public-page-shell';
import SignaturePad from '../components/signature-pad';
import '../styles/document.css';

/* ── Main Public Amendment Page ── */
export default function PublicAmendmentPage() {
  const { shareToken } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [mode, setMode] = useState(null); // 'sign' | 'decline' | null
  const [sending, setSending] = useState(false);
  const [actionDone, setActionDone] = useState('');

  useEffect(() => {
    fetch(`/api/public-amendment?token=${shareToken}`)
      .then(async r => {
        const text = await r.text();
        let j;
        try { j = JSON.parse(text); } catch { throw new Error('Server error'); }
        if (!r.ok) throw new Error(j.error || 'Amendment not found');
        return j;
      })
      .then(setData)
      .catch(e => setError(e.message || 'Could not load amendment'))
      .finally(() => setLoading(false));
  }, [shareToken]);

  async function submitSignature(sigData) {
    setSending(true); setError('');
    try {
      const r = await fetch('/api/public-amendment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: shareToken, action: 'approve', ...sigData }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || 'Failed');
      setData(prev => ({
        ...prev,
        amendment: {
          ...prev.amendment,
          status: 'approved',
          signed_at: new Date().toISOString(),
          signature_data: sigData.signature_data,
          signer_name: sigData.signer_name,
        },
      }));
      setMode(null);
      setActionDone('approved');
    } catch (e) { setError(e.message || 'Could not submit'); }
    finally { setSending(false); }
  }

  async function submitDecline() {
    setSending(true); setError('');
    try {
      const r = await fetch('/api/public-amendment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: shareToken, action: 'decline' }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || 'Failed');
      setData(prev => ({
        ...prev,
        amendment: { ...prev.amendment, status: 'declined' },
      }));
      setMode(null);
      setActionDone('declined');
    } catch (e) { setError(e.message || 'Could not submit'); }
    finally { setSending(false); }
  }

  const currency = useCallback((n) => formatCurrency(n, data?.amendment?.country || data?.quote?.country || 'CA'), [data]);

  if (loading) return (
    <div className="doc-shell"><div className="doc-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', color: 'var(--doc-muted)' }}><div className="loading-spinner" style={{ margin: '0 auto 12px' }} />Loading amendment…</div>
    </div></div>
  );

  if (error && !data) return (
    <div className="doc-shell"><div className="doc-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>🔗</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>Amendment unavailable</h2>
        <p style={{ fontSize: 14, color: 'var(--doc-muted)', lineHeight: 1.6, margin: '0 0 20px' }}>This link may be invalid or expired. Contact your contractor.</p>
        <button className="doc-cta-secondary" onClick={() => window.location.reload()}>Try again</button>
        <p style={{ marginTop: 16, fontSize: 11, color: 'var(--doc-muted)' }}>{error}</p>
      </div>
    </div></div>
  );

  if (!data) return null;

  const { amendment, quote } = data;
  const isSigned = Boolean(amendment.signed_at);
  const isApproved = amendment.status === 'approved';
  const isDeclined = amendment.status === 'declined';
  const canAct = !isSigned && !isApproved && !isDeclined && ['sent', 'viewed'].includes(amendment.status);

  // Group original quote line items
  const origItems = (quote.line_items || []).filter(i => i.included !== false);
  const origGrouped = {};
  origItems.forEach(item => {
    const key = item.category || 'Scope';
    origGrouped[key] = origGrouped[key] || [];
    origGrouped[key].push(item);
  });

  return (
    <PublicPageShell contractorName={data.contractor_company || data.contractor_name} logoUrl={data.contractor_logo}>
    <div className="doc-shell">
      <div className="doc-container">
        <div className="doc-card">

          {/* Header */}
          <div className="doc-header">
            <div className="doc-brand">
              {data.contractor_logo && <img src={data.contractor_logo} alt="" className="doc-logo" />}
              <div className="doc-company">{data.contractor_company || data.contractor_name || 'Your Contractor'}</div>
              <div className="doc-contact">
                {data.contractor_phone && <a href={`tel:${data.contractor_phone}`}>{data.contractor_phone}</a>}
                {data.contractor_email && <a href={`mailto:${data.contractor_email}`}>{data.contractor_email}</a>}
              </div>
            </div>
            <div className="doc-meta">
              <div className="doc-type">Amendment</div>
              <div className="doc-date">{formatDate(amendment.created_at)}</div>
            </div>
          </div>

          {/* Status banners */}
          {isApproved && (
            <div className="doc-status doc-status--approved">
              <span className="doc-status-icon">✓</span>
              <span>Amendment signed and approved{amendment.signer_name ? ` by ${amendment.signer_name}` : ''}{amendment.signed_at ? ` on ${formatDate(amendment.signed_at)}` : ''}</span>
            </div>
          )}
          {isDeclined && (
            <div className="doc-status doc-status--warning">
              <span className="doc-status-icon">✗</span>
              <span>Amendment declined — original scope unchanged</span>
            </div>
          )}
          {actionDone === 'approved' && (
            <div className="doc-status doc-status--approved">
              <span className="doc-status-icon">✓</span>
              <span>Amendment approved! Your contractor has been notified.</span>
            </div>
          )}
          {actionDone === 'declined' && (
            <div className="doc-status doc-status--warning">
              <span className="doc-status-icon">✗</span>
              <span>Amendment declined. Your original scope is unchanged.</span>
            </div>
          )}

          <div className="doc-body">

            {/* Customer info */}
            {data.customer_name && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--doc-muted)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, marginBottom: 4 }}>Prepared for</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{data.customer_name}</div>
              </div>
            )}

            {/* ═══ SECTION 1: ORIGINAL SIGNED SCOPE ═══ */}
            <div style={{ marginBottom: 28, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: '-.02em' }}>Original Scope</h2>
                {quote.signed_at && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', fontSize: 11, fontWeight: 700,
                    background: 'var(--doc-green-soft)', color: 'var(--doc-green)', borderRadius: 6, border: '1px solid rgba(22,163,74,.2)' }}>
                    ✓ SIGNED
                  </span>
                )}
              </div>

              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{quote.title}</div>
              {quote.scope_summary && <p style={{ fontSize: 13, color: 'var(--doc-text-2)', marginBottom: 12, lineHeight: 1.6 }}>{quote.scope_summary}</p>}

              {/* Original line items — read only, muted */}
              <div style={{ opacity: 0.8 }}>
                {Object.entries(origGrouped).map(([group, items]) => (
                  <div key={group} style={{ marginBottom: 6 }}>
                    {Object.keys(origGrouped).length > 1 && (
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--doc-muted)', marginBottom: 4, marginTop: 8 }}>{group}</div>
                    )}
                    {items.map(item => (
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
              </div>

              {/* Original totals */}
              <div className="doc-totals" style={{ opacity: 0.8 }}>
                <div className="doc-total-row"><span>Original Subtotal</span><span>{currency(quote.subtotal)}</span></div>
                <div className="doc-total-row"><span>Tax</span><span>{currency(quote.tax)}</span></div>
                <div className="doc-total-row doc-total-grand"><span>Original Total</span><span>{currency(quote.total)}</span></div>
              </div>

              {/* Signed indicator */}
              {quote.signature_data && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '10px 14px', background: 'var(--doc-green-soft)', borderRadius: 8, border: '1px solid rgba(22,163,74,.15)' }}>
                  <img src={quote.signature_data} alt="Original signature" style={{ maxHeight: 32, maxWidth: 120 }} />
                  <div style={{ fontSize: 12, color: 'var(--doc-green)' }}>
                    Signed by {quote.signer_name || 'Customer'} · {formatDate(quote.signed_at)}
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--doc-line)', margin: '24px 0' }} />

            {/* ═══ SECTION 2: PROPOSED AMENDMENT ═══ */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--doc-accent)' }}>Proposed Amendment</h2>
                {isSigned && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', fontSize: 11, fontWeight: 700,
                    background: 'var(--doc-green-soft)', color: 'var(--doc-green)', borderRadius: 6, border: '1px solid rgba(22,163,74,.2)' }}>
                    ✓ SIGNED
                  </span>
                )}
              </div>

              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{amendment.title}</div>
              {amendment.reason && <p style={{ fontSize: 13, color: 'var(--doc-text-2)', marginBottom: 12, lineHeight: 1.6, fontStyle: 'italic' }}>Reason: {amendment.reason}</p>}

              {/* Amendment line items */}
              {(amendment.items || []).map((item, idx) => (
                <div key={idx} className="doc-item" style={{ borderLeft: '3px solid var(--doc-accent)' }}>
                  <div className="doc-item-left">
                    <div className="doc-item-name">{item.name}</div>
                    {item.notes && <div className="doc-item-note">{item.notes}</div>}
                    {Number(item.quantity) > 1 && <div className="doc-item-qty">{item.quantity} × {currency(item.unit_price)}</div>}
                  </div>
                  <div className="doc-item-right" style={{ color: 'var(--doc-accent)', fontWeight: 700 }}>
                    +{currency(Number(item.quantity || 1) * Number(item.unit_price || 0))}
                  </div>
                </div>
              ))}

              {/* Amendment totals */}
              <div className="doc-totals">
                <div className="doc-total-row"><span>Amendment Subtotal</span><span style={{ color: 'var(--doc-accent)' }}>+{currency(amendment.subtotal)}</span></div>
                <div className="doc-total-row"><span>Tax</span><span>+{currency(amendment.tax)}</span></div>
                <div className="doc-total-row doc-total-grand"><span>Amendment Total</span><span style={{ color: 'var(--doc-accent)' }}>+{currency(amendment.total)}</span></div>
              </div>

              {/* Amendment signature (if signed) */}
              {amendment.signature_data && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '10px 14px', background: 'var(--doc-green-soft)', borderRadius: 8, border: '1px solid rgba(22,163,74,.15)' }}>
                  <img src={amendment.signature_data} alt="Amendment signature" style={{ maxHeight: 32, maxWidth: 120 }} />
                  <div style={{ fontSize: 12, color: 'var(--doc-green)' }}>
                    Signed by {amendment.signer_name || 'Customer'} · {formatDate(amendment.signed_at)}
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--doc-line)', margin: '24px 0' }} />

            {/* ═══ COMBINED NEW TOTAL ═══ */}
            <div className="doc-totals">
              <div className="doc-total-row"><span>Original Total</span><span>{currency(quote.total)}</span></div>
              <div className="doc-total-row"><span>Amendment</span><span style={{ color: 'var(--doc-accent)' }}>+{currency(amendment.total)}</span></div>
              <div className="doc-total-row doc-total-grand" style={{ fontSize: 18 }}>
                <span>New Total</span>
                <span>{currency(Number(quote.total || 0) + Number(amendment.total || 0))}</span>
              </div>
            </div>

            {/* Error display */}
            {error && <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--doc-red-soft)', borderRadius: 8, fontSize: 13, color: 'var(--doc-red)' }}>{error}</div>}

            {/* ═══ ACTION BUTTONS ═══ */}
            {canAct && !mode && (
              <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
                <button className="doc-cta-primary" style={{ flex: 1 }} onClick={() => setMode('sign')}>
                  Sign & Approve Amendment
                </button>
                <button className="doc-cta-secondary" onClick={() => setMode('decline')}>
                  Decline
                </button>
              </div>
            )}

            {/* Sign mode */}
            {mode === 'sign' && (
              <div style={{ marginTop: 24 }}>
                <SignaturePad
                  onSave={submitSignature}
                  onCancel={() => setMode(null)}
                  saveLabel="Sign & Approve Amendment"
                  legalText="By signing, you agree to the additional scope and pricing in this amendment."
                />
              </div>
            )}

            {/* Decline confirmation */}
            {mode === 'decline' && (
              <div style={{ marginTop: 24, padding: '20px', background: 'var(--doc-red-soft)', borderRadius: 10, textAlign: 'center' }}>
                <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Decline this amendment?</p>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--doc-muted)' }}>Your original signed scope will remain unchanged.</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button className="doc-cta-secondary" style={{ background: 'var(--doc-red)', color: '#fff', border: 'none' }} disabled={sending} onClick={submitDecline}>
                    {sending ? 'Declining…' : 'Confirm Decline'}
                  </button>
                  <button className="doc-cta-secondary" onClick={() => setMode(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </PublicPageShell>
  );
}
