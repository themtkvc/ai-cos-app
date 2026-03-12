import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getDailyLog, upsertDailyLog, submitDailyLog, getWeekLogs } from '../lib/supabase';
import { ROLE_LABELS } from '../App';

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

const DAYS_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
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

function newItem() {
  return { id: Date.now() + Math.random(), category: '', description: '', duration_minutes: '' };
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

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function DailyLog({ user, profile }) {
  const today = toLocalDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekOffset, setWeekOffset]     = useState(0);
  const [weekLogs, setWeekLogs]         = useState({});   // date → log row
  const [status, setStatus]             = useState('ofis');
  const [items, setItems]               = useState([newItem()]);
  const [overtime, setOvertime]         = useState([]);
  const [notes, setNotes]               = useState('');
  const [submitted, setSubmitted]       = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [autoSaveState, setAutoSaveState] = useState('idle'); // idle | saving | saved | error
  const [draft, setDraft]               = useState(false);
  const autoSaveTimer                   = useRef(null);
  const isNonWork = NON_WORK_STATUSES.includes(status);

  // ── Hafta günleri
  const refDate = new Date();
  refDate.setDate(refDate.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(refDate);

  // ── Log yükle (seçili gün değişince)
  const loadLog = useCallback(async (dateStr) => {
    const { data } = await getDailyLog(user.id, dateStr);
    if (data) {
      setStatus(data.work_status || 'ofis');
      setItems(data.work_items?.length ? data.work_items : [newItem()]);
      setOvertime(data.overtime_items || []);
      setNotes(data.notes || '');
      setSubmitted(data.submitted || false);
      setDraft(!data.submitted);
    } else {
      setStatus('ofis');
      setItems([newItem()]);
      setOvertime([]);
      setNotes('');
      setSubmitted(false);
      setDraft(false);
    }
  }, [user.id]);

  // ── Hafta loglarını yükle (badge için)
  const loadWeekLogs = useCallback(async () => {
    const dates = weekDates.map(d => toLocalDateStr(d));
    const { data } = await getWeekLogs(user.id, dates[0], dates[6]);
    const map = {};
    (data || []).forEach(r => { map[r.log_date] = r; });
    setWeekLogs(map);
  }, [user.id, weekOffset]);

  useEffect(() => { loadLog(selectedDate); }, [selectedDate]);
  useEffect(() => { loadWeekLogs(); }, [weekOffset, user.id]);

  // ── Otomatik kaydet
  const triggerAutoSave = useCallback(() => {
    if (submitted) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setAutoSaveState('saving');
    autoSaveTimer.current = setTimeout(async () => {
      const totalMin = [...items, ...overtime].reduce((s, x) => s + (parseInt(x.duration_minutes) || 0), 0);
      const { error } = await upsertDailyLog({
        user_id: user.id, log_date: selectedDate,
        work_status: status, work_items: items, overtime_items: overtime,
        total_minutes: totalMin, notes, submitted: false,
      });
      setAutoSaveState(error ? 'error' : 'saved');
      setDraft(true);
    }, AUTO_SAVE_DELAY);
  }, [submitted, user.id, selectedDate, status, items, overtime, notes]);

  // Herhangi bir değişiklikte otomatik kaydet
  useEffect(() => { triggerAutoSave(); }, [status, items, overtime, notes]);

  // ── Gönder
  const handleSubmit = async () => {
    setSubmitting(true);
    const totalMin = [...items, ...overtime].reduce((s, x) => s + (parseInt(x.duration_minutes) || 0), 0);
    const { error } = await submitDailyLog({
      user_id: user.id, log_date: selectedDate,
      work_status: status, work_items: items, overtime_items: overtime,
      total_minutes: totalMin, notes,
    });
    setSubmitting(false);
    if (!error) {
      setSubmitted(true);
      setDraft(false);
      setAutoSaveState('idle');
      loadWeekLogs();
    }
  };

  // ── İş kalemi işlemleri
  const setItem = (id, field, val) => setItems(prev => prev.map(i => i.id === id ? {...i, [field]: val} : i));
  const addItem  = () => setItems(prev => [...prev, newItem()]);
  const removeItem = (id) => setItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev);

  const setOtItem = (id, field, val) => setOvertime(prev => prev.map(i => i.id === id ? {...i, [field]: val} : i));
  const addOtItem  = () => setOvertime(prev => [...prev, newItem()]);
  const removeOtItem = (id) => setOvertime(prev => prev.filter(i => i.id !== id));

  const totalMin = items.reduce((s, x) => s + (parseInt(x.duration_minutes) || 0), 0);
  const otMin    = overtime.reduce((s, x) => s + (parseInt(x.duration_minutes) || 0), 0);

  const selDateObj = new Date(selectedDate + 'T12:00:00');
  const dayName    = DAYS_FULL[selDateObj.getDay()];
  const formattedDate = `${selDateObj.getDate()} ${MONTHS_TR[selDateObj.getMonth()]} ${selDateObj.getFullYear()}`;

  // ── Hafta için navigasyon adı
  const w0 = weekDates[0], w6 = weekDates[6];
  const weekLabel = `${w0.getDate()} ${MONTHS_TR[w0.getMonth()]} — ${w6.getDate()} ${MONTHS_TR[w6.getMonth()]}`;

  return (
    <div className="page" style={{maxWidth: 720, margin: '0 auto'}}>

      {/* BAŞLIK */}
      <div className="page-header" style={{marginBottom: 20}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div>
            <h1 className="page-title">📋 Günlük İş Logu</h1>
            <p className="page-subtitle">
              {profile?.full_name || user?.email?.split('@')[0]} ·{' '}
              {ROLE_LABELS[profile?.role] || 'Personel'}
              {profile?.unit ? ` · ${profile.unit}` : ''}
            </p>
          </div>
          {/* Otomatik kayıt durumu */}
          <div style={{fontSize: 12, color: 'var(--text-muted)', display:'flex', alignItems:'center', gap:6}}>
            {autoSaveState === 'saving' && <><span style={{color:'var(--orange)'}}>●</span> Kaydediliyor…</>}
            {autoSaveState === 'saved'  && <><span style={{color:'var(--green)'}}>●</span> Otomatik kaydedildi</>}
            {autoSaveState === 'error'  && <><span style={{color:'var(--red)'}}>●</span> Kayıt hatası</>}
          </div>
        </div>
      </div>

      {/* TASLAK BANNER */}
      {draft && !submitted && (
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'10px 16px', borderRadius:10, marginBottom:16,
          background:'var(--navy-pale,#eef2f8)', border:'1px solid var(--navy)22', fontSize:13,
        }}>
          <span>💾 Kaydedilmiş taslak bulundu. Devam etmek ister misiniz?</span>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-primary btn-sm" onClick={() => setDraft(false)}>Devam Et</button>
            <button className="btn btn-outline btn-sm" style={{color:'var(--red)'}}
              onClick={() => { setItems([newItem()]); setStatus('ofis'); setNotes(''); setDraft(false); }}>
              Sil
            </button>
          </div>
        </div>
      )}

      {/* HAFTA TAKVİMİ */}
      <div className="card" style={{marginBottom:16, padding:'16px 20px'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
          <button onClick={() => setWeekOffset(w => w - 1)} style={{
            background:'none', border:'none', cursor:'pointer', fontSize:18, color:'var(--text-muted)', padding:'2px 8px'
          }}>←</button>
          <span style={{fontSize:12.5, fontWeight:600, color:'var(--text-muted)', letterSpacing:'0.04em'}}>
            BU HAFTA — {weekLabel}
          </span>
          <button onClick={() => setWeekOffset(w => w + 1)} style={{
            background:'none', border:'none', cursor:'pointer', fontSize:18, color:'var(--text-muted)', padding:'2px 8px'
          }}>→</button>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6}}>
          {weekDates.map(d => {
            const ds = toLocalDateStr(d);
            const isToday = ds === today;
            const isSel   = ds === selectedDate;
            const log     = weekLogs[ds];
            const isWknd  = d.getDay() === 0 || d.getDay() === 6;
            const ws      = WORK_STATUS.find(s => s.value === log?.work_status);

            return (
              <button key={ds} onClick={() => setSelectedDate(ds)} style={{
                padding: '10px 4px', borderRadius: 10, cursor: 'pointer', border: 'none',
                background: isSel ? 'var(--navy)' : isToday ? 'var(--navy-pale,#eef2f8)' : 'var(--surface)',
                boxShadow: isSel ? '0 2px 8px rgba(26,58,92,0.25)' : undefined,
                outline: isToday && !isSel ? '2px solid var(--navy)' : undefined,
                opacity: isWknd ? 0.55 : 1,
                fontFamily: 'var(--font-body)',
              }}>
                <div style={{fontSize: 10, fontWeight: 600, color: isSel ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)', marginBottom:3}}>
                  {DAYS_TR[d.getDay()]}
                </div>
                <div style={{fontSize: 13, fontWeight: 700, color: isSel ? 'white' : 'var(--text)', marginBottom:4}}>
                  {String(d.getDate()).padStart(2,'0')}/{String(d.getMonth()+1).padStart(2,'0')}
                </div>
                {/* Status dot */}
                <div style={{display:'flex', justifyContent:'center'}}>
                  {log ? (
                    <span title={ws?.label || ''} style={{
                      display:'block', width:6, height:6, borderRadius:'50%',
                      background: log.submitted ? (ws?.color || 'var(--green)') : 'var(--orange)',
                    }}/>
                  ) : (
                    <span style={{display:'block', width:6, height:6, borderRadius:'50%', background: isSel ? 'rgba(255,255,255,0.3)' : 'var(--border)'}}/>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* GÜN BAŞLIĞI */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:16, padding:'14px 20px', borderRadius:12,
        background: submitted ? 'var(--green-pale,#edfaf4)' : 'var(--surface)',
        border: `1px solid ${submitted ? 'var(--green)33' : 'var(--border)'}`,
      }}>
        <div>
          <div style={{fontWeight:700, fontSize:18, color:'var(--navy)'}}>{dayName}</div>
          <div style={{fontSize:13, color:'var(--text-muted)', marginTop:2}}>{formattedDate}</div>
        </div>
        {submitted && <StatusBadge status={status} />}
        {submitted && <span style={{fontSize:12,fontWeight:600,color:'var(--green)'}}>✓ Gönderildi</span>}
      </div>

      {/* ÇALIŞMA DURUMU */}
      <div className="card" style={{marginBottom:16}}>
        <div style={{fontWeight:700, fontSize:12.5, letterSpacing:'0.06em', color:'var(--text-muted)', marginBottom:12}}>
          ÇALIŞMA DURUMU
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8}}>
          {WORK_STATUS.map(s => (
            <button key={s.value}
              disabled={submitted}
              onClick={() => !submitted && setStatus(s.value)}
              style={{
                padding:'10px 8px', borderRadius:10, cursor: submitted ? 'default' : 'pointer',
                border: `2px solid ${status === s.value ? s.color : 'var(--border)'}`,
                background: status === s.value ? s.color + '14' : 'var(--surface)',
                display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                fontFamily:'var(--font-body)', transition:'all 0.15s',
                opacity: submitted ? 0.7 : 1,
              }}>
              <span style={{fontSize:20}}>{s.icon}</span>
              <span style={{fontSize:10.5, fontWeight:600, color: status === s.value ? s.color : 'var(--text-muted)',
                textAlign:'center', lineHeight:1.3}}>
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* İŞ KALEMLERİ — yalnızca çalışma durumlarında */}
      {!isNonWork && (
        <>
          <div className="card" style={{marginBottom:16}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14}}>
              <div style={{fontWeight:700, fontSize:12.5, letterSpacing:'0.06em', color:'var(--text-muted)'}}>
                {DAYS_TR[selDateObj.getDay()].toUpperCase()}EMBE İŞ KALEMLERİ &nbsp;·&nbsp; {selDateObj.getDate()}/{String(selDateObj.getMonth()+1).padStart(2,'0')}
              </div>
            </div>

            {/* Başlık satırı */}
            <div style={{display:'grid', gridTemplateColumns:'180px 1fr 90px 32px', gap:8, marginBottom:8,
              fontSize:11, fontWeight:700, letterSpacing:'0.05em', color:'var(--text-muted)', padding:'0 4px'}}>
              <span>KATEGORİ</span><span>YAPILAN İŞ</span><span style={{textAlign:'right'}}>SÜRE (DK)</span><span/>
            </div>

            {items.map((item, idx) => (
              <div key={item.id} style={{display:'grid', gridTemplateColumns:'180px 1fr 90px 32px', gap:8, marginBottom:8, alignItems:'center'}}>
                <select
                  className="form-select"
                  value={item.category}
                  disabled={submitted}
                  onChange={e => setItem(item.id, 'category', e.target.value)}
                  style={{fontSize:12.5, padding:'7px 10px'}}
                >
                  <option value="">Kategori seç…</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  className="form-input"
                  placeholder="Ne yaptınız?"
                  value={item.description}
                  disabled={submitted}
                  onChange={e => setItem(item.id, 'description', e.target.value)}
                  style={{fontSize:12.5, padding:'7px 10px'}}
                />
                <div style={{display:'flex', alignItems:'center', gap:4, border:'1px solid var(--border)',
                  borderRadius:8, padding:'5px 8px', background: submitted ? 'var(--surface)' : 'white'}}>
                  <button onClick={() => !submitted && setItem(item.id, 'duration_minutes',
                    Math.max(0, (parseInt(item.duration_minutes)||0) - 15))}
                    disabled={submitted}
                    style={{background:'none',border:'none',cursor:'pointer',fontSize:14,color:'var(--text-muted)',padding:'0 2px'}}>—</button>
                  <input
                    type="number" min="0" step="15"
                    value={item.duration_minutes}
                    disabled={submitted}
                    onChange={e => setItem(item.id, 'duration_minutes', e.target.value)}
                    placeholder="0"
                    style={{
                      width:32, border:'none', outline:'none', textAlign:'center',
                      fontSize:12.5, fontWeight:600, background:'transparent',
                      color: parseInt(item.duration_minutes) > 0 ? 'var(--navy)' : 'var(--text-muted)',
                    }}
                  />
                  <span style={{fontSize:11, color:'var(--text-muted)'}}>dk</span>
                </div>
                {!submitted && (
                  <button onClick={() => removeItem(item.id)} style={{
                    background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)',
                    fontSize:16, padding:0, display:'flex', alignItems:'center', justifyContent:'center',
                  }}>×</button>
                )}
              </div>
            ))}

            {/* Ekle butonu */}
            {!submitted && (
              <button onClick={addItem} style={{
                display:'flex', alignItems:'center', gap:8, width:'100%',
                padding:'10px 16px', borderRadius:10, border:'2px dashed var(--border)',
                background:'transparent', cursor:'pointer', color:'var(--text-muted)',
                fontSize:13, fontFamily:'var(--font-body)', marginTop:4, transition:'all 0.15s',
              }}
              onMouseEnter={e => {e.currentTarget.style.borderColor='var(--navy)'; e.currentTarget.style.color='var(--navy)';}}
              onMouseLeave={e => {e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text-muted)';}}>
                <span style={{fontSize:18, lineHeight:1}}>+</span> İş kalemi ekle
              </button>
            )}

            {/* Toplam */}
            <div style={{
              display:'flex', justifyContent:'flex-end', alignItems:'center', gap:8,
              marginTop:14, paddingTop:12, borderTop:'1px solid var(--border)'
            }}>
              <span style={{fontSize:13, color:'var(--text-muted)'}}>Toplam:</span>
              <span style={{
                fontSize:17, fontWeight:700,
                color: totalMin >= 480 ? 'var(--green)' : totalMin > 0 ? 'var(--navy)' : 'var(--text-muted)',
                fontFamily:'var(--font-display)',
              }}>
                {totalMin > 0 ? `${Math.floor(totalMin/60)}s ${totalMin%60}dk` : '0 dk'}
              </span>
              {totalMin > 0 && totalMin < 480 && (
                <span style={{fontSize:11, color:'var(--orange)'}}>({480-totalMin} dk eksik)</span>
              )}
            </div>
          </div>

          {/* MESAİ */}
          {(overtime.length > 0 || !submitted) && (
            <div className="card" style={{marginBottom:16}}>
              <div style={{fontWeight:700, fontSize:12.5, letterSpacing:'0.06em', color:'var(--text-muted)', marginBottom:12}}>
                ⏰ MESAİ (İSTEĞE BAĞLI)
              </div>
              {overtime.map(item => (
                <div key={item.id} style={{display:'grid', gridTemplateColumns:'180px 1fr 90px 32px', gap:8, marginBottom:8, alignItems:'center'}}>
                  <select className="form-select" value={item.category} disabled={submitted}
                    onChange={e => setOtItem(item.id, 'category', e.target.value)}
                    style={{fontSize:12.5, padding:'7px 10px'}}>
                    <option value="">Kategori seç…</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input className="form-input" placeholder="Ne yaptınız?" value={item.description}
                    disabled={submitted} onChange={e => setOtItem(item.id, 'description', e.target.value)}
                    style={{fontSize:12.5, padding:'7px 10px'}} />
                  <div style={{display:'flex', alignItems:'center', gap:4, border:'1px solid var(--border)',
                    borderRadius:8, padding:'5px 8px'}}>
                    <button onClick={() => !submitted && setOtItem(item.id, 'duration_minutes',
                      Math.max(0, (parseInt(item.duration_minutes)||0) - 15))}
                      disabled={submitted} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,color:'var(--text-muted)',padding:'0 2px'}}>—</button>
                    <input type="number" min="0" step="15" value={item.duration_minutes}
                      disabled={submitted} onChange={e => setOtItem(item.id, 'duration_minutes', e.target.value)}
                      placeholder="0" style={{width:32,border:'none',outline:'none',textAlign:'center',fontSize:12.5,fontWeight:600,background:'transparent'}} />
                    <span style={{fontSize:11, color:'var(--text-muted)'}}>dk</span>
                  </div>
                  {!submitted && (
                    <button onClick={() => removeOtItem(item.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:16,padding:0}}>×</button>
                  )}
                </div>
              ))}
              {!submitted && (
                <button onClick={addOtItem} style={{
                  display:'flex', alignItems:'center', gap:8, width:'100%', padding:'10px 16px',
                  borderRadius:10, border:'2px dashed var(--orange)44', background:'transparent',
                  cursor:'pointer', color:'var(--orange)', fontSize:13, fontFamily:'var(--font-body)', transition:'all 0.15s',
                }}>
                  <span style={{fontSize:18}}>+</span> Mesai ekle
                </button>
              )}
              {otMin > 0 && (
                <div style={{display:'flex',justifyContent:'flex-end',marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)'}}>
                  <span style={{fontSize:13,color:'var(--text-muted)'}}>Mesai: </span>
                  <span style={{fontSize:14,fontWeight:700,color:'var(--orange)',marginLeft:6}}>
                    {Math.floor(otMin/60)}s {otMin%60}dk
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* İZİN/ÇALIŞMIYOR MESAJI */}
      {isNonWork && (
        <div className="card" style={{marginBottom:16, textAlign:'center', padding:32}}>
          <div style={{fontSize:40, marginBottom:12}}>
            {WORK_STATUS.find(s => s.value === status)?.icon}
          </div>
          <div style={{fontWeight:700, fontSize:16, color:'var(--navy)', marginBottom:6}}>
            {WORK_STATUS.find(s => s.value === status)?.label}
          </div>
          <div style={{fontSize:13, color:'var(--text-muted)'}}>
            Bu gün için iş kalemi girilmez.
          </div>
        </div>
      )}

      {/* NOTLAR */}
      {!submitted && (
        <div className="card" style={{marginBottom:20}}>
          <div style={{fontWeight:700, fontSize:12.5, letterSpacing:'0.06em', color:'var(--text-muted)', marginBottom:10}}>
            NOT (İSTEĞE BAĞLI)
          </div>
          <textarea
            className="form-input"
            rows={2}
            placeholder="Varsa günlük not veya açıklama…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{resize:'vertical', fontSize:13}}
          />
        </div>
      )}
      {submitted && notes && (
        <div className="card" style={{marginBottom:20, padding:'12px 16px'}}>
          <span style={{fontSize:12, color:'var(--text-muted)', fontWeight:600}}>NOT &nbsp;</span>
          <span style={{fontSize:13}}>{notes}</span>
        </div>
      )}

      {/* GÖNDER BUTONU */}
      {submitted ? (
        <div style={{
          padding:'14px 20px', borderRadius:12, background:'var(--green-pale,#edfaf4)',
          border:'1px solid var(--green)33', textAlign:'center', color:'var(--green)',
          fontWeight:700, fontSize:14, marginBottom:20,
        }}>
          ✓ {dayName} logu gönderildi
        </div>
      ) : (
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={submitting || (!isNonWork && totalMin === 0)}
          style={{
            width:'100%', padding:'15px', fontSize:15, fontWeight:700,
            borderRadius:12, marginBottom:20,
            opacity: (!isNonWork && totalMin === 0) ? 0.5 : 1,
          }}>
          {submitting ? '⏳ Gönderiliyor…' : `${dayName}'yi Gönder →`}
        </button>
      )}

    </div>
  );
}
