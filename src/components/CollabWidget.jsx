import React, { useEffect, useState } from 'react';
import { getCollabDashboardData, COLLAB_STATUSES } from '../lib/supabase';
import { UNITS, resolveUnitName, fmtDisplayDate } from '../lib/constants';

/**
 * Dashboard'a eklenen işbirlikleri özet widget'ı.
 *
 * Gösterir:
 *  - KPI: aktif, planlanan, bu ay başlayan, tamamlanan
 *  - Yaklaşan bitişler / MoU'nun süresi dolanlar
 *  - Birim dağılımı (mini chart)
 *
 *  Tıklandığında onNavigate('collaborations') veya
 *  onNavigate('collaborations', { collabId }) çağrılır.
 */
export default function CollabWidget({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await getCollabDashboardData();
      if (cancelled) return;
      if (!res.error) setData(res);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={box}>
        <div style={{ fontSize: 13, opacity: 0.6 }}>İşbirlikleri yükleniyor…</div>
      </div>
    );
  }
  if (!data) return null;

  const { stats, upcoming = [], recent = [] } = data;
  const totalBudget = stats.budgetByCcy || {};

  return (
    <div style={box}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
        paddingBottom: 10, borderBottom: '1px solid var(--border, rgba(0,0,0,0.08))',
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, flex: 1 }}>🤝 İşbirlikleri Özeti</div>
        <button
          onClick={() => onNavigate && onNavigate('collaborations')}
          style={linkBtn}
        >Tümü →</button>
      </div>

      {/* KPI grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
        gap: 8, marginBottom: 12,
      }}>
        <Kpi label="Aktif" value={stats.active || 0} color="#0ea5e9" />
        <Kpi label="Planlanıyor" value={stats.planning || 0} color="#a855f7" />
        <Kpi label="Bu Ay Başlayan" value={stats.thisMonth || 0} color="#22c55e" />
        <Kpi label="Tamamlanan" value={stats.completed || 0} color="#64748b" />
      </div>

      {/* Bütçe rozetleri */}
      {Object.keys(totalBudget).length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {Object.entries(totalBudget).map(([ccy, amt]) => {
            const sym = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' }[ccy] || ccy;
            return (
              <span key={ccy} style={{
                fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 12,
                background: 'rgba(99,102,241,0.1)', color: '#4338ca',
              }}>{sym}{Number(amt).toLocaleString('tr-TR')}</span>
            );
          })}
        </div>
      )}

      {/* Birim dağılımı */}
      {stats.byUnit && Object.keys(stats.byUnit).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', opacity: 0.6, marginBottom: 6 }}>
            BİRİM DAĞILIMI
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {Object.entries(stats.byUnit)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([unitName, count]) => {
                const u = UNITS.find(x => x.name === resolveUnitName(unitName));
                const max = Math.max(...Object.values(stats.byUnit));
                const pct = max > 0 ? (count / max) * 100 : 0;
                return (
                  <div key={unitName} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 11.5, width: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u?.icon || '🏛'} {unitName}
                    </div>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-soft, rgba(0,0,0,0.05))', overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`, height: '100%',
                        background: u?.color || '#6366f1',
                      }} />
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, width: 28, textAlign: 'right' }}>{count}</div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Yaklaşanlar */}
      {upcoming.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', opacity: 0.6, marginBottom: 6 }}>
            ⚠️ YAKLAŞAN BİTİŞ / MOU SÜRESİ
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {upcoming.slice(0, 5).map(r => (
              <div
                key={r.id}
                onClick={() => onNavigate && onNavigate('collaborations', { collabId: r.id })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                  borderRadius: 6, cursor: 'pointer', fontSize: 12,
                  border: '1px solid var(--border, rgba(0,0,0,0.08))',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-soft, rgba(0,0,0,0.03))'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.title}
                </span>
                <span style={{ fontSize: 11, opacity: 0.7 }}>
                  {fmtDisplayDate(r.mou_expires_at || r.end_date)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Son eklenenler */}
      {recent.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', opacity: 0.6, marginBottom: 6 }}>
            SON EKLENENLER
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recent.slice(0, 4).map(r => {
              const s = COLLAB_STATUSES.find(x => x.id === r.status);
              return (
                <div
                  key={r.id}
                  onClick={() => onNavigate && onNavigate('collaborations', { collabId: r.id })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                    borderRadius: 6, cursor: 'pointer', fontSize: 12,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-soft, rgba(0,0,0,0.03))'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.title}
                  </span>
                  {s && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
                      background: `${s.color}20`, color: s.color,
                    }}>{s.label}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, color }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 10,
      background: `${color}15`,
      border: `1px solid ${color}40`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', opacity: 0.75, color }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

const box = {
  padding: 16, borderRadius: 12,
  background: 'var(--bg, #fff)',
  border: '1px solid var(--border, rgba(0,0,0,0.1))',
};

const linkBtn = {
  fontSize: 12, fontWeight: 700, cursor: 'pointer',
  padding: '5px 10px', borderRadius: 6,
  border: '1px solid var(--border, rgba(0,0,0,0.15))',
  background: 'transparent', color: 'var(--navy, #1a3a5c)',
};
