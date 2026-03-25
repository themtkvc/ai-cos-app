// Vercel Serverless Function — Liveblocks Auth Endpoint
// Kullanıcıyı doğrular ve Liveblocks token döner
import { Liveblocks } from '@liveblocks/node';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ error: 'Liveblocks secret key not configured' });
  }

  try {
    const { userId, userName, userUnit, room } = req.body;

    if (!userId || !room) {
      return res.status(400).json({ error: 'userId and room are required' });
    }

    const liveblocks = new Liveblocks({ secret: secretKey });

    // Kullanıcı oturumu hazırla
    const session = liveblocks.prepareSession(userId, {
      userInfo: {
        name: userName || 'Anonim',
        unit: userUnit || '',
      },
    });

    // Room'a erişim izni ver
    session.allow(room, session.FULL_ACCESS);

    // Token oluştur ve dön
    const { status, body } = await session.authorize();
    return res.status(status).end(body);
  } catch (error) {
    console.error('Liveblocks auth error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}
