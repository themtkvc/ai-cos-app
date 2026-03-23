import React, { useState, useEffect, useMemo } from 'react';
import { getUnitReports, getAllUnitReports, createUnitReport } from '../lib/supabase';
import { UNITS as UNIT_LIST, UNIT_ICON_MAP, ROLE_LABELS, avatarColor, fmtDisplayDate } from '../lib/constants';
import EmptyState from '../components/EmptyState';

// ── STATUS CONFIGURATIONS ────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'Yolunda', label: 'Yolunda', color: '#10b981' },
  { value: 'Geride', label: 'Geride', color: '#f59e0b' },
  { value: 'Risk Altında', label: 'Risk Altında', color: '#ef4444' },
  { value: 'Tamamlandı', label: 'Tamamlandı', color: '#3b82f6' },
];

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().slice(0, 10);
}

function getStatusColor(status) {
  const s = STATUS_OPTIONS.find(o => o.value === status);
  return s ? s.color : '#9ca3af';
}

function getStatusBadgeClass(status) {
  if (status === 'Yolunda') return 'badge-green';
  if (status === 'Geride') return 'badge-orange';
  if (status === 'Risk Altında') return 'badge-red';
  if (status === 'Tamamlandı') return 'badge-blue';
  return 'badge-gray';
}

// ── SHARED MODAL COMPONENT ───────────────────────────────────────────────────────
function ReportModal({ form, setForm, saving, onSave, onClose, visibleUnits, isKoordinator }) {
  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" style={{ maxWidth: 680 }}>
        <h2 className="modal-title">📊 Haftalık Birim Raporu</h2>

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* UNIT & COORDINATOR */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Birim</label>
              <select
                className="form-select"
                value={form.unit}
                disabled={isKoordinator}
                onChange={(e) => {
                  const unit = UNIT_LIST.find(u => u.name === e.target.value) || UNIT_LIST[0];
                  setForm(f => ({ ...f, unit: unit.name, coordinator: unit.coordinator }));
                }}
              >
                {visibleUnits.map(u => <option key={u.name}>{u.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Koordinatör</label>
              <input
                className="form-input"
                type="text"
                value={form.coordinator}
                readOnly
                style={{ background: 'var(--surface)', cursor: 'default' }}
              />
            </div>
          </div>

          {/* DATE & STATUS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Hafta Başlangıcı</label>
              <input
                className="form-input"
                type="date"
                value={form.week_of}
                onChange={(e) => setForm(f => ({ ...f, week_of: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Genel Durum</label>
              <select
                className="form-select"
                value={form.overall_status}
                onChange={(e) => setForm(f => ({ ...f, overall_status: e.target.value }))}
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value}>{s.value}</option>
                ))}
              </select>
            </div>
          </div>

          {/* KEY ACHIEVEMENT (REQUIRED) */}
          <div className="form-group">
            <label className="form-label">🏆 Haftanın Başarısı *</label>
            <textarea
              className="form-textarea"
              style={{ minHeight: 70, resize: 'vertical' }}
              placeholder="Bu hafta birim ne başardı? İlerleme, tamamlanan görevler, başarılı anlaşmalar..."
              value={form.key_achievement}
              onChange={(e) => setForm(f => ({ ...f, key_achievement: e.target.value }))}
            />
          </div>

          {/* MAIN CHALLENGE */}
          <div className="form-group">
            <label className="form-label">⚠️ Ana Zorluk</label>
            <textarea
              className="form-textarea"
              style={{ minHeight: 60, resize: 'vertical' }}
              placeholder="Bu hafta karşılaşılan en büyük engel, gecikme veya zorluk..."
              value={form.main_challenge}
              onChange={(e) => setForm(f => ({ ...f, main_challenge: e.target.value }))}
            />
          </div>

          {/* DECISION NEEDED */}
          <div className="form-group">
            <label className="form-label">🔔 Direktörden Karar Gerekiyor mu?</label>
            <textarea
              className="form-textarea"
              style={{ minHeight: 55, resize: 'vertical' }}
              placeholder="Varsa direktör kararı gerektiren konuyu yazın (bütçe, kaynaklar, politika vb.)..."
              value={form.decision_needed}
              onChange={(e) => setForm(f => ({ ...f, decision_needed: e.target.value }))}
            />
          </div>

          {/* ESCALATION */}
          <div className="form-group">
            <label className="form-label">🚨 Eskalasyon Gerekiyor mu?</label>
            <textarea
              className="form-textarea"
              style={{ minHeight: 55, resize: 'vertical' }}
              placeholder="Üst yönetime taşınması gereken acil konu varsa..."
              value={form.escalation}
              onChange={(e) => setForm(f => ({ ...f, escalation: e.target.value }))}
            />
          </div>

          {/* NEXT WEEK PRIORITIES */}
          <div className="form-group">
            <label className="form-label">📌 Önümüzdeki Hafta Öncelikleri</label>
            <textarea
              className="form-textarea"
              style={{ minHeight: 60, resize: 'vertical' }}
              placeholder="Gelecek haftanın 2-3 ana önceliği..."
              value={form.next_week_priorities}
              onChange={(e) => setForm(f => ({ ...f, next_week_priorities: e.target.value }))}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>İptal</button>
          <button
            className="btn btn-primary"
            onClick={onSave}
            disabled={saving || !form.key_achievement.trim()}
          >
            {saving ? '⏳ Kaydediliyor…' : '✓ Raporu Gönder'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── REPORT DETAIL SECTIONS (reusable) ────────────────────────────────────────────
const REPORT_FIELDS = [
  { label: '🏆 Haftanın Başarısı', key: 'key_achievement' },
  { label: '⚠️ Ana Zorluk', key: 'main_challenge' },
  { label: '🔔 Direktörden Karar Gerekiyor', key: 'decision_needed' },
  { label: '🚨 Eskalasyon', key: 'escalation' },
  { label: '📌 Önümüzdeki Hafta', key: 'next_week_priorities' },
];

function ReportDetail({ report }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {REPORT_FIELDS.filter(f => report[f.key]).map(({ label, key }) => (
        <div key={key}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
            {label}
          </div>
          <div style={{
            padding: 12, background: 'var(--surface)', borderRadius: 6,
            border: '1px solid var(--border)', fontSize: 13,
            color: 'var(--text)', lineHeight: 1.6
          }}>
            {report[key]}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────────
export default function UnitReports({ user, profile, onNavigate }) {
  // ── ROLE DETECTION ────────────────────────────────────────────────────────
  const isDirektor = ['direktor', 'direktor_yardimcisi', 'asistan'].includes(profile?.role);
  const isKoordinator = profile?.role === 'koordinator';
  const isPersonel = profile?.role === 'personel';
  const userUnit = profile?.unit || '';

  // ── STATE ──────────────────────────────────────────────────────────────────
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    unit: '', coordinator: '', week_of: getWeekStart(),
    overall_status: 'Yolunda', key_achievement: '', main_challenge: '',
    decision_needed: '', escalation: '', next_week_priorities: '',
  });
  const [saving, setSaving] = useState(false);
  const [expandedReport, setExpandedReport] = useState(null);

  // ── DATA LOADING ───────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    try {
      if (isDirektor) {
        const { data } = await getAllUnitReports();
        setReports(data || []);
      } else if (isKoordinator || isPersonel) {
        const { data } = await getUnitReports(user.id);
        const filtered = (data || []).filter(r => r.unit === userUnit);
        setReports(filtered);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
      setReports([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, isDirektor, isKoordinator, isPersonel, userUnit]);

  // ── DERIVED DATA ──────────────────────────────────────────────────────────
  // For director: group reports by unit, only units that have reports
  const reportsByUnit = useMemo(() => {
    const grouped = {};
    reports.forEach(r => {
      if (!grouped[r.unit]) grouped[r.unit] = [];
      grouped[r.unit].push(r);
    });
    // Sort each unit's reports by date descending
    Object.values(grouped).forEach(arr =>
      arr.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
    );
    return grouped;
  }, [reports]);

  const unitsWithReports = useMemo(() => {
    return UNIT_LIST.filter(u => reportsByUnit[u.name]?.length > 0);
  }, [reportsByUnit]);

  // KPI for director
  const kpiStats = useMemo(() => {
    if (!isDirektor) return null;
    const thisWeekStart = getWeekStart();
    let unitsReporting = 0;
    let unitsBehind = 0;
    let unitsAtRisk = 0;
    let decisionsNeeded = 0;

    UNIT_LIST.forEach(unit => {
      const unitReports = reportsByUnit[unit.name];
      if (!unitReports?.length) return;
      const latest = unitReports[0];
      if (latest.week_of === thisWeekStart) {
        unitsReporting++;
        if (latest.overall_status === 'Geride') unitsBehind++;
        else if (latest.overall_status === 'Risk Altında') unitsAtRisk++;
        if (latest.decision_needed?.trim()) decisionsNeeded++;
      }
    });

    return { unitsReporting, unitsBehind, unitsAtRisk, decisionsNeeded };
  }, [isDirektor, reportsByUnit]);

  // Visible units for modal dropdown
  const visibleUnits = useMemo(() => {
    if (isDirektor) return UNIT_LIST;
    if (isKoordinator) return UNIT_LIST.filter(u => u.name === userUnit);
    return [];
  }, [isDirektor, isKoordinator, userUnit]);

  // ── HANDLERS ───────────────────────────────────────────────────────────────
  const openModal = (unitName = null) => {
    const unit = unitName
      ? UNIT_LIST.find(u => u.name === unitName) || UNIT_LIST[0]
      : (isKoordinator ? UNIT_LIST.find(u => u.name === userUnit) || UNIT_LIST[0] : UNIT_LIST[0]);

    setForm({
      unit: unit.name, coordinator: unit.coordinator, week_of: getWeekStart(),
      overall_status: 'Yolunda', key_achievement: '', main_challenge: '',
      decision_needed: '', escalation: '', next_week_priorities: '',
    });
    setModal(true);
  };

  const save = async () => {
    if (!form.key_achievement?.trim()) {
      alert('Lütfen haftanın başarısını yazınız.');
      return;
    }
    setSaving(true);
    try {
      await createUnitReport({ ...form, user_id: user.id });
      await load();
      setModal(false);
    } catch (error) {
      console.error('Error saving report:', error);
      alert('Rapor kaydedilirken hata oluştu.');
    }
    setSaving(false);
  };

  // ── RENDER: LOADING ────────────────────────────────────────────────────────
  if (loading) {
    return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Yükleniyor…</div>;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // ── DIRECTOR VIEW: Only submitted reports, consolidated ────────────────────
  // ══════════════════════════════════════════════════════════════════════════════
  if (isDirektor) {
    return (
      <div className="page">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div>
              <h1 className="page-title">📊 Birim Raporları</h1>
              <p className="page-subtitle">
                Bu hafta {kpiStats.unitsReporting}/{UNIT_LIST.length} birim raporladı
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => onNavigate('chat', {
                initialMessage: 'Birim raporlarını özetle, hangi birimde sorun var, direktör olarak ne yapmalıyım?'
              })}
            >
              🤖 AI ile analiz et
            </button>
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>
              Raporlayan Birimler
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--green)' }}>
              {kpiStats.unitsReporting}
              <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--text-muted)' }}>/{UNIT_LIST.length}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>
              Geride Kalan
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: kpiStats.unitsBehind > 0 ? 'var(--orange)' : 'var(--green)' }}>
              {kpiStats.unitsBehind}
            </div>
          </div>
          <div className="kpi-card">
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>
              Risk Altında
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: kpiStats.unitsAtRisk > 0 ? 'var(--red)' : 'var(--green)' }}>
              {kpiStats.unitsAtRisk}
            </div>
          </div>
          <div className="kpi-card">
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>
              Karar Bekleyen
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: kpiStats.decisionsNeeded > 0 ? 'var(--orange)' : 'var(--text-muted)' }}>
              {kpiStats.decisionsNeeded}
            </div>
          </div>
        </div>

        {/* SUBMITTED REPORTS — Only units that have reports */}
        <div style={{ marginTop: 32 }}>
          {unitsWithReports.length === 0 ? (
            <EmptyState
              icon="📭"
              title="Henüz rapor gönderilmemiş"
              sub="Koordinatörler haftalık raporlarını gönderdikçe burada görünecek"
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {unitsWithReports.map(unit => {
                const unitReports = reportsByUnit[unit.name];
                const latest = unitReports[0];
                const daysAgo = Math.floor((new Date() - new Date(latest.submitted_at)) / 86400000);
                const isExpanded = expandedReport === unit.name;

                return (
                  <div
                    key={unit.name}
                    className="card"
                    style={{
                      borderLeft: `4px solid ${getStatusColor(latest.overall_status)}`,
                      padding: 0, overflow: 'hidden'
                    }}
                  >
                    {/* UNIT HEADER ROW */}
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '16px 20px', cursor: 'pointer',
                        background: isExpanded ? 'var(--surface)' : 'transparent',
                        transition: 'background 0.15s'
                      }}
                      onClick={() => setExpandedReport(isExpanded ? null : unit.name)}
                    >
                      <span style={{ fontSize: 24 }}>{unit.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                            {unit.name}
                          </span>
                          <span className={`badge ${getStatusBadgeClass(latest.overall_status)}`} style={{ fontSize: 10 }}>
                            {latest.overall_status}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          Koordinatör: {unit.coordinator} · Hafta: {latest.week_of}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{
                          fontSize: 11,
                          color: daysAgo <= 7 ? 'var(--green)' : 'var(--orange)',
                          fontWeight: 500
                        }}>
                          {daysAgo === 0 ? '✅ Bugün' : daysAgo === 1 ? '✅ Dün' : `⚠️ ${daysAgo} gün önce`}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          {isExpanded ? '▼ Gizle' : '▶ Detay'}
                        </div>
                      </div>
                    </div>

                    {/* QUICK PREVIEW — always visible */}
                    <div style={{ padding: '0 20px 12px 56px' }}>
                      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
                        {latest.key_achievement?.length > 120
                          ? latest.key_achievement.slice(0, 120) + '…'
                          : latest.key_achievement}
                      </div>
                      {latest.decision_needed?.trim() && (
                        <div style={{
                          marginTop: 6, padding: '4px 8px', borderRadius: 4,
                          background: 'rgba(234, 88, 12, 0.08)', border: '1px solid rgba(234, 88, 12, 0.2)',
                          fontSize: 11, color: 'var(--orange)', fontWeight: 500
                        }}>
                          🔔 Karar bekleniyor
                        </div>
                      )}
                    </div>

                    {/* EXPANDED DETAILS */}
                    {isExpanded && (
                      <div style={{
                        padding: '16px 20px', borderTop: '1px solid var(--border)',
                        background: 'var(--surface)'
                      }}>
                        <ReportDetail report={latest} />

                        {/* PAST REPORTS */}
                        {unitReports.length > 1 && (
                          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
                              Önceki Raporlar
                            </div>
                            {unitReports.slice(1, 4).map(r => (
                              <div key={r.id} style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '6px 0', borderBottom: '1px solid var(--border)',
                                fontSize: 12
                              }}>
                                <span className={`badge ${getStatusBadgeClass(r.overall_status)}`} style={{ fontSize: 10 }}>
                                  {r.overall_status}
                                </span>
                                <span style={{ color: 'var(--text)', fontWeight: 500 }}>{r.week_of}</span>
                                <span style={{ color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {r.key_achievement?.slice(0, 60)}
                                </span>
                                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                                  {fmtDisplayDate(r.submitted_at)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // ── COORDINATOR VIEW: Own unit only ────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════
  if (isKoordinator) {
    const unitReports = reports.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
    const latestReport = unitReports[0] || null;
    const unitInfo = UNIT_LIST.find(u => u.name === userUnit);

    return (
      <div className="page">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div>
              <h1 className="page-title">
                {unitInfo?.icon || '📊'} {userUnit} — Haftalık Rapor
              </h1>
              <p className="page-subtitle">
                {unitReports.length > 0
                  ? `Toplam ${unitReports.length} rapor · Son: ${fmtDisplayDate(latestReport?.submitted_at)}`
                  : 'Henüz rapor oluşturulmadı'}
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => openModal(userUnit)}>
              + Yeni Rapor Ekle
            </button>
          </div>
        </div>

        {/* LATEST REPORT PREVIEW */}
        {latestReport && (
          <div style={{ marginTop: 24 }}>
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-dot">•</span>
                Son Rapor
              </h2>
              <span className={`badge ${getStatusBadgeClass(latestReport.overall_status)}`}>
                {latestReport.overall_status}
              </span>
            </div>
            <div className="card" style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                    Hafta: {latestReport.week_of}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Gönderim: {fmtDisplayDate(latestReport.submitted_at)}
                  </div>
                </div>
              </div>
              <ReportDetail report={latestReport} />
            </div>
          </div>
        )}

        {/* REPORT HISTORY TABLE */}
        <div style={{ marginTop: 28 }}>
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-dot">•</span>
              Geçmiş Raporlar
            </h2>
          </div>

          {unitReports.length === 0 ? (
            <EmptyState
              icon="📭"
              title="Henüz rapor yok"
              sub="İlk haftalık raporunuzu oluşturmak için yukarıdaki butona tıklayın"
            />
          ) : (
            <div className="card" style={{ marginTop: 12, padding: 0, overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Hafta</th>
                    <th>Durum</th>
                    <th>Başarı</th>
                    <th>Zorluk</th>
                    <th>Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {unitReports.map((r, i) => (
                    <tr key={r.id} className={i % 2 === 1 ? 'row-alt' : ''}>
                      <td style={{ fontWeight: 500, fontSize: 13 }}>{r.week_of}</td>
                      <td>
                        <span className={`badge ${getStatusBadgeClass(r.overall_status)}`} style={{ fontSize: 11 }}>
                          {r.overall_status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, maxWidth: 200 }}>
                        {r.key_achievement?.slice(0, 50)}{r.key_achievement?.length > 50 ? '…' : ''}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 180 }}>
                        {r.main_challenge?.slice(0, 50)}{r.main_challenge?.length > 50 ? '…' : ''}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {fmtDisplayDate(r.submitted_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MODAL — rendered inside coordinator view */}
        {modal && (
          <ReportModal
            form={form} setForm={setForm} saving={saving}
            onSave={save} onClose={() => setModal(false)}
            visibleUnits={visibleUnits} isKoordinator={true}
          />
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // ── PERSONEL VIEW: Read-only latest report ─────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════
  if (isPersonel) {
    const latestReport = reports.length > 0
      ? reports.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))[0]
      : null;

    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">📊 Birim Raporu</h1>
            <p className="page-subtitle">
              {userUnit} biriminin son haftalık raporu
            </p>
          </div>
        </div>

        {latestReport ? (
          <div style={{ marginTop: 24 }}>
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                    Hafta: {latestReport.week_of}
                  </h2>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Raporlayan: {latestReport.coordinator}
                  </div>
                </div>
                <span className={`badge ${getStatusBadgeClass(latestReport.overall_status)}`}>
                  {latestReport.overall_status}
                </span>
              </div>

              <ReportDetail report={latestReport} />

              <div style={{
                marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)',
                fontSize: 11, color: 'var(--text-muted)'
              }}>
                Raporlama tarihi: {fmtDisplayDate(latestReport.submitted_at)}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            icon="📭"
            title="Henüz rapor yok"
            sub="Biriminizin raporu henüz oluşturulmadı"
          />
        )}
      </div>
    );
  }

  // ── FALLBACK (no role match) ─────────────────────────────────────────────────
  return (
    <div className="page">
      <EmptyState icon="🔒" title="Erişim yok" sub="Bu sayfayı görüntüleme yetkiniz bulunmuyor" />
    </div>
  );
}
