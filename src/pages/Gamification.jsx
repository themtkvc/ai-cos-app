import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getLeaderboard, getAllXPHistory, getAllBadges, getAllProfiles, getXPSettingsFull, updateXPSetting, getXPEventsByPeriod, getLeaderHistory, upsertLeaderHistory } from '../lib/supabase';

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
  daily_log_entry:  { icon: '📝', label: 'İş Kaydı Ekleme' },
  daily_log_hour:   { icon: '⏱️', label: 'Saat Başı Mesai' },
  daily_log_fullday:{ icon: '🌟', label: 'Tam Gün (8 saat)' },
  daily_log_overtime:{ icon: '🔥', label: 'Fazla Mesai (saat başı x2)' },
};

// ── Dönem Hesaplamaları ───────────────────────────────────────────────────
function getWeekRange(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const weekNum = getISOWeek(monday);
  return { start: monday, end: sunday, label: `${monday.getFullYear()}-W${String(weekNum).padStart(2, '0')}` };
}

function getMonthRange(date = new Date()) {
  const d = new Date(date);
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return { start, end, label };
}

function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

function formatPeriodLabel(type, label) {
  if (type === 'weekly') {
    // "2026-W13" → "13. Hafta, 2026"
    const [year, w] = label.split('-W');
    return `${parseInt(w)}. Hafta, ${year}`;
  }
  // "2026-03" → "Mart 2026"
  const [year, month] = label.split('-');
  return `${MONTHS_TR[parseInt(month) - 1]} ${year}`;
}

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
    <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
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
      background: earned ? 'var(--bg-card)' : 'var(--bg)',
      border: `1.5px solid ${earned ? '#6366f130' : 'var(--border)'}`,
      opacity: earned ? 1 : 0.45,
      minWidth: 100, position: 'relative',
      transition: 'all 0.2s',
    }}>
      <div style={{ fontSize: 32 }}>{badge.icon}</div>
      <div style={{
        fontSize: 11.5, fontWeight: 700, textAlign: 'center',
        color: earned ? 'var(--text)' : 'var(--text-muted)',
        lineHeight: 1.3,
      }}>
        {badge.name}
      </div>
      <div style={{
        fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3,
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
      border: `1.5px solid ${isMe ? '#6366f130' : 'var(--border)'}`,
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
  const [weeklyXP, setWeeklyXP] = useState({}); // user_id -> xp
  const [monthlyXP, setMonthlyXP] = useState({}); // user_id -> xp
  const [leaderHistoryList, setLeaderHistoryList] = useState([]);
  const [xpHistory, setXPHistory] = useState([]);
  const [allBadges, setAllBadges] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [xpSettings, setXpSettings] = useState([]);
  const [editingSettings, setEditingSettings] = useState({});
  const [savingAction, setSavingAction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('leaderboard');
  const [lbScope, setLbScope] = useState('all');
  const [lbPeriod, setLbPeriod] = useState('all'); // 'all' | 'weekly' | 'monthly'

  const myId = user?.id;
  const myUnit = profile?.unit;
  const isDirektor = profile?.role === 'direktor';
  const isPersonel = profile?.role === 'personel';

  const loadData = useCallback(async () => {
    setLoading(true);

    // Dönem aralıkları
    const week = getWeekRange();
    const month = getMonthRange();

    const [lbRes, profilesRes, badgesRes, settingsRes, histRes, weekRes, monthRes, leaderHistRes] = await Promise.all([
      getLeaderboard(),
      getAllProfiles(),
      getAllBadges(),
      getXPSettingsFull(),
      getAllXPHistory(200),
      getXPEventsByPeriod(week.start.toISOString(), week.end.toISOString()),
      getXPEventsByPeriod(month.start.toISOString(), month.end.toISOString()),
      getLeaderHistory(50),
    ]);

    setLeaderboard(lbRes.data || []);
    setProfiles(profilesRes.data || []);
    setAllBadges(badgesRes.data || []);
    setXpSettings(settingsRes.data || []);
    setXPHistory(histRes.data || []);
    setLeaderHistoryList(leaderHistRes.data || []);

    // Haftalık XP toplamları: user_id -> toplam
    const wMap = {};
    (weekRes.data || []).forEach(e => { wMap[e.user_id] = (wMap[e.user_id] || 0) + (e.xp_amount || 0); });
    setWeeklyXP(wMap);

    // Aylık XP toplamları
    const mMap = {};
    (monthRes.data || []).forEach(e => { mMap[e.user_id] = (mMap[e.user_id] || 0) + (e.xp_amount || 0); });
    setMonthlyXP(mMap);

    // Otomatik lider loglama: bu haftanın ve bu ayın lideri
    const allProfiles = profilesRes.data || [];
    const personelIds = new Set(allProfiles.filter(p => p.role === 'personel').map(p => p.user_id));

    // Haftalık lider
    const weekLeader = Object.entries(wMap)
      .filter(([uid]) => personelIds.has(uid))
      .sort((a, b) => b[1] - a[1])[0];
    if (weekLeader && weekLeader[1] > 0) {
      const wProfile = allProfiles.find(p => p.user_id === weekLeader[0]);
      try {
        await upsertLeaderHistory({
          period_type: 'weekly', period_start: week.start.toISOString().split('T')[0],
          period_end: week.end.toISOString().split('T')[0], period_label: week.label,
          user_id: weekLeader[0], user_name: wProfile?.full_name || '', user_unit: wProfile?.unit || null,
          total_xp: weekLeader[1],
        });
      } catch (e) { console.error('[LeaderHistory] weekly error:', e); }
    }

    // Aylık lider
    const monthLeader = Object.entries(mMap)
      .filter(([uid]) => personelIds.has(uid))
      .sort((a, b) => b[1] - a[1])[0];
    if (monthLeader && monthLeader[1] > 0) {
      const mProfile = allProfiles.find(p => p.user_id === monthLeader[0]);
      try {
        await upsertLeaderHistory({
          period_type: 'monthly', period_start: month.start.toISOString().split('T')[0],
          period_end: month.end.toISOString().split('T')[0], period_label: month.label,
          user_id: monthLeader[0], user_name: mProfile?.full_name || '', user_unit: mProfile?.unit || null,
          total_xp: monthLeader[1],
        });
      } catch (e) { console.error('[LeaderHistory] monthly error:', e); }
    }

    // Refresh leader history after upsert
    const freshHistory = await getLeaderHistory(50);
    setLeaderHistoryList(freshHistory.data || []);

    setLoading(false);
  }, [myId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Profil eşleştirme
  const profileMap = useMemo(() => {
    const m = {};
    (profiles || []).forEach(p => { m[p.user_id] = p; });
    return m;
  }, [profiles]);

  // Dönemsel leaderboard hesaplama
  const filteredLB = useMemo(() => {
    let items;
    if (lbPeriod === 'weekly') {
      // Haftalık: weeklyXP'den oluştur
      items = Object.entries(weeklyXP)
        .filter(([uid]) => profileMap[uid]?.role === 'personel')
        .map(([user_id, total_xp]) => ({ user_id, total_xp }))
        .sort((a, b) => b.total_xp - a.total_xp);
    } else if (lbPeriod === 'monthly') {
      items = Object.entries(monthlyXP)
        .filter(([uid]) => profileMap[uid]?.role === 'personel')
        .map(([user_id, total_xp]) => ({ user_id, total_xp }))
        .sort((a, b) => b.total_xp - a.total_xp);
    } else {
      // Tüm zamanlar: mevcut leaderboard
      items = leaderboard.filter(xp => profileMap[xp.user_id]?.role === 'personel');
    }
    if (lbScope === 'unit' && myUnit) {
      items = items.filter(xp => profileMap[xp.user_id]?.unit === myUnit);
    }
    return items;
  }, [leaderboard, profileMap, lbScope, lbPeriod, myUnit, weeklyXP, monthlyXP]);

  // Rozet kataloğu — direktör tüm rozet koleksiyonunu görür

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px' }}>
      {/* Özet Kartı — Direktör görünümü */}
      <div style={{
        background: 'linear-gradient(135deg, #6366f112 0%, #6366f106 100%)',
        border: '1.5px solid #6366f125',
        borderRadius: 18, padding: '24px 28px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 38 }}>🏆</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>
              Oyunlaştırma Paneli
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              Sistem arka planda çalışıyor — personeller bu sayfayı göremez
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Aktif Personel', value: filteredLB.length, icon: '👥' },
            { label: 'Toplam XP Dağıtıldı', value: `${filteredLB.reduce((s, x) => s + (x.total_xp || 0), 0).toLocaleString('tr-TR')}`, icon: '⚡' },
            { label: 'En Yüksek Seviye', value: filteredLB.length > 0 ? `Lv.${Math.max(...filteredLB.map(x => calculateLevel(x.total_xp || 0).level))}` : '—', icon: '🎯' },
            { label: 'Tanımlı Rozet', value: allBadges.length, icon: '🎖️' },
          ].map((s, i) => (
            <div key={i} style={{
              flex: '1 1 120px', padding: '10px 14px', borderRadius: 12,
              background: 'rgba(255,255,255,0.6)', textAlign: 'center',
            }}>
              <div style={{ fontSize: 14, marginBottom: 2 }}>{s.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sekme Başlıkları */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { id: 'leaderboard', label: '🏆 Liderlik Tablosu' },
          { id: 'badges', label: '🎖️ Rozetler' },
          { id: 'history', label: '📊 XP Geçmişi' },
          ...(isDirektor ? [{ id: 'settings', label: '⚙️ Puan Ayarları' }] : []),
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '8px 18px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
              border: `1.5px solid ${tab === t.id ? 'var(--navy)' : 'var(--border)'}`,
              background: tab === t.id ? 'var(--navy)' : 'var(--bg-card)',
              color: tab === t.id ? '#fff' : 'var(--text-secondary)',
              fontWeight: tab === t.id ? 700 : 500,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── LİDERLİK TABLOSU ── */}
      {tab === 'leaderboard' && (
        <div>
          {/* Dönem filtresi */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {[
              { id: 'weekly', label: '📅 Bu Hafta' },
              { id: 'monthly', label: '🗓️ Bu Ay' },
              { id: 'all', label: '🏆 Tüm Zamanlar' },
            ].map(p => (
              <button key={p.id} onClick={() => setLbPeriod(p.id)}
                style={{
                  padding: '6px 16px', borderRadius: 16, fontSize: 12.5, cursor: 'pointer',
                  border: `1.5px solid ${lbPeriod === p.id ? '#6366f1' : 'var(--border)'}`,
                  background: lbPeriod === p.id ? '#6366f1' : 'var(--bg-card, #fff)',
                  color: lbPeriod === p.id ? '#fff' : 'var(--text-muted)',
                  fontWeight: lbPeriod === p.id ? 700 : 500,
                }}>
                {p.label}
              </button>
            ))}
          </div>

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

          {/* Dönemin 1. sıradaki kişisi — vurgulu kart */}
          {filteredLB.length > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, var(--orange-pale) 0%, var(--orange-pale) 100%)',
              border: '1.5px solid var(--gold)40',
              borderRadius: 14, padding: '16px 20px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{ fontSize: 36 }}>👑</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {lbPeriod === 'weekly' ? 'Haftanın Lideri' : lbPeriod === 'monthly' ? 'Ayın Lideri' : 'Genel Lider'}
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#78350f', marginTop: 2 }}>
                  {profileMap[filteredLB[0].user_id]?.full_name || 'Bilinmiyor'}
                </div>
                <div style={{ fontSize: 12, color: '#92400e', marginTop: 1 }}>
                  {profileMap[filteredLB[0].user_id]?.unit || '—'}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#b45309' }}>
                  {filteredLB[0].total_xp.toLocaleString('tr-TR')}
                </div>
                <div style={{ fontSize: 10, color: '#92400e', fontWeight: 600 }}>XP</div>
              </div>
            </div>
          )}

          {filteredLB.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-muted)' }}>
                {lbPeriod === 'weekly' ? 'Bu hafta henüz XP kazanılmadı' : lbPeriod === 'monthly' ? 'Bu ay henüz XP kazanılmadı' : 'Henüz sıralama yok'}
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

          {/* ── GEÇMİŞ LİDERLER ── */}
          {leaderHistoryList.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span>📜</span> Geçmiş Liderler
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {leaderHistoryList.map((lh) => (
                  <div key={lh.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    borderRadius: 12, background: 'var(--bg-card, #fff)',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: lh.period_type === 'weekly' ? 'var(--blue-pale)' : 'var(--orange-pale)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16,
                    }}>
                      {lh.period_type === 'weekly' ? '📅' : '🗓️'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                        {lh.user_name || 'Bilinmiyor'}
                        {lh.user_unit && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>({lh.user_unit})</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {formatPeriodLabel(lh.period_type, lh.period_label)}
                      </div>
                    </div>
                    <div style={{
                      padding: '3px 10px', borderRadius: 16, fontSize: 12, fontWeight: 800,
                      color: lh.period_type === 'weekly' ? 'var(--primary)' : 'var(--gold)',
                      background: lh.period_type === 'weekly' ? 'var(--primary-light)' : 'var(--orange-pale)',
                    }}>
                      {lh.total_xp.toLocaleString('tr-TR')} XP
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ROZETLER ── */}
      {tab === 'badges' && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Sistemde tanımlı {allBadges.length} rozet — otomatik olarak koşullar sağlandığında verilir
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
                    <BadgeCard key={b.id} badge={b} earned={true} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── XP GEÇMİŞİ ── */}
      {tab === 'history' && (
        <div>
          {xpHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-muted)' }}>
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
                      border: '1px solid var(--border)',
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
                    border: '1px solid var(--border)',
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
                        <span style={{ color: '#6366f1', fontWeight: 700 }}>{profileMap[event.user_id]?.full_name || '?'}</span>
                        {' — '}{event.description || meta.label}
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

      {/* ── PUAN AYARLARI ── */}
      {tab === 'settings' && isDirektor && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Her bir işlem için verilecek XP puanını buradan düzenleyebilirsiniz. Değişiklikler hemen yürürlüğe girer.
          </div>

          {/* Kategorilere göre grupla */}
          {['task', 'social', 'network', 'dailylog', 'general'].map(cat => {
            const catSettings = xpSettings.filter(s => s.category === cat);
            if (catSettings.length === 0) return null;
            const catLabel = cat === 'task' ? '📋 Görev & Gündem'
              : cat === 'social' ? '💬 Sosyal & İşbirliği'
              : cat === 'network' ? '🕸️ Network'
              : cat === 'dailylog' ? '📝 İş Kaydı'
              : '📌 Genel';
            return (
              <div key={cat} style={{ marginBottom: 24 }}>
                <div style={{
                  fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10,
                }}>
                  {catLabel}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {catSettings.map(setting => {
                    const meta = ACTION_META[setting.action] || { icon: setting.icon || '🔵', label: setting.label || setting.action };
                    const isEditing = editingSettings[setting.action] !== undefined;
                    const tempVal = editingSettings[setting.action];
                    const isSaving = savingAction === setting.action;

                    return (
                      <div key={setting.action} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                        borderRadius: 12, background: 'var(--bg-card)',
                        border: `1.5px solid ${isEditing ? '#6366f130' : 'var(--border)'}`,
                      }}>
                        <div style={{ fontSize: 22, flexShrink: 0 }}>{setting.icon || meta.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{setting.label || meta.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{setting.action}</div>
                        </div>

                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="number" min="0" max="999"
                              value={tempVal}
                              onChange={(e) => setEditingSettings(prev => ({ ...prev, [setting.action]: parseInt(e.target.value) || 0 }))}
                              style={{
                                width: 70, padding: '5px 8px', borderRadius: 8, fontSize: 14, fontWeight: 800,
                                border: '1.5px solid #6366f1', textAlign: 'center', outline: 'none',
                                color: '#6366f1', background: '#eef2ff',
                              }}
                              autoFocus
                            />
                            <button disabled={isSaving} onClick={async () => {
                              setSavingAction(setting.action);
                              await updateXPSetting(setting.action, tempVal);
                              setXpSettings(prev => prev.map(s => s.action === setting.action ? { ...s, xp_amount: tempVal } : s));
                              setEditingSettings(prev => { const n = { ...prev }; delete n[setting.action]; return n; });
                              setSavingAction(null);
                            }} style={{
                              padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                              background: '#22c55e', color: '#fff', border: 'none', cursor: 'pointer',
                            }}>
                              {isSaving ? '...' : '✓'}
                            </button>
                            <button onClick={() => setEditingSettings(prev => { const n = { ...prev }; delete n[setting.action]; return n; })}
                              style={{
                                padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                                background: 'var(--bg-badge)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer',
                              }}>
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              padding: '4px 14px', borderRadius: 16, fontSize: 14, fontWeight: 800,
                              color: '#6366f1', background: '#eef2ff',
                            }}>
                              +{setting.xp_amount} XP
                            </span>
                            <button onClick={() => setEditingSettings(prev => ({ ...prev, [setting.action]: setting.xp_amount }))}
                              style={{
                                padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                                background: 'var(--bg)', color: 'var(--text-muted)',
                                border: '1px solid var(--border)', cursor: 'pointer',
                              }}>
                              Düzenle
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div style={{
            padding: '12px 16px', borderRadius: 10, fontSize: 12,
            background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', marginTop: 8,
          }}>
            💡 Not: Fazla mesai (daily_log_overtime) değeri, 8 saat sonrası her bir saat için x2 olarak uygulanır.
          </div>
        </div>
      )}
    </div>
  );
}
