import { useMemo } from 'react';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function WeekStrip({ bookings = [], onDayClick }) {
  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const hasBooking = (bookings || []).some(b => {
        if (!b.scheduled_for || b.status === 'cancelled') return false;
        const bd = new Date(b.scheduled_for);
        return bd.getFullYear() === d.getFullYear() &&
               bd.getMonth() === d.getMonth() &&
               bd.getDate() === d.getDate();
      });
      result.push({
        date: d,
        dayName: DAY_NAMES[d.getDay()],
        dayNum: d.getDate(),
        isToday: i === 0,
        hasBooking,
      });
    }
    return result;
  }, [bookings]);

  return (
    <div className="week-strip">
      {days.map((day, i) => (
        <button
          key={i}
          type="button"
          className={`week-strip-day${day.isToday ? ' week-strip-today' : ''}`}
          onClick={() => onDayClick?.(day.date)}
          title={day.date.toLocaleDateString()}
        >
          <span className="week-strip-name">{day.dayName}</span>
          <span className="week-strip-num">{day.dayNum}</span>
          {day.hasBooking && <span className="week-strip-dot" />}
        </button>
      ))}
    </div>
  );
}
