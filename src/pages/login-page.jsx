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
          setError('Please confirm your email first — check your inbox for the confirmation link, or contact support if you never received it.');
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
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, fontWeight: 500 }}>Quote smarter. Win more jobs.</div>
        </div>
        <div>
          <div className="eyebrow">Welcome back</div>
          <h1 style={{ margin: '8px 0 0' }}>Log in</h1>
        </div>
        <input
          className="input"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email address"
          required
          autoComplete="email"
          autoFocus
        />
        <div style={{ position: 'relative' }}>
          <input
            className="input"
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            required
            autoComplete="current-password"
          />
          <button type="button" onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{showPass ? 'Hide' : 'Show'}</button>
        </div>
        <div style={{ textAlign: 'right', marginTop: -4 }}>
          <button type="button" onClick={handleForgotPassword} style={{ background: 'none', border: 'none', color: 'var(--brand-dark)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            {forgotSent ? 'Check your email ✓' : 'Forgot password?'}
          </button>
        </div>
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
          {loading ? 'Logging in…' : 'Log in'}
        </button>
        <div className="muted small" style={{ textAlign: 'center' }}>
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: 'var(--brand-dark)', fontWeight: 700 }}>Start free</Link>
        </div>
      </form>
    </div>
  );
}
