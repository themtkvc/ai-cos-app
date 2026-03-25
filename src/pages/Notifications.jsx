import React, { useState, useEffect, useCallback } from 'react';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../lib/supabase';

// ── Bildirim tipleri ─────────────────────────────────────────────────────────
const TYPE_META = {
  task_assigned:   { icon: '📌', label: 'Görev Ataması',       color: '#6366f1', bg: '#eef2ff' },
  agenda_assigned: { icon: '📋', label: 'Gündem Ataması',      color: '#0891b2', bg: '#ecfeff' },
  task_status:     { icon: '🔄', label: 'Görev Durumu',        color: '#f59e0b', bg: '#fffbeb' },
  comment_added:   { icon: '💬', label: 'Yeni Yorum',          color: '#10b981', bg: '#ecfdf5' },
};

const getTypeMeta = (type) => TYPE_META[type] || { icon: '🔔', label: 'Bildirim', color: '#6b7280', bg: '#f9fafb' };

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} saat önce`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} gün önce`;
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Bildirim Kartı ───────────────────────────────────────────────────────────
function NotificationCard({ notification, onRead }) {
  const meta = getTypeMeta(notification.type);
  const isUnread = !notification.is_read;

  const handleClick = () => {
    if (isUnread) onRead(notification.id);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex', gap: 12, padding: '14px 18px', cursor: isUnread ? 'pointer' : 'default',
        background: isUnread ? meta.bg : 'var(--bg-card, #fff)',
        border: `1px solid ${isUnread ? meta.color + '30' : 'var(--border, #e5e7eb)'}`,
        borderRadius: 12, transition: 'all 0.15s',
        borderLeft: `3px solid ${isUnread ? meta.color : 'transparent'}`,
        opacity: isUnread ? 1 : 0.7,
      }}
      onMouseEnter={e => { if (isUnread) e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* İkon */}
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: meta.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, flexShrink: 0,
      }}>
        {meta.icon}
      </div>

      {/* İçerik */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{
            fontSize: 10.5, fontWeight: 600, color: meta.color,
            background: meta.color + '15', padding: '1px 7px', borderRadius: 12,
          }}>
            {meta.label}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted, #9ca3af)' }}>
            {timeAgo(notification.created_at)}
          </span>
          {isUnread && (
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: meta.color, flexShrink: 0,
            }} />
          )}
        </div>
        <div style={{
          fontWeight: isUnread ? 700 : 500, fontSize: 14,
          color: 'var(--text, #111827)', lineHeight: 1.35,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {notification.title}
        </div>
        {notification.body && (
          <div style={{
            fontSize: 12.5, color: 'var(--text-muted, #6b7280)', marginTop: 3, lineHeight: 1.4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {notification.body}
          </div>
        )}
        {notification.created_by_name && (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted, #9ca3af)', marginTop: 4 }}>
            👤 {notification.created_by_name}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ana Bildirimler Bileşeni ─────────────────────────────────────────────────
export default function Notifications({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | type

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await getNotifications(user.id, 100);
    setNotifications(data || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    const { supabase } = require('../lib/supabase');
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const handleRead = async (id) => {
    await markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead(user.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    if (filter !== 'all') return n.type === filter;
    return true;
  });

  // Tarihe göre grupla
  const grouped = {};
  filtered.forEach(n => {
    const date = new Date(n.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let key;
    if (date.toDateString() === today.toDateString()) key = 'Bugün';
    else if (date.toDateString() === yesterday.toDateString()) key = 'Dün';
    else key = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(n);
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text, #111827)' }}>
            🔔 Bildirimler
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted, #9ca3af)' }}>
            {unreadCount > 0 ? `${unreadCount} okunmamış bildirim` : 'Tüm bildirimler okundu'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            style={{
              padding: '8px 16px', borderRadius: 10, fontSize: 12.5, fontWeight: 600,
              border: '1.5px solid var(--border, #e5e7eb)', background: 'var(--bg, #f9fafb)',
              color: 'var(--text, #374151)', cursor: 'pointer',
            }}
          >
            ✓ Tümünü Okundu Yap
          </button>
        )}
      </div>

      {/* Filtreler */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', paddingBottom: 4, flexWrap: 'wrap' }}>
        {[
          { id: 'all', label: '🔔 Tümü', count: notifications.length },
          { id: 'unread', label: '● Okunmamış', count: unreadCount },
          { id: 'task_assigned', label: '📌 Görev Ataması' },
          { id: 'agenda_assigned', label: '📋 Gündem Ataması' },
          { id: 'task_status', label: '🔄 Durum Değişikliği' },
          { id: 'comment_added', label: '💬 Yorumlar' },
        ].map(f => {
          const isActive = filter === f.id;
          const cnt = f.count !== undefined ? f.count
            : notifications.filter(n => f.id === 'unread' ? !n.is_read : n.type === f.id).length;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', flexShrink: 0,
                border: `1.5px solid ${isActive ? 'var(--navy, #1a3a5c)' : 'var(--border, #e5e7eb)'}`,
                background: isActive ? 'var(--navy, #1a3a5c)' : 'var(--bg-card, #fff)',
                color: isActive ? '#fff' : 'var(--text, #374151)',
                fontWeight: isActive ? 700 : 400,
              }}>
              {f.label} {cnt > 0 ? `(${cnt})` : ''}
            </button>
          );
        })}
      </div>

      {/* Bildirim listesi */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted, #9ca3af)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: 'var(--text, #6b7280)' }}>
            {filter === 'unread' ? 'Okunmamış bildirim yok' : filter !== 'all' ? 'Bu türde bildirim yok' : 'Henüz bildirim yok'}
          </div>
          <div style={{ fontSize: 13 }}>
            Görev atamaları, gündem değişiklikleri ve yorumlar burada görünecek.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <div style={{
                fontSize: 12, fontWeight: 700, color: 'var(--text-muted, #9ca3af)',
                textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10,
                paddingLeft: 4,
              }}>
                {dateLabel}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map(n => (
                  <NotificationCard key={n.id} notification={n} onRead={handleRead} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
