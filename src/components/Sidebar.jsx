import React, { useState, useEffect } from 'react';
import { getDeadlines, getMeetingActions, signOut } from '../lib/supabase';
import { ROLE_ACCESS, ROLE_LABELS } from '../App';

const ALL_NAV = [
  { id: 'dashboard', icon: '⚡', label: 'Dashboard' },
  { id: 'chat',      icon: '🤖', label: 'AI Asistan' },
  { id: 'deadlines', icon: '📅', label: 'Görevler & Tarihler' },
  { id: 'donors',    icon: '🤝', label: 'Donör CRM' },
  { id: 'meetings',  icon: '📋', label: 'Toplantı Logu' },
  { id: 'reports',   icon: '📊', label: 'Birim Raporları' },
  { id: 'dailylog',  icon: '🗓', label: 'Günlük İş Logu' },
  { id: 'analytics', icon: '📈', label: 'Çalışma Analizi' },
];

const ADMIN_NAV = [
  { id: 'admin', icon: '⚙️', label: 'Admin Paneli' },
  { id: 'users', icon: '👥', label: 'Kullanıcı Yönetimi' },
];

export default function Sidebar({ activePage, onNavigate, user, profile }) {
  const [urgentCount, setUrgentCount] = useState(0);
  const [openActionsCount, setOpenActionsCount] = useState(0);

  const role = profile?.role || 'personel';
  const allowed = ROLE_ACCESS[role] || ROLE_ACCESS['personel'];

  useEffect(() => {
    if (!user) return;
    if (allowed.includes('deadlines')) {
      getDeadlines(user.id).then(({ data }) => {
        if (!data) return;
        const n = data.filter(d => {
          const days = Math.ceil((new Date(d.due_date) - new Date()) / 86400000);
          return days <= 3 && days >= 0 && d.status !== '✅ Completed';
        }).length;
        setUrgentCount(n);
      });
    }
    if (allowed.includes('meetings')) {
      getMeetingActions(user.id).then(({ data }) => {
        if (!data) return;
        setOpenActionsCount(data.filter(a => a.status !== '✅ Completed').length);
      });
    }
  }, [user, role]);

  const badges = { deadlines: urgentCount || null, meetings: openActionsCount || null };
  const initials = (profile?.full_name?.[0] || user?.email?.[0] || 'U').toUpperCase();
  const displayName = profile?.full_name || user?.email || '';
  const roleLabel = ROLE_LABELS[role] || role;

  const visibleNav = ALL_NAV.filter(item => allowed.includes(item.id));
  const visibleAdmin = ADMIN_NAV.filter(item => allowed.includes(item.id));

  return (
    <nav className="sidebar">
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
            onClick={() => onNavigate(item.id)}
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
                onClick={() => onNavigate(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </>
        )}
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name" title={user?.email}>{displayName.split('@')[0]}</div>
            <div className="sidebar-user-role">{roleLabel}</div>
          </div>
          <button className="sign-out-btn" onClick={() => signOut()} title="Çıkış">⎋</button>
        </div>
      </div>
    </nav>
  );
}
