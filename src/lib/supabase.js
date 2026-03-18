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

// Direktör için: tüm personelin loglarını gör
export const getAllDailyLogs = async (fromDate, toDate) => {
  const { data, error } = await supabase
    .from('daily_logs')
    .select('*, user_profiles!inner(full_name, role, unit)')
    .gte('log_date', fromDate)
    .lte('log_date', toDate)
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
export const getAllAgendas = async () => {
  const { data, error } = await supabase
    .from('agendas')
    .select('*')
    .order('due_date', { ascending: true });
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


// ── NETWORK MANAGEMENT ───────────────────────────────────────────────────────

// Tüm network verisini tek seferde çek
export const getNetworkAll = async () => {
  const [orgs, contacts, events, connections] = await Promise.all([
    supabase.from('network_organizations').select('*').order('name'),
    supabase.from('network_contacts').select('*, network_organizations(id,name,logo_url)').order('full_name'),
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

// ── ORGANIZATIONS ──
export const createNetworkOrg = async (data) => {
  const { data: d, error } = await supabase.from('network_organizations')
    .insert({ ...data, created_by: (await supabase.auth.getUser()).data.user?.id }).select().single();
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
  const { data: d, error } = await supabase.from('network_contacts')
    .insert({ ...data, created_by: (await supabase.auth.getUser()).data.user?.id }).select().single();
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
  const { data: d, error } = await supabase.from('network_events')
    .insert({ ...data, created_by: (await supabase.auth.getUser()).data.user?.id }).select().single();
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
  const { data: d, error } = await supabase.from('network_connections')
    .insert({ ...data, created_by: (await supabase.auth.getUser()).data.user?.id })
    .select().single();
  return { data: d, error };
};
export const deleteNetworkConnection = async (id) => {
  const { error } = await supabase.from('network_connections').delete().eq('id', id);
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
