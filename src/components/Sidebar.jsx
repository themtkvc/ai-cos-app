import React, { useState, useEffect } from 'react';
import { getDeadlines, getMeetingActions, signOut } from '../lib/supabase';

const NAV_MAIN = [
  { id: 'dashboard', icon: '⚡', label: 'Dashboard' },
  { id: 'chat',      icon: '🤖', label: 'AI Asistan' },
  { id: 'deadlines', icon: '📅', label: 'Görevler & Tarihler' },
  { id: 'donors',    icon: '🤝', label: 'Donör CRM' },
  { id: 'meetings',  icon: '📋', label: 'Toplantı Logu' },
  { id: 'reports',   icon: '📊', label: 'Birim Raporları' },
];

const NAV_ADMIN = [
  { id: 'admin', icon: '⚙️', label: 'Admin Paneli' },
];

export default function Sidebar({ activePage, onNavigate, user }) {
  const [urgentCount, setUrgentCount] = useState(0);
  const [openActionsCount, setOpenActionsCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    getDeadlines(user.id).then(({ data }) => {
      if (!data) return;
      const n = data.filter(d => {
        const days = Math.ceil((new Date(d.due_date) - new Date()) / 86400000);
        return days <= 3 && days >= 0 && d.status !== '✅ Completed';
      }).length;
      setUrgentCount(n);
    });
    getMeetingActions(user.id).then(({ data }) => {
      if (!data) return;
      setOpenActionsCount(data.filter(a => a.status !== '✅ Completed').length);
    });
  }, [user]);

  const badges = { deadlines: urgentCount || null, meetings: openActionsCount || null };
  const initials = user?.email?.[0]?.toUpperCase() || 'D';

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-title">🏛 AI Chief of Staff</div>
        <div className="sidebar-logo-sub">Direktör Ofisi</div>
      </div>

      <div className="sidebar-nav">
        <div className="nav-section-label">Ana Menü</div>
        {NAV_MAIN.map(item => (
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

        <div className="nav-section-label" style={{marginTop:16}}>Yönetim</div>
        {NAV_ADMIN.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.email}</div>
            <div className="sidebar-user-role">Direktör</div>
          </div>
          <button className="sign-out-btn" onClick={() => signOut()} title="Çıkış">⎋</button>
        </div>
      </div>
    </nav>
  );
}
