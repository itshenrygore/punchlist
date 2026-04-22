import { CheckCircle, Eye, Camera, MessageSquare, Bell, Send, FileText } from 'lucide-react';

/* ───── Activity feed events ───── */
const EVENTS = [
  {
    icon: Send, color: '#3573E2', bg: 'rgba(53,115,226,0.1)',
    title: 'Quote sent', sub: 'Hot Water Tank Replacement — $4,847', time: '2:14 PM',
  },
  {
    icon: Eye, color: '#3573E2', bg: 'rgba(53,115,226,0.1)',
    title: 'Lisa opened your quote', sub: 'First view · iPhone Safari', time: '2:18 PM',
  },
  {
    icon: Eye, color: '#3573E2', bg: 'rgba(53,115,226,0.1)',
    title: 'Viewed again', sub: '3rd view · Shared with partner', time: '3:41 PM',
  },
  {
    icon: MessageSquare, color: '#D4722A', bg: 'rgba(212,114,42,0.1)',
    title: 'Lisa asked a question', sub: '"Is the Bradford White the best option?"', time: '3:52 PM',
  },
  {
    icon: Camera, color: '#7C5CDB', bg: 'rgba(124,92,219,0.1)',
    title: 'Photo shared', sub: 'Lisa sent a photo of the current tank', time: '3:55 PM',
  },
  {
    icon: FileText, color: '#D4722A', bg: 'rgba(212,114,42,0.1)',
    title: 'Amendment sent', sub: 'Added power vent upgrade — $380', time: '4:12 PM',
  },
  {
    icon: CheckCircle, color: '#22915A', bg: 'rgba(34,145,90,0.1)',
    title: 'Quote approved & signed', sub: 'E-signature captured', time: '4:30 PM',
  },
  {
    icon: Bell, color: '#22915A', bg: 'rgba(34,145,90,0.1)',
    title: '$1,200 deposit collected', sub: 'Visa •••• 4242 via Stripe', time: '4:30 PM',
  },
];

/* ───── Phone mockup items ───── */
const PHONE_ITEMS = [
  { name: 'Tank removal + disposal', price: '$280' },
  { name: '50-gal Bradford White install', price: '$2,450' },
  { name: 'Venting + gas line', price: '$890' },
  { name: 'Permit + inspection', price: '$250' },
  { name: 'Power vent upgrade', price: '$380', isNew: true },
];

export default function CustomerView() {
  return (
    <div className="lp-comm-grid">
      {/* Left: Activity feed */}
      <div>
        <div className="lp-comm-feed">
          {EVENTS.map((ev, i) => (
            <div className={`lp-comm-event rv rv-d${Math.min(i % 3 + 1, 3)}`} key={i}>
              <div className="lp-comm-event-icon" style={{ background: ev.bg }}>
                <ev.icon size={14} color={ev.color} />
              </div>
              <div className="lp-comm-event-text">
                <div className="lp-comm-event-title">{ev.title}</div>
                <div className="lp-comm-event-sub">{ev.sub}</div>
              </div>
              <div className="lp-comm-event-time">{ev.time}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Phone mockup */}
      <div className="rv rv-d2">
        <div className="lp-phone">
          <div className="lp-phone-notch" />
          <div className="lp-phone-screen">
            <div className="lp-phone-status">
              <span>9:41</span>
              <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 9 }}>●●●●</span>
                <span style={{ fontSize: 9 }}>WiFi</span>
                <span style={{ fontSize: 9 }}>🔋</span>
              </span>
            </div>
            <div className="lp-phone-content">
              <div className="lp-phone-quote-header">
                <span style={{ fontFamily: 'var(--lp-f-head)', fontWeight: 700, fontSize: 13 }}>
                  Hot Water Tank Replacement
                </span>
                <span className="lp-phone-updated-badge">Updated</span>
              </div>

              {PHONE_ITEMS.map((item, i) => (
                <div className="lp-phone-item" key={i}>
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    color: item.isNew ? 'var(--lp-accent)' : 'var(--lp-text)',
                  }}>
                    {item.isNew && (
                      <span style={{
                        fontSize: 7, fontWeight: 700, background: 'var(--lp-accent-light)',
                        color: 'var(--lp-accent-deep)', padding: '1px 4px', borderRadius: 3,
                      }}>NEW</span>
                    )}
                    {item.name}
                  </span>
                  <span style={{ fontFamily: 'var(--lp-f-mono)', fontWeight: 600, fontSize: 9 }}>
                    {item.price}
                  </span>
                </div>
              ))}

              <div className="lp-phone-total">
                <div className="lp-phone-total-cell">
                  <div className="lp-phone-total-label">Total</div>
                  <div className="lp-phone-total-amount">$4,250</div>
                </div>
                <div className="lp-phone-total-cell">
                  <div className="lp-phone-total-label">Or as low as</div>
                  <div className="lp-phone-total-amount" style={{ color: 'var(--lp-accent)' }}>
                    $354<span className="lp-phone-total-suffix">/mo</span>
                  </div>
                </div>
              </div>

              <div className="lp-phone-approve">Approve &amp; Pay Deposit</div>

              <div className="lp-phone-msg-bar">
                <Camera size={12} color="var(--lp-text-3)" />
                Send a photo or message...
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
