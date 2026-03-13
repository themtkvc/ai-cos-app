import React, { useState, useEffect } from 'react';
import { getOrgChart } from '../lib/supabase';

const UNIT_COLORS = [
  '#1a3a5c', '#2563eb', '#16a34a', '#7c3aed', '#d97706',
  '#0891b2', '#dc2626', '#db2777',
];

function unitColor(chart, unit) {
  const idx = chart.units.indexOf(unit);
  return UNIT_COLORS[idx % UNIT_COLORS.length];
}

function memberMatchesSearch(m, q) {
  return m.name.toLowerCase().includes(q);
}

function MemberRow({ m, color, small }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: small ? '3px 14px' : '5px 18px',
    }}>
      <span style={{
        width: small ? 7 : 8, height: small ? 7 : 8,
        borderRadius: '50%', flexShrink: 0,
        background: m.isLead ? color : '#d1d5db',
        boxShadow: m.isLead ? `0 0 0 2px ${color}44` : 'none',
      }} />
      <span style={{
        flex: 1, fontSize: small ? 12 : 12.5, color: 'var(--text)',
        fontWeight: m.isLead ? 600 : 400,
      }}>
        {m.name}
      </span>
      {m.ext && (
        <span style={{
          fontSize: 10.5, color: 'var(--text-muted)',
          fontFamily: 'monospace',
          background: 'var(--surface)',
          padding: '1px 5px', borderRadius: 4,
          border: '1px solid var(--border)',
        }}>
          {m.ext}
        </span>
      )}
    </div>
  );
}

function SubUnitCard({ su, color, search }) {
  const visible = !search || su.name.toLowerCase().includes(search)
    || su.members.some(m => memberMatchesSearch(m, search));
  if (!visible) return null;

  const leads    = su.members.filter(m => m.isLead);
  const regulars = su.members.filter(m => !m.isLead);

  return (
    <div style={{
      margin: '6px 12px 2px 24px',
      borderRadius: 8, border: '1px solid var(--border)',
      background: 'var(--bg)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '5px 12px',
        fontSize: 11.5, fontWeight: 700,
        color: color,
        background: color + '0e',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <span style={{ opacity: 0.5, fontWeight: 400 }}>└</span>
        {su.name}
        <span style={{
          marginLeft: 'auto', fontSize: 10.5, fontWeight: 500,
          color: 'var(--text-muted)',
        }}>
          {su.members.length} kişi
        </span>
      </div>
      {[...leads, ...regulars].map((m, mi) => (
        <MemberRow key={m.id || mi} m={m} color={color} small />
      ))}
    </div>
  );
}

function UnitCard({ unit, color, search }) {
  const q       = search.trim().toLowerCase();
  const leads   = unit.members.filter(m => m.isLead);
  const regulars = unit.members.filter(m => !m.isLead);

  const unitStaff = unit.members.length
    + (unit.subUnits || []).reduce((s, su) => s + su.members.length, 0);

  return (
    <div style={{
      background: 'white',
      borderRadius: 12,
      border: '1px solid var(--border)',
      borderTop: `4px solid ${color}`,
      boxShadow: '0 2px 10px rgba(0,0,0,.06)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Unit header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        background: color + '06',
      }}>
        <div style={{
          display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', gap: 8,
        }}>
          <div style={{
            fontWeight: 700, fontSize: 13.5,
            color: 'var(--navy)', lineHeight: 1.35,
          }}>
            {unit.icon ? unit.icon + ' ' : ''}{unit.name}
          </div>
          <span style={{
            flexShrink: 0, padding: '2px 9px',
            borderRadius: 20, fontSize: 11, fontWeight: 600,
            background: color + '18', color: color,
          }}>
            {unitStaff}
          </span>
        </div>
        {unit.subUnits?.length > 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
            {unit.subUnits.length} alt birim
          </div>
        )}
      </div>

      {/* Members */}
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 380, paddingTop: 6, paddingBottom: 8 }}>
        {[...leads, ...regulars].map((m, mi) => {
          const highlighted = q && memberMatchesSearch(m, q);
          return (
            <div key={m.id || mi}
              style={{ background: highlighted ? color + '10' : 'transparent' }}>
              <MemberRow m={m} color={color} />
            </div>
          );
        })}

        {/* Sub-units */}
        {(unit.subUnits || []).map((su, si) => (
          <SubUnitCard key={su.id || si} su={su} color={color} search={q} />
        ))}
      </div>
    </div>
  );
}

export default function OrgChart({ user, profile, onNavigate }) {
  const [chart,   setChart]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    getOrgChart().then(({ data }) => {
      setChart(data);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="page">
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
        Yükleniyor…
      </div>
    </div>
  );

  if (!chart) return (
    <div className="page">
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
        Organizasyon şeması henüz oluşturulmamış.
        {profile?.role === 'direktor' && (
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={() => onNavigate('admin')}>
              Admin Panelinde Oluştur →
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const q = search.trim().toLowerCase();
  const totalStaff = chart.units.reduce(
    (s, u) => s + u.members.length + (u.subUnits || []).reduce((ss, su) => ss + su.members.length, 0), 0
  );

  const visibleUnits = chart.units.filter(unit => {
    if (!q) return true;
    if (unit.name.toLowerCase().includes(q)) return true;
    if (unit.members.some(m => memberMatchesSearch(m, q))) return true;
    if ((unit.subUnits || []).some(su =>
      su.name.toLowerCase().includes(q) || su.members.some(m => memberMatchesSearch(m, q))
    )) return true;
    return false;
  });

  return (
    <div className="page">
      {/* Page header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 className="page-title">🏢 {chart.name}</h1>
            {chart.head && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  background: 'var(--navy)', color: 'white',
                }}>
                  👤 {chart.head}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Departman Yöneticisi</span>
              </div>
            )}
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 20, flexShrink: 0 }}>
            {[
              { n: chart.units.length, l: 'Birim' },
              { n: totalStaff,          l: 'Personel' },
            ].map(({ n, l }) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 28, fontWeight: 700, lineHeight: 1,
                  color: 'var(--navy)',
                }}>{n}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Search */}
        <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            className="form-input"
            placeholder="🔍 Personel veya birim ara…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 380 }}
          />
          {q && (
            <button className="btn btn-outline btn-sm" onClick={() => setSearch('')}>✕ Temizle</button>
          )}
          {profile?.role === 'direktor' && (
            <button
              className="btn btn-outline btn-sm"
              style={{ marginLeft: 'auto' }}
              onClick={() => onNavigate('admin')}
            >
              ✏️ Düzenle
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 18,
        padding: '8px 0', marginBottom: 12, fontSize: 12, color: 'var(--text-muted)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#1a3a5c', boxShadow: '0 0 0 2px #1a3a5c44', display: 'inline-block' }} />
          Birim Sorumlusu / Koordinatör
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#d1d5db', display: 'inline-block' }} />
          Personel
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            fontSize: 10.5, fontFamily: 'monospace',
            background: 'var(--surface)', padding: '1px 5px',
            borderRadius: 4, border: '1px solid var(--border)',
          }}>1234</span>
          Dahili
        </div>
      </div>

      {/* No results */}
      {visibleUnits.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          "{search}" için sonuç bulunamadı.
        </div>
      )}

      {/* Unit grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 20,
        alignItems: 'start',
      }}>
        {visibleUnits.map(unit => (
          <UnitCard
            key={unit.id}
            unit={unit}
            color={unitColor(chart, unit)}
            search={search}
          />
        ))}
      </div>
    </div>
  );
}
