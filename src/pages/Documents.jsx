import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useProfile } from '../App';
import { LiveblocksProvider, RoomProvider, ClientSideSuspense } from '@liveblocks/react/suspense';
import { useCreateBlockNoteWithLiveblocks } from '@liveblocks/react-blocknote';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import '@liveblocks/react-ui/styles.css';

// ── Doküman tipleri ──────────────────────────────────────────────────────────
const DOC_TYPES = [
  { id: 'document', icon: '📄', label: 'Doküman' },
  { id: 'meeting',  icon: '🤝', label: 'Toplantı Notu' },
  { id: 'report',   icon: '📊', label: 'Rapor' },
  { id: 'plan',     icon: '📋', label: 'Plan' },
  { id: 'wiki',     icon: '📚', label: 'Wiki' },
];
const getDocType = (id) => DOC_TYPES.find(t => t.id === id) || DOC_TYPES[0];

// ── BlockNote + Liveblocks collaborative editor ──────────────────────────────
function CollaborativeEditor({ docId, onSaveStatus }) {
  const editor = useCreateBlockNoteWithLiveblocks({}, {
    offlineSupport_experimental: false,
  });

  const lastSavedRef = useRef(null);
  const savingRef = useRef(false);

  // Supabase'e kaydet
  const saveToSupabase = useCallback(async () => {
    if (!editor || savingRef.current) return;
    try {
      const blocks = editor.document;
      const json = JSON.stringify(blocks);
      // Aynı içeriği tekrar kaydetme
      if (json === lastSavedRef.current) return;
      lastSavedRef.current = json;

      savingRef.current = true;
      onSaveStatus?.('saving');
      await supabase.from('documents').update({
        content: blocks,
        updated_at: new Date().toISOString(),
      }).eq('id', docId);
      onSaveStatus?.('saved');
    } catch (err) {
      console.error('Save error:', err);
      onSaveStatus?.('error');
    } finally {
      savingRef.current = false;
    }
  }, [editor, docId, onSaveStatus]);

  // Otomatik kayıt: her 45 saniyede bir
  useEffect(() => {
    const interval = setInterval(() => {
      saveToSupabase();
    }, 45000);
    return () => clearInterval(interval);
  }, [saveToSupabase]);

  // Editörden çıkınca son kayıt
  useEffect(() => {
    return () => { saveToSupabase(); };
  }, [saveToSupabase]);

  // Manuel kayıt fonksiyonunu parent'a expose et
  useEffect(() => {
    if (window._docManualSave) window._docManualSave = null;
    window._docManualSave = saveToSupabase;
    return () => { window._docManualSave = null; };
  }, [saveToSupabase]);

  // Mevcut içeriği yükle (ilk açılışta)
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!editor || loadedRef.current) return;
    loadedRef.current = true;
    (async () => {
      const { data } = await supabase.from('documents').select('content').eq('id', docId).single();
      if (data?.content && Array.isArray(data.content) && data.content.length > 0) {
        try { editor.replaceBlocks(editor.document, data.content); } catch (e) { /* Liveblocks zaten yüklemiş olabilir */ }
      }
    })();
  }, [editor, docId]);

  return (
    <div className="collab-editor-wrapper">
      <BlockNoteView
        editor={editor}
        theme="light"
        sideMenu={true}
        slashMenu={true}
        formattingToolbar={true}
        hyperlinkToolbar={true}
        imageToolbar={true}
        tableHandles={true}
      />
    </div>
  );
}

// ── Kayıt durumu göstergesi ──────────────────────────────────────────────────
function SaveIndicator({ status }) {
  const labels = { unsaved: '● Kaydedilmemiş', saving: '↻ Kaydediliyor…', saved: '✓ Kaydedildi', error: '✕ Kayıt hatası' };
  const colors = { unsaved: '#f59e0b', saving: '#6b7280', saved: '#22c55e', error: '#ef4444' };
  return (
    <span style={{ fontSize: 11.5, color: colors[status] || '#9ca3af', fontWeight: 500 }}>
      {labels[status] || ''}
    </span>
  );
}

// ── Room'lu editör wrapper ───────────────────────────────────────────────────
function DocumentEditor({ doc, user, profile, onBack }) {
  const roomId = doc.liveblocks_room_id || `doc-${doc.id}`;
  const [saveStatus, setSaveStatus] = useState('saved');

  const authEndpoint = useCallback(async () => {
    const res = await fetch('/api/liveblocks-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        userName: profile?.full_name || user.email,
        userUnit: profile?.unit || '',
        room: roomId,
      }),
    });
    return res.json();
  }, [user, profile, roomId]);

  const handleManualSave = () => {
    if (window._docManualSave) window._docManualSave();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Editor header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', marginBottom: 8,
        borderBottom: '1px solid var(--border, #e5e7eb)',
      }}>
        <button onClick={() => { handleManualSave(); setTimeout(onBack, 300); }} style={{
          border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, padding: '4px 8px',
          borderRadius: 8, color: 'var(--text-muted, #6b7280)',
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover, #f3f4f6)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >←</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text, #111827)' }}>
              {getDocType(doc.doc_type).icon} {doc.title}
            </span>
            <SaveIndicator status={saveStatus} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #9ca3af)', marginTop: 2 }}>
            {doc.created_by_name} tarafından oluşturuldu · Canlı düzenleme aktif
          </div>
        </div>
        <button onClick={handleManualSave} title="Şimdi kaydet" style={{
          padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          border: '1.5px solid var(--border, #e5e7eb)', background: 'var(--bg, #f9fafb)',
          color: 'var(--text, #374151)', cursor: 'pointer',
        }}>
          💾 Kaydet
        </button>
      </div>

      {/* Liveblocks + BlockNote editor */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <LiveblocksProvider authEndpoint={authEndpoint}>
          <RoomProvider id={roomId}>
            <ClientSideSuspense fallback={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8, color: 'var(--text-muted, #9ca3af)' }}>
                <div className="loading-spinner" style={{ width: 20, height: 20 }} />
                <span>Doküman yükleniyor…</span>
              </div>
            }>
              <CollaborativeEditor docId={doc.id} onSaveStatus={setSaveStatus} />
            </ClientSideSuspense>
          </RoomProvider>
        </LiveblocksProvider>
      </div>
    </div>
  );
}

// ── Yeni doküman oluşturma modalı ────────────────────────────────────────────
function NewDocModal({ onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('document');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    await onCreate(title.trim(), docType);
    setCreating(false);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: 440, background: 'var(--bg-card, #fff)', borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', padding: 24,
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: 'var(--text, #111827)' }}>
          📄 Yeni Doküman
        </h3>
        <input value={title} onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="Doküman başlığı…" autoFocus
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14,
            border: '1.5px solid var(--border, #e5e7eb)', outline: 'none',
            background: 'var(--bg, #f9fafb)', color: 'var(--text, #111827)',
            boxSizing: 'border-box', marginBottom: 12,
          }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {DOC_TYPES.map(t => (
            <button key={t.id} onClick={() => setDocType(t.id)}
              style={{
                padding: '6px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                border: '1.5px solid var(--border, #e5e7eb)', transition: 'all 0.1s',
                background: docType === t.id ? 'var(--navy, #1a3a5c)' : 'var(--bg, #f9fafb)',
                color: docType === t.id ? '#fff' : 'var(--text, #374151)',
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
            border: '1.5px solid var(--border, #e5e7eb)', background: 'var(--bg, #f9fafb)',
            color: 'var(--text, #374151)',
          }}>İptal</button>
          <button onClick={handleCreate} disabled={!title.trim() || creating}
            style={{
              padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              border: 'none', cursor: !title.trim() || creating ? 'default' : 'pointer',
              background: !title.trim() || creating ? 'var(--border, #e5e7eb)' : 'var(--navy, #1a3a5c)',
              color: '#fff',
            }}>
            {creating ? 'Oluşturuluyor…' : 'Oluştur'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Dosya yükleme modalı ─────────────────────────────────────────────────────
function UploadModal({ onClose, onUpload }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    await onUpload(file);
    setUploading(false);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: 440, background: 'var(--bg-card, #fff)', borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', padding: 24,
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: 'var(--text, #111827)' }}>
          📎 Dosya Yükle
        </h3>
        <div style={{
          border: '2px dashed var(--border, #e5e7eb)', borderRadius: 12, padding: 32,
          textAlign: 'center', marginBottom: 16, cursor: 'pointer',
          background: file ? 'var(--bg, #f0fdf4)' : 'var(--bg, #f9fafb)',
        }}
          onClick={() => document.getElementById('doc-file-input')?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--navy, #1a3a5c)'; }}
          onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border, #e5e7eb)'; }}
          onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]); e.currentTarget.style.borderColor = 'var(--border, #e5e7eb)'; }}
        >
          <input id="doc-file-input" type="file" style={{ display: 'none' }}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg"
            onChange={e => setFile(e.target.files?.[0] || null)} />
          {file ? (
            <>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📎</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text, #111827)' }}>{file.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted, #9ca3af)', marginTop: 4 }}>
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
              <div style={{ fontSize: 14, color: 'var(--text-muted, #6b7280)' }}>
                Dosya sürükleyin veya tıklayarak seçin
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted, #9ca3af)', marginTop: 4 }}>
                PDF, Word, Excel, PowerPoint, resim desteklenir
              </div>
            </>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
            border: '1.5px solid var(--border, #e5e7eb)', background: 'var(--bg, #f9fafb)',
            color: 'var(--text, #374151)',
          }}>İptal</button>
          <button onClick={handleUpload} disabled={!file || uploading}
            style={{
              padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              border: 'none', cursor: !file || uploading ? 'default' : 'pointer',
              background: !file || uploading ? 'var(--border, #e5e7eb)' : 'var(--navy, #1a3a5c)',
              color: '#fff',
            }}>
            {uploading ? 'Yükleniyor…' : 'Yükle'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Doküman kartı ────────────────────────────────────────────────────────────
function DocCard({ doc, onClick }) {
  const type = getDocType(doc.doc_type);
  const isFile = !!doc.file_url;
  const dateStr = new Date(doc.updated_at || doc.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });

  const FILE_ICONS = { pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗', ppt: '📙', pptx: '📙', png: '🖼', jpg: '🖼', jpeg: '🖼', txt: '📃', csv: '📊' };
  const ext = doc.file_name?.split('.').pop()?.toLowerCase();
  const fileIcon = FILE_ICONS[ext] || '📎';

  return (
    <div onClick={onClick}
      style={{
        background: 'var(--bg-card, #fff)', border: '1px solid var(--border, #e5e7eb)',
        borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'all 0.15s',
        display: 'flex', flexDirection: 'column', gap: 8, minHeight: 120,
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 28 }}>{isFile ? fileIcon : type.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text, #111827)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {doc.title}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #9ca3af)', marginTop: 2 }}>
            {isFile ? (doc.file_name || 'Dosya') : type.label}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-muted, #9ca3af)' }}>
        <span>{doc.created_by_name || 'Bilinmiyor'}</span>
        <span>{dateStr}</span>
      </div>
      {doc.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {doc.tags.map(t => (
            <span key={t} style={{ padding: '1px 8px', borderRadius: 8, fontSize: 10, background: 'rgba(0,0,0,0.05)', color: 'var(--text-muted, #6b7280)' }}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ANA DOCUMENTS BİLEŞENİ
// ══════════════════════════════════════════════════════════════════════════════
export default function Documents({ user }) {
  const { profile } = useProfile() || {};
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeDoc, setActiveDoc] = useState(null);
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // ── Dokümanları yükle ──────────────────────────────────────────────────────
  const loadDocs = useCallback(async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('updated_at', { ascending: false });
    if (!error) setDocs(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  // ── Yeni doküman oluştur ───────────────────────────────────────────────────
  const createDocument = async (title, docType) => {
    const roomId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { data, error } = await supabase.from('documents').insert({
      title,
      doc_type: docType,
      unit: profile?.unit || null,
      created_by: user.id,
      created_by_name: profile?.full_name || user.email,
      updated_by: user.id,
      updated_by_name: profile?.full_name || user.email,
      liveblocks_room_id: roomId,
    }).select().single();
    if (!error && data) {
      loadDocs();
      setActiveDoc(data);
    }
  };

  // ── Dosya yükle ────────────────────────────────────────────────────────────
  const uploadFile = async (file) => {
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file);
    if (uploadError) { alert('Yükleme hatası: ' + uploadError.message); return; }

    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
    const fileUrl = urlData?.publicUrl;

    await supabase.from('documents').insert({
      title: file.name.replace(/\.[^.]+$/, ''),
      doc_type: 'document',
      unit: profile?.unit || null,
      created_by: user.id,
      created_by_name: profile?.full_name || user.email,
      updated_by: user.id,
      updated_by_name: profile?.full_name || user.email,
      file_url: fileUrl,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
    });
    loadDocs();
  };

  // ── Filtreleme ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => docs.filter(d => {
    if (d.is_archived !== showArchived) return false;
    if (filterType && d.doc_type !== filterType) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!(d.title || '').toLowerCase().includes(s) && !(d.created_by_name || '').toLowerCase().includes(s)) return false;
    }
    return true;
  }), [docs, showArchived, filterType, search]);

  // ── Editör görünümü ────────────────────────────────────────────────────────
  if (activeDoc) {
    if (activeDoc.file_url) {
      window.open(activeDoc.file_url, '_blank');
      setActiveDoc(null);
      return null;
    }
    return (
      <DocumentEditor
        doc={activeDoc}
        user={user}
        profile={profile}
        onBack={() => { setActiveDoc(null); loadDocs(); }}
      />
    );
  }

  // ── Liste görünümü ─────────────────────────────────────────────────────────
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text, #111827)' }}>📄 Dokümanlar</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted, #9ca3af)' }}>
            Biriminizle canlı olarak birlikte çalışın
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowUpload(true)} style={{
            padding: '10px 16px', fontSize: 13, borderRadius: 12, cursor: 'pointer', fontWeight: 500,
            border: '1.5px solid var(--border, #e5e7eb)', background: 'var(--bg, #f9fafb)',
            color: 'var(--text, #374151)', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            📎 Dosya Yükle
          </button>
          <button onClick={() => setShowNewDoc(true)} style={{
            padding: '10px 20px', fontSize: 14, borderRadius: 12, fontWeight: 600,
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--navy, #1a3a5c)', color: '#fff',
          }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Yeni Doküman
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, opacity: 0.4 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Doküman ara…"
            style={{
              width: '100%', padding: '8px 12px 8px 32px', borderRadius: 10,
              border: '1.5px solid var(--border, #e5e7eb)', fontSize: 13,
              outline: 'none', background: 'var(--bg, #f9fafb)', color: 'var(--text, #111827)',
              boxSizing: 'border-box',
            }} />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 10, border: '1.5px solid var(--border, #e5e7eb)',
            fontSize: 12.5, background: 'var(--bg, #f9fafb)', color: 'var(--text, #374151)',
            cursor: 'pointer', outline: 'none',
          }}>
          <option value="">Tüm türler</option>
          {DOC_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
        </select>
        <button onClick={() => setShowArchived(!showArchived)}
          style={{
            padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            border: '1.5px solid var(--border, #e5e7eb)',
            background: showArchived ? 'var(--navy, #1a3a5c)' : 'var(--bg, #f9fafb)',
            color: showArchived ? '#fff' : 'var(--text, #374151)',
          }}>
          🗄 {showArchived ? 'Aktif' : 'Arşiv'}
        </button>
      </div>

      {/* Document grid */}
      {filtered.length > 0 ? (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 12,
        }}>
          {filtered.map(doc => (
            <DocCard key={doc.id} doc={doc} onClick={() => setActiveDoc(doc)} />
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted, #9ca3af)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: 'var(--text, #6b7280)' }}>
            {search || filterType ? 'Filtrelerle eşleşen doküman yok' : 'Henüz doküman oluşturulmamış'}
          </div>
          <div style={{ fontSize: 13 }}>
            {!search && !filterType && 'İlk dokümanınızı oluşturmak için "Yeni Doküman" butonuna tıklayın.'}
          </div>
        </div>
      )}

      {/* Modals */}
      {showNewDoc && <NewDocModal onClose={() => setShowNewDoc(false)} onCreate={createDocument} />}
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onUpload={uploadFile} />}

      {/* Editor styles */}
      <style>{`
        .collab-editor-wrapper {
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 12px;
          background: var(--bg-card, #fff);
          display: flex;
          flex-direction: column;
          height: calc(100vh - 200px);
          overflow: hidden;
        }
        .collab-editor-wrapper .bn-editor {
          flex: 1;
          overflow-y: auto;
          padding: 16px 24px;
        }
        .collab-editor-wrapper .bn-container {
          height: 100%;
        }
      `}</style>
    </div>
  );
}
