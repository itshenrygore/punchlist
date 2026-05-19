import { Link } from 'react-router-dom';

export default function EmptyState({ icon, title, description, actionLabel, actionTo, onAction }) {
  return (
    <div className="es-root">
      {icon && <div className="es-icon">{icon}</div>}
      {title && <h3 className="es-title">{title}</h3>}
      {description && <p className="es-desc">{description}</p>}
      {actionLabel && actionTo && (
        <Link className="btn btn-primary es-action" to={actionTo}>{actionLabel}</Link>
      )}
      {actionLabel && !actionTo && onAction && (
        <button className="btn btn-primary es-action" type="button" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}
