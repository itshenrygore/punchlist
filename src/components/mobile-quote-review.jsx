/**
 * MobileQuoteReview — A receipt-style quote editing screen built for phones.
 *
 * Design principles:
 * - No stepper, no breadcrumbs — just a back link
 * - Items displayed as a compact receipt list
 * - Tap to expand/edit items inline
 * - Single-row sticky footer: total + send CTA
 * - All inline styles — immune to CSS specificity wars
 * - Works in light + dark mode via CSS variables
 *
 * Receives a single `ctx` prop containing all state and handlers
 * from quote-builder-page.jsx.
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import { currency } from '../lib/format';

const s = {
  page: {
    display: 'flex', flexDirection: 'column', minHeight: '100%',
    paddingBottom: 'calc(56px + 52px + env(safe-area-inset-bottom, 0px))',
  },
  backRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 12px 4px', fontSize: 13, color: 'var(--text-2)',
    cursor: 'pointer',
  },
  backArrow: { fontSize: 16, lineHeight: 1 },
  tradeBadge: {
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.04em', color: 'var(--muted)',
    background: 'var(--panel-2)', borderRadius: 4, padding: '2px 6px',
    marginLeft: 'auto',
  },
  header: { padding: '0 12px 8px' },
  titleInput: {
    width: '100%', border: 'none', background: 'transparent',
    fontSize: 20, fontWeight: 800, color: 'var(--text)',
    letterSpacing: '-0.02em', padding: '4px 0', outline: 'none',
    fontFamily: 'inherit', lineHeight: 1.25,
  },
  custRow: {
    display: 'flex', alignItems: 'center', gap: 8, marginTop: 4,
  },
  custPill: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '4px 10px 4px 4px', borderRadius: 20,
    background: 'var(--brand-bg)', border: '1px solid var(--brand-line)',
    fontSize: 13, fontWeight: 600, color: 'var(--brand)',
    cursor: 'pointer',
  },
  custAvatar: {
    width: 22, height: 22, borderRadius: '50%',
    background: 'var(--brand)', color: '#fff',
    display: 'grid', placeItems: 'center',
    fontSize: 10, fontWeight: 700,
  },
  custChangeBtn: {
    fontSize: 12, color: 'var(--text-2)', background: 'none',
    border: 'none', cursor: 'pointer', padding: '4px 8px',
    fontFamily: 'inherit',
  },
  custSearch: {
    width: '100%', padding: '8px 10px', fontSize: 16,
    border: '1px solid var(--line)', borderRadius: 8,
    background: 'var(--input-bg, var(--panel-2))',
    color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
    marginTop: 6,
  },
  custList: {
    display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4,
  },
  custListItem: {
    padding: '8px 10px', fontSize: 14, color: 'var(--text)',
    borderRadius: 8, cursor: 'pointer', border: 'none',
    background: 'var(--panel-2)', textAlign: 'left',
    fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between',
  },
  divider: {
    height: 1, background: 'var(--line)', margin: '0 12px',
  },
  itemsSection: { padding: '4px 12px' },
  itemsLabel: {
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.05em', color: 'var(--muted)',
    padding: '6px 0 4px',
  },
  itemCard: {
    background: 'var(--panel)', border: '1px solid var(--line)',
    borderRadius: 10, padding: '8px 10px', marginBottom: 4,
  },
  itemCardEditing: {
    background: 'var(--panel)', border: '1px solid var(--brand-line)',
    borderRadius: 10, padding: '8px 10px', marginBottom: 4,
    boxShadow: '0 0 0 1px var(--brand-line)',
  },
  itemTopRow: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: 8,
  },
  itemName: {
    fontSize: 14, fontWeight: 600, color: 'var(--text)', flex: 1,
    border: 'none', background: 'transparent', padding: '2px 0',
    outline: 'none', fontFamily: 'inherit', width: '100%',
    minHeight: 24,
  },
  itemTotal: {
    fontSize: 14, fontWeight: 700, color: 'var(--text)',
    whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
  },
  controlsRow: {
    display: 'flex', alignItems: 'center', gap: 4, marginTop: 4,
  },
  qtyStepper: {
    display: 'flex', alignItems: 'center',
    border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden',
  },
  qtyBtn: {
    width: 32, height: 32, display: 'grid', placeItems: 'center',
    background: 'none', border: 'none', fontSize: 16,
    color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit',
  },
  qtyVal: {
    width: 24, textAlign: 'center', fontSize: 14, fontWeight: 600,
    color: 'var(--text)', fontVariantNumeric: 'tabular-nums',
  },
  times: { fontSize: 13, color: 'var(--muted)', margin: '0 2px' },
  priceInput: {
    flex: 1, minWidth: 50, padding: '5px 6px', fontSize: 16,
    border: '1px solid var(--line)', borderRadius: 8,
    background: 'var(--input-bg, var(--panel-2))',
    color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
    fontVariantNumeric: 'tabular-nums', textAlign: 'right',
  },
  priceWrap: {
    display: 'flex', alignItems: 'center', gap: 2, flex: 1,
  },
  pricePrefix: { fontSize: 14, color: 'var(--muted)' },
  deleteBtn: {
    width: 32, height: 32, display: 'grid', placeItems: 'center',
    background: 'none', border: 'none', fontSize: 16,
    color: 'var(--red, #ef4444)', cursor: 'pointer', borderRadius: 6,
    marginLeft: 4,
  },
  noteRow: { marginTop: 2 },
  noteBtn: {
    fontSize: 12, color: 'var(--brand)', background: 'none',
    border: 'none', cursor: 'pointer', padding: '4px 0',
    fontFamily: 'inherit', minHeight: 28,
  },
  noteInput: {
    width: '100%', fontSize: 13, padding: '4px 6px',
    border: '1px solid var(--line)', borderRadius: 6,
    background: 'var(--input-bg, var(--panel-2))',
    color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
  },
  priceHint: {
    fontSize: 11, color: 'var(--muted)', marginTop: 2,
    fontStyle: 'italic',
  },
  emptyState: {
    padding: '24px 16px', textAlign: 'center',
    color: 'var(--text-2)', fontSize: 13, lineHeight: 1.6,
    border: '1px dashed var(--line)', borderRadius: 10,
    margin: '4px 0',
  },
  addBtns: {
    display: 'flex', flexDirection: 'column', gap: 6,
    padding: '4px 12px 8px',
  },
  addBtnPrimary: {
    padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line-2)',
    background: 'var(--panel-2)', color: 'var(--text)',
    fontSize: 13, fontWeight: 700, textAlign: 'center',
    cursor: 'pointer', fontFamily: 'inherit', minHeight: 44,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  addBtnRow: { display: 'flex', gap: 6 },
  addBtn: {
    flex: 1, padding: '10px 8px', borderRadius: 10,
    border: '1px dashed var(--line)', background: 'none',
    color: 'var(--text-2)', fontSize: 13, fontWeight: 600,
    textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit',
    minHeight: 44, display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 4,
  },
  addBtnForeman: {
    flex: 1, padding: '10px 8px', borderRadius: 10,
    border: '1px solid var(--brand-line)', background: 'var(--brand-bg)',
    color: 'var(--brand)', fontSize: 13, fontWeight: 600,
    textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit',
    minHeight: 44, display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 4,
  },
  collapseRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 12px', cursor: 'pointer', margin: '0 12px',
    borderRadius: 8, background: 'var(--panel)',
    border: '1px solid var(--line)', marginBottom: 4,
    minHeight: 40,
  },
  collapseLabel: { fontSize: 12, fontWeight: 600, color: 'var(--text-2)' },
  collapseChevron: { fontSize: 12, color: 'var(--muted)' },
  confBar: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 12px', margin: '0 12px 4px',
    borderRadius: 8, minHeight: 40,
    cursor: 'pointer',
  },
  confBadge: {
    fontSize: 12, fontWeight: 700, padding: '2px 6px',
    borderRadius: 4,
  },
  confLabel: { fontSize: 12, fontWeight: 600 },
  footer: {
    position: 'fixed', bottom: 'calc(52px + env(safe-area-inset-bottom, 0px))',
    left: 0, right: 0, zIndex: 90,
    background: 'var(--panel)', borderTop: '1px solid var(--line)',
    boxShadow: '0 -2px 16px rgba(0,0,0,0.12)',
    padding: '6px 10px', display: 'flex',
    alignItems: 'center', gap: 8,
    minHeight: 48, maxHeight: 52,
  },
  footerTotal: {
    fontSize: 18, fontWeight: 800, color: 'var(--text)',
    fontVariantNumeric: 'tabular-nums', flexShrink: 0,
    letterSpacing: '-0.02em',
  },
  footerCta: {
    flex: 1, padding: '10px 16px', borderRadius: 10,
    background: 'var(--brand)', color: '#fff',
    fontSize: 14, fontWeight: 700, border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
    textAlign: 'center', minHeight: 40,
  },
  footerCtaDisabled: {
    flex: 1, padding: '10px 16px', borderRadius: 10,
    background: 'var(--panel-3, #ccc)', color: 'var(--muted)',
    fontSize: 14, fontWeight: 700, border: 'none',
    fontFamily: 'inherit', textAlign: 'center', minHeight: 40,
    cursor: 'default',
  },
};

export default function MobileQuoteReview({ ctx }) {
  const {
    // State
    lineItems, draft, title, trade, province, country,
    selCustomer, grandTotal, totals, itemCount, confidence,
    addMode, catalogQuery, catalogResults, editingItemId,
    priceRanges, sending, saving, isLocked, error,
    customerSearch, allCustomers, customersLoading,
    showNewCust, newCust, scopeError, quoteId, description,
    // Handlers
    setLineItems, ud, setPhase, setAddMode, setCatalogQuery,
    addCatalogItem, markDirty, genLineItemId, updateItem,
    adjustQty, removeItem, setEditingItemId, handleSend,
    save, setCustomerSearch, setShowNewCust, setNewCust,
    handleQuickCreateCustomer, searchCustomers,
    trackQuoteFlowCustomerSelected, setLocalCustomers,
    invalidateCustomers, setScopeError, setError, setTitle,
    // Send modal
    showSend, setShowSend, handleConfirmSend,
    smsBody, setSmsBody, deliveryMethod, setDeliveryMethod,
    SmsComposerField,
    // UI
    toast, currency: currencyFn,
  } = ctx;

  const cur = (v) => (currencyFn || currency)(v, country);
  const [scopeOpen, setScopeOpen] = useState(false);

  return (
    <>
      <div style={s.page}>
        {/* ── Back link ── */}
        <div style={s.backRow} onClick={() => setPhase('describe')}>
          <span style={s.backArrow}>←</span>
          <span>Edit job details</span>
          <span style={s.tradeBadge}>{trade} · {province}</span>
        </div>

        {/* ── Header: Title + Customer ── */}
        <div style={s.header}>
          <input
            style={s.titleInput}
            value={title || draft.title || ''}
            onChange={e => { if (typeof setTitle === 'function') setTitle(e.target.value); ud('title', e.target.value); }}
            placeholder="Job title"
          />
          <div style={s.custRow}>
            {selCustomer ? (
              <>
                <div style={s.custPill}>
                  <span style={s.custAvatar}>{selCustomer.name?.[0]?.toUpperCase() || '?'}</span>
                  {selCustomer.name}
                </div>
                <button style={s.custChangeBtn} type="button" onClick={() => { ud('customer_id', ''); setCustomerSearch(''); }}>Change</button>
              </>
            ) : (
              <div style={{ width: '100%' }}>
                <input
                  style={s.custSearch}
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  placeholder="Search or add customer…"
                  autoComplete="off"
                />
                {customerSearch.trim() && (() => {
                  const matches = searchCustomers(allCustomers, customerSearch, 6);
                  return matches.length > 0 ? (
                    <div style={s.custList}>
                      {matches.map(c => (
                        <button key={c.id} style={s.custListItem} type="button" onClick={() => { ud('customer_id', c.id); trackQuoteFlowCustomerSelected(c.id); setCustomerSearch(''); }}>
                          <span>{c.name}</span>
                          {c.phone && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{c.phone}</span>}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button style={{ ...s.custListItem, marginTop: 4, color: 'var(--brand)' }} type="button" onClick={() => { setNewCust(p => ({ ...p, name: customerSearch })); setShowNewCust(true); }}>
                      + New: "{customerSearch}"
                    </button>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        <div style={s.divider} />

        {/* ── Line Items ── */}
        <div style={s.itemsSection}>
          <div style={s.itemsLabel}>
            {itemCount > 0 ? `${itemCount} item${itemCount !== 1 ? 's' : ''}` : 'Line items'}
          </div>

          {lineItems.map((item, idx) => {
            const itemTotal = Number(item.quantity || 0) * Number(item.unit_price || 0);
            const isEditing = editingItemId === item.id;
            const range = priceRanges?.[item.id];
            const price = Number(item.unit_price || 0);

            return (
              <div key={item.id} style={isEditing ? s.itemCardEditing : s.itemCard}>
                {/* Top: Name + Total */}
                <div style={s.itemTopRow}>
                  <input
                    style={s.itemName}
                    value={item.name}
                    onChange={e => updateItem(item.id, { name: e.target.value })}
                    placeholder="Item name"
                    onFocus={() => setEditingItemId(item.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey && idx === lineItems.length - 1) {
                        e.preventDefault();
                        setLineItems(p => [...p, { id: genLineItemId(), name: '', quantity: 1, unit_price: 0, notes: '', included: true, category: '' }]);
                        markDirty();
                      }
                    }}
                  />
                  <span style={s.itemTotal}>{cur(itemTotal)}</span>
                </div>

                {/* Controls: Qty, Price, Delete */}
                <div style={s.controlsRow}>
                  <div style={s.qtyStepper}>
                    <button style={s.qtyBtn} type="button" onClick={() => adjustQty(item.id, -1)}>−</button>
                    <span style={s.qtyVal}>{Number(item.quantity).toFixed(item.quantity % 1 === 0 ? 0 : 2)}</span>
                    <button style={s.qtyBtn} type="button" onClick={() => adjustQty(item.id, 1)}>+</button>
                  </div>
                  <span style={s.times}>×</span>
                  <div style={s.priceWrap}>
                    <span style={s.pricePrefix}>$</span>
                    <input
                      style={s.priceInput}
                      type="number" min="0" step="1" inputMode="decimal"
                      value={item.unit_price}
                      onChange={e => updateItem(item.id, { unit_price: Math.max(0, Number(e.target.value) || 0) })}
                      onFocus={() => setEditingItemId(item.id)}
                    />
                  </div>
                  <button style={s.deleteBtn} type="button" onClick={() => removeItem(item.id)} aria-label="Remove">×</button>
                </div>

                {/* Price hint */}
                {isEditing && range && (() => {
                  if (price === 0) return <div style={s.priceHint}>Typical: ${range.lo}–${range.hi}</div>;
                  if (price < range.lo * 0.6) return <div style={{ ...s.priceHint, color: 'var(--amber)' }}>Below typical (${range.lo}–${range.hi})</div>;
                  if (price > range.hi * 1.8) return <div style={{ ...s.priceHint, color: 'var(--amber)' }}>Above typical (${range.lo}–${range.hi})</div>;
                  return null;
                })()}

                {/* Note */}
                <div style={s.noteRow}>
                  {item.notes ? (
                    <input style={s.noteInput} value={item.notes} onChange={e => updateItem(item.id, { notes: e.target.value })} placeholder="Note (shown to customer)" />
                  ) : (
                    <button style={s.noteBtn} type="button" onClick={() => updateItem(item.id, { notes: ' ' })}>+ note</button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {lineItems.length === 0 && (
            <div style={s.emptyState}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
              <strong>No items yet</strong><br />
              Search the catalog, add custom items, or ask Foreman.
            </div>
          )}
        </div>

        {/* ── Add Buttons ── */}
        {!addMode && (
          <div style={s.addBtns}>
            <button style={s.addBtnPrimary} type="button" onClick={() => setAddMode('catalog')}>
              🔍 Search catalog
            </button>
            <div style={s.addBtnRow}>
              <button style={s.addBtn} type="button" onClick={() => {
                setLineItems(p => [...p, { id: genLineItemId(), name: '', quantity: 1, unit_price: 0, notes: '', included: true, category: '' }]);
                markDirty();
              }}>+ Custom item</button>
              <button style={s.addBtnForeman} type="button" onClick={() => {
                if (window.__punchlistOpenForeman) {
                  const jobDesc = description || title || '';
                  window.__punchlistOpenForeman({
                    starters: [
                      `What else should I include for this ${trade.toLowerCase()} job?`,
                      jobDesc ? `Review my scope: "${jobDesc.slice(0, 80)}${jobDesc.length > 80 ? '…' : ''}"` : 'Help me scope this quote',
                      `What do ${trade.toLowerCase()}s commonly forget to quote?`,
                    ],
                    quoteContext: { description: jobDesc, trade, title: title || '', items: lineItems.filter(i => i.name?.trim()).map(i => ({ name: i.name, qty: i.quantity, price: i.unit_price })), total: grandTotal, province, country }
                  });
                }
              }}>💬 Ask Foreman</button>
            </div>
          </div>
        )}

        {/* ── Scope & Terms (collapsed) ── */}
        <div style={s.collapseRow} onClick={() => setScopeOpen(!scopeOpen)}>
          <span style={s.collapseLabel}>Scope, terms & notes</span>
          <span style={s.collapseChevron}>{scopeOpen ? '▾' : '▸'}</span>
        </div>
        {scopeOpen && (
          <div style={{ padding: '0 12px 8px' }}>
            <textarea
              style={{ ...s.custSearch, minHeight: 60, resize: 'vertical' }}
              value={draft.scope_summary}
              onChange={e => ud('scope_summary', e.target.value)}
              rows={2}
              placeholder="Brief description of work (shown to customer)"
            />
          </div>
        )}

        {/* ── Confidence ── */}
        {lineItems.length > 0 && confidence && confidence.readiness !== 'ready' && (
          <div
            style={{
              ...s.confBar,
              background: confidence.readiness === 'review' ? 'var(--amber-bg, rgba(245,158,11,0.1))' : 'var(--amber-bg, rgba(245,158,11,0.1))',
              border: '1px solid var(--amber, rgba(245,158,11,0.25))',
            }}
          >
            <span style={{ ...s.confBadge, background: 'var(--amber-bg)', color: 'var(--amber)', border: '1px solid var(--amber, rgba(245,158,11,0.3))' }}>
              {confidence.score}%
            </span>
            <span style={{ ...s.confLabel, color: 'var(--amber-text, var(--amber))' }}>
              Commonly missed items ▸
            </span>
          </div>
        )}
        {lineItems.length > 0 && confidence?.readiness === 'ready' && (
          <div style={{ ...s.confBar, background: 'var(--green-bg, rgba(34,197,94,0.1))', border: '1px solid var(--green-line, rgba(34,197,94,0.25))' }}>
            <span style={{ fontSize: 14, color: 'var(--green)' }}>✓</span>
            <span style={{ ...s.confLabel, color: 'var(--green)' }}>Ready to send</span>
          </div>
        )}

        {/* Error display */}
        {error && error !== '__needs_phone__' && (
          <div style={{ margin: '0 12px 4px', padding: '8px 10px', borderRadius: 8, background: 'var(--red-bg)', color: 'var(--red)', fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>

      {/* ── Sticky Footer ── */}
      <div style={s.footer}>
        <span style={s.footerTotal}>{cur(grandTotal)}</span>
        {itemCount === 0 ? (
          <button style={s.footerCtaDisabled} type="button" disabled>Add items to send</button>
        ) : !draft.customer_id ? (
          <button style={s.footerCta} type="button" disabled={sending || isLocked} onClick={() => { ctx.setDeliveryMethod?.('copy'); handleSend(); }}>
            {sending ? 'Sending…' : 'Copy Quote Link'}
          </button>
        ) : (
          <button style={s.footerCta} type="button" disabled={sending || isLocked} onClick={handleSend}>
            {sending ? 'Sending…' : `Text to ${selCustomer?.name?.split(' ')[0] || 'customer'} →`}
          </button>
        )}
      </div>

      {/* ── Catalog Overlay ── */}
      {addMode === 'catalog' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={() => { setAddMode(null); setCatalogQuery(''); }}>
          <div style={{ background: 'var(--panel)', borderRadius: '18px 18px 0 0', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 8, padding: '12px 12px 8px', alignItems: 'center' }}>
              <input
                style={{ ...s.custSearch, marginTop: 0, flex: 1 }}
                value={catalogQuery}
                onChange={e => setCatalogQuery(e.target.value)}
                placeholder="Search items…"
                autoFocus autoComplete="off"
              />
              <button type="button" onClick={() => { setAddMode(null); setCatalogQuery(''); }} style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--panel-2)', display: 'grid', placeItems: 'center', fontSize: 18, color: 'var(--text-2)', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '0 4px 16px' }}>
              {catalogResults.map((item, i) => {
                const added = lineItems.some(li => li.name.toLowerCase() === item.name.toLowerCase());
                return (
                  <div key={`${item.name}-${i}`} onClick={() => !added && addCatalogItem(item)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 10px', borderBottom: '1px solid var(--line)', cursor: added ? 'default' : 'pointer', opacity: added ? 0.5 : 1 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{item.name}</div>
                      {item.desc && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{item.desc?.slice(0, 60)}…</div>}
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{cur(item.lo)}–{cur(item.hi)}</span>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: added ? 'var(--green)' : 'var(--brand)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0 }}>{added ? '✓' : '+'}</div>
                  </div>
                );
              })}
              {catalogQuery.length >= 2 && catalogResults.length === 0 && <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No matches — try different keywords</div>}
              {!catalogQuery && <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Type to search {trade.toLowerCase()} items</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── Send Bottom Sheet ── */}
      {showSend && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={() => setShowSend(false)}>
          <div style={{ background: 'var(--panel)', borderRadius: '18px 18px 0 0', padding: '8px 16px calc(16px + env(safe-area-inset-bottom, 0px))' }} onClick={e => e.stopPropagation()}>
            {/* Grab handle */}
            <div style={{ width: 36, height: 4, background: 'var(--line-2)', borderRadius: 2, margin: '4px auto 12px' }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Send Quote</div>

            {selCustomer && (
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
                To <strong style={{ color: 'var(--text)' }}>{selCustomer.name}</strong>{selCustomer.phone ? ` · ${selCustomer.phone}` : ''}
              </div>
            )}

            {/* Summary */}
            <div style={{ background: 'var(--panel-2)', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
              {lineItems.filter(i => i.name?.trim()).slice(0, 3).map(i => (
                <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 13, color: 'var(--text-2)' }}>
                  <span>{i.name}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{cur(Number(i.quantity || 0) * Number(i.unit_price || 0))}</span>
                </div>
              ))}
              {lineItems.length > 3 && <div style={{ fontSize: 12, color: 'var(--muted)', padding: '2px 0' }}>+{lineItems.length - 3} more</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 0', borderTop: '1px solid var(--line)', marginTop: 4, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                <span>Total</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{cur(grandTotal)}</span>
              </div>
            </div>

            {/* Send method */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              {[{ v: 'text', l: '💬 Text' }, { v: 'email', l: '✉️ Email' }, { v: 'copy', l: '🔗 Copy' }].map(o => (
                <button key={o.v} type="button" onClick={() => setDeliveryMethod(o.v)} style={{
                  flex: 1, padding: '8px 6px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: deliveryMethod === o.v ? '2px solid var(--brand)' : '1px solid var(--line)', background: deliveryMethod === o.v ? 'var(--brand-bg)' : 'var(--panel)', color: deliveryMethod === o.v ? 'var(--brand)' : 'var(--text-2)',
                }}>{o.l}</button>
              ))}
            </div>

            {/* SMS body editor */}
            {deliveryMethod === 'text' && SmsComposerField && (
              <div style={{ marginBottom: 12 }}>
                <SmsComposerField id="qb-sms-mobile" label="Message" value={smsBody} onChange={setSmsBody} rows={4} showLinkHint={true} />
              </div>
            )}
            {deliveryMethod === 'text' && !SmsComposerField && (
              <textarea style={{ ...s.custSearch, minHeight: 80, resize: 'vertical', marginBottom: 12 }} value={smsBody} onChange={e => setSmsBody(e.target.value)} placeholder="Message..." />
            )}

            {/* Confirm button */}
            <button type="button" disabled={sending || saving} onClick={handleConfirmSend} style={{
              width: '100%', padding: '14px 16px', borderRadius: 12, background: 'var(--brand)', color: '#fff', fontSize: 16, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', minHeight: 48, opacity: (sending || saving) ? 0.6 : 1,
            }}>
              {sending ? 'Sending…' : saving ? 'Saving…' : deliveryMethod === 'text' ? `Text ${cur(grandTotal)} Quote` : deliveryMethod === 'email' ? `Email ${cur(grandTotal)} Quote` : 'Copy Quote Link'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
