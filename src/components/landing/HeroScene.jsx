import { useState, useEffect, useRef, useCallback } from 'react';
import { Eye, CheckCircle, DollarSign, Shield, Lock } from 'lucide-react';

/* ───── Job data ───── */
const JOBS = [
  {
    title: 'Hot Water Tank Replacement', trade: 'Plumbing',
    items: [
      { n: 'Tank removal + disposal', p: 280 },
      { n: '50-gal Bradford White install', p: 2450 },
      { n: 'Venting + gas line', p: 890 },
      { n: 'Permit + inspection', p: 250 },
    ],
    total: 4847, mo: 404,
  },
  {
    title: '200A Panel Upgrade', trade: 'Electrical',
    items: [
      { n: '200A panel + breakers', p: 1850 },
      { n: 'Service entrance rewire', p: 1400 },
      { n: 'Grounding + bonding', p: 750 },
      { n: 'Permit + inspection', p: 350 },
    ],
    total: 4350, mo: 363,
  },
  {
    title: 'Furnace Replacement', trade: 'HVAC',
    items: [
      { n: 'High-efficiency gas furnace', p: 2800 },
      { n: 'Installation labour', p: 1650 },
      { n: 'Venting + gas line', p: 480 },
      { n: 'Old unit disposal', p: 270 },
    ],
    total: 5200, mo: 434,
  },
];

/* ───── Animated count-up ───── */
function useCountUp(target, duration = 900, active = false) {
  const [val, setVal] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!active) { setVal(0); return; }
    let start = null;
    const ease = t => 1 - Math.pow(1 - t, 3); // easeOutCubic
    const tick = ts => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal(Math.round(ease(p) * target));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration, active]);

  return val;
}

export default function HeroScene() {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState('in'); // 'in' | 'out'
  const timerRef = useRef(null);

  const cycle = useCallback(() => {
    setPhase('out');
    setTimeout(() => {
      setIdx(i => (i + 1) % JOBS.length);
      // Brief delay so new data renders before fading in
      requestAnimationFrame(() => setPhase('in'));
    }, 450);
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(cycle, 5000);
    return () => clearInterval(timerRef.current);
  }, [cycle]);

  const job = JOBS[idx];
  const totalVal = useCountUp(job.total, 800, phase === 'in');
  const moVal = useCountUp(job.mo, 800, phase === 'in');

  return (
    <div className="lp-scene-wrap">
      {/* Floating chips */}
      <div className="lp-hero-chips" style={{ top: '8%', right: '-18%', animation: 'lpFloat1 4.5s ease-in-out infinite' }}>
        <div className="lp-chip">
          <span className="lp-chip-icon" style={{ background: 'rgba(53,115,226,0.1)' }}>
            <Eye size={13} color="#3573E2" />
          </span>
          Lisa viewed your quote
        </div>
      </div>
      <div className="lp-hero-chips" style={{ bottom: '18%', left: '-14%', animation: 'lpFloat2 5s ease-in-out infinite 0.8s' }}>
        <div className="lp-chip">
          <span className="lp-chip-icon" style={{ background: 'rgba(34,145,90,0.1)' }}>
            <CheckCircle size={13} color="#22915A" />
          </span>
          Approved + signed
        </div>
      </div>
      <div className="lp-hero-chips" style={{ bottom: '4%', right: '-10%', animation: 'lpFloat1 5.5s ease-in-out infinite 1.6s' }}>
        <div className="lp-chip">
          <span className="lp-chip-icon" style={{ background: 'rgba(34,145,90,0.1)' }}>
            <DollarSign size={13} color="#22915A" />
          </span>
          Paid in full
        </div>
      </div>

      {/* Quote card */}
      <div className="lp-quote-card">
        {/* Browser chrome */}
        <div className="lp-chrome">
          <div className="lp-chrome-dots"><div /><div /><div /></div>
          <div className="lp-chrome-url">punchlist.ca/quote/Q-2847</div>
        </div>

        {/* Content area — fixed min-height, crossfade */}
        <div className={`lp-quote-content lp-quote-content--${phase}`}>
          <div className="lp-quote-header">
            <span className="lp-meta">Quote #Q-2847</span>
            <span className="lp-trade-badge">{job.trade}</span>
          </div>
          <div className="lp-quote-title">{job.title}</div>

          <div className="lp-line-items">
            {job.items.map((it, i) => (
              <div className="lp-line-item" key={i}>
                <span className="lp-line-name">{it.n}</span>
                <span className="lp-line-price">${it.p.toLocaleString()}</span>
              </div>
            ))}
          </div>

          {/* Price row */}
          <div className="lp-price-row">
            <div className="lp-price-cell">
              <div className="lp-price-label">Total</div>
              <div className="lp-price-value">${totalVal.toLocaleString()}</div>
            </div>
            <div className="lp-price-cell lp-price-cell--right">
              <div className="lp-price-label">Or as low as</div>
              <div className="lp-price-value" style={{ color: 'var(--lp-accent)' }}>
                ${moVal.toLocaleString()}<span className="lp-price-suffix">/mo</span>
              </div>
            </div>
          </div>

          {/* Approve CTA */}
          <div className="lp-approve-btn">Approve, Sign &amp; Pay Deposit</div>

          {/* Trust row */}
          <div className="lp-trust-row">
            <span className="lp-trust-chip"><Shield size={10} /> Stripe</span>
            <span className="lp-trust-chip"><Lock size={10} /> Encrypted</span>
          </div>
        </div>

        {/* Dots */}
        <div className="lp-dots">
          {JOBS.map((_, i) => (
            <div key={i} className={`lp-dot${i === idx ? ' lp-dot--active' : ''}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
