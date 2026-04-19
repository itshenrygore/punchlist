import { useMemo, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Card } from '../../components/ui';
import { useQuoteBuilder } from './quote-builder-context';
import { actions } from './use-quote-draft';
import { currency } from '../../lib/format';
import { makeId } from '../../lib/utils';
import { estimateMonthly, showFinancing } from '../../lib/financing';
import { normalizeTrade } from '../../../shared/tradeBrain';
import { browseCatalog } from '../../../shared/systemCatalog';
import { smartSearch } from '../../../shared/smartCatalog';
import { extractJobContext } from '../../../shared/jobContext';
import { regionalize, anchorPrice } from '../../../shared/tradeBrain';
import { CA_PROVINCES, US_STATES } from '../../lib/pricing';
import { SCOPE_HINTS } from './builder-utils';
import LineItemList from './line-item-list';
import CustomerPicker from './customer-picker';
import QuoteSummary from './quote-summary';
import SendDrawer from './send-drawer';

/* ═══════════════════════════════════════════════════════════
 ReviewPhase — The main editing surface.

 Phase 1 changes vs. original:
 • "How this helps you close" checklist → removed
 • Tracking teaser → removed (moved to SentPhase)
 • "What your customer sees" label → removed (redundant)
 • Scope details moved behind "Adjust details" drawer
 • Sub-components: LineItemList, CustomerPicker, QuoteSummary
 ═══════════════════════════════════════════════════════════ */

export default function ReviewPhase() {
 const { state, dispatch, ud, derived, handlers } = useQuoteBuilder();
 const {
 draft, description, title, trade, province, country,
 lineItems, isLocked, error, saving, sending, saveState,
 lastSavedAt, showDetails, addMode, catalogQuery, catalogResults,
 scopeHints: _, scopeError, suggestions, dismissedSugIds,
 inlinePhone, deliveryMethod,
 } = state;
 const {
 grandTotal, selCustomer, itemCount, totals,
 } = derived;

 const catalogDebounceRef = useRef(null);

 // ── Scope hints ──
 const scopeHints = useMemo(() => {
 const hints = SCOPE_HINTS[normalizeTrade(trade)] || SCOPE_HINTS.General || [];
 const names = new Set(lineItems.map(i => (i.name || '').toLowerCase()));
 return hints.filter(h =>
 !names.has(h.toLowerCase()) &&
 !lineItems.some(i => (i.name || '').toLowerCase().includes(h.toLowerCase()))
 );
 }, [trade, lineItems]);

 // ── Visible suggestions (not selected, not dismissed, not already in items) ──
 const visibleSuggestions = useMemo(() => {
 if (!suggestions || suggestions.length === 0) return [];
 const namesInUse = new Set(
 lineItems.map(li => (li.name || '').toLowerCase().trim()).filter(Boolean)
 );
 return suggestions.filter(s => {
 if (dismissedSugIds.has(s.id)) return false;
 if (s.selected) return false;
 const nm = (s.name || '').toLowerCase().trim();
 if (!nm) return false;
 if (namesInUse.has(nm)) return false;
 return true;
 });
 }, [suggestions, lineItems, dismissedSugIds]);

 // ── Catalog search ──
 useEffect(() => {
 if (addMode !== 'catalog') {
 dispatch(actions.setCatalogResults([]));
 return;
 }
 if (!catalogQuery || catalogQuery.length < 2) {
 clearTimeout(catalogDebounceRef.current);
 dispatch(actions.setCatalogResults(
 browseCatalog(trade, 30).map(hit => {
 const adj = regionalize(hit, province);
 const a = anchorPrice(adj.lo || hit.lo, adj.hi || hit.hi, normalizeTrade(trade), hit.c);
 return { id: `cat_${makeId()}`, name: hit.n, desc: hit.d || '', category: hit.c || '', lo: a.lo, hi: a.hi, mid: a.mid };
 })
 ));
 return;
 }
 clearTimeout(catalogDebounceRef.current);
 catalogDebounceRef.current = setTimeout(() => {
 const ctx = extractJobContext([draft.title, description].filter(Boolean).join('. '), trade);
 const hits = smartSearch(catalogQuery, ctx, province, 20).map(hit => ({
 id: `cs_${makeId()}`,
 name: hit.name, desc: hit.desc || '', category: hit.category || '',
 lo: hit.lo || 0, hi: hit.hi || 0, mid: hit.mid || 0,
 isContextRelevant: hit.isContextRelevant,
 }));
 dispatch(actions.setCatalogResults(hits));
 }, 200);
 }, [catalogQuery, addMode, trade, province]);

 function addCatalogItem(item) {
 if (lineItems.some(li => li.name.toLowerCase() === item.name.toLowerCase())) return;
 const lo = item.lo || 0, hi = item.hi || 0;
 const price = hi > lo ? Math.round(lo + (hi - lo) * 0.55) : (item.mid || 0);
 dispatch(actions.addItem({
 id: makeId(), name: item.name, quantity: 1, unit_price: price,
 notes: '', category: item.category || '', included: true,
 }));
 handlers.toast(`Added: ${item.name}`, 'success');
 }

 function addSuggestionToItems(sug) {
 const exists = lineItems.some(
 li => (li.name || '').toLowerCase().trim() === (sug.name || '').toLowerCase().trim()
 );
 if (exists) {
 dispatch(actions.dismissSuggestion(sug.id));
 return;
 }
 dispatch(actions.addItem({
 id: makeId(), name: sug.name, quantity: Number(sug.quantity || 1),
 unit_price: Number(sug.unit_price || 0), notes: '',
 category: sug.category || '', included: true,
 }));
 dispatch(actions.dismissSuggestion(sug.id));
 handlers.toast(`Added: ${sug.name}`, 'success');
 }

 return (
 <div style={isLocked ? { pointerEvents: 'none', opacity: 0.65 } : undefined}>
 {/* Collapsed Zone 1 summary */}
 <div className="qb-zone1-summary">
 <span className="qb-zone1-summary-text">
 {trade} · {province} · {(description || '').slice(0, 50)}{description?.length > 50 ? '…' : ''}
 </span>
 <button
 type="button"
 className="qb-zone1-edit-btn"
 onClick={() => dispatch(actions.setPhase('describe'))}
 >
 Edit
 </button>
 </div>

 {/* Header: Title + Customer */}
 <div className="rq-header-card">
 <input
 className="rq-job-title-input"
 value={title || draft.title}
 onChange={e => {
 dispatch(actions.setTitle(e.target.value));
 ud('title', e.target.value);
 }}
 placeholder="Job title"
 />
 <CustomerPicker />
 </div>

 {/rq-meta-toggle pl-toggle-row qb-s4-31c8by default (Phase 1: "Adjust details" drawer) */}
 <details className="rq-meta-collapse">
 <summary className="rq-meta-toggle pl-toggle-row">
 <span>Adjust details</span>
 <span className="pl-chevron" />
 </summary>

 {/* Scope Summary */}
 <div className="rq-scope-card">
 <div className="rq-scope-top">
 <span className="rq-scope-label">Scope summary</span>
 <span className="rq-scope-hint">Shown to customer</span>
 </div>
 <textarea
 className="rq-scope-input"
 value={draft.scope_summary}
 onChange={e => ud('scope_summary', e.target.value)}
 rows={2}
 placeholder="Brief description of work"
 />
 </div>

 {/* Settings row */}
 <div className="rq-settings-row qb-settings-grid">
 <div>
 <label className="qb-settings-label">
 {country === 'US' ? 'State' : 'Province'} (tax)
 </label>
 input qb-fs-sm-ef1c <select
 className="input"
 value={province}
 onChange={e => dispatch(actions.setProvince(e.target.value))}
 
 >
 {(country === 'CA' ? CA_PROVINCES : US_STATES).map(p => <option key={p}>{p}</option>)}
 </select>
 </div>
 <div>
 <label className="qb-settings-label">Deposit</label>
 <div className="qb-deposit-wrap">
 <label className="qb-deposit-check">
 <input
 type="checkbox"
 checked={draft.deposit_required}
 onChange={e => ud('deposit_required', e.target.checked)}
 className="qb-s3-5124"
 />
 <span>Require deposit</span>
 </label>
 {draft.deposit_required && (
 <div className="qb-deposit-pct">
 <input
 className="rq-deposit-input"
 type="number"
 min="0"
 value={draft.deposit_percent || ''}
 onChange={e => {
 const pct = Number(e.target.value) || 0;
 ud('deposit_percent', pct);
 ud('deposit_amount', Math.round(Math.max(0, totals.subtotal - (draft.discount || 0)) * pct / 100));
 }}
 className="qb-s2-396c"
 />
 <span className="qb-deposit-pct-label">%</span>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Assumptions / Exclusions / Notes */}
 <div className="rq-scope-card qb-details-scope">
 <button
 type="button"
 className="rq-details-toggle pl-toggle-row qb-details-toggle"
 onClick={() => dispatch(actions.setShowDetails(!showDetails))}
 >
 <span>Assumptions, exclusions & notes</span>
 <span className={`pl-chevron ${showDetails ? 'pl-chevron--open' : ''}`} />
 </button>
 {showDetails && (
 <div className="rq-details-grid">
 <div>
 <label className="rq-detail-label">Assumptions</label>
 <textarea className="rq-detail-input" value={draft.assumptions} onChange={e => ud('assumptions', e.target.value)} rows={2} placeholder="e.g. Standard access, no structural changes" />
 </div>
 <div>
 <label className="rq-detail-label">Exclusions</label>
 <textarea className="rq-detail-input" value={draft.exclusions} onChange={e => ud('exclusions', e.target.value)} rows={2} placeholder="e.g. Permit fees, drywall repair" />
 </div>
 <div>
 <label className="rq-detail-label">Internal notes</label>
 <textarea className="rq-detail-input" value={draft.internal_notes} onChange={e => ud('internal_notes', e.target.value)} rows={2} placeholder="Notes for your records only" />
 </div>
 </div>
 )}
 </div>
 </details>

 {/* Two-column layout: items + totals */}
 <div className="rq-builder-layout">
 <div className="rq-builder-left">
 <LineItemList />

 {/* Add Item Bar */}
 <div className="rq-add-bar">
 {!addMode && (
 <div className="rq-add-triggers">
 <button type="button" className="rq-add-trigger rq-add-trigger-primary" onClick={() => dispatch(actions.setAddMode('catalog'))}>
 Search catalog
 </button>
 <button type="button" className="rq-add-trigger" onClick={() => {
 dispatch(actions.addItem({ id: 'new_' + Date.now(), name: '', quantity: 1, unit_price: 0, notes: '', included: true, category: '' }));
>
 + Custom item
 </button>
 <button type="button" className="rq-add-trigger rq-add-trigger-foreman" onClick={() => {
 if (window.__punchlistOpenForeman) {
 const jobDesc = description || title || '';
 const ctx = {
 starters: [
 `What else should I include for this ${trade.toLowerCase()} job?`,
 jobDesc ? `Review my scope: "${jobDesc.slice(0, 80)}${jobDesc.length > 80 ? '…' : ''}"` : 'Help me scope this quote',
 `What do ${trade.toLowerCase()}s commonly forget to quote?`,
 ],
 quoteContext: {
 description: jobDesc, trade, title: title || '',
 items: lineItems.filter(i => i.name?.trim()).map(i => ({ name: i.name, qty: i.quantity, price: i.unit_price })),
 total: grandTotal, province, country,
 },
 };
 window.__punchlistOpenForeman(ctx);
 }
>
 <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="qb-s1-7e8a">
 <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
 </svg>
 Ask Foreman
 </button>
 {state.quoteId && scopeError && (
 <button type="button" className="rq-add-trigger" onClick={() => dispatch(actions.setPhase('describe'))}>
 ✦ Retry AI scope
 </button>
 )}
 </div>
 )}

 {/* Catalog overlay */}
 {addMode === 'catalog' && (
 <div className="rq-catalog-overlay">
 <div className="rq-catalog-panel">
 <div className="rq-catalog-top">
 <input
 className="rq-catalog-input"
 value={catalogQuery}
 onChange={e => dispatch(actions.setCatalogQuery(e.target.value))}
 placeholder="Search items…"
 autoFocus
 autoComplete="off"
 />
 <button
 type="button"
 className="rq-catalog-close"
 onClick={() => { dispatch(actions.setAddMode(null)); dispatch(actions.setCatalogQuery('')); }}
 aria-label="Close catalog"
 >
 <X size={14} strokeWidth={2} />
 </button>
 </div>
 {catalogResults.length > 0 && (
 <div className="rq-catalog-results">
 {catalogResults.map((item, i) => {
 const added = lineItems.some(li => li.name.toLowerCase() === item.name.toLowerCase());
 return (
 <div
 key={`${item.name}-${i}`}
 className={`rq-catalog-item ${added ? 'added' : ''} ${item.isContextRelevant ? 'rq-catalog-relevant' : ''}`}
 onClick={() => !added && addCatalogItem(item)}
 >
 <div className="rq-catalog-info">
 <span className="rq-catalog-name">{item.name}</span>
 {item.isContextRelevant && <span className="rq-catalog-match-tag">matches this job</span>}
 {item.desc && <span className="rq-catalog-desc">{item.desc}</span>}
 </div>
 <div className="rq-catalog-right">
 <span className="rq-catalog-price">{currency(item.lo)}–{currency(item.hi)}</span>
 <span className="rq-catalog-add">{added ? '✓' : '+'}</span>
 </div>
 </div>
 );
 })}
 </div>
 )}
 {catalogQuery.length >= 2 && catalogResults.length === 0 && (
 <div className="rq-catalog-empty">No matches — try different keywords</div>
 )}
 {!catalogQuery && (
 <div className="rq-catalog-empty qb-catalog-placeholder">
 Type to search {trade.toLowerCase()} items
 </div>
 )}
 </div>
 </div>
 )}
 </div>

 {/* Scope Hints */}
 {scopeHints.length > 0 && lineItems.length > 0 && (
 <details className="rq-hints">
 <summary className="pl-toggle-row qb-hints-summary">
 <span>Commonly added for {trade}</span>
 <span className="pl-chevron pl-chevron--sm" />
 </summary>
 <div className="rq-hints-chips">
 {scopeHints.slice(0, 5).map(hint => (
 <button
 key={hint}
 type="button"
 className="rq-hint-chip"
 onClick={() => {
 dispatch(actions.addItem({
 id: makeId(), name: hint, quantity: 1, unit_price: 0,
 notes: '', included: true, category: '',
 }));
 handlers.toast(`Added: ${hint} — set a price`, 'success');
>
 + {hint}
 </button>
 ))}
 </div>
 </details>
 )}

 {/* Foreman AI Suggestions */}
 {visibleSuggestions.length > 0 && (
 <Card padding="default" elevation={1} className="pl-sug-panel" as="section" aria-label="Foreman suggestions">
 <div className="pl-sug-head">
 <span className="pl-sug-title">Foreman suggests</span>
 <span className="pl-sug-count">{visibleSuggestions.length} idea{visibleSuggestions.length === 1 ? '' : 's'}</span>
 </div>
 <div className="pl-sug-list motion-isolate">
 {visibleSuggestions.map(sug => {
 const price = Number(sug.unit_price || 0);
 return (
 <div key={sug.id} className="pl-sug-item">
 <div className="pl-sug-item-main">
 <div className="pl-sug-item-name">{sug.name}</div>
 <div className="pl-sug-item-meta tabular">
 {price > 0 ? currency(price, country) : 'Set price'}
 {sug.category ? ` · ${sug.category}` : ''}
 {sug.isUpgrade ? ' · Upgrade' : ''}
 </div>
 {sug.why && <div className="pl-sug-item-why">{sug.why}</div>}
 </div>
 <div className="pl-sug-actions">
 <button type="button" className="pl-sug-btn pl-sug-btn-add" onClick={() => addSuggestionToItems(sug)} aria-label={`Add ${sug.name}`}>Add</button>
 <button type="button" className="pl-sug-btn" onClick={() => dispatch(actions.dismissSuggestion(sug.id))} aria-label={`Dismiss ${sug.name}`}>Dismiss</button>
 </div>
 </div>
 );
 })}
 </div>
 </Card>
 )}
 </div>

 {/* Right sidebar: totals + confidence */}
 <QuoteSummary />
 </div>

 {/* Errors */}
 {error && error !== '__needs_phone__' && <div className="jd-error">{error}</div>}
 {error === '__needs_phone__' && (
 <div className="jd-error qb-needs-phone">
 <div className="qb-needs-phone-title">Add a phone number to send via text</div>
 <div className="qb-needs-phone-row">
 <input
 className="jd-input qb-phone-input"
 type="tel"
 value={inlinePhone}
 onChange={e => dispatch(actions.setInlinePhone(e.target.value))}
 placeholder="e.g. (403) 555-0100"
 autoFocus
 />
 <button
 className="btn btn-primary btn-sm"
 type="button"
 disabled={!inlinePhone.trim()}
 onClick={handlers.handleInlinePhoneSave}
 >
 Save & send
 </button>
 </div>
 <button
 type="button"
 className="qb-copy-link-fallback"
 onClick={() => {
 dispatch(actions.setDeliveryMethod('copy'));
 dispatch(actions.setError(''));
 handlers.handleSend();
>
 Or copy link instead →
 </button>
 </div>
 )}

 {/* Sticky Footer */}
 <div className="rq-footer">
 <div className="rq-footer-left">
 <button
 className={`btn btn-secondary ${saveState === 'saved' ? 'btn-saved' : saveState === 'saving' ? 'btn-saving' : ''}`}
 type="button"
 disabled={saving || isLocked}
 onClick={handlers.handleSave}
 >
 {saving ? 'Saving…' : saveState === 'saved' ? '✓ Saved' : 'Save draft'}
 </button>
 {lastSavedAt && (() => {
 const diffS = Math.round((Date.now() - lastSavedAt.getTime()) / 1000);
 const label = diffS < 5 ? 'just now' : diffS < 60 ? `${diffS}s ago` : `${Math.round(diffS / 60)}m ago`;
 return <span className={`qb-save-ts${saveState === 'saving' ? ' qb-save-ts--faded' : ''}`}>Saved {label}</span>;
 })()}
 <button
 className="btn btn-secondary btn-sm rq-preview-btn"
 type="button"
 disabled={saving || isLocked}
 onClick={handlers.handlePreview}
 >
 Preview
 </button>
 </div>
 <div id="qb-send-btn" className="rq-footer-right">
 <div className="rq-footer-total num-stable tabular" aria-live="polite">
 {currency(grandTotal, country)}
 {showFinancing(grandTotal) && (
 <span className="rq-footer-monthly">or from {currency(estimatebtn btn-primary btn-lg qb-s0-0e7fountry)}/mo</span>
 )}
 </div>
 {itemCount === 0 ? (
 <button className="btn btn-primary btn-lg" type="button" disabled >
 Add items to send
 </button>
 ) : !draft.customer_id ? (
 <button className="btn btn-primary btn-lg" type="button" disabled={sending || isLocked} onClick={() => { dispatch(actions.setDeliveryMethod('copy')); handlers.handleSend(); }}>
 {sending ? 'Sending…' : 'Copy Quote Link'}
 </button>
 ) : !selCustomer?.phone ? (
 <button className="btn btn-primary btn-lg" type="button" disabled={sending || isLocked} onClick={() => { dispatch(actions.setDeliveryMethod('copy')); handlers.handleSend(); }}>
 {sending ? 'Sending…' : 'Send Quote →'}
 </button>
 ) : (
 <button className="btn btn-primary btn-lg" type="button" disabled={sending || isLocked} onClick={handlers.handleSend}>
 {sending ? 'Sending…' : `Text to ${selCustomer?.name?.split(' ')[0] || 'customer'} →`}
 </button>
 )}
 </div>
 </div>

 {/* Send Modal */}
 <SendDrawer />
 </div>
 );
}
