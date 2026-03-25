import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getDashboardLogs } from '../lib/supabase';
import { ROLE_LABELS, avatarColor, fmtDateShort, fmtDayShort, toLocalDateStr } from '../lib/constants';

const NON_WORK = ['saglik_izni','egitim_izni','yillik_izin','calismiyor'];
const STATUS_LABELS = {
  ofis:        'Ofisten',
  ev:          'Evden',
  saha:        'Sahadayım',
  saglik_izni: 'Sağlık İzni',
  egitim_izni: 'Eğitim İzni',
  yillik_izin: 'Yıllık İzin',
  calismiyor:  'Çalışmıyor',
};

// ── TARİH YARDIMCILARI ────────────────────────────────────────────────────────
function today() { return toLocalDateStr(new Date()); }

function thisWeek() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now); mon.setDate(now.getDate() + diff);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { start: toLocalDateStr(mon), end: toLocalDateStr(sun) };
}

function thisMonth() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: toLocalDateStr(start), end: toLocalDateStr(end) };
}

// ── SÜRE HESAPLAMA ───────────────────────────────────────────────────────────
function itemMins(item) {
  if (!item) return 0;
  if (item.all_day) return 480;
  if (item.start_time && item.end_time) {
    const [sh, sm] = item.start_time.split(':').map(Number);
    const [eh, em] = item.end_time.split(':').map(Number);
    return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
  }
  return parseInt(item.duration_minutes) || 0;
}
function fmtH(mins) {
  if (!mins || mins === 0) return '—';
  return (mins / 60).toFixed(1) + 'h';
}
function logTotalMins(log) {
  const w = (log.work_items     || []).reduce((s, i) => s + itemMins(i), 0);
  const o = (log.overtime_items || []).reduce((s, i) => s + itemMins(i), 0);
  return w + o;
}

// ── SATIR DÜZLEŞTIRME ────────────────────────────────────────────────────────
// Her log'u iş kalemi satırlarına dönüştür
function flattenLog(log) {
  const rows = [];
  const isLeave = NON_WORK.includes(log.work_status);

  if (isLeave) {
    rows.push({
      log_date: log.log_date,
      title:    STATUS_LABELS[log.work_status] || log.work_status,
      category: null,
      mins:     0,
      isLeave:  true,
      status:   log.work_status,
      isOt:     false,
    });
    return rows;
  }

  (log.work_items || []).forEach(item => {
    rows.push({
      log_date: log.log_date,
      title:    item.title || item.description || '—',
      category: item.category || null,
      mins:     itemMins(item),
      isLeave:  false,
      isOt:     false,
    });
  });

  (log.overtime_items || []).forEach(item => {
    rows.push({
      log_date: log.log_date,
      title:    item.title || item.description || '—',
      category: item.category || null,
      mins:     itemMins(item),
      isLeave:  false,
      isOt:     true,
    });
  });

  if (rows.length === 0) {
    rows.push({
      log_date: log.log_date,
      title:    STATUS_LABELS[log.work_status] || '—',
      category: null,
      mins:     0,
      isLeave:  false,
      isOt:     false,
      isEmpty:  true,
    });
  }

  return rows;
}

// ── AVATAR ───────────────────────────────────────────────────────────────────
function Avatar({ name = '', avatarUrl, size = 40 }) {
  const [err, setErr] = useState(false);
  const color    = avatarColor(name);
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  if (avatarUrl && !err) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setErr(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: color, color: 'white',
      fontWeight: 700, fontSize: size * 0.35,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      userSelect: 'none',
    }}>
      {initials}
    </div>
  );
}

// ── İSTATİSTİK KARTI ─────────────────────────────────────────────────────────
function StatCard({ label, value, iconBg, icon }) {
  return (
    <div style={{
      flex: 1, background: 'white', borderRadius: 12,
      border: '1px solid var(--border)', padding: '20px 22px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 6, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
      </div>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, flexShrink: 0,
      }}>
        {icon}
      </div>
    </div>
  );
}

// ── PROJE/KONU BADGE ─────────────────────────────────────────────────────────
function CategoryBadge({ label }) {
  if (!label) return <span style={{ color: 'var(--gray-mid)', fontSize: 12 }}>—</span>;
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px', borderRadius: 6,
      border: '1px solid var(--border)',
      background: 'var(--bg-card)',
      fontSize: 12.5, fontWeight: 500, color: 'var(--text-secondary)',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// ── MESAI BADGE ──────────────────────────────────────────────────────────────
function OtBadge() {
  return (
    <span style={{
      display: 'inline-block', marginLeft: 8,
      padding: '1px 7px', borderRadius: 20,
      background: 'var(--orange-pale)', border: '1px solid var(--gold)99',
      fontSize: 10.5, fontWeight: 700, color: '#92400e',
    }}>Mesai</span>
  );
}

// ── İZİN BADGE ───────────────────────────────────────────────────────────────
const LEAVE_META = {
  saglik_izni: { bg: 'var(--red-pale)', border: '#fecaca', color: '#991b1b', label: 'Sağlık İzni' },
  egitim_izni: { bg: '#f5f3ff', border: '#ddd6fe', color: '#5b21b6', label: 'Eğitim İzni' },
  yillik_izin: { bg: 'var(--orange-pale)', border: '#fde68a', color: '#92400e', label: 'Yıllık İzin' },
  calismiyor:  { bg: '#f9fafb', border: '#e5e7eb', color: '#6b7280', label: 'Çalışmıyor'  },
};
function LeaveBadge({ status }) {
  const m = LEAVE_META[status] || LEAVE_META.calismiyor;
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 12px', borderRadius: 20,
      background: m.bg, border: `1px solid ${m.border}`,
      fontSize: 12, fontWeight: 700, color: m.color,
    }}>
      {m.label}
    </span>
  );
}

// ── BLOCK GÖRÜNÜMÜ — KİŞİ KARTI ──────────────────────────────────────────────
function PersonBlock({ person, rows, searchQ }) {
  const totalMins    = rows.reduce((s, r) => s + (r.mins || 0), 0);
  const totalEntries = rows.length;

  // Arama filtresi
  const visibleRows = searchQ
    ? rows.filter(r =>
        r.title?.toLowerCase().includes(searchQ)    ||
        r.category?.toLowerCase().includes(searchQ) ||
        person.full_name?.toLowerCase().includes(searchQ)
      )
    : rows;

  if (visibleRows.length === 0) return null;

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 14,
      border: '1px solid var(--border)',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* Kişi başlığı */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 24px',
        borderBottom: '1px solid var(--bg-badge)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar name={person.full_name} avatarUrl={person.avatar_url} size={44} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{person.full_name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-light)', marginTop: 2 }}>
              {ROLE_LABELS[person.role] || person.role}
              {person.unit ? ` · ${person.unit}` : ''}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 3 }}>Toplam Saat</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{fmtH(totalMins)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>{totalEntries} kayıt</div>
        </div>
      </div>

      {/* Tablo */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--bg-badge)' }}>
              {['Tarih','Yapılan İş','Proje/Konu','Süre'].map((col, i) => (
                <th key={col} style={{
                  padding: '10px 24px', textAlign: i === 3 ? 'right' : 'left',
                  fontSize: 12.5, fontWeight: 600, color: 'var(--text-light)',
                  background: '#fafafa',
                  width: i === 0 ? '18%' : i === 1 ? '42%' : i === 2 ? '28%' : '12%',
                }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, idx) => (
              <tr key={idx} style={{
                borderBottom: idx < visibleRows.length - 1 ? '1px solid var(--bg)' : 'none',
              }}>
                <td style={{ padding: '12px 24px', fontSize: 13.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  <span style={{ fontWeight: 600 }}>{fmtDayShort(row.log_date)}</span>
                  {' '}
                  <span>{fmtDateShort(row.log_date)}</span>
                </td>
                <td style={{ padding: '12px 24px', fontSize: 13.5, color: 'var(--text)' }}>
                  {row.isLeave ? <LeaveBadge status={row.status} /> : (
                    <>
                      {row.title}
                      {row.isOt && <OtBadge />}
                    </>
                  )}
                </td>
                <td style={{ padding: '12px 24px' }}>
                  {!row.isLeave && <CategoryBadge label={row.category} />}
                </td>
                <td style={{ padding: '12px 24px', textAlign: 'right', fontWeight: 700, fontSize: 13.5, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                  {row.isLeave ? '—' : fmtH(row.mins)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── LİSTE GÖRÜNÜMÜ ────────────────────────────────────────────────────────────
function ListView({ persons, searchQ }) {
  const allRows = [];
  persons.forEach(p => {
    p.rows.forEach(r => allRows.push({ ...r, person: p }));
  });
  allRows.sort((a, b) => b.log_date.localeCompare(a.log_date));

  const visible = searchQ
    ? allRows.filter(r =>
        r.title?.toLowerCase().includes(searchQ)    ||
        r.category?.toLowerCase().includes(searchQ) ||
        r.person.full_name?.toLowerCase().includes(searchQ)
      )
    : allRows;

  if (visible.length === 0) return <EmptyState />;

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)',
      overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--bg-badge)' }}>
            {['Personel','Tarih','Yapılan İş','Proje/Konu','Süre'].map((col, i) => (
              <th key={col} style={{
                padding: '12px 20px', textAlign: i === 4 ? 'right' : 'left',
                fontSize: 12.5, fontWeight: 600, color: 'var(--text-light)',
              }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid var(--bg)' }}>
              <td style={{ padding: '11px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={row.person.full_name} avatarUrl={row.person.avatar_url} size={30} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{row.person.full_name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-light)' }}>{row.person.unit}</div>
                  </div>
                </div>
              </td>
              <td style={{ padding: '11px 20px', fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 600 }}>{fmtDayShort(row.log_date)}</span>{' '}{fmtDateShort(row.log_date)}
              </td>
              <td style={{ padding: '11px 20px', fontSize: 13, color: 'var(--text)' }}>
                {row.isLeave ? <LeaveBadge status={row.status} /> : (
                  <>{row.title}{row.isOt && <OtBadge />}</>
                )}
              </td>
              <td style={{ padding: '11px 20px' }}>
                {!row.isLeave && <CategoryBadge label={row.category} />}
              </td>
              <td style={{ padding: '11px 20px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                {row.isLeave ? '—' : fmtH(row.mins)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── KART GÖRÜNÜMÜ ─────────────────────────────────────────────────────────────
function KartView({ persons, searchQ }) {
  const allRows = [];
  persons.forEach(p => {
    p.rows.forEach(r => allRows.push({ ...r, person: p }));
  });
  allRows.sort((a, b) => b.log_date.localeCompare(a.log_date));

  const visible = searchQ
    ? allRows.filter(r =>
        r.title?.toLowerCase().includes(searchQ)    ||
        r.category?.toLowerCase().includes(searchQ) ||
        r.person.full_name?.toLowerCase().includes(searchQ)
      )
    : allRows;

  if (visible.length === 0) return <EmptyState />;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
      {visible.map((row, idx) => (
        <div key={idx} style={{
          background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)',
          padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Avatar name={row.person.full_name} avatarUrl={row.person.avatar_url} size={32} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{row.person.full_name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-light)' }}>{row.person.unit}</div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-light)', whiteSpace: 'nowrap' }}>
              {fmtDayShort(row.log_date)} {fmtDateShort(row.log_date)}
            </div>
          </div>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)', marginBottom: 8 }}>
            {row.isLeave ? <LeaveBadge status={row.status} /> : (
              <>{row.title}{row.isOt && <OtBadge />}</>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <CategoryBadge label={row.isLeave ? null : row.category} />
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>
              {row.isLeave ? '—' : fmtH(row.mins)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── BOŞ DURUM ─────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{
      textAlign: 'center', padding: '64px 24px',
      background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>Kayıt bulunamadı</div>
      <div style={{ fontSize: 13, color: 'var(--text-light)' }}>Seçilen tarih aralığında giriş yapılmamış.</div>
    </div>
  );
}

// ── RAPOR İNDİR (CSV) ─────────────────────────────────────────────────────────
function downloadCSV(persons, dateLabel) {
  const rows = [['Personel','Birim','Tarih','Yapılan İş','Proje/Konu','Mesai?','Süre (dk)']];
  persons.forEach(p => {
    p.rows.forEach(r => {
      rows.push([
        p.full_name, p.unit || '',
        r.log_date,
        r.title, r.category || '',
        r.isOt ? 'Evet' : 'Hayır',
        r.mins,
      ]);
    });
  });
  const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url;
  a.download = `calisma_kayitlari_${dateLabel}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ── VIEW TOGGLE BUTTON ────────────────────────────────────────────────────────
function ViewBtn({ id, label, icon, active, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 14px', borderRadius: 8, border: 'none',
        background: active ? 'var(--text)' : 'transparent',
        color: active ? 'white' : 'var(--text-muted)',
        fontWeight: 600, fontSize: 13, cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.15s',
      }}
    >
      <span style={{ fontSize: 15 }}>{icon}</span> {label}
    </button>
  );
}

// ── ANA COMPONENT ─────────────────────────────────────────────────────────────
export default function LogsViewer({ user, profile }) {
  const [timePeriod, setTimePeriod]   = useState('week'); // 'today'|'week'|'month'|'custom'
  const [customDate, setCustomDate]   = useState('');
  const [viewMode, setViewMode]       = useState('block'); // 'block'|'liste'|'kart'
  const [searchText, setSearchText]   = useState('');
  const [searchQ, setSearchQ]         = useState('');
  const [personFilter, setPersonFilter] = useState('');
  const [unitFilter, setUnitFilter]   = useState('');
  const [logs, setLogs]               = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  // Debounce search filter (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQ(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const role   = profile?.role;
  const myUnit = profile?.unit;
  const isKoordinator   = ['koordinator','direktor_yardimcisi'].includes(role);
  const isDirectorLevel = ['direktor','asistan'].includes(role);

  // Tarih aralığı
  const { startDate, endDate, dateLabel } = useMemo(() => {
    if (timePeriod === 'today') {
      const t = today();
      return { startDate: t, endDate: t, dateLabel: t };
    }
    if (timePeriod === 'month') {
      const m = thisMonth();
      return { startDate: m.start, endDate: m.end, dateLabel: `${m.start}_${m.end}` };
    }
    if (timePeriod === 'custom' && customDate) {
      return { startDate: customDate, endDate: customDate, dateLabel: customDate };
    }
    const w = thisWeek();
    return { startDate: w.start, endDate: w.end, dateLabel: `${w.start}_${w.end}` };
  }, [timePeriod, customDate]);

  // Veri yükle
  const loadLogs = useCallback(async () => {
    if (!profile) return;
    setLoading(true); setError('');
    const { data, error: err } = await getDashboardLogs(startDate, endDate);
    if (err) { setError(err.message); setLoading(false); return; }
    setLogs(data || []);
    setLoading(false);
  }, [profile, startDate, endDate]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Koordinatör sadece kendi birimini görür
  const scopedLogs = useMemo(() => {
    let r = logs;
    if (isKoordinator && myUnit) r = r.filter(l => l.unit === myUnit);
    return r;
  }, [logs, isKoordinator, myUnit]);

  // Kişi bazlı gruplama
  const personMap = useMemo(() => {
    const m = {};
    scopedLogs.forEach(log => {
      const uid = log.user_id;
      if (!m[uid]) {
        m[uid] = {
          user_id:    uid,
          full_name:  log.full_name  || uid.slice(0,8),
          role:       log.user_role,
          unit:       log.unit || '',
          avatar_url: log.avatar_url || null,
          rows:       [],
        };
      }
      flattenLog(log).forEach(row => m[uid].rows.push(row));
    });
    // Her kişinin satırlarını tarihe göre sırala (yeni → eski)
    Object.values(m).forEach(p => {
      p.rows.sort((a, b) => b.log_date.localeCompare(a.log_date));
    });
    return m;
  }, [scopedLogs]);

  // Filtre seçenekleri
  const allPersons = useMemo(() =>
    Object.values(personMap).sort((a, b) => a.full_name.localeCompare(b.full_name, 'tr')),
  [personMap]);

  const allUnits = useMemo(() =>
    [...new Set(allPersons.map(p => p.unit).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')),
  [allPersons]);

  // Uygulanan filtreler
  const filteredPersons = useMemo(() => {
    let ps = allPersons;
    if (personFilter) ps = ps.filter(p => p.user_id === personFilter);
    if (unitFilter)   ps = ps.filter(p => p.unit === unitFilter);
    return ps;
  }, [allPersons, personFilter, unitFilter]);

  const searchLower = searchQ.toLowerCase().trim();

  // Genel istatistikler
  const stats = useMemo(() => {
    const rows     = filteredPersons.flatMap(p => p.rows);
    const totalMins = rows.reduce((s, r) => s + (r.mins || 0), 0);
    const activeP  = filteredPersons.length;
    return {
      totalEntries: rows.filter(r => !r.isLeave && !r.isEmpty).length,
      totalH:       fmtH(totalMins),
      activeP,
      avgH:         activeP ? fmtH(Math.round(totalMins / activeP)) : '—',
    };
  }, [filteredPersons]);

  // Dönemi etiket
  const periodLabel = timePeriod === 'today'
    ? `Bugün · ${fmtDateShort(startDate)}`
    : timePeriod === 'month'
    ? `Bu Ay · ${MONTHS_TR[new Date(startDate + 'T12:00:00').getMonth()]} ${new Date(startDate + 'T12:00:00').getFullYear()}`
    : timePeriod === 'custom' && customDate
    ? fmtDateShort(customDate)
    : `Bu Hafta · ${fmtDateShort(startDate)} – ${fmtDateShort(endDate)}`;

  return (
    <div style={{ padding: '28px 32px', background: '#f7f8fa', minHeight: '100vh' }}>

      {/* ── Başlık ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>
            Çalışma Kayıtları
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-light)', margin: '6px 0 0', fontWeight: 500 }}>
            {isKoordinator && myUnit ? `${myUnit} birimi personel aktivite kayıtları` : 'Personel günlük aktivite kayıtları'}
          </p>
        </div>
        <button
          onClick={() => downloadCSV(filteredPersons, dateLabel)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: 'var(--text)', color: 'white',
            fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
            fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          ⬇ Rapor İndir
        </button>
      </div>

      {/* ── İstatistik Kartları ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <StatCard label="Toplam Kayıt"    value={stats.totalEntries} iconBg="#eff6ff" icon={<span style={{color:'#3b82f6'}}>🔍</span>} />
        <StatCard label="Toplam Saat"     value={stats.totalH}       iconBg="#f5f3ff" icon={<span style={{color:'#8b5cf6'}}>🕐</span>} />
        <StatCard label="Aktif Personel"  value={stats.activeP}      iconBg="#f0fdf4" icon={<span style={{color:'#22c55e'}}>👥</span>} />
        <StatCard label="Kişi Başı Ort."  value={stats.avgH}         iconBg="#fff7ed" icon={<span style={{color:'#f97316'}}>📊</span>} />
      </div>

      {/* ── Filtre Çubuğu ── */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)',
        padding: '14px 18px', marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        {/* Üst Satır: arama + zaman + filtreler */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Arama */}
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', fontSize: 16 }}>🔍</span>
            <input
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Personel, iş veya proje ara..."
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '9px 12px 9px 36px',
                borderRadius: 8, border: '1.5px solid var(--border)',
                fontSize: 13, fontFamily: 'inherit', color: 'var(--text-secondary)',
                outline: 'none', background: 'var(--bg-hover)',
              }}
            />
          </div>

          {/* Zaman filtreleri */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { id: 'today', label: 'Bugün' },
              { id: 'week',  label: 'Bu Hafta' },
              { id: 'month', label: 'Bu Ay' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTimePeriod(t.id)}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: '1.5px solid',
                  borderColor: timePeriod === t.id ? '#111827' : '#e5e7eb',
                  background: timePeriod === t.id ? '#111827' : 'white',
                  color: timePeriod === t.id ? 'white' : '#374151',
                  fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.12s',
                }}
              >{t.label}</button>
            ))}
            {/* Tarih Seç */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setTimePeriod('custom')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 8, border: '1.5px solid',
                  borderColor: timePeriod === 'custom' ? '#111827' : '#e5e7eb',
                  background: timePeriod === 'custom' ? '#111827' : 'white',
                  color: timePeriod === 'custom' ? 'white' : '#374151',
                  fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >📅 Tarih Seç</button>
              {timePeriod === 'custom' && (
                <input
                  type="date"
                  value={customDate}
                  onChange={e => setCustomDate(e.target.value)}
                  style={{
                    position: 'absolute', top: 42, right: 0, zIndex: 10,
                    padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb',
                    background: 'white', fontFamily: 'inherit', fontSize: 13, outline: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                />
              )}
            </div>
          </div>

          {/* Personel filtre */}
          <select
            value={personFilter}
            onChange={e => setPersonFilter(e.target.value)}
            style={{
              padding: '8px 32px 8px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb',
              fontSize: 13, fontFamily: 'inherit', color: '#374151', background: 'white',
              cursor: 'pointer', outline: 'none', appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
            }}
          >
            <option value="">Tüm Personel</option>
            {allPersons.map(p => <option key={p.user_id} value={p.user_id}>{p.full_name}</option>)}
          </select>

          {/* Departman filtre (direktör seviyesi için) */}
          {(isDirectorLevel) && allUnits.length > 1 && (
            <select
              value={unitFilter}
              onChange={e => setUnitFilter(e.target.value)}
              style={{
                padding: '8px 32px 8px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb',
                fontSize: 13, fontFamily: 'inherit', color: '#374151', background: 'white',
                cursor: 'pointer', outline: 'none', appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
              }}
            >
              <option value="">Tüm Departmanlar</option>
              {allUnits.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          )}
        </div>

        {/* Alt Satır: görünüm seçimi + dönem etiketi */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <div style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>
            {!loading && `${periodLabel} · ${filteredPersons.length} personel · ${filteredPersons.reduce((s,p)=>s+p.rows.length,0)} kayıt`}
          </div>
          <div style={{ display: 'flex', gap: 2, background: '#f3f4f6', borderRadius: 10, padding: 3 }}>
            <ViewBtn id="liste" label="Liste" icon="☰"  active={viewMode==='liste'} onClick={setViewMode} />
            <ViewBtn id="kart"  label="Kart"  icon="⊞"  active={viewMode==='kart'}  onClick={setViewMode} />
            <ViewBtn id="block" label="Block" icon="🗂"  active={viewMode==='block'} onClick={setViewMode} />
          </div>
        </div>
      </div>

      {/* ── Hata ── */}
      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 16,
          background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13,
        }}>⚠️ {error}</div>
      )}

      {/* ── Yükleniyor ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '64px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Kayıtlar yükleniyor…</div>
        </div>
      )}

      {/* ── İçerik ── */}
      {!loading && filteredPersons.length === 0 && <EmptyState />}

      {!loading && filteredPersons.length > 0 && viewMode === 'block' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredPersons.map(person => (
            <PersonBlock key={person.user_id} person={person} rows={person.rows} searchQ={searchLower} />
          ))}
        </div>
      )}

      {!loading && filteredPersons.length > 0 && viewMode === 'liste' && (
        <ListView persons={filteredPersons} searchQ={searchLower} />
      )}

      {!loading && filteredPersons.length > 0 && viewMode === 'kart' && (
        <KartView persons={filteredPersons} searchQ={searchLower} />
      )}
    </div>
  );
}
