import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ═══════════════════════════════════════════════════════════════════════════════
// SABİTLER
// ═══════════════════════════════════════════════════════════════════════════════

const EMAIL_TYPES = {
  task_notification:    { label: 'Görev Bildirimi',    color: '#2563eb', icon: '📋' },
  agenda_notification:  { label: 'Gündem Bildirimi',   color: '#7c3aed', icon: '📅' },
  daily_log_reminder:   { label: 'Kayıt Hatırlatma',   color: '#d97706', icon: '⏰' },
  weekly_summary:       { label: 'Haftalık Özet',      color: '#059669', icon: '📊' },
  staff_invite:         { label: 'Personel Daveti',    color: '#ec4899', icon: '✉️' },
  other:                { label: 'Diğer',              color: '#6b7280', icon: '📧' },
};

const STATUS_COLORS = {
  sent:    { bg: '#dcfce7', color: '#16a34a', label: 'Gönderildi' },
  failed:  { bg: '#fee2e2', color: '#dc2626', label: 'Başarısız' },
  pending: { bg: '#fef3c7', color: '#d97706', label: 'Bekliyor' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// KPI KART
// ═══════════════════════════════════════════════════════════════════════════════

function KpiCard({ icon, label, value, color }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 10,
        background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETAY MODALI
// ═══════════════════════════════════════════════════════════════════════════════

function EmailDetailModal({ email, onClose }) {
  if (!email) return null;
  const type = EMAIL_TYPES[email.email_type] || EMAIL_TYPES.other;
  const status = STATUS_COLORS[email.status] || STATUS_COLORS.sent;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth: 560,
        maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 28px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>{type.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{type.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {new Date(email.created_at).toLocaleString('tr-TR')}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 20, cursor: 'pointer',
            color: 'var(--text-secondary)', padding: 4,
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 28px' }}>
          <InfoRow label="Konu" value={email.subject} />
          <InfoRow label="Alıcı" value={`${email.recipient_name || '-'} <${email.recipient_email}>`} />
          <InfoRow label="Durum">
            <span style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: status.bg, color: status.color,
            }}>{status.label}</span>
          </InfoRow>
          {email.resend_id && <InfoRow label="Resend ID" value={email.resend_id} mono />}
          {email.error_message && (
            <InfoRow label="Hata">
              <span style={{ color: '#dc2626', fontSize: 13 }}>{email.error_message}</span>
            </InfoRow>
          )}
          {email.metadata && Object.keys(email.metadata).length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Ek Bilgiler
              </div>
              <pre style={{
                background: 'var(--bg-sidebar)', borderRadius: 8, padding: 12,
                fontSize: 12, overflow: 'auto', maxHeight: 200,
                color: 'var(--text)', border: '1px solid var(--border)',
              }}>{JSON.stringify(email.metadata, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, children, mono }) {
  return (
    <div style={{ display: 'flex', marginBottom: 12, gap: 12 }}>
      <div style={{ width: 90, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', paddingTop: 2, flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: 'var(--text)', fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>
        {children || value}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANA SAYFA
// ═══════════════════════════════════════════════════════════════════════════════

export default function SystemEmails() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('system_emails')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (!error && data) setEmails(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  // Filtrele
  const filtered = useMemo(() => {
    let result = emails;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        (e.recipient_email || '').toLowerCase().includes(q) ||
        (e.recipient_name || '').toLowerCase().includes(q) ||
        (e.subject || '').toLowerCase().includes(q)
      );
    }

    if (typeFilter !== 'all') {
      result = result.filter(e => e.email_type === typeFilter);
    }

    if (statusFilter !== 'all') {
      result = result.filter(e => e.status === statusFilter);
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      if (dateFilter === 'today') cutoff.setHours(0, 0, 0, 0);
      else if (dateFilter === 'week') cutoff.setDate(now.getDate() - 7);
      else if (dateFilter === 'month') cutoff.setMonth(now.getMonth() - 1);
      result = result.filter(e => new Date(e.created_at) >= cutoff);
    }

    return result;
  }, [emails, search, typeFilter, statusFilter, dateFilter]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // KPI hesapla
  const kpis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    return {
      total: emails.length,
      todayCount: emails.filter(e => new Date(e.created_at) >= today).length,
      weekCount: emails.filter(e => new Date(e.created_at) >= weekAgo).length,
      failedCount: emails.filter(e => e.status === 'failed').length,
    };
  }, [emails]);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Başlık */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text)' }}>📧 Sistem Mailleri</h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>
          Sistemin gönderdiği tüm e-postaların kaydı
        </p>
      </div>

      {/* KPI Kartları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <KpiCard icon="📧" label="Toplam Mail" value={kpis.total} color="#2563eb" />
        <KpiCard icon="📅" label="Bugün" value={kpis.todayCount} color="#059669" />
        <KpiCard icon="📊" label="Bu Hafta" value={kpis.weekCount} color="#7c3aed" />
        <KpiCard icon="⚠️" label="Başarısız" value={kpis.failedCount} color="#dc2626" />
      </div>

      {/* Filtreler */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20,
        background: 'var(--bg-card)', padding: '14px 18px', borderRadius: 12,
        border: '1px solid var(--border)',
      }}>
        <input
          type="text"
          placeholder="Alıcı, konu ara..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          style={{
            flex: 1, minWidth: 200, padding: '8px 14px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--bg-input)',
            color: 'var(--text)', fontSize: 13,
          }}
        />
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(0); }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 13 }}>
          <option value="all">Tüm Türler</option>
          {Object.entries(EMAIL_TYPES).map(([key, { label, icon }]) => (
            <option key={key} value={key}>{icon} {label}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 13 }}>
          <option value="all">Tüm Durumlar</option>
          <option value="sent">✅ Gönderildi</option>
          <option value="failed">❌ Başarısız</option>
          <option value="pending">⏳ Bekliyor</option>
        </select>
        <select value={dateFilter} onChange={e => { setDateFilter(e.target.value); setPage(0); }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 13 }}>
          <option value="all">Tüm Zamanlar</option>
          <option value="today">Bugün</option>
          <option value="week">Son 7 Gün</option>
          <option value="month">Son 30 Gün</option>
        </select>
        <button onClick={fetchEmails} style={{
          padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--bg-input)', color: 'var(--text)', cursor: 'pointer', fontSize: 13,
        }}>🔄 Yenile</button>
      </div>

      {/* Tablo */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: 12,
        border: '1px solid var(--border)', overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding: 60 }}><div className="loading-spinner" /></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
            {emails.length === 0 ? '📭 Henüz gönderilmiş mail yok' : '🔍 Filtrelerle eşleşen mail bulunamadı'}
          </div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-sidebar)' }}>
                  <th style={thStyle}>Tür</th>
                  <th style={thStyle}>Alıcı</th>
                  <th style={thStyle}>Konu</th>
                  <th style={thStyle}>Durum</th>
                  <th style={thStyle}>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(email => {
                  const type = EMAIL_TYPES[email.email_type] || EMAIL_TYPES.other;
                  const status = STATUS_COLORS[email.status] || STATUS_COLORS.sent;
                  return (
                    <tr key={email.id}
                      onClick={() => setSelectedEmail(email)}
                      style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-sidebar)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={tdStyle}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: `${type.color}15`, color: type.color,
                        }}>
                          {type.icon} {type.label}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                          {email.recipient_name || '-'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {email.recipient_email}
                        </div>
                      </td>
                      <td style={{ ...tdStyle, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 13, color: 'var(--text)' }}>{email.subject}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: status.bg, color: status.color,
                        }}>{status.label}</span>
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {new Date(email.created_at).toLocaleDateString('tr-TR')}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.7 }}>
                          {new Date(email.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Sayfalama */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                padding: '14px 20px', borderTop: '1px solid var(--border)',
              }}>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  style={pageBtnStyle(page === 0)}>← Önceki</button>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {page + 1} / {totalPages} ({filtered.length} mail)
                </span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  style={pageBtnStyle(page >= totalPages - 1)}>Sonraki →</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detay Modal */}
      <EmailDetailModal email={selectedEmail} onClose={() => setSelectedEmail(null)} />
    </div>
  );
}

// ── Stiller ──
const thStyle = {
  padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1px solid var(--border)',
};

const tdStyle = {
  padding: '12px 16px', fontSize: 13,
};

const pageBtnStyle = (disabled) => ({
  padding: '6px 16px', borderRadius: 8, fontSize: 13,
  border: '1px solid var(--border)',
  background: disabled ? 'transparent' : 'var(--bg-input)',
  color: disabled ? 'var(--text-secondary)' : 'var(--text)',
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.5 : 1,
});
