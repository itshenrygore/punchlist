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
    // Basic format check so users don't get a false "Check your email"
    // confirmation when they typed something obviously wrong.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('That doesn’t look like a valid email — fix the typo and try again.');
      return;
    }
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/app/settings` });
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
        <div className="auth-logo-row">
          <Link to="/"><Logo size="md" /></Link>
        </div>
        <div className="auth-header">
          <div className="eyebrow">Welcome back</div>
          <h1>Log in</h1>
          <div className="login-tagline">Build, send, and track quotes from your phone.</div>
        </div>
        <div className="auth-field">
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
        <div className="auth-field">
          <label htmlFor="login-password" className="field-label">Password</label>
          <div className="auth-pass-wrap">
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
            <button type="button" onClick={() => setShowPass(p => !p)} className="login-show-pass">{showPass ? 'Hide' : 'Show'}</button>
          </div>
        </div>
        <div className="auth-forgot-row">
          <button type="button" tabIndex={-1} onClick={handleForgotPassword} className="login-forgot">
            {forgotSent ? '\u2713 Check your email' : 'Forgot password?'}
          </button>
        </div>
        {error && <div className="auth-error login-error">{error}</div>}
        <button className="btn btn-primary full-width" type="submit" disabled={loading}>
          {loading ? 'Logging in\u2026' : 'Log in'}
        </button>
        <div className="auth-social-proof login-footer">Your quotes and customer data are waiting.</div>
        <div className="auth-switch">
          Don't have an account?{' '}
          <Link to="/signup">Start free</Link>
        </div>
      </form>
    </div>
  );
}
