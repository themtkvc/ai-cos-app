import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  getNetworkAll,
  createNetworkOrg,    updateNetworkOrg,    deleteNetworkOrg,
  createNetworkContact, updateNetworkContact, deleteNetworkContact,
  createNetworkEvent,   updateNetworkEvent,   deleteNetworkEvent,
  createNetworkConnection, deleteNetworkConnection,
  uploadNetworkMedia,
  getContactComms, createContactComm, deleteContactComm,
  getAllProfiles,
} from '../lib/supabase';
import { ROLE_LABELS, avatarColor, fmtDisplayDate } from '../lib/constants';

// ── SABİTLER ─────────────────────────────────────────────────────────────────
const ORG_TYPES = [
  { value: 'ngo',        label: 'STK / NGO' },
  { value: 'donor',      label: 'Donör' },
  { value: 'government', label: 'Kamu / Hükümet' },
  { value: 'un_agency',  label: 'BM Ajansı' },
  { value: 'private',    label: 'Özel Sektör' },
  { value: 'academic',   label: 'Akademik' },
  { value: 'media',      label: 'Medya' },
  { value: 'other',      label: 'Diğer' },
];
const EVENT_TYPES = [
  { value: 'conference', label: 'Konferans' },
  { value: 'meeting',    label: 'Toplantı' },
  { value: 'workshop',   label: 'Workshop' },
  { value: 'training',   label: 'Eğitim' },
  { value: 'forum',      label: 'Forum' },
  { value: 'visit',      label: 'Ziyaret' },
  { value: 'other',      label: 'Diğer' },
];
const CONNECTION_LABELS = [
  'Çalışıyor',   'Katıldı',   'Burada tanıştık',  'Konuşmacı',
  'Organizatör', 'Sponsor',   'Partner',           'Donör',
  'Danışman',    'Üye',       'İletişim',          'Diğer',
];
// fmtDate → fmtDisplayDate (constants.js'den import edildi)
const fmtDate = fmtDisplayDate;

// ── YENİ KİŞİ KARTI SABİTLERİ ──────────────────────────────────────────────────
const COUNTRIES = [
  { value:'Türkiye',    flag:'🇹🇷' }, { value:'ABD',        flag:'🇺🇸' },
  { value:'Almanya',    flag:'🇩🇪' }, { value:'İngiltere',  flag:'🇬🇧' },
  { value:'Fransa',     flag:'🇫🇷' }, { value:'Hollanda',   flag:'🇳🇱' },
  { value:'İsviçre',    flag:'🇨🇭' }, { value:'Belçika',    flag:'🇧🇪' },
  { value:'İsveç',      flag:'🇸🇪' }, { value:'Norveç',     flag:'🇳🇴' },
  { value:'Kanada',     flag:'🇨🇦' }, { value:'Japonya',    flag:'🇯🇵' },
  { value:'Avustralya', flag:'🇦🇺' }, { value:'İtalya',     flag:'🇮🇹' },
];
const getFlag = (c) => COUNTRIES.find(x=>x.value===c)?.flag || '🌍';

const PROCESS_STAGES = [
  { value:'İlk Temas',            color:'#9ca3af', icon:'📞' },
  { value:'İletişim Geliştirme',  color:'#3b82f6', icon:'💬' },
  { value:'İşbirliği Görüşmesi',  color:'#f59e0b', icon:'🤝' },
  { value:'Aktif İşbirliği',      color:'#10b981', icon:'✅' },
  { value:'Pasif / Beklemede',    color:'#6b7280', icon:'⏸️' },
];

const COMPLIANCE_STATUSES = [
  { value:'Değerlendirilmedi', color:'#9ca3af' },
  { value:'Uyum Sürecinde',   color:'#f59e0b' },
  { value:'Uyum Sağlandı',    color:'#10b981' },
  { value:'Uyum Reddedildi',  color:'#ef4444' },
];

const PRIORITY_OPTIONS = [
  { value:'Kritik',  emoji:'🔴', color:'#ef4444' },
  { value:'Yüksek',  emoji:'🟠', color:'#f97316' },
  { value:'Orta',    emoji:'🟡', color:'#eab308' },
  { value:'Düşük',   emoji:'🟢', color:'#22c55e' },
];

const CATEGORY_OPTIONS = [
  'Eğitim & Kapasite Geliştirme',
  'Donör',
  'Network',
  'Araştırma & Akademik',
  'Savunuculuk & Politika',
  'Operasyonel Partner',
];

// ── KÜÇÜK YARDIMCI BİLEŞENLER ────────────────────────────────────────────────
function Avatar({ name='', url, size=40, radius='50%' }) {
  const [err, setErr] = useState(false);
  const color = avatarColor(name);
  const init  = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || '?';
  if (url && !err) return (
    <img src={url} alt={name} onError={()=>setErr(true)}
      style={{ width:size, height:size, borderRadius:radius, objectFit:'cover', flexShrink:0 }} />
  );
  return (
    <div style={{
      width:size, height:size, borderRadius:radius, flexShrink:0,
      background:color, color:'white', fontWeight:700, fontSize:size*0.35,
      display:'flex', alignItems:'center', justifyContent:'center', userSelect:'none',
    }}>{init}</div>
  );
}

function Tag({ label, onRemove }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding:'2px 10px', borderRadius:20,
      background:'rgba(26,58,92,0.08)', color:'#1a3a5c',
      fontSize:12, fontWeight:600,
    }}>
      {label}
      {onRemove && <button onClick={onRemove} style={{
        border:'none', background:'none', cursor:'pointer', color:'#9ca3af',
        fontSize:13, padding:0, lineHeight:1, marginTop:1,
      }}>×</button>}
    </span>
  );
}

function TypeBadge({ value, types }) {
  const t = types?.find(x=>x.value===value);
  return t ? (
    <span style={{
      display:'inline-block', padding:'2px 9px', borderRadius:6,
      border:'1px solid #e5e7eb', background:'white',
      fontSize:11.5, fontWeight:600, color:'#374151',
    }}>{t.label}</span>
  ) : null;
}

function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ textAlign:'center', padding:'64px 24px', color:'#9ca3af' }}>
      <div style={{ fontSize:44, marginBottom:14 }}>{icon}</div>
      <div style={{ fontSize:15, fontWeight:700, color:'#374151', marginBottom:6 }}>{title}</div>
      <div style={{ fontSize:13 }}>{sub}</div>
    </div>
  );
}

// ── GÖRSEL HUB BİLEŞENİ (dairesel ağ) ────────────────────────────────────────
function HubView({ center, nodes }) {
  if (!nodes.length) return (
    <div style={{ textAlign:'center', padding:'32px', color:'#9ca3af', fontSize:13 }}>
      Henüz bağlantı yok.
    </div>
  );

  const R = Math.min(200, 80 + nodes.length * 22);
  const W = R * 2 + 180;
  const H = R * 2 + 180;
  const cx = W / 2;
  const cy = H / 2;

  return (
    <div style={{ overflowX:'auto', padding:'16px 0' }}>
      <svg width={W} height={H} style={{ display:'block', margin:'0 auto' }}>
        {/* Bağlantı çizgileri */}
        {nodes.map((n, i) => {
          const angle = (2 * Math.PI * i / nodes.length) - Math.PI / 2;
          const nx = cx + R * Math.cos(angle);
          const ny = cy + R * Math.sin(angle);
          return (
            <line key={i} x1={cx} y1={cy} x2={nx} y2={ny}
              stroke="#e5e7eb" strokeWidth={1.5} strokeDasharray="4 3" />
          );
        })}

        {/* Merkez düğüm */}
        <foreignObject x={cx-36} y={cy-36} width={72} height={72}>
          <div style={{
            width:72, height:72, borderRadius:'50%',
            background: center.color || '#1a3a5c',
            display:'flex', alignItems:'center', justifyContent:'center',
            border:'3px solid white', boxShadow:'0 4px 12px rgba(0,0,0,0.2)',
            overflow:'hidden',
          }}>
            {center.imageUrl ? (
              <img src={center.imageUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            ) : (
              <span style={{ fontSize:22, color:'white', fontWeight:700 }}>
                {center.name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
              </span>
            )}
          </div>
        </foreignObject>
        <text x={cx} y={cy+52} textAnchor="middle" style={{ fontSize:11, fill:'#374151', fontWeight:600 }}>
          {center.name?.length > 16 ? center.name.slice(0,14)+'…' : center.name}
        </text>

        {/* Çevre düğümler */}
        {nodes.map((n, i) => {
          const angle = (2 * Math.PI * i / nodes.length) - Math.PI / 2;
          const nx = cx + R * Math.cos(angle);
          const ny = cy + R * Math.sin(angle);
          const nodeColor = avatarColor(n.name);
          return (
            <g key={i}>
              <foreignObject x={nx-24} y={ny-24} width={48} height={48}>
                <div style={{
                  width:48, height:48, borderRadius:'50%',
                  background: n.imageUrl ? 'transparent' : nodeColor,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  border:'2px solid white', boxShadow:'0 2px 8px rgba(0,0,0,0.12)',
                  overflow:'hidden',
                }}>
                  {n.imageUrl ? (
                    <img src={n.imageUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  ) : (
                    <span style={{ fontSize:13, color:'white', fontWeight:700 }}>
                      {n.name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                    </span>
                  )}
                </div>
              </foreignObject>
              <text x={nx} y={ny+34} textAnchor="middle" style={{ fontSize:10, fill:'#6b7280' }}>
                {n.name?.length > 14 ? n.name.slice(0,12)+'…' : n.name}
              </text>
              {n.label && (
                <text x={nx} y={ny+45} textAnchor="middle" style={{ fontSize:9, fill:'#9ca3af' }}>
                  {n.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── DETAY PANEL (slide-over) ──────────────────────────────────────────────────
function DetailPanel({ item, type, orgs, contacts, events, connections, onClose, onEdit, onDelete, onAddConnection, onRemoveConnection, allProfiles, user }) {
  // ── İletişim Geçmişi state ──
  const [comms, setComms] = useState([]);
  const [commsLoading, setCommsLoading] = useState(false);
  const [showCommForm, setShowCommForm] = useState(false);
  const [commDate, setCommDate] = useState(new Date().toISOString().slice(0,10));
  const [commDesc, setCommDesc] = useState('');
  const [commSaving, setCommSaving] = useState(false);
  const [detailTab, setDetailTab] = useState('info'); // 'info' | 'comms'

  useEffect(() => {
    if (type === 'contact' && item?.id) {
      setCommsLoading(true);
      getContactComms(item.id).then(({ data }) => {
        setComms(data || []);
        setCommsLoading(false);
      });
    }
  }, [type, item?.id]);

  const saveComm = async () => {
    if (!commDesc.trim()) return;
    setCommSaving(true);
    const { data } = await createContactComm({ contact_id: item.id, comm_date: commDate, description: commDesc.trim() });
    if (data) setComms(prev => [data, ...prev]);
    setCommDesc(''); setShowCommForm(false); setCommSaving(false);
  };

  const removeComm = async (id) => {
    await deleteContactComm(id);
    setComms(prev => prev.filter(c => c.id !== id));
  };
  if (!item) return null;

  const contactOrg = type==='contact' && item.organization_id
    ? orgs.find(o=>o.id===item.organization_id) : null;

  const myConnections = connections.filter(c =>
    (c.source_type === type && c.source_id === item.id) ||
    (c.target_type === type && c.target_id === item.id)
  );

  // Hub verisini oluştur
  const hubNodes = myConnections.map(c => {
    const isSource = c.source_type === type && c.source_id === item.id;
    const otherType = isSource ? c.target_type : c.source_type;
    const otherId   = isSource ? c.target_id   : c.source_id;
    const pool = otherType === 'contact' ? contacts : otherType === 'organization' ? orgs : events;
    const found = pool.find(x => x.id === otherId);
    if (!found) return null;
    return {
      name:     found.full_name || found.name,
      imageUrl: found.avatar_url || found.logo_url || found.cover_url || null,
      label:    c.label || '',
      connId:   c.id,
      entityType: otherType,
      entity:   found,
    };
  }).filter(Boolean);

  const centerColor = type === 'contact' ? avatarColor(item.full_name || item.name)
    : type === 'organization' ? '#1a3a5c' : '#7c3aed';

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:999,
      }} />
      {/* Panel */}
      <div style={{
        position:'fixed', right:0, top:0, bottom:0, width:'min(520px, 100vw)',
        background:'white', zIndex:1000, overflowY:'auto',
        boxShadow:'-4px 0 24px rgba(0,0,0,0.12)',
        display:'flex', flexDirection:'column',
      }}>
        {/* Başlık */}
        <div style={{ padding:'20px 24px', borderBottom:'1px solid #f3f4f6', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <Avatar
                name={item.full_name || item.name || ''}
                url={item.avatar_url || item.logo_url || item.cover_url}
                size={52}
                radius={type === 'organization' ? '10px' : '50%'}
              />
              <div>
                <h2 style={{ margin:0, fontSize:18, fontWeight:800, color:'#111827' }}>
                  {item.full_name || item.name}
                </h2>
                {type === 'contact' && item.position && (
                  <div style={{ fontSize:13, color:'#6b7280', marginTop:3 }}>{item.position}</div>
                )}
                {type === 'contact' && contactOrg && (
                  <div style={{ fontSize:12.5, color:'#9ca3af', marginTop:2 }}>
                    🏢 {contactOrg.name}
                  </div>
                )}
                {type === 'organization' && (
                  <TypeBadge value={item.org_type} types={ORG_TYPES} />
                )}
                {type === 'event' && (
                  <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:4 }}>
                    <TypeBadge value={item.event_type} types={EVENT_TYPES} />
                    {item.event_date && <span style={{ fontSize:12, color:'#9ca3af' }}>📅 {fmtDate(item.event_date)}</span>}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display:'flex', gap:8, flexShrink:0 }}>
              <button onClick={onEdit} style={{
                padding:'7px 14px', borderRadius:8,
                border:'1.5px solid #e5e7eb', background:'white',
                fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', color:'#374151',
              }}>✏️ Düzenle</button>
              <button onClick={onClose} style={{
                padding:'7px 12px', borderRadius:8,
                border:'1.5px solid #e5e7eb', background:'white',
                fontSize:16, cursor:'pointer', color:'#9ca3af',
              }}>✕</button>
            </div>
          </div>
        </div>

        {/* İçerik */}
        <div style={{ padding:'20px 24px', flex:1 }}>

          {/* ── SEKME BAR (sadece kişi için) ── */}
          {type === 'contact' && (
            <div style={{ display:'flex', gap:4, background:'#f3f4f6', borderRadius:10, padding:3, marginBottom:20 }}>
              {[
                { id:'info', label:'ℹ️ Bilgiler' },
                { id:'comms', label:`💬 İletişim Geçmişi (${comms.length})` },
              ].map(t=>(
                <button key={t.id} onClick={()=>setDetailTab(t.id)} style={{
                  flex:1, padding:'8px 12px', borderRadius:8, border:'none', cursor:'pointer',
                  background: detailTab===t.id ? '#111827' : 'transparent',
                  color: detailTab===t.id ? 'white' : '#6b7280',
                  fontWeight:700, fontSize:12.5, fontFamily:'inherit',
                }}>{t.label}</button>
              ))}
            </div>
          )}

          {/* ═══ İLETİŞİM GEÇMİŞİ SEKMESİ ═══ */}
          {type === 'contact' && detailTab === 'comms' && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#111827' }}>İletişim Geçmişi</div>
                <button onClick={()=>setShowCommForm(v=>!v)} style={{
                  padding:'6px 14px', borderRadius:8, border:'1.5px solid #e5e7eb', background:'white',
                  cursor:'pointer', fontSize:12, fontWeight:700, color:'#374151', fontFamily:'inherit',
                }}>{showCommForm ? '✕ İptal' : '+ Kayıt Ekle'}</button>
              </div>

              {showCommForm && (
                <div style={{ padding:14, borderRadius:10, background:'#f8faff', border:'1.5px solid #bfdbfe', marginBottom:16 }}>
                  <div style={{ display:'flex', gap:10, marginBottom:10 }}>
                    <input type="date" value={commDate} onChange={e=>setCommDate(e.target.value)}
                      style={{ padding:'8px 10px', borderRadius:8, border:'1.5px solid #bfdbfe', fontSize:13, fontFamily:'inherit', outline:'none', background:'white' }} />
                    <input value={commDesc} onChange={e=>setCommDesc(e.target.value)}
                      placeholder="Açıklama (ör: 2026 raporu gönderme)"
                      onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); saveComm(); }}}
                      style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'1.5px solid #bfdbfe', fontSize:13, fontFamily:'inherit', outline:'none', background:'white' }} />
                  </div>
                  <button onClick={saveComm} disabled={!commDesc.trim()||commSaving}
                    style={{
                      padding:'7px 18px', borderRadius:8, border:'none',
                      background: !commDesc.trim()||commSaving ? '#93c5fd' : '#2563eb',
                      color:'white', cursor: !commDesc.trim()||commSaving ? 'not-allowed' : 'pointer',
                      fontSize:12.5, fontWeight:700, fontFamily:'inherit',
                    }}>{commSaving ? '⏳' : '✓ Kaydet'}</button>
                </div>
              )}

              {commsLoading ? (
                <div style={{ textAlign:'center', padding:20, color:'#9ca3af', fontSize:13 }}>Yükleniyor…</div>
              ) : comms.length === 0 ? (
                <div style={{ textAlign:'center', padding:'32px 16px', color:'#9ca3af' }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>💬</div>
                  <div style={{ fontSize:13, fontWeight:600 }}>Henüz iletişim kaydı yok</div>
                  <div style={{ fontSize:12, marginTop:4 }}>Yukarıdaki "Kayıt Ekle" butonu ile başlayın</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {comms.map(c=>(
                    <div key={c.id} style={{
                      display:'flex', alignItems:'flex-start', gap:12, padding:'12px 14px',
                      background:'white', borderRadius:10, border:'1px solid #f3f4f6',
                    }}>
                      <div style={{
                        width:42, height:42, borderRadius:10, flexShrink:0,
                        background:'#eff6ff', display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:11, fontWeight:700, color:'#2563eb', lineHeight:1.2, textAlign:'center',
                      }}>
                        {new Date(c.comm_date).toLocaleDateString('tr-TR',{day:'2-digit',month:'short'}).replace(' ','\n')}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'#111827' }}>{c.description}</div>
                        <div style={{ fontSize:11, color:'#9ca3af', marginTop:3 }}>
                          {new Date(c.comm_date).toLocaleDateString('tr-TR',{day:'2-digit',month:'long',year:'numeric'})}
                        </div>
                      </div>
                      <button onClick={()=>removeComm(c.id)} title="Sil" style={{
                        border:'none', background:'none', cursor:'pointer', color:'#d1d5db', fontSize:16, padding:'2px 4px',
                      }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ BİLGİLER SEKMESİ ═══ */}
          {(type !== 'contact' || detailTab === 'info') && (<>

          {/* Bilgi grid */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 20px', marginBottom:20 }}>
            {item.email   && <InfoRow icon="📧" label="E-posta"  val={item.email} href={`mailto:${item.email}`} />}
            {item.phone   && <InfoRow icon="📞" label="Telefon"  val={item.phone} />}
            {item.website && <InfoRow icon="🌐" label="Website"  val={item.website} href={item.website} />}
            {item.linkedin && <InfoRow icon="🔗" label="LinkedIn" val="Profil" href={item.linkedin} />}
            {item.address && <InfoRow icon="📍" label="Adres"    val={item.address} />}
            {item.location && <InfoRow icon="📍" label="Konum"   val={item.location} />}
            {type==='contact' && item.country && <InfoRow icon={getFlag(item.country)} label="Ülke" val={item.country} />}
            {type==='contact' && item.first_contact_date && <InfoRow icon="📅" label="İlk İletişim" val={fmtDate(item.first_contact_date)} />}
            {type==='contact' && item.assigned_to_name && <InfoRow icon="👤" label="Takip Sorumlusu" val={item.assigned_to_name} />}
            {type==='contact' && item.referral_info && <InfoRow icon="🔀" label="Aracı Bilgisi" val={item.referral_info} />}
          </div>

          {/* Kişi kart badge'leri */}
          {type === 'contact' && (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
              {item.process_stage && (() => {
                const ps = PROCESS_STAGES.find(s=>s.value===item.process_stage);
                return ps ? (
                  <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:20,
                    background:ps.color+'18', color:ps.color, fontSize:11.5, fontWeight:700 }}>
                    {ps.icon} {ps.value}
                  </span>
                ) : null;
              })()}
              {item.compliance_status && item.compliance_status !== 'Değerlendirilmedi' && (() => {
                const cs = COMPLIANCE_STATUSES.find(s=>s.value===item.compliance_status);
                return cs ? (
                  <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:20,
                    background:cs.color+'18', color:cs.color, fontSize:11.5, fontWeight:700 }}>
                    {item.compliance_status}
                  </span>
                ) : null;
              })()}
              {item.priority && item.priority !== 'Orta' && (() => {
                const pr = PRIORITY_OPTIONS.find(p=>p.value===item.priority);
                return pr ? (
                  <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'3px 10px', borderRadius:20,
                    background:pr.color+'18', color:pr.color, fontSize:11.5, fontWeight:700 }}>
                    {pr.emoji} {pr.value}
                  </span>
                ) : null;
              })()}
            </div>
          )}

          {/* Kategoriler */}
          {type === 'contact' && item.categories?.length > 0 && (
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
              {item.categories.map(cat=>(
                <span key={cat} style={{
                  display:'inline-block', padding:'3px 10px', borderRadius:6,
                  background:'#f3f4f6', fontSize:11.5, fontWeight:600, color:'#374151',
                }}>📁 {cat}</span>
              ))}
            </div>
          )}

          {/* Sistem Plus butonu */}
          {type === 'contact' && item.system_plus_url && (
            <div style={{ marginBottom:16 }}>
              <a href={item.system_plus_url} target="_blank" rel="noreferrer" style={{
                display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px',
                borderRadius:8, background:'#eff6ff', border:'1.5px solid #bfdbfe',
                color:'#1d4ed8', fontSize:12.5, fontWeight:700, textDecoration:'none',
              }}>🔗 Sistem Plus'ta Aç</a>
            </div>
          )}

          {/* Drive Linki (etkinlik) */}
          {type === 'event' && item.drive_url && (
            <div style={{ marginBottom:16 }}>
              <a href={item.drive_url} target="_blank" rel="noreferrer" style={{
                display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px',
                borderRadius:8, background:'#fef9c3', border:'1.5px solid #fde047',
                color:'#854d0e', fontSize:12.5, fontWeight:700, textDecoration:'none',
              }}>📁 Drive Klasörünü Aç</a>
            </div>
          )}

          {(item.description || item.notes) && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11.5, fontWeight:700, color:'#9ca3af', letterSpacing:'0.05em', marginBottom:6, textTransform:'uppercase' }}>
                Notlar
              </div>
              <div style={{ fontSize:13.5, color:'#374151', lineHeight:1.6, padding:'12px', background:'#f9fafb', borderRadius:8 }}>
                {item.description || item.notes}
              </div>
            </div>
          )}

          {item.tags?.length > 0 && (
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:20 }}>
              {item.tags.map(t => <Tag key={t} label={t} />)}
            </div>
          )}

          {/* Ağ Haritası */}
          <div style={{ marginBottom:8 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#111827', marginBottom:4 }}>
              🕸 Ağ Haritası <span style={{ fontWeight:400, color:'#9ca3af', fontSize:12 }}>({hubNodes.length} bağlantı)</span>
            </div>
            <div style={{ background:'#f9fafb', borderRadius:12, border:'1px solid #f3f4f6' }}>
              <HubView
                center={{ name: item.full_name || item.name, imageUrl: item.avatar_url || item.logo_url, color: centerColor }}
                nodes={hubNodes}
              />
            </div>
          </div>

          {/* Bağlantı listesi */}
          {myConnections.length > 0 && (
            <div style={{ marginTop:16 }}>
              <div style={{ fontSize:11.5, fontWeight:700, color:'#9ca3af', letterSpacing:'0.05em', marginBottom:8, textTransform:'uppercase' }}>
                Bağlantılar
              </div>
              {hubNodes.map(n => (
                <div key={n.connId} style={{
                  display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
                  background:'white', border:'1px solid #f3f4f6', borderRadius:10, marginBottom:6,
                }}>
                  <Avatar name={n.name} url={n.imageUrl} size={34}
                    radius={n.entityType === 'organization' ? '7px' : '50%'} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#111827' }}>{n.name}</div>
                    {n.label && <div style={{ fontSize:12, color:'#9ca3af' }}>{n.label}</div>}
                  </div>
                  <span style={{
                    fontSize:11, padding:'2px 8px', borderRadius:20,
                    background:'#f3f4f6', color:'#6b7280', fontWeight:600,
                  }}>
                    {n.entityType === 'contact' ? '🧑 Kişi' : n.entityType === 'organization' ? '🏢 Kurum' : '📅 Etkinlik'}
                  </span>
                  <button onClick={() => onRemoveConnection(n.connId)} style={{
                    border:'none', background:'none', cursor:'pointer', color:'#e5e7eb',
                    fontSize:18, padding:'2px 4px', lineHeight:1,
                  }} title="Bağlantıyı kaldır">×</button>
                </div>
              ))}
            </div>
          )}

          {/* Bağlantı Ekle butonu */}
          <button onClick={onAddConnection} style={{
            width:'100%', marginTop:12, padding:'11px',
            borderRadius:10, border:'2px dashed #e5e7eb',
            background:'transparent', cursor:'pointer',
            fontSize:13, fontWeight:700, color:'#9ca3af',
            fontFamily:'inherit',
            transition:'all 0.15s',
          }}>
            {type === 'event' ? '+ Katılımcı / Kurum Ekle' : '+ Etkinliğe Bağla'}
          </button>

          </>)}
        </div>
      </div>
    </>
  );
}

function InfoRow({ icon, label, val, href }) {
  return (
    <div>
      <div style={{ fontSize:11, color:'#9ca3af', fontWeight:600, marginBottom:2 }}>{icon} {label}</div>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" style={{ fontSize:13, color:'#2563eb', fontWeight:500 }}>{val}</a>
      ) : (
        <div style={{ fontSize:13, color:'#374151' }}>{val}</div>
      )}
    </div>
  );
}

// ── FORM MODAL ────────────────────────────────────────────────────────────────
function FormModal({ type, initial, orgs: orgsProp, user, allProfiles, onSave, onClose }) {
  const isEdit   = !!initial?.id;
  const fileRef  = useRef();
  const [saving, setSaving] = useState(false);
  const [imgFile, setImgFile] = useState(null);
  const [imgPreview, setImgPreview] = useState(null);
  const [tagInput, setTagInput]   = useState('');
  const [error, setError]         = useState('');

  // Yerel kurum listesi — modal açıkken yeni oluşturulanlar da eklenir
  const [orgs, setOrgs]           = useState(orgsProp);
  const [showNewOrg, setShowNewOrg]   = useState(false);
  const [newOrgName, setNewOrgName]   = useState('');
  const [newOrgType, setNewOrgType]   = useState('ngo');
  const [creatingOrg, setCreatingOrg] = useState(false);

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    setCreatingOrg(true);
    const result = await createNetworkOrg({ name: newOrgName.trim(), org_type: newOrgType, unit: user?.unit });
    if (result.data) {
      const newOrg = result.data;
      setOrgs(prev => [...prev, newOrg].sort((a,b)=>a.name.localeCompare(b.name)));
      set('organization_id', newOrg.id);
      setShowNewOrg(false);
      setNewOrgName('');
    }
    setCreatingOrg(false);
  };

  const defaultForm = () => {
    if (type === 'contact') return {
      full_name:'', position:'', email:'', phone:'', linkedin:'', notes:'',
      organization_id:'', tags:[], avatar_url:'',
      country:'', assigned_to:'', assigned_to_name:'', process_stage:'İlk Temas',
      compliance_status:'Değerlendirilmedi', priority:'Orta', categories:[],
      first_contact_date:'', referral_info:'', system_plus_url:'',
    };
    if (type === 'organization') return {
      name:'', org_type:'ngo', website:'', email:'', phone:'',
      address:'', description:'', logo_url:'', tags:[],
    };
    return {
      name:'', event_type:'conference', event_date:'', end_date:'',
      location:'', description:'', cover_url:'', tags:[], drive_url:'',
    };
  };
  const [form, setForm] = useState(initial ? {
    ...defaultForm(),
    ...initial,
    tags: initial.tags || [],
    organization_id: initial.organization_id || '',
    categories: Array.isArray(initial.categories) ? initial.categories : (initial.categories ? JSON.parse(initial.categories) : []),
  } : defaultForm());

  useEffect(() => {
    const url = type==='contact' ? initial?.avatar_url : type==='organization' ? initial?.logo_url : initial?.cover_url;
    setImgPreview(url || null);
  }, [initial, type]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      set('tags', [...(form.tags||[]), tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleImgChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImgFile(f);
    setImgPreview(URL.createObjectURL(f));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const name = form.full_name || form.name;
    if (!name?.trim()) { setError('İsim zorunlu'); return; }
    setSaving(true); setError('');

    // Nested nesneleri ve undefined FK'ları temizle
    let payload = { ...form };
    if (!payload.organization_id) delete payload.organization_id;
    if (!payload.assigned_to)     delete payload.assigned_to;
    if (!payload.event_date)      delete payload.event_date;
    if (!payload.end_date)        delete payload.end_date;
    if (!payload.first_contact_date) delete payload.first_contact_date;
    // Supabase join artıkları varsa sil
    delete payload.network_organizations;
    delete payload.network_contacts;
    delete payload.network_events;

    // Resim yükle
    if (imgFile && user) {
      const entityId = initial?.id || 'new_' + Date.now();
      const { data: url, error: imgErr } = await uploadNetworkMedia(user.id, type, entityId, imgFile);
      if (!imgErr && url) {
        const imgKey = type==='contact' ? 'avatar_url' : type==='organization' ? 'logo_url' : 'cover_url';
        payload[imgKey] = url;
      }
    }

    const result = await (isEdit
      ? (type==='contact' ? updateNetworkContact(initial.id, payload) : type==='organization' ? updateNetworkOrg(initial.id, payload) : updateNetworkEvent(initial.id, payload))
      : (type==='contact' ? createNetworkContact({ ...payload, unit: user?.unit }) : type==='organization' ? createNetworkOrg({ ...payload, unit: user?.unit }) : createNetworkEvent({ ...payload, unit: user?.unit })));

    if (result.error) { setError(result.error.message); setSaving(false); return; }
    onSave(result.data);
    setSaving(false);
  };

  const imgLabel  = type==='contact' ? 'Profil Fotoğrafı' : type==='organization' ? 'Logo' : 'Kapak Resmi';
  const imgRadius = type==='organization' ? 12 : '50%';

  const inp = (label, key, type_='text', placeholder='', required=false) => (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#6b7280', letterSpacing:'0.05em', marginBottom:5, textTransform:'uppercase' }}>
        {label}{required && <span style={{ color:'#ef4444' }}> *</span>}
      </label>
      <input type={type_} value={form[key]||''} onChange={e=>set(key,e.target.value)}
        placeholder={placeholder} required={required}
        style={{ width:'100%', boxSizing:'border-box', padding:'9px 12px', borderRadius:9,
          border:'1.5px solid #e5e7eb', fontSize:13.5, fontFamily:'inherit', color:'#111827', outline:'none' }} />
    </div>
  );

  const sel = (label, key, opts) => (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#6b7280', letterSpacing:'0.05em', marginBottom:5, textTransform:'uppercase' }}>{label}</label>
      <select value={form[key]||''} onChange={e=>set(key,e.target.value)}
        style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13.5, fontFamily:'inherit', background:'white', outline:'none' }}>
        <option value=''>Seçin…</option>
        {opts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  const title = isEdit ? 'Düzenle' : (type==='contact' ? 'Yeni Kişi' : type==='organization' ? 'Yeni Kurum' : 'Yeni Etkinlik');

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1100 }} />
      <div style={{
        position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
        width:'min(560px, 95vw)', maxHeight:'90vh', overflowY:'auto',
        background:'white', borderRadius:16, zIndex:1101,
        boxShadow:'0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ padding:'20px 24px', borderBottom:'1px solid #f3f4f6', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ margin:0, fontSize:17, fontWeight:800, color:'#111827' }}>{title}</h3>
          <button onClick={onClose} style={{ border:'none', background:'none', cursor:'pointer', fontSize:20, color:'#9ca3af' }}>✕</button>
        </div>
        <form onSubmit={handleSave} style={{ padding:'20px 24px' }}>
          {/* Resim yükleme */}
          <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
            <div style={{
              width:72, height:72, borderRadius:imgRadius,
              background:'#f3f4f6', overflow:'hidden', flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid #e5e7eb',
            }}>
              {imgPreview ? (
                <img src={imgPreview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              ) : (
                <span style={{ fontSize:28, color:'#d1d5db' }}>📷</span>
              )}
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleImgChange} />
              <button type="button" onClick={()=>fileRef.current?.click()} style={{
                padding:'8px 16px', borderRadius:8, border:'1.5px solid #e5e7eb',
                background:'white', cursor:'pointer', fontSize:13, fontWeight:600, color:'#374151', fontFamily:'inherit',
              }}>📁 {imgLabel} Seç</button>
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:5 }}>JPG, PNG, WebP · Maks 5 MB</div>
            </div>
          </div>

          {/* Tip seçimi */}
          {type === 'contact' && (
            <>
              {inp('Ad Soyad', 'full_name', 'text', 'Ad Soyad', true)}
              {inp('Pozisyon / Unvan', 'position', 'text', 'Örn: Program Müdürü')}
              <div style={{ marginBottom: showNewOrg ? 6 : 14 }}>
                <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#6b7280', letterSpacing:'0.05em', marginBottom:5, textTransform:'uppercase' }}>Kurum</label>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <select value={form.organization_id||''} onChange={e=>set('organization_id',e.target.value)}
                    style={{ flex:1, padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13.5, fontFamily:'inherit', background:'white', outline:'none' }}>
                    <option value=''>Kurum seçin (isteğe bağlı)</option>
                    {orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <button type="button" onClick={()=>setShowNewOrg(v=>!v)} title="Yeni kurum oluştur"
                    style={{
                      width:36, height:36, borderRadius:9, border:'1.5px solid #e5e7eb',
                      background: showNewOrg ? '#eff6ff' : 'white',
                      color: showNewOrg ? '#2563eb' : '#6b7280',
                      cursor:'pointer', fontSize:20, lineHeight:1,
                      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                    }}>
                    {showNewOrg ? '×' : '+'}
                  </button>
                </div>

                {/* Inline yeni kurum — form içinde form olmaz, div kullan */}
                {showNewOrg && (
                  <div style={{
                    marginTop:8, padding:'12px 14px', borderRadius:10,
                    background:'#f8faff', border:'1.5px solid #bfdbfe',
                  }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#1d4ed8', marginBottom:8 }}>
                      ➕ Yeni Kurum Oluştur
                    </div>
                    <input
                      value={newOrgName} onChange={e=>setNewOrgName(e.target.value)}
                      onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); handleCreateOrg(); }}}
                      placeholder="Kurum adı…" autoFocus
                      style={{ width:'100%', boxSizing:'border-box', padding:'8px 10px', borderRadius:8,
                        border:'1.5px solid #bfdbfe', fontSize:13, fontFamily:'inherit', outline:'none',
                        marginBottom:8, background:'white' }}
                    />
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <select value={newOrgType} onChange={e=>setNewOrgType(e.target.value)}
                        style={{ flex:1, padding:'7px 10px', borderRadius:8, border:'1.5px solid #bfdbfe',
                          fontSize:12.5, fontFamily:'inherit', background:'white', outline:'none' }}>
                        {ORG_TYPES.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <button type="button" onClick={handleCreateOrg} disabled={!newOrgName.trim()||creatingOrg}
                        style={{
                          padding:'7px 16px', borderRadius:8, border:'none',
                          background: !newOrgName.trim()||creatingOrg ? '#93c5fd' : '#2563eb',
                          color:'white', cursor: !newOrgName.trim()||creatingOrg ? 'not-allowed' : 'pointer',
                          fontSize:12.5, fontWeight:700, fontFamily:'inherit', whiteSpace:'nowrap',
                        }}>
                        {creatingOrg ? '⏳' : '✓ Oluştur'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {inp('E-posta', 'email', 'email', 'ornek@kurum.org')}
              {inp('Telefon', 'phone', 'tel', '+90 5xx xxx xx xx')}
              {inp('LinkedIn URL', 'linkedin', 'url', 'https://linkedin.com/in/...')}

              {/* ── YENİ ALANLAR ────────────────────────── */}
              <div style={{ borderTop:'1px solid #f3f4f6', marginTop:8, marginBottom:14, paddingTop:14 }}>
                <div style={{ fontSize:11.5, fontWeight:700, color:'#9ca3af', letterSpacing:'0.05em', marginBottom:10, textTransform:'uppercase' }}>
                  Detay Bilgileri
                </div>
              </div>

              {/* Ülke */}
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#6b7280', letterSpacing:'0.05em', marginBottom:5, textTransform:'uppercase' }}>Ülke</label>
                <div style={{ display:'flex', gap:8 }}>
                  <select value={COUNTRIES.find(c=>c.value===form.country) ? form.country : (form.country ? '__custom' : '')}
                    onChange={e=>{ if(e.target.value==='__custom') set('country',''); else set('country',e.target.value); }}
                    style={{ flex:1, padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13.5, fontFamily:'inherit', background:'white', outline:'none' }}>
                    <option value=''>Seçin…</option>
                    {COUNTRIES.map(c=><option key={c.value} value={c.value}>{c.flag} {c.value}</option>)}
                    <option value='__custom'>✏️ Diğer (serbest giriş)</option>
                  </select>
                  {(!COUNTRIES.find(c=>c.value===form.country) && form.country !== '') && (
                    <input value={form.country||''} onChange={e=>set('country',e.target.value)}
                      placeholder="Ülke adı yazın…"
                      style={{ flex:1, padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13.5, fontFamily:'inherit', outline:'none' }} />
                  )}
                </div>
              </div>

              {/* Takip Sorumlusu */}
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#6b7280', letterSpacing:'0.05em', marginBottom:5, textTransform:'uppercase' }}>Takip Sorumlusu</label>
                <select value={form.assigned_to||''} onChange={e=>{
                  const p = (allProfiles||[]).find(x=>x.id===e.target.value);
                  set('assigned_to', e.target.value || '');
                  set('assigned_to_name', p ? p.full_name : '');
                }}
                  style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13.5, fontFamily:'inherit', background:'white', outline:'none' }}>
                  <option value=''>Seçin…</option>
                  {(allProfiles||[]).map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>

              {/* Süreç Aşaması + Uyum Durumu */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#6b7280', letterSpacing:'0.05em', marginBottom:5, textTransform:'uppercase' }}>Süreç Aşaması</label>
                  <select value={form.process_stage||'İlk Temas'} onChange={e=>set('process_stage',e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13.5, fontFamily:'inherit', background:'white', outline:'none' }}>
                    {PROCESS_STAGES.map(s=><option key={s.value} value={s.value}>{s.icon} {s.value}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#6b7280', letterSpacing:'0.05em', marginBottom:5, textTransform:'uppercase' }}>Uyum Durumu</label>
                  <select value={form.compliance_status||'Değerlendirilmedi'} onChange={e=>set('compliance_status',e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13.5, fontFamily:'inherit', background:'white', outline:'none' }}>
                    {COMPLIANCE_STATUSES.map(s=><option key={s.value} value={s.value}>{s.value}</option>)}
                  </select>
                </div>
              </div>

              {/* Öncelik + İlk İletişim Tarihi */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#6b7280', letterSpacing:'0.05em', marginBottom:5, textTransform:'uppercase' }}>Öncelik Derecesi</label>
                  <select value={form.priority||'Orta'} onChange={e=>set('priority',e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13.5, fontFamily:'inherit', background:'white', outline:'none' }}>
                    {PRIORITY_OPTIONS.map(p=><option key={p.value} value={p.value}>{p.emoji} {p.value}</option>)}
                  </select>
                </div>
                {inp('İlk İletişim Tarihi', 'first_contact_date', 'date')}
              </div>

              {/* Kategori (çoklu seçim) */}
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#6b7280', letterSpacing:'0.05em', marginBottom:5, textTransform:'uppercase' }}>Kategori</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {CATEGORY_OPTIONS.map(cat => {
                    const selected = (form.categories||[]).includes(cat);
                    return (
                      <button key={cat} type="button"
                        onClick={()=>{
                          if(selected) set('categories',(form.categories||[]).filter(c=>c!==cat));
                          else set('categories',[...(form.categories||[]),cat]);
                        }}
                        style={{
                          padding:'5px 12px', borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:600,
                          border:`1.5px solid ${selected ? '#111827' : '#e5e7eb'}`,
                          background: selected ? '#111827' : 'white',
                          color: selected ? 'white' : '#374151', fontFamily:'inherit',
                        }}>{cat}</button>
                    );
                  })}
                </div>
              </div>

              {/* Aracı Bilgisi */}
              {inp('Aracı Bilgisi', 'referral_info', 'text', 'Kim/ne aracılığıyla ulaştık?')}

              {/* Sistem Plus Linki */}
              {inp('Sistem Plus Linki', 'system_plus_url', 'url', 'https://sistemplus.com/...')}
            </>
          )}

          {type === 'organization' && (
            <>
              {inp('Kurum Adı', 'name', 'text', 'Kurum Adı', true)}
              {sel('Kurum Tipi', 'org_type', ORG_TYPES)}
              {inp('Website', 'website', 'url', 'https://ornek.org')}
              {inp('E-posta', 'email', 'email', 'info@kurum.org')}
              {inp('Telefon', 'phone', 'tel', '+90 xxx xxx xx xx')}
              {inp('Adres', 'address', 'text', 'Şehir, Ülke')}
            </>
          )}

          {type === 'event' && (
            <>
              {inp('Etkinlik Adı', 'name', 'text', 'Etkinlik Adı', true)}
              {sel('Etkinlik Türü', 'event_type', EVENT_TYPES)}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {inp('Başlangıç Tarihi', 'event_date', 'date')}
                {inp('Bitiş Tarihi', 'end_date', 'date')}
              </div>
              {inp('Konum', 'location', 'text', 'Şehir, Ülke')}
              {inp('Drive Linki', 'drive_url', 'url', 'https://drive.google.com/...')}
            </>
          )}

          {/* Notlar / Açıklama */}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#6b7280', letterSpacing:'0.05em', marginBottom:5, textTransform:'uppercase' }}>
              {type==='contact' ? 'Notlar' : 'Açıklama'}
            </label>
            <textarea
              value={form.description || form.notes || ''}
              onChange={e=>set(type==='contact' ? 'notes' : 'description', e.target.value)}
              rows={3} placeholder="İsteğe bağlı notlar…"
              style={{ width:'100%', boxSizing:'border-box', padding:'9px 12px', borderRadius:9,
                border:'1.5px solid #e5e7eb', fontSize:13.5, fontFamily:'inherit', resize:'vertical', outline:'none' }}
            />
          </div>

          {/* Etiketler */}
          <div style={{ marginBottom:18 }}>
            <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#6b7280', letterSpacing:'0.05em', marginBottom:5, textTransform:'uppercase' }}>Etiketler</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:6 }}>
              {(form.tags||[]).map(t=>(
                <Tag key={t} label={t} onRemove={()=>set('tags',(form.tags||[]).filter(x=>x!==t))} />
              ))}
            </div>
            <input
              value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={addTag}
              placeholder="Etiket yaz + Enter"
              style={{ width:'100%', boxSizing:'border-box', padding:'8px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:'inherit', outline:'none' }}
            />
          </div>

          {error && <div style={{ padding:'10px 12px', borderRadius:8, background:'#fef2f2', border:'1px solid #fecaca', color:'#b91c1c', fontSize:13, marginBottom:12 }}>⚠️ {error}</div>}

          <div style={{ display:'flex', gap:10 }}>
            <button type="button" onClick={onClose} style={{
              flex:1, padding:'11px', borderRadius:10, border:'1.5px solid #e5e7eb',
              background:'white', cursor:'pointer', fontSize:14, fontWeight:600, color:'#374151', fontFamily:'inherit',
            }}>İptal</button>
            <button type="submit" disabled={saving} style={{
              flex:2, padding:'11px', borderRadius:10, border:'none',
              background: saving ? '#9ca3af' : '#111827',
              color:'white', cursor: saving ? 'not-allowed' : 'pointer',
              fontSize:14, fontWeight:700, fontFamily:'inherit',
            }}>
              {saving ? '⏳ Kaydediliyor…' : (isEdit ? '💾 Güncelle' : '➕ Ekle')}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

const EVENT_CONNECTION_LABELS = [
  'Katıldı', 'Konuşmacı', 'Organizatör', 'Sponsor',
  'Partner', 'Davetli', 'Moderatör', 'Diğer',
];

// ── BAĞLANTI EKLEME MODAL ─────────────────────────────────────────────────────
// Bağlantılar yalnızca etkinlik eksenlidir:
//   • Kaynak etkinlikse → kişi veya kurum seçilir
//   • Kaynak kişi/kurumsa → etkinlik seçilir
function AddConnectionModal({ sourceType, sourceId, orgs, contacts, events, connections, onSave, onClose }) {
  // Etkinlik tarafı kaynak mı hedef mi?
  const isEventSource = sourceType === 'event';

  // Eğer kaynak etkinlikse kullanıcı kişi/kurum seçer; değilse etkinlik seçer
  const [targetType, setTargetType] = useState(isEventSource ? 'contact' : 'event');
  const [targetId, setTargetId]     = useState('');
  const [label, setLabel]           = useState('');
  const [notes, setNotes]           = useState('');
  const [saving, setSaving]         = useState(false);

  // Zaten bağlı olanları çıkar
  const existing = new Set(
    connections
      .filter(c => (c.source_type===sourceType && c.source_id===sourceId) || (c.target_type===sourceType && c.target_id===sourceId))
      .map(c => c.source_type===sourceType && c.source_id===sourceId ? `${c.target_type}_${c.target_id}` : `${c.source_type}_${c.source_id}`)
  );

  const pool = (targetType==='contact' ? contacts : targetType==='organization' ? orgs : events)
    .filter(x => x.id !== sourceId || targetType !== sourceType)
    .filter(x => !existing.has(`${targetType}_${x.id}`));

  const handleSave = async () => {
    if (!targetId) return;
    setSaving(true);
    const { data, error } = await createNetworkConnection({
      source_type: sourceType, source_id: sourceId,
      target_type: targetType, target_id: targetId,
      label: label || null, notes: notes || null,
    });
    if (!error) onSave(data);
    setSaving(false);
  };

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1200 }} />
      <div style={{
        position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
        width:'min(440px, 95vw)', background:'white', borderRadius:16, zIndex:1201,
        padding:'24px', boxShadow:'0 20px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:800 }}>
            {isEventSource ? 'Katılımcı / Kurum Ekle' : 'Etkinliğe Bağla'}
          </h3>
          <button onClick={onClose} style={{ border:'none', background:'none', cursor:'pointer', fontSize:20, color:'#9ca3af' }}>✕</button>
        </div>

        {/* Kaynak etkinlikse kişi/kurum seçimi göster */}
        {isEventSource && (
          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            {[{id:'contact',label:'🧑 Kişi'},{id:'organization',label:'🏢 Kurum'}].map(t=>(
              <button key={t.id} onClick={()=>{setTargetType(t.id);setTargetId('');}}
                style={{
                  flex:1, padding:'8px 4px', borderRadius:8, cursor:'pointer',
                  border:`2px solid ${targetType===t.id ? '#2563eb' : '#e5e7eb'}`,
                  background: targetType===t.id ? '#eff6ff' : 'white',
                  color: targetType===t.id ? '#1d4ed8' : '#374151',
                  fontWeight:600, fontSize:12.5, fontFamily:'inherit',
                }}>{t.label}</button>
            ))}
          </div>
        )}

        {/* Kaynak kişi/kurumsa etkinlik seçimi */}
        {!isEventSource && (
          <div style={{ padding:'8px 12px', borderRadius:8, background:'#eff6ff', color:'#1d4ed8', fontSize:12.5, fontWeight:600, marginBottom:14 }}>
            📅 Bu kişi/kurum bir etkinlikte tanışılanlar listesine eklenecek
          </div>
        )}

        {/* Hedef seç */}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#6b7280', letterSpacing:'0.05em', marginBottom:5, textTransform:'uppercase' }}>
            {targetType==='contact' ? 'Kişi Seç' : targetType==='organization' ? 'Kurum Seç' : 'Etkinlik Seç'}
          </label>
          <select value={targetId} onChange={e=>setTargetId(e.target.value)}
            style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13.5, fontFamily:'inherit', background:'white', outline:'none' }}>
            <option value=''>-- Seçin --</option>
            {pool.map(x=><option key={x.id} value={x.id}>{x.full_name||x.name}</option>)}
          </select>
        </div>

        {/* İlişki etiketi */}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#6b7280', letterSpacing:'0.05em', marginBottom:5, textTransform:'uppercase' }}>İlişki Etiketi</label>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
            {EVENT_CONNECTION_LABELS.map(l=>(
              <button key={l} type="button" onClick={()=>setLabel(l)}
                style={{
                  padding:'4px 12px', borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:600,
                  border:`1.5px solid ${label===l ? '#111827' : '#e5e7eb'}`,
                  background: label===l ? '#111827' : 'white',
                  color: label===l ? 'white' : '#374151', fontFamily:'inherit',
                }}>{l}</button>
            ))}
          </div>
          <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="veya serbest yazın…"
            style={{ width:'100%', boxSizing:'border-box', padding:'8px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:'inherit', outline:'none' }} />
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#6b7280', letterSpacing:'0.05em', marginBottom:5, textTransform:'uppercase' }}>Not</label>
          <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="İsteğe bağlı not…"
            style={{ width:'100%', boxSizing:'border-box', padding:'8px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:'inherit', outline:'none' }} />
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:'10px', borderRadius:10, border:'1.5px solid #e5e7eb', background:'white', cursor:'pointer', fontSize:13, fontWeight:600, color:'#374151', fontFamily:'inherit' }}>İptal</button>
          <button onClick={handleSave} disabled={!targetId||saving} style={{
            flex:2, padding:'10px', borderRadius:10, border:'none',
            background:!targetId||saving ? '#9ca3af' : '#111827',
            color:'white', cursor:!targetId||saving ? 'not-allowed' : 'pointer',
            fontSize:13, fontWeight:700, fontFamily:'inherit',
          }}>
            {saving ? '⏳…' : '✅ Bağlantıyı Ekle'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── LİSTE SATIRI ─────────────────────────────────────────────────────────────
function ListRow({ item, type, connCount, onClick, orgs=[] }) {
  const name   = item.full_name || item.name;
  const imgUrl = item.avatar_url || item.logo_url || item.cover_url;
  const orgName = type==='contact' && item.organization_id
    ? orgs.find(o=>o.id===item.organization_id)?.name : null;
  return (
    <div onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:14, padding:'13px 20px',
      borderBottom:'1px solid #f9fafb', cursor:'pointer', transition:'background 0.1s',
    }}
    onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
    >
      <Avatar name={name} url={imgUrl} size={44} radius={type==='organization' ? 10 : '50%'} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:700, fontSize:14, color:'#111827', marginBottom:2 }}>{name}</div>
        <div style={{ fontSize:12.5, color:'#9ca3af', display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          {type==='contact' && item.position && <span>{item.position}</span>}
          {type==='contact' && orgName && <span>🏢 {orgName}</span>}
          {type==='contact' && item.country && <span>{getFlag(item.country)} {item.country}</span>}
          {type==='contact' && item.priority && item.priority !== 'Orta' && (() => {
            const pr = PRIORITY_OPTIONS.find(p=>p.value===item.priority);
            return pr ? <span style={{ color:pr.color, fontWeight:700 }}>{pr.emoji}</span> : null;
          })()}
          {type==='organization' && <TypeBadge value={item.org_type} types={ORG_TYPES} />}
          {type==='event' && item.event_date && <span>📅 {fmtDate(item.event_date)}</span>}
          {type==='event' && item.location && <span>📍 {item.location}</span>}
          {type==='event' && <TypeBadge value={item.event_type} types={EVENT_TYPES} />}
        </div>
      </div>
      {item.tags?.length > 0 && (
        <div style={{ display:'flex', gap:4, flexShrink:0 }}>
          {item.tags.slice(0,2).map(t=><Tag key={t} label={t} />)}
          {item.tags.length > 2 && <Tag label={`+${item.tags.length-2}`} />}
        </div>
      )}
      <span style={{ fontSize:12, color:'#9ca3af', flexShrink:0 }}>
        {connCount > 0 ? `🔗 ${connCount}` : ''}
      </span>
      <span style={{ color:'#d1d5db', fontSize:16 }}>›</span>
    </div>
  );
}

// ── KART ──────────────────────────────────────────────────────────────────────
function Card({ item, type, connCount, onClick, orgs=[] }) {
  const name   = item.full_name || item.name;
  const imgUrl = item.avatar_url || item.logo_url || item.cover_url;
  const orgName = type==='contact' && item.organization_id
    ? orgs.find(o=>o.id===item.organization_id)?.name : null;
  return (
    <div onClick={onClick} style={{
      background:'white', borderRadius:14, border:'1px solid #e5e7eb',
      overflow:'hidden', cursor:'pointer', transition:'all 0.15s',
      boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
    }}
    onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)';e.currentTarget.style.transform='translateY(-2px)';}}
    onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.04)';e.currentTarget.style.transform='none';}}
    >
      {/* Kapak rengi */}
      <div style={{ height:60, background: `linear-gradient(135deg, ${avatarColor(name)}22, ${avatarColor(name)}44)` }} />
      <div style={{ padding:'0 16px 16px', marginTop:-28 }}>
        <Avatar name={name} url={imgUrl} size={56} radius={type==='organization' ? 12 : '50%'}
          style={{ border:'3px solid white', boxShadow:'0 2px 8px rgba(0,0,0,0.1)' }} />
        <div style={{ marginTop:8 }}>
          <div style={{ fontWeight:800, fontSize:14.5, color:'#111827', marginBottom:3 }}>{name}</div>
          {type==='contact' && item.position && (
            <div style={{ fontSize:12.5, color:'#6b7280', marginBottom:2 }}>{item.position}</div>
          )}
          {type==='contact' && orgName && (
            <div style={{ fontSize:12, color:'#9ca3af' }}>🏢 {orgName}</div>
          )}
          {type==='contact' && (item.country || item.process_stage) && (
            <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:4, flexWrap:'wrap' }}>
              {item.country && <span style={{ fontSize:11 }}>{getFlag(item.country)} {item.country}</span>}
              {item.process_stage && (() => {
                const ps = PROCESS_STAGES.find(s=>s.value===item.process_stage);
                return ps ? <span style={{ fontSize:10, padding:'1px 7px', borderRadius:10, background:ps.color+'18', color:ps.color, fontWeight:700 }}>{ps.icon} {ps.value}</span> : null;
              })()}
            </div>
          )}
          {type==='organization' && <TypeBadge value={item.org_type} types={ORG_TYPES} />}
          {type==='event' && (
            <div style={{ fontSize:12.5, color:'#6b7280' }}>
              {item.event_date && <span>📅 {fmtDate(item.event_date)}</span>}
              {item.location && <span style={{ marginLeft:8 }}>📍 {item.location}</span>}
            </div>
          )}
        </div>
        {connCount > 0 && (
          <div style={{ marginTop:10, fontSize:12, color:'#9ca3af', fontWeight:600 }}>🔗 {connCount} bağlantı</div>
        )}
        {item.tags?.length > 0 && (
          <div style={{ marginTop:8, display:'flex', gap:4, flexWrap:'wrap' }}>
            {item.tags.slice(0,3).map(t=><Tag key={t} label={t} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── KURUM/ETKİNLİK ODAKLI GÖRÜNÜM ────────────────────────────────────────────
function FocusedView({ items, type, connections, contacts, orgs, events, onItemClick }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {items.map(item => {
        const name = item.full_name || item.name;
        const imgUrl = item.avatar_url || item.logo_url || item.cover_url;
        const myConns = connections.filter(c =>
          (c.source_type===type && c.source_id===item.id) ||
          (c.target_type===type && c.target_id===item.id)
        );
        const connNodes = myConns.map(c => {
          const isSource = c.source_type===type && c.source_id===item.id;
          const otherType = isSource ? c.target_type : c.source_type;
          const otherId   = isSource ? c.target_id   : c.source_id;
          const pool      = otherType==='contact' ? contacts : otherType==='organization' ? orgs : events;
          const found     = pool.find(x=>x.id===otherId);
          return found ? { ...found, connLabel: c.label, entityType: otherType } : null;
        }).filter(Boolean);

        return (
          <div key={item.id} style={{ background:'white', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
            {/* Başlık */}
            <div style={{ display:'flex', alignItems:'center', gap:14, padding:'16px 20px', borderBottom:'1px solid #f3f4f6', cursor:'pointer' }}
              onClick={()=>onItemClick(item, type)}>
              <Avatar name={name} url={imgUrl} size={48} radius={type==='organization' ? 10 : '50%'} />
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:800, fontSize:15, color:'#111827' }}>{name}</div>
                <div style={{ fontSize:12.5, color:'#9ca3af', marginTop:2 }}>
                  {type==='organization' && <TypeBadge value={item.org_type} types={ORG_TYPES} />}
                  {type==='event' && item.event_date && <span>📅 {fmtDate(item.event_date)}{item.location ? ` · 📍 ${item.location}` : ''}</span>}
                </div>
              </div>
              <span style={{ fontSize:12, color:'#9ca3af' }}>{myConns.length} bağlantı ›</span>
            </div>

            {/* Bağlı kişi/kurum/etkinlik görselleri */}
            {connNodes.length > 0 ? (
              <div style={{ padding:'14px 20px', display:'flex', gap:12, flexWrap:'wrap' }}>
                {connNodes.map((n,i) => {
                  const nName = n.full_name || n.name;
                  const nImg  = n.avatar_url || n.logo_url || n.cover_url;
                  return (
                    <div key={i} onClick={e=>{e.stopPropagation();onItemClick(n,n.entityType);}}
                      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, cursor:'pointer', width:64 }}>
                      <Avatar name={nName} url={nImg} size={44} radius={n.entityType==='organization' ? 9 : '50%'} />
                      <div style={{ fontSize:10.5, color:'#374151', textAlign:'center', lineHeight:1.3, fontWeight:600 }}>
                        {nName?.length > 10 ? nName.slice(0,9)+'…' : nName}
                      </div>
                      {n.connLabel && <div style={{ fontSize:9.5, color:'#9ca3af', textAlign:'center' }}>{n.connLabel}</div>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding:'12px 20px', fontSize:13, color:'#9ca3af' }}>Henüz bağlantı yok.</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── ANA COMPONENT ─────────────────────────────────────────────────────────────
export default function NetworkManager({ user, profile }) {
  const [data, setData]             = useState({ organizations:[], contacts:[], events:[], connections:[] });
  const [allProfiles, setAllProfiles] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState('contacts');    // 'contacts'|'organizations'|'events'
  const [viewMode, setViewMode]     = useState('liste');       // 'liste'|'kart'|'odakli'
  const [searchQ, setSearchQ]       = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [editItem, setEditItem]     = useState(null);
  const [formType, setFormType]     = useState('contact');
  const [showConnModal, setShowConnModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Veri yükle
  const load = useCallback(async () => {
    setLoading(true);
    const [result, profiles] = await Promise.all([
      getNetworkAll(),
      getAllProfiles(),
    ]);
    setData({
      organizations: result.organizations,
      contacts:      result.contacts,
      events:        result.events,
      connections:   result.connections,
    });
    setAllProfiles(profiles.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Bağlantı sayısı
  const connCount = (type, id) =>
    data.connections.filter(c =>
      (c.source_type===type && c.source_id===id) ||
      (c.target_type===type && c.target_id===id)
    ).length;

  // Arama filtresi
  const q = searchQ.toLowerCase();
  const filtered = useMemo(() => {
    const filterArr = (arr, nameKey) =>
      q ? arr.filter(x => (x[nameKey]||'').toLowerCase().includes(q) ||
        (x.tags||[]).some(t=>t.toLowerCase().includes(q)) ||
        (x.position||'').toLowerCase().includes(q) ||
        (x.location||'').toLowerCase().includes(q)
      ) : arr;
    return {
      contacts:      filterArr(data.contacts, 'full_name'),
      organizations: filterArr(data.organizations, 'name'),
      events:        filterArr(data.events, 'name'),
    };
  }, [data, q]);

  // İstatistikler
  const stats = [
    { label:'Kişiler',   value: data.contacts.length,      icon:'🧑', color:'#3b82f6' },
    { label:'Kurumlar',  value: data.organizations.length, icon:'🏢', color:'#8b5cf6' },
    { label:'Etkinlikler',value:data.events.length,        icon:'📅', color:'#16a34a' },
    { label:'Bağlantılar',value:data.connections.length,   icon:'🔗', color:'#f97316' },
  ];

  const currentItems = tab==='contacts' ? filtered.contacts : tab==='organizations' ? filtered.organizations : filtered.events;
  const currentType  = tab==='contacts' ? 'contact' : tab==='organizations' ? 'organization' : 'event';

  const openForm = (type, item=null) => {
    setFormType(type);
    setEditItem(item);
    setShowForm(true);
  };

  const handleFormSave = async (savedItem) => {
    setShowForm(false);
    setEditItem(null);
    await load();
    // Detay panelinde açıksa güncelle
    if (selectedItem?.id === savedItem?.id) {
      setSelectedItem(savedItem);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    if (type==='contact')      await deleteNetworkContact(id);
    else if (type==='organization') await deleteNetworkOrg(id);
    else await deleteNetworkEvent(id);
    setDeleteConfirm(null);
    if (selectedItem?.id === id) { setSelectedItem(null); setSelectedType(null); }
    await load();
  };

  const handleConnectionSave = async (conn) => {
    setShowConnModal(false);
    await load();
    // Seçili item'ın bağlantı listesi güncellensin
    if (selectedItem) {
      setData(prev => ({
        ...prev,
        connections: [...prev.connections, conn],
      }));
    }
  };

  const handleRemoveConnection = async (connId) => {
    await deleteNetworkConnection(connId);
    setData(prev => ({
      ...prev,
      connections: prev.connections.filter(c=>c.id!==connId),
    }));
  };

  const tabStyle = (id) => ({
    padding:'10px 20px', borderRadius:9, border:'none', cursor:'pointer',
    background: tab===id ? '#111827' : 'transparent',
    color: tab===id ? 'white' : '#6b7280',
    fontWeight:700, fontSize:13.5, fontFamily:'inherit',
    transition:'all 0.15s',
  });

  const viewBtnStyle = (id) => ({
    padding:'7px 14px', borderRadius:8, border:'none', cursor:'pointer',
    background: viewMode===id ? '#111827' : 'transparent',
    color: viewMode===id ? 'white' : '#6b7280',
    fontWeight:600, fontSize:13, fontFamily:'inherit',
    display:'flex', alignItems:'center', gap:5,
  });

  return (
    <div style={{ padding:'28px 32px', background:'#f7f8fa', minHeight:'100vh' }}>
      {/* Başlık */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:28, fontWeight:800, color:'#111827', margin:0, lineHeight:1.2 }}>🕸 Network Yönetimi</h1>
          <p style={{ fontSize:13.5, color:'#9ca3af', margin:'6px 0 0', fontWeight:500 }}>
            Kişiler, kurumlar ve etkinlikler ile ağ bağlantılarını yönetin
          </p>
        </div>
        {/* Yeni Ekle dropdown */}
        <div style={{ display:'flex', gap:8 }}>
          {[
            { type:'contact',      label:'🧑 Kişi',     },
            { type:'organization', label:'🏢 Kurum',    },
            { type:'event',        label:'📅 Etkinlik', },
          ].map(btn => (
            <button key={btn.type} onClick={()=>openForm(btn.type)} style={{
              padding:'9px 16px', borderRadius:10, border:'1.5px solid #e5e7eb',
              background:'white', cursor:'pointer', fontSize:13, fontWeight:700,
              color:'#374151', fontFamily:'inherit',
              boxShadow:'0 1px 3px rgba(0,0,0,0.06)',
            }}>{btn.label}</button>
          ))}
        </div>
      </div>

      {/* İstatistik Kartları */}
      <div style={{ display:'flex', gap:14, marginBottom:20 }}>
        {stats.map(s => (
          <div key={s.label} style={{
            flex:1, background:'white', borderRadius:12, border:'1px solid #e5e7eb',
            padding:'18px 20px', display:'flex', alignItems:'center', gap:14,
            boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              width:44, height:44, borderRadius:'50%', flexShrink:0,
              background:s.color+'18', display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:20,
            }}>{s.icon}</div>
            <div>
              <div style={{ fontSize:11.5, color:'#9ca3af', fontWeight:600, marginBottom:3 }}>{s.label}</div>
              <div style={{ fontSize:26, fontWeight:800, color:'#111827', lineHeight:1 }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar + Arama + Görünüm */}
      <div style={{
        background:'white', borderRadius:12, border:'1px solid #e5e7eb',
        padding:'12px 16px', marginBottom:16,
        boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {/* Tablar */}
          <div style={{ display:'flex', gap:4, background:'#f3f4f6', borderRadius:10, padding:3 }}>
            <button style={tabStyle('contacts')}     onClick={()=>setTab('contacts')}>🧑 Kişiler <span style={{ fontSize:11, opacity:0.7 }}>({data.contacts.length})</span></button>
            <button style={tabStyle('organizations')} onClick={()=>setTab('organizations')}>🏢 Kurumlar <span style={{ fontSize:11, opacity:0.7 }}>({data.organizations.length})</span></button>
            <button style={tabStyle('events')}        onClick={()=>setTab('events')}>📅 Etkinlikler <span style={{ fontSize:11, opacity:0.7 }}>({data.events.length})</span></button>
          </div>

          {/* Arama */}
          <div style={{ position:'relative', flex:'1 1 200px', minWidth:160 }}>
            <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#9ca3af', fontSize:15 }}>🔍</span>
            <input type="text" value={searchQ} onChange={e=>setSearchQ(e.target.value)}
              placeholder="Ara…"
              style={{ width:'100%', boxSizing:'border-box', padding:'8px 10px 8px 32px',
                borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:'inherit', outline:'none', background:'#fafafa' }} />
          </div>

          {/* Görünüm toggle */}
          <div style={{ display:'flex', gap:2, background:'#f3f4f6', borderRadius:10, padding:3 }}>
            <button style={viewBtnStyle('liste')}  onClick={()=>setViewMode('liste')}>☰ Liste</button>
            <button style={viewBtnStyle('kart')}   onClick={()=>setViewMode('kart')}>⊞ Kart</button>
            <button style={viewBtnStyle('odakli')} onClick={()=>setViewMode('odakli')}>🕸 Odaklı</button>
          </div>
        </div>

        <div style={{ fontSize:12.5, color:'#9ca3af', marginTop:8, fontWeight:500 }}>
          {currentItems.length} kayıt
          {viewMode==='odakli' && tab==='contacts' && ' — Odaklı görünüm Kurumlar ve Etkinlikler tabında kullanılabilir'}
        </div>
      </div>

      {/* İçerik */}
      {loading && (
        <div style={{ textAlign:'center', padding:'60px', color:'#9ca3af' }}>
          <div style={{ fontSize:36, marginBottom:10 }}>⏳</div>
          <div style={{ fontSize:14, fontWeight:500 }}>Yükleniyor…</div>
        </div>
      )}

      {!loading && currentItems.length === 0 && (
        <div style={{ background:'white', borderRadius:14, border:'1px solid #e5e7eb' }}>
          <EmptyState
            icon={tab==='contacts' ? '🧑' : tab==='organizations' ? '🏢' : '📅'}
            title={`Henüz ${tab==='contacts' ? 'kişi' : tab==='organizations' ? 'kurum' : 'etkinlik'} yok`}
            sub="Yeni Ekle butonlarından başlayın"
          />
        </div>
      )}

      {!loading && currentItems.length > 0 && (
        <>
          {/* Liste görünümü */}
          {viewMode==='liste' && (
            <div style={{ background:'white', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
              {currentItems.map(item => (
                <ListRow key={item.id} item={item} type={currentType}
                  connCount={connCount(currentType, item.id)}
                  orgs={data.organizations}
                  onClick={()=>{ setSelectedItem(item); setSelectedType(currentType); }} />
              ))}
            </div>
          )}

          {/* Kart görünümü */}
          {viewMode==='kart' && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:14 }}>
              {currentItems.map(item => (
                <Card key={item.id} item={item} type={currentType}
                  connCount={connCount(currentType, item.id)}
                  orgs={data.organizations}
                  onClick={()=>{ setSelectedItem(item); setSelectedType(currentType); }} />
              ))}
            </div>
          )}

          {/* Odaklı görünüm */}
          {viewMode==='odakli' && (tab==='organizations' || tab==='events') && (
            <FocusedView
              items={currentItems} type={currentType}
              connections={data.connections}
              contacts={data.contacts} orgs={data.organizations} events={data.events}
              onItemClick={(item, type)=>{ setSelectedItem(item); setSelectedType(type); }}
            />
          )}
          {viewMode==='odakli' && tab==='contacts' && (
            <div style={{ background:'white', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
              {currentItems.map(item => (
                <ListRow key={item.id} item={item} type={currentType}
                  connCount={connCount(currentType, item.id)}
                  orgs={data.organizations}
                  onClick={()=>{ setSelectedItem(item); setSelectedType(currentType); }} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Detay Paneli */}
      {selectedItem && selectedType && (
        <DetailPanel
          item={selectedItem} type={selectedType}
          orgs={data.organizations} contacts={data.contacts} events={data.events}
          connections={data.connections}
          allProfiles={allProfiles} user={user}
          onClose={()=>{ setSelectedItem(null); setSelectedType(null); }}
          onEdit={()=>openForm(selectedType, selectedItem)}
          onDelete={()=>setDeleteConfirm({ type:selectedType, id:selectedItem.id })}
          onAddConnection={()=>setShowConnModal(true)}
          onRemoveConnection={handleRemoveConnection}
        />
      )}

      {/* Form Modal */}
      {showForm && (
        <FormModal
          type={formType} initial={editItem}
          orgs={data.organizations} user={user}
          allProfiles={allProfiles}
          onSave={handleFormSave}
          onClose={()=>{ setShowForm(false); setEditItem(null); }}
        />
      )}

      {/* Bağlantı Modal */}
      {showConnModal && selectedItem && (
        <AddConnectionModal
          sourceType={selectedType} sourceId={selectedItem.id}
          orgs={data.organizations} contacts={data.contacts} events={data.events}
          connections={data.connections}
          onSave={handleConnectionSave}
          onClose={()=>setShowConnModal(false)}
        />
      )}

      {/* Silme onayı */}
      {deleteConfirm && (
        <>
          <div onClick={()=>setDeleteConfirm(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1300 }} />
          <div style={{
            position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
            background:'white', borderRadius:16, padding:'28px 32px', zIndex:1301,
            width:'min(380px, 90vw)', boxShadow:'0 20px 60px rgba(0,0,0,0.2)',
            textAlign:'center',
          }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🗑️</div>
            <div style={{ fontSize:16, fontWeight:800, color:'#111827', marginBottom:8 }}>Kaydı Sil</div>
            <div style={{ fontSize:13.5, color:'#6b7280', marginBottom:24 }}>
              Bu kayıt silinecek. Bu işlem geri alınamaz.
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setDeleteConfirm(null)} style={{ flex:1, padding:'11px', borderRadius:10, border:'1.5px solid #e5e7eb', background:'white', cursor:'pointer', fontSize:14, fontWeight:600, fontFamily:'inherit', color:'#374151' }}>İptal</button>
              <button onClick={handleDelete} style={{ flex:1, padding:'11px', borderRadius:10, border:'none', background:'#ef4444', color:'white', cursor:'pointer', fontSize:14, fontWeight:700, fontFamily:'inherit' }}>Sil</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
