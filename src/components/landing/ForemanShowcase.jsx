import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Zap, Search, CheckCircle, RotateCcw } from 'lucide-react';

/* ───── Chat messages ───── */
const MESSAGES = [
  {
    type: 'user',
    content: "Just got to the call. Homeowner says water pooling under the bathroom sink. Here's what I'm looking at.",
  },
  {
    type: 'photo',
  },
  {
    type: 'bot',
    content: 'diagnosis',
    diagnosis: [
      { color: '#EF4444', text: 'Corroded compression fitting — brass-to-copper joint, green oxidation, active weeping' },
      { color: '#9A958D', text: 'Water-damaged cabinet base — particleboard swollen, leaking for weeks' },
      { color: '#F59E0B', text: 'Original gate valves — not quarter-turn, 20+ years, may not seal' },
    ],
  },
  {
    type: 'bot',
    content: 'scope',
    scope: [
      { name: 'Replace hot supply line & fitting', price: '$95' },
      { name: 'Replace both shut-offs (¼ turn)', price: '$145' },
      { name: 'Water damage assessment', price: '$65' },
      { name: 'Test all connections', price: '$55' },
    ],
    warnings: [
      'Check behind vanity for mold',
      'Verify P-trap from previous repair',
      'Confirm supply line length before leaving',
    ],
  },
  {
    type: 'bot',
    content: 'action',
    text: "Want me to build this into a quote? I'll use Mike's info and your 25% markup.",
  },
];

const DELAYS = [800, 2200, 2800, 2000, 1600];

/* ───── Feature list ───── */
const FEATURES = [
  { icon: Camera, title: 'Photo diagnosis', sub: 'Snap a photo of the issue — get a diagnosis with flagged concerns' },
  { icon: Search, title: 'Troubleshooting', sub: 'Identify parts, spot hidden damage, and flag risks before you quote' },
  { icon: Zap, title: 'Scope to quote', sub: 'Describe the job and get detailed line-item scope from a 1,000+ item catalog' },
  { icon: CheckCircle, title: 'Nothing missed', sub: 'Catches permits, haul-away, rough-in — items that protect your margin' },
];

/* ───── Component ───── */
export default function ForemanShowcase() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [done, setDone] = useState(false);
  const sectionRef = useRef(null);
  const timeoutsRef = useRef([]);

  const play = useCallback(() => {
    setVisibleCount(0);
    setDone(false);
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    let elapsed = 0;
    DELAYS.forEach((delay, i) => {
      elapsed += delay;
      const t = setTimeout(() => {
        setVisibleCount(i + 1);
        if (i === DELAYS.length - 1) setDone(true);
      }, elapsed);
      timeoutsRef.current.push(t);
    });
  }, []);

  // Auto-play on scroll into view
  useEffect(() => {
    if (hasPlayed) return;
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasPlayed(true);
          play();
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasPlayed, play]);

  // Cleanup
  useEffect(() => () => timeoutsRef.current.forEach(clearTimeout), []);

  const handleReplay = () => play();

  return (
    <div className="lp-foreman-grid" ref={sectionRef}>
      {/* Left: features */}
      <div>
        <div className="lp-foreman-badge rv">
          <Zap size={12} /> Foreman AI — Pro
        </div>
        <h2 className="lp-h2 rv rv-d1" style={{ color: '#fff', marginBottom: 12 }}>
          Your second set of eyes on every job.
        </h2>
        <p className="lp-foreman-desc rv rv-d2">
          Foreman sees what you see. Snap a photo, describe the situation, and get
          a diagnosis with flagged concerns — plus a ready-to-send scope with pricing.
        </p>
        <div className="lp-foreman-features">
          {FEATURES.map((f, i) => (
            <div className={`lp-foreman-feat rv rv-d${Math.min(i + 1, 3)}`} key={i}>
              <div className="lp-foreman-feat-icon">
                <f.icon size={16} color="var(--lp-accent)" />
              </div>
              <div>
                <div className="lp-foreman-feat-title">{f.title}</div>
                <div className="lp-foreman-feat-sub">{f.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: chat mock */}
      <div className="rv rv-d2">
        <div className="lp-foreman-chat">
          <div className="lp-foreman-chat-header">
            <div className="lp-foreman-chat-avatar">F</div>
            <div>
              <div className="lp-foreman-chat-name">Foreman</div>
              <div className="lp-foreman-chat-status">Active now</div>
            </div>
          </div>
          <div className="lp-foreman-chat-body">
            {MESSAGES.map((msg, i) => {
              const visible = i < visibleCount;
              if (msg.type === 'user') {
                return (
                  <div key={i} className={`lp-foreman-msg lp-foreman-msg--user${visible ? ' lp-foreman-msg--visible' : ''}`}>
                    {msg.content}
                  </div>
                );
              }
              if (msg.type === 'photo') {
                return (
                  <div key={i} className={`lp-foreman-msg lp-foreman-msg--photo${visible ? ' lp-foreman-msg--visible' : ''}`}>
                    <div className="lp-foreman-photo-placeholder">
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <Camera size={22} style={{ opacity: 0.4 }} />
                        <span style={{ fontSize: 10, opacity: 0.4, fontWeight: 500 }}>Photo attached</span>
                      </div>
                    </div>
                  </div>
                );
              }
              if (msg.content === 'diagnosis') {
                return (
                  <div key={i} className={`lp-foreman-msg lp-foreman-msg--bot${visible ? ' lp-foreman-msg--visible' : ''}`}>
                    <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                      DIAGNOSIS
                    </div>
                    {msg.diagnosis.map((d, j) => (
                      <div className="lp-foreman-diag" key={j}>
                        <span className="lp-foreman-diag-dot" style={{ background: d.color }} />
                        <span>{d.text}</span>
                      </div>
                    ))}
                  </div>
                );
              }
              if (msg.content === 'scope') {
                return (
                  <div key={i} className={`lp-foreman-msg lp-foreman-msg--bot${visible ? ' lp-foreman-msg--visible' : ''}`}>
                    <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                      RECOMMENDED SCOPE
                    </div>
                    {msg.scope.map((s, j) => (
                      <div className="lp-foreman-scope-item" key={j}>
                        <span>{s.name}</span>
                        <span style={{ fontFamily: 'var(--lp-f-mono)', fontWeight: 600 }}>{s.price}</span>
                      </div>
                    ))}
                    <div style={{
                      marginTop: 8, padding: '6px 8px', borderRadius: 6,
                      background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.15)',
                      fontSize: 10, color: 'rgba(245,158,11,0.9)', lineHeight: 1.5
                    }}>
                      <span style={{ fontWeight: 700 }}>⚠ Don't forget:</span> {msg.warnings.join(' · ')}
                    </div>
                  </div>
                );
              }
              if (msg.content === 'action') {
                return (
                  <div key={i} className={`lp-foreman-msg lp-foreman-msg--bot${visible ? ' lp-foreman-msg--visible' : ''}`}>
                    {msg.text}
                    <div className="lp-foreman-action-btns">
                      <span className="lp-foreman-action-btn lp-foreman-action-btn--primary">Build quote</span>
                      <span className="lp-foreman-action-btn lp-foreman-action-btn--ghost">Add more items</span>
                    </div>
                  </div>
                );
              }
              return null;
            })}
          </div>
          {done && (
            <button className="lp-foreman-replay" onClick={handleReplay}>
              <RotateCcw size={13} /> Replay
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
