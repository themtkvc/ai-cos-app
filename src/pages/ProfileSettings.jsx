import React, { useState, useEffect, useRef } from 'react';
import { updateUserProfile, updateAuthEmail, updateAuthPassword, uploadAvatar, awardXP, supabase, validateUploadFile, MAX_AVATAR_BYTES } from '../lib/supabase';
import { ROLE_LABELS } from '../lib/constants';

// ── AVATAR BILEŞENI (yeniden kullanılabilir) ──────────────────────────────────
export function UserAvatar({ profile, size = 36, fontSize = 15, style = {} }) {
  const initials = (profile?.full_name || '?')[0].toUpperCase();
  const avatarUrl = profile?.avatar_url;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={profile?.full_name || ''}
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover', flexShrink: 0,
          border: '2px solid rgba(255,255,255,0.25)',
          ...style,
        }}
        onError={e => {
          // Resim yüklenemezse initials göster
          e.target.style.display = 'none';
          e.target.nextSibling && (e.target.nextSibling.style.display = 'flex');
        }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--navy-pale)', color: 'var(--navy)',
      fontWeight: 800, fontSize: fontSize,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, ...style,
    }}>
      {initials}
    </div>
  );
}

// ── PROFIL AYARLARI SAYFASI ──────────────────────────────────────────────────
export default function ProfileSettings({ user, profile, onProfileUpdate }) {
  const [form, setForm] = useState({
    full_name: '',
    phone:     '',
    address:   '',
  });
  const [newEmail, setNewEmail]       = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPw, setConfirmPw]     = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile]       = useState(null);
  const [saving, setSaving]     = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPw, setSavingPw]   = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errors, setErrors]         = useState({});
  const fileInputRef = useRef();

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        phone:     profile.phone     || '',
        address:   profile.address   || '',
      });
      setAvatarPreview(profile.avatar_url || null);
    }
  }, [profile]);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  // ── Profil Bilgilerini Kaydet ──
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.full_name.trim()) errs.full_name = 'Ad Soyad boş bırakılamaz.';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true); setErrors({});
    const { error } = await updateUserProfile(user.id, {
      full_name: form.full_name.trim(),
      phone:     form.phone.trim()   || null,
      address:   form.address.trim() || null,
    });
    setSaving(false);
    if (error) { setErrors({ general: error.message }); return; }
    onProfileUpdate?.();
    showSuccess('Profil bilgileri kaydedildi.');
    // Profil tamamlandıysa (ad, birim, telefon doluysa) tek seferlik XP ver
    const isComplete = form.full_name.trim() && profile?.unit && form.phone.trim();
    if (isComplete && user?.id) {
      try {
        const { data: existing } = await supabase
          .from('xp_events')
          .select('id')
          .eq('user_id', user.id)
          .eq('action', 'profile_complete')
          .limit(1);
        if (!existing || existing.length === 0) {
          awardXP(user.id, 'profile_complete', 'Profil tamamlandı', user.id);
        }
      } catch (e) { console.error('[XP] profile_complete error:', e); }
    }
  };

  // ── Profil Resmi Seç ──
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const v = validateUploadFile(file, { maxBytes: MAX_AVATAR_BYTES, kind: 'avatar' });
    if (!v.ok) {
      setErrors({ avatar: v.error });
      e.target.value = '';
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setErrors(prev => ({ ...prev, avatar: undefined }));
  };

  // ── Profil Resmi Yükle ──
  const handleUploadAvatar = async () => {
    if (!avatarFile) return;
    setUploadingAvatar(true); setErrors({});
    const { data: publicUrl, error } = await uploadAvatar(user.id, avatarFile);
    if (error) {
      setErrors({ avatar: 'Resim yüklenemedi: ' + error.message });
      setUploadingAvatar(false);
      return;
    }
    await updateUserProfile(user.id, { avatar_url: publicUrl });
    setAvatarFile(null);
    setAvatarPreview(publicUrl);
    setUploadingAvatar(false);
    onProfileUpdate?.();
    showSuccess('Profil resmi güncellendi.');
  };

  // ── E-posta Değiştir ──
  const handleEmailUpdate = async (e) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setSavingEmail(true); setErrors({});
    const { error } = await updateAuthEmail(newEmail.trim());
    setSavingEmail(false);
    if (error) { setErrors({ email: error.message }); return; }
    setNewEmail('');
    showSuccess('Doğrulama e-postası gönderildi. Lütfen yeni e-posta adresinizi onaylayın.');
  };

  // ── Şifre Değiştir ──
  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    const errs = {};
    if (newPassword.length < 6) errs.password = 'Şifre en az 6 karakter olmalı.';
    if (newPassword !== confirmPw) errs.confirmPw = 'Şifreler eşleşmiyor.';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSavingPw(true); setErrors({});
    const { error } = await updateAuthPassword(newPassword);
    setSavingPw(false);
    if (error) { setErrors({ password: error.message }); return; }
    setNewPassword(''); setConfirmPw('');
    showSuccess('Şifre başarıyla güncellendi.');
  };

  const section = (title, icon, children) => (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: 14,
      border: '1px solid var(--border)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      marginBottom: 20,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--navy-pale)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>{title}</span>
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  );

  const field = (label, key, type = 'text', placeholder = '') => (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: 'block', fontSize: 11.5, fontWeight: 700,
        color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 6,
        textTransform: 'uppercase',
      }}>{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '10px 13px', borderRadius: 9,
          border: `1.5px solid ${errors[key] ? 'var(--red)' : 'var(--border)'}`,
          fontSize: 14, fontFamily: 'inherit',
          color: 'var(--text)', background: 'var(--bg-card)', outline: 'none',
          transition: 'border-color 0.15s',
        }}
      />
      {errors[key] && (
        <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>{errors[key]}</div>
      )}
    </div>
  );

  return (
    <div className="page-container" style={{ maxWidth: 640 }}>
      {/* Başlık */}
      <div className="page-header">
        <h1 className="page-title">👤 Profil Ayarları</h1>
        <p className="page-subtitle">Kişisel bilgilerini ve hesap ayarlarını yönet</p>
      </div>

      {/* Başarı mesajı */}
      {successMsg && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 16,
          background: 'var(--green-pale)', border: '1px solid rgba(34,197,94,0.25)',
          color: 'var(--green)', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          ✅ {successMsg}
        </div>
      )}

      {/* Genel hata */}
      {errors.general && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 16,
          background: 'var(--red-pale)', border: '1px solid rgba(239,68,68,0.2)',
          color: 'var(--red)', fontSize: 13,
        }}>⚠️ {errors.general}</div>
      )}

      {/* Profil Resmi */}
      {section('Profil Resmi', '📷', (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          {/* Önizleme */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Profil"
                style={{
                  width: 90, height: 90, borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid rgba(26,58,92,0.2)',
                }}
              />
            ) : (
              <div style={{
                width: 90, height: 90, borderRadius: '50%',
                background: 'var(--navy-pale)', color: 'var(--navy)',
                fontWeight: 800, fontSize: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '3px solid var(--navy-pale)',
              }}>
                {(form.full_name || profile?.full_name || '?')[0].toUpperCase()}
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => fileInputRef.current?.click()}
              >📁 Resim Seç</button>
              {avatarFile && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleUploadAvatar}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? '⏳ Yükleniyor…' : '⬆️ Kaydet'}
                </button>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 8 }}>
              JPG, PNG, WebP · Maks. 5 MB
            </div>
            {errors.avatar && (
              <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>{errors.avatar}</div>
            )}
          </div>
        </div>
      ))}

      {/* Kişisel Bilgiler */}
      {section('Kişisel Bilgiler', '✏️', (
        <form onSubmit={handleSaveProfile}>
          {/* Rol & Birim (salt okunur) */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 6, textTransform: 'uppercase' }}>
                Rol
              </div>
              <div style={{
                padding: '10px 13px', borderRadius: 9,
                border: '1.5px solid var(--border)',
                fontSize: 13, color: 'var(--text-muted)', background: 'var(--bg-hover)',
              }}>
                {ROLE_LABELS[profile?.role] || profile?.role || '—'}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 6, textTransform: 'uppercase' }}>
                Birim
              </div>
              <div style={{
                padding: '10px 13px', borderRadius: 9,
                border: '1.5px solid var(--border)',
                fontSize: 13, color: 'var(--text-muted)', background: 'var(--bg-hover)',
              }}>
                {profile?.unit || '—'}
              </div>
            </div>
          </div>

          {field('Ad Soyad', 'full_name', 'text', 'Adınız Soyadınız')}
          {field('Telefon', 'phone', 'tel', '+90 5xx xxx xx xx')}
          {field('Adres', 'address', 'text', 'Şehir, Ülke')}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{ width: '100%', marginTop: 4 }}
          >
            {saving ? '⏳ Kaydediliyor…' : '💾 Kaydet'}
          </button>
        </form>
      ))}

      {/* E-posta Değiştir */}
      {section('E-posta Adresi', '📧', (
        <form onSubmit={handleEmailUpdate}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 6, textTransform: 'uppercase' }}>
              Mevcut E-posta
            </div>
            <div style={{
              padding: '10px 13px', borderRadius: 9,
              border: '1.5px solid var(--border)',
              fontSize: 13, color: 'var(--text-muted)', background: 'var(--bg-hover)',
            }}>
              {user?.email || '—'}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 6, textTransform: 'uppercase' }}>
              Yeni E-posta
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="yeni@ornek.com"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 13px', borderRadius: 9,
                border: `1.5px solid ${errors.email ? 'var(--red)' : 'var(--border)'}`,
                fontSize: 14, fontFamily: 'inherit', color: 'var(--text)', outline: 'none',
              }}
            />
            {errors.email && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>{errors.email}</div>}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={savingEmail || !newEmail.trim()}
            style={{ width: '100%' }}
          >
            {savingEmail ? '⏳ Gönderiliyor…' : '📧 Doğrulama E-postası Gönder'}
          </button>
        </form>
      ))}

      {/* Şifre Değiştir */}
      {section('Şifre Değiştir', '🔑', (
        <form onSubmit={handlePasswordUpdate}>
          {[
            { label: 'Yeni Şifre', key: 'password', val: newPassword, set: setNewPassword },
            { label: 'Şifreyi Tekrarla', key: 'confirmPw', val: confirmPw, set: setConfirmPw },
          ].map(({ label, key, val, set }) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 6, textTransform: 'uppercase' }}>
                {label}
              </label>
              <input
                type="password"
                value={val}
                onChange={e => set(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '10px 13px', borderRadius: 9,
                  border: `1.5px solid ${errors[key] ? 'var(--red)' : 'var(--border)'}`,
                  fontSize: 14, fontFamily: 'inherit', color: 'var(--text)', outline: 'none',
                }}
              />
              {errors[key] && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>{errors[key]}</div>}
            </div>
          ))}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={savingPw}
            style={{ width: '100%' }}
          >
            {savingPw ? '⏳ Kaydediliyor…' : '🔒 Şifreyi Güncelle'}
          </button>
        </form>
      ))}
    </div>
  );
}
