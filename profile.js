import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Phone, Mail } from 'lucide-react';
import AppShell from '../components/app-shell';
import { AdditionalWorkDetailSkeleton } from '../components/skeletons';
import StatusBadge from '../components/status-badge';
import { getAdditionalWork, friendly, updateAdditionalWork, deleteAdditionalWork, sendAdditionalWork, getProfile } from '../lib/api';
import { currency, formatDate } from '../lib/format';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../components/toast';
import { safeWriteClipboard } from '../lib/utils';
import { smsNotify } from '../lib/sms';

export default function AdditionalWorkDetailPage() {
  const { requestId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { show: toast } = useToast();
  const [awr, setAwr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!requestId) return;
    getAdditionalWork(requestId)
      .then(data => setAwr(data))
      .catch(e => toast(friendly(e), 'error'))
      .finally(() => setLoading(false));
  }, [requestId]);

  useEffect(() => {
    if (user) getProfile(user.id).then(setProfile).catch(e => console.warn('[PL]', e));
  }, [user]);

  const shareUrl = awr ? `${window.location.origin}/public/aw/${awr.share_token}` : '';
  const isDraft = awr?.status === 'draft';
  const isApproved = awr?.status === 'approved';
  const isDeclined = awr?.status === 'declined';
  const isNeedsReview = awr?.status === 'needs_review';
  const isSent = ['sent', 'viewed'].includes(awr?.status);

  async function handleSend() {
    try {
      const updated = await sendAdditionalWork(awr.id);
      setAwr(p => ({ ...p, ...updated, status: 'sent' }));

      const customerEmail = awr.customer?.email;
      if (customerEmail) {
        try {
          const r = await fetch('/api/send-quote-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'send_additional_work',
              customerEmail,
              customerName: awr.customer?.name || '',
              contractorName: profile?.company_name || profile?.full_name || '',
              contractorPhone: profile?.phone || '',
              title: awr.title || '',
              total: awr.total || 0,
              shareToken: awr.share_token,
              country: awr.quote?.province || profile?.country || 'CA',
            }),
          });
          if (r.ok) {
            toast('AWR emailed to ' + (awr.customer?.name || customerEmail), 'success');
            // SMS — notify customer about additional work request
            if (awr.customer?.phone && awr.share_token) {
              smsNotify.additionalWork({
                to: awr.customer.phone,
                contractorName: profile?.company_name || profile?.full_name || 'Your contractor',
                title: (awr.title || 'additional work').slice(0, 40),
                total: awr.total,
                shareToken: awr.share_token,
                country: awr.quote?.province || profile?.country || 'CA',
              });
            }
            return;
          }
        } catch (e) { console.warn("[PL]", e); }
      }

      // Fallback: mailto
      const to = customerEmail || '';
      if (!to) { toast('No email on file for this customer', 'error'); return; }
      const firstName = awr.customer?.name?.split(' ')[0] || '';
      const subject = encodeURIComponent(`Additional Work: ${awr.title}`);
      const body = encodeURIComponent(
        `Hi${firstName ? ' ' + firstName : ''},\n\nWhile working on your job, we identified some additional work that needs your approval:\n\n${shareUrl}\n\nPlease review and let me know if you have any questions.`
      );
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
      toast('Opening email…', 'info');
    } catch (e) { toast(friendly(e), 'error'); }
  }

  async function handleSendText() {
    try {
      if (awr.status === 'draft') {
        const updated = await sendAdditionalWork(awr.id);
        setAwr(p => ({ ...p, ...updated, status: 'sent' }));
      }
      const phone = awr.customer?.phone || '';
      if (!phone) { toast('No phone number on file for this customer', 'error'); return; }
      const firstName = awr.customer?.name?.split(' ')[0] || '';
      const msgBody = `Hi${firstName ? ' ' + firstName : ''}, we found some additional work on your job that needs your approval: ${shareUrl}`;
      const result = await smsNotify.customMessage({ to: phone, body: msgBody });
      if (result?.ok) {
        toast(`Texted to ${firstName || phone}`, 'success');
      } else {
        const body = encodeURIComponent(msgBody);
        window.open(`sms:${phone}?body=${body}`, '_self');
        toast('Opening messages…', 'info');
      }
    } catch (e) { toast(friendly(e), 'error'); }
  }

  async function handleCopyLink() {
    try {
      if (awr.status === 'draft') {
        const updated = await sendAdditionalWork(awr.id);
        setAwr(p => ({ ...p, ...updated, status: 'sent' }));
      }
      await safeWriteClipboard(shareUrl);
      toast('Link copied', 'success');
    } catch { toast('Copy failed', 'error'); }
  }

  async function handleDelete() {
    try { await deleteAdditionalWork(awr.id); toast('Deleted', 'success'); navigate(`/app/quotes/${awr.quote_id}`); }
    catch (e) { toast(friendly(e), 'error'); }
  }

  if (loading) return <AdditionalWorkDetailSkeleton />;
  if (!awr) return <AppShell title="Additional Work"><div className="empty-state">Request not found.</div></AppShell>;

  const items = awr.additional_work_items || [];

  return (
    <AppShell title="Additional Work" actions={
      <Link className="btn btn-secondary btn-sm" to={`/app/quotes/${awr.quote_id}`}>← Back to quote</Link>
    }>
      <div className="qd-grid">

        {/* ── LEFT ── */}
        <section className="qd-main">

          {/* Customer message / needs review */}
          {isNeedsReview && awr.customer_message && (
            <div className="comm-card" style={{ marginBottom: 12 }}>
              <strong style={{ display: 'block', marginBottom: 6 }}>Customer has a question</strong>
              <p style={{ margin: '4px 0', fontSize: 'var(--text-sm)' }}>"{awr.customer_message}"</p>
              <div className="muted small" style={{ marginTop: 8 }}>Reply directly or update and resend the request.</div>
            </div>
          )}

          {isDeclined && (
            <div className="comm-card" style={{ marginBottom: 12, borderColor: 'rgba(180,35,24,.2)' }}>
              <strong style={{ display: 'block', marginBottom: 6, color: 'var(--red)' }}>Customer declined</strong>
              {awr.customer_message && <p style={{ margin: '4px 0', fontSize: 'var(--text-sm)' }}>"{awr.customer_message}"</p>}
            </div>
          )}

          {isApproved && (
            <div style={{ background: 'var(--green-bg)', border: '1px solid rgba(21,128,61,.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 12, fontSize: 'var(--text-sm)' }}>
              <strong style={{ color: 'var(--green)' }}>✅ Approved</strong>
              <span className="muted" style={{ marginLeft: 8 }}>This additional work has been approved by the customer.</span>
              {awr.approved_at && <div className="muted small" style={{ marginTop: 4 }}>Approved {formatDate(awr.approved_at)}</div>}
            </div>
          )}

          <div className="qb-card">
            <div className="qb-card-header" style={{ marginBottom: 0 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--amber)', background: 'var(--amber-bg)', padding: '2px 8px', borderRadius: 6 }}>Additional Work</span>
                </div>
                <h2 style={{ margin: '0 0 4px', fontSize: 'clamp(1.1rem,2.5vw,1.5rem)', letterSpacing: '-.02em' }}>{awr.title}</h2>
                <div className="qb-muted">{awr.customer?.name || 'No customer'} · Related to: {awr.quote?.title || 'Quote'}</div>
              </div>
              <StatusBadge status={awr.status} />
            </div>

            <div className="qd-meta" style={{ marginTop: 12 }}>
              <div className="qd-meta-item">
                <span className="qb-label" style={{ marginBottom: 2 }}>Customer</span>
                <span>{awr.customer?.name || 'Not linked'}</span>
              </div>
              <div className="qd-meta-item">
                <span className="qb-label" style={{ marginBottom: 2 }}>Contact</span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {awr.customer?.phone && <a href={`tel:${awr.customer.phone}`} className="btn btn-secondary btn-sm" aria-label={`Call ${awr.customer.name || 'customer'}`} title="Call"><Phone size={14} /></a>}
                  {awr.customer?.email && <a href={`mailto:${awr.customer.email}`} className="btn btn-secondary btn-sm" aria-label={`Email ${awr.customer.name || 'customer'}`} title="Email"><Mail size={14} /></a>}
                </div>
              </div>
              <div className="qd-meta-item">
                <span className="qb-label" style={{ marginBottom: 2 }}>Sent</span>
                <span>{awr.sent_at ? formatDate(awr.sent_at) : 'Not sent'}</span>
              </div>
            </div>

            {awr.reason && (
              <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                <span className="qb-label">Reason</span>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)' }}>{awr.reason}</p>
              </div>
            )}

            {/* Line items */}
            <div style={{ marginTop: 14 }}>
              <div className="qb-group-label">Additional items</div>
              {items.map(item => (
                <div key={item.id} className="qd-line-item">
                  <div className="qd-li-info">
                    <strong>{item.name}</strong>
                    {item.notes && <span className="qb-muted">{item.notes}</span>}
                  </div>
                  <div className="qd-li-price">
                    <span className="qb-muted">{item.quantity} × {currency(item.unit_price)}</span>
                    <strong>{currency(Number(item.quantity || 0) * Number(item.unit_price || 0))}</strong>
                  </div>
                </div>
              ))}
            </div>

            <div className="qd-totals">
              <div className="qb-total-row"><span>Subtotal</span><span>{currency(awr.subtotal)}</span></div>
              <div className="qb-total-row"><span>Tax</span><span>{currency(awr.tax)}</span></div>
              <div className="qb-total-row grand"><span>Total</span><span>{currency(awr.total)}</span></div>
            </div>
          </div>
        </section>

        {/* ── RIGHT SIDEBAR ── */}
        <aside className="qd-sidebar">

          {/* Send / share */}
          <div className="qb-card">
            <span className="qb-label">Send to customer</span>
            <div className="qd-send-grid">
              {awr.customer?.phone && <button className="btn btn-primary full-width" type="button" onClick={handleSendText}>Send via text</button>}
              <button className="btn btn-secondary full-width" type="button" onClick={handleCopyLink}>Copy link</button>
            </div>
            <a href={shareUrl} target="_blank" rel="noreferrer" className="qd-share-link">Preview customer view ↗</a>
          </div>

          {/* Actions */}
          <div className="qb-card">
            <span className="qb-label">Actions</span>
            <div className="qd-send-grid">
              <Link className="btn btn-secondary full-width" to={`/app/quotes/${awr.quote_id}`}>View original quote</Link>
              {isDraft && !confirmDelete && (
                <button className="btn btn-secondary full-width" type="button" style={{ color: 'var(--red)' }} onClick={() => setConfirmDelete(true)}>Delete draft</button>
              )}
              {confirmDelete && (
                <>
                  <div className="qb-muted" style={{ textAlign: 'center' }}>This cannot be undone.</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" style={{ color: 'var(--red)' }} type="button" onClick={handleDelete}>Delete</button>
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
