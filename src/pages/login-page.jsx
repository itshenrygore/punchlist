import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Logo from '../components/logo';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  async function handleForgotPassword() {
    if (!email.trim()) { setError('Enter your email first, then click Forgot password'); return; }
    try {
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/app/settings` });
      setForgotSent(true);
      setError('');
    } catch { setError('Could not send reset email. Try again.'); }
  }

  // Go back to where the user was trying to go, or default to /app
  const redirectTo = location.state?.from || '/app';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);

      if (loginError) {
        if (loginError.message.toLowerCase().includes('email not confirmed')) {
          setError('Confirm your email first — check your inbox for the link, or email hello@punchlist.ca if you never got one.');
        } else if (loginError.message.toLowerCase().includes('invalid login')) {
          setError('Email or password is incorrect. Double-check and try again.');
        } else {
          setError(loginError.message);
        }
        return;
      }

      if (data.session) {
        navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      setLoading(false);
      setError('Connection failed. Check your internet and try again.');
    }
  }

  return (
    <div className="auth-page">
      <form className="panel auth-card stack" data-testid="login-form" onSubmit={handleSubmit}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <Link to="/" style={{ display: 'inline-block' }}><Logo size="md" /></Link>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', marginTop: 6, fontWeight: 500 }}>Build, send, and track quotes from your phone.</div>
        </div>
        <div>
          <div className="eyebrow">Welcome back</div>
          <h1 style={{ margin: '8px 0 0' }}>Log in</h1>
        </div>
        <div>
          <label htmlFor="login-email" className="field-label">Email address</label>
          <input
            id="login-email"
            className="input"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="login-password" className="field-label">Password</label>
          <div style={{ position: 'relative' }}>
            <input
              id="login-password"
              className="input"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your password"
              required
              autoComplete="current-password"
            />
            <button type="button" onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer' }}>{showPass ? 'Hide' : 'Show'}</button>
          </div>
        </div>
        <div style={{ textAlign: 'right', marginTop: -8 }}>
          <button type="button" onClick={handleForgotPassword} style={{ background: 'none', border: 'none', color: 'var(--brand-dark)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            {forgotSent ? '✓ Check your email' : 'Forgot password?'}
          </button>
        </div>
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
        <button className="btn btn-primary full-width" type="submit" disabled={loading}>
          {loading ? 'Logging in…' : 'Log in'}
        </button>
        <div style={{ textAlign: 'center', fontSize: 'var(--text-2xs)', color: 'var(--subtle)', marginTop: -4 }}>Your quotes and customer data are waiting.</div>
        <div className="muted small" style={{ textAlign: 'center' }}>
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: 'var(--brand-dark)', fontWeight: 700 }}>Start free</Link>
        </div>
      </form>
    </div>
  );
}
