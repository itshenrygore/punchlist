/**
 * InteractiveDemo v7
 *
 * Fixes from field testing:
 * - Only auto-select essential/standard items, not optional
 * - 3 groups: Labour, Materials, Services (not 2)
 * - Descriptive preset labels
 * - Realistic mid-range pricing (not 70th percentile on everything)
 * - AI tier data flows through to selection
 * - Layout doesn't shift after demo runs
 */
import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSmartSuggestions } from '../../shared/smartCatalog';
import { roundPrice } from '../../shared/tradeBrain';
import { currency } from '../lib/format';

/* ─── Presets: one per trade, descriptive label ─── */
const TRADE_PRESETS = {
  Plumber: [
    { label: 'Poly B repipe to PEX (2-bath home)', text: 'Full Poly B replacement with PEX for a 2-bathroom home. Remove all existing polybutylene piping, install PEX throughout, new shut-off valves at each fixture, drywall repair and patching, permit and inspection.' },
  ],
  Electrician: [
    { label: 'Upgrade 100A panel to 200A', text: 'Upgrade electrical panel from 100A to 200A service. Transfer all existing circuits, install new grounding, ESA permit and inspection.' },
  ],
  HVAC: [
    { label: 'Replace 18-year-old AC condenser', text: 'Replace central AC condenser unit. Current unit is 18 years old R-22, not worth repairing. Install new R-410A condenser, connect to existing linesets, vacuum and charge.' },
  ],
};
const TRADES = Object.keys(TRADE_PRESETS);

const DK = 'pl_demo_v3';
function demoCount() { try { const s = JSON.parse(localStorage.getItem(DK)); return s?.date === new Date().toISOString().slice(0, 10) ? s.count : 0; } catch { return 0; } }
function bumpDemo() { const d = new Date().toISOString().slice(0, 10), c = demoCount() + 1; try { localStorage.setItem(DK, JSON.stringify({ count: c, date: d })); } catch (e) { console.warn("[PL]", e); } }

/* ─── Pricing: rounded to nearest 5/10 for clean, professional numbers ─── */
function midPrice(item) {
  const lo = Number(item.lo) || 0;
  const hi = Number(item.hi) || 0;
  const mid = Number(item.mid || item.unit_price) || Math.round((lo + hi) / 2);
  const raw = hi > lo ? lo + (hi - lo) * 0.55 : mid || 100;
  return roundPrice(raw);
}

function normalizeCategory(cat) {
  const c = (cat || '').toLowerCase();
  if (c === 'labour' || c === 'labor') return 'Labour';
  if (c === 'materials' || c === 'material') return 'Materials';
  if (c === 'services' || c === 'service') return 'Services';
  if (c === 'permit') return 'Services';
  if (c === 'disposal') return 'Services';
  return 'Services';
}

/* ─── Determine if item should be auto-selected ─── */
function isEssential(item) {
  const tier = (item.tier || '').toLowerCase();
  if (tier === 'optional') return false;
  const conf = (item.confidence || item.include_confidence || '').toLowerCase();
  if (conf === 'low') return false;
  // Materials under $30 are likely essentials (supply lines, valves, etc)
  // Large-ticket optionals (e.g. $800 "upgrade to tankless") should NOT auto-select
  if (item.category === 'Materials' && item.price > 500) return false;
  return true;
}

/* ─── AI scope fetch ─── */
async function fetchAiScope(description, trade) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch('/api/ai-scope', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ description, trade, province: 'AB', country: 'CA' }),
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();

    if (data.items && data.items.length >= 2) {
      return {
        items: data.items.map((it, i) => {
          const raw = {
            lo: Number(it.lo) || 0,
            hi: Number(it.hi) || 0,
            mid: Number(it.mid || it.unit_price) || 0,
          };
          return {
            id: `ai${i}`,
            name: it.description || it.name || '',
            price: midPrice(raw),
            qty: Math.max(1, Number(it.quantity) || 1),
            lo: roundPrice(raw.lo),
            hi: roundPrice(raw.hi),
            category: normalizeCategory(it.category),
            reason: it.why || it.reason || '',
            when: it.when || '',
            skip: it.skip || '',
            tier: it.tier || 'standard',
            confidence: it.include_confidence || 'high',
          };
        }),
        scopeNote: data.scope_summary || data.jobType || `${trade} scope`,
        source: 'ai',
      };
    }
    throw new Error('No items returned');
  } catch (err) {
    clearTimeout(timeout);
    console.warn('[demo] AI failed, falling back:', err.message);
    return null;
  }
}

/* ─── Local catalog fallback ─── */
function catalogFallback(description, trade) {
  const r = getSmartSuggestions({ description, title: '', trade, province: 'AB' });
  const raw = [...r.core, ...r.related];
  
  // Inject dispatch/diagnostic if not present
  const hasDispatch = raw.some(i => /dispatch|diagnostic|service call/i.test(i.name));
  if (!hasDispatch && raw.length > 0) {
    const dp = { Plumber: 105, Electrician: 100, HVAC: 135, 'General Contractor': 70 };
    raw.unshift({ name: 'Dispatch / diagnostic', category: 'Services', lo: (dp[trade] || 110) - 15, hi: (dp[trade] || 110) + 15, mid: dp[trade] || 110, tier: 'core', reason: 'Standard on every job' });
  }
  
  const labourRaw = raw.filter(i => i.category === 'Labour' || i.category === 'Services');
  const subTasks = labourRaw.filter(i => (i.mid || Math.round((i.lo + i.hi) / 2)) < 600);
  const filtered = subTasks.length >= 3
    ? raw.filter(i => { if (i.category !== 'Labour' && i.category !== 'Services') return true; return (i.mid || Math.round((i.lo + i.hi) / 2)) < 2000; })
    : raw;
  const lp = filtered.filter(i => i.category === 'Labour' || i.category === 'Services');
  const mp = filtered.filter(i => i.category === 'Materials');
  const balanced = [...lp.slice(0, 3), ...mp.slice(0, 2)].slice(0, 5);
  return {
    items: balanced.map((it, i) => ({
      id: `c${i}`,
      name: it.name,
      price: midPrice(it),
      qty: 1,
      lo: it.lo || 0,
      hi: it.hi || 0,
      category: it.category || 'Labour',
      reason: it.reason || '',
      when: '', skip: '',
      tier: r.core.includes(it) ? 'standard' : 'optional',
      confidence: r.core.includes(it) ? 'high' : 'medium',
    })),
    scopeNote: r.reason || `${trade} scope`,
    source: 'catalog',
  };
}


export default function InteractiveDemo({ inline = false }) {
  const [trade, setTrade] = useState('Plumber');
  const [desc, setDesc] = useState('');
  const [phase, setPhase] = useState('input');
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [scopeNote, setScopeNote] = useState('');
  const [revealN, setRevealN] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [aiSource, setAiSource] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const timers = useRef([]);

  const presets = TRADE_PRESETS[trade];

  const runDemo = useCallback(async (text, isAuto = false) => {
    const d = text || desc;
    if (!d.trim()) return;

    timers.current.forEach(clearTimeout);
    timers.current = [];
    setDesc(d);
    setShowPreview(false);
    setPhase('loading');
    setItems([]);
    setRevealN(0);
    setExpandedId(null);
    setLoadingStep(0);
    if (!isAuto) bumpDemo();

    timers.current.push(setTimeout(() => setLoadingStep(1), 1800));
    timers.current.push(setTimeout(() => setLoadingStep(2), 4000));

    const aiResult = await fetchAiScope(d, trade);
    const result = aiResult || catalogFallback(d, trade);

    if (result.items.length >= 2) {
      // Sort: Labour first, then Services, then Materials
      const sorted = [...result.items].sort((a, b) => {
        const order = { Labour: 0, Services: 1, Materials: 2 };
        return (order[a.category] ?? 3) - (order[b.category] ?? 3);
      });

      setItems(sorted);

      // Only auto-select essential/standard items
      const autoSelected = new Set(sorted.filter(i => isEssential(i)).map(i => i.id));
      setSelected(autoSelected);

      setScopeNote(result.scopeNote);
      setAiSource(result.source);
      setPhase('results');

      setRevealN(0);
      sorted.forEach((_, idx) => {
        timers.current.push(setTimeout(() => {
          setRevealN(n => n + 1);
        }, 120 * (idx + 1)));
      });
    } else {
      setPhase('input');
    }
  }, [desc, trade]);

  function toggle(id) { setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

  function updateItem(id, field, value) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));
  }

  function reset() {
    timers.current.forEach(clearTimeout);
    setPhase('input'); setDesc(''); setItems([]); setRevealN(0);
    setShowPreview(false); setAiSource(''); setExpandedId(null);
  }

  function saveAndGo() {
    try {
      sessionStorage.setItem('pl_demo_quote', JSON.stringify({
        description: desc, trade,
        items: items.filter(i => selected.has(i.id)).map(i => ({
          name: i.name, unit_price: i.price, quantity: i.qty, category: i.category,
        })),
        total,
      }));
    } catch (e) { console.warn("[PL]", e); }
  }

  const visible = items.slice(0, revealN);
  const total = items.filter(i => selected.has(i.id)).reduce((s, i) => s + (i.price * i.qty), 0);
  const taxed = Math.round(total * 1.05);

  // 3-way grouping
  const labourVisible = visible.filter(i => i.category === 'Labour');
  const servicesVisible = visible.filter(i => i.category === 'Services');
  const matsVisible = visible.filter(i => i.category === 'Materials');

  const selCount = items.filter(i => selected.has(i.id)).length;
  const doneRevealing = revealN >= items.length && items.length > 0;

  function ItemRow({ item }) {
    const isOn = selected.has(item.id);
    const isExpanded = expandedId === item.id;
    const hasInfo = item.reason || item.when || item.skip || (item.lo > 0 && item.hi > item.lo);
    const isOptional = (item.tier || '').toLowerCase() === 'optional' || !isOn;

    return (
      <div className={`id-item ${isOn ? 'on' : 'off'} id-item-reveal`}>
        <div className="id-check-wrap" onClick={() => toggle(item.id)}>
          <div className={`id-check ${isOn ? 'on' : ''}`}>{isOn ? '✓' : ''}</div>
        </div>
        <div className="id-item-body">
          <div className="id-item-top-row">
            <span className="id-item-name" onClick={() => toggle(item.id)}>{item.name}</span>
            {hasInfo && (
              <button
                type="button"
                className={`id-info-btn ${isExpanded ? 'active' : ''}`}
                onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : item.id); }}
                title="More info"
              >?</button>
            )}
          </div>
          {item.reason && !isExpanded && <div className="id-item-reason">{item.reason}</div>}

          {isExpanded && (
            <div className="id-item-info">
              {item.reason && <div className="id-info-row"><span className="id-info-label">Why:</span> {item.reason}</div>}
              {item.when && <div className="id-info-row"><span className="id-info-label">Include when:</span> {item.when}</div>}
              {item.skip && <div className="id-info-row"><span className="id-info-label">Skip when:</span> {item.skip}</div>}
              {item.lo > 0 && item.hi > item.lo && (
                <div className="id-info-row"><span className="id-info-label">Typical range:</span> {currency(item.lo)} – {currency(item.hi)}</div>
              )}
            </div>
          )}
        </div>

        <div className="id-item-controls">
          <div className="id-item-qty-wrap">
            <input
              type="number"
              className="id-item-qty"
              value={item.qty}
              min={1}
              max={99}
              onClick={e => e.stopPropagation()}
              onChange={e => updateItem(item.id, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
          <div className="id-item-price-wrap">
            <span className="id-price-sign">$</span>
            <input
              type="number"
              className="id-item-price-input"
              value={item.price}
              min={0}
              step={5}
              onClick={e => e.stopPropagation()}
              onChange={e => updateItem(item.id, 'price', Math.max(0, parseInt(e.target.value) || 0))}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`id-root ${inline ? 'id-inline' : ''}`}>
      <div className="id-header">
        <div className="id-header-left">
          <span className="id-dot" />
          <span className="id-header-label">
            {phase === 'loading' ? 'Building scope…' : phase === 'results' ? 'Your quote' : 'Try it — free'}
          </span>
          {phase === 'results' && total > 0 && <span className="id-header-value">{currency(total)}</span>}
        </div>
        {phase === 'results' && <button className="id-reset" type="button" onClick={reset}>Try another job</button>}
      </div>

      <div className="id-trades">
        {TRADES.map(t => (
          <button key={t} type="button" className={`id-trade ${t === trade ? 'active' : ''}`}
            onClick={() => { setTrade(t); if (phase === 'input') setDesc(''); }}
          >{t}</button>
        ))}
      </div>

      {phase === 'input' && (
        <div className="id-input-section">
          <textarea className="id-textarea" value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="Describe the job the way you'd text it to your apprentice…" rows={3} />
          <div className="id-presets">
            <span className="id-presets-label">or try:</span>
            {presets.map(p => (
              <button key={p.label} type="button" className="id-preset id-preset-single"
                onClick={() => { setDesc(p.text); setTimeout(() => runDemo(p.text), 150); }}
              >{p.label} →</button>
            ))}
          </div>
          <button className={`id-build-btn ${desc.trim() ? 'ready' : ''}`} type="button"
            disabled={!desc.trim()} onClick={() => runDemo()}
          >Build scope — free, no signup</button>
        </div>
      )}

      {phase === 'loading' && (
        <div className="id-loading">
          <div className="id-loading-inner">
            <div className="id-loading-spinner" />
            <div className="id-loading-text">
              <div className="id-loading-title">Building your scope…</div>
              <div className="id-loading-sub">{desc.slice(0, 80)}{desc.length > 80 ? '…' : ''}</div>
            </div>
          </div>
          <div className="id-loading-steps">
            <div className={`id-loading-step ${loadingStep >= 0 ? 'active' : ''} ${loadingStep > 0 ? 'done' : ''}`}>Analyzing job description</div>
            <div className={`id-loading-step ${loadingStep >= 1 ? 'active' : ''} ${loadingStep > 1 ? 'done' : ''}`}>Matching trade-specific line items</div>
            <div className={`id-loading-step ${loadingStep >= 2 ? 'active' : ''}`}>Calculating market-rate pricing</div>
          </div>
        </div>
      )}

      {phase === 'results' && (
        <div className="id-results">
          <div className="id-scope-bar">
            <span className="id-scope-trade">{trade}</span>
            <span className="id-scope-note">{scopeNote}</span>
            {aiSource === 'ai' && <span className="id-ai-badge">Pre-filled</span>}
          </div>
          <div className="id-job-echo">{desc.slice(0, 100)}{desc.length > 100 ? '…' : ''}</div>

          <div className="id-col-headers">
            <span className="id-col-item">Item</span>
            <span className="id-col-qty">Qty</span>
            <span className="id-col-price">Price</span>
          </div>

          <div className="id-items">
            {labourVisible.length > 0 && (
              <div className="id-group"><div className="id-group-label">Labour</div>
                {labourVisible.map(it => <ItemRow key={it.id} item={it} />)}
              </div>
            )}
            {servicesVisible.length > 0 && (
              <div className="id-group"><div className="id-group-label">Services</div>
                {servicesVisible.map(it => <ItemRow key={it.id} item={it} />)}
              </div>
            )}
            {matsVisible.length > 0 && (
              <div className="id-group"><div className="id-group-label">Materials</div>
                {matsVisible.map(it => <ItemRow key={it.id} item={it} />)}
              </div>
            )}
          </div>

          {doneRevealing && total > 0 && (
            <button className="id-preview-toggle pl-toggle-row" type="button" onClick={() => setShowPreview(p => !p)} style={{ background:'none', border:'none', fontFamily:'inherit', width:'100%', fontSize: 'var(--text-sm)' }}>
              <span>{showPreview ? 'Hide customer view' : 'See what your customer sees'}</span>
              <span className={`pl-chevron ${showPreview ? 'pl-chevron--open' : ''}`} />
            </button>
          )}

          {showPreview && (
            <div className="id-customer-preview">
              <div className="id-cp-header"><div className="id-cp-biz">Your Business Name</div><div className="id-cp-badge">Quote</div></div>
              <div className="id-cp-items">
                {items.filter(i => selected.has(i.id)).slice(0, 6).map(i => (
                  <div key={i.id} className="id-cp-row">
                    <span>{i.name}{i.qty > 1 ? ` ×${i.qty}` : ''}</span>
                    <span>{currency(i.price * i.qty)}</span>
                  </div>
                ))}
              </div>
              <div className="id-cp-total"><span>Total</span><span>{currency(taxed)}</span></div>
              {taxed >= 500 && <div className="id-cp-monthly">or {currency(Math.ceil(taxed / 12))}/mo for 12 months</div>}
              <div className="id-cp-actions">
                <div className="id-cp-approve">✓ Approve & Sign</div>
                <div className="id-cp-ask">Ask a Question</div>
              </div>
              <div className="id-cp-note">Your customer reviews, approves, and pays — all from their phone.</div>
            </div>
          )}

          <div className="id-footer">
            <div className="id-total-section">
              <div className="id-total-row">
                <span>{selCount} item{selCount !== 1 ? 's' : ''}</span>
                <span className="id-total-sub">{currency(total)}</span>
              </div>
              <div className="id-total-row id-total-grand">
                <span>Quote total</span>
                <span>{currency(taxed)}</span>
              </div>
            </div>
            <Link className="id-send-btn" to="/signup" onClick={saveAndGo}>
              Send this quote →
            </Link>
            <div className="id-below-cta">
              <span className="id-send-note">Free account · no credit card · 30 seconds</span>
              <button className="id-try-own" type="button" onClick={reset}>try another job</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
