import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

/**
 * <EmptyState> — v100 M6.5
 *
 * Designed empty state for the action list and other sections that
 * support an "all clear" render. M6.5 spec: empty states are
 * designed, not absent.
 *
 *   <EmptyState
 *     title="You're all caught up"
 *     sub="Next quote is a good one."
 *     cta={{ label: 'Build your next quote', to: '/app/quotes/new' }}
 *   />
 */
export default function EmptyState({
  icon: Icon = CheckCircle2,
  title,
  sub,
  cta,
  onCtaClick,
}) {
  return (
    <div className="dv2-section-empty">
      <Icon size={28} strokeWidth={1.5} className="dv2-section-empty-icon" />
      {title && <div className="dv2-section-empty-title">{title}</div>}
      {sub && <div className="dv2-section-empty-sub">{sub}</div>}
      {cta && cta.to && (
        <Link to={cta.to} onClick={onCtaClick} className="dv2-section-empty-cta">
          {cta.label}
        </Link>
      )}
    </div>
  );
}
