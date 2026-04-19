import { useRef, useCallback, useEffect } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { Card } from '../../components/ui';
import { useQuoteBuilder } from './quote-builder-context';
import { actions } from './use-quote-draft';
import { TRADES } from '../../../shared/tradeBrain';
import { CA_PROVINCES, US_STATES } from '../../lib/pricing';
import { DESC_PLACEHOLDERS } from './builder-utils';

/* ═══════════════════════════════════════════════════════════
   DescribePhase — "What's the job?" input screen.

   Responsibilities:
     • Job description textarea with auto-grow
     • Voice dictation (Web Speech API)
     • Photo upload
     • Trade + province selectors (collapsed by default)
     • "Build Quote →" primary CTA
     • "Add items manually" skip link
   ═══════════════════════════════════════════════════════════ */

const SR_AVAILABLE = typeof window !== 'undefined' &&
  !!(window.SpeechRecognition || window.webkitSpeechRecognition);

export default function DescribePhase() {
  const { state, dispatch, handlers } = useQuoteBuilder();
  const {
    description, title, trade, province, country, photo,
    listening, photoSaved, error,
  } = state;

  const fileRef = useRef(null);
  const descTextareaRef = useRef(null);
  const recRef = useRef(null);
  const recTimeoutRef = useRef(null);
  const finalRef = useRef('');

  // ── Auto-grow textarea ──
  const growDesc = useCallback(() => {
    const el = descTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxH = Math.round(
      (typeof window !== 'undefined' ? window.innerHeight : 800) / 2
    );
    el.style.height = `${Math.min(el.scrollHeight, maxH)}px`;
  }, []);

  useEffect(() => { growDesc(); }, [description, growDesc]);

  // ── Voice input ──
  function toggleVoice() {
    if (listening) {
      if (recRef.current) { recRef.current.stop(); recRef.current = null; }
      dispatch(actions.setListening(false));
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = true;
    recRef.current = rec;
    dispatch(actions.setListening(true));
    finalRef.current = '';

    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalRef.current += e.results[i][0].transcript;
        else interim = e.results[i][0].transcript;
      }
      dispatch(actions.setDescription(finalRef.current + (interim ? ' ' + interim : '')));
    };
    rec.onerror = () => { dispatch(actions.setListening(false)); recRef.current = null; };
    rec.onend = () => {
      dispatch(actions.setListening(false));
      recRef.current = null;
      if (finalRef.current.trim()) handlers.toast('Got it', 'success');
    };
    rec.start();
    recTimeoutRef.current = setTimeout(() => {
      if (recRef.current) {
        recRef.current.stop();
        recRef.current = null;
        dispatch(actions.setListening(false));
      }
    }, 15000);
  }

  return (
    <Card padding="loose" className="qb-zone pl-describe-stable" elevation={1}>
      {/* Gradient header strip */}
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
          onChange={e => dispatch(actions.setDescription(e.target.value))}
          onBlur={() => handlers.onDescriptionBlur(description)}
          placeholder={DESC_PLACEHOLDERS[trade] || DESC_PLACEHOLDERS.Other}
          rows={4}
          autoFocus
        />

        {/* Char helper */}
        <div className="qb-desc-helper">
          {description.length >= 80 && (
            <span className="qb-desc-helper__nudge">
              {description.length >= 160 ? 'Very detailed — great for accuracy' : 'Nice and specific'}
            </span>
          )}
          {description.length > 0 && (
            <span className="qb-desc-helper__count qb-desc-helper__count--auto">
              {description.length} chars
            </span>
          )}
        </div>

        {/* Helper buttons: voice, photo */}
        <div className="jd-helpers qb-helpers-row">
          {SR_AVAILABLE && (
            <>
              <button
                className={`jd-helper-btn jd-helper-voice ${listening ? 'jd-listening' : ''}`}
                type="button"
                onClick={toggleVoice}
                aria-pressed={listening}
                aria-label={listening ? 'Stop voice recording' : 'Start voice recording'}
              >
                {listening ? 'Stop recording' : 'Describe by voice'}
              </button>
              <span
                className="pl-voice-indicator"
                data-on={listening ? 'true' : 'false'}
                aria-hidden={!listening}
              >
                <span className="pl-voice-dot" />
                <span>Listening</span>
              </span>
            </>
          )}
          {photo ? (
            <div className="jd-helper-btn jd-photo-active">
              {photo.name}
              <button
                type="button"
                onClick={() => dispatch(actions.setPhoto(null))}
                aria-label="Remove photo"
                className="jd-photo-dismiss"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              className="jd-helper-btn jd-helper-secondary"
              type="button"
              onClick={() => fileRef.current?.click()}
            >
              Add photo
            </button>
          )}
          <input
            hidden
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={e => dispatch(actions.setPhoto(e.target.files?.[0] || null))}
          />
          {photoSaved && <span className="jd-photo-saved">✓ Photo saved</span>}
        </div>
      </div>

      {/* Auto-generated title preview */}
      {title && (
        <div className="qb-title-preview">
          Job: <strong className="qb-title-preview__value">{title}</strong>
        </div>
      )}

      {/* Trade & province (collapsed) */}
      <details className="qb-trade-details">
        <summary className="qb-trade-summary">
          Trade: {trade} · {country === 'US' ? 'State' : 'Province'}: {province}
        </summary>
        <div className="jd-row qb-trade-row">
          <div className="jd-section qb-trade-field">
            <select
              className="jd-input jd-select"
              value={trade}
              onChange={e => dispatch(actions.setTrade(e.target.value))}
              aria-label="Trade"
            >
              {TRADES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="jd-section qb-trade-field">
            <select
              className="jd-input jd-select"
              value={province}
              onChange={e => dispatch(actions.setProvince(e.target.value))}
              aria-label="Province"
            >
              {(country === 'US' ? US_STATES : CA_PROVINCES).map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </details>

      {error && <div className="jd-error" role="alert">{error}</div>}

      {/* Footer: primary CTA + skip link */}
      <div className="jd-footer qb-describe-footer">
        <button
          className="btn btn-primary btn-lg full-width"
          type="button"
          onClick={handlers.handleBuildScope}
          disabled={!description.trim()}
        >
          {description.trim() ? 'Build Quote →' : 'Describe the job to get started'}
        </button>
        <div className="qb-pillar-teaser">
          Your customer sees the total, a monthly option, and can approve from their phone.
        </div>
        <button
          className="jd-skip-link btn-link qb-skip-ai"
          type="button"
          onClick={handlers.handleSkipToManual}
          disabled={!description.trim()}
        >
          or add items manually <ChevronRight size={14} />
        </button>
      </div>
    </Card>
  );
}
