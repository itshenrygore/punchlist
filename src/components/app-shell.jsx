/* ═══════════════════════════════════════════════════════════════
   Punchlist 2.0 App Shell
   
   Sidebar: Home, Quotes, Settings (+ divider)
   Topbar: Logo, notifications, theme toggle, + New Quote button
   
   Removed: Foreman chat widget, global search (⌘K), classic view
   toggle, booking drawer, offline indicator, 4 nav items
   (Schedule, Customers, Invoices, Analytics).
   ═══════════════════════════════════════════════════════════════ */
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';
import { useTheme } from '../contexts/theme-context';
import NotificationCenter from './notification-center';
import MobileNav from './mobile-nav';
import Logo, { LogoMark } from './logo';
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

  useKeyboardVisible();
  useHideOnScroll();

  // Fetch company name for sidebar
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

  // Auto-sync offline drafts
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

  const navLinks = [
    { to: '/app',          label: 'Home',     end: true, icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
    { to: '/app/quotes',   label: 'Quotes',   icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8' },
    { to: '/app/invoices', label: 'Invoices', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 5a2 2 0 000 4h6a2 2 0 000-4M9 5a2 2 0 012-2h2a2 2 0 012 2 M12 12h.01 M12 16h.01' },
    { to: '/app/settings', label: 'Settings', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z' },
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
              <span className="offline-pill">● Offline</span>
            )}
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
              <Link key={to} className="mobile-menu-item" to={to} onClick={() => setMobileOpen(false)}>
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
          {navLinks.filter(l => l.label !== 'Settings').map(({ to, label, end, icon }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}>
              <NavIcon d={icon} />
              <span>{label}</span>
            </NavLink>
          ))}
          <div style={{ flex: 1 }} />
          <NavLink to="/app/settings" className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}>
            <NavIcon d={navLinks.find(l => l.label === 'Settings').icon} />
            <span>Settings</span>
          </NavLink>
          <button className="btn btn-secondary btn-sm app-sidebar-signout" type="button" onClick={handleSignOut}>Sign out</button>
        </aside>
        <main id="main-content" className="app-main app-main-padded app-content app-content-enter" key={location.pathname}>{children}</main>
      </div>

      <MobileNav />
      {/* Foreman chat widget REMOVED in 2.0 — scope checker stays in the builder */}
    </div>
  );
}
