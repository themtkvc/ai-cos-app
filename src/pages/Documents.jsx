import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase, logActivity } from '../lib/supabase';
import { useProfile } from '../App';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';

// ── Doküman tipleri ──────────────────────────────────────────────────────────
const DOC_TYPES = [
  { id: 'document', icon: '📄', label: 'Doküman' },
  { id: 'meeting',  icon: '🤝', label: 'Toplantı Notu' },
  { id: 'report',   icon: '📊', label: 'Rapor' },
  { id: 'plan',     icon: '📋', label: 'Plan' },
  { id: 'wiki',     icon: '📚', label: 'Wiki' },
];
const getDocType = (id) => DOC_TYPES.find(t => t.id === id) || DOC_TYPES[0];

// ── Toolbar buton yardımcısı ─────────────────────────────────────────────────
function ToolBtn({ onClick, active, title, children, style: extraStyle }) {
  return (
    <button
      onClick={onClick} title={title}
      style={{
        padding: '4px 8px', borderRadius: 6, fontSize: 13, lineHeight: 1,
        border: 'none', cursor: 'pointer',
        background: active ? '#e0e7ff' : 'transparent',
        color: active ? '#4338ca' : 'var(--text-secondary)',
        fontWeight: active ? 700 : 500,
        minWidth: 28, textAlign: 'center',
        ...extraStyle,
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--gray-light)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}

// ── TipTap Toolbar ──────────────────────────────────────────────────────────
function EditorToolbar({ editor }) {
  if (!editor) return null;

  const addImage = () => {
    const url = window.prompt('Resim URL:');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const setLink = () => {
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('Link URL:', prev || 'https://');
    if (url === null) return;
    if (url === '') { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div style={{
      display: 'flex', gap: 2, flexWrap: 'wrap', padding: '8px 12px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-hover)', borderRadius: '12px 12px 0 0',
      alignItems: 'center',
    }}>
      {/* Başlıklar */}
      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Başlık 1">H1</ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Başlık 2">H2</ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Başlık 3">H3</ToolBtn>

      <div style={{ width: 1, height: 20, background: 'var(--gray-mid)', margin: '0 4px' }} />

      {/* Metin stili */}
      <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Kalın"><b>B</b></ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="İtalik"><i>I</i></ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Altı çizili"><u>U</u></ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Üstü çizili"><s>S</s></ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Vurgula" style={{ background: editor.isActive('highlight') ? '#fef08a' : undefined }}>🖍</ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Satır içi kod" style={{ fontFamily: 'monospace' }}>&lt;&gt;</ToolBtn>

      <div style={{ width: 1, height: 20, background: 'var(--gray-mid)', margin: '0 4px' }} />

      {/* Hizalama */}
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Sola hizala">⫷</ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Ortala">☰</ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Sağa hizala">⫸</ToolBtn>

      <div style={{ width: 1, height: 20, background: 'var(--gray-mid)', margin: '0 4px' }} />

      {/* Listeler */}
      <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Madde listesi">• ─</ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numaralı liste">1. ─</ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Görev listesi">☑</ToolBtn>

      <div style={{ width: 1, height: 20, background: 'var(--gray-mid)', margin: '0 4px' }} />

      {/* Bloklar */}
      <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Alıntı">❝</ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Kod bloğu">{'{ }'}</ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Yatay çizgi">─</ToolBtn>

      <div style={{ width: 1, height: 20, background: 'var(--gray-mid)', margin: '0 4px' }} />

      {/* Tablo */}
      <ToolBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Tablo ekle">⊞</ToolBtn>
      {editor.isActive('table') && (
        <>
          <ToolBtn onClick={() => editor.chain().focus().addColumnAfter().run()} title="Sütun ekle">+▮</ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().addRowAfter().run()} title="Satır ekle">+▬</ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().deleteTable().run()} title="Tabloyu sil" style={{ color: 'var(--red)' }}>🗑</ToolBtn>
        </>
      )}

      <div style={{ width: 1, height: 20, background: 'var(--gray-mid)', margin: '0 4px' }} />

      {/* Ekleme */}
      <ToolBtn onClick={setLink} active={editor.isActive('link')} title="Link ekle/düzenle">🔗</ToolBtn>
      <ToolBtn onClick={addImage} title="Resim ekle">🖼</ToolBtn>

      <div style={{ flex: 1 }} />

      {/* Geri/İleri */}
      <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Geri al" style={{ opacity: editor.can().undo() ? 1 : 0.3 }}>↩</ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="İleri al" style={{ opacity: editor.can().redo() ? 1 : 0.3 }}>↪</ToolBtn>
    </div>
  );
}

// ── Kayıt durumu göstergesi ──────────────────────────────────────────────────
function SaveIndicator({ status }) {
  const labels = { unsaved: '● Kaydedilmemiş', saving: '↻ Kaydediliyor…', saved: '✓ Kaydedildi', error: '✕ Kayıt hatası' };
  const colors = { unsaved: '#f59e0b', saving: 'var(--text-muted)', saved: '#22c55e', error: 'var(--red)' };
  return (
    <span style={{ fontSize: 11.5, color: colors[status] || 'var(--text-light)', fontWeight: 500 }}>
      {labels[status] || ''}
    </span>
  );
}

// ── TipTap Document Editor ──────────────────────────────────────────────────
function DocumentEditor({ doc, user, profile, onBack }) {
  const [saveStatus, setSaveStatus] = useState('saved');
  const savingRef = useRef(false);
  const lastSavedRef = useRef(null);
  const contentLoadedRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: 'Yazmaya başlayın…',
      }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TextStyle,
      Color,
    ],
    editorProps: {
      attributes: {
        class: 'tiptap-editor-content',
        style: 'outline: none; min-height: 500px; padding: 24px 32px; font-size: 15px; line-height: 1.7; color: var(--text);',
      },
    },
    onUpdate: ({ editor: ed }) => {
      setSaveStatus('unsaved');
    },
  });

  // İçeriği yükle
  useEffect(() => {
    if (!editor || contentLoadedRef.current) return;
    contentLoadedRef.current = true;
    (async () => {
      const { data } = await supabase.from('documents').select('content').eq('id', doc.id).single();
      if (data?.content) {
        try {
          // TipTap JSON formatı ise direkt yükle
          if (data.content.type === 'doc') {
            editor.commands.setContent(data.content);
          }
          // BlockNote eski format ise text olarak yükle
          else if (Array.isArray(data.content)) {
            const text = data.content.map(b => {
              if (typeof b === 'string') return b;
              if (b.content) {
                return (b.content || []).map(c => c.text || '').join('');
              }
              return '';
            }).filter(Boolean).join('\n');
            if (text.trim()) {
              editor.commands.setContent(`<p>${text.split('\n').join('</p><p>')}</p>`);
            }
          }
        } catch (e) {
          console.error('Content load error:', e);
        }
      }
    })();
  }, [editor, doc.id]);

  // Kaydet fonksiyonu
  const saveToSupabase = useCallback(async () => {
    if (!editor || savingRef.current) return;
    try {
      const json = editor.getJSON();
      const jsonStr = JSON.stringify(json);
      if (jsonStr === lastSavedRef.current) return;
      lastSavedRef.current = jsonStr;
      savingRef.current = true;
      setSaveStatus('saving');
      await supabase.from('documents').update({
        content: json,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
        updated_by_name: profile?.full_name || user.email,
      }).eq('id', doc.id);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Save error:', err);
      setSaveStatus('error');
    } finally {
      savingRef.current = false;
    }
  }, [editor, doc.id, user, profile]);

  // Otomatik kayıt: 30 sn
  useEffect(() => {
    const interval = setInterval(() => saveToSupabase(), 30000);
    return () => clearInterval(interval);
  }, [saveToSupabase]);

  // Unmount'ta kaydet
  useEffect(() => {
    return () => { saveToSupabase(); };
  }, [saveToSupabase]);

  // Ctrl+S
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveToSupabase();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [saveToSupabase]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', marginBottom: 8,
        borderBottom: '1px solid var(--border)',
      }}>
        <button onClick={() => { saveToSupabase(); setTimeout(onBack, 300); }} style={{
          border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, padding: '4px 8px',
          borderRadius: 8, color: 'var(--text-muted)',
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >←</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
              {getDocType(doc.doc_type).icon} {doc.title}
            </span>
            <SaveIndicator status={saveStatus} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {doc.created_by_name} tarafından oluşturuldu · Ctrl+S ile kaydet
          </div>
        </div>
        <button onClick={saveToSupabase} title="Şimdi kaydet" style={{
          padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          border: '1.5px solid var(--border)', background: 'var(--bg-hover)',
          color: 'var(--text-secondary)', cursor: 'pointer',
        }}>
          💾 Kaydet
        </button>
      </div>

      {/* Editor */}
      <div style={{
        flex: 1, overflow: 'hidden', border: '1px solid var(--border)',
        borderRadius: 12, background: 'var(--bg-card)',
        display: 'flex', flexDirection: 'column',
      }}>
        <EditorToolbar editor={editor} />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* TipTap stilleri */}
      <style>{`
        .tiptap-editor-content h1 { font-size: 28px; font-weight: 800; margin: 20px 0 8px; line-height: 1.3; }
        .tiptap-editor-content h2 { font-size: 22px; font-weight: 700; margin: 18px 0 6px; line-height: 1.3; }
        .tiptap-editor-content h3 { font-size: 18px; font-weight: 700; margin: 16px 0 4px; line-height: 1.3; }
        .tiptap-editor-content p { margin: 0 0 8px; }
        .tiptap-editor-content ul, .tiptap-editor-content ol { padding-left: 24px; margin: 4px 0; }
        .tiptap-editor-content li { margin: 2px 0; }
        .tiptap-editor-content li p { margin: 0; }
        .tiptap-editor-content blockquote {
          border-left: 3px solid #6366f1; padding-left: 16px; margin: 8px 0;
          color: var(--text-muted); font-style: italic;
        }
        .tiptap-editor-content code {
          background: var(--gray-light); border-radius: 4px; padding: 2px 6px;
          font-family: 'Fira Code', monospace; font-size: 13px; color: #e11d48;
        }
        .tiptap-editor-content pre {
          background: #1e1e2e; color: #cdd6f4; border-radius: 10px;
          padding: 16px 20px; margin: 8px 0; overflow-x: auto;
          font-family: 'Fira Code', monospace; font-size: 13px; line-height: 1.6;
        }
        .tiptap-editor-content pre code {
          background: none; color: inherit; padding: 0; border-radius: 0;
        }
        .tiptap-editor-content hr {
          border: none; border-top: 2px solid var(--border); margin: 16px 0;
        }
        .tiptap-editor-content a { color: #6366f1; text-decoration: underline; cursor: pointer; }
        .tiptap-editor-content img { max-width: 100%; border-radius: 8px; margin: 8px 0; }
        .tiptap-editor-content mark { background: #fef08a; border-radius: 2px; padding: 0 2px; }

        /* Tablo stilleri */
        .tiptap-editor-content table {
          border-collapse: collapse; width: 100%; margin: 12px 0;
          border: 1px solid var(--border); border-radius: 8px; overflow: hidden;
        }
        .tiptap-editor-content th, .tiptap-editor-content td {
          border: 1px solid var(--border); padding: 8px 12px; text-align: left;
          min-width: 80px; font-size: 14px;
        }
        .tiptap-editor-content th {
          background: var(--gray-light); font-weight: 700; font-size: 13px;
        }
        .tiptap-editor-content td { background: var(--bg-card); }

        /* Task list */
        .tiptap-editor-content ul[data-type="taskList"] {
          list-style: none; padding-left: 4px;
        }
        .tiptap-editor-content ul[data-type="taskList"] li {
          display: flex; align-items: flex-start; gap: 8px;
        }
        .tiptap-editor-content ul[data-type="taskList"] li label {
          margin-top: 3px; cursor: pointer;
        }
        .tiptap-editor-content ul[data-type="taskList"] li[data-checked="true"] > div > p {
          text-decoration: line-through; opacity: 0.6;
        }

        /* Placeholder */
        .tiptap-editor-content p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left; color: var(--text-light); pointer-events: none; height: 0;
        }

        .ProseMirror { outline: none; }
        .ProseMirror-focused { outline: none; }

        /* Tablo seçim */
        .tiptap-editor-content .selectedCell { background: #eef2ff; }
      `}</style>
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
        width: 440, background: 'var(--bg-card)', borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', padding: 24,
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
          📄 Yeni Doküman
        </h3>
        <input value={title} onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="Doküman başlığı…" autoFocus
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14,
            border: '1.5px solid var(--border)', outline: 'none',
            background: 'var(--bg-hover)', color: 'var(--text)',
            boxSizing: 'border-box', marginBottom: 12,
          }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {DOC_TYPES.map(t => (
            <button key={t.id} onClick={() => setDocType(t.id)}
              style={{
                padding: '6px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                border: '1.5px solid var(--border)', transition: 'all 0.1s',
                background: docType === t.id ? 'var(--navy, #1a3a5c)' : 'var(--bg-hover)',
                color: docType === t.id ? '#fff' : 'var(--text-secondary)',
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
            border: '1.5px solid var(--border)', background: 'var(--bg-hover)',
            color: 'var(--text-secondary)',
          }}>İptal</button>
          <button onClick={handleCreate} disabled={!title.trim() || creating}
            style={{
              padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              border: 'none', cursor: !title.trim() || creating ? 'default' : 'pointer',
              background: !title.trim() || creating ? 'var(--border)' : 'var(--navy, #1a3a5c)',
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
        width: 440, background: 'var(--bg-card)', borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', padding: 24,
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
          📎 Dosya Yükle
        </h3>
        <div style={{
          border: '2px dashed var(--border)', borderRadius: 12, padding: 32,
          textAlign: 'center', marginBottom: 16, cursor: 'pointer',
          background: file ? '#f0fdf4' : 'var(--bg-hover)',
        }}
          onClick={() => document.getElementById('doc-file-input')?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--navy, #1a3a5c)'; }}
          onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]); e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <input id="doc-file-input" type="file" style={{ display: 'none' }}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg"
            onChange={e => setFile(e.target.files?.[0] || null)} />
          {file ? (
            <>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📎</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{file.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                Dosya sürükleyin veya tıklayarak seçin
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                PDF, Word, Excel, PowerPoint, resim desteklenir
              </div>
            </>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
            border: '1.5px solid var(--border)', background: 'var(--bg-hover)',
            color: 'var(--text-secondary)',
          }}>İptal</button>
          <button onClick={handleUpload} disabled={!file || uploading}
            style={{
              padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              border: 'none', cursor: !file || uploading ? 'default' : 'pointer',
              background: !file || uploading ? 'var(--border)' : 'var(--navy, #1a3a5c)',
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
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'all 0.15s',
        display: 'flex', flexDirection: 'column', gap: 8, minHeight: 120,
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 28 }}>{isFile ? fileIcon : type.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {doc.title}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {isFile ? (doc.file_name || 'Dosya') : type.label}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-muted)' }}>
        <span>{doc.created_by_name || 'Bilinmiyor'}</span>
        <span>{dateStr}</span>
      </div>
      {doc.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {doc.tags.map(t => (
            <span key={t} style={{ padding: '1px 8px', borderRadius: 8, fontSize: 10, background: 'rgba(0,0,0,0.05)', color: 'var(--text-muted)' }}>{t}</span>
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
    const { data, error } = await supabase.from('documents').insert({
      title,
      doc_type: docType,
      unit: profile?.unit || null,
      created_by: user.id,
      created_by_name: profile?.full_name || user.email,
      updated_by: user.id,
      updated_by_name: profile?.full_name || user.email,
    }).select().single();
    if (!error && data) {
      loadDocs();
      setActiveDoc(data);
      logActivity({ action: 'oluşturdu', module: 'dokümanlar', entityType: 'doküman', entityName: title });
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
    logActivity({ action: 'yükledi', module: 'dokümanlar', entityType: 'dosya', entityName: file.name });
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
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>📄 Dokümanlar</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Zengin metin editörü ile dokümanlarınızı oluşturun
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowUpload(true)} style={{
            padding: '10px 16px', fontSize: 13, borderRadius: 12, cursor: 'pointer', fontWeight: 500,
            border: '1.5px solid var(--border)', background: 'var(--bg-hover)',
            color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6,
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
              border: '1.5px solid var(--border)', fontSize: 13,
              outline: 'none', background: 'var(--bg-hover)', color: 'var(--text)',
              boxSizing: 'border-box',
            }} />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 10, border: '1.5px solid var(--border)',
            fontSize: 12.5, background: 'var(--bg-hover)', color: 'var(--text-secondary)',
            cursor: 'pointer', outline: 'none',
          }}>
          <option value="">Tüm türler</option>
          {DOC_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
        </select>
        <button onClick={() => setShowArchived(!showArchived)}
          style={{
            padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            border: '1.5px solid var(--border)',
            background: showArchived ? 'var(--navy, #1a3a5c)' : 'var(--bg-hover)',
            color: showArchived ? '#fff' : 'var(--text-secondary)',
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
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>
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
    </div>
  );
}
