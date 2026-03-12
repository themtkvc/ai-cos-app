import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getDailyLog, upsertDailyLog, submitDailyLog, getWeekLogs } from '../lib/supabase';
import { ROLE_LABELS } from '../App';

// ── SABITLER ──────────────────────────────────────────────────────────────────
const WORK_STATUS = [
  { value: 'ofis',         label: 'Ofisten Çalışıyor',  icon: '🏢', color: '#1a3a5c' },
  { value: 'ev',           label: 'Evden Çalışıyor',    icon: '🏠', color: '#2e6da4' },
  { value: 'saha',         label: 'Sahadayım',           icon: '🌍', color: '#1e7a4a' },
  { value: 'saglik_izni',  label: 'Sağlık İzni',        icon: '🏥', color: '#c47a1e' },
  { value: 'egitim_izni',  label: 'Eğitim İzni',        icon: '📚', color: '#6b3fa0' },
  { value: 'yillik_izin',  label: 'Yıllık İzin',        icon: '🌴', color: '#c47a1e' },
  { value: 'calismiyor',   label: 'Çalışmıyor',         icon: '⏸️',  color: '#888' },
];

const CATEGORIES = [
  'Toplantı', 'Rapor & Dokümantasyon', 'Saha Ziyareti', 'Koordinasyon',
  'Proje Çalışması', 'Eğitim & Gelişim', 'İdari İşler',
  'Donör İletişimi', 'Stratejik Planlama', 'Diğer',
];

const NON_WORK_STATUSES = ['saglik_izni', 'egitim_izni', 'yillik_izin', 'calismiyor'];

const DAYS_TR   = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                   'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const DAYS_FULL = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekDates(referenceDate) {
  const d = new Date(referenceDate);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd;
  });
}

// Başlangıç ve bitiş saatinden dakika hesapla
function calcItemMinutes(item) {
  if (item.all_day) return 480;
  if (!item.start_time || !item.end_time) return 0;
  const [sh, sm] = item.start_time.split(':').map(Number);
  const [eh, em] = item.end_time.split(':').map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return mins > 0 ? mins : 0;
}

function fmtMins(mins) {
  if (!mins) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}s${m > 0 ? ` ${m}dk` : ''}` : `${m}dk`;
}

function newItem() {
  return { id: Date.now() + Math.random(), category: '', description: '', start_time: '', end_time: '', all_day: false };
}

const AUTO_SAVE_DELAY = 2000;

// ── STATUS BADGE ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = WORK_STATUS.find(x => x.value === status);
  if (!s) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600,
      background: s.color + '18', color: s.color, border: `1px solid ${s.color}33`,
    }}>
      {s.icon} {s.label}
    </span>
  );
}

// ── İŞ KALEMİ SATIRI ─────────────────────────────────────────────────────────
function WorkItemRow({ item, disabled, onChange, onRemove }) {
  const mins = calcItemMinutes(item);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '155px 1fr auto 32px',
      gap: 8, marginBottom: 10, alignItems: 'center',
    }}>
      {/* Kategori */}
      <select
        className="form-select"
        value={item.category}
        disabled={disabled}
        onChange={e => onChange('category', e.target.value)}
        style={{ fontSize: 12.5, padding: '7px 10px' }}
      >
        <option value="">Kategori seç…</option>
        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>

      {/* Açıklama */}
      <input
        className="form-input"
        placeholder="Ne yaptınız?"
        value={item.description}
        disabled={disabled}
        onChange={e => onChange('description', e.target.value)}
        style={{ fontSize: 12.5, padding: '7px 10px' }}
      />

      {/* Saat grubu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {item.all_day ? (
          <span style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
            background: 'var(--navy)12', color: 'var(--navy)', border: '1px solid var(--navy)22',
            whiteSpace: 'nowrap',
          }}>
            🌅 Tüm Gün (8s)
          </span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="time"
              value={item.start_time}
              disabled={disabled}
              onChange={e => onChange('start_time', e.target.value)}
              style={{
                border: '1px solid var(--border)', borderRadius: 8,
                padding: '6px 8px', fontSize: 12.5, fontFamily: 'var(--font-body)',
                background: disabled ? 'var(--surface)' : 'white',
                color: 'var(--text)', width: 90,
              }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>→</span>
            <input
              type="time"
              value={item.end_time}
              disabled={disabled}
              onChange={e => onChange('end_time', e.target.value)}
              style={{
                border: '1px solid var(--border)', borderRadius: 8,
                padding: '6px 8px', fontSize: 12.5, fontFamily: 'var(--font-body)',
                background: disabled ? 'var(--surface)' : 'white',
                color: 'var(--text)', width: 90,
              }}
            />
            {mins > 0 && (
              <span style={{
                fontSize: 11.5, fontWeight: 700, color: 'var(--navy)',
                background: 'var(--navy)10', borderRadius: 6, padding: '3px 7px', whiteSpace: 'nowrap',
              }}>
                {fmtMins(mins)}
              </span>
            )}
          </div>
        )}

        {/* Tüm Gün checkbox */}
        {!disabled && (
          <label style={{
            display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
            fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap',
            padding: '5px 10px', borderRadius: 8,
            border: `1px solid ${item.all_day ? 'var(--navy)' : 'var(--border)'}`,
            background: item.all_day ? 'var(--navy)10' : 'transparent',
            fontWeight: item.all_day ? 700 : 400,
            color: item.all_day ? 'var(--navy)' : 'var(--text-muted)',
          }}>
            <input
              type="checkbox"
              checked={item.all_day}
              onChange={e => onChange('all_day', e.target.checked)}
              style={{ accentColor: 'var(--navy)', width: 14, height: 14 }}
            />
            Tüm Gün
          </label>
        )}
      </div>

      {/* Sil */}
      {!disabled ? (
        <button onClick={onRemove} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 18, padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>
      ) : <span />}
    </div>
  );
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function DailyLog({ user, profile }) {
  const today = toLocalDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekOffset, setWeekOffset]     = useState(0);
  const [weekLogs, setWeekLogs]         = useState({});
  const [status, setStatus]             = useState('ofis');
  const [items, setItems]               = useState([newItem()]);
  const [overtime, setOvertime]         = useState([]);
  const [notes, setNotes]               = useState('');
  const [submitted, setSubmitted]       = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [editing, setEditing]           = useState(false); // "Düzenle" modunda mı?
  const [autoSaveState, setAutoSaveState] = useState('idle');
  const [draft, setDraft]               = useState(false);
  const autoSaveTimer                   = useRef(null);
  const isNonWork = NON_WORK_STATUSES.includes(status);
  const isReadOnly = submitted && !editing;

  // ── Hafta günleri
  const refDate = new Date();
  refDate.setDate(refDate.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(refDate);

  // Mevcut verideki eski duration_minutes formatını yeni formata çevir
  function migrateItem(raw) {
    if (raw.start_time !== undefined || raw.all_day !== undefined) return raw;
    // Eski format: duration_minutes
    return { ...raw, start_time: '', end_time: '', all_day: false };
  }

  // ── Log yükle
  const loadLog = useCallback(async (dateStr) => {
    const { data } = await getDailyLog(user.id, dateStr);
    if (data) {
      setStatus(data.work_status || 'ofis');
      setItems(data.work_items?.length ? data.work_items.map(migrateItem) : [newItem()]);
      setOvertime((data.overtime_items || []).map(migrateItem));
      setNotes(data.notes || '');
      setSubmitted(data.submitted || false);
      setEditing(false);
      setDraft(!data.submitted && !!data.work_items?.length);
    } else {
      setStatus('ofis');
      setItems([newItem()]);
      setOvertime([]);
      setNotes('');
      setSubmitted(false);
      setEditing(false);
      setDraft(false);
    }
  }, [user.id]);

  // ── Hafta loglarını yükle
  const loadWeekLogs = useCallback(async () => {
    const dates = weekDates.map(d => toLocalDateStr(d));
    const { data } = await getWeekLogs(user.id, dates[0], dates[6]);
    const map = {};
    (data || []).forEach(r => { map[r.log_date] = r; });
    setWeekLogs(map);
  }, [user.id, weekOffset]);

  useEffect(() => { loadLog(selectedDate); }, [selectedDate]);
  useEffect(() => { loadWeekLogs(); }, [weekOffset, user.id]);

  // ── Otomatik kaydet
  const triggerAutoSave = useCallback(() => {
    if (isReadOnly) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setAutoSaveState('saving');
    autoSaveTimer.current = setTimeout(async () => {
      const totalMin = [...items, ...overtime].reduce((s, x) => s + calcItemMinutes(x), 0);
      const { error } = await upsertDailyLog({
        user_id: user.id, log_date: selectedDate,
        work_status: status, work_items: items, overtime_items: overtime,
        total_minutes: totalMin, notes, submitted: false,
      });
      setAutoSaveState(error ? 'error' : 'saved');
      setDraft(true);
    }, AUTO_SAVE_DELAY);
  }, [isReadOnly, user.id, selectedDate, status, items, overtime, notes]);

  useEffect(() => { triggerAutoSave(); }, [status, items, overtime, notes]);

  // ── Gönder / Güncelle
  const handleSubmit = async () => {
    setSubmitting(true);
    const totalMin = [...items, ...overtime].reduce((s, x) => s + calcItemMinutes(x), 0);
    const { error } = await submitDailyLog({
      user_id: user.id, log_date: selectedDate,
      work_status: status, work_items: items, overtime_items: overtime,
      total_minutes: totalMin, notes,
    });
    setSubmitting(false);
    if (!error) {
      setSubmitted(true);
      setEditing(false);
      setDraft(false);
      setAutoSaveState('idle');
      loadWeekLogs();
    }
  };

  // ── Item helpers
  const setItem    = (id, f, v) => setItems(p => p.map(i => i.id === id ? {...i, [f]: v} : i));
  const addItem    = () => setItems(p => [...p, newItem()]);
  const removeItem = (id) => setItems(p => p.length > 1 ? p.filter(i => i.id !== id) : p);
  const setOtItem  = (id, f, v) => setOvertime(p => p.map(i => i.id === id ? {...i, [f]: v} : i));
  const addOtItem  = () => setOvertime(p => [...p, newItem()]);
  const removeOtItem = (id) => setOvertime(p => p.filter(i => i.id !== id));

  const totalMin = items.reduce((s, x) => s + calcItemMinutes(x), 0);
  const otMin    = overtime.reduce((s, x) => s + calcItemMinutes(x), 0);

  const selDateObj    = new Date(selectedDate + 'T12:00:00');
  const dayName       = DAYS_FULL[selDateObj.getDay()];
  const formattedDate = `${selDateObj.getDate()} ${MONTHS_TR[selDateObj.getMonth()]} ${selDateObj.getFullYear()}`;
  const w0 = weekDates[0], w6 = weekDates[6];
  const weekLabel = `${w0.getDate()} ${MONTHS_TR[w0.getMonth()]} — ${w6.getDate()} ${MONTHS_TR[w6.getMonth()]}`;

  return (
    <div className="page" style={{ maxWidth: 820, margin: '0 auto' }}>

      {/* BAŞLIK */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">📋 Günlük İş Logu</h1>
            <p className="page-subtitle">
              {profile?.full_name || user?.email?.split('@')[0]} ·{' '}
              {ROLE_LABELS[profile?.role] || 'Personel'}
              {profile?.unit ? ` · ${profile.unit}` : ''}
            </p>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {!isReadOnly && autoSaveState === 'saving' && <><span style={{ color: 'var(--orange)' }}>●</span> Kaydediliyor…</>}
            {!isReadOnly && autoSaveState === 'saved'  && <><span style={{ color: 'var(--green)' }}>●</span> Otomatik kaydedildi</>}
            {!isReadOnly && autoSaveState === 'error'  && <><span style={{ color: 'var(--red)' }}>●</span> Kayıt hatası</>}
          </div>
        </div>
      </div>

      {/* TASLAK BANNER */}
      {draft && !submitted && !editing && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderRadius: 10, marginBottom: 16,
          background: 'var(--navy-pale,#eef2f8)', border: '1px solid var(--navy)22', fontSize: 13,
        }}>
          <span>💾 Kaydedilmiş taslak bulundu. Devam etmek ister misiniz?</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setDraft(false)}>Devam Et</button>
            <button className="btn btn-outline btn-sm" style={{ color: 'var(--red)' }}
              onClick={() => { setItems([newItem()]); setStatus('ofis'); setNotes(''); setDraft(false); }}>
              Sil
            </button>
          </div>
        </div>
      )}

      {/* HAFTA TAKVİMİ */}
      <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={() => setWeekOffset(w => w - 1)} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', padding: '2px 8px',
          }}>←</button>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
            BU HAFTA — {weekLabel}
          </span>
          <button onClick={() => setWeekOffset(w => w + 1)} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', padding: '2px 8px',
          }}>→</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
          {weekDates.map(d => {
            const ds    = toLocalDateStr(d);
            const isToday = ds === today;
            const isSel   = ds === selectedDate;
            const log     = weekLogs[ds];
            const isWknd  = d.getDay() === 0 || d.getDay() === 6;
            const ws      = WORK_STATUS.find(s => s.value === log?.work_status);

            return (
              <button key={ds} onClick={() => setSelectedDate(ds)} style={{
                padding: '10px 4px', borderRadius: 10, cursor: 'pointer', border: 'none',
                background: isSel ? 'var(--navy)' : isToday ? 'var(--navy-pale,#eef2f8)' : 'var(--surface)',
                boxShadow: isSel ? '0 2px 8px rgba(26,58,92,0.25)' : undefined,
                outline: isToday && !isSel ? '2px solid var(--navy)' : undefined,
                opacity: isWknd ? 0.55 : 1,
                fontFamily: 'var(--font-body)',
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: isSel ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)', marginBottom: 3 }}>
                  {DAYS_TR[d.getDay()]}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: isSel ? 'white' : 'var(--text)', marginBottom: 4 }}>
                  {String(d.getDate()).padStart(2, '0')}/{String(d.getMonth() + 1).padStart(2, '0')}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {log ? (
                    <span title={ws?.label || ''} style={{
                      display: 'block', width: 6, height: 6, borderRadius: '50%',
                      background: log.submitted ? (ws?.color || 'var(--green)') : 'var(--orange)',
                    }} />
                  ) : (
                    <span style={{ display: 'block', width: 6, height: 6, borderRadius: '50%', background: isSel ? 'rgba(255,255,255,0.3)' : 'var(--border)' }} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* GÜN BAŞLIĞI */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, padding: '14px 20px', borderRadius: 12,
        background: submitted ? (editing ? 'var(--orange-pale,#fff8ee)' : 'var(--green-pale,#edfaf4)') : 'var(--surface)',
        border: `1px solid ${submitted ? (editing ? 'var(--orange)33' : 'var(--green)33') : 'var(--border)'}`,
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--navy)' }}>{dayName}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{formattedDate}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusBadge status={status} />
          {submitted && !editing && (
            <>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 12, fontWeight: 700, color: 'var(--green)',
                background: 'var(--green)15', borderRadius: 20, padding: '4px 12px',
                border: '1px solid var(--green)33',
              }}>
                ✓ Gönderildi & Kaydedildi
              </span>
              <button
                onClick={() => setEditing(true)}
                style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  border: '1px solid var(--navy)44', background: 'transparent',
                  cursor: 'pointer', color: 'var(--navy)', fontFamily: 'var(--font-body)',
                }}
              >
                ✏️ Düzenle
              </button>
            </>
          )}
          {submitted && editing && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 12, fontWeight: 700, color: 'var(--orange)',
              background: 'var(--orange)15', borderRadius: 20, padding: '4px 12px',
              border: '1px solid var(--orange)33',
            }}>
              ✏️ Düzenleniyor
            </span>
          )}
        </div>
      </div>

      {/* ÇALIŞMA DURUMU */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 12.5, letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 12 }}>
          ÇALIŞMA DURUMU
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {WORK_STATUS.map(s => (
            <button key={s.value}
              disabled={isReadOnly}
              onClick={() => !isReadOnly && setStatus(s.value)}
              style={{
                padding: '10px 8px', borderRadius: 10, cursor: isReadOnly ? 'default' : 'pointer',
                border: `2px solid ${status === s.value ? s.color : 'var(--border)'}`,
                background: status === s.value ? s.color + '14' : 'var(--surface)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                fontFamily: 'var(--font-body)', transition: 'all 0.15s',
                opacity: isReadOnly ? 0.7 : 1,
              }}>
              <span style={{ fontSize: 20 }}>{s.icon}</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: status === s.value ? s.color : 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3 }}>
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* İŞ KALEMLERİ */}
      {!isNonWork && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 12.5, letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                İŞ KALEMLERİ &nbsp;·&nbsp; {formattedDate}
              </div>
            </div>

            {/* Kolon başlıkları */}
            <div style={{
              display: 'grid', gridTemplateColumns: '155px 1fr auto 32px',
              gap: 8, marginBottom: 8,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)', padding: '0 4px',
            }}>
              <span>KATEGORİ</span>
              <span>YAPILAN İŞ</span>
              <span>BAŞLANGIÇ → BİTİŞ &nbsp;·&nbsp; TÜM GÜN</span>
              <span />
            </div>

            {items.map(item => (
              <WorkItemRow
                key={item.id}
                item={item}
                disabled={isReadOnly}
                onChange={(f, v) => setItem(item.id, f, v)}
                onRemove={() => removeItem(item.id)}
              />
            ))}

            {!isReadOnly && (
              <button onClick={addItem} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '10px 16px', borderRadius: 10, border: '2px dashed var(--border)',
                background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)',
                fontSize: 13, fontFamily: 'var(--font-body)', marginTop: 4, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--navy)'; e.currentTarget.style.color = 'var(--navy)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> İş kalemi ekle
              </button>
            )}

            {/* Toplam */}
            <div style={{
              display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8,
              marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Toplam:</span>
              <span style={{
                fontSize: 17, fontWeight: 700,
                color: totalMin >= 480 ? 'var(--green)' : totalMin > 0 ? 'var(--navy)' : 'var(--text-muted)',
                fontFamily: 'var(--font-display)',
              }}>
                {totalMin > 0 ? fmtMins(totalMin) : '—'}
              </span>
              {totalMin > 0 && totalMin < 480 && (
                <span style={{ fontSize: 11, color: 'var(--orange)' }}>({fmtMins(480 - totalMin)} eksik)</span>
              )}
            </div>
          </div>

          {/* MESAİ */}
          {(overtime.length > 0 || !isReadOnly) && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 12.5, letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 12 }}>
                ⏰ MESAİ (İSTEĞE BAĞLI)
              </div>
              {overtime.map(item => (
                <WorkItemRow
                  key={item.id}
                  item={item}
                  disabled={isReadOnly}
                  onChange={(f, v) => setOtItem(item.id, f, v)}
                  onRemove={() => removeOtItem(item.id)}
                />
              ))}
              {!isReadOnly && (
                <button onClick={addOtItem} style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 16px',
                  borderRadius: 10, border: '2px dashed var(--orange)44', background: 'transparent',
                  cursor: 'pointer', color: 'var(--orange)', fontSize: 13, fontFamily: 'var(--font-body)', transition: 'all 0.15s',
                }}>
                  <span style={{ fontSize: 18 }}>+</span> Mesai ekle
                </button>
              )}
              {otMin > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Mesai: </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--orange)', marginLeft: 6 }}>
                    {fmtMins(otMin)}
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* İZİN / ÇALIŞMIYOR */}
      {isNonWork && (
        <div className="card" style={{ marginBottom: 16, textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>
            {WORK_STATUS.find(s => s.value === status)?.icon}
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--navy)', marginBottom: 6 }}>
            {WORK_STATUS.find(s => s.value === status)?.label}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Bu gün için iş kalemi girilmez.
          </div>
        </div>
      )}

      {/* NOTLAR */}
      {!isReadOnly ? (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 12.5, letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>
            NOT (İSTEĞE BAĞLI)
          </div>
          <textarea
            className="form-input"
            rows={2}
            placeholder="Varsa günlük not veya açıklama…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{ resize: 'vertical', fontSize: 13 }}
          />
        </div>
      ) : notes ? (
        <div className="card" style={{ marginBottom: 20, padding: '12px 16px' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>NOT &nbsp;</span>
          <span style={{ fontSize: 13 }}>{notes}</span>
        </div>
      ) : null}

      {/* ALT AKSYON */}
      {isReadOnly ? (
        /* Gönderilmiş & salt okunur durum */
        <div style={{
          padding: '16px 20px', borderRadius: 12, marginBottom: 20,
          background: 'var(--green-pale,#edfaf4)',
          border: '1px solid var(--green)33',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>✅</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--green)' }}>
                {dayName} logu gönderildi ve kaydedildi
              </div>
              {totalMin > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Toplam çalışma: {fmtMins(totalMin)}{otMin > 0 ? ` + ${fmtMins(otMin)} mesai` : ''}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setEditing(true)}
            style={{
              padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              border: '1.5px solid var(--navy)44', background: 'white',
              cursor: 'pointer', color: 'var(--navy)', fontFamily: 'var(--font-body)',
            }}
          >
            ✏️ Düzenle
          </button>
        </div>
      ) : (
        /* Gönder / Güncelle butonu */
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={submitting || (!isNonWork && totalMin === 0)}
          style={{
            width: '100%', padding: '15px', fontSize: 15, fontWeight: 700,
            borderRadius: 12, marginBottom: 20,
            opacity: (!isNonWork && totalMin === 0) ? 0.5 : 1,
          }}>
          {submitting
            ? '⏳ Kaydediliyor…'
            : editing
              ? `💾 ${dayName} Logunu Güncelle →`
              : `${dayName}'yi Gönder →`}
        </button>
      )}

    </div>
  );
}
