import { useState, useCallback } from 'react';
import { AlertTriangle, ArrowRight, Shield, Lock } from 'lucide-react';

/* ───────────────────────────────────────────
   PRESETS — vetted for 1–5 person residential
   trade shops. Prices reflect 2024-25 Canadian
   market rates (Alberta / Ontario). Each preset
   has pre-built scope so there's zero compute
   on render — just data swap, instant load.
   ─────────────────────────────────────────── */
const PRESETS = [
  {
    label: 'Plumbing', icon: '🔧',
    title: 'Hot Water Tank Replacement',
    customer: 'Lisa Morgan — 42 Ridgewood Dr',
    text: 'Replace 40-gal electric hot water tank with 50-gal power vent gas. Tank is 14 years old, starting to rust at the base. Need to run gas line from meter. Haul away old unit.',
    core: [
      { name: '50-gal power vent gas tank (supply)', qty: 1, price: 1850 },
      { name: 'Installation labour (2 techs × 4 hrs)', qty: 1, price: 960 },
      { name: 'Gas line run from meter (15 ft)', qty: 1, price: 680 },
      { name: 'Venting — PVC sidewall vent install', qty: 1, price: 420 },
      { name: 'Old tank disconnect + haul-away', qty: 1, price: 175 },
      { name: 'Permit + gas inspection', qty: 1, price: 285 },
    ],
    caught: [
      { name: 'Expansion tank (code req.)', qty: 1, price: 195 },
      { name: 'Sediment trap + drip leg', qty: 1, price: 85 },
    ],
    gaps: ['Check TPR valve discharge routing', 'Verify gas meter capacity for added appliance', 'Inspect floor drain near tank'],
  },
  {
    label: 'Electrical', icon: '⚡',
    title: '200A Panel Upgrade',
    customer: "Dan O'Neill — 47 Rosehill Cres",
    text: 'Upgrade 100A Federal Pioneer panel to 200A. 1972 bungalow, original wiring. Need utility disconnect, new service entrance, and reconnect all existing circuits. Pull permit.',
    core: [
      { name: '200A panel + breakers (supply)', qty: 1, price: 1650 },
      { name: 'Service entrance cable + mast', qty: 1, price: 1180 },
      { name: 'Grounding + bonding (2 rods)', qty: 1, price: 680 },
      { name: 'Reconnect existing circuits (18)', qty: 18, price: 45 },
      { name: 'Utility disconnect / reconnect coord.', qty: 1, price: 350 },
      { name: 'Permit + ESA inspection', qty: 1, price: 380 },
    ],
    caught: [
      { name: 'Replace aluminum-to-copper pigtails', qty: 6, price: 35 },
      { name: 'Install whole-home surge protector', qty: 1, price: 245 },
    ],
    gaps: ['Check for aluminum branch wiring', 'Verify panel clearance (CSA 1m rule)', 'Test all GFCI/AFCI circuits post-install'],
  },
  {
    label: 'HVAC', icon: '🔥',
    title: 'Furnace Replacement',
    customer: 'Sarah Chen — 14 Pine St',
    text: 'Replace 15-year-old mid-efficiency furnace with high-efficiency gas furnace. Current unit is a Carrier 80% AFUE. House is ~1,800 sq ft, 2 storey. Existing ductwork in good shape.',
    core: [
      { name: '96% AFUE gas furnace (supply)', qty: 1, price: 2950 },
      { name: 'Installation labour (2 techs × 5 hrs)', qty: 1, price: 1400 },
      { name: 'PVC venting (intake + exhaust)', qty: 1, price: 520 },
      { name: 'Condensate drain line + pump', qty: 1, price: 285 },
      { name: 'Old furnace disconnect + disposal', qty: 1, price: 250 },
      { name: 'Gas permit + inspection', qty: 1, price: 275 },
    ],
    caught: [
      { name: 'Thermostat upgrade (smart, WiFi)', qty: 1, price: 195 },
      { name: 'Return air filter rack + media filter', qty: 1, price: 165 },
    ],
    gaps: ['Inspect heat exchanger for cracks before removal', 'Verify gas line sizing for high-efficiency unit', 'Check ductwork for asbestos tape (pre-1985)'],
  },
];

/* ─── Helpers ─── */
function calcTotal(preset, markup) {
  const coreCost = preset.core.reduce((s, i) => s + i.price * i.qty, 0);
  const caughtCost = preset.caught.reduce((s, i) => s + i.price * i.qty, 0);
  return Math.round((coreCost + caughtCost) * (1 + markup / 100));
}

function fmt(n) { return n.toLocaleString(); }

/* ═══════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════ */
export default function InteractiveDemo() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [markup, setMarkup] = useState(25);
  const [mobilePane, setMobilePane] = useState(0);

  const preset = PRESETS[activeIdx];
  const total = calcTotal(preset, markup);
  const monthly = Math.round(total / 12);
  const caughtValue = preset.caught.reduce((s, i) => s + i.price * i.qty, 0);

  const handlePreset = useCallback((i) => {
    setActiveIdx(i);
    setMobilePane(0);
  }, []);

  const paneLabels = ['Describe', 'Scope', 'Quote'];

  return (
    <div className="lp-demo-wrap rv">
      {/* Presets bar */}
      <div className="lp-demo-presets">
        <span className="lp-demo-preset-label">Try</span>
        {PRESETS.map((p, i) => (
          <button
            key={i}
            className={`lp-demo-preset-btn${activeIdx === i ? ' lp-demo-preset-btn--active' : ''}`}
            onClick={() => handlePreset(i)}
          >
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      {/* Mobile tabs */}
      <div className="lp-demo-mob-tabs">
        {paneLabels.map((label, i) => (
          <button
            key={i}
            className={`lp-demo-mob-tab${mobilePane === i ? ' lp-demo-mob-tab--active' : ''}`}
            onClick={() => setMobilePane(i)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 3 panes */}
      <div className="lp-demo-panes">

        {/* ── Pane 1: Describe ── */}
        <div className={`lp-demo-pane${mobilePane !== 0 ? ' lp-demo-pane--hidden' : ''}`}>
          <div className="lp-demo-pane-head">
            <span className="lp-demo-step-num">1</span>
            <span className="lp-demo-step-title">Describe the job</span>
          </div>
          <textarea
            className="lp-demo-textarea"
            rows={8}
            value={preset.text}
            readOnly
            style={{ cursor: 'default' }}
          />
          <div style={{ fontSize: 11, color: 'var(--lp-text-3)', marginTop: 8 }}>
            Customer: {preset.customer}
          </div>
          <button className="lp-demo-mob-next" onClick={() => setMobilePane(1)}>
            Review scope <ArrowRight size={14} style={{ verticalAlign: 'middle' }} />
          </button>
        </div>

        {/* ── Pane 2: Scope ── */}
        <div className={`lp-demo-pane${mobilePane !== 1 ? ' lp-demo-pane--hidden' : ''}`}>
          <div className="lp-demo-pane-head">
            <span className="lp-demo-step-num">2</span>
            <span className="lp-demo-step-title">Review scope</span>
          </div>

          {/* Core items */}
          {preset.core.map((item, i) => (
            <div className="lp-demo-scope-item" key={`c${i}`}>
              <span className="lp-demo-scope-name">
                <span className="lp-demo-scope-badge lp-demo-scope-badge--core">✓</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.name}
                </span>
              </span>
              <span className="lp-demo-scope-price">
                {item.qty > 1 ? `${item.qty} × $${fmt(item.price)}` : `$${fmt(item.price)}`}
              </span>
            </div>
          ))}

          {/* Caught items */}
          {preset.caught.map((item, i) => (
            <div className="lp-demo-scope-item" key={`r${i}`}>
              <span className="lp-demo-scope-name">
                <span className="lp-demo-scope-badge lp-demo-scope-badge--related">CAUGHT</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.name}
                </span>
              </span>
              <span className="lp-demo-scope-price">
                {item.qty > 1 ? `${item.qty} × $${fmt(item.price)}` : `$${fmt(item.price)}`}
              </span>
            </div>
          ))}

          {/* Caught summary card */}
          <div className="lp-demo-caught">
            <div className="lp-demo-caught-head">
              <AlertTriangle size={13} />
              Caught {preset.caught.length + preset.gaps.length} items you almost missed
              <span style={{ fontWeight: 400, color: 'var(--lp-text-2)' }}>
                {' '}— worth ${fmt(caughtValue)} in scope
              </span>
            </div>
            <div className="lp-demo-caught-text">
              {preset.gaps.join(' · ')}
            </div>
          </div>

          {/* Markup slider */}
          <div className="lp-demo-markup">
            <label>Markup</label>
            <input
              type="range" min={0} max={50}
              value={markup}
              onChange={(e) => setMarkup(Number(e.target.value))}
            />
            <span className="lp-demo-markup-val">{markup}%</span>
          </div>

          <button className="lp-demo-mob-next" onClick={() => setMobilePane(2)}>
            See customer quote <ArrowRight size={14} style={{ verticalAlign: 'middle' }} />
          </button>
        </div>

        {/* ── Pane 3: Customer quote ── */}
        <div className={`lp-demo-pane${mobilePane !== 2 ? ' lp-demo-pane--hidden' : ''}`}>
          <div className="lp-demo-pane-head">
            <span className="lp-demo-step-num">3</span>
            <span className="lp-demo-step-title">Customer sees this</span>
          </div>

          <div style={{ fontSize: 12, color: 'var(--lp-text-3)', marginBottom: 4 }}>
            {preset.customer}
          </div>
          <div style={{ fontFamily: 'var(--lp-f-head)', fontSize: 15, fontWeight: 700, marginBottom: 12, letterSpacing: '-0.01em' }}>
            {preset.title}
          </div>

          {[...preset.core, ...preset.caught].map((item, i) => (
            <div className="lp-demo-scope-item" key={i}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {item.name}
              </span>
              <span className="lp-demo-scope-price">
                ${fmt(Math.round(item.price * item.qty * (1 + markup / 100)))}
              </span>
            </div>
          ))}

          {/* Total + Monthly — the hero of this pane */}
          <div className="lp-demo-quote-total">
            <div className="lp-demo-quote-cell">
              <div className="lp-demo-quote-label">Total</div>
              <div className="lp-demo-quote-amount">${fmt(total)}</div>
            </div>
            <div className="lp-demo-quote-cell">
              <div className="lp-demo-quote-label">Or as low as</div>
              <div className="lp-demo-quote-amount" style={{ color: 'var(--lp-accent)' }}>
                ${fmt(monthly)}<span className="lp-demo-quote-suffix">/mo</span>
              </div>
            </div>
          </div>

          {/* Monthly option callout — let the numbers do the talking */}
          <div style={{
            margin: '10px 0 0', padding: '8px 12px', borderRadius: 10,
            background: 'var(--lp-accent-light)', border: '1px solid rgba(212,114,42,0.12)',
            fontSize: 11, color: 'var(--lp-accent-deep)', fontWeight: 600, textAlign: 'center',
          }}>
            Customer chooses monthly → you still get paid in full upfront
          </div>

          <div style={{
            marginTop: 10, padding: '11px', borderRadius: 12, textAlign: 'center',
            background: 'linear-gradient(135deg, var(--lp-accent), var(--lp-accent-deep))',
            color: '#fff', fontSize: 13, fontWeight: 600,
          }}>
            Approve, Sign &amp; Pay Deposit
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 8 }}>
            <span className="lp-trust-chip"><Shield size={10} /> Stripe</span>
            <span className="lp-trust-chip"><Lock size={10} /> Encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
}
