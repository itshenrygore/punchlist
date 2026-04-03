import { Link } from 'react-router-dom';

/**
 * EmptyState — centered placeholder for pages with no data.
 * Matches the dashboard empty state visual pattern.
 */
export default function EmptyState({ icon, title, description, actionLabel, actionTo, onAction }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '48px 24px',
      display: 'grid',
      gap: 14,
      placeItems: 'center',
    }}>
      {icon && <div style={{ fontSize: '2.5rem', marginBottom: 4 }}>{icon}</div>}
      {title && (
        <h3 style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: '-.02em',
          color: 'var(--text-2)',
        }}>
          {title}
        </h3>
      )}
      {description && (
        <p style={{
          color: 'var(--muted)',
          fontSize: 13,
          lineHeight: 1.6,
          margin: 0,
          maxWidth: 360,
        }}>
          {description}
        </p>
      )}
      {actionLabel && actionTo && (
        <Link className="btn btn-primary full-width" to={actionTo} style={{ maxWidth: 340, marginTop: 6 }}>
          {actionLabel}
        </Link>
      )}
      {actionLabel && !actionTo && onAction && (
        <button className="btn btn-primary full-width" type="button" onClick={onAction} style={{ maxWidth: 340, marginTop: 6 }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
