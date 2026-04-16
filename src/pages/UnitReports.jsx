import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, logActivity } from '../lib/supabase';
import { UNITS as UNIT_LIST, UNIT_ICON_MAP, fmtDisplayDate } from '../lib/constants';

// ═══════════════════════════════════════════════════════════════════════════════
// SABITLER & YARDIMCILAR
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_COLORS = { green: '#16a34a', yellow: '#d97706', red: '#dc2626' };
const STATUS_LABELS = { green: 'Normal', yellow: 'Dikkat Gerekli', red: 'Kritik' };
const STATUS_ICONS  = { green: '🟢', yellow: '🟡', red: '🔴' };

// İngilizce birim adları ↔ Türkçe profil birim adları eşleştirmesi
const UNIT_NAME_MAP = {
  'Partnerships':         'Ortaklıklar Birimi',
  'Humanitarian Affairs': 'Uluslararası İnsani İşler Birimi',
  'Traditional Donors':   'Geleneksel Donörler Birimi',
  'Grants':               'Uluslararası Hibeler Birimi',
  'Accreditations':       'Akreditasyonlar Birimi',
  'Policy & Governance':  'Politika, Yönetişim ve Güvence Birimi',
};

// Birim renk paleti (Türkçe profil birim adı → renk)
const UNIT_COLORS = {
  'Fonlar Birimi':                       '#EAB308',
  'Uluslararası Hibeler Birimi':         '#DC2626',
  'Uluslararası İnsani İşler Birimi':    '#2563EB',
  'Ortaklıklar Birimi':                  '#16A34A',
  'Politika, Yönetişim ve Güvence Birimi':'#EA580C',
  // İngilizce adlar için de ekle
  'Partnerships':         '#16A34A',
  'Humanitarian Affairs': '#2563EB',
  'Grants':               '#DC2626',
  'Policy & Governance':  '#EA580C',
  'Traditional Donors':   '#EAB308',
  'Accreditations':       '#EAB308',
};
function getUnitColor(unitName) {
  return UNIT_COLORS[unitName] || '#6366f1';
}
// Ters yönlü map: Türkçe → İngilizce
const UNIT_NAME_REVERSE = Object.fromEntries(Object.entries(UNIT_NAME_MAP).map(([en, tr]) => [tr, en]));

// Rapordaki unit alanını UNIT_LIST'teki İngilizce isme çevir
function matchUnitName(reportUnit) {
  // Zaten İngilizce ise direkt döndür
  if (UNIT_LIST.find(u => u.name === reportUnit)) return reportUnit;
  // Türkçe ise İngilizce karşılığını bul
  return UNIT_NAME_REVERSE[reportUnit] || reportUnit;
}

const RISK_CATEGORIES = ['Operasyonel', 'Finansal', 'İnsan Kaynağı', 'Paydaş İlişkisi', 'Dış Etken', 'Uyum/Hukuk', 'Diğer'];
const PROBABILITY_OPTIONS = ['Düşük', 'Orta', 'Yüksek'];
const IMPACT_OPTIONS = ['Düşük', 'Orta', 'Yüksek', 'Kritik'];
const STAKEHOLDER_TYPES = ['Donör', 'Hükümet', 'BM Ajansı', 'STK', 'Özel Sektör', 'Akademi', 'Medya', 'Diğer'];
const INTERACTION_TYPES = ['Toplantı', 'Email', 'Telefon', 'Ziyaret', 'Konferans', 'Diğer'];
const RELATIONSHIP_STATUS = ['Güçlü', 'Gelişiyor', 'Nötr', 'Risk Altında'];
const OPPORTUNITY_TYPES = ['Fon/Hibe', 'Ortaklık', 'Kapasite Geliştirme', 'Savunuculuk', 'Medya', 'Diğer'];
const ACTIVITY_STATUSES = ['Planlandı', 'Devam Ediyor', 'Tamamlandı', 'Ertelendi', 'İptal'];
const PRIORITY_LEVELS = ['Yüksek', 'Orta', 'Düşük'];

function getWeekStart(date) {
  const d = date ? new Date(date + 'T12:00:00') : new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().slice(0, 10);
}
function getWeekEnd(startStr) {
  const d = new Date(startStr + 'T12:00:00');
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}
function weekLabel(start, end) {
  return `${fmtDisplayDate(start)} — ${fmtDisplayDate(end)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPEATABLE GROUP - Tekrar eden alan bileşeni
// ═══════════════════════════════════════════════════════════════════════════════

function RepeatableGroup({ label, items, setItems, renderItem, emptyItem, maxItems = 10, addLabel = '+ Ekle' }) {
  const add = () => { if (items.length < maxItems) setItems([...items, { ...emptyItem }]); };
  const remove = (i) => setItems(items.filter((_, idx) => idx !== i));
  const update = (i, field, val) => {
    const copy = [...items];
    copy[i] = { ...copy[i], [field]: val };
    setItems(copy);
  };
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <label className="form-label" style={{ margin: 0 }}>{label} ({items.length})</label>
        <button type="button" className="btn btn-outline btn-sm" onClick={add} disabled={items.length >= maxItems}>{addLabel}</button>
      </div>
      {items.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 0', textAlign: 'center', background: 'var(--bg-hover)', borderRadius: 8 }}>Henüz eklenmedi</div>}
      {items.map((item, i) => (
        <div key={i} style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: 14, marginBottom: 8, position: 'relative' }}>
          <button type="button" onClick={() => remove(i)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--red)' }} title="Kaldır">✕</button>
          {renderItem(item, i, update)}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORM BÖLÜM BİLEŞENLERİ
// ═══════════════════════════════════════════════════════════════════════════════

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div style={{ borderBottom: '2px solid var(--border)', paddingBottom: 8, marginBottom: 16, marginTop: 24 }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{icon} {title}</h3>
      {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RAPOR FORMU
// ═══════════════════════════════════════════════════════════════════════════════

function ReportForm({ profile, user, existingReport, onSaved, onCancel }) {
  const weekStart = getWeekStart();
  const weekEnd = getWeekEnd(weekStart);

  const [form, setForm] = useState(() => {
    if (existingReport) return { ...existingReport };
    return {
      overall_status: 'green',
      executive_summary: '',
      critical_flag: false,
      critical_flag_detail: '',
      activities: [],
      stakeholder_engagements: [],
      has_risks: false,
      risks: [],
      opportunities: [],
      director_request: '',
      decision_needed: '',
      cross_unit_coordination: '',
      kpi_meetings_held: 0,
      kpi_documents_produced: 0,
      kpi_stakeholder_contacts: 0,
      kpi_field_visits: 0,
      kpi_proposals_submitted: 0,
      kpi_custom: [],
      next_week_priorities: [],
    };
  });

  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState(0);

  const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  const sections = [
    { id: 'exec', icon: '📊', label: 'Genel Durum' },
    { id: 'activities', icon: '📋', label: 'Faaliyetler' },
    { id: 'stakeholders', icon: '🤝', label: 'Paydaşlar' },
    { id: 'risks', icon: '⚠️', label: 'Riskler' },
    { id: 'opportunities', icon: '💡', label: 'Fırsatlar' },
    { id: 'coordination', icon: '🔗', label: 'Koordinasyon' },
    { id: 'kpis', icon: '📈', label: 'KPI' },
    { id: 'next', icon: '🎯', label: 'Gelecek Hafta' },
  ];

  const validate = () => {
    if (!form.executive_summary.trim()) return 'Yönetici özeti zorunludur.';
    if (form.executive_summary.length > 500) return 'Yönetici özeti 500 karakteri geçemez.';
    if (form.critical_flag && !form.critical_flag_detail?.trim()) return 'Kritik bayrak detayı zorunludur.';
    if (form.has_risks && form.risks.length === 0) return 'Risk olduğunu belirttiniz ama risk eklemediniz.';
    if (form.next_week_priorities.length === 0) return 'En az 1 gelecek hafta önceliği ekleyin.';
    return null;
  };

  const handleSave = async (isDraft) => {
    if (!isDraft) {
      const err = validate();
      if (err) { alert(err); return; }
    }
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        unit: profile.unit,
        coordinator_name: profile.full_name,
        week_start: existingReport?.week_start || weekStart,
        week_end: existingReport?.week_end || weekEnd,
        status: isDraft ? 'draft' : 'submitted',
        submitted_at: isDraft ? null : new Date().toISOString(),
        overall_status: form.overall_status,
        executive_summary: form.executive_summary,
        critical_flag: form.critical_flag,
        critical_flag_detail: form.critical_flag ? form.critical_flag_detail : null,
        activities: form.activities,
        stakeholder_engagements: form.stakeholder_engagements,
        has_risks: form.has_risks,
        risks: form.has_risks ? form.risks : [],
        opportunities: form.opportunities,
        director_request: form.director_request || null,
        decision_needed: form.decision_needed || null,
        cross_unit_coordination: form.cross_unit_coordination || null,
        kpi_meetings_held: form.kpi_meetings_held || 0,
        kpi_documents_produced: form.kpi_documents_produced || 0,
        kpi_stakeholder_contacts: form.kpi_stakeholder_contacts || 0,
        kpi_field_visits: form.kpi_field_visits || 0,
        kpi_proposals_submitted: form.kpi_proposals_submitted || 0,
        kpi_custom: form.kpi_custom,
        next_week_priorities: form.next_week_priorities,
      };

      let result;
      if (existingReport?.id) {
        result = await supabase.from('weekly_unit_reports').update(payload).eq('id', existingReport.id).select().single();
      } else {
        result = await supabase.from('weekly_unit_reports').insert(payload).select().single();
      }
      if (result.error) throw result.error;
      onSaved(result.data);
      logActivity({ action: existingReport?.id ? 'güncelledi' : 'oluşturdu', module: 'birim_raporları', entityType: 'haftalık_rapor', entityName: form.unit || profile?.unit });
    } catch (e) {
      alert('Kayıt hatası: ' + (e.message || e));
    } finally { setSaving(false); }
  };

  return (
    <div>
      {/* Üst Bilgi */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 20, padding: '14px 18px', background: 'var(--bg-hover)', borderRadius: 12 }}>
        <span style={{ fontSize: 22 }}>{UNIT_ICON_MAP[profile.unit] || '📊'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{profile.unit}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{profile.full_name} — {weekLabel(existingReport?.week_start || weekStart, existingReport?.week_end || weekEnd)}</div>
        </div>
        {existingReport?.status === 'draft' && <span className="badge badge-orange">Taslak</span>}
      </div>

      {/* Bölüm Navigasyonu */}
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 8, marginBottom: 16 }}>
        {sections.map((s, i) => (
          <button key={s.id} type="button" onClick={() => setActiveSection(i)}
            style={{
              padding: '6px 12px', borderRadius: 20, border: '1.5px solid', whiteSpace: 'nowrap',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              borderColor: activeSection === i ? 'var(--navy)' : 'var(--border)',
              background: activeSection === i ? 'var(--navy)' : 'transparent',
              color: activeSection === i ? '#fff' : 'var(--text)',
            }}>{s.icon} {s.label}</button>
        ))}
      </div>

      {/* ── SECTION 0: Executive Summary ─────────────────────────────── */}
      {activeSection === 0 && (<div>
        <SectionHeader icon="📊" title="Genel Durum" subtitle="Bu haftanın genel değerlendirmesi" />

        <div className="form-group">
          <label className="form-label">Genel Durum (Trafik Işığı) *</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {['green', 'yellow', 'red'].map(s => (
              <button key={s} type="button" onClick={() => set('overall_status', s)}
                style={{
                  flex: 1, padding: '14px 10px', borderRadius: 12, border: '2px solid',
                  borderColor: form.overall_status === s ? STATUS_COLORS[s] : 'var(--border)',
                  background: form.overall_status === s ? STATUS_COLORS[s] + '18' : 'var(--bg-card)',
                  cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                }}>
                <div style={{ fontSize: 24 }}>{STATUS_ICONS[s]}</div>
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4, color: STATUS_COLORS[s] }}>{STATUS_LABELS[s]}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="form-group" style={{ marginTop: 16 }}>
          <label className="form-label">Yönetici Özeti * <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({form.executive_summary.length}/500)</span></label>
          <textarea className="form-input" rows={4} maxLength={500} placeholder="Bu haftanın en önemli 2-3 gelişmesini özetleyin..."
            value={form.executive_summary} onChange={e => set('executive_summary', e.target.value)}
            style={{ resize: 'vertical' }} />
        </div>

        <div className="form-group" style={{ marginTop: 16, background: form.critical_flag ? '#fef2f2' : 'var(--bg-hover)', padding: 14, borderRadius: 10, border: form.critical_flag ? '1.5px solid var(--red)' : '1.5px solid var(--border)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            <input type="checkbox" checked={form.critical_flag} onChange={e => set('critical_flag', e.target.checked)} />
            🚨 Bu hafta kritik bir konu var
          </label>
          {form.critical_flag && (
            <textarea className="form-input" rows={2} maxLength={300} placeholder="Kritik konuyu kısaca açıklayın..."
              value={form.critical_flag_detail} onChange={e => set('critical_flag_detail', e.target.value)}
              style={{ marginTop: 10, borderColor: 'var(--red)', resize: 'vertical' }} />
          )}
        </div>
      </div>)}

      {/* ── SECTION 1: Activities ──────────────────────────────────── */}
      {activeSection === 1 && (<div>
        <SectionHeader icon="📋" title="Faaliyetler & İlerleme" subtitle="Bu hafta gerçekleştirilen veya devam eden faaliyetler" />
        <RepeatableGroup
          label="Faaliyetler" items={form.activities}
          setItems={v => set('activities', v)}
          addLabel="+ Faaliyet Ekle"
          emptyItem={{ title: '', description: '', progress_percent: 0, status: 'Devam Ediyor' }}
          renderItem={(item, i, upd) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 20 }}>
              <input className="form-input" placeholder="Faaliyet başlığı *" value={item.title} onChange={e => upd(i, 'title', e.target.value)} maxLength={120} />
              <textarea className="form-input" rows={2} placeholder="Kısa açıklama" value={item.description} onChange={e => upd(i, 'description', e.target.value)} maxLength={200} style={{ resize: 'vertical' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: 11 }}>İlerleme: %{item.progress_percent}</label>
                  <input type="range" min={0} max={100} step={5} value={item.progress_percent} onChange={e => upd(i, 'progress_percent', Number(e.target.value))} style={{ width: '100%' }} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: 11 }}>Durum</label>
                  <select className="form-select" value={item.status} onChange={e => upd(i, 'status', e.target.value)}>
                    {ACTIVITY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
        />
      </div>)}

      {/* ── SECTION 2: Stakeholder Engagement ─────────────────────── */}
      {activeSection === 2 && (<div>
        <SectionHeader icon="🤝" title="Paydaş Temasları" subtitle="Bu hafta gerçekleşen paydaş etkileşimleri" />
        <RepeatableGroup
          label="Paydaş Temasları" items={form.stakeholder_engagements}
          setItems={v => set('stakeholder_engagements', v)}
          addLabel="+ Temas Ekle"
          emptyItem={{ stakeholder_name: '', stakeholder_type: 'STK', interaction_type: 'Toplantı', key_outcome: '', relationship_status: 'Gelişiyor' }}
          renderItem={(item, i, upd) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 20 }}>
              <input className="form-input" placeholder="Paydaş adı / kurum *" value={item.stakeholder_name} onChange={e => upd(i, 'stakeholder_name', e.target.value)} maxLength={100} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: 11 }}>Paydaş Türü</label>
                  <select className="form-select" value={item.stakeholder_type} onChange={e => upd(i, 'stakeholder_type', e.target.value)}>
                    {STAKEHOLDER_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: 11 }}>Etkileşim Türü</label>
                  <select className="form-select" value={item.interaction_type} onChange={e => upd(i, 'interaction_type', e.target.value)}>
                    {INTERACTION_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <textarea className="form-input" rows={2} placeholder="Temel sonuç / çıktı" value={item.key_outcome} onChange={e => upd(i, 'key_outcome', e.target.value)} maxLength={200} style={{ resize: 'vertical' }} />
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>İlişki Durumu</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {RELATIONSHIP_STATUS.map(rs => (
                    <button key={rs} type="button" onClick={() => upd(i, 'relationship_status', rs)}
                      className={`btn btn-sm ${item.relationship_status === rs ? 'btn-primary' : 'btn-outline'}`}
                      style={{ fontSize: 11, flex: 1 }}>{rs}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
        />
      </div>)}

      {/* ── SECTION 3: Risks ──────────────────────────────────────── */}
      {activeSection === 3 && (<div>
        <SectionHeader icon="⚠️" title="Riskler & Sorunlar" subtitle="Bu hafta tespit edilen veya devam eden riskler" />

        <div className="form-group" style={{ background: 'var(--bg-hover)', padding: 14, borderRadius: 10, marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            <input type="checkbox" checked={!form.has_risks}
              onChange={e => { set('has_risks', !e.target.checked); if (e.target.checked) set('risks', []); }} />
            Bu hafta önemli bir risk bulunmuyor
          </label>
        </div>

        {form.has_risks && (
          <RepeatableGroup
            label="Riskler" items={form.risks}
            setItems={v => set('risks', v)}
            addLabel="+ Risk Ekle"
            emptyItem={{ title: '', category: 'Operasyonel', probability: 'Orta', impact: 'Orta', mitigation: '', director_intervention: false }}
            renderItem={(item, i, upd) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 20 }}>
                <input className="form-input" placeholder="Risk başlığı *" value={item.title} onChange={e => upd(i, 'title', e.target.value)} maxLength={120} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Kategori</label>
                    <select className="form-select" value={item.category} onChange={e => upd(i, 'category', e.target.value)}>
                      {RISK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Olasılık</label>
                    <select className="form-select" value={item.probability} onChange={e => upd(i, 'probability', e.target.value)}>
                      {PROBABILITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Etki</label>
                    <select className="form-select" value={item.impact} onChange={e => upd(i, 'impact', e.target.value)}>
                      {IMPACT_OPTIONS.map(im => <option key={im} value={im}>{im}</option>)}
                    </select>
                  </div>
                </div>
                <textarea className="form-input" rows={2} placeholder="Risk azaltma / önerilen aksiyon" value={item.mitigation} onChange={e => upd(i, 'mitigation', e.target.value)} maxLength={300} style={{ resize: 'vertical' }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: item.director_intervention ? 'var(--red)' : 'var(--text)' }}>
                  <input type="checkbox" checked={item.director_intervention} onChange={e => upd(i, 'director_intervention', e.target.checked)} />
                  🔔 Direktör müdahalesi gerekli
                </label>
              </div>
            )}
          />
        )}
      </div>)}

      {/* ── SECTION 4: Opportunities ───────────────────────────────── */}
      {activeSection === 4 && (<div>
        <SectionHeader icon="💡" title="Fırsatlar" subtitle="Bu hafta tespit edilen fırsatlar ve potansiyel gelişmeler" />
        <RepeatableGroup
          label="Fırsatlar" items={form.opportunities}
          setItems={v => set('opportunities', v)}
          addLabel="+ Fırsat Ekle"
          emptyItem={{ title: '', type: 'Fon/Hibe', expected_impact: '', action_needed: '', deadline: '' }}
          renderItem={(item, i, upd) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 20 }}>
              <input className="form-input" placeholder="Fırsat başlığı *" value={item.title} onChange={e => upd(i, 'title', e.target.value)} maxLength={120} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: 11 }}>Tür</label>
                  <select className="form-select" value={item.type} onChange={e => upd(i, 'type', e.target.value)}>
                    {OPPORTUNITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: 11 }}>Son Tarih</label>
                  <input type="date" className="form-input" value={item.deadline} onChange={e => upd(i, 'deadline', e.target.value)} />
                </div>
              </div>
              <input className="form-input" placeholder="Beklenen etki/değer" value={item.expected_impact} onChange={e => upd(i, 'expected_impact', e.target.value)} maxLength={150} />
              <input className="form-input" placeholder="Gerekli aksiyon" value={item.action_needed} onChange={e => upd(i, 'action_needed', e.target.value)} maxLength={200} />
            </div>
          )}
        />
      </div>)}

      {/* ── SECTION 5: Coordination & Support ──────────────────────── */}
      {activeSection === 5 && (<div>
        <SectionHeader icon="🔗" title="Koordinasyon & Destek İhtiyaçları" subtitle="Direktörden veya diğer birimlerden beklenenler" />

        <div className="form-group">
          <label className="form-label">Direktörden Beklenen</label>
          <textarea className="form-input" rows={3} maxLength={300} placeholder="Direktörden ne tür bir destek, onay veya müdahale bekliyorsunuz?"
            value={form.director_request} onChange={e => set('director_request', e.target.value)} style={{ resize: 'vertical' }} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{form.director_request?.length || 0}/300</div>
        </div>

        <div className="form-group">
          <label className="form-label">Karar Gereken Konu</label>
          <textarea className="form-input" rows={3} maxLength={300} placeholder="Hangi konuda yönetsel karar bekliyorsunuz?"
            value={form.decision_needed} onChange={e => set('decision_needed', e.target.value)} style={{ resize: 'vertical' }} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{form.decision_needed?.length || 0}/300</div>
        </div>

        <div className="form-group">
          <label className="form-label">Birimler Arası Koordinasyon</label>
          <textarea className="form-input" rows={3} maxLength={300} placeholder="Diğer birimlerle hangi konuda koordinasyon gerekli?"
            value={form.cross_unit_coordination} onChange={e => set('cross_unit_coordination', e.target.value)} style={{ resize: 'vertical' }} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{form.cross_unit_coordination?.length || 0}/300</div>
        </div>
      </div>)}

      {/* ── SECTION 6: KPIs ────────────────────────────────────────── */}
      {activeSection === 6 && (<div>
        <SectionHeader icon="📈" title="Haftalık Göstergeler (KPI)" subtitle="Bu haftanın sayısal çıktıları" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {[
            { key: 'kpi_meetings_held', label: '🗓 Toplantı Sayısı', icon: '🗓' },
            { key: 'kpi_documents_produced', label: '📄 Üretilen Doküman', icon: '📄' },
            { key: 'kpi_stakeholder_contacts', label: '🤝 Paydaş Teması', icon: '🤝' },
            { key: 'kpi_field_visits', label: '🚗 Saha Ziyareti', icon: '🚗' },
            { key: 'kpi_proposals_submitted', label: '📝 Gönderilen Teklif', icon: '📝' },
          ].map(kpi => (
            <div key={kpi.key} style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>{kpi.label}</div>
              <input type="number" min={0} className="form-input" style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, padding: '8px 4px' }}
                value={form[kpi.key]} onChange={e => set(kpi.key, Math.max(0, Number(e.target.value) || 0))} />
            </div>
          ))}
        </div>
      </div>)}

      {/* ── SECTION 7: Next Week Priorities ────────────────────────── */}
      {activeSection === 7 && (<div>
        <SectionHeader icon="🎯" title="Gelecek Hafta Öncelikleri" subtitle="Gelecek haftanın en önemli öncelikleri (en az 1)" />
        <RepeatableGroup
          label="Öncelikler" items={form.next_week_priorities}
          setItems={v => set('next_week_priorities', v)}
          addLabel="+ Öncelik Ekle"
          maxItems={7}
          emptyItem={{ title: '', priority_level: 'Yüksek' }}
          renderItem={(item, i, upd) => (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingRight: 20 }}>
              <input className="form-input" placeholder="Öncelik açıklaması *" value={item.title} onChange={e => upd(i, 'title', e.target.value)} maxLength={150} style={{ flex: 1 }} />
              <select className="form-select" value={item.priority_level} onChange={e => upd(i, 'priority_level', e.target.value)} style={{ width: 100 }}>
                {PRIORITY_LEVELS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
        />
      </div>)}

      {/* ── Navigasyon & Kaydet ────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {activeSection > 0 && <button type="button" className="btn btn-outline" onClick={() => setActiveSection(activeSection - 1)}>← Önceki</button>}
          {activeSection < sections.length - 1 && <button type="button" className="btn btn-outline" onClick={() => setActiveSection(activeSection + 1)}>Sonraki →</button>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {onCancel && <button type="button" className="btn btn-outline" onClick={onCancel}>İptal</button>}
          <button type="button" className="btn btn-outline" onClick={() => handleSave(true)} disabled={saving}>💾 Taslak Kaydet</button>
          <button type="button" className="btn btn-primary" onClick={() => handleSave(false)} disabled={saving}>
            {saving ? '⏳ Gönderiliyor...' : '📤 Raporu Gönder'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RAPOR DETAY GÖRÜNÜMÜ (Direktör & Koordinatör)
// ═══════════════════════════════════════════════════════════════════════════════

function ReportDetailView({ report, onClose }) {
  if (!report) return null;

  const Badge = ({ color, children }) => (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: color + '20', color }}>{children}</span>
  );

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 720, maxHeight: '85vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>{STATUS_ICONS[report.overall_status]}</span>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>{report.unit}</h2>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{report.coordinator_name} — {weekLabel(report.week_start, report.week_end)}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
        </div>

        {/* Critical Flag */}
        {report.critical_flag && (
          <div style={{ background: '#fef2f2', border: '1.5px solid var(--red)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: 'var(--red)', fontSize: 14 }}>🚨 Kritik Konu</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>{report.critical_flag_detail}</div>
          </div>
        )}

        {/* Executive Summary */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>📊 Yönetici Özeti</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{report.executive_summary}</div>
        </div>

        {/* Activities */}
        {report.activities?.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>📋 Faaliyetler ({report.activities.length})</div>
            {report.activities.map((a, i) => (
              <div key={i} style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: 10, marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</span>
                  <Badge color={a.status === 'Tamamlandı' ? '#16a34a' : a.status === 'Ertelendi' ? '#d97706' : '#2563eb'}>{a.status}</Badge>
                </div>
                {a.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{a.description}</div>}
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border)' }}>
                    <div style={{ width: `${a.progress_percent}%`, height: '100%', borderRadius: 3, background: a.progress_percent === 100 ? '#16a34a' : '#2563eb', transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>%{a.progress_percent}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stakeholders */}
        {report.stakeholder_engagements?.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>🤝 Paydaş Temasları ({report.stakeholder_engagements.length})</div>
            {report.stakeholder_engagements.map((s, i) => (
              <div key={i} style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: 10, marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{s.stakeholder_name}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Badge color="#6b7280">{s.stakeholder_type}</Badge>
                    <Badge color={s.relationship_status === 'Güçlü' ? '#16a34a' : s.relationship_status === 'Risk Altında' ? '#dc2626' : '#d97706'}>{s.relationship_status}</Badge>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{s.interaction_type} — {s.key_outcome}</div>
              </div>
            ))}
          </div>
        )}

        {/* Risks */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>⚠️ Riskler</div>
          {!report.has_risks || report.risks?.length === 0 ? (
            <div style={{ background: '#f0fdf4', borderRadius: 8, padding: 10, fontSize: 13, color: '#16a34a', fontWeight: 500 }}>✅ Bu hafta önemli risk bulunmuyor</div>
          ) : (
            report.risks.map((r, i) => (
              <div key={i} style={{ background: r.director_intervention ? '#fef2f2' : 'var(--bg-hover)', border: r.director_intervention ? '1px solid var(--red)' : 'none', borderRadius: 8, padding: 10, marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{r.title}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Badge color="#6b7280">{r.category}</Badge>
                    <Badge color={r.probability === 'Yüksek' ? '#dc2626' : r.probability === 'Orta' ? '#d97706' : '#16a34a'}>P: {r.probability}</Badge>
                    <Badge color={r.impact === 'Kritik' || r.impact === 'Yüksek' ? '#dc2626' : r.impact === 'Orta' ? '#d97706' : '#16a34a'}>E: {r.impact}</Badge>
                  </div>
                </div>
                {r.mitigation && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Aksiyon: {r.mitigation}</div>}
                {r.director_intervention && <div style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600, marginTop: 4 }}>🔔 Direktör müdahalesi gerekli</div>}
              </div>
            ))
          )}
        </div>

        {/* Opportunities */}
        {report.opportunities?.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>💡 Fırsatlar ({report.opportunities.length})</div>
            {report.opportunities.map((o, i) => (
              <div key={i} style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: 10, marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{o.title}</span>
                  <Badge color="#7c3aed">{o.type}</Badge>
                </div>
                {o.expected_impact && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Etki: {o.expected_impact}</div>}
                {o.action_needed && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Aksiyon: {o.action_needed}</div>}
                {o.deadline && <div style={{ fontSize: 11, color: '#d97706', marginTop: 2 }}>Son Tarih: {fmtDisplayDate(o.deadline)}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Coordination */}
        {(report.director_request || report.decision_needed || report.cross_unit_coordination) && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>🔗 Koordinasyon & Destek</div>
            {report.director_request && (
              <div style={{ background: '#eff6ff', borderRadius: 8, padding: 10, marginBottom: 6 }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: '#2563eb' }}>Direktörden Beklenen</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>{report.director_request}</div>
              </div>
            )}
            {report.decision_needed && (
              <div style={{ background: '#fef3c7', borderRadius: 8, padding: 10, marginBottom: 6 }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: '#d97706' }}>Karar Gereken Konu</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>{report.decision_needed}</div>
              </div>
            )}
            {report.cross_unit_coordination && (
              <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: 10, marginBottom: 6 }}>
                <div style={{ fontWeight: 600, fontSize: 12 }}>Birimler Arası Koordinasyon</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>{report.cross_unit_coordination}</div>
              </div>
            )}
          </div>
        )}

        {/* KPIs */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>📈 Göstergeler</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { k: 'kpi_meetings_held', l: 'Toplantı', ic: '🗓' },
              { k: 'kpi_documents_produced', l: 'Doküman', ic: '📄' },
              { k: 'kpi_stakeholder_contacts', l: 'Paydaş Teması', ic: '🤝' },
              { k: 'kpi_field_visits', l: 'Saha Ziyareti', ic: '🚗' },
              { k: 'kpi_proposals_submitted', l: 'Teklif', ic: '📝' },
            ].map(kpi => (
              <div key={kpi.k} style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '8px 14px', textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{report[kpi.k] || 0}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{kpi.ic} {kpi.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Next Week */}
        {report.next_week_priorities?.length > 0 && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>🎯 Gelecek Hafta</div>
            {report.next_week_priorities.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <Badge color={p.priority_level === 'Yüksek' ? '#dc2626' : p.priority_level === 'Orta' ? '#d97706' : '#16a34a'}>{p.priority_level}</Badge>
                <span style={{ fontSize: 13 }}>{p.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DİREKTÖR DASHBOARD GÖRÜNÜMÜ
// ═══════════════════════════════════════════════════════════════════════════════

function DirectorDashboard({ reports, onViewReport }) {
  const weekStart = getWeekStart();

  // Bu haftanın raporları
  const thisWeek = useMemo(() => reports.filter(r => r.week_start === weekStart && r.status === 'submitted'), [reports, weekStart]);
  const drafts = useMemo(() => reports.filter(r => r.week_start === weekStart && r.status === 'draft'), [reports, weekStart]);

  // Son submitted rapor per unit (Türkçe → İngilizce eşleştirmeli)
  const latestByUnit = useMemo(() => {
    const map = {};
    reports.filter(r => r.status === 'submitted').forEach(r => {
      const key = matchUnitName(r.unit);
      if (!map[key] || r.week_start > map[key].week_start) map[key] = r;
    });
    return map;
  }, [reports]);

  // KPI'lar
  const unitsReporting = new Set(thisWeek.map(r => matchUnitName(r.unit))).size;
  const totalUnits = UNIT_LIST.length;
  const criticalFlags = thisWeek.filter(r => r.critical_flag).length;
  const redStatus = thisWeek.filter(r => r.overall_status === 'red').length;
  const yellowStatus = thisWeek.filter(r => r.overall_status === 'yellow').length;
  const decisionsNeeded = thisWeek.filter(r => r.decision_needed?.trim()).length;
  const directorRequests = thisWeek.filter(r => r.director_request?.trim()).length;
  const interventionRisks = thisWeek.reduce((sum, r) => sum + (r.risks || []).filter(risk => risk.director_intervention).length, 0);

  return (
    <div>
      {/* KPI Kartları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-value">{unitsReporting}/{totalUnits}</div>
          <div className="stat-label">Birim Raporladı</div>
        </div>
        <div className="stat-card" style={{ borderLeft: `3px solid ${STATUS_COLORS.red}` }}>
          <div className="stat-value" style={{ color: criticalFlags > 0 ? 'var(--red)' : undefined }}>{criticalFlags}</div>
          <div className="stat-label">🚨 Kritik Bayrak</div>
        </div>
        <div className="stat-card" style={{ borderLeft: `3px solid ${STATUS_COLORS.red}` }}>
          <div className="stat-value" style={{ color: redStatus > 0 ? 'var(--red)' : undefined }}>{redStatus}</div>
          <div className="stat-label">🔴 Kritik Durum</div>
        </div>
        <div className="stat-card" style={{ borderLeft: `3px solid ${STATUS_COLORS.yellow}` }}>
          <div className="stat-value" style={{ color: yellowStatus > 0 ? '#d97706' : undefined }}>{yellowStatus}</div>
          <div className="stat-label">🟡 Dikkat Gerekli</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #2563eb' }}>
          <div className="stat-value">{decisionsNeeded}</div>
          <div className="stat-label">⚖️ Karar Bekliyor</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #7c3aed' }}>
          <div className="stat-value">{interventionRisks}</div>
          <div className="stat-label">🔔 Müdahale Gerekli</div>
        </div>
      </div>

      {/* Raporlamayan birimler */}
      {unitsReporting < totalUnits && (
        <div style={{ background: '#fef3c7', borderRadius: 10, padding: 12, marginBottom: 20, fontSize: 13 }}>
          <strong>⏳ Henüz raporlamayan birimler:</strong>{' '}
          {UNIT_LIST.filter(u => !thisWeek.find(r => matchUnitName(r.unit) === u.name)).map(u => u.name).join(', ')}
        </div>
      )}

      {/* Director Action Items — kritik konular, kararlar, müdahale */}
      {(criticalFlags > 0 || decisionsNeeded > 0 || interventionRisks > 0) && (
        <div style={{ background: '#fef2f2', borderRadius: 12, padding: 16, marginBottom: 20, border: '1px solid #fecaca' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>🚨 Dikkat Gereken Konular</h3>
          {thisWeek.filter(r => r.critical_flag).map(r => (
            <div key={r.id + '-crit'} style={{ padding: '8px 0', borderBottom: '1px solid #fecaca', fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>{UNIT_ICON_MAP[r.unit]} {r.unit}:</span> {r.critical_flag_detail}
            </div>
          ))}
          {thisWeek.filter(r => r.decision_needed?.trim()).map(r => (
            <div key={r.id + '-dec'} style={{ padding: '8px 0', borderBottom: '1px solid #fecaca', fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>⚖️ {r.unit}:</span> {r.decision_needed}
            </div>
          ))}
          {thisWeek.flatMap(r => (r.risks || []).filter(risk => risk.director_intervention).map(risk => ({ ...risk, unit: r.unit, reportId: r.id }))).map((risk, i) => (
            <div key={i + '-risk'} style={{ padding: '8px 0', borderBottom: '1px solid #fecaca', fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>🔔 {risk.unit}:</span> {risk.title} — {risk.mitigation}
            </div>
          ))}
        </div>
      )}

      {/* Birim Kartları */}
      <h3 style={{ fontSize: 15, marginBottom: 12 }}>📊 Birim Durumları — {weekLabel(weekStart, getWeekEnd(weekStart))}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {UNIT_LIST.map(unit => {
          const report = latestByUnit[unit.name];
          const isThisWeek = report?.week_start === weekStart;
          return (
            <div key={unit.name} className="card"
              style={{ cursor: report ? 'pointer' : 'default', opacity: report ? 1 : 0.6, borderLeft: `4px solid ${report ? STATUS_COLORS[report.overall_status] || '#9ca3af' : '#9ca3af'}` }}
              onClick={() => report && onViewReport(report)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 20 }}>{unit.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{unit.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{report ? report.coordinator_name : unit.coordinator}</div>
                </div>
                {report && <span style={{ fontSize: 20 }}>{STATUS_ICONS[report.overall_status]}</span>}
              </div>
              {report ? (
                <div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text)', marginBottom: 8 }}>
                    {report.executive_summary?.slice(0, 150)}{report.executive_summary?.length > 150 ? '…' : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 11 }}>
                    {report.critical_flag && <span className="badge badge-red">🚨 Kritik</span>}
                    {report.decision_needed?.trim() && <span className="badge badge-orange">⚖️ Karar</span>}
                    {(report.risks || []).some(r => r.director_intervention) && <span className="badge badge-red">🔔 Müdahale</span>}
                    {report.opportunities?.length > 0 && <span className="badge badge-blue">💡 {report.opportunities.length} fırsat</span>}
                    <span className="badge badge-gray">{fmtDisplayDate(report.week_start)}</span>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Bu hafta henüz rapor yok</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Geçmiş Raporlar */}
      {reports.filter(r => r.status === 'submitted' && r.week_start !== weekStart).length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>📁 Geçmiş Raporlar</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Birim</th>
                  <th>Hafta</th>
                  <th>Durum</th>
                  <th>Özet</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reports.filter(r => r.status === 'submitted' && r.week_start !== weekStart).slice(0, 20).map(r => (
                  <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => onViewReport(r)}>
                    <td>{UNIT_ICON_MAP[r.unit]} {r.unit}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDisplayDate(r.week_start)}</td>
                    <td>{STATUS_ICONS[r.overall_status]} {STATUS_LABELS[r.overall_status]}</td>
                    <td>{r.executive_summary?.slice(0, 80)}…</td>
                    <td><button className="btn btn-outline btn-sm">Görüntüle</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// KOORDİNATÖR GÖRÜNÜMÜ
// ═══════════════════════════════════════════════════════════════════════════════

function CoordinatorView({ reports, user, profile, onViewReport }) {
  const [showForm, setShowForm] = useState(false);
  const [editReport, setEditReport] = useState(null);

  const weekStart = getWeekStart();
  const weekEnd = getWeekEnd(weekStart);
  const myReports = useMemo(() => reports.filter(r => r.user_id === user.id).sort((a, b) => b.week_start.localeCompare(a.week_start)), [reports, user.id]);
  const thisWeekReport = myReports.find(r => r.week_start === weekStart);
  const submittedReports = myReports.filter(r => r.status === 'submitted');
  const unitColor = getUnitColor(profile.unit);

  // İstatistikler
  const totalSubmitted = submittedReports.length;
  const greenCount = submittedReports.filter(r => r.overall_status === 'green').length;
  const yellowCount = submittedReports.filter(r => r.overall_status === 'yellow').length;
  const redCount = submittedReports.filter(r => r.overall_status === 'red').length;

  // Son rapordan bu yana kaç gün
  const lastReport = submittedReports[0];
  const daysSinceLast = lastReport ? Math.floor((new Date() - new Date(lastReport.submitted_at || lastReport.week_end)) / 86400000) : null;

  const handleSaved = (saved) => {
    setShowForm(false);
    setEditReport(null);
    window.location.reload();
  };

  if (showForm || editReport) {
    return (
      <ReportForm
        profile={profile}
        user={user}
        existingReport={editReport}
        onSaved={handleSaved}
        onCancel={() => { setShowForm(false); setEditReport(null); }}
      />
    );
  }

  return (
    <div>
      {/* ── Hero Card ─────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, ${unitColor}12 0%, ${unitColor}06 100%)`,
        border: `1.5px solid ${unitColor}30`,
        borderRadius: 16, padding: '24px 28px', marginBottom: 24,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Dekoratif arka plan ikonu */}
        <div style={{
          position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)',
          fontSize: 80, opacity: 0.06, pointerEvents: 'none',
        }}>{UNIT_ICON_MAP[profile.unit] || '📊'}</div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: unitColor + '20', fontSize: 22,
              }}>{UNIT_ICON_MAP[profile.unit] || '📊'}</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>{profile.unit}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{profile.full_name}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 14px', borderRadius: 20,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                fontSize: 13, fontWeight: 600, color: 'var(--text)',
              }}>
                📅 {weekLabel(weekStart, weekEnd)}
              </div>

              {thisWeekReport?.status === 'submitted' && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 14px', borderRadius: 20,
                  background: '#dcfce7', border: '1px solid #bbf7d0',
                  fontSize: 13, fontWeight: 700, color: '#15803d',
                }}>✅ Gönderildi</div>
              )}
              {thisWeekReport?.status === 'draft' && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 14px', borderRadius: 20,
                  background: '#fef3c7', border: '1px solid #fde68a',
                  fontSize: 13, fontWeight: 700, color: '#92400e',
                }}>📝 Taslak Kaydedildi</div>
              )}
              {!thisWeekReport && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 14px', borderRadius: 20,
                  background: '#fef2f2', border: '1px solid #fecaca',
                  fontSize: 13, fontWeight: 700, color: '#991b1b',
                }}>⏳ Henüz girilmedi</div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {thisWeekReport?.status === 'draft' && (
              <button className="btn btn-primary" onClick={() => setEditReport(thisWeekReport)}
                style={{ background: unitColor, borderColor: unitColor, fontWeight: 700, padding: '10px 20px', borderRadius: 12, fontSize: 14 }}>
                📝 Taslağı Düzenle
              </button>
            )}
            {!thisWeekReport && (
              <button className="btn btn-primary" onClick={() => setShowForm(true)}
                style={{ background: unitColor, borderColor: unitColor, fontWeight: 700, padding: '10px 20px', borderRadius: 12, fontSize: 14 }}>
                + Yeni Haftalık Rapor
              </button>
            )}
            {thisWeekReport?.status === 'submitted' && (
              <button className="btn btn-outline" onClick={() => onViewReport(thisWeekReport)}
                style={{ fontWeight: 600, padding: '10px 20px', borderRadius: 12, fontSize: 14, borderColor: unitColor, color: unitColor }}>
                📄 Raporu Görüntüle
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Mini İstatistikler ────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 28 }}>
        <div style={{
          background: 'var(--bg-card)', borderRadius: 12, padding: '16px 14px', textAlign: 'center',
          border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: unitColor }}>{totalSubmitted}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>Toplam Rapor</div>
        </div>
        <div style={{
          background: 'var(--bg-card)', borderRadius: 12, padding: '16px 14px', textAlign: 'center',
          border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#16a34a' }}>{greenCount}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>🟢 Normal</div>
        </div>
        <div style={{
          background: 'var(--bg-card)', borderRadius: 12, padding: '16px 14px', textAlign: 'center',
          border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#d97706' }}>{yellowCount}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>🟡 Dikkat</div>
        </div>
        <div style={{
          background: 'var(--bg-card)', borderRadius: 12, padding: '16px 14px', textAlign: 'center',
          border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#dc2626' }}>{redCount}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>🔴 Kritik</div>
        </div>
      </div>

      {/* ── Rapor Geçmişi ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, margin: 0, fontWeight: 700 }}>📁 Rapor Geçmişi</h3>
        {daysSinceLast !== null && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
            Son rapor: {daysSinceLast === 0 ? 'Bugün' : `${daysSinceLast} gün önce`}
          </span>
        )}
      </div>

      {myReports.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 20px', borderRadius: 16,
          background: `linear-gradient(135deg, ${unitColor}08 0%, transparent 100%)`,
          border: '1.5px dashed var(--border)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 14, opacity: 0.6 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Henüz rapor girmediniz</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Haftalık birim raporunuzu girerek departman yönetimine katkıda bulunun.</div>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}
            style={{ background: unitColor, borderColor: unitColor, fontWeight: 700, padding: '10px 24px', borderRadius: 12 }}>
            İlk Raporu Oluştur
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {myReports.map(r => {
            const statusColor = STATUS_COLORS[r.overall_status] || '#9ca3af';
            const isDraft = r.status === 'draft';
            return (
              <div key={r.id}
                style={{
                  background: 'var(--bg-card)', borderRadius: 14, padding: '16px 20px',
                  border: '1px solid var(--border)', borderLeft: `4px solid ${isDraft ? '#d97706' : statusColor}`,
                  cursor: 'pointer', transition: 'all 0.15s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
                onClick={() => isDraft ? setEditReport(r) : onViewReport(r)}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 200 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: statusColor + '15', fontSize: 18, flexShrink: 0,
                    }}>{STATUS_ICONS[r.overall_status]}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                          {weekLabel(r.week_start, r.week_end)}
                        </span>
                        {isDraft && (
                          <span style={{
                            padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                            background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a',
                          }}>Taslak</span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.executive_summary?.slice(0, 120) || 'Özet girilmemiş'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {/* Mini KPI badges */}
                    {(r.activities?.length > 0 || r.stakeholder_engagements?.length > 0) && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        {r.activities?.length > 0 && (
                          <span style={{ padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                            📋 {r.activities.length}
                          </span>
                        )}
                        {r.stakeholder_engagements?.length > 0 && (
                          <span style={{ padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                            🤝 {r.stakeholder_engagements.length}
                          </span>
                        )}
                        {r.critical_flag && (
                          <span style={{ padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: '#fef2f2', color: '#dc2626' }}>
                            🚨
                          </span>
                        )}
                      </div>
                    )}

                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right', minWidth: 80 }}>
                      {r.submitted_at ? fmtDisplayDate(r.submitted_at.slice(0, 10)) : 'Gönderilmedi'}
                    </div>

                    <button className="btn btn-outline btn-sm"
                      onClick={e => { e.stopPropagation(); isDraft ? setEditReport(r) : onViewReport(r); }}
                      style={{ borderRadius: 10, fontWeight: 600, fontSize: 12, padding: '6px 14px', borderColor: unitColor + '60', color: unitColor }}>
                      {isDraft ? 'Düzenle' : 'Görüntüle'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANA BİLEŞEN
// ═══════════════════════════════════════════════════════════════════════════════

export default function UnitReports({ user, profile, onNavigate }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);

  const isDirector = ['direktor', 'asistan', 'direktor_yardimcisi'].includes(profile?.role);
  const isCoordinator = profile?.role === 'koordinator';

  useEffect(() => {
    loadReports();
  }, [user, profile]);

  const loadReports = async () => {
    setLoading(true);
    try {
      let query;
      if (isDirector) {
        query = supabase.from('weekly_unit_reports').select('*').order('week_start', { ascending: false });
      } else {
        query = supabase.from('weekly_unit_reports').select('*').eq('user_id', user.id).order('week_start', { ascending: false });
      }
      const { data, error } = await query;
      if (error) throw error;
      setReports(data || []);
    } catch (e) {
      console.error('Rapor yükleme hatası:', e);
    } finally { setLoading(false); }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="loading-spinner" /></div>;
  }

  // Personel erişimi — sadece koordinatör ve üstü
  if (!isDirector && !isCoordinator) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Bu modül sadece koordinatörler için erişilebilir</div>
        <div style={{ fontSize: 13, marginTop: 8 }}>Birim raporları koordinatörler tarafından haftalık olarak girilir.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📊 Haftalık Birim Raporları</h1>
      </div>

      {isDirector ? (
        <DirectorDashboard reports={reports} onViewReport={setSelectedReport} />
      ) : (
        <CoordinatorView reports={reports} user={user} profile={profile} onViewReport={setSelectedReport} />
      )}

      {selectedReport && (
        <ReportDetailView report={selectedReport} onClose={() => setSelectedReport(null)} />
      )}
    </div>
  );
}
