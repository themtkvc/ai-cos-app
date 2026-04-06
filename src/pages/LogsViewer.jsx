import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getDashboardLogs } from '../lib/supabase';
import { ROLE_LABELS, avatarColor, fmtDateShort, fmtDayShort, toLocalDateStr } from '../lib/constants';

const NON_WORK = ['saglik_izni','egitim_izni','yillik_izin','calismiyor'];
const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                   'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const STATUS_LABELS = {
  ofis:        'Ofisten',
  ev:          'Evden',
  saha:        'Sahadayım',
  saglik_izni: 'Sağlık İzni',
  egitim_izni: 'Eğitim İzni',
  yillik_izin: 'Yıllık İzin',
  calismiyor:  'Çalışmıyor',
};

// ── TARİH YARDIMCILARI ────────────────────────────────────────────────────────
function today() { return toLocalDateStr(new Date()); }

function thisWeek() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now); mon.setDate(now.getDate() + diff);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { start: toLocalDateStr(mon), end: toLocalDateStr(sun) };
}

function thisMonth() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: toLocalDateStr(start), end: toLocalDateStr(end) };
}

// ── GEZİNME BAZLI TARİH HESAPLAMA ────────────────────────────────────────────
function getDayByOffset(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toLocalDateStr(d);
}

function getWeekByOffset(offset) {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff + offset * 7);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: toLocalDateStr(mon), end: toLocalDateStr(sun) };
}

function getMonthByOffset(offset) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { start: toLocalDateStr(start), end: toLocalDateStr(end) };
}

function fmtPeriodLabel(mode, offset, rangeStart, rangeEnd) {
  const shortMonths = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  const longMonths  = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                       'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const dayNames    = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];

  if (mode === 'gun') {
    const d = new Date(getDayByOffset(offset) + 'T12:00:00');
    if (offset === 0) return `Bugün · ${d.getDate()} ${longMonths[d.getMonth()]} ${d.getFullYear()} ${dayNames[d.getDay()]}`;
    if (offset === -1) return `Dün · ${d.getDate()} ${longMonths[d.getMonth()]} ${d.getFullYear()} ${dayNames[d.getDay()]}`;
    return `${d.getDate()} ${longMonths[d.getMonth()]} ${d.getFullYear()} ${dayNames[d.getDay()]}`;
  }
  if (mode === 'hafta') {
    const w = getWeekByOffset(offset);
    const s = new Date(w.start + 'T12:00:00');
    const e = new Date(w.end   + 'T12:00:00');
    const sameYear = s.getFullYear() === e.getFullYear();
    const sameMonth = sameYear && s.getMonth() === e.getMonth();
    if (offset === 0) {
      return `Bu Hafta · ${s.getDate()} ${shortMonths[s.getMonth()]}${!sameYear ? ' '+s.getFullYear() : ''} – ${e.getDate()} ${shortMonths[e.getMonth()]} ${e.getFullYear()}`;
    }
    return `${s.getDate()} ${shortMonths[s.getMonth()]}${!sameYear ? ' '+s.getFullYear() : ''} – ${e.getDate()} ${shortMonths[e.getMonth()]} ${e.getFullYear()}`;
  }
  if (mode === 'ay') {
    const m = getMonthByOffset(offset);
    const d = new Date(m.start + 'T12:00:00');
    if (offset === 0) return `Bu Ay · ${longMonths[d.getMonth()]} ${d.getFullYear()}`;
    return `${longMonths[d.getMonth()]} ${d.getFullYear()}`;
  }
  if (mode === 'aralik' && rangeStart && rangeEnd) {
    const s = new Date(rangeStart + 'T12:00:00');
    const e = new Date(rangeEnd   + 'T12:00:00');
    const sameYear = s.getFullYear() === e.getFullYear();
    return `${s.getDate()} ${shortMonths[s.getMonth()]}${!sameYear ? ' '+s.getFullYear():''} – ${e.getDate()} ${shortMonths[e.getMonth()]} ${e.getFullYear()}`;
  }
  return 'Tarih Aralığı Seç';
}

// ── SÜRE HESAPLAMA ───────────────────────────────────────────────────────────
function itemMins(item) {
  if (!item) return 0;
  if (item.all_day) return 480;
  if (item.start_time && item.end_time) {
    const [sh, sm] = item.start_time.split(':').map(Number);
    const [eh, em] = item.end_time.split(':').map(Number);
    return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
  }
  return parseInt(item.duration_minutes) || 0;
}
function fmtH(mins) {
  if (!mins || mins === 0) return '—';
  return (mins / 60).toFixed(1) + 'h';
}
function logTotalMins(log) {
  const w = (log.work_items     || []).reduce((s, i) => s + itemMins(i), 0);
  const o = (log.overtime_items || []).reduce((s, i) => s + itemMins(i), 0);
  return w + o;
}

// ── SATIR DÜZLEŞTIRME ────────────────────────────────────────────────────────
// Her log'u iş kalemi satırlarına dönüştür
function flattenLog(log) {
  const rows = [];
  const isLeave = NON_WORK.includes(log.work_status);

  if (isLeave) {
    rows.push({
      log_date: log.log_date,
      title:    STATUS_LABELS[log.work_status] || log.work_status,
      category: null,
      mins:     0,
      isLeave:  true,
      status:   log.work_status,
      isOt:     false,
    });
    return rows;
  }

  (log.work_items || []).forEach(item => {
    rows.push({
      log_date: log.log_date,
      title:    item.title || item.description || '—',
      category: item.category || null,
      mins:     itemMins(item),
      isLeave:  false,
      isOt:     false,
    });
  });

  (log.overtime_items || []).forEach(item => {
    rows.push({
      log_date: log.log_date,
      title:    item.title || item.description || '—',
      category: item.category || null,
      mins:     itemMins(item),
      isLeave:  false,
      isOt:     true,
    });
  });

  if (rows.length === 0) {
    rows.push({
      log_date: log.log_date,
      title:    STATUS_LABELS[log.work_status] || '—',
      category: null,
      mins:     0,
      isLeave:  false,
      isOt:     false,
      isEmpty:  true,
    });
  }

  return rows;
}

// ── AVATAR ───────────────────────────────────────────────────────────────────
function Avatar({ name = '', avatarUrl, size = 40 }) {
  const [err, setErr] = useState(false);
  const color    = avatarColor(name);
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  if (avatarUrl && !err) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setErr(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: color, color: 'white',
      fontWeight: 700, fontSize: size * 0.35,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      userSelect: 'none',
    }}>
      {initials}
    </div>
  );
}

// ── İSTATİSTİK KARTI ─────────────────────────────────────────────────────────
function StatCard({ label, value, iconBg, icon }) {
  return (
    <div style={{
      flex: 1, background: 'white', borderRadius: 12,
      border: '1px solid var(--border)', padding: '20px 22px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 6, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
      </div>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, flexShrink: 0,
      }}>
        {icon}
      </div>
    </div>
  );
}

// ── PROJE/KONU BADGE ─────────────────────────────────────────────────────────
function CategoryBadge({ label }) {
  if (!label) return <span style={{ color: 'var(--gray-mid)', fontSize: 12 }}>—</span>;
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px', borderRadius: 6,
      border: '1px solid var(--border)',
      background: 'var(--bg-card)',
      fontSize: 12.5, fontWeight: 500, color: 'var(--text-secondary)',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// ── MESAI BADGE ──────────────────────────────────────────────────────────────
function OtBadge() {
  return (
    <span style={{
      display: 'inline-block', marginLeft: 8,
      padding: '1px 7px', borderRadius: 20,
      background: 'var(--orange-pale)', border: '1px solid var(--gold)99',
      fontSize: 10.5, fontWeight: 700, color: '#92400e',
    }}>Mesai</span>
  );
}

// ── İZİN BADGE ───────────────────────────────────────────────────────────────
const LEAVE_META = {
  saglik_izni: { bg: 'var(--red-pale)', border: '#fecaca', color: '#991b1b', label: 'Sağlık İzni' },
  egitim_izni: { bg: '#f5f3ff', border: '#ddd6fe', color: '#5b21b6', label: 'Eğitim İzni' },
  yillik_izin: { bg: 'var(--orange-pale)', border: '#fde68a', color: '#92400e', label: 'Yıllık İzin' },
  calismiyor:  { bg: '#f9fafb', border: '#e5e7eb', color: '#6b7280', label: 'Çalışmıyor'  },
};
function LeaveBadge({ status }) {
  const m = LEAVE_META[status] || LEAVE_META.calismiyor;
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 12px', borderRadius: 20,
      background: m.bg, border: `1px solid ${m.border}`,
      fontSize: 12, fontWeight: 700, color: m.color,
    }}>
      {m.label}
    </span>
  );
}

// ── GÜN BAŞLIĞI ──────────────────────────────────────────────────────────────
const DAYS_FULL = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];

function DayHeader({ dateStr, totalMins, entryCount, isFirst }) {
  const d = new Date(dateStr + 'T12:00:00');
  const dayName = DAYS_FULL[d.getDay()];
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const hLabel = h > 0 ? (m > 0 ? `${h}s ${m}dk` : `${h}s`) : m > 0 ? `${m}dk` : '0s';
  const pct = Math.min(100, Math.round((totalMins / 480) * 100));
  const isGood = totalMins >= 480;
  const isPartial = totalMins > 0 && totalMins < 480;

  return (
    <tr>
      <td colSpan={3} style={{
        padding: isFirst ? '14px 24px 8px' : '18px 24px 8px',
        borderTop: isFirst ? 'none' : '2px solid var(--border)',
        background: '#f8fafc',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 8,
              background: isGood ? '#dcfce7' : isPartial ? '#fef3c7' : '#f3f4f6',
              fontSize: 14, fontWeight: 800,
              color: isGood ? '#15803d' : isPartial ? '#a16207' : '#9ca3af',
            }}>
              {d.getDate()}
            </span>
            <div>
              <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>
                {dayName}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-light)', marginLeft: 8 }}>
                {fmtDateShort(dateStr)}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Mini ilerleme çubuğu */}
            <div style={{
              width: 60, height: 6, borderRadius: 3,
              background: '#e5e7eb', overflow: 'hidden',
            }}>
              <div style={{
                width: `${pct}%`, height: '100%', borderRadius: 3,
                background: isGood ? '#22c55e' : isPartial ? '#f59e0b' : '#d1d5db',
                transition: 'width 0.3s',
              }} />
            </div>
            <span style={{
              fontWeight: 800, fontSize: 14,
              color: isGood ? '#15803d' : isPartial ? '#a16207' : '#9ca3af',
              minWidth: 50, textAlign: 'right',
            }}>
              {hLabel}
            </span>
            <span style={{
              fontSize: 11, color: 'var(--text-light)',
              background: '#f3f4f6', borderRadius: 4, padding: '2px 6px',
            }}>
              {entryCount} kayıt
            </span>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── BLOCK GÖRÜNÜMÜ — KİŞİ KARTI ──────────────────────────────────────────────
function PersonBlock({ person, rows, searchQ }) {
  const totalMins    = rows.reduce((s, r) => s + (r.mins || 0), 0);
  const totalEntries = rows.length;

  // Arama filtresi
  const visibleRows = searchQ
    ? rows.filter(r =>
        r.title?.toLowerCase().includes(searchQ)    ||
        r.category?.toLowerCase().includes(searchQ) ||
        person.full_name?.toLowerCase().includes(searchQ)
      )
    : rows;

  if (visibleRows.length === 0) return null;

  // Günlere göre grupla (tarih sırasıyla: yeni → eski)
  const dayGroups = [];
  let currentDate = null;
  let currentGroup = null;
  visibleRows.forEach(row => {
    if (row.log_date !== currentDate) {
      currentDate = row.log_date;
      currentGroup = { date: row.log_date, rows: [] };
      dayGroups.push(currentGroup);
    }
    currentGroup.rows.push(row);
  });

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 14,
      border: '1px solid var(--border)',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* Kişi başlığı */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 24px',
        borderBottom: '1px solid var(--bg-badge)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar name={person.full_name} avatarUrl={person.avatar_url} size={44} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{person.full_name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-light)', marginTop: 2 }}>
              {ROLE_LABELS[person.role] || person.role}
              {person.unit ? ` · ${person.unit}` : ''}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 3 }}>Toplam Saat</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{fmtH(totalMins)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>{totalEntries} kayıt · {dayGroups.length} gün</div>
        </div>
      </div>

      {/* Tablo — gün gruplarıyla */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {dayGroups.map((group, gIdx) => {
              const dayMins = group.rows.reduce((s, r) => s + (r.mins || 0), 0);
              return (
                <React.Fragment key={group.date}>
                  {/* Gün başlığı */}
                  <DayHeader
                    dateStr={group.date}
                    totalMins={dayMins}
                    entryCount={group.rows.filter(r => !r.isLeave && !r.isEmpty).length || group.rows.length}
                    isFirst={gIdx === 0}
                  />
                  {/* O günün iş kalemleri */}
                  {group.rows.map((row, idx) => (
                    <tr key={idx} style={{
                      borderBottom: idx < group.rows.length - 1 ? '1px solid #f1f5f9' : 'none',
                      background: 'white',
                    }}>
                      <td style={{ padding: '10px 24px 10px 66px', fontSize: 13.5, color: 'var(--text)' }}>
                        {row.isLeave ? <LeaveBadge status={row.status} /> : (
                          <>
                            {row.title}
                            {row.isOt && <OtBadge />}
                          </>
                        )}
                      </td>
                      <td style={{ padding: '10px 24px' }}>
                        {!row.isLeave && <CategoryBadge label={row.category} />}
                      </td>
                      <td style={{ padding: '10px 24px', textAlign: 'right', fontWeight: 600, fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {row.isLeave ? '—' : fmtH(row.mins)}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── LİSTE GÖRÜNÜMÜ ────────────────────────────────────────────────────────────
function ListView({ persons, searchQ }) {
  const allRows = [];
  persons.forEach(p => {
    p.rows.forEach(r => allRows.push({ ...r, person: p }));
  });
  allRows.sort((a, b) => b.log_date.localeCompare(a.log_date) || a.person.full_name.localeCompare(b.person.full_name));

  const visible = searchQ
    ? allRows.filter(r =>
        r.title?.toLowerCase().includes(searchQ)    ||
        r.category?.toLowerCase().includes(searchQ) ||
        r.person.full_name?.toLowerCase().includes(searchQ)
      )
    : allRows;

  if (visible.length === 0) return <EmptyState />;

  // Günlere göre grupla
  const dayGroups = [];
  let curDate = null;
  let curGroup = null;
  visible.forEach(row => {
    if (row.log_date !== curDate) {
      curDate = row.log_date;
      curGroup = { date: row.log_date, rows: [] };
      dayGroups.push(curGroup);
    }
    curGroup.rows.push(row);
  });

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)',
      overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {dayGroups.map((group, gIdx) => {
            const dayMins = group.rows.reduce((s, r) => s + (r.mins || 0), 0);
            const d = new Date(group.date + 'T12:00:00');
            const dayName = DAYS_FULL[d.getDay()];
            const h = Math.floor(dayMins / 60);
            const m = dayMins % 60;
            const hLabel = h > 0 ? (m > 0 ? `${h}s ${m}dk` : `${h}s`) : m > 0 ? `${m}dk` : '0s';
            const uniquePersons = [...new Set(group.rows.map(r => r.person.user_id))].length;

            return (
              <React.Fragment key={group.date}>
                {/* Gün başlığı */}
                <tr>
                  <td colSpan={4} style={{
                    padding: gIdx === 0 ? '14px 20px 10px' : '20px 20px 10px',
                    borderTop: gIdx === 0 ? 'none' : '2.5px solid var(--border)',
                    background: '#f8fafc',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 36, height: 36, borderRadius: 10,
                          background: dayMins >= 480 ? '#dcfce7' : dayMins > 0 ? '#fef3c7' : '#f3f4f6',
                          fontSize: 15, fontWeight: 800,
                          color: dayMins >= 480 ? '#15803d' : dayMins > 0 ? '#a16207' : '#9ca3af',
                        }}>
                          {d.getDate()}
                        </span>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{dayName}</span>
                          <span style={{ fontSize: 12.5, color: 'var(--text-light)', marginLeft: 8 }}>{fmtDateShort(group.date)}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-light)' }}>
                          {uniquePersons} kişi · {group.rows.filter(r => !r.isLeave && !r.isEmpty).length} kayıt
                        </span>
                        <span style={{
                          fontWeight: 800, fontSize: 14, padding: '3px 10px', borderRadius: 6,
                          background: dayMins >= 480 ? '#dcfce7' : dayMins > 0 ? '#fef3c7' : '#f3f4f6',
                          color: dayMins >= 480 ? '#15803d' : dayMins > 0 ? '#a16207' : '#9ca3af',
                        }}>
                          {hLabel}
                        </span>
                      </div>
                    </div>
                  </td>
                </tr>
                {/* Sütun başlıkları (ilk gün için) */}
                {gIdx === 0 && (
                  <tr style={{ background: '#fafafa', borderBottom: '1px solid var(--bg-badge)' }}>
                    {['Personel','Yapılan İş','Proje/Konu','Süre'].map((col, i) => (
                      <th key={col} style={{
                        padding: '8px 20px', textAlign: i === 3 ? 'right' : 'left',
                        fontSize: 11.5, fontWeight: 600, color: 'var(--text-light)',
                      }}>{col}</th>
                    ))}
                  </tr>
                )}
                {/* Satırlar */}
                {group.rows.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: 'white' }}>
                    <td style={{ padding: '11px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={row.person.full_name} avatarUrl={row.person.avatar_url} size={30} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{row.person.full_name}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-light)' }}>{row.person.unit}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '11px 20px', fontSize: 13, color: 'var(--text)' }}>
                      {row.isLeave ? <LeaveBadge status={row.status} /> : (
                        <>{row.title}{row.isOt && <OtBadge />}</>
                      )}
                    </td>
                    <td style={{ padding: '11px 20px' }}>
                      {!row.isLeave && <CategoryBadge label={row.category} />}
                    </td>
                    <td style={{ padding: '11px 20px', textAlign: 'right', fontWeight: 600, fontSize: 13, color: 'var(--text-muted)' }}>
                      {row.isLeave ? '—' : fmtH(row.mins)}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── KART GÖRÜNÜMÜ ─────────────────────────────────────────────────────────────
function KartView({ persons, searchQ }) {
  const allRows = [];
  persons.forEach(p => {
    p.rows.forEach(r => allRows.push({ ...r, person: p }));
  });
  allRows.sort((a, b) => b.log_date.localeCompare(a.log_date) || a.person.full_name.localeCompare(b.person.full_name));

  const visible = searchQ
    ? allRows.filter(r =>
        r.title?.toLowerCase().includes(searchQ)    ||
        r.category?.toLowerCase().includes(searchQ) ||
        r.person.full_name?.toLowerCase().includes(searchQ)
      )
    : allRows;

  if (visible.length === 0) return <EmptyState />;

  // Günlere göre grupla
  const dayGroups = [];
  let curDate = null;
  let curGroup = null;
  visible.forEach(row => {
    if (row.log_date !== curDate) {
      curDate = row.log_date;
      curGroup = { date: row.log_date, rows: [] };
      dayGroups.push(curGroup);
    }
    curGroup.rows.push(row);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {dayGroups.map((group, gIdx) => {
        const dayMins = group.rows.reduce((s, r) => s + (r.mins || 0), 0);
        const d = new Date(group.date + 'T12:00:00');
        const dayName = DAYS_FULL[d.getDay()];
        const h = Math.floor(dayMins / 60);
        const m = dayMins % 60;
        const hLabel = h > 0 ? (m > 0 ? `${h}s ${m}dk` : `${h}s`) : m > 0 ? `${m}dk` : '0s';

        return (
          <div key={group.date}>
            {/* Gün başlığı */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 4px', marginBottom: 10,
              borderBottom: '2px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 36, height: 36, borderRadius: 10,
                  background: dayMins >= 480 ? '#dcfce7' : dayMins > 0 ? '#fef3c7' : '#f3f4f6',
                  fontSize: 15, fontWeight: 800,
                  color: dayMins >= 480 ? '#15803d' : dayMins > 0 ? '#a16207' : '#9ca3af',
                }}>
                  {d.getDate()}
                </span>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{dayName}</span>
                <span style={{ fontSize: 12.5, color: 'var(--text-light)' }}>{fmtDateShort(group.date)}</span>
              </div>
              <span style={{
                fontWeight: 800, fontSize: 14, padding: '4px 12px', borderRadius: 8,
                background: dayMins >= 480 ? '#dcfce7' : dayMins > 0 ? '#fef3c7' : '#f3f4f6',
                color: dayMins >= 480 ? '#15803d' : dayMins > 0 ? '#a16207' : '#9ca3af',
              }}>
                {hLabel}
              </span>
            </div>
            {/* O günün kartları */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {group.rows.map((row, idx) => (
                <div key={idx} style={{
                  background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)',
                  padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <Avatar name={row.person.full_name} avatarUrl={row.person.avatar_url} size={32} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{row.person.full_name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-light)' }}>{row.person.unit}</div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)', marginBottom: 8 }}>
                    {row.isLeave ? <LeaveBadge status={row.status} /> : (
                      <>{row.title}{row.isOt && <OtBadge />}</>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <CategoryBadge label={row.isLeave ? null : row.category} />
                    <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>
                      {row.isLeave ? '—' : fmtH(row.mins)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── BOŞ DURUM ─────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{
      textAlign: 'center', padding: '64px 24px',
      background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>Kayıt bulunamadı</div>
      <div style={{ fontSize: 13, color: 'var(--text-light)' }}>Seçilen tarih aralığında giriş yapılmamış.</div>
    </div>
  );
}

// ── RAPOR İNDİR (CSV) ─────────────────────────────────────────────────────────
function downloadCSV(persons, dateLabel) {
  const rows = [['Personel','Birim','Tarih','Yapılan İş','Proje/Konu','Mesai?','Süre (dk)']];
  persons.forEach(p => {
    p.rows.forEach(r => {
      rows.push([
        p.full_name, p.unit || '',
        r.log_date,
        r.title, r.category || '',
        r.isOt ? 'Evet' : 'Hayır',
        r.mins,
      ]);
    });
  });
  const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url;
  a.download = `calisma_kayitlari_${dateLabel}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ── VIEW TOGGLE BUTTON ────────────────────────────────────────────────────────
function ViewBtn({ id, label, icon, active, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 14px', borderRadius: 8, border: 'none',
        background: active ? 'var(--text)' : 'transparent',
        color: active ? 'white' : 'var(--text-muted)',
        fontWeight: 600, fontSize: 13, cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.15s',
      }}
    >
      <span style={{ fontSize: 15 }}>{icon}</span> {label}
    </button>
  );
}

// ── ANA COMPONENT ─────────────────────────────────────────────────────────────
export default function LogsViewer({ user, profile }) {
  const [periodMode, setPeriodMode]   = useState('hafta'); // 'gun'|'hafta'|'ay'|'aralik'
  const [periodOffset, setPeriodOffset] = useState(0);     // 0=şimdiki, -1=önceki, ...
  const [rangeStart, setRangeStart]   = useState('');
  const [rangeEnd, setRangeEnd]       = useState('');
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [viewMode, setViewMode]       = useState('block'); // 'block'|'liste'|'kart'
  const [searchText, setSearchText]   = useState('');
  const [searchQ, setSearchQ]         = useState('');
  const [personFilter, setPersonFilter] = useState('');
  const [unitFilter, setUnitFilter]   = useState('');
  const [logs, setLogs]               = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  // Debounce search filter (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQ(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const role   = profile?.role;
  const myUnit = profile?.unit;
  const isKoordinator   = ['koordinator','direktor_yardimcisi'].includes(role);
  const isDirectorLevel = ['direktor','asistan'].includes(role);

  // Tarih aralığı
  const { startDate, endDate, dateLabel } = useMemo(() => {
    if (periodMode === 'gun') {
      const d = getDayByOffset(periodOffset);
      return { startDate: d, endDate: d, dateLabel: d };
    }
    if (periodMode === 'hafta') {
      const w = getWeekByOffset(periodOffset);
      return { startDate: w.start, endDate: w.end, dateLabel: `${w.start}_${w.end}` };
    }
    if (periodMode === 'ay') {
      const m = getMonthByOffset(periodOffset);
      return { startDate: m.start, endDate: m.end, dateLabel: `${m.start}_${m.end}` };
    }
    if (periodMode === 'aralik' && rangeStart && rangeEnd) {
      return { startDate: rangeStart, endDate: rangeEnd, dateLabel: `${rangeStart}_${rangeEnd}` };
    }
    // aralik henüz seçilmemişse bugünü göster
    const t = today();
    return { startDate: t, endDate: t, dateLabel: t };
  }, [periodMode, periodOffset, rangeStart, rangeEnd]);

  // Veri yükle
  const loadLogs = useCallback(async () => {
    if (!profile) return;
    setLoading(true); setError('');
    const { data, error: err } = await getDashboardLogs(startDate, endDate);
    if (err) { setError(err.message); setLoading(false); return; }
    setLogs(data || []);
    setLoading(false);
  }, [profile, startDate, endDate]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Koordinatör sadece kendi birimini görür
  const scopedLogs = useMemo(() => {
    let r = logs;
    if (isKoordinator && myUnit) r = r.filter(l => l.unit === myUnit);
    return r;
  }, [logs, isKoordinator, myUnit]);

  // Kişi bazlı gruplama
  const personMap = useMemo(() => {
    const m = {};
    scopedLogs.forEach(log => {
      const uid = log.user_id;
      if (!m[uid]) {
        m[uid] = {
          user_id:    uid,
          full_name:  log.full_name  || uid.slice(0,8),
          role:       log.user_role,
          unit:       log.unit || '',
          avatar_url: log.avatar_url || null,
          rows:       [],
        };
      }
      flattenLog(log).forEach(row => m[uid].rows.push(row));
    });
    // Her kişinin satırlarını tarihe göre sırala (yeni → eski)
    Object.values(m).forEach(p => {
      p.rows.sort((a, b) => b.log_date.localeCompare(a.log_date));
    });
    return m;
  }, [scopedLogs]);

  // Filtre seçenekleri
  const allPersons = useMemo(() =>
    Object.values(personMap).sort((a, b) => a.full_name.localeCompare(b.full_name, 'tr')),
  [personMap]);

  const allUnits = useMemo(() =>
    [...new Set(allPersons.map(p => p.unit).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')),
  [allPersons]);

  // Uygulanan filtreler
  const filteredPersons = useMemo(() => {
    let ps = allPersons;
    if (personFilter) ps = ps.filter(p => p.user_id === personFilter);
    if (unitFilter)   ps = ps.filter(p => p.unit === unitFilter);
    return ps;
  }, [allPersons, personFilter, unitFilter]);

  const searchLower = searchQ.toLowerCase().trim();

  // Genel istatistikler
  const stats = useMemo(() => {
    const rows     = filteredPersons.flatMap(p => p.rows);
    const totalMins = rows.reduce((s, r) => s + (r.mins || 0), 0);
    const activeP  = filteredPersons.length;
    return {
      totalEntries: rows.filter(r => !r.isLeave && !r.isEmpty).length,
      totalH:       fmtH(totalMins),
      activeP,
      avgH:         activeP ? fmtH(Math.round(totalMins / activeP)) : '—',
    };
  }, [filteredPersons]);

  // Dönemi etiket
  const periodLabel = fmtPeriodLabel(periodMode, periodOffset, rangeStart, rangeEnd);

  return (
    <div style={{ padding: '28px 32px', background: '#f7f8fa', minHeight: '100vh' }}>

      {/* ── Başlık ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>
            Çalışma Kayıtları
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-light)', margin: '6px 0 0', fontWeight: 500 }}>
            {isKoordinator && myUnit ? `${myUnit} birimi personel aktivite kayıtları` : 'Personel günlük aktivite kayıtları'}
          </p>
        </div>
        <button
          onClick={() => downloadCSV(filteredPersons, dateLabel)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: 'var(--text)', color: 'white',
            fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
            fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          ⬇ Rapor İndir
        </button>
      </div>

      {/* ── İstatistik Kartları ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <StatCard label="Toplam Kayıt"    value={stats.totalEntries} iconBg="#eff6ff" icon={<span style={{color:'#3b82f6'}}>🔍</span>} />
        <StatCard label="Toplam Saat"     value={stats.totalH}       iconBg="#f5f3ff" icon={<span style={{color:'#8b5cf6'}}>🕐</span>} />
        <StatCard label="Aktif Personel"  value={stats.activeP}      iconBg="#f0fdf4" icon={<span style={{color:'#22c55e'}}>👥</span>} />
        <StatCard label="Kişi Başı Ort."  value={stats.avgH}         iconBg="#fff7ed" icon={<span style={{color:'#f97316'}}>📊</span>} />
      </div>

      {/* ── Filtre Çubuğu ── */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)',
        padding: '14px 18px', marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        {/* Üst Satır: arama + zaman + filtreler */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Arama */}
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', fontSize: 16 }}>🔍</span>
            <input
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Personel, iş veya proje ara..."
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '9px 12px 9px 36px',
                borderRadius: 8, border: '1.5px solid var(--border)',
                fontSize: 13, fontFamily: 'inherit', color: 'var(--text-secondary)',
                outline: 'none', background: 'var(--bg-hover)',
              }}
            />
          </div>

          {/* Dönem modu seçici + ileri/geri navigasyon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Mod butonları */}
            <div style={{ display: 'flex', gap: 2, background: '#f3f4f6', borderRadius: 9, padding: 3 }}>
              {[
                { id: 'gun',    label: 'Gün' },
                { id: 'hafta',  label: 'Hafta' },
                { id: 'ay',     label: 'Ay' },
                { id: 'aralik', label: '📅 Tarih Aralığı' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => { setPeriodMode(t.id); setPeriodOffset(0); if (t.id === 'aralik') setShowRangePicker(true); else setShowRangePicker(false); }}
                  style={{
                    padding: '7px 14px', borderRadius: 7, border: 'none',
                    background: periodMode === t.id ? '#111827' : 'transparent',
                    color: periodMode === t.id ? 'white' : '#6b7280',
                    fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.12s',
                  }}
                >{t.label}</button>
              ))}
            </div>

            {/* İleri/Geri — aralik modunda gizle */}
            {periodMode !== 'aralik' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f3f4f6', borderRadius: 9, padding: '3px 6px' }}>
                <button
                  onClick={() => setPeriodOffset(o => o - 1)}
                  title="Önceki dönem"
                  style={{ padding: '5px 9px', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#374151', fontWeight: 700, fontFamily: 'inherit' }}
                >‹</button>
                <span style={{
                  fontSize: 12.5, fontWeight: 600, color: '#111827',
                  minWidth: 160, textAlign: 'center', padding: '0 4px',
                  whiteSpace: 'nowrap',
                }}>
                  {fmtPeriodLabel(periodMode, periodOffset, rangeStart, rangeEnd)}
                </span>
                <button
                  onClick={() => setPeriodOffset(o => Math.min(o + 1, 0))}
                  title="Sonraki dönem"
                  disabled={periodOffset >= 0}
                  style={{ padding: '5px 9px', borderRadius: 6, border: 'none', background: 'transparent', cursor: periodOffset >= 0 ? 'default' : 'pointer', fontSize: 14, color: periodOffset >= 0 ? '#d1d5db' : '#374151', fontWeight: 700, fontFamily: 'inherit' }}
                >›</button>
                {periodOffset !== 0 && (
                  <button
                    onClick={() => setPeriodOffset(0)}
                    title="Bugüne dön"
                    style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 11, color: '#374151', fontWeight: 600, fontFamily: 'inherit' }}
                  >Şimdi</button>
                )}
              </div>
            )}

            {/* Tarih aralığı seçici */}
            {periodMode === 'aralik' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f3f4f6', borderRadius: 9, padding: '4px 10px' }}>
                <input
                  type="date"
                  value={rangeStart}
                  onChange={e => setRangeStart(e.target.value)}
                  style={{ padding: '5px 8px', borderRadius: 6, border: '1.5px solid #e5e7eb', fontSize: 12.5, fontFamily: 'inherit', outline: 'none', background: 'white' }}
                />
                <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>–</span>
                <input
                  type="date"
                  value={rangeEnd}
                  min={rangeStart}
                  onChange={e => setRangeEnd(e.target.value)}
                  style={{ padding: '5px 8px', borderRadius: 6, border: '1.5px solid #e5e7eb', fontSize: 12.5, fontFamily: 'inherit', outline: 'none', background: 'white' }}
                />
                {rangeStart && rangeEnd && (
                  <span style={{ fontSize: 11.5, color: '#6b7280', fontWeight: 500 }}>
                    {fmtPeriodLabel('aralik', 0, rangeStart, rangeEnd)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Personel filtre */}
          <select
            value={personFilter}
            onChange={e => setPersonFilter(e.target.value)}
            style={{
              padding: '8px 32px 8px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb',
              fontSize: 13, fontFamily: 'inherit', color: '#374151', background: 'white',
              cursor: 'pointer', outline: 'none', appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
            }}
          >
            <option value="">Tüm Personel</option>
            {allPersons.map(p => <option key={p.user_id} value={p.user_id}>{p.full_name}</option>)}
          </select>

          {/* Departman filtre (direktör seviyesi için) */}
          {(isDirectorLevel) && allUnits.length > 1 && (
            <select
              value={unitFilter}
              onChange={e => setUnitFilter(e.target.value)}
              style={{
                padding: '8px 32px 8px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb',
                fontSize: 13, fontFamily: 'inherit', color: '#374151', background: 'white',
                cursor: 'pointer', outline: 'none', appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
              }}
            >
              <option value="">Tüm Departmanlar</option>
              {allUnits.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          )}
        </div>

        {/* Alt Satır: görünüm seçimi + dönem etiketi */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <div style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>
            {!loading && `${periodLabel} · ${filteredPersons.length} personel · ${filteredPersons.reduce((s,p)=>s+p.rows.length,0)} kayıt`}
          </div>

          <div style={{ display: 'flex', gap: 2, background: '#f3f4f6', borderRadius: 10, padding: 3 }}>
            <ViewBtn id="liste" label="Liste" icon="☰"  active={viewMode==='liste'} onClick={setViewMode} />
            <ViewBtn id="kart"  label="Kart"  icon="⊞"  active={viewMode==='kart'}  onClick={setViewMode} />
            <ViewBtn id="block" label="Block" icon="🗂"  active={viewMode==='block'} onClick={setViewMode} />
          </div>
        </div>
      </div>

      {/* ── Hata ── */}
      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 16,
          background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13,
        }}>⚠️ {error}</div>
      )}

      {/* ── Yükleniyor ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '64px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Kayıtlar yükleniyor…</div>
        </div>
      )}

      {/* ── İçerik ── */}
      {!loading && filteredPersons.length === 0 && <EmptyState />}

      {!loading && filteredPersons.length > 0 && viewMode === 'block' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredPersons.map(person => (
            <PersonBlock key={person.user_id} person={person} rows={person.rows} searchQ={searchLower} />
          ))}
        </div>
      )}

      {!loading && filteredPersons.length > 0 && viewMode === 'liste' && (
        <ListView persons={filteredPersons} searchQ={searchLower} />
      )}

      {!loading && filteredPersons.length > 0 && viewMode === 'kart' && (
        <KartView persons={filteredPersons} searchQ={searchLower} />
      )}
    </div>
  );
}
