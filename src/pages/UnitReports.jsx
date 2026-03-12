import React, { useState, useEffect } from 'react';
import { getUnitReports, createUnitReport } from '../lib/supabase';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const UNITS = [
  { name: 'Partnerships', coordinator: 'Hatice', icon: '🤝', color: 'unit-partnerships' },
  { name: 'Humanitarian Affairs', coordinator: 'Gülsüm', icon: '🌍', color: 'unit-humanitarian' },
  { name: 'Traditional Donors', coordinator: 'Murat', icon: '💰', color: 'unit-traditional-donors' },
  { name: 'Grants', coordinator: 'Yasir', icon: '📝', color: 'unit-grants' },
  { name: 'Accreditations', coordinator: 'Yavuz', icon: '✅', color: 'unit-accreditations' },
  { name: 'Policy & Governance', coordinator: 'Sezgin', icon: '⚖️', color: 'unit-policy' },
];

const STATUS_OPTIONS = [
  { value: '🟢 On Track', color: 'var(--green)' },
  { value: '🟡 Some Delays', color: 'var(--orange)' },
  { value: '🔴 Behind', color: 'var(--red)' },
];

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().slice(0, 10);
}

const EMPTY_FORM = {
  unit: UNITS[0].name,
  coordinator: UNITS[0].coordinator,
  week_of: getWeekStart(),
  overall_status: '🟢 On Track',
  key_achievement: '',
  main_challenge: '',
  decision_needed: '',
  escalation: '',
  next_week_priorities: '',
};

export default function UnitReports({ user, onNavigate }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [activeUnit, setActiveUnit] = useState(null);
  const [view, setView] = useState('latest'); // 'latest' | 'history'

  const load = async () => {
    const { data } = await getUnitReports(user.id);
    setReports(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  // Latest report per unit
  const latestByUnit = {};
  reports.forEach(r => {
    if (!latestByUnit[r.unit] || r.submitted_at > latestByUnit[r.unit].submitted_at) {
      latestByUnit[r.unit] = r;
    }
  });

  const openModal = (unitName) => {
    const unit = UNITS.find(u => u.name === unitName) || UNITS[0];
    setForm({
      ...EMPTY_FORM,
      unit: unit.name,
      coordinator: unit.coordinator,
      week_of: getWeekStart(),
    });
    setModal(true);
  };

  const save = async () => {
    if (!form.key_achievement) return;
    setSaving(true);
    await createUnitReport({ ...form, user_id: user.id });
    await load();
    setModal(false);
    setSaving(false);
  };

  const filteredHistory = activeUnit
    ? reports.filter(r => r.unit === activeUnit)
    : reports;

  const coverageCount = UNITS.filter(u => latestByUnit[u.name] && (() => {
    const days = Math.floor((new Date() - new Date(latestByUnit[u.name].submitted_at)) / 86400000);
    return days <= 7;
  })()).length;

  if (loading) return <div style={{padding:40,color:'var(--text-muted)'}}>Yükleniyor…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <h1 className="page-title">📊 Birim Raporları</h1>
            <p className="page-subtitle">
              Bu hafta {coverageCount}/{UNITS.length} birim raporladı · {reports.length} toplam rapor
            </p>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-outline btn-sm"
              onClick={() => onNavigate('chat', { initialMessage: 'Birim raporlarını özetle, hangi birimde sorun var, direktör olarak ne yapmalıyım?' })}>
              🤖 AI ile sentezle
            </button>
            <button className="btn btn-primary" onClick={() => setModal(true)}>+ Rapor Ekle</button>
          </div>
        </div>
      </div>

      {/* View toggle */}
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        <button
          className={`btn btn-sm ${view === 'latest' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setView('latest')}
        >
          📋 Son Durum
        </button>
        <button
          className={`btn btn-sm ${view === 'history' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setView('history')}
        >
          📚 Geçmiş Raporlar
        </button>
      </div>

      {view === 'latest' ? (
        /* LATEST STATUS VIEW */
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16}}>
          {UNITS.map(unit => {
            const latest = latestByUnit[unit.name];
            const daysAgo = latest
              ? Math.floor((new Date() - new Date(latest.submitted_at)) / 86400000)
              : null;
            const isFresh = daysAgo !== null && daysAgo <= 7;

            return (
              <div key={unit.name} className="card" style={{
                borderTop: `3px solid ${
                  !latest ? 'var(--border)' :
                  latest.overall_status?.includes('On Track') ? 'var(--green)' :
                  latest.overall_status?.includes('Some Delays') ? 'var(--orange)' : 'var(--red)'
                }`
              }}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:22}}>{unit.icon}</span>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:'var(--text)'}}>{unit.name}</div>
                      <div style={{fontSize:12,color:'var(--text-muted)'}}>Koordinatör: {unit.coordinator}</div>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    {latest && (
                      <span style={{
                        fontSize:12,fontWeight:600,
                        color: latest.overall_status?.includes('On Track') ? 'var(--green)' :
                               latest.overall_status?.includes('Some Delays') ? 'var(--orange)' : 'var(--red)'
                      }}>
                        {latest.overall_status}
                      </span>
                    )}
                    <button className="btn btn-primary btn-sm" onClick={() => openModal(unit.name)}>
                      + Rapor
                    </button>
                  </div>
                </div>

                {latest ? (
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    <div style={{fontSize:11.5,color:'var(--text-muted)'}}>
                      {isFresh
                        ? `✅ ${daysAgo === 0 ? 'Bugün' : daysAgo + ' gün önce'} güncellendi · Hafta: ${latest.week_of}`
                        : `⚠️ Son rapor ${daysAgo} gün önce — güncelleme gerekiyor`}
                    </div>
                    {[
                      { label: '🏆 Başarı', val: latest.key_achievement },
                      { label: '⚠️ Zorluk', val: latest.main_challenge },
                      { label: '🔔 Karar Gerekiyor', val: latest.decision_needed },
                      { label: '🚨 Eskalasyon', val: latest.escalation },
                      { label: '📌 Önümüzdeki Hafta', val: latest.next_week_priorities },
                    ].filter(x => x.val).map(({ label, val }) => (
                      <div key={label} style={{
                        padding:'8px 10px', borderRadius:6,
                        background:'var(--surface)', border:'1px solid var(--border)'
                      }}>
                        <div style={{fontSize:10.5,color:'var(--text-muted)',fontWeight:600,marginBottom:3}}>{label}</div>
                        <div style={{fontSize:12.5,color:'var(--text)',lineHeight:1.4}}>
                          {val.length > 100 ? val.slice(0,100) + '…' : val}
                        </div>
                      </div>
                    ))}
                    <button
                      style={{fontSize:11.5,color:'var(--blue)',background:'none',border:'none',cursor:'pointer',textAlign:'left',padding:'4px 0'}}
                      onClick={() => { setActiveUnit(unit.name); setView('history'); }}
                    >
                      Tüm raporları gör ({reports.filter(r=>r.unit===unit.name).length}) →
                    </button>
                  </div>
                ) : (
                  <div style={{textAlign:'center',padding:'16px 0',color:'var(--text-muted)',fontSize:13}}>
                    <div style={{marginBottom:8}}>Bu birimden henüz rapor yok</div>
                    <button className="btn btn-outline btn-sm" onClick={() => openModal(unit.name)}>
                      İlk Raporu Ekle
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* HISTORY VIEW */
        <div>
          {/* Unit filter */}
          <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
            <button
              className={`btn btn-sm ${!activeUnit ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveUnit(null)}
            >
              Tümü ({reports.length})
            </button>
            {UNITS.map(u => (
              <button key={u.name}
                className={`btn btn-sm ${activeUnit === u.name ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveUnit(activeUnit === u.name ? null : u.name)}
              >
                {u.icon} {u.name} ({reports.filter(r=>r.unit===u.name).length})
              </button>
            ))}
          </div>

          {filteredHistory.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-title">Rapor bulunamadı</div>
            </div>
          ) : (
            <div className="card" style={{padding:0,overflow:'hidden'}}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Birim</th>
                    <th>Koordinatör</th>
                    <th>Hafta</th>
                    <th>Durum</th>
                    <th>Başarı</th>
                    <th>Zorluk</th>
                    <th>Karar Gerekiyor?</th>
                    <th>Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory
                    .sort((a,b) => new Date(b.submitted_at) - new Date(a.submitted_at))
                    .map((r, i) => {
                      const unit = UNITS.find(u => u.name === r.unit) || {};
                      return (
                        <tr key={r.id} className={i%2===1?'row-alt':''}>
                          <td>
                            <span className={`unit-chip ${unit.color||''}`}>
                              {unit.icon} {r.unit}
                            </span>
                          </td>
                          <td style={{fontSize:13,color:'var(--text-muted)'}}>{r.coordinator}</td>
                          <td style={{fontSize:13}}>{r.week_of}</td>
                          <td>
                            <span style={{fontSize:12,fontWeight:600,
                              color: r.overall_status?.includes('On Track') ? 'var(--green)' :
                                     r.overall_status?.includes('Some Delays') ? 'var(--orange)' : 'var(--red)'
                            }}>
                              {r.overall_status}
                            </span>
                          </td>
                          <td style={{fontSize:12,color:'var(--text)',maxWidth:180}}>
                            {r.key_achievement?.slice(0,60)}{r.key_achievement?.length>60?'…':''}
                          </td>
                          <td style={{fontSize:12,color:'var(--text-muted)',maxWidth:160}}>
                            {r.main_challenge?.slice(0,60)}{r.main_challenge?.length>60?'…':''}
                          </td>
                          <td>
                            {r.decision_needed
                              ? <span className="badge badge-orange" style={{fontSize:10}}>Evet</span>
                              : <span style={{color:'var(--text-muted)',fontSize:12}}>—</span>
                            }
                          </td>
                          <td style={{fontSize:12,color:'var(--text-muted)'}}>
                            {new Date(r.submitted_at).toLocaleDateString('tr-TR')}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setModal(false);}}>
          <div className="modal" style={{maxWidth:640}}>
            <h2 className="modal-title">📊 Haftalık Birim Raporu</h2>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Birim</label>
                <select className="form-select" value={form.unit}
                  onChange={e => {
                    const unit = UNITS.find(u => u.name === e.target.value) || UNITS[0];
                    setForm(f => ({...f, unit: unit.name, coordinator: unit.coordinator}));
                  }}>
                  {UNITS.map(u => <option key={u.name}>{u.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Koordinatör</label>
                <input className="form-input" value={form.coordinator}
                  onChange={e => setForm(f => ({...f, coordinator: e.target.value}))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Hafta Başlangıcı</label>
                <input className="form-input" type="date" value={form.week_of}
                  onChange={e => setForm(f => ({...f, week_of: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Genel Durum</label>
                <select className="form-select" value={form.overall_status}
                  onChange={e => setForm(f => ({...f, overall_status: e.target.value}))}>
                  {STATUS_OPTIONS.map(s => <option key={s.value}>{s.value}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">🏆 Haftanın Başarısı *</label>
              <textarea className="form-textarea" style={{minHeight:60}}
                placeholder="Bu hafta birim ne başardı?"
                value={form.key_achievement}
                onChange={e => setForm(f => ({...f, key_achievement: e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">⚠️ Ana Zorluk</label>
              <textarea className="form-textarea" style={{minHeight:55}}
                placeholder="Bu hafta karşılaşılan en büyük engel..."
                value={form.main_challenge}
                onChange={e => setForm(f => ({...f, main_challenge: e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">🔔 Direktörden Karar Gerekiyor mu?</label>
              <textarea className="form-textarea" style={{minHeight:50}}
                placeholder="Varsa direktör kararı gerektiren konuyu yazın..."
                value={form.decision_needed}
                onChange={e => setForm(f => ({...f, decision_needed: e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">🚨 Eskalasyon Gerekiyor mu?</label>
              <textarea className="form-textarea" style={{minHeight:50}}
                placeholder="Üst yönetime taşınması gereken konu varsa..."
                value={form.escalation}
                onChange={e => setForm(f => ({...f, escalation: e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">📌 Önümüzdeki Hafta Öncelikleri</label>
              <textarea className="form-textarea" style={{minHeight:55}}
                placeholder="Gelecek haftaki 2-3 ana öncelik..."
                value={form.next_week_priorities}
                onChange={e => setForm(f => ({...f, next_week_priorities: e.target.value}))} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(false)}>İptal</button>
              <button className="btn btn-primary" onClick={save} disabled={saving || !form.key_achievement}>
                {saving ? '⏳ Kaydediliyor...' : '✓ Raporu Gönder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
