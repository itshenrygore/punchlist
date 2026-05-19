import { chipForStatus, toneForStatus } from '../lib/workflow';

export default function StatusBadge({ status }) {
  const tone = toneForStatus(status);
  const chip = chipForStatus(status);
  return <span className={`status-chip ${tone}`}>{chip}</span>;
}
