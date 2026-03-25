import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getFundOpportunities, createFundOpportunity, updateFundOpportunity, deleteFundOpportunity, awardXP } from '../lib/supabase';

// ── Sabitler ──────────────────────────────────────────────────────────────────
const SECTORS = [
  'Humanitarian Aid', 'Health', 'Education', 'Water & Sanitation',
  'Food Security', 'Climate Resilience', 'Gender Equality',
  'Peacebuilding', 'Governance', 'Economic Development',
  'Human Rights', 'Migration', 'Technology', 'Other',
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'TRY', 'CHF', 'CAD', 'AUD', 'SEK', 'NOK', 'JPY'];

const STATUS_CONFIG = {
  active:  { label: 'Aktif',         color: 'var(--green)',   bg: 'var(--green-pale)',  icon: '🟢' },
  applied: { label: 'Başvuruldu',    color: 'var(--primary)', bg: 'var(--primary-light)', icon: '📨' },
  won:     { label: 'Kazanıldı',     color: 'var(--gold)',    bg: 'var(--orange-pale)', icon: '🏆' },
  lost:    { label: 'Kazanılamadı',  color: 'var(--red)',     bg: 'var(--red-pale)',    icon: '❌' },
  closed:  { label: 'Kapandı',       color: 'var(--text-muted)', bg: 'var(--gray-light)', icon: '🔒' },
};

const PRIORITY_CONFIG = {
  critical: { label: 'Kritik',  color: 'var(--red)',    bg: 'var(--red-pale)',    icon: '🔴' },
  high:     { label: 'Yüksek',  color: 'var(--orange)', bg: 'var(--orange-pale)', icon: '🟠' },
  medium:   { label: 'Orta',    color: 'var(--primary)', bg: 'var(--primary-light)', icon: '🔵' },
  low:      { label: 'Düşük',   color: 'var(--green)',  bg: 'var(--green-pale)',  icon: '🟢' },
};

function formatCurrency(amount, currency = 'USD') {
  if (!amount && amount !== 0) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

function daysUntilDeadline(deadline) {
  if (!deadline) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dl = new Date(deadline);
  dl.setHours(0, 0, 0, 0);
  return Math.ceil((dl - now) / (1000 * 60 * 60 * 24));
}

function deadlineLabel(deadline) {
  const days = daysUntilDeadline(deadline);
  if (days === null) return { text: '—', color: 'var(--text-muted)' };
  if (days < 0) return { text: `${Math.abs(days)} gün geçti`, color: 'var(--red)' };
  if (days === 0) return { text: 'Bugün!', color: 'var(--red)' };
  if (days <= 7) return { text: `${days} gün kaldı`, color: 'var(--orange)' };
  if (days <= 30) return { text: `${days} gün kaldı`, color: 'var(--gold)' };
  return { text: `${days} gün kaldı`, color: 'var(--green)' };
}

// ── Boş form ──────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  title: '', donor_organization: '', country: '', sector: '',
  focus_area: '', amount_min: '', amount_max: '', currency: 'USD',
  deadline: '', eligibility: '', description: '', application_url: '',
  priority: 'medium', notes: '', tags: [],
};

// ── Kart Bileşeni ─────────────────────────────────────────────────────────────
function OpportunityCard({ item, onEdit, onStatusChange, isDirektor, isOwner }) {
  const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.active;
  const pc = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.medium;
  const dl = deadlineLabel(item.deadline);
  const canEdit = isOwner || isDirektor;

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1.5px solid var(--border)',
      borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column',
      transition: 'box-shadow 0.2s, transform 0.15s',
      boxShadow: 'var(--shadow-sm)',
    }}
    onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {/* Header strip */}
      <div style={{
        height: 4,
        background: item.status === 'won' ? 'linear-gradient(90deg, var(--gold), var(--orange))'
          : item.status === 'applied' ? 'linear-gradient(90deg, var(--primary), var(--blue-bright, #60a5fa))'
          : item.status === 'lost' || item.status === 'closed' ? 'var(--gray-mid)'
          : `linear-gradient(90deg, ${pc.color}, ${pc.color}88)`,
      }} />

      {/* Body */}
      <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 700, fontSize: 14.5, color: 'var(--text)',
              lineHeight: 1.35, letterSpacing: '-0.01em',
            }}>
              {item.title}
            </div>
            {item.donor_organization && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                🏛 {item.donor_organization}
              </div>
            )}
          </div>
          {item.sector && (
            <span style={{
              fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
              background: sc.bg, color: sc.color, whiteSpace: 'nowrap', flexShrink: 0,
              letterSpacing: '0.02em', textTransform: 'uppercase',
            }}>
              {item.sector}
            </span>
          )}
        </div>

        {/* Meta grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 12.5 }}>
          {(item.amount_min || item.amount_max) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
              <span style={{ fontSize: 13 }}>💰</span>
              <span style={{ fontWeight: 600 }}>
                {item.amount_min && item.amount_max
                  ? `${formatCurrency(item.amount_min, item.currency)} – ${formatCurrency(item.amount_max, item.currency)}`
                  : formatCurrency(item.amount_min || item.amount_max, item.currency)}
              </span>
            </div>
          )}
          {item.deadline && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 13 }}>📅</span>
              <span style={{ fontWeight: 600, color: dl.color }}>
                {new Date(item.deadline).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <span style={{ fontSize: 10.5, color: dl.color, fontWeight: 500 }}>({dl.text})</span>
            </div>
          )}
          {item.country && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
              <span style={{ fontSize: 13 }}>📍</span> {item.country}
            </div>
          )}
          {item.focus_area && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
              <span style={{ fontSize: 13 }}>🎯</span> {item.focus_area}
            </div>
          )}
        </div>

        {/* Eligibility */}
        {item.eligibility && (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            <strong style={{ color: 'var(--text-secondary)' }}>Uygunluk:</strong> {item.eligibility}
          </div>
        )}

        {/* Description */}
        {item.description && (
          <div style={{
            fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55,
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {item.description}
          </div>
        )}

        {/* Tags */}
        {item.tags?.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {item.tags.map((tag, i) => (
              <span key={i} style={{
                fontSize: 10, padding: '2px 6px', borderRadius: 4,
                background: 'var(--bg-badge)', color: 'var(--text-muted)', fontWeight: 500,
              }}>#{tag}</span>
            ))}
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4,
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-light)' }}>
            👤 {item.submitted_by_name || 'Bilinmiyor'} · {new Date(item.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {/* Status badge */}
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
              background: sc.bg, color: sc.color,
            }}>
              {sc.icon} {sc.label}
            </span>
            {/* Priority badge */}
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
              background: pc.bg, color: pc.color,
            }}>
              {pc.label}
            </span>
          </div>
        </div>

        {/* Actions */}
        {canEdit && (
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button
              onClick={() => onEdit(item)}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)',
                cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; }}
            >
              ✏️ Düzenle
            </button>
            {item.status === 'active' && (
              <button
                onClick={() => onStatusChange(item.id, 'applied')}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: 'none', background: 'var(--primary)', color: '#fff',
                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                }}
              >
                📨 Başvuruldu
              </button>
            )}
            {item.application_url && (
              <a
                href={item.application_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: '1px solid var(--primary)', background: 'transparent', color: 'var(--primary)',
                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                  textAlign: 'center', textDecoration: 'none', display: 'block',
                }}
              >
                🔗 Başvuru
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── KPI Kartı ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, accent }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
      padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 20,
        background: accent || 'var(--primary-light)',
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ANA BİLEŞEN
// ══════════════════════════════════════════════════════════════════════════════
export default function FundOpportunities({ user, profile }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('list'); // 'list' | 'form'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [detailItem, setDetailItem] = useState(null);

  // Filtreler
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSector, setFilterSector] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDonor, setFilterDonor] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'deadline' | 'amount'

  const isDirektor = profile?.role === 'direktor';
  const isPersonel = profile?.role === 'personel';

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data } = await getFundOpportunities();
    setItems(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filtre seçenekleri
  const donors = useMemo(() => [...new Set(items.map(i => i.donor_organization).filter(Boolean))].sort(), [items]);
  const countries = useMemo(() => [...new Set(items.map(i => i.country).filter(Boolean))].sort(), [items]);

  // Filtrelenmiş & sıralanmış liste
  const filtered = useMemo(() => {
    let list = [...items];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i =>
        (i.title || '').toLowerCase().includes(q) ||
        (i.donor_organization || '').toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q) ||
        (i.sector || '').toLowerCase().includes(q) ||
        (i.country || '').toLowerCase().includes(q)
      );
    }
    if (filterSector) list = list.filter(i => i.sector === filterSector);
    if (filterStatus) list = list.filter(i => i.status === filterStatus);
    if (filterDonor) list = list.filter(i => i.donor_organization === filterDonor);
    if (filterCountry) list = list.filter(i => i.country === filterCountry);

    if (sortBy === 'deadline') {
      list.sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      });
    } else if (sortBy === 'amount') {
      list.sort((a, b) => (b.amount_max || b.amount_min || 0) - (a.amount_max || a.amount_min || 0));
    } else {
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    return list;
  }, [items, searchQuery, filterSector, filterStatus, filterDonor, filterCountry, sortBy]);

  // KPI
  const stats = useMemo(() => {
    const active = items.filter(i => i.status === 'active').length;
    const applied = items.filter(i => i.status === 'applied').length;
    const won = items.filter(i => i.status === 'won').length;
    const urgent = items.filter(i => {
      const d = daysUntilDeadline(i.deadline);
      return d !== null && d >= 0 && d <= 14 && i.status === 'active';
    }).length;
    const totalMax = items.filter(i => i.status === 'active' || i.status === 'applied')
      .reduce((s, i) => s + (i.amount_max || i.amount_min || 0), 0);
    return { active, applied, won, urgent, totalMax };
  }, [items]);

  // Form handlers
  const openNewForm = () => {
    setEditItem(null);
    setForm({ ...EMPTY_FORM });
    setTagInput('');
    setTab('form');
  };

  const openEditForm = (item) => {
    setEditItem(item);
    setForm({
      title: item.title || '',
      donor_organization: item.donor_organization || '',
      country: item.country || '',
      sector: item.sector || '',
      focus_area: item.focus_area || '',
      amount_min: item.amount_min || '',
      amount_max: item.amount_max || '',
      currency: item.currency || 'USD',
      deadline: item.deadline || '',
      eligibility: item.eligibility || '',
      description: item.description || '',
      application_url: item.application_url || '',
      priority: item.priority || 'medium',
      notes: item.notes || '',
      tags: item.tags || [],
    });
    setTagInput('');
    setTab('form');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);

    const record = {
      ...form,
      amount_min: form.amount_min ? Number(form.amount_min) : null,
      amount_max: form.amount_max ? Number(form.amount_max) : null,
      tags: form.tags.length > 0 ? form.tags : null,
    };

    if (editItem) {
      await updateFundOpportunity(editItem.id, record);
    } else {
      record.submitted_by = user.id;
      record.submitted_by_name = profile?.full_name || user.email;
      record.status = 'active';
      const { data } = await createFundOpportunity(record);

      // XP tetikleyici — sadece personel, yeni kayıt
      if (isPersonel && data?.[0]) {
        try {
          await awardXP(user.id, 'fund_opportunity', `Fon fırsatı eklendi: ${form.title}`, data[0].id);
        } catch (err) { console.error('[XP] fund error:', err); }
      }
    }

    setSaving(false);
    setTab('list');
    setEditItem(null);
    setForm({ ...EMPTY_FORM });
    await loadData();
  };

  const handleStatusChange = async (id, newStatus) => {
    await updateFundOpportunity(id, { status: newStatus });
    await loadData();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu fon fırsatını silmek istediğinize emin misiniz?')) return;
    await deleteFundOpportunity(id);
    await loadData();
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/[^a-z0-9ğüşıöçÇĞİÖŞÜ\- ]/gi, '');
    if (t && !form.tags.includes(t)) {
      setForm(f => ({ ...f, tags: [...f.tags, t] }));
    }
    setTagInput('');
  };

  const removeTag = (tag) => {
    setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));
  };

  // ── RENDER ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1.5px solid var(--border)', background: 'var(--bg-input)',
    color: 'var(--text)', fontSize: 13.5, fontFamily: 'inherit',
    outline: 'none', transition: 'border-color 0.15s',
  };

  const labelStyle = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: 'var(--text)', marginBottom: 5, letterSpacing: '0.01em',
  };

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">💰 Fon Fırsatları</h1>
          <p className="page-subtitle">Fon, hibe ve bağış fırsatlarını takip edin</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { setTab('list'); setEditItem(null); }}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              border: tab === 'list' ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
              background: tab === 'list' ? 'var(--primary-light)' : 'var(--bg-card)',
              color: tab === 'list' ? 'var(--primary)' : 'var(--text-muted)',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            }}
          >
            📋 Tüm Fırsatlar ({items.length})
          </button>
          <button
            onClick={openNewForm}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              border: 'none', background: 'var(--primary)', color: '#fff',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            ➕ Yeni Fırsat Ekle
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 20 }}>
        <StatCard icon="🟢" label="Aktif Fırsat" value={stats.active} accent="var(--green-pale)" />
        <StatCard icon="📨" label="Başvurulan" value={stats.applied} accent="var(--primary-light)" />
        <StatCard icon="🏆" label="Kazanılan" value={stats.won} accent="var(--orange-pale)" />
        <StatCard icon="⏰" label="Son 14 Gün" value={stats.urgent} accent="var(--red-pale)" />
        <StatCard icon="💰" label="Toplam Potansiyel" value={formatCurrency(stats.totalMax)} accent="var(--green-pale)" />
      </div>

      {/* ── LİSTE GÖRÜNÜMÜ ── */}
      {tab === 'list' && (
        <>
          {/* Filtreler */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
            padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {/* Arama */}
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'var(--text-light)' }}>🔍</span>
              <input
                type="text"
                placeholder="Başlık, donör, açıklama veya ülke ile ara..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ ...inputStyle, paddingLeft: 36 }}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
              />
            </div>

            {/* Filter row */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={filterSector} onChange={e => setFilterSector(e.target.value)}
                style={{ ...inputStyle, width: 'auto', minWidth: 130, padding: '8px 10px', fontSize: 12.5 }}>
                <option value="">Tüm Sektörler</option>
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                style={{ ...inputStyle, width: 'auto', minWidth: 120, padding: '8px 10px', fontSize: 12.5 }}>
                <option value="">Tüm Durumlar</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
              <select value={filterDonor} onChange={e => setFilterDonor(e.target.value)}
                style={{ ...inputStyle, width: 'auto', minWidth: 130, padding: '8px 10px', fontSize: 12.5 }}>
                <option value="">Tüm Donörler</option>
                {donors.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)}
                style={{ ...inputStyle, width: 'auto', minWidth: 120, padding: '8px 10px', fontSize: 12.5 }}>
                <option value="">Tüm Ülkeler</option>
                {countries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <div style={{ flex: 1 }} />

              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                style={{ ...inputStyle, width: 'auto', minWidth: 120, padding: '8px 10px', fontSize: 12.5 }}>
                <option value="newest">En Yeni</option>
                <option value="deadline">Son Tarihe Göre</option>
                <option value="amount">Bütçeye Göre</option>
              </select>

              {/* Grid/List toggle */}
              <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                {[{ id: 'grid', icon: '▦' }, { id: 'list', icon: '☰' }].map(v => (
                  <button key={v.id} onClick={() => setViewMode(v.id)}
                    style={{
                      padding: '6px 12px', border: 'none', fontSize: 14, cursor: 'pointer',
                      background: viewMode === v.id ? 'var(--primary)' : 'var(--bg-card)',
                      color: viewMode === v.id ? '#fff' : 'var(--text-muted)',
                      fontFamily: 'inherit', transition: 'all 0.15s',
                    }}>
                    {v.icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Active filter chips */}
            {(searchQuery || filterSector || filterStatus || filterDonor || filterCountry) && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Filtreler:</span>
                {searchQuery && <FilterChip label={`"${searchQuery}"`} onRemove={() => setSearchQuery('')} />}
                {filterSector && <FilterChip label={filterSector} onRemove={() => setFilterSector('')} />}
                {filterStatus && <FilterChip label={STATUS_CONFIG[filterStatus]?.label} onRemove={() => setFilterStatus('')} />}
                {filterDonor && <FilterChip label={filterDonor} onRemove={() => setFilterDonor('')} />}
                {filterCountry && <FilterChip label={filterCountry} onRemove={() => setFilterCountry('')} />}
                <button onClick={() => { setSearchQuery(''); setFilterSector(''); setFilterStatus(''); setFilterDonor(''); setFilterCountry(''); }}
                  style={{ fontSize: 11, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  Tümünü Temizle
                </button>
              </div>
            )}
          </div>

          {/* Result count */}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            {filtered.length} / {items.length} fırsat gösteriliyor
          </div>

          {/* Cards Grid or List */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Fon fırsatı bulunamadı</div>
              <div style={{ fontSize: 13 }}>Yeni bir fırsat eklemek için "Yeni Fırsat Ekle" butonunu kullanın</div>
            </div>
          ) : viewMode === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {filtered.map(item => (
                <OpportunityCard
                  key={item.id}
                  item={item}
                  onEdit={openEditForm}
                  onStatusChange={handleStatusChange}
                  isDirektor={isDirektor}
                  isOwner={item.submitted_by === user.id}
                />
              ))}
            </div>
          ) : (
            /* Liste görünümü — kompakt tablo */
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--gray-light)' }}>
                    {['Fırsat', 'Donör', 'Sektör', 'Bütçe', 'Son Tarih', 'Durum', 'Öncelik', ''].map((h, i) => (
                      <th key={i} style={{
                        padding: '10px 12px', textAlign: 'left', fontSize: 10.5,
                        fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
                        letterSpacing: '0.04em', borderBottom: '1px solid var(--border)',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => {
                    const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.active;
                    const pc = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.medium;
                    const dl = deadlineLabel(item.deadline);
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border-light)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{item.title}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{item.donor_organization || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          {item.sector && <span style={{ fontSize: 10.5, padding: '2px 6px', borderRadius: 10, background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 600 }}>{item.sector}</span>}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {item.amount_max ? formatCurrency(item.amount_max, item.currency) : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: dl.color }}>
                          {item.deadline ? new Date(item.deadline).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : '—'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 10, background: sc.bg, color: sc.color, fontWeight: 700 }}>{sc.label}</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 10, background: pc.bg, color: pc.color, fontWeight: 700 }}>{pc.label}</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {(item.submitted_by === user.id || isDirektor) && (
                            <button onClick={() => openEditForm(item)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)' }}>✏️</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── FORM ── */}
      {tab === 'form' && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16,
          padding: 28, maxWidth: 720, margin: '0 auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              {editItem ? '✏️ Fırsatı Düzenle' : '➕ Yeni Fon Fırsatı'}
            </h2>
            <button onClick={() => { setTab('list'); setEditItem(null); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)' }}>✕</button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Başlık */}
            <div>
              <label style={labelStyle}>Fırsat Başlığı *</label>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ör: Emergency Response and Resilience Fund" style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
            </div>

            {/* Donör + Ülke */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Donör Kuruluş</label>
                <input value={form.donor_organization} onChange={e => setForm(f => ({ ...f, donor_organization: e.target.value }))}
                  placeholder="Ör: USAID, EU, UNHCR..." style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
              </div>
              <div>
                <label style={labelStyle}>Ülke / Bölge</label>
                <input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                  placeholder="Ör: Türkiye, Kenya, Global..." style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
              </div>
            </div>

            {/* Sektör + Odak Alanı */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Sektör</label>
                <select value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))} style={inputStyle}>
                  <option value="">Sektör Seçin</option>
                  {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Odak Alanı</label>
                <input value={form.focus_area} onChange={e => setForm(f => ({ ...f, focus_area: e.target.value }))}
                  placeholder="Ör: Emergency Response, Health Systems..." style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
              </div>
            </div>

            {/* Bütçe */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: 12 }}>
              <div>
                <label style={labelStyle}>Min. Bütçe</label>
                <input type="number" value={form.amount_min} onChange={e => setForm(f => ({ ...f, amount_min: e.target.value }))}
                  placeholder="50000" style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
              </div>
              <div>
                <label style={labelStyle}>Maks. Bütçe</label>
                <input type="number" value={form.amount_max} onChange={e => setForm(f => ({ ...f, amount_max: e.target.value }))}
                  placeholder="500000" style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
              </div>
              <div>
                <label style={labelStyle}>Para Birimi</label>
                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} style={inputStyle}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Son Tarih + Öncelik */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Son Başvuru Tarihi</label>
                <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
              </div>
              <div>
                <label style={labelStyle}>Öncelik</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                    <button key={key} type="button"
                      onClick={() => setForm(f => ({ ...f, priority: key }))}
                      style={{
                        flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 11.5, fontWeight: 600,
                        border: form.priority === key ? `2px solid ${cfg.color}` : '1.5px solid var(--border)',
                        background: form.priority === key ? cfg.bg : 'var(--bg-card)',
                        color: form.priority === key ? cfg.color : 'var(--text-muted)',
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                      }}>
                      {cfg.icon} {cfg.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Uygunluk */}
            <div>
              <label style={labelStyle}>Uygunluk Kriterleri</label>
              <input value={form.eligibility} onChange={e => setForm(f => ({ ...f, eligibility: e.target.value }))}
                placeholder="Ör: International NGOs with field presence" style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
            </div>

            {/* Açıklama */}
            <div>
              <label style={labelStyle}>Açıklama</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Fon fırsatı hakkında detaylı bilgi..." rows={4}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
            </div>

            {/* Başvuru URL */}
            <div>
              <label style={labelStyle}>Başvuru Linki</label>
              <input type="url" value={form.application_url} onChange={e => setForm(f => ({ ...f, application_url: e.target.value }))}
                placeholder="https://..." style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
            </div>

            {/* Notlar */}
            <div>
              <label style={labelStyle}>İç Notlar</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Ekip için iç notlar..." rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
            </div>

            {/* Etiketler */}
            <div>
              <label style={labelStyle}>Etiketler</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: form.tags.length > 0 ? 8 : 0 }}>
                {form.tags.map(tag => (
                  <span key={tag} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', borderRadius: 6, fontSize: 12,
                    background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 600,
                  }}>
                    #{tag}
                    <button type="button" onClick={() => removeTag(tag)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: 12, padding: 0 }}>✕</button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  placeholder="Etiket ekle ve Enter'a bas" style={{ ...inputStyle, flex: 1 }}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
                <button type="button" onClick={addTag}
                  style={{
                    padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                  }}>+</button>
              </div>
            </div>

            {/* Düzenleme: Durum Değiştir + Sil */}
            {editItem && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px',
                background: 'var(--bg-hover)', borderRadius: 10, border: '1px solid var(--border)',
              }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginRight: 4 }}>Durum:</label>
                <select
                  value={editItem.status}
                  onChange={async (e) => {
                    await handleStatusChange(editItem.id, e.target.value);
                    setEditItem(prev => ({ ...prev, status: e.target.value }));
                  }}
                  style={{ ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 12.5 }}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
                <div style={{ flex: 1 }} />
                {(editItem.submitted_by === user.id || isDirektor) && (
                  <button type="button" onClick={() => { handleDelete(editItem.id); setTab('list'); }}
                    style={{
                      padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: 'none', background: 'var(--red)', color: '#fff',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                    🗑 Sil
                  </button>
                )}
              </div>
            )}

            {/* Submit */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" onClick={() => { setTab('list'); setEditItem(null); }}
                style={{
                  padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                İptal
              </button>
              <button type="submit" disabled={saving || !form.title.trim()}
                style={{
                  padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  border: 'none', background: saving ? 'var(--gray-mid)' : 'var(--primary)', color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}>
                {saving ? '⏳ Kaydediliyor...' : editItem ? '💾 Güncelle' : '✅ Kaydet & Ekle'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* XP bilgisi — personel için küçük ipucu */}
      {isPersonel && tab === 'list' && (
        <div style={{
          marginTop: 16, padding: '10px 14px', borderRadius: 10,
          background: 'var(--primary-light)', border: '1px solid var(--border)',
          fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>💡</span>
          Yeni fon fırsatı ekleyerek katkıda bulunun!
        </div>
      )}
    </div>
  );
}

// ── Filtre Chip ───────────────────────────────────────────────────────────────
function FilterChip({ label, onRemove }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 6, fontSize: 11,
      background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 600,
    }}>
      {label}
      <button onClick={onRemove}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: 11, padding: 0, lineHeight: 1 }}>✕</button>
    </span>
  );
}
