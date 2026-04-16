import React, { useState, useEffect, useCallback } from 'react';
import { getOrgChart, getAllProfiles, updateUserProfile } from '../lib/supabase';
import { ROLE_LABELS } from '../lib/constants';

const UNIT_COLORS = [
  '#1a3a5c', '#2563eb', '#16a34a', '#7c3aed', '#d97706',
  '#0891b2', '#dc2626', '#db2777', '#0d9488', '#ea580c',
];

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ profile, size = 36 }) {
  const [err, setErr] = useState(false);
  const name = profile?.full_name || profile?.email || '?';
  const initials = name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
  if (profile?.avatar_url && !err) {
    return (
      <img src={profile.avatar_url} alt={name} onError={() => setErr(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--accent)', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, flexShrink: 0,
      border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
    }}>{initials}</div>
  );
}

// ── Profil Modalı ─────────────────────────────────────────────────────────────
function ProfileModal({ profile, color, isCoordinator, onClose }) {
  const name = profile.full_name || profile.email || '';
  const role = profile.role || 'personel';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'white', borderRadius: 16, maxWidth: 420, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,.2)', overflow: 'hidden',
        animation: 'fadeIn .15s ease',
      }}>
        {/* Banner */}
        <div style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`, padding: '24px 24px 20px', position: 'relative' }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: 12, right: 12, width: 28, height: 28,
            borderRadius: '50%', background: 'rgba(255,255,255,.25)', border: 'none',
            color: 'white', cursor: 'pointer', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
          <Avatar profile={profile} size={60} />
          <div style={{ fontWeight: 700, fontSize: 20, color: 'white', lineHeight: 1.2, marginTop: 10 }}>{name}</div>
          <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,.85)', marginTop: 4 }}>
            {ROLE_LABELS[role] || role}
          </div>
          {isCoordinator && (
            <span style={{ display: 'inline-block', marginTop: 8, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(255,255,255,.2)', color: 'white' }}>
              ★ Koordinatör
            </span>
          )}
        </div>
        {/* İçerik */}
        <div style={{ padding: '16px 24px 20px' }}>
          {profile.email && (
            <div style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
              <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>✉️</span>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)', minWidth: 70 }}>E-posta</span>
              <a href={`mailto:${profile.email}`} style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none' }}>{profile.email}</a>
            </div>
          )}
          {profile.unit && (
            <div style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
              <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>🏗</span>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)', minWidth: 70 }}>Birim</span>
              <span style={{ fontSize: 13 }}>{profile.unit}</span>
            </div>
          )}
          {!profile.email && !profile.unit && (
            <div style={{ padding: '12px 0', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
              Profil bilgisi girilmemiş.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Üye satırı ────────────────────────────────────────────────────────────────
function MemberRow({ profile, color, isCoordinator, onSelect }) {
  return (
    <div
      onClick={() => onSelect(profile, isCoordinator)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 14px', cursor: 'pointer', transition: 'background .12s',
        borderBottom: '1px solid var(--border)',
      }}
      onMouseEnter={e => e.currentTarget.style.background = color + '0c'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <Avatar profile={profile} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: isCoordinator ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {profile.full_name || profile.email}
          {isCoordinator && (
            <span style={{ marginLeft: 6, fontSize: 10, background: color + '18', color, borderRadius: 20, padding: '1px 7px', fontWeight: 700 }}>
              ★ Koordinatör
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
          {ROLE_LABELS[profile.role] || profile.role}
          {profile.unit && <span style={{ marginLeft: 4 }}>· {profile.unit}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Birim kartı ───────────────────────────────────────────────────────────────
function UnitCard({ unit, color, profiles, search, onSelect }) {
  const q = search.trim().toLowerCase();

  // member_ids → profil nesneleri
  const memberProfiles = (unit.member_ids || [])
    .map(id => profiles.find(p => p.user_id === id))
    .filter(Boolean);

  const coordinator = profiles.find(p => p.user_id === unit.coordinator_id);

  // Arama filtresi
  const visibleMembers = q
    ? memberProfiles.filter(p =>
        (p.full_name || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (ROLE_LABELS[p.role] || p.role || '').toLowerCase().includes(q)
      )
    : memberProfiles;

  const unitVisible = !q || unit.name.toLowerCase().includes(q) || visibleMembers.length > 0;
  if (!unitVisible) return null;

  // Koordinatörü başa al
  const sorted = coordinator
    ? [coordinator, ...visibleMembers.filter(p => p.user_id !== unit.coordinator_id)]
    : visibleMembers;

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 12,
      border: '1px solid var(--border)', borderTop: `4px solid ${color}`,
      boxShadow: '0 2px 10px rgba(0,0,0,.06)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Başlık */}
      <div style={{ padding: '14px 16px 12px', background: color + '06', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {unit.icon && (
            <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
              {unit.icon}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)', lineHeight: 1.3 }}>{unit.name}</div>
            {coordinator && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                <Avatar profile={coordinator} size={16} />
                <span style={{ fontSize: 11, color, fontWeight: 600 }}>
                  {coordinator.full_name?.split(' ')[0] || coordinator.email}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>· koordinatör</span>
              </div>
            )}
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 600, color, background: color + '18', padding: '3px 10px', borderRadius: 20, flexShrink: 0 }}>
            {memberProfiles.length} kişi
          </span>
        </div>
      </div>

      {/* Üyeler */}
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 360 }}>
        {sorted.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
            {q ? 'Eşleşen üye yok' : (
              <span>
                Henüz üye atanmamış<br />
                <span style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                  Admin → Org Şeması'ndan atayabilirsiniz
                </span>
              </span>
            )}
          </div>
        ) : (
          sorted.map(p => (
            <MemberRow
              key={p.user_id}
              profile={p}
              color={color}
              isCoordinator={p.user_id === unit.coordinator_id}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Direktör/Genel Müdür kartı + Yönetici Asistanı ──────────────────────────
function DirectorCard({ profile, label = 'Direktör', assistants = [], isDirektor, allProfiles, onReload }) {
  const [err, setErr] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const name = profile?.full_name || profile?.email || label;
  const initials = name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);

  const assignAsistant = async (userId) => {
    setSaving(true);
    await updateUserProfile(userId, { role: 'asistan' });
    setSaving(false);
    setShowPicker(false);
    if (onReload) onReload();
  };

  const removeAsistant = async (userId) => {
    if (!window.confirm('Bu kişinin yönetici asistanlığını kaldırmak istiyor musunuz?')) return;
    setSaving(true);
    await updateUserProfile(userId, { role: 'personel' });
    setSaving(false);
    if (onReload) onReload();
  };

  // Asistan olarak atanabilecek kişiler (direktör ve mevcut asistanlar hariç)
  const assignable = (allProfiles || []).filter(p =>
    p.user_id !== profile?.user_id &&
    p.role !== 'direktor' &&
    p.role !== 'asistan' &&
    p.role !== 'direktor_yardimcisi'
  );

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 12,
      border: '1px solid var(--border)', borderLeft: '4px solid var(--navy)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24,
      padding: '12px 20px',
    }}>
      {/* Direktör */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {profile?.avatar_url && !err ? (
          <img src={profile.avatar_url} alt={name} onError={() => setErr(true)}
            style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '3px solid #1a3a5c22' }} />
        ) : (
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'var(--navy)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700,
          }}>{initials}</div>
        )}
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--navy)' }}>{name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            <span style={{ background: 'var(--navy-pale)', color: 'var(--navy)', padding: '1px 8px', borderRadius: 20, fontWeight: 600 }}>
              {label}
            </span>
          </div>
        </div>
      </div>

      {/* Yönetici Asistanı */}
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Yönetici Asistanı</span>
          {isDirektor && (
            <button onClick={() => setShowPicker(!showPicker)} disabled={saving}
              style={{ fontSize: 11, fontWeight: 600, color: 'var(--navy)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
              {showPicker ? '✕ İptal' : '+ Ata'}
            </button>
          )}
        </div>

        {assistants.length > 0 ? assistants.map(a => (
          <div key={a.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <AssistantRow profile={a} />
            {isDirektor && (
              <button onClick={() => removeAsistant(a.user_id)} disabled={saving}
                title="Asistanlıktan çıkar"
                style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', opacity: saving ? 0.5 : 1 }}>
                ✕
              </button>
            )}
          </div>
        )) : (
          <div style={{ fontSize: 12, color: 'var(--text-light)', fontStyle: 'italic' }}>Henüz atanmamış</div>
        )}

        {/* Kişi seçici */}
        {showPicker && (
          <div style={{
            marginTop: 8, padding: 10, borderRadius: 10,
            border: '1px solid var(--border)', background: 'var(--surface)',
            maxHeight: 180, overflowY: 'auto',
          }}>
            {assignable.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 8 }}>Atanabilecek kişi yok</div>
            ) : assignable.map(p => (
              <button key={p.user_id} onClick={() => assignAsistant(p.user_id)} disabled={saving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '6px 8px', borderRadius: 8, border: 'none',
                  background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 12, color: 'var(--text)', textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover, #f3f4f6)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontWeight: 600 }}>{p.full_name || p.email}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                  {ROLE_LABELS[p.role] || p.role}{p.unit ? ` · ${p.unit}` : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AssistantRow({ profile }) {
  const name = profile?.full_name || profile?.email || '';
  const initials = name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
  const [err, setErr] = useState(false);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
      {profile?.avatar_url && !err ? (
        <img src={profile.avatar_url} alt={name} onError={() => setErr(true)}
          style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }} />
      ) : (
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--gray-mid)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700,
        }}>{initials}</div>
      )}
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          <span style={{ background: 'var(--gray-mid)', color: '#fff', padding: '1px 7px', borderRadius: 20, fontWeight: 600, fontSize: 10, opacity: 0.2 }}>
            Yönetici Asistanı
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Ana Bileşen ───────────────────────────────────────────────────────────────
export default function OrgChart({ user, profile, onNavigate }) {
  const [chart,    setChart]    = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState(null);
  const [selectedColor, setSelectedColor] = useState('#1a3a5c');
  const [selectedIsCoord, setSelectedIsCoord] = useState(false);

  const isDirektor = ['direktor', 'direktor_yardimcisi', 'asistan'].includes(profile?.role);

  const loadData = useCallback(() => {
    Promise.all([getOrgChart(), getAllProfiles()]).then(([{ data: c }, { data: p }]) => {
      setChart(c);
      setProfiles(p || []);
      setLoading(false);
    });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openProfile = (p, isCoord, color) => {
    setSelected(p);
    setSelectedIsCoord(isCoord);
    setSelectedColor(color || '#1a3a5c');
  };

  if (loading) return (
    <div className="page">
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div className="loading-spinner" />
      </div>
    </div>
  );

  if (!chart || !(chart.units?.length > 0)) return (
    <div className="page">
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Organizasyon şeması henüz oluşturulmamış</div>
        {isDirektor && (
          <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => onNavigate('admin')}>
            Admin Panelinde Oluştur →
          </button>
        )}
      </div>
    </div>
  );

  const q = search.trim().toLowerCase();

  const headProfile = profiles.find(p => p.user_id === chart.head_id);

  const totalAssigned = new Set(
    (chart.units || []).flatMap(u => u.member_ids || [])
  ).size;

  return (
    <div className="page">
      <style>{`@keyframes fadeIn { from { opacity:0; transform:scale(.96); } to { opacity:1; transform:scale(1); } }`}</style>

      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 className="page-title">🏢 {chart.name || 'Organizasyon Şeması'}</h1>
            <p className="page-subtitle">
              {chart.units?.length || 0} birim · {totalAssigned} personel
            </p>
          </div>
          <div style={{ display: 'flex', gap: 20, flexShrink: 0 }}>
            {[
              { n: chart.units?.length || 0, l: 'Birim' },
              { n: totalAssigned, l: 'Personel' },
            ].map(({ n, l }) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, lineHeight: 1, color: 'var(--navy)' }}>{n}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="form-input"
            placeholder="🔍 Personel, birim veya rol ara…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 340 }} />
          {q && <button className="btn btn-outline btn-sm" onClick={() => setSearch('')}>✕ Temizle</button>}
          {isDirektor && (
            <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }}
              onClick={() => onNavigate('admin')}>✏️ Düzenle</button>
          )}
        </div>
      </div>

      {/* Direktör kartı + Yönetici Asistanı */}
      {headProfile && !q && (
        <DirectorCard
          profile={headProfile}
          label={ROLE_LABELS[headProfile.role] || 'Direktör'}
          assistants={profiles.filter(p => p.role === 'asistan' && p.user_id !== headProfile.user_id)}
          isDirektor={isDirektor}
          allProfiles={profiles}
          onReload={loadData}
        />
      )}

      {/* Birim kartları */}
      {(chart.units || []).length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          Henüz birim oluşturulmamış.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20, alignItems: 'start' }}>
          {(chart.units || []).map((unit, i) => (
            <UnitCard
              key={unit.id || i}
              unit={unit}
              color={UNIT_COLORS[i % UNIT_COLORS.length]}
              profiles={profiles}
              search={search}
              onSelect={(p, isCoord) => openProfile(p, isCoord, UNIT_COLORS[i % UNIT_COLORS.length])}
            />
          ))}
        </div>
      )}

      {q && (chart.units || []).every(u => {
        const members = (u.member_ids || []).map(id => profiles.find(p => p.user_id === id)).filter(Boolean);
        const visible = members.filter(p =>
          (p.full_name || '').toLowerCase().includes(q) ||
          (p.email || '').toLowerCase().includes(q) ||
          (ROLE_LABELS[p.role] || '').toLowerCase().includes(q)
        );
        return !u.name.toLowerCase().includes(q) && visible.length === 0;
      }) && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          "{search}" için sonuç bulunamadı.
        </div>
      )}

      {/* Profil Modalı */}
      {selected && (
        <ProfileModal
          profile={selected}
          color={selectedColor}
          isCoordinator={selectedIsCoord}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
