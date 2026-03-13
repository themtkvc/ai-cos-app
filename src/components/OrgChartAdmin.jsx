import React, { useState, useEffect, useCallback } from 'react';
import { getOrgChart, saveOrgChart } from '../lib/supabase';

const UNIT_COLORS = [
  '#1a3a5c', '#2563eb', '#16a34a', '#7c3aed', '#d97706',
  '#0891b2', '#dc2626', '#db2777',
];

const UNIT_ICONS = ['⚖️', '🌍', '📝', '💰', '🤝', '📊', '🏛', '🔬', '🎯', '🌐'];

const newId = () => Math.random().toString(36).slice(2, 10);

const emptyMember = () => ({ id: newId(), name: '', isLead: false, ext: '' });
const emptyUnit   = () => ({
  id: newId(), name: '', icon: '🏛', members: [emptyMember()], subUnits: [],
});
const emptySubUnit = () => ({
  id: newId(), name: '', members: [emptyMember()],
});

// ── Member editor row ────────────────────────────────────────────────────────
function MemberRow({ m, color, onChange, onRemove, canRemove }) {
  return (
    <div style={{
      display: 'flex', gap: 6, alignItems: 'center', padding: '4px 0',
    }}>
      {/* Lead toggle */}
      <button
        title={m.isLead ? 'Sorumlu — tıkla personel yap' : 'Personel — tıkla sorumlu yap'}
        onClick={() => onChange({ ...m, isLead: !m.isLead })}
        style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          border: `2px solid ${color}`,
          background: m.isLead ? color : 'white',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {m.isLead && <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>✓</span>}
      </button>

      {/* Name */}
      <input
        className="form-input"
        placeholder="Ad Soyad"
        value={m.name}
        onChange={e => onChange({ ...m, name: e.target.value })}
        style={{ flex: 1, padding: '4px 8px', fontSize: 12 }}
      />

      {/* Extension */}
      <input
        className="form-input"
        placeholder="Dahili"
        value={m.ext}
        onChange={e => onChange({ ...m, ext: e.target.value })}
        style={{ width: 68, padding: '4px 8px', fontSize: 12, fontFamily: 'monospace' }}
      />

      {/* Remove */}
      <button
        onClick={onRemove}
        disabled={!canRemove}
        title="Çıkar"
        style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
          border: '1px solid var(--border)',
          background: canRemove ? 'var(--red-pale)' : 'var(--surface)',
          color: canRemove ? 'var(--red)' : 'var(--border)',
          cursor: canRemove ? 'pointer' : 'default',
          fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ✕
      </button>
    </div>
  );
}

// ── Sub-unit block ────────────────────────────────────────────────────────────
function SubUnitEditor({ su, color, onChange, onRemove }) {
  const updateMember = (mid, updated) => {
    onChange({ ...su, members: su.members.map(m => m.id === mid ? updated : m) });
  };
  const removeMember = (mid) => {
    onChange({ ...su, members: su.members.filter(m => m.id !== mid) });
  };
  const addMember = () => {
    onChange({ ...su, members: [...su.members, emptyMember()] });
  };

  return (
    <div style={{
      margin: '8px 0 4px 16px',
      padding: '10px 12px',
      borderRadius: 8,
      border: `1px solid ${color}33`,
      background: color + '05',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ opacity: 0.5, fontSize: 12 }}>└</span>
        <input
          className="form-input"
          placeholder="Alt birim / masa adı"
          value={su.name}
          onChange={e => onChange({ ...su, name: e.target.value })}
          style={{ flex: 1, padding: '4px 8px', fontSize: 12, fontWeight: 600 }}
        />
        <button
          onClick={onRemove}
          title="Alt birimi sil"
          style={{
            padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
            background: 'var(--red-pale)', color: 'var(--red)',
            border: '1px solid var(--red)22', fontSize: 11, fontWeight: 600,
          }}
        >
          🗑 Sil
        </button>
      </div>

      {/* Members */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 6 }}>
        {/* Header labels (first sub-unit only for brevity) */}
        {su.members.map(m => (
          <MemberRow
            key={m.id}
            m={m} color={color}
            onChange={updated => updateMember(m.id, updated)}
            onRemove={() => removeMember(m.id)}
            canRemove={su.members.length > 1}
          />
        ))}
      </div>
      <button
        className="btn btn-outline btn-sm"
        style={{ fontSize: 11, padding: '3px 10px' }}
        onClick={addMember}
      >
        + Üye ekle
      </button>
    </div>
  );
}

// ── Unit editor block ─────────────────────────────────────────────────────────
function UnitEditor({ unit, color, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast }) {
  const [open, setOpen] = useState(false);

  const updateMember = (mid, updated) => {
    onChange({ ...unit, members: unit.members.map(m => m.id === mid ? updated : m) });
  };
  const removeMember = (mid) => {
    onChange({ ...unit, members: unit.members.filter(m => m.id !== mid) });
  };
  const addMember = () => {
    onChange({ ...unit, members: [...unit.members, emptyMember()] });
  };
  const updateSubUnit = (sid, updated) => {
    onChange({ ...unit, subUnits: unit.subUnits.map(su => su.id === sid ? updated : su) });
  };
  const removeSubUnit = (sid) => {
    onChange({ ...unit, subUnits: unit.subUnits.filter(su => su.id !== sid) });
  };
  const addSubUnit = () => {
    onChange({ ...unit, subUnits: [...(unit.subUnits || []), emptySubUnit()] });
  };

  const totalInUnit = unit.members.length
    + (unit.subUnits || []).reduce((s, su) => s + su.members.length, 0);

  return (
    <div style={{
      borderRadius: 10,
      border: `1px solid ${color}44`,
      borderLeft: `4px solid ${color}`,
      background: 'white',
      marginBottom: 10,
      overflow: 'hidden',
    }}>
      {/* Unit header (always visible) */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px',
        background: open ? color + '08' : 'white',
        cursor: 'pointer',
      }} onClick={() => setOpen(o => !o)}>
        {/* Icon selector */}
        <select
          value={unit.icon || '🏛'}
          onClick={e => e.stopPropagation()}
          onChange={e => onChange({ ...unit, icon: e.target.value })}
          style={{
            border: 'none', background: 'transparent',
            fontSize: 18, cursor: 'pointer', width: 30,
          }}
        >
          {UNIT_ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
        </select>

        {/* Unit name */}
        <input
          className="form-input"
          placeholder="Birim adı"
          value={unit.name}
          onClick={e => e.stopPropagation()}
          onChange={e => onChange({ ...unit, name: e.target.value })}
          style={{ flex: 1, padding: '5px 10px', fontSize: 13, fontWeight: 600 }}
        />

        {/* Stats badge */}
        <span style={{
          fontSize: 11, color: color, fontWeight: 600,
          padding: '2px 8px', borderRadius: 20, background: color + '15',
          flexShrink: 0,
        }}>
          {totalInUnit} kişi
        </span>

        {/* Order buttons */}
        <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
          <button onClick={onMoveUp} disabled={isFirst}
            style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', cursor: isFirst ? 'default' : 'pointer', opacity: isFirst ? 0.3 : 1 }}>↑</button>
          <button onClick={onMoveDown} disabled={isLast}
            style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', cursor: isLast ? 'default' : 'pointer', opacity: isLast ? 0.3 : 1 }}>↓</button>
        </div>

        {/* Remove */}
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          style={{
            padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
            background: 'var(--red-pale)', color: 'var(--red)',
            border: '1px solid var(--red)22', fontSize: 11,
          }}
        >🗑</button>

        {/* Toggle */}
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 2 }}>
          {open ? '▲' : '▼'}
        </span>
      </div>

      {/* Expanded editor */}
      {open && (
        <div style={{ padding: '4px 14px 14px 14px', borderTop: '1px solid var(--border)' }}>
          {/* Column labels */}
          <div style={{
            display: 'flex', gap: 6, alignItems: 'center',
            padding: '6px 0 2px', fontSize: 10.5, color: 'var(--text-muted)',
          }}>
            <div style={{ width: 22, textAlign: 'center' }}>Sorumlu</div>
            <div style={{ flex: 1 }}>Ad Soyad</div>
            <div style={{ width: 68 }}>Dahili</div>
            <div style={{ width: 22 }} />
          </div>

          {/* Members */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {unit.members.map(m => (
              <MemberRow
                key={m.id}
                m={m} color={color}
                onChange={updated => updateMember(m.id, updated)}
                onRemove={() => removeMember(m.id)}
                canRemove={unit.members.length > 1}
              />
            ))}
          </div>

          <button
            className="btn btn-outline btn-sm"
            style={{ marginTop: 8, fontSize: 11, padding: '3px 10px' }}
            onClick={addMember}
          >
            + Üye ekle
          </button>

          {/* Sub-units */}
          {(unit.subUnits || []).length > 0 && (
            <div style={{ marginTop: 12, borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                Alt Birimler / Masalar / Temsilcilikler
              </div>
              {unit.subUnits.map(su => (
                <SubUnitEditor
                  key={su.id}
                  su={su} color={color}
                  onChange={updated => updateSubUnit(su.id, updated)}
                  onRemove={() => removeSubUnit(su.id)}
                />
              ))}
            </div>
          )}

          <button
            className="btn btn-outline btn-sm"
            style={{ marginTop: 8, fontSize: 11, padding: '3px 10px' }}
            onClick={addSubUnit}
          >
            + Alt birim / masa ekle
          </button>
        </div>
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
      setChart(data || {
        name: 'Departman Adı',
        head: '',
        units: [emptyUnit()],
      });
      setLoading(false);
    });
  }, []);

  const update = useCallback((updatedChart) => {
    setChart(updatedChart);
    setDirty(true);
  }, []);

  const handleSave = async () => {
    // Basic validation
    if (!chart.name.trim()) { notify('Departman adı gerekli.', 'error'); return; }
    setSaving(true);
    const { error } = await saveOrgChart(chart);
    setSaving(false);
    if (error) {
      notify('Hata: ' + error.message, 'error');
    } else {
      notify('✅ Organizasyon şeması kaydedildi.');
      setDirty(false);
    }
  };

  const updateUnit = (uid, updated) => {
    update({ ...chart, units: chart.units.map(u => u.id === uid ? updated : u) });
  };
  const removeUnit = (uid) => {
    update({ ...chart, units: chart.units.filter(u => u.id !== uid) });
  };
  const addUnit = () => {
    update({ ...chart, units: [...chart.units, emptyUnit()] });
  };
  const moveUnit = (idx, dir) => {
    const units = [...chart.units];
    const [moved] = units.splice(idx, 1);
    units.splice(idx + dir, 0, moved);
    update({ ...chart, units });
  };

  if (loading) return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
      Yükleniyor…
    </div>
  );

  return (
    <div>
      {/* Top save bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderRadius: 10, marginBottom: 20,
        background: dirty ? '#fff9ec' : 'var(--surface)',
        border: `1px solid ${dirty ? '#fbbf24' : 'var(--border)'}`,
      }}>
        <div style={{ fontSize: 12.5, color: dirty ? '#92400e' : 'var(--text-muted)' }}>
          {dirty ? '⚠️ Kaydedilmemiş değişiklikler var.' : '✅ Tüm değişiklikler kaydedildi.'}
        </div>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || !dirty}
          style={{ minWidth: 120 }}
        >
          {saving ? '⏳ Kaydediliyor…' : '💾 Kaydet'}
        </button>
      </div>

      {/* Department info */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">🏢 Departman Bilgileri</div>
        <div className="form-row">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Departman Adı</label>
            <input className="form-input"
              value={chart.name}
              onChange={e => update({ ...chart, name: e.target.value })}
              placeholder="Örn: Uluslararası İlişkiler Departmanı" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Departman Yöneticisi</label>
            <input className="form-input"
              value={chart.head || ''}
              onChange={e => update({ ...chart, head: e.target.value })}
              placeholder="Ad Soyad" />
          </div>
        </div>
      </div>

      {/* Units */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 2 }}>🏗 Birimler ({chart.units.length})</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Birimi genişletmek için başlığına tıklayın · Dolu nokta = Sorumlu / Boş nokta = Personel
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={addUnit}>
            + Yeni Birim
          </button>
        </div>

        {chart.units.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--surface)', borderRadius: 8 }}>
            Henüz birim yok. "+ Yeni Birim" ile ekleyin.
          </div>
        )}

        {chart.units.map((unit, ui) => (
          <UnitEditor
            key={unit.id}
            unit={unit}
            color={UNIT_COLORS[ui % UNIT_COLORS.length]}
            onChange={updated => updateUnit(unit.id, updated)}
            onRemove={() => removeUnit(unit.id)}
            onMoveUp={() => moveUnit(ui, -1)}
            onMoveDown={() => moveUnit(ui, 1)}
            isFirst={ui === 0}
            isLast={ui === chart.units.length - 1}
          />
        ))}

        {chart.units.length > 0 && (
          <button
            className="btn btn-outline"
            style={{ width: '100%', marginTop: 8 }}
            onClick={addUnit}
          >
            + Yeni Birim Ekle
          </button>
        )}
      </div>

      {/* Bottom save */}
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
