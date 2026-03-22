import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getAllAgendas, createAgendaItem, updateAgendaItem, deleteAgendaItem, getAllProfiles, markTaskPendingReview, approveTask, requestRevision, notifyTaskAssigned } from '../lib/supabase';
import { differenceInCalendarDays } from 'date-fns';
import { ROLE_LABELS } from '../App';
import { UserAvatar } from './ProfileSettings';

// ── SABİTLER ─────────────────────────────────────────────────────────────────
const PRIORITIES = [
  { value: 'kritik', label: '🔴 Kritik',  color: '#ef4444', bg: '#fef2f2' },
  { value: 'yuksek', label: '🟠 Yüksek', color: '#f97316', bg: '#fff7ed' },
  { value: 'orta',   label: '🟡 Orta',   color: '#eab308', bg: '#fefce8' },
  { value: 'dusuk',  label: '🟢 Düşük',  color: '#22c55e', bg: '#f0fdf4' },
];
const STATUSES = [
  { value: 'bekliyor',     label: '⚪ Bekliyor',      color: '#9ca3af' },
  { value: 'devam_ediyor', label: '🔵 Devam Ediyor', color: '#3b82f6' },
  { value: 'tamamlandi',   label: '✅ Tamamlandı',   color: '#22c55e' },
];

const COMPLETION_STATUS = {
  pending_review:     { label: '⏳ Onay Bekliyor', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  approved:           { label: '✅ Onaylandı',     color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  revision_requested: { label: '🔄 Revize İstendi', color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
};

const prioMeta  = (v) => PRIORITIES.find(p => p.value === v) || PRIORITIES[1];
const statMeta  = (v) => STATUSES.find(s => s.value === v)   || STATUSES[0];

// ── REVİZE NOTU MODAL ─────────────────────────────────────────────────────────
function RevisionModal({ task, onConfirm, onClose }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <h2 className="modal-title">🔄 Revizeye Gönder</h2>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 16 }}>
          <strong>{task.title}</strong> görevi personele geri gönderilecek.
        </p>
        <div className="form-group">
          <label className="form-label">Revize Notu (isteğe bağlı)</label>
          <textarea className="form-textarea" rows={3}
            placeholder="Neyin düzeltilmesi gerektiğini açıklayın…"
            value={note} onChange={e => setNote(e.target.value)}
          />
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>İptal</button>
          <button className="btn btn-danger" disabled={saving}
            onClick={async () => { setSaving(true); await onConfirm(note); setSaving(false); }}>
            {saving ? '⏳…' : '🔄 Revizeye Gönder'}
          </button>
        </div>
      </div>
    </div>
  );
}

function daysLeft(date) {
  if (!date) return null;
  return differenceInCalendarDays(new Date(date), new Date());
}
function daysChip(d) {
  if (d === null) return null;
  if (d < 0)  return { label: `${Math.abs(d)}g gecikmiş`, color: '#ef4444', bg: '#fef2f2' };
  if (d === 0) return { label: 'Bugün!',  color: '#ef4444', bg: '#fef2f2' };
  if (d <= 3)  return { label: `${d}g kaldı`, color: '#f97316', bg: '#fff7ed' };
  if (d <= 7)  return { label: `${d}g kaldı`, color: '#eab308', bg: '#fefce8' };
  return       { label: `${d}g kaldı`, color: '#22c55e', bg: '#f0fdf4' };
}

const EMPTY_FORM = {
  title: '', description: '', assigned_to: '', assigned_to_name: '',
  unit: '', due_date: '', priority: 'yuksek', status: 'bekliyor', notes: '',
  is_private: false,
};

// ── ANA COMPONENT ─────────────────────────────────────────────────────────────
export default function Agendas({ user, profile, onNavigate }) {
  const [agendas,  setAgendas]  = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [editId,   setEditId]   = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [filter,        setFilter]       = useState({ search: '', priority: '', status: '' });
  const [saveError,     setSaveError]    = useState('');
  const [revisionModal, setRevisionModal] = useState(null); // agenda item waiting for revision note

  const role       = profile?.role;
  const isDirector = ['direktor', 'direktor_yardimcisi', 'asistan'].includes(role);
  const isKoord    = role === 'koordinator';
  const myUnit     = profile?.unit;
  const myId       = user?.id;

  const isAsistan = role === 'asistan';
  const isDirektor = ['direktor', 'direktor_yardimcisi'].includes(role);

  // useState'i role hesaplandıktan sonra, doğrudan değerle başlatıyoruz
  const [activeTab, setActiveTab] = useState(() => {
    const r = profile?.role;
    if (r === 'koordinator') return 'team';
    if (['direktor', 'direktor_yardimcisi'].includes(r)) return 'koordinators';
    if (r === 'asistan') return 'mine';
    return 'mine';
  });

  // Profile async geldiğinde tab'ı düzelt (race condition fix)
  useEffect(() => {
    if (!profile?.role) return;
    setActiveTab(curr => {
      if (curr !== 'mine') return curr;
      const r = profile.role;
      if (r === 'koordinator') return 'team';
      if (['direktor', 'direktor_yardimcisi'].includes(r)) return 'koordinators';
      if (r === 'asistan') return 'mine';
      return 'mine';
    });
  }, [profile?.role]); // eslint-disable-line

  // ── FETCH ──
  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: ag }, { data: pr }] = await Promise.all([
      getAllAgendas(myId),   // myId: kendi private gündemlerini görür, başkalarınınkini görmez
      getAllProfiles(),
    ]);
    setAgendas(ag || []);
    setProfiles(pr || []);
    setLoading(false);
  }, [myId]);

  useEffect(() => { load(); }, [load]);

  // ── Atanabilecek kişiler (role'e göre) ──
  const assignableUsers = useMemo(() => {
    if (!profiles.length) return [];
    if (isDirector) return profiles.filter(p => p.user_id !== myId);
    if (isKoord)    return profiles.filter(p => p.unit === myUnit && p.user_id !== myId);
    return [];
  }, [profiles, isDirector, isKoord, myUnit, myId]);

  // ── Birim üyeleri (koordinatör için) ──
  const unitMembers = useMemo(() => {
    if (!myUnit) return [];
    return profiles.filter(p => p.unit === myUnit);
  }, [profiles, myUnit]);

  // Koordinatör user_id seti (direktör tabları için)
  const koordinatorIds = useMemo(() =>
    new Set(profiles.filter(p => p.role === 'koordinator').map(p => p.user_id)),
    [profiles]
  );

  // ── Filtrelenmiş gündemler (tab + search/öncelik/durum) ──
  const filtered = useMemo(() => {
    let base = agendas;
    if (activeTab === 'mine') {
      // Bana atananlar: asistan için de çalışır
      base = agendas.filter(a => a.assigned_to === myId);
    } else if (activeTab === 'my_items') {
      base = agendas.filter(a =>
        a.created_by === myId && (!a.assigned_to || a.assigned_to === myId)
      );
    } else if (activeTab === 'koordinators') {
      base = agendas.filter(a =>
        a.created_by === myId && a.assigned_to && koordinatorIds.has(a.assigned_to)
      );
    } else if (activeTab === 'all') {
      base = agendas;
    } else if (activeTab === 'pending_review') {
      base = agendas.filter(a =>
        a.completion_status === 'pending_review' &&
        (a.created_by === myId || (myUnit && a.unit === myUnit))
      );
    }
    // team tab: TeamDashboard kendi filtreler, burası boş geçer
    if (filter.search)   base = base.filter(a => a.title?.toLowerCase().includes(filter.search.toLowerCase()));
    if (filter.priority) base = base.filter(a => a.priority === filter.priority);
    if (filter.status)   base = base.filter(a => a.status   === filter.status);
    return base.sort((a, b) => {
      if (!a.due_date) return 1; if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    });
  }, [agendas, activeTab, myId, myUnit, filter, koordinatorIds]);

  // ── KPI ──
  const kpi = useMemo(() => {
    let base;
    if (activeTab === 'mine')         base = agendas.filter(a => a.assigned_to === myId);
    else if (activeTab === 'my_items') base = agendas.filter(a => a.created_by === myId && (!a.assigned_to || a.assigned_to === myId));
    else if (activeTab === 'koordinators') base = agendas.filter(a => a.created_by === myId && koordinatorIds.has(a.assigned_to));
    else if (activeTab === 'team')    base = agendas.filter(a => a.created_by === myId || (myUnit && a.unit === myUnit));
    else                              base = agendas;
    const active     = base.filter(a => a.status !== 'tamamlandi');
    const overdue    = active.filter(a => a.due_date && daysLeft(a.due_date) < 0);
    const thisWeek   = active.filter(a => { const d = daysLeft(a.due_date); return d !== null && d >= 0 && d <= 7; });
    const completed  = base.filter(a => a.status === 'tamamlandi');
    return { total: base.length, overdue: overdue.length, thisWeek: thisWeek.length, completed: completed.length };
  }, [agendas, activeTab, myId, myUnit, koordinatorIds]);

  // ── MODAL ──
  const openNew = () => {
    setForm({ ...EMPTY_FORM, unit: myUnit || '' });
    setEditId(null);
    setModal(true);
  };
  const openEdit = (a) => {
    setForm({
      title: a.title || '', description: a.description || '',
      assigned_to: a.assigned_to || '', assigned_to_name: a.assigned_to_name || '',
      unit: a.unit || '', due_date: a.due_date || '',
      priority: a.priority || 'yuksek', status: a.status || 'bekliyor',
      notes: a.notes || '',
    });
    setEditId(a.id);
    setModal(true);
  };
  const closeModal = () => { setModal(false); setForm(EMPTY_FORM); setEditId(null); setSaveError(''); };

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    setSaveError('');
    // Atanan kişinin adını profile'dan bul
    const assignedProfile = profiles.find(p => p.user_id === form.assigned_to);
    const payload = {
      ...form,
      assigned_to:      form.assigned_to      || null,
      assigned_to_name: assignedProfile?.full_name || form.assigned_to_name || null,
      unit:             form.unit || assignedProfile?.unit || myUnit || null,
      due_date:         form.due_date          || null,
      notes:            form.notes             || null,
      description:      form.description       || null,
      completed_at:     form.status === 'tamamlandi' ? new Date().toISOString() : null,
    };
    let error;
    if (editId) {
      ({ error } = await updateAgendaItem(editId, payload));
    } else {
      const createdByName = profile?.full_name || user?.email;
      ({ error } = await createAgendaItem({
        ...payload,
        created_by: myId,
        created_by_name: createdByName,
      }));
      // Başka birine atandıysa bildirim maili gönder (arka planda, hata varsa sessizce geç)
      if (!error && payload.assigned_to && payload.assigned_to !== myId) {
        notifyTaskAssigned({
          assignedToUserId: payload.assigned_to,
          taskTitle:        payload.title,
          taskDescription:  payload.description,
          taskPriority:     payload.priority,
          taskDueDate:      payload.due_date,
          taskUnit:         payload.unit,
          createdByName,
        }).catch(() => {/* bildirimi bloke etme */});
      }
    }
    setSaving(false);
    if (error) {
      setSaveError('Kayıt hatası: ' + (error.message || JSON.stringify(error)));
      return;
    }
    await load();
    closeModal();
  };

  const remove = async (id) => {
    if (!window.confirm('Bu gündem maddesini silmek istediğinizden emin misiniz?')) return;
    await deleteAgendaItem(id);
    load();
  };

  const quickStatus = async (id, status) => {
    const updates = { status };
    if (status === 'tamamlandi') updates.completed_at = new Date().toISOString();
    await updateAgendaItem(id, updates);
    setAgendas(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  // ── ONAY AKIŞI ──
  const handleMarkDone = async (id) => {
    const { error } = await markTaskPendingReview(id);
    if (error) { alert('Hata: ' + error.message); return; }
    setAgendas(prev => prev.map(a => a.id === id ? { ...a, completion_status: 'pending_review' } : a));
  };

  const handleApprove = async (id) => {
    const { error } = await approveTask(id, myId);
    if (error) { alert('Hata: ' + error.message); return; }
    setAgendas(prev => prev.map(a =>
      a.id === id ? { ...a, completion_status: 'approved', status: 'tamamlandi', completed_at: new Date().toISOString() } : a
    ));
  };

  const handleRevisionConfirm = async (note) => {
    if (!revisionModal) return;
    const { error } = await requestRevision(revisionModal.id, note, myId);
    if (error) { alert('Hata: ' + error.message); return; }
    setAgendas(prev => prev.map(a =>
      a.id === revisionModal.id ? { ...a, completion_status: 'revision_requested', revision_note: note } : a
    ));
    setRevisionModal(null);
  };

  // ── Onay bekleyen sayısı (koordinatör için badge) ──
  const pendingReviewCount = useMemo(() => {
    if (!isKoord) return 0;
    return agendas.filter(a =>
      a.completion_status === 'pending_review' &&
      (a.created_by === myId || (myUnit && a.unit === myUnit))
    ).length;
  }, [agendas, isKoord, myId, myUnit]);

  // ── Tab yapılandırması (role'e göre) ──
  const tabs = useMemo(() => {
    if (isDirektor) return [
      { key: 'koordinators', label: '📤 Koordinatörlere Atadığım' },
      { key: 'all',          label: '🌐 Departman Gündemi' },
      { key: 'my_items',     label: '📋 Gündemlerim' },
    ];
    if (isAsistan) return [
      { key: 'mine',     label: '📋 Bana Atananlar' },
      { key: 'my_items', label: '📒 Gündemlerim' },
    ];
    if (isKoord) return [
      { key: 'team',           label: `🏢 ${myUnit || 'Birimim'}` },
      { key: 'pending_review', label: `⏳ Onay Bekleyenler`, badge: pendingReviewCount },
      { key: 'mine',           label: '📋 Bana Atananlar' },
      { key: 'my_items',       label: '📒 Gündemlerim' },
    ];
    return [
      { key: 'mine',     label: '📋 Bana Atananlar' },
      { key: 'my_items', label: '📒 Gündemlerim' },
    ];
  }, [isDirektor, isAsistan, isKoord, myUnit, pendingReviewCount]);

  if (loading) return (
    <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
      <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
      Gündemler yükleniyor…
    </div>
  );

  return (
    <div className="page" style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* KORDİNATÖR BİRİM UYARISI */}
      {isKoord && !myUnit && (
        <div style={{
          marginBottom: 16, padding: '14px 18px', borderRadius: 10,
          background: '#fff7ed', border: '1.5px solid #f97316',
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <div style={{ fontSize: 20, flexShrink: 0 }}>⚠️</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: '#c2410c', marginBottom: 3 }}>
              Biriminiz henüz atanmamış
            </div>
            <div style={{ fontSize: 12.5, color: '#92400e', lineHeight: 1.6 }}>
              Personele görev atayabilmek ve birim dashboardını görebilmek için yöneticinizden
              profilinize birim ataması yapmasını isteyin. (Admin Paneli → Kullanıcı Yönetimi → Birim seç)
            </div>
          </div>
        </div>
      )}

      {/* BAŞLIK */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">📋 Gündemler</h1>
            <p className="page-subtitle">
              {kpi.total} gündem · {kpi.overdue > 0 ? `${kpi.overdue} gecikmiş · ` : ''}{kpi.thisWeek} bu hafta
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(isDirector || isKoord || activeTab === 'my_items') && (
              <button className="btn btn-primary" onClick={openNew}>+ Yeni Gündem</button>
            )}
          </div>
        </div>

        {/* KPI Kartlar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 16 }}>
          {[
            { label: 'Toplam', value: kpi.total,     color: 'var(--navy)',   icon: '📋' },
            { label: 'Gecikmiş', value: kpi.overdue, color: '#ef4444',       icon: '🔴' },
            { label: 'Bu Hafta', value: kpi.thisWeek, color: '#f97316',      icon: '⏰' },
            { label: 'Tamamlandı', value: kpi.completed, color: '#22c55e',   icon: '✅' },
          ].map((k, i) => (
            <div key={i} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 22 }}>{k.icon}</div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em' }}>{k.label.toUpperCase()}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* TABS */}
      {tabs.length > 1 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--surface)', borderRadius: 10, padding: 4, border: '1px solid var(--border)', width: 'fit-content', flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
              background: activeTab === t.key ? 'var(--navy)' : 'transparent',
              color: activeTab === t.key ? 'white' : 'var(--text-muted)',
              fontWeight: activeTab === t.key ? 700 : 400, fontSize: 13,
              fontFamily: 'var(--font-body)', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {t.label}
              {t.badge > 0 && (
                <span style={{
                  background: activeTab === t.key ? 'rgba(255,255,255,0.3)' : '#ef4444',
                  color: 'white', borderRadius: 10, fontSize: 11, fontWeight: 700,
                  padding: '1px 6px', lineHeight: 1.5,
                }}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* KORDİNATÖR: BİRİM DASHBOARDI */}
      {isKoord && activeTab === 'team' && (
        <TeamDashboard
          agendas={agendas.filter(a => a.created_by === myId || (myUnit && a.unit === myUnit))}
          members={unitMembers}
          myId={myId}
          myUnit={myUnit}
          isDirector={false}
          onStatusChange={quickStatus}
          onEdit={openEdit}
          onDelete={remove}
        />
      )}

      {/* DİREKTÖR: Koordinatörlere Atadığım — kişi kartları */}
      {isDirektor && activeTab === 'koordinators' && (
        <TeamDashboard
          agendas={agendas.filter(a => a.created_by === myId)}
          members={profiles.filter(p => p.role === 'koordinator')}
          myId={myId}
          myUnit={null}
          isDirector={true}
          onStatusChange={quickStatus}
          onEdit={openEdit}
          onDelete={remove}
          emptyMessage="Henüz koordinatöre atanmış gündem yok. '+ Yeni Gündem' ile başlayın."
        />
      )}

      {/* DİREKTÖR: Departman Gündemi — TÜM gündemler listesi */}
      {isDirektor && activeTab === 'all' && (
        <DepartmanGundem
          agendas={agendas}
          profiles={profiles}
          myId={myId}
          onEdit={openEdit}
          onDelete={remove}
          onStatusChange={quickStatus}
        />
      )}

      {/* STANDART LİSTE GÖRÜNÜMÜ (mine / my_items / pending_review) */}
      {(activeTab === 'mine' || activeTab === 'my_items' || activeTab === 'pending_review') && (
        <>
          {/* FİLTRELER */}
          <div className="card" style={{ marginBottom: 14, padding: '12px 16px' }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className="form-input" style={{ width: 220 }}
                placeholder="🔍 Gündem ara..."
                value={filter.search}
                onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
              />
              <select className="form-select" style={{ width: 150 }} value={filter.priority} onChange={e => setFilter(f => ({ ...f, priority: e.target.value }))}>
                <option value="">Tüm Öncelikler</option>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <select className="form-select" style={{ width: 160 }} value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
                <option value="">Tüm Durumlar</option>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              {(filter.search || filter.priority || filter.status) && (
                <button className="btn btn-outline btn-sm" onClick={() => setFilter({ search: '', priority: '', status: '' })}>✕ Temizle</button>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>{filtered.length} sonuç</span>
            </div>
          </div>

          {/* GÖREV LİSTESİ */}
          {filtered.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>
                {activeTab === 'pending_review' ? '✅' : '📭'}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--navy)', marginBottom: 6 }}>
                {activeTab === 'pending_review' ? 'Bekleyen onay yok' : 'Gündem bulunamadı'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {activeTab === 'pending_review'
                  ? 'Personelden onay bekleyen görev bulunmuyor.'
                  : 'Bu sekme için henüz gündem yok.'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(a => (
                <AgendaCard
                  key={a.id}
                  agenda={a}
                  canEdit={isDirector || a.created_by === myId}
                  canUpdateStatus={isDirector || a.created_by === myId || a.assigned_to === myId}
                  onEdit={openEdit}
                  onDelete={remove}
                  onStatusChange={quickStatus}
                  showAssignee={activeTab !== 'mine'}
                  showCreator={activeTab === 'pending_review'}
                  myId={myId}
                  isKoord={isKoord}
                  onMarkDone={handleMarkDone}
                  onApprove={handleApprove}
                  onRevision={setRevisionModal}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* MODAL */}
      {modal && (
        <AgendaModal
          form={form} setForm={setForm} editId={editId}
          assignableUsers={assignableUsers}
          allProfiles={profiles}
          myId={myId}
          role={role}
          isDirector={isDirector} isKoord={isKoord}
          myUnit={myUnit}
          saving={saving} saveError={saveError}
          onSave={save} onClose={closeModal}
        />
      )}

      {/* REVİZE MODAL */}
      {revisionModal && (
        <RevisionModal
          task={revisionModal}
          onConfirm={handleRevisionConfirm}
          onClose={() => setRevisionModal(null)}
        />
      )}
    </div>
  );
}

// ── TEAM DASHBOARD (koordinatör + direktör kişi kartları) ─────────────────────
function TeamDashboard({ agendas, members, myId, onStatusChange, onEdit, onDelete, emptyMessage }) {
  const byPerson = useMemo(() => {
    const map = {};
    members.forEach(m => { map[m.user_id] = { profile: m, tasks: [] }; });
    agendas.forEach(a => {
      if (a.assigned_to && map[a.assigned_to]) {
        map[a.assigned_to].tasks.push(a);
      }
    });
    return Object.values(map);
  }, [members, agendas]);

  const unassigned = agendas.filter(a => !a.assigned_to);

  if (members.length === 0) return (
    <div className="card" style={{ padding: 48, textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>👥</div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>{emptyMessage || 'Gösterilecek kişi bulunamadı.'}</div>
    </div>
  );

  return (
    <div>
      {/* Kişi bazlı kartlar */}
      {byPerson.map(({ profile: p, tasks }) => {
        const done    = tasks.filter(t => t.status === 'tamamlandi').length;
        const overdue = tasks.filter(t => t.status !== 'tamamlandi' && t.due_date && differenceInCalendarDays(new Date(t.due_date), new Date()) < 0).length;
        const pct     = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
        return (
          <div key={p.user_id} className="card" style={{ marginBottom: 14, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <UserAvatar
                  profile={{ full_name: p.full_name, avatar_url: p.avatar_url }}
                  size={38}
                  fontSize={15}
                  style={{ border: '2px solid rgba(26,58,92,0.15)' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>{p.full_name || p.user_id}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {ROLE_LABELS[p.role] || p.role}{p.unit ? ` · ${p.unit}` : ''}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {overdue > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', background: '#fef2f2', padding: '3px 8px', borderRadius: 6 }}>
                    {overdue} gecikmiş
                  </span>
                )}
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{done}/{tasks.length} tamamlandı</span>
                <div style={{ width: 80, height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#22c55e' : 'var(--navy)', borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? '#22c55e' : 'var(--navy)', minWidth: 32 }}>%{pct}</span>
              </div>
            </div>
            {tasks.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '8px 0', fontStyle: 'italic' }}>Henüz görev atanmamış</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {tasks.map(t => <AgendaRow key={t.id} agenda={t} onStatusChange={onStatusChange} onEdit={onEdit} onDelete={onDelete} />)}
              </div>
            )}
          </div>
        );
      })}

      {/* Kişiye atanmamış görevler */}
      {unassigned.length > 0 && (
        <div className="card" style={{ marginBottom: 14, padding: '16px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>📌 Kişiye Atanmamış</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {unassigned.map(t => <AgendaRow key={t.id} agenda={t} onStatusChange={onStatusChange} onEdit={onEdit} onDelete={onDelete} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── DEPARTMAN GÜNDEMİ (Direktör — tüm departman, birime göre gruplu) ──────────
function DepartmanGundem({ agendas, profiles, myId, onEdit, onDelete, onStatusChange }) { // eslint-disable-line
  const koordinatorlar = profiles.filter(p => p.role === 'koordinator');

  // Birim grupları: her koordinatör için kendi biriminin gündemleri
  const byUnit = useMemo(() => {
    const groups = koordinatorlar.map(k => ({
      koordinator: k,
      agendas: agendas.filter(a => a.unit === k.unit || a.assigned_to === k.user_id ||
        profiles.find(p => p.user_id === a.assigned_to)?.unit === k.unit
      ),
    }));
    // Birime atanmamış / birim dışı gündemler
    const assignedUnits = new Set(koordinatorlar.map(k => k.unit).filter(Boolean));
    const diger = agendas.filter(a => {
      const assigneeUnit = profiles.find(p => p.user_id === a.assigned_to)?.unit;
      return !assignedUnits.has(a.unit) && !assignedUnits.has(assigneeUnit);
    });
    return { groups, diger };
  }, [agendas, koordinatorlar, profiles]);

  const [filter, setFilter] = useState({ search: '', status: '' });

  const filterFn = (list) => {
    let r = list;
    if (filter.search) r = r.filter(a => a.title?.toLowerCase().includes(filter.search.toLowerCase()));
    if (filter.status) r = r.filter(a => a.status === filter.status);
    return r.sort((a, b) => {
      if (!a.due_date) return 1; if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    });
  };

  return (
    <div>
      {/* Filtre */}
      <div className="card" style={{ marginBottom: 14, padding: '10px 14px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="form-input" style={{ width: 220 }} placeholder="🔍 Gündem ara..."
            value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} />
          <select className="form-select" style={{ width: 160 }} value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
            <option value="">Tüm Durumlar</option>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {(filter.search || filter.status) && (
            <button className="btn btn-outline btn-sm" onClick={() => setFilter({ search: '', status: '' })}>✕ Temizle</button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
            {agendas.length} toplam gündem
          </span>
        </div>
      </div>

      {/* Birim grupları */}
      {byUnit.groups.map(({ koordinator: k, agendas: unitAgs }) => {
        const visible = filterFn(unitAgs);
        const done = unitAgs.filter(a => a.status === 'tamamlandi').length;
        const pct = unitAgs.length > 0 ? Math.round((done / unitAgs.length) * 100) : 0;
        return (
          <div key={k.user_id} className="card" style={{ marginBottom: 14 }}>
            {/* Birim başlığı */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: visible.length > 0 ? 12 : 0,
              paddingBottom: visible.length > 0 ? 12 : 0,
              borderBottom: visible.length > 0 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ fontSize: 18 }}>🏢</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--navy)' }}>{k.unit || 'Birim Belirtilmemiş'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Koordinatör: {k.full_name || k.user_id}</div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{done}/{unitAgs.length}</span>
              <div style={{ width: 60, height: 5, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#22c55e' : 'var(--navy)', borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: pct === 100 ? '#22c55e' : 'var(--navy)', minWidth: 28 }}>%{pct}</span>
            </div>
            {visible.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontStyle: 'italic', paddingTop: 4 }}>
                {unitAgs.length === 0 ? 'Bu birime atanmış gündem yok.' : 'Filtre sonucu bulunamadı.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {visible.map(a => (
                  <AgendaCard key={a.id} agenda={a}
                    canEdit={true} canUpdateStatus={true}
                    onEdit={onEdit} onDelete={onDelete} onStatusChange={onStatusChange}
                    showAssignee={true} showCreator={false}
                    myId={myId}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Birim dışı gündemler */}
      {byUnit.diger.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>📌 Diğer / Birimi Belirsiz</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filterFn(byUnit.diger).map(a => (
              <AgendaCard key={a.id} agenda={a}
                canEdit={true} canUpdateStatus={true}
                onEdit={onEdit} onDelete={onDelete} onStatusChange={onStatusChange}
                showAssignee={true} showCreator={true}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── GÜNDEM KARTI (Liste görünümü) ─────────────────────────────────────────────
function AgendaCard({
  agenda: a, canEdit, canUpdateStatus, onEdit, onDelete, onStatusChange,
  showAssignee, showCreator,
  myId, isKoord, onMarkDone, onApprove, onRevision, onNavigate,
}) {
  const pm   = prioMeta(a.priority);
  const sm   = statMeta(a.status);
  const days = daysLeft(a.due_date);
  const dc   = daysChip(days);
  const cs   = a.completion_status ? COMPLETION_STATUS[a.completion_status] : null;

  const isMyTask     = a.assigned_to === myId;
  const canMarkDone  = isMyTask && a.status !== 'tamamlandi' &&
                       !['pending_review', 'approved'].includes(a.completion_status);
  const canApproveRevise = isKoord && a.completion_status === 'pending_review';

  return (
    <div className="card" style={{
      padding: '14px 18px',
      borderLeft: `4px solid ${pm.color}`,
      opacity: a.status === 'tamamlandi' && a.completion_status !== 'pending_review' ? 0.65 : 1,
    }}>
      {/* Revize notu banner */}
      {a.completion_status === 'revision_requested' && a.revision_note && (
        <div style={{
          marginBottom: 10, padding: '8px 12px', borderRadius: 7,
          background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12.5, color: '#dc2626',
        }}>
          🔄 <strong>Revize notu:</strong> {a.revision_note}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        {/* Durum toggle */}
        <button
          title="Durumu değiştir"
          disabled={!canUpdateStatus}
          onClick={() => {
            if (!canUpdateStatus) return;
            const next = a.status === 'bekliyor' ? 'devam_ediyor' : a.status === 'devam_ediyor' ? 'tamamlandi' : 'bekliyor';
            onStatusChange(a.id, next);
          }}
          style={{
            width: 28, height: 28, borderRadius: '50%', border: `2px solid ${sm.color}`,
            background: a.status === 'tamamlandi' ? sm.color : 'white',
            cursor: canUpdateStatus ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, flexShrink: 0, marginTop: 1,
          }}
        >
          {a.status === 'tamamlandi' ? '✓' : a.status === 'devam_ediyor' ? '●' : ''}
        </button>

        {/* İçerik */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{
              fontWeight: 700, fontSize: 14, color: 'var(--navy)',
              textDecoration: a.status === 'tamamlandi' && !a.completion_status ? 'line-through' : 'none',
            }}>{a.title}</span>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: pm.bg, color: pm.color }}>{pm.label}</span>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 6, color: sm.color, background: sm.color + '18' }}>{sm.label}</span>
            {cs && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, color: cs.color, background: cs.bg, border: `1px solid ${cs.border}` }}>
                {cs.label}
              </span>
            )}
          </div>
          {a.description && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 4 }}>{a.description}</div>}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
            {showAssignee && a.assigned_to_name && <span>👤 {a.assigned_to_name}</span>}
            {showCreator  && a.created_by_name  && <span>📤 {a.created_by_name}</span>}
            {a.unit && <span>🏢 {a.unit}</span>}
            {a.due_date && <span>📅 {a.due_date}</span>}
          </div>

          {/* Aksiyon butonları */}
          {(canMarkDone || canApproveRevise || (isMyTask && onNavigate)) && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {canMarkDone && onMarkDone && (
                <button
                  className="btn btn-sm"
                  style={{ background: '#16a34a', color: 'white', border: 'none', fontSize: 12, padding: '5px 12px', borderRadius: 7 }}
                  onClick={() => onMarkDone(a.id)}
                >
                  ✓ Tamamlandım — Onaya Gönder
                </button>
              )}
              {isMyTask && onNavigate && a.status !== 'tamamlandi' && (
                <button
                  className="btn btn-sm"
                  style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontSize: 12, padding: '5px 12px', borderRadius: 7 }}
                  onClick={() => onNavigate('dailylog', { linkedTask: a })}
                >
                  📝 İş Kaydı Ekle
                </button>
              )}
              {canApproveRevise && (
                <>
                  {onApprove && (
                    <button
                      className="btn btn-sm"
                      style={{ background: '#16a34a', color: 'white', border: 'none', fontSize: 12, padding: '5px 12px', borderRadius: 7 }}
                      onClick={() => onApprove(a.id)}
                    >
                      ✅ Onayla
                    </button>
                  )}
                  {onRevision && (
                    <button
                      className="btn btn-sm"
                      style={{ background: '#ef4444', color: 'white', border: 'none', fontSize: 12, padding: '5px 12px', borderRadius: 7 }}
                      onClick={() => onRevision(a)}
                    >
                      🔄 Revize İste
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Sağ: kalan gün + aksiyonlar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {dc && (
            <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: dc.bg, color: dc.color }}>
              {dc.label}
            </span>
          )}
          {canEdit && (
            <>
              <button className="btn btn-outline btn-sm btn-icon" onClick={() => onEdit(a)} title="Düzenle">✏️</button>
              <button className="btn btn-outline btn-sm btn-icon" onClick={() => onDelete(a.id)} title="Sil" style={{ color: '#ef4444' }}>🗑</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── GÜNDEM SATIRI (Dashboard için kompakt) ────────────────────────────────────
function AgendaRow({ agenda: a, onStatusChange, onEdit, onDelete }) {
  const pm = prioMeta(a.priority);
  const dc = daysChip(daysLeft(a.due_date));
  const cs = a.completion_status ? COMPLETION_STATUS[a.completion_status] : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
      background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)',
      opacity: a.status === 'tamamlandi' && !a.completion_status ? 0.55 : 1,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: pm.color, flexShrink: 0 }} />
      <span style={{
        flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--navy)',
        textDecoration: a.status === 'tamamlandi' && !a.completion_status ? 'line-through' : 'none',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{a.title}</span>
      {cs && <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 5, background: cs.bg, color: cs.color, border: `1px solid ${cs.border}`, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>{cs.label}</span>}
      {dc && <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 5, background: dc.bg, color: dc.color, fontWeight: 600, whiteSpace: 'nowrap' }}>{dc.label}</span>}
      <select
        value={a.status}
        onChange={e => onStatusChange(a.id, e.target.value)}
        style={{ border: 'none', background: 'transparent', fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)' }}
      >
        {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <button className="btn btn-outline btn-sm btn-icon" onClick={() => onEdit(a)} title="Düzenle" style={{ padding: '2px 6px', fontSize: 12 }}>✏️</button>
    </div>
  );
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
// Direktör/yardımcısı için tam liste (asistan dahil)
const TARGET_GROUPS_FULL = [
  { key: 'asistan',     label: '🗂️ Asistana',      desc: 'Yönetici asistanına atanacak' },
  { key: 'koordinator', label: '📤 Koordinatöre',  desc: 'Koordinatöre atanacak' },
  { key: 'personel',    label: '👤 Personele',      desc: 'Personele atanacak' },
  { key: 'self',        label: '📋 Kendime',        desc: 'Kendi gündemim' },
];

function AgendaModal({ form, setForm, editId, assignableUsers, allProfiles, myId, role, isDirector, isKoord, myUnit, saving, saveError, onSave, onClose }) {
  const f = (field, val) => setForm(prev => ({ ...prev, [field]: val }));
  const isDirektor = ['direktor', 'direktor_yardimcisi'].includes(role);
  const isAsistanRole = role === 'asistan';

  const [targetGroup, setTargetGroup] = React.useState(isDirektor ? 'asistan' : 'self');

  // targetGroup değişince assigned_to + is_private güncelle
  const handleTargetChange = (key) => {
    setTargetGroup(key);
    f('assigned_to', key === 'self' ? (myId || '') : '');
    // Asistana atanan görevler + "Kendime" görevler private
    f('is_private', key === 'self' || key === 'asistan');
  };

  // Direktör için filtrelenmiş atanabilir kişi listesi
  const filteredAssignees = React.useMemo(() => {
    if (!isDirector) return assignableUsers;
    if (targetGroup === 'self') return [];
    if (targetGroup === 'asistan')     return (allProfiles || []).filter(p => p.role === 'asistan' && p.user_id !== myId);
    if (targetGroup === 'koordinator') return (allProfiles || []).filter(p => p.role === 'koordinator' && p.user_id !== myId);
    // personel: yönetici kadro dışındakiler
    return (allProfiles || []).filter(p =>
      p.user_id !== myId &&
      !['direktor', 'direktor_yardimcisi', 'asistan', 'koordinator'].includes(p.role)
    );
  }, [isDirector, targetGroup, assignableUsers, allProfiles, myId]);

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <h2 className="modal-title">{editId ? '✏️ Gündem Düzenle' : '📋 Yeni Gündem Ekle'}</h2>

        {/* Direktör/Yardımcısı: Kime atanacak seçimi */}
        {isDirektor && !editId && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>KİME ATANACAK?</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TARGET_GROUPS_FULL.map(tg => (
                <button
                  key={tg.key}
                  type="button"
                  onClick={() => handleTargetChange(tg.key)}
                  style={{
                    flex: '1 1 80px', padding: '10px 8px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: targetGroup === tg.key ? 'var(--primary,#2563eb)' : 'var(--surface)',
                    color: targetGroup === tg.key ? 'white' : 'var(--text-muted)',
                    fontWeight: targetGroup === tg.key ? 700 : 500,
                    fontSize: 12.5, fontFamily: 'var(--font-body)',
                    outline: targetGroup !== tg.key ? '1px solid var(--border)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {tg.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Başlık */}
        <div className="form-group">
          <label className="form-label">Başlık *</label>
          <input className="form-input" placeholder="Gündem başlığı..." value={form.title} onChange={e => f('title', e.target.value)} />
        </div>

        {/* Açıklama */}
        <div className="form-group">
          <label className="form-label">Açıklama</label>
          <textarea className="form-textarea" placeholder="Detaylar..." rows={2} value={form.description} onChange={e => f('description', e.target.value)} />
        </div>

        {/* Atanan kişi + Birim */}
        <div className="form-row">
          {/* Direktör/Yardımcısı: "Kendime" seçilmediyse kişi seç */}
          {isDirektor && targetGroup !== 'self' && (
            <div className="form-group">
              <label className="form-label">
                {targetGroup === 'asistan' ? 'Asistan Seç'
                  : targetGroup === 'koordinator' ? 'Koordinatör Seç'
                  : 'Personel Seç'}
              </label>
              {filteredAssignees.length === 0 ? (
                <div style={{ padding: '9px 12px', borderRadius: 8, fontSize: 12, background: '#fff7ed', border: '1px solid #f9731644', color: '#92400e' }}>
                  ⚠️ Bu kategoride atanabilecek kişi bulunamadı.
                </div>
              ) : (
                <select className="form-select" value={form.assigned_to} onChange={e => f('assigned_to', e.target.value)}>
                  <option value="">— Kişi seçin —</option>
                  {filteredAssignees.map(p => (
                    <option key={p.user_id} value={p.user_id}>
                      {p.full_name || p.user_id}{p.unit ? ` (${p.unit})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Koordinatör kendi personeline atıyor */}
          {isKoord && (
            <div className="form-group">
              <label className="form-label">Atanan Kişi</label>
              {assignableUsers.length === 0 ? (
                <div style={{ padding: '9px 12px', borderRadius: 8, fontSize: 12, background: '#fff7ed', border: '1px solid #f9731644', color: '#92400e' }}>
                  ⚠️ Biriminizde atanabilecek personel bulunamadı. Yöneticinize birim ataması için başvurun.
                </div>
              ) : (
                <select className="form-select" value={form.assigned_to} onChange={e => f('assigned_to', e.target.value)}>
                  <option value="">— Kişi seçin —</option>
                  {assignableUsers.map(p => (
                    <option key={p.user_id} value={p.user_id}>
                      {p.full_name || p.user_id} {p.unit ? `(${p.unit})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Birim</label>
            <input className="form-input" placeholder="Birim..." value={form.unit} onChange={e => f('unit', e.target.value)} />
          </div>
        </div>

        {/* Son Tarih + Öncelik */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Son Tarih</label>
            <input className="form-input" type="date" value={form.due_date} onChange={e => f('due_date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Öncelik</label>
            <select className="form-select" value={form.priority} onChange={e => f('priority', e.target.value)}>
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        {/* Durum */}
        <div className="form-group">
          <label className="form-label">Durum</label>
          <select className="form-select" value={form.status} onChange={e => f('status', e.target.value)}>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {/* Notlar */}
        <div className="form-group">
          <label className="form-label">Notlar</label>
          <textarea className="form-textarea" placeholder="Ek notlar..." rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} />
        </div>

        {saveError && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 12,
            background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 12.5,
          }}>
            ❌ {saveError}
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving || !form.title.trim()}>
            {saving ? '⏳ Kaydediliyor...' : editId ? 'Güncelle' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
