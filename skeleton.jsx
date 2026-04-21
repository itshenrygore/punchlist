import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/app-shell';
import ConfirmModal from '../components/confirm-modal';
import UpgradePrompt from '../components/upgrade-prompt';
import QbCoachmarks from '../components/qb-coachmarks';
import { useCustomers, searchCustomers, invalidateCustomers } from '../hooks/use-customers';
import { requestAiScope, getWonQuoteContext, getProfile, getQuote, updateQuote, createQuote, createCustomer, updateCustomer, listQuotes, uploadQuotePhoto, getQuotingDefaults, findCustomerByContact, sendQuoteEmail } from '../lib/api';
import { useAuth } from '../hooks/use-auth';
import { supabase } from '../lib/supabase';
import { useUnsavedChanges } from '../hooks/use-unsaved-changes';
import { useToast } from '../components/toast';
import { currency, friendly } from '../lib/format';
import { calculateTotals, buildConfidence } from '../lib/pricing';
import { makeId } from '../lib/utils';
import { TRADES, regionalize, normalizeTrade, anchorPrice } from '../../shared/tradeBrain';
import { browseCatalog, searchCatalog } from '../../shared/systemCatalog';
import { getSmartSuggestions, smartSearch } from '../../shared/smartCatalog';
import { extractJobContext } from '../../shared/jobContext';
import { detectJob, runScopeCheck } from '../../shared/checkScope';
import { isPro, countSentThisMonth, canSendQuote } from '../lib/billing';
import { isQuoteLocked } from '../lib/workflow';
import { saveOfflineDraft, getOfflineDraft, deleteOfflineDraft, isNetworkError } from '../lib/offline';
import { smsNotify } from '../lib/sms';
import useScrollLock from '../hooks/use-scroll-lock';
import { CA_PROVINCES, US_STATES } from '../lib/pricing';
import { ChevronRight, X } from 'lucide-react';
import { estimateMonthly, showFinancing } from '../lib/financing';
import { identify, trackFirstDescribe, trackFirstBuild, trackFirstSend, trackQuoteSent, trackPushEnabled, getVariant, trackQuoteFlowStarted, setQuoteFlowQuoteId, trackQuoteFlowCustomerSelected, trackQuoteFlowDescriptionCommitted, trackQuoteFlowScopeReady, trackQuoteFlowSent, trackQuoteFlowAbandoned, endQuoteFlowSession, hasActiveFlowSession, restoreFlowSession } from '../lib/analytics';
import { Card, Section, Stat, SmsComposerField } from '../components/ui';
import { DUR, isReducedMotion } from '../lib/motion';
import { listTemplates, renderTemplate, getSystemDefaults } from '../lib/api/templates';

/* ═══════════════════════════════════════════════════════════
   QuoteBuilderPage — Unified one-page quote creation.
   Merges JobDetails + BuildScope + ReviewQuote into one flow.
   Phase: describe → building → review → sending → sent
   ═══════════════════════════════════════════════════════════ */

// ── Smart title generator (from job-details-page) ──
function generateTitle(desc) {
  if (!desc?.trim()) return '';
  const text = desc.trim();
  const patterns = [
    [/^replace\s+(?:the\s+|a\s+|an\s+|old\s+|existing\s+|my\s+)?(.+?)(?:\.|,|\band\b|\bfor\b|\bcustomer\b|\bin\b|\bwith\b|$)/i, 1, 'Replacement'],
    [/^install\s+(?:a\s+|an\s+|new\s+)?(.+?)(?:\.|,|\band\b|\bfor\b|\bcustomer\b|\bin\b|$)/i, 1, 'Installation'],
    [/^repair\s+(?:the\s+|a\s+|an\s+|my\s+)?(.+?)(?:\.|,|\band\b|\bfor\b|\bcustomer\b|$)/i, 1, 'Repair'],
    [/^fix\s+(?:the\s+|a\s+|an\s+|my\s+)?(.+?)(?:\.|,|\band\b|\bfor\b|$)/i, 1, 'Repair'],
    [/^add\s+(?:a\s+|an\s+|new\s+)?(.+?)(?:\.|,|\band\b|\bfor\b|\bin\b|$)/i, 1, 'Installation'],
    [/^remove\s+(?:the\s+|a\s+|an\s+|old\s+)?(.+?)(?:\.|,|\band\b|\bfor\b|$)/i, 1, 'Removal'],
  ];
  for (const [re, idx, suffix] of patterns) {
    const m = text.match(re);
    if (m) { const o = _cleanObj(m[idx]); if (o) return _tc(`${o} ${suffix}`); }
  }
  const upgradeMatch = text.match(/^upgrade\s+(?:the\s+|a\s+)?(.+?)\s+to\s+(.+?)(?:\.|,|\band\b|\bfor\b|$)/i);
  if (upgradeMatch) { const t = _cleanObj(upgradeMatch[2]); if (t) return _tc(`${t} Upgrade`); }
  const brokenMatch = text.match(/^(.+?)\s+(?:not\s+working|is\s+broken|is\s+leaking|won't\s+|doesn't\s+)/i);
  if (brokenMatch) { const o = _cleanObj(brokenMatch[1]); if (o) return _tc(`${o} Diagnostic & Repair`); }
  const nounActionMatch = text.match(/^(.+?)\s+(upgrade|install(?:ation)?|replacement|repair|removal|service|maintenance)\s*(?:for\b|$)/i);
  if (nounActionMatch) { const s = _cleanObj(nounActionMatch[1]); const a = nounActionMatch[2].charAt(0).toUpperCase() + nounActionMatch[2].slice(1).toLowerCase(); if (s) return _tc(`${s} ${a}`); }
  const fc = text.split(/[.!?\n,]/)[0]?.trim();
  if (fc && fc.length <= 50) return _tc(fc);
  return _tc(text.split(/\s+/).slice(0, 5).join(' '));
}
function _cleanObj(s) { if (!s) return ''; return s.replace(/\b(the|a|an|my|our|their|its|some)\b/gi, '').replace(/\b(customer|client|homeowner|owner)\b.*/gi, '').replace(/\b(wants?|needs?|has|have|had|with|from)\b.*/gi, '').replace(/\s{2,}/g, ' ').trim().slice(0, 40); }
function _tc(s) { if (!s) return ''; const sm = new Set(['a','an','the','and','or','but','in','on','at','to','for','of','with','by']); return s.split(' ').filter(Boolean).map((w, i) => { if (/^[A-Z]{2,5}$/.test(w)) return w; const lw = w.toLowerCase(); return i === 0 || !sm.has(lw) ? lw.charAt(0).toUpperCase() + lw.slice(1) : lw; }).join(' '); }

// ── Item classification (from build-scope-page) ──
const LABOUR_KW = ['labour','labor','install','replace','remove','repair','upgrade','finish','maintenance','swap','hook','connect','disconnect','mount','demolish','frame','drywall','patch','diagnostic','service call','setup','startup','commission','calibrat','test','inspect'];
const MATERIAL_KW = ['material','supply','supplies','part','parts','fitting','fittings','allowance','hose','connector','adapter','valve','ring','bolt','wire','cable','pipe','duct','filter','sealant','caulk','primer','paint','shingle','lumber','screw','nail','bracket','flashing','wax ring','tape','panel','breaker','conduit','switch','outlet','fixture','fan','light','thermostat','pump','tank','heater','coil','compressor','lineset','meter','fastener','hardware','equipment','unit','device'];
const SERVICE_KW = ['permit','inspection','disposal','cleanup','haul','delivery','coordination','scheduling','warranty','protection','certification','compliance','removal','commissioning','testing','patching','grounding','bonding'];
function classifyItem(name, category) {
  const cat = (category || '').toLowerCase();
  if (cat === 'labour' || cat === 'labor') return 'labour';
  if (cat === 'materials' || cat === 'material') return 'materials';
  if (['services','service','permit','disposal'].includes(cat)) return 'services';
  const text = `${name || ''} ${category || ''}`.toLowerCase();
  if (SERVICE_KW.some(w => text.includes(w))) return 'services';
  if (MATERIAL_KW.some(w => text.includes(w))) return 'materials';
  if (LABOUR_KW.some(w => text.includes(w))) return 'labour';
  if (/^(install|replace|remove|repair|upgrade|connect|mount|build|frame|patch|prep)/i.test(name || '')) return 'labour';
  return 'services';
}
function normSuggestion(raw, i) {
  const lo = Number(raw.lo || raw.typical_range_low || 0), hi = Number(raw.hi || raw.typical_range_high || 0);
  const mid = Number(raw.unit_price || raw.mid || Math.round((lo + hi) / 2) || 0);
  const name = raw.description || raw.name || 'Item';
  const cat = raw.category || '';
  const confidence = (raw.include_confidence || 'high').toLowerCase();
  const tier = (raw.tier || 'standard').toLowerCase();
  return { id: `sug_${i}_${Date.now()}`, name, category: cat, tab: classifyItem(name, cat), unit_price: mid, quantity: Math.max(1, Number(raw.quantity || 1)), typical_low: lo, typical_high: hi, why: raw.why || raw.reason || '', when_needed: raw.when || '', when_not_needed: raw.skip || '', notes: raw.pricing_basis || '', confidence, tier, source: raw.source_label || 'Based on similar jobs', selected: tier === 'optional' ? false : confidence !== 'low' };
}

// ── Smart catalog fallback (from build-scope-page) ──
function smartCatalogFallback(ctx, province) {
  const result = getSmartSuggestions({ description: ctx.description || '', title: ctx.title || '', trade: ctx.trade || 'Other', province: province || 'AB' });
  const hasDispatch = [...result.core, ...result.related].some(i => /dispatch|diagnostic|service call/i.test(i.name));
  if (!hasDispatch && result.core.length > 0) {
    const dp = { Plumber: { lo: 90, hi: 120, mid: 105 }, Electrician: { lo: 90, hi: 110, mid: 100 }, HVAC: { lo: 120, hi: 150, mid: 135 }, 'General Contractor': { lo: 60, hi: 80, mid: 70 } };
    const d = dp[ctx.trade] || { lo: 90, hi: 130, mid: 110 };
    result.related.unshift({ id: `disp_${Date.now()}`, name: 'Dispatch / diagnostic', desc: 'Service call, travel, initial assessment', category: 'Services', lo: d.lo, hi: d.hi, mid: d.mid, score: 999, tier: 'related', reason: 'Standard on every job', why: 'Covers travel, site assessment, and initial diagnosis', pricing_basis: 'Market rate from contractor data' });
  }
  return result;
}

// ── Scope hints per trade ──
const SCOPE_HINTS = { Plumber: ['Disposal fees', 'Shut-off valve replacement', 'Permit', 'Patch/repair after access', 'Cleanup'], Electrician: ['Permit & inspection', 'Panel labelling', 'Patching/repair', 'Disposal', 'GFCI/AFCI upgrades'], HVAC: ['Duct modification', 'Electrical hookup', 'Permit', 'Refrigerant handling', 'Thermostat wiring'], General: ['Disposal', 'Cleanup', 'Permit', 'Material delivery', 'Touch-up / patching'], Carpenter: ['Hardware/fasteners', 'Finishing/stain', 'Disposal', 'Touch-up paint', 'Delivery'], Painter: ['Surface prep', 'Primer coat', 'Caulking', 'Furniture moving', 'Drop cloths/protection'], Roofing: ['Permit', 'Disposal/dump fees', 'Flashing', 'Ice & water shield', 'Ventilation'] };

// ── Placeholders ──
const DESC_PLACEHOLDERS = { Plumber: 'Replace 50-gallon hot water tank in utility room. Drain, disconnect, and haul away old tank.', Electrician: 'Upgrade 100A panel to 200A service and reconnect existing circuits.', HVAC: 'Replace furnace with high-efficiency unit. Install new smart thermostat.', 'General Contractor': 'Frame basement mechanical room and patch surrounding drywall.', Roofing: 'Replace damaged shingles around vent stack and inspect flashing.', Painter: 'Prep and paint main floor walls. Patch minor nail holes, sand, prime.', Carpenter: 'Install baseboard and door casing trim throughout main floor.', Other: 'Replace 50-gallon hot water tank in tight utility room.' };

/* ══════════════════════════════════════════════════════════ */
export default function QuoteBuilderPage() {
  const { user } = useAuth();
  const { quoteId: existingQuoteId } = useParams();
  const location = useLocation();
  const nav = useNavigate();
  const { show: toast, showUndo } = useToast();
  const fileRef = useRef(null);

  // ── Phase state: describe | building | review | sending | sent ──
  const [phase, setPhase] = useState(existingQuoteId ? 'review' : 'describe');
  const [quoteId, setQuoteId] = useState(existingQuoteId || null);

  // ── Zone 1: Job Description ──
  const [description, setDescription] = useState(location.state?.prefill || '');
  const [title, setTitle] = useState('');
  const [trade, setTrade] = useState('Other');
  const [province, setProvince] = useState('AB');
  const [country, setCountry] = useState('CA');
  const [photo, setPhoto] = useState(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const recTimeoutRef = useRef(null);
  const finalRef = useRef(''); // Slice 10: accumulate SR transcript without closure-mutation bug
  const titleSuggested = useRef(false);
  // Slice 10: check SR availability once — hide mic button instead of showing error
  const SR_AVAILABLE = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  // ── Zone 2: AI Scope ──
  const [suggestions, setSuggestions] = useState([]);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [scopeLoadingMsg, setScopeLoadingMsg] = useState('');
  const [scopeError, setScopeError] = useState(false);
  const [photoSaved, setPhotoSaved] = useState(false);
  const [expandedSugId, setExpandedSugId] = useState(null);
  const [scopeGaps, setScopeGaps] = useState([]);
  const [scopeMeta, setScopeMeta] = useState({ scope_summary: '', assumptions: '', exclusions: '' });

  // ── Zone 3: Quote Details ──
  const [lineItems, setLineItems] = useState([]);
  const [draft, setDraft] = useState({ title: '', description: '', scope_summary: '', assumptions: '', exclusions: '', customer_id: '', status: 'draft', expiry_days: 14, deposit_required: false, deposit_percent: 20, deposit_amount: 0, deposit_status: 'not_required', internal_notes: '', revision_summary: '', discount: 0 });
  // Slice 11: use the shared useCustomers hook for cache + fuzzy search
  const { customers, loading: customersLoading } = useCustomers(user?.id);
  // Local customers state is still kept for optimistic additions (quick-create path)
  const [localCustomers, setLocalCustomers] = useState([]);
  // Merge hook customers with any optimistic local additions
  const allCustomers = useMemo(() => {
    if (!localCustomers.length) return customers;
    const ids = new Set(customers.map(c => c.id));
    return [...customers, ...localCustomers.filter(c => !ids.has(c.id))];
  }, [customers, localCustomers]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showNewCust, setShowNewCust] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', email: '', phone: '', address: '' });
  const [addMode, setAddMode] = useState(null);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogResults, setCatalogResults] = useState([]);
  const catalogDebounceRef = useRef(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [inlinePhone, setInlinePhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  // Phase 1: exit animation tracking for line items & suggestions.
  // Uses Sets so we don't re-render the whole list on each mutation.
  const [leavingItemIds, setLeavingItemIds] = useState(() => new Set());
  const [dismissedSugIds, setDismissedSugIds] = useState(() => new Set());

  // ── Zone 4: Send ──
  const [deliveryMethod, setDeliveryMethod] = useState('text');
  const [smsBody, setSmsBody] = useState('');
  // v100 M3: user's initial_sms template; fetched at mount, used in proceedToSend
  const [initialSmsTemplate, setInitialSmsTemplate] = useState(null);
  const [showSend, setShowSend] = useState(false);
  // C3: after native SMS app opens, show confirm card. Declared before useScrollLock to avoid TDZ in prod builds.
  const [smsConfirmPending, setSmsConfirmPending] = useState(null); // null | { url, phone, body }
  useScrollLock(showSend);
  useScrollLock(!!smsConfirmPending);
  useScrollLock(addMode === 'catalog');
  const [sentSuccess, setSentSuccess] = useState(false);
  // Ref to the undo-cancel fn returned by showUndo (used to imperatively cancel on unmount)
  const undoCancelRef = useRef(null);

  // ── Shared state ──
  const [saving, setSaving] = useState(false);
  // savingRef mirrors the `saving` state so the autosave effect can read it
  // without listing it as a dependency — prevents the saving→effect→saving
  // feedback loop that causes React error #62 (max update depth exceeded).
  const savingRef = useRef(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState('');
  // §6.1 — Autosave timestamp: updated each time a save completes successfully.
  const [lastSavedAt, setLastSavedAt] = useState(null);
  // §6.1 — Undo last item add: snapshot of line items before AI scope populates,
  // so the contractor can revert the entire AI-added set in 5 seconds.
  const preAiLineItemsRef = useRef(null);
  const [userProfile, setUserProfile] = useState(null);
  const [sentThisMonth, setSentThisMonth] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [zeroItemConfirm, setZeroItemConfirm] = useState(null);
  const [offlineDraft, setOfflineDraft] = useState(false);

  const dirty = useRef(false);
  const [isDirty, setIsDirty] = useState(false);
  const saveMutex = useRef(null);
  const initialLoadComplete = useRef(false);
  function markDirty() { dirty.current = true; setIsDirty(true); }
  function clearDirty() { dirty.current = false; setIsDirty(false); }
  function ud(k, v) { markDirty(); setDraft(d => ({ ...d, [k]: v })); }
  useUnsavedChanges(isDirty && (lineItems.length > 0 || phase === 'building'));

  // ── B13: per-session telemetry guards ──
  // descCommittedRef: fires quote_flow_description_committed at most once per session.
  const descCommittedRef = useRef(false);
  // sentRef: tracks whether this session completed a send (suppresses abandoned event).
  const sentRef = useRef(false);
  // deliveryMethodRef: mirror of deliveryMethod state accessible inside pagehide listener.
  const deliveryMethodRef = useRef('text');

  // ── UX-023: describe-textarea auto-grow ──
  const descTextareaRef = useRef(null);
  const growDesc = useCallback(() => {
    const el = descTextareaRef.current;
    if (!el) return;
    // Collapse first so shrinking works correctly
    el.style.height = 'auto';
    const maxH = Math.round(
      (typeof window !== 'undefined' ? window.innerHeight : 800) / 2
    );
    el.style.height = `${Math.min(el.scrollHeight, maxH)}px`;
  }, []);

  useEffect(() => { growDesc(); }, [description, growDesc]);

  // ── B12: Keyboard shortcut help overlay toggle ──
  const [showKbdHelp, setShowKbdHelp] = useState(false);

  // ── Slice 10 B5 / §2.3: AI pre-warm ref ──
  const aiPreWarmRef = useRef({ promise: null, controller: null, forDescription: '' });

  // ── Auto-generate title from description ──
  const titleDebounceRef = useRef(null);
  const lastAutoTitle = useRef('');
  useEffect(() => {
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    if (description.trim().length >= 10) {
      const shouldUpdate = !title.trim() || (!titleSuggested.current) || (lastAutoTitle.current && title === lastAutoTitle.current);
      if (shouldUpdate) {
        titleDebounceRef.current = setTimeout(() => {
          const g = generateTitle(description, trade);
          if (g && g.length > 2) { setTitle(g); lastAutoTitle.current = g; titleSuggested.current = true; }
        }, 800);
      }
    }
    return () => { if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current); };
  }, [description]);

  // ── Load profile + customers + existing quote ──
  useEffect(() => {
    if (!user) return;
    const profileP = getProfile(user.id);
    // Smart defaults: mode of last 5 non-draft quotes. Phase 3.5 backend slice.
    // Resolves to null for users with no history, in which case existing
    // profile/hardcoded fallbacks are used unchanged.
    const defaultsP = getQuotingDefaults(user.id).catch(() => null);
    profileP.then(p => {
      setUserProfile(p);
      if (p?.province) setProvince(p.province);
      if (p?.country) setCountry(p.country);
      if (p?.trade) setTrade(p.trade);
      if (p?.company_name) setCompanyName(p.company_name);
      if (!isPro(p)) listQuotes(user.id).then(q => setSentThisMonth(countSentThisMonth(q || []))).catch(e => console.warn('[PL]', e));
    }).catch(e => console.warn('[PL]', e));

    // v100 M3: fetch the user's initial_sms template so proceedToSend() doesn't hardcode.
    // Soft failure — falls back to system default if fetch errors or is offline.
    listTemplates(user.id).then(rows => {
      const row = rows.find(r => r.template_key === 'initial_sms');
      setInitialSmsTemplate(row?.body || null);
    }).catch(() => {
      setInitialSmsTemplate(null); // triggers fallback in proceedToSend
    });

    // New-quote path: layer smart defaults onto the initial inline draft state.
    // Precedence: smart-defaults > profile.default_* > hardcoded (already in initial state).
    // Only applied when the user hasn't started editing yet — dirty.current is the gate.
    // No-op when defaults is null (fresh user).
    if (!existingQuoteId) {
      Promise.all([profileP.catch(() => null), defaultsP]).then(([p, defaults]) => {
        if (dirty.current) return; // user already started editing — don't clobber
        setDraft(d => {
          const next = { ...d };
          // Layer profile first (lower precedence)
          if (p?.default_expiry_days) next.expiry_days = Number(p.default_expiry_days);
          if (p?.default_deposit_mode && p.default_deposit_mode !== 'none') {
            next.deposit_required = true;
            if (p.default_deposit_mode === 'percent') next.deposit_percent = Number(p.default_deposit_value || 20);
            else next.deposit_amount = Number(p.default_deposit_value || 0);
          }
          // Then smart defaults on top (higher precedence) when present
          if (defaults) {
            next.expiry_days = defaults.expiryDays;
            next.deposit_required = defaults.depositRequired;
            if (defaults.depositRequired) next.deposit_percent = defaults.depositPercent;
          }
          return next;
        });
      });
    }

    // Edit mode: load existing quote and skip to review
    if (existingQuoteId) {
      Promise.all([getQuote(existingQuoteId), profileP.catch(() => null), defaultsP]).then(([q, p, defaults]) => {
        if (isQuoteLocked(q)) { toast('This quote is locked', 'error'); nav(`/app/quotes/${existingQuoteId}`, { replace: true }); return; }
        setTitle(q.title || '');
        setDescription(q.description || '');
        if (q.trade) setTrade(q.trade);
        if (q.province) setProvince(q.province);
        if (q.country) setCountry(q.country);
        titleSuggested.current = true;
        const draftData = { title: q.title || '', description: q.description || '', scope_summary: q.scope_summary || '', assumptions: q.assumptions || '', exclusions: q.exclusions || '', customer_id: q.customer_id || '', status: q.status || 'draft', expiry_days: q.expiry_days || 14, deposit_required: q.deposit_required || false, deposit_percent: Number(q.deposit_percent || 20), deposit_amount: Number(q.deposit_amount || 0), deposit_status: q.deposit_status || 'not_required', internal_notes: q.internal_notes || '', revision_summary: q.revision_summary || '', discount: Number(q.discount || 0) };
        if (q.status === 'draft' && !q.deposit_required && !q.internal_notes) {
          // Untouched-draft layering. Profile first, then smart defaults override.
          if (p?.default_expiry_days) draftData.expiry_days = Number(p.default_expiry_days);
          if (p?.default_deposit_mode && p.default_deposit_mode !== 'none') { draftData.deposit_required = true; if (p.default_deposit_mode === 'percent') draftData.deposit_percent = Number(p.default_deposit_value || 20); else draftData.deposit_amount = Number(p.default_deposit_value || 0); }
          if (defaults) {
            draftData.expiry_days = defaults.expiryDays;
            draftData.deposit_required = defaults.depositRequired;
            if (defaults.depositRequired) draftData.deposit_percent = defaults.depositPercent;
          }
        }
        setDraft(draftData);
        if (draftData.assumptions?.trim()) setShowDetails(true);
        setLineItems((q.line_items || []).map(i => ({ id: i.id || makeId(), name: i.name, quantity: Number(i.quantity || 1), unit_price: Number(i.unit_price || 0), notes: i.notes || '', included: i.included !== false, category: i.category || '' })));
        initialLoadComplete.current = true;
        setPhase('review');
        // Offline draft restore
        getOfflineDraft(existingQuoteId).then(od => {
          if (!od) return;
          if (new Date(od.savedAt || 0).getTime() > new Date(q.updated_at || 0).getTime()) {
            if (od.title !== undefined) setDraft(d => ({ ...d, ...od }));
            if (Array.isArray(od.line_items)) setLineItems(od.line_items.map(i => ({ id: i.id || makeId(), name: i.name, quantity: Number(i.quantity || 1), unit_price: Number(i.unit_price || 0), notes: i.notes || '', included: i.included !== false, category: i.category || '' })));
            setOfflineDraft(true); toast('Restored offline draft', 'info');
          }
        }).catch(e => console.warn('[PL]', e));
      }).catch(e => { setError(friendly(e)); });
    }

    // B13: Ensure a flow session exists for this builder mount.
    // Normally the session is started by the dashboard click (trackQuoteFlowStarted).
    // If the user reached the builder directly (deep-link, bookmark, back-nav) we
    // start a fallback session here so events don't silently drop.
    if (!existingQuoteId) {
      // New quote: if dashboard didn't already start a session, start one now.
      if (!hasActiveFlowSession()) {
        trackQuoteFlowStarted({ source: 'builder_direct' });
      }
    } else {
      // Editing an existing quote: try to restore a previously-started session
      // from sessionStorage. If none exists (e.g. user bookmarked an edit URL),
      // start a fresh session scoped to this quote.
      const restored = restoreFlowSession(existingQuoteId);
      if (!restored) {
        trackQuoteFlowStarted({ quoteId: existingQuoteId, source: 'builder_direct' });
      }
    }

    // Demo carry-through from landing page
    if (!existingQuoteId) {
      try { const d = JSON.parse(sessionStorage.getItem('pl_demo_quote') || 'null'); if (d?.description) { setDescription(d.description); if (d.trade) setTrade(d.trade); sessionStorage.removeItem('pl_demo_quote'); } } catch (e) { console.warn("[PL]", e); }
      const demoDesc = new URLSearchParams(location.search).get('demo');
      const demoTrade = new URLSearchParams(location.search).get('trade');
      if (demoDesc) setDescription(demoDesc);
      if (demoTrade) setTrade(demoTrade);
      // First-time: pre-fill with sample job so user can tap "Build Quote" immediately
      if (!demoDesc && !location.state?.prefill) {
        try {
          if (!localStorage.getItem('pl_has_built_quote')) {
            profileP.then(p => {
              const t = p?.trade || 'Other';
              const sample = DESC_PLACEHOLDERS[t] || DESC_PLACEHOLDERS.Other;
              setDescription(prev => prev || sample);
            }).catch(e => console.warn('[PL]', e));
          }
        } catch (e) { console.warn("[PL]", e); }
      }
    }
  }, [user, existingQuoteId]);

  // ── Zone 1: Build scope (create draft + run AI) ──
  async function handleBuildScope() {
    if (!description.trim()) { setError('Describe the job first'); return; }
    setError('');
    setPhase('building');
    try { localStorage.setItem('pl_has_built_quote', '1'); } catch (e) { console.warn("[PL]", e); }
    trackFirstBuild();
    setScopeLoading(true);
    setScopeLoadingMsg('Analyzing job scope…');
    const t1 = setTimeout(() => setScopeLoadingMsg('Still working — analyzing materials and pricing…'), 6000);
    const t2 = setTimeout(() => setScopeLoadingMsg('Almost there — finalizing suggestions…'), 12000);

    try {
      // Create or update draft
      let draftId = quoteId;
      if (!draftId) {
        const d = await createQuote(user.id, { title: title || description.slice(0, 64), description, trade, province, country, customer_id: draft.customer_id || null, status: 'draft', line_items: [] });
        draftId = d.id;
        setQuoteId(draftId);
        setQuoteFlowQuoteId(draftId); // B13: associate the new DB id with the session
        nav(`/app/quotes/${draftId}/edit`, { replace: true });
      } else {
        await updateQuote(draftId, { title: title || description.slice(0, 64), description, trade, province, country });
      }

      // Upload photo if present
      if (photo) {
        try { const { url } = await uploadQuotePhoto(draftId, photo); await updateQuote(draftId, { photo_url: url }); setPhotoSaved(true); toast('Photo saved to quote', 'success'); } catch (e) { console.warn('[Punchlist] Photo upload failed:', e.message); toast('Photo upload failed — you can re-add it later', 'error'); }
      }

      // Fetch AI scope
      let wonContext = [], labourRate = 0;
      try { const [wc, p] = await Promise.all([getWonQuoteContext(null, 5), userProfile ? Promise.resolve(userProfile) : getProfile(user.id)]); wonContext = wc || []; labourRate = Number(p?.default_labour_rate || 0); } catch (e) { console.warn("[PL]", e); }

      // Resolve photo to base64 for AI vision
      let photoBase64 = null;
      if (photo) {
        try { photoBase64 = await new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(rd.result.split(',')[1]); rd.onerror = rej; rd.readAsDataURL(photo); }); } catch (e) { console.warn("[PL]", e); }
      } else {
        const photoUrl = (await getQuote(draftId))?.photo_url;
        if (photoUrl) { try { const r = await fetch(photoUrl); if (r.ok) { const b = await r.blob(); photoBase64 = await new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(rd.result.split(',')[1]); rd.onerror = rej; rd.readAsDataURL(b); }); } } catch (e) { console.warn("[PL]", e); } }
      }

      // Slice 10 §2.3: Use pre-warm result if available for this description,
      // otherwise abort any stale pre-warm and issue a fresh request.
      let scopePromise;
      if (
        aiPreWarmRef.current.promise &&
        aiPreWarmRef.current.forDescription === description
      ) {
        scopePromise = aiPreWarmRef.current.promise;
      } else {
        aiPreWarmRef.current.controller?.abort();
        scopePromise = requestAiScope({ description, trade, estimatorRoute: 'balanced', province, country, photo: photoBase64, wonQuotes: wonContext, labourRate });
      }
      // Reset prewarm state after consuming
      aiPreWarmRef.current = { promise: null, controller: null, forDescription: '' };

      const r = await scopePromise;

      // Check if AI returned an error or warning
      if (r.source === 'error' || r.source === 'none') {
        console.warn('[Punchlist] AI returned:', r.source, r.warning);
        toast(r.warning || 'AI could not generate items — add them manually.', 'error');
        initialLoadComplete.current = true;
        setScopeError(true);
        setPhase('review');
        return;
      }

      // §6.1 — Snapshot existing line items so the contractor can undo the AI add
      preAiLineItemsRef.current = [...lineItems];

      let items = (r.items || r.line_items || []).map((it, i) => normSuggestion(it, i));
      items.sort((a, b) => ({ labour: 0, services: 1, materials: 2 }[a.tab] ?? 3) - ({ labour: 0, services: 1, materials: 2 }[b.tab] ?? 3));
      const upgrades = (r.optional_upgrades || []).map((u, i) => ({ id: `upg_${i}_${Date.now()}`, name: u.description || '', category: u.category || 'Services', tab: classifyItem(u.description || '', u.category || ''), unit_price: Number(u.unit_price || 0), typical_low: 0, typical_high: 0, why: u.why || '', when_needed: '', when_not_needed: '', notes: '', confidence: 'medium', source: 'Recommended upgrade', selected: false, isUpgrade: true }));
      setSuggestions([...items, ...upgrades]);
      setScopeGaps(r.gaps || []);
      setScopeMeta({ scope_summary: r.scope_summary || '', assumptions: (r.assumptions || []).join('\n'), exclusions: (r.exclusions || []).join('\n') });

      // Convert to line items immediately
      const selected = [...items, ...upgrades].filter(s => s.selected);
      const newLineItems = selected.map((s, i) => ({ id: s.id, name: s.name, quantity: s.quantity || 1, unit_price: s.unit_price || 0, notes: '', category: s.category || '', included: true }));
      setLineItems(newLineItems);
      setDraft(d => ({ ...d, title: title || description.slice(0, 64), description, scope_summary: r.scope_summary || d.scope_summary, assumptions: (r.assumptions || []).join('\n') || d.assumptions, exclusions: (r.exclusions || []).join('\n') || d.exclusions }));
      initialLoadComplete.current = true;

      // Save to quote
      await updateQuote(draftId, { scope_summary: r.scope_summary || '', assumptions: (r.assumptions || []).join('\n'), exclusions: (r.exclusions || []).join('\n'), line_items: newLineItems });

      if (items.length < 2) toast('Fewer items than expected were suggested. Add more below.', 'info');
      else {
        // §6.1 — Undo last item add: 5s window to revert the entire AI-added set
        const snapshotBefore = preAiLineItemsRef.current || [];
        const addedCount = newLineItems.length - snapshotBefore.length;
        if (addedCount > 0) {
          showUndo(
            `${addedCount} item${addedCount !== 1 ? 's' : ''} added by AI`,
            5000,
            null, // onCommit — no-op, items are already set
            () => {
              // onUndo — restore the snapshot
              setLineItems(snapshotBefore);
              markDirty();
              toast('AI items removed', 'info');
            }
          );
        } else {
          toast(`${items.length} items added to your quote`, 'success');
        }
      }
      trackQuoteFlowScopeReady(newLineItems.length); // B13
      setPhase('review');
    } catch (e) {
      console.error('[Punchlist] AI scope failed:', e.message);
      setScopeError(true);
      toast(e.message?.includes('timed out') || e.message?.includes('timeout') ? 'Quote generation timed out — add items manually or retry.' : 'Could not generate items — add them manually.', 'error');
      // Still move to review with empty items — user can add manually
      initialLoadComplete.current = true;
      setPhase('review');
    } finally {
      setScopeLoading(false); clearTimeout(t1); clearTimeout(t2);
    }
  }

  // ── Voice input (Slice 10: fixed onresult accumulation; SR availability gate) ──
  function toggleVoice() {
    if (listening) { if (recRef.current) { recRef.current.stop(); recRef.current = null; } setListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return; // button is hidden when SR unavailable — this is a safety guard only
    const rec = new SR(); rec.lang = 'en-US'; rec.continuous = false; rec.interimResults = true; recRef.current = rec; setListening(true);
    finalRef.current = '';
    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalRef.current += e.results[i][0].transcript;
        else interim = e.results[i][0].transcript;
      }
      setDescription(finalRef.current + (interim ? ' ' + interim : ''));
    };
    rec.onerror = () => { setListening(false); recRef.current = null; };
    rec.onend = () => { setListening(false); recRef.current = null; if (finalRef.current.trim()) toast('Got it', 'success'); };
    rec.start();
    recTimeoutRef.current = setTimeout(() => { if (recRef.current) { recRef.current.stop(); recRef.current = null; setListening(false); } }, 15000);
  }

  // ── Line item management ──
  function updateItem(id, changes) { markDirty(); setLineItems(p => p.map(i => i.id === id ? { ...i, ...changes } : i)); }
  function removeItem(id) {
    const r = lineItems.find(i => i.id === id);
    // Reduced-motion: snap-remove. Otherwise play the leave animation
    // (opacity+translate only — no height/width) then splice out.
    if (isReducedMotion()) {
      markDirty(); setLineItems(p => p.filter(i => i.id !== id));
      if (r?.name) toast(`Removed: ${r.name}`, 'info');
      return;
    }
    setLeavingItemIds(prev => { const n = new Set(prev); n.add(id); return n; });
    setTimeout(() => {
      markDirty();
      setLineItems(p => p.filter(i => i.id !== id));
      setLeavingItemIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      if (r?.name) toast(`Removed: ${r.name}`, 'info');
    }, Math.round((DUR?.base || 0.22) * 1000));
  }
  function duplicateItem(id) { const o = lineItems.find(i => i.id === id); if (!o) return; setLineItems(p => { const idx = p.findIndex(i => i.id === id); const n = [...p]; n.splice(idx + 1, 0, { ...o, id: makeId() }); return n; }); markDirty(); }
  function adjustQty(id, delta) { setLineItems(p => p.map(i => i.id === id ? { ...i, quantity: Math.max(0.25, Math.round(((i.quantity || 1) + delta * 0.25) * 100) / 100) } : i)); markDirty(); }

  // ── Foreman suggestions panel (Phase 1) ──
  // Surfaces AI-returned items NOT already in lineItems and not dismissed.
  // The auto-populate behavior from handleBuildScope is preserved — this
  // panel only shows what the AI flagged as optional / upgrade / skipped.
  function addSuggestionToItems(sug) {
    // Avoid duplicates (stable comparison on normalized name).
    const exists = lineItems.some(li => (li.name || '').toLowerCase().trim() === (sug.name || '').toLowerCase().trim());
    if (exists) {
      setDismissedSugIds(prev => { const n = new Set(prev); n.add(sug.id); return n; });
      return;
    }
    setLineItems(p => [...p, { id: makeId(), name: sug.name, quantity: Number(sug.quantity || 1), unit_price: Number(sug.unit_price || 0), notes: '', category: sug.category || '', included: true }]);
    setDismissedSugIds(prev => { const n = new Set(prev); n.add(sug.id); return n; });
    markDirty();
    toast(`Added: ${sug.name}`, 'success');
  }
  function dismissSuggestion(id) {
    setDismissedSugIds(prev => { const n = new Set(prev); n.add(id); return n; });
  }
  // Suggestions visible to the user = not selected at build time
  // (selected ones were auto-added to lineItems), not already in lineItems
  // by name, and not dismissed this session.
  const visibleSuggestions = useMemo(() => {
    if (!suggestions || suggestions.length === 0) return [];
    const namesInUse = new Set(lineItems.map(li => (li.name || '').toLowerCase().trim()).filter(Boolean));
    return suggestions.filter(s => {
      if (dismissedSugIds.has(s.id)) return false;
      if (s.selected) return false; // already auto-added
      const nm = (s.name || '').toLowerCase().trim();
      if (!nm) return false;
      if (namesInUse.has(nm)) return false;
      return true;
    });
  }, [suggestions, lineItems, dismissedSugIds]);

  // ── Catalog search ──
  const jobCtx = useMemo(() => extractJobContext([draft.title, description].filter(Boolean).join('. '), trade), [draft.title, description, trade]);
  useEffect(() => {
    if (addMode !== 'catalog') { setCatalogResults([]); return; }
    if (!catalogQuery || catalogQuery.length < 2) { clearTimeout(catalogDebounceRef.current); setCatalogResults(browseCatalog(trade, 30).map(hit => { const adj = regionalize(hit, province); const a = anchorPrice(adj.lo || hit.lo, adj.hi || hit.hi, normalizeTrade(trade), hit.c); return { id: `cat_${makeId()}`, name: hit.n, desc: hit.d || '', category: hit.c || '', lo: a.lo, hi: a.hi, mid: a.mid }; })); return; }
    clearTimeout(catalogDebounceRef.current);
    catalogDebounceRef.current = setTimeout(() => {
      const ctx = extractJobContext([draft.title, description].filter(Boolean).join('. '), trade);
      const hits = smartSearch(catalogQuery, ctx, province, 20).map(hit => ({ id: `cs_${makeId()}`, name: hit.name, desc: hit.desc || '', category: hit.category || '', lo: hit.lo || 0, hi: hit.hi || 0, mid: hit.mid || 0, isContextRelevant: hit.isContextRelevant }));
      setCatalogResults(hits);
    }, 200);
  }, [catalogQuery, addMode, trade, province]);

  function addCatalogItem(item) {
    if (lineItems.some(li => li.name.toLowerCase() === item.name.toLowerCase())) return;
    const lo = item.lo || 0, hi = item.hi || 0;
    const price = hi > lo ? Math.round(lo + (hi - lo) * 0.55) : (item.mid || 0);
    setLineItems(p => [...p, { id: makeId(), name: item.name, quantity: 1, unit_price: price, notes: '', category: item.category || '', included: true }]);
    markDirty(); toast(`Added: ${item.name}`, 'success');
  }

  // ── Totals ──
  const totals = useMemo(() => calculateTotals(lineItems, province, country), [lineItems, province, country]);
  const grandTotal = Math.max(0, totals.subtotal - (draft.discount || 0)) * (1 + totals.rate);
  const itemCount = lineItems.filter(i => i.name?.trim()).length;
  const selCustomer = allCustomers.find(c => c.id === draft.customer_id);

  // ── Deposit sync ──
  useEffect(() => {
    if (!initialLoadComplete.current || !draft.deposit_required) return;
    const pct = draft.deposit_percent || 0; if (pct <= 0) return;
    const base = Math.max(0, totals.subtotal - (draft.discount || 0));
    const newAmt = Math.round(base * pct / 100);
    if (newAmt !== draft.deposit_amount) setDraft(d => ({ ...d, deposit_amount: newAmt }));
  }, [totals.subtotal, draft.discount, draft.deposit_percent, draft.deposit_required]);

  // ── Scope hints ──
  const scopeHints = useMemo(() => {
    const hints = SCOPE_HINTS[normalizeTrade(trade)] || SCOPE_HINTS.General || [];
    const names = new Set(lineItems.map(i => (i.name || '').toLowerCase()));
    return hints.filter(h => !names.has(h.toLowerCase()) && !lineItems.some(i => (i.name || '').toLowerCase().includes(h.toLowerCase())));
  }, [trade, lineItems]);

  // ── Confidence ──
  const confidence = useMemo(() => buildConfidence(lineItems, [], { hasCustomer: !!draft.customer_id, hasScope: !!draft.scope_summary, hasDeposit: !draft.deposit_required || draft.deposit_status === 'paid', revisionSummary: draft.revision_summary }), [lineItems, draft]);

  // ── Price range hints — invisible AI, contractor just sees "typical range" ──
  const priceRanges = useMemo(() => {
    const ranges = {};
    for (const item of lineItems) {
      const name = (item.name || '').trim();
      if (name.length < 3) continue;
      const hits = searchCatalog(name, trade, 1, province);
      if (hits.length > 0) {
        const hit = hits[0];
        const adj = regionalize(hit, province);
        const a = anchorPrice(adj.lo || hit.lo, adj.hi || hit.hi, normalizeTrade(trade), hit.c);
        if (a.lo > 0 && a.hi > 0) {
          ranges[item.id] = { lo: a.lo, hi: a.hi, name: hit.n };
        }
      }
    }
    return ranges;
  }, [lineItems.map(i => i.name + i.id).join(','), trade, province]);

  // ── Autosave ──
  async function save(nextStatus = null, silent = false) {
    if (saveMutex.current) { try { await saveMutex.current; } catch (e) { console.warn("[PL]", e); } }
    if (!user || !quoteId) return null;
    if (!nextStatus && !initialLoadComplete.current) return null;
    if (!nextStatus && lineItems.length === 0) return null;
    const savePromise = (async () => {
      setSaving(true); savingRef.current = true; setSaveState('saving');
      try {
        const effectiveStatus = nextStatus || draft.status || 'draft';
        const pl = { ...draft, title: title || draft.title, description, status: effectiveStatus, line_items: lineItems, trade, province, country, delivery_method: deliveryMethod };
        const q = await updateQuote(quoteId, pl);
        clearDirty(); setSaveState('saved'); setLastSavedAt(new Date()); setTimeout(() => setSaveState(''), 2500);
        if (offlineDraft) { deleteOfflineDraft(quoteId).catch(e => console.warn('[PL]', e)); setOfflineDraft(false); }
        if (!silent) {
          // v99 fix: suppress redundant "Saved" toast — the footer button already
          // shows a 2.5s "✓ Saved" pill for manual saves. Still toast for sends
          // and errors since those warrant a more visible confirmation.
          if (nextStatus === 'sent') toast('Quote sent', 'success');
        }
        return q;
      } catch (e) {
        if (isNetworkError(e) && quoteId) {
          try { await saveOfflineDraft({ ...draft, title, description, line_items: lineItems, trade, province, country, id: quoteId, savedAt: new Date().toISOString() }); setOfflineDraft(true); setSaveState(''); if (!silent) toast("Saved offline — will sync when online", 'info'); return null; } catch (e) { console.warn("[PL]", e); }
        }
        setError(friendly(e)); setSaveState(''); if (!silent) toast(friendly(e), 'error'); return null;
      } finally { setSaving(false); savingRef.current = false; }
    })();
    saveMutex.current = savePromise;
    try { return await savePromise; } finally { saveMutex.current = null; }
  }

  // Autosave — B9 / C5 retune: debounced save (800ms) + flush on hide.
  // Replaces the prior 30s setInterval so users don't lose up to 30s of
  // work on a dropped connection or a backgrounded tab. Network errors
  // detected via isNetworkError fall through to IndexedDB inside save().
  useEffect(() => {
    if (!quoteId) return;
    if (!isDirty) {
      // No pending edits. Still handle the "came back online with an
      // offline draft pending" case with a one-shot sync attempt.
      if (offlineDraft && navigator.onLine) {
        save(null, true).then(synced => { if (synced) toast('Back online — quote synced', 'success'); });
      }
      return;
    }
    if (savingRef.current || isLocked || !initialLoadComplete.current) return;
    if (lineItems.length === 0) return;
    const t = setTimeout(() => { save(null, true); }, 800);
    return () => clearTimeout(t);
  }, [isDirty, draft, lineItems, title, description, quoteId, isLocked, offlineDraft]);

  // Flush on tab hide / pagehide — catches the "user switches apps mid-edit"
  // and "user closes the tab" cases that the debounce would otherwise miss.
  useEffect(() => {
    if (!quoteId) return;
    const flush = () => {
      if (dirty.current && !savingRef.current && !isLocked && initialLoadComplete.current && lineItems.length > 0) {
        save(null, true);
      }
    };
    window.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, [quoteId, isLocked, lineItems.length]);

  // Cancel any pending undo timer on unmount (prevents actualSend firing after navigation)
  useEffect(() => () => { undoCancelRef.current?.(); }, []);

  // ── B13: Keep deliveryMethodRef in sync so the pagehide handler can read it. ──
  useEffect(() => { deliveryMethodRef.current = deliveryMethod; }, [deliveryMethod]);

  // ── B13: Fire quote_flow_abandoned on pagehide if quote was never sent. ──
  // Uses sendBeacon / fetch-keepalive so delivery is reliable during page unload.
  useEffect(() => {
    function onPageHide() {
      if (!sentRef.current) {
        trackQuoteFlowAbandoned();
      }
    }
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      // React unmount (SPA navigation) — also fire abandoned if not sent.
      if (!sentRef.current) {
        endQuoteFlowSession();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Slice 10 §2.3: AI Pre-warm — start the scope request 600ms after typing stops ──
  // By the time the user taps "Build Quote →", the result may already be resolved.
  useEffect(() => {
    if (!description.trim() || description.length < 15) return;
    const timer = setTimeout(() => {
      // Abort previous in-flight if description changed
      if (
        aiPreWarmRef.current.controller &&
        aiPreWarmRef.current.forDescription !== description
      ) {
        aiPreWarmRef.current.controller.abort();
      }
      // Don't re-fire if the description hasn't changed from the last warm
      if (aiPreWarmRef.current.forDescription === description && aiPreWarmRef.current.promise) return;
      const controller = new AbortController();
      aiPreWarmRef.current.controller = controller;
      aiPreWarmRef.current.forDescription = description;
      aiPreWarmRef.current.promise = requestAiScope({
        description,
        trade,
        province,
        country,
        estimatorRoute: 'balanced',
        signal: controller.signal,
      }).catch(err => {
        if (err.name === 'AbortError') return null;
        return null; // silently discard pre-warm errors — user can retry
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [description, trade, province, country]);

  // Cancel pre-warm on unmount
  useEffect(() => () => { aiPreWarmRef.current.controller?.abort(); }, []);

  // ── Slice 9 B12: Keyboard shortcuts ──
  useEffect(() => {
    // Disable all shortcuts on mobile / non-pointer devices
    if (!window.matchMedia('(pointer:fine)').matches) return;

    function onKeyDown(e) {
      const tag = e.target?.tagName?.toLowerCase();
      const inInput = tag === 'input' || tag === 'textarea' || tag === 'select';
      const meta = e.metaKey || e.ctrlKey;

      // ⌘K / Ctrl+K — focus customer search input
      if (meta && e.key === 'k') {
        e.preventDefault();
        const el = document.querySelector('.rq-customer-section input, .jd-input[placeholder*="Search or add customer"]');
        if (el) el.focus();
        return;
      }

      // ⌘↵ / Ctrl+Enter — build scope or send
      if (meta && e.key === 'Enter') {
        e.preventDefault();
        if (phase === 'describe' && description.trim()) {
          handleBuildScope();
        } else if (phase === 'review') {
          handleSend();
        }
        return;
      }

      // ? — toggle keyboard help overlay (not when typing in a field)
      if (e.key === '?' && !inInput && !meta) {
        e.preventDefault();
        setShowKbdHelp(p => !p);
        return;
      }

      // Escape — close keyboard help overlay
      if (e.key === 'Escape' && showKbdHelp) {
        setShowKbdHelp(false);
        return;
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, description, showKbdHelp]);

  // ── Send flow ──
  async function handleQuickCreateCustomer() {
    if (!newCust.name.trim()) return;
    if (!newCust.phone.trim()) return setError('Add a phone number — that\u2019s how the quote gets sent.');
    try {
      // M7: dup-check by phone/email before creating
      const existing = await findCustomerByContact(user.id, { phone: newCust.phone, email: newCust.email });
      if (existing) {
        if (!allCustomers.some(c => c.id === existing.id)) setLocalCustomers(p => [...p, existing]);
        ud('customer_id', existing.id);
        trackQuoteFlowCustomerSelected(existing.id); // B13
        setShowNewCust(false);
        setNewCust({ name: '', email: '', phone: '', address: '' });
        setCustomerSearch('');
        toast(`Using existing contact: ${existing.name}`, 'info');
        return;
      }
      const c = await createCustomer(user.id, newCust);
      invalidateCustomers(); // Slice 11: bust hook cache so next mount re-fetches
      setLocalCustomers(p => [...p, c]); // optimistic local add for instant UI
      ud('customer_id', c.id);
      trackQuoteFlowCustomerSelected(c.id); // B13
      setShowNewCust(false);
      setNewCust({ name: '', email: '', phone: '', address: '' });
      setCustomerSearch('');
      toast('Contact saved', 'success');
    } catch (e) { setError(friendly(e)); }
  }

  function handleSend() {
    setError('');
    if (!canSendQuote(userProfile, sentThisMonth)) { setShowUpgradeModal(true); return; }
    if (!draft.customer_id && deliveryMethod !== 'copy') { setError('Add a customer to send via text. Or use "Copy link".'); return; }
    if (deliveryMethod === 'text' && draft.customer_id) { const cust = allCustomers.find(c => c.id === draft.customer_id); if (!cust?.phone) { setInlinePhone(''); setError('__needs_phone__'); return; } }
    if (deliveryMethod === 'email' && draft.customer_id) { const cust = allCustomers.find(c => c.id === draft.customer_id); if (!cust?.email) { setError('This customer has no email address. Add one or use "Copy link".'); return; } }
    if (!lineItems.some(i => i.name?.trim())) return setError('Add at least one item');
    const zeroItems = lineItems.filter(i => i.name?.trim() && Number(i.unit_price) === 0);
    if (zeroItems.length > 0) { setZeroItemConfirm(zeroItems.length); return; }
    proceedToSend();
  }
  function proceedToSend() {
    setZeroItemConfirm(null);
    if (!draft.scope_summary.trim()) ud('scope_summary', `${title || draft.title || 'Work'}. Includes: ${lineItems.filter(i => i.name?.trim()).map(i => i.name).slice(0, 8).join(', ')}.`);
    const firstName = selCustomer?.name?.split(' ')[0] || '';
    // v99 fix: fall back to full_name before the generic "Your contractor" placeholder
    const senderName = companyName || userProfile?.full_name || 'Your contractor';
    // v100 M3: use the user's initial_sms template; fall back to system default if fetch failed.
    const templateBody = initialSmsTemplate || getSystemDefaults().initial_sms;
    const totalFormatted = currency(grandTotal, country);
    setSmsBody(renderTemplate(templateBody, {
      firstName,
      senderName,
      quoteTitle: title || draft.title || 'Your quote',
      total: totalFormatted,
      link: '[link will be added automatically]',
    }));
    setShowSend(true);
  }

  // Called when the user taps the confirm button in the send modal.
  // Shows a 3s undo toast; actual send fires only after the timer expires.
  function handleConfirmSend() {
    setShowSend(false);
    const methodLabel = deliveryMethod === 'text' ? 'Texting quote…' : deliveryMethod === 'email' ? 'Emailing quote…' : 'Sending quote…';
    const cancelFn = showUndo(
      methodLabel,
      3000,
      () => { actualSend(); },   // onCommit — fires after 3s
      () => { toast('Send cancelled', 'info'); } // onUndo
    );
    undoCancelRef.current = cancelFn;
  }

  // The real send — called by showUndo after the 3s window passes unchallenged.
  async function actualSend() {
    setSending(true);
    try {
      const q = await save('sent');
      if (!q) { setSending(false); return; }
      // H4 client reconciliation (slice 5 pattern): trust server's authoritative status/sent_at
      if (q.status || q.sent_at) {
        setDraft(d => ({
          ...d,
          status: q.status ?? d.status,
          sent_at: q.sent_at ?? d.sent_at,
        }));
      }
      const url = `${window.location.origin}/public/${q.share_token}`;
      const firstName = selCustomer?.name?.split(' ')[0] || '';

      if (deliveryMethod === 'text') {
        let finalBody = smsBody || '';
        if (finalBody.includes('[link will be added automatically]')) finalBody = finalBody.replace('[link will be added automatically]', url);
        else if (!finalBody.includes(url)) finalBody = finalBody.trim() + '\n' + url;
        const result = await smsNotify.customMessage({ to: selCustomer?.phone || '', body: finalBody });
        if (result?.ok) {
          const isFirst = !localStorage.getItem('pl_first_send_at');
          if (!isFirst) toast(`Quote texted to ${firstName || selCustomer?.phone}`, 'success');
          _markSent(firstName);
        } else {
          // C3: Twilio failed — open native SMS, show confirm card
          window.open(`sms:${selCustomer?.phone}?body=${encodeURIComponent(finalBody)}`, '_self');
          setSmsConfirmPending({ url, phone: selCustomer?.phone, body: finalBody, quoteId: q.id, firstName });
        }
      } else if (deliveryMethod === 'email') {
        const cust = allCustomers.find(c => c.id === draft.customer_id);
        const response = await sendQuoteEmail(q.id, cust?.email);
        // H4 reconciliation for email path
        if (response.status || response.sent_at) {
          setDraft(d => ({
            ...d,
            status: response.status ?? d.status,
            sent_at: response.sent_at ?? d.sent_at,
          }));
        }
        toast(`Quote emailed to ${firstName || cust?.email}`, 'success');
        _markSent(firstName);
      } else {
        // copy
        try { await navigator.clipboard.writeText(url); toast('Link copied', 'success'); } catch { toast('Link: ' + url, 'info'); }
        _markSent(firstName);
      }
    } catch (e) { setError(e?.message || 'Send failed'); } finally { setSending(false); }
  }

  // Shared post-send bookkeeping (called by all paths that definitively sent)
  function _markSent(customerFirstName) {
    setSentSuccess(true); setPhase('sent');
    try { localStorage.setItem('pl_has_sent_quote', '1'); } catch (e) { console.warn('[PL]', e); }
    const isFirst = !localStorage.getItem('pl_first_send_at');
    trackQuoteSent(grandTotal, trade, isFirst);
    if (isFirst) {
      trackFirstSend(grandTotal, trade);
      try { localStorage.setItem('pl_first_send_at', new Date().toISOString()); } catch (e) { /* */ }
    }
    const newCount = sentThisMonth + 1; setSentThisMonth(newCount);
    // B13: fire flow-sent event and mark session as complete so pagehide
    // does not also fire quote_flow_abandoned.
    sentRef.current = true;
    trackQuoteFlowSent({ deliveryMethod: deliveryMethodRef.current, total: grandTotal });
    // ── UX-023 / Flow #1 delight: warmer send confirmation toast ──
    // First-ever send: "Kristine's phone just buzzed" (Superhuman-grade specificity).
    // Subsequent sends: "Quote sent to {firstName}".
    const fn = customerFirstName || selCustomer?.name?.split(' ')[0] || 'your customer';
    if (isFirst) {
      toast(`${fn}'s phone just buzzed — your first quote is on its way`, 'success');
    }
    // (non-first toasts are shown at the call site with the specific send path context)
  }

  // C3: user confirmed they tapped Send in the native SMS app
  async function handleSmsConfirm() {
    const pending = smsConfirmPending;
    setSmsConfirmPending(null);
    if (!pending) return;
    const fn = pending.firstName || pending.phone;
    _markSent(pending.firstName);
    const isFirst = !localStorage.getItem('pl_first_send_at');
    if (!isFirst) toast(`Quote sent to ${fn}`, 'success');
  }

  // C3: user said they did NOT send — roll back to draft
  async function handleSmsCancel() {
    setSmsConfirmPending(null);
    // Roll the status back to draft since actualSend wrote 'sent' optimistically via save('sent')
    if (quoteId) {
      try { await updateQuote(quoteId, { status: 'draft', sent_at: null }); } catch (e) { console.warn('[PL] sms cancel rollback', e); }
    }
    setDraft(d => ({ ...d, status: 'draft', sent_at: null }));
    setPhase('building');
    toast('Send cancelled — quote is still a draft', 'info');
  }

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  const subtitle = phase === 'building' ? 'Building scope…' : phase === 'sent' ? 'Sent' : (companyName || null);

  return (
    <AppShell title={phase === 'describe' ? 'New Quote' : title || draft.title || 'Quote'} subtitle={subtitle}>
      {showUpgradeModal && <UpgradePrompt trigger="quote_limit" context={{ count: sentThisMonth }} onDismiss={() => setShowUpgradeModal(false)} />}

      <Section spacing="tight" bleed={true}>
        <div className="rq-page">

        {/* ════════ PROGRESS STEPPER ════════ */}
        {phase !== 'sent' && (
          <div className="qb-stepper">
            {[
              { key: 'describe', label: 'Describe' },
              { key: 'building', label: 'Build' },
              { key: 'review', label: 'Review' },
            ].map((s, i, arr) => {
              const phases = ['describe', 'building', 'review'];
              const current = phases.indexOf(phase);
              const stepIdx = phases.indexOf(s.key);
              const done = stepIdx < current;
              const active = stepIdx === current;
              return (
                <div key={s.key} className={`qb-step ${done ? 'done' : active ? 'active' : ''}`}>
                  <div className="qb-step-dot">{done ? '✓' : i + 1}</div>
                  <span className="qb-step-label">{s.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* ════════ ZONE 1: DESCRIBE THE JOB ════════ */}
        {phase === 'describe' && (
          <Card padding="loose" className="qb-zone pl-describe-stable" elevation={1}>
            {/* B2 (Slice 12): gradient header strip */}
            <div className="qb-describe-hero" aria-hidden="true">
              <div>
                <div className="qb-describe-hero-title">Send professional quotes in 60 seconds</div>
                <div className="qb-describe-hero-sub">Punchlist builds the scope, pricing, and send flow for you</div>
              </div>
            </div>
            <div className="jd-section">
              <label className="jd-label" htmlFor="qb-desc">What's the job?</label>
              <textarea
                id="qb-desc"
                ref={descTextareaRef}
                className="jd-input jd-textarea qb-desc-auto"
                value={description}
                onChange={e => { setDescription(e.target.value); }}
                onBlur={() => { if (description.trim() && !descCommittedRef.current) { descCommittedRef.current = true; trackQuoteFlowDescriptionCommitted(description.trim().length); } }}
                placeholder={DESC_PLACEHOLDERS[trade] || DESC_PLACEHOLDERS.Other}
                rows={4}
                autoFocus
              />
              {/* UX-023: char helper — positive reinforcement at 80+ chars */}
              <div className="qb-desc-helper">
                {description.length >= 80 && (
                  <span className="qb-desc-helper__nudge">
                    {description.length >= 160 ? 'Very detailed — great for accuracy' : 'Nice and specific'}
                  </span>
                )}
                {description.length > 0 && (
                  <span className="qb-desc-helper__count" style={{ marginLeft: 'auto' }}>
                    {description.length} chars
                  </span>
                )}
              </div>
              <div className="jd-helpers" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 }}>
                {SR_AVAILABLE && (
                  <>
                    <button className={`jd-helper-btn jd-helper-voice ${listening ? 'jd-listening' : ''}`} type="button" onClick={toggleVoice} aria-pressed={listening} aria-label={listening ? 'Stop voice recording' : 'Start voice recording'}>{listening ? 'Stop recording' : 'Describe by voice'}</button>
                    <span className="pl-voice-indicator" data-on={listening ? 'true' : 'false'} aria-hidden={!listening}>
                      <span className="pl-voice-dot" />
                      <span>Listening</span>
                    </span>
                  </>
                )}
                {photo ? (
                  <div className="jd-helper-btn jd-photo-active">{photo.name} <button type="button" onClick={() => setPhoto(null)} aria-label="Remove photo" className="jd-photo-dismiss"><X size={12} /></button></div>
                ) : (
                  <button className="jd-helper-btn jd-helper-secondary" type="button" onClick={() => fileRef.current?.click()}>Add photo</button>
                )}
                <input hidden ref={fileRef} type="file" accept="image/*" onChange={e => setPhoto(e.target.files?.[0] || null)} />
                {photoSaved && <span className="jd-photo-saved">✓ Photo saved</span>}
              </div>
            </div>
            {title && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', padding: '6px 0', lineHeight: 1.5, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>Job: <strong style={{ color: 'var(--text)' }}>{title}</strong></div>}
            <details style={{ marginTop: 4 }}>
              <summary style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--muted)', cursor: 'pointer', padding: '6px 0' }}>Trade: {trade} · {country === 'US' ? 'State' : 'Province'}: {province}</summary>
              <div className="jd-row" style={{ marginTop: 8 }}>
                <div className="jd-section" style={{ flex: 1 }}><select className="jd-input jd-select" value={trade} onChange={e => setTrade(e.target.value)} aria-label="Trade">{TRADES.map(t => <option key={t}>{t}</option>)}</select></div>
                <div className="jd-section" style={{ flex: 1 }}><select className="jd-input jd-select" value={province} onChange={e => setProvince(e.target.value)} aria-label="Province">{(country === 'US' ? US_STATES : CA_PROVINCES).map(p => <option key={p}>{p}</option>)}</select></div>
              </div>
            </details>
            {error && <div className="jd-error" role="alert">{error}</div>}
            <div className="jd-footer" style={{ marginTop: 12 }}>
              <button className="btn btn-primary btn-lg full-width" type="button" onClick={handleBuildScope} disabled={!description.trim()}>{description.trim() ? `Build Quote →` : 'Describe the job to get started'}</button>
              <div className="qb-pillar-teaser">Your customer sees the total, a monthly option, and can approve from their phone.</div>
              <button className="jd-skip-link" type="button" onClick={async () => {
                if (!description.trim()) return setError('Describe the job first');
                try {
                  const d = quoteId ? await updateQuote(quoteId, { title: title || description.slice(0, 64), description, trade, province, country }) : await createQuote(user.id, { title: title || description.slice(0, 64), description, trade, province, country, customer_id: null, status: 'draft', line_items: [] });
                  const id = d?.id || quoteId;
                  if (!quoteId) { setQuoteId(id); nav(`/app/quotes/${id}/edit`, { replace: true }); }
                  initialLoadComplete.current = true;
                  setDraft(prev => ({ ...prev, title: title || description.slice(0, 64), description }));
                  setPhase('review');
                } catch (e) { setError(e.message || 'Failed'); }
              }} disabled={!description.trim()} className="btn-link" style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>or add items manually <ChevronRight size={14} /></button>
            </div>
          </Card>
        )}

        {/* ════════ BUILDING: Loading state with trade-specific preview ════════ */}
        {phase === 'building' && (() => {
          // Show trade-relevant item names as preview during AI scope generation
          const previewItems = browseCatalog(trade, 5).slice(0, 4).map(h => h.n);
          return (
          <Card padding="loose" className="pl-building-stable" elevation={1}>
            {/* B7 (Slice 12): CSS-only top progress bar 0→85% over 15s */}
            <div className="qb-build-progress" aria-hidden="true" />
            <div className="bs-loading" style={{ padding: '16px 0', textAlign: 'center' }}>
              <div className="bs-ai-status">
                <div className="bs-ai-dot" />
                AI is building your quote
              </div>
              <div className="loading-spinner" style={{ margin: '0 auto 12px' }} aria-hidden="true" />
              <div aria-live="polite" style={{ fontSize: 'var(--text-base)', color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>{scopeLoadingMsg}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--subtle)' }}>{trade} · {description.slice(0, 60)}{description.length > 60 ? '…' : ''}</div>
              {photoSaved && <div className="jd-photo-saved" style={{ margin: '10px auto 0' }}>✓ Photo included</div>}
              <div className="bs-skeleton-list" style={{ maxWidth: 480, margin: '20px auto 0' }}>
                {previewItems.map((name, i) => (
                  <div key={`sk-${name}-${i}`} className="bs-skeleton-item" style={{ animationDelay: `${i * 0.15}s` }}>
                    <div className="bs-skeleton-check" />
                    <div className="bs-skeleton-text">
                      <div className="bs-skeleton-bar" style={{ width: `${Math.min(85, name.length * 3.5 + 20)}%` }} />
                    </div>
                    <div className="bs-skeleton-bar price" />
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => { setScopeLoading(false); setPhase('describe'); }} style={{ marginTop: 20, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '8px 16px' }}>← Back to edit</button>
            </div>
          </Card>
          );
        })()}

        {/* ════════ ZONE 2+3: REVIEW (scope + details + send) ════════ */}
        {phase === 'review' && (
          <div style={isLocked ? { pointerEvents: 'none', opacity: 0.65 } : undefined}>
            {/* Collapsed Zone 1 summary */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', marginBottom: 12, fontSize: 'var(--text-xs)' }}>
              <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{trade} · {province} · {(description || '').slice(0, 50)}{description?.length > 50 ? '…' : ''}</span>
              <button type="button" style={{ background: 'none', border: 'none', color: 'var(--brand)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setPhase('describe')}>Edit</button>
            </div>

            {/* Header: Title + Customer — always visible */}
            <div className="rq-header-card">
              <input className="rq-job-title-input" value={title || draft.title} onChange={e => { setTitle(e.target.value); ud('title', e.target.value); }} placeholder="Job title" />
              <div className="rq-customer-section">
                {selCustomer ? (
                  <div className="rq-cust-row"><div className="rq-cust-info"><span className="rq-cust-avatar">{selCustomer.name?.[0]?.toUpperCase() || '?'}</span><div><span className="rq-cust-name">{selCustomer.name}</span>{selCustomer.email && <span className="rq-cust-detail"> · {selCustomer.email}</span>}</div></div><button className="rq-cust-change" type="button" onClick={() => { ud('customer_id', ''); setCustomerSearch(''); }}>Change</button></div>
                ) : (
                  <div className="rq-cust-select">
                    {/* Slice 11: loading skeleton while hook fetches on cold load */}
                    {customersLoading && !allCustomers.length && (
                      <div style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', padding: '8px 0' }}>
                        Loading contacts…
                      </div>
                    )}
                    {/* Slice 11: last-customer quick-chip — shown when no search and no customer selected */}
                    {(() => {
                      const lastCustomer = allCustomers.length ? allCustomers[0] : null;
                      return lastCustomer && !customerSearch ? (
                        <button
                          type="button"
                          className="jd-cust-last-chip"
                          onClick={() => { ud('customer_id', lastCustomer.id); trackQuoteFlowCustomerSelected(lastCustomer.id); }}
                        >
                          ↩ {lastCustomer.name}
                        </button>
                      ) : null;
                    })()}
                    <input className="jd-input" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Search or add customer…" autoComplete="off" />
                    {customerSearch.trim() && (() => {
                      const matches = searchCustomers(allCustomers, customerSearch, 6);
                      return matches.length > 0 ? (<div className="jd-cust-list">{matches.map(c => <button key={c.id} className="jd-cust-pill" type="button" onClick={() => { ud('customer_id', c.id); trackQuoteFlowCustomerSelected(c.id); setCustomerSearch(''); }}><span>{c.name}</span>{c.phone && <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--muted)', marginLeft: 6 }}>{c.phone}</span>}</button>)}</div>) : (<button className="jd-cust-pill jd-cust-new" type="button" onClick={() => { setNewCust(p => ({ ...p, name: customerSearch })); setShowNewCust(true); }}>+ New: "{customerSearch}"</button>);
                    })()}
                    {showNewCust && (<div className="jd-new-cust"><input className="jd-input" value={newCust.name} onChange={e => setNewCust(p => ({ ...p, name: e.target.value }))} placeholder="Full name *" /><div className="jd-row"><input className="jd-input" value={newCust.phone} onChange={e => setNewCust(p => ({ ...p, phone: e.target.value }))} placeholder="Phone *" type="tel" /><input className="jd-input" value={newCust.email} onChange={e => setNewCust(p => ({ ...p, email: e.target.value }))} placeholder="Email (optional)" /></div><div style={{ display: 'flex', gap: 6 }}><button className="btn btn-primary btn-sm" type="button" onClick={handleQuickCreateCustomer}>Save</button><button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowNewCust(false)}>Cancel</button></div></div>)}
                  </div>
                )}
              </div>
            </div>

            {/* Quote settings — collapsed on mobile */}
            <details className="rq-meta-collapse">
              <summary className="rq-meta-toggle pl-toggle-row" style={{ listStyle:'none' }}>
                <span>Quote details</span>
                <span className="pl-chevron" />
              </summary>
              {/* Scope Summary */}
              <div className="rq-scope-card">
                <div className="rq-scope-top"><span className="rq-scope-label">Scope summary</span><span className="rq-scope-hint">Shown to customer</span></div>
                <textarea className="rq-scope-input" value={draft.scope_summary} onChange={e => ud('scope_summary', e.target.value)} rows={2} placeholder="Brief description of work" />
              </div>

              {/* Settings row */}
              <div className="rq-settings-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, padding: '12px 16px', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 'var(--r)', marginBottom: 10 }}>
                <div><label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)', marginBottom: 4 }}>{country === 'US' ? 'State' : 'Province'} (tax)</label><select className="input" value={province} onChange={e => setProvince(e.target.value)} style={{ width: '100%', fontSize: 'var(--text-sm)' }}>{(country === 'CA' ? CA_PROVINCES : US_STATES).map(p => <option key={p}>{p}</option>)}</select></div>
                <div><label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)', marginBottom: 4 }}>Deposit</label><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer' }}><input type="checkbox" checked={draft.deposit_required} onChange={e => ud('deposit_required', e.target.checked)} style={{ accentColor: 'var(--brand)' }} /><span>Require deposit</span></label>{draft.deposit_required && <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input className="rq-deposit-input" type="number" min="0" value={draft.deposit_percent || ''} onChange={e => { const pct = Number(e.target.value) || 0; ud('deposit_percent', pct); ud('deposit_amount', Math.round(Math.max(0, totals.subtotal - (draft.discount || 0)) * pct / 100)); }} style={{ width: 50 }} /><span style={{ fontSize: 'var(--text-2xs)', color: 'var(--muted)' }}>%</span></div>}</div></div>
              </div>

              {/* Assumptions/Exclusions (collapsed) */}
              <div className="rq-scope-card" style={{ marginBottom: 10 }}>
                <button type="button" className="rq-details-toggle pl-toggle-row" onClick={() => setShowDetails(!showDetails)} style={{ width:'100%', background:'none', border:'none', fontFamily:'inherit', fontSize: 'var(--text-sm)' }}>
                  <span>{showDetails ? 'Assumptions, exclusions & notes' : 'Assumptions, exclusions & notes'}</span>
                  <span className={`pl-chevron ${showDetails ? 'pl-chevron--open' : ''}`} />
                </button>
                {showDetails && (<div className="rq-details-grid"><div><label className="rq-detail-label">Assumptions</label><textarea className="rq-detail-input" value={draft.assumptions} onChange={e => ud('assumptions', e.target.value)} rows={2} placeholder="e.g. Standard access, no structural changes" /></div><div><label className="rq-detail-label">Exclusions</label><textarea className="rq-detail-input" value={draft.exclusions} onChange={e => ud('exclusions', e.target.value)} rows={2} placeholder="e.g. Permit fees, drywall repair" /></div><div><label className="rq-detail-label">Internal notes</label><textarea className="rq-detail-input" value={draft.internal_notes} onChange={e => ud('internal_notes', e.target.value)} rows={2} placeholder="Notes for your records only" /></div></div>)}
              </div>
            </details>

            {/* Line Items */}
            <div className="rq-builder-layout">
              <div className="rq-builder-left">
                <div id="qb-line-items" className="rq-items-section pl-items-motion pl-items-stable">
                  <div className="rq-items-head"><span className="rq-items-title">{itemCount > 0 ? `${itemCount} item${itemCount !== 1 ? 's' : ''}` : 'Line items'}</span></div>
                  {lineItems.map((item, idx) => {
                    const itemTotal = Number(item.quantity || 0) * Number(item.unit_price || 0);
                    const isLeaving = leavingItemIds.has(item.id);
                    return (
                      <div key={item.id} className={`rq-card ${editingItemId === item.id ? 'rq-card-editing' : ''} ${isLeaving ? 'pl-item-leave' : 'pl-item-enter'}`}
                        draggable={!isLeaving} onDragStart={e => { e.dataTransfer.setData('text/plain', idx.toString()); e.currentTarget.style.opacity = '0.5'; }} onDragEnd={e => { e.currentTarget.style.opacity = '1'; }} onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('rq-card-dragover'); }} onDragLeave={e => { e.currentTarget.classList.remove('rq-card-dragover'); }} onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('rq-card-dragover'); const from = parseInt(e.dataTransfer.getData('text/plain')); if (isNaN(from) || from === idx) return; setLineItems(p => { const n = [...p]; const [m] = n.splice(from, 1); n.splice(idx, 0, m); return n; }); markDirty(); }}>
                        <div className="rq-card-drag-handle" title="Drag to reorder" aria-hidden="true">⠿</div>
                        <div className="rq-card-main">
                          <div className="rq-card-top"><input className="rq-card-name" value={item.name} onChange={e => updateItem(item.id, { name: e.target.value })} placeholder="Item name" aria-label="Item name" data-item-idx={idx} onFocus={() => setEditingItemId(item.id)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && idx === lineItems.length - 1) { e.preventDefault(); setLineItems(p => [...p, { id: 'new_' + Date.now(), name: '', quantity: 1, unit_price: 0, notes: '', included: true, category: '' }]); markDirty(); } }} /><span className="rq-card-line-total tabular">{currency(itemTotal, country)}</span></div>
                          <div className="rq-card-controls"><div className="rq-qty-stepper"><button type="button" className="rq-qty-btn" aria-label="Decrease quantity" onClick={() => adjustQty(item.id, -1)}>−</button><span className="rq-qty-val tabular">{Number(item.quantity).toFixed(item.quantity % 1 === 0 ? 0 : 2)}</span><button type="button" className="rq-qty-btn" aria-label="Increase quantity" onClick={() => adjustQty(item.id, 1)}>+</button></div><span className="rq-card-times">×</span><div className="rq-price-wrap"><span className="rq-price-prefix">$</span><input className="rq-card-price-input tabular" type="number" min="0" step="1" value={item.unit_price} aria-label="Unit price" onChange={e => updateItem(item.id, { unit_price: Math.max(0, Number(e.target.value) || 0) })} onFocus={() => setEditingItemId(item.id)} /></div><div className="rq-card-item-actions"><button className="rq-card-action-btn" type="button" onClick={() => duplicateItem(item.id)} title="Duplicate" aria-label="Duplicate item">⧉</button><button className="rq-card-action-btn rq-card-action-del" type="button" onClick={() => removeItem(item.id)} title="Remove" aria-label={`Remove ${item.name || 'item'}`}>×</button></div></div>
                          {/* Price confidence hint — only when editing this item */}
                          {editingItemId === item.id && priceRanges[item.id] && (() => {
                            const r = priceRanges[item.id];
                            const price = Number(item.unit_price || 0);
                            if (price === 0) return <div className="rq-price-hint">Typical: ${r.lo}–${r.hi}</div>;
                            if (price < r.lo * 0.6) return <div className="rq-price-hint rq-price-low">Below typical range (${r.lo}–${r.hi})</div>;
                            if (price > r.hi * 1.8) return <div className="rq-price-hint rq-price-high">Above typical range (${r.lo}–${r.hi})</div>;
                            return null;
                          })()}
                          {item.notes ? (<input className="rq-card-notes" value={item.notes} onChange={e => updateItem(item.id, { notes: e.target.value })} placeholder="Note (shown to customer)" aria-label="Item note" />) : (<button type="button" className="rq-card-add-note" onClick={() => updateItem(item.id, { notes: ' ' })}>+ note</button>)}
                        </div>
                      </div>
                    );
                  })}
                  {lineItems.length === 0 && <div className="rq-empty"><div className="rq-empty-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div><div className="rq-empty-text">No items yet</div><div className="rq-empty-sub">Search the catalog, add custom items, or ask Foreman to help scope this job.</div></div>}
                </div>

                {/* Add Item Bar */}
                <div className="rq-add-bar">
                  {!addMode && (<div className="rq-add-triggers"><button type="button" className="rq-add-trigger rq-add-trigger-primary" onClick={() => setAddMode('catalog')}>Search catalog</button><button type="button" className="rq-add-trigger" onClick={() => { setLineItems(p => [...p, { id: 'new_' + Date.now(), name: '', quantity: 1, unit_price: 0, notes: '', included: true, category: '' }]); markDirty(); }}>+ Custom item</button><button type="button" className="rq-add-trigger rq-add-trigger-foreman" onClick={() => { if (window.__punchlistOpenForeman) { const jobDesc = description || title || ''; const itemsSummary = lineItems.filter(i => i.name?.trim()).map(i => `${i.name} (${i.quantity}× $${i.unit_price})`).join(', '); const ctx = { starters: [ `What else should I include for this ${trade.toLowerCase()} job?`, jobDesc ? `Review my scope: "${jobDesc.slice(0, 80)}${jobDesc.length > 80 ? '…' : ''}"` : 'Help me scope this quote', `What do ${trade.toLowerCase()}s commonly forget to quote?`, ], quoteContext: { description: jobDesc, trade, title: title || '', items: lineItems.filter(i => i.name?.trim()).map(i => ({ name: i.name, qty: i.quantity, price: i.unit_price })), total: grandTotal, province, country } }; window.__punchlistOpenForeman(ctx); } }}><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style="verticalAlign:middle,marginRight:4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Ask Foreman</button>{quoteId && scopeError && <button type="button" className="rq-add-trigger" onClick={() => setPhase('describe')}>✦ Retry AI scope</button>}</div>)}
                  {addMode === 'catalog' && (<div className="rq-catalog-overlay"><div className="rq-catalog-panel"><div className="rq-catalog-top"><input className="rq-catalog-input" value={catalogQuery} onChange={e => setCatalogQuery(e.target.value)} placeholder="Search items…" autoFocus autoComplete="off" /><button type="button" className="rq-catalog-close" onClick={() => { setAddMode(null); setCatalogQuery(''); }} aria-label="Close catalog"><X size={14} strokeWidth={2} /></button></div>{catalogResults.length > 0 && (<div className="rq-catalog-results">{catalogResults.map((item, i) => { const added = lineItems.some(li => li.name.toLowerCase() === item.name.toLowerCase()); return (<div key={`${item.name}-${i}`} className={`rq-catalog-item ${added ? 'added' : ''} ${item.isContextRelevant ? 'rq-catalog-relevant' : ''}`} onClick={() => !added && addCatalogItem(item)}><div className="rq-catalog-info"><span className="rq-catalog-name">{item.name}</span>{item.isContextRelevant && <span className="rq-catalog-match-tag">matches this job</span>}{item.desc && <span className="rq-catalog-desc">{item.desc}</span>}</div><div className="rq-catalog-right"><span className="rq-catalog-price">{currency(item.lo)}–{currency(item.hi)}</span><span className="rq-catalog-add">{added ? '✓' : '+'}</span></div></div>); })}</div>)}{catalogQuery.length >= 2 && catalogResults.length === 0 && <div className="rq-catalog-empty">No matches — try different keywords</div>}{!catalogQuery && <div className="rq-catalog-empty" style={{ color: 'var(--subtle)', fontSize: 'var(--text-xs)' }}>Type to search {trade.toLowerCase()} items</div>}</div></div>)}
                </div>

                {/* Scope Hints (collapsed) */}
                {scopeHints.length > 0 && lineItems.length > 0 && (<details className="rq-hints"><summary className="pl-toggle-row" style={{ cursor:'pointer', listStyle:'none', padding:'6px 0', fontSize: 'var(--text-sm)' }}><span>Commonly added for {trade}</span><span className="pl-chevron pl-chevron--sm" /></summary><div className="rq-hints-chips">{scopeHints.slice(0, 5).map(hint => (<button key={hint} type="button" className="rq-hint-chip" onClick={() => { setLineItems(p => [...p, { id: makeId(), name: hint, quantity: 1, unit_price: 0, notes: '', included: true, category: '' }]); markDirty(); toast(`Added: ${hint} — set a price`, 'success'); }}>+ {hint}</button>))}</div></details>)}

                {/* ── Foreman AI Suggestions (Phase 1) ──
                    Surfaces items the AI flagged as optional / upgrade / skipped
                    during scope generation. Each row has Add/Dismiss actions.
                    Helpful tone — not nagging. Only renders when there's
                    something to suggest. */}
                {visibleSuggestions.length > 0 && (
                  <Card padding="default" elevation={1} className="pl-sug-panel" as="section" aria-label="Foreman suggestions">
                    <div className="pl-sug-head">
                      <span className="pl-sug-title">Foreman suggests</span>
                      <span className="pl-sug-count">{visibleSuggestions.length} idea{visibleSuggestions.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="pl-sug-list motion-isolate">
                      {visibleSuggestions.map(sug => {
                        const price = Number(sug.unit_price || 0);
                        return (
                          <div key={sug.id} className="pl-sug-item">
                            <div className="pl-sug-item-main">
                              <div className="pl-sug-item-name">{sug.name}</div>
                              <div className="pl-sug-item-meta tabular">
                                {price > 0 ? currency(price, country) : 'Set price'}
                                {sug.category ? ` · ${sug.category}` : ''}
                                {sug.isUpgrade ? ' · Upgrade' : ''}
                              </div>
                              {sug.why && <div className="pl-sug-item-why">{sug.why}</div>}
                            </div>
                            <div className="pl-sug-actions">
                              <button
                                type="button"
                                className="pl-sug-btn pl-sug-btn-add"
                                onClick={() => addSuggestionToItems(sug)}
                                aria-label={`Add ${sug.name}`}
                              >Add</button>
                              <button
                                type="button"
                                className="pl-sug-btn"
                                onClick={() => dismissSuggestion(sug.id)}
                                aria-label={`Dismiss ${sug.name}`}
                              >Dismiss</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}
              </div>

              {/* Right Sidebar: Customer preview + close helpers */}
              <div className="rq-builder-right">
                <div className="rq-customer-preview-label">What your customer sees</div>
                <Card padding="default" elevation={2} className="rq-totals-card pl-totals-stable" aria-label="Quote totals">
                  {/* Stat primitives handle count-up + stable width via
                      --min-ch + tabular-nums, so $10,000 never reflows. */}
                  <div className="pl-totals-stats motion-isolate">
                    <Stat label="Subtotal" value={Math.round(totals.subtotal)} prefix="$" countUp={true} align="end" />
                    <div className="pl-totals-stat-row rq-discount-row">
                      <span className="pl-stat-label">Discount</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)' }}>−$</span>
                        <input className="rq-discount-input tabular" type="number" min="0" value={draft.discount || ''} onChange={e => ud('discount', Number(e.target.value) || 0)} placeholder="0" aria-label="Discount amount" />
                      </div>
                    </div>
                    <Stat label={`Tax (${province})`} value={Math.round(Math.max(0, totals.subtotal - (draft.discount || 0)) * totals.rate)} prefix="$" countUp={true} align="end" />
                    <Stat label="Total" value={Math.round(grandTotal)} prefix="$" countUp={true} align="end" tone="brand" />
                  </div>
                  {showFinancing(grandTotal) && (() => {
                    const mo = estimateMonthly(grandTotal);
                    return (
                    <div className="rq-financing-card rq-financing-prominent">
                      <div className="rq-monthly-label">PAYMENT OPTIONS</div>
                      <div className="rq-monthly-value tabular">as low as {currency(mo, country)}<span>/mo</span></div>
                      <div className="rq-monthly-hint">Shown to your customer · Final rate set by Klarna/Affirm at checkout</div>
                    </div>
                    );
                  })()}
                </Card>
                {/* Close helper tips */}
                {lineItems.length > 0 && grandTotal > 0 && (
                  <div className="rq-close-tips">
                    <div className="rq-close-tips-title">How this helps you close</div>
                    <div className="rq-close-tip">✓ Customer can approve and sign from their phone</div>
                    {showFinancing(grandTotal) && <div className="rq-close-tip">✓ Monthly payment option removes price hesitation</div>}
                    {draft.deposit_required && <div className="rq-close-tip">✓ Deposit locks in the job before you start</div>}
                    {draft.scope_summary && <div className="rq-close-tip">✓ Scope summary sets clear expectations</div>}
                    {!draft.deposit_required && <div className="rq-close-tip" style={{ color: 'var(--muted)' }}>○ Add a deposit to lock in the job</div>}
                  </div>
                )}
                {/* Tracking teaser */}
                {lineItems.length > 0 && grandTotal > 0 && (
                  <div className="rq-tracking-teaser">
                    <span className="rq-tracking-icon"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></span>
                    <span>After you send, you'll see when {selCustomer?.name?.split(' ')[0] || 'your customer'} opens this quote</span>
                  </div>
                )}
                <button className="btn btn-secondary full-width rq-preview-customer-btn" type="button" disabled={saving || isLocked || itemCount === 0} onClick={async () => { const q = await save(null, true); if (q?.share_token) { window.open('/public/' + q.share_token + '?preview=1', '_blank'); } else if (quoteId) { try { const ex = await getQuote(quoteId); if (ex?.share_token) window.open('/public/' + ex.share_token + '?preview=1', '_blank'); else toast('Save the quote first to preview', 'info'); } catch { toast('Save the quote first to preview', 'info'); } } else { toast('Save the quote first to preview', 'info'); } }}>
                  See what {selCustomer?.name?.split(' ')[0] || 'your customer'} will see
                </button>
                {lineItems.length > 0 && confidence && (confidence.readiness === 'ready' ? (<div className="rq-conf-inline-ok"><span>✓</span> Ready to send</div>) : (<details className={`rq-confidence rq-conf-${confidence.readiness}`}><summary className="rq-conf-top" style={{ cursor:'pointer', listStyle:'none' }}><span className="rq-conf-badge">{confidence.score}%</span><span className="rq-conf-label">{confidence.readiness === 'review' ? 'Almost ready ▸' : 'Commonly missed items ▸'}</span></summary><div className="rq-conf-checks">{(confidence.checks || []).filter(c => c.state !== 'good').map((c, i) => <span key={i} className={`rq-conf-check ${c.state}`}>○ {c.label}</span>)}</div></details>))}
              </div>
            </div>

            {error && error !== '__needs_phone__' && <div className="jd-error">{error}</div>}
            {error === '__needs_phone__' && (<div className="jd-error" style={{ background: 'var(--brand-bg)', borderColor: 'var(--brand-line)', color: 'var(--text)' }}><div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 8 }}>Add a phone number to send via text</div><div style={{ display: 'flex', gap: 6 }}><input className="jd-input" type="tel" value={inlinePhone} onChange={e => setInlinePhone(e.target.value)} placeholder="e.g. (403) 555-0100" autoFocus style={{ flex: 1, fontSize: 'var(--text-md)', padding: '10px 12px' }} /><button className="btn btn-primary btn-sm" type="button" disabled={!inlinePhone.trim()} onClick={async () => { try { const cust = allCustomers.find(c => c.id === draft.customer_id); if (!cust) return; await updateCustomer(cust.id, { phone: inlinePhone.trim() }); setLocalCustomers(prev => prev.map(c => c.id === cust.id ? { ...c, phone: inlinePhone.trim() } : c)); invalidateCustomers(); setError(''); toast('Phone saved', 'success'); setTimeout(() => handleSend(), 100); } catch (e) { toast(friendly(e), 'error'); } }}>Save & send</button></div><button type="button" onClick={() => { setDeliveryMethod('copy'); setError(''); handleSend(); }} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 'var(--text-2xs)', marginTop: 6, cursor: 'pointer', fontFamily: 'inherit' }}>Or copy link instead →</button></div>)}

            {/* Sticky Footer */}
            <div className="rq-footer">
              <div className="rq-footer-left">
                <button className={`btn btn-secondary ${saveState === 'saved' ? 'btn-saved' : saveState === 'saving' ? 'btn-saving' : ''}`} type="button" disabled={saving || isLocked} onClick={() => save()}>{saving ? 'Saving…' : saveState === 'saved' ? '✓ Saved' : 'Save draft'}</button>
                {/* §6.1 — Subtle "Saved Ns ago" timestamp. Updates every 30s while visible. */}
                {lastSavedAt && (() => {
                  const diffS = Math.round((Date.now() - lastSavedAt.getTime()) / 1000);
                  const label = diffS < 5 ? 'just now' : diffS < 60 ? `${diffS}s ago` : `${Math.round(diffS / 60)}m ago`;
                  return <span className={`qb-save-ts${saveState === 'saving' ? ' qb-save-ts--faded' : ''}`}>Saved {label}</span>;
                })()}
                <button className="btn btn-secondary btn-sm rq-preview-btn" type="button" disabled={saving || isLocked} onClick={async () => { const q = await save(null, true); if (q?.share_token) { window.open('/public/' + q.share_token + '?preview=1', '_blank'); } else if (quoteId) { try { const ex = await getQuote(quoteId); if (ex?.share_token) window.open('/public/' + ex.share_token + '?preview=1', '_blank'); } catch (e) { console.warn("[PL]", e); } } }}>Preview</button>
              </div>
              <div id="qb-send-btn" className="rq-footer-right">
                <div className="rq-footer-total num-stable tabular" style={{ '--min-ch': '8ch' }} aria-live="polite">
                  {currency(grandTotal, country)}
                  {showFinancing(grandTotal) && <span className="rq-footer-monthly">or from {currency(estimateMonthly(grandTotal), country)}/mo</span>}
                </div>
                {itemCount === 0 ? (
                  <button className="btn btn-primary btn-lg" type="button" disabled style={{ opacity: 0.5 }}>Add items to send</button>
                ) : !draft.customer_id ? (
                  <button className="btn btn-primary btn-lg" type="button" disabled={sending || isLocked} onClick={() => { setDeliveryMethod('copy'); handleSend(); }}>{sending ? 'Sending…' : 'Copy Quote Link'}</button>
                ) : !selCustomer?.phone ? (
                  <button className="btn btn-primary btn-lg" type="button" disabled={sending || isLocked} onClick={() => { setDeliveryMethod('copy'); handleSend(); }}>{sending ? 'Sending…' : 'Send Quote →'}</button>
                ) : (
                  <button className="btn btn-primary btn-lg" type="button" disabled={sending || isLocked} onClick={handleSend}>{sending ? 'Sending…' : `Text to ${selCustomer?.name?.split(' ')[0] || 'customer'} →`}</button>
                )}
              </div>
            </div>

            {/* Send Modal */}
            {showSend && (
              <div className="qb-modal-bg" onClick={() => setShowSend(false)}>
                <div className="qb-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>

                  <div className="qb-modal-top">
                    <h3 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 800 }}>Send Quote</h3>
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowSend(false)} aria-label="Close">×</button>
                  </div>

                  <div className="rq-send-body">
                    {selCustomer && (
                      <div className="rq-send-to">
                        <span className="rq-send-label">To</span>
                        <span className="rq-send-value">
                          {selCustomer.name}{selCustomer.phone ? ` · ${selCustomer.phone}` : ''}
                        </span>
                      </div>
                    )}

                    <div className="rq-send-preview">
                      {lineItems.filter(i => i.name?.trim()).slice(0, 3).map(i => (
                        <div key={i.id} className="rq-send-item">
                          <span>{i.name}</span>
                          <span>{currency(Number(i.quantity || 0) * Number(i.unit_price || 0))}</span>
                        </div>
                      ))}
                      {lineItems.length > 3 && (
                        <div className="rq-send-more">+{lineItems.length - 3} more</div>
                      )}
                      <div className="rq-send-total">
                        <span>Total</span>
                        <span>
                          {currency(grandTotal, country)}
                          {showFinancing(grandTotal) && (
                            <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 600, color: 'var(--muted)', marginLeft: 4 }}>
                              or from {currency(estimateMonthly(grandTotal), country)}/mo
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <label className="jd-label" style={{ marginBottom: 6 }}>Send via</label>
                      <div className="rq-send-methods">
                        {[
                          { v: 'text',  l: 'Text message', icon: 'sms'  },
                          { v: 'email', l: 'Email',        icon: 'mail' },
                          { v: 'copy',  l: 'Copy link',    icon: 'link' },
                        ].map(o => (
                          <button
                            key={o.v}
                            type="button"
                            className={`rq-send-method ${deliveryMethod === o.v ? 'active' : ''}`}
                            onClick={() => setDeliveryMethod(o.v)}
                          >
                            {o.l}
                          </button>
                        ))}
                      </div>
                    </div>

                    {deliveryMethod === 'text' && (
                      <div style={{ marginTop: 12 }}>
                        <SmsComposerField
                          id="qb-sms-body"
                          label="Message"
                          value={smsBody}
                          onChange={setSmsBody}
                          rows={5}
                          showLinkHint={true}
                        />
                      </div>
                    )}
                    {deliveryMethod === 'email' && (
                      <div style={{ marginTop: 12, fontSize: 'var(--text-xs)', color: 'var(--text-2)', lineHeight: 1.5 }}>
                        A quote summary will be emailed to <strong>{selCustomer?.email || '—'}</strong>.
                        Your customer can review, approve, and sign from the link in the email.
                      </div>
                    )}
                    {deliveryMethod === 'copy' && (
                      <div style={{ marginTop: 12, fontSize: 'var(--text-xs)', color: 'var(--text-2)', lineHeight: 1.5 }}>
                        A shareable link will be copied to your clipboard.
                      </div>
                    )}
                  </div>

                  <div className="qb-modal-acts">
                    <button
                      className="btn btn-primary btn-lg rq-send-confirm-btn"
                      type="button"
                      disabled={sending || saving}
                      onClick={handleConfirmSend}
                      style={{ flex: 1 }}
                    >
                      {sending ? 'Sending…'
                        : saving ? 'Saving…'
                        : deliveryMethod === 'text'  ? `Text ${currency(grandTotal, country)} Quote`
                        : deliveryMethod === 'email' ? `Email ${currency(grandTotal, country)} Quote`
                        : 'Copy Quote Link'}
                    </button>
                  </div>

                  {deliveryMethod === 'text' && (
                    <p className="pl-sender-reassurance" style={{ marginTop: 8 }}>
                      This goes out as your message. Your customer can review, approve, and sign
                      from their phone — you'll see the moment they open it.
                    </p>
                  )}
                </div>
              </div>
            )}
            {/* C3: SMS confirm card — shown after native SMS app opens, awaiting user confirmation */}
            {smsConfirmPending && (
              <div className="qb-modal-bg">
                <div className="qb-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380, textAlign: 'center' }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: 'var(--text-xl)', fontWeight: 800 }}>
                    Did you send it?
                  </h3>
                  <p style={{ margin: '0 0 20px', fontSize: 'var(--text-base)', color: 'var(--muted)', lineHeight: 1.5 }}>
                    We opened your Messages app. Tap "Yes, sent" once you've sent the quote
                    to {smsConfirmPending.firstName || smsConfirmPending.phone}.
                  </p>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <button className="btn btn-secondary btn-lg" type="button" style={{ flex: 1 }} onClick={handleSmsCancel}>
                      No, cancel
                    </button>
                    <button className="btn btn-primary btn-lg" type="button" style={{ flex: 1 }} onClick={handleSmsConfirm}>
                      Yes, sent ✓
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════ SENT SUCCESS ════════ */}
        {phase === 'sent' && (() => {
          const isFirst = (() => { try { return localStorage.getItem('pl_has_sent_quote_first') !== '1'; } catch { return false; } })();
          try { localStorage.setItem('pl_has_sent_quote_first', '1'); } catch (e) { console.warn("[PL]", e); }
          const custName = selCustomer?.name || 'Your customer';
          const firstName = custName.split(' ')[0];
          const mo = showFinancing(grandTotal) ? estimateMonthly(grandTotal) : null;
          return (
            <div className={`rq-sent-banner${isFirst ? ' rq-sent-first' : ''}`} style={isFirst ? { background: 'var(--green-bg)', borderColor: 'var(--green-line)' } : undefined}>
              {isFirst && (
                /* B8 (Slice 12): CSS-only confetti burst, first-send only */
                <div className="rq-sent-confetti" aria-hidden="true">
                  <span /><span /><span /><span /><span /><span /><span /><span />
                </div>
              )}
              {isFirst ? (
                <div style={{ textAlign: 'center', padding: '8px 0 4px' }}><div className="rq-sent-emoji" style={{ fontSize: 'var(--text-5xl)', marginBottom: 6 }}>🎉</div><div style={{ fontWeight: 800, fontSize: 'var(--text-2xl)', color: 'var(--text)', letterSpacing: '-.03em' }}>Quote sent — {currency(grandTotal, country)}</div>{mo && <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-2)', marginTop: 4 }}>{firstName} will see {currency(grandTotal, country)} or as low as {currency(mo, country)}/mo</div>}<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(19,138,91,.08)' }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 2s ease-in-out infinite' }} /><span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--green)' }}>You'll get notified the moment {firstName} opens it</span></div>
                <div className="rq-sent-steps">
                  <div className="rq-sent-step"><span className="rq-sent-step-num">1</span><span>{firstName} gets your quote via text</span></div>
                  <div className="rq-sent-step"><span className="rq-sent-step-num">2</span><span>You see when they open it</span></div>
                  <div className="rq-sent-step"><span className="rq-sent-step-num">3</span><span>They approve and you get paid</span></div>
                </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '6px 0 2px' }}><div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--green)', marginBottom: 2 }}>✓ Quote sent to {firstName}</div><div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>{currency(grandTotal, country)}{mo ? ` · ${firstName} sees options from ${currency(mo, country)}/mo` : ''}</div></div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: isFirst ? 14 : 10, flexWrap: 'wrap' }}>
                {quoteId && <button className="btn btn-primary btn-sm" type="button" onClick={() => nav(`/app/quotes/${quoteId}`)}>View quote →</button>}
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => { setQuoteId(null); setPhase('describe'); setDescription(''); setTitle(''); setLineItems([]); setDraft(d => ({ ...d, customer_id: '', scope_summary: '', title: '', description: '' })); setSentSuccess(false); titleSuggested.current = false; nav('/app/quotes/new', { replace: true }); }}>+ New quote</button>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => nav('/app')}>Dashboard</button>
              </div>
              {/* Push notification nudge — only on first send, only if not already subscribed */}
              {isFirst && 'PushManager' in window && Notification?.permission === 'default' && (
                <button type="button" className="rq-push-nudge" onClick={async () => {
                  try {
                    const perm = await Notification.requestPermission();
                    if (perm !== 'granted') return;
                    const reg = await navigator.serviceWorker.ready;
                    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
                    if (!vapidKey) return;
                    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey });
                    const { data: { session: pushSession } } = await supabase.auth.getSession();
                    await fetch('/api/push-subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(pushSession?.access_token ? { Authorization: `Bearer ${pushSession.access_token}` } : {}) }, body: JSON.stringify({ user_id: user?.id, subscription: sub.toJSON() }) });
                    toast('Notifications enabled', 'success');
                  } catch { }
                }}>
                  <span style={{ display:"inline-flex", color:"var(--brand)" }}><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></span>
                  <span>Get notified when {firstName} opens this — enable push notifications</span>
                </button>
              )}
            </div>
          );
        })()}
        </div>
      </Section>

      <ConfirmModal open={zeroItemConfirm !== null} onConfirm={proceedToSend} onCancel={() => setZeroItemConfirm(null)} title="Items with $0 pricing" message={`${zeroItemConfirm || 0} item${(zeroItemConfirm || 0) > 1 ? 's have' : ' has'} $0 pricing. Send anyway?`} confirmLabel="Send Anyway" cancelLabel="Cancel" />

      {/* Slice 9 B11: Coachmarks — only shown during review phase */}
      {phase === 'review' && <QbCoachmarks />}

      {/* Slice 9 B12: Keyboard shortcut help overlay */}
      {showKbdHelp && (
        <div className="qb-kbd-overlay-bg" onClick={() => setShowKbdHelp(false)}>
          <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" className="qb-kbd-overlay" onClick={e => e.stopPropagation()}>
            <div className="qb-kbd-overlay-head">
              <span className="qb-kbd-overlay-title">Keyboard shortcuts</span>
              <button type="button" className="qb-kbd-overlay-close" onClick={() => setShowKbdHelp(false)} aria-label="Close">×</button>
            </div>
            <table className="qb-kbd-table">
              <tbody>
                <tr><td>⌘K / Ctrl+K</td><td>Focus customer search</td></tr>
                <tr><td>⌘↵ / Ctrl+Enter</td><td>Build quote (describe) or Send (review)</td></tr>
                <tr><td>?</td><td>Toggle this help overlay</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  );
}
