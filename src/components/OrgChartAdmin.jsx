import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getOrgChart, saveOrgChart, getAllProfiles } from '../lib/supabase';
import { ROLE_LABELS } from '../App';

const UNIT_COLORS = [
  '#1a3a5c', '#2563eb', '#16a34a', '#7c3aed', '#d97706',
  '#0891b2', '#dc2626', '#db2777', '#0d9488', '#ea580c',
];
const UNIT_ICONS = ['🏛', '⚖️', '🌍', '📝', '💰', '🤝', '📊', '🔬', '🎯', '🌐', '🏗️', '📡'];

const newId = () => Math.random().toString(36).slice(2, 10);
const emptyUnit = () => ({ id: newId(), name: '', icon: '🏛', coordinator_id: null, member_ids: [] });

// ── Avatar küçük ──────────────────────────────────────────────────────────────
function MiniAvatar({ profile, size = 28 }) {
  const [err, setErr] = useState(false);
  const name = profile?.full_name || profile?.email || '?';
  const initial = name[0].toUpperCase();
  if (profile?.avatar_url && !err) {
    return (
      <img src={profile.avatar_url} alt={name} onError={() => setErr(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--accent)', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 700, flexShrink: 0,
    }}>{initial}</div>
  );
}

// ── Kullanıcı kartı (sürüklenebilir) ─────────────────────────────────────────
function UserCard({ profile, isDragging, onDragStart, compact = false }) {
  const roleBg = {
    direktor: '#fef2f2', direktor_yardimcisi: '#fff7ed',
    asistan: '#fefce8', koordinator: '#eff6ff', personel: '#f0fdf4',
  };
  const roleColor = {
    direktor: '#b91c1c', direktor_yardimcisi: '#c2410c',
    asistan: '#a16207', koordinator: '#1d4ed8', personel: '#16a34a',
  };
  const r = profile.role || 'personel';

  return (
    <div
      draggable
      onDragStart={onDragStart}
      style={{
        display: 'flex', alignItems: 'center', gap: compact ? 6 : 8,
        padding: compact ? '5px 8px' : '7px 10px',
        borderRadius: 8, border: '1px solid var(--border)',
        background: isDragging ? '#eff6ff' : 'var(--bg-card)',
        cursor: 'grab', opacity: isDragging ? 0.5 : 1,
        transition: 'all 0.15s', userSelect: 'none',
        boxShadow: isDragging ? '0 4px 12px rgba(99,102,241,0.2)' : 'none',
      }}
    >
      <MiniAvatar profile={profile} size={compact ? 24 : 30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: compact ? 12 : 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {profile.full_name || profile.email}
        </div>
        <div style={{ fontSize: 10.5, marginTop: 1 }}>
          <span style={{ background: roleBg[r] || '#f3f4f6', color: roleColor[r] || '#374151', borderRadius: 20, padding: '1px 6px', fontWeight: 600 }}>
            {ROLE_LABELS[r] || r}
          </span>
          {profile.unit && <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>{profile.unit}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Birim editörü ─────────────────────────────────────────────────────────────
function UnitCard({ unit, unitIndex, profiles, allUnits, onUpdate, onRemove, onMoveUp, onMoveDown, isFirst, isLast, draggingUserId, setDraggingUserId }) {
  const [dragOver, setDragOver] = useState(false);
  const [open, setOpen] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const color = UNIT_COLORS[unitIndex % UNIT_COLORS.length];

  const memberProfiles = (unit.member_ids || [])
    .map(id => profiles.find(p => p.user_id === id))
    .filter(Boolean);

  const coordinator = profiles.find(p => p.user_id === unit.coordinator_id);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const userId = e.dataTransfer.getData('userId');
    if (!userId) return;
    if ((unit.member_ids || []).includes(userId)) return;
    onUpdate({ ...unit, member_ids: [...(unit.member_ids || []), userId] });
  };

  const removeMember = (userId) => {
    const newIds = (unit.member_ids || []).filter(id => id !== userId);
    const newCoord = unit.coordinator_id === userId ? null : unit.coordinator_id;
    onUpdate({ ...unit, member_ids: newIds, coordinator_id: newCoord });
  };

  const setCoordinator = (userId) => {
    onUpdate({ ...unit, coordinator_id: unit.coordinator_id === userId ? null : userId });
  };

  return (
    <div style={{
      borderRadius: 12,
      border: `1px solid ${dragOver ? color : 'var(--border)'}`,
      borderLeft: `4px solid ${color}`,
      background: dragOver ? color + '08' : 'var(--bg-card)',
      marginBottom: 12,
      overflow: 'hidden',
      transition: 'all 0.15s',
      boxShadow: dragOver ? `0 0 0 2px ${color}33` : 'none',
    }}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Başlık */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px',
        background: open ? color + '0a' : 'transparent',
        cursor: 'pointer',
      }} onClick={() => setOpen(o => !o)}>

        {/* İkon seçici */}
        <select
          value={unit.icon || '🏛'}
          onClick={e => e.stopPropagation()}
          onChange={e => onUpdate({ ...unit, icon: e.target.value })}
          style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', width: 32, flexShrink: 0 }}>
          {UNIT_ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
        </select>

        {/* Birim adı */}
        {editingName ? (
          <input
            autoFocus
            className="form-input"
            value={unit.name}
            onClick={e => e.stopPropagation()}
            onChange={e => onUpdate({ ...unit, name: e.target.value })}
            onBlur={() => setEditingName(false)}
            onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
            style={{ flex: 1, padding: '4px 8px', fontSize: 13.5, fontWeight: 700 }}
          />
        ) : (
          <div
            onClick={e => { e.stopPropagation(); setEditingName(true); }}
            style={{ flex: 1, fontSize: 14, fontWeight: 700, cursor: 'text', color: unit.name ? 'var(--text)' : 'var(--text-muted)' }}>
            {unit.name || 'Birim adını girin…'}
          </div>
        )}

        {/* Üye sayısı */}
        <span style={{ fontSize: 11, fontWeight: 600, color, background: color + '18', padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>
          {memberProfiles.length} kişi
        </span>

        {/* Koordinatör */}
        {coordinator && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <MiniAvatar profile={coordinator} size={20} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {coordinator.full_name?.split(' ')[0]}
            </span>
            <span style={{ fontSize: 10, background: '#eff6ff', color: '#2563eb', borderRadius: 20, padding: '1px 5px', fontWeight: 700 }}>K</span>
          </div>
        )}

        {/* Taşı / Sil */}
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button onClick={onMoveUp} disabled={isFirst} title="Yukarı taşı"
            style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg)', cursor: isFirst ? 'default' : 'pointer', opacity: isFirst ? 0.3 : 1, fontSize: 11 }}>↑</button>
          <button onClick={onMoveDown} disabled={isLast} title="Aşağı taşı"
            style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg)', cursor: isLast ? 'default' : 'pointer', opacity: isLast ? 0.3 : 1, fontSize: 11 }}>↓</button>
          <button onClick={e => { e.stopPropagation(); if (window.confirm(`"${unit.name || 'Bu birim'}" silinsin mi?`)) onRemove(); }}
            style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid #fecaca', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}>🗑</button>
        </div>

        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* Açık içerik */}
      {open && (
        <div style={{ padding: '8px 14px 14px' }}>

          {/* Bırakma alanı */}
          <div style={{
            border: `2px dashed ${dragOver ? color : 'var(--border)'}`,
            borderRadius: 8, padding: '8px 10px',
            background: dragOver ? color + '06' : 'transparent',
            marginBottom: 10,
            minHeight: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              👆 Kullanıcıyı buraya sürükleyin
            </span>
          </div>

          {/* Üye listesi */}
          {memberProfiles.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {memberProfiles.map(p => (
                <div key={p.user_id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: 8,
                  border: `1px solid ${unit.coordinator_id === p.user_id ? color + '66' : 'var(--border)'}`,
                  background: unit.coordinator_id === p.user_id ? color + '0a' : 'var(--bg)',
                }}>
                  <MiniAvatar profile={p} size={26} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.full_name || p.email}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ROLE_LABELS[p.role] || p.role}</div>
                  </div>

                  {/* Koordinatör yap butonu */}
                  <button
                    onClick={() => setCoordinator(p.user_id)}
                    title={unit.coordinator_id === p.user_id ? 'Koordinatörlükten çıkar' : 'Koordinatör yap'}
                    style={{
                      padding: '3px 8px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
                      border: `1px solid ${unit.coordinator_id === p.user_id ? color : 'var(--border)'}`,
                      background: unit.coordinator_id === p.user_id ? color : 'var(--bg)',
                      color: unit.coordinator_id === p.user_id ? '#fff' : 'var(--text-muted)',
                      fontWeight: 600, flexShrink: 0, transition: 'all 0.15s',
                    }}>
                    {unit.coordinator_id === p.user_id ? '★ Koordinatör' : '☆ Koord. Yap'}
                  </button>

                  {/* Çıkar */}
                  <button
                    onClick={() => removeMember(p.user_id)}
                    title="Birimden çıkar"
                    style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)', fontSize: 13 }}>
              Henüz üye yok
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Ana Bileşen ───────────────────────────────────────────────────────────────
export default function OrgChartAdmin({ notify }) {
  const [chart, setChart] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [draggingUserId, setDraggingUserId] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([getOrgChart(), getAllProfiles()]).then(([{ data: chartData }, { data: profs }]) => {
      setChart(chartData || { name: '', head_id: null, units: [] });
      setProfiles(profs || []);
      setLoading(false);
    });
  }, []);

  const update = useCallback((updated) => { setChart(updated); setDirty(true); }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await saveOrgChart(chart);
    setSaving(false);
    if (error) notify('Hata: ' + error.message, 'error');
    else { notify('✅ Organizasyon şeması kaydedildi.'); setDirty(false); }
  };

  const addUnit = () => update({ ...chart, units: [...(chart.units || []), emptyUnit()] });
  const updateUnit = (uid, upd) => update({ ...chart, units: chart.units.map(u => u.id === uid ? upd : u) });
  const removeUnit = (uid) => update({ ...chart, units: chart.units.filter(u => u.id !== uid) });
  const moveUnit = (idx, dir) => {
    const units = [...chart.units];
    const [m] = units.splice(idx, 1);
    units.splice(idx + dir, 0, m);
    update({ ...chart, units });
  };

  // Herhangi bir birime atanmış user_id'ler
  const assignedIds = new Set((chart?.units || []).flatMap(u => u.member_ids || []));

  // Havuzdaki (atanmamış) kullanıcılar
  const poolProfiles = profiles.filter(p => {
    if (assignedIds.has(p.user_id)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (p.full_name || '').toLowerCase().includes(q) ||
             (p.email || '').toLowerCase().includes(q) ||
             (ROLE_LABELS[p.role] || p.role || '').toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center' }}><div className="loading-spinner" /></div>
  );

  const headProfile = profiles.find(p => p.user_id === chart.head_id);

  return (
    <div>
      {/* Kaydet çubuğu */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderRadius: 10, marginBottom: 20,
        background: dirty ? '#fff9ec' : 'var(--bg)',
        border: `1px solid ${dirty ? '#fbbf24' : 'var(--border)'}`,
      }}>
        <div style={{ fontSize: 12.5, color: dirty ? '#92400e' : 'var(--text-muted)' }}>
          {dirty ? '⚠️ Kaydedilmemiş değişiklikler var.' : '✅ Tüm değişiklikler kaydedildi.'}
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !dirty} style={{ minWidth: 120 }}>
          {saving ? '⏳ Kaydediliyor…' : '💾 Kaydet'}
        </button>
      </div>

      {/* Departman bilgileri */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">🏢 Departman Bilgileri</div>
        <div className="form-row">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Departman / Kurum Adı</label>
            <input className="form-input" value={chart.name || ''}
              onChange={e => update({ ...chart, name: e.target.value })}
              placeholder="Örn: Uluslararası İlişkiler Departmanı" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Genel Müdür / Direktör</label>
            <select className="form-select" value={chart.head_id || ''}
              onChange={e => update({ ...chart, head_id: e.target.value || null })}>
              <option value="">— Seçiniz —</option>
              {profiles.map(p => (
                <option key={p.user_id} value={p.user_id}>
                  {p.full_name || p.email} ({ROLE_LABELS[p.role] || p.role})
                </option>
              ))}
            </select>
            {headProfile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <MiniAvatar profile={headProfile} size={22} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{headProfile.full_name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ana iki sütun */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── SOL: Kullanıcı Havuzu ── */}
        <div style={{ position: 'sticky', top: 20 }}>
          <div className="card" style={{ padding: '14px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div className="card-title" style={{ margin: 0, fontSize: 13.5 }}>👥 Kullanıcı Havuzu</div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{poolProfiles.length} kişi</span>
            </div>

            <input
              className="form-input"
              style={{ fontSize: 12.5, marginBottom: 10, padding: '5px 10px' }}
              placeholder="🔍 İsim veya rol ara…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
              Kullanıcıyı sürükleyip sağdaki birime bırakın
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 480, overflowY: 'auto' }}>
              {poolProfiles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 12.5 }}>
                  {search ? 'Eşleşen kullanıcı yok' : 'Tüm kullanıcılar birimlere atandı ✓'}
                </div>
              ) : (
                poolProfiles.map(p => (
                  <UserCard
                    key={p.user_id}
                    profile={p}
                    compact
                    isDragging={draggingUserId === p.user_id}
                    onDragStart={e => {
                      e.dataTransfer.setData('userId', p.user_id);
                      setDraggingUserId(p.user_id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                  />
                ))
              )}
            </div>

            {assignedIds.size > 0 && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 11.5, color: 'var(--text-muted)' }}>
                ✅ {assignedIds.size} kullanıcı birimlere atandı
              </div>
            )}
          </div>
        </div>

        {/* ── SAĞ: Birimler ── */}
        <div onDragEnd={() => setDraggingUserId(null)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>🏗 Birimler</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {(chart.units || []).length} birim · Birim adına tıklayarak düzenleyin
              </div>
            </div>
            <button className="btn btn-primary" onClick={addUnit}>+ Yeni Birim</button>
          </div>

          {(chart.units || []).length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '40px 20px',
              border: '2px dashed var(--border)', borderRadius: 12,
              color: 'var(--text-muted)', fontSize: 13.5,
            }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🏗</div>
              Henüz birim yok. <strong>+ Yeni Birim</strong> ile başlayın.
            </div>
          ) : (
            (chart.units || []).map((unit, i) => (
              <UnitCard
                key={unit.id}
                unit={unit}
                unitIndex={i}
                profiles={profiles}
                allUnits={chart.units}
                onUpdate={upd => updateUnit(unit.id, upd)}
                onRemove={() => removeUnit(unit.id)}
                onMoveUp={() => moveUnit(i, -1)}
                onMoveDown={() => moveUnit(i, 1)}
                isFirst={i === 0}
                isLast={i === chart.units.length - 1}
                draggingUserId={draggingUserId}
                setDraggingUserId={setDraggingUserId}
              />
            ))
          )}

          {(chart.units || []).length > 0 && (
            <button className="btn btn-outline" style={{ width: '100%', marginTop: 4 }} onClick={addUnit}>
              + Yeni Birim Ekle
            </button>
          )}
        </div>
      </div>

      {dirty && (
        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '⏳ Kaydediliyor…' : '💾 Değişiklikleri Kaydet'}
          </button>
        </div>
      )}
    </div>
  );
}
