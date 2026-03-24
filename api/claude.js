// Vercel Serverless Function — Claude API Proxy (Tool Calling destekli)
// API key burada kalır, tarayıcıya gitmez
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Claude API key not configured' });
  }

  try {
    const { messages, system, max_tokens = 4096, tools } = req.body;

    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens,
      system,
      messages,
    };

    // Tool tanımları varsa ekle
    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Claude API error' });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Claude proxy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
