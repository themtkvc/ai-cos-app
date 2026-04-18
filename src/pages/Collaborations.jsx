import React, { useEffect, useState, useMemo } from 'react';
import {
  getCollaborations, createCollaboration, updateCollaboration, deleteCollaboration,
  COLLAB_TYPES, COLLAB_STATUSES,
} from '../lib/supabase';
import { UNITS, resolveUnitName, fmtDisplayDate } from '../lib/constants';

// ── Yardımcılar ──────────────────────────────────────────────────────────────
const typeObj   = (id) => COLLAB_TYPES.find(t => t.id === id);
const statusObj = (id) => COLLAB_STATUSES.find(s => s.id === id);
const unitObj   = (name) => UNITS.find(u => u.name === resolveUnitName(name));

function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)    return `${Math.round(diff)} sn önce`;
  if (diff < 3600)  return `${Math.round(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.round(diff / 3600)} saat önce`;
  if (diff < 604800) return `${Math.round(diff / 86400)} gün önce`;
  return d.toLocaleDateString('tr-TR');
}

function canEdit(row, profile) {
  if (!profile || !row) return false;
  if (row.owner_id && profile.user_id && row.owner_id === profile.user_id) return true;
  if (profile.role === 'direktor' || profile.role === 'direktor_yardimcisi') return true;
  if (profile.role === 'koordinator' && resolveUnitName(profile.unit) === resolveUnitName(row.unit)) return true;
  return false;
}

// ── Ana Sayfa ────────────────────────────────────────────────────────────────
export default function Collaborations({ user, profile }) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [typeFilter, setTypeFilter]     = useState('all');
  const [unitFilter, setUnitFilter]     = useState('all');
  const [statusFilter, setStatusFilter] = useState('active'); // active = iptal/tamamlandı hariç
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // {} for new, row for edit
  const [viewId, setViewId]   = useState(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const { data, error } = await getCollaborations({});
      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (typeFilter !== 'all'   && r.type !== typeFilter) return false;
      if (unitFilter !== 'all'   && resolveUnitName(r.unit) !== unitFilter) return false;
      if (statusFilter === 'active') {
        if (['tamamlandi', 'iptal'].includes(r.status)) return false;
      } else if (statusFilter !== 'all') {
        if (r.status !== statusFilter) return false;
      }
      if (q) {
        const hay = `${r.title || ''} ${r.description || ''} ${r.partner_name || ''} ${r.owner_name || ''} ${(r.tags || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, typeFilter, unitFilter, statusFilter, search]);

  const counts = useMemo(() => {
    const c = { total: rows.length, active: 0 };
    COLLAB_STATUSES.forEach(s => { c[s.id] = 0; });
    rows.forEach(r => {
      c[r.status] = (c[r.status] || 0) + 1;
      if (!['tamamlandi', 'iptal'].includes(r.status)) c.active += 1;
    });
    return c;
  }, [rows]);

  const viewing = rows.find(r => r.id === viewId);

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🤝 İşbirlikleri</div>
          <div style={{ fontSize: 13, opacity: 0.7 }}>
            Tüm birimlerin ortak projeleri, etkinlikleri, fonları ve araştırmaları. Toplam {counts.total} · {counts.active} aktif.
          </div>
        </div>
        <button
          onClick={() => setEditing({})}
          style={{
            padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            border: 'none', background: 'var(--navy, #1a3a5c)', color: '#fff',
          }}
        >＋ Yeni İşbirliği</button>
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <FilterChip active={statusFilter === 'active'} onClick={() => setStatusFilter('active')} label={`Aktif (${counts.active})`} />
        <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} label={`Tümü (${counts.total})`} />
        {COLLAB_STATUSES.map(s => (
          <FilterChip
            key={s.id}
            active={statusFilter === s.id}
            onClick={() => setStatusFilter(s.id)}
            label={`${s.label} (${counts[s.id] || 0})`}
            color={s.color}
          />
        ))}
      </div>

      {/* Type + unit + search */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={selStyle}>
          <option value="all">Tüm türler</option>
          {COLLAB_TYPES.map(t => (<option key={t.id} value={t.id}>{t.icon} {t.label}</option>))}
        </select>
        <select value={unitFilter} onChange={e => setUnitFilter(e.target.value)} style={selStyle}>
          <option value="all">Tüm birimler</option>
          {UNITS.map(u => (<option key={u.name} value={u.name}>{u.icon} {u.name}</option>))}
        </select>
        <input
          type="search"
          placeholder="🔎 Ara (başlık, açıklama, partner, etiket…)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 220, padding: '7px 11px', borderRadius: 7, fontSize: 13,
            border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
            background: 'var(--bg, #fff)', color: 'inherit', outline: 'none',
          }}
        />
        <button onClick={load} style={selStyle}>🔄 Yenile</button>
      </div>

      {error && (
        <div style={{
          padding: 12, borderRadius: 8, marginBottom: 14,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#dc2626', fontSize: 13,
        }}>⚠️ {error}</div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', opacity: 0.6 }}>Yükleniyor…</div>
      ) : filtered.length === 0 ? (
        <div style={{
          padding: 40, textAlign: 'center',
          background: 'var(--bg-soft, rgba(0,0,0,0.02))',
          borderRadius: 12, border: '1px dashed var(--border, rgba(0,0,0,0.12))',
        }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🤷</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Bu filtreye uyan işbirliği yok</div>
          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>Filtreyi değiştirin ya da yeni bir işbirliği oluşturun.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {filtered.map(r => (
            <CollabCard key={r.id} row={r} onOpen={() => setViewId(r.id)} />
          ))}
        </div>
      )}

      {editing !== null && (
        <CollabModal
          row={editing}
          profile={profile}
          user={user}
          onClose={() => setEditing(null)}
          onSaved={(next) => {
            setRows(xs => {
              const idx = xs.findIndex(x => x.id === next.id);
              if (idx >= 0) { const n = xs.slice(); n[idx] = next; return n; }
              return [next, ...xs];
            });
            setEditing(null);
          }}
        />
      )}

      {viewing && (
        <CollabDetailModal
          row={viewing}
          profile={profile}
          onClose={() => setViewId(null)}
          onEdit={() => { setViewId(null); setEditing(viewing); }}
          onDeleted={() => {
            setRows(xs => xs.filter(x => x.id !== viewing.id));
            setViewId(null);
          }}
        />
      )}
    </div>
  );
}

// ── Bileşenler ───────────────────────────────────────────────────────────────
const selStyle = {
  padding: '7px 11px', borderRadius: 7, fontSize: 12.5,
  border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
  background: 'var(--bg, #fff)', color: 'inherit', cursor: 'pointer',
};

function FilterChip({ active, onClick, label, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        border: `1.5px solid ${active ? (color || 'var(--navy, #1a3a5c)') : 'var(--border, rgba(0,0,0,0.15))'}`,
        background: active ? (color || 'var(--navy, #1a3a5c)') : 'var(--bg, #fff)',
        color: active ? '#fff' : 'inherit',
      }}
    >{label}</button>
  );
}

function CollabCard({ row, onOpen }) {
  const t = typeObj(row.type);
  const s = statusObj(row.status);
  const u = unitObj(row.unit);
  return (
    <div
      onClick={onOpen}
      style={{
        padding: 14, borderRadius: 12, cursor: 'pointer',
        background: 'var(--bg, #fff)',
        border: '1.5px solid var(--border, rgba(0,0,0,0.12))',
        transition: 'transform .1s ease, box-shadow .1s ease',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {t && (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 12,
            background: `${t.color}20`, color: t.color,
          }}>{t.icon} {t.label}</span>
        )}
        {s && (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 12,
            background: `${s.color}20`, color: s.color,
          }}>{s.label}</span>
        )}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>{row.title}</div>
      {row.partner_name && (
        <div style={{ fontSize: 12.5, opacity: 0.85 }}>
          🤝 <b>Partner:</b> {row.partner_name}
        </div>
      )}
      {u && (
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          {u.icon} <span style={{ color: u.color, fontWeight: 600 }}>{u.name}</span>
        </div>
      )}
      <div style={{ fontSize: 11.5, opacity: 0.6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {row.start_date && <span>📅 {fmtDisplayDate(row.start_date)}{row.end_date ? ` → ${fmtDisplayDate(row.end_date)}` : ''}</span>}
        {row.owner_name && <span>👤 {row.owner_name}</span>}
        <span>· {timeAgo(row.created_at)}</span>
      </div>
    </div>
  );
}

// ── Detay Modal ──────────────────────────────────────────────────────────────
function CollabDetailModal({ row, profile, onClose, onEdit, onDeleted }) {
  const t = typeObj(row.type);
  const s = statusObj(row.status);
  const u = unitObj(row.unit);
  const editable = canEdit(row, profile);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm('Bu işbirliği kalıcı olarak silinecek. Emin misiniz?')) return;
    setDeleting(true);
    const { error } = await deleteCollaboration(row.id);
    setDeleting(false);
    if (error) return alert('Silinemedi: ' + error.message);
    onDeleted();
  };

  return (
    <ModalShell onClose={onClose} title={`${t?.icon || '🤝'} ${row.title}`}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {t && <Chip color={t.color} label={`${t.icon} ${t.label}`} />}
        {s && <Chip color={s.color} label={s.label} />}
        {u && <Chip color={u.color} label={`${u.icon} ${u.name}`} />}
      </div>

      {row.description && (
        <Section title="Açıklama">
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.5 }}>{row.description}</div>
        </Section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {(row.partner_name || row.partner_contact_person || row.partner_email || row.partner_website) && (
          <Section title="Partner Bilgileri">
            {row.partner_name           && <Field label="Kurum"   value={row.partner_name} />}
            {row.partner_contact_person && <Field label="İlgili Kişi" value={row.partner_contact_person} />}
            {row.partner_email          && <Field label="E-posta" value={<a href={`mailto:${row.partner_email}`} style={{ color: 'var(--navy, #1a3a5c)' }}>{row.partner_email}</a>} />}
            {row.partner_website        && <Field label="Web"     value={<a href={row.partner_website} target="_blank" rel="noreferrer" style={{ color: 'var(--navy, #1a3a5c)' }}>{row.partner_website}</a>} />}
          </Section>
        )}

        <Section title="Zaman & Durum">
          {row.start_date && <Field label="Başlangıç" value={fmtDisplayDate(row.start_date)} />}
          {row.end_date   && <Field label="Bitiş"     value={fmtDisplayDate(row.end_date)} />}
          {row.budget_amount != null && (
            <Field label="Bütçe" value={`${Number(row.budget_amount).toLocaleString('tr-TR')} ${row.budget_currency || 'TRY'}`} />
          )}
          {row.owner_name && <Field label="Sahibi" value={row.owner_name} />}
        </Section>
      </div>

      {row.tags && row.tags.length > 0 && (
        <Section title="Etiketler">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {row.tags.map(tg => (
              <span key={tg} style={{
                fontSize: 11, padding: '3px 8px', borderRadius: 10,
                background: 'var(--bg-soft, rgba(0,0,0,0.05))',
              }}>#{tg}</span>
            ))}
          </div>
        </Section>
      )}

      <div style={{ marginTop: 18, display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {editable && (
          <>
            <button onClick={handleDelete} disabled={deleting} style={{
              padding: '9px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
              border: '1.5px solid rgba(239,68,68,0.3)',
              background: 'transparent', color: '#dc2626',
            }}>{deleting ? 'Siliniyor…' : '🗑 Sil'}</button>
            <button onClick={onEdit} style={{
              padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: 'none', background: 'var(--navy, #1a3a5c)', color: '#fff',
            }}>✎ Düzenle</button>
          </>
        )}
        <button onClick={onClose} style={{
          padding: '9px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
          border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
          background: 'var(--bg, #fff)', color: 'inherit',
        }}>Kapat</button>
      </div>
    </ModalShell>
  );
}

// ── Oluştur/Düzenle Modal ────────────────────────────────────────────────────
function CollabModal({ row, profile, user, onClose, onSaved }) {
  const isNew = !row?.id;
  const [form, setForm] = useState({
    title:                   row?.title || '',
    description:             row?.description || '',
    type:                    row?.type || 'proje',
    unit:                    row?.unit || resolveUnitName(profile?.unit) || UNITS[0].name,
    partner_name:            row?.partner_name || '',
    partner_contact_person:  row?.partner_contact_person || '',
    partner_email:           row?.partner_email || '',
    partner_website:         row?.partner_website || '',
    start_date:              row?.start_date || '',
    end_date:                row?.end_date || '',
    status:                  row?.status || 'planlaniyor',
    budget_amount:           row?.budget_amount ?? '',
    budget_currency:         row?.budget_currency || 'TRY',
    tags:                    (row?.tags || []).join(', '),
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) return setErr('Başlık zorunlu.');
    if (!form.type) return setErr('Tür seçin.');
    if (!form.unit) return setErr('Birim seçin.');

    setSaving(true); setErr('');

    const payload = {
      title:                  form.title.trim(),
      description:            form.description.trim() || null,
      type:                   form.type,
      unit:                   resolveUnitName(form.unit),
      partner_name:           form.partner_name.trim() || null,
      partner_contact_person: form.partner_contact_person.trim() || null,
      partner_email:          form.partner_email.trim() || null,
      partner_website:        form.partner_website.trim() || null,
      start_date:             form.start_date || null,
      end_date:               form.end_date || null,
      status:                 form.status,
      budget_amount:          form.budget_amount === '' ? null : Number(form.budget_amount),
      budget_currency:        form.budget_currency || 'TRY',
      tags:                   form.tags.split(',').map(x => x.trim()).filter(Boolean),
    };

    try {
      if (isNew) {
        payload.owner_id   = user?.id || profile?.user_id;
        payload.owner_name = profile?.full_name || user?.email || '—';
        const { data, error } = await createCollaboration(payload);
        if (error) throw error;
        onSaved(data);
      } else {
        const { data, error } = await updateCollaboration(row.id, payload);
        if (error) throw error;
        onSaved(data);
      }
    } catch (e) {
      console.error(e);
      setErr(e.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title={isNew ? '＋ Yeni İşbirliği' : '✎ İşbirliğini Düzenle'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <LabeledInput label="Başlık *" value={form.title} onChange={v => set('title', v)} placeholder="Örn: UNICEF ile Gaziantep çocuk sağlığı projesi" />
        <LabeledTextarea label="Açıklama" value={form.description} onChange={v => set('description', v)} placeholder="Kısa özet, hedefler, kapsam…" rows={4} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <LabeledSelect label="Tür *" value={form.type} onChange={v => set('type', v)}>
            {COLLAB_TYPES.map(t => (<option key={t.id} value={t.id}>{t.icon} {t.label}</option>))}
          </LabeledSelect>
          <LabeledSelect label="Sorumlu Birim *" value={form.unit} onChange={v => set('unit', v)}>
            {UNITS.map(u => (<option key={u.name} value={u.name}>{u.icon} {u.name}</option>))}
          </LabeledSelect>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.6, marginTop: 6 }}>PARTNER</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <LabeledInput label="Partner Kurum" value={form.partner_name} onChange={v => set('partner_name', v)} placeholder="Örn: UNICEF Türkiye" />
          <LabeledInput label="İlgili Kişi" value={form.partner_contact_person} onChange={v => set('partner_contact_person', v)} placeholder="Ad Soyad" />
          <LabeledInput label="E-posta" value={form.partner_email} onChange={v => set('partner_email', v)} placeholder="kisi@kurum.org" />
          <LabeledInput label="Web / Link" value={form.partner_website} onChange={v => set('partner_website', v)} placeholder="https://…" />
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.6, marginTop: 6 }}>ZAMAN & BÜTÇE</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <LabeledInput type="date" label="Başlangıç" value={form.start_date} onChange={v => set('start_date', v)} />
          <LabeledInput type="date" label="Bitiş"     value={form.end_date}   onChange={v => set('end_date', v)} />
          <LabeledSelect label="Durum" value={form.status} onChange={v => set('status', v)}>
            {COLLAB_STATUSES.map(s => (<option key={s.id} value={s.id}>{s.label}</option>))}
          </LabeledSelect>
          <LabeledInput type="number" label="Bütçe" value={form.budget_amount} onChange={v => set('budget_amount', v)} placeholder="0" />
          <LabeledSelect label="Para Birimi" value={form.budget_currency} onChange={v => set('budget_currency', v)}>
            <option value="TRY">TRY (₺)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
          </LabeledSelect>
        </div>

        <LabeledInput label="Etiketler (virgülle ayırın)" value={form.tags} onChange={v => set('tags', v)} placeholder="çocuk, sağlık, gaziantep" />

        {err && (
          <div style={{
            padding: 10, borderRadius: 8,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#dc2626', fontSize: 12.5,
          }}>⚠️ {err}</div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
          <button onClick={onClose} style={{
            padding: '9px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
            border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
            background: 'var(--bg, #fff)', color: 'inherit',
          }}>İptal</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            border: 'none', background: 'var(--navy, #1a3a5c)', color: '#fff',
            opacity: saving ? 0.6 : 1,
          }}>{saving ? 'Kaydediliyor…' : (isNew ? 'Oluştur' : 'Kaydet')}</button>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Küçük UI parçaları ───────────────────────────────────────────────────────
function ModalShell({ children, onClose, title }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10000, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg, #fff)', color: 'inherit',
          borderRadius: 14, padding: 22,
          maxWidth: 720, width: '100%', maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
          paddingBottom: 12, borderBottom: '1px solid var(--border, rgba(0,0,0,0.1))',
        }}>
          <div style={{ flex: 1, fontSize: 17, fontWeight: 800 }}>{title}</div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'var(--bg-soft, rgba(0,0,0,0.05))', fontSize: 16,
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Chip({ label, color }) {
  return (
    <span style={{
      fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 12,
      background: `${color}20`, color,
    }}>{label}</span>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', opacity: 0.6, marginBottom: 6 }}>
        {title.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ fontSize: 12.5, marginBottom: 4 }}>
      <span style={{ opacity: 0.6 }}>{label}:</span>{' '}
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function LabeledInput({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.7 }}>{label}</span>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          padding: '8px 11px', borderRadius: 7, fontSize: 13,
          border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
          background: 'var(--bg, #fff)', color: 'inherit', outline: 'none',
        }}
      />
    </label>
  );
}

function LabeledTextarea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.7 }}>{label}</span>
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          padding: '8px 11px', borderRadius: 7, fontSize: 13,
          border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
          background: 'var(--bg, #fff)', color: 'inherit', outline: 'none',
          resize: 'vertical', fontFamily: 'inherit',
        }}
      />
    </label>
  );
}

function LabeledSelect({ label, value, onChange, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.7 }}>{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          padding: '8px 11px', borderRadius: 7, fontSize: 13,
          border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
          background: 'var(--bg, #fff)', color: 'inherit', cursor: 'pointer',
        }}
      >{children}</select>
    </label>
  );
}
