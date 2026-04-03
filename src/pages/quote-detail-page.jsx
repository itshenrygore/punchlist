import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/app-shell';
import ConfidencePanel from '../components/confidence-panel';
import StatusBadge from '../components/status-badge';
import UpgradePrompt, { shouldShowUpgrade, recordUpgradeShown, LockedFeatureCard } from '../components/upgrade-prompt';
import { buildConfidence, calculateTotals } from '../lib/pricing';
import { currency, formatDate, formatQuoteNumber } from '../lib/format';
import { deleteQuote, friendly, duplicateQuote, getQuote, getProfile, updateQuoteStatus, markFollowedUp, createInvoiceFromQuoteWithAdditionalWork, listInvoices, listAdditionalWork, createAdditionalWork, uploadQuotePhoto, listQuotePhotos, deleteQuotePhoto, replyToCustomer, listAmendments, createAmendment, listBookings } from '../lib/api';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../components/toast';
import { safeWriteClipboard, nativeShare } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { labelForDeposit, getNextStep, getFollowUpAdvice, buildTimeline } from '../lib/workflow';
import { isPro } from '../lib/billing';
import BookingDrawer from '../components/booking-drawer';

export default function QuoteDetailPage() {
  const { quoteId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { show: showToast } = useToast();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [followingUp, setFollowingUp] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [linkedInvoice, setLinkedInvoice] = useState(null);
  const [additionalWork, setAdditionalWork] = useState([]);
  const [showAwModal, setShowAwModal] = useState(false);
  const [awDraft, setAwDraft] = useState({ title: 'Additional Work', reason: '', items: [{ name: '', quantity: 1, unit_price: 0, notes: '' }] });
  const [awSaving, setAwSaving] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  // Phase 3: Amendments
  const [amendments, setAmendments] = useState([]);
  const [showAmendModal, setShowAmendModal] = useState(false);
  const [amendDraft, setAmendDraft] = useState({ title: 'Amendment', reason: '', items: [{ name: '', quantity: 1, unit_price: 0, notes: '' }] });
  const [amendSaving, setAmendSaving] = useState(false);
  // Phase 6: bookings for timeline
  const [quoteBookings, setQuoteBookings] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [upgradePrompt, setUpgradePrompt] = useState(null);

  useEffect(() => {
    if (!quoteId) return;
    if (user) getProfile(user.id).then(p => setUserProfile(p)).catch(() => {});
    getQuote(quoteId)
      .then(data => {
        setQuote(data);
        // Check if an invoice already exists for this quote
        if (['completed','invoiced','paid'].includes(data.status)) {
          listInvoices().then(invs => {
            const linked = invs.find(i => i.quote_id === quoteId);
            if (linked) setLinkedInvoice(linked);
          }).catch(() => {});
        }
        // Load additional work requests
        listAdditionalWork(quoteId).then(setAdditionalWork).catch(() => {});
        // Load amendments (Phase 3)
        listAmendments(quoteId).then(setAmendments).catch(() => {});
        // Phase 6: load bookings for timeline
        listBookings().then(all => setQuoteBookings(all.filter(b => b.quote_id === quoteId))).catch(() => {});
        // Load photos
        listQuotePhotos(quoteId).then(setPhotos).catch(() => {});
      })
      .catch(e => showToast(friendly(e), 'error'))
      .finally(() => setLoading(false));
  }, [quoteId]);

  async function handleCreateInvoice() {
    if (!quote || !user) return;
    setCreatingInvoice(true);
    try {
      const inv = await createInvoiceFromQuoteWithAdditionalWork(user.id, quote);
      showToast('Invoice created', 'success');
      navigate(`/app/invoices/${inv.id}`);
    } catch (e) { showToast(friendly(e), 'error'); }
    finally { setCreatingInvoice(false); }
  }

  async function handleCreateAdditionalWork(sendNow) {
    if (!quote || !user) return;
    setAwSaving(true);
    try {
      const request = await createAdditionalWork(user.id, {
        quote_id: quote.id,
        customer_id: quote.customer_id,
        title: awDraft.title || 'Additional Work',
        reason: awDraft.reason,
        items: awDraft.items.filter(i => (i.name || '').trim()),
        province: quote.province || 'ON',
        status: sendNow ? 'sent' : 'draft',
      });
      setAdditionalWork(prev => [request, ...prev]);
      setShowAwModal(false);
      setAwDraft({ title: 'Additional Work', reason: '', items: [{ name: '', quantity: 1, unit_price: 0, notes: '' }] });
      showToast(sendNow ? 'Additional work request sent' : 'Draft saved', 'success');
      if (sendNow) {
        navigate(`/app/additional-work/${request.id}`);
      }
    } catch (e) { showToast(friendly(e), 'error'); }
    finally { setAwSaving(false); }
  }

  // Phase 3: Create amendment for signed quotes
  async function handleCreateAmendment(sendNow) {
    if (!quote || !user) return;
    setAmendSaving(true);
    try {
      const amendment = await createAmendment(user.id, {
        quote_id: quote.id,
        title: amendDraft.title || 'Amendment',
        reason: amendDraft.reason,
        items: amendDraft.items.filter(i => (i.name || '').trim()),
        province: quote.province || 'ON',
        country: quote.country || 'CA',
        status: sendNow ? 'sent' : 'draft',
      });
      setAmendments(prev => [amendment, ...prev]);
      setShowAmendModal(false);
      setAmendDraft({ title: 'Amendment', reason: '', items: [{ name: '', quantity: 1, unit_price: 0, notes: '' }] });
      showToast(sendNow ? 'Amendment sent to customer' : 'Amendment draft saved', 'success');
    } catch (e) { showToast(friendly(e), 'error'); }
    finally { setAmendSaving(false); }
  }

  const confidence = useMemo(() =>
    quote ? buildConfidence(quote.line_items || [], [], {
      hasCustomer: !!quote.customer_id, hasScope: !!quote.scope_summary,
      hasDeposit: !quote.deposit_required || quote.deposit_status === 'paid',
      revisionSummary: quote.revision_summary,
    }) : { score: 0, checks: [] },
  [quote]);

  if (loading) return <AppShell title="Quote"><div style={{padding:'20px 0'}}><div className="skel-card"><div className="skel-card-top"><div className="skel-line" style={{width:'50%',height:16}}/><div className="skel-line" style={{width:'15%',height:14}}/></div><div className="skel-line" style={{width:'80%',marginTop:10}}/><div className="skel-line" style={{width:'60%',marginTop:6}}/></div><div className="skel-block" style={{marginTop:12}}><div className="skel-line" style={{width:'100%',height:36}}/><div className="skel-line" style={{width:'100%',height:36}}/><div className="skel-line" style={{width:'100%',height:36}}/></div></div></AppShell>;
  if (!quote) return <AppShell title="Quote"><div className="empty-state" style={{ textAlign:'center', padding:'60px 20px' }}>
    <div style={{ fontSize:'2.5rem', marginBottom:12 }}>🔗</div>
    <h3 style={{ margin:'0 0 8px' }}>Quote not found</h3>
    <p className="muted" style={{ fontSize:14, lineHeight:1.6, maxWidth:360, margin:'0 auto 20px' }}>This quote may have been deleted or the link is incorrect.</p>
    <Link className="btn btn-secondary" to="/app">Back to dashboard</Link>
  </div></AppShell>;

  const shareUrl = quote.share_token ? `${window.location.origin}/public/${quote.share_token}` : '';
  const hasShareToken = Boolean(quote.share_token);
  const isDraft = quote.status === 'draft';
  const isRevision = ['revision_requested','declined'].includes(quote.status);
  const isApproved = ['approved','approved_pending_deposit'].includes(quote.status);
  const isScheduled = quote.status === 'scheduled';
  const isCompleted = quote.status === 'completed';
  const isLocked = isApproved || isScheduled || isCompleted;
  const isSigned = Boolean(quote.signed_at);
  const isExpired = quote.expires_at && new Date(quote.expires_at) < new Date() &&
    !['approved','approved_pending_deposit','scheduled','completed'].includes(quote.status);

  // Parse internal_notes for customer activity
  const activityLines = String(quote.internal_notes || '').split('\n').filter(Boolean);
  const customerActivity = activityLines.filter(l =>
    /^(Customer:|Question|Declined:|Change request:)/i.test(l)
  );
  const internalOnly = activityLines.filter(l =>
    !/^(Customer:|Question|Declined:|Change request:)/i.test(l)
  );

  const groupedItems = (quote.line_items || []).reduce((acc, item) => {
    const key = item.category || (item.item_type === 'optional' ? 'Options' : 'Scope items');
    acc[key] ||= []; acc[key].push(item); return acc;
  }, {});

  // 2C: Reply to customer in conversation thread
  async function handleReplyToCustomer() {
    if (!replyText.trim()) return;
    if (!quote.share_token) { showToast('No share token on this quote', 'error'); return; }
    setReplySending(true);
    try {
      const result = await replyToCustomer(quote.share_token, replyText.trim(), user.id);
      setReplyText('');
      // Update local conversation
      if (result.conversation) {
        setQuote(p => ({ ...p, conversation: result.conversation }));
      }
      showToast('Reply sent to customer', 'success');
    } catch (e) {
      showToast(friendly(e), 'error');
    } finally {
      setReplySending(false);
    }
  }

  async function handleSendEmail() {
    if (!hasShareToken) { showToast('Quote has no share link — save it first', 'error'); return; }
    const to = quote.customer?.email || '';
    const firstName = quote.customer?.name?.split(' ')[0] || '';
    const compName = quote.contractor?.company_name || quote.contractor?.full_name || '';

    if (!['sent','viewed','approved','approved_pending_deposit','scheduled','completed'].includes(quote.status)) {
      try { const updated = await updateQuoteStatus(quote.id, { status: 'sent' }); setQuote(p => ({ ...p, ...updated, status: 'sent' })); } catch {}
    }

    // Try server-side email first (professional HTML template via Resend)
    if (to) {
      try {
        // Include auth token for server-side ownership verification
        const emailHeaders = { 'Content-Type': 'application/json' };
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) emailHeaders['Authorization'] = `Bearer ${session.access_token}`;
        } catch {}
        const emailRes = await fetch('/api/send-quote-email', {
          method: 'POST', headers: emailHeaders,
          body: JSON.stringify({ quoteId: quote.id, to }),
        });
        if (emailRes.ok) {
          showToast('Quote emailed to ' + (quote.customer?.name || to), 'success');
          return;
        }
      } catch {}
    }

    // Fallback to mailto
    const subject = encodeURIComponent(`Quote from ${compName}: ${quote.title || 'Your quote'}`);
    const body = encodeURIComponent(`Hi${firstName ? ' ' + firstName : ''},\n\nThanks for reaching out. I've put together a quote for the work we discussed.\n\nYou can review the full scope and pricing here:\n${shareUrl}\n\nFrom this link you can approve the quote, request changes, or ask any questions.\n\nLooking forward to working with you,\n${compName}`);
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    showToast('Opening email app…', 'success');
  }

  async function handleSendText() {
    if (!hasShareToken) { showToast('Quote has no share link — save it first', 'error'); return; }
    const phone = quote.customer?.phone || '';
    const firstName = quote.customer?.name?.split(' ')[0] || '';
    const compName = quote.contractor?.company_name || quote.contractor?.full_name || '';
    const body = encodeURIComponent(`Hi${firstName ? ' ' + firstName : ''}, your quote from ${compName} is ready to review. You can check it out, approve, or ask questions here: ${shareUrl}`);
    if (!['sent','viewed','approved','approved_pending_deposit','scheduled','completed'].includes(quote.status)) {
      try { const updated = await updateQuoteStatus(quote.id, { status: 'sent' }); setQuote(p => ({ ...p, ...updated, status: 'sent' })); } catch {}
    }
    window.open(`sms:${phone}?body=${body}`, '_self');
    showToast('Opening messages…', 'success');
  }

  async function handleCopyLink() {
    if (!hasShareToken) { showToast('Quote has no share link — save it first', 'error'); return; }
    try {
      await safeWriteClipboard(shareUrl);
      showToast('Link copied', 'success');
      if (!['sent','viewed','approved','approved_pending_deposit','scheduled','completed'].includes(quote.status)) {
        const updated = await updateQuoteStatus(quote.id, { status: 'sent' });
        setQuote(p => ({ ...p, ...updated, status: 'sent' }));
      }
    } catch { showToast('Copy failed', 'error'); }
  }

  async function handleDownloadPdf() {
    if (!quote?.share_token) return;
    setPdfLoading(true);
    try {
      const pdfUrl = `/api/export-pdf?token=${quote.share_token}`;
      // Mobile detection: iOS Safari and many mobile browsers can't handle blob downloads.
      // Open the PDF URL directly in a new tab — the browser will display or download natively.
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        // Direct URL open — the server sets Content-Disposition: attachment, which triggers download
        // on most mobile browsers. If the API fails, fall back to the print-friendly view.
        const testRes = await fetch(pdfUrl, { method: 'HEAD' }).catch(() => null);
        if (testRes?.ok) {
          window.location.href = pdfUrl;
          showToast('Opening PDF…', 'success');
        } else {
          window.open(`/public/${quote.share_token}?print=1`, '_blank');
          showToast('Opening printable quote', 'success');
        }
      } else {
        // Desktop: fetch blob and trigger download with filename
        const res = await fetch(pdfUrl);
        if (res.ok && res.headers.get('content-type')?.includes('pdf')) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${(quote.title || 'Quote').replace(/[^a-zA-Z0-9 ]/g, '')}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          showToast('PDF downloaded', 'success');
        } else {
          window.open(`/public/${quote.share_token}?print=1`, '_blank');
          showToast('Opening printable quote', 'success');
        }
      }
    } catch {
      window.open(`/public/${quote.share_token}?print=1`, '_blank');
      showToast('Opening printable quote', 'success');
    }
    finally { setPdfLoading(false); }
  }

  async function markDepositPaid() {
    try {
      const updated = await updateQuoteStatus(quote.id, { deposit_status: 'paid', status: quote.status==='approved_pending_deposit'?'approved':quote.status, deposit_paid_at: new Date().toISOString() });
      setQuote(p => ({ ...p, ...updated, deposit_status: 'paid' }));
      showToast('Deposit marked paid', 'success');
    } catch (e) { showToast(friendly(e), 'error'); }
  }

  async function markComplete() {
    try {
      const updated = await updateQuoteStatus(quote.id, { status: 'completed' });
      setQuote(p => ({ ...p, ...updated, status: 'completed' }));
      showToast('Job marked complete', 'success');
    } catch (e) { showToast(friendly(e), 'error'); }
  }

  function recordFollowUp() {
    markFollowedUp(quote.id).then(() => {
      setQuote(p => ({ ...p, follow_up_at: new Date().toISOString() }));
    }).catch(e => showToast(friendly(e), 'error'));
  }

  async function handleFollowUpEmail() {
    if (!hasShareToken) { showToast('Quote has no share link', 'error'); return; }
    if (!quote.customer?.email) { showToast('No email on file for this customer', 'error'); return; }
    setFollowingUp(true);
    recordFollowUp();
    const firstName = quote.customer?.name?.split(' ')[0] || '';
    const compName = userProfile?.company_name || userProfile?.full_name || '';
    const subject = encodeURIComponent(`Following up: ${quote.title || 'your quote'}`);
    const body = encodeURIComponent(
      `Hi${firstName ? ' ' + firstName : ''},\n\n` +
      `Just checking in on the quote I sent over. Happy to answer any questions or walk through the scope together.\n\n` +
      `You can review it here:\n${shareUrl}\n\n` +
      `Thanks,\n${compName}`
    );
    window.location.href = `mailto:${quote.customer.email}?subject=${subject}&body=${body}`;
    setFollowingUp(false);
  }

  async function handleFollowUpText() {
    if (!hasShareToken) { showToast('Quote has no share link', 'error'); return; }
    if (!quote.customer?.phone) { showToast('No phone on file for this customer', 'error'); return; }
    setFollowingUp(true);
    recordFollowUp();
    const firstName = quote.customer?.name?.split(' ')[0] || '';
    const compName = userProfile?.company_name || userProfile?.full_name || '';
    const body = encodeURIComponent(
      `Hi${firstName ? ' ' + firstName : ''}, just following up on the quote I sent over for ${quote.title || 'the work we discussed'}. ` +
      `You can review and approve it here: ${shareUrl}\n\n— ${compName}`
    );
    window.open(`sms:${quote.customer.phone}?body=${body}`, '_self');
    setFollowingUp(false);
  }

  async function handleDuplicate() {
    try { const next = await duplicateQuote(user.id, quote); showToast('Draft created', 'success'); navigate(`/app/quotes/${next.id}/edit`); }
    catch (e) { showToast(friendly(e), 'error'); }
  }

  async function handleDelete() {
    try {
      if (quote.signed_at) {
        // Archive instead of delete
        await updateQuoteStatus(quote.id, { archived_at: new Date().toISOString() });
        showToast('Quote archived', 'success');
      } else {
        await deleteQuote(quote.id);
        showToast('Deleted', 'success');
      }
      navigate('/app');
    }
    catch (e) { showToast(friendly(e), 'error'); }
  }

  // Header action — locked quotes get "Create revision" not full edit
  const headerAction = isLocked
    ? <button className="btn btn-secondary btn-sm" type="button" onClick={handleDuplicate}>Create revision</button>
    : isRevision
      ? <Link className="btn btn-primary btn-sm" to={`/app/quotes/${quote.id}/edit`}>Revise and resend</Link>
      : isDraft
        ? <Link className="btn btn-primary btn-sm" to={`/app/quotes/${quote.id}/edit`}>Continue editing</Link>
        : <Link className="btn btn-secondary btn-sm" to={`/app/quotes/${quote.id}/edit`}>Edit</Link>;

  return (
    <AppShell title="Quote" actions={headerAction}>
      {upgradePrompt && <UpgradePrompt trigger={upgradePrompt.trigger} context={upgradePrompt.context} onDismiss={() => setUpgradePrompt(null)} />}
      <div className="qd-grid">

        {/* ── LEFT ── */}
        <section className="qd-main">

          {/* Draft: prominent Continue Editing CTA */}
          {isDraft && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', background: 'var(--brand-bg)', border: '1px solid var(--brand-line)', borderRadius: 'var(--r-lg)', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>This quote is still a draft</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Add items, set pricing, and send to your customer.</div>
              </div>
              <Link className="btn btn-primary" to={`/app/quotes/${quote.id}/edit`} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>Continue editing →</Link>
            </div>
          )}

          {/* Sent but not yet viewed: next step hint */}
          {quote.status === 'sent' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 'var(--r)', marginBottom: 12, fontSize: 13, color: 'var(--muted)' }}>
              <span style={{ fontSize: 16 }}>📨</span>
              <span>Quote sent — waiting for customer to view and respond.</span>
            </div>
          )}

          {/* Expired notice */}
          {isExpired && (
            <div className="qb-error" style={{ marginBottom:12 }}>
              ⏰ This quote expired {formatDate(quote.expires_at)}.{' '}
              <Link to={`/app/quotes/${quote.id}/edit`} style={{ textDecoration:'underline' }}>Renew and resend</Link>
            </div>
          )}

          {/* Customer feedback card — conversation thread */}
          {(isRevision || customerActivity.length > 0 || (Array.isArray(quote.conversation) && quote.conversation.length > 0)) && (
            <div className="comm-card" style={{ marginBottom:12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 16 }}>{quote.status==='declined' ? '⚠️' : quote.status==='revision_requested' ? '✏️' : '💬'}</span>
                <strong style={{ fontSize: 14 }}>
                  {quote.status==='declined' ? 'Customer declined' : quote.status==='revision_requested' ? 'Changes requested' : 'Customer messages'}
                </strong>
              </div>

              {/* Structured conversation thread */}
              {Array.isArray(quote.conversation) && quote.conversation.length > 0 ? (
                <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:12 }}>
                  {quote.conversation.map(entry => (
                    <div key={entry.id} style={{ display:'flex', gap:8, alignItems:'flex-start', flexDirection: entry.role === 'customer' ? 'row' : 'row-reverse' }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13,
                        background: entry.role === 'customer' ? '#e0e7ff' : 'var(--brand-bg, #fff7ed)' }}>
                        {entry.role === 'customer' ? '👤' : '🔧'}
                      </div>
                      <div style={{ maxWidth:'80%' }}>
                        <div style={{ fontSize:11, color:'var(--muted)', marginBottom:3, textAlign: entry.role === 'contractor' ? 'right' : 'left' }}>
                          <strong>{entry.name || (entry.role === 'customer' ? 'Customer' : 'You')}</strong>
                          {' · '}{new Date(entry.timestamp).toLocaleDateString('en-CA', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                        </div>
                        <div style={{ padding:'9px 12px', fontSize:13, lineHeight:1.55, color:'var(--text)',
                          borderRadius: entry.role === 'customer' ? '2px 10px 10px 10px' : '10px 2px 10px 10px',
                          background: entry.role === 'customer' ? 'var(--panel-2)' : 'var(--brand-bg, #fff7ed)',
                          border: entry.role === 'contractor' ? '1px solid var(--brand-line, #fed7aa)' : '1px solid var(--line)' }}>
                          {entry.text}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Legacy: internal_notes activity lines */
                customerActivity.map((line, i) => (
                  <p key={i} style={{ margin:'4px 0', fontSize:13 }}>"{line.replace(/^(Customer:|Question \(.*?\):|Declined:|Change request:)\s*/i,'').trim()}"</p>
                ))
              )}

              {/* Reply to customer input */}
              {quote.customer?.email && (
                <div style={{ borderTop:'1px solid var(--line)', paddingTop:10, marginTop:4 }}>
                  <div style={{ fontSize:12, color:'var(--muted)', marginBottom:6 }}>Reply to {quote.customer?.name || 'customer'}</div>
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Type your reply — customer will receive it by email and it will appear on their quote page…"
                    rows={3}
                    style={{ width:'100%', boxSizing:'border-box', padding:'9px 12px', fontSize:13, border:'1px solid var(--line)', borderRadius:'var(--r)', background:'var(--panel)', color:'var(--text)', fontFamily:'inherit', resize:'vertical' }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ marginTop:6 }}
                    disabled={replySending || !replyText.trim()}
                    onClick={handleReplyToCustomer}
                  >
                    {replySending ? 'Sending…' : 'Send Reply'}
                  </button>
                </div>
              )}

              {isRevision && (
                <div style={{ marginTop:10, borderTop:'1px solid var(--line)', paddingTop:10 }}>
                  <Link className="btn btn-primary btn-sm" to={`/app/quotes/${quote.id}/edit`}>Start revision</Link>
                </div>
              )}
            </div>
          )}

          {/* Locked notice */}
          {isLocked && (
            <div style={{ background:'var(--blue-bg)', border:'1px solid rgba(72,120,208,.2)', borderRadius:10, padding:'12px 16px', marginBottom:12, fontSize:13 }}>
              <strong style={{ color:'var(--blue)' }}>
                {isCompleted ? '✓ Completed' : isScheduled ? '📅 Scheduled' : '✅ Approved'}
              </strong>
              <span style={{ color:'var(--muted)', marginLeft:8 }}>This quote is locked. To make changes, create a revision.</span>
            </div>
          )}

          <div className="qb-card">
            <div className="qb-card-header" style={{ marginBottom:0 }}>
              <div>
                <h2 style={{ margin:'0 0 4px', fontSize:'clamp(1.1rem,2.5vw,1.5rem)', letterSpacing:'-.02em' }}>{quote.title}</h2>
                <div className="qb-muted">{quote.quote_number ? <span style={{fontWeight:700,color:'var(--primary)',marginRight:6}}>{formatQuoteNumber(quote.quote_number)}</span> : null}{quote.customer?.name||'No customer'}{quote.trade?` · ${quote.trade}`:''} · v{quote.revision_number||1}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <StatusBadge status={quote.status}/>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>Next: {getNextStep(quote)}</div>
              </div>
            </div>

            <div className="qd-meta">
              <div className="qd-meta-item">
                <span className="qb-label" style={{ marginBottom:2 }}>Customer</span>
                <span>{quote.customer?.name||'Not linked'}</span>
              </div>
              <div className="qd-meta-item">
                <span className="qb-label" style={{ marginBottom:2 }}>Contact</span>
                <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                  {quote.customer?.phone && <a href={`tel:${quote.customer.phone}`} className="btn btn-secondary btn-sm">📞</a>}
                  {quote.customer?.email && <a href={`mailto:${quote.customer.email}`} className="btn btn-secondary btn-sm">✉</a>}
                  {!quote.customer?.phone && !quote.customer?.email && <span className="qb-muted">None</span>}
                </div>
              </div>
              <div className="qd-meta-item">
                <span className="qb-label" style={{ marginBottom:2 }}>Expiry</span>
                <span>{quote.expires_at ? formatDate(quote.expires_at) : 'No expiry'}{isExpired?' (expired)':''}</span>
              </div>
              <div className="qd-meta-item">
                <span className="qb-label" style={{ marginBottom:2 }}>Views</span>
                <span>{quote.view_count||0}{quote.last_viewed_at?` · last ${formatDate(quote.last_viewed_at)}`:''}</span>
              </div>
              {quote.first_viewed_at && (
                <div className="qd-meta-item">
                  <span className="qb-label" style={{ marginBottom:2 }}>First opened</span>
                  <span>{formatDate(quote.first_viewed_at)}</span>
                </div>
              )}
              {quote.follow_up_at && (
                <div className="qd-meta-item">
                  <span className="qb-label" style={{ marginBottom:2 }}>Last follow-up</span>
                  <span>{formatDate(quote.follow_up_at)}</span>
                </div>
              )}
            </div>

            {quote.scope_summary && (
              <div style={{ marginTop:14, padding:'10px 12px', background:'var(--bg)', borderRadius:8 }}>
                <span className="qb-label">Scope</span>
                <p style={{ margin:'4px 0 0', fontSize:13 }}>{quote.scope_summary}</p>
              </div>
            )}
            {quote.revision_summary && (
              <div className="qb-notice" style={{ marginTop:10 }}>
                <strong>What changed:</strong> {quote.revision_summary}
              </div>
            )}

            <div style={{ marginTop:14 }}>
              {Object.entries(groupedItems).map(([group, items]) => (
                <div key={group} style={{ marginBottom:8 }}>
                  <div className="qb-group-label">{group}</div>
                  {items.map(item => (
                    <div key={item.id} className={`qd-line-item ${item.included===false?'excluded':''}`}>
                      <div className="qd-li-info">
                        <strong>{item.name}</strong>
                        {item.notes && <span className="qb-muted">{item.notes}</span>}
                      </div>
                      <div className="qd-li-price">
                        <span className="qb-muted">{item.quantity} × {currency(item.unit_price)}</span>
                        <strong>{item.included===false?'Optional':currency(item.quantity*item.unit_price)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="qd-totals">
              <div className="qb-total-row"><span>Subtotal</span><span>{currency(quote.subtotal)}</span></div>
              <div className="qb-total-row"><span>Tax</span><span>{currency(quote.tax)}</span></div>
              <div className="qb-total-row grand"><span>Total</span><span>{currency(quote.total)}</span></div>
              {quote.deposit_required && Number(quote.deposit_amount)>0 && (
                <div className="qb-total-row" style={{ color:'var(--amber)' }}>
                  <span>Deposit ({labelForDeposit(quote.deposit_status)})</span>
                  <span>{currency(quote.deposit_amount)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Assumptions — lighter visual treatment */}
          {(quote.assumptions || quote.exclusions) && (
            <div className="qd-two-col">
              {quote.assumptions && (
                <div className="qb-card" style={{ background:'var(--card)', border:'1px solid var(--line)' }}>
                  <span className="qb-label" style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em' }}>Assumptions</span>
                  <p style={{ margin:'6px 0 0', fontSize:13, color:'var(--muted)', lineHeight:1.55, fontStyle:'italic' }}>{quote.assumptions}</p>
                </div>
              )}
              {quote.exclusions && (
                <div className="qb-card" style={{ background:'var(--card)', border:'1px solid var(--line)' }}>
                  <span className="qb-label" style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em' }}>Not included</span>
                  <p style={{ margin:'6px 0 0', fontSize:13, color:'var(--muted)', lineHeight:1.55 }}>{quote.exclusions}</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── RIGHT SIDEBAR ── */}
        <aside className="qd-sidebar">
          <ConfidencePanel confidence={confidence}/>

          {/* Job Photos */}
          <div className="qb-card">
            <span className="qb-label">Job Photos</span>
            {photos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 8 }}>
                {photos.map(p => (
                  <div key={p.path} style={{ position: 'relative', borderRadius: 'var(--r-sm)', overflow: 'hidden', border: '1px solid var(--line)', aspectRatio: '1' }}>
                    <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <button type="button" onClick={async () => {
                      try { await deleteQuotePhoto(p.path); setPhotos(prev => prev.filter(x => x.path !== p.path)); showToast('Removed', 'info'); } catch {}
                    }} style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,.6)', color: '#fff', border: 'none', fontSize: 10, cursor: 'pointer', display: 'grid', placeItems: 'center', lineHeight: 1 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            {photos.length === 0 && <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--muted)' }}>No photos yet. Add job site photos for your records.</p>}
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, padding: '8px 12px', borderRadius: 'var(--r-sm)', border: '1px dashed var(--line-2)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--muted)', transition: 'border-color .15s' }}>
              {photoUploading ? 'Uploading…' : '📷 Add photo'}
              <input hidden type="file" accept="image/*" multiple onChange={async e => {
                const files = Array.from(e.target.files || []);
                if (!files.length) return;
                const maxSize = 5 * 1024 * 1024; // 5MB
                const oversized = files.filter(f => f.size > maxSize);
                if (oversized.length) {
                  showToast(`${oversized.length} photo${oversized.length > 1 ? 's' : ''} over 5MB limit — skipped`, 'error');
                }
                const validFiles = files.filter(f => f.size <= maxSize);
                if (!validFiles.length) { e.target.value = ''; return; }
                setPhotoUploading(true);
                let uploaded = 0;
                for (const file of validFiles) {
                  try {
                    const photo = await uploadQuotePhoto(quoteId, file);
                    setPhotos(prev => [photo, ...prev]);
                    uploaded++;
                  } catch (err) { showToast('Upload failed: ' + err.message, 'error'); }
                }
                setPhotoUploading(false);
                if (uploaded > 0) showToast(`${uploaded} photo${uploaded > 1 ? 's' : ''} added`, 'success');
                e.target.value = '';
              }} />
            </label>
            <div style={{ fontSize: 10, color: 'var(--subtle)', marginTop: 4 }}>Photos stored for 30 days, then archived</div>
          </div>

          {/* Additional Work / Amendments — shown for approved/scheduled/completed */}
          {(isApproved || isScheduled || isCompleted) && (
            <div className="qb-card" style={{ border: '1px solid rgba(176,112,48,.2)', background: 'var(--amber-bg)' }}>
              {/* Phase 3: Signed quotes use amendments; unsigned use additional work */}
              {isSigned ? (
                <>
                  <span className="qb-label" style={{ color: 'var(--amber)' }}>Amendments</span>
                  {amendments.length > 0 ? (
                    <div style={{ marginTop: 8 }}>
                      {amendments.map(am => (
                        <a key={am.id} href={`/public/amendment/${am.share_token}`} target="_blank" rel="noreferrer" className="aw-status-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                          <div>
                            <strong style={{ fontSize: 13 }}>{am.title}</strong>
                            <div className="qb-muted">{currency(am.total)}</div>
                          </div>
                          <StatusBadge status={am.status} />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--muted)' }}>No amendments yet.</p>
                  )}
                  <button className="btn btn-primary full-width" style={{ marginTop: 10 }} type="button" onClick={() => setShowAmendModal(true)}>
                    + Propose Amendment
                  </button>
                  <span
                    title="Use this when changes are needed to the original scope — the customer must re-sign the amendment."
                    style={{ display: 'block', marginTop: 5, fontSize: 11, color: 'var(--muted)', lineHeight: 1.4, cursor: 'default' }}
                  >
                    Changes to original scope — requires customer re-signature
                  </span>
                </>
              ) : (
                <>
                  <span className="qb-label" style={{ color: 'var(--amber)' }}>Additional Work</span>
                  {additionalWork.length > 0 ? (
                    <div style={{ marginTop: 8 }}>
                      {additionalWork.map(aw => (
                        <Link key={aw.id} to={`/app/additional-work/${aw.id}`} className="aw-status-card">
                          <div>
                            <strong style={{ fontSize: 13 }}>{aw.title}</strong>
                            <div className="qb-muted">{currency(aw.total)}</div>
                          </div>
                          <StatusBadge status={aw.status} />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--muted)' }}>No additional work requests yet.</p>
                  )}
                  <button className="btn btn-primary full-width" style={{ marginTop: 10 }} type="button" onClick={() => setShowAwModal(true)}>
                    + Request Additional Work
                  </button>
                  <span
                    title="Use this for new work beyond the original scope — the customer approves it separately."
                    style={{ display: 'block', marginTop: 5, fontSize: 11, color: 'var(--muted)', lineHeight: 1.4, cursor: 'default' }}
                  >
                    New work beyond original scope — customer approves separately
                  </span>
                </>
              )}
            </div>
          )}

          {/* Send / share */}
          <div className="qb-card">
            <span className="qb-label">Send to customer</span>
            <div className="qd-send-grid">
              <button className="btn btn-primary full-width" type="button" onClick={handleSendEmail}>✉ Send via email</button>
              {quote.customer?.phone && <button className="btn btn-secondary full-width" type="button" onClick={handleSendText}>💬 Send via text</button>}
              <button className="btn btn-secondary full-width" type="button" onClick={handleCopyLink}>🔗 Copy link</button>
              {typeof navigator !== 'undefined' && navigator.share && (
                <button className="btn btn-secondary full-width" type="button" onClick={() => nativeShare({ title: quote.title || 'Quote', text: `Quote from ${quote.title || 'your contractor'}`, url: shareUrl }, showToast)}>📤 Share</button>
              )}
              <button className="btn btn-secondary full-width qd-pdf-btn" type="button" disabled={pdfLoading} onClick={handleDownloadPdf}>{pdfLoading?'Opening…':'📄 View PDF'}</button>
            </div>
            <a href={shareUrl + '?preview=1'} target="_blank" rel="noreferrer" className="qd-share-link"
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, padding: '8px 12px', background: 'var(--amber-bg)', border: '1px solid rgba(176,112,48,.15)', borderRadius: 'var(--r-sm)', fontSize: 12, fontWeight: 600, color: '#92400e', textDecoration: 'none' }}>
              <span style={{ fontSize: 14 }}>👁</span>
              Preview what your customer will see ↗
            </a>
          </div>

          {/* Follow-up — shown when sent/viewed */}
          {['sent','viewed'].includes(quote.status) && (
            <div className="qb-card" style={{ background:'var(--amber-bg)', border:'1px solid rgba(176,112,48,.2)' }}>
              <span className="qb-label">Follow up</span>
              <p style={{ margin:'4px 0 8px', fontSize:12, color:'var(--muted)' }}>
                {quote.view_count > 0 ? `Viewed ${quote.view_count} time${quote.view_count>1?'s':''}${quote.last_viewed_at?` · last ${formatDate(quote.last_viewed_at)}`:''}` : 'Not yet opened.'}
              </p>
              {(() => {
                const advice = getFollowUpAdvice(quote);
                if (!advice) return null;
                const urgencyColors = { high: 'var(--red)', medium: 'var(--amber)', low: 'var(--muted)' };
                return (
                  <div style={{ margin:'0 0 10px', padding:'8px 10px', background:'var(--panel)', borderRadius:'var(--r-sm)', border:'1px solid var(--line)' }}>
                    <div style={{ fontSize:12, fontWeight:700, color: urgencyColors[advice.urgency] || 'var(--muted)', marginBottom:3 }}>
                      {advice.emoji} {advice.headline}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-2)', lineHeight:1.5 }}>{advice.advice}</div>
                  </div>
                );
              })()}
              <div style={{ display: 'flex', gap: 6 }}>
                {quote.customer?.email && (
                  <button className="btn btn-secondary" type="button" style={{ flex: 1 }} disabled={followingUp} onClick={handleFollowUpEmail}>
                    ✉ Email
                  </button>
                )}
                {quote.customer?.phone && (
                  <button className="btn btn-secondary" type="button" style={{ flex: 1 }} disabled={followingUp} onClick={handleFollowUpText}>
                    💬 Text
                  </button>
                )}
                {!quote.customer?.email && !quote.customer?.phone && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>Add customer email or phone in Contacts to follow up.</div>
                )}
              </div>
              {quote.follow_up_at && <div className="qb-muted" style={{ fontSize:11, marginTop:6 }}>Last sent {formatDate(quote.follow_up_at)}</div>}
            </div>
          )}

          {/* Deposit */}
          {quote.deposit_required && (
            <div className="qb-card">
              <span className="qb-label">Deposit</span>
              <div className="qb-notice" style={{ marginTop:6 }}>
                {currency(quote.deposit_amount)} — <strong>{labelForDeposit(quote.deposit_status)}</strong>
              </div>
              {quote.deposit_status !== 'paid' && (
                <button className="btn btn-secondary full-width" style={{ marginTop:8 }} type="button" onClick={markDepositPaid}>Mark deposit paid</button>
              )}
              {quote.deposit_status === 'paid' && <div style={{ color:'var(--green)', fontWeight:700, fontSize:12, marginTop:6 }}>✓ Deposit paid</div>}
            </div>
          )}

          {/* Signature info (if signed) */}
          {quote.signed_at && (
            <div className="qb-card" style={{ border: '1px solid var(--green-line)', background: 'var(--green-bg)' }}>
              <span className="qb-label" style={{ color: 'var(--green)' }}>Signed</span>
              <div style={{ marginTop: 6, fontSize: 13 }}>
                {quote.signature_data && <img src={quote.signature_data} alt="Signature" style={{ maxHeight: 40, maxWidth: 140, display: 'block', marginBottom: 6, filter: 'var(--sig-filter, none)' }} />}
                <div style={{ color: 'var(--text-2)' }}>{quote.signer_name || 'Customer'} · {formatDate(quote.signed_at)}</div>
              </div>
            </div>
          )}

          {/* Phase 6: Event Timeline */}
          {(() => {
            const timeline = buildTimeline(quote, quoteBookings, linkedInvoice);
            if (!timeline.length) return null;
            return (
              <div className="qb-card">
                <span className="qb-label" style={{ marginBottom: 12, display: 'block' }}>Timeline</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {timeline.map((ev, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: i < timeline.length - 1 ? '1px solid var(--line)' : 'none' }}>
                      <div style={{ fontSize: 16, lineHeight: 1, marginTop: 2, flexShrink: 0, width: 22, textAlign: 'center' }}>{ev.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{ev.label}</div>
                        {ev.detail && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.detail}</div>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--subtle)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {ev.date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Workflow actions */}
          <div className="qb-card">
            <span className="qb-label">Actions</span>
            <div className="qd-send-grid">
              {isApproved && (
                <>
                  <button className="btn btn-primary full-width" type="button" onClick={() => setShowScheduleModal(true)}>📅 Schedule job</button>
                  <button className="btn btn-secondary full-width" type="button" onClick={markComplete}>Skip → Mark complete</button>
                </>
              )}
              {isScheduled && <button className="btn btn-primary full-width" type="button" onClick={markComplete}>✓ Mark complete</button>}
              {isCompleted && !linkedInvoice && (
                <button className="btn btn-primary full-width" type="button" disabled={creatingInvoice} onClick={handleCreateInvoice}>
                  {creatingInvoice ? 'Creating…' : '📄 Create invoice'}
                </button>
              )}
              {linkedInvoice && (
                <Link className="btn btn-primary full-width" to={`/app/invoices/${linkedInvoice.id}`}>
                  📄 View invoice {linkedInvoice.status === 'paid' ? '(Paid)' : ''}
                </Link>
              )}
              {['invoiced','paid'].includes(quote.status) && !linkedInvoice && (
                <div className="qb-muted" style={{ textAlign: 'center', fontSize: 11 }}>Quote has been invoiced</div>
              )}
              <button className="btn btn-secondary full-width" type="button" onClick={handleDuplicate}>Duplicate as new</button>
              {!confirmDelete && (
                <button className="btn btn-secondary full-width" type="button" style={{ color:'var(--red)' }} onClick={() => setConfirmDelete(true)}>
                  {quote.signed_at ? 'Archive quote' : 'Delete quote'}
                </button>
              )}
              {confirmDelete && (
                <>
                  <div className="qb-muted" style={{ textAlign:'center' }}>{quote.signed_at ? 'This will archive the quote. It will still appear in exports.' : 'This cannot be undone.'}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                    <button className="btn btn-secondary btn-sm" style={{ color:'var(--red)' }} type="button" onClick={handleDelete}>{quote.signed_at ? 'Archive' : 'Delete'}</button>
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* FIX: Mobile-only quick send bar — always visible on phone without scrolling */}
      {!isDraft && !isLocked && !isRevision && !isExpired && hasShareToken && (
        <div className="qd-mobile-send-bar">
          <button className="btn btn-primary" type="button" onClick={handleSendEmail} style={{ flex: 1 }}>✉ Send</button>
          <button className="btn btn-secondary" type="button" onClick={handleCopyLink} style={{ flex: 0, padding: '10px 14px' }}>🔗</button>
          {quote.customer?.phone && <button className="btn btn-secondary" type="button" onClick={handleSendText} style={{ flex: 0, padding: '10px 14px' }}>💬</button>}
        </div>
      )}
      {isDraft && (
        <div className="qd-mobile-send-bar">
          <Link className="btn btn-primary" to={`/app/quotes/${quote.id}/edit`} style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}>Continue editing →</Link>
        </div>
      )}
      {isRevision && (
        <div className="qd-mobile-send-bar">
          <Link className="btn btn-primary" to={`/app/quotes/${quote.id}/edit`} style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}>Revise and resend →</Link>
        </div>
      )}
      {isApproved && (
        <div className="qd-mobile-send-bar">
          <button className="btn btn-primary" type="button" onClick={() => setShowScheduleModal(true)} style={{ flex: 1 }}>📅 Schedule job</button>
        </div>
      )}
      {isCompleted && !linkedInvoice && (
        <div className="qd-mobile-send-bar">
          <button className="btn btn-primary" type="button" disabled={creatingInvoice} onClick={handleCreateInvoice} style={{ flex: 1 }}>
            {creatingInvoice ? 'Creating…' : '📄 Create invoice'}
          </button>
        </div>
      )}

      {/* ── Schedule via BookingDrawer ── */}
      <BookingDrawer
        open={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSave={(booking) => {
          setQuote(p => ({ ...p, status: 'scheduled' }));
          setQuoteBookings(prev => [...prev, booking]);
          showToast('Job scheduled', 'success');
          setShowScheduleModal(false);
        }}
        preSelectedQuote={quote}
        preSelectedCustomer={quote?.customer || null}
        customers={[]}
        quotes={[]}
        bookings={quoteBookings}
        userId={user?.id}
        showICSExport={false}
        contextLabel={quote ? `${quote.title || 'Untitled'} · ${quote.customer?.name || 'Customer'}` : null}
      />

      {/* ── Additional Work Creation Modal ── */}
      {showAwModal && (
        <div className="modal-overlay" onClick={() => setShowAwModal(false)}>
          <div className="modal-content aw-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Request additional work">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', letterSpacing: '-.02em' }}>Request Additional Work</h2>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowAwModal(false)}>✕</button>
            </div>

            <div className="qb-muted" style={{ marginBottom: 12, fontSize: 12 }}>
              For: <strong>{quote.customer?.name || 'Customer'}</strong> · {quote.title}
            </div>

            <label className="qb-label" style={{ display: 'block', marginBottom: 4 }}>Title</label>
            <input className="qb-inp" value={awDraft.title} onChange={e => setAwDraft(d => ({ ...d, title: e.target.value }))} placeholder="Additional Work" style={{ marginBottom: 12 }} />

            <label className="qb-label" style={{ display: 'block', marginBottom: 4 }}>Why is this needed?</label>
            <textarea className="qb-inp" value={awDraft.reason} onChange={e => setAwDraft(d => ({ ...d, reason: e.target.value }))} placeholder="While inspecting the electrical panel, we found two circuits without GFCI protection that need to be updated for code compliance." rows={3} style={{ marginBottom: 16, resize: 'vertical' }} />

            <label className="qb-label" style={{ display: 'block', marginBottom: 8 }}>Line items</label>
            {awDraft.items.map((item, idx) => (
              <div key={idx} className="aw-item-row">
                <input className="qb-inp" value={item.name} placeholder="Item name" onChange={e => {
                  const next = [...awDraft.items]; next[idx] = { ...next[idx], name: e.target.value }; setAwDraft(d => ({ ...d, items: next }));
                }} style={{ flex: 2 }} />
                <input className="qb-inp" type="number" value={item.quantity} min="1" step="1" onChange={e => {
                  const next = [...awDraft.items]; next[idx] = { ...next[idx], quantity: Number(e.target.value) || 1 }; setAwDraft(d => ({ ...d, items: next }));
                }} style={{ width: 60 }} placeholder="Qty" />
                <input className="qb-inp" type="number" value={item.unit_price} min="0" step="0.01" onChange={e => {
                  const next = [...awDraft.items]; next[idx] = { ...next[idx], unit_price: Number(e.target.value) || 0 }; setAwDraft(d => ({ ...d, items: next }));
                }} style={{ width: 90 }} placeholder="Price" />
                {awDraft.items.length > 1 && (
                  <button className="btn btn-secondary btn-sm" type="button" style={{ color: 'var(--red)', padding: '4px 8px' }} onClick={() => {
                    setAwDraft(d => ({ ...d, items: d.items.filter((_, i) => i !== idx) }));
                  }}>✕</button>
                )}
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" type="button" style={{ marginTop: 6, marginBottom: 16 }} onClick={() => {
              setAwDraft(d => ({ ...d, items: [...d.items, { name: '', quantity: 1, unit_price: 0, notes: '' }] }));
            }}>+ Add item</button>

            {(() => {
              const validItems = awDraft.items.filter(i => (i.name || '').trim());
              const totals = calculateTotals(validItems.map(i => ({ ...i, included: true })), quote.province || 'ON');
              return (
                <div className="qd-totals" style={{ marginBottom: 16 }}>
                  <div className="qb-total-row"><span>Subtotal</span><span>{currency(totals.subtotal)}</span></div>
                  <div className="qb-total-row"><span>Tax</span><span>{currency(totals.tax)}</span></div>
                  <div className="qb-total-row grand"><span>Total</span><span>{currency(totals.total)}</span></div>
                </div>
              );
            })()}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button className="btn btn-secondary full-width" type="button" disabled={awSaving} onClick={() => handleCreateAdditionalWork(false)}>
                {awSaving ? 'Saving…' : 'Save draft'}
              </button>
              <button className="btn btn-primary full-width" type="button" disabled={awSaving || !awDraft.items.some(i => (i.name || '').trim())} onClick={() => handleCreateAdditionalWork(true)}>
                {awSaving ? 'Sending…' : 'Save & send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Amendment Creation Modal (Phase 3) ── */}
      {showAmendModal && (
        <div className="modal-overlay" onClick={() => setShowAmendModal(false)}>
          <div className="modal-content aw-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Propose amendment">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', letterSpacing: '-.02em' }}>Propose Amendment</h2>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowAmendModal(false)}>✕</button>
            </div>

            <div className="qb-muted" style={{ marginBottom: 6, fontSize: 12 }}>
              For: <strong>{quote.customer?.name || 'Customer'}</strong> · {quote.title}
            </div>
            <div style={{ marginBottom: 12, padding: '8px 10px', background: 'var(--green-bg)', borderRadius: 'var(--r-sm)', border: '1px solid var(--green-line)', fontSize: 12, color: 'var(--green)' }}>
              ✓ Original scope signed by {quote.signer_name || 'customer'} · {formatDate(quote.signed_at)}
            </div>

            <label className="qb-label" style={{ display: 'block', marginBottom: 4 }}>Amendment title</label>
            <input className="qb-inp" value={amendDraft.title} onChange={e => setAmendDraft(d => ({ ...d, title: e.target.value }))} placeholder="Amendment" style={{ marginBottom: 12 }} />

            <label className="qb-label" style={{ display: 'block', marginBottom: 4 }}>What changed and why?</label>
            <textarea className="qb-inp" value={amendDraft.reason} onChange={e => setAmendDraft(d => ({ ...d, reason: e.target.value }))} placeholder="During demolition we discovered water damage behind the tile that needs to be repaired before we can proceed." rows={3} style={{ marginBottom: 16, resize: 'vertical' }} />

            <label className="qb-label" style={{ display: 'block', marginBottom: 8 }}>New / changed items</label>
            {amendDraft.items.map((item, idx) => (
              <div key={idx} className="aw-item-row">
                <input className="qb-inp" value={item.name} placeholder="Item name" onChange={e => {
                  const next = [...amendDraft.items]; next[idx] = { ...next[idx], name: e.target.value }; setAmendDraft(d => ({ ...d, items: next }));
                }} style={{ flex: 2 }} />
                <input className="qb-inp" type="number" value={item.quantity} min="1" step="1" onChange={e => {
                  const next = [...amendDraft.items]; next[idx] = { ...next[idx], quantity: Number(e.target.value) || 1 }; setAmendDraft(d => ({ ...d, items: next }));
                }} style={{ width: 60 }} placeholder="Qty" />
                <input className="qb-inp" type="number" value={item.unit_price} min="0" step="0.01" onChange={e => {
                  const next = [...amendDraft.items]; next[idx] = { ...next[idx], unit_price: Number(e.target.value) || 0 }; setAmendDraft(d => ({ ...d, items: next }));
                }} style={{ width: 90 }} placeholder="Price" />
                {amendDraft.items.length > 1 && (
                  <button className="btn btn-secondary btn-sm" type="button" style={{ color: 'var(--red)', padding: '4px 8px' }} onClick={() => {
                    setAmendDraft(d => ({ ...d, items: d.items.filter((_, i) => i !== idx) }));
                  }}>✕</button>
                )}
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" type="button" style={{ marginTop: 6, marginBottom: 16 }} onClick={() => {
              setAmendDraft(d => ({ ...d, items: [...d.items, { name: '', quantity: 1, unit_price: 0, notes: '' }] }));
            }}>+ Add item</button>

            {(() => {
              const validItems = amendDraft.items.filter(i => (i.name || '').trim());
              const totals = calculateTotals(validItems.map(i => ({ ...i, included: true })), quote.province || 'ON', quote.country || 'CA');
              return (
                <div className="qd-totals" style={{ marginBottom: 16 }}>
                  <div className="qb-total-row"><span>Amendment Subtotal</span><span>{currency(totals.subtotal)}</span></div>
                  <div className="qb-total-row"><span>Tax</span><span>{currency(totals.tax)}</span></div>
                  <div className="qb-total-row grand"><span>Amendment Total</span><span>{currency(totals.total)}</span></div>
                </div>
              );
            })()}

            <div className="qb-muted" style={{ marginBottom: 12, fontSize: 11 }}>
              Customer will see the original signed scope (read-only) alongside this amendment and must sign separately to approve.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button className="btn btn-secondary full-width" type="button" disabled={amendSaving} onClick={() => handleCreateAmendment(false)}>
                {amendSaving ? 'Saving…' : 'Save draft'}
              </button>
              <button className="btn btn-primary full-width" type="button" disabled={amendSaving || !amendDraft.items.some(i => (i.name || '').trim())} onClick={() => handleCreateAmendment(true)}>
                {amendSaving ? 'Sending…' : 'Save & send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
