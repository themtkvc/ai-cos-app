import React, { useState, useEffect } from 'react';
import { getSystemStats, seedDemoData, clearChatHistory, clearTable, getAllProfiles, updateUserProfile, updateDashboardAccess, getPublicAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement, inviteStaffMember, supabase, getAgendaTypes, createAgendaType, updateAgendaType, deleteAgendaType } from '../lib/supabase';
import { ROLE_LABELS } from '../App';
import { UNITS as UNIT_LIST } from '../lib/constants';
import OrgChartAdmin from '../components/OrgChartAdmin';
import { UserAvatar } from './ProfileSettings';

const DEFAULT_ORG = {
  orgName: 'Uluslararası İnsani Yardım Örgütü',
  directorTitle: 'Direktör',
  staffCount: 50,
  units: UNIT_LIST.map(u => ({ name: u.name, coordinator: u.coordinator, icon: u.icon })),
};

function loadOrgConfig() {
  try {
    const saved = localStorage.getItem('ai-cos-org-config');
    return saved ? JSON.parse(saved) : DEFAULT_ORG;
  } catch { return DEFAULT_ORG; }
}

function saveOrgConfig(config) {
  localStorage.setItem('ai-cos-org-config', JSON.stringify(config));
}

function StatusDot({ ok }) {
  return (
    <span style={{
      display:'inline-block', width:10, height:10, borderRadius:'50%',
      background: ok ? 'var(--green)' : 'var(--red)',
      boxShadow: ok ? '0 0 6px var(--green)' : '0 0 6px var(--red)',
      marginRight:8, flexShrink:0
    }} />
  );
}

// ── USER MANAGEMENT COMPONENT ──
const ROLE_OPTIONS = [
  { value: 'direktor',            label: 'Direktör' },
  { value: 'direktor_yardimcisi', label: 'Direktör Yardımcısı' },
  { value: 'asistan',             label: 'Asistan' },
  { value: 'koordinator',         label: 'Koordinatör' },
  { value: 'personel',            label: 'Personel' },
];

const UNIT_OPTIONS = [
  'Partnerships', 'Humanitarian Affairs', 'Traditional Donors',
  'Grants', 'Accreditations', 'Policy & Governance',
];

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
  const [viewMode, setViewMode]       = useState('list'); // 'list' | 'hierarchy'

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

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    // Email format doğrulama
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      notify('Geçersiz e-posta formatı. Lütfen kontrol edin.', 'error');
      return;
    }
    // Mevcut kullanıcı kontrolü
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
    // Unit'i ayrıca set et (davet sonrası profil oluşur, birimi atayacağız)
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

  // Birim hiyerarşisi: koordinatörler ve onların personeli
  const hierarchyGroups = React.useMemo(() => {
    const coordinators = profiles.filter(p => p.role === 'koordinator');
    const senior = profiles.filter(p => ['direktor','direktor_yardimcisi','asistan'].includes(p.role));
    const unassigned = profiles.filter(p =>
      ['koordinator','personel'].includes(p.role) && !p.unit
    );
    const groups = coordinators.map(coord => ({
      coordinator: coord,
      staff: profiles.filter(p => p.role === 'personel' && p.unit && p.unit === coord.unit),
    }));
    // personel with unit but no matching coordinator
    const assignedUnits = new Set(coordinators.map(c => c.unit).filter(Boolean));
    const orphanStaff = profiles.filter(p =>
      p.role === 'personel' && p.unit && !assignedUnits.has(p.unit)
    );
    return { senior, groups, unassigned, orphanStaff };
  }, [profiles]);

  if (loading) return <div style={{padding:32,textAlign:'center',color:'var(--text-muted)'}}>Yükleniyor…</div>;

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
                  background:'#fff7ed', color:'#c2410c', border:'1px solid #f9731644',
                }}>⚠️ Birim yok</span>
              )}
            </div>
            <div style={{fontSize:11.5, color:'var(--text-muted)', marginTop:2}}>
              {p.unit ? `🏢 ${p.unit}` : <span style={{color:'#9ca3af'}}>Birim atanmamış</span>}
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
          <button className="btn btn-outline btn-sm" onClick={() => startEdit(p)}>✏️</button>
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
            {/* Üst yönetim */}
            {hierarchyGroups.senior.length > 0 && (
              <div>
                <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',letterSpacing:'0.06em',marginBottom:8}}>ÜST YÖNETİM</div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {hierarchyGroups.senior.map(p => <UserRow key={p.user_id} p={p} />)}
                </div>
              </div>
            )}

            {/* Birim grupları */}
            {hierarchyGroups.groups.map(({ coordinator: coord, staff }) => (
              <div key={coord.user_id} style={{
                border:'1.5px solid var(--border)', borderRadius:12, overflow:'hidden',
              }}>
                {/* Koordinatör başlığı */}
                <div style={{
                  background:'linear-gradient(90deg,#fef3c7,#fffbeb)',
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
                  <span style={{fontSize:11,color:'#a16207',background:'#fef3c7',padding:'2px 8px',borderRadius:10,border:'1px solid #f59e0b44'}}>
                    {staff.length} personel
                  </span>
                  <button className="btn btn-outline btn-sm" onClick={() => startEdit(coord)} style={{fontSize:11}}>✏️</button>
                </div>
                {/* Personel */}
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

            {/* Koordinatörsüz personel */}
            {hierarchyGroups.orphanStaff.length > 0 && (
              <div style={{border:'1px dashed var(--border)',borderRadius:10,padding:12}}>
                <div style={{fontSize:11,fontWeight:700,color:'#9ca3af',letterSpacing:'0.05em',marginBottom:8}}>BİRİM KOORDİNATÖRSÜZ PERSONEL</div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {hierarchyGroups.orphanStaff.map(p => <UserRow key={p.user_id} p={p} />)}
                </div>
              </div>
            )}

            {/* Birimsiz koordinatör/personel */}
            {hierarchyGroups.unassigned.length > 0 && (
              <div style={{border:'1.5px solid #f9731644',borderRadius:10,padding:12,background:'#fff7ed'}}>
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
            <div style={{fontSize:12,color:'#92400e',background:'#fff7ed',padding:'8px 12px',borderRadius:7,border:'1px solid #f9731644'}}>
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

// ── ANNOUNCEMENT MANAGEMENT COMPONENT ──
const PRIORITY_OPTIONS = [
  { value: 'normal',    label: 'Normal',  color: '#2563eb' },
  { value: 'important', label: 'Önemli',  color: '#d97706' },
  { value: 'urgent',    label: 'Acil',    color: '#dc2626' },
];

const EMPTY_ANN = { title: '', content: '', priority: 'normal', active: true };

function AnnouncementManagement({ notify }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [editingId, setEditingId]         = useState(null); // null = new, string = existing
  const [draft, setDraft]                 = useState(null);
  const [saving, setSaving]               = useState(false);
  const [deletingId, setDeletingId]       = useState(null);

  const load = async () => {
    setLoading(true);
    // Fetch ALL announcements (including inactive) for admin view
    const { data: allData } = await supabase
      .from('public_announcements')
      .select('*')
      .order('published_at', { ascending: false });
    setAnnouncements(allData || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startNew = () => {
    setEditingId('new');
    setDraft({ ...EMPTY_ANN });
  };

  const startEdit = (ann) => {
    setEditingId(ann.id);
    setDraft({ title: ann.title, content: ann.content, priority: ann.priority, active: ann.active });
  };

  const cancelEdit = () => { setEditingId(null); setDraft(null); };

  const handleSave = async () => {
    if (!draft.title.trim()) { notify('Başlık gerekli.', 'error'); return; }
    setSaving(true);
    let error;
    if (editingId === 'new') {
      ({ error } = await createAnnouncement({
        ...draft,
        published_at: new Date().toISOString(),
      }));
    } else {
      ({ error } = await updateAnnouncement(editingId, draft));
    }
    setSaving(false);
    if (error) { notify('Hata: ' + error.message, 'error'); return; }
    notify(editingId === 'new' ? '✅ Duyuru oluşturuldu.' : '✅ Duyuru güncellendi.');
    cancelEdit();
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu duyuruyu silmek istediğinizden emin misiniz?')) return;
    setDeletingId(id);
    const { error } = await deleteAnnouncement(id);
    setDeletingId(null);
    if (error) { notify('Hata: ' + error.message, 'error'); return; }
    notify('Duyuru silindi.');
    load();
  };

  const handleToggleActive = async (ann) => {
    const { error } = await updateAnnouncement(ann.id, { active: !ann.active });
    if (error) { notify('Hata: ' + error.message, 'error'); return; }
    notify(!ann.active ? '✅ Duyuru yayınlandı.' : 'ℹ️ Duyuru gizlendi.');
    load();
  };

  const priorityInfo = (p) => PRIORITY_OPTIONS.find(x => x.value === p) || PRIORITY_OPTIONS[0];

  return (
    <div>
      {/* Header */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 4 }}>📢 Duyuru Yönetimi</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              Giriş sayfasında herkesin görebileceği duyuruları buradan yönetin.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={load}>↺ Yenile</button>
            {editingId !== 'new' && (
              <button className="btn btn-primary btn-sm" onClick={startNew}>+ Yeni Duyuru</button>
            )}
          </div>
        </div>

        {/* New / Edit form */}
        {editingId !== null && (
          <div style={{
            padding: '16px', marginBottom: 16, borderRadius: 10,
            background: 'var(--surface)', border: '2px solid var(--navy)',
          }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 14, color: 'var(--navy)' }}>
              {editingId === 'new' ? '➕ Yeni Duyuru' : '✏️ Duyuruyu Düzenle'}
            </div>

            <div className="form-group">
              <label className="form-label">Başlık *</label>
              <input className="form-input" placeholder="Duyuru başlığı..."
                value={draft.title}
                onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">İçerik</label>
              <textarea className="form-input" rows={3}
                placeholder="Duyuru detayı (isteğe bağlı)..."
                style={{ resize: 'vertical', minHeight: 72 }}
                value={draft.content}
                onChange={e => setDraft(d => ({ ...d, content: e.target.value }))} />
            </div>

            <div className="form-row" style={{ marginBottom: 0 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Öncelik</label>
                <select className="form-input" value={draft.priority}
                  onChange={e => setDraft(d => ({ ...d, priority: e.target.value }))}>
                  {PRIORITY_OPTIONS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'flex-end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={draft.active}
                    onChange={e => setDraft(d => ({ ...d, active: e.target.checked }))} />
                  Hemen yayınla (aktif)
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline btn-sm" onClick={cancelEdit} disabled={saving}>İptal</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? '⏳ Kaydediliyor...' : '✓ Kaydet'}
              </button>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor…</div>
        ) : announcements.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
            Henüz duyuru yok. "+ Yeni Duyuru" ile ekleyin.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {announcements.map(ann => {
              const pi = priorityInfo(ann.priority);
              return (
                <div key={ann.id} style={{
                  padding: '12px 16px', borderRadius: 10,
                  border: `1px solid ${pi.color}33`,
                  background: ann.active ? 'var(--surface)' : 'var(--gray-light)',
                  opacity: ann.active ? 1 : 0.65,
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 20, fontSize: 10.5, fontWeight: 700,
                        background: pi.color + '18', color: pi.color, textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>
                        {pi.label}
                      </span>
                      {!ann.active && (
                        <span style={{
                          padding: '2px 8px', borderRadius: 20, fontSize: 10.5, fontWeight: 600,
                          background: 'var(--text-muted)22', color: 'var(--text-muted)',
                        }}>Gizli</span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        {ann.published_at ? new Date(ann.published_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                      </span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)', marginBottom: ann.content ? 4 : 0 }}>
                      {ann.title}
                    </div>
                    {ann.content && (
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55 }}>{ann.content}</div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                    <button
                      title={ann.active ? 'Gizle' : 'Yayınla'}
                      onClick={() => handleToggleActive(ann)}
                      style={{
                        padding: '4px 10px', borderRadius: 16, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        background: ann.active ? '#16a34a18' : 'var(--surface)',
                        color: ann.active ? '#16a34a' : 'var(--text-muted)',
                        border: `1px solid ${ann.active ? '#16a34a44' : 'var(--border)'}`,
                      }}
                    >
                      {ann.active ? '✓ Aktif' : '○ Gizli'}
                    </button>
                    {editingId !== ann.id && (
                      <button className="btn btn-outline btn-sm"
                        onClick={() => startEdit(ann)}
                        disabled={editingId !== null}>✏️</button>
                    )}
                    <button
                      className="btn btn-sm"
                      style={{ background: 'var(--red-pale)', color: 'var(--red)', border: '1px solid var(--red)22' }}
                      onClick={() => handleDelete(ann.id)}
                      disabled={deletingId === ann.id}
                    >
                      {deletingId === ann.id ? '⏳' : '🗑'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── GÜNDEM TÜRÜ YÖNETİMİ ──────────────────────────────────────────────────────
const TYPE_COLOR_OPTIONS = [
  '#6366f1', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#84cc16',
];

const TYPE_ICON_OPTIONS = ['📋', '🎉', '👥', '🚀', '📚', '🤝', '🌍', '🏗️', '🎓', '💡', '📊', '🔬'];

function AgendaTypeManagement({ notify }) {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', icon: '📋', color: '#6366f1', fields: [] });
  const [saving, setSaving] = useState(false);
  const [newField, setNewField] = useState({ key: '', label: '', type: 'text', required: false, placeholder: '' });

  const load = async () => {
    setLoading(true);
    const { data } = await getAgendaTypes();
    setTypes(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ name: '', icon: '📋', color: '#6366f1', fields: [] });
    setModal(true);
  };

  const openEdit = (t) => {
    setEditItem(t);
    setForm({ name: t.name, icon: t.icon, color: t.color, fields: t.fields || [] });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editItem) {
      await updateAgendaType(editItem.id, { name: form.name.trim(), icon: form.icon, color: form.color, fields: form.fields });
      notify('Tür güncellendi ✓');
    } else {
      await createAgendaType({ name: form.name.trim(), icon: form.icon, color: form.color, fields: form.fields, sort_order: types.length });
      notify('Tür oluşturuldu ✓');
    }
    setSaving(false);
    setModal(false);
    load();
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`"${name}" türü silinsin mi? Bu türe bağlı gündemler etkilenmez.`)) return;
    await deleteAgendaType(id);
    notify('Tür silindi');
    load();
  };

  const addField = () => {
    if (!newField.key.trim() || !newField.label.trim()) return;
    setForm(prev => ({ ...prev, fields: [...prev.fields, { ...newField, key: newField.key.trim(), label: newField.label.trim() }] }));
    setNewField({ key: '', label: '', type: 'text', required: false, placeholder: '' });
  };

  const removeField = (idx) => {
    setForm(prev => ({ ...prev, fields: prev.fields.filter((_, i) => i !== idx) }));
  };

  return (
    <div className="card" style={{ marginTop: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="card-title" style={{ margin: 0 }}>📋 Gündem Türleri</div>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Yeni Tür</button>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center' }}><div className="loading-spinner" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {types.map(t => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)',
            }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: t.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {t.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {(t.fields || []).length > 0 ? `${t.fields.length} özel alan` : 'Özel alan yok'}
                  {' · '}
                  <span style={{ color: t.color }}>●</span> {t.color}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm btn-outline" onClick={() => openEdit(t)}>✏️ Düzenle</button>
                <button className="btn btn-sm btn-outline" style={{ color: '#ef4444' }} onClick={() => handleDelete(t.id, t.name)}>🗑 Sil</button>
              </div>
            </div>
          ))}
          {types.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13.5 }}>
              Henüz gündem türü yok. + Yeni Tür ile ekleyin.
            </div>
          )}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <h2 className="modal-title">{editItem ? '✏️ Tür Düzenle' : '+ Yeni Gündem Türü'}</h2>

            <div className="form-group">
              <label className="form-label">Tür Adı *</label>
              <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Etkinlik, Proje, Misafir…" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">İkon</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {TYPE_ICON_OPTIONS.map(ic => (
                    <button key={ic} onClick={() => setForm(p => ({ ...p, icon: ic }))}
                      style={{ fontSize: 20, padding: '4px 8px', borderRadius: 8, cursor: 'pointer', border: `2px solid ${form.icon === ic ? 'var(--accent)' : 'var(--border)'}`, background: form.icon === ic ? 'var(--accent)22' : 'var(--bg)' }}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Renk</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {TYPE_COLOR_OPTIONS.map(c => (
                    <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                      style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: `3px solid ${form.color === c ? '#000' : 'transparent'}`, cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
            </div>

            {/* Özel Alanlar */}
            <div className="form-group">
              <label className="form-label" style={{ marginBottom: 8 }}>Özel Form Alanları</label>
              {form.fields.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                  {form.fields.map((f, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}>
                      <span style={{ flex: 1 }}><strong>{f.label}</strong> <span style={{ color: 'var(--text-muted)' }}>({f.type})</span> {f.required ? '· zorunlu' : ''}</span>
                      <button onClick={() => removeField(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 120px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Alan Anahtarı</div>
                  <input className="form-input" style={{ fontSize: 12 }} placeholder="orn: lokasyon" value={newField.key} onChange={e => setNewField(p => ({ ...p, key: e.target.value }))} />
                </div>
                <div style={{ flex: '1 1 120px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Etiket</div>
                  <input className="form-input" style={{ fontSize: 12 }} placeholder="orn: Lokasyon" value={newField.label} onChange={e => setNewField(p => ({ ...p, label: e.target.value }))} />
                </div>
                <div style={{ flex: '0 1 100px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Tür</div>
                  <select className="form-select" style={{ fontSize: 12 }} value={newField.type} onChange={e => setNewField(p => ({ ...p, type: e.target.value }))}>
                    <option value="text">Metin</option>
                    <option value="textarea">Uzun Metin</option>
                    <option value="number">Sayı</option>
                    <option value="date">Tarih</option>
                    <option value="select">Seçim</option>
                  </select>
                </div>
                <div style={{ flex: '0 0 auto' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Zorunlu</div>
                  <input type="checkbox" checked={newField.required} onChange={e => setNewField(p => ({ ...p, required: e.target.checked }))} style={{ width: 18, height: 18, marginTop: 4 }} />
                </div>
                <button className="btn btn-sm btn-outline" style={{ flex: '0 0 auto', alignSelf: 'flex-end' }} onClick={addField}>+ Ekle</button>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(false)}>İptal</button>
              <button className="btn btn-primary" disabled={saving || !form.name.trim()} onClick={handleSave}>
                {saving ? '…' : (editItem ? 'Güncelle' : 'Oluştur')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Admin({ user, profile, onNavigate, defaultTab }) {
  const [activeTab, setActiveTab]     = useState(defaultTab === 'users' ? 'users' : 'system');
  const [stats, setStats]             = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [orgConfig, setOrgConfig]     = useState(loadOrgConfig);
  const [editingOrg, setEditingOrg]   = useState(false);
  const [orgDraft, setOrgDraft]       = useState(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedResult, setSeedResult]   = useState(null);
  const [clearLoading, setClearLoading] = useState('');
  const [notification, setNotification] = useState(null);

  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const supabaseConnected = supabaseUrl && supabaseUrl !== 'https://placeholder.supabase.co';
  const claudeConnected   = true; // Now server-side proxy — assume configured if deployed

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const s = await getSystemStats(user.id);
      setStats(s);
    } catch (e) {
      setStats(null);
    }
    setStatsLoading(false);
  };

  useEffect(() => { loadStats(); }, [user]);

  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleSeedData = async () => {
    if (!window.confirm('Demo verisi yüklenecek. Mevcut verilerinizin üzerine ekleme yapılacak. Devam etmek istiyor musunuz?')) return;
    setSeedLoading(true);
    setSeedResult(null);
    const { error } = await seedDemoData(user.id);
    setSeedLoading(false);
    if (error) {
      setSeedResult({ ok: false, msg: `Hata: ${error.message}` });
      notify('Demo verisi yüklenemedi: ' + error.message, 'error');
    } else {
      setSeedResult({ ok: true, msg: 'Demo verisi başarıyla yüklendi! Dashboard\'a gidip verileri görebilirsiniz.' });
      notify('✅ Demo verisi yüklendi!');
      loadStats();
    }
  };

  const handleClearTable = async (table, label) => {
    if (!window.confirm(`"${label}" tablosundaki TÜM verilerinizi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) return;
    setClearLoading(table);
    const { error } = await clearTable(table, user.id);
    setClearLoading('');
    if (error) {
      notify('Hata: ' + error.message, 'error');
    } else {
      notify(`✅ ${label} temizlendi.`);
      loadStats();
    }
  };

  const handleClearChat = async () => {
    if (!window.confirm('Tüm sohbet geçmişini silmek istediğinizden emin misiniz?')) return;
    setClearLoading('chat');
    await clearChatHistory(user.id);
    setClearLoading('');
    notify('✅ Sohbet geçmişi temizlendi.');
    loadStats();
  };

  const startEditOrg = () => {
    setOrgDraft(JSON.parse(JSON.stringify(orgConfig)));
    setEditingOrg(true);
  };

  const saveOrg = () => {
    saveOrgConfig(orgDraft);
    setOrgConfig(orgDraft);
    setEditingOrg(false);
    notify('✅ Organizasyon yapısı kaydedildi!');
  };

  const resetOrg = () => {
    if (!window.confirm('Organizasyon yapısını varsayılana sıfırlamak istiyor musunuz?')) return;
    saveOrgConfig(DEFAULT_ORG);
    setOrgConfig(DEFAULT_ORG);
    setEditingOrg(false);
    notify('Varsayılan yapıya dönüldü.');
  };

  const DATA_TABLES = [
    { key: 'deadlines', label: 'Görevler & Tarihler', count: stats?.deadlines },
    { key: 'donors', label: 'Donörler', count: stats?.donors },
    { key: 'meeting_actions', label: 'Toplantı Aksiyonları', count: stats?.meetingActions },
    { key: 'interactions', label: 'Donör Etkileşimleri', count: stats?.interactions },
    { key: 'unit_reports', label: 'Birim Raporları', count: stats?.unitReports },
  ];

  // ── İkincil yetki kontrolü: sadece direktör erişebilir ──
  if (profile?.role !== 'direktor') {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>Erişim Reddedildi</h2>
        <p style={{ color: '#64748b', marginTop: 8 }}>Bu sayfaya yalnızca direktör erişebilir.</p>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Notification */}
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
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <h1 className="page-title">⚙️ Admin Paneli</h1>
            <p className="page-subtitle">Sistem yönetimi · Kullanıcı yönetimi · Veri işlemleri</p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => onNavigate('dashboard')}>← Dashboard</button>
        </div>
        {/* Tabs */}
        <div style={{
          display:'flex', gap:6, marginTop:20, flexWrap:'wrap',
          background:'var(--bg)', borderRadius:14, padding:5,
          border:'1px solid var(--border)', width:'fit-content',
        }}>
          {[
            { id:'system',        icon:'⚙️', label:'Sistem & Veri' },
            { id:'users',         icon:'👥', label:'Kullanıcılar' },
            { id:'announcements', icon:'📢', label:'Duyurular' },
            { id:'orgchart',      icon:'🏢', label:'Org Şeması' },
            { id:'agendatypes',   icon:'📋', label:'Gündem Türleri' },
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display:'flex', alignItems:'center', gap:6,
                  padding:'7px 16px', borderRadius:10, border:'none', cursor:'pointer',
                  fontSize:13, fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  background: isActive ? 'var(--navy)' : 'transparent',
                  boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.18)' : 'none',
                  transition:'all 0.18s', fontFamily:'var(--font-body)',
                  whiteSpace:'nowrap',
                }}>
                <span style={{ fontSize:15 }}>{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <UserManagement currentUser={user} notify={notify} />
      )}

      {/* ANNOUNCEMENTS TAB */}
      {activeTab === 'announcements' && (
        <AnnouncementManagement notify={notify} />
      )}

      {/* ORG CHART TAB */}
      {activeTab === 'orgchart' && (
        <OrgChartAdmin notify={notify} />
      )}

      {/* AGENDA TYPES TAB */}
      {activeTab === 'agendatypes' && (
        <AgendaTypeManagement notify={notify} />
      )}

      {/* SYSTEM TAB */}
      {activeTab === 'system' && <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>

        {/* SISTEM DURUMU */}
        <div className="card">
          <div className="card-title">🔌 Sistem Durumu</div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div style={{display:'flex',alignItems:'center',padding:'10px 14px',background:'var(--surface)',borderRadius:8,border:'1px solid var(--border)'}}>
              <StatusDot ok={supabaseConnected} />
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13}}>Supabase Veritabanı</div>
                <div style={{fontSize:11.5,color:'var(--text-muted)',marginTop:2}}>
                  {supabaseConnected ? supabaseUrl : 'Bağlı değil — .env dosyasını kontrol edin'}
                </div>
              </div>
              {supabaseConnected && (
                <span className="badge badge-green" style={{fontSize:10}}>Bağlı</span>
              )}
            </div>

            <div style={{display:'flex',alignItems:'center',padding:'10px 14px',background:'var(--surface)',borderRadius:8,border:'1px solid var(--border)'}}>
              <StatusDot ok={claudeConnected} />
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13}}>Claude AI (Anthropic)</div>
                <div style={{fontSize:11.5,color:'var(--text-muted)',marginTop:2}}>
                  {claudeConnected ? 'API key yapılandırıldı — AI Asistan aktif' : 'API key eksik — Demo modunda çalışıyor'}
                </div>
              </div>
              {claudeConnected
                ? <span className="badge badge-green" style={{fontSize:10}}>Aktif</span>
                : <span className="badge badge-orange" style={{fontSize:10}}>Demo Modu</span>
              }
            </div>

            <div style={{display:'flex',alignItems:'center',padding:'10px 14px',background:'var(--surface)',borderRadius:8,border:'1px solid var(--border)'}}>
              <StatusDot ok={true} />
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13}}>Giriş Yapan Kullanıcı</div>
                <div style={{fontSize:11.5,color:'var(--text-muted)',marginTop:2}}>{user?.email}</div>
              </div>
              <span className="badge badge-blue" style={{fontSize:10}}>Direktör</span>
            </div>
          </div>
        </div>

        {/* VERİ ÖZETİ */}
        <div className="card">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
            <div className="card-title" style={{marginBottom:0}}>📊 Veri Özeti</div>
            <button className="btn btn-outline btn-sm" onClick={loadStats} disabled={statsLoading}>
              {statsLoading ? '⏳' : '↺ Yenile'}
            </button>
          </div>
          {statsLoading ? (
            <div style={{padding:20,textAlign:'center',color:'var(--text-muted)'}}>Yükleniyor…</div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[
                { label:'Görev & Tarih', value: stats?.deadlines ?? '—', icon:'📅', page:'deadlines' },
                { label:'Donör', value: stats?.donors ?? '—', icon:'🤝', page:'donors' },
                { label:'Toplantı Aksiyonu', value: stats?.meetingActions ?? '—', icon:'📋', page:'meetings' },
                { label:'Don. Etkileşimi', value: stats?.interactions ?? '—', icon:'🗂', page:'donors' },
                { label:'Birim Raporu', value: stats?.unitReports ?? '—', icon:'📊', page:'reports' },
                { label:'AI Mesajı', value: stats?.chatMessages ?? '—', icon:'🤖', page:'chat' },
              ].map(({ label, value, icon, page }) => (
                <div key={label}
                  onClick={() => onNavigate(page)}
                  style={{
                    padding:'10px 12px', borderRadius:8, cursor:'pointer',
                    background:'var(--surface)', border:'1px solid var(--border)',
                    display:'flex', alignItems:'center', gap:10, transition:'all 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--gray-light)'}
                  onMouseLeave={e => e.currentTarget.style.background='var(--surface)'}
                >
                  <span style={{fontSize:18}}>{icon}</span>
                  <div>
                    <div style={{fontFamily:'var(--font-display)',fontSize:22,fontWeight:600,lineHeight:1,color:'var(--navy)'}}>{value}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)',marginTop:1}}>{label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ORGANİZASYON YAPISI */}
        <div className="card" style={{gridColumn:'1/3'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div className="card-title" style={{marginBottom:0}}>🏛 Organizasyon Yapısı</div>
            <div style={{display:'flex',gap:8}}>
              {editingOrg ? (
                <>
                  <button className="btn btn-outline btn-sm" onClick={() => setEditingOrg(false)}>İptal</button>
                  <button className="btn btn-outline btn-sm" style={{color:'var(--red)'}} onClick={resetOrg}>↺ Sıfırla</button>
                  <button className="btn btn-primary btn-sm" onClick={saveOrg}>✓ Kaydet</button>
                </>
              ) : (
                <button className="btn btn-outline btn-sm" onClick={startEditOrg}>✏️ Düzenle</button>
              )}
            </div>
          </div>

          {editingOrg && orgDraft ? (
            <div>
              <div className="form-row" style={{marginBottom:16}}>
                <div className="form-group" style={{marginBottom:0}}>
                  <label className="form-label">Organizasyon Adı</label>
                  <input className="form-input" value={orgDraft.orgName}
                    onChange={e => setOrgDraft(d => ({...d, orgName: e.target.value}))} />
                </div>
                <div className="form-group" style={{marginBottom:0}}>
                  <label className="form-label">Direktör Unvanı</label>
                  <input className="form-input" value={orgDraft.directorTitle}
                    onChange={e => setOrgDraft(d => ({...d, directorTitle: e.target.value}))} />
                </div>
              </div>
              <div className="form-label" style={{marginBottom:10}}>Birimler & Koordinatörler</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                {orgDraft.units.map((unit, idx) => (
                  <div key={idx} style={{padding:'12px 14px',border:'1px solid var(--border)',borderRadius:8,background:'var(--surface)'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                      <span style={{fontSize:18}}>{unit.icon}</span>
                      <input className="form-input" style={{flex:1}} value={unit.name}
                        onChange={e => setOrgDraft(d => {
                          const units = [...d.units];
                          units[idx] = {...units[idx], name: e.target.value};
                          return {...d, units};
                        })} />
                    </div>
                    <div>
                      <label className="form-label">Koordinatör</label>
                      <input className="form-input" value={unit.coordinator}
                        onChange={e => setOrgDraft(d => {
                          const units = [...d.units];
                          units[idx] = {...units[idx], coordinator: e.target.value};
                          return {...d, units};
                        })} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div style={{display:'flex',gap:16,marginBottom:16,flexWrap:'wrap'}}>
                <div style={{fontSize:13,color:'var(--text-muted)'}}>
                  <strong style={{color:'var(--text)'}}>{orgConfig.orgName}</strong>
                </div>
                <div style={{fontSize:13,color:'var(--text-muted)'}}>
                  Direktör unvanı: <strong style={{color:'var(--text)'}}>{orgConfig.directorTitle}</strong>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                {orgConfig.units.map((unit, idx) => (
                  <div key={idx} style={{
                    padding:'12px 14px', borderRadius:8,
                    border:'1px solid var(--border)', background:'var(--surface)',
                    display:'flex', alignItems:'center', gap:10
                  }}>
                    <span style={{fontSize:22}}>{unit.icon}</span>
                    <div>
                      <div style={{fontWeight:600,fontSize:13,color:'var(--text)'}}>{unit.name}</div>
                      <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
                        Koordinatör: <strong style={{color:'var(--navy)'}}>{unit.coordinator}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* DEMO VERİSİ */}
        <div className="card">
          <div className="card-title">🌱 Demo Verisi</div>
          <p style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.6,marginBottom:16}}>
            WFP, OCHA, HfH, Good Neighbors donörlerini ve örnek görevleri sisteme yükler.
            Mevcut verilerinizin üzerine <em>ekleme</em> yapılır.
          </p>
          {seedResult && (
            <div style={{
              padding:'10px 14px', borderRadius:8, marginBottom:12, fontSize:13,
              background: seedResult.ok ? 'var(--green-pale)' : 'var(--red-pale)',
              color: seedResult.ok ? 'var(--green)' : 'var(--red)',
              border: `1px solid ${seedResult.ok ? 'var(--green)' : 'var(--red)'}22`
            }}>
              {seedResult.msg}
            </div>
          )}
          <button className="btn btn-primary" onClick={handleSeedData} disabled={seedLoading || !supabaseConnected}
            style={{width:'100%'}}>
            {seedLoading ? '⏳ Yükleniyor...' : '🌱 Demo Verisini Yükle'}
          </button>
          {!supabaseConnected && (
            <p style={{fontSize:11.5,color:'var(--orange)',marginTop:8,textAlign:'center'}}>
              Supabase bağlantısı gerekiyor
            </p>
          )}
        </div>

        {/* TEHLİKELİ BÖLGE */}
        <div className="card" style={{border:'1px solid var(--red-pale)'}}>
          <div className="card-title" style={{color:'var(--red)'}}>⚠️ Veri Temizleme</div>
          <p style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.6,marginBottom:16}}>
            Belirli tabloları temizleyin. Silinen veriler <strong>geri alınamaz</strong>.
          </p>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {DATA_TABLES.map(({ key, label, count }) => (
              <div key={key} style={{
                display:'flex',alignItems:'center',justifyContent:'space-between',
                padding:'10px 12px', borderRadius:8, background:'var(--surface)', border:'1px solid var(--border)'
              }}>
                <div>
                  <span style={{fontSize:13,fontWeight:500}}>{label}</span>
                  <span style={{fontSize:11.5,color:'var(--text-muted)',marginLeft:8}}>
                    ({count ?? '—'} kayıt)
                  </span>
                </div>
                <button
                  className="btn btn-sm"
                  style={{background:'var(--red-pale)',color:'var(--red)',border:'1px solid var(--red)22'}}
                  onClick={() => handleClearTable(key, label)}
                  disabled={clearLoading === key}
                >
                  {clearLoading === key ? '⏳' : '🗑 Temizle'}
                </button>
              </div>
            ))}
            <div style={{
              display:'flex',alignItems:'center',justifyContent:'space-between',
              padding:'10px 12px', borderRadius:8, background:'var(--surface)', border:'1px solid var(--border)'
            }}>
              <div>
                <span style={{fontSize:13,fontWeight:500}}>AI Sohbet Geçmişi</span>
                <span style={{fontSize:11.5,color:'var(--text-muted)',marginLeft:8}}>
                  ({stats?.chatMessages ?? '—'} mesaj)
                </span>
              </div>
              <button
                className="btn btn-sm"
                style={{background:'var(--red-pale)',color:'var(--red)',border:'1px solid var(--red)22'}}
                onClick={handleClearChat}
                disabled={clearLoading === 'chat'}
              >
                {clearLoading === 'chat' ? '⏳' : '🗑 Temizle'}
              </button>
            </div>
          </div>
        </div>

        {/* HIZLI NAVİGASYON */}
        <div className="card" style={{gridColumn:'1/3'}}>
          <div className="card-title">⚡ Hızlı Navigasyon</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:10}}>
            {[
              { page:'dashboard', icon:'⚡', label:'Dashboard' },
              { page:'chat', icon:'🤖', label:'AI Asistan' },
              { page:'deadlines', icon:'📅', label:'Görevler' },
              { page:'donors', icon:'🤝', label:'Donör CRM' },
              { page:'meetings', icon:'📋', label:'Toplantılar' },
              { page:'reports', icon:'📊', label:'Birim Raporları' },
            ].map(({ page, icon, label }) => (
              <button key={page}
                onClick={() => onNavigate(page)}
                style={{
                  padding:'14px 8px', borderRadius:10, cursor:'pointer',
                  border:'1px solid var(--border)', background:'var(--surface)',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:6,
                  transition:'all 0.15s', fontFamily:'var(--font-body)'
                }}
                onMouseEnter={e => { e.currentTarget.style.background='var(--navy)'; e.currentTarget.style.color='white'; }}
                onMouseLeave={e => { e.currentTarget.style.background='var(--surface)'; e.currentTarget.style.color='inherit'; }}
              >
                <span style={{fontSize:22}}>{icon}</span>
                <span style={{fontSize:11.5,fontWeight:500}}>{label}</span>
              </button>
            ))}
          </div>
        </div>

      </div>}

    </div>
  );
}
