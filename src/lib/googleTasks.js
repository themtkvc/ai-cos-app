// Google Tasks client helper — /api/google-tasks + /api/google-tasks-auth proxy'lerini çağırır
//
// Tüm fonksiyonlar Supabase session token'ını Authorization header'ında iletir.
// Bağlantı yoksa çağrılar 409 'not_connected' döner → UI Connect ekranı gösterir.

import { supabase } from './supabase';

const TASKS_ENDPOINT = '/api/google-tasks';
const AUTH_ENDPOINT  = '/api/google-tasks-auth';

async function bearer() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('not_signed_in');
  return token;
}

async function call(endpoint, body) {
  const token = await bearer();
  const resp = await fetch(endpoint, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  let data;
  try { data = await resp.json(); } catch { data = {}; }
  if (!resp.ok) {
    const err = new Error(data?.error || `http_${resp.status}`);
    err.status = resp.status;
    err.detail = data?.detail || null;
    err.data = data;
    throw err;
  }
  return data;
}

// ── OAuth akışı ───────────────────────────────────────────────────────
export async function startGoogleTasksOAuth() {
  const { auth_url } = await call(AUTH_ENDPOINT, { action: 'start' });
  if (!auth_url) throw new Error('no_auth_url');
  window.location.href = auth_url;
}

export async function disconnectGoogleTasks() {
  return call(AUTH_ENDPOINT, { action: 'disconnect' });
}

export async function getGoogleTasksStatus() {
  return call(TASKS_ENDPOINT, { action: 'status' });
}

// ── Tasklists ────────────────────────────────────────────────────────
export async function listTasklists() {
  const r = await call(TASKS_ENDPOINT, { action: 'list_tasklists' });
  return r?.items || [];
}

export async function createTasklist(title) {
  return call(TASKS_ENDPOINT, { action: 'create_tasklist', task_data: { title } });
}

export async function deleteTasklist(list_id) {
  return call(TASKS_ENDPOINT, { action: 'delete_tasklist', list_id });
}

// ── Tasks ────────────────────────────────────────────────────────────
export async function listTasks(list_id, { show_completed = true, max_results = 100 } = {}) {
  const r = await call(TASKS_ENDPOINT, { action: 'list_tasks', list_id, show_completed, max_results });
  return r?.items || [];
}

export async function createTask(list_id, data) {
  // data: { title, notes, due (ISO string) }
  return call(TASKS_ENDPOINT, { action: 'create_task', list_id, task_data: data });
}

export async function updateTask(list_id, task_id, patch) {
  return call(TASKS_ENDPOINT, { action: 'update_task', list_id, task_id, task_data: patch });
}

export async function completeTask(list_id, task_id) {
  return call(TASKS_ENDPOINT, { action: 'complete_task', list_id, task_id });
}

export async function uncompleteTask(list_id, task_id) {
  return call(TASKS_ENDPOINT, { action: 'uncomplete_task', list_id, task_id });
}

export async function deleteTask(list_id, task_id) {
  return call(TASKS_ENDPOINT, { action: 'delete_task', list_id, task_id });
}

export async function clearCompleted(list_id) {
  return call(TASKS_ENDPOINT, { action: 'clear_completed', list_id });
}
