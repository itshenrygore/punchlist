import { StepDots } from '../components/ui';
import Logo from '../components/logo';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { saveProfile } from '../lib/api';
import { trackSignup } from '../lib/analytics';
import { CA_PROVINCES, US_STATES } from '../lib/pricing';
import { TRADES } from '../../shared/tradeBrain';

export default function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 = account, 2 = trade/region
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');
  const [trade, setTrade] = useState('');
  const [country, setCountry] = useState('CA');
  const [province, setProvince] = useState('AB');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [userId, setUserId] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

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
            await saveProfile(data.user, { full_name: fullName, trade: demoTrade, province, country, ...(companyName.trim() ? { company_name: companyName.trim() } : {}) });
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
    setLoading(true);
    setError('');
    try {
      // Use the userId we already captured in step 1 — no need to re-fetch
      if (userId) {
        await saveProfile({ id: userId }, { full_name: fullName, trade, province, country, ...(companyName.trim() ? { company_name: companyName.trim() } : {}) });
      }
    } catch (e) {
      // Non-blocking: profile was already partially created by the handle_new_user trigger,
      // so the user can proceed. Settings page allows correction later.
      console.warn('[Punchlist] Step 2 profile save error:', e.message);
    }
    setLoading(false);
    // Mark that we came from onboarding so dashboard knows
    try { localStorage.setItem('pl_first_run', '1'); } catch (e) { console.warn("[PL]", e); }
    // Mark onboarded so the wizard doesn't show again on dashboard
    try { localStorage.setItem('pl_onboarded', '1'); } catch (e) { console.warn("[PL]", e); }
    if (userId) trackSignup(userId, trade);
    navigate('/app/quotes/new', { replace: true });
  }

  function skipToApp() {
    try { localStorage.setItem('pl_first_run', '1'); } catch (e) { console.warn("[PL]", e); }
    try { localStorage.setItem('pl_onboarded', '1'); } catch (e) { console.warn("[PL]", e); }
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
          <div className="panel soft-panel auth-steps-panel">
            <div className="eyebrow">Did not get it?</div>
            <p className="muted small auth-confirm-body">
              Check your spam or promotions folder. The email comes from notifications@punchlist.ca.
              If it doesn't arrive within a few minutes, contact <a href="mailto:hello@punchlist.ca" className="auth-switch auth-confirm-link-inline">hello@punchlist.ca</a>.
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
          <div className="auth-field">
            <span className="field-label">Trade</span>
            <select className="input" value={trade} onChange={e => setTrade(e.target.value)}>
              <option value="" disabled>Select your trade…</option>
              {TRADES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
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
          {trade && (
            <div className="auth-trade-hint">
              Your AI scope, catalog, and pricing will be calibrated for <strong>{trade}</strong> work.
            </div>
          )}
          <button className="btn btn-primary full-width" type="button" disabled={loading || !trade} onClick={handleStep2}>
            {loading ? 'Saving…' : 'Create my first quote →'}
          </button>
          <button type="button" onClick={skipToApp} className="auth-skip">
            Skip for now <ChevronRight size={14} />
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
        <button className="btn btn-primary full-width" type="submit" disabled={loading || !termsAccepted}>
          {loading ? 'Creating account…' : 'Continue →'}
        </button>
        <div className="auth-social-proof">Used by plumbers, electricians, HVAC techs, and contractors across Canada</div>
        <div className="auth-switch">
          Already have an account?{' '}
          <Link to="/login">Log in</Link>
        </div>
      </form>
    </div>
  );
}
