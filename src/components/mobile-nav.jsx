import { NavLink, useLocation } from 'react-router-dom';
import { haptic } from '../hooks/use-mobile-ux';

/* Minimal monoline nav icons — premium, no emoji */
const NavIcon = ({ d }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

/* Map tab prefixes for active-state detection */
const TAB_PREFIXES = [
  { to: '/app/quotes', prefix: '/app/quotes' },
  { to: '/app/bookings', prefix: '/app/bookings' },
  { to: '/app/invoices', prefix: '/app/invoices' },
];

export default function MobileNav() {
  const { pathname } = useLocation();

  /* Determine if a tab should be active — falls back to Home for unmatched /app/* pages */
  function isTabActive(tabTo) {
    if (tabTo === '/app') {
      // Home is active if we're at /app exactly OR on a secondary page that doesn't match any other tab
      if (pathname === '/app') return true;
      const matchesOther = TAB_PREFIXES.some(t => pathname.startsWith(t.prefix));
      return pathname.startsWith('/app') && !matchesOther;
    }
    const tab = TAB_PREFIXES.find(t => t.to === tabTo);
    return tab ? pathname.startsWith(tab.prefix) : false;
  }

  function handleNavTap() {
    haptic('selection');
  }

  return (
    <nav className="mobile-bottom-nav" aria-label="Main navigation">
      <NavLink to="/app" end={false} className={() => `mobile-nav-item${isTabActive('/app') ? ' active' : ''}`} onClick={handleNavTap}>
        <span className="mobile-nav-icon"><NavIcon d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></span>
        <span className="mobile-nav-label">Home</span>
      </NavLink>
      <NavLink to="/app/quotes" className={() => `mobile-nav-item${isTabActive('/app/quotes') ? ' active' : ''}`} onClick={handleNavTap}>
        <span className="mobile-nav-icon"><NavIcon d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" /></span>
        <span className="mobile-nav-label">Quotes</span>
      </NavLink>
      <NavLink to="/app/quotes/new" className="mobile-nav-action" aria-label="New quote" onClick={() => haptic('medium')}>
        <span className="mobile-nav-action-icon" aria-hidden="true">+</span>
      </NavLink>
      <NavLink to="/app/bookings" className={() => `mobile-nav-item${isTabActive('/app/bookings') ? ' active' : ''}`} onClick={handleNavTap}>
        <span className="mobile-nav-icon"><NavIcon d="M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2z M16 2v4 M8 2v4 M3 10h18" /></span>
        <span className="mobile-nav-label">Schedule</span>
      </NavLink>
      <NavLink to="/app/invoices" className={() => `mobile-nav-item${isTabActive('/app/invoices') ? ' active' : ''}`} onClick={handleNavTap}>
        <span className="mobile-nav-icon"><NavIcon d="M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></span>
        <span className="mobile-nav-label">Invoices</span>
      </NavLink>
    </nav>
  );
}
