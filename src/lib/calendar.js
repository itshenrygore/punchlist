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

export function addToCalendar(quote) {
  const customer = quote.customer?.name || 'Customer';
  const title = `${quote.title || 'Job'} — ${customer}`;
  const description = [
    quote.scope_summary || quote.description || '',
    quote.total ? `Total: $${Number(quote.total).toFixed(2)}` : '',
    quote.share_token ? `Quote: ${window.location.origin}/q/${quote.share_token}` : '',
  ].filter(Boolean).join('\n');

  const location = quote.customer?.address || '';
  // No scheduled window yet → default to a clean 9:00 AM a week out (a
  // sensible placeholder the contractor edits in their calendar app)
  // rather than an arbitrary "now + 7 days" time-of-day.
  const startDate = quote.schedule_window
    ? new Date(quote.schedule_window)
    : (() => { const d = new Date(Date.now() + 7 * 86400000); d.setHours(9, 0, 0, 0); return d; })();

  const ics = generateICS({ title, description, location, startDate });
  downloadICS(ics, `punchlist-${quote.quote_number || 'job'}.ics`);
}
