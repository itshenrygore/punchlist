import { Link } from 'react-router-dom';

/**
 * EmptyState — the canonical "zero data" surface.
 *
 * `children` is rendered after the description, before any
 * actionLabel/actionTo — use it to slot custom action groups
 * (e.g. .es-actions with two buttons) when a single CTA isn't enough.
 */
export default function EmptyState({ icon, title, description, actionLabel, actionTo, onAction, children }) {
  return (
    <div className="es-root">
      {icon && <div className="es-icon">{icon}</div>}
      {title && <h3 className="es-title">{title}</h3>}
      {description && <p className="es-desc">{description}</p>}
      {children}
      {actionLabel && actionTo && (
        <Link className="btn btn-primary es-action" to={actionTo}>{actionLabel}</Link>
      )}
      {actionLabel && !actionTo && onAction && (
        <button className="btn btn-primary es-action" type="button" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}
