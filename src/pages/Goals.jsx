import React, { useState, useEffect, useCallback } from 'react';
import {
  getBirimGoals, createBirimGoal, updateBirimGoal, deleteBirimGoal,
  getKurumGoals, createKurumGoal, updateKurumGoal, deleteKurumGoal,
  getKurumBirimLinks, setKurumBirimLinks,
  getPersonalGoals, createPersonalGoal, updatePersonalGoal, deletePersonalGoal,
  getOkrObjectives, createOkrObjective, updateOkrObjective, deleteOkrObjective,
  getOkrKeyResults, createOkrKeyResult, updateOkrKeyResult, deleteOkrKeyResult,
} from '../lib/supabase';

// ═══════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════
const UNITS = [
  { key: 'ortakliklar', name: 'Ortaklıklar', icon: '🤝', color: '#7c3aed', coord: 'Hatice' },
  { key: 'insani_yardim', name: 'İnsani Yardım', icon: '🌍', color: '#059669', coord: 'Gülsüm' },
  { key: 'bagiscilar', name: 'Geleneksel Bağışçılar', icon: '💰', color: '#d97706', coord: 'Murat' },
  { key: 'hibeler', name: 'Hibeler', icon: '📝', color: '#2563eb', coord: 'Yasir' },
  { key: 'akreditasyonlar', name: 'Akreditasyonlar', icon: '✅', color: '#16a34a', coord: 'Yavuz' },
  { key: 'politika', name: 'Politika & Yönetişim', icon: '⚖️', color: '#6366f1', coord: 'Sezgin' },
];
const PERIODS = ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026', 'Yıllık 2026'];
const METRICS = ['Sayı', 'Para (USD)', 'Yüzde (%)', 'Süre (gün)', 'Puan'];
const OKR_GRADIENTS = [
  'linear-gradient(135deg,#1a3a5c,#2563eb)', 'linear-gradient(135deg,#065f46,#059669)',
  'linear-gradient(135deg,#1e40af,#3b82f6)', 'linear-gradient(135deg,#7c2d12,#ea580c)',
  'linear-gradient(135deg,#581c87,#9333ea)', 'linear-gradient(135deg,#374151,#6366f1)',
];
const PERSON_COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#6366f1', '#0891b2'];

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════
const U = (key) => UNITS.find(u => u.key === key) || UNITS[0];
const pct = (c, t) => t <= 0 ? 0 : Math.min(100, Math.round(c / t * 100));
const fmtN = (n) => { if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1).replace('.0', '') + 'K'; return '' + n; };
const pColor = (p) => p >= 100 ? '#2563eb' : p >= 70 ? '#22c55e' : p >= 40 ? '#eab308' : '#ef4444';
const pGrad = (p) => p >= 100 ? 'linear-gradient(90deg,#2563eb,#60a5fa)' : p >= 70 ? 'linear-gradient(90deg,#16a34a,#22c55e)' : p >= 40 ? 'linear-gradient(90deg,#eab308,#facc15)' : 'linear-gradient(90deg,#dc2626,#ef4444)';
const fmtDate = (d) => { if (!d) return ''; const dt = new Date(d); return dt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }); };

function deadlineBadge(dateStr, completed) {
  if (!dateStr) return null;
  if (completed) return <span style={{ ...styles.deadlineBadge, color: '#16a34a', background: '#dcfce7' }}>✅ {fmtDate(dateStr)}</span>;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const dl = new Date(dateStr); dl.setHours(0, 0, 0, 0);
  const diff = Math.ceil((dl - now) / 86400000);
  if (diff < 0) return <span style={{ ...styles.deadlineBadge, color: '#dc2626', background: '#fee2e2' }}>🔴 {Math.abs(diff)} gün gecikti</span>;
  if (diff <= 7) return <span style={{ ...styles.deadlineBadge, color: '#d97706', background: '#fffbeb' }}>⚠️ {diff === 0 ? 'Bugün!' : diff + ' gün kaldı'}</span>;
  return <span style={{ ...styles.deadlineBadge, color: '#6b7280', background: 'var(--bg-secondary, #f3f4f6)' }}>📅 {fmtDate(dateStr)}</span>;
}

function StatusBadge({ p }) {
  if (p >= 100) return <span style={{ ...styles.badge, background: '#dbeafe', color: '#2563eb' }}>✅ Tamamlandı</span>;
  if (p >= 70) return <span style={{ ...styles.badge, background: '#dcfce7', color: '#16a34a' }}>🟢 Yolunda</span>;
  if (p >= 40) return <span style={{ ...styles.badge, background: '#fef9c3', color: '#ca8a04' }}>🟡 Risk</span>;
  return <span style={{ ...styles.badge, background: '#fee2e2', color: '#dc2626' }}>🔴 Geride</span>;
}

// ═══════════════════════════════════════════════════
// MODAL COMPONENT
// ═══════════════════════════════════════════════════
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={styles.modal}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: 'var(--navy, #1a3a5c)' }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// TOAST COMPONENT
// ═══════════════════════════════════════════════════
function Toast({ message, visible }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, background: 'var(--navy, #1a3a5c)', color: '#fff',
      padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 2000,
      opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)',
      transition: 'all 0.3s', pointerEvents: 'none',
    }}>{message}</div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN GOALS COMPONENT
// ═══════════════════════════════════════════════════
export default function Goals({ user, profile }) {
  // ── Data state ──
  const [birimGoals, setBirimGoals] = useState([]);
  const [kurumGoals, setKurumGoals] = useState([]);
  const [links, setLinks] = useState([]);
  const [personalGoals, setPersonalGoals] = useState([]);
  const [okrObjectives, setOkrObjectives] = useState([]);
  const [okrKeyResults, setOkrKeyResults] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── UI state ──
  const [activeTab, setActiveTab] = useState(0);
  const [activePeriod, setActivePeriod] = useState('Q1 2026');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  // ── Load all data ──
  const loadAll = useCallback(async () => {
    try {
      const [bg, kg, ln, pg, oo, kr] = await Promise.all([
        getBirimGoals(), getKurumGoals(), getKurumBirimLinks(),
        getPersonalGoals(), getOkrObjectives(), getOkrKeyResults(),
      ]);
      setBirimGoals(bg.data || []);
      setKurumGoals(kg.data || []);
      setLinks(ln.data || []);
      setPersonalGoals(pg.data || []);
      setOkrObjectives(oo.data || []);
      setOkrKeyResults(kr.data || []);
    } catch (err) {
      console.error('Goals loadAll error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const toast = (msg) => { setToastMsg(msg); setToastVisible(true); setTimeout(() => setToastVisible(false), 2500); };
  const openModal = (title, content) => { setModalContent({ title, content }); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setModalContent(null); };

  // ── Computed helpers ──
  const getLinkedBirimIds = (kurumGoalId) => links.filter(l => l.kurum_goal_id === kurumGoalId).map(l => l.birim_goal_id);
  const countBirimLinks = (bgId) => {
    let c = links.filter(l => l.birim_goal_id === bgId).length;
    okrKeyResults.forEach(kr => { if (kr.linked_birim_id === bgId) c++; });
    return c;
  };

  const kurumProgress = (kg) => {
    const linkedIds = getLinkedBirimIds(kg.id);
    const linked = birimGoals.filter(b => linkedIds.includes(b.id));
    if (linked.length === 0) return { current: 0, target: 0, pct: 0 };
    const totalTarget = linked.reduce((s, b) => s + Number(b.target), 0);
    const totalCurrent = linked.reduce((s, b) => s + Number(b.current_value), 0);
    return { current: totalCurrent, target: totalTarget, pct: pct(totalCurrent, totalTarget) };
  };

  const krData = (kr) => {
    if (kr.linked_birim_id) {
      const bg = birimGoals.find(b => b.id === kr.linked_birim_id);
      if (bg) return { target: Number(bg.target), current: Number(bg.current_value), title: kr.title, deadline: bg.deadline };
    }
    return { target: Number(kr.target) || 0, current: Number(kr.current_value) || 0, title: kr.title, deadline: kr.deadline };
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="loading-spinner" /></div>;

  // ═══════════════════════════════════════════════════
  // CRUD HANDLERS
  // ═══════════════════════════════════════════════════

  // Birim Goals
  const handleSaveBirim = async (formData, editId = null) => {
    try {
      const payload = { ...formData, user_id: user.id };
      let result;
      if (editId) result = await updateBirimGoal(editId, formData);
      else result = await createBirimGoal(payload);
      if (result?.error) { toast('❌ Hata: ' + (result.error.message || 'Kayıt başarısız')); return; }
      closeModal(); await loadAll(); toast(editId ? '✅ Birim hedefi güncellendi!' : '✅ Birim hedefi eklendi!');
    } catch (err) { console.error('handleSaveBirim error:', err); toast('❌ Beklenmeyen hata oluştu'); }
  };

  const handleDeleteBirim = async (id) => {
    const lc = countBirimLinks(id);
    const msg = lc ? `Bu hedef ${lc} yere bağlı. Silmek bağlantıları da kaldırır. Devam?` : 'Silmek istediğinize emin misiniz?';
    if (!window.confirm(msg)) return;
    try {
      await deleteBirimGoal(id); await loadAll(); toast('Silindi — bağlantılar temizlendi.');
    } catch (err) { console.error('handleDeleteBirim error:', err); toast('❌ Silme hatası'); }
  };

  // Kurum Goals
  const handleSaveKurum = async (formData, editId = null) => {
    try {
      const payload = { ...formData, user_id: user.id };
      let result;
      if (editId) result = await updateKurumGoal(editId, formData);
      else result = await createKurumGoal(payload);
      if (result?.error) { toast('❌ Hata: ' + (result.error.message || 'Kayıt başarısız')); return; }
      closeModal(); await loadAll(); toast(editId ? '✅ Kurum hedefi güncellendi!' : '✅ Kurum hedefi eklendi!');
    } catch (err) { console.error('handleSaveKurum error:', err); toast('❌ Beklenmeyen hata oluştu'); }
  };

  const handleDeleteKurum = async (id) => {
    if (!window.confirm('Bu kurum hedefini silmek istediğinize emin misiniz?')) return;
    try {
      await deleteKurumGoal(id); await loadAll(); toast('Kurum hedefi silindi.');
    } catch (err) { console.error('handleDeleteKurum error:', err); toast('❌ Silme hatası'); }
  };

  // Links
  const handleSaveLinks = async (kurumGoalId, birimGoalIds) => {
    try {
      await setKurumBirimLinks(kurumGoalId, birimGoalIds);
      await loadAll(); toast('🔗 Bağlantılar güncellendi!');
    } catch (err) { console.error('handleSaveLinks error:', err); toast('❌ Bağlantı hatası'); }
  };

  // Personal Goals
  const handleSavePersonal = async (formData, editId = null) => {
    try {
      const payload = { ...formData, user_id: user.id };
      let result;
      if (editId) result = await updatePersonalGoal(editId, formData);
      else result = await createPersonalGoal(payload);
      if (result?.error) { toast('❌ Hata: ' + (result.error.message || 'Kayıt başarısız')); return; }
      closeModal(); await loadAll(); toast(editId ? '✅ Güncellendi!' : '✅ Kişisel hedef eklendi!');
    } catch (err) { console.error('handleSavePersonal error:', err); toast('❌ Beklenmeyen hata oluştu'); }
  };

  const handleDeletePersonal = async (id) => {
    if (!window.confirm('Silmek istediğinize emin misiniz?')) return;
    try {
      await deletePersonalGoal(id); await loadAll(); toast('Silindi.');
    } catch (err) { console.error('handleDeletePersonal error:', err); toast('❌ Silme hatası'); }
  };

  // OKR
  const handleSaveOKR = async (formData, editId = null) => {
    try {
      const payload = { ...formData, user_id: user.id };
      let result;
      if (editId) result = await updateOkrObjective(editId, formData);
      else result = await createOkrObjective(payload);
      if (result?.error) { toast('❌ Hata: ' + (result.error.message || 'Kayıt başarısız')); return; }
      closeModal(); await loadAll(); toast(editId ? '✅ OKR güncellendi!' : '✅ OKR eklendi!');
    } catch (err) { console.error('handleSaveOKR error:', err); toast('❌ Beklenmeyen hata oluştu'); }
  };

  const handleDeleteOKR = async (id) => {
    if (!window.confirm('Bu OKR\'ı silmek istediğinize emin misiniz?')) return;
    try {
      await deleteOkrObjective(id); await loadAll(); toast('OKR silindi.');
    } catch (err) { console.error('handleDeleteOKR error:', err); toast('❌ Silme hatası'); }
  };

  // Key Results
  const handleSaveKR = async (formData, objectiveId, editId = null) => {
    try {
      let result;
      if (editId) result = await updateOkrKeyResult(editId, formData);
      else result = await createOkrKeyResult({ ...formData, objective_id: objectiveId });
      if (result?.error) { toast('❌ Hata: ' + (result.error.message || 'Kayıt başarısız')); return; }
      closeModal(); await loadAll(); toast(editId ? '✅ Güncellendi!' : '✅ Anahtar sonuç eklendi!');
    } catch (err) { console.error('handleSaveKR error:', err); toast('❌ Beklenmeyen hata oluştu'); }
  };

  const handleDeleteKR = async (id) => {
    if (!window.confirm('Silmek istediğinize emin misiniz?')) return;
    try {
      await deleteOkrKeyResult(id); await loadAll(); toast('Silindi.');
    } catch (err) { console.error('handleDeleteKR error:', err); toast('❌ Silme hatası'); }
  };

  // ═══════════════════════════════════════════════════
  // FORM MODALS
  // ═══════════════════════════════════════════════════
  const openBirimForm = (editGoal = null, presetUnit = null) => {
    openModal(editGoal ? 'Birim Hedefi Düzenle' : 'Birim Hedefi Ekle',
      <BirimGoalForm
        initial={editGoal}
        presetUnit={presetUnit}
        activePeriod={activePeriod}
        linkCount={editGoal ? countBirimLinks(editGoal.id) : 0}
        onSave={(data) => handleSaveBirim(data, editGoal?.id)}
        onCancel={closeModal}
      />
    );
  };

  const openKurumForm = (editGoal = null) => {
    openModal(editGoal ? 'Kurum Hedefi Düzenle' : 'Kurum Hedefi Ekle',
      <KurumGoalForm
        initial={editGoal}
        activePeriod={activePeriod}
        onSave={(data) => handleSaveKurum(data, editGoal?.id)}
        onCancel={closeModal}
      />
    );
  };

  const openLinkBirimModal = (kurumGoal) => {
    const currentLinks = getLinkedBirimIds(kurumGoal.id);
    const available = birimGoals.filter(b => b.period === kurumGoal.period || b.period === 'Yıllık 2026');
    openModal('🔗 Birim Hedefi Bağla',
      <LinkBirimForm
        available={available}
        currentLinks={currentLinks}
        onSave={(ids) => { handleSaveLinks(kurumGoal.id, ids); closeModal(); }}
        onCancel={closeModal}
      />
    );
  };

  const openPersonalForm = (birimGoalId, editGoal = null) => {
    openModal(editGoal ? 'Kişisel Hedef Düzenle' : 'Kişisel Hedef Ekle',
      <PersonalGoalForm
        initial={editGoal}
        birimGoalId={birimGoalId}
        colorIndex={personalGoals.length}
        onSave={(data) => handleSavePersonal(data, editGoal?.id)}
        onCancel={closeModal}
      />
    );
  };

  const openOKRForm = (editOkr = null) => {
    openModal(editOkr ? 'OKR Düzenle' : 'Yeni OKR Ekle',
      <OKRForm
        initial={editOkr}
        activePeriod={activePeriod}
        onSave={(data) => handleSaveOKR(data, editOkr?.id)}
        onCancel={closeModal}
      />
    );
  };

  const openKRForm = (objectiveId, editKR = null, unitKey = null, period = null) => {
    const available = birimGoals.filter(b => b.unit === unitKey && (b.period === period || b.period === 'Yıllık 2026'));
    openModal(editKR ? 'Anahtar Sonuç Düzenle' : 'Anahtar Sonuç Ekle',
      <KeyResultForm
        initial={editKR}
        availableBirim={available}
        birimGoals={birimGoals}
        onSave={(data) => handleSaveKR(data, objectiveId, editKR?.id)}
        onCancel={closeModal}
      />
    );
  };

  // ═══════════════════════════════════════════════════
  // TAB COUNTS
  // ═══════════════════════════════════════════════════
  const filteredKurum = kurumGoals.filter(g => g.period === activePeriod);
  const filteredBirim = birimGoals.filter(g => g.period === activePeriod);
  const filteredOKR = okrObjectives.filter(o => o.period === activePeriod);

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px 40px' }}>
      {/* Tab Bar */}
      <div style={styles.tabBar}>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text, #111827)', marginRight: 24, display: 'flex', alignItems: 'center', gap: 8 }}>🎯 Hedefler</h1>
        {[
          { label: 'Genel Görünüm', count: filteredKurum.length },
          { label: 'Birim Hedefleri', count: filteredBirim.length },
          { label: 'OKR', count: filteredOKR.length },
        ].map((tab, i) => (
          <button key={i} onClick={() => setActiveTab(i)} style={{
            ...styles.tabBtn,
            color: activeTab === i ? 'var(--navy, #1a3a5c)' : 'var(--text-muted, #6b7280)',
            borderBottomColor: activeTab === i ? 'var(--navy, #1a3a5c)' : 'transparent',
            fontWeight: activeTab === i ? 700 : 500,
          }}>
            {tab.label}
            <span style={{
              background: activeTab === i ? 'var(--navy, #1a3a5c)' : 'var(--bg-secondary, #e5e7eb)',
              color: activeTab === i ? '#fff' : 'var(--text-muted, #6b7280)',
              fontSize: 10, padding: '1px 7px', borderRadius: 10, marginLeft: 6,
            }}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Period Bar */}
      <div style={styles.periodBar}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #6b7280)', marginRight: 8 }}>Dönem:</span>
        {PERIODS.map(p => (
          <button key={p} onClick={() => setActivePeriod(p)} style={{
            ...styles.periodBtn,
            background: p === activePeriod ? 'var(--navy, #1a3a5c)' : 'var(--card-bg, #fff)',
            color: p === activePeriod ? '#fff' : 'var(--text-muted, #6b7280)',
            borderColor: p === activePeriod ? 'var(--navy, #1a3a5c)' : 'var(--border, #e5e7eb)',
          }}>{p}</button>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={() => {
            if (activeTab === 0) openKurumForm();
            else if (activeTab === 1) openBirimForm();
            else openOKRForm();
          }} style={styles.primaryBtn}>
            + {activeTab === 0 ? 'Kurum Hedefi Ekle' : activeTab === 1 ? 'Birim Hedefi Ekle' : 'Yeni OKR Ekle'}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 0 && <Tab0Overview
        kurumGoals={filteredKurum} birimGoals={birimGoals} personalGoals={personalGoals}
        getLinkedBirimIds={getLinkedBirimIds} kurumProgress={kurumProgress}
        onEditKurum={openKurumForm} onDeleteKurum={handleDeleteKurum}
        onLinkBirim={openLinkBirimModal} onEditPersonal={openPersonalForm}
        onDeletePersonal={handleDeletePersonal} onAddPersonal={openPersonalForm}
        onSwitchTab={setActiveTab}
      />}
      {activeTab === 1 && <Tab1BirimGoals
        birimGoals={filteredBirim} countBirimLinks={countBirimLinks}
        onEdit={openBirimForm} onDelete={handleDeleteBirim}
        onAddForUnit={(unitKey) => openBirimForm(null, unitKey)}
      />}
      {activeTab === 2 && <Tab2OKR
        objectives={filteredOKR} keyResults={okrKeyResults} birimGoals={birimGoals}
        krData={krData} onEditOKR={openOKRForm} onDeleteOKR={handleDeleteOKR}
        onAddKR={openKRForm} onEditKR={openKRForm} onDeleteKR={handleDeleteKR}
        onSwitchTab={setActiveTab}
      />}

      {/* Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={modalContent?.title}>
        {modalContent?.content}
      </Modal>

      {/* Toast */}
      <Toast message={toastMsg} visible={toastVisible} />
    </div>
  );
}

// ═══════════════════════════════════════════════════
// TAB 0: GENEL GÖRÜNÜM (Kurum hedefleri + hiyerarşi)
// ═══════════════════════════════════════════════════
function Tab0Overview({ kurumGoals, birimGoals, personalGoals, getLinkedBirimIds, kurumProgress,
  onEditKurum, onDeleteKurum, onLinkBirim, onEditPersonal, onDeletePersonal, onAddPersonal, onSwitchTab }) {

  const now = new Date(); now.setHours(0, 0, 0, 0);
  let yol = 0, risk = 0, ger = 0, tam = 0, overdue = 0;
  kurumGoals.forEach(g => {
    const p = kurumProgress(g).pct;
    if (p >= 100) tam++; else if (p >= 70) yol++; else if (p >= 40) risk++; else ger++;
    if (g.deadline && p < 100 && new Date(g.deadline) < now) overdue++;
  });

  return (
    <>
      {/* Desc */}
      <div style={styles.descBox}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy, #1a3a5c)', marginBottom: 6 }}>🏗️ Genel Görünüm — Kurum Hedefleri</h2>
        <p style={{ fontSize: 13, color: 'var(--text, #374151)', lineHeight: 1.6 }}>
          Kurum hedefleri, birim hedeflerine bağlanır. İlerleme otomatik hesaplanır.{' '}
          <span style={styles.tag}>🔗 Bağlantılı</span> etiketli hedefler diğer sekmelerdeki verilerle senkronize çalışır.
        </p>
      </div>

      {/* KPIs */}
      <div style={styles.kpiStrip}>
        <KpiCard value={kurumGoals.length} label="Toplam" color="#2563eb" />
        <KpiCard value={yol} label="Yolunda" color="#16a34a" />
        <KpiCard value={risk} label="Risk" color="#ca8a04" />
        <KpiCard value={ger} label="Geride" color="#dc2626" />
        <KpiCard value={tam} label="Tamamlanan" color="#7c3aed" />
        {overdue > 0 && <KpiCard value={overdue} label="Süresi Geçen" color="#dc2626" borderColor="#fca5a5" />}
      </div>

      {/* Goals */}
      {kurumGoals.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
          <p style={{ fontSize: 14, color: 'var(--text-muted, #9ca3af)' }}>Bu dönem için kurum hedefi yok.</p>
        </div>
      ) : kurumGoals.map(kg => {
        const prog = kurumProgress(kg);
        const p = prog.pct;
        const linkedIds = getLinkedBirimIds(kg.id);
        const linkedBG = birimGoals.filter(b => linkedIds.includes(b.id));

        return (
          <div key={kg.id} style={{ ...styles.card, borderLeft: '5px solid var(--navy, #1a3a5c)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={styles.treeLabel}>Kurum Hedefi</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text, #111827)' }}>{kg.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span>{kg.metric} · İlerleme: {fmtN(prog.current)}/{fmtN(prog.target)} · {kg.period}</span>
                  {kg.owner_name && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ ...styles.avatar, background: 'var(--navy, #1a3a5c)', width: 20, height: 20, fontSize: 8 }}>{kg.owner_initials || '?'}</span>
                      {kg.owner_name}
                    </span>
                  )}
                  {deadlineBadge(kg.deadline, p >= 100)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StatusBadge p={p} />
                <button onClick={() => onEditKurum(kg)} style={styles.actionBtn} title="Düzenle">✏️</button>
                <button onClick={() => onDeleteKurum(kg.id)} style={{ ...styles.actionBtn, ...styles.deleteBtn }} title="Sil">🗑️</button>
              </div>
            </div>

            {/* Progress */}
            <div style={styles.progressRow}>
              <div style={styles.progressWrap}><div style={{ ...styles.progressBar, width: `${p}%`, background: pGrad(p) }} /></div>
              <div style={{ fontSize: 13, fontWeight: 700, color: pColor(p), minWidth: 42, textAlign: 'right' }}>{p}%</div>
            </div>

            {p >= 100 && <div style={{ marginTop: 8, fontSize: 11, color: '#16a34a', fontWeight: 600 }}>🏆 +30 XP — Hedef tamamlandı!</div>}

            {/* Linked birim goals */}
            <div style={{ marginTop: 16 }}>
              {linkedBG.map(bg => {
                const bp = pct(Number(bg.current_value), Number(bg.target));
                const unit = U(bg.unit);
                const pgs = personalGoals.filter(pg => pg.birim_goal_id === bg.id);

                return (
                  <div key={bg.id} style={{ borderLeft: `3px solid ${unit.color}`, paddingLeft: 16, marginLeft: 12, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={styles.treeLabel}>{unit.icon} {unit.name}</div>
                      <span onClick={() => onSwitchTab(1)} style={styles.linkBadge}>🔗 Birim</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text, #111827)' }}>{bg.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          Koordinatör: {unit.coord} · Hedef: {fmtN(Number(bg.target))} · Mevcut: {fmtN(Number(bg.current_value))}
                          {deadlineBadge(bg.deadline, bp >= 100)}
                        </div>
                      </div>
                      <span style={{ ...styles.badge, background: bp >= 70 ? '#dcfce7' : bp >= 40 ? '#fef9c3' : '#fee2e2', color: bp >= 70 ? '#16a34a' : bp >= 40 ? '#ca8a04' : '#dc2626' }}>{bp}%</span>
                    </div>
                    <div style={{ ...styles.progressRow, marginTop: 6 }}>
                      <div style={{ ...styles.progressWrap, height: 6 }}><div style={{ ...styles.progressBar, width: `${bp}%`, background: pColor(bp) }} /></div>
                    </div>

                    {/* Personal goals */}
                    {pgs.map(pg => {
                      const pp = pct(Number(pg.current_value), Number(pg.target));
                      return (
                        <div key={pg.id} style={{ borderLeft: '3px solid #60a5fa', paddingLeft: 16, marginLeft: 16, marginTop: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ ...styles.avatar, background: pg.person_color || '#7c3aed' }}>{pg.person_initials || '?'}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text, #111827)' }}>{pg.person_name} — {pg.title}</div>
                              <div style={{ ...styles.progressRow, marginTop: 4 }}>
                                <div style={{ ...styles.progressWrap, height: 5 }}><div style={{ ...styles.progressBar, width: `${pp}%`, background: pg.person_color || '#7c3aed' }} /></div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: pg.person_color || '#7c3aed' }}>{Number(pg.current_value)}/{Number(pg.target)}</span>
                              </div>
                            </div>
                            <button onClick={() => onEditPersonal(bg.id, pg)} style={{ ...styles.actionBtn, width: 24, height: 24 }}>✏️</button>
                            <button onClick={() => onDeletePersonal(pg.id)} style={{ ...styles.actionBtn, ...styles.deleteBtn, width: 24, height: 24 }}>🗑️</button>
                          </div>
                        </div>
                      );
                    })}
                    <button onClick={() => onAddPersonal(bg.id)} style={styles.addSubBtn}>+ Kişisel Hedef Ekle</button>
                  </div>
                );
              })}
              <button onClick={() => onLinkBirim(kg)} style={styles.addSubBtn}>+ Birim Hedefi Bağla</button>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ═══════════════════════════════════════════════════
// TAB 1: BİRİM HEDEFLERİ
// ═══════════════════════════════════════════════════
function Tab1BirimGoals({ birimGoals, countBirimLinks, onEdit, onDelete, onAddForUnit }) {
  return (
    <>
      <div style={styles.descBox}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy, #1a3a5c)', marginBottom: 6 }}>📊 Birim Hedefleri</h2>
        <p style={{ fontSize: 13, color: 'var(--text, #374151)', lineHeight: 1.6 }}>
          Her birimin hedefleri burada yönetilir. Burası <strong>tek veri kaynağıdır</strong> — burada güncellenen hedefler
          Genel Görünüm ve OKR sekmelerinde otomatik yansır. <span style={styles.tag}>🔗</span> simgesi diğer sekmelere bağlı hedefleri gösterir.
        </p>
      </div>

      <div style={styles.unitGrid}>
        {UNITS.map(unit => {
          const goals = birimGoals.filter(b => b.unit === unit.key);
          const avgP = goals.length ? Math.round(goals.reduce((s, g) => s + pct(Number(g.current_value), Number(g.target)), 0) / goals.length) : 0;

          return (
            <div key={unit.key} style={{ ...styles.card, borderTop: `4px solid ${unit.color}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted, #6b7280)', fontWeight: 600 }}>{unit.icon} {unit.name.toUpperCase()}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)' }}>Koordinatör: {unit.coord}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: unit.color }}>{avgP}%</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted, #6b7280)' }}>Genel İlerleme</div>
                </div>
              </div>

              {goals.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted, #9ca3af)', fontSize: 13 }}>Henüz hedef yok</div>
              ) : goals.map(g => {
                const p = pct(Number(g.current_value), Number(g.target));
                const lc = countBirimLinks(g.id);
                return (
                  <div key={g.id} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: 12.5, fontWeight: 600, marginBottom: 4, gap: 6 }}>
                      <span style={{ flex: 1, color: 'var(--text, #111827)' }}>{g.title}</span>
                      {lc > 0 && <span style={styles.linkBadge}>🔗 {lc}</span>}
                      <span style={{ color: pColor(p), whiteSpace: 'nowrap' }}>{fmtN(Number(g.current_value))}/{fmtN(Number(g.target))}{p >= 100 ? ' ✅' : ''}</span>
                      {deadlineBadge(g.deadline, p >= 100)}
                      <button onClick={() => onEdit(g)} style={{ ...styles.actionBtn, width: 22, height: 22 }}>✏️</button>
                      <button onClick={() => onDelete(g.id)} style={{ ...styles.actionBtn, ...styles.deleteBtn, width: 22, height: 22 }}>🗑️</button>
                    </div>
                    <div style={{ ...styles.progressWrap, height: 7 }}><div style={{ ...styles.progressBar, width: `${p}%`, background: pColor(p) }} /></div>
                  </div>
                );
              })}

              <button onClick={() => onAddForUnit(unit.key)} style={styles.addSubBtn}>+ Hedef Ekle</button>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════
// TAB 2: OKR
// ═══════════════════════════════════════════════════
function Tab2OKR({ objectives, keyResults, birimGoals, krData, onEditOKR, onDeleteOKR, onAddKR, onEditKR, onDeleteKR, onSwitchTab }) {
  const allKRsForPeriod = objectives.flatMap(o => keyResults.filter(kr => kr.objective_id === o.id));
  const scores = allKRsForPeriod.map(kr => { const d = krData(kr); return d.target > 0 ? Math.min(1, d.current / d.target) : 0; });
  const avg = scores.length ? (scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(2) : '0.00';

  return (
    <>
      <div style={styles.descBox}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy, #1a3a5c)', marginBottom: 6 }}>🎯 OKR — Objectives & Key Results</h2>
        <p style={{ fontSize: 13, color: 'var(--text, #374151)', lineHeight: 1.6 }}>
          Anahtar sonuçlar birim hedeflerine <strong>bağlanabilir</strong> — bağlı olanlar otomatik senkronize olur.{' '}
          <span style={styles.tag}>🔗</span> simgesi birim hedefine bağlı anahtar sonuçları gösterir. Puanlama 0.0-1.0.
        </p>
      </div>

      <div style={styles.kpiStrip}>
        <KpiCard value={objectives.length} label="Amaç" color="#2563eb" />
        <KpiCard value={allKRsForPeriod.length} label="Anahtar Sonuç" color="#1a3a5c" />
        <KpiCard value={avg} label="Ort. Puan" color="#16a34a" />
        <KpiCard value={scores.filter(s => s >= 0.7).length} label="İyi (0.7+)" color="#7c3aed" />
      </div>

      {objectives.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
          <p style={{ fontSize: 14, color: 'var(--text-muted, #9ca3af)' }}>Bu dönem için OKR yok.</p>
        </div>
      ) : objectives.map((o, idx) => {
        const unit = U(o.unit);
        const objKRs = keyResults.filter(kr => kr.objective_id === o.id);
        const krScores = objKRs.map(kr => { const d = krData(kr); return d.target > 0 ? Math.min(1, d.current / d.target) : 0; });
        const avgObj = krScores.length ? (krScores.reduce((s, v) => s + v, 0) / krScores.length).toFixed(2) : '0.00';
        const grad = OKR_GRADIENTS[idx % OKR_GRADIENTS.length];

        return (
          <div key={o.id} style={{ marginBottom: 24 }}>
            {/* Objective Header */}
            <div style={{ color: '#fff', borderRadius: 14, padding: 20, background: grad, position: 'relative' }}>
              <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 4 }}>
                <button onClick={() => onEditOKR(o)} style={{ ...styles.actionBtn, background: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}>✏️</button>
                <button onClick={() => onDeleteOKR(o.id)} style={{ ...styles.actionBtn, background: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}>🗑️</button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 10, opacity: 0.7, fontWeight: 600, letterSpacing: 1 }}>{unit.icon} {unit.name.toUpperCase()} · {o.period}</div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{o.objective}</h3>
                  <p style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>Sorumlu: {unit.coord} · {objKRs.length} Anahtar Sonuç{o.deadline ? ` · 📅 Son: ${fmtDate(o.deadline)}` : ''}</p>
                </div>
                <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: '10px 18px' }}>
                  <div style={{ fontSize: 28, fontWeight: 800 }}>{avgObj}</div>
                  <div style={{ fontSize: 10, opacity: 0.8 }}>Genel Puan</div>
                </div>
              </div>
            </div>

            {/* Key Results */}
            {objKRs.map((kr, kri) => {
              const d = krData(kr);
              const score = d.target > 0 ? Math.min(1, d.current / d.target) : 0;
              const sf = score.toFixed(2);
              const pp = Math.round(score * 100);
              const linked = kr.linked_birim_id ? birimGoals.find(b => b.id === kr.linked_birim_id) : null;
              const scoreCSS = score >= 1 ? { background: '#dbeafe', color: '#2563eb' } : score >= 0.7 ? { background: '#dcfce7', color: '#16a34a' } : score >= 0.4 ? { background: '#fef9c3', color: '#ca8a04' } : { background: '#fee2e2', color: '#dc2626' };
              const okrBadgeText = score >= 1 ? 'Tamamlandı' : score >= 0.7 ? 'İyi' : score >= 0.4 ? 'Geliştirilmeli' : 'Başarısız';

              return (
                <div key={kr.id} style={{ ...styles.card, display: 'flex', alignItems: 'center', gap: 14, padding: 16, marginBottom: 10, marginTop: kri === 0 ? 10 : 0 }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, flexShrink: 0, ...scoreCSS }}>{sf}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text, #111827)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      KS{kri + 1}: {kr.title}
                      {linked && <span onClick={() => onSwitchTab(1)} style={styles.linkBadge} title={`Birim hedefinden çekiliyor: ${linked.title}`}>🔗 Senkron</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      Hedef: {fmtN(d.target)} · Mevcut: {fmtN(d.current)}{score >= 1 ? ' · ✅ Tamamlandı' : ''}
                      {deadlineBadge(d.deadline, score >= 1)}
                    </div>
                    <div style={{ ...styles.progressRow, marginTop: 6 }}>
                      <div style={{ ...styles.progressWrap, height: 6 }}><div style={{ ...styles.progressBar, width: `${pp}%`, background: pColor(pp) }} /></div>
                    </div>
                  </div>
                  <span style={{ ...styles.badge, ...scoreCSS }}>{okrBadgeText}</span>
                  <button onClick={() => onEditKR(o.id, kr, o.unit, o.period)} style={{ ...styles.actionBtn, width: 24, height: 24 }}>✏️</button>
                  <button onClick={() => onDeleteKR(kr.id)} style={{ ...styles.actionBtn, ...styles.deleteBtn, width: 24, height: 24 }}>🗑️</button>
                </div>
              );
            })}
            <button onClick={() => onAddKR(o.id, null, o.unit, o.period)} style={styles.addSubBtn}>+ Anahtar Sonuç Ekle</button>
          </div>
        );
      })}
    </>
  );
}

// ═══════════════════════════════════════════════════
// FORM COMPONENTS
// ═══════════════════════════════════════════════════

function BirimGoalForm({ initial, presetUnit, activePeriod, linkCount, onSave, onCancel }) {
  const [unit, setUnit] = useState(initial?.unit || presetUnit || 'ortakliklar');
  const [title, setTitle] = useState(initial?.title || '');
  const [metric, setMetric] = useState(initial?.metric || 'Sayı');
  const [period, setPeriod] = useState(initial?.period || activePeriod);
  const [target, setTarget] = useState(initial?.target || '');
  const [currentVal, setCurrentVal] = useState(initial?.current_value || '');
  const [deadline, setDeadline] = useState(initial?.deadline || '');

  return (
    <>
      {linkCount > 0 && <div style={styles.infoBanner}>🔗 Bu hedef {linkCount} yere bağlı — değişiklikler tüm sekmelere yansır.</div>}
      {!presetUnit && (
        <div style={styles.formGroup}><label style={styles.formLabel}>Birim</label>
          <select value={unit} onChange={e => setUnit(e.target.value)} style={styles.formInput}>
            {UNITS.map(u => <option key={u.key} value={u.key}>{u.icon} {u.name}</option>)}
          </select></div>
      )}
      <div style={styles.formGroup}><label style={styles.formLabel}>Başlık</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Hedef açıklaması" style={styles.formInput} /></div>
      <div style={styles.formRow}>
        <div style={styles.formGroup}><label style={styles.formLabel}>Metrik</label>
          <select value={metric} onChange={e => setMetric(e.target.value)} style={styles.formInput}>
            {METRICS.map(m => <option key={m}>{m}</option>)}
          </select></div>
        <div style={styles.formGroup}><label style={styles.formLabel}>Dönem</label>
          <select value={period} onChange={e => setPeriod(e.target.value)} style={styles.formInput}>
            {PERIODS.map(p => <option key={p}>{p}</option>)}
          </select></div>
      </div>
      <div style={styles.formRow}>
        <div style={styles.formGroup}><label style={styles.formLabel}>Hedef</label>
          <input type="number" value={target} onChange={e => setTarget(e.target.value)} style={styles.formInput} /></div>
        <div style={styles.formGroup}><label style={styles.formLabel}>Mevcut</label>
          <input type="number" value={currentVal} onChange={e => setCurrentVal(e.target.value)} style={styles.formInput} /></div>
      </div>
      <div style={styles.formGroup}><label style={styles.formLabel}>Son Tarih</label>
        <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={styles.formInput} /></div>
      <div style={styles.modalActions}>
        <button onClick={onCancel} style={styles.outlineBtn}>İptal</button>
        <button onClick={() => { if (!title.trim()) return; onSave({ unit, title: title.trim(), metric, period, target: Number(target) || 0, current_value: Number(currentVal) || 0, deadline: deadline || null }); }} style={styles.primaryBtn}>Kaydet</button>
      </div>
    </>
  );
}

function KurumGoalForm({ initial, activePeriod, onSave, onCancel }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [metric, setMetric] = useState(initial?.metric || 'Sayı');
  const [period, setPeriod] = useState(initial?.period || activePeriod);
  const [owner, setOwner] = useState(initial?.owner_name || 'Talha Keskin');
  const [initials, setInitials] = useState(initial?.owner_initials || 'TK');
  const [deadline, setDeadline] = useState(initial?.deadline || '');

  return (
    <>
      <div style={styles.formGroup}><label style={styles.formLabel}>Başlık</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Kurum hedefi" style={styles.formInput} /></div>
      <div style={styles.formRow}>
        <div style={styles.formGroup}><label style={styles.formLabel}>Metrik</label>
          <select value={metric} onChange={e => setMetric(e.target.value)} style={styles.formInput}>
            {METRICS.map(m => <option key={m}>{m}</option>)}
          </select></div>
        <div style={styles.formGroup}><label style={styles.formLabel}>Dönem</label>
          <select value={period} onChange={e => setPeriod(e.target.value)} style={styles.formInput}>
            {PERIODS.map(p => <option key={p}>{p}</option>)}
          </select></div>
      </div>
      <div style={styles.formRow}>
        <div style={styles.formGroup}><label style={styles.formLabel}>Sorumlu</label>
          <input value={owner} onChange={e => setOwner(e.target.value)} style={styles.formInput} /></div>
        <div style={styles.formGroup}><label style={styles.formLabel}>Kısaltma</label>
          <input value={initials} onChange={e => setInitials(e.target.value)} maxLength={3} style={styles.formInput} /></div>
      </div>
      <div style={styles.formGroup}><label style={styles.formLabel}>Son Tarih</label>
        <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={styles.formInput} /></div>
      <div style={styles.modalActions}>
        <button onClick={onCancel} style={styles.outlineBtn}>İptal</button>
        <button onClick={() => { if (!title.trim()) return; onSave({ title: title.trim(), metric, period, owner_name: owner, owner_initials: initials.toUpperCase(), deadline: deadline || null }); }} style={styles.primaryBtn}>Kaydet</button>
      </div>
    </>
  );
}

function LinkBirimForm({ available, currentLinks, onSave, onCancel }) {
  const [selected, setSelected] = useState([...currentLinks]);
  const toggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <>
      <p style={{ fontSize: 13, color: 'var(--text-muted, #6b7280)', marginBottom: 12 }}>Kurum hedefine bağlamak istediğiniz birim hedeflerini seçin:</p>
      <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border, #e5e7eb)', borderRadius: 10, padding: 8 }}>
        {available.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted, #9ca3af)' }}>Bu dönemde birim hedefi yok.</div>
        ) : available.map(b => {
          const unit = U(b.unit);
          const isLinked = selected.includes(b.id);
          return (
            <div key={b.id} onClick={() => toggle(b.id)} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
              background: isLinked ? 'var(--bg-accent, #eff6ff)' : 'transparent',
              border: isLinked ? '1px solid var(--border-accent, #bfdbfe)' : '1px solid transparent',
              marginBottom: 4, transition: 'all 0.15s',
            }}>
              <input type="checkbox" checked={isLinked} readOnly style={{ accentColor: '#2563eb', width: 16, height: 16 }} />
              <span>{unit.icon}</span>
              <span style={{ flex: 1, fontWeight: 600, fontSize: 12.5, color: 'var(--text, #111827)' }}>{b.title}</span>
              <span style={{ color: 'var(--text-muted, #6b7280)', fontSize: 11 }}>{fmtN(Number(b.current_value))}/{fmtN(Number(b.target))}</span>
            </div>
          );
        })}
      </div>
      <div style={styles.modalActions}>
        <button onClick={onCancel} style={styles.outlineBtn}>İptal</button>
        <button onClick={() => onSave(selected)} style={styles.primaryBtn}>Tamam</button>
      </div>
    </>
  );
}

function PersonalGoalForm({ initial, birimGoalId, colorIndex, onSave, onCancel }) {
  const [name, setName] = useState(initial?.person_name || '');
  const [initials, setInitials] = useState(initial?.person_initials || '');
  const [title, setTitle] = useState(initial?.title || '');
  const [target, setTarget] = useState(initial?.target || '');
  const [currentVal, setCurrentVal] = useState(initial?.current_value || '');

  return (
    <>
      <div style={styles.formRow}>
        <div style={styles.formGroup}><label style={styles.formLabel}>İsim</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Hatice" style={styles.formInput} /></div>
        <div style={styles.formGroup}><label style={styles.formLabel}>Kısaltma</label>
          <input value={initials} onChange={e => setInitials(e.target.value)} maxLength={3} placeholder="HA" style={styles.formInput} /></div>
      </div>
      <div style={styles.formGroup}><label style={styles.formLabel}>Hedef</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="10 ortaklık tamamla" style={styles.formInput} /></div>
      <div style={styles.formRow}>
        <div style={styles.formGroup}><label style={styles.formLabel}>Hedef Değer</label>
          <input type="number" value={target} onChange={e => setTarget(e.target.value)} style={styles.formInput} /></div>
        <div style={styles.formGroup}><label style={styles.formLabel}>Mevcut</label>
          <input type="number" value={currentVal} onChange={e => setCurrentVal(e.target.value)} style={styles.formInput} /></div>
      </div>
      <div style={styles.modalActions}>
        <button onClick={onCancel} style={styles.outlineBtn}>İptal</button>
        <button onClick={() => {
          if (!name.trim()) return;
          onSave({
            birim_goal_id: birimGoalId, person_name: name.trim(),
            person_initials: initials.toUpperCase() || name.slice(0, 2).toUpperCase(),
            person_color: initial?.person_color || PERSON_COLORS[(colorIndex || 0) % PERSON_COLORS.length],
            title: title.trim(), target: Number(target) || 0, current_value: Number(currentVal) || 0,
          });
        }} style={styles.primaryBtn}>Kaydet</button>
      </div>
    </>
  );
}

function OKRForm({ initial, activePeriod, onSave, onCancel }) {
  const [unit, setUnit] = useState(initial?.unit || 'ortakliklar');
  const [objective, setObjective] = useState(initial?.objective || '');
  const [period, setPeriod] = useState(initial?.period || activePeriod);
  const [deadline, setDeadline] = useState(initial?.deadline || '');

  return (
    <>
      <div style={styles.formGroup}><label style={styles.formLabel}>Birim</label>
        <select value={unit} onChange={e => setUnit(e.target.value)} style={styles.formInput}>
          {UNITS.map(u => <option key={u.key} value={u.key}>{u.icon} {u.name}</option>)}
        </select></div>
      <div style={styles.formGroup}><label style={styles.formLabel}>Amaç (Objective)</label>
        <textarea value={objective} onChange={e => setObjective(e.target.value)} placeholder="İlham verici, nitel bir hedef..." rows={3} style={{ ...styles.formInput, resize: 'vertical', minHeight: 60 }} /></div>
      <div style={styles.formRow}>
        <div style={styles.formGroup}><label style={styles.formLabel}>Dönem</label>
          <select value={period} onChange={e => setPeriod(e.target.value)} style={styles.formInput}>
            {PERIODS.map(p => <option key={p}>{p}</option>)}
          </select></div>
        <div style={styles.formGroup}><label style={styles.formLabel}>Son Tarih</label>
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={styles.formInput} /></div>
      </div>
      <div style={styles.modalActions}>
        <button onClick={onCancel} style={styles.outlineBtn}>İptal</button>
        <button onClick={() => { if (!objective.trim()) return; onSave({ unit, objective: objective.trim(), period, deadline: deadline || null }); }} style={styles.primaryBtn}>Kaydet</button>
      </div>
    </>
  );
}

function KeyResultForm({ initial, availableBirim, birimGoals, onSave, onCancel }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [linkedBirimId, setLinkedBirimId] = useState(initial?.linked_birim_id || '');
  const [target, setTarget] = useState(initial?.target || '');
  const [currentVal, setCurrentVal] = useState(initial?.current_value || '');
  const [deadline, setDeadline] = useState(initial?.deadline || '');

  const hasLink = !!linkedBirimId;

  return (
    <>
      <div style={styles.formGroup}><label style={styles.formLabel}>Başlık</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ölçülebilir sonuç" style={styles.formInput} /></div>
      <div style={styles.formGroup}><label style={styles.formLabel}>Birim Hedefine Bağla (opsiyonel)</label>
        <select value={linkedBirimId} onChange={e => setLinkedBirimId(e.target.value)} style={styles.formInput}>
          <option value="">— Bağlantısız (manuel değer) —</option>
          {availableBirim.map(b => <option key={b.id} value={b.id}>🔗 {b.title} ({fmtN(Number(b.current_value))}/{fmtN(Number(b.target))})</option>)}
        </select></div>
      {!hasLink && (
        <>
          <div style={styles.formRow}>
            <div style={styles.formGroup}><label style={styles.formLabel}>Hedef</label>
              <input type="number" value={target} onChange={e => setTarget(e.target.value)} style={styles.formInput} /></div>
            <div style={styles.formGroup}><label style={styles.formLabel}>Mevcut</label>
              <input type="number" value={currentVal} onChange={e => setCurrentVal(e.target.value)} style={styles.formInput} /></div>
          </div>
          <div style={styles.formGroup}><label style={styles.formLabel}>Son Tarih</label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={styles.formInput} /></div>
        </>
      )}
      {hasLink && <div style={styles.infoBanner}>🔗 Değerler ve son tarih bağlı birim hedefinden otomatik çekilecek.</div>}
      <div style={styles.modalActions}>
        <button onClick={onCancel} style={styles.outlineBtn}>İptal</button>
        <button onClick={() => {
          if (!title.trim()) return;
          const data = { title: title.trim(), linked_birim_id: linkedBirimId || null };
          if (!linkedBirimId) { data.target = Number(target) || 0; data.current_value = Number(currentVal) || 0; data.deadline = deadline || null; }
          onSave(data);
        }} style={styles.primaryBtn}>Kaydet</button>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════
// SMALL COMPONENTS
// ═══════════════════════════════════════════════════
function KpiCard({ value, label, color, borderColor }) {
  return (
    <div style={{ flex: 1, minWidth: 100, background: 'var(--card-bg, #fff)', border: `1px solid ${borderColor || 'var(--border, #e5e7eb)'}`, borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted, #6b7280)', marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════
const styles = {
  tabBar: {
    display: 'flex', alignItems: 'center', borderBottom: '2px solid var(--border, #e5e7eb)',
    marginBottom: 20, paddingTop: 8, flexWrap: 'wrap', gap: 0,
  },
  tabBtn: {
    padding: '12px 18px', border: 'none', borderBottom: '3px solid transparent',
    background: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
    transition: 'all 0.2s', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center',
  },
  periodBar: { display: 'flex', gap: 6, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' },
  periodBtn: {
    padding: '6px 14px', borderRadius: 8, border: '1.5px solid var(--border, #e5e7eb)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
  },
  card: {
    background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #e5e7eb)',
    borderRadius: 14, padding: 20, marginBottom: 16, transition: 'box-shadow 0.2s',
  },
  kpiStrip: { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
  descBox: {
    background: 'var(--bg-accent, #eff6ff)', border: '1px solid var(--border-accent, #bfdbfe)',
    borderRadius: 12, padding: '16px 20px', marginBottom: 24,
  },
  tag: {
    display: 'inline-block', background: 'var(--navy, #1a3a5c)', color: '#fff',
    padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
  },
  badge: { padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' },
  deadlineBadge: { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap' },
  linkBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600,
    color: '#7c3aed', background: '#f3e8ff', padding: '2px 8px', borderRadius: 6, cursor: 'pointer',
  },
  progressRow: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 },
  progressWrap: { background: 'var(--bg-secondary, #f3f4f6)', borderRadius: 8, height: 10, overflow: 'hidden', flex: 1 },
  progressBar: { height: '100%', borderRadius: 8, transition: 'width 0.6s ease' },
  treeLabel: { fontSize: 10, fontWeight: 700, color: 'var(--text-muted, #6b7280)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  avatar: { width: 24, height: 24, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 },
  actionBtn: {
    width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border, #e5e7eb)',
    background: 'var(--card-bg, #fff)', cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 12, transition: 'all 0.15s',
  },
  deleteBtn: {},
  addSubBtn: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8,
    border: '1.5px dashed var(--border, #d1d5db)', background: 'transparent', cursor: 'pointer',
    fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #6b7280)', transition: 'all 0.15s',
    marginTop: 8, fontFamily: 'inherit', width: '100%',
  },
  primaryBtn: {
    padding: '8px 16px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', background: 'var(--navy, #1a3a5c)', color: '#fff',
    transition: 'all 0.15s',
  },
  outlineBtn: {
    padding: '8px 16px', borderRadius: 10, border: '1.5px solid var(--border, #e5e7eb)',
    background: 'var(--card-bg, #fff)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit', color: 'var(--text, #374151)', transition: 'all 0.15s',
  },
  emptyState: { textAlign: 'center', padding: '60px 20px' },
  unitGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 },
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)',
    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    background: 'var(--card-bg, #fff)', borderRadius: 16, padding: 28, width: '90%', maxWidth: 560,
    maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  formGroup: { marginBottom: 16 },
  formLabel: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text, #374151)', marginBottom: 6 },
  formInput: {
    width: '100%', padding: '10px 14px', border: '1.5px solid var(--border, #e5e7eb)', borderRadius: 10,
    fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'var(--card-bg, #fff)',
    color: 'var(--text, #111827)', boxSizing: 'border-box',
  },
  formRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  modalActions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 },
  infoBanner: {
    background: '#f3e8ff', border: '1px solid #d8b4fe', borderRadius: 10,
    padding: '10px 16px', marginBottom: 16, fontSize: 12, color: '#6d28d9',
    display: 'flex', alignItems: 'center', gap: 8,
  },
};
