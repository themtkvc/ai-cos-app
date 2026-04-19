-- ═══════════════════════════════════════════════════════
-- AI CHIEF OF STAFF — SUPABASE DATABASE SCHEMA
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- Enable Row Level Security
-- All tables are scoped per user via auth.uid()

-- ── DEADLINES TABLE ──
CREATE TABLE IF NOT EXISTS deadlines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT,
  unit TEXT,
  owner TEXT,
  due_date DATE,
  priority TEXT DEFAULT '🟡 Medium',
  status TEXT DEFAULT '⚪ Not Started',
  donor TEXT,
  followup_date DATE,
  followup_done BOOLEAN DEFAULT false,
  notes TEXT,
  completed_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE deadlines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their deadlines" ON deadlines FOR ALL USING (auth.uid() = user_id);

-- ── DONORS TABLE ──
CREATE TABLE IF NOT EXISTS donors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT,
  health TEXT DEFAULT '🟢 Strong',
  account_manager TEXT,
  last_contact DATE,
  next_followup DATE,
  reporting_deadline DATE,
  active_engagements TEXT,
  priority TEXT DEFAULT '🟠 High',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE donors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their donors" ON donors FOR ALL USING (auth.uid() = user_id);

-- ── INTERACTIONS TABLE ──
CREATE TABLE IF NOT EXISTS interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  donor_id UUID REFERENCES donors(id) ON DELETE CASCADE,
  donor_name TEXT,
  interaction_date DATE,
  type TEXT,
  participants TEXT,
  key_points TEXT,
  followup_required TEXT,
  followup_done TEXT DEFAULT 'No',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their interactions" ON interactions FOR ALL USING (auth.uid() = user_id);

-- ── MEETING ACTIONS TABLE ──
CREATE TABLE IF NOT EXISTS meeting_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  meeting_type TEXT,
  meeting_date DATE,
  action_item TEXT NOT NULL,
  owner TEXT,
  due_date DATE,
  status TEXT DEFAULT '⚪ Not Started',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE meeting_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their meeting actions" ON meeting_actions FOR ALL USING (auth.uid() = user_id);

-- ── UNIT REPORTS TABLE ──
CREATE TABLE IF NOT EXISTS unit_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  unit TEXT NOT NULL,
  coordinator TEXT,
  week_of DATE,
  overall_status TEXT,
  key_achievement TEXT,
  main_challenge TEXT,
  decision_needed TEXT,
  escalation TEXT,
  next_week_priorities TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE unit_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their unit reports" ON unit_reports FOR ALL USING (auth.uid() = user_id);

-- ── AI CHAT HISTORY TABLE ──
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their chat history" ON chat_history FOR ALL USING (auth.uid() = user_id);

-- ── SEED DATA FUNCTION ──
CREATE OR REPLACE FUNCTION seed_demo_data(p_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Insert demo deadlines
  INSERT INTO deadlines (user_id, title, category, unit, owner, due_date, priority, status, donor, notes)
  VALUES
    (p_user_id, 'WFP Q1 Report Submission', 'Donor Reporting', 'Traditional Donors', 'Murat', CURRENT_DATE + 5, '🔴 Critical', '🔵 In Progress', 'WFP', 'Q1 2026 report — confirm data with Gülsüm'),
    (p_user_id, 'OCHA Monthly Brief', 'Donor Reporting', 'Humanitarian Affairs', 'Gülsüm', CURRENT_DATE + 12, '🔴 Critical', '🔵 In Progress', 'OCHA', 'Monthly humanitarian situation update'),
    (p_user_id, 'HfH MOU Renewal', 'Accreditations', 'Accreditations', 'Yavuz', CURRENT_DATE + 18, '🟠 High', '⚪ Not Started', 'Habitat for Humanity', 'Legal review needed before signing'),
    (p_user_id, 'Board Meeting Preparation', 'Governance', 'Policy & Governance', 'Sezgin', CURRENT_DATE + 2, '🔴 Critical', '🔵 In Progress', NULL, 'Briefing note + agenda for Director review'),
    (p_user_id, 'Good Neighbors Grant Narrative', 'Grants', 'Grants', 'Yasir', CURRENT_DATE + 21, '🟠 High', '🔵 In Progress', 'Good Neighbors', 'Draft ready — needs Director sign-off');

  -- Insert demo donors
  INSERT INTO donors (user_id, name, type, health, account_manager, last_contact, next_followup, reporting_deadline, active_engagements, priority)
  VALUES
    (p_user_id, 'WFP', 'UN Agency', '🟢 Strong', 'Murat', CURRENT_DATE - 15, CURRENT_DATE + 3, CURRENT_DATE + 5, 'Q1 Report, Field Visit', '🔴 Critical'),
    (p_user_id, 'OCHA', 'UN Agency', '🟢 Strong', 'Gülsüm', CURRENT_DATE - 5, CURRENT_DATE + 7, CURRENT_DATE + 12, 'Monthly Brief, Accreditation', '🔴 Critical'),
    (p_user_id, 'Habitat for Humanity', 'INGO Partner', '🟡 Developing', 'Yavuz', CURRENT_DATE - 10, CURRENT_DATE + 10, CURRENT_DATE + 18, 'MOU Renewal, Progress Report', '🟠 High'),
    (p_user_id, 'Good Neighbors', 'INGO Partner', '🟢 Strong', 'Yasir', CURRENT_DATE - 7, CURRENT_DATE + 14, CURRENT_DATE + 21, 'Grant Narrative, Financial Report', '🟠 High');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── USER INTEGRATIONS (Google Tasks / kişisel OAuth) ──────────────────────
-- Her kullanıcı için provider bazlı OAuth token'ları saklar.
-- refresh_token + access_token plain-text (RLS + service role korur).
-- Production-grade encryption için pg_sodium veya vault önerilir.
CREATE TABLE IF NOT EXISTS user_integrations (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,                   -- 'google_tasks' (ileride 'google_keep_readonly' vb.)
  access_token TEXT,
  refresh_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  scopes TEXT[],
  google_email TEXT,                        -- bağlanan Google hesabı (UX için)
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, provider)
);
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;
-- Kullanıcı sadece kendi satırlarını görebilir / yönetebilir
DROP POLICY IF EXISTS "own_integrations_select" ON user_integrations;
CREATE POLICY "own_integrations_select" ON user_integrations FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own_integrations_insert" ON user_integrations;
CREATE POLICY "own_integrations_insert" ON user_integrations FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own_integrations_update" ON user_integrations;
CREATE POLICY "own_integrations_update" ON user_integrations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own_integrations_delete" ON user_integrations;
CREATE POLICY "own_integrations_delete" ON user_integrations FOR DELETE USING (auth.uid() = user_id);
-- (api/google-tasks*.js proxy'leri SUPABASE_SERVICE_ROLE_KEY ile okur/yazar → RLS bypass.)
