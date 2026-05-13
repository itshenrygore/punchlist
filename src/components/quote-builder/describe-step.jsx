import { useRef, useCallback, useEffect, useState } from 'react';
import { Mic, Camera, X } from 'lucide-react';
import { TRADES } from '../../shared/tradeBrain';
import { CA_PROVINCES, US_STATES } from '../lib/pricing';

/**
 * DescribeStep — "What's the job?" input
 *
 * Extracted from the 1,712-line QuoteBuilderPage monolith.
 * Handles: textarea, voice input, photo attachment, trade/province pickers.
 *
 * Props:
 *   description, onDescriptionChange
 *   title
 *   trade, onTradeChange
 *   province, onProvinceChange
 *   country
 *   photo, onPhotoChange
 *   photoSaved
 *   error
 *   onBuildScope — called when user taps "Build Quote →"
 *   onManualAdd — called when user taps "add items manually"
 *   isFirstTime — show hero banner
 */

const SR_AVAILABLE = typeof window !== 'undefined' &&
  !!(window.SpeechRecognition || window.webkitSpeechRecognition);

export default function DescribeStep({
  description,
  onDescriptionChange,
  title,
  trade,
  onTradeChange,
  province,
  onProvinceChange,
  country = 'CA',
  photo,
  onPhotoChange,
  photoSaved,
  error,
  onBuildScope,
  onManualAdd,
  isFirstTime = false,
}) {
  const textareaRef = useRef(null);
  const fileRef = useRef(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const recTimeoutRef = useRef(null);
  const finalRef = useRef('');

  // Auto-grow textarea
  const growDesc = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxH = Math.round((typeof window !== 'undefined' ? window.innerHeight : 800) / 2);
    el.style.height = `${Math.min(el.scrollHeight, maxH)}px`;
  }, []);

  useEffect(() => { growDesc(); }, [description, growDesc]);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Voice input
  function toggleVoice() {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      if (recTimeoutRef.current) clearTimeout(recTimeoutRef.current);
      return;
    }
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-CA';
      finalRef.current = description;
      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            finalRef.current += (finalRef.current ? ' ' : '') + e.results[i][0].transcript;
          } else {
            interim += e.results[i][0].transcript;
          }
        }
        onDescriptionChange(finalRef.current + (interim ? ' ' + interim : ''));
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      rec.start();
      recRef.current = rec;
      setListening(true);
      // Auto-stop after 60s
      recTimeoutRef.current = setTimeout(() => {
        rec.stop();
        setListening(false);
      }, 60000);
    } catch {
      setListening(false);
    }
  }

  const hasDescription = description.trim().length > 0;
  const regions = country === 'US' ? US_STATES : CA_PROVINCES;

  return (
    <div className="qb-describe">
      {/* First-time hero */}
      {isFirstTime && (
        <div className="qb-describe-hero" aria-hidden="true">
          <div className="qb-describe-hero-title">Send professional quotes in under 2 minutes</div>
          <div className="qb-describe-hero-sub">Describe the job — Punchlist builds the scope, pricing, and sends it for you</div>
        </div>
      )}

      {/* Main input */}
      <div className="jd-section">
        <label className="jd-label" htmlFor="qb-desc">What's the job?</label>
        <textarea
          id="qb-desc"
          ref={textareaRef}
          className="jd-input jd-textarea qb-desc-auto"
          value={description}
          onChange={e => onDescriptionChange(e.target.value)}
          placeholder="e.g. Replace hot water tank, install kitchen faucet"
          rows={4}
        />

        {/* Char feedback — positive only */}
        {description.length >= 80 && (
          <div className="qb-desc-helper">
            <span className="qb-desc-helper__nudge">
              {description.length >= 160 ? 'Very detailed — great for accuracy' : 'Nice and specific'}
            </span>
          </div>
        )}

        {/* Voice + Photo helpers */}
        <div className="jd-helpers" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 }}>
          {SR_AVAILABLE && (
            <>
              <button
                className={`jd-helper-btn jd-helper-voice ${listening ? 'jd-listening' : ''}`}
                type="button"
                onClick={toggleVoice}
                aria-pressed={listening}
                aria-label={listening ? 'Stop voice recording' : 'Start voice recording'}
              >
                <Mic size={14} className="qb-icon-inline" />
                {listening ? 'Stop recording' : 'Describe by voice'}
              </button>
              <span className="pl-voice-indicator" data-on={listening ? 'true' : 'false'} aria-hidden={!listening}>
                <span className="pl-voice-dot" />
                <span>Listening</span>
              </span>
            </>
          )}

          {photo ? (
            <div className="jd-helper-btn jd-photo-active">
              {photo.name}
              <button type="button" onClick={() => onPhotoChange(null)} aria-label="Remove photo" className="jd-photo-dismiss">
                <X size={12} />
              </button>
            </div>
          ) : (
            <button className="jd-helper-btn jd-helper-secondary" type="button" onClick={() => fileRef.current?.click()}>
              <Camera size={14} className="qb-icon-inline" />
              Add photo
            </button>
          )}
          <input hidden ref={fileRef} type="file" accept="image/*" onChange={e => onPhotoChange(e.target.files?.[0] || null)} />
          {photoSaved && <span className="jd-photo-saved">✓ Photo saved</span>}
        </div>
      </div>

      {/* Auto-generated title preview */}
      {title && <div className="qb-job-title">Job: <strong>{title}</strong></div>}

      {/* Trade + Province — compact row */}
      <div className="jd-row qb-trade-row" style={{ marginTop: 8, gap: 8 }}>
        <div className="jd-section qb-trade-col" style={{ flex: 1 }}>
          <label className="jd-label" style={{ fontSize: 'var(--text-xs)', marginBottom: 4 }}>Trade</label>
          <select className="jd-input jd-select" value={trade} onChange={e => onTradeChange(e.target.value)} aria-label="Trade">
            {TRADES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="jd-section qb-trade-col" style={{ flex: 1 }}>
          <label className="jd-label" style={{ fontSize: 'var(--text-xs)', marginBottom: 4 }}>{country === 'US' ? 'State' : 'Province'}</label>
          <select className="jd-input jd-select" value={province} onChange={e => onProvinceChange(e.target.value)} aria-label={country === 'US' ? 'State' : 'Province'}>
            {regions.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && <div className="jd-error" role="alert">{error}</div>}

      {/* Actions */}
      <div className="jd-footer qb-footer-mt">
        <button
          className="btn btn-primary btn-lg full-width"
          type="button"
          onClick={onBuildScope}
          disabled={!hasDescription}
        >
          {hasDescription ? 'Build Quote →' : 'Describe the job to get started'}
        </button>
        <button className="btn-link qb-manual-link" type="button" onClick={onManualAdd} style={{ marginTop: 8, fontSize: 'var(--text-xs)' }}>
          or add items manually →
        </button>
      </div>
    </div>
  );
}
