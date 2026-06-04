import { Toggle } from '../components/ui';
import { Info } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AppShell from '../components/app-shell';
import { getProfile, friendly, updateProfile, uploadLogo, exportAllData, deleteAccount, exportInvoicesQuickBooks, exportInvoicesXero, listInvoices } from '../lib/api';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../components/toast';
import { useUnsavedChanges } from '../hooks/use-unsaved-changes';
import { supabase } from '../lib/supabase';
import { useScrollFade } from '../hooks/use-scroll-fade';
import { currency } from '../lib/format';

import { TRADES, normalizeTrade } from '../../shared/tradeBrain';
import { CA_PROVINCES, US_STATES, REGION_LABELS } from '../lib/pricing';
import { PRICING, isPro } from '../lib/billing';
import {
  listTemplates,
  upsertTemplate,
  resetTemplate,
  TEMPLATE_KEYS,
  TEMPLATE_LABELS,
  TEMPLATE_HINTS,
  renderTemplate,
  PRO_REQUIRED_CODE,
} from '../lib/api/templates';
// REMOVED in 2.0: command-palette shortcuts
const GLOBAL_SHORTCUTS = [];
const EXPIRY_OPTIONS = [
  { value: 7,  label: '7 days' },
  { value: 14, label: '14 days (default)' },
  { value: 21, label: '21 days' },
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
];

// ── Push notification subscription toggle ──
function PushToggle({ userId }) {
  const [status, setStatus] = useState('loading'); // loading | unsupported | denied | prompt | subscribed
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') { setStatus('denied'); return; }
    // Check if already subscribed
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setStatus(sub ? 'subscribed' : 'prompt');
      });
    }).catch(() => setStatus('prompt'));
  }, []);

  async function subscribe() {
    setWorking(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setStatus('denied'); setWorking(false); return; }
      const reg = await navigator.serviceWorker.ready;
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidKey) { setStatus('prompt'); setWorking(false); return; }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      setStatus('subscribed');
    } catch (err) {
      console.warn('[push] Subscribe failed:', err);
      setStatus('prompt');
    }
    setWorking(false);
  }

  async function unsubscribe() {
    setWorking(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ action: 'unsubscribe' }),
      });
      setStatus('prompt');
    } catch { }
    setWorking(false);
  }

  if (status === 'loading') return null;
  if (status === 'unsupported') return <div className="muted small">Push notifications are not supported in this browser.</div>;
  if (status === 'denied') return <div className="muted small sp-push-denied" >Notifications are blocked. Enable them in your browser settings to receive push alerts.</div>;

  if (status === 'subscribed') {
    return (
      <div>
        <div className="sp-push-enabled">✓ Push notifications enabled</div>
        <button className="btn btn-secondary btn-sm sp-push-disable-btn" type="button" disabled={working} onClick={unsubscribe} >
          {working ? 'Disabling…' : 'Disable push notifications'}
        </button>
      </div>
    );
  }

  return (
    <button className="btn btn-primary full-width" type="button" disabled={working} onClick={subscribe}>
      {working ? 'Enabling…' : 'Enable push notifications'}
    </button>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { show: showToast } = useToast();
  const settingsTabsRef = useScrollFade();
  const [form, setForm] = useState({
    full_name: '',
    company_name: '',
    trade: 'Plumber',
    province: 'ON',
    country: 'CA',
    default_city: '',
    phone: '',
    default_expiry_days: 14,
    default_deposit_mode: 'none',
    default_deposit_value: 0,
    payment_methods: [],
    payment_instructions: '',
    etransfer_email: '',
    invoice_due_days: 7,
    invoice_note: '',
    logo_url: '',
    default_labour_rate: 0,
    late_fee_percent: 0,
    late_fee_days: 0,
    stripe_payment_link: '',
    venmo_zelle_handle: '',
    square_payment_link: '',
    paypal_link: '',
    terms_conditions: '',
    email_notifications: true,
    sms_notifications_enabled: true,
    review_link: '',
  });
  const [saving, setSaving] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [connectStatus, setConnectStatus] = useState(null);
  const [payouts, setPayouts] = useState(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [pw, setPw] = useState({ next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const saveTimer = useRef(null);
  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteConfirm2, setDeleteConfirm2] = useState(false);
  const [stripeDashLoading, setStripeDashLoading] = useState(false);

  // ── Messages tab state (v100 M2) ──
  // profile is the raw row, used for subscription_plan + followup_cadence_days.
  // templates is the merged list from listTemplates(); cadence is the jsonb.
  const [profile, setProfile] = useState(null);
  const [templates, setTemplates] = useState([]);          // [{template_key, body, is_custom, ...}]
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [cadence, setCadence] = useState({ nudge_1: 2, nudge_2: 4, nudge_3: 7 });
  const [cadenceDirty, setCadenceDirty] = useState(false);
  const [autoFollowup, setAutoFollowup] = useState(false);
  const [autoFollowupSaving, setAutoFollowupSaving] = useState(false);
  const [templateBusyKey, setTemplateBusyKey] = useState(null); // key currently saving/resetting
  // v100 M5 §5.5 — Preferences tab state
  const [autoSendInvoice, setAutoSendInvoice] = useState(true);
  const [prefSaving, setPrefSaving] = useState(false);
  const [templateUpsellKey, setTemplateUpsellKey] = useState(null); // which template triggered inline upsell
  const templateSaveTimers = useRef({}); // per-key debounce

  // ── Active settings tab (declared early so effects below can read it without TDZ) ──
  const [settingsTab, setSettingsTab] = useState(() => {
    try { return sessionStorage.getItem('pl_settings_tab') || 'profile'; }
    catch { return 'profile'; }
  });

  // Auto-save: debounce 1.5s after any form change
  const formJson = JSON.stringify(form);
  const initialLoad = useRef(true);
  const lastSavedJson = useRef('');
  const formRef = useRef(form);
  const userRef = useRef(user);
  formRef.current = form;
  userRef.current = user;
  // Warn before navigating away while a save is pending or in-flight
  useUnsavedChanges(savePending || saving, 'Settings have unsaved changes. Leave anyway?');
  useEffect(() => {
    if (initialLoad.current) { initialLoad.current = false; return; }
    // Don't save if form matches what we last loaded/saved
    if (formJson === lastSavedJson.current) return;
    if (!user || !form.full_name.trim()) return;
    setSavePending(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (isMounted.current) setSavePending(false);
      if (isMounted.current) setSaving(true);
      try {
        await updateProfile(user.id, form);
        lastSavedJson.current = formJson;
        if (isMounted.current) setSavedFlash(true);
        if (isMounted.current) setTimeout(() => { if (isMounted.current) setSavedFlash(false); }, 2000);
      } catch (e) { if (isMounted.current) showToast(friendly(e), 'error'); }
      finally { if (isMounted.current) setSaving(false); }
    }, 1500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [formJson]);

  // ── Flush pending saves on unmount so changes are never lost ──
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const f = formRef.current;
      const u = userRef.current;
      if (!u || !f?.full_name?.trim()) return;
      const currentJson = JSON.stringify(f);
      if (currentJson !== lastSavedJson.current) {
        // Fire-and-forget save — component is unmounting
        updateProfile(u.id, f).then(() => {
          lastSavedJson.current = currentJson;
        }).catch(e => console.warn('[PL]', e));
      }
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getProfile(user.id).then(p => {
      if (cancelled) return;
      if (p) {
        setProfile(p);
        const cd = (p.followup_cadence_days && typeof p.followup_cadence_days === 'object')
          ? p.followup_cadence_days
          : { nudge_1: 2, nudge_2: 4, nudge_3: 7 };
        setCadence({
          nudge_1: Number(cd.nudge_1 ?? 2),
          nudge_2: Number(cd.nudge_2 ?? 4),
          nudge_3: Number(cd.nudge_3 ?? 7),
        });
        setAutoSendInvoice(p.auto_send_invoice_on_complete !== false);
        setAutoFollowup(p.auto_followup_enabled === true);
        const loaded = {
          full_name: p.full_name || '',
          company_name: p.company_name || '',
          trade: normalizeTrade(p.trade || 'Plumber'),
          province: p.province || 'ON',
          country: p.country || 'CA',
          default_city: p.default_city || '',
          phone: p.phone || '',
          default_expiry_days: Number(p.default_expiry_days ?? 14),
          default_deposit_mode: p.default_deposit_mode || 'none',
          default_deposit_value: Number(p.default_deposit_value ?? 0),
          payment_methods: Array.isArray(p.payment_methods) ? p.payment_methods : [],
          payment_instructions: p.payment_instructions || '',
          etransfer_email: p.etransfer_email || '',
          invoice_due_days: Number(p.invoice_due_days ?? 7),
          invoice_note: p.invoice_note || '',
          logo_url: p.logo_url || '',
          default_labour_rate: Number(p.default_labour_rate || 0),
          late_fee_percent: Number(p.late_fee_percent || 0),
          late_fee_days: Number(p.late_fee_days || 0),
          stripe_payment_link: p.stripe_payment_link || '',
          venmo_zelle_handle: p.venmo_zelle_handle || '',
          square_payment_link: p.square_payment_link || '',
          paypal_link: p.paypal_link || '',
          terms_conditions: p.terms_conditions || '',
          email_notifications: p.email_notifications !== false,
          sms_notifications_enabled: p.sms_notifications_enabled !== false,
          review_link: p.review_link || '',
        };
        lastSavedJson.current = JSON.stringify(loaded);
        setForm(loaded);
      }
    }).catch(e => showToast(friendly(e), 'error'));
    return () => { cancelled = true; };
  }, [user]);

  // ── Load message templates (lazy — only when Messages tab is opened) ──
  useEffect(() => {
    if (!user) return;
    if (settingsTab !== 'messages') return;
    if (templatesLoaded) return;
    let cancelled = false;
    listTemplates(user.id, 'en').then(rows => {
      if (cancelled) return;
      setTemplates(rows);
      setTemplatesLoaded(true);
    }).catch(e => {
      if (cancelled) return;
      // listTemplates swallows errors and returns defaults; this is belt-and-suspenders.
      console.warn('[settings] template load failed', e);
      setTemplatesLoaded(true);
    });
    return () => { cancelled = true; };
  }, [user, settingsTab, templatesLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Template handlers ──
  const proAccess = isPro(profile);

  // Preview tokens — "last-sent customer" placeholder per §3.3. Falls back
  // to a friendly sample if the profile hasn't loaded yet.
  const previewTokens = useMemo(() => ({
    firstName: 'Kristine',
    senderName: profile?.company_name || profile?.full_name || 'Your Business',
    quoteTitle: '10 Pot Lights on Main Floor',
    total: '$1,596',
    link: 'https://punchlist.ca/q/sample',
    monthlyEstimate: '$133',
    depositAmount: '$200',
    nextStep: 'See you Thursday.',
    scheduledDate: 'Thursday Apr 18',
  }), [profile?.company_name, profile?.full_name]);

  function handleTemplateChange(key, nextBody) {
    // Optimistic local update so the preview stays live while typing.
    setTemplates(prev => prev.map(t => t.template_key === key
      ? { ...t, body: nextBody, is_custom: true, _isDefault: false }
      : t
    ));
    // Debounce save per-key so rapid typing doesn't spam the DB.
    if (templateSaveTimers.current[key]) clearTimeout(templateSaveTimers.current[key]);
    templateSaveTimers.current[key] = setTimeout(async () => {
      if (!user) return;
      setTemplateBusyKey(key);
      try {
        const saved = await upsertTemplate(user.id, key, nextBody, 'en');
        if (!isMounted.current) return;
        setTemplates(prev => prev.map(t => t.template_key === key ? { ...saved, _isDefault: false } : t));
      } catch (e) {
        if (!isMounted.current) return;
        if (e?.code === PRO_REQUIRED_CODE) {
          // Shouldn't happen — textarea is readOnly for free users — but
          // guard against a client-side plan-state stale read.
          setTemplateUpsellKey(key);
        } else {
          showToast(friendly(e), 'error');
        }
      } finally {
        if (isMounted.current) setTemplateBusyKey(null);
      }
    }, 800);
  }

  async function handleTemplateReset(key) {
    if (!user) return;
    setTemplateBusyKey(key);
    try {
      await resetTemplate(user.id, key, 'en');
      // Refresh from server to get the synthesized default row back.
      const rows = await listTemplates(user.id, 'en');
      if (!isMounted.current) return;
      setTemplates(rows);
      showToast('Reset to default', 'success');
    } catch (e) {
      if (!isMounted.current) return;
      showToast(friendly(e), 'error');
    } finally {
      if (isMounted.current) setTemplateBusyKey(null);
    }
  }

  function handleUpsellFromEditor(key) {
    setTemplateUpsellKey(key);
  }

  // ── Cadence handlers ──
  function handleCadenceChange(slot, rawValue) {
    const n = Math.max(1, Math.min(30, Math.floor(Number(rawValue) || 0)));
    setCadence(prev => ({ ...prev, [slot]: n }));
    setCadenceDirty(true);
  }

  async function saveCadence() {
    if (!user) return;
    if (!proAccess) {
      setTemplateUpsellKey('__cadence__');
      return;
    }
    try {
      await updateProfile(user.id, { followup_cadence_days: cadence });
      setCadenceDirty(false);
      showToast('Nudge schedule saved', 'success');
    } catch (e) {
      showToast(friendly(e), 'error');
    }
  }

  // Saved on its own (not via the autosaved `form`) so a missing
  // auto_followup_enabled column only breaks this toggle, not all of Settings.
  async function toggleAutoFollowup(next) {
    if (!user) return;
    setAutoFollowup(next);
    setAutoFollowupSaving(true);
    try {
      await updateProfile(user.id, { auto_followup_enabled: next });
      showToast(next ? 'Auto follow-ups on — nudges will send automatically' : 'Auto follow-ups off', 'success');
    } catch (e) {
      setAutoFollowup(!next); // revert on failure
      showToast(friendly(e), 'error');
    } finally {
      setAutoFollowupSaving(false);
    }
  }

  async function connectFetch(body) {
    const { data: { session } } = await supabase.auth.getSession();
    const hdrs = { 'Content-Type': 'application/json' };
    if (session?.access_token) hdrs['Authorization'] = `Bearer ${session.access_token}`;
    return fetch('/api/connect-onboarding', { method: 'POST', headers: hdrs, body: JSON.stringify(body) });
  }

  // ── Stripe Connect status check ──
  useEffect(() => {
    if (!user) return;
    connectFetch({ action: 'status', userId: user.id })
      .then(r => r.json()).then(setConnectStatus).catch(e => console.warn('[PL]', e));
  }, [user]);

  // ── Payout summary — only once we know payments are live ──
  useEffect(() => {
    if (!user || !connectStatus?.onboarded || payouts !== null) return;
    connectFetch({ action: 'payouts', userId: user.id })
      .then(r => r.json()).then(setPayouts).catch(e => console.warn('[PL]', e));
  }, [user, connectStatus?.onboarded]);

  // Handle return from Stripe Connect onboarding
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connect') === 'complete' && user) {
      connectFetch({ action: 'status', userId: user.id })
        .then(r => r.json()).then(data => {
        setConnectStatus(data);
        if (data.onboarded) showToast('Payments connected — you\'re all set.', 'success');
        else showToast('Stripe setup isn\'t finished. Pick it back up below.', 'warning');
      }).catch(e => console.warn('[PL]', e));
      window.history.replaceState({}, '', '/app/settings');
    }
    if (params.get('connect') === 'refresh' && user) {
      handleConnectSetup('refresh');
    }
  }, [user]);

  async function handleConnectSetup(forceAction) {
    setConnectLoading(true);
    try {
      const action = forceAction || (connectStatus?.connected ? 'refresh' : 'create');
      const r = await connectFetch({ action, userId: user.id });
      const data = await r.json();
      if (data.url) window.location.href = data.url;
      else showToast('Couldn\'t start Stripe setup. Try again in a moment.', 'error');
    } catch (e) { showToast('Couldn\'t reach Stripe. Try again in a moment.', 'error'); }
    finally { setConnectLoading(false); }
  }

  async function openStripeDashboard() {
    setStripeDashLoading(true);
    try {
      const r = await connectFetch({ action: 'dashboard', userId: user.id });
      const data = await r.json();
      if (data.url) window.open(data.url, '_blank');
      else showToast(data.error || 'Couldn\'t open the Stripe dashboard. Your account may still be setting up.', 'error');
    } catch (e) { console.warn('[PL]', e); showToast('Couldn\'t reach Stripe. Try again in a moment.', 'error'); }
    finally { setStripeDashLoading(false); }
  }

  // Manual save still available as backup
  async function save() {
    if (!form.full_name.trim()) return showToast('Your name can\'t be blank', 'error');
    setSaving(true);
    try {
      await updateProfile(user.id, form);
      lastSavedJson.current = JSON.stringify(form);
      showToast('Settings saved', 'success');
    } catch (e) { showToast(friendly(e), 'error'); }
    finally { setSaving(false); }
  }

  async function updatePw() {
    if (pw.next.length < 8) return showToast('Password needs 8+ characters', 'error');
    if (pw.next !== pw.confirm) return showToast("Passwords don't match", 'error');
    setPwSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw.next });
      if (error) throw error;
      setPw({ next: '', confirm: '' });
      showToast('Password updated', 'success');
    } catch (e) { showToast(friendly(e), 'error'); }
    finally { setPwSaving(false); }
  }

  // 7G: Export all data
  async function handleExportData() {
    if (!user) return;
    setExporting(true);
    try {
      const result = await exportAllData(user.id);
      if (result == null) {
        showToast('Export coming soon — contact hello@punchlist.ca for your data', 'info');
      } else {
        showToast(`Exported ${result} files`, 'success');
      }
    } catch (e) { showToast(friendly(e), 'error'); }
    finally { setExporting(false); }
  }

  // 7G: Delete account — the server endpoint wipes every quote / line
  // item / invoice / customer / template / notification / photo and
  // finally the auth user itself, then signs us out client-side and
  // clears IndexedDB + localStorage so the next visitor on the device
  // starts truly fresh. Until this commit the call hit a client-only
  // implementation that couldn't touch the auth user (silent fail) and
  // left every quote + customer orphaned.
  async function handleDeleteAccount() {
    if (!user || !deleteConfirm || !deleteConfirm2) return;
    setDeleting(true);
    try {
      const report = await deleteAccount();
      // Be honest about partial failures. The wipe is best-effort and the
      // server logs each per-table error into report.errors — if anything
      // is left behind the contractor needs to know rather than discover
      // ghost data after signing back up with the same email.
      const errs = Array.isArray(report?.errors) ? report.errors : [];
      const tablesWithErrors = errs.length > 0;
      const authMissing = report && !report.auth_deleted;
      if (tablesWithErrors || authMissing) {
        const parts = [];
        if (tablesWithErrors) parts.push(`${errs.length} record${errs.length > 1 ? 's' : ''} couldn’t be removed`);
        if (authMissing) parts.push('sign-in record couldn’t be removed');
        const msg = `Your account was partially deleted: ${parts.join(' and ')}. Email hello@punchlist.ca with your account email so we can finish wiping it.`;
        // sessionStorage so the landing page can surface a banner — toast
        // disappears too fast for something this important.
        try { sessionStorage.setItem('pl_delete_partial', msg); } catch (e) { console.warn('[PL]', e); }
        showToast(msg, 'error');
      }
      // Even on partial success, redirect to the landing page — staying
      // on /app/settings with a signed-out client would re-bounce to
      // /login and confuse the contractor.
      window.location.href = '/';
    } catch (e) {
      showToast(friendly(e), 'error');
      setDeleting(false);
    }
  }

  // 7F: QuickBooks/Xero export
  async function handleAccountingExport(format) {
    try {
      const invoices = await listInvoices(user.id);
      if (!invoices.length) { showToast('Nothing to export yet — send an invoice first.', 'error'); return; }
      const result = format === 'quickbooks' ? exportInvoicesQuickBooks(invoices) : exportInvoicesXero(invoices);
      if (result == null) {
        showToast('Accounting export coming soon — contact hello@punchlist.ca', 'info');
      } else {
        showToast(`Exported ${invoices.length} invoices`, 'success');
      }
    } catch (e) { showToast(friendly(e), 'error'); }
  }

  function switchTab(id) { setSettingsTab(id); try { sessionStorage.setItem('pl_settings_tab', id); } catch (e) { console.warn('[PL]', e); } }

  return (
    <AppShell
      title="Settings"
      actions={
        savedFlash ? (
          <span className="settings-save-pill saved">✓ Saved</span>
        ) : (saving || savePending) ? (
          <span className="settings-save-pill saving">
            {saving ? 'Saving…' : '● Unsaved'}
          </span>
        ) : null
      }
    >
      {/* Tab bar */}
      <div className="settings-tabs" ref={settingsTabsRef}>
        {[
          { id: 'profile', label: 'Profile' },
          { id: 'payments', label: 'Payments' },
          { id: 'messages', label: 'Messages' },
          { id: 'notifications', label: 'Notifications' },
          { id: 'account', label: 'Account' },
        ].map(tab => (
          <button key={tab.id} type="button" className={`settings-tab ${settingsTab === tab.id ? 'active' : ''}`} onClick={() => switchTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="settings-grid">

        {/* ═══ PROFILE TAB ═══ */}
        {settingsTab === 'profile' && <>
        {/* Business profile */}
        <details className="panel sp-collapsible" open>
          <summary className="sp-collapsible-summary">
            <div className="eyebrow">Business profile</div>
            <p className="muted small settings-hint">
              This appears on quotes and invoices sent to your customers.
            </p>
          </summary>
          <div className="stack">
            <div className="form-row">
              <div>
                <span className="field-label">Your name *</span>
                <input className="input" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Jane Smith" />
              </div>
              <div>
                <span className="field-label">Business name</span>
                <input className="input" value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} placeholder="Smith Plumbing Ltd." />
              </div>
            </div>
            <div>
              <span className="field-label">Logo (shown on quotes and invoices)</span>
              <div className="sp-logo-row">
                <label className="btn btn-secondary btn-sm sp-logo-upload-label">
                  Upload image
                  <input hidden type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const url = await uploadLogo(user.id, file);
                      setForm(p => ({ ...p, logo_url: url }));
                      showToast('Logo uploaded', 'success');
                    } catch (err) { showToast(friendly(err), 'error'); }
                  }} />
                </label>
              </div>
              {form.logo_url && (
                <div className="sp-logo-preview-row">
                  <img src={form.logo_url} alt="Logo preview" className="sp-logo-preview-img" onError={e => { e.target.style.display = 'none'; }} />
                  <button type="button" className="btn btn-secondary btn-sm sp-logo-remove-btn" onClick={() => setForm(p => ({ ...p, logo_url: '' }))}>Remove</button>
                </div>
              )}
            </div>
            <div className="form-row">
              <div>
                <span className="field-label">Trade</span>
                <select aria-label="Trade" className="input" value={form.trade} onChange={e => setForm(p => ({ ...p, trade: e.target.value }))}>
                  {TRADES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <span className="field-label">Country</span>
                <select aria-label="Country" className="input" value={form.country} onChange={e => { const c = e.target.value; setForm(p => ({ ...p, country: c, province: c === 'US' ? 'CA' : 'ON' })); }}>
                  <option value="CA">Canada</option>
                  <option value="US">United States</option>
                </select>
              </div>
              <div>
                <span className="field-label">{form.country === 'US' ? 'State' : 'Province'} (sets tax rate)</span>
                <select aria-label={form.country === 'US' ? 'State' : 'Province'} className="input" value={form.province} onChange={e => setForm(p => ({ ...p, province: e.target.value }))}>
                  {(form.country === 'US' ? US_STATES : CA_PROVINCES).map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div style={{ gridColumn: '1 / -1' }}>
                <span className="field-label">Primary city / municipality (optional)</span>
                <input
                  className="input"
                  value={form.default_city || ''}
                  onChange={e => setForm(p => ({ ...p, default_city: e.target.value }))}
                  placeholder="e.g. Calgary, AB"
                  maxLength={80}
                />
                <span className="field-hint">Foreman uses this as the default jurisdiction when you ask about permits or code. You can still tell Foreman a different city for a specific job.</span>
              </div>
            </div>
            <div className="form-row">
              <div>
                <span className="field-label">Default hourly labour rate (optional)</span>
                <div className="sp-rate-row">
                  <span className="sp-rate-prefix">$</span>
                  <input className="input sp-rate-input" type="number" min="0" step="5" value={form.default_labour_rate || ''} onChange={e => setForm(p => ({ ...p, default_labour_rate: Number(e.target.value) || 0 }))} placeholder="e.g. 165" />
                  <span className="sp-rate-suffix">/hr</span>
                </div>
                <div className="sp-rate-hint">Auto-applied to labour line items when building quotes. Leave blank to use catalog pricing.</div>
              </div>
            </div>
            <div>
              <span className="field-label">Phone (shown on customer quotes with click-to-call)</span>
              <input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+1 (403) 555-0100" />
            </div>
            <div>
              <span className="field-label">Account email (where approval notifications are sent)</span>
              <input aria-label="Account email" className="input sp-readonly-input" value={user?.email || ''} readOnly  />
              <div className="muted small sp-hint">This is your login email. Change it through your account provider.</div>
            </div>
          </div>
        </details>

        {/* Quote defaults */}
        <details className="panel sp-collapsible">
          <summary className="sp-collapsible-summary">
            <div className="eyebrow">Quote defaults</div>
            <p className="muted small settings-hint">
              These values are applied automatically to every new quote. You can always override them per-quote in the quote builder.
            </p>
          </summary>
          <div className="stack">
            <div>
              <span className="field-label">Default quote expiry</span>
              <select
                aria-label="Default quote expiry"
                className="input"
                value={form.default_expiry_days}
                onChange={e => setForm(p => ({ ...p, default_expiry_days: Number(e.target.value) }))}
              >
                {EXPIRY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <div className="muted small sp-hint-6">
                The clock starts when you send, not when you create the draft.
              </div>
            </div>
            <div className="notice-banner">
              Quotes expire {form.default_expiry_days} days after being sent. Drafts have no expiry.
            </div>
          </div>
        </details>

        {/* ═══ QUOTE TRACKING — explainer ═══ */}
        <details className="panel sp-collapsible">
          <summary className="sp-collapsible-summary">
            <div className="eyebrow">Quote Tracking</div>
            <p className="muted small sp-tracking-desc">
              Every quote you send is tracked automatically. You'll see when your customer opens it, how many times they've viewed it, and get prompted when it's time to follow up. No extra setup needed.
            </p>
          </summary>
          <div className="sp-tracking-grid">
            <div className="flex-row-gap-8">View counts and timestamps on every sent quote</div>
            <div className="flex-row-gap-8">Notifications when a customer opens your quote</div>
            <div className="flex-row-gap-8">Follow-up prompts based on viewing patterns</div>
          </div>
        </details>
        </>}

        {/* ═══ PAYMENTS TAB ═══ */}
        {settingsTab === 'payments' && <>
        {/* ═══ PAYMENTS — single consolidated panel ═══ */}
        <div className="panel">
          <div className="eyebrow">Payments</div>
          <p className="muted small settings-hint">
            Get paid faster. Customers can pay monthly, by deposit, or in full — directly from your quotes and invoices.
          </p>

          {/* ── Punchlist Payments (primary) ── */}
          <div className="sp-pay-card">
            <div className="sp-pay-header">
              <span className="sp-pay-title">Punchlist Payments</span>
              {connectLoading && !connectStatus && (
                <span className="sp-pay-skel-pill" />
              )}
              {connectStatus?.onboarded && <span className="sp-pay-active-badge">Active</span>}
            </div>
            {connectStatus === null && !connectLoading ? (
              <div className="sp-pay-skel-col">
                <div className="sp-pay-skel-bar sp-pay-skel-bar--85" />
                <div className="sp-pay-skel-bar sp-pay-skel-bar--60" />
                <div className="sp-pay-skel-bar sp-pay-skel-bar--btn" />
              </div>
            ) : !connectStatus?.onboarded ? (
              <>
                <div className="sp-pay-headline">
                  You get paid in full. Customers pay monthly.
                </div>
                <p className="muted small sp-pay-desc">
                  One setup turns on three ways to pay on every quote and invoice: <strong>card</strong>, <strong>deposit</strong>, and <strong>monthly financing</strong>. When a customer chooses monthly, Affirm pays you the full amount upfront within 2 business days — they repay Affirm over 3–12 months. You don't wait.
                </p>
                <div className="sp-pay-stat-grid">
                  <div className="panel-card">
                    <div className="text-heading">$0</div>
                    <div className="muted-small">Setup fee</div>
                  </div>
                  <div className="panel-card">
                    <div className="text-heading">2 days</div>
                    <div className="muted-small">To your bank</div>
                  </div>
                  <div className="panel-card">
                    <div className="text-heading">100%</div>
                    <div className="muted-small">Paid upfront</div>
                  </div>
                </div>
                <Link className="btn btn-primary sp-pay-cta-full" to="/app/payments/setup" >
                  {connectStatus?.connected ? 'Finish setup — takes 2 minutes →' : 'Set up payments — takes 2 minutes →'}
                </Link>
                <div className="sp-pay-fine-print">
                  No monthly fee · No setup fee · Small processing fee per transaction
                </div>
              </>
            ) : (
              <>
                <p className="muted small sp-pay-onboarded-desc">
                  Customers can pay by card or choose monthly payments on jobs over $500. You get the full amount within 2 business days.
                </p>
                {payouts?.connected && !payouts.error && (payouts.available > 0 || payouts.pending > 0 || payouts.nextPayout) && (
                  <div className="sp-payout-summary">
                    <div className="sp-payout-row">
                      <div className="sp-payout-stat">
                        <span className="sp-payout-val">{currency(payouts.available || 0)}</span>
                        <span className="sp-payout-lbl">Available</span>
                      </div>
                      <div className="sp-payout-stat">
                        <span className="sp-payout-val">{currency(payouts.pending || 0)}</span>
                        <span className="sp-payout-lbl">Pending</span>
                      </div>
                    </div>
                    {payouts.nextPayout?.amount > 0 && (
                      <div className="sp-payout-next">
                        Next payout: <strong>{currency(payouts.nextPayout.amount)}</strong>
                        {payouts.nextPayout.arrivalDate ? ` · arrives ${new Date(payouts.nextPayout.arrivalDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
                      </div>
                    )}
                  </div>
                )}
                <div className="sp-pay-actions">
                  <button type="button" className="btn btn-secondary sp-pay-btn-sm" onClick={openStripeDashboard} disabled={stripeDashLoading} >
                    {stripeDashLoading ? 'Opening…' : 'View Stripe Dashboard →'}
                  </button>
                  <Link to="/app/payments/setup" className="btn btn-secondary sp-pay-link-btn">
                    How it works →
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* ── Deposit defaults ── */}
          <div className="sp-mb-16">
            <div className="sp-section-header">Deposits</div>
            <div className="stack">
              <div>
                <span className="field-label">Default deposit on new quotes</span>
                <select aria-label="Default deposit on new quotes" className="input" value={form.default_deposit_mode} onChange={e => setForm(p => ({ ...p, default_deposit_mode: e.target.value }))}>
                  <option value="none">No deposit required</option>
                  <option value="percent">Percentage of total</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </div>
              {form.default_deposit_mode !== 'none' && (
                <div>
                  <span className="field-label">{form.default_deposit_mode === 'percent' ? 'Deposit percentage' : 'Deposit amount ($)'}</span>
                  <input className="input" type="number" min="0" value={form.default_deposit_value} onChange={e => setForm(p => ({ ...p, default_deposit_value: Number(e.target.value) }))} />
                </div>
              )}
            </div>
          </div>

          {/* ── Invoice terms ── */}
          <div className="sp-mb-16">
            <div className="sp-section-header">Invoice terms</div>
            <div className="stack">
              <div>
                <span className="field-label">Due date</span>
                <select aria-label="Invoice due date" className="input" value={form.invoice_due_days} onChange={e => setForm(p => ({ ...p, invoice_due_days: Number(e.target.value) }))}>
                  <option value={0}>Due on receipt</option>
                  <option value={7}>Net 7</option>
                  <option value={14}>Net 14</option>
                  <option value={30}>Net 30</option>
                </select>
              </div>
              <div>
                <span className="field-label">Default invoice note</span>
                <textarea className="input textarea-md" value={form.invoice_note} onChange={e => setForm(p => ({ ...p, invoice_note: e.target.value }))} placeholder="e.g. Thank you for your business." />
              </div>
              <div className="form-row">
                <div>
                  <span className="field-label">Late fee (%)</span>
                  <input className="input" type="number" min="0" max="25" step="0.5" value={form.late_fee_percent || ''} onChange={e => setForm(p => ({ ...p, late_fee_percent: Number(e.target.value) || 0 }))} placeholder="e.g. 2" />
                </div>
                <div>
                  <span className="field-label">Applied after (days overdue)</span>
                  <select aria-label="Late fee applied after (days overdue)" className="input" value={form.late_fee_days || 0} onChange={e => setForm(p => ({ ...p, late_fee_days: Number(e.target.value) }))}>
                    <option value={0}>Off</option>
                    <option value={15}>15 days</option>
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                  </select>
                </div>
              </div>
              <div className="sp-rate-hint">Automatically shown on overdue invoices. Set to 0 to disable.</div>
            </div>
          </div>

          {/* ── Other payment methods ── */}
          <div>
            <div className="sp-section-header--4">Other payment methods</div>
            <p className="muted small sp-other-methods-desc">
              Optional. Check any methods you also accept — they'll appear on your quotes and invoices alongside Punchlist Payments.
            </p>
            <div className="stack">
              {(form.country === 'US'
                ? ['Cash','Check','Venmo','Zelle','ACH Transfer','PayPal','Other']
                : ['E-Transfer','Cash','Cheque','PayPal','Other']
              ).map(m => (
                <label key={m} className="settings-row">
                  <input type="checkbox" checked={form.payment_methods.includes(m)} onChange={e => {
                    setForm(p => ({ ...p, payment_methods: e.target.checked ? [...p.payment_methods, m] : p.payment_methods.filter(x => x !== m) }));
                  }} className="settings-checkbox" />
                  {m}
                </label>
              ))}
              {form.payment_methods.includes('E-Transfer') && (
                <div>
                  <span className="field-label">E-Transfer email</span>
                  <input className="input" value={form.etransfer_email} onChange={e => setForm(p => ({ ...p, etransfer_email: e.target.value }))} placeholder="billing@yourcompany.com" />
                </div>
              )}
              {(form.payment_methods.includes('Venmo') || form.payment_methods.includes('Zelle')) && (
                <div>
                  <span className="field-label">{[form.payment_methods.includes('Venmo') && 'Venmo', form.payment_methods.includes('Zelle') && 'Zelle'].filter(Boolean).join(' / ')} handle</span>
                  <input className="input" value={form.venmo_zelle_handle || ''} onChange={e => setForm(p => ({ ...p, venmo_zelle_handle: e.target.value }))} placeholder="@yourname or email" />
                </div>
              )}
              {form.payment_methods.includes('PayPal') && (
                <div>
                  <span className="field-label">PayPal.me link or email</span>
                  <input className="input" value={form.paypal_link || ''} onChange={e => setForm(p => ({ ...p, paypal_link: e.target.value }))} placeholder="https://paypal.me/yourname" />
                </div>
              )}
              {form.payment_methods.includes('Square') && (
                <div>
                  <span className="field-label">Square payment link</span>
                  <input className="input" value={form.square_payment_link || ''} onChange={e => setForm(p => ({ ...p, square_payment_link: e.target.value }))} placeholder="https://square.link/u/..." />
                </div>
              )}
              <div>
                <span className="field-label">Payment instructions (shown to customers)</span>
                <textarea className="input textarea-md" value={form.payment_instructions} onChange={e => setForm(p => ({ ...p, payment_instructions: e.target.value }))} placeholder="e.g. E-transfer to billing@company.com — Reference: your name + invoice #" />
              </div>

              {/* Legacy Stripe payment link — fallback for contractors not using Connect */}
              {!connectStatus?.onboarded && (
                <div>
                  <span className="field-label">Stripe payment link (legacy — optional)</span>
                  <input className="input" value={form.stripe_payment_link} onChange={e => setForm(p => ({ ...p, stripe_payment_link: e.target.value }))} placeholder="https://buy.stripe.com/XXXXXXX" />
                  <div className="muted small sp-hint">Paste your own Stripe payment link as a fallback.</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Terms & Conditions */}
        <div className="panel">
          <div className="eyebrow">Terms &amp; Conditions</div>
          <p className="muted small settings-hint">
            Optional. When set, customers must check an &ldquo;I agree&rdquo; checkbox before they can sign a quote.
            Useful for warranty terms, liability disclaimers, or cancellation policies.
          </p>
          <div>
            <span className="field-label">Terms &amp; conditions text (optional)</span>
            <textarea
              className="input textarea-md sp-terms-textarea"
              
              value={form.terms_conditions}
              onChange={e => setForm(p => ({ ...p, terms_conditions: e.target.value }))}
              placeholder="e.g. All work is guaranteed for 1 year from the date of completion. A 25% cancellation fee applies if work is cancelled within 48 hours of the scheduled date. Customer is responsible for providing clear access to the work area…"
            />
            <p className="muted small sp-hint-6">Leave blank to hide this section from quotes.</p>
          </div>
        </div>

        {/* Password */}
        <div className="panel">
          <div className="eyebrow">Password</div>
          <div className="stack sp-stack-top">
            <div>
              <span className="field-label">New password</span>
              <input className="input" type="password" value={pw.next} onChange={e => setPw(p => ({ ...p, next: e.target.value }))} placeholder="8+ characters" autoComplete="new-password" />
            </div>
            <div>
              <span className="field-label">Confirm new password</span>
              <input className="input" type="password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} placeholder="Repeat password" autoComplete="new-password" />
            </div>
            <button className="btn btn-secondary" type="button" disabled={pwSaving} onClick={updatePw}>
              {pwSaving ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </div>

        {/* Subscription */}
        <div className="panel sp-sub-panel">
          <div className="eyebrow">Subscription</div>
          <div className="stack sp-sub-stack">
            <p className="muted small sp-sub-desc">
              Upgrade to Pro to lift the 5-quote cap — plus custom saved quote &amp; message templates, priority support, and early access to new features. Everything else is already included free.
            </p>
            <div className="settings-pricing-grid sp-pricing-grid">
              <div className="sp-pricing-card">
                <div className="sp-pricing-amount">${PRICING.monthly}</div>
                <div className="muted small">per month</div>
                <button className="btn btn-secondary full-width sp-pricing-btn"  type="button" onClick={() => navigate('/app/billing')}>Monthly plan</button>
              </div>
              <div className="sp-pricing-card--featured">
                <div className="sp-pricing-best">BEST VALUE</div>
                <div className="sp-pricing-amount">${PRICING.annual}</div>
                <div className="muted small">per year · save ${PRICING.annualSavings}</div>
                <button className="btn btn-primary full-width sp-pricing-btn"  type="button" onClick={() => navigate('/app/billing')}>Yearly plan</button>
              </div>
            </div>
            <div className="muted small sp-pricing-note">30-day free trial · no credit card required · cancel anytime</div>
          </div>
        </div>
        </>}


        {/* ═══ MESSAGES TAB ═══ */}
        {settingsTab === 'messages' && <>
        <div className="panel">
          <div className="eyebrow">Follow-up schedule</div>
          <p className="muted small settings-hint">
            How many days after sending a quote should each nudge go out?
          </p>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, margin: '4px 0 16px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoFollowup}
              disabled={autoFollowupSaving}
              onChange={e => toggleAutoFollowup(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Send these nudges automatically</span>
              <span className="muted small" style={{ display: 'block' }}>
                Texts customers on the schedule below until they respond or approve (max 3). Off by default — when off, you'll just be prompted to follow up.
              </span>
            </span>
          </label>
          <div className="stack" style={{ gap: 10 }}>
            {[
              { slot: 'nudge_1', label: 'First nudge' },
              { slot: 'nudge_2', label: 'Second nudge' },
              { slot: 'nudge_3', label: 'Last nudge' },
            ].map(({ slot, label }) => (
              <div key={slot} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 600 }}>{label}</label>
                <input
                  type="number" min="1" max="30"
                  value={cadence[slot] ?? ''}
                  onChange={e => handleCadenceChange(slot, e.target.value)}
                  className="input" style={{ width: 70, textAlign: 'center' }}
                  disabled={!proAccess}
                />
                <span className="muted" style={{ fontSize: 'var(--text-xs)', minWidth: 35 }}>days</span>
              </div>
            ))}
          </div>
          {cadenceDirty && (
            <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={saveCadence}>
              Save schedule
            </button>
          )}
          {!proAccess && <p className="muted small" style={{ marginTop: 8 }}>Upgrade to Pro to customize follow-up timing.</p>}
        </div>

        <div className="panel">
          <div className="eyebrow">SMS templates</div>
          <p className="muted small settings-hint">
            Customize the messages sent to your customers at each stage. Use tokens like {'{firstName}'}, {'{quoteTitle}'}, {'{total}'}, {'{link}'}.
          </p>
          {!templatesLoaded ? (
            <div className="muted small" style={{ padding: '16px 0' }}>Loading templates...</div>
          ) : (
            <div className="stack" style={{ gap: 16 }}>
              {templates.map(t => (
                <div key={t.template_key} className="settings-template-row">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>{TEMPLATE_LABELS[t.template_key] || t.template_key}</label>
                    {t.is_custom && (
                      <button
                        type="button"
                        className="btn btn-sm btn-muted"
                        style={{ fontSize: 11, padding: '2px 8px' }}
                        disabled={templateBusyKey === t.template_key}
                        onClick={() => handleTemplateReset(t.template_key)}
                      >
                        {templateBusyKey === t.template_key ? '...' : 'Reset'}
                      </button>
                    )}
                  </div>
                  {TEMPLATE_HINTS[t.template_key] && (
                    <p className="muted" style={{ fontSize: 'var(--text-2xs)', margin: '0 0 6px', lineHeight: 1.4 }}>{TEMPLATE_HINTS[t.template_key]}</p>
                  )}
                  <textarea
                    className="input"
                    rows={3}
                    value={t.body || ''}
                    onChange={e => handleTemplateChange(t.template_key, e.target.value)}
                    readOnly={!proAccess}
                    style={{ fontSize: 'var(--text-sm)', lineHeight: 1.5, resize: 'vertical' }}
                  />
                  <div className="muted" style={{ fontSize: 'var(--text-2xs)', marginTop: 4, padding: '6px 8px', background: 'var(--panel-2)', borderRadius: 6, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {renderTemplate(t.body, previewTokens)}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!proAccess && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--amber-bg, rgba(245,158,11,.08))', borderRadius: 8, fontSize: 'var(--text-xs)', color: 'var(--amber-text, #92400e)' }}>
              Pro plan required to customize templates. <a href="/pricing" style={{ fontWeight: 700, color: 'inherit' }}>Upgrade →</a>
            </div>
          )}
        </div>
        </>}

        {/* ═══ NOTIFICATIONS TAB ═══ */}
        {settingsTab === 'notifications' && <>
        <div className="panel">
          <div className="eyebrow">Text messages</div>
          <p className="muted small settings-hint">
            Get a text when a customer opens, approves, asks a question, or requests changes to a quote — with a one-tap link straight to the conversation.
          </p>
          <div className="stack">
            <div>
              <span className="field-label">Texts sent to</span>
              <div className="sp-notif-email-row">
                <span className="sp-notif-email">{form.phone || 'No phone set — add one in Profile'}</span>
                {form.phone && <span className="muted small">Standard message rates may apply</span>}
              </div>
            </div>
            <label className="sp-toggle-row">
              <div className="sp-toggle-info">
                <span className="field-label">Customer activity texts</span>
                <span className="muted small">Quote opened, approved, declined, customer message, change request</span>
              </div>
              <input
                type="checkbox"
                className="settings-checkbox"
                checked={form.sms_notifications_enabled !== false}
                disabled={!form.phone}
                onChange={e => setForm(p => ({ ...p, sms_notifications_enabled: e.target.checked }))}
              />
            </label>
          </div>
        </div>

        <div className="panel">
          <div className="eyebrow">Push notifications</div>
          <p className="muted small settings-hint">
            Get instant alerts when a customer opens your quote, approves, or asks a question — right to your phone or browser.
          </p>
          <PushToggle userId={user?.id} />
        </div>

        <div className="panel">
          <div className="eyebrow">Email notifications</div>
          <p className="muted small settings-hint">
            Punchlist sends approval confirmations and activity emails to your account address.
          </p>
          <div className="stack">
            <div>
              <span className="field-label">Notifications sent to</span>
              <div className="sp-notif-email-row">
                <span className="sp-notif-email">{user?.email}</span>
                <span className="muted small">Changed via account provider</span>
              </div>
            </div>
            <label className="sp-toggle-row">
              <div className="sp-toggle-info">
                <span className="field-label">Quote activity emails</span>
                <span className="muted small">Approval confirmations, customer questions, signature alerts</span>
              </div>
              <input
                type="checkbox"
                className="settings-checkbox"
                checked={form.email_notifications !== false}
                onChange={e => setForm(p => ({ ...p, email_notifications: e.target.checked }))}
              />
            </label>
          </div>
        </div>

        <div className="panel">
          <div className="eyebrow">After a customer pays</div>
          <p className="muted small settings-hint">
            Paste your review link (Google Business, etc.). When a customer pays an invoice in full, their receipt includes a one-tap "Leave a review" button — the easiest way to turn a finished job into a 5-star review.
          </p>
          <div className="stack">
            <label className="field">
              <span className="field-label">Review link</span>
              <input
                type="url"
                className="jd-input"
                inputMode="url"
                placeholder="https://g.page/r/…  ·  paste your Google review link"
                value={form.review_link || ''}
                onChange={e => setForm(p => ({ ...p, review_link: e.target.value }))}
              />
            </label>
            {form.review_link?.trim() && !/^https?:\/\//i.test(form.review_link.trim()) && (
              <span className="muted small" style={{ color: 'var(--amber-text, #b45309)' }}>
                Add the full link starting with https:// so the button works.
              </span>
            )}
            <span className="muted small">
              Find it in your Google Business profile → "Ask for reviews" → copy link. Leave blank to skip the review ask.
            </span>
          </div>
        </div>

        <div className="panel">
          <div className="eyebrow">Quote tracking</div>
          <p className="muted small settings-hint">
            Know where every quote stands. No more guessing if your customer saw it.
          </p>
          <div className="sp-tracking-grid">
            <div className="flex-row-gap-8"><span className="sp-check-green">✓</span> View counts and timestamps on every sent quote</div>
            <div className="flex-row-gap-8"><span className="sp-check-green">✓</span> Instant alert when a customer opens your quote</div>
            <div className="flex-row-gap-8"><span className="sp-check-green">✓</span> Follow-up prompts based on viewing patterns</div>
            <div className="flex-row-gap-8"><span className="sp-check-green">✓</span> Approval and signature notifications</div>
          </div>
        </div>
        </>}

        {/* ═══ ACCOUNT TAB ═══ */}
        {settingsTab === 'account' && <>
        {/* 7G: Data & Privacy */}
        <div className="panel">
          <div className="eyebrow">Data &amp; Privacy</div>
          <p className="muted small settings-hint">
            Export all your data or permanently delete your account. Required for PIPEDA and GDPR compliance.
          </p>
          <div className="stack">
            <button className="btn btn-secondary" type="button" disabled={exporting} onClick={handleExportData}>
              {exporting ? 'Exporting…' : 'Export all my data (CSV)'}
            </button>
            <hr className="sp-divider" />
            {!deleteConfirm ? (
              <button className="btn btn-secondary sp-delete-btn" type="button" onClick={() => setDeleteConfirm(true)}>Delete my account</button>
            ) : !deleteConfirm2 ? (
              <div>
                <p className="sp-delete-warning">Are you sure? This will permanently delete all your quotes, contacts, invoices, and bookings.</p>
                <div className="sp-delete-actions">
                  <button className="btn btn-secondary" type="button" onClick={() => setDeleteConfirm(false)}>Cancel</button>
                  <button className="btn btn-secondary sp-delete-confirm" type="button" onClick={() => setDeleteConfirm2(true)}>Yes, I understand</button>
                </div>
              </div>
            ) : (
              <div>
                <p className="sp-delete-final">Final confirmation — this cannot be undone.</p>
                <div className="sp-delete-actions">
                  <button className="btn btn-secondary" type="button" onClick={() => { setDeleteConfirm(false); setDeleteConfirm2(false); }}>Cancel</button>
                  <button className="btn btn-primary sp-delete-exec" type="button" disabled={deleting} onClick={handleDeleteAccount}>
                    {deleting ? 'Deleting…' : 'Permanently delete everything'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* About */}
        <div className="panel sp-about-panel">
          <div className="eyebrow">About Punchlist</div>
          <div className="stack sp-about-stack">
            <div className="muted small sp-about-text">
              Punchlist is a trades-first quoting and job planning tool for small businesses in Canada and the United States.
              Built for speed, clarity, and customer trust — not to replace your accounting software.
            </div>
            <div className="muted small">
              Questions? Email <a href="mailto:hello@punchlist.ca" className="sp-about-link">hello@punchlist.ca</a>
            </div>
          </div>
        </div>
        </>}

        {/* Explicit save — hidden on tabs with no editable profile/business form */}
        {settingsTab !== 'account' && settingsTab !== 'notifications' && (
          <div className="sp-save-footer">
            <button className="btn btn-primary btn-sm" type="button" disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save now'}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
