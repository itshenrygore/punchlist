/**
 * MobileQuoteReview — Receipt-style quote editor for phones.
 *
 * Clean rebuild — all inline styles, no external CSS dependency.
 * Designed for 375px (iPhone X/SE) as minimum viewport.
 *
 * Fixes from prior version:
 * - Controls row: qty + price sized to never overflow 375px
 * - "Ask Foreman" button text never clips (shortened to "Foreman")
 * - Catalog is a proper drag-to-dismiss bottom sheet
 * - Confidence panel expands to show individual checks
 * - All inputs fontSize:16 to prevent iOS auto-zoom
 * - Swipe-to-delete on line items (iOS convention)
 * - No text clipping on any viewport ≥ 320px
 *
 * Receives a single `ctx` prop containing all state and handlers
 * from quote-builder-page.jsx.
 */
import { useState, useRef, useCallback } from 'react';
import { currency } from '../lib/format';

/* ═══════════════════════════════════════════════════════
   Inline style objects — grouped by section
   ═══════════════════════════════════════════════════════ */

// ── Layout ──
const layout = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
    paddingBottom: 'calc(60px + 52px + env(safe-area-inset-bottom, 0px))',
    background: 'var(--bg, #F6F5F2)',
  },
  backRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px 6px',
    fontSize: 13,
    color: 'var(--text-2, #344054)',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  tradeBadge: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--muted, #667085)',
    background: 'var(--panel-2, #F9F9F7)',
    borderRadius: 4,
    padding: '2px 6px',
    marginLeft: 'auto',
    flexShrink: 0,
  },
  headerWrap: {
    padding: '0 16px 10px',
  },
  divider: {
    height: 1,
    background: 'var(--line, rgba(17,24,39,.08))',
    margin: '0 16px',
  },
  section: {
    padding: '6px 16px',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--muted, #667085)',
    padding: '8px 0 6px',
  },
};

// ── Title / Customer ──
const hdr = {
  titleInput: {
    width: '100%',
    border: 'none',
    background: 'transparent',
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--text, #161616)',
    letterSpacing: '-0.02em',
    padding: '4px 0',
    outline: 'none',
    fontFamily: 'inherit',
    lineHeight: 1.25,
  },
  custRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  custPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 10px 5px 5px',
    borderRadius: 20,
    background: 'var(--brand-bg, rgba(184,81,40,.07))',
    border: '1px solid var(--brand-line, rgba(184,81,40,.18))',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--brand, #B85128)',
  },
  custAvatar: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: 'var(--brand, #B85128)',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    fontSize: 10,
    fontWeight: 700,
  },
  custChangeBtn: {
    fontSize: 12,
    color: 'var(--text-2, #344054)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '6px 8px',
    fontFamily: 'inherit',
  },
  custSearch: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 16,           // ← prevents iOS zoom
    border: '1px solid var(--line-2, rgba(17,24,39,.14))',
    borderRadius: 10,
    background: 'var(--input-bg, #fff)',
    color: 'var(--text, #161616)',
    outline: 'none',
    fontFamily: 'inherit',
    marginTop: 6,
  },
  custList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    marginTop: 4,
  },
  custListItem: {
    padding: '10px 12px',
    fontSize: 14,
    color: 'var(--text, #161616)',
    borderRadius: 8,
    cursor: 'pointer',
    border: 'none',
    background: 'var(--panel-2, #F9F9F7)',
    textAlign: 'left',
    fontFamily: 'inherit',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
};

// ── Line Item Card ──
const itm = {
  card: {
    background: 'var(--panel, #fff)',
    border: '1px solid var(--line, rgba(17,24,39,.08))',
    borderRadius: 12,
    marginBottom: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  cardEditing: {
    background: 'var(--panel, #fff)',
    border: '1.5px solid var(--brand-line, rgba(184,81,40,.18))',
    borderRadius: 12,
    marginBottom: 6,
    overflow: 'hidden',
    position: 'relative',
    boxShadow: '0 0 0 1px var(--brand-line, rgba(184,81,40,.18))',
  },
  swipeActions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 120,
    display: 'flex',
    zIndex: 0,
  },
  swipeDup: {
    flex: 1, display: 'grid', placeItems: 'center',
    background: 'var(--muted, #667085)', border: 'none', color: '#fff',
    fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
  },
  swipeDel: {
    flex: 1, display: 'grid', placeItems: 'center',
    background: 'var(--red, #DC2626)', border: 'none', color: '#fff',
    fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
  },
  content: {
    position: 'relative', zIndex: 1,
    background: 'var(--panel, #fff)',
    padding: '10px 14px',
    transition: 'transform 0.25s cubic-bezier(0.32,0.72,0,1)',
    borderRadius: 12,
  },
  topRow: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
  },
  nameInput: {
    flex: 1, minWidth: 0,
    fontSize: 16,            // ← prevents iOS zoom
    fontWeight: 600,
    color: 'var(--text, #161616)',
    border: 'none', background: 'transparent',
    padding: '2px 0', outline: 'none',
    fontFamily: 'inherit', lineHeight: 1.3,
  },
  totalLabel: {
    fontSize: 14, fontWeight: 700,
    color: 'var(--text, #161616)',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0, paddingTop: 3,
  },
  controls: {
    display: 'flex', alignItems: 'center',
    gap: 6, marginTop: 6,
  },
  qtyStepper: {
    display: 'inline-flex', alignItems: 'center',
    border: '1px solid var(--line-2, rgba(17,24,39,.14))',
    borderRadius: 8, overflow: 'hidden', flexShrink: 0,
  },
  qtyBtn: {
    width: 34, height: 34, display: 'grid', placeItems: 'center',
    background: 'none', border: 'none', fontSize: 17, fontWeight: 600,
    color: 'var(--text-2, #344054)', cursor: 'pointer', fontFamily: 'inherit',
    WebkitTapHighlightColor: 'transparent',
  },
  qtyVal: {
    minWidth: 24, textAlign: 'center', fontSize: 14, fontWeight: 700,
    color: 'var(--text, #161616)', fontVariantNumeric: 'tabular-nums',
    userSelect: 'none',
  },
  times: {
    fontSize: 12, color: 'var(--muted, #667085)', flexShrink: 0,
  },
  priceWrap: {
    display: 'flex', alignItems: 'center', gap: 2,
    flex: 1, minWidth: 0, maxWidth: 120,
    border: '1px solid var(--line-2, rgba(17,24,39,.14))',
    borderRadius: 8, padding: '0 8px', height: 34,
    background: 'var(--input-bg, #fff)',
  },
  pricePrefix: {
    fontSize: 13, color: 'var(--muted, #667085)',
    fontWeight: 500, flexShrink: 0,
  },
  priceInput: {
    flex: 1, minWidth: 0, width: '100%',
    fontSize: 16,            // ← prevents iOS zoom
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--text, #161616)',
    border: 'none', background: 'transparent',
    outline: 'none', fontFamily: 'inherit',
    padding: 0, textAlign: 'right',
    MozAppearance: 'textfield',
  },
  priceHint: {
    fontSize: 11, color: 'var(--muted, #667085)',
    marginTop: 4, fontStyle: 'italic',
  },
  noteBtn: {
    fontSize: 12, color: 'var(--brand, #B85128)',
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '4px 0 0', fontFamily: 'inherit', minHeight: 24,
    WebkitTapHighlightColor: 'transparent',
  },
  noteInput: {
    width: '100%', fontSize: 16, // ← prevents iOS zoom
    padding: '6px 0 0',
    border: 'none',
    borderTop: '1px solid var(--line, rgba(17,24,39,.08))',
    background: 'transparent',
    color: 'var(--text-2, #344054)',
    outline: 'none', fontFamily: 'inherit', marginTop: 6,
  },
};

// ── Add Buttons ──
const addS = {
  wrap: {
    display: 'flex', flexDirection: 'column', gap: 6,
    padding: '4px 16px 8px',
  },
  primary: {
    padding: '12px 14px', borderRadius: 10,
    border: '1.5px solid var(--brand-line, rgba(184,81,40,.18))',
    background: 'var(--brand-bg, rgba(184,81,40,.07))',
    color: 'var(--brand, #B85128)',
    fontSize: 14, fontWeight: 700, textAlign: 'center',
    cursor: 'pointer', fontFamily: 'inherit', minHeight: 44,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    WebkitTapHighlightColor: 'transparent',
  },
  row: { display: 'flex', gap: 6 },
  secondary: {
    flex: 1, padding: '10px 8px', borderRadius: 10,
    border: '1px dashed var(--line-2, rgba(17,24,39,.14))',
    background: 'var(--panel, #fff)',
    color: 'var(--text-2, #344054)', fontSize: 13, fontWeight: 600,
    textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit',
    minHeight: 44, display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 4,
    WebkitTapHighlightColor: 'transparent',
    overflow: 'hidden', whiteSpace: 'nowrap', minWidth: 0,
  },
  foreman: {
    flex: 1, padding: '10px 8px', borderRadius: 10,
    border: '1px solid var(--brand-line, rgba(184,81,40,.18))',
    background: 'var(--brand-bg, rgba(184,81,40,.07))',
    color: 'var(--brand, #B85128)', fontSize: 13, fontWeight: 600,
    textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit',
    minHeight: 44, display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 4,
    WebkitTapHighlightColor: 'transparent',
    overflow: 'hidden', whiteSpace: 'nowrap', minWidth: 0,
  },
};

// ── Chrome (scope, confidence, footer) ──
const chr = {
  collapse: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 14px', cursor: 'pointer', margin: '4px 16px',
    borderRadius: 10, background: 'var(--panel, #fff)',
    border: '1px solid var(--line, rgba(17,24,39,.08))', minHeight: 44,
    WebkitTapHighlightColor: 'transparent',
  },
  collapseLabel: { fontSize: 13, fontWeight: 600, color: 'var(--text-2, #344054)' },
  confBar: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 14px', margin: '4px 16px', borderRadius: 10,
    minHeight: 44, cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
  },
  confBadge: {
    fontSize: 12, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
    fontVariantNumeric: 'tabular-nums',
  },
  confLabel: { fontSize: 13, fontWeight: 600, flex: 1 },
  confChecks: {
    margin: '0 16px 4px', padding: '8px 14px 12px',
    background: 'var(--amber-bg, rgba(217,119,6,.04))',
    border: '1px solid var(--amber, rgba(217,119,6,.2))',
    borderTop: 'none', borderRadius: '0 0 10px 10px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  confCheck: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 13, color: 'var(--text-2, #344054)',
  },
  footer: {
    position: 'fixed',
    bottom: 'calc(52px + env(safe-area-inset-bottom, 0px))',
    left: 0, right: 0, zIndex: 90,
    background: 'var(--panel, #fff)',
    borderTop: '1px solid var(--line, rgba(17,24,39,.08))',
    boxShadow: '0 -2px 16px rgba(0,0,0,0.1)',
    padding: '8px 12px', display: 'flex',
    alignItems: 'center', gap: 10, minHeight: 52,
  },
  footerTotal: {
    fontSize: 18, fontWeight: 800, color: 'var(--text, #161616)',
    fontVariantNumeric: 'tabular-nums', flexShrink: 0, letterSpacing: '-0.02em',
  },
  footerCta: {
    flex: 1, padding: '12px 16px', borderRadius: 12,
    background: 'var(--brand, #B85128)', color: '#fff',
    fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
    fontFamily: 'inherit', textAlign: 'center', minHeight: 44,
    WebkitTapHighlightColor: 'transparent',
  },
  footerCtaDisabled: {
    flex: 1, padding: '12px 16px', borderRadius: 12,
    background: 'var(--panel-3, #E8E7E4)', color: 'var(--muted, #667085)',
    fontSize: 15, fontWeight: 700, border: 'none', fontFamily: 'inherit',
    textAlign: 'center', minHeight: 44, cursor: 'default',
  },
  emptyState: {
    padding: '32px 20px', textAlign: 'center',
    color: 'var(--text-2, #344054)', fontSize: 14, lineHeight: 1.6,
    border: '1px dashed var(--line-2, rgba(17,24,39,.14))',
    borderRadius: 12, margin: '4px 0', background: 'var(--panel, #fff)',
  },
  errorBox: {
    margin: '4px 16px', padding: '10px 14px', borderRadius: 10,
    background: 'var(--red-bg, rgba(220,38,38,.07))',
    color: 'var(--red, #DC2626)', fontSize: 13, lineHeight: 1.5,
  },
};

// ── Catalog sheet ──
const cat = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 200,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
  },
  panel: {
    background: 'var(--panel, #fff)',
    borderRadius: '20px 20px 0 0',
    maxHeight: '88vh', display: 'flex', flexDirection: 'column',
    overflow: 'hidden', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  },
  handle: {
    width: 36, height: 5,
    background: 'var(--line-2, rgba(17,24,39,.14))',
    borderRadius: 3, margin: '10px auto 6px',
  },
  searchRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '4px 14px 10px',
    borderBottom: '1px solid var(--line, rgba(17,24,39,.08))',
  },
  searchInput: {
    flex: 1, padding: '10px 0', fontSize: 16,
    border: 'none', background: 'transparent',
    color: 'var(--text, #161616)', outline: 'none',
    fontFamily: 'inherit', minWidth: 0,
  },
  doneBtn: {
    fontSize: 14, fontWeight: 700, color: 'var(--brand, #B85128)',
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '8px 4px', fontFamily: 'inherit', flexShrink: 0,
    WebkitTapHighlightColor: 'transparent',
  },
  clearBtn: {
    width: 26, height: 26, borderRadius: '50%', border: 'none',
    background: 'var(--panel-3, #E8E7E4)', color: 'var(--muted)', fontSize: 12,
    display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0,
  },
  results: {
    flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
  },
  itemRow: (added) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 14px', width: '100%', textAlign: 'left',
    fontFamily: 'inherit', cursor: added ? 'default' : 'pointer',
    opacity: added ? 0.45 : 1, background: 'none',
    border: 'none', borderBottom: '1px solid var(--line, rgba(17,24,39,.08))',
    WebkitTapHighlightColor: 'transparent',
  }),
  itemInfo: {
    flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2,
  },
  itemName: {
    fontSize: 14, fontWeight: 600, color: 'var(--text, #161616)', lineHeight: 1.3,
  },
  itemMatch: { fontSize: 11, fontWeight: 600, color: 'var(--brand, #B85128)' },
  itemDesc: {
    fontSize: 12, color: 'var(--muted, #667085)', lineHeight: 1.4,
    overflow: 'hidden', display: '-webkit-box',
    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
  },
  itemRight: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
    gap: 4, flexShrink: 0,
  },
  itemPrice: {
    fontSize: 12, fontWeight: 600, color: 'var(--muted, #667085)',
    fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
  },
  addIcon: (added) => ({
    width: 30, height: 30, borderRadius: '50%',
    background: added ? 'var(--green, #0F7A50)' : 'var(--brand, #B85128)',
    color: '#fff', display: 'grid', placeItems: 'center',
    fontSize: 16, fontWeight: 700, flexShrink: 0,
  }),
  empty: {
    padding: '32px 16px', textAlign: 'center',
    color: 'var(--muted, #667085)', fontSize: 13,
  },
};

// ── Send sheet ──
const snd = {
  handle: {
    width: 36, height: 4,
    background: 'var(--line-2, rgba(17,24,39,.14))',
    borderRadius: 2, margin: '6px auto 14px',
  },
  title: { fontSize: 18, fontWeight: 700, color: 'var(--text, #161616)', marginBottom: 14 },
  to: { fontSize: 13, color: 'var(--text-2, #344054)', marginBottom: 14 },
  summary: {
    background: 'var(--panel-2, #F9F9F7)', borderRadius: 12,
    padding: '12px 14px', marginBottom: 14,
  },
  summaryRow: {
    display: 'flex', justifyContent: 'space-between',
    padding: '3px 0', fontSize: 13, color: 'var(--text-2, #344054)',
  },
  summaryRowName: {
    flex: 1, minWidth: 0, overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  summaryRowAmount: {
    fontVariantNumeric: 'tabular-nums', flexShrink: 0, marginLeft: 8,
  },
  summaryTotal: {
    display: 'flex', justifyContent: 'space-between',
    padding: '8px 0 0',
    borderTop: '1px solid var(--line, rgba(17,24,39,.08))',
    marginTop: 6, fontSize: 16, fontWeight: 700, color: 'var(--text, #161616)',
  },
  methods: { display: 'flex', gap: 4, marginBottom: 14 },
  methodBtn: (active) => ({
    flex: 1, padding: '10px 6px', borderRadius: 10,
    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    textAlign: 'center', minHeight: 40,
    border: active ? '2px solid var(--brand, #B85128)' : '1px solid var(--line-2, rgba(17,24,39,.14))',
    background: active ? 'var(--brand-bg, rgba(184,81,40,.07))' : 'var(--panel, #fff)',
    color: active ? 'var(--brand, #B85128)' : 'var(--text-2, #344054)',
    WebkitTapHighlightColor: 'transparent',
  }),
  confirmBtn: (disabled) => ({
    width: '100%', padding: '14px 16px', borderRadius: 12,
    background: disabled ? 'var(--panel-3, #E8E7E4)' : 'var(--brand, #B85128)',
    color: disabled ? 'var(--muted, #667085)' : '#fff',
    fontSize: 16, fontWeight: 700, border: 'none',
    cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
    minHeight: 50, WebkitTapHighlightColor: 'transparent',
  }),
};


/* ═══════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════ */

function ItemCard({ li, idx, isEditing, priceRange, cur, isLast,
  updateItem, adjustQty, removeItem, setEditingItemId,
  setLineItems, markDirty, genLineItemId }) {

  const lineTotal = Number(li.quantity || 0) * Number(li.unit_price || 0);
  const qtyDisplay = Number(li.quantity).toFixed(li.quantity % 1 === 0 ? 0 : 2);
  const contentRef = useRef(null);
  const touchRef = useRef({ sx: 0, sy: 0, active: false });
  const [swiped, setSwiped] = useState(false);
  const [noteOpen, setNoteOpen] = useState(!!li.notes?.trim());

  const onTS = useCallback(e => {
    if (swiped) return;
    const t = e.touches[0];
    touchRef.current = { sx: t.clientX, sy: t.clientY, active: false };
  }, [swiped]);

  const onTM = useCallback(e => {
    const { sx, sy } = touchRef.current;
    const t = e.touches[0];
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;
    if (!touchRef.current.active && Math.abs(dy) > Math.abs(dx)) return;
    if (dx < -8) {
      touchRef.current.active = true;
      e.preventDefault();
      const off = Math.max(-120, dx);
      if (contentRef.current) {
        contentRef.current.style.transform = `translateX(${off}px)`;
        contentRef.current.style.transition = 'none';
      }
    }
  }, []);

  const onTE = useCallback(() => {
    if (!touchRef.current.active) return;
    const el = contentRef.current;
    if (!el) return;
    const m = new DOMMatrix(getComputedStyle(el).transform);
    el.style.transition = 'transform 0.25s cubic-bezier(0.32,0.72,0,1)';
    if (m.m41 < -50) {
      el.style.transform = 'translateX(-120px)';
      setSwiped(true);
    } else {
      el.style.transform = 'translateX(0)';
    }
    touchRef.current.active = false;
  }, []);

  const closeSwipe = () => {
    if (contentRef.current) {
      contentRef.current.style.transition = 'transform 0.25s cubic-bezier(0.32,0.72,0,1)';
      contentRef.current.style.transform = 'translateX(0)';
    }
    setSwiped(false);
  };

  const price = Number(li.unit_price || 0);

  return (
    <div
      style={isEditing ? itm.cardEditing : itm.card}
      onTouchStart={onTS}
      onTouchMove={onTM}
      onTouchEnd={onTE}
    >
      {/* Revealed actions (behind content) */}
      <div style={itm.swipeActions}>
        <button type="button" style={itm.swipeDup} onClick={() => {
          setLineItems(p => {
            const n = [...p];
            n.splice(idx + 1, 0, { ...li, id: genLineItemId() });
            return n;
          });
          markDirty();
          closeSwipe();
        }}>Copy</button>
        <button type="button" style={itm.swipeDel} onClick={() => removeItem(li.id)}>Delete</button>
      </div>

      {/* Main content (slides on swipe) */}
      <div ref={contentRef} style={itm.content} onClick={() => swiped && closeSwipe()}>
        {/* Row 1: Name + Total */}
        <div style={itm.topRow}>
          <input
            style={itm.nameInput}
            value={li.name}
            onChange={e => updateItem(li.id, { name: e.target.value })}
            placeholder="Item name"
            onFocus={() => setEditingItemId(li.id)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && isLast) {
                e.preventDefault();
                setLineItems(p => [...p, { id: genLineItemId(), name: '', quantity: 1, unit_price: 0, notes: '', included: true, category: '' }]);
                markDirty();
              }
            }}
          />
          <span style={itm.totalLabel}>{cur(lineTotal)}</span>
        </div>

        {/* Row 2: Qty × $ Price */}
        <div style={itm.controls}>
          <div style={itm.qtyStepper}>
            <button type="button" style={itm.qtyBtn} onClick={() => adjustQty(li.id, -1)}>−</button>
            <span style={itm.qtyVal}>{qtyDisplay}</span>
            <button type="button" style={itm.qtyBtn} onClick={() => adjustQty(li.id, 1)}>+</button>
          </div>
          <span style={itm.times}>× $</span>
          <div style={itm.priceWrap}>
            <input
              style={itm.priceInput}
              type="number" min="0" step="1" inputMode="decimal"
              value={li.unit_price}
              onChange={e => updateItem(li.id, { unit_price: Math.max(0, Number(e.target.value) || 0) })}
              onFocus={() => setEditingItemId(li.id)}
            />
          </div>
        </div>

        {/* Price hint */}
        {isEditing && priceRange && (() => {
          if (price === 0) return <div style={itm.priceHint}>Typical: ${priceRange.lo}–${priceRange.hi}</div>;
          if (price < priceRange.lo * 0.6) return <div style={{ ...itm.priceHint, color: 'var(--amber)' }}>Below typical (${priceRange.lo}–${priceRange.hi})</div>;
          if (price > priceRange.hi * 1.8) return <div style={{ ...itm.priceHint, color: 'var(--red)' }}>Above typical (${priceRange.lo}–${priceRange.hi})</div>;
          return null;
        })()}

        {/* Note */}
        {noteOpen || li.notes?.trim() ? (
          <input
            style={itm.noteInput}
            value={li.notes || ''}
            onChange={e => updateItem(li.id, { notes: e.target.value })}
            placeholder="Note (shown to customer)"
          />
        ) : (
          <button type="button" style={itm.noteBtn} onClick={() => { setNoteOpen(true); updateItem(li.id, { notes: '' }); }}>+ note</button>
        )}
      </div>
    </div>
  );
}


function CatalogSheet({ open, onClose, query, onQuery, results, lineItems, trade, onAdd, cur }) {
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const touchRef = useRef({ startY: 0, active: false });

  // Auto-focus on open
  if (open && inputRef.current) {
    setTimeout(() => inputRef.current?.focus(), 80);
  }

  if (!open) return null;

  const isAdded = (name) => lineItems.some(li => (li.name || '').toLowerCase() === name.toLowerCase());

  return (
    <div style={cat.backdrop} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={panelRef}
        style={cat.panel}
        onClick={e => e.stopPropagation()}
        onTouchStart={e => {
          const rect = panelRef.current?.getBoundingClientRect();
          if (!rect || e.touches[0].clientY - rect.top > 48) return;
          touchRef.current = { startY: e.touches[0].clientY, active: true };
        }}
        onTouchMove={e => {
          if (!touchRef.current.active) return;
          const dy = e.touches[0].clientY - touchRef.current.startY;
          if (dy > 0 && panelRef.current) {
            panelRef.current.style.transform = `translateY(${dy}px)`;
            panelRef.current.style.transition = 'none';
          }
        }}
        onTouchEnd={() => {
          if (!touchRef.current.active) return;
          touchRef.current.active = false;
          if (!panelRef.current) return;
          const m = new DOMMatrix(getComputedStyle(panelRef.current).transform);
          panelRef.current.style.transition = 'transform 0.25s cubic-bezier(0.32,0.72,0,1)';
          if (m.m41 > 120) {
            panelRef.current.style.transform = 'translateY(100%)';
            setTimeout(onClose, 250);
          } else {
            panelRef.current.style.transform = 'translateY(0)';
          }
        }}
      >
        <div style={cat.handle} />
        <div style={cat.searchRow}>
          <span style={{ color: 'var(--muted)', flexShrink: 0, fontSize: 15 }}>🔍</span>
          <input
            ref={inputRef}
            style={cat.searchInput}
            value={query}
            onChange={e => onQuery(e.target.value)}
            placeholder={`Search ${trade?.toLowerCase() || ''} items…`}
            autoComplete="off" autoCorrect="off" autoFocus
          />
          {query && <button type="button" onClick={() => onQuery('')} style={cat.clearBtn}>✕</button>}
          <button type="button" style={cat.doneBtn} onClick={onClose}>Done</button>
        </div>
        <div style={cat.results}>
          {results.length > 0 ? results.map((ci, i) => {
            const added = isAdded(ci.name);
            return (
              <button
                key={`${ci.name}-${i}`}
                type="button"
                style={cat.itemRow(added)}
                onClick={() => !added && onAdd(ci)}
                disabled={added}
              >
                <div style={cat.itemInfo}>
                  <span style={cat.itemName}>{ci.name}</span>
                  {ci.isContextRelevant && <span style={cat.itemMatch}>Matches this job</span>}
                  {ci.desc && <span style={cat.itemDesc}>{ci.desc}</span>}
                </div>
                <div style={cat.itemRight}>
                  <span style={cat.itemPrice}>{cur(ci.lo)}–{cur(ci.hi)}</span>
                  <span style={cat.addIcon(added)}>{added ? '✓' : '+'}</span>
                </div>
              </button>
            );
          }) : (
            <div style={cat.empty}>
              {query && query.length >= 2 ? 'No matches — try different keywords' : `Type to search ${trade?.toLowerCase() || ''} items`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════
   Main export
   ═══════════════════════════════════════════════════════ */

export default function MobileQuoteReview({ ctx }) {
  const {
    lineItems, draft, title, trade, province, country,
    selCustomer, grandTotal, totals, itemCount, confidence,
    addMode, catalogQuery, catalogResults, editingItemId,
    priceRanges, sending, saving, isLocked, error,
    customerSearch, allCustomers, customersLoading,
    showNewCust, newCust, scopeError, quoteId, description,
    setLineItems, ud, setPhase, setAddMode, setCatalogQuery,
    addCatalogItem, markDirty, genLineItemId, updateItem,
    adjustQty, removeItem, setEditingItemId, handleSend,
    save, setCustomerSearch, setShowNewCust, setNewCust,
    handleQuickCreateCustomer, searchCustomers,
    trackQuoteFlowCustomerSelected, setLocalCustomers,
    invalidateCustomers, setScopeError, setError, setTitle,
    showSend, setShowSend, handleConfirmSend,
    smsBody, setSmsBody, deliveryMethod, setDeliveryMethod,
    SmsComposerField,
    toast, currency: currencyFn,
  } = ctx;

  const cur = (v) => (currencyFn || currency)(v, country);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [confOpen, setConfOpen] = useState(false);

  return (
    <>
      <div style={layout.page}>
        {/* ── Back link ── */}
        <div style={layout.backRow} onClick={() => setPhase('describe')}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>←</span>
          <span>Edit job details</span>
          <span style={layout.tradeBadge}>{trade}</span>
        </div>

        {/* ── Header ── */}
        <div style={layout.headerWrap}>
          <input
            style={hdr.titleInput}
            value={title || draft.title || ''}
            onChange={e => { if (typeof setTitle === 'function') setTitle(e.target.value); ud('title', e.target.value); }}
            placeholder="Job title"
          />
          <div style={hdr.custRow}>
            {selCustomer ? (
              <>
                <div style={hdr.custPill}>
                  <span style={hdr.custAvatar}>{selCustomer.name?.[0]?.toUpperCase() || '?'}</span>
                  {selCustomer.name}
                </div>
                <button style={hdr.custChangeBtn} type="button" onClick={() => { ud('customer_id', ''); setCustomerSearch(''); }}>Change</button>
              </>
            ) : (
              <div style={{ width: '100%' }}>
                <input
                  style={hdr.custSearch}
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  placeholder="Search or add customer…"
                  autoComplete="off"
                />
                {customerSearch.trim() && (() => {
                  const matches = searchCustomers(allCustomers, customerSearch, 6);
                  return matches.length > 0 ? (
                    <div style={hdr.custList}>
                      {matches.map(c => (
                        <button key={c.id} style={hdr.custListItem} type="button" onClick={() => { ud('customer_id', c.id); trackQuoteFlowCustomerSelected(c.id); setCustomerSearch(''); }}>
                          <span>{c.name}</span>
                          {c.phone && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{c.phone}</span>}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button style={{ ...hdr.custListItem, marginTop: 4, color: 'var(--brand)' }} type="button" onClick={() => { setNewCust(p => ({ ...p, name: customerSearch })); setShowNewCust(true); }}>
                      + New: "{customerSearch}"
                    </button>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        <div style={layout.divider} />

        {/* ── Line Items ── */}
        <div style={layout.section}>
          <div style={layout.sectionLabel}>
            {itemCount > 0 ? `${itemCount} item${itemCount !== 1 ? 's' : ''}` : 'Line items'}
          </div>

          {lineItems.map((li, idx) => (
            <ItemCard
              key={li.id}
              li={li}
              idx={idx}
              isEditing={editingItemId === li.id}
              priceRange={priceRanges?.[li.id]}
              cur={cur}
              isLast={idx === lineItems.length - 1}
              updateItem={updateItem}
              adjustQty={adjustQty}
              removeItem={removeItem}
              setEditingItemId={setEditingItemId}
              setLineItems={setLineItems}
              markDirty={markDirty}
              genLineItemId={genLineItemId}
            />
          ))}

          {lineItems.length === 0 && (
            <div style={chr.emptyState}>
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.5 }}>📋</div>
              <strong>No items yet</strong><br />
              Search the catalog, add custom items, or ask Foreman.
            </div>
          )}
        </div>

        {/* ── Add Buttons ── */}
        <div style={addS.wrap}>
          <button style={addS.primary} type="button" onClick={() => setAddMode('catalog')}>
            🔍 Search catalog
          </button>
          <div style={addS.row}>
            <button style={addS.secondary} type="button" onClick={() => {
              setLineItems(p => [...p, { id: genLineItemId(), name: '', quantity: 1, unit_price: 0, notes: '', included: true, category: '' }]);
              markDirty();
            }}>+ Custom</button>
            <button style={addS.foreman} type="button" onClick={() => {
              if (window.__punchlistOpenForeman) {
                const jobDesc = description || title || '';
                window.__punchlistOpenForeman({
                  starters: [
                    `What else should I include for this ${trade.toLowerCase()} job?`,
                    jobDesc ? `Review my scope: "${jobDesc.slice(0, 80)}${jobDesc.length > 80 ? '…' : ''}"` : 'Help me scope this quote',
                    `What do ${trade.toLowerCase()}s commonly forget to quote?`,
                  ],
                  quoteContext: { description: jobDesc, trade, title: title || '', items: lineItems.filter(i => i.name?.trim()).map(i => ({ name: i.name, qty: i.quantity, price: i.unit_price })), total: grandTotal, province, country },
                });
              }
            }}>💬 Foreman</button>
          </div>
        </div>

        {/* ── Scope & Terms ── */}
        <div style={chr.collapse} onClick={() => setScopeOpen(!scopeOpen)}>
          <span style={chr.collapseLabel}>Scope, terms & notes</span>
          <span style={{ fontSize: 14, color: 'var(--muted)', transform: scopeOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>▸</span>
        </div>
        {scopeOpen && (
          <div style={{ padding: '0 16px 8px' }}>
            <textarea
              style={{ ...hdr.custSearch, minHeight: 60, resize: 'vertical' }}
              value={draft.scope_summary}
              onChange={e => ud('scope_summary', e.target.value)}
              rows={2}
              placeholder="Brief description of work (shown to customer)"
            />
          </div>
        )}

        {/* ── Confidence / Commonly Missed ── */}
        {lineItems.length > 0 && confidence && confidence.readiness !== 'ready' && (() => {
          const issues = (confidence.checks || []).filter(c => c.state !== 'good');
          return (
            <>
              <div
                style={{
                  ...chr.confBar,
                  background: 'var(--amber-bg, rgba(217,119,6,.07))',
                  border: '1px solid var(--amber, rgba(217,119,6,.2))',
                  borderRadius: confOpen ? '10px 10px 0 0' : 10,
                  marginBottom: confOpen ? 0 : undefined,
                }}
                onClick={() => setConfOpen(!confOpen)}
              >
                <span style={{ ...chr.confBadge, background: 'var(--amber-bg)', color: 'var(--amber-text, var(--amber))', border: '1px solid var(--amber)' }}>
                  {confidence.score}%
                </span>
                <span style={{ ...chr.confLabel, color: 'var(--amber-text, var(--amber))' }}>
                  Commonly missed items
                </span>
                <span style={{ fontSize: 12, color: 'var(--amber)', transform: confOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>▸</span>
              </div>
              {confOpen && issues.length > 0 && (
                <div style={chr.confChecks}>
                  {issues.map((c, i) => (
                    <div key={i} style={chr.confCheck}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                        background: c.state === 'warn' ? 'var(--amber)' : c.state === 'fail' ? 'var(--red)' : 'var(--muted)',
                      }} />
                      <span>{c.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        })()}
        {lineItems.length > 0 && confidence?.readiness === 'ready' && (
          <div style={{ ...chr.confBar, background: 'var(--green-bg, rgba(15,122,80,.07))', border: '1px solid var(--green-line, rgba(15,122,80,.18))' }}>
            <span style={{ fontSize: 15, color: 'var(--green)' }}>✓</span>
            <span style={{ ...chr.confLabel, color: 'var(--green)' }}>Ready to send</span>
          </div>
        )}

        {/* Error */}
        {error && error !== '__needs_phone__' && (
          <div style={chr.errorBox}>{error}</div>
        )}
      </div>

      {/* ── Sticky Footer ── */}
      <div style={chr.footer}>
        <span style={chr.footerTotal}>{cur(grandTotal)}</span>
        {itemCount === 0 ? (
          <button style={chr.footerCtaDisabled} type="button" disabled>Add items to send</button>
        ) : !draft.customer_id ? (
          <button style={chr.footerCta} type="button" disabled={sending || isLocked} onClick={() => { ctx.setDeliveryMethod?.('copy'); handleSend(); }}>
            {sending ? 'Sending…' : 'Copy Quote Link'}
          </button>
        ) : (
          <button style={chr.footerCta} type="button" disabled={sending || isLocked} onClick={handleSend}>
            {sending ? 'Sending…' : `Text to ${selCustomer?.name?.split(' ')[0] || 'customer'} →`}
          </button>
        )}
      </div>

      {/* ── Catalog Sheet ── */}
      <CatalogSheet
        open={addMode === 'catalog'}
        onClose={() => { setAddMode(null); setCatalogQuery(''); }}
        query={catalogQuery}
        onQuery={setCatalogQuery}
        results={catalogResults}
        lineItems={lineItems}
        trade={trade}
        onAdd={addCatalogItem}
        cur={cur}
      />

      {/* ── Send Bottom Sheet ── */}
      {showSend && (
        <div style={cat.backdrop} onClick={() => setShowSend(false)}>
          <div style={{ ...cat.panel, padding: '0 16px calc(16px + env(safe-area-inset-bottom, 0px))' }} onClick={e => e.stopPropagation()}>
            <div style={snd.handle} />
            <div style={snd.title}>Send Quote</div>
            {selCustomer && (
              <div style={snd.to}>
                To <strong style={{ color: 'var(--text)' }}>{selCustomer.name}</strong>{selCustomer.phone ? ` · ${selCustomer.phone}` : ''}
              </div>
            )}
            <div style={snd.summary}>
              {lineItems.filter(i => i.name?.trim()).slice(0, 3).map(i => (
                <div key={i.id} style={snd.summaryRow}>
                  <span style={snd.summaryRowName}>{i.name}</span>
                  <span style={snd.summaryRowAmount}>{cur(Number(i.quantity || 0) * Number(i.unit_price || 0))}</span>
                </div>
              ))}
              {lineItems.length > 3 && <div style={{ fontSize: 12, color: 'var(--muted)', padding: '2px 0' }}>+{lineItems.length - 3} more</div>}
              <div style={snd.summaryTotal}>
                <span>Total</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{cur(grandTotal)}</span>
              </div>
            </div>
            <div style={snd.methods}>
              {[{ v: 'text', l: '💬 Text' }, { v: 'email', l: '✉️ Email' }, { v: 'copy', l: '🔗 Copy' }].map(o => (
                <button key={o.v} type="button" onClick={() => setDeliveryMethod(o.v)} style={snd.methodBtn(deliveryMethod === o.v)}>{o.l}</button>
              ))}
            </div>
            {deliveryMethod === 'text' && SmsComposerField && (
              <div style={{ marginBottom: 14 }}>
                <SmsComposerField id="qb-sms-mobile" label="Message" value={smsBody} onChange={setSmsBody} rows={4} showLinkHint={true} />
              </div>
            )}
            {deliveryMethod === 'text' && !SmsComposerField && (
              <textarea style={{ ...hdr.custSearch, minHeight: 80, resize: 'vertical', marginBottom: 14 }} value={smsBody} onChange={e => setSmsBody(e.target.value)} placeholder="Message..." />
            )}
            <button type="button" disabled={sending || saving} onClick={handleConfirmSend} style={snd.confirmBtn(sending || saving)}>
              {sending ? 'Sending…' : saving ? 'Saving…' : deliveryMethod === 'text' ? `Text ${cur(grandTotal)} Quote` : deliveryMethod === 'email' ? `Email ${cur(grandTotal)} Quote` : 'Copy Quote Link'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
