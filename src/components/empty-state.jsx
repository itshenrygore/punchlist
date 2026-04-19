import { Link } from 'react-router-dom';

/**
 * EmptyState — centered placeholder for pages with no data.
 * Matches the dashboard empty state visual pattern.
 */
export default function EmptyState({ icon, title, description, actionLabel, actionTo, onAction }) {
 return (
 <div className="es-grid_ta-center-8d80">
 {icon && <div className="es-s0-b060">{icon}</div>}
 {title && (
 <h3 className="es-fs-2xl-6424">
 {title}
 </h3>
 )}
 {description && (
 <p className="es-fs-base-332e">
 {description}
 </p>
 )}
 {actionLabel && actionTo && (
 <Link className="btn btn-primary" to={actionTo} tn-primary es-fs-base-0cdc {actionLabel}
 </Link>
 )}
 {actionLabel && !actionTo && onAction && (
 <button className="btn btn-primary" type="button" onClick={onAction} >
 {actionLabel}
 </button>
 )}
 </div>
 );
}
