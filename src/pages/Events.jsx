import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import EventDetail from './EventDetail';

// ── Sabitler ─────────────────────────────────────────────────────────────────
export const EVENT_TYPES = {
  conference:       { label: 'Konferans',        color: '#7C3AED', bg: '#F5F3FF' },
  training:         { label: 'Eğitim',            color: '#0369A1', bg: '#E0F2FE' },
  field_visit:      { label: 'Saha Ziyareti',     color: '#047857', bg: '#ECFDF5' },
  summit:           { label: 'Zirve',             color: '#B45309', bg: '#FFFBEB' },
  internal_meeting: { label: 'İç Toplantı',       color: '#4B5563', bg: '#F3F4F6' },
  workshop:         { label: 'Çalıştay',          color: '#BE185D', bg: '#FDF2F8' },
  forum:            { label: 'Forum',             color: '#1D4ED8', bg: '#EFF6FF' },
  other:            { label: 'Diğer',             color: '#6B7280', bg: '#F9FAFB' },
};

export const EVENT_STATUS = {
  planned:   { label: 'Planlandı',  color: '#6B7280', bg: '#F3F4F6' },
  ongoing:   { label: 'Devam Ediyor', color: '#D97706', bg: '#FFFBEB' },
  completed: { label: 'Tamamlandı', color: '#059669', bg: '#ECFDF5' },
  cancelled: { label: 'İptal',      color: '#DC2626', bg: '#FEF2F2' },
};

export const LOCATION_TYPES = {
  on_site:       'Ofis İçi',
  field:         'Saha',
  international: 'Uluslararası',
};

export const PARTICIPANT_ROLES = {
  organizer: 'Organizatör',
  speaker:   'Konuşmacı',
  attendee:  'Katılımcı',
  observer:  'Gözlemci',
};

function StatusBadge({ status }) {
  const cfg = EVENT_STATUS[status] || EVENT_STATUS.planned;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      color: cfg.color, background: cfg.bg,
    }}>
      {cfg.label}
    </span>
  );
}

function TypeBadge({ type }) {
  const cfg = EVENT_TYPES[type] || EVENT_TYPES.other;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
      color: cfg.color, background: cfg.bg,
    }}>
      {cfg.label}
    </span>
  );
}

function formatDateRange(start, end) {
  if (!start) return '—';
  const s = new Date(start).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  if (!end || end === start) return s;
  const e = new Date(end).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${s} – ${e}`;
}

function EventCard({ event, onClick }) {
  const typeColor = (EVENT_TYPES[event.event_type] || EVENT_TYPES.other).color;
  return (
    <div
      onClick={() => onClick(event)}
      style={{
        background: 'var(--card-bg, #fff)',
        border: '1px solid var(--border, #E5E7EB)',
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s, transform 0.15s',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.10)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Kapak görseli veya renkli banner */}
      {event.cover_image_url ? (
        <div style={{ width: '100%', height: 140, overflow: 'hidden', flexShrink: 0 }}>
          <img
            src={event.cover_image_url}
            alt={event.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      ) : (
        <div style={{
          width: '100%', height: 6, flexShrink: 0,
          background: typeColor,
        }} />
      )}

      {/* İçerik */}
      <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
      {/* Üst: başlık + status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text, #111)', lineHeight: 1.4, flex: 1 }}>
          {event.title}
        </div>
        <StatusBadge status={event.status} />
      </div>

      {/* Type badge */}
      <div>
        <TypeBadge type={event.event_type} />
      </div>

      {/* Meta bilgiler */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted, #6B7280)' }}>
          <span>📅</span>
          <span>{formatDateRange(event.start_date, event.end_date)}</span>
        </div>
        {event.location_name && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted, #6B7280)' }}>
            <span>📍</span>
            <span>{event.location_name}</span>
            <span style={{ fontSize: 11, color: '#9CA3AF', padding: '1px 6px', background: '#F3F4F6', borderRadius: 8 }}>
              {LOCATION_TYPES[event.location_type] || event.location_type}
            </span>
          </div>
        )}
        {event.unit && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted, #6B7280)' }}>
            <span>🏢</span>
            <span>{event.unit}</span>
          </div>
        )}
      </div>

      {/* Son kayıt tarihi */}
      {event.registration_deadline && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#D97706', fontWeight: 600 }}>
          <span>⏰</span>
          <span>Son kayıt: {new Date(event.registration_deadline).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
      )}

      {/* Alt: owner + katılımcı sayısı */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border, #E5E7EB)', fontSize: 12, color: '#9CA3AF', marginTop: 'auto' }}>
        <span>{event.owner_name ? `${event.owner_name}` : '—'}</span>
        <span>{event._participant_count || 0} katılımcı</span>
      </div>
      </div>{/* /content */}
    </div>
  );
}

// ── Ana Bileşen ───────────────────────────────────────────────────────────────
export default function Events({ user, profile }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [view, setView] = useState('grid'); // grid | list | calendar
  const [selectedEvent, setSelectedEvent] = useState(null); // detail view
  const [showNewForm, setShowNewForm] = useState(false);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const loadEvents = useCallback(async () => {
    setLoading(true);
    // Events + owner adı + katılımcı sayısı
    const { data: evData } = await supabase
      .from('events')
      .select('*')
      .order('start_date', { ascending: true });

    if (!evData) { setLoading(false); return; }

    // Owner adlarını çek
    const ownerIds = [...new Set(evData.map(e => e.owner_id).filter(Boolean))];
    let ownerMap = {};
    if (ownerIds.length) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, full_name')
        .in('user_id', ownerIds);
      (profiles || []).forEach(p => { ownerMap[p.user_id] = p.full_name; });
    }

    // Katılımcı sayıları
    const { data: pcData } = await supabase
      .from('event_participants')
      .select('event_id');
    const pcMap = {};
    (pcData || []).forEach(r => { pcMap[r.event_id] = (pcMap[r.event_id] || 0) + 1; });

    const enriched = evData.map(e => ({
      ...e,
      owner_name: ownerMap[e.owner_id] || null,
      _participant_count: pcMap[e.id] || 0,
    }));

    setEvents(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // Filtrele
  const filtered = events.filter(e => {
    if (filterStatus !== 'all' && e.status !== filterStatus) return false;
    if (filterType !== 'all' && e.event_type !== filterType) return false;
    if (filterLocation !== 'all' && e.location_type !== filterLocation) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !e.title?.toLowerCase().includes(q) &&
        !e.location_name?.toLowerCase().includes(q) &&
        !e.unit?.toLowerCase().includes(q) &&
        !e.owner_name?.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const handleOpenEvent = (event) => setSelectedEvent(event);
  const handleCloseDetail = () => { setSelectedEvent(null); loadEvents(); };
  const handleNewEvent = () => setSelectedEvent({ _new: true });

  // Takvim: aya göre eventleri al
  function getCalendarDays(year, month) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }

  function eventsOnDay(day) {
    if (!day) return [];
    const dateStr = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return filtered.filter(e => {
      if (!e.start_date) return false;
      const s = e.start_date;
      const en = e.end_date || e.start_date;
      return dateStr >= s && dateStr <= en;
    });
  }

  const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

  if (selectedEvent) {
    return (
      <EventDetail
        event={selectedEvent._new ? null : selectedEvent}
        user={user}
        profile={profile}
        onClose={handleCloseDetail}
        onSaved={loadEvents}
      />
    );
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1300, margin: '0 auto' }}>
      {/* Başlık */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text, #111)', margin: 0 }}>Etkinlikler</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted, #6B7280)', fontSize: 14 }}>
            Tüm organizasyonel etkinlikleri yönetin ve takip edin
          </p>
        </div>
        <button
          onClick={handleNewEvent}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'var(--navy, #1A3C5E)', color: '#fff', fontWeight: 700, fontSize: 14,
          }}
        >
          + Yeni Etkinlik
        </button>
      </div>

      {/* Filtreler */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Etkinlik ara..."
          style={{
            flex: '1 1 260px', padding: '9px 14px', borderRadius: 8,
            border: '1px solid var(--border, #E5E7EB)',
            background: 'var(--card-bg, #fff)', fontSize: 14,
            color: 'var(--text, #111)', outline: 'none',
          }}
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="all">Tüm Durumlar</option>
          {Object.entries(EVENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selectStyle}>
          <option value="all">Tüm Tipler</option>
          {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} style={selectStyle}>
          <option value="all">Tüm Lokasyonlar</option>
          {Object.entries(LOCATION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        {/* View toggle */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg, #F9FAFB)', borderRadius: 8, padding: 3, border: '1px solid var(--border, #E5E7EB)', marginLeft: 'auto' }}>
          {[['grid','⊞'],['list','☰'],['calendar','📅']].map(([v, icon]) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14,
              background: view === v ? 'var(--navy, #1A3C5E)' : 'transparent',
              color: view === v ? '#fff' : 'var(--text-muted, #6B7280)',
              fontWeight: view === v ? 700 : 400,
            }}>{icon}</button>
          ))}
        </div>
      </div>

      {/* İçerik */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Yükleniyor…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Etkinlik bulunamadı</div>
          <div style={{ fontSize: 13 }}>Yeni bir etkinlik eklemek için "Yeni Etkinlik" butonunu kullanın.</div>
        </div>
      ) : view === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.map(e => <EventCard key={e.id} event={e} onClick={handleOpenEvent} />)}
        </div>
      ) : view === 'list' ? (
        <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #E5E7EB)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px', gap: 12, padding: '10px 18px', background: 'var(--navy, #1A3C5E)', fontSize: 12, fontWeight: 700, color: '#fff' }}>
            <span>Etkinlik</span><span>Tarih</span><span>Lokasyon</span><span>Birim</span><span>Durum</span><span>Katılımcı</span>
          </div>
          {filtered.map((e, i) => (
            <div
              key={e.id}
              onClick={() => handleOpenEvent(e)}
              style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px',
                gap: 12, padding: '13px 18px', cursor: 'pointer',
                background: i % 2 === 0 ? 'var(--card-bg, #fff)' : 'var(--bg, #F9FAFB)',
                borderBottom: '1px solid var(--border, #E5E7EB)',
                transition: 'background 0.1s',
                alignItems: 'center',
              }}
              onMouseEnter={el => el.currentTarget.style.background = 'var(--primary-light, #EFF6FF)'}
              onMouseLeave={(el, idx=i) => el.currentTarget.style.background = idx % 2 === 0 ? 'var(--card-bg, #fff)' : 'var(--bg, #F9FAFB)'}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text, #111)' }}>{e.title}</div>
                <TypeBadge type={e.event_type} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{formatDateRange(e.start_date, e.end_date)}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {e.location_name || '—'}
                {e.location_type && <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 4 }}>({LOCATION_TYPES[e.location_type]})</span>}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{e.unit || '—'}</div>
              <StatusBadge status={e.status} />
              <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'right' }}>{e._participant_count}</div>
            </div>
          ))}
        </div>
      ) : (
        /* TAKVİM */
        <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #E5E7EB)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Takvim başlık */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <button onClick={() => setCalMonth(m => {
              let mo = m.month - 1, yr = m.year;
              if (mo < 0) { mo = 11; yr--; }
              return { year: yr, month: mo };
            })} style={navBtnStyle}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>
              {MONTHS_TR[calMonth.month]} {calMonth.year}
            </span>
            <button onClick={() => setCalMonth(m => {
              let mo = m.month + 1, yr = m.year;
              if (mo > 11) { mo = 0; yr++; }
              return { year: yr, month: mo };
            })} style={navBtnStyle}>›</button>
          </div>
          {/* Tip legend */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
            {Object.entries(EVENT_TYPES).map(([k, v]) => (
              <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: v.color, display: 'inline-block' }} />
                <span style={{ color: 'var(--text-muted)' }}>{v.label}</span>
              </span>
            ))}
          </div>
          {/* Gün başlıkları */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
            {['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'].map(d => (
              <div key={d} style={{ textAlign: 'center', padding: '8px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{d}</div>
            ))}
          </div>
          {/* Günler */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {getCalendarDays(calMonth.year, calMonth.month).map((day, i) => {
              const dayEvents = eventsOnDay(day);
              const today = new Date();
              const isToday = day && today.getFullYear() === calMonth.year && today.getMonth() === calMonth.month && today.getDate() === day;
              return (
                <div key={i} style={{
                  minHeight: 90, padding: '6px', borderRight: '1px solid var(--border)',
                  borderBottom: '1px solid var(--border)',
                  background: !day ? 'var(--bg, #F9FAFB)' : 'var(--card-bg, #fff)',
                }}>
                  {day && (
                    <>
                      <div style={{
                        fontWeight: isToday ? 800 : 400, fontSize: 13,
                        color: isToday ? '#fff' : 'var(--text)',
                        width: 24, height: 24, borderRadius: '50%', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        background: isToday ? 'var(--navy, #1A3C5E)' : 'transparent',
                        marginBottom: 4,
                      }}>{day}</div>
                      {dayEvents.slice(0, 3).map(ev => {
                        const tc = EVENT_TYPES[ev.event_type] || EVENT_TYPES.other;
                        return (
                          <div key={ev.id} onClick={() => handleOpenEvent(ev)} style={{
                            fontSize: 11, padding: '2px 5px', borderRadius: 4, marginBottom: 2,
                            background: tc.bg, color: tc.color, fontWeight: 600, cursor: 'pointer',
                            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                          }}>{ev.title}</div>
                        );
                      })}
                      {dayEvents.length > 3 && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{dayEvents.length - 3} daha</div>}
                    </>
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

const selectStyle = {
  padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border, #E5E7EB)',
  background: 'var(--card-bg, #fff)', fontSize: 13, color: 'var(--text, #111)', cursor: 'pointer', outline: 'none',
};

const navBtnStyle = {
  background: 'none', border: '1px solid var(--border)', borderRadius: 6,
  width: 32, height: 32, cursor: 'pointer', fontSize: 18, color: 'var(--text)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
