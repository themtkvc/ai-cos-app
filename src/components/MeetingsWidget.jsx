import React, { useEffect, useState } from 'react';
import { getMeetings } from '../lib/supabase';

const box = {
  background: 'var(--card-bg, #fff)',
  border: '1px solid var(--border, #e2e8f0)',
  borderRadius: 12,
  padding: 16,
};

const fmt = (iso) => {
  const d = new Date(iso);
  return d.toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const relMin = (iso) => {
  const diffMs = new Date(iso).getTime() - Date.now();
  const min = Math.round(diffMs / 60000);
  if (min < 0) return `${Math.abs(min)} dk önce başladı`;
  if (min < 60) return `${min} dk sonra`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} saat sonra`;
  return `${Math.round(hr/24)} gün sonra`;
};

export default function MeetingsWidget({ user, profile, onNavigate }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await getMeetings({ upcoming: true, limit: 5 });
      if (cancelled) return;
      setRows(data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div style={box}><div style={{ fontSize: 13, opacity: 0.6 }}>Toplantılar yükleniyor…</div></div>;
  }

  return (
    <div style={box}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="section-dot blue" style={{ width: 8, height: 8, borderRadius: '50%', background: '#0ea5e9', display: 'inline-block' }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text, #0f172a)' }}>Yaklaşan Toplantılar</span>
        </div>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => onNavigate && onNavigate('meetings')}
          style={{ fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >Tümü →</button>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: '8px 0', fontSize: 13, color: 'var(--muted, #64748b)', fontStyle: 'italic' }}>
          Önümüzdeki günler için planlanmış toplantı yok.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(m => {
            const attCount = m.attendees?.length || 0;
            const diffMin = (new Date(m.starts_at).getTime() - Date.now()) / 60000;
            const isSoon = diffMin > 0 && diffMin < 60;
            return (
              <div
                key={m.id}
                onClick={() => onNavigate && onNavigate('meetings')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: 10, border: '1px solid var(--border, #e2e8f0)', borderRadius: 8,
                  cursor: 'pointer', background: isSoon ? '#fef3c7' : '#fff',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isSoon && '⏰ '}{m.title || 'Başlıksız toplantı'}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted, #64748b)' }}>
                    🕒 {fmt(m.starts_at)} · {relMin(m.starts_at)} · 👥 {attCount}
                    {m.collab?.title ? ` · 🤝 ${m.collab.title}` : ''}
                  </div>
                </div>
                {m.meet_url && (
                  <a
                    href={m.meet_url}
                    target="_blank" rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{
                      padding: '6px 12px', background: '#0f172a', color: '#fff',
                      borderRadius: 6, fontSize: 12, fontWeight: 700, textDecoration: 'none',
                    }}
                  >🎥 Katıl</a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
