import { Link } from 'react-router-dom';
import { MapPin, Phone, MessageSquare, ArrowUpRight } from 'lucide-react';
import { openMaps } from '../../lib/utils';
import { smsNotify } from '../../lib/sms';

/**
 * TodaySection — the "what am I doing right now" anchor on the
 * dashboard. Replaces the old "you'll remember your own schedule"
 * assumption with: customer name, address (tap → maps), phone (tap
 * → call), arrival window, and a one-tap "On my way" SMS.
 *
 * Renders nothing when there's nothing scheduled. We don't want a
 * persistent empty card eating space when the day is genuinely free.
 *
 * Props:
 *   jobs — array of quote-ish objects with: id, title, schedule_window
 *          (ISO), customer { name, phone, address }, total.
 *   contractorName — used in the "On my way" SMS body.
 *   country — for "ETA" copy.
 */
export default function TodaySection({ jobs, contractorName, country = 'CA' }) {
  if (!jobs || jobs.length === 0) return null;

  // Sort by scheduled time (earliest first).
  const sorted = [...jobs].sort((a, b) => {
    const at = a.schedule_window ? new Date(a.schedule_window).getTime() : 0;
    const bt = b.schedule_window ? new Date(b.schedule_window).getTime() : 0;
    return at - bt;
  });

  return (
    <section className="dv2-today dv2-enter" style={{ '--i': 1 }}>
      <div className="dv2-today-head">
        <h2 className="dv2-today-title">Today</h2>
        <span className="dv2-today-count">{sorted.length} job{sorted.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="dv2-today-list">
        {sorted.map((job) => (
          <TodayRow
            key={job.id}
            job={job}
            contractorName={contractorName}
            country={country}
          />
        ))}
      </div>
    </section>
  );
}

function TodayRow({ job, contractorName }) {
  const firstName = job.customer?.name?.split(' ')[0] || 'customer';
  const address = job.customer?.address;
  const phone = job.customer?.phone;
  const when = job.schedule_window ? new Date(job.schedule_window) : null;
  const timeLabel = when
    ? when.toLocaleTimeString('en-CA', { hour: 'numeric', minute: when.getMinutes() ? '2-digit' : undefined })
    : null;

  async function handleOnMyWay(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!phone) return;
    const ctaName = contractorName || 'I';
    const body = timeLabel
      ? `Hi ${firstName}, ${ctaName === 'I' ? "I'm" : ctaName + ' is'} on the way — ETA in about 30 min.`
      : `Hi ${firstName}, ${ctaName === 'I' ? "I'm" : ctaName + ' is'} on the way.`;
    try {
      const r = await smsNotify.customMessage({ to: phone, body });
      if (!r?.ok) {
        // Fall back to native composer if our gateway didn't take it.
        window.open(`sms:${phone}?body=${encodeURIComponent(body)}`, '_self');
      }
    } catch {
      window.open(`sms:${phone}?body=${encodeURIComponent(body)}`, '_self');
    }
  }

  return (
    <Link to={`/app/quotes/${job.id}`} className="dv2-today-row">
      <div className="dv2-today-row-main">
        <div className="dv2-today-row-when">
          {timeLabel || 'Today'}
        </div>
        <div className="dv2-today-row-body">
          <div className="dv2-today-row-customer">{job.customer?.name || 'Job'}</div>
          {job.title && <div className="dv2-today-row-title">{job.title}</div>}
          {address && (
            <button
              type="button"
              className="dv2-today-row-addr"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); openMaps(address); }}
            >
              <MapPin size={12} strokeWidth={2} />
              <span>{address}</span>
            </button>
          )}
        </div>
        <ArrowUpRight size={16} strokeWidth={2} className="dv2-today-row-arrow" />
      </div>
      <div className="dv2-today-row-actions">
        {phone && (
          <a
            className="dv2-today-action dv2-today-action--call"
            href={`tel:${phone.replace(/[^\d+]/g, '')}`}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Call ${firstName}`}
          >
            <Phone size={14} strokeWidth={2} />
            <span>Call</span>
          </a>
        )}
        {phone && (
          <button
            type="button"
            className="dv2-today-action dv2-today-action--otw"
            onClick={handleOnMyWay}
          >
            <MessageSquare size={14} strokeWidth={2} />
            <span>On my way</span>
          </button>
        )}
      </div>
    </Link>
  );
}
