export function generateICS({ title, description, location, startDate, durationHours = 2, url }) {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end = new Date(start.getTime() + durationHours * 3600000);
  const fmt = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const uid = `punchlist-${Date.now()}@punchlist.app`;
  const esc = s => (s || '').replace(/[,;\\]/g, c => '\\' + c).replace(/\n/g, '\\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Punchlist//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(title)}`,
    description ? `DESCRIPTION:${esc(description)}` : null,
    location ? `LOCATION:${esc(location)}` : null,
    url ? `URL:${url}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.join('\r\n');
}

export function downloadICS(icsContent, filename = 'event.ics') {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Internal helper that builds + downloads the .ics for a given Date.
function exportQuoteToCalendar(quote, startDate, durationHours = 2) {
  const customer = quote.customer?.name || 'Customer';
  const title = `${quote.title || 'Job'} — ${customer}`;
  const description = [
    quote.scope_summary || quote.description || '',
    quote.total ? `Total: $${Number(quote.total).toFixed(2)}` : '',
    quote.share_token ? `Quote: ${window.location.origin}/q/${quote.share_token}` : '',
  ].filter(Boolean).join('\n');
  const location = quote.customer?.address || '';
  const ics = generateICS({ title, description, location, startDate, durationHours });
  downloadICS(ics, `punchlist-${quote.quote_number || 'job'}.ics`);
}

/**
 * addToCalendar
 *
 * If `quote.schedule_window` is set, export it directly (the contractor
 * has already scheduled the job). Otherwise we DO NOT guess — return
 * { needsSchedule: true } so the caller can prompt the contractor to
 * pick a real date/time. Silently exporting "9am one week out" was
 * worse than asking, because the calendar event was always wrong and
 * had to be manually edited.
 */
export function addToCalendar(quote) {
  if (quote.schedule_window) {
    exportQuoteToCalendar(quote, new Date(quote.schedule_window));
    return { exported: true };
  }
  return { needsSchedule: true };
}

/**
 * exportScheduledQuote — direct export after the contractor has picked
 * a date + time in our scheduler UI. Skips the schedule_window check.
 */
export function exportScheduledQuote(quote, startDate, durationHours = 2) {
  exportQuoteToCalendar(quote, startDate, durationHours);
}
