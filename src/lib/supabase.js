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
  return { data, error };
};

export const updateMeetingAction = async (id, updates) => {
  const { data, error } = await supabase
    .from('meeting_actions').update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select();
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
  return { data, error };
};

export const deleteDonor = async (id) => {
  const { error } = await supabase.from('donors').delete().eq('id', id);
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
  return { data, error };
};

// Direktör/koordinatör: personel & koordinatör loglarını görür — direktör kendi logunu gizler
export const getAllDailyLogs = async (fromDate, toDate) => {
  const { data, error } = await supabase
    .from('daily_logs')
    .select('*, user_profiles!inner(full_name, role, unit)')
    .gte('log_date', fromDate)
    .lte('log_date', toDate)
    .not('user_profiles.role', 'in', '("direktor","direktor_yardimcisi","asistan")')
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
  return { data, error };
};

export const updateAgendaItem = async (id, updates) => {
  const { data, error } = await supabase
    .from('agendas')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();
  return { data, error };
};

export const deleteAgendaItem = async (id) => {
  const { error } = await supabase
    .from('agendas')
    .delete()
    .eq('id', id);
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

// Açık görevleri getir: assigned_to = userId  VEYA  (created_by = userId ve assigned_to = null → "Kendime" görevler)
export const getMyOpenTasks = async (userId) => {
  const { data, error } = await supabase
    .from('agendas')
    .select('id, title, priority, due_date, unit')
    .or(`assigned_to.eq.${userId},and(created_by.eq.${userId},assigned_to.is.null)`)
    .neq('status', 'tamamlandi')
    .order('due_date', { ascending: true });
  return { data, error };
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
  // assigned_to=userId olan gündemler birim filtresini bypass eder (direktörden atama)
  if (unit && userId) {
    query = query.or(`unit.eq.${unit},assigned_to.eq.${userId}`);
  } else if (unit) {
    query = query.eq('unit', unit);
  }
  const { data, error } = await query;
  return { data, error };
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
  return { data, error };
};

// Gündem güncelle
export const updateAgenda = async (id, updates) => {
  const { data, error } = await supabase
    .from('agendas')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();
  return { data, error };
};

// Gündem sil
export const deleteAgenda = async (id) => {
  const { error } = await supabase.from('agendas').delete().eq('id', id);
  return { error };
};

// ── GÜNDEM GÖREVLERİ ─────────────────────────────────────────────────────────

export const createAgendaTask = async (task) => {
  const { data, error } = await supabase
    .from('agenda_tasks')
    .insert([{ ...task, updated_at: new Date().toISOString() }])
    .select();
  return { data, error };
};

export const updateAgendaTask = async (id, updates) => {
  const { data, error } = await supabase
    .from('agenda_tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();
  return { data, error };
};

export const deleteAgendaTask = async (id) => {
  const { error } = await supabase.from('agenda_tasks').delete().eq('id', id);
  return { error };
};

// Personel: Tamamlandım → onay bekliyor
export const markAgendaTaskDone = async (id) => {
  const { data, error } = await supabase
    .from('agenda_tasks')
    .update({ completion_status: 'pending_review', status: 'tamamlandi', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();
  return { data, error };
};

// Koordinatör: Onayla
export const approveAgendaTask = async (id) => {
  const { data, error } = await supabase
    .from('agenda_tasks')
    .update({ completion_status: 'approved', status: 'tamamlandi', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();
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
  const [orgs, contacts, events, connections] = await Promise.all([
    supabase.from('network_organizations').select('*').order('name'),
    supabase.from('network_contacts').select('*').order('full_name'),
    supabase.from('network_events').select('*').order('event_date', { ascending: false }),
    supabase.from('network_connections').select('*').order('created_at'),
  ]);
  return {
    organizations: orgs.data   || [],
    contacts:      contacts.data || [],
    events:        events.data  || [],
    connections:   connections.data || [],
    error: orgs.error || contacts.error || events.error || connections.error,
  };
};

// ── Yardımcı: auth kontrolü ──
const _getUid = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
};

// ── ORGANIZATIONS ──
export const createNetworkOrg = async (data) => {
  const uid = await _getUid();
  if (!uid) return { data: null, error: { message: 'Oturum bulunamadı' } };
  const { data: d, error } = await supabase.from('network_organizations')
    .insert({ ...data, created_by: uid }).select().single();
  return { data: d, error };
};
export const updateNetworkOrg = async (id, data) => {
  const { data: d, error } = await supabase.from('network_organizations')
    .update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  return { data: d, error };
};
export const deleteNetworkOrg = async (id) => {
  const { error } = await supabase.from('network_organizations').delete().eq('id', id);
  return { error };
};

// ── CONTACTS ──
export const createNetworkContact = async (data) => {
  const uid = await _getUid();
  if (!uid) return { data: null, error: { message: 'Oturum bulunamadı' } };
  const { data: d, error } = await supabase.from('network_contacts')
    .insert({ ...data, created_by: uid }).select().single();
  return { data: d, error };
};
export const updateNetworkContact = async (id, data) => {
  const { data: d, error } = await supabase.from('network_contacts')
    .update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  return { data: d, error };
};
export const deleteNetworkContact = async (id) => {
  const { error } = await supabase.from('network_contacts').delete().eq('id', id);
  return { error };
};

// ── EVENTS ──
export const createNetworkEvent = async (data) => {
  const uid = await _getUid();
  if (!uid) return { data: null, error: { message: 'Oturum bulunamadı' } };
  const { data: d, error } = await supabase.from('network_events')
    .insert({ ...data, created_by: uid }).select().single();
  return { data: d, error };
};
export const updateNetworkEvent = async (id, data) => {
  const { data: d, error } = await supabase.from('network_events')
    .update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  return { data: d, error };
};
export const deleteNetworkEvent = async (id) => {
  const { error } = await supabase.from('network_events').delete().eq('id', id);
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
