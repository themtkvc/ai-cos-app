import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  EVENT_TYPES, EVENT_STATUS, LOCATION_TYPES, PARTICIPANT_ROLES,
} from './Events';

// ── Yardımcılar ───────────────────────────────────────────────────────────────
function Label({ children, required }) {
  return (
    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted, #6B7280)', letterSpacing: '0.04em', display: 'block', marginBottom: 5 }}>
      {children.toUpperCase()}{required && <span style={{ color: '#DC2626', marginLeft: 2 }}>*</span>}
    </label>
  );
}

function Field({ children, style }) {
  return <div style={{ marginBottom: 18, ...style }}>{children}</div>;
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 12px', borderRadius: 8,
  border: '1.5px solid var(--border, #E5E7EB)',
  background: 'var(--card-bg, #fff)', color: 'var(--text, #111)',
  fontSize: 14, fontFamily: 'inherit', outline: 'none',
};

const textareaStyle = { ...inputStyle, resize: 'vertical', minHeight: 80 };

function Badge({ label, color, bg }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color, background: bg }}>{label}</span>;
}

function SectionTitle({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text, #111)' }}>{children}</h3>
      {action}
    </div>
  );
}

function Panel({ children, style }) {
  return (
    <div style={{
      background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #E5E7EB)',
      borderRadius: 12, padding: '22px', marginBottom: 18, ...style,
    }}>
      {children}
    </div>
  );
}

// ── Katılımcı Kartı ───────────────────────────────────────────────────────────
function ParticipantRow({ p, onRemove, onToggleConfirm, onChangeRole }) {
  const roleCfg = { organizer: '#7C3AED', speaker: '#0369A1', attendee: '#059669', observer: '#6B7280' };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
      borderRadius: 8, background: 'var(--bg, #F9FAFB)', border: '1px solid var(--border)',
      marginBottom: 8,
    }}>
      {/* Avatar */}
      <div style={{
        width: 36, height: 36, borderRadius: '50%', background: 'var(--navy, #1A3C5E)',
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 14, flexShrink: 0,
      }}>
        {(p.full_name || p.external_name || '?')[0].toUpperCase()}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
          {p.full_name || p.external_name || 'İsimsiz'}
          {p.external_org && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>({p.external_org})</span>}
        </div>
        {p.unit && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.unit}</div>}
      </div>

      {/* Rol seçici */}
      <select
        value={p.role || 'attendee'}
        onChange={e => onChangeRole(p.id, e.target.value)}
        style={{
          padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
          background: 'var(--card-bg)', fontSize: 12, color: roleCfg[p.role] || '#6B7280',
          fontWeight: 600, cursor: 'pointer', outline: 'none',
        }}
      >
        {Object.entries(PARTICIPANT_ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>

      {/* Onay toggle */}
      <button
        onClick={() => onToggleConfirm(p.id, !p.confirmed)}
        title={p.confirmed ? 'Onaylandı — tıkla geri al' : 'Onaylanmadı — tıkla onayla'}
        style={{
          width: 28, height: 28, borderRadius: '50%', border: '2px solid',
          borderColor: p.confirmed ? '#059669' : '#D1D5DB',
          background: p.confirmed ? '#ECFDF5' : 'transparent',
          color: p.confirmed ? '#059669' : '#D1D5DB',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 14, flexShrink: 0,
        }}
      >
        ✓
      </button>

      <button onClick={() => onRemove(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 16, padding: 2 }}>✕</button>
    </div>
  );
}

// ── Aktivite Logu ─────────────────────────────────────────────────────────────
function ActivityLog({ eventId }) {
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    if (!eventId) return;
    supabase.from('event_activity_log')
      .select('*, user_profiles(full_name)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => setLogs(data || []));
  }, [eventId]);

  if (!logs.length) return <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Henüz aktivite yok.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {logs.map(l => (
        <div key={l.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--navy)', marginTop: 5, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>
              <span style={{ fontWeight: 600 }}>{l.user_profiles?.full_name || 'Sistem'}</span>
              {' '}{l.action}
              {l.detail && <span style={{ color: 'var(--text-muted)' }}> — {l.detail}</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {new Date(l.created_at).toLocaleString('tr-TR')}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Ana Bileşen ───────────────────────────────────────────────────────────────
const DOC_TYPES = { document: 'Belge', report: 'Rapor', invitation: 'Davetiye', brief: 'Brief', presentation: 'Sunum' };

export default function EventDetail({ event, user, profile, onClose, onSaved }) {
  const isNew = !event;
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('info'); // info | participants | documents | log

  // Form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    event_type: 'conference',
    status: 'planned',
    location_name: '',
    location_type: 'on_site',
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    unit: '',
    budget: '',
    budget_currency: 'TRY',
    objectives: '',
    outcomes: '',
    notes: '',
  });

  // Participants
  const [participants, setParticipants] = useState([]);
  const [allPersonnel, setAllPersonnel] = useState([]);
  const [addMode, setAddMode] = useState('internal'); // internal | external
  const [selectedUserId, setSelectedUserId] = useState('');
  const [extName, setExtName] = useState('');
  const [extOrg, setExtOrg] = useState('');
  const [addingP, setAddingP] = useState(false);

  // Documents
  const [docs, setDocs] = useState([]);
  const [docTitle, setDocTitle] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [docType, setDocType] = useState('document');
  const [addingDoc, setAddingDoc] = useState(false);

  const [logRefresh, setLogRefresh] = useState(0);

  // Tüm personeli yükle
  useEffect(() => {
    supabase.from('user_profiles').select('user_id, full_name, unit').order('full_name')
      .then(({ data }) => setAllPersonnel(data || []));
  }, []);

  // Event yükleme
  useEffect(() => {
    if (!event) return;
    setForm({
      title: event.title || '',
      description: event.description || '',
      event_type: event.event_type || 'conference',
      status: event.status || 'planned',
      location_name: event.location_name || '',
      location_type: event.location_type || 'on_site',
      start_date: event.start_date || '',
      end_date: event.end_date || '',
      start_time: event.start_time || '',
      end_time: event.end_time || '',
      unit: event.unit || '',
      budget: event.budget || '',
      budget_currency: event.budget_currency || 'TRY',
      objectives: event.objectives || '',
      outcomes: event.outcomes || '',
      notes: event.notes || '',
    });
    loadParticipants(event.id);
    loadDocuments(event.id);
  }, [event]);

  const loadParticipants = async (eventId) => {
    if (!eventId) return;
    const { data } = await supabase
      .from('event_participants')
      .select('*, user_profiles(full_name, unit)')
      .eq('event_id', eventId)
      .order('created_at');
    setParticipants((data || []).map(p => ({
      ...p,
      full_name: p.user_profiles?.full_name || null,
      unit: p.user_profiles?.unit || null,
    })));
  };

  const loadDocuments = async (eventId) => {
    if (!eventId) return;
    const { data } = await supabase
      .from('event_documents')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at');
    setDocs(data || []);
  };

  const logActivity = async (eventId, action, detail) => {
    await supabase.from('event_activity_log').insert({
      event_id: eventId, user_id: user.id, action, detail,
    });
    setLogRefresh(r => r + 1);
  };

  // Kaydet
  const handleSave = async () => {
    if (!form.title.trim() || !form.start_date) return;
    setSaving(true);
    const payload = {
      ...form,
      budget: form.budget ? parseFloat(form.budget) : null,
      owner_id: event?.owner_id || user.id,
      created_by: event?.created_by || user.id,
    };

    let eventId = event?.id;
    if (isNew) {
      const { data } = await supabase.from('events').insert(payload).select().single();
      eventId = data?.id;
      if (eventId) await logActivity(eventId, 'etkinliği oluşturdu');
    } else {
      await supabase.from('events').update(payload).eq('id', event.id);
      await logActivity(event.id, 'etkinliği güncelledi');
    }
    setSaving(false);
    onSaved?.();
    if (isNew) onClose();
  };

  // Katılımcı ekle (iç)
  const handleAddInternalParticipant = async () => {
    if (!selectedUserId || !event?.id) return;
    setAddingP(true);
    const already = participants.find(p => p.user_id === selectedUserId);
    if (!already) {
      await supabase.from('event_participants').insert({ event_id: event.id, user_id: selectedUserId, role: 'attendee' });
      const person = allPersonnel.find(p => p.user_id === selectedUserId);
      await logActivity(event.id, `katılımcı ekledi`, person?.full_name);
      await loadParticipants(event.id);
    }
    setSelectedUserId('');
    setAddingP(false);
  };

  // Katılımcı ekle (dış)
  const handleAddExternalParticipant = async () => {
    if (!extName.trim() || !event?.id) return;
    setAddingP(true);
    await supabase.from('event_participants').insert({
      event_id: event.id, external_name: extName, external_org: extOrg, role: 'attendee',
    });
    await logActivity(event.id, `dış katılımcı ekledi`, `${extName}${extOrg ? ` (${extOrg})` : ''}`);
    await loadParticipants(event.id);
    setExtName(''); setExtOrg('');
    setAddingP(false);
  };

  // Katılımcı kaldır
  const handleRemoveParticipant = async (pid) => {
    if (!event?.id) return;
    const p = participants.find(x => x.id === pid);
    await supabase.from('event_participants').delete().eq('id', pid);
    await logActivity(event.id, `katılımcıyı çıkardı`, p?.full_name || p?.external_name);
    await loadParticipants(event.id);
  };

  // Onay toggle
  const handleToggleConfirm = async (pid, confirmed) => {
    if (!event?.id) return;
    await supabase.from('event_participants').update({ confirmed }).eq('id', pid);
    await loadParticipants(event.id);
  };

  // Rol değiştir
  const handleChangeRole = async (pid, role) => {
    if (!event?.id) return;
    await supabase.from('event_participants').update({ role }).eq('id', pid);
    await loadParticipants(event.id);
  };

  // Doküman ekle
  const handleAddDoc = async () => {
    if (!docTitle.trim() || !event?.id) return;
    setAddingDoc(true);
    await supabase.from('event_documents').insert({
      event_id: event.id, title: docTitle, url: docUrl || null,
      doc_type: docType, uploaded_by: user.id,
    });
    await logActivity(event.id, `döküman ekledi`, docTitle);
    await loadDocuments(event.id);
    setDocTitle(''); setDocUrl(''); setDocType('document');
    setAddingDoc(false);
  };

  // Doküman sil
  const handleRemoveDoc = async (docId, docTitle) => {
    if (!event?.id) return;
    await supabase.from('event_documents').delete().eq('id', docId);
    await logActivity(event.id, `dökümanı sildi`, docTitle);
    await loadDocuments(event.id);
  };

  const DOC_TYPES = { document: 'Belge', report: 'Rapor', invitation: 'Davetiye', brief: 'Brief', presentation: 'Sunum' };
  const statusCfg = EVENT_STATUS[form.status] || {};
  const typeCfg = EVENT_TYPES[form.event_type] || {};

  // Sistemde olmayan katılımcılar için dropdown
  const availablePersonnel = allPersonnel.filter(p => !participants.find(x => x.user_id === p.user_id));

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Üst bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={onClose}
          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', color: 'var(--text)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← Geri
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>
            {isNew ? 'Yeni Etkinlik' : form.title || 'Etkinlik Detayı'}
          </h1>
          {!isNew && (
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <Badge label={typeCfg.label} color={typeCfg.color} bg={typeCfg.bg} />
              <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />
            </div>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !form.title.trim() || !form.start_date}
          style={{
            padding: '10px 22px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'var(--navy, #1A3C5E)', color: '#fff', fontWeight: 700, fontSize: 14,
            opacity: saving || !form.title.trim() || !form.start_date ? 0.5 : 1,
          }}
        >
          {saving ? 'Kaydediliyor…' : isNew ? 'Oluştur' : 'Kaydet'}
        </button>
      </div>

      {/* Tabs (yeni etkinlikte sadece info) */}
      {!isNew && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
          {[
            ['info', '📋 Bilgiler'],
            ['participants', `👥 Katılımcılar (${participants.length})`],
            ['documents', `📄 Dokümanlar (${docs.length})`],
            ['log', '🕒 Aktivite Logu'],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{
              padding: '10px 18px', border: 'none', cursor: 'pointer',
              background: 'none', fontWeight: activeTab === id ? 700 : 400,
              color: activeTab === id ? 'var(--navy, #1A3C5E)' : 'var(--text-muted)',
              borderBottom: activeTab === id ? '2px solid var(--navy, #1A3C5E)' : '2px solid transparent',
              marginBottom: -2, fontSize: 14,
            }}>{label}</button>
          ))}
        </div>
      )}

      {/* ── TAB: BİLGİLER ─────────────────────────────────────────────────── */}
      {(isNew || activeTab === 'info') && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18 }}>
          {/* Sol kolon */}
          <div>
            <Panel>
              <SectionTitle>Temel Bilgiler</SectionTitle>
              <Field>
                <Label required>Etkinlik Adı</Label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Etkinlik adını girin" style={inputStyle} />
              </Field>
              <Field>
                <Label>Açıklama</Label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Etkinliği kısaca tanımlayın…" style={textareaStyle} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field>
                  <Label>Etkinlik Tipi</Label>
                  <select value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))} style={inputStyle}>
                    {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </Field>
                <Field>
                  <Label>Durum</Label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                    {Object.entries(EVENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </Field>
              </div>
            </Panel>

            <Panel>
              <SectionTitle>Tarih & Saat</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field>
                  <Label required>Başlangıç Tarihi</Label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={inputStyle} />
                </Field>
                <Field>
                  <Label>Bitiş Tarihi</Label>
                  <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} style={inputStyle} />
                </Field>
                <Field>
                  <Label>Başlangıç Saati</Label>
                  <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} style={inputStyle} />
                </Field>
                <Field>
                  <Label>Bitiş Saati</Label>
                  <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} style={inputStyle} />
                </Field>
              </div>
            </Panel>

            <Panel>
              <SectionTitle>Hedefler & Sonuçlar</SectionTitle>
              <Field>
                <Label>Hedefler</Label>
                <textarea value={form.objectives} onChange={e => setForm(f => ({ ...f, objectives: e.target.value }))}
                  placeholder="Bu etkinlikle neye ulaşmak istiyoruz?" style={textareaStyle} />
              </Field>
              <Field>
                <Label>Çıktılar / Sonuçlar</Label>
                <textarea value={form.outcomes} onChange={e => setForm(f => ({ ...f, outcomes: e.target.value }))}
                  placeholder="Etkinlikten elde edilen somut çıktılar…" style={{ ...textareaStyle, marginBottom: 0 }} />
              </Field>
            </Panel>
          </div>

          {/* Sağ kolon */}
          <div>
            <Panel>
              <SectionTitle>Lokasyon</SectionTitle>
              <Field>
                <Label>Lokasyon Adı</Label>
                <input value={form.location_name} onChange={e => setForm(f => ({ ...f, location_name: e.target.value }))}
                  placeholder="Şehir, mekan veya platform" style={inputStyle} />
              </Field>
              <Field>
                <Label>Lokasyon Tipi</Label>
                <select value={form.location_type} onChange={e => setForm(f => ({ ...f, location_type: e.target.value }))} style={inputStyle}>
                  {Object.entries(LOCATION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            </Panel>

            <Panel>
              <SectionTitle>Organizasyon</SectionTitle>
              <Field>
                <Label>Sorumlu Birim</Label>
                <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  placeholder="Birim adı" style={inputStyle} />
              </Field>
            </Panel>

            <Panel>
              <SectionTitle>Bütçe</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <Field>
                  <Label>Tutar</Label>
                  <input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                    placeholder="0" style={inputStyle} />
                </Field>
                <Field>
                  <Label>Para Birimi</Label>
                  <select value={form.budget_currency} onChange={e => setForm(f => ({ ...f, budget_currency: e.target.value }))} style={inputStyle}>
                    {['TRY','USD','EUR','GBP','CHF'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
            </Panel>

            <Panel>
              <SectionTitle>Notlar</SectionTitle>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="İç notlar, hatırlatmalar…" style={{ ...textareaStyle, marginBottom: 0 }} />
            </Panel>
          </div>
        </div>
      )}

      {/* ── TAB: KATILIMCILAR ──────────────────────────────────────────────── */}
      {!isNew && activeTab === 'participants' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18 }}>
          <div>
            <Panel>
              <SectionTitle>
                Katılımcılar
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {participants.filter(p => p.confirmed).length} / {participants.length} onaylı
                </span>
              </SectionTitle>

              {participants.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 13 }}>
                  Henüz katılımcı eklenmedi.
                </div>
              ) : (
                participants.map(p => (
                  <ParticipantRow
                    key={p.id} p={p}
                    onRemove={handleRemoveParticipant}
                    onToggleConfirm={handleToggleConfirm}
                    onChangeRole={handleChangeRole}
                  />
                ))
              )}
            </Panel>
          </div>

          {/* Katılımcı ekleme paneli */}
          <div>
            <Panel>
              <SectionTitle>Katılımcı Ekle</SectionTitle>

              {/* İç / Dış toggle */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg)', borderRadius: 8, padding: 3 }}>
                {[['internal','Personel'],['external','Dış Katılımcı']].map(([k, v]) => (
                  <button key={k} onClick={() => setAddMode(k)} style={{
                    flex: 1, padding: '7px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: addMode === k ? 'var(--navy, #1A3C5E)' : 'transparent',
                    color: addMode === k ? '#fff' : 'var(--text-muted)',
                    fontWeight: addMode === k ? 700 : 400, fontSize: 13,
                  }}>{v}</button>
                ))}
              </div>

              {addMode === 'internal' ? (
                <>
                  <Field>
                    <Label>Personel Seç</Label>
                    <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} style={inputStyle}>
                      <option value="">— Personel seçin —</option>
                      {availablePersonnel.map(p => (
                        <option key={p.user_id} value={p.user_id}>{p.full_name}{p.unit ? ` (${p.unit})` : ''}</option>
                      ))}
                    </select>
                  </Field>
                  <button
                    onClick={handleAddInternalParticipant}
                    disabled={!selectedUserId || addingP}
                    style={{
                      width: '100%', padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: 'var(--navy, #1A3C5E)', color: '#fff', fontWeight: 700, fontSize: 14,
                      opacity: !selectedUserId || addingP ? 0.5 : 1,
                    }}
                  >
                    {addingP ? 'Ekleniyor…' : '+ Ekle'}
                  </button>
                </>
              ) : (
                <>
                  <Field>
                    <Label required>Ad Soyad</Label>
                    <input value={extName} onChange={e => setExtName(e.target.value)} placeholder="Ad Soyad" style={inputStyle} />
                  </Field>
                  <Field>
                    <Label>Kurum</Label>
                    <input value={extOrg} onChange={e => setExtOrg(e.target.value)} placeholder="Kurum / organizasyon" style={inputStyle} />
                  </Field>
                  <button
                    onClick={handleAddExternalParticipant}
                    disabled={!extName.trim() || addingP}
                    style={{
                      width: '100%', padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: 'var(--navy, #1A3C5E)', color: '#fff', fontWeight: 700, fontSize: 14,
                      opacity: !extName.trim() || addingP ? 0.5 : 1,
                    }}
                  >
                    {addingP ? 'Ekleniyor…' : '+ Dış Katılımcı Ekle'}
                  </button>
                </>
              )}
            </Panel>

            {/* Özet */}
            <Panel>
              <SectionTitle>Özet</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(PARTICIPANT_ROLES).map(([role, label]) => {
                  const count = participants.filter(p => p.role === role).length;
                  return count > 0 ? (
                    <div key={role} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text)' }}>
                      <span>{label}</span>
                      <span style={{ fontWeight: 700 }}>{count}</span>
                    </div>
                  ) : null;
                })}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  <span>Toplam</span>
                  <span>{participants.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#059669' }}>
                  <span>Onaylanan</span>
                  <span style={{ fontWeight: 700 }}>{participants.filter(p => p.confirmed).length}</span>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* ── TAB: DOKÜMANLAR ────────────────────────────────────────────────── */}
      {!isNew && activeTab === 'documents' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18 }}>
          <Panel>
            <SectionTitle>Dokümanlar & Linkler</SectionTitle>
            {docs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 13 }}>Henüz döküman eklenmedi.</div>
            ) : (
              docs.map(d => (
                <div key={d.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', marginBottom: 8,
                }}>
                  <span style={{ fontSize: 20 }}>
                    {{ document: '📄', report: '📊', invitation: '✉️', brief: '📋', presentation: '📑' }[d.doc_type] || '📄'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{d.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{DOC_TYPES[d.doc_type] || d.doc_type}</div>
                  </div>
                  {d.url && (
                    <a href={d.url} target="_blank" rel="noreferrer" style={{ color: 'var(--navy)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Aç ↗</a>
                  )}
                  <button onClick={() => handleRemoveDoc(d.id, d.title)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 16 }}>✕</button>
                </div>
              ))
            )}
          </Panel>

          <Panel>
            <SectionTitle>Döküman Ekle</SectionTitle>
            <Field>
              <Label required>Başlık</Label>
              <input value={docTitle} onChange={e => setDocTitle(e.target.value)} placeholder="Döküman adı" style={inputStyle} />
            </Field>
            <Field>
              <Label>Link (URL)</Label>
              <input value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="https://…" style={inputStyle} />
            </Field>
            <Field>
              <Label>Tip</Label>
              <select value={docType} onChange={e => setDocType(e.target.value)} style={inputStyle}>
                {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <button
              onClick={handleAddDoc}
              disabled={!docTitle.trim() || addingDoc}
              style={{
                width: '100%', padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'var(--navy, #1A3C5E)', color: '#fff', fontWeight: 700, fontSize: 14,
                opacity: !docTitle.trim() || addingDoc ? 0.5 : 1,
              }}
            >
              {addingDoc ? 'Ekleniyor…' : '+ Ekle'}
            </button>
          </Panel>
        </div>
      )}

      {/* ── TAB: AKTİVİTE LOGU ────────────────────────────────────────────── */}
      {!isNew && activeTab === 'log' && (
        <Panel>
          <SectionTitle>Aktivite Logu</SectionTitle>
          <ActivityLog key={logRefresh} eventId={event?.id} />
        </Panel>
      )}
    </div>
  );
}
