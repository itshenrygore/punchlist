import { supabase, friendly, parseCsv } from './shared.js';

export async function listCustomers(_userId) {
  const { data, error } = await supabase.from('customers').select('*').order('name');
  if (error) throw new Error(friendly(error));
  return data || [];
}

export async function findCustomerMatches(_userId, text) {
  if (!text || text.length < 2) return [];
  const { data, error } = await supabase.from('customers').select('id,name,email,phone,address').ilike('name', `%${text}%`).limit(10);
  if (error) return [];
  return data || [];
}

/**
 * M7: Look up an existing customer by phone or email before quick-create.
 * - Phone is normalized via \D strip on both sides.
 * - Email is lowercased.
 * - Returns the first match or null. Requires at least one of phone/email;
 *   returns null if both are missing (name-only dedup is too noisy).
 */
export async function findCustomerByContact(userId, { phone, email } = {}) {
  const normPhone = phone ? String(phone).replace(/\D/g, '') : '';
  const normEmail = email ? String(email).trim().toLowerCase() : '';
  if (!normPhone && !normEmail) return null;

  // Pull candidate set scoped to this user, then match client-side.
  // We can't rely on a server-side normalized column existing, so we
  // fetch customers with any phone or email and filter in-process.
  // Scoped by user_id and limited to keep it cheap.
  const { data, error } = await supabase
    .from('customers')
    .select('id,name,email,phone')
    .eq('user_id', userId)
    .or('phone.not.is.null,email.not.is.null')
    .is('archived_at', null)
    .limit(500);
  if (error) return null;

  for (const c of data || []) {
    if (normPhone && c.phone) {
      const cp = String(c.phone).replace(/\D/g, '');
      if (cp && cp === normPhone) return c;
    }
    if (normEmail && c.email) {
      if (String(c.email).trim().toLowerCase() === normEmail) return c;
    }
  }
  return null;
}

export async function createCustomer(userId, values) {
  const { data, error } = await supabase
    .from('customers')
    .insert({
      user_id: userId,
      name: values.name,
      email: values.email || null,
      phone: values.phone || null,
      address: values.address || null,
      notes: values.notes || null,
    })
    .select()
    .single();
  if (error) throw new Error(friendly(error));
  return data;
}

export async function updateCustomer(customerId, values) {
  const allowed = {};
  for (const k of ['name', 'email', 'phone', 'address', 'notes', 'archived_at']) {
    if (values[k] !== undefined) allowed[k] = values[k];
  }
  const { data, error } = await supabase
    .from('customers')
    .update(allowed)
    .eq('id', customerId)
    .select()
    .single();
  if (error) throw new Error(friendly(error));
  return data;
}

export async function uploadCustomersCsv(userId, file) {
  const rows = await parseCsv(file);
  const payload = rows
    .filter(r => r.name || r.Name)
    .map(r => ({
      user_id: userId,
      name: r.name || r.Name,
      email: r.email || r.Email || null,
      phone: r.phone || r.Phone || null,
      address: r.address || r.Address || null,
      notes: r.notes || r.Notes || null,
    }));
  if (!payload.length) return { inserted: 0 };
  const { error } = await supabase.from('customers').insert(payload);
  if (error) throw new Error(friendly(error));
  return { inserted: payload.length };
}

export async function updateCustomerTags(customerId, tags) {
  const { data, error } = await supabase
    .from('customers')
    .update({ tags: tags || [] })
    .eq('id', customerId)
    .select()
    .single();
  if (error) throw new Error(friendly(error));
  return data;
}

export async function touchCustomerLastContacted(customerId) {
  const { data, error } = await supabase
    .from('customers')
    .update({ last_contacted_at: new Date().toISOString() })
    .eq('id', customerId)
    .select()
    .single();
  if (error) throw new Error(friendly(error));
  return data;
}

export async function mergeCustomers(survivorId, victimId) {
  await supabase.from('quotes').update({ customer_id: survivorId }).eq('customer_id', victimId);
  await supabase.from('bookings').update({ customer_id: survivorId }).eq('customer_id', victimId);
  await supabase.from('invoices').update({ customer_id: survivorId }).eq('customer_id', victimId);
  await supabase.from('additional_work_requests').update({ customer_id: survivorId }).eq('customer_id', victimId);
  const { error } = await supabase.from('customers').delete().eq('id', victimId);
  if (error) throw new Error(friendly(error));
}

export async function uploadCustomersCsvDedup(userId, file) {
  const rows = await parseCsv(file);
  const { data: existing } = await supabase.from('customers').select('id,email,phone').eq('user_id', userId);
  const existingEmails = new Set((existing || []).map(c => (c.email || '').toLowerCase()).filter(Boolean));
  const existingPhones = new Set((existing || []).map(c => (c.phone || '').replace(/\D/g, '')).filter(Boolean));

  const payload = rows
    .filter(r => r.name || r.Name)
    .map(r => ({
      user_id: userId,
      name: r.name || r.Name,
      email: r.email || r.Email || null,
      phone: r.phone || r.Phone || null,
      address: r.address || r.Address || null,
      notes: r.notes || r.Notes || null,
      tags: '[]',
      archived_at: null,
    }))
    .filter(r => {
      const emailMatch = r.email && existingEmails.has(r.email.toLowerCase());
      const phoneMatch = r.phone && existingPhones.has(r.phone.replace(/\D/g, ''));
      return !emailMatch && !phoneMatch;
    });

  if (!payload.length) return { inserted: 0, skipped: rows.length };
  const { error } = await supabase.from('customers').insert(payload);
  if (error) throw new Error(friendly(error));
  return { inserted: payload.length, skipped: rows.length - payload.length };
}

export function exportCustomersCSV(customers) {
  const rows = [['Name','Email','Phone','Address','Notes','Tags','Created']];
  for (const c of customers) {
    const tags = Array.isArray(c.tags) ? c.tags.join('; ') : '';
    rows.push([
      c.name || '', c.email || '', c.phone || '',
      c.address || '', c.notes || '', tags, c.created_at || '',
    ]);
  }
  const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'punchlist-contacts.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}
