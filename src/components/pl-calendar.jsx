import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatTimeShort } from '../lib/format';
import { isSameDay, fmtDuration as _fmtDuration } from '../lib/scheduling';

const fmtDuration = (min) => _fmtDuration(min, true);

/* ═══════════════════════════════════════════════════════════
   PlCalendar — v4: iOS-inspired calendar
   Clean day/week/month views with proper spacing,
   no text overflow, and intuitive layout
   ═══════════════════════════════════════════════════════════ */

const DOW_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DOW_TINY  = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const DOW_LETTER = ['S','M','T','W','T','F','S'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const HOUR_HEIGHT_DESKTOP = 60;
const HOUR_HEIGHT_MOBILE = 52;
const HOUR_HEIGHT = (typeof window !== 'undefined' && window.innerWidth < 768) ? HOUR_HEIGHT_MOBILE : HOUR_HEIGHT_DESKTOP;
const DAY_START = 6;
const DAY_END   = 22;
const HOURS = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);

function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0,0,0,0);
  return d;
}
function getWeekDays(anchor) {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
}
function dateKey(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function fmtHour(h) { return h === 0 ? '12a' : h === 12 ? '12p' : h > 12 ? `${h-12}p` : `${h}a`; }
function fmtMinutes(totalMin) {
  const h24 = Math.floor(totalMin / 60), m = totalMin % 60;
  const ap = h24 >= 12 ? 'PM' : 'AM', h = h24 % 12 || 12;
  return m === 0 ? `${h} ${ap}` : `${h}:${String(m).padStart(2,'0')} ${ap}`;
}
function yToSnapped(y) {
  const pxPerMin = HOUR_HEIGHT / 60;
  const snapped = Math.round(y / pxPerMin / 15) * 15;
  const clamped = Math.max(0, Math.min(snapped, (DAY_END - DAY_START) * 60 - 15));
  return { top: clamped * pxPerMin, totalMin: DAY_START * 60 + clamped };
}
function isDraggable(status) { return status === 'scheduled' || status === 'confirmed'; }
const IS_TOUCH = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

function blockPosition(scheduledFor, durationMin) {
  const d = new Date(scheduledFor);
  const startMin = d.getHours() * 60 + d.getMinutes();
  const gridStartMin = DAY_START * 60, gridEndMin = DAY_END * 60;
  const topMin = Math.max(startMin - gridStartMin, 0);
  const endMin = Math.min(startMin + (durationMin || 120), gridEndMin);
  const visibleDuration = Math.max(endMin - gridStartMin - topMin, 15);
  const pxPerMin = HOUR_HEIGHT / 60;
  return { top: topMin * pxPerMin, height: visibleDuration * pxPerMin };
}

function assignLanes(blocks) {
  if (!blocks.length) return blocks;
  const sorted = [...blocks].sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime());
  const lanes = [];
  return sorted.map(block => {
    const bStart = new Date(block.scheduled_for).getTime();
    const bEnd = bStart + (block.duration_minutes || 120) * 60000;
    let laneIdx = lanes.findIndex(l => l.endTime <= bStart);
    if (laneIdx === -1) { laneIdx = lanes.length; lanes.push({ endTime: 0 }); }
    lanes[laneIdx].endTime = bEnd;
    return { ...block, _lane: laneIdx, _totalLanes: lanes.length };
  });
}

function statusColor(status) {
  if (status === 'confirmed') return { bg: 'rgba(34,197,94,.18)', border: 'var(--green, #22C55E)' };
  if (status === 'completed') return { bg: 'rgba(142,148,156,.1)', border: 'var(--subtle, #6B7280)' };
  return { bg: 'rgba(96,165,250,.18)', border: 'var(--blue, #60A5FA)' };
}

function useSwipe(onLeft, onRight, enabled) {
  const ref = useRef({ x: 0, y: 0, t: 0 });
  return useMemo(() => {
    if (!enabled) return {};
    return {
      onTouchStart: (e) => { const t = e.touches[0]; ref.current = { x: t.clientX, y: t.clientY, t: Date.now() }; },
      onTouchEnd: (e) => {
        const t = e.changedTouches[0];
        const dx = t.clientX - ref.current.x, dy = t.clientY - ref.current.y;
        if (Date.now() - ref.current.t < 400 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          dx < 0 ? onLeft?.() : onRight?.();
        }
      },
    };
  }, [onLeft, onRight, enabled]);
}


/* ══════════════════════════════════
   MONTH VIEW
   ══════════════════════════════════ */
function MonthView({ bookings, viewDate, onSelectDate, selectedDate, onNav, onBlockClick, onSlotClick }) {
  const viewYear = viewDate.getFullYear(), viewMonth = viewDate.getMonth();
  const bookingMap = useMemo(() => {
    const m = {};
    bookings.forEach(b => { if (!b.scheduled_for) return; const d = new Date(b.scheduled_for); (m[dateKey(d)] ||= []).push(b); });
    return m;
  }, [bookings]);

  const days = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();
    const cells = [];
    for (let i = startDow - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, month: viewMonth - 1, year: viewMonth === 0 ? viewYear - 1 : viewYear, other: true });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, month: viewMonth, year: viewYear, other: false });
    const rem = 42 - cells.length;
    for (let d = 1; d <= rem; d++) cells.push({ day: d, month: viewMonth + 1, year: viewMonth === 11 ? viewYear + 1 : viewYear, other: true });
    return cells;
  }, [viewYear, viewMonth]);

  const today = new Date();
  const monthSwipe = useSwipe(() => onNav(1), () => onNav(-1), IS_TOUCH);

  return (
    <div className="pl-cal" {...monthSwipe}>
      <div className="pl-cal-header">
        <span className="pl-cal-title">{MONTHS[viewMonth]} {viewYear}</span>
        <div className="pl-cal-nav">
          <button className="pl-cal-nav-btn" type="button" onClick={() => onNav(-1)} aria-label="Previous month">‹</button>
          <button className="pl-cal-nav-btn sched-today-btn" type="button" onClick={() => onNav(0)} aria-label="Today" style={{whiteSpace:'nowrap',padding:'6px 12px'}}>Today</button>
          <button className="pl-cal-nav-btn" type="button" onClick={() => onNav(1)} aria-label="Next month">›</button>
        </div>
      </div>
      <div className="pl-cal-dow">{DOW_LETTER.map((d,i) => <div key={i} className="pl-cal-dow-label">{d}</div>)}</div>
      <div className="pl-cal-grid">
        {days.map((cell, i) => {
          const cellDate = new Date(cell.year, cell.month, cell.day);
          const isToday = isSameDay(cellDate, today);
          const isSelected = selectedDate && isSameDay(cellDate, selectedDate);
          const bHere = cell.other ? [] : (bookingMap[dateKey(cellDate)] || []);
          const activeCount = bHere.filter(b => b.status !== 'cancelled').length;
          const dots = bHere.slice(0, 3).map(b => b.status === 'completed' ? 'completed' : b.status === 'confirmed' ? 'confirmed' : 'scheduled');
          return (
            <div key={i}
              className={`pl-cal-day ${cell.other ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${activeCount > 0 ? 'has-bookings' : ''}`}
              onClick={() => !cell.other && onSelectDate?.(cellDate)}
              role={cell.other ? undefined : 'button'} tabIndex={cell.other ? -1 : 0}
              onKeyDown={e => e.key === 'Enter' && !cell.other && onSelectDate?.(cellDate)}
            >
              <span className="pl-cal-day-num">{cell.day}</span>
              {dots.length > 0 && <div className="pl-cal-dots">{dots.map((c, j) => <span key={j} className={`pl-cal-dot ${c}`} />)}</div>}
            </div>
          );
        })}
      </div>

      {selectedDate && (() => {
        const dayBookings = bookingMap[dateKey(selectedDate)] || [];
        const active = dayBookings.filter(b => b.status !== 'cancelled');
        const dayLabel = `${DOW_SHORT[selectedDate.getDay()]}, ${MONTHS_SHORT[selectedDate.getMonth()]} ${selectedDate.getDate()}`;
        return (
          <div className="pl-cal-day-cards">
            <div className="pl-cal-day-cards-header">
              <span className="pl-cal-day-cards-title">{dayLabel}</span>
              <span className="pl-cal-day-cards-count">{active.length} booking{active.length !== 1 ? 's' : ''}</span>
            </div>
            {active.length === 0 && (
              <>
                <div className="pl-cal-day-empty">No bookings</div>
                {onSlotClick && (
                  <div className="pl-cal-day-add" onClick={() => {
                    const slotDate = new Date(selectedDate);
                    slotDate.setHours(9, 0, 0, 0);
                    onSlotClick(slotDate);
                  }}>+ Add booking</div>
                )}
              </>
            )}
            {active.map(b => {
              const time = b.scheduled_for ? formatTimeShort(b.scheduled_for) : '';
              const dur = b.duration_minutes ? fmtDuration(b.duration_minutes) : '';
              const name = b.customer?.name || 'Direct booking';
              return (
                <div key={b.id} className={`pl-cal-card ${b.status === 'confirmed' ? 'sched-block-confirmed' : b.status === 'completed' ? 'sched-block-completed' : 'sched-block-scheduled'}`}
                  onClick={() => onBlockClick?.(b)} role="button" tabIndex={0}>
                  <div className="pl-cal-card-time">{time}{dur ? ` · ${dur}` : ''}</div>
                  <div className="pl-cal-card-name">{name}</div>
                  {b.quote?.title && <div className="pl-cal-card-job">{b.quote.title}</div>}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}


/* ══════════════════════════════════
   TIME GRID — Day & Week views
   ══════════════════════════════════ */
function TimeGrid({ days: dayColumns, bookings, onSlotClick, onBlockClick, onDragReschedule }) {
  const scrollRef = useRef(null);
  const columnsRef = useRef(null);
  const [nowPos, setNowPos] = useState(null);
  const today = new Date();
  const isMobileGrid = typeof window !== 'undefined' && window.innerWidth < 768;
  const gutterW = isMobileGrid ? 40 : 48;
  const dragState = useRef({ active: false, booking: null, holdTimer: null, startY: 0, ghostEl: null, originCol: -1, currentCol: -1, currentTop: 0 });

  const bookingMap = useMemo(() => {
    const m = {};
    bookings.forEach(b => {
      if (!b.scheduled_for || b.status === 'cancelled') return;
      const d = new Date(b.scheduled_for);
      const dur = b.duration_minutes || 120;
      if (dur > 480) {
        const days = Math.ceil(dur / 480);
        for (let i = 0; i < days; i++) {
          const spanDay = new Date(d); spanDay.setDate(spanDay.getDate() + i);
          (m[dateKey(spanDay)] ||= []).push({ ...b, _isSpanDay: i > 0 });
        }
      } else {
        (m[dateKey(d)] ||= []).push(b);
      }
    });
    Object.keys(m).forEach(key => { m[key] = assignLanes(m[key]); });
    return m;
  }, [bookings]);

  useEffect(() => {
    function updateNow() {
      const n = new Date(), min = n.getHours() * 60 + n.getMinutes();
      if (min >= DAY_START * 60 && min <= DAY_END * 60) setNowPos((min - DAY_START * 60) * (HOUR_HEIGHT / 60));
      else setNowPos(null);
    }
    updateNow();
    const id = setInterval(updateNow, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!scrollRef.current) return;
    const h = Math.max(new Date().getHours() - 1, DAY_START);
    scrollRef.current.scrollTop = (h - DAY_START) * HOUR_HEIGHT;
  }, []);

  const handleSlotClick = useCallback((day, e) => {
    if (!onSlotClick || dragState.current.active) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const minutes = Math.round(y / (HOUR_HEIGHT / 60) / 15) * 15;
    const totalMin = DAY_START * 60 + minutes;
    const slotDate = new Date(day);
    slotDate.setHours(Math.min(Math.floor(totalMin / 60), DAY_END - 1), totalMin % 60, 0, 0);
    onSlotClick(slotDate);
  }, [onSlotClick]);

  const handleColMouseMove = useCallback((e) => {
    if (IS_TOUCH || dragState.current.active) return;
    const ghost = e.currentTarget.querySelector('.sched-ghost');
    if (!ghost) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const { top, totalMin } = yToSnapped(y);
    ghost.style.display = 'block';
    ghost.style.top = top + 'px';
    ghost.textContent = '+ ' + fmtMinutes(totalMin);
  }, []);

  const handleColMouseLeave = useCallback((e) => {
    const ghost = e.currentTarget.querySelector('.sched-ghost');
    if (ghost) ghost.style.display = 'none';
  }, []);

  const handleBlockMouseDown = useCallback((e, booking, colIdx) => {
    if (IS_TOUCH || !isDraggable(booking.status) || !onDragReschedule) return;
    e.stopPropagation(); e.preventDefault();
    const ds = dragState.current;
    ds.startY = e.clientY; ds.booking = booking; ds.originCol = colIdx; ds.currentCol = colIdx;
    ds.holdTimer = setTimeout(() => {
      ds.active = true;
      const blockEl = e.currentTarget;
      if (blockEl) blockEl.style.opacity = '0.3';
      ds.originBlockEl = blockEl;
      const ghost = document.createElement('div');
      ghost.className = 'sched-drag-ghost';
      const dur = booking.duration_minutes || 120;
      ghost.style.height = Math.max(dur * (HOUR_HEIGHT / 60), 20) + 'px';
      ghost.innerHTML = `<span class="sched-drag-ghost-name">${booking.customer?.name || 'Booking'}</span>`;
      const colsEl = columnsRef.current;
      if (colsEl) { colsEl.style.position = 'relative'; colsEl.appendChild(ghost); }
      ds.ghostEl = ghost;
      const { top } = blockPosition(booking.scheduled_for, dur);
      const colEls = colsEl?.children;
      if (colEls?.[colIdx]) { const colW = colEls[colIdx].offsetWidth; ghost.style.left = (colIdx * colW + 2) + 'px'; ghost.style.width = (colW - 4) + 'px'; }
      ghost.style.top = top + 'px'; ds.currentTop = top;
    }, 200);

    function onMouseMove(ev) {
      const ds2 = dragState.current;
      if (!ds2.active || !ds2.ghostEl || !columnsRef.current) return;
      const colsEl = columnsRef.current;
      const colEls = Array.from(colsEl.children).filter(el => el.classList.contains('sched-col'));
      if (!colEls.length) return;
      const mouseX = ev.clientX - colsEl.getBoundingClientRect().left;
      const colW = colEls[0].offsetWidth;
      let newCol = Math.max(0, Math.min(Math.floor(mouseX / colW), colEls.length - 1));
      ds2.currentCol = newCol;
      const { top } = yToSnapped(ev.clientY - colEls[newCol].getBoundingClientRect().top);
      ds2.currentTop = top;
      ds2.ghostEl.style.top = top + 'px'; ds2.ghostEl.style.left = (newCol * colW + 2) + 'px'; ds2.ghostEl.style.width = (colW - 4) + 'px';
    }

    function onMouseUp() {
      const ds2 = dragState.current;
      clearTimeout(ds2.holdTimer);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (ds2.originBlockEl) ds2.originBlockEl.style.opacity = '';
      if (ds2.ghostEl) ds2.ghostEl.remove();
      if (ds2.active && ds2.booking) {
        const targetDay = dayColumns[ds2.currentCol];
        if (targetDay) {
          const pxPerMin = HOUR_HEIGHT / 60;
          const snappedMin = Math.round(ds2.currentTop / pxPerMin / 15) * 15;
          const totalMinFinal = DAY_START * 60 + snappedMin;
          const newDate = new Date(targetDay);
          newDate.setHours(Math.floor(totalMinFinal / 60), totalMinFinal % 60, 0, 0);
          onDragReschedule(ds2.booking, newDate);
        }
      }
      ds2.active = false; ds2.booking = null; ds2.ghostEl = null; ds2.originBlockEl = null;
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [dayColumns, onDragReschedule]);

  const totalHeight = HOURS.length * HOUR_HEIGHT;
  const isMultiCol = dayColumns.length > 1;

  return (
    <div className="sched-grid-wrap">
      {/* Column headers */}
      <div className={`sched-day-headers ${isMultiCol ? '' : 'sched-single-col'}`} style={isMultiCol ? { gridTemplateColumns: `${gutterW}px repeat(${dayColumns.length}, 1fr)` } : { gridTemplateColumns: `${gutterW}px 1fr` }}>
        <div className="sched-gutter-header" />
        {dayColumns.map((day, i) => {
          const isToday = isSameDay(day, today);
          const dayCount = (bookingMap[dateKey(day)] || []).filter(b => b.status !== 'completed').length;
          return (
            <div key={i} className={`sched-day-header ${isToday ? 'sched-today-header' : ''}`}>
              <span className="sched-dow">{isMobileGrid && dayColumns.length > 3 ? DOW_LETTER[day.getDay()] : DOW_SHORT[day.getDay()].toUpperCase()}</span>
              <span className={`sched-day-num ${isToday ? 'sched-today-num' : ''}`}>{day.getDate()}</span>
              {isMultiCol && dayCount > 0 && <span className="sched-day-count">{dayCount}</span>}
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div className="sched-grid-scroll" ref={scrollRef}>
        <div className="sched-grid" style={{ height: totalHeight }}>
          <div className="sched-gutter" style={{ width: gutterW }}>
            {HOURS.map(h => <div key={h} className="sched-hour-label" style={{ top: (h - DAY_START) * HOUR_HEIGHT }}>{fmtHour(h)}</div>)}
          </div>
          <div className={`sched-columns ${isMultiCol ? '' : 'sched-single-col'}`} ref={columnsRef} style={isMultiCol ? { gridTemplateColumns: `repeat(${dayColumns.length}, 1fr)` } : undefined}>
            {(() => { let emptyHintShown = false; return dayColumns.map((day, colIdx) => {
              const key = dateKey(day);
              const dayBookings = bookingMap[key] || [];
              const isToday = isSameDay(day, today);
              const showEmptyHint = dayBookings.length === 0 && !emptyHintShown;
              if (showEmptyHint) emptyHintShown = true;
              return (
                <div key={colIdx} className={`sched-col ${isToday ? 'sched-col-today' : ''}`}
                  onClick={(e) => handleSlotClick(day, e)} onMouseMove={handleColMouseMove} onMouseLeave={handleColMouseLeave}>
                  {HOURS.map(h => <div key={h} className="sched-hour-line" style={{ top: (h - DAY_START) * HOUR_HEIGHT }} />)}
                  {HOURS.map(h => <div key={`hf${h}`} className="sched-half-line" style={{ top: (h - DAY_START) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />)}
                  {isToday && nowPos !== null && <div className="sched-now-line" style={{ top: nowPos }}><div className="sched-now-dot" /></div>}
                  {showEmptyHint && <div className="sched-empty-hint" style={{ top: (9 - DAY_START) * HOUR_HEIGHT + 12 }}>Tap to schedule</div>}
                  <div className="sched-ghost" style={{ display: 'none' }} />
                  {dayBookings.map(b => {
                    const { top, height } = blockPosition(b.scheduled_for, b.duration_minutes);
                    const isCompact = height < 40;
                    const isTiny = height < 25;
                    const blockHeight = Math.max(height, 22);
                    const maxLanes = Math.max(...dayBookings.map(x => x._totalLanes || 1), 1);
                    const laneWidth = 100 / maxLanes, laneLeft = (b._lane || 0) * laneWidth;
                    const { bg, border } = statusColor(b.status);
                    const name = b.customer?.name || 'Direct booking';
                    const timeLabel = formatTimeShort(b.scheduled_for);
                    return (
                      <div key={b.id}
                        className={`sched-block ${isDraggable(b.status) && !IS_TOUCH ? 'sched-block-draggable' : ''}`}
                        style={{ top, height: blockHeight, left: `calc(${laneLeft}% + 2px)`, width: `calc(${laneWidth}% - 4px)`, background: bg, borderLeft: `3px solid ${border}` }}
                        onClick={(e) => { e.stopPropagation(); onBlockClick?.(b); }}
                        onMouseDown={(e) => handleBlockMouseDown(e, b, colIdx)}
                        title={`${name} — ${b.quote?.title || ''} ${timeLabel}`}
                      >
                        <div className="sched-block-row1">
                          <span className="sched-block-name">{name}</span>
                          {b.assigned_to && <span className="sched-block-signal sched-signal-crew" title={`Assigned: ${b.assigned_to}`}>{b.assigned_to.slice(0, 2)}</span>}
                        </div>
                        {!isTiny && b.quote?.title && <span className="sched-block-job">{b.quote.title}</span>}
                        {!isCompact && (
                          <span className="sched-block-time">
                            {timeLabel} · {fmtDuration(b.duration_minutes || 120)}
                          </span>
                        )}
                        {!isMultiCol && b.customer?.address && blockHeight >= 50 && (
                          <a className="sched-block-mappin"
                            href={(/iPad|iPhone|iPod/.test(navigator.userAgent) ? 'maps://?daddr=' : 'https://maps.google.com/?daddr=') + encodeURIComponent(b.customer.address)}
                            target="_blank" rel="noopener noreferrer" title="Get directions"
                            onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>📍</a>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            }); })()}
          </div>
        </div>
      </div>
    </div>
  );
}


/* ══════════════════════════════════
   MAIN EXPORT — PlCalendar
   ══════════════════════════════════ */
export default function PlCalendar({ bookings = [], view, viewDate, onViewChange, onViewDateChange, onSlotClick, onBlockClick, onDragReschedule, selectedDate, onSelectDate }) {

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function navWeek(dir) {
    if (dir === 0) { onViewDateChange(new Date()); return; }
    const step = isMobile ? 1 : 7;
    const d = new Date(viewDate); d.setDate(d.getDate() + dir * step); onViewDateChange(d);
  }
  function navDay(dir) {
    if (dir === 0) { onViewDateChange(new Date()); return; }
    const d = new Date(viewDate); d.setDate(d.getDate() + dir); onViewDateChange(d);
  }
  function navMonth(dir) {
    if (dir === 0) { onViewDateChange(new Date()); return; }
    const d = new Date(viewDate); d.setMonth(d.getMonth() + dir); onViewDateChange(d);
  }

  const swipeLeft = useCallback(() => { view === 'day' ? navDay(1) : view === 'week' ? navWeek(1) : navMonth(1); }, [view, viewDate, isMobile]);
  const swipeRight = useCallback(() => { view === 'day' ? navDay(-1) : view === 'week' ? navWeek(-1) : navMonth(-1); }, [view, viewDate, isMobile]);
  const swipeHandlers = useSwipe(swipeLeft, swipeRight, IS_TOUCH && view !== 'month');

  const viewPills = (
    <div className="sched-view-pills">
      {['day','week','month'].map(v => (
        <button key={v} type="button" className={`sched-pill ${view === v ? 'active' : ''}`} onClick={() => onViewChange(v)}>
          {v === 'day' ? 'Day' : v === 'week' ? 'Week' : 'Month'}
        </button>
      ))}
    </div>
  );

  if (view === 'week') {
    let displayDays;
    let monthLabel;
    // Always show full 7-day week — on mobile with narrower columns + horizontal scroll
    displayDays = getWeekDays(viewDate);
    const ws = displayDays[0], we = displayDays[6];
    monthLabel = ws.getMonth() === we.getMonth()
      ? `${MONTHS[ws.getMonth()]} ${ws.getFullYear()}`
      : `${MONTHS_SHORT[ws.getMonth()]} – ${MONTHS_SHORT[we.getMonth()]} ${we.getFullYear()}`;
    return (
      <div className="sched-container" {...swipeHandlers}>
        <div className="sched-toolbar">
          <div className="sched-toolbar-left">{viewPills}<span className="sched-title">{monthLabel}</span></div>
          <div className="sched-toolbar-right">
            <button className="pl-cal-nav-btn" type="button" onClick={() => navWeek(-1)} aria-label="Previous">‹</button>
            <button className="pl-cal-nav-btn sched-today-btn" type="button" onClick={() => navWeek(0)}>Today</button>
            <button className="pl-cal-nav-btn" type="button" onClick={() => navWeek(1)} aria-label="Next">›</button>
          </div>
        </div>
        <TimeGrid days={displayDays} bookings={bookings} onSlotClick={onSlotClick} onBlockClick={onBlockClick} onDragReschedule={onDragReschedule} />
      </div>
    );
  }

  if (view === 'day') {
    const dayLabel = `${DOW_SHORT[viewDate.getDay()]}, ${MONTHS_SHORT[viewDate.getMonth()]} ${viewDate.getDate()}`;
    return (
      <div className="sched-container" {...swipeHandlers}>
        <div className="sched-toolbar">
          <div className="sched-toolbar-left">{viewPills}<span className="sched-title">{dayLabel}</span></div>
          <div className="sched-toolbar-right">
            <button className="pl-cal-nav-btn" type="button" onClick={() => navDay(-1)} aria-label="Previous day">‹</button>
            <button className="pl-cal-nav-btn sched-today-btn" type="button" onClick={() => navDay(0)}>Today</button>
            <button className="pl-cal-nav-btn" type="button" onClick={() => navDay(1)} aria-label="Next day">›</button>
          </div>
        </div>
        <TimeGrid days={[viewDate]} bookings={bookings} onSlotClick={onSlotClick} onBlockClick={onBlockClick} onDragReschedule={onDragReschedule} />
      </div>
    );
  }

  return (
    <div className="sched-container">
      <div className="sched-toolbar"><div className="sched-toolbar-left">{viewPills}</div></div>
      <MonthView bookings={bookings} viewDate={viewDate} onSelectDate={onSelectDate} selectedDate={selectedDate} onNav={navMonth} onBlockClick={onBlockClick} onSlotClick={onSlotClick} />
    </div>
  );
}
