/**
 * HeroDemo — full state-machine interactive demo
 * States: idle → typing → building → revealing → active → done
 * Uses AI API for scope generation. Daily limit: 3 runs.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TRADES, TRADE_BASELINES } from '../../shared/tradeBrain';
import { currency } from '../lib/format';
import { consumeDemoRun, getRemainingDemoRuns } from '../lib/demo-limit';

/* ── Job presets ── */
const JOBS = [
  {
    label: 'Faucet',
    text: 'Replace leaking kitchen faucet. Drips from the drain basket. Tenant needs it fixed today.',
    trade: 'Plumber',
  },
  {
    label: 'No heat',
    text: 'No heat upstairs. Furnace short cycling — kicks on then shuts off after 2 minutes. Needs diagnostic.',
    trade: 'HVAC',
  },
  {
    label: 'Outlets',
    text: 'Add two 20A outlets in garage workshop. Check panel capacity. Customer wants permit if required.',
    trade: 'Electrician',
  },
  {
    label: 'Door',
    text: 'Replace interior door and casing. Paint-ready finish needed. Jamb condition unknown, may need shimming.',
    trade: 'Carpenter',
  },
];

const PROCESSING_STAGES = [
  '✔ Recognizing job type',
  '✔ Identifying scope',
  '✔ Building line items',
];

/* ── Local trade detection ── */
function detectTrade(text) {
  const lc = text.toLowerCase();
  for (const trade of TRADES) {
    const aliases = TRADE_BASELINES[trade]?.aliases || [];
    if (aliases.some(a => lc.includes(a))) return trade;
  }
  return 'Plumber';
}

/* ── Scope builder — tries AI first, falls back to tradeBrain ── */
async function buildScopeAsync(text, hintTrade) {
  const trade = hintTrade || detectTrade(text);

  // Try the real AI scope API (same as in-app)
  try {
    const r = await fetch('/api/ai-scope', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: text, trade, estimatorRoute: 'balanced' }),
    });
    if (r.ok) {
      const data = await r.json();
      const items = (data.items || []).slice(0, 8).map((it, i) => ({
        id: i,
        name: String(it.description || it.name || 'Item').slice(0, 50),
        price: Number(it.unit_price || it.mid || 120),
        lo: Number(it.lo || Math.round((it.unit_price || 120) * 0.78)),
        hi: Number(it.hi || Math.round((it.unit_price || 120) * 1.3)),
        why: String(it.why || ''),
        on: true,
      }));
      if (items.length >= 3) {
        const gaps = (data.gaps || []).slice(0, 2);
        const insight = data.insights?.[0] || data.scope_summary || `${trade} scope drafted.`;
        return { trade, insight, items, gaps };
      }
    }
  } catch {}

  // Fallback: local tradeBrain
  return buildScopeLocal(text, trade);
}

function buildScopeLocal(text, trade) {
  // Simple fallback when AI is unavailable - generic items
  const fallbackItems = {
    Plumber: [
      ['Diagnostic / service call', 165, 'First-hour assessment'],
      ['Repair labour', 185, 'Core repair time'],
      ['Materials allowance', 95, 'Fittings and parts'],
      ['Disposal & cleanup', 85, 'Haul-away and site cleanup'],
    ],
    Electrician: [
      ['Diagnostic / service call', 165, 'Assessment and troubleshoot'],
      ['Install labour', 195, 'Device or circuit work'],
      ['Materials allowance', 120, 'Wire, boxes, devices'],
      ['Permit & inspection', 145, 'If required'],
    ],
    HVAC: [
      ['Diagnostic labour', 175, 'System testing and diagnosis'],
      ['Repair labour', 195, 'Once issue confirmed'],
      ['Parts allowance', 215, 'Repair parts'],
      ['Startup & safety check', 110, 'Commissioning'],
    ],
    Carpenter: [
      ['Install labour', 165, 'Measure, cut, install'],
      ['Materials allowance', 160, 'Trim, lumber, fasteners'],
      ['Paint-ready finish', 95, 'Caulk, fill, sand'],
    ],
  };
  
  const items = (fallbackItems[trade] || fallbackItems.Plumber).map((it, i) => ({
    id: i,
    name: it[0],
    price: it[1],
    lo: Math.round(it[1] * 0.78),
    hi: Math.round(it[1] * 1.3),
    why: it[2],
    on: true,
  }));
  
  return { 
    trade, 
    insight: `${trade} scope drafted. Customize items and prices.`,
    items,
    gaps: ['Verify access and site conditions', 'Confirm scope before starting'],
  };
}

/* ── Animated count-up ── */
function CountUp({ value, active }) {
  const [shown, setShown] = useState(0);
  const rafRef = useRef(null);
  const prevRef = useRef(0);
  useEffect(() => {
    if (!active) { setShown(0); prevRef.current = 0; return; }
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;
    if (from === to) return;
    let start = null;
    const dur = 500;
    function step(ts) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      setShown(Math.round(from + (to - from) * p));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    }
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, active]);
  return <span>{currency(shown)}</span>;
}

/* ── Main demo ── */
export default function HeroDemo() {
  const [jobIdx, setJobIdx]     = useState(0);
  const [typedText, setTypedText] = useState('');
  const [userEditing, setUserEditing] = useState(false);
  const [state, setState]       = useState('idle'); // idle|typing|building|revealing|active|done|exhausted
  const [stagesShown, setStagesShown] = useState(0);
  const [items, setItems]       = useState([]);
  const [selected, setSelected] = useState(new Set([0]));
  const [scope, setScope]       = useState(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [tooltip, setTooltip]   = useState(null);
  const [remaining, setRemaining] = useState(() => getRemainingDemoRuns());

  const timers = useRef([]);
  const typeTimer = useRef(null);
  const idleTimer = useRef(null);
  const resetTimer = useRef(null);
  const taRef = useRef(null);

  function clearAll() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    clearTimeout(typeTimer.current);
    clearTimeout(idleTimer.current);
    clearTimeout(resetTimer.current);
  }

  const job = JOBS[jobIdx];

  /* ── Auto-type simulation ── */
  const startTyping = useCallback(() => {
    if (userEditing) return;
    const fullText = job.text;
    let i = typedText.length;
    setState('typing');
    function typeNext() {
      if (i >= fullText.length || userEditing) {
        if (!userEditing) setTypedText(fullText);
        return;
      }
      // Variable speed: pause at punctuation
      const ch = fullText[i];
      const delay = /[.,!?]/.test(ch) ? 220 : /\s/.test(ch) ? 55 : 38 + Math.random() * 22;
      typeTimer.current = setTimeout(() => {
        i++;
        setTypedText(fullText.slice(0, i));
        typeNext();
      }, delay);
    }
    typeNext();
  }, [job, typedText, userEditing]);

  /* ── Start idle timer on mount / job change ── */
  useEffect(() => {
    if (state !== 'idle' && state !== 'typing') return;
    if (typedText) return;
    idleTimer.current = setTimeout(startTyping, 1600);
    return () => clearTimeout(idleTimer.current);
  }, [jobIdx, state]);

  /* ── When typing completes, pulse the button ── */
  const typingDone = typedText.length >= job.text.length && state === 'typing';

  /* ── Run demo ── */
  function runDemo() {
    if (remaining <= 0) { setState('exhausted'); return; }
    if (!typedText.trim()) return;
    clearAll();
    setState('building');
    setStagesShown(0);
    setRevealedCount(0);
    setItems([]);
    setTooltip(null);

    const consumed = consumeDemoRun();
    setRemaining(consumed);

    // Show processing stages sequentially
    PROCESSING_STAGES.forEach((_, i) => {
      const t = setTimeout(() => setStagesShown(n => n + 1), 180 + i * 220);
      timers.current.push(t);
    });

    // After stages, build and reveal items
    const buildT = setTimeout(async () => {
      const result = await buildScopeAsync(typedText, job.trade);
      setScope(result);
      setSelected(new Set(result.items.map((_, i) => i))); // all pre-selected
      setState('revealing');

      result.items.forEach((_, i) => {
        const t = setTimeout(() => {
          setRevealedCount(n => n + 1);
          if (i === result.items.length - 1) {
            // After last item, show full active state
            setTimeout(() => setState('done'), 600);
          }
        }, i * 160);
        timers.current.push(t);
      });
    }, 180 + PROCESSING_STAGES.length * 220 + 120);
    timers.current.push(buildT);

    // Auto-reset after 28s of inactivity
    resetTimer.current = setTimeout(() => softReset(), 28000);
  }

  function softReset() {
    clearAll();
    const nextIdx = (jobIdx + 1) % JOBS.length;
    setJobIdx(nextIdx);
    setTypedText('');
    setUserEditing(false);
    setState('idle');
    setStagesShown(0);
    setItems([]);
    setScope(null);
    setRevealedCount(0);
    setTooltip(null);
    setRemaining(getRemainingDemoRuns());
  }

  function toggleItem(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /* ── Totals ── */
  const visibleItems = scope?.items.slice(0, revealedCount) || [];
  const total = visibleItems.filter(i => selected.has(i.id)).reduce((s, i) => s + i.price, 0);
  const isDone = state === 'done';

  /* ── Input handler ── */
  function handleInput(e) {
    setUserEditing(true);
    clearTimeout(typeTimer.current);
    clearTimeout(idleTimer.current);
    setTypedText(e.target.value);
    if (state === 'idle' || state === 'typing') setState('idle');
  }

  function handleJobPill(i) {
    clearAll();
    setJobIdx(i);
    setTypedText('');
    setUserEditing(false);
    setState('idle');
    setStagesShown(0);
    setScope(null);
    setRevealedCount(0);
    setTooltip(null);
    setRemaining(getRemainingDemoRuns());
  }

  const showOutput = state === 'building' || state === 'revealing' || state === 'done';

  return (
    <div className="hd-root">
      {/* ── Header strip ── */}
      <div className="hd-strip">
        <span className="hd-live-dot" />
        <span className="hd-strip-label">Live demo</span>
        <span className="hd-strip-sub">No account · {remaining} free run{remaining !== 1 ? 's' : ''} left today</span>
      </div>

      <div className="hd-body">
        {/* ── Left: Input ── */}
        <div className="hd-left">
          <div className="hd-input-label">Describe the job</div>
          <textarea
            ref={taRef}
            className={`hd-ta ${typingDone ? 'hd-ta-ready' : ''}`}
            value={typedText}
            onChange={handleInput}
            onFocus={() => { setUserEditing(true); clearTimeout(idleTimer.current); clearTimeout(typeTimer.current); }}
            placeholder="Type a job the way you'd text it to a helper…"
            rows={4}
            disabled={state === 'building' || state === 'revealing'}
          />

          {/* Job pills */}
          <div className="hd-pills">
            {JOBS.map((j, i) => (
              <button
                key={i}
                type="button"
                className={`hd-pill ${i === jobIdx ? 'active' : ''}`}
                onClick={() => handleJobPill(i)}
              >{j.label}</button>
            ))}
          </div>

          {/* Build button */}
          {state === 'exhausted' ? (
            <div className="hd-exhausted">
              <p>You've used your 3 free demo runs for today.</p>
              <Link className="btn btn-primary full-width" to="/signup" style={{ marginTop:8 }}>
                Create free account to continue →
              </Link>
            </div>
          ) : (
            <button
              className={`hd-run-btn ${(typingDone || (userEditing && typedText.trim())) ? 'hd-run-btn-ready' : ''}`}
              type="button"
              disabled={state === 'building' || state === 'revealing' || !typedText.trim()}
              onClick={runDemo}
            >
              {state === 'building' ? (
                <><span className="hd-spinner" />Building…</>
              ) : (
                <>⚡ Build scope — free</>
              )}
            </button>
          )}

          {/* Totals (show in left col once done) */}
          {isDone && scope && (
            <div className="hd-totals">
              <div className="hd-total-row">
                <span>Subtotal</span>
                <CountUp value={total} active={isDone} />
              </div>
              <div className="hd-total-row hd-total-grand">
                <span>Est. total</span>
                <CountUp value={Math.round(total * 1.05)} active={isDone} />
              </div>
              <Link className="hd-send-btn" to="/signup">
                Send this quote →
              </Link>
              <div className="hd-send-note">Free account · no credit card</div>
            </div>
          )}
        </div>

        {/* ── Right: Output ── */}
        <div className="hd-right">
          {!showOutput && (
            <div className="hd-idle-state">
              <div className="hd-idle-icon">⚡</div>
              <div className="hd-idle-title">Scope appears here</div>
              <div className="hd-idle-sub">Line items · pricing · scope check</div>
              <div className="hd-idle-hint">← Type a job and hit Build</div>
            </div>
          )}

          {/* Processing stages */}
          {(state === 'building' || state === 'revealing' || state === 'done') && (
            <div className="hd-stages">
              {PROCESSING_STAGES.map((s, i) => (
                <div key={i} className={`hd-stage ${i < stagesShown ? 'hd-stage-in' : ''}`}>
                  {i < stagesShown ? '✔' : '○'} {s.replace('✔ ', '')}
                </div>
              ))}
            </div>
          )}

          {/* Items */}
          {scope && (
            <>
              <div className="hd-items-head">
                <span className="hd-trade-tag">{scope.trade}</span>
                <span className="hd-insight-text">{scope.insight}</span>
              </div>
              <div className="hd-items">
                {scope.items.map((item, i) => {
                  if (i >= revealedCount) return null;
                  const isOn = selected.has(item.id);
                  const isHovered = tooltip === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`hd-item hd-item-in ${isOn ? 'hd-item-on' : 'hd-item-off'}`}
                      onClick={() => toggleItem(item.id)}
                      onMouseEnter={() => setTooltip(item.id)}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <div className={`hd-check ${isOn ? 'on' : ''}`}>
                        {isOn ? '✓' : ''}
                      </div>
                      <div className="hd-item-name">{item.name}</div>
                      {isHovered && item.why && (
                        <div className="hd-tooltip">{item.why}</div>
                      )}
                      <div className="hd-item-right">
                        {i === 0 && <span className="hd-ai-tag">Smart</span>}
                        <span className="hd-item-price">{currency(item.price)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Confidence / scope check */}
              {isDone && scope.gaps.length > 0 && (
                <div className="hd-scope-check">
                  <div className="hd-sc-label">Scope check</div>
                  <div className="hd-sc-item hd-sc-ok">✓ Core work covered</div>
                  {scope.gaps.slice(0, 2).map((g, i) => (
                    <div key={i} className="hd-sc-item hd-sc-warn">⚠ {g}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
