import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Phone, MessageSquare, Mail, Link2, Eye, FileText, Check, RefreshCw, Pencil, Camera, X, MoreHorizontal } from 'lucide-react';
import AppShell from '../components/app-shell';
import { QuoteDetailSkeleton } from '../components/skeletons';
import StatusBadge from '../components/status-badge';
import UpgradePrompt from '../components/upgrade-prompt';
// REMOVED in 2.0: FollowupModal
const FollowupModal = () => null;
import { calculateTotals } from '../lib/pricing';
import { currency, formatDate, formatQuoteNumber, friendly } from '../lib/format';
import { deleteQuote, duplicateQuote, getQuote, getProfile, updateQuoteStatus, markFollowedUp, createInvoiceFromQuoteWithAdditionalWork, uploadQuotePhoto, listQuotePhotos, deleteQuotePhoto, replyToCustomer } from '../lib/api';
import { listTemplates, renderTemplate, getSystemDefaults } from '../lib/api/templates';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../components/toast';
import { safeWriteClipboard, nativeShare } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { normalizeStatus, chipForStatus, colorForStatus, getNextAction, getSignals, isQuoteLocked, getTimelineSteps } from '../lib/workflow';
// 2.0 stubs for removed workflow functions
const labelForDeposit = () => '';
const getFollowUpAdvice = () => null;
const buildTimeline = () => [];
const timeAgo = (d) => { if (!d) return ''; const s = Math.round((Date.now() - new Date(d)) / 1000); if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s/60)}m ago`; if (s < 86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`; };
const draftFollowUp = () => '';
import { smsNotify } from '../lib/sms';
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
  const [photos, setPhotos] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [upgradePrompt, setUpgradePrompt] = useState(null);
  const [scopeOpen, setScopeOpen] = useState(true);
  const [mobileTab, setMobileTab] = useState('details'); // 'details' | 'messages' | 'more'
  const feedRef = useRef(null);
  const mobileTabBarRef = useRef(null);
  const [showNudgeModal, setShowNudgeModal] = useState(false);
  const [userTemplates, setUserTemplates] = useState(null);
  const [lastSentSmsBody, setLastSentSmsBody] = useState(null);
  const [lastSentSmsTime, setLastSentSmsTime] = useState(null);
  const [aiDraftLoading, setAiDraftLoading] = useState(false);

  useEffect(() => {
    if (!quoteId) return;
    let cancelled = false;
    if (user) getProfile(user.id).then(p => {
      if (cancelled) return;
      setUserProfile(p);
      listTemplates(user.id).then(t => { if (!cancelled) setUserTemplates(t); }).catch(() => { if (!cancelled) setUserTemplates([]); });
    }).catch(e => console.warn('[PL]', e));
    getQuote(quoteId)
      .then(data => {
        if (cancelled) return;
        setQuote(data);
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
  const shareUrl = quote?.share_token ? `${window.location.origin}/q/${quote.share_token}` : '';
  const hasShareToken = Boolean(quote?.share_token);
  const isDraft = quote?.status === 'draft';
  const isRevision = quote?.status === 'revision_requested';
  const isApproved = ['approved', 'approved_pending_deposit', 'deposit_paid'].includes(quote?.status);
  const isLocked = isApproved || ['converted_to_invoice', 'paid'].includes(quote?.status);
  const isSigned = Boolean(quote?.signed_at);
  const isExpired = quote?.expires_at && new Date(quote.expires_at) < new Date() && !['approved','approved_pending_deposit','deposit_paid','converted_to_invoice','paid'].includes(quote?.status);
  const cName = userProfile?.company_name || userProfile?.full_name || '';

  // Actions
  async function handleCreateInvoice() {
    setCreatingInvoice(true);
    try {
      const inv = await createInvoiceFromQuoteWithAdditionalWork(user.id, quote);
      setQuote(p => ({ ...p, status: 'converted_to_invoice', invoice_id: inv.id }));
      showToast('Invoice created', 'success');
      haptic('success');
      navigate(`/app/invoices/${inv.id}`);
    } catch (e) { showToast(friendly(e), 'error'); }
    finally { setCreatingInvoice(false); }
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

    if (!['sent', 'viewed', 'approved', 'approved_pending_deposit', 'deposit_paid', 'converted_to_invoice', 'paid'].includes(quote.status)) {
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
      if (!['sent', 'viewed', 'approved', 'approved_pending_deposit', 'deposit_paid', 'converted_to_invoice', 'paid'].includes(quote.status)) {
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

  async function markDepositPaid() {
    try {
      const u = await updateQuoteStatus(quote.id, { deposit_status: 'paid', status: 'deposit_paid', deposit_paid_at: new Date().toISOString() });
      setQuote(p => ({ ...p, ...u, deposit_status: 'paid', status: 'deposit_paid' }));
      showToast('Deposit marked paid', 'success');
    } catch (e) { showToast(friendly(e), 'error'); }
  }

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

  const timeline = useMemo(() => quote ? buildTimeline(quote) : [], [quote]);
  const groupedItems = useMemo(() => { if(!quote)return {}; return (quote.line_items||[]).reduce((a,i)=>{const k=i.category||(i.item_type==='optional'?'Options':'Scope');a[k]||=[];a[k].push(i);return a;},{}); }, [quote]);

  // Loading/error
  if (loading) return <QuoteDetailSkeleton />;
  if (!quote) return <AppShell title="Quote"><div className="empty-state" style={{textAlign:'center',padding:'60px 20px'}}><div style={{marginBottom:12,color:'var(--muted)'}}><FileText size={36}/></div><h3 style={{margin:'0 0 8px'}}>Quote not found</h3><Link className="btn btn-secondary" to="/app">Back to dashboard</Link></div></AppShell>;

  const inlineEditBtn = isLocked ? null : isRevision ? <Link className="btn btn-primary btn-sm" to={`/app/quotes/${quote.id}/edit`} style={{marginLeft:8,flexShrink:0}}>Revise →</Link> : <Link className="btn btn-secondary btn-sm" to={`/app/quotes/${quote.id}/edit`} style={{marginLeft:8,flexShrink:0}}>Edit</Link>;
  const advice = getFollowUpAdvice(quote);

  // v100 M5 §5.7: Lifecycle strip — ordered steps with current state filled
  const lifecycleSteps = (() => {
    const s = quote.status;
    const steps = [
      { key: 'sent',                 label: 'Sent' },
      { key: 'viewed',               label: 'Viewed' },
      { key: 'approved',             label: 'Approved' },
      { key: 'deposit_paid',         label: 'Deposit paid' },
      { key: 'converted_to_invoice', label: 'Invoiced' },
      { key: 'paid',                 label: 'Paid' },
    ];
    const ORDER = { draft:0, sent:0, viewed:1, revision_requested:1, declined:1, expired:1, approved:2, approved_pending_deposit:2, deposit_paid:3, converted_to_invoice:4, paid:5 };
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
                <div key={step.key} className="ql-strip-item">
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
              {photos.length > 0 && <span className="qd-mobile-tab-dot" />}
            </button>
          </div>

          {/* ══════════ ZONE 1: STATUS HERO ══════════ */}
          <div className={`qd-hero${mobileTab !== 'details' ? ' qd-hero--compact' : ''}`}>
           {mobileTab === 'details' ? (<>
            <div className="qd-hero-top">
              <div style={{flex:1,minWidth:0}}>
                <h1 className="qd-hero-title">{quote.title||'Untitled'}</h1>
                <div className="qd-hero-meta">
                  {quote.quote_number && <span className="qd-hero-qnum">{formatQuoteNumber(quote.quote_number)}</span>}
                  <span>{quote.customer?.name||'No customer'}</span>
                  {quote.trade && <span>· {quote.trade}</span>}
                  {(quote.total || 0) > 0 && <span>· {currency(quote.total)}</span>}
                  {!isLocked && <Link className="btn-link qd-edit-link" to={`/app/quotes/${quote.id}/edit`}>Edit</Link>}
                </div>
              </div>
              <div className="qd-contact-btns">
                {quote.customer?.phone && <a href={`tel:${quote.customer.phone}`} className="btn btn-secondary btn-sm" aria-label="Call customer"><Phone size={14} /></a>}
                {quote.customer?.phone && <button type="button" onClick={handleOpenSmsApp} className="btn btn-secondary btn-sm" aria-label="Text customer with quote details"><MessageSquare size={14} /></button>}
                {quote.customer?.email && <button type="button" onClick={handleOpenEmailApp} className="btn btn-secondary btn-sm" aria-label="Email customer with quote details"><Mail size={14} /></button>}
              </div>
            </div>

            {isDraft && <div className="qd-phase-banner qd-phase-draft qd-draft-inline-cta"><div className="qd-phase-dot qd-dot-draft"></div><div className="qd-phase-body"><div className="qd-phase-title">Draft — not sent yet</div><div className="qd-phase-hint">Finish items and pricing, then send.</div></div><Link className="btn btn-primary" to={`/app/quotes/${quote.id}/edit`} style={{whiteSpace:'nowrap',flexShrink:0}}>Continue editing →</Link></div>}

            {quote.status==='sent' && <div className="qd-phase-banner qd-phase-waiting"><div className="qd-phase-dot qd-dot-sent"></div><div className="qd-phase-body"><div className="qd-phase-title">Sent — waiting on {quote.customer?.name?.split(' ')[0] || 'customer'}</div><div className="qd-phase-hint">{quote.sent_at?`Sent ${formatDate(quote.sent_at)}`:'Sent'}{quote.view_count>0?` · viewed ${quote.view_count}×`:' · not opened yet — a quick text can help'}</div>{/* v100 M3: follow-up context block */}{(() => { const fc=Number(quote.followup_count)||0; const lf=quote.last_followup_at; const vs=Number(quote.views_since_followup)||0; if(fc===0)return null; const daysSince=lf?Math.round((Date.now()-new Date(lf).getTime())/86_400_000):null; const urgColor=daysSince===null?'var(--text-2)':daysSince<2?'var(--green)':daysSince<5?'var(--amber)':'var(--red)'; return <div className="qd-followup-context"><span className="qd-followup-context__stat" style={{color:urgColor}}>Last nudge {daysSince===0?'today':daysSince===1?'1d ago':`${daysSince}d ago`}</span><span className="qd-followup-context__stat">{vs} view{vs!==1?'s':''} since</span></div>; })()}{advice && <div style={{marginTop:4,fontSize: 'var(--text-2xs)',color:'var(--text-2)'}}>{advice.emoji} {advice.headline}</div>}</div>{advice&&advice.urgency!=='low' && <button className="btn btn-primary btn-sm shrink-0" type="button" onClick={openNudgeModal}>{quote.customer?.phone ? `Nudge ${quote.customer?.name?.split(' ')[0] || ''}` : 'Send nudge'}</button>}</div>}

            {quote.status==='viewed' && <div className="qd-phase-banner qd-phase-hot"><div className="qd-phase-dot qd-dot-viewed"></div><div className="qd-phase-body"><div className="qd-phase-title">{quote.customer?.name?.split(' ')[0] || 'Customer'} is reviewing{quote.view_count>1?` (${quote.view_count}×)`:''}</div><div className="qd-phase-hint">{showFinancing(quote.total) && quote.view_count > 1 ? `They've looked ${quote.view_count} times — the monthly option (from ${currency(estimateMonthly(quote.total))}/mo) may be what they're considering. A quick text could close this.` : 'They\'re looking at it — a quick text can close this.'}</div>{/* v100 M3: follow-up context block */}{(() => { const fc=Number(quote.followup_count)||0; const lf=quote.last_followup_at; const vs=Number(quote.views_since_followup)||0; if(fc===0)return null; const daysSince=lf?Math.round((Date.now()-new Date(lf).getTime())/86_400_000):null; const urgColor=daysSince===null?'var(--text-2)':daysSince<2?'var(--green)':daysSince<5?'var(--amber)':'var(--red)'; return <div className="qd-followup-context"><span className="qd-followup-context__stat" style={{color:urgColor}}>Last nudge {daysSince===0?'today':daysSince===1?'1d ago':`${daysSince}d ago`}</span><span className="qd-followup-context__stat">{vs} view{vs!==1?'s':''} since</span></div>; })()}</div><button className="btn btn-primary btn-sm shrink-0" type="button" onClick={openNudgeModal}>{quote.customer?.phone ? `Nudge ${quote.customer?.name?.split(' ')[0] || ''}` : 'Send nudge'}</button></div>}

            {isRevision && <div className="qd-phase-banner qd-phase-revision"><div className="qd-phase-dot" style={{background:'var(--amber)'}}></div><div className="qd-phase-body"><div className="qd-phase-title">Changes requested</div><div className="qd-phase-hint">Review feedback and respond.</div></div><Link className="btn btn-primary shrink-0" to={`/app/quotes/${quote.id}/edit`} >Revise →</Link></div>}

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
                    {quote.status === 'declined' ? 'Reason given' : 'Customer feedback'}
                  </div>
                  <div className="qd-customer-feedback-text">"{feedbackText}"</div>
                  <div className="qd-feedback-attr">
                    — {quote.customer?.name || 'Customer'}{lastCustomerMsg?.timestamp ? ` · ${timeAgo(lastCustomerMsg.timestamp)}` : ''}
                  </div>
                </div>
              );
            })()}

            {quote.status === 'approved_pending_deposit' && (
              <div className="qd-phase-banner qd-phase-approved">
                <div className="qd-phase-dot qd-dot-approved" />
                <div className="qd-phase-body">
                  <div className="qd-phase-title">Approved{quote.signer_name ? ` by ${quote.signer_name}` : ''}</div>
                  <div className="qd-phase-hint">Deposit of {currency(quote.deposit_amount)} is pending before work begins.</div>
                </div>
                <button className="btn btn-secondary btn-sm shrink-0" type="button" onClick={markDepositPaid}>Mark deposit paid</button>
              </div>
            )}

            {['approved', 'deposit_paid'].includes(quote.status) && (
              <div className="qd-phase-banner qd-phase-done">
                <div className="qd-phase-dot qd-dot-done" />
                <div className="qd-phase-body">
                  <div className="qd-phase-title">{quote.status === 'deposit_paid' ? 'Deposit paid — ready to invoice' : 'Approved — ready to invoice'}</div>
                  <div className="qd-phase-hint">Create an invoice to collect payment.</div>
                </div>
                <button className="btn btn-primary shrink-0" type="button" disabled={creatingInvoice} onClick={handleCreateInvoice}>
                  {creatingInvoice ? 'Creating…' : 'Create invoice'}
                </button>
              </div>
            )}
            {quote.status === 'converted_to_invoice' && (
              <div className="qd-phase-banner qd-phase-done">
                <div className="qd-phase-dot qd-dot-done" />
                <div className="qd-phase-body"><div className="qd-phase-title">Invoice created</div></div>
                {quote.invoice_id && <Link className="btn btn-secondary shrink-0" to={`/app/invoices/${quote.invoice_id}`}>View invoice →</Link>}
              </div>
            )}
            {quote.status === 'paid' && (
              <div className="qd-phase-banner qd-phase-done">
                <div className="qd-phase-dot qd-dot-done" />
                <div className="qd-phase-body"><div className="qd-phase-title">Paid ✓</div></div>
              </div>
            )}
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
            {isRevision && (
              <div className="qd-contextual-actions">
                <span className="qd-contextual-actions__label">Customer requested changes — reply below or revise the quote</span>
                {process.env.VITE_OPENAI_API_KEY !== undefined && (
                  <button type="button" className="btn btn-secondary btn-sm" disabled={aiDraftLoading} onClick={handleAiDraftReply}>
                    {aiDraftLoading ? 'Drafting…' : 'Draft a reply'}
                  </button>
                )}
              </div>
            )}
           </>) : (
            <div className="qd-hero-compact">
              <div className="qd-hero-compact-info">
                <span className="qd-hero-compact-title">{quote.title || 'Untitled'}</span>
                <span className="qd-hero-compact-sep">·</span>
                <span className="qd-hero-compact-total">{currency(quote.total)}</span>
              </div>
              <StatusBadge status={quote.status} />
            </div>
           )}
          </div>

          {/* ══════════ ZONE 2: COMMUNICATION ══════════ */}
          <div className={`qd-feed${mobileTab !== 'messages' ? ' qd-zone-messages' : ''}`}>
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
              <div className="qd-no-messages">No messages yet</div>
            ); })()}
            {/* Reply input — below the thread */}
            {!isDraft && hasShareToken && !['paid','converted_to_invoice'].includes(quote?.status) && (
              <div className="qd-feed-reply"><div style={{display:'flex',gap:8,alignItems:'flex-end'}}><textarea value={replyText} onChange={e=>setReplyText(e.target.value)} placeholder={`Message ${quote.customer?.name?.split(' ')[0]||'customer'}…`} rows={1} className="qd-feed-reply-input" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleReply();}}} onInput={e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,120)+'px';}} /><button type="button" className="btn btn-primary btn-sm" disabled={replySending||!replyText.trim()} onClick={handleReply} style={{flexShrink:0,height:36}}>{replySending?'…':'Send'}</button></div><div style={{fontSize: 'var(--text-2xs)',color:'var(--muted)',marginTop:4}}>{quote.customer?.email?'Email + quote page':'Quote page only'}{quote.customer?.phone?' + SMS':''}</div></div>
            )}
          </div>

          {/* ══════════ ZONE 3: SCOPE DETAILS (collapsed) ══════════ */}
          <div className={`qd-scope${mobileTab !== 'details' ? ' qd-zone-details' : ''}`}>
            {/* Activity timeline — moved here from Messages zone */}
            <div className="qd-activity-section">
              <div className="qd-feed-header"><span style={{fontWeight:600,fontSize: 'var(--text-xs)',color:'var(--muted)'}}>Activity</span><span className="qb-muted" style={{fontSize: 'var(--text-2xs)'}}>{(() => { const c = timeline.filter(e=>e.type!=='customer_message'&&e.type!=='contractor_message').length; return `${c} event${c !== 1 ? 's' : ''}`; })()}</span></div>
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
            <button type="button" className="qd-scope-toggle pl-toggle-row" onClick={()=>setScopeOpen(v=>!v)} style={{ width:'100%', background:'none', border:'none', fontFamily:'inherit' }}>
              <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{display:'inline-flex'}}><FileText size={14}/></span><span style={{fontWeight:700,fontSize: 'var(--text-base)'}}>Scope & Pricing</span><span className="qb-muted fs-12">{(() => { const c = Object.values(groupedItems).reduce((s, arr) => s + arr.length, 0); return `${c} item${c !== 1 ? 's' : ''}`; })()} · {currency(quote.total)}</span></div>
              <span className={`pl-chevron ${scopeOpen ? 'pl-chevron--open' : ''}`} />
            </button>
            {scopeOpen && <div className="qd-scope-body">
              {quote.scope_summary && <div className="qd-scope-summary"><span className="qb-label">Scope</span><p style={{margin:'4px 0 0',fontSize: 'var(--text-sm)'}}>{quote.scope_summary}</p></div>}
              {Object.entries(groupedItems).map(([g,items])=><div key={g} style={{marginBottom:8}}><div className="qb-group-label">{g}</div>{items.map(it=><div key={it.id} className={`qd-line-item ${it.included===false?'excluded':''}`}><div className="qd-li-info"><strong>{it.name}</strong>{it.notes&&<span className="qb-muted">{it.notes}</span>}</div><div className="qd-li-price"><span className="qb-muted">{it.quantity} × {currency(it.unit_price)}</span><strong>{it.included===false?'Optional':currency(it.quantity*it.unit_price)}</strong></div></div>)}</div>)}
              <div className="qd-totals"><div className="qb-total-row"><span>Subtotal</span><span>{currency(quote.subtotal)}</span></div>{Number(quote.discount||0)>0&&<div className="qb-total-row"><span>Discount</span><span>−{currency(quote.discount)}</span></div>}<div className="qb-total-row"><span>Tax</span><span>{currency(quote.tax)}</span></div><div className="qb-total-row grand"><span>Total</span><span>{currency(quote.total)}</span></div>{quote.deposit_required&&Number(quote.deposit_amount)>0&&<div className="qb-total-row" style={{color:'var(--amber)'}}><span>Deposit ({labelForDeposit(quote.deposit_status)})</span><span>{currency(quote.deposit_amount)}</span></div>}</div>
              {(quote.assumptions||quote.exclusions)&&<div className="qd-two-col" style={{marginTop:12}}>{quote.assumptions&&<div style={{padding:'8px 12px',background:'var(--bg)',borderRadius:'var(--r-sm)',fontSize: 'var(--text-xs)',color:'var(--muted)',whiteSpace:'pre-line'}}><strong style={{display:'block',fontSize: 'var(--text-2xs)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:4}}>Assumptions</strong>{quote.assumptions}</div>}{quote.exclusions&&<div style={{padding:'8px 12px',background:'var(--bg)',borderRadius:'var(--r-sm)',fontSize: 'var(--text-xs)',color:'var(--muted)',whiteSpace:'pre-line'}}><strong style={{display:'block',fontSize: 'var(--text-2xs)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:4}}>Not included</strong>{quote.exclusions}</div>}</div>}
              {quote.revision_summary&&<div className="qb-notice" style={{marginTop:10}}><strong>What changed:</strong> {quote.revision_summary}</div>}
            </div>}
          </div>
        </section>

        {/* ── SIDEBAR — visible on desktop always, on mobile only in "More" tab ── */}
        <aside className={`qd-sidebar${mobileTab === 'more' ? ' qd-sidebar--mobile-inline' : ''}${mobileTab !== 'more' ? ' qd-zone-sidebar' : ''}`}>
          {!isDraft && <div className="qb-card"><span className="qb-label">{isLocked?'Share':'Send / Share'}</span>{quote.sent_at&&<div className="qd-sent-pill">Sent {formatDate(quote.sent_at)}</div>}<div className="qd-send-grid">{!isLocked&&quote.customer?.phone&&<button className="btn btn-primary full-width" type="button" onClick={handleSendText}><MessageSquare size={13} style={{verticalAlign:'middle',marginRight:5}}/>{quote.sent_at?`Resend to ${quote.customer?.name?.split(' ')[0]||''}` :`Text ${quote.customer?.name?.split(' ')[0]||''}`}</button>}<button className="btn btn-secondary full-width" type="button" onClick={handleCopyLink}><Link2 size={13} style={{verticalAlign:"middle",marginRight:5}}/>Copy link</button></div><a href={shareUrl+'?preview=1'} target="_blank" rel="noreferrer" style={{display:'block',marginTop:8,fontSize: 'var(--text-2xs)',color:'var(--brand)',textDecoration:'none',fontWeight:600}}>Preview ↗</a></div>}


          <div className="qb-card"><span className="qb-label">Photos {photos.length>0&&`(${photos.length})`}</span>{photos.length>0&&<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginTop:8}}>{photos.map(p=><div key={p.path} style={{position:'relative',borderRadius:'var(--r-sm)',overflow:'hidden',border:'1px solid var(--line)',aspectRatio:'1'}}><img src={p.url} alt="" width={120} height={120} loading="lazy" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/><button type="button" aria-label="Remove photo" onClick={async()=>{try{await deleteQuotePhoto(p.path);setPhotos(pr=>pr.filter(x=>x.path!==p.path));showToast('Removed','info');}catch(e){showToast(friendly(e),'error');}}} style={{position:'absolute',top:2,right:2,width:28,height:28,borderRadius:'50%',background:'rgba(0,0,0,.6)',color:'var(--always-white, #fff)',border:'none',cursor:'pointer',display:'grid',placeItems:'center'}}><X size={12} /></button></div>)}</div>}<label style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginTop:8,padding:'8px 12px',borderRadius:'var(--r-sm)',border:'1px dashed var(--line-2)',cursor:'pointer',fontSize: 'var(--text-xs)',fontWeight:600,color:'var(--muted)'}}>{photoUploading?'Uploading…':'Add photo'}<input hidden type="file" accept="image/*" multiple onChange={async e=>{const fs=Array.from(e.target.files||[]);if(!fs.length)return;const v=fs.filter(f=>f.size<=5*1024*1024);if(v.length<fs.length)showToast(`${fs.length-v.length} over 5MB`,'error');if(!v.length){e.target.value='';return;}setPhotoUploading(true);let n=0;for(const f of v){try{const p=await uploadQuotePhoto(quoteId,f);setPhotos(pr=>[p,...pr]);n++;}catch(e){showToast(friendly(e),'error');}}setPhotoUploading(false);if(n)showToast(`${n} added`,'success');e.target.value='';}}/></label></div>

          <details className="qb-card" style={{background:'var(--panel-2)'}}><summary className="pl-toggle-row" style={{cursor:'pointer',listStyle:'none',padding:'10px 14px'}}>
            <span style={{fontWeight:600,fontSize: 'var(--text-sm)'}}>More actions</span>
            <span className="pl-chevron" />
          </summary><div className="qd-send-grid" style={{marginTop:6}}><button className="btn btn-secondary full-width fs-12" type="button" disabled={pdfLoading} onClick={handleDownloadPdf} >{pdfLoading?'Generating…':'Download PDF'}</button>{typeof navigator!=='undefined'&&navigator.share&&<button className="btn btn-secondary full-width fs-12" type="button" onClick={()=>nativeShare({title:quote.title||'Quote',url:shareUrl},showToast)}>Share</button>}<button className="btn btn-secondary full-width fs-12" type="button" onClick={handleDuplicate} >Duplicate as new quote</button>{!confirmDelete?<button className="btn btn-secondary full-width" type="button" style={{color:'var(--red)',fontSize: 'var(--text-xs)'}} onClick={()=>setConfirmDelete(true)}>{quote.signed_at?'Archive':'Delete'}</button>:<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}><button className="btn btn-secondary btn-sm" style={{color:'var(--red)'}} type="button" onClick={handleDelete}>{quote.signed_at?'Archive':'Delete'}</button><button className="btn btn-secondary btn-sm" type="button" onClick={()=>setConfirmDelete(false)}>Cancel</button></div>}</div></details>
        </aside>
      </div>

      {/* Mobile bars */}
      {isDraft && <div className="qd-mobile-send-bar"><Link className="btn btn-primary" to={`/app/quotes/${quote.id}/edit`} style={{flex:1,textAlign:'center',textDecoration:'none'}}>Continue editing →</Link></div>}
      {!isDraft&&!isLocked&&!isRevision&&!isExpired&&hasShareToken&&<div className="qd-mobile-send-bar">{quote.customer?.phone?<button className="btn btn-primary flex-1" type="button" onClick={handleSendText} ><MessageSquare size={13} style={{verticalAlign:'middle',marginRight:5}}/>Text {quote.customer?.name?.split(' ')[0] || 'quote'}</button>:<button className="btn btn-primary flex-1" type="button" onClick={handleCopyLink} ><Link2 size={13} style={{verticalAlign:"middle",marginRight:5}}/>Copy link</button>}<button className="btn btn-secondary qd-copy-link-btn" type="button" onClick={handleCopyLink} aria-label="Copy quote link" style={{flex:0,padding:'10px 14px'}}><Link2 size={14}/><span className="qd-copy-link-text">Link</span></button></div>}
      {isRevision&&<div className="qd-mobile-send-bar"><Link className="btn btn-primary" to={`/app/quotes/${quote.id}/edit`} style={{flex:1,textAlign:'center',textDecoration:'none'}}>Revise & resend →</Link></div>}
      {isApproved && <div className="qd-mobile-send-bar"><button className="btn btn-primary flex-1" type="button" disabled={creatingInvoice} onClick={handleCreateInvoice}>{creatingInvoice ? 'Creating…' : 'Create invoice'}</button></div>}

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

    </AppShell>
  );
}

