import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getDailyLog, upsertDailyLog, submitDailyLog, getWeekLogs, getUnitAgendas, awardXP, awardXPCustom, getXPSettings, supabase, logActivity } from '../lib/supabase';
import { ROLE_LABELS } from '../lib/constants';

// ── SABITLER ──────────────────────────────────────────────────────────────────
const WORK_STATUS = [
  { value: 'ofis',         label: 'Ofisten Çalışıyor',  icon: '🏢', color: '#1a3a5c' },
  { value: 'ev',           label: 'Evden Çalışıyor',    icon: '🏠', color: '#2e6da4' },
  { value: 'saha',         label: 'Sahadayım',           icon: '🌍', color: '#1e7a4a' },
  { value: 'saglik_izni',  label: 'Sağlık İzni',        icon: '🏥', color: '#c47a1e' },
  { value: 'egitim_izni',  label: 'Eğitim İzni',        icon: '📚', color: '#6b3fa0' },
  { value: 'yillik_izin',  label: 'Yıllık İzin',        icon: '🌴', color: '#c47a1e' },
  { value: 'calismiyor',   label: 'Çalışmıyor',         icon: '⏸️',  color: '#888' },
];

const CATEGORIES = [
  'Toplantı', 'Rapor & Dokümantasyon', 'Saha Ziyareti', 'Koordinasyon',
  'Proje Çalışması', 'Eğitim & Gelişim', 'İdari İşler',
  'Donör İletişimi', 'Stratejik Planlama', 'Diğer',
];

const NON_WORK_STATUSES = ['saglik_izni', 'egitim_izni', 'yillik_izin', 'calismiyor'];
const DAYS_TR   = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                   'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const DAYS_FULL = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekDates(referenceDate) {
  const d = new Date(referenceDate);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd;
  });
}

function calcItemMinutes(item) {
  if (item.all_day) return 480;
  if (!item.start_time || !item.end_time) return 0;
  const [sh, sm] = item.start_time.split(':').map(Number);
  const [eh, em] = item.end_time.split(':').map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return mins > 0 ? mins : 0;
}

function fmtMins(mins) {
  if (!mins) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}s${m > 0 ? ` ${m}dk` : ''}` : `${m}dk`;
}

function newItem(prefillTaskId = null) {
  return { id: Date.now() + Math.random(), category: '', description: '', start_time: '', end_time: '', all_day: false, agenda_item_id: prefillTaskId };
}

function migrateItem(raw) {
  const base = (raw.start_time !== undefined || raw.all_day !== undefined) ? raw : { ...raw, start_time: '', end_time: '', all_day: false };
  if (base.agenda_item_id === undefined) return { ...base, agenda_item_id: null };
  return base;
}

const AUTO_SAVE_DELAY = 2000;

// ── STATUS BADGE ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = WORK_STATUS.find(x => x.value === status);
  if (!s) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600,
      background: s.color + '18', color: s.color, border: `1px solid ${s.color}33`,
    }}>
      {s.icon} {s.label}
    </span>
  );
}

// ── İŞ KALEMİ SATIRI ─────────────────────────────────────────────────────────
function WorkItemRow({ item, disabled, onChange, onRemove, myTasks = [] }) {
  const mins = calcItemMinutes(item);
  const linkedTask = myTasks.find(t => t.id === item.agenda_item_id);
  return (
    <div style={{ marginBottom: 10 }}>
    <div style={{
      display: 'grid', gridTemplateColumns: '155px 1fr auto 32px',
      gap: 8, alignItems: 'center',
    }}>
      <select
        className="form-select"
        value={item.category}
        disabled={disabled}
        onChange={e => onChange('category', e.target.value)}
        style={{ fontSize: 12.5, padding: '7px 10px' }}
      >
        <option value="">Kategori seç…</option>
        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>

      <input
        className="form-input"
        placeholder="Ne yaptınız?"
        value={item.description}
        disabled={disabled}
        onChange={e => onChange('description', e.target.value)}
        style={{ fontSize: 12.5, padding: '7px 10px' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {item.all_day ? (
          <span style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
            background: 'var(--navy)12', color: 'var(--navy)', border: '1px solid var(--navy)22',
            whiteSpace: 'nowrap',
          }}>
            🌅 Tüm Gün (8s)
          </span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="time"
              lang="tr"
              value={item.start_time}
              disabled={disabled}
              onChange={e => onChange('start_time', e.target.value)}
              style={{
                border: '1px solid var(--border)', borderRadius: 8,
                padding: '6px 8px', fontSize: 12.5, fontFamily: 'var(--font-body)',
                background: disabled ? 'var(--surface)' : 'var(--bg-card)',
                color: 'var(--text)', width: 90,
              }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>→</span>
            <input
              type="time"
              lang="tr"
              value={item.end_time}
              disabled={disabled}
              onChange={e => onChange('end_time', e.target.value)}
              style={{
                border: '1px solid var(--border)', borderRadius: 8,
                padding: '6px 8px', fontSize: 12.5, fontFamily: 'var(--font-body)',
                background: disabled ? 'var(--surface)' : 'var(--bg-card)',
                color: 'var(--text)', width: 90,
              }}
            />
            {mins > 0 && (
              <span style={{
                fontSize: 11.5, fontWeight: 700, color: 'var(--navy)',
                background: 'var(--navy)10', borderRadius: 6, padding: '3px 7px', whiteSpace: 'nowrap',
              }}>
                {fmtMins(mins)}
              </span>
            )}
          </div>
        )}

        {!disabled && (
          <label style={{
            display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
            fontSize: 11.5, whiteSpace: 'nowrap',
            padding: '5px 10px', borderRadius: 8,
            border: `1px solid ${item.all_day ? 'var(--navy)' : 'var(--border)'}`,
            background: item.all_day ? 'var(--navy)10' : 'transparent',
            fontWeight: item.all_day ? 700 : 400,
            color: item.all_day ? 'var(--navy)' : 'var(--text-muted)',
          }}>
            <input
              type="checkbox"
              checked={item.all_day}
              onChange={e => onChange('all_day', e.target.checked)}
              style={{ accentColor: 'var(--navy)', width: 14, height: 14 }}
            />
            Tüm Gün
          </label>
        )}
      </div>

      {!disabled ? (
        <button onClick={onRemove} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 18, padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>
      ) : <span />}
    </div>

    {/* Gündeme Bağla satırı */}
    {(myTasks.length > 0 || item.agenda_item_id) && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, paddingLeft: 163 }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>📋 Gündeme Bağla:</span>
        {disabled ? (
          linkedTask ? (
            <span style={{
              fontSize: 11.5, padding: '2px 8px', borderRadius: 6,
              background: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid var(--blue-pale)', fontWeight: 600,
            }}>
              📋 {linkedTask.title}
            </span>
          ) : item.agenda_item_id ? (
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic' }}>Bağlı gündem</span>
          ) : null
        ) : (
          <select
            className="form-select"
            value={item.agenda_item_id || ''}
            onChange={e => onChange('agenda_item_id', e.target.value || null)}
            style={{ fontSize: 11.5, padding: '4px 8px', maxWidth: 420 }}
          >
            <option value="">Gündeme Bağlayın…</option>
            {myTasks.map(t => (
              <option key={t.id} value={t.id}>{t.title}{t.unit ? ` (${t.unit})` : ''}</option>
            ))}
          </select>
        )}
      </div>
    )}
    </div>
  );
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function DailyLog({ user, profile, linkedTask }) {
  const today = toLocalDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekOffset, setWeekOffset]     = useState(0);
  const [weekLogs, setWeekLogs]         = useState({});
  const [status, setStatus]             = useState('ofis');
  const [dayPeriod, setDayPeriod]       = useState('tam_gun'); // 'tam_gun' | 'ogleden_once' | 'ogleden_sonra'
  const [items, setItems]               = useState([newItem(linkedTask?.id || null)]);
  const [overtime, setOvertime]         = useState([]);
  const [notes, setNotes]               = useState('');
  const [submitted, setSubmitted]       = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [editing, setEditing]           = useState(false);
  const [autoSaveState, setAutoSaveState] = useState('idle');
  const [draft, setDraft]               = useState(false);
  const [myTasks, setMyTasks]           = useState([]);

  const autoSaveTimer = useRef(null);
  const loadingRef = useRef(false); // Yükleme sırasında auto-save'i engelle

  // ── KRITIK: Her render sonrası güncel state değerlerini tut
  // Bu sayede closure'lar eski state'i yakalamaz (stale closure bug fix)
  const stateRef = useRef({});
  useEffect(() => {
    stateRef.current = { submitted, editing, status, dayPeriod, items, overtime, notes, selectedDate };
  });

  const isNonWork = NON_WORK_STATUSES.includes(status);
  const isReadOnly = submitted && !editing;
  const targetMin = dayPeriod === 'tam_gun' ? 480 : 240; // Yarım gün = 4 saat

  // ── Hafta günleri
  const refDate = new Date();
  refDate.setDate(refDate.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(refDate);

  // ── Log yükle
  const loadLog = useCallback(async (dateStr) => {
    // ── KRITIK: Yükleme başlamadan önce mevcut auto-save timer'ı iptal et
    // Bu, eski tarihin verisiyle yeni tarihin kaydının üzerine yazılmasını engeller
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    loadingRef.current = true; // Auto-save engeli aç
    setAutoSaveState('idle');

    const { data } = await getDailyLog(user.id, dateStr);
    if (data) {
      setStatus(data.work_status || 'ofis');
      setDayPeriod(data.day_period || 'tam_gun');
      setItems(data.work_items?.length ? data.work_items.map(migrateItem) : [newItem()]);
      setOvertime((data.overtime_items || []).map(migrateItem));
      setNotes(data.notes || '');
      setSubmitted(data.submitted || false);
      setEditing(false);
      // Sadece gönderilmemiş ve içerik varsa taslak göster
      setDraft(!data.submitted && !!data.work_items?.length);
    } else {
      setStatus('ofis');
      setDayPeriod('tam_gun');
      setItems([newItem()]);
      setOvertime([]);
      setNotes('');
      setSubmitted(false);
      setEditing(false);
      setDraft(false);
    }

    // ── Kısa gecikme ile loading bayrağını kapat
    // Bu, loadLog'un tetiklediği state değişikliklerinin auto-save'i
    // yanlışlıkla tetiklemesini önler (React batching sonrası)
    setTimeout(() => { loadingRef.current = false; }, 100);
  }, [user.id]);

  // ── Hafta loglarını yükle
  const loadWeekLogs = useCallback(async () => {
    const dates = weekDates.map(d => toLocalDateStr(d));
    const { data } = await getWeekLogs(user.id, dates[0], dates[6]);
    const map = {};
    (data || []).forEach(r => { map[r.log_date] = r; });
    setWeekLogs(map);
  }, [user.id, weekOffset]);

  useEffect(() => { loadLog(selectedDate); }, [selectedDate]);
  useEffect(() => { loadWeekLogs(); }, [weekOffset, user.id]);

  // Birimdeki tüm gündemleri çek (iş kaydı bağlama için)
  useEffect(() => {
    if (!user?.id) return;
    const unit = profile?.unit || null;
    getUnitAgendas(unit).then(({ data }) => {
      setMyTasks(data || []);
    });
  }, [user.id, profile?.unit]);

  // ── Otomatik kaydet — stateRef kullanarak stale closure'ı önler
  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(async () => {
      // ── KRITIK GÜVENLİK: Yükleme sırasında auto-save yapma
      // loadLog devam ederken stateRef eski/boş veri içerebilir
      if (loadingRef.current) {
        setAutoSaveState('idle');
        return;
      }

      // Closure'dan değil, ref'ten oku — her zaman güncel değer
      const { submitted: sub, editing: ed, status: st, dayPeriod: dp, items: it, overtime: ot, notes: n, selectedDate: sd } = stateRef.current;

      // Gönderilmiş & düzenleme modunda değilse kaydetme
      if (sub && !ed) {
        setAutoSaveState('idle');
        return;
      }

      // ── KRITIK GÜVENLİK: Kaydetmeden önce DB'deki mevcut kaydı kontrol et
      // Eğer DB'de submitted=true ise, boş veriyle üzerine yazma
      try {
        const { data: existing } = await getDailyLog(user.id, sd);
        if (existing?.submitted) {
          console.warn('[AutoSave] DB kaydı submitted=true, auto-save iptal:', sd);
          setAutoSaveState('idle');
          return;
        }
      } catch (e) {
        console.error('[AutoSave] DB kontrol hatası:', e);
        setAutoSaveState('idle');
        return;
      }

      setAutoSaveState('saving');
      const totalMin = [...it, ...ot].reduce((s, x) => s + calcItemMinutes(x), 0);
      const { error } = await upsertDailyLog({
        user_id: user.id, log_date: sd,
        work_status: st, day_period: dp, work_items: it, overtime_items: ot,
        total_minutes: totalMin, notes: n, submitted: false,
      });
      setAutoSaveState(error ? 'error' : 'saved');
      if (!error) setDraft(true);
    }, AUTO_SAVE_DELAY);
  }, [user.id]); // user.id dışındaki her şey stateRef'ten geliyor

  // Kullanıcı değişikliklerinde auto-save tetikle
  useEffect(() => {
    // isReadOnly ise tetikleme (anlık kontrol için stateRef değil, render-time değeri)
    if (isReadOnly) return;
    // Yükleme sırasındaki state değişikliklerini auto-save'den hariç tut
    if (loadingRef.current) return;
    triggerAutoSave();
    setAutoSaveState('saving');
  }, [status, dayPeriod, items, overtime, notes]);

  // ── Gönder / Güncelle
  const handleSubmit = async () => {
    setSubmitting(true);
    const totalMin = [...items, ...overtime].reduce((s, x) => s + calcItemMinutes(x), 0);
    const { error } = await submitDailyLog({
      user_id: user.id, log_date: selectedDate,
      work_status: status, day_period: dayPeriod, work_items: items, overtime_items: overtime,
      total_minutes: totalMin, notes,
    });
    setSubmitting(false);
    if (!error) {
      setSubmitted(true);
      setEditing(false);
      setDraft(false);
      setAutoSaveState('idle');
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      loadWeekLogs();
      logActivity({ action: 'gönderdi', module: 'iş_kayıtları', entityType: 'günlük_kayıt', details: { log_date: selectedDate } });

      // ── XP: sadece personel, sadece ilk gönderimde (editing=false)
      if (profile?.role === 'personel' && !editing) {
        try {
          const xpS = await getXPSettings();
          const totalHours = Math.floor(totalMin / 60);
          const entryCount = items.filter(i => i.description?.trim()).length + overtime.filter(i => i.description?.trim()).length;

          // 1) Her iş kaydı başına XP
          if (entryCount > 0) {
            const entryXP = (xpS.daily_log_entry || 10) * entryCount;
            await awardXPCustom(user.id, 'daily_log_entry', entryXP, `${entryCount} iş kaydı eklendi (${selectedDate})`, selectedDate);
          }

          // 2) Her saat için XP (8 saate kadar)
          const normalHours = Math.min(totalHours, 8);
          if (normalHours > 0) {
            const hourXP = (xpS.daily_log_hour || 5) * normalHours;
            await awardXPCustom(user.id, 'daily_log_hour', hourXP, `${normalHours} saat mesai (${selectedDate})`, selectedDate);
          }

          // 3) 8 saat tam gün bonusu
          if (totalHours >= 8) {
            await awardXP(user.id, 'daily_log_fullday', `Tam gün çalışma (${selectedDate})`, selectedDate);
          }

          // 4) 8 saat sonrası fazla mesai — her saat x2
          const overtimeHours = Math.max(0, totalHours - 8);
          if (overtimeHours > 0) {
            const otXP = (xpS.daily_log_overtime || 10) * overtimeHours; // zaten x2 değeri DB'de
            await awardXPCustom(user.id, 'daily_log_overtime', otXP, `${overtimeHours} saat fazla mesai (${selectedDate})`, selectedDate);
          }

          // 5) Streak kontrolleri
          try {
            // Haftanın başını bul (Pazartesi)
            const selD = new Date(selectedDate + 'T12:00:00');
            const dayOfWeek = selD.getDay(); // 0=Pazar, 1=Pzt,...
            const diffToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
            const monday = new Date(selD);
            monday.setDate(selD.getDate() + diffToMonday);
            const weekStart = monday.toISOString().split('T')[0];
            const weekEnd = selectedDate;

            // Bu hafta kaç gün gönderilmiş?
            const { data: weekSubmitted } = await supabase
              .from('daily_logs')
              .select('log_date')
              .eq('user_id', user.id)
              .eq('submitted', true)
              .gte('log_date', weekStart)
              .lte('log_date', weekEnd);

            const weekDayCount = weekSubmitted?.length || 0;

            // first_login_week: Bu hafta ilk gönderim (1 gün)
            if (weekDayCount === 1) {
              const { data: existingFLW } = await supabase
                .from('xp_events').select('id').eq('user_id', user.id)
                .eq('action', 'first_login_week').gte('created_at', weekStart + 'T00:00:00').limit(1);
              if (!existingFLW || existingFLW.length === 0) {
                await awardXP(user.id, 'first_login_week', `Haftanın ilk kaydı (${weekStart})`, weekStart);
              }
            }

            // weekly_streak: Bu hafta 5 iş günü gönderildi
            if (weekDayCount >= 5) {
              const { data: existingWS } = await supabase
                .from('xp_events').select('id').eq('user_id', user.id)
                .eq('action', 'weekly_streak').gte('created_at', weekStart + 'T00:00:00').limit(1);
              if (!existingWS || existingWS.length === 0) {
                await awardXP(user.id, 'weekly_streak', `Haftalık seri tamamlandı (${weekStart})`, weekStart);
              }
            }

            // monthly_streak: Bu ay 20+ gün gönderildi
            const monthStart = selectedDate.slice(0, 7) + '-01';
            const { data: monthSubmitted } = await supabase
              .from('daily_logs')
              .select('log_date')
              .eq('user_id', user.id)
              .eq('submitted', true)
              .gte('log_date', monthStart)
              .lte('log_date', selectedDate);
            const monthDayCount = monthSubmitted?.length || 0;
            if (monthDayCount >= 20) {
              const { data: existingMS } = await supabase
                .from('xp_events').select('id').eq('user_id', user.id)
                .eq('action', 'monthly_streak').gte('created_at', monthStart + 'T00:00:00').limit(1);
              if (!existingMS || existingMS.length === 0) {
                await awardXP(user.id, 'monthly_streak', `Aylık seri tamamlandı (${monthStart.slice(0, 7)})`, monthStart);
              }
            }
          } catch (streakErr) { console.error('[XP] Streak error:', streakErr); }
        } catch (e) { console.error('[XP] DailyLog error:', e); }
      }
    }
  };

  // ── Item helpers
  const setItem      = (id, f, v) => setItems(p => p.map(i => i.id === id ? {...i, [f]: v} : i));
  const addItem      = () => setItems(p => [...p, newItem()]);
  const removeItem   = (id) => setItems(p => p.length > 1 ? p.filter(i => i.id !== id) : p);
  const setOtItem    = (id, f, v) => setOvertime(p => p.map(i => i.id === id ? {...i, [f]: v} : i));
  const addOtItem    = () => setOvertime(p => [...p, newItem()]);
  const removeOtItem = (id) => setOvertime(p => p.filter(i => i.id !== id));

  const totalMin = items.reduce((s, x) => s + calcItemMinutes(x), 0);
  const otMin    = overtime.reduce((s, x) => s + calcItemMinutes(x), 0);

  const selDateObj    = new Date(selectedDate + 'T12:00:00');
  const dayName       = DAYS_FULL[selDateObj.getDay()];
  const formattedDate = `${selDateObj.getDate()} ${MONTHS_TR[selDateObj.getMonth()]} ${selDateObj.getFullYear()}`;
  const w0 = weekDates[0], w6 = weekDates[6];
  const weekLabel = `${w0.getDate()} ${MONTHS_TR[w0.getMonth()]} — ${w6.getDate()} ${MONTHS_TR[w6.getMonth()]}`;

  return (
    <div className="page" style={{ maxWidth: 820, margin: '0 auto' }}>

      {/* BAŞLIK */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">📋 Günlük İş Kayıtları</h1>
            <p className="page-subtitle">
              {profile?.full_name || user?.email?.split('@')[0]} ·{' '}
              {ROLE_LABELS[profile?.role] || 'Personel'}
              {profile?.unit ? ` · ${profile.unit}` : ''}
            </p>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {!isReadOnly && autoSaveState === 'saving' && <><span style={{ color: 'var(--orange)' }}>●</span> Kaydediliyor…</>}
            {!isReadOnly && autoSaveState === 'saved'  && <><span style={{ color: 'var(--green)' }}>●</span> Otomatik kaydedildi</>}
            {!isReadOnly && autoSaveState === 'error'  && <><span style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ Otomatik kayıt başarısız — lütfen internet bağlantınızı kontrol edin</span></>}
          </div>
        </div>
      </div>

      {/* TASLAK BANNER — sadece gönderilmemiş günler için */}
      {draft && !submitted && !editing && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderRadius: 10, marginBottom: 16,
          background: 'var(--navy-pale,#eef2f8)', border: '1px solid var(--navy)22', fontSize: 13,
        }}>
          <span>💾 Kaydedilmiş taslak bulundu. Devam etmek ister misiniz?</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setDraft(false)}>Devam Et</button>
            <button className="btn btn-outline btn-sm" style={{ color: 'var(--red)' }}
              onClick={() => { setItems([newItem()]); setStatus('ofis'); setNotes(''); setDraft(false); }}>
              Sil
            </button>
          </div>
        </div>
      )}

      {/* GONDERİLMİŞ BANNER — sayfanın üstünde belirgin şekilde */}
      {submitted && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderRadius: 12, marginBottom: 16,
          background: editing
            ? 'linear-gradient(135deg, var(--orange-pale) 0%, var(--orange-pale) 100%)'
            : 'linear-gradient(135deg, var(--green-pale) 0%, var(--green-pale) 100%)',
          border: `1.5px solid ${editing ? 'var(--gold)' : 'var(--green)'}44`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 26 }}>{editing ? '✏️' : '✅'}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: editing ? 'var(--orange)' : 'var(--green)' }}>
                {editing
                  ? `${dayName} logu düzenleniyor…`
                  : `${dayName} çalışma kaydı gönderildi ve kaydedildi`}
              </div>
              {!editing && totalMin > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Toplam çalışma: <strong>{fmtMins(totalMin)}</strong>
                  {otMin > 0 && <> · Mesai: <strong>{fmtMins(otMin)}</strong></>}
                  {' · '}<StatusBadge status={status} />
                </div>
              )}
              {editing && (
                <div style={{ fontSize: 12, color: 'var(--orange)', marginTop: 2 }}>
                  Değişikliklerinizi kaydetmek için "Güncelle" butonuna basın
                </div>
              )}
            </div>
          </div>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              style={{
                padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                border: '1.5px solid var(--navy)44', background: 'var(--bg-card)',
                cursor: 'pointer', color: 'var(--navy)', fontFamily: 'var(--font-body)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              ✏️ Düzenle
            </button>
          ) : (
            <button
              onClick={() => { setEditing(false); loadLog(selectedDate); }}
              style={{
                padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                border: '1.5px solid var(--orange)44', background: 'var(--bg-card)',
                cursor: 'pointer', color: 'var(--orange)', fontFamily: 'var(--font-body)',
              }}
            >
              İptal
            </button>
          )}
        </div>
      )}

      {/* HAFTA TAKVİMİ */}
      <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={() => setWeekOffset(w => w - 1)} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', padding: '2px 8px',
          }}>←</button>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
            BU HAFTA — {weekLabel}
          </span>
          <button onClick={() => setWeekOffset(w => w + 1)} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', padding: '2px 8px',
          }}>→</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
          {weekDates.map(d => {
            const ds     = toLocalDateStr(d);
            const isToday = ds === today;
            const isSel   = ds === selectedDate;
            const log     = weekLogs[ds];
            const isWknd  = d.getDay() === 0 || d.getDay() === 6;

            // Renk: gönderilmiş=yeşil, taslak=turuncu, boş=gri
            const dotColor = log
              ? (log.submitted ? '#16a34a' : 'var(--orange)')
              : null;

            return (
              <button key={ds} onClick={() => setSelectedDate(ds)} style={{
                padding: '10px 4px', borderRadius: 10, cursor: 'pointer', border: 'none',
                background: isSel ? 'var(--navy)' : isToday ? 'var(--navy-pale,#eef2f8)' : 'var(--surface)',
                boxShadow: isSel ? '0 2px 8px rgba(26,58,92,0.25)' : undefined,
                outline: isToday && !isSel ? '2px solid var(--navy)' : undefined,
                opacity: isWknd ? 0.55 : 1,
                fontFamily: 'var(--font-body)',
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: isSel ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)', marginBottom: 3 }}>
                  {DAYS_TR[d.getDay()]}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: isSel ? 'white' : 'var(--text)', marginBottom: 4 }}>
                  {String(d.getDate()).padStart(2, '0')}/{String(d.getMonth() + 1).padStart(2, '0')}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 8 }}>
                  {dotColor ? (
                    <span title={log.submitted ? 'Gönderildi' : 'Taslak'} style={{
                      display: 'block', width: log.submitted ? 8 : 6, height: log.submitted ? 8 : 6,
                      borderRadius: '50%', background: dotColor,
                      boxShadow: log.submitted ? `0 0 0 2px ${dotColor}33` : undefined,
                    }} />
                  ) : (
                    <span style={{ display: 'block', width: 6, height: 6, borderRadius: '50%', background: isSel ? 'rgba(255,255,255,0.3)' : 'var(--border)' }} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {/* Takvim açıklaması */}
        <div style={{ display: 'flex', gap: 16, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', justifyContent: 'flex-end' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block', boxShadow: '0 0 0 2px #16a34a33' }} />
            Gönderildi
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--orange)', display: 'inline-block' }} />
            Taslak
          </span>
        </div>
      </div>

      {/* GÜN BAŞLIĞI (submitted olmayan günler için) */}
      {!submitted && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16, padding: '14px 20px', borderRadius: 12,
          background: 'var(--surface)', border: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--navy)' }}>{dayName}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{formattedDate}</div>
          </div>
          <StatusBadge status={status} />
        </div>
      )}

      {/* ÇALIŞMA DURUMU */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 12.5, letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 12 }}>
          ÇALIŞMA DURUMU
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {WORK_STATUS.map(s => (
            <button key={s.value}
              disabled={isReadOnly}
              onClick={() => !isReadOnly && setStatus(s.value)}
              style={{
                padding: '10px 8px', borderRadius: 10, cursor: isReadOnly ? 'default' : 'pointer',
                border: `2px solid ${status === s.value ? s.color : 'var(--border)'}`,
                background: status === s.value ? s.color + '14' : 'var(--surface)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                fontFamily: 'var(--font-body)', transition: 'all 0.15s',
                opacity: isReadOnly ? 0.65 : 1,
                pointerEvents: isReadOnly ? 'none' : 'auto',
              }}>
              <span style={{ fontSize: 20 }}>{s.icon}</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: status === s.value ? s.color : 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3 }}>
                {s.label}
              </span>
            </button>
          ))}
        </div>

        {/* GÜN PERİYODU */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {[
            { value: 'tam_gun',        label: 'Tam Gün',          icon: '☀️' },
            { value: 'ogleden_once',    label: 'Öğleden Önce',     icon: '🌅' },
            { value: 'ogleden_sonra',   label: 'Öğleden Sonra',    icon: '🌇' },
          ].map(p => (
            <button key={p.value}
              disabled={isReadOnly}
              onClick={() => !isReadOnly && setDayPeriod(p.value)}
              style={{
                flex: 1, padding: '8px 6px', borderRadius: 8, cursor: isReadOnly ? 'default' : 'pointer',
                border: `2px solid ${dayPeriod === p.value ? 'var(--primary)' : 'var(--border)'}`,
                background: dayPeriod === p.value ? 'var(--primary-light)' : 'var(--surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                fontFamily: 'var(--font-body)', transition: 'all 0.15s',
                opacity: isReadOnly ? 0.65 : 1,
                pointerEvents: isReadOnly ? 'none' : 'auto',
              }}>
              <span style={{ fontSize: 14 }}>{p.icon}</span>
              <span style={{ fontSize: 11, fontWeight: dayPeriod === p.value ? 700 : 500, color: dayPeriod === p.value ? 'var(--primary)' : 'var(--text-muted)' }}>
                {p.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* İŞ KALEMLERİ — tüm durumlarda göster (izin günlerinde isteğe bağlı) */}
        <>
          <div className="card" style={{
            marginBottom: 16,
            opacity: isReadOnly ? 0.85 : 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 12.5, letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                İŞ KALEMLERİ &nbsp;·&nbsp; {formattedDate}
              </div>
              {isReadOnly && (
                <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600, background: 'var(--green-pale)', borderRadius: 6, padding: '3px 8px' }}>
                  🔒 Gönderildi
                </span>
              )}
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: '155px 1fr auto 32px',
              gap: 8, marginBottom: 8,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)', padding: '0 4px',
            }}>
              <span>KATEGORİ</span>
              <span>YAPILAN İŞ</span>
              <span>BAŞLANGIÇ → BİTİŞ &nbsp;·&nbsp; TÜM GÜN</span>
              <span />
            </div>

            {/* linkedTask banner */}
            {linkedTask && (
              <div style={{
                marginBottom: 12, padding: '8px 12px', borderRadius: 8,
                background: 'var(--primary-light)', border: '1px solid var(--blue-pale)',
                fontSize: 12.5, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                📋 <strong>{linkedTask.title}</strong> gündemine bağlanarak açıldı — ilk iş kaleminde gündeme bağlı
              </div>
            )}

            {items.map(item => (
              <WorkItemRow
                key={item.id}
                item={item}
                disabled={isReadOnly}
                onChange={(f, v) => setItem(item.id, f, v)}
                onRemove={() => removeItem(item.id)}
                myTasks={myTasks}
              />
            ))}

            {/* İş kalemi ekle — sadece düzenleme modunda */}
            {!isReadOnly ? (
              <button onClick={addItem} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '10px 16px', borderRadius: 10, border: '2px dashed var(--border)',
                background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)',
                fontSize: 13, fontFamily: 'var(--font-body)', marginTop: 4, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--navy)'; e.currentTarget.style.color = 'var(--navy)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> İş kalemi ekle
              </button>
            ) : (
              <div style={{
                padding: '10px 16px', borderRadius: 10, border: '2px dashed var(--border)',
                background: 'var(--surface)', color: 'var(--text-muted)',
                fontSize: 12, textAlign: 'center', marginTop: 4,
                opacity: 0.5,
              }}>
                İş kalemi eklemek için "Düzenle" butonuna basın
              </div>
            )}

            {/* Toplam */}
            <div style={{
              display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8,
              marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Toplam:</span>
              <span style={{
                fontSize: 17, fontWeight: 700,
                color: totalMin >= targetMin ? 'var(--green)' : totalMin > 0 ? 'var(--navy)' : 'var(--text-muted)',
                fontFamily: 'var(--font-display)',
              }}>
                {totalMin > 0 ? fmtMins(totalMin) : '—'}
              </span>
              {totalMin > 0 && totalMin < targetMin && !isNonWork && (
                <span style={{ fontSize: 11, color: 'var(--orange)' }}>({fmtMins(targetMin - totalMin)} eksik)</span>
              )}
            </div>
          </div>

          {/* MESAİ */}
          {(overtime.length > 0 || !isReadOnly) && (
            <div className="card" style={{ marginBottom: 16, opacity: isReadOnly ? 0.85 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 12.5, letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                  ⏰ MESAİ (İSTEĞE BAĞLI)
                </div>
                {isReadOnly && overtime.length === 0 && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mesai girilmemiş</span>
                )}
              </div>
              {overtime.map(item => (
                <WorkItemRow
                  key={item.id}
                  item={item}
                  disabled={isReadOnly}
                  onChange={(f, v) => setOtItem(item.id, f, v)}
                  onRemove={() => removeOtItem(item.id)}
                  myTasks={myTasks}
                />
              ))}
              {!isReadOnly ? (
                <button onClick={addOtItem} style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 16px',
                  borderRadius: 10, border: '2px dashed var(--orange)44', background: 'transparent',
                  cursor: 'pointer', color: 'var(--orange)', fontSize: 13, fontFamily: 'var(--font-body)', transition: 'all 0.15s',
                }}>
                  <span style={{ fontSize: 18 }}>+</span> Mesai ekle
                </button>
              ) : overtime.length === 0 ? null : null}
              {otMin > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Mesai: </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--orange)', marginLeft: 6 }}>
                    {fmtMins(otMin)}
                  </span>
                </div>
              )}
            </div>
          )}
        </>

      {/* İZİN / ÇALIŞMIYOR — durum bilgisi */}
      {isNonWork && (
        <div className="card" style={{ marginBottom: 16, textAlign: 'center', padding: '24px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>
            {WORK_STATUS.find(s => s.value === status)?.icon}
          </div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--navy)', marginBottom: 4 }}>
            {WORK_STATUS.find(s => s.value === status)?.label}
          </div>
          {items.filter(i => i.description?.trim()).length === 0 && !isReadOnly && (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
              Yine de bir iş yaptıysanız aşağıya iş kalemi ekleyebilirsiniz.
            </div>
          )}
        </div>
      )}

      {/* NOTLAR */}
      {!isReadOnly ? (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 12.5, letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>
            NOT (İSTEĞE BAĞLI)
          </div>
          <textarea
            className="form-input"
            rows={2}
            placeholder="Varsa günlük not veya açıklama…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{ resize: 'vertical', fontSize: 13 }}
          />
        </div>
      ) : notes ? (
        <div className="card" style={{ marginBottom: 20, padding: '12px 16px' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>NOT &nbsp;</span>
          <span style={{ fontSize: 13 }}>{notes}</span>
        </div>
      ) : null}

      {/* GÖNDER / GÜNCELLE BUTONU — sadece düzenleme veya yeni kayıt */}
      {!isReadOnly && (
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={submitting || (!isNonWork && totalMin === 0)}
          style={{
            width: '100%', padding: '15px', fontSize: 15, fontWeight: 700,
            borderRadius: 12, marginBottom: 20,
            opacity: (!isNonWork && totalMin === 0) ? 0.5 : 1,
            background: editing ? 'var(--orange,#f59e0b)' : undefined,
          }}>
          {submitting
            ? '⏳ Kaydediliyor…'
            : editing
              ? `💾 ${dayName} Logunu Güncelle →`
              : `${dayName}'yi Gönder →`}
        </button>
      )}

    </div>
  );
}
