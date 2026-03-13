import React, { useState, useEffect, useCallback } from 'react';
import { getOrgChart, saveOrgChart, inviteStaffMember } from '../lib/supabase';

const UNIT_COLORS = [
  '#1a3a5c', '#2563eb', '#16a34a', '#7c3aed', '#d97706',
  '#0891b2', '#dc2626', '#db2777',
];

function unitColor(chart, unit) {
  const idx = chart.units.indexOf(unit);
  return UNIT_COLORS[idx % UNIT_COLORS.length];
}

function memberMatchesSearch(m, q) {
  return (
    m.name.toLowerCase().includes(q) ||
    (m.position || '').toLowerCase().includes(q) ||
    (m.expertise || '').toLowerCase().includes(q)
  );
}

// ── Birthday helper ───────────────────────────────────────────────────────────
function fmtBirthday(str) {
  if (!str) return null;
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Info row used in profile modal ────────────────────────────────────────────
function InfoRow({ icon, label, value, href }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 15, flexShrink: 0, width: 20, textAlign: 'center', marginTop: 1 }}>{icon}</span>
      <div style={{ minWidth: 80, fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
      {href
        ? <a href={href} style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none' }}>{value}</a>
        : <div style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{value}</div>}
    </div>
  );
}

// ── Profile Modal ─────────────────────────────────────────────────────────────
function ProfileModal({ member, color, isDirector, onClose, onInviteSuccess }) {
  const [inviting,  setInviting]  = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

  const handleInvite = async () => {
    if (!member.email) return;
    setInviting(true);
    setInviteMsg('');
    const { data, error } = await inviteStaffMember(member.email, member.name);
    setInviting(false);
    if (error) {
      setInviteMsg('❌ ' + error.message);
    } else {
      const msg = data.alreadyExists
        ? 'ℹ️ Bu e-posta zaten kayıtlı. Kullanıcı sisteme giriş yapabilir.'
        : `✅ ${member.name} adına davet e-postası gönderildi.`;
      setInviteMsg(msg);
      onInviteSuccess(member.id);
    }
  };

  const initials = member.name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'white', borderRadius: 16, maxWidth: 480, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,.2)',
        overflow: 'hidden',
        animation: 'fadeIn .15s ease',
      }}>
        {/* Top banner */}
        <div style={{
          background: `linear-gradient(135deg, ${color}, ${color}cc)`,
          padding: '24px 24px 20px',
          position: 'relative',
        }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 12, right: 12,
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(255,255,255,.25)', border: 'none',
              color: 'white', cursor: 'pointer', fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>

          {/* Avatar */}
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: 'rgba(255,255,255,.25)',
            border: '3px solid rgba(255,255,255,.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700, color: 'white',
            marginBottom: 12,
          }}>
            {initials}
          </div>

          <div style={{ fontWeight: 700, fontSize: 20, color: 'white', lineHeight: 1.2 }}>
            {member.name}
          </div>
          {member.position && (
            <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,.85)', marginTop: 4 }}>
              {member.position}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {member.isLead && (
              <span style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: 'rgba(255,255,255,.2)', color: 'white',
              }}>● Birim Sorumlusu</span>
            )}
            {member.invited && (
              <span style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: 'rgba(255,255,255,.2)', color: 'white',
              }}>✓ Sisteme Davet Edildi</span>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '16px 24px 20px' }}>
          {/* Expertise */}
          {member.expertise && (
            <div style={{
              padding: '10px 12px', background: color + '0c',
              borderRadius: 8, marginBottom: 12,
              fontSize: 13, color: 'var(--text)', lineHeight: 1.5,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: color, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 3 }}>
                Uzmanlık Alanı
              </span>
              {member.expertise}
            </div>
          )}

          {/* Info rows */}
          {member.email && (
            <InfoRow icon="✉️" label="E-posta" value={member.email} href={`mailto:${member.email}`} />
          )}
          {member.phone && <InfoRow icon="📱" label="Telefon" value={member.phone} />}
          {member.birthday && <InfoRow icon="🎂" label="Doğum Günü" value={fmtBirthday(member.birthday)} />}

          {/* Empty state */}
          {!member.expertise && !member.email && !member.phone && !member.birthday && (
            <div style={{ padding: '12px 0', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
              Henüz bilgi girilmedi.
            </div>
          )}

          {/* Account activation (direktör only) */}
          {isDirector && (
            <div style={{
              marginTop: 16, paddingTop: 14,
              borderTop: '1px solid var(--border)',
            }}>
              {member.email ? (
                member.invited ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px', borderRadius: 8,
                    background: '#f0fdf4', border: '1px solid #bbf7d0',
                    fontSize: 13, color: '#16a34a',
                  }}>
                    <span style={{ fontSize: 16 }}>✅</span>
                    Sisteme davet edildi — giriş e-postası gönderildi
                  </div>
                ) : (
                  <>
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', gap: 6 }}
                      onClick={handleInvite}
                      disabled={inviting}
                    >
                      {inviting ? '⏳ Gönderiliyor…' : '📧 Hesap Oluştur & Davet Gönder'}
                    </button>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6, textAlign: 'center' }}>
                      {member.email} adresine Supabase giriş daveti gönderilir
                    </div>
                  </>
                )
              ) : (
                <div style={{
                  padding: '10px 14px', background: '#fef9ec',
                  borderRadius: 8, border: '1px solid #fde68a',
                  fontSize: 12.5, color: '#92400e',
                }}>
                  💡 Hesap oluşturmak için Admin → Org Şeması bölümünden e-posta ekleyin.
                </div>
              )}
              {inviteMsg && (
                <div style={{
                  marginTop: 8, padding: '8px 12px', borderRadius: 8, fontSize: 12.5,
                  background: inviteMsg.startsWith('❌') ? '#fef2f2' : '#f0fdf4',
                  color: inviteMsg.startsWith('❌') ? '#dc2626' : '#16a34a',
                }}>
                  {inviteMsg}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Member list row (clickable) ───────────────────────────────────────────────
function MemberItem({ m, color, onSelect }) {
  return (
    <div
      onClick={() => onSelect(m)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 18px', cursor: 'pointer',
        transition: 'background .12s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = color + '0c'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: m.isLead ? color : '#d1d5db',
        boxShadow: m.isLead ? `0 0 0 2px ${color}44` : 'none',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 12.5, color: 'var(--text)',
          fontWeight: m.isLead ? 600 : 400,
        }}>
          {m.name}
        </span>
        {m.position && (
          <span style={{
            fontSize: 11, color: color,
            marginLeft: 6, fontWeight: 500,
          }}>
            {m.position}
          </span>
        )}
      </div>
      {m.invited && <span style={{ fontSize: 10, color: '#16a34a', flexShrink: 0 }}>✓</span>}
    </div>
  );
}

// ── Sub-unit display ──────────────────────────────────────────────────────────
function SubUnitCard({ su, color, search, onSelect }) {
  const q = search.trim().toLowerCase();
  const visible = !q || su.name.toLowerCase().includes(q)
    || su.members.some(m => memberMatchesSearch(m, q));
  if (!visible) return null;

  const leads    = su.members.filter(m => m.isLead);
  const regulars = su.members.filter(m => !m.isLead);

  return (
    <div style={{
      margin: '6px 12px 2px 24px', borderRadius: 8,
      border: '1px solid var(--border)', background: 'var(--bg)', overflow: 'hidden',
    }}>
      <div style={{
        padding: '5px 12px', fontSize: 11.5, fontWeight: 700, color,
        background: color + '0e', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <span style={{ opacity: 0.4, fontWeight: 400 }}>└</span>
        {su.name}
        <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 500, color: 'var(--text-muted)' }}>
          {su.members.length} kişi
        </span>
      </div>
      {[...leads, ...regulars].map((m, mi) => (
        <MemberItem key={m.id || mi} m={m} color={color} onSelect={onSelect} />
      ))}
    </div>
  );
}

// ── Unit card ─────────────────────────────────────────────────────────────────
function UnitCard({ unit, color, search, onSelect }) {
  const q       = search.trim().toLowerCase();
  const leads   = unit.members.filter(m => m.isLead);
  const regulars = unit.members.filter(m => !m.isLead);
  const unitStaff = unit.members.length
    + (unit.subUnits || []).reduce((s, su) => s + su.members.length, 0);

  return (
    <div style={{
      background: 'white', borderRadius: 12,
      border: '1px solid var(--border)', borderTop: `4px solid ${color}`,
      boxShadow: '0 2px 10px rgba(0,0,0,.06)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: color + '06' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--navy)', lineHeight: 1.35 }}>
            {unit.icon ? unit.icon + ' ' : ''}{unit.name}
          </div>
          <span style={{
            flexShrink: 0, padding: '2px 9px', borderRadius: 20,
            fontSize: 11, fontWeight: 600, background: color + '18', color,
          }}>{unitStaff}</span>
        </div>
        {unit.subUnits?.length > 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
            {unit.subUnits.length} alt birim
          </div>
        )}
      </div>

      {/* Members */}
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 380, paddingTop: 6, paddingBottom: 8 }}>
        {[...leads, ...regulars].map((m, mi) => (
          <MemberItem key={m.id || mi} m={m} color={color} onSelect={onSelect} />
        ))}

        {(unit.subUnits || []).map((su, si) => (
          <SubUnitCard key={su.id || si} su={su} color={color} search={search} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

// ── Direct staff section ──────────────────────────────────────────────────────
function DirectStaffSection({ members, onSelect }) {
  if (!members || members.length === 0) return null;
  const color = '#1a3a5c';

  return (
    <div style={{
      display: 'flex', gap: 12, flexWrap: 'wrap',
      padding: '14px 20px', marginBottom: 20,
      background: 'white', borderRadius: 12,
      border: '1px solid var(--border)',
      borderLeft: '4px solid #1a3a5c',
      boxShadow: '0 2px 8px rgba(0,0,0,.05)',
    }}>
      <div style={{ width: '100%', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Departman Düzeyinde Pozisyonlar
        </span>
      </div>
      {members.map((m, mi) => (
        <div key={m.id || mi}
          onClick={() => onSelect(m)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
            border: '1px solid var(--border)', background: 'var(--surface)',
            transition: 'all .12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#eef3ff'; e.currentTarget.style.borderColor = '#c7d7fa'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: color + '18', border: `2px solid ${color}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 14, color,
          }}>
            {m.name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--navy)' }}>{m.name}</div>
            {m.position && (
              <div style={{ fontSize: 11.5, color, fontWeight: 500, marginTop: 1 }}>{m.position}</div>
            )}
          </div>
          {m.invited && <span style={{ fontSize: 10, color: '#16a34a', marginLeft: 2 }}>✓</span>}
        </div>
      ))}
    </div>
  );
}

// ── Main OrgChart page ────────────────────────────────────────────────────────
export default function OrgChart({ user, profile, onNavigate }) {
  const [chart,   setChart]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [selected, setSelected] = useState(null);   // member for profile modal
  const [selectedColor, setSelectedColor] = useState('#1a3a5c');

  const isDirector = profile?.role === 'direktor';

  const load = useCallback(async () => {
    const { data } = await getOrgChart();
    setChart(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // After invite success: update member's invited flag + save
  const handleInviteSuccess = useCallback(async (memberId) => {
    setChart(prev => {
      if (!prev) return prev;

      const markInvited = (members) =>
        members.map(m => m.id === memberId ? { ...m, invited: true } : m);

      const updated = {
        ...prev,
        directStaff: markInvited(prev.directStaff || []),
        units: prev.units.map(u => ({
          ...u,
          members: markInvited(u.members),
          subUnits: (u.subUnits || []).map(su => ({
            ...su,
            members: markInvited(su.members),
          })),
        })),
      };

      // Persist in background
      saveOrgChart(updated).catch(() => {});

      // Update selected member if open
      if (selected?.id === memberId) {
        setSelected(sel => sel ? { ...sel, invited: true } : sel);
      }

      return updated;
    });
  }, [selected]);

  const openProfile = (member, color = '#1a3a5c') => {
    setSelected(member);
    setSelectedColor(color);
  };

  if (loading) return (
    <div className="page">
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor…</div>
    </div>
  );

  if (!chart) return (
    <div className="page">
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
        Organizasyon şeması henüz oluşturulmamış.
        {isDirector && (
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

  const totalStaff =
    (chart.directStaff || []).length +
    chart.units.reduce(
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

  const visibleDirect = (chart.directStaff || []).filter(m =>
    !q || memberMatchesSearch(m, q)
  );

  return (
    <div className="page">
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: scale(1); } }`}</style>

      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 className="page-title">🏢 {chart.name}</h1>
            {chart.head && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  background: 'var(--navy)', color: 'white',
                }}>👤 {chart.head}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Departman Yöneticisi</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 20, flexShrink: 0 }}>
            {[{ n: chart.units.length, l: 'Birim' }, { n: totalStaff, l: 'Personel' }].map(({ n, l }) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, lineHeight: 1, color: 'var(--navy)' }}>{n}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <input className="form-input"
            placeholder="🔍 Personel, pozisyon veya birim ara…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 380 }} />
          {q && <button className="btn btn-outline btn-sm" onClick={() => setSearch('')}>✕ Temizle</button>}
          {isDirector && (
            <button className="btn btn-outline btn-sm"
              style={{ marginLeft: 'auto' }}
              onClick={() => onNavigate('admin')}>✏️ Düzenle</button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '6px 0', marginBottom: 12, fontSize: 12, color: 'var(--text-muted)' }}>
        <span>● Dolu = Sorumlu</span>
        <span>○ Boş = Personel</span>
        <span>✓ = Sisteme davet edildi</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#2563eb' }}>İsme tıkla → profil</span>
      </div>

      {/* Direct staff section */}
      {(q ? visibleDirect : (chart.directStaff || [])).length > 0 && (
        <DirectStaffSection
          members={q ? visibleDirect : (chart.directStaff || [])}
          onSelect={m => openProfile(m, '#1a3a5c')}
        />
      )}

      {/* Unit grid */}
      {visibleUnits.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          "{search}" için sonuç bulunamadı.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
        {visibleUnits.map(unit => (
          <UnitCard
            key={unit.id}
            unit={unit}
            color={unitColor(chart, unit)}
            search={search}
            onSelect={m => openProfile(m, unitColor(chart, unit))}
          />
        ))}
      </div>

      {/* Profile Modal */}
      {selected && (
        <ProfileModal
          member={selected}
          color={selectedColor}
          isDirector={isDirector}
          onClose={() => setSelected(null)}
          onInviteSuccess={handleInviteSuccess}
        />
      )}
    </div>
  );
}
