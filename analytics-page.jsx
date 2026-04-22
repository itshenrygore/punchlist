import { TrendingUp, Eye, DollarSign, CheckCircle } from 'lucide-react';

/* ───── Outcome card visuals ───── */
function CloseVisual() {
  return (
    <div className="lp-outcome-visual">
      <div className="lp-close-visual">
        <div className="lp-pc lp-pc--old">
          <div className="lp-pc-label">Full price</div>
          <div className="lp-pc-amount">$4,847</div>
          <div className="lp-pc-react" style={{ color: 'var(--lp-text-3)' }}>"I need to think about it"</div>
        </div>
        <span style={{ fontSize: 18, color: 'var(--lp-text-3)' }}>→</span>
        <div className="lp-pc lp-pc--new">
          <div className="lp-pc-label">Monthly option</div>
          <div className="lp-pc-amount" style={{ color: 'var(--lp-accent)' }}>~$404/mo</div>
          <div className="lp-pc-react" style={{ color: 'var(--lp-green)' }}>"When can you start?"</div>
        </div>
      </div>
    </div>
  );
}

function TrackVisual() {
  const events = [
    { color: '#3573E2', text: 'Quote sent to Lisa M.', time: '2m ago' },
    { color: '#22915A', text: 'Lisa opened your quote', time: '1m ago' },
    { color: '#3573E2', text: 'Viewed 3 times', time: '45s ago' },
    { color: '#D4722A', text: 'Lisa asked a question', time: 'Just now' },
  ];
  return (
    <div className="lp-outcome-visual">
      {events.map((ev, i) => (
        <div className="lp-track-ev" key={i}>
          <span className="lp-track-dot" style={{ background: ev.color }} />
          <span className="lp-track-text">{ev.text}</span>
          <span className="lp-track-time">{ev.time}</span>
        </div>
      ))}
    </div>
  );
}

function PaidVisual() {
  return (
    <div className="lp-outcome-visual" style={{ textAlign: 'center' }}>
      <div className="lp-paid-badge">
        <CheckCircle size={16} />
        $1,200 deposit collected
      </div>
      <div className="lp-paid-sub">Paid via Stripe · Instant transfer</div>
    </div>
  );
}

/* ───── Data ───── */
const OUTCOMES = [
  {
    num: '01',
    title: 'Close more jobs',
    desc: 'Monthly payment options turn "I need to think about it" into "When can you start?" Your customer picks a plan — you get paid in full upfront.',
    icon: TrendingUp,
    Visual: CloseVisual,
  },
  {
    num: '02',
    title: 'Track every quote',
    desc: 'Know the second a customer opens your quote, how many times they view it, and when to follow up. Push notifications keep you in the loop.',
    icon: Eye,
    Visual: TrackVisual,
  },
  {
    num: '03',
    title: 'Get paid in full',
    desc: 'Customers approve, e-sign, and pay their deposit in one tap. Stripe-powered. Money in your account, not a handshake.',
    icon: DollarSign,
    Visual: PaidVisual,
  },
];

export default function WorkflowDepth() {
  return (
    <div className="lp-outcomes-grid">
      {OUTCOMES.map((o, i) => (
        <div className={`lp-outcome-card card-lift rv rv-d${i + 1}`} key={o.num}>
          <div className="lp-outcome-num">{o.num}</div>
          <div className="lp-outcome-title">{o.title}</div>
          <div className="lp-outcome-desc">{o.desc}</div>
          <o.Visual />
        </div>
      ))}
    </div>
  );
}
