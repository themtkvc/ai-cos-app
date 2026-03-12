import React, { useState, useEffect } from 'react';
import { getMeetingActions, createMeetingAction, updateMeetingAction } from '../lib/supabase';
import { differenceInCalendarDays } from 'date-fns';

const MEETING_TYPES = ['Koordinatörler Toplantısı','Board Toplantısı','1:1 Koordinatör','1:1 Çalışan','1:1 Müdür Yardımcısı','Donör Toplantısı','Diğer'];
const OWNERS = ['Director','Hatice','Gülsüm','Murat','Yasir','Yavuz','Sezgin','Tüm Koordinatörler'];
const STATUSES = ['⚪ Not Started','🔵 In Progress','✅ Completed','🔴 Overdue'];

function daysLeft(date) { return differenceInCalendarDays(new Date(date), new Date()); }
function daysClass(d) {
  if (d < 0) return 'days-overdue'; if (d <= 3) return 'days-urgent';
  if (d <= 7) return 'days-soon'; return 'days-ok';
}
function daysLabel(d) {
  if (d < 0) return `${Math.abs(d)}g gecikmiş`; if (d === 0) return 'Bugün!';
  if (d === 1) return 'Yarın'; return `${d}g kaldı`;
}

const EMPTY = { meeting_type:'Koordinatörler Toplantısı', meeting_date: new Date().toISOString().slice(0,10), action_item:'', owner:'Director', due_date:'', status:'⚪ Not Started', notes:'' };

export default function MeetingLog({ user, onNavigate }) {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [filter, setFilter] = useState({ type:'', owner:'', status:'', showCompleted: false });
  const [saving, setSaving] = useState(false);

  const load = () => getMeetingActions(user.id).then(({ data }) => { setActions(data || []); setLoading(false); });
  useEffect(() => { load(); }, [user]);

  const filtered = actions.filter(a => {
    if (!filter.showCompleted && a.status === '✅ Completed') return false;
    if (filter.type && a.meeting_type !== filter.type) return false;
    if (filter.owner && a.owner !== filter.owner) return false;
    if (filter.status && a.status !== filter.status) return false;
    return true;
  }).sort((a, b) => {
    if (!a.due_date) return 1; if (!b.due_date) return -1;
    return new Date(a.due_date) - new Date(b.due_date);
  });

  const openNew = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = a => { setForm({...a}); setEditId(a.id); setModal(true); };
  const closeModal = () => { setModal(false); setForm(EMPTY); setEditId(null); };

  const save = async () => {
    if (!form.action_item) return;
    setSaving(true);
    if (editId) await updateMeetingAction(editId, form);
    else await createMeetingAction({ ...form, user_id: user.id });
    await load();
    closeModal();
    setSaving(false);
  };

  const quickStatus = async (id, status) => {
    await updateMeetingAction(id, { status });
    load();
  };

  const open = actions.filter(a => a.status !== '✅ Completed');
  const overdue = open.filter(a => a.due_date && daysLeft(a.due_date) < 0);
  const byType = {};
  open.forEach(a => { byType[a.meeting_type] = (byType[a.meeting_type] || 0) + 1; });

  if (loading) return <div style={{padding:40,color:'var(--text-muted)'}}>Yükleniyor…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <h1 className="page-title">📋 Toplantı Aksiyon Logu</h1>
            <p className="page-subtitle">{open.length} açık aksiyon · {overdue.length} gecikmiş</p>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-outline btn-sm"
              onClick={() => onNavigate('chat', { initialMessage: 'Tüm açık toplantı aksiyonlarını özetle, kime ne düşüyor, geciken var mı?' })}>
              🤖 AI özeti
            </button>
            <button className="btn btn-primary" onClick={openNew}>+ Yeni Aksiyon</button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
        <div className="kpi-card red"><div className="kpi-label">Gecikmiş</div><div className="kpi-value">{overdue.length}</div></div>
        <div className="kpi-card orange"><div className="kpi-label">Bu Hafta</div><div className="kpi-value">{open.filter(a=>a.due_date&&daysLeft(a.due_date)<=7&&daysLeft(a.due_date)>=0).length}</div></div>
        <div className="kpi-card blue"><div className="kpi-label">Toplam Açık</div><div className="kpi-value">{open.length}</div></div>
        <div className="kpi-card green"><div className="kpi-label">Tamamlandı</div><div className="kpi-value">{actions.filter(a=>a.status==='✅ Completed').length}</div></div>
      </div>

      {/* By meeting type */}
      {Object.keys(byType).length > 0 && (
        <div className="card" style={{marginBottom:16}}>
          <div className="card-title">Toplantı Türüne Göre Açık Aksiyonlar</div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            {Object.entries(byType).map(([t,n])=>(
              <div key={t} style={{padding:'8px 14px',borderRadius:20,background:'var(--blue-pale)',fontSize:13}}>
                <strong style={{color:'var(--blue)'}}>{n}</strong>
                <span style={{color:'var(--text-muted)',marginLeft:6}}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{marginBottom:16,padding:'14px 16px'}}>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
          <select className="form-select" style={{width:220}} value={filter.type} onChange={e=>setFilter(f=>({...f,type:e.target.value}))}>
            <option value="">Tüm Toplantı Türleri</option>
            {MEETING_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
          <select className="form-select" style={{width:150}} value={filter.owner} onChange={e=>setFilter(f=>({...f,owner:e.target.value}))}>
            <option value="">Tüm Sahipler</option>
            {OWNERS.map(o=><option key={o}>{o}</option>)}
          </select>
          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:'var(--text-muted)',cursor:'pointer'}}>
            <input type="checkbox" checked={filter.showCompleted} onChange={e=>setFilter(f=>({...f,showCompleted:e.target.checked}))} />
            Tamamlananları göster
          </label>
          <span style={{marginLeft:'auto',fontSize:12,color:'var(--text-muted)'}}>{filtered.length} sonuç</span>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{padding:0,overflow:'hidden'}}>
        {filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">✅</div><div className="empty-state-title">Açık aksiyon yok!</div></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Aksiyon</th><th>Toplantı</th><th>Tarih</th><th>Sahibi</th><th>Bitiş</th><th>Durum</th><th>Kalan</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <tr key={a.id} className={i%2===1?'row-alt':''}>
                  <td>
                    <div style={{fontWeight:600,color:'var(--text)',maxWidth:320}}>{a.action_item}</div>
                    {a.notes && <div style={{fontSize:11.5,color:'var(--text-muted)',marginTop:2}}>{a.notes.slice(0,60)}…</div>}
                  </td>
                  <td style={{fontSize:12.5,color:'var(--text-muted)'}}>{a.meeting_type}</td>
                  <td style={{fontSize:12.5,color:'var(--text-muted)'}}>{a.meeting_date}</td>
                  <td style={{fontSize:13,fontWeight:500}}>{a.owner}</td>
                  <td style={{fontSize:13}}>{a.due_date || '—'}</td>
                  <td>
                    <select
                      value={a.status}
                      onChange={e=>quickStatus(a.id,e.target.value)}
                      style={{border:'none',background:'transparent',fontSize:13,cursor:'pointer',color:
                        a.status==='✅ Completed'?'var(--green)':
                        a.status==='🔵 In Progress'?'var(--blue)':'var(--text-muted)'
                      }}
                    >
                      {STATUSES.map(s=><option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td>
                    {a.due_date
                      ? <span className={daysClass(daysLeft(a.due_date))} style={{fontSize:13,fontWeight:600}}>{daysLabel(daysLeft(a.due_date))}</span>
                      : <span style={{color:'var(--text-muted)',fontSize:12}}>—</span>
                    }
                  </td>
                  <td>
                    <button className="btn btn-outline btn-sm btn-icon" onClick={()=>openEdit(a)} title="Düzenle">✏️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)closeModal();}}>
          <div className="modal">
            <h2 className="modal-title">{editId?'✏️ Aksiyonu Düzenle':'+ Yeni Aksiyon'}</h2>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Toplantı Türü</label>
                <select className="form-select" value={form.meeting_type} onChange={e=>setForm(f=>({...f,meeting_type:e.target.value}))}>
                  {MEETING_TYPES.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Toplantı Tarihi</label>
                <input className="form-input" type="date" value={form.meeting_date} onChange={e=>setForm(f=>({...f,meeting_date:e.target.value}))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Aksiyon Maddesi *</label>
              <textarea className="form-textarea" placeholder="Ne yapılacak?" value={form.action_item} onChange={e=>setForm(f=>({...f,action_item:e.target.value}))} style={{minHeight:60}} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Sahibi</label>
                <select className="form-select" value={form.owner} onChange={e=>setForm(f=>({...f,owner:e.target.value}))}>
                  {OWNERS.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Bitiş Tarihi</label>
                <input className="form-input" type="date" value={form.due_date||''} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Durum</label>
              <select className="form-select" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                {STATUSES.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Notlar</label>
              <textarea className="form-textarea" placeholder="Ek bağlam..." value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={{minHeight:50}} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeModal}>İptal</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving?'⏳ Kaydediliyor...':editId?'Güncelle':'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
