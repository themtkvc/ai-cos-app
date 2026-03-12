import React, { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, LabelList,
} from 'recharts';

// ── Colours ───────────────────────────────────────────────────────────────────
const PALETTE = ['#1a3a5c','#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#db2777'];
const softBg  = (i) => PALETTE[i % PALETTE.length] + '22';
const fmtColor = (i) => PALETTE[i % PALETTE.length];

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseAmount(val) {
  if (typeof val === 'number') return val;
  if (!val && val !== 0) return 0;
  const s = val.toString().replace(/\s/g, '');
  // Turkish format: 1.234,56
  if (/\d{1,3}(\.\d{3})+,\d+/.test(s)) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  }
  // Remove everything except digits, comma, dot, minus
  const clean = s.replace(/[^0-9.,-]/g, '');
  return parseFloat(clean.replace(/,/g, '')) || 0;
}

function parseDate(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    // Excel serial date (days since 1899-12-30)
    const d = new Date(Math.round((val - 25569) * 86400000));
    return isNaN(d) ? null : d;
  }
  const s = val.toString().trim();
  // "13.03.2026" or "13/03/2026"
  const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) return new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function fmtAmount(n, currency = '') {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M${currency ? ' ' + currency : ''}`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K${currency ? ' ' + currency : ''}`;
  return `${n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}${currency ? ' ' + currency : ''}`;
}

function fmtAmountFull(n) {
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
}

function monthKey(d) {
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [y, m] = key.split('-');
  const MONTHS = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

// ── Smart column detector ─────────────────────────────────────────────────────
function detectColumns(headers) {
  const lc = headers.map(h => (h || '').toString().toLowerCase().trim());
  const find = (kws) => {
    const idx = lc.findIndex(h => kws.some(k => h.includes(k)));
    return idx >= 0 ? headers[idx] : null;
  };
  return {
    amount:   find(['miktar','tutar','amount','bağış mikt','bağış tut','gelir','toplam','grant','funding','bagis']),
    date:     find(['tarih','date','ay ','month','dönem','period','yıl','year',' ay']),
    donor:    find(['donör','donor','kuruluş','organiz','isim','name',' ad ','funder','kaynak','source','bağışçı','bagisci']),
    currency: find(['döviz','para birimi','currency','kur',' birim','curr','para ']),
    category: find(['kategori','proje','project','tür','type','amaç','purpose','konu','hedef','program']),
    notes:    find(['not ','notes','açıklama','description','yorum','comment','detay']),
  };
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'white', border: '1px solid var(--border)', borderRadius: 8,
      padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,.1)', fontSize: 12.5,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--navy)' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginTop: 3 }}>
          {p.name}: <strong>{fmtAmountFull(p.value)}{currency ? ' ' + currency : ''}</strong>
        </div>
      ))}
    </div>
  );
}

// ── RADIAN for pie labels ──────────────────────────────────────────────────────
const RADIAN = Math.PI / 180;
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.04) return null;
  const r  = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x  = cx + r * Math.cos(-midAngle * RADIAN);
  const y  = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: 11, fontWeight: 700 }}>
      {`${(percent * 100).toFixed(1)}%`}
    </text>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }) {
  return (
    <div style={{
      background: 'white', borderRadius: 12, padding: '18px 20px',
      border: '1px solid var(--border)',
      borderLeft: `4px solid ${color || 'var(--navy)'}`,
      boxShadow: '0 2px 8px rgba(0,0,0,.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--navy)' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── Upload Zone ───────────────────────────────────────────────────────────────
function UploadZone({ onFile }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handle = (file) => {
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      alert('Lütfen .xlsx, .xls veya .csv dosyası yükleyin.');
      return;
    }
    onFile(file);
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]); }}
      onClick={() => inputRef.current.click()}
      style={{
        border: `2px dashed ${dragging ? 'var(--navy)' : 'var(--border)'}`,
        borderRadius: 16, padding: '56px 32px', textAlign: 'center',
        cursor: 'pointer', background: dragging ? '#f0f4ff' : 'var(--surface)',
        transition: 'all 0.2s',
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
      <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--navy)', marginBottom: 8 }}>
        Excel dosyanızı buraya sürükleyin
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>
        veya tıklayarak seçin — .xlsx, .xls, .csv desteklenir
      </div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '10px 24px', background: 'var(--navy)', color: 'white',
        borderRadius: 8, fontSize: 13, fontWeight: 600,
      }}>
        📂 Dosya Seç
      </div>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={e => handle(e.target.files[0])} />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DonationTracker({ user, profile, onNavigate }) {
  const [fileName,    setFileName]    = useState('');
  const [sheets,      setSheets]      = useState([]);
  const [activeSheet, setActiveSheet] = useState('');
  const [workbook,    setWorkbook]    = useState(null);
  const [rawData,     setRawData]     = useState([]);     // array of row objects
  const [headers,     setHeaders]     = useState([]);
  const [cols,        setCols]        = useState({});     // detected column mapping
  const [manualCols,  setManualCols]  = useState({});     // user overrides
  const [page,        setPage]        = useState(0);
  const [showMapper,  setShowMapper]  = useState(false);
  const PAGE_SIZE = 10;

  // ── Effective column map (manual overrides detected) ──────────────────────
  const effectiveCols = { ...cols, ...manualCols };
  const amtCol  = effectiveCols.amount;
  const dateCol = effectiveCols.date;
  const donorCol = effectiveCols.donor;
  const currCol  = effectiveCols.currency;
  const catCol   = effectiveCols.category;

  // ── Parse sheet ───────────────────────────────────────────────────────────
  const parseSheet = useCallback((wb, sheetName) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;
    const json = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
    if (json.length === 0) { setRawData([]); setHeaders([]); setCols({}); return; }
    const hdrs = Object.keys(json[0]);
    setHeaders(hdrs);
    setRawData(json);
    setCols(detectColumns(hdrs));
    setManualCols({});
    setPage(0);
  }, []);

  // ── Handle file ───────────────────────────────────────────────────────────
  const handleFile = useCallback((file) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: 'array', cellDates: false });
      setWorkbook(wb);
      setSheets(wb.SheetNames);
      const first = wb.SheetNames[0];
      setActiveSheet(first);
      parseSheet(wb, first);
    };
    reader.readAsArrayBuffer(file);
  }, [parseSheet]);

  const changeSheet = (name) => {
    setActiveSheet(name);
    parseSheet(workbook, name);
  };

  const reset = () => {
    setFileName(''); setSheets([]); setActiveSheet('');
    setWorkbook(null); setRawData([]); setHeaders([]);
    setCols({}); setManualCols({}); setPage(0);
  };

  // ── Compute metrics ───────────────────────────────────────────────────────
  const rows = rawData.filter(r => amtCol && parseAmount(r[amtCol]) > 0);

  // Main currency (most common, or first found)
  const currencies = currCol
    ? [...new Set(rows.map(r => (r[currCol] || '').toString().trim()).filter(Boolean))]
    : [];
  const mainCurrency = currencies.length === 1 ? currencies[0] : '';

  const totalAmount = rows.reduce((s, r) => s + parseAmount(r[amtCol]), 0);
  const avgAmount   = rows.length ? totalAmount / rows.length : 0;
  const maxRow      = rows.reduce((best, r) => {
    const a = parseAmount(r[amtCol]);
    return a > (best ? parseAmount(best[amtCol]) : 0) ? r : best;
  }, null);
  const maxDonor    = maxRow && donorCol ? maxRow[donorCol] : '';
  const donorSet    = donorCol ? [...new Set(rows.map(r => (r[donorCol] || '?').toString().trim()))] : [];

  // Donor totals
  const donorMap = {};
  rows.forEach(r => {
    const d = donorCol ? (r[donorCol] || 'Bilinmiyor').toString().trim() : 'Toplam';
    donorMap[d] = (donorMap[d] || 0) + parseAmount(r[amtCol]);
  });
  const donorData = Object.entries(donorMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Monthly trend
  const monthMap = {};
  if (dateCol) {
    rows.forEach(r => {
      const d = parseDate(r[dateCol]);
      if (!d) return;
      const k = monthKey(d);
      monthMap[k] = (monthMap[k] || 0) + parseAmount(r[amtCol]);
    });
  }
  const monthData = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ key, name: monthLabel(key), value }));

  // Category totals
  const catMap = {};
  if (catCol) {
    rows.forEach(r => {
      const c = (r[catCol] || 'Diğer').toString().trim();
      catMap[c] = (catMap[c] || 0) + parseAmount(r[amtCol]);
    });
  }
  const catData = Object.entries(catMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Currency breakdown
  const currMap = {};
  if (currCol && currencies.length > 1) {
    rows.forEach(r => {
      const c = (r[currCol] || 'Bilinmiyor').toString().trim();
      currMap[c] = (currMap[c] || 0) + parseAmount(r[amtCol]);
    });
  }
  const currData = Object.entries(currMap).map(([name, value]) => ({ name, value }));

  // ── Paged table ───────────────────────────────────────────────────────────
  const totalPages  = Math.ceil(rawData.length / PAGE_SIZE);
  const pagedRows   = rawData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const visibleCols = headers.slice(0, 8); // show first 8 columns in table

  // ── Detected columns summary ──────────────────────────────────────────────
  const detectedSummary = Object.entries(effectiveCols)
    .filter(([, v]) => v)
    .map(([k, v]) => {
      const labels = { amount:'💰 Tutar', date:'📅 Tarih', donor:'🤝 Donör', currency:'💱 Para', category:'📂 Kategori', notes:'📝 Not' };
      return `${labels[k] || k}: ${v}`;
    })
    .join(' · ');

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">💰 Bağış Takip & Analiz</h1>
            <p className="page-subtitle">Excel listesini yükleyin — otomatik olarak görselleştirilsin</p>
          </div>
          {fileName && (
            <button className="btn btn-outline btn-sm" onClick={reset}>✕ Dosyayı Kaldır</button>
          )}
        </div>
      </div>

      {/* ── Upload / File info bar ── */}
      {!fileName ? (
        <UploadZone onFile={handleFile} />
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          padding: '12px 16px', background: '#eef3ff', borderRadius: 10,
          border: '1px solid #c7d7fa', marginBottom: 24,
        }}>
          <span style={{ fontSize: 20 }}>📄</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--navy)' }}>{fileName}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
              {rawData.length} satır · {headers.length} sütun
              {detectedSummary ? ' · ' + detectedSummary : ''}
            </div>
          </div>

          {sheets.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sayfa:</span>
              <select
                className="form-input"
                style={{ padding: '4px 8px', fontSize: 12, width: 'auto' }}
                value={activeSheet}
                onChange={e => changeSheet(e.target.value)}
              >
                {sheets.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          <button
            className="btn btn-outline btn-sm"
            onClick={() => setShowMapper(!showMapper)}
            style={{ fontSize: 12 }}
          >
            🔧 Sütunları Düzenle
          </button>
        </div>
      )}

      {/* ── Column mapper ── */}
      {showMapper && headers.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>🔧 Sütun Eşleştirme</div>
            <button className="btn btn-outline btn-sm" onClick={() => setShowMapper(false)}>✕ Kapat</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { key: 'amount',   label: '💰 Tutar Sütunu *',   required: true },
              { key: 'donor',    label: '🤝 Donör Adı Sütunu' },
              { key: 'date',     label: '📅 Tarih Sütunu' },
              { key: 'currency', label: '💱 Para Birimi Sütunu' },
              { key: 'category', label: '📂 Kategori Sütunu' },
              { key: 'notes',    label: '📝 Not Sütunu' },
            ].map(({ key, label }) => (
              <div key={key} className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{label}</label>
                <select
                  className="form-input"
                  value={effectiveCols[key] || ''}
                  onChange={e => setManualCols(m => ({ ...m, [key]: e.target.value || null }))}
                >
                  <option value="">— Yok —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── No data yet ── */}
      {!fileName && (
        <div style={{ marginTop: 32 }}>
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: 24, fontSize: 13 }}>
            Beklenen Excel formatı:
          </div>
          <div style={{
            background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)',
            overflow: 'hidden', maxWidth: 680, margin: '0 auto',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: 'var(--navy)', color: 'white' }}>
                  {['Donör', 'Tutar', 'Para Birimi', 'Tarih', 'Proje', 'Notlar'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['WFP','250000','USD','15.01.2026','Gıda Yardımı','Q1 ödemesi'],
                  ['OCHA','180000','EUR','03.02.2026','İnsani Yardım',''],
                  ['Good Neighbors','75000','TRY','20.02.2026','Eğitim',''],
                ].map((row, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'white' : 'var(--surface)' }}>
                    {row.map((cell, j) => (
                      <td key={j} style={{ padding: '7px 12px', color: 'var(--text)' }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 12, fontSize: 12 }}>
            Sütun adları Türkçe veya İngilizce olabilir — sistem otomatik tespit eder
          </div>
        </div>
      )}

      {/* ── Data loaded: show analysis ── */}
      {rawData.length > 0 && amtCol && (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <StatCard
              icon="💰" label="Toplam Bağış" color="#1a3a5c"
              value={fmtAmount(totalAmount, mainCurrency)}
              sub={mainCurrency ? undefined : `${rows.length} kayıt`}
            />
            <StatCard
              icon="🤝" label="Bağışçı Sayısı" color="#2563eb"
              value={donorCol ? donorSet.length : rows.length}
              sub={donorCol ? `${rows.length} ödeme kaydı` : 'kayıt sayısı'}
            />
            <StatCard
              icon="📊" label="Ortalama Bağış" color="#16a34a"
              value={fmtAmount(avgAmount, mainCurrency)}
              sub="kayıt başına"
            />
            <StatCard
              icon="🏆" label="En Büyük Bağış" color="#d97706"
              value={fmtAmount(maxRow ? parseAmount(maxRow[amtCol]) : 0, mainCurrency)}
              sub={maxDonor || undefined}
            />
          </div>

          {/* Charts Row 1: Donor Bar + Donor Pie */}
          {donorData.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

              {/* Donor bar chart */}
              <div className="card">
                <div className="card-title">🤝 Donör Bazında Bağışlar</div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={donorData.slice(0, 12)} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name"
                      tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                      angle={-35} textAnchor="end" interval={0}
                    />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmtAmount(v)} width={60} />
                    <Tooltip content={<CustomTooltip currency={mainCurrency} />} />
                    <Bar dataKey="value" name="Bağış" radius={[4, 4, 0, 0]}>
                      {donorData.slice(0, 12).map((_, i) => (
                        <Cell key={i} fill={fmtColor(i)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Donor pie chart */}
              <div className="card">
                <div className="card-title">🥧 Donör Payları</div>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={donorData.slice(0, 8)}
                      dataKey="value"
                      nameKey="name"
                      cx="50%" cy="50%"
                      outerRadius={90}
                      labelLine={false}
                      label={PieLabel}
                    >
                      {donorData.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={fmtColor(i)} />
                      ))}
                    </Pie>
                    <Legend
                      formatter={(value) => <span style={{ fontSize: 11.5 }}>{value}</span>}
                      iconSize={10}
                    />
                    <Tooltip formatter={(v) => fmtAmountFull(v) + (mainCurrency ? ' ' + mainCurrency : '')} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Monthly trend (only if date column exists) */}
          {monthData.length > 1 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title">📈 Aylık Bağış Trendi</div>
              <ResponsiveContainer width="100%" height={230}>
                <AreaChart data={monthData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#1a3a5c" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#1a3a5c" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmtAmount(v)} width={60} />
                  <Tooltip content={<CustomTooltip currency={mainCurrency} />} />
                  <Area type="monotone" dataKey="value" name="Bağış"
                    stroke="#1a3a5c" strokeWidth={2.5}
                    fill="url(#areaGrad)" dot={{ r: 4, fill: '#1a3a5c' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Category + Currency row */}
          {(catData.length > 0 || currData.length > 1) && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: catData.length > 0 && currData.length > 1 ? '1fr 1fr' : '1fr',
              gap: 20, marginBottom: 20,
            }}>
              {/* Category horizontal bar */}
              {catData.length > 0 && (
                <div className="card">
                  <div className="card-title">📂 Kategori / Proje Dağılımı</div>
                  <ResponsiveContainer width="100%" height={Math.max(200, catData.length * 34)}>
                    <BarChart data={catData} layout="vertical"
                      margin={{ top: 4, right: 60, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => fmtAmount(v)} />
                      <YAxis type="category" dataKey="name" width={110}
                        tick={{ fontSize: 11, fill: 'var(--text)' }} />
                      <Tooltip content={<CustomTooltip currency={mainCurrency} />} />
                      <Bar dataKey="value" name="Bağış" radius={[0, 4, 4, 0]}>
                        {catData.map((_, i) => <Cell key={i} fill={fmtColor(i)} />)}
                        <LabelList dataKey="value" position="right"
                          formatter={v => fmtAmount(v, mainCurrency)}
                          style={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Currency pie */}
              {currData.length > 1 && (
                <div className="card">
                  <div className="card-title">💱 Para Birimi Dağılımı</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={currData} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" outerRadius={80} labelLine={false} label={PieLabel}>
                        {currData.map((_, i) => <Cell key={i} fill={fmtColor(i)} />)}
                      </Pie>
                      <Legend formatter={(v) => <span style={{ fontSize: 11.5 }}>{v}</span>} iconSize={10} />
                      <Tooltip formatter={(v) => fmtAmountFull(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Top donors table */}
          {donorData.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title">🏅 Donör Sıralaması</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface)', borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>#</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Donör</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>Toplam Tutar</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>Pay</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Görsel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {donorData.slice(0, 10).map((d, i) => {
                      const pct = totalAmount > 0 ? (d.value / totalAmount) * 100 : 0;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'white' : 'var(--surface)' }}>
                          <td style={{ padding: '9px 12px', color: 'var(--text-muted)', fontWeight: 700 }}>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                          </td>
                          <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--navy)' }}>
                            <span style={{
                              display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                              background: fmtColor(i), marginRight: 8
                            }} />
                            {d.name}
                          </td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--navy)' }}>
                            {fmtAmountFull(d.value)}{mainCurrency ? ' ' + mainCurrency : ''}
                          </td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                            {pct.toFixed(1)}%
                          </td>
                          <td style={{ padding: '9px 12px' }}>
                            <div style={{
                              height: 8, borderRadius: 4, background: 'var(--border)',
                              width: 120, overflow: 'hidden',
                            }}>
                              <div style={{
                                height: '100%', width: `${pct}%`, borderRadius: 4,
                                background: fmtColor(i),
                              }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Raw data table */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>📋 Ham Veri ({rawData.length} satır)</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Sayfa {page + 1} / {totalPages}
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--navy)' }}>
                    <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: 'rgba(255,255,255,.6)', width: 36 }}>#</th>
                    {visibleCols.map(h => (
                      <th key={h} style={{
                        padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: 'white',
                        background: Object.values(effectiveCols).includes(h) ? 'rgba(255,255,255,.12)' : undefined,
                        whiteSpace: 'nowrap',
                      }}>
                        {Object.entries(effectiveCols).find(([, v]) => v === h)?.[0]
                          ? '✦ ' : ''}{h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'white' : 'var(--surface)' }}>
                      <td style={{ padding: '6px 10px', color: 'var(--text-muted)', fontSize: 11 }}>
                        {page * PAGE_SIZE + i + 1}
                      </td>
                      {visibleCols.map(h => (
                        <td key={h} style={{ padding: '6px 10px', color: 'var(--text)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row[h]?.toString() || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                <button className="btn btn-outline btn-sm" disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}>← Önceki</button>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)', alignSelf: 'center' }}>
                  {page + 1} / {totalPages}
                </span>
                <button className="btn btn-outline btn-sm" disabled={page === totalPages - 1}
                  onClick={() => setPage(p => p + 1)}>Sonraki →</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* File loaded but no amount column detected */}
      {rawData.length > 0 && !amtCol && (
        <div style={{
          padding: 32, textAlign: 'center', background: '#fff9ec',
          border: '1px solid #fbbf24', borderRadius: 12, color: '#92400e',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Tutar sütunu tespit edilemedi</div>
          <div style={{ fontSize: 13 }}>
            {headers.length} sütun bulundu: {headers.join(', ')}
          </div>
          <div style={{ marginTop: 12, fontSize: 13 }}>
            Lütfen <strong>"🔧 Sütunları Düzenle"</strong> butonuna tıklayarak tutar sütununu manuel seçin.
          </div>
        </div>
      )}
    </div>
  );
}
