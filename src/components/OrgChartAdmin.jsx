import React, { useState, useEffect, useCallback } from 'react';
import { getOrgChart, saveOrgChart } from '../lib/supabase';

const UNIT_COLORS = [
  '#1a3a5c', '#2563eb', '#16a34a', '#7c3aed', '#d97706',
  '#0891b2', '#dc2626', '#db2777',
];
const UNIT_ICONS = ['⚖️', '🌍', '📝', '💰', '🤝', '📊', '🏛', '🔬', '🎯', '🌐'];

const newId = () => Math.random().toString(36).slice(2, 10);

const emptyMember = () => ({
  id: newId(), name: '', isLead: false, ext: '',
  position: '', expertise: '', email: '', phone: '', birthday: '',
  invited: false,
});
const emptyUnit = () => ({
  id: newId(), name: '', icon: '🏛', members: [emptyMember()], subUnits: [],
});
const emptySubUnit = () => ({
  id: newId(), name: '', members: [emptyMember()],
});

// ── Expanded member fields ────────────────────────────────────────────────────
function MemberExpanded({ m, color, onChange }) {
  return (
    <div style={{
      padding: '10px 12px', background: 'var(--surface)',
      borderTop: '1px dashed var(--border)',
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
    }}>
      <div>
        <label className="form-label" style={{ fontSize: 10.5 }}>Uzmanlık Alanı</label>
        <input className="form-input" placeholder="Ör: Uluslararası Hukuk, AB Fonları"
          value={m.expertise || ''} style={{ padding: '4px 8px', fontSize: 12 }}
          onChange={e => onChange({ ...m, expertise: e.target.value })} />
      </div>
      <div>
        <label className="form-label" style={{ fontSize: 10.5 }}>E-posta</label>
        <input className="form-input" type="email" placeholder="ad@ornek.com"
          value={m.email || ''} style={{ padding: '4px 8px', fontSize: 12 }}
          onChange={e => onChange({ ...m, email: e.target.value })} />
      </div>
      <div>
        <label className="form-label" style={{ fontSize: 10.5 }}>Telefon</label>
        <input className="form-input" placeholder="+90 555 000 00 00"
          value={m.phone || ''} style={{ padding: '4px 8px', fontSize: 12 }}
          onChange={e => onChange({ ...m, phone: e.target.value })} />
      </div>
      <div>
        <label className="form-label" style={{ fontSize: 10.5 }}>Doğum Günü</label>
        <input className="form-input" type="date"
          value={m.birthday || ''} style={{ padding: '4px 8px', fontSize: 12 }}
          onChange={e => onChange({ ...m, birthday: e.target.value })} />
      </div>
    </div>
  );
}

// ── Single member row ─────────────────────────────────────────────────────────
function MemberRow({ m, color, onChange, onRemove, canRemove }) {
  const [exp, setExp] = useState(false);

  return (
    <div style={{
      borderRadius: 8, border: '1px solid var(--border)',
      marginBottom: 4, overflow: 'hidden',
      background: 'white',
    }}>
      {/* Compact row */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '5px 8px' }}>
        {/* Lead dot toggle */}
        <button
          title={m.isLead ? 'Sorumlu — personel yap' : 'Personel — sorumlu yap'}
          onClick={() => onChange({ ...m, isLead: !m.isLead })}
          style={{
            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
            border: `2px solid ${color}`,
            background: m.isLead ? color : 'white',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {m.isLead && <span style={{ color: 'white', fontSize: 9, fontWeight: 700 }}>✓</span>}
        </button>

        {/* Name */}
        <input className="form-input"
          placeholder="Ad Soyad" value={m.name}
          onChange={e => onChange({ ...m, name: e.target.value })}
          style={{ flex: 1, padding: '3px 7px', fontSize: 12 }} />

        {/* Position */}
        <input className="form-input"
          placeholder="Pozisyon" value={m.position || ''}
          onChange={e => onChange({ ...m, position: e.target.value })}
          style={{ width: 130, padding: '3px 7px', fontSize: 11.5 }} />

        {/* Ext */}
        <input className="form-input"
          placeholder="Dahili" value={m.ext}
          onChange={e => onChange({ ...m, ext: e.target.value })}
          style={{ width: 58, padding: '3px 7px', fontSize: 11.5, fontFamily: 'monospace' }} />

        {/* Expand toggle */}
        <button onClick={() => setExp(e => !e)}
          title="Kişisel bilgiler"
          style={{
            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
            border: '1px solid var(--border)',
            background: exp ? color + '18' : 'var(--surface)',
            color: exp ? color : 'var(--text-muted)',
            cursor: 'pointer', fontSize: 11,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          {exp ? '▲' : '▼'}
        </button>

        {/* Remove */}
        <button onClick={onRemove} disabled={!canRemove}
          style={{
            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
            border: '1px solid var(--border)',
            background: canRemove ? 'var(--red-pale)' : 'var(--surface)',
            color: canRemove ? 'var(--red)' : 'var(--border)',
            cursor: canRemove ? 'pointer' : 'default', fontSize: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
      </div>

      {exp && <MemberExpanded m={m} color={color} onChange={onChange} />}
    </div>
  );
}

// ── Sub-unit editor ───────────────────────────────────────────────────────────
function SubUnitEditor({ su, color, onChange, onRemove }) {
  const updateMember = (mid, upd) =>
    onChange({ ...su, members: su.members.map(m => m.id === mid ? upd : m) });
  const removeMember = (mid) =>
    onChange({ ...su, members: su.members.filter(m => m.id !== mid) });
  const addMember = () =>
    onChange({ ...su, members: [...su.members, emptyMember()] });

  return (
    <div style={{
      margin: '8px 0 4px 12px', padding: '10px 12px',
      borderRadius: 8, border: `1px solid ${color}33`,
      background: color + '05',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ opacity: 0.4, fontSize: 12 }}>└</span>
        <input className="form-input"
          placeholder="Alt birim / masa / temsilcilik adı"
          value={su.name}
          onChange={e => onChange({ ...su, name: e.target.value })}
          style={{ flex: 1, padding: '4px 8px', fontSize: 12, fontWeight: 600 }} />
        <button onClick={onRemove}
          style={{
            padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
            background: 'var(--red-pale)', color: 'var(--red)',
            border: '1px solid var(--red)22', fontSize: 11,
          }}>🗑 Sil</button>
      </div>
      {su.members.map(m => (
        <MemberRow key={m.id} m={m} color={color}
          onChange={upd => updateMember(m.id, upd)}
          onRemove={() => removeMember(m.id)}
          canRemove={su.members.length > 1} />
      ))}
      <button className="btn btn-outline btn-sm"
        style={{ fontSize: 11, padding: '3px 10px', marginTop: 4 }}
        onClick={addMember}>+ Üye ekle</button>
    </div>
  );
}

// ── Unit editor block ─────────────────────────────────────────────────────────
function UnitEditor({ unit, color, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast }) {
  const [open, setOpen] = useState(false);

  const updateMember = (mid, upd) =>
    onChange({ ...unit, members: unit.members.map(m => m.id === mid ? upd : m) });
  const removeMember = (mid) =>
    onChange({ ...unit, members: unit.members.filter(m => m.id !== mid) });
  const addMember = () =>
    onChange({ ...unit, members: [...unit.members, emptyMember()] });

  const updateSubUnit = (sid, upd) =>
    onChange({ ...unit, subUnits: unit.subUnits.map(su => su.id === sid ? upd : su) });
  const removeSubUnit = (sid) =>
    onChange({ ...unit, subUnits: unit.subUnits.filter(su => su.id !== sid) });
  const addSubUnit = () =>
    onChange({ ...unit, subUnits: [...(unit.subUnits || []), emptySubUnit()] });

  const totalInUnit = unit.members.length
    + (unit.subUnits || []).reduce((s, su) => s + su.members.length, 0);

  return (
    <div style={{
      borderRadius: 10, border: `1px solid ${color}44`,
      borderLeft: `4px solid ${color}`, background: 'white',
      marginBottom: 10, overflow: 'hidden',
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', cursor: 'pointer',
        background: open ? color + '08' : 'white',
      }} onClick={() => setOpen(o => !o)}>
        <select value={unit.icon || '🏛'}
          onClick={e => e.stopPropagation()}
          onChange={e => onChange({ ...unit, icon: e.target.value })}
          style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', width: 30 }}>
          {UNIT_ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
        </select>

        <input className="form-input" placeholder="Birim adı" value={unit.name}
          onClick={e => e.stopPropagation()}
          onChange={e => onChange({ ...unit, name: e.target.value })}
          style={{ flex: 1, padding: '5px 10px', fontSize: 13, fontWeight: 600 }} />

        <span style={{
          fontSize: 11, color, fontWeight: 600, padding: '2px 8px',
          borderRadius: 20, background: color + '15', flexShrink: 0,
        }}>
          {totalInUnit} kişi
        </span>

        <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
          <button onClick={onMoveUp} disabled={isFirst}
            style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', cursor: isFirst ? 'default' : 'pointer', opacity: isFirst ? 0.3 : 1 }}>↑</button>
          <button onClick={onMoveDown} disabled={isLast}
            style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', cursor: isLast ? 'default' : 'pointer', opacity: isLast ? 0.3 : 1 }}>↓</button>
        </div>

        <button onClick={e => { e.stopPropagation(); onRemove(); }}
          style={{
            padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
            background: 'var(--red-pale)', color: 'var(--red)',
            border: '1px solid var(--red)22', fontSize: 11,
          }}>🗑</button>

        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 2 }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* Expanded */}
      {open && (
        <div style={{ padding: '4px 14px 14px 14px', borderTop: '1px solid var(--border)' }}>
          {/* Column labels */}
          <div style={{
            display: 'flex', gap: 6, alignItems: 'center',
            padding: '6px 0 4px', fontSize: 10, color: 'var(--text-muted)',
          }}>
            <div style={{ width: 20, textAlign: 'center' }}>●</div>
            <div style={{ flex: 1 }}>Ad Soyad</div>
            <div style={{ width: 130 }}>Pozisyon</div>
            <div style={{ width: 58 }}>Dahili</div>
            <div style={{ width: 22 }}>+</div>
            <div style={{ width: 22 }}>✕</div>
          </div>

          {unit.members.map(m => (
            <MemberRow key={m.id} m={m} color={color}
              onChange={upd => updateMember(m.id, upd)}
              onRemove={() => removeMember(m.id)}
              canRemove={unit.members.length > 1} />
          ))}

          <button className="btn btn-outline btn-sm"
            style={{ marginTop: 8, fontSize: 11, padding: '3px 10px' }}
            onClick={addMember}>+ Üye ekle</button>

          {/* Sub-units */}
          {(unit.subUnits || []).length > 0 && (
            <div style={{ marginTop: 12, borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                Alt Birimler / Masalar / Temsilcilikler
              </div>
              {unit.subUnits.map(su => (
                <SubUnitEditor key={su.id} su={su} color={color}
                  onChange={upd => updateSubUnit(su.id, upd)}
                  onRemove={() => removeSubUnit(su.id)} />
              ))}
            </div>
          )}
          <button className="btn btn-outline btn-sm"
            style={{ marginTop: 8, fontSize: 11, padding: '3px 10px' }}
            onClick={addSubUnit}>+ Alt birim / masa ekle</button>
        </div>
      )}
    </div>
  );
}

// ── Direct staff editor (dept-level, outside units) ───────────────────────────
function DirectStaffEditor({ members, onChange }) {
  const color = '#1a3a5c';
  const updateMember = (mid, upd) => onChange(members.map(m => m.id === mid ? upd : m));
  const removeMember = (mid) => onChange(members.filter(m => m.id !== mid));
  const addMember = () => onChange([...members, emptyMember()]);

  return (
    <div className="card" style={{ marginBottom: 20, border: '2px solid #1a3a5c22' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div className="card-title" style={{ marginBottom: 2 }}>
            👤 Departman Düzeyinde Pozisyonlar
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Birim dışı, doğrudan departman yöneticisine bağlı personel (Yönetici Asistanı, vb.)
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={addMember}>+ Ekle</button>
      </div>

      {members.length === 0 && (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--surface)', borderRadius: 8, fontSize: 13 }}>
          Henüz departman düzeyinde personel yok.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{
          display: 'flex', gap: 6, alignItems: 'center',
          padding: '4px 0', fontSize: 10, color: 'var(--text-muted)',
        }}>
          <div style={{ width: 20, textAlign: 'center' }}>●</div>
          <div style={{ flex: 1 }}>Ad Soyad</div>
          <div style={{ width: 130 }}>Pozisyon</div>
          <div style={{ width: 58 }}>Dahili</div>
          <div style={{ width: 22 }}>+</div>
          <div style={{ width: 22 }}>✕</div>
        </div>
        {members.map(m => (
          <MemberRow key={m.id} m={m} color={color}
            onChange={upd => updateMember(m.id, upd)}
            onRemove={() => removeMember(m.id)}
            canRemove={members.length > 0} />
        ))}
      </div>
      {members.length > 0 && (
        <button className="btn btn-outline btn-sm"
          style={{ marginTop: 8, fontSize: 11, padding: '3px 10px' }}
          onClick={addMember}>+ Ekle</button>
      )}
    </div>
  );
}

// ── Main Admin Component ──────────────────────────────────────────────────────
export default function OrgChartAdmin({ notify }) {
  const [chart,   setChart]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [dirty,   setDirty]   = useState(false);

  useEffect(() => {
    getOrgChart().then(({ data }) => {
      setChart(data || { name: 'Departman Adı', head: '', directStaff: [], units: [emptyUnit()] });
      setLoading(false);
    });
  }, []);

  const update = useCallback((updated) => { setChart(updated); setDirty(true); }, []);

  const handleSave = async () => {
    if (!chart.name.trim()) { notify('Departman adı gerekli.', 'error'); return; }
    setSaving(true);
    const { error } = await saveOrgChart(chart);
    setSaving(false);
    if (error) { notify('Hata: ' + error.message, 'error'); }
    else { notify('✅ Organizasyon şeması kaydedildi.'); setDirty(false); }
  };

  const updateUnit = (uid, upd) =>
    update({ ...chart, units: chart.units.map(u => u.id === uid ? upd : u) });
  const removeUnit = (uid) =>
    update({ ...chart, units: chart.units.filter(u => u.id !== uid) });
  const addUnit = () =>
    update({ ...chart, units: [...chart.units, emptyUnit()] });
  const moveUnit = (idx, dir) => {
    const units = [...chart.units];
    const [moved] = units.splice(idx, 1);
    units.splice(idx + dir, 0, moved);
    update({ ...chart, units });
  };

  if (loading) return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor…</div>
  );

  return (
    <div>
      {/* Save bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderRadius: 10, marginBottom: 20,
        background: dirty ? '#fff9ec' : 'var(--surface)',
        border: `1px solid ${dirty ? '#fbbf24' : 'var(--border)'}`,
      }}>
        <div style={{ fontSize: 12.5, color: dirty ? '#92400e' : 'var(--text-muted)' }}>
          {dirty ? '⚠️ Kaydedilmemiş değişiklikler var.' : '✅ Tüm değişiklikler kaydedildi.'}
        </div>
        <button className="btn btn-primary" onClick={handleSave}
          disabled={saving || !dirty} style={{ minWidth: 120 }}>
          {saving ? '⏳ Kaydediliyor…' : '💾 Kaydet'}
        </button>
      </div>

      {/* Dept info */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">🏢 Departman Bilgileri</div>
        <div className="form-row">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Departman Adı</label>
            <input className="form-input" value={chart.name}
              onChange={e => update({ ...chart, name: e.target.value })}
              placeholder="Örn: Uluslararası İlişkiler Departmanı" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Departman Yöneticisi</label>
            <input className="form-input" value={chart.head || ''}
              onChange={e => update({ ...chart, head: e.target.value })}
              placeholder="Ad Soyad" />
          </div>
        </div>
      </div>

      {/* Direct staff */}
      <DirectStaffEditor
        members={chart.directStaff || []}
        onChange={ds => update({ ...chart, directStaff: ds })}
      />

      {/* Units */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 2 }}>🏗 Birimler ({chart.units.length})</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Satıra tıklayarak genişletin · Dolu = Sorumlu · ▼ = Kişisel bilgiler
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={addUnit}>+ Yeni Birim</button>
        </div>

        {chart.units.map((unit, ui) => (
          <UnitEditor key={unit.id} unit={unit}
            color={UNIT_COLORS[ui % UNIT_COLORS.length]}
            onChange={upd => updateUnit(unit.id, upd)}
            onRemove={() => removeUnit(unit.id)}
            onMoveUp={() => moveUnit(ui, -1)}
            onMoveDown={() => moveUnit(ui, 1)}
            isFirst={ui === 0} isLast={ui === chart.units.length - 1} />
        ))}

        <button className="btn btn-outline" style={{ width: '100%', marginTop: 8 }} onClick={addUnit}>
          + Yeni Birim Ekle
        </button>
      </div>

      {dirty && (
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '⏳ Kaydediliyor…' : '💾 Değişiklikleri Kaydet'}
          </button>
        </div>
      )}
    </div>
  );
}
