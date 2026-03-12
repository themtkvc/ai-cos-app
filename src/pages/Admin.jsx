import React, { useState, useEffect } from 'react';
import { getSystemStats, seedDemoData, clearChatHistory, clearTable } from '../lib/supabase';

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

export default function Admin({ user, onNavigate }) {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [orgConfig, setOrgConfig] = useState(loadOrgConfig);
  const [editingOrg, setEditingOrg] = useState(false);
  const [orgDraft, setOrgDraft] = useState(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedResult, setSeedResult] = useState(null);
  const [clearLoading, setClearLoading] = useState('');
  const [notification, setNotification] = useState(null);

  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const claudeApiKey = process.env.REACT_APP_CLAUDE_API_KEY;

  const supabaseConnected = supabaseUrl && supabaseUrl !== 'https://placeholder.supabase.co';
  const claudeConnected = claudeApiKey && claudeApiKey !== 'your-claude-api-key-here';

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
            <p className="page-subtitle">Sistem yönetimi · Organizasyon yapısı · Veri işlemleri</p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => onNavigate('dashboard')}>← Dashboard</button>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>

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

      </div>
    </div>
  );
}
