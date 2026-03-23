import React, { useState, useEffect, useMemo } from 'react';
import { getDeadlines, getDonors, getMeetingActions, getAgendasV2, getDailyLog, getDashboardLogs, getAllProfiles } from '../lib/supabase';
import { format, differenceInCalendarDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { UNITS as UNIT_LIST, UNIT_CSS_MAP, UNIT_ICON_MAP, ROLE_LABELS, avatarColor, toLocalDateStr } from '../lib/constants';
import EmptyState from '../components/EmptyState';

const UNITS = Object.fromEntries(UNIT_LIST.map(u => [u.name, { color: u.cssClass, icon: u.icon }]));

// ── Yardımcılar ─────────────────────────────────────────────────────────────
function daysLeft(date) { return differenceInCalendarDays(new Date(date), new Date()); }
function daysClass(d) {
  if (d < 0) return 'days-overdue';
  if (d <= 3) return 'days-urgent';
  if (d <= 7) return 'days-soon';
  return 'days-ok';
}
function daysLabel(d) {
  if (d < 0) return `${Math.abs(d)}g gecikmiş`;
  if (d === 0) return 'Bugün!';
  if (d === 1) return 'Yarın';
  return `${d}g kaldı`;
}

const STATUS_TR = { '⚪ Not Started':'⚪ Başlanmadı', '🔵 In Progress':'🔵 Devam Ediyor', '✅ Completed':'✅ Tamamlandı', '🔴 Overdue':'🔴 Gecikmiş' };
const HEALTH_TR = { '🟢 Strong':'🟢 Güçlü', '🟡 Developing':'🟡 Gelişiyor', '🔴 At Risk':'🔴 Risk Altında' };

// ── Quick Actions ────────────────────────────────────────────────────────────
const QA_DIREKTOR = [
  { icon: '📋', text: 'Bu hafta toplantı gündemimi hazırla' },
  { icon: '📧', text: 'WFP için follow-up email yaz' },
  { icon: '⚡', text: 'Bu hafta ne yapmalıyım?' },
  { icon: '📊', text: 'Board meeting brifingini hazırla' },
];
const QA_KOORDINATOR = [
  { icon: '⚡', text: 'Bu hafta ne yapmalıyım?' },
  { icon: '📋', text: 'Birimimin görev durumunu özetle' },
  { icon: '📊', text: 'Haftalık birim raporumu hazırla' },
  { icon: '🚨', text: 'Gecikmiş görevleri listele' },
];
const QA_PERSONEL = [
  { icon: '⚡', text: 'Bu hafta ne yapmalıyım?' },
  { icon: '📝', text: 'Bugünkü iş kaydımı oluştur' },
  { icon: '🚨', text: 'Gecikmiş görevlerimi göster' },
  { icon: '📋', text: 'Bana atanan gündemleri listele' },
];
function getQA(role) {
  if (['direktor','direktor_yardimcisi','asistan'].includes(role)) return QA_DIREKTOR;
  if (role === 'koordinator') return QA_KOORDINATOR;
  return QA_PERSONEL;
}

// ── KPI Kart bileşeni ────────────────────────────────────────────────────────
function KPI({ label, value, sub, color = 'blue', onClick }) {
  return (
    <div className={`kpi-card ${color} kpi-clickable`} onClick={onClick}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

// ── AI Quick Actions bileşeni ────────────────────────────────────────────────
function AIPanel({ role, onNavigate }) {
  return (
    <div className="card" style={{
      background: 'linear-gradient(135deg, var(--navy) 0%, var(--navy-mid) 100%)',
      border: '1px solid var(--navy-light)', color: 'white',
    }}>
      <div className="card-title" style={{color:'rgba(255,255,255,0.9)'}}>
        <span>🤖</span> AI Asistan
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {getQA(role).map(({ icon, text }) => (
          <button key={text}
            onClick={() => onNavigate('chat', { initialMessage: text })}
            style={{
              padding:'10px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)',
              background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.75)',
              cursor:'pointer', fontSize:13, textAlign:'left', transition:'all 0.15s',
              fontFamily:'var(--font-body)', display:'flex', alignItems:'center', gap:8,
            }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.12)'; e.currentTarget.style.color='white'; }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='rgba(255,255,255,0.75)'; }}
          >
            {icon} {text}
          </button>
        ))}
      </div>
      <button onClick={() => onNavigate('chat')} style={{
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
  );
}

// ── Görev listesi bileşeni ───────────────────────────────────────────────────
function TaskList({ tasks, title, icon, emptyMsg, onNavigate, showUnit = true }) {
  return (
    <div className="card">
      <div className="section-header">
        <div className="section-title"><span className="section-dot red" />{title}</div>
        <button className="btn btn-outline btn-sm" onClick={() => onNavigate('agendas')}>Tümü →</button>
      </div>
      {tasks.length === 0 ? (
        <EmptyState icon={icon || '✅'} title={emptyMsg || 'Görev yok'} />
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {tasks.slice(0, 8).map(t => {
            const days = t.due_date ? daysLeft(t.due_date) : null;
            return (
              <div key={t.id} onClick={() => onNavigate('agendas')} style={{
                padding:'10px 12px', borderRadius:8, cursor:'pointer',
                border:'1px solid var(--border)', background:'var(--surface)',
                display:'flex', alignItems:'center', gap:10, transition:'background 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background='var(--gray-light)'}
                onMouseLeave={e => e.currentTarget.style.background='var(--surface)'}
              >
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:13, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{t.title}</div>
                  <div style={{fontSize:11.5, color:'var(--text-muted)', marginTop:2}}>
                    {t.assigned_to_name && <span>{t.assigned_to_name}</span>}
                    {showUnit && t.unit && <span> · {t.unit}</span>}
                    {t.priority && <span> · {t.priority}</span>}
                  </div>
                </div>
                {days !== null && (
                  <span className={daysClass(days)} style={{fontSize:11.5, flexShrink:0, fontWeight:600}}>{daysLabel(days)}</span>
                )}
              </div>
            );
          })}
          {tasks.length > 8 && (
            <div style={{textAlign:'center',fontSize:12,color:'var(--text-muted)',padding:4}}>+{tasks.length - 8} daha…</div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANA DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
export default function Dashboard({ user, profile, onNavigate }) {
  const [deadlines, setDeadlines] = useState([]);
  const [donors, setDonors] = useState([]);
  const [actions, setActions] = useState([]);
  const [agendas, setAgendas] = useState([]);
  const [todayLog, setTodayLog] = useState(null);
  const [teamLogs, setTeamLogs] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const role = profile?.role || 'personel';
  const myUnit = profile?.unit;
  const myId = user?.id;
  const isDirektor = ['direktor','direktor_yardimcisi','asistan'].includes(role);
  const isKoordinator = role === 'koordinator';

  const todayDate = useMemo(() => toLocalDateStr(new Date()), []);
  const todayStrF = useMemo(() => format(new Date(), "d MMMM yyyy, EEEE", { locale: tr }), []);

  useEffect(() => {
    const loads = [];

    // Herkes için
    loads.push(getAgendasV2(myId, isDirektor ? null : myUnit));
    loads.push(getDailyLog(myId, todayDate));

    if (isDirektor) {
      loads.push(getDeadlines(myId));
      loads.push(getDonors(myId));
      loads.push(getMeetingActions(myId));
      loads.push(getAllProfiles());
      loads.push(getDashboardLogs(todayDate, todayDate));
    } else if (isKoordinator) {
      loads.push(getAllProfiles());
      loads.push(getDashboardLogs(todayDate, todayDate));
    } else {
      loads.push(Promise.resolve({ data: [] })); // placeholder
      loads.push(Promise.resolve({ data: [] }));
    }

    Promise.all(loads).then(results => {
      const [agRes, logRes, ...rest] = results;
      setAgendas(agRes.data || []);
      setTodayLog(logRes.data);

      if (isDirektor) {
        const [dRes, donRes, actRes, profRes, tLogsRes] = rest;
        setDeadlines(dRes.data || []);
        setDonors(donRes.data || []);
        setActions(actRes.data || []);
        setProfiles(profRes.data || []);
        setTeamLogs(tLogsRes.data || []);
      } else if (isKoordinator) {
        const [profRes, tLogsRes] = rest;
        setProfiles(profRes.data || []);
        setTeamLogs(tLogsRes.data || []);
      }
      setLoading(false);
    });
  }, [user, myId, myUnit, isDirektor, isKoordinator, todayDate]);

  // ── Hesaplamalar ──────────────────────────────────────────────────────────
  // Deadline
  const active = useMemo(() => deadlines.filter(d => d.status !== '✅ Completed'), [deadlines]);
  const overdue = useMemo(() => active.filter(d => daysLeft(d.due_date) < 0), [active]);
  const urgent = useMemo(() => active.filter(d => { const n = daysLeft(d.due_date); return n >= 0 && n <= 7; }), [active]);
  const openActions = useMemo(() => actions.filter(a => a.status !== '✅ Completed'), [actions]);
  const topDeadlines = useMemo(() => [...overdue, ...urgent].sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).slice(0, 8), [overdue, urgent]);

  // Gündem & görevler (tüm roller için)
  const allTasks = useMemo(() => {
    const tasks = [];
    (agendas || []).forEach(a => {
      (a.agenda_tasks || []).forEach(t => {
        tasks.push({ ...t, agendaTitle: a.title, unit: a.unit });
      });
    });
    return tasks;
  }, [agendas]);

  const myTasks = useMemo(() => allTasks.filter(t =>
    t.assigned_to === myId || t.created_by === myId
  ), [allTasks, myId]);

  const myPendingTasks = useMemo(() => myTasks.filter(t =>
    t.completion_status !== 'approved' && t.status !== 'tamamlandi'
  ), [myTasks]);

  const myOverdueTasks = useMemo(() => myPendingTasks.filter(t =>
    t.due_date && daysLeft(t.due_date) < 0
  ), [myPendingTasks]);

  const myUrgentTasks = useMemo(() => myPendingTasks.filter(t => {
    if (!t.due_date) return false;
    const d = daysLeft(t.due_date);
    return d >= 0 && d <= 7;
  }), [myPendingTasks]);

  const pendingReview = useMemo(() => allTasks.filter(t =>
    t.completion_status === 'pending_review'
  ), [allTasks]);

  // Birim bazlı (koordinatör için)
  const unitTasks = useMemo(() => {
    if (!isKoordinator || !myUnit) return [];
    return allTasks.filter(t => t.unit === myUnit);
  }, [allTasks, isKoordinator, myUnit]);

  const unitPending = useMemo(() => unitTasks.filter(t =>
    t.completion_status !== 'approved' && t.status !== 'tamamlandi'
  ), [unitTasks]);

  const unitCompleted = useMemo(() => unitTasks.filter(t =>
    t.completion_status === 'approved' || t.status === 'tamamlandi'
  ), [unitTasks]);

  // Personel durumu (koordinatör & direktör)
  const unitProfiles = useMemo(() => {
    if (isDirektor) return profiles.filter(p => p.role !== 'direktor');
    if (isKoordinator && myUnit) return profiles.filter(p => p.unit === myUnit && p.user_id !== myId);
    return [];
  }, [profiles, isDirektor, isKoordinator, myUnit, myId]);

  const teamLogMap = useMemo(() => {
    const map = {};
    (teamLogs || []).forEach(l => { map[l.user_id] = l; });
    return map;
  }, [teamLogs]);

  // İş kaydı durumu
  const hasLogToday = !!todayLog?.id;

  // Birim durum özeti (direktör için)
  const unitSummary = useMemo(() => {
    if (!isDirektor) return [];
    return UNIT_LIST.map(u => {
      const uTasks = allTasks.filter(t => t.unit === u.name);
      const total = uTasks.length;
      const done = uTasks.filter(t => t.completion_status === 'approved' || t.status === 'tamamlandi').length;
      const overdueCount = uTasks.filter(t => t.due_date && daysLeft(t.due_date) < 0 && t.completion_status !== 'approved' && t.status !== 'tamamlandi').length;
      const personnel = profiles.filter(p => p.unit === u.name).length;
      const logsToday = profiles.filter(p => p.unit === u.name && teamLogMap[p.user_id]).length;
      return { ...u, total, done, overdueCount, personnel, logsToday, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
    });
  }, [isDirektor, allTasks, profiles, teamLogMap]);

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:300,color:'var(--text-muted)'}}>
      <div className="loading-spinner" style={{borderTopColor:'var(--blue)'}} />
    </div>
  );

  // ── Subtitle (role-aware) ─────────────────────────────────────────────────
  function getSubtitle() {
    if (isDirektor) {
      if (overdue.length > 0) return `⚠️ ${overdue.length} gecikmiş deadline var — önce bunlara bakın.`;
      if (urgent.length > 0) return `📌 Bu hafta ${urgent.length} kritik deadline var.`;
      return '✅ Bugün acil deadline yok.';
    }
    if (isKoordinator) {
      const ov = unitPending.filter(t => t.due_date && daysLeft(t.due_date) < 0).length;
      if (ov > 0) return `⚠️ Biriminizde ${ov} gecikmiş görev var.`;
      if (pendingReview.length > 0) return `⏳ ${pendingReview.length} görev onay bekliyor.`;
      return `✅ ${myUnit || 'Biriminiz'} — her şey yolunda.`;
    }
    if (myOverdueTasks.length > 0) return `⚠️ ${myOverdueTasks.length} gecikmiş göreviniz var.`;
    if (!hasLogToday) return '📝 Bugün henüz iş kaydı girmediniz.';
    return '✅ Bugün acil görev yok.';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DİREKTÖR DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════
  if (isDirektor) return (
    <div className="page">
      {/* HEADER */}
      <div className="page-header">
        <h1 className="page-title">Günaydın{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h1>
        <p className="page-date">{todayStrF}</p>
        <p className="page-subtitle" style={{marginTop:6}}>{getSubtitle()}</p>
      </div>

      {/* KPI'lar */}
      <div className="kpi-grid">
        <KPI label="Gecikmiş" value={overdue.length} sub="deadline ↗" color="red" onClick={() => onNavigate('deadlines')} />
        <KPI label="Bu Hafta" value={urgent.length} sub="süresi doluyor ↗" color="orange" onClick={() => onNavigate('deadlines')} />
        <KPI label="Açık Aksiyonlar" value={openActions.length} sub="toplantıdan ↗" color="navy" onClick={() => onNavigate('meetings')} />
        <KPI label="Donörler" value={donors.length} sub="aktif ilişki ↗" color="green" onClick={() => onNavigate('donors')} />
        <KPI label="Onay Bekleyen" value={pendingReview.length} sub="görev ↗" color="blue" onClick={() => onNavigate('agendas')} />
      </div>

      {/* BİRİM DURUM PANELİ */}
      <div className="card" style={{marginBottom:0}}>
        <div className="section-header">
          <div className="section-title"><span className="section-dot blue" />Birim Durumu</div>
          <button className="btn btn-outline btn-sm" onClick={() => onNavigate('reports')}>Raporlar →</button>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:12}}>
          {unitSummary.map(u => (
            <div key={u.name} style={{
              padding:'14px 16px', borderRadius:10, border:'1px solid var(--border)', background:'var(--surface)',
              cursor:'pointer', transition:'all 0.15s',
            }}
              onClick={() => onNavigate('reports')}
              onMouseEnter={e => e.currentTarget.style.borderColor='var(--blue)'}
              onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}
            >
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:10}}>
                <span style={{fontSize:18}}>{u.icon}</span>
                <span style={{fontWeight:700, fontSize:14, color:'var(--text)'}}>{u.name}</span>
              </div>
              {/* Progress bar */}
              <div style={{height:6, background:'#e5e7eb', borderRadius:3, marginBottom:8, overflow:'hidden'}}>
                <div style={{height:'100%', width:`${u.pct}%`, background: u.pct >= 80 ? 'var(--green)' : u.pct >= 50 ? 'var(--blue)' : 'var(--orange)', borderRadius:3, transition:'width 0.3s'}} />
              </div>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:11.5, color:'var(--text-muted)'}}>
                <span>{u.done}/{u.total} görev</span>
                <span>{u.overdueCount > 0 ? <span style={{color:'var(--red)', fontWeight:600}}>{u.overdueCount} gecikmiş</span> : <span style={{color:'var(--green)'}}>Yolunda</span>}</span>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-muted)', marginTop:4}}>
                <span>👥 {u.personnel} personel</span>
                <span>📝 {u.logsToday}/{u.personnel} bugün kayıt</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-2">
        {/* ACIL DEADLINE'LAR */}
        <div className="card" style={{gridColumn: topDeadlines.length > 4 ? '1/3' : '1/2'}}>
          <div className="section-header">
            <div className="section-title"><span className="section-dot red" />Acil Deadlinelar</div>
            <button className="btn btn-outline btn-sm" onClick={() => onNavigate('deadlines')}>Tümü →</button>
          </div>
          {topDeadlines.length === 0 ? (
            <EmptyState icon="✅" title="Bu hafta acil deadline yok" />
          ) : (
            <table className="data-table">
              <thead><tr><th>Görev</th><th>Birim</th><th>Sahip</th><th>Kalan</th></tr></thead>
              <tbody>
                {topDeadlines.map((d, i) => {
                  const days = daysLeft(d.due_date);
                  const unit = UNITS[d.unit] || {};
                  return (
                    <tr key={d.id} className={i % 2 === 1 ? 'row-alt' : ''} style={{cursor:'pointer'}} onClick={() => onNavigate('deadlines')}>
                      <td><strong style={{color:'var(--text)'}}>{d.title}</strong></td>
                      <td><span className={`unit-chip ${unit.color || ''}`}>{unit.icon} {d.unit}</span></td>
                      <td style={{color:'var(--text-muted)', fontSize:13}}>{d.owner}</td>
                      <td><span className={daysClass(days)} style={{fontWeight:600}}>{daysLabel(days)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* DONÖR PULSE */}
        <div className="card">
          <div className="section-header">
            <div className="section-title"><span className="section-dot orange" />Donör Pulse</div>
            <button className="btn btn-outline btn-sm" onClick={() => onNavigate('donors')}>CRM →</button>
          </div>
          {donors.length === 0 ? (
            <EmptyState icon="🤝" title="Donör verisi yok" />
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {donors.map(d => {
                const repDays = d.reporting_deadline ? daysLeft(d.reporting_deadline) : null;
                return (
                  <div key={d.id} onClick={() => onNavigate('donors')} style={{
                    padding:'10px 12px', borderRadius:8, cursor:'pointer',
                    border:'1px solid var(--border)', background:'var(--surface)',
                    display:'flex', alignItems:'center', gap:10, transition:'background 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--gray-light)'}
                    onMouseLeave={e => e.currentTarget.style.background='var(--surface)'}
                  >
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600, fontSize:13}}>{d.name}</div>
                      <div style={{fontSize:11, color:'var(--text-muted)', marginTop:2}}>
                        {d.account_manager} · Son temas: {d.last_contact || '—'}
                      </div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:12, fontWeight:600, color:
                        d.health?.includes('Strong') ? 'var(--green)' :
                        d.health?.includes('Developing') ? 'var(--orange)' : 'var(--red)'
                      }}>{HEALTH_TR[d.health] || d.health}</div>
                      {repDays !== null && (
                        <div className={daysClass(repDays)} style={{fontSize:11, marginTop:2}}>Rapor: {daysLabel(repDays)}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* AÇIK TOPLANTI AKSİYONLARI */}
        <div className="card">
          <div className="section-header">
            <div className="section-title"><span className="section-dot blue" />Açık Aksiyonlar</div>
            <button className="btn btn-outline btn-sm" onClick={() => onNavigate('meetings')}>Tümü →</button>
          </div>
          {openActions.length === 0 ? (
            <EmptyState icon="✅" title="Açık aksiyon yok" />
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {openActions.slice(0, 5).map(a => (
                <div key={a.id} onClick={() => onNavigate('meetings')} style={{
                  padding:'10px 12px', borderRadius:8, cursor:'pointer',
                  border:'1px solid var(--border)', background:'var(--surface)',
                  display:'flex', alignItems:'center', gap:10, transition:'background 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--gray-light)'}
                  onMouseLeave={e => e.currentTarget.style.background='var(--surface)'}
                >
                  <div style={{flex:1}}>
                    <div style={{fontSize:13, fontWeight:500}}>{a.action_item}</div>
                    <div style={{fontSize:11, color:'var(--text-muted)', marginTop:2}}>{a.meeting_type} · {a.owner}</div>
                  </div>
                  {a.due_date && <span className={daysClass(daysLeft(a.due_date))} style={{fontSize:11, flexShrink:0}}>{daysLabel(daysLeft(a.due_date))}</span>}
                </div>
              ))}
              {openActions.length > 5 && <div style={{textAlign:'center',fontSize:12,color:'var(--text-muted)',padding:4}}>+{openActions.length - 5} daha…</div>}
            </div>
          )}
        </div>

        {/* AI PANEL */}
        <AIPanel role={role} onNavigate={onNavigate} />
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // KOORDİNATÖR DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════
  if (isKoordinator) return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Günaydın{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h1>
        <p className="page-date">{todayStrF}</p>
        <p className="page-subtitle" style={{marginTop:6}}>{getSubtitle()}</p>
      </div>

      {/* KPI'lar */}
      <div className="kpi-grid">
        <KPI label="Birim Görevleri" value={unitTasks.length} sub={`${myUnit || 'birim'} ↗`} color="blue" onClick={() => onNavigate('agendas')} />
        <KPI label="Bekleyen" value={unitPending.length} sub="devam ediyor ↗" color="orange" onClick={() => onNavigate('agendas')} />
        <KPI label="Tamamlanan" value={unitCompleted.length} sub="görev ↗" color="green" onClick={() => onNavigate('agendas')} />
        <KPI label="Onay Bekleyen" value={pendingReview.length} sub="görev ↗" color="navy" onClick={() => onNavigate('agendas')} />
        <KPI label="Bugün Kayıt" value={hasLogToday ? '✅' : '✗'} sub={hasLogToday ? 'girildi' : 'girilmedi'} color={hasLogToday ? 'green' : 'red'} onClick={() => onNavigate('dailylog')} />
      </div>

      <div className="grid-2">
        {/* PERSONEL DURUMU */}
        <div className="card">
          <div className="section-header">
            <div className="section-title"><span className="section-dot blue" />Personel Durumu</div>
            <button className="btn btn-outline btn-sm" onClick={() => onNavigate('logsviewer')}>Detay →</button>
          </div>
          {unitProfiles.length === 0 ? (
            <EmptyState icon="👥" title="Personel bulunamadı" />
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {unitProfiles.map(p => {
                const log = teamLogMap[p.user_id];
                const hasLog = !!log;
                const status = log?.work_status;
                const statusLabels = { ofis:'🏢 Ofiste', ev:'🏠 Evden', saha:'🗺️ Sahada', saglik_izni:'🏥 Sağlık İzni', egitim_izni:'📚 Eğitim', yillik_izin:'🏖️ İzinli', calismiyor:'⬜ Çalışmıyor' };
                const color = avatarColor(p.full_name || '');
                return (
                  <div key={p.user_id} style={{
                    padding:'10px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)',
                    display:'flex', alignItems:'center', gap:10,
                  }}>
                    <div style={{
                      width:32, height:32, borderRadius:'50%', background:color, color:'white',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0,
                    }}>
                      {(p.full_name || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13, fontWeight:600, color:'var(--text)'}}>{p.full_name}</div>
                      <div style={{fontSize:11, color:'var(--text-muted)'}}>{ROLE_LABELS[p.role] || p.role}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      {hasLog ? (
                        <span style={{fontSize:12, color:'var(--green)', fontWeight:600}}>{statusLabels[status] || '✅ Kayıt var'}</span>
                      ) : (
                        <span style={{fontSize:12, color:'var(--red)', fontWeight:500}}>❌ Kayıt yok</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* GÖREVLER — BİRİM */}
        <TaskList
          tasks={unitPending.filter(t => t.due_date).sort((a,b) => new Date(a.due_date) - new Date(b.due_date))}
          title="Yaklaşan Görevler"
          icon="📋"
          emptyMsg="Bekleyen görev yok"
          onNavigate={onNavigate}
          showUnit={false}
        />

        {/* BENİM GÖREVLERİM */}
        <TaskList
          tasks={myPendingTasks}
          title="Benim Görevlerim"
          icon="📌"
          emptyMsg="Aktif göreviniz yok"
          onNavigate={onNavigate}
          showUnit={false}
        />

        {/* AI PANEL */}
        <AIPanel role={role} onNavigate={onNavigate} />
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSONEL DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Günaydın{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h1>
        <p className="page-date">{todayStrF}</p>
        <p className="page-subtitle" style={{marginTop:6}}>{getSubtitle()}</p>
      </div>

      {/* KPI'lar */}
      <div className="kpi-grid">
        <KPI label="Görevlerim" value={myPendingTasks.length} sub="aktif ↗" color="blue" onClick={() => onNavigate('agendas')} />
        <KPI label="Yaklaşan" value={myUrgentTasks.length} sub="bu hafta ↗" color="orange" onClick={() => onNavigate('agendas')} />
        <KPI label="Gecikmiş" value={myOverdueTasks.length} sub="görev ↗" color="red" onClick={() => onNavigate('agendas')} />
        <KPI label="Bugün Kayıt" value={hasLogToday ? '✅' : '✗'} sub={hasLogToday ? 'girildi' : 'girilmedi'} color={hasLogToday ? 'green' : 'red'} onClick={() => onNavigate('dailylog')} />
      </div>

      {/* İŞ KAYDI DURUMU */}
      <div className="card" onClick={() => onNavigate('dailylog')} style={{cursor:'pointer', marginBottom:0}}>
        <div className="section-header">
          <div className="section-title"><span className="section-dot" style={{background: hasLogToday ? 'var(--green)' : 'var(--red)'}} />Bugünkü İş Kaydı</div>
          <button className="btn btn-outline btn-sm">{hasLogToday ? 'Düzenle →' : 'Kayıt Gir →'}</button>
        </div>
        {hasLogToday ? (
          <div style={{display:'flex', gap:16, alignItems:'center', padding:'4px 0'}}>
            <div style={{padding:'6px 12px', borderRadius:8, background:'rgba(22,163,74,0.08)', border:'1px solid rgba(22,163,74,0.2)'}}>
              <span style={{fontSize:13, color:'var(--green)', fontWeight:600}}>
                {todayLog.work_status === 'ofis' ? '🏢 Ofisten' : todayLog.work_status === 'ev' ? '🏠 Evden' : todayLog.work_status === 'saha' ? '🗺️ Sahadan' : '✅ Kayıt mevcut'}
              </span>
            </div>
            <span style={{fontSize:12, color:'var(--text-muted)'}}>
              {(todayLog.work_items || []).length} iş kalemi
              {todayLog.is_submitted ? ' · 📤 Gönderildi' : ' · 📝 Taslak'}
            </span>
          </div>
        ) : (
          <div style={{padding:'12px 0', color:'var(--text-muted)', fontSize:13}}>
            Bugün henüz iş kaydı girmediniz. Tıklayarak kayıt oluşturun.
          </div>
        )}
      </div>

      <div className="grid-2">
        {/* GÖREVLERİM */}
        <TaskList
          tasks={myPendingTasks.sort((a,b) => {
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return new Date(a.due_date) - new Date(b.due_date);
          })}
          title="Görevlerim"
          icon="📌"
          emptyMsg="Aktif göreviniz yok"
          onNavigate={onNavigate}
          showUnit={true}
        />

        {/* GÜNDEMLER — BANA ATANAN */}
        <div className="card">
          <div className="section-header">
            <div className="section-title"><span className="section-dot orange" />Atanan Gündemler</div>
            <button className="btn btn-outline btn-sm" onClick={() => onNavigate('agendas')}>Tümü →</button>
          </div>
          {(() => {
            const myAgendas = (agendas || []).filter(a =>
              a.assigned_to === myId ||
              (a.agenda_tasks || []).some(t => t.assigned_to === myId)
            ).filter(a => a.status !== 'tamamlandi' && a.status !== 'arsiv');
            if (myAgendas.length === 0) return <EmptyState icon="📋" title="Atanan gündem yok" />;
            return (
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {myAgendas.slice(0, 6).map(a => {
                  const taskCount = (a.agenda_tasks || []).length;
                  const doneCount = (a.agenda_tasks || []).filter(t => t.status === 'tamamlandi' || t.completion_status === 'approved').length;
                  return (
                    <div key={a.id} onClick={() => onNavigate('agendas')} style={{
                      padding:'10px 12px', borderRadius:8, cursor:'pointer',
                      border:'1px solid var(--border)', background:'var(--surface)',
                      transition:'background 0.15s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--gray-light)'}
                      onMouseLeave={e => e.currentTarget.style.background='var(--surface)'}
                    >
                      <div style={{fontSize:13, fontWeight:600, color:'var(--text)'}}>{a.title}</div>
                      <div style={{fontSize:11.5, color:'var(--text-muted)', marginTop:3, display:'flex', gap:8}}>
                        <span>{a.agenda_types?.icon} {a.agenda_types?.name}</span>
                        {taskCount > 0 && <span>· {doneCount}/{taskCount} görev</span>}
                        {a.date && <span>· {format(new Date(a.date), 'd MMM', { locale: tr })}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* AI PANEL */}
        <AIPanel role={role} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
