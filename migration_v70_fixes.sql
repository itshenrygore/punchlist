import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { currency as formatCurrency, formatDate } from '../lib/format';
import PublicPageShell from '../components/public-page-shell';
import SignaturePad from '../components/signature-pad';
import AmendmentDiff from '../components/amendment-diff';
import PublicLoadingState from '../components/public-loading-state';
import PublicErrorState from '../components/public-error-state';
import '../styles/document.css';
import { estimateMonthly, showFinancing } from '../lib/financing';

/* ═══════════════════════════════════════════════════════════════════════════
   PUNCHLIST — Public Amendment Page (M6 §6.3)
   Merges original quote + amendment into a single timeline document.
   Customer sees: Pricing hero → Combined diff (original + delta) → Sign CTA.
   ═══════════════════════════════════════════════════════════════════════════ */

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

  const country = data?.amendment?.country || data?.quote?.country || 'CA';
  const currency = useCallback((n) => formatCurrency(n, country), [country]);

  if (loading) return <PublicLoadingState label="Loading amendment…" />;

  if (error && !data) return (
    <PublicErrorState
      docType="amendment"
      contractorName={null}
      onRetry={() => window.location.reload()}
    />
  );

  if (!data) return null;

  const { amendment, quote } = data;
  const contractorName = data.contractor_company || data.contractor_name || 'Your Contractor';
  const isSigned = Boolean(amendment.signed_at);
  const isApproved = amendment.status === 'approved';
  const isDeclined = amendment.status === 'declined';
  const canAct = !isSigned && !isApproved && !isDeclined && ['sent', 'viewed'].includes(amendment.status);
  const newTotal = Number(quote.total || 0) + Number(amendment.total || 0);

  return (
    <PublicPageShell contractorName={contractorName} logoUrl={data.contractor_logo}>
    <div className="doc-shell">
      <div className="doc-container">
        <div className="doc-card">

          {/* Header */}
          <div className="doc-header">
            <div className="doc-brand">
              {data.contractor_logo && <img src={data.contractor_logo} alt="" className="doc-logo" />}
              <div className="doc-company">{contractorName}</div>
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
          {isApproved && !actionDone && (
            <div className="doc-status doc-status--approved">
              <span className="doc-status-icon" style={{display:"inline-flex"}}><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
              <span>Amendment signed and approved{amendment.signer_name ? ` by ${amendment.signer_name}` : ''}{amendment.signed_at ? ` on ${formatDate(amendment.signed_at)}` : ''}</span>
            </div>
          )}
          {isDeclined && !actionDone && (
            <div className="doc-status doc-status--warning">
              <span className="doc-status-icon">✗</span>
              <span>Amendment declined — original scope unchanged</span>
            </div>
          )}
          {actionDone === 'approved' && (
            <div className="doc-status doc-status--approved">
              <span className="doc-status-icon" style={{display:"inline-flex"}}><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
              <span>Amendment approved! {contractorName} has been notified.</span>
            </div>
          )}
          {actionDone === 'declined' && (
            <div className="doc-status doc-status--warning">
              <span className="doc-status-icon">✗</span>
              <span>Amendment declined. Your original scope is unchanged.</span>
            </div>
          )}

          <div className="doc-body">

            {/* Customer */}
            {data.customer_name && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--doc-muted)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, marginBottom: 4 }}>Prepared for</div>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>{data.customer_name}</div>
              </div>
            )}

            {/* Pricing hero */}
            <div style={{ textAlign: 'center', padding: '20px 0 16px' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--doc-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>Revised total</div>
              <div style={{ fontSize: 'var(--text-5xl)', fontWeight: 900, letterSpacing: '-.04em', color: 'var(--doc-accent, #ea580c)' }}>{currency(newTotal)}</div>
              {showFinancing(newTotal) && (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--doc-muted)', marginTop: 6 }}>
                  or as low as {currency(estimateMonthly(newTotal))}/mo · subject to approval
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10, fontSize: 'var(--text-xs)', color: 'var(--doc-muted)', flexWrap: 'wrap' }}>
                <span>No payment now</span>
                <span>Price locked in once you sign</span>
              </div>
            </div>

            {/* §6.3 Combined diff view — original + delta in one document */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--doc-muted)', marginBottom: 8 }}>
                What's changing
              </div>
              <AmendmentDiff
                quote={quote}
                amendment={amendment}
                country={country}
              />
            </div>

            {/* Error */}
            {error && (
              <div style={{ padding: '12px 16px', background: 'var(--doc-red-soft)', borderRadius: 8, fontSize: 'var(--text-sm)', color: 'var(--doc-red)', marginBottom: 12 }}>{error}</div>
            )}

            {/* Action buttons */}
            {canAct && !mode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
                <button type="button"
                  className="doc-cta-primary"
                  style={{ fontSize: 'var(--text-lg)', padding: '14px 20px', fontWeight: 700 }}
                  onClick={() => setMode('sign')}
                >
                  Sign & Approve Amendment
                </button>
                <div style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--doc-muted)' }}>
                  No payment now · Original scope remains if you decline
                </div>
                <button type="button" className="doc-cta-secondary" style={{ textAlign: 'center' }} onClick={() => setMode('decline')}>
                  Decline this amendment
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
                  legalText={`By signing, you agree to the additional scope and pricing in this amendment. New total: ${currency(newTotal)}.`}
                />
              </div>
            )}

            {/* Decline confirmation */}
            {mode === 'decline' && (
              <div style={{ marginTop: 24, padding: '20px', background: 'var(--doc-red-soft)', borderRadius: 10, textAlign: 'center' }}>
                <p style={{ margin: '0 0 8px', fontSize: 'var(--text-md)', fontWeight: 700 }}>Decline this amendment?</p>
                <p style={{ margin: '0 0 16px', fontSize: 'var(--text-sm)', color: 'var(--doc-muted)' }}>Your original signed scope and pricing will remain unchanged.</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button type="button"
                    className="doc-cta-secondary"
                    style={{ background: 'var(--doc-red)', color: 'var(--always-white, #fff)', border: 'none' }}
                    disabled={sending}
                    onClick={submitDecline}
                  >
                    {sending ? 'Declining…' : 'Confirm Decline'}
                  </button>
                  <button type="button" className="doc-cta-secondary" onClick={() => setMode(null)}>Cancel</button>
                </div>
              </div>
            )}

            {/* Post-approval signed summary */}
            {(isApproved || actionDone === 'approved') && (
              <div style={{ marginTop: 20, padding: '16px', background: 'var(--doc-green-soft)', borderRadius: 10, border: '1px solid rgba(22,163,74,.2)' }}>
                <div style={{ fontWeight: 800, fontSize: "var(--text-md)", color: "var(--green)", marginBottom: 8 }}>Amendment approved</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--doc-text-2)', lineHeight: 1.6 }}>
                  {contractorName} has been notified. The amended scope is now in effect.
                </div>
                {amendment.signature_data && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                    <img src={amendment.signature_data} alt="Amendment signature" style={{ maxHeight: 36, maxWidth: 140 }} />
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--green)' }}>
                      Signed by {amendment.signer_name || 'Customer'} · {formatDate(amendment.signed_at)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="doc-footer">
            <div>
              <div style={{ fontWeight: 600, color: 'var(--doc-text)' }}>{contractorName}</div>
              {data.contractor_phone && <div style={{ marginTop: 2 }}>{data.contractor_phone}</div>}
              {data.contractor_email && <div style={{ marginTop: 2 }}>{data.contractor_email}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Mobile sticky approve CTA */}
    {canAct && !mode && (
      <div className="doc-sticky-cta">
        <div className="doc-sticky-total">{currency(newTotal)}</div>
        <button className="doc-cta-primary" type="button" onClick={() => setMode('sign')}>
          Sign & Approve
        </button>
      </div>
    )}

    </PublicPageShell>
  );
}
