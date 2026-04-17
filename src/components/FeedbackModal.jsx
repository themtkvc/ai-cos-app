import React, { useState, useEffect, useRef } from 'react';
import { createFeedbackTicket, uploadFeedbackScreenshot } from '../lib/supabase';
import { ROLE_LABELS } from '../lib/constants';

// Feedback type katalogu — endüstri standardı
export const FEEDBACK_TYPES = [
  { id: 'bug',         label: 'Hata / Bug',       emoji: '🐞', desc: 'Çalışmayan veya yanlış davranış' },
  { id: 'feature',     label: 'Yeni Özellik',     emoji: '✨', desc: 'Yeni bir özellik veya modül talebi' },
  { id: 'improvement', label: 'İyileştirme',      emoji: '⚡', desc: 'Mevcut özelliği daha iyi yapma' },
  { id: 'fix',         label: 'Düzeltme Talebi',  emoji: '🔧', desc: 'Küçük düzeltme / ince ayar' },
  { id: 'question',    label: 'Soru',             emoji: '❓', desc: 'Nasıl kullanılır veya açıklama talebi' },
  { id: 'other',       label: 'Diğer',            emoji: '💬', desc: 'Yukarıdakilere uymayan' },
];

export const FEEDBACK_SEVERITIES = [
  { id: 'low',      label: 'Düşük',    color: '#64748b' },
  { id: 'medium',   label: 'Orta',     color: '#3b82f6' },
  { id: 'high',     label: 'Yüksek',   color: '#f59e0b' },
  { id: 'critical', label: 'Kritik',   color: '#ef4444' },
];

// Sayfa id → okunur başlık (App.jsx'deki PAGE_TITLES'a paralel)
const PAGE_TITLE_MAP = {
  dashboard: 'Dashboard', chat: 'AI Asistan', agendas: 'Gündemler',
  donors: 'Donör CRM', meetings: 'Toplantı Logu', reports: 'Birim Raporları',
  dailylog: 'İş Kayıtları', logsviewer: 'Kayıt Dashboard', analytics: 'Çalışma Analizi',
  donations: 'Bağış Takip', orgchart: 'Org Şeması', network: 'Network',
  networkanalytics: 'Network Analiz', notes: 'Notlarım', documents: 'Dokümanlar',
  notifications: 'Bildirimler', funds: 'Fon Fırsatları', forms: 'Formlar',
  gamification: 'Oyunlaştırma', events: 'Etkinlikler', capacity: 'Kapasite Geliştirme',
  direktor_agendas: 'Direktör Gündemleri', goals: 'Hedefler', policy: 'Politikalar ve Yönetişim',
  profile: 'Profil', admin: 'Admin', feedback: 'Geri Bildirim',
  activities: 'Aktiviteler', emails: 'Mailler',
};

function captureContext() {
  const hash = (window.location.hash || '').replace('#', '').trim();
  const pageId = hash.split('/')[0] || 'dashboard';
  const pageTitle = PAGE_TITLE_MAP[pageId] || pageId;
  return {
    page_path: window.location.pathname + window.location.hash,
    page_id: pageId,
    page_title: pageTitle,
    route_params: hash.includes('/') ? { raw: hash } : null,
    user_agent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    screen_resolution: `${window.screen.width}x${window.screen.height}`,
    timestamp_client: new Date().toISOString(),
  };
}

// html2canvas lazy import — sadece ihtiyaç duyulduğunda yüklenir
async function takeScreenshot() {
  try {
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(document.body, {
      useCORS: true,
      allowTaint: true,
      logging: false,
      scale: Math.min(window.devicePixelRatio || 1, 1.5),
      // Feedback modalını ekran görüntüsüne dahil etme
      ignoreElements: (el) => el.hasAttribute && el.hasAttribute('data-feedback-skip'),
    });
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch (e) {
    console.warn('screenshot failed:', e);
    return null;
  }
}

export default function FeedbackModal({ user, profile, onClose, onSubmitted }) {
  const [type, setType] = useState('bug');
  const [severity, setSeverity] = useState('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [screenshot, setScreenshot] = useState(null); // dataURL
  const [capturingShot, setCapturingShot] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [context] = useState(captureContext);
  const descRef = useRef(null);

  useEffect(() => {
    // Aç açmaz ekran görüntüsü al (modal gözükmeden önce tetiklenmişti, biz gene de deneriz)
    let cancelled = false;
    if (includeScreenshot && !screenshot) {
      setCapturingShot(true);
      // Modal render'dan sonra 120ms bekle ki modal DOM'u skip edilsin
      const t = setTimeout(async () => {
        const shot = await takeScreenshot();
        if (!cancelled) {
          setScreenshot(shot);
          setCapturingShot(false);
        }
      }, 120);
      return () => { cancelled = true; clearTimeout(t); };
    }
  }, [includeScreenshot]); // eslint-disable-line

  const handleRetakeShot = async () => {
    setCapturingShot(true);
    const shot = await takeScreenshot();
    setScreenshot(shot);
    setCapturingShot(false);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!title.trim()) { setError('Başlık gerekli'); return; }
    if (!description.trim()) { setError('Açıklama gerekli'); return; }
    if (!user?.id) { setError('Oturum bulunamadı'); return; }
    setSubmitting(true); setError('');
    try {
      let screenshotUrl = null;
      if (includeScreenshot && screenshot) {
        try {
          screenshotUrl = await uploadFeedbackScreenshot(screenshot, user.id);
        } catch (e) {
          console.warn('screenshot upload failed:', e);
        }
      }
      const payload = {
        reporter_id: user.id,
        reporter_name: profile?.full_name || user?.email || '',
        reporter_email: user?.email || null,
        reporter_role: profile?.role || null,
        reporter_unit: profile?.unit || null,
        type,
        severity,
        title: title.trim(),
        description: description.trim(),
        page_path: context.page_path,
        page_id: context.page_id,
        page_title: context.page_title,
        route_params: context.route_params,
        user_agent: context.user_agent,
        viewport: context.viewport,
        screen_resolution: context.screen_resolution,
        timestamp_client: context.timestamp_client,
        screenshot_url: screenshotUrl,
        status: 'new',
      };
      const { error: insertErr } = await createFeedbackTicket(payload);
      if (insertErr) throw insertErr;
      onSubmitted && onSubmitted();
      onClose && onClose();
    } catch (e) {
      console.error(e);
      setError(e.message || 'Gönderilirken hata oluştu');
    } finally {
      setSubmitting(false);
    }
  };

  const typeObj = FEEDBACK_TYPES.find(t => t.id === type);

  return (
    <div
      data-feedback-skip="1"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(15,30,46,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        backdropFilter: 'blur(2px)',
      }}
    >
      <div style={{
        background: 'var(--bg, #fff)', color: 'var(--text, #0f1e2e)',
        borderRadius: 14, width: '100%', maxWidth: 680, maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
        border: '1px solid var(--border, rgba(0,0,0,0.1))',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border, rgba(0,0,0,0.08))',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ fontSize: 22 }}>💬</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Geri Bildirim Gönder</div>
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>
              Sayfa: <b>{context.page_title}</b> · {context.viewport}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              background: 'transparent', border: 'none', fontSize: 20,
              cursor: submitting ? 'not-allowed' : 'pointer', opacity: 0.6,
              color: 'inherit',
            }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {/* Type seçimi */}
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tür</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8, marginBottom: 18 }}>
            {FEEDBACK_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                type="button"
                style={{
                  textAlign: 'left', padding: '10px 12px', borderRadius: 10,
                  border: type === t.id ? '2px solid var(--navy, #1a3a5c)' : '1.5px solid var(--border, rgba(0,0,0,0.12))',
                  background: type === t.id ? 'rgba(26,58,92,0.08)' : 'transparent',
                  cursor: 'pointer', color: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600 }}>{t.emoji} {t.label}</div>
                <div style={{ fontSize: 11.5, opacity: 0.65, marginTop: 2 }}>{t.desc}</div>
              </button>
            ))}
          </div>

          {/* Severity */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Önem:</div>
            {FEEDBACK_SEVERITIES.map(s => (
              <button
                key={s.id}
                onClick={() => setSeverity(s.id)}
                type="button"
                style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 12.5, fontWeight: 600,
                  border: severity === s.id ? `2px solid ${s.color}` : '1.5px solid var(--border, rgba(0,0,0,0.15))',
                  background: severity === s.id ? s.color : 'transparent',
                  color: severity === s.id ? '#fff' : 'inherit',
                  cursor: 'pointer',
                }}
              >{s.label}</button>
            ))}
          </div>

          {/* Başlık */}
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Başlık</div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={typeObj ? `Kısa ve net bir başlık (ör. "${typeObj.label} – ...")` : 'Başlık'}
            maxLength={180}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px',
              borderRadius: 8, border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
              background: 'var(--bg, #fff)', color: 'inherit',
              fontSize: 14, fontFamily: 'inherit', marginBottom: 14, outline: 'none',
            }}
          />

          {/* Açıklama */}
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Açıklama</div>
          <textarea
            ref={descRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={type === 'bug'
              ? 'Ne yapmaya çalışıyordunuz? Ne oldu? Ne olmasını bekliyordunuz? Tekrar oluşturma adımları…'
              : 'Detaylı açıklama yazın. İhtiyaç, beklenti, öneri, örnek senaryo…'
            }
            rows={6}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px',
              borderRadius: 8, border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
              background: 'var(--bg, #fff)', color: 'inherit',
              fontSize: 14, fontFamily: 'inherit', marginBottom: 14,
              outline: 'none', resize: 'vertical', minHeight: 120,
            }}
          />

          {/* Screenshot */}
          <div style={{
            border: '1.5px dashed var(--border, rgba(0,0,0,0.15))',
            borderRadius: 10, padding: 12, marginBottom: 14,
            background: 'var(--bg-soft, rgba(0,0,0,0.015))',
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeScreenshot}
                onChange={(e) => setIncludeScreenshot(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              📸 Ekran görüntüsünü ekle
            </label>
            {includeScreenshot && (
              <div style={{ marginTop: 10 }}>
                {capturingShot ? (
                  <div style={{ fontSize: 12.5, opacity: 0.7 }}>📷 Yakalanıyor…</div>
                ) : screenshot ? (
                  <div>
                    <img
                      src={screenshot}
                      alt="Screenshot preview"
                      style={{
                        maxWidth: '100%', maxHeight: 180, objectFit: 'contain',
                        borderRadius: 6, border: '1px solid var(--border, rgba(0,0,0,0.12))',
                        display: 'block', marginBottom: 6,
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleRetakeShot}
                      style={{
                        fontSize: 12, padding: '4px 10px', borderRadius: 6,
                        border: '1px solid var(--border, rgba(0,0,0,0.15))',
                        background: 'transparent', color: 'inherit', cursor: 'pointer',
                      }}
                    >🔄 Yeniden al</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleRetakeShot}
                    style={{
                      fontSize: 12.5, padding: '6px 12px', borderRadius: 6,
                      border: '1px solid var(--border, rgba(0,0,0,0.15))',
                      background: 'transparent', color: 'inherit', cursor: 'pointer',
                    }}
                  >📸 Şimdi al</button>
                )}
              </div>
            )}
          </div>

          {/* Context preview */}
          <details style={{ fontSize: 12, marginBottom: 8 }}>
            <summary style={{ cursor: 'pointer', opacity: 0.7, userSelect: 'none' }}>
              🛈 Otomatik toplanan bilgiler ({Object.keys(context).length} alan)
            </summary>
            <div style={{
              marginTop: 8, padding: 10, borderRadius: 6,
              background: 'var(--bg-soft, rgba(0,0,0,0.03))',
              border: '1px solid var(--border, rgba(0,0,0,0.08))',
              fontFamily: 'ui-monospace, monospace', fontSize: 11, lineHeight: 1.55,
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {Object.entries(context).map(([k, v]) => (
                <div key={k}><b>{k}:</b> {typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '')}</div>
              ))}
              <div><b>reporter:</b> {profile?.full_name || user?.email} ({ROLE_LABELS?.[profile?.role] || profile?.role || '—'})</div>
              {profile?.unit && <div><b>unit:</b> {profile.unit}</div>}
            </div>
          </details>

          {error && (
            <div style={{
              padding: '9px 13px', borderRadius: 8, fontSize: 12.5, marginTop: 4,
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#dc2626',
            }}>⚠️ {error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid var(--border, rgba(0,0,0,0.08))',
          display: 'flex', gap: 10, justifyContent: 'flex-end',
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '9px 18px', borderRadius: 8,
              border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
              background: 'transparent', color: 'inherit',
              fontSize: 13, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >İptal</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !description.trim()}
            style={{
              padding: '9px 18px', borderRadius: 8, border: 'none',
              background: submitting ? 'rgba(0,0,0,0.25)' : 'var(--navy, #1a3a5c)',
              color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? '⏳ Gönderiliyor…' : '📤 Gönder'}
          </button>
        </div>
      </div>
    </div>
  );
}
