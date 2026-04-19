// Vercel Serverless Function — Google Gemini API Proxy
// Claude formatındaki request/response ile uyumlu (aynı Chat.jsx + lib yapısı kullanılabilir)
// API key burada kalır, tarayıcıya gitmez.
// Artık function calling destekli: tools[] → functionDeclarations, tool_use/tool_result → functionCall/functionResponse

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// JSON Schema (Claude) → Gemini/OpenAPI parameters (v1beta)
// Gemini desteklemediği field'lara takılıyor — sanitize et.
function sanitizeSchema(schema) {
  if (schema === null || schema === undefined) return { type: 'object', properties: {} };
  if (Array.isArray(schema)) return schema.map(sanitizeSchema);
  if (typeof schema !== 'object') return schema;

  const DROP = new Set(['$schema', '$id', '$ref', 'definitions', '$defs', 'additionalProperties', 'patternProperties', 'not', 'allOf', 'oneOf', 'anyOf']);
  const out = {};
  for (const [k, v] of Object.entries(schema)) {
    if (DROP.has(k)) continue;
    if (k === 'properties' && v && typeof v === 'object' && !Array.isArray(v)) {
      const props = {};
      for (const [pk, pv] of Object.entries(v)) props[pk] = sanitizeSchema(pv);
      out.properties = props;
    } else if (k === 'items') {
      out.items = sanitizeSchema(v);
    } else if (typeof v === 'object' && v !== null) {
      out[k] = sanitizeSchema(v);
    } else {
      out[k] = v;
    }
  }
  // Object tip için properties zorunlu (Gemini v1beta bunu ister)
  if (out.type === 'object' && (!out.properties || typeof out.properties !== 'object')) {
    out.properties = {};
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured' });
  }

  try {
    const { messages = [], system, max_tokens = 4096, tools = null } = req.body || {};

    // İlk geçiş: tool_use_id → name haritası kur (tool_result'ları doğru isimle eşleştirebilmek için)
    const toolNames = {};
    for (const m of messages) {
      if (Array.isArray(m.content)) {
        for (const b of m.content) {
          if (b?.type === 'tool_use' && b.id) toolNames[b.id] = b.name;
        }
      }
    }

    // İkinci geçiş: Claude → Gemini content blocks
    const contents = [];
    for (const m of messages) {
      const role = m.role === 'assistant' ? 'model' : 'user';
      const parts = [];

      if (typeof m.content === 'string') {
        if (m.content.trim()) parts.push({ text: m.content });
      } else if (Array.isArray(m.content)) {
        for (const b of m.content) {
          if (!b) continue;
          if (b.type === 'text') {
            if (b.text) parts.push({ text: b.text });
          } else if (b.type === 'tool_use') {
            parts.push({ functionCall: { name: b.name, args: b.input || {} } });
          } else if (b.type === 'tool_result') {
            let payload = b.content;
            if (typeof payload === 'string') {
              try { payload = JSON.parse(payload); }
              catch { payload = { result: payload }; }
            }
            if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
              payload = { result: payload === undefined || payload === null ? '' : String(payload) };
            }
            const fnName = toolNames[b.tool_use_id] || 'unknown_tool';
            parts.push({ functionResponse: { name: fnName, response: payload } });
          } else if (b.type === 'image' && b.source?.type === 'base64') {
            parts.push({ inlineData: { mimeType: b.source.media_type, data: b.source.data } });
          }
        }
      }

      if (parts.length === 0) continue;
      contents.push({ role, parts });
    }

    // Gemini ilk mesajın user olmasını ister
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

    if (Array.isArray(tools) && tools.length > 0) {
      body.tools = [{
        functionDeclarations: tools.map((t) => ({
          name: t.name,
          description: t.description || '',
          parameters: sanitizeSchema(t.input_schema || { type: 'object', properties: {} }),
        })),
      }];
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

    const contentBlocks = [];
    let hasToolUse = false;
    let idCounter = 0;
    const now = Date.now();

    for (const p of parts) {
      if (p?.text) {
        contentBlocks.push({ type: 'text', text: p.text });
      } else if (p?.functionCall) {
        hasToolUse = true;
        contentBlocks.push({
          type: 'tool_use',
          id: `gemcall_${now}_${idCounter++}`,
          name: p.functionCall.name,
          input: p.functionCall.args || {},
        });
      }
    }

    if (contentBlocks.length === 0) {
      contentBlocks.push({ type: 'text', text: 'Yanıt boş döndü.' });
    }

    const finishReason = cand?.finishReason || 'STOP';
    let stopReason;
    if (hasToolUse) stopReason = 'tool_use';
    else if (finishReason === 'MAX_TOKENS') stopReason = 'max_tokens';
    else stopReason = 'end_turn';

    return res.status(200).json({
      content: contentBlocks,
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
