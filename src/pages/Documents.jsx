import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, logActivity, uploadDocumentToDrive, deleteDocumentFromDrive, validateUploadFile, MAX_DOCUMENT_BYTES } from '../lib/supabase';
import { useProfile } from '../App';

// ══════════════════════════════════════════════════════════════════════════════
// DOSYA TİPİ METADATA — logo, renk, pastel arkaplan, etiket
// ══════════════════════════════════════════════════════════════════════════════
const FILE_TYPES = {
  pdf:  { icon: '📕', color: '#dc2626', bg: '#fef2f2', label: 'PDF' },
  doc:  { icon: '📘', color: '#2b579a', bg: '#eff6ff', label: 'Word' },
  docx: { icon: '📘', color: '#2b579a', bg: '#eff6ff', label: 'Word' },
  xls:  { icon: '📗', color: '#217346', bg: '#ecfdf5', label: 'Excel' },
  xlsx: { icon: '📗', color: '#217346', bg: '#ecfdf5', label: 'Excel' },
  ppt:  { icon: '📙', color: '#d24726', bg: '#fff7ed', label: 'PowerPoint' },
  pptx: { icon: '📙', color: '#d24726', bg: '#fff7ed', label: 'PowerPoint' },
  png:  { icon: '🖼', color: '#7c3aed', bg: '#faf5ff', label: 'Resim' },
  jpg:  { icon: '🖼', color: '#7c3aed', bg: '#faf5ff', label: 'Resim' },
  jpeg: { icon: '🖼', color: '#7c3aed', bg: '#faf5ff', label: 'Resim' },
  gif:  { icon: '🖼', color: '#7c3aed', bg: '#faf5ff', label: 'Resim' },
  webp: { icon: '🖼', color: '#7c3aed', bg: '#faf5ff', label: 'Resim' },
  svg:  { icon: '🖼', color: '#7c3aed', bg: '#faf5ff', label: 'Resim' },
  txt:  { icon: '📃', color: '#6b7280', bg: '#f9fafb', label: 'Metin' },
  csv:  { icon: '📊', color: '#059669', bg: '#ecfdf5', label: 'CSV' },
  zip:  { icon: '🗜', color: '#ca8a04', bg: '#fefce8', label: 'Arşiv' },
  rar:  { icon: '🗜', color: '#ca8a04', bg: '#fefce8', label: 'Arşiv' },
};
const DEFAULT_TYPE = { icon: '📎', color: '#6b7280', bg: '#f9fafb', label: 'Dosya' };

const FILTER_GROUPS = [
  { id: '',      label: 'Tüm dosyalar', exts: null },
  { id: 'pdf',   label: 'PDF',          exts: ['pdf'] },
  { id: 'word',  label: 'Word',         exts: ['doc', 'docx'] },
  { id: 'excel', label: 'Excel',        exts: ['xls', 'xlsx'] },
  { id: 'ppt',   label: 'PowerPoint',   exts: ['ppt', 'pptx'] },
  { id: 'image', label: 'Resim',        exts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] },
];

// ══════════════════════════════════════════════════════════════════════════════
// KATEGORİLER — doc_type alanına yazılır
// ══════════════════════════════════════════════════════════════════════════════
const DOC_CATEGORIES = [
  { id: 'report',    icon: '📊', label: 'Rapor' },
  { id: 'meeting',   icon: '🤝', label: 'Toplantı Notu' },
  { id: 'plan',      icon: '📋', label: 'Plan' },
  { id: 'contract',  icon: '📝', label: 'Sözleşme' },
  { id: 'policy',    icon: '⚖',  label: 'Politika' },
  { id: 'proposal',  icon: '💡', label: 'Proje Teklifi' },
  { id: 'form',      icon: '📄', label: 'Form' },
  { id: 'guide',     icon: '📚', label: 'Kılavuz' },
  { id: 'reference', icon: '✉️', label: 'Referans Mektubu' },
  { id: 'document',  icon: '📎', label: 'Diğer' },
];
const DEFAULT_CATEGORY = DOC_CATEGORIES[DOC_CATEGORIES.length - 1];
const getCategory = (id) => DOC_CATEGORIES.find(c => c.id === id) || DEFAULT_CATEGORY;

const extOf = (name) => (name || '').split('.').pop()?.toLowerCase() || '';
const typeOf = (name) => FILE_TYPES[extOf(name)] || DEFAULT_TYPE;

const formatSize = (bytes) => {
  if (!bytes || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const formatDate = (iso) => new Date(iso).toLocaleDateString('tr-TR', {
  day: 'numeric', month: 'short', year: 'numeric',
});

const stripExt = (name) => (name || '').replace(/\.[^.]+$/, '');

// ══════════════════════════════════════════════════════════════════════════════
// ETİKET INPUT — chip tabanlı
// ══════════════════════════════════════════════════════════════════════════════
function TagInput({ value, onChange, placeholder = 'Etiket ekle…' }) {
  const [input, setInput] = useState('');
  const tags = Array.isArray(value) ? value : [];

  const addTag = (raw) => {
    const t = (raw || '').trim().replace(/^#/, '');
    if (!t) return;
    if (tags.includes(t)) { setInput(''); return; }
    onChange([...tags, t]);
    setInput('');
  };
  const removeTag = (t) => onChange(tags.filter(x => x !== t));

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5,
      padding: '6px 8px', borderRadius: 10,
      border: '1.5px solid var(--border)', background: 'var(--bg-hover)',
      minHeight: 40,
    }}>
      {tags.map(t => (
        <span
          key={t}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 4px 3px 9px', borderRadius: 999,
            background: '#e0e7ff', color: '#3730a3',
            fontSize: 11.5, fontWeight: 600,
          }}
        >
          #{t}
          <button
            onClick={() => removeTag(t)}
            aria-label={`${t} etiketini kaldır`}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 13, lineHeight: 1, padding: 0, color: '#3730a3',
              width: 16, height: 16, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(input);
          } else if (e.key === 'Backspace' && !input && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={() => addTag(input)}
        placeholder={tags.length === 0 ? placeholder : ''}
        style={{
          flex: '1 1 120px', minWidth: 80,
          border: 'none', outline: 'none', background: 'transparent',
          fontSize: 13, color: 'var(--text)', padding: '4px 2px',
        }}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ORTAK FORM ALANLARI (isim, kategori, etiket) — modal içeriği
// ══════════════════════════════════════════════════════════════════════════════
function MetaFields({ title, setTitle, category, setCategory, tags, setTags }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3 }}>
          İsim
        </label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Dokümanın görünen adı"
          style={{
            width: '100%', padding: '9px 12px', borderRadius: 10,
            border: '1.5px solid var(--border)', fontSize: 13.5,
            outline: 'none', background: 'var(--bg-hover)', color: 'var(--text)',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3 }}>
          Kategori
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {DOC_CATEGORIES.map(c => {
            const active = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                style={{
                  padding: '6px 11px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                  border: '1.5px solid', cursor: 'pointer',
                  borderColor: active ? 'var(--navy)' : 'var(--border)',
                  background: active ? 'var(--navy)' : 'var(--bg-hover)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  transition: 'all 0.12s',
                }}
              >
                <span style={{ fontSize: 13 }}>{c.icon}</span>
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3 }}>
          Etiketler
        </label>
        <TagInput value={tags} onChange={setTags} />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          Enter veya virgülle ekle. Arama sonuçlarına yardımcı olur.
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// YÜKLEME MODALI
// ══════════════════════════════════════════════════════════════════════════════
function UploadModal({ onClose, onUpload }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('document');
  const [tags, setTags] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setProgress(0);
    try {
      await onUpload(file, {
        title: title.trim() || stripExt(file.name),
        category,
        tags,
      }, (p) => setProgress(p));
      onClose();
    } catch (err) {
      setError(err?.message || String(err));
      setUploading(false);
    }
  };

  const t = file ? typeOf(file.name) : null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10001, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
        overflowY: 'auto', padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget && !uploading) onClose(); }}
    >
      <div style={{
        width: 520, maxWidth: '100%', background: 'var(--bg-card)', borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', padding: 24, maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
            📎 Dosya Yükle
          </h3>
          <span style={{
            fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: 6,
            background: 'rgba(66, 133, 244, 0.12)', color: '#1a73e8',
            border: '1px solid rgba(66, 133, 244, 0.35)',
          }}>
            ☁ Google Drive
          </span>
        </div>

        <div
          style={{
            border: `2px dashed ${file ? (t?.color || 'var(--border)') : 'var(--border)'}`,
            borderRadius: 12, padding: 22, textAlign: 'center', marginBottom: 16,
            cursor: 'pointer', background: file ? t.bg : 'var(--bg-hover)',
            transition: 'all 0.15s',
          }}
          onClick={() => document.getElementById('doc-file-input')?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--navy)'; }}
          onDragLeave={e => { e.currentTarget.style.borderColor = file ? (t?.color || 'var(--border)') : 'var(--border)'; }}
          onDrop={e => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (!f) return;
            const v = validateUploadFile(f, { maxBytes: MAX_DOCUMENT_BYTES, kind: 'document' });
            if (!v.ok) { alert(v.error); return; }
            setFile(f); setTitle(stripExt(f.name));
          }}
        >
          <input id="doc-file-input" type="file" style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0] || null;
              if (!f) { setFile(null); return; }
              const v = validateUploadFile(f, { maxBytes: MAX_DOCUMENT_BYTES, kind: 'document' });
              if (!v.ok) { alert(v.error); e.target.value = ''; setFile(null); return; }
              setFile(f); setTitle(stripExt(f.name));
            }} />
          {file ? (
            <>
              <div style={{ fontSize: 34, marginBottom: 6 }}>{t.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', wordBreak: 'break-word' }}>
                {file.name}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, display: 'flex', justifyContent: 'center', gap: 6 }}>
                <span style={{ color: t.color, fontWeight: 700 }}>{t.label}</span>
                <span>·</span>
                <span>{formatSize(file.size)}</span>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 30, marginBottom: 6 }}>📂</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Dosya sürükleyin veya tıklayarak seçin
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                PDF, Word, Excel, PowerPoint, resim
              </div>
            </>
          )}
        </div>

        <MetaFields
          title={title} setTitle={setTitle}
          category={category} setCategory={setCategory}
          tags={tags} setTags={setTags}
        />

        {uploading && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
              <span>{progress < 100 ? "Drive'a yükleniyor…" : 'Metadata kaydediliyor…'}</span>
              <span>{progress}%</span>
            </div>
            <div style={{ width: '100%', height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${progress}%`, height: '100%',
                background: 'linear-gradient(90deg, #1a73e8, #4285f4)',
                transition: 'width 0.2s',
              }} />
            </div>
          </div>
        )}

        {error && (
          <div style={{
            marginTop: 12, padding: 10, borderRadius: 8,
            background: '#fef2f2', color: '#991b1b', fontSize: 12,
            border: '1px solid #fecaca',
          }}>
            ⚠ {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} disabled={uploading} style={{
            padding: '8px 16px', borderRadius: 10, fontSize: 13,
            cursor: uploading ? 'default' : 'pointer',
            border: '1.5px solid var(--border)', background: 'var(--bg-hover)',
            color: 'var(--text-secondary)', opacity: uploading ? 0.6 : 1,
          }}>İptal</button>
          <button onClick={handleUpload} disabled={!file || uploading} style={{
            padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            border: 'none', cursor: !file || uploading ? 'default' : 'pointer',
            background: !file || uploading ? 'var(--border)' : 'var(--navy)',
            color: '#fff',
          }}>
            {uploading ? 'Yükleniyor…' : 'Yükle'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DÜZENLE MODALI
// ══════════════════════════════════════════════════════════════════════════════
function EditModal({ doc, onClose, onSave }) {
  const [title, setTitle] = useState(doc.title || '');
  const [category, setCategory] = useState(doc.doc_type || 'document');
  const [tags, setTags] = useState(Array.isArray(doc.tags) ? doc.tags : []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const t = typeOf(doc.file_name);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(doc, {
        title: title.trim() || stripExt(doc.file_name || ''),
        category,
        tags,
      });
      onClose();
    } catch (err) {
      setError(err?.message || String(err));
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10001, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
        overflowY: 'auto', padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div style={{
        width: 520, maxWidth: '100%', background: 'var(--bg-card)', borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', padding: 24, maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 42, height: 42,
            background: t.bg, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, border: `1px solid ${t.color}33`, flexShrink: 0,
          }}>
            {t.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
              ✎ Dokümanı Düzenle
            </h3>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {doc.file_name} · {formatSize(doc.file_size)}
            </div>
          </div>
        </div>

        <MetaFields
          title={title} setTitle={setTitle}
          category={category} setCategory={setCategory}
          tags={tags} setTags={setTags}
        />

        {error && (
          <div style={{
            marginTop: 12, padding: 10, borderRadius: 8,
            background: '#fef2f2', color: '#991b1b', fontSize: 12,
            border: '1px solid #fecaca',
          }}>
            ⚠ {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} disabled={saving} style={{
            padding: '8px 16px', borderRadius: 10, fontSize: 13,
            cursor: saving ? 'default' : 'pointer',
            border: '1.5px solid var(--border)', background: 'var(--bg-hover)',
            color: 'var(--text-secondary)', opacity: saving ? 0.6 : 1,
          }}>İptal</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            border: 'none', cursor: saving ? 'default' : 'pointer',
            background: saving ? 'var(--border)' : 'var(--navy)',
            color: '#fff',
          }}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// KARE KART (GRID) — 1:1 aspect ratio
// ══════════════════════════════════════════════════════════════════════════════
function DocCardGrid({ doc, onOpen, onEdit, onDelete }) {
  const t = typeOf(doc.file_name);
  const cat = getCategory(doc.doc_type);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => onOpen(doc)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', aspectRatio: '1 / 1',
        background: 'var(--bg-card)',
        border: `1.5px solid ${hovered ? t.color : 'var(--border)'}`,
        borderTop: `4px solid ${t.color}`,
        borderRadius: 14,
        padding: 12, cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        transition: 'all 0.18s',
        boxShadow: hovered ? `0 8px 22px ${t.color}22` : 'none',
        transform: hovered ? 'translateY(-2px)' : 'none',
        overflow: 'hidden',
      }}
    >
      {/* Eylem butonları (hover'da) */}
      <div style={{
        position: 'absolute', top: 8, right: 8, zIndex: 2,
        display: 'flex', gap: 5,
        opacity: hovered ? 1 : 0, transition: 'opacity 0.15s',
      }}>
        {onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(doc); }}
            title="Düzenle" aria-label="Dokümanı düzenle"
            style={{
              width: 26, height: 26, borderRadius: 7,
              border: '1px solid var(--border)', background: '#fff',
              cursor: 'pointer', fontSize: 12, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#334155', boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
          >
            ✎
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(doc); }}
            title="Sil" aria-label="Dokümanı sil"
            style={{
              width: 26, height: 26, borderRadius: 7,
              border: '1px solid var(--border)', background: '#fff',
              cursor: 'pointer', fontSize: 12, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#dc2626', boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fecaca'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            🗑
          </button>
        )}
      </div>

      {/* Kategori rozeti (sol üst) */}
      {doc.doc_type && doc.doc_type !== 'document' && (
        <div style={{
          position: 'absolute', top: 10, left: 10, zIndex: 2,
          padding: '2px 7px', borderRadius: 999,
          fontSize: 10, fontWeight: 700,
          background: 'rgba(255,255,255,0.9)', color: '#475569',
          border: '1px solid var(--border)',
          display: 'inline-flex', alignItems: 'center', gap: 3,
          maxWidth: '65%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          <span>{cat.icon}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat.label}</span>
        </div>
      )}

      {/* İkon alanı — pastel kare */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: t.bg, borderRadius: 10, marginBottom: 10,
      }}>
        <span style={{ fontSize: 'clamp(36px, 10vw, 54px)', lineHeight: 1 }}>{t.icon}</span>
      </div>

      {/* Bilgi */}
      <div style={{ flexShrink: 0 }}>
        <div style={{
          fontWeight: 600, fontSize: 13, color: 'var(--text)', lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {doc.title}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 5,
          fontSize: 10.5, color: 'var(--text-muted)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          <span style={{
            color: t.color, fontWeight: 700, letterSpacing: 0.2,
            textTransform: 'uppercase', fontSize: 9.5,
          }}>{t.label}</span>
          {doc.file_size ? <><span>·</span><span>{formatSize(doc.file_size)}</span></> : null}
        </div>
        {Array.isArray(doc.tags) && doc.tags.length > 0 && (
          <div style={{
            display: 'flex', gap: 4, marginTop: 6, flexWrap: 'nowrap',
            overflow: 'hidden',
          }}>
            {doc.tags.slice(0, 3).map(tag => (
              <span key={tag} style={{
                padding: '1px 6px', borderRadius: 999,
                fontSize: 9.5, fontWeight: 600,
                background: '#e0e7ff', color: '#3730a3',
                maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                #{tag}
              </span>
            ))}
            {doc.tags.length > 3 && (
              <span style={{ fontSize: 9.5, color: 'var(--text-muted)', padding: '1px 3px' }}>
                +{doc.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LİSTE SATIRI
// ══════════════════════════════════════════════════════════════════════════════
function DocCardList({ doc, onOpen, onEdit, onDelete }) {
  const t = typeOf(doc.file_name);
  const cat = getCategory(doc.doc_type);
  const [hovered, setHovered] = useState(false);
  const hasCat = doc.doc_type && doc.doc_type !== 'document';

  return (
    <div
      onClick={() => onOpen(doc)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px',
        background: hovered ? 'var(--bg-hover)' : 'var(--bg-card)',
        borderLeft: `3px solid ${t.color}`,
        border: '1px solid var(--border)',
        borderLeftWidth: 3,
        borderRadius: 10,
        cursor: 'pointer', transition: 'all 0.12s',
      }}
    >
      {/* İkon kutusu */}
      <div style={{
        width: 38, height: 38, flexShrink: 0,
        background: t.bg, borderRadius: 9,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, border: `1px solid ${t.color}26`,
      }}>
        {t.icon}
      </div>

      {/* Başlık + dosya adı + etiketler */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 600, fontSize: 13.5, color: 'var(--text)', lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {doc.title}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 2,
          fontSize: 11, color: 'var(--text-muted)',
          overflow: 'hidden',
        }}>
          {doc.file_name && doc.file_name !== doc.title && (
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
              {doc.file_name}
            </span>
          )}
          {Array.isArray(doc.tags) && doc.tags.length > 0 && (
            <>
              {doc.file_name && doc.file_name !== doc.title && <span>·</span>}
              <div style={{ display: 'flex', gap: 3, overflow: 'hidden' }}>
                {doc.tags.slice(0, 4).map(tag => (
                  <span key={tag} style={{
                    padding: '1px 6px', borderRadius: 999,
                    fontSize: 10, fontWeight: 600,
                    background: '#e0e7ff', color: '#3730a3',
                    whiteSpace: 'nowrap',
                  }}>#{tag}</span>
                ))}
                {doc.tags.length > 4 && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    +{doc.tags.length - 4}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Kategori */}
      <div style={{
        flexShrink: 0,
        padding: '3px 9px', borderRadius: 999,
        fontSize: 10.5, fontWeight: 700, letterSpacing: 0.2,
        color: hasCat ? '#334155' : 'var(--text-muted)',
        background: hasCat ? 'var(--bg-hover)' : 'transparent',
        border: hasCat ? '1px solid var(--border)' : 'none',
        minWidth: 110, textAlign: 'center',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
      }}>
        {hasCat ? <><span>{cat.icon}</span>{cat.label}</> : '—'}
      </div>

      {/* Tip */}
      <div style={{
        flexShrink: 0,
        padding: '3px 9px', borderRadius: 999,
        fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3,
        color: t.color, background: t.bg, border: `1px solid ${t.color}33`,
        minWidth: 62, textAlign: 'center',
      }}>
        {t.label}
      </div>

      {/* Boyut */}
      <div style={{
        flexShrink: 0, width: 60, textAlign: 'right',
        fontSize: 11.5, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums',
      }}>
        {formatSize(doc.file_size)}
      </div>

      {/* Sahip */}
      <div style={{
        flexShrink: 0, width: 120,
        fontSize: 11.5, color: 'var(--text-muted)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {doc.created_by_name || '—'}
      </div>

      {/* Tarih */}
      <div style={{
        flexShrink: 0, width: 86, textAlign: 'right',
        fontSize: 11.5, color: 'var(--text-muted)',
      }}>
        {formatDate(doc.updated_at || doc.created_at)}
      </div>

      {/* Eylemler */}
      <div style={{ flexShrink: 0, display: 'flex', gap: 2 }}>
        {onEdit ? (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(doc); }}
            title="Düzenle" aria-label="Düzenle"
            style={{
              width: 28, height: 28, borderRadius: 7,
              border: '1px solid transparent', background: 'transparent',
              cursor: 'pointer', fontSize: 12, color: '#475569',
              opacity: hovered ? 1 : 0.4, transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
          >
            ✎
          </button>
        ) : null}
        {onDelete ? (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(doc); }}
            title="Sil" aria-label="Sil"
            style={{
              width: 28, height: 28, borderRadius: 7,
              border: '1px solid transparent', background: 'transparent',
              cursor: 'pointer', fontSize: 12, color: '#dc2626',
              opacity: hovered ? 1 : 0.4, transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fecaca'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
          >
            🗑
          </button>
        ) : null}
        {!onEdit && !onDelete && <div style={{ width: 28 }} />}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ANA BİLEŞEN
// ══════════════════════════════════════════════════════════════════════════════
export default function Documents({ user }) {
  const { profile } = useProfile() || {};
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [search, setSearch] = useState('');
  const [filterId, setFilterId] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  const loadDocs = useCallback(async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .not('file_url', 'is', null)
      .order('updated_at', { ascending: false });
    if (!error) setDocs(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  // ── Dosya aç ──
  const openDoc = useCallback((doc) => {
    if (doc.file_url) {
      window.open(doc.file_url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  // ── Yetki helperleri ──
  const isPrivileged = profile?.role === 'direktor'
    || profile?.role === 'direktor_yardimcisi'
    || profile?.role === 'asistan';

  const canEditDoc = useCallback((doc) => {
    if (!profile?.role) return false;
    if (isPrivileged) return true;
    // Aynı birimdeki herkes düzenleyebilir (RLS ile uyumlu)
    return !!doc.unit && doc.unit === profile?.unit;
  }, [profile?.role, profile?.unit, isPrivileged]);

  const canDeleteDoc = useCallback((doc) => {
    if (!profile?.role) return false;
    if (isPrivileged) return true;
    if (profile?.role === 'koordinator') return !!doc.unit && doc.unit === profile?.unit;
    return false;
  }, [profile?.role, profile?.unit, isPrivileged]);

  // ── Drive yükleme + DB satırı (metadata ile) ──
  const uploadFile = async (file, meta, onProgress) => {
    const result = await uploadDocumentToDrive(file, { onProgress });
    const { error: dbError } = await supabase.from('documents').insert({
      title: meta?.title || stripExt(result.name || file.name),
      doc_type: meta?.category || 'document',
      tags: Array.isArray(meta?.tags) ? meta.tags : [],
      unit: profile?.unit || null,
      created_by: user.id,
      created_by_name: profile?.full_name || user.email,
      updated_by: user.id,
      updated_by_name: profile?.full_name || user.email,
      file_url: result.webViewLink,
      file_name: result.name || file.name,
      file_type: result.mimeType || file.type,
      file_size: result.size || file.size,
    });
    if (dbError) throw new Error('Metadata kaydedilemedi: ' + dbError.message);
    loadDocs();
    logActivity({ action: 'yükledi', module: 'dokümanlar', entityType: 'dosya', entityName: meta?.title || file.name });
  };

  // ── Metadata güncelle ──
  const saveEdit = useCallback(async (doc, meta) => {
    const { data, error } = await supabase
      .from('documents')
      .update({
        title: meta.title,
        doc_type: meta.category || 'document',
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        updated_by: user.id,
        updated_by_name: profile?.full_name || user.email,
      })
      .eq('id', doc.id)
      .select()
      .single();
    if (error) throw new Error(error.message);

    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, ...data } : d));
    logActivity({ action: 'güncelledi', module: 'dokümanlar', entityType: 'dosya', entityName: meta.title });
  }, [user?.id, profile?.full_name]);

  // ── Doküman sil ──
  const deleteDoc = useCallback(async (doc) => {
    const msg = `"${doc.title}" silinsin mi?\n\nDrive'daki dosya da kalıcı olarak silinecek.`;
    if (!window.confirm(msg)) return;

    let driveWarn = null;
    try {
      await deleteDocumentFromDrive(doc.file_url);
    } catch (err) {
      driveWarn = err?.message || String(err);
      console.warn('[drive-delete] failed, proceeding with DB delete:', driveWarn);
    }

    const { error } = await supabase.from('documents').delete().eq('id', doc.id);
    if (error) { alert('Doküman silinemedi: ' + error.message); return; }

    setDocs(prev => prev.filter(d => d.id !== doc.id));
    logActivity({ action: 'sildi', module: 'dokümanlar', entityType: 'dosya', entityName: doc.title });

    if (driveWarn) {
      alert("Doküman silindi ama Drive dosyası silinemedi. Drive'dan manuel silmen gerekebilir.\n\nDetay: " + driveWarn);
    }
  }, []);

  // ── Filtreleme + arama (title, dosya adı, sahip, etiketler) ──
  const filtered = useMemo(() => {
    const group = FILTER_GROUPS.find(g => g.id === filterId);
    return docs.filter(d => {
      if (d.is_archived !== showArchived) return false;
      if (group?.exts && !group.exts.includes(extOf(d.file_name))) return false;
      if (categoryFilter && (d.doc_type || 'document') !== categoryFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const inTitle    = (d.title || '').toLowerCase().includes(s);
        const inFile     = (d.file_name || '').toLowerCase().includes(s);
        const inAuthor   = (d.created_by_name || '').toLowerCase().includes(s);
        const inTags     = Array.isArray(d.tags) && d.tags.some(t => (t || '').toLowerCase().includes(s));
        if (!inTitle && !inFile && !inAuthor && !inTags) return false;
      }
      return true;
    });
  }, [docs, showArchived, filterId, categoryFilter, search]);

  // ══ Render ══
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>
            📄 Dokümanlar
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Tüm dosyalar Google Drive Shared Drive'da saklanır
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          style={{
            padding: '10px 20px', fontSize: 14, borderRadius: 12, fontWeight: 600,
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--navy)', color: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>📎</span> Dosya Yükle
        </button>
      </div>

      {/* Arama + kategori dropdown + arşiv + görünüm toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 10, flexWrap: 'wrap',
      }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 340 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 14, opacity: 0.45 }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="İsim, etiket, dosya adı…"
            style={{
              width: '100%', padding: '9px 12px 9px 34px', borderRadius: 10,
              border: '1.5px solid var(--border)', fontSize: 13,
              outline: 'none', background: 'var(--bg-hover)', color: 'var(--text)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 10, border: '1.5px solid var(--border)',
            fontSize: 12.5, background: 'var(--bg-hover)', color: 'var(--text-secondary)',
            cursor: 'pointer', outline: 'none', fontWeight: 500,
          }}
        >
          <option value="">Tüm kategoriler</option>
          {DOC_CATEGORIES.map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
          ))}
        </select>

        <button
          onClick={() => setShowArchived(!showArchived)}
          style={{
            padding: '7px 12px', borderRadius: 10, fontSize: 12, fontWeight: 500,
            cursor: 'pointer', border: '1.5px solid var(--border)',
            background: showArchived ? 'var(--navy)' : 'var(--bg-hover)',
            color: showArchived ? '#fff' : 'var(--text-secondary)',
          }}
        >
          🗄 {showArchived ? 'Aktif' : 'Arşiv'}
        </button>

        <div style={{
          display: 'flex', borderRadius: 10, overflow: 'hidden',
          border: '1.5px solid var(--border)',
        }}>
          <button
            onClick={() => setViewMode('grid')}
            title="Izgara görünümü" aria-label="Izgara görünümü"
            style={{
              padding: '7px 12px', fontSize: 14, cursor: 'pointer',
              border: 'none',
              background: viewMode === 'grid' ? 'var(--navy)' : 'var(--bg-hover)',
              color: viewMode === 'grid' ? '#fff' : 'var(--text-secondary)',
            }}
          >▦</button>
          <button
            onClick={() => setViewMode('list')}
            title="Liste görünümü" aria-label="Liste görünümü"
            style={{
              padding: '7px 12px', fontSize: 14, cursor: 'pointer',
              border: 'none', borderLeft: '1.5px solid var(--border)',
              background: viewMode === 'list' ? 'var(--navy)' : 'var(--bg-hover)',
              color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)',
            }}
          >☰</button>
        </div>
      </div>

      {/* Dosya tipi pill filtreleri */}
      <div style={{
        display: 'flex', gap: 5, flexWrap: 'wrap',
        marginBottom: 16,
      }}>
        {FILTER_GROUPS.map(g => {
          const active = filterId === g.id;
          return (
            <button
              key={g.id || 'all'}
              onClick={() => setFilterId(g.id)}
              style={{
                padding: '5px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 600,
                border: '1.5px solid', cursor: 'pointer',
                borderColor: active ? 'var(--navy)' : 'var(--border)',
                background: active ? 'var(--navy)' : 'var(--bg-hover)',
                color: active ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.12s',
              }}
            >{g.label}</button>
          );
        })}
      </div>

      {/* İçerik */}
      {filtered.length > 0 ? (
        viewMode === 'grid' ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
            gap: 14,
          }}>
            {filtered.map(doc => (
              <DocCardGrid
                key={doc.id}
                doc={doc}
                onOpen={openDoc}
                onEdit={canEditDoc(doc) ? setEditingDoc : null}
                onDelete={canDeleteDoc(doc) ? deleteDoc : null}
              />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map(doc => (
              <DocCardList
                key={doc.id}
                doc={doc}
                onOpen={openDoc}
                onEdit={canEditDoc(doc) ? setEditingDoc : null}
                onDelete={canDeleteDoc(doc) ? deleteDoc : null}
              />
            ))}
          </div>
        )
      ) : (
        <div style={{
          textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)',
        }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>📂</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>
            {search || filterId || categoryFilter
              ? 'Filtrelerle eşleşen doküman yok'
              : 'Henüz dosya yüklenmemiş'}
          </div>
          <div style={{ fontSize: 13 }}>
            {!search && !filterId && !categoryFilter && "İlk dosyayı yüklemek için üstteki \"Dosya Yükle\" butonunu kullanın."}
          </div>
        </div>
      )}

      {/* Modallar */}
      {showUpload && (
        <UploadModal onClose={() => setShowUpload(false)} onUpload={uploadFile} />
      )}
      {editingDoc && (
        <EditModal
          doc={editingDoc}
          onClose={() => setEditingDoc(null)}
          onSave={saveEdit}
        />
      )}
    </div>
  );
}
