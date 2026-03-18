import React, { useState, useEffect } from 'react';
import { signIn, signUp, getPublicAnnouncements } from '../lib/supabase';

const PRIORITY_META = {
  urgent:    { label: 'Acil',     color: '#ef4444', bg: '#fef2f2', border: '#fecaca', icon: '🚨' },
  important: { label: 'Önemli',   color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', icon: '⚠️' },
  normal:    { label: 'Duyuru',   color: '#2e6da4', bg: '#eff6ff', border: '#bfdbfe', icon: '📢' },
};

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)   return 'az önce';
  if (diff < 3600) return `${Math.floor(diff/60)} dakika önce`;
  if (diff < 86400) return `${Math.floor(diff/3600)} saat önce`;
  const d = new Date(dateStr);
  return `${d.getDate()} ${['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'][d.getMonth()]} ${d.getFullYear()}`;
}

export default function Login({ onLogin }) {
  const [mode, setMode]         = useState('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [annLoading, setAnnLoading]       = useState(true);

  useEffect(() => {
    getPublicAnnouncements().then(({ data }) => {
      setAnnouncements(data || []);
      setAnnLoading(false);
    });
  }, []);

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    if (mode === 'login') {
      const { data, error } = await signIn(email, password);
      if (error) setError(error.message);
      else onLogin(data.user);
    } else {
      const { error } = await signUp(email, password);
      if (error) setError(error.message);
      else setSuccess('Hesap oluşturuldu! E-posta adresinizi doğrulayın, ardından giriş yapın.');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f1e2e 0%, #1a3a5c 50%, #0f2640 100%)',
      display: 'flex',
      fontFamily: 'var(--font-body, system-ui, sans-serif)',
    }}>

      {/* ── Sol: İçerik Alanı ─────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '40px 48px 60px',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}>

        {/* Logo & Başlık */}
        <header style={{ marginBottom: 44 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, border: '1px solid rgba(255,255,255,0.18)',
            }}>🏛</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>
                AI Chief of Staff
              </div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>
                Direktör Ofisi · Departman Yönetim Platformu
              </div>
            </div>
          </div>
        </header>

        {/* ── DUYURULAR ── */}
        <Section icon="📢" title="Duyurular">
          {annLoading ? (
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, padding: '12px 0' }}>
              Duyurular yükleniyor…
            </div>
          ) : announcements.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, padding: '12px 0' }}>
              Şu an aktif duyuru bulunmuyor.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {announcements.map(ann => {
                const meta = PRIORITY_META[ann.priority] || PRIORITY_META.normal;
                return (
                  <div key={ann.id} style={{
                    background: meta.bg,
                    border: `1px solid ${meta.border}`,
                    borderLeft: `4px solid ${meta.color}`,
                    borderRadius: 10,
                    padding: '12px 16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ fontSize: 15 }}>{meta.icon}</span>
                        <span style={{ fontWeight: 700, fontSize: 13.5, color: '#1f2937' }}>{ann.title}</span>
                        <span style={{
                          fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
                          background: meta.color + '22', color: meta.color,
                        }}>{meta.label}</span>
                      </div>
                      <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                        {timeAgo(ann.published_at)}
                      </span>
                    </div>
                    {ann.content && (
                      <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.55 }}>{ann.content}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* ── PLATFORM HAKKINDA ── */}
        <Section icon="ℹ️" title="Platform Hakkında">
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13.5, lineHeight: 1.7, margin: '0 0 16px' }}>
            AI Chief of Staff, direktör ofisi ve departman birimlerinin günlük operasyonlarını
            tek bir platform üzerinden yönetmelerini sağlayan entegre bir yönetim sistemidir.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { icon: '📋', text: 'Günlük İş Kayıtları — Personel çalışma kayıtları' },
              { icon: '📊', text: 'Birim Raporları — Birim bazlı ilerleme takibi' },
              { icon: '📈', text: 'Çalışma Analizi — Haftalık & aylık analitik' },
              { icon: '🤖', text: 'AI Asistan — Claude destekli karar desteği' },
              { icon: '📅', text: 'Görev & Tarihler — Son tarih yönetimi' },
              { icon: '🤝', text: 'Donör CRM — Bağışçı ilişki takibi' },
            ].map((f, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '9px 12px',
              }}>
                <span style={{ fontSize: 16, lineHeight: 1.4 }}>{f.icon}</span>
                <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.4 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── YARDIM & İLETİŞİM ── */}
        <Section icon="🆘" title="Yardım & İletişim">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ContactCard
              icon="🔑"
              title="Giriş Sorunu"
              desc="Şifrenizi unuttuysanız veya hesabınıza erişemiyorsanız sistem yöneticinize başvurun."
            />
            <ContactCard
              icon="➕"
              title="Yeni Hesap"
              desc="Sisteme kayıt olmak için sağdaki 'Hesap Oluştur' bağlantısını kullanın, ardından yöneticiniz rolünüzü atayacaktır."
            />
            <ContactCard
              icon="⚙️"
              title="Teknik Destek"
              desc="Platform hataları ve teknik sorunlar için IT birimiyle iletişime geçin."
            />
          </div>
        </Section>

        {/* Alt bilgi */}
        <footer style={{ marginTop: 'auto', paddingTop: 32, fontSize: 11.5, color: 'rgba(255,255,255,0.25)', display: 'flex', gap: 16 }}>
          <span>© 2026 Direktör Ofisi</span>
          <span>·</span>
          <span>AI Chief of Staff v2.0</span>
          <span>·</span>
          <span>Powered by Claude AI</span>
        </footer>
      </div>

      {/* ── Sağ: Giriş Kartı ─────────────────────────────────────────── */}
      <div style={{
        width: 380,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 32px',
        background: 'rgba(0,0,0,0.2)',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        minHeight: '100vh',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: 320 }}>
          {/* Kart başlığı */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🔐</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'white', marginBottom: 4 }}>
              {mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}
            </div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.45)' }}>
              {mode === 'login' ? 'Devam etmek için giriş yapın' : 'Yeni hesap oluşturun'}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
                E-POSTA
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="kullanici@kurum.org"
                required
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '11px 14px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.07)', color: 'white', fontSize: 13.5,
                  fontFamily: 'inherit', outline: 'none',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.4)'}
                onBlur={e  => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
                ŞİFRE
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '11px 14px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.07)', color: 'white', fontSize: 13.5,
                  fontFamily: 'inherit', outline: 'none',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.4)'}
                onBlur={e  => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
              />
            </div>

            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, fontSize: 12.5,
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 7,
              }}>
                ⚠️ {error}
              </div>
            )}
            {success && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, fontSize: 12.5,
                background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.3)',
                color: '#86efac',
              }}>
                ✓ {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '13px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: loading ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.92)',
                color: '#1a3a5c', fontWeight: 800, fontSize: 14, fontFamily: 'inherit',
                transition: 'all 0.15s', letterSpacing: '-0.01em',
              }}
            >
              {loading ? '⏳ Bekleniyor…' : mode === 'login' ? 'Giriş Yap →' : 'Hesap Oluştur →'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 18 }}>
            <button
              type="button"
              onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(''); setSuccess(''); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.38)', fontSize: 12.5, fontFamily: 'inherit',
                textDecoration: 'underline', textUnderlineOffset: 3,
              }}
            >
              {mode === 'login' ? 'Hesabınız yok mu? Kayıt olun' : 'Zaten hesabınız var mı? Giriş yapın'}
            </button>
          </div>

          {/* Güvenlik notu */}
          <div style={{
            marginTop: 28, padding: '12px 14px', borderRadius: 10,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            fontSize: 11.5, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6, textAlign: 'center',
          }}>
            🔒 Tüm veriler şifreli olarak saklanır. Yetkisiz erişim engellenir.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Yardımcı Componentler ─────────────────────────────────────────────────────
function Section({ icon, title, children }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2 style={{
        fontSize: 13, fontWeight: 700, letterSpacing: '0.07em',
        color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
        marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
        paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <span style={{ fontSize: 16 }}>{icon}</span> {title}
      </h2>
      {children}
    </section>
  );
}

function ContactCard({ icon, title, desc }) {
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.09)',
      borderRadius: 10, padding: '12px 14px',
    }}>
      <span style={{ fontSize: 20, lineHeight: 1.3, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55 }}>{desc}</div>
      </div>
    </div>
  );
}
