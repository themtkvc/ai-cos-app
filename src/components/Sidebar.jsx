import React, { useState, useEffect } from 'react';
import { supabase, getMeetingActions, getUnreadNotificationCount, signOut } from '../lib/supabase';
import { ROLE_ACCESS, canAccessPolicy, useTheme } from '../App';
import { ROLE_LABELS } from '../lib/constants';

const ALL_NAV = [
  { id: 'dashboard', icon: '⚡', label: 'Dashboard' },
  { id: 'notifications',   icon: '🔔', label: 'Bildirimler' },
  { id: 'chat',      icon: '🤖', label: 'AI Asistan' },
  { id: 'agendas',          icon: '📋', label: 'Gündemler' },
  { id: 'direktor_agendas', icon: '🗂', label: 'Direktör Gündemleri' },
  { id: 'donors',    icon: '🤝', label: 'Donör CRM' },
  { id: 'meetings',  icon: '📋', label: 'Toplantı Logu' },
  { id: 'reports',   icon: '📊', label: 'Birim Raporları' },
  { id: 'dailylog',   icon: '🗓', label: 'Günlük İş Kayıtları' },
  { id: 'logsviewer', icon: '📂', label: 'İş Kayıtları - Dashboard' },
  { id: 'analytics',  icon: '📈', label: 'Çalışma Analizi' },
  { id: 'donations', icon: '💰', label: 'Bağış Takip' },
  { id: 'orgchart',  icon: '🏢', label: 'Org Şeması' },
  { id: 'network',          icon: '🕸️', label: 'Network Yönetimi' },
  { id: 'networkanalytics', icon: '🔬', label: 'Network Analiz' },
  { id: 'notes',            icon: '📝', label: 'Notlarım' },
  { id: 'documents',        icon: '📄', label: 'Dokümanlar' },
  { id: 'funds',            icon: '💰', label: 'Fon Fırsatları' },
  { id: 'forms',            icon: '📋', label: 'Formlar' },
  { id: 'gamification',     icon: '🏆', label: 'Oyunlaştırma' },
  { id: 'events',           icon: '📅', label: 'Etkinlikler' },
  { id: 'capacity',         icon: '📚', label: 'Kapasite Geliştirme' },
  { id: 'activities',       icon: '📊', label: 'Aktiviteler' },
  { id: 'goals',            icon: '🎯', label: 'Hedefler' },
  { id: 'collaborations',   icon: '🤝', label: 'İşbirlikleri' },
  { id: 'policy',           icon: '⚖️', label: 'Politikalar ve Yönetişim' },
  { id: 'emails',           icon: '📧', label: 'Mailler' },
  { id: 'feedback',         icon: '💬', label: 'Geri Bildirim' },
];

const ADMIN_NAV = [
  { id: 'admin', icon: '⚙️', label: 'Admin Paneli' },
];

// Küçük avatar bileşeni — foto varsa göster, yoksa baş harfi
function SidebarAvatar({ profile, size = 34 }) {
  const [imgError, setImgError] = useState(false);
  const initials = (profile?.full_name?.[0] || '?').toUpperCase();
  const avatarUrl = profile?.avatar_url;

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={profile?.full_name || ''}
        onError={() => setImgError(true)}
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover', flexShrink: 0,
          border: '2px solid rgba(255,255,255,0.2)',
        }}
      />
    );
  }

  return (
    <div className="sidebar-user-avatar" style={{ width: size, height: size, fontSize: 14 }}>
      {initials}
    </div>
  );
}

export default function Sidebar({ activePage, onNavigate, user, profile, mobileOpen, onMobileClose }) {
  const [openActionsCount, setOpenActionsCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const { theme, toggleTheme } = useTheme();

  const role = profile?.role || 'personel';
  const baseAllowed = ROLE_ACCESS[role] || ROLE_ACCESS['personel'];
  // Politika birimi üyeleri rolden bağımsız 'policy' sayfasına erişebilir
  const allowed = canAccessPolicy(profile)
    ? Array.from(new Set([...baseAllowed, 'policy']))
    : baseAllowed;

  useEffect(() => {
    if (!user) return;
    if (allowed.includes('meetings')) {
      getMeetingActions(user.id).then(({ data }) => {
        if (!data) return;
        setOpenActionsCount(data.filter(a => a.status !== '✅ Completed').length);
      });
    }
    // Bildirim sayısı
    const refreshNotifCount = () => {
      getUnreadNotificationCount(user.id).then(({ count }) => setUnreadNotifCount(count || 0));
    };
    refreshNotifCount();

    // Realtime bildirim sayısı güncelleme (yeni bildirim geldiğinde)
    const channel = supabase
      .channel('sidebar-notif-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        refreshNotifCount();
      })
      .subscribe();

    // Bildirimler sayfasından okundu event'i dinle
    window.addEventListener('notification-count-changed', refreshNotifCount);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('notification-count-changed', refreshNotifCount);
    };
  }, [user, role]);

  const badges = { meetings: openActionsCount || null, notifications: unreadNotifCount || null };
  const displayName = profile?.full_name || user?.email?.split('@')[0] || '';
  const roleLabel = ROLE_LABELS[role] || role;

  const visibleNav = ALL_NAV.filter(item => allowed.includes(item.id));
  const visibleAdmin = ADMIN_NAV.filter(item => allowed.includes(item.id));

  const handleNav = (id) => {
    onNavigate(id);
    if (onMobileClose) onMobileClose();
  };

  return (
    <nav className={`sidebar${mobileOpen ? ' sidebar-open' : ''}`}>
      {/* Mobilde kapat butonu */}
      <button className="sidebar-mobile-close" onClick={onMobileClose} aria-label="Menüyü kapat">✕</button>

      <div className="sidebar-logo">
        <div className="sidebar-logo-title">🏛 AI Chief of Staff</div>
        <div className="sidebar-logo-sub">Direktör Ofisi</div>
      </div>

      <div className="sidebar-nav">
        <div className="nav-section-label">Ana Menü</div>
        {visibleNav.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => handleNav(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
            {badges[item.id] ? <span className="nav-badge">{badges[item.id]}</span> : null}
          </button>
        ))}

        {visibleAdmin.length > 0 && (
          <>
            <div className="nav-section-label" style={{marginTop:16}}>Yönetim</div>
            {visibleAdmin.map(item => (
              <button
                key={item.id}
                className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                onClick={() => handleNav(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </>
        )}
      </div>

      <div className="sidebar-footer">
        {/* Tema değiştir */}
        <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Açık Tema' : 'Koyu Tema'}>
          <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span style={{ flex: 1 }}>{theme === 'dark' ? 'Açık Tema' : 'Koyu Tema'}</span>
          <div className={`theme-toggle-track${theme === 'dark' ? ' active' : ''}`}>
            <div className="theme-toggle-knob" />
          </div>
        </button>

        {/* Profil ayarlarına git butonu */}
        <button
          className={`nav-item ${activePage === 'profile' ? 'active' : ''}`}
          onClick={() => handleNav('profile')}
          style={{ marginBottom: 6, width: '100%' }}
        >
          <span className="nav-icon">⚙️</span>
          Profil Ayarları
        </button>

        <div
          className="sidebar-user"
          style={{ cursor: 'pointer' }}
          onClick={() => handleNav('profile')}
          title="Profil Ayarları"
        >
          <SidebarAvatar profile={profile} />
          <div className="sidebar-user-info">
            <div className="sidebar-user-name" title={user?.email}>{displayName}</div>
            <div className="sidebar-user-role">{roleLabel}</div>
          </div>
          <button
            className="sign-out-btn"
            onClick={e => { e.stopPropagation(); if (window.confirm('Oturumu kapatmak istediğinize emin misiniz?')) signOut(); }}
            title="Çıkış Yap"
          >⎋</button>
        </div>
      </div>
    </nav>
  );
}
