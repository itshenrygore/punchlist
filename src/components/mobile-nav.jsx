/* ═══════════════════════════════════════════════════════════════
   Punchlist 2.0 Mobile Nav — 3 tabs
   
   Home | [+ New Quote] | Quotes
   
   The + button is the most important action in the entire product.
   It stays elevated, green, and central.
   ═══════════════════════════════════════════════════════════════ */
import { NavLink, useLocation } from 'react-router-dom';
import { haptic } from '../hooks/use-mobile-ux';

const NavIcon = ({ d }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

export default function MobileNav() {
  const { pathname } = useLocation();

  const isHome = pathname === '/app' || (pathname.startsWith('/app') && !pathname.startsWith('/app/quotes') && !pathname.startsWith('/app/settings'));
  const isQuotes = pathname.startsWith('/app/quotes');

  return (
    <nav className="mobile-bottom-nav" aria-label="Main navigation">
      {/* Home */}
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

      {/* + New Quote — the sacred button */}
      <NavLink
        to="/app/quotes/new"
        className="mobile-nav-action"
        aria-label="New quote"
        onClick={() => haptic('medium')}
      >
        <span className="mobile-nav-action-icon" aria-hidden="true">+</span>
      </NavLink>

      {/* Quotes */}
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
    </nav>
  );
}
