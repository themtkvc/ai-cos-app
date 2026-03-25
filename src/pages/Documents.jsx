import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useProfile } from '../App';
import { LiveblocksProvider, RoomProvider, ClientSideSuspense } from '@liveblocks/react/suspense';
import { useLiveblocksExtension, FloatingToolbar } from '@liveblocks/react-tiptap';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import '@liveblocks/react-ui/styles.css';
import '@liveblocks/react-tiptap/styles.css';

// ── Doküman tipleri ──────────────────────────────────────────────────────────
const DOC_TYPES = [
  { id: 'document', icon: '📄', label: 'Doküman' },
  { id: 'meeting',  icon: '🤝', label: 'Toplantı Notu' },
  { id: 'report',   icon: '📊', label: 'Rapor' },
  { id: 'plan',     icon: '📋', label: 'Plan' },
  { id: 'wiki',     icon: '📚', label: 'Wiki' },
];
const getDocType = (id) => DOC_TYPES.find(t => t.id === id) || DOC_TYPES[0];

// ── Liveblocks collaborative editor ──────────────────────────────────────────
function CollaborativeEditor() {
  const liveblocks = useLiveblocksExtension();

  const editor = useEditor({
    extensions: [
      liveblocks,
      StarterKit.configure({ history: false }),
      Placeholder.configure({ placeholder: 'Yazmaya başlayın… Ekibiniz canlı olarak görebilir.' }),
      Underline,
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    editorProps: {
      attributes: {
        class: 'collab-editor-content',
      },
    },
  });

  return (
    <div className="collab-editor-wrapper">
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
      <FloatingToolbar editor={editor} />
    </div>
  );
}

// ── Editör toolbar ───────────────────────────────────────────────────────────
function EditorToolbar({ editor }) {
  if (!editor) return null;

  const ToolBtn = ({ onClick, active, icon, title }) => (
    <button onClick={onClick} title={title}
      style={{
        width: 32, height: 32, border: 'none', borderRadius: 6,
        background: active ? 'var(--navy, #1a3a5c)' : 'transparent',
        color: active ? '#fff' : 'var(--text, #374151)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: active ? 700 : 400, transition: 'all 0.1s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover, #f3f4f6)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >{icon}</button>
  );

  const Sep = () => <div style={{ width: 1, height: 22, background: 'var(--border, #e5e7eb)', margin: '0 3px', alignSelf: 'center' }} />;

  return (
    <div style={{
      display: 'flex', gap: 2, padding: '8px 12px', borderBottom: '1px solid var(--border, #e5e7eb)',
      background: 'var(--bg, #f9fafb)', borderRadius: '12px 12px 0 0', flexWrap: 'wrap', alignItems: 'center',
    }}>
      <ToolBtn icon={<b>B</b>} title="Kalın" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
      <ToolBtn icon={<i>I</i>} title="İtalik" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <ToolBtn icon={<u>U</u>} title="Altı çizili" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} />
      <ToolBtn icon={<s>S</s>} title="Üstü çizili" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} />
      <ToolBtn icon="🖍" title="Vurgula" active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()} />
      <Sep />
      <ToolBtn icon="H1" title="Başlık 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
      <ToolBtn icon="H2" title="Başlık 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
      <ToolBtn icon="H3" title="Başlık 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
      <Sep />
      <ToolBtn icon="•" title="Madde listesi" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
      <ToolBtn icon="1." title="Numaralı liste" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
      <ToolBtn icon="☑" title="Yapılacaklar" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} />
      <Sep />
      <ToolBtn icon="⇤" title="Sola hizala" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} />
      <ToolBtn icon="⇔" title="Ortala" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} />
      <ToolBtn icon="⇥" title="Sağa hizala" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} />
      <Sep />
      <ToolBtn icon="▦" title="Tablo ekle" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
      <ToolBtn icon="—" title="Ayraç" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
      <ToolBtn icon="❝" title="Alıntı" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
      <ToolBtn icon="<>" title="Kod" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
    </div>
  );
}

// ── Room'lu editör wrapper ───────────────────────────────────────────────────
function DocumentEditor({ doc, user, profile, onBack }) {
  const roomId = doc.liveblocks_room_id || `doc-${doc.id}`;

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Editor header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', marginBottom: 8,
        borderBottom: '1px solid var(--border, #e5e7eb)',
      }}>
        <button onClick={onBack} style={{
          border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, padding: '4px 8px',
          borderRadius: 8, color: 'var(--text-muted, #6b7280)',
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover, #f3f4f6)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text, #111827)' }}>
            {getDocType(doc.doc_type).icon} {doc.title}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #9ca3af)', marginTop: 2 }}>
            {doc.created_by_name} tarafından oluşturuldu · Canlı düzenleme aktif
          </div>
        </div>
      </div>

      {/* Liveblocks editor */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <LiveblocksProvider authEndpoint={authEndpoint}>
          <RoomProvider id={roomId}>
            <ClientSideSuspense fallback={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8, color: 'var(--text-muted, #9ca3af)' }}>
                <div className="loading-spinner" style={{ width: 20, height: 20 }} />
                <span>Doküman yükleniyor…</span>
              </div>
            }>
              <CollaborativeEditor />
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

  // ── Doküman sil ────────────────────────────────────────────────────────────
  const deleteDoc = async (id) => {
    if (!window.confirm('Bu dokümanı silmek istediğinize emin misiniz?')) return;
    await supabase.from('documents').delete().eq('id', id);
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
    // Dosya ise doğrudan aç
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
        .collab-editor-content {
          padding: 24px 32px;
          min-height: 400px;
          outline: none;
          font-size: 15px;
          line-height: 1.8;
          color: var(--text, #111827);
        }
        .collab-editor-content h1 { font-size: 28px; font-weight: 800; margin: 24px 0 12px; }
        .collab-editor-content h2 { font-size: 22px; font-weight: 700; margin: 20px 0 10px; }
        .collab-editor-content h3 { font-size: 18px; font-weight: 600; margin: 16px 0 8px; }
        .collab-editor-content p { margin: 0 0 8px; }
        .collab-editor-content ul, .collab-editor-content ol { padding-left: 24px; margin: 8px 0; }
        .collab-editor-content blockquote {
          border-left: 3px solid var(--navy, #1a3a5c);
          padding-left: 16px; margin: 12px 0;
          color: var(--text-muted, #6b7280); font-style: italic;
        }
        .collab-editor-content pre {
          background: var(--bg, #f3f4f6); border-radius: 8px;
          padding: 12px 16px; font-size: 13px; overflow-x: auto;
        }
        .collab-editor-content table {
          border-collapse: collapse; width: 100%; margin: 12px 0;
        }
        .collab-editor-content th, .collab-editor-content td {
          border: 1px solid var(--border, #e5e7eb);
          padding: 8px 12px; text-align: left; font-size: 14px;
        }
        .collab-editor-content th {
          background: var(--bg, #f3f4f6); font-weight: 600;
        }
        .collab-editor-content ul[data-type="taskList"] {
          list-style: none; padding-left: 0;
        }
        .collab-editor-content ul[data-type="taskList"] li {
          display: flex; align-items: flex-start; gap: 8px;
        }
        .collab-editor-content ul[data-type="taskList"] li label input {
          margin-top: 4px;
        }
        .collab-editor-content mark { background: #fef08a; padding: 0 2px; border-radius: 2px; }
        .collab-editor-content hr { border: none; border-top: 1.5px solid var(--border, #e5e7eb); margin: 20px 0; }
        .collab-editor-content .tiptap { height: 100%; overflow-y: auto; }
        .collab-editor-wrapper .tiptap { flex: 1; overflow-y: auto; }
        .collab-editor-content .collaboration-cursor__caret {
          position: relative;
          border-left: 2px solid;
          margin-right: -2px;
        }
        .collab-editor-content .collaboration-cursor__label {
          position: absolute;
          top: -1.4em;
          left: -2px;
          font-size: 11px;
          font-weight: 600;
          padding: 1px 6px;
          border-radius: 4px 4px 4px 0;
          color: #fff;
          white-space: nowrap;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
