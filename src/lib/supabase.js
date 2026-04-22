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

// ── DOSYA GÜVENLİK DOĞRULAMASI (istemci tarafı) ──
// Edge function / RLS'e ek olarak kullanıcıyı erken uyarmak için kullanılır.
// Güvenliği tek başına garanti etmez — sunucu her zaman kendi kontrolünü yapar.
export const BLOCKED_FILE_EXTENSIONS = [
  'exe','bat','cmd','com','msi','ps1','vbs','vbe','js','jse','wsf','wsh','scr',
  'sh','bash','zsh','jar','apk','ipa','dmg','app','lnk','reg','pif','hta','cpl',
  'deb','rpm','msp',
];

export const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

const IMAGE_MIME_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'
];

/**
 * Validate a file before upload. Returns { ok: true } or { ok: false, error }.
 * Accepts options { maxBytes, kind: 'document'|'image'|'avatar' }.
 */
export function validateUploadFile(file, { maxBytes = MAX_DOCUMENT_BYTES, kind = 'document' } = {}) {
  if (!file || typeof file !== 'object') {
    return { ok: false, error: 'Geçersiz dosya.' };
  }
  if (typeof file.size !== 'number' || file.size <= 0) {
    return { ok: false, error: 'Dosya boş veya okunamadı.' };
  }
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return { ok: false, error: `Dosya çok büyük. En fazla ${mb} MB olabilir.` };
  }
  const name = (file.name || '').toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() : '';
  if (ext && BLOCKED_FILE_EXTENSIONS.includes(ext)) {
    return { ok: false, error: `Güvenlik nedeniyle .${ext} uzantılı dosyalar yüklenemez.` };
  }
  if (kind === 'image' || kind === 'avatar') {
    const mime = (file.type || '').toLowerCase();
    if (!mime.startsWith('image/') || (mime && !IMAGE_MIME_TYPES.includes(mime))) {
      return { ok: false, error: 'Sadece JPG, PNG, WebP, GIF veya HEIC görseller yüklenebilir.' };
    }
  }
  return { ok: true };
}

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

// ── COLLABORATIONS MODÜLÜ (İşbirlikleri) ─────────────────────────────
// Tüm birimlerin etkinlik/fon/proje/araştırma vb. işbirliklerini
// ortak bir yerde takip eder. Herkes görür; sahip + koordinatör +
// direktör düzenler.

export const COLLAB_TYPES = [
  { id: 'etkinlik',     label: 'Etkinlik',     icon: '📅', color: '#2563eb' },
  { id: 'fon',          label: 'Fon / Hibe',   icon: '💰', color: '#eab308' },
  { id: 'proje',        label: 'Proje',        icon: '🚀', color: '#16a34a' },
  { id: 'arastirma',    label: 'Araştırma',    icon: '🔬', color: '#9333ea' },
  { id: 'egitim',       label: 'Eğitim',       icon: '🎓', color: '#0891b2' },
  { id: 'savunuculuk',  label: 'Savunuculuk',  icon: '📣', color: '#dc2626' },
  { id: 'yayin',        label: 'Yayın',        icon: '📄', color: '#475569' },
  { id: 'uyelik',       label: 'Üyelik',       icon: '🪪', color: '#db2777' },
  { id: 'akreditasyon', label: 'Akreditasyon', icon: '🏅', color: '#ca8a04' },
  { id: 'koordinasyon', label: 'Koordinasyon', icon: '🧭', color: '#0d9488' },
  { id: 'diger',        label: 'Diğer',        icon: '🔗', color: '#6b7280' },
];

export const COLLAB_STATUSES = [
  { id: 'planlaniyor', label: 'Planlanıyor', color: '#6366f1' },
  { id: 'aktif',       label: 'Aktif',       color: '#16a34a' },
  { id: 'beklemede',   label: 'Beklemede',   color: '#eab308' },
  { id: 'tamamlandi',  label: 'Tamamlandı',  color: '#475569' },
  { id: 'iptal',       label: 'İptal',       color: '#dc2626' },
];

// Partner rolü (typolojisi) — donor reporting ve audit için standart
export const COLLAB_PARTNER_ROLES = [
  { id: 'lead',            label: 'Lider Partner',       color: '#2563eb' },
  { id: 'co_applicant',    label: 'Ortak Başvuran',      color: '#7c3aed' },
  { id: 'implementing',    label: 'Uygulayıcı',          color: '#16a34a' },
  { id: 'sub_grantee',     label: 'Alt-Hibe Alan',       color: '#0891b2' },
  { id: 'donor',           label: 'Donör',               color: '#eab308' },
  { id: 'fiscal_sponsor',  label: 'Mali Sponsor',        color: '#db2777' },
  { id: 'advisory',        label: 'Danışma',             color: '#475569' },
  { id: 'observer',        label: 'Gözlemci',            color: '#94a3b8' },
];

// MoU / sözleşme durumları
export const COLLAB_MOU_STATUSES = [
  { id: 'not_required', label: 'Gerekli Değil', color: '#94a3b8' },
  { id: 'draft',        label: 'Taslak',        color: '#eab308' },
  { id: 'signed',       label: 'İmzalandı',     color: '#16a34a' },
  { id: 'renewed',      label: 'Yenilendi',     color: '#0891b2' },
  { id: 'expired',      label: 'Süresi Doldu',  color: '#dc2626' },
  { id: 'terminated',   label: 'Feshedildi',    color: '#475569' },
];

// Rapor türleri
export const COLLAB_REPORT_TYPES = [
  { id: 'narrative',  label: 'Narrative' },
  { id: 'financial',  label: 'Finansal'  },
  { id: 'interim',    label: 'Ara Rapor' },
  { id: 'final',      label: 'Final Rapor' },
  { id: 'monitoring', label: 'M&E'       },
  { id: 'ad_hoc',     label: 'Ad Hoc'    },
];

export const COLLAB_REPORT_STATUSES = [
  { id: 'pending',     label: 'Bekliyor',      color: '#94a3b8' },
  { id: 'in_progress', label: 'Hazırlanıyor',  color: '#eab308' },
  { id: 'submitted',   label: 'Gönderildi',    color: '#0891b2' },
  { id: 'approved',    label: 'Onaylandı',     color: '#16a34a' },
  { id: 'overdue',     label: 'Geçikti',       color: '#dc2626' },
];

export const DEFAULT_COLLAB_PAGE_LIMIT = 100;

/**
 * İşbirliklerini getirir. Gelişmiş filtreler: tarih aralığı, partner rolü,
 * MoU durumu, FTS araması, pagination.
 */
export const getCollaborations = async (filters = {}) => {
  const { limit = DEFAULT_COLLAB_PAGE_LIMIT, offset = 0 } = filters;
  let q = supabase.from('collaborations').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (filters.type)         q = q.eq('type', filters.type);
  if (filters.unit)         q = q.eq('unit', filters.unit);
  if (filters.status)       q = q.eq('status', filters.status);
  if (filters.ownerId)      q = q.eq('owner_id', filters.ownerId);
  if (filters.partnerOrgId) q = q.eq('partner_org_id', filters.partnerOrgId);
  if (filters.partnerRole)  q = q.eq('partner_role', filters.partnerRole);
  if (filters.mouStatus)    q = q.eq('mou_status', filters.mouStatus);
  if (filters.relatedFundId)  q = q.eq('related_fund_id', filters.relatedFundId);
  if (filters.relatedEventId) q = q.eq('related_event_id', filters.relatedEventId);
  // Tarih aralığı (overlap mantığı): işbirliğinin [start..end] aralığı filtre penceresiyle kesişsin
  if (filters.dateFrom) q = q.or(`end_date.gte.${filters.dateFrom},end_date.is.null`);
  if (filters.dateTo)   q = q.or(`start_date.lte.${filters.dateTo},start_date.is.null`);
  if (filters.mouExpiringBefore) q = q.lte('mou_expires_at', filters.mouExpiringBefore);
  if (filters.q) {
    const s = `%${filters.q}%`;
    q = q.or(`title.ilike.${s},description.ilike.${s},partner_name.ilike.${s},location.ilike.${s}`);
  }
  if (typeof limit === 'number' && limit > 0) q = q.range(offset, offset + limit - 1);
  const { data, error, count } = await q;
  return { data: data || [], error, count: count ?? null };
};

/** Postgres FTS araması (tsvector/GIN) — büyük veri setinde hızlı. */
export const searchCollaborationsFTS = async (text, { limit = 50 } = {}) => {
  if (!text || text.trim().length < 2) return { data: [], error: null };
  const tsQuery = text.trim().split(/\s+/).map(t => t.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean).join(' & ');
  if (!tsQuery) return { data: [], error: null };
  const { data, error } = await supabase
    .from('collaborations')
    .select('*')
    .textSearch('search_tsv', tsQuery, { config: 'simple' })
    .limit(limit);
  return { data: data || [], error };
};

/** Dashboard widget ve reporting için özet istatistikler. */
export const getCollabStats = async () => {
  const { data, error } = await supabase
    .from('collaborations')
    .select('id, status, type, unit, budget_amount, budget_currency, end_date, mou_expires_at, partner_role, created_at');
  if (error) return { stats: null, recent: [], upcoming: [], error };

  const now = new Date();
  const in30 = new Date(Date.now() + 30 * 86400000);
  const in90 = new Date(Date.now() + 90 * 86400000);
  const stats = {
    total:      data.length,
    active:     data.filter(c => c.status === 'aktif').length,
    planning:   data.filter(c => c.status === 'planlaniyor').length,
    completed:  data.filter(c => c.status === 'tamamlandi').length,
    thisMonth:  data.filter(c => new Date(c.created_at) >= new Date(now.getFullYear(), now.getMonth(), 1)).length,
    budgetByCcy: {},
    byUnit: {},
    byType: {},
    mouExpiringSoon: data.filter(c => c.mou_expires_at && new Date(c.mou_expires_at) >= now && new Date(c.mou_expires_at) <= in90).length,
    dueSoon:   data.filter(c => c.end_date && new Date(c.end_date) >= now && new Date(c.end_date) <= in30 && c.status === 'aktif').length,
  };
  for (const c of data) {
    if (c.budget_amount) {
      const ccy = c.budget_currency || 'TRY';
      stats.budgetByCcy[ccy] = (stats.budgetByCcy[ccy] || 0) + Number(c.budget_amount);
    }
    if (c.unit) stats.byUnit[c.unit] = (stats.byUnit[c.unit] || 0) + 1;
    if (c.type) stats.byType[c.type] = (stats.byType[c.type] || 0) + 1;
  }

  const recent   = [...data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
  const upcoming = data.filter(c => c.end_date && new Date(c.end_date) >= now && c.status === 'aktif')
    .sort((a, b) => new Date(a.end_date) - new Date(b.end_date)).slice(0, 5);

  return { stats, recent, upcoming, error: null };
};

/** Dashboard için işbirliği KPI + son 5 kayıt. */
export const getCollabDashboardData = getCollabStats;

export const getCollaboration = async (id) => {
  return await supabase.from('collaborations').select('*').eq('id', id).single();
};

export const createCollaboration = async (payload) => {
  return await supabase.from('collaborations').insert([payload]).select().single();
};

export const updateCollaboration = async (id, updates) => {
  return await supabase.from('collaborations').update(updates).eq('id', id).select().single();
};

export const deleteCollaboration = async (id) => {
  return await supabase.from('collaborations').delete().eq('id', id);
};

/** Çoklu güncelleme: bir liste kaydın ortak alanlarını güncelle (bulk action). */
export const bulkUpdateCollaborations = async (ids, patch) => {
  if (!Array.isArray(ids) || ids.length === 0) return { data: [], error: null };
  return await supabase.from('collaborations').update(patch).in('id', ids).select();
};

/** Çoklu silme. */
export const bulkDeleteCollaborations = async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return { error: null };
  return await supabase.from('collaborations').delete().in('id', ids);
};

// ── YORUMLAR ───────────────────────────────────────────────────────────
export const getCollaborationComments = async (collabId) => {
  const { data, error } = await supabase
    .from('collaboration_comments')
    .select('*')
    .eq('collaboration_id', collabId)
    .order('created_at', { ascending: true });
  return { data: data || [], error };
};

export const addCollaborationComment = async ({ collabId, body, mentions = [] }) => {
  const { data: authData } = await supabase.auth.getUser();
  const uid = authData?.user?.id;
  let authorName = null;
  if (uid) {
    const { data: prof } = await supabase.from('user_profiles').select('full_name').eq('user_id', uid).maybeSingle();
    authorName = prof?.full_name || authData?.user?.email || null;
  }
  const { data, error } = await supabase
    .from('collaboration_comments')
    .insert([{ collaboration_id: collabId, body, mentions, author_id: uid, author_name: authorName }])
    .select()
    .single();
  // @mention'lara bildirim gönder
  if (!error && data && Array.isArray(mentions) && mentions.length > 0) {
    try {
      const rows = mentions.filter(Boolean).filter(id => id !== uid).map(userId => ({
        user_id: userId,
        type: 'collaboration_mention',
        title: `${authorName || 'Biri'} sizden bahsetti`,
        body: (body || '').slice(0, 200),
        link_type: 'collaboration',
        link_id: collabId,
        created_by: uid,
        created_by_name: authorName,
      }));
      if (rows.length > 0) await supabase.from('notifications').insert(rows);
    } catch (_e) { /* notifications tablosu opsiyonel */ }
  }
  return { data, error };
};

export const updateCollaborationComment = async (id, body) => {
  return await supabase.from('collaboration_comments').update({ body, updated_at: new Date().toISOString() }).eq('id', id).select().single();
};

export const deleteCollaborationComment = async (id) => {
  return await supabase.from('collaboration_comments').delete().eq('id', id);
};

// ── DEĞİŞİKLİK GEÇMİŞİ (audit log) ─────────────────────────────────────
export const getCollaborationHistory = async (collabId, limit = 50) => {
  const { data, error } = await supabase
    .from('collaboration_history')
    .select('*')
    .eq('collaboration_id', collabId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return { data: data || [], error };
};

// ── RAPORLAMA YÜKÜMLÜLÜKLERİ ───────────────────────────────────────────
export const getCollaborationReports = async (collabId = null, { limit = 200 } = {}) => {
  let q = supabase.from('collaboration_reports').select('*').order('due_date', { ascending: true });
  if (collabId) q = q.eq('collaboration_id', collabId);
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  return { data: data || [], error };
};

export const getMyCollaborationReports = async (userId) => {
  if (!userId) return { data: [], error: null };
  const { data, error } = await supabase
    .from('collaboration_reports')
    .select('*')
    .or(`responsible_user_id.eq.${userId}`)
    .in('status', ['pending', 'in_progress'])
    .order('due_date', { ascending: true });
  return { data: data || [], error };
};

export const getUpcomingReports = async (days = 30) => {
  const cutoff = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('collaboration_reports')
    .select('*, collaborations(id, title, partner_name, unit)')
    .lte('due_date', cutoff)
    .in('status', ['pending', 'in_progress'])
    .order('due_date', { ascending: true });
  return { data: data || [], error };
};

export const createCollaborationReport = async (payload) => {
  return await supabase.from('collaboration_reports').insert([payload]).select().single();
};

export const updateCollaborationReport = async (id, updates) => {
  return await supabase.from('collaboration_reports').update(updates).eq('id', id).select().single();
};

export const deleteCollaborationReport = async (id) => {
  return await supabase.from('collaboration_reports').delete().eq('id', id);
};

// ── İşbirliği Tamamlanma Raporu (Completion Report) ───────────────────────
// Not: Burada "completion report", bir işbirliği "tamamlandi" statüsüne
// geçtiğinde personelin doldurduğu yapılandırılmış sonuç formudur.
// Yukarıdaki collaboration_reports (zamanlanmış donör raporları) tablosundan
// farklıdır; ayrı tablo (collaboration_completion_reports) kullanır.

export const getCollabCompletionReport = async (collaborationId) => {
  if (!collaborationId) return { data: null, error: null };
  const { data, error } = await supabase
    .from('collaboration_completion_reports')
    .select('*')
    .eq('collaboration_id', collaborationId)
    .maybeSingle();
  return { data, error };
};

export const upsertCollabCompletionReport = async (payload) => {
  // payload.collaboration_id zorunlu. Varsa update, yoksa insert.
  const { data: existing } = await supabase
    .from('collaboration_completion_reports')
    .select('id')
    .eq('collaboration_id', payload.collaboration_id)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from('collaboration_completion_reports')
      .update({
        ...payload,
        // id ve collaboration_id değişmemeli; submitted_by/_at sadece ilk eklemede
      })
      .eq('id', existing.id)
      .select()
      .single();
    return { data, error };
  }

  const { data, error } = await supabase
    .from('collaboration_completion_reports')
    .insert([payload])
    .select()
    .single();
  return { data, error };
};

export const reviewCollabCompletionReport = async (reportId, { reviewed_by, reviewed_by_name, coordinator_note }) => {
  const { data, error } = await supabase
    .from('collaboration_completion_reports')
    .update({
      reviewed_by,
      reviewed_by_name,
      reviewed_at: new Date().toISOString(),
      coordinator_note: coordinator_note || null,
    })
    .eq('id', reportId)
    .select()
    .single();
  return { data, error };
};

// ── İşbirliği için lookup listeleri (modal picker'ları doldurmak için) ────
export const getCollabLookups = async () => {
  const [orgs, users, funds, events] = await Promise.all([
    supabase.from('network_organizations')
      .select('id, name, org_type, website, email, logo_url, unit')
      .order('name', { ascending: true }),
    supabase.from('user_profiles')
      .select('user_id, full_name, role, unit, email, avatar_url')
      .order('full_name', { ascending: true }),
    supabase.from('fund_opportunities')
      .select('id, title, donor_organization, deadline, status, currency, amount_min, amount_max')
      .order('deadline', { ascending: true, nullsFirst: false }),
    supabase.from('events')
      .select('id, title, event_type, start_date, end_date, status, location_name')
      .order('start_date', { ascending: false }),
  ]);
  return {
    organizations:     orgs.data  || [],
    users:             users.data || [],
    fundOpportunities: funds.data || [],
    events:            events.data || [],
    error: orgs.error || users.error || funds.error || events.error || null,
  };
};

// ── İŞBİRLİĞİ GÖRSEL YÜKLEME (< 3MB otomatik küçültme) ─────────────────────
// Tarayıcıda canvas ile ölçeklendirir; 3MB altına inene kadar boyut/kalite düşürür.
export const MAX_COLLAB_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB
const COLLAB_IMAGE_BUCKET = 'collaboration-images';

/**
 * Görseli 3MB altına sıkıştırır. JPEG'e çevirir (transparanlık kaybolur).
 * GIF/animasyonlar için sıkıştırma yapılmaz; > 3MB ise reddeder.
 */
async function resizeImageUnder3MB(file) {
  // Animasyonlu/özel formatlar: canvas'a çizemeyiz, olduğu gibi geri döner.
  if (file.type === 'image/gif') {
    if (file.size <= MAX_COLLAB_IMAGE_BYTES) return file;
    throw new Error('GIF dosyası 3MB\'tan büyük; lütfen daha küçük bir dosya seçin.');
  }

  // Küçük dosya: dokunma
  if (file.size <= MAX_COLLAB_IMAGE_BYTES) return file;

  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  let quality  = 0.88;
  let maxSide  = Math.max(width, height);

  // En fazla 8 iterasyon
  for (let i = 0; i < 8; i++) {
    // Max tarafı 2400'e indirilerek başlar, sonraki turlarda %85
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const w = Math.round(width  * scale);
    const h = Math.round(height * scale);
    const canvas = (typeof OffscreenCanvas !== 'undefined')
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement('canvas'), { width: w, height: h });
    if ('width' in canvas) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = canvas.convertToBlob
      ? await canvas.convertToBlob({ type: 'image/jpeg', quality })
      : await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));

    if (blob && blob.size <= MAX_COLLAB_IMAGE_BYTES) {
      return new File([blob], (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    }
    // Küçültmeye devam
    if (maxSide > 1200)      maxSide = Math.round(maxSide * 0.85);
    else if (quality > 0.5)  quality = Math.max(0.5, quality - 0.1);
    else                     maxSide = Math.round(maxSide * 0.8);
  }
  throw new Error('Görsel yeterince küçültülemedi. Lütfen farklı bir dosya deneyin.');
}

/** Sıkıştırır ve Supabase Storage'a yükler; public URL döndürür. */
export const uploadCollabImage = async (file, userId) => {
  if (!file)   throw new Error('Dosya yok');
  if (!file.type?.startsWith('image/')) throw new Error('Sadece görsel dosyalar kabul edilir.');

  const compressed = await resizeImageUnder3MB(file);
  const ext  = (compressed.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${userId || 'anon'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from(COLLAB_IMAGE_BUCKET)
    .upload(path, compressed, { cacheControl: '3600', upsert: false, contentType: compressed.type });
  if (error) throw error;

  const { data } = supabase.storage.from(COLLAB_IMAGE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path, size: compressed.size };
};

/** Storage'dan görseli siler. URL veya path alabilir. */
export const deleteCollabImage = async (urlOrPath) => {
  if (!urlOrPath) return { error: null };
  let path = urlOrPath;
  const marker = `/${COLLAB_IMAGE_BUCKET}/`;
  const idx = urlOrPath.indexOf(marker);
  if (idx >= 0) path = urlOrPath.slice(idx + marker.length);
  return await supabase.storage.from(COLLAB_IMAGE_BUCKET).remove([path]);
};

// ═════════════════════════════════════════════════════════════════════════════
// MEETINGS — Google Meet + Calendar entegreli toplantı modülü
// ═════════════════════════════════════════════════════════════════════════════

export const MEETING_STATUSES = [
  { id: 'planlandi',    label: 'Planlandı',    color: '#0ea5e9' },
  { id: 'devam_ediyor', label: 'Devam ediyor', color: '#22c55e' },
  { id: 'tamamlandi',   label: 'Tamamlandı',   color: '#64748b' },
  { id: 'iptal',        label: 'İptal',        color: '#ef4444' },
  { id: 'ertelendi',    label: 'Ertelendi',    color: '#f59e0b' },
];

export const MEETING_DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

/**
 * Liste getir — filtreli ve ilgili attendees ile.
 * Opsiyonlar: { upcoming: bool, past: bool, unit, collaborationId, userId, from, to, limit=100 }
 */
export const getMeetings = async (opts = {}) => {
  const {
    upcoming = false, past = false,
    unit = null, collaborationId = null,
    from = null, to = null,
    limit = 100,
  } = opts;

  let q = supabase
    .from('meetings')
    .select('*, attendees:meeting_attendees(*), collab:collaborations(id,title)')
    .order('starts_at', { ascending: upcoming });

  const nowIso = new Date().toISOString();
  if (upcoming) q = q.gte('starts_at', nowIso);
  if (past)     q = q.lt('starts_at', nowIso);
  if (unit)     q = q.eq('unit', unit);
  if (collaborationId) q = q.eq('related_collaboration_id', collaborationId);
  if (from)     q = q.gte('starts_at', from);
  if (to)       q = q.lte('starts_at', to);
  if (limit)    q = q.limit(limit);

  const { data, error } = await q;
  return { data: data || [], error };
};

export const getMeeting = async (id) => {
  const { data, error } = await supabase
    .from('meetings')
    .select('*, attendees:meeting_attendees(*), collab:collaborations(id,title,unit)')
    .eq('id', id).single();
  return { data, error };
};

/**
 * Yeni toplantı oluştur + katılımcıları ekle + Calendar event'i tetikle.
 * attendees: [{ user_id?, name?, email, is_optional? }]
 */
export const createMeeting = async (payload, attendees = []) => {
  const { data: sessionRes } = await supabase.auth.getSession();
  const uid = sessionRes?.session?.user?.id || null;
  const userEmail = sessionRes?.session?.user?.email || null;

  // 1) Satırı kaydet
  const row = {
    ...payload,
    created_by: uid,
    organizer_id: payload.organizer_id || uid,
    calendar_organizer_email: payload.calendar_organizer_email || userEmail,
  };
  const { data: m, error } = await supabase
    .from('meetings').insert(row).select().single();
  if (error) return { data: null, error };

  // 2) Katılımcıları kaydet
  if (attendees.length > 0) {
    const rows = attendees.map(a => ({
      meeting_id: m.id,
      user_id: a.user_id || null,
      name: a.name || null,
      email: a.email || null,
      is_optional: !!a.is_optional,
      is_organizer: !!a.is_organizer,
      rsvp_status: a.rsvp_status || 'pending',
    }));
    await supabase.from('meeting_attendees').insert(rows);
  }

  // 2b) Bildirim: user_id'si olan katılımcılara "yeni toplantı" bildirimi
  try {
    const notifyTo = attendees
      .filter(a => a.user_id && a.user_id !== uid)
      .map(a => a.user_id);
    const uniq = Array.from(new Set(notifyTo));
    if (uniq.length > 0) {
      const timeStr = new Date(m.starts_at).toLocaleString('tr-TR', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: m.timezone || 'Europe/Istanbul',
      });
      await createNotifications(uniq.map(userId => ({
        userId,
        type: 'meeting_invite',
        title: `📅 Yeni toplantı: ${m.title || 'Başlıksız'}`,
        body: `${timeStr} • ${m.duration_minutes || 30} dk${m.location ? ' • ' + m.location : ''}`,
        linkType: 'meeting',
        linkId: m.id,
        createdBy: uid,
        createdByName: row.organizer_name || null,
      })));
    }
  } catch (e) { console.warn('[createMeeting] notify skipped:', e); }

  // 3) Calendar + Meet event — edge function
  const attendeeEmails = attendees.filter(a => a.email).map(a => a.email);
  const cleanupOnFail = async (reasonMsg) => {
    // Başarısız olursa orphan satır kalmasın — sessizce sil
    await supabase.from('meeting_attendees').delete().eq('meeting_id', m.id);
    await supabase.from('meetings').delete().eq('id', m.id);
    return { data: null, error: { message: reasonMsg } };
  };
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/create-meet-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionRes?.session?.access_token || ''}`,
      },
      body: JSON.stringify({
        meeting_id: m.id,
        organizer_email: row.calendar_organizer_email,
        title: m.title,
        description: m.description || '',
        starts_at: m.starts_at,
        duration_minutes: m.duration_minutes,
        timezone: m.timezone || 'Europe/Istanbul',
        location: m.location || '',
        attendee_emails: attendeeEmails,
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (res.ok && out.meet_url) {
      // Upsert — fonksiyon zaten yazmış olabilir, UI için güncel halini çek
      const { data: refreshed } = await supabase
        .from('meetings')
        .select('*, attendees:meeting_attendees(*)')
        .eq('id', m.id).single();
      return { data: refreshed || m, error: null, meet_url: out.meet_url };
    }

    // Edge function hata döndürdü — detayı kullanıcıya göster, satırı sil
    const errCode = out.error || `HTTP ${res.status}`;
    const detail = out.detail ? ` — ${typeof out.detail === 'string' ? out.detail.slice(0, 300) : JSON.stringify(out.detail).slice(0, 300)}` : '';
    let friendly = `Meet linki oluşturulamadı (${errCode})${detail}`;
    if (errCode === 'google_auth_failed' || /unauthorized_client/i.test(detail)) {
      friendly = `Google Calendar izni başarısız. "${row.calendar_organizer_email}" adresi Google Workspace kullanıcısı olmalı — kişisel Gmail hesaplarıyla çalışmaz.`;
    }
    console.error('[createMeeting] edge function failed:', { status: res.status, out });
    return cleanupOnFail(friendly);
  } catch (e) {
    console.error('[createMeeting] network/fetch error:', e);
    return cleanupOnFail('Meet edge function erişilemedi: ' + (e.message || e));
  }
};

/** Toplantı güncelle + (opsiyonel) Calendar event'i güncelle. */
export const updateMeeting = async (id, patch, opts = { updateCalendar: true }) => {
  // Önce eski halini oku (değişen alanları tespit etmek için)
  const { data: before } = await supabase
    .from('meetings').select('*').eq('id', id).single();

  const { data, error } = await supabase
    .from('meetings').update(patch).eq('id', id).select().single();
  if (error) return { data: null, error };

  if (opts.updateCalendar && data.calendar_event_id) {
    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      await fetch(`${supabaseUrl}/functions/v1/update-meet-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionRes?.session?.access_token || ''}`,
        },
        body: JSON.stringify({
          meeting_id: id,
          organizer_email: data.calendar_organizer_email,
          event_id: data.calendar_event_id,
          title: data.title,
          description: data.description || '',
          starts_at: data.starts_at,
          duration_minutes: data.duration_minutes,
          timezone: data.timezone || 'Europe/Istanbul',
          location: data.location || '',
          status: data.status,
        }),
      });
    } catch (_) { /* sessiz fail — DB güncel */ }
  }

  // Bildirim: status iptal'e döndüyse ya da saat önemli ölçüde değiştiyse
  try {
    const { data: sessionRes } = await supabase.auth.getSession();
    const uid = sessionRes?.session?.user?.id || null;
    const startsChanged = before && before.starts_at !== data.starts_at;
    const statusCancelled = (patch?.status === 'iptal') && (before?.status !== 'iptal');

    if (statusCancelled || startsChanged) {
      const { data: atts } = await supabase
        .from('meeting_attendees')
        .select('user_id')
        .eq('meeting_id', id)
        .not('user_id', 'is', null);
      const notifyTo = Array.from(new Set(
        (atts || []).map(a => a.user_id).filter(u => u && u !== uid)
      ));
      if (notifyTo.length > 0) {
        const timeStr = new Date(data.starts_at).toLocaleString('tr-TR', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: data.timezone || 'Europe/Istanbul',
        });
        const title = statusCancelled
          ? `❌ Toplantı iptal: ${data.title || 'Başlıksız'}`
          : `🕒 Toplantı saati değişti: ${data.title || 'Başlıksız'}`;
        const body = statusCancelled
          ? `"${data.title || 'Başlıksız'}" toplantısı iptal edildi.`
          : `Yeni zaman: ${timeStr} • ${data.duration_minutes || 30} dk`;
        await createNotifications(notifyTo.map(userId => ({
          userId,
          type: statusCancelled ? 'meeting_cancelled' : 'meeting_rescheduled',
          title,
          body,
          linkType: 'meeting',
          linkId: id,
          createdBy: uid,
          createdByName: data.organizer_name || null,
        })));
      }
    }
  } catch (e) { console.warn('[updateMeeting] notify skipped:', e); }

  return { data, error: null };
};

/** Toplantı sil + Calendar event'i sil. */
export const deleteMeeting = async (id) => {
  const { data: m } = await supabase
    .from('meetings').select('id, title, calendar_event_id, calendar_organizer_email, organizer_name').eq('id', id).single();

  // Silmeden önce bildirim gönder (katılımcılara haber ver)
  try {
    const { data: sessionRes } = await supabase.auth.getSession();
    const uid = sessionRes?.session?.user?.id || null;
    const { data: atts } = await supabase
      .from('meeting_attendees')
      .select('user_id')
      .eq('meeting_id', id)
      .not('user_id', 'is', null);
    const notifyTo = Array.from(new Set(
      (atts || []).map(a => a.user_id).filter(u => u && u !== uid)
    ));
    if (notifyTo.length > 0) {
      await createNotifications(notifyTo.map(userId => ({
        userId,
        type: 'meeting_deleted',
        title: `🗑 Toplantı silindi: ${m?.title || 'Başlıksız'}`,
        body: `"${m?.title || 'Başlıksız'}" toplantısı iptal edilip silindi.`,
        linkType: 'meeting',
        linkId: id,
        createdBy: uid,
        createdByName: m?.organizer_name || null,
      })));
    }
  } catch (e) { console.warn('[deleteMeeting] notify skipped:', e); }

  if (m?.calendar_event_id) {
    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      await fetch(`${supabaseUrl}/functions/v1/delete-meet-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionRes?.session?.access_token || ''}`,
        },
        body: JSON.stringify({
          organizer_email: m.calendar_organizer_email,
          event_id: m.calendar_event_id,
        }),
      });
    } catch (_) { /* ignore */ }
  }

  const { error } = await supabase.from('meetings').delete().eq('id', id);
  return { error };
};

/** Katılımcı RSVP güncelle (UI üzerinden manuel override). */
export const updateMeetingAttendeeRsvp = async (attendeeId, rsvpStatus) => {
  const { error } = await supabase
    .from('meeting_attendees').update({ rsvp_status: rsvpStatus }).eq('id', attendeeId);
  return { error };
};

/** Katılımcı ekle/sil (mevcut toplantıya). */
export const addMeetingAttendee = async (meetingId, attendee) => {
  const { error } = await supabase.from('meeting_attendees').insert({
    meeting_id: meetingId,
    user_id: attendee.user_id || null,
    name:    attendee.name || null,
    email:   attendee.email || null,
    is_optional: !!attendee.is_optional,
  });
  if (error) return { error };

  // Yeni eklenen (user_id'si olan) katılımcıya bildirim
  try {
    if (attendee.user_id) {
      const { data: sessionRes } = await supabase.auth.getSession();
      const uid = sessionRes?.session?.user?.id || null;
      if (attendee.user_id !== uid) {
        const { data: m } = await supabase
          .from('meetings')
          .select('title, starts_at, duration_minutes, location, timezone, organizer_name')
          .eq('id', meetingId).single();
        if (m) {
          const timeStr = new Date(m.starts_at).toLocaleString('tr-TR', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: m.timezone || 'Europe/Istanbul',
          });
          await createNotification({
            userId: attendee.user_id,
            type: 'meeting_invite',
            title: `📅 Toplantıya davet: ${m.title || 'Başlıksız'}`,
            body: `${timeStr} • ${m.duration_minutes || 30} dk${m.location ? ' • ' + m.location : ''}`,
            linkType: 'meeting',
            linkId: meetingId,
            createdBy: uid,
            createdByName: m.organizer_name || null,
          });
        }
      }
    }
  } catch (e) { console.warn('[addMeetingAttendee] notify skipped:', e); }

  return { error };
};

export const removeMeetingAttendee = async (attendeeId) => {
  const { error } = await supabase.from('meeting_attendees').delete().eq('id', attendeeId);
  return { error };
};
