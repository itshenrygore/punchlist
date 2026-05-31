import { StepDots } from '../components/ui';
import Logo from '../components/logo';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wrench, Zap, Wind, Hammer, HardHat, Trees, Home, PaintBucket, MoreHorizontal } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { saveProfile } from '../lib/api';
import { trackSignup } from '../lib/analytics';
import { CA_PROVINCES, US_STATES } from '../lib/pricing';
import { TRADES } from '../../shared/tradeBrain';

// ── Trade picker ──
// 8 most-common trades surface as icon tiles (huge tap targets, no
// system-blue native dropdown breaking the premium funnel aesthetic).
// "Other" reveals the full <select> for the long tail.
const TRADE_TILES = [
  { value: 'Plumber',            Icon: Wrench },
  { value: 'Electrician',        Icon: Zap },
  { value: 'HVAC',               Icon: Wind },
  { value: 'Carpenter',          Icon: Hammer },
  { value: 'General Contractor', Icon: HardHat },
  { value: 'Landscaping',        Icon: Trees },
  { value: 'Roofing',            Icon: Home },
  { value: 'Painter',            Icon: PaintBucket },
];

// Multi-select: a contractor can run more than one trade (e.g. plumbing +
// HVAC). `values` is an array; `onToggle(trade)` adds/removes one.
function TradePicker({ values, onToggle }) {
  const tileValues = new Set(TRADE_TILES.map(t => t.value));
  const otherSelected = values.filter(v => !tileValues.has(v));
  const [showOther, setShowOther] = useState(otherSelected.length > 0);
  return (
    <div className="trade-picker">
      <div className="trade-tiles" role="group" aria-label="Select your trade or trades">
        {TRADE_TILES.map(({ value: v, Icon }) => (
          <button
            key={v}
            type="button"
            className={`trade-tile${values.includes(v) ? ' is-selected' : ''}`}
            onClick={() => onToggle(v)}
            aria-pressed={values.includes(v)}
          >
            <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
            <span>{v}</span>
          </button>
        ))}
        <button
          type="button"
          className={`trade-tile${showOther || otherSelected.length > 0 ? ' is-selected' : ''}`}
          onClick={() => setShowOther(s => !s)}
          aria-pressed={showOther}
        >
          <MoreHorizontal size={20} strokeWidth={1.75} aria-hidden="true" />
          <span>Other</span>
        </button>
      </div>
      {showOther && (
        <select
          className="input trade-picker-fallback"
          value=""
          onChange={e => { if (e.target.value) onToggle(e.target.value); }}
          aria-label="Add another trade"
        >
          <option value="">Add a trade…</option>
          {TRADES.filter(t => !tileValues.has(t) && !values.includes(t)).map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      )}
      {otherSelected.length > 0 && (
        <div className="trade-picker-extra" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {otherSelected.map(t => (
            <button key={t} type="button" className="trade-tile is-selected" style={{ flex: '0 0 auto', padding: '6px 12px' }} onClick={() => onToggle(t)} title="Remove">
              {t} ✕
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 = account, 2 = trade/region
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');
  const [trade, setTrade] = useState('');
  const [trades, setTrades] = useState([]); // multi-trade companies pick more than one
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('CA');
  const [province, setProvince] = useState('AB');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [userId, setUserId] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Phone is required at onboarding — it's the channel we use to alert the
  // contractor when a customer views/approves/signs/pays. Without it they
  // get nothing (the #1 "I never got notified" cause).
  const phoneDigits = phone.replace(/\D/g, '');
  const phoneValid = phoneDigits.length === 10 || (phoneDigits.length === 11 && phoneDigits[0] === '1');

  async function handleStep1(e) {
    e.preventDefault();
    setError('');
    if (!fullName.trim()) return setError('Your name can\u2019t be blank');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    setLoading(true);

    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/app`,
        },
      });

      if (signupError) {
        if (signupError.message.toLowerCase().includes('already registered') ||
            signupError.message.toLowerCase().includes('already been registered')) {
          setError('An account with this email already exists. Try logging in instead.');
        } else {
          throw signupError;
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        setUserId(data.user.id);
        // Save basic profile now
        await saveProfile(data.user, {
          full_name: fullName,
          ...(companyName.trim() ? { company_name: companyName.trim() } : {}),
        }).catch(e => console.warn('[PL]', e));
      }

      if (data.session) {
        // If demo carry-through already has trade data, skip step 2 entirely —
        // the user is in flow from the landing page, don't break it with a form.
        let demoTrade = null;
        try {
          const dq = sessionStorage.getItem('pl_demo_quote');
          if (dq) { const d = JSON.parse(dq); demoTrade = d.trade; }
        } catch (e) { console.warn("[PL]", e); }

        if (demoTrade && data.user) {
          // Save profile with demo trade data and go straight to quote builder
          setTrade(demoTrade);
          try {
            await saveProfile(data.user, { full_name: fullName, trade: demoTrade, trades: demoTrade ? [demoTrade] : [], province, country, ...(companyName.trim() ? { company_name: companyName.trim() } : {}) });
          } catch (e) { console.warn("[PL]", e); }
          try { localStorage.setItem('pl_first_run', '1'); localStorage.setItem('pl_onboarded', '1'); } catch (e) { console.warn("[PL]", e); }
          navigate('/app/quotes/new', { replace: true });
          return;
        }

        setStep(2);
      } else {
        setConfirmationSent(true);
      }

    } catch (err) {
      setError(err.message || 'Couldn\u2019t create your account. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  }

  async function handleStep2() {
    if (!phoneValid) { setError('Enter a valid mobile number so we can text you about your quotes.'); return; }
    setLoading(true);
    setError('');
    let saveFailed = false;
    try {
      // Use the userId we already captured in step 1 — no need to re-fetch.
      // Save the phone + turn SMS alerts on (they gave us the number for
      // exactly this — viewing/approval/signature/payment texts).
      if (userId) {
        await saveProfile({ id: userId }, { full_name: fullName, trade: trades[0] || 'Other', trades, province, country, phone: phone.trim(), sms_notifications_enabled: true, ...(companyName.trim() ? { company_name: companyName.trim() } : {}) });
      }
    } catch (e) {
      // Non-blocking: profile was already partially created by the handle_new_user trigger,
      // so the user can proceed. But surface the failure so they know
      // to correct trade/region in Settings (otherwise tax rates are
      // off and the AI prompt uses defaults).
      saveFailed = true;
      console.warn('[Punchlist] Step 2 profile save error:', e.message);
    }
    setLoading(false);
    try { localStorage.setItem('pl_first_run', '1'); } catch (e) { console.warn("[PL]", e); }
    try { localStorage.setItem('pl_onboarded', '1'); } catch (e) { console.warn("[PL]", e); }
    if (userId) trackSignup(userId, trades[0] || 'Other');
    if (saveFailed) {
      try { sessionStorage.setItem('pl_profile_save_failed', '1'); } catch { /* ignore */ }
    }
    navigate('/app/quotes/new', { replace: true });
  }


  // ── Email confirmation pending ──
  if (confirmationSent) {
    return (
      <div className="auth-page">
        <div className="panel auth-card stack auth-confirm-card">
          <div className="auth-confirm-icon">📬</div>
          <div>
            <div className="eyebrow">Almost there — one step left</div>
            <h1 className="auth-confirm-title">Check your email</h1>
            <p className="muted small auth-confirm-body">
              We sent a confirmation link to <strong>{email}</strong>.
              Click it and you'll be building your first quote in under 4 minutes.
            </p>
          </div>
          <div className="panel soft-panel auth-steps-panel">
            <div className="eyebrow">Here's what happens next</div>
            <div className="auth-step-list">
              <div className="auth-step-item"><span className="auth-step-num">1.</span><span>Describe the job — type it, speak it, or snap a photo</span></div>
              <div className="auth-step-item"><span className="auth-step-num">2.</span><span>Punchlist builds a line-item quote with pricing</span></div>
              <div className="auth-step-item"><span className="auth-step-num">3.</span><span>Send to your customer — they see total + monthly option</span></div>
            </div>
          </div>
          <div className="auth-confirm-fallback">
            <div className="auth-confirm-fallback-rule" aria-hidden="true" />
            <p className="muted small auth-confirm-body">
              <strong style={{ color: 'var(--text-2)' }}>Didn't get it?</strong> Check spam or
              promotions — the email comes from <code>notifications@punchlist.ca</code>. Still
              missing? <a href="mailto:hello@punchlist.ca" className="auth-switch auth-confirm-link-inline">hello@punchlist.ca</a>.
            </p>
          </div>
          <Link className="btn btn-secondary" to="/login">Back to log in</Link>
        </div>
      </div>
    );
  }

  // ── Step 2: Trade + Region ──
  if (step === 2) {
    return (
      <div className="auth-page">
        <div className="panel auth-card stack">
          <div className="auth-step-dots-wrap"><StepDots current={1} total={2} variant="bar" /></div>
          <div className="auth-header">
            <h1>What's your trade?</h1>
            <div className="muted small">We'll customize your catalog, pricing, and tax rates.</div>
          </div>
          {/* Country/province first so the trade picker (and downstream
              tax + pricing logic) get a US contractor's region from the
              start. Previously a US user picked Plumber → saw "Province
              ON" defaulted → had to switch country → got dumped on FL,
              and the tax calc was wrong until they corrected it. */}
          <div className="form-row">
            <div className="auth-field">
              <span className="field-label">Country</span>
              <select className="input" value={country} onChange={e => { setCountry(e.target.value); setProvince(e.target.value === 'US' ? 'FL' : 'ON'); }}>
                <option value="CA">Canada</option>
                <option value="US">United States</option>
              </select>
            </div>
            <div className="auth-field">
              <span className="field-label">{country === 'US' ? 'State' : 'Province'}</span>
              <select className="input" value={province} onChange={e => setProvince(e.target.value)}>
                {(country === 'US' ? US_STATES : CA_PROVINCES).map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="auth-field">
            <span className="field-label">Trade</span>
            <TradePicker values={trades} onToggle={t => setTrades(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])} />
            <div className="muted small" style={{ marginTop: 6 }}>Pick all that apply — multi-trade shops welcome.</div>
          </div>
          {trades.length > 0 && (
            <div className="auth-trade-hint">
              Your scope, catalog, and pricing will be calibrated for <strong>{trades.join(' + ')}</strong> work.
            </div>
          )}
          <div className="auth-field">
            <label htmlFor="signup-phone" className="field-label">Your mobile number</label>
            <input
              id="signup-phone"
              className="input"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="(403) 555-0188"
              autoComplete="tel"
              inputMode="tel"
            />
            <div className="muted small" style={{ marginTop: 6 }}>
              We text you the moment a customer views, approves, signs, or pays — so you never miss a job. Required.
            </div>
          </div>
          <button className="btn btn-primary full-width" type="button" disabled={loading || trades.length === 0 || !phoneValid} onClick={handleStep2}>
            {loading ? 'Saving…' : 'Create my first quote →'}
          </button>
        </div>
      </div>
    );
  }

  // ── Step 1: Account creation ──
  return (
    <div className="auth-page">
      <form className="panel auth-card stack" onSubmit={handleStep1}>
        <div className="auth-logo-row">
          <Link to="/"><Logo size="md" /></Link>
        </div>
        <StepDots current={0} total={2} variant="bar" />
        <div className="auth-header">
          <div className="eyebrow">Start free — no card needed</div>
          <h1>Create your account</h1>
          <div className="muted small auth-card-tagline">Build professional quotes in minutes. Your customer sees the total and a monthly option — and you get paid in full.</div>
        </div>
        <div className="auth-field">
          <label htmlFor="signup-name" className="field-label">Your name</label>
          <input
            id="signup-name"
            className="input"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="e.g. Mike Sullivan"
            required
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="next"
            autoFocus
          />
        </div>
        <div className="auth-field">
          <label htmlFor="signup-company" className="field-label">Company name <span className="auth-optional">(optional)</span></label>
          <input
            id="signup-company"
            className="input"
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            placeholder="e.g. Sullivan Electric"
            autoComplete="organization"
            autoCapitalize="words"
            enterKeyHint="next"
          />
        </div>
        <div className="auth-field">
          <label htmlFor="signup-email" className="field-label">Email address</label>
          <input
            id="signup-email"
            className="input"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            enterKeyHint="next"
          />
        </div>
        <div className="auth-field">
          <label htmlFor="signup-password" className="field-label">Password</label>
          <input
            id="signup-password"
            className="input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="8+ characters"
            minLength="8"
            required
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            enterKeyHint="go"
          />
        </div>
        {error && <div className="auth-error">{error}</div>}
        <label className="auth-terms">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={e => setTermsAccepted(e.target.checked)}
          />
          <span>I agree to the Punchlist{' '}
            <Link to="/terms" target="_blank" rel="noreferrer">Terms of Service</Link>
            {' '}and{' '}
            <Link to="/privacy" target="_blank" rel="noreferrer">Privacy Policy</Link>
          </span>
        </label>
        {/* Quiet helper so the disabled CTA isn't a mystery — the previous
            version left users staring at a dead button with no reason. */}
        {!termsAccepted && !loading && (
          <div className="auth-terms-hint" role="status">
            Tick the box above to continue.
          </div>
        )}
        <button className="btn btn-primary full-width" type="submit" disabled={loading || !termsAccepted}>
          {loading ? 'Creating account…' : 'Continue →'}
        </button>
        <div className="auth-social-proof">Used by plumbers, electricians, HVAC techs, and contractors across Canada and the US</div>
        <div className="auth-switch">
          Already have an account?{' '}
          <Link to="/login">Log in</Link>
        </div>
      </form>
    </div>
  );
}
