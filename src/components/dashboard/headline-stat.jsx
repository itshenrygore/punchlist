import { AlertTriangle, DollarSign, Calendar, TrendingUp } from 'lucide-react';

/**
 * <HeadlineStat> — v2 rewrite
 *
 * Shows the server-chosen priority metric beside the greeting.
 * Suppresses misleading metrics (0% close rate, 0 values).
 */
export default function HeadlineStat({ metric }) {
  if (!metric) return null;

  // Don't show close rate when it's 0% — it's demoralizing, not informative
  if (metric.type === 'close_rate' && (metric.value === 0 || metric.value === '0')) return null;
  // Don't show any metric with a 0 or empty value
  if (metric.value === 0 || metric.value === '0' || !metric.value) return null;

  const Icon =
    metric.type === 'followups' ? AlertTriangle
    : metric.type === 'deposits' ? DollarSign
    : metric.type === 'scheduled' ? Calendar
    : TrendingUp;

  const variant =
    metric.tone === 'urgent'  ? 'dv2-headline-metric--urgent'
    : metric.tone === 'warning' ? 'dv2-headline-metric--warning'
    : metric.tone === 'info'  ? 'dv2-headline-metric--info'
    : 'dv2-headline-metric--neutral';

  return (
    <div className={`dv2-headline-metric ${variant}`}>
      <Icon size={14} strokeWidth={2.2} />
      <span>{metric.label}</span>
    </div>
  );
}
