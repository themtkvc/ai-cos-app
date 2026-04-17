import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Using demo mode.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

// ── ACTIVITY LOGGING ──
// Fire-and-forget — UI'ı asla bloklamaz
let _cachedProfile = null;

export const logActivity = async ({ action, module, entityType, entityId, entityName, details }) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Profili cache'le — her log için tekrar çekme
    if (!_cachedProfile || _cachedProfile.user_id !== user.id) {
      const { data } = await supabase.from('user_profiles').select('full_name, role, unit').eq('user_id', user.id).single();
      _cachedProfile = data ? { ...data, user_id: user.id } : { user_id: user.id };
    }

    await supabase.from('activity_log').insert({
      user_id: user.id,
      user_name: _cachedProfile.full_name || user.email,
      user_role: _cachedProfile.role || 'personel',
      unit: _cachedProfile.unit || null,
      action,
      module,
      entity_type: entityType || null,
      entity_id: entityId || null,
      entity_name: entityName || null,
      details: details || {},
    });
  } catch (_) { /* sessizce geç — loglama hatası UX'i bozmamalı */ }
};

// ── AUTH HELPERS ──
export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
};

export const signUp = async (email, password) => {
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// ── DEADLINES ──
export const getDeadlines = async (userId) => {
  const { data, error } = await supabase
    .from('deadlines')
    .select('*')
    .eq('user_id', userId)
    .order('due_date', { ascending: true });
  return { data, error };
};

export const createDeadline = async (deadline) => {
  const { data, error } = await supabase.from('deadlines').insert([deadline]).select();
  return { data, error };
};

export const updateDeadline = async (id, updates) => {
  const { data, error } = await supabase
    .from('deadlines').update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select();
  return { data, error };
};

export const deleteDeadline = async (id) => {
  const { error } = await supabase.from('deadlines').delete().eq('id', id);
  return { error };
};

// ── DONORS ──
export const getDonors = async (userId) => {
  const { data, error } = await supabase
    .from('donors').select('*').eq('user_id', userId).order('name');
  return { data, error };
};

export const updateDonor = async (id, updates) => {
  const { data, error } = await supabase
    .from('donors').update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select();
  if (!error) logActivity({ action: 'güncelledi', module: 'donörler', entityType: 'donör', entityName: data?.[0]?.name || updates?.name });
  return { data, error };
};

// ── INTERACTIONS ──
export const getInteractions = async (userId, donorId = null) => {
  let query = supabase.from('interactions').select('*').eq('user_id', userId);
  if (donorId) query = query.eq('donor_id', donorId);
  const { data, error } = await query.order('interaction_date', { ascending: false });
  return { data, error };
};

export const createInteraction = async (interaction) => {
  const { data, error } = await supabase.from('interactions').insert([interaction]).select();
  if (!error) logActivity({ action: 'oluşturdu', module: 'donörler', entityType: 'etkileşim' });
  return { data, error };
};

// ── MEETING ACTIONS ──
export const getMeetingActions = async (userId) => {
  const { data, error } = await supabase
    .from('meeting_actions').select('*').eq('user_id', userId)
    .order('due_date', { ascending: true });
  return { data, error };
};

export const createMeetingAction = async (action) => {
  const { data, error } = await supabase.from('meeting_actions').insert([action]).select();
  if (!error) logActivity({ action: 'oluşturdu', module: 'toplantılar', entityType: 'aksiyon', entityName: data?.[0]?.title || action?.title });
  return { data, error };
};

export const updateMeetingAction = async (id, updates) => {
  const { data, error } = await supabase
    .from('meeting_actions').update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select();
  if (!error) logActivity({ action: 'güncelledi', module: 'toplantılar', entityType: 'aksiyon', entityName: data?.[0]?.title || updates?.title });
  return { data, error };
};

// ── UNIT REPORTS ──
export const getUnitReports = async (userId) => {
  const { data, error } = await supabase
    .from('unit_reports').select('*').eq('user_id', userId)
    .order('submitted_at', { ascending: false });
  return { data, error };
};

export const getAllUnitReports = async () => {
  const { data, error } = await supabase
    .from('unit_reports').select('*')
    .order('submitted_at', { ascending: false });
  return { data, error };
};

// ── CHAT HISTORY ──
export const getChatHistory = async (userId, limit = 50) => {
  const { data, error } = await supabase
    .from('chat_history').select('*').eq('user_id', userId)
    .order('created_at', { ascending: true }).limit(limit);
  return { data, error };
};

export const saveChatMessage = async (userId, role, content) => {
  const { data, error } = await supabase
    .from('chat_history').insert([{ user_id: userId, role, content }]).select();
  return { data, error };
};

export const clearChatHistory = async (userId) => {
  const { error } = await supabase.from('chat_history').delete().eq('user_id', userId);
  return { error };
};

// ── DONOR CRUD (full) ──
export const createDonor = async (donor) => {
  const { data, error } = await supabase.from('donors').insert([donor]).select();
  if (!error) logActivity({ action: 'oluşturdu', module: 'donörler', entityType: 'donör', entityName: data?.[0]?.name || donor?.name });
  return { data, error };
};

export const deleteDonor = async (id) => {
  const { error } = await supabase.from('donors').delete().eq('id', id);
  if (!error) logActivity({ action: 'sildi', module: 'donörler', entityType: 'donör' });
  return { error };
};

// ── MEETING ACTIONS (delete) ──
export const deleteMeetingAction = async (id) => {
  const { error } = await supabase.from('meeting_actions').delete().eq('id', id);
  return { error };
};

// ── UNIT REPORTS (create) ──
export const createUnitReport = async (report) => {
  const { data, error } = await supabase.from('unit_reports').insert([report]).select();
  return { data, error };
};

// ── SYSTEM STATS ──
export const getSystemStats = async (userId) => {
  const results = await Promise.all([
    supabase.from('deadlines').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('donors').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('meeting_actions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('interactions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('unit_reports').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('chat_history').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);
  return {
    deadlines: results[0].count || 0,
    donors: results[1].count || 0,
    meetingActions: results[2].count || 0,
    interactions: results[3].count || 0,
    unitReports: results[4].count || 0,
    chatMessages: results[5].count || 0,
  };
};

// ── DAILY LOGS ──
export const getDailyLog = async (userId, logDate) => {
  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', logDate)
    .maybeSingle();
  return { data, error };
};

export const getWeekLogs = async (userId, fromDate, toDate) => {
  const { data, error } = await supabase
    .from('daily_logs')
    .select('log_date, work_status, total_minutes, submitted')
    .eq('user_id', userId)
    .gte('log_date', fromDate)
    .lte('log_date', toDate)
    .order('log_date');
  return { data, error };
};

export const upsertDailyLog = async (log) => {
  const { data, error } = await supabase
    .from('daily_logs')
    .upsert(log, { onConflict: 'user_id,log_date' })
    .select();
  if (!error) logActivity({ action: 'kaydetti', module: 'iş_kayıtları', entityType: 'günlük_kayıt', details: { log_date: log.log_date } });
  return { data, error };
};

export const submitDailyLog = async (log) => {
  const { data, error } = await supabase
    .from('daily_logs')
    .upsert({
      ...log,
      submitted: true,
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'user_id,log_date' })
    .select();
  if (!error) logActivity({ action: 'gönderdi', module: 'iş_kayıtları', entityType: 'günlük_kayıt', details: { log_date: log.log_date } });
  return { data, error };
};

// Direktör/koordinatör: personel & koordinatör loglarını görür — direktör kendi logunu gizler
export const getAllDailyLogs = async (fromDate, toDate) => {
  const { data, error } = await supabase
    .from('daily_logs')
    .select('*, user_profiles!inner(full_name, role, unit)')
    .gte('log_date', fromDate)
    .lte('log_date', toDate)
    .not('user_profiles.role', 'in', '("direktor","asistan")')
    .order('log_date', { ascending: false })
    .order('user_id');
  return { data, error };
};

// ── USER PROFILES & ROLES ──
export const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  return { data, error };
};

export const getAllProfiles = async () => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: true });
  return { data, error };
};

export const upsertUserProfile = async (profile) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(profile, { onConflict: 'user_id' })
    .select();
  return { data, error };
};

// Admin: invite/create a new user via Supabase Auth (only admin service key can do this,
// so we just create the profile record; actual user must sign up themselves)
export const inviteUser = async (email, role, unit, fullName) => {
  // Step 1: Create auth user via Supabase (requires service role — not available client-side)
  // Instead, we store an "invitation" in user_profiles with a placeholder
  // The user will sign up and their profile gets linked on first login
  const { data, error } = await supabase
    .from('user_profiles')
    .insert([{
      user_id: '00000000-0000-0000-0000-000000000000', // placeholder
      full_name: fullName,
      role,
      unit,
    }])
    .select();
  return { data, error };
};

// ── DUYURULAR ──
export const getPublicAnnouncements = async () => {
  const { data, error } = await supabase
    .from('public_announcements')
    .select('*')
    .eq('active', true)
    .order('published_at', { ascending: false })
    .limit(10);
  return { data, error };
};

export const createAnnouncement = async (ann) => {
  const { data, error } = await supabase
    .from('public_announcements')
    .insert([ann])
    .select();
  return { data, error };
};

export const updateAnnouncement = async (id, updates) => {
  const { data, error } = await supabase
    .from('public_announcements')
    .update(updates)
    .eq('id', id)
    .select();
  return { data, error };
};

export const deleteAnnouncement = async (id) => {
  const { error } = await supabase
    .from('public_announcements')
    .delete()
    .eq('id', id);
  return { error };
};

// ── DASHBOARD ANALİTİK ──
export const getDashboardLogs = async (startDate, endDate) => {
  const { data, error } = await supabase.rpc('get_dashboard_logs', {
    p_start_date: startDate,
    p_end_date:   endDate,
  });
  return { data, error };
};

export const updateDashboardAccess = async (userId, canView) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ can_view_dashboard: canView })
    .eq('user_id', userId)
    .select();
  return { data, error };
};

// ── SEED DEMO DATA ──
export const seedDemoData = async (userId) => {
  const { data, error } = await supabase.rpc('seed_demo_data', { p_user_id: userId });
  return { data, error };
};

// ── CLEAR TABLE ──
export const clearTable = async (table, userId) => {
  const { error } = await supabase.from(table).delete().eq('user_id', userId);
  return { error };
};

// ── ORG CHART ──
export const getOrgChart = async () => {
  const { data, error } = await supabase
    .from('org_config')
    .select('value')
    .eq('key', 'org_chart')
    .single();
  return { data: data?.value || null, error };
};

export const saveOrgChart = async (chartData) => {
  const { data, error } = await supabase
    .from('org_config')
    .upsert({ key: 'org_chart', value: chartData, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    .select();
  return { data, error };
};


// ── KULLANICI SİLME ──
export const deleteUser = async (targetUserId) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: { message: "Oturum bulunamadı" } };
  try {
    const res = await fetch(
      `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/delete-user`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ targetUserId }),
      }
    );
    const json = await res.json();
    if (!res.ok) return { error: { message: json.error || "Silme hatası" } };
    return { data: json, error: null };
  } catch (err) {
    return { error: { message: err.message } };
  }
};

// ── PROFIL GÜNCELLEME ──
export const updateUserProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select()
    .single();
  return { data, error };
};

export const updateAuthEmail = async (newEmail) => {
  const { data, error } = await supabase.auth.updateUser({ email: newEmail });
  return { data, error };
};

export const updateAuthPassword = async (newPassword) => {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  return { data, error };
};

// Profil resmi yükle → avatars/{userId}/avatar.{ext}
export const uploadAvatar = async (userId, file) => {
  const ext  = file.name.split('.').pop().toLowerCase();
  const path = `${userId}/avatar.${ext}`;
  // Önce varsa sil
  await supabase.storage.from('avatars').remove([path]);
  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) return { data: null, error };
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
  // cache-bust
  const publicUrl = urlData.publicUrl + '?t=' + Date.now();
  return { data: publicUrl, error: null };
};

// ── GÜNDEMLER (AGENDAS) ──
// userId: is_private=false/null → herkes görür
//         is_private=true  → sadece created_by=userId veya assigned_to=userId (asistan dahil)
export const getAllAgendas = async (userId = null) => {
  let query = supabase.from('agendas').select('*').order('due_date', { ascending: true });
  if (userId) {
    query = query.or(`is_private.is.null,is_private.eq.false,created_by.eq.${userId},assigned_to.eq.${userId}`);
  }
  const { data, error } = await query;
  return { data, error };
};

export const createAgendaItem = async (agenda) => {
  const { data, error } = await supabase
    .from('agendas')
    .insert([agenda])
    .select();
  if (!error) logActivity({ action: 'oluşturdu', module: 'gündemler', entityType: 'gündem', entityName: data?.[0]?.title || agenda?.title });
  return { data, error };
};

export const updateAgendaItem = async (id, updates) => {
  const { data, error } = await supabase
    .from('agendas')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();
  if (!error) logActivity({ action: 'güncelledi', module: 'gündemler', entityType: 'gündem', entityName: data?.[0]?.title || updates?.title });
  return { data, error };
};

export const deleteAgendaItem = async (id) => {
  const { error } = await supabase
    .from('agendas')
    .delete()
    .eq('id', id);
  if (!error) logActivity({ action: 'sildi', module: 'gündemler', entityType: 'gündem' });
  return { error };
};

// ── GÖREV ONAY AKIŞI ──

// Personel: "Tamamlandım" → pending_review
export const markTaskPendingReview = async (id, completedNote = null) => {
  const { data, error } = await supabase
    .from('agendas')
    .update({
      completion_status: 'pending_review',
      completed_note: completedNote,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select();
  return { data, error };
};

// Koordinatör: "Onayla"
export const approveTask = async (id, reviewerId) => {
  const { data, error } = await supabase
    .from('agendas')
    .update({
      completion_status: 'approved',
      status: 'tamamlandi',
      completed_at: new Date().toISOString(),
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      revision_note: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select();
  return { data, error };
};

// Koordinatör: "Revizeye Gönder"
export const requestRevision = async (id, note, reviewerId) => {
  const { data, error } = await supabase
    .from('agendas')
    .update({
      completion_status: 'revision_requested',
      revision_note: note,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select();
  return { data, error };
};

// Açık görevleri getir: gündemler + görevler (agenda_tasks) birleşik
export const getMyOpenTasks = async (userId) => {
  // 1. Kullanıcıya atanan veya kendisinin oluşturduğu gündemler
  const { data: agendas, error: agendaErr } = await supabase
    .from('agendas')
    .select('id, title, priority, due_date, unit')
    .or(`assigned_to.eq.${userId},and(created_by.eq.${userId},assigned_to.is.null)`)
    .neq('status', 'tamamlandi')
    .order('due_date', { ascending: true });

  // 2. Kullanıcıya atanan görevler (agenda_tasks tablosundan)
  const { data: tasks, error: taskErr } = await supabase
    .from('agenda_tasks')
    .select('id, title, priority, due_date, status, completion_status, agenda_id')
    .eq('assigned_to', userId)
    .not('completion_status', 'eq', 'approved')
    .order('due_date', { ascending: true });

  // Görevlerin parent gündem başlıklarını çek
  const taskAgendaIds = [...new Set((tasks || []).map(t => t.agenda_id).filter(Boolean))];
  let agendaMap = {};
  if (taskAgendaIds.length > 0) {
    const { data: parentAgendas } = await supabase
      .from('agendas')
      .select('id, title, unit')
      .in('id', taskAgendaIds);
    (parentAgendas || []).forEach(a => { agendaMap[a.id] = a; });
  }

  // Gündemleri _type: 'agenda' ile işaretle
  const agendaItems = (agendas || []).map(a => ({ ...a, _type: 'agenda' }));
  // Görevleri _type: 'task' ile işaretle
  const taskItems = (tasks || [])
    .filter(t => t.status !== 'tamamlandi')
    .map(t => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      due_date: t.due_date,
      unit: agendaMap[t.agenda_id]?.unit || null,
      _type: 'task',
      _agendaTitle: agendaMap[t.agenda_id]?.title || '',
    }));

  // Birleştir: önce görevler, sonra gündemler
  const combined = [...taskItems, ...agendaItems];
  return { data: combined, error: agendaErr || taskErr };
};

// Birimdeki tüm gündemleri getir (iş kaydı bağlama için)
export const getUnitAgendas = async (unit) => {
  const { data, error } = await supabase
    .from('agendas')
    .select('id, title, unit, priority, due_date, status')
    .neq('status', 'tamamlandi')
    .neq('status', 'arsiv')
    .order('created_at', { ascending: false });

  // Birim filtresi: eğer unit varsa sadece o birim + birim belirtilmemiş olanları getir
  const filtered = unit
    ? (data || []).filter(a => a.unit === unit || !a.unit)
    : (data || []);

  const agendaItems = filtered.map(a => ({ ...a, _type: 'agenda' }));
  return { data: agendaItems, error };
};

// ── GÜNDEM TÜRLERİ ──────────────────────────────────────────────────────────
export const getAgendaTypes = async () => {
  const { data, error } = await supabase
    .from('agenda_types')
    .select('*')
    .order('sort_order', { ascending: true });
  return { data, error };
};

export const createAgendaType = async (type) => {
  const { data, error } = await supabase
    .from('agenda_types')
    .insert([type])
    .select();
  return { data, error };
};

export const updateAgendaType = async (id, updates) => {
  const { data, error } = await supabase
    .from('agenda_types')
    .update(updates)
    .eq('id', id)
    .select();
  return { data, error };
};

export const deleteAgendaType = async (id) => {
  const { error } = await supabase.from('agenda_types').delete().eq('id', id);
  return { error };
};

// ── YENİ GÜNDEM SİSTEMİ ─────────────────────────────────────────────────────

// Gündemleri türleri ve görev sayısıyla getir
export const getAgendasV2 = async (userId = null, unit = null) => {
  let query = supabase
    .from('agendas')
    .select(`
      *,
      agenda_types ( id, name, icon, color, fields ),
      agenda_tasks ( id, title, assigned_to, assigned_to_name, priority, status, completion_status, due_date, created_by )
    `)
    .order('created_at', { ascending: false });

  if (userId) {
    query = query.or(`is_private.is.null,is_private.eq.false,created_by.eq.${userId},assigned_to.eq.${userId}`);
    // Başkasının kişisel gündemlerini gizle: is_personal=true ise sadece kendi oluşturduğu görünsün
    query = query.or(`is_personal.is.null,is_personal.eq.false,created_by.eq.${userId}`);
  }
  // Birime göre filtrele (direktör değilse sadece kendi birimi)
  // assigned_to=userId veya created_by=userId olan gündemler birim filtresini bypass eder
  if (unit && userId) {
    query = query.or(`unit.eq."${unit}",assigned_to.eq.${userId},created_by.eq.${userId}`);
  } else if (unit) {
    query = query.eq('unit', unit);
  }
  const { data, error } = await query;

  // Ayrıca: kullanıcının görev atanmış olduğu ama birim/assigned_to ile eşleşmeyen gündemleri de getir
  let combinedData = data || [];
  if (userId && !error) {
    try {
      const { data: taskRows } = await supabase
        .from('agenda_tasks')
        .select('agenda_id')
        .eq('assigned_to', userId);
      if (taskRows && taskRows.length > 0) {
        const existingIds = new Set(combinedData.map(a => a.id));
        const missingIds = [...new Set(taskRows.map(t => t.agenda_id))].filter(id => !existingIds.has(id));
        if (missingIds.length > 0) {
          const { data: extra } = await supabase
            .from('agendas')
            .select(`
              *,
              agenda_types ( id, name, icon, color, fields ),
              agenda_tasks ( id, title, assigned_to, assigned_to_name, priority, status, completion_status, due_date, created_by )
            `)
            .in('id', missingIds);
          if (extra && extra.length > 0) {
            combinedData = [...combinedData, ...extra];
          }
        }
      }
    } catch (err) { console.error('getAgendasV2 merge error:', err); }
  }

  return { data: combinedData, error };
};

// Tek gündem detayı (yorumlarla)
export const getAgendaDetail = async (agendaId) => {
  const { data: agenda, error: ae } = await supabase
    .from('agendas')
    .select(`*, agenda_types ( id, name, icon, color, fields )`)
    .eq('id', agendaId)
    .single();

  const { data: tasks, error: te } = await supabase
    .from('agenda_tasks')
    .select('*')
    .eq('agenda_id', agendaId)
    .order('created_at', { ascending: true });

  const { data: comments, error: ce } = await supabase
    .from('agenda_comments')
    .select('*')
    .eq('agenda_id', agendaId)
    .order('created_at', { ascending: true });

  return {
    data: { agenda, tasks: tasks || [], comments: comments || [] },
    error: ae || te || ce,
  };
};

// Gündem oluştur
export const createAgenda = async (agenda) => {
  const { data, error } = await supabase
    .from('agendas')
    .insert([{ ...agenda, updated_at: new Date().toISOString() }])
    .select();
  if (!error) logActivity({ action: 'oluşturdu', module: 'gündemler', entityType: 'gündem', entityName: data?.[0]?.title || agenda?.title });
  return { data, error };
};

// Gündem güncelle
export const updateAgenda = async (id, updates) => {
  const { data, error } = await supabase
    .from('agendas')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();
  if (!error) logActivity({ action: 'güncelledi', module: 'gündemler', entityType: 'gündem', entityName: data?.[0]?.title || updates?.title });
  return { data, error };
};

// Gündem sil
export const deleteAgenda = async (id) => {
  const { error } = await supabase.from('agendas').delete().eq('id', id);
  if (!error) logActivity({ action: 'sildi', module: 'gündemler', entityType: 'gündem' });
  return { error };
};

// ── GÜNDEM GÖREVLERİ ─────────────────────────────────────────────────────────

export const createAgendaTask = async (task) => {
  const { data, error } = await supabase
    .from('agenda_tasks')
    .insert([{ ...task, updated_at: new Date().toISOString() }])
    .select();
  if (!error) logActivity({ action: 'oluşturdu', module: 'gündemler', entityType: 'görev', entityName: data?.[0]?.title || task?.title });
  return { data, error };
};

export const updateAgendaTask = async (id, updates) => {
  const { data, error } = await supabase
    .from('agenda_tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();
  if (!error) logActivity({ action: 'güncelledi', module: 'gündemler', entityType: 'görev', entityName: data?.[0]?.title || updates?.title });
  return { data, error };
};

export const deleteAgendaTask = async (id) => {
  const { error } = await supabase.from('agenda_tasks').delete().eq('id', id);
  if (!error) logActivity({ action: 'sildi', module: 'gündemler', entityType: 'görev' });
  return { error };
};

// Personel: Tamamlandım → onay bekliyor
export const markAgendaTaskDone = async (id) => {
  const { data, error } = await supabase
    .from('agenda_tasks')
    .update({ completion_status: 'pending_review', status: 'tamamlandi', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();
  if (!error) logActivity({ action: 'tamamladı', module: 'gündemler', entityType: 'görev' });
  return { data, error };
};

// Kişisel görev: Tamamlandım → direkt approved (onay gerekmez)
export const markAgendaTaskDoneSelf = async (id) => {
  const { data, error } = await supabase
    .from('agenda_tasks')
    .update({ completion_status: 'approved', status: 'tamamlandi', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();
  if (!error) logActivity({ action: 'tamamladı', module: 'gündemler', entityType: 'görev' });
  return { data, error };
};

// Koordinatör: Onayla
export const approveAgendaTask = async (id) => {
  const { data, error } = await supabase
    .from('agenda_tasks')
    .update({ completion_status: 'approved', status: 'tamamlandi', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();
  if (!error) logActivity({ action: 'onayladı', module: 'gündemler', entityType: 'görev' });
  return { data, error };
};

// Koordinatör: Revize iste
export const requestAgendaTaskRevision = async (id, note) => {
  const { data, error } = await supabase
    .from('agenda_tasks')
    .update({ completion_status: 'revision_requested', revision_note: note, status: 'devam_ediyor', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();
  return { data, error };
};

// Koordinatör: Arşivle
export const archiveAgendaTask = async (id) => {
  const { data, error } = await supabase
    .from('agenda_tasks')
    .update({ status: 'arsiv', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();
  return { data, error };
};

// ── GÜNDEM YORUMLARI ──────────────────────────────────────────────────────────

export const addAgendaComment = async (comment) => {
  const { data, error } = await supabase
    .from('agenda_comments')
    .insert([comment])
    .select();
  if (!error) logActivity({ action: 'yorum ekledi', module: 'gündemler', entityType: 'yorum' });
  return { data, error };
};

export const deleteAgendaComment = async (id) => {
  const { error } = await supabase.from('agenda_comments').delete().eq('id', id);
  return { error };
};

// ── INVITE STAFF (Edge Function proxy) ──
export const inviteStaffMember = async (email, name, role = "personel") => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: { message: "Oturum bulunamadı" } };
  try {
    const res = await fetch(
      `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/invite-staff`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email, name, role }),
      }
    );
    const json = await res.json();
    if (!res.ok) return { error: { message: json.error || "Hata oluştu" } };
    return { data: json, error: null };
  } catch (e) {
    return { error: { message: e.message } };
  }
};


// ── GÖREV / GÜNDEM BİLDİRİMİ (notify-task-assigned Edge Function) ──
// isAgenda: true → "Yeni Gündem Atandı" şablonu, tasks[] → gündem görevleri listelenir
export const notifyTaskAssigned = async ({
  assignedToUserId,
  taskTitle,
  taskDescription,
  taskPriority,
  taskDueDate,
  taskUnit,
  createdByName,
  isAgenda = false,
  tasks = [],
}) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: { message: 'Oturum bulunamadı' } };
  try {
    const res = await fetch(
      `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/notify-task-assigned`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          assignedToUserId,
          taskTitle,
          taskDescription,
          taskPriority,
          taskDueDate,
          taskUnit,
          createdByName,
          isAgenda,
          tasks,
        }),
      }
    );
    const json = await res.json();
    if (!res.ok) return { error: { message: json.error || 'Bildirim gönderilemedi' } };
    return { data: json, error: null };
  } catch (e) {
    return { error: { message: e.message } };
  }
};

// ── NETWORK MANAGEMENT ───────────────────────────────────────────────────────

// Tüm network verisini tek seferde çek
export const getNetworkAll = async () => {
  const [orgs, contacts, eventsRes, connections] = await Promise.all([
    supabase.from('network_organizations').select('*').order('name'),
    supabase.from('network_contacts').select('*').order('full_name'),
    supabase.from('events').select('*').order('start_date', { ascending: false }),
    supabase.from('network_connections').select('*').order('created_at'),
  ]);
  // events tablosu alan adlarını NetworkManager'ın beklediği biçime dönüştür
  const mappedEvents = (eventsRes.data || []).map(e => ({
    ...e,
    name:       e.title,
    event_date: e.start_date,
    location:   e.location_name,
  }));
  return {
    organizations: orgs.data    || [],
    contacts:      contacts.data || [],
    events:        mappedEvents,
    connections:   connections.data || [],
    error: orgs.error || contacts.error || eventsRes.error || connections.error,
  };
};

// ── Yardımcı: auth kontrolü ──
const _getUid = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
};

// ── ORGANIZATIONS ──
export const createNetworkOrg = async (data, creatorName = null) => {
  const uid = await _getUid();
  if (!uid) return { data: null, error: { message: 'Oturum bulunamadı' } };
  const { data: d, error } = await supabase.from('network_organizations')
    .insert({ ...data, created_by: uid, created_by_name: creatorName || null }).select().single();
  if (!error) logActivity({ action: 'oluşturdu', module: 'network', entityType: 'kurum', entityName: d?.name || data?.name });
  return { data: d, error };
};
export const updateNetworkOrg = async (id, data) => {
  const { data: d, error } = await supabase.from('network_organizations')
    .update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (!error) logActivity({ action: 'güncelledi', module: 'network', entityType: 'kurum', entityName: d?.name || data?.name });
  return { data: d, error };
};
export const deleteNetworkOrg = async (id) => {
  const { error } = await supabase.from('network_organizations').delete().eq('id', id);
  if (!error) logActivity({ action: 'sildi', module: 'network', entityType: 'kurum' });
  return { error };
};

// ── CONTACTS ──
export const createNetworkContact = async (data, creatorName = null) => {
  const uid = await _getUid();
  if (!uid) return { data: null, error: { message: 'Oturum bulunamadı' } };
  const { data: d, error } = await supabase.from('network_contacts')
    .insert({ ...data, created_by: uid, created_by_name: creatorName || null }).select().single();
  if (!error) logActivity({ action: 'oluşturdu', module: 'network', entityType: 'kişi', entityName: d?.full_name || data?.full_name });
  return { data: d, error };
};
export const updateNetworkContact = async (id, data) => {
  const { data: d, error } = await supabase.from('network_contacts')
    .update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (!error) logActivity({ action: 'güncelledi', module: 'network', entityType: 'kişi', entityName: d?.full_name || data?.full_name });
  return { data: d, error };
};
export const deleteNetworkContact = async (id) => {
  const { error } = await supabase.from('network_contacts').delete().eq('id', id);
  if (!error) logActivity({ action: 'sildi', module: 'network', entityType: 'kişi' });
  return { error };
};

// ── EVENTS (artık ana events tablosundan) ──
const nullIfEmpty = (v) => (!v || v === '' ? null : v);
export const createNetworkEvent = async (data, creatorName = null) => {
  const uid = await _getUid();
  if (!uid) return { data: null, error: { message: 'Oturum bulunamadı' } };
  // network_events alan adlarını events tablosu alanlarına dönüştür
  const payload = {
    title:         data.name || data.title,
    event_type:    data.event_type || 'diger',
    status:        'planned',
    start_date:    nullIfEmpty(data.event_date || data.start_date) || new Date().toISOString().split('T')[0],
    end_date:      nullIfEmpty(data.end_date),
    location_name: nullIfEmpty(data.location || data.location_name),
    description:   nullIfEmpty(data.description),
    website_url:   nullIfEmpty(data.drive_url || data.website_url),
    unit:          data.unit || null,
    owner_id:      uid,
    created_by:    uid,
  };
  const { data: d, error } = await supabase.from('events').insert(payload).select().single();
  // NetworkManager'ın beklediği alan adlarına geri dönüştür
  if (d) { d.name = d.title; d.event_date = d.start_date; d.location = d.location_name; }
  return { data: d, error };
};
export const updateNetworkEvent = async (id, data) => {
  const payload = {};
  if (data.name !== undefined)       payload.title         = data.name;
  if (data.title !== undefined)      payload.title         = data.title;
  if (data.event_type !== undefined) payload.event_type    = data.event_type;
  if (data.event_date !== undefined) payload.start_date    = nullIfEmpty(data.event_date);
  if (data.start_date !== undefined) payload.start_date    = nullIfEmpty(data.start_date);
  if (data.end_date !== undefined)   payload.end_date      = nullIfEmpty(data.end_date);
  if (data.location !== undefined)   payload.location_name = nullIfEmpty(data.location);
  if (data.description !== undefined) payload.description  = nullIfEmpty(data.description);
  if (data.drive_url !== undefined)  payload.website_url   = nullIfEmpty(data.drive_url);
  payload.updated_at = new Date().toISOString();
  const { data: d, error } = await supabase.from('events').update(payload).eq('id', id).select().single();
  if (d) { d.name = d.title; d.event_date = d.start_date; d.location = d.location_name; }
  return { data: d, error };
};
export const deleteNetworkEvent = async (id) => {
  const { error } = await supabase.from('events').delete().eq('id', id);
  return { error };
};

// ── CONNECTIONS ──
export const createNetworkConnection = async (data) => {
  const uid = await _getUid();
  if (!uid) return { data: null, error: { message: 'Oturum bulunamadı' } };
  const { data: d, error } = await supabase.from('network_connections')
    .insert({ ...data, created_by: uid })
    .select().single();
  return { data: d, error };
};
export const deleteNetworkConnection = async (id) => {
  const { error } = await supabase.from('network_connections').delete().eq('id', id);
  return { error };
};

// ── NETWORK AKTİVİTE LOGU ──────────────────────────────────────────────────────
/**
 * Tüm network işlemlerini kalıcı olarak loglar.
 * Loglar değiştirilemez / silinemez (RLS policy).
 */
export const logNetworkActivity = async ({
  userId,
  userName,
  actionType,   // 'create' | 'update' | 'delete' | 'connect' | 'disconnect'
  entityType,   // 'contact' | 'organization' | 'event' | 'connection'
  entityId = null,
  entityName = null,
  detail = {},
}) => {
  try {
    await supabase.from('network_activity_log').insert({
      user_id:     userId   || null,
      user_name:   userName || null,
      action_type: actionType,
      entity_type: entityType,
      entity_id:   entityId   || null,
      entity_name: entityName || null,
      detail:      detail || {},
    });
  } catch (e) {
    // Loglama hatası ana işlemi engellemesin
    console.error('[NetworkLog] log yazılamadı:', e);
  }
};

export const getNetworkActivityLog = async ({ limit = 200, offset = 0, actionType = null, entityType = null } = {}) => {
  let q = supabase
    .from('network_activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (actionType) q = q.eq('action_type', actionType);
  if (entityType) q = q.eq('entity_type', entityType);
  const { data, error } = await q;
  return { data: data || [], error };
};

// ── CONTACT COMMUNICATIONS (İletişim Geçmişi) ──
export const getContactComms = async (contactId) => {
  const { data, error } = await supabase.from('network_contact_comms')
    .select('*').eq('contact_id', contactId)
    .order('comm_date', { ascending: false });
  return { data, error };
};
export const createContactComm = async (payload) => {
  const uid = await _getUid();
  if (!uid) return { data: null, error: { message: 'Oturum bulunamadı' } };
  const { data, error } = await supabase.from('network_contact_comms')
    .insert({ ...payload, created_by: uid }).select().single();
  return { data, error };
};
export const deleteContactComm = async (id) => {
  const { error } = await supabase.from('network_contact_comms').delete().eq('id', id);
  return { error };
};

// ── NETWORK MEDIA UPLOAD ──
export const uploadNetworkMedia = async (userId, entityType, entityId, file) => {
  const ext  = file.name.split('.').pop().toLowerCase();
  const path = `${userId}/${entityType}_${entityId}.${ext}`;
  await supabase.storage.from('network-media').remove([path]);
  const { error } = await supabase.storage
    .from('network-media').upload(path, file, { upsert: true, contentType: file.type });
  if (error) return { data: null, error };
  const { data: urlData } = supabase.storage.from('network-media').getPublicUrl(path);
  return { data: urlData.publicUrl + '?t=' + Date.now(), error: null };
};

// ── BİLDİRİMLER ──────────────────────────────────────────────────────────────

// Bildirim oluştur — SECURITY DEFINER RPC kullanarak (RLS bypass)
export const createNotification = async ({ userId, type, title, body, linkType, linkId, createdBy, createdByName }) => {
  console.log('[createNotification] RPC call:', { userId, type, title });
  const { data, error } = await supabase.rpc('create_notification', {
    p_user_id: userId,
    p_type: type,
    p_title: title,
    p_body: body || null,
    p_link_type: linkType || null,
    p_link_id: linkId || null,
    p_created_by: createdBy || null,
    p_created_by_name: createdByName || null,
  });
  if (error) console.error('[createNotification] ERROR:', error);
  else console.log('[createNotification] OK — id:', data);
  return { data, error };
};

// Toplu bildirim oluştur (birden fazla kişiye)
export const createNotifications = async (notifications) => {
  const payload = notifications.map(n => ({
    user_id: n.userId,
    type: n.type,
    title: n.title,
    body: n.body || null,
    link_type: n.linkType || null,
    link_id: n.linkId || null,
    created_by: n.createdBy || null,
    created_by_name: n.createdByName || null,
  }));
  const { data, error } = await supabase.rpc('create_notifications_bulk', {
    p_notifications: payload,
  });
  if (error) console.error('[createNotifications] ERROR:', error);
  return { data, error };
};

// Kullanıcının bildirimlerini getir
export const getNotifications = async (userId, limit = 50) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return { data, error };
};

// Okunmamış bildirim sayısı
export const getUnreadNotificationCount = async (userId) => {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  return { count: count || 0, error };
};

// Bildirimi okundu olarak işaretle
export const markNotificationRead = async (notificationId) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
  return { error };
};

// Tüm bildirimleri okundu yap
export const markAllNotificationsRead = async (userId) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  return { error };
};

// ── OYUNLAŞTIRMA (GAMIFICATION) ─────────────────────────────────────────────

// Fallback değerleri — DB'den okunamazsa bunlar kullanılır
export const XP_VALUES_DEFAULT = {
  task_complete:      25,
  agenda_create:      25,
  on_time_bonus:      10,
  comment:             5,
  collaboration:       5,
  network_contact:    15,
  network_org:        15,
  network_event:      15,
  fund_opportunity:   50,
  daily_log_entry:    10,
  daily_log_hour:      5,
  daily_log_fullday:  20,
  daily_log_overtime: 10,
  // Etkinlik modülü
  event_create:        30,
  event_note:          10,
  event_document:      10,
  event_participant:    5,
  event_complete:      15,
  // Network
  network_connect:     10,
  // Profil & giriş
  profile_complete:    25,
  first_login_week:     5,
  // Seriler
  weekly_streak:       50,
  monthly_streak:     100,
};

// Cache: DB'den okunan XP settings
let _xpSettingsCache = null;
let _xpSettingsCacheTime = 0;
const XP_CACHE_TTL = 60000; // 1 dk cache

export const getXPSettings = async () => {
  if (_xpSettingsCache && Date.now() - _xpSettingsCacheTime < XP_CACHE_TTL) return _xpSettingsCache;
  const { data, error } = await supabase.from('xp_settings').select('*');
  if (error || !data) return XP_VALUES_DEFAULT;
  const map = {};
  data.forEach(row => { map[row.action] = row.xp_amount; });
  _xpSettingsCache = map;
  _xpSettingsCacheTime = Date.now();
  return map;
};

export const getXPSettingsFull = async () => {
  const { data, error } = await supabase.from('xp_settings').select('*').order('category, action');
  return { data, error };
};

export const updateXPSetting = async (action, xpAmount) => {
  _xpSettingsCache = null; // cache invalidate
  const { data, error } = await supabase.from('xp_settings').update({ xp_amount: xpAmount, updated_at: new Date().toISOString() }).eq('action', action).select();
  return { data, error };
};

export const awardXP = async (userId, action, description, referenceId) => {
  try {
    const settings = await getXPSettings();
    const xp = settings[action] ?? XP_VALUES_DEFAULT[action];
    if (!xp) { console.warn('[awardXP] Unknown action:', action); return { data: null, error: null }; }
    const { data, error } = await supabase.rpc('award_xp', {
      p_user_id: userId, p_action: action, p_xp_amount: xp,
      p_description: description || null, p_reference_id: referenceId ? String(referenceId) : null,
    });
    if (error) console.error('[awardXP] ERROR:', error.message, { userId, action, xp });
    else console.log('[awardXP] OK:', action, '+' + xp + 'XP', data);
    return { data, error };
  } catch (e) { console.error('[awardXP] EXCEPTION:', e); return { data: null, error: e }; }
};

// Özel miktarla XP ver (DailyLog fazla mesai gibi hesaplanmış değerler için)
export const awardXPCustom = async (userId, action, xpAmount, description, referenceId) => {
  try {
    if (!xpAmount || xpAmount <= 0) return { data: null, error: null };
    const { data, error } = await supabase.rpc('award_xp', {
      p_user_id: userId, p_action: action, p_xp_amount: xpAmount,
      p_description: description || null, p_reference_id: referenceId ? String(referenceId) : null,
    });
    if (error) console.error('[awardXPCustom] ERROR:', error.message, { userId, action, xpAmount });
    else console.log('[awardXPCustom] OK:', action, '+' + xpAmount + 'XP', data);
    return { data, error };
  } catch (e) { console.error('[awardXPCustom] EXCEPTION:', e); return { data: null, error: e }; }
};

export const getLeaderboard = async () => {
  const { data, error } = await supabase.from('user_xp').select('user_id, total_xp, level').order('total_xp', { ascending: false });
  return { data, error };
};

export const getUserXP = async (userId) => {
  const { data, error } = await supabase.from('user_xp').select('*').eq('user_id', userId).maybeSingle();
  return { data, error };
};

export const getUserXPHistory = async (userId, limit = 30) => {
  const { data, error } = await supabase.from('xp_events').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
  return { data, error };
};

export const getAllXPHistory = async (limit = 100) => {
  const { data, error } = await supabase.from('xp_events').select('*').order('created_at', { ascending: false }).limit(limit);
  return { data, error };
};

export const getAllBadges = async () => {
  const { data, error } = await supabase.from('badges').select('*').order('sort_order');
  return { data, error };
};

export const getUserBadges = async (userId) => {
  const { data, error } = await supabase.from('user_badges').select('*, badges(*)').eq('user_id', userId).order('earned_at', { ascending: false });
  return { data, error };
};

// ── Personel XP geçmişi (direktör filtreli görünüm) ──
export const getXPEventsByUser = async (userId, startDate, endDate) => {
  let query = supabase.from('xp_events').select('*').order('created_at', { ascending: false });
  if (userId) query = query.eq('user_id', userId);
  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate + 'T23:59:59');
  const { data, error } = await query;
  return { data, error };
};

// Seçilen zaman aralığında kişi başına eylem özeti (action → count, toplam XP)
export const getXPActionSummary = async (userId, startDate, endDate) => {
  let query = supabase.from('xp_events')
    .select('action, xp_amount');
  if (userId) query = query.eq('user_id', userId);
  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate + 'T23:59:59');
  const { data, error } = await query;
  if (error || !data) return { data: null, error };
  // JS tarafında grupla
  const map = {};
  data.forEach(e => {
    if (!map[e.action]) map[e.action] = { action: e.action, count: 0, total_xp: 0 };
    map[e.action].count += 1;
    map[e.action].total_xp += e.xp_amount || 0;
  });
  return { data: Object.values(map).sort((a, b) => b.count - a.count), error: null };
};

// ── Dönemsel XP (haftalık/aylık liderlik tablosu) ──

export const getXPEventsByPeriod = async (startDate, endDate) => {
  const { data, error } = await supabase.from('xp_events')
    .select('user_id, xp_amount')
    .gte('created_at', startDate)
    .lte('created_at', endDate);
  return { data, error };
};

export const getLeaderHistory = async (limit = 50) => {
  const { data, error } = await supabase.from('leader_history')
    .select('*')
    .order('period_start', { ascending: false })
    .limit(limit);
  return { data, error };
};

export const upsertLeaderHistory = async (record) => {
  const { data, error } = await supabase.from('leader_history')
    .upsert(record, { onConflict: 'period_type,period_label' })
    .select();
  return { data, error };
};

// ── FUND OPPORTUNITIES ──

export const getFundOpportunities = async () => {
  const { data, error } = await supabase.from('fund_opportunities')
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
};

export const createFundOpportunity = async (record) => {
  const { data, error } = await supabase.from('fund_opportunities')
    .insert(record)
    .select();
  if (!error) logActivity({ action: 'oluşturdu', module: 'fonlar', entityType: 'fon_fırsatı', entityName: data?.[0]?.title || record?.title });
  return { data, error };
};

export const updateFundOpportunity = async (id, updates) => {
  const { data, error } = await supabase.from('fund_opportunities')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();
  if (!error) logActivity({ action: 'güncelledi', module: 'fonlar', entityType: 'fon_fırsatı', entityName: data?.[0]?.title || updates?.title });
  return { data, error };
};

export const deleteFundOpportunity = async (id) => {
  const { data, error } = await supabase.from('fund_opportunities')
    .delete()
    .eq('id', id);
  if (!error) logActivity({ action: 'sildi', module: 'fonlar', entityType: 'fon_fırsatı' });
  return { data, error };
};

// ── FORMS MODULE ──

export const getForms = async () => {
  const { data, error } = await supabase.from('forms')
    .select('*').order('created_at', { ascending: false });
  return { data, error };
};

export const getFormById = async (id) => {
  const { data, error } = await supabase.from('forms')
    .select('*').eq('id', id).single();
  return { data, error };
};

export const getFormBySlug = async (slug) => {
  const { data, error } = await supabase.from('forms')
    .select('*').eq('public_slug', slug).eq('status', 'active').single();
  return { data, error };
};

export const createForm = async (record) => {
  const { data, error } = await supabase.from('forms').insert(record).select();
  return { data, error };
};

export const updateForm = async (id, updates) => {
  const { data, error } = await supabase.from('forms')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select();
  return { data, error };
};

export const deleteForm = async (id) => {
  const { data, error } = await supabase.from('forms').delete().eq('id', id);
  return { data, error };
};

// Form Fields
export const getFormFields = async (formId) => {
  const { data, error } = await supabase.from('form_fields')
    .select('*').eq('form_id', formId).order('sort_order');
  return { data, error };
};

export const upsertFormFields = async (fields) => {
  // id olmadan insert et — DB auto-generate etsin (upsert undefined id ile sorun çıkarır)
  const cleanFields = fields.map(({ id, ...rest }) => rest);
  const { data, error } = await supabase.from('form_fields').insert(cleanFields).select();
  if (error) console.error('upsertFormFields error:', error.message, error.details);
  return { data, error };
};

export const deleteFormField = async (fieldId) => {
  const { data, error } = await supabase.from('form_fields').delete().eq('id', fieldId);
  return { data, error };
};

export const deleteFormFieldsByFormId = async (formId) => {
  const { data, error } = await supabase.from('form_fields').delete().eq('form_id', formId);
  return { data, error };
};

// Form Responses
export const getFormResponses = async (formId) => {
  const { data, error } = await supabase.from('form_responses')
    .select('*').eq('form_id', formId).order('submitted_at', { ascending: false });
  return { data, error };
};

export const getFormResponseData = async (responseId) => {
  const { data, error } = await supabase.from('form_response_data')
    .select('*').eq('response_id', responseId);
  return { data, error };
};

export const getAllFormResponseData = async (formId) => {
  const { data, error } = await supabase.from('form_responses')
    .select('id, respondent_name, respondent_email, submitted_at, is_anonymous, form_response_data(field_id, value)')
    .eq('form_id', formId)
    .order('submitted_at', { ascending: false });
  return { data, error };
};

export const submitFormResponse = async (response, answers) => {
  // 1) Insert response
  const { data: respData, error: respErr } = await supabase.from('form_responses')
    .insert(response).select();
  if (respErr || !respData?.[0]) return { data: null, error: respErr };

  const responseId = respData[0].id;

  // 2) Insert all answer data
  const answerRows = answers.map(a => ({
    response_id: responseId,
    field_id: a.field_id,
    value: a.value,
  }));

  if (answerRows.length > 0) {
    const { error: dataErr } = await supabase.from('form_response_data')
      .insert(answerRows);
    if (dataErr) return { data: null, error: dataErr };
  }

  return { data: respData[0], error: null };
};

// ── DIRECTOR AGENDAS ──────────────────────────────────────────────────────────
export const getDirectorAgendas = async () => {
  const { data, error } = await supabase
    .from('director_agendas')
    .select('*')
    .order('section')
    .order('position')
    .order('created_at');
  return { data: data || [], error };
};

export const createDirectorAgenda = async (payload) => {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('user_profiles').select('full_name').eq('user_id', user?.id).single();
  const { data, error } = await supabase
    .from('director_agendas')
    .insert({ ...payload, created_by: user?.id, created_by_name: profile?.full_name || null })
    .select().single();
  if (!error) logActivity({ action: 'oluşturdu', module: 'direktör_gündemleri', entityType: 'gündem', entityName: data?.title || payload?.title });
  return { data, error };
};

export const updateDirectorAgenda = async (id, updates) => {
  const { data, error } = await supabase
    .from('director_agendas')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (!error) logActivity({ action: 'güncelledi', module: 'direktör_gündemleri', entityType: 'gündem', entityName: data?.title || updates?.title });
  return { data, error };
};

export const deleteDirectorAgenda = async (id) => {
  const { error } = await supabase.from('director_agendas').delete().eq('id', id);
  if (!error) logActivity({ action: 'sildi', module: 'direktör_gündemleri', entityType: 'gündem' });
  return { error };
};

// ── HEDEFLER (GOALS) MODULE ──

// Birim Goals — tek veri kaynağı
export const getBirimGoals = async () => {
  const { data, error } = await supabase
    .from('birim_goals').select('*').order('created_at', { ascending: false });
  return { data, error };
};

export const createBirimGoal = async (goal) => {
  const { data, error } = await supabase.from('birim_goals').insert([goal]).select();
  if (!error) logActivity({ action: 'oluşturdu', module: 'hedefler', entityType: 'birim_hedef', entityName: goal.title });
  return { data, error };
};

export const updateBirimGoal = async (id, updates) => {
  const { data, error } = await supabase
    .from('birim_goals').update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select();
  if (!error) logActivity({ action: 'güncelledi', module: 'hedefler', entityType: 'birim_hedef', entityName: updates.title });
  return { data, error };
};

export const deleteBirimGoal = async (id) => {
  const { error } = await supabase.from('birim_goals').delete().eq('id', id);
  if (!error) logActivity({ action: 'sildi', module: 'hedefler', entityType: 'birim_hedef' });
  return { error };
};

// Kurum Goals
export const getKurumGoals = async () => {
  const { data, error } = await supabase
    .from('kurum_goals').select('*').order('created_at', { ascending: false });
  return { data, error };
};

export const createKurumGoal = async (goal) => {
  const { data, error } = await supabase.from('kurum_goals').insert([goal]).select();
  if (!error) logActivity({ action: 'oluşturdu', module: 'hedefler', entityType: 'kurum_hedef', entityName: goal.title });
  return { data, error };
};

export const updateKurumGoal = async (id, updates) => {
  const { data, error } = await supabase
    .from('kurum_goals').update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select();
  if (!error) logActivity({ action: 'güncelledi', module: 'hedefler', entityType: 'kurum_hedef', entityName: updates.title });
  return { data, error };
};

export const deleteKurumGoal = async (id) => {
  // Bağlantılar ON DELETE CASCADE ile otomatik silinir
  const { error } = await supabase.from('kurum_goals').delete().eq('id', id);
  if (!error) logActivity({ action: 'sildi', module: 'hedefler', entityType: 'kurum_hedef' });
  return { error };
};

// Kurum-Birim Links
export const getKurumBirimLinks = async () => {
  const { data, error } = await supabase.from('kurum_birim_links').select('*');
  return { data, error };
};

export const setKurumBirimLinks = async (kurumGoalId, birimGoalIds) => {
  // Sil-yeniden-ekle stratejisi
  await supabase.from('kurum_birim_links').delete().eq('kurum_goal_id', kurumGoalId);
  if (birimGoalIds.length === 0) return { error: null };
  const rows = birimGoalIds.map(bid => ({ kurum_goal_id: kurumGoalId, birim_goal_id: bid }));
  const { error } = await supabase.from('kurum_birim_links').insert(rows);
  return { error };
};

// Personal Goals
export const getPersonalGoals = async () => {
  const { data, error } = await supabase
    .from('personal_goals').select('*').order('created_at', { ascending: false });
  return { data, error };
};

export const createPersonalGoal = async (goal) => {
  const { data, error } = await supabase.from('personal_goals').insert([goal]).select();
  if (!error) logActivity({ action: 'oluşturdu', module: 'hedefler', entityType: 'kişisel_hedef', entityName: goal.title });
  return { data, error };
};

export const updatePersonalGoal = async (id, updates) => {
  const { data, error } = await supabase
    .from('personal_goals').update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select();
  if (!error) logActivity({ action: 'güncelledi', module: 'hedefler', entityType: 'kişisel_hedef' });
  return { data, error };
};

export const deletePersonalGoal = async (id) => {
  const { error } = await supabase.from('personal_goals').delete().eq('id', id);
  if (!error) logActivity({ action: 'sildi', module: 'hedefler', entityType: 'kişisel_hedef' });
  return { error };
};

// OKR Objectives
export const getOkrObjectives = async () => {
  const { data, error } = await supabase
    .from('okr_objectives').select('*').order('created_at', { ascending: false });
  return { data, error };
};

export const createOkrObjective = async (obj) => {
  const { data, error } = await supabase.from('okr_objectives').insert([obj]).select();
  if (!error) logActivity({ action: 'oluşturdu', module: 'hedefler', entityType: 'okr', entityName: obj.objective });
  return { data, error };
};

export const updateOkrObjective = async (id, updates) => {
  const { data, error } = await supabase
    .from('okr_objectives').update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select();
  if (!error) logActivity({ action: 'güncelledi', module: 'hedefler', entityType: 'okr' });
  return { data, error };
};

export const deleteOkrObjective = async (id) => {
  const { error } = await supabase.from('okr_objectives').delete().eq('id', id);
  if (!error) logActivity({ action: 'sildi', module: 'hedefler', entityType: 'okr' });
  return { error };
};

// OKR Key Results
export const getOkrKeyResults = async () => {
  const { data, error } = await supabase
    .from('okr_key_results').select('*').order('created_at', { ascending: true });
  return { data, error };
};

export const createOkrKeyResult = async (kr) => {
  const { data, error } = await supabase.from('okr_key_results').insert([kr]).select();
  if (!error) logActivity({ action: 'oluşturdu', module: 'hedefler', entityType: 'anahtar_sonuç', entityName: kr.title });
  return { data, error };
};

export const updateOkrKeyResult = async (id, updates) => {
  const { data, error } = await supabase
    .from('okr_key_results').update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select();
  if (!error) logActivity({ action: 'güncelledi', module: 'hedefler', entityType: 'anahtar_sonuç' });
  return { data, error };
};

export const deleteOkrKeyResult = async (id) => {
  const { error } = await supabase.from('okr_key_results').delete().eq('id', id);
  if (!error) logActivity({ action: 'sildi', module: 'hedefler', entityType: 'anahtar_sonuç' });
  return { error };
};

// ═══════════════════════════════════════════════════════════════════
// POLITIKA VE YÖNETİŞİM MODÜLÜ
// Sayfalar + gömülü tablolar (Notion benzeri)
// ═══════════════════════════════════════════════════════════════════

// ── SAYFALAR ────────────────────────────────────────────────────────
export const getPolicyPages = async () => {
  const { data, error } = await supabase
    .from('policy_pages')
    .select('*')
    .eq('is_archived', false)
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: true });
  return { data: data || [], error };
};

export const getPolicyPage = async (id) => {
  const { data, error } = await supabase
    .from('policy_pages').select('*').eq('id', id).single();
  return { data, error };
};

export const createPolicyPage = async (page) => {
  const { data: { user } } = await supabase.auth.getUser();
  const payload = {
    title: page?.title || 'Yeni Sayfa',
    icon: page?.icon || '📄',
    parent_id: page?.parent_id || null,
    content: page?.content ?? [],
    order_index: page?.order_index ?? 0,
    created_by: user?.id || null,
    updated_by: user?.id || null,
  };
  const { data, error } = await supabase
    .from('policy_pages').insert([payload]).select();
  if (!error) logActivity({ action: 'oluşturdu', module: 'politika', entityType: 'sayfa', entityName: payload.title });
  return { data, error };
};

export const updatePolicyPage = async (id, updates) => {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('policy_pages')
    .update({ ...updates, updated_by: user?.id || null, updated_at: new Date().toISOString() })
    .eq('id', id).select();
  if (!error) logActivity({ action: 'güncelledi', module: 'politika', entityType: 'sayfa', entityName: data?.[0]?.title || updates?.title });
  return { data, error };
};

export const deletePolicyPage = async (id) => {
  const { error } = await supabase.from('policy_pages').delete().eq('id', id);
  if (!error) logActivity({ action: 'sildi', module: 'politika', entityType: 'sayfa' });
  return { error };
};

// ── GÖMÜLÜ TABLOLAR (DATABASES) ─────────────────────────────────────
export const getPolicyDatabases = async (pageId) => {
  const { data, error } = await supabase
    .from('policy_databases').select('*')
    .eq('page_id', pageId)
    .order('order_index', { ascending: true });
  return { data: data || [], error };
};

export const createPolicyDatabase = async (db) => {
  const { data: { user } } = await supabase.auth.getUser();
  const payload = {
    page_id: db?.page_id || null,
    name: db?.name || 'Yeni Tablo',
    icon: db?.icon || '📋',
    default_view: db?.default_view || 'table',
    order_index: db?.order_index ?? 0,
    created_by: user?.id || null,
  };
  const { data, error } = await supabase
    .from('policy_databases').insert([payload]).select();
  if (!error) logActivity({ action: 'oluşturdu', module: 'politika', entityType: 'tablo', entityName: payload.name });
  return { data, error };
};

export const updatePolicyDatabase = async (id, updates) => {
  const { data, error } = await supabase
    .from('policy_databases')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select();
  return { data, error };
};

export const deletePolicyDatabase = async (id) => {
  const { error } = await supabase.from('policy_databases').delete().eq('id', id);
  if (!error) logActivity({ action: 'sildi', module: 'politika', entityType: 'tablo' });
  return { error };
};

// ── SÜTUNLAR ────────────────────────────────────────────────────────
export const getPolicyColumns = async (databaseId) => {
  const { data, error } = await supabase
    .from('policy_columns').select('*')
    .eq('database_id', databaseId)
    .order('order_index', { ascending: true });
  return { data: data || [], error };
};

export const createPolicyColumn = async (col) => {
  const payload = {
    database_id: col.database_id,
    name: col.name || 'Sütun',
    type: col.type || 'text',
    options: col.options || [],
    order_index: col.order_index ?? 0,
    width: col.width || 200,
  };
  const { data, error } = await supabase
    .from('policy_columns').insert([payload]).select();
  return { data, error };
};

export const updatePolicyColumn = async (id, updates) => {
  const { data, error } = await supabase
    .from('policy_columns').update(updates).eq('id', id).select();
  return { data, error };
};

export const deletePolicyColumn = async (id) => {
  const { error } = await supabase.from('policy_columns').delete().eq('id', id);
  return { error };
};

// ── SATIRLAR ────────────────────────────────────────────────────────
export const getPolicyRows = async (databaseId) => {
  const { data, error } = await supabase
    .from('policy_rows').select('*')
    .eq('database_id', databaseId)
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: true });
  return { data: data || [], error };
};

export const createPolicyRow = async (row) => {
  const { data: { user } } = await supabase.auth.getUser();
  const payload = {
    database_id: row.database_id,
    data: row.data || {},
    order_index: row.order_index ?? 0,
    created_by: user?.id || null,
    updated_by: user?.id || null,
  };
  const { data, error } = await supabase
    .from('policy_rows').insert([payload]).select();
  return { data, error };
};

export const updatePolicyRow = async (id, updates) => {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('policy_rows')
    .update({ ...updates, updated_by: user?.id || null, updated_at: new Date().toISOString() })
    .eq('id', id).select();
  return { data, error };
};

export const deletePolicyRow = async (id) => {
  const { error } = await supabase.from('policy_rows').delete().eq('id', id);
  return { error };
};

// Profilleri toplu getir (kişi sütunu için)
export const getAllUserProfiles = async () => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id, full_name, role, unit, avatar_url')
    .order('full_name', { ascending: true });
  return { data: data || [], error };
};

// ── GOOGLE DRIVE UPLOAD (Documents modülü) ──
// Dosyayı drive-upload edge function'ına XHR ile POST eder ve progress callback'i tetikler.
// Başarılıda { fileId, name, mimeType, size, webViewLink, webContentLink } döner.
export const uploadDocumentToDrive = (file, { displayName = null, onProgress = null } = {}) => {
  return new Promise(async (resolve, reject) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { reject(new Error('not_authenticated')); return; }
      if (!supabaseUrl || !supabaseAnonKey) { reject(new Error('missing_supabase_config')); return; }

      const url = `${supabaseUrl}/functions/v1/drive-upload`;
      const form = new FormData();
      form.append('file', file);
      if (displayName) form.append('name', displayName);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('apikey', supabaseAnonKey);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && typeof onProgress === 'function') {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { reject(new Error('invalid_response')); }
        } else {
          let detail = xhr.responseText;
          try { detail = JSON.parse(xhr.responseText)?.error || detail; } catch {}
          reject(new Error(`drive_upload_http_${xhr.status}: ${detail}`));
        }
      };
      xhr.onerror = () => reject(new Error('network_error'));
      xhr.send(form);
    } catch (err) {
      reject(err);
    }
  });
};

// ── GOOGLE DRIVE DELETE (Documents modülü) ──
// fileId veya file_url (Drive view link) kabul eder. Edge function parse eder.
// Başarıda { ok: true, fileId, status } döner.
export const deleteDocumentFromDrive = async (fileIdOrUrl) => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('not_authenticated');
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('missing_supabase_config');

  const isUrl = typeof fileIdOrUrl === 'string' && /^https?:\/\//.test(fileIdOrUrl);
  const body = isUrl ? { fileUrl: fileIdOrUrl } : { fileId: fileIdOrUrl };

  const resp = await fetch(`${supabaseUrl}/functions/v1/drive-delete`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  if (!resp.ok) {
    let detail = text;
    try { detail = JSON.parse(text)?.error || detail; } catch {}
    throw new Error(`drive_delete_http_${resp.status}: ${detail}`);
  }
  try { return JSON.parse(text); } catch { return { ok: true }; }
};

// ── FEEDBACK MODÜLÜ ─────────────────────────────────────────────
// Kullanıcıların site genelinden ticket açtığı modül. Direktör yönetir.

export const createFeedbackTicket = async (ticket) => {
  return await supabase.from('feedback_tickets').insert([ticket]).select();
};

export const getFeedbackTickets = async (filters = {}) => {
  let q = supabase.from('feedback_tickets').select('*').order('created_at', { ascending: false });
  if (filters.status)     q = q.eq('status', filters.status);
  if (filters.type)       q = q.eq('type', filters.type);
  if (filters.reporterId) q = q.eq('reporter_id', filters.reporterId);
  return await q;
};

export const getFeedbackTicket = async (id) => {
  return await supabase.from('feedback_tickets').select('*').eq('id', id).single();
};

export const updateFeedbackTicket = async (id, updates) => {
  return await supabase.from('feedback_tickets').update(updates).eq('id', id).select();
};

export const deleteFeedbackTicket = async (id) => {
  return await supabase.from('feedback_tickets').delete().eq('id', id);
};

export const getFeedbackComments = async (ticketId) => {
  return await supabase
    .from('feedback_comments')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
};

export const addFeedbackComment = async (comment) => {
  return await supabase.from('feedback_comments').insert([comment]).select();
};

// Screenshot upload: dataURL veya Blob kabul eder. URL döner.
export const uploadFeedbackScreenshot = async (dataUrlOrBlob, userId) => {
  let blob;
  if (typeof dataUrlOrBlob === 'string' && dataUrlOrBlob.startsWith('data:')) {
    const resp = await fetch(dataUrlOrBlob);
    blob = await resp.blob();
  } else if (dataUrlOrBlob instanceof Blob) {
    blob = dataUrlOrBlob;
  } else {
    throw new Error('invalid_screenshot_input');
  }
  const ext = blob.type === 'image/jpeg' ? 'jpg' : 'png';
  const path = `${userId || 'anon'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('feedback-screenshots').upload(path, blob, {
    contentType: blob.type,
    upsert: false,
  });
  if (error) throw error;
  const { data: pub } = supabase.storage.from('feedback-screenshots').getPublicUrl(path);
  return pub?.publicUrl || null;
};
