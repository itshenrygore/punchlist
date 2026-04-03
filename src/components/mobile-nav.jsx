import { NavLink } from 'react-router-dom';

export default function MobileNav() {
  return (
    <nav className="mobile-bottom-nav" aria-label="Main navigation">
      <NavLink to="/app" end className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
        <span className="mobile-nav-icon">🏠</span>
        <span className="mobile-nav-label">Home</span>
      </NavLink>
      <NavLink to="/app/bookings" className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
        <span className="mobile-nav-icon">📅</span>
        <span className="mobile-nav-label">Schedule</span>
      </NavLink>
      <NavLink to="/app/quotes/new" className="mobile-nav-action" aria-label="New quote">
        <span className="mobile-nav-action-icon" aria-hidden="true">+</span>
      </NavLink>
      <NavLink to="/app/contacts" className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
        <span className="mobile-nav-icon">👤</span>
        <span className="mobile-nav-label">Contacts</span>
      </NavLink>
      <NavLink to="/app/quotes" className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
        <span className="mobile-nav-icon">📋</span>
        <span className="mobile-nav-label">Quotes</span>
      </NavLink>
    </nav>
  );
}
