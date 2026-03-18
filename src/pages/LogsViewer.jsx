import React, { useState, useEffect, useCallback } from 'react';
import { getDashboardLogs, getAllProfiles } from '../lib/supabase';
import { ROLE_LABELS } from '../App';

// ── SABITLER ──────────────────────────────────────────────────────────────────
const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                   'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

const STATUS_META = {
  ofis:         { label: 'Ofisten Çalışıyor',  icon: '🏢', color: '#1a3a5c', bg: '#e8edf5' },
  ev:           { label: 'Evden Çalışıyor',    icon: '🏠', color: '#2e6da4', bg: '#e5eef7' },
  saha:         { label: 'Sahadayım',           icon: '🌍', color: '#1e7a4a', bg: '#e6f4ed' },
  saglik_izni:  { label: 'Sağlık İzni',        icon: '🏥', color: '#b91c1c', bg: '#fef2f2' },
  egitim_izni:  { label: 'Eğitim İzni',        icon: '📚', color: '#6b3fa0', bg: '#f3eeff' },
  yillik_izin:  { label: 'Yıllık İzin',        icon: '🌴', color: '#c47a1e', bg: '#fff8e6' },
  calismiyor:   { label: 'Çalışmıyor',         icon: '⏸️',  color: '#6b7280', bg: '#f3f4f6' },
};

function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getWeekRange(offsetDays = 0) {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays * 7);
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now); mon.setDate(now.getDate() + diff);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { start: toLocalDateStr(mon), end: toLocalDateStr(sun) };
}

function fmtMins(mins) {
  if (!mins || mins === 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? (m > 0 ? `${h}s ${m}dk` : `${h}s`) : `${m}dk`;
}

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

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtDayName(dateStr) {
  const DAYS = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
  const d = new Date(dateStr + 'T12:00:00');
  return DAYS[d.getDay()];
}

// ── ÇALIŞMA KALEM KARTI ───────────────────────────────────────────────────────
function WorkItemRow({ item, index }) {
  const mins = getItemMins(item);
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '8px 0',
      borderBottom: '1px solid rgba(0,0,0,0.05)',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        background: 'rgba(26,58,92,0.1)', color: '#1a3a5c',
        fontWeight: 700, fontSize: 11, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 1,
      }}>{index + 1}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', lineHeight: 1.4 }}>
          {item.title || item.description || '(İsimsiz kalem)'}
        </div>
        {item.description && item.title && (
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, lineHeight: 1.4 }}>
            {item.description}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
          {item.category && (
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 20,
              background: 'rgba(26,58,92,0.08)', color: '#1a3a5c', fontWeight: 600,
            }}>{item.category}</span>
          )}
          {mins > 0 && (
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 20,
              background: 'rgba(30,122,74,0.08)', color: '#1e7a4a', fontWeight: 600,
            }}>⏱ {fmtMins(mins)}</span>
          )}
          {item.all_day && (
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 20,
              background: 'rgba(196,122,30,0.1)', color: '#c47a1e', fontWeight: 600,
            }}>Tam Gün</span>
          )}
          {item.start_time && item.end_time && (
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 20,
              background: 'rgba(0,0,0,0.05)', color: '#374151', fontWeight: 500,
            }}>{item.start_time.slice(0,5)} – {item.end_time.slice(0,5)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── TEK PERSONELİN BİR GÜNLÜKİ LOG KARTI ────────────────────────────────────
function LogCard({ log }) {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_META[log.work_status] || { label: log.work_status, icon: '❓', color: '#6b7280', bg: '#f3f4f6' };
  const workItems     = log.work_items || [];
  const overtimeItems = log.overtime_items || [];
  const workMins      = workItems.reduce((s, i) => s + getItemMins(i), 0);
  const otMins        = overtimeItems.reduce((s, i) => s + getItemMins(i), 0);
  const isNonWork     = ['saglik_izni','egitim_izni','yillik_izin','calismiyor'].includes(log.work_status);
  const hasItems      = workItems.length > 0 || overtimeItems.length > 0;

  return (
    <div style={{
      border: '1px solid rgba(0,0,0,0.08)',
      borderRadius: 12,
      overflow: 'hidden',
      background: 'white',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {/* Kart Başlığı */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        background: status.bg,
        borderBottom: expanded ? '1px solid rgba(0,0,0,0.08)' : 'none',
        cursor: hasItems ? 'pointer' : 'default',
      }} onClick={() => hasItems && setExpanded(e => !e)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>{status.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: status.color }}>{status.label}</div>
            {log.notes && (
              <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 2 }}>{log.notes}</div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!isNonWork && workMins > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e7a4a' }}>⏱ {fmtMins(workMins)}</div>
              {otMins > 0 && <div style={{ fontSize: 11, color: '#c47a1e' }}>+{fmtMins(otMins)} mesai</div>}
            </div>
          )}
          {hasItems && (
            <span style={{
              fontSize: 18, color: status.color, transition: 'transform 0.2s',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              display: 'inline-block',
            }}>⌄</span>
          )}
        </div>
      </div>

      {/* İş Kalemleri */}
      {expanded && (
        <div style={{ padding: '4px 16px 12px' }}>
          {workItems.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.05em', margin: '10px 0 4px' }}>
                ÇALIŞMA KALEMLERİ ({workItems.length})
              </div>
              {workItems.map((item, i) => <WorkItemRow key={i} item={item} index={i} />)}
            </>
          )}
          {overtimeItems.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#c47a1e', letterSpacing: '0.05em', margin: '12px 0 4px' }}>
                MESAİ KALEMLERİ ({overtimeItems.length})
              </div>
              {overtimeItems.map((item, i) => <WorkItemRow key={i} item={item} index={i} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── KİŞİ GRUBUNUN KARTI ───────────────────────────────────────────────────────
function PersonGroup({ person, logs, mode }) {
  const [collapsed, setCollapsed] = useState(false);
  const total_work = logs.reduce((s, l) => {
    return s + (l.work_items || []).reduce((ss, i) => ss + getItemMins(i), 0);
  }, 0);
  const total_ot = logs.reduce((s, l) => {
    return s + (l.overtime_items || []).reduce((ss, i) => ss + getItemMins(i), 0);
  }, 0);
  const submitted_count = logs.filter(l => l.submitted).length;

  return (
    <div style={{
      border: '1.5px solid rgba(26,58,92,0.12)',
      borderRadius: 14,
      overflow: 'hidden',
      background: '#fafbfc',
    }}>
      {/* Kişi başlık satırı */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          background: 'rgba(26,58,92,0.05)',
          cursor: 'pointer',
          borderBottom: collapsed ? 'none' : '1px solid rgba(26,58,92,0.08)',
        }}
        onClick={() => setCollapsed(c => !c)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(26,58,92,0.15)', color: '#1a3a5c',
            fontWeight: 800, fontSize: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {(person.full_name || '?')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a3a5c' }}>
              {person.full_name}
            </div>
            <div style={{ fontSize: 11.5, color: '#6b7280' }}>
              {ROLE_LABELS[person.role] || person.role}
              {person.unit ? ` · ${person.unit}` : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Özet istatistikler */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span style={{
              fontSize: 12, padding: '3px 10px', borderRadius: 20,
              background: 'rgba(26,58,92,0.08)', color: '#1a3a5c', fontWeight: 600,
            }}>{logs.length} kayıt</span>
            {total_work > 0 && (
              <span style={{
                fontSize: 12, padding: '3px 10px', borderRadius: 20,
                background: 'rgba(30,122,74,0.08)', color: '#1e7a4a', fontWeight: 600,
              }}>⏱ {fmtMins(total_work)}</span>
            )}
            {total_ot > 0 && (
              <span style={{
                fontSize: 12, padding: '3px 10px', borderRadius: 20,
                background: 'rgba(196,122,30,0.1)', color: '#c47a1e', fontWeight: 600,
              }}>+{fmtMins(total_ot)} mesai</span>
            )}
            <span style={{
              fontSize: 12, padding: '3px 10px', borderRadius: 20,
              background: submitted_count === logs.length ? 'rgba(30,122,74,0.08)' : 'rgba(239,68,68,0.08)',
              color: submitted_count === logs.length ? '#1e7a4a' : '#b91c1c',
              fontWeight: 600,
            }}>
              {submitted_count}/{logs.length} gönderildi
            </span>
          </div>
          <span style={{
            fontSize: 18, color: '#1a3a5c',
            transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
            display: 'inline-block', transition: 'transform 0.2s',
          }}>⌄</span>
        </div>
      </div>

      {/* Loglar */}
      {!collapsed && (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {logs.map((log, i) => (
            <div key={log.log_date + log.user_id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              {mode === 'week' && (
                <div style={{
                  flexShrink: 0, width: 80,
                  paddingTop: 13, fontSize: 11.5,
                  color: '#6b7280', fontWeight: 600, textAlign: 'right',
                }}>
                  <div>{fmtDayName(log.log_date)}</div>
                  <div style={{ fontSize: 10.5, color: '#9ca3af' }}>{fmtDate(log.log_date)}</div>
                </div>
              )}
              <div style={{ flex: 1 }}>
                <LogCard log={log} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ANA COMPONENT ─────────────────────────────────────────────────────────────
export default function LogsViewer({ user, profile }) {
  const [mode, setMode]       = useState('day');   // 'day' | 'week'
  const [weekOffset, setWeekOffset] = useState(0); // 0 = bu hafta, -1 = geçen hafta
  const [selectedDate, setSelectedDate] = useState(toLocalDateStr(new Date()));
  const [logs, setLogs]       = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [unitFilter, setUnitFilter] = useState('');  // '' = hepsi

  const role = profile?.role;
  const myUnit = profile?.unit;

  const isDirectorLevel = ['direktor','direktor_yardimcisi','asistan'].includes(role);
  const isKoordinator   = role === 'koordinator';

  // Tarih aralığı hesapla
  const { startDate, endDate } = (() => {
    if (mode === 'day') {
      return { startDate: selectedDate, endDate: selectedDate };
    } else {
      const range = getWeekRange(weekOffset);
      return { startDate: range.start, endDate: range.end };
    }
  })();

  const weekRange = getWeekRange(weekOffset);

  // Profilleri yükle (unit bilgisi için)
  useEffect(() => {
    getAllProfiles().then(({ data }) => {
      if (data) setProfiles(data);
    });
  }, []);

  // Logları yükle
  const loadLogs = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError('');
    const { data, error: err } = await getDashboardLogs(startDate, endDate);
    if (err) {
      setError('Kayıtlar yüklenirken hata oluştu: ' + err.message);
      setLoading(false);
      return;
    }
    setLogs(data || []);
    setLoading(false);
  }, [profile, startDate, endDate]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Koordinatör sadece kendi birimini görür; direktör seviyesi hepsini görür
  const filteredLogs = (() => {
    let result = logs;
    if (isKoordinator && myUnit) {
      result = result.filter(l => l.unit === myUnit);
    }
    if (unitFilter) {
      result = result.filter(l => l.unit === unitFilter);
    }
    return result;
  })();

  // Kişi bazlı gruplama
  const personMap = {};
  filteredLogs.forEach(log => {
    const uid = log.user_id;
    if (!personMap[uid]) {
      personMap[uid] = {
        user_id:   uid,
        full_name: log.full_name || uid.slice(0,8),
        role:      log.user_role,
        unit:      log.unit,
        logs:      [],
      };
    }
    personMap[uid].logs.push(log);
  });

  // Haftada tarih sırasına göre sırala; günde ise sadece 1 log zaten
  Object.values(personMap).forEach(p => {
    p.logs.sort((a, b) => a.log_date.localeCompare(b.log_date));
  });

  const personList = Object.values(personMap).sort((a, b) =>
    (a.full_name || '').localeCompare(b.full_name || '', 'tr')
  );

  // Birim listesi (filtre için)
  const allUnits = [...new Set(logs.map(l => l.unit).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));

  // Başlık metni
  const title = mode === 'day'
    ? `${fmtDayName(selectedDate)}, ${fmtDate(selectedDate)}`
    : `${fmtDate(weekRange.start)} — ${fmtDate(weekRange.end)}`;

  return (
    <div className="page-container">
      {/* Başlık */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">📂 İş Kayıtları - Dashboard</h1>
        <p className="page-subtitle">
          {isKoordinator && myUnit
            ? `${myUnit} birimi personel kayıtları`
            : 'Tüm personel iş kayıtları'}
        </p>
      </div>

      {/* Filtre Araçları */}
      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
        marginBottom: 20,
        padding: '14px 18px',
        background: 'white',
        borderRadius: 12,
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        {/* Mod: Gün / Hafta */}
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1.5px solid rgba(26,58,92,0.2)' }}>
          {['day','week'].map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '7px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: mode === m ? '#1a3a5c' : 'white',
                color: mode === m ? 'white' : '#1a3a5c',
                transition: 'all 0.15s',
              }}
            >
              {m === 'day' ? '📅 Gün' : '📆 Hafta'}
            </button>
          ))}
        </div>

        {/* Gün seçici */}
        {mode === 'day' && (
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{
              padding: '7px 12px', borderRadius: 8, border: '1.5px solid rgba(26,58,92,0.2)',
              fontSize: 13, fontFamily: 'inherit', color: '#1a3a5c', cursor: 'pointer', outline: 'none',
            }}
          />
        )}

        {/* Hafta gezme */}
        {mode === 'week' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setWeekOffset(w => w - 1)}
              style={{
                padding: '7px 14px', borderRadius: 8, border: '1.5px solid rgba(26,58,92,0.2)',
                background: 'white', cursor: 'pointer', fontSize: 15, color: '#1a3a5c', fontWeight: 700,
              }}
            >‹</button>
            <div style={{
              padding: '7px 16px', borderRadius: 8, border: '1.5px solid rgba(26,58,92,0.2)',
              background: 'white', fontSize: 12.5, fontWeight: 600, color: '#1a3a5c', whiteSpace: 'nowrap',
            }}>
              {weekOffset === 0 ? 'Bu Hafta' : weekOffset === -1 ? 'Geçen Hafta' : title}
            </div>
            <button
              onClick={() => setWeekOffset(w => Math.min(w + 1, 0))}
              disabled={weekOffset === 0}
              style={{
                padding: '7px 14px', borderRadius: 8, border: '1.5px solid rgba(26,58,92,0.2)',
                background: weekOffset === 0 ? '#f9fafb' : 'white',
                cursor: weekOffset === 0 ? 'not-allowed' : 'pointer',
                fontSize: 15, color: weekOffset === 0 ? '#9ca3af' : '#1a3a5c', fontWeight: 700,
              }}
            >›</button>
          </div>
        )}

        {/* Birim filtresi (direktör seviyesi için) */}
        {isDirectorLevel && allUnits.length > 1 && (
          <select
            value={unitFilter}
            onChange={e => setUnitFilter(e.target.value)}
            style={{
              padding: '7px 12px', borderRadius: 8, border: '1.5px solid rgba(26,58,92,0.2)',
              fontSize: 13, fontFamily: 'inherit', color: '#1a3a5c', background: 'white',
              cursor: 'pointer', outline: 'none',
            }}
          >
            <option value=''>🏢 Tüm Birimler</option>
            {allUnits.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        )}

        {/* Yenile */}
        <button
          onClick={loadLogs}
          disabled={loading}
          style={{
            padding: '7px 14px', borderRadius: 8, border: '1.5px solid rgba(26,58,92,0.2)',
            background: 'white', cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 600, color: '#1a3a5c',
          }}
        >
          {loading ? '⏳' : '🔄'} Yenile
        </button>
      </div>

      {/* Dönem başlığı */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a3a5c' }}>{title}</div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          {personList.length > 0
            ? `${personList.length} personel · ${filteredLogs.length} kayıt`
            : ''}
        </div>
      </div>

      {/* Hata */}
      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 16,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#b91c1c', fontSize: 13,
        }}>⚠️ {error}</div>
      )}

      {/* Yükleniyor */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#6b7280', fontSize: 14 }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
          Kayıtlar yükleniyor...
        </div>
      )}

      {/* Boş durum */}
      {!loading && personList.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '56px 24px',
          background: 'white', borderRadius: 14,
          border: '1px solid rgba(0,0,0,0.08)',
          color: '#6b7280',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
            Kayıt bulunamadı
          </div>
          <div style={{ fontSize: 13 }}>
            {mode === 'day'
              ? 'Bu tarihe ait giriş yapılmamış.'
              : 'Bu haftaya ait giriş yapılmamış.'}
          </div>
        </div>
      )}

      {/* Personel Kartları */}
      {!loading && personList.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {personList.map(person => (
            <PersonGroup
              key={person.user_id}
              person={person}
              logs={person.logs}
              mode={mode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
