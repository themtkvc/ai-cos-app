import React, { useState, useEffect } from 'react';
import { getDeadlines, createDeadline, updateDeadline, deleteDeadline } from '../lib/supabase';
import { differenceInCalendarDays } from 'date-fns';

const UNITS = ['Partnerships','Humanitarian Affairs','Traditional Donors','Grants','Accreditations','Policy & Governance','Director'];
const OWNERS = ['Director','Hatice','Gülsüm','Murat','Yasir','Yavuz','Sezgin'];
const PRIORITIES = ['🔴 Critical','🟠 High','🟡 Medium','🟢 Low'];
const STATUSES = ['⚪ Not Started','🔵 In Progress','✅ Completed','🔴 Overdue'];
const DONORS = ['WFP','OCHA','Habitat for Humanity','Good Neighbors','—'];
const UNIT_COLORS = {
  'Partnerships':'unit-partnerships','Humanitarian Affairs':'unit-humanitarian',
  'Traditional Donors':'unit-traditional-donors','Grants':'unit-grants',
  'Accreditations':'unit-accreditations','Policy & Governance':'unit-policy','Director':'unit-director'
};

function daysLeft(date) { return differenceInCalendarDays(new Date(date), new Date()); }
function daysClass(d) {
  if (d < 0) return 'days-overdue'; if (d <= 3) return 'days-urgent';
  if (d <= 7) return 'days-soon'; return 'days-ok';
}
function daysLabel(d) {
  if (d < 0) return `${Math.abs(d)}g gecikmiş`; if (d === 0) return 'Bugün!';
  if (d === 1) return 'Yarın'; return `${d}g kaldı`;
}

const EMPTY = { title:'', category:'', unit:'', owner:'Director', due_date:'', priority:'🟠 High', status:'⚪ Not Started', donor:'', notes:'' };

export default function Deadlines({ user, onNavigate }) {
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [filter, setFilter] = useState({ unit:'', priority:'', status:'', search:'' });
  const [saving, setSaving] = useState(false);

  const load = () => getDeadlines(user.id).then(({ data }) => { setDeadlines(data || []); setLoading(false); });
  useEffect(() => { load(); }, [user]);

  const filtered = deadlines.filter(d => {
    if (filter.unit && d.unit !== filter.unit) return false;
    if (filter.priority && d.priority !== filter.priority) return false;
    if (filter.status && d.status !== filter.status) return false;
    if (filter.search && !d.title?.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  const openNew = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = (d) => { setForm({ ...d }); setEditId(d.id); setModal(true); };
  const closeModal = () => { setModal(false); setForm(EMPTY); setEditId(null); };

  const save = async () => {
    if (!form.title || !form.due_date) return;
    setSaving(true);
    if (editId) await updateDeadline(editId, form);
    else await createDeadline({ ...form, user_id: user.id });
    await load();
    closeModal();
    setSaving(false);
  };

  const remove = async (id) => {
    if (!window.confirm('Bu görevi silmek istediğinizden emin misiniz?')) return;
    await deleteDeadline(id);
    load();
  };

  const quickStatus = async (id, status) => {
    await updateDeadline(id, { status });
    load();
  };

  const active = deadlines.filter(d => d.status !== '✅ Completed');
  const overdue = active.filter(d => daysLeft(d.due_date) < 0);
  const urgent = active.filter(d => { const n = daysLeft(d.due_date); return n >= 0 && n <= 7; });

  if (loading) return <div style={{padding:40,color:'var(--text-muted)'}}>Yükleniyor…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <h1 className="page-title">📅 Görevler & Tarihler</h1>
            <p className="page-subtitle">{active.length} aktif görev · {overdue.length} gecikmiş · {urgent.length} bu hafta</p>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-outline btn-sm"
              onClick={() => onNavigate('chat', { initialMessage: 'Kritik görevleri ve gecikmeleri analiz et, bana acil eylem planı hazırla' })}>
              🤖 AI ile analiz et
            </button>
            <button className="btn btn-primary" onClick={openNew}>+ Yeni Görev</button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
        <div className="kpi-card red"><div className="kpi-label">Gecikmiş</div><div className="kpi-value">{overdue.length}</div></div>
        <div className="kpi-card orange"><div className="kpi-label">Bu Hafta</div><div className="kpi-value">{urgent.length}</div></div>
        <div className="kpi-card blue"><div className="kpi-label">Devam Eden</div><div className="kpi-value">{deadlines.filter(d=>d.status==='🔵 In Progress').length}</div></div>
        <div className="kpi-card green"><div className="kpi-label">Tamamlandı</div><div className="kpi-value">{deadlines.filter(d=>d.status==='✅ Completed').length}</div></div>
      </div>

      {/* Filters */}
      <div className="card" style={{marginBottom:16,padding:'14px 16px'}}>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
          <input className="form-input" style={{width:220}} placeholder="🔍 Görev ara..." value={filter.search} onChange={e=>setFilter(f=>({...f,search:e.target.value}))} />
          <select className="form-select" style={{width:180}} value={filter.unit} onChange={e=>setFilter(f=>({...f,unit:e.target.value}))}>
            <option value="">Tüm Birimler</option>
            {UNITS.map(u=><option key={u}>{u}</option>)}
          </select>
          <select className="form-select" style={{width:150}} value={filter.priority} onChange={e=>setFilter(f=>({...f,priority:e.target.value}))}>
            <option value="">Tüm Öncelikler</option>
            {PRIORITIES.map(p=><option key={p}>{p}</option>)}
          </select>
          <select className="form-select" style={{width:160}} value={filter.status} onChange={e=>setFilter(f=>({...f,status:e.target.value}))}>
            <option value="">Tüm Durumlar</option>
            {STATUSES.map(s=><option key={s}>{s}</option>)}
          </select>
          {(filter.unit||filter.priority||filter.status||filter.search) && (
            <button className="btn btn-outline btn-sm" onClick={()=>setFilter({unit:'',priority:'',status:'',search:''})}>✕ Temizle</button>
          )}
          <span style={{marginLeft:'auto',fontSize:12,color:'var(--text-muted)'}}>{filtered.length} sonuç</span>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{padding:0,overflow:'hidden'}}>
        {filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">📭</div><div className="empty-state-title">Görev bulunamadı</div></div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Görev</th><th>Birim</th><th>Sahibi</th><th>Donör</th>
                  <th>Son Tarih</th><th>Öncelik</th><th>Durum</th><th>Kalan</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => {
                  const days = daysLeft(d.due_date);
                  return (
                    <tr key={d.id} className={i % 2 === 1 ? 'row-alt' : ''}>
                      <td>
                        <div style={{fontWeight:600,color:'var(--text)',maxWidth:280}}>{d.title}</div>
                        {d.notes && <div style={{fontSize:11.5,color:'var(--text-muted)',marginTop:2}}>{d.notes.slice(0,60)}{d.notes.length>60?'…':''}</div>}
                      </td>
                      <td><span className={`unit-chip ${UNIT_COLORS[d.unit]||''}`}>{d.unit}</span></td>
                      <td style={{color:'var(--text-muted)',fontSize:13}}>{d.owner}</td>
                      <td style={{color:'var(--text-muted)',fontSize:13}}>{d.donor && d.donor !== '—' ? d.donor : '—'}</td>
                      <td style={{fontSize:13,fontWeight:500}}>{d.due_date}</td>
                      <td><span style={{fontSize:13}}>{d.priority}</span></td>
                      <td>
                        <select
                          value={d.status}
                          onChange={e=>quickStatus(d.id,e.target.value)}
                          style={{border:'none',background:'transparent',fontSize:13,cursor:'pointer',color:
                            d.status==='✅ Completed'?'var(--green)':
                            d.status==='🔵 In Progress'?'var(--blue)':'var(--text-muted)'
                          }}
                        >
                          {STATUSES.map(s=><option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td><span className={daysClass(days)} style={{fontSize:13,fontWeight:600}}>{daysLabel(days)}</span></td>
                      <td>
                        <div style={{display:'flex',gap:6}}>
                          <button className="btn btn-outline btn-sm btn-icon" onClick={()=>openEdit(d)} title="Düzenle">✏️</button>
                          <button className="btn btn-outline btn-sm btn-icon" onClick={()=>remove(d.id)} title="Sil" style={{color:'var(--red)'}}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) closeModal(); }}>
          <div className="modal">
            <h2 className="modal-title">{editId ? '✏️ Görevi Düzenle' : '+ Yeni Görev Ekle'}</h2>
            <div className="form-group">
              <label className="form-label">Görev Başlığı *</label>
              <input className="form-input" placeholder="Görev açıklaması..." value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Birim</label>
                <select className="form-select" value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}>
                  <option value="">Seçin...</option>
                  {UNITS.map(u=><option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Sahibi</label>
                <select className="form-select" value={form.owner} onChange={e=>setForm(f=>({...f,owner:e.target.value}))}>
                  {OWNERS.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Son Tarih *</label>
                <input className="form-input" type="date" value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Donör</label>
                <select className="form-select" value={form.donor} onChange={e=>setForm(f=>({...f,donor:e.target.value}))}>
                  {DONORS.map(d=><option key={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Öncelik</label>
                <select className="form-select" value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
                  {PRIORITIES.map(p=><option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Durum</label>
                <select className="form-select" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  {STATUSES.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notlar</label>
              <textarea className="form-textarea" placeholder="Ek notlar..." value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeModal}>İptal</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? '⏳ Kaydediliyor...' : editId ? 'Güncelle' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
