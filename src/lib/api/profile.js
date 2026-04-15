import { supabase, friendly } from './shared.js';

/* Columns that have been stripped from profile saves because they don't exist in Supabase.
   Persists for the session so we don't hit the same error repeatedly. */
const _profileBadCols = new Set();

export async function saveProfile(user, updates = {}) {
  // Only send fields that were explicitly provided — never write defaults for omitted fields.
  // This prevents step-2 (trade/province) from wiping step-1 data (name/company) and vice versa.
  const payload = { id: user.id };
  if ('full_name' in updates)        payload.full_name = updates.full_name || user.user_metadata?.full_name || '';
  if ('company_name' in updates)     payload.company_name = updates.company_name || '';
  if ('trade' in updates)            payload.trade = updates.trade || 'Other';
  if ('province' in updates)         payload.province = updates.province || 'ON';
  if ('country' in updates)          payload.country = updates.country || 'CA';
  if ('phone' in updates)            payload.phone = updates.phone || '';
  if ('default_expiry_days' in updates) payload.default_expiry_days = Number(updates.default_expiry_days ?? 14);
  const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
  if (error) throw new Error(friendly(error));
  return payload;
}

export async function getProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw new Error(friendly(error));
  return data;
}

export async function updateProfile(userId, updates) {
  let payload = { id: userId, ...updates };
  // Strip any previously-identified bad columns
  for (const col of _profileBadCols) delete payload[col];

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' }).select().single();
    if (!error) return data;

    // If error mentions a specific column, strip it and retry
    const colMatch = error.message?.match(/column\s+"?(\w+)"?/i) || error.details?.match(/column\s+"?(\w+)"?/i);
    if (colMatch?.[1] && colMatch[1] !== 'id') {
      const badCol = colMatch[1];
      console.warn(`[Punchlist] Stripping unknown profile column: ${badCol}`);
      _profileBadCols.add(badCol);
      delete payload[badCol];
      continue;
    }
    throw new Error(friendly(error));
  }
  // If we exhausted retries (5 bad columns in one save), try one last time
  const { data, error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' }).select().single();
  if (error) throw new Error(friendly(error));
  return data;
}

export async function uploadLogo(userId, file) {
  const ext = (file.name?.split('.').pop() || 'png').toLowerCase();
  if (!['png','jpg','jpeg','svg','webp'].includes(ext)) throw new Error('Only PNG, JPG, SVG, or WebP files are supported.');
  if (file.size > 2 * 1024 * 1024) throw new Error('Logo must be under 2MB.');
  const path = `${userId}/logo.${ext}`;
  const { data, error } = await supabase.storage
    .from('logos')
    .upload(path, file, { cacheControl: '2592000', upsert: true });
  if (error) throw new Error(friendly(error));
  const { data: urlData } = supabase.storage.from('logos').getPublicUrl(data.path);
  return urlData.publicUrl;
}
