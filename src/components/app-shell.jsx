import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
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
import { useScrollToTop } from '../hooks/use-mobile-ux';
import { useToast } from './toast';
import { useKeyboardVisible } from '../hooks/use-keyboard-visible';
import { useHideOnScroll } from '../hooks/use-hide-on-scroll';

export default function AppShell({ title, subtitle, children, actions, hideTitle = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const { show: showToast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  useScrollLock(mobileOpen);
  const [online, setOnline] = useState(isOnline());
  const headerRef = useRef(null);
  useScrollToTop(headerRef);
  const [offlineCount, setOfflineCount] = useState(0);
  const [companyName, setCompanyName] = useState('');

  // v103 Phase 3: Keyboard detection — sets data-keyboard="open" on <html>
  useKeyboardVisible();

  // v103 Phase 3: Auto-hide topbar on scroll down (mobile only)
  useHideOnScroll();

  // v100 M4: Classic view escape hatch (§9.4). Shown for 30 days post-v100 release.
  // Release date: 2026-04-14. Remove this block after 2026-05-14.
  const V100_RELEASE = new Date('2026-04-14T00:00:00Z');
  const ESCAPE_HATCH_DAYS = 30;
  const showClassicLink = (Date.now() - V100_RELEASE.getTime()) / 86400000 < ESCAPE_HATCH_DAYS;
  const [dashVersion, setDashVersion] = useState(() => {
    try { return localStorage.getItem('pl_dash_version') || 'v2'; } catch { return 'v2'; }
  });

  // Fetch company name for sidebar personalization
  useEffect(() => {
    if (!user) return;
    import('../lib/api').then(({ getProfile }) => {
      getProfile(user.id).then(p => {
        if (p?.company_name) setCompanyName(p.company_name);
        else if (p?.full_name) setCompanyName(p.full_name);
      }).catch(e => console.warn('[PL]', e));
    });
  }, [user]);

  // Escape closes mobile menu
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = e => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  // v100 Phase 9 (UX-006): one-shot tip introducing the command palette.
  useEffect(() => {
    if (!user) return;
    try {
      if (localStorage.getItem('pl_cmdk_tip_seen')) return;
    } catch { /* storage blocked — show anyway, once */ }
    if (typeof window !== 'undefined' && window.innerWidth < 900) return;
    const t = setTimeout(() => {
      showToast('Tip: press \u2318 K anywhere to search or run a command.', 'info');
      try { localStorage.setItem('pl_cmdk_tip_seen', '1'); } catch { /* noop */ }
    }, 6000);
    return () => clearTimeout(t);
  }, [user, showToast]);

  // 7C: Monitor online/offline status and auto-sync drafts when reconnected
  useEffect(() => {
    const cleanup = onConnectivityChange((nowOnline) => {
      setOnline(nowOnline);
      if (nowOnline && user) {
        syncOfflineDrafts(user.id, createQuote).then(({ synced }) => {
          if (synced > 0) setOfflineCount(0);
        }).catch(e => console.warn('[PL]', e));
      }
    });
    getOfflineDrafts().then(d => setOfflineCount(d.length)).catch(e => console.warn('[PL]', e));
    return cleanup;
  }, [user]);

  async function handleSignOut() {
    try { await signOut(); } catch (e) { console.warn("[PL]", e); }
    navigate('/');
  }

  // v100 M4: toggle dashboard version
  async function handleClassicView() {
    const next = dashVersion === 'v2' ? 'v1' : 'v2';
    setDashVersion(next);
    try { localStorage.setItem('pl_dash_version', next); } catch { /* no-op */ }
    if (user) {
      import('../lib/supabase').then(({ supabase }) => {
        supabase.from('profiles').update({ dashboard_version: next }).eq('id', user.id).then(() => {});
      });
    }
    if (next === 'v1') {
      import('../lib/analytics').then(({ track }) => track('dashboard_downgrade', { from: 'v2', to: 'v1' }));
    }
    window.location.reload();
  }

  const navLinks = [
    { to: '/app',              label: 'Dashboard', end: true, icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
    { to: '/app/quotes',       label: 'Quotes', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8' },
    { to: '/app/bookings',     label: 'Schedule', icon: 'M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2z M16 2v4 M8 2v4 M3 10h18' },
    { to: '/app/contacts',     label: 'Customers', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75' },
    { to: '/app/invoices',     label: 'Invoices', icon: 'M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6' },
    { to: '/app/analytics',    label: 'Analytics', icon: 'M18 20V10 M12 20V4 M6 20v-6' },
    { to: '/app/settings',     label: 'Settings', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z' },
  ];

  const NavIcon = ({ d }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}><path d={d} /></svg>
  );

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-to-main">Skip to main content</a>
      <header className="app-topbar" ref={headerRef}>
        <div className="container app-topbar-inner">
          <div className="app-topbar-branding">
            <Link to="/app" aria-label="Punchlist home">
              <Logo size="sm" />
            </Link>
            <div className="app-topbar-titleblock">
              {!hideTitle && title && <div className="page-kicker">{title}</div>}
              {!hideTitle && subtitle && <div className="app-topbar-subtitle">{subtitle}</div>}
            </div>
          </div>
          <div className="app-topbar-actions">
            {!online && (
              <span className="offline-pill">
                ● Offline
              </span>
            )}
            <GlobalSearch />
            <NotificationCenter />
            <span className="topbar-page-actions">{actions}</span>
            <button className="btn btn-ghost btn-sm topbar-theme-btn" type="button" onClick={toggleTheme} aria-label="Toggle theme" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}><span className="topbar-theme-icon">{theme === 'dark' ? '☀️' : '🌙'}</span></button>
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
              {companyName && <div className="mobile-menu-company" style={{ color: 'var(--text)', fontWeight: 600 }}>{companyName}</div>}
              {user?.email && <div className="mobile-menu-email" style={{ color: 'var(--text-2)' }}>{user.email}</div>}
            </div>
            {navLinks.map(({ to, label, icon }) => (
              <Link key={to} className="mobile-menu-item" to={to} onClick={() => setMobileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text)' }}>
                <NavIcon d={icon} />
                {label}
              </Link>
            ))}
            <hr className="mobile-menu-divider" />
            <button className="mobile-theme-toggle" type="button" onClick={() => { toggleTheme(); setMobileOpen(false); }}>
              {theme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode'}
            </button>
            <button className="mobile-menu-item danger" type="button" onClick={handleSignOut}>Sign out</button>
          </div>
        </div>
      )}

      <div className="container app-layout">
        <aside className="app-sidebar">
          <div className="app-sidebar-brand">
            <LogoMark size={28} />
            {companyName && <div className="app-sidebar-company">{companyName}</div>}
          </div>
          {navLinks.map(({ to, label, end, icon }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'active' : ''} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <NavIcon d={icon} />
              {label}
            </NavLink>
          ))}
          <div style={{ flex:1 }} />
          {showClassicLink && (
            <button
              type="button"
              className="dv2-classic-link"
              onClick={handleClassicView}
              title={dashVersion === 'v2' ? 'Switch back to the previous dashboard layout' : 'Switch to new dashboard'}
            >
              {dashVersion === 'v2' ? '← Classic view' : '→ New dashboard'}
            </button>
          )}
          <button className="btn btn-secondary btn-sm app-sidebar-signout" type="button" onClick={handleSignOut}>Sign out</button>
        </aside>
        <main id="main-content" className="app-main app-main-padded app-content app-content-enter" key={location.pathname}>{children}</main>
      </div>

      <MobileNav />
      <Foreman />
    </div>
  );
}
