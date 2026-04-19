import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  supabase,
  getMeetings,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  addMeetingAttendee,
  removeMeetingAttendee,
  updateMeetingAttendeeRsvp,
  getCollaborations,
  MEETING_STATUSES,
  MEETING_DURATION_PRESETS,
} from '../lib/supabase';
import { UNITS as UNIT_LIST } from '../lib/constants';
import EmptyState from '../components/EmptyState';

// ── Yardımcılar ───────────────────────────────────────────────────────────
const fmtDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('tr-TR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};
const fmtTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
};
const fmtDateShort = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', weekday: 'short' });
};
const relTime = (iso) => {
  if (!iso) return '';
  const diffMs = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const min = Math.round(abs / 60000);
  const hrs = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  const prefix = diffMs >= 0 ? '' : '-';
  if (min < 60)  return `${prefix}${min} dk`;
  if (hrs < 24)  return `${prefix}${hrs} sa`;
  return `${prefix}${days} g`;
};

// datetime-local input için ISO → "YYYY-MM-DDTHH:MM"
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
// local input → ISO
const fromLocalInput = (local) => {
  if (!local) return null;
  const d = new Date(local);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

const statusMeta = (id) => MEETING_STATUSES.find(s => s.id === id) || MEETING_STATUSES[0];

const RSVP_LABELS = {
  pending:  { label: 'Bekliyor', color: '#94a3b8', icon: '⏳' },
  accepted: { label: 'Katılacak', color: '#16a34a', icon: '✅' },
  tentative:{ label: 'Belki',     color: '#f59e0b', icon: '❓' },
  declined: { label: 'Katılmayacak', color: '#ef4444', icon: '❌' },
};

// ── Ana Sayfa ─────────────────────────────────────────────────────────────
export default function Meetings({ user, profile, onNavigate }) {
  const [tab, setTab] = useState('upcoming'); // upcoming | past | all
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unitFilter, setUnitFilter] = useState('');
  const [search, setSearch] = useState('');
  const [people, setPeople] = useState([]);
  const [collabs, setCollabs] = useState([]);
  const [modal, setModal] = useState(null); // { mode: 'create'|'edit', meeting? }
  const [detail, setDetail] = useState(null);

  const canManage = useMemo(() => {
    if (!profile) return false;
    return ['direktor','direktor_yardimcisi','koordinator','asistan','personel'].includes(profile.role);
  }, [profile]);

  const load = async () => {
    setLoading(true);
    const opts = { limit: 200 };
    if (tab === 'upcoming') opts.upcoming = true;
    if (tab === 'past') opts.past = true;
    if (unitFilter) opts.unit = unitFilter;
    const { data } = await getMeetings(opts);
    setMeetings(data);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab, unitFilter]);

  // İlk açılışta lookup'ları yükle
  useEffect(() => {
    (async () => {
      const { data: ppl } = await supabase
        .from('user_profiles')
        .select('user_id, full_name, email, unit, role, avatar_url')
        .not('email','is',null)
        .order('full_name');
      setPeople(ppl || []);
      const { data: cs } = await getCollaborations({ limit: 500 });
      setCollabs(cs || []);
    })();
  }, []);

  // Realtime — yeni kayıt / güncelleme
  useEffect(() => {
    const ch = supabase
      .channel('meetings-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [tab, unitFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return meetings;
    return meetings.filter(m =>
      (m.title || '').toLowerCase().includes(q) ||
      (m.description || '').toLowerCase().includes(q) ||
      (m.location || '').toLowerCase().includes(q) ||
      (m.organizer_name || '').toLowerCase().includes(q) ||
      (m.collab?.title || '').toLowerCase().includes(q)
    );
  }, [meetings, search]);

  // Yaklaşan: gün bazında gruplama
  const grouped = useMemo(() => {
    const map = new Map();
    for (const m of filtered) {
      const key = (m.starts_at || '').slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(m);
    }
    return Array.from(map.entries()).sort((a,b) => tab === 'past' ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0]));
  }, [filtered, tab]);

  const handleSaved = async () => {
    setModal(null);
    await load();
  };

  const openDetail = async (id) => {
    const row = meetings.find(m => m.id === id);
    if (row) setDetail(row);
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.h1}>📅 Toplantılar</h1>
          <div style={styles.sub}>
            Google Calendar + Meet entegreli. Toplantıyı yarat, Meet linki otomatik gelsin, katılımcılara davet gitsin.
          </div>
        </div>
        {canManage && (
          <button style={styles.primaryBtn} onClick={() => setModal({ mode: 'create' })}>
            + Yeni Toplantı
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {[
          { id: 'upcoming', label: 'Yaklaşan' },
          { id: 'past',     label: 'Geçmiş' },
          { id: 'all',      label: 'Tümü' },
        ].map(t => (
          <button
            key={t.id}
            style={{ ...styles.tab, ...(tab === t.id ? styles.tabActive : {}) }}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <input
          placeholder="🔎 Ara: başlık, konum, organizatör…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={styles.searchInput}
        />
        <select value={unitFilter} onChange={e => setUnitFilter(e.target.value)} style={styles.select}>
          <option value="">Tüm birimler</option>
          {UNIT_LIST.map(u => <option key={u.name || u.key} value={u.name}>{u.name}</option>)}
        </select>
      </div>

      {/* Liste */}
      {loading ? (
        <div style={styles.loading}>Toplantılar yükleniyor…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="📅"
          title={tab === 'upcoming' ? 'Yaklaşan toplantı yok' : tab === 'past' ? 'Geçmişte toplantı kaydı yok' : 'Henüz toplantı kaydı yok'}
          description="Yeni bir toplantı oluşturduğunda Google Meet linki otomatik üretilir ve katılımcılara e-posta daveti gider."
          action={canManage ? { label: '+ Yeni Toplantı', onClick: () => setModal({ mode: 'create' }) } : null}
        />
      ) : (
        <div style={styles.groupList}>
          {grouped.map(([dateKey, rows]) => (
            <div key={dateKey}>
              <div style={styles.dateHeader}>{fmtDateShort(dateKey + 'T12:00:00')}</div>
              <div style={styles.cards}>
                {rows.map(m => (
                  <MeetingCard
                    key={m.id}
                    meeting={m}
                    profile={profile}
                    onOpen={() => openDetail(m.id)}
                    onEdit={() => setModal({ mode: 'edit', meeting: m })}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <MeetingModal
          mode={modal.mode}
          meeting={modal.meeting}
          user={user}
          profile={profile}
          people={people}
          collabs={collabs}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Detay paneli */}
      {detail && (
        <MeetingDetail
          meeting={detail}
          profile={profile}
          people={people}
          onClose={() => setDetail(null)}
          onEdit={() => { setModal({ mode: 'edit', meeting: detail }); setDetail(null); }}
          onDeleted={() => { setDetail(null); load(); }}
          onChanged={load}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────
function MeetingCard({ meeting, profile, onOpen, onEdit }) {
  const status = statusMeta(meeting.status || 'planlandi');
  const attCount = meeting.attendees?.length || 0;
  const startsAt = meeting.starts_at;
  const isSoon = (() => {
    if (!startsAt) return false;
    const diffMin = (new Date(startsAt).getTime() - Date.now()) / 60000;
    return diffMin > 0 && diffMin < 60;
  })();
  const inProgress = (() => {
    if (!startsAt) return false;
    const start = new Date(startsAt).getTime();
    const end = start + (meeting.duration_minutes || 30) * 60000;
    const now = Date.now();
    return now >= start && now < end;
  })();

  const canEdit = ['direktor','asistan'].includes(profile?.role)
    || meeting.created_by === profile?.user_id
    || meeting.organizer_id === profile?.user_id;

  return (
    <div style={styles.card} onClick={onOpen}>
      <div style={styles.cardRow1}>
        <span style={{ ...styles.statusPill, background: status.color + '22', color: status.color, borderColor: status.color + '55' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.color, display: 'inline-block' }} />
          {status.label}
        </span>
        {inProgress && <span style={styles.livePill}>🔴 DEVAM EDİYOR</span>}
        {!inProgress && isSoon && <span style={styles.soonPill}>⏰ Birazdan</span>}
        <div style={{ flex: 1 }} />
        <span style={styles.timeRange}>
          {fmtTime(startsAt)} – {fmtTime(new Date(new Date(startsAt).getTime() + (meeting.duration_minutes || 30)*60000).toISOString())}
          <span style={styles.durBadge}>{meeting.duration_minutes || 30} dk</span>
        </span>
      </div>
      <div style={styles.cardTitle}>{meeting.title || 'Başlıksız toplantı'}</div>
      {meeting.description && (
        <div style={styles.cardDesc}>{meeting.description.length > 140 ? meeting.description.slice(0, 140) + '…' : meeting.description}</div>
      )}
      <div style={styles.cardFooter}>
        <span style={styles.chip}>👤 {meeting.organizer_name || '—'}</span>
        {meeting.unit && <span style={styles.chip}>🏢 {meeting.unit}</span>}
        <span style={styles.chip}>👥 {attCount} kişi</span>
        {meeting.location && <span style={styles.chip}>📍 {meeting.location}</span>}
        {meeting.collab?.title && <span style={styles.chip}>🤝 {meeting.collab.title}</span>}
        <div style={{ flex: 1 }} />
        {meeting.meet_url ? (
          <a
            href={meeting.meet_url}
            target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            style={styles.meetBtn}
          >
            🎥 Meet'e Katıl
          </a>
        ) : (
          <span style={{ ...styles.chip, color: '#dc2626' }}>⚠️ Meet linki yok</span>
        )}
        {canEdit && (
          <button
            style={styles.editIconBtn}
            onClick={e => { e.stopPropagation(); onEdit(); }}
            title="Düzenle"
          >✏️</button>
        )}
      </div>
    </div>
  );
}

// ── Create / Edit Modal ──────────────────────────────────────────────────
export function MeetingModal({ mode, meeting, user, profile, people, collabs, onClose, onSaved, defaults = {} }) {
  const isEdit = mode === 'edit' && meeting;
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const nowPlus1h = new Date(Date.now() + 60*60000);
  nowPlus1h.setMinutes(0, 0, 0);

  const [form, setForm] = useState(() => isEdit ? ({
    title: meeting.title || '',
    description: meeting.description || '',
    starts_at: toLocalInput(meeting.starts_at),
    duration_minutes: meeting.duration_minutes || 30,
    timezone: meeting.timezone || 'Europe/Istanbul',
    location: meeting.location || '',
    unit: meeting.unit || profile?.unit || '',
    related_collaboration_id: meeting.related_collaboration_id || '',
    visibility: meeting.visibility || 'team',
    notes: meeting.notes || '',
    status: meeting.status || 'planlandi',
  }) : ({
    title: defaults.title || '',
    description: defaults.description || '',
    starts_at: toLocalInput(nowPlus1h.toISOString()),
    duration_minutes: 30,
    timezone: 'Europe/Istanbul',
    location: defaults.location || '',
    unit: defaults.unit || profile?.unit || '',
    related_collaboration_id: defaults.related_collaboration_id || '',
    visibility: 'team',
    notes: '',
    status: 'planlandi',
  }));

  // attendees: { user_id?, name, email, is_optional }
  const initialAttendees = (() => {
    if (isEdit) {
      return (meeting.attendees || []).map(a => ({
        id: a.id, user_id: a.user_id, name: a.name || '', email: a.email || '',
        is_optional: !!a.is_optional, rsvp_status: a.rsvp_status || 'pending',
        is_organizer: !!a.is_organizer,
      }));
    }
    // Kendini default organizatör olarak ekle
    return [{
      user_id: profile?.user_id,
      name: profile?.full_name || user?.email || '',
      email: user?.email || '',
      is_optional: false,
      is_organizer: true,
      rsvp_status: 'accepted',
    }];
  })();
  const [attendees, setAttendees] = useState(initialAttendees);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addAttendeeFromProfile = (p) => {
    if (!p?.email) return;
    if (attendees.some(a => (a.email || '').toLowerCase() === p.email.toLowerCase())) return;
    setAttendees(a => [...a, {
      user_id: p.user_id, name: p.full_name || p.email, email: p.email,
      is_optional: false, rsvp_status: 'pending',
    }]);
  };
  const addExternalEmail = (email) => {
    const e = (email || '').trim();
    if (!e || !e.includes('@')) return;
    if (attendees.some(a => (a.email || '').toLowerCase() === e.toLowerCase())) return;
    setAttendees(a => [...a, { email: e, name: e, is_optional: false, rsvp_status: 'pending' }]);
  };
  const removeAttendee = (email) => {
    setAttendees(a => a.filter(x => (x.email || '').toLowerCase() !== (email || '').toLowerCase()));
  };

  const handleSubmit = async () => {
    setErr('');
    if (!form.title.trim())   return setErr('Başlık zorunlu.');
    if (!form.starts_at)      return setErr('Başlangıç zamanı zorunlu.');
    if (!attendees.some(a => a.email)) return setErr('En az bir katılımcı e-postası gerekli (Meet daveti için).');

    const starts_at_iso = fromLocalInput(form.starts_at);
    if (!starts_at_iso) return setErr('Geçerli bir zaman girin.');

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      starts_at: starts_at_iso,
      duration_minutes: Number(form.duration_minutes) || 30,
      timezone: form.timezone || 'Europe/Istanbul',
      location: form.location.trim() || null,
      unit: form.unit || null,
      related_collaboration_id: form.related_collaboration_id || null,
      visibility: form.visibility,
      notes: form.notes.trim() || null,
      status: form.status,
      organizer_id: profile?.user_id || null,
      organizer_name: profile?.full_name || user?.email || null,
      created_by_name: profile?.full_name || user?.email || null,
    };

    if (isEdit) {
      // Update — sadece form alanları
      const { error } = await updateMeeting(meeting.id, payload);
      if (error) { setErr(error.message || 'Güncelleme başarısız.'); setSaving(false); return; }

      // Attendees diff: eski setten yoksa ekle, yeni sette yoksa sil
      const oldEmails = new Set((meeting.attendees || []).map(a => (a.email || '').toLowerCase()));
      const newEmails = new Set(attendees.map(a => (a.email || '').toLowerCase()));
      const toAdd = attendees.filter(a => a.email && !oldEmails.has(a.email.toLowerCase()));
      const toRemove = (meeting.attendees || []).filter(a => a.email && !newEmails.has(a.email.toLowerCase()));
      for (const a of toAdd) await addMeetingAttendee(meeting.id, a);
      for (const a of toRemove) await removeMeetingAttendee(a.id);

      setSaving(false);
      onSaved();
      return;
    }

    // Create
    const { data, error, meet_url } = await createMeeting(payload, attendees);
    setSaving(false);
    if (error && !meet_url) {
      setErr(error.message || 'Toplantı oluşturulamadı.');
      return;
    }
    onSaved();
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {isEdit ? '✏️ Toplantıyı Düzenle' : '📅 Yeni Toplantı'}
          </h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <div style={styles.modalBody}>
          {/* Başlık + açıklama */}
          <Field label="Başlık *">
            <input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Örn: Politika birimi haftalık koordinasyon"
              style={styles.input}
              autoFocus
            />
          </Field>
          <Field label="Açıklama / gündem">
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Gündem maddeleri, hazırlık notu, vs. (opsiyonel)"
              rows={3}
              style={{ ...styles.input, resize: 'vertical', minHeight: 64 }}
            />
          </Field>

          {/* Zaman + süre */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Başlangıç *">
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={e => set('starts_at', e.target.value)}
                style={styles.input}
              />
            </Field>
            <Field label="Süre (dakika)">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {MEETING_DURATION_PRESETS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => set('duration_minutes', d)}
                    style={{
                      ...styles.durPreset,
                      ...(Number(form.duration_minutes) === d ? styles.durPresetActive : {}),
                    }}
                  >
                    {d}
                  </button>
                ))}
                <input
                  type="number"
                  min="5" max="600"
                  value={form.duration_minutes}
                  onChange={e => set('duration_minutes', e.target.value)}
                  style={{ ...styles.input, width: 70 }}
                />
              </div>
            </Field>
          </div>

          {/* Konum + birim + ilgili işbirliği */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Konum / Salon">
              <input
                value={form.location}
                onChange={e => set('location', e.target.value)}
                placeholder="Online, ofis, vs."
                style={styles.input}
              />
            </Field>
            <Field label="Birim">
              <select value={form.unit} onChange={e => set('unit', e.target.value)} style={styles.input}>
                <option value="">— Seçiniz —</option>
                {UNIT_LIST.map(u => <option key={u.name || u.key} value={u.name}>{u.name}</option>)}
              </select>
            </Field>
          </div>

          <Field label="İlgili işbirliği (opsiyonel)">
            <select
              value={form.related_collaboration_id}
              onChange={e => set('related_collaboration_id', e.target.value)}
              style={styles.input}
            >
              <option value="">— Yok —</option>
              {collabs.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </Field>

          {isEdit && (
            <Field label="Durum">
              <select value={form.status} onChange={e => set('status', e.target.value)} style={styles.input}>
                {MEETING_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </Field>
          )}

          {/* Katılımcılar */}
          <Field label={`Katılımcılar (${attendees.length})`}>
            <AttendeePicker
              people={people}
              attendees={attendees}
              onAdd={addAttendeeFromProfile}
              onAddExternal={addExternalEmail}
              onRemove={removeAttendee}
            />
          </Field>

          {err && (
            <div style={styles.errBox}>⚠️ {err}</div>
          )}

          <div style={styles.infoBox}>
            ℹ️ Kaydederken sistem otomatik olarak: Google Calendar event'i açar → Meet linki üretir → katılımcılara e-posta daveti gönderir.
          </div>
        </div>

        <div style={styles.modalFooter}>
          <button onClick={onClose} style={styles.secondaryBtn} disabled={saving}>İptal</button>
          <button onClick={handleSubmit} style={styles.primaryBtn} disabled={saving}>
            {saving ? (isEdit ? 'Kaydediliyor…' : 'Oluşturuluyor…') : (isEdit ? 'Kaydet' : '📅 Toplantıyı Oluştur + Meet Linki')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Attendee Picker ──────────────────────────────────────────────────────
function AttendeePicker({ people, attendees, onAdd, onAddExternal, onRemove }) {
  const [query, setQuery] = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!wrapRef.current?.contains(e.target)) setShowDrop(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return people.slice(0, 8);
    return people.filter(p =>
      (p.full_name || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q) ||
      (p.unit || '').toLowerCase().includes(q)
    ).slice(0, 10);
  }, [q, people]);

  const handleEnter = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (query.includes('@')) {
      onAddExternal(query);
      setQuery('');
    } else if (filtered[0]) {
      onAdd(filtered[0]);
      setQuery('');
    }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {/* Seçilmiş katılımcılar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {attendees.map(a => (
          <span key={(a.email || '') + (a.user_id || '')} style={styles.attChip}>
            {a.is_organizer && <span style={{ color: '#0ea5e9' }}>👑</span>}
            <span style={{ fontWeight: 600 }}>{a.name || a.email}</span>
            {a.email && a.email !== a.name && <span style={{ color: '#64748b', fontSize: 11 }}>{a.email}</span>}
            {!a.is_organizer && (
              <button type="button" onClick={() => onRemove(a.email)} style={styles.chipX}>×</button>
            )}
          </span>
        ))}
      </div>

      {/* Arama girişi */}
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setShowDrop(true); }}
        onFocus={() => setShowDrop(true)}
        onKeyDown={handleEnter}
        placeholder="Kişi ara veya dış e-posta yaz (Enter ile ekle)…"
        style={styles.input}
      />

      {/* Dropdown */}
      {showDrop && (query || filtered.length > 0) && (
        <div style={styles.dropdown}>
          {filtered.length === 0 && !query.includes('@') && (
            <div style={styles.dropEmpty}>Kişi bulunamadı. Dış e-posta yazarak Enter'a basın.</div>
          )}
          {filtered.map(p => (
            <button
              key={p.user_id}
              type="button"
              style={styles.dropItem}
              onClick={() => { onAdd(p); setQuery(''); }}
            >
              <span style={{ fontWeight: 600 }}>{p.full_name || p.email}</span>
              <span style={{ color: '#64748b', fontSize: 12 }}>{p.email}</span>
              {p.unit && <span style={{ color: '#94a3b8', fontSize: 11 }}>· {p.unit}</span>}
            </button>
          ))}
          {query.includes('@') && !filtered.some(p => (p.email || '').toLowerCase() === query.toLowerCase()) && (
            <button
              type="button"
              style={{ ...styles.dropItem, fontWeight: 600, color: '#0ea5e9' }}
              onClick={() => { onAddExternal(query); setQuery(''); }}
            >
              + Dış e-posta olarak ekle: {query}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Detail Panel ─────────────────────────────────────────────────────────
function MeetingDetail({ meeting, profile, people, onClose, onEdit, onDeleted, onChanged, onNavigate }) {
  const status = statusMeta(meeting.status || 'planlandi');
  const canEdit = ['direktor','asistan'].includes(profile?.role)
    || meeting.created_by === profile?.user_id
    || meeting.organizer_id === profile?.user_id;

  const [busy, setBusy] = useState(false);

  const endAt = new Date(new Date(meeting.starts_at).getTime() + (meeting.duration_minutes || 30) * 60000);

  const onDelete = async () => {
    if (!window.confirm('Bu toplantıyı silmek istediğinize emin misiniz?\n\nGoogle Calendar etkinliği de silinecek ve katılımcılara iptal bildirimi gidecek.')) return;
    setBusy(true);
    await deleteMeeting(meeting.id);
    setBusy(false);
    onDeleted();
  };

  const onQuickStatus = async (s) => {
    setBusy(true);
    await updateMeeting(meeting.id, { status: s }, { updateCalendar: s === 'iptal' });
    setBusy(false);
    onChanged();
  };

  const onRsvp = async (attendeeId, rsvpStatus) => {
    setBusy(true);
    await updateMeetingAttendeeRsvp(attendeeId, rsvpStatus);
    setBusy(false);
    onChanged();
  };

  const myAttendee = meeting.attendees?.find(a => a.user_id === profile?.user_id);

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth: 620 }} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...styles.statusPill, background: status.color + '22', color: status.color, borderColor: status.color + '55' }}>
              {status.label}
            </span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{meeting.title}</h2>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <div style={styles.modalBody}>
          {/* Zaman / Süre */}
          <div style={styles.detRow}>
            <span style={styles.detLabel}>🕒</span>
            <div>
              <div style={{ fontWeight: 600 }}>{fmtDateTime(meeting.starts_at)}</div>
              <div style={{ color: '#64748b', fontSize: 12 }}>
                Bitiş: {fmtTime(endAt.toISOString())} · {meeting.duration_minutes} dk · {meeting.timezone || 'Europe/Istanbul'} · {relTime(meeting.starts_at)}
              </div>
            </div>
          </div>

          {meeting.description && (
            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, fontSize: 13, whiteSpace: 'pre-wrap' }}>
              {meeting.description}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {meeting.organizer_name && (
              <DetItem label="Organizatör" value={meeting.organizer_name} />
            )}
            {meeting.unit && (
              <DetItem label="Birim" value={meeting.unit} />
            )}
            {meeting.location && (
              <DetItem label="Konum" value={meeting.location} />
            )}
            {meeting.collab?.title && (
              <DetItem
                label="İlgili İşbirliği"
                value={meeting.collab.title}
                onClick={() => onNavigate && onNavigate('collaborations', { collabId: meeting.collab.id })}
              />
            )}
          </div>

          {/* Meet link */}
          <div style={styles.meetBanner}>
            {meeting.meet_url ? (
              <>
                <div>
                  <div style={{ fontWeight: 700 }}>🎥 Google Meet</div>
                  <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
                    Calendar event: {meeting.calendar_event_id ? '✓ bağlı' : 'yok'}
                  </div>
                </div>
                <a href={meeting.meet_url} target="_blank" rel="noreferrer" style={styles.meetBtn}>
                  Katıl →
                </a>
                <button
                  style={styles.secondaryBtn}
                  onClick={() => { navigator.clipboard.writeText(meeting.meet_url); }}
                >📋 Kopyala</button>
              </>
            ) : (
              <div style={{ color: '#dc2626' }}>
                ⚠️ Meet linki oluşturulamadı. Organizatör Workspace admin'inden Domain-Wide Delegation ayarını kontrol etmeli.
              </div>
            )}
          </div>

          {/* Attendees */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
              KATILIMCILAR ({meeting.attendees?.length || 0})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(meeting.attendees || []).map(a => {
                const rsvp = RSVP_LABELS[a.rsvp_status || 'pending'];
                const isMe = a.user_id === profile?.user_id;
                return (
                  <div key={a.id} style={styles.attRow}>
                    <span>{a.is_organizer ? '👑' : '👤'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{a.name || a.email}</div>
                      <div style={{ color: '#64748b', fontSize: 11 }}>{a.email}{a.is_optional && ' · Opsiyonel'}</div>
                    </div>
                    <span style={{ ...styles.rsvpBadge, color: rsvp.color, borderColor: rsvp.color + '55' }}>
                      {rsvp.icon} {rsvp.label}
                    </span>
                    {isMe && myAttendee && (
                      <select
                        value={a.rsvp_status || 'pending'}
                        onChange={e => onRsvp(a.id, e.target.value)}
                        style={{ ...styles.input, width: 130, padding: '4px 6px', fontSize: 12 }}
                      >
                        {Object.entries(RSVP_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    )}
                  </div>
                );
              })}
              {(!meeting.attendees || meeting.attendees.length === 0) && (
                <div style={{ color: '#94a3b8', fontSize: 12 }}>Henüz katılımcı yok.</div>
              )}
            </div>
          </div>

          {meeting.notes && (
            <div style={{ padding: 10, background: '#fef3c7', borderRadius: 8, fontSize: 13, whiteSpace: 'pre-wrap' }}>
              📝 <b>Notlar:</b> {meeting.notes}
            </div>
          )}
        </div>

        <div style={styles.modalFooter}>
          {canEdit && (
            <>
              <select
                value={meeting.status || 'planlandi'}
                onChange={e => onQuickStatus(e.target.value)}
                disabled={busy}
                style={styles.input}
              >
                {MEETING_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <button onClick={onDelete} style={styles.dangerBtn} disabled={busy}>🗑 Sil</button>
              <div style={{ flex: 1 }} />
              <button onClick={onEdit} style={styles.secondaryBtn} disabled={busy}>✏️ Düzenle</button>
            </>
          )}
          {!canEdit && <div style={{ flex: 1 }} />}
          <button onClick={onClose} style={styles.primaryBtn}>Kapat</button>
        </div>
      </div>
    </div>
  );
}

// ── Utility components ───────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', letterSpacing: '0.03em', marginBottom: 6 }}>
        {label.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

function DetItem({ label, value, onClick }) {
  return (
    <div style={{ padding: 8, background: '#f8fafc', borderRadius: 6 }}>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div
        style={{ fontSize: 13, fontWeight: 600, cursor: onClick ? 'pointer' : 'default', color: onClick ? '#0ea5e9' : '#0f172a' }}
        onClick={onClick}
      >
        {value}
      </div>
    </div>
  );
}

// ── Stiller ──────────────────────────────────────────────────────────────
const styles = {
  page: { padding: '20px 28px', maxWidth: 1200, margin: '0 auto', fontFamily: 'inherit' },
  header: { display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 18, flexWrap: 'wrap' },
  h1: { margin: 0, fontSize: 26, fontWeight: 800, color: '#0f172a' },
  sub: { marginTop: 4, color: '#64748b', fontSize: 13, maxWidth: 680 },
  tabs: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
    padding: '8px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
    flexWrap: 'wrap',
  },
  tab: {
    padding: '6px 14px', borderRadius: 8, border: '1px solid transparent',
    background: 'transparent', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#475569',
  },
  tabActive: { background: '#fff', border: '1px solid #cbd5e1', color: '#0f172a', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' },
  searchInput: {
    width: 260, padding: '7px 12px', borderRadius: 8, border: '1px solid #cbd5e1',
    background: '#fff', fontSize: 13, outline: 'none',
  },
  select: {
    padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontSize: 13,
  },
  primaryBtn: {
    background: '#0ea5e9', color: '#fff', border: 'none',
    padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  secondaryBtn: {
    background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1',
    padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  dangerBtn: {
    background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca',
    padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  loading: { padding: 40, textAlign: 'center', color: '#64748b' },
  groupList: { display: 'flex', flexDirection: 'column', gap: 16 },
  dateHeader: {
    fontSize: 12, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em',
    padding: '6px 0', borderBottom: '1px solid #e2e8f0', marginBottom: 8,
  },
  cards: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14,
    cursor: 'pointer', transition: 'box-shadow .15s ease, transform .15s ease',
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  },
  cardRow1: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#475569', marginBottom: 8 },
  cardFooter: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '4px 9px', borderRadius: 999, background: '#f1f5f9',
    fontSize: 11.5, fontWeight: 600, color: '#475569',
  },
  statusPill: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '3px 9px', borderRadius: 999, border: '1px solid',
    fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
  },
  livePill: {
    padding: '3px 9px', borderRadius: 999, background: '#fee2e2', color: '#dc2626',
    fontSize: 10.5, fontWeight: 800, animation: 'pulse 1.5s infinite',
  },
  soonPill: {
    padding: '3px 9px', borderRadius: 999, background: '#fef3c7', color: '#d97706',
    fontSize: 10.5, fontWeight: 800,
  },
  timeRange: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#475569' },
  durBadge: { padding: '1px 6px', borderRadius: 4, background: '#e2e8f0', fontSize: 10, color: '#475569' },
  meetBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#0f172a', color: '#fff', textDecoration: 'none',
    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
    border: 'none', cursor: 'pointer',
  },
  editIconBtn: {
    background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6,
    padding: '4px 8px', fontSize: 12, cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 9999,
  },
  modal: {
    background: '#fff', borderRadius: 14, width: '100%', maxWidth: 720, maxHeight: '92vh',
    display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  },
  modalHeader: {
    padding: '14px 18px', borderBottom: '1px solid #e2e8f0',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  modalBody: { padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 },
  modalFooter: {
    padding: '12px 18px', borderTop: '1px solid #e2e8f0',
    display: 'flex', alignItems: 'center', gap: 8,
  },
  closeBtn: {
    background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b',
    width: 32, height: 32, borderRadius: 6,
  },
  input: {
    width: '100%', boxSizing: 'border-box',
    padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: 8,
    fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff', color: '#0f172a',
  },
  durPreset: {
    padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1',
    background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#475569',
  },
  durPresetActive: { background: '#0ea5e9', color: '#fff', borderColor: '#0ea5e9' },
  attChip: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '4px 8px', borderRadius: 999, background: '#e0f2fe', color: '#075985',
    fontSize: 12,
  },
  chipX: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    fontSize: 14, lineHeight: 1, color: '#0369a1', padding: 0, marginLeft: 4,
  },
  dropdown: {
    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
    background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.08)', zIndex: 10,
    maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column',
  },
  dropItem: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 12px', background: '#fff', border: 'none',
    borderBottom: '1px solid #f1f5f9', cursor: 'pointer', textAlign: 'left',
    fontSize: 13, fontFamily: 'inherit',
  },
  dropEmpty: { padding: '10px 12px', color: '#64748b', fontSize: 12 },
  errBox: {
    padding: 10, borderRadius: 8, background: '#fee2e2', color: '#dc2626',
    fontSize: 13, border: '1px solid #fecaca',
  },
  infoBox: {
    padding: 10, borderRadius: 8, background: '#eff6ff', color: '#1e40af',
    fontSize: 12, border: '1px solid #bfdbfe',
  },
  detRow: { display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: '#f8fafc', borderRadius: 8 },
  detLabel: { fontSize: 18 },
  meetBanner: {
    display: 'flex', alignItems: 'center', gap: 10, padding: 12,
    background: 'linear-gradient(135deg,#0f172a,#1e293b)', color: '#fff', borderRadius: 10,
  },
  attRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff',
  },
  rsvpBadge: {
    padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
    border: '1px solid',
  },
};
