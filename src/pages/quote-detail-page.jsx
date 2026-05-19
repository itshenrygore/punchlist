import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Phone, MessageSquare, Mail, Link2, Eye, FileText, Check, RefreshCw, Pencil, Camera, X, MoreHorizontal } from 'lucide-react';
import AppShell from '../components/app-shell';
import { QuoteDetailSkeleton } from '../components/skeletons';
import StatusBadge from '../components/status-badge';
import UpgradePrompt from '../components/upgrade-prompt';
import { calculateTotals } from '../lib/pricing';
import { currency, formatDate, formatQuoteNumber, friendly } from '../lib/format';
import { deleteQuote, duplicateQuote, getQuote, getProfile, updateQuoteStatus, markFollowedUp, createInvoiceFromQuoteWithAdditionalWork, uploadQuotePhoto, listQuotePhotos, deleteQuotePhoto, replyToCustomer } from '../lib/api';
import { listTemplates, renderTemplate, getSystemDefaults } from '../lib/api/templates';
import { saveJobTemplate } from '../lib/api/job-templates';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../components/toast';
import { safeWriteClipboard, nativeShare, openMaps } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { normalizeStatus, chipForStatus, colorForStatus, getNextAction, getSignals, isQuoteLocked, getTimelineSteps } from '../lib/workflow';
import { smsNotify } from '../lib/sms';
import { addToCalendar } from '../lib/calendar';
const PhotoAnnotator = lazy(() => import('../components/photo-annotator'));

const labelForDeposit = (status) => status === 'paid' ? 'Paid' : status === 'pending' ? 'Pending' : 'Required';
const draftFollowUp = () => '';

// Relative time → absolute date once we cross a week, matching the
// cutoff used in notification-center so "37d ago" doesn't sit next to
// "Mar 21" elsewhere on the same page.
const timeAgo = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const s = Math.round((Date.now() - date) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const days = Math.floor(s / 86400);
  if (days < 7) return `${days}d ago`;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-CA', sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: '2-digit' });
};

function getFollowUpAdvice(quote) {
  if (!quote) return null;
  const s = quote.status;
  const fc = Number(quote.followup_count) || 0;
  const daysSinceSent = quote.sent_at ? Math.floor((Date.now() - new Date(quote.sent_at)) / 86400000) : null;
  if (s === 'viewed') return { urgency: 'high', emoji: '🔥', headline: 'Customer is engaged — a quick text can close this' };
  if (s === 'sent' && daysSinceSent !== null && daysSinceSent >= 4) return { urgency: 'high', emoji: '⏰', headline: 'Quote going cold — follow up soon' };
  if (s === 'sent' && daysSinceSent !== null && daysSinceSent >= 2 && fc === 0) return { urgency: 'medium', emoji: '💬', headline: 'No response yet — a quick text often closes this' };
  return null;
}

function buildTimeline(quote) {
  if (!quote) return [];
  const events = [];
  const convo = Array.isArray(quote.conversation) ? quote.conversation : [];
  for (const msg of convo) {
    if (msg.text?.trim()) {
      events.push({ type: msg.role === 'customer' ? 'customer_message' : 'contractor_message', time: msg.timestamp || msg.created_at, data: msg });
    }
  }
  if (quote.created_at) events.push({ type: 'milestone', icon: '📝', label: 'Quote created', time: quote.created_at });
  if (quote.sent_at) events.push({ type: 'milestone', icon: '📤', label: 'Sent to customer', time: quote.sent_at });
  if (quote.first_viewed_at) events.push({ type: 'milestone', icon: '👁', label: 'Customer viewed', detail: quote.view_count > 1 ? `${quote.view_count} views total` : '', time: quote.first_viewed_at });
  if (quote.signed_at) events.push({
    type: 'milestone', icon: '✅',
    // Canonical state name is "Approved". A signed quote is by
    // definition approved — show "Signed" only as a sub-fact, not as
    // a separate co-equal state, otherwise we end up with two
    // milestones for one moment.
    label: 'Approved', detail: quote.signer_name ? `Signed by ${quote.signer_name}` : 'Signed',
    time: quote.signed_at,
  });
  if (quote.deposit_paid_at) events.push({ type: 'milestone', icon: '💰', label: 'Deposit received', time: quote.deposit_paid_at });
  if (quote.status === 'declined' && quote.updated_at && !quote.signed_at) events.push({ type: 'milestone', icon: '✕', label: 'Declined', time: quote.updated_at });
  if (quote.status === 'revision_requested' && quote.updated_at) events.push({ type: 'milestone', icon: '✏️', label: 'Changes requested', time: quote.updated_at });
  if (quote.amendment) events.push({ type: 'amendment', subtype: 'amendment', icon: '✏️', label: 'Amendment created', time: quote.amendment.created_at, data: quote.amendment });
  return events.filter(e => e.time).sort((a, b) => new Date(a.time) - new Date(b.time));
}

function FollowupModal({ quote, userProfile, templates, onClose, onSent }) {
  const firstName = quote.customer?.name?.split(' ')[0] || 'there';
  const senderName = userProfile?.company_name || userProfile?.full_name || '';
  const shareUrl = quote.share_token ? `${window.location.origin}/q/${quote.share_token}` : '';
  const fc = Number(quote.followup_count) || 0;
  const templateKey = fc === 0 ? 'followup_1_sms' : fc === 1 ? 'followup_2_sms' : 'followup_3_sms';
  const tmplBody = templates?.find(t => t.template_key === templateKey)?.body || getSystemDefaults()[templateKey];
  const defaultMsg = renderTemplate(tmplBody, { firstName, senderName, quoteTitle: quote.title || 'your quote', total: currency(quote.total), link: shareUrl });
  const [msg, setMsg] = useState(defaultMsg);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasPhone = Boolean(quote.customer?.phone);

  async function handleSend() {
    if (sending) return;
    if (!hasPhone) {
      // No-phone path: copy to clipboard, briefly flash the button as
      // "Copied! ✓", then close the modal so the user can paste into
      // their messaging app. Previously the modal stayed open and the
      // button label was the only feedback — easy to miss.
      try {
        await navigator.clipboard.writeText(msg);
        setCopied(true);
        setTimeout(() => { setCopied(false); onClose?.(); }, 900);
      } catch { /* clipboard blocked — leave modal open */ }
      return;
    }
    setSending(true);
    try {
      const r = await smsNotify.customMessage({ to: quote.customer.phone, body: msg });
      if (!r?.ok) window.open(`sms:${quote.customer.phone}?body=${encodeURIComponent(msg)}`, '_self');
    } catch { window.open(`sms:${quote.customer.phone}?body=${encodeURIComponent(msg)}`, '_self'); }
    try { await markFollowedUp(quote.id); } catch {}
    onSent({ followup_count: fc + 1, last_followup_at: new Date().toISOString() });
    setSending(false);
  }

  return (
    <div className="qb-modal-bg" onClick={onClose}>
      <div className="qb-modal nudge-modal" onClick={e => e.stopPropagation()}>
        <div className="nudge-modal-hd">
          <span className="nudge-modal-title">Follow up with {firstName}</span>
          <button type="button" className="qb-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        {!hasPhone && <div className="nudge-modal-note">No phone on file — message will be copied to clipboard</div>}
        <textarea className="jd-input nudge-modal-body" value={msg} onChange={e => setMsg(e.target.value)} rows={5} autoFocus />
        <div className="nudge-modal-acts">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={sending || !msg.trim()} onClick={handleSend}>
            {sending ? 'Sending…' : copied ? 'Copied! ✓' : hasPhone ? `Text ${firstName}` : 'Copy message'}
          </button>
        </div>
      </div>
    </div>
  );
}
import { estimateMonthly, showFinancing } from '../lib/financing';
import { haptic } from '../hooks/use-mobile-ux';
import { isPro } from '../lib/billing';

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
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [followingUp, setFollowingUp] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [annotatingPhoto, setAnnotatingPhoto] = useState(null);
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
  const [linkCopied, setLinkCopied] = useState(false);
  const [sendingText, setSendingText] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionSummary, setRevisionSummary] = useState('');
  const [sendingRevision, setSendingRevision] = useState(false);
  const [showChangeOrderModal, setShowChangeOrderModal] = useState(false);
  const [changeOrderDesc, setChangeOrderDesc] = useState('');

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

  // Auto-open nudge from notification action (?action=nudge)
  useEffect(() => {
    if (!quote) return;
    const p = new URLSearchParams(window.location.search);
    if (p.get('action') === 'nudge') {
      setShowNudgeModal(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [quote]);

  // Derived
  const shareUrl = quote?.share_token ? `${window.location.origin}/q/${quote.share_token}` : '';
  const hasShareToken = Boolean(quote?.share_token);
  const isDraft = quote?.status === 'draft';
  const isRevision = quote?.status === 'revision_requested';
  const isApproved = ['approved', 'approved_pending_deposit', 'deposit_paid'].includes(quote?.status);
  const isLocked = isApproved || ['converted_to_invoice', 'paid'].includes(quote?.status);
  const isSigned = Boolean(quote?.signed_at);
  const isExpired = quote?.expires_at && new Date(quote.expires_at) < new Date() && !['approved','approved_pending_deposit','deposit_paid','converted_to_invoice','paid'].includes(quote?.status);
  const expiryDaysLeft = quote?.expires_at && ['sent','viewed','revision_requested'].includes(quote?.status)
    ? Math.ceil((new Date(quote.expires_at) - Date.now()) / 86400000) : null;
  const isExpiringSoon = expiryDaysLeft !== null && expiryDaysLeft >= 0 && expiryDaysLeft <= 7;
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
    if (sendingText) return;
    if (!hasShareToken) return showToast("This quote doesn't have a share link yet — save it first.", 'error');
    const ph = quote.customer?.phone;
    if (!ph) return showToast('No phone on file for this customer.', 'error');
    setSendingText(true);

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
      setSendingText(false);
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
    setSendingText(false);
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

  async function handleSendRevised() {
    if (sendingRevision) return;
    setSendingRevision(true);
    try {
      const revNum = (Number(quote.revision_number) || 1) + 1;
      await updateQuoteStatus(quote.id, {
        status: 'sent', sent_at: new Date().toISOString(),
        revision_number: revNum, revision_summary: revisionSummary || '',
      });
      setQuote(p => ({ ...p, status: 'sent', sent_at: new Date().toISOString(), revision_number: revNum, revision_summary: revisionSummary }));
      if (quote.customer?.phone) {
        const msg = `${userProfile?.company_name || 'Your contractor'} revised your quote "${quote.title || 'Quote'}". Review changes: ${shareUrl}`;
        try { await smsNotify.customMessage({ to: quote.customer.phone, body: msg }); } catch {}
      }
      showToast('Revised quote sent', 'success');
      setShowRevisionModal(false);
      setRevisionSummary('');
    } catch (e) { showToast(friendly(e), 'error'); }
    finally { setSendingRevision(false); }
  }

  async function handleCreateChangeOrder() {
    if (!changeOrderDesc.trim()) return;
    try {
      const convo = Array.isArray(quote.conversation) ? [...quote.conversation] : [];
      convo.push({ role: 'contractor', text: `Change order: ${changeOrderDesc}`, timestamp: new Date().toISOString(), type: 'change_order' });
      await updateQuoteStatus(quote.id, { conversation: convo });
      navigate(`/app/quotes/${quote.id}/edit`);
      setShowChangeOrderModal(false);
    } catch (e) { showToast(friendly(e), 'error'); }
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
    if (!hasShareToken) return showToast("This quote doesn't have a share link yet — save it first.", 'error');
    try {
      await safeWriteClipboard(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
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
    showToast('Follow-up sent', 'success');
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

  async function handleSaveAsTemplate(name) {
    if (!user?.id || !name?.trim()) return;
    setSavingTemplate(true);
    try {
      await saveJobTemplate(user.id, {
        name: name.trim(),
        trade: quote.trade,
        description: quote.description,
        scope_summary: quote.scope_summary,
        province: quote.province,
        line_items: (quote.line_items || []).map(li => ({
          name: li.name, quantity: li.quantity, unit_price: li.unit_price,
          notes: li.notes || '', category: li.category || '',
        })),
      });
      showToast('Saved as job template', 'success');
      setShowSaveTemplate(false);
      setTemplateName('');
    } catch (e) {
      showToast(e?.message || 'Could not save template', 'error');
    } finally {
      setSavingTemplate(false);
    }
  }
  async function handleDelete() { try{if(quote.signed_at){await updateQuoteStatus(quote.id,{archived_at:new Date().toISOString()});showToast('Archived','success');}else{await deleteQuote(quote.id);showToast('Deleted','success');}navigate('/app');}catch(e){showToast(friendly(e),'error');} }

  const timeline = useMemo(() => quote ? buildTimeline(quote) : [], [quote]);
  const groupedItems = useMemo(() => { if(!quote)return {}; return (quote.line_items||[]).reduce((a,i)=>{const k=i.category||(i.item_type==='optional'?'Options':'Scope');a[k]||=[];a[k].push(i);return a;},{}); }, [quote]);

  // Loading/error
  if (loading) return <QuoteDetailSkeleton />;
  if (!quote) return <AppShell title="Quote"><div className="empty-state qd-not-found"><div className="qd-not-found-icon"><FileText size={36}/></div><h3 className="qd-not-found-title">Quote not found</h3><Link className="btn btn-secondary" to="/app">Back to dashboard</Link></div></AppShell>;

  const inlineEditBtn = isLocked ? null : isRevision ? <Link className="btn btn-primary btn-sm qd-inline-action" to={`/app/quotes/${quote.id}/edit`}>Revise →</Link> : <Link className="btn btn-secondary btn-sm qd-inline-action" to={`/app/quotes/${quote.id}/edit`}>Edit</Link>;
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
    <>
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
              {photos.length > 0 ? `Photos (${photos.length})` : (<><MoreHorizontal size={14} style={{ verticalAlign: 'middle', marginRight: 3 }} />More</>)}
            </button>
          </div>

          {/* ══════════ ZONE 1: STATUS HERO ══════════ */}
          <div className={`qd-hero${mobileTab !== 'details' ? ' qd-hero--compact' : ''}`}>
           {mobileTab === 'details' ? (<>
            <div className="qd-hero-top">
              <div className="qd-hero-top-info">
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

            {isDraft && <div className="qd-phase-banner qd-phase-draft qd-draft-inline-cta"><div className="qd-phase-dot qd-dot-draft"></div><div className="qd-phase-body"><div className="qd-phase-title">Draft — not sent yet</div><div className="qd-phase-hint">Finish items and pricing, then send.</div></div><Link className="btn btn-primary shrink-0" to={`/app/quotes/${quote.id}/edit`}>Continue editing →</Link></div>}

            {quote.status==='sent' && <div className="qd-phase-banner qd-phase-waiting"><div className="qd-phase-dot qd-dot-sent"></div><div className="qd-phase-body"><div className="qd-phase-title">Sent — waiting on {quote.customer?.name?.split(' ')[0] || 'customer'}</div><div className="qd-phase-hint">{quote.sent_at?`Sent ${formatDate(quote.sent_at)}`:'Sent'}{quote.view_count>0?` · viewed ${quote.view_count}×`:' · not opened yet — a quick text can help'}</div>{/* v100 M3: follow-up context block */}{(() => { const fc=Number(quote.followup_count)||0; const lf=quote.last_followup_at; const vs=Number(quote.views_since_followup)||0; if(fc===0)return null; const daysSince=lf?Math.round((Date.now()-new Date(lf).getTime())/86_400_000):null; const urgColor=daysSince===null?'var(--text-2)':daysSince<2?'var(--green)':daysSince<5?'var(--amber)':'var(--red)'; return <div className="qd-followup-context"><span className="qd-followup-context__stat" style={{color:urgColor}}>Last follow-up {daysSince===0?'today':daysSince===1?'1d ago':`${daysSince}d ago`}</span><span className="qd-followup-context__stat">{vs} view{vs!==1?'s':''} since</span></div>; })()}{advice && <div style={{marginTop:4,fontSize: 'var(--text-2xs)',color:'var(--text-2)'}}>{advice.emoji} {advice.headline}</div>}</div>{advice&&advice.urgency!=='low' && <button className="btn btn-primary btn-sm shrink-0" type="button" onClick={openNudgeModal}>{quote.customer?.phone ? `Follow up with ${quote.customer?.name?.split(' ')[0] || ''}` : 'Send follow-up'}</button>}</div>}

            {quote.status==='viewed' && <div className="qd-phase-banner qd-phase-hot"><div className="qd-phase-dot qd-dot-viewed"></div><div className="qd-phase-body"><div className="qd-phase-title">{quote.customer?.name?.split(' ')[0] || 'Customer'} is reviewing{quote.view_count>1?` (${quote.view_count}×)`:''}</div><div className="qd-phase-hint">{showFinancing(quote.total) && quote.view_count > 1 ? `They've looked ${quote.view_count} times — the monthly option (from ${currency(estimateMonthly(quote.total))}/mo) may be what they're considering. A quick text could close this.` : 'They\'re looking at it — a quick text can close this.'}</div>{/* v100 M3: follow-up context block */}{(() => { const fc=Number(quote.followup_count)||0; const lf=quote.last_followup_at; const vs=Number(quote.views_since_followup)||0; if(fc===0)return null; const daysSince=lf?Math.round((Date.now()-new Date(lf).getTime())/86_400_000):null; const urgColor=daysSince===null?'var(--text-2)':daysSince<2?'var(--green)':daysSince<5?'var(--amber)':'var(--red)'; return <div className="qd-followup-context"><span className="qd-followup-context__stat" style={{color:urgColor}}>Last follow-up {daysSince===0?'today':daysSince===1?'1d ago':`${daysSince}d ago`}</span><span className="qd-followup-context__stat">{vs} view{vs!==1?'s':''} since</span></div>; })()}</div><button className="btn btn-primary btn-sm shrink-0" type="button" onClick={openNudgeModal}>{quote.customer?.phone ? `Follow up with ${quote.customer?.name?.split(' ')[0] || ''}` : 'Send follow-up'}</button></div>}

            {isRevision && <div className="qd-phase-banner qd-phase-revision"><div className="qd-phase-dot qd-dot-amber"></div><div className="qd-phase-body"><div className="qd-phase-title">Changes requested</div><div className="qd-phase-hint">Review feedback, edit the quote, then send the revision.</div></div><div className="qd-phase-actions"><Link className="btn btn-secondary btn-sm shrink-0" to={`/app/quotes/${quote.id}/edit`}>Edit quote</Link><button className="btn btn-primary btn-sm shrink-0" type="button" onClick={() => setShowRevisionModal(true)}>Send revised quote →</button></div></div>}

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
              <>
                <div className="qd-phase-banner qd-phase-done">
                  <div className="qd-phase-dot qd-dot-done" />
                  <div className="qd-phase-body">
                    <div className="qd-phase-title">{quote.status === 'deposit_paid' ? 'Deposit paid — ready to invoice' : 'Approved — ready to invoice'}</div>
                    <div className="qd-phase-hint">Create an invoice to collect payment.</div>
                  </div>
                  <div className="qd-phase-actions">
                    <button className="btn btn-primary shrink-0" type="button" disabled={creatingInvoice} onClick={handleCreateInvoice}>
                      {creatingInvoice ? 'Creating…' : 'Create invoice'}
                    </button>
                    <button className="btn btn-secondary btn-sm shrink-0" type="button" onClick={() => addToCalendar(quote)} title="Add job to calendar">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle',marginRight:4}}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      Add to calendar
                    </button>
                    <button className="btn btn-secondary btn-sm shrink-0" type="button" onClick={() => setShowChangeOrderModal(true)}>Change order</button>
                    {userProfile && isPro(userProfile) && (
                      <button className="btn btn-secondary btn-sm shrink-0" type="button" onClick={() => { setTemplateName(quote.title || ''); setShowSaveTemplate(true); }} title="Save this quote as a reusable template">
                        Save as template
                      </button>
                    )}
                  </div>
                </div>
                {userProfile && isPro(userProfile) && quote.status === 'deposit_paid' && (
                  <div className="qd-win-moment">
                    <div className="qd-win-moment-emoji">🎉</div>
                    <div className="qd-win-moment-body">
                      <div className="qd-win-moment-title">Deposit received{quote.total > 0 ? ` — ${currency(quote.total)} job confirmed` : ''}</div>
                      <div className="qd-win-moment-sub">{quote.customer?.name?.split(' ')[0] || 'Your customer'} is locked in. Create the invoice when the work is done.</div>
                    </div>
                  </div>
                )}
                {userProfile && !isPro(userProfile) && (
                  <div className="qd-pro-moment">
                    <div className="qd-pro-moment-left">
                      <div className="qd-pro-moment-title">
                        🎉 {quote.customer?.name?.split(' ')[0] || 'Customer'} approved{quote.total > 0 ? ` — ${currency(quote.total)}` : ''}
                      </div>
                      <div className="qd-pro-moment-desc">
                        {(() => {
                          const total = quote.total || 0;
                          const monthsCovered = total > 0 ? Math.round(total / 29) : 0;
                          const roiNote = monthsCovered >= 2
                            ? ` This job alone covers ${monthsCovered} months of Pro.`
                            : monthsCovered === 1
                              ? ' This job alone covers a month of Pro.'
                              : ' One closed job typically covers it.';
                          return `Collect a deposit and invoice when the job's done.${roiNote} Upgrade for $29/month.`;
                        })()}
                      </div>
                    </div>
                    <Link to="/app/billing" className="btn btn-primary shrink-0 qd-pro-moment-btn">
                      Unlock Pro →
                    </Link>
                  </div>
                )}
              </>
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
            {isExpiringSoon && !isExpired && (
              <div className={`qd-phase-banner qd-phase-expiring${expiryDaysLeft <= 1 ? ' qd-phase-expiring--urgent' : ''}`}>
                <div className="qd-phase-dot" style={{ background: expiryDaysLeft <= 1 ? 'var(--red, #ef4444)' : 'var(--amber, #f59e0b)' }} />
                <div className="qd-phase-body">
                  <div className="qd-phase-title">{expiryDaysLeft === 0 ? 'Expires today' : `Expires in ${expiryDaysLeft} day${expiryDaysLeft > 1 ? 's' : ''}`}</div>
                  <div className="qd-phase-hint">Send a follow-up to keep momentum.</div>
                </div>
                <button className="btn btn-primary btn-sm shrink-0" type="button" onClick={() => setShowNudgeModal(true)}>Follow up</button>
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
                <button type="button" className="btn btn-secondary btn-sm btn-muted" onClick={()=>setConfirmDelete(true)}>Archive</button>
              </div>
            )}
            {isRevision && (
              <div className="qd-contextual-actions">
                <span className="qd-contextual-actions__label">Customer requested changes — reply below or revise the quote</span>
                <button type="button" className="btn btn-secondary btn-sm" disabled={aiDraftLoading} onClick={handleAiDraftReply}>
                  {aiDraftLoading ? 'Drafting…' : 'Draft a reply'}
                </button>
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
                  <div key={`m${i}`} className={`qd-feed-msg ${isCust?'':'qd-feed-msg--right'}`}><div className={`qd-feed-msg-avatar ${isCust?'':'qd-feed-msg-avatar--you'}`}>{isCust?(quote.customer?.name?.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase()||'?'):'Me'}</div><div className="qd-feed-msg-content"><div className="qd-feed-msg-meta" style={{textAlign:isCust?'left':'right'}}><strong>{isCust?(quote.customer?.name?.split(' ')[0]||'Customer'):'You'}</strong> · {timeAgo(e.timestamp)}</div><div className={`qd-feed-msg-bubble ${isCust?'':'qd-feed-msg-bubble--you'}`}>{e.text}</div>{!isCust && quote.messages_last_read_at && new Date(quote.messages_last_read_at) > new Date(e.timestamp) && (<div className="qd-feed-msg-read"><Check size={10} style={{verticalAlign:'middle',marginRight:3}}/>Read {timeAgo(quote.messages_last_read_at)}</div>)}</div></div>
                );
                })}
              </div>
            ) : (
              <div className="qd-no-messages">No messages yet</div>
            ); })()}
            {/* Reply input — below the thread */}
            {!isDraft && hasShareToken && !['paid','converted_to_invoice'].includes(quote?.status) && (
              <div className="qd-feed-reply"><div className="qd-reply-row"><textarea value={replyText} onChange={e=>setReplyText(e.target.value)} placeholder={`Message ${quote.customer?.name?.split(' ')[0]||'customer'}…`} rows={1} className="qd-feed-reply-input" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleReply();}}} onInput={e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,120)+'px';}} /><button type="button" className="btn btn-primary btn-sm qd-reply-send-btn" disabled={replySending||!replyText.trim()} onClick={handleReply}>{replySending?'…':'Send'}</button></div><div className="qd-reply-hint">Delivered via {quote.customer?.email?'email & quote page':'quote page'}{quote.customer?.phone?' · SMS':''}</div></div>
            )}
          </div>

          {/* ══════════ ZONE 3: SCOPE DETAILS (collapsed) ══════════ */}
          <div className={`qd-scope${mobileTab !== 'details' ? ' qd-zone-details' : ''}`}>
            {/* Activity timeline — moved here from Messages zone */}
            <div className="qd-activity-section">
              <div className="qd-feed-header"><span className="qd-feed-activity-title">Activity</span><span className="qd-feed-activity-count">{(() => { const c = timeline.filter(e=>e.type!=='customer_message'&&e.type!=='contractor_message').length; return `${c} event${c !== 1 ? 's' : ''}`; })()}</span></div>
              <div className="qd-feed-list">
                {timeline.filter(ev=>ev.type!=='customer_message'&&ev.type!=='contractor_message').map((ev,i) => {
                  return <div key={`e${i}`} className={`qd-feed-event ${ev.type==='milestone'?'qd-feed-event--milestone':''}`}><span className="qd-feed-event-icon">{ev.icon}</span><div className="qd-feed-event-body"><span className="qd-feed-event-label">{ev.label}</span>{ev.detail&&<span className="qd-feed-event-detail">{ev.detail}</span>}</div><span className="qd-feed-event-time">{timeAgo(ev.time)}</span></div>;
                })}
              </div>
            </div>
            <button type="button" className="qd-scope-toggle pl-toggle-row qd-scope-toggle-btn" onClick={()=>setScopeOpen(v=>!v)}>
              <div className="qd-scope-header-row"><span className="qd-scope-icon"><FileText size={14}/></span><span className="qd-scope-title">Scope & Pricing</span><span className="qb-muted fs-12">{(() => { const c = Object.values(groupedItems).reduce((s, arr) => s + arr.length, 0); return `${c} item${c !== 1 ? 's' : ''}`; })()} · {currency(quote.total)}</span></div>
              <span className={`pl-chevron ${scopeOpen ? 'pl-chevron--open' : ''}`} />
            </button>
            {scopeOpen && <div className="qd-scope-body">
              {quote.scope_summary && <div className="qd-scope-summary"><span className="qb-label">Scope</span><p className="qd-scope-summary-text">{quote.scope_summary}</p></div>}
              {Object.entries(groupedItems).map(([g,items])=><div key={g} className="qd-item-group"><div className="qb-group-label">{g}</div>{items.map(it=><div key={it.id} className={`qd-line-item ${it.included===false?'excluded':''}`}><div className="qd-li-info"><strong>{it.name}</strong>{it.notes&&<span className="qb-muted">{it.notes}</span>}</div><div className="qd-li-price"><span className="qb-muted">{it.quantity} × {currency(it.unit_price)}</span><strong>{it.included===false?'Optional':currency(it.quantity*it.unit_price)}</strong></div></div>)}</div>)}
              <div className="qd-totals"><div className="qb-total-row"><span>Subtotal</span><span>{currency(quote.subtotal)}</span></div>{Number(quote.discount||0)>0&&<div className="qb-total-row"><span>Discount</span><span>−{currency(quote.discount)}</span></div>}<div className="qb-total-row"><span>Tax</span><span>{currency(quote.tax)}</span></div><div className="qb-total-row grand"><span>Total</span><span>{currency(quote.total)}</span></div>{quote.deposit_required&&Number(quote.deposit_amount)>0&&<div className="qb-total-row qd-deposit-row"><span>Deposit ({labelForDeposit(quote.deposit_status)})</span><span>{currency(quote.deposit_amount)}</span></div>}</div>
              {(quote.assumptions||quote.exclusions)&&<div className="qd-two-col qd-two-col-wrap">{quote.assumptions&&<div className="qd-two-col-box"><strong className="qd-two-col-label">Assumptions</strong>{quote.assumptions}</div>}{quote.exclusions&&<div className="qd-two-col-box"><strong className="qd-two-col-label">Not included</strong>{quote.exclusions}</div>}</div>}
              {quote.revision_summary&&<div className="qb-notice qb-notice--mt"><strong>What changed:</strong> {quote.revision_summary}</div>}
            </div>}
          </div>
        </section>

        {/* ── SIDEBAR — visible on desktop always, on mobile only in "More" tab ── */}
        <aside className={`qd-sidebar${mobileTab === 'more' ? ' qd-sidebar--mobile-inline' : ''}${mobileTab !== 'more' ? ' qd-zone-sidebar' : ''}`}>
          {!isDraft && <div className="qb-card"><span className="qb-label">{isLocked?'Share':'Send / Share'}</span>{quote.sent_at&&<div className="qd-sent-pill">Sent {formatDate(quote.sent_at)}</div>}<div className="qd-send-grid">{!isLocked&&quote.customer?.phone&&<button className="btn btn-primary full-width" type="button" disabled={sendingText} onClick={handleSendText}><MessageSquare size={13} style={{verticalAlign:'middle',marginRight:5}}/>{sendingText?'Sending…':quote.sent_at?`Resend to ${quote.customer?.name?.split(' ')[0]||''}` :`Text ${quote.customer?.name?.split(' ')[0]||''}`}</button>}<button className="btn btn-secondary full-width" type="button" disabled={!hasShareToken} title={!hasShareToken ? 'Save the quote first to generate a link' : undefined} onClick={handleCopyLink}><Link2 size={13} style={{verticalAlign:"middle",marginRight:5}}/>{linkCopied?'Copied! ✓':'Copy link'}</button></div><a href={shareUrl+'?preview=1'} target="_blank" rel="noreferrer" className="qd-preview-link">Preview ↗</a></div>}

          {quote.customer && (
            <div className="qb-card qd-customer-card">
              <span className="qb-label">Customer</span>
              <div className="qd-cust-name">{quote.customer.name || 'Unnamed'}</div>
              {quote.customer.phone && <a href={`tel:${quote.customer.phone}`} className="qd-cust-link"><Phone size={12} /> {quote.customer.phone}</a>}
              {quote.customer.email && <a href={`mailto:${quote.customer.email}`} className="qd-cust-link"><Mail size={12} /> {quote.customer.email}</a>}
              {quote.customer.address && (
                <button type="button" className="qd-cust-link qd-cust-addr" onClick={() => openMaps(quote.customer.address)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {quote.customer.address}
                </button>
              )}
            </div>
          )}


          <div className="qb-card">
            <span className="qb-label">Photos {photos.length > 0 && `(${photos.length})`}</span>
            {photos.length > 0 && (
              <div className="qd-photos-grid">
                {photos.map(p => (
                  <div key={p.path} className="qd-photo-tile">
                    <img src={p.url} alt="" width={120} height={120} loading="lazy" className="qd-photo-img" />
                    <div className="qd-photo-actions">
                      <button type="button" aria-label="Markup photo" onClick={() => setAnnotatingPhoto(p)} className="qd-photo-markup" title="Draw on photo">
                        <Pencil size={12} />
                      </button>
                      <button type="button" aria-label="Remove photo" onClick={async () => { try { await deleteQuotePhoto(p.path); setPhotos(pr => pr.filter(x => x.path !== p.path)); showToast('Removed', 'info'); } catch (e) { showToast(friendly(e), 'error'); } }} className="qd-photo-remove">
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <label className="qd-photo-upload-label">
              {photoUploading ? 'Uploading…' : 'Add photo'}
              <input hidden type="file" accept="image/*" multiple onChange={async e => {
                const fs = Array.from(e.target.files || []);
                if (!fs.length) return;
                const v = fs.filter(f => f.size <= 5 * 1024 * 1024);
                if (v.length < fs.length) showToast(`${fs.length - v.length} over 5MB`, 'error');
                if (!v.length) { e.target.value = ''; return; }
                setPhotoUploading(true);
                let n = 0;
                for (const f of v) { try { const p = await uploadQuotePhoto(quoteId, f); setPhotos(pr => [p, ...pr]); n++; } catch (e) { showToast(friendly(e), 'error'); } }
                setPhotoUploading(false);
                if (n) showToast(`${n} added`, 'success');
                e.target.value = '';
              }} />
            </label>
          </div>
          {annotatingPhoto && (
            <Suspense fallback={null}>
              <PhotoAnnotator
                src={annotatingPhoto.url}
                onClose={() => setAnnotatingPhoto(null)}
                onSave={async (blob) => {
                  setAnnotatingPhoto(null);
                  setPhotoUploading(true);
                  try {
                    const file = new File([blob], `markup-${Date.now()}.jpg`, { type: 'image/jpeg' });
                    const p = await uploadQuotePhoto(quoteId, file);
                    setPhotos(pr => [p, ...pr]);
                    showToast('Markup saved', 'success');
                  } catch (e) { showToast(friendly(e), 'error'); }
                  setPhotoUploading(false);
                }}
              />
            </Suspense>
          )}

          <details className="qb-card qd-more-actions-card"><summary className="pl-toggle-row qd-more-actions-summary">
            <span className="qd-more-actions-title">More actions</span>
            <span className="pl-chevron" />
          </summary><div className="qd-send-grid qd-more-actions-body"><button className="btn btn-secondary full-width fs-12" type="button" disabled={pdfLoading} onClick={handleDownloadPdf}>{pdfLoading?'Generating…':'Download PDF'}</button>{typeof navigator!=='undefined'&&navigator.share&&<button className="btn btn-secondary full-width fs-12" type="button" onClick={()=>nativeShare({title:quote.title||'Quote',url:shareUrl},showToast)}>Share</button>}<button className="btn btn-secondary full-width fs-12" type="button" onClick={handleDuplicate}>Duplicate as new quote</button><button className="btn btn-secondary full-width fs-12" type="button" onClick={() => { setTemplateName(quote.title || ''); setShowSaveTemplate(true); }}>Save as job template</button>{!confirmDelete?<button className="btn btn-secondary full-width qd-btn-danger" type="button" onClick={()=>setConfirmDelete(true)}>{quote.signed_at?'Archive':'Delete'}</button>:<div className="qd-delete-confirm-row"><button className="btn btn-secondary btn-sm qd-btn-danger" type="button" onClick={handleDelete}>{quote.signed_at?'Archive':'Delete'}</button><button className="btn btn-secondary btn-sm" type="button" onClick={()=>setConfirmDelete(false)}>Cancel</button></div>}</div></details>
        </aside>
      </div>

      {/* Mobile bars */}
      {isDraft && <div className="qd-mobile-send-bar"><Link className="btn btn-primary qd-mobile-cta-link" to={`/app/quotes/${quote.id}/edit`}>Continue editing →</Link></div>}
      {!isDraft&&!isLocked&&!isRevision&&!isExpired&&hasShareToken&&<div className="qd-mobile-send-bar">{quote.customer?.phone?<button className="btn btn-primary flex-1" type="button" disabled={sendingText} onClick={handleSendText}><MessageSquare size={13} style={{verticalAlign:'middle',marginRight:5}}/>{sendingText?'Sending…':`Text ${quote.customer?.name?.split(' ')[0]||'quote'}`}</button>:<button className="btn btn-primary flex-1" type="button" onClick={handleCopyLink}><Link2 size={13} style={{verticalAlign:"middle",marginRight:5}}/>{linkCopied?'Copied! ✓':'Copy link'}</button>}<button className={`btn btn-secondary qd-copy-link-btn qd-copy-link-btn-compact${linkCopied?' qd-copy-link-btn--copied':''}`} type="button" onClick={handleCopyLink} aria-label="Copy quote link"><Link2 size={14}/><span className="qd-copy-link-text">{linkCopied?'✓':'Link'}</span></button></div>}
      {isRevision&&<div className="qd-mobile-send-bar"><Link className="btn btn-primary qd-mobile-cta-link" to={`/app/quotes/${quote.id}/edit`}>Revise & resend →</Link></div>}
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
    {showSaveTemplate && (
      <div className="jt-modal-bg" onClick={() => setShowSaveTemplate(false)}>
        <div className="jt-modal" onClick={e => e.stopPropagation()}>
          <div className="jt-modal-hd">
            <h3 className="jt-modal-title">Save as job template</h3>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setShowSaveTemplate(false)} aria-label="Close">×</button>
          </div>
          <div className="jt-modal-body">
            <label className="jt-modal-label">Template name</label>
            <input
              className="input"
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              placeholder="e.g. Furnace replacement — mid-range"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && templateName.trim()) handleSaveAsTemplate(templateName); }}
            />
            <p className="jt-modal-hint">Saves line items, trade, province and description. Find it under Templates → Job Templates.</p>
          </div>
          <div className="jt-modal-footer">
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowSaveTemplate(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" type="button" disabled={savingTemplate || !templateName.trim()} onClick={() => handleSaveAsTemplate(templateName)}>
              {savingTemplate ? 'Saving…' : 'Save template'}
            </button>
          </div>
        </div>
      </div>
    )}
    {showRevisionModal && (
      <div className="jt-modal-bg" onClick={() => setShowRevisionModal(false)}>
        <div className="jt-modal" onClick={e => e.stopPropagation()}>
          <div className="jt-modal-hd">
            <h3 className="jt-modal-title">Send revised quote</h3>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setShowRevisionModal(false)} aria-label="Close">×</button>
          </div>
          <div className="jt-modal-body">
            <label className="jt-modal-label">What changed? (shown to customer)</label>
            <textarea className="input textarea-md" value={revisionSummary} onChange={e => setRevisionSummary(e.target.value)} placeholder="e.g. Updated pricing for exterior work, added cleanup line item" autoFocus rows={3} />
            <p className="jt-modal-hint">This will mark the quote as Revision {(Number(quote?.revision_number) || 1) + 1} and notify {quote?.customer?.name?.split(' ')[0] || 'the customer'}.</p>
          </div>
          <div className="jt-modal-footer">
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowRevisionModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" type="button" disabled={sendingRevision} onClick={handleSendRevised}>{sendingRevision ? 'Sending…' : 'Send revision →'}</button>
          </div>
        </div>
      </div>
    )}
    {showChangeOrderModal && (
      <div className="jt-modal-bg" onClick={() => setShowChangeOrderModal(false)}>
        <div className="jt-modal" onClick={e => e.stopPropagation()}>
          <div className="jt-modal-hd">
            <h3 className="jt-modal-title">Create change order</h3>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setShowChangeOrderModal(false)} aria-label="Close">×</button>
          </div>
          <div className="jt-modal-body">
            <label className="jt-modal-label">Describe the scope change</label>
            <textarea className="input textarea-md" value={changeOrderDesc} onChange={e => setChangeOrderDesc(e.target.value)} placeholder="e.g. Customer requested additional outlet in kitchen" autoFocus rows={3} />
            <p className="jt-modal-hint">This will unlock the quote for editing so you can add/modify line items. The change will be tracked in the quote history.</p>
          </div>
          <div className="jt-modal-footer">
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowChangeOrderModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" type="button" disabled={!changeOrderDesc.trim()} onClick={handleCreateChangeOrder}>Edit quote →</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

