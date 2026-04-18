import { AlertTriangle, DollarSign, Calendar, TrendingUp } from 'lucide-react';

/**
 * <HeadlineStat> — v100 M6.5
 *
 * The server-chosen priority metric that sits in Row 1 beside the
 * greeting. Renders as a pill-shaped chip whose colour indicates
 * urgency level.
 *
 * Renders null when no metric is present. The parent is responsible
 * for showing a skeleton during loading.
 */
export default function HeadlineStat({ metric }) {
  if (!metric) return null;

  const Icon =
    metric.type === 'followups' ? AlertTriangle
    : metric.type === 'deposits' ? DollarSign
    : metric.type === 'scheduled' ? Calendar
    : TrendingUp;

  const variant =
    metric.tone === 'urgent'  ? 'dv2-headline-metric--urgent'
    : metric.tone === 'warning' ? 'dv2-headline-metric--warning'
    : metric.tone === 'info'  ? 'dv2-headline-metric--info'
    : '';

  return (
    <div className={`dv2-headline-metric ${variant}`}>
      <Icon size={14} strokeWidth={2.2} />
      <span>{metric.label}</span>
    </div>
  );
}
