import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Deadlines from './pages/Deadlines';
import Donors from './pages/Donors';
import MeetingLog from './pages/MeetingLog';
import UnitReports from './pages/UnitReports';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState('dashboard');
  const [chatInitialMessage, setChatInitialMessage] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Enhanced navigate: navigate(page) or navigate(page, { initialMessage: '...' })
  const navigate = (page, opts = {}) => {
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

  if (!user) return <Login onLogin={setUser} />;

  const pages = {
    dashboard: Dashboard,
    deadlines: Deadlines,
    donors: Donors,
    meetings: MeetingLog,
    reports: UnitReports,
    admin: Admin,
  };

  const PageComponent = pages[activePage];

  return (
    <div className="app">
      <Sidebar activePage={activePage} onNavigate={navigate} user={user} />
      <main className="app-main">
        {activePage === 'chat' ? (
          <Chat
            user={user}
            onNavigate={navigate}
            initialMessage={chatInitialMessage}
            onClearInitialMessage={() => setChatInitialMessage(null)}
          />
        ) : PageComponent ? (
          <PageComponent user={user} onNavigate={navigate} />
        ) : (
          <Dashboard user={user} onNavigate={navigate} />
        )}
      </main>
    </div>
  );
}
