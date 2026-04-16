// ═══════════════════════════════════════════════════
// CLAUDE AI SERVICE — Tool Calling destekli
// ═══════════════════════════════════════════════════

import { ASSISTANT_TOOLS, ASSISTANT_SYSTEM_PROMPT, executeTool } from './assistantTools';

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

// ── SYSTEM PROMPT BUILDER ──
const buildSystemPrompt = (context, userRole, userName, userUnit) => {
  const roleContext = userRole === 'direktor' || userRole === 'asistan'
    ? `\nSen bu direktörün Chief of Staff'ısın. Tüm birimler ve personel hakkında bilgi sahibisin.`
    : userRole === 'koordinator' || userRole === 'direktor_yardimcisi'
    ? `\nSen bu koordinatörün AI asistanısın. Birimi: ${userUnit || 'belirtilmemiş'}.`
    : `\nSen bu personelin AI asistanısın. Birimi: ${userUnit || 'belirtilmemiş'}.`;

  const dataContext = context
    ? `\n\n## CANLI VERİ BAĞLAMI\n${context}`
    : '';

  return ASSISTANT_SYSTEM_PROMPT + roleContext + dataContext +
    `\n\nKullanıcı: ${userName || 'Bilinmiyor'} (${userRole || 'personel'})` +
    `\nBirim: ${userUnit || 'belirtilmemiş'}` +
    `\nBugünün tarihi: ${new Date().toISOString().split('T')[0]}`;
};

// ── API çağrısı (tek tur) ──
const callClaude = async (messages, systemPrompt, tools = null) => {
  const body = {
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
  }

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json();
    if (response.status === 500 && err.error?.includes('not configured')) {
      return { stop_reason: 'end_turn', content: [{ type: 'text', text: getDemoResponse(messages[messages.length - 1]) }] };
    }
    throw new Error(err.error || 'API hatası');
  }

  return await response.json();
};

// ── MAIN: Tool calling loop ile mesaj gönder ──
export const sendMessage = async (messages, contextData = null, userInfo = {}) => {
  const { role, name, unit, userId } = userInfo;
  const systemPrompt = buildSystemPrompt(contextData, role, name, unit);

  // Claude API formatına dönüştür
  const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));

  // Tool definitions
  const tools = ASSISTANT_TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));

  try {
    let response = await callClaude(apiMessages, systemPrompt, tools);
    let iterations = 0;
    const MAX_ITERATIONS = 8;

    // Tool calling loop — Claude tool çağırdıkça devam et
    while (response.stop_reason === 'tool_use' && iterations < MAX_ITERATIONS) {
      iterations++;

      // Claude'un yanıtını (metin + tool_use bloklarını) mesajlara ekle
      apiMessages.push({ role: 'assistant', content: response.content });

      // Her tool_use bloğunu çalıştır
      const toolResults = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          try {
            const result = await executeTool(block.name, block.input, {
              userId: userId,
              userName: name,
              userUnit: unit,
            });
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          } catch (err) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify({ error: err.message }),
              is_error: true,
            });
          }
        }
      }

      // Tool sonuçlarını mesajlara ekle
      apiMessages.push({ role: 'user', content: toolResults });

      // Claude'a tekrar gönder
      response = await callClaude(apiMessages, systemPrompt, tools);
    }

    // Son yanıttan metin içeriğini çıkar
    const textBlocks = (response.content || []).filter(b => b.type === 'text');
    return textBlocks.map(b => b.text).join('\n') || 'İşlem tamamlandı.';

  } catch (error) {
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      return getDemoResponse(messages[messages.length - 1]);
    }
    console.error('Claude API hatası:', error);
    throw error;
  }
};

// ── CONTEXT BUILDER ──
export const buildContext = (deadlines, donors, meetingActions, unitReports) => {
  const parts = [];

  if (deadlines?.length > 0) {
    const overdue = deadlines.filter(d => {
      const days = Math.ceil((new Date(d.due_date) - new Date()) / (1000*60*60*24));
      return days < 0 && d.status !== '✅ Completed';
    });
    const urgent = deadlines.filter(d => {
      const days = Math.ceil((new Date(d.due_date) - new Date()) / (1000*60*60*24));
      return days >= 0 && days <= 7 && d.status !== '✅ Completed';
    });
    parts.push(`### DEADLINES\nToplam aktif: ${deadlines.filter(d => d.status !== '✅ Completed').length}\nGecikmiş: ${overdue.length}\nBu hafta: ${urgent.length}\n${overdue.length > 0 ? `GECİKMİŞ:\n${overdue.map(d => `- ${d.title} (${d.owner}) — ${d.due_date}`).join('\n')}` : ''}${urgent.length > 0 ? `\nBU HAFTA:\n${urgent.map(d => `- ${d.title} (${d.owner}) — ${d.due_date}`).join('\n')}` : ''}`);
  }

  if (donors?.length > 0) {
    parts.push(`### DONÖRLER\n${donors.map(d => `- ${d.name}: Sağlık=${d.health}, Yönetici=${d.account_manager}, Rapor tarihi=${d.reporting_deadline || 'belirsiz'}`).join('\n')}`);
  }

  if (meetingActions?.length > 0) {
    const open = meetingActions.filter(a => a.status !== '✅ Completed');
    parts.push(`### AÇIK TOPLANTI AKSİYONLARI (${open.length})\n${open.slice(0, 10).map(a => `- ${a.action_item} → ${a.owner} ${a.due_date} [${a.status}]`).join('\n')}`);
  }

  if (unitReports?.length > 0) {
    const latest = {};
    unitReports.forEach(r => {
      if (!latest[r.unit] || r.submitted_at > latest[r.unit].submitted_at) latest[r.unit] = r;
    });
    parts.push(`### BİRİM RAPORLARI\n${Object.values(latest).map(r => `- ${r.unit} (${r.coordinator}): ${r.overall_status}, Başarı=${r.key_achievement?.slice(0,80)}...`).join('\n')}`);
  }

  return parts.join('\n\n') || null;
};

// ── DEMO RESPONSES (API key yoksa) ──
const getDemoResponse = (lastMsg) => {
  const message = typeof lastMsg === 'string' ? lastMsg : lastMsg?.content || '';
  const lower = message.toLowerCase();

  if (lower.includes('gündem') || lower.includes('agenda') || lower.includes('toplantı')) {
    return `📋 **Koordinatörler Toplantısı Gündem Taslağı**\n\n**Tarih:** ${new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}\n\n1. Geçen Haftadan Kalan Aksiyonlar (10 dk)\n2. Birim Round Table (30 dk)\n3. Acil Flaglar (10 dk)\n4. Kapanış & Aksiyonlar (10 dk)\n\n*Demo modunda çalışıyor — API key ayarlandığında gerçek verilerle çalışacak.*`;
  }

  if (lower.includes('hafta') || lower.includes('brief') || lower.includes('ne yapmalıyım')) {
    return `⚡ **Bu Hafta Öncelikler**\n\nDemo modunda çalışıyorum. API key ayarlandığında:\n- Gerçek görevlerinizi listeleyebilirim\n- Deadline'ları takip edebilirim\n- İş kayıtları oluşturabilirim\n- Bildirim gönderebilirim\n\nTüm sistem araçlarına erişimim var!`;
  }

  return `Merhaba! Ben COS Asistanınızım.\n\nŞu an **demo modunda** çalışıyorum. API key ayarlandığında sistemdeki **tüm modüllere** erişimim olacak:\n\n- 📋 Gündem & görev yönetimi\n- 🗓 İş kaydı oluşturma/sorgulama\n- 🤝 Donör CRM\n- 📅 Etkinlik yönetimi\n- 🕸️ Network yönetimi\n- 📊 Çalışma analizi\n- 🔔 Bildirim gönderme\n- 💰 Bağış & fon takibi\n- 📝 Not oluşturma\n- ve daha fazlası...\n\nNe yapmamı istersiniz?`;
};
