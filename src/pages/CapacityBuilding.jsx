import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { fmtDisplayDate } from '../lib/constants';

// ═══════════════════════════════════════════════════════════════════════════════
// SABİTLER
// ═══════════════════════════════════════════════════════════════════════════════

const EVENT_TYPES = {
  egitim:     { label: 'Eğitim',     color: '#2563eb', icon: '📚' },
  atolye:     { label: 'Atölye',     color: '#7c3aed', icon: '🛠️' },
  seminer:    { label: 'Seminer',    color: '#0891b2', icon: '🎤' },
  webinar:    { label: 'Webinar',    color: '#059669', icon: '💻' },
  konferans:  { label: 'Konferans',  color: '#d97706', icon: '🏛️' },
  panel:      { label: 'Panel',      color: '#dc2626', icon: '🎙️' },
  mentoring:  { label: 'Mentorluk',  color: '#ec4899', icon: '🤝' },
  diger:      { label: 'Diğer',      color: '#6b7280', icon: '📌' },
};

const STATUS_MAP = {
  planned:   { label: 'Planlandı',  color: '#d97706', icon: '📋' },
  ongoing:   { label: 'Devam Ediyor', color: '#2563eb', icon: '▶️' },
  completed: { label: 'Tamamlandı', color: '#16a34a', icon: '✅' },
  cancelled: { label: 'İptal',      color: '#dc2626', icon: '❌' },
};

const LOCATION_TYPES = {
  fiziksel: { label: 'Yüz Yüze', icon: '📍' },
  online:   { label: 'Online', icon: '💻' },
  hibrit:   { label: 'Hibrit', icon: '🔗' },
};

// Elif Ergani — kapasite geliştirme sorumlusu
const CB_MANAGER_ID = 'b11f8d19-64b3-492b-887b-e310d9d2c4dd';
const CB_MANAGER_NAME = 'Elif Ergani';

// ═══════════════════════════════════════════════════════════════════════════════
// DİKEY AFİŞ KARTI
// ═══════════════════════════════════════════════════════════════════════════════

function PosterCard({ event, onClick }) {
  const type = EVENT_TYPES[event.event_type] || EVENT_TYPES.diger;
  const status = STATUS_MAP[event.status] || STATUS_MAP.planned;
  const loc = LOCATION_TYPES[event.location_type] || LOCATION_TYPES.fiziksel;

  return (
    <div onClick={onClick} style={{
      background: 'var(--bg-card, #fff)', border: '1px solid var(--border)',
      borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
      display: 'flex', flexDirection: 'column',
      transition: 'transform 0.15s, box-shadow 0.15s',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}>

      {/* Afiş Görseli — Dikey (4:5 oran) */}
      <div style={{
        width: '100%', paddingTop: '125%', position: 'relative',
        background: event.cover_image_url ? 'transparent' : `linear-gradient(135deg, ${type.color}22, ${type.color}44)`,
        overflow: 'hidden',
      }}>
        {event.cover_image_url ? (
          <img src={event.cover_image_url} alt={event.title}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 48, opacity: 0.6 }}>{type.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 700, opacity: 0.5, color: type.color, textAlign: 'center', padding: '0 16px' }}>{event.title}</span>
          </div>
        )}
        {/* Durum badge */}
        <div style={{
          position: 'absolute', top: 10, right: 10, background: status.color,
          color: '#fff', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
        }}>{status.label}</div>
        {/* Tür badge */}
        <div style={{
          position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.6)',
          color: '#fff', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
        }}>{type.icon} {type.label}</div>
      </div>

      {/* Alt Bilgi */}
      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {event.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          📅 {fmtDisplayDate(event.start_date)}
          {event.end_date && event.end_date !== event.start_date && ` — ${fmtDisplayDate(event.end_date)}`}
        </div>
        {(event.location_name || event.city) && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            {loc.icon} {event.location_name || ''}{event.city ? `, ${event.city}` : ''}
          </div>
        )}
        {event.trainer_name && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>🎓 {event.trainer_name}</div>
        )}
        <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
          <span>{event.organizer_name || CB_MANAGER_NAME}</span>
          {event.actual_participants > 0 && <span>👥 {event.actual_participants} katılımcı</span>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETAY MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function DetailModal({ event, onClose, canEdit, onEdit }) {
  if (!event) return null;
  const type = EVENT_TYPES[event.event_type] || EVENT_TYPES.diger;
  const status = STATUS_MAP[event.status] || STATUS_MAP.planned;
  const loc = LOCATION_TYPES[event.location_type] || LOCATION_TYPES.fiziksel;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 640, maxHeight: '85vh', overflowY: 'auto' }}>
        {/* Kapak Görseli */}
        {event.cover_image_url && (
          <div style={{ margin: '-24px -24px 16px', height: 240, overflow: 'hidden', borderRadius: '12px 12px 0 0' }}>
            <img src={event.cover_image_url} alt={event.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

        {/* Başlık & Badge'ler */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 20, lineHeight: 1.3 }}>{event.title}</h2>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: type.color + '20', color: type.color }}>{type.icon} {type.label}</span>
              <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: status.color + '20', color: status.color }}>{status.label}</span>
              <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{loc.icon} {loc.label}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {canEdit && <button className="btn btn-outline btn-sm" onClick={() => { onClose(); onEdit(event); }}>✏️ Düzenle</button>}
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
          </div>
        </div>

        {/* Bilgi Satırları */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <InfoRow icon="📅" label="Tarih" value={`${fmtDisplayDate(event.start_date)}${event.end_date && event.end_date !== event.start_date ? ' — ' + fmtDisplayDate(event.end_date) : ''}`} />
          {event.start_time && <InfoRow icon="🕐" label="Saat" value={`${event.start_time?.slice(0,5)}${event.end_time ? ' — ' + event.end_time.slice(0,5) : ''}`} />}
          {event.location_name && <InfoRow icon="📍" label="Mekan" value={event.location_name} />}
          {event.city && <InfoRow icon="🏙️" label="Şehir / Ülke" value={`${event.city}${event.country ? ', ' + event.country : ''}`} />}
          {event.trainer_name && <InfoRow icon="🎓" label="Eğitmen" value={`${event.trainer_name}${event.trainer_organization ? ' — ' + event.trainer_organization : ''}`} />}
          {event.language && <InfoRow icon="🌐" label="Dil" value={event.language} />}
          {event.target_audience && <InfoRow icon="🎯" label="Hedef Kitle" value={event.target_audience} />}
          {(event.max_participants || event.actual_participants > 0) && (
            <InfoRow icon="👥" label="Katılımcı" value={`${event.actual_participants || 0}${event.max_participants ? ' / ' + event.max_participants : ''}`} />
          )}
          {event.certificate_provided && <InfoRow icon="📜" label="Sertifika" value={`Evet${event.certificate_count > 0 ? ' (' + event.certificate_count + ' adet)' : ''}`} />}
          {event.online_link && <InfoRow icon="🔗" label="Online Link" value={<a href={event.online_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', wordBreak: 'break-all' }}>Katıl →</a>} />}
        </div>

        {/* Açıklama / Hedefler / Çıktılar */}
        {event.description && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Açıklama</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{event.description}</div>
          </div>
        )}
        {event.objectives && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>🎯 Hedefler</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{event.objectives}</div>
          </div>
        )}
        {event.outcomes && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>📊 Çıktılar / Sonuçlar</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{event.outcomes}</div>
          </div>
        )}
        {event.topics?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>📝 Konular</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {event.topics.map((t, i) => (
                <span key={i} style={{ background: 'var(--bg-hover)', padding: '4px 10px', borderRadius: 20, fontSize: 12 }}>{t}</span>
              ))}
            </div>
          </div>
        )}
        {event.materials_url && (
          <div style={{ marginBottom: 16 }}>
            <a href={event.materials_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">📂 Materyalleri Görüntüle</a>
          </div>
        )}
        {event.notes && (
          <div style={{ marginBottom: 16, background: 'var(--bg-hover)', padding: 12, borderRadius: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>📌 Notlar</div>
            <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{event.notes}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
      <span>{icon}</span>
      <div><span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{label}:</span> <span style={{ fontWeight: 600 }}>{value}</span></div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ETKİNLİK OLUŞTURMA / DÜZENLEME FORMU
// ═══════════════════════════════════════════════════════════════════════════════

function EventForm({ event, user, profile, onSaved, onCancel }) {
  const isEdit = !!event?.id;
  const [form, setForm] = useState(() => event ? { ...event, topics: event.topics || [] } : {
    title: '', description: '', event_type: 'egitim', status: 'planned',
    start_date: '', end_date: '', start_time: '', end_time: '',
    location_name: '', location_type: 'fiziksel', city: '', country: '',
    online_link: '', cover_image_url: '', target_audience: '',
    max_participants: '', actual_participants: 0,
    trainer_name: '', trainer_organization: '', language: 'Türkçe',
    objectives: '', topics: [], outcomes: '', materials_url: '',
    budget: '', budget_currency: 'TRY', notes: '',
    certificate_provided: false, certificate_count: 0, tags: [],
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [topicInput, setTopicInput] = useState('');

  const set = (f, v) => setForm(prev => ({ ...prev, [f]: v }));

  const handleImageUpload = async (file) => {
    if (!file || file.size > 5 * 1024 * 1024) { alert('Max 5 MB'); return; }
    setUploading(true);
    try {
      // Sıkıştır
      const img = new Image();
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve) => {
        reader.onload = () => {
          img.onload = () => {
            const MAX = 1200;
            let w = img.width, h = img.height;
            if (w > MAX || h > MAX) { const r = Math.min(MAX / w, MAX / h); w = Math.round(w * r); h = Math.round(h * r); }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(',')[1];
      const byteChars = atob(base64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });

      const id = isEdit ? event.id : 'temp-' + Date.now();
      const path = `${id}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('capacity-covers').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('capacity-covers').getPublicUrl(path);
      set('cover_image_url', urlData.publicUrl + '?t=' + Date.now());
    } catch (e) {
      alert('Yükleme hatası: ' + e.message);
    } finally { setUploading(false); }
  };

  const addTopic = () => {
    const t = topicInput.trim();
    if (t && !form.topics.includes(t)) {
      set('topics', [...form.topics, t]);
      setTopicInput('');
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) { alert('Başlık zorunludur'); return; }
    if (!form.start_date) { alert('Başlangıç tarihi zorunludur'); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        event_type: form.event_type,
        status: form.status,
        start_date: form.start_date,
        end_date: form.end_date || null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        location_name: form.location_name || null,
        location_type: form.location_type,
        city: form.city || null,
        country: form.country || null,
        online_link: form.online_link || null,
        cover_image_url: form.cover_image_url || null,
        target_audience: form.target_audience || null,
        max_participants: form.max_participants ? Number(form.max_participants) : null,
        actual_participants: Number(form.actual_participants) || 0,
        trainer_name: form.trainer_name || null,
        trainer_organization: form.trainer_organization || null,
        language: form.language || 'Türkçe',
        objectives: form.objectives || null,
        topics: form.topics,
        outcomes: form.outcomes || null,
        materials_url: form.materials_url || null,
        unit: profile?.unit || null,
        organizer_id: user.id,
        organizer_name: profile?.full_name || '',
        budget: form.budget ? Number(form.budget) : null,
        budget_currency: form.budget_currency || 'TRY',
        notes: form.notes || null,
        certificate_provided: form.certificate_provided,
        certificate_count: Number(form.certificate_count) || 0,
        tags: form.tags || [],
      };
      if (!isEdit) payload.created_by = user.id;

      let result;
      if (isEdit) {
        result = await supabase.from('capacity_events').update(payload).eq('id', event.id).select().single();
      } else {
        result = await supabase.from('capacity_events').insert(payload).select().single();
      }
      if (result.error) throw result.error;
      onSaved(result.data);
    } catch (e) { alert('Kayıt hatası: ' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{isEdit ? '✏️ Etkinliği Düzenle' : '📚 Yeni Kapasite Geliştirme Etkinliği'}</h2>
        <button className="btn btn-outline btn-sm" onClick={onCancel}>← Geri</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Sol — Temel Bilgiler */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Başlık *</label>
            <input className="form-input" placeholder="Etkinlik adı" value={form.title} onChange={e => set('title', e.target.value)} maxLength={150} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Tür</label>
              <select className="form-select" value={form.event_type} onChange={e => set('event_type', e.target.value)}>
                {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Durum</label>
              <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Başlangıç *</label>
              <input type="date" className="form-input" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Bitiş</label>
              <input type="date" className="form-input" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Saat Başlangıç</label>
              <input type="time" lang="tr" className="form-input" value={form.start_time} onChange={e => set('start_time', e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Saat Bitiş</label>
              <input type="time" lang="tr" className="form-input" value={form.end_time} onChange={e => set('end_time', e.target.value)} />
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Konum Türü</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {Object.entries(LOCATION_TYPES).map(([k, v]) => (
                <button key={k} type="button" onClick={() => set('location_type', k)}
                  className={`btn btn-sm ${form.location_type === k ? 'btn-primary' : 'btn-outline'}`}
                  style={{ flex: 1 }}>{v.icon} {v.label}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Mekan</label>
              <input className="form-input" placeholder="Mekan adı" value={form.location_name} onChange={e => set('location_name', e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Şehir</label>
              <input className="form-input" placeholder="Şehir" value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
          </div>

          {(form.location_type === 'online' || form.location_type === 'hibrit') && (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Online Link</label>
              <input className="form-input" placeholder="https://..." value={form.online_link} onChange={e => set('online_link', e.target.value)} />
            </div>
          )}
        </div>

        {/* Sağ — Görsel & Detaylar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Afiş Yükleme */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Afiş Görseli</label>
            <div style={{
              border: '2px dashed var(--border)', borderRadius: 12, overflow: 'hidden',
              position: 'relative', cursor: 'pointer',
              background: form.cover_image_url ? 'transparent' : 'var(--bg-hover)',
            }}
            onClick={() => document.getElementById('cb-cover-input')?.click()}>
              {form.cover_image_url ? (
                <div style={{ position: 'relative' }}>
                  <img src={form.cover_image_url} alt="cover" style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }} />
                  <button type="button" onClick={e => { e.stopPropagation(); set('cover_image_url', ''); }}
                    style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: 14 }}>✕</button>
                </div>
              ) : (
                <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                  {uploading ? <div className="loading-spinner" style={{ margin: '0 auto' }} /> : (
                    <>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>🖼️</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Afiş yüklemek için tıklayın</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Dikey format önerilir (4:5 oran)</div>
                    </>
                  )}
                </div>
              )}
            </div>
            <input id="cb-cover-input" type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]); e.target.value = ''; }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Eğitmen / Konuşmacı</label>
              <input className="form-input" placeholder="Ad Soyad" value={form.trainer_name} onChange={e => set('trainer_name', e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Eğitmen Kuruluşu</label>
              <input className="form-input" placeholder="Kurum adı" value={form.trainer_organization} onChange={e => set('trainer_organization', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Hedef Kitle</label>
              <input className="form-input" placeholder="Örn: Koordinatörler" value={form.target_audience} onChange={e => set('target_audience', e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Dil</label>
              <select className="form-select" value={form.language} onChange={e => set('language', e.target.value)}>
                {['Türkçe', 'İngilizce', 'Arapça', 'Fransızca', 'Diğer'].map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Max Katılımcı</label>
              <input type="number" min={0} className="form-input" value={form.max_participants} onChange={e => set('max_participants', e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Gerçekleşen Katılımcı</label>
              <input type="number" min={0} className="form-input" value={form.actual_participants} onChange={e => set('actual_participants', e.target.value)} />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.certificate_provided} onChange={e => set('certificate_provided', e.target.checked)} />
            📜 Sertifika verildi
          </label>
          {form.certificate_provided && (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Sertifika Sayısı</label>
              <input type="number" min={0} className="form-input" value={form.certificate_count} onChange={e => set('certificate_count', e.target.value)} />
            </div>
          )}
        </div>
      </div>

      {/* Tam Genişlik Alanlar */}
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Açıklama</label>
          <textarea className="form-input" rows={3} placeholder="Etkinlik açıklaması..." value={form.description} onChange={e => set('description', e.target.value)} maxLength={1000} style={{ resize: 'vertical' }} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Hedefler</label>
          <textarea className="form-input" rows={2} placeholder="Etkinliğin hedefleri..." value={form.objectives} onChange={e => set('objectives', e.target.value)} maxLength={500} style={{ resize: 'vertical' }} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Çıktılar / Sonuçlar</label>
          <textarea className="form-input" rows={2} placeholder="Etkinlikten elde edilen sonuçlar..." value={form.outcomes} onChange={e => set('outcomes', e.target.value)} maxLength={500} style={{ resize: 'vertical' }} />
        </div>

        {/* Konular */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Konular / Etiketler</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="form-input" placeholder="Konu ekle..." value={topicInput} onChange={e => setTopicInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTopic(); } }} style={{ flex: 1 }} />
            <button type="button" className="btn btn-outline btn-sm" onClick={addTopic}>+ Ekle</button>
          </div>
          {form.topics.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {form.topics.map((t, i) => (
                <span key={i} style={{ background: 'var(--bg-hover)', padding: '4px 10px', borderRadius: 20, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {t}
                  <button type="button" onClick={() => set('topics', form.topics.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--red)', padding: 0, lineHeight: 1 }}>✕</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Materyaller Linki</label>
          <input className="form-input" placeholder="https://drive.google.com/..." value={form.materials_url} onChange={e => set('materials_url', e.target.value)} />
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Notlar</label>
          <textarea className="form-input" rows={2} placeholder="Ek notlar..." value={form.notes} onChange={e => set('notes', e.target.value)} maxLength={500} style={{ resize: 'vertical' }} />
        </div>
      </div>

      {/* Kaydet */}
      <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
        <button className="btn btn-outline" onClick={onCancel}>İptal</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? '⏳ Kaydediliyor...' : isEdit ? '💾 Güncelle' : '📚 Etkinliği Kaydet'}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANA BİLEŞEN
// ═══════════════════════════════════════════════════════════════════════════════

export default function CapacityBuilding({ user, profile }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [formMode, setFormMode] = useState(null); // null | 'create' | event-object (edit)

  const canEdit = user.id === CB_MANAGER_ID || ['direktor', 'asistan', 'direktor_yardimcisi', 'koordinator'].includes(profile?.role);

  useEffect(() => { loadEvents(); }, []);

  const loadEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('capacity_events').select('*').order('start_date', { ascending: false });
    if (!error) setEvents(data || []);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    return events.filter(e => {
      if (typeFilter !== 'all' && e.event_type !== typeFilter) return false;
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return e.title?.toLowerCase().includes(q) || e.trainer_name?.toLowerCase().includes(q) || e.location_name?.toLowerCase().includes(q) || e.city?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [events, search, typeFilter, statusFilter]);

  // KPI'lar
  const stats = useMemo(() => ({
    total: events.length,
    completed: events.filter(e => e.status === 'completed').length,
    planned: events.filter(e => e.status === 'planned').length,
    participants: events.reduce((s, e) => s + (e.actual_participants || 0), 0),
    certificates: events.reduce((s, e) => s + (e.certificate_count || 0), 0),
  }), [events]);

  const handleSaved = () => {
    setFormMode(null);
    loadEvents();
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="loading-spinner" /></div>;

  if (formMode) {
    return (
      <div>
        <div className="page-header"><h1 className="page-title">📚 Kapasite Geliştirme</h1></div>
        <EventForm
          event={formMode === 'create' ? null : formMode}
          user={user} profile={profile}
          onSaved={handleSaved}
          onCancel={() => setFormMode(null)}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h1 className="page-title">📚 Kapasite Geliştirme</h1>
        {canEdit && <button className="btn btn-primary" onClick={() => setFormMode('create')}>+ Yeni Etkinlik</button>}
      </div>

      {/* KPI Kartları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
        <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label">Toplam Etkinlik</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: '#16a34a' }}>{stats.completed}</div><div className="stat-label">Tamamlanan</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: '#d97706' }}>{stats.planned}</div><div className="stat-label">Planlanan</div></div>
        <div className="stat-card"><div className="stat-value">{stats.participants}</div><div className="stat-label">Toplam Katılımcı</div></div>
        <div className="stat-card"><div className="stat-value">{stats.certificates}</div><div className="stat-label">📜 Sertifika</div></div>
      </div>

      {/* Filtreler */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input className="form-input" placeholder="🔍 Ara..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 220 }} />
        <select className="form-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="all">Tüm Türler</option>
          {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="all">Tüm Durumlar</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
      </div>

      {/* Dikey Poster Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Henüz etkinlik yok</div>
          {canEdit && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setFormMode('create')}>İlk Etkinliği Oluştur</button>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {filtered.map(e => <PosterCard key={e.id} event={e} onClick={() => setSelectedEvent(e)} />)}
        </div>
      )}

      {/* Detay Modal */}
      {selectedEvent && (
        <DetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          canEdit={canEdit}
          onEdit={(ev) => { setSelectedEvent(null); setFormMode(ev); }}
        />
      )}
    </div>
  );
}
