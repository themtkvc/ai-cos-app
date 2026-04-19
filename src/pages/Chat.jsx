import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { sendMessage as sendClaude, buildContext } from '../lib/claude';
import { sendMessage as sendGemini } from '../lib/gemini';
import { getChatHistory, saveChatMessage, clearChatHistory, getDeadlines, getDonors, getMeetingActions, getUnitReports } from '../lib/supabase';

// ── Model seçenekleri ──
const MODELS = {
  claude: {
    id: 'claude',
    label: 'Claude Sonnet 4',
    short: 'Claude',
    icon: '🧠',
    desc: 'Araç çağırma destekli — kayıt oluşturur, bildirim gönderir',
    send: sendClaude,
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini 2.5 Flash',
    short: 'Gemini',
    icon: '✨',
    desc: 'Hızlı ve ücretsiz — sadece metin yanıt (araç çağırma yok)',
    send: sendGemini,
  },
};
const MODEL_STORAGE_KEY = 'irdp_ai_model';

const QUICK_ACTIONS_DIREKTOR = [
  '⚡ Bu hafta ne yapmalıyım?',
  '📋 Koordinatörler toplantısı gündemi',
  '🏛 Board meeting brifingini hazırla',
  '📧 WFP için follow-up email yaz',
  '📊 Haftalık direktör brifingini oluştur',
  '🤝 Donör durumu özeti',
  '🚨 Kritik görevleri ve gecikmeleri listele',
  '✍️ Good Neighbors grant email taslağı',
];
const QUICK_ACTIONS_KOORDINATOR = [
  '⚡ Bu hafta ne yapmalıyım?',
  '📋 Birimimin görev durumunu özetle',
  '📊 Haftalık birim raporumu hazırla',
  '🚨 Gecikmiş görevleri listele',
  '📧 Direktöre durum güncellemesi yaz',
  '📝 Toplantı notlarını derle',
];
const QUICK_ACTIONS_PERSONEL = [
  '⚡ Bu hafta ne yapmalıyım?',
  '📝 Bugünkü iş kaydımı oluştur',
  '🚨 Gecikmiş görevlerimi göster',
  '📋 Bana atanan gündemleri listele',
  '📧 Koordinatörüme durum güncellemesi yaz',
];
function getQuickActions(role) {
  if (['direktor','asistan'].includes(role)) return QUICK_ACTIONS_DIREKTOR;
  if (['koordinator','direktor_yardimcisi'].includes(role)) return QUICK_ACTIONS_KOORDINATOR;
  return QUICK_ACTIONS_PERSONEL;
}

function renderMarkdown(text) {
  let html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e2e8f0;margin:12px 0"/>')
    .replace(/`(.*?)`/g, '<code>$1</code>');

  // Handle unordered lists
  html = html.replace(/^- (.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*?<\/li>)/s, (match) => {
    return '<ul>' + match + '</ul>';
  });

  // Handle numbered lists
  html = html.replace(/^\d+\. (.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*?<\/li>)/s, (match) => {
    if (!match.includes('<ul>')) {
      return '<ol>' + match + '</ol>';
    }
    return match;
  });

  html = html.replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>');
  return html;
}

export default function Chat({ user, profile, onNavigate, initialMessage, onClearInitialMessage }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState(null);
  const [contextLoaded, setContextLoaded] = useState(false);
  const [model, setModel] = useState(() => {
    try {
      const saved = localStorage.getItem(MODEL_STORAGE_KEY);
      return saved && MODELS[saved] ? saved : 'claude';
    } catch { return 'claude'; }
  });
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const initialMessageSentRef = useRef(false);
  const messagesLoadedRef = useRef(false);

  // Persist model seçimi
  useEffect(() => {
    try { localStorage.setItem(MODEL_STORAGE_KEY, model); } catch {}
  }, [model]);

  // Load chat history and context
  useEffect(() => {
    getChatHistory(user.id).then(({ data }) => {
      if (data?.length) {
        setMessages(data);
      } else {
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: (() => {
            const name = profile?.full_name?.split(' ')[0] || '';
            const r = profile?.role;
            if (['direktor','asistan'].includes(r)) {
              return `Merhaba${name ? ' ' + name : ''}. Ben AI Chief of Staff'ınızım.\n\nSisteminizdeki verilerle çalışıyorum — görevler, donörler, toplantı aksiyonları. Bana herhangi bir konuda sorabilirsiniz:\n\n**Sık kullanılan istekler:**\n- "Bu hafta ne yapmalıyım?" — öncelikli görev listesi\n- "WFP için email yaz" — taslak email\n- "Board meeting brifingini hazırla" — hazır belge\n- "Koordinatörler toplantısı gündemi" — gündem taslağı\n\nNasıl yardımcı olabilirim?`;
            }
            if (r === 'koordinator') {
              return `Merhaba${name ? ' ' + name : ''}. Ben AI asistanınızım.\n\nBiriminizle ilgili görevler, raporlar ve gündemler hakkında size yardımcı olabilirim.\n\n**Sık kullanılan istekler:**\n- "Bu hafta ne yapmalıyım?" — öncelikli görev listesi\n- "Birimimin görev durumunu özetle"\n- "Haftalık birim raporumu hazırla"\n- "Gecikmiş görevleri listele"\n\nNasıl yardımcı olabilirim?`;
            }
            return `Merhaba${name ? ' ' + name : ''}. Ben AI asistanınızım.\n\nGörevleriniz ve iş kayıtlarınız hakkında size yardımcı olabilirim.\n\n**Sık kullanılan istekler:**\n- "Bu hafta ne yapmalıyım?" — görev listeniz\n- "Bugünkü iş kaydımı oluştur"\n- "Gecikmiş görevlerimi göster"\n\nNasıl yardımcı olabilirim?`;
          })(),
          created_at: new Date().toISOString()
        }]);
      }
      messagesLoadedRef.current = true;
    });

    // Load context data
    Promise.all([
      getDeadlines(user.id),
      getDonors(user.id),
      getMeetingActions(user.id),
      getUnitReports(user.id),
    ]).then(([d, don, a, r]) => {
      const ctx = buildContext(d.data, don.data, a.data, r.data);
      setContext(ctx);
      setContextLoaded(true);
    });
  }, [user]);

  // Auto-send initialMessage from Dashboard/other pages
  useEffect(() => {
    if (
      initialMessage &&
      !initialMessageSentRef.current &&
      contextLoaded &&
      messagesLoadedRef.current
    ) {
      initialMessageSentRef.current = true;
      onClearInitialMessage?.();
      // Small delay to let messages render
      setTimeout(() => {
        sendMsg(initialMessage);
      }, 400);
    }
  }, [initialMessage, contextLoaded]); // eslint-disable-line

  // Reset the ref when initialMessage changes (new navigation)
  useEffect(() => {
    if (initialMessage) {
      initialMessageSentRef.current = false;
    }
  }, [initialMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMsg = async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput('');

    const userMsg = { id: Date.now(), role: 'user', content, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Save to Supabase
    try { await saveChatMessage(user.id, 'user', content); }
    catch (e) { console.error('Kullanıcı mesajı kaydedilemedi:', e); }

    // Build messages array for API
    const history = [...messages, userMsg]
      .filter(m => m.id !== 'welcome')
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const modelConfig = MODELS[model] || MODELS.claude;
      const reply = await modelConfig.send(history, context, {
        role: profile?.role,
        name: profile?.full_name,
        unit: profile?.unit,
        userId: user.id,
      });
      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: reply,
        model: modelConfig.id,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      try { await saveChatMessage(user.id, 'assistant', reply); }
      catch (e) { console.error('Asistan mesajı kaydedilemedi:', e); }
    } catch (err) {
      const errMsg = {
        id: Date.now() + 1, role: 'assistant',
        content: `⚠️ Hata: ${err.message || 'Bir sorun oluştu. Lütfen tekrar deneyin.'}`,
        model,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, errMsg]);
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  };

  const clearHistory = async () => {
    await clearChatHistory(user.id);
    initialMessageSentRef.current = false;
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: 'Konuşma geçmişi temizlendi. Nasıl yardımcı olabilirim?',
      created_at: new Date().toISOString()
    }]);
  };

  const formatTime = (iso) => {
    try { return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  return (
    <div className="chat-page">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-icon">🤖</div>
        <div style={{flex:1}}>
          <div className="chat-header-title">AI Chief of Staff</div>
          <div className="chat-header-sub">
            {contextLoaded
              ? `✅ Sistem verileri yüklendi — canlı bağlamla çalışıyor`
              : '⏳ Veriler yükleniyor...'}
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <select
            className="btn btn-outline btn-sm"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            title={MODELS[model]?.desc || ''}
            style={{paddingRight:28}}
          >
            {Object.values(MODELS).map((m) => (
              <option key={m.id} value={m.id}>{m.icon} {m.label}</option>
            ))}
          </select>
          <button className="btn btn-outline btn-sm" onClick={() => onNavigate('dashboard')} title="Dashboard'a dön">
            ← Dashboard
          </button>
          <button className="btn btn-outline btn-sm" onClick={clearHistory} title="Geçmişi temizle">
            🗑 Temizle
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map(msg => (
          <div key={msg.id} className={`chat-message ${msg.role}`}>
            <div className={`message-avatar ${msg.role}`}>
              {msg.role === 'assistant' ? '🤖' : 'D'}
            </div>
            <div>
              <div
                className={`message-bubble ${msg.role}`}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdown(msg.content)) }}
              />
              <div className="message-time">
                {formatTime(msg.created_at)}
                {msg.role === 'assistant' && msg.model && MODELS[msg.model] && (
                  <span style={{marginLeft:8,opacity:0.65}}>
                    · {MODELS[msg.model].icon} {MODELS[msg.model].short}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="chat-message assistant">
            <div className="message-avatar assistant">🤖</div>
            <div className="chat-thinking">
              Düşünüyor
              <div className="thinking-dots">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="chat-input-area">
        <div className="chat-quick-actions">
          {getQuickActions(profile?.role).map(q => (
            <button key={q} className="quick-action" onClick={() => sendMsg(q)}>{q}</button>
          ))}
        </div>
        <div className="chat-input-row">
          <div className="chat-input-wrapper">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder="Sorun veya isteğinizi yazın... (Enter = gönder, Shift+Enter = yeni satır)"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
            />
          </div>
          <button className="chat-send-btn" onClick={() => sendMsg()} disabled={loading || !input.trim()}>
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
