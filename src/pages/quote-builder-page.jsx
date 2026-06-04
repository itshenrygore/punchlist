import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/app-shell';
import ConfirmModal from '../components/confirm-modal';
import UpgradePrompt from '../components/upgrade-prompt';
// REMOVED in 2.0: QbCoachmarks
import { useCustomers, searchCustomers, invalidateCustomers } from '../hooks/use-customers';
import { requestAiScope, getWonQuoteContext, getProfile, getQuote, updateQuote, createQuote, createCustomer, updateCustomer, listQuotes, uploadQuotePhoto, getQuotingDefaults, findCustomerByContact, sendQuoteEmail, getFrequentLineItems } from '../lib/api';
import { useAuth } from '../hooks/use-auth';
import { supabase } from '../lib/supabase';
import { useUnsavedChanges } from '../hooks/use-unsaved-changes';
import { useToast } from '../components/toast';
import { currency, friendly } from '../lib/format';
import { calculateTotals, buildConfidence } from '../lib/pricing';
import { makeId, genLineItemId } from '../lib/utils';
import { TRADES, regionalize, normalizeTrade, anchorPrice, inferTrade } from '../../shared/tradeBrain';
import { browseCatalog, searchCatalog } from '../../shared/systemCatalog';
import { getSmartSuggestions, smartSearch } from '../../shared/smartCatalog';
import { extractJobContext } from '../../shared/jobContext';
import { detectJob, runScopeCheck } from '../../shared/checkScope';
import { isPro, countSentThisMonth, canSendQuote } from '../lib/billing';
import { isQuoteLocked } from '../lib/workflow';
import { saveOfflineDraft, getOfflineDraft, deleteOfflineDraft, isNetworkError, isOnline } from '../lib/offline';
import { smsNotify } from '../lib/sms';
import useScrollLock from '../hooks/use-scroll-lock';
import { CA_PROVINCES, US_STATES } from '../lib/pricing';
import { ChevronRight, X } from 'lucide-react';
import { estimateMonthly, showFinancing } from '../lib/financing';
import { identify, trackFirstDescribe, trackFirstBuild, trackFirstSend, trackQuoteSent, trackPushEnabled, getVariant, trackQuoteFlowStarted, setQuoteFlowQuoteId, trackQuoteFlowCustomerSelected, trackQuoteFlowDescriptionCommitted, trackQuoteFlowScopeReady, trackQuoteFlowSent, trackQuoteFlowAbandoned, endQuoteFlowSession, hasActiveFlowSession, restoreFlowSession } from '../lib/analytics';
import { Card, Section, Stat } from '../components/ui';
import { QuoteItemsEditor } from '../components/quote-editor';
import MobileQuoteReview from '../components/mobile-quote-review';
import FinancingStep from '../components/quote-builder/financing-step';
import { DUR, isReducedMotion } from '../lib/motion';
import { listTemplates, renderTemplate, getSystemDefaults } from '../lib/api/templates';
import { saveJobTemplate, listJobTemplates } from '../lib/api/job-templates';
import { useForeman } from '../contexts/foreman-context';

/* ═══════════════════════════════════════════════════════════
   QuoteBuilderPage — Unified one-page quote creation.
   Merges JobDetails + BuildScope + ReviewQuote into one flow.
   Phase: describe → building → review → sending → sent
   ═══════════════════════════════════════════════════════════ */

// ── Smart title generator (from job-details-page) ──
function generateTitle(desc, trade) {
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
  const words = text.split(/\s+/).slice(0, 5).join(' ');
  if (trade && trade !== 'Other' && words.length > 30) return _tc(`${trade} — ${words.slice(0, 30)}`);
  return _tc(words);
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
  return { id: genLineItemId(), name, category: cat, tab: classifyItem(name, cat), unit_price: mid, quantity: Math.max(1, Number(raw.quantity || 1)), typical_low: lo, typical_high: hi, why: raw.why || raw.reason || '', when_needed: raw.when || '', when_not_needed: raw.skip || '', notes: raw.pricing_basis || '', confidence, tier, source: raw.source_label || 'Based on similar jobs', selected: tier === 'optional' ? false : confidence !== 'low' };
}

// ── Smart catalog fallback (from build-scope-page) ──
function smartCatalogFallback(ctx, province) {
  const result = getSmartSuggestions({ description: ctx.description || '', title: ctx.title || '', trade: ctx.trade || 'Other', province: province || 'AB' });
  const hasDispatch = [...result.core, ...result.related].some(i => /dispatch|diagnostic|service call/i.test(i.name));
  if (!hasDispatch && result.core.length > 0) {
    const dp = { Plumber: { lo: 90, hi: 120, mid: 105 }, Electrician: { lo: 90, hi: 110, mid: 100 }, HVAC: { lo: 120, hi: 150, mid: 135 }, 'General Contractor': { lo: 60, hi: 80, mid: 70 } };
    const d = dp[ctx.trade] || { lo: 90, hi: 130, mid: 110 };
    result.related.unshift({ id: genLineItemId(), name: 'Dispatch / diagnostic', desc: 'Service call, travel, initial assessment', category: 'Services', lo: d.lo, hi: d.hi, mid: d.mid, score: 999, tier: 'related', reason: 'Standard on every job', why: 'Covers travel, site assessment, and initial diagnosis', pricing_basis: 'Market rate from contractor data' });
  }
  return result;
}

// ── Scope hints per trade ──
const SCOPE_HINTS = { Plumber: ['Disposal fees', 'Shut-off valve replacement', 'Permit', 'Patch/repair after access', 'Cleanup'], Electrician: ['Permit & inspection', 'Panel labelling', 'Patching/repair', 'Disposal', 'GFCI/AFCI upgrades'], HVAC: ['Duct modification', 'Electrical hookup', 'Permit', 'Refrigerant handling', 'Thermostat wiring'], General: ['Disposal', 'Cleanup', 'Permit', 'Material delivery', 'Touch-up / patching'], Carpenter: ['Hardware/fasteners', 'Finishing/stain', 'Disposal', 'Touch-up paint', 'Delivery'], Painter: ['Surface prep', 'Primer coat', 'Caulking', 'Furniture moving', 'Drop cloths/protection'], Roofing: ['Permit', 'Disposal/dump fees', 'Flashing', 'Ice & water shield', 'Ventilation'], Other: ['Disposal / cleanup', 'Materials allowance', 'Permit if required', 'Site protection', 'Final inspection'] };

// ── Placeholders ──
const DESC_PLACEHOLDERS = { Plumber: 'Replace 50-gallon hot water tank in utility room. Drain, disconnect, and haul away old tank.', Electrician: 'Upgrade 100A panel to 200A service and reconnect existing circuits.', HVAC: 'Replace furnace with high-efficiency unit. Install new smart thermostat.', 'General Contractor': 'Frame basement mechanical room and patch surrounding drywall.', Roofing: 'Replace damaged shingles around vent stack and inspect flashing.', Painter: 'Prep and paint main floor walls. Patch minor nail holes, sand, prime.', Carpenter: 'Install baseboard and door casing trim throughout main floor.', Other: 'Describe the job — include the location, what needs to be done, and any relevant details.' };

/* ══════════════════════════════════════════════════════════ */
export default function QuoteBuilderPage() {
  const { user } = useAuth();
  const { quoteId: existingQuoteId } = useParams();
  const location = useLocation();
  const nav = useNavigate();
  const { show: toast, showUndo } = useToast();
  const { setQuoteContext, setAddItemHandler } = useForeman();
  const fileRef = useRef(null);

  // ── Phase state: describe | building | review | sending | sent ──
  const [phase, setPhase] = useState(existingQuoteId ? 'review' : 'describe');
  const [quoteId, setQuoteId] = useState(existingQuoteId || null);

  // ── Zone 1: Job Description ──
  const shareText = (() => {
    const p = new URLSearchParams(location.search);
    return [p.get('title'), p.get('text'), p.get('url')].filter(Boolean).join('\n');
  })();
  const [description, setDescription] = useState(location.state?.prefill || shareText || '');
  const [title, setTitle] = useState('');
  const [trade, setTrade] = useState('Other');
  const [province, setProvince] = useState('AB');
  const [country, setCountry] = useState('CA');
  const [photo, setPhoto] = useState(null);
  const titleSuggested = useRef(false);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

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
  const [frequentItems, setFrequentItems] = useState([]);
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
  // CatalogSheet in QuoteItemsEditor handles its own scroll lock
  const [sentSuccess, setSentSuccess] = useState(false);
  // Ref to the undo-cancel fn returned by showUndo (used to imperatively cancel on unmount)
  const undoCancelRef = useRef(null);

  // ── Shared state ──
  const [saving, setSaving] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showTemplateName, setShowTemplateName] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const [jobTemplates, setJobTemplates] = useState([]);
  const [showTemplatesPicker, setShowTemplatesPicker] = useState(false);
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
  const labourRate = Number(userProfile?.default_labour_rate || 0);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description, trade]);

  // ── Load profile + customers + existing quote ──
  useEffect(() => {
    if (!user) return;
    const profileP = getProfile(user.id);
    // Smart defaults: mode of last 5 non-draft quotes. Phase 3.5 backend slice.
    // Resolves to null for users with no history, in which case existing
    // profile/hardcoded fallbacks are used unchanged.
    const defaultsP = getQuotingDefaults(user.id).catch(() => null);
    getFrequentLineItems(user.id).then(fi => setFrequentItems(fi)).catch(() => {});
    listJobTemplates(user.id).then(t => setJobTemplates(t || [])).catch(() => {});
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
        // Check if navigated here from a job template (templates page sets sessionStorage)
        const fromTemplate = new URLSearchParams(location.search).get('from_template');
        const tmplKey = `pl_template_items_${existingQuoteId}`;
        if (fromTemplate && q.line_items?.length === 0) {
          try {
            const stored = sessionStorage.getItem(tmplKey);
            if (stored) {
              const tmplItems = JSON.parse(stored);
              sessionStorage.removeItem(tmplKey);
              setLineItems(tmplItems.map(i => ({ id: genLineItemId(), name: i.name || '', quantity: Number(i.quantity || 1), unit_price: Number(i.unit_price || 0), notes: i.notes || '', included: true, category: i.category || '' })));
              toast('Quote pre-filled from template', 'info');
            } else {
              setLineItems([]);
            }
          } catch (e) {
            setLineItems([]);
          }
        } else {
          setLineItems((q.line_items || []).map(i => ({ id: i.id || makeId(), name: i.name, quantity: Number(i.quantity || 1), unit_price: Number(i.unit_price || 0), notes: i.notes || '', included: i.included !== false, category: i.category || '' })));
        }
        initialLoadComplete.current = true;
        setPhase(fromTemplate ? 'building' : 'review');
        // Offline draft restore
        getOfflineDraft(existingQuoteId).then(od => {
          if (!od) return;
          if (new Date(od.savedAt || 0).getTime() > new Date(q.updated_at || 0).getTime()) {
            if (od.title !== undefined) setDraft(d => ({ ...d, ...od }));
            if (Array.isArray(od.line_items)) setLineItems(od.line_items.map(i => ({ id: i.id || makeId(), name: i.name, quantity: Number(i.quantity || 1), unit_price: Number(i.unit_price || 0), notes: i.notes || '', included: i.included !== false, category: i.category || '' })));
            setOfflineDraft(true); toast('Restored offline draft', 'info');
          }
        }).catch(e => console.warn('[PL]', e));
      }).catch(e => {
        toast(friendly(e) || 'Could not load quote', 'error');
        nav('/app/quotes', { replace: true });
      });
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

    // Pre-select customer when navigating from /app/customers → New quote
    if (!existingQuoteId && location.state?.customer) {
      const c = location.state.customer;
      if (c?.id) { setDraft(d => ({ ...d, customer_id: c.id })); setCustomerSearch(c.name || ''); }
    }

    // Demo carry-through from landing page
    if (!existingQuoteId) {
      try { const d = JSON.parse(sessionStorage.getItem('pl_demo_quote') || 'null'); if (d?.description) { setDescription(d.description); if (d.trade) setTrade(d.trade); sessionStorage.removeItem('pl_demo_quote'); } } catch (e) { console.warn("[PL]", e); }
      const demoDesc = new URLSearchParams(location.search).get('demo');
      const demoTrade = new URLSearchParams(location.search).get('trade');
      if (demoDesc) setDescription(demoDesc);
      if (demoTrade) setTrade(demoTrade);
      // Removed sample pre-fill — too easy to accidentally send
    }
  }, [user, existingQuoteId]);

  // ── Zone 1: Build scope — catalog-first, AI-enhanced ──
  //
  // OLD FLOW: 15-25s blocking loading screen that called Claude.
  //   When the AI endpoint was flaky (~10% of the time on prod) the
  //   contractor saw "AI couldn't generate items" and felt the tool
  //   was broken. That single failure mode killed activation.
  //
  // NEW FLOW: the catalog runs client-side in <50ms and produces the
  //   initial suggestions. The contractor sees their scope right away
  //   and starts working. The Claude call still fires in the
  //   background — when it returns, we merge any items the catalog
  //   missed and silently upgrade pricing context. If the AI call
  //   fails, nothing happens: the contractor already has their
  //   catalog matches and never sees an error.
  async function handleBuildScope() {
    if (!description.trim()) { setError('Describe the job first'); return; }
    // Force inferTrade to evaluate the description (passing the
    // currently-selected trade short-circuits the helper). If the
    // description clearly implies a different trade than the
    // contractor's default profile trade, prefer the inferred one
    // for this job — otherwise scope suggestions will come back
    // from the wrong trade catalog (e.g. landscaping items returned
    // for a "replace water heater" description because the profile
    // default was Landscaping).
    const inferredFromText = inferTrade(description, null);
    const useInferred = inferredFromText && inferredFromText !== 'Other' && inferredFromText !== trade;
    const inferred = useInferred ? inferredFromText : trade;
    if (inferred !== trade) setTrade(inferred);
    setError('');
    setPhase('building');
    try { localStorage.setItem('pl_has_built_quote', '1'); } catch (e) { console.warn("[PL]", e); }
    trackFirstBuild();
    setScopeLoading(true);
    setScopeLoadingMsg('Pulling suggestions from catalog…');

    try {
      // Create or update draft
      let draftId = quoteId;
      if (!draftId) {
        if (!isOnline()) {
          const offId = `offline-${Date.now()}`;
          await saveOfflineDraft({ id: offId, _ownerUserId: user?.id || null, title: title || description.slice(0, 64), description, trade: inferred, province, country, customer_id: draft.customer_id || null, status: 'draft', line_items: [] });
          setOfflineDraft(true);
          toast('Saved offline — will sync when connected', 'info');
          setPhase('describe'); setScopeLoading(false);
          return;
        }
        // Dedup: when the contractor describes the same job and clicks
        // "Build the scope" a second time within the last hour without
        // adding any items, reuse the empty draft instead of creating a
        // new one. Otherwise the Quotes list fills with
        // "50 Gallon Hot Water Tank Replacement" rows that all have no
        // customer + no items + nothing distinguishing them.
        const reusedDraft = await (async () => {
          try {
            const recent = await listQuotes(user.id);
            const cutoff = Date.now() - 60 * 60 * 1000;
            const desc = description.trim().slice(0, 80).toLowerCase();
            return (recent || []).find(q =>
              q.status === 'draft' &&
              !q.customer_id &&
              (!q.line_items || q.line_items.length === 0) &&
              new Date(q.updated_at || q.created_at).getTime() >= cutoff &&
              ((q.description || '').trim().slice(0, 80).toLowerCase() === desc ||
               (q.title || '').trim().toLowerCase() === (title || description.slice(0, 64)).trim().toLowerCase())
            );
          } catch { return null; }
        })();
        if (reusedDraft) {
          await updateQuote(reusedDraft.id, { title: title || description.slice(0, 64), description, trade: inferred, province, country });
          draftId = reusedDraft.id;
        } else {
          const d = await createQuote(user.id, { title: title || description.slice(0, 64), description, trade: inferred, province, country, customer_id: draft.customer_id || null, status: 'draft', line_items: [] });
          draftId = d.id;
        }
        setQuoteId(draftId);
        setQuoteFlowQuoteId(draftId);
        nav(`/app/quotes/${draftId}/edit`, { replace: true });
      } else {
        await updateQuote(draftId, { title: title || description.slice(0, 64), description, trade: inferred, province, country });
      }

      // ── Catalog suggestions — instant, deterministic, always works ──
      const cat = smartCatalogFallback({ description, title, trade: inferred }, province);
      const catItems = [...cat.core, ...cat.related, ...cat.optional];
      const catalogSuggestions = catItems.map(item => ({
        ...normSuggestion(item, 0),
        selected: false,
        source: 'catalog',
      }));

      setSuggestions(catalogSuggestions);
      setLineItems([]);
      setDraft(d => ({ ...d, title: title || description.slice(0, 64), description }));
      initialLoadComplete.current = true;
      setPhase('review');
      setScopeLoading(false);

      if (catalogSuggestions.length === 0) {
        toast('Add items from the catalog or create custom line items.', 'info');
      } else {
        toast(`${catalogSuggestions.length} suggested item${catalogSuggestions.length === 1 ? '' : 's'} ready — review and add what you want`, 'success');
      }

      // ── Trade-mismatch hint ──
      // The engine flags when the selected trade clearly doesn't match what
      // the description describes (e.g. Electrician selected, "water heater
      // replacement" written). Offer a one-tap fix instead of letting the
      // contractor wonder why the suggestions look thin.
      if (cat.tradeMismatch && cat.tradeMismatch.suggested !== inferred) {
        const { selected, suggested } = cat.tradeMismatch;
        toast(`Looks like a ${suggested} job, not ${selected} — switch trade?`, 'info', {
          label: 'Switch',
          onClick: () => {
            setTrade(suggested);
            // Persist the corrected trade so when the contractor scrolls
            // back or re-opens this draft the suggestions stay aligned.
            if (draftId) updateQuote(draftId, { trade: suggested }).catch(e => console.warn('[PL]', e));
          },
        });
      }

      // ── Photo upload (background) ──
      if (photo) {
        uploadQuotePhoto(draftId, photo).then(({ url }) => {
          updateQuote(draftId, { photo_url: url }).catch(() => {});
          setPhotoSaved(true);
        }).catch(e => console.warn('[Punchlist] Photo upload failed:', e?.message));
      }

      // ── AI enhancement (background, non-blocking) ──
      // Fire-and-forget: if Claude is up, we'll merge its items in
      // when it returns. If it's down or rate-limited, we never tell
      // the contractor — they already have a working scope.
      enhanceWithAI(draftId, inferred);
    } catch (e) {
      console.error('[Punchlist] Build failed:', e.message);
      initialLoadComplete.current = true;
      setPhase('review');
      setScopeLoading(false);
      toast(e.message?.includes('network') ? 'Network issue — try again when you\'re back online.' : 'Could not start the quote. Try again.', 'error');
    }
  }

  /**
   * Background Claude call. Merges new items into the suggestions panel
   * on success; silent failure otherwise.
   */
  async function enhanceWithAI(draftId, resolvedTrade) {
    try {
      let wonContext = [], labourRate = 0;
      try {
        const [wc, p] = await Promise.all([
          getWonQuoteContext(null, 5),
          userProfile ? Promise.resolve(userProfile) : getProfile(user.id),
        ]);
        wonContext = wc || [];
        labourRate = Number(p?.default_labour_rate || 0);
      } catch (e) { console.warn('[PL]', e); }

      let photoBase64 = null;
      if (photo) {
        try {
          photoBase64 = await new Promise((res, rej) => {
            const rd = new FileReader();
            rd.onload = () => res(rd.result.split(',')[1]);
            rd.onerror = rej;
            rd.readAsDataURL(photo);
          });
        } catch (e) { console.warn('[PL]', e); }
      }

      const scopePromise =
        (aiPreWarmRef.current.promise && aiPreWarmRef.current.forDescription === description)
          ? aiPreWarmRef.current.promise
          : requestAiScope({ description, trade: resolvedTrade, estimatorRoute: 'balanced', province, country, photo: photoBase64, wonQuotes: wonContext, labourRate });
      aiPreWarmRef.current = { promise: null, controller: null, forDescription: '' };

      const r = await scopePromise;

      // Endpoint may return source=none/error with empty items — treat
      // as a silent no-op since the contractor already has catalog
      // suggestions in place.
      if (!r || r.source !== 'ai' || !(r.items && r.items.length)) {
        console.warn('[Punchlist] AI enhancement unavailable —', r?.source || 'no response');
        return;
      }

      const aiItems = r.items.map((it, i) => normSuggestion(it, i)).map(s => ({ ...s, selected: false, source: 'ai' }));
      const aiUpgrades = (r.optional_upgrades || []).map((u, i) => ({
        id: genLineItemId(),
        name: u.description || '',
        category: u.category || 'Services',
        tab: classifyItem(u.description || '', u.category || ''),
        unit_price: Number(u.unit_price || 0),
        why: u.why || '',
        selected: false,
        isUpgrade: true,
        source: 'ai',
      }));

      // Merge: AI items first (they have richer pricing context),
      // dedup by normalized name. Catalog items the contractor already
      // sees stay in place if AI didn't return them.
      const beforeCount = (await new Promise(resolve => {
        setSuggestions(prev => {
          const seen = new Map();
          [...aiItems, ...aiUpgrades, ...prev].forEach(s => {
            const key = (s.name || '').toLowerCase().trim();
            if (key && !seen.has(key)) seen.set(key, s);
          });
          const merged = [...seen.values()];
          resolve(prev.length);
          return merged;
        });
      }));

      const newItemsCount = (aiItems.length + aiUpgrades.length) - 0; // best-effort, dedup runs in setter
      if (newItemsCount > 0) {
        toast(`Found ${aiItems.length} more suggestion${aiItems.length === 1 ? '' : 's'} for you to review`, 'success');
      }
      void beforeCount; // silence unused

      // Persist scope metadata from AI (assumptions, exclusions)
      if (r.scope_summary || r.assumptions?.length || r.exclusions?.length) {
        const meta = {
          scope_summary: r.scope_summary || '',
          assumptions: (r.assumptions || []).join('\n'),
          exclusions: (r.exclusions || []).join('\n'),
        };
        setScopeMeta(meta);
        setDraft(d => ({
          ...d,
          scope_summary: meta.scope_summary || d.scope_summary,
          assumptions: meta.assumptions || d.assumptions,
          exclusions: meta.exclusions || d.exclusions,
        }));
        updateQuote(draftId, meta).catch(e => console.warn('[PL] persist scope meta:', e?.message));
      }

      setScopeGaps(r.gaps || []);
    } catch (e) {
      // Silent — contractor already has catalog suggestions.
      console.warn('[Punchlist] AI enhancement failed silently:', e?.message);
    }
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
  function duplicateItem(id) { const o = lineItems.find(i => i.id === id); if (!o) return; setLineItems(p => { const idx = p.findIndex(i => i.id === id); const n = [...p]; n.splice(idx + 1, 0, { ...o, id: genLineItemId() }); return n; }); markDirty(); }
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
    setLineItems(p => [...p, { id: genLineItemId(), name: sug.name, quantity: Number(sug.quantity || 1), unit_price: Number(sug.unit_price || 0), notes: '', category: sug.category || '', included: true }]);
    setDismissedSugIds(prev => { const n = new Set(prev); n.add(sug.id); return n; });
    markDirty();
    toast(`Added: ${sug.name}`, 'success');
  }
  /** Batched accept for the panel's "Add all" button — one state
   *  update, one toast. Avoids 10 stacked notifications when the user
   *  takes the entire suggested scope. */
  function addAllSuggestionsToItems(sugs) {
    const existingNames = new Set(lineItems.map(li => (li.name || '').toLowerCase().trim()));
    const fresh = (sugs || []).filter(s => !existingNames.has((s.name || '').toLowerCase().trim()));
    if (fresh.length === 0) return;
    setLineItems(p => [
      ...p,
      ...fresh.map(sug => ({
        id: genLineItemId(),
        name: sug.name,
        quantity: Number(sug.quantity || 1),
        unit_price: Number(sug.unit_price || 0),
        notes: '',
        category: sug.category || '',
        included: true,
      })),
    ]);
    setDismissedSugIds(prev => {
      const n = new Set(prev);
      for (const s of sugs || []) n.add(s.id);
      return n;
    });
    markDirty();
    toast(`Added ${fresh.length} item${fresh.length === 1 ? '' : 's'} to your scope`, 'success');
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

  // ── Catalog search (feeds QuoteItemsEditor's CatalogSheet via props) ──
  const jobCtx = useMemo(() => extractJobContext([draft.title, description].filter(Boolean).join('. '), trade), [draft.title, description, trade]);
  useEffect(() => {
    if (!catalogQuery || catalogQuery.length < 2) { clearTimeout(catalogDebounceRef.current); setCatalogResults(browseCatalog(trade, 30).map(hit => { const adj = regionalize(hit, province); const a = anchorPrice(adj.lo || hit.lo, adj.hi || hit.hi, normalizeTrade(trade), hit.c); return { id: `cat_${makeId()}`, name: hit.n, desc: hit.d || '', category: hit.c || '', lo: a.lo, hi: a.hi, mid: a.mid }; })); return; }
    clearTimeout(catalogDebounceRef.current);
    catalogDebounceRef.current = setTimeout(() => {
      const ctx = extractJobContext([draft.title, description].filter(Boolean).join('. '), trade);
      const hits = smartSearch(catalogQuery, ctx, province, 20).map(hit => ({ id: `cs_${makeId()}`, name: hit.name, desc: hit.desc || '', category: hit.category || '', lo: hit.lo || 0, hi: hit.hi || 0, mid: hit.mid || 0, isContextRelevant: hit.isContextRelevant }));
      setCatalogResults(hits);
    }, 200);
  }, [catalogQuery, trade, province]);

  function addCatalogItem(item) {
    if (lineItems.some(li => li.name.toLowerCase() === item.name.toLowerCase())) return;
    const lo = item.lo || 0, hi = item.hi || 0;
    const isLabour = classifyItem(item.name, item.category) === 'labour';
    const price = isLabour && labourRate > 0
      ? labourRate
      : hi > lo ? Math.round(lo + (hi - lo) * 0.55) : (item.mid || 0);
    setLineItems(p => [...p, { id: genLineItemId(), name: item.name, quantity: 1, unit_price: price, notes: '', category: item.category || '', included: true }]);
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
  const confidence = useMemo(() => buildConfidence(lineItems, [], {
    hasCustomer: !!draft.customer_id,
    hasScope: !!draft.scope_summary,
    hasDeposit: !draft.deposit_required || draft.deposit_status === 'paid',
    revisionSummary: draft.revision_summary,
    // Wired to the new context-aware missed-items engine — the same
    // OBJECTS taxonomy the suggestion engine uses, so 'Cleanup not
    // listed' on every job becomes 'Expansion tank not listed' /
    // 'Permit not listed' / 'AFCI breaker not listed' — items
    // actually relevant to what's already in the quote.
    description,
    trade,
    province,
  }), [lineItems, draft, description, trade, province]);

  // ── Foreman context: tell the AI about the active quote ──
  useEffect(() => {
    if (phase === 'review' || phase === 'building') {
      setQuoteContext({
        title: title || '',
        description: description || '',
        trade,
        province,
        items: lineItems.filter(i => i.name?.trim()).map(i => ({ name: i.name, qty: i.quantity, price: i.unit_price })),
        total: grandTotal,
      });
      setAddItemHandler(() => (item) => {
        setLineItems(prev => [...prev, {
          id: genLineItemId(),
          name: item.name,
          quantity: 1,
          unit_price: item.unit_price || 0,
          notes: '',
          category: '',
          included: true,
        }]);
        markDirty();
      });
    }
    return () => { setQuoteContext(null); setAddItemHandler(null); };
  }, [phase, title, description, trade, province, lineItems.length, grandTotal]);

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
        clearDirty(); setSaveState('saved'); setLastSavedAt(new Date()); setTimeout(() => setSaveState(''), 5000);
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
          try { await saveOfflineDraft({ ...draft, _ownerUserId: user?.id || null, title, description, line_items: lineItems, trade, province, country, id: quoteId, savedAt: new Date().toISOString() }); setOfflineDraft(true); setSaveState(''); if (!silent) toast("Saved offline — will sync when online", 'info'); return null; } catch (e) { console.warn("[PL]", e); }
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

  // Flush on UNMOUNT — covers SPA navigation that visibilitychange and
  // pagehide miss. Without this, a user who:
  //   1. adds items to a quote
  //   2. taps a nav link before the 800ms autosave debounce fires
  //   3. confirms "Leave anyway?" on the unsaved-changes prompt
  // …would have their additions cancelled by the autosave useEffect's
  // cleanup (clearTimeout) and never persisted. The flushRef pattern
  // keeps the latest save closure available to a single one-shot
  // cleanup effect.
  const flushOnUnmountRef = useRef(null);
  flushOnUnmountRef.current = () => {
    if (
      dirty.current &&
      !savingRef.current &&
      !isLocked &&
      initialLoadComplete.current &&
      quoteId &&
      lineItems.length > 0
    ) {
      // Fire-and-forget; the component is unmounting so we can't await.
      // The save() call goes through the same updateQuote upsert path
      // as a normal autosave — race-safe via the save mutex.
      try { save(null, true); } catch (e) { console.warn('[PL] flush on unmount failed:', e); }
    }
  };
  useEffect(() => () => flushOnUnmountRef.current?.(), []);

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
  const [phoneDupMatch, setPhoneDupMatch] = useState(null); // { existing, newCust }
  async function handleQuickCreateCustomer(forceCreate = false) {
    if (!newCust.name.trim()) return;
    if (!newCust.phone.trim() && !newCust.email.trim()) return setError('Add a phone number or email — we need at least one to send the quote.');
    try {
      // M7: dup-check by phone/email before creating — but allow override
      if (!forceCreate) {
        const existing = await findCustomerByContact(user.id, { phone: newCust.phone, email: newCust.email });
        if (existing) {
          setPhoneDupMatch({ existing, newCust: { ...newCust } });
          return;
        }
      }
      const c = await createCustomer(user.id, newCust);
      invalidateCustomers();
      setLocalCustomers(p => [...p, c]);
      ud('customer_id', c.id);
      trackQuoteFlowCustomerSelected(c.id);
      setShowNewCust(false);
      setNewCust({ name: '', email: '', phone: '', address: '' });
      setCustomerSearch('');
      setPhoneDupMatch(null);
      toast('Contact saved', 'success');
    } catch (e) { setError(friendly(e)); }
  }
  function handleUseExistingContact() {
    if (!phoneDupMatch) return;
    const { existing } = phoneDupMatch;
    if (!allCustomers.some(c => c.id === existing.id)) setLocalCustomers(p => [...p, existing]);
    ud('customer_id', existing.id);
    trackQuoteFlowCustomerSelected(existing.id);
    setShowNewCust(false);
    setNewCust({ name: '', email: '', phone: '', address: '' });
    setCustomerSearch('');
    setPhoneDupMatch(null);
    toast(`Using existing: ${existing.name}`, 'info');
  }

  function handleSend(overrideMethod) {
    const method = overrideMethod || deliveryMethod;
    setError('');
    if (!canSendQuote(userProfile, sentThisMonth)) { setShowUpgradeModal(true); return; }
    if (!draft.customer_id && method !== 'copy') { setError('Add a customer to send via text. Or use "Copy link".'); return; }
    if (method === 'text' && draft.customer_id) { const cust = allCustomers.find(c => c.id === draft.customer_id); if (!cust?.phone) { setInlinePhone(''); setError('__needs_phone__'); return; } }
    if (method === 'email' && draft.customer_id) { const cust = allCustomers.find(c => c.id === draft.customer_id); if (!cust?.email) { setError('This customer has no email address. Add one or use "Copy link".'); return; } }
    if (!lineItems.some(i => i.name?.trim())) return setError('Add at least one item');
    const zeroItems = lineItems.filter(i => i.name?.trim() && Number(i.unit_price) === 0);
    if (zeroItems.length > 0) { setZeroItemConfirm(zeroItems); return; }
    if (overrideMethod) setDeliveryMethod(overrideMethod);
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
      const url = `${window.location.origin}/q/${q.share_token}`;
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
        // copy — with fallback for mobile Safari
        let copied = false;
        try {
          await navigator.clipboard.writeText(url);
          copied = true;
        } catch {
          // Fallback: create a temporary textarea and use execCommand
          try {
            const ta = document.createElement('textarea');
            ta.value = url;
            ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            ta.setSelectionRange(0, ta.value.length); // iOS needs this
            copied = document.execCommand('copy');
            document.body.removeChild(ta);
          } catch { /* ignore */ }
        }
        if (copied) toast('Link copied', 'success');
        else toast('Link: ' + url, 'info');
        _markSent(firstName);
      }
    } catch (e) { setError(e?.message || 'Send failed'); } finally { setSending(false); }
  }

  // Shared post-send bookkeeping (called by all paths that definitively sent)
  function _markSent(customerFirstName) {
    sentRef.current = true; // mark before any nav so pagehide won't log abandonment
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

    // Land on the quote's live detail page — a stable, returnable
    // "Sent ✓ — waiting on {customer}" confirmation. The old in-builder
    // success screen rendered blank when the builder unmounted mid-transition
    // (it depended on transient builder state being torn down). Navigating to
    // a real, persistent page is both reliable and the better pattern.
    if (quoteId) {
      nav(`/app/quotes/${quoteId}?sent=1`, { replace: true });
    } else {
      // No id yet (shouldn't happen post-send) — fall back to the in-builder screen.
      setSentSuccess(true); setPhase('sent');
    }
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

  async function handleSaveAsTemplate(name) {
    if (!user?.id || !name?.trim()) return;
    setSavingTemplate(true);
    try {
      await saveJobTemplate(user.id, {
        name: name.trim(),
        trade,
        description,
        scope_summary: draft.scope_summary,
        province,
        line_items: lineItems.map(li => ({
          name: li.name, quantity: li.quantity, unit_price: li.unit_price,
          notes: li.notes || '', category: li.category || '',
        })),
      });
      toast('Saved as job template', 'success');
      setShowTemplateName(false);
      setTemplateNameDraft('');
    } catch (e) {
      toast(e?.message || 'Could not save template', 'error');
    } finally {
      setSavingTemplate(false);
    }
  }

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  const subtitle = phase === 'building' ? 'Building scope…' : phase === 'sent' ? 'Sent' : phase === 'financing' ? 'Review terms' : (companyName || null);

  return (
    <>
    <AppShell title={phase === 'describe' ? 'New Quote' : title || draft.title || 'Quote'} subtitle={subtitle}>
      {showUpgradeModal && <UpgradePrompt trigger="quote_limit" context={{ count: sentThisMonth }} onDismiss={() => setShowUpgradeModal(false)} />}

      <Section spacing="tight" bleed={true}>
        <div className="rq-page">

        {/* ════════ PROGRESS STEPPER — 4 steps ════════ */}
        {phase !== 'sent' && (
          <div className="qb-stepper">
            {[
              { key: 'describe', label: 'Job' },
              { key: 'building', label: 'Build' },
              { key: 'review', label: 'Scope' },
              { key: 'financing', label: 'Terms' },
            ].map((s, i, arr) => {
              const phases = ['describe', 'building', 'review', 'financing'];
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
          <Card padding="loose" className="qb-zone qb-phase-enter pl-describe-stable" elevation={1}>
            {/* B2 (Slice 12): gradient header strip — first-time only */}
            {(() => { try { return !localStorage.getItem('pl_has_built_quote'); } catch { return true; } })() && (
            <div className="qb-describe-hero" aria-hidden="true">
              <div>
                <div className="qb-describe-hero-title">Send professional quotes in 60 seconds</div>
                <div className="qb-describe-hero-sub">Punchlist builds the scope, pricing, and send flow for you</div>
              </div>
            </div>
            )}
            <div className="jd-section">
              <label className="jd-label" htmlFor="qb-desc">What's the job?</label>
              <textarea
                id="qb-desc"
                ref={descTextareaRef}
                className="jd-input jd-textarea qb-desc-auto"
                value={description}
                onChange={e => { setDescription(e.target.value); }}
                onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && description.trim() && !scopeLoading) { e.preventDefault(); handleBuildScope(); } }}
                onBlur={() => { if (description.trim() && !descCommittedRef.current) { descCommittedRef.current = true; trackQuoteFlowDescriptionCommitted(description.trim().length); } }}
                placeholder="e.g. Replace hot water tank, install kitchen faucet"
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
                  <span className="qb-desc-helper__count">
                    {description.length} chars
                  </span>
                )}
              </div>
              <div className="jd-helpers">
                {photo ? (
                  <div className="jd-helper-btn jd-photo-active">{photo.name} <button type="button" onClick={() => setPhoto(null)} aria-label="Remove photo" className="jd-photo-dismiss"><X size={12} /></button></div>
                ) : (
                  <button className="jd-helper-btn jd-helper-secondary" type="button" onClick={() => fileRef.current?.click()}>📷 Add photo</button>
                )}
                <input hidden ref={fileRef} type="file" accept="image/*" onChange={e => setPhoto(e.target.files?.[0] || null)} />
                {photoSaved && <span className="jd-photo-saved">✓ Photo saved</span>}
              </div>
            </div>
            {title && <div className="qb-job-title">Job: <strong>{title}</strong></div>}
            <div className="jd-row qb-trade-row">
              <div className="jd-section qb-trade-col">
                <label className="jd-label qb-trade-col-label">Trade</label>
                <select className="jd-input jd-select" value={trade} onChange={e => setTrade(e.target.value)} aria-label="Trade">{TRADES.map(t => <option key={t}>{t}</option>)}</select>
              </div>
              <div className="jd-section qb-trade-col">
                <label className="jd-label qb-trade-col-label">{country === 'US' ? 'State' : 'Province'}</label>
                <select className="jd-input jd-select" value={province} onChange={e => setProvince(e.target.value)} aria-label="Province">{(country === 'US' ? US_STATES : CA_PROVINCES).map(p => <option key={p}>{p}</option>)}</select>
              </div>
            </div>
            {trade === 'Other' && <div className="qb-trade-hint">Tip: selecting your specific trade gives better catalog items and pricing</div>}
            {jobTemplates.length > 0 && (
              <div className="qb-templates-row">
                <button type="button" className="qb-templates-toggle" onClick={() => setShowTemplatesPicker(p => !p)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  {showTemplatesPicker ? 'Hide templates' : `Start from template (${jobTemplates.length})`}
                </button>
                {showTemplatesPicker && (
                  <div className="qb-templates-list">
                    {jobTemplates.map(t => (
                      <button key={t.id} type="button" className="qb-template-chip" onClick={async () => {
                        setDescription(t.description || '');
                        if (t.trade) setTrade(t.trade);
                        if (t.line_items?.length) setLineItems(t.line_items.map(li => ({ ...li, id: li.id || genLineItemId() })));
                        if (t.scope_summary) setDraft(prev => ({ ...prev, scope_summary: t.scope_summary }));
                        setShowTemplatesPicker(false);
                        toast(`Loaded template: ${t.name}`, 'info');
                      }}>
                        <strong>{t.name}</strong>
                        {t.trade && <span className="qb-template-chip-trade">{t.trade}</span>}
                        {t.line_items?.length > 0 && <span className="qb-template-chip-count">{t.line_items.length} items</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {error && <div className="jd-error" role="alert">{error}</div>}
            <div className="jd-footer qb-footer-mt">
              {/* AI scope is the headline feature the landing page sells —
                  flipped to primary CTA. "Start from blank" sits below as
                  an escape hatch for contractors who prefer to type their
                  own items. */}
              <div className="qb-build-cta">
                <button type="button" onClick={handleBuildScope} disabled={!description.trim() || scopeLoading} className="btn btn-primary btn-lg full-width">
                  {scopeLoading ? 'Building…' : 'Build the scope →'}
                </button>
                <div className="qb-pillar-teaser">Your customer sees the total, a monthly option, and can approve from their phone.</div>
              </div>
              <button className="btn-link qb-manual-link" type="button" disabled={!description.trim()} onClick={async () => {
                if (!description.trim()) return setError('Describe the job first');
                try {
                  const d = quoteId ? await updateQuote(quoteId, { title: title || description.slice(0, 64), description, trade, province, country }) : await createQuote(user.id, { title: title || description.slice(0, 64), description, trade, province, country, customer_id: null, status: 'draft', line_items: [] });
                  const id = d?.id || quoteId;
                  if (!quoteId) { setQuoteId(id); nav(`/app/quotes/${id}/edit`, { replace: true }); }
                  initialLoadComplete.current = true;
                  setDraft(prev => ({ ...prev, title: title || description.slice(0, 64), description }));
                  setPhase('review');
                } catch (e) { setError(e.message || 'Failed'); }
              }}>or start from blank <ChevronRight size={14} /></button>
            </div>
          </Card>
        )}

        {/* ════════ BUILDING: Loading state with progressive scope preview ════════
            The AI call is one-shot, not streaming — so the API can't
            tell us "item 3 just landed." But we *can* visualize work
            happening: extract noun phrases from the contractor's own
            description (split on commas / + / "and"), pad with
            trade-typical catalog items, then reveal them one-by-one
            on a ~1.6s cadence. Result: the contractor watches scope
            "form" out of their own words instead of staring at four
            shimmer rows that appeared all at once. */}
        {phase === 'building' && (
          <BuildingPreview
            trade={trade}
            description={description}
            scopeLoadingMsg={scopeLoadingMsg}
            photoSaved={photoSaved}
            onBack={() => { setScopeLoading(false); setPhase('describe'); }}
            browseCatalog={browseCatalog}
          />
        )}

        {/* ════════ ZONE 2+3: REVIEW (scope + details + send) ════════ */}
        {phase === 'review' && isMobile && (
          <MobileQuoteReview ctx={{
            lineItems, draft, title, trade, province, country,
            selCustomer, grandTotal, totals, itemCount, confidence,
            addMode, catalogQuery, catalogResults, editingItemId,
            priceRanges, sending, saving, isLocked, error,
            customerSearch, allCustomers, customersLoading,
            showNewCust, newCust, scopeError, quoteId, description,
            setLineItems, ud, setPhase, setAddMode, setCatalogQuery,
            addCatalogItem, markDirty, genLineItemId, updateItem,
            adjustQty, removeItem, setEditingItemId, handleSend,
            save, setCustomerSearch, setShowNewCust, setNewCust,
            handleQuickCreateCustomer, searchCustomers,
            trackQuoteFlowCustomerSelected, setLocalCustomers,
            invalidateCustomers, setScopeError, setError,
            setTitle, setDeliveryMethod: setDeliveryMethod,
            showSend, setShowSend, handleConfirmSend,
            smsBody, setSmsBody, deliveryMethod,
            SmsComposerField: null, // 2.0: SMS composer removed
            toast, currency,
            inlinePhone, setInlinePhone,
            // Mobile needs the suggestions panel too — the contractor-
            // in-control flow lands users on an empty scope until they
            // accept suggested items.
            visibleSuggestions, addSuggestionToItems, addAllSuggestionsToItems, dismissSuggestion,
          }} />
        )}
        {phase === 'review' && !isMobile && (
          <div className="qb-phase-enter" style={isLocked ? { pointerEvents: 'none', opacity: 0.65 } : undefined}>
            {/* Collapsed Zone 1 summary */}
            <div className="qb-context-bar">
              <span className="qb-context-label">{trade} · {province} · {(description || '').slice(0, 50)}{description?.length > 50 ? '…' : ''}</span>
              <button type="button" className="qb-context-edit" onClick={() => setPhase('describe')}>Edit</button>
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
                      <div className="qb-cust-empty">
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
                      return matches.length > 0 ? (<div className="jd-cust-list">{matches.map(c => <button key={c.id} className="jd-cust-pill" type="button" onClick={() => { ud('customer_id', c.id); trackQuoteFlowCustomerSelected(c.id); setCustomerSearch(''); }}><span>{c.name}</span>{c.phone && <span className="qb-cust-phone">{c.phone}</span>}</button>)}</div>) : (<button className="jd-cust-pill jd-cust-new" type="button" onClick={() => { setNewCust(p => ({ ...p, name: customerSearch })); setShowNewCust(true); }}>+ New: "{customerSearch}"</button>);
                    })()}
                    {showNewCust && (<div className="jd-new-cust"><input className="jd-input" value={newCust.name} onChange={e => setNewCust(p => ({ ...p, name: e.target.value }))} placeholder="Full name *" /><div className="jd-row"><input className="jd-input" value={newCust.phone} onChange={e => setNewCust(p => ({ ...p, phone: e.target.value }))} placeholder="Phone *" type="tel" /><input className="jd-input" value={newCust.email} onChange={e => setNewCust(p => ({ ...p, email: e.target.value }))} placeholder="Email (optional)" /></div><div className="qb-new-cust-actions"><button className="btn btn-primary btn-sm" type="button" onClick={handleQuickCreateCustomer}>Save</button><button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowNewCust(false)}>Cancel</button></div></div>)}
                  </div>
                )}
              </div>
            </div>

            {/* Quote settings — collapsed on mobile */}
            <details className="rq-meta-collapse">
              <summary className="qb-meta-toggle rq-meta-toggle pl-toggle-row">
                <span>Scope, terms & notes</span>
                <span className="pl-chevron" />
              </summary>
              {/* Scope Summary */}
              <div className="rq-scope-card">
                <div className="rq-scope-top"><span className="rq-scope-label">Scope summary</span><span className="rq-scope-hint">Shown to customer</span></div>
                <textarea className="rq-scope-input" value={draft.scope_summary} onChange={e => ud('scope_summary', e.target.value)} rows={2} placeholder="Brief description of work" />
              </div>

              {/* Settings row */}
              <div className="rq-settings-row qb-settings-grid">
                <div><label className="qb-settings-label">{country === 'US' ? 'State' : 'Province'} (tax)</label><select className="input qb-settings-select" value={province} onChange={e => setProvince(e.target.value)}>{(country === 'CA' ? CA_PROVINCES : US_STATES).map(p => <option key={p}>{p}</option>)}</select></div>
                <div><label className="qb-settings-label">Deposit</label><div className="qb-deposit-row"><label className="qb-deposit-check"><input type="checkbox" checked={draft.deposit_required} onChange={e => ud('deposit_required', e.target.checked)} style={{ accentColor: 'var(--brand)' }} /><span>Require deposit</span></label>{draft.deposit_required && <div className="qb-deposit-pct-row"><input className="rq-deposit-input" type="number" min="0" inputMode="decimal" value={draft.deposit_percent || ''} onChange={e => { const n = Number(e.target.value); const pct = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0; ud('deposit_percent', pct); ud('deposit_amount', Math.round(Math.max(0, totals.subtotal - (draft.discount || 0)) * pct / 100)); }} style={{ width: 50 }} /><span className="qb-deposit-pct-label">%</span></div>}</div></div>
              </div>

              {/* Assumptions/Exclusions (collapsed) */}
              <div className="rq-scope-card qb-scope-mb">
                <button type="button" className="qb-details-btn rq-details-toggle pl-toggle-row" onClick={() => setShowDetails(!showDetails)}>
                  <span>{showDetails ? 'Assumptions, exclusions & notes' : 'Assumptions, exclusions & notes'}</span>
                  <span className={`pl-chevron ${showDetails ? 'pl-chevron--open' : ''}`} />
                </button>
                {showDetails && (<div className="rq-details-grid"><div><label className="rq-detail-label">Assumptions</label><textarea className="rq-detail-input" value={draft.assumptions} onChange={e => ud('assumptions', e.target.value)} rows={2} placeholder="e.g. Standard access, no structural changes" /></div><div><label className="rq-detail-label">Exclusions</label><textarea className="rq-detail-input" value={draft.exclusions} onChange={e => ud('exclusions', e.target.value)} rows={2} placeholder="e.g. Permit fees, drywall repair" /></div><div><label className="rq-detail-label">Internal notes</label><textarea className="rq-detail-input" value={draft.internal_notes} onChange={e => ud('internal_notes', e.target.value)} rows={2} placeholder="Notes for your records only" /></div></div>)}
              </div>
            </details>

            {/* Line Items */}
            <div className="rq-builder-layout">
              <div className="rq-builder-left">
                <QuoteItemsEditor
                  lineItems={lineItems}
                  setLineItems={setLineItems}
                  markDirty={markDirty}
                  trade={trade}
                  province={province}
                  country={country}
                  editingItemId={editingItemId}
                  setEditingItemId={setEditingItemId}
                  priceRanges={priceRanges}
                  confidence={confidence}
                  catalogQuery={catalogQuery}
                  setCatalogQuery={setCatalogQuery}
                  catalogResults={catalogResults}
                  suggestions={visibleSuggestions}
                  onAddSuggestion={addSuggestionToItems}
                  onAddAllSuggestions={addAllSuggestionsToItems}
                  onDismissSuggestion={dismissSuggestion}
                  onOpenForeman={() => {
                    if ((() => {})) {
                      const jobDesc = description || title || '';
                      (() => {})({
                        starters: [
                          `What else should I include for this ${trade.toLowerCase()} job?`,
                          jobDesc ? `Review my scope: "${jobDesc.slice(0, 80)}${jobDesc.length > 80 ? '…' : ''}"` : 'Help me scope this quote',
                          `What do ${trade.toLowerCase()}s commonly forget to quote?`,
                        ],
                        quoteContext: {
                          description: jobDesc, trade, title: title || '',
                          items: lineItems.filter(i => i.name?.trim()).map(i => ({ name: i.name, qty: i.quantity, price: i.unit_price })),
                          total: grandTotal, province, country
                        }
                      });
                    }
                  }}
                  onRetryScopeAI={scopeError ? () => { setScopeError(false); setPhase('describe'); } : null}
                  scopeError={scopeError}
                  quoteId={quoteId}
                  grandTotal={grandTotal}
                  toast={toast}
                  frequentItems={frequentItems}
                  labourRate={labourRate}
                />
              </div>

              {/* Right Sidebar: Customer preview + close helpers */}
              <div className="rq-builder-right">
                {itemCount > 0 && <div className="rq-customer-preview-label">What your customer sees</div>}
                {itemCount > 0 && <Card padding="default" elevation={2} className="rq-totals-card pl-totals-stable" aria-label="Quote totals">
                  {/* Stat primitives handle count-up + stable width via
                      --min-ch + tabular-nums, so $10,000 never reflows. */}
                  <div className="pl-totals-stats motion-isolate">
                    <Stat label="Subtotal" value={Math.round(totals.subtotal)} prefix="$" countUp={true} align="end" />
                    <div className="pl-totals-stat-row rq-discount-row">
                      <span className="pl-stat-label">Discount</span>
                      <div className="qb-discount-row">
                        <span className="qb-discount-prefix">−$</span>
                        <input className="rq-discount-input tabular" type="number" min="0" inputMode="decimal" value={draft.discount || ''} onChange={e => { const n = Number(e.target.value); ud('discount', Number.isFinite(n) ? Math.max(0, Math.min(1e7, n)) : 0); }} placeholder="0" aria-label="Discount amount" />
                      </div>
                    </div>
                    <Stat label={`Tax (${province})`} value={Math.round(Math.max(0, totals.subtotal - (draft.discount || 0)) * totals.rate)} prefix="$" countUp={true} align="end" />
                    <Stat label="Total" value={Math.round(grandTotal)} prefix="$" countUp={true} align="end" tone="brand" />
                  </div>
                </Card>}
                {/* Close helper tips */}
                {lineItems.length > 0 && grandTotal > 0 && (
                  <div className="rq-close-tips">
                    <div className="rq-close-tips-title">How this helps you close</div>
                    <div className="rq-close-tip">✓ Customer can approve and sign from their phone</div>
                    {draft.deposit_required && <div className="rq-close-tip">✓ Deposit locks in the job before you start</div>}
                    {draft.scope_summary && <div className="rq-close-tip">✓ Scope summary sets clear expectations</div>}
                    {!draft.deposit_required && <div className="rq-close-tip qb-deposit-tip">○ Add a deposit to lock in the job</div>}
                  </div>
                )}
                {/* Tracking teaser */}
                {lineItems.length > 0 && grandTotal > 0 && (
                  <div className="rq-tracking-teaser">
                    <span className="rq-tracking-icon"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></span>
                    <span>After you send, you'll see when {selCustomer?.name?.split(' ')[0] || 'your customer'} opens this quote</span>
                  </div>
                )}
                <button className="btn btn-secondary full-width rq-preview-customer-btn" type="button" disabled={saving || isLocked || itemCount === 0} onClick={async () => { const w = window.open('about:blank', '_blank'); try { const q = await save(null, true); const token = q?.share_token || (quoteId ? (await getQuote(quoteId))?.share_token : null); if (token && w) { w.location.href = '/q/' + token + '?preview=1'; } else { if (w) w.close(); toast('Save the quote first to preview', 'info'); } } catch { if (w) w.close(); toast('Save the quote first to preview', 'info'); } }}>
                  See what {selCustomer?.name?.split(' ')[0] || 'your customer'} will see
                </button>
              </div>
            </div>
            {/* Confidence panel — outside the sidebar so it shows on mobile */}
            {/* Confidence panel now rendered by QuoteItemsEditor */}

            {error && error !== '__needs_phone__' && <div className="jd-error">{error}</div>}
            {error === '__needs_phone__' && (<div className="jd-error qb-needs-phone"><div className="qb-needs-phone-title">Add a phone number to send via text</div><div className="qb-needs-phone-row"><input className="jd-input qb-needs-phone-input" type="tel" value={inlinePhone} onChange={e => setInlinePhone(e.target.value)} placeholder="e.g. (403) 555-0100" autoFocus /><button className="btn btn-primary btn-sm" type="button" disabled={!inlinePhone.trim()} onClick={async () => { try { const cust = allCustomers.find(c => c.id === draft.customer_id); if (!cust) return; await updateCustomer(cust.id, { phone: inlinePhone.trim() }); setLocalCustomers(prev => prev.map(c => c.id === cust.id ? { ...c, phone: inlinePhone.trim() } : c)); invalidateCustomers(); setError(''); toast('Phone saved', 'success'); setTimeout(() => handleSend(), 100); } catch (e) { toast(friendly(e), 'error'); } }}>Save & send</button></div><button type="button" onClick={() => { setDeliveryMethod('copy'); setError(''); handleSend(); }} className="qb-needs-phone-alt">Or copy link instead →</button></div>)}

            {/* Persistent autosave indicator — once a draft exists it stays
                visible so the contractor KNOWS their work is saved and they
                can leave anytime (the #1 "is this saved?" confusion). */}
            {saveState === 'saving'
              ? <div className="qb-autosave-pill">Saving…</div>
              : (lastSavedAt || quoteId)
                ? <div className="qb-autosave-pill qb-autosave-pill--done" title="Your draft is saved automatically — you can safely leave and finish later">✓ Auto-saved</div>
                : null}

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
                <button className="btn btn-secondary btn-sm rq-preview-btn" type="button" disabled={saving || isLocked} onClick={async () => { const w = window.open('about:blank', '_blank'); try { const q = await save(null, true); const token = q?.share_token || (quoteId ? (await getQuote(quoteId))?.share_token : null); if (token && w) { w.location.href = '/q/' + token + '?preview=1'; } else { if (w) w.close(); } } catch (e) { if (w) w.close(); console.warn("[PL]", e); } }}>Preview</button>
                {lineItems.length > 0 && (
                  <button className="btn btn-ghost btn-sm" type="button" title="Save this quote as a reusable job template" onClick={() => { setTemplateNameDraft(title || description.slice(0, 50) || 'New template'); setShowTemplateName(true); }}>Save as template</button>
                )}
              </div>
              <div id="qb-send-btn" className="rq-footer-right">
                <div className="rq-footer-total num-stable tabular" style={{ '--min-ch': '8ch' }} aria-live="polite">
                  {currency(grandTotal, country)}
                </div>
                {itemCount === 0 ? (
                  <button className="btn btn-primary btn-lg qb-disabled-btn" type="button" disabled>Add items to continue</button>
                ) : (
                  <button className="btn btn-primary btn-lg" type="button" disabled={saving || isLocked} onClick={() => { save(null, true); setPhase('financing'); }}>Review Terms →</button>
                )}
              </div>
            </div>

            {/* Send Modal */}
            {showSend && (
              <div className="qb-modal-bg" onClick={() => setShowSend(false)}>
                <div className="qb-modal qb-send-modal" onClick={e => e.stopPropagation()}>
                  {/* Drag handle — pure affordance for mobile; the
                      sheet-on-mobile media query in index.css already
                      docks this modal to the bottom of the viewport. */}
                  <div className="qb-modal-handle" aria-hidden="true" />
                  <div className="qb-modal-top">
                    <h3 className="qb-send-title">Send Quote</h3>
                    <button className="qb-modal-close" type="button" onClick={() => setShowSend(false)} aria-label="Close"><X size={18} strokeWidth={2} /></button>
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
                        <span>{currency(grandTotal, country)}</span>
                      </div>
                    </div>

                    {quoteId && (
                      <a
                        href="#"
                        className="rq-send-preview-link"
                        onClick={async (e) => { e.preventDefault(); const w = window.open('about:blank', '_blank'); try { const q = await save(null, true); const token = q?.share_token || (quoteId ? (await getQuote(quoteId))?.share_token : null); if (token && w) { w.location.href = '/q/' + token + '?preview=1'; } else { if (w) w.close(); toast('Save the quote first to preview', 'info'); } } catch { if (w) w.close(); toast('Save the quote first to preview', 'info'); } }}
                      >
                        Preview what your customer sees ↗
                      </a>
                    )}

                    <div className="qb-send-section">
                      <label className="jd-label qb-send-label">Send via</label>
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
                      <div className="qb-send-section">
                        <textarea className="jd-input" style={{minHeight:80}} placeholder="Message to customer..." value={smsBody} onChange={e => setSmsBody(e.target.value)} rows={5} />
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
                    <p className="pl-sender-reassurance qb-send-reassurance">
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
                <div className="qb-modal qb-sms-modal" onClick={e => e.stopPropagation()}>
                  <h3 className="qb-sms-title">
                    Did you send it?
                  </h3>
                  <p className="qb-sms-desc">
                    We opened your Messages app. Tap "Yes, sent" once you've sent the quote
                    to {smsConfirmPending.firstName || smsConfirmPending.phone}.
                  </p>
                  <div className="qb-sms-actions">
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

        {/* ════════ STEP 3: FINANCING PREVIEW — the centerpiece ════════ */}
        {phase === 'financing' && (
          <FinancingStep
            grandTotal={grandTotal}
            country={country}
            customerName={selCustomer?.name || ''}
            itemCount={itemCount}
            onBack={() => setPhase('review')}
            onContinue={() => handleSend()}
            note={draft.internal_notes || ''}
            onNoteChange={v => ud('internal_notes', v)}
            expiryDays={draft.expiry_days || 14}
            onExpiryChange={v => ud('expiry_days', v)}
          />
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
                <div className="qb-success-wrap"><div className="rq-sent-emoji qb-success-emoji">🎉</div><div className="qb-success-headline">Quote sent — {currency(grandTotal, country)}</div>{mo && <div className="qb-success-sub">{firstName} can pay in full or choose monthly at checkout</div>}<div className="qb-success-tracking"><div className="qb-success-dot" /><span className="qb-success-track-label">You'll get notified the moment {firstName} opens it</span></div>
                <div className="rq-sent-steps">
                  <div className="rq-sent-step"><span className="rq-sent-step-num">1</span><span>{firstName} gets your quote via text</span></div>
                  <div className="rq-sent-step"><span className="rq-sent-step-num">2</span><span>You see when they open it</span></div>
                  <div className="rq-sent-step"><span className="rq-sent-step-num">3</span><span>They approve and you get paid</span></div>
                </div>
                </div>
              ) : (
                <div className="qb-success-compact"><div className="qb-success-compact-title">✓ Quote sent to {firstName}</div><div className="qb-success-compact-sub">{currency(grandTotal, country)}{mo ? ' · monthly option available at checkout' : ''}</div></div>
              )}
              <div className={`qb-success-actions ${isFirst ? "qb-success-actions--first" : "qb-success-actions--repeat"}`}>
                {quoteId && <button className="btn btn-primary btn-sm" type="button" onClick={() => nav(`/app/quotes/${quoteId}`)}>View quote →</button>}
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => { setQuoteId(null); setPhase('describe'); setDescription(''); setTitle(''); setLineItems([]); setDraft(d => ({ ...d, customer_id: '', scope_summary: '', title: '', description: '' })); setSentSuccess(false); titleSuggested.current = false; nav('/app/quotes/new', { replace: true }); }}>+ New quote</button>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => nav('/app')}>Dashboard</button>
              </div>
              {/* Push notification nudge — only on first send, only if not already subscribed */}
              {isFirst && 'PushManager' in window && Notification?.permission === 'default' && (
                <button type="button" className="rq-push-nudge" onClick={async () => {
                  // The browser prompt is a one-shot — if the user accidentally
                  // dismisses or denies it (this CTA is right next to "View
                  // quote →") the permission state is "denied" forever and the
                  // only path back is the browser's per-site settings. A
                  // tiny in-app confirmation gives them a chance to bail.
                  if (!window.confirm(`Get notified the moment ${firstName} opens this quote?\n\nYour browser will ask for permission next.`)) return;
                  try {
                    const perm = await Notification.requestPermission();
                    if (perm !== 'granted') return;
                    const reg = await navigator.serviceWorker.ready;
                    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
                    if (!vapidKey) return;
                    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey });
                    const { data: { session: pushSession } } = await supabase.auth.getSession();
                    // Server derives user_id from the JWT — don't send it in
                    // the body where any caller could spoof it.
                    await fetch('/api/push-subscribe', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', ...(pushSession?.access_token ? { Authorization: `Bearer ${pushSession.access_token}` } : {}) },
                      body: JSON.stringify({ subscription: sub.toJSON() }),
                    });
                    toast('Notifications enabled', 'success');
                  } catch (e) { console.warn('[PL] push enable', e?.message); }
                }}>
                  <span className="qb-notif-icon"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></span>
                  <span>Get notified when {firstName} opens this — enable push notifications</span>
                </button>
              )}
            </div>
          );
        })()}
        </div>
      </Section>

      <ConfirmModal open={zeroItemConfirm !== null} onConfirm={proceedToSend} onCancel={() => setZeroItemConfirm(null)} title="Items with $0 pricing" message={Array.isArray(zeroItemConfirm) && zeroItemConfirm.length > 0 ? `${zeroItemConfirm.map(i => `"${i.name}"`).join(', ')} ${zeroItemConfirm.length > 1 ? 'have' : 'has'} $0 pricing. Send anyway?` : '1 item has $0 pricing. Send anyway?'} confirmLabel="Send Anyway" cancelLabel="Cancel" />

      {/* Phone number dup confirmation */}
      {phoneDupMatch && (
        <div className="qb-modal-bg" onClick={() => setPhoneDupMatch(null)}>
          <div className="qb-modal" onClick={e => e.stopPropagation()}>
            <div className="qb-modal-handle" aria-hidden="true" />
            <div className="qb-modal-top">
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700 }}>Phone number already in use</h3>
              <button className="qb-modal-close" type="button" onClick={() => setPhoneDupMatch(null)} aria-label="Close"><X size={18} strokeWidth={2} /></button>
            </div>
            <div style={{ padding: '12px 16px', fontSize: 'var(--text-sm)', color: 'var(--text-2)', lineHeight: 1.5 }}>
              <strong>{phoneDupMatch.existing.name}</strong> already has this phone number. Would you like to use the existing contact or create a new one?
            </div>
            <div className="qb-modal-acts" style={{ gap: 8 }}>
              <button className="btn btn-secondary btn-sm" type="button" style={{ flex: 1 }} onClick={handleUseExistingContact}>Use {phoneDupMatch.existing.name}</button>
              <button className="btn btn-primary btn-sm" type="button" style={{ flex: 1 }} onClick={() => handleQuickCreateCustomer(true)}>Create new</button>
            </div>
          </div>
        </div>
      )}

      {/* Slice 9 B11: Coachmarks — only shown during review phase */}
      {/* Coachmarks removed in 2.0 */}

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
    {showTemplateName && (
      <div className="jt-modal-bg" onClick={() => setShowTemplateName(false)}>
        <div className="jt-modal" onClick={e => e.stopPropagation()}>
          <div className="jt-modal-hd">
            <h3 className="jt-modal-title">Save as job template</h3>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setShowTemplateName(false)} aria-label="Close">×</button>
          </div>
          <div className="jt-modal-body">
            <label className="jt-modal-label">Template name</label>
            <input
              className="input"
              value={templateNameDraft}
              onChange={e => setTemplateNameDraft(e.target.value)}
              placeholder="e.g. Furnace replacement — mid-range"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && templateNameDraft.trim()) handleSaveAsTemplate(templateNameDraft); }}
            />
            <p className="jt-modal-hint">Saves line items, trade, province and description. Find it under Templates → Job Templates.</p>
          </div>
          <div className="jt-modal-footer">
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowTemplateName(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" type="button" disabled={savingTemplate || !templateNameDraft.trim()} onClick={() => handleSaveAsTemplate(templateNameDraft)}>
              {savingTemplate ? 'Saving…' : 'Save template'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

/**
 * BuildingPreview — replaces the all-at-once skeleton block during
 * AI scope generation. Two improvements vs the previous loader:
 *
 *   1. Skeleton labels are extracted from the contractor's own
 *      description ("Furnace + AC + cleanup" → 3 labels), padded
 *      with trade-typical catalog items. Watching their own words
 *      become scope items feels less like a generic spinner.
 *
 *   2. Items reveal progressively on a ~1.6s cadence instead of
 *      appearing all at once. The AI isn't actually streaming — but
 *      simulating progressive reveal makes the wait feel like work
 *      is happening, not like the screen is frozen.
 */
function BuildingPreview({ trade, description, scopeLoadingMsg, photoSaved, onBack, browseCatalog }) {
  // Pull noun-ish phrases out of the description. Splits on commas,
  // "+", " and ", " with ". Trims leading verbs ("Replace", "Install")
  // so the bars read like nouns. Falls back to catalog items if the
  // description is too short to yield 4 phrases.
  const labels = useMemo(() => {
    const fromDesc = (description || '')
      .split(/[,+]|\sand\s|\swith\s|\splus\s/i)
      .map(s => s.trim())
      .filter(s => s.length >= 3 && s.length <= 60)
      .map(s => s.replace(/^(replace|install|repair|fix|swap|upgrade|add|remove|service)\s+/i, ''))
      .map(s => s.charAt(0).toUpperCase() + s.slice(1));
    const fromCatalog = (browseCatalog?.(trade, 6) || []).slice(0, 6).map(h => h.n);
    const seen = new Set();
    const merged = [];
    for (const t of [...fromDesc, ...fromCatalog]) {
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(t);
      if (merged.length >= 6) break;
    }
    return merged;
  }, [description, trade, browseCatalog]);

  // Progressively reveal items. Starts at 1, adds one every 1.6s,
  // caps at labels.length. The reveal cadence matches the typical
  // 3-12s AI completion window so the contractor sees 2-6 items
  // before review opens.
  const [visible, setVisible] = useState(1);
  useEffect(() => {
    if (visible >= labels.length) return;
    const t = setTimeout(() => setVisible(v => Math.min(v + 1, labels.length)), 1600);
    return () => clearTimeout(t);
  }, [visible, labels.length]);

  return (
    <Card padding="loose" className="pl-building-stable qb-phase-enter" elevation={1}>
      <div className="qb-build-progress" aria-hidden="true" />
      <div className="bs-loading qb-loading-wrap">
        <div className="bs-ai-status">
          <div className="bs-ai-dot" />
          AI is building your quote
        </div>
        <div aria-live="polite" className="qb-loading-msg">{scopeLoadingMsg}</div>
        <div className="qb-loading-sub">{trade} · {(description || '').slice(0, 60)}{(description || '').length > 60 ? '…' : ''}</div>
        {photoSaved && <div className="jd-photo-saved qb-photo-tag">✓ Photo included</div>}
        <div className="bs-skeleton-list qb-skel-wrap">
          {labels.slice(0, visible).map((name, i) => (
            <div
              key={`sk-${name}-${i}`}
              className="bs-skeleton-item qb-skel-item-in"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="bs-skeleton-check" />
              <div className="bs-skeleton-text">
                <div className="bs-skeleton-bar" style={{ width: `${Math.min(85, name.length * 3.5 + 20)}%` }} />
                <div className="qb-skel-label" aria-hidden="true">{name}</div>
              </div>
              <div className="bs-skeleton-bar price" />
            </div>
          ))}
        </div>
        <button type="button" onClick={onBack} className="qb-back-btn">← Back to edit</button>
      </div>
    </Card>
  );
}
