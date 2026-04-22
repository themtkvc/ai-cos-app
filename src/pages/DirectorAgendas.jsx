import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  getDirectorAgendas, createDirectorAgenda, updateDirectorAgenda, deleteDirectorAgenda,
  getAllProfiles,
} from '../lib/supabase';

// ── SABİTLER ──────────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'direktor_takip',   label: 'Direktörün Takibindeki Gündemler',     icon: '📌', color: '#1a3a5c' },
  { id: 'koordinator_takip',label: 'Koordinatörlerin Takibindeki İşler',   icon: '👥', color: '#0e7490' },
  { id: 'asistan_takip',    label: 'Asistan\'ın Takibindeki İşler',        icon: '✅', color: '#2e6da4' },
  { id: 'genel_sekreter',   label: 'Genel Sekreter ile Görüşülecekler',    icon: '💬', color: '#6b3fa0' },
  { id: 'yonetim_kurulu',   label: 'Yönetim Kurulu Gündemleri',            icon: '🏛',  color: '#c47a1e' },
  { id: 'mutevelli',        label: 'Mütevelli Gündemleri',                 icon: '🤝', color: '#1e7a4a' },
];

const PRIORITY = {
  yuksek: { label: 'Yüksek', color: '#dc2626', dot: '🔴' },
  normal: { label: 'Normal', color: '#6b7280', dot: '⚪' },
  dusuk:  { label: 'Düşük',  color: '#16a34a', dot: '🟢' },
};

const STATUS_COLORS = {
  aktif:       { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  bekliyor:    { bg: '#fefce8', text: '#a16207', border: '#fde68a' },
  tamamlandi:  { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
};

function fmtDate(d) {
  if (!d) return '';
  // Hem "2026-04-22" hem de ISO timestamptz kabul et
  const dt = typeof d === 'string' && d.length === 10 ? new Date(d + 'T12:00:00') : new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateRange(item) {
  // Yeni kayıtlar: starts_at / ends_at / all_day
  // Eski kayıtlar: due_date (date)
  const s = item.starts_at || null;
  const e = item.ends_at || null;
  const allDay = item.all_day !== false; // varsayılan: all_day true
  if (s) {
    const sDate = fmtDate(s);
    if (!e || e === s) {
      return allDay ? sDate : `${sDate} · ${fmtTime(s)}`;
    }
    const eDate = fmtDate(e);
    if (allDay) {
      return sDate === eDate ? sDate : `${sDate} → ${eDate}`;
    }
    return sDate === eDate
      ? `${sDate} · ${fmtTime(s)}–${fmtTime(e)}`
      : `${sDate} ${fmtTime(s)} → ${eDate} ${fmtTime(e)}`;
  }
  if (item.due_date) return fmtDate(item.due_date);
  return '';
}

function isOverdue(item) {
  if (!item) return false;
  // starts_at veya due_date bazında — end varsa onu al
  const e = item.ends_at || item.starts_at;
  if (e) return new Date(e) < new Date();
  if (item.due_date) return new Date(item.due_date + 'T23:59:59') < new Date();
  return false;
}

// ── TARİH INPUT YARDIMCILARI ─────────────────────────────────────────────────
function inputToIso(input, allDay) {
  if (!input) return null;
  if (allDay) {
    // input: yyyy-mm-dd → UTC gün başı olarak sakla
    return `${input}T00:00:00Z`;
  }
  // input: yyyy-mm-ddThh:mm → lokal tz, ISO'ya çevir
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function isoToInputDate(iso) {
  if (!iso) return '';
  // "yyyy-mm-dd" kısmını al (all_day için UTC ile sakladığımız için güvenli)
  return iso.slice(0, 10);
}

function isoToInputDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── SATIR DETAY / DÜZENLEME MODALİ ───────────────────────────────────────────
function ItemModal({ item, sectionId, coordinators = [], onSave, onDelete, onClose }) {
  const isCoordSection = sectionId === 'koordinator_takip';
  // Başlangıç: all_day varsayılan true; mevcut kayıtta starts_at yoksa due_date'ten al
  const initAllDay = item ? (item.all_day !== false) : true;
  const initStart = item?.starts_at
    ? (initAllDay ? isoToInputDate(item.starts_at) : isoToInputDateTime(item.starts_at))
    : (item?.due_date || '');
  const initEnd = item?.ends_at
    ? (initAllDay ? isoToInputDate(item.ends_at) : isoToInputDateTime(item.ends_at))
    : '';
  const [draft, setDraft] = useState({
    title:            item?.title    || '',
    notes:            item?.notes    || '',
    status:           item?.status   || 'aktif',
    priority:         item?.priority || 'normal',
    all_day:          initAllDay,
    start_input:      initStart,
    end_input:        initEnd,
    coordinator_id:   item?.coordinator_id   || '',
    coordinator_name: item?.coordinator_name || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  const toggleAllDay = (nextAllDay) => {
    // Input formatı değiştiği için mevcut değerleri uygun forma dönüştür
    setDraft(d => {
      const convert = (val) => {
        if (!val) return '';
        if (nextAllDay) {
          // datetime-local → date
          return val.slice(0, 10);
        }
        // date → datetime-local (saat 09:00 default)
        return val.length === 10 ? `${val}T09:00` : val;
      };
      return {
        ...d,
        all_day: nextAllDay,
        start_input: convert(d.start_input),
        end_input: convert(d.end_input),
      };
    });
  };

  const handleCoordChange = (id) => {
    const found = coordinators.find(c => c.user_id === id);
    setDraft(d => ({
      ...d,
      coordinator_id:   id || '',
      coordinator_name: found?.full_name || '',
    }));
  };

  const handleSave = async () => {
    if (!draft.title.trim()) return;
    if (isCoordSection && !draft.coordinator_id) return;

    const starts_at = inputToIso(draft.start_input, draft.all_day);
    const ends_at = inputToIso(draft.end_input, draft.all_day);
    // Tarih aralığı tutarlılığı (basit guard — DB CHECK zaten var)
    if (starts_at && ends_at && new Date(ends_at) < new Date(starts_at)) {
      alert('Bitiş tarihi başlangıçtan önce olamaz.');
      return;
    }

    setSaving(true);
    // due_date ile backward-compat: all_day ise başlangıç tarihini date olarak da yaz
    const due_date = starts_at ? starts_at.slice(0, 10) : null;

    const base = {
      title: draft.title, notes: draft.notes,
      status: draft.status, priority: draft.priority,
      all_day: draft.all_day,
      starts_at,
      ends_at,
      due_date,
    };
    const payload = isCoordSection
      ? { ...base, coordinator_id: draft.coordinator_id, coordinator_name: draft.coordinator_name }
      : { ...base, coordinator_id: null, coordinator_name: null };

    await onSave(payload);
    setSaving(false);
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1200 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: 'var(--bg-card)', borderRadius: 14, padding: '24px 28px',
        width: 'min(480px, 94vw)', zIndex: 1201,
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)', border: '1px solid var(--border)',
      }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 18 }}>
          {item ? '✏️ Gündem Düzenle' : '➕ Yeni Gündem'}
        </div>

        {/* Başlık */}
        <textarea
          autoFocus
          placeholder="Gündem başlığı…"
          value={draft.title}
          onChange={e => set('title', e.target.value)}
          rows={2}
          style={{
            width: '100%', boxSizing: 'border-box', resize: 'vertical',
            padding: '9px 12px', borderRadius: 8,
            border: '1.5px solid var(--border)', fontSize: 14, fontFamily: 'inherit',
            fontWeight: 600, outline: 'none', background: 'var(--bg-card)',
            color: 'var(--text)', marginBottom: 12,
          }}
        />

        {/* Notlar */}
        <textarea
          placeholder="Notlar (isteğe bağlı)…"
          value={draft.notes}
          onChange={e => set('notes', e.target.value)}
          rows={3}
          style={{
            width: '100%', boxSizing: 'border-box', resize: 'vertical',
            padding: '8px 12px', borderRadius: 8,
            border: '1.5px solid var(--border)', fontSize: 13, fontFamily: 'inherit',
            outline: 'none', background: 'var(--bg-card)', color: 'var(--text-secondary)',
            marginBottom: 12,
          }}
        />

        {/* Koordinatör seçici (sadece koordinatör takip bölümünde) */}
        {isCoordSection && (
          <div style={{ marginBottom: 12 }}>
            <label style={{
              fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: 0.3, display: 'block', marginBottom: 4,
            }}>Koordinatör *</label>
            <select
              value={draft.coordinator_id}
              onChange={e => handleCoordChange(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: '1.5px solid var(--border)', fontSize: 13, fontFamily: 'inherit',
                background: 'var(--bg-card)', color: 'var(--text)', outline: 'none',
              }}
            >
              <option value="">— Koordinatör seçin —</option>
              {coordinators.map(c => (
                <option key={c.user_id} value={c.user_id}>
                  {c.full_name} {c.unit ? `· ${c.unit}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Durum + Öncelik */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <select value={draft.status} onChange={e => set('status', e.target.value)}
            style={selStyle}>
            <option value="aktif">Aktif</option>
            <option value="bekliyor">Bekliyor</option>
            <option value="tamamlandi">Tamamlandı</option>
          </select>
          <select value={draft.priority} onChange={e => set('priority', e.target.value)}
            style={selStyle}>
            <option value="yuksek">🔴 Yüksek öncelik</option>
            <option value="normal">⚪ Normal öncelik</option>
            <option value="dusuk">🟢 Düşük öncelik</option>
          </select>
        </div>

        {/* Tarih bloğu */}
        <div style={{
          padding: '10px 12px', borderRadius: 10,
          border: '1.5px solid var(--border)',
          background: 'var(--bg-hover)',
          marginBottom: 18,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
              📅 Tarih & Saat
            </span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={draft.all_day} onChange={e => toggleAllDay(e.target.checked)} />
              Tüm gün
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-light)', marginBottom: 2 }}>Başlangıç</div>
              <input
                type={draft.all_day ? 'date' : 'datetime-local'}
                value={draft.start_input}
                onChange={e => set('start_input', e.target.value)}
                style={{ ...selStyle, cursor: 'pointer', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-light)', marginBottom: 2 }}>Bitiş (ops.)</div>
              <input
                type={draft.all_day ? 'date' : 'datetime-local'}
                value={draft.end_input}
                onChange={e => set('end_input', e.target.value)}
                min={draft.start_input || undefined}
                style={{ ...selStyle, cursor: 'pointer', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            {(draft.start_input || draft.end_input) && (
              <button
                onClick={() => { set('start_input', ''); set('end_input', ''); }}
                title="Tarihleri temizle"
                style={{ padding: '6px 10px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'flex-end' }}
              >✕ Temizle</button>
            )}
          </div>
        </div>

        {/* Butonlar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {item ? (
            <button onClick={() => onDelete(item.id)}
              style={{ padding: '7px 14px', borderRadius: 7, border: '1.5px solid #fca5a5', background: 'white', color: '#dc2626', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              🗑 Sil
            </button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose}
              style={{ padding: '7px 14px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              İptal
            </button>
            <button onClick={handleSave} disabled={saving || !draft.title.trim() || (isCoordSection && !draft.coordinator_id)}
              style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: '#111827', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (saving || (isCoordSection && !draft.coordinator_id)) ? 0.6 : 1 }}>
              {saving ? '⏳' : '✓ Kaydet'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const selStyle = {
  padding: '6px 10px', borderRadius: 7, border: '1.5px solid var(--border)',
  fontSize: 12.5, fontFamily: 'inherit', background: 'var(--bg-card)',
  color: 'var(--text-secondary)', cursor: 'pointer', outline: 'none',
};

// ── TEK GÜNDEM KARTI ─────────────────────────────────────────────────────────
function AgendaCard({ item, onToggle, onClick, accentColor }) {
  const done = item.status === 'tamamlandi';
  const overdue = !done && isOverdue(item);
  const dateText = fmtDateRange(item);
  const prio = PRIORITY[item.priority] || PRIORITY.normal;
  const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.aktif;

  return (
    <div
      onClick={() => onClick(item)}
      style={{
        position: 'relative',
        display: 'flex', flexDirection: 'column',
        padding: '14px 14px 12px',
        borderRadius: 12,
        background: 'var(--bg-card)',
        border: `1px solid ${done ? 'var(--border)' : 'var(--border)'}`,
        borderLeft: `4px solid ${done ? '#a7f3d0' : (overdue ? '#dc2626' : (prio.color || accentColor))}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        opacity: done ? 0.6 : 1,
        minHeight: 118,
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {/* Üst satır: checkbox + başlık */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <button
          onClick={e => { e.stopPropagation(); onToggle(item); }}
          title={done ? 'Aktifleştir' : 'Tamamlandı olarak işaretle'}
          style={{
            width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 2,
            border: `2px solid ${done ? '#16a34a' : '#d1d5db'}`,
            background: done ? '#16a34a' : 'white',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 12, fontWeight: 800, padding: 0, lineHeight: 1,
          }}
        >{done ? '✓' : ''}</button>
        <div style={{
          flex: 1, minWidth: 0,
          fontSize: 14, fontWeight: 700, lineHeight: 1.35,
          color: 'var(--text)',
          textDecoration: done ? 'line-through' : 'none',
          wordBreak: 'break-word',
        }}>
          {item.title}
        </div>
      </div>

      {/* Notlar önizleme */}
      {item.notes && (
        <div style={{
          fontSize: 12, color: 'var(--text-light)', lineHeight: 1.45,
          marginBottom: 10, paddingLeft: 30,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {item.notes}
        </div>
      )}

      {/* Badge'ler */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 30, marginBottom: 8 }}>
        {item.coordinator_name && (
          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#ecfeff', color: '#0e7490', border: '1px solid #a5f3fc' }}>
            👤 {item.coordinator_name}
          </span>
        )}
        {item.priority === 'yuksek' && !done && (
          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}>
            🔴 Yüksek
          </span>
        )}
        {item.priority === 'dusuk' && !done && (
          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
            🟢 Düşük
          </span>
        )}
        {!done && item.status === 'bekliyor' && (
          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: statusStyle.bg, color: statusStyle.text, border: `1px solid ${statusStyle.border}` }}>
            ⏸ Bekliyor
          </span>
        )}
        {done && (
          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
            ✓ Tamamlandı
          </span>
        )}
      </div>

      {/* Alt satır: tarih + yaratıcı */}
      {(dateText || item.created_by_name) && (
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
          paddingLeft: 30, marginTop: 'auto',
          fontSize: 11, color: 'var(--text-light)',
        }}>
          {dateText && (
            <span style={{ fontWeight: 600, color: overdue && !done ? '#dc2626' : 'var(--text-light)', whiteSpace: 'nowrap' }}>
              {overdue && !done ? '⚠️ ' : '📅 '}{dateText}
            </span>
          )}
          {item.created_by_name && (
            <span style={{ whiteSpace: 'nowrap' }}>👤 {item.created_by_name}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── BÖLÜM KARTI ───────────────────────────────────────────────────────────────
function SectionPanel({
  section, items, onAdd, onToggle, onEdit, onDelete, showDone,
  groupByCoordinator = false, coordinators = [], coordFilter = '', onCoordFilterChange,
}) {
  const [inputVal, setInputVal] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const inputRef = useRef(null);

  // Koordinatör filtresi uygulanmış öğeler (sadece koordinator_takip için)
  const filteredItems = groupByCoordinator && coordFilter
    ? items.filter(i => i.coordinator_id === coordFilter)
    : items;
  const active = filteredItems.filter(i => i.status !== 'tamamlandi');
  const done   = filteredItems.filter(i => i.status === 'tamamlandi');

  // Koordinatöre göre grupla (stabil sıra: lookups'ın kendi sırasına göre, bilinmeyenler sonda)
  const groupByCoord = (list) => {
    const byId = new Map();
    list.forEach(i => {
      const key = i.coordinator_id || '__unassigned__';
      if (!byId.has(key)) byId.set(key, []);
      byId.get(key).push(i);
    });
    // Order: koordinatörler listesi sırası → sonra atanmamış
    const ordered = [];
    coordinators.forEach(c => {
      if (byId.has(c.user_id)) {
        ordered.push({ coord: c, items: byId.get(c.user_id) });
        byId.delete(c.user_id);
      }
    });
    // Geriye kalan: liste dışı koordinatör id'leri + atanmamış
    byId.forEach((val, key) => {
      if (key === '__unassigned__') {
        ordered.push({ coord: null, items: val });
      } else {
        // Silinmiş veya rolü değişmiş kullanıcı — item'lardaki coordinator_name'i kullan
        const name = val[0]?.coordinator_name || '(bilinmeyen)';
        ordered.push({ coord: { user_id: key, full_name: name, unit: '' }, items: val });
      }
    });
    return ordered;
  };

  const handleQuickAdd = async (e) => {
    if ((e.key === 'Enter' || e.type === 'click') && inputVal.trim()) {
      if (groupByCoordinator) {
        // Koordinatör bölümünde hızlı ekleme yok — modal aç
        onEdit(null, section.id);
        return;
      }
      await onAdd(section.id, inputVal.trim());
      setInputVal('');
    }
  };

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 12,
      border: `1px solid var(--border)`,
      borderTop: `3px solid ${section.color}`,
      marginBottom: 14,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      {/* Başlık */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '13px 16px 11px', cursor: 'pointer', userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontSize: 17 }}>{section.icon}</span>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>{section.label}</span>
          {active.length > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 20,
              background: section.color + '18', color: section.color,
              border: `1px solid ${section.color}33`,
            }}>{active.length}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {done.length > 0 && (
            <span style={{ fontSize: 11.5, color: 'var(--text-light)', fontWeight: 500 }}>
              {done.length} tamamlandı
            </span>
          )}
          <span style={{ fontSize: 14, color: 'var(--text-light)', fontWeight: 700 }}>
            {collapsed ? '▸' : '▾'}
          </span>
        </div>
      </div>

      {!collapsed && (
        <div style={{ padding: '4px 16px 16px' }}>
          {/* Koordinatör alt-filtresi (sadece koordinator_takip bölümünde) */}
          {groupByCoordinator && coordinators.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              <button
                onClick={() => onCoordFilterChange && onCoordFilterChange('')}
                style={{
                  padding: '4px 12px', borderRadius: 20, border: '1.5px solid',
                  borderColor: !coordFilter ? section.color : 'var(--border)',
                  background: !coordFilter ? section.color + '18' : 'var(--bg-card)',
                  color: !coordFilter ? section.color : 'var(--text-muted)',
                  fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>Tümü ({items.filter(i => i.status !== 'tamamlandi').length})</button>
              {coordinators.map(c => {
                const count = items.filter(i => i.coordinator_id === c.user_id && i.status !== 'tamamlandi').length;
                return (
                  <button key={c.user_id}
                    onClick={() => onCoordFilterChange && onCoordFilterChange(c.user_id)}
                    style={{
                      padding: '4px 12px', borderRadius: 20, border: '1.5px solid',
                      borderColor: coordFilter === c.user_id ? section.color : 'var(--border)',
                      background: coordFilter === c.user_id ? section.color + '18' : 'var(--bg-card)',
                      color: coordFilter === c.user_id ? section.color : 'var(--text-muted)',
                      fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                    👤 {(c.full_name || '').split(' ')[0]} {count > 0 && `(${count})`}
                  </button>
                );
              })}
            </div>
          )}

          {/* Aktif kartlar */}
          {active.length === 0 && (
            <div style={{
              fontSize: 13, color: 'var(--text-light)',
              padding: '16px', fontStyle: 'italic',
              background: 'var(--bg-hover)', borderRadius: 10,
              textAlign: 'center', border: '1.5px dashed var(--border)',
              marginBottom: 10,
            }}>
              {groupByCoordinator ? 'Henüz iş eklenmedi — aşağıdan koordinatör seçerek ekleyin' : 'Henüz gündem yok — aşağıdan ekle'}
            </div>
          )}

          {/* Koordinatör bölümü: gruplu görünüm; diğerleri: tek grid */}
          {active.length > 0 && groupByCoordinator && (
            <div style={{ marginBottom: 10 }}>
              {groupByCoord(active).map(({ coord, items: groupItems }) => (
                <div key={coord?.user_id || '__unassigned__'} style={{ marginBottom: 14 }}>
                  <div style={{
                    fontSize: 12.5, fontWeight: 700, color: section.color,
                    marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', borderRadius: 8,
                    background: section.color + '12',
                    border: `1px solid ${section.color}22`,
                  }}>
                    <span>👤 {coord?.full_name || 'Atanmamış'}</span>
                    {coord?.unit && (
                      <span style={{ fontSize: 11, opacity: 0.75, fontWeight: 500 }}>· {coord.unit}</span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, opacity: 0.8 }}>
                      {groupItems.length} açık iş
                    </span>
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: 12,
                  }}>
                    {groupItems.map(item => (
                      <AgendaCard key={item.id} item={item} accentColor={section.color}
                        onToggle={onToggle} onClick={onEdit} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {active.length > 0 && !groupByCoordinator && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 12,
              marginBottom: 10,
            }}>
              {active.map(item => (
                <AgendaCard key={item.id} item={item} accentColor={section.color}
                  onToggle={onToggle} onClick={onEdit} />
              ))}
            </div>
          )}

          {/* Tamamlananlar (grid) */}
          {showDone && done.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-light)', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Tamamlananlar ({done.length})
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 12,
              }}>
                {done.map(item => (
                  <AgendaCard key={item.id} item={item} accentColor={section.color}
                    onToggle={onToggle} onClick={onEdit} />
                ))}
              </div>
            </div>
          )}

          {/* Ekleme alanı */}
          {groupByCoordinator ? (
            <div style={{ marginTop: 14 }}>
              <button
                onClick={() => onEdit(null, section.id)}
                style={{
                  width: '100%', padding: '10px 16px', borderRadius: 10,
                  border: `1.5px dashed ${section.color}`,
                  background: section.color + '08', color: section.color,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >＋ Koordinatöre iş ekle</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 7, marginTop: 14 }}>
              <input
                ref={inputRef}
                type="text"
                placeholder="+ Gündem ekle (Enter)"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={handleQuickAdd}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 8,
                  border: '1.5px dashed var(--border)', fontSize: 13,
                  fontFamily: 'inherit', outline: 'none',
                  background: 'transparent', color: 'var(--text)',
                  transition: 'border-color 0.12s',
                }}
                onFocus={e => e.target.style.borderColor = section.color}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              <button
                onClick={handleQuickAdd}
                disabled={!inputVal.trim()}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none',
                  background: inputVal.trim() ? section.color : '#e5e7eb',
                  color: inputVal.trim() ? 'white' : '#9ca3af',
                  fontWeight: 700, fontSize: 13, cursor: inputVal.trim() ? 'pointer' : 'default',
                  fontFamily: 'inherit', transition: 'all 0.12s',
                }}
              >+</button>
              <button
                onClick={() => onEdit(null, section.id)}
                title="Detaylı ekle"
                style={{
                  padding: '8px 12px', borderRadius: 8,
                  border: '1.5px solid var(--border)',
                  background: 'var(--bg-card)', color: 'var(--text-muted)',
                  fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >⚙️</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── LİSTE GÖRÜNÜMÜ ───────────────────────────────────────────────────────────
function ListView({ items, sections, coordinators, onToggle, onEdit, filterSection, showDone }) {
  const [sortKey, setSortKey] = useState('date'); // 'date' | 'title' | 'section' | 'priority' | 'status'
  const [sortDir, setSortDir] = useState('asc');  // 'asc' | 'desc'

  const sectionById = Object.fromEntries(sections.map(s => [s.id, s]));

  const filtered = items
    .filter(it => !filterSection || it.section === filterSection)
    .filter(it => showDone || it.status !== 'tamamlandi');

  const getSortTs = (it) => {
    const s = it.starts_at || (it.due_date ? it.due_date + 'T12:00:00' : null);
    return s ? new Date(s).getTime() : Number.POSITIVE_INFINITY; // tarihi yoksa en sona
  };

  const PRIO_ORDER = { yuksek: 0, normal: 1, dusuk: 2 };
  const STATUS_ORDER = { aktif: 0, bekliyor: 1, tamamlandi: 2 };

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'date')     cmp = getSortTs(a) - getSortTs(b);
    else if (sortKey === 'title')    cmp = (a.title || '').localeCompare(b.title || '', 'tr');
    else if (sortKey === 'section')  cmp = (a.section || '').localeCompare(b.section || '');
    else if (sortKey === 'priority') cmp = (PRIO_ORDER[a.priority] ?? 1) - (PRIO_ORDER[b.priority] ?? 1);
    else if (sortKey === 'status')   cmp = (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortHdr = ({ label, k, width, align = 'left' }) => (
    <th
      onClick={() => toggleSort(k)}
      style={{
        padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
        textAlign: align, letterSpacing: 0.3, textTransform: 'uppercase',
        borderBottom: '2px solid var(--border)', cursor: 'pointer', userSelect: 'none',
        whiteSpace: 'nowrap', width,
      }}
    >
      {label} {sortKey === k && (sortDir === 'asc' ? '▲' : '▼')}
    </th>
  );

  if (sorted.length === 0) {
    return (
      <div style={{
        background: 'var(--bg-card)', borderRadius: 12,
        border: '1px solid var(--border)', padding: 48, textAlign: 'center',
        color: 'var(--text-light)',
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>Filtreye uyan gündem yok</div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 12,
      border: '1px solid var(--border)', overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'inherit' }}>
          <thead style={{ background: 'var(--bg-hover)' }}>
            <tr>
              <th style={{ width: 40, padding: '10px 8px 10px 14px', borderBottom: '2px solid var(--border)' }} />
              <SortHdr label="Başlık" k="title" />
              <SortHdr label="Bölüm" k="section" width={180} />
              <SortHdr label="Tarih" k="date" width={180} />
              <SortHdr label="Öncelik" k="priority" width={110} align="center" />
              <SortHdr label="Durum" k="status" width={120} align="center" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((it, i) => {
              const sec = sectionById[it.section] || { color: '#6b7280', label: it.section, icon: '•' };
              const done = it.status === 'tamamlandi';
              const overdue = !done && isOverdue(it);
              const prio = PRIORITY[it.priority] || PRIORITY.normal;
              const statusStyle = STATUS_COLORS[it.status] || STATUS_COLORS.aktif;
              const dateText = fmtDateRange(it);

              return (
                <tr key={it.id}
                  onClick={() => onEdit(it)}
                  style={{
                    background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-hover)',
                    cursor: 'pointer', opacity: done ? 0.55 : 1,
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = sec.color + '10'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-hover)'}
                >
                  {/* checkbox */}
                  <td style={{ padding: '10px 8px 10px 14px', borderLeft: `3px solid ${done ? '#a7f3d0' : (overdue ? '#dc2626' : prio.color)}` }}>
                    <button
                      onClick={e => { e.stopPropagation(); onToggle(it); }}
                      title={done ? 'Aktifleştir' : 'Tamamlandı olarak işaretle'}
                      style={{
                        width: 18, height: 18, borderRadius: 5, padding: 0,
                        border: `2px solid ${done ? '#16a34a' : '#d1d5db'}`,
                        background: done ? '#16a34a' : 'white',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontSize: 11, fontWeight: 800, lineHeight: 1,
                      }}
                    >{done ? '✓' : ''}</button>
                  </td>

                  {/* Başlık + koordinatör */}
                  <td style={{ padding: '10px 12px', minWidth: 220 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', lineHeight: 1.35, textDecoration: done ? 'line-through' : 'none' }}>
                      {it.title}
                    </div>
                    {(it.coordinator_name || it.notes) && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-light)', marginTop: 3, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {it.coordinator_name && (
                          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: '#ecfeff', color: '#0e7490', border: '1px solid #a5f3fc' }}>
                            👤 {it.coordinator_name}
                          </span>
                        )}
                        {it.notes && (
                          <span style={{
                            flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            fontStyle: 'italic',
                          }}>
                            {it.notes}
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Bölüm */}
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: sec.color + '18', color: sec.color,
                      border: `1px solid ${sec.color}33`, whiteSpace: 'nowrap',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                      {sec.icon} {sec.label?.split(' ')[0] || ''}
                    </span>
                  </td>

                  {/* Tarih */}
                  <td style={{ padding: '10px 12px', fontSize: 12, color: overdue && !done ? '#dc2626' : 'var(--text-light)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {dateText ? `${overdue && !done ? '⚠️ ' : '📅 '}${dateText}` : <span style={{ opacity: 0.4 }}>—</span>}
                  </td>

                  {/* Öncelik */}
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span title={prio.label} style={{ fontSize: 11, fontWeight: 700, color: prio.color }}>
                      {prio.dot} {prio.label}
                    </span>
                  </td>

                  {/* Durum */}
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                      background: statusStyle.bg, color: statusStyle.text,
                      border: `1px solid ${statusStyle.border}`, whiteSpace: 'nowrap',
                    }}>
                      {it.status === 'aktif' && '● Aktif'}
                      {it.status === 'bekliyor' && '⏸ Bekliyor'}
                      {it.status === 'tamamlandi' && '✓ Tamamlandı'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{
        padding: '10px 14px', borderTop: '1px solid var(--border)',
        fontSize: 11.5, color: 'var(--text-light)', background: 'var(--bg-hover)',
      }}>
        {sorted.length} gündem · sütun başlığına tıklayarak sırala
      </div>
    </div>
  );
}

// ── TAKVİM GÖRÜNÜMÜ ──────────────────────────────────────────────────────────
const WEEKDAYS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const MONTHS_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

function CalendarView({ items, sections, onEventClick }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [active, setActive] = useState(() => sections.map(s => s.id));

  const toggleSection = (id) => {
    setActive(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const year  = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  // Pazartesi başlangıç: Pazartesi=1, Pazar=0 → düzelt
  const firstDow = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - firstDow);

  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }

  const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const dayEnd   = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

  const visibleItems = items.filter(it => active.includes(it.section));

  const eventsOnDay = (day) => {
    const ds = dayStart(day), de = dayEnd(day);
    return visibleItems.filter(it => {
      const sRaw = it.starts_at || (it.due_date ? it.due_date + 'T12:00:00' : null);
      if (!sRaw) return false;
      const s = new Date(sRaw);
      const e = it.ends_at ? new Date(it.ends_at) : s;
      return e >= ds && s <= de;
    }).sort((a, b) => {
      const ta = a.starts_at ? new Date(a.starts_at).getTime() : 0;
      const tb = b.starts_at ? new Date(b.starts_at).getTime() : 0;
      return ta - tb;
    });
  };

  const sectionById = Object.fromEntries(sections.map(s => [s.id, s]));
  const today = new Date();
  const isToday = (d) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const isCurMonth = (d) => d.getMonth() === month;

  const untagged = items.filter(it => {
    const sRaw = it.starts_at || it.due_date;
    return !sRaw;
  }).length;

  const goto = (delta) => setCursor(new Date(year, month + delta, 1));
  const gotoToday = () => {
    const d = new Date();
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 12,
      border: '1px solid var(--border)',
      padding: 16,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      {/* Üst bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => goto(-1)} title="Önceki ay"
            style={navBtn}>‹</button>
          <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)', minWidth: 170, textAlign: 'center' }}>
            {MONTHS_TR[month]} {year}
          </div>
          <button onClick={() => goto(1)} title="Sonraki ay"
            style={navBtn}>›</button>
          <button onClick={gotoToday}
            style={{ ...navBtn, padding: '5px 12px', fontSize: 12, fontWeight: 600 }}>Bugün</button>
        </div>
        {untagged > 0 && (
          <span style={{ fontSize: 11.5, color: 'var(--text-light)', fontStyle: 'italic' }}>
            {untagged} gündemin tarihi yok (takvimde görünmez)
          </span>
        )}
      </div>

      {/* Section filtre chip'leri */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {sections.map(s => {
          const on = active.includes(s.id);
          return (
            <button key={s.id} onClick={() => toggleSection(s.id)}
              style={{
                padding: '4px 12px', borderRadius: 20, border: '1.5px solid',
                borderColor: on ? s.color : 'var(--border)',
                background: on ? s.color + '18' : 'var(--bg-card)',
                color: on ? s.color : 'var(--text-light)',
                fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                opacity: on ? 1 : 0.55,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
              {s.icon} {s.label.split(' ')[0]}
            </button>
          );
        })}
      </div>

      {/* Gün başlıkları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {WEEKDAYS_TR.map((w, i) => (
          <div key={w} style={{
            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
            textAlign: 'center', padding: '6px 0',
            textTransform: 'uppercase', letterSpacing: 0.5,
            borderBottom: '1.5px solid var(--border)',
            background: i >= 5 ? 'var(--bg-hover)' : 'transparent',
          }}>{w}</div>
        ))}
      </div>

      {/* Gün grid'i — 6 satır */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {days.map((d, i) => {
          const evs = eventsOnDay(d);
          const inMonth = isCurMonth(d);
          const today_ = isToday(d);
          return (
            <div key={i} style={{
              minHeight: 96,
              background: today_ ? '#fef9c3' : (inMonth ? 'var(--bg-card)' : 'var(--bg-hover)'),
              border: `1px solid ${today_ ? '#facc15' : 'var(--border)'}`,
              borderRadius: 8, padding: '4px 6px',
              opacity: inMonth ? 1 : 0.55,
              display: 'flex', flexDirection: 'column', gap: 2,
              overflow: 'hidden',
            }}>
              <div style={{
                fontSize: 11.5, fontWeight: today_ ? 800 : 600,
                color: today_ ? '#854d0e' : (inMonth ? 'var(--text)' : 'var(--text-light)'),
                marginBottom: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>{d.getDate()}</span>
                {evs.length > 3 && (
                  <span style={{ fontSize: 9.5, color: 'var(--text-light)', fontWeight: 600 }}>
                    +{evs.length - 3}
                  </span>
                )}
              </div>
              {evs.slice(0, 3).map(ev => {
                const sec = sectionById[ev.section] || { color: '#6b7280' };
                const done = ev.status === 'tamamlandi';
                const timeStr = (!ev.all_day && ev.starts_at) ? fmtTime(ev.starts_at) + ' ' : '';
                return (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick && onEventClick(ev)}
                    title={ev.title}
                    style={{
                      textAlign: 'left', display: 'block', width: '100%',
                      fontSize: 10.5, padding: '3px 6px', borderRadius: 5,
                      background: done ? '#f3f4f6' : sec.color + '18',
                      color: done ? '#9ca3af' : sec.color,
                      border: `1px solid ${done ? '#e5e7eb' : sec.color + '40'}`,
                      fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      textDecoration: done ? 'line-through' : 'none',
                    }}
                  >
                    {timeStr}{ev.title}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const navBtn = {
  padding: '5px 10px', borderRadius: 7,
  border: '1.5px solid var(--border)',
  background: 'var(--bg-card)', color: 'var(--text)',
  fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  lineHeight: 1,
};

// ── ANA SAYFA ─────────────────────────────────────────────────────────────────
export default function DirectorAgendas({ user, profile }) {
  const [items, setItems]         = useState([]);
  const [coordinators, setCoordinators] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null);  // { item, sectionId } | null
  const [showDone, setShowDone]   = useState(false);
  const [filterSection, setFilterSection] = useState('');
  const [coordFilter, setCoordFilter] = useState(''); // koordinatöre göre alt-filtre (koordinator_takip bölümü)
  const [viewMode, setViewMode]   = useState('cards'); // 'cards' | 'calendar'

  // Erişim kontrolü
  const allowed = ['direktor', 'asistan'].includes(profile?.role);

  const load = useCallback(async () => {
    setLoading(true);
    const [agendasRes, profilesRes] = await Promise.all([
      getDirectorAgendas(),
      getAllProfiles(),
    ]);
    setItems(agendasRes.data || []);
    // Koordinatör rolündeki profilleri topla (adına göre sırala)
    const coords = (profilesRes.data || [])
      .filter(p => p.role === 'koordinator')
      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'tr'));
    setCoordinators(coords);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Hızlı ekle (Enter ile başlık)
  const handleQuickAdd = async (sectionId, title) => {
    const { data } = await createDirectorAgenda({ section: sectionId, title, status: 'aktif', priority: 'normal' });
    if (data) setItems(prev => [...prev, data]);
  };

  // Modal kaydet (yeni veya güncelle)
  const handleModalSave = async (draft) => {
    if (modal.item) {
      const { data } = await updateDirectorAgenda(modal.item.id, draft);
      if (data) setItems(prev => prev.map(i => i.id === data.id ? data : i));
    } else {
      const { data } = await createDirectorAgenda({ section: modal.sectionId, ...draft });
      if (data) setItems(prev => [...prev, data]);
    }
    setModal(null);
  };

  // Checkbox toggle
  const handleToggle = async (item) => {
    const newStatus = item.status === 'tamamlandi' ? 'aktif' : 'tamamlandi';
    const { data } = await updateDirectorAgenda(item.id, { status: newStatus });
    if (data) setItems(prev => prev.map(i => i.id === data.id ? data : i));
  };

  // Sil
  const handleDelete = async (id) => {
    if (!window.confirm('Bu gündem silinecek. Emin misiniz?')) return;
    await deleteDirectorAgenda(id);
    setItems(prev => prev.filter(i => i.id !== id));
    setModal(null);
  };

  // Düzenleme aç
  const openEdit = (item, sectionId = null) => {
    setModal({ item: item || null, sectionId: sectionId || item?.section });
  };

  if (!allowed) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <h2 style={{ color: 'var(--text)' }}>Erişim Reddedildi</h2>
        <p style={{ color: 'var(--text-light)', marginTop: 8 }}>Bu sayfa yalnızca direktör ve asistan tarafından görüntülenebilir.</p>
      </div>
    );
  }

  const allActive = items.filter(i => i.status !== 'tamamlandi').length;
  const allDone   = items.filter(i => i.status === 'tamamlandi').length;

  const visibleSections = filterSection
    ? SECTIONS.filter(s => s.id === filterSection)
    : SECTIONS;

  return (
    <div style={{ padding: '28px 32px', background: 'var(--bg-hover)', minHeight: '100vh' }}>

      {/* Başlık */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>
            🗂 Direktör Gündemleri
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-light)', margin: '5px 0 0', fontWeight: 500 }}>
            Yalnızca direktör ve asistan erişebilir
          </p>
        </div>

        {/* Özet + kontroller */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* Görünüm toggle */}
          <div style={{ display: 'inline-flex', borderRadius: 20, border: '1.5px solid var(--border)', background: 'var(--bg-card)', padding: 2 }}>
            {[
              { id: 'cards',    label: '🗂 Kart' },
              { id: 'list',     label: '📋 Liste' },
              { id: 'calendar', label: '📅 Takvim' },
            ].map(v => (
              <button key={v.id}
                onClick={() => setViewMode(v.id)}
                style={{
                  padding: '4px 14px', borderRadius: 18, border: 'none',
                  background: viewMode === v.id ? '#111827' : 'transparent',
                  color: viewMode === v.id ? 'white' : 'var(--text-muted)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>{v.label}</button>
            ))}
          </div>
          {allActive > 0 && (
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1d4ed8', padding: '4px 12px', borderRadius: 20, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              {allActive} açık gündem
            </span>
          )}
          {(viewMode === 'cards' || viewMode === 'list') && allDone > 0 && (
            <button
              onClick={() => setShowDone(s => !s)}
              style={{ fontSize: 12.5, fontWeight: 600, color: showDone ? '#15803d' : 'var(--text-muted)', padding: '4px 12px', borderRadius: 20, background: showDone ? '#f0fdf4' : 'var(--bg-card)', border: `1px solid ${showDone ? '#bbf7d0' : 'var(--border)'}`, cursor: 'pointer', fontFamily: 'inherit' }}>
              {showDone ? '✓ Tamamlananları gizle' : `${allDone} tamamlananı göster`}
            </button>
          )}
        </div>
      </div>

      {/* Bölüm filtresi (kart & liste görünümünde) */}
      {(viewMode === 'cards' || viewMode === 'list') && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterSection('')}
            style={{
              padding: '5px 14px', borderRadius: 20, border: '1.5px solid',
              borderColor: !filterSection ? '#111827' : 'var(--border)',
              background: !filterSection ? '#111827' : 'var(--bg-card)',
              color: !filterSection ? 'white' : 'var(--text-muted)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>Tümü</button>
          {SECTIONS.map(s => (
            <button key={s.id}
              onClick={() => setFilterSection(s.id)}
              style={{
                padding: '5px 14px', borderRadius: 20, border: '1.5px solid',
                borderColor: filterSection === s.id ? s.color : 'var(--border)',
                background: filterSection === s.id ? s.color + '18' : 'var(--bg-card)',
                color: filterSection === s.id ? s.color : 'var(--text-muted)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>
              {s.icon} {s.label.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {/* Yükleniyor */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-light)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Yükleniyor…</div>
        </div>
      )}

      {/* Takvim görünümü */}
      {!loading && viewMode === 'calendar' && (
        <CalendarView
          items={items}
          sections={SECTIONS}
          onEventClick={(it) => openEdit(it)}
        />
      )}

      {/* Liste görünümü */}
      {!loading && viewMode === 'list' && (
        <ListView
          items={items}
          sections={SECTIONS}
          coordinators={coordinators}
          filterSection={filterSection}
          showDone={showDone}
          onToggle={handleToggle}
          onEdit={(it) => openEdit(it)}
        />
      )}

      {/* Kart görünümü — bölümler */}
      {!loading && viewMode === 'cards' && visibleSections.map(section => (
        <SectionPanel
          key={section.id}
          section={section}
          items={items.filter(i => i.section === section.id)}
          showDone={showDone}
          onAdd={handleQuickAdd}
          onToggle={handleToggle}
          onEdit={openEdit}
          onDelete={handleDelete}
          coordinators={coordinators}
          coordFilter={coordFilter}
          onCoordFilterChange={setCoordFilter}
          groupByCoordinator={section.id === 'koordinator_takip'}
        />
      ))}

      {/* Modal */}
      {modal && (
        <ItemModal
          item={modal.item}
          sectionId={modal.sectionId}
          coordinators={coordinators}
          onSave={handleModalSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
