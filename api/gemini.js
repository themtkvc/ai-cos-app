// Vercel Serverless Function — Google Gemini API Proxy
// Claude formatındaki request/response ile uyumlu (aynı Chat.jsx + lib yapısı kullanılabilir)
// API key burada kalır, tarayıcıya gitmez.

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured' });
  }

  try {
    const { messages = [], system, max_tokens = 4096 } = req.body || {};

    // ── Claude → Gemini mesaj formatı çevirisi ──
    // Claude: [{ role: 'user'|'assistant', content: 'text' | [{type:'text',text:''}] }]
    // Gemini: [{ role: 'user'|'model', parts: [{ text: '...' }] }]
    const contents = [];
    for (const m of messages) {
      const role = m.role === 'assistant' ? 'model' : 'user';

      let text = '';
      if (typeof m.content === 'string') {
        text = m.content;
      } else if (Array.isArray(m.content)) {
        // tool_use/tool_result bloklarını düz metne indirge (Gemini tool'larını bu MVP'de desteklemiyoruz)
        text = m.content
          .map((b) => {
            if (b?.type === 'text') return b.text || '';
            if (b?.type === 'tool_use') return `[tool_use:${b.name}(${JSON.stringify(b.input || {})})]`;
            if (b?.type === 'tool_result') return `[tool_result:${typeof b.content === 'string' ? b.content : JSON.stringify(b.content)}]`;
            return '';
          })
          .filter(Boolean)
          .join('\n');
      }

      if (!text) continue;
      contents.push({ role, parts: [{ text }] });
    }

    // Gemini ilk mesajın user olmasını ister; değilse başa kukla bir user ekle
    if (contents.length === 0 || contents[0].role !== 'user') {
      contents.unshift({ role: 'user', parts: [{ text: 'Merhaba' }] });
    }

    const body = {
      contents,
      generationConfig: {
        maxOutputTokens: max_tokens,
        temperature: 0.7,
      },
    };

    if (system && typeof system === 'string' && system.trim()) {
      body.systemInstruction = { parts: [{ text: system }] };
    }

    const response = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      const msg = data?.error?.message || 'Gemini API error';
      console.error('Gemini error:', msg);
      return res.status(response.status).json({ error: msg });
    }

    // ── Gemini → Claude yanıt formatı çevirisi ──
    const cand = data?.candidates?.[0];
    const parts = cand?.content?.parts || [];
    const textOut = parts.map((p) => p?.text || '').join('\n').trim();

    // finishReason: STOP|MAX_TOKENS|SAFETY|RECITATION|OTHER → Claude stop_reason
    const finishReason = cand?.finishReason || 'STOP';
    const stopReason = finishReason === 'MAX_TOKENS' ? 'max_tokens' : 'end_turn';

    return res.status(200).json({
      content: [{ type: 'text', text: textOut || 'Yanıt boş döndü.' }],
      stop_reason: stopReason,
      model: GEMINI_MODEL,
      usage: data?.usageMetadata
        ? {
            input_tokens: data.usageMetadata.promptTokenCount,
            output_tokens: data.usageMetadata.candidatesTokenCount,
          }
        : undefined,
    });
  } catch (error) {
    console.error('Gemini proxy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
