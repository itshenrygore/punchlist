import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { saveProfile } from '../lib/api';
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

  async function handleStep1(e) {
    e.preventDefault();
    setError('');
    if (!fullName.trim()) return setError('Your name is required');
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
        } catch {}

        if (demoTrade && data.user) {
          // Save profile with demo trade data and go straight to quote builder
          setTrade(demoTrade);
          try {
            await saveProfile(data.user, { full_name: fullName, trade: demoTrade, province, country });
          } catch {}
          try { localStorage.setItem('pl_first_run', '1'); localStorage.setItem('pl_onboarded', '1'); } catch {}
          navigate('/app/quotes/new', { replace: true });
          return;
        }

        setStep(2);
      } else {
        setConfirmationSent(true);
      }

    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleStep2() {
    setLoading(true);
    setError('');
    try {
      if (userId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Include step-1 fields so data is persisted even if step-1 save failed
          await saveProfile(user, { full_name: fullName, company_name: companyName, trade, province, country });
        }
      }
    } catch (e) {
      // Non-blocking: profile was already partially created by the handle_new_user trigger,
      // so the user can proceed. Settings page allows correction later.
      console.warn('[Punchlist] Step 2 profile save error:', e.message);
    }
    setLoading(false);
    // Mark that we came from onboarding so dashboard knows
    try { localStorage.setItem('pl_first_run', '1'); } catch {}
    // Mark onboarded so the wizard doesn't show again on dashboard
    try { localStorage.setItem('pl_onboarded', '1'); } catch {}
    navigate('/app/quotes/new', { replace: true });
  }

  function skipToApp() {
    try { localStorage.setItem('pl_first_run', '1'); } catch {}
    try { localStorage.setItem('pl_onboarded', '1'); } catch {}
    navigate('/app/quotes/new', { replace: true });
  }

  // ── Email confirmation pending ──
  if (confirmationSent) {
    return (
      <div className="auth-page">
        <div className="panel auth-card stack" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem' }}>📬</div>
          <div>
            <div className="eyebrow">Almost there</div>
            <h1 style={{ margin: '8px 0 4px' }}>Check your email</h1>
            <p className="muted small" style={{ lineHeight: 1.6 }}>
              We sent a confirmation link to <strong>{email}</strong>.
              Click the link to activate your account.
            </p>
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

  // ── Step 2: Trade + Region + Company ──
  if (step === 2) {
    return (
      <div className="auth-page">
        <div className="panel auth-card stack">
          {/* Visual step indicator */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ width: 24, height: 4, borderRadius: 2, background: 'var(--brand)', opacity: 0.3 }} />
            <div style={{ width: 24, height: 4, borderRadius: 2, background: 'var(--brand)' }} />
          </div>
          <div>
            <h1 style={{ margin: '4px 0', fontSize: 'clamp(1.4rem,3vw,1.8rem)' }}>Set up your profile</h1>
            <div className="muted small">Helps us suggest the right scope items and pricing for your jobs.</div>
          </div>
          <input
            className="input"
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            placeholder="Business name (shows on quotes)"
            autoComplete="organization"
          />
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
          <button type="button" onClick={skipToApp} style={{
            background: 'none', border: 'none', color: 'var(--subtle)',
            fontSize: 12, cursor: 'pointer', padding: 4, fontFamily: 'inherit', marginTop: 2
          }}>
            Skip for now
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
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 0 }}>
          <div style={{ width: 24, height: 4, borderRadius: 2, background: 'var(--brand)' }} />
          <div style={{ width: 24, height: 4, borderRadius: 2, background: 'var(--brand)', opacity: 0.2 }} />
        </div>
        <div>
          <div className="eyebrow">Start free — no card needed</div>
          <h1 style={{ margin: '8px 0 4px' }}>Create your account</h1>
          <div className="muted small">3 fields. You'll be quoting in under a minute.</div>
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
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}
        <button className="btn btn-primary full-width" type="submit" disabled={loading}>
          {loading ? 'Creating account…' : 'Continue →'}
        </button>
        <div className="muted small" style={{ textAlign: 'center' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--brand-dark)', fontWeight: 700 }}>Log in</Link>
        </div>
      </form>
    </div>
  );
}
