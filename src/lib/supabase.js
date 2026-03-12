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
    .select('*, auth_user:user_id(email)')
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

export const updateUserProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
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
