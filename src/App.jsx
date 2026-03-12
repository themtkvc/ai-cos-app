import React, { useState, useEffect, createContext, useContext } from 'react';
import { supabase, getUserProfile, upsertUserProfile } from './lib/supabase';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Deadlines from './pages/Deadlines';
import Donors from './pages/Donors';
import MeetingLog from './pages/MeetingLog';
import UnitReports from './pages/UnitReports';
import DailyLog from './pages/DailyLog';
import LogsDashboard from './pages/LogsDashboard';
import DonationTracker from './pages/DonationTracker';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import './App.css';

// ── Role Context ──
export const ProfileContext = createContext(null);
export const useProfile = () => useContext(ProfileContext);

// Role-based page access
export const ROLE_ACCESS = {
  direktor:             ['dashboard','chat','deadlines','donors','meetings','reports','dailylog','analytics','donations','admin','users'],
  direktor_yardimcisi:  ['dashboard','chat','deadlines','donors','meetings','reports','dailylog','analytics','donations'],
  asistan:              ['dashboard','chat','deadlines','donors','meetings','reports','dailylog','analytics','donations'],
  koordinator:          ['dashboard','chat','reports','dailylog','analytics'],
  personel:             ['dashboard','chat','reports','dailylog','analytics'],
};

export const ROLE_LABELS = {
  direktor:            'Direktör',
  direktor_yardimcisi: 'Direktör Yardımcısı',
  asistan:             'Asistan',
  koordinator:         'Koordinatör',
  personel:            'Personel',
};

export default function App() {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState('dashboard');
  const [chatInitialMessage, setChatInitialMessage] = useState(null);

  // Load user + profile
  const loadProfile = async (authUser) => {
    if (!authUser) { setProfile(null); return; }
    const { data, error } = await getUserProfile(authUser.id);
    if (data) {
      setProfile(data);
    } else if (!error) {
      // No profile exists yet → auto-create with default role 'personel'
      const newProfile = { user_id: authUser.id, role: 'personel', full_name: authUser.email };
      const { data: created } = await upsertUserProfile(newProfile);
      setProfile(created?.[0] || { ...newProfile });
    } else {
      // Error reading profile (e.g. RLS issue) → do NOT overwrite, use minimal fallback
      console.error('loadProfile error:', error);
      setProfile({ user_id: authUser.id, role: 'personel', full_name: authUser.email, _fallback: true });
    }
  };

  useEffect(() => {
    // Timeout güvenliği: 8 saniye sonra her durumda loading bitir
    const safetyTimer = setTimeout(() => setLoading(false), 8000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(safetyTimer);
      const u = session?.user ?? null;
      setUser(u);
      setLoading(false); // Profil yüklenmesini bekleme, hemen göster
      if (u) {
        loadProfile(u).catch(e => console.error('loadProfile error:', e));
      }
    }).catch((e) => {
      clearTimeout(safetyTimer);
      console.error('getSession error:', e);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        loadProfile(u).catch(e => console.error('Auth change loadProfile error:', e));
      } else {
        setProfile(null);
      }
    });
    return () => { clearTimeout(safetyTimer); subscription.unsubscribe(); };
  }, []);

  const navigate = (page, opts = {}) => {
    // Check role access
    const allowed = ROLE_ACCESS[profile?.role] || ROLE_ACCESS['personel'];
    if (!allowed.includes(page)) return;
    setActivePage(page);
    if (opts && opts.initialMessage !== undefined) {
      setChatInitialMessage(opts.initialMessage || null);
    }
  };

  if (loading) return (
    <div className="app-loading">
      <div className="loading-spinner" />
      <p>AI Chief of Staff yükleniyor...</p>
    </div>
  );

  if (!user) return <Login onLogin={(u) => { setUser(u); loadProfile(u); }} />;

  const pages = {
    dashboard: Dashboard,
    deadlines: Deadlines,
    donors:    Donors,
    meetings:  MeetingLog,
    reports:   UnitReports,
    dailylog:  DailyLog,
    analytics: LogsDashboard,
    donations: DonationTracker,
    admin:     Admin,
    users:     Admin,
  };

  const PageComponent = pages[activePage];

  return (
    <ProfileContext.Provider value={{ profile, setProfile, reloadProfile: () => loadProfile(user) }}>
      <div className="app">
        <Sidebar activePage={activePage} onNavigate={navigate} user={user} profile={profile} />
        <main className="app-main">
          {activePage === 'chat' ? (
            <Chat
              user={user}
              profile={profile}
              onNavigate={navigate}
              initialMessage={chatInitialMessage}
              onClearInitialMessage={() => setChatInitialMessage(null)}
            />
          ) : PageComponent ? (
            <PageComponent user={user} profile={profile} onNavigate={navigate}
              defaultTab={activePage === 'users' ? 'users' : undefined} />
          ) : (
            <Dashboard user={user} profile={profile} onNavigate={navigate} />
          )}
        </main>
      </div>
    </ProfileContext.Provider>
  );
}
