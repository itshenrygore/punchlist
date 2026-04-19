// ═══════════════════════════════════════════
// PUNCHLIST — TemplateEditor
// Per-template editor block used inside Settings → Messages (M2).
// Spec: PHASE4-V100-PLAN.md §3.3.
//
// One of these renders per template key. Responsibilities:
//   - Textarea bound to `body`
//   - Live preview below with token interpolation
//   - Character counter (warn 160+, hard cap-display 320)
//   - Reset-to-default button (always enabled — §9.1)
//   - Pro-lock UX for free users: textarea readOnly, lock icon overlay,
//     inline upgrade prompt anchored to THIS template
//
// State is lifted — the parent owns the template list and passes down
// `body`, `onChange`, `onReset`, `onUpgradeClick`. Keeps this component
// stateless enough to reuse if the editor ever moves out of Settings.
// ═══════════════════════════════════════════
import { useMemo, useState } from 'react';
import {
  TEMPLATE_LABELS,
  TEMPLATE_HINTS,
  renderTemplate,
  getSystemDefaults,
} from '../lib/api/templates';

// Character thresholds (GSM-7 single-segment = 160, two-segment = 306).
// We use 320 as a "yellow line" display cap — SMS will still send past
// it, just split across more segments.
const WARN_CHARS = 160;
const CAP_CHARS  = 320;

export default function TemplateEditor({
  templateKey,
  body,
  isCustom,
  isPro,
  previewTokens,
  onChange,
  onReset,
  onUpgradeClick,
  busy = false,
}) {
  const [showUpsell, setShowUpsell] = useState(false);
  const label   = TEMPLATE_LABELS[templateKey] || templateKey;
  const hint    = TEMPLATE_HINTS[templateKey] || '';
  const defaults = useMemo(() => getSystemDefaults(), []);
  const defaultBody = defaults[templateKey] || '';
  const effectiveBody = body ?? defaultBody;

  const len = effectiveBody.length;
  const overWarn = len > WARN_CHARS;
  const overCap  = len > CAP_CHARS;
  const atDefault = !isCustom || effectiveBody === defaultBody;

  const preview = useMemo(
    () => renderTemplate(effectiveBody, previewTokens || {}),
    [effectiveBody, previewTokens]
  );

  function handleLockClick() {
    setShowUpsell(true);
    if (onUpgradeClick) onUpgradeClick(templateKey);
  }

  function handleReset() {
    if (onReset) onReset(templateKey);
  }

  return (
    <div className="panel" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 2 }}>{label}</div>
          {hint && (
            <p className="muted small" style={{ margin: 0, lineHeight: 1.45 }}>{hint}</p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isCustom && !atDefault && (
            <span
              style={{
                fontSize: 'var(--text-2xs)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '.06em',
                color: 'var(--brand-dark)',
                background: 'var(--brand-soft, rgba(249,115,22,.1))',
                padding: '2px 8px',
                borderRadius: 999,
              }}
            >
              Custom
            </span>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleReset}
            disabled={busy || atDefault}
            title={atDefault ? 'Already at default' : 'Restore the default wording'}
          >
            Reset to default
          </button>
        </div>
      </div>

      {/* ── Textarea + lock overlay ── */}
      <div style={{ position: 'relative', marginTop: 12 }}>
        <textarea
          className="input"
          value={effectiveBody}
          readOnly={!isPro}
          onChange={isPro ? (e) => onChange(templateKey, e.target.value) : undefined}
          rows={4}
          style={{
            width: '100%',
            fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)',
            fontSize: 'var(--text-sm)',
            lineHeight: 1.55,
            resize: 'vertical',
            opacity: isPro ? 1 : 0.72,
            cursor: isPro ? 'text' : 'not-allowed',
          }}
          aria-label={`${label} template body`}
        />
        {!isPro && (
          <button
            type="button"
            onClick={handleLockClick}
            aria-label="Unlock template editing with Pro"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: 999,
              padding: '4px 10px',
              fontSize: 'var(--text-2xs)',
              fontWeight: 700,
              color: 'var(--text)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,.08)',
            }}
          >
            Pro
          </button>
        )}
      </div>

      {/* ── Meta row: char counter + token legend ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginTop: 6,
          fontSize: 'var(--text-2xs)',
          color: 'var(--text-2)',
        }}
      >
        <span>
          <span
            style={{
              color: overCap ? 'var(--danger)' : overWarn ? 'var(--warning, #c27400)' : 'var(--text-2)',
              fontWeight: overWarn ? 700 : 400,
            }}
          >
            {len}
          </span>{' '}
          / {CAP_CHARS} chars
          {overWarn && !overCap && ' · will send as 2 segments'}
          {overCap && ' · very long — may split into 3+ segments'}
        </span>
      </div>

      {/* ── Live preview ── */}
      <div
        style={{
          marginTop: 12,
          padding: 12,
          background: 'var(--panel-2)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-sm, 8px)',
        }}
      >
        <div
          className="eyebrow"
          style={{ fontSize: 'var(--text-2xs)', marginBottom: 6, color: 'var(--text-2)' }}
        >
          Preview to Kristine
        </div>
        <div
          style={{
            fontSize: 'var(--text-sm)',
            lineHeight: 1.55,
            color: 'var(--text)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {preview || <span className="muted small"><em>(empty)</em></span>}
        </div>
      </div>

      {/* ── Inline upsell (only after user clicks the lock) ── */}
      {!isPro && showUpsell && (
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
              Customize the wording to sound like you — Pro
            </div>
            <div className="muted small" style={{ lineHeight: 1.45 }}>
              Keep the psychology-tuned defaults, or rewrite this one in your own voice.
              Reset is always free.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowUpsell(false)}
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
  );
}
