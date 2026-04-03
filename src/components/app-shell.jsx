import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';
import { useTheme } from '../contexts/theme-context';
import GlobalSearch from './global-search';
import NotificationCenter from './notification-center';
import MobileNav from './mobile-nav';
import Logo, { LogoMark } from './logo';
import Foreman from './foreman';
import { isOnline, onConnectivityChange, syncOfflineDrafts, getOfflineDrafts } from '../lib/offline';
import { createQuote } from '../lib/api';
import useScrollLock from '../hooks/use-scroll-lock';

export default function AppShell({ title, subtitle, children, actions }) {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  useScrollLock(mobileOpen);
  const [online, setOnline] = useState(isOnline());
  const [offlineCount, setOfflineCount] = useState(0);

  // Escape closes mobile menu
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = e => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  // 7C: Monitor online/offline status and auto-sync drafts when reconnected
  useEffect(() => {
    const cleanup = onConnectivityChange((nowOnline) => {
      setOnline(nowOnline);
      if (nowOnline && user) {
        syncOfflineDrafts(user.id, createQuote).then(({ synced }) => {
          if (synced > 0) setOfflineCount(0);
        }).catch(() => {});
      }
    });
    // Check for pending offline drafts on mount
    getOfflineDrafts().then(d => setOfflineCount(d.length)).catch(() => {});
    return cleanup;
  }, [user]);

  async function handleSignOut() {
    try { await signOut(); } catch {}
    navigate('/');
  }

  const navLinks = [
    { to: '/app',              label: 'Dashboard', end: true },
    { to: '/app/quotes',       label: 'Quotes' },
    { to: '/app/quotes/new',   label: 'New quote' },
    { to: '/app/contacts',     label: 'Contacts' },
    { to: '/app/bookings',     label: 'Schedule' },
    { to: '/app/analytics',    label: 'Analytics' },
    { to: '/app/settings',     label: 'Settings' },
    { to: '/app/billing',      label: 'Billing' },
  ];

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="container app-topbar-inner">
          <div className="app-topbar-branding">
            <Link to="/app" aria-label="Punchlist home">
              <Logo size="sm" />
            </Link>
            <div className="app-topbar-titleblock">
              {title && <div className="page-kicker">{title}</div>}
              {subtitle && <div className="app-topbar-subtitle">{subtitle}</div>}
            </div>
          </div>
          <div className="app-topbar-actions">
            {!online && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 'var(--r-pill)', background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: 11, fontWeight: 700, letterSpacing: '.02em' }}>
                ● Offline
              </span>
            )}
            <GlobalSearch />
            <NotificationCenter />
            {actions}
            <button className="btn btn-ghost btn-sm topbar-theme-btn" type="button" onClick={toggleTheme} aria-label="Toggle theme" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} style={{ fontSize: 15, padding: '6px 8px', minHeight: 'auto' }}>{theme === 'dark' ? '☀️' : '🌙'}</button>
            <Link className="btn btn-primary btn-sm topbar-new-quote" to="/app/quotes/new">New quote</Link>
            <button className="btn btn-secondary btn-sm mobile-menu-btn" type="button" aria-label="Open menu" onClick={() => setMobileOpen(!mobileOpen)}>&#9776;</button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="mobile-overlay" onClick={() => setMobileOpen(false)}>
          <div className="mobile-menu" onClick={e => e.stopPropagation()} role="dialog" aria-label="Navigation menu">
            <div className="mobile-menu-who">
              <Logo size="sm" />
              {user?.email && <div style={{ fontSize:11, fontWeight:400, color:'var(--muted)', marginTop:4 }}>{user.email}</div>}
            </div>
            {navLinks.map(({ to, label }) => (
              <Link key={to} className="mobile-menu-item" to={to} onClick={() => setMobileOpen(false)}>{label}</Link>
            ))}
            <hr style={{ border:'none', borderTop:'1px solid var(--line)', margin:'8px 0' }} />
            <button className="mobile-theme-toggle" type="button" onClick={() => { toggleTheme(); setMobileOpen(false); }}>
              {theme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode'}
            </button>
            <button className="mobile-menu-item danger" type="button" onClick={handleSignOut}>Sign out</button>
          </div>
        </div>
      )}

      <div className="container app-layout">
        <aside className="app-sidebar">
          <div style={{ paddingBottom:12, marginBottom:6, borderBottom:'1px solid var(--line)' }}>
            <LogoMark size={28} />
          </div>
          {navLinks.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end}>{label}</NavLink>
          ))}
          <button type="button" onClick={() => { if (window.__punchlistOpenForeman) window.__punchlistOpenForeman(); }} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 12px', background:'none', border:'1px solid var(--line)', borderRadius:'var(--r-sm)', color:'var(--muted)', fontSize:12, fontWeight:600, cursor:'pointer', marginTop:8, width:'100%', textAlign:'left', transition:'all .15s' }}>
            💬 Foreman <span style={{ fontSize:10, color:'var(--subtle)', fontWeight:400 }}>Your trades assistant</span>
          </button>
          <div style={{ flex:1 }} />
          <button className="btn btn-secondary btn-sm" type="button" onClick={handleSignOut} style={{ marginTop:4 }}>Sign out</button>
        </aside>
        <main className="app-main app-main-padded">{children}</main>
      </div>

      <MobileNav />
      <Foreman />
    </div>
  );
}
