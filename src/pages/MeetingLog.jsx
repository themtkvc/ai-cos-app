import React, { useState, useEffect, useMemo } from 'react';
import { getMeetingActions, createMeetingAction, updateMeetingAction } from '../lib/supabase';
import { differenceInCalendarDays } from 'date-fns';
import { UNITS as UNIT_LIST, ROLE_LABELS } from '../lib/constants';
import EmptyState from '../components/EmptyState';

const MEETING_TYPES = ['Koordinatörler Toplantısı', 'Board Toplantısı', '1:1 Koordinatör', '1:1 Çalışan', '1:1 Müdür Yardımcısı', 'Donör Toplantısı', 'Diğer'];
const STATUSES = ['⚪ Not Started', '🔵 In Progress', '✅ Completed', '🔴 Overdue'];
const STATUS_TR = {
  '⚪ Not Started': '⚪ Başlanmadı',
  '🔵 In Progress': '🔵 Devam Ediyor',
  '✅ Completed': '✅ Tamamlandı',
  '🔴 Overdue': '🔴 Gecikmiş'
};

const trS = (val) => STATUS_TR[val] || val;

function daysLeft(date) {
  return differenceInCalendarDays(new Date(date), new Date());
}

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

export default function MeetingLog({ user, profile, onNavigate }) {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [filter, setFilter] = useState({ type: '', owner: '', showCompleted: false });
  const [saving, setSaving] = useState(false);

  // Role detection
  const isDirektor = useMemo(() => {
    if (!profile) return false;
    return ['direktor', 'direktor_yardimcisi', 'asistan'].includes(profile.role);
  }, [profile]);

  const isKoordinator = useMemo(() => {
    if (!profile) return false;
    return profile.role === 'koordinator';
  }, [profile]);

  const isPersonel = useMemo(() => {
    if (!profile) return false;
    return profile.role === 'personel';
  }, [profile]);

  // Build owners list dynamically
  const OWNERS = useMemo(() => {
    const owners = ['Direktör'];
    UNIT_LIST.forEach(u => {
      if (u.coordinator) owners.push(u.coordinator);
    });
    owners.push('Tüm Koordinatörler');
    return owners;
  }, []);

  // Load data
  const load = () => {
    getMeetingActions(user.id).then(({ data }) => {
      setActions(data || []);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, [user]);

  // Set default owner filter for koordinator
  useEffect(() => {
    if (isKoordinator && profile?.name && !filter.owner) {
      setFilter(f => ({ ...f, owner: profile.name }));
    }
  }, [isKoordinator, profile]);

  // Filter actions based on role and filters
  const filtered = useMemo(() => {
    let result = [...actions];

    // Role-based visibility
    if (isPersonel) {
      // Personel: only sees actions assigned to them or in their unit
      result = result.filter(a => a.owner === profile?.name || a.owner === profile?.unit);
    }

    // Apply filters
    if (!filter.showCompleted) {
      result = result.filter(a => a.status !== '✅ Completed');
    }
    if (filter.type) {
      result = result.filter(a => a.meeting_type === filter.type);
    }
    if (filter.owner) {
      result = result.filter(a => a.owner === filter.owner);
    }

    // Sort by due date
    result.sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    });

    return result;
  }, [actions, filter, isPersonel, profile]);

  // Calculate KPIs
  const open = useMemo(() => {
    let result = actions.filter(a => a.status !== '✅ Completed');
    if (isPersonel) {
      result = result.filter(a => a.owner === profile?.name || a.owner === profile?.unit);
    }
    return result;
  }, [actions, isPersonel, profile]);

  const overdue = useMemo(() => {
    return open.filter(a => a.due_date && daysLeft(a.due_date) < 0);
  }, [open]);

  const thisWeek = useMemo(() => {
    return open.filter(a => a.due_date && daysLeft(a.due_date) <= 7 && daysLeft(a.due_date) >= 0);
  }, [open]);

  const completed = useMemo(() => {
    let result = actions.filter(a => a.status === '✅ Completed');
    if (isPersonel) {
      result = result.filter(a => a.owner === profile?.name || a.owner === profile?.unit);
    }
    return result;
  }, [actions, isPersonel, profile]);

  // Meeting type grouping
  const byType = useMemo(() => {
    const counts = {};
    open.forEach(a => {
      counts[a.meeting_type] = (counts[a.meeting_type] || 0) + 1;
    });
    return counts;
  }, [open]);

  // Modal handlers
  const getEmptyForm = () => ({
    meeting_type: MEETING_TYPES[0],
    meeting_date: new Date().toISOString().slice(0, 10),
    action_item: '',
    owner: isKoordinator ? profile?.name || '' : 'Direktör',
    due_date: '',
    status: '⚪ Not Started',
    notes: ''
  });

  const openNew = () => {
    setForm(getEmptyForm());
    setEditId(null);
    setModal(true);
  };

  const openEdit = (a) => {
    // Check permissions
    if (isPersonel) {
      alert('Yetkiniz yok');
      return;
    }
    if (isKoordinator && a.owner !== profile?.name) {
      alert('Sadece kendi aksiyonlarınızı düzenleyebilirsiniz');
      return;
    }
    setForm({ ...a });
    setEditId(a.id);
    setModal(true);
  };

  const closeModal = () => {
    setModal(false);
    setForm(null);
    setEditId(null);
  };

  const save = async () => {
    if (!form.action_item.trim()) {
      alert('Aksiyon maddesi gerekli');
      return;
    }

    setSaving(true);
    try {
      if (editId) {
        await updateMeetingAction(editId, form);
      } else {
        await createMeetingAction({ ...form, user_id: user.id });
      }
      await load();
      closeModal();
    } catch (err) {
      alert('Kayıt başarısız: ' + err.message);
    }
    setSaving(false);
  };

  const quickStatus = async (id, status) => {
    const action = actions.find(a => a.id === id);

    // Check permissions
    if (isPersonel) return;
    if (isKoordinator && action.owner !== profile?.name) return;

    try {
      await updateMeetingAction(id, { status });
      await load();
    } catch (err) {
      alert('Güncelleme başarısız');
    }
  };

  const canCreate = isDirektor || isKoordinator;
  const canEdit = isDirektor || isKoordinator;

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Yükleniyor…</div>;
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">📋 Toplantı Aksiyon Logu</h1>
            <p className="page-subtitle">{open.length} açık aksiyon · {overdue.length} gecikmiş</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => onNavigate('chat', { initialMessage: 'Tüm açık toplantı aksiyonlarını özetle, kime ne düşüyor, geciken var mı?' })}
            >
              🤖 AI özeti
            </button>
            {canCreate && (
              <button className="btn btn-primary" onClick={openNew}>
                + Yeni Aksiyon
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="kpi-card red">
          <div className="kpi-label">Gecikmiş</div>
          <div className="kpi-value">{overdue.length}</div>
        </div>
        <div className="kpi-card orange">
          <div className="kpi-label">Bu Hafta</div>
          <div className="kpi-value">{thisWeek.length}</div>
        </div>
        <div className="kpi-card blue">
          <div className="kpi-label">Devam Eden</div>
          <div className="kpi-value">{open.length}</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-label">Tamamlanan</div>
          <div className="kpi-value">{completed.length}</div>
        </div>
      </div>

      {/* Meeting type grouping */}
      {Object.keys(byType).length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <span className="section-dot"></span>
            <h3 className="section-title">Toplantı Türüne Göre Açık Aksiyonlar</h3>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {Object.entries(byType).map(([type, count]) => (
              <div key={type} className="unit-chip">
                <strong>{count}</strong>
                <span>{type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="form-select"
            style={{ width: 220 }}
            value={filter.type}
            onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value }))}
          >
            <option value="">Tüm Toplantı Türleri</option>
            {MEETING_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>

          {isDirektor && (
            <select
              className="form-select"
              style={{ width: 180 }}
              value={filter.owner}
              onChange={(e) => setFilter((f) => ({ ...f, owner: e.target.value }))}
            >
              <option value="">Tüm Sahipler</option>
              {OWNERS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={filter.showCompleted}
              onChange={(e) => setFilter((f) => ({ ...f, showCompleted: e.target.checked }))}
            />
            Tamamlananları göster
          </label>

          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
            {filtered.length} sonuç
          </span>
        </div>
      </div>

      {/* Data table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <EmptyState icon="✅" title="Aksiyon bulunamadı" sub="Filtreleri kontrol et veya yeni aksiyon ekle" />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Aksiyon</th>
                <th>Toplantı Türü</th>
                <th>Tarih</th>
                <th>Sahip</th>
                <th>Son Tarih</th>
                <th>Durum</th>
                <th>Kalan</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <tr key={a.id} className={i % 2 === 1 ? 'row-alt' : ''}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text)', maxWidth: 320 }}>
                      {a.action_item}
                    </div>
                    {a.notes && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                        {a.notes.slice(0, 60)}
                        {a.notes.length > 60 ? '…' : ''}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{a.meeting_type}</td>
                  <td style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{a.meeting_date}</td>
                  <td style={{ fontSize: 13, fontWeight: 500 }}>{a.owner}</td>
                  <td style={{ fontSize: 13 }}>{a.due_date || '—'}</td>
                  <td>
                    {isPersonel ? (
                      <span style={{ fontSize: 13 }}>{trS(a.status)}</span>
                    ) : (
                      <select
                        value={a.status}
                        onChange={(e) => quickStatus(a.id, e.target.value)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          fontSize: 13,
                          cursor: 'pointer',
                          color:
                            a.status === '✅ Completed'
                              ? 'var(--green)'
                              : a.status === '🔵 In Progress'
                              ? 'var(--blue)'
                              : 'var(--text-muted)'
                        }}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {trS(s)}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    {a.due_date ? (
                      <span className={daysClass(daysLeft(a.due_date))} style={{ fontSize: 13, fontWeight: 600 }}>
                        {daysLabel(daysLeft(a.due_date))}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                  {canEdit && (
                    <td>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => openEdit(a)}
                        title="Düzenle"
                        disabled={isKoordinator && a.owner !== profile?.name}
                      >
                        ✏️
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && form && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="modal">
            <h2 className="modal-title">{editId ? '✏️ Aksiyonu Düzenle' : '+ Yeni Aksiyon'}</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Toplantı Türü</label>
                <select
                  className="form-select"
                  value={form.meeting_type}
                  onChange={(e) => setForm((f) => ({ ...f, meeting_type: e.target.value }))}
                >
                  {MEETING_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Toplantı Tarihi</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.meeting_date}
                  onChange={(e) => setForm((f) => ({ ...f, meeting_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Aksiyon Maddesi *</label>
              <textarea
                className="form-textarea"
                placeholder="Ne yapılacak?"
                value={form.action_item}
                onChange={(e) => setForm((f) => ({ ...f, action_item: e.target.value }))}
                style={{ minHeight: 60 }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Sahip</label>
                <select
                  className="form-select"
                  value={form.owner}
                  onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
                  disabled={isKoordinator}
                >
                  {isDirektor ? (
                    <>
                      {OWNERS.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </>
                  ) : (
                    <option>{profile?.name}</option>
                  )}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Son Tarih</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.due_date || ''}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Durum</label>
              <select
                className="form-select"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {trS(s)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Notlar</label>
              <textarea
                className="form-textarea"
                placeholder="Ek bağlam..."
                value={form.notes || ''}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                style={{ minHeight: 50 }}
              />
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeModal}>
                İptal
              </button>
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
