import React, { useEffect, useState, useMemo } from 'react';
import {
  getFeedbackTickets, updateFeedbackTicket, deleteFeedbackTicket,
  getFeedbackComments, addFeedbackComment,
} from '../lib/supabase';
import { FEEDBACK_TYPES, FEEDBACK_SEVERITIES } from '../components/FeedbackModal';
import { ROLE_LABELS } from '../lib/constants';

const STATUSES = [
  { id: 'new',         label: 'Yeni',         color: '#3b82f6' },
  { id: 'in_review',   label: 'İncelemede',   color: '#8b5cf6' },
  { id: 'in_progress', label: 'Çalışılıyor',  color: '#f59e0b' },
  { id: 'resolved',    label: 'Çözüldü',      color: '#10b981' },
  { id: 'wont_fix',    label: 'Çözülmeyecek', color: '#64748b' },
  { id: 'duplicate',   label: 'Tekrar',       color: '#94a3b8' },
  { id: 'closed',      label: 'Kapalı',       color: '#475569' },
];

const PRIORITIES = [
  { id: 'low',    label: 'Düşük',  color: '#64748b' },
  { id: 'medium', label: 'Orta',   color: '#3b82f6' },
  { id: 'high',   label: 'Yüksek', color: '#f59e0b' },
  { id: 'urgent', label: 'Acil',   color: '#ef4444' },
];

function typeLabel(t) {
  const o = FEEDBACK_TYPES.find(x => x.id === t);
  return o ? `${o.emoji} ${o.label}` : t;
}
function severityObj(s) { return FEEDBACK_SEVERITIES.find(x => x.id === s); }
function statusObj(s) { return STATUSES.find(x => x.id === s); }
function priorityObj(p) { return PRIORITIES.find(x => x.id === p); }

function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)   return `${Math.round(diff)} sn önce`;
  if (diff < 3600) return `${Math.round(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.round(diff / 3600)} saat önce`;
  if (diff < 604800) return `${Math.round(diff / 86400)} gün önce`;
  return d.toLocaleDateString('tr-TR');
}

export default function Feedback({ user, profile }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('open'); // 'open' = henüz kapanmamış
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const { data, error } = await getFeedbackTickets();
      if (error) throw error;
      setTickets(data || []);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter(t => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (statusFilter === 'open') {
        if (['resolved', 'wont_fix', 'duplicate', 'closed'].includes(t.status)) return false;
      } else if (statusFilter !== 'all') {
        if (t.status !== statusFilter) return false;
      }
      if (q) {
        const hay = `${t.title || ''} ${t.description || ''} ${t.reporter_name || ''} ${t.page_title || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, statusFilter, typeFilter, search]);

  const counts = useMemo(() => {
    const c = { open: 0, total: tickets.length };
    STATUSES.forEach(s => { c[s.id] = 0; });
    tickets.forEach(t => {
      c[t.status] = (c[t.status] || 0) + 1;
      if (!['resolved', 'wont_fix', 'duplicate', 'closed'].includes(t.status)) c.open += 1;
    });
    return c;
  }, [tickets]);

  const selected = tickets.find(t => t.id === selectedId);

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>💬 Geri Bildirim</div>
        <div style={{ fontSize: 13, opacity: 0.7 }}>
          Kullanıcılardan gelen hatalar, talepler ve öneriler. Toplam {counts.total} ticket · {counts.open} açık.
        </div>
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <FilterChip active={statusFilter === 'open'} onClick={() => setStatusFilter('open')} label={`Açık (${counts.open})`} />
        <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} label={`Tümü (${counts.total})`} />
        {STATUSES.map(s => (
          <FilterChip
            key={s.id}
            active={statusFilter === s.id}
            onClick={() => setStatusFilter(s.id)}
            label={`${s.label} (${counts[s.id] || 0})`}
            color={s.color}
          />
        ))}
      </div>

      {/* Type + search */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{
            padding: '7px 11px', borderRadius: 7, fontSize: 12.5,
            border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
            background: 'var(--bg, #fff)', color: 'inherit', cursor: 'pointer',
          }}
        >
          <option value="all">Tüm türler</option>
          {FEEDBACK_TYPES.map(t => (
            <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>
          ))}
        </select>
        <input
          type="search"
          placeholder="🔎 Ara (başlık, açıklama, kişi, sayfa…)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 220, padding: '7px 11px', borderRadius: 7, fontSize: 13,
            border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
            background: 'var(--bg, #fff)', color: 'inherit', outline: 'none',
          }}
        />
        <button
          onClick={load}
          style={{
            padding: '7px 12px', borderRadius: 7, fontSize: 12.5, cursor: 'pointer',
            border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
            background: 'var(--bg, #fff)', color: 'inherit',
          }}
        >🔄 Yenile</button>
      </div>

      {error && (
        <div style={{
          padding: 12, borderRadius: 8, marginBottom: 14,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#dc2626', fontSize: 13,
        }}>⚠️ {error}</div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', opacity: 0.6 }}>Yükleniyor…</div>
      ) : filtered.length === 0 ? (
        <div style={{
          padding: 40, textAlign: 'center',
          background: 'var(--bg-soft, rgba(0,0,0,0.02))',
          borderRadius: 12, border: '1px dashed var(--border, rgba(0,0,0,0.12))',
        }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Gösterilecek ticket yok</div>
          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>Filtreyi değiştirerek daha fazla sonuç görebilirsiniz.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(t => (
            <TicketRow
              key={t.id}
              ticket={t}
              onOpen={() => setSelectedId(t.id)}
            />
          ))}
        </div>
      )}

      {selected && (
        <TicketDetailModal
          ticket={selected}
          user={user}
          profile={profile}
          onClose={() => setSelectedId(null)}
          onChanged={(next) => {
            setTickets(ts => ts.map(x => x.id === next.id ? { ...x, ...next } : x));
          }}
          onDeleted={(id) => {
            setTickets(ts => ts.filter(x => x.id !== id));
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}

function FilterChip({ active, onClick, label, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 11px', borderRadius: 14, fontSize: 12, fontWeight: 600,
        border: active ? `1.5px solid ${color || 'var(--navy, #1a3a5c)'}` : '1.5px solid var(--border, rgba(0,0,0,0.15))',
        background: active ? (color || 'var(--navy, #1a3a5c)') : 'transparent',
        color: active ? '#fff' : 'inherit',
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >{label}</button>
  );
}

function TicketRow({ ticket, onOpen }) {
  const sev = severityObj(ticket.severity);
  const st = statusObj(ticket.status);
  const pri = priorityObj(ticket.priority);
  return (
    <button
      onClick={onOpen}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 10,
        textAlign: 'left', padding: '12px 14px', borderRadius: 10,
        border: '1px solid var(--border, rgba(0,0,0,0.1))',
        background: 'var(--bg, #fff)', color: 'inherit',
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{
            fontSize: 10.5, padding: '2px 8px', borderRadius: 10, fontWeight: 700,
            background: st?.color || '#888', color: '#fff',
          }}>{st?.label || ticket.status}</span>
          <span style={{ fontSize: 12, opacity: 0.8 }}>{typeLabel(ticket.type)}</span>
          {sev && (
            <span style={{
              fontSize: 10.5, padding: '2px 7px', borderRadius: 4, fontWeight: 600,
              border: `1px solid ${sev.color}`, color: sev.color,
            }}>{sev.label}</span>
          )}
          {pri && (
            <span style={{
              fontSize: 10.5, padding: '2px 7px', borderRadius: 4, fontWeight: 600,
              background: pri.color, color: '#fff',
            }}>⚑ {pri.label}</span>
          )}
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {ticket.title}
        </div>
        <div style={{ fontSize: 12, opacity: 0.65, marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span>👤 {ticket.reporter_name || '—'}</span>
          {ticket.page_title && <span>📍 {ticket.page_title}</span>}
          <span>🕒 {timeAgo(ticket.created_at)}</span>
          {ticket.screenshot_url && <span>📸</span>}
        </div>
      </div>
    </button>
  );
}

function TicketDetailModal({ ticket, user, profile, onClose, onChanged, onDeleted }) {
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [imgOpen, setImgOpen] = useState(false);

  const loadComments = async () => {
    setLoadingComments(true);
    const { data } = await getFeedbackComments(ticket.id);
    setComments(data || []);
    setLoadingComments(false);
  };

  useEffect(() => { loadComments(); /* eslint-disable-next-line */ }, [ticket.id]);

  const setStatus = async (newStatus) => {
    setSaving(true); setErr('');
    try {
      const updates = { status: newStatus };
      if (newStatus === 'closed' || newStatus === 'resolved' || newStatus === 'wont_fix' || newStatus === 'duplicate') {
        updates.closed_at = new Date().toISOString();
        updates.closed_by = user?.id;
      } else {
        updates.closed_at = null;
        updates.closed_by = null;
      }
      const { data, error } = await updateFeedbackTicket(ticket.id, updates);
      if (error) throw error;
      onChanged && onChanged(data?.[0] || { id: ticket.id, ...updates });
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const setPriority = async (newPri) => {
    setSaving(true); setErr('');
    try {
      const { data, error } = await updateFeedbackTicket(ticket.id, { priority: newPri });
      if (error) throw error;
      onChanged && onChanged(data?.[0] || { id: ticket.id, priority: newPri });
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const saveResolution = async (note) => {
    setSaving(true); setErr('');
    try {
      const { data, error } = await updateFeedbackTicket(ticket.id, { resolution_note: note });
      if (error) throw error;
      onChanged && onChanged(data?.[0] || { id: ticket.id, resolution_note: note });
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const postComment = async () => {
    const content = commentText.trim();
    if (!content || posting) return;
    setPosting(true); setErr('');
    try {
      const payload = {
        ticket_id: ticket.id,
        author_id: user.id,
        author_name: profile?.full_name || user.email,
        author_role: profile?.role,
        content,
      };
      const { error } = await addFeedbackComment(payload);
      if (error) throw error;
      setCommentText('');
      await loadComments();
    } catch (e) { setErr(e.message); }
    finally { setPosting(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Bu ticket kalıcı olarak silinecek. Emin misiniz?')) return;
    const { error } = await deleteFeedbackTicket(ticket.id);
    if (error) { setErr(error.message); return; }
    onDeleted && onDeleted(ticket.id);
  };

  const st = statusObj(ticket.status);
  const sev = severityObj(ticket.severity);
  const pri = priorityObj(ticket.priority);
  const isDirektor = profile?.role === 'direktor';

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(15,30,46,0.55)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        background: 'var(--bg, #fff)', color: 'inherit',
        borderRadius: 14, width: '100%', maxWidth: 860, maxHeight: '94vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
        border: '1px solid var(--border, rgba(0,0,0,0.1))',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--border, rgba(0,0,0,0.08))',
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{
                fontSize: 10.5, padding: '2px 9px', borderRadius: 10, fontWeight: 700,
                background: st?.color || '#888', color: '#fff',
              }}>{st?.label || ticket.status}</span>
              <span style={{ fontSize: 12 }}>{typeLabel(ticket.type)}</span>
              {sev && (
                <span style={{
                  fontSize: 10.5, padding: '2px 7px', borderRadius: 4, fontWeight: 600,
                  border: `1px solid ${sev.color}`, color: sev.color,
                }}>{sev.label}</span>
              )}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{ticket.title}</div>
            <div style={{ fontSize: 11.5, opacity: 0.65, marginTop: 3 }}>
              👤 {ticket.reporter_name} · {ROLE_LABELS?.[ticket.reporter_role] || ticket.reporter_role || '—'}{ticket.reporter_unit ? ` · ${ticket.reporter_unit}` : ''} · {timeAgo(ticket.created_at)}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', fontSize: 20,
              cursor: 'pointer', opacity: 0.6, color: 'inherit',
            }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 18, overflowY: 'auto', flex: 1, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
          {/* Main */}
          <div style={{ minWidth: 0 }}>
            <SectionTitle>📝 Açıklama</SectionTitle>
            <div style={{
              padding: 12, borderRadius: 8,
              background: 'var(--bg-soft, rgba(0,0,0,0.025))',
              border: '1px solid var(--border, rgba(0,0,0,0.06))',
              whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.5,
            }}>{ticket.description}</div>

            {ticket.screenshot_url && (
              <div style={{ marginTop: 16 }}>
                <SectionTitle>📸 Ekran Görüntüsü</SectionTitle>
                <img
                  src={ticket.screenshot_url}
                  alt="Screenshot"
                  onClick={() => setImgOpen(true)}
                  style={{
                    maxWidth: '100%', maxHeight: 360, borderRadius: 8,
                    border: '1px solid var(--border, rgba(0,0,0,0.1))',
                    cursor: 'zoom-in', display: 'block',
                  }}
                />
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <SectionTitle>🔧 Geliştirici Notu</SectionTitle>
              {isDirektor ? (
                <ResolutionEditor
                  initial={ticket.resolution_note || ''}
                  onSave={saveResolution}
                  saving={saving}
                />
              ) : (
                <div style={{
                  padding: 12, borderRadius: 8, fontSize: 13,
                  background: 'var(--bg-soft, rgba(0,0,0,0.025))',
                  border: '1px solid var(--border, rgba(0,0,0,0.06))',
                }}>{ticket.resolution_note || <span style={{ opacity: 0.5 }}>Henüz not yok.</span>}</div>
              )}
            </div>

            <div style={{ marginTop: 16 }}>
              <SectionTitle>💬 Yorumlar</SectionTitle>
              {loadingComments ? (
                <div style={{ fontSize: 12.5, opacity: 0.6, padding: 8 }}>Yükleniyor…</div>
              ) : comments.length === 0 ? (
                <div style={{ fontSize: 12.5, opacity: 0.6, padding: 8 }}>Henüz yorum yok.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {comments.map(c => (
                    <div key={c.id} style={{
                      padding: 10, borderRadius: 8,
                      background: c.author_id === user?.id ? 'rgba(26,58,92,0.06)' : 'var(--bg-soft, rgba(0,0,0,0.025))',
                      border: '1px solid var(--border, rgba(0,0,0,0.05))',
                    }}>
                      <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 3 }}>
                        <b style={{ opacity: 0.9 }}>{c.author_name || '—'}</b>
                        {c.author_role ? ` · ${ROLE_LABELS?.[c.author_role] || c.author_role}` : ''}
                        {' · '}{timeAgo(c.created_at)}
                      </div>
                      <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{c.content}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Yorum yaz…"
                  rows={2}
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: 7, fontSize: 13,
                    border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
                    background: 'var(--bg, #fff)', color: 'inherit',
                    outline: 'none', resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={postComment}
                  disabled={posting || !commentText.trim()}
                  style={{
                    padding: '0 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 700,
                    border: 'none',
                    background: posting ? 'rgba(0,0,0,0.25)' : 'var(--navy, #1a3a5c)', color: '#fff',
                    cursor: posting ? 'not-allowed' : 'pointer',
                  }}
                >{posting ? '…' : 'Gönder'}</button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <MetaBox title="Durum">
              {isDirektor ? (
                <select
                  value={ticket.status}
                  onChange={e => setStatus(e.target.value)}
                  disabled={saving}
                  style={selectStyle}
                >
                  {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              ) : (
                <div style={{ fontSize: 13, fontWeight: 600, color: st?.color }}>{st?.label}</div>
              )}
            </MetaBox>

            <MetaBox title="Öncelik">
              {isDirektor ? (
                <select
                  value={ticket.priority || ''}
                  onChange={e => setPriority(e.target.value || null)}
                  disabled={saving}
                  style={selectStyle}
                >
                  <option value="">— yok —</option>
                  {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              ) : (
                <div style={{ fontSize: 13 }}>{pri?.label || '—'}</div>
              )}
            </MetaBox>

            <MetaBox title="Sayfa Context">
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                <div><b>Sayfa:</b> {ticket.page_title || '—'}</div>
                <div><b>id:</b> <code style={{ fontSize: 11 }}>{ticket.page_id || '—'}</code></div>
                <div><b>path:</b> <code style={{ fontSize: 10.5, wordBreak: 'break-all' }}>{ticket.page_path || '—'}</code></div>
                {ticket.route_params && <div><b>params:</b> <code style={{ fontSize: 10.5 }}>{JSON.stringify(ticket.route_params)}</code></div>}
              </div>
            </MetaBox>

            <MetaBox title="Ortam">
              <div style={{ fontSize: 11, lineHeight: 1.5, wordBreak: 'break-all' }}>
                <div><b>Viewport:</b> {ticket.viewport || '—'}</div>
                <div><b>Ekran:</b> {ticket.screen_resolution || '—'}</div>
                <div style={{ opacity: 0.75 }}><b>UA:</b> {ticket.user_agent || '—'}</div>
              </div>
            </MetaBox>

            {isDirektor && (
              <button
                onClick={handleDelete}
                style={{
                  padding: '8px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                  border: '1px solid rgba(239,68,68,0.4)',
                  background: 'transparent', color: '#dc2626', cursor: 'pointer',
                }}
              >🗑 Ticket'ı Sil</button>
            )}
          </div>
        </div>

        {err && (
          <div style={{
            padding: '9px 14px', fontSize: 12.5,
            background: 'rgba(239,68,68,0.1)', color: '#dc2626',
            borderTop: '1px solid rgba(239,68,68,0.2)',
          }}>⚠️ {err}</div>
        )}
      </div>

      {imgOpen && ticket.screenshot_url && (
        <div
          onClick={() => setImgOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 10002,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <img
            src={ticket.screenshot_url}
            alt="Screenshot"
            style={{ maxWidth: '95%', maxHeight: '95%', borderRadius: 6 }}
          />
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, opacity: 0.6,
      marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>{children}</div>
  );
}

function MetaBox({ title, children }) {
  return (
    <div style={{
      padding: 10, borderRadius: 8,
      border: '1px solid var(--border, rgba(0,0,0,0.08))',
      background: 'var(--bg-soft, rgba(0,0,0,0.02))',
    }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.65, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
      {children}
    </div>
  );
}

const selectStyle = {
  width: '100%', padding: '6px 9px', borderRadius: 6, fontSize: 12.5,
  border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
  background: 'var(--bg, #fff)', color: 'inherit', cursor: 'pointer',
  fontFamily: 'inherit',
};

function ResolutionEditor({ initial, onSave, saving }) {
  const [val, setVal] = useState(initial || '');
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setVal(initial || ''); setDirty(false); }, [initial]);
  return (
    <div>
      <textarea
        value={val}
        onChange={e => { setVal(e.target.value); setDirty(true); }}
        rows={3}
        placeholder="Çözüm notu, uygulama kararı, işaretlemeler…"
        style={{
          width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 7, fontSize: 13,
          border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
          background: 'var(--bg, #fff)', color: 'inherit',
          fontFamily: 'inherit', outline: 'none', resize: 'vertical',
        }}
      />
      {dirty && (
        <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
          <button
            onClick={() => { onSave(val); setDirty(false); }}
            disabled={saving}
            style={{
              padding: '6px 11px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              border: 'none', background: 'var(--navy, #1a3a5c)', color: '#fff',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >💾 Kaydet</button>
          <button
            onClick={() => { setVal(initial || ''); setDirty(false); }}
            style={{
              padding: '6px 11px', borderRadius: 6, fontSize: 12,
              border: '1px solid var(--border, rgba(0,0,0,0.15))',
              background: 'transparent', color: 'inherit', cursor: 'pointer',
            }}
          >Vazgeç</button>
        </div>
      )}
    </div>
  );
}
