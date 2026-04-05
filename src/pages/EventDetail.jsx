import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { WORLD_COUNTRIES } from '../lib/worldData';
import {
  EVENT_TYPES, EVENT_STATUS, LOCATION_TYPES, PARTICIPANT_ROLES,
} from './Events';

// ── Türkiye şehirleri (autocomplete için) ────────────────────────────────────
const TR_CITIES = [
  'Adana','Adıyaman','Afyonkarahisar','Ağrı','Aksaray','Amasya','Ankara','Antalya','Ardahan',
  'Artvin','Aydın','Balıkesir','Bartın','Batman','Bayburt','Bilecik','Bingöl','Bitlis',
  'Bolu','Burdur','Bursa','Çanakkale','Çankırı','Çorum','Denizli','Diyarbakır','Düzce',
  'Edirne','Elazığ','Erzincan','Erzurum','Eskişehir','Gaziantep','Giresun','Gümüşhane',
  'Hakkari','Hatay','Iğdır','Isparta','İstanbul','İzmir','Kahramanmaraş','Karabük',
  'Karaman','Kars','Kastamonu','Kayseri','Kilis','Kırıkkale','Kırklareli','Kırşehir',
  'Kocaeli','Konya','Kütahya','Malatya','Manisa','Mardin','Mersin','Muğla','Muş',
  'Nevşehir','Niğde','Ordu','Osmaniye','Rize','Sakarya','Samsun','Şanlıurfa','Siirt',
  'Sinop','Sivas','Şırnak','Tekirdağ','Tokat','Trabzon','Tunceli','Uşak','Van',
  'Yalova','Yozgat','Zonguldak',
];

// Uluslararası büyük şehirler
const INTL_CITIES = [
  'New York','Washington D.C.','Los Angeles','Chicago',
  'Londra','Paris','Berlin','Madrid','Roma','Amsterdam','Brüksel','Viyana','Cenevre','Zürih',
  'Moskova','Kiev','Varşova','Prag','Budapeşte','Bükreş','Sofya','Atina','Lizbon',
  'Dubai','Abu Dhabi','Riyad','Doha','Kuwait City','Beyrut','Amman','Kahire','Tunus',
  'Nairobi','Addis Ababa','Johannesburg','Lagos','Dakar','Accra',
  'Pekin','Tokyo','Seul','Singapur','Bangkok','Mumbai','Delhi','Dakka','Karaçi',
  'Cakarta','Manila','Kuala Lumpur',
  'Bağdat','Tahran','Kabul','Kamala','Mogadişu','Hartum','Sana',
  'New York (BM)','Cenevre (BM)','Viyana (BM)','Nairobi (BM)',
];

const DOC_TYPES = {
  document: 'Belge', report: 'Rapor',
  invitation: 'Davetiye', brief: 'Brief', presentation: 'Sunum',
};

// ── Küçük bileşenler ─────────────────────────────────────────────────────────
function Label({ children, required }) {
  return (
    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted,#6B7280)', letterSpacing: '0.04em', display: 'block', marginBottom: 5 }}>
      {String(children).toUpperCase()}
      {required && <span style={{ color: '#DC2626', marginLeft: 2 }}>*</span>}
    </label>
  );
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8,
  border: '1.5px solid var(--border,#E5E7EB)', background: 'var(--card-bg,#fff)',
  color: 'var(--text,#111)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
};
const taStyle = { ...inputStyle, resize: 'vertical', minHeight: 80 };

function Field({ children, style }) {
  return <div style={{ marginBottom: 18, ...style }}>{children}</div>;
}

function Panel({ children, style }) {
  return (
    <div style={{
      background: 'var(--card-bg,#fff)', border: '1px solid var(--border,#E5E7EB)',
      borderRadius: 12, padding: 22, marginBottom: 18, ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text,#111)' }}>{children}</h3>
      {action}
    </div>
  );
}

function Badge({ label, color, bg }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:600, color, background:bg }}>
      {label}
    </span>
  );
}

// ── Autocomplete Input ────────────────────────────────────────────────────────
function AutocompleteInput({ value, onChange, suggestions, placeholder, style: extraStyle }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(value || '');
  const ref = useRef(null);

  useEffect(() => { setQ(value || ''); }, [value]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = q.length < 1
    ? suggestions.slice(0, 8)
    : suggestions.filter(s => s.toLowerCase().includes(q.toLowerCase())).slice(0, 10);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={q}
        onChange={e => { setQ(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        style={{ ...inputStyle, ...extraStyle }}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
          background: 'var(--card-bg,#fff)', border: '1px solid var(--border,#E5E7EB)',
          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto',
          marginTop: 2,
        }}>
          {filtered.map((s, i) => (
            <div key={i}
              onMouseDown={() => { onChange(s); setQ(s); setOpen(false); }}
              style={{
                padding: '9px 14px', cursor: 'pointer', fontSize: 14,
                color: 'var(--text,#111)', borderBottom: i < filtered.length - 1 ? '1px solid var(--border,#E5E7EB)' : 'none',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg,#F9FAFB)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Ülke autocomplete (bayrak + isim)
function CountryAutocomplete({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(value || '');
  const ref = useRef(null);

  useEffect(() => { setQ(value || ''); }, [value]);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = q.length < 1
    ? WORLD_COUNTRIES.slice(0, 8)
    : WORLD_COUNTRIES.filter(c => c.value.toLowerCase().includes(q.toLowerCase())).slice(0, 10);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={q}
        onChange={e => { setQ(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Ülke ara…"
        style={inputStyle}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
          background: 'var(--card-bg,#fff)', border: '1px solid var(--border,#E5E7EB)',
          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto', marginTop: 2,
        }}>
          {filtered.map((c, i) => (
            <div key={i}
              onMouseDown={() => { onChange(c.value); setQ(c.value); setOpen(false); }}
              style={{
                padding: '9px 14px', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
                color: 'var(--text,#111)', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg,#F9FAFB)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span>{c.flag}</span><span>{c.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Cover Image Upload ────────────────────────────────────────────────────────
function CoverImageUpload({ eventId, currentUrl, onUploaded, isNew }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentUrl || null);
  const fileRef = useRef(null);

  useEffect(() => { setPreview(currentUrl || null); }, [currentUrl]);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Önizleme
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target.result);
    reader.readAsDataURL(file);

    if (isNew) {
      // Yeni etkinlikte upload sonrası döneceğiz — parent'a dosyayı ver
      onUploaded(file, null); // file verilir, url henüz yok
      return;
    }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${eventId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('event-covers').upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('event-covers').getPublicUrl(path);
      await supabase.from('events').update({ cover_image_url: publicUrl }).eq('id', eventId);
      onUploaded(null, publicUrl);
    }
    setUploading(false);
  };

  const handleRemove = async () => {
    setPreview(null);
    if (!isNew && eventId) {
      await supabase.from('events').update({ cover_image_url: null }).eq('id', eventId);
    }
    onUploaded(null, null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div>
      {preview ? (
        <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
          <img src={preview} alt="Kapak" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
            <button onClick={() => fileRef.current?.click()} style={imgBtn}>✏️ Değiştir</button>
            <button onClick={handleRemove} style={{ ...imgBtn, background: 'rgba(220,38,38,0.85)' }}>✕</button>
          </div>
          {uploading && (
            <div style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700 }}>
              Yükleniyor…
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            border: '2px dashed var(--border,#E5E7EB)', borderRadius: 10, padding: '28px 20px',
            textAlign: 'center', cursor: 'pointer', color: 'var(--text-muted,#6B7280)', fontSize: 13,
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--navy,#1A3C5E)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border,#E5E7EB)'}
        >
          <div style={{ fontSize: 28, marginBottom: 6 }}>🖼️</div>
          <div style={{ fontWeight: 600 }}>Kapak görseli ekle</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>JPG, PNG, WEBP · Maks 5 MB</div>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
    </div>
  );
}

const imgBtn = {
  padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
  background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 12, fontWeight: 600,
};

// ── Katılımcı Satırı ──────────────────────────────────────────────────────────
function ParticipantRow({ p, onRemove, onToggleConfirm, onChangeRole }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
      borderRadius: 8, background: 'var(--bg,#F9FAFB)', border: '1px solid var(--border)',
      marginBottom: 8,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%', background: 'var(--navy,#1A3C5E)',
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
      <select value={p.role || 'attendee'} onChange={e => onChangeRole(p.id, e.target.value)} style={{
        padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
        background: 'var(--card-bg)', fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none',
        color: { organizer:'#7C3AED', speaker:'#0369A1', attendee:'#059669', observer:'#6B7280' }[p.role] || '#6B7280',
      }}>
        {Object.entries(PARTICIPANT_ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <button onClick={() => onToggleConfirm(p.id, !p.confirmed)} style={{
        width: 28, height: 28, borderRadius: '50%', border: '2px solid',
        borderColor: p.confirmed ? '#059669' : '#D1D5DB',
        background: p.confirmed ? '#ECFDF5' : 'transparent',
        color: p.confirmed ? '#059669' : '#D1D5DB',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', fontSize: 14, flexShrink: 0,
      }} title={p.confirmed ? 'Onaylı — geri al' : 'Onay ver'}>✓</button>
      <button onClick={() => onRemove(p.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'#DC2626',fontSize:16,padding:2 }}>✕</button>
    </div>
  );
}

// ── Aktivite Logu ─────────────────────────────────────────────────────────────
function ActivityLog({ eventId, refresh }) {
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    if (!eventId) return;
    (async () => {
      const { data } = await supabase.from('event_activity_log')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(40);
      if (!data) return;
      const ids = [...new Set(data.map(l => l.user_id).filter(Boolean))];
      let nameMap = {};
      if (ids.length) {
        const { data: profiles } = await supabase.from('user_profiles').select('user_id,full_name').in('user_id', ids);
        (profiles || []).forEach(p => { nameMap[p.user_id] = p.full_name; });
      }
      setLogs(data.map(l => ({ ...l, _name: nameMap[l.user_id] || 'Sistem' })));
    })();
  }, [eventId, refresh]);

  if (!logs.length) return <div style={{ fontSize:13,color:'var(--text-muted)',textAlign:'center',padding:20 }}>Henüz aktivite yok.</div>;
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
      {logs.map(l => (
        <div key={l.id} style={{ display:'flex',gap:10,alignItems:'flex-start' }}>
          <div style={{ width:8,height:8,borderRadius:'50%',background:'var(--navy)',marginTop:5,flexShrink:0 }} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13,color:'var(--text)' }}>
              <span style={{ fontWeight:600 }}>{l._name}</span>
              {' '}{l.action}
              {l.detail && <span style={{ color:'var(--text-muted)' }}> — {l.detail}</span>}
            </div>
            <div style={{ fontSize:11,color:'var(--text-muted)',marginTop:2 }}>
              {new Date(l.created_at).toLocaleString('tr-TR')}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ANA BİLEŞEN
// ══════════════════════════════════════════════════════════════════════════════
export default function EventDetail({ event, user, profile, onClose, onSaved }) {
  const isNew = !event;
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('info');

  const [form, setForm] = useState({
    title: '', description: '', event_type: 'conference', status: 'planned',
    location_name: '', location_type: 'on_site', country: '', city: '',
    start_date: '', end_date: '', start_time: '', end_time: '',
    unit: '', owner_id: '', budget: '', budget_currency: 'TRY',
    objectives: '', outcomes: '', notes: '', cover_image_url: '',
    website_url: '', registration_deadline: '', registration_link: '',
  });

  // Veritabanından yüklenen listeler
  const [allPersonnel, setAllPersonnel] = useState([]);   // { user_id, full_name, unit }
  const [allUnits, setAllUnits] = useState([]);            // distinct unit strings
  const [unitOpen, setUnitOpen] = useState(false);
  const unitRef = useRef(null);

  // Görsel (yeni etkinlik için File objesi tutulur)
  const [pendingImageFile, setPendingImageFile] = useState(null);

  // Katılımcılar
  const [participants, setParticipants] = useState([]);
  const [addMode, setAddMode] = useState('internal');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [extName, setExtName] = useState('');
  const [extOrg, setExtOrg] = useState('');
  const [addingP, setAddingP] = useState(false);

  // Dokümanlar
  const [docs, setDocs] = useState([]);
  const [docTitle, setDocTitle] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [docType, setDocType] = useState('document');
  const [addingDoc, setAddingDoc] = useState(false);

  const [logRefresh, setLogRefresh] = useState(0);

  // Notlar (çok kullanıcılı)
  const [eventNotes, setEventNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const noteTextRef = useRef(null);

  const loadEventNotes = async (eid) => {
    if (!eid) return;
    const { data } = await supabase
      .from('event_notes')
      .select('*')
      .eq('event_id', eid)
      .order('created_at', { ascending: true });
    if (!data) return;
    const ids = [...new Set(data.map(n => n.user_id).filter(Boolean))];
    let profileMap = {};
    if (ids.length) {
      const { data: profiles } = await supabase.from('user_profiles').select('user_id,full_name,unit').in('user_id', ids);
      (profiles || []).forEach(p => { profileMap[p.user_id] = p; });
    }
    setEventNotes(data.map(n => ({
      ...n,
      user_profiles: profileMap[n.user_id] || null,
    })));
  };

  const saveEventNote = async () => {
    const content = noteText.trim();
    if (!content || !event?.id) return;
    setNoteSaving(true);
    await supabase.from('event_notes').insert({
      event_id: event.id,
      user_id: user?.id,
      content,
    });
    setNoteText('');
    setNoteSaving(false);
    loadEventNotes(event.id);
    noteTextRef.current?.focus();
  };

  // Personel + birim listesini yükle
  useEffect(() => {
    supabase.from('user_profiles').select('user_id, full_name, unit').order('full_name')
      .then(({ data }) => {
        const pList = data || [];
        setAllPersonnel(pList);
        const units = [...new Set(pList.map(p => p.unit).filter(Boolean))].sort();
        setAllUnits(units);
      });
  }, []);

  // Dışarıya tıklayınca birim dropdown kapat
  useEffect(() => {
    const h = e => { if (unitRef.current && !unitRef.current.contains(e.target)) setUnitOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Mevcut event yükle
  useEffect(() => {
    if (!event) return;
    setForm({
      title: event.title || '',
      description: event.description || '',
      event_type: event.event_type || 'conference',
      status: event.status || 'planned',
      location_name: event.location_name || '',
      location_type: event.location_type || 'on_site',
      country: event.country || '',
      city: event.city || '',
      start_date: event.start_date || '',
      end_date: event.end_date || '',
      start_time: event.start_time || '',
      end_time: event.end_time || '',
      unit: event.unit || '',
      owner_id: event.owner_id || '',
      budget: event.budget || '',
      budget_currency: event.budget_currency || 'TRY',
      objectives: event.objectives || '',
      outcomes: event.outcomes || '',
      notes: event.notes || '',
      cover_image_url: event.cover_image_url || '',
      website_url: event.website_url || '',
      registration_deadline: event.registration_deadline || '',
      registration_link: event.registration_link || '',
    });
    loadParticipants(event.id);
    loadDocuments(event.id);
    loadEventNotes(event.id);
  }, [event]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const loadParticipants = async (eid) => {
    if (!eid) return;
    const { data } = await supabase
      .from('event_participants')
      .select('*')
      .eq('event_id', eid)
      .order('created_at');
    if (!data) return;
    const ids = [...new Set(data.map(p => p.user_id).filter(Boolean))];
    let profileMap = {};
    if (ids.length) {
      const { data: profiles } = await supabase.from('user_profiles').select('user_id,full_name,unit').in('user_id', ids);
      (profiles || []).forEach(p => { profileMap[p.user_id] = p; });
    }
    setParticipants(data.map(p => ({
      ...p,
      full_name: profileMap[p.user_id]?.full_name || null,
      unit: profileMap[p.user_id]?.unit || null,
    })));
  };

  const loadDocuments = async (eid) => {
    if (!eid) return;
    const { data } = await supabase.from('event_documents').select('*').eq('event_id', eid).order('created_at');
    setDocs(data || []);
  };

  const logActivity = async (eid, action, detail) => {
    await supabase.from('event_activity_log').insert({ event_id: eid, user_id: user.id, action, detail });
    setLogRefresh(r => r + 1);
  };

  // ── Kaydet ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.title.trim() || !form.start_date) return;
    setSaving(true);

    // Boş string → null dönüşümü (date/time/uuid alanları için zorunlu)
    const nullIfEmpty = (v) => (v === '' || v === undefined ? null : v);

    const payload = {
      title:           form.title.trim(),
      description:     nullIfEmpty(form.description),
      event_type:      form.event_type || 'conference',
      status:          form.status || 'planned',
      location_name:   nullIfEmpty(form.location_name),
      location_type:   nullIfEmpty(form.location_type),
      country:         nullIfEmpty(form.country),
      city:            nullIfEmpty(form.city),
      start_date:      form.start_date,
      end_date:        nullIfEmpty(form.end_date),
      start_time:      nullIfEmpty(form.start_time),
      end_time:        nullIfEmpty(form.end_time),
      unit:            nullIfEmpty(form.unit),
      owner_id:        nullIfEmpty(form.owner_id) || user?.id || null,
      budget:          form.budget ? parseFloat(form.budget) : null,
      budget_currency: form.budget_currency || 'TRY',
      objectives:      nullIfEmpty(form.objectives),
      outcomes:        nullIfEmpty(form.outcomes),
      notes:           nullIfEmpty(form.notes),
      cover_image_url:        nullIfEmpty(form.cover_image_url),
      website_url:            nullIfEmpty(form.website_url),
      registration_deadline:  nullIfEmpty(form.registration_deadline),
      registration_link:      nullIfEmpty(form.registration_link),
      created_by:             event?.created_by || user?.id || null,
    };

    let eventId = event?.id;

    if (isNew) {
      // Önce görseli yükle (varsa)
      if (pendingImageFile) {
        const ext = pendingImageFile.name.split('.').pop();
        const path = `tmp_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('event-covers').upload(path, pendingImageFile, { upsert: true });
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('event-covers').getPublicUrl(path);
          payload.cover_image_url = publicUrl;
        }
      }
      const { data, error: insertErr } = await supabase.from('events').insert(payload).select().single();
      if (insertErr) { console.error('Event insert error:', insertErr); setSaving(false); alert('Kayıt hatası: ' + insertErr.message); return; }
      eventId = data?.id;
      if (eventId) {
        // Eğer görsel temp path ile yüklendiyse event ID'li path'e taşı (upsert)
        if (pendingImageFile && payload.cover_image_url) {
          const ext = pendingImageFile.name.split('.').pop();
          const newPath = `${eventId}/${Date.now()}.${ext}`;
          await supabase.storage.from('event-covers').move(
            payload.cover_image_url.split('/event-covers/')[1],
            newPath
          );
          const { data: { publicUrl } } = supabase.storage.from('event-covers').getPublicUrl(newPath);
          await supabase.from('events').update({ cover_image_url: publicUrl }).eq('id', eventId);
        }
        await logActivity(eventId, 'etkinliği oluşturdu');
      }
    } else {
      await supabase.from('events').update(payload).eq('id', event.id);
      await logActivity(event.id, 'etkinliği güncelledi');
    }

    setSaving(false);
    onSaved?.();
    if (isNew) onClose();
  };

  // ── Katılımcı işlemleri ───────────────────────────────────────────────────
  const handleAddInternal = async () => {
    if (!selectedUserId || !event?.id) return;
    setAddingP(true);
    if (!participants.find(p => p.user_id === selectedUserId)) {
      await supabase.from('event_participants').insert({ event_id: event.id, user_id: selectedUserId, role: 'attendee' });
      const person = allPersonnel.find(p => p.user_id === selectedUserId);
      await logActivity(event.id, 'katılımcı ekledi', person?.full_name);
      await loadParticipants(event.id);
    }
    setSelectedUserId('');
    setAddingP(false);
  };

  const handleAddExternal = async () => {
    if (!extName.trim() || !event?.id) return;
    setAddingP(true);
    await supabase.from('event_participants').insert({
      event_id: event.id, external_name: extName, external_org: extOrg, role: 'attendee',
    });
    await logActivity(event.id, 'dış katılımcı ekledi', `${extName}${extOrg ? ` (${extOrg})` : ''}`);
    await loadParticipants(event.id);
    setExtName(''); setExtOrg('');
    setAddingP(false);
  };

  const handleRemoveParticipant = async (pid) => {
    const p = participants.find(x => x.id === pid);
    await supabase.from('event_participants').delete().eq('id', pid);
    await logActivity(event.id, 'katılımcıyı çıkardı', p?.full_name || p?.external_name);
    await loadParticipants(event.id);
  };

  const handleToggleConfirm = async (pid, confirmed) => {
    await supabase.from('event_participants').update({ confirmed }).eq('id', pid);
    await loadParticipants(event.id);
  };

  const handleChangeRole = async (pid, role) => {
    await supabase.from('event_participants').update({ role }).eq('id', pid);
    await loadParticipants(event.id);
  };

  // ── Doküman işlemleri ─────────────────────────────────────────────────────
  const handleAddDoc = async () => {
    if (!docTitle.trim() || !event?.id) return;
    setAddingDoc(true);
    await supabase.from('event_documents').insert({
      event_id: event.id, title: docTitle, url: docUrl || null,
      doc_type: docType, uploaded_by: user.id,
    });
    await logActivity(event.id, 'döküman ekledi', docTitle);
    await loadDocuments(event.id);
    setDocTitle(''); setDocUrl(''); setDocType('document');
    setAddingDoc(false);
  };

  const handleRemoveDoc = async (docId, title) => {
    await supabase.from('event_documents').delete().eq('id', docId);
    await logActivity(event.id, 'dökümanı sildi', title);
    await loadDocuments(event.id);
  };

  // ── Görsel callback ───────────────────────────────────────────────────────
  const handleImageUpdate = (file, url) => {
    if (file) setPendingImageFile(file);            // yeni etkinlik
    if (url !== undefined) set('cover_image_url', url || '');
  };

  // ── Şehir önerileri (ülkeye göre) ────────────────────────────────────────
  const citySuggestions = form.country === 'Türkiye'
    ? TR_CITIES
    : form.country
      ? INTL_CITIES
      : [...TR_CITIES, ...INTL_CITIES];

  const typeCfg = EVENT_TYPES[form.event_type] || {};
  const statusCfg = EVENT_STATUS[form.status] || {};
  const availablePersonnel = allPersonnel.filter(p => !participants.find(x => x.user_id === p.user_id));
  const ownerProfile = allPersonnel.find(p => p.user_id === form.owner_id);

  // ── Birim autocomplete filtresi ───────────────────────────────────────────
  const filteredUnits = allUnits.filter(u =>
    !form.unit || u.toLowerCase().includes(form.unit.toLowerCase())
  );

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Üst bar */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <button onClick={onClose} style={{ background:'none', border:'1px solid var(--border)', borderRadius:8, padding:'7px 14px', cursor:'pointer', color:'var(--text)', fontSize:13 }}>
          ← Geri
        </button>
        <div style={{ flex:1 }}>
          <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:'var(--text)' }}>
            {isNew ? 'Yeni Etkinlik' : form.title || 'Etkinlik Detayı'}
          </h1>
          {!isNew && (
            <div style={{ display:'flex', gap:8, marginTop:6 }}>
              <Badge label={typeCfg.label} color={typeCfg.color} bg={typeCfg.bg} />
              <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />
            </div>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !form.title.trim() || !form.start_date}
          style={{
            padding:'10px 22px', borderRadius:10, border:'none', cursor:'pointer',
            background:'var(--navy,#1A3C5E)', color:'#fff', fontWeight:700, fontSize:14,
            opacity: saving || !form.title.trim() || !form.start_date ? 0.5 : 1,
          }}
        >
          {saving ? 'Kaydediliyor…' : isNew ? 'Oluştur' : 'Kaydet'}
        </button>
      </div>

      {/* Sekmeler */}
      {!isNew && (
        <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:'2px solid var(--border)' }}>
          {[
            ['info','📋 Bilgiler'],
            ['participants',`👥 Katılımcılar (${participants.length})`],
            ['documents',`📄 Dokümanlar (${docs.length})`],
            ['notes', `💬 Notlar${eventNotes.length ? ` (${eventNotes.length})` : ''}`],
            ['log','🕒 Aktivite'],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{
              padding:'10px 18px', border:'none', cursor:'pointer', background:'none',
              fontWeight: activeTab===id ? 700 : 400,
              color: activeTab===id ? 'var(--navy,#1A3C5E)' : 'var(--text-muted)',
              borderBottom: activeTab===id ? '2px solid var(--navy,#1A3C5E)' : '2px solid transparent',
              marginBottom:-2, fontSize:14,
            }}>{label}</button>
          ))}
        </div>
      )}

      {/* ── BİLGİLER ────────────────────────────────────────────────────────── */}
      {(isNew || activeTab === 'info') && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:18 }}>
          {/* Sol */}
          <div>
            <Panel>
              <SectionTitle>Temel Bilgiler</SectionTitle>
              <Field>
                <Label required>Etkinlik Adı</Label>
                <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Etkinlik adını girin" style={inputStyle} />
              </Field>
              <Field>
                <Label>Açıklama</Label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Etkinliği kısaca tanımlayın…" style={taStyle} />
              </Field>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <Field>
                  <Label>Etkinlik Tipi</Label>
                  <select value={form.event_type} onChange={e => set('event_type', e.target.value)} style={inputStyle}>
                    {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </Field>
                <Field>
                  <Label>Durum</Label>
                  <select value={form.status} onChange={e => set('status', e.target.value)} style={inputStyle}>
                    {Object.entries(EVENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </Field>
              </div>
            </Panel>

            <Panel>
              <SectionTitle>Tarih & Saat</SectionTitle>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <Field>
                  <Label required>Başlangıç Tarihi</Label>
                  <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} style={inputStyle} />
                </Field>
                <Field>
                  <Label>Bitiş Tarihi</Label>
                  <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} style={inputStyle} />
                </Field>
                <Field>
                  <Label>Başlangıç Saati</Label>
                  <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} style={inputStyle} />
                </Field>
                <Field>
                  <Label>Bitiş Saati</Label>
                  <input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} style={inputStyle} />
                </Field>
              </div>
            </Panel>

            <Panel>
              <SectionTitle>Hedefler & Sonuçlar</SectionTitle>
              <Field>
                <Label>Hedefler</Label>
                <textarea value={form.objectives} onChange={e => set('objectives', e.target.value)} placeholder="Bu etkinlikle neye ulaşmak istiyoruz?" style={taStyle} />
              </Field>
              <Field>
                <Label>Çıktılar / Sonuçlar</Label>
                <textarea value={form.outcomes} onChange={e => set('outcomes', e.target.value)} placeholder="Elde edilen somut çıktılar…" style={{ ...taStyle, marginBottom:0 }} />
              </Field>
            </Panel>
          </div>

          {/* Sağ */}
          <div>
            {/* Kapak görseli */}
            <Panel>
              <SectionTitle>Kapak Görseli</SectionTitle>
              <CoverImageUpload
                eventId={event?.id}
                currentUrl={form.cover_image_url}
                onUploaded={handleImageUpdate}
                isNew={isNew}
              />
            </Panel>

            {/* Lokasyon */}
            <Panel>
              <SectionTitle>Lokasyon</SectionTitle>
              <Field>
                <Label>Lokasyon Tipi</Label>
                <select value={form.location_type} onChange={e => set('location_type', e.target.value)} style={inputStyle}>
                  {Object.entries(LOCATION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field>
                <Label>Ülke</Label>
                <CountryAutocomplete value={form.country} onChange={v => { set('country', v); set('city', ''); }} />
              </Field>
              <Field>
                <Label>Şehir</Label>
                <AutocompleteInput
                  value={form.city}
                  onChange={v => set('city', v)}
                  suggestions={citySuggestions}
                  placeholder="Şehir ara…"
                />
              </Field>
              <Field>
                <Label>Mekan / Platform</Label>
                <input value={form.location_name} onChange={e => set('location_name', e.target.value)} placeholder="Otel, salon, online link…" style={inputStyle} />
              </Field>
            </Panel>

            {/* Organizasyon */}
            <Panel>
              <SectionTitle>Organizasyon</SectionTitle>
              {/* Sorumlu Birim */}
              <Field>
                <Label>Sorumlu Birim</Label>
                <div ref={unitRef} style={{ position:'relative' }}>
                  <input
                    value={form.unit}
                    onChange={e => { set('unit', e.target.value); setUnitOpen(true); }}
                    onFocus={() => setUnitOpen(true)}
                    placeholder="Birim seç veya yaz…"
                    style={inputStyle}
                    autoComplete="off"
                  />
                  {unitOpen && filteredUnits.length > 0 && (
                    <div style={{
                      position:'absolute', top:'100%', left:0, right:0, zIndex:999,
                      background:'var(--card-bg,#fff)', border:'1px solid var(--border)',
                      borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.12)', maxHeight:180, overflowY:'auto', marginTop:2,
                    }}>
                      {filteredUnits.map((u, i) => (
                        <div key={i}
                          onMouseDown={() => { set('unit', u); setUnitOpen(false); }}
                          style={{ padding:'9px 14px', cursor:'pointer', fontSize:14, color:'var(--text)', borderBottom: i < filteredUnits.length-1 ? '1px solid var(--border)' : 'none' }}
                          onMouseEnter={e => e.currentTarget.style.background='var(--bg,#F9FAFB)'}
                          onMouseLeave={e => e.currentTarget.style.background='transparent'}
                        >{u}</div>
                      ))}
                    </div>
                  )}
                </div>
              </Field>

              {/* Sorumlu Personel */}
              <Field>
                <Label>Sorumlu Personel</Label>
                <select
                  value={form.owner_id}
                  onChange={e => set('owner_id', e.target.value)}
                  style={inputStyle}
                >
                  <option value="">— Personel seçin —</option>
                  {allPersonnel.map(p => (
                    <option key={p.user_id} value={p.user_id}>
                      {p.full_name}{p.unit ? ` (${p.unit})` : ''}
                    </option>
                  ))}
                </select>
                {ownerProfile && (
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:5 }}>
                    Seçili: <b>{ownerProfile.full_name}</b>{ownerProfile.unit ? ` · ${ownerProfile.unit}` : ''}
                  </div>
                )}
              </Field>
            </Panel>

            {/* Bütçe */}
            <Panel>
              <SectionTitle>Bütçe</SectionTitle>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:10 }}>
                <Field>
                  <Label>Tutar</Label>
                  <input type="number" value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="0" style={inputStyle} />
                </Field>
                <Field>
                  <Label>Para Birimi</Label>
                  <select value={form.budget_currency} onChange={e => set('budget_currency', e.target.value)} style={inputStyle}>
                    {['TRY','USD','EUR','GBP','CHF'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
            </Panel>

            {/* Web & Kayıt */}
            <Panel>
              <SectionTitle>Web & Kayıt</SectionTitle>
              <Field>
                <Label>Etkinlik Web Sitesi</Label>
                <input
                  type="url"
                  value={form.website_url}
                  onChange={e => set('website_url', e.target.value)}
                  placeholder="https://etkinlik.org"
                  style={inputStyle}
                />
              </Field>
              <Field>
                <Label>Son Kayıt Tarihi</Label>
                <input
                  type="date"
                  value={form.registration_deadline}
                  onChange={e => set('registration_deadline', e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field>
                <Label>Kayıt Linki</Label>
                <input
                  type="url"
                  value={form.registration_link}
                  onChange={e => set('registration_link', e.target.value)}
                  placeholder="https://kayit.etkinlik.org"
                  style={inputStyle}
                />
              </Field>
            </Panel>

            {/* Notlar */}
            <Panel>
              <SectionTitle>Notlar</SectionTitle>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="İç notlar, hatırlatmalar…" style={{ ...taStyle, marginBottom:0 }} />
            </Panel>
          </div>
        </div>
      )}

      {/* ── KATILIMCILAR ─────────────────────────────────────────────────────── */}
      {!isNew && activeTab === 'participants' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:18 }}>
          <Panel>
            <SectionTitle>
              Katılımcılar
              <span style={{ fontSize:12, color:'var(--text-muted)' }}>
                {participants.filter(p=>p.confirmed).length} / {participants.length} onaylı
              </span>
            </SectionTitle>
            {participants.length === 0 ? (
              <div style={{ textAlign:'center', padding:30, color:'var(--text-muted)', fontSize:13 }}>Henüz katılımcı eklenmedi.</div>
            ) : participants.map(p => (
              <ParticipantRow key={p.id} p={p}
                onRemove={handleRemoveParticipant}
                onToggleConfirm={handleToggleConfirm}
                onChangeRole={handleChangeRole}
              />
            ))}
          </Panel>

          <div>
            <Panel>
              <SectionTitle>Katılımcı Ekle</SectionTitle>
              <div style={{ display:'flex', gap:4, marginBottom:16, background:'var(--bg)', borderRadius:8, padding:3 }}>
                {[['internal','Personel'],['external','Dış Katılımcı']].map(([k,v]) => (
                  <button key={k} onClick={() => setAddMode(k)} style={{
                    flex:1, padding:'7px', borderRadius:6, border:'none', cursor:'pointer',
                    background: addMode===k ? 'var(--navy,#1A3C5E)' : 'transparent',
                    color: addMode===k ? '#fff' : 'var(--text-muted)',
                    fontWeight: addMode===k ? 700 : 400, fontSize:13,
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
                  <button onClick={handleAddInternal} disabled={!selectedUserId||addingP} style={addBtnStyle(!selectedUserId||addingP)}>
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
                  <button onClick={handleAddExternal} disabled={!extName.trim()||addingP} style={addBtnStyle(!extName.trim()||addingP)}>
                    {addingP ? 'Ekleniyor…' : '+ Dış Katılımcı Ekle'}
                  </button>
                </>
              )}
            </Panel>

            <Panel>
              <SectionTitle>Özet</SectionTitle>
              {Object.entries(PARTICIPANT_ROLES).map(([role, label]) => {
                const count = participants.filter(p => p.role === role).length;
                return count > 0 ? (
                  <div key={role} style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--text)', marginBottom:6 }}>
                    <span>{label}</span><span style={{ fontWeight:700 }}>{count}</span>
                  </div>
                ) : null;
              })}
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:8, marginTop:4, display:'flex', justifyContent:'space-between', fontSize:13, fontWeight:700 }}>
                <span>Toplam</span><span>{participants.length}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#059669', marginTop:4 }}>
                <span>Onaylanan</span><span style={{ fontWeight:700 }}>{participants.filter(p=>p.confirmed).length}</span>
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* ── DOKÜMANLAR ───────────────────────────────────────────────────────── */}
      {!isNew && activeTab === 'documents' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:18 }}>
          <Panel>
            <SectionTitle>Dokümanlar & Linkler</SectionTitle>
            {docs.length === 0 ? (
              <div style={{ textAlign:'center', padding:30, color:'var(--text-muted)', fontSize:13 }}>Henüz döküman eklenmedi.</div>
            ) : docs.map(d => (
              <div key={d.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:8, background:'var(--bg)', border:'1px solid var(--border)', marginBottom:8 }}>
                <span style={{ fontSize:20 }}>{{ document:'📄', report:'📊', invitation:'✉️', brief:'📋', presentation:'📑' }[d.doc_type]||'📄'}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:14, color:'var(--text)' }}>{d.title}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>{DOC_TYPES[d.doc_type]||d.doc_type}</div>
                </div>
                {d.url && <a href={d.url} target="_blank" rel="noreferrer" style={{ color:'var(--navy)', fontSize:13, fontWeight:600, textDecoration:'none' }}>Aç ↗</a>}
                <button onClick={() => handleRemoveDoc(d.id, d.title)} style={{ background:'none', border:'none', cursor:'pointer', color:'#DC2626', fontSize:16 }}>✕</button>
              </div>
            ))}
          </Panel>
          <Panel>
            <SectionTitle>Döküman Ekle</SectionTitle>
            <Field><Label required>Başlık</Label><input value={docTitle} onChange={e => setDocTitle(e.target.value)} placeholder="Döküman adı" style={inputStyle} /></Field>
            <Field><Label>Link (URL)</Label><input value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="https://…" style={inputStyle} /></Field>
            <Field>
              <Label>Tip</Label>
              <select value={docType} onChange={e => setDocType(e.target.value)} style={inputStyle}>
                {Object.entries(DOC_TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <button onClick={handleAddDoc} disabled={!docTitle.trim()||addingDoc} style={addBtnStyle(!docTitle.trim()||addingDoc)}>
              {addingDoc ? 'Ekleniyor…' : '+ Ekle'}
            </button>
          </Panel>
        </div>
      )}

      {/* ── NOTLAR (çok kullanıcılı) ─────────────────────────────────────────── */}
      {!isNew && activeTab === 'notes' && (
        <Panel>
          <SectionTitle>Notlar</SectionTitle>

          {/* Not akışı */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 0,
            maxHeight: 460, overflowY: 'auto',
            border: '1px solid var(--border)', borderRadius: 10,
            marginBottom: 16,
          }}>
            {eventNotes.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Henüz not düşülmedi. İlk notu sen ekle!
              </div>
            ) : (
              eventNotes.map((n, idx) => {
                const isMe = n.user_id === user?.id;
                const name = n.user_profiles?.full_name || 'Bilinmeyen';
                const unit = n.user_profiles?.unit;
                const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <div key={n.id} style={{
                    display: 'flex', gap: 12, padding: '14px 16px',
                    background: isMe ? 'rgba(26,60,94,0.03)' : 'transparent',
                    borderBottom: idx < eventNotes.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    {/* Avatar */}
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: isMe ? 'var(--navy,#1A3C5E)' : '#6B7280',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700,
                    }}>{initials}</div>

                    {/* İçerik */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                          {name}{isMe ? ' (sen)' : ''}
                        </span>
                        {unit && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--border)', borderRadius: 8, padding: '1px 7px' }}>
                            {unit}
                          </span>
                        )}
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', opacity: 0.7, whiteSpace: 'nowrap' }}>
                          {new Date(n.created_at).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {n.content}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Yeni not girişi */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea
              ref={noteTextRef}
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEventNote(); }
              }}
              placeholder="Bir not düş… (Enter ile gönder, Shift+Enter satır sonu)"
              rows={2}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 10,
                border: '1.5px solid var(--border)', fontSize: 13.5,
                lineHeight: 1.6, resize: 'none', outline: 'none',
                fontFamily: 'inherit', color: 'var(--text)',
                background: 'var(--bg,#F9FAFB)',
              }}
            />
            <button
              onClick={saveEventNote}
              disabled={noteSaving || !noteText.trim()}
              style={{
                padding: '10px 20px', borderRadius: 10, border: 'none',
                background: 'var(--navy,#1A3C5E)', color: '#fff',
                fontWeight: 700, fontSize: 14, cursor: 'pointer',
                opacity: noteSaving || !noteText.trim() ? 0.45 : 1,
                whiteSpace: 'nowrap', height: 44,
              }}
            >
              {noteSaving ? '⏳' : '↑ Gönder'}
            </button>
          </div>
        </Panel>
      )}

      {/* ── AKTİVİTE ─────────────────────────────────────────────────────────── */}
      {!isNew && activeTab === 'log' && (
        <Panel>
          <SectionTitle>Aktivite Logu</SectionTitle>
          <ActivityLog eventId={event?.id} refresh={logRefresh} />
        </Panel>
      )}
    </div>
  );
}

function addBtnStyle(disabled) {
  return {
    width:'100%', padding:'10px', borderRadius:8, border:'none', cursor:'pointer',
    background:'var(--navy,#1A3C5E)', color:'#fff', fontWeight:700, fontSize:14,
    opacity: disabled ? 0.5 : 1,
  };
}
