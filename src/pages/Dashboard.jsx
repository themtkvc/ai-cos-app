import React, { useState, useEffect } from 'react';
import { getDeadlines, getDonors, getMeetingActions } from '../lib/supabase';
import { format, differenceInCalendarDays } from 'date-fns';
import { tr } from 'date-fns/locale';

const UNITS = {
  'Partnerships': { color: 'unit-partnerships', icon: '🤝' },
  'Humanitarian Affairs': { color: 'unit-humanitarian', icon: '🌍' },
  'Traditional Donors': { color: 'unit-traditional-donors', icon: '💰' },
  'Grants': { color: 'unit-grants', icon: '📝' },
  'Accreditations': { color: 'unit-accreditations', icon: '✅' },
  'Policy & Governance': { color: 'unit-policy', icon: '⚖️' },
};

function daysLeft(date) {
  return differenceInCalendarDays(new Date(date), new Date());
}
function daysClass(d) {
  if (d < 0) return 'days-overdue';
  if (d <= 3) return 'days-urgent';
  if (d <= 7) return 'days-soon';
  return 'days-ok';
}
function daysLabel(d) {
  if (d < 0) return `${Math.abs(d)} gün gecikmiş`;
  if (d === 0) return 'Bugün!';
  if (d === 1) return 'Yarın';
  return `${d} gün kaldı`;
}

const AI_QUICK_ACTIONS = [
  { icon: '📋', text: 'Bu hafta toplantı gündemimi hazırla' },
  { icon: '📧', text: 'WFP için follow-up email yaz' },
  { icon: '⚡', text: 'Bu hafta ne yapmalıyım?' },
  { icon: '📊', text: 'Board meeting brifingini hazırla' },
];

export default function Dashboard({ user, onNavigate }) {
  const [deadlines, setDeadlines] = useState([]);
  const [donors, setDonors] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getDeadlines(user.id),
      getDonors(user.id),
      getMeetingActions(user.id),
    ]).then(([d, don, a]) => {
      setDeadlines(d.data || []);
      setDonors(don.data || []);
      setActions(a.data || []);
      setLoading(false);
    });
  }, [user]);

  const active = deadlines.filter(d => d.status !== '✅ Completed');
  const overdue = active.filter(d => daysLeft(d.due_date) < 0);
  const urgent = active.filter(d => { const n = daysLeft(d.due_date); return n >= 0 && n <= 7; });
  const openActions = actions.filter(a => a.status !== '✅ Completed');
  const todayStr = format(new Date(), "d MMMM yyyy, EEEE", { locale: tr });

  const topDeadlines = [...overdue, ...urgent]
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 8);

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:300,color:'var(--text-muted)'}}>
      <div className="loading-spinner" style={{borderTopColor:'var(--blue)'}} />
    </div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Günaydın, Direktör</h1>
        <p className="page-date">{todayStr}</p>
        <p className="page-subtitle" style={{marginTop:6}}>
          {overdue.length > 0
            ? `⚠️ ${overdue.length} gecikmiş görev var — önce bunlara bakın.`
            : urgent.length > 0
            ? `📌 Bu hafta ${urgent.length} kritik görev var.`
            : '✅ Bugün acil görev yok.'}
        </p>
      </div>

      {/* KPI CARDS — tıklanabilir */}
      <div className="kpi-grid">
        <div className="kpi-card red kpi-clickable" onClick={() => onNavigate('deadlines')}>
          <div className="kpi-label">Gecikmiş</div>
          <div className="kpi-value">{overdue.length}</div>
          <div className="kpi-sub">görev ↗</div>
        </div>
        <div className="kpi-card orange kpi-clickable" onClick={() => onNavigate('deadlines')}>
          <div className="kpi-label">Bu Hafta</div>
          <div className="kpi-value">{urgent.length}</div>
          <div className="kpi-sub">süresi doluyor ↗</div>
        </div>
        <div className="kpi-card blue kpi-clickable" onClick={() => onNavigate('deadlines')}>
          <div className="kpi-label">Toplam Aktif</div>
          <div className="kpi-value">{active.length}</div>
          <div className="kpi-sub">görev ↗</div>
        </div>
        <div className="kpi-card navy kpi-clickable" onClick={() => onNavigate('meetings')}>
          <div className="kpi-label">Açık Aksiyonlar</div>
          <div className="kpi-value">{openActions.length}</div>
          <div className="kpi-sub">toplantıdan ↗</div>
        </div>
        <div className="kpi-card green kpi-clickable" onClick={() => onNavigate('donors')}>
          <div className="kpi-label">Donörler</div>
          <div className="kpi-value">{donors.length}</div>
          <div className="kpi-sub">aktif ilişki ↗</div>
        </div>
      </div>

      <div className="grid-2">
        {/* URGENT DEADLINES */}
        <div className="card" style={{gridColumn: topDeadlines.length > 4 ? '1/3' : '1/2'}}>
          <div className="section-header">
            <div className="section-title">
              <span className="section-dot red" />
              Acil Görevler & Tarihler
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-outline btn-sm"
                onClick={() => onNavigate('chat', { initialMessage: 'Kritik görevleri ve gecikmeleri listele, ne yapmalıyım?' })}>
                🤖 AI ile analiz et
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => onNavigate('deadlines')}>Tümünü Gör →</button>
            </div>
          </div>
          {topDeadlines.length === 0 ? (
            <div className="empty-state" style={{padding:'24px'}}>
              <div className="empty-state-icon">✅</div>
              <div className="empty-state-title">Bu hafta acil görev yok</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Görev</th>
                  <th>Birim</th>
                  <th>Sahibi</th>
                  <th>Son Tarih</th>
                  <th>Durum</th>
                  <th>Kalan</th>
                </tr>
              </thead>
              <tbody>
                {topDeadlines.map((d, i) => {
                  const days = daysLeft(d.due_date);
                  const unit = UNITS[d.unit] || {};
                  return (
                    <tr key={d.id} className={i % 2 === 1 ? 'row-alt' : ''}
                      style={{cursor:'pointer'}}
                      onClick={() => onNavigate('deadlines')}
                    >
                      <td><strong style={{color:'var(--text)'}}>{d.title}</strong></td>
                      <td>
                        <span className={`unit-chip ${unit.color || ''}`}>
                          {unit.icon} {d.unit}
                        </span>
                      </td>
                      <td style={{color:'var(--text-muted)'}}>{d.owner}</td>
                      <td style={{color:'var(--text)'}}>{d.due_date}</td>
                      <td><span className={`badge ${
                        d.status === '🔵 In Progress' ? 'badge-blue' :
                        d.status === '✅ Completed' ? 'badge-green' : 'badge-gray'
                      }`}>{d.status}</span></td>
                      <td><span className={daysClass(days)}>{daysLabel(days)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* DONOR PULSE */}
        <div className="card">
          <div className="section-header">
            <div className="section-title">
              <span className="section-dot orange" />
              Donör Pulse
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-outline btn-sm"
                onClick={() => onNavigate('chat', { initialMessage: 'Donör durumu özeti ver, hangi donörde aksiyon gerekiyor?' })}>
                🤖 AI özeti
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => onNavigate('donors')}>CRM →</button>
            </div>
          </div>
          {donors.length === 0 ? (
            <div className="empty-state" style={{padding:'24px'}}>
              <div>Donör verisi yok</div>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {donors.map(d => {
                const repDays = d.reporting_deadline ? daysLeft(d.reporting_deadline) : null;
                return (
                  <div key={d.id}
                    onClick={() => onNavigate('donors')}
                    style={{
                      padding:'12px 14px', borderRadius:8, cursor:'pointer',
                      border:'1px solid var(--border)', background:'var(--surface)',
                      display:'flex', alignItems:'center', gap:12,
                      transition:'all 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--gray-light)'}
                    onMouseLeave={e => e.currentTarget.style.background='var(--surface)'}
                  >
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600, color:'var(--text)', fontSize:13.5}}>{d.name}</div>
                      <div style={{fontSize:11.5, color:'var(--text-muted)', marginTop:2}}>
                        Yönetici: {d.account_manager} · Son temas: {d.last_contact || '—'}
                      </div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:12, fontWeight:600, color:
                        d.health?.includes('Strong') ? 'var(--green)' :
                        d.health?.includes('Developing') ? 'var(--orange)' : 'var(--red)'
                      }}>{d.health}</div>
                      {repDays !== null && (
                        <div className={`${daysClass(repDays)}`} style={{fontSize:11, marginTop:2}}>
                          Rapor: {daysLabel(repDays)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* OPEN MEETING ACTIONS */}
        <div className="card">
          <div className="section-header">
            <div className="section-title">
              <span className="section-dot blue" />
              Açık Toplantı Aksiyonları
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-outline btn-sm"
                onClick={() => onNavigate('chat', { initialMessage: 'Toplantı aksiyonlarını özetle, hangileri gecikmiş?' })}>
                🤖 AI özeti
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => onNavigate('meetings')}>Tümü →</button>
            </div>
          </div>
          {openActions.length === 0 ? (
            <div className="empty-state" style={{padding:'24px'}}>
              <div className="empty-state-icon">✅</div>
              <div>Açık aksiyon yok</div>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {openActions.slice(0, 6).map((a, i) => (
                <div key={a.id}
                  onClick={() => onNavigate('meetings')}
                  style={{
                    padding:'10px 12px', borderRadius:8, cursor:'pointer',
                    background: i % 2 === 0 ? 'var(--surface)' : 'var(--white)',
                    border:'1px solid var(--border)',
                    display:'flex', alignItems:'center', gap:10,
                    transition:'all 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--gray-light)'}
                  onMouseLeave={e => e.currentTarget.style.background= i % 2 === 0 ? 'var(--surface)' : 'var(--white)'}
                >
                  <div style={{flex:1}}>
                    <div style={{fontSize:13, color:'var(--text)', fontWeight:500}}>{a.action_item}</div>
                    <div style={{fontSize:11.5, color:'var(--text-muted)', marginTop:2}}>
                      {a.meeting_type} · {a.owner}
                    </div>
                  </div>
                  {a.due_date && (
                    <div className={daysClass(daysLeft(a.due_date))} style={{fontSize:11.5, flexShrink:0}}>
                      {daysLabel(daysLeft(a.due_date))}
                    </div>
                  )}
                </div>
              ))}
              {openActions.length > 6 && (
                <div style={{textAlign:'center', fontSize:12, color:'var(--text-muted)', padding:'4px 0'}}>
                  +{openActions.length - 6} daha…
                </div>
              )}
            </div>
          )}
        </div>

        {/* AI QUICK ACCESS — mesajı doğrudan Chat'e iletir */}
        <div className="card" style={{
          background: 'linear-gradient(135deg, var(--navy) 0%, var(--navy-mid) 100%)',
          border: '1px solid var(--navy-light)',
          color: 'white'
        }}>
          <div className="card-title" style={{color:'rgba(255,255,255,0.9)'}}>
            <span>🤖</span> AI Asistan — Hızlı Erişim
          </div>
          <p style={{fontSize:13, color:'rgba(255,255,255,0.55)', marginBottom:16, lineHeight:1.6}}>
            Bir konuya tıklayın — AI'a direkt iletilir ve yanıt üretilir.
          </p>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {AI_QUICK_ACTIONS.map(({ icon, text }) => (
              <button
                key={text}
                onClick={() => onNavigate('chat', { initialMessage: text })}
                style={{
                  padding:'10px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)',
                  background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.75)',
                  cursor:'pointer', fontSize:13, textAlign:'left',
                  transition:'all 0.15s', fontFamily:'var(--font-body)',
                  display:'flex', alignItems:'center', gap:8
                }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.12)'; e.currentTarget.style.color='white'; }}
                onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='rgba(255,255,255,0.75)'; }}
              >
                {icon} {text}
              </button>
            ))}
          </div>
          <button
            onClick={() => onNavigate('chat')}
            style={{
              marginTop:12, width:'100%', padding:'10px', borderRadius:8,
              border:'1px solid rgba(201,168,76,0.4)', background:'rgba(201,168,76,0.1)',
              color:'var(--gold-light)', cursor:'pointer', fontSize:13, fontWeight:500,
              transition:'all 0.15s', fontFamily:'var(--font-body)',
            }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(201,168,76,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(201,168,76,0.1)'}
          >
            💬 Serbest sohbet başlat →
          </button>
        </div>
      </div>
    </div>
  );
}
