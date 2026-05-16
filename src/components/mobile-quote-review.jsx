/**
 * MobileQuoteReview — Premium quote editor for mobile.
 *
 * Design: Refined Warmth — Stripe Dashboard meets Apple Wallet.
 * - Borderless cards with warm shadow depth
 * - Typography-driven hierarchy
 * - Brand orange reserved for CTAs only
 * - Tabular numbers everywhere prices appear
 * - 44px minimum tap targets throughout
 * - Frosted-glass footer
 *
 * Built for 375px (iPhone X) minimum. No external CSS needed.
 */
import { useState, useRef, useCallback } from 'react';
import { currency } from '../lib/format';
import { QuoteItemsEditor } from './quote-editor';

/* ═══════════════════════════════════════════════════════
   DESIGN TOKENS (inline — no external dependency)
   ═══════════════════════════════════════════════════════ */
const T = {
  shadow: '0 1px 3px rgba(28,20,12,0.04), 0 3px 10px rgba(28,20,12,0.07)',
  shadowLift: '0 2px 6px rgba(28,20,12,0.06), 0 8px 24px rgba(28,20,12,0.10)',
  radius: 14,
  radiusSm: 10,
  radiusPill: 20,
  brand: 'var(--brand, #B85128)',
  brandBg: 'var(--brand-bg, rgba(184,81,40,.06))',
  brandLine: 'var(--brand-line, rgba(184,81,40,.15))',
  text: 'var(--text, #161616)',
  text2: 'var(--text-2, #344054)',
  muted: 'var(--muted, #667085)',
  subtle: 'var(--subtle, #8A8F98)',
  panel: 'var(--panel, #fff)',
  panel2: 'var(--panel-2, #F9F9F7)',
  panel3: 'var(--panel-3, #F0EFEC)',
  bg: 'var(--bg, #F6F5F2)',
  line: 'var(--line, rgba(17,24,39,.06))',
  line2: 'var(--line-2, rgba(17,24,39,.12))',
  green: 'var(--green, #0F7A50)',
  greenBg: 'var(--green-bg, rgba(15,122,80,.06))',
  red: 'var(--red, #DC2626)',
  amber: 'var(--amber, #D97706)',
  amberBg: 'var(--amber-bg, rgba(217,119,6,.06))',
  amberText: 'var(--amber-text, #92400e)',
  tap: 'transparent',
  font: 'inherit',
  ease: 'cubic-bezier(0.32, 0.72, 0, 1)',
};

/* ═══════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════ */

const S = {
  // ── Page ──
  page: {
    display: 'flex', flexDirection: 'column',
    minHeight: '100%',
    paddingBottom: 'calc(64px + 52px + env(safe-area-inset-bottom, 0px))',
    background: T.bg,
  },

  // ── Back row ──
  back: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '12px 20px 4px',
    fontSize: 13, fontWeight: 500, color: T.text2,
    cursor: 'pointer', WebkitTapHighlightColor: T.tap,
  },
  backArrow: {
    fontSize: 18, lineHeight: 1, color: T.muted,
  },
  badge: {
    marginLeft: 'auto', flexShrink: 0,
    fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
    textTransform: 'uppercase', color: T.muted,
    background: T.panel, borderRadius: 6, padding: '3px 8px',
    boxShadow: `0 0 0 1px ${T.line}`,
  },

  // ── Header ──
  header: { padding: '4px 20px 14px' },
  title: {
    width: '100%', border: 'none', background: 'none',
    fontSize: 22, fontWeight: 800, color: T.text,
    letterSpacing: '-0.03em', padding: '6px 0 2px',
    outline: 'none', fontFamily: T.font, lineHeight: 1.2,
  },
  custRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 },
  custPill: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '6px 14px 6px 6px', borderRadius: T.radiusPill,
    background: T.panel, boxShadow: T.shadow,
    fontSize: 14, fontWeight: 600, color: T.text,
  },
  custAvatar: {
    width: 26, height: 26, borderRadius: '50%',
    background: T.brand, color: '#fff',
    display: 'grid', placeItems: 'center',
    fontSize: 11, fontWeight: 700,
  },
  custChange: {
    fontSize: 13, color: T.brand, background: 'none',
    border: 'none', cursor: 'pointer', padding: '6px 8px',
    fontFamily: T.font, fontWeight: 600,
  },
  custInput: {
    width: '100%', padding: '12px 14px', fontSize: 16,
    border: 'none', borderRadius: T.radius,
    background: T.panel, boxShadow: `inset 0 0 0 1px ${T.line2}`,
    color: T.text, outline: 'none', fontFamily: T.font, marginTop: 6,
  },
  custList: { display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 },
  custItem: {
    padding: '12px 14px', fontSize: 14, color: T.text,
    borderRadius: T.radiusSm, cursor: 'pointer', border: 'none',
    background: T.panel, textAlign: 'left', fontFamily: T.font,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    minHeight: 44, boxShadow: `0 0 0 1px ${T.line}`,
  },

  // ── Section ──
  section: { padding: '0 20px' },
  label: {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
    textTransform: 'uppercase', color: T.muted, padding: '14px 0 8px',
  },

  // ── Item Card ──
  card: {
    background: T.panel, borderRadius: T.radius,
    boxShadow: T.shadow, marginBottom: 8,
    overflow: 'hidden', position: 'relative',
    border: 'none',
  },
  cardActive: {
    background: T.panel, borderRadius: T.radius,
    boxShadow: T.shadowLift, marginBottom: 8,
    overflow: 'hidden', position: 'relative',
    border: 'none',
  },
  swipeActions: {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    width: 130, display: 'flex', zIndex: 0,
  },
  swipeCopy: {
    flex: 1, display: 'grid', placeItems: 'center',
    background: T.muted, border: 'none', color: '#fff',
    fontSize: 12, fontWeight: 600, fontFamily: T.font, cursor: 'pointer',
    flexDirection: 'column', gap: 2,
  },
  swipeDel: {
    flex: 1, display: 'grid', placeItems: 'center',
    background: T.red, border: 'none', color: '#fff',
    fontSize: 12, fontWeight: 600, fontFamily: T.font, cursor: 'pointer',
    flexDirection: 'column', gap: 2,
  },
  cardInner: {
    position: 'relative', zIndex: 1,
    background: T.panel, padding: '12px 16px',
    transition: `transform 0.28s ${T.ease}`,
    borderRadius: T.radius,
  },
  itemName: {
    width: '100%', fontSize: 16, fontWeight: 600,
    color: T.text, border: 'none', background: 'none',
    padding: '0 0 6px', outline: 'none', fontFamily: T.font,
    lineHeight: 1.35,
  },
  controlsRow: {
    display: 'flex', alignItems: 'center', gap: 0,
  },
  stepper: {
    display: 'inline-flex', alignItems: 'center',
    background: T.panel2, borderRadius: 8,
    overflow: 'hidden', flexShrink: 0,
  },
  stepBtn: {
    width: 32, height: 32, display: 'grid', placeItems: 'center',
    background: 'none', border: 'none', fontSize: 16,
    color: T.text2, cursor: 'pointer', fontFamily: T.font,
    WebkitTapHighlightColor: T.tap, fontWeight: 500,
  },
  stepVal: {
    minWidth: 22, textAlign: 'center', fontSize: 14, fontWeight: 700,
    color: T.text, fontVariantNumeric: 'tabular-nums', userSelect: 'none',
  },
  multiply: {
    padding: '0 6px', fontSize: 12, color: T.subtle,
    fontWeight: 400, flexShrink: 0,
  },
  priceArea: {
    display: 'flex', alignItems: 'center', gap: 1,
    minWidth: 0,
  },
  priceCurrency: {
    fontSize: 14, color: T.subtle, fontWeight: 500, flexShrink: 0,
  },
  priceInput: {
    width: 70, fontSize: 16, fontWeight: 600,
    fontVariantNumeric: 'tabular-nums', color: T.text,
    border: 'none', background: 'none', outline: 'none',
    fontFamily: T.font, padding: 0, textAlign: 'left',
    MozAppearance: 'textfield',
  },
  lineTotal: {
    marginLeft: 'auto', fontSize: 15, fontWeight: 700,
    color: T.text, fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap', flexShrink: 0,
  },
  hint: {
    fontSize: 12, color: T.subtle, padding: '4px 0 0',
    fontStyle: 'italic',
  },
  noteBtn: {
    fontSize: 12, color: T.subtle, background: 'none',
    border: 'none', cursor: 'pointer', padding: '6px 0 0',
    fontFamily: T.font, WebkitTapHighlightColor: T.tap,
  },
  noteInput: {
    width: '100%', fontSize: 16, padding: '8px 0 0',
    border: 'none', borderTop: `1px solid ${T.line}`,
    background: 'none', color: T.text2, outline: 'none',
    fontFamily: T.font, marginTop: 8,
  },

  // ── Empty ──
  empty: {
    padding: '40px 24px', textAlign: 'center',
    background: T.panel, borderRadius: T.radius,
    boxShadow: T.shadow,
  },
  emptyTitle: {
    fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 13, color: T.muted, lineHeight: 1.6,
  },

  // ── Add Buttons ──
  addWrap: {
    display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 20px 12px',
  },
  addPrimary: {
    padding: '13px 16px', borderRadius: T.radiusSm,
    border: 'none', background: T.brand, color: '#fff',
    fontSize: 15, fontWeight: 700, textAlign: 'center',
    cursor: 'pointer', fontFamily: T.font, minHeight: 48,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    WebkitTapHighlightColor: T.tap, boxShadow: '0 2px 8px rgba(184,81,40,0.25)',
  },
  addRow: { display: 'flex', gap: 8 },
  addSecondary: {
    flex: 1, padding: '11px 10px', borderRadius: T.radiusSm,
    border: 'none', background: T.panel,
    boxShadow: T.shadow,
    color: T.text2, fontSize: 14, fontWeight: 600,
    textAlign: 'center', cursor: 'pointer', fontFamily: T.font,
    minHeight: 44, display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    WebkitTapHighlightColor: T.tap,
  },
  addForeman: {
    flex: 1, padding: '11px 10px', borderRadius: T.radiusSm,
    border: 'none', background: T.brandBg,
    color: T.brand, fontSize: 14, fontWeight: 600,
    textAlign: 'center', cursor: 'pointer', fontFamily: T.font,
    minHeight: 44, display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    WebkitTapHighlightColor: T.tap,
  },

  // ── Scope collapse ──
  collapse: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', cursor: 'pointer', margin: '4px 20px',
    borderRadius: T.radiusSm, background: T.panel, boxShadow: T.shadow,
    minHeight: 48, WebkitTapHighlightColor: T.tap,
  },
  collapseLabel: { fontSize: 14, fontWeight: 600, color: T.text2 },
  scopeText: {
    width: '100%', padding: '12px 14px', fontSize: 16,
    border: 'none', borderRadius: T.radiusSm,
    background: T.panel, boxShadow: `inset 0 0 0 1px ${T.line2}`,
    color: T.text, outline: 'none', fontFamily: T.font,
    minHeight: 100, maxHeight: 200, resize: 'vertical', lineHeight: 1.6,
  },

  // ── Confidence ──
  confReady: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 16px', margin: '6px 20px',
    borderRadius: T.radiusSm, background: T.greenBg,
    minHeight: 44,
  },
  confBar: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 16px', margin: '6px 20px',
    borderRadius: T.radiusSm, background: T.amberBg,
    minHeight: 48, cursor: 'pointer', WebkitTapHighlightColor: T.tap,
  },
  confBadge: {
    fontSize: 13, fontWeight: 800, padding: '3px 10px',
    borderRadius: 8, fontVariantNumeric: 'tabular-nums',
    background: 'rgba(217,119,6,0.12)', color: T.amberText,
  },
  confLabel: { fontSize: 14, fontWeight: 600, flex: 1, color: T.amberText },
  confChecks: {
    margin: '0 20px 6px', padding: '10px 16px 14px',
    background: T.amberBg, borderRadius: `0 0 ${T.radiusSm}px ${T.radiusSm}px`,
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  confCheck: {
    display: 'flex', alignItems: 'center', gap: 10,
    fontSize: 13, color: T.text2,
  },

  // ── Footer ──
  footer: {
    position: 'fixed',
    bottom: 'calc(52px + env(safe-area-inset-bottom, 0px))',
    left: 0, right: 0, zIndex: 90,
    background: 'rgba(246,245,242,0.85)',
    backdropFilter: 'blur(20px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
    borderTop: `1px solid ${T.line}`,
    padding: '10px 16px', display: 'flex',
    alignItems: 'center', gap: 12, minHeight: 56,
  },
  footerTotal: {
    fontSize: 18, fontWeight: 800, color: T.text,
    fontVariantNumeric: 'tabular-nums', flexShrink: 0,
    letterSpacing: '-0.02em',
  },
  footerCta: {
    flex: 1, padding: '12px 14px', borderRadius: 12,
    background: T.brand, color: '#fff',
    fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
    fontFamily: T.font, textAlign: 'center', minHeight: 44,
    WebkitTapHighlightColor: T.tap,
    boxShadow: '0 2px 8px rgba(184,81,40,0.25)',
  },
  footerCtaOff: {
    flex: 1, padding: '12px 14px', borderRadius: 12,
    background: T.panel3, color: T.muted,
    fontSize: 15, fontWeight: 700, border: 'none',
    fontFamily: T.font, textAlign: 'center', minHeight: 44,
    cursor: 'default',
  },
  footerCtaSecondary: {
    flex: 1, padding: '12px 14px', borderRadius: 12,
    background: T.panel, color: T.text2,
    fontSize: 14, fontWeight: 600, border: `1.5px solid ${T.line2}`, cursor: 'pointer',
    fontFamily: T.font, textAlign: 'center', minHeight: 44,
    WebkitTapHighlightColor: T.tap,
  },
  error: {
    margin: '6px 20px', padding: '12px 16px', borderRadius: T.radiusSm,
    background: 'var(--red-bg, rgba(220,38,38,.06))',
    color: T.red, fontSize: 13, lineHeight: 1.5,
  },

  // ── Catalog sheet ──
  sheetBackdrop: {
    position: 'fixed', inset: 0, zIndex: 200,
    background: 'rgba(22,22,22,0.5)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
  },
  sheetPanel: {
    background: T.panel, borderRadius: '22px 22px 0 0',
    maxHeight: '90dvh', display: 'flex', flexDirection: 'column',
    overflow: 'hidden', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  },
  sheetHandle: {
    width: 40, height: 5, background: T.line2,
    borderRadius: 3, margin: '10px auto 4px',
  },
  sheetSearch: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 16px 12px',
    borderBottom: `1px solid ${T.line}`,
  },
  sheetInput: {
    flex: 1, padding: '10px 0', fontSize: 16,
    border: 'none', background: 'none', color: T.text,
    outline: 'none', fontFamily: T.font, minWidth: 0,
  },
  sheetDone: {
    fontSize: 15, fontWeight: 700, color: T.brand,
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '8px 4px', fontFamily: T.font, flexShrink: 0,
    WebkitTapHighlightColor: T.tap,
  },
  sheetClear: {
    width: 28, height: 28, borderRadius: '50%', border: 'none',
    background: T.panel3, color: T.muted, fontSize: 13,
    display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0,
  },
  sheetResults: {
    flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
  },
  catRow: (added) => ({
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px', width: '100%', textAlign: 'left',
    fontFamily: T.font, cursor: added ? 'default' : 'pointer',
    opacity: added ? 0.4 : 1, background: 'none',
    border: 'none', borderBottom: `1px solid ${T.line}`,
    WebkitTapHighlightColor: T.tap,
  }),
  catInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 },
  catName: { fontSize: 15, fontWeight: 600, color: T.text, lineHeight: 1.3 },
  catMatch: { fontSize: 11, fontWeight: 700, color: T.brand },
  catDesc: {
    fontSize: 12, color: T.muted, lineHeight: 1.4,
    overflow: 'hidden', display: '-webkit-box',
    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
  },
  catRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  catPrice: { fontSize: 13, fontWeight: 600, color: T.muted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  catAdd: (done) => ({
    width: 32, height: 32, borderRadius: '50%',
    background: done ? T.green : T.brand,
    color: '#fff', display: 'grid', placeItems: 'center',
    fontSize: 17, fontWeight: 700, flexShrink: 0,
    boxShadow: done ? 'none' : '0 2px 6px rgba(184,81,40,0.3)',
  }),
  sheetEmpty: { padding: '40px 20px', textAlign: 'center', color: T.muted, fontSize: 14 },

  // ── Send sheet ──
  sendHandle: { width: 40, height: 5, background: T.line2, borderRadius: 3, margin: '8px auto 16px' },
  sendTitle: { fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 16, letterSpacing: '-0.02em' },
  sendTo: { fontSize: 14, color: T.text2, marginBottom: 16 },
  sendSummary: { background: T.panel2, borderRadius: T.radius, padding: '14px 16px', marginBottom: 16 },
  sendRow: { display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14, color: T.text2 },
  sendRowName: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sendRowAmt: { fontVariantNumeric: 'tabular-nums', flexShrink: 0, marginLeft: 10, fontWeight: 600 },
  sendTotal: {
    display: 'flex', justifyContent: 'space-between', padding: '10px 0 0',
    borderTop: `1px solid ${T.line}`, marginTop: 8,
    fontSize: 18, fontWeight: 800, color: T.text,
  },
  sendMethods: { display: 'flex', gap: 6, marginBottom: 16 },
  sendMethod: (on) => ({
    flex: 1, padding: '11px 8px', borderRadius: T.radiusSm,
    fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: T.font,
    textAlign: 'center', minHeight: 44,
    border: on ? `2px solid ${T.brand}` : 'none',
    background: on ? T.brandBg : T.panel2,
    color: on ? T.brand : T.text2,
    WebkitTapHighlightColor: T.tap,
  }),
  sendConfirm: (off) => ({
    width: '100%', padding: '16px 18px', borderRadius: 14,
    background: off ? T.panel3 : T.brand,
    color: off ? T.muted : '#fff',
    fontSize: 17, fontWeight: 700, border: 'none',
    cursor: off ? 'default' : 'pointer', fontFamily: T.font,
    minHeight: 54, WebkitTapHighlightColor: T.tap,
    boxShadow: off ? 'none' : '0 2px 10px rgba(184,81,40,0.3)',
  }),
};

/* Chevron SVG — reusable */
const Chevron = ({ size = 18, color = T.muted, open = false }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.25s' }}><polyline points="9 18 15 12 9 6"/></svg>
);

/* ═══════════════════════════════════════════════════════
   ITEM CARD
   ═══════════════════════════════════════════════════════ */
function ItemCard({ li, idx, isEditing, priceRange, cur, isLast,
  updateItem, adjustQty, removeItem, setEditingItemId,
  setLineItems, markDirty, genLineItemId }) {

  const total = Number(li.quantity || 0) * Number(li.unit_price || 0);
  const qtyStr = Number(li.quantity).toFixed(li.quantity % 1 === 0 ? 0 : 2);
  const ref = useRef(null);
  const t = useRef({ x: 0, y: 0, on: false });
  const [swiped, setSwiped] = useState(false);
  const [noteOpen, setNoteOpen] = useState(!!li.notes?.trim());

  const onTS = useCallback(e => {
    if (swiped) return;
    const p = e.touches[0];
    t.current = { x: p.clientX, y: p.clientY, on: false };
  }, [swiped]);
  const onTM = useCallback(e => {
    const dx = e.touches[0].clientX - t.current.x;
    const dy = e.touches[0].clientY - t.current.y;
    if (!t.current.on && Math.abs(dy) > Math.abs(dx)) return;
    if (dx < -8) {
      t.current.on = true; e.preventDefault();
      if (ref.current) { ref.current.style.transform = `translateX(${Math.max(-130, dx)}px)`; ref.current.style.transition = 'none'; }
    }
  }, []);
  const onTE = useCallback(() => {
    if (!t.current.on) return;
    const el = ref.current; if (!el) return;
    const m = new DOMMatrix(getComputedStyle(el).transform);
    el.style.transition = `transform 0.28s ${T.ease}`;
    if (m.m41 < -55) { el.style.transform = 'translateX(-130px)'; setSwiped(true); }
    else el.style.transform = 'translateX(0)';
    t.current.on = false;
  }, []);
  const close = () => { if (ref.current) { ref.current.style.transition = `transform 0.28s ${T.ease}`; ref.current.style.transform = 'translateX(0)'; } setSwiped(false); };

  const price = Number(li.unit_price || 0);

  return (
    <div style={isEditing ? S.cardActive : S.card} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}>
      <div style={S.swipeActions}>
        <button type="button" style={S.swipeCopy} onClick={() => { setLineItems(p => { const n = [...p]; n.splice(idx+1,0,{...li,id:genLineItemId()}); return n; }); markDirty(); close(); }}>Copy</button>
        <button type="button" style={S.swipeDel} onClick={() => removeItem(li.id)}>Delete</button>
      </div>
      <div ref={ref} style={S.cardInner} onClick={() => swiped && close()}>
        <input style={S.itemName} value={li.name} onChange={e => updateItem(li.id, { name: e.target.value })} placeholder="Item name" onFocus={() => setEditingItemId(li.id)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && isLast) { e.preventDefault(); setLineItems(p => [...p,{id:genLineItemId(),name:'',quantity:1,unit_price:0,notes:'',included:true,category:''}]); markDirty(); }}} />
        <div style={S.controlsRow}>
          <div style={S.stepper}>
            <button type="button" style={S.stepBtn} onClick={() => adjustQty(li.id,-1)}>−</button>
            <span style={S.stepVal}>{qtyStr}</span>
            <button type="button" style={S.stepBtn} onClick={() => adjustQty(li.id,1)}>+</button>
          </div>
          <span style={S.multiply}>×</span>
          <div style={S.priceArea}>
            <span style={S.priceCurrency}>$</span>
            <input style={S.priceInput} type="number" min="0" step="1" inputMode="decimal" value={li.unit_price}
              onChange={e => updateItem(li.id, { unit_price: Math.max(0, Number(e.target.value)||0) })}
              onFocus={() => setEditingItemId(li.id)} />
          </div>
          <span style={S.lineTotal}>{cur(total)}</span>
        </div>
        {isEditing && priceRange && (() => {
          if (price === 0) return <div style={S.hint}>Typical: ${priceRange.lo}–${priceRange.hi}</div>;
          if (price < priceRange.lo * 0.6) return <div style={{...S.hint,color:T.amber}}>Below typical (${priceRange.lo}–${priceRange.hi})</div>;
          if (price > priceRange.hi * 1.8) return <div style={{...S.hint,color:T.red}}>Above typical (${priceRange.lo}–${priceRange.hi})</div>;
          return null;
        })()}
        {noteOpen || li.notes?.trim() ? (
          <input style={S.noteInput} value={li.notes||''} onChange={e => updateItem(li.id,{notes:e.target.value})} placeholder="Note (shown to customer)" />
        ) : (
          <button type="button" style={S.noteBtn} onClick={() => {setNoteOpen(true); updateItem(li.id,{notes:''});}}>+ add note</button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   CATALOG SHEET
   ═══════════════════════════════════════════════════════ */
function CatalogSheet({ open, onClose, query, onQuery, results, lineItems, trade, onAdd, cur }) {
  const panel = useRef(null); const inp = useRef(null);
  const drag = useRef({ y: 0, on: false });
  if (open && inp.current) setTimeout(() => inp.current?.focus(), 80);
  if (!open) return null;
  const added = n => lineItems.some(l => (l.name||'').toLowerCase() === n.toLowerCase());
  return (
    <div style={S.sheetBackdrop} onClick={e => { if (e.target===e.currentTarget) onClose(); }}>
      <div ref={panel} style={S.sheetPanel} onClick={e => e.stopPropagation()}
        onTouchStart={e => { const r = panel.current?.getBoundingClientRect(); if (!r||e.touches[0].clientY-r.top>50) return; drag.current={y:e.touches[0].clientY,on:true}; }}
        onTouchMove={e => { if (!drag.current.on) return; const dy=e.touches[0].clientY-drag.current.y; if (dy>0&&panel.current){panel.current.style.transform=`translateY(${dy}px)`;panel.current.style.transition='none';} }}
        onTouchEnd={() => { if (!drag.current.on) return; drag.current.on=false; if (!panel.current) return; const m=new DOMMatrix(getComputedStyle(panel.current).transform); panel.current.style.transition=`transform 0.28s ${T.ease}`; if(m.m41>120){panel.current.style.transform='translateY(100%)';setTimeout(onClose,280);}else panel.current.style.transform='translateY(0)'; }}>
        <div style={S.sheetHandle} />
        <div style={S.sheetSearch}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.subtle} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input ref={inp} style={S.sheetInput} value={query} onChange={e=>onQuery(e.target.value)} placeholder={`Search ${trade?.toLowerCase()||''} items…`} autoComplete="off" autoCorrect="off" autoFocus />
          {query && <button type="button" onClick={()=>onQuery('')} style={S.sheetClear}>✕</button>}
          <button type="button" style={S.sheetDone} onClick={onClose}>Done</button>
        </div>
        <div style={S.sheetResults}>
          {results.length > 0 ? results.map((ci,i) => { const a=added(ci.name); return (
            <button key={`${ci.name}-${i}`} type="button" style={S.catRow(a)} onClick={()=>!a&&onAdd(ci)} disabled={a}>
              <div style={S.catInfo}>
                <span style={S.catName}>{ci.name}</span>
                {ci.isContextRelevant && <span style={S.catMatch}>Matches this job</span>}
                {ci.desc && <span style={S.catDesc}>{ci.desc}</span>}
              </div>
              <div style={S.catRight}>
                <span style={S.catPrice}>{cur(ci.lo)}–{cur(ci.hi)}</span>
                <span style={S.catAdd(a)}>{a?'✓':'+'}</span>
              </div>
            </button>
          );}) : <div style={S.sheetEmpty}>{query&&query.length>=2?'No matches — try different keywords':`Type to search ${trade?.toLowerCase()||''} items`}</div>}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
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

  const cur = v => (currencyFn || currency)(v, country);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [confOpen, setConfOpen] = useState(false);

  return (
    <>
      <div style={S.page}>
        {/* ── Back ── */}
        <div style={S.back} onClick={() => setPhase('describe')}>
          <span style={S.backArrow}>‹</span>
          <span>Edit job details</span>
          <span style={S.badge}>{trade}</span>
        </div>

        {/* ── Header ── */}
        <div style={S.header}>
          <input style={S.title} value={title||draft.title||''} onChange={e => {if(typeof setTitle==='function')setTitle(e.target.value); ud('title',e.target.value);}} placeholder="Job title" />
          <div style={S.custRow}>
            {selCustomer ? (<>
              <div style={S.custPill}>
                <span style={S.custAvatar}>{selCustomer.name?.[0]?.toUpperCase()||'?'}</span>
                {selCustomer.name}
              </div>
              <button style={S.custChange} type="button" onClick={()=>{ud('customer_id','');setCustomerSearch('');}}>Change</button>
            </>) : (
              <div style={{width:'100%'}}>
                <input style={S.custInput} value={customerSearch} onChange={e=>setCustomerSearch(e.target.value)} placeholder="Search or add customer…" autoComplete="off" />
                {customerSearch.trim() && !showNewCust && (()=>{
                  const m = searchCustomers(allCustomers,customerSearch,6);
                  return m.length>0 ? (
                    <div style={S.custList}>{m.map(c=>(
                      <button key={c.id} style={S.custItem} type="button" onClick={()=>{ud('customer_id',c.id);trackQuoteFlowCustomerSelected(c.id);setCustomerSearch('');}}>
                        <span>{c.name}</span>
                        {c.phone&&<span style={{fontSize:12,color:T.muted}}>{c.phone}</span>}
                      </button>))}</div>
                  ) : (<button style={{...S.custItem,marginTop:6,color:T.brand,fontWeight:600}} type="button" onClick={()=>{setNewCust(p=>({...p,name:customerSearch}));setShowNewCust(true);}}>
                    <span>+ New: &ldquo;{customerSearch}&rdquo;</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                  </button>);
                })()}
                {/* ── New customer creation form ── */}
                {showNewCust && (
                  <div style={{marginTop:8,background:T.panel,borderRadius:T.radius,boxShadow:T.shadow,padding:16,display:'flex',flexDirection:'column',gap:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:2}}>
                      <span style={{fontSize:14,fontWeight:700,color:T.text}}>New customer</span>
                      <button type="button" style={{background:'none',border:'none',cursor:'pointer',padding:'4px',color:T.muted,fontSize:18,lineHeight:1}} onClick={()=>setShowNewCust(false)} aria-label="Cancel">&times;</button>
                    </div>
                    <input
                      style={S.custInput}
                      type="text"
                      placeholder="Full name *"
                      value={newCust.name}
                      onChange={e=>setNewCust(p=>({...p,name:e.target.value}))}
                      autoFocus
                    />
                    <input
                      style={S.custInput}
                      type="tel"
                      inputMode="tel"
                      placeholder="Phone * (quote gets texted here)"
                      value={newCust.phone}
                      onChange={e=>setNewCust(p=>({...p,phone:e.target.value}))}
                    />
                    <input
                      style={S.custInput}
                      type="email"
                      placeholder="Email (optional)"
                      value={newCust.email}
                      onChange={e=>setNewCust(p=>({...p,email:e.target.value}))}
                    />
                    <div style={{display:'flex',gap:8,marginTop:2}}>
                      <button type="button" style={{...S.footerCta,flex:1,minHeight:44,fontSize:15,padding:'12px 14px',borderRadius:T.radiusSm}} onClick={()=>handleQuickCreateCustomer()}>
                        Save &amp; continue
                      </button>
                      <button type="button" style={{flex:'0 0 auto',padding:'12px 16px',borderRadius:T.radiusSm,background:T.panel2,border:'none',color:T.text2,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:T.font,minHeight:44}} onClick={()=>setShowNewCust(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Line Items (QuoteItemsEditor v2) ── */}
        <div style={{padding:'0 16px'}}>
          <QuoteItemsEditor
            lineItems={lineItems}
            setLineItems={setLineItems}
            markDirty={markDirty}
            trade={trade}
            province={province}
            country={country}
            editingItemId={editingItemId}
            setEditingItemId={setEditingItemId}
            priceRanges={priceRanges}
            confidence={confidence}
            catalogQuery={catalogQuery}
            setCatalogQuery={setCatalogQuery}
            catalogResults={catalogResults}
            suggestions={[]}
            onAddSuggestion={() => {}}
            onDismissSuggestion={() => {}}
            hideConfidence={true}
            onOpenForeman={() => {
              if(window.__punchlistOpenForeman){const j=description||title||'';window.__punchlistOpenForeman({starters:[`What else should I include for this ${trade.toLowerCase()} job?`,j?`Review my scope: "${j.slice(0,80)}${j.length>80?'…':''}"` :'Help me scope this quote',`What do ${trade.toLowerCase()}s commonly forget to quote?`],quoteContext:{description:j,trade,title:title||'',items:lineItems.filter(i=>i.name?.trim()).map(i=>({name:i.name,qty:i.quantity,price:i.unit_price})),total:grandTotal,province,country}});}
            }}
            onRetryScopeAI={scopeError ? () => { setScopeError(false); ctx.setPhase?.('describe'); } : null}
            scopeError={scopeError}
            quoteId={quoteId}
            grandTotal={grandTotal}
            toast={toast}
          />
        </div>

        {/* ── Scope ── */}
        <div style={S.collapse} onClick={()=>setScopeOpen(!scopeOpen)}>
          <span style={S.collapseLabel}>Scope, terms & notes</span>
          <Chevron open={scopeOpen} />
        </div>
        {scopeOpen && <div style={{padding:'6px 20px 12px'}}><textarea style={S.scopeText} value={draft.scope_summary} onChange={e=>ud('scope_summary',e.target.value)} rows={4} placeholder="Brief description of work (shown to customer)" /></div>}

        {/* ── Confidence ── */}
        {lineItems.length>0 && confidence && confidence.readiness==='ready' && (
          <div style={S.confReady}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span style={{fontSize:14,fontWeight:600,color:T.green}}>Ready to send</span>
          </div>
        )}
        {lineItems.length>0 && confidence && confidence.readiness!=='ready' && (()=>{
          const issues = (confidence.checks||[]).filter(c=>c.state!=='good');
          return (<>
            <div style={{...S.confBar,borderRadius:confOpen?`${T.radiusSm}px ${T.radiusSm}px 0 0`:T.radiusSm,marginBottom:confOpen?0:undefined}} onClick={()=>setConfOpen(!confOpen)}>
              <span style={S.confBadge}>{confidence.score}%</span>
              <span style={S.confLabel}>Commonly missed items</span>
              <Chevron size={16} color={T.amberText} open={confOpen} />
            </div>
            {confOpen && issues.length>0 && (
              <div style={S.confChecks}>
                {issues.map((c,i)=>(
                  <div key={i} style={{...S.confCheck,justifyContent:'space-between'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0}}>
                      <span style={{width:7,height:7,borderRadius:'50%',flexShrink:0,background:c.state==='warn'?T.amber:c.state==='fail'?T.red:T.muted}} />
                      <span>{c.label}</span>
                    </div>
                    {/* One-click fix actions */}
                    {c.label && /no customer/i.test(c.label) && (
                      <button type="button" onClick={(e)=>{e.stopPropagation();const inp=document.querySelector('[placeholder*="Search or add customer"]');if(inp){inp.focus();inp.scrollIntoView({behavior:'smooth',block:'center'});}}} style={{flexShrink:0,fontSize:12,fontWeight:700,color:T.brand,background:'none',border:'none',cursor:'pointer',padding:'4px 8px',fontFamily:T.font}}>Add</button>
                    )}
                    {c.label && /cleanup|haul|disposal/i.test(c.label) && (
                      <button type="button" onClick={(e)=>{e.stopPropagation();setLineItems(p=>[...p,{id:genLineItemId(),name:'Site cleanup & debris removal',quantity:1,unit_price:0,notes:'',included:true,category:'services'}]);markDirty();toast?.('Added cleanup item — set your price','success');setConfOpen(false);}} style={{flexShrink:0,fontSize:12,fontWeight:700,color:T.brand,background:'none',border:'none',cursor:'pointer',padding:'4px 8px',fontFamily:T.font}}>+ Add</button>
                    )}
                    {c.label && /permit/i.test(c.label) && (
                      <button type="button" onClick={(e)=>{e.stopPropagation();setLineItems(p=>[...p,{id:genLineItemId(),name:'Permit & inspection fees',quantity:1,unit_price:0,notes:'',included:true,category:'services'}]);markDirty();toast?.('Added permit item — set your price','success');setConfOpen(false);}} style={{flexShrink:0,fontSize:12,fontWeight:700,color:T.brand,background:'none',border:'none',cursor:'pointer',padding:'4px 8px',fontFamily:T.font}}>+ Add</button>
                    )}
                  </div>
                ))}
                {/* Quick-fix all: add all missing items at once */}
                {issues.filter(c=>/cleanup|haul|disposal|permit/i.test(c.label||'')).length > 1 && (
                  <button type="button" onClick={()=>{
                    const toAdd=[];
                    issues.forEach(c=>{
                      if(/cleanup|haul|disposal/i.test(c.label||''))toAdd.push({id:genLineItemId(),name:'Site cleanup & debris removal',quantity:1,unit_price:0,notes:'',included:true,category:'services'});
                      if(/permit/i.test(c.label||''))toAdd.push({id:genLineItemId(),name:'Permit & inspection fees',quantity:1,unit_price:0,notes:'',included:true,category:'services'});
                    });
                    if(toAdd.length){setLineItems(p=>[...p,...toAdd]);markDirty();toast?.(`Added ${toAdd.length} items — set your prices`,'success');setConfOpen(false);}
                  }} style={{marginTop:6,width:'100%',padding:'10px 14px',borderRadius:8,background:'rgba(217,119,6,0.10)',border:'none',color:T.amberText,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:T.font,textAlign:'center'}}>
                    Add all missing items
                  </button>
                )}
              </div>
            )}
          </>);
        })()}

        {error && error!=='__needs_phone__' && <div style={S.error}>{error}</div>}
        {error === '__needs_phone__' && (
          <div style={{margin:'6px 20px',padding:'14px 16px',borderRadius:T.radiusSm,background:'var(--amber-bg, rgba(217,119,6,.06))',border:'1px solid rgba(217,119,6,.15)'}}>
            <div style={{fontSize:14,fontWeight:700,color:T.amberText,marginBottom:8}}>Add a phone number to send via text</div>
            <div style={{display:'flex',gap:8}}>
              <input
                style={{...S.custInput,flex:1,marginTop:0,fontSize:16}}
                type="tel"
                inputMode="tel"
                value={ctx.inlinePhone || ''}
                onChange={e => ctx.setInlinePhone?.(e.target.value)}
                placeholder="e.g. (403) 555-0100"
                autoFocus
              />
              <button type="button" style={{...S.footerCta,flex:'0 0 auto',padding:'10px 16px',fontSize:14,minHeight:44,borderRadius:T.radiusSm}} disabled={!(ctx.inlinePhone||'').trim()} onClick={async () => {
                try {
                  const cust = allCustomers.find(c => c.id === draft.customer_id);
                  if (!cust) return;
                  const { updateCustomer } = await import('../lib/api');
                  await updateCustomer(cust.id, { phone: (ctx.inlinePhone||'').trim() });
                  ctx.setLocalCustomers?.(prev => prev.map(c => c.id === cust.id ? { ...c, phone: (ctx.inlinePhone||'').trim() } : c));
                  invalidateCustomers?.();
                  ctx.setError?.('');
                  toast?.('Phone saved', 'success');
                  setTimeout(() => handleSend(), 100);
                } catch (e) { toast?.(e?.message || 'Could not save', 'error'); }
              }}>
                Save
              </button>
            </div>
            <button type="button" onClick={() => { ctx.setError?.(''); handleSend('copy'); }} style={{marginTop:8,fontSize:13,fontWeight:600,color:T.brand,background:'none',border:'none',cursor:'pointer',padding:'4px 0',fontFamily:T.font}}>
              Or copy link instead →
            </button>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={S.footer}>
        <span style={S.footerTotal}>{cur(grandTotal)}</span>
        {itemCount===0 ? (
          <button style={S.footerCtaOff} type="button" disabled>Add items to send</button>
        ) : !draft.customer_id ? (
          <div style={{flex:1,display:'flex',gap:8}}>
            <button style={{...S.footerCta,flex:2}} type="button" onClick={()=>{const inp=document.querySelector('[placeholder*="Search or add customer"]');if(inp){inp.focus();inp.scrollIntoView({behavior:'smooth',block:'center'});}}}>
              Add customer
            </button>
            <button style={S.footerCtaSecondary} type="button" disabled={sending||isLocked} onClick={()=>{handleSend('copy');}}>
              {sending?'…':'Copy link'}
            </button>
          </div>
        ) : (
          <button style={S.footerCta} type="button" disabled={sending||isLocked} onClick={handleSend}>
            {sending?'Sending…':`Send to ${selCustomer?.name?.split(' ')[0]||'customer'} →`}
          </button>
        )}
      </div>

      {/* ── Catalog ── */}
      {/* CatalogSheet now rendered inside QuoteItemsEditor */}

      {/* ── Send Sheet ── */}
      {showSend && (
        <div style={S.sheetBackdrop} onClick={()=>setShowSend(false)}>
          <div style={{...S.sheetPanel,padding:'0 20px calc(20px + env(safe-area-inset-bottom,0px))'}} onClick={e=>e.stopPropagation()}>
            <div style={S.sendHandle} />
            <div style={S.sendTitle}>Send Quote</div>
            {selCustomer && <div style={S.sendTo}>To <strong style={{color:T.text}}>{selCustomer.name}</strong>{selCustomer.phone?` · ${selCustomer.phone}`:''}</div>}
            <div style={S.sendSummary}>
              {lineItems.filter(i=>i.name?.trim()).slice(0,3).map(i=>(<div key={i.id} style={S.sendRow}><span style={S.sendRowName}>{i.name}</span><span style={S.sendRowAmt}>{cur(Number(i.quantity||0)*Number(i.unit_price||0))}</span></div>))}
              {lineItems.length>3 && <div style={{fontSize:12,color:T.muted,padding:'4px 0'}}>+{lineItems.length-3} more</div>}
              <div style={S.sendTotal}><span>Total</span><span style={{fontVariantNumeric:'tabular-nums'}}>{cur(grandTotal)}</span></div>
            </div>
            <div style={S.sendMethods}>
              {[{v:'text',l:'💬 Text'},{v:'email',l:'✉️ Email'},{v:'copy',l:'🔗 Copy'}].map(o=>(<button key={o.v} type="button" onClick={()=>setDeliveryMethod(o.v)} style={S.sendMethod(deliveryMethod===o.v)}>{o.l}</button>))}
            </div>
            {deliveryMethod==='text'&&SmsComposerField&&<div style={{marginBottom:16}}><SmsComposerField id="qb-sms-mobile" label="Message" value={smsBody} onChange={setSmsBody} rows={4} showLinkHint={true} /></div>}
            {deliveryMethod==='text'&&!SmsComposerField&&<textarea style={{...S.custInput,minHeight:80,resize:'vertical',marginBottom:16}} value={smsBody} onChange={e=>setSmsBody(e.target.value)} placeholder="Message..." />}
            <button type="button" disabled={sending||saving} onClick={handleConfirmSend} style={S.sendConfirm(sending||saving)}>
              {sending?'Sending…':saving?'Saving…':deliveryMethod==='text'?`Text ${cur(grandTotal)} Quote`:deliveryMethod==='email'?`Email ${cur(grandTotal)} Quote`:'Copy Quote Link'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
