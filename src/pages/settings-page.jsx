import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/app-shell';
import { getProfile, friendly, updateProfile, uploadLogo, exportAllData, deleteAccount, exportInvoicesQuickBooks, exportInvoicesXero, listInvoices } from '../lib/api';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../components/toast';
import { useTheme } from '../contexts/theme-context';
import { supabase } from '../lib/supabase';

import { TRADES, normalizeTrade } from '../../shared/tradeBrain';
import { CA_PROVINCES, US_STATES, REGION_LABELS } from '../lib/pricing';
import { PRICING } from '../lib/billing';
const EXPIRY_OPTIONS = [
  { value: 7,  label: '7 days' },
  { value: 14, label: '14 days (default)' },
  { value: 21, label: '21 days' },
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
];

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
    invoice_due_days: 14,
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
  });
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const { theme, setTheme } = useTheme();
  const saveTimer = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteConfirm2, setDeleteConfirm2] = useState(false);

  // Auto-save: debounce 1.5s after any form change
  const formJson = JSON.stringify(form);
  const initialLoad = useRef(true);
  const lastSavedJson = useRef('');
  useEffect(() => {
    if (initialLoad.current) { initialLoad.current = false; return; }
    // Don't save if form matches what we last loaded/saved
    if (formJson === lastSavedJson.current) return;
    if (!user || !form.full_name.trim()) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await updateProfile(user.id, form);
        lastSavedJson.current = formJson;
        showToast('Settings saved', 'success');
      } catch (e) { showToast(friendly(e), 'error'); }
      finally { setSaving(false); }
    }, 1500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [formJson]);

  useEffect(() => {
    if (!user) return;
    getProfile(user.id).then(p => {
      if (p) {
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
          invoice_due_days: Number(p.invoice_due_days ?? 14),
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
        };
        lastSavedJson.current = JSON.stringify(loaded);
        setForm(loaded);
      }
    }).catch(e => showToast(friendly(e), 'error'));
  }, [user]);

  // Manual save still available as backup
  async function save() {
    if (!form.full_name.trim()) return showToast('Your name is required', 'error');
    setSaving(true);
    try {
      await updateProfile(user.id, form);
      lastSavedJson.current = JSON.stringify(form);
      showToast('Settings saved', 'success');
    } catch (e) { showToast(friendly(e), 'error'); }
    finally { setSaving(false); }
  }

  async function updatePw() {
    if (pw.next.length < 8) return showToast('8+ characters required', 'error');
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
      if (!invoices.length) { showToast('No invoices to export', 'error'); return; }
      if (format === 'quickbooks') exportInvoicesQuickBooks(invoices);
      else exportInvoicesXero(invoices);
      showToast(`Exported ${invoices.length} invoices`, 'success');
    } catch (e) { showToast(friendly(e), 'error'); }
  }

  return (
    <AppShell title="Settings">
      <div className="settings-grid">

        {/* Appearance */}
        <div className="panel">
          <div className="eyebrow">Appearance</div>
          <p className="muted small" style={{ marginTop: 4, marginBottom: 16, lineHeight: 1.5 }}>
            Choose how Punchlist looks on your device.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { id: 'light', label: 'Light', icon: '☀️', desc: 'Warm, clean, easy on the eyes' },
              { id: 'dark', label: 'Dark', icon: '🌙', desc: 'Low-light, high contrast' },
            ].map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTheme(opt.id)}
                style={{
                  flex: 1,
                  padding: '16px 14px',
                  borderRadius: 'var(--r)',
                  border: theme === opt.id ? '2px solid var(--brand)' : '1px solid var(--line-2)',
                  background: theme === opt.id ? 'var(--brand-bg)' : 'var(--panel-2)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all .15s ease',
                  fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>{opt.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.01em' }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Business profile */}
        <div className="panel">
          <div className="eyebrow">Business profile</div>
          <p className="muted small" style={{ marginTop: 4, marginBottom: 16, lineHeight: 1.5 }}>
            This appears on quotes sent to customers and in notification emails.
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
                  📷 Upload image
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
                <span style={{ fontSize: 11, color: 'var(--subtle)' }}>or paste a URL:</span>
              </div>
              <input className="input" style={{ marginTop: 6 }} value={form.logo_url || ''} onChange={e => setForm(p => ({ ...p, logo_url: e.target.value }))} placeholder="https://yoursite.com/logo.png" />
              {form.logo_url && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img src={form.logo_url} alt="Logo preview" style={{ maxHeight: 48, maxWidth: 160, objectFit: 'contain', borderRadius: 4, border: '1px solid var(--line)' }} onError={e => { e.target.style.display = 'none'; }} />
                  <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => setForm(p => ({ ...p, logo_url: '' }))}>Remove</button>
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
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>/hr</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Used for labour items on new quotes. Leave blank for suggested rates.</div>
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
          <p className="muted small" style={{ marginTop: 4, marginBottom: 16, lineHeight: 1.5 }}>
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
                When you send a quote, the expiry clock starts then -- not when you create the draft.
                Expired quotes are clearly marked for the customer and flagged on your dashboard.
                You can change the expiry on any individual quote before sending.
              </div>
            </div>
            <div className="notice-banner">
              <strong>How expiry works:</strong> Quotes expire only after being sent. Drafts have no expiry.
              When a quote expires, the customer sees a clear message and can request a fresh one.
              You see expired quotes flagged on your dashboard for follow-up.
            </div>
          </div>
        </div>

        {/* Deposit defaults */}
        <div className="panel">
          <div className="eyebrow">Deposit defaults</div>
          <p className="muted small" style={{ marginTop: 4, marginBottom: 16, lineHeight: 1.5 }}>
            Set the default deposit requirement for new quotes.
          </p>
          <div className="stack">
            <div>
              <span className="field-label">Default deposit</span>
              <select className="input" value={form.default_deposit_mode} onChange={e => setForm(p => ({ ...p, default_deposit_mode: e.target.value }))}>
                <option value="none">No deposit</option>
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

        {/* Payment methods */}
        <div className="panel">
          <div className="eyebrow">Payment methods</div>
          <p className="muted small" style={{ marginTop: 4, marginBottom: 16, lineHeight: 1.5 }}>
            Choose which payment methods your customers see on quotes and invoices.
          </p>
          <div className="stack">
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: -4 }}>
              {form.country === 'US' ? 'Common in the US' : 'Common in Canada'}
            </div>
            {(form.country === 'US'
              ? ['Cash','Check','Venmo','Zelle','ACH Transfer','Square','PayPal','Other']
              : ['E-Transfer','Cash','Cheque','Square','PayPal','Other']
            ).map(m => (
              <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.payment_methods.includes(m)} onChange={e => {
                  setForm(p => ({ ...p, payment_methods: e.target.checked ? [...p.payment_methods, m] : p.payment_methods.filter(x => x !== m) }));
                }} style={{ accentColor: 'var(--brand)', width: 16, height: 16 }} />
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
                <span className="field-label">{[form.payment_methods.includes('Venmo') && 'Venmo', form.payment_methods.includes('Zelle') && 'Zelle'].filter(Boolean).join(' / ')} handle or email</span>
                <input className="input" value={form.venmo_zelle_handle || ''} onChange={e => setForm(p => ({ ...p, venmo_zelle_handle: e.target.value }))} placeholder="@yourname or email" />
              </div>
            )}
            {form.payment_methods.includes('Square') && (
              <div>
                <span className="field-label">Square payment link</span>
                <input className="input" value={form.square_payment_link || ''} onChange={e => setForm(p => ({ ...p, square_payment_link: e.target.value }))} placeholder="https://square.link/u/XXXXXXX" />
                <span className="muted small" style={{ display: 'block', marginTop: 4 }}>Paste your Square payment link. Customers will see a "Pay with Square" button on invoices.</span>
              </div>
            )}
            {form.payment_methods.includes('PayPal') && (
              <div>
                <span className="field-label">PayPal.me link or email</span>
                <input className="input" value={form.paypal_link || ''} onChange={e => setForm(p => ({ ...p, paypal_link: e.target.value }))} placeholder="https://paypal.me/yourname or email" />
              </div>
            )}
            <div>
              <span className="field-label">Stripe payment link <span className="muted small" style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></span>
              <input className="input" value={form.stripe_payment_link || ''} onChange={e => setForm(p => ({ ...p, stripe_payment_link: e.target.value }))} placeholder="https://buy.stripe.com/XXXXXXX" />
              <span className="muted small" style={{ display: 'block', marginTop: 4 }}>Paste your own Stripe payment link. When set, customers can pay deposits and invoices online through your Stripe account.</span>
            </div>
            <div>
              <span className="field-label">Payment instructions (shown to customers)</span>
              <textarea className="input textarea-md" value={form.payment_instructions} onChange={e => setForm(p => ({ ...p, payment_instructions: e.target.value }))} placeholder="e.g. E-transfer to billing@company.com — Reference: your name + invoice #" />
            </div>
          </div>
        </div>

        {/* Invoice defaults */}
        <div className="panel">
          <div className="eyebrow">Invoice defaults</div>
          <div className="stack" style={{ marginTop: 12 }}>
            <div>
              <span className="field-label">Invoice due (days)</span>
              <select className="input" value={form.invoice_due_days} onChange={e => setForm(p => ({ ...p, invoice_due_days: Number(e.target.value) }))}>
                <option value={0}>Due on receipt</option>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
              </select>
            </div>
            <div>
              <span className="field-label">Default invoice note</span>
              <textarea className="input textarea-md" value={form.invoice_note} onChange={e => setForm(p => ({ ...p, invoice_note: e.target.value }))} placeholder="e.g. Thank you for your business. Payment due within 14 days." />
            </div>
          </div>
        </div>

        {/* Terms & Conditions */}
        <div className="panel">
          <div className="eyebrow">Terms &amp; Conditions</div>
          <p className="muted small" style={{ marginTop: 4, marginBottom: 16, lineHeight: 1.5 }}>
            Optional. When set, customers must check an &ldquo;I agree&rdquo; checkbox before they can sign a quote.
            Useful for warranty terms, liability disclaimers, or cancellation policies.
          </p>
          <div>
            <span className="field-label">Terms &amp; conditions text (optional)</span>
            <textarea
              className="input textarea-md"
              style={{ minHeight: 120, fontFamily: 'inherit', fontSize: 13 }}
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
              Upgrade to unlock unlimited quotes, Smart scope builder, customer approvals, deposit collection, and more.
            </p>
            <div className="settings-pricing-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div style={{ background:'var(--panel)', border:'1px solid var(--line)', borderRadius:'var(--r)', padding:14, textAlign:'center' }}>
                <div style={{ fontSize:'1.4rem', fontWeight:800, letterSpacing:'-.03em' }}>${PRICING.monthly}</div>
                <div className="muted small">per month</div>
                <button className="btn btn-secondary full-width" style={{ marginTop:10, fontSize:11 }} type="button" onClick={() => navigate('/pricing')}>Monthly plan</button>
              </div>
              <div style={{ background:'var(--panel)', border:'2px solid var(--brand)', borderRadius:'var(--r)', padding:14, textAlign:'center', position:'relative' }}>
                <div style={{ position:'absolute', top:-9, left:'50%', transform:'translateX(-50%)', background:'var(--brand)', color:'white', fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:'var(--r-pill)', whiteSpace:'nowrap' }}>BEST VALUE</div>
                <div style={{ fontSize:'1.4rem', fontWeight:800, letterSpacing:'-.03em' }}>${PRICING.annual}</div>
                <div className="muted small">per year · save ${PRICING.annualSavings}</div>
                <button className="btn btn-primary full-width" style={{ marginTop:10, fontSize:11 }} type="button" onClick={() => navigate('/pricing')}>Yearly plan</button>
              </div>
            </div>
            <div className="muted small" style={{ textAlign:'center' }}>30-day free trial · no credit card required · cancel anytime</div>
          </div>
        </div>

        {/* 7E: Daily Digest */}
        <div className="panel">
          <div className="eyebrow">Daily Digest Email</div>
          <p className="muted small" style={{ marginTop: 4, marginBottom: 16, lineHeight: 1.5 }}>
            Get a morning summary of quotes needing action, today's jobs, and overdue invoices.
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.digest_enabled} onChange={e => setForm(p => ({ ...p, digest_enabled: e.target.checked }))} style={{ accentColor: 'var(--brand)', width: 16, height: 16 }} />
            Send daily digest email
          </label>
          <p className="muted small" style={{ marginTop: 8 }}>
            Digest is sent on your first visit each day. No cron required.
          </p>
        </div>

        {/* 7F: Accounting Export */}
        <div className="panel">
          <div className="eyebrow">Accounting Export</div>
          <p className="muted small" style={{ marginTop: 4, marginBottom: 16, lineHeight: 1.5 }}>
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
          <p className="muted small" style={{ marginTop: 4, marginBottom: 16, lineHeight: 1.5 }}>
            Export all your data or permanently delete your account. Required for PIPEDA and GDPR compliance.
          </p>
          <div className="stack">
            <button className="btn btn-secondary" type="button" disabled={exporting} onClick={handleExportData}>
              {exporting ? 'Exporting…' : 'Export all my data (CSV)'}
            </button>
            <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '4px 0' }} />
            {!deleteConfirm ? (
              <button className="btn btn-secondary" type="button" style={{ color: 'var(--danger)' }} onClick={() => setDeleteConfirm(true)}>Delete my account</button>
            ) : !deleteConfirm2 ? (
              <div>
                <p style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 600, marginBottom: 8 }}>Are you sure? This will permanently delete all your quotes, contacts, invoices, and bookings.</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary" type="button" onClick={() => setDeleteConfirm(false)}>Cancel</button>
                  <button className="btn btn-secondary" type="button" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => setDeleteConfirm2(true)}>Yes, I understand</button>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 700, marginBottom: 8 }}>Final confirmation — this cannot be undone.</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary" type="button" onClick={() => { setDeleteConfirm(false); setDeleteConfirm2(false); }}>Cancel</button>
                  <button className="btn btn-primary" type="button" disabled={deleting} style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={handleDeleteAccount}>
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
              Built for speed, clarity, and customer trust -- not to replace your accounting software.
            </div>
            <div className="muted small">
              Questions? Email <a href="mailto:hello@punchlist.ca" style={{ color: 'var(--brand-dark)' }}>hello@punchlist.ca</a>
            </div>
          </div>
        </div>

        {/* Single save button + auto-save indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '4px 0 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving ? (
              <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Saving…</>
            ) : (
              <><span style={{ color: 'var(--green)' }}>✓</span> Changes save automatically</>
            )}
          </div>
          <button className="btn btn-primary btn-sm" type="button" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save now'}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
