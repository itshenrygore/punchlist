import { StepDots } from '../components/ui';
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
  const [trade, setTrade] = useState('Plumber');
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
        }).catch(() => {});
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
            await saveProfile(data.user, { full_name: fullName, trade: demoTrade, province, country });
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
        await saveProfile({ id: userId }, { full_name: fullName, trade, province, country });
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
        <div className="panel auth-card stack" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem' }}>📬</div>
          <div>
            <div className="eyebrow">Almost there — one step left</div>
            <h1 style={{ margin: '8px 0 4px' }}>Check your email</h1>
            <p className="muted small" style={{ lineHeight: 1.6 }}>
              We sent a confirmation link to <strong>{email}</strong>.
              Click it and you'll be building your first quote in under 4 minutes.
            </p>
          </div>
          <div className="panel soft-panel" style={{ textAlign: 'left' }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Here's what happens next</div>
            <div style={{ display: 'grid', gap: 10, fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><span style={{ fontWeight: 800, color: 'var(--brand)', flexShrink: 0 }}>1.</span><span>Describe the job — type it, speak it, or snap a photo</span></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><span style={{ fontWeight: 800, color: 'var(--brand)', flexShrink: 0 }}>2.</span><span>Punchlist builds a line-item quote with pricing</span></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><span style={{ fontWeight: 800, color: 'var(--brand)', flexShrink: 0 }}>3.</span><span>Send to your customer — they see total + monthly option</span></div>
            </div>
          </div>
          <div className="panel soft-panel" style={{ textAlign: 'left' }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Did not get it?</div>
            <div className="muted small" style={{ lineHeight: 1.6 }}>
              Check your spam or promotions folder. The email comes from notifications@punchlist.ca.
              If it doesn't arrive within a few minutes, contact <a href="mailto:hello@punchlist.ca" style={{ color: 'var(--brand-dark)', fontWeight: 600 }}>hello@punchlist.ca</a>.
            </div>
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
          {/* Visual step indicator */}
          <div style={{ marginBottom: 4 }}><StepDots current={1} total={2} variant="bar" /></div>
          <div>
            <h1 style={{ margin: '4px 0', fontSize: 'clamp(1.4rem,3vw,1.8rem)' }}>What's your trade?</h1>
            <div className="muted small">We'll customize your catalog, pricing, and tax rates.</div>
          </div>
          <div>
            <span className="field-label">Trade</span>
            <select className="input" value={trade} onChange={e => setTrade(e.target.value)}>
              {TRADES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div>
              <span className="field-label">Country</span>
              <select className="input" value={country} onChange={e => { setCountry(e.target.value); setProvince(e.target.value === 'US' ? 'CA' : 'AB'); }}>
                <option value="CA">Canada</option>
                <option value="US">United States</option>
              </select>
            </div>
            <div>
              <span className="field-label">{country === 'US' ? 'State' : 'Province'}</span>
              <select className="input" value={province} onChange={e => setProvince(e.target.value)}>
                {(country === 'US' ? US_STATES : CA_PROVINCES).map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <button className="btn btn-primary full-width" type="button" disabled={loading} onClick={handleStep2}>
            {loading ? 'Saving…' : 'Create my first quote →'}
          </button>
          <button type="button" onClick={skipToApp} className="btn-link" style={{
            color: 'var(--muted)', fontSize: 'var(--text-sm)', display: 'inline-flex',
            alignItems: 'center', gap: 2, marginTop: 2
          }}>
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
        <div>
          <Link className="brand" to="/" style={{ fontSize: '1rem' }}>Punchlist</Link>
        </div>
        {/* Visual step indicator */}
        <StepDots current={0} total={2} variant="bar" />
        <div>
          <div className="eyebrow">Start free — no card needed</div>
          <h1 style={{ margin: '8px 0 4px' }}>Create your account</h1>
          <div className="muted small" style={{ lineHeight: 1.5 }}>Build professional quotes in minutes. Your customer sees the total and a monthly option — and you get paid in full.</div>
        </div>
        <input
          className="input"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          placeholder="Your name"
          required
          autoComplete="name"
          autoFocus
        />
        <input
          className="input"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email address"
          required
          autoComplete="email"
        />
        <input
          className="input"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password (8+ characters)"
          minLength="8"
          required
          autoComplete="new-password"
        />
        {error && (
          <div style={{
            background: 'var(--red-bg)',
            border: '1px solid rgba(192,64,64,.2)',
            borderRadius: 12,
            padding: '10px 14px',
            color: 'var(--red)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 'var(--text-xs)', color: 'var(--muted)', lineHeight: 1.5 }}>
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={e => setTermsAccepted(e.target.checked)}
            style={{ marginTop: 2, flexShrink: 0, accentColor: 'var(--brand)' }}
          />
          <span>I agree to the Punchlist{' '}
            <Link to="/terms" target="_blank" style={{ color: 'var(--brand-dark)', fontWeight: 600, textDecoration: 'underline' }}>Terms of Service</Link>
          </span>
        </label>
        <button className="btn btn-primary full-width" type="submit" disabled={loading || !termsAccepted}>
          {loading ? 'Creating account…' : 'Continue →'}
        </button>
        <div style={{ textAlign: 'center', fontSize: 'var(--text-2xs)', color: 'var(--subtle)' }}>Used by plumbers, electricians, HVAC techs, and contractors across Canada</div>
        <div className="muted small" style={{ textAlign: 'center' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--brand-dark)', fontWeight: 700 }}>Log in</Link>
        </div>
      </form>
    </div>
  );
}
