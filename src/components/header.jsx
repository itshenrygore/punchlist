import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';
import Logo from './logo';

export default function Header() {
  const { user } = useAuth();

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" aria-label="Punchlist"><Logo size="sm" /></Link>
        <nav className="header-nav">
          <a href="#demo">Demo</a>
          <a href="#how-it-works">How it works</a>
          <Link to="/pricing">Pricing</Link>
        </nav>
        <div className="header-actions">
          {user ? <Link className="btn btn-secondary" to="/app">Open app</Link> : <>
            <Link className="btn btn-secondary" to="/login">Log in</Link>
            <Link className="btn btn-primary" to="/signup">Start free</Link>
          </>}
        </div>
      </div>
    </header>
  );
}
