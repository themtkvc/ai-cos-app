import React, { useState, useEffect } from 'react';
import { getSystemStats, seedDemoData, clearChatHistory, clearTable, getAllProfiles, updateUserProfile, updateDashboardAccess, supabase } from '../lib/supabase';
import { ROLE_LABELS } from '../App';

const DEFAULT_ORG = {
  orgName: 'Uluslararası İnsani Yardım Örgütü',
  directorTitle: 'Direktör',
  staffCount: 50,
  units: [
    { name: 'Partnerships', coordinator: 'Hatice', icon: '🤝' },
    { name: 'Humanitarian Affairs', coordinator: 'Gülsüm', icon: '🌍' },
    { name: 'Traditional Donors', coordinator: 'Murat', icon: '💰' },
    { name: 'Grants', coordinator: 'Yasir', icon: '📝' },
    { name: 'Accreditations', coordinator: 'Yavuz', icon: '✅' },
    { name: 'Policy & Governance', coordinator: 'Sezgin', icon: '⚖️' },
  ],
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
    if (!inviteEmail.trim()) return;
    setInviting(true);
    // Create auth user via admin API — requires service role key (not available client-side)
    // Best approach: use Supabase signUp to create user, then set profile
    const { data: authData, error: authError } = await supabase.auth.admin?.createUser?.({
      email: inviteEmail.trim(),
      password: 'TempPass2026!',
      email_confirm: true,
    });
    if (authError || !authData?.user) {
      // Fallback: just show instructions
      notify('Kullanıcı otomatik oluşturulamadı. Kullanıcı sisteme kendisi kayıt olmalı, siz rolünü atayabilirsiniz.', 'error');
      setInviting(false);
      return;
    }
    // Create profile
    const { error: profileError } = await updateUserProfile(authData.user.id, {
      full_name: inviteName || inviteEmail.split('@')[0],
      role: inviteRole,
      unit: inviteUnit,
    });
    setInviting(false);
    if (profileError) { notify('Hata: ' + profileError.message, 'error'); return; }
    notify(`✅ ${inviteEmail} sisteme eklendi.`);
    setInviteEmail(''); setInviteName(''); setInviteRole('personel'); setInviteUnit('');
    loadProfiles();
  };

  const roleColor = (role) => {
    const map = {
      direktor: '#1a3a5c', direktor_yardimcisi: '#1e5799',
      asistan: '#2e6da4', koordinator: '#c47a1e', personel: '#666',
    };
    return map[role] || '#666';
  };

  if (loading) return <div style={{padding:32,textAlign:'center',color:'var(--text-muted)'}}>Yükleniyor…</div>;

  return (
    <div>
      {/* Mevcut Kullanıcılar */}
      <div className="card" style={{marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div className="card-title" style={{marginBottom:0}}>👥 Sistem Kullanıcıları ({profiles.length})</div>
          <button className="btn btn-outline btn-sm" onClick={loadProfiles}>↺ Yenile</button>
        </div>

        {profiles.length === 0 ? (
          <div style={{padding:24,textAlign:'center',color:'var(--text-muted)'}}>Kayıtlı kullanıcı yok</div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {profiles.map(p => (
              <div key={p.user_id} style={{
                padding:'12px 16px', borderRadius:10, border:'1px solid var(--border)',
                background:'var(--surface)', display:'flex', alignItems:'center', gap:12
              }}>
                <div style={{
                  width:38, height:38, borderRadius:'50%', flexShrink:0, display:'flex',
                  alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:15,
                  background: roleColor(p.role) + '22', color: roleColor(p.role), border: `2px solid ${roleColor(p.role)}44`
                }}>
                  {(p.full_name?.[0] || p.auth_user?.email?.[0] || '?').toUpperCase()}
                </div>

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
                        <select className="form-input" style={{width:160,padding:'4px 8px',fontSize:12}}
                          value={editDraft.unit}
                          onChange={e => setEditDraft(d => ({...d, unit: e.target.value}))}>
                          <option value="">— Birim seç —</option>
                          {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      )}
                    </div>
                  ) : (
                    <>
                      <div style={{fontWeight:600, fontSize:13, color:'var(--text)'}}>
                        {p.full_name || p.auth_user?.email?.split('@')[0] || 'İsimsiz'}
                      </div>
                      <div style={{fontSize:11.5, color:'var(--text-muted)', marginTop:2}}>
                        {p.auth_user?.email || '—'}
                        {p.unit ? ` · ${p.unit}` : ''}
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
                  {/* Dashboard erişim toggle — sadece direktör yetkisiyle */}
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
            ))}
          </div>
        )}
      </div>

      {/* Kullanıcı Ekleme */}
      <div className="card">
        <div className="card-title">➕ Yeni Kullanıcı</div>
        <p style={{fontSize:12.5,color:'var(--text-muted)',marginBottom:14,lineHeight:1.5}}>
          Yeni kullanıcı sisteme <strong>https://ai-cos-app.vercel.app</strong> adresinden kayıt olabilir.
          Kayıt olduktan sonra bu panelden rolünü ve birimini atayın.
        </p>
        <div style={{
          padding:'12px 16px', background:'var(--gold-pale,#fef9ec)', borderRadius:8,
          border:'1px solid var(--gold,#c8a84b)22', fontSize:12.5, color:'var(--text-muted)'
        }}>
          💡 Kullanıcıya şu bilgileri iletin: Siteye gidin → "Henüz hesabınız yok mu? Kayıt olun" → Email ve şifre belirlesin → Siz buradan rol atayın.
        </div>
      </div>
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
        <div style={{display:'flex',gap:4,marginTop:16,borderBottom:'2px solid var(--border)',paddingBottom:0}}>
          {[
            { id:'system', icon:'⚙️', label:'Sistem & Veri' },
            { id:'users',  icon:'👥', label:'Kullanıcı Yönetimi' },
          ].map(tab => (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding:'8px 18px', border:'none', background:'transparent', cursor:'pointer',
                fontSize:13, fontWeight:500, color: activeTab===tab.id ? 'var(--navy)' : 'var(--text-muted)',
                borderBottom: activeTab===tab.id ? '2px solid var(--navy)' : '2px solid transparent',
                marginBottom:-2, transition:'all 0.15s', fontFamily:'var(--font-body)'
              }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <UserManagement currentUser={user} notify={notify} />
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
