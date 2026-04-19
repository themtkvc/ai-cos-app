// Vercel Serverless Function — Google Tasks API Proxy
//
// POST /api/google-tasks   Authorization: Bearer <supabase_jwt>
//   { action, list_id?, task_id?, task_data?, show_completed? }
//
// Akış:
//   1. Supabase JWT'sinden user.id çıkar (auth.getUser)
//   2. user_integrations(provider='google_tasks') satırından token'ı oku — RLS koruma
//   3. access_token süresi dolduysa refresh_token ile yenile + DB'yi güncelle
//   4. tasks.googleapis.com'a proxy et

import { createClient } from '@supabase/supabase-js';

const CLIENT_ID     = process.env.GOOGLE_TASKS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_TASKS_CLIENT_SECRET;
const SUPABASE_URL      = process.env.SUPABASE_URL      || process.env.VITE_SUPABASE_URL      || process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

function makeClient(userJwt) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
    auth:   { persistSession: false, autoRefreshToken: false },
  });
}

async function refreshAccessToken(refreshToken) {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    const err = new Error(data.error_description || data.error || 'refresh_failed');
    err.status = resp.status;
    err.detail = data;
    throw err;
  }
  return data; // { access_token, expires_in, scope, token_type }
}

async function getValidAccessToken(sb, userId) {
  const { data: row, error } = await sb
    .from('user_integrations')
    .select('*')
    .eq('provider', 'google_tasks')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(`db_read: ${error.message}`);
  if (!row || !row.access_token) {
    const err = new Error('NOT_CONNECTED');
    err.status = 409;
    throw err;
  }

  const now = Date.now();
  const exp = row.access_token_expires_at ? new Date(row.access_token_expires_at).getTime() : 0;
  if (exp > now + 60 * 1000) {
    return row.access_token;
  }

  if (!row.refresh_token) {
    const err = new Error('NO_REFRESH_TOKEN');
    err.status = 409;
    throw err;
  }

  const fresh = await refreshAccessToken(row.refresh_token);
  const newExpIso = new Date(now + (fresh.expires_in || 3600) * 1000).toISOString();
  await sb.from('user_integrations').update({
    access_token:            fresh.access_token,
    access_token_expires_at: newExpIso,
    updated_at:              new Date().toISOString(),
  }).eq('user_id', userId).eq('provider', 'google_tasks');

  return fresh.access_token;
}

async function googleFetch(accessToken, path, opts = {}) {
  const url = `https://tasks.googleapis.com/tasks/v1${path}`;
  const resp = await fetch(url, {
    ...opts,
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await resp.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!resp.ok) {
    const err = new Error(data?.error?.message || `http_${resp.status}`);
    err.status = resp.status;
    err.detail = data;
    throw err;
  }
  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!CLIENT_ID || !CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'oauth_env_not_configured' });
  }

  const authHeader = req.headers.authorization || '';
  const userJwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!userJwt) return res.status(401).json({ error: 'missing_auth' });

  const sb = makeClient(userJwt);
  const { data: userData, error: userErr } = await sb.auth.getUser(userJwt);
  if (userErr || !userData?.user) return res.status(401).json({ error: 'invalid_token' });
  const userId = userData.user.id;

  const body = req.body || {};
  const { action, list_id, task_id, task_data, show_completed, show_hidden, max_results } = body;

  try {
    // status action erken dönüş — token yenilemeye gerek yok
    if (action === 'status') {
      const { data: row } = await sb
        .from('user_integrations')
        .select('google_email, connected_at, scopes, updated_at')
        .eq('provider', 'google_tasks')
        .eq('user_id', userId)
        .maybeSingle();
      return res.status(200).json({
        connected:     !!row,
        google_email:  row?.google_email  || null,
        connected_at:  row?.connected_at  || null,
        updated_at:    row?.updated_at    || null,
        scopes:        row?.scopes        || null,
      });
    }

    const accessToken = await getValidAccessToken(sb, userId);

    switch (action) {
      case 'list_tasklists': {
        const data = await googleFetch(accessToken, '/users/@me/lists?maxResults=100');
        return res.status(200).json(data);
      }

      case 'list_tasks': {
        if (!list_id) return res.status(400).json({ error: 'list_id_required' });
        const params = new URLSearchParams();
        params.set('maxResults', String(Math.min(Math.max(parseInt(max_results) || 100, 1), 100)));
        params.set('showCompleted', show_completed ? 'true' : 'false');
        params.set('showHidden',    show_hidden    ? 'true' : 'false');
        if (show_completed) params.set('showDeleted', 'false');
        const data = await googleFetch(accessToken, `/lists/${encodeURIComponent(list_id)}/tasks?${params}`);
        return res.status(200).json(data);
      }

      case 'create_task': {
        if (!list_id) return res.status(400).json({ error: 'list_id_required' });
        const data = await googleFetch(accessToken, `/lists/${encodeURIComponent(list_id)}/tasks`, {
          method: 'POST',
          body:   JSON.stringify(task_data || {}),
        });
        return res.status(200).json(data);
      }

      case 'update_task': {
        if (!list_id || !task_id) return res.status(400).json({ error: 'list_id_and_task_id_required' });
        const data = await googleFetch(accessToken, `/lists/${encodeURIComponent(list_id)}/tasks/${encodeURIComponent(task_id)}`, {
          method: 'PATCH',
          body:   JSON.stringify(task_data || {}),
        });
        return res.status(200).json(data);
      }

      case 'complete_task': {
        if (!list_id || !task_id) return res.status(400).json({ error: 'list_id_and_task_id_required' });
        const data = await googleFetch(accessToken, `/lists/${encodeURIComponent(list_id)}/tasks/${encodeURIComponent(task_id)}`, {
          method: 'PATCH',
          body:   JSON.stringify({ status: 'completed' }),
        });
        return res.status(200).json(data);
      }

      case 'uncomplete_task': {
        if (!list_id || !task_id) return res.status(400).json({ error: 'list_id_and_task_id_required' });
        const data = await googleFetch(accessToken, `/lists/${encodeURIComponent(list_id)}/tasks/${encodeURIComponent(task_id)}`, {
          method: 'PATCH',
          body:   JSON.stringify({ status: 'needsAction', completed: null }),
        });
        return res.status(200).json(data);
      }

      case 'delete_task': {
        if (!list_id || !task_id) return res.status(400).json({ error: 'list_id_and_task_id_required' });
        await googleFetch(accessToken, `/lists/${encodeURIComponent(list_id)}/tasks/${encodeURIComponent(task_id)}`, {
          method: 'DELETE',
        });
        return res.status(200).json({ deleted: true });
      }

      case 'create_tasklist': {
        const data = await googleFetch(accessToken, '/users/@me/lists', {
          method: 'POST',
          body:   JSON.stringify(task_data || {}),
        });
        return res.status(200).json(data);
      }

      case 'delete_tasklist': {
        if (!list_id) return res.status(400).json({ error: 'list_id_required' });
        await googleFetch(accessToken, `/users/@me/lists/${encodeURIComponent(list_id)}`, {
          method: 'DELETE',
        });
        return res.status(200).json({ deleted: true });
      }

      case 'clear_completed': {
        if (!list_id) return res.status(400).json({ error: 'list_id_required' });
        await googleFetch(accessToken, `/lists/${encodeURIComponent(list_id)}/clear`, {
          method: 'POST',
        });
        return res.status(200).json({ cleared: true });
      }

      default:
        return res.status(400).json({ error: 'unknown_action', action });
    }
  } catch (err) {
    if (err.message === 'NOT_CONNECTED' || err.message === 'NO_REFRESH_TOKEN') {
      return res.status(409).json({ error: 'not_connected' });
    }
    console.error('Tasks proxy error:', err);
    const status = err.status && Number.isInteger(err.status) ? err.status : 500;
    return res.status(status).json({ error: err.message, detail: err.detail || null });
  }
}
