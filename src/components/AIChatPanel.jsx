import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ASSISTANT_TOOLS, executeTool, ASSISTANT_SYSTEM_PROMPT } from '../lib/assistantTools';

// ── Claude API çağrısı (Vercel proxy üzerinden) ────────────────────────────
async function callClaude(messages, tools = null) {
  const body = {
    messages,
    system: ASSISTANT_SYSTEM_PROMPT,
    max_tokens: 2048,
  };
  if (tools) body.tools = tools;

  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API hatası: ${res.status}`);
  }
  return res.json();
}

// ── Mesaj baloncuğu ─────────────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 10,
    }}>
      <div style={{
        maxWidth: '85%', padding: '10px 14px', borderRadius: 16,
        borderBottomRightRadius: isUser ? 4 : 16,
        borderBottomLeftRadius: isUser ? 16 : 4,
        background: isUser ? 'var(--navy, #1a3a5c)' : 'var(--bg, #f3f4f6)',
        color: isUser ? '#fff' : 'var(--text, #111827)',
        fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {msg.image && (
          <img src={msg.image} alt="uploaded" style={{
            maxWidth: '100%', maxHeight: 180, borderRadius: 8,
            marginBottom: msg.content ? 8 : 0, display: 'block',
          }} />
        )}
        {msg.content}
      </div>
    </div>
  );
}

// ── Tool çağrısı göstergesi ─────────────────────────────────────────────────
function ToolIndicator({ name }) {
  const labels = {
    search_agendas: '🔍 Gündem arıyor…',
    create_agenda: '📋 Gündem oluşturuyor…',
    create_task: '📌 Görev ekliyor…',
    update_task_status: '✏️ Görev güncelliyor…',
    list_tasks: '📋 Görevleri listeliyor…',
    search_contacts: '🧑 Kişi arıyor…',
    create_contact: '🧑 Kişi ekleniyor…',
    search_organizations: '🏢 Kurum arıyor…',
    create_organization: '🏢 Kurum ekleniyor…',
    create_event: '📅 Etkinlik ekleniyor…',
    get_summary: '📊 Özet hazırlıyor…',
    list_profiles: '👥 Personel listeliyor…',
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
      fontSize: 12, color: 'var(--text-muted, #9ca3af)', fontStyle: 'italic',
    }}>
      <span className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
      {labels[name] || `⚙️ ${name}…`}
    </div>
  );
}

// ── Görsel önizleme (küçük thumbnail) ────────────────────────────────────────
function ImagePreview({ src, onRemove }) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <img src={src} alt="preview" style={{
        width: 56, height: 56, borderRadius: 8, objectFit: 'cover',
        border: '1.5px solid var(--border, #e5e7eb)',
      }} />
      {onRemove && (
        <button onClick={onRemove} style={{
          position: 'absolute', top: -6, right: -6, width: 18, height: 18,
          borderRadius: '50%', background: '#ef4444', color: '#fff', border: 'none',
          fontSize: 11, lineHeight: 1, cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>✕</button>
      )}
    </div>
  );
}

// ── Ana Chat Panel Bileşeni ─────────────────────────────────────────────────
export default function AIChatPanel({ user, profile, isOpen, onClose }) {
  const [messages, setMessages] = useState([]);        // { role, content } — UI mesajları
  const [apiMessages, setApiMessages] = useState([]);   // Claude API mesaj geçmişi (tool sonuçları dahil)
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [toolStatus, setToolStatus] = useState(null);
  const [pendingImage, setPendingImage] = useState(null); // { base64, preview, mediaType }
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const context = {
    userId: user?.id,
    userName: profile?.full_name || user?.email || '',
    userUnit: profile?.unit || null,
  };

  // Otomatik scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, toolStatus]);

  // Açılınca input'a odaklan
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // ── Ortak görsel işleme (file picker + paste) ───────────────────────────────
  const processImageFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Görsel boyutu 5 MB\'dan küçük olmalıdır.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(',')[1];
      const mediaType = file.type || 'image/png';
      setPendingImage({ base64, preview: dataUrl, mediaType });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleImageSelect = useCallback((e) => {
    processImageFile(e.target.files?.[0]);
    e.target.value = '';
  }, [processImageFile]);

  // ── Yapıştırma (Ctrl+V / Cmd+V) ile görsel ekleme ─────────────────────────
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        processImageFile(item.getAsFile());
        return;
      }
    }
  }, [processImageFile]);

  // ── Mesaj gönder ve tool loop ──────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text && !pendingImage) return;
    if (loading) return;

    // UI'ya kullanıcı mesajı ekle (görsel varsa thumbnail ile göster)
    const uiContent = pendingImage
      ? (text || '📷 Ekran görüntüsü gönderildi')
      : text;
    const userMsg = { role: 'user', content: uiContent, image: pendingImage?.preview || null };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // API mesajını hazırla (görsel + text content blocks)
    let apiContent;
    if (pendingImage) {
      apiContent = [];
      apiContent.push({
        type: 'image',
        source: { type: 'base64', media_type: pendingImage.mediaType, data: pendingImage.base64 },
      });
      apiContent.push({
        type: 'text',
        text: text || 'Bu ekran görüntüsündeki kişi bilgilerini çıkar ve kişi olarak ekle.',
      });
    } else {
      apiContent = text;
    }
    setPendingImage(null);

    // API mesaj geçmişine ekle
    const newApiMessages = [...apiMessages, { role: 'user', content: apiContent }];

    try {
      let currentMessages = newApiMessages;
      let finalText = '';
      let loopCount = 0;

      // Tool calling loop: Claude tool_use isterse, çalıştırıp sonucu gönder
      while (loopCount < 5) {
        loopCount++;
        const response = await callClaude(currentMessages, ASSISTANT_TOOLS);

        // stop_reason kontrolü
        if (response.stop_reason === 'tool_use') {
          // Tool çağrılarını bul ve çalıştır
          const assistantContent = response.content; // array of text + tool_use blocks
          currentMessages = [...currentMessages, { role: 'assistant', content: assistantContent }];

          const toolResults = [];
          for (const block of assistantContent) {
            if (block.type === 'tool_use') {
              setToolStatus(block.name);
              const result = await executeTool(block.name, block.input, context);
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(result),
              });
            }
          }
          currentMessages = [...currentMessages, { role: 'user', content: toolResults }];
          setToolStatus(null);
          continue; // Devam — Claude sonucu yorumlayacak
        }

        // Normal text yanıtı
        const textBlocks = (response.content || []).filter(b => b.type === 'text');
        finalText = textBlocks.map(b => b.text).join('\n');
        // API geçmişini güncelle
        setApiMessages([...currentMessages, { role: 'assistant', content: response.content }]);
        break;
      }

      // UI'ya asistan mesajı ekle
      if (finalText) {
        setMessages(prev => [...prev, { role: 'assistant', content: finalText }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Hata: ${err.message}` }]);
    } finally {
      setLoading(false);
      setToolStatus(null);
    }
  }, [input, loading, apiMessages, context, pendingImage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setApiMessages([]);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 10000,
      width: 400, height: 540, maxHeight: 'calc(100vh - 40px)',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-card, #fff)', borderRadius: 20,
      border: '1px solid var(--border, #e5e7eb)',
      boxShadow: '0 12px 48px rgba(0,0,0,0.18)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px', borderBottom: '1px solid var(--border, #e5e7eb)',
        background: 'var(--navy, #1a3a5c)', color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🤖</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>COS Asistan</div>
            <div style={{ fontSize: 10.5, opacity: 0.7 }}>Gündem, görev, network komutları</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={clearChat} title="Sohbeti temizle" style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8,
            color: '#fff', cursor: 'pointer', padding: '4px 8px', fontSize: 13,
          }}>🗑</button>
          <button onClick={onClose} title="Kapat" style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8,
            color: '#fff', cursor: 'pointer', padding: '4px 8px', fontSize: 16, lineHeight: 1,
          }}>✕</button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: '14px 14px 8px',
        display: 'flex', flexDirection: 'column',
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted, #9ca3af)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--text, #111827)' }}>
              Merhaba, {profile?.full_name?.split(' ')[0] || 'merhaba'}!
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              Gündem oluştur, görev ata, kişi ara…<br />
              Doğal dilde yaz, ben hallederim.
            </div>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                '📋 Gündemlerime yeni gündem ekle',
                '📌 Race for Gift\'e görev ekle',
                '📊 Genel durum özeti ver',
                '🧑 Ankara\'daki kişileri ara',
                '📷 LinkedIn ekran görüntüsünden kişi ekle',
              ].map(s => (
                <button key={s} onClick={() => {
                  if (s.includes('LinkedIn ekran')) {
                    fileInputRef.current?.click();
                  } else {
                    setInput(s); setTimeout(() => inputRef.current?.focus(), 50);
                  }
                }}
                  style={{
                    padding: '8px 12px', borderRadius: 10, fontSize: 12,
                    border: '1px solid var(--border, #e5e7eb)', background: 'var(--bg, #f9fafb)',
                    cursor: 'pointer', textAlign: 'left', color: 'var(--text, #111827)',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--border, #e5e7eb)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--bg, #f9fafb)'}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
        {toolStatus && <ToolIndicator name={toolStatus} />}
        {loading && !toolStatus && (
          <div style={{ display: 'flex', gap: 4, padding: '8px 0' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--text-muted, #9ca3af)',
                animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                opacity: 0.5,
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Pending image preview */}
      {pendingImage && (
        <div style={{
          padding: '8px 14px 0', borderTop: '1px solid var(--border, #e5e7eb)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <ImagePreview src={pendingImage.preview} onRemove={() => setPendingImage(null)} />
          <span style={{ fontSize: 11.5, color: 'var(--text-muted, #9ca3af)' }}>
            Görsel hazır — mesaj yazıp gönderin
          </span>
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '10px 14px', borderTop: pendingImage ? 'none' : '1px solid var(--border, #e5e7eb)',
        display: 'flex', gap: 8, alignItems: 'flex-end',
      }}>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          style={{ display: 'none' }}
        />
        {/* Image upload button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          title="Ekran görüntüsü yükle"
          style={{
            width: 40, height: 40, borderRadius: 12, border: '1.5px solid var(--border, #e5e7eb)',
            background: 'var(--bg, #f9fafb)', cursor: loading ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0, transition: 'background 0.15s',
            color: 'var(--text-muted, #6b7280)',
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--border, #e5e7eb)'; }}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--bg, #f9fafb)'}
        >
          📷
        </button>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={pendingImage ? '"Bu kişiyi ekle" yazıp gönderin…' : 'Mesajınızı yazın…'}
          rows={1}
          style={{
            flex: 1, resize: 'none', border: '1.5px solid var(--border, #e5e7eb)',
            borderRadius: 12, padding: '10px 14px', fontSize: 13.5,
            fontFamily: 'inherit', outline: 'none', maxHeight: 80,
            lineHeight: 1.4, color: 'var(--text, #111827)',
            background: 'var(--bg, #f9fafb)',
          }}
          onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'; }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || (!input.trim() && !pendingImage)}
          style={{
            width: 40, height: 40, borderRadius: 12, border: 'none',
            background: loading || (!input.trim() && !pendingImage) ? 'var(--border, #e5e7eb)' : 'var(--navy, #1a3a5c)',
            color: '#fff', cursor: loading || (!input.trim() && !pendingImage) ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0, transition: 'background 0.15s',
          }}
        >
          ➤
        </button>
      </div>

      {/* Pulse animasyonu */}
      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
