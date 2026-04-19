import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  supabase,
  getCollaboration,
  updateCollaboration,
  deleteCollaboration,
  getCollabLookups,
  getCollaborationComments,
  addCollaborationComment,
  updateCollaborationComment,
  deleteCollaborationComment,
  getCollaborationHistory,
  getCollaborationReports,
  createCollaborationReport,
  updateCollaborationReport,
  deleteCollaborationReport,
  logActivity,
  COLLAB_TYPES,
  COLLAB_STATUSES,
  COLLAB_PARTNER_ROLES,
  COLLAB_MOU_STATUSES,
  COLLAB_REPORT_TYPES,
  COLLAB_REPORT_STATUSES,
} from '../lib/supabase';

const UNITS = [
  { id: 'fonlar',       label: 'Fonlar' },
  { id: 'hibeler',      label: 'Hibeler' },
  { id: 'insani',       label: 'İnsani İşler' },
  { id: 'partnerlik',   label: 'Partnerlikler' },
  { id: 'politika',     label: 'Politika, Yönetişim ve Güvence' },
  { id: 'direktorluk',  label: 'Direktörlük' },
];

const typeLabel   = (id) => COLLAB_TYPES.find(t => t.id === id) || null;
const statusLabel = (id) => COLLAB_STATUSES.find(s => s.id === id) || null;
const roleLabel   = (id) => COLLAB_PARTNER_ROLES.find(r => r.id === id) || null;
const mouLabel    = (id) => COLLAB_MOU_STATUSES.find(m => m.id === id) || null;
const unitLabel   = (id) => UNITS.find(u => u.id === id)?.label || id || '—';

const fmtDate = (d) => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; } };
const fmtDateTime = (d) => { if (!d) return '—'; try { return new Date(d).toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return d; } };
const fmtMoney = (n, ccy) => { if (n == null) return '—'; const formatted = Number(n).toLocaleString('tr-TR', { maximumFractionDigits: 0 }); return `${formatted} ${ccy || 'TRY'}`; };

const daysUntil = (d) => {
  if (!d) return null;
  const diff = Math.ceil((new Date(d) - new Date()) / 86400000);
  return diff;
};

const newMilestoneId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `m_${Math.random().toString(36).slice(2, 10)}`;

// Simple RichText: renders paragraphs with line breaks
function RichText({ value }) {
  if (!value) return <span style={{ color: 'var(--muted, #94a3b8)', fontStyle: 'italic' }}>Henüz açıklama eklenmemiş.</span>;
  return (
    <div style={{ fontSize: 14.5, lineHeight: 1.7, color: 'var(--text, #1a3a5c)', whiteSpace: 'pre-wrap' }}>{value}</div>
  );
}

// ── SIDEBAR ROW COMPONENT ───────────────────────────────────────────────
function MetaRow({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--border, rgba(0,0,0,0.06))' }}>
      <div style={{ minWidth: 110, fontSize: 11.5, fontWeight: 600, color: 'var(--muted, #64748b)', letterSpacing: '0.04em', textTransform: 'uppercase', paddingTop: 2 }}>{label}</div>
      <div style={{ flex: 1, fontSize: 13.5, color: 'var(--text, #1a3a5c)' }}>{children}</div>
    </div>
  );
}

// ── MAIN COMPONENT ──────────────────────────────────────────────────────
export default function CollaborationDetail({ id, user, profile, onNavigate }) {
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [row,      setRow]      = useState(null);
  const [lookups,  setLookups]  = useState({ organizations: [], users: [], fundOpportunities: [], events: [] });

  const [comments, setComments] = useState([]);
  const [history,  setHistory]  = useState([]);
  const [reports,  setReports]  = useState([]);

  const [composer,       setComposer]       = useState('');
  const [composerBusy,   setComposerBusy]   = useState(false);
  const [reportDraft,    setReportDraft]    = useState(null); // null or {report_type, title, due_date, notes, responsible_user_id, status}

  const canEdit = !!profile && (
    profile.user_id === row?.owner_id
    || profile.role === 'direktor'
    || (profile.role === 'koordinator' && profile.unit === row?.unit)
  );

  // Load everything
  const reload = async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await getCollaboration(id);
    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setRow(data);
    setLoading(false);

    // parallel load
    const [lk, cm, hs, rp] = await Promise.all([
      getCollabLookups(),
      getCollaborationComments(id),
      getCollaborationHistory(id),
      getCollaborationReports(id),
    ]);
    setLookups(lk);
    setComments(cm.data || []);
    setHistory(hs.data || []);
    setReports(rp.data || []);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [id]);

  // Resolve linked entities
  const linkedOrg   = useMemo(() => lookups.organizations.find(o => o.id === row?.partner_org_id), [row, lookups]);
  const linkedUser  = useMemo(() => lookups.users.find(u => u.user_id === row?.owner_id), [row, lookups]);
  const linkedFund  = useMemo(() => lookups.fundOpportunities.find(f => f.id === row?.related_fund_id), [row, lookups]);
  const linkedEvent = useMemo(() => lookups.events.find(e => e.id === row?.related_event_id), [row, lookups]);

  // ── Milestone handlers ──
  const addMilestone = async (label, due_date) => {
    if (!canEdit || !label?.trim()) return;
    const next = Array.isArray(row.milestones) ? [...row.milestones] : [];
    next.push({ id: newMilestoneId(), label: label.trim(), due_date: due_date || null, done: false, done_at: null });
    const { data, error } = await updateCollaboration(row.id, { milestones: next });
    if (error) return alert('Aşama eklenemedi: ' + error.message);
    setRow(data);
    logActivity({ action: 'update', module: 'collaborations', entityType: 'collaboration', entityId: row.id, entityName: row.title, details: { milestone_added: label } });
  };
  const toggleMilestone = async (mid) => {
    if (!canEdit) return;
    const next = (row.milestones || []).map(m => m.id === mid ? { ...m, done: !m.done, done_at: m.done ? null : new Date().toISOString() } : m);
    const { data, error } = await updateCollaboration(row.id, { milestones: next });
    if (error) return;
    setRow(data);
  };
  const deleteMilestone = async (mid) => {
    if (!canEdit) return;
    if (!window.confirm('Bu aşamayı silmek istiyor musun?')) return;
    const next = (row.milestones || []).filter(m => m.id !== mid);
    const { data, error } = await updateCollaboration(row.id, { milestones: next });
    if (error) return;
    setRow(data);
  };

  // ── Comment handlers ──
  const submitComment = async () => {
    const body = composer.trim();
    if (!body) return;
    setComposerBusy(true);
    // @mention parsing: supports @FullName or @user_id
    const mentionIds = Array.from(body.matchAll(/@\[([^:\]]+):([a-f0-9-]{8,})\]/gi)).map(m => m[2]);
    const { data, error } = await addCollaborationComment({ collabId: row.id, body, mentions: mentionIds });
    setComposerBusy(false);
    if (error) return alert('Yorum eklenemedi: ' + error.message);
    setComposer('');
    setComments(prev => [...prev, data]);
    // history reload since comment doesn't trigger history but nice to be fresh
  };
  const removeComment = async (cid) => {
    if (!window.confirm('Yorum silinsin mi?')) return;
    const { error } = await deleteCollaborationComment(cid);
    if (error) return alert('Silinemedi: ' + error.message);
    setComments(prev => prev.filter(c => c.id !== cid));
  };

  // ── Report handlers ──
  const saveReport = async (draft) => {
    if (!draft?.report_type || !draft?.title || !draft?.due_date) {
      alert('Tür, başlık ve son tarih zorunludur.');
      return;
    }
    let res;
    if (draft.id) {
      res = await updateCollaborationReport(draft.id, {
        report_type: draft.report_type, title: draft.title, description: draft.description,
        due_date: draft.due_date, status: draft.status || 'pending',
        responsible_user_id: draft.responsible_user_id || null, notes: draft.notes || null,
      });
    } else {
      res = await createCollaborationReport({
        collaboration_id: row.id,
        report_type: draft.report_type, title: draft.title, description: draft.description || null,
        due_date: draft.due_date, status: draft.status || 'pending',
        responsible_user_id: draft.responsible_user_id || null, notes: draft.notes || null,
      });
    }
    if (res.error) return alert('Rapor kaydedilemedi: ' + res.error.message);
    const { data: rp } = await getCollaborationReports(row.id);
    setReports(rp || []);
    setReportDraft(null);
  };
  const markReportSubmitted = async (r) => {
    const { error } = await updateCollaborationReport(r.id, {
      status: 'submitted', submitted_at: new Date().toISOString(),
      submitted_by: user?.id, submitted_by_name: profile?.full_name,
    });
    if (error) return alert(error.message);
    const { data: rp } = await getCollaborationReports(row.id);
    setReports(rp || []);
  };
  const removeReport = async (rid) => {
    if (!window.confirm('Rapor kaydı silinsin mi?')) return;
    await deleteCollaborationReport(rid);
    const { data: rp } = await getCollaborationReports(row.id);
    setReports(rp || []);
  };

  // ── Delete collaboration ──
  const removeCollab = async () => {
    if (!canEdit) return;
    if (!window.confirm('Bu işbirliğini silmek istiyor musun? Tüm yorumlar, aşamalar ve rapor kayıtları da silinir.')) return;
    const { error } = await deleteCollaboration(row.id);
    if (error) return alert(error.message);
    logActivity({ action: 'delete', module: 'collaborations', entityType: 'collaboration', entityId: row.id, entityName: row.title });
    onNavigate('collaborations');
  };

  // ── Share link ──
  const copyShareLink = () => {
    const url = `${window.location.origin}/#collaborations/${row.id}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Bağlantı kopyalandı: ' + url);
    }).catch(() => prompt('Linki kopyala:', url));
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>⏳ Yükleniyor…</div>;
  if (notFound) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>İşbirliği bulunamadı</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Bu kayıt silinmiş ya da erişim yok olabilir.</div>
      <button onClick={() => onNavigate('collaborations')} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'white', cursor: 'pointer', fontWeight: 600 }}>← İşbirliklerine dön</button>
    </div>
  );

  const t = typeLabel(row.type);
  const s = statusLabel(row.status);
  const pr = roleLabel(row.partner_role);
  const mou = mouLabel(row.mou_status);
  const endDue = daysUntil(row.end_date);
  const mouDue = daysUntil(row.mou_expires_at);

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: 24 }}>
      {/* TOP BAR */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => onNavigate('collaborations')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card-bg, white)', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>← İşbirlikleri</button>
        <div style={{ flex: 1 }} />
        <button onClick={copyShareLink} style={{ padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card-bg, white)', cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>🔗 Paylaşım Linki</button>
        {canEdit && (
          <>
            <button onClick={() => onNavigate('collaborations', { editCollabId: row.id })} style={{ padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--navy, #1a3a5c)', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>✎ Düzenle</button>
            <button onClick={removeCollab} style={{ padding: '8px 14px', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, background: 'rgba(220,38,38,0.08)', color: '#dc2626', cursor: 'pointer', fontSize: 13 }}>🗑 Sil</button>
          </>
        )}
      </div>

      {/* HERO */}
      {row.image_url && (
        <div style={{ height: 220, borderRadius: 12, overflow: 'hidden', marginBottom: 20, background: `url(${row.image_url}) center/cover no-repeat` }} />
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        {s && <span style={{ padding: '4px 10px', borderRadius: 999, background: s.color + '22', color: s.color, fontSize: 12, fontWeight: 700 }}>● {s.label}</span>}
        {t && <span style={{ padding: '4px 10px', borderRadius: 999, background: t.color + '18', color: t.color, fontSize: 12, fontWeight: 600 }}>{t.icon} {t.label}</span>}
        <span style={{ padding: '4px 10px', borderRadius: 999, background: 'var(--chip-bg, #f1f5f9)', fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>🏢 {unitLabel(row.unit)}</span>
        {endDue != null && row.status === 'aktif' && (
          endDue <= 0 ? (
            <span style={{ padding: '4px 10px', borderRadius: 999, background: '#fee2e2', color: '#dc2626', fontSize: 12, fontWeight: 700 }}>⚠ Süresi doldu</span>
          ) : endDue <= 14 ? (
            <span style={{ padding: '4px 10px', borderRadius: 999, background: '#fef3c7', color: '#b45309', fontSize: 12, fontWeight: 700 }}>⏰ {endDue} gün kaldı</span>
          ) : null
        )}
      </div>
      <h1 style={{ fontSize: 30, fontWeight: 800, color: 'var(--text, #0f172a)', margin: '0 0 20px 0', lineHeight: 1.2 }}>{row.title}</h1>

      {/* 2-COLUMN LAYOUT */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 32 }}>
        {/* ── LEFT COLUMN ── */}
        <div style={{ minWidth: 0 }}>
          <Section title="Açıklama">
            <RichText value={row.description} />
          </Section>

          <Section title={`Aşamalar (${(row.milestones || []).filter(m => m.done).length}/${(row.milestones || []).length})`}>
            <MilestoneList row={row} canEdit={canEdit} onAdd={addMilestone} onToggle={toggleMilestone} onDelete={deleteMilestone} />
          </Section>

          <Section title={`Ekler (${(row.attachments || []).length})`}>
            <AttachmentList attachments={row.attachments || []} />
          </Section>

          <Section title={`Raporlama Takvimi (${reports.length})`}>
            <ReportList
              reports={reports}
              canEdit={canEdit}
              users={lookups.users}
              draft={reportDraft}
              onNew={() => setReportDraft({ report_type: 'narrative', title: '', due_date: '', status: 'pending', responsible_user_id: row.owner_id })}
              onEdit={(r) => setReportDraft(r)}
              onCancel={() => setReportDraft(null)}
              onSave={saveReport}
              onMarkSubmitted={markReportSubmitted}
              onDelete={removeReport}
            />
          </Section>

          <Section title={`Yorumlar (${comments.length})`}>
            <CommentThread
              comments={comments}
              users={lookups.users}
              currentUserId={user?.id}
              composer={composer}
              setComposer={setComposer}
              onSubmit={submitComment}
              busy={composerBusy}
              onDelete={removeComment}
            />
          </Section>

          <Section title={`Değişiklik Geçmişi (${history.length})`}>
            <HistoryList history={history} />
          </Section>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <aside style={{ alignSelf: 'start', position: 'sticky', top: 24, background: 'var(--card-bg, #fafbfc)', border: '1px solid var(--border, rgba(0,0,0,0.08))', borderRadius: 12, padding: 16 }}>
          <MetaRow label="Sorumlu">
            {linkedUser ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {linkedUser.avatar_url ? (
                  <img src={linkedUser.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{(linkedUser.full_name || '?').charAt(0)}</div>
                )}
                <div>
                  <div style={{ fontWeight: 600 }}>{linkedUser.full_name || '—'}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted, #64748b)' }}>{unitLabel(linkedUser.unit)} · {linkedUser.role}</div>
                </div>
              </div>
            ) : (row.owner_name || '—')}
          </MetaRow>

          <MetaRow label="Partner Kurum">
            {linkedOrg ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {linkedOrg.logo_url ? (
                  <img src={linkedOrg.logo_url} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain', background: '#fff', border: '1px solid var(--border)' }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🏢</div>
                )}
                <div>
                  <div style={{ fontWeight: 600 }}>{linkedOrg.name}</div>
                  {linkedOrg.org_type && <div style={{ fontSize: 11.5, color: 'var(--muted, #64748b)' }}>{linkedOrg.org_type}</div>}
                </div>
              </div>
            ) : (row.partner_name || '—')}
          </MetaRow>

          {pr && (
            <MetaRow label="Partner Rolü">
              <span style={{ padding: '3px 8px', borderRadius: 8, background: pr.color + '18', color: pr.color, fontWeight: 600, fontSize: 12 }}>{pr.label}</span>
            </MetaRow>
          )}

          {linkedFund && (
            <MetaRow label="Fon">
              <div style={{ fontWeight: 600 }}>💰 {linkedFund.title}</div>
              {linkedFund.donor_organization && <div style={{ fontSize: 11.5, color: 'var(--muted, #64748b)' }}>{linkedFund.donor_organization}</div>}
              {linkedFund.deadline && <div style={{ fontSize: 11.5, color: 'var(--muted, #64748b)' }}>Son tarih: {fmtDate(linkedFund.deadline)}</div>}
            </MetaRow>
          )}

          {linkedEvent && (
            <MetaRow label="Etkinlik">
              <div style={{ fontWeight: 600 }}>📅 {linkedEvent.title}</div>
              {linkedEvent.start_date && <div style={{ fontSize: 11.5, color: 'var(--muted, #64748b)' }}>{fmtDate(linkedEvent.start_date)}</div>}
            </MetaRow>
          )}

          <MetaRow label="Tarih">
            {row.start_date || row.end_date ? (
              <div>{fmtDate(row.start_date)} – {fmtDate(row.end_date)}</div>
            ) : '—'}
          </MetaRow>

          {row.budget_amount && (
            <MetaRow label="Bütçe">{fmtMoney(row.budget_amount, row.budget_currency)}</MetaRow>
          )}

          {row.location && (
            <MetaRow label="Konum">📍 {row.location}</MetaRow>
          )}

          {(row.tags && row.tags.length > 0) && (
            <MetaRow label="Etiketler">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {row.tags.map(tg => <span key={tg} style={{ padding: '2px 8px', borderRadius: 10, background: '#eef2ff', color: '#4338ca', fontSize: 11.5 }}>#{tg}</span>)}
              </div>
            </MetaRow>
          )}

          {(mou || row.mou_expires_at || row.mou_signed_at || row.mou_url) && (
            <MetaRow label="MoU / Sözleşme">
              {mou && <div><span style={{ padding: '2px 8px', borderRadius: 8, background: mou.color + '22', color: mou.color, fontWeight: 600, fontSize: 11.5 }}>{mou.label}</span></div>}
              {row.mou_signed_at && <div style={{ fontSize: 11.5, color: 'var(--muted, #64748b)', marginTop: 4 }}>İmza: {fmtDate(row.mou_signed_at)}</div>}
              {row.mou_expires_at && (
                <div style={{ fontSize: 11.5, color: mouDue != null && mouDue <= 30 ? '#dc2626' : 'var(--muted, #64748b)', marginTop: 2, fontWeight: mouDue != null && mouDue <= 30 ? 700 : 400 }}>
                  Bitiş: {fmtDate(row.mou_expires_at)}{mouDue != null && mouDue >= 0 && mouDue <= 30 ? ` (${mouDue} gün)` : ''}
                </div>
              )}
              {row.mou_url && <div style={{ marginTop: 4 }}><a href={row.mou_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2563eb' }}>📄 Sözleşme linki</a></div>}
            </MetaRow>
          )}

          {(row.target_beneficiaries != null || row.reached_beneficiaries != null) && (
            <MetaRow label="Beneficiary">
              <div style={{ fontWeight: 600 }}>
                {row.reached_beneficiaries ?? 0} / {row.target_beneficiaries ?? '—'}
              </div>
              {row.target_beneficiaries && (
                <div style={{ marginTop: 4, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, ((row.reached_beneficiaries || 0) / row.target_beneficiaries) * 100)}%`, background: '#16a34a' }} />
                </div>
              )}
              {row.beneficiary_categories && Object.keys(row.beneficiary_categories).length > 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--muted, #64748b)', marginTop: 6 }}>
                  {Object.entries(row.beneficiary_categories).map(([k, v]) => v ? `${k}: ${v}` : null).filter(Boolean).join(' · ')}
                </div>
              )}
            </MetaRow>
          )}
        </aside>
      </div>
    </div>
  );
}

// ── SECTION WRAPPER ────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px 0' }}>{title}</h2>
      <div>{children}</div>
    </section>
  );
}

// ── MILESTONES ─────────────────────────────────────────────────────────
function MilestoneList({ row, canEdit, onAdd, onToggle, onDelete }) {
  const [label, setLabel] = useState('');
  const [due,   setDue]   = useState('');
  const list = Array.isArray(row.milestones) ? row.milestones : [];

  return (
    <div>
      {list.length === 0 && <div style={{ color: 'var(--muted, #94a3b8)', fontSize: 13.5, fontStyle: 'italic', marginBottom: 12 }}>Henüz aşama eklenmemiş.</div>}
      {list.map(m => {
        const dd = daysUntil(m.due_date);
        const over = m.due_date && !m.done && dd != null && dd < 0;
        return (
          <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', borderRadius: 8, background: m.done ? 'var(--card-bg, #f8fafc)' : 'transparent', opacity: m.done ? 0.7 : 1, marginBottom: 4 }}>
            <input type="checkbox" checked={!!m.done} onChange={() => onToggle(m.id)} disabled={!canEdit} style={{ width: 17, height: 17, cursor: canEdit ? 'pointer' : 'default' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, textDecoration: m.done ? 'line-through' : 'none' }}>{m.label}</div>
              {m.due_date && (
                <div style={{ fontSize: 11.5, color: over ? '#dc2626' : 'var(--muted, #64748b)', fontWeight: over ? 700 : 400 }}>
                  {fmtDate(m.due_date)}{!m.done && dd != null ? ` · ${dd >= 0 ? dd + ' gün kaldı' : Math.abs(dd) + ' gün gecikti'}` : ''}
                </div>
              )}
              {m.done && m.done_at && <div style={{ fontSize: 11, color: '#16a34a' }}>✓ {fmtDate(m.done_at)}</div>}
            </div>
            {canEdit && <button onClick={() => onDelete(m.id)} style={{ border: 'none', background: 'transparent', color: 'var(--muted, #94a3b8)', cursor: 'pointer', padding: 4, fontSize: 14 }}>×</button>}
          </div>
        );
      })}
      {canEdit && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="Aşama ekle…" style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--input-bg, white)', color: 'var(--text)', fontSize: 13.5 }} />
          <input type="date" value={due} onChange={e => setDue(e.target.value)} style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--input-bg, white)', color: 'var(--text)', fontSize: 13 }} />
          <button onClick={() => { if (label.trim()) { onAdd(label, due); setLabel(''); setDue(''); } }} style={{ padding: '8px 14px', border: 'none', borderRadius: 8, background: 'var(--navy, #1a3a5c)', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Ekle</button>
        </div>
      )}
    </div>
  );
}

// ── ATTACHMENTS ────────────────────────────────────────────────────────
function AttachmentList({ attachments }) {
  if (!attachments || attachments.length === 0) return <div style={{ color: 'var(--muted, #94a3b8)', fontSize: 13.5, fontStyle: 'italic' }}>Henüz ek yok.</div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
      {attachments.map(a => (
        <a key={a.drive_file_id || a.web_view_link} href={a.web_view_link} target="_blank" rel="noreferrer" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 10, border: '1px solid var(--border)', borderRadius: 8, textDecoration: 'none', color: 'var(--text)', background: 'var(--card-bg, white)' }}>
          <div style={{ fontSize: 24 }}>📄</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted, #64748b)' }}>{a.size ? `${(a.size / 1024).toFixed(0)} KB` : ''}{a.uploaded_by_name ? ` · ${a.uploaded_by_name}` : ''}</div>
          </div>
        </a>
      ))}
    </div>
  );
}

// ── REPORTS ────────────────────────────────────────────────────────────
function ReportList({ reports, canEdit, users, draft, onNew, onEdit, onCancel, onSave, onMarkSubmitted, onDelete }) {
  if (!draft && reports.length === 0) return (
    <div>
      <div style={{ color: 'var(--muted, #94a3b8)', fontSize: 13.5, fontStyle: 'italic', marginBottom: 10 }}>Henüz rapor yükümlülüğü tanımlanmamış.</div>
      {canEdit && <button onClick={onNew} style={{ padding: '8px 14px', border: '1px dashed var(--border)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--muted, #64748b)' }}>+ Rapor yükümlülüğü ekle</button>}
    </div>
  );

  return (
    <div>
      {reports.map(r => {
        const ty = COLLAB_REPORT_TYPES.find(t => t.id === r.report_type);
        const st = COLLAB_REPORT_STATUSES.find(s => s.id === r.status);
        const dd = daysUntil(r.due_date);
        const late = r.status !== 'submitted' && r.status !== 'approved' && dd != null && dd < 0;
        return (
          <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 8, background: 'var(--card-bg, white)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ padding: '2px 8px', borderRadius: 6, background: '#eef2ff', color: '#4338ca', fontSize: 11, fontWeight: 600 }}>{ty?.label || r.report_type}</span>
              {st && <span style={{ padding: '2px 8px', borderRadius: 6, background: st.color + '22', color: st.color, fontSize: 11, fontWeight: 600 }}>{st.label}</span>}
              {late && <span style={{ padding: '2px 8px', borderRadius: 6, background: '#fee2e2', color: '#dc2626', fontSize: 11, fontWeight: 700 }}>{Math.abs(dd)} gün gecikti</span>}
            </div>
            <div style={{ fontWeight: 600 }}>{r.title}</div>
            <div style={{ fontSize: 12, color: 'var(--muted, #64748b)', marginTop: 2 }}>Son tarih: {fmtDate(r.due_date)}{dd != null && r.status !== 'submitted' && r.status !== 'approved' && dd >= 0 ? ` · ${dd} gün kaldı` : ''}</div>
            {r.notes && <div style={{ fontSize: 12.5, color: 'var(--text)', marginTop: 6 }}>{r.notes}</div>}
            {canEdit && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {r.status !== 'submitted' && r.status !== 'approved' && <button onClick={() => onMarkSubmitted(r)} style={{ padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'white', cursor: 'pointer', fontSize: 12 }}>✓ Gönderildi olarak işaretle</button>}
                <button onClick={() => onEdit(r)} style={{ padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'white', cursor: 'pointer', fontSize: 12 }}>Düzenle</button>
                <button onClick={() => onDelete(r.id)} style={{ padding: '4px 10px', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>Sil</button>
              </div>
            )}
          </div>
        );
      })}
      {canEdit && !draft && <button onClick={onNew} style={{ padding: '8px 14px', border: '1px dashed var(--border)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--muted, #64748b)', marginTop: 6 }}>+ Rapor yükümlülüğü ekle</button>}
      {draft && (
        <div style={{ border: '2px solid var(--navy, #1a3a5c)', borderRadius: 10, padding: 12, marginTop: 8, background: 'var(--card-bg, white)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <select value={draft.report_type} onChange={e => onEdit({ ...draft, report_type: e.target.value })} style={inputStyle}>
              {COLLAB_REPORT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <input type="date" value={draft.due_date || ''} onChange={e => onEdit({ ...draft, due_date: e.target.value })} style={inputStyle} />
          </div>
          <input type="text" placeholder="Başlık (örn: Q2 narrative raporu)" value={draft.title || ''} onChange={e => onEdit({ ...draft, title: e.target.value })} style={{ ...inputStyle, width: '100%', marginBottom: 8, boxSizing: 'border-box' }} />
          <textarea placeholder="Notlar (opsiyonel)" value={draft.notes || ''} onChange={e => onEdit({ ...draft, notes: e.target.value })} rows={2} style={{ ...inputStyle, width: '100%', marginBottom: 8, boxSizing: 'border-box', resize: 'vertical' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <select value={draft.responsible_user_id || ''} onChange={e => onEdit({ ...draft, responsible_user_id: e.target.value || null })} style={inputStyle}>
              <option value="">Sorumlu kişi seç…</option>
              {users.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
            </select>
            <select value={draft.status || 'pending'} onChange={e => onEdit({ ...draft, status: e.target.value })} style={inputStyle}>
              {COLLAB_REPORT_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onSave(draft)} style={{ padding: '6px 14px', border: 'none', borderRadius: 8, background: 'var(--navy, #1a3a5c)', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Kaydet</button>
            <button onClick={onCancel} style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'white', cursor: 'pointer' }}>İptal</button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6,
  fontSize: 13, background: 'var(--input-bg, white)', color: 'var(--text)',
};

// ── COMMENTS ───────────────────────────────────────────────────────────
function CommentThread({ comments, users, currentUserId, composer, setComposer, onSubmit, busy, onDelete }) {
  const taRef = useRef(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestPos,  setSuggestPos]  = useState(0);

  const onChange = (e) => {
    const v = e.target.value;
    setComposer(v);
    // Basic @ detection
    const pos = e.target.selectionStart;
    const before = v.slice(0, pos);
    const at = before.lastIndexOf('@');
    if (at >= 0 && !/\s/.test(before.slice(at + 1))) {
      setSuggestPos(at);
      setShowSuggest(true);
    } else {
      setShowSuggest(false);
    }
  };

  const pickMention = (u) => {
    const before = composer.slice(0, suggestPos);
    const after  = composer.slice(taRef.current?.selectionStart || composer.length);
    const inserted = `@[${u.full_name}:${u.user_id}] `;
    setComposer(before + inserted + after);
    setShowSuggest(false);
    setTimeout(() => taRef.current?.focus(), 0);
  };

  const suggestionPrefix = useMemo(() => {
    if (!showSuggest) return '';
    const pos = taRef.current?.selectionStart || composer.length;
    return composer.slice(suggestPos + 1, pos).toLowerCase();
  }, [showSuggest, composer, suggestPos]);

  const filteredUsers = useMemo(() => {
    if (!showSuggest) return [];
    return users.filter(u => (u.full_name || '').toLowerCase().includes(suggestionPrefix)).slice(0, 6);
  }, [showSuggest, users, suggestionPrefix]);

  // Render body with @mention chips
  const renderBody = (body) => {
    if (!body) return null;
    const parts = [];
    let lastIdx = 0;
    const re = /@\[([^:\]]+):([a-f0-9-]{8,})\]/gi;
    let m;
    while ((m = re.exec(body)) !== null) {
      if (m.index > lastIdx) parts.push(<span key={lastIdx}>{body.slice(lastIdx, m.index)}</span>);
      parts.push(<span key={m.index} style={{ padding: '1px 6px', borderRadius: 4, background: '#eef2ff', color: '#4338ca', fontWeight: 600 }}>@{m[1]}</span>);
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx < body.length) parts.push(<span key={lastIdx}>{body.slice(lastIdx)}</span>);
    return parts;
  };

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <textarea
          ref={taRef}
          value={composer}
          onChange={onChange}
          placeholder="Yorum yaz… @ ile kullanıcıdan bahsedebilirsin"
          rows={3}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', resize: 'vertical', background: 'var(--input-bg, white)', color: 'var(--text)', boxSizing: 'border-box' }}
        />
        {showSuggest && filteredUsers.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--border)', borderRadius: 8, zIndex: 10, marginTop: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            {filteredUsers.map(u => (
              <button key={u.user_id} onClick={() => pickMention(u)} style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{(u.full_name || '?').charAt(0)}</div>
                <div style={{ fontSize: 13 }}>{u.full_name}</div>
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <div style={{ fontSize: 11.5, color: 'var(--muted, #94a3b8)' }}>Cmd/Ctrl+Enter ile gönder</div>
          <button onClick={onSubmit} disabled={busy || !composer.trim()} style={{ padding: '7px 16px', border: 'none', borderRadius: 8, background: 'var(--navy, #1a3a5c)', color: 'white', fontWeight: 600, cursor: busy || !composer.trim() ? 'default' : 'pointer', opacity: busy || !composer.trim() ? 0.5 : 1, fontSize: 13 }}>
            {busy ? '⏳' : 'Yorum Ekle'}
          </button>
        </div>
      </div>
      <div>
        {comments.length === 0 && <div style={{ color: 'var(--muted, #94a3b8)', fontSize: 13.5, fontStyle: 'italic' }}>Henüz yorum yok.</div>}
        {comments.map(c => (
          <div key={c.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border, rgba(0,0,0,0.06))' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{(c.author_name || '?').charAt(0)}</div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{c.author_name || 'Anonim'}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted, #94a3b8)' }}>{fmtDateTime(c.created_at)}</div>
              <div style={{ flex: 1 }} />
              {c.author_id === currentUserId && <button onClick={() => onDelete(c.id)} style={{ border: 'none', background: 'transparent', color: 'var(--muted, #94a3b8)', cursor: 'pointer', fontSize: 12 }}>Sil</button>}
            </div>
            <div style={{ paddingLeft: 38, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{renderBody(c.body)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── HISTORY ────────────────────────────────────────────────────────────
const FIELD_LABELS = {
  title: 'Başlık', status: 'Durum', type: 'Tür', unit: 'Birim',
  owner_id: 'Sorumlu', partner_org_id: 'Partner Kurum', partner_role: 'Partner Rolü',
  start_date: 'Başlangıç', end_date: 'Bitiş', budget_amount: 'Bütçe', mou_status: 'MoU Durumu',
};

function HistoryList({ history }) {
  if (!history || history.length === 0) return <div style={{ color: 'var(--muted, #94a3b8)', fontSize: 13.5, fontStyle: 'italic' }}>Değişiklik henüz yok.</div>;
  return (
    <div>
      {history.map(h => (
        <div key={h.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border, rgba(0,0,0,0.05))' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, fontSize: 12 }}>
            <span style={{ fontWeight: 600 }}>{h.actor_name || 'Sistem'}</span>
            <span style={{ color: 'var(--muted, #94a3b8)' }}>{h.action === 'create' ? 'oluşturdu' : 'güncelledi'}</span>
            <span style={{ color: 'var(--muted, #94a3b8)', fontSize: 11.5 }}>{fmtDateTime(h.created_at)}</span>
          </div>
          {h.changes && Object.keys(h.changes).length > 0 && (
            <div style={{ paddingLeft: 0, fontSize: 12.5, color: 'var(--muted, #475569)' }}>
              {Object.entries(h.changes).map(([k, v]) => (
                <div key={k} style={{ margin: '2px 0' }}>
                  <b>{FIELD_LABELS[k] || k}:</b>{' '}
                  {typeof v === 'object' && v !== null && 'old' in v
                    ? <><span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>{String(v.old || '—')}</span> → <span style={{ color: 'var(--text)' }}>{String(v.new || '—')}</span></>
                    : String(v)}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
