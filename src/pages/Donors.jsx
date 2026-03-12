import React, { useState, useEffect } from 'react';
import { getDonors, updateDonor, getInteractions, createInteraction, createDonor, deleteDonor } from '../lib/supabase';

const DONOR_COLORS = {
  'WFP': { bg:'#009EDB', text:'white', icon:'🌾' },
  'OCHA': { bg:'#0066CC', text:'white', icon:'🌐' },
  'Habitat for Humanity': { bg:'#E8622A', text:'white', icon:'🏠' },
  'Good Neighbors': { bg:'#2E7D32', text:'white', icon:'🤝' },
};
const HEALTH_OPTIONS = ['🟢 Strong','🟡 Developing','🔴 At Risk'];
const PRIORITY_OPTIONS = ['🔴 Critical','🟠 High','🟡 Medium','🟢 Low'];
const TYPE_OPTIONS = ['UN Agency','INGO Partner','Bilateral Donor','Foundation','Government','Other'];

const DONOR_EMPTY = {
  name:'', type:'INGO Partner', health:'🟢 Strong', account_manager:'',
  last_contact:'', next_followup:'', reporting_deadline:'',
  active_engagements:'', priority:'🟠 High', notes:''
};

export default function Donors({ user, onNavigate }) {
  const [donors, setDonors] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [interactionModal, setInteractionModal] = useState(false);
  const [donorModal, setDonorModal] = useState(false);
  const [donorForm, setDonorForm] = useState(DONOR_EMPTY);
  const [editDonorId, setEditDonorId] = useState(null);
  const [intForm, setIntForm] = useState({ interaction_date: new Date().toISOString().slice(0,10), type:'Meeting', participants:'', key_points:'', followup_required:'' });
  const [editingHealth, setEditingHealth] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [d, i] = await Promise.all([getDonors(user.id), getInteractions(user.id)]);
    const don = d.data || [];
    setDonors(don);
    setInteractions(i.data || []);
    if (don.length && !selected) setSelected(don[0]);
    else if (selected) {
      // refresh selected
      const refreshed = don.find(x => x.id === selected.id);
      if (refreshed) setSelected(refreshed);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const selectedInteractions = interactions.filter(i => i.donor_id === selected?.id || i.donor_name === selected?.name);

  const saveInteraction = async () => {
    if (!selected || !intForm.key_points) return;
    setSaving(true);
    await createInteraction({ ...intForm, user_id: user.id, donor_id: selected.id, donor_name: selected.name });
    await load();
    setInteractionModal(false);
    setIntForm({ interaction_date: new Date().toISOString().slice(0,10), type:'Meeting', participants:'', key_points:'', followup_required:'' });
    setSaving(false);
  };

  const updateHealth = async (id, health) => {
    await updateDonor(id, { health });
    setEditingHealth(null);
    load();
  };

  const openNewDonor = () => {
    setDonorForm(DONOR_EMPTY);
    setEditDonorId(null);
    setDonorModal(true);
  };

  const openEditDonor = (d) => {
    setDonorForm({ ...d });
    setEditDonorId(d.id);
    setDonorModal(true);
  };

  const saveDonor = async () => {
    if (!donorForm.name) return;
    setSaving(true);
    if (editDonorId) {
      await updateDonor(editDonorId, donorForm);
    } else {
      const { data } = await createDonor({ ...donorForm, user_id: user.id });
      if (data?.[0]) setSelected(data[0]);
    }
    await load();
    setDonorModal(false);
    setSaving(false);
  };

  const removeDonor = async (id) => {
    if (!window.confirm('Bu donörü ve tüm etkileşim geçmişini silmek istediğinizden emin misiniz?')) return;
    await deleteDonor(id);
    setSelected(null);
    load();
  };

  if (loading) return <div style={{padding:40,color:'var(--text-muted)'}}>Yükleniyor…</div>;

  const col = selected ? (DONOR_COLORS[selected.name] || { bg:'var(--navy)', text:'white', icon:'🤝' }) : {};

  return (
    <div className="page">
      <div className="page-header">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <h1 className="page-title">🤝 Donör CRM</h1>
            <p className="page-subtitle">{donors.length} aktif donör · {interactions.length} etkileşim kaydı</p>
          </div>
          <div style={{display:'flex',gap:8}}>
            {selected && (
              <button className="btn btn-outline btn-sm"
                onClick={() => onNavigate('chat', { initialMessage: `${selected.name} donörü için ilişki durumunu özetle ve aksiyon öner` })}>
                🤖 AI ile analiz
              </button>
            )}
            <button className="btn btn-primary" onClick={openNewDonor}>+ Yeni Donör</button>
          </div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'260px 1fr',gap:16}}>
        {/* Donor list */}
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {donors.map(d => {
            const c = DONOR_COLORS[d.name] || { bg:'var(--navy)', icon:'🤝' };
            const isSel = selected?.id === d.id;
            return (
              <div
                key={d.id}
                onClick={() => setSelected(d)}
                style={{
                  cursor:'pointer', borderRadius:10,
                  border: isSel ? `2px solid ${c.bg}` : '1px solid var(--border)',
                  overflow:'hidden', transition:'all 0.15s',
                  boxShadow: isSel ? `0 4px 16px ${c.bg}33` : 'var(--shadow-sm)',
                }}
              >
                <div style={{background:c.bg,padding:'12px 14px',display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:22}}>{c.icon}</span>
                  <div>
                    <div style={{fontWeight:700,color:'white',fontSize:14}}>{d.name}</div>
                    <div style={{fontSize:11,color:'rgba(255,255,255,0.7)'}}>{d.type}</div>
                  </div>
                </div>
                <div style={{padding:'10px 14px',background:'white'}}>
                  <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:4}}>
                    Yönetici: <strong style={{color:'var(--text)'}}>{d.account_manager || '—'}</strong>
                  </div>
                  <div style={{fontSize:12,fontWeight:600,color:
                    d.health?.includes('Strong')?'var(--green)':d.health?.includes('Developing')?'var(--orange)':'var(--red)'
                  }}>{d.health}</div>
                </div>
              </div>
            );
          })}
          {donors.length === 0 && (
            <div className="empty-state" style={{padding:24}}>
              <div className="empty-state-icon">🤝</div>
              <div className="empty-state-title">Donör yok</div>
              <div className="empty-state-sub">+ Yeni Donör ile başlayın</div>
            </div>
          )}
        </div>

        {/* Donor detail */}
        {selected && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            {/* Header */}
            <div style={{background:col.bg,borderRadius:12,padding:'20px 24px',display:'flex',alignItems:'center',gap:16}}>
              <span style={{fontSize:36}}>{col.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:'var(--font-display)',fontSize:24,fontWeight:700,color:'white'}}>{selected.name}</div>
                <div style={{fontSize:13,color:'rgba(255,255,255,0.75)',marginTop:2}}>
                  {selected.type} · Hesap Yöneticisi: {selected.account_manager || '—'}
                </div>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                {editingHealth === selected.id ? (
                  <select
                    autoFocus
                    className="form-select"
                    style={{width:160,background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',color:'white'}}
                    defaultValue={selected.health}
                    onChange={e=>updateHealth(selected.id,e.target.value)}
                    onBlur={()=>setEditingHealth(null)}
                  >
                    {HEALTH_OPTIONS.map(h=><option key={h} style={{color:'black'}}>{h}</option>)}
                  </select>
                ) : (
                  <div
                    onClick={()=>setEditingHealth(selected.id)}
                    style={{fontSize:15,fontWeight:700,color:'white',cursor:'pointer',padding:'6px 12px',
                      background:'rgba(255,255,255,0.15)',borderRadius:8,border:'1px solid rgba(255,255,255,0.2)'}}
                    title="Tıkla ve düzenle"
                  >
                    {selected.health}
                  </div>
                )}
                <button
                  onClick={() => openEditDonor(selected)}
                  style={{padding:'6px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,0.2)',
                    background:'rgba(255,255,255,0.1)',color:'white',cursor:'pointer',fontSize:12}}
                >
                  ✏️ Düzenle
                </button>
                <button
                  onClick={() => removeDonor(selected.id)}
                  style={{padding:'6px 12px',borderRadius:8,border:'1px solid rgba(255,0,0,0.3)',
                    background:'rgba(255,0,0,0.15)',color:'#fca5a5',cursor:'pointer',fontSize:12}}
                >
                  🗑
                </button>
              </div>
            </div>

            {/* Meta grid */}
            <div className="card">
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                <div className="card-title" style={{marginBottom:0}}>📊 İlişki Özeti</div>
                <button className="btn btn-outline btn-sm"
                  onClick={() => onNavigate('chat', { initialMessage: `${selected.name} için iletişim stratejisi ve sonraki adımlar neler olmalı?` })}>
                  🤖 Strateji öner
                </button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
                {[
                  ['Son Temas', selected.last_contact || '—'],
                  ['Sonraki Follow-up', selected.next_followup || '—'],
                  ['Raporlama Tarihi', selected.reporting_deadline || '—'],
                  ['Aktif Çalışmalar', selected.active_engagements || '—'],
                  ['Öncelik', selected.priority || '—'],
                  ['Notlar', selected.notes || '—'],
                ].map(([l,v]) => (
                  <div key={l} style={{padding:'10px 12px',background:'var(--surface)',borderRadius:8,border:'1px solid var(--border)'}}>
                    <div style={{fontSize:11,color:'var(--text-muted)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:4}}>{l}</div>
                    <div style={{fontSize:13,fontWeight:500,color:'var(--text)'}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactions */}
            <div className="card">
              <div className="section-header">
                <div className="card-title" style={{marginBottom:0}}>
                  📝 Etkileşim Geçmişi ({selectedInteractions.length})
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button className="btn btn-outline btn-sm"
                    onClick={() => onNavigate('chat', { initialMessage: `${selected.name} ile son toplantı için follow-up email taslağı yaz` })}>
                    🤖 Follow-up email yaz
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={()=>setInteractionModal(true)}>+ Ekle</button>
                </div>
              </div>
              {selectedInteractions.length === 0 ? (
                <div className="empty-state" style={{padding:'24px'}}>
                  <div className="empty-state-icon">📭</div>
                  <div>Henüz etkileşim eklenmemiş</div>
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:12}}>
                  {selectedInteractions.map((int, i) => (
                    <div key={int.id} style={{
                      padding:'12px 14px',borderRadius:8,
                      background:i%2===0?'var(--surface)':'white',
                      border:'1px solid var(--border)'
                    }}>
                      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                        <span className="badge badge-blue">{int.type}</span>
                        <span style={{fontSize:12,color:'var(--text-muted)'}}>{int.interaction_date}</span>
                        {int.participants && <span style={{fontSize:12,color:'var(--text-muted)'}}>· {int.participants}</span>}
                      </div>
                      <div style={{fontSize:13,color:'var(--text)',lineHeight:1.5}}>{int.key_points}</div>
                      {int.followup_required && (
                        <div style={{fontSize:12,color:'var(--orange)',marginTop:6,fontWeight:500}}>
                          → Follow-up: {int.followup_required}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Interaction modal */}
      {interactionModal && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setInteractionModal(false);}}>
          <div className="modal">
            <h2 className="modal-title">📝 Yeni Etkileşim — {selected?.name}</h2>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Tarih</label>
                <input className="form-input" type="date" value={intForm.interaction_date} onChange={e=>setIntForm(f=>({...f,interaction_date:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Tür</label>
                <select className="form-select" value={intForm.type} onChange={e=>setIntForm(f=>({...f,type:e.target.value}))}>
                  {['Meeting','Call','Email','Site Visit','Report Submission','Other'].map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Katılımcılar</label>
              <input className="form-input" placeholder="Kimler vardı?" value={intForm.participants} onChange={e=>setIntForm(f=>({...f,participants:e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Ana Noktalar *</label>
              <textarea className="form-textarea" placeholder="Ne konuşuldu, ne kararlaştırıldı?" value={intForm.key_points} onChange={e=>setIntForm(f=>({...f,key_points:e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Follow-up Gerekli mi?</label>
              <input className="form-input" placeholder="Varsa follow-up aksiyonu..." value={intForm.followup_required} onChange={e=>setIntForm(f=>({...f,followup_required:e.target.value}))} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={()=>setInteractionModal(false)}>İptal</button>
              <button className="btn btn-primary" onClick={saveInteraction} disabled={saving}>
                {saving ? '⏳ Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New/Edit Donor modal */}
      {donorModal && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setDonorModal(false);}}>
          <div className="modal">
            <h2 className="modal-title">{editDonorId ? '✏️ Donörü Düzenle' : '+ Yeni Donör Ekle'}</h2>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Donör Adı *</label>
                <input className="form-input" placeholder="Örn: UNICEF" value={donorForm.name} onChange={e=>setDonorForm(f=>({...f,name:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Tür</label>
                <select className="form-select" value={donorForm.type} onChange={e=>setDonorForm(f=>({...f,type:e.target.value}))}>
                  {TYPE_OPTIONS.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Hesap Yöneticisi</label>
                <input className="form-input" placeholder="Koordinatör adı" value={donorForm.account_manager} onChange={e=>setDonorForm(f=>({...f,account_manager:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">İlişki Sağlığı</label>
                <select className="form-select" value={donorForm.health} onChange={e=>setDonorForm(f=>({...f,health:e.target.value}))}>
                  {HEALTH_OPTIONS.map(h=><option key={h}>{h}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Son Temas</label>
                <input className="form-input" type="date" value={donorForm.last_contact} onChange={e=>setDonorForm(f=>({...f,last_contact:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Sonraki Follow-up</label>
                <input className="form-input" type="date" value={donorForm.next_followup} onChange={e=>setDonorForm(f=>({...f,next_followup:e.target.value}))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Raporlama Tarihi</label>
                <input className="form-input" type="date" value={donorForm.reporting_deadline} onChange={e=>setDonorForm(f=>({...f,reporting_deadline:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Öncelik</label>
                <select className="form-select" value={donorForm.priority} onChange={e=>setDonorForm(f=>({...f,priority:e.target.value}))}>
                  {PRIORITY_OPTIONS.map(p=><option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Aktif Çalışmalar</label>
              <input className="form-input" placeholder="Devam eden projeler, raporlar..." value={donorForm.active_engagements} onChange={e=>setDonorForm(f=>({...f,active_engagements:e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Notlar</label>
              <textarea className="form-textarea" placeholder="Ek notlar..." value={donorForm.notes} onChange={e=>setDonorForm(f=>({...f,notes:e.target.value}))} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={()=>setDonorModal(false)}>İptal</button>
              <button className="btn btn-primary" onClick={saveDonor} disabled={saving}>
                {saving ? '⏳ Kaydediliyor...' : editDonorId ? 'Güncelle' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
