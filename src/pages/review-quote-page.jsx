import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/app-shell';
import { calculateTotals } from '../lib/pricing';
import { createCustomer, friendly, createQuote, getQuote, getProfile, listCustomers, listQuotes, updateQuote, sendQuoteEmail } from '../lib/api';
import { useAuth } from '../hooks/use-auth';
import { useUnsavedChanges } from '../hooks/use-unsaved-changes';
import { currency } from '../lib/format';
import { useToast } from '../components/toast';
import { makeId } from '../lib/utils';
import { searchCatalog, browseCatalog } from '../../shared/systemCatalog';
import { regionalize, normalizeTrade, anchorPrice } from '../../shared/tradeBrain';
import { smartSearch } from '../../shared/smartCatalog';
import { extractJobContext } from '../../shared/jobContext';
import UpgradePrompt from '../components/upgrade-prompt';
import ConfirmModal from '../components/confirm-modal';
import { isPro, countSentThisMonth, canSendQuote } from '../lib/billing';
import { buildConfidence } from '../lib/pricing';
import useScrollLock from '../hooks/use-scroll-lock';
import { saveOfflineDraft, getOfflineDraft, deleteOfflineDraft } from '../lib/offline';

/* ── Scope gap hints by trade (keyed on tradeBrain canonical values) ── */
const SCOPE_HINTS = {
  Plumber: ['Disposal fees', 'Shut-off valve replacement', 'Permit', 'Patch/repair after access', 'Cleanup'],
  Electrician: ['Permit & inspection', 'Panel labelling', 'Patching/repair', 'Disposal', 'GFCI/AFCI upgrades'],
  HVAC: ['Duct modification', 'Electrical hookup', 'Permit', 'Refrigerant handling', 'Thermostat wiring'],
  General: ['Disposal', 'Cleanup', 'Permit', 'Material delivery', 'Touch-up / patching'],
  Carpenter: ['Hardware/fasteners', 'Finishing/stain', 'Disposal', 'Touch-up paint', 'Delivery'],
  Painter: ['Surface prep', 'Primer coat', 'Caulking', 'Furniture moving', 'Drop cloths/protection'],
  Roofing: ['Permit', 'Disposal/dump fees', 'Flashing', 'Ice & water shield', 'Ventilation'],
};

export default function ReviewQuotePage() {
  const { user } = useAuth();
  const { quoteId } = useParams();
  const nav = useNavigate();
  const { show: toast } = useToast();
  const dirty = useRef(false);
  const [isDirty, setIsDirty] = useState(false);
  const catalogDebounceRef = useRef(null);

  // Helper to mark dirty in both ref (for autosave) and state (for unsaved-changes guard)
  function markDirty() { dirty.current = true; setIsDirty(true); }
  function clearDirty() { dirty.current = false; setIsDirty(false); }

  const [lineItems, setLineItems] = useState([]);
  const [draft, setDraft] = useState({
    title: '', description: '', scope_summary: '', assumptions: '', exclusions: '',
    customer_id: '', status: 'draft', expiry_days: 14,
    deposit_required: false, deposit_percent: 20, deposit_amount: 0,
    deposit_status: 'not_required', internal_notes: '', revision_summary: '',
    schedule_window: '', quick_notes: '',
  });
  const [trade, setTrade] = useState('Other');
  const [province, setProvince] = useState('AB');
  const [country, setCountry] = useState('CA');
  const [deliveryMethod, setDeliveryMethod] = useState('email');
  const [companyName, setCompanyName] = useState('');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [saveState, setSaveState] = useState('');
  const [error, setError] = useState('');
  const [offlineDraft, setOfflineDraft] = useState(false); // true when last save went to IndexedDB
  const [showSend, setShowSend] = useState(false);
  useScrollLock(showSend);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showNewCust, setShowNewCust] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', email: '', phone: '', address: '' });
  const [addMode, setAddMode] = useState(null);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogResults, setCatalogResults] = useState([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [sentThisMonth, setSentThisMonth] = useState(0);
  const [editingItemId, setEditingItemId] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [zeroItemConfirm, setZeroItemConfirm] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const initialLoadComplete = useRef(false);

  useEffect(() => {
    if (!user) return;
    const profileP = getProfile(user.id);
    profileP.then(p => {
      setUserProfile(p);
      if (p?.province) setProvince(p.province);
      if (p?.country) setCountry(p.country);
      if (p?.trade) setTrade(p.trade);
      if (p?.company_name) setCompanyName(p.company_name);
      if (!isPro(p)) {
        listQuotes(user.id).then(q => setSentThisMonth(countSentThisMonth(q || []))).catch(() => {});
      }
    }).catch(e => { console.warn('[Punchlist] Profile load failed:', e.message); });
    listCustomers(user.id).then(c => setCustomers(c || [])).catch(e => toast(friendly(e), 'error'));

    if (quoteId) {
      Promise.all([getQuote(quoteId), profileP.catch(() => null)]).then(([q, p]) => {
        const LOCKED_STATUSES = ['approved', 'approved_pending_deposit', 'scheduled', 'completed', 'invoiced', 'paid'];
        if (LOCKED_STATUSES.includes(q.status) || q.signed_at) {
          setIsLocked(true);
        }
        const draftData = { title: q.title || '', description: q.description || '', scope_summary: q.scope_summary || '', assumptions: q.assumptions || '', exclusions: q.exclusions || '', customer_id: q.customer_id || '', status: q.status || 'draft', expiry_days: q.expiry_days || 14, deposit_required: q.deposit_required || false, deposit_percent: Number(q.deposit_percent || 20), deposit_amount: Number(q.deposit_amount || 0), deposit_status: q.deposit_status || 'not_required', internal_notes: q.internal_notes || '', revision_summary: q.revision_summary || '', schedule_window: q.schedule_window || '', quick_notes: q.quick_notes || '', discount: Number(q.discount || 0) };
        // Apply profile defaults for fresh drafts (no deposit/expiry customized yet)
        if (p && q.status === 'draft' && !q.deposit_required && !q.internal_notes) {
          if (p.default_expiry_days) draftData.expiry_days = Number(p.default_expiry_days);
          if (p.default_deposit_mode && p.default_deposit_mode !== 'none') {
            draftData.deposit_required = true;
            if (p.default_deposit_mode === 'percent') draftData.deposit_percent = Number(p.default_deposit_value || 20);
            else draftData.deposit_amount = Number(p.default_deposit_value || 0);
          }
          if (Array.isArray(p.payment_methods) && p.payment_methods.length) draftData.payment_methods = p.payment_methods;
          if (p.payment_instructions) draftData.payment_instructions = p.payment_instructions;
        }
        setDraft(draftData);
        // Auto-expand assumptions section if AI pre-populated it
        if (draftData.assumptions && draftData.assumptions.trim()) setShowDetails(true);
        if (q.trade) setTrade(q.trade);
        if (q.province) setProvince(q.province);
        if (q.country) setCountry(q.country);
        setLineItems((q.line_items || []).map(i => ({ id: i.id || makeId(), name: i.name, quantity: Number(i.quantity || 1), unit_price: Number(i.unit_price || 0), notes: i.notes || '', included: i.included !== false, category: i.category || '' })));
        initialLoadComplete.current = true;
        // ── Prompt 9: restore offline draft if it's newer than the Supabase record ──
        getOfflineDraft(quoteId).then(od => {
          if (!od) return;
          const supabaseTime = new Date(q.updated_at || 0).getTime();
          const offlineTime = new Date(od.savedAt || 0).getTime();
          if (offlineTime > supabaseTime) {
            if (od.title !== undefined || od.description !== undefined) {
              setDraft(d => ({ ...d, ...od }));
            }
            if (Array.isArray(od.line_items)) {
              setLineItems(od.line_items.map(i => ({
                id: i.id || makeId(), name: i.name, quantity: Number(i.quantity || 1),
                unit_price: Number(i.unit_price || 0), notes: i.notes || '',
                included: i.included !== false, category: i.category || '',
              })));
            }
            setOfflineDraft(true);
            toast('Restored offline draft', 'info');
          }
        }).catch(() => {});
      }).catch(e => setError(friendly(e)));
    } else {
      // No quoteId — draft-first model requires one. Redirect to start.
      nav('/app/quotes/new');
    }
  }, [user, quoteId]);

  function ud(k, v) { markDirty(); setDraft(d => ({ ...d, [k]: v })); }
  function updateItem(id, changes) { markDirty(); setLineItems(p => p.map(i => i.id === id ? { ...i, ...changes } : i)); }
  function removeItem(id) {
    const removed = lineItems.find(i => i.id === id);
    markDirty();
    setLineItems(p => p.filter(i => i.id !== id));
    if (removed?.name) toast(`Removed: ${removed.name}`, 'info');
  }
  function duplicateItem(id) {
    const orig = lineItems.find(i => i.id === id);
    if (!orig) return;
    const newItem = { ...orig, id: makeId() };
    setLineItems(p => { const idx = p.findIndex(i => i.id === id); const next = [...p]; next.splice(idx + 1, 0, newItem); return next; });
    markDirty();
    toast(`Duplicated: ${orig.name}`, 'success');
  }
  function adjustQty(id, delta) { setLineItems(p => p.map(i => i.id === id ? { ...i, quantity: Math.max(0.25, Math.round(((i.quantity || 1) + delta * 0.25) * 100) / 100) } : i)); markDirty(); }

  // Memoize job context for smart search
  const jobCtx = useMemo(() => {
    return extractJobContext([draft.title, draft.description].filter(Boolean).join('. '), trade);
  }, [draft.title, draft.description, trade]);

  useEffect(() => {
    if (addMode !== 'catalog') { setCatalogResults([]); return; }
    if (!catalogQuery || catalogQuery.length < 2) {
      // Browse mode: immediate — no debounce, empty query just shows trade items
      clearTimeout(catalogDebounceRef.current);
      const browse = browseCatalog(trade, 30).map(hit => {
        const adj = regionalize(hit, province);
        const anchored = anchorPrice(adj.lo || hit.lo, adj.hi || hit.hi, normalizeTrade(trade), hit.c);
        return { id: `cat_${makeId()}`, name: hit.n, desc: hit.d || '', category: hit.c || '', lo: anchored.lo, hi: anchored.hi, mid: anchored.mid };
      });
      setCatalogResults(browse);
      return;
    }
    // Active search: debounce 200ms to avoid hammering smartSearch on every keystroke
    clearTimeout(catalogDebounceRef.current);
    catalogDebounceRef.current = setTimeout(() => {
      const results = smartSearch(catalogQuery, jobCtx, province, 25).map(hit => ({
        id: `cat_${makeId()}`, name: hit.name, desc: hit.desc || '', category: hit.category || '',
        lo: hit.lo, hi: hit.hi, mid: hit.mid,
        isContextRelevant: hit.isContextRelevant,
      }));
      setCatalogResults(results);
    }, 200);
    return () => clearTimeout(catalogDebounceRef.current);
  }, [catalogQuery, trade, province, addMode, jobCtx]);

  function addCatalogItem(item) {
    const exists = lineItems.some(i => i.name.toLowerCase() === item.name.toLowerCase());
    if (exists) { toast('Already added', 'info'); return; }
    setLineItems(p => [...p, { id: makeId(), name: item.name, quantity: 1, unit_price: item.mid || 0, notes: '', included: true, category: item.category || '' }]);
    markDirty();
    toast(`Added: ${item.name}`, 'success');
  }

  // Guard unsaved changes — blocks both browser unload and back-button navigation
  useUnsavedChanges(isDirty && lineItems.length > 0);

  useEffect(() => {
    if (!quoteId) return;
    const interval = setInterval(async () => {
      // ── Prompt 9: if offline draft exists and we're back online, try to sync ──
      if (offlineDraft && navigator.onLine && quoteId) {
        const synced = await save(null, true);
        if (synced) toast('Back online — quote synced', 'success');
        return;
      }
      if (dirty.current && !saving && !isLocked && initialLoadComplete.current && lineItems.length > 0) save(null, true);
    }, 30000);
    return () => clearInterval(interval);
  }, [user, lineItems, saving, quoteId, isLocked, offlineDraft]);

  const totals = useMemo(() => calculateTotals(lineItems, province, country), [lineItems, province, country]);
  const selCustomer = customers.find(c => c.id === draft.customer_id);

  const confidence = useMemo(() => buildConfidence(lineItems, [], {
    hasCustomer: !!draft.customer_id, hasScope: !!draft.scope_summary,
    hasDeposit: !draft.deposit_required || draft.deposit_status === 'paid',
    revisionSummary: draft.revision_summary,
  }), [lineItems, draft]);

  const scopeHints = useMemo(() => {
    const hints = SCOPE_HINTS[normalizeTrade(trade)] || SCOPE_HINTS.General;
    const existingNames = new Set(lineItems.map(i => (i.name || '').toLowerCase()));
    return hints.filter(h => !existingNames.has(h.toLowerCase()) && !lineItems.some(i => (i.name || '').toLowerCase().includes(h.toLowerCase())));
  }, [trade, lineItems]);

  async function save(nextStatus = null, silent = false) {
    if (!user) return null;
    // Guard: don't autosave/preview-save before the initial quote load has populated lineItems.
    // Without this, an empty lineItems array (the initial state) would wipe all existing items
    // in updateQuote because `[]` is not null/undefined and passes the `??` fallback check.
    // Explicit sends (nextStatus === 'sent') are allowed through — the user intentionally acted.
    if (!nextStatus && !initialLoadComplete.current) return null;
    if (!nextStatus && lineItems.length === 0 && quoteId) return null;
    setSaving(true); setSaveState('saving');
    try {
      // Preserve current quote status unless an explicit status change was requested (e.g. send).
      // This prevents autosave from downgrading 'sent'/'viewed'/etc. back to 'draft'.
      const effectiveStatus = nextStatus || draft.status || 'draft';
      const pl = { ...draft, status: effectiveStatus, line_items: lineItems, trade, province, country, delivery_method: deliveryMethod };
      const q = quoteId ? await updateQuote(quoteId, pl) : await createQuote(user.id, pl);
      clearDirty(); setSaveState('saved');
      // If we had an offline draft and now succeeded, clean it up
      if (offlineDraft && quoteId) {
        deleteOfflineDraft(quoteId).catch(() => {});
        setOfflineDraft(false);
      }
      if (!quoteId && q?.id) nav(`/app/quotes/${q.id}/edit`, { replace: true });
      if (!silent) toast(nextStatus === 'sent' ? 'Quote sent' : 'Saved', 'success');
      return q;
    } catch (e) {
      // ── Prompt 9: offline fallback on network failure ──
      const isNetworkError = e instanceof TypeError && /fetch|network|failed/i.test(e.message);
      if (isNetworkError && quoteId) {
        const effectiveStatus = nextStatus || draft.status || 'draft';
        const pl = { ...draft, status: effectiveStatus, line_items: lineItems, trade, province, country, delivery_method: deliveryMethod };
        try {
          await saveOfflineDraft({ ...pl, id: quoteId, quoteId, savedAt: new Date().toISOString() });
          setOfflineDraft(true);
          setSaveState('');
          if (!silent) toast("Saved offline — will sync when you're back online", 'info');
          return null;
        } catch { /* IndexedDB also failed, fall through */ }
      }
      setError(friendly(e)); setSaveState('');
      if (!silent) toast(friendly(e), 'error');
      return null;
    } finally { setSaving(false); }
  }

  function handleSend() {
    setError('');
    if (!canSendQuote(userProfile, sentThisMonth)) { setShowUpgradeModal(true); return; }
    // Customer required for email/text — but "copy link" can skip it
    if (!draft.customer_id && deliveryMethod !== 'copy') {
      // Scroll to customer section and show helpful prompt instead of hard error
      setError('Add a customer to send via email or text. Or use "Copy link" to share without a contact.');
      return;
    }
    // Validate the selected contact has the required channel info
    if (deliveryMethod === 'email' && draft.customer_id) {
      const cust = customers.find(c => c.id === draft.customer_id);
      if (!cust?.email) {
        setError('This contact has no email address. Add one in Contacts, or send via Text or Copy link instead.');
        return;
      }
    }
    if (deliveryMethod === 'text' && draft.customer_id) {
      const cust = customers.find(c => c.id === draft.customer_id);
      if (!cust?.phone) {
        setError('This contact has no phone number. Add one in Contacts, or send via Email or Copy link instead.');
        return;
      }
    }
    if (!lineItems.some(i => i.name?.trim())) return setError('Add at least one item');
    const zeroItems = lineItems.filter(i => i.name?.trim() && Number(i.unit_price) === 0);
    if (zeroItems.length > 0) { setZeroItemConfirm(zeroItems.length); return; }
    proceedToSend();
  }

  function proceedToSend() {
    setZeroItemConfirm(null);
    if (!draft.scope_summary.trim()) {
      const names = lineItems.filter(i => i.name?.trim()).map(i => i.name).slice(0, 8);
      ud('scope_summary', `${draft.title || 'Work'}. Includes: ${names.join(', ')}.`);
    }
    setShowSend(true);
  }

  async function confirmSend() {
    setShowSend(false);
    setSending(true);
    try {
      const q = await save('sent');
      if (!q) { setSending(false); return; }
      const url = `${window.location.origin}/public/${q.share_token}`;
      const firstName = selCustomer?.name?.split(' ')[0] || '';
      const compName = companyName || 'Your contractor';
      const phone = userProfile?.phone || '';
      const jobTitle = draft.title || 'Your quote';

      if (deliveryMethod === 'email') {
        const to = selCustomer?.email || '';

        // ── Primary: send branded HTML email via Resend API ──
        // Falls back to mailto if Resend is unavailable or fails
        let resendSent = false;
        if (to) {
          try {
            await sendQuoteEmail(q.id, to);
            resendSent = true;
            toast('Quote emailed to ' + (firstName || to), 'success');
          } catch (emailErr) {
            console.warn('[Punchlist] Resend email failed, falling back to mailto:', emailErr.message);
          }
        }

        // Fallback: open native email client with plain-text body
        if (!resendSent) {
          const subj = encodeURIComponent(`Quote: ${jobTitle} — ${compName}`);
          const EMAIL_BUDGET = 1800;
          const baseUrl = `mailto:${to}?subject=${subj}&body=`;

          const greeting = `Hi${firstName ? ' ' + firstName : ''},\n\n`;
          const intro = `I've put together a quote for the work we discussed.\n\n`;
          const footer =
            `Total: ${currency(grandTotal, country)}\n\n` +
            `Review and approve here:\n${url}\n\n` +
            `You can approve, request changes, or ask questions from that link.\n\n` +
            `${compName}${phone ? '\n' + phone : ''}`;

          const measureUrl = (scopeLine) =>
            baseUrl.length + encodeURIComponent(greeting + intro + scopeLine + footer).length;

          let scopeLine = draft.scope_summary ? `Scope: ${draft.scope_summary}\n` : '';

          if (measureUrl(scopeLine) > EMAIL_BUDGET) {
            if (draft.scope_summary) {
              const overhead =
                baseUrl.length +
                encodeURIComponent(greeting + intro + 'Scope: \n' + footer).length;
              const budget = EMAIL_BUDGET - overhead;
              let raw = draft.scope_summary;
              while (raw.length > 0 && encodeURIComponent(raw + '...').length > budget) {
                const lastPunct = Math.max(raw.lastIndexOf('.'), raw.lastIndexOf('!'), raw.lastIndexOf('?'));
                if (lastPunct > 0) {
                  raw = raw.slice(0, lastPunct).trimEnd();
                } else {
                  raw = '';
                  break;
                }
              }
              scopeLine = raw.length > 0 ? `Scope: ${raw}...\n` : '';
            }
            if (measureUrl(scopeLine) > EMAIL_BUDGET) {
              scopeLine = '';
            }
          }

          const body = encodeURIComponent(greeting + intro + scopeLine + footer);
          window.location.href = `${baseUrl}${body}`;
          toast('Opening email…', 'info');
        }
      } else if (deliveryMethod === 'text') {
        const smsTo = selCustomer?.phone || '';
        const SMS_BUDGET = 300;
        // Build SMS body — prefer full version; drop scope if over budget
        const smsWithScope =
          `Hi${firstName ? ' ' + firstName : ''}, your quote from ${compName} is ready to review:\n\n` +
          `${jobTitle} — ${currency(grandTotal, country)}\n\n` +
          `${url}`;
        const smsNoScope =
          `Hi${firstName ? ' ' + firstName : ''}, your quote from ${compName} is ready:\n` +
          `${jobTitle} — ${currency(grandTotal, country)}\n${url}`;
        const chosenSms = encodeURIComponent(smsWithScope).length <= SMS_BUDGET ? smsWithScope : smsNoScope;
        const smsBody = encodeURIComponent(chosenSms);
        window.open(`sms:${smsTo}?body=${smsBody}`, '_self');
        toast('Opening messages…', 'info');
      } else if (deliveryMethod === 'copy') {
        try { await navigator.clipboard.writeText(url); toast('Link copied', 'success'); } catch { toast('Could not copy — share this link: ' + url, 'info'); }
      }
      setSentSuccess(true);

      // ── VALUE TRIGGER 1: First quote sent ──
      const newCount = sentThisMonth + 1;
      setSentThisMonth(newCount);
      if (!isPro(userProfile)) {
        try {
          const shown = localStorage.getItem('pl_first_quote_trigger');
          if (!shown) {
            localStorage.setItem('pl_first_quote_trigger', '1');
            setTimeout(() => {
              toast('Nice — your first quote is out! You can send up to 5 per month on the free plan.', 'success');
            }, 1500);
          } else if (newCount === 3 || newCount === 4) {
            setTimeout(() => {
              toast(`You're getting real use out of Punchlist — ${newCount} of 5 quotes sent this month.`, 'success');
            }, 1500);
          }
        } catch {}
      }
    } catch (e) { setError(e?.message || 'Send failed'); }
    finally { setSending(false); }
  }

  const grandTotal = Math.max(0, totals.subtotal - (draft.discount || 0)) * (1 + totals.rate);
  const itemCount = lineItems.filter(i => i.name?.trim()).length;

  return (
    <AppShell title={quoteId ? 'Edit Quote' : 'Review Quote'} subtitle={quoteId ? (companyName || null) : 'Step 3 of 3'}>
      {showUpgradeModal && <UpgradePrompt trigger="quote_limit" context={{ count: sentThisMonth }} onDismiss={() => setShowUpgradeModal(false)} />}
      <div className="rq-page">

        {/* ── Lock Guard Banner ── */}
        {isLocked && (
          <div style={{ borderLeft: '3px solid var(--amber)', background: 'var(--panel)', padding: '10px 14px', borderRadius: 6, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>This quote has been approved — editing is disabled.</span>
            <a href={`/app/quotes/${quoteId}`} style={{ color: 'var(--brand)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', textDecoration: 'none' }}>← Back to quote</a>
          </div>
        )}

        <div style={isLocked ? { pointerEvents: 'none', opacity: 0.65 } : undefined}>

        {/* ── First-run guide — shown only on first quote ── */}
        {!isLocked && draft.status === 'draft' && !localStorage.getItem('pl_has_sent_quote') && itemCount > 0 && (
          <div className="rq-first-run-guide" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: 'var(--brand-bg)', border: '1px solid var(--brand-glow)', borderRadius: 'var(--r)', marginBottom: 10 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>⚡</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Almost there — review and send</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
                Adjust prices if needed, add a customer, then hit Send. You can also just copy the link — no customer required.
              </div>
            </div>
          </div>
        )}

        {/* ── Header: Title + Customer ── */}
        <div className="rq-header-card">
          <input className="rq-job-title-input" value={draft.title} onChange={e => ud('title', e.target.value)} placeholder="Job title" />
          <div className="rq-customer-section">
            {selCustomer ? (
              <div className="rq-cust-row">
                <div className="rq-cust-info">
                  <span className="rq-cust-avatar">{selCustomer.name?.[0]?.toUpperCase() || '?'}</span>
                  <div><span className="rq-cust-name">{selCustomer.name}</span>{selCustomer.email && <span className="rq-cust-detail"> · {selCustomer.email}</span>}</div>
                </div>
                <button className="rq-cust-change" type="button" onClick={() => { ud('customer_id', ''); setCustomerSearch(''); }}>Change</button>
              </div>
            ) : (
              <div className="rq-cust-select">
                <input className="jd-input" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Search or add customer…" autoComplete="off" />
                {customerSearch.trim() && (() => {
                  const matches = customers.filter(c => [c.name, c.email, c.phone].some(v => String(v || '').toLowerCase().includes(customerSearch.toLowerCase()))).slice(0, 5);
                  return matches.length > 0 ? (
                    <div className="jd-cust-list">{matches.map(c => <button key={c.id} className="jd-cust-pill" type="button" onClick={() => { ud('customer_id', c.id); setCustomerSearch(''); }}><span>{c.name}</span>{c.phone && <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>{c.phone}</span>}{c.email && <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>{c.email}</span>}</button>)}</div>
                  ) : (
                    <button className="jd-cust-pill jd-cust-new" type="button" onClick={() => { setNewCust(p => ({ ...p, name: customerSearch })); setShowNewCust(true); }}>+ New: "{customerSearch}"</button>
                  );
                })()}
                {showNewCust && (
                  <div className="jd-new-cust">
                    <input className="jd-input" value={newCust.name} onChange={e => setNewCust(p => ({ ...p, name: e.target.value }))} placeholder="Full name *" />
                    <div className="jd-row"><input className="jd-input" value={newCust.phone} onChange={e => setNewCust(p => ({ ...p, phone: e.target.value }))} placeholder="Phone" /><input className="jd-input" value={newCust.email} onChange={e => setNewCust(p => ({ ...p, email: e.target.value }))} placeholder="Email" /></div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-primary btn-sm" type="button" onClick={async () => {
                        if (!newCust.name.trim()) return;
                        try { const c = await createCustomer(user.id, newCust); setCustomers(p => [...p, c]); ud('customer_id', c.id); setShowNewCust(false); setNewCust({ name: '', email: '', phone: '', address: '' }); setCustomerSearch(''); toast('Contact saved', 'success'); }
                        catch (e) { setError(friendly(e)); }
                      }}>Save</button>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowNewCust(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Scope Summary ── */}
        <div className="rq-scope-card">
          <div className="rq-scope-top">
            <span className="rq-scope-label">Scope summary</span>
            <span className="rq-scope-hint">Shown to customer</span>
          </div>
          <textarea className="rq-scope-input" value={draft.scope_summary} onChange={e => ud('scope_summary', e.target.value)} rows={2} placeholder="Brief description of work (e.g. Replace kitchen faucet, install new supply lines, test for leaks)" />
        </div>

        {/* ── Quote Settings (always visible) — province, tax, deposit ── */}
        <div className="rq-settings-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, padding: '12px 16px', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 'var(--r)', marginBottom: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)', marginBottom: 4 }}>{country === 'US' ? 'State' : 'Province'} (tax rate)</label>
            <select className="input" value={province} onChange={e => setProvince(e.target.value)} style={{ width: '100%', fontSize: 13 }}>
              {(country === 'CA' ? [['AB','Alberta'],['BC','British Columbia'],['MB','Manitoba'],['NB','New Brunswick'],['NL','Newfoundland'],['NS','Nova Scotia'],['NT','NW Territories'],['NU','Nunavut'],['ON','Ontario'],['PE','PEI'],['QC','Quebec'],['SK','Saskatchewan'],['YT','Yukon']] : [['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming']]).map(([code, name]) => <option key={code} value={code}>{code} — {name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)', marginBottom: 4 }}>Deposit</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" checked={draft.deposit_required} onChange={e => ud('deposit_required', e.target.checked)} style={{ accentColor: 'var(--brand)' }} />
                <span>Require deposit</span>
              </label>
              {draft.deposit_required && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input className="rq-deposit-input" type="number" min="0" value={draft.deposit_percent || ''} onChange={e => { const pct = Number(e.target.value) || 0; ud('deposit_percent', pct); ud('deposit_amount', Math.round(Math.max(0, totals.subtotal - (draft.discount || 0)) * pct / 100)); }} style={{ width: 50 }} />
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>% = {currency(Math.round(Math.max(0, totals.subtotal - (draft.discount || 0)) * (draft.deposit_percent || 0) / 100), country)}</span>
                </div>
              )}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)', marginBottom: 4 }}>Country</label>
            <select className="input" value={country} onChange={e => { const c = e.target.value; setCountry(c); setProvince(c === 'US' ? 'CA' : 'AB'); }} style={{ width: '100%', fontSize: 13 }}>
              <option value="CA">Canada</option>
              <option value="US">United States</option>
            </select>
          </div>
        </div>

        {/* ── Assumptions, exclusions, notes ── */}
        <div className="rq-scope-card" style={{ marginBottom: 10 }}>
          {/* Always show assumptions/exclusions when they have content */}
          {(draft.assumptions || draft.exclusions) ? (
            <div className="rq-details-grid">
              <div>
                <label className="rq-detail-label">
                  Assumptions
                  {draft.assumptions && <span style={{ fontSize: 9, color: 'var(--amber)', marginLeft: 6, fontWeight: 600, textTransform: 'none', letterSpacing: 'normal' }}>AI-generated — edit as needed</span>}
                </label>
                <textarea className="rq-detail-input" value={draft.assumptions} onChange={e => ud('assumptions', e.target.value)} rows={3} placeholder="e.g. Standard access, no structural changes" style={{ border: '1px solid var(--line-2)', minHeight: 60 }} />
              </div>
              <div>
                <label className="rq-detail-label">Exclusions</label>
                <textarea className="rq-detail-input" value={draft.exclusions} onChange={e => ud('exclusions', e.target.value)} rows={2} placeholder="e.g. Permit fees, drywall repair" style={{ border: '1px solid var(--line-2)' }} />
              </div>
              <button type="button" className="rq-details-toggle" onClick={() => setShowDetails(!showDetails)}>
                {showDetails ? '▾ Hide internal notes' : '▸ Internal notes'}
              </button>
              {showDetails && (
                <div><label className="rq-detail-label">Internal notes</label><textarea className="rq-detail-input" value={draft.internal_notes} onChange={e => ud('internal_notes', e.target.value)} rows={2} placeholder="Notes for your records only" /></div>
              )}
            </div>
          ) : (
            <>
              <button type="button" className="rq-details-toggle" onClick={() => setShowDetails(!showDetails)}>
                {showDetails ? '▾ Hide details' : '▸ Add assumptions, exclusions & notes'}
              </button>
              {showDetails && (
                <div className="rq-details-grid">
                  <div>
                    <label className="rq-detail-label">Assumptions</label>
                    <textarea className="rq-detail-input" value={draft.assumptions} onChange={e => ud('assumptions', e.target.value)} rows={2} placeholder="e.g. Standard access, no structural changes" />
                  </div>
                  <div>
                    <label className="rq-detail-label">Exclusions</label>
                    <textarea className="rq-detail-input" value={draft.exclusions} onChange={e => ud('exclusions', e.target.value)} rows={2} placeholder="e.g. Permit fees, drywall repair" />
                  </div>
                  <div><label className="rq-detail-label">Internal notes</label><textarea className="rq-detail-input" value={draft.internal_notes} onChange={e => ud('internal_notes', e.target.value)} rows={2} placeholder="Notes for your records only" /></div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Line Items ── */}
        <div className="rq-items-section">
          <div className="rq-items-head"><span className="rq-items-title">{itemCount > 0 ? `${itemCount} item${itemCount !== 1 ? 's' : ''}` : 'Line items'}</span></div>
          {lineItems.map((item, idx) => {
            const itemTotal = Number(item.quantity || 0) * Number(item.unit_price || 0);
            return (
              <div key={item.id} className={`rq-card ${editingItemId === item.id ? 'rq-card-editing' : ''}`}
                draggable onDragStart={e => { e.dataTransfer.setData('text/plain', idx.toString()); e.currentTarget.style.opacity = '0.5'; }}
                onDragEnd={e => { e.currentTarget.style.opacity = '1'; }}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('rq-card-dragover'); }}
                onDragLeave={e => { e.currentTarget.classList.remove('rq-card-dragover'); }}
                onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('rq-card-dragover'); const fromIdx = parseInt(e.dataTransfer.getData('text/plain')); if (isNaN(fromIdx) || fromIdx === idx) return; setLineItems(prev => { const next = [...prev]; const [moved] = next.splice(fromIdx, 1); next.splice(idx, 0, moved); return next; }); markDirty(); }}
              >
                <div className="rq-card-drag-handle" title="Drag to reorder">⠿</div>
                <div className="rq-card-main">
                  <div className="rq-card-top">
                    <input className="rq-card-name" value={item.name} onChange={e => updateItem(item.id, { name: e.target.value })} placeholder="Item name" onFocus={() => setEditingItemId(item.id)} />
                    <span className="rq-card-line-total">{currency(itemTotal, country)}</span>
                  </div>
                  <div className="rq-card-controls">
                    <div className="rq-qty-stepper">
                      <button type="button" className="rq-qty-btn" onClick={() => adjustQty(item.id, -1)}>−</button>
                      <span className="rq-qty-val">{Number(item.quantity).toFixed(item.quantity % 1 === 0 ? 0 : 2)}</span>
                      <button type="button" className="rq-qty-btn" onClick={() => adjustQty(item.id, 1)}>+</button>
                    </div>
                    <span className="rq-card-times">×</span>
                    <div className="rq-price-wrap">
                      <span className="rq-price-prefix">$</span>
                      <input className="rq-card-price-input" type="number" min="0" step="1" value={item.unit_price} onChange={e => updateItem(item.id, { unit_price: Math.max(0, Number(e.target.value) || 0) })} onFocus={() => setEditingItemId(item.id)} />
                    </div>
                    <div className="rq-card-item-actions">
                      <button className="rq-card-action-btn" type="button" onClick={() => duplicateItem(item.id)} title="Duplicate">⧉</button>
                      <button className="rq-card-action-btn rq-card-action-del" type="button" onClick={() => removeItem(item.id)} title="Remove">✕</button>
                    </div>
                  </div>
                  {item.notes ? (
                    <input className="rq-card-notes" value={item.notes} onChange={e => updateItem(item.id, { notes: e.target.value })} placeholder="Note (shown to customer)" />
                  ) : (
                    <button type="button" className="rq-card-add-note" onClick={() => updateItem(item.id, { notes: ' ' })}>+ note</button>
                  )}
                </div>
              </div>
            );
          })}
          {lineItems.length === 0 && (
            <div className="rq-empty"><div className="rq-empty-icon">📋</div><div className="rq-empty-text">No items yet — add from catalog or create custom</div></div>
          )}
        </div>

        {/* ── Unified Add Item Bar ── */}
        <div className="rq-add-bar">
          {!addMode && (
            <div className="rq-add-triggers">
              <button type="button" className="rq-add-trigger rq-add-trigger-primary" onClick={() => setAddMode('catalog')}>🔍 Search catalog</button>
              <button type="button" className="rq-add-trigger" onClick={() => { const id = 'new_' + Date.now(); setLineItems(p => [...p, { id, name: '', quantity: 1, unit_price: 0, notes: '', included: true, category: '' }]); markDirty(); }}>+ Custom item</button>
              <button type="button" className="rq-add-trigger" onClick={() => { if (quoteId) nav(`/app/quotes/build-scope/${quoteId}`); else nav('/app/quotes/new'); }}>✦ AI scope</button>
            </div>
          )}
          {addMode === 'catalog' && (
            <div className="rq-catalog-panel">
              <div className="rq-catalog-top">
                <input className="rq-catalog-input" value={catalogQuery} onChange={e => setCatalogQuery(e.target.value)} placeholder="Search items (e.g. faucet, outlet, drywall)…" autoFocus autoComplete="off" />
                <button type="button" className="rq-catalog-close" onClick={() => { setAddMode(null); setCatalogQuery(''); }}>Done</button>
              </div>
              {catalogResults.length > 0 && (
                <div className="rq-catalog-results">
                  {catalogResults.map((item, i) => {
                    const alreadyAdded = lineItems.some(li => li.name.toLowerCase() === item.name.toLowerCase());
                    return (
                      <div key={`${item.name}-${i}`} className={`rq-catalog-item ${alreadyAdded ? 'added' : ''} ${item.isContextRelevant ? 'rq-catalog-relevant' : ''}`} onClick={() => !alreadyAdded && addCatalogItem(item)}>
                        <div className="rq-catalog-info">
                          <span className="rq-catalog-name">{item.name}</span>
                          {item.isContextRelevant && <span className="rq-catalog-match-tag">matches this job</span>}
                          {item.desc && <span className="rq-catalog-desc">{item.desc}</span>}
                        </div>
                        <div className="rq-catalog-right"><span className="rq-catalog-price">{currency(item.lo)}–{currency(item.hi)}</span><span className="rq-catalog-add">{alreadyAdded ? '✓' : '+'}</span></div>
                      </div>
                    );
                  })}
                </div>
              )}
              {catalogQuery.length >= 2 && catalogResults.length === 0 && <div className="rq-catalog-empty">No matches found</div>}
            </div>
          )}
        </div>

        {/* ── Scope Hints ── */}
        {scopeHints.length > 0 && lineItems.length > 0 && (
          <div className="rq-hints">
            <div className="rq-hints-label">Often included for {trade}</div>
            <div className="rq-hints-chips">
              {scopeHints.slice(0, 5).map(hint => (
                <button key={hint} type="button" className="rq-hint-chip" onClick={() => { setLineItems(p => [...p, { id: makeId(), name: hint, quantity: 1, unit_price: 0, notes: '', included: true, category: '' }]); markDirty(); toast(`Added: ${hint} — set a price`, 'success'); }}>+ {hint}</button>
              ))}
            </div>
          </div>
        )}

        {/* ── Pricing Summary ── */}
        <div className="rq-totals-card">
          <div className="rq-total-row"><span>Subtotal</span><span>{currency(totals.subtotal, country)}</span></div>
          <div className="rq-total-row rq-discount-row"><span>Discount</span><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ color: 'var(--muted)', fontSize: 12 }}>−$</span><input className="rq-discount-input" type="number" min="0" value={draft.discount || ''} onChange={e => ud('discount', Number(e.target.value) || 0)} placeholder="0" /></div></div>
          <div className="rq-total-row"><span>Tax ({province})</span><span>{currency(Math.max(0, totals.subtotal - (draft.discount || 0)) * totals.rate, country)}</span></div>
          <div className="rq-total-row rq-grand"><span>Total</span><span>{currency(grandTotal, country)}</span></div>
        </div>

        {/* ── Inline Confidence ── */}
        {lineItems.length > 0 && confidence && (
          <div className={`rq-confidence rq-conf-${confidence.readiness}`}>
            <div className="rq-conf-top"><span className="rq-conf-badge">{confidence.score}%</span><span className="rq-conf-label">{confidence.readiness === 'ready' ? 'Ready to send' : confidence.readiness === 'review' ? 'Review suggested' : 'Needs attention'}</span></div>
            <div className="rq-conf-checks">{(confidence.checks || []).map((c, i) => <span key={i} className={`rq-conf-check ${c.state}`}>{c.state === 'good' ? '✓' : '⚠'} {c.label}</span>)}</div>
          </div>
        )}

        {error && <div className="jd-error">{error}</div>}

        </div>{/* end isLocked read-only wrapper */}

        {/* ── Sent Success ── */}
        {sentSuccess && (() => {
          const isFirst = !localStorage.getItem('pl_has_sent_quote');
          // Mark that user has sent at least one quote
          try { localStorage.setItem('pl_has_sent_quote', '1'); } catch {}
          const custName = selCustomer?.name || 'Your customer';
          const firstName = custName.split(' ')[0];
          return (
            <div className="rq-sent-banner" style={isFirst ? { background: 'var(--green-bg)', borderColor: 'var(--green-line)' } : undefined}>
              {isFirst ? (
                <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
                  <div style={{ fontSize: 36, marginBottom: 6 }}>🎉</div>
                  <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--text)', letterSpacing: '-.03em', lineHeight: 1.2 }}>
                    Quote sent — worth {currency(grandTotal, country)}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginTop: 8, maxWidth: 340, margin: '8px auto 0' }}>
                    {firstName} can review, approve, and sign — right from their phone. You'll get notified the moment they open it.
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(19,138,91,.08)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 2s ease-in-out infinite' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)' }}>Waiting for {firstName} to view</span>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '6px 0 2px' }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--green)', marginBottom: 2 }}>✓ Quote sent to {firstName}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{currency(grandTotal, country)} — they'll get a link to review and sign.</div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: isFirst ? 14 : 8 }}>
                <button className="btn btn-primary btn-sm" type="button" onClick={() => nav('/app/quotes/new')}>+ New quote</button>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => nav('/app')}>Dashboard</button>
                {!companyName && <button className="btn btn-secondary btn-sm" type="button" onClick={() => nav('/app/settings')}>Add business name →</button>}
              </div>
            </div>
          );
        })()}

        {/* ── Sticky Footer ── */}
        <div className="rq-footer" data-testid="rq-footer">
          <div className="rq-footer-left">
            <button className="btn btn-secondary" type="button" data-testid="rq-save-btn" disabled={saving || isLocked} style={isLocked ? { opacity: 0.5, cursor: 'not-allowed' } : undefined} onClick={() => save()}>{saveState === 'saved' ? '✓ Saved' : 'Save'}</button>
            <button className="btn btn-secondary btn-sm rq-preview-btn" type="button" data-testid="rq-preview-btn" disabled={saving || isLocked} style={isLocked ? { opacity: 0.5, cursor: 'not-allowed' } : undefined} onClick={async () => {
              // Try to save first so the preview reflects latest edits
              const q = await save(null, true);
              const token = q?.share_token;
              if (token) {
                window.open('/public/' + token + '?preview=1', '_blank');
                return;
              }
              // Save failed — fallback: fetch existing share_token directly
              // This handles the case where save fails due to schema drift (_badCols)
              // but the quote already exists with a valid share_token
              if (quoteId) {
                try {
                  const existing = await getQuote(quoteId);
                  if (existing?.share_token) {
                    window.open('/public/' + existing.share_token + '?preview=1', '_blank');
                    return;
                  }
                } catch (fetchErr) {
                  console.error('[Punchlist] Preview fallback fetch failed:', fetchErr.message);
                }
              }
              toast('Could not generate preview — try saving first', 'error');
            }}>Preview</button>
          </div>
          <div className="rq-footer-right">
            <div className="rq-footer-total" data-testid="rq-total">{currency(grandTotal, country)}</div>
            {!draft.customer_id ? (
              <button className="btn btn-primary btn-lg" type="button" data-testid="rq-send-btn" disabled={sending || isLocked} style={isLocked ? { opacity: 0.5, cursor: 'not-allowed' } : undefined} onClick={() => { setDeliveryMethod('copy'); handleSend(); }}>
                Copy Quote Link →
              </button>
            ) : (
              <button className="btn btn-primary btn-lg" type="button" data-testid="rq-send-btn" disabled={sending || isLocked} style={isLocked ? { opacity: 0.5, cursor: 'not-allowed' } : undefined} onClick={handleSend}>
                {quoteId ? 'Save & Send →' : 'Send Quote →'}
              </button>
            )}
          </div>
        </div>

        {/* ── Send Modal ── */}
        {showSend && (
          <div className="qb-modal-bg" onClick={() => setShowSend(false)}>
            <div className="qb-modal" onClick={e => e.stopPropagation()}>
              <div className="qb-modal-top"><h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Send Quote</h3><button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowSend(false)}>✕</button></div>
              <div className="rq-send-body">
                {selCustomer && <div className="rq-send-to"><span className="rq-send-label">To</span><span className="rq-send-value">{selCustomer.name}{selCustomer.email ? ` · ${selCustomer.email}` : ''}{selCustomer.phone ? ` · ${selCustomer.phone}` : ''}</span></div>}
                <div className="rq-send-preview">
                  {lineItems.filter(i => i.name?.trim()).slice(0, 3).map(i => <div key={i.id} className="rq-send-item"><span>{i.name}</span><span>{currency(Number(i.quantity || 0) * Number(i.unit_price || 0))}</span></div>)}
                  {lineItems.length > 3 && <div className="rq-send-more">+{lineItems.length - 3} more</div>}
                  <div className="rq-send-total"><span>Total</span><span>{currency(grandTotal, country)}</span></div>
                </div>
                {/* Delivery method — moved above preview for faster interaction */}
                <div style={{ marginTop: 10 }}><label className="jd-label">Send via</label><div className="rq-send-methods">{[{ v: 'email', l: 'Email', icon: '✉' }, { v: 'text', l: 'Text', icon: '💬' }, { v: 'copy', l: 'Copy link', icon: '🔗' }].map(o => <button key={o.v} type="button" className={`rq-send-method ${deliveryMethod === o.v ? 'active' : ''}`} onClick={() => setDeliveryMethod(o.v)}><span className="rq-method-icon">{o.icon}</span> {o.l}</button>)}</div></div>
                {/* Message preview — collapsible to reduce noise */}
                <details style={{ marginTop: 8 }}>
                  <summary style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', cursor: 'pointer', padding: '4px 0' }}>Preview message</summary>
                  <div style={{ background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: '10px 12px', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginTop: 4 }}>
                    {deliveryMethod === 'email' ? (
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Subject: Quote: {draft.title || 'Your quote'} — {companyName || 'Your contractor'}</div>
                        <div>Hi{selCustomer?.name ? ' ' + selCustomer.name.split(' ')[0] : ''},<br/><br/>I've put together a quote for the work we discussed.{draft.scope_summary ? <><br/>Scope: {draft.scope_summary}</> : null}<br/>Total: {currency(grandTotal, country)}<br/><br/>Review and approve here: [quote link]<br/><br/>{companyName || 'Your contractor'}{userProfile?.phone ? <><br/>{userProfile.phone}</> : null}</div>
                      </div>
                    ) : deliveryMethod === 'text' ? (
                      <div>Hi{selCustomer?.name ? ' ' + selCustomer.name.split(' ')[0] : ''}, your quote from {companyName || 'your contractor'} is ready:<br/><br/>{draft.title || 'Quote'} — {currency(grandTotal, country)}<br/><br/>[quote link]</div>
                    ) : (
                      <div>A shareable link will be copied to your clipboard.</div>
                    )}
                  </div>
                </details>
              </div>
              <div className="qb-modal-acts"><button className="btn btn-primary btn-lg" type="button" disabled={sending} onClick={confirmSend} style={{ flex: 1 }}>{sending ? 'Sending…' : deliveryMethod === 'email' ? 'Open in Email →' : deliveryMethod === 'text' ? 'Open in Messages →' : 'Copy Quote Link'}</button></div>
            </div>
          </div>
        )}
      </div>
      <ConfirmModal
        open={zeroItemConfirm !== null}
        onConfirm={proceedToSend}
        onCancel={() => setZeroItemConfirm(null)}
        title="Items with $0 pricing"
        message={`${zeroItemConfirm || 0} item${(zeroItemConfirm || 0) > 1 ? 's have' : ' has'} $0 pricing. Send anyway?`}
        confirmLabel="Send Anyway"
        cancelLabel="Cancel"
      />
    </AppShell>
  );
}
