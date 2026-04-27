import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatTimeShort } from '../lib/format';
import { isSameDay, fmtDuration as _fmtDuration } from '../lib/scheduling';

const fmtDuration = (min) => _fmtDuration(min, true);

/* ═══════════════════════════════════════════════════════════
   PlCalendar — v5: Apple Calendar-inspired unified view
   Month grid on top, selected day's bookings below.
   Clean, minimal, no day/week/month toggle.
   ═══════════════════════════════════════════════════════════ */

const DOW_LETTER = ['S','M','T','W','T','F','S'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function dateKey(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

function statusColor(status) {
  if (status === 'confirmed') return 'var(--green, #22C55E)';
  if (status === 'completed') return 'var(--subtle, #6B7280)';
  return 'var(--brand, #F97316)';
}

function statusBg(status) {
  if (status === 'confirmed') return 'rgba(34,197,94,.10)';
  if (status === 'completed') return 'rgba(142,148,156,.08)';
  return 'rgba(249,115,22,.10)';
}

const IS_TOUCH = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

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
   MAIN EXPORT — PlCalendar (Apple-style)
   ══════════════════════════════════ */
export default function PlCalendar({ bookings = [], view, viewDate, onViewChange, onViewDateChange, onSlotClick, onBlockClick, onDragReschedule, selectedDate, onSelectDate }) {

  const today = new Date();
  const activeDate = selectedDate || today;
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const bookingMap = useMemo(() => {
    const m = {};
    bookings.forEach(b => {
      if (!b.scheduled_for) return;
      const d = new Date(b.scheduled_for);
      (m[dateKey(d)] ||= []).push(b);
    });
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
    if (rem > 0 && rem < 7) for (let d = 1; d <= rem; d++) cells.push({ day: d, month: viewMonth + 1, year: viewMonth === 11 ? viewYear + 1 : viewYear, other: true });
    else if (rem >= 7 && cells.length <= 35) for (let d = 1; d <= (35 - cells.length + rem > 7 ? 42 - cells.length : rem); d++) cells.push({ day: d, month: viewMonth + 1, year: viewMonth === 11 ? viewYear + 1 : viewYear, other: true });
    // Ensure grid is either 5 or 6 rows
    while (cells.length < 35) cells.push({ day: cells.length - 34 + 1, month: viewMonth + 1, year: viewMonth === 11 ? viewYear + 1 : viewYear, other: true });
    return cells;
  }, [viewYear, viewMonth]);

  function navMonth(dir) {
    if (dir === 0) { onViewDateChange(new Date()); onSelectDate?.(new Date()); return; }
    const d = new Date(viewDate);
    d.setMonth(d.getMonth() + dir);
    onViewDateChange(d);
  }

  const swipeLeft = useCallback(() => navMonth(1), [viewDate]);
  const swipeRight = useCallback(() => navMonth(-1), [viewDate]);
  const swipeHandlers = useSwipe(swipeLeft, swipeRight, IS_TOUCH);

  function handleDateTap(cellDate) {
    onSelectDate?.(cellDate);
    if (cellDate.getMonth() !== viewMonth || cellDate.getFullYear() !== viewYear) {
      onViewDateChange(cellDate);
    }
  }

  const dayBookings = useMemo(() => {
    if (!activeDate) return [];
    return (bookingMap[dateKey(activeDate)] || [])
      .filter(b => b.status !== 'cancelled')
      .sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for));
  }, [activeDate, bookingMap]);

  const dayLabel = activeDate
    ? `${DOW_SHORT[activeDate.getDay()]}, ${MONTHS_SHORT[activeDate.getMonth()]} ${activeDate.getDate()}`
    : '';
  const isActiveToday = activeDate && isSameDay(activeDate, today);

  return (
    <div className="plc5" {...swipeHandlers}>
      {/* Month header */}
      <div className="plc5-header">
        <div className="plc5-title-row">
          <button className="plc5-nav-btn" type="button" onClick={() => navMonth(-1)} aria-label="Previous month">‹</button>
          <div className="plc5-title-center">
            <h2 className="plc5-month-title">{MONTHS[viewMonth]}</h2>
            <span className="plc5-year">{viewYear}</span>
          </div>
          <button className="plc5-nav-btn" type="button" onClick={() => navMonth(1)} aria-label="Next month">›</button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="plc5-dow">
        {DOW_LETTER.map((d, i) => <div key={i} className="plc5-dow-label">{d}</div>)}
      </div>

      {/* Month grid */}
      <div className="plc5-grid">
        {days.map((cell, i) => {
          const cellDate = new Date(cell.year, cell.month, cell.day);
          const isToday = isSameDay(cellDate, today);
          const isSelected = activeDate && isSameDay(cellDate, activeDate);
          const bHere = cell.other ? [] : (bookingMap[dateKey(cellDate)] || []);
          const activeCount = bHere.filter(b => b.status !== 'cancelled').length;
          const dots = bHere.slice(0, 3).map(b =>
            b.status === 'completed' ? 'completed' : b.status === 'confirmed' ? 'confirmed' : 'scheduled'
          );
          return (
            <button
              key={i}
              type="button"
              className={`plc5-day${cell.other ? ' plc5-other' : ''}${isToday ? ' plc5-today' : ''}${isSelected ? ' plc5-selected' : ''}${activeCount > 0 ? ' plc5-has' : ''}`}
              onClick={() => handleDateTap(cellDate)}
            >
              <span className="plc5-day-num">{cell.day}</span>
              {dots.length > 0 && (
                <div className="plc5-dots">
                  {dots.map((c, j) => <span key={j} className={`plc5-dot plc5-dot--${c}`} />)}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="plc5-divider" />

      {/* Selected day events */}
      <div className="plc5-events">
        <div className="plc5-events-header">
          <span className="plc5-events-title">{isActiveToday ? 'Today' : dayLabel}</span>
          <div className="plc5-events-actions">
            {!isActiveToday && <button className="plc5-today-btn" type="button" onClick={() => navMonth(0)}>Today</button>}
          </div>
        </div>

        {dayBookings.length === 0 ? (
          <div className="plc5-empty">
            <div className="plc5-empty-text">No bookings</div>
            {onSlotClick && (
              <button className="plc5-empty-add" type="button" onClick={() => {
                const slotDate = new Date(activeDate || today);
                slotDate.setHours(9, 0, 0, 0);
                onSlotClick(slotDate);
              }}>+ Schedule a job</button>
            )}
          </div>
        ) : (
          <div className="plc5-event-list">
            {dayBookings.map(b => {
              const time = b.scheduled_for ? formatTimeShort(b.scheduled_for) : '';
              const dur = b.duration_minutes ? fmtDuration(b.duration_minutes) : '';
              const name = b.customer?.name || 'Direct booking';
              const color = statusColor(b.status);
              const bg = statusBg(b.status);
              return (
                <button
                  key={b.id}
                  type="button"
                  className="plc5-event"
                  style={{ '--ev-color': color, '--ev-bg': bg }}
                  onClick={() => onBlockClick?.(b)}
                >
                  <div className="plc5-event-bar" />
                  <div className="plc5-event-body">
                    <div className="plc5-event-name">{name}</div>
                    {b.quote?.title && <div className="plc5-event-job">{b.quote.title}</div>}
                    <div className="plc5-event-time">{time}{dur ? ` · ${dur}` : ''}</div>
                  </div>
                  {b.customer?.address && (
                    <a className="plc5-event-map"
                      href={(/iPad|iPhone|iPod/.test(navigator.userAgent) ? 'maps://?daddr=' : 'https://maps.google.com/?daddr=') + encodeURIComponent(b.customer.address)}
                      target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}>
                      📍
                    </a>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
