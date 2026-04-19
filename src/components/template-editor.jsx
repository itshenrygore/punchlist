// ═══════════════════════════════════════════
// PUNCHLIST — TemplateEditor
// Per-template editor block used inside Settings → Messages (M2).
// Spec: PHASE4-V100-PLAN.md §3.3.
//
// One of these renders per template key. Responsibilities:
// - Textarea bound to `body`
// - Live preview below with token interpolation
// - Character counter (warn 160+, hard cap-display 320)
// - Reset-to-default button (always enabled — §9.1)
// - Pro-lock UX for free users: textarea readOnly, lock icon overlay,
// inline upgrade prompt anchored to THIS template
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
const CAP_CHARS = 320;

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
 const label = TEMPLATE_LABELS[templateKey] || templateKey;
 const hint = TEMPLATE_HINTS[templateKey] || '';
 const defaults = useMemo(() => getSystemDefaults(), []);
 const defaultBody = defaults[templateKey] || '';
 const effectiveBody = body ?? defaultBody;

 const len = effectiveBody.length;
 const overWarn = len > WARN_CHARS;
 const overCap = len > CAP_CHARS;
 const atDefault = !isCustom || effectiveBody === defaultBody;

 const preview = useMemo(
 () => renderTemplate(effectiveBody, previewTokens || {}),
 [effectiveBody, previewTokens]
 );

 function handleLockClick() {
 setpanel te-s6-7e60psell(true);
 if (onUpgradeClick) onUpgradeClick(templateKey);
 }

 function handleReset() {
 if (onReset) onReset(templateKey);
 }

 return (
 <div className="panel">
 <div className="te-flex-7d32":muted small te-s4-5302
 <div className="te-s1-30f9">
 <div className="eyebrow">{label}</div>
 {hint && (
 <p className="muted small">{hint}</p>
 )}
 </div>
 <div className="te-flex-132d">
 {isCustom && !atDefault && (
 <span
 className="te-fs-2xs-cb83">
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
 <div className="te-s3-56be">
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
 className="te-inline-flex_fs-2xs-2740">
 Pro
 </button>
 )}
 </div>

 {/* ── Meta row: char counter + token legend ── */}
 <div
 className="te-flex_fs-2xs-ac22">
 <span>
 <span
 style={{
 color: overCap ? 'var(--danger)' : overWarn ? 'var(--warning, #c27400)' : 'var(--text-2)',
 fontWeight: overWarn ? 700 : 400,
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
 className="te-s2-af5d">
 <div
 className="eyebrow">
 Preview to Kristine
 </div>
 <div
 className="te-fs-sm-1355">
 {preview || <span className="muted small"><em>(empty)</em></span>}
 </div>
 </div>

 {/* ── Inline upsell (only after user clicks the lock) ── */}
 {!isPro && showUpsell && (
 <div
 className="te-flex-5f0a">
 <div className="te-s1-30f9">
 <div className="te-fs-sm-1549">
 Customize the wording to sound like you — Pro
 </div>
 <div className="muted small">
 Keep the psychology-tuned defaults, or rewrite this one in your own voice.
 Reset is always free.
 </div>
 </div>
 <div className="te-flex-84cf">
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
