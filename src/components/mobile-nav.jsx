import { NavLink, useLocation } from 'react-router-dom';
import { haptic } from '../hooks/use-mobile-ux';
import ForemanLogo from './foreman-logo';

const NavIcon = ({ d }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {d.split(' M').map((segment, i) => (
      <path key={i} d={i === 0 ? segment : 'M' + segment} />
    ))}
  </svg>
);

/**
 * MobileNav — fixed bottom navigation on phones.
 *
 * Slots: Home · Quotes · +New · Customers · Foreman
 *
 * Foreman lives here (replacing the previous "Menu" link to Settings)
 * because it's a primary action contractors reach for mid-job, not a
 * secondary preferences panel. Settings + Analytics + Templates etc.
 * are still one tap away via the topbar hamburger.
 *
 * Props:
 *   foremanOpen   — boolean, drives the active state of the Foreman slot
 *   onOpenForeman — callback to open the Foreman side-panel
 */
export default function MobileNav({ foremanOpen = false, onOpenForeman }) {
  const { pathname } = useLocation();

  const isHome      = pathname === '/app';
  const isQuotes    = pathname.startsWith('/app/quotes');
  const isCustomers = pathname.startsWith('/app/customers');

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

      <button
        type="button"
        className={`mobile-nav-item mobile-nav-foreman${foremanOpen ? ' active' : ''}`}
        aria-label="Open Foreman"
        aria-expanded={foremanOpen}
        onClick={() => { haptic('medium'); onOpenForeman?.(); }}
      >
        <span className="mobile-nav-icon"><ForemanLogo size={20} stroke /></span>
        <span className="mobile-nav-label">Foreman</span>
      </button>
    </nav>
  );
}
