import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Still checking session — show a proper loading screen, not blank white
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        background: 'var(--bg)',
        color: 'var(--muted)',
        fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      }}>
        <div className="loading-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        <div style={{ fontSize: 14, fontWeight: 600 }}>Loading Punchlist…</div>
      </div>
    );
  }

  // Not logged in — send to login, preserving intended destination
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return children;
}
