import React, { useState, useEffect, useMemo } from 'react';
import { getDonors, updateDonor, getInteractions, createInteraction, createDonor, deleteDonor } from '../lib/supabase';
import { differenceInCalendarDays } from 'date-fns';
import { fmtDisplayDate } from '../lib/constants';
import EmptyState from '../components/EmptyState';

// Donor color mapping for UI
const DONOR_COLORS = {
  'WFP': { bg:'#009EDB', text:'white', icon:'🌾' },
  'OCHA': { bg:'#0066CC', text:'white', icon:'🌐' },
  'Habitat for Humanity': { bg:'#E8622A', text:'white', icon:'🏠' },
  'Good Neighbors': { bg:'#2E7D32', text:'white', icon:'🤝' },
};

// Base options in English (DB values)
const HEALTH_OPTIONS = ['🟢 Strong','🟡 Developing','🔴 At Risk'];
const PRIORITY_OPTIONS = ['🔴 Critical','🟠 High','🟡 Medium','🟢 Low'];
const TYPE_OPTIONS = ['UN Agency','INGO Partner','Bilateral Donor','Foundation','Government','Other'];
const INTERACTION_TYPES = ['Toplantı','Email','Telefon','Etkinlik','Diğer'];

// Turkish translation maps for display
const HEALTH_TR = {
  '🟢 Strong':'🟢 Güçlü',
  '🟡 Developing':'🟡 Gelişiyor',
  '🔴 At Risk':'🔴 Risk Altında'
};

const PRIORITY_TR = {
  '🔴 Critical':'🔴 Kritik',
  '🟠 High':'🟠 Yüksek',
  '🟡 Medium':'🟡 Orta',
  '🟢 Low':'🟢 Düşük'
};

const TYPE_TR = {
  'UN Agency':'BM Ajansı',
  'INGO Partner':'INGO Ortağı',
  'Bilateral Donor':'İkili Donör',
  'Foundation':'Vakıf',
  'Government':'Kamu',
  'Other':'Diğer'
};

// Helper to translate display values while preserving DB values
const trD = (val, map) => map[val] || val;

// Default form states
const DONOR_EMPTY = {
  name:'',
  type:'INGO Partner',
  health:'🟢 Strong',
  account_manager:'',
  last_contact:'',
  next_followup:'',
  reporting_deadline:'',
  active_engagements:'',
  priority:'🟠 High',
  notes:''
};

const INTERACTION_EMPTY = {
  interaction_date: new Date().toISOString().slice(0,10),
  type:'Toplantı',
  participants:'',
  key_points:'',
  followup_required:''
};

export default function Donors({ user, profile, onNavigate }) {
  // State management
  const [donors, setDonors] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [donorModal, setDonorModal] = useState(false);
  const [donorForm, setDonorForm] = useState(DONOR_EMPTY);
  const [editDonorId, setEditDonorId] = useState(null);
  const [interactionModal, setInteractionModal] = useState(false);
  const [intForm, setIntForm] = useState(INTERACTION_EMPTY);
  const [editingHealth, setEditingHealth] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load data from Supabase
  const load = async () => {
    try {
      const [d, i] = await Promise.all([
        getDonors(user.id),
        getInteractions(user.id)
      ]);
      const donorsList = d.data || [];
      setDonors(donorsList);
      setInteractions(i.data || []);

      // Auto-select first donor or refresh selected
      if (donorsList.length && !selected) {
        setSelected(donorsList[0]);
      } else if (selected) {
        const refreshed = donorsList.find(x => x.id === selected.id);
        if (refreshed) setSelected(refreshed);
        else if (donorsList.length) setSelected(donorsList[0]);
        else setSelected(null);
      }
    } catch (err) {
      console.error('Failed to load donors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  // Filter donors by search query
  const filteredDonors = useMemo(() => {
    if (!searchQuery.trim()) return donors;
    return donors.filter(d =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [donors, searchQuery]);

  // Get interactions for selected donor
  const selectedInteractions = useMemo(() => {
    if (!selected) return [];
    return interactions.filter(i =>
      i.donor_id === selected.id || i.donor_name === selected.name
    );
  }, [interactions, selected]);

  // Calculate KPI counts
  const kpis = useMemo(() => {
    return {
      total: donors.length,
      strong: donors.filter(d => d.health?.includes('Strong')).length,
      developing: donors.filter(d => d.health?.includes('Developing')).length,
      atRisk: donors.filter(d => d.health?.includes('At Risk')).length,
    };
  }, [donors]);

  // Save new/edited interaction
  const saveInteraction = async () => {
    if (!selected || !intForm.key_points.trim()) {
      alert('Lütfen "Önemli Noktalar" alanını doldurun');
      return;
    }
    setSaving(true);
    try {
      await createInteraction({
        ...intForm,
        user_id: user.id,
        donor_id: selected.id,
        donor_name: selected.name
      });
      await load();
      setInteractionModal(false);
      setIntForm(INTERACTION_EMPTY);
    } catch (err) {
      console.error('Failed to save interaction:', err);
      alert('Etkileşim kaydedilirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  // Update donor health inline
  const updateHealth = async (id, health) => {
    try {
      await updateDonor(id, { health });
      setEditingHealth(null);
      await load();
    } catch (err) {
      console.error('Failed to update health:', err);
    }
  };

  // Open new donor form
  const openNewDonor = () => {
    setDonorForm(DONOR_EMPTY);
    setEditDonorId(null);
    setDonorModal(true);
  };

  // Open edit donor form
  const openEditDonor = (d) => {
    setDonorForm({ ...d });
    setEditDonorId(d.id);
    setDonorModal(true);
  };

  // Save new/edited donor
  const saveDonor = async () => {
    if (!donorForm.name.trim()) {
      alert('Lütfen donör adı girin');
      return;
    }
    setSaving(true);
    try {
      if (editDonorId) {
        await updateDonor(editDonorId, donorForm);
      } else {
        const { data } = await createDonor({
          ...donorForm,
          user_id: user.id
        });
        if (data?.[0]) setSelected(data[0]);
      }
      await load();
      setDonorModal(false);
    } catch (err) {
      console.error('Failed to save donor:', err);
      alert('Donör kaydedilirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  // Delete donor
  const removeDonor = async (id) => {
    if (!window.confirm('Bu donörü ve tüm etkileşim geçmişini silmek istediğinizden emin misiniz?')) {
      return;
    }
    try {
      await deleteDonor(id);
      setSelected(null);
      await load();
    } catch (err) {
      console.error('Failed to delete donor:', err);
      alert('Donör silinirken hata oluştu');
    }
  };

  // Loading state
  if (loading) {
    return (
      <div style={{padding:40,color:'var(--text-muted)',textAlign:'center'}}>
        Yükleniyor…
      </div>
    );
  }

  // Role guard — after all hooks
  const allowedRoles = ['direktor','asistan'];
  if (!allowedRoles.includes(profile?.role)) {
    return (
      <div style={{padding:40, textAlign:'center', color:'var(--text-muted)'}}>
        <p style={{fontSize:18, fontWeight:600}}>Erişim Yetkiniz Yok</p>
        <p style={{fontSize:14, marginTop:8}}>Bu sayfayı görüntüleme yetkiniz bulunmamaktadır.</p>
      </div>
    );
  }

  // Get color for selected donor
  const selectedColor = selected
    ? (DONOR_COLORS[selected.name] || { bg:'var(--navy)', text:'white', icon:'🤝' })
    : {};

  return (
    <div className="page">
      {/* Page header with KPIs */}
      <div className="page-header">
        <div style={{marginBottom:24}}>
          <h1 className="page-title">🤝 Donör CRM</h1>
          <p className="page-subtitle">{donors.length} aktif donör · {interactions.length} etkileşim kaydı</p>
        </div>

        {/* KPI Grid */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div style={{fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em'}}>
              Toplam Donör
            </div>
            <div style={{fontSize:28, fontWeight:700, color:'var(--text)', marginTop:8}}>
              {kpis.total}
            </div>
          </div>
          <div className="kpi-card">
            <div style={{fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em'}}>
              🟢 Güçlü
            </div>
            <div style={{fontSize:28, fontWeight:700, color:'var(--green)', marginTop:8}}>
              {kpis.strong}
            </div>
          </div>
          <div className="kpi-card">
            <div style={{fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em'}}>
              🟡 Gelişiyor
            </div>
            <div style={{fontSize:28, fontWeight:700, color:'var(--orange)', marginTop:8}}>
              {kpis.developing}
            </div>
          </div>
          <div className="kpi-card">
            <div style={{fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em'}}>
              🔴 Risk Altında
            </div>
            <div style={{fontSize:28, fontWeight:700, color:'var(--red)', marginTop:8}}>
              {kpis.atRisk}
            </div>
          </div>
        </div>
      </div>

      {/* Two-panel layout: donor list + detail */}
      <div style={{display:'grid', gridTemplateColumns:'280px 1fr', gap:16, minHeight:'calc(100vh - 320px)'}}>
        {/* Left panel: Donor list */}
        <div style={{display:'flex', flexDirection:'column', gap:12}}>
          {/* Search input */}
          <input
            type="text"
            className="form-input"
            placeholder="Donör ara…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{marginBottom:8}}
          />

          {/* Donor list */}
          <div style={{display:'flex', flexDirection:'column', gap:10, flex:1, overflow:'auto'}}>
            {filteredDonors.length === 0 && (
              <EmptyState
                icon="🤝"
                title={searchQuery ? "Sonuç bulunamadı" : "Donör yok"}
                sub={searchQuery ? "Başka bir arama deneyin" : "+ Yeni Donör ile başlayın"}
              />
            )}
            {filteredDonors.map(d => {
              const color = DONOR_COLORS[d.name] || { bg:'var(--navy)', icon:'🤝' };
              const isSelected = selected?.id === d.id;
              return (
                <div
                  key={d.id}
                  onClick={() => setSelected(d)}
                  style={{
                    cursor:'pointer',
                    borderRadius:10,
                    border: isSelected ? `2px solid ${color.bg}` : '1px solid var(--border)',
                    overflow:'hidden',
                    transition:'all 0.15s',
                    boxShadow: isSelected ? `0 4px 16px ${color.bg}33` : 'var(--shadow-sm)',
                    backgroundColor: isSelected ? 'var(--surface)' : 'var(--bg-card)',
                  }}
                >
                  {/* Colored header with icon and name */}
                  <div style={{
                    background:color.bg,
                    padding:'12px 14px',
                    display:'flex',
                    alignItems:'center',
                    gap:10
                  }}>
                    <span style={{fontSize:22}}>{color.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700, color:'white', fontSize:14}}>
                        {d.name}
                      </div>
                      <div style={{fontSize:11, color:'rgba(255,255,255,0.7)'}}>
                        {trD(d.type, TYPE_TR)}
                      </div>
                    </div>
                  </div>

                  {/* Donor info */}
                  <div style={{padding:'10px 14px', background:'var(--bg-card)'}}>
                    <div style={{fontSize:12, color:'var(--text-muted)', marginBottom:4}}>
                      Yönetici: <strong style={{color:'var(--text)'}}>
                        {d.account_manager || '—'}
                      </strong>
                    </div>
                    <div style={{
                      fontSize:12,
                      fontWeight:600,
                      color:
                        d.health?.includes('Strong') ? 'var(--green)' :
                        d.health?.includes('Developing') ? 'var(--orange)' :
                        'var(--red)'
                    }}>
                      {trD(d.health, HEALTH_TR)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* New Donor button */}
          <button
            className="btn btn-primary"
            onClick={openNewDonor}
            style={{width:'100%'}}
          >
            + Yeni Donör
          </button>
        </div>

        {/* Right panel: Donor detail */}
        {selected ? (
          <div style={{display:'flex', flexDirection:'column', gap:14, overflow:'auto'}}>
            {/* Header card with donor info */}
            <div style={{
              background:selectedColor.bg,
              borderRadius:12,
              padding:'20px 24px',
              display:'flex',
              alignItems:'center',
              gap:16,
              flexShrink:0
            }}>
              <span style={{fontSize:36}}>{selectedColor.icon}</span>
              <div style={{flex:1}}>
                <div style={{
                  fontFamily:'var(--font-display)',
                  fontSize:24,
                  fontWeight:700,
                  color:'white'
                }}>
                  {selected.name}
                </div>
                <div style={{fontSize:13, color:'rgba(255,255,255,0.75)', marginTop:2}}>
                  {trD(selected.type, TYPE_TR)} · Hesap Yöneticisi: {selected.account_manager || '—'}
                </div>
              </div>

              {/* Health status + edit buttons */}
              <div style={{display:'flex', gap:8, alignItems:'center', flexShrink:0}}>
                {editingHealth === selected.id ? (
                  <select
                    autoFocus
                    className="form-select"
                    style={{
                      width:160,
                      background:'rgba(255,255,255,0.15)',
                      border:'1px solid rgba(255,255,255,0.3)',
                      color:'white',
                      padding:'6px 10px',
                      borderRadius:6,
                      fontSize:13
                    }}
                    defaultValue={selected.health}
                    onChange={(e) => updateHealth(selected.id, e.target.value)}
                    onBlur={() => setEditingHealth(null)}
                  >
                    {HEALTH_OPTIONS.map(h => (
                      <option key={h} value={h} style={{color:'black'}}>
                        {trD(h, HEALTH_TR)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div
                    onClick={() => setEditingHealth(selected.id)}
                    style={{
                      fontSize:13,
                      fontWeight:700,
                      color:'white',
                      cursor:'pointer',
                      padding:'6px 12px',
                      background:'rgba(255,255,255,0.15)',
                      borderRadius:8,
                      border:'1px solid rgba(255,255,255,0.2)',
                      transition:'all 0.15s'
                    }}
                    title="Tıkla ve düzenle"
                  >
                    {trD(selected.health, HEALTH_TR)}
                  </div>
                )}
                <button
                  className="btn"
                  onClick={() => openEditDonor(selected)}
                  style={{
                    padding:'6px 12px',
                    borderRadius:8,
                    border:'1px solid rgba(255,255,255,0.2)',
                    background:'rgba(255,255,255,0.1)',
                    color:'white',
                    cursor:'pointer',
                    fontSize:12,
                    fontWeight:500
                  }}
                >
                  ✏️ Düzenle
                </button>
                <button
                  className="btn"
                  onClick={() => removeDonor(selected.id)}
                  style={{
                    padding:'6px 12px',
                    borderRadius:8,
                    border:'1px solid rgba(255,0,0,0.3)',
                    background:'rgba(255,0,0,0.15)',
                    color:'#fca5a5',
                    cursor:'pointer',
                    fontSize:12,
                    fontWeight:500
                  }}
                >
                  🗑
                </button>
              </div>
            </div>

            {/* Info grid */}
            <div className="card">
              <div style={{
                display:'flex',
                alignItems:'center',
                justifyContent:'space-between',
                marginBottom:16
              }}>
                <h3 className="section-title">
                  <span className="section-dot">📊</span>
                  İlişki Özeti
                </h3>
                {selected && (
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => onNavigate('chat', {
                      initialMessage: `${selected.name} için iletişim stratejisi ve sonraki adımlar neler olmalı?`
                    })}
                  >
                    🤖 Strateji öner
                  </button>
                )}
              </div>

              <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16}}>
                {[
                  ['Son Temas', selected.last_contact || '—'],
                  ['Sonraki Takip', selected.next_followup || '—'],
                  ['Raporlama Tarihi', selected.reporting_deadline || '—'],
                  ['Öncelik', trD(selected.priority, PRIORITY_TR) || '—'],
                  ['Aktif Çalışmalar', selected.active_engagements || '—'],
                  ['Notlar', selected.notes || '—'],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      padding:'12px 14px',
                      background:'var(--surface)',
                      borderRadius:8,
                      border:'1px solid var(--border)'
                    }}
                  >
                    <div style={{
                      fontSize:11,
                      color:'var(--text-muted)',
                      fontWeight:600,
                      textTransform:'uppercase',
                      letterSpacing:'0.04em',
                      marginBottom:6
                    }}>
                      {label}
                    </div>
                    <div style={{
                      fontSize:13,
                      fontWeight:500,
                      color:'var(--text)',
                      lineHeight:1.4
                    }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactions section */}
            <div className="card">
              <div style={{
                display:'flex',
                alignItems:'center',
                justifyContent:'space-between',
                marginBottom:16
              }}>
                <h3 className="section-title">
                  <span className="section-dot">📝</span>
                  Etkileşim Geçmişi ({selectedInteractions.length})
                </h3>
                <div style={{display:'flex', gap:8}}>
                  {selected && (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => onNavigate('chat', {
                        initialMessage: `${selected.name} ile son toplantı için follow-up email taslağı yaz`
                      })}
                    >
                      🤖 Follow-up email
                    </button>
                  )}
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setInteractionModal(true)}
                  >
                    + Etkileşim Ekle
                  </button>
                </div>
              </div>

              {selectedInteractions.length === 0 ? (
                <div className="empty-state" style={{padding:'32px 24px', textAlign:'center'}}>
                  <div style={{fontSize:24, marginBottom:8}}>📭</div>
                  <div style={{color:'var(--text-muted)'}}>Henüz etkileşim eklenmemiş</div>
                </div>
              ) : (
                <div style={{display:'flex', flexDirection:'column', gap:10}}>
                  {selectedInteractions.map((int, idx) => (
                    <div
                      key={int.id}
                      style={{
                        padding:'12px 14px',
                        borderRadius:8,
                        background:idx % 2 === 0 ? 'var(--surface)' : 'white',
                        border:'1px solid var(--border)'
                      }}
                    >
                      <div style={{
                        display:'flex',
                        alignItems:'center',
                        gap:10,
                        marginBottom:8,
                        flexWrap:'wrap'
                      }}>
                        <span style={{
                          display:'inline-block',
                          padding:'4px 8px',
                          background:'var(--blue-light)',
                          color:'var(--blue)',
                          borderRadius:4,
                          fontSize:12,
                          fontWeight:600
                        }}>
                          {int.type}
                        </span>
                        <span style={{fontSize:12, color:'var(--text-muted)'}}>
                          {int.interaction_date}
                        </span>
                        {int.participants && (
                          <span style={{fontSize:12, color:'var(--text-muted)'}}>
                            · {int.participants}
                          </span>
                        )}
                      </div>
                      <div style={{fontSize:13, color:'var(--text)', lineHeight:1.5, marginBottom:8}}>
                        {int.key_points}
                      </div>
                      {int.followup_required && (
                        <div style={{
                          fontSize:12,
                          color:'var(--orange)',
                          fontWeight:500,
                          paddingTop:8,
                          borderTop:'1px solid var(--border)'
                        }}>
                          → Follow-up: {int.followup_required}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{display:'flex', alignItems:'center', justifyContent:'center', minHeight:400}}>
            <EmptyState
              icon="🤝"
              title="Donör seçin"
              sub="Soldan bir donörü seçerek detaylarını görüntüleyin"
            />
          </div>
        )}
      </div>

      {/* New/Edit Donor Modal */}
      {donorModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDonorModal(false);
          }}
        >
          <div className="modal">
            <h2 className="modal-title">
              {editDonorId ? '✏️ Donörü Düzenle' : '+ Yeni Donör Ekle'}
            </h2>

            {/* Name and Type row */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16}}>
              <div className="form-group">
                <label className="form-label">Donör Adı *</label>
                <input
                  className="form-input"
                  placeholder="Örn: UNICEF"
                  value={donorForm.name}
                  onChange={(e) => setDonorForm(f => ({...f, name:e.target.value}))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tür</label>
                <select
                  className="form-select"
                  value={donorForm.type}
                  onChange={(e) => setDonorForm(f => ({...f, type:e.target.value}))}
                >
                  {TYPE_OPTIONS.map(t => (
                    <option key={t} value={t}>
                      {trD(t, TYPE_TR)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Account manager and health row */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16}}>
              <div className="form-group">
                <label className="form-label">Hesap Yöneticisi</label>
                <input
                  className="form-input"
                  placeholder="Koordinatör adı"
                  value={donorForm.account_manager}
                  onChange={(e) => setDonorForm(f => ({...f, account_manager:e.target.value}))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">İlişki Sağlığı</label>
                <select
                  className="form-select"
                  value={donorForm.health}
                  onChange={(e) => setDonorForm(f => ({...f, health:e.target.value}))}
                >
                  {HEALTH_OPTIONS.map(h => (
                    <option key={h} value={h}>
                      {trD(h, HEALTH_TR)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date row 1 */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16}}>
              <div className="form-group">
                <label className="form-label">Son Temas</label>
                <input
                  className="form-input"
                  type="date"
                  value={donorForm.last_contact}
                  onChange={(e) => setDonorForm(f => ({...f, last_contact:e.target.value}))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Sonraki Takip</label>
                <input
                  className="form-input"
                  type="date"
                  value={donorForm.next_followup}
                  onChange={(e) => setDonorForm(f => ({...f, next_followup:e.target.value}))}
                />
              </div>
            </div>

            {/* Date row 2 and priority */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16}}>
              <div className="form-group">
                <label className="form-label">Raporlama Tarihi</label>
                <input
                  className="form-input"
                  type="date"
                  value={donorForm.reporting_deadline}
                  onChange={(e) => setDonorForm(f => ({...f, reporting_deadline:e.target.value}))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Öncelik</label>
                <select
                  className="form-select"
                  value={donorForm.priority}
                  onChange={(e) => setDonorForm(f => ({...f, priority:e.target.value}))}
                >
                  {PRIORITY_OPTIONS.map(p => (
                    <option key={p} value={p}>
                      {trD(p, PRIORITY_TR)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Engagements textarea */}
            <div className="form-group" style={{marginBottom:16}}>
              <label className="form-label">Aktif Çalışmalar</label>
              <textarea
                className="form-textarea"
                placeholder="Devam eden projeler, raporlar…"
                value={donorForm.active_engagements}
                onChange={(e) => setDonorForm(f => ({...f, active_engagements:e.target.value}))}
                style={{height:80}}
              />
            </div>

            {/* Notes textarea */}
            <div className="form-group" style={{marginBottom:20}}>
              <label className="form-label">Notlar</label>
              <textarea
                className="form-textarea"
                placeholder="Ek notlar…"
                value={donorForm.notes}
                onChange={(e) => setDonorForm(f => ({...f, notes:e.target.value}))}
                style={{height:80}}
              />
            </div>

            {/* Footer */}
            <div className="modal-footer">
              <button
                className="btn btn-outline"
                onClick={() => setDonorModal(false)}
              >
                İptal
              </button>
              <button
                className="btn btn-primary"
                onClick={saveDonor}
                disabled={saving || !donorForm.name.trim()}
              >
                {saving ? '⏳ Kaydediliyor…' : editDonorId ? 'Güncelle' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interaction Modal */}
      {interactionModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInteractionModal(false);
          }}
        >
          <div className="modal">
            <h2 className="modal-title">
              📝 Yeni Etkileşim — {selected?.name}
            </h2>

            {/* Date and type row */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16}}>
              <div className="form-group">
                <label className="form-label">Tarih</label>
                <input
                  className="form-input"
                  type="date"
                  value={intForm.interaction_date}
                  onChange={(e) => setIntForm(f => ({...f, interaction_date:e.target.value}))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tür</label>
                <select
                  className="form-select"
                  value={intForm.type}
                  onChange={(e) => setIntForm(f => ({...f, type:e.target.value}))}
                >
                  {INTERACTION_TYPES.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Participants */}
            <div className="form-group" style={{marginBottom:16}}>
              <label className="form-label">Katılımcılar</label>
              <input
                className="form-input"
                placeholder="Kimler vardı?"
                value={intForm.participants}
                onChange={(e) => setIntForm(f => ({...f, participants:e.target.value}))}
              />
            </div>

            {/* Key points - required */}
            <div className="form-group" style={{marginBottom:16}}>
              <label className="form-label">Önemli Noktalar *</label>
              <textarea
                className="form-textarea"
                placeholder="Ne konuşuldu, ne kararlaştırıldı?"
                value={intForm.key_points}
                onChange={(e) => setIntForm(f => ({...f, key_points:e.target.value}))}
                style={{height:100}}
              />
            </div>

            {/* Follow-up required */}
            <div className="form-group" style={{marginBottom:20}}>
              <label className="form-label">Takip Gerekli</label>
              <input
                className="form-input"
                placeholder="Varsa follow-up aksiyonu…"
                value={intForm.followup_required}
                onChange={(e) => setIntForm(f => ({...f, followup_required:e.target.value}))}
              />
            </div>

            {/* Footer */}
            <div className="modal-footer">
              <button
                className="btn btn-outline"
                onClick={() => setInteractionModal(false)}
              >
                İptal
              </button>
              <button
                className="btn btn-primary"
                onClick={saveInteraction}
                disabled={saving || !intForm.key_points.trim()}
              >
                {saving ? '⏳ Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
