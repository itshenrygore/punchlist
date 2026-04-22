import { Link } from 'react-router-dom';

/**
 * EmptyState — centered placeholder for pages with no data.
 * Matches the dashboard empty state visual pattern.
 */
export default function EmptyState({ icon, title, description, actionLabel, actionTo, onAction }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '56px 28px',
      display: 'grid',
      gap: 12,
      placeItems: 'center',
    }}>
      {icon && <div style={{ fontSize: '2.5rem', marginBottom: 8, opacity: 0.8 }}>{icon}</div>}
      {title && (
        <h3 style={{
          margin: 0,
          fontSize: 'var(--text-2xl)',
          fontWeight: 800,
          letterSpacing: '-.03em',
          color: 'var(--text)',
          lineHeight: 1.2,
        }}>
          {title}
        </h3>
      )}
      {description && (
        <p style={{
          color: 'var(--muted)',
          fontSize: 'var(--text-base)',
          lineHeight: 1.6,
          margin: 0,
          maxWidth: 380,
        }}>
          {description}
        </p>
      )}
      {actionLabel && actionTo && (
        <Link className="btn btn-primary" to={actionTo} style={{ marginTop: 10, padding: '12px 28px', fontSize: 'var(--text-base)' }}>
          {actionLabel}
        </Link>
      )}
      {actionLabel && !actionTo && onAction && (
        <button className="btn btn-primary" type="button" onClick={onAction} style={{ marginTop: 10, padding: '12px 28px', fontSize: 'var(--text-base)' }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
