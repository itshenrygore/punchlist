import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Phone, MessageSquare, Mail, Link2, Eye, FileText, Calendar, Check, RefreshCw, Pencil, Camera, X, MoreHorizontal } from 'lucide-react';
import AppShell from '../components/app-shell';
import { QuoteDetailSkeleton } from '../components/skeletons';
import StatusBadge from '../components/status-badge';
import UpgradePrompt from '../components/upgrade-prompt';
import FollowupModal from '../components/followup-modal';
import { calculateTotals } from '../lib/pricing';
import { currency, formatDate, formatQuoteNumber, friendly } from '../lib/format';
import { deleteQuote, duplicateQuote, getQuote, getProfile, updateQuoteStatus, markFollowedUp, createInvoiceFromQuoteWithAdditionalWork, listInvoices, listAdditionalWork, createAdditionalWork, uploadQuotePhoto, listQuotePhotos, deleteQuotePhoto, replyToCustomer, listAmendments, createAmendment, listBookings, sendInvoiceEmail } from '../lib/api';
import { listTemplates, renderTemplate, getSystemDefaults } from '../lib/api/templates';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../components/toast';
import { safeWriteClipboard, nativeShare } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { labelForDeposit, getFollowUpAdvice, buildTimeline, timeAgo, draftFollowUp } from '../lib/workflow';
import { smsNotify } from '../lib/sms';
import BookingDrawer from '../components/booking-drawer';
import { estimateMonthly, showFinancing } from '../lib/financing';
import { haptic } from '../hooks/use-mobile-ux';

/* ═══════════════════════════════════════════════════════════════════════════
   PUNCHLIST — Quote Detail Page v2 (3-Zone Layout)
   Zone 1: Status Hero — big, clear status + ONE primary action
   Zone 2: Activity Feed — unified timeline with inline reply
   Zone 3: Scope Details — collapsed by default
   Mobile: Tabs split Zone 2+3 into "Details" and "Messages" for cleaner UX
   ═══════════════════════════════════════════════════════════════════════════ */

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
  const [photos, setPhotos] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [amendments, setAmendments] = useState([]);
  // Phase 4: Unified "Add Scope" — replaces separate AW/amendment modals
  const [showAddScope, setShowAddScope] = useState(false);
  const [scopeDraft, setScopeDraft] = useState({ title: '', reason: '', items: [{ name: '', quantity: 1, unit_price: 0, notes: '' }] });
  const [scopeSaving, setScopeSaving] = useState(false);
  const [quoteBookings, setQuoteBookings] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [upgradePrompt, setUpgradePrompt] = useState(null);
  const [scopeOpen, setScopeOpen] = useState(true);
  const [mobileTab, setMobileTab] = useState('details'); // 'details' | 'messages' | 'more'
  const feedRef = useRef(null);
  const mobileTabBarRef = useRef(null);
  // v100 M3: Follow-up / nudge modal
  const [showNudgeModal, setShowNudgeModal] = useState(false);
  const [userTemplates, setUserTemplates] = useState(null); // null = not yet fetched
  // v100 M5: §5.1 SMS send preview, §5.3 AI reply draft, §5.5 auto-invoice pref
  const [lastSentSmsBody, setLastSentSmsBody] = useState(null); // shown after send
  const [lastSentSmsTime, setLastSentSmsTime] = useState(null);
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [autoSendInvoicePref, setAutoSendInvoicePref] = useState(true); // loaded from profile

  useEffect(() => {
    if (!quoteId) return;
    let cancelled = false;
    if (user) getProfile(user.id).then(p => {
      if (cancelled) return;
      setUserProfile(p);
      setAutoSendInvoicePref(p?.auto_send_invoice_on_complete !== false);
      listTemplates(user.id).then(t => { if (!cancelled) setUserTemplates(t); }).catch(() => { if (!cancelled) setUserTemplates([]); });
    }).catch(e => console.warn('[PL]', e));
    getQuote(quoteId)
      .then(data => {
        if (cancelled) return;
        setQuote(data);
        if (['completed','invoiced','paid'].includes(data.status)) {
          listInvoices(user?.id).then(invs => { if (!cancelled) { const l = invs.find(i => i.quote_id === quoteId); if (l) setLinkedInvoice(l); } }).catch(e => console.warn('[PL]', e));
        }
        listAdditionalWork(quoteId).then(d => { if (!cancelled) setAdditionalWork(d); }).catch(e => console.warn('[PL]', e));
        listAmendments(quoteId).then(d => { if (!cancelled) setAmendments(d); }).catch(e => console.warn('[PL]', e));
        listBookings(user?.id).then(all => { if (!cancelled) setQuoteBookings(all.filter(b => b.quote_id === quoteId)); }).catch(e => console.warn('[PL]', e));
        listQuotePhotos(quoteId).then(d => { if (!cancelled) setPhotos(d); }).catch(e => console.warn('[PL]', e));
      })
      .catch(e => showToast(friendly(e), 'error'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [quoteId]);

  // v100 Phase 9 (UX-006): honor cmdk "Nudge {firstName}" handoff.
  // The command palette writes sessionStorage.pl_cmdk_intent and
  // navigates here; we pick it up once the quote is loaded.
  useEffect(() => {
    if (!quote || !quoteId) return;
    try {
      const raw = sessionStorage.getItem('pl_cmdk_intent');
      if (!raw) return;
      const intent = JSON.parse(raw);
      sessionStorage.removeItem('pl_cmdk_intent');
      // Ignore stale (> 30s) or mismatched intents
      if (!intent || Date.now() - (intent.at || 0) > 30_000) return;
      if (intent.kind === 'nudge' && intent.quoteId === quoteId) {
        setShowNudgeModal(true);
      }
    } catch (e) { console.warn('[PL]', e); }
  }, [quote, quoteId]);

  // Derived
  const shareUrl = quote?.share_token ? `${window.location.origin}/public/${quote.share_token}` : '';
  const hasShareToken = Boolean(quote?.share_token);
  const isDraft = quote?.status === 'draft';
  const isRevision = ['revision_requested','declined','question_asked'].includes(quote?.status);
  const isApproved = ['approved','approved_pending_deposit'].includes(quote?.status);
  const isScheduled = quote?.status === 'scheduled';
  const isCompleted = quote?.status === 'completed';
  const isLocked = isApproved || isScheduled || isCompleted || ['invoiced','paid'].includes(quote?.status);
  const isSigned = Boolean(quote?.signed_at);
  const isExpired = quote?.expires_at && new Date(quote.expires_at) < new Date() && !['approved','approved_pending_deposit','scheduled','completed'].includes(quote?.status);
  const cName = userProfile?.company_name || userProfile?.full_name || '';

  // Actions
  async function handleCreateInvoice() { setCreatingInvoice(true); try { const inv = await createInvoiceFromQuoteWithAdditionalWork(user.id, quote); showToast('Invoice created', 'success'); haptic('success'); navigate(`/app/invoices/${inv.id}`); } catch(e){ showToast(friendly(e),'error'); } finally { setCreatingInvoice(false); } }

  // Phase 4: Smart scope routing — one handler, system picks the mechanism
  function getScopeMode() {
    if (!quote) return 'edit';
    if (isSigned) return 'amendment';          // Signed → amendment (needs customer re-signature)
    if (isScheduled || isCompleted) return 'additional_work'; // In-progress → additional work request
    return 'edit';                              // Not signed → update existing quote directly
  }

  async function handleAddScope(send) {
    const mode = getScopeMode();
    const validItems = scopeDraft.items.filter(i => (i.name || '').trim());
    if (!validItems.length) { showToast('Add at least one item', 'error'); return; }

    if (mode === 'edit') {
      // Not signed — navigate to editor (items can be added there)
      setShowAddScope(false);
      navigate(`/app/quotes/${quote.id}/edit`);
      return;
    }

    setScopeSaving(true);
    try {
      if (mode === 'amendment') {
        const a = await createAmendment(user.id, {
          quote_id: quote.id, title: scopeDraft.title || 'Amendment', reason: scopeDraft.reason,
          items: validItems, province: quote.province || 'ON', country: quote.country || 'CA', status: send ? 'sent' : 'draft',
        });
        setAmendments(p => [a, ...p]);
        showToast(send ? 'Amendment sent to customer' : 'Draft saved', 'success');
      } else {
        const r = await createAdditionalWork(user.id, {
          quote_id: quote.id, customer_id: quote.customer_id, title: scopeDraft.title || 'Additional Work',
          reason: scopeDraft.reason, items: validItems, province: quote.province || 'ON', status: send ? 'sent' : 'draft',
        });
        setAdditionalWork(p => [r, ...p]);
        showToast(send ? 'Sent to customer for approval' : 'Draft saved', 'success');
        if (send) navigate(`/app/additional-work/${r.id}`);
      }
      setShowAddScope(false);
      setScopeDraft({ title: '', reason: '', items: [{ name: '', quantity: 1, unit_price: 0, notes: '' }] });
    } catch (e) { showToast(friendly(e), 'error'); }
    finally { setScopeSaving(false); }
  }

  async function handleReply() { if(!replyText.trim()||!quote?.share_token)return; setReplySending(true); try { const r = await replyToCustomer(quote.share_token, replyText.trim(), user.id); setReplyText(''); if(r.conversation) setQuote(p=>({...p,conversation:r.conversation})); showToast('Reply sent','success'); if(quote.customer?.phone) smsNotify.contractorReply({to:quote.customer.phone,contractorName:cName||'Your contractor',quoteTitle:(quote.title||'quote').slice(0,40),shareToken:quote.share_token}); } catch(e){ showToast(friendly(e),'error'); } finally { setReplySending(false); } }

  // UX-031 fix: single rendering path through renderTemplate so {firstName} is
  // always substituted correctly. The old fallback used a JS ternary expression
  // (`Hi{fn?' '+fn:''}`) that .replace('{firstName}') never matched.
  async function handleSendText() {
    if (!hasShareToken) return showToast('This quote doesn’t have a share link yet — save it first.', 'error');
    const ph = quote.customer?.phone;
    if (!ph) return showToast('No phone on file for this customer.', 'error');

    const msg = buildTemplatedSmsBody();

    if (!['sent', 'viewed', 'approved', 'approved_pending_deposit', 'scheduled', 'completed'].includes(quote.status)) {
      try {
        const u = await updateQuoteStatus(quote.id, { status: 'sent', sent_at: new Date().toISOString() });
        setQuote(p => ({ ...p, ...u, status: 'sent', sent_at: new Date().toISOString() }));
      } catch (e) { console.warn('[PL]', e); }
    }

    let r;
    try {
      r = await smsNotify.customMessage({ to: ph, body: msg });
    } catch (e) {
      // sendSMS already swallows fetch errors but be defensive — never let
      // a thrown error from this path bubble up as an uncaught rejection.
      r = { ok: false, reason: 'network_error' };
      console.warn('[PL] handleSendText caught:', e);
    }

    if (r?.ok) {
      setQuote(p => ({ ...p, sent_at: new Date().toISOString() }));
      showToast(`Texted to ${quote.customer?.name || ph}`, 'success');
      haptic('success');
      // v100 M5 §5.1: preview of what was actually sent
      setLastSentSmsBody(msg);
      setLastSentSmsTime(new Date().toISOString());
      setTimeout(() => setLastSentSmsBody(null), 15000);
      return;
    }

    // Server-side send failed — surface a clear reason and fall back to the
    // user's native SMS app. Reasons we recognize:
    //   not_configured  — Twilio env vars missing on the server
    //   invalid_phone   — number didn't normalize to +1XXXXXXXXXX
    //   twilio_error    — Twilio API returned non-2xx (carrier reject, etc.)
    //   network_error   — fetch threw
    //   no_phone        — defensive fallback
    const reasonMessages = {
      invalid_phone:  `That phone number doesn't look right (${ph}). Update it and try again.`,
      not_configured: 'Direct send is unavailable right now — opening your messages app instead.',
      twilio_error:   'Send failed at the carrier. Opening your messages app so you can send manually.',
      network_error:  'No internet — opening your messages app so you can send manually.',
    };
    const userMsg = reasonMessages[r?.reason] || 'Opening messages…';
    const isHardError = r?.reason === 'invalid_phone';

    showToast(userMsg, isHardError ? 'error' : 'info');

    // For invalid phones, don't open sms: — it'd just dial a broken number.
    if (!isHardError) {
      try {
        window.open(`sms:${ph}?body=${encodeURIComponent(msg)}`, '_self');
      } catch (e) {
        console.warn('[PL] sms: scheme failed', e);
      }
    }
  }

  // Helper: build the SMS body from user template (or system default) with all tokens substituted.
  // Used by both the primary "Text X" button and the small icon buttons in the contact row.
  function buildTemplatedSmsBody() {
    const firstName  = quote.customer?.name?.split(' ')[0] || '';
    const senderName = userProfile?.company_name || userProfile?.full_name || '';
    const tmplBody =
      userTemplates?.find(t => t.template_key === 'initial_sms')?.body ||
      getSystemDefaults().initial_sms;
    return renderTemplate(tmplBody, {
      firstName,
      senderName,
      quoteTitle: quote.title || 'your quote',
      total:      currency(quote.total),
      link:       shareUrl,
    });
  }

  // Helper: build email subject + body with the same template tokens.
  // Email gets a slightly longer body — we add a subject line that previews the job.
  function buildTemplatedEmail() {
    const firstName  = quote.customer?.name?.split(' ')[0] || '';
    const senderName = userProfile?.company_name || userProfile?.full_name || '';
    const subject = `${quote.title || 'Your quote'} — ${currency(quote.total)}`;
    const body = renderTemplate(
      userTemplates?.find(t => t.template_key === 'initial_sms')?.body ||
      getSystemDefaults().initial_sms,
      {
        firstName,
        senderName,
        quoteTitle: quote.title || 'your quote',
        total:      currency(quote.total),
        link:       shareUrl,
      }
    );
    return { subject, body };
  }

  // Open native SMS app with the templated message pre-filled.
  // Used by the small "text" icon button — distinct from handleSendText (which sends via Twilio).
  function handleOpenSmsApp() {
    const ph = quote.customer?.phone;
    if (!ph) return;
    const body = hasShareToken ? buildTemplatedSmsBody() : '';
    window.open(`sms:${ph}${body ? `?body=${encodeURIComponent(body)}` : ''}`, '_self');
  }

  // Open native email client with subject+body pre-filled.
  function handleOpenEmailApp() {
    const em = quote.customer?.email;
    if (!em) return;
    if (!hasShareToken) {
      // No share link yet — just open with empty body, don't fail silently.
      window.open(`mailto:${em}`, '_self');
      return;
    }
    const { subject, body } = buildTemplatedEmail();
    window.open(`mailto:${em}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_self');
  }

  async function handleCopyLink() {
    if (!hasShareToken) return showToast('This quote doesn’t have a share link yet — save it first.', 'error');
    try {
      await safeWriteClipboard(shareUrl);
      showToast('Link copied', 'success');
      if (!['sent', 'viewed', 'approved', 'approved_pending_deposit', 'scheduled', 'completed'].includes(quote.status)) {
        const u = await updateQuoteStatus(quote.id, { status: 'sent' });
        setQuote(p => ({ ...p, ...u, status: 'sent' }));
      }
    } catch (e) { showToast(friendly(e), 'error'); }
  }

  async function handleDownloadPdf() {
    if (!quote?.share_token) return;
    setPdfLoading(true);
    try {
      const url = `/api/export-pdf?token=${quote.share_token}`;
      const mob = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (mob) {
        const t = await fetch(url, { method: 'HEAD' }).catch(() => null);
        if (t?.ok) { window.location.href = url; showToast('Opening PDF…', 'success'); }
        else { window.open(`/public/${quote.share_token}?print=1`, '_blank'); }
      } else {
        const r = await fetch(url);
        if (r.ok && r.headers.get('content-type')?.includes('pdf')) {
          const b = await r.blob();
          const u = URL.createObjectURL(b);
          const a = document.createElement('a');
          a.href = u;
          a.download = `${(quote.title || 'Quote').replace(/[^a-zA-Z0-9 ]/g, '')}.pdf`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(u), 5000);
          showToast('PDF downloaded', 'success');
        } else {
          window.open(`/public/${quote.share_token}?print=1`, '_blank');
        }
      }
    } catch { window.open(`/public/${quote.share_token}?print=1`, '_blank'); }
    finally { setPdfLoading(false); }
  }

  async function markDepositPaid() { try{const u=await updateQuoteStatus(quote.id,{deposit_status:'paid',status:quote.status==='approved_pending_deposit'?'approved':quote.status,deposit_paid_at:new Date().toISOString()});setQuote(p=>({...p,...u,deposit_status:'paid'}));showToast('Deposit marked paid','success');}catch(e){showToast(friendly(e),'error');} }
  async function markComplete() { try{const u=await updateQuoteStatus(quote.id,{status:'completed'});setQuote(p=>({...p,...u,status:'completed'}));showToast('Job marked complete','success');haptic('success');}catch(e){showToast(friendly(e),'error');} }
  async function completeAndInvoice() { setCreatingInvoice(true); try { await updateQuoteStatus(quote.id, { status: 'completed' }); setQuote(p => ({ ...p, status: 'completed' })); const inv = await createInvoiceFromQuoteWithAdditionalWork(user.id, { ...quote, status: 'completed' }); // v100 M5 §5.5: auto-send if pref is on
    if (autoSendInvoicePref) { try { const fullProfile = userProfile || {}; await sendInvoiceEmail({ invoice: inv, profile: fullProfile, payments: [] }); showToast('Job complete — invoice sent to customer', 'success'); } catch(e) { console.warn('[PL] auto-send invoice failed:', e); showToast('Job complete — invoice created (send failed)', 'success'); } } else { showToast('Job complete — invoice created', 'success'); } navigate(`/app/invoices/${inv.id}`); } catch(e) { showToast(friendly(e), 'error'); } finally { setCreatingInvoice(false); } }

  // v100 M3: Replace legacy handleFollowUp — now opens the NudgeModal.
  // The modal posts to /api/send-followup and returns the new counter state.
  function openNudgeModal() {
    setShowNudgeModal(true);
  }

  function handleNudgeSent(newState) {
    setShowNudgeModal(false);
    // Merge returned state into quote for live UI update
    setQuote(prev => ({
      ...prev,
      followup_count:       newState.followup_count,
      last_followup_at:     newState.last_followup_at,
      views_since_followup: 0,
    }));
    showToast('Nudge sent', 'success');
    haptic('success');
  }

  // v100 M5 §5.3: Pre-draft a reply using AI when customer has a question
  async function handleAiDraftReply() {
    if (!quote?.share_token) return;
    setAiDraftLoading(true);
    try {
      const convo = Array.isArray(quote.conversation) ? quote.conversation : [];
      const lastMsg = [...convo].reverse().find(m => m.role === 'customer')?.text || '';
      const context = `Quote: "${quote.title || 'Untitled'}" — ${currency(quote.total)}\nCustomer question: "${lastMsg}"`;
      const r = await fetch('/api/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'reply_draft',
          context,
          quoteTitle: quote.title,
          customerName: quote.customer?.name?.split(' ')[0] || 'there',
          contractorName: cName,
        }),
      });
      if (r.ok) {
        const d = await r.json();
        if (d.text) setReplyText(d.text);
      }
    } catch (e) { console.warn('[PL] AI draft failed:', e); }
    finally { setAiDraftLoading(false); }
  }

  async function handleDuplicate() { try{const n=await duplicateQuote(user.id,quote);showToast('Draft created','success');navigate(`/app/quotes/${n.id}/edit`);}catch(e){showToast(friendly(e),'error');} }
  async function handleDelete() { try{if(quote.signed_at){await updateQuoteStatus(quote.id,{archived_at:new Date().toISOString()});showToast('Archived','success');}else{await deleteQuote(quote.id);showToast('Deleted','success');}navigate('/app');}catch(e){showToast(friendly(e),'error');} }

  // Timeline
  const timeline = useMemo(() => quote ? buildTimeline(quote, quoteBookings, linkedInvoice, amendments, additionalWork) : [], [quote, quoteBookings, linkedInvoice, amendments, additionalWork]);
  const groupedItems = useMemo(() => { if(!quote)return {}; return (quote.line_items||[]).reduce((a,i)=>{const k=i.category||(i.item_type==='optional'?'Options':'Scope');a[k]||=[];a[k].push(i);return a;},{}); }, [quote]);

  // Loading/error
  if (loading) return <QuoteDetailSkeleton />;
  if (!quote) return <AppShell title="Quote"><div className="empty-state" style={{textAlign:'center',padding:'60px 20px'}}><div style={{marginBottom:12,color:'var(--muted)'}}><FileText size={36}/></div><h3 style={{margin:'0 0 8px'}}>Quote not found</h3><Link className="btn btn-secondary" to="/app">Back to dashboard</Link></div></AppShell>;

  const inlineEditBtn = isLocked ? null : isRevision && quote.status!=='question_asked' ? <Link className="btn btn-primary btn-sm" to={`/app/quotes/${quote.id}/edit`} style={{marginLeft:8,flexShrink:0}}>Revise →</Link> : <Link className="btn btn-secondary btn-sm" to={`/app/quotes/${quote.id}/edit`} style={{marginLeft:8,flexShrink:0}}>Edit</Link>;
  const advice = getFollowUpAdvice(quote);

  // v100 M5 §5.7: Lifecycle strip — ordered steps with current state filled
  const lifecycleSteps = (() => {
    const s = quote.status;
    const steps = [
      { key: 'sent',      label: 'Sent' },
      { key: 'viewed',    label: 'Viewed' },
      { key: 'approved',  label: 'Approved' },
      { key: 'scheduled', label: 'Scheduled' },
      { key: 'completed', label: 'Complete' },
      { key: 'paid',      label: 'Paid' },
    ];
    // Map current status → step index
    const ORDER = { draft:0, sent:0, viewed:1, approved:2, approved_pending_deposit:2, revision_requested:1, declined:1, question_asked:1, scheduled:3, completed:4, invoiced:4, paid:5 };
    const cur = ORDER[s] ?? 0;
    return steps.map((st, i) => ({
      ...st,
      done: i < cur,
      current: i === cur,
    }));
  })();

  return (
    <AppShell title="Quote">
      {upgradePrompt && <UpgradePrompt trigger={upgradePrompt.trigger} context={upgradePrompt.context} onDismiss={()=>setUpgradePrompt(null)} />}
      <div className="qd-grid">
        <section className="qd-main">

          {/* ══════════ §5.7 LIFECYCLE STRIP ══════════ */}
          {!isDraft && (
            <div className="ql-strip" role="progressbar" aria-label={`Quote lifecycle: ${quote.status}`}>
              {lifecycleSteps.map((step, i) => (
                <div key={step.key} style={{display:'flex',alignItems:'center'}}>
                  <div className={`ql-step${step.done?' ql-step--done':step.current?' ql-step--active':''}`}>
                    <div className="ql-dot" />
                    <span>{step.label}</span>
                  </div>
                  {i < lifecycleSteps.length - 1 && (
                    <div className={`ql-connector${step.done?' ql-connector--done':''}`} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ══════════ MOBILE TAB BAR ══════════ */}
          <div className="qd-mobile-tabs" ref={mobileTabBarRef}>
            <button type="button" className={`qd-mobile-tab${mobileTab === 'details' ? ' qd-mobile-tab--active' : ''}`} onClick={() => setMobileTab('details')}>Details</button>
            <button type="button" className={`qd-mobile-tab${mobileTab === 'messages' ? ' qd-mobile-tab--active' : ''}`} onClick={() => { setMobileTab('messages'); requestAnimationFrame(() => { mobileTabBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); }}>
              Messages
              {(() => { const mc = timeline.filter(e=>e.type==='customer_message'||e.type==='contractor_message').length; return mc > 0 ? <span className="qd-mobile-tab-badge">{mc}</span> : null; })()}
            </button>
            <button type="button" className={`qd-mobile-tab qd-mobile-tab--more${mobileTab === 'more' ? ' qd-mobile-tab--active' : ''}`} onClick={() => setMobileTab('more')}>
              <MoreHorizontal size={14} style={{ verticalAlign: 'middle', marginRight: 3 }} />More
              {(photos.length > 0 || amendments.length > 0 || additionalWork.length > 0) && <span className="qd-mobile-tab-dot" />}
            </button>
          </div>

          {/* ══════════ ZONE 1: STATUS HERO ══════════ */}
          <div className="qd-hero">
            <div className="qd-hero-top">
              <div style={{flex:1,minWidth:0}}>
                <h1 className="qd-hero-title" style={{display:'flex',alignItems:'center'}}>{quote.title||'Untitled'}{inlineEditBtn}</h1>
                <div className="qd-hero-meta">
                  {quote.quote_number && <span className="qd-hero-qnum">{formatQuoteNumber(quote.quote_number)}</span>}
                  <span>{quote.customer?.name||'No customer'}</span>
                  {quote.trade && <span>· {quote.trade}</span>}
                  <span>· {currency(quote.total)}</span>
                </div>
              </div>
              <div style={{display:'flex',gap:4,flexShrink:0}}>
                {quote.customer?.phone && <a href={`tel:${quote.customer.phone}`} className="btn btn-secondary btn-sm" aria-label="Call customer"><Phone size={14} /></a>}
                {quote.customer?.phone && <button type="button" onClick={handleOpenSmsApp} className="btn btn-secondary btn-sm" aria-label="Text customer with quote details"><MessageSquare size={14} /></button>}
                {quote.customer?.email && <button type="button" onClick={handleOpenEmailApp} className="btn btn-secondary btn-sm" aria-label="Email customer with quote details"><Mail size={14} /></button>}
              </div>
            </div>

            {isDraft && <div className="qd-phase-banner qd-phase-draft"><div className="qd-phase-dot qd-dot-draft"></div><div className="qd-phase-body"><div className="qd-phase-title">Draft — not sent yet</div><div className="qd-phase-hint">Finish items and pricing, then send.</div></div><Link className="btn btn-primary" to={`/app/quotes/${quote.id}/edit`} style={{whiteSpace:'nowrap',flexShrink:0}}>Continue editing →</Link></div>}

            {quote.status==='sent' && <div className="qd-phase-banner qd-phase-waiting"><div className="qd-phase-dot qd-dot-sent"></div><div className="qd-phase-body"><div className="qd-phase-title">Sent — waiting on {quote.customer?.name?.split(' ')[0] || 'customer'}</div><div className="qd-phase-hint">{quote.sent_at?`Sent ${formatDate(quote.sent_at)}`:'Sent'}{quote.view_count>0?` · viewed ${quote.view_count}×`:' · not opened yet — a quick text can help'}</div>{/* v100 M3: follow-up context block */}{(() => { const fc=Number(quote.followup_count)||0; const lf=quote.last_followup_at; const vs=Number(quote.views_since_followup)||0; if(fc===0)return null; const daysSince=lf?Math.round((Date.now()-new Date(lf).getTime())/86_400_000):null; const urgColor=daysSince===null?'var(--text-2)':daysSince<2?'var(--green)':daysSince<5?'var(--amber)':'var(--red)'; return <div className="qd-followup-context"><span className="qd-followup-context__stat" style={{color:urgColor}}>Last nudge {daysSince===0?'today':daysSince===1?'1d ago':`${daysSince}d ago`}</span><span className="qd-followup-context__stat">{vs} view{vs!==1?'s':''} since</span></div>; })()}{advice && <div style={{marginTop:4,fontSize: 'var(--text-2xs)',color:'var(--text-2)'}}>{advice.emoji} {advice.headline}</div>}</div>{advice&&advice.urgency!=='low' && <button className="btn btn-primary btn-sm shrink-0" type="button" onClick={openNudgeModal}>{quote.customer?.phone ? `Nudge ${quote.customer?.name?.split(' ')[0] || ''}` : 'Send nudge'}</button>}</div>}

            {quote.status==='viewed' && <div className="qd-phase-banner qd-phase-hot"><div className="qd-phase-dot qd-dot-viewed"></div><div className="qd-phase-body"><div className="qd-phase-title">{quote.customer?.name?.split(' ')[0] || 'Customer'} is reviewing{quote.view_count>1?` (${quote.view_count}×)`:''}</div><div className="qd-phase-hint">{showFinancing(quote.total) && quote.view_count > 1 ? `They've looked ${quote.view_count} times — the monthly option (from ${currency(estimateMonthly(quote.total))}/mo) may be what they're considering. A quick text could close this.` : 'They\'re looking at it — a quick text can close this.'}</div>{/* v100 M3: follow-up context block */}{(() => { const fc=Number(quote.followup_count)||0; const lf=quote.last_followup_at; const vs=Number(quote.views_since_followup)||0; if(fc===0)return null; const daysSince=lf?Math.round((Date.now()-new Date(lf).getTime())/86_400_000):null; const urgColor=daysSince===null?'var(--text-2)':daysSince<2?'var(--green)':daysSince<5?'var(--amber)':'var(--red)'; return <div className="qd-followup-context"><span className="qd-followup-context__stat" style={{color:urgColor}}>Last nudge {daysSince===0?'today':daysSince===1?'1d ago':`${daysSince}d ago`}</span><span className="qd-followup-context__stat">{vs} view{vs!==1?'s':''} since</span></div>; })()}</div><button className="btn btn-primary btn-sm shrink-0" type="button" onClick={openNudgeModal}>{quote.customer?.phone ? `Nudge ${quote.customer?.name?.split(' ')[0] || ''}` : 'Send nudge'}</button></div>}

            {isRevision && <div className="qd-phase-banner qd-phase-revision"><div className="qd-phase-dot" style={{background:'var(--amber)'}}></div><div className="qd-phase-body"><div className="qd-phase-title">{quote.status==='declined'?'Customer declined':quote.status==='question_asked'?'Customer has a question':'Changes requested'}</div><div className="qd-phase-hint">{quote.status==='question_asked'?'Reply in the feed below.':'Review feedback and respond.'}</div></div>{quote.status!=='question_asked' && <Link className="btn btn-primary shrink-0" to={`/app/quotes/${quote.id}/edit`} >Revise →</Link>}</div>}

            {/* ── Surface the customer's actual feedback text ── */}
            {isRevision && (() => {
              // Extract latest customer message from conversation or internal_notes
              const convo = Array.isArray(quote.conversation) ? quote.conversation : [];
              const lastCustomerMsg = [...convo].reverse().find(m => m.role === 'customer');
              const feedbackText = lastCustomerMsg?.text
                || (quote.internal_notes || '').match(/(?:Change request|Question \(.+?\)|Declined): (.+?)(?:\n|$)/)?.[1]
                || quote.decline_reason
                || quote.revision_notes
                || (quote.status === 'declined' ? 'Customer declined — no reason given' : 'Customer requested changes');
              return (
                <div className="qd-customer-feedback">
                  <div className="qd-customer-feedback-label">
                    {quote.status === 'question_asked' ? 'Customer asked' : quote.status === 'declined' ? 'Reason given' : 'Customer feedback'}
                  </div>
                  <div className="qd-customer-feedback-text">"{feedbackText}"</div>
                  <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--muted)', marginTop: 6 }}>
                    — {quote.customer?.name || 'Customer'}{lastCustomerMsg?.timestamp ? ` · ${timeAgo(lastCustomerMsg.timestamp)}` : ''}
                  </div>
                </div>
              );
            })()}

            {isApproved && !isExpired && (() => {
              const closeTime = (quote.approved_at || quote.signed_at) && quote.sent_at
                ? Math.max(0, Math.round((new Date(quote.approved_at || quote.signed_at) - new Date(quote.sent_at)) / 3600000))
                : null;
              const closeLabel = closeTime !== null
                ? closeTime < 1 ? 'Approved within an hour' : closeTime < 24 ? `Approved in ${closeTime} hours` : closeTime < 48 ? 'Approved next day' : null
                : null;
              return (
              <div className="qd-phase-banner qd-phase-approved"><div className="qd-phase-dot qd-dot-approved"></div><div className="qd-phase-body"><div className="qd-phase-title">Approved{quote.signer_name?` by ${quote.signer_name}`:''}{showFinancing(quote.total)?` · from ${currency(estimateMonthly(quote.total))}/mo option`:''}</div><div className="qd-phase-hint">{quote.deposit_required&&quote.deposit_status!=='paid'?`Deposit ${currency(quote.deposit_amount)} pending`:'Ready to schedule.'}</div><div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:6,fontSize: 'var(--text-2xs)',color:'var(--text-2)'}}>{isSigned&&<span>Signed {formatDate(quote.signed_at)}</span>}{quote.deposit_required&&Number(quote.deposit_amount)>0&&<span style={{color:quote.deposit_status==='paid'?'var(--green)':'var(--amber)'}}>{currency(quote.deposit_amount)} {quote.deposit_status==='paid'?'paid':'pending'}</span>}{closeLabel&&<span style={{color:'var(--green)'}}>{closeLabel}</span>}</div></div>{/* §5.4: Schedule is always the primary CTA; deposit-paid is secondary */}<div style={{display:'flex',gap:6,flexShrink:0,flexDirection:'column',alignItems:'stretch'}}><button className="btn btn-primary shrink-0" type="button" onClick={()=>setShowScheduleModal(true)}><Calendar size={13} style={{verticalAlign:'middle',marginRight:5}}/>Schedule</button>{quote.deposit_required&&quote.deposit_status!=='paid'&&<button className="btn btn-secondary btn-sm shrink-0" type="button" onClick={markDepositPaid}>Mark deposit paid</button>}</div></div>
              );
            })()}

            {isScheduled && <div className="qd-phase-banner qd-phase-scheduled"><div className="qd-phase-dot qd-dot-scheduled"></div><div className="qd-phase-body"><div className="qd-phase-title">Job scheduled</div><div className="qd-phase-hint">{quoteBookings.length>0?`Booked for ${formatDate(quoteBookings[quoteBookings.length-1].scheduled_for)}.`:''} Mark complete when done.</div></div><div style={{display:'flex',gap:6,flexShrink:0}}><button className="btn btn-primary" type="button" disabled={creatingInvoice} onClick={completeAndInvoice} style={{whiteSpace:'nowrap'}}>{creatingInvoice?'Creating…':'Complete & Invoice'}</button><button className="btn btn-secondary btn-sm" type="button" onClick={markComplete} style={{whiteSpace:'nowrap'}}>Complete only</button></div></div>}

            {isCompleted && !linkedInvoice && <div className="qd-phase-banner qd-phase-done"><div className="qd-phase-dot qd-dot-done"></div><div className="qd-phase-body"><div className="qd-phase-title">Job complete</div><div className="qd-phase-hint">Invoice to collect the balance.</div></div><button className="btn btn-primary shrink-0" type="button" disabled={creatingInvoice} onClick={handleCreateInvoice} >{creatingInvoice?'Creating…':'Invoice'}</button></div>}
            {isCompleted && linkedInvoice && <div className="qd-phase-banner qd-phase-done"><div className="qd-phase-dot qd-dot-done"></div><div className="qd-phase-body"><div className="qd-phase-title">{linkedInvoice.status==='paid'?'Paid ✓':'Invoiced — awaiting payment'}</div></div><Link className="btn btn-secondary shrink-0" to={`/app/invoices/${linkedInvoice.id}`} >View invoice →</Link></div>}
            {(quote.status==='invoiced'||quote.status==='paid')&&<div className="qd-phase-banner qd-phase-done"><div className="qd-phase-dot qd-dot-done"></div><div className="qd-phase-body"><div className="qd-phase-title">{quote.status==='paid'?'Paid ✓':'Invoiced'}</div></div>{linkedInvoice&&<Link className="btn btn-secondary shrink-0" to={`/app/invoices/${linkedInvoice.id}`} >View invoice →</Link>}</div>}
            {isExpired && <div className="qd-phase-banner qd-phase-expired"><div className="qd-phase-dot qd-dot-expired"></div><div className="qd-phase-body"><div className="qd-phase-title">Expired {formatDate(quote.expires_at)}</div></div><Link className="btn btn-primary shrink-0" to={`/app/quotes/${quote.id}/edit`} >Renew →</Link></div>}

            {/* ── §5.1 SMS send preview card — fades out after 15s ── */}
            {lastSentSmsBody && (
              <div className="qd-sms-preview">
                <div className="qd-sms-preview__label">Sent to {quote.customer?.name || quote.customer?.phone}</div>
                <div className="qd-sms-preview__bubble">{lastSentSmsBody}</div>
                <div className="qd-sms-preview__meta">{quote.customer?.phone} · {lastSentSmsTime && new Date(lastSentSmsTime).toLocaleTimeString('en-CA',{hour:'2-digit',minute:'2-digit'})}</div>
              </div>
            )}

            {/* ── §5.3 Contextual actions — decline / question ── */}
            {quote.status === 'declined' && (
              <div className="qd-contextual-actions">
                <span className="qd-contextual-actions__label">What do you want to do?</span>
                <Link className="btn btn-secondary btn-sm" to={`/app/quotes/${quote.id}/edit`}><Pencil size={13} style={{verticalAlign:"middle",marginRight:5}}/>Revise &amp; resend</Link>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleDuplicate}><FileText size={13} style={{verticalAlign:"middle",marginRight:5}}/>Duplicate as new</button>
                <button type="button" className="btn btn-secondary btn-sm" style={{color:'var(--muted)'}} onClick={()=>setConfirmDelete(true)}>Archive</button>
              </div>
            )}
            {quote.status === 'question_asked' && (
              <div className="qd-contextual-actions">
                <span className="qd-contextual-actions__label">Customer has a question — reply in the feed below</span>
                {process.env.VITE_OPENAI_API_KEY !== undefined && (
                  <button type="button" className="btn btn-secondary btn-sm" disabled={aiDraftLoading} onClick={handleAiDraftReply}>
                    {aiDraftLoading ? 'Drafting…' : 'Draft a reply'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ══════════ ZONE 2: COMMUNICATION ══════════ */}
          <div className={`qd-feed${mobileTab !== 'messages' ? ' qd-zone-messages' : ''}`}>
            <div className="qd-feed-header"><span style={{fontWeight:700,fontSize:"var(--text-base)"}}><MessageSquare size={13} style={{verticalAlign:"middle",marginRight:6}}/>Messages</span><span className="qb-muted fs-12">{(() => { const mc = timeline.filter(e=>e.type==='customer_message'||e.type==='contractor_message').length; return mc > 0 ? `${mc} message${mc !== 1 ? 's' : ''}` : ''; })()}</span></div>
            {/* Reply input first — most important action (hide on paid/invoiced — job is done) */}
            {!isDraft && hasShareToken && !['paid','invoiced'].includes(quote?.status) && (
              <div className="qd-feed-reply" style={{marginBottom:12}}><div style={{display:'flex',gap:8,alignItems:'flex-end'}}><textarea value={replyText} onChange={e=>setReplyText(e.target.value)} placeholder={`Message ${quote.customer?.name?.split(' ')[0]||'customer'}…`} rows={1} className="qd-feed-reply-input" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleReply();}}} onInput={e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,120)+'px';}} /><button type="button" className="btn btn-primary btn-sm" disabled={replySending||!replyText.trim()} onClick={handleReply} style={{flexShrink:0,height:36}}>{replySending?'…':'Send'}</button></div><div style={{fontSize: 'var(--text-2xs)',color:'var(--muted)',marginTop:4}}>{quote.customer?.email?'Email + quote page':'Quote page only'}{quote.customer?.phone?' + SMS':''}</div></div>
            )}
            {/* Messages thread — customer questions and contractor replies only */}
            {(() => { const msgs = timeline.filter(e=>e.type==='customer_message'||e.type==='contractor_message'); return msgs.length > 0 ? (
              <div className="qd-feed-list">
                {msgs.map((ev,i) => {
                  const e=ev.data; const isCust=e.role==='customer'; return (
                  <div key={`m${i}`} className={`qd-feed-msg ${isCust?'':'qd-feed-msg--right'}`}><div className={`qd-feed-msg-avatar ${isCust?'':'qd-feed-msg-avatar--you'}`}>{isCust?(quote.customer?.name?.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase()||'?'):'Me'}</div><div style={{maxWidth:'80%',minWidth:0}}><div className="qd-feed-msg-meta" style={{textAlign:isCust?'left':'right'}}><strong>{isCust?(quote.customer?.name?.split(' ')[0]||'Customer'):'You'}</strong> · {timeAgo(e.timestamp)}</div><div className={`qd-feed-msg-bubble ${isCust?'':'qd-feed-msg-bubble--you'}`}>{e.text}</div>{!isCust && quote.messages_last_read_at && new Date(quote.messages_last_read_at) > new Date(e.timestamp) && (<div className="qd-feed-msg-read"><Check size={10} style={{verticalAlign:'middle',marginRight:3}}/>Read {timeAgo(quote.messages_last_read_at)}</div>)}</div></div>
                );
                })}
              </div>
            ) : (
              <div style={{padding:'16px',textAlign:'center',color:'var(--muted)',fontSize: 'var(--text-sm)',background:'var(--bg)',borderRadius:'var(--r-sm)'}}>No messages yet</div>
            ); })()}

            {/* Activity timeline — system events only */}
            <div className="qd-feed-header" style={{marginTop:16,paddingTop:12,borderTop:'1px solid var(--line)'}}><span style={{fontWeight:600,fontSize: 'var(--text-xs)',color:'var(--muted)'}}>Activity</span><span className="qb-muted" style={{fontSize: 'var(--text-2xs)'}}>{timeline.filter(e=>e.type!=='customer_message'&&e.type!=='contractor_message').length} events</span></div>
            <div className="qd-feed-list">
              {timeline.filter(ev=>ev.type!=='customer_message'&&ev.type!=='contractor_message').map((ev,i) => {
                const isAm = ev.subtype==='amendment';
                const isAW = ev.subtype==='additional_work';
                if((isAm||isAW)&&ev.data){ const d=ev.data; return (
                  <a key={`${ev.subtype}${i}`} href={isAm?`/public/amendment/${d.share_token}`:`/app/additional-work/${d.id}`} target={isAm?'_blank':undefined} rel={isAm?'noreferrer':undefined} className="qd-feed-event qd-feed-event--link" style={{textDecoration:'none',color:'inherit'}}><span className="qd-feed-event-icon">{ev.icon}</span><div className="qd-feed-event-body"><span className="qd-feed-event-label">{ev.label}</span>{d.total&&<span className="qd-feed-event-detail">{currency(d.total)}</span>}</div><div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}><StatusBadge status={d.status}/><span className="qd-feed-event-time">{timeAgo(ev.time)}</span></div></a>
                );}
                return <div key={`e${i}`} className={`qd-feed-event ${ev.type==='milestone'?'qd-feed-event--milestone':''}`}><span className="qd-feed-event-icon">{ev.icon}</span><div className="qd-feed-event-body"><span className="qd-feed-event-label">{ev.label}</span>{ev.detail&&<span className="qd-feed-event-detail">{ev.detail}</span>}</div><span className="qd-feed-event-time">{timeAgo(ev.time)}</span></div>;
              })}
            </div>
          </div>

          {/* ══════════ ZONE 3: SCOPE DETAILS (collapsed) ══════════ */}
          <div className={`qd-scope${mobileTab !== 'details' ? ' qd-zone-details' : ''}`}>
            <button type="button" className="qd-scope-toggle pl-toggle-row" onClick={()=>setScopeOpen(v=>!v)} style={{ width:'100%', background:'none', border:'none', fontFamily:'inherit' }}>
              <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{display:'inline-flex'}}><FileText size={14}/></span><span style={{fontWeight:700,fontSize: 'var(--text-base)'}}>Scope & Pricing</span><span className="qb-muted fs-12">{(quote.line_items||[]).length} items · {currency(quote.total)}</span></div>
              <span className={`pl-chevron ${scopeOpen ? 'pl-chevron--open' : ''}`} />
            </button>
            {scopeOpen && <div className="qd-scope-body">
              {quote.scope_summary && <div style={{padding:'10px 14px',background:'var(--bg)',borderRadius:'var(--r-sm)',marginBottom:12}}><span className="qb-label">Scope</span><p style={{margin:'4px 0 0',fontSize: 'var(--text-sm)'}}>{quote.scope_summary}</p></div>}
              {Object.entries(groupedItems).map(([g,items])=><div key={g} style={{marginBottom:8}}><div className="qb-group-label">{g}</div>{items.map(it=><div key={it.id} className={`qd-line-item ${it.included===false?'excluded':''}`}><div className="qd-li-info"><strong>{it.name}</strong>{it.notes&&<span className="qb-muted">{it.notes}</span>}</div><div className="qd-li-price"><span className="qb-muted">{it.quantity} × {currency(it.unit_price)}</span><strong>{it.included===false?'Optional':currency(it.quantity*it.unit_price)}</strong></div></div>)}</div>)}
              <div className="qd-totals"><div className="qb-total-row"><span>Subtotal</span><span>{currency(quote.subtotal)}</span></div>{Number(quote.discount||0)>0&&<div className="qb-total-row"><span>Discount</span><span>−{currency(quote.discount)}</span></div>}<div className="qb-total-row"><span>Tax</span><span>{currency(quote.tax)}</span></div><div className="qb-total-row grand"><span>Total</span><span>{currency(quote.total)}</span></div>{quote.deposit_required&&Number(quote.deposit_amount)>0&&<div className="qb-total-row" style={{color:'var(--amber)'}}><span>Deposit ({labelForDeposit(quote.deposit_status)})</span><span>{currency(quote.deposit_amount)}</span></div>}</div>
              {(quote.assumptions||quote.exclusions)&&<div className="qd-two-col" style={{marginTop:12}}>{quote.assumptions&&<div style={{padding:'8px 12px',background:'var(--bg)',borderRadius:'var(--r-sm)',fontSize: 'var(--text-xs)',color:'var(--muted)',whiteSpace:'pre-line'}}><strong style={{display:'block',fontSize: 'var(--text-2xs)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:4}}>Assumptions</strong>{quote.assumptions}</div>}{quote.exclusions&&<div style={{padding:'8px 12px',background:'var(--bg)',borderRadius:'var(--r-sm)',fontSize: 'var(--text-xs)',color:'var(--muted)',whiteSpace:'pre-line'}}><strong style={{display:'block',fontSize: 'var(--text-2xs)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:4}}>Not included</strong>{quote.exclusions}</div>}</div>}
              {quote.revision_summary&&<div className="qb-notice" style={{marginTop:10}}><strong>What changed:</strong> {quote.revision_summary}</div>}
            </div>}
          </div>
        </section>

        {/* ── SIDEBAR — visible on desktop always, on mobile only in "More" tab ── */}
        <aside className={`qd-sidebar${mobileTab === 'more' ? ' qd-sidebar--mobile-inline' : ''}${mobileTab !== 'more' ? ' qd-zone-sidebar' : ''}`}>
          {!isDraft && <div className="qb-card"><span className="qb-label">{isLocked?'Share':'Send / Share'}</span>{quote.sent_at&&<div style={{marginBottom:8,padding:'5px 10px',background:'rgba(19,138,91,.04)',border:'1px solid rgba(19,138,91,.12)',borderRadius:'var(--r-sm)',fontSize: 'var(--text-2xs)',color:'var(--green)'}}>Sent {formatDate(quote.sent_at)}</div>}<div className="qd-send-grid">{!isLocked&&quote.customer?.phone&&<button className="btn btn-primary full-width" type="button" onClick={handleSendText}><MessageSquare size={13} style={{verticalAlign:'middle',marginRight:5}}/>{quote.sent_at?`Resend to ${quote.customer?.name?.split(' ')[0]||''}` :`Text ${quote.customer?.name?.split(' ')[0]||''}`}</button>}<button className="btn btn-secondary full-width" type="button" onClick={handleCopyLink}><Link2 size={13} style={{verticalAlign:"middle",marginRight:5}}/>Copy link</button></div><a href={shareUrl+'?preview=1'} target="_blank" rel="noreferrer" style={{display:'block',marginTop:8,fontSize: 'var(--text-2xs)',color:'var(--brand)',textDecoration:'none',fontWeight:600}}>Preview ↗</a></div>}

          {(isApproved||isScheduled||isCompleted)&&<div className="qb-card" style={{border:'1px solid rgba(176,112,48,.2)',background:'var(--amber-bg)'}}><span className="qb-label" style={{color:'var(--amber)'}}>Scope Changes</span>{amendments.map(am=><a key={am.id} href={`/public/amendment/${am.share_token}`} target="_blank" rel="noreferrer" className="aw-status-card" style={{textDecoration:'none',color:'inherit'}}><div><strong style={{fontSize: 'var(--text-sm)'}}>{am.title}</strong><div className="qb-muted">{currency(am.total)} · Amendment</div></div><StatusBadge status={am.status}/></a>)}{additionalWork.map(aw=><Link key={aw.id} to={`/app/additional-work/${aw.id}`} className="aw-status-card"><div><strong style={{fontSize: 'var(--text-sm)'}}>{aw.title}</strong><div className="qb-muted">{currency(aw.total)} · Additional work</div></div><StatusBadge status={aw.status}/></Link>)}<button className="btn btn-secondary full-width" style={{marginTop:8,fontSize: 'var(--text-xs)'}} type="button" onClick={()=>{ const m=getScopeMode(); if(m==='edit') navigate(`/app/quotes/${quote.id}/edit`); else setShowAddScope(true); }}>+ Add scope</button></div>}

          <div className="qb-card"><span className="qb-label">Photos {photos.length>0&&`(${photos.length})`}</span>{photos.length>0&&<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginTop:8}}>{photos.map(p=><div key={p.path} style={{position:'relative',borderRadius:'var(--r-sm)',overflow:'hidden',border:'1px solid var(--line)',aspectRatio:'1'}}><img src={p.url} alt="" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/><button type="button" aria-label="Remove photo" onClick={async()=>{try{await deleteQuotePhoto(p.path);setPhotos(pr=>pr.filter(x=>x.path!==p.path));showToast('Removed','info');}catch(e){showToast(friendly(e),'error');}}} style={{position:'absolute',top:2,right:2,width:28,height:28,borderRadius:'50%',background:'rgba(0,0,0,.6)',color:'var(--always-white, #fff)',border:'none',cursor:'pointer',display:'grid',placeItems:'center'}}><X size={12} /></button></div>)}</div>}<label style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginTop:8,padding:'8px 12px',borderRadius:'var(--r-sm)',border:'1px dashed var(--line-2)',cursor:'pointer',fontSize: 'var(--text-xs)',fontWeight:600,color:'var(--muted)'}}>{photoUploading?'Uploading…':'Add photo'}<input hidden type="file" accept="image/*" multiple onChange={async e=>{const fs=Array.from(e.target.files||[]);if(!fs.length)return;const v=fs.filter(f=>f.size<=5*1024*1024);if(v.length<fs.length)showToast(`${fs.length-v.length} over 5MB`,'error');if(!v.length){e.target.value='';return;}setPhotoUploading(true);let n=0;for(const f of v){try{const p=await uploadQuotePhoto(quoteId,f);setPhotos(pr=>[p,...pr]);n++;}catch(e){showToast(friendly(e),'error');}}setPhotoUploading(false);if(n)showToast(`${n} added`,'success');e.target.value='';}}/></label></div>

          <details className="qb-card" style={{background:'var(--panel-2)'}}><summary className="pl-toggle-row" style={{cursor:'pointer',listStyle:'none',padding:'10px 14px'}}>
            <span style={{fontWeight:600,fontSize: 'var(--text-sm)'}}>More actions</span>
            <span className="pl-chevron" />
          </summary><div className="qd-send-grid" style={{marginTop:6}}><button className="btn btn-secondary full-width fs-12" type="button" disabled={pdfLoading} onClick={handleDownloadPdf} >{pdfLoading?'Generating…':'Download PDF'}</button>{typeof navigator!=='undefined'&&navigator.share&&<button className="btn btn-secondary full-width fs-12" type="button" onClick={()=>nativeShare({title:quote.title||'Quote',url:shareUrl},showToast)}>Share</button>}<button className="btn btn-secondary full-width fs-12" type="button" onClick={handleDuplicate} >Duplicate as new quote</button>{!confirmDelete?<button className="btn btn-secondary full-width" type="button" style={{color:'var(--red)',fontSize: 'var(--text-xs)'}} onClick={()=>setConfirmDelete(true)}>{quote.signed_at?'Archive':'Delete'}</button>:<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}><button className="btn btn-secondary btn-sm" style={{color:'var(--red)'}} type="button" onClick={handleDelete}>{quote.signed_at?'Archive':'Delete'}</button><button className="btn btn-secondary btn-sm" type="button" onClick={()=>setConfirmDelete(false)}>Cancel</button></div>}</div></details>
        </aside>
      </div>

      {/* Mobile bars */}
      {isDraft && <div className="qd-mobile-send-bar"><Link className="btn btn-primary" to={`/app/quotes/${quote.id}/edit`} style={{flex:1,textAlign:'center',textDecoration:'none'}}>Continue editing →</Link></div>}
      {!isDraft&&!isLocked&&!isRevision&&!isExpired&&hasShareToken&&<div className="qd-mobile-send-bar">{quote.customer?.phone?<button className="btn btn-primary flex-1" type="button" onClick={handleSendText} ><MessageSquare size={13} style={{verticalAlign:'middle',marginRight:5}}/>Text {quote.customer?.name?.split(' ')[0] || 'quote'}</button>:<button className="btn btn-primary flex-1" type="button" onClick={handleCopyLink} ><Link2 size={13} style={{verticalAlign:"middle",marginRight:5}}/>Copy link</button>}<button className="btn btn-secondary" type="button" onClick={handleCopyLink} style={{flex:0,padding:'10px 14px'}}><Link2 size={14}/></button></div>}
      {isRevision&&quote.status!=='question_asked'&&<div className="qd-mobile-send-bar"><Link className="btn btn-primary" to={`/app/quotes/${quote.id}/edit`} style={{flex:1,textAlign:'center',textDecoration:'none'}}>Revise & resend →</Link></div>}
      {isApproved&&<div className="qd-mobile-send-bar"><button className="btn btn-primary" type="button" onClick={()=>setShowScheduleModal(true)} style={{flex:1}}><Calendar size={13} style={{verticalAlign:'middle',marginRight:5}}/>Schedule job</button></div>}
      {isScheduled&&<div className="qd-mobile-send-bar"><button className="btn btn-primary flex-1" type="button" onClick={markComplete} ><Check size={13} style={{verticalAlign:'middle',marginRight:5}}/>Mark complete</button></div>}
      {isCompleted&&!linkedInvoice&&<div className="qd-mobile-send-bar"><button className="btn btn-primary flex-1" type="button" disabled={creatingInvoice} onClick={handleCreateInvoice} >{creatingInvoice?'Creating…':'Invoice'}</button></div>}

      <BookingDrawer open={showScheduleModal} onClose={()=>setShowScheduleModal(false)} onSave={async(b)=>{setQuoteBookings(p=>[...p,b]);showToast('Scheduled','success');setShowScheduleModal(false);try{const u=await updateQuoteStatus(quote.id,{status:'scheduled'});setQuote(p=>({...p,...u,status:'scheduled'}));}catch{setQuote(p=>({...p,status:'scheduled'}));}}} preSelectedQuote={quote} preSelectedCustomer={quote?.customer||null} customers={[]} quotes={[]} bookings={quoteBookings} userId={user?.id} showICSExport={false} contextLabel={quote?`${quote.title||'Untitled'} · ${quote.customer?.name||'Customer'}`:null} />

      {/* v100 M3: Nudge modal — shown for sent/viewed quotes */}
      {showNudgeModal && quote && (
        <FollowupModal
          quote={quote}
          userProfile={userProfile}
          templates={userTemplates}
          onClose={() => setShowNudgeModal(false)}
          onSent={handleNudgeSent}
        />
      )}

      {showAddScope && <ItemModal
        title={getScopeMode() === 'edit' ? 'Add to Quote' : getScopeMode() === 'amendment' ? 'Add Scope (Amendment)' : 'Add Scope (Additional Work)'}
        subtitle={`For: ${quote.customer?.name||'Customer'} · ${quote.title}`}
        signedInfo={isSigned ? `Signed by ${quote.signer_name||'customer'} · ${formatDate(quote.signed_at)}` : null}
        modeHint={getScopeMode() === 'amendment' ? 'Customer will need to sign to approve this change.' : getScopeMode() === 'additional_work' ? 'Customer will be asked to approve the additional work.' : 'Items will be added to the existing quote.'}
        draft={scopeDraft} setDraft={setScopeDraft} saving={scopeSaving}
        province={quote.province} country={quote.country}
        onSaveDraft={() => handleAddScope(false)} onSend={() => handleAddScope(true)} onClose={() => setShowAddScope(false)}
      />}
    </AppShell>
  );
}

function ItemModal({ title, subtitle, signedInfo, modeHint, draft, setDraft, saving, province, country, reasonLabel, reasonPlaceholder, onSaveDraft, onSend, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal-content aw-modal" onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><h2 style={{margin:0,fontSize:'1.2rem',letterSpacing:'-.02em'}}>{title}</h2><button className="btn btn-secondary btn-sm" type="button" onClick={onClose} aria-label="Close"><X size={14} /></button></div>
      <div className="qb-muted" style={{marginBottom:6,fontSize: 'var(--text-xs)'}}>{subtitle}</div>
      {signedInfo && <div style={{marginBottom:8,padding:'8px 10px',background:'var(--green-bg)',borderRadius:'var(--r-sm)',border:'1px solid var(--green-line)',fontSize: 'var(--text-xs)',color:'var(--green)'}}>{signedInfo}</div>}
      {modeHint && <div style={{marginBottom:12,padding:'8px 10px',background:'var(--panel-2)',borderRadius:'var(--r-sm)',fontSize: 'var(--text-2xs)',color:'var(--text-2)',lineHeight:1.5}}>ℹ {modeHint}</div>}
      <label className="qb-label" style={{display:'block',marginBottom:4}}>Title</label>
      <input className="qb-inp" value={draft.title} onChange={e=>setDraft(d=>({...d,title:e.target.value}))} style={{marginBottom:12}} />
      <label className="qb-label" style={{display:'block',marginBottom:4}}>{reasonLabel||'Why is this needed?'}</label>
      <textarea className="qb-inp" value={draft.reason} onChange={e=>setDraft(d=>({...d,reason:e.target.value}))} placeholder={reasonPlaceholder||''} rows={3} style={{marginBottom:16,resize:'vertical'}} />
      <label className="qb-label" style={{display:'block',marginBottom:8}}>Line items</label>
      {draft.items.map((it,idx)=><div key={it.id || 'new_' + idx} className="aw-item-row"><input className="qb-inp" value={it.name} placeholder="Item name" onChange={e=>{const n=[...draft.items];n[idx]={...n[idx],name:e.target.value};setDraft(d=>({...d,items:n}));}} style={{flex:2}}/><input className="qb-inp" type="number" value={it.quantity} min="1" onChange={e=>{const n=[...draft.items];n[idx]={...n[idx],quantity:Number(e.target.value)||1};setDraft(d=>({...d,items:n}));}} style={{width:60}} placeholder="Qty"/><input className="qb-inp" type="number" value={it.unit_price} min="0" step="0.01" onChange={e=>{const n=[...draft.items];n[idx]={...n[idx],unit_price:Number(e.target.value)||0};setDraft(d=>({...d,items:n}));}} style={{width:90}} placeholder="Price"/>{draft.items.length>1&&<button className="btn btn-secondary btn-sm btn--xs" type="button" aria-label="Remove item" style={{color:'var(--red)'}} onClick={()=>setDraft(d=>({...d,items:d.items.filter((_,i)=>i!==idx)}))}><X size={12} /></button>}</div>)}
      <button className="btn btn-secondary btn-sm" type="button" style={{marginTop:6,marginBottom:16}} onClick={()=>setDraft(d=>({...d,items:[...d.items,{name:'',quantity:1,unit_price:0,notes:''}]}))}>+ Add item</button>
      {(()=>{const v=draft.items.filter(i=>(i.name||'').trim());const t=calculateTotals(v.map(i=>({...i,included:true})),province||'ON',country||'CA');return<div className="qd-totals" style={{marginBottom:16}}><div className="qb-total-row"><span>Subtotal</span><span>{currency(t.subtotal)}</span></div><div className="qb-total-row"><span>Tax</span><span>{currency(t.tax)}</span></div><div className="qb-total-row grand"><span>Total</span><span>{currency(t.total)}</span></div></div>;})()}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><button className="btn btn-secondary full-width" type="button" disabled={saving} onClick={onSaveDraft}>{saving?'Saving…':'Save draft'}</button><button className="btn btn-primary full-width" type="button" disabled={saving||!draft.items.some(i=>(i.name||'').trim())} onClick={onSend}>{saving?'Sending…':'Save & send'}</button></div>
    </div></div>
  );
}
