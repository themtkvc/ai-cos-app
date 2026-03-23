import React, { useState, useEffect } from 'react';
import { getMeetingActions, signOut } from '../lib/supabase';
import { ROLE_ACCESS, ROLE_LABELS } from '../App';

const ALL_NAV = [
  { id: 'dashboard', icon: '⚡', label: 'Dashboard' },
  { id: 'chat',      icon: '🤖', label: 'AI Asistan' },
  { id: 'agendas',   icon: '📋', label: 'Gündemler' },
  { id: 'donors',    icon: '🤝', label: 'Donör CRM' },
  { id: 'meetings',  icon: '📋', label: 'Toplantı Logu' },
  { id: 'reports',   icon: '📊', label: 'Birim Raporları' },
  { id: 'dailylog',   icon: '🗓', label: 'Günlük İş Kayıtları' },
  { id: 'logsviewer', icon: '📂', label: 'İş Kayıtları - Dashboard' },
  { id: 'analytics',  icon: '📈', label: 'Çalışma Analizi' },
  { id: 'donations', icon: '💰', label: 'Bağış Takip' },
  { id: 'orgchart',  icon: '🏢', label: 'Org Şeması' },
  { id: 'network',   icon: '🕸️', label: 'Network Yönetimi' },
];

const ADMIN_NAV = [
  { id: 'admin', icon: '⚙️', label: 'Admin Paneli' },
  { id: 'users', icon: '👥', label: 'Kullanıcı Yönetimi' },
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

  const role = profile?.role || 'personel';
  const allowed = ROLE_ACCESS[role] || ROLE_ACCESS['personel'];

  useEffect(() => {
    if (!user) return;
    if (allowed.includes('meetings')) {
      getMeetingActions(user.id).then(({ data }) => {
        if (!data) return;
        setOpenActionsCount(data.filter(a => a.status !== '✅ Completed').length);
      });
    }
  }, [user, role]);

  const badges = { meetings: openActionsCount || null };
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
            onClick={e => { e.stopPropagation(); signOut(); }}
            title="Çıkış"
          >⎋</button>
        </div>
      </div>
    </nav>
  );
}
