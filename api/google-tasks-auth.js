// Vercel Serverless Function — Google Tasks OAuth akışı
//
// GET  /api/google-tasks-auth   → Google'dan dönen callback (code + state)
// POST /api/google-tasks-auth   → { action: 'start' | 'disconnect' } (Authorization: Bearer <jwt>)
//
// State: kullanıcının Supabase JWT'sini state parametresinde tutuyoruz —
// callback'te `auth.getUser(jwt)` ile kullanıcıyı belirleyip kendi
// `user_integrations` satırını RLS ile upsert ediyoruz. Service role gerekmez.

import { createClient } from '@supabase/supabase-js';

const CLIENT_ID     = process.env.GOOGLE_TASKS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_TASKS_CLIENT_SECRET;
const REDIRECT_URI  = process.env.GOOGLE_TASKS_REDIRECT_URI; // ör. https://irdp.app/api/google-tasks-auth
const SUPABASE_URL      = process.env.SUPABASE_URL      || process.env.VITE_SUPABASE_URL      || process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/tasks',
].join(' ');

function makeClient(userJwt) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
    auth:   { persistSession: false, autoRefreshToken: false },
  });
}

function decodeIdTokenEmail(idToken) {
  try {
    const payload = JSON.parse(
      Buffer.from(idToken.split('.')[1], 'base64').toString('utf-8')
    );
    return payload.email || null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'oauth_env_not_configured' });
  }

  // ── GET: Google redirect callback ─────────────────────────────────────
  if (req.method === 'GET') {
    const { code, state, error: oauthError } = req.query || {};
    if (oauthError) {
      return res.redirect(302, `/?tasks_error=${encodeURIComponent(String(oauthError))}`);
    }
    if (!code || !state) {
      return res.status(400).send('Missing code or state');
    }

    const userJwt = String(state);
    const sb = makeClient(userJwt);
    const { data: userData, error: userErr } = await sb.auth.getUser(userJwt);
    if (userErr || !userData?.user) {
      return res.redirect(302, '/?tasks_error=auth_expired');
    }
    const userId = userData.user.id;

    // Exchange code → tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri:  REDIRECT_URI,
        grant_type:    'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error('Google token exchange failed:', tokens);
      return res.redirect(302, `/?tasks_error=${encodeURIComponent(tokens.error || 'token_exchange')}`);
    }

    const googleEmail = tokens.id_token ? decodeIdTokenEmail(tokens.id_token) : null;
    const expiresAt   = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

    // Upsert — RLS policy'si user_id = auth.uid() olan satıra izin verir
    const { error: upsertErr } = await sb
      .from('user_integrations')
      .upsert({
        user_id:                  userId,
        provider:                 'google_tasks',
        access_token:             tokens.access_token  || null,
        refresh_token:            tokens.refresh_token || null,
        access_token_expires_at:  expiresAt,
        scopes:                   tokens.scope ? tokens.scope.split(' ') : null,
        google_email:             googleEmail,
        updated_at:               new Date().toISOString(),
      }, { onConflict: 'user_id,provider' });

    if (upsertErr) {
      console.error('Supabase upsert failed:', upsertErr);
      return res.redirect(302, '/?tasks_error=db');
    }

    return res.redirect(302, '/#google_tasks?connected=1');
  }

  // ── POST: start OAuth veya disconnect ─────────────────────────────────
  if (req.method === 'POST') {
    const authHeader = req.headers.authorization || '';
    const userJwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!userJwt) return res.status(401).json({ error: 'missing_auth' });

    const action = (req.body?.action || '').toString();

    if (action === 'start') {
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.set('client_id',     CLIENT_ID);
      url.searchParams.set('redirect_uri',  REDIRECT_URI);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope',         SCOPES);
      url.searchParams.set('access_type',   'offline');
      // Hesap seçici + refresh_token garantisi (ilk bağlanışta 'consent' şart)
      url.searchParams.set('prompt', 'select_account consent');
      url.searchParams.set('include_granted_scopes', 'true');
      url.searchParams.set('state', userJwt);
      // Workspace domain hint → Chrome'da doğru hesabı öne çıkarır
      url.searchParams.set('hd', 'irdp.app');
      return res.status(200).json({ auth_url: url.toString() });
    }

    if (action === 'disconnect') {
      const sb = makeClient(userJwt);
      const { error } = await sb
        .from('user_integrations')
        .delete()
        .eq('provider', 'google_tasks');
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ disconnected: true });
    }

    return res.status(400).json({ error: 'unknown_action' });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
