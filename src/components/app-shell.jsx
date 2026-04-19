import { useEffect, useRef, useState } from 'react';
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
import { useScrollToTop } from '../hooks/use-mobile-ux';
import { useToast } from './toast';

export default function AppShell({ title, subtitle, children, actions, hideTitle = false }) {
 const navigate = useNavigate();
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
 // Shown once per browser, on desktop only (where ⌘K is ergonomic), a
 // few seconds after the shell mounts so it doesn't compete with the
 // onboarding wizard or page loads.
 useEffect(() => {
 if (!user) return;
 try {
 if (localStorage.getItem('pl_cmdk_tip_seen')) return;
 } catch { /* storage blocked — show anyway, once */ }
 // Skip on narrow viewports — ⌘K is a desktop affordance
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
 // Check for pending offline drafts on mount
 getOfflineDrafts().then(d => setOfflineCount(d.length)).catch(e => console.warn('[PL]', e));
 return cleanup;
 }, [user]);

 async function handleSignOut() {
 try { await signOut(); } catch (e) { console.warn("[PL]", e); }
 navigate('/');
 }

 const navLinks = [
 { to: '/app', label: 'Dashboard', end: true },
 { to: '/app/quotes', label: 'Quotes' },
 { to: '/app/bookings', label: 'Schedule' },
 { to: '/app/contacts', label: 'Customers' },
 { to: '/app/invoices', label: 'Invoices' },
 { to: '/app/analytics', label: 'Analytics' },
 { to: '/app/settings', label: 'Settings' },
 ];

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
 {companyName && <div className="mobile-menu-company">{companyName}</div>}
 {user?.email && <div className="mobile-menu-email">{user.email}</div>}
 </div>
 {navLinks.map(({ to, label }) => (
 <Link key={to} className="mobile-menu-item" to={to} onClick={() => setMobileOpen(false)}>{label}</Link>
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
 {navLinks.map(({ to, label, end }) => (
 <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'active' : ''}>{label}</NavLink>
 ))}
 <div className="ash-s0-f72f" />
 <button className="btn btn-secondary btn-sm app-sidebar-signout" type="button" onClick={handleSignOut}>Sign out</button>
 </aside>
 <main id="main-content" className="app-main app-main-padded app-content">{children}</main>
 </div>

 <MobileNav />
 <Foreman />
 </div>
 );
}
