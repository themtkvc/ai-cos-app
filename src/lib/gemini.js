// ═══════════════════════════════════════════════════
// GEMINI AI SERVICE — Gemini 2.5 Flash (tool calling destekli)
// claude.js ile aynı API yüzeyini sunar: sendMessage(messages, context, userInfo)
// buildContext aynı olduğundan claude.js'ten re-export ediyoruz.
// ═══════════════════════════════════════════════════

import { ASSISTANT_TOOLS, ASSISTANT_SYSTEM_PROMPT, executeTool } from './assistantTools';
export { buildContext } from './claude';

// ── SYSTEM PROMPT BUILDER (claude.js ile paralel) ──
const buildSystemPrompt = (context, userRole, userName, userUnit) => {
  const roleContext = userRole === 'direktor' || userRole === 'asistan'
    ? `\nSen bu direktörün Chief of Staff'ısın. Tüm birimler ve personel hakkında bilgi sahibisin.`
    : userRole === 'koordinator' || userRole === 'direktor_yardimcisi'
    ? `\nSen bu koordinatörün AI asistanısın. Birimi: ${userUnit || 'belirtilmemiş'}.`
    : `\nSen bu personelin AI asistanısın. Birimi: ${userUnit || 'belirtilmemiş'}.`;

  const dataContext = context ? `\n\n## CANLI VERİ BAĞLAMI\n${context}` : '';

  return ASSISTANT_SYSTEM_PROMPT + roleContext + dataContext +
    `\n\nKullanıcı: ${userName || 'Bilinmiyor'} (${userRole || 'personel'})` +
    `\nBirim: ${userUnit || 'belirtilmemiş'}` +
    `\nBugünün tarihi: ${new Date().toISOString().split('T')[0]}`;
};

// ── API çağrısı (tek tur) ──
const callGemini = async (messages, systemPrompt, tools = null) => {
  const body = {
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  };
  if (tools && tools.length > 0) body.tools = tools;

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

// ── MAIN: Tool calling loop ile mesaj gönder ──
export const sendMessage = async (messages, contextData = null, userInfo = {}) => {
  const { role, name, unit, userId } = userInfo;
  const systemPrompt = buildSystemPrompt(contextData, role, name, unit);
  const apiMessages = messages.map((m) => ({ role: m.role, content: m.content }));

  // Tool definitions (Claude formatı — proxy Gemini'ye çevirir)
  const tools = ASSISTANT_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));

  try {
    let response = await callGemini(apiMessages, systemPrompt, tools);
    let iterations = 0;
    const MAX_ITERATIONS = 8;

    while (response.stop_reason === 'tool_use' && iterations < MAX_ITERATIONS) {
      iterations++;

      // Gemini'nin yanıtını mesajlara ekle (text + tool_use blokları)
      apiMessages.push({ role: 'assistant', content: response.content });

      // Tool çağrılarını çalıştır
      const toolResults = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          try {
            const result = await executeTool(block.name, block.input, {
              userId,
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

      apiMessages.push({ role: 'user', content: toolResults });
      response = await callGemini(apiMessages, systemPrompt, tools);
    }

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
