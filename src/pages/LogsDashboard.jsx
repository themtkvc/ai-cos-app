import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, ComposedChart, Area,
} from 'recharts';
import { getDashboardLogs } from '../lib/supabase';
import { ROLE_LABELS, toLocalDateStr as _toLocalDateStr } from '../lib/constants';

// ── SABITLER ─────────────────────────────────────────────────────────────────
const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                   'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const DAYS_SHORT = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];

const STATUS_META = {
  ofis:         { label: 'Ofisten', color: '#1a3a5c' },
  ev:           { label: 'Evden',   color: '#2e6da4' },
  saha:         { label: 'Sahada',  color: '#1e7a4a' },
  saglik_izni:  { label: 'Sağlık İzni', color: '#ef4444' },
  egitim_izni:  { label: 'Eğitim İzni', color: '#8b5cf6' },
  yillik_izin:  { label: 'Yıllık İzin', color: '#f59e0b' },
  calismiyor:   { label: 'Çalışmıyor',  color: '#9ca3af' },
};

const CHART_COLORS = ['#1a3a5c','#2e6da4','#1e7a4a','#6b3fa0','#c47a1e','#16a34a','#ef4444','#f59e0b','#8b5cf6','#06b6d4'];

// ── YARDIMCI FONKSİYONLAR ────────────────────────────────────────────────────
function getItemMins(item) {
  if (!item) return 0;
  if (item.all_day) return 480;
  if (item.start_time && item.end_time) {
    const [sh, sm] = item.start_time.split(':').map(Number);
    const [eh, em] = item.end_time.split(':').map(Number);
    return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
  }
  return parseInt(item.duration_minutes) || 0;
}

function getLogWorkMins(log) {
  return (log.work_items || []).reduce((s, i) => s + getItemMins(i), 0);
}

function getLogOtMins(log) {
  return (log.overtime_items || []).reduce((s, i) => s + getItemMins(i), 0);
}

function fmtH(mins) {
  if (!mins || mins === 0) return '0s';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? (m > 0 ? `${h}s ${m}dk` : `${h}s`) : `${m}dk`;
}

function fmtHShort(mins) {
  return (mins / 60).toFixed(1);
}

const toLocalDateStr = _toLocalDateStr;

function getWeekRange(offset = 0) {
  const now = new Date();
  now.setDate(now.getDate() + offset * 7);
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now); mon.setDate(now.getDate() + diff);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { start: toLocalDateStr(mon), end: toLocalDateStr(sun), label: weekLabel(mon, sun) };
}

function getMonthRange(offset = 0) {
  const now = new Date();
  now.setMonth(now.getMonth() + offset);
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: toLocalDateStr(start),
    end:   toLocalDateStr(end),
    label: `${MONTHS_TR[start.getMonth()]} ${start.getFullYear()}`,
  };
}

function weekLabel(mon, sun) {
  const fmt = d => `${d.getDate()} ${MONTHS_TR[d.getMonth()]}`;
  return `${fmt(mon)} — ${fmt(sun)}`;
}

// Tarih aralığındaki tüm günleri listele
function getDatesInRange(start, end) {
  const dates = [];
  const cur = new Date(start + 'T12:00:00');
  const endD = new Date(end + 'T12:00:00');
  while (cur <= endD) {
    dates.push(toLocalDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// ── TOOLTIP ÖZEL ─────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'white', border: '1px solid #e5e7eb', borderRadius: 10,
      padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, color: '#374151' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 12, color: p.color, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(1) + 's' : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// ── STAT KARTI ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color = 'var(--navy)' }) {
  return (
    <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: color + '15', fontSize: 22, flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', marginBottom: 3 }}>
          {label}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: 'var(--font-display)', lineHeight: 1 }}>
          {value}
        </div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── VERİ İŞLEME ──────────────────────────────────────────────────────────────
function processLogs(logs, dateRange) {
  if (!logs?.length) return null;

  const allDates = getDatesInRange(dateRange.start, dateRange.end);

  // Toplam istatistikler
  const totalWorkMins  = logs.reduce((s, l) => s + getLogWorkMins(l), 0);
  const totalOtMins    = logs.reduce((s, l) => s + getLogOtMins(l), 0);
  const workDays       = logs.filter(l => !['saglik_izni','egitim_izni','yillik_izin','calismiyor'].includes(l.work_status)).length;
  const avgDailyMins   = workDays > 0 ? Math.round(totalWorkMins / workDays) : 0;
  const uniqueUsers    = [...new Set(logs.map(l => l.user_id))];
  const weekdays       = allDates.filter(d => { const day = new Date(d+'T12:00:00').getDay(); return day !== 0 && day !== 6; });

  // Gönderim oranı (çalışan kişi * iş günü başına)
  const expectedEntries = uniqueUsers.length * weekdays.length;
  const submissionRate  = expectedEntries > 0 ? Math.round((logs.length / expectedEntries) * 100) : 0;

  // Günlük saat verisi
  const byDate = {};
  allDates.forEach(d => { byDate[d] = { date: d, workMins: 0, otMins: 0, count: 0 }; });
  logs.forEach(l => {
    if (!byDate[l.log_date]) return;
    byDate[l.log_date].workMins += getLogWorkMins(l);
    byDate[l.log_date].otMins   += getLogOtMins(l);
    byDate[l.log_date].count    += 1;
  });

  const dailyData = allDates.map(d => {
    const entry = byDate[d];
    const dateObj = new Date(d + 'T12:00:00');
    const dayIdx  = dateObj.getDay();
    const label   = `${DAYS_SHORT[dayIdx === 0 ? 6 : dayIdx - 1]} ${dateObj.getDate()}/${String(dateObj.getMonth()+1).padStart(2,'0')}`;
    const avg     = entry.count > 0 ? entry.workMins / entry.count : 0;
    return {
      date: d, label,
      totalHours:  parseFloat(fmtHShort(entry.workMins)),
      avgHours:    parseFloat(fmtHShort(avg)),
      otHours:     parseFloat(fmtHShort(entry.otMins)),
      count:       entry.count,
      isWeekend:   dayIdx === 0 || dayIdx === 6,
    };
  });

  // Çalışma durumu dağılımı
  const statusCounts = {};
  logs.forEach(l => {
    statusCounts[l.work_status] = (statusCounts[l.work_status] || 0) + 1;
  });
  const statusData = Object.entries(statusCounts)
    .map(([s, count]) => ({ name: STATUS_META[s]?.label || s, value: count, color: STATUS_META[s]?.color || '#ccc', status: s }))
    .sort((a, b) => b.value - a.value);

  // Kategori dağılımı
  const catMins = {};
  logs.forEach(l => {
    (l.work_items || []).forEach(item => {
      if (item.category) catMins[item.category] = (catMins[item.category] || 0) + getItemMins(item);
    });
  });
  const categoryData = Object.entries(catMins)
    .map(([cat, mins], i) => ({ category: cat, hours: parseFloat(fmtHShort(mins)), color: CHART_COLORS[i % CHART_COLORS.length] }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 10);

  // Kişi bazlı karşılaştırma
  const personMap = {};
  logs.forEach(l => {
    if (!personMap[l.user_id]) {
      personMap[l.user_id] = { name: l.full_name || l.user_id.slice(0,8), unit: l.unit, workMins: 0, otMins: 0, days: 0, role: l.user_role };
    }
    personMap[l.user_id].workMins += getLogWorkMins(l);
    personMap[l.user_id].otMins   += getLogOtMins(l);
    personMap[l.user_id].days     += 1;
  });
  const personData = Object.values(personMap)
    .map(p => ({
      name:    (p.name || '').split('@')[0],
      unit:    p.unit,
      role:    p.role,
      hours:   parseFloat(fmtHShort(p.workMins)),
      otHours: parseFloat(fmtHShort(p.otMins)),
      days:    p.days,
      avgHours: p.days > 0 ? parseFloat(fmtHShort(p.workMins / p.days)) : 0,
    }))
    .sort((a, b) => b.hours - a.hours);

  // Birim bazlı karşılaştırma
  const unitMap = {};
  logs.forEach(l => {
    const u = l.unit || 'Birim Belirtilmemiş';
    if (!unitMap[u]) unitMap[u] = { unit: u, workMins: 0, otMins: 0, personCount: new Set(), dayCount: 0 };
    unitMap[u].workMins += getLogWorkMins(l);
    unitMap[u].otMins   += getLogOtMins(l);
    unitMap[u].personCount.add(l.user_id);
    unitMap[u].dayCount += 1;
  });
  const unitData = Object.values(unitMap)
    .map((u, i) => ({
      unit:      u.unit,
      hours:     parseFloat(fmtHShort(u.workMins)),
      otHours:   parseFloat(fmtHShort(u.otMins)),
      persons:   u.personCount.size,
      avgHours:  u.personCount.size > 0 ? parseFloat(fmtHShort(u.workMins / u.personCount.size)) : 0,
      color:     CHART_COLORS[i % CHART_COLORS.length],
    }))
    .sort((a, b) => b.hours - a.hours);

  return { totalWorkMins, totalOtMins, workDays, avgDailyMins, submissionRate,
           uniqueUsers, dailyData, statusData, categoryData, personData, unitData };
}

// ── ANA COMPONENT ─────────────────────────────────────────────────────────────
export default function LogsDashboard({ user, profile }) {
  const [period, setPeriod]           = useState('week');
  const [offset, setOffset]           = useState(0);
  const [filterType, setFilterType]   = useState(() => {
    // Başlangıç filtresi: profil henüz yüklenmemiş olabilir, useEffect ile düzeltilir
    const r = profile?.role;
    if (['direktor','direktor_yardimcisi','asistan'].includes(r)) return 'all';
    if (r === 'koordinator') return 'unit';
    return 'personal';
  });
  const [selectedPerson, setSelectedPerson] = useState('');   // user_id
  const [selectedUnit, setSelectedUnit]     = useState('');   // unit name
  const [allLogs, setAllLogs]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  const role = profile?.role;
  const isDirectorLevel = ['direktor', 'direktor_yardimcisi', 'asistan'].includes(role);
  const canViewUnit = ['koordinator','direktor','direktor_yardimcisi','asistan'].includes(role) || profile?.can_view_dashboard;
  const canViewAll  = isDirectorLevel || profile?.can_view_dashboard;

  // Profile async yüklenince filterType'ı düzelt (race condition fix)
  useEffect(() => {
    if (!profile?.role) return;
    setFilterType(curr => {
      if (curr !== 'personal') return curr; // kullanıcı zaten değiştirdi
      const r = profile.role;
      if (['direktor','direktor_yardimcisi','asistan'].includes(r)) return 'all';
      if (r === 'koordinator') return 'unit';
      return 'personal';
    });
  }, [profile?.role]); // eslint-disable-line

  const dateRange = useMemo(
    () => period === 'week' ? getWeekRange(offset) : getMonthRange(offset),
    [period, offset]
  );

  // Her zaman tüm logu çek, filtreleme client-side
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await getDashboardLogs(dateRange.start, dateRange.end);
    if (err) { setError(err.message); setLoading(false); return; }
    setAllLogs(data || []);
    setLoading(false);
  }, [dateRange.start, dateRange.end]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Dropdown seçenekleri: mevcut loglardan türet
  const allPeople = useMemo(() => {
    const map = {};
    allLogs.forEach(l => { if (l.user_id && l.full_name) map[l.user_id] = l.full_name; });
    return Object.entries(map).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allLogs]);

  const allUnits = useMemo(() => {
    const s = new Set(allLogs.map(l => l.unit).filter(Boolean));
    return [...s].sort();
  }, [allLogs]);

  // Filtrelenmiş loglar
  const logs = useMemo(() => {
    if (filterType === 'personal') return allLogs.filter(l => l.user_id === user.id);
    if (filterType === 'person')   return selectedPerson ? allLogs.filter(l => l.user_id === selectedPerson) : allLogs.filter(l => l.user_id === user.id);
    if (filterType === 'unit')     return selectedUnit   ? allLogs.filter(l => l.unit === selectedUnit) : allLogs;
    return allLogs; // 'all'
  }, [allLogs, filterType, selectedPerson, selectedUnit, user.id]);

  const stats = useMemo(() => processLogs(logs, dateRange), [logs, dateRange]);

  const showPersonChart = filterType !== 'personal' && filterType !== 'person' && (stats?.personData?.length > 1);
  const showUnitChart   = filterType === 'all' && (stats?.unitData?.length > 1);

  // Başlık için aktif filtre etiketi
  const filterLabel = useMemo(() => {
    if (filterType === 'personal') return profile?.full_name || user?.email?.split('@')[0];
    if (filterType === 'person')   return allPeople.find(p => p.id === selectedPerson)?.name || 'Personel Seç';
    if (filterType === 'unit')     return selectedUnit || 'Birim Seç';
    return 'Tüm Departman';
  }, [filterType, selectedPerson, selectedUnit, allPeople, profile, user]);

  return (
    <div className="page" style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* BAŞLIK */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">📊 Çalışma Analizi</h1>
            <p className="page-subtitle">
              {filterLabel} · {ROLE_LABELS[role] || 'Personel'}
            </p>
          </div>

          {/* Görünüm seçici — direktör için tam filtre */}
          {(canViewUnit || canViewAll) ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Tip butonları */}
              <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 10, padding: 4, border: '1px solid var(--border)' }}>
                <ViewBtn active={filterType === 'personal'} onClick={() => { setFilterType('personal'); setOffset(0); }}>👤 Ben</ViewBtn>
                {canViewAll && (
                  <ViewBtn active={filterType === 'person'} onClick={() => { setFilterType('person'); setOffset(0); }}>🔍 Personel</ViewBtn>
                )}
                {canViewUnit && (
                  <ViewBtn active={filterType === 'unit'} onClick={() => { setFilterType('unit'); setOffset(0); }}>🏢 Birim</ViewBtn>
                )}
                {canViewAll && (
                  <ViewBtn active={filterType === 'all'} onClick={() => { setFilterType('all'); setOffset(0); }}>🌐 Departman</ViewBtn>
                )}
              </div>

              {/* Personel dropdown */}
              {filterType === 'person' && (
                <select
                  value={selectedPerson}
                  onChange={e => setSelectedPerson(e.target.value)}
                  style={{
                    padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--navy)',
                    background: 'white', color: 'var(--navy)', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', outline: 'none', minWidth: 180,
                  }}
                >
                  <option value="">— Personel seçin —</option>
                  {allPeople.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}

              {/* Birim dropdown */}
              {filterType === 'unit' && (
                <select
                  value={selectedUnit}
                  onChange={e => setSelectedUnit(e.target.value)}
                  style={{
                    padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--navy)',
                    background: 'white', color: 'var(--navy)', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', outline: 'none', minWidth: 160,
                  }}
                >
                  <option value="">— Birim seçin —</option>
                  {allUnits.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              )}
            </div>
          ) : null}
        </div>

        {/* Dönem seçici + navigasyon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <PeriodBtn active={period === 'week'} onClick={() => { setPeriod('week'); setOffset(0); }}>Haftalık</PeriodBtn>
            <PeriodBtn active={period === 'month'} onClick={() => { setPeriod('month'); setOffset(0); }}>Aylık</PeriodBtn>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setOffset(o => o - 1)} style={navBtnStyle}>←</button>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--navy)', minWidth: 180, textAlign: 'center' }}>
              {dateRange.label}
            </span>
            <button onClick={() => setOffset(o => o + 1)} disabled={offset >= 0} style={{ ...navBtnStyle, opacity: offset >= 0 ? 0.4 : 1 }}>→</button>
          </div>

          {offset !== 0 && (
            <button onClick={() => setOffset(0)} style={{
              fontSize: 12, color: 'var(--navy)', background: 'var(--navy)10',
              border: '1px solid var(--navy)22', borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
            }}>Bu {period === 'week' ? 'Hafta' : 'Ay'}</button>
          )}
        </div>
      </div>

      {/* YÜKLENİYOR */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
          Veriler yükleniyor…
        </div>
      )}

      {/* HATA */}
      {error && !loading && (
        <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--red)' }}>
          ⚠️ {error}
        </div>
      )}

      {/* VERİ YOK */}
      {!loading && !error && !stats && (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--navy)', marginBottom: 6 }}>Bu dönemde kayıt bulunamadı</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {dateRange.label} için gönderilmiş iş logu yok.
          </div>
        </div>
      )}

      {!loading && !error && stats && (
        <>
          {/* ÖZET KARTLAR */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            <StatCard
              icon="⏱️" label="TOPLAM ÇALIŞMA" color="#1a3a5c"
              value={fmtH(stats.totalWorkMins)}
              sub={`${stats.workDays} iş günü · ${stats.uniqueUsers.length} kişi`}
            />
            <StatCard
              icon="📅" label="ORTALAMA GÜNLÜK" color="#2e6da4"
              value={fmtH(stats.avgDailyMins)}
              sub={stats.avgDailyMins >= 480 ? '✓ Tam mesai' : stats.avgDailyMins > 0 ? `${fmtH(480 - stats.avgDailyMins)} eksik` : '—'}
            />
            <StatCard
              icon="✅" label="GÖNDERİM ORANI" color="#16a34a"
              value={`%${stats.submissionRate}`}
              sub={`${logs.length} kayıt gönderildi`}
            />
            <StatCard
              icon="🌙" label="TOPLAM MESAİ" color="#f59e0b"
              value={stats.totalOtMins > 0 ? fmtH(stats.totalOtMins) : '—'}
              sub={stats.totalOtMins > 0 ? 'ek mesai saati' : 'mesai girilmemiş'}
            />
          </div>

          {/* SATIR 1: Günlük Saatler + Durum Dağılımı */}
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14, marginBottom: 14 }}>

            {/* Günlük Çalışma Saatleri */}
            <div className="card" style={{ padding: '18px 16px' }}>
              <SectionTitle>📈 Günlük Çalışma Saatleri</SectionTitle>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={stats.dailyData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 10.5, fill: '#6b7280' }} unit="s" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={8} stroke="#16a34a" strokeDasharray="4 4" label={{ value: '8s', fontSize: 10, fill: '#16a34a', position: 'right' }} />
                  <Bar dataKey="avgHours" name={filterType === 'personal' || filterType === 'person' ? 'Çalışma (saat)' : 'Ort. Çalışma'} fill="#1a3a5c" radius={[4,4,0,0]}
                    cell={stats.dailyData.map((d, i) => <Cell key={i} fill={d.isWeekend ? '#9ca3af' : '#1a3a5c'} opacity={d.isWeekend ? 0.4 : 0.9} />)}
                  />
                  {stats.totalOtMins > 0 && (
                    <Bar dataKey="otHours" name="Mesai" fill="#f59e0b" radius={[4,4,0,0]} opacity={0.8} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Çalışma Durumu Dağılımı */}
            <div className="card" style={{ padding: '18px 16px' }}>
              <SectionTitle>🏷️ Durum Dağılımı</SectionTitle>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={stats.statusData}
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={75}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {stats.statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val, name) => [`${val} gün`, name]} />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', justifyContent: 'center', marginTop: 8 }}>
                {stats.statusData.map((s, i) => (
                  <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                    {s.name}: <strong>{s.value}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* SATIR 2: Kategori + Haftalık Trend */}
          <div style={{ display: 'grid', gridTemplateColumns: period === 'month' ? '1fr 1fr' : '1fr', gap: 14, marginBottom: 14 }}>

            {/* Kategori Dağılımı */}
            {stats.categoryData.length > 0 && (
              <div className="card" style={{ padding: '18px 16px' }}>
                <SectionTitle>📂 Kategori Dağılımı (saat)</SectionTitle>
                <ResponsiveContainer width="100%" height={Math.max(180, stats.categoryData.length * 30)}>
                  <BarChart
                    layout="vertical"
                    data={stats.categoryData}
                    margin={{ top: 0, right: 40, bottom: 0, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10.5 }} unit="s" />
                    <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: '#374151' }} width={130} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="hours" name="Süre" radius={[0,4,4,0]}>
                      {stats.categoryData.map((entry, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Aylık görünümde haftalık kırılım */}
            {period === 'month' && (
              <div className="card" style={{ padding: '18px 16px' }}>
                <SectionTitle>📅 Haftalık Kırılım</SectionTitle>
                <WeeklyBreakdown logs={logs} dateRange={dateRange} />
              </div>
            )}
          </div>

          {/* SATIR 3: Kişi Bazlı Karşılaştırma (birden fazla kişi varsa) */}
          {showPersonChart && (
            <div className="card" style={{ padding: '18px 16px', marginBottom: 14 }}>
              <SectionTitle>👥 Kişi Bazlı Karşılaştırma</SectionTitle>
              <div style={{ overflowX: 'auto' }}>
                <ResponsiveContainer width="100%" height={280} minWidth={stats.personData.length * 70}>
                  <BarChart data={stats.personData} margin={{ top: 8, right: 8, bottom: 60, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="name"
                      tick={<PersonAxisTick />}
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 10.5 }} unit="s" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine y={8 * (period === 'week' ? 5 : 20)} stroke="#16a34a" strokeDasharray="4 4" />
                    <Bar dataKey="hours" name="Çalışma" fill="#1a3a5c" radius={[4,4,0,0]} />
                    {stats.totalOtMins > 0 && (
                      <Bar dataKey="otHours" name="Mesai" fill="#f59e0b" radius={[4,4,0,0]} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Kişi tablosu */}
              <div style={{ marginTop: 16, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      {['Ad', 'Birim', 'Rol', 'Çalışma', 'Mesai', 'Ort. Gün', 'Kayıt'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 700, fontSize: 11, letterSpacing: '0.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.personData.map((p, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--surface)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{p.name}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{p.unit || '—'}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ fontSize: 11, background: 'var(--navy)10', color: 'var(--navy)', borderRadius: 4, padding: '2px 6px' }}>
                            {ROLE_LABELS[p.role] || p.role}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: p.hours >= (period === 'week' ? 40 : 160) ? '#16a34a' : 'var(--navy)' }}>
                          {fmtH(p.hours * 60)}
                        </td>
                        <td style={{ padding: '8px 10px', color: p.otHours > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
                          {p.otHours > 0 ? fmtH(p.otHours * 60) : '—'}
                        </td>
                        <td style={{ padding: '8px 10px' }}>{fmtH(p.avgHours * 60)}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{p.days} gün</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SATIR 4: Birim Bazlı Karşılaştırma (direktör görünümü) */}
          {showUnitChart && (
            <div className="card" style={{ padding: '18px 16px', marginBottom: 14 }}>
              <SectionTitle>🏢 Birim Bazlı Karşılaştırma</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'center' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.unitData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="unit" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10.5 }} unit="s" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="hours" name="Toplam Çalışma">
                      {stats.unitData.map((u, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                    <Bar dataKey="avgHours" name="Kişi Başı Ort." fill="#94a3b8" opacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>

                {/* Birim özet kartları */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stats.unitData.map((u, i) => (
                    <div key={i} style={{
                      padding: '10px 14px', borderRadius: 10,
                      border: `1px solid ${u.color}33`,
                      background: u.color + '08',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 12.5, color: u.color, marginBottom: 3 }}>
                        {u.unit}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', gap: 10 }}>
                        <span>{fmtH(u.hours * 60)}</span>
                        <span>·</span>
                        <span>{u.persons} kişi</span>
                        <span>·</span>
                        <span>Ort: {fmtH(u.avgHours * 60)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </>
      )}
    </div>
  );
}

// ── HAFTALIK KIRILIM (aylık görünüm için) ─────────────────────────────────────
function WeeklyBreakdown({ logs, dateRange }) {
  const weeks = [];
  const start = new Date(dateRange.start + 'T12:00:00');
  const end   = new Date(dateRange.end + 'T12:00:00');

  // Haftaları bul
  let cur = new Date(start);
  while (cur <= end) {
    const weekStart = toLocalDateStr(cur);
    const weekEnd   = new Date(cur); weekEnd.setDate(cur.getDate() + 6);
    const weekEndStr = toLocalDateStr(weekEnd > end ? end : weekEnd);
    const weekLogs  = logs.filter(l => l.log_date >= weekStart && l.log_date <= weekEndStr);
    const totalMins = weekLogs.reduce((s, l) => s + getLogWorkMins(l), 0);
    const otMins    = weekLogs.reduce((s, l) => s + getLogOtMins(l), 0);
    weeks.push({
      label: `${cur.getDate()}/${String(cur.getMonth()+1).padStart(2,'0')}`,
      hours: parseFloat(fmtHShort(totalMins)),
      otHours: parseFloat(fmtHShort(otMins)),
      count: weekLogs.length,
    });
    cur.setDate(cur.getDate() + 7);
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={weeks} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 10.5 }} unit="s" />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="hours" name="Çalışma" fill="#1a3a5c" radius={[4,4,0,0]} />
        <Line type="monotone" dataKey="otHours" name="Mesai" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── YARDIMCI BUTTON/STYLE COMPONENTLER ───────────────────────────────────────
function ViewBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
      background: active ? 'var(--navy)' : 'transparent',
      color: active ? 'white' : 'var(--text-muted)',
      fontWeight: active ? 700 : 400, fontSize: 12.5,
      fontFamily: 'var(--font-body)', transition: 'all 0.15s',
    }}>{children}</button>
  );
}

function PeriodBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 16px', border: 'none', cursor: 'pointer',
      background: active ? 'var(--navy)' : 'transparent',
      color: active ? 'white' : 'var(--text-muted)',
      fontWeight: active ? 700 : 400, fontSize: 12.5,
      fontFamily: 'var(--font-body)', transition: 'all 0.15s',
    }}>{children}</button>
  );
}

const navBtnStyle = {
  width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--surface)', cursor: 'pointer', fontSize: 16,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--text-muted)', fontFamily: 'var(--font-body)',
};

function SectionTitle({ children }) {
  return (
    <div style={{ fontWeight: 700, fontSize: 11.5, letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 12 }}>
      {children}
    </div>
  );
}

function PersonAxisTick({ x, y, payload }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor="end" fill="#6b7280" fontSize={10.5}
        transform="rotate(-35)">{payload.value}</text>
    </g>
  );
}
