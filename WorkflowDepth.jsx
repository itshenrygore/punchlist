// ═══════════════════════════════════════════
// PUNCHLIST — Scheduling Utilities (centralized)
//
// Previously duplicated across:
//   - booking-drawer.jsx
//   - bookings-page.jsx
//   - pl-calendar.jsx
// ═══════════════════════════════════════════

export const DURATION_OPTIONS = [
  { val: 30, label: '30m' },
  { val: 60, label: '1h' },
  { val: 90, label: '1.5h' },
  { val: 120, label: '2h' },
  { val: 180, label: '3h' },
  { val: 240, label: '4h' },
  { val: 360, label: '6h' },
  { val: 480, label: 'Full day' },
  { val: 960, label: '2 days' },
  { val: 1440, label: '3 days' },
  { val: 2400, label: '5 days' },
];

export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 20;

/** Format a Date to a `datetime-local` input value (YYYY-MM-DDTHH:MM) */
export function toLocalDatetime(date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

/** Check if two Date objects fall on the same calendar day */
export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Build a Google/Apple Maps directions URL for an address */
export function getMapsUrl(address) {
  if (!address) return '#';
  const encoded = encodeURIComponent(address);
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    ? `maps://?daddr=${encoded}`
    : `https://maps.google.com/?daddr=${encoded}`;
}

/**
 * Human-readable duration string.
 * Normal:  120 → "2h", 90 → "1h 30min", 0/null → "2h"
 * Compact: 120 → "2h", 90 → "1h30m",    0/null → ""
 */
export function fmtDuration(m, compact = false) {
  if (!m) return compact ? '' : '2h';
  if (m < 60) return compact ? `${m}m` : `${m}min`;
  const h = Math.floor(m / 60), r = m % 60;
  if (compact) return r ? `${h}h${r}m` : `${h}h`;
  return r ? `${h}h ${r}min` : `${h}h`;
}

/**
 * Find available scheduling slots on a target date (+ next day if empty).
 * @param {Array} bookings   — all bookings to check against
 * @param {Date}  targetDate — day to search
 * @param {number} durationMin — desired duration in minutes
 * @param {number} maxSlots   — max results to return (default 3)
 * @param {string|null} excludeId — booking to ignore (for rescheduling)
 * @returns {Array<{start: Date, label: string}>}
 */
export function findAvailableSlots(bookings, targetDate, durationMin, maxSlots = 3, excludeId = null) {
  const results = [];
  const checkDay = (dayDate, isNextDay) => {
    const dayStart = new Date(dayDate);
    dayStart.setHours(DAY_START_HOUR, 0, 0, 0);
    const dayEnd = new Date(dayDate);
    dayEnd.setHours(DAY_END_HOUR, 0, 0, 0);
    const dayBookings = (bookings || []).filter(b => {
      if (b.id === excludeId) return false;
      if (b.status === 'cancelled' || b.status === 'completed') return false;
      if (!b.scheduled_for) return false;
      const bd = new Date(b.scheduled_for);
      return bd.getFullYear() === dayDate.getFullYear() &&
             bd.getMonth() === dayDate.getMonth() &&
             bd.getDate() === dayDate.getDate();
    }).map(b => ({
      start: new Date(b.scheduled_for).getTime(),
      end: new Date(b.scheduled_for).getTime() + (b.duration_minutes || 120) * 60000,
    })).sort((a, b) => a.start - b.start);
    const durMs = durationMin * 60000;
    if (dayBookings.length === 0) {
      if (dayEnd.getTime() - dayStart.getTime() >= durMs) results.push({ start: new Date(dayStart), isNextDay });
    } else {
      if (dayBookings[0].start - dayStart.getTime() >= durMs) results.push({ start: new Date(dayStart), isNextDay });
      for (let i = 0; i < dayBookings.length - 1 && results.length < maxSlots; i++) {
        const gapStart = dayBookings[i].end, gapEnd = dayBookings[i + 1].start;
        if (gapEnd - gapStart >= durMs) results.push({ start: new Date(gapStart), isNextDay });
      }
      if (results.length < maxSlots) {
        const lastEnd = dayBookings[dayBookings.length - 1].end;
        if (dayEnd.getTime() - lastEnd >= durMs) results.push({ start: new Date(lastEnd), isNextDay });
      }
    }
  };
  const day1 = new Date(targetDate); day1.setHours(0, 0, 0, 0);
  checkDay(day1, false);
  if (results.length === 0) { const day2 = new Date(day1); day2.setDate(day2.getDate() + 1); checkDay(day2, true); }

  const fmtT = (d) => {
    let h = d.getHours(), m = d.getMinutes();
    const ap = h >= 12 ? 'p' : 'a';
    h = h % 12 || 12;
    return m === 0 ? `${h}${ap}` : `${h}:${String(m).padStart(2, '0')}${ap}`;
  };

  return results.slice(0, maxSlots).map(r => {
    const endTime = new Date(r.start.getTime() + durationMin * 60000);
    return { start: r.start, label: `${fmtT(r.start)} – ${fmtT(endTime)}${r.isNextDay ? ' +1d' : ''}` };
  });
}
