import { supabase, friendly } from './shared.js';

export async function listBookings(_userId) {
  const { data, error } = await supabase
    .from('bookings')
    .select('id,created_at,scheduled_for,status,notes,customer_id,customer:customers(name,email,phone,address),quote_id,quote:quotes(title,deposit_required,deposit_status),duration_minutes')
    .order('scheduled_for', { ascending: false });
  if (error) throw new Error(friendly(error));
  return data || [];
}

export function checkBookingConflicts(bookings, newDate, newDuration, excludeId = null) {
  const start = new Date(newDate).getTime();
  const end = start + (Number(newDuration) || 120) * 60000;
  return (bookings || []).filter(b => {
    if (b.id === excludeId || b.status === 'cancelled' || b.status === 'completed') return false;
    const bStart = new Date(b.scheduled_for).getTime();
    const bEnd = bStart + (b.duration_minutes || 120) * 60000;
    return start < bEnd && end > bStart;
  });
}

export async function createBooking(userId, values) {
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      user_id: userId,
      customer_id: values.customer_id || null,
      quote_id: values.quote_id || null,
      scheduled_for: values.scheduled_for,
      notes: values.notes || null,
      status: values.status || 'scheduled',
      duration_minutes: values.duration_minutes || 120,
    })
    .select('id,created_at,scheduled_for,status,notes,customer_id,customer:customers(name,email,phone,address),quote_id,quote:quotes(title,deposit_required,deposit_status),duration_minutes')
    .single();
  if (error) throw new Error(friendly(error));
  if (values.quote_id) await supabase.from('quotes').update({ status: 'scheduled' }).eq('id', values.quote_id);

  // Fetch profile once for both email and SMS paths
  let profile = null;
  const customerEmail = data?.customer?.email;
  const customerPhone = data?.customer?.phone;
  if (customerEmail || customerPhone) {
    const { data: p } = await supabase.from('profiles').select('full_name,company_name,phone,email').eq('id', userId).maybeSingle();
    profile = p;
  }

  // 2D: Auto-send booking confirmation to customer if they have an email
  if (customerEmail && profile) {
    fetch('/api/send-quote-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'booking_confirmation',
        customerEmail,
        customerName: data.customer?.name || '',
        contractorName: profile.company_name || profile.full_name || '',
        contractorPhone: profile.phone || '',
        contractorEmail: profile.email || '',
        quoteTitle: data.quote?.title || '',
        scheduledFor: data.scheduled_for,
        durationMinutes: data.duration_minutes || 120,
        bookingNotes: data.notes || '',
      }),
    }).catch(e => console.warn('[PL]', e));
  }

  // 9B: SMS — booking confirmation to customer
  if (customerPhone) {
    const cName = profile?.company_name || profile?.full_name || 'Your contractor';
    const dt = new Date(data.scheduled_for);
    const dateStr = dt.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
    const timeStr = dt.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
    fetch('/api/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'booking_confirmation',
        to: customerPhone,
        data: { contractorName: cName, date: dateStr, time: timeStr },
      }),
    }).catch(e => console.warn('[PL]', e));
  }

  return data;
}

export async function updateBooking(bookingId, values) {
  const { data: prev } = await supabase.from('bookings')
    .select('id,created_at,scheduled_for,status,customer_id,customer:customers(name,email,phone,address),quote_id,quote:quotes(title,deposit_required,deposit_status),duration_minutes,notes')
    .eq('id', bookingId).maybeSingle();

  const { data, error } = await supabase.from('bookings').update(values).eq('id', bookingId).select('id,created_at,scheduled_for,status,notes,customer_id,customer:customers(name,email,phone,address),quote_id,quote:quotes(title,deposit_required,deposit_status),duration_minutes').single();
  if (error) throw new Error(friendly(error));

  // 4C: Auto-send reschedule or cancel email
  const customerEmail = data?.customer?.email;
  if (customerEmail && prev) {
    const wasRescheduled = values.scheduled_for && values.scheduled_for !== String(prev.scheduled_for || '').slice(0, 16) && values.status !== 'cancelled';
    const wasCancelled = values.status === 'cancelled' && prev.status !== 'cancelled';

    if (wasRescheduled || wasCancelled) {
      let profile = null;
      try {
        const { data: sess } = await supabase.auth.getSession();
        if (sess?.session?.user?.id) {
          const { data: p } = await supabase.from('profiles').select('full_name,company_name,phone,email').eq('id', sess.session.user.id).maybeSingle();
          profile = p;
        }
      } catch (e) { console.warn("[PL]", e); }

      const action = wasCancelled ? 'booking_cancel' : 'booking_reschedule';
      fetch('/api/send-quote-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          customerEmail,
          customerName: data.customer?.name || '',
          contractorName: profile?.company_name || profile?.full_name || '',
          contractorPhone: profile?.phone || '',
          contractorEmail: profile?.email || '',
          quoteTitle: data.quote?.title || '',
          scheduledFor: data.scheduled_for,
          durationMinutes: data.duration_minutes || 120,
          bookingNotes: data.notes || '',
          previousDate: prev.scheduled_for || '',
        }),
      }).catch(e => console.warn('[PL]', e));

      // 9B: SMS — reschedule/cancel notification to customer
      if (data?.customer?.phone) {
        const cName = profile?.company_name || profile?.full_name || 'Your contractor';
        const dt = new Date(data.scheduled_for);
        const dateStr = dt.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
        const timeStr = dt.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
        const smsAction = wasCancelled ? 'booking_cancel' : 'booking_reschedule';
        fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: smsAction,
            to: data.customer.phone,
            data: { contractorName: cName, date: dateStr, time: timeStr },
          }),
        }).catch(e => console.warn('[PL]', e));
      }
    }
  }

  // W-5: If booking was cancelled and had a linked quote in 'scheduled' status, revert to 'approved'
  if (values.status === 'cancelled' && prev?.status !== 'cancelled' && prev?.quote_id) {
    try {
      const { data: linkedQuote } = await supabase.from('quotes').select('status,deposit_required,deposit_status').eq('id', prev.quote_id).maybeSingle();
      if (linkedQuote?.status === 'scheduled') {
        const revertStatus = linkedQuote.deposit_required && linkedQuote.deposit_status !== 'paid' ? 'approved_pending_deposit' : 'approved';
        await supabase.from('quotes').update({ status: revertStatus }).eq('id', prev.quote_id);
      }
    } catch (e) { console.warn("[PL]", e); }
  }

  return data;
}

export function downloadBookingICS(booking) {
  const start = new Date(booking.scheduled_for);
  const durationMs = (booking.duration_minutes || 120) * 60000;
  const end = new Date(start.getTime() + durationMs);

  const pad = (n) => String(n).padStart(2, '0');
  const toICS = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

  const title = booking.quote?.title || booking.customer?.name || 'Job';
  const location = booking.customer?.address || '';
  const description = [
    booking.notes || '',
    booking.customer?.name ? `Customer: ${booking.customer.name}` : '',
    booking.customer?.phone ? `Phone: ${booking.customer.phone}` : '',
  ].filter(Boolean).join('\\n');

  const uid = `${booking.id}@punchlist.ca`;

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Punchlist//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${toICS(start)}`,
    `DTEND:${toICS(end)}`,
    `SUMMARY:${title}`,
    location ? `LOCATION:${location}` : '',
    description ? `DESCRIPTION:${description}` : '',
    `DTSTAMP:${toICS(new Date())}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '-')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
