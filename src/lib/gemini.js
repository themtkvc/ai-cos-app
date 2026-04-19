// ═══════════════════════════════════════════════════
// GEMINI AI SERVICE — Gemini 2.5 Flash (text-only, tool yok — MVP)
// claude.js ile aynı API yüzeyini sunar: sendMessage(messages, context, userInfo)
// buildContext aynı olduğundan claude.js'ten re-export ediyoruz.
// ═══════════════════════════════════════════════════

import { ASSISTANT_SYSTEM_PROMPT } from './assistantTools';
export { buildContext } from './claude';

// ── SYSTEM PROMPT BUILDER (claude.js ile paralel) ──
const buildSystemPrompt = (context, userRole, userName, userUnit) => {
  const roleContext = userRole === 'direktor' || userRole === 'asistan'
    ? `\nSen bu direktörün Chief of Staff'ısın. Tüm birimler ve personel hakkında bilgi sahibisin.`
    : userRole === 'koordinator' || userRole === 'direktor_yardimcisi'
    ? `\nSen bu koordinatörün AI asistanısın. Birimi: ${userUnit || 'belirtilmemiş'}.`
    : `\nSen bu personelin AI asistanısın. Birimi: ${userUnit || 'belirtilmemiş'}.`;

  const dataContext = context ? `\n\n## CANLI VERİ BAĞLAMI\n${context}` : '';

  // NOT: Gemini MVP'sinde tool calling desteklemiyoruz. Bu yüzden sistem
  // prompt'una "yalnızca bağlam verileriyle yanıt ver" notu ekliyoruz.
  const geminiNote =
    `\n\n(Not: Şu an araç çağırma erişimin yok — yanıtlarını yukarıdaki canlı veri bağlamı ve konuşma geçmişi üzerinden ver. Kayıt oluşturma, bildirim gönderme gibi aksiyonlar için kullanıcıyı Claude modeline yönlendir.)`;

  return ASSISTANT_SYSTEM_PROMPT + roleContext + dataContext + geminiNote +
    `\n\nKullanıcı: ${userName || 'Bilinmiyor'} (${userRole || 'personel'})` +
    `\nBirim: ${userUnit || 'belirtilmemiş'}` +
    `\nBugünün tarihi: ${new Date().toISOString().split('T')[0]}`;
};

// ── API çağrısı ──
const callGemini = async (messages, systemPrompt) => {
  const body = {
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  };

  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 500 && err.error?.includes('not configured')) {
      return { stop_reason: 'end_turn', content: [{ type: 'text', text: getDemoResponse(messages[messages.length - 1]) }] };
    }
    throw new Error(err.error || 'Gemini API hatası');
  }

  return await response.json();
};

// ── MAIN ──
export const sendMessage = async (messages, contextData = null, userInfo = {}) => {
  const { role, name, unit } = userInfo;
  const systemPrompt = buildSystemPrompt(contextData, role, name, unit);
  const apiMessages = messages.map((m) => ({ role: m.role, content: m.content }));

  try {
    const response = await callGemini(apiMessages, systemPrompt);
    const textBlocks = (response.content || []).filter((b) => b.type === 'text');
    return textBlocks.map((b) => b.text).join('\n') || 'İşlem tamamlandı.';
  } catch (error) {
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      return getDemoResponse(messages[messages.length - 1]);
    }
    console.error('Gemini API hatası:', error);
    throw error;
  }
};

// ── DEMO RESPONSES (API key yoksa) ──
const getDemoResponse = (lastMsg) => {
  const message = typeof lastMsg === 'string' ? lastMsg : lastMsg?.content || '';
  return `(Gemini demo modu) Sorunuzu aldım: "${typeof message === 'string' ? message.slice(0, 120) : ''}...". Gerçek Gemini yanıtı için GEMINI_API_KEY ortam değişkenini ayarlayın.`;
};
