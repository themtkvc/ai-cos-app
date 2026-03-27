import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

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

// ── Toolbar bileşeni ─────────────────────────────────────────────────────────
function Toolbar({ editorRef }) {
  const exec = (cmd, val = null) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
  };
  const btns = [
    { cmd: 'bold',          icon: 'B',    style: { fontWeight: 700 }, title: 'Kalın' },
    { cmd: 'italic',        icon: 'I',    style: { fontStyle: 'italic' }, title: 'İtalik' },
    { cmd: 'underline',     icon: 'U',    style: { textDecoration: 'underline' }, title: 'Altı çizili' },
    { cmd: 'strikeThrough', icon: 'S',    style: { textDecoration: 'line-through' }, title: 'Üstü çizili' },
    null, // separator
    { cmd: 'formatBlock', val: '<h2>', icon: 'H', style: { fontWeight: 700, fontSize: 13 }, title: 'Başlık' },
    { cmd: 'insertUnorderedList', icon: '•', style: { fontSize: 16, lineHeight: 1 }, title: 'Madde listesi' },
    { cmd: 'insertOrderedList',   icon: '1.', style: { fontSize: 12, fontWeight: 600 }, title: 'Numaralı liste' },
  ];
  return (
    <div style={{ display: 'flex', gap: 2, padding: '6px 8px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
      {btns.map((b, i) => b === null ? (
        <div key={i} style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 4px', alignSelf: 'center' }} />
      ) : (
        <button key={b.cmd + (b.val || '')} title={b.title}
          onMouseDown={e => { e.preventDefault(); exec(b.cmd, b.val); }}
          style={{
            ...b.style, width: 28, height: 28, border: 'none', borderRadius: 6,
            background: 'transparent', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 13,
            color: 'var(--text-secondary)', transition: 'background 0.1s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >{b.icon}</button>
      ))}
    </div>
  );
}

// ── Checklist bileşeni ───────────────────────────────────────────────────────
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
            style={{ width: 16, height: 16, accentColor: 'var(--navy, #1a3a5c)', cursor: 'pointer', flexShrink: 0 }} />
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
            width: 26, height: 26, borderRadius: '50%', border: value === c.id ? '2.5px solid var(--navy, #1a3a5c)' : `2px solid ${c.border}`,
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
            background: value === cat ? 'var(--navy, #1a3a5c)' : 'var(--bg-hover)',
            color: value === cat ? '#fff' : 'var(--text-secondary)',
          }}>
          {cat}
        </button>
      ))}
    </div>
  );
}

// ── Fotoğraf yükleme sabitleri ────────────────────────────────────────────────
const MAX_IMAGES = 2;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// ── Fotoğraf yükleme yardımcı fonksiyonları ──────────────────────────────────
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

// ── Fotoğraf önizleme bileşeni ──────────────────────────────────────────────
function ImagePreview({ images, onRemove, compact }) {
  if (!images || images.length === 0) return null;
  return (
    <div style={{
      display: 'flex', gap: 8, padding: compact ? 0 : '8px 12px',
      flexWrap: 'wrap',
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
function NoteEditor({ note, onSave, onClose, onDelete, userId }) {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [color, setColor] = useState(note?.color || 'default');
  const [category, setCategory] = useState(note?.category || '');
  const [checklist, setChecklist] = useState(note?.checklist || []);
  const [images, setImages] = useState(note?.images || []);
  const [showChecklist, setShowChecklist] = useState((note?.checklist || []).length > 0);
  const [showColors, setShowColors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const colorObj = getColor(color);

  useEffect(() => {
    if (editorRef.current && note?.content) {
      editorRef.current.innerHTML = note.content;
    }
  }, []);

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      alert(`En fazla ${MAX_IMAGES} fotoğraf ekleyebilirsiniz.`);
      return;
    }

    const toUpload = files.slice(0, remaining);

    for (const file of toUpload) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        alert(`Desteklenmeyen dosya türü: ${file.name}. Sadece JPG, PNG, GIF ve WebP kabul edilir.`);
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        alert(`${file.name} dosyası 5 MB'den büyük. Lütfen daha küçük bir dosya seçin.`);
        continue;
      }
      setUploading(true);
      try {
        const url = await uploadNoteImage(userId, file);
        setImages(prev => [...prev, url]);
      } catch (err) {
        console.error('Upload error:', err);
        alert('Fotoğraf yüklenirken hata oluştu.');
      }
      setUploading(false);
    }
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveImage = async (index) => {
    const url = images[index];
    // Yeni eklenen (henüz kaydedilmemiş) görsel ise storage'dan sil
    if (!(note?.images || []).includes(url)) {
      await deleteNoteImage(url);
    }
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const html = editorRef.current?.innerHTML || '';
    if (!title.trim() && !html.trim() && checklist.length === 0 && images.length === 0) return;
    setSaving(true);
    // Silinen görselleri storage'dan temizle
    const oldImages = note?.images || [];
    for (const oldUrl of oldImages) {
      if (!images.includes(oldUrl)) {
        await deleteNoteImage(oldUrl);
      }
    }
    await onSave({
      ...note, title: title.trim(), content: html, color, category,
      checklist: showChecklist ? checklist : [],
      images,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
    }} onClick={e => { if (e.target === e.currentTarget) handleSave(); }}>
      <div style={{
        width: '100%', maxWidth: 600, maxHeight: 'calc(100vh - 80px)',
        background: colorObj.bg, borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        border: `1px solid ${colorObj.border}`,
      }}>
        {/* Title */}
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Başlık"
          style={{
            border: 'none', outline: 'none', fontSize: 18, fontWeight: 700,
            padding: '16px 16px 8px', background: 'transparent',
            color: 'var(--text)', fontFamily: 'inherit',
          }} />

        {/* Toolbar */}
        <Toolbar editorRef={editorRef} />

        {/* Content editor */}
        <div ref={editorRef}
          contentEditable suppressContentEditableWarning
          onInput={() => setContent(editorRef.current?.innerHTML || '')}
          data-placeholder="Not yazın..."
          style={{
            flex: 1, padding: '12px 16px', outline: 'none', fontSize: 14,
            lineHeight: 1.7, minHeight: 150, maxHeight: 300, overflowY: 'auto',
            color: 'var(--text)', background: 'transparent',
          }} />

        {/* Image previews */}
        {images.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <ImagePreview images={images} onRemove={handleRemoveImage} />
          </div>
        )}

        {/* Checklist */}
        {showChecklist && <Checklist items={checklist} onChange={setChecklist} />}

        {/* Color picker */}
        {showColors && <ColorPicker value={color} onChange={setColor} />}

        {/* Category */}
        <CategoryPicker value={category} onChange={setCategory} categories={DEFAULT_CATEGORIES} />

        {/* Hidden file input */}
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp"
          multiple style={{ display: 'none' }}
          onChange={handleImageUpload} />

        {/* Bottom bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', borderTop: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button title={images.length >= MAX_IMAGES ? `En fazla ${MAX_IMAGES} fotoğraf` : 'Fotoğraf ekle'}
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
              <button title="Sil" onClick={() => { if (window.confirm('Bu notu silmek istediğinize emin misiniz?')) { onDelete(note.id); onClose(); } }}
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

// ── Not kartı (Google Keep tarzı) ────────────────────────────────────────────
function NoteCard({ note, onClick, onPin }) {
  const colorObj = getColor(note.color);
  const checkDone = (note.checklist || []).filter(c => c.done).length;
  const checkTotal = (note.checklist || []).length;
  const hasContent = note.content && note.content.replace(/<[^>]*>/g, '').trim();

  return (
    <div onClick={onClick}
      style={{
        background: colorObj.bg, border: `1px solid ${colorObj.border}`,
        borderRadius: 12, padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column',
        transition: 'box-shadow 0.15s, transform 0.15s', position: 'relative',
        breakInside: 'avoid', marginBottom: 12,
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Pin button */}
      <button onClick={e => { e.stopPropagation(); onPin(); }}
        title={note.is_pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}
        style={{
          position: 'absolute', top: 6, right: 6, width: 28, height: 28,
          border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
          opacity: note.is_pinned ? 1 : 0.3, transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = 1}
        onMouseLeave={e => { if (!note.is_pinned) e.currentTarget.style.opacity = 0.3; }}
      >
        📌
      </button>

      {/* Image thumbnails */}
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
        {/* Title */}
        {note.title && (
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, paddingRight: 28, color: 'var(--text)', lineHeight: 1.3 }}>
            {note.title}
          </div>
        )}

        {/* Content preview */}
        {hasContent && (
          <div style={{
            fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5,
            maxHeight: 120, overflow: 'hidden', opacity: 0.85,
          }}
            dangerouslySetInnerHTML={{ __html: note.content }}
          />
        )}

        {/* Checklist preview */}
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

      {/* Footer: category + date */}
      <div style={{ padding: '6px 14px 10px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {note.category && (
          <span style={{
            padding: '2px 8px', borderRadius: 10, fontSize: 10.5, fontWeight: 600,
            background: 'rgba(0,0,0,0.06)', color: 'var(--text-muted)',
          }}>{note.category}</span>
        )}
        {checkTotal > 0 && (
          <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
            {checkDone}/{checkTotal} tamamlandı
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 9.5, color: 'var(--text-muted)', opacity: 0.6 }}>
          {new Date(note.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
        </span>
      </div>
    </div>
  );
}

// ── Ana Notes bileşeni ───────────────────────────────────────────────────────
export default function Notes({ user }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | note object
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // ── Notları yükle ──────────────────────────────────────────────────────────
  const loadNotes = useCallback(async () => {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false });
    if (!error) setNotes(data || []);
    setLoading(false);
  }, [user.id]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  // ── Kaydet (upsert) ───────────────────────────────────────────────────────
  const saveNote = async (note) => {
    const payload = {
      title: note.title, content: note.content, color: note.color,
      category: note.category, checklist: note.checklist,
      images: note.images || [],
      user_id: user.id, updated_at: new Date().toISOString(),
    };
    if (note.id) {
      await supabase.from('notes').update(payload).eq('id', note.id);
    } else {
      await supabase.from('notes').insert(payload);
    }
    loadNotes();
  };

  // ── Sabitle / kaldır ──────────────────────────────────────────────────────
  const togglePin = async (note) => {
    await supabase.from('notes').update({ is_pinned: !note.is_pinned, updated_at: new Date().toISOString() }).eq('id', note.id);
    loadNotes();
  };

  // ── Arşivle / geri al ─────────────────────────────────────────────────────
  const toggleArchive = async (id) => {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    await supabase.from('notes').update({ is_archived: !note.is_archived }).eq('id', id);
    loadNotes();
  };

  // ── Sil ────────────────────────────────────────────────────────────────────
  const deleteNote = async (id) => {
    await supabase.from('notes').delete().eq('id', id);
    loadNotes();
  };

  // ── Filtreleme ─────────────────────────────────────────────────────────────
  const filtered = notes.filter(n => {
    if (n.is_archived !== showArchived) return false;
    if (filterCategory && n.category !== filterCategory) return false;
    if (filterColor && n.color !== filterColor) return false;
    if (search) {
      const s = search.toLowerCase();
      const textContent = (n.title + ' ' + (n.content || '').replace(/<[^>]*>/g, '')).toLowerCase();
      if (!textContent.includes(s)) return false;
    }
    return true;
  });

  const pinned = filtered.filter(n => n.is_pinned);
  const unpinned = filtered.filter(n => !n.is_pinned);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>📝 Notlarım</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            {notes.filter(n => !n.is_archived).length} not · {notes.filter(n => n.is_archived).length} arşiv
          </p>
        </div>
        <button onClick={() => setEditing('new')} style={{
          ...primaryBtnStyle, padding: '10px 20px', fontSize: 14, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Yeni Not
        </button>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, opacity: 0.4 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Not ara…"
            style={{
              width: '100%', padding: '8px 12px 8px 32px', borderRadius: 10,
              border: '1.5px solid var(--border)', fontSize: 13,
              outline: 'none', background: 'var(--bg-hover)', color: 'var(--text)',
              boxSizing: 'border-box',
            }} />
        </div>

        {/* Category filter */}
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 10, border: '1.5px solid var(--border)',
            fontSize: 12.5, background: 'var(--bg-hover)', color: 'var(--text-secondary)',
            cursor: 'pointer', outline: 'none',
          }}>
          <option value="">Tüm kategoriler</option>
          {DEFAULT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Color filter */}
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          {filterColor && (
            <button onClick={() => setFilterColor('')} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>✕</button>
          )}
          {NOTE_COLORS.slice(1).map(c => (
            <button key={c.id} title={c.label} onClick={() => setFilterColor(filterColor === c.id ? '' : c.id)}
              style={{
                width: 18, height: 18, borderRadius: '50%', cursor: 'pointer',
                border: filterColor === c.id ? '2px solid var(--navy, #1a3a5c)' : `1.5px solid ${c.border}`,
                background: c.bg, transform: filterColor === c.id ? 'scale(1.2)' : 'scale(1)',
                transition: 'transform 0.1s',
              }} />
          ))}
        </div>

        {/* Archive toggle */}
        <button onClick={() => setShowArchived(!showArchived)}
          style={{
            ...secondaryBtnStyle, fontSize: 12, padding: '6px 12px',
            background: showArchived ? 'var(--navy, #1a3a5c)' : undefined,
            color: showArchived ? '#fff' : undefined,
          }}>
          🗄 {showArchived ? 'Aktif notlar' : 'Arşiv'}
        </button>
      </div>

      {/* Pinned section */}
      {pinned.length > 0 && !showArchived && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            📌 Sabitlenmiş
          </div>
          <div style={{ columnCount: 3, columnGap: 12, marginBottom: 24 }}
            className="notes-masonry">
            {pinned.map(note => (
              <NoteCard key={note.id} note={note}
                onClick={() => setEditing(note)}
                onPin={() => togglePin(note)} />
            ))}
          </div>
        </>
      )}

      {/* Other notes */}
      {unpinned.length > 0 && (
        <>
          {pinned.length > 0 && !showArchived && (
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Diğer notlar
            </div>
          )}
          <div style={{ columnCount: 3, columnGap: 12 }}
            className="notes-masonry">
            {unpinned.map(note => (
              <NoteCard key={note.id} note={note}
                onClick={() => setEditing(note)}
                onPin={() => togglePin(note)} />
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{showArchived ? '🗄' : '📝'}</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>
            {showArchived ? 'Arşivde not yok' : search || filterCategory || filterColor ? 'Filtrelerle eşleşen not yok' : 'Henüz not eklenmemiş'}
          </div>
          <div style={{ fontSize: 13 }}>
            {!showArchived && !search && !filterCategory && !filterColor && 'İlk notunuzu oluşturmak için "Yeni Not" butonuna tıklayın.'}
          </div>
        </div>
      )}

      {/* Editor modal */}
      {editing && (
        <NoteEditor
          note={editing === 'new' ? null : editing}
          onSave={saveNote}
          onClose={() => setEditing(null)}
          onDelete={deleteNote}
          userId={user.id}
        />
      )}

      {/* Responsive masonry CSS */}
      <style>{`
        .notes-masonry { column-count: 3; }
        @media (max-width: 900px) { .notes-masonry { column-count: 2; } }
        @media (max-width: 560px) { .notes-masonry { column-count: 1; } }
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: var(--text-muted);
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

// ── Shared styles ────────────────────────────────────────────────────────────
const primaryBtnStyle = {
  padding: '7px 16px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600,
  background: 'var(--navy, #1a3a5c)', color: '#fff', cursor: 'pointer', transition: 'opacity 0.15s',
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
