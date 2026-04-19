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
 <div className="lgp-ta-center-c593">
 <Link to="/" className="lgp-inline-block-989e"><Logo size="md" /></Link>
 <div className="lgp-fs-sm-7890">Build, send, and track quotes from your phone.</div>
 </div>
 <div>
 <div className="eyebrow">Welcome back</div>
 <h1 className="lgp-s2-a0d0">Log in</h1>
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
 <div className="lgp-s1-7e60">
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
 <button type="button" onClick={() => setShowPass(p => !p)} className="lgp-fs-xs-f25d">{showPass ? 'Hide' : 'Show'}</button>
 </div>
 </div>
 <div className="lgp-ta-right-1301">
 <button type="button" onClick={handleForgotPassword} className="lgp-fs-xs-8167">
 {forgotSent ? '✓ Check your email' : 'Forgot password?'}
 </button>
 </div>
 {error && (
 <div className="lgp-fs-sm-09af">
 {error}
 </div>
 )}
 <button className="btn btn-primary full-width" type="submit" disabled={loading}>
 {loading ? 'Logging in…' : 'Log in'}
 </button>
 <div className="lgp-ta-center_fs-2xs-fa35">Your quotes and customer data are waiting.</div>
 <div className="muted small">
 Don't have an account?{' '}
 <Link to="/signup" className="lgp-s0-ba3a">Start free</Link>
 </div>
 </form>
 </div>
 );
}
