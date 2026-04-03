import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/app-shell';
import { requestAiScope, getWonQuoteContext, getProfile, getQuote, updateQuote } from '../lib/api';
import { useAuth } from '../hooks/use-auth';
import { useUnsavedChanges } from '../hooks/use-unsaved-changes';
import { currency } from '../lib/format';
import { useToast } from '../components/toast';
import { makeId } from '../lib/utils';
import { searchCatalog, browseCatalog } from '../../shared/systemCatalog';
import { regionalize, normalizeTrade } from '../../shared/tradeBrain';
import { getSmartSuggestions, smartSearch } from '../../shared/smartCatalog';
import { extractJobContext } from '../../shared/jobContext';
import { detectJob, runScopeCheck } from '../../shared/checkScope';

// ── Scope cache helpers (sessionStorage, per-quoteId, 2-hour TTL) ──
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function scopeCacheKey(quoteId) {
  return `pl_scope_cache_${quoteId}`;
}

function readScopeCache(quoteId) {
  try {
    const raw = sessionStorage.getItem(scopeCacheKey(quoteId));
    if (!raw) return null;
    const cache = JSON.parse(raw);
    if (!cache?.cachedAt) return null;
    const age = Date.now() - new Date(cache.cachedAt).getTime();
    if (age > CACHE_TTL_MS) {
      sessionStorage.removeItem(scopeCacheKey(quoteId));
      return null;
    }
    return cache;
  } catch {
    return null;
  }
}

function writeScopeCache(quoteId, payload) {
  try {
    sessionStorage.setItem(scopeCacheKey(quoteId), JSON.stringify({
      ...payload,
      cachedAt: new Date().toISOString(),
    }));
  } catch {
    // sessionStorage full or unavailable — fail silently
  }
}

function clearScopeCache(quoteId) {
  try { sessionStorage.removeItem(scopeCacheKey(quoteId)); } catch {}
}

// ── Smart catalog fallback: uses job context engine for relevant results ──
// Returns { core[], related[], optional[], reason, context } instead of flat list
function smartCatalogFallback(ctx, province) {
  const result = getSmartSuggestions({
    description: ctx.description || '',
    title: ctx.title || '',
    trade: ctx.trade || 'Other',
    province: province || 'AB',
  });

  // ── Auto-inject "Dispatch / diagnostic" as a related service item ──
  // Real contractor data shows this appears in nearly every quoted job ($90-$150).
  // The systemCatalog doesn't carry it, so we inject it here.
  // Placed in related (not core) so it appears as "often needed" without inflating core total.
  const hasDispatch = [...result.core, ...result.related].some(
    i => /dispatch|diagnostic|service call/i.test(i.name)
  );
  if (!hasDispatch && result.core.length > 0) {
    const dispatchPrices = {
      Plumber: { lo: 90, hi: 120, mid: 105 },
      Electrician: { lo: 90, hi: 110, mid: 100 },
      HVAC: { lo: 120, hi: 150, mid: 135 },
      'General Contractor': { lo: 60, hi: 80, mid: 70 },
    };
    const dp = dispatchPrices[ctx.trade] || { lo: 90, hi: 130, mid: 110 };
    result.related.unshift({
      id: `disp_${Date.now()}`, name: 'Dispatch / diagnostic', desc: 'Service call, travel, initial assessment',
      category: 'Services', lo: dp.lo, hi: dp.hi, mid: dp.mid,
      score: 999, tier: 'related', reason: 'Standard on every job',
      why: 'Covers travel, site assessment, and initial diagnosis',
      pricing_basis: 'Market rate from contractor data',
    });
  }

  return result;
}

// ── Classification ──
const LABOUR_KW = ['labour','labor','install','replace','remove','repair','upgrade','finish','maintenance','swap','hook','connect','disconnect','mount','demolish','frame','drywall','patch','diagnostic','service call','setup','startup','commission','calibrat','test','inspect'];
const MATERIAL_KW = ['material','supply','supplies','part','parts','fitting','fittings','allowance','hose','connector','adapter','valve','ring','bolt','wire','cable','pipe','duct','filter','sealant','caulk','primer','paint','shingle','lumber','screw','nail','bracket','flashing','wax ring','tape','panel','breaker','conduit','switch','outlet','fixture','fan','light','thermostat','pump','tank','heater','coil','compressor','lineset','meter','fastener','hardware','equipment','unit','device'];
const SERVICE_KW = ['permit','inspection','disposal','cleanup','haul','delivery','coordination','scheduling','warranty','protection','certification','compliance','removal','commissioning','testing','patching','grounding','bonding'];

function classifyItem(name, category) {
  const cat = (category || '').toLowerCase();
  if (cat === 'labour' || cat === 'labor') return 'labour';
  if (cat === 'materials' || cat === 'material') return 'materials';
  if (cat === 'services' || cat === 'service' || cat === 'permit' || cat === 'disposal') return 'services';
  const text = `${name || ''} ${category || ''}`.toLowerCase();
  if (SERVICE_KW.some(w => text.includes(w))) return 'services';
  if (MATERIAL_KW.some(w => text.includes(w))) return 'materials';
  if (LABOUR_KW.some(w => text.includes(w))) return 'labour';
  if (/^(install|replace|remove|repair|upgrade|connect|mount|build|frame|patch|prep)/i.test(name || '')) return 'labour';
  return 'services';
}

function normSuggestion(raw, i) {
  const lo = Number(raw.lo || raw.typical_range_low || 0);
  const hi = Number(raw.hi || raw.typical_range_high || 0);
  // Server already normalizes to 55th percentile — trust it
  const mid = Number(raw.unit_price || raw.mid || Math.round((lo + hi) / 2) || 0);
  const name = raw.description || raw.name || 'Item';
  const cat = raw.category || '';
  const confidence = (raw.include_confidence || 'high').toLowerCase();
  const tier = (raw.tier || 'standard').toLowerCase();
  return {
    id: `sug_${i}_${Date.now()}`, name, category: cat, tab: classifyItem(name, cat),
    unit_price: mid, quantity: Math.max(1, Number(raw.quantity || 1)),
    typical_low: lo, typical_high: hi,
    why: raw.why || raw.reason || '', when_needed: raw.when || '', when_not_needed: raw.skip || '',
    notes: raw.pricing_basis || '', confidence, tier,
    source: raw.source_label || 'AI estimate',
    // Smart selection: high-confidence standard items = selected
    // medium = selected only if standard tier
    // low or optional tier = not selected
    selected: tier === 'optional' ? false : confidence !== 'low',
  };
}

function ItemCard({ item, selected, onToggle, onExpand, expanded }) {
  const lineTotal = (item.unit_price || 0) * (item.quantity || 1);
  const showQty = item.quantity > 1;
  return (
    <div className={`bs-item ${selected ? 'selected' : ''} ${item.isUpgrade ? 'bs-item-upgrade' : ''} ${item.tier === 'optional' ? 'bs-item-optional' : ''}`} data-scope-item onClick={onToggle}>
      <input type="checkbox" className="bs-check" checked={selected} readOnly tabIndex={-1} aria-hidden="true" style={{ position:'absolute', opacity:0, pointerEvents:'none' }} />
      <div className="bs-item-check">{selected ? '✓' : ''}</div>
      <div className="bs-item-body">
        <div className="bs-item-top">
          <span className="bs-item-name">{item.name}{showQty ? ` ×${item.quantity}` : ''}</span>
          <span className="bs-item-price">
            {item.typical_low > 0 && item.typical_high > item.typical_low
              ? `${currency(item.typical_low)}–${currency(item.typical_high)}`
              : currency(lineTotal)}
          </span>
        </div>
        {item.why && <div className="bs-item-why">{item.why}</div>}
        {item.confidence && item.confidence !== 'high' && (
          <div className={`bs-item-confidence bs-conf-${item.confidence}`}>
            {item.confidence === 'medium' ? 'Recommended' : 'Optional'}
          </div>
        )}
        {expanded && (
          <div className="bs-item-detail">
            {item.when_needed && <div className="bs-detail-row"><span className="bs-detail-label">Include when:</span> {item.when_needed}</div>}
            {item.when_not_needed && <div className="bs-detail-row"><span className="bs-detail-label">Skip when:</span> {item.when_not_needed}</div>}
            {item.notes && <div className="bs-detail-row"><span className="bs-detail-label">Pricing basis:</span> {item.notes}</div>}
            {(item.typical_low > 0 || item.typical_high > 0) && (
              <div className="bs-detail-row"><span className="bs-detail-label">Typical range:</span> {currency(item.typical_low)} – {currency(item.typical_high)}</div>
            )}
            {showQty && <div className="bs-detail-row"><span className="bs-detail-label">Unit price:</span> {currency(item.unit_price)} × {item.quantity} = {currency(lineTotal)}</div>}
          </div>
        )}
        <button type="button" className="bs-item-expand" onClick={e => { e.stopPropagation(); onExpand(); }}>
          {expanded ? 'Less' : 'Details'}
        </button>
      </div>
    </div>
  );
}

export default function BuildScopePage() {
  const { user } = useAuth();
  const { quoteId } = useParams();
  const nav = useNavigate();
  const { show: toast } = useToast();

  const [jobCtx, setJobCtx] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('Analyzing job scope…');
  const [expandedId, setExpandedId] = useState(null);
  const [scopeGaps, setScopeGaps] = useState([]);
  const [insights, setInsights] = useState([]);
  const [aiError, setAiError] = useState(false);
  const [scopeMeta, setScopeMeta] = useState({ scope_summary: '', assumptions: '', exclusions: '' });

  // Manual item entry
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [scopeDirty, setScopeDirty] = useState(false);

  // Guard unsaved selections — warn before navigating away
  useUnsavedChanges(scopeDirty);

  // Catalog search/fallback state — 1E
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogResults, setCatalogResults] = useState([]);
  const catalogDebounceRef = useRef(null);
  const [showCatalogSearch, setShowCatalogSearch] = useState(false);
  const [catalogFallback, setCatalogFallback] = useState(null);

  useEffect(() => {
    if (!quoteId) { nav('/app/quotes/new'); return; }
    getQuote(quoteId).then(quote => {
      const ctx = {
        trade: quote.trade || 'Other',
        province: quote.province || 'AB',
        country: quote.country || 'CA',
        title: quote.title || '',
        description: quote.description || '',
        customerId: quote.customer_id || '',
        photo: null, // populated below if photo_url is set on the quote record
        photoUrl: quote.photo_url || null,
      };
      setJobCtx(ctx);

      const lineItemsPopulated = Array.isArray(quote.line_items) && quote.line_items.length > 0;
      const cache = readScopeCache(quoteId);

      if (cache && lineItemsPopulated) {
        // Scope already committed to the quote — cache is stale, clean up and reload fresh
        clearScopeCache(quoteId);
        fetchScope(ctx);
      } else if (cache) {
        // Valid cache, line_items are empty — restore without calling AI
        setSuggestions(cache.suggestions || []);
        setScopeMeta(cache.scopeMeta || { scope_summary: '', assumptions: '', exclusions: '' });
        setCatalogFallback(cache.catalogFallback || null);
        setLoading(false);
        toast('Restored your previous scope — pick up where you left off.', 'info');
      } else {
        fetchScope(ctx);
      }
    }).catch(e => {
      console.error('[Punchlist] Failed to load draft:', e);
      toast('Quote not found or was deleted', 'error');
      nav('/app/quotes/new');
    });
  }, [quoteId]);

  async function fetchScope(ctx) {
    setLoading(true);
    setAiError(false);
    setLoadingMsg('Analyzing job scope…');
    const msgTimer = setTimeout(() => setLoadingMsg('Still working — analyzing materials and pricing…'), 6000);
    const msgTimer2 = setTimeout(() => setLoadingMsg('Almost there — finalizing suggestions…'), 12000);
    const msgTimer3 = setTimeout(() => setLoadingMsg('Taking a bit longer than usual — complex jobs need extra time…'), 18000);

    try {
      // Fetch contractor's profile (for labour rate) and won quotes (for AI context)
      let wonContext = [];
      let labourRate = 0;
      try {
        const [wc, profile] = await Promise.all([
          getWonQuoteContext(null, 5),
          user ? getProfile(user.id) : null,
        ]);
        wonContext = wc || [];
        labourRate = Number(profile?.default_labour_rate || 0);
      } catch {}

      // Resolve photo URL to base64 for AI vision (Supabase Storage public URL → base64)
      // The AI endpoint expects raw base64; we fetch the image client-side to avoid
      // adding server-side URL-fetch complexity to ai-scope.js.
      let photoBase64 = ctx.photo || null; // may already be set (cache restore path)
      if (!photoBase64 && ctx.photoUrl) {
        try {
          const imgResp = await fetch(ctx.photoUrl);
          if (imgResp.ok) {
            const blob = await imgResp.blob();
            photoBase64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result.split(',')[1]);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          }
        } catch (photoFetchErr) {
          // Non-fatal: log and proceed without photo — AI falls back to Haiku
          console.warn('[Punchlist] Could not fetch photo for AI scope:', photoFetchErr.message);
          photoBase64 = null;
        }
      }

      const r = await requestAiScope({
        description: ctx.description,
        trade: ctx.trade,
        estimatorRoute: 'balanced',
        province: ctx.province,
        country: ctx.country || 'CA',
        photo: photoBase64 || null,
        wonQuotes: wonContext,
        labourRate,
      });

      let items = (r.items || r.line_items || []).map((it, i) => normSuggestion(it, i));

      // Sort items: Labour first, then Services, then Materials
      const sortOrder = { labour: 0, services: 1, materials: 2 };
      items.sort((a, b) => (sortOrder[a.tab] ?? 3) - (sortOrder[b.tab] ?? 3));

      // Add optional upgrades from AI as unselected items
      const upgrades = (r.optional_upgrades || []).map((u, i) => ({
        id: `upg_${i}_${Date.now()}`, name: u.description || '', category: u.category || 'Services',
        tab: classifyItem(u.description || '', u.category || ''),
        unit_price: Number(u.unit_price || 0), typical_low: 0, typical_high: 0,
        why: u.why || '', when_needed: '', when_not_needed: '', notes: '',
        confidence: 'medium', source: 'Recommended upgrade', selected: false, isUpgrade: true,
      }));

      setSuggestions([...items, ...upgrades]);
      setScopeGaps(r.gaps || []);
      setInsights(r.insights || []);

      // Store scope metadata in state for use in handleAddToQuote
      const nextScopeMeta = {
        scope_summary: r.scope_summary || '', assumptions: (r.assumptions || []).join('\n'),
        exclusions: (r.exclusions || []).join('\n'), trade: r.trade || ctx.trade,
      };
      setScopeMeta(nextScopeMeta);

      // 1E: Auto-populate catalog fallback when AI returns fewer than 3 items
      // (computed early so we can write the cache in one place below)
      const nextCatalogFallback = (() => {
        if (items.length < 3) {
          const result = smartCatalogFallback(ctx, ctx.province || 'AB');
          return result.totalCount > 0 ? result : null;
        }
        return null;
      })();

      // Persist suggestions to sessionStorage so a back-navigation doesn't lose them
      writeScopeCache(quoteId, {
        suggestions: [...items, ...upgrades],
        scopeMeta: nextScopeMeta,
        catalogFallback: nextCatalogFallback,
      });

      if (items.length < 2) {
        toast('AI returned fewer items than expected. Add details or add items manually below.', 'info');
      }

      setCatalogFallback(nextCatalogFallback);
    } catch (e) {
      console.error('[Punchlist] AI scope failed:', e.message);
      setAiError(true);
      const isTimeout = e.message?.includes('timed out') || e.message?.includes('timeout') || e.message?.includes('Failed to fetch');
      toast(
        isTimeout
          ? 'AI timed out — showing relevant items from catalog. You can retry or add items manually.'
          : 'AI unavailable — showing relevant items from catalog.',
        'error'
      );
      const province = ctx.province || 'AB';
      const result = smartCatalogFallback(ctx, province);
      setCatalogFallback(result.totalCount > 0 ? result : null);

      // ── Run checkScope on catalog fallback items to produce gaps/insights ──
      if (result.totalCount > 0) {
        const fallbackItems = [...result.core, ...result.related].map(i => ({ name: i.name }));
        const jobCode = detectJob(ctx.trade, ctx.description, fallbackItems);
        if (jobCode) {
          const check = runScopeCheck(ctx.trade, jobCode, ctx.description, fallbackItems);
          if (check) {
            const gaps = check.sections
              .filter(s => s.type === 'likely_missing' || s.type === 'often_included')
              .flatMap(s => s.items.map(i => `${i.name} — ${i.reason}`));
            const tips = check.sections
              .filter(s => s.type === 'confirm')
              .flatMap(s => s.items.map(i => `Verify: ${i.name}`));
            if (gaps.length) setScopeGaps(gaps.slice(0, 4));
            if (tips.length) setInsights(tips.slice(0, 3));
          }
        }
      }
    }
    finally { setLoading(false); clearTimeout(msgTimer); clearTimeout(msgTimer2); clearTimeout(msgTimer3); }
  }

  function toggleItem(id) { setScopeDirty(true); setSuggestions(p => p.map(s => s.id === id ? { ...s, selected: !s.selected } : s)); }

  function addManualItem() {
    const name = manualName.trim();
    if (!name) return;
    const exists = suggestions.some(s => s.name.toLowerCase() === name.toLowerCase());
    if (exists) { toast('Already added', 'info'); return; }
    setScopeDirty(true);
    setSuggestions(p => [...p, {
      id: `man_${makeId()}`, name, category: '', tab: classifyItem(name, ''),
      unit_price: Number(manualPrice) || 0, typical_low: 0, typical_high: 0,
      why: '', when_needed: '', when_not_needed: '', notes: '',
      confidence: 'high', source: 'Custom', selected: true,
    }]);
    toast(`Added: ${name}`, 'success');
    setManualName(''); setManualPrice('');
  }

  const selectedCount = suggestions.filter(s => s.selected).length;
  const estimatedTotal = suggestions.filter(s => s.selected).reduce((sum, s) => sum + ((s.unit_price || 0) * (s.quantity || 1)), 0);

  async function handleAddToQuote() {
    const selected = suggestions.filter(s => s.selected);
    if (!selected.length) return toast('Select at least one item', 'error');
    try {
      // Convert selected suggestions to line_items format
      const lineItems = selected.map((s, i) => ({
        name: s.name,
        quantity: s.quantity || 1,
        unit_price: s.unit_price || 0,
        notes: '',
        category: s.category || '',
        included: true,
        sort_order: i,
      }));
      // Update the draft quote with scope metadata + line items
      await updateQuote(quoteId, {
        scope_summary: scopeMeta.scope_summary,
        assumptions: scopeMeta.assumptions,
        exclusions: scopeMeta.exclusions,
        line_items: lineItems,
      });
      // Clean up scope cache (scope is now committed to the quote)
      clearScopeCache(quoteId);
      setScopeDirty(false);
      nav(`/app/quotes/review/${quoteId}`);
    } catch (e) {
      console.error('[Punchlist] Failed to save scope:', e);
      toast('Failed to save items. Please try again.', 'error');
    }
  }

  function handleRetryAI() {
    if (jobCtx) {
      clearScopeCache(quoteId); // Force fresh AI fetch — ignore any cached suggestions
      fetchScope(jobCtx);
    }
  }

  // ── Render suggested items grouped by category ──
  function renderSuggested() {
    const groups = [{ key: 'labour', label: 'Labour' }, { key: 'materials', label: 'Materials' }, { key: 'services', label: 'Services' }];
    const upgrades = suggestions.filter(s => s.isUpgrade);

    return (
      <div className="bs-suggested">
        {groups.map(g => {
          const items = suggestions.filter(s => s.tab === g.key && !s.isUpgrade);
          if (items.length === 0) return null;
          const selInGroup = items.filter(s => s.selected).length;
          return (
            <div key={g.key} className="bs-group bs-scope-group">
              <div className="bs-group-label">{g.label}{selInGroup > 0 ? ` (${selInGroup} selected)` : ''}</div>
              <div className="bs-items">{items.map(item => (
                <ItemCard key={item.id} item={item} selected={item.selected} onToggle={() => toggleItem(item.id)}
                  expanded={expandedId === item.id} onExpand={() => setExpandedId(expandedId === item.id ? null : item.id)} />
              ))}</div>
            </div>
          );
        })}

        {/* ── Optional Upgrades ── */}
        {upgrades.length > 0 && (
          <div className="bs-group bs-upgrades">
            <div className="bs-group-label">Optional Upgrades</div>
            <div className="bs-items">{upgrades.map(item => (
              <ItemCard key={item.id} item={item} selected={item.selected} onToggle={() => toggleItem(item.id)}
                expanded={expandedId === item.id} onExpand={() => setExpandedId(expandedId === item.id ? null : item.id)} />
            ))}</div>
          </div>
        )}

        {/* ── Check Scope: gaps + insights ── */}
        {(scopeGaps.length > 0 || insights.length > 0) && (
          <div className="bs-check-scope">
            <div className="bs-check-title">Check before sending</div>
            {scopeGaps.length > 0 && (
              <div className="bs-check-group">
                {scopeGaps.map((gap, i) => (
                  <div key={i} className="bs-check-item bs-check-gap">
                    <span className="bs-check-icon">⚠</span>
                    <span>{gap}</span>
                  </div>
                ))}
              </div>
            )}
            {insights.length > 0 && (
              <div className="bs-check-group">
                {insights.map((tip, i) => (
                  <div key={i} className="bs-check-item bs-check-tip">
                    <span className="bs-check-icon">💡</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Empty state when AI failed or returned nothing ──
  function renderEmptyState() {
    return (
      <div className="bs-empty-state">
        <div className="bs-empty-icon">{aiError ? '⚡' : '📋'}</div>
        <h3>{aiError ? 'AI timed out' : 'No items yet'}</h3>
        <p className="muted">
          {aiError 
            ? 'This happens sometimes on complex jobs. Try again or use the catalog suggestions below.'
            : 'Add line items manually to build your quote.'}
        </p>
        {aiError && (
          <button className="btn btn-primary btn-sm" type="button" onClick={handleRetryAI} style={{ marginTop: 12 }}>
            ↻ Retry AI scope
          </button>
        )}
      </div>
    );
  }

  return (
    <AppShell title="Build Quote" subtitle="Step 2 of 3">
      <div className="bs-page">
        <div className="bs-header">
          <a href={`/app/quotes/${quoteId}/job-details`} className="bs-back" onClick={e => { e.preventDefault(); nav(`/app/quotes/${quoteId}/job-details`); }}>← Edit job details</a>
          {jobCtx && <div className="bs-job-ctx">{jobCtx.trade} · {jobCtx.title || jobCtx.description?.slice(0, 50)}</div>}
        </div>

        {loading ? (
          <div className="bs-loading">
            <div className="loading-spinner" />
            <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>{loadingMsg}</div>
            {/* Skeleton placeholders */}
            <div className="bs-skeleton-list">
              {[1,2,3,4].map(i => (
                <div key={i} className="bs-skeleton-item" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="bs-skeleton-check" />
                  <div className="bs-skeleton-text">
                    <div className="bs-skeleton-bar" style={{ width: `${60 + Math.random() * 30}%` }} />
                    <div className="bs-skeleton-bar short" style={{ width: `${30 + Math.random() * 20}%` }} />
                  </div>
                  <div className="bs-skeleton-bar price" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* AI-generated suggestions */}
            {suggestions.filter(s => !s.isUpgrade).length > 0 
              ? renderSuggested() 
              : (catalogFallback && catalogFallback.totalCount > 0 
                ? null  /* Skip empty state — catalog suggestions render below */
                : renderEmptyState())
            }

            {/* ── Smart Catalog Fallback — tiered suggestions ── */}
            {catalogFallback && catalogFallback.totalCount > 0 && (() => {
              const { core, related, optional, reason } = catalogFallback;

              function renderTierItems(items, tierLabel) {
                if (!items || items.length === 0) return null;
                return (
                  <div className="bs-smart-tier">
                    <div className="bs-smart-tier-label">{tierLabel}</div>
                    <div className="bs-catalog-fallback-grid">
                      {items.map((item, i) => {
                        const alreadyAdded = suggestions.some(s => s.name.toLowerCase() === item.name.toLowerCase());
                        return (
                          <div
                            key={`${item.name}-${i}`}
                            className={`bs-catalog-fallback-item ${alreadyAdded ? 'added' : ''}`}
                            onClick={() => {
                              if (alreadyAdded) return;
                              const lo = item.lo || 0;
                              const hi = item.hi || 0;
                              const price = (hi > lo) ? Math.round(lo + (hi - lo) * 0.55) : (item.mid || 0);
                              setSuggestions(p => [...p, {
                                id: `cf_${makeId()}`, name: item.name, category: item.category,
                                tab: classifyItem(item.name, item.category),
                                unit_price: price, quantity: 1, typical_low: lo, typical_high: hi,
                                why: item.desc || item.reason || '', when_needed: '', when_not_needed: '', notes: '',
                                confidence: 'medium', source: 'Catalog', selected: true, tier: 'standard',
                              }]);
                              toast(`Added: ${item.name}`, 'success');
                            }}
                          >
                            <div className="bs-cf-name">{item.name}</div>
                            {item.reason && <div className="bs-cf-reason">{item.reason}</div>}
                            <div className="bs-cf-price">
                              {item.lo > 0 ? `${currency(item.lo)}–${currency(item.hi)}` : currency(item.mid)}
                            </div>
                            <div className="bs-cf-add">{alreadyAdded ? '✓' : '+'}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              return (
                <div className="bs-catalog-fallback bs-catalog-section">
                  <div className="bs-catalog-fallback-header bs-fallback-msg">
                    <span className="bs-group-label">Relevant items for this job</span>
                    <span className="bs-catalog-fallback-hint">{reason}</span>
                  </div>
                  {renderTierItems(core, 'Core items')}
                  {renderTierItems(related, 'Related items')}
                  {renderTierItems(optional, 'Optional add-ons')}
                </div>
              );
            })()}

            {/* ── Add items manually ── */}
            <div className="bs-section-divider">
              <span className="bs-group-label">Add items</span>
              <button
                type="button"
                className="bs-catalog-search-toggle"
                onClick={() => { setShowCatalogSearch(s => !s); setCatalogQuery(''); setCatalogResults([]); }}
              >
                {showCatalogSearch ? '✕ Close' : '🔍 Search catalog'}
              </button>
            </div>

            {/* ── Catalog search dropdown — 1E ── */}
            {showCatalogSearch && (
              <div className="bs-catalog-search-box">
                <input
                  className="jd-input"
                  value={catalogQuery}
                  onChange={e => {
                    const q = e.target.value;
                    setCatalogQuery(q);
                    // Clear immediately on empty — no debounce needed
                    if (q.length < 2) { setCatalogResults([]); clearTimeout(catalogDebounceRef.current); return; }
                    clearTimeout(catalogDebounceRef.current);
                    catalogDebounceRef.current = setTimeout(() => {
                      const prov = jobCtx?.province || 'AB';
                      // Use smartSearch with job context for context-boosted results
                      const ctx = extractJobContext(
                        [jobCtx?.title, jobCtx?.description].filter(Boolean).join('. '),
                        jobCtx?.trade || 'Other'
                      );
                      const hits = smartSearch(q, ctx, prov, 20).map(hit => ({
                        id: `cs_${makeId()}`, name: hit.name, desc: hit.desc || '',
                        category: hit.category || '',
                        lo: hit.lo || 0, hi: hit.hi || 0,
                        mid: hit.mid || 0,
                        isContextRelevant: hit.isContextRelevant,
                      }));
                      setCatalogResults(hits);
                    }, 200);
                  }}
                  placeholder="Search catalog (e.g. faucet, panel, drywall)…"
                  autoFocus
                  autoComplete="off"
                />
                {catalogResults.length > 0 && (
                  <div className="bs-catalog-search-results">
                    {catalogResults.map((item, i) => {
                      const alreadyAdded = suggestions.some(s => s.name.toLowerCase() === item.name.toLowerCase());
                      return (
                        <div
                          key={`${item.name}-${i}`}
                          className={`rq-catalog-item ${alreadyAdded ? 'added' : ''} ${item.isContextRelevant ? 'rq-catalog-relevant' : ''}`}
                          onClick={() => {
                            if (alreadyAdded) return;
                            const lo = item.lo || 0;
                            const hi = item.hi || 0;
                            const price = (hi > lo) ? Math.round(lo + (hi - lo) * 0.55) : (item.mid || 0);
                            setSuggestions(p => [...p, {
                              id: `cs_${makeId()}`, name: item.name, category: item.category,
                              tab: classifyItem(item.name, item.category),
                              unit_price: price, quantity: 1, typical_low: lo, typical_high: hi,
                              why: item.desc || '', when_needed: '', when_not_needed: '', notes: '',
                              confidence: 'medium', source: 'Catalog', selected: true, tier: 'standard',
                            }]);
                            toast(`Added: ${item.name}`, 'success');
                          }}
                        >
                          <div className="rq-catalog-info">
                            <span className="rq-catalog-name">{item.name}</span>
                            {item.isContextRelevant && <span className="rq-catalog-match-tag">matches this job</span>}
                            {item.desc && <span className="rq-catalog-desc">{item.desc}</span>}
                            <span className="rq-catalog-price">
                              {item.lo > 0 ? `${currency(item.lo)}–${currency(item.hi)}` : currency(item.mid)}
                            </span>
                          </div>
                          <span className="rq-catalog-add">{alreadyAdded ? '✓' : '+'}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {catalogQuery.length >= 2 && catalogResults.length === 0 && (
                  <div className="rq-catalog-empty">No matches. Try different terms or add manually below.</div>
                )}
              </div>
            )}

            <div className="bs-manual-add">
              <input 
                className="jd-input" 
                value={manualName} 
                onChange={e => setManualName(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && addManualItem()}
                placeholder="Item name (e.g. Install kitchen faucet)" 
                style={{ flex: 1 }} 
              />
              <input 
                className="jd-input" 
                type="number" 
                min="0" 
                value={manualPrice} 
                onChange={e => setManualPrice(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && addManualItem()}
                placeholder="$" 
                style={{ width: 80 }} 
              />
              <button className="btn btn-secondary" type="button" disabled={!manualName.trim()} onClick={addManualItem}>
                + Add
              </button>
            </div>
            <p className="bs-manual-hint muted small">
              You can adjust quantities and prices on the next step.
            </p>

            {/* ── Bottom navigation — sticky on mobile ── */}
            <div className="bs-step-nav bs-step-nav-sticky">
              <div className="bs-step-hint">
                {selectedCount > 0
                  ? `${selectedCount} item${selectedCount !== 1 ? 's' : ''} · ~${currency(estimatedTotal)}`
                  : 'Select items to build your quote'}
              </div>
              <button className="btn btn-primary btn-lg" type="button" data-testid="bs-continue-btn" onClick={handleAddToQuote} disabled={selectedCount === 0}>
                Continue to Review →
              </button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
