import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

/* ═══════════════════════════════════════════════════════════
   MobileNav — Phase 3 redesign.
   iOS "More" tab pattern: Home, Quotes, +New, Customers, More.
   The "More" tab opens a grid: Schedule, Invoices, Analytics, Settings.
   Every destination ≤2 taps. Hamburger menu eliminated.
   ═══════════════════════════════════════════════════════════ */

const NavIcon = ({ d }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

const TAB_PREFIXES = [
  { to: '/app/quotes', prefix: '/app/quotes' },
  { to: '/app/contacts', prefix: '/app/contacts' },
  { to: '/app/bookings', prefix: '/app/bookings' },
  { to: '/app/invoices', prefix: '/app/invoices' },
  { to: '/app/analytics', prefix: '/app/analytics' },
  { to: '/app/settings', prefix: '/app/settings' },
];

const MORE_ITEMS = [
  { to: '/app/bookings', label: 'Schedule', icon: 'M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2z M16 2v4 M8 2v4 M3 10h18' },
  { to: '/app/invoices', label: 'Invoices', icon: 'M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6' },
  { to: '/app/analytics', label: 'Analytics', icon: 'M18 20V10 M12 20V4 M6 20v-6' },
  { to: '/app/settings', label: 'Settings', icon: 'M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z M12 9a3 3 0 100 6 3 3 0 000-6z' },
];

export default function MobileNav() {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  function isTabActive(tabTo) {
    if (tabTo === '/app') {
      if (pathname === '/app') return true;
      return pathname.startsWith('/app') && !TAB_PREFIXES.some(t => pathname.startsWith(t.prefix));
    }
    const tab = TAB_PREFIXES.find(t => t.to === tabTo);
    return tab ? pathname.startsWith(tab.prefix) : false;
  }

  const moreActive = MORE_ITEMS.some(item => pathname.startsWith(item.to));

  return (
    <>
      {moreOpen && (
        <div className="mn-more-overlay" onClick={() => setMoreOpen(false)}>
          <div className="mn-more-grid" onClick={e => e.stopPropagation()}>
            {MORE_ITEMS.map(item => (
              <NavLink key={item.to} to={item.to} className={`mn-more-item ${pathname.startsWith(item.to) ? 'active' : ''}`} onClick={() => setMoreOpen(false)}>
                <NavIcon d={item.icon} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}

      <nav className="mobile-bottom-nav" aria-label="Main navigation">
        <NavLink to="/app" end={false} className={() => `mobile-nav-item${isTabActive('/app') ? ' active' : ''}`}>
          <span className="mobile-nav-icon"><NavIcon d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></span>
          <span className="mobile-nav-label">Home</span>
        </NavLink>
        <NavLink to="/app/quotes" className={() => `mobile-nav-item${isTabActive('/app/quotes') ? ' active' : ''}`}>
          <span className="mobile-nav-icon"><NavIcon d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" /></span>
          <span className="mobile-nav-label">Quotes</span>
        </NavLink>
        <NavLink to="/app/quotes/new" className="mobile-nav-action" aria-label="New quote">
          <span className="mobile-nav-action-icon" aria-hidden="true">+</span>
        </NavLink>
        <NavLink to="/app/contacts" className={() => `mobile-nav-item${isTabActive('/app/contacts') ? ' active' : ''}`}>
          <span className="mobile-nav-icon"><NavIcon d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" /></span>
          <span className="mobile-nav-label">Customers</span>
        </NavLink>
        <button type="button" className={`mobile-nav-item mn-more-btn ${moreActive || moreOpen ? 'active' : ''}`} onClick={() => setMoreOpen(p => !p)} aria-label="More options" aria-expanded={moreOpen}>
          <span className="mobile-nav-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg>
          </span>
          <span className="mobile-nav-label">More</span>
        </button>
      </nav>
    </>
  );
}
