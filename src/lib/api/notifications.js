import { supabase } from './shared.js';

export async function createNotification(userId, { type, title, body, link }) {
  if (!userId) return;
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: type || 'general',
      title: title || '',
      body: body || '',
      link: link || null,
      read: false,
    });
  } catch (err) {
    console.warn('[Punchlist] Notification insert failed:', err?.message);
  }
}

export async function listNotifications(userId, { limit = 50, offset = 0 } = {}) {
  const { data, error, count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return { items: [], total: 0 };
  return { items: data || [], total: count || 0 };
}
