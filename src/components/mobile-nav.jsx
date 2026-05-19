import { NavLink, useLocation } from 'react-router-dom';
import { haptic } from '../hooks/use-mobile-ux';

const NavIcon = ({ d }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {d.split(' M').map((segment, i) => (
      <path key={i} d={i === 0 ? segment : 'M' + segment} />
    ))}
  </svg>
);

export default function MobileNav() {
  const { pathname } = useLocation();

  const isHome      = pathname === '/app';
  const isQuotes    = pathname.startsWith('/app/quotes');
  const isCustomers = pathname.startsWith('/app/customers');
  const isSettings  = pathname.startsWith('/app/settings') || pathname.startsWith('/app/analytics') || pathname.startsWith('/app/invoices') || pathname.startsWith('/app/billing') || pathname.startsWith('/app/templates');

  return (
    <nav className="mobile-bottom-nav" aria-label="Main navigation">
      <NavLink
        to="/app"
        end
        className={() => `mobile-nav-item${isHome ? ' active' : ''}`}
        onClick={() => haptic('selection')}
      >
        <span className="mobile-nav-icon">
          <NavIcon d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </span>
        <span className="mobile-nav-label">Home</span>
      </NavLink>

      <NavLink
        to="/app/quotes"
        className={() => `mobile-nav-item${isQuotes ? ' active' : ''}`}
        onClick={() => haptic('selection')}
      >
        <span className="mobile-nav-icon">
          <NavIcon d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" />
        </span>
        <span className="mobile-nav-label">Quotes</span>
      </NavLink>

      {/* New Quote — elevated central action */}
      <NavLink
        to="/app/quotes/new"
        className="mobile-nav-action"
        aria-label="New quote"
        onClick={() => haptic('medium')}
      >
        <span className="mobile-nav-action-icon" aria-hidden="true">+</span>
      </NavLink>

      <NavLink
        to="/app/customers"
        className={() => `mobile-nav-item${isCustomers ? ' active' : ''}`}
        onClick={() => haptic('selection')}
      >
        <span className="mobile-nav-icon">
          <NavIcon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75" />
        </span>
        <span className="mobile-nav-label">Customers</span>
      </NavLink>

      <NavLink
        to="/app/settings"
        className={() => `mobile-nav-item${isSettings ? ' active' : ''}`}
        onClick={() => haptic('selection')}
      >
        <span className="mobile-nav-icon">
          <NavIcon d="M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </span>
        <span className="mobile-nav-label">Menu</span>
      </NavLink>
    </nav>
  );
}
