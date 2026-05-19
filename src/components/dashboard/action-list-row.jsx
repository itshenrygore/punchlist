import { Link } from 'react-router-dom';
import { MessageSquare, X } from 'lucide-react';
import { currency, relativeTime } from '../../lib/format';

/**
 * <ActionListRow> — v100 M6.5
 *
 * The star widget of the dashboard. One row per urgency-sorted
 * action item. Layout zones, left → right:
 *   1. Status dot      (8px urgency colour)
 *   2. Label stack     (primary title + secondary "why" line)
 *   3. Numeric         (right-aligned, tabular, nowrap)
 *   4. Action cluster  (primary button + dismiss ×)
 *
 * Entire row is a click target (opens the referenced entity).
 * The action button and dismiss button are separate click targets.
 *
 * Primary-vs-ghost button variant is controlled by the `primary`
 * prop — M6.5 spec caps this at the top 1–2 rows only.
 */
export default function ActionListRow({
  item,
  primary = false,
  onAction,
  onDismiss,
  style,
  className = '',
}) {
  const urgency = urgencyFor(item);
  const to = item.quote_id
    ? `/app/quotes/${item.quote_id}`
    : item.invoice_id
      ? `/app/invoices/${item.invoice_id}`
      : '#';

  const secondary = buildSecondary(item);
  const btnLabel = actionLabel(item);
  const hasActionTarget = item.customer_phone || item.customer_email;
  const showBtn = item.type === 'followup' && hasActionTarget;

  return (
    <div className={`dv2-arow ${className}`} style={style}>
      <Link className="dv2-arow-body" to={to}>
        <span
          className={`dv2-arow-dot dv2-arow-dot--${urgency}`}
          aria-hidden="true"
        />
        <div className="dv2-arow-labels">
          <span className="dv2-arow-primary">{item.title || 'Untitled'}</span>
          <span className="dv2-arow-secondary">{secondary}</span>
        </div>
        {item.total > 0 ? (
          <span className="dv2-arow-num">{currency(item.total)}</span>
        ) : (
          <span className="dv2-arow-num" aria-hidden="true" />
        )}
      </Link>
      <div className="dv2-arow-actions">
        {showBtn && (
          <button
            type="button"
            className={`dv2-arow-btn ${primary ? 'dv2-arow-btn--primary' : 'dv2-arow-btn--ghost'}`}
            onClick={() => onAction?.(item)}
          >
            <MessageSquare size={12} strokeWidth={2.2} />
            {btnLabel}
          </button>
        )}
        <button
          type="button"
          className="dv2-arow-dismiss"
          aria-label="Dismiss"
          onClick={() => onDismiss?.(item)}
        >
          <X size={14} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}

/* ── Urgency mapping ─────────────────────────────────────────── */
function urgencyFor(item) {
  if (item.type === 'invoice_overdue')  return 'red';
  if (item.type === 'scheduled_today')  return 'blue';
  if (item.type === 'viewed_hot')       return 'amber';
  if (item.type !== 'followup')         return 'muted';

  const ref = item.last_followup_at || item.sent_at;
  if (!ref) return 'muted';
  const days = (Date.now() - new Date(ref).getTime()) / 86400000;
  if (days >= 5) return 'red';
  if (days >= 2) return 'amber';
  return 'green';
}

/* ── Secondary-line builder — the "why" ──────────────────────── */
function buildSecondary(item) {
  const parts = [];
  if (item.customer_name) parts.push(item.customer_name);

  if (item.type === 'followup') {
    if (item.last_followup_at) {
      parts.push(`Nudged ${relativeTime(item.last_followup_at)}`);
    } else if (item.sent_at) {
      parts.push(`Sent ${relativeTime(item.sent_at)}`);
    }
    if (item.view_count > 0) {
      parts.push(`${item.view_count} view${item.view_count > 1 ? 's' : ''}`);
    }
  } else if (item.type === 'invoice_overdue' && item.days_overdue > 0) {
    parts.push(`${item.days_overdue}d overdue`);
  } else if (item.type === 'scheduled_today' && item.scheduled_for) {
    const t = new Date(item.scheduled_for).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
    parts.push(t);
  } else if (item.type === 'viewed_hot' && item.view_count > 0) {
    parts.push(`${item.view_count} views, not approved`);
  }

  return parts.filter(Boolean).join(' · ');
}

function actionLabel(item) {
  if (item.type !== 'followup') return 'Open';
  if (item.customer_phone) {
    const first = (item.customer_name || '').split(' ')[0];
    return first ? `Text ${first}` : 'Text';
  }
  if (item.customer_email) return 'Email';
  return 'Open';
}
