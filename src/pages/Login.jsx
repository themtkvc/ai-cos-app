import React, { useState } from 'react';
import { signIn, signUp } from '../lib/supabase';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    if (mode === 'login') {
      const { data, error } = await signIn(email, password);
      if (error) setError(error.message);
      else onLogin(data.user);
    } else {
      const { data, error } = await signUp(email, password);
      if (error) setError(error.message);
      else setSuccess('Hesap oluşturuldu! Email adresinizi doğrulayın, ardından giriş yapın.');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">🏛</div>
        <h1 className="login-title">AI Chief of Staff</h1>
        <p className="login-sub">Direktör Ofisi · Uluslararası İnsani Yardım Örgütü</p>

        <form className="login-form" onSubmit={handle}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="director@organization.org"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Şifre</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="login-error">⚠ {error}</div>}
          {success && <div style={{color:'#86efac', fontSize:12.5, marginTop:8, textAlign:'center'}}>{success}</div>}
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? '⏳ Bekleniyor...' : mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}
          </button>
          <div style={{textAlign:'center', marginTop:16}}>
            <button
              type="button"
              onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(''); setSuccess(''); }}
              style={{background:'none', border:'none', color:'rgba(255,255,255,0.4)', fontSize:12.5, cursor:'pointer'}}
            >
              {mode === 'login' ? 'Henüz hesabınız yok mu? Kayıt olun' : 'Zaten hesabınız var mı? Giriş yapın'}
            </button>
          </div>
        </form>

        <div className="login-demo-note">
          🔒 Tüm veriler Supabase'de sizin hesabınıza özel olarak saklanır.<br/>
          Claude API key'inizi .env dosyasına ekleyin.
        </div>
      </div>
    </div>
  );
}
