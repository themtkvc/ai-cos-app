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
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isOverdue(d) {
  if (!d) return false;
  return new Date(d + 'T23:59:59') < new Date();
}

// ── SATIR DETAY / DÜZENLEME MODALİ ───────────────────────────────────────────
function ItemModal({ item, sectionId, coordinators = [], onSave, onDelete, onClose }) {
  const isCoordSection = sectionId === 'koordinator_takip';
  const [draft, setDraft] = useState({
    title:            item?.title    || '',
    notes:            item?.notes    || '',
    status:           item?.status   || 'aktif',
    priority:         item?.priority || 'normal',
    due_date:         item?.due_date || '',
    coordinator_id:   item?.coordinator_id   || '',
    coordinator_name: item?.coordinator_name || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));

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
    if (isCoordSection && !draft.coordinator_id) return; // koordinatör zorunlu bu bölümde
    setSaving(true);
    // Koordinatör bölümünde değilsek ilgili alanları hiç gönderme (null kalsın)
    const payload = isCoordSection ? draft : {
      title: draft.title, notes: draft.notes,
      status: draft.status, priority: draft.priority, due_date: draft.due_date,
      coordinator_id: null, coordinator_name: null,
    };
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

        {/* Durum + Öncelik + Tarih */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
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
          <input type="date" value={draft.due_date}
            onChange={e => set('due_date', e.target.value)}
            style={{ ...selStyle, cursor: 'pointer' }} />
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
  const overdue = !done && isOverdue(item.due_date);
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
      {(item.due_date || item.created_by_name) && (
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
          paddingLeft: 30, marginTop: 'auto',
          fontSize: 11, color: 'var(--text-light)',
        }}>
          {item.due_date && (
            <span style={{ fontWeight: 600, color: overdue && !done ? '#dc2626' : 'var(--text-light)', whiteSpace: 'nowrap' }}>
              {overdue && !done ? '⚠️ ' : '📅 '}{fmtDate(item.due_date)}
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

// ── ANA SAYFA ─────────────────────────────────────────────────────────────────
export default function DirectorAgendas({ user, profile }) {
  const [items, setItems]         = useState([]);
  const [coordinators, setCoordinators] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null);  // { item, sectionId } | null
  const [showDone, setShowDone]   = useState(false);
  const [filterSection, setFilterSection] = useState('');
  const [coordFilter, setCoordFilter] = useState(''); // koordinatöre göre alt-filtre (koordinator_takip bölümü)

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {allActive > 0 && (
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1d4ed8', padding: '4px 12px', borderRadius: 20, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              {allActive} açık gündem
            </span>
          )}
          {allDone > 0 && (
            <button
              onClick={() => setShowDone(s => !s)}
              style={{ fontSize: 12.5, fontWeight: 600, color: showDone ? '#15803d' : 'var(--text-muted)', padding: '4px 12px', borderRadius: 20, background: showDone ? '#f0fdf4' : 'var(--bg-card)', border: `1px solid ${showDone ? '#bbf7d0' : 'var(--border)'}`, cursor: 'pointer', fontFamily: 'inherit' }}>
              {showDone ? '✓ Tamamlananları gizle' : `${allDone} tamamlananı göster`}
            </button>
          )}
        </div>
      </div>

      {/* Bölüm filtresi */}
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

      {/* Yükleniyor */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-light)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Yükleniyor…</div>
        </div>
      )}

      {/* Bölümler */}
      {!loading && visibleSections.map(section => (
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
