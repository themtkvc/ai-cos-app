import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  getCollaborations, createCollaboration, updateCollaboration, deleteCollaboration,
  uploadCollabImage, deleteCollabImage,
  COLLAB_TYPES, COLLAB_STATUSES,
} from '../lib/supabase';
import { UNITS, resolveUnitName, fmtDisplayDate } from '../lib/constants';

// ── Yardımcılar ──────────────────────────────────────────────────────────────
const typeObj   = (id) => COLLAB_TYPES.find(t => t.id === id);
const statusObj = (id) => COLLAB_STATUSES.find(s => s.id === id);
const unitObj   = (name) => UNITS.find(u => u.name === resolveUnitName(name));

function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)    return `${Math.round(diff)} sn önce`;
  if (diff < 3600)  return `${Math.round(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.round(diff / 3600)} saat önce`;
  if (diff < 604800) return `${Math.round(diff / 86400)} gün önce`;
  return d.toLocaleDateString('tr-TR');
}

function canEdit(row, profile) {
  if (!profile || !row) return false;
  if (row.owner_id && profile.user_id && row.owner_id === profile.user_id) return true;
  if (profile.role === 'direktor' || profile.role === 'direktor_yardimcisi') return true;
  if (profile.role === 'koordinator' && resolveUnitName(profile.unit) === resolveUnitName(row.unit)) return true;
  return false;
}

// ── Ana Sayfa ────────────────────────────────────────────────────────────────
export default function Collaborations({ user, profile }) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [viewMode, setViewMode]       = useState('cards'); // cards | list | by-unit | by-partner
  const [typeFilter, setTypeFilter]   = useState('all');
  const [unitFilter, setUnitFilter]   = useState('all');
  const [partnerFilter, setPartnerFilter] = useState('all');
  const [statusFilter, setStatusFilter]   = useState('active');
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState(null); // {} or {unit: 'X'} for new, row for edit
  const [viewId, setViewId]   = useState(null);
  const [toast, setToast]     = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const { data, error } = await getCollaborations({});
      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (typeFilter !== 'all'    && r.type !== typeFilter) return false;
      if (unitFilter !== 'all'    && resolveUnitName(r.unit) !== unitFilter) return false;
      if (partnerFilter !== 'all' && (r.partner_name || '(Partnersiz)') !== partnerFilter) return false;
      if (statusFilter === 'active') {
        if (['tamamlandi', 'iptal'].includes(r.status)) return false;
      } else if (statusFilter !== 'all') {
        if (r.status !== statusFilter) return false;
      }
      if (q) {
        const hay = `${r.title || ''} ${r.description || ''} ${r.partner_name || ''} ${r.owner_name || ''} ${(r.tags || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, typeFilter, unitFilter, partnerFilter, statusFilter, search]);

  const counts = useMemo(() => {
    const c = { total: rows.length, active: 0 };
    COLLAB_STATUSES.forEach(s => { c[s.id] = 0; });
    rows.forEach(r => {
      c[r.status] = (c[r.status] || 0) + 1;
      if (!['tamamlandi', 'iptal'].includes(r.status)) c.active += 1;
    });
    return c;
  }, [rows]);

  const partnerOptions = useMemo(() => {
    const s = new Set();
    rows.forEach(r => s.add(r.partner_name || '(Partnersiz)'));
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [rows]);

  const viewing = rows.find(r => r.id === viewId);

  const handleSaved = (next, { isNew } = {}) => {
    setRows(xs => {
      const idx = xs.findIndex(x => x.id === next.id);
      if (idx >= 0) { const n = xs.slice(); n[idx] = next; return n; }
      return [next, ...xs];
    });
    setEditing(null);

    // Kayıt, mevcut filtrede görünmüyorsa filtreyi aç ki kullanıcı göstersin:
    // - Durum 'tamamlandi'/'iptal' ise 'active' filtresi gizler → 'all' yap
    // - Farklı birim / farklı tür / farklı partner ise → o filtreyi 'all' yap
    const willBeHidden =
      (statusFilter === 'active' && ['tamamlandi', 'iptal'].includes(next.status)) ||
      (statusFilter !== 'active' && statusFilter !== 'all' && statusFilter !== next.status);
    if (willBeHidden) setStatusFilter('all');
    if (typeFilter !== 'all' && typeFilter !== next.type) setTypeFilter('all');
    if (unitFilter !== 'all' && unitFilter !== resolveUnitName(next.unit)) setUnitFilter('all');
    const partnerKey = next.partner_name || '(Partnersiz)';
    if (partnerFilter !== 'all' && partnerFilter !== partnerKey) setPartnerFilter('all');

    setToast(isNew ? '✅ İşbirliği oluşturuldu' : '✅ Değişiklik kaydedildi');
    setTimeout(() => setToast(''), 2800);
  };

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🤝 İşbirlikleri</div>
          <div style={{ fontSize: 13, opacity: 0.7 }}>
            Tüm birimlerin ortak projeleri, etkinlikleri, fonları ve araştırmaları. Toplam {counts.total} · {counts.active} aktif.
          </div>
        </div>
        <button
          onClick={() => setEditing({})}
          style={{
            padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            border: 'none', background: 'var(--navy, #1a3a5c)', color: '#fff',
          }}
        >＋ Yeni İşbirliği</button>
      </div>

      {/* View mode tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.6, marginRight: 4 }}>GÖRÜNÜM:</span>
        <ViewChip active={viewMode === 'cards'}      onClick={() => setViewMode('cards')}      label="🎴 Kart" />
        <ViewChip active={viewMode === 'list'}       onClick={() => setViewMode('list')}       label="📋 Liste" />
        <ViewChip active={viewMode === 'by-unit'}    onClick={() => setViewMode('by-unit')}    label="🏛 Birim Bazlı" />
        <ViewChip active={viewMode === 'by-partner'} onClick={() => setViewMode('by-partner')} label="🤝 Kurum Bazlı" />
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <FilterChip active={statusFilter === 'active'} onClick={() => setStatusFilter('active')} label={`Aktif (${counts.active})`} />
        <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} label={`Tümü (${counts.total})`} />
        {COLLAB_STATUSES.map(s => (
          <FilterChip
            key={s.id}
            active={statusFilter === s.id}
            onClick={() => setStatusFilter(s.id)}
            label={`${s.label} (${counts[s.id] || 0})`}
            color={s.color}
          />
        ))}
      </div>

      {/* Type/unit/partner + search */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={selStyle}>
          <option value="all">Tüm türler</option>
          {COLLAB_TYPES.map(t => (<option key={t.id} value={t.id}>{t.icon} {t.label}</option>))}
        </select>
        <select value={unitFilter} onChange={e => setUnitFilter(e.target.value)} style={selStyle}>
          <option value="all">Tüm birimler</option>
          {UNITS.map(u => (<option key={u.name} value={u.name}>{u.icon} {u.name}</option>))}
        </select>
        <select value={partnerFilter} onChange={e => setPartnerFilter(e.target.value)} style={selStyle}>
          <option value="all">Tüm kurumlar</option>
          {partnerOptions.map(p => (<option key={p} value={p}>{p}</option>))}
        </select>
        <input
          type="search"
          placeholder="🔎 Ara (başlık, açıklama, partner, etiket…)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 220, padding: '7px 11px', borderRadius: 7, fontSize: 13,
            border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
            background: 'var(--bg, #fff)', color: 'inherit', outline: 'none',
          }}
        />
        <button onClick={load} style={selStyle}>🔄 Yenile</button>
      </div>

      {error && (
        <div style={{
          padding: 12, borderRadius: 8, marginBottom: 14,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#dc2626', fontSize: 13,
        }}>⚠️ {error}</div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', opacity: 0.6 }}>Yükleniyor…</div>
      ) : (
        <>
          {viewMode === 'cards'      && <CardsView      rows={filtered} onOpen={(id) => setViewId(id)} />}
          {viewMode === 'list'       && <ListView       rows={filtered} onOpen={(id) => setViewId(id)} />}
          {viewMode === 'by-unit'    && <ByUnitView     rows={filtered} onOpen={(id) => setViewId(id)}
                                                         onAddForUnit={(unitName) => setEditing({ _unitPrefill: unitName })} />}
          {viewMode === 'by-partner' && <ByPartnerView  rows={filtered} onOpen={(id) => setViewId(id)} />}
        </>
      )}

      {editing !== null && (
        <CollabModal
          row={editing}
          profile={profile}
          user={user}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 11000, padding: '10px 18px', borderRadius: 10,
          background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 700,
          boxShadow: '0 10px 30px rgba(22,163,74,0.35)',
        }}>{toast}</div>
      )}

      {viewing && (
        <CollabDetailModal
          row={viewing}
          profile={profile}
          onClose={() => setViewId(null)}
          onEdit={() => { setViewId(null); setEditing(viewing); }}
          onDeleted={() => {
            setRows(xs => xs.filter(x => x.id !== viewing.id));
            setViewId(null);
          }}
        />
      )}
    </div>
  );
}

// ── Ortak stiller ────────────────────────────────────────────────────────────
const selStyle = {
  padding: '7px 11px', borderRadius: 7, fontSize: 12.5,
  border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
  background: 'var(--bg, #fff)', color: 'inherit', cursor: 'pointer',
};

function ViewChip({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 11px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        border: `1.5px solid ${active ? 'var(--navy, #1a3a5c)' : 'var(--border, rgba(0,0,0,0.15))'}`,
        background: active ? 'var(--navy, #1a3a5c)' : 'var(--bg, #fff)',
        color: active ? '#fff' : 'inherit',
      }}
    >{label}</button>
  );
}

function FilterChip({ active, onClick, label, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        border: `1.5px solid ${active ? (color || 'var(--navy, #1a3a5c)') : 'var(--border, rgba(0,0,0,0.15))'}`,
        background: active ? (color || 'var(--navy, #1a3a5c)') : 'var(--bg, #fff)',
        color: active ? '#fff' : 'inherit',
      }}
    >{label}</button>
  );
}

// ── Görünümler ───────────────────────────────────────────────────────────────
function EmptyState({ message }) {
  return (
    <div style={{
      padding: 40, textAlign: 'center',
      background: 'var(--bg-soft, rgba(0,0,0,0.02))',
      borderRadius: 12, border: '1px dashed var(--border, rgba(0,0,0,0.12))',
    }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>🤷</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{message}</div>
    </div>
  );
}

function CardsView({ rows, onOpen }) {
  if (rows.length === 0) return <EmptyState message="Bu filtreye uyan işbirliği yok" />;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
      {rows.map(r => (
        <CollabCard key={r.id} row={r} onOpen={() => onOpen(r.id)} />
      ))}
    </div>
  );
}

function ListView({ rows, onOpen }) {
  if (rows.length === 0) return <EmptyState message="Bu filtreye uyan işbirliği yok" />;
  return (
    <div style={{
      background: 'var(--bg, #fff)',
      border: '1.5px solid var(--border, rgba(0,0,0,0.12))',
      borderRadius: 12, overflow: 'hidden',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1.8fr 0.9fr 1.3fr 1.3fr 0.9fr 1fr',
        padding: '10px 14px', fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', opacity: 0.6,
        background: 'var(--bg-soft, rgba(0,0,0,0.03))',
        borderBottom: '1.5px solid var(--border, rgba(0,0,0,0.08))',
      }}>
        <div>BAŞLIK</div><div>TÜR</div><div>BİRİM</div><div>PARTNER</div><div>DURUM</div><div>TARİH</div>
      </div>
      {rows.map(r => {
        const t = typeObj(r.type);
        const s = statusObj(r.status);
        const u = unitObj(r.unit);
        return (
          <div
            key={r.id}
            onClick={() => onOpen(r.id)}
            style={{
              display: 'grid', gridTemplateColumns: '1.8fr 0.9fr 1.3fr 1.3fr 0.9fr 1fr',
              padding: '12px 14px', fontSize: 13, cursor: 'pointer', alignItems: 'center',
              borderBottom: '1px solid var(--border, rgba(0,0,0,0.06))',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-soft, rgba(0,0,0,0.02))'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
              {r.image_url && (
                <img src={r.image_url} alt="" style={{
                  width: 32, height: 32, objectFit: 'cover', borderRadius: 6, flexShrink: 0,
                }} />
              )}
              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.title}
              </span>
            </div>
            <div>{t && <span style={{ fontSize: 11.5, fontWeight: 600, color: t.color }}>{t.icon} {t.label}</span>}</div>
            <div>{u && <span style={{ fontSize: 12, fontWeight: 600, color: u.color }}>{u.icon} {u.name}</span>}</div>
            <div style={{ fontSize: 12, opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.partner_name || '—'}
            </div>
            <div>{s && <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 10,
              background: `${s.color}20`, color: s.color,
            }}>{s.label}</span>}</div>
            <div style={{ fontSize: 11.5, opacity: 0.7 }}>
              {r.start_date ? fmtDisplayDate(r.start_date) : timeAgo(r.created_at)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ByUnitView({ rows, onOpen, onAddForUnit }) {
  // Sırala UNITS'in sırasına göre + kayıtlarda olan ama UNITS'te yer almayan birim için ek
  const groups = useMemo(() => {
    const map = new Map();
    UNITS.forEach(u => map.set(u.name, []));
    rows.forEach(r => {
      const name = resolveUnitName(r.unit) || '— Birimsiz —';
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(r);
    });
    return Array.from(map.entries()); // [[unitName, rows[]], …]
  }, [rows]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {groups.map(([unitName, list]) => {
        const u = unitObj(unitName);
        const color = u?.color || '#6366f1';
        const icon  = u?.icon  || '🏛';
        return (
          <div
            key={unitName}
            style={{
              borderRadius: 14,
              background: `linear-gradient(180deg, ${color}0c 0%, transparent 80px)`,
              border: `1.5px solid ${color}33`,
              padding: 14,
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
              paddingBottom: 10, borderBottom: `1.5px dashed ${color}33`,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 20,
                background: `${color}20`, color,
              }}>{icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color }}>{unitName}</div>
                <div style={{ fontSize: 12, opacity: 0.65 }}>{list.length} işbirliği</div>
              </div>
              <button
                onClick={() => onAddForUnit(unitName)}
                style={{
                  padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  border: `1.5px solid ${color}60`, color, background: 'transparent',
                }}
              >＋ İşbirliği Ekle</button>
            </div>

            {list.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 13, opacity: 0.55 }}>
                Bu birime ait işbirliği yok. Sağ üstten ekleyebilirsiniz.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                {list.map(r => <CollabCard key={r.id} row={r} onOpen={() => onOpen(r.id)} compact />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ByPartnerView({ rows, onOpen }) {
  const groups = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      const key = r.partner_name?.trim() || '— Partnersiz —';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [rows]);

  if (groups.length === 0) return <EmptyState message="Bu filtreye uyan işbirliği yok" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {groups.map(([partnerName, list]) => {
        const first = list.find(r => r.partner_website || r.partner_email || r.partner_contact_person) || list[0];
        return (
          <div
            key={partnerName}
            style={{
              borderRadius: 14,
              background: 'var(--bg, #fff)',
              border: '1.5px solid var(--border, rgba(0,0,0,0.12))',
              padding: 14,
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap',
              paddingBottom: 10, borderBottom: '1.5px dashed var(--border, rgba(0,0,0,0.12))',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 20,
                background: 'rgba(99,102,241,0.12)', color: '#6366f1',
              }}>🤝</div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800 }}>{partnerName}</div>
                <div style={{ fontSize: 12, opacity: 0.65 }}>
                  {list.length} işbirliği
                  {first?.partner_contact_person && ` · 👤 ${first.partner_contact_person}`}
                </div>
              </div>
              {first?.partner_email && (
                <a href={`mailto:${first.partner_email}`} style={{
                  fontSize: 12, color: 'var(--navy, #1a3a5c)', textDecoration: 'none',
                  padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border, rgba(0,0,0,0.12))',
                }}>✉️ {first.partner_email}</a>
              )}
              {first?.partner_website && (
                <a href={first.partner_website} target="_blank" rel="noreferrer" style={{
                  fontSize: 12, color: 'var(--navy, #1a3a5c)', textDecoration: 'none',
                  padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border, rgba(0,0,0,0.12))',
                }}>🔗 Web</a>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {list.map(r => <CollabCard key={r.id} row={r} onOpen={() => onOpen(r.id)} compact />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Kart ─────────────────────────────────────────────────────────────────────
function CollabCard({ row, onOpen, compact = false }) {
  const t = typeObj(row.type);
  const s = statusObj(row.status);
  const u = unitObj(row.unit);
  return (
    <div
      onClick={onOpen}
      style={{
        padding: 0, borderRadius: 12, cursor: 'pointer', overflow: 'hidden',
        background: 'var(--bg, #fff)',
        border: '1.5px solid var(--border, rgba(0,0,0,0.12))',
        transition: 'transform .1s ease, box-shadow .1s ease',
        display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {row.image_url ? (
        <div style={{
          width: '100%', height: compact ? 110 : 140, overflow: 'hidden',
          background: 'var(--bg-soft, rgba(0,0,0,0.04))',
        }}>
          <img src={row.image_url} alt="" style={{
            width: '100%', height: '100%', objectFit: 'cover', display: 'block',
          }} />
        </div>
      ) : (
        <div style={{
          width: '100%', height: compact ? 0 : 6,
          background: t ? `linear-gradient(90deg, ${t.color}, ${t.color}80)` : 'transparent',
        }} />
      )}
      <div style={{ padding: compact ? 12 : 14, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {t && (
            <span style={{
              fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 10,
              background: `${t.color}20`, color: t.color,
            }}>{t.icon} {t.label}</span>
          )}
          {s && (
            <span style={{
              fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 10,
              background: `${s.color}20`, color: s.color,
            }}>{s.label}</span>
          )}
        </div>
        <div style={{ fontSize: compact ? 14 : 15, fontWeight: 700, lineHeight: 1.3 }}>{row.title}</div>
        {!compact && row.partner_name && (
          <div style={{ fontSize: 12.5, opacity: 0.85 }}>
            🤝 <b>Partner:</b> {row.partner_name}
          </div>
        )}
        {u && (
          <div style={{ fontSize: 11.5, opacity: 0.85 }}>
            {u.icon} <span style={{ color: u.color, fontWeight: 600 }}>{u.name}</span>
          </div>
        )}
        <div style={{ fontSize: 11, opacity: 0.6, display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 'auto' }}>
          {row.start_date && <span>📅 {fmtDisplayDate(row.start_date)}</span>}
          {!compact && row.owner_name && <span>👤 {row.owner_name}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Detay Modal ──────────────────────────────────────────────────────────────
function CollabDetailModal({ row, profile, onClose, onEdit, onDeleted }) {
  const t = typeObj(row.type);
  const s = statusObj(row.status);
  const u = unitObj(row.unit);
  const editable = canEdit(row, profile);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm('Bu işbirliği kalıcı olarak silinecek. Emin misiniz?')) return;
    setDeleting(true);
    // Görsel varsa önce storage'dan sil (best-effort)
    if (row.image_url) { try { await deleteCollabImage(row.image_url); } catch {} }
    const { error } = await deleteCollaboration(row.id);
    setDeleting(false);
    if (error) return alert('Silinemedi: ' + error.message);
    onDeleted();
  };

  return (
    <ModalShell onClose={onClose} title={`${t?.icon || '🤝'} ${row.title}`}>
      {row.image_url && (
        <div style={{
          width: '100%', borderRadius: 10, overflow: 'hidden', marginBottom: 14,
          background: 'var(--bg-soft, rgba(0,0,0,0.04))',
        }}>
          <img src={row.image_url} alt="" style={{ width: '100%', display: 'block', maxHeight: 320, objectFit: 'cover' }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {t && <Chip color={t.color} label={`${t.icon} ${t.label}`} />}
        {s && <Chip color={s.color} label={s.label} />}
        {u && <Chip color={u.color} label={`${u.icon} ${u.name}`} />}
      </div>

      {row.description && (
        <Section title="Açıklama">
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.5 }}>{row.description}</div>
        </Section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {(row.partner_name || row.partner_contact_person || row.partner_email || row.partner_website) && (
          <Section title="Partner Bilgileri">
            {row.partner_name           && <Field label="Kurum"   value={row.partner_name} />}
            {row.partner_contact_person && <Field label="İlgili Kişi" value={row.partner_contact_person} />}
            {row.partner_email          && <Field label="E-posta" value={<a href={`mailto:${row.partner_email}`} style={{ color: 'var(--navy, #1a3a5c)' }}>{row.partner_email}</a>} />}
            {row.partner_website        && <Field label="Web"     value={<a href={row.partner_website} target="_blank" rel="noreferrer" style={{ color: 'var(--navy, #1a3a5c)' }}>{row.partner_website}</a>} />}
          </Section>
        )}

        <Section title="Zaman & Durum">
          {row.start_date && <Field label="Başlangıç" value={fmtDisplayDate(row.start_date)} />}
          {row.end_date   && <Field label="Bitiş"     value={fmtDisplayDate(row.end_date)} />}
          {row.budget_amount != null && (
            <Field label="Bütçe" value={`${Number(row.budget_amount).toLocaleString('tr-TR')} ${row.budget_currency || 'TRY'}`} />
          )}
          {row.owner_name && <Field label="Sahibi" value={row.owner_name} />}
        </Section>
      </div>

      {row.tags && row.tags.length > 0 && (
        <Section title="Etiketler">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {row.tags.map(tg => (
              <span key={tg} style={{
                fontSize: 11, padding: '3px 8px', borderRadius: 10,
                background: 'var(--bg-soft, rgba(0,0,0,0.05))',
              }}>#{tg}</span>
            ))}
          </div>
        </Section>
      )}

      <div style={{ marginTop: 18, display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {editable && (
          <>
            <button onClick={handleDelete} disabled={deleting} style={{
              padding: '9px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
              border: '1.5px solid rgba(239,68,68,0.3)',
              background: 'transparent', color: '#dc2626',
            }}>{deleting ? 'Siliniyor…' : '🗑 Sil'}</button>
            <button onClick={onEdit} style={{
              padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: 'none', background: 'var(--navy, #1a3a5c)', color: '#fff',
            }}>✎ Düzenle</button>
          </>
        )}
        <button onClick={onClose} style={{
          padding: '9px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
          border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
          background: 'var(--bg, #fff)', color: 'inherit',
        }}>Kapat</button>
      </div>
    </ModalShell>
  );
}

// ── Oluştur/Düzenle Modal ────────────────────────────────────────────────────
function CollabModal({ row, profile, user, onClose, onSaved }) {
  const isNew = !row?.id;
  const initialUnit = row?.unit || row?._unitPrefill || resolveUnitName(profile?.unit) || UNITS[0].name;
  const [form, setForm] = useState({
    title:                   row?.title || '',
    description:             row?.description || '',
    type:                    row?.type || 'proje',
    unit:                    resolveUnitName(initialUnit),
    partner_name:            row?.partner_name || '',
    partner_contact_person:  row?.partner_contact_person || '',
    partner_email:           row?.partner_email || '',
    partner_website:         row?.partner_website || '',
    start_date:              row?.start_date || '',
    end_date:                row?.end_date || '',
    status:                  row?.status || 'planlaniyor',
    budget_amount:           row?.budget_amount ?? '',
    budget_currency:         row?.budget_currency || 'TRY',
    tags:                    (row?.tags || []).join(', '),
    image_url:               row?.image_url || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadInfo, setUploadInfo] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handlePickImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErr('Lütfen bir görsel dosyası seçin (JPG/PNG/WEBP/GIF).');
      e.target.value = '';
      return;
    }
    setUploading(true); setErr(''); setUploadInfo('Görsel işleniyor…');
    try {
      const res = await uploadCollabImage(file, user?.id);
      set('image_url', res.url);
      const kb = Math.round(res.size / 1024);
      const origKb = Math.round(file.size / 1024);
      setUploadInfo(origKb === kb
        ? `✅ Yüklendi (${kb} KB)`
        : `✅ ${origKb} KB → ${kb} KB olarak küçültüldü & yüklendi`);
    } catch (ex) {
      console.error(ex);
      setErr(ex.message || 'Görsel yüklenemedi');
      setUploadInfo('');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleClearImage = async () => {
    // Mevcut görsel yeni yüklenmiş ve henüz kaydedilmemiş olabilir; en garantili
    // yaklaşım olarak sadece URL'i form'dan çıkarıyoruz. Storage temizliği sil'de yapılır.
    set('image_url', '');
    setUploadInfo('');
  };

  const handleSave = async () => {
    if (!form.title.trim()) return setErr('Başlık zorunlu.');
    if (!form.type) return setErr('Tür seçin.');
    if (!form.unit) return setErr('Birim seçin.');

    setSaving(true); setErr('');

    const payload = {
      title:                  form.title.trim(),
      description:            form.description.trim() || null,
      type:                   form.type,
      unit:                   resolveUnitName(form.unit),
      partner_name:           form.partner_name.trim() || null,
      partner_contact_person: form.partner_contact_person.trim() || null,
      partner_email:          form.partner_email.trim() || null,
      partner_website:        form.partner_website.trim() || null,
      start_date:             form.start_date || null,
      end_date:               form.end_date || null,
      status:                 form.status,
      budget_amount:          form.budget_amount === '' ? null : Number(form.budget_amount),
      budget_currency:        form.budget_currency || 'TRY',
      tags:                   form.tags.split(',').map(x => x.trim()).filter(Boolean),
      image_url:              form.image_url || null,
    };

    try {
      if (isNew) {
        payload.owner_id   = user?.id || profile?.user_id;
        payload.owner_name = profile?.full_name || user?.email || '—';
        const { data, error } = await createCollaboration(payload);
        if (error) throw error;
        onSaved(data, { isNew: true });
      } else {
        const { data, error } = await updateCollaboration(row.id, payload);
        if (error) throw error;
        onSaved(data, { isNew: false });
      }
    } catch (e) {
      console.error(e);
      setErr(e.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title={isNew ? '＋ Yeni İşbirliği' : '✎ İşbirliğini Düzenle'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Görsel alanı */}
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.7, marginBottom: 6 }}>
            KAPAK GÖRSELİ <span style={{ opacity: 0.55, fontWeight: 500 }}>(opsiyonel · 3MB üzeri otomatik küçültülür)</span>
          </div>
          {form.image_url ? (
            <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1.5px solid var(--border, rgba(0,0,0,0.12))' }}>
              <img src={form.image_url} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }} />
              <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
                <button onClick={() => fileRef.current?.click()} style={{
                  padding: '6px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                  border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff',
                }}>Değiştir</button>
                <button onClick={handleClearImage} style={{
                  padding: '6px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                  border: 'none', background: 'rgba(220,38,38,0.85)', color: '#fff',
                }}>Kaldır</button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{
                width: '100%', padding: '22px 14px', borderRadius: 10, cursor: 'pointer',
                border: '1.5px dashed var(--border, rgba(0,0,0,0.2))',
                background: 'var(--bg-soft, rgba(0,0,0,0.02))', color: 'inherit',
                fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6,
              }}
            >
              <div style={{ fontSize: 24 }}>🖼</div>
              <div style={{ fontWeight: 700 }}>{uploading ? 'Yükleniyor…' : 'Görsel Seç veya Sürükle'}</div>
              <div style={{ fontSize: 11.5, opacity: 0.6 }}>JPG / PNG / WEBP / GIF</div>
            </button>
          )}
          {uploadInfo && !err && (
            <div style={{ fontSize: 11.5, opacity: 0.7, marginTop: 4 }}>{uploadInfo}</div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handlePickImage}
            style={{ display: 'none' }}
          />
        </div>

        <LabeledInput label="Başlık *" value={form.title} onChange={v => set('title', v)} placeholder="Örn: UNICEF ile Gaziantep çocuk sağlığı projesi" />
        <LabeledTextarea label="Açıklama" value={form.description} onChange={v => set('description', v)} placeholder="Kısa özet, hedefler, kapsam…" rows={4} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <LabeledSelect label="Tür *" value={form.type} onChange={v => set('type', v)}>
            {COLLAB_TYPES.map(t => (<option key={t.id} value={t.id}>{t.icon} {t.label}</option>))}
          </LabeledSelect>
          <LabeledSelect label="Sorumlu Birim *" value={form.unit} onChange={v => set('unit', v)}>
            {UNITS.map(u => (<option key={u.name} value={u.name}>{u.icon} {u.name}</option>))}
          </LabeledSelect>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.6, marginTop: 6 }}>PARTNER</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <LabeledInput label="Partner Kurum" value={form.partner_name} onChange={v => set('partner_name', v)} placeholder="Örn: UNICEF Türkiye" />
          <LabeledInput label="İlgili Kişi" value={form.partner_contact_person} onChange={v => set('partner_contact_person', v)} placeholder="Ad Soyad" />
          <LabeledInput label="E-posta" value={form.partner_email} onChange={v => set('partner_email', v)} placeholder="kisi@kurum.org" />
          <LabeledInput label="Web / Link" value={form.partner_website} onChange={v => set('partner_website', v)} placeholder="https://…" />
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.6, marginTop: 6 }}>ZAMAN & BÜTÇE</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <LabeledInput type="date" label="Başlangıç" value={form.start_date} onChange={v => set('start_date', v)} />
          <LabeledInput type="date" label="Bitiş"     value={form.end_date}   onChange={v => set('end_date', v)} />
          <LabeledSelect label="Durum" value={form.status} onChange={v => set('status', v)}>
            {COLLAB_STATUSES.map(s => (<option key={s.id} value={s.id}>{s.label}</option>))}
          </LabeledSelect>
          <LabeledInput type="number" label="Bütçe" value={form.budget_amount} onChange={v => set('budget_amount', v)} placeholder="0" />
          <LabeledSelect label="Para Birimi" value={form.budget_currency} onChange={v => set('budget_currency', v)}>
            <option value="TRY">TRY (₺)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
          </LabeledSelect>
        </div>

        <LabeledInput label="Etiketler (virgülle ayırın)" value={form.tags} onChange={v => set('tags', v)} placeholder="çocuk, sağlık, gaziantep" />

        {err && (
          <div style={{
            padding: 10, borderRadius: 8,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#dc2626', fontSize: 12.5,
          }}>⚠️ {err}</div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
          <button onClick={onClose} style={{
            padding: '9px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
            border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
            background: 'var(--bg, #fff)', color: 'inherit',
          }}>İptal</button>
          <button onClick={handleSave} disabled={saving || uploading} style={{
            padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            border: 'none', background: 'var(--navy, #1a3a5c)', color: '#fff',
            opacity: (saving || uploading) ? 0.6 : 1,
          }}>{saving ? 'Kaydediliyor…' : (isNew ? 'Oluştur' : 'Kaydet')}</button>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Küçük UI parçaları ───────────────────────────────────────────────────────
function ModalShell({ children, onClose, title }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10000, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg, #fff)', color: 'inherit',
          borderRadius: 14, padding: 22,
          maxWidth: 720, width: '100%', maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
          paddingBottom: 12, borderBottom: '1px solid var(--border, rgba(0,0,0,0.1))',
        }}>
          <div style={{ flex: 1, fontSize: 17, fontWeight: 800 }}>{title}</div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'var(--bg-soft, rgba(0,0,0,0.05))', fontSize: 16,
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Chip({ label, color }) {
  return (
    <span style={{
      fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 12,
      background: `${color}20`, color,
    }}>{label}</span>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', opacity: 0.6, marginBottom: 6 }}>
        {title.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ fontSize: 12.5, marginBottom: 4 }}>
      <span style={{ opacity: 0.6 }}>{label}:</span>{' '}
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function LabeledInput({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.7 }}>{label}</span>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          padding: '8px 11px', borderRadius: 7, fontSize: 13,
          border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
          background: 'var(--bg, #fff)', color: 'inherit', outline: 'none',
        }}
      />
    </label>
  );
}

function LabeledTextarea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.7 }}>{label}</span>
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          padding: '8px 11px', borderRadius: 7, fontSize: 13,
          border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
          background: 'var(--bg, #fff)', color: 'inherit', outline: 'none',
          resize: 'vertical', fontFamily: 'inherit',
        }}
      />
    </label>
  );
}

function LabeledSelect({ label, value, onChange, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.7 }}>{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          padding: '8px 11px', borderRadius: 7, fontSize: 13,
          border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
          background: 'var(--bg, #fff)', color: 'inherit', cursor: 'pointer',
        }}
      >{children}</select>
    </label>
  );
}
