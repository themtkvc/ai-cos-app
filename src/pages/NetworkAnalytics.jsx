import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getNetworkAll, getAllProfiles } from '../lib/supabase';
import { avatarColor, fmtDisplayDate } from '../lib/constants';

// ── SABİTLER ─────────────────────────────────────────────────────────────────
const ORG_TYPES = [
  { value: 'ngo',        label: 'STK / NGO',      icon: '🏢' },
  { value: 'donor',      label: 'Donör',           icon: '💰' },
  { value: 'government', label: 'Kamu / Hükümet',  icon: '🏛' },
  { value: 'un_agency',  label: 'BM Ajansı',       icon: '🌐' },
  { value: 'private',    label: 'Özel Sektör',     icon: '🏭' },
  { value: 'academic',   label: 'Akademik',        icon: '🎓' },
  { value: 'media',      label: 'Medya',           icon: '📰' },
  { value: 'other',      label: 'Diğer',           icon: '📁' },
];
const EVENT_TYPES = [
  { value: 'conference', label: 'Konferans',  icon: '🎤' },
  { value: 'meeting',    label: 'Toplantı',   icon: '🤝' },
  { value: 'workshop',   label: 'Workshop',   icon: '🔧' },
  { value: 'training',   label: 'Eğitim',     icon: '📚' },
  { value: 'forum',      label: 'Forum',      icon: '🏛' },
  { value: 'visit',      label: 'Ziyaret',    icon: '✈️' },
  { value: 'other',      label: 'Diğer',      icon: '📅' },
];
const COUNTRIES = [
  { value:'Türkiye',    flag:'🇹🇷' }, { value:'ABD',        flag:'🇺🇸' },
  { value:'Almanya',    flag:'🇩🇪' }, { value:'İngiltere',  flag:'🇬🇧' },
  { value:'Fransa',     flag:'🇫🇷' }, { value:'Hollanda',   flag:'🇳🇱' },
  { value:'İsviçre',    flag:'🇨🇭' }, { value:'Belçika',    flag:'🇧🇪' },
  { value:'İsveç',      flag:'🇸🇪' }, { value:'Norveç',     flag:'🇳🇴' },
  { value:'Kanada',     flag:'🇨🇦' }, { value:'Japonya',    flag:'🇯🇵' },
  { value:'Avustralya', flag:'🇦🇺' }, { value:'İtalya',     flag:'🇮🇹' },
];
const getFlag = (c) => COUNTRIES.find(x => x.value === c)?.flag || '🌍';

const PROCESS_STAGES = [
  { value:'İlk Temas',            color:'#9ca3af', icon:'📞', bg:'#f9fafb' },
  { value:'İletişim Geliştirme',  color:'#3b82f6', icon:'💬', bg:'#eff6ff' },
  { value:'İşbirliği Görüşmesi',  color:'#f59e0b', icon:'🤝', bg:'#fffbeb' },
  { value:'Aktif İşbirliği',      color:'#10b981', icon:'✅', bg:'#ecfdf5' },
  { value:'Pasif / Beklemede',    color:'#6b7280', icon:'⏸️', bg:'#f3f4f6' },
];
const PRIORITY_OPTIONS = [
  { value:'Kritik',  emoji:'🔴', color:'#ef4444', bg:'#fef2f2' },
  { value:'Yüksek',  emoji:'🟠', color:'#f97316', bg:'#fff7ed' },
  { value:'Orta',    emoji:'🟡', color:'#eab308', bg:'#fefce8' },
  { value:'Düşük',   emoji:'🟢', color:'#22c55e', bg:'#f0fdf4' },
];

// ── YARDIMCI FONKSİYONLAR ───────────────────────────────────────────────────
function Avatar({ name = '', size = 32 }) {
  const color = avatarColor(name);
  const init = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: color, color: 'white', fontWeight: 700, fontSize: size * 0.36,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{init}</div>
  );
}

function StatCard({ icon, label, value, sub, accent = '#6366f1' }) {
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 16, padding: '20px 22px',
      border: '1px solid var(--border)', flex: '1 1 0',
      minWidth: 170, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -14, right: -14, width: 64, height: 64,
        borderRadius: '50%', background: accent + '12',
      }} />
      <div style={{ fontSize: 26, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--text-light)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ items, colorMap }) {
  const total = items.reduce((s, i) => s + i.count, 0);
  if (!total) return <div style={{ fontSize: 12, color: 'var(--text-light)' }}>Veri yok</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Stacked bar */}
      <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--bg-badge)' }}>
        {items.filter(i => i.count > 0).map((i, idx) => (
          <div key={idx} style={{
            width: `${(i.count / total) * 100}%`,
            background: colorMap[i.label] || 'var(--text-light)',
            transition: 'width 0.3s',
          }} title={`${i.label}: ${i.count}`} />
        ))}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
        {items.filter(i => i.count > 0).map((i, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: colorMap[i.label] || 'var(--text-light)' }} />
            <span style={{ color: 'var(--text-muted)' }}>{i.label}</span>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{i.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutChart({ data, size = 130 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-light)', fontSize: 12 }}>Veri yok</div>;
  const cx = size / 2, cy = size / 2, r = size * 0.38, sw = size * 0.18;
  let cumAngle = -Math.PI / 2;
  const arcs = data.filter(d => d.value > 0).map(d => {
    const angle = (d.value / total) * Math.PI * 2;
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;
    const largeArc = angle > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    return { ...d, path: `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}` };
  });
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        {arcs.map((a, i) => (
          <path key={i} d={a.path} fill="none" stroke={a.color} strokeWidth={sw}
            strokeLinecap="butt" />
        ))}
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{total}</div>
        <div style={{ fontSize: 10, color: 'var(--text-light)', fontWeight: 600 }}>TOPLAM</div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title, sub }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span> {title}
      </h2>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Panel({ children, style = {} }) {
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 16, padding: '22px 24px',
      border: '1px solid var(--border)', ...style,
    }}>{children}</div>
  );
}

// ── TIMELINE BİLEŞENİ ────────────────────────────────────────────────────────
function TimelineChart({ events }) {
  const months = useMemo(() => {
    const now = new Date();
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' });
      const count = events.filter(e => e.event_date && e.event_date.startsWith(key)).length;
      result.push({ key, label, count });
    }
    return result;
  }, [events]);
  const max = Math.max(...months.map(m => m.count), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
      {months.map(m => (
        <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>{m.count || ''}</span>
          <div style={{
            width: '100%', maxWidth: 40, borderRadius: '6px 6px 0 0',
            background: m.count > 0 ? 'linear-gradient(180deg, var(--primary), #818cf8)' : 'var(--bg-badge)',
            height: `${Math.max((m.count / max) * 70, 4)}px`,
            transition: 'height 0.3s',
          }} />
          <span style={{ fontSize: 10, color: 'var(--text-light)' }}>{m.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── İLİŞKİ AĞI TABLOSU ──────────────────────────────────────────────────────
function ConnectionMatrix({ contacts, organizations, events, connections }) {
  const entityMap = useMemo(() => {
    const map = {};
    contacts.forEach(c => { map[`contact-${c.id}`] = { type: 'contact', name: c.full_name, icon: '👤' }; });
    organizations.forEach(o => { map[`organization-${o.id}`] = { type: 'org', name: o.name, icon: '🏢' }; });
    events.forEach(e => { map[`event-${e.id}`] = { type: 'event', name: e.name, icon: '📅' }; });
    return map;
  }, [contacts, organizations, events]);

  // En bağlantılı 15 entity
  const ranked = useMemo(() => {
    const counts = {};
    connections.forEach(c => {
      const sk = `${c.source_type}-${c.source_id}`;
      const tk = `${c.target_type}-${c.target_id}`;
      counts[sk] = (counts[sk] || 0) + 1;
      counts[tk] = (counts[tk] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([key, count]) => ({ key, count, entity: entityMap[key] }))
      .filter(e => e.entity)
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [connections, entityMap]);

  if (!ranked.length) return <div style={{ color: 'var(--text-light)', fontSize: 13, textAlign: 'center', padding: 20 }}>Henüz bağlantı verisi yok</div>;

  const maxCount = ranked[0]?.count || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {ranked.map((r, i) => (
        <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-light)', width: 18, textAlign: 'right', fontWeight: 600 }}>#{i + 1}</span>
          <span style={{ fontSize: 14 }}>{r.entity.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.entity.name}
            </div>
            <div style={{
              height: 5, borderRadius: 3, marginTop: 3,
              background: `linear-gradient(90deg, var(--primary), #a5b4fc)`,
              width: `${(r.count / maxCount) * 100}%`,
              transition: 'width 0.4s',
            }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)', minWidth: 24, textAlign: 'right' }}>{r.count}</span>
        </div>
      ))}
    </div>
  );
}

// ── DETAY TABLO BİLEŞENLERİ ──────────────────────────────────────────────────
function ContactsTable({ contacts, organizations, onSelect }) {
  const orgMap = useMemo(() => {
    const m = {};
    organizations.forEach(o => { m[o.id] = o.name; });
    return m;
  }, [organizations]);

  const getStage = (v) => PROCESS_STAGES.find(s => s.value === v) || PROCESS_STAGES[0];
  const getPrio = (v) => PRIORITY_OPTIONS.find(p => p.value === v) || PRIORITY_OPTIONS[2];

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: 'var(--bg-hover)' }}>
            {['Kişi', 'Kurum', 'Ülke', 'Süreç Aşaması', 'Öncelik', 'Takip Sorumlusu', 'İlk İletişim', 'Bağlantı'].map(h => (
              <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '2px solid var(--border)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {contacts.map(c => {
            const stage = getStage(c.process_stage);
            const prio = getPrio(c.priority);
            return (
              <tr key={c.id} onClick={() => onSelect?.(c)} style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-hover)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={c.full_name} size={28} />
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{c.full_name}</div>
                      {c.position && <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{c.position}</div>}
                    </div>
                  </div>
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-hover)', color: 'var(--text-secondary)' }}>
                  {orgMap[c.organization_id] || '—'}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-hover)' }}>
                  {c.country ? <span>{getFlag(c.country)} {c.country}</span> : <span style={{ color: 'var(--gray-mid)' }}>—</span>}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-hover)' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 10px', borderRadius: 20,
                    background: stage.bg, color: stage.color, fontSize: 11, fontWeight: 600,
                  }}>{stage.icon} {stage.value}</span>
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-hover)' }}>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                    background: prio.bg, color: prio.color, fontSize: 11, fontWeight: 600,
                  }}>{prio.emoji} {prio.value}</span>
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 12 }}>
                  {c.assigned_to_name || <span style={{ color: 'var(--gray-mid)' }}>—</span>}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-hover)', color: 'var(--text-muted)', fontSize: 12 }}>
                  {c.first_contact_date ? fmtDisplayDate(c.first_contact_date) : <span style={{ color: 'var(--gray-mid)' }}>—</span>}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-hover)', textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}>
                  {c._connCount || 0}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OrgsTable({ organizations }) {
  const getOrgType = (v) => ORG_TYPES.find(t => t.value === v) || { label: v || 'Diğer', icon: '📁' };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: 'var(--bg-hover)' }}>
            {['Kurum Adı', 'Tür', 'Birim', 'Takip Sorumlusu', 'Kişi Sayısı', 'Bağlantı'].map(h => (
              <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '2px solid var(--border)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {organizations.map(o => {
            const ot = getOrgType(o.org_type);
            return (
              <tr key={o.id} style={{ transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-hover)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{ot.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{o.name}</div>
                      {o.website && <div style={{ fontSize: 11, color: 'var(--primary)' }}>{o.website}</div>}
                    </div>
                  </div>
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-hover)' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 20, background: 'var(--bg-badge)', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{ot.label}</span>
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 12 }}>{o.unit || '—'}</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 12 }}>{o.assigned_to_name || '—'}</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-hover)', fontWeight: 700, color: 'var(--text)', textAlign: 'center' }}>{o._contactCount || 0}</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-hover)', fontWeight: 700, color: 'var(--primary)', textAlign: 'center' }}>{o._connCount || 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EventsTable({ events }) {
  const getEvType = (v) => EVENT_TYPES.find(t => t.value === v) || { label: v || 'Diğer', icon: '📅' };
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: 'var(--bg-hover)' }}>
            {['Etkinlik', 'Tür', 'Tarih', 'Konum', 'Takip Sorumlusu', 'Katılımcılar', 'Bağlantı'].map(h => (
              <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '2px solid var(--border)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map(ev => {
            const et = getEvType(ev.event_type);
            const isPast = ev.event_date && ev.event_date < today;
            const isToday = ev.event_date === today;
            return (
              <tr key={ev.id} style={{ transition: 'background 0.15s', opacity: isPast ? 0.6 : 1 }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-hover)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{et.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{ev.name}</div>
                      {ev.drive_url && <a href={ev.drive_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--orange)' }}>📁 Drive</a>}
                    </div>
                  </div>
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-hover)' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 20, background: 'var(--bg-badge)', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{et.label}</span>
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-hover)', whiteSpace: 'nowrap' }}>
                  {isToday && <span style={{ background: 'var(--green-pale)', color: 'var(--green)', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, marginRight: 4 }}>BUGÜN</span>}
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{ev.event_date ? fmtDisplayDate(ev.event_date) : '—'}</span>
                  {ev.end_date && ev.end_date !== ev.event_date && <span style={{ color: 'var(--text-light)', fontSize: 11 }}> → {fmtDisplayDate(ev.end_date)}</span>}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 12 }}>{ev.location || '—'}</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 12 }}>{ev.assigned_to_name || '—'}</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-hover)', fontWeight: 700, color: 'var(--text)', textAlign: 'center' }}>{ev._participantCount || 0}</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-hover)', fontWeight: 700, color: 'var(--primary)', textAlign: 'center' }}>{ev._connCount || 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── ANA BİLEŞEN ─────────────────────────────────────────────────────────────
export default function NetworkAnalytics({ user, profile }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // overview | contacts | orgs | events | connections

  const isDirektor = profile?.role === 'direktor';

  const loadData = useCallback(async () => {
    setLoading(true);
    const result = await getNetworkAll();
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── İSTATİSTİK HESAPLAMA ────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!data) return null;
    const { contacts, organizations, events, connections } = data;

    // Bağlantı sayıları entity'lere ekle
    const connCounts = {};
    connections.forEach(c => {
      const sk = `${c.source_type}-${c.source_id}`;
      const tk = `${c.target_type}-${c.target_id}`;
      connCounts[sk] = (connCounts[sk] || 0) + 1;
      connCounts[tk] = (connCounts[tk] || 0) + 1;
    });

    const contactsEnriched = contacts.map(c => ({
      ...c,
      _connCount: connCounts[`contact-${c.id}`] || 0,
    }));
    const orgsEnriched = organizations.map(o => ({
      ...o,
      _contactCount: contacts.filter(c => c.organization_id === o.id).length,
      _connCount: connCounts[`organization-${o.id}`] || 0,
    }));
    const eventsEnriched = events.map(e => ({
      ...e,
      _connCount: connCounts[`event-${e.id}`] || 0,
      _participantCount: connections.filter(c =>
        (c.source_type === 'event' && c.source_id === e.id) ||
        (c.target_type === 'event' && c.target_id === e.id)
      ).length,
    }));

    // Süreç aşaması dağılımı
    const stageDist = PROCESS_STAGES.map(s => ({
      label: s.value, count: contacts.filter(c => c.process_stage === s.value).length,
    }));
    const stageColorMap = {};
    PROCESS_STAGES.forEach(s => { stageColorMap[s.value] = s.color; });

    // Öncelik dağılımı
    const prioDist = PRIORITY_OPTIONS.map(p => ({
      label: p.value, count: contacts.filter(c => c.priority === p.value).length,
    }));
    const prioColorMap = {};
    PRIORITY_OPTIONS.forEach(p => { prioColorMap[p.value] = p.color; });

    // Kurum türü dağılımı
    const orgTypeDist = ORG_TYPES.map(t => ({
      label: t.label, value: organizations.filter(o => o.org_type === t.value).length,
      color: ['#6366f1','#ec4899','#f59e0b','#3b82f6','#10b981','#8b5cf6','#ef4444','#6b7280'][ORG_TYPES.indexOf(t)],
    })).filter(d => d.value > 0);

    // Etkinlik türü dağılımı
    const evTypeDist = EVENT_TYPES.map(t => ({
      label: t.label, value: events.filter(e => e.event_type === t.value).length,
      color: ['#6366f1','#10b981','#f59e0b','#3b82f6','#8b5cf6','#ec4899','#6b7280'][EVENT_TYPES.indexOf(t)],
    })).filter(d => d.value > 0);

    // Ülke dağılımı
    const countryMap = {};
    contacts.forEach(c => { if (c.country) countryMap[c.country] = (countryMap[c.country] || 0) + 1; });
    const countryDist = Object.entries(countryMap)
      .sort((a, b) => b[1] - a[1])
      .map(([country, count]) => ({ country, count, flag: getFlag(country) }));

    // Takip sorumlusu dağılımı
    const assigneeMap = {};
    [...contacts, ...organizations, ...events].forEach(item => {
      if (item.assigned_to_name) assigneeMap[item.assigned_to_name] = (assigneeMap[item.assigned_to_name] || 0) + 1;
    });
    const assigneeDist = Object.entries(assigneeMap).sort((a, b) => b[1] - a[1]);

    // Bugünün tarihi
    const today = new Date().toISOString().slice(0, 10);
    const upcomingEvents = events.filter(e => e.event_date && e.event_date >= today)
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
    const pastEvents = events.filter(e => e.event_date && e.event_date < today);

    // Yeni kişiler (son 30 gün)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentContacts = contacts.filter(c => c.created_at && c.created_at > thirtyDaysAgo);

    // Atanmamış (takip sorumlusu olmayan)
    const unassignedContacts = contacts.filter(c => !c.assigned_to);
    const unassignedOrgs = organizations.filter(o => !o.assigned_to);

    return {
      contacts: contactsEnriched,
      organizations: orgsEnriched,
      events: eventsEnriched,
      connections,
      stageDist, stageColorMap,
      prioDist, prioColorMap,
      orgTypeDist, evTypeDist,
      countryDist, assigneeDist,
      upcomingEvents, pastEvents,
      recentContacts,
      unassignedContacts, unassignedOrgs,
    };
  }, [data]);

  if (!isDirektor) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-muted)', fontSize: 15 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)', marginBottom: 4 }}>Erişim Kısıtlı</div>
          <div>Bu sayfa yalnızca Direktör rolüne açıktır.</div>
        </div>
      </div>
    );
  }

  if (loading || !stats) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  const TABS = [
    { id: 'overview',    label: 'Genel Bakış',    icon: '📊' },
    { id: 'contacts',    label: `Kişiler (${stats.contacts.length})`,        icon: '👤' },
    { id: 'orgs',        label: `Kurumlar (${stats.organizations.length})`,  icon: '🏢' },
    { id: 'events',      label: `Etkinlikler (${stats.events.length})`,      icon: '📅' },
    { id: 'connections', label: `İlişki Ağı (${stats.connections.length})`,  icon: '🔗' },
  ];

  return (
    <div style={{ padding: '0 0 40px', maxWidth: 1400, margin: '0 auto' }}>
      {/* HEADER */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
        borderRadius: '0 0 24px 24px', padding: '32px 36px 24px',
        marginBottom: 24, color: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 28 }}>🔬</span> Network Analiz
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, opacity: 0.7 }}>
              Kişi, kurum ve etkinlik ağınızın 360° analizi
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 18px', textAlign: 'center', backdropFilter: 'blur(8px)' }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{stats.contacts.length}</div>
              <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 600 }}>Kişi</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 18px', textAlign: 'center', backdropFilter: 'blur(8px)' }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{stats.organizations.length}</div>
              <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 600 }}>Kurum</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 18px', textAlign: 'center', backdropFilter: 'blur(8px)' }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{stats.events.length}</div>
              <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 600 }}>Etkinlik</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 18px', textAlign: 'center', backdropFilter: 'blur(8px)' }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{stats.connections.length}</div>
              <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 600 }}>Bağlantı</div>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: 4, marginTop: 20, overflowX: 'auto' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '9px 18px', borderRadius: '10px 10px 0 0', border: 'none', cursor: 'pointer',
                fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
                background: activeTab === tab.id ? 'var(--bg-card)' : 'rgba(255,255,255,0.08)',
                color: activeTab === tab.id ? 'var(--text)' : 'rgba(255,255,255,0.7)',
                transition: 'all 0.2s',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB İÇERİĞİ */}
      <div style={{ padding: '0 24px' }}>
        {activeTab === 'overview' && (
          <OverviewTab stats={stats} />
        )}
        {activeTab === 'contacts' && (
          <Panel>
            <SectionTitle icon="👤" title="Tüm Kişiler" sub={`${stats.contacts.length} kişi kayıtlı`} />
            <ContactsTable contacts={stats.contacts} organizations={stats.organizations} />
          </Panel>
        )}
        {activeTab === 'orgs' && (
          <Panel>
            <SectionTitle icon="🏢" title="Tüm Kurumlar" sub={`${stats.organizations.length} kurum kayıtlı`} />
            <OrgsTable organizations={stats.organizations} />
          </Panel>
        )}
        {activeTab === 'events' && (
          <Panel>
            <SectionTitle icon="📅" title="Tüm Etkinlikler" sub={`${stats.events.length} etkinlik kayıtlı`} />
            <EventsTable events={stats.events} />
          </Panel>
        )}
        {activeTab === 'connections' && (
          <Panel>
            <SectionTitle icon="🔗" title="İlişki Ağı Haritası" sub={`${stats.connections.length} bağlantı tespit edildi`} />
            <ConnectionMatrix
              contacts={stats.contacts}
              organizations={stats.organizations}
              events={stats.events}
              connections={stats.connections}
            />
          </Panel>
        )}
      </div>
    </div>
  );
}

// ── GENEL BAKIŞ SEKMESİ ──────────────────────────────────────────────────────
function OverviewTab({ stats }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* UYARI BANNER */}
      {(stats.unassignedContacts.length > 0 || stats.unassignedOrgs.length > 0) && (
        <div style={{
          background: 'linear-gradient(135deg, var(--orange-pale), #fde68a)', border: '1px solid var(--orange)',
          borderRadius: 14, padding: '14px 20px',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 22 }}>⚠️</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 700, color: 'var(--orange)', fontSize: 13 }}>Atanmamış Kayıtlar</div>
            <div style={{ fontSize: 12, color: 'var(--orange)' }}>
              {stats.unassignedContacts.length > 0 && `${stats.unassignedContacts.length} kişi`}
              {stats.unassignedContacts.length > 0 && stats.unassignedOrgs.length > 0 && ' ve '}
              {stats.unassignedOrgs.length > 0 && `${stats.unassignedOrgs.length} kurum`}
              {' '}takip sorumlusu atanmamış.
            </div>
          </div>
        </div>
      )}

      {/* ÜST İSTATİSTİK KARTLARI */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <StatCard icon="👤" label="Toplam Kişi" value={stats.contacts.length}
          sub={stats.recentContacts.length > 0 ? `+${stats.recentContacts.length} son 30 gün` : null}
          accent="#6366f1" />
        <StatCard icon="🏢" label="Toplam Kurum" value={stats.organizations.length}
          accent="#ec4899" />
        <StatCard icon="📅" label="Etkinlik" value={stats.events.length}
          sub={stats.upcomingEvents.length > 0 ? `${stats.upcomingEvents.length} yaklaşan` : null}
          accent="#f59e0b" />
        <StatCard icon="🔗" label="Bağlantı" value={stats.connections.length}
          accent="#10b981" />
        <StatCard icon="✅" label="Aktif İşbirliği" value={stats.contacts.filter(c => c.process_stage === 'Aktif İşbirliği').length}
          accent="#22c55e" />
      </div>

      {/* ORTA PANEL GRID — 3 sütun */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {/* Süreç Aşaması Pipeline */}
        <Panel>
          <SectionTitle icon="📞" title="Süreç Aşaması Pipeline" sub="Kişilerin süreç dağılımı" />
          <MiniBar items={stats.stageDist} colorMap={stats.stageColorMap} />
          <div style={{ marginTop: 14 }}>
            {PROCESS_STAGES.map(s => {
              const count = stats.contacts.filter(c => c.process_stage === s.value).length;
              return (
                <div key={s.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--bg-badge)' }}>
                  <span style={{ fontSize: 16 }}>{s.icon}</span>
                  <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 500 }}>{s.value}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{count}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Öncelik Dağılımı */}
        <Panel>
          <SectionTitle icon="🎯" title="Öncelik Dağılımı" sub="Kişilerin öncelik seviyesi" />
          <MiniBar items={stats.prioDist} colorMap={stats.prioColorMap} />
          <div style={{ marginTop: 14 }}>
            {PRIORITY_OPTIONS.map(p => {
              const count = stats.contacts.filter(c => c.priority === p.value).length;
              return (
                <div key={p.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--bg-badge)' }}>
                  <span style={{ fontSize: 16 }}>{p.emoji}</span>
                  <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 500 }}>{p.value}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: p.color }}>{count}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Kurum Türü Dağılımı */}
        <Panel>
          <SectionTitle icon="🏢" title="Kurum Türleri" sub="Kurum tipi dağılımı" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <DonutChart data={stats.orgTypeDist} size={120} />
            <div style={{ flex: 1 }}>
              {stats.orgTypeDist.map(d => (
                <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{d.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {/* ALT PANEL GRID — 2 sütun */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
        {/* Ülke Dağılımı */}
        <Panel>
          <SectionTitle icon="🌍" title="Ülke Dağılımı" sub="Kişilerin coğrafi dağılımı" />
          {stats.countryDist.length === 0 ? (
            <div style={{ color: 'var(--text-light)', fontSize: 13, textAlign: 'center', padding: 16 }}>Ülke verisi girilmemiş</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {stats.countryDist.map(c => {
                const maxC = stats.countryDist[0]?.count || 1;
                return (
                  <div key={c.country} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                    <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{c.flag}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', minWidth: 80 }}>{c.country}</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--bg-badge)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        background: 'linear-gradient(90deg, #6366f1, #818cf8)',
                        width: `${(c.count / maxC) * 100}%`,
                      }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)', minWidth: 24, textAlign: 'right' }}>{c.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Etkinlik Timeline */}
        <Panel>
          <SectionTitle icon="📅" title="Etkinlik Takvimi" sub="Son 6 ay etkinlik yoğunluğu" />
          <TimelineChart events={stats.events} />
          {stats.upcomingEvents.length > 0 && (
            <div style={{ marginTop: 16, borderTop: '1px solid var(--bg-badge)', paddingTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>YAKLAŞAN ETKİNLİKLER</div>
              {stats.upcomingEvents.slice(0, 4).map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--bg-hover)' }}>
                  <span style={{ fontSize: 14 }}>📅</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{e.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{e.location || 'Konum belirtilmemiş'}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{fmtDisplayDate(e.event_date)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* EN ALT SATIR — 2 sütun */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
        {/* Takip Sorumlusu Dağılımı */}
        <Panel>
          <SectionTitle icon="👥" title="Takip Sorumlusu Dağılımı" sub="Kim kaç kayıttan sorumlu?" />
          {stats.assigneeDist.length === 0 ? (
            <div style={{ color: 'var(--text-light)', fontSize: 13, textAlign: 'center', padding: 16 }}>Atama yapılmamış</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {stats.assigneeDist.map(([name, count]) => {
                const maxA = stats.assigneeDist[0]?.[1] || 1;
                return (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                    <Avatar name={name} size={26} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', minWidth: 100 }}>{name}</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--bg-badge)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        background: 'linear-gradient(90deg, #ec4899, #f9a8d4)',
                        width: `${(count / maxA) * 100}%`,
                      }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)', minWidth: 24, textAlign: 'right' }}>{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Bağlantı Ağı Sıralaması */}
        <Panel>
          <SectionTitle icon="🔗" title="En Bağlantılı Kayıtlar" sub="İlişki ağındaki en aktif entityler" />
          <ConnectionMatrix
            contacts={stats.contacts}
            organizations={stats.organizations}
            events={stats.events}
            connections={stats.connections}
          />
        </Panel>
      </div>
    </div>
  );
}
