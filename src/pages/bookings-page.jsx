import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import AppShell from '../components/app-shell';
import PageSkeleton from '../components/page-skeleton';
import StatusBadge from '../components/status-badge';
import PlCalendar from '../components/pl-calendar';
import { createBooking, listBookings, listCustomers, listQuotes, updateBooking, checkBookingConflicts, downloadBookingICS } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../components/toast';
import { formatDateTime, currency } from '../lib/format';
import BookingDrawer from '../components/booking-drawer';
import ConfirmModal from '../components/confirm-modal';
import { isSameDay, toLocalDatetime, DURATION_OPTIONS, findAvailableSlots, getMapsUrl, fmtDuration as fmtDur } from '../lib/scheduling';
import { haptic } from '../hooks/use-mobile-ux';

/* ═══════════════════════════════════════════════════════════
   BookingsPage — v3: Premium Schedule Workspace
   Rail (Needs Scheduling) + Calendar Engine + Detail Drawer
   UX: faster booking, cleaner drawer, better mobile
   ═══════════════════════════════════════════════════════════ */

export default function BookingsPage() {
  const { user } = useAuth();
  const { show: showToast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  /* ── Core data ── */
  const [bookings, setBookings]   = useState([]);
  const [customers, setCustomers] = useState([]);
  const [quotes, setQuotes]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const skelStart = useRef(Date.now());

  /* ── View state ── */
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const [view, setView] = useState('week');
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  /* ── Needs Scheduling rail ── */
  const [railOpen, setRailOpen] = useState(!isMobile);
  const [mobileRailOpen, setMobileRailOpen] = useState(false);

  /* ── Quick-book drawer ── */
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPreCustomer, setModalPreCustomer] = useState(null);
  const [modalPreQuote, setModalPreQuote] = useState(null);
  const [modalPreDate, setModalPreDate] = useState(null);

  /* ── Detail drawer ── */
  const [drawerBooking, setDrawerBooking] = useState(null);
  const [drawerSaving, setDrawerSaving] = useState(false);

  /* ── Edit form inside drawer ── */
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ scheduled_for: '', duration_minutes: 120, status: 'scheduled', notes: '' });
  const [editConflictWarning, setEditConflictWarning] = useState(null);
  const [editSuggestedSlots, setEditSuggestedSlots] = useState([]);

  /* ── Invoice lookup ── */
  const [invoiceQuoteIds, setInvoiceQuoteIds] = useState(new Set());

  /* ── Drag conflict confirm ── */
  const [dragConfirm, setDragConfirm] = useState(null);

  /* ── Cancel booking confirm ── */
  const [cancelConfirm, setCancelConfirm] = useState(null);

  /* ── Load data ── */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([listBookings(user.id), listCustomers(user.id), listQuotes(user.id)])
      .then(([b, c, q]) => { if (!cancelled) { setBookings(b || []); setCustomers(c || []); setQuotes(q || []); } })
      .catch((e) => { console.warn('[PL]', e); })
      .finally(() => {
        if (cancelled) return;
        const elapsed = Date.now() - skelStart.current;
        const delay = Math.max(0, 200 - elapsed);
        setTimeout(() => { if (!cancelled) setLoading(false); }, delay);
      });
    supabase.from('invoices').select('id,quote_id').eq('user_id', user.id)
      .then(({ data }) => {
        if (!cancelled && data) setInvoiceQuoteIds(new Set(data.filter(i => i.quote_id).map(i => i.quote_id)));
      });
    return () => { cancelled = true; };
  }, [user]);

  /* ── Auto-open modal from search params ── */
  useEffect(() => {
    const qid = searchParams.get('quote');
    const cid = searchParams.get('customer');
    if (qid || cid) {
      const q = qid ? quotes.find(x => x.id === qid) : null;
      const c = cid ? customers.find(x => x.id === cid) : null;
      if (q) setModalPreQuote(q);
      if (c) setModalPreCustomer(c);
      setModalOpen(true);
    }
  }, [searchParams, quotes, customers]);

  /* ── Needs Scheduling: approved quotes without active bookings ── */
  const needsScheduling = useMemo(() => {
    const bookedQuoteIds = new Set(
      bookings.filter(b => b.status !== 'cancelled').map(b => b.quote_id).filter(Boolean)
    );
    const items = quotes.filter(q =>
      ['approved', 'approved_pending_deposit'].includes(q.status) && !bookedQuoteIds.has(q.id)
    );
    return items.sort((a, b) => {
      if (a.status === 'approved' && b.status !== 'approved') return -1;
      if (a.status !== 'approved' && b.status === 'approved') return 1;
      return 0;
    });
  }, [quotes, bookings]);

  /* ══════════════════════════════
     ACTIONS
     ══════════════════════════════ */

  const handleSlotClick = useCallback((slotDate) => {
    setModalPreCustomer(null);
    setModalPreQuote(null);
    setModalPreDate(toLocalDatetime(slotDate));
    setModalOpen(true);
  }, []);

  function scheduleFromRail(quote) {
    setModalPreQuote(quote);
    setModalPreCustomer(quote.customer || null);
    setModalPreDate(null);
    setModalOpen(true);
    if (isMobile) setMobileRailOpen(false);
  }

  const handleBlockClick = useCallback((booking) => {
    setDrawerBooking(booking);
    setEditMode(false);
  }, []);

  const handleDragReschedule = useCallback((booking, newDate) => {
    const conflicts = checkBookingConflicts(bookings, newDate.toISOString(), booking.duration_minutes || 120, booking.id);
    if (conflicts.length > 0) { setDragConfirm({ booking, newDate, conflicts }); return; }
    executeDragReschedule(booking, newDate);
  }, [bookings]);

  async function executeDragReschedule(booking, newDate) {
    setDragConfirm(null);
    try {
      const next = await updateBooking(booking.id, { scheduled_for: newDate.toISOString() });
      setBookings(prev => prev.map(b => b.id === booking.id ? next : b));
      const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][newDate.getDay()];
      const h = newDate.getHours(), m = newDate.getMinutes(), ap = h >= 12 ? 'p' : 'a', h12 = h % 12 || 12;
      const timeStr = m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2,'0')}${ap}`;
      showToast(`Moved to ${dayName} ${timeStr}`, 'success');
      if (drawerBooking?.id === booking.id) setDrawerBooking(next);
    } catch (err) { showToast(err?.message || 'Could not reschedule', 'error'); }
  }

  function handleBookingSaved(booking) {
    setBookings(prev => [...prev, booking].sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for)));
    setModalOpen(false);
    showToast('Booking created', 'success');
    haptic('success');
  }

  async function drawerAction(action) {
    if (!drawerBooking) return;
    setDrawerSaving(true);
    try {
      if (action === 'complete') {
        const next = await updateBooking(drawerBooking.id, { status: 'completed' });
        setBookings(prev => prev.map(b => b.id === drawerBooking.id ? next : b));
        setDrawerBooking(next);
        // Transition linked quote to 'completed' so it reflects actual job status
        if (drawerBooking.quote_id) {
          try {
            await supabase.from('quotes').update({ status: 'completed' }).eq('id', drawerBooking.quote_id).in('status', ['scheduled', 'approved', 'approved_pending_deposit']);
          } catch (e) { console.warn("[PL]", e); }
        }
        if (drawerBooking.quote_id && !invoiceQuoteIds.has(drawerBooking.quote_id)) {
          showToast('Job marked complete', 'success', { label: 'Create invoice →', onClick: () => navigate(`/app/quotes/${drawerBooking.quote_id}`) });
        } else {
          showToast('Job marked complete', 'success');
        }
      } else if (action === 'cancel') {
        const hasEmail = drawerBooking.customer?.email;
        let msg = 'Cancel this booking?';
        if (hasEmail) msg += '\n\nThe customer will be automatically notified by email.';
        setCancelConfirm(msg);
        setDrawerSaving(false);
        return;
      } else if (action === 'save-edit') {
        if (!editForm.scheduled_for) { showToast('Date required', 'error'); setDrawerSaving(false); return; }
        const editConflicts = checkBookingConflicts(bookings, editForm.scheduled_for, editForm.duration_minutes, drawerBooking.id);
        if (editConflicts.length > 0 && !editConflictWarning) {
          setEditConflictWarning(editConflicts);
          setEditSuggestedSlots(findAvailableSlots(bookings, new Date(editForm.scheduled_for), Number(editForm.duration_minutes) || 120, 3, drawerBooking.id));
          setDrawerSaving(false);
          return;
        }
        setEditConflictWarning(null); setEditSuggestedSlots([]);
        const next = await updateBooking(drawerBooking.id, {
          scheduled_for: editForm.scheduled_for,
          duration_minutes: Number(editForm.duration_minutes) || 120,
          status: editForm.status,
          notes: editForm.notes,
        });
        setBookings(prev => prev.map(b => b.id === drawerBooking.id ? next : b));
        setDrawerBooking(next);
        setEditMode(false);
        showToast('Updated', 'success');
      }
    } catch (err) { showToast(err?.message || 'Error', 'error'); }
    finally { setDrawerSaving(false); }
  }

  function openEdit() {
    if (!drawerBooking) return;
    setEditForm({
      scheduled_for: String(drawerBooking.scheduled_for || '').slice(0, 16),
      duration_minutes: drawerBooking.duration_minutes || 120,
      status: drawerBooking.status || 'scheduled',
      notes: drawerBooking.notes || '',
    });
    setEditConflictWarning(null); setEditSuggestedSlots([]);
    setEditMode(true);
  }

  function handleMonthDateClick(date) {
    setSelectedDate(date);
    setViewDate(date);
    setView('day');
  }

  async function confirmCancelBooking() {
    setCancelConfirm(null);
    if (!drawerBooking) return;
    setDrawerSaving(true);
    try {
      const next = await updateBooking(drawerBooking.id, { status: 'cancelled' });
      setBookings(prev => prev.map(b => b.id === drawerBooking.id ? next : b));
      setDrawerBooking(next);
      showToast('Booking cancelled', 'success');
    } catch (e) { showToast('Failed to cancel', 'error'); }
    finally { setDrawerSaving(false); }
  }

  /* Up Next booking for mobile day view */
  const upNextBooking = useMemo(() => {
    if (!isMobile) return null;
    const now = new Date();
    const todayBookings = bookings.filter(b => {
      if (!b.scheduled_for || b.status === 'cancelled' || b.status === 'completed') return false;
      const bd = new Date(b.scheduled_for);
      return isSameDay(bd, now) && bd.getTime() > now.getTime();
    }).sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for));
    return todayBookings[0] || null;
  }, [bookings, isMobile]);

  /* Rail items with divider */
  const hasApproved = needsScheduling.some(q => q.status === 'approved');
  const hasPending = needsScheduling.some(q => q.status === 'approved_pending_deposit');
  const showRailDivider = hasApproved && hasPending;

  function renderRailItems(items) {
    let dividerShown = false;
    return items.map(q => {
      const showDivider = showRailDivider && !dividerShown && q.status === 'approved_pending_deposit';
      if (showDivider) dividerShown = true;
      return (
        <div key={q.id}>
          {showDivider && <div className="sched-rail-divider">Awaiting deposit</div>}
          <div className="sched-rail-item" onClick={() => scheduleFromRail(q)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && scheduleFromRail(q)}>
            <div className="sched-rail-item-top">
              <span className="sched-rail-item-name">{q.customer?.name || 'No customer'}</span>
              <span className="sched-rail-item-amt">{currency(q.total || 0)}</span>
            </div>
            <div className="sched-rail-item-title">{q.title || 'Untitled'}</div>
            {q.status === 'approved_pending_deposit' && <span className="sched-deposit-badge">Deposit pending</span>}
          </div>
        </div>
      );
    });
  }

  /* ══════════════════════════════
     RENDER
     ══════════════════════════════ */
  return (
    <AppShell title="Schedule">
      {loading ? (
        <div style={{ padding: '20px 0' }}>
          <PageSkeleton variant="cards" />
        </div>
      ) : (
        <div className={`sched-layout ${railOpen && !isMobile ? 'sched-rail-open' : ''}`}>

          {/* ── NEEDS SCHEDULING RAIL (desktop) ── */}
          {!isMobile && (
            <div className={`sched-rail ${railOpen ? 'open' : 'collapsed'}`}>
              <button className="sched-rail-toggle" type="button" onClick={() => setRailOpen(r => !r)} aria-label={railOpen ? 'Collapse rail' : 'Expand rail'}>
                {railOpen ? '‹' : '›'}
              </button>
              {railOpen && (
                <>
                  <div className="sched-rail-header">
                    <span className="eyebrow">Needs scheduling</span>
                    {needsScheduling.length > 0 && <span className="sched-rail-count">{needsScheduling.length}</span>}
                  </div>
                  {needsScheduling.length === 0 ? (
                    <div className="sched-rail-empty">All caught up — no jobs waiting</div>
                  ) : (
                    <div className="sched-rail-list">
                      {renderRailItems(needsScheduling)}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── MAIN CALENDAR AREA ── */}
          <div className="sched-main">
            {/* Up Next card — mobile day view only */}
            {isMobile && view === 'day' && upNextBooking && (
              <div className="sched-upnext" onClick={() => handleBlockClick(upNextBooking)} role="button" tabIndex={0}>
                <span className="sched-upnext-label">Up next</span>
                <div className="sched-upnext-row">
                  <div className="sched-upnext-info">
                    <span className="sched-upnext-name">{upNextBooking.customer?.name || 'Direct booking'}</span>
                    <span className="sched-upnext-time">{formatDateTime(upNextBooking.scheduled_for)}</span>
                    {upNextBooking.customer?.address && (
                      <span className="sched-upnext-addr">{upNextBooking.customer.address}</span>
                    )}
                  </div>
                  {upNextBooking.customer?.address && (
                    <a className="btn btn-primary btn-sm sched-upnext-nav" href={getMapsUrl(upNextBooking.customer.address)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                      Navigate
                    </a>
                  )}
                </div>
              </div>
            )}

            <PlCalendar
              bookings={bookings}
              view={view}
              viewDate={viewDate}
              onViewChange={setView}
              onViewDateChange={setViewDate}
              onSlotClick={handleSlotClick}
              onBlockClick={handleBlockClick}
              onDragReschedule={handleDragReschedule}
              selectedDate={selectedDate}
              onSelectDate={handleMonthDateClick}
            />

            {/* Mobile: FAB for new booking + Needs Scheduling badge */}
            {isMobile && (
              <>
                <button className="sched-fab" type="button" onClick={() => handleSlotClick(new Date())} aria-label="New booking">+</button>
                {needsScheduling.length > 0 && (
                  <button className="sched-mobile-rail-btn" type="button" onClick={() => setMobileRailOpen(true)}>
                    {needsScheduling.length} to schedule
                  </button>
                )}
              </>
            )}

            {/* Desktop: "+ Schedule job" button */}
            {!isMobile && !modalOpen && !drawerBooking && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="btn btn-primary btn-sm" type="button" onClick={() => handleSlotClick(new Date())}>+ Schedule a job</button>
              </div>
            )}
          </div>

          {/* ── QUICK-BOOK via BookingDrawer ── */}
          <BookingDrawer
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onSave={handleBookingSaved}
            preSelectedCustomer={modalPreCustomer}
            preSelectedQuote={modalPreQuote}
            preSelectedDate={modalPreDate}
            customers={customers}
            quotes={quotes}
            bookings={bookings}
            userId={user.id}
            showICSExport={false}
          />

          {/* ── DETAIL DRAWER ── */}
          {drawerBooking && (
            <div className="sched-drawer-overlay" onClick={() => setDrawerBooking(null)}>
              <div className={`sched-drawer ${isMobile ? 'sched-drawer-bottom' : ''}`} onClick={e => e.stopPropagation()}>
                <div className="sched-drawer-header">
                  <div>
                    <div className="sched-drawer-name">{drawerBooking.customer?.name || 'Direct booking'}</div>
                    <div className="sched-drawer-header-meta">
                      <StatusBadge status={drawerBooking.status} />
                      {drawerBooking.customer?.email && <span className="sched-email-tag on">Notifications on</span>}
                      {drawerBooking.customer && !drawerBooking.customer.email && <span className="sched-email-tag off">No email</span>}
                    </div>
                  </div>
                  <button className="sched-modal-close" type="button" onClick={() => setDrawerBooking(null)} aria-label="Close">×</button>
                </div>

                {!editMode ? (
                  <div className="sched-drawer-body">
                    {/* Quick info grid */}
                    <div className="sched-drawer-info-grid">
                      <div className="sched-drawer-info-item">
                        <span className="sched-drawer-label">When</span>
                        <span className="sched-drawer-value">{formatDateTime(drawerBooking.scheduled_for)}</span>
                      </div>
                      <div className="sched-drawer-info-item">
                        <span className="sched-drawer-label">Duration</span>
                        <span className="sched-drawer-value">{fmtDur(drawerBooking.duration_minutes)}</span>
                      </div>
                    </div>
                    {drawerBooking.quote?.title && (
                      <div className="sched-drawer-row">
                        <span className="sched-drawer-label">Job</span>
                        <span>{drawerBooking.quote.title}</span>
                      </div>
                    )}
                    {drawerBooking.customer?.address && (
                      <div className="sched-drawer-row">
                        <span className="sched-drawer-label">Address</span>
                        <a href={getMapsUrl(drawerBooking.customer.address)} target="_blank" rel="noopener noreferrer" className="sched-drawer-link">
                          {drawerBooking.customer.address} ↗
                        </a>
                      </div>
                    )}
                    {drawerBooking.customer?.phone && (
                      <div className="sched-drawer-row">
                        <span className="sched-drawer-label">Phone</span>
                        <a href={`tel:${drawerBooking.customer.phone}`} className="sched-drawer-link">{drawerBooking.customer.phone}</a>
                      </div>
                    )}
                    {drawerBooking.notes && (
                      <div className="sched-drawer-row">
                        <span className="sched-drawer-label">Notes</span>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>{drawerBooking.notes}</span>
                      </div>
                    )}

                    {/* Deposit cue */}
                    {drawerBooking.quote?.deposit_required && drawerBooking.quote?.deposit_status !== 'paid' && (
                      <div className="sched-drawer-notice amber">Deposit pending for this quote</div>
                    )}

                    {/* Invoice CTA */}
                    {drawerBooking.status === 'completed' && drawerBooking.quote_id && !invoiceQuoteIds.has(drawerBooking.quote_id) && (
                      <Link className="sched-invoice-cta" to={`/app/quotes/${drawerBooking.quote_id}`}>
                        Create invoice for this job →
                      </Link>
                    )}

                    {/* Primary actions — prominent */}
                    <div className="sched-drawer-actions">
                      {drawerBooking.status === 'scheduled' && (
                        <button className="btn btn-primary btn-sm" type="button" disabled={drawerSaving} onClick={() => drawerAction('complete')}>✓ Complete</button>
                      )}
                      {(drawerBooking.status === 'scheduled' || drawerBooking.status === 'confirmed') && (
                        <button className="btn btn-secondary btn-sm" type="button" onClick={openEdit}>Reschedule</button>
                      )}
                      {drawerBooking.status !== 'cancelled' && drawerBooking.status !== 'completed' && (
                        <button className="btn btn-secondary btn-sm sched-btn-danger" type="button" disabled={drawerSaving} onClick={() => drawerAction('cancel')}>Cancel</button>
                      )}
                    </div>

                    {/* Secondary actions */}
                    <div className="sched-drawer-secondary">
                      {drawerBooking.status !== 'cancelled' && (
                        <button className="sched-drawer-sec-btn" type="button" onClick={() => downloadBookingICS(drawerBooking)}>Export .ics</button>
                      )}
                      {drawerBooking.quote_id && (
                        <Link className="sched-drawer-sec-btn" to={`/app/quotes/${drawerBooking.quote_id}`}>View quote</Link>
                      )}
                    </div>
                  </div>
                ) : (
                  /* ── Edit mode inside drawer ── */
                  <div className="sched-drawer-body">
                    <div>
                      <span className="field-label">Date & time</span>
                      <input className="input" type="datetime-local" value={editForm.scheduled_for} onChange={e => { setEditForm(p => ({ ...p, scheduled_for: e.target.value })); setEditConflictWarning(null); setEditSuggestedSlots([]); }} />
                    </div>
                    <div>
                      <span className="field-label">Duration</span>
                      <div className="sched-dur-pills">
                        {DURATION_OPTIONS.map(d => (
                          <button key={d.val} type="button" className={`sched-dur-pill ${editForm.duration_minutes === d.val ? 'active' : ''}`} onClick={() => setEditForm(p => ({ ...p, duration_minutes: d.val }))}>
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="field-label">Status</span>
                      <select className="input" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
                        <option value="scheduled">Scheduled</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <span className="field-label">Notes</span>
                      <textarea className="input textarea-md" value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} />
                    </div>
                    {/* Edit conflict warning with suggestion chips */}
                    {editConflictWarning && editConflictWarning.length > 0 && (
                      <div className="sched-conflict-warn">
                        <strong>Schedule conflict</strong>
                        {editConflictWarning.map(c => (
                          <div key={c.id} style={{ marginTop: 4, color: 'var(--text-2)' }}>
                            {c.customer?.name || 'Booking'} at {formatDateTime(c.scheduled_for)} ({c.duration_minutes || 120} min)
                          </div>
                        ))}
                        {editSuggestedSlots.length > 0 && (
                          <div className="sched-suggest-row">
                            <span className="sched-suggest-label">Available:</span>
                            <div className="sched-suggest-chips">
                              {editSuggestedSlots.map((s, i) => (
                                <button key={s.start?.toISOString?.() || s.label || i} type="button" className="sched-suggest-chip"
                                  onClick={() => { setEditForm(p => ({ ...p, scheduled_for: toLocalDatetime(s.start) })); setEditConflictWarning(null); setEditSuggestedSlots([]); }}
                                >{s.label}</button>
                              ))}
                            </div>
                          </div>
                        )}
                        <div style={{ marginTop: 6, fontSize: 'var(--text-2xs)', color: 'var(--muted)' }}>Tap "Save" again to keep this time.</div>
                      </div>
                    )}
                    {drawerBooking.customer?.email && (
                      <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--muted)', padding: '4px 0' }}>
                        {drawerBooking.customer.name || 'Customer'} will be emailed if you reschedule or cancel.
                      </div>
                    )}
                    <div className="sched-drawer-actions">
                      <button className="btn btn-primary btn-sm" type="button" disabled={drawerSaving} onClick={() => drawerAction('save-edit')}>{drawerSaving ? 'Saving…' : editConflictWarning ? 'Save anyway' : 'Save'}</button>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => setEditMode(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── MOBILE RAIL BOTTOM SHEET ── */}
          {isMobile && mobileRailOpen && (
            <div className="sched-modal-overlay" onClick={() => setMobileRailOpen(false)}>
              <div className="sched-drawer sched-drawer-bottom" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Needs scheduling">
                <div className="sched-drawer-header">
                  <div>
                    <span className="eyebrow">Needs scheduling</span>
                    <span className="sched-rail-count" style={{ marginLeft: 8 }}>{needsScheduling.length}</span>
                  </div>
                  <button className="sched-modal-close" type="button" onClick={() => setMobileRailOpen(false)} aria-label="Close">×</button>
                </div>
                <div className="sched-drawer-body">
                  {needsScheduling.length === 0 ? (
                    <div className="sched-rail-empty">All caught up</div>
                  ) : (
                    <div className="sched-rail-list">
                      {renderRailItems(needsScheduling)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Drag conflict confirm dialog ── */}
          {dragConfirm && (
            <div className="sched-modal-overlay" onClick={() => setDragConfirm(null)}>
              <div className="sched-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }} role="dialog" aria-modal="true" aria-label="Schedule conflict">
                <div className="sched-modal-header">
                  <h3 className="sched-modal-title">Schedule conflict</h3>
                  <button className="sched-modal-close" type="button" onClick={() => setDragConfirm(null)} aria-label="Close">×</button>
                </div>
                <div className="sched-modal-body">
                  <div className="sched-conflict-warn">
                    <strong>This time overlaps with:</strong>
                    {dragConfirm.conflicts.map(c => (
                      <div key={c.id} style={{ marginTop: 4, color: 'var(--text-2)' }}>
                        {c.customer?.name || 'Booking'} at {formatDateTime(c.scheduled_for)}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-primary btn-sm" type="button" onClick={() => executeDragReschedule(dragConfirm.booking, dragConfirm.newDate)}>Move anyway</button>
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => setDragConfirm(null)}>Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
      <ConfirmModal
        open={!!cancelConfirm}
        onConfirm={confirmCancelBooking}
        onCancel={() => setCancelConfirm(null)}
        title="Cancel Booking"
        message={cancelConfirm || ''}
        confirmLabel="Cancel Booking"
        cancelLabel="Keep"
        variant="danger"
      />
    </AppShell>
  );
}
