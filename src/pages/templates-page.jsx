/* ═══════════════════════════════════════════════════════════════
   Punchlist — Templates Page
   Two tabs:
   1. Message Templates — SMS copy sent automatically at each stage
   2. Job Templates — saved quote blueprints for common job types
   ═══════════════════════════════════════════════════════════════ */
import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '../components/app-shell';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../components/toast';
import { getProfile, createQuote } from '../lib/api';
import {
  listTemplates, upsertTemplate, resetTemplate,
  renderTemplate, getSystemDefaults,
  TEMPLATE_KEYS, TEMPLATE_LABELS, TEMPLATE_HINTS, PRO_REQUIRED_CODE,
} from '../lib/api/templates';
import {
  listJobTemplates, saveJobTemplate, deleteJobTemplate, incrementTemplateUseCount,
} from '../lib/api/job-templates';
import { isPro } from '../lib/billing';
import { currency } from '../lib/format';

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

/* ─── Message Template Card ─── */
function TemplateCard({ template, label, hint, isProUser, onSave, onReset, saving, resetting }) {
  const isCustom = template?.is_custom && !template?._isDefault;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(template?.body || '');
  const textareaRef = useRef(null);
  // Sync draft when the template prop reloads (e.g. after a save round-trip)
  // so we don't show stale body. Only sync when not actively editing —
  // otherwise we'd wipe the user's in-progress edits on every reload.
  useEffect(() => {
    if (!editing) setDraft(template?.body || '');
  }, [template?.body, template?.template_key, editing]);

  // Insert a token at the textarea's current cursor position so users
  // editing mid-message don't lose their place. Append at the end if
  // the textarea hasn't been focused yet.
  function insertToken(token) {
    const ta = textareaRef.current;
    if (!ta) { setDraft(d => d + token); return; }
    const start = ta.selectionStart ?? draft.length;
    const end = ta.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + token + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      try {
        ta.focus();
        const pos = start + token.length;
        ta.setSelectionRange(pos, pos);
      } catch { /* noop */ }
    });
  }
  const preview = renderTemplate(draft, PREVIEW_TOKENS);
  const defaults = getSystemDefaults();
  const defaultBody = defaults[template?.template_key] || '';
  const isDirty = draft !== (template?.body || defaultBody);

  function startEdit() {
    if (!isProUser) return;
    setDraft(template?.body || defaultBody);
    setEditing(true);
  }
  function cancelEdit() { setDraft(template?.body || defaultBody); setEditing(false); }
  async function save() { await onSave(template.template_key, draft); setEditing(false); }
  async function reset() { await onReset(template.template_key); setDraft(defaultBody); setEditing(false); }

  return (
    <div className={`tmpl-card${isCustom ? ' tmpl-card--custom' : ''}`}>
      <div className="tmpl-card-hd">
        <div className="tmpl-card-meta">
          <div className="tmpl-card-label">{label}</div>
          {isCustom && <span className="tmpl-badge">Custom</span>}
          {hint && <div className="tmpl-card-hint">{hint}</div>}
        </div>
        {!editing && isProUser && (
          <button type="button" className="btn btn-ghost btn-sm tmpl-edit-btn" onClick={startEdit}>Edit</button>
        )}
      </div>
      {editing ? (
        <div className="tmpl-editor">
          <textarea
            ref={textareaRef}
            className="input tmpl-textarea"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={4}
            placeholder="Message body…"
          />
          <div className="tmpl-tokens">
            <span className="tmpl-tokens-lbl">Tokens:</span>
            {['{firstName}','{senderName}','{quoteTitle}','{total}','{link}','{depositAmount}'].map(t => (
              <button key={t} type="button" className="tmpl-token-chip" onClick={() => insertToken(t)}>{t}</button>
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

/* ─── Job Template Card ─── */
function JobTemplateCard({ tmpl, onUse, onEdit, onDelete, using }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const lineItems = tmpl.line_items || [];
  const pricedItems = lineItems.filter(li => li.unit_price > 0);
  const subtotal = pricedItems.reduce((s, li) => s + (li.unit_price * (li.quantity || 1)), 0);

  return (
    <div className="jt-card">
      <div className="jt-card-hd">
        <div className="jt-card-meta">
          <div className="jt-card-name">{tmpl.name}</div>
          <div className="jt-card-info">
            {tmpl.trade && <span className="jt-tag">{tmpl.trade}</span>}
            {tmpl.province && <span className="jt-tag">{tmpl.province}</span>}
            <span className="jt-tag">{lineItems.length} item{lineItems.length !== 1 ? 's' : ''}</span>
            {subtotal > 0 && <span className="jt-tag jt-tag--value">{currency(subtotal)}</span>}
            {tmpl.use_count > 0 && <span className="jt-tag jt-tag--used">Used {tmpl.use_count}×</span>}
          </div>
          {tmpl.description && (
            <div className="jt-card-desc">{tmpl.description.slice(0, 100)}{tmpl.description.length > 100 ? '…' : ''}</div>
          )}
        </div>
        <div className="jt-card-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onUse(tmpl)}
            disabled={using}
          >
            {using ? 'Creating…' : 'Use template →'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(tmpl)}>Edit</button>
          {!confirmDelete ? (
            <button type="button" className="btn btn-ghost btn-sm jt-delete-btn" onClick={() => setConfirmDelete(true)}>Delete</button>
          ) : (
            <div className="jt-delete-confirm">
              <span className="jt-delete-confirm-lbl">Delete?</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>No</button>
              <button type="button" className="btn btn-sm jt-delete-yes" onClick={() => onDelete(tmpl.id)}>Yes, delete</button>
            </div>
          )}
        </div>
      </div>
      {lineItems.length > 0 && (
        <div className="jt-items">
          {lineItems.slice(0, 3).map((li, i) => (
            <div key={i} className="jt-item-row">
              <span className="jt-item-name">{li.name}</span>
              {li.unit_price > 0 && <span className="jt-item-price">{currency(li.unit_price)}</span>}
            </div>
          ))}
          {lineItems.length > 3 && (
            <div className="jt-item-more">+{lineItems.length - 3} more items</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Job Template Edit Modal ─── */
function JobTemplateModal({ tmpl, onSave, onClose, saving, isNew }) {
  const [name, setName] = useState(tmpl?.name || '');
  const [trade, setTrade] = useState(tmpl?.trade || '');
  const [description, setDescription] = useState(tmpl?.description || '');
  const nameRef = useRef(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  function handleSave() {
    if (!name.trim()) return;
    onSave({ ...tmpl, name: name.trim(), trade: trade || tmpl?.trade, description: description || tmpl?.description });
  }

  return (
    <div className="jt-modal-bg" onClick={onClose}>
      <div className="jt-modal" onClick={e => e.stopPropagation()}>
        <div className="jt-modal-hd">
          <h3 className="jt-modal-title">{isNew ? 'New job template' : tmpl?.id ? 'Edit template' : 'Save as job template'}</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="jt-modal-body">
          <label className="jt-modal-label">Template name</label>
          <input
            ref={nameRef}
            type="text"
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Full HVAC Replacement, Panel Upgrade 200A…"
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose(); }}
          />
          {(isNew || trade || description) && (
            <>
              <label className="jt-modal-label" style={{ marginTop: 12 }}>Trade</label>
              <input className="input" value={trade} onChange={e => setTrade(e.target.value)} placeholder="e.g. Electrician, Plumber, HVAC…" />
              <label className="jt-modal-label" style={{ marginTop: 12 }}>Default scope description</label>
              <textarea className="input" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe what this template covers…" />
            </>
          )}
          {!isNew && (
            <p className="jt-modal-hint">
              Saves the trade, description, province, and all line items as a reusable starting point.
            </p>
          )}
          {isNew && (
            <p className="jt-modal-hint">
              Create a blank template. You can add line items later by using the template and saving the quote back.
            </p>
          )}
        </div>
        <div className="jt-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={saving || !name.trim()} onClick={handleSave}>
            {saving ? 'Saving…' : isNew ? 'Create template' : 'Save template'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function TemplatesPage() {
  const { user } = useAuth();
  const { show: toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'jobs' ? 'jobs' : 'messages';

  const [loading, setLoading]         = useState(true);
  const [templates, setTemplates]     = useState([]);
  const [isProUser, setIsProUser]     = useState(false);
  const [savingKey, setSavingKey]     = useState(null);
  const [resettingKey, setResettingKey] = useState(null);

  const [jobTemplates, setJobTemplates]   = useState([]);
  const [jobLoading, setJobLoading]       = useState(true);
  const [editingTmpl, setEditingTmpl]     = useState(null);
  const [creatingNew, setCreatingNew]     = useState(false);
  const [savingTmpl, setSavingTmpl]       = useState(false);
  const [usingTmplId, setUsingTmplId]     = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [profile, tmplRows] = await Promise.all([getProfile(user.id), listTemplates(user.id)]);
      setIsProUser(isPro(profile));
      setTemplates(tmplRows);
    } catch (e) { console.warn('[PL]', e); }
    finally { setLoading(false); }
  }, [user]);

  const loadJobTemplates = useCallback(async () => {
    if (!user) return;
    setJobLoading(true);
    try {
      const rows = await listJobTemplates(user.id);
      setJobTemplates(rows);
    } catch (e) { console.warn('[PL]', e); }
    finally { setJobLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadJobTemplates(); }, [loadJobTemplates]);

  async function handleSaveMessage(key, body) {
    setSavingKey(key);
    try {
      const updated = await upsertTemplate(user.id, key, body);
      setTemplates(prev => prev.map(t => t.template_key === key ? updated : t));
      toast('Template saved', 'success');
    } catch (e) {
      if (e.code === PRO_REQUIRED_CODE) toast('Upgrade to Pro to customize templates', 'error');
      else toast(e?.message || 'Could not save template', 'error');
    } finally { setSavingKey(null); }
  }

  async function handleResetMessage(key) {
    setResettingKey(key);
    try {
      await resetTemplate(user.id, key);
      const defaults = getSystemDefaults();
      setTemplates(prev => prev.map(t =>
        t.template_key === key ? { ...t, body: defaults[key], is_custom: false, _isDefault: true } : t
      ));
      toast('Reset to default', 'success');
    } catch (e) { toast(e?.message || 'Could not reset', 'error'); }
    finally { setResettingKey(null); }
  }

  async function handleSaveJobTemplate(updatedTmpl) {
    setSavingTmpl(true);
    try {
      const saved = await saveJobTemplate(user.id, updatedTmpl);
      setJobTemplates(prev => {
        const idx = prev.findIndex(t => t.id === saved.id);
        if (idx >= 0) { const n = [...prev]; n[idx] = saved; return n; }
        return [saved, ...prev];
      });
      toast('Template saved', 'success');
      setEditingTmpl(null);
    } catch (e) { toast(e?.message || 'Could not save template', 'error'); }
    finally { setSavingTmpl(false); }
  }

  async function handleDeleteJobTemplate(templateId) {
    try {
      await deleteJobTemplate(user.id, templateId);
      setJobTemplates(prev => prev.filter(t => t.id !== templateId));
      toast('Template deleted', 'success');
    } catch (e) { toast(e?.message || 'Could not delete', 'error'); }
  }

  async function handleUseTemplate(tmpl) {
    setUsingTmplId(tmpl.id);
    try {
      const newQuote = await createQuote(user.id, {
        title: '',
        status: 'draft',
        trade: tmpl.trade || null,
        description: tmpl.description || null,
        scope_summary: tmpl.scope_summary || null,
        province: tmpl.province || null,
      });
      // Store template line items to pre-fill in the builder
      if (tmpl.line_items?.length > 0) {
        sessionStorage.setItem(`pl_template_items_${newQuote.id}`, JSON.stringify(tmpl.line_items));
      }
      sessionStorage.setItem(`pl_template_id_${newQuote.id}`, tmpl.id);
      incrementTemplateUseCount(tmpl.id);
      navigate(`/app/quotes/${newQuote.id}?from_template=1`);
    } catch (e) {
      toast(e?.message || 'Could not create quote from template', 'error');
    } finally { setUsingTmplId(null); }
  }

  const tmplByKey = Object.fromEntries((templates || []).map(t => [t.template_key, t]));

  return (
    <AppShell>
      <div className="tmpl-root">
        <div className="tmpl-page-hd">
          <div>
            <h1 className="tmpl-page-title font-display">Templates</h1>
            <p className="tmpl-page-sub">
              {activeTab === 'messages'
                ? 'Customize the texts sent to customers at each stage.'
                : 'Save common job types as starting points for new quotes.'}
            </p>
          </div>
          {activeTab === 'messages' && !isProUser && (
            <Link to="/app/billing" className="btn btn-primary tmpl-upgrade-btn">Unlock customization →</Link>
          )}
          {activeTab === 'jobs' && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setCreatingNew(true)}
            >
              + New template
            </button>
          )}
        </div>

        {/* ── Tab switcher ── */}
        <div className="tmpl-tabs">
          <button
            type="button"
            className={`tmpl-tab${activeTab === 'messages' ? ' tmpl-tab--active' : ''}`}
            onClick={() => setSearchParams({ tab: 'messages' })}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Message templates
          </button>
          <button
            type="button"
            className={`tmpl-tab${activeTab === 'jobs' ? ' tmpl-tab--active' : ''}`}
            onClick={() => setSearchParams({ tab: 'jobs' })}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Job templates
            {jobTemplates.length > 0 && <span className="tmpl-tab-count">{jobTemplates.length}</span>}
          </button>
        </div>

        {/* ═══ MESSAGE TEMPLATES TAB ═══ */}
        {activeTab === 'messages' && (
          <>
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
                        onSave={handleSaveMessage}
                        onReset={handleResetMessage}
                        saving={savingKey === key}
                        resetting={resettingKey === key}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* ═══ JOB TEMPLATES TAB ═══ */}
        {activeTab === 'jobs' && (
          <div className="jt-root">
            {jobLoading ? (
              <div className="tmpl-skel-list">{[...Array(3)].map((_, i) => <div key={i} className="tmpl-skel-card" style={{ height: 120 }} />)}</div>
            ) : jobTemplates.length === 0 ? (
              <div className="jt-empty">
                <div className="jt-empty-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                </div>
                <h3 className="jt-empty-title font-display">No job templates yet</h3>
                <p className="jt-empty-body">
                  Create a blank template or save any quote as a template from the quote builder.
                  Next time you do the same job, start from the template — trade, description,
                  and all line items pre-filled.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button type="button" className="btn btn-primary" onClick={() => setCreatingNew(true)}>Create blank template</button>
                  <Link to="/app/quotes/new" className="btn btn-secondary">Build a quote first →</Link>
                </div>
              </div>
            ) : (
              <div className="jt-list">
                {jobTemplates.map(tmpl => (
                  <JobTemplateCard
                    key={tmpl.id}
                    tmpl={tmpl}
                    onUse={handleUseTemplate}
                    onEdit={t => setEditingTmpl(t)}
                    onDelete={handleDeleteJobTemplate}
                    using={usingTmplId === tmpl.id}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Job template name modal ── */}
        {editingTmpl && (
          // key by tmpl id so opening template B after template A
          // re-mounts the modal with B's fields rather than holding
          // A's snapshot from useState's lazy initializer.
          <JobTemplateModal
            key={editingTmpl.id || 'edit'}
            tmpl={editingTmpl}
            onSave={handleSaveJobTemplate}
            onClose={() => setEditingTmpl(null)}
            saving={savingTmpl}
          />
        )}
        {creatingNew && (
          <JobTemplateModal
            tmpl={{ name: '', trade: '', description: '', line_items: [] }}
            isNew
            onSave={async (t) => { await handleSaveJobTemplate(t); setCreatingNew(false); }}
            onClose={() => setCreatingNew(false)}
            saving={savingTmpl}
          />
        )}
      </div>
    </AppShell>
  );
}
