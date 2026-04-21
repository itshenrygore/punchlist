import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/use-auth';
import useScrollLock from '../hooks/use-scroll-lock';

const NOTIFICATION_ICONS = {
  quote_viewed: '👀',
  quote_approved: '✓',
  quote_declined: '✕',
  revision_requested: 'edit',
  customer_question: 'message',
  booking_tomorrow: 'calendar',
  payment_received: 'payment',
  quote_expiring: '⏳',
  additional_work_approved: '✓',
  additional_work_declined: '✕',
  amendment_approved: '✓',
  amendment_declined: '✕',
};

const NOTIFICATION_TONES = {
  quote_viewed: 'sent',
  quote_approved: 'approved',
  quote_declined: 'declined',
  revision_requested: 'revision',
  customer_question: 'sent',
  booking_tomorrow: 'scheduled',
  payment_received: 'paid',
  quote_expiring: 'revision',
  additional_work_approved: 'approved',
  additional_work_declined: 'declined',
  amendment_approved: 'approved',
  amendment_declined: 'declined',
};

export default function NotificationCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  useScrollLock(open);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const bellRef = useRef(null);
  const panelRef = useRef(null);
  // Unique channel name per mount — prevents "cannot add postgres_changes
  // callbacks after subscribe()" when React StrictMode double-invokes effects
  // or when the component remounts before Supabase finishes tearing down the
  // previous channel with a shared static name.
  const channelName = useRef(`notifications-realtime-${Math.random().toString(36).slice(2)}`);

  const unreadCount = notifications.filter(n => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!error && data) setNotifications(data);
    } catch (e) { console.warn("[PL]", e); }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(channelName.current)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev].slice(0, 20));
        const n = payload.new;
        if (!n?.type) return;
        try {
          const vtKey = 'pl_vt_' + n.type;
          const vtCount = parseInt(localStorage.getItem(vtKey) || '0', 10);
          if (n.type === 'quote_approved' && vtCount < 5) {
            localStorage.setItem(vtKey, String(vtCount + 1));
            window.dispatchEvent(new CustomEvent('pl:value-trigger', {
              detail: { type: 'quote_approved', title: n.title, body: n.body, link: n.link }
            }));
          } else if (n.type === 'quote_viewed' || (n.type === 'general' && n.title?.toLowerCase().includes('viewed'))) {
            if (vtCount < 3) {
              localStorage.setItem(vtKey, String(vtCount + 1));
              window.dispatchEvent(new CustomEvent('pl:value-trigger', {
                detail: { type: 'quote_viewed', title: n.title, body: n.body, link: n.link }
              }));
            }
          }
        } catch (e) { console.warn("[PL]", e); }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel).catch(() => {}); };
  }, [user]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (bellRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  async function markRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  async function markAllRead() {
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  function timeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  }

  function handleNotifClick(n) {
    markRead(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  /* ── Portal-rendered dropdown — escapes topbar's backdrop-filter stacking context ── */
  const dropdown = open ? createPortal(
    <>
      <div className="notif-backdrop" onClick={() => setOpen(false)} />
      <div className="notif-dropdown" ref={panelRef} role="dialog" aria-label="Notifications">
        <div className="notif-header">
          <span className="notif-title">Notifications</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {unreadCount > 0 && (
              <button className="notif-mark-all" type="button" onClick={markAllRead}>
                Mark all read
              </button>
            )}
            <button className="notif-close" type="button" onClick={() => setOpen(false)} aria-label="Close">×</button>
          </div>
        </div>

        {loading && notifications.length === 0 && (
          <div className="notif-empty">Loading…</div>
        )}
        {!loading && notifications.length === 0 && (
          <div className="notif-empty">No notifications yet — you'll see quote views and approvals here</div>
        )}

        <div className="notif-list">
          {(() => {
            let lastGroup = '';
            return notifications.map(n => {
              const icon = NOTIFICATION_ICONS[n.type] || 'default';
              const tone = NOTIFICATION_TONES[n.type] || 'draft';
              const nDate = n.created_at ? new Date(n.created_at) : null;
              const today = new Date();
              const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
              let group = '';
              if (nDate) {
                if (nDate.toDateString() === today.toDateString()) group = 'Today';
                else if (nDate.toDateString() === yesterday.toDateString()) group = 'Yesterday';
                else group = nDate.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
              }
              const showGroup = group !== lastGroup;
              lastGroup = group;

              return (
                <div key={n.id}>
                  {showGroup && <div className="notif-group-label">{group}</div>}
                  <div className="notif-link-wrap" onClick={() => handleNotifClick(n)} style={{ cursor: 'pointer' }}>
                    <div className={`notif-item ${n.read ? '' : 'unread'}`}>
                      <div className={`notif-icon tone-${tone}`}>{icon}</div>
                      <div className="notif-body">
                        <div className="notif-item-title">{n.title}</div>
                        {n.body && <div className="notif-item-body">{n.body}</div>}
                        <div className="notif-item-time">{timeAgo(n.created_at)}</div>
                      </div>
                      {!n.read && <div className="notif-dot" />}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>
    </>,
    document.body
  ) : null;

  return (
    <div className="notif-center" ref={bellRef}>
      <button
        className="notif-bell"
        type="button"
        onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>
      {dropdown}
    </div>
  );
}
