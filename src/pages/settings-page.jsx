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

import { TRADES, normalizeTrade } from '../../shared/tradeBrain';
import { CA_PROVINCES, US_STATES, REGION_LABELS } from '../lib/pricing';
import { PRICING, isPro } from '../lib/billing';
import {
  listTemplates,
  upsertTemplate,
  resetTemplate,
  TEMPLATE_KEYS,
  PRO_REQUIRED_CODE,
} from '../lib/api/templates';
import TemplateEditor from '../components/template-editor';
import { GLOBAL_SHORTCUTS } from '../components/command-palette/actions';
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
        body: JSON.stringify({ user_id: userId, subscription: sub.toJSON() }),
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
        body: JSON.stringify({ user_id: userId, action: 'unsubscribe' }),
      });
      setStatus('prompt');
    } catch { }
    setWorking(false);
  }

  if (status === 'loading') return null;
  if (status === 'unsupported') return <div className="muted small">Push notifications are not supported in this browser.</div>;
  if (status === 'denied') return <div className="muted small" style={{ color: 'var(--amber)' }}>Notifications are blocked. Enable them in your browser settings to receive push alerts.</div>;

  if (status === 'subscribed') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--green)', fontWeight: 600 }}>✓ Push notifications enabled</div>
        <button className="btn btn-secondary btn-sm" type="button" disabled={working} onClick={unsubscribe} style={{ marginTop: 10, fontSize: 'var(--text-xs)' }}>
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
  const [form, setForm] = useState({
    full_name: '',
    company_name: '',
    trade: 'Plumber',
    province: 'ON',
    country: 'CA',
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
    stripe_invoices_enabled: false,
    stripe_payment_link: '',
    venmo_zelle_handle: '',
    square_payment_link: '',
    paypal_link: '',
    terms_conditions: '',
    digest_enabled: false,
    sms_notifications_enabled: false,
  });
  const [saving, setSaving] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [connectStatus, setConnectStatus] = useState(null);
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
        }).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    getProfile(user.id).then(p => {
      if (p) {
        setProfile(p);
        // Cadence (followup_cadence_days jsonb). Fall back to defaults if column missing.
        const cd = (p.followup_cadence_days && typeof p.followup_cadence_days === 'object')
          ? p.followup_cadence_days
          : { nudge_1: 2, nudge_2: 4, nudge_3: 7 };
        setCadence({
          nudge_1: Number(cd.nudge_1 ?? 2),
          nudge_2: Number(cd.nudge_2 ?? 4),
          nudge_3: Number(cd.nudge_3 ?? 7),
        });
        // v100 M5 §5.5: auto-send invoice pref (default true)
        setAutoSendInvoice(p.auto_send_invoice_on_complete !== false);
        const loaded = {
          full_name: p.full_name || '',
          company_name: p.company_name || '',
          trade: normalizeTrade(p.trade || 'Plumber'),
          province: p.province || 'ON',
          country: p.country || 'CA',
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
          stripe_invoices_enabled: Boolean(p.stripe_invoices_enabled),
          stripe_payment_link: p.stripe_payment_link || '',
          venmo_zelle_handle: p.venmo_zelle_handle || '',
          square_payment_link: p.square_payment_link || '',
          paypal_link: p.paypal_link || '',
          terms_conditions: p.terms_conditions || '',
          digest_enabled: Boolean(p.digest_enabled),
          sms_notifications_enabled: Boolean(p.sms_notifications_enabled),
        };
        lastSavedJson.current = JSON.stringify(loaded);
        setForm(loaded);
      }
    }).catch(e => showToast(friendly(e), 'error'));
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

  // ── Stripe Connect status check ──
  useEffect(() => {
    if (!user) return;
    fetch('/api/connect-onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'status', userId: user.id }),
    }).then(r => r.json()).then(setConnectStatus).catch(() => {});
  }, [user]);

  // Handle return from Stripe Connect onboarding
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connect') === 'complete' && user) {
      fetch('/api/connect-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', userId: user.id }),
      }).then(r => r.json()).then(data => {
        setConnectStatus(data);
        if (data.onboarded) showToast('Payments connected — you\'re all set.', 'success');
        else showToast('Stripe setup isn\'t finished. Pick it back up below.', 'warning');
      }).catch(() => {});
      window.history.replaceState({}, '', '/app/settings');
    }
    if (params.get('connect') === 'refresh' && user) {
      handleConnectSetup();
    }
  }, [user]);

  async function handleConnectSetup() {
    setConnectLoading(true);
    try {
      const action = connectStatus?.connected ? 'refresh' : 'create';
      const r = await fetch('/api/connect-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userId: user.id }),
      });
      const data = await r.json();
      if (data.url) window.location.href = data.url;
      else showToast('Couldn\'t start Stripe setup. Try again in a moment.', 'error');
    } catch (e) { showToast('Couldn\'t reach Stripe. Try again in a moment.', 'error'); }
    finally { setConnectLoading(false); }
  }

  async function openStripeDashboard() {
    setStripeDashLoading(true);
    try {
      const r = await fetch('/api/connect-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dashboard', userId: user.id }),
      });
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
      const count = await exportAllData(user.id);
      showToast(`Exported ${count} files`, 'success');
    } catch (e) { showToast(friendly(e), 'error'); }
    finally { setExporting(false); }
  }

  // 7G: Delete account
  async function handleDeleteAccount() {
    if (!user || !deleteConfirm || !deleteConfirm2) return;
    setDeleting(true);
    try {
      await deleteAccount(user.id);
      window.location.href = '/'; // Full reload intentional — clears auth state after account deletion
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
      if (format === 'quickbooks') exportInvoicesQuickBooks(invoices);
      else exportInvoicesXero(invoices);
      showToast(`Exported ${invoices.length} invoices`, 'success');
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
      <div className="settings-tabs">
        {[
          { id: 'profile', label: 'Profile' },
          { id: 'payments', label: 'Payments' },
          { id: 'messages', label: 'Messages' },
          { id: 'notifications', label: 'Notifications' },
          { id: 'preferences', label: 'Preferences' },
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
        <div className="panel">
          <div className="eyebrow">Business profile</div>
          <p className="muted small settings-hint">
            This appears on quotes and invoices sent to your customers.
          </p>
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
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
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
                <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--subtle)' }}>or paste a URL:</span>
              </div>
              <input className="input" style={{ marginTop: 6 }} value={form.logo_url || ''} onChange={e => setForm(p => ({ ...p, logo_url: e.target.value }))} placeholder="https://yoursite.com/logo.png" />
              {form.logo_url && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img src={form.logo_url} alt="Logo preview" style={{ maxHeight: 48, maxWidth: 160, objectFit: 'contain', borderRadius: 4, border: '1px solid var(--line)' }} onError={e => { e.target.style.display = 'none'; }} />
                  <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: 'var(--text-2xs)' }} onClick={() => setForm(p => ({ ...p, logo_url: '' }))}>Remove</button>
                </div>
              )}
            </div>
            <div className="form-row">
              <div>
                <span className="field-label">Trade</span>
                <select className="input" value={form.trade} onChange={e => setForm(p => ({ ...p, trade: e.target.value }))}>
                  {TRADES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <span className="field-label">Country</span>
                <select className="input" value={form.country} onChange={e => { const c = e.target.value; setForm(p => ({ ...p, country: c, province: c === 'US' ? 'CA' : 'ON' })); }}>
                  <option value="CA">Canada</option>
                  <option value="US">United States</option>
                </select>
              </div>
              <div>
                <span className="field-label">{form.country === 'US' ? 'State' : 'Province'} (sets tax rate)</span>
                <select className="input" value={form.province} onChange={e => setForm(p => ({ ...p, province: e.target.value }))}>
                  {(form.country === 'US' ? US_STATES : CA_PROVINCES).map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div>
                <span className="field-label">Default hourly labour rate (optional)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--muted)', fontWeight: 600 }}>$</span>
                  <input className="input" type="number" min="0" step="5" value={form.default_labour_rate || ''} onChange={e => setForm(p => ({ ...p, default_labour_rate: Number(e.target.value) || 0 }))} placeholder="e.g. 165" style={{ maxWidth: 120 }} />
                  <span style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)' }}>/hr</span>
                </div>
                <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--muted)', marginTop: 4 }}>Used for labour items on new quotes. Leave blank for suggested rates.</div>
              </div>
            </div>
            <div>
              <span className="field-label">Phone (shown on customer quotes with click-to-call)</span>
              <input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+1 (403) 555-0100" />
            </div>
            <div>
              <span className="field-label">Account email (where approval notifications are sent)</span>
              <input className="input" value={user?.email || ''} readOnly style={{ background: 'var(--panel-2)', color: 'var(--muted)' }} />
              <div className="muted small" style={{ marginTop: 4 }}>This is your login email. Change it through your account provider.</div>
            </div>
          </div>
        </div>

        {/* Quote defaults */}
        <div className="panel">
          <div className="eyebrow">Quote defaults</div>
          <p className="muted small settings-hint">
            These values are applied automatically to every new quote. You can always override them per-quote in the quote builder.
          </p>
          <div className="stack">
            <div>
              <span className="field-label">Default quote expiry</span>
              <select
                className="input"
                value={form.default_expiry_days}
                onChange={e => setForm(p => ({ ...p, default_expiry_days: Number(e.target.value) }))}
              >
                {EXPIRY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <div className="muted small" style={{ marginTop: 6, lineHeight: 1.5 }}>
                The clock starts when you send, not when you create the draft.
              </div>
            </div>
            <div className="notice-banner">
              Quotes expire {form.default_expiry_days} days after being sent. Drafts have no expiry.
            </div>
          </div>
        </div>

        {/* ═══ QUOTE TRACKING — explainer ═══ */}
        <div className="panel">
          <div className="eyebrow">Quote Tracking</div>
          <p className="muted small" style={{ marginTop: 4, marginBottom: 12, lineHeight: 1.5 }}>
            Every quote you send is tracked automatically. You'll see when your customer opens it, how many times they've viewed it, and get prompted when it's time to follow up. No extra setup needed.
          </p>
          <div style={{ display: 'grid', gap: 8, fontSize: 'var(--text-xs)', color: 'var(--text-2)' }}>
            <div className="flex-row-gap-8">View counts and timestamps on every sent quote</div>
            <div className="flex-row-gap-8">Notifications when a customer opens your quote</div>
            <div className="flex-row-gap-8">Follow-up prompts based on viewing patterns</div>
          </div>
        </div>
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
          <div style={{ background: 'var(--surface-alt, #f8f9fa)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Punchlist Payments</span>
              {connectLoading && !connectStatus && (
                <span style={{ width: 64, height: 18, borderRadius: 99, background: 'var(--line)', display: 'inline-block', animation: 'skel-pulse 1.4s ease-in-out infinite' }} />
              )}
              {connectStatus?.onboarded && <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 600, color: 'var(--green)', background: 'var(--green-bg)', padding: '2px 8px', borderRadius: 99 }}>Active</span>}
            </div>
            {connectStatus === null && !connectLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ height: 12, borderRadius: 4, background: 'var(--line)', width: '85%', animation: 'skel-pulse 1.4s ease-in-out infinite' }} />
                <div style={{ height: 12, borderRadius: 4, background: 'var(--line)', width: '60%', animation: 'skel-pulse 1.4s ease-in-out infinite' }} />
                <div style={{ height: 36, borderRadius: 8, background: 'var(--line)', marginTop: 4, animation: 'skel-pulse 1.4s ease-in-out infinite' }} />
              </div>
            ) : !connectStatus?.onboarded ? (
              <>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, letterSpacing: '-.02em', color: 'var(--text)', marginBottom: 6 }}>
                  You get paid in full. Customers pay monthly.
                </div>
                <p className="muted small" style={{ lineHeight: 1.6, marginBottom: 4 }}>
                  When a customer chooses monthly payments, Affirm pays you the full amount upfront within 2 business days. The customer repays Affirm over 3–12 months. You don't wait.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, margin: '12px 0', textAlign: 'center' }}>
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
                <Link className="btn btn-primary" to="/app/payments/setup" style={{ width: '100%', textDecoration: 'none', textAlign: 'center', fontSize: 'var(--text-base)', padding: '12px 16px' }}>
                  {connectStatus?.connected ? 'Finish setup — takes 2 minutes →' : 'Turn on customer financing →'}
                </Link>
                <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--subtle)', textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>
                  No monthly fee · No setup fee · Small processing fee per transaction
                </div>
              </>
            ) : (
              <>
                <p className="muted small" style={{ lineHeight: 1.6, marginBottom: 10 }}>
                  Customers can pay by card or choose monthly payments on jobs over $500. You get the full amount within 2 business days.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary" onClick={openStripeDashboard} disabled={stripeDashLoading} style={{ fontSize: 'var(--text-xs)' }}>
                    {stripeDashLoading ? 'Opening…' : 'View Stripe Dashboard →'}
                  </button>
                  <Link to="/app/payments-setup" className="btn btn-secondary" style={{ fontSize: 'var(--text-xs)', textDecoration: 'none' }}>
                    How it works →
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* ── Deposit defaults ── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Deposits</div>
            <div className="stack">
              <div>
                <span className="field-label">Default deposit on new quotes</span>
                <select className="input" value={form.default_deposit_mode} onChange={e => setForm(p => ({ ...p, default_deposit_mode: e.target.value }))}>
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
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Invoice terms</div>
            <div className="stack">
              <div>
                <span className="field-label">Due date</span>
                <select className="input" value={form.invoice_due_days} onChange={e => setForm(p => ({ ...p, invoice_due_days: Number(e.target.value) }))}>
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
            </div>
          </div>

          {/* ── Other payment methods ── */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Other payment methods</div>
            <p className="muted small" style={{ marginBottom: 12, lineHeight: 1.5 }}>
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
              <div>
                <span className="field-label">Payment instructions (shown to customers)</span>
                <textarea className="input textarea-md" value={form.payment_instructions} onChange={e => setForm(p => ({ ...p, payment_instructions: e.target.value }))} placeholder="e.g. E-transfer to billing@company.com — Reference: your name + invoice #" />
              </div>

              {/* Legacy Stripe payment link — fallback for contractors not using Connect */}
              {!connectStatus?.onboarded && (
                <div>
                  <span className="field-label">Stripe payment link (legacy — optional)</span>
                  <input className="input" value={form.stripe_payment_link} onChange={e => setForm(p => ({ ...p, stripe_payment_link: e.target.value }))} placeholder="https://buy.stripe.com/XXXXXXX" />
                  <div className="muted small" style={{ marginTop: 4 }}>Paste your own Stripe payment link as a fallback.</div>
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
              className="input textarea-md"
              style={{ minHeight: 120, fontFamily: 'inherit', fontSize: 'var(--text-sm)' }}
              value={form.terms_conditions}
              onChange={e => setForm(p => ({ ...p, terms_conditions: e.target.value }))}
              placeholder="e.g. All work is guaranteed for 1 year from the date of completion. A 25% cancellation fee applies if work is cancelled within 48 hours of the scheduled date. Customer is responsible for providing clear access to the work area…"
            />
            <p className="muted small" style={{ marginTop: 6 }}>Leave blank to hide this section from quotes.</p>
          </div>
        </div>

        {/* Password */}
        <div className="panel">
          <div className="eyebrow">Password</div>
          <div className="stack" style={{ marginTop: 12 }}>
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
        <div className="panel" style={{ background:'linear-gradient(160deg,var(--brand-bg),var(--panel))', border:'1px solid var(--brand-line)' }}>
          <div className="eyebrow">Subscription</div>
          <div className="stack" style={{ marginTop:12 }}>
            <p className="muted small" style={{ lineHeight:1.6, margin:0 }}>
              Upgrade to Pro for unlimited quotes, Foreman scope checking, deposits, scheduling, invoicing, and customer pay-over-time.
            </p>
            <div className="settings-pricing-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div style={{ background:'var(--panel)', border:'1px solid var(--line)', borderRadius:'var(--r)', padding:14, textAlign:'center' }}>
                <div style={{ fontSize:'1.4rem', fontWeight:800, letterSpacing:'-.03em' }}>${PRICING.monthly}</div>
                <div className="muted small">per month</div>
                <button className="btn btn-secondary full-width" style={{ marginTop:10, fontSize: 'var(--text-2xs)' }} type="button" onClick={() => navigate('/app/billing')}>Monthly plan</button>
              </div>
              <div style={{ background:'var(--panel)', border:'2px solid var(--brand)', borderRadius:'var(--r)', padding:'18px 14px 14px', textAlign:'center', position:'relative', overflow:'visible' }}>
                <div style={{ position:'absolute', top:-9, left:'50%', transform:'translateX(-50%)', background:'var(--brand)', color:'white', fontSize:'var(--text-2xs)', fontWeight:800, padding:'2px 8px', borderRadius:'var(--r-pill)', whiteSpace:'nowrap', zIndex:1 }}>BEST VALUE</div>
                <div style={{ fontSize:'1.4rem', fontWeight:800, letterSpacing:'-.03em' }}>${PRICING.annual}</div>
                <div className="muted small">per year · save ${PRICING.annualSavings}</div>
                <button className="btn btn-primary full-width" style={{ marginTop:10, fontSize: 'var(--text-2xs)' }} type="button" onClick={() => navigate('/app/billing')}>Yearly plan</button>
              </div>
            </div>
            <div className="muted small" style={{ textAlign:'center' }}>30-day free trial · no credit card required · cancel anytime</div>
          </div>
        </div>
        </>}

        {/* ═══ MESSAGES TAB (v100 M2) ═══ */}
        {settingsTab === 'messages' && <>
        {/* Intro / orientation */}
        <div className="panel">
          <div className="eyebrow">Customer messages</div>
          <p className="muted small settings-hint">
            These are the SMS messages Punchlist sends on your behalf — the quote
            handoff, nudges when a customer goes quiet, deposit receipts, and more.
            The defaults are tuned to lift reply rates; customize them to sound
            like you.
          </p>
          {!proAccess && (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                background: 'var(--panel-2)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-sm, 8px)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-2)',
                lineHeight: 1.5,
              }}
            >
              You're on the free plan — you can <strong>preview</strong> every
              message and <strong>reset</strong> any customization.
              Editing the wording unlocks with Pro.
            </div>
          )}
        </div>

        {/* Nudge schedule (cadence editor) */}
        <div className="panel" style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div className="eyebrow" style={{ marginBottom: 2 }}>Nudge schedule</div>
              <p className="muted small" style={{ margin: 0, lineHeight: 1.45 }}>
                How long to wait before each follow-up when a customer hasn't
                replied. Defaults to 2 / 4 / 7 days.
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 12,
              marginTop: 14,
            }}
          >
            {[
              { slot: 'nudge_1', label: 'First nudge', hint: 'after sending' },
              { slot: 'nudge_2', label: 'Second nudge', hint: 'after first' },
              { slot: 'nudge_3', label: 'Last nudge',   hint: 'after second' },
            ].map(({ slot, label, hint }) => (
              <div key={slot}>
                <span className="field-label">{label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    className="input"
                    value={cadence[slot]}
                    readOnly={!proAccess}
                    onChange={proAccess ? (e) => handleCadenceChange(slot, e.target.value) : undefined}
                    style={{
                      width: 72,
                      textAlign: 'center',
                      opacity: proAccess ? 1 : 0.72,
                      cursor: proAccess ? 'text' : 'not-allowed',
                    }}
                    aria-label={`${label} days`}
                  />
                  <span className="muted small">days {hint}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
            <div className="muted small" style={{ lineHeight: 1.4 }}>
              After the last nudge the quote moves to your dashboard's cold list —
              we stop auto-prompting so you don't over-nudge.
            </div>
            {proAccess ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!cadenceDirty}
                onClick={saveCadence}
              >
                {cadenceDirty ? 'Save schedule' : 'Saved'}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setTemplateUpsellKey('__cadence__')}
                aria-label="Unlock nudge schedule with Pro"
              >
                Pro
              </button>
            )}
          </div>

          {/* Cadence-specific upsell */}
          {!proAccess && templateUpsellKey === '__cadence__' && (
            <div
              style={{
                marginTop: 12,
                padding: 14,
                background: 'var(--brand-soft, rgba(249,115,22,.08))',
                border: '1px solid var(--brand-line, rgba(249,115,22,.3))',
                borderRadius: 'var(--r-sm, 8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                  Tune your nudge rhythm — Pro
                </div>
                <div className="muted small" style={{ lineHeight: 1.45 }}>
                  Some trades close faster, some slower. Set a cadence that
                  matches how your customers actually decide.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setTemplateUpsellKey(null)}
                >
                  Not now
                </button>
                <a className="btn btn-primary btn-sm" href="/settings?tab=billing">
                  See Pro
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Token legend */}
        <div className="panel" style={{ background: 'var(--panel-2)' }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Tokens you can use</div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)',
              fontSize: 'var(--text-2xs)',
            }}
          >
            {[
              '{firstName}', '{senderName}', '{quoteTitle}', '{total}',
              '{link}', '{monthlyEstimate}', '{depositAmount}',
              '{nextStep}', '{scheduledDate}',
            ].map(tok => (
              <span
                key={tok}
                style={{
                  padding: '3px 8px',
                  background: 'var(--panel)',
                  border: '1px solid var(--line)',
                  borderRadius: 999,
                  color: 'var(--text)',
                }}
              >
                {tok}
              </span>
            ))}
          </div>
          <p className="muted small" style={{ marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
            Type these into any message below and Punchlist will swap in the
            real values when sending. Empty tokens (like <code>{'{depositAmount}'}</code>
            when there's no deposit) disappear cleanly.
          </p>
        </div>

        {/* Per-template editors */}
        {!templatesLoaded ? (
          <div className="panel">
            <div className="muted small">Loading your messages…</div>
          </div>
        ) : (
          TEMPLATE_KEYS.map(key => {
            const row = templates.find(t => t.template_key === key);
            return (
              <TemplateEditor
                key={key}
                templateKey={key}
                body={row?.body}
                isCustom={Boolean(row?.is_custom) && !row?._isDefault}
                isPro={proAccess}
                previewTokens={previewTokens}
                onChange={handleTemplateChange}
                onReset={handleTemplateReset}
                onUpgradeClick={handleUpsellFromEditor}
                busy={templateBusyKey === key}
              />
            );
          })
        )}
        </>}

        {/* ═══ NOTIFICATIONS TAB ═══ */}
        {settingsTab === 'notifications' && <>
        {/* 7E: Daily Digest */}
        <div className="panel">
          <div className="eyebrow">Daily Digest Email</div>
          <p className="muted small settings-hint">
            Get a morning summary of quotes needing action, today's jobs, and overdue invoices.
          </p>
          <label className="settings-row">
            <input type="checkbox" checked={form.digest_enabled} onChange={e => setForm(p => ({ ...p, digest_enabled: e.target.checked }))} className="settings-checkbox" />
            Send daily digest email
          </label>
          <p className="muted small" style={{ marginTop: 8 }}>
            Digest is sent on your first visit each day. No cron required.
          </p>
          <div className="pl-reflective-summary">
            <Info size={14} />
            <span>
              Currently: {form.digest_enabled
                ? 'You get a morning summary email on your first visit each day.'
                : 'Daily digest is off — no summary emails will be sent.'}
            </span>
          </div>
        </div>

        {/* 9: SMS Notifications */}
        <div className="panel">
          <div className="eyebrow">SMS Notifications</div>
          <p className="muted small settings-hint">
            Get text messages when customers view, approve, decline, or ask questions about your quotes. Your customers also get texts for booking confirmations, invoices, and payment reminders when they have a phone number on file.
          </p>
          <label className="settings-row">
            <input type="checkbox" checked={form.sms_notifications_enabled} onChange={e => setForm(p => ({ ...p, sms_notifications_enabled: e.target.checked }))} className="settings-checkbox" />
            Enable SMS notifications
          </label>
          {form.sms_notifications_enabled && !form.phone?.trim() && (
            <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.15)', borderRadius: 8, fontSize: 'var(--text-xs)', color: 'var(--amber-text)', lineHeight: 1.5 }}>
              Add your phone number above to receive SMS notifications.
            </div>
          )}
          {form.sms_notifications_enabled && form.phone?.trim() && (
            <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--green-bg, rgba(19,138,91,.04))', border: '1px solid var(--green-line, rgba(19,138,91,.12))', borderRadius: 8, fontSize: 'var(--text-xs)', color: '#15803d', lineHeight: 1.5 }}>
              ✓ Texts will be sent to <strong>{form.phone}</strong> when customers act on your quotes.
            </div>
          )}
          <div className="muted small" style={{ marginTop: 10, lineHeight: 1.5 }}>
            <strong>You'll get texts when:</strong> customer views your quote, approves, requests changes, declines, or asks a question.
            <br />
            <strong>Your customers get texts when:</strong> you send a quote, schedule a job, reschedule, send an invoice, or reply to their question — only if they have a phone number on file.
          </div>
          <div className="muted small" style={{ marginTop: 6 }}>
            SMS is priced separately at approximately $0.01 per text.
          </div>
          <div className="pl-reflective-summary">
            <Info size={14} />
            <span>
              Currently: {form.sms_notifications_enabled
                ? (form.phone?.trim()
                    ? `SMS alerts are on — texts go to ${form.phone}.`
                    : 'SMS alerts are on, but no phone number is set above.')
                : 'SMS notifications are off — you won\'t get texts for customer activity.'}
            </span>
          </div>
        </div>

        {/* Push Notifications */}
        <div className="panel">
          <div className="eyebrow">Push Notifications</div>
          <p className="muted small settings-hint">
            Get instant notifications on your phone or desktop when a customer opens or approves a quote — even when Punchlist isn't open.
          </p>
          <PushToggle userId={user?.id} />
        </div>
        </>}

        {/* ═══ PREFERENCES TAB (v100 M5 §5.5) ═══ */}
        {settingsTab === 'preferences' && <>
        <div className="panel">
          <div className="eyebrow">Invoice &amp; Completion</div>
          <p className="muted small settings-hint">
            Control what happens automatically when you complete a job.
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-base)' }}>Auto-send invoice on complete</div>
              <div className="muted small" style={{ marginTop: 4, lineHeight: 1.5 }}>
                When you tap <strong>Complete &amp; Invoice</strong>, the invoice is automatically sent to your customer by SMS and email. Turn this off to create the invoice first and review it before sending.
              </div>
            </div>
            <Toggle
              checked={autoSendInvoice}
              label="Auto-send invoice on complete"
              disabled={prefSaving}
              onChange={async (next) => {
                setAutoSendInvoice(next);
                setPrefSaving(true);
                try {
                  await updateProfile(user.id, { auto_send_invoice_on_complete: next });
                  showToast('Preference saved', 'success');
                } catch (e) {
                  setAutoSendInvoice(!next); // revert
                  showToast(friendly(e), 'error');
                } finally { setPrefSaving(false); }
              }}
            />
          </div>
          <div className="pl-reflective-summary">
            <Info size={14} />
            <span>
              Currently: {autoSendInvoice
                ? 'Invoice is sent automatically when you complete a job.'
                : 'Invoice is created but not sent — you review and send it manually.'}
            </span>
          </div>
          {autoSendInvoice && (
            <p className="pl-sender-reassurance">
              The invoice goes out as your message — from your business, not from Punchlist.
            </p>
          )}
        </div>

        {/* v100 Phase 9: Keyboard shortcuts reference */}
        <div className="panel">
          <div className="eyebrow">Keyboard shortcuts</div>
          <p className="muted small settings-hint">
            Press <kbd className="pl-kbd">⌘</kbd><kbd className="pl-kbd">K</kbd> anywhere to open the command palette — search, jump to a page, or run an action. Press <kbd className="pl-kbd">?</kbd> from any page for this list.
          </p>
          <div className="pl-settings-kbd-grid">
            {GLOBAL_SHORTCUTS.map(s => (
              <div key={s.keys + s.label} style={{ display: 'contents' }}>
                <div className="pl-kbd-label">{s.label}</div>
                <div className="pl-kbd-keys">
                  {s.keys.split(' ').map((k, i) => <kbd className="pl-kbd" key={i}>{k}</kbd>)}
                </div>
              </div>
            ))}
          </div>
        </div>
        </>}

        {/* ═══ ACCOUNT TAB ═══ */}
        {settingsTab === 'account' && <>
        {/* 7F: Accounting Export */}
        <div className="panel">
          <div className="eyebrow">Accounting Export</div>
          <p className="muted small settings-hint">
            Export your invoices in a format compatible with QuickBooks or Xero.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" type="button" onClick={() => handleAccountingExport('quickbooks')}>Export for QuickBooks</button>
            <button className="btn btn-secondary" type="button" onClick={() => handleAccountingExport('xero')}>Export for Xero</button>
          </div>
        </div>

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
            <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '4px 0' }} />
            {!deleteConfirm ? (
              <button className="btn btn-secondary" type="button" style={{ color: 'var(--red)' }} onClick={() => setDeleteConfirm(true)}>Delete my account</button>
            ) : !deleteConfirm2 ? (
              <div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--red)', fontWeight: 600, marginBottom: 8 }}>Are you sure? This will permanently delete all your quotes, contacts, invoices, and bookings.</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary" type="button" onClick={() => setDeleteConfirm(false)}>Cancel</button>
                  <button className="btn btn-secondary" type="button" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => setDeleteConfirm2(true)}>Yes, I understand</button>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--red)', fontWeight: 700, marginBottom: 8 }}>Final confirmation — this cannot be undone.</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary" type="button" onClick={() => { setDeleteConfirm(false); setDeleteConfirm2(false); }}>Cancel</button>
                  <button className="btn btn-primary" type="button" disabled={deleting} style={{ background: 'var(--red)', borderColor: 'var(--red)' }} onClick={handleDeleteAccount}>
                    {deleting ? 'Deleting…' : 'Permanently delete everything'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* About */}
        <div className="panel" style={{ background: 'var(--panel-2)' }}>
          <div className="eyebrow">About Punchlist</div>
          <div className="stack" style={{ marginTop: 10 }}>
            <div className="muted small" style={{ lineHeight: 1.6 }}>
              Punchlist is a trades-first quoting and job planning tool for small businesses in Canada and the United States.
              Built for speed, clarity, and customer trust — not to replace your accounting software.
            </div>
            <div className="muted small">
              Questions? Email <a href="mailto:hello@punchlist.ca" style={{ color: 'var(--brand-dark)' }}>hello@punchlist.ca</a>
            </div>
          </div>
        </div>
        </>}

        {/* Explicit save */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 0 20px' }}>
          <button className="btn btn-primary btn-sm" type="button" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save now'}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
