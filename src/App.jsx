import React, { useState, useEffect, createContext, useContext } from 'react';
import { supabase, getUserProfile, upsertUserProfile } from './lib/supabase';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Agendas from './pages/Agendas';
import Donors from './pages/Donors';
import MeetingLog from './pages/MeetingLog';
import UnitReports from './pages/UnitReports';
import DailyLog from './pages/DailyLog';
import LogsDashboard from './pages/LogsDashboard';
import LogsViewer from './pages/LogsViewer';
import DonationTracker from './pages/DonationTracker';
import OrgChart from './pages/OrgChart';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import './App.css';

// ── Role Context ──
export const ProfileContext = createContext(null);
export const useProfile = () => useContext(ProfileContext);

// Role-based page access
export const ROLE_ACCESS = {
  direktor:             ['dashboard','chat','agendas','donors','meetings','reports','dailylog','logsviewer','analytics','donations','orgchart','admin','users'],
  direktor_yardimcisi:  ['dashboard','chat','agendas','donors','meetings','reports','dailylog','logsviewer','analytics','donations','orgchart'],
  asistan:              ['dashboard','chat','agendas','donors','meetings','reports','dailylog','logsviewer','analytics','donations','orgchart'],
  koordinator:          ['dashboard','chat','agendas','reports','dailylog','logsviewer','analytics','orgchart'],
  personel:             ['dashboard','chat','agendas','reports','dailylog','analytics','orgchart'],
};

export const ROLE_LABELS = {
  direktor:            'Direktör',
  direktor_yardimcisi: 'Direktör Yardımcısı',
  asistan:             'Asistan',
  koordinator:         'Koordinatör',
  personel:            'Personel',
};

// ── Şifre Belirleme Ekranı (invite/recovery sonrası) ──────────────────────────
function SetPasswordScreen({ onDone }) {
  const [pw, setPw]       = useState('');
  const [pw2, setPw2]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handle = async (e) => {
    e.preventDefault();
    if (pw.length < 6)     return setError('Şifre en az 6 karakter olmalı.');
    if (pw !== pw2)        return setError('Şifreler eşleşmiyor.');
    setLoading(true); setError('');
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) setError(error.message);
    else onDone();
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f1e2e 0%, #1a3a5c 50%, #0f2640 100%)',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 18, padding: '40px 36px', width: 340, boxSizing: 'border-box',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>🔑</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'white', marginBottom: 6 }}>Şifrenizi Belirleyin</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
            Hesabınıza ilk girişiniz. Lütfen bir şifre oluşturun.
          </div>
        </div>
        <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {['Yeni Şifre', 'Şifreyi Tekrarla'].map((label, i) => (
            <div key={i}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                {label.toUpperCase()}
              </label>
              <input
                type="password"
                value={i === 0 ? pw : pw2}
                onChange={e => i === 0 ? setPw(e.target.value) : setPw2(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '11px 14px', borderRadius: 10,
                  border: '1.5px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.07)', color: 'white',
                  fontSize: 14, fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
          ))}
          {error && (
            <div style={{
              padding: '9px 13px', borderRadius: 8, fontSize: 12.5,
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5',
            }}>⚠️ {error}</div>
          )}
          <button type="submit" disabled={loading} style={{
            padding: '13px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: loading ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.92)',
            color: '#1a3a5c', fontWeight: 800, fontSize: 14, fontFamily: 'inherit',
          }}>
            {loading ? '⏳ Kaydediliyor…' : 'Şifreyi Kaydet & Giriş Yap →'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState('dashboard');
  const [chatInitialMessage, setChatInitialMessage] = useState(null);
  const [needsPassword, setNeedsPassword] = useState(false);

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      // Invite veya password recovery linkiyle gelindiyse şifre belirleme ekranı göster
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' && session?.user?.app_metadata?.provider === 'email' && !session?.user?.last_sign_in_at) {
        setNeedsPassword(true);
      }
      if (u) {
        loadProfile(u).catch(e => console.error('Auth change loadProfile error:', e));
      } else {
        setProfile(null);
        setNeedsPassword(false);
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

  // Invite veya recovery linki ile gelindi → şifre belirleme ekranı
  if (needsPassword) return <SetPasswordScreen onDone={() => setNeedsPassword(false)} />;

  const pages = {
    dashboard: Dashboard,
    agendas:   Agendas,
    donors:    Donors,
    meetings:  MeetingLog,
    reports:   UnitReports,
    dailylog:   DailyLog,
    logsviewer: LogsViewer,
    analytics:  LogsDashboard,
    donations: DonationTracker,
    orgchart:  OrgChart,
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
