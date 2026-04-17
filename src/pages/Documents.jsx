import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, logActivity, uploadDocumentToDrive, deleteDocumentFromDrive } from '../lib/supabase';
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

// ══════════════════════════════════════════════════════════════════════════════
// YÜKLEME MODALI
// ══════════════════════════════════════════════════════════════════════════════
function UploadModal({ onClose, onUpload }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setProgress(0);
    try {
      await onUpload(file, (p) => setProgress(p));
      onClose();
    } catch (err) {
      setError(err?.message || String(err));
      setUploading(false);
    }
  };

  const t = file ? typeOf(file.name) : null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10001, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: 460, background: 'var(--bg-card)', borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', padding: 24,
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
            borderRadius: 12, padding: 28, textAlign: 'center', marginBottom: 16,
            cursor: 'pointer', background: file ? t.bg : 'var(--bg-hover)',
            transition: 'all 0.15s',
          }}
          onClick={() => document.getElementById('doc-file-input')?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--navy)'; }}
          onDragLeave={e => { e.currentTarget.style.borderColor = file ? (t?.color || 'var(--border)') : 'var(--border)'; }}
          onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]); }}
        >
          <input id="doc-file-input" type="file" style={{ display: 'none' }}
            onChange={e => setFile(e.target.files?.[0] || null)} />
          {file ? (
            <>
              <div style={{ fontSize: 42, marginBottom: 8 }}>{t.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', wordBreak: 'break-word' }}>
                {file.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, display: 'flex', justifyContent: 'center', gap: 8 }}>
                <span style={{ color: t.color, fontWeight: 700 }}>{t.label}</span>
                <span>·</span>
                <span>{formatSize(file.size)}</span>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 34, marginBottom: 8 }}>📂</div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                Dosya sürükleyin veya tıklayarak seçin
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
                PDF, Word, Excel, PowerPoint, resim
              </div>
            </>
          )}
        </div>

        {uploading && (
          <div style={{ marginBottom: 12 }}>
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
            marginBottom: 12, padding: 10, borderRadius: 8,
            background: '#fef2f2', color: '#991b1b', fontSize: 12,
            border: '1px solid #fecaca',
          }}>
            ⚠ {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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
// KARE KART (GRID) — 1:1 aspect ratio
// ══════════════════════════════════════════════════════════════════════════════
function DocCardGrid({ doc, onOpen, onDelete }) {
  const t = typeOf(doc.file_name);
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
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(doc); }}
          title="Dokümanı sil" aria-label="Dokümanı sil"
          style={{
            position: 'absolute', top: 8, right: 8, zIndex: 2,
            width: 26, height: 26, borderRadius: 7,
            border: '1px solid var(--border)',
            background: '#fff', opacity: hovered ? 1 : 0,
            transition: 'opacity 0.15s',
            cursor: 'pointer', fontSize: 12, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#dc2626', boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fecaca'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          🗑
        </button>
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
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LİSTE SATIRI
// ══════════════════════════════════════════════════════════════════════════════
function DocCardList({ doc, onOpen, onDelete }) {
  const t = typeOf(doc.file_name);
  const [hovered, setHovered] = useState(false);

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

      {/* Başlık + dosya adı */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 600, fontSize: 13.5, color: 'var(--text)', lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {doc.title}
        </div>
        {doc.file_name && doc.file_name !== doc.title && (
          <div style={{
            fontSize: 11, color: 'var(--text-muted)', marginTop: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {doc.file_name}
          </div>
        )}
      </div>

      {/* Tip etiketi */}
      <div style={{
        flexShrink: 0,
        padding: '3px 9px', borderRadius: 999,
        fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3,
        color: t.color, background: t.bg, border: `1px solid ${t.color}33`,
        minWidth: 70, textAlign: 'center',
      }}>
        {t.label}
      </div>

      {/* Boyut */}
      <div style={{
        flexShrink: 0, width: 70, textAlign: 'right',
        fontSize: 11.5, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums',
      }}>
        {formatSize(doc.file_size)}
      </div>

      {/* Sahip */}
      <div style={{
        flexShrink: 0, width: 130,
        fontSize: 11.5, color: 'var(--text-muted)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {doc.created_by_name || '—'}
      </div>

      {/* Tarih */}
      <div style={{
        flexShrink: 0, width: 90, textAlign: 'right',
        fontSize: 11.5, color: 'var(--text-muted)',
      }}>
        {formatDate(doc.updated_at || doc.created_at)}
      </div>

      {/* Sil */}
      {onDelete ? (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(doc); }}
          title="Dokümanı sil" aria-label="Dokümanı sil"
          style={{
            flexShrink: 0, width: 30, height: 30, borderRadius: 7,
            border: '1px solid transparent',
            background: 'transparent',
            cursor: 'pointer', fontSize: 13,
            color: '#dc2626',
            opacity: hovered ? 1 : 0.35, transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fecaca'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
        >
          🗑
        </button>
      ) : (
        <div style={{ width: 30 }} />
      )}
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
  const [search, setSearch] = useState('');
  const [filterId, setFilterId] = useState('');
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

  // ── Drive yükleme + DB satırı ──
  const uploadFile = async (file, onProgress) => {
    const result = await uploadDocumentToDrive(file, { onProgress });
    const { error: dbError } = await supabase.from('documents').insert({
      title: (result.name || file.name).replace(/\.[^.]+$/, ''),
      doc_type: 'document',
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
    logActivity({ action: 'yükledi', module: 'dokümanlar', entityType: 'dosya', entityName: file.name });
  };

  // ── Silme yetkisi ──
  const canDeleteDoc = useCallback((doc) => {
    const role = profile?.role;
    if (!role) return false;
    if (role === 'direktor' || role === 'direktor_yardimcisi' || role === 'asistan') return true;
    if (role === 'koordinator') return !!doc.unit && doc.unit === profile?.unit;
    return false;
  }, [profile?.role, profile?.unit]);

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

  // ── Filtreleme ──
  const filtered = useMemo(() => {
    const group = FILTER_GROUPS.find(g => g.id === filterId);
    return docs.filter(d => {
      if (d.is_archived !== showArchived) return false;
      if (group?.exts) {
        if (!group.exts.includes(extOf(d.file_name))) return false;
      }
      if (search) {
        const s = search.toLowerCase();
        if (!(d.title || '').toLowerCase().includes(s) &&
            !(d.file_name || '').toLowerCase().includes(s) &&
            !(d.created_by_name || '').toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [docs, showArchived, filterId, search]);

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

      {/* Kontroller */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 16, flexWrap: 'wrap',
      }}>
        {/* Arama */}
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 340 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 14, opacity: 0.45 }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Doküman ara…"
            style={{
              width: '100%', padding: '9px 12px 9px 34px', borderRadius: 10,
              border: '1.5px solid var(--border)', fontSize: 13,
              outline: 'none', background: 'var(--bg-hover)', color: 'var(--text)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Tip filtresi (pill'ler) */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: '1 1 auto' }}>
          {FILTER_GROUPS.map(g => {
            const active = filterId === g.id;
            return (
              <button
                key={g.id || 'all'}
                onClick={() => setFilterId(g.id)}
                style={{
                  padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                  border: '1.5px solid', cursor: 'pointer',
                  borderColor: active ? 'var(--navy)' : 'var(--border)',
                  background: active ? 'var(--navy)' : 'var(--bg-hover)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.12s',
                }}
              >
                {g.label}
              </button>
            );
          })}
        </div>

        {/* Arşiv toggle */}
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

        {/* Görünüm toggle */}
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
          >
            ▦
          </button>
          <button
            onClick={() => setViewMode('list')}
            title="Liste görünümü" aria-label="Liste görünümü"
            style={{
              padding: '7px 12px', fontSize: 14, cursor: 'pointer',
              border: 'none', borderLeft: '1.5px solid var(--border)',
              background: viewMode === 'list' ? 'var(--navy)' : 'var(--bg-hover)',
              color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            ☰
          </button>
        </div>
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
            {search || filterId
              ? 'Filtrelerle eşleşen doküman yok'
              : 'Henüz dosya yüklenmemiş'}
          </div>
          <div style={{ fontSize: 13 }}>
            {!search && !filterId && "İlk dosyayı yüklemek için üstteki \"Dosya Yükle\" butonunu kullanın."}
          </div>
        </div>
      )}

      {/* Modal */}
      {showUpload && (
        <UploadModal onClose={() => setShowUpload(false)} onUpload={uploadFile} />
      )}
    </div>
  );
}
