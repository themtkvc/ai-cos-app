import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { supabase, logActivity } from '../lib/supabase';

// ── Renk paleti (Google Keep tarzı) ──────────────────────────────────────────
const NOTE_COLORS = [
  { id: 'default',  bg: 'var(--bg-card)',  border: 'var(--border)', label: 'Varsayılan' },
  { id: 'red',      bg: '#fee2e2',  border: '#fca5a5', label: 'Kırmızı' },
  { id: 'orange',   bg: '#ffedd5',  border: '#fdba74', label: 'Turuncu' },
  { id: 'yellow',   bg: '#fef9c3',  border: '#fde047', label: 'Sarı' },
  { id: 'green',    bg: '#dcfce7',  border: '#86efac', label: 'Yeşil' },
  { id: 'teal',     bg: '#ccfbf1',  border: '#5eead4', label: 'Turkuaz' },
  { id: 'blue',     bg: 'var(--primary-light)',  border: '#93c5fd', label: 'Mavi' },
  { id: 'purple',   bg: '#ede9fe',  border: '#c4b5fd', label: 'Mor' },
  { id: 'pink',     bg: '#fce7f3',  border: '#f9a8d4', label: 'Pembe' },
  { id: 'brown',    bg: '#efebe9',  border: '#bcaaa4', label: 'Kahve' },
];

const getColor = (id) => NOTE_COLORS.find(c => c.id === id) || NOTE_COLORS[0];

// ── Kategori etiketleri ──────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = ['Toplantı', 'Proje', 'Kişisel', 'Fikir', 'Takip', 'Önemli'];

// ── View'lar ─────────────────────────────────────────────────────────────────
const VIEWS = {
  NOTES:     'notes',
  REMINDERS: 'reminders',
  ARCHIVE:   'archive',
  TRASH:     'trash',
};

const TRASH_RETENTION_DAYS = 30;

// ── Tarih yardımcıları ───────────────────────────────────────────────────────
function formatDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('tr-TR', sameYear
    ? { day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatReminder(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function toLocalDatetimeInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Toolbar (rich text) ──────────────────────────────────────────────────────
function Toolbar({ editorRef }) {
  const [activeHeading, setActiveHeading] = useState(null);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const headingRef = useRef(null);

  const exec = (cmd, val = null) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
  };

  const applyHeading = (tag) => {
    document.execCommand('formatBlock', false, tag);
    setActiveHeading(tag === '<p>' ? null : tag.replace(/[<>]/g, '').toUpperCase());
    setShowHeadingMenu(false);
    editorRef.current?.focus();
  };

  const checkHeading = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) { setActiveHeading(null); return; }
    const node = sel.anchorNode;
    const block = node?.nodeType === 3 ? node.parentElement : node;
    const tag = block?.closest?.('h1, h2, h3')?.tagName?.toLowerCase() || '';
    if (tag === 'h1') setActiveHeading('H1');
    else if (tag === 'h2') setActiveHeading('H2');
    else if (tag === 'h3') setActiveHeading('H3');
    else setActiveHeading(null);
  };

  useEffect(() => {
    document.addEventListener('selectionchange', checkHeading);
    return () => document.removeEventListener('selectionchange', checkHeading);
  }, []);

  useEffect(() => {
    if (!showHeadingMenu) return;
    const close = (e) => {
      if (headingRef.current && !headingRef.current.contains(e.target)) setShowHeadingMenu(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showHeadingMenu]);

  const HEADING_OPTIONS = [
    { tag: '<h1>', label: 'Başlık 1', preview: 'H1', style: { fontSize: 18, fontWeight: 800 } },
    { tag: '<h2>', label: 'Başlık 2', preview: 'H2', style: { fontSize: 16, fontWeight: 700 } },
    { tag: '<h3>', label: 'Başlık 3', preview: 'H3', style: { fontSize: 14, fontWeight: 600 } },
    { tag: '<p>',  label: 'Normal metin', preview: 'P', style: { fontSize: 13, fontWeight: 400 } },
  ];

  const btns = [
    { cmd: 'undo', icon: '↩', style: { fontSize: 15 }, title: 'Geri Al (Ctrl+Z)' },
    { cmd: 'redo', icon: '↪', style: { fontSize: 15 }, title: 'İleri Al (Ctrl+Y)' },
    null,
    { cmd: 'bold',          icon: 'B',    style: { fontWeight: 700 }, title: 'Kalın' },
    { cmd: 'italic',        icon: 'I',    style: { fontStyle: 'italic' }, title: 'İtalik' },
    { cmd: 'underline',     icon: 'U',    style: { textDecoration: 'underline' }, title: 'Altı çizili' },
    { cmd: 'strikeThrough', icon: 'S',    style: { textDecoration: 'line-through' }, title: 'Üstü çizili' },
    null,
    { cmd: '_heading_menu', isHeadingMenu: true },
    { cmd: 'insertUnorderedList', icon: '•', style: { fontSize: 16, lineHeight: 1 }, title: 'Madde listesi' },
    { cmd: 'insertOrderedList',   icon: '1.', style: { fontSize: 12, fontWeight: 600 }, title: 'Numaralı liste' },
  ];

  const toolBtnStyle = (extra = {}) => ({
    width: 28, height: 28, border: 'none', borderRadius: 6,
    background: 'transparent', cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 13,
    color: 'var(--text-secondary)', transition: 'background 0.1s',
    ...extra,
  });

  return (
    <div style={{ display: 'flex', gap: 2, padding: '6px 8px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center' }}>
      {btns.map((b, i) => {
        if (b === null) {
          return <div key={i} style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 4px', alignSelf: 'center' }} />;
        }

        if (b.isHeadingMenu) {
          return (
            <div key="heading-menu" ref={headingRef} style={{ position: 'relative' }}>
              <button
                title="Başlık seçenekleri"
                onMouseDown={e => { e.preventDefault(); setShowHeadingMenu(!showHeadingMenu); }}
                style={toolBtnStyle({
                  fontWeight: 700, gap: 2, width: 'auto', padding: '0 6px',
                  background: (activeHeading || showHeadingMenu) ? 'var(--bg-hover)' : 'transparent',
                  color: activeHeading ? 'var(--navy)' : 'var(--text-secondary)',
                })}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = (activeHeading || showHeadingMenu) ? 'var(--bg-hover)' : 'transparent'}
              >
                <span>{activeHeading || 'H'}</span>
                <span style={{ fontSize: 9, marginLeft: 1, opacity: 0.6 }}>▾</span>
              </button>

              {showHeadingMenu && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 4,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  padding: 4, zIndex: 100, minWidth: 160,
                }}>
                  {HEADING_OPTIONS.map(opt => {
                    const isActive = (activeHeading === opt.preview) || (!activeHeading && opt.tag === '<p>');
                    return (
                      <button key={opt.tag}
                        onMouseDown={e => { e.preventDefault(); applyHeading(opt.tag); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          width: '100%', padding: '8px 12px', border: 'none',
                          borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                          background: isActive ? 'var(--bg-hover)' : 'transparent',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = isActive ? 'var(--bg-hover)' : 'transparent'}
                      >
                        <span style={{ ...opt.style, color: 'var(--text)', lineHeight: 1.2 }}>{opt.label}</span>
                        {isActive && <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--navy)' }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        return (
          <button key={b.cmd + (b.val || '')} title={b.title}
            onMouseDown={e => { e.preventDefault(); exec(b.cmd, b.val); }}
            style={toolBtnStyle({ ...b.style, fontWeight: b.style?.fontWeight || 'normal', fontSize: b.style?.fontSize || 13 })}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >{b.icon}</button>
        );
      })}
    </div>
  );
}

// ── Checklist ────────────────────────────────────────────────────────────────
function Checklist({ items, onChange }) {
  const update = (idx, changes) => {
    const next = items.map((it, i) => i === idx ? { ...it, ...changes } : it);
    onChange(next);
  };
  const add = () => onChange([...items, { text: '', done: false }]);
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));

  return (
    <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Yapılacaklar
      </div>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <input type="checkbox" checked={it.done}
            onChange={e => update(i, { done: e.target.checked })}
            style={{ width: 16, height: 16, accentColor: 'var(--navy)', cursor: 'pointer', flexShrink: 0 }} />
          <input value={it.text}
            onChange={e => update(i, { text: e.target.value })}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); add(); }
              if (e.key === 'Backspace' && !it.text && items.length > 1) { e.preventDefault(); remove(i); }
            }}
            placeholder="Yeni madde..."
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 13, padding: '4px 0',
              background: 'transparent', color: 'var(--text)',
              textDecoration: it.done ? 'line-through' : 'none',
              opacity: it.done ? 0.5 : 1,
            }} />
          <button onClick={() => remove(i)}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)', padding: 2, lineHeight: 1, opacity: 0.5 }}
            onMouseEnter={e => e.currentTarget.style.opacity = 1}
            onMouseLeave={e => e.currentTarget.style.opacity = 0.5}
          >✕</button>
        </div>
      ))}
      <button onClick={add}
        style={{
          border: 'none', background: 'none', cursor: 'pointer', fontSize: 12.5,
          color: 'var(--text-muted)', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 4,
        }}>
        <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Madde ekle
      </button>
    </div>
  );
}

// ── Renk seçici ──────────────────────────────────────────────────────────────
function ColorPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '8px 12px', flexWrap: 'wrap' }}>
      {NOTE_COLORS.map(c => (
        <button key={c.id} title={c.label}
          onClick={() => onChange(c.id)}
          style={{
            width: 26, height: 26, borderRadius: '50%',
            border: value === c.id ? '2.5px solid var(--navy)' : `2px solid ${c.border}`,
            background: c.bg, cursor: 'pointer', transition: 'transform 0.1s',
            transform: value === c.id ? 'scale(1.15)' : 'scale(1)',
          }}
          onMouseEnter={e => { if (value !== c.id) e.currentTarget.style.transform = 'scale(1.1)'; }}
          onMouseLeave={e => { if (value !== c.id) e.currentTarget.style.transform = 'scale(1)'; }}
        />
      ))}
    </div>
  );
}

// ── Kategori seçici ──────────────────────────────────────────────────────────
function CategoryPicker({ value, onChange, categories }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '4px 12px 8px', flexWrap: 'wrap' }}>
      {categories.map(cat => (
        <button key={cat} onClick={() => onChange(value === cat ? '' : cat)}
          style={{
            padding: '3px 10px', borderRadius: 12, fontSize: 11.5, fontWeight: 500,
            border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.1s',
            background: value === cat ? 'var(--navy)' : 'var(--bg-hover)',
            color: value === cat ? '#fff' : 'var(--text-secondary)',
          }}>
          {cat}
        </button>
      ))}
    </div>
  );
}

// ── Label picker popover ─────────────────────────────────────────────────────
function LabelPopover({ allLabels, selectedIds, onToggle, onCreate, onClose, anchor = 'bottom' }) {
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const off = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', off);
    return () => document.removeEventListener('mousedown', off);
  }, [onClose]);

  const filtered = allLabels.filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()));
  const exactMatch = allLabels.some(l => l.name.toLowerCase() === search.trim().toLowerCase());

  return (
    <div ref={ref} style={{
      position: 'absolute', [anchor === 'top' ? 'bottom' : 'top']: '100%', left: 0,
      marginTop: anchor === 'top' ? 0 : 6, marginBottom: anchor === 'top' ? 6 : 0,
      zIndex: 200, minWidth: 240, background: 'var(--bg-card)',
      border: '1px solid var(--border)', borderRadius: 10,
      boxShadow: '0 8px 24px rgba(0,0,0,0.14)', padding: 6,
    }}>
      <div style={{ padding: '4px 6px', fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Etikete göre etiketle
      </div>
      <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Etiket ara veya oluştur"
        style={{
          width: '100%', boxSizing: 'border-box', padding: '6px 8px', fontSize: 12.5,
          border: '1px solid var(--border)', borderRadius: 6, outline: 'none',
          background: 'var(--bg-hover)', color: 'var(--text)', marginBottom: 4,
        }} />
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {filtered.map(l => (
          <label key={l.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <input type="checkbox" checked={selectedIds.includes(l.id)}
              onChange={() => onToggle(l)}
              style={{ width: 14, height: 14, accentColor: 'var(--navy)' }} />
            <span style={{ flex: 1, color: 'var(--text)' }}>{l.name}</span>
          </label>
        ))}
        {filtered.length === 0 && !search && (
          <div style={{ padding: '10px 8px', fontSize: 12, color: 'var(--text-muted)' }}>
            Henüz etiket yok.
          </div>
        )}
      </div>
      {search.trim() && !exactMatch && (
        <button onClick={() => { onCreate(search.trim()); setSearch(''); }}
          style={{
            width: '100%', textAlign: 'left', padding: '7px 8px', borderRadius: 6,
            border: 'none', background: 'var(--bg-hover)', cursor: 'pointer',
            fontSize: 12.5, color: 'var(--navy)', marginTop: 4, fontWeight: 600,
          }}>
          + Yeni etiket oluştur: "{search.trim()}"
        </button>
      )}
    </div>
  );
}

// ── Reminder picker popover ──────────────────────────────────────────────────
function ReminderPopover({ value, onChange, onClose, anchor = 'bottom' }) {
  const [custom, setCustom] = useState(toLocalDatetimeInput(value) || '');
  const ref = useRef(null);

  useEffect(() => {
    const off = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', off);
    return () => document.removeEventListener('mousedown', off);
  }, [onClose]);

  const presets = [
    { label: 'Bugün akşam 18:00', getDate: () => { const d = new Date(); d.setHours(18,0,0,0); return d; } },
    { label: 'Yarın sabah 09:00', getDate: () => { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(9,0,0,0); return d; } },
    { label: 'Gelecek hafta Pzt 09:00', getDate: () => {
        const d = new Date(); const day = d.getDay(); const diff = (8 - day) % 7 || 7;
        d.setDate(d.getDate() + diff); d.setHours(9,0,0,0); return d;
      } },
  ];

  return (
    <div ref={ref} style={{
      position: 'absolute', [anchor === 'top' ? 'bottom' : 'top']: '100%', left: 0,
      marginTop: anchor === 'top' ? 0 : 6, marginBottom: anchor === 'top' ? 6 : 0,
      zIndex: 200, minWidth: 260, background: 'var(--bg-card)',
      border: '1px solid var(--border)', borderRadius: 10,
      boxShadow: '0 8px 24px rgba(0,0,0,0.14)', padding: 6,
    }}>
      <div style={{ padding: '4px 6px', fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Hatırlat
      </div>
      {presets.map(p => (
        <button key={p.label} onClick={() => { onChange(p.getDate().toISOString()); onClose(); }}
          style={{
            display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
            borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 13, color: 'var(--text)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          {p.label}
        </button>
      ))}
      <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', marginTop: 4 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Özel tarih/saat seç</div>
        <input type="datetime-local" value={custom} onChange={e => setCustom(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '6px 8px', fontSize: 12.5,
            border: '1px solid var(--border)', borderRadius: 6, outline: 'none',
            background: 'var(--bg-hover)', color: 'var(--text)',
          }} />
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          {value && (
            <button onClick={() => { onChange(null); onClose(); }}
              style={{ ...secondaryBtnStyle, flex: 1, padding: '6px 10px', fontSize: 12 }}>
              Kaldır
            </button>
          )}
          <button onClick={() => {
              if (!custom) return;
              onChange(new Date(custom).toISOString());
              onClose();
            }}
            style={{ ...primaryBtnStyle, flex: 1, padding: '6px 10px', fontSize: 12 }}>
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Fotoğraf yükleme sabitleri ───────────────────────────────────────────────
const MAX_IMAGES = 2;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const uploadNoteImage = async (userId, file) => {
  const ext = file.name.split('.').pop().toLowerCase();
  const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { data, error } = await supabase.storage.from('note-images').upload(fileName, file, {
    cacheControl: '3600', upsert: false,
  });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('note-images').getPublicUrl(data.path);
  return urlData.publicUrl;
};

const deleteNoteImage = async (url) => {
  try {
    const path = url.split('/note-images/')[1];
    if (path) await supabase.storage.from('note-images').remove([path]);
  } catch (e) { console.error('Image delete error:', e); }
};

function ImagePreview({ images, onRemove, compact }) {
  if (!images || images.length === 0) return null;
  return (
    <div style={{
      display: 'flex', gap: 8, padding: compact ? 0 : '8px 12px', flexWrap: 'wrap',
    }}>
      {images.map((url, i) => (
        <div key={i} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
          <img src={url} alt="" style={{
            width: compact ? 80 : 120, height: compact ? 60 : 90,
            objectFit: 'cover', borderRadius: 10, display: 'block',
            border: '1px solid var(--border)',
          }} />
          {onRemove && (
            <button onClick={() => onRemove(i)}
              style={{
                position: 'absolute', top: 4, right: 4, width: 22, height: 22,
                borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)',
                color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              }}>✕</button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Not düzenleme modalı ─────────────────────────────────────────────────────
function NoteEditor({
  note, onSave, onClose, onDelete, userId,
  allLabels, noteLabelIds, onToggleLabel, onCreateLabel,
}) {
  const isNew = !note?.id;
  const [title, setTitle]       = useState(note?.title || '');
  const [content, setContent]   = useState(note?.content || '');
  const [color, setColor]       = useState(note?.color || 'default');
  const [category, setCategory] = useState(note?.category || '');
  const [checklist, setChecklist] = useState(note?.checklist || []);
  const [images, setImages]     = useState(note?.images || []);
  const [reminderAt, setReminderAt] = useState(note?.reminder_at || null);
  const [showChecklist, setShowChecklist] = useState((note?.checklist || []).length > 0);
  const [showColors, setShowColors]       = useState(false);
  const [showLabels, setShowLabels]       = useState(false);
  const [showReminder, setShowReminder]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const colorObj = getColor(color);

  // Yeni notlar için geçici label state — save olduğunda uygulanır
  const [pendingLabels, setPendingLabels] = useState([]); // [{id, name}]
  const effectiveLabelIds = isNew
    ? pendingLabels.map(l => l.id).filter(id => !String(id).startsWith('_new_'))
    : noteLabelIds;

  useEffect(() => {
    if (editorRef.current && note?.content) {
      editorRef.current.innerHTML = DOMPurify.sanitize(note.content);
    }
  }, []);

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) { alert(`En fazla ${MAX_IMAGES} fotoğraf ekleyebilirsiniz.`); return; }
    const toUpload = files.slice(0, remaining);
    for (const file of toUpload) {
      if (!ACCEPTED_TYPES.includes(file.type)) { alert(`Desteklenmeyen dosya: ${file.name}`); continue; }
      if (file.size > MAX_IMAGE_SIZE) { alert(`${file.name} 5 MB'den büyük.`); continue; }
      setUploading(true);
      try {
        const url = await uploadNoteImage(userId, file);
        setImages(prev => [...prev, url]);
      } catch (err) { console.error(err); alert('Yükleme hatası.'); }
      setUploading(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveImage = async (index) => {
    const url = images[index];
    if (!(note?.images || []).includes(url)) await deleteNoteImage(url);
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const html = editorRef.current?.innerHTML || '';
    if (!title.trim() && !html.trim() && checklist.length === 0 && images.length === 0) {
      onClose(); return;
    }
    setSaving(true);
    const oldImages = note?.images || [];
    for (const oldUrl of oldImages) {
      if (!images.includes(oldUrl)) await deleteNoteImage(oldUrl);
    }
    const saved = await onSave({
      ...note,
      title: title.trim(),
      content: html,
      color, category,
      checklist: showChecklist ? checklist : [],
      images,
      reminder_at: reminderAt,
    }, isNew ? pendingLabels : null);
    setSaving(false);
    onClose();
    return saved;
  };

  // Label toggle — mevcut notta anında kaydet, yeni notta state'te tut
  const handleToggleLabel = async (label) => {
    if (isNew) {
      setPendingLabels(prev =>
        prev.some(l => l.id === label.id)
          ? prev.filter(l => l.id !== label.id)
          : [...prev, label]
      );
    } else {
      await onToggleLabel(note.id, label);
    }
  };

  const handleCreateLabel = async (name) => {
    const created = await onCreateLabel(name);
    if (!created) return;
    if (isNew) setPendingLabels(prev => [...prev, created]);
    else await onToggleLabel(note.id, created);
  };

  // Kartın label'larını isimlerle göster
  const appliedLabels = isNew
    ? pendingLabels
    : allLabels.filter(l => (noteLabelIds || []).includes(l.id));

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
    }} onClick={e => { if (e.target === e.currentTarget) handleSave(); }}>
      <div style={{
        width: '100%', maxWidth: 640, maxHeight: 'calc(100vh - 80px)',
        background: colorObj.bg, borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        border: `1px solid ${colorObj.border}`,
      }}>
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Başlık"
          style={{
            border: 'none', outline: 'none', fontSize: 18, fontWeight: 700,
            padding: '16px 16px 8px', background: 'transparent',
            color: 'var(--text)', fontFamily: 'inherit',
          }} />

        <Toolbar editorRef={editorRef} />

        <div ref={editorRef}
          contentEditable suppressContentEditableWarning
          onInput={() => setContent(editorRef.current?.innerHTML || '')}
          data-placeholder="Not yazın..."
          style={{
            flex: 1, padding: '12px 16px', outline: 'none', fontSize: 14,
            lineHeight: 1.7, minHeight: 150, maxHeight: 280, overflowY: 'auto',
            color: 'var(--text)', background: 'transparent',
          }} />

        {/* Reminder chip (modal içi) */}
        {reminderAt && (
          <div style={{ padding: '4px 12px 0' }}>
            <span style={chipStyle}>
              <span>🔔</span>
              <span>{formatReminder(reminderAt)}</span>
              <button onClick={() => setReminderAt(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', marginLeft: 4, fontSize: 11 }}>✕</button>
            </span>
          </div>
        )}

        {/* Label chips */}
        {appliedLabels.length > 0 && (
          <div style={{ padding: '6px 12px 0', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {appliedLabels.map(l => (
              <span key={l.id} style={chipStyle}>
                <span>🏷️</span>
                <span>{l.name}</span>
                <button onClick={() => handleToggleLabel(l)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', marginLeft: 4, fontSize: 11 }}>✕</button>
              </span>
            ))}
          </div>
        )}

        {images.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 8 }}>
            <ImagePreview images={images} onRemove={handleRemoveImage} />
          </div>
        )}

        {showChecklist && <Checklist items={checklist} onChange={setChecklist} />}
        {showColors   && <ColorPicker value={color} onChange={setColor} />}

        <CategoryPicker value={category} onChange={setCategory} categories={DEFAULT_CATEGORIES} />

        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp"
          multiple style={{ display: 'none' }}
          onChange={handleImageUpload} />

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', borderTop: '1px solid var(--border)', gap: 6,
        }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <button title="Hatırlatıcı" onClick={() => setShowReminder(!showReminder)}
                style={{ ...iconBtnStyle, background: showReminder || reminderAt ? 'var(--bg-hover)' : 'transparent' }}>
                🔔
              </button>
              {showReminder && (
                <ReminderPopover value={reminderAt} onChange={setReminderAt}
                  onClose={() => setShowReminder(false)} anchor="top" />
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <button title="Etiket" onClick={() => setShowLabels(!showLabels)}
                style={{ ...iconBtnStyle, background: showLabels ? 'var(--bg-hover)' : 'transparent' }}>
                🏷️
              </button>
              {showLabels && (
                <LabelPopover allLabels={allLabels} selectedIds={effectiveLabelIds}
                  onToggle={handleToggleLabel}
                  onCreate={handleCreateLabel}
                  onClose={() => setShowLabels(false)} anchor="top" />
              )}
            </div>
            <button title={images.length >= MAX_IMAGES ? `En fazla ${MAX_IMAGES}` : 'Fotoğraf'}
              onClick={() => { if (images.length < MAX_IMAGES) fileInputRef.current?.click(); }}
              disabled={uploading || images.length >= MAX_IMAGES}
              style={{
                ...iconBtnStyle,
                opacity: images.length >= MAX_IMAGES ? 0.3 : 1,
                cursor: images.length >= MAX_IMAGES ? 'not-allowed' : 'pointer',
              }}>
              {uploading ? '⏳' : '📷'}
            </button>
            {images.length > 0 && (
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginLeft: 2 }}>
                {images.length}/{MAX_IMAGES}
              </span>
            )}
            <button title="Renk" onClick={() => setShowColors(!showColors)}
              style={{ ...iconBtnStyle, background: showColors ? 'var(--bg-hover)' : 'transparent' }}>
              🎨
            </button>
            <button title="Yapılacaklar" onClick={() => {
              setShowChecklist(!showChecklist);
              if (!showChecklist && checklist.length === 0) setChecklist([{ text: '', done: false }]);
            }}
              style={{ ...iconBtnStyle, background: showChecklist ? 'var(--bg-hover)' : 'transparent' }}>
              ☑️
            </button>
            {note?.id && (
              <button title="Çöp kutusuna taşı"
                onClick={() => {
                  if (window.confirm('Bu notu çöp kutusuna taşımak istiyor musunuz?')) {
                    onDelete(note.id);
                    onClose();
                  }
                }}
                style={{ ...iconBtnStyle, color: 'var(--red)' }}>
                🗑️
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={secondaryBtnStyle}>İptal</button>
            <button onClick={handleSave} disabled={saving || uploading} style={primaryBtnStyle}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Not kartı ────────────────────────────────────────────────────────────────
function NoteCard({ note, labels, onClick, onPin, onArchive, onTrash, onRestore, onPurge, view }) {
  const colorObj = getColor(note.color);
  const checkDone = (note.checklist || []).filter(c => c.done).length;
  const checkTotal = (note.checklist || []).length;
  const hasContent = note.content && note.content.replace(/<[^>]*>/g, '').trim();
  const [hover, setHover] = useState(false);

  return (
    <div onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: colorObj.bg, border: `1px solid ${colorObj.border}`,
        borderRadius: 12, padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column',
        transition: 'box-shadow 0.15s, transform 0.15s', position: 'relative',
        breakInside: 'avoid', marginBottom: 12,
        boxShadow: hover ? '0 4px 16px rgba(0,0,0,0.12)' : 'none',
        transform: hover ? 'translateY(-1px)' : 'none',
      }}
    >
      {/* Pin (sadece normal görünümde) */}
      {view === VIEWS.NOTES && onPin && (
        <button onClick={e => { e.stopPropagation(); onPin(); }}
          title={note.is_pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}
          style={{
            position: 'absolute', top: 6, right: 6, width: 28, height: 28,
            border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
            opacity: note.is_pinned ? 1 : (hover ? 0.7 : 0.2), transition: 'opacity 0.15s',
          }}>
          📌
        </button>
      )}

      {(note.images || []).length > 0 && (
        <div style={{
          display: 'flex', gap: 0, borderRadius: '12px 12px 0 0', overflow: 'hidden',
        }}>
          {(note.images || []).map((url, i) => (
            <img key={i} src={url} alt="" style={{
              flex: 1, height: (note.images || []).length === 1 ? 140 : 100,
              objectFit: 'cover', display: 'block',
            }} />
          ))}
        </div>
      )}

      <div style={{ padding: '12px 14px' }}>
        {note.title && (
          <div style={{
            fontWeight: 700, fontSize: 14, marginBottom: 6,
            paddingRight: view === VIEWS.NOTES ? 28 : 0,
            color: 'var(--text)', lineHeight: 1.3,
          }}>
            {note.title}
          </div>
        )}

        {hasContent && (
          <div style={{
            fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5,
            maxHeight: 120, overflow: 'hidden', opacity: 0.85,
          }}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(note.content) }}
          />
        )}

        {checkTotal > 0 && (
          <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--text-muted)' }}>
            {(note.checklist || []).slice(0, 4).map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, opacity: c.done ? 0.5 : 1 }}>
                <span style={{ fontSize: 14 }}>{c.done ? '☑' : '☐'}</span>
                <span style={{ textDecoration: c.done ? 'line-through' : 'none' }}>{c.text}</span>
              </div>
            ))}
            {checkTotal > 4 && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>+{checkTotal - 4} madde daha</div>}
          </div>
        )}
      </div>

      {/* Chip alanı: kategori + reminder + labels */}
      {(note.category || note.reminder_at || (labels || []).length > 0) && (
        <div style={{ padding: '0 14px 6px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {note.reminder_at && (
            <span style={{ ...chipStyle, fontSize: 10.5 }}>
              <span>🔔</span>
              <span>{formatReminder(note.reminder_at)}</span>
            </span>
          )}
          {note.category && (
            <span style={{
              padding: '2px 8px', borderRadius: 10, fontSize: 10.5, fontWeight: 600,
              background: 'rgba(0,0,0,0.06)', color: 'var(--text-muted)',
            }}>{note.category}</span>
          )}
          {(labels || []).map(l => (
            <span key={l.id} style={{
              padding: '2px 8px', borderRadius: 10, fontSize: 10.5, fontWeight: 600,
              background: 'rgba(0,0,0,0.06)', color: 'var(--text-muted)',
            }}>🏷️ {l.name}</span>
          ))}
        </div>
      )}

      {/* Footer: tarih + hover action bar */}
      <div style={{
        padding: '6px 14px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        minHeight: 32,
      }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', opacity: hover ? 1 : 0, transition: 'opacity 0.15s' }}>
          {view === VIEWS.NOTES && onArchive && (
            <button onClick={e => { e.stopPropagation(); onArchive(note.id); }}
              title="Arşivle" style={miniIconBtn}>🗄</button>
          )}
          {view === VIEWS.NOTES && onTrash && (
            <button onClick={e => { e.stopPropagation(); onTrash(note.id); }}
              title="Çöp kutusuna" style={miniIconBtn}>🗑️</button>
          )}
          {view === VIEWS.ARCHIVE && onArchive && (
            <button onClick={e => { e.stopPropagation(); onArchive(note.id); }}
              title="Arşivden çıkar" style={miniIconBtn}>↩</button>
          )}
          {view === VIEWS.ARCHIVE && onTrash && (
            <button onClick={e => { e.stopPropagation(); onTrash(note.id); }}
              title="Çöp kutusuna" style={miniIconBtn}>🗑️</button>
          )}
          {view === VIEWS.TRASH && onRestore && (
            <button onClick={e => { e.stopPropagation(); onRestore(note.id); }}
              title="Geri yükle" style={miniIconBtn}>↩</button>
          )}
          {view === VIEWS.TRASH && onPurge && (
            <button onClick={e => { e.stopPropagation(); onPurge(note.id); }}
              title="Kalıcı sil" style={{ ...miniIconBtn, color: 'var(--red)' }}>✕</button>
          )}
        </div>
        <span style={{ fontSize: 9.5, color: 'var(--text-muted)', opacity: 0.6 }}>
          {formatDateShort(note.created_at)}
        </span>
      </div>
    </div>
  );
}

// ── Hızlı not (üst "Take a note" kutusu, Keep tarzı) ─────────────────────────
function QuickAdd({ onCreate, defaultChecklist = false }) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!expanded) return;
    const off = (e) => { if (ref.current && !ref.current.contains(e.target)) {
      if (title.trim() || text.trim()) handleSave();
      else setExpanded(false);
    } };
    document.addEventListener('mousedown', off);
    return () => document.removeEventListener('mousedown', off);
  }, [expanded, title, text]);

  const handleSave = async () => {
    if (!title.trim() && !text.trim()) { setExpanded(false); return; }
    setSaving(true);
    await onCreate({ title: title.trim(), content: text.replace(/\n/g, '<br>') });
    setTitle(''); setText(''); setSaving(false); setExpanded(false);
  };

  return (
    <div ref={ref} style={{
      maxWidth: 600, margin: '0 auto 28px', background: 'var(--bg-card)',
      border: '1px solid var(--border)', borderRadius: 10,
      boxShadow: expanded ? '0 6px 20px rgba(0,0,0,0.10)' : '0 1px 3px rgba(0,0,0,0.04)',
      transition: 'box-shadow 0.15s',
    }}>
      {!expanded ? (
        <div onClick={() => setExpanded(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px', cursor: 'text',
            color: 'var(--text-muted)', fontSize: 14,
          }}>
          <span style={{ flex: 1, fontWeight: 500 }}>Not al…</span>
          <span style={{ opacity: 0.6 }}>☑</span>
          <span style={{ opacity: 0.6 }}>🖌</span>
          <span style={{ opacity: 0.6 }}>🖼</span>
        </div>
      ) : (
        <div style={{ padding: '10px 14px' }}>
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Başlık"
            style={{
              width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none',
              fontSize: 14, fontWeight: 600, background: 'transparent',
              color: 'var(--text)', padding: '4px 0',
            }} />
          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder="Not al…" rows={3}
            style={{
              width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none',
              fontSize: 13.5, background: 'transparent', color: 'var(--text)',
              padding: '4px 0', resize: 'none', fontFamily: 'inherit',
            }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button onClick={() => { setTitle(''); setText(''); setExpanded(false); }}
              style={{ ...secondaryBtnStyle, padding: '5px 14px', fontSize: 12.5 }}>
              Kapat
            </button>
            <button onClick={handleSave} disabled={saving || (!title.trim() && !text.trim())}
              style={{ ...primaryBtnStyle, padding: '5px 14px', fontSize: 12.5,
                opacity: (saving || (!title.trim() && !text.trim())) ? 0.5 : 1 }}>
              {saving ? '⏳' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sol Sidebar ──────────────────────────────────────────────────────────────
function NotesSidebar({
  view, setView, labels, onRenameLabel, onDeleteLabel, counts, onCreateLabel,
}) {
  const [hoverLabel, setHoverLabel] = useState(null);
  const [editingLabel, setEditingLabel] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [newLabelName, setNewLabelName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const item = (key, icon, label, count) => {
    const active = view === key;
    return (
      <button key={key} onClick={() => setView(key)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          width: '100%', padding: '8px 14px', borderRadius: '0 28px 28px 0',
          border: 'none', cursor: 'pointer', fontSize: 13.5,
          background: active ? '#feefc3' : 'transparent',
          color: active ? '#3c4043' : 'var(--text)',
          fontWeight: active ? 600 : 500,
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
        <span style={{ fontSize: 16, width: 20 }}>{icon}</span>
        <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
        {count != null && count > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{count}</span>
        )}
      </button>
    );
  };

  return (
    <aside style={{
      width: 260, flexShrink: 0, paddingTop: 8,
      borderRight: '1px solid var(--border)',
      position: 'sticky', top: 8, alignSelf: 'flex-start',
      maxHeight: 'calc(100vh - 16px)', overflowY: 'auto',
    }}>
      {item(VIEWS.NOTES,     '💡', 'Notlar',        counts.notes)}
      {item(VIEWS.REMINDERS, '🔔', 'Hatırlatıcılar', counts.reminders)}
      {item(VIEWS.ARCHIVE,   '🗄', 'Arşiv',          counts.archive)}
      {item(VIEWS.TRASH,     '🗑', 'Çöp kutusu',     counts.trash)}

      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', padding: '14px 14px 6px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Etiketler
      </div>
      {labels.map(l => {
        const active = view === `label:${l.id}`;
        const isEdit = editingLabel === l.id;
        return (
          <div key={l.id}
            onMouseEnter={() => setHoverLabel(l.id)}
            onMouseLeave={() => setHoverLabel(null)}
            style={{ position: 'relative' }}>
            {isEdit ? (
              <div style={{ padding: '6px 14px', display: 'flex', gap: 4 }}>
                <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && editValue.trim()) {
                      onRenameLabel(l.id, editValue.trim()); setEditingLabel(null);
                    } else if (e.key === 'Escape') setEditingLabel(null);
                  }}
                  style={{ flex: 1, fontSize: 13, padding: '4px 8px', border: '1px solid var(--border)',
                    borderRadius: 6, outline: 'none', background: 'var(--bg-hover)', color: 'var(--text)' }} />
                <button onClick={() => { if (editValue.trim()) { onRenameLabel(l.id, editValue.trim()); setEditingLabel(null); } }}
                  style={{ ...miniIconBtn, width: 24, height: 24 }}>✓</button>
              </div>
            ) : (
              <button onClick={() => setView(`label:${l.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', padding: '8px 14px', borderRadius: '0 28px 28px 0',
                  border: 'none', cursor: 'pointer', fontSize: 13.5,
                  background: active ? '#feefc3' : 'transparent',
                  color: active ? '#3c4043' : 'var(--text)',
                  fontWeight: active ? 600 : 500,
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                <span style={{ fontSize: 16, width: 20 }}>🏷️</span>
                <span style={{ flex: 1, textAlign: 'left' }}>{l.name}</span>
                {counts.labels?.[l.id] > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{counts.labels[l.id]}</span>
                )}
              </button>
            )}
            {!isEdit && hoverLabel === l.id && (
              <div style={{ position: 'absolute', top: 4, right: 6, display: 'flex', gap: 2 }}>
                <button onClick={(e) => { e.stopPropagation(); setEditingLabel(l.id); setEditValue(l.name); }}
                  title="Adı değiştir" style={{ ...miniIconBtn, width: 22, height: 22, background: 'var(--bg-card)' }}>✎</button>
                <button onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`"${l.name}" etiketini silmek istiyor musunuz? Notlardan kaldırılacak.`)) onDeleteLabel(l.id);
                  }}
                  title="Sil" style={{ ...miniIconBtn, width: 22, height: 22, background: 'var(--bg-card)', color: 'var(--red)' }}>✕</button>
              </div>
            )}
          </div>
        );
      })}

      {!showCreate ? (
        <button onClick={() => setShowCreate(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            width: '100%', padding: '8px 14px', borderRadius: '0 28px 28px 0',
            border: 'none', cursor: 'pointer', fontSize: 13.5,
            background: 'transparent', color: 'var(--text-muted)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <span style={{ fontSize: 16, width: 20 }}>＋</span>
          <span>Yeni etiket</span>
        </button>
      ) : (
        <div style={{ padding: '6px 14px', display: 'flex', gap: 4 }}>
          <input autoFocus value={newLabelName} onChange={e => setNewLabelName(e.target.value)}
            placeholder="Etiket adı"
            onKeyDown={e => {
              if (e.key === 'Enter' && newLabelName.trim()) {
                onCreateLabel(newLabelName.trim()); setNewLabelName(''); setShowCreate(false);
              } else if (e.key === 'Escape') { setNewLabelName(''); setShowCreate(false); }
            }}
            style={{ flex: 1, fontSize: 13, padding: '4px 8px', border: '1px solid var(--border)',
              borderRadius: 6, outline: 'none', background: 'var(--bg-hover)', color: 'var(--text)' }} />
          <button onClick={() => { if (newLabelName.trim()) { onCreateLabel(newLabelName.trim()); setNewLabelName(''); setShowCreate(false); } }}
            style={{ ...miniIconBtn, width: 24, height: 24 }}>✓</button>
        </div>
      )}

      <div style={{ height: 12 }} />
    </aside>
  );
}

// ── Ana Notes bileşeni ───────────────────────────────────────────────────────
export default function Notes({ user, profile, onNavigate }) {
  const [notes, setNotes]           = useState([]);
  const [labels, setLabels]         = useState([]);
  const [labelLinks, setLabelLinks] = useState([]); // {note_id, label_id}
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState(null);
  const [search, setSearch]         = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterColor, setFilterColor]       = useState('');
  const [view, setView]                     = useState(VIEWS.NOTES);

  // ── Data ───────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    const [noteRes, labelRes, linkRes] = await Promise.all([
      supabase.from('notes').select('*').eq('user_id', user.id)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false }),
      supabase.from('note_labels').select('*').eq('user_id', user.id).order('name'),
      supabase.from('note_label_links').select('note_id,label_id').eq('user_id', user.id),
    ]);
    if (!noteRes.error)  setNotes(noteRes.data   || []);
    if (!labelRes.error) setLabels(labelRes.data || []);
    if (!linkRes.error)  setLabelLinks(linkRes.data || []);
    setLoading(false);
  }, [user.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // 30 günden eski trash kayıtlarını client-side temizle (best effort)
  useEffect(() => {
    const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 86400 * 1000).toISOString();
    supabase.from('notes').delete().eq('user_id', user.id).lt('deleted_at', cutoff);
  }, [user.id]);

  // Label map: { noteId: [label, ...] }
  const labelsByNote = useMemo(() => {
    const map = {};
    for (const link of labelLinks) {
      if (!map[link.note_id]) map[link.note_id] = [];
      const label = labels.find(l => l.id === link.label_id);
      if (label) map[link.note_id].push(label);
    }
    return map;
  }, [labelLinks, labels]);

  const labelIdsOfNote = (noteId) => (labelsByNote[noteId] || []).map(l => l.id);

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const saveNote = async (note, pendingLabelsForNew = null) => {
    const payload = {
      title: note.title, content: note.content, color: note.color,
      category: note.category, checklist: note.checklist,
      images: note.images || [],
      reminder_at: note.reminder_at || null,
      reminder_notified_at: note.reminder_at ? note.reminder_notified_at || null : null,
      user_id: user.id, updated_at: new Date().toISOString(),
    };
    const isEdit = !!note.id;
    let savedId = note.id;
    if (isEdit) {
      await supabase.from('notes').update(payload).eq('id', note.id);
    } else {
      const { data, error } = await supabase.from('notes').insert(payload).select().single();
      if (!error) savedId = data.id;
    }
    if (!isEdit && pendingLabelsForNew && pendingLabelsForNew.length > 0 && savedId) {
      const rows = pendingLabelsForNew
        .filter(l => !String(l.id).startsWith('_new_'))
        .map(l => ({ note_id: savedId, label_id: l.id, user_id: user.id }));
      if (rows.length) await supabase.from('note_label_links').insert(rows);
    }
    await loadAll();
    logActivity({ action: isEdit ? 'güncelledi' : 'oluşturdu', module: 'notlar', entityType: 'not', entityName: note.title });
    return savedId;
  };

  const quickCreate = async ({ title, content }) => {
    const { data } = await supabase.from('notes').insert({
      user_id: user.id, title, content,
      color: 'default', category: '',
      checklist: [], images: [],
      updated_at: new Date().toISOString(),
    }).select().single();
    await loadAll();
    return data;
  };

  const togglePin = async (note) => {
    await supabase.from('notes').update({ is_pinned: !note.is_pinned, updated_at: new Date().toISOString() }).eq('id', note.id);
    loadAll();
  };

  const archiveNote = async (id) => {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    const next = !note.is_archived;
    await supabase.from('notes').update({
      is_archived: next,
      archived_at: next ? new Date().toISOString() : null,
      is_pinned: next ? false : note.is_pinned, // arşivlenince pin kalksın
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    loadAll();
  };

  const trashNote = async (id) => {
    await supabase.from('notes').update({
      deleted_at: new Date().toISOString(),
      is_pinned: false,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    loadAll();
    logActivity({ action: 'çöpe attı', module: 'notlar', entityType: 'not' });
  };

  const restoreNote = async (id) => {
    await supabase.from('notes').update({
      deleted_at: null, updated_at: new Date().toISOString(),
    }).eq('id', id);
    loadAll();
  };

  const purgeNote = async (id) => {
    if (!window.confirm('Bu notu kalıcı olarak silmek istiyor musunuz? Geri alınamaz.')) return;
    const n = notes.find(x => x.id === id);
    for (const url of (n?.images || [])) await deleteNoteImage(url);
    await supabase.from('notes').delete().eq('id', id);
    loadAll();
  };

  // ── Label CRUD ─────────────────────────────────────────────────────────────
  const createLabel = async (name) => {
    const existing = labels.find(l => l.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const { data, error } = await supabase.from('note_labels').insert({
      user_id: user.id, name,
    }).select().single();
    if (error) { alert('Etiket oluşturulamadı.'); return null; }
    setLabels(prev => [...prev, data].sort((a,b) => a.name.localeCompare(b.name)));
    return data;
  };

  const renameLabel = async (id, name) => {
    await supabase.from('note_labels').update({ name, updated_at: new Date().toISOString() }).eq('id', id);
    loadAll();
  };

  const deleteLabel = async (id) => {
    await supabase.from('note_label_links').delete().eq('label_id', id);
    await supabase.from('note_labels').delete().eq('id', id);
    if (view === `label:${id}`) setView(VIEWS.NOTES);
    loadAll();
  };

  const toggleNoteLabel = async (noteId, label) => {
    const currentIds = labelIdsOfNote(noteId);
    if (currentIds.includes(label.id)) {
      await supabase.from('note_label_links').delete()
        .eq('note_id', noteId).eq('label_id', label.id);
    } else {
      await supabase.from('note_label_links').insert({
        note_id: noteId, label_id: label.id, user_id: user.id,
      });
    }
    loadAll();
  };

  // ── Counts ─────────────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const notArchivedActive = notes.filter(n => !n.is_archived && !n.deleted_at);
    const labelCounts = {};
    for (const link of labelLinks) {
      const n = notes.find(x => x.id === link.note_id);
      if (!n || n.is_archived || n.deleted_at) continue;
      labelCounts[link.label_id] = (labelCounts[link.label_id] || 0) + 1;
    }
    return {
      notes:     notArchivedActive.length,
      reminders: notArchivedActive.filter(n => n.reminder_at).length,
      archive:   notes.filter(n => n.is_archived && !n.deleted_at).length,
      trash:     notes.filter(n => n.deleted_at).length,
      labels:    labelCounts,
    };
  }, [notes, labelLinks]);

  // ── Filtreleme ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let arr = notes;
    // view filter
    if (view === VIEWS.NOTES) {
      arr = arr.filter(n => !n.is_archived && !n.deleted_at);
    } else if (view === VIEWS.REMINDERS) {
      arr = arr.filter(n => !n.is_archived && !n.deleted_at && n.reminder_at);
    } else if (view === VIEWS.ARCHIVE) {
      arr = arr.filter(n => n.is_archived && !n.deleted_at);
    } else if (view === VIEWS.TRASH) {
      arr = arr.filter(n => n.deleted_at);
    } else if (view.startsWith('label:')) {
      const lid = view.slice(6);
      const noteIds = labelLinks.filter(l => l.label_id === lid).map(l => l.note_id);
      arr = arr.filter(n => noteIds.includes(n.id) && !n.deleted_at && !n.is_archived);
    }

    if (filterCategory) arr = arr.filter(n => n.category === filterCategory);
    if (filterColor)    arr = arr.filter(n => n.color === filterColor);
    if (search) {
      const s = search.toLowerCase();
      arr = arr.filter(n => {
        const txt = (n.title + ' ' + (n.content || '').replace(/<[^>]*>/g, '')).toLowerCase();
        return txt.includes(s);
      });
    }
    return arr;
  }, [notes, labelLinks, view, filterCategory, filterColor, search]);

  const pinned   = filtered.filter(n => n.is_pinned);
  const unpinned = filtered.filter(n => !n.is_pinned);
  const showPinnedSection = view === VIEWS.NOTES && pinned.length > 0;

  const activeLabelObj = view.startsWith('label:')
    ? labels.find(l => l.id === view.slice(6))
    : null;

  const currentTitle = {
    [VIEWS.NOTES]:     'Notlar',
    [VIEWS.REMINDERS]: 'Hatırlatıcılar',
    [VIEWS.ARCHIVE]:   'Arşiv',
    [VIEWS.TRASH]:     'Çöp kutusu',
  }[view] || (activeLabelObj ? activeLabelObj.name : 'Notlar');

  if (loading) {
    return (
      <div style={{ display:'flex', justifyContent:'center', padding: 60 }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', minHeight: 'calc(100vh - 100px)' }}>
      <NotesSidebar
        view={view} setView={setView}
        labels={labels}
        counts={counts}
        onCreateLabel={createLabel}
        onRenameLabel={renameLabel}
        onDeleteLabel={deleteLabel}
      />

      <div style={{ flex: 1, minWidth: 0, padding: '0 8px 40px' }}>
        {/* Sticky search header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: 'var(--bg)', padding: '12px 0 14px',
          marginBottom: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220, maxWidth: 600, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, opacity: 0.5 }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Notlarda ara…"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '10px 12px 10px 36px', borderRadius: 10,
                  border: '1px solid var(--border)', fontSize: 13.5,
                  outline: 'none', background: 'var(--bg-hover)', color: 'var(--text)',
                }} />
            </div>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
              style={{
                padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)',
                fontSize: 12.5, background: 'var(--bg-hover)', color: 'var(--text-secondary)',
                cursor: 'pointer', outline: 'none',
              }}>
              <option value="">Tüm kategoriler</option>
              {DEFAULT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              {filterColor && (
                <button onClick={() => setFilterColor('')}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>✕</button>
              )}
              {NOTE_COLORS.slice(1).map(c => (
                <button key={c.id} title={c.label} onClick={() => setFilterColor(filterColor === c.id ? '' : c.id)}
                  style={{
                    width: 18, height: 18, borderRadius: '50%', cursor: 'pointer',
                    border: filterColor === c.id ? '2px solid var(--navy)' : `1.5px solid ${c.border}`,
                    background: c.bg, transform: filterColor === c.id ? 'scale(1.2)' : 'scale(1)',
                    transition: 'transform 0.1s',
                  }} />
              ))}
            </div>
          </div>
        </div>

        {/* View başlığı */}
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{currentTitle}</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{filtered.length} not</span>
          {view === VIEWS.TRASH && filtered.length > 0 && (
            <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              🕐 Çöp kutusundaki notlar {TRASH_RETENTION_DAYS} gün sonra kalıcı olarak silinir.
            </span>
          )}
        </div>

        {/* Quick add — sadece Notlar ve Hatırlatıcılar görünümünde */}
        {(view === VIEWS.NOTES || view === VIEWS.REMINDERS) && (
          <QuickAdd onCreate={quickCreate} />
        )}

        {/* Yeni Not butonu */}
        {(view === VIEWS.NOTES || view === VIEWS.REMINDERS || view.startsWith('label:')) && (
          <div style={{ maxWidth: 600, margin: '0 auto 24px', textAlign: 'right' }}>
            <button onClick={() => setEditing('new')} style={{
              ...secondaryBtnStyle, padding: '6px 14px', fontSize: 12.5,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> Detaylı not
            </button>
          </div>
        )}

        {showPinnedSection && (
          <>
            <div style={sectionTitleStyle}>📌 Sabitlenmiş</div>
            <div style={{ columnCount: 4, columnGap: 14, marginBottom: 24 }} className="notes-masonry">
              {pinned.map(note => (
                <NoteCard key={note.id} note={note}
                  labels={labelsByNote[note.id]}
                  view={view}
                  onClick={() => setEditing(note)}
                  onPin={() => togglePin(note)}
                  onArchive={archiveNote}
                  onTrash={trashNote}
                />
              ))}
            </div>
          </>
        )}

        {unpinned.length > 0 && (
          <>
            {showPinnedSection && <div style={sectionTitleStyle}>Diğer notlar</div>}
            <div style={{ columnCount: 4, columnGap: 14 }} className="notes-masonry">
              {unpinned.map(note => (
                <NoteCard key={note.id} note={note}
                  labels={labelsByNote[note.id]}
                  view={view}
                  onClick={() => setEditing(note)}
                  onPin={view === VIEWS.NOTES ? () => togglePin(note) : null}
                  onArchive={view === VIEWS.TRASH ? null : archiveNote}
                  onTrash={view === VIEWS.TRASH ? null : trashNote}
                  onRestore={view === VIEWS.TRASH ? restoreNote : null}
                  onPurge={view === VIEWS.TRASH ? purgeNote : null}
                />
              ))}
            </div>
          </>
        )}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 64, marginBottom: 16, opacity: 0.4 }}>
              {view === VIEWS.ARCHIVE ? '🗄' :
               view === VIEWS.TRASH ? '🗑' :
               view === VIEWS.REMINDERS ? '🔔' :
               view.startsWith('label:') ? '🏷️' : '💡'}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>
              {view === VIEWS.ARCHIVE   ? 'Arşivde not yok' :
               view === VIEWS.TRASH     ? 'Çöp kutusu boş' :
               view === VIEWS.REMINDERS ? 'Hatırlatıcılı not yok' :
               search || filterCategory || filterColor ? 'Filtrelerle eşleşen not yok' :
               view.startsWith('label:') ? `"${activeLabelObj?.name}" etiketiyle not yok` :
               'Notlarınız burada görünecek'}
            </div>
            <div style={{ fontSize: 13 }}>
              {view === VIEWS.NOTES && !search && 'Yukarıdaki alandan not almaya başlayın.'}
            </div>
          </div>
        )}

        {editing && (
          <NoteEditor
            note={editing === 'new' ? null : editing}
            allLabels={labels}
            noteLabelIds={editing && editing !== 'new' ? labelIdsOfNote(editing.id) : []}
            onSave={saveNote}
            onToggleLabel={toggleNoteLabel}
            onCreateLabel={createLabel}
            onClose={() => setEditing(null)}
            onDelete={trashNote}
            userId={user.id}
          />
        )}

        <style>{`
          .notes-masonry { column-count: 4; }
          @media (max-width: 1400px) { .notes-masonry { column-count: 3; } }
          @media (max-width: 1000px) { .notes-masonry { column-count: 2; } }
          @media (max-width: 620px)  { .notes-masonry { column-count: 1; } }
          [contenteditable]:empty:before {
            content: attr(data-placeholder);
            color: var(--text-muted);
            pointer-events: none;
          }
        `}</style>
      </div>
    </div>
  );
}

// ── Shared styles ────────────────────────────────────────────────────────────
const primaryBtnStyle = {
  padding: '7px 16px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600,
  background: 'var(--navy)', color: '#fff', cursor: 'pointer', transition: 'opacity 0.15s',
};
const secondaryBtnStyle = {
  padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500,
  border: '1.5px solid var(--border)', background: 'var(--bg-hover)',
  color: 'var(--text-secondary)', cursor: 'pointer',
};
const iconBtnStyle = {
  width: 32, height: 32, border: 'none', borderRadius: 8, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
  transition: 'background 0.1s',
};
const miniIconBtn = {
  width: 28, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 13, background: 'transparent', color: 'var(--text-muted)',
  transition: 'background 0.1s',
};
const chipStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '2px 8px', borderRadius: 10, fontSize: 11,
  background: 'rgba(0,0,0,0.06)', color: 'var(--text-muted)', fontWeight: 600,
};
const sectionTitleStyle = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10,
};
