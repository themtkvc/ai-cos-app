import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getOrgChart, getAllProfiles, updateUserProfile, updateDashboardAccess, inviteStaffMember, deleteUser } from '../lib/supabase';
import { ROLE_LABELS } from '../lib/constants';
import { UserAvatar } from './ProfileSettings';

const UNIT_COLORS = [
  '#1a3a5c', '#2563eb', '#16a34a', '#7c3aed', '#d97706',
  '#0891b2', '#dc2626', '#db2777', '#0d9488', '#ea580c',
];

// ── USER MANAGEMENT CONSTANTS & COMPONENT ──
const ROLE_OPTIONS = [
  { value: 'direktor',            label: 'Direktör' },
  { value: 'direktor_yardimcisi', label: 'Direktör Yardımcısı (Hibeler)' },
  { value: 'asistan',             label: 'Yönetici Asistanı' },
  { value: 'koordinator',         label: 'Koordinatör' },
  { value: 'personel',            label: 'Personel' },
];

const UNIT_OPTIONS = [
  'Fonlar', 'Hibeler', 'İnsani İşler',
  'Partnerlikler', 'Politika, Yönetişim ve Güvence',
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
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
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

// ── Kullanıcı Yönetimi Bileşeni ──────────────────────────────────────────────
function UserManagement({ currentUser, notify }) {
  const [profiles, setProfiles]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [editingId, setEditingId]     = useState(null);
  const [editDraft, setEditDraft]     = useState({});
  const [saving, setSaving]           = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole]   = useState('personel');
  const [inviteUnit, setInviteUnit]   = useState('');
  const [inviteName, setInviteName]   = useState('');
  const [inviting, setInviting]       = useState(false);
  const [deletingId, setDeletingId]   = useState(null);
  const [viewMode, setViewMode]       = useState('list');

  const loadProfiles = async () => {
    setLoading(true);
    const { data } = await getAllProfiles();
    setProfiles(data || []);
    setLoading(false);
  };

  useEffect(() => { loadProfiles(); }, []);

  const startEdit = (p) => {
    setEditingId(p.user_id);
    setEditDraft({ full_name: p.full_name || '', role: p.role, unit: p.unit || '' });
  };

  const saveEdit = async (userId) => {
    setSaving(true);
    const { error } = await updateUserProfile(userId, editDraft);
    setSaving(false);
    if (error) { notify('Hata: ' + error.message, 'error'); return; }
    notify('✅ Kullanıcı güncellendi.');
    setEditingId(null);
    loadProfiles();
  };

  const toggleDashboard = async (p) => {
    const newVal = !p.can_view_dashboard;
    const { error } = await updateDashboardAccess(p.user_id, newVal);
    if (error) { notify('Hata: ' + error.message, 'error'); return; }
    notify(newVal ? `✅ ${p.full_name || 'Kullanıcı'} dashboard erişimi verildi.` : `ℹ️ Dashboard erişimi kaldırıldı.`);
    loadProfiles();
  };

  const handleDelete = async (p) => {
    const confirmMsg = `"${p.full_name || p.email || 'Bu kullanıcı'}" kalıcı olarak silinecek.\n\nBu işlem geri alınamaz. Devam etmek istiyor musunuz?`;
    if (!window.confirm(confirmMsg)) return;
    setDeletingId(p.user_id);
    const { error } = await deleteUser(p.user_id);
    setDeletingId(null);
    if (error) { notify('Hata: ' + error.message, 'error'); return; }
    notify(`🗑 ${p.full_name || 'Kullanıcı'} başarıyla silindi.`);
    loadProfiles();
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      notify('Geçersiz e-posta formatı. Lütfen kontrol edin.', 'error');
      return;
    }
    const alreadyExists = profiles.some(p => p.email?.toLowerCase() === email);
    if (alreadyExists) {
      notify('Bu e-posta adresi zaten kayıtlı.', 'error');
      return;
    }
    setInviting(true);
    const { data, error } = await inviteStaffMember(
      email,
      inviteName.trim() || email.split('@')[0],
      inviteRole,
    );
    setInviting(false);
    if (error) {
      notify('Hata: ' + error.message, 'error');
      return;
    }
    notify(`✅ Davet gönderildi: ${inviteEmail}. Kullanıcı e-posta ile şifresini belirleyecek.`);
    setInviteEmail(''); setInviteName(''); setInviteRole('personel'); setInviteUnit('');
    if (inviteUnit && data?.user?.id) {
      await updateUserProfile(data.user.id, { unit: inviteUnit });
    }
    loadProfiles();
  };

  const roleColor = (role) => {
    const map = {
      direktor: '#1a3a5c', direktor_yardimcisi: '#1e5799',
      asistan: '#2e6da4', koordinator: '#c47a1e', personel: '#666',
    };
    return map[role] || '#666';
  };

  const hierarchyGroups = useMemo(() => {
    const coordinators = profiles.filter(p => p.role === 'koordinator');
    const senior = profiles.filter(p => ['direktor','direktor_yardimcisi','asistan'].includes(p.role));
    const unassigned = profiles.filter(p =>
      ['koordinator','personel'].includes(p.role) && !p.unit
    );
    const groups = coordinators.map(coord => ({
      coordinator: coord,
      staff: profiles.filter(p => p.role === 'personel' && p.unit && p.unit === coord.unit),
    }));
    const assignedUnits = new Set(coordinators.map(c => c.unit).filter(Boolean));
    const orphanStaff = profiles.filter(p =>
      p.role === 'personel' && p.unit && !assignedUnits.has(p.unit)
    );
    return { senior, groups, unassigned, orphanStaff };
  }, [profiles]);

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding: 60 }}><div className="loading-spinner" /></div>;

  const UserRow = ({ p }) => (
    <div key={p.user_id} style={{
      padding:'12px 16px', borderRadius:10, border:'1px solid var(--border)',
      background:'var(--surface)', display:'flex', alignItems:'center', gap:12,
    }}>
      <UserAvatar
        profile={{ full_name: p.full_name, avatar_url: p.avatar_url }}
        size={38}
        fontSize={15}
        style={{ border: `2px solid ${roleColor(p.role)}44` }}
      />

      <div style={{flex:1, minWidth:0}}>
        {editingId === p.user_id ? (
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
            <input className="form-input" style={{width:130,padding:'4px 8px',fontSize:12}}
              placeholder="Ad Soyad" value={editDraft.full_name}
              onChange={e => setEditDraft(d => ({...d, full_name: e.target.value}))} />
            <select className="form-input" style={{width:160,padding:'4px 8px',fontSize:12}}
              value={editDraft.role}
              onChange={e => setEditDraft(d => ({...d, role: e.target.value}))}>
              {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            {['koordinator','personel'].includes(editDraft.role) && (
              <select className="form-input" style={{width:170,padding:'4px 8px',fontSize:12}}
                value={editDraft.unit}
                onChange={e => setEditDraft(d => ({...d, unit: e.target.value}))}>
                <option value="">— Birim seç —</option>
                {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            )}
          </div>
        ) : (
          <>
            <div style={{fontWeight:600, fontSize:13, color:'var(--text)', display:'flex', alignItems:'center', gap:6}}>
              {p.full_name || 'İsimsiz'}
              {['koordinator','personel'].includes(p.role) && !p.unit && (
                <span title="Birim atanmamış — görev ataması çalışmaz" style={{
                  fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:4,
                  background:'var(--orange-pale)', color:'#c2410c', border:'1px solid var(--orange)22',
                }}>⚠️ Birim yok</span>
              )}
            </div>
            <div style={{fontSize:11.5, color:'var(--text-muted)', marginTop:2}}>
              {p.unit ? `🏢 ${p.unit}` : <span style={{color:'var(--text-light)'}}>Birim atanmamış</span>}
            </div>
          </>
        )}
      </div>

      <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
        {editingId !== p.user_id && (
          <span style={{
            padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600,
            background: roleColor(p.role) + '18', color: roleColor(p.role),
          }}>
            {ROLE_LABELS[p.role] || p.role}
          </span>
        )}
        {p.user_id === currentUser.id && (
          <span style={{fontSize:10,color:'var(--text-muted)'}}>(siz)</span>
        )}
        {editingId !== p.user_id && !['direktor','direktor_yardimcisi'].includes(p.role) && (
          <button
            title={p.can_view_dashboard ? 'Dashboard erişimi var — kaldırmak için tıkla' : 'Dashboard erişimi ver'}
            onClick={() => toggleDashboard(p)}
            style={{
              padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer',
              background: p.can_view_dashboard ? '#16a34a18' : 'var(--surface)',
              color: p.can_view_dashboard ? '#16a34a' : 'var(--text-muted)',
              border: `1px solid ${p.can_view_dashboard ? '#16a34a44' : 'var(--border)'}`,
              transition: 'all 0.15s',
            }}
          >
            📊 {p.can_view_dashboard ? 'Dashboard ✓' : 'Dashboard'}
          </button>
        )}
        {editingId === p.user_id ? (
          <>
            <button className="btn btn-outline btn-sm"
              onClick={() => setEditingId(null)} disabled={saving}>İptal</button>
            <button className="btn btn-primary btn-sm"
              onClick={() => saveEdit(p.user_id)} disabled={saving}>
              {saving ? '⏳' : '✓ Kaydet'}
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-outline btn-sm" onClick={() => startEdit(p)}>✏️</button>
            {p.user_id !== currentUser.id && p.role !== 'direktor' && (
              <button
                title="Kullanıcıyı kalıcı olarak sil"
                onClick={() => handleDelete(p)}
                disabled={deletingId === p.user_id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 7,
                  border: '1.5px solid #fca5a5',
                  background: deletingId === p.user_id ? '#fef2f2' : 'white',
                  color: '#dc2626',
                  fontSize: 12.5, fontWeight: 700, cursor: deletingId === p.user_id ? 'default' : 'pointer',
                  opacity: deletingId === p.user_id ? 0.6 : 1,
                  fontFamily: 'inherit',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={e => { if (!deletingId) { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#ef4444'; } }}
                onMouseLeave={e => { if (!deletingId) { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#fca5a5'; } }}
              >
                {deletingId === p.user_id ? '⏳ Siliniyor…' : '🗑 Sil'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div>
      {/* Başlık + görünüm seçici */}
      <div className="card" style={{marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div className="card-title" style={{marginBottom:0}}>👥 Sistem Kullanıcıları ({profiles.length})</div>
          <div style={{display:'flex',gap:8}}>
            <div style={{display:'flex',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,overflow:'hidden'}}>
              {[{k:'list',l:'📋 Liste'},{k:'hierarchy',l:'🏢 Hiyerarşi'}].map(v => (
                <button key={v.k} onClick={() => setViewMode(v.k)} style={{
                  padding:'5px 12px', border:'none', cursor:'pointer', fontSize:12, fontFamily:'inherit',
                  background: viewMode===v.k ? 'var(--navy)' : 'transparent',
                  color: viewMode===v.k ? 'white' : 'var(--text-muted)', fontWeight: viewMode===v.k ? 700 : 400,
                }}>{v.l}</button>
              ))}
            </div>
            <button className="btn btn-outline btn-sm" onClick={loadProfiles}>↺ Yenile</button>
          </div>
        </div>

        {profiles.length === 0 ? (
          <div style={{padding:24,textAlign:'center',color:'var(--text-muted)'}}>Kayıtlı kullanıcı yok</div>
        ) : viewMode === 'list' ? (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {profiles.map(p => <UserRow key={p.user_id} p={p} />)}
          </div>
        ) : (
          /* HİYERARŞİ GÖRÜNÜMÜ */
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {hierarchyGroups.senior.length > 0 && (
              <div>
                <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',letterSpacing:'0.06em',marginBottom:8}}>ÜST YÖNETİM</div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {hierarchyGroups.senior.map(p => <UserRow key={p.user_id} p={p} />)}
                </div>
              </div>
            )}

            {hierarchyGroups.groups.map(({ coordinator: coord, staff }) => (
              <div key={coord.user_id} style={{
                border:'1.5px solid var(--border)', borderRadius:12, overflow:'hidden',
              }}>
                <div style={{
                  background:'linear-gradient(90deg,var(--orange-pale),var(--orange-pale))',
                  padding:'10px 14px', display:'flex', alignItems:'center', gap:10,
                  borderBottom: staff.length > 0 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{fontSize:16}}>🏢</span>
                  <div style={{flex:1}}>
                    <span style={{fontWeight:700,fontSize:13,color:'#92400e'}}>
                      {coord.unit || 'Birim Atanmamış'} — Koordinatör
                    </span>
                    <span style={{fontSize:12,color:'#a16207',marginLeft:8}}>
                      {coord.full_name || 'İsimsiz'}
                    </span>
                  </div>
                  <span style={{fontSize:11,color:'#a16207',background:'var(--orange-pale)',padding:'2px 8px',borderRadius:10,border:'1px solid var(--gold)22'}}>
                    {staff.length} personel
                  </span>
                  <button className="btn btn-outline btn-sm" onClick={() => startEdit(coord)} style={{fontSize:11}}>✏️</button>
                </div>
                {staff.length > 0 ? (
                  <div style={{display:'flex',flexDirection:'column',gap:0}}>
                    {staff.map((p, i) => (
                      <div key={p.user_id} style={{
                        borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                        padding:'0 0 0 24px',
                      }}>
                        <UserRow p={p} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{padding:'10px 14px 10px 38px',fontSize:12.5,color:'var(--text-muted)',fontStyle:'italic'}}>
                    Bu birimde henüz personel yok — kullanıcı düzenle (✏️) ile birim atayın
                  </div>
                )}
              </div>
            ))}

            {hierarchyGroups.orphanStaff.length > 0 && (
              <div style={{border:'1px dashed var(--border)',borderRadius:10,padding:12}}>
                <div style={{fontSize:11,fontWeight:700,color:'var(--text-light)',letterSpacing:'0.05em',marginBottom:8}}>BİRİM KOORDİNATÖRSÜZ PERSONEL</div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {hierarchyGroups.orphanStaff.map(p => <UserRow key={p.user_id} p={p} />)}
                </div>
              </div>
            )}

            {hierarchyGroups.unassigned.length > 0 && (
              <div style={{border:'1.5px solid var(--orange)22',borderRadius:10,padding:12,background:'var(--orange-pale)'}}>
                <div style={{fontSize:11,fontWeight:700,color:'#c2410c',letterSpacing:'0.05em',marginBottom:8}}>
                  ⚠️ BİRİM ATANMAMIŞ ({hierarchyGroups.unassigned.length} kişi)
                </div>
                <div style={{fontSize:12,color:'#92400e',marginBottom:10}}>
                  Aşağıdaki kullanıcıların birim ataması yapılana kadar koordinatör-personel hiyerarşisi çalışmaz.
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {hierarchyGroups.unassigned.map(p => <UserRow key={p.user_id} p={p} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Davet Et / Yeni Kullanıcı */}
      <div className="card">
        <div className="card-title">✉️ Personel Davet Et</div>
        <p style={{fontSize:12.5,color:'var(--text-muted)',marginBottom:16,lineHeight:1.6}}>
          Sisteme davet e-postası gönderin. Kişi <strong>irdp.app</strong> adresine yönlendirilecek
          ve şifresini kendisi belirleyecek.
        </p>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <input className="form-input" style={{flex:1,minWidth:180}} placeholder="E-posta *"
              value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            <input className="form-input" style={{flex:1,minWidth:140}} placeholder="Ad Soyad"
              value={inviteName} onChange={e => setInviteName(e.target.value)} />
          </div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <select className="form-select" style={{flex:1}} value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
              {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            {['koordinator','personel'].includes(inviteRole) && (
              <select className="form-select" style={{flex:1}} value={inviteUnit} onChange={e => setInviteUnit(e.target.value)}>
                <option value="">— Birim seç (opsiyonel) —</option>
                {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            )}
          </div>
          {['koordinator','personel'].includes(inviteRole) && !inviteUnit && (
            <div style={{fontSize:12,color:'#92400e',background:'var(--orange-pale)',padding:'8px 12px',borderRadius:7,border:'1px solid var(--orange)22'}}>
              💡 Koordinatör/Personel için birim seçmeniz önerilir — aksi hâlde görev ataması ve hiyerarşi davet sonrasında çalışmaz.
            </div>
          )}
          <button className="btn btn-primary" onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} style={{alignSelf:'flex-start'}}>
            {inviting ? '⏳ Gönderiliyor…' : '✉️ Davet Gönder'}
          </button>
        </div>

        <div style={{
          marginTop:16, padding:'12px 14px', background:'var(--surface)', borderRadius:8,
          border:'1px solid var(--border)', fontSize:12, color:'var(--text-muted)', lineHeight:1.7,
        }}>
          <strong style={{color:'var(--text)'}}>Manuel kayıt:</strong> Kullanıcı <strong>irdp.app</strong> adresine gidip
          "Henüz hesabınız yok mu?" linkinden kayıt olabilir. Kayıt sonrası bu panelden rol ve birim atayın.
        </div>
      </div>
    </div>
  );
}

// ── Ana Bileşen ───────────────────────────────────────────────────────────────
export default function OrgChart({ user, profile, onNavigate, defaultTab }) {
  const [chart,    setChart]    = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState(null);
  const [selectedColor, setSelectedColor] = useState('#1a3a5c');
  const [selectedIsCoord, setSelectedIsCoord] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab === 'users' ? 'users' : 'orgchart');
  const [notification, setNotification] = useState(null);

  const isDirektor = ['direktor', 'direktor_yardimcisi', 'asistan'].includes(profile?.role);
  const canManageUsers = profile?.role === 'direktor';

  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

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

  // If user management tab is active and user has access, show it directly
  if (activeTab === 'users' && canManageUsers) {
    return (
      <div className="page">
        <style>{`@keyframes slideIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }`}</style>
        {notification && (
          <div style={{
            position:'fixed', top:20, right:20, zIndex:9999,
            padding:'12px 20px', borderRadius:10, fontWeight:500, fontSize:13.5,
            background: notification.type === 'error' ? 'var(--red)' : 'var(--navy)',
            color:'white', boxShadow:'0 8px 24px rgba(0,0,0,0.25)',
            animation:'slideIn 0.2s ease',
          }}>
            {notification.msg}
          </div>
        )}
        <div className="page-header">
          <div>
            <h1 className="page-title">🏢 Organizasyon & Personel</h1>
            <p className="page-subtitle">Organizasyon şeması ve kullanıcı yönetimi</p>
          </div>
          {/* Tabs */}
          <div style={{
            display:'flex', gap:6, marginTop:20,
            background:'var(--bg)', borderRadius:14, padding:5,
            border:'1px solid var(--border)', width:'fit-content',
          }}>
            {[
              { id:'orgchart', icon:'🏢', label:'Org Şeması' },
              ...(canManageUsers ? [{ id:'users', icon:'👥', label:'Kullanıcı Yönetimi' }] : []),
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                  display:'flex', alignItems:'center', gap:6,
                  padding:'7px 16px', borderRadius:10, border:'none', cursor:'pointer',
                  fontSize:13, fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  background: isActive ? 'var(--navy)' : 'transparent',
                  boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.18)' : 'none',
                  transition:'all 0.18s', fontFamily:'var(--font-body)', whiteSpace:'nowrap',
                }}>
                  <span style={{ fontSize:15 }}>{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
        <UserManagement currentUser={user} notify={notify} />
      </div>
    );
  }

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

        {/* Tabs */}
        {canManageUsers && (
          <div style={{
            display:'flex', gap:6, marginTop:16,
            background:'var(--bg)', borderRadius:14, padding:5,
            border:'1px solid var(--border)', width:'fit-content',
          }}>
            {[
              { id:'orgchart', icon:'🏢', label:'Org Şeması' },
              { id:'users', icon:'👥', label:'Kullanıcı Yönetimi' },
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                  display:'flex', alignItems:'center', gap:6,
                  padding:'7px 16px', borderRadius:10, border:'none', cursor:'pointer',
                  fontSize:13, fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  background: isActive ? 'var(--navy)' : 'transparent',
                  boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.18)' : 'none',
                  transition:'all 0.18s', fontFamily:'var(--font-body)', whiteSpace:'nowrap',
                }}>
                  <span style={{ fontSize:15 }}>{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="form-input"
            placeholder="🔍 Personel, birim veya rol ara…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 340 }} />
          {q && <button className="btn btn-outline btn-sm" onClick={() => setSearch('')}>✕ Temizle</button>}
        </div>
      </div>

      {/* Direktör Ofisi — Direktör + Yönetici Asistanı(ları) */}
      {headProfile && !q && (
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            margin: '0 0 10px 2px',
          }}>
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: 'var(--navy)', letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              🏛 Direktör Ofisi
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <DirectorCard
            profile={headProfile}
            label={ROLE_LABELS[headProfile.role] || 'Direktör'}
            assistants={profiles.filter(p => p.role === 'asistan' && p.user_id !== headProfile.user_id)}
            isDirektor={isDirektor}
            allProfiles={profiles}
            onReload={loadData}
          />
        </div>
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
