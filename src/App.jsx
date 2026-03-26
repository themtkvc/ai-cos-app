import React, { useState, useEffect, createContext, useContext } from 'react';
import { supabase, getUserProfile, upsertUserProfile } from './lib/supabase';
import { ROLE_LABELS as _ROLE_LABELS } from './lib/constants';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Agendas from './pages/Agendas';
import Donors from './pages/Donors';
import MeetingLog from './pages/MeetingLog';
import UnitReports from './pages/UnitReports';
import DailyLog from './pages/DailyLog';
import LogsDashboard from './pages/LogsDashboard';
import LogsViewer from './pages/LogsViewer';
import ProfileSettings from './pages/ProfileSettings';
import DonationTracker from './pages/DonationTracker';
import OrgChart from './pages/OrgChart';
import NetworkManager from './pages/NetworkManager';
import NetworkAnalytics from './pages/NetworkAnalytics';
import Notes from './pages/Notes';
import Documents from './pages/Documents';
import Notifications from './pages/Notifications';
import Admin from './pages/Admin';
import Gamification from './pages/Gamification';
import FundOpportunities from './pages/FundOpportunities';
import FormsManager from './pages/FormsManager';
import PublicFormFill from './pages/PublicFormFill';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import AIChatPanel from './components/AIChatPanel';
import './App.css';

// ── Role Context ──
export const ProfileContext = createContext(null);
export const useProfile = () => useContext(ProfileContext);

// ── Theme Context ──
export const ThemeContext = createContext({ theme: 'light', toggleTheme: () => {} });
export const useTheme = () => useContext(ThemeContext);

// Role-based page access
export const ROLE_ACCESS = {
  direktor:             ['dashboard','notifications','chat','agendas','donors','meetings','reports','dailylog','logsviewer','analytics','donations','orgchart','network','networkanalytics','notes','documents','funds','forms','gamification','admin','users','profile'],
  direktor_yardimcisi:  ['dashboard','notifications','agendas','meetings','reports','dailylog','logsviewer','analytics','orgchart','network','funds','forms','notes','profile'],
  asistan:              ['dashboard','notifications','agendas','donors','meetings','reports','dailylog','logsviewer','analytics','donations','orgchart','network','funds','forms','notes','profile'],
  koordinator:          ['dashboard','notifications','agendas','reports','dailylog','logsviewer','analytics','orgchart','network','funds','forms','notes','profile'],
  personel:             ['dashboard','notifications','agendas','reports','dailylog','analytics','orgchart','network','funds','forms','notes','profile'],
};

// Re-export: asıl tanım constants.js'de — geriye uyumluluk için burada da export
export const ROLE_LABELS = _ROLE_LABELS;

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
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  // URL hash'ten başlangıç sayfasını oku (yenileme sonrası koru)
  const pageFromHash = () => {
    const h = window.location.hash.replace('#', '').trim();
    const allPages = Object.values(ROLE_ACCESS).flat();
    return allPages.includes(h) ? h : 'dashboard';
  };
  const [activePage, setActivePage] = useState(pageFromHash);
  const [chatInitialMessage, setChatInitialMessage] = useState(null);
  const [dailyLogLinkedTask, setDailyLogLinkedTask] = useState(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);

  // ── Theme (dark/light) ──
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('ai-cos-theme') || 'light'; } catch { return 'light'; }
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('ai-cos-theme', theme); } catch {}
  }, [theme]);
  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  // Offline detection
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // Browser geri/ileri tuşu desteği
  useEffect(() => {
    const onHashChange = () => {
      const page = pageFromHash();
      const allowed = ROLE_ACCESS[profile?.role] || ROLE_ACCESS['personel'];
      if (allowed.includes(page)) setActivePage(page);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [profile]);

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
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session?.user?.app_metadata?.provider === 'email' && !session?.user?.last_sign_in_at)) {
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

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [linkedAgendaId, setLinkedAgendaId] = useState(null);

  const navigate = (page, opts = {}) => {
    // Check role access
    const allowed = ROLE_ACCESS[profile?.role] || ROLE_ACCESS['personel'];
    if (!allowed.includes(page)) return;
    setActivePage(page);
    setMobileNavOpen(false);
    window.location.hash = page; // URL'ye yaz → yenileme sonrası korunur
    if (opts && opts.initialMessage !== undefined) {
      setChatInitialMessage(opts.initialMessage || null);
    }
    if (opts && opts.linkedTask !== undefined) {
      setDailyLogLinkedTask(opts.linkedTask || null);
    }
    if (opts && opts.agendaId !== undefined) {
      setLinkedAgendaId(opts.agendaId || null);
    }
  };

  // ── Public form route: #form/SLUG → login gerektirmez ──
  const hashPath = window.location.hash.replace('#', '').trim();
  const publicFormMatch = hashPath.match(/^form\/(.+)$/);
  if (publicFormMatch) {
    return <PublicFormFill slug={publicFormMatch[1]} />;
  }

  if (loading) return (
    <div className="app-loading">
      <div className="loading-spinner" />
      <p>AI Chief of Staff yükleniyor...</p>
    </div>
  );

  if (!user) return <Login onLogin={(u) => { setUser(u); loadProfile(u); }} />;

  // Invite veya recovery linki ile gelindi → şifre belirleme ekranı
  if (needsPassword) return <SetPasswordScreen onDone={() => setNeedsPassword(false)} />;

  // Profil henüz yüklenmemişse kısa loading göster (yanlış rol ile render'ı engelle)
  if (!profile) return (
    <div className="app-loading">
      <div className="loading-spinner" />
      <p>Profil bilgileri yükleniyor...</p>
    </div>
  );

  const pages = {
    dashboard: Dashboard,
    agendas:   Agendas,
    donors:    Donors,
    meetings:  MeetingLog,
    reports:   UnitReports,
    dailylog:   DailyLog,
    logsviewer: LogsViewer,
    analytics:  LogsDashboard,
    profile:    ProfileSettings,
    donations: DonationTracker,
    orgchart:  OrgChart,
    network:          NetworkManager,
    networkanalytics: NetworkAnalytics,
    notes:     Notes,
    documents: Documents,
    notifications: Notifications,
    funds:        FundOpportunities,
    forms:        FormsManager,
    gamification: Gamification,
    admin:     Admin,
    users:     Admin,
  };

  const PageComponent = pages[activePage];

  const PAGE_TITLES = {
    dashboard:  '⚡ Dashboard',
    chat:       '🤖 AI Asistan',
    agendas:    '📋 Gündemler',
    donors:     '🤝 Donör CRM',
    meetings:   '📋 Toplantı Logu',
    reports:    '📊 Birim Raporları',
    dailylog:   '🗓 İş Kayıtları',
    logsviewer: '📂 Kayıt Dashboard',
    analytics:  '📈 Çalışma Analizi',
    donations:  '💰 Bağış Takip',
    orgchart:   '🏢 Org Şeması',
    network:          '🕸️ Network',
    networkanalytics: '🔬 Network Analiz',
    notes:      '📝 Notlarım',
    documents:  '📄 Dokümanlar',
    notifications: '🔔 Bildirimler',
    funds:        '💰 Fon Fırsatları',
    forms:        '📋 Formlar',
    gamification: '🏆 Oyunlaştırma',
    profile:    '⚙️ Profil',
    admin:      '⚙️ Admin',
    users:      '👥 Kullanıcılar',
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
    <ProfileContext.Provider value={{ profile, setProfile, reloadProfile: () => loadProfile(user) }}>
      <div className="app">
        {isOffline && (
          <div style={{ background: 'var(--red)', color: 'white', textAlign: 'center', padding: '8px 16px', fontSize: 13, fontWeight: 500, position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999 }}>
            İnternet bağlantısı kesildi — değişiklikler kaydedilmeyebilir
          </div>
        )}
        {/* Mobil üst bar */}
        <header className="mobile-header">
          <button className="mobile-header-menu" onClick={() => setMobileNavOpen(true)} aria-label="Menü">☰</button>
          <span className="mobile-header-title">{PAGE_TITLES[activePage] || 'AI Chief of Staff'}</span>
        </header>

        {/* Sidebar backdrop (mobilde) */}
        {mobileNavOpen && <div className="mobile-backdrop" onClick={() => setMobileNavOpen(false)} />}

        <Sidebar
          activePage={activePage}
          onNavigate={navigate}
          user={user}
          profile={profile}
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />
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
            <PageComponent
              user={user}
              profile={profile}
              onNavigate={navigate}
              defaultTab={activePage === 'users' ? 'users' : undefined}
              onProfileUpdate={() => loadProfile(user)}
              linkedTask={activePage === 'dailylog' ? dailyLogLinkedTask : undefined}
              linkedAgendaId={activePage === 'agendas' ? linkedAgendaId : undefined}
              onClearLinkedAgenda={() => setLinkedAgendaId(null)}
            />
          ) : (
            <Dashboard user={user} profile={profile} onNavigate={navigate} />
          )}
        </main>

        {/* AI Asistan Chat — sadece direktör */}
        {profile?.role === 'direktor' && (
          <>
            <AIChatPanel user={user} profile={profile} isOpen={aiChatOpen} onClose={() => setAiChatOpen(false)} />
            {!aiChatOpen && (
              <button
                onClick={() => setAiChatOpen(true)}
                title="COS Asistan"
                style={{
                  position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
                  width: 56, height: 56, borderRadius: '50%', border: 'none',
                  background: 'var(--navy, #1a3a5c)', color: '#fff',
                  fontSize: 26, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.35)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.25)'; }}
              >
                🤖
              </button>
            )}
          </>
        )}
      </div>
    </ProfileContext.Provider>
    </ThemeContext.Provider>
  );
}
