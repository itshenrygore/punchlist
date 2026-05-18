/* ═══════════════════════════════════════════════════════════════
   Punchlist — Templates Page
   SMS message templates: initial send, follow-ups, post-close.
   Pro-only editing with upgrade prompt for free users.
   ═══════════════════════════════════════════════════════════════ */
import { useEffect, useState, useCallback } from 'react';
import AppShell from '../components/app-shell';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../components/toast';
import { getProfile } from '../lib/api';
import {
  listTemplates, upsertTemplate, resetTemplate,
  renderTemplate, getSystemDefaults,
  TEMPLATE_KEYS, TEMPLATE_LABELS, TEMPLATE_HINTS, PRO_REQUIRED_CODE,
} from '../lib/api/templates';
import { isPro } from '../lib/billing';
import { Link } from 'react-router-dom';

const PREVIEW_TOKENS = {
  firstName: 'Kevin',
  senderName: 'Comfort Air HVAC',
  quoteTitle: 'Furnace + AC Replacement',
  total: '$10,800',
  depositAmount: '$1,800',
  nextStep: "I'll reach out to confirm scheduling.",
  link: 'punchlist.ca/q/abc123',
};

const PHASE_GROUPS = [
  {
    label: 'Getting the yes',
    description: 'Sent during the quote approval window.',
    keys: ['initial_sms', 'followup_1_sms', 'followup_2_sms', 'followup_3_sms'],
  },
  {
    label: 'After approval',
    description: 'Automatic messages once the job is moving.',
    keys: ['approved_thanks_sms', 'deposit_received_sms', 'invoice_ready_sms', 'job_complete_sms'],
  },
];

function TemplateCard({ template, label, hint, isProUser, onSave, onReset, saving, resetting }) {
  const isCustom = template?.is_custom && !template?._isDefault;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(template?.body || '');
  const preview = renderTemplate(draft, PREVIEW_TOKENS);
  const defaults = getSystemDefaults();
  const defaultBody = defaults[template?.template_key] || '';
  const isDirty = draft !== (template?.body || defaultBody);

  function startEdit() {
    if (!isProUser) return;
    setDraft(template?.body || defaultBody);
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(template?.body || defaultBody);
    setEditing(false);
  }

  async function save() {
    await onSave(template.template_key, draft);
    setEditing(false);
  }

  async function reset() {
    await onReset(template.template_key);
    setDraft(defaultBody);
    setEditing(false);
  }

  return (
    <div className={`tmpl-card${isCustom ? ' tmpl-card--custom' : ''}`}>
      <div className="tmpl-card-hd">
        <div className="tmpl-card-meta">
          <div className="tmpl-card-label">{label}</div>
          {isCustom && <span className="tmpl-badge">Custom</span>}
          {hint && <div className="tmpl-card-hint">{hint}</div>}
        </div>
        {!editing && isProUser && (
          <button type="button" className="btn btn-ghost btn-sm tmpl-edit-btn" onClick={startEdit}>
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="tmpl-editor">
          <textarea
            className="input tmpl-textarea"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={4}
            placeholder="Message body…"
          />
          <div className="tmpl-tokens">
            <span className="tmpl-tokens-lbl">Tokens:</span>
            {['{firstName}','{senderName}','{quoteTitle}','{total}','{link}','{depositAmount}'].map(t => (
              <button
                key={t}
                type="button"
                className="tmpl-token-chip"
                onClick={() => setDraft(d => d + t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="tmpl-preview">
            <div className="tmpl-preview-lbl">Preview (Kevin, $10,800 job)</div>
            <div className="tmpl-preview-bubble">{preview || <span style={{ opacity: .5 }}>Empty message</span>}</div>
          </div>
          <div className="tmpl-editor-actions">
            {isCustom && (
              <button type="button" className="btn btn-ghost btn-sm" disabled={resetting} onClick={reset}>
                {resetting ? 'Resetting…' : 'Reset to default'}
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={cancelEdit}>Cancel</button>
            <button type="button" className="btn btn-primary btn-sm" disabled={saving || !isDirty || !draft.trim()} onClick={save}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="tmpl-body">
          {!isProUser ? (
            <div className="tmpl-locked">
              <div className="tmpl-body-text tmpl-body-text--muted">{template?.body || defaultBody}</div>
              <div className="tmpl-lock-overlay">
                <span className="tmpl-lock-ic">🔒</span>
                <span className="tmpl-lock-lbl">Pro only</span>
              </div>
            </div>
          ) : (
            <div className="tmpl-body-text">{template?.body || defaultBody}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TemplatesPage() {
  const { user } = useAuth();
  const { show: toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [isProUser, setIsProUser] = useState(false);
  const [savingKey, setSavingKey] = useState(null);
  const [resettingKey, setResettingKey] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [profile, tmplRows] = await Promise.all([
        getProfile(user.id),
        listTemplates(user.id),
      ]);
      setIsProUser(isPro(profile));
      setTemplates(tmplRows);
    } catch (e) {
      console.warn('[PL]', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(key, body) {
    setSavingKey(key);
    try {
      const updated = await upsertTemplate(user.id, key, body);
      setTemplates(prev => prev.map(t => t.template_key === key ? updated : t));
      toast('Template saved', 'success');
    } catch (e) {
      if (e.code === PRO_REQUIRED_CODE) {
        toast('Upgrade to Pro to customize templates', 'error');
      } else {
        toast(e?.message || 'Could not save template', 'error');
      }
    } finally {
      setSavingKey(null);
    }
  }

  async function handleReset(key) {
    setResettingKey(key);
    try {
      await resetTemplate(user.id, key);
      const defaults = getSystemDefaults();
      setTemplates(prev => prev.map(t =>
        t.template_key === key
          ? { ...t, body: defaults[key], is_custom: false, _isDefault: true }
          : t
      ));
      toast('Reset to default', 'success');
    } catch (e) {
      toast(e?.message || 'Could not reset', 'error');
    } finally {
      setResettingKey(null);
    }
  }

  const tmplByKey = Object.fromEntries((templates || []).map(t => [t.template_key, t]));

  return (
    <AppShell>
      <div className="tmpl-root">
        <div className="tmpl-page-hd">
          <div>
            <h1 className="tmpl-page-title font-display">Message Templates</h1>
            <p className="tmpl-page-sub">
              Customize the texts sent to customers at each stage. Punchlist sends these automatically.
            </p>
          </div>
          {!isProUser && (
            <Link to="/app/billing" className="btn btn-primary tmpl-upgrade-btn">
              Unlock customization →
            </Link>
          )}
        </div>

        {!isProUser && (
          <div className="tmpl-pro-banner">
            <div className="tmpl-pro-banner-text">
              <strong>Pro feature</strong> — customize your message copy to match your brand voice.
              The defaults are already optimized for close rate (based on message psychology research),
              but Pro users can tune every word.
            </div>
            <Link to="/app/billing" className="btn btn-secondary tmpl-pro-cta">Upgrade to Pro</Link>
          </div>
        )}

        {loading ? (
          <div className="tmpl-skel-list">{[...Array(4)].map((_, i) => <div key={i} className="tmpl-skel-card" />)}</div>
        ) : (
          PHASE_GROUPS.map(group => (
            <div key={group.label} className="tmpl-group">
              <div className="tmpl-group-hd">
                <h2 className="tmpl-group-title">{group.label}</h2>
                <p className="tmpl-group-desc">{group.description}</p>
              </div>
              <div className="tmpl-group-cards">
                {group.keys.map(key => (
                  <TemplateCard
                    key={key}
                    template={tmplByKey[key]}
                    label={TEMPLATE_LABELS[key] || key}
                    hint={TEMPLATE_HINTS[key] || ''}
                    isProUser={isProUser}
                    onSave={handleSave}
                    onReset={handleReset}
                    saving={savingKey === key}
                    resetting={resettingKey === key}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
