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

  const isHome = pathname === '/app' || (pathname.startsWith('/app') && !pathname.startsWith('/app/quotes') && !pathname.startsWith('/app/invoices') && !pathname.startsWith('/app/settings'));
  const isQuotes = pathname.startsWith('/app/quotes');
  const isInvoices = pathname.startsWith('/app/invoices');
  const isSettings = pathname.startsWith('/app/settings');

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
        to="/app/invoices"
        className={() => `mobile-nav-item${isInvoices ? ' active' : ''}`}
        onClick={() => haptic('selection')}
      >
        <span className="mobile-nav-icon">
          <NavIcon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 5a2 2 0 000 4h6a2 2 0 000-4M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </span>
        <span className="mobile-nav-label">Invoices</span>
      </NavLink>

      <NavLink
        to="/app/settings"
        className={() => `mobile-nav-item${isSettings ? ' active' : ''}`}
        onClick={() => haptic('selection')}
      >
        <span className="mobile-nav-icon">
          <NavIcon d="M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </span>
        <span className="mobile-nav-label">Settings</span>
      </NavLink>
    </nav>
  );
}
