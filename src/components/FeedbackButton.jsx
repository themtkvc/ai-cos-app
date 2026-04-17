import React, { useState } from 'react';
import FeedbackModal from './FeedbackModal';

// Her sayfada sağ-altta yüzen geri bildirim ikonu.
// Direktör için AI chat butonu zaten bottom:24 right:24 yerini tuttuğu için,
// direktörde butonu yukarıya (bottom:96) kaydırıyoruz.
export default function FeedbackButton({ user, profile }) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);

  if (!user) return null;

  const isDirektor = profile?.role === 'direktor';
  const bottomOffset = isDirektor ? 96 : 24;

  return (
    <>
      {!open && (
        <button
          data-feedback-skip="1"
          onClick={() => setOpen(true)}
          title="Geri Bildirim Gönder"
          aria-label="Geri Bildirim Gönder"
          style={{
            position: 'fixed', bottom: bottomOffset, right: 24, zIndex: 9998,
            width: 48, height: 48, borderRadius: '50%', border: 'none',
            background: '#fff',
            color: '#1a3a5c',
            fontSize: 22, cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            border2: '1.5px solid rgba(0,0,0,0.06)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.25)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.18)'; }}
        >
          💬
        </button>
      )}
      {open && (
        <FeedbackModal
          user={user}
          profile={profile}
          onClose={() => setOpen(false)}
          onSubmitted={() => {
            setToast('Geri bildiriminiz alındı, teşekkür ederiz!');
            setTimeout(() => setToast(null), 4000);
          }}
        />
      )}
      {toast && (
        <div
          data-feedback-skip="1"
          style={{
            position: 'fixed', bottom: bottomOffset + 60, right: 24, zIndex: 10001,
            padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: '#16a34a', color: '#fff',
            boxShadow: '0 6px 24px rgba(22,163,74,0.35)',
            maxWidth: 280,
          }}
        >✅ {toast}</div>
      )}
    </>
  );
}
