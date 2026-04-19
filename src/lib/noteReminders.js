// ── Not Hatırlatıcı İşleyici ──────────────────────────────────────────────────
// notes.reminder_at <= NOW() AND reminder_notified_at IS NULL olan notlar için
// notifications tablosuna satır ekler ve reminder_notified_at günceller.
// Client-side çalışır; kullanıcı uygulamayı açık tuttuğunda tetiklenir.
import { supabase } from './supabase';

/**
 * Due olmuş not hatırlatıcılarını işler.
 * - notes.deleted_at IS NULL
 * - notes.reminder_at <= now
 * - notes.reminder_notified_at IS NULL
 * Her biri için bir notification satırı ekler, reminder_notified_at set eder.
 * Aynı anda birden fazla tab açılırsa bir yarış koşulu (race condition) olabilir
 * ama notifications tablosunda unique constraint olmadığı için sadece mükerrer
 * bildirim oluşur (zararsız). Yine de reminder_notified_at filtresi sayesinde
 * tek kullanıcının tek cihazında çoğu zaman tek kez çalışır.
 */
export async function processDueNoteReminders(userId) {
  if (!userId) return { processed: 0 };

  const nowIso = new Date().toISOString();

  const { data: dueNotes, error } = await supabase
    .from('notes')
    .select('id, title, content, reminder_at, user_id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .is('reminder_notified_at', null)
    .not('reminder_at', 'is', null)
    .lte('reminder_at', nowIso)
    .limit(20);

  if (error || !dueNotes || dueNotes.length === 0) {
    return { processed: 0 };
  }

  const notificationRows = dueNotes.map((n) => ({
    user_id: n.user_id,
    type: 'note_reminder',
    title: `⏰ Hatırlatıcı: ${n.title || 'Notum'}`,
    body: (n.content || '').replace(/<[^>]+>/g, '').slice(0, 160),
    link_type: 'note',
    link_id: n.id,
    is_read: false,
  }));

  // Insert notifications (best-effort)
  try {
    await supabase.from('notifications').insert(notificationRows);
  } catch (_e) {
    // notifications tablosu yoksa sessiz geç
  }

  // Mark as notified so we don't re-fire
  const ids = dueNotes.map((n) => n.id);
  await supabase
    .from('notes')
    .update({ reminder_notified_at: nowIso })
    .in('id', ids);

  return { processed: dueNotes.length, ids };
}

/**
 * Interval-based hatırlatıcı işleyicisini başlatır.
 * Kullanıcı authenticated olduğunda çağrılır; kullanıcı değiştiğinde durdurulmalı.
 * @param {string} userId
 * @param {number} intervalMs — varsayılan 60 sn
 * @returns {() => void} cleanup fonksiyonu
 */
export function startNoteReminderPoller(userId, intervalMs = 60 * 1000) {
  if (!userId) return () => {};

  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    try {
      await processDueNoteReminders(userId);
    } catch (_e) {
      // non-fatal
    }
  };

  // Hemen bir kez çalıştır, sonra interval
  tick();
  const id = setInterval(tick, intervalMs);

  return () => {
    stopped = true;
    clearInterval(id);
  };
}
