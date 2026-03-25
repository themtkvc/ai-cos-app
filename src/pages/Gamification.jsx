import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getLeaderboard, getUserXP, getUserXPHistory, getAllBadges, getUserBadges, getAllProfiles, XP_VALUES } from '../lib/supabase';

// ── Seviye Hesaplama ──────────────────────────────────────────────────────────
function calculateLevel(totalXp) {
  let level = 0;
  let xpNeeded = 0;
  while (xpNeeded + (level + 1) * 50 <= totalXp) {
    level++;
    xpNeeded += level * 50;
  }
  return { level, xpInLevel: totalXp - xpNeeded, xpForNext: (level + 1) * 50 };
}

// ── Seviye Renkleri ───────────────────────────────────────────────────────────
function levelColor(level) {
  if (level >= 20) return { color: '#f59e0b', bg: '#fffbeb', label: 'Altın' };
  if (level >= 15) return { color: '#a855f7', bg: '#faf5ff', label: 'Elmas' };
  if (level >= 10) return { color: '#6366f1', bg: '#eef2ff', label: 'Platin' };
  if (level >= 5) return { color: '#3b82f6', bg: '#eff6ff', label: 'Gümüş' };
  return { color: '#22c55e', bg: '#f0fdf4', label: 'Bronz' };
}

// ── XP Etkinlik İkonları ──────────────────────────────────────────────────────
const ACTION_META = {
  task_complete:    { icon: '✅', label: 'Görev Tamamlama' },
  agenda_create:    { icon: '📋', label: 'Gündem Oluşturma' },
  on_time_bonus:    { icon: '⏰', label: 'Zamanında Tamamlama' },
  comment:          { icon: '💬', label: 'Yorum Yazma' },
  collaboration:    { icon: '🤝', label: 'İşbirliği' },
  network_contact:  { icon: '👤', label: 'Kişi Ekleme' },
  network_org:      { icon: '🏢', label: 'Kurum Ekleme' },
  network_event:    { icon: '📅', label: 'Etkinlik Ekleme' },
  fund_opportunity: { icon: '💰', label: 'Fon Fırsatı' },
};

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} saat önce`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} gün önce`;
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

// ── XP Bar Bileşeni ──────────────────────────────────────────────────────────
function XPBar({ current, max, color = '#6366f1' }) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  return (
    <div style={{ width: '100%', height: 8, borderRadius: 4, background: '#e5e7eb', overflow: 'hidden' }}>
      <div style={{
        width: `${pct}%`, height: '100%', borderRadius: 4,
        background: `linear-gradient(90deg, ${color}, ${color}cc)`,
        transition: 'width 0.5s ease',
      }} />
    </div>
  );
}

// ── Rozet Kartı ──────────────────────────────────────────────────────────────
function BadgeCard({ badge, earned = false }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      padding: '14px 10px', borderRadius: 14,
      background: earned ? 'var(--bg-card, #fff)' : 'var(--bg, #f9fafb)',
      border: `1.5px solid ${earned ? '#6366f130' : 'var(--border, #e5e7eb)'}`,
      opacity: earned ? 1 : 0.45,
      minWidth: 100, position: 'relative',
      transition: 'all 0.2s',
    }}>
      <div style={{ fontSize: 32 }}>{badge.icon}</div>
      <div style={{
        fontSize: 11.5, fontWeight: 700, textAlign: 'center',
        color: earned ? 'var(--text, #111827)' : 'var(--text-muted, #9ca3af)',
        lineHeight: 1.3,
      }}>
        {badge.name}
      </div>
      <div style={{
        fontSize: 10, color: 'var(--text-muted, #9ca3af)', textAlign: 'center', lineHeight: 1.3,
      }}>
        {badge.description}
      </div>
      {earned && (
        <div style={{
          position: 'absolute', top: 6, right: 6,
          width: 14, height: 14, borderRadius: '50%',
          background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 8, color: '#fff', fontWeight: 700,
        }}>✓</div>
      )}
    </div>
  );
}

// ── Liderlik Tablosu Satırı ─────────────────────────────────────────────────
function LeaderboardRow({ rank, profile, xpData, isMe }) {
  const lvl = calculateLevel(xpData?.total_xp || 0);
  const lc = levelColor(lvl.level);
  const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
  const initial = (profile?.full_name?.[0] || '?').toUpperCase();

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
      borderRadius: 12, background: isMe ? '#eef2ff' : 'var(--bg-card, #fff)',
      border: `1.5px solid ${isMe ? '#6366f130' : 'var(--border, #e5e7eb)'}`,
      transition: 'all 0.15s',
    }}>
      {/* Sıra */}
      <div style={{
        width: 36, textAlign: 'center', fontSize: rank <= 3 ? 20 : 14,
        fontWeight: 800, color: rank <= 3 ? undefined : 'var(--text-muted)',
      }}>
        {rankEmoji}
      </div>

      {/* Avatar */}
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          onError={(e) => { e.target.style.display = 'none'; }} />
      ) : (
        <div style={{
          width: 36, height: 36, borderRadius: '50%', background: '#6366f1', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, flexShrink: 0,
        }}>{initial}</div>
      )}

      {/* İsim & Birim */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {profile?.full_name || 'Bilinmiyor'}
          {isMe && <span style={{ fontSize: 10, color: '#6366f1', marginLeft: 6 }}>(Sen)</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {profile?.unit || '—'}
        </div>
      </div>

      {/* Seviye */}
      <div style={{
        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
        color: lc.color, background: lc.bg,
      }}>
        Lv.{lvl.level}
      </div>

      {/* XP */}
      <div style={{ textAlign: 'right', minWidth: 60 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>
          {(xpData?.total_xp || 0).toLocaleString('tr-TR')}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>XP</div>
      </div>
    </div>
  );
}

// ── ANA BİLEŞEN ─────────────────────────────────────────────────────────────
export default function Gamification({ user, profile }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [myXP, setMyXP] = useState(null);
  const [xpHistory, setXPHistory] = useState([]);
  const [allBadges, setAllBadges] = useState([]);
  const [myBadges, setMyBadges] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('leaderboard'); // 'leaderboard' | 'badges' | 'history'
  const [lbScope, setLbScope] = useState('all'); // 'all' | 'unit'

  const myId = user?.id;
  const myUnit = profile?.unit;
  const isPersonel = profile?.role === 'personel';

  const loadData = useCallback(async () => {
    setLoading(true);
    const [lbRes, profilesRes, badgesRes] = await Promise.all([
      getLeaderboard(),
      getAllProfiles(),
      getAllBadges(),
    ]);

    setLeaderboard(lbRes.data || []);
    setProfiles(profilesRes.data || []);
    setAllBadges(badgesRes.data || []);

    if (myId) {
      const [xpRes, histRes, myBadgesRes] = await Promise.all([
        getUserXP(myId),
        getUserXPHistory(myId, 50),
        getUserBadges(myId),
      ]);
      setMyXP(xpRes.data);
      setXPHistory(histRes.data || []);
      setMyBadges(myBadgesRes.data || []);
    }
    setLoading(false);
  }, [myId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Profil eşleştirme
  const profileMap = useMemo(() => {
    const m = {};
    (profiles || []).forEach(p => { m[p.user_id] = p; });
    return m;
  }, [profiles]);

  // Sadece personel olan kullanıcıları leaderboard'da göster
  const filteredLB = useMemo(() => {
    let items = leaderboard.filter(xp => {
      const p = profileMap[xp.user_id];
      return p?.role === 'personel';
    });
    if (lbScope === 'unit' && myUnit) {
      items = items.filter(xp => profileMap[xp.user_id]?.unit === myUnit);
    }
    return items;
  }, [leaderboard, profileMap, lbScope, myUnit]);

  // Benim kazandığım rozetlerin ID'leri
  const earnedBadgeIds = useMemo(() => {
    return new Set(myBadges.map(ub => ub.badge_id));
  }, [myBadges]);

  // Seviye bilgisi
  const lvl = calculateLevel(myXP?.total_xp || 0);
  const lc = levelColor(lvl.level);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px' }}>
      {/* Profil Kartı */}
      {isPersonel && myXP && (
        <div style={{
          background: `linear-gradient(135deg, ${lc.color}12 0%, ${lc.color}06 100%)`,
          border: `1.5px solid ${lc.color}25`,
          borderRadius: 18, padding: '24px 28px', marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            {/* Avatar */}
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }}
                onError={(e) => { e.target.style.display = 'none'; }} />
            ) : (
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: lc.color, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 700,
              }}>
                {(profile?.full_name?.[0] || '?').toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>
                {profile?.full_name || 'Kullanıcı'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <span style={{
                  padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                  color: lc.color, background: lc.bg, border: `1px solid ${lc.color}30`,
                }}>
                  Lv.{lvl.level} {lc.label}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  {(myXP?.total_xp || 0).toLocaleString('tr-TR')} XP
                </span>
              </div>
            </div>
            {/* Rozet sayısı */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: lc.color }}>{myBadges.length}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600 }}>ROZET</div>
            </div>
          </div>

          {/* XP Bar */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sonraki seviye</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: lc.color }}>
                {lvl.xpInLevel} / {lvl.xpForNext} XP
              </span>
            </div>
            <XPBar current={lvl.xpInLevel} max={lvl.xpForNext} color={lc.color} />
          </div>

          {/* Hızlı istatistikler */}
          <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
            {[
              { label: 'Liderlik Sırası', value: (() => { const idx = filteredLB.findIndex(x => x.user_id === myId); return idx >= 0 ? `#${idx + 1}` : '—'; })() },
              { label: 'Bu Hafta', value: `+${xpHistory.filter(e => new Date(e.created_at) > new Date(Date.now() - 7 * 86400000)).reduce((s, e) => s + (e.xp_amount || 0), 0)} XP` },
              { label: 'Toplam Etkinlik', value: xpHistory.length },
            ].map((s, i) => (
              <div key={i} style={{
                flex: '1 1 100px', padding: '8px 12px', borderRadius: 10,
                background: 'rgba(255,255,255,0.6)', textAlign: 'center',
              }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sekme Başlıkları */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { id: 'leaderboard', label: '🏆 Liderlik Tablosu' },
          ...(isPersonel ? [
            { id: 'badges', label: '🎖️ Rozetler' },
            { id: 'history', label: '📊 XP Geçmişi' },
          ] : []),
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '8px 18px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
              border: `1.5px solid ${tab === t.id ? 'var(--navy, #1a3a5c)' : 'var(--border, #e5e7eb)'}`,
              background: tab === t.id ? 'var(--navy, #1a3a5c)' : 'var(--bg-card, #fff)',
              color: tab === t.id ? '#fff' : 'var(--text, #374151)',
              fontWeight: tab === t.id ? 700 : 500,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── LİDERLİK TABLOSU ── */}
      {tab === 'leaderboard' && (
        <div>
          {/* Kapsam filtresi */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {[
              { id: 'all', label: '🌐 Tüm Departman' },
              ...(myUnit ? [{ id: 'unit', label: `🏢 ${myUnit}` }] : []),
            ].map(s => (
              <button key={s.id} onClick={() => setLbScope(s.id)}
                style={{
                  padding: '5px 14px', borderRadius: 16, fontSize: 12, cursor: 'pointer',
                  border: `1px solid ${lbScope === s.id ? '#6366f1' : 'var(--border)'}`,
                  background: lbScope === s.id ? '#eef2ff' : 'transparent',
                  color: lbScope === s.id ? '#6366f1' : 'var(--text-muted)',
                  fontWeight: lbScope === s.id ? 700 : 400,
                }}>
                {s.label}
              </button>
            ))}
          </div>

          {filteredLB.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text, #6b7280)' }}>
                Henüz sıralama yok
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                Görevleri tamamlayarak XP kazanın ve liderlik tablosunda yerinizi alın!
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredLB.map((xp, idx) => (
                <LeaderboardRow
                  key={xp.user_id}
                  rank={idx + 1}
                  profile={profileMap[xp.user_id]}
                  xpData={xp}
                  isMe={xp.user_id === myId}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ROZETLER ── */}
      {tab === 'badges' && isPersonel && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            {myBadges.length} / {allBadges.length} rozet kazanıldı
          </div>

          {/* Kategori grupları */}
          {['milestone', 'level', 'special'].map(cat => {
            const catBadges = allBadges.filter(b => b.category === cat);
            if (catBadges.length === 0) return null;
            const catLabel = cat === 'milestone' ? '🎯 Kilometre Taşları' : cat === 'level' ? '⭐ Seviye Rozetleri' : '✨ Özel Rozetler';
            return (
              <div key={cat} style={{ marginBottom: 24 }}>
                <div style={{
                  fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12,
                }}>
                  {catLabel}
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: 10,
                }}>
                  {catBadges.map(b => (
                    <BadgeCard key={b.id} badge={b} earned={earnedBadgeIds.has(b.id)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── XP GEÇMİŞİ ── */}
      {tab === 'history' && isPersonel && (
        <div>
          {xpHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text, #6b7280)' }}>
                Henüz XP geçmişi yok
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                Görevleri tamamlayarak XP kazanmaya başlayın!
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* XP Dağılım Özeti */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 8, marginBottom: 16,
              }}>
                {Object.entries(
                  xpHistory.reduce((acc, e) => {
                    acc[e.action] = (acc[e.action] || 0) + (e.xp_amount || 0);
                    return acc;
                  }, {})
                ).sort((a, b) => b[1] - a[1]).map(([action, total]) => {
                  const meta = ACTION_META[action] || { icon: '🔵', label: action };
                  return (
                    <div key={action} style={{
                      padding: '10px 12px', borderRadius: 12,
                      background: 'var(--bg-card, #fff)',
                      border: '1px solid var(--border, #e5e7eb)',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span style={{ fontSize: 18 }}>{meta.icon}</span>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{total} XP</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{meta.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Etkinlik listesi */}
              {xpHistory.map((event, i) => {
                const meta = ACTION_META[event.action] || { icon: '🔵', label: event.action };
                return (
                  <div key={event.id || i} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    borderRadius: 10, background: 'var(--bg-card, #fff)',
                    border: '1px solid var(--border, #e5e7eb)',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: '#6366f112', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, flexShrink: 0,
                    }}>
                      {meta.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {event.description || meta.label}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {meta.label} · {timeAgo(event.created_at)}
                      </div>
                    </div>
                    <div style={{
                      padding: '3px 10px', borderRadius: 16, fontSize: 12, fontWeight: 800,
                      color: '#22c55e', background: '#f0fdf4',
                    }}>
                      +{event.xp_amount} XP
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* XP Bilgi Tablosu (tüm roller görebilir) */}
      {tab === 'leaderboard' && (
        <div style={{
          marginTop: 28, padding: '18px 20px', borderRadius: 14,
          background: 'var(--bg-card, #fff)',
          border: '1px solid var(--border, #e5e7eb)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
            ℹ️ XP Kazanım Tablosu
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
            {Object.entries(XP_VALUES).map(([action, xp]) => {
              const meta = ACTION_META[action] || { icon: '🔵', label: action };
              return (
                <div key={action} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                  borderRadius: 8, background: 'var(--bg, #f9fafb)',
                }}>
                  <span style={{ fontSize: 16 }}>{meta.icon}</span>
                  <span style={{ fontSize: 12, flex: 1 }}>{meta.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#6366f1' }}>+{xp}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
