import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProfile } from '../App';

// ═══════════════════════════════════════════════════════════════════════════════
// SABİTLER
// ═══════════════════════════════════════════════════════════════════════════════

const MODULE_META = {
  gündemler:            { icon: '📋', color: '#7c3aed', label: 'Gündemler' },
  direktör_gündemleri:  { icon: '🗂', color: '#6d28d9', label: 'Direktör Gündemleri' },
  donörler:             { icon: '🤝', color: '#0891b2', label: 'Donör CRM' },
  toplantılar:          { icon: '📋', color: '#2563eb', label: 'Toplantılar' },
  iş_kayıtları:         { icon: '🗓', color: '#d97706', label: 'İş Kayıtları' },
  birim_raporları:      { icon: '📊', color: '#059669', label: 'Birim Raporları' },
  network:              { icon: '🕸️', color: '#dc2626', label: 'Network' },
  fonlar:               { icon: '💰', color: '#ca8a04', label: 'Fon Fırsatları' },
  formlar:              { icon: '📋', color: '#4f46e5', label: 'Formlar' },
  kapasite:             { icon: '📚', color: '#9333ea', label: 'Kapasite Geliştirme' },
  etkinlikler:          { icon: '📅', color: '#e11d48', label: 'Etkinlikler' },
  notlar:               { icon: '📝', color: '#f59e0b', label: 'Notlar' },
  dokümanlar:           { icon: '📄', color: '#6366f1', label: 'Dokümanlar' },
};

const ACTION_VERBS = {
  oluşturdu: { icon: '➕', color: '#16a34a' },
  güncelledi: { icon: '✏️', color: '#2563eb' },
  sildi: { icon: '🗑', color: '#dc2626' },
  gönderdi: { icon: '📤', color: '#7c3aed' },
  kaydetti: { icon: '💾', color: '#0891b2' },
  tamamladı: { icon: '✅', color: '#059669' },
  onayladı: { icon: '👍', color: '#16a34a' },
  'yorum ekledi': { icon: '💬', color: '#d97706' },
  yükledi: { icon: '📎', color: '#6366f1' },
};

const ROLE_LABELS = {
  direktor: 'Direktör',
  direktor_yardimcisi: 'Direktör Yrd.',
  asistan: 'Asistan',
  koordinator: 'Koordinatör',
  personel: 'Personel',
};

// ═══════════════════════════════════════════════════════════════════════════════
// TIMELINE KARTI
// ═══════════════════════════════════════════════════════════════════════════════

function TimelineCard({ item }) {
  const mod = MODULE_META[item.module] || { icon: '📌', color: '#6b7280', label: item.module };
  const verb = ACTION_VERBS[item.action] || { icon: '•', color: '#6b7280' };
  const timeAgo = getRelativeTime(item.created_at);

  return (
    <div style={{
      display: 'flex', gap: 14, padding: '14px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      {/* Avatar */}
      <div style={{
        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
        background: `${mod.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, border: `2px solid ${mod.color}30`,
      }}>
        {mod.icon}
      </div>

      {/* İçerik */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
          <strong>{item.user_name}</strong>{' '}
          <span style={{ color: verb.color, fontWeight: 600 }}>{item.action}</span>{' '}
          {item.entity_type && <span style={{ color: 'var(--text-secondary)' }}>{item.entity_type}</span>}
          {item.entity_name && (
            <span style={{ fontWeight: 600, color: 'var(--text)' }}> "{item.entity_name}"</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
            background: `${mod.color}12`, color: mod.color,
          }}>
            {mod.icon} {mod.label}
          </span>
          {item.unit && (
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-hover)', padding: '2px 8px', borderRadius: 12 }}>
              {item.unit}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{timeAgo}</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABLO GÖRÜNÜMÜ
// ═══════════════════════════════════════════════════════════════════════════════

function ActivityTable({ data, page, setPage, pageSize }) {
  const totalPages = Math.ceil(data.length / pageSize);
  const paged = data.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg-sidebar)' }}>
            <th style={thStyle}>Kullanıcı</th>
            <th style={thStyle}>İşlem</th>
            <th style={thStyle}>Modül</th>
            <th style={thStyle}>Detay</th>
            <th style={thStyle}>Birim</th>
            <th style={thStyle}>Tarih</th>
          </tr>
        </thead>
        <tbody>
          {paged.map(item => {
            const mod = MODULE_META[item.module] || { icon: '📌', color: '#6b7280', label: item.module };
            const verb = ACTION_VERBS[item.action] || { icon: '•', color: '#6b7280' };
            return (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-sidebar)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{item.user_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{ROLE_LABELS[item.user_role] || item.user_role}</div>
                </td>
                <td style={tdStyle}>
                  <span style={{ color: verb.color, fontWeight: 600, fontSize: 13 }}>{verb.icon} {item.action}</span>
                </td>
                <td style={tdStyle}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: `${mod.color}12`, color: mod.color,
                  }}>
                    {mod.icon} {mod.label}
                  </span>
                </td>
                <td style={{ ...tdStyle, maxWidth: 250 }}>
                  {item.entity_type && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.entity_type}: </span>}
                  {item.entity_name && <span style={{ fontSize: 13, fontWeight: 500 }}>{item.entity_name}</span>}
                  {!item.entity_type && !item.entity_name && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>—</span>}
                </td>
                <td style={tdStyle}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.unit || '—'}</span>
                </td>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {new Date(item.created_at).toLocaleDateString('tr-TR')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.7 }}>
                    {new Date(item.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={pageBtnStyle(page === 0)}>← Önceki</button>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{page + 1} / {totalPages} ({data.length} kayıt)</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={pageBtnStyle(page >= totalPages - 1)}>Sonraki →</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANA SAYFA
// ═══════════════════════════════════════════════════════════════════════════════

export default function Activities() {
  const profile = useProfile();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('week');
  const [viewMode, setViewMode] = useState('timeline'); // timeline | table
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;

  const isDirector = ['direktor', 'direktor_yardimcisi', 'asistan'].includes(profile?.role);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (!error && data) setActivities(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  // Benzersiz birimler ve kullanıcılar (filtre seçenekleri için)
  const uniqueUnits = useMemo(() => [...new Set(activities.map(a => a.unit).filter(Boolean))].sort(), [activities]);
  const uniqueUsers = useMemo(() => {
    const map = {};
    activities.forEach(a => { if (a.user_name) map[a.user_id] = a.user_name; });
    return Object.entries(map).sort((a, b) => a[1].localeCompare(b[1]));
  }, [activities]);

  // Filtreleme
  const filtered = useMemo(() => {
    let result = activities;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        (a.user_name || '').toLowerCase().includes(q) ||
        (a.entity_name || '').toLowerCase().includes(q) ||
        (a.action || '').toLowerCase().includes(q) ||
        (a.module || '').toLowerCase().includes(q)
      );
    }

    if (moduleFilter !== 'all') result = result.filter(a => a.module === moduleFilter);
    if (unitFilter !== 'all') result = result.filter(a => a.unit === unitFilter);
    if (userFilter !== 'all') result = result.filter(a => a.user_id === userFilter);

    if (dateFilter !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      if (dateFilter === 'today') cutoff.setHours(0, 0, 0, 0);
      else if (dateFilter === 'week') cutoff.setDate(now.getDate() - 7);
      else if (dateFilter === 'month') cutoff.setMonth(now.getMonth() - 1);
      result = result.filter(a => new Date(a.created_at) >= cutoff);
    }

    return result;
  }, [activities, search, moduleFilter, unitFilter, userFilter, dateFilter]);

  // Timeline için grupla — güne göre
  const groupedByDay = useMemo(() => {
    const groups = {};
    filtered.forEach(a => {
      const day = new Date(a.created_at).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      if (!groups[day]) groups[day] = [];
      groups[day].push(a);
    });
    return groups;
  }, [filtered]);

  // KPI
  const kpis = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    return {
      total: activities.length,
      today: activities.filter(a => new Date(a.created_at) >= today).length,
      week: activities.filter(a => new Date(a.created_at) >= weekAgo).length,
      uniqueUsers: new Set(activities.filter(a => new Date(a.created_at) >= weekAgo).map(a => a.user_id)).size,
    };
  }, [activities]);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Başlık */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text)' }}>📊 Aktiviteler</h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>
            {isDirector ? 'Tüm birimlerin sistem aktiviteleri' : `${profile?.unit || 'Birim'} aktiviteleri`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setViewMode('timeline')}
            style={tabBtnStyle(viewMode === 'timeline')}>📰 Timeline</button>
          <button onClick={() => { setViewMode('table'); setPage(0); }}
            style={tabBtnStyle(viewMode === 'table')}>📋 Tablo</button>
        </div>
      </div>

      {/* KPI Kartları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 24 }}>
        <KpiCard icon="📊" label="Toplam Aktivite" value={kpis.total} color="#2563eb" />
        <KpiCard icon="📅" label="Bugün" value={kpis.today} color="#059669" />
        <KpiCard icon="📈" label="Bu Hafta" value={kpis.week} color="#7c3aed" />
        <KpiCard icon="👥" label="Aktif Kullanıcı (7g)" value={kpis.uniqueUsers} color="#d97706" />
      </div>

      {/* Filtreler */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20,
        background: 'var(--bg-card)', padding: '14px 18px', borderRadius: 12,
        border: '1px solid var(--border)',
      }}>
        <input type="text" placeholder="Kullanıcı, işlem, modül ara..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          style={inputStyle} />

        <select value={moduleFilter} onChange={e => { setModuleFilter(e.target.value); setPage(0); }} style={selectStyle}>
          <option value="all">Tüm Modüller</option>
          {Object.entries(MODULE_META).map(([key, { icon, label }]) => (
            <option key={key} value={key}>{icon} {label}</option>
          ))}
        </select>

        {isDirector && (
          <select value={unitFilter} onChange={e => { setUnitFilter(e.target.value); setPage(0); }} style={selectStyle}>
            <option value="all">Tüm Birimler</option>
            {uniqueUnits.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        )}

        <select value={userFilter} onChange={e => { setUserFilter(e.target.value); setPage(0); }} style={selectStyle}>
          <option value="all">Tüm Kullanıcılar</option>
          {uniqueUsers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>

        <select value={dateFilter} onChange={e => { setDateFilter(e.target.value); setPage(0); }} style={selectStyle}>
          <option value="all">Tüm Zamanlar</option>
          <option value="today">Bugün</option>
          <option value="week">Son 7 Gün</option>
          <option value="month">Son 30 Gün</option>
        </select>

        <button onClick={fetchActivities} style={{
          padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--bg-input)', color: 'var(--text)', cursor: 'pointer', fontSize: 13,
        }}>🔄</button>
      </div>

      {/* İçerik */}
      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding: 60 }}><div className="loading-spinner" /></div>
      ) : filtered.length === 0 ? (
        <div style={{
          padding: 60, textAlign: 'center', color: 'var(--text-secondary)',
          background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)',
        }}>
          {activities.length === 0 ? '📭 Henüz aktivite kaydı yok. Sistemde işlem yapıldıkça burada görünecek.' : '🔍 Filtrelerle eşleşen aktivite bulunamadı'}
        </div>
      ) : viewMode === 'timeline' ? (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 12,
          border: '1px solid var(--border)', padding: '8px 20px',
        }}>
          {Object.entries(groupedByDay).map(([day, items]) => (
            <div key={day}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)',
                padding: '14px 0 6px', borderBottom: '2px solid var(--border)',
                textTransform: 'capitalize', position: 'sticky', top: 0,
                background: 'var(--bg-card)', zIndex: 1,
              }}>{day}</div>
              {items.map(item => <TimelineCard key={item.id} item={item} />)}
            </div>
          ))}
          {filtered.length > 200 && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
              İlk 200 aktivite gösteriliyor. Daha fazla görmek için filtreleri daraltın.
            </div>
          )}
        </div>
      ) : (
        <ActivityTable data={filtered} page={page} setPage={setPage} pageSize={PAGE_SIZE} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// YARDIMCILAR
// ═══════════════════════════════════════════════════════════════════════════════

function KpiCard({ icon, label, value, color }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 10,
        background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

function getRelativeTime(dateStr) {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'az önce';
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} saat önce`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} gün önce`;
  return d.toLocaleDateString('tr-TR');
}

// ── Stiller ──
const thStyle = {
  padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1px solid var(--border)',
};
const tdStyle = { padding: '12px 16px', fontSize: 13 };
const inputStyle = {
  flex: 1, minWidth: 200, padding: '8px 14px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--bg-input)',
  color: 'var(--text)', fontSize: 13,
};
const selectStyle = {
  padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg-input)', color: 'var(--text)', fontSize: 13,
};
const tabBtnStyle = (active) => ({
  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  border: active ? '2px solid #2563eb' : '1px solid var(--border)',
  background: active ? '#2563eb12' : 'var(--bg-input)',
  color: active ? '#2563eb' : 'var(--text)',
});
const pageBtnStyle = (disabled) => ({
  padding: '6px 16px', borderRadius: 8, fontSize: 13,
  border: '1px solid var(--border)',
  background: disabled ? 'transparent' : 'var(--bg-input)',
  color: disabled ? 'var(--text-secondary)' : 'var(--text)',
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.5 : 1,
});
