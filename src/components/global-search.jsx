import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { listQuotes, listCustomers, listBookings, listInvoices, markInvoicePaid } from '../lib/api';
import { useAuth } from '../hooks/use-auth';
import { useTheme } from '../contexts/theme-context';
import { useToast } from './toast';
import { currency } from '../lib/format';
import { chipForStatus, toneForStatus } from '../lib/workflow';
import useScrollLock from '../hooks/use-scroll-lock';
import KeyboardShortcutsOverlay from './command-palette/keyboard-shortcuts';
import { buildAllActions, rankActions } from './command-palette/actions';

// ═══════════════════════════════════════════
// Command palette (⌘K). v100 Phase 9 — extends the former nav-only
// GlobalSearch with an action registry. Actions rank first when the
// query matches; records still searchable.
//
// Kept file name + default export to preserve imports across the app.
// ═══════════════════════════════════════════

export default function GlobalSearch() {
 const { user, signOut } = useAuth();
 const navigate = useNavigate();
 const { toggle: toggleTheme } = useTheme();
 const { show: showToast } = useToast();

 const [open, setOpen] = useState(false);
 const [shortcutsOpen, setShortcutsOpen] = useState(false);
 useScrollLock(open);

 const [query, setQuery] = useState('');
 const [debouncedQuery, setDebouncedQuery] = useState('');
 const searchTimer = useRef(null);

 const [quotes, setQuotes] = useState([]);
 const [customers, setCustomers] = useState([]);
 const [bookings, setBookings] = useState([]);
 const [invoices, setInvoices] = useState([]);

 const [focusedIdx, setFocusedIdx] = useState(0);
 const inputRef = useRef(null);
 const listRef = useRef(null);

 // g-prefix nav: track pending "g" keypress for g-then-letter sequences
 const gPendingRef = useRef(false);
 const gTimerRef = useRef(null);

 // ── Load record data when palette opens ──────────────────────────
 const loadData = useCallback(() => {
 if (!user) return;
 Promise.all([
 listQuotes(user.id),
 listCustomers(user.id),
 listBookings(user.id),
 listInvoices(user.id),
 ]).then(([q, c, b, inv]) => {
 setQuotes(q || []);
 setCustomers(c || []);
 setBookings(b || []);
 setInvoices(inv || []);
 }).catch(e => console.warn('[PL]', e));
 }, [user]);

 useEffect(() => { if (open) loadData(); }, [open, loadData]);

 useEffect(() => { setFocusedIdx(0); }, [debouncedQuery, open]);

 useEffect(() => {
 if (searchTimer.current) clearTimeout(searchTimer.current);
 searchTimer.current = setTimeout(() => setDebouncedQuery(query), 120);
 return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
 }, [query]);

 useEffect(() => {
 if (open) setTimeout(() => inputRef.current?.focus(), 50);
 else { setQuery(''); setDebouncedQuery(''); setFocusedIdx(0); }
 }, [open]);

 const close = useCallback(() => {
 setOpen(false);
 setQuery('');
 setDebouncedQuery('');
 setFocusedIdx(0);
 }, []);

 // ── Helpers injected into action.run() ───────────────────────────
 const helpers = useMemo(() => ({
 navigate,
 toast: (msg, kind) => showToast(msg, kind),
 signOut,
 toggleTheme,
 openShortcutsHelp: () => { setShortcutsOpen(true); },
 markInvoicePaid,
 refreshContext: loadData,
 }), [navigate, showToast, signOut, toggleTheme, loadData]);

 // ── Build + rank actions against current query ───────────────────
 const ctx = useMemo(() => ({ quotes, customers, bookings, invoices }), [quotes, customers, bookings, invoices]);
 const allActions = useMemo(() => buildAllActions(ctx), [ctx]);
 const rankedActions = useMemo(
 () => rankActions(debouncedQuery, allActions, debouncedQuery ? 8 : 7),
 [debouncedQuery, allActions]
 );

 // ── Record matching ──────────────────────────────────────────────
 const q = debouncedQuery.trim().toLowerCase();
 const matchedQuotes = q
 ? quotes.filter(qt =>
 [qt.title, qt.customer?.name, qt.scope_summary, qt.status]
 .some(v => String(v || '').toLowerCase().includes(q))
 ).slice(0, 4)
 : [];
 const matchedCustomers = q
 ? customers.filter(c =>
 [c.name, c.email, c.phone].some(v => String(v || '').toLowerCase().includes(q))
 ).slice(0, 3)
 : [];
 const matchedBookings = q
 ? bookings.filter(b =>
 [b.customer?.name, b.notes, b.quote?.title, b.status]
 .some(v => String(v || '').toLowerCase().includes(q))
 ).slice(0, 3)
 : [];
 const matchedInvoices = q
 ? invoices.filter(inv =>
 [inv.invoice_number, inv.customer?.name, inv.title, inv.status]
 .some(v => String(v || '').toLowerCase().includes(q))
 ).slice(0, 3)
 : [];

 // Flat list drives keyboard navigation. Screen order == keyboard order.
 const flatItems = useMemo(() => {
 const items = [];
 for (const a of rankedActions) items.push({ kind: 'action', action: a });
 for (const r of matchedQuotes) items.push({ kind: 'record', path: `/app/quotes/${r.id}`, record: r, rtype: 'quote' });
 for (const r of matchedCustomers) items.push({ kind: 'record', path: `/app/contacts?q=${encodeURIComponent(r.name)}`, record: r, rtype: 'customer' });
 for (const r of matchedBookings) items.push({ kind: 'record', path: `/app/bookings?id=${r.id}`, record: r, rtype: 'booking' });
 for (const r of matchedInvoices) items.push({ kind: 'record', path: `/app/invoices/${r.id}`, record: r, rtype: 'invoice' });
 return items;
 }, [rankedActions, matchedQuotes, matchedCustomers, matchedBookings, matchedInvoices]);

 const activate = useCallback(async (item) => {
 if (!item) return;
 if (item.kind === 'action') {
 const run = item.action.run;
 close();
 try { await run(ctx, helpers); } catch (e) { console.warn('[PL]', e); }
 return;
 }
 close();
 navigate(item.path);
 }, [ctx, helpers, navigate, close]);

 // ── Global shortcuts: ⌘K, /, ?, g-prefix navigation ──────────────
 useEffect(() => {
 function clearGPending() {
 gPendingRef.current = false;
 if (gTimerRef.current) clearTimeout(gTimerRef.current);
 gTimerRef.current = null;
 }
 function inEditable() {
 const el = document.activeElement;
 if (!el) return false;
 const tag = el.tagName;
 if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
 if (el.isContentEditable) return true;
 return false;
 }
 function onKey(e) {
 // ⌘K / Ctrl-K: always wins, even inside inputs
 if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
 e.preventDefault();
 setShortcutsOpen(false);
 setOpen(true);
 return;
 }
 // Esc: consume if a palette is up
 if (e.key === 'Escape') {
 if (shortcutsOpen) { setShortcutsOpen(false); e.preventDefault(); return; }
 if (open) { close(); e.preventDefault(); return; }
 }
 // Single-char shortcuts: only outside editable fields
 if (inEditable()) { clearGPending(); return; }
 if (e.metaKey || e.ctrlKey || e.altKey) { clearGPending(); return; }

 if (e.key === '/') {
 e.preventDefault();
 setShortcutsOpen(false);
 setOpen(true);
 return;
 }
 if (e.key === '?') {
 e.preventDefault();
 setOpen(false);
 setShortcutsOpen(true);
 return;
 }
 // g-prefix sequences
 if (gPendingRef.current) {
 const map = {
 d: '/app',
 q: '/app/quotes',
 i: '/app/invoices',
 c: '/app/contacts',
 b: '/app/bookings',
 a: '/app/analytics',
 s: '/app/settings',
 };
 const target = map[e.key];
 clearGPending();
 if (target) { e.preventDefault(); navigate(target); }
 return;
 }
 if (e.key === 'g') {
 gPendingRef.current = true;
 gTimerRef.current = setTimeout(() => { gPendingRef.current = false; }, 900);
 }
 }
 window.addEventListener('keydown', onKey);
 return () => { window.removeEventListener('keydown', onKey); clearGPending(); };
 }, [open, shortcutsOpen, navigate, close]);

 // ── Palette-local keyboard handling ──────────────────────────────
 const handleKeyDown = useCallback((e) => {
 if (!open) return;
 if (e.key === 'ArrowDown') {
 e.preventDefault();
 setFocusedIdx(i => Math.min(i + 1, flatItems.length - 1));
 } else if (e.key === 'ArrowUp') {
 e.preventDefault();
 setFocusedIdx(i => Math.max(i - 1, 0));
 } else if (e.key === 'Enter') {
 if (flatItems[focusedIdx]) {
 e.preventDefault();
 activate(flatItems[focusedIdx]);
 }
 }
 }, [open, focusedIdx, flatItems, activate]);

 useEffect(() => {
 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
 }, [handleKeyDown]);

 useEffect(() => {
 if (focusedIdx < 0) return;
 const el = listRef.current?.querySelector(`[data-idx="${focusedIdx}"]`);
 el?.scrollIntoView({ block: 'nearest' });
 }, [focusedIdx]);

 // ── Render ───────────────────────────────────────────────────────
 if (!open) {
 return (
 <>
 <button className="search-trigger" type="button" onClick={() => setOpen(true)} aria-label="Open command palette (⌘K)">
 <span className="search-trigger-icon">🔍</span>
 <span className="search-trigger-text">Search or run a command</span>
 <span className="search-trigger-hint">⌘K</span>
 </button>
 <KeyboardShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
 </>
 );
 }

 const actionItems = flatItems.filter(it => it.kind === 'action');
 const actionGroups = actionItems.reduce((acc, it) => {
 const g = it.action.group || 'Actions';
 (acc[g] ||= []).push(it);
 return acc;
 }, {});
 const idxOf = (item) => flatItems.indexOf(item);
 const hasAnyRecords = matchedQuotes.length || matchedCustomers.length || matchedBookings.length || matchedInvoices.length;
 const hasAnyActions = actionItems.length > 0;

 return (
 <>
 <div className="search-overlay" onClick={close} role="dialog" aria-modal="true" aria-label="Command palette">
 <div className="search-modal pl-cmdk-modal" onClick={e => e.stopPropagation()}>
 <div className="search-input-row">
 <span className="search-icon" aria-hidden="true">⌘</span>
 <input
 ref={inputRef}
 className="search-input"
 value={query}
 onChange={e => setQuery(e.target.value)}
 placeholder="Type a command, or search quotes, contacts, invoices…"
 aria-label="Command palette input"
 aria-controls="cmdk-results"
 aria-activedescendant={flatItems[focusedIdx] ? `cmdk-item-${focusedIdx}` : undefined}
 />
 <button className="search-esc" type="button" onClick={close}>Esc</button>
 <button className="search-close-mobile" type="button" onClick={close} aria-label="Close palette">×</button>
 </div>

 <div className="search-results" ref={listRef} id="cmdk-results" role="listbox">

 {hasAnyActions && Object.entries(actionGroups).map(([group, rows]) => (
 <div className="search-section" key={`act-${group}`}>
 <div className="search-section-label">{group}</div>
 {rows.map(it => {
 const myIdx = idxOf(it);
 const focused = focusedIdx === myIdx;
 return (
 <button
 id={`cmdk-item-${myIdx}`}
 key={it.action.id}
 className={`search-result-item pl-cmdk-action${focused ? ' focused' : ''}`}
 type="button"
 data-idx={myIdx}
 role="option"
 aria-selected={focused}
 onClick={() => activate(it)}
 onMouseEnter={() => setFocusedIdx(myIdx)}
 >
 <span className="pl-cmdk-icon" aria-hidden="true">{it.action.icon || '›'}</span>
 <span className="pl-cmdk-main">
 <span className="pl-cmdk-label">{it.action.label}</span>
 {it.action.sublabel && <span className="pl-cmdk-sublabel">{it.action.sublabel}</span>}
 </span>
 {it.action.shortcut && (
 <span className="pl-cmdk-shortcut">
 {it.action.shortcut.split(' ').map((k, i) => (
 <kbd className="pl-kbd" key={i}>{k}</kbd>
 ))}
 </span>
 )}
 </button>
 );
 })}
 </div>
 ))}

 {matchedQuotes.length > 0 && (
 <div className="search-section">
 <div className="search-section-label">Quotes</div>
 {matchedQuotes.map(qt => {
 const item = flatItems.find(it => it.kind === 'record' && it.rtype === 'quote' && it.record.id === qt.id);
 const myIdx = idxOf(item);
 const focused = focusedIdx === myIdx;
 return (
 <button
 id={`cmdk-item-${myIdx}`}
 key={qt.id}
 className={`search-result-item${focused ? ' focused' : ''}`}
 type="button"
 data-idx={myIdx}
 role="option"
 aria-selected={focused}
 onClick={() => activate(item)}
 onMouseEnter={() => setFocusedIdx(myIdx)}
 >
 <div className="search-result-main">
 <strong>{qt.title || 'Untitled quote'}</strong>
 <span className="muted small">{qt.customer?.name || 'No customer'}</span>
 </div>
 <div className="search-result-meta">
 <span className="muted small">{currency(qt.total || 0)}</span>
 <span className={`status-chip ${toneForStatus(qt.status)}`} className="gs-fs-2xs-db33">{chipForStatus(qt.status)}</span>
 </div>
 </button>
 );
 })}
 </div>
 )}

 {matchedCustomers.length > 0 && (
 <div className="search-section">
 <div className="search-section-label">Contacts</div>
 {matchedCustomers.map(c => {
 const item = flatItems.find(it => it.kind === 'record' && it.rtype === 'customer' && it.record.id === c.id);
 const myIdx = idxOf(item);
 const focused = focusedIdx === myIdx;
 return (
 <button
 id={`cmdk-item-${myIdx}`}
 key={c.id}
 className={`search-result-item${focused ? ' focused' : ''}`}
 type="button"
 data-idx={myIdx}
 role="option"
 aria-selected={focused}
 onClick={() => activate(item)}
 onMouseEnter={() => setFocusedIdx(myIdx)}
 >
 <div className="search-result-main">
 <strong>{c.name}</strong>
 <span className="muted small">{[c.email, c.phone].filter(Boolean).join(' · ')}</span>
 </div>
 </button>
 );
 })}
 </div>
 )}

 {matchedBookings.length > 0 && (
 <div className="search-section">
 <div className="search-section-label">Bookings</div>
 {matchedBookings.map(b => {
 const item = flatItems.find(it => it.kind === 'record' && it.rtype === 'booking' && it.record.id === b.id);
 const myIdx = idxOf(item);
 const focused = focusedIdx === myIdx;
 return (
 <button
 id={`cmdk-item-${myIdx}`}
 key={b.id}
 className={`search-result-item${focused ? ' focused' : ''}`}
 type="button"
 data-idx={myIdx}
 role="option"
 aria-selected={focused}
 onClick={() => activate(item)}
 onMouseEnter={() => setFocusedIdx(myIdx)}
 >
 <div className="search-result-main">
 <strong>{b.customer?.name || 'Booking'}</strong>
 <span className="muted small">{b.quote?.title || b.notes || ''}</span>
 </div>
 <div className="search-result-meta">
 <span className="muted small">{b.scheduled_for ? new Date(b.scheduled_for).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : ''}</span>
 <span className={`status-chip ${b.status === 'confirmed' ? 'approved' : b.status === 'cancelled' ? 'declined' : 'sent'}`} className="gs-fs-2xs-db33">{b.status}</span>
 </div>
 </button>
 );
 })}
 </div>
 )}

 {matchedInvoices.length > 0 && (
 <div className="search-section">
 <div className="search-section-label">Invoices</div>
 {matchedInvoices.map(inv => {
 const item = flatItems.find(it => it.kind === 'record' && it.rtype === 'invoice' && it.record.id === inv.id);
 const myIdx = idxOf(item);
 const focused = focusedIdx === myIdx;
 return (
 <button
 id={`cmdk-item-${myIdx}`}
 key={inv.id}
 className={`search-result-item${focused ? ' focused' : ''}`}
 type="button"
 data-idx={myIdx}
 role="option"
 aria-selected={focused}
 onClick={() => activate(item)}
 onMouseEnter={() => setFocusedIdx(myIdx)}
 >
 <div className="search-result-main">
 <strong>{inv.invoice_number || inv.title || 'Invoice'}</strong>
 <span className="muted small">{inv.customer?.name || ''}</span>
 </div>
 <div className="search-result-meta">
 <span className="muted small">{currency(inv.total || 0)}</span>
 <span className={`status-chip ${inv.status === 'paid' ? 'paid' : inv.status === 'overdue' ? 'overdue' : 'sent'}`} className="gs-fs-2xs-db33">{inv.status}</span>
 </div>
 </button>
 );
 })}
 </div>
 )}

 {q && !hasAnyActions && !hasAnyRecords && (
 <div className="search-empty">Nothing matches “{query}” — try a different word.</div>
 )}

 {!q && !hasAnyActions && !hasAnyRecords && (
 <div className="search-hint">Type a command — "new quote", "nudge", "settings" — or search quotes, contacts, invoices.</div>
 )}

 <div className="pl-cmdk-footer">
 <span><kbd className="pl-kbd">↑</kbd><kbd className="pl-kbd">↓</kbd> move</span>
 <span><kbd className="pl-kbd">⏎</kbd> run</span>
 <span><kbd className="pl-kbd">Esc</kbd> close</span>
 <span className="pl-cmdk-footer-help">
 <kbd className="pl-kbd">?</kbd> shortcuts
 </span>
 </div>
 </div>
 </div>
 </div>
 <KeyboardShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
 </>
 );
}
