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

export async function listNotifications(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return [];
  return data || [];
}
