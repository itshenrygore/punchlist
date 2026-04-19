import { useEffect, useMemo, useState, useCallback } from 'react';
import { createBooking, updateBooking, checkBookingConflicts, downloadBookingICS } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { DURATION_OPTIONS, toLocalDatetime, findAvailableSlots } from '../lib/scheduling';
import useScrollLock from '../hooks/use-scroll-lock';

/* ═══════════════════════════════════════════════════════════
 BookingDrawer — shared scheduling component
 Used by: bookings-page, dashboard-page, quote-detail-page

 Modes:
 • Create: open=true, existingBooking=null
 • Edit: open=true, existingBooking={...}
 ═══════════════════════════════════════════════════════════ */

/**
 * BookingDrawer — slide-out panel (right on desktop, bottom on mobile) for creating/editing bookings.
 *
 * Props:
 * open boolean
 * onClose () => void
 * onSave (booking) => void — called after successful create/update
 * onDelete (bookingId) => void — optional, for cancel
 * existingBooking object | null — edit mode if provided
 * preSelectedCustomer object | null — { id, name }
 * preSelectedQuote object | null — { id, title, customer_id, customer }
 * preSelectedDate string | null — datetime-local string
 * customers array
 * quotes array
 * bookings array — for conflict check
 * userId string
 * showCompleteAction boolean — show "Complete" button (default false)
 * showICSExport boolean — show ICS export (default true)
 * contextLabel string | null — "Job title · Customer" shown at top
 */
export default function BookingDrawer({
 open, onClose, onSave, onDelete,
 existingBooking = null,
 preSelectedCustomer = null,
 preSelectedQuote = null,
 preSelectedDate = null,
 customers = [],
 quotes = [],
 bookings = [],
 userId,
 showCompleteAction = false,
 showICSExport = true,
 contextLabel = null,
}) {
 /* ── Form state ── */
 const [scheduledFor, setScheduledFor] = useState('');
 const [duration, setDuration] = useState(120);
 const [customerId, setCustomerId] = useState('');
 const [quoteId, setQuoteId] = useState('');
 const [notes, setNotes] = useState('');
 const [assignedTo, setAssignedTo] = useState('');
 const [customerSearch, setCustomerSearch] = useState('');
 const [saving, setSaving] = useState(false);
 const [conflicts, setConflicts] = useState(null);
 const [suggestedSlots, setSuggestedSlots] = useState([]);
 const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
 useScrollLock(open);

 useEffect(() => {
 const onResize = () => setIsMobile(window.innerWidth < 768);
 window.addEventListener('resize', onResize);
 return () => window.removeEventListener('resize', onResize);
 }, []);

 /* ── Reset form when drawer opens/closes or context changes ── */
 useEffect(() => {
 if (!open) return;
 if (existingBooking) {
 setScheduledFor(String(existingBooking.scheduled_for || '').slice(0, 16));
 setDuration(existingBooking.duration_minutes || 120);
 setCustomerId(existingBooking.customer_id || '');
 setQuoteId(existingBooking.quote_id || '');
 setNotes(existingBooking.notes || '');
 setAssignedTo(existingBooking.assigned_to || '');
 setCustomerSearch(existingBooking.customer?.name || '');
 } else {
 setScheduledFor(preSelectedDate || '');
 setDuration(120);
 setCustomerId(preSelectedQuote?.customer_id || preSelectedCustomer?.id || '');
 setQuoteId(preSelectedQuote?.id || '');
 setNotes('');
 setAssignedTo('');
 setCustomerSearch(
 preSelectedQuote?.customer?.name || preSelectedCustomer?.name || ''
 );
 }
 setConflicts(null);
 setSuggestedSlots([]);
 setSaving(false);
 }, [open, existingBooking, preSelectedCustomer, preSelectedQuote, preSelectedDate]);

 /* ── Customer search filter ── */
 const filteredCustomers = useMemo(() => {
 if (!customerSearch.trim() || customerId) return [];
 const q = customerSearch.toLowerCase();
 return customers.filter(c => c.name?.toLowerCase().includes(q)).slice(0, 6);
 }, [customers, customerSearch, customerId]);

 /* ── Schedulable quotes for selected customer ── */
 const customerQuotes = useMemo(() => {
 if (!customerId) return [];
 const bookedQuoteIds = new Set(
 bookings.filter(b => b.status !== 'cancelled').map(b => b.quote_id).filter(Boolean)
 );
 return quotes.filter(q =>
 q.customer_id === customerId &&
 ['approved', 'approved_pending_deposit'].includes(q.status) &&
 !bookedQuoteIds.has(q.id)
 );
 }, [customerId, quotes, bookings]);

 /* ── Computed context label ── */
 const displayLabel = contextLabel || (() => {
 const qTitle = preSelectedQuote?.title || quotes.find(q => q.id === quoteId)?.title || '';
 const cName = preSelectedCustomer?.name || preSelectedQuote?.customer?.name || customers.find(c => c.id === customerId)?.name || '';
 if (qTitle && cName) return `${qTitle} · ${cName}`;
 if (qTitle) return qTitle;
 if (cName) return cName;
 return null;
 })();

 /* ── Handlers ── */
 const clearConflicts = useCallback(() => { setConflicts(null); setSuggestedSlots([]); }, []);

 const handleDateTimeChange = useCallback((val) => {
 setScheduledFor(val);
 clearConflicts();
 }, [clearConflicts]);

 const handleDurationChange = useCallback((val) => {
 setDuration(val);
 clearConflicts();
 }, [clearConflicts]);

 async function handleSave(e) {
 if (e?.preventDefault) e.preventDefault();
 if (!scheduledFor) return;

 // Conflict check — two-click override
 const detected = checkBookingConflicts(
 bookings, scheduledFor, duration,
 existingBooking?.id || null
 );
 if (detected.length > 0 && !conflicts) {
 setConflicts(detected);
 setSuggestedSlots(findAvailableSlots(
 bookings, new Date(scheduledFor), duration, 3,
 existingBooking?.id || null
 ));
 return;
 }

 clearConflicts();
 setSaving(true);
 try {
 let result;
 if (existingBooking) {
 result = await updateBooking(existingBooking.id, {
 scheduled_for: scheduledFor,
 duration_minutes: duration,
 notes,
 assigned_to: assignedTo || null,
 status: existingBooking.status || 'scheduled',
 });
 } else {
 result = await createBooking(userId, {
 customer_id: customerId || undefined,
 quote_id: quoteId || undefined,
 scheduled_for: scheduledFor,
 duration_minutes: duration,
 notes,
 assigned_to: assignedTo || null,
 status: 'scheduled',
 });
 }
 onSave?.(result);
 } catch (err) {
 // Re-throw so caller can handle toast
 throw err;
 } finally {
 setSaving(false);
 }
 }

 async function handleCancel() {
 if (!existingBooking) return;
 setSaving(true);
 try {
 const result = await updateBooking(existingBooking.id, { status: 'cancelled' });
 onDelete?.(result);
 } catch (err) {
 throw err;
 } finally {
 setSaving(false);
 }
 }

 async function handleComplete() {
 if (!existingBooking) return;
 setSaving(true);
 try {
 const result = await updateBooking(existingBooking.id, { status: 'completed' });
 onSave?.(result);
 } catch (err) {
 throw err;
 } finally {
 setSaving(false);
 }
 }

 function selectSlot(slot) {
 setScheduledFor(toLocalDatetime(slot.start));
 clearConflicts();
 }

 function selectCustomer(c) {
 setCustomerId(c.id);
 setCustomerSearch(c.name || '');
 setQuoteId('');
 }

 function clearCustomer() {
 setCustomerId('');
 setQuoteId('');
 setCustomerSearch('');
 }

 if (!open) return null;

 const isEdit = Boolean(existingBooking);
 const title = isEdit ? 'Edit Booking' : 'Schedule a Job';

 return (
 <div style={overlayStyle} onClick={onClose}>
 <div
 style={{
 ...drawerStyle,
 ...(isMobile ? drawerMobileStyle : drawerDesktopStyle),
 }}
 onClick={e => e.stopPropagation()}
 role="dialog"
 aria-modal="true"
 aria-label={title}
 >
 {/* Header */}
 <div style={headerStyle}>
 <div>
 <div className="bd-s6-a38b">{title}</div>
 {displayLabel && (
 <div className="bd-fs-xs-52f3">{displayLabel}</div>
 )}
 </div>
 <button type="button" onClick={onClose} aria-label="Close" style={closeBtnStyle}>×</button>
 </div>

 {/* Body */}
 <form style={bodyStyle} onSubmit={handleSave}>

 {/* Date & Time */}
 <div>
 <span style={labelStyle}>When *</span>
 {!scheduledFor && (
 <div className="bd-fs-xs-424f">
 Tap to pick a date and time
 </div>
 )}
 {scheduledFor && (
 <div className="bd-fs-base-2516">
 {(() => {
 try {
 const d = new Date(scheduledFor);
 if (isNaN(d)) return null;
 return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
 ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
 } catch { return null; }
 })()}
 </div>
 )}
 <input
 style={inputStyle}
 type="datetime-local"
 value={scheduledFor}
 onChange={e => handleDateTimeChange(e.target.value)}
 required
 autoFocus={!isEdit}
 />
 </div>

 {/* Duration pills */}
 <div>
 <span style={labelStyle}>Duration</span>
 <div className="bd-flex-4ca2">
 {DURATION_OPTIONS.map(d => (
 <button
 key={d.val}
 type="button"
 style={{
 ...pillStyle,
 ...(duration === d.val ? pillActiveStyle : {}),
 }}
 onClick={() => handleDurationChange(d.val)}
 >
 {d.label}
 </button>
 ))}
 </div>
 </div>

 {/* Customer search — only show when not pre-selected and not editing */}
 {!preSelectedQuote && !preSelectedCustomer && !isEdit && (
 <div>
 <span style={labelStyle}>Customer</span>
 <input
 style={inputStyle}
 type="text"
 placeholder="Search customers…"
 value={customerSearch}
 onChange={e => {
 setCustomerSearch(e.target.value);
 if (!e.target.value) clearCustomer();
 }}
 onFocus={() => {
 if (customerId) setCustomerSearch(customers.find(c => c.id === customerId)?.name || '');
 }}
 />
 {filteredCustomers.length > 0 && !customerId && (
 <div style={dropdownStyle}>
 {filteredCustomers.map(c => (
 <div key={c.id} style={dropdownItemStyle} onClick={() => selectCustomer(c)}>
 <span>{c.name}</span>
 {c.phone && <span className="bd-fs-2xs-5628">{c.phone}</span>}
 </div>
 ))}
 </div>
 )}
 {customerId && (
 <button type="button" style={clearBtnStyle} onClick={clearCustomer}>Clear</button>
 )}
 </div>
 )}

 {/* Quote link — show linkable quotes for the selected customer */}
 {!preSelectedQuote && !isEdit && customerQuotes.length > 0 && (
 <div>
 <span style={labelStyle}>Link a quote</span>
 <div className="bd-flex-a444">
 {customerQuotes.map(q => (
 <div
 key={q.id}
 style={{
 ...quoteCardStyle,
 ...(quoteId === q.id ? quoteCardActiveStyle : {}),
 }}
 onClick={() => setQuoteId(prev => prev === q.id ? '' : q.id)}
 >
 <span className="bd-fs-xs-ec86">{q.title || 'Untitled'}</span>
 <span className="bd-fs-2xs-5628">
 ${(q.total || 0).toLocaleString('en', { minimumFractionDigits: 2 })}
 </span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Notes */}
 <div>
 <span style={labelStyle}>Notes</span>
 <textarea
 className="bd-s5-e2bf"
 value={notes}
 onChange={e => setNotes(e.target.value)}
 placeholder="Access notes, parts needed…"
 />
 </div>

 {/* Crew assignment */}
 <div>
 <span style={labelStyle}>Assigned to <span className="bd-s4-e095">(optional)</span></span>
 <input
 style={inputStyle}
 value={assignedTo}
 onChange={e => setAssignedTo(e.target.value)}
 placeholder="e.g. Mike, Crew A, Self"
 />
 </div>

 {/* Conflict warning + slot suggestions */}
 {conflicts && conflicts.length > 0 && (
 <div style={conflictStyle}>
 <strong>⚠ Schedule conflict</strong>
 {conflicts.map(c => (
 <div key={c.id} className="bd-s3-f30d">
 {c.customer?.name || 'Booking'} at {formatDateTime(c.scheduled_for)} ({c.duration_minutes || 120} min)
 </div>
 ))}
 {suggestedSlots.length > 0 && (
 <div className="bd-s2-e058">
 <span className="bd-fs-2xs-5628">Available:</span>
 <div className="bd-flex-f6e0">
 {suggestedSlots.map((s, i) => (
 <button key={i} type="button" style={suggestChipStyle} onClick={() => selectSlot(s)}>
 {s.label}
 </button>
 ))}
 </div>
 </div>
 )}
 <div className="bd-fs-2xs-fb82">
 Tap "{isEdit ? 'Save' : 'Schedule'}" again to book this slot.
 </div>
 </div>
 )}

 {/* Submit button moved to sticky footer below */}

 {/* ICS export */}
 {showICSExport && isEdit && existingBooking?.status !== 'cancelled' && (
 <button type="button" style={linkBtnStyle} onClick={() => downloadBookingICS(existingBooking)}>
 Export .ics
 </button>
 )}
 </form>

 {/* Sticky footer — always visible */}
 <div className="bd-s1-6a13">
 <button
 type="button"
 disabled={saving || !scheduledFor}
 onClick={handleSave}
 style={{
 ...btnPrimaryStyle,
 padding: '14px 0',
 fontSize: 'var(--text-md)',
 fontWeight: 800,
 opacity: saving || !scheduledFor ? 0.5 : 1,
>
 {saving ? 'Saving…' : conflicts ? (isEdit ? 'Save anyway' : 'Schedule anyway') : (isEdit ? 'Save changes' : 'Schedule this job')}
 </button>
 {isEdit && (
 <div className="bd-flex-0a8a">
 {showCompleteAction && existingBooking?.status === 'scheduled' && (
 <button type="button" style={btnSecondaryStyle} disabled={saving} onClick={handleComplete}>
 ✓ Complete
 </button>
 )}
 {existingBooking?.status !== 'cancelled' && existingBooking?.status !== 'completed' && (
 <button type="button" className="bd-s0-b2f6" disabled={saving} onClick={handleCancel}>
 Cancel
 </button>
 )}
 </div>
 )}
 </div>
 </div>
 </div>
 );
}

/* ═══════════════════════════════════════
 Inline styles — Rugged Graphite
 ═══════════════════════════════════════ */

const overlayStyle = {
 position: 'fixed', inset: 0, zIndex: 300,
 background: 'rgba(0,0,0,.55)',
 display: 'flex', justifyContent: 'flex-end',
};

const drawerStyle = {
 background: 'var(--panel)',
 display: 'flex', flexDirection: 'column',
 overflow: 'hidden',
};

const drawerDesktopStyle = {
 width: 400, maxWidth: '100%', height: '100vh',
 borderLeft: '1px solid var(--line)',
};

const drawerMobileStyle = {
 width: '100%', maxHeight: '82dvh',
 borderTopLeftRadius: 16, borderTopRightRadius: 16,
 marginTop: 'auto',
 borderTop: '1px solid var(--line)',
};

const headerStyle = {
 display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
 padding: '16px 20px 12px',
 borderBottom: '1px solid var(--line)',
};

const closeBtnStyle = {
 background: 'none', border: 'none', color: 'var(--muted)',
 fontSize: 'var(--text-xl)', cursor: 'pointer', padding: '4px 8px', lineHeight: 1,
};

const bodyStyle = {
 padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14,
 overflowY: 'auto', flex: 1, WebkitOverflowScrolling: 'touch',
};

const labelStyle = {
 display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 700, textTransform: 'uppercase',
 letterSpacing: '.06em', color: 'var(--muted)', marginBottom: 4,
};

const inputStyle = {
 width: '100%', padding: '8px 10px', fontSize: 'var(--text-sm)',
 background: 'var(--panel-2)',
 border: '1px solid var(--line)',
 borderRadius: 'var(--r-sm, 6px)', color: 'var(--text)',
 outline: 'none', boxSizing: 'border-box',
};

const pillStyle = {
 padding: '5px 10px', fontSize: 'var(--text-2xs)', fontWeight: 600,
 background: 'var(--panel-2)',
 border: '1px solid var(--line)',
 borderRadius: 'var(--r-pill, 999px)', color: 'var(--text)',
 cursor: 'pointer', transition: 'all .15s',
};

const pillActiveStyle = {
 background: 'var(--brand)', color: 'var(--always-white, #fff)',
 borderColor: 'var(--brand)',
};

const dropdownStyle = {
 background: 'var(--panel-2)',
 border: '1px solid var(--line)',
 borderRadius: 'var(--r-sm, 6px)', marginTop: 4, maxHeight: 180, overflowY: 'auto',
};

const dropdownItemStyle = {
 padding: '8px 10px', fontSize: 'var(--text-xs)', cursor: 'pointer',
 display: 'flex', justifyContent: 'space-between', alignItems: 'center',
 borderBottom: '1px solid var(--line)',
 color: 'var(--text)',
};

const clearBtnStyle = {
 background: 'none', border: 'none', fontSize: 'var(--text-2xs)', color: 'var(--brand)',
 cursor: 'pointer', padding: '4px 0', marginTop: 2,
};

const quoteCardStyle = {
 padding: '8px 10px', borderRadius: 'var(--r-sm, 6px)', cursor: 'pointer',
 border: '1px solid var(--line)',
 background: 'var(--panel-2)',
 display: 'flex', justifyContent: 'space-between', alignItems: 'center',
 transition: 'border-color .15s',
};

const quoteCardActiveStyle = {
 borderColor: 'var(--brand)',
 background: 'rgba(249,115,22,.08)',
};

const conflictStyle = {
 background: 'rgba(239,68,68,.1)',
 border: '1px solid rgba(239,68,68,.3)',
 borderRadius: 'var(--r-sm, 6px)',
 padding: '10px 12px', fontSize: 'var(--text-xs)',
 color: 'var(--red, #ef4444)',
};

const suggestChipStyle = {
 padding: '4px 10px', fontSize: 'var(--text-2xs)', fontWeight: 600,
 background: 'var(--panel-2)',
 border: '1px solid var(--brand)',
 borderRadius: 'var(--r-pill, 999px)',
 color: 'var(--brand)', cursor: 'pointer',
};

const btnPrimaryStyle = {
 width: '100%', padding: '10px 0', fontSize: 'var(--text-sm)', fontWeight: 700,
 background: 'var(--brand)', color: 'var(--always-white, #fff)', border: 'none',
 borderRadius: 'var(--r-sm, 6px)', cursor: 'pointer',
 letterSpacing: '-.01em',
};

const btnSecondaryStyle = {
 flex: 1, padding: '8px 0', fontSize: 'var(--text-xs)', fontWeight: 600,
 background: 'var(--panel-2)',
 border: '1px solid var(--line)',
 borderRadius: 'var(--r-sm, 6px)', color: 'var(--text)',
 cursor: 'pointer',
};

const linkBtnStyle = {
 background: 'none', border: 'none', fontSize: 'var(--text-2xs)',
 color: 'var(--muted)', cursor: 'pointer',
 textDecoration: 'underline', padding: 0, textAlign: 'left',
};
