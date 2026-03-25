import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getAgendaTypes,
  getAgendasV2,
  getAgendaDetail,
  createAgenda,
  updateAgenda,
  deleteAgenda,
  createAgendaTask,
  updateAgendaTask,
  deleteAgendaTask,
  markAgendaTaskDone,
  markAgendaTaskDoneSelf,
  approveAgendaTask,
  requestAgendaTaskRevision,
  archiveAgendaTask,
  addAgendaComment,
  deleteAgendaComment,
  getAllProfiles,
  notifyTaskAssigned,
  createNotification,
} from '../lib/supabase';
import { ROLE_LABELS } from '../lib/constants';
import MentionInput, { extractMentions, renderMentionText } from '../components/MentionInput';

// ── SABİTLER ──────────────────────────────────────────────────────────────────
const PRIORITIES = [
  { value: 'kritik', label: '🔴 Kritik',  color: '#ef4444', bg: '#fef2f2' },
  { value: 'yuksek', label: '🟠 Yüksek', color: '#f97316', bg: '#fff7ed' },
  { value: 'orta',   label: '🟡 Orta',   color: '#eab308', bg: '#fefce8' },
  { value: 'dusuk',  label: '🟢 Düşük',  color: '#22c55e', bg: '#f0fdf4' },
];

const AGENDA_STATUSES = [
  { value: 'aktif',      label: '🟢 Aktif' },
  { value: 'devam',      label: '🔵 Devam Ediyor' },
  { value: 'tamamlandi', label: '✅ Tamamlandı' },
  { value: 'arsiv',      label: '📦 Arşiv' },
];

const prioMeta = (v) => PRIORITIES.find(p => p.value === v) || PRIORITIES[2];

const CREATOR_ROLES = ['direktor', 'direktor_yardimcisi', 'asistan', 'koordinator', 'personel'];
const ASSIGNER_ROLES = ['direktor', 'direktor_yardimcisi', 'asistan', 'koordinator', 'personel'];

// ── YARDIMCI BİLEŞENLER ───────────────────────────────────────────────────────

function Avatar({ name, url, size = 28 }) {
  const [err, setErr] = useState(false);
  const initial = (name?.[0] || '?').toUpperCase();
  if (url && !err) {
    return (
      <img src={url} alt={name} onError={() => setErr(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: 'var(--accent)',
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 700, flexShrink: 0,
    }}>{initial}</div>
  );
}

function PriorityBadge({ value }) {
  const m = prioMeta(value);
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
      color: m.color, background: m.bg,
    }}>{m.label}</span>
  );
}

function TaskStatusBadge({ status, completionStatus }) {
  if (completionStatus === 'pending_review')
    return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, color: '#f59e0b', background: '#fffbeb' }}>⏳ Onay Bekliyor</span>;
  if (completionStatus === 'approved')
    return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, color: '#16a34a', background: '#f0fdf4' }}>✅ Onaylandı</span>;
  if (completionStatus === 'revision_requested')
    return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, color: '#ef4444', background: '#fef2f2' }}>🔄 Revize İstendi</span>;
  if (status === 'tamamlandi')
    return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, color: '#16a34a', background: '#f0fdf4' }}>✅ Tamamlandı</span>;
  if (status === 'devam_ediyor')
    return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, color: '#3b82f6', background: '#eff6ff' }}>🔵 Devam Ediyor</span>;
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, color: '#9ca3af', background: '#f9fafb' }}>⚪ Bekliyor</span>;
}

// ── YORUM BALONU ──────────────────────────────────────────────────────────────
function CommentBubble({ comment, myId, onDelete, profiles = [] }) {
  const isMe = comment.created_by === myId;
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
      {!isMe && <Avatar name={comment.created_by_name} url={comment.avatar_url} size={28} />}
      <div style={{ maxWidth: '75%' }}>
        {!isMe && (
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 3 }}>
            {comment.created_by_name}
          </div>
        )}
        <div style={{
          background: isMe ? '#1e40af' : '#f1f5f9',
          color: isMe ? '#ffffff' : '#1e293b',
          border: isMe ? 'none' : '1px solid #e2e8f0',
          borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          padding: '9px 14px',
          fontSize: 13.5,
          fontWeight: 400,
          lineHeight: 1.55,
          wordBreak: 'break-word',
        }}>
          {renderMentionText(comment.content, profiles).map((part, i) =>
            part.isMention ? (
              <span key={i} style={{ fontWeight: 700, color: isMe ? '#93c5fd' : '#6366f1' }}>
                {part.text}
              </span>
            ) : (
              <span key={i}>{part.text}</span>
            )
          )}
        </div>
        <div style={{
          fontSize: 11, color: '#94a3b8', marginTop: 3,
          display: 'flex', gap: 6,
          justifyContent: isMe ? 'flex-end' : 'flex-start',
        }}>
          {new Date(comment.created_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          {isMe && (
            <button onClick={() => onDelete(comment.id)}
              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11, padding: 0, fontWeight: 600 }}>
              sil
            </button>
          )}
        </div>
      </div>
      {isMe && <Avatar name={comment.created_by_name} url={comment.avatar_url} size={28} />}
    </div>
  );
}

// ── REVİZE NOTU MODAL ─────────────────────────────────────────────────────────
function RevisionModal({ task, onConfirm, onClose }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <h2 className="modal-title">🔄 Revizeye Gönder</h2>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 16 }}>
          <strong>{task.title}</strong> görevi personele geri gönderilecek.
        </p>
        <div className="form-group">
          <label className="form-label">Revize Notu (isteğe bağlı)</label>
          <textarea className="form-textarea" rows={3}
            placeholder="Neyin düzeltilmesi gerektiğini açıklayın…"
            value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>İptal</button>
          <button className="btn btn-danger" disabled={saving}
            onClick={async () => { setSaving(true); await onConfirm(note); setSaving(false); }}>
            🔄 Revizeye Gönder
          </button>
        </div>
      </div>
    </div>
  );
}

// ── GÖREV KARTI ───────────────────────────────────────────────────────────────
function TaskCard({ task, myId, myName, role, profiles, onRefresh, agendaCreatedBy, onNotify, agendaId, agendaTitle, isPersonalAgenda = false }) {
  const [revModal, setRevModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);

  const isAssigned = task.assigned_to === myId;
  const isCreator  = task.created_by === myId || agendaCreatedBy === myId;
  const isKoord    = ['direktor', 'direktor_yardimcisi', 'asistan', 'koordinator'].includes(role);
  const canApprove = isKoord && task.completion_status === 'pending_review';
  const canMarkDone = isAssigned && task.completion_status !== 'approved' && task.completion_status !== 'pending_review';
  const canNotifyTask = onNotify && task.assigned_to && task.assigned_to !== myId && isKoord;

  const assigneeProfile = profiles.find(p => p.user_id === task.assigned_to);
  // Direktörü bul (bildirim göndermek için)
  const direktorProfile = profiles.find(p => p.role === 'direktor');

  const act = async (fn, notifList) => {
    setSaving(true);
    await fn();
    if (notifList) {
      const list = Array.isArray(notifList) ? notifList : [notifList];
      for (const n of list) {
        if (n) { try { await createNotification(n); } catch (e) { console.error('Notification error:', e); } }
      }
    }
    await onRefresh();
    setSaving(false);
  };

  const handleNotify = async () => {
    setNotifying(true);
    await onNotify(task);
    setNotifying(false);
  };

  return (
    <div style={{
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{task.title}</div>
          {task.description && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{task.description}</div>}
        </div>
        <PriorityBadge value={task.priority} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <TaskStatusBadge status={task.status} completionStatus={task.completion_status} />
        {task.due_date && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            📅 {new Date(task.due_date).toLocaleDateString('tr-TR')}
          </span>
        )}
        {task.assigned_to_name && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Avatar name={task.assigned_to_name} url={assigneeProfile?.avatar_url} size={20} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{task.assigned_to_name}</span>
          </div>
        )}
      </div>

      {task.completion_status === 'revision_requested' && task.revision_note && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#b91c1c' }}>
          🔄 Revize notu: {task.revision_note}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {canMarkDone && (
          <button className="btn btn-sm btn-primary" disabled={saving}
            onClick={() => {
              if (isPersonalAgenda) {
                // Kişisel gündem: direkt tamamla, onay gerekmez
                act(() => markAgendaTaskDoneSelf(task.id), null);
              } else {
                // Birim gündemi: onay bekliyor → koordinatöre/gündem sahibine bildirim
                const notifications = [];
                const notifyTo = task.created_by && task.created_by !== myId ? task.created_by : (agendaCreatedBy && agendaCreatedBy !== myId ? agendaCreatedBy : null);
                if (notifyTo) {
                  notifications.push({ userId: notifyTo, type: 'task_status', title: `"${task.title}" görevi onay bekliyor`, body: agendaTitle ? `${agendaTitle} gündeminde` : '', linkType: 'agenda', linkId: agendaId, createdBy: myId, createdByName: myName || '' });
                }
                act(() => markAgendaTaskDone(task.id), notifications);
              }
            }}>
            ✅ Tamamlandı İşaretle
          </button>
        )}
        {canApprove && (
          <>
            <button className="btn btn-sm btn-primary" disabled={saving}
              onClick={() => {
                const notifications = [];
                // Personele bildirim: görev onaylandı
                if (task.assigned_to && task.assigned_to !== myId) {
                  notifications.push({ userId: task.assigned_to, type: 'task_status', title: `"${task.title}" görevi onaylandı`, body: agendaTitle ? `${agendaTitle} gündeminde` : '', linkType: 'agenda', linkId: agendaId, createdBy: myId, createdByName: myName || '' });
                }
                // Koordinatör onayladığında → direktöre bildirim
                if (role === 'koordinator' && direktorProfile && direktorProfile.user_id !== myId) {
                  notifications.push({ userId: direktorProfile.user_id, type: 'task_status', title: `"${task.title}" görevi koordinatör tarafından onaylandı`, body: agendaTitle ? `${agendaTitle} gündeminde` : '', linkType: 'agenda', linkId: agendaId, createdBy: myId, createdByName: myName || '' });
                }
                act(() => approveAgendaTask(task.id), notifications);
              }}>
              👍 Onayla
            </button>
            <button className="btn btn-sm btn-danger" disabled={saving}
              onClick={() => setRevModal(true)}>
              🔄 Revize İste
            </button>
          </>
        )}
        {canNotifyTask && (
          <button
            disabled={notifying}
            onClick={handleNotify}
            title={`${task.assigned_to_name || ''} adresine mail gönder`}
            style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', fontSize: 12, padding: '4px 10px', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }}>
            {notifying ? '…' : '📧 Mail Gönder'}
          </button>
        )}
      </div>

      {revModal && (
        <RevisionModal
          task={task}
          onConfirm={async (note) => {
            await requestAgendaTaskRevision(task.id, note);
            if (task.assigned_to && task.assigned_to !== myId) {
              try { await createNotification({ userId: task.assigned_to, type: 'task_status', title: `"${task.title}" görevi için revize istendi`, body: note ? note.substring(0, 100) : '', linkType: 'agenda', linkId: agendaId, createdBy: myId, createdByName: myName || '' }); } catch (e) { console.error('Notification error:', e); }
            }
            await onRefresh();
            setRevModal(false);
          }}
          onClose={() => setRevModal(false)}
        />
      )}
    </div>
  );
}

// ── GÜNDEM KARTININ DETAY GÖRÜNÜMERİ ─────────────────────────────────────────
function AgendaDetailView({ agenda, myId, myName, myUnit, role, profiles, allProfiles, onClose, onRefresh, isMineTab = false }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [taskCommentTexts, setTaskCommentTexts] = useState({});
  const [taskModal, setTaskModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [saving, setSaving] = useState(false);

  const canAssign = ASSIGNER_ROLES.includes(role);
  const myProfile = profiles.find(p => p.user_id === myId);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    const { data } = await getAgendaDetail(agenda.id);
    setDetail(data);
    setLoading(false);
  }, [agenda.id]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const handleAddComment = async (taskId = null) => {
    const text = taskId ? taskCommentTexts[taskId] : commentText;
    if (!text?.trim()) return;
    setSaving(true);
    await addAgendaComment({
      agenda_id: agenda.id,
      task_id: taskId || null,
      content: text.trim(),
      created_by: myId,
      created_by_name: myProfile?.full_name || 'Bilinmiyor',
      avatar_url: myProfile?.avatar_url || null,
    });
    // Yorum bildirimi: gündem sahibine ve atanmış kişiye
    const commentTargets = new Set();
    if (agenda.created_by && agenda.created_by !== myId) commentTargets.add(agenda.created_by);
    if (agenda.assigned_to && agenda.assigned_to !== myId) commentTargets.add(agenda.assigned_to);
    if (taskId) {
      const task = (detail?.tasks || []).find(t => t.id === taskId);
      if (task?.assigned_to && task.assigned_to !== myId) commentTargets.add(task.assigned_to);
      if (task?.created_by && task.created_by !== myId) commentTargets.add(task.created_by);
    }
    // @mention bildirimleri — etiketlenen herkese bağımsız bildirim gönder
    const mentionedIds = extractMentions(text.trim(), allProfiles || profiles || []);
    console.log('[Mention] text:', text.trim(), 'mentionedIds:', mentionedIds);
    const alreadyNotified = new Set();
    // Önce mention bildirimlerini gönder
    for (const uid of mentionedIds) {
      if (uid !== myId) {
        try {
          await createNotification({ userId: uid, type: 'mention', title: `${myProfile?.full_name || 'Birisi'} sizi bir yorumda etiketledi`, body: text.trim().substring(0, 100), linkType: 'agenda', linkId: agenda.id, createdBy: myId, createdByName: myProfile?.full_name || '' });
          alreadyNotified.add(uid);
        } catch (e) { console.error('[Mention] notification error:', e); }
      }
    }
    // Sonra yorum bildirimlerini gönder (mention edilenler hariç, çift bildirim olmasın)
    for (const uid of commentTargets) {
      if (!alreadyNotified.has(uid)) {
        try {
          await createNotification({ userId: uid, type: 'comment_added', title: taskId ? 'Görevinize yorum eklendi' : `"${agenda.title}" gündemine yorum eklendi`, body: text.trim().substring(0, 100), linkType: 'agenda', linkId: agenda.id, createdBy: myId, createdByName: myProfile?.full_name || '' });
        } catch (e) { console.error('[Comment] notification error:', e); }
      }
    }
    if (taskId) setTaskCommentTexts(prev => ({ ...prev, [taskId]: '' }));
    else setCommentText('');
    setSaving(false);
    loadDetail();
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Yorum silinsin mi?')) return;
    await deleteAgendaComment(commentId);
    loadDetail();
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Bu görev silinsin mi?')) return;
    await deleteAgendaTask(taskId);
    loadDetail();
    onRefresh();
  };

  // Görev mail bildirimi
  const handleNotifyTask = async (task) => {
    if (!task.assigned_to) return;
    const { error } = await notifyTaskAssigned({
      assignedToUserId: task.assigned_to,
      taskTitle:        task.title,
      taskDescription:  task.description || '',
      taskPriority:     task.priority,
      taskDueDate:      task.due_date,
      taskUnit:         agenda.unit || '',
      createdByName:    myName || myProfile?.full_name || '',
    });
    if (error) alert('Mail gönderilemedi: ' + error.message);
    else alert('✅ Mail gönderildi → ' + (task.assigned_to_name || task.assigned_to));
  };

  if (loading) return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 700, minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-spinner" />
      </div>
    </div>
  );

  const tasks = detail?.tasks || [];
  const agendaComments = (detail?.comments || []).filter(c => !c.task_id);

  const type = agenda.agenda_types;
  const typeColor = type?.color || '#6366f1';
  const typeIcon = type?.icon || '📋';

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 720, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: typeColor + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              {typeIcon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: typeColor, background: typeColor + '18', padding: '2px 8px', borderRadius: 20 }}>
                  {typeIcon} {type?.name || 'Gündem'}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                  {AGENDA_STATUSES.find(s => s.value === agenda.status)?.label || 'Aktif'}
                </span>
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: '4px 0 0' }}>{agenda.title}</h2>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0, padding: 4 }}>✕</button>
          </div>
          {agenda.description && (
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '8px 0 0', lineHeight: 1.5 }}>{agenda.description}</p>
          )}
          {agenda.date && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              📅 {new Date(agenda.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          )}
        </div>

        {/* Body scroll */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>

          {/* Görevler */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                📌 Görevler ({tasks.length})
              </h3>
              {canAssign && (
                <button className="btn btn-sm btn-primary" onClick={() => { setEditTask(null); setTaskModal(true); }}>
                  + Görev Ekle
                </button>
              )}
            </div>

            {tasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: 13.5, background: 'var(--bg)', borderRadius: 10, border: '1px dashed var(--border)' }}>
                Henüz görev eklenmemiş.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tasks.map(task => {
                  const taskComments = (detail?.comments || []).filter(c => c.task_id === task.id);
                  return (
                    <div key={task.id} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ padding: '10px 12px' }}>
                        <TaskCard
                          task={task}
                          myId={myId}
                          myName={myProfile?.full_name || ''}
                          role={role}
                          profiles={profiles}
                          onRefresh={loadDetail}
                          agendaCreatedBy={agenda.created_by}
                          onNotify={handleNotifyTask}
                          agendaId={agenda.id}
                          agendaTitle={agenda.title}
                          isPersonalAgenda={!!agenda.is_personal}
                        />
                        {canAssign && (
                          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                            <button className="btn btn-sm btn-outline" onClick={() => { setEditTask(task); setTaskModal(true); }}>✏️ Düzenle</button>
                            <button className="btn btn-sm btn-outline" style={{ color: '#ef4444' }} onClick={() => handleDeleteTask(task.id)}>🗑 Sil</button>
                          </div>
                        )}
                      </div>

                      {/* Görev yorumları */}
                      {taskComments.length > 0 && (
                        <div style={{ borderTop: '1px solid var(--border)', padding: '8px 12px', background: 'var(--bg-sidebar)' }}>
                          {taskComments.map(c => (
                            <CommentBubble key={c.id} comment={c} myId={myId} onDelete={handleDeleteComment} profiles={allProfiles} />
                          ))}
                        </div>
                      )}
                      <div style={{ borderTop: '1px solid var(--border)', padding: '8px 12px', display: 'flex', gap: 6 }}>
                        <MentionInput
                          value={taskCommentTexts[task.id] || ''}
                          onChange={v => setTaskCommentTexts(prev => ({ ...prev, [task.id]: v }))}
                          onSubmit={() => handleAddComment(task.id)}
                          profiles={allProfiles}
                          myId={myId}
                          myUnit={myUnit}
                          isDirektor={role === 'direktor'}
                          placeholder="Yorum yaz… @ ile etiketle"
                          disabled={saving}
                        />
                        <button className="btn btn-sm btn-primary" disabled={saving} onClick={() => handleAddComment(task.id)}>↑</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Gündem Yorumları */}
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              💬 Gündem Notları
            </h3>
            {agendaComments.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                {agendaComments.map(c => (
                  <CommentBubble key={c.id} comment={c} myId={myId} onDelete={handleDeleteComment} profiles={allProfiles} />
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <MentionInput
                value={commentText}
                onChange={setCommentText}
                onSubmit={() => handleAddComment()}
                profiles={allProfiles}
                myId={myId}
                myUnit={myUnit}
                isDirektor={role === 'direktor'}
                placeholder="Not ekle… @ ile etiketle"
                disabled={saving}
              />
              <button className="btn btn-primary" disabled={saving} onClick={() => handleAddComment()}>↑</button>
            </div>
          </div>
        </div>
      </div>

      {taskModal && (
        <TaskModal
          task={editTask}
          agendaId={agenda.id}
          myId={myId}
          myName={myProfile?.full_name || ''}
          myUnit={myUnit}
          role={role}
          allProfiles={allProfiles}
          allowSelfAssign={isMineTab}
          onSave={async (data) => {
            if (editTask) {
              await updateAgendaTask(editTask.id, data);
              // Görev atanan kişi değiştiyse bildirim + mail gönder
              if (data.assigned_to && data.assigned_to !== myId && data.assigned_to !== editTask.assigned_to) {
                try { await createNotification({ userId: data.assigned_to, type: 'task_assigned', title: `"${data.title}" görevi size atandı`, body: `${agenda.title} gündeminde`, linkType: 'agenda', linkId: agenda.id, createdBy: myId, createdByName: myProfile?.full_name || '' }); } catch (e) { console.error('Task assign notif error:', e); }
                // Otomatik mail
                try { await notifyTaskAssigned({ assignedToUserId: data.assigned_to, taskTitle: data.title, taskDescription: `Bağlı Gündem: ${agenda.title}${data.description ? '\n\n' + data.description : ''}`, taskPriority: data.priority, taskDueDate: data.due_date, taskUnit: agenda.unit || '', createdByName: myProfile?.full_name || myName }); } catch (e) { console.error('Task mail error:', e); }
              }
            } else {
              await createAgendaTask({ ...data, agenda_id: agenda.id, created_by: myId, created_by_name: myProfile?.full_name || '' });
              // Yeni görev atandıysa bildirim + mail gönder
              if (data.assigned_to && data.assigned_to !== myId) {
                try { await createNotification({ userId: data.assigned_to, type: 'task_assigned', title: `"${data.title}" görevi size atandı`, body: `${agenda.title} gündeminde`, linkType: 'agenda', linkId: agenda.id, createdBy: myId, createdByName: myProfile?.full_name || '' }); } catch (e) { console.error('Task assign notif error:', e); }
                // Otomatik mail
                try { await notifyTaskAssigned({ assignedToUserId: data.assigned_to, taskTitle: data.title, taskDescription: `Bağlı Gündem: ${agenda.title}${data.description ? '\n\n' + data.description : ''}`, taskPriority: data.priority, taskDueDate: data.due_date, taskUnit: agenda.unit || '', createdByName: myProfile?.full_name || myName }); } catch (e) { console.error('Task mail error:', e); }
              }
            }
            setTaskModal(false);
            setEditTask(null);
            loadDetail();
            onRefresh();
          }}
          onClose={() => { setTaskModal(false); setEditTask(null); }}
        />
      )}
    </div>
  );
}

// ── GÖREV MODALI ──────────────────────────────────────────────────────────────
function TaskModal({ task, agendaId, myId, myName, myUnit, role, allProfiles = [], onSave, onClose, allowSelfAssign = false }) {
  // "Gündemlerim" tabında direktör = görevi kendine varsayılan ata
  const myProfile = (allProfiles || []).find(p => p.user_id === myId);
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    assigned_to: task?.assigned_to || (allowSelfAssign ? myId : ''),
    assigned_to_name: task?.assigned_to_name || (allowSelfAssign ? (myProfile?.full_name || myName) : ''),
    priority: task?.priority || 'orta',
    due_date: task?.due_date ? task.due_date.substring(0, 10) : '',
    status: task?.status || 'bekliyor',
  });
  const [saving, setSaving] = useState(false);

  // Atanabilir profiller:
  // - Koordinatör/Dir.Yard. → sadece kendi biriminin personeli
  // - Direktör "Gündemlerim" tabında → sadece kendisi (self-assign)
  // - Diğer durumlarda → direktör rolü hariç, kendisi hariç
  const TOP_ROLES = ['direktor'];
  const assignableProfiles = useMemo(() => {
    if (!allProfiles || !allProfiles.length) return [];
    const withUnit = allProfiles.filter(p => p.unit || TOP_ROLES.includes(p.role) || p.role === 'asistan');
    if (role === 'koordinator' || role === 'direktor_yardimcisi') return withUnit.filter(p => p.role === 'personel' && p.unit === myUnit);
    if (role === 'personel') {
      // Personel sadece kendine görev atayabilir
      return allProfiles.filter(p => p.user_id === myId);
    }
    if (allowSelfAssign) {
      return allProfiles.filter(p => p.user_id === myId);
    }
    const isTopRole = TOP_ROLES.includes(role);
    return withUnit.filter(p => {
      if (p.user_id === myId) return false;
      if (!isTopRole && TOP_ROLES.includes(p.role)) return false;
      return true;
    });
  }, [allProfiles, myId, role, myUnit, allowSelfAssign]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleAssignee = (userId) => {
    const prof = allProfiles.find(pr => pr.user_id === userId);
    set('assigned_to', userId);
    set('assigned_to_name', prof?.full_name || '');
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    await onSave({
      title: form.title.trim(),
      description: form.description.trim(),
      assigned_to: form.assigned_to || null,
      assigned_to_name: form.assigned_to_name || null,
      priority: form.priority,
      due_date: form.due_date || null,
      status: form.status,
    });
    setSaving(false);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 310 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520, zIndex: 311 }}>
        <h2 className="modal-title">{task ? '✏️ Görevi Düzenle' : '+ Yeni Görev'}</h2>
        <div className="form-group">
          <label className="form-label">Başlık *</label>
          <input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Görev başlığı…" />
        </div>
        <div className="form-group">
          <label className="form-label">Açıklama</label>
          <textarea className="form-textarea" rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Detaylar…" />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Öncelik</label>
            <select className="form-select" value={form.priority} onChange={e => set('priority', e.target.value)}>
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Bitiş Tarihi</label>
            <input className="form-input" type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Atanan Kişi</label>
          <select className="form-select" value={form.assigned_to} onChange={e => handleAssignee(e.target.value)}>
            <option value="">— Seçiniz —</option>
            {assignableProfiles.map(p => (
              <option key={p.user_id} value={p.user_id}>
                {p.full_name} ({ROLE_LABELS[p.role] || p.role})
              </option>
            ))}
          </select>
          {assignableProfiles.length === 0 && (
            <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>Atanabilecek kullanıcı bulunamadı.</div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" disabled={saving || !form.title.trim()} onClick={handleSubmit}>
            {saving ? '…' : (task ? 'Güncelle' : 'Ekle')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── GÜNDEM MODALI ─────────────────────────────────────────────────────────────
function AgendaModal({ agenda, agendaTypes, myId, myName, myUnit, canSeeAllUnits, availableUnits, isDirektor, isKoordinator, role, allProfiles, onSave, onClose }) {
  const [form, setForm] = useState({
    title: agenda?.title || '',
    description: agenda?.description || '',
    type_id: agenda?.type_id || (agendaTypes[0]?.id || ''),
    status: agenda?.status || 'aktif',
    date: agenda?.date ? agenda.date.substring(0, 10) : '',
    unit: agenda?.unit || myUnit || '',
    is_private: agenda?.is_private || false,
    custom_fields: agenda?.custom_fields || {},
    assigned_to: agenda?.assigned_to || '',
    assigned_to_name: agenda?.assigned_to_name || '',
  });
  const [saving, setSaving] = useState(false);

  const selectedType = agendaTypes.find(t => t.id === form.type_id);
  const typeFields = selectedType?.fields || [];

  // Atanabilir profiller
  // Direktör → koordinatörlere, asistana, dir.yardımcısına atayabilir
  // Koordinatör → kendi birimindeki personellere atayabilir
  const assignableProfiles = useMemo(() => {
    if (!allProfiles) return [];
    if (isDirektor) {
      return allProfiles.filter(p =>
        (p.role === 'koordinator' && p.unit) ||
        p.role === 'asistan' ||
        p.role === 'direktor_yardimcisi'
      );
    }
    if (isKoordinator && myUnit) {
      return allProfiles.filter(p =>
        p.role === 'personel' && p.unit === myUnit && p.user_id !== myId
      );
    }
    return [];
  }, [isDirektor, isKoordinator, myUnit, myId, allProfiles]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const setCustom = (k, v) => setForm(prev => ({ ...prev, custom_fields: { ...prev.custom_fields, [k]: v } }));

  const handleAssignCoord = (userId) => {
    const p = (allProfiles || []).find(pr => pr.user_id === userId);
    set('assigned_to', userId);
    set('assigned_to_name', p?.full_name || '');
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    await onSave({
      title: form.title.trim(),
      description: form.description.trim(),
      type_id: form.type_id || null,
      status: form.status,
      date: form.date || null,
      unit: form.unit || null,
      is_private: form.is_private,
      custom_fields: form.custom_fields,
      assigned_to: form.assigned_to || null,
      assigned_to_name: form.assigned_to_name || null,
    });
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <h2 className="modal-title">{agenda ? '✏️ Gündem Düzenle' : '+ Yeni Gündem'}</h2>

        <div className="form-group">
          <label className="form-label">Gündem Türü</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {agendaTypes.map(t => (
              <button
                key={t.id}
                onClick={() => set('type_id', t.id)}
                style={{
                  padding: '6px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                  border: `2px solid ${form.type_id === t.id ? t.color : 'var(--border)'}`,
                  background: form.type_id === t.id ? t.color + '18' : 'var(--bg)',
                  color: form.type_id === t.id ? t.color : 'var(--text)',
                  fontWeight: form.type_id === t.id ? 700 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {t.icon} {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Başlık *</label>
          <input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Gündem başlığı…" />
        </div>

        <div className="form-group">
          <label className="form-label">Açıklama</label>
          <textarea className="form-textarea" rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Detaylar…" />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Tarih</label>
            <input className="form-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Durum</label>
            <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
              {AGENDA_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {/* Dinamik alanlar */}
        {typeFields.map(field => (
          <div className="form-group" key={field.key}>
            <label className="form-label">{field.label}{field.required ? ' *' : ''}</label>
            {field.type === 'textarea' ? (
              <textarea className="form-textarea" rows={3}
                value={form.custom_fields[field.key] || ''}
                onChange={e => setCustom(field.key, e.target.value)}
                placeholder={field.placeholder || ''} />
            ) : field.type === 'select' ? (
              <select className="form-select"
                value={form.custom_fields[field.key] || ''}
                onChange={e => setCustom(field.key, e.target.value)}>
                <option value="">— Seçiniz —</option>
                {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input className="form-input"
                type={field.type || 'text'}
                value={form.custom_fields[field.key] || ''}
                onChange={e => setCustom(field.key, e.target.value)}
                placeholder={field.placeholder || ''} />
            )}
          </div>
        ))}

        {/* Birim: direktör seçebilir, diğerleri otomatik */}
        {canSeeAllUnits && availableUnits.length > 0 ? (
          <div className="form-group">
            <label className="form-label">🏗 Birim</label>
            <select className="form-select" value={form.unit} onChange={e => set('unit', e.target.value)}>
              <option value="">— Seçiniz —</option>
              {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        ) : myUnit ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '4px 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🏗</span> Birim: <strong>{myUnit}</strong>
          </div>
        ) : null}

        {/* Sorumlu Atama — direktör ve koordinatör */}
        {(isDirektor || isKoordinator) && assignableProfiles.length > 0 && (
          <div className="form-group">
            <label className="form-label">👤 Sorumlu Ata <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(isteğe bağlı)</span></label>
            <select className="form-select" value={form.assigned_to} onChange={e => handleAssignCoord(e.target.value)}>
              <option value="">— Sorumlu Seç —</option>
              {assignableProfiles.map(p => (
                <option key={p.user_id} value={p.user_id}>
                  {p.full_name}{p.unit ? ` (${p.unit})` : ''} — {p.role === 'koordinator' ? 'Koordinatör' : p.role === 'asistan' ? 'Asistan' : p.role === 'direktor_yardimcisi' ? 'Dir. Yardımcısı' : 'Personel'}
                </option>
              ))}
            </select>
            {form.assigned_to && (
              <div style={{ fontSize: 12, color: '#6366f1', marginTop: 4 }}>
                📥 Bu gündem <strong>{form.assigned_to_name}</strong>'a atanacak.
              </div>
            )}
          </div>
        )}

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13.5 }}>
            <input type="checkbox" checked={form.is_private} onChange={e => set('is_private', e.target.checked)} />
            🔒 Gizli gündem (sadece ben görebilirim)
          </label>
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" disabled={saving || !form.title.trim()} onClick={handleSubmit}>
            {saving ? '…' : (agenda ? 'Güncelle' : 'Oluştur')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── GÜNDEM KARTI ──────────────────────────────────────────────────────────────
function AgendaCard({ agenda, myId, role, profiles, onEdit, onDelete, onOpen, onNotify }) {
  const type = agenda.agenda_types;
  const typeColor = type?.color || '#6366f1';
  const typeIcon = type?.icon || '📋';
  const tasks = agenda.agenda_tasks || [];
  const doneTasks = tasks.filter(t => t.completion_status === 'approved' || t.status === 'tamamlandi');
  const pendingTasks = tasks.filter(t => t.completion_status === 'pending_review');

  const statusMeta = AGENDA_STATUSES.find(s => s.value === agenda.status) || AGENDA_STATUSES[0];

  const canEdit = CREATOR_ROLES.includes(role) && (agenda.created_by === myId || ['direktor', 'direktor_yardimcisi'].includes(role));

  return (
    <div
      className="card"
      style={{
        cursor: 'pointer',
        borderTop: `3px solid ${typeColor}`,
        background: `linear-gradient(135deg, ${typeColor}08 0%, ${typeColor}04 100%)`,
        transition: 'transform 0.15s, box-shadow 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        padding: 0,
        overflow: 'hidden',
      }}
      onClick={() => onOpen(agenda)}
    >
      {/* Kart Başlığı */}
      <div style={{ padding: '14px 16px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: typeColor + '22',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>
            {typeIcon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: typeColor, background: typeColor + '18', padding: '2px 7px', borderRadius: 20 }}>
                {type?.name || 'Gündem'}
              </span>
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{statusMeta.label}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {agenda.title}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            {/* Gündem mail bildirimi: atanmış gündem varsa direktör görebilir */}
            {onNotify && agenda.assigned_to && agenda.assigned_to !== myId && (
              <button
                className="btn btn-sm"
                onClick={() => onNotify(agenda)}
                title={`${agenda.assigned_to_name || ''} adresine mail gönder`}
                style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '3px 8px', fontSize: 12 }}>
                📧
              </button>
            )}
            {canEdit && (
              <>
                <button className="btn btn-sm btn-outline" onClick={() => onEdit(agenda)} title="Düzenle" style={{ padding: '3px 8px' }}>✏️</button>
                <button className="btn btn-sm btn-outline" onClick={() => onDelete(agenda.id)} title="Sil" style={{ padding: '3px 8px', color: '#ef4444' }}>🗑</button>
              </>
            )}
          </div>
        </div>

        {agenda.description && (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 6px', lineHeight: 1.4,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {agenda.description}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {agenda.date && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              📅 {new Date(agenda.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          )}
          {agenda.assigned_to_name && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: '#6366f1',
              background: '#6366f110', padding: '2px 8px', borderRadius: 12,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              👤 {agenda.assigned_to_name}
            </span>
          )}
          {agenda.created_by_name && (
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontStyle: 'italic', opacity: 0.7 }}>
              oluşturan: {agenda.created_by_name}
            </span>
          )}
        </div>
      </div>

      {/* Görevler bölümü */}
      {tasks.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>
              📌 {tasks.length} Görev
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {pendingTasks.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, background: '#fffbeb', color: '#f59e0b', padding: '2px 6px', borderRadius: 20 }}>
                  ⏳ {pendingTasks.length} onay
                </span>
              )}
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {doneTasks.length}/{tasks.length} tamam
              </span>
            </div>
          </div>

          {/* İlerleme çubuğu */}
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 4, marginBottom: 8, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: tasks.length > 0 ? `${(doneTasks.length / tasks.length) * 100}%` : '0%',
              background: typeColor,
              borderRadius: 4,
              transition: 'width 0.3s',
            }} />
          </div>

          {/* İlk 3 görevi listele */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {tasks.slice(0, 3).map(task => (
              <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12 }}>
                  {task.completion_status === 'approved' || task.status === 'tamamlandi' ? '✅' :
                   task.completion_status === 'pending_review' ? '⏳' :
                   task.completion_status === 'revision_requested' ? '🔄' : '⚪'}
                </span>
                <span style={{
                  fontSize: 12, color: 'var(--text)',
                  textDecoration: (task.completion_status === 'approved' || task.status === 'tamamlandi') ? 'line-through' : 'none',
                  opacity: (task.completion_status === 'approved' || task.status === 'tamamlandi') ? 0.5 : 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                }}>
                  {task.title}
                </span>
                {task.assigned_to_name && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{task.assigned_to_name.split(' ')[0]}</span>
                )}
              </div>
            ))}
            {tasks.length > 3 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 18 }}>+{tasks.length - 3} görev daha…</div>
            )}
          </div>
        </div>
      )}

      {tasks.length === 0 && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '8px 16px' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>📌 Henüz görev yok</span>
        </div>
      )}
    </div>
  );
}

// ── ANA BİLEŞEN ───────────────────────────────────────────────────────────────
export default function Agendas({ user, profile, linkedAgendaId, onClearLinkedAgenda }) {
  const [agendas, setAgendas] = useState([]);
  const [agendaTypes, setAgendaTypes] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agendaModal, setAgendaModal] = useState(false);
  const [editAgenda, setEditAgenda] = useState(null);
  const [detailAgenda, setDetailAgenda] = useState(null);
  const [detailIsMine, setDetailIsMine] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterUnit, setFilterUnit] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  // Sekmeler: unit | mine | assigned_to_me | assigned_by_me | assigned_tasks | my_tasks
  const [personalTab, setPersonalTab] = useState('unit');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list' | 'gallery' | 'table'

  const myId   = user?.id;
  const role   = profile?.role || 'personel';
  const myName = profile?.full_name || user?.email || '';
  const myUnit = profile?.unit || null;

  const isDirektor     = role === 'direktor';
  const isAsistan      = role === 'asistan';
  const isDirYardimcisi = role === 'direktor_yardimcisi'; // Grants birimi sorumlusu
  const isKoordinator  = role === 'koordinator' || isDirYardimcisi; // dir.yard. koordinatör gibi davranır
  const isPersonel     = role === 'personel';
  const hasPersonalTab = isDirektor || isKoordinator || isAsistan || isPersonel;
  const canSeeAllUnits = ['direktor', 'asistan'].includes(role);
  const canCreate      = CREATOR_ROLES.includes(role);
  const isMineTab          = hasPersonalTab && personalTab === 'mine';
  const isAssignedToMeTab  = (isKoordinator || isAsistan || isPersonel) && personalTab === 'assigned_to_me';
  const isAssignedByMeTab  = (isDirektor || isKoordinator) && personalTab === 'assigned_by_me';
  const isAssignedTasksTab = isPersonel && personalTab === 'assigned_tasks';
  const isMyTasksTab       = isPersonel && personalTab === 'my_tasks';
  const isPendingApprovalTab = (isDirektor || isKoordinator) && personalTab === 'pending_approval';

  // Tab başlığı role göre
  const unitTabLabel = (isDirektor || isAsistan) ? 'Departmanın Gündemleri' : 'Birimin Gündemleri';
  const unitTabIcon  = (isDirektor || isAsistan) ? '🏢' : '🏗';

  const loadAll = useCallback(async () => {
    setLoading(true);
    // Direktör değilse sadece kendi birimi gelsin (DB seviyesinde filtrele)
    const unitFilter = canSeeAllUnits ? null : (myUnit || null);
    const [{ data: types }, { data: ags }, { data: profs }] = await Promise.all([
      getAgendaTypes(),
      getAgendasV2(myId, unitFilter),
      getAllProfiles(),
    ]);
    setAgendaTypes(types || []);
    setAgendas(ags || []);
    setAllProfiles(profs || []);
    setLoading(false);
  }, [myId, myUnit, canSeeAllUnits]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Bildirimden gelen linkedAgendaId ile otomatik detay aç
  useEffect(() => {
    if (linkedAgendaId && agendas.length > 0 && !loading) {
      const target = agendas.find(a => a.id === linkedAgendaId);
      if (target) {
        setDetailAgenda(target);
        setDetailIsMine(false);
      }
      if (onClearLinkedAgenda) onClearLinkedAgenda();
    }
  }, [linkedAgendaId, agendas, loading, onClearLinkedAgenda]);

  // Direktör için mevcut birim listesi (profillerdeki + gündemlerdeki)
  const availableUnits = useMemo(() => {
    const fromProfiles = allProfiles.map(p => p.unit).filter(Boolean);
    const fromAgendas  = agendas.map(a => a.unit).filter(Boolean);
    return [...new Set([...fromProfiles, ...fromAgendas])].sort();
  }, [allProfiles, agendas]);

  const filteredAgendas = useMemo(() => {
    return agendas.filter(a => {
      if (isPendingApprovalTab) {
        // "Onay Bekleyenler" sekmesi: pending_review olan görev içeren gündemler
        if (a.is_personal) return false;
        if (!canSeeAllUnits && a.unit !== myUnit) return false;
        const tasks = a.agenda_tasks || [];
        const hasPending = tasks.some(t => t.completion_status === 'pending_review');
        if (!hasPending) return false;
      } else if (isAssignedByMeTab) {
        // "Atadığım Gündemler" sekmesi (direktör/koordinatör): başkasına atanmış gündemler
        if (!(a.assigned_to && a.assigned_to !== myId && a.created_by === myId && !a.is_personal)) return false;
      } else if (isAssignedToMeTab) {
        // "Bana Atanan Gündemler" sekmesi: başkası tarafından atanmış gündemler
        if (!(a.assigned_to === myId && a.created_by !== myId)) return false;
      } else if (isAssignedTasksTab) {
        // "Bana Atanan Görevler" sekmesi (personel): içinde bana atanmış görev olan gündemleri göster
        const tasks = a.agenda_tasks || [];
        const hasMyTask = tasks.some(t => t.assigned_to === myId && t.created_by !== myId);
        if (!hasMyTask) return false;
      } else if (isMyTasksTab) {
        // "Görevlerim" sekmesi (personel): kendi oluşturduğu görevler (kendi kendine atamış)
        const tasks = a.agenda_tasks || [];
        const hasMyOwnTask = tasks.some(t => t.assigned_to === myId && t.created_by === myId);
        if (!hasMyOwnTask) return false;
      } else if (isMineTab) {
        // "Gündemlerim" sekmesi: sadece kişisel gündemler (kendi oluşturduğu)
        if (!(a.is_personal && a.created_by === myId)) return false;
      } else {
        // "Birim/Departman" sekmesi: kişisel gündemler gizli
        if (a.is_personal) return false;
        // Personel ve Koordinatör: birim gündemlerinin hepsi görünsün (atanan/atadığı dahil)
        if (isPersonel || isKoordinator) {
          // Sadece kişisel gündemleri gizle (yukarıda zaten yapıldı)
        } else if (isDirektor) {
          // Direktör için: atanmış gündemler bu sekmede gizli (Atadığım'da görünür)
          if (a.assigned_to && !a.is_personal) return false;
        } else {
          // Asistana atanan görevler birim sekmesinde hiç görünmez
          const assignedProfile = allProfiles.find(p => p.user_id === a.assigned_to || p.id === a.assigned_to);
          if (assignedProfile?.role === 'asistan' && a.assigned_to !== myId) return false;
        }
      }
      if (filterType !== 'all' && a.type_id !== filterType) return false;
      if (filterStatus !== 'all' && a.status !== filterStatus) return false;
      if (canSeeAllUnits && !isMineTab && !isAssignedToMeTab && !isAssignedByMeTab && filterUnit !== 'all' && a.unit !== filterUnit) return false;
      if (searchQ) {
        const q = searchQ.toLowerCase();
        if (!a.title?.toLowerCase().includes(q) && !a.description?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [agendas, filterType, filterStatus, filterUnit, searchQ, canSeeAllUnits, isMineTab, isAssignedToMeTab, isAssignedByMeTab, isAssignedTasksTab, isMyTasksTab, isPendingApprovalTab, myId, myUnit, isKoordinator, isDirektor, allProfiles]);

  // Departman tabında gündemleri birime göre grupla
  const groupedByUnit = useMemo(() => {
    if (!canSeeAllUnits || isMineTab || isAssignedToMeTab || isAssignedByMeTab || filterUnit !== 'all') return null;
    const groups = {};
    filteredAgendas.forEach(a => {
      const key = a.unit || '—';
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    });
    return groups;
  }, [filteredAgendas, canSeeAllUnits, isMineTab, isAssignedToMeTab, isAssignedByMeTab, filterUnit]);

  const handleSaveAgenda = async (data) => {
    if (editAgenda) {
      await updateAgenda(editAgenda.id, data);
      // Gündem atama değişikliği bildirimi + mail
      if (data.assigned_to && data.assigned_to !== editAgenda.assigned_to && data.assigned_to !== myId) {
        try { await createNotification({ userId: data.assigned_to, type: 'agenda_assigned', title: `"${data.title}" gündemi size atandı`, body: '', linkType: 'agenda', linkId: editAgenda.id, createdBy: myId, createdByName: myName || '' }); } catch (e) { console.error('Notification error:', e); }
        // Otomatik mail — gündem içindeki görevlerle birlikte
        try {
          const agendaTasks = (editAgenda.agenda_tasks || []).map(t => ({
            title: t.title, assignedToName: t.assigned_to_name || '', priority: t.priority || '', dueDate: t.due_date || '', status: t.status || '',
          }));
          await notifyTaskAssigned({ assignedToUserId: data.assigned_to, taskTitle: data.title, taskDescription: data.description || '', taskPriority: null, taskDueDate: data.date || null, taskUnit: data.unit || myUnit || '', createdByName: myName, isAgenda: true, tasks: agendaTasks });
        } catch (e) { console.error('Agenda mail error:', e); }
      }
    } else {
      // Yeni gündemde unit otomatik atanır; Gündemlerim tabında is_personal=true
      const result = await createAgenda({
        ...data,
        created_by: myId,
        created_by_name: myName,
        unit: isMineTab ? null : (myUnit || data.unit || null),
        is_personal: isMineTab,
      });
      // Yeni gündem atama bildirimi + mail
      if (data.assigned_to && data.assigned_to !== myId && result?.data?.[0]?.id) {
        try { await createNotification({ userId: data.assigned_to, type: 'agenda_assigned', title: `"${data.title}" gündemi size atandı`, body: '', linkType: 'agenda', linkId: result.data[0].id, createdBy: myId, createdByName: myName || '' }); } catch (e) { console.error('Notification error:', e); }
        // Otomatik mail
        try {
          await notifyTaskAssigned({ assignedToUserId: data.assigned_to, taskTitle: data.title, taskDescription: data.description || '', taskPriority: null, taskDueDate: data.date || null, taskUnit: isMineTab ? '' : (myUnit || data.unit || ''), createdByName: myName, isAgenda: true, tasks: [] });
        } catch (e) { console.error('Agenda mail error:', e); }
      }
    }
    setAgendaModal(false);
    setEditAgenda(null);
    loadAll();
  };

  const handleDeleteAgenda = async (id) => {
    if (!window.confirm('Bu gündem ve içindeki tüm görevler silinecek. Emin misiniz?')) return;
    await deleteAgenda(id);
    loadAll();
  };

  const handleEdit = (agenda) => {
    setEditAgenda(agenda);
    setAgendaModal(true);
  };

  // Gündem düzeyinde mail bildirimi (direktör → koordinatöre atanmış gündem)
  const handleNotifyAgenda = async (agenda) => {
    if (!agenda.assigned_to) return;
    // agenda_tasks zaten getAgendasV2 join'inden geliyor
    const tasks = (agenda.agenda_tasks || []).map(t => ({
      title:          t.title,
      assignedToName: t.assigned_to_name || '',
      priority:       t.priority || '',
      dueDate:        t.due_date || '',
      status:         t.status || '',
    }));
    const { error } = await notifyTaskAssigned({
      assignedToUserId: agenda.assigned_to,
      taskTitle:        agenda.title,
      taskDescription:  agenda.description || '',
      taskPriority:     null,
      taskDueDate:      agenda.date || null,
      taskUnit:         agenda.unit || '',
      createdByName:    myName,
      isAgenda:         true,
      tasks,
    });
    if (error) alert('Mail gönderilemedi: ' + error.message);
    else alert('✅ Mail gönderildi → ' + (agenda.assigned_to_name || agenda.assigned_to));
  };

  const pendingApprovalCount = useMemo(() => {
    if (!['direktor', 'direktor_yardimcisi', 'asistan', 'koordinator'].includes(role)) return 0;
    return agendas.reduce((sum, a) => {
      // Koordinatör: sadece kendi biriminin onay bekleyenlerini görür
      // Direktör: hepsini görür
      if (!canSeeAllUnits && a.unit !== myUnit) return sum;
      return sum + (a.agenda_tasks || []).filter(t => t.completion_status === 'pending_review').length;
    }, 0);
  }, [agendas, role, canSeeAllUnits, myUnit]);

  // ── Görünüm yardımcıları ────────────────────────────────────────────────────
  const cardProps = (agenda) => ({
    key: agenda.id,
    agenda,
    myId,
    role,
    profiles: allProfiles,
    onEdit: handleEdit,
    onDelete: handleDeleteAgenda,
    onOpen: (a) => { setDetailAgenda(a); setDetailIsMine(isMineTab || isMyTasksTab); },
    onNotify: handleNotifyAgenda,
  });

  // GRID (mevcut kart grid)
  const CardGrid = ({ items }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
      {items.map(agenda => <AgendaCard {...cardProps(agenda)} />)}
    </div>
  );

  // GALLERY (daha geniş, yatay kartlar - 2 sütun)
  const GalleryView = ({ items }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: 20 }}>
      {items.map(agenda => {
        const type = agenda.agenda_types;
        const typeColor = type?.color || '#6366f1';
        const typeIcon = type?.icon || '📋';
        const tasks = agenda.agenda_tasks || [];
        const doneTasks = tasks.filter(t => t.completion_status === 'approved' || t.status === 'tamamlandi');
        const statusMeta = AGENDA_STATUSES.find(s => s.value === agenda.status) || AGENDA_STATUSES[0];
        return (
          <div key={agenda.id} onClick={() => { setDetailAgenda(agenda); setDetailIsMine(isMineTab); }}
            className="card" style={{ cursor:'pointer', overflow:'hidden', padding:0, display:'flex', flexDirection:'row', transition:'transform 0.15s, box-shadow 0.15s', background:`linear-gradient(135deg, ${typeColor}08 0%, ${typeColor}04 100%)` }}
            onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 20px rgba(0,0,0,0.1)';}}
            onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='';}}
          >
            {/* Sol renk şeridi */}
            <div style={{ width:6, background:typeColor, flexShrink:0 }} />
            {/* Sol: ikon */}
            <div style={{ width:80, display:'flex', alignItems:'center', justifyContent:'center', background:typeColor+'0a', flexShrink:0 }}>
              <span style={{ fontSize:32 }}>{typeIcon}</span>
            </div>
            {/* Orta: bilgi */}
            <div style={{ flex:1, padding:'16px 20px', minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, flexWrap:'wrap' }}>
                <span style={{ fontSize:10.5, fontWeight:700, color:typeColor, background:typeColor+'18', padding:'2px 7px', borderRadius:20 }}>{type?.name||'Gündem'}</span>
                <span style={{ fontSize:10.5, color:'var(--text-muted)' }}>{statusMeta.label}</span>
                {agenda.unit && <span style={{ fontSize:10, color:'var(--text-muted)', background:'var(--bg)', padding:'1px 6px', borderRadius:8 }}>🏗 {agenda.unit}</span>}
              </div>
              <div style={{ fontWeight:700, fontSize:15, marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{agenda.title}</div>
              {agenda.description && (
                <p style={{ fontSize:12.5, color:'var(--text-muted)', margin:'0 0 6px', lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{agenda.description}</p>
              )}
              {agenda.date && <div style={{ fontSize:11, color:'var(--text-muted)' }}>📅 {new Date(agenda.date).toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'})}</div>}
            </div>
            {/* Sağ: görev bilgisi */}
            <div style={{ width:120, borderLeft:'1px solid var(--border)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:16, gap:8, flexShrink:0 }}>
              <div style={{ fontSize:24, fontWeight:800, color:typeColor }}>{doneTasks.length}/{tasks.length}</div>
              <div style={{ fontSize:10.5, color:'var(--text-muted)', textAlign:'center' }}>görev tamamlandı</div>
              {tasks.length > 0 && (
                <div style={{ width:'100%', height:4, background:'var(--border)', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${tasks.length>0?(doneTasks.length/tasks.length)*100:0}%`, background:typeColor, borderRadius:4 }} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // LIST (kompakt liste)
  const ListView = ({ items }) => (
    <div className="card" style={{ padding:0, overflow:'hidden' }}>
      {items.map((agenda, i) => {
        const type = agenda.agenda_types;
        const typeColor = type?.color || '#6366f1';
        const typeIcon = type?.icon || '📋';
        const tasks = agenda.agenda_tasks || [];
        const doneTasks = tasks.filter(t => t.completion_status === 'approved' || t.status === 'tamamlandi');
        const pendingTasks = tasks.filter(t => t.completion_status === 'pending_review');
        const statusMeta = AGENDA_STATUSES.find(s => s.value === agenda.status) || AGENDA_STATUSES[0];
        const canEdit = CREATOR_ROLES.includes(role) && (agenda.created_by === myId || ['direktor','direktor_yardimcisi'].includes(role));
        return (
          <div key={agenda.id} onClick={() => { setDetailAgenda(agenda); setDetailIsMine(isMineTab); }}
            style={{
              display:'flex', alignItems:'center', gap:14, padding:'12px 20px', cursor:'pointer',
              borderBottom: i<items.length-1 ? '1px solid var(--border)' : 'none',
              borderLeft:`3px solid ${typeColor}`, transition:'background 0.1s',
            }}
            onMouseEnter={e=>e.currentTarget.style.background=typeColor+'0c'}
            onMouseLeave={e=>e.currentTarget.style.background=typeColor+'05'}
          >
            <span style={{ fontSize:20, flexShrink:0 }}>{typeIcon}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                <span style={{ fontWeight:700, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{agenda.title}</span>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ fontSize:10.5, fontWeight:600, color:typeColor, background:typeColor+'18', padding:'1px 6px', borderRadius:12 }}>{type?.name||'Gündem'}</span>
                <span style={{ fontSize:10.5, color:'var(--text-muted)' }}>{statusMeta.label}</span>
                {agenda.unit && <span style={{ fontSize:10, color:'var(--text-muted)' }}>🏗 {agenda.unit}</span>}
                {agenda.date && <span style={{ fontSize:10.5, color:'var(--text-muted)' }}>📅 {new Date(agenda.date).toLocaleDateString('tr-TR',{day:'numeric',month:'short'})}</span>}
                {agenda.assigned_to_name && <span style={{ fontSize:10.5, color:'var(--text-muted)' }}>👤 {agenda.assigned_to_name}</span>}
              </div>
            </div>
            {/* Görev sayacı */}
            <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
              {pendingTasks.length > 0 && (
                <span style={{ fontSize:10, fontWeight:700, background:'#fffbeb', color:'#f59e0b', padding:'2px 6px', borderRadius:20 }}>⏳ {pendingTasks.length}</span>
              )}
              <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600 }}>📌 {doneTasks.length}/{tasks.length}</span>
              {tasks.length > 0 && (
                <div style={{ width:48, height:4, background:'var(--border)', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${(doneTasks.length/tasks.length)*100}%`, background:typeColor, borderRadius:4 }} />
                </div>
              )}
            </div>
            {/* Aksiyon butonları */}
            <div style={{ display:'flex', gap:4, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
              {canEdit && (
                <>
                  <button className="btn btn-sm btn-outline" onClick={()=>handleEdit(agenda)} title="Düzenle" style={{ padding:'3px 8px' }}>✏️</button>
                  <button className="btn btn-sm btn-outline" onClick={()=>handleDeleteAgenda(agenda.id)} title="Sil" style={{ padding:'3px 8px', color:'#ef4444' }}>🗑</button>
                </>
              )}
            </div>
            <span style={{ color:'#d1d5db', fontSize:16, flexShrink:0 }}>›</span>
          </div>
        );
      })}
    </div>
  );

  // TABLE (tablo görünümü)
  const TableView = ({ items }) => (
    <div className="card" style={{ padding:0, overflow:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
        <thead>
          <tr style={{ background:'var(--bg)', borderBottom:'2px solid var(--border)' }}>
            <th style={{ textAlign:'left', padding:'10px 14px', fontWeight:700, fontSize:11.5, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em' }}>Gündem</th>
            <th style={{ textAlign:'left', padding:'10px 14px', fontWeight:700, fontSize:11.5, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em' }}>Tür</th>
            <th style={{ textAlign:'left', padding:'10px 14px', fontWeight:700, fontSize:11.5, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em' }}>Durum</th>
            <th style={{ textAlign:'left', padding:'10px 14px', fontWeight:700, fontSize:11.5, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em' }}>Birim</th>
            <th style={{ textAlign:'left', padding:'10px 14px', fontWeight:700, fontSize:11.5, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em' }}>Tarih</th>
            <th style={{ textAlign:'left', padding:'10px 14px', fontWeight:700, fontSize:11.5, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em' }}>Sorumlu</th>
            <th style={{ textAlign:'center', padding:'10px 14px', fontWeight:700, fontSize:11.5, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em' }}>Görevler</th>
            <th style={{ textAlign:'center', padding:'10px 14px', fontWeight:700, fontSize:11.5, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em' }}>İlerleme</th>
          </tr>
        </thead>
        <tbody>
          {items.map((agenda, i) => {
            const type = agenda.agenda_types;
            const typeColor = type?.color || '#6366f1';
            const tasks = agenda.agenda_tasks || [];
            const doneTasks = tasks.filter(t => t.completion_status === 'approved' || t.status === 'tamamlandi');
            const statusMeta = AGENDA_STATUSES.find(s => s.value === agenda.status) || AGENDA_STATUSES[0];
            const pct = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0;
            return (
              <tr key={agenda.id} onClick={() => { setDetailAgenda(agenda); setDetailIsMine(isMineTab); }}
                style={{ cursor:'pointer', borderBottom:'1px solid var(--border)', transition:'background 0.1s' }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--bg)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}
              >
                <td style={{ padding:'10px 14px', fontWeight:600 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:16 }}>{type?.icon||'📋'}</span>
                    <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:240 }}>{agenda.title}</span>
                  </div>
                </td>
                <td style={{ padding:'10px 14px' }}>
                  <span style={{ fontSize:11, fontWeight:600, color:typeColor, background:typeColor+'18', padding:'2px 8px', borderRadius:12 }}>{type?.name||'Gündem'}</span>
                </td>
                <td style={{ padding:'10px 14px', fontSize:12 }}>{statusMeta.label}</td>
                <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text-muted)' }}>{agenda.unit || '—'}</td>
                <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text-muted)' }}>
                  {agenda.date ? new Date(agenda.date).toLocaleDateString('tr-TR',{day:'numeric',month:'short',year:'numeric'}) : '—'}
                </td>
                <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text-muted)' }}>{agenda.assigned_to_name || '—'}</td>
                <td style={{ padding:'10px 14px', textAlign:'center', fontSize:12, fontWeight:600 }}>
                  <span style={{ color:typeColor }}>{doneTasks.length}</span>/{tasks.length}
                </td>
                <td style={{ padding:'10px 14px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'center' }}>
                    <div style={{ width:60, height:5, background:'var(--border)', borderRadius:4, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:typeColor, borderRadius:4 }} />
                    </div>
                    <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600 }}>%{pct}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // Genel render yardımcısı — seçilen viewMode'a göre
  const RenderItems = ({ items }) => {
    if (viewMode === 'list')    return <ListView items={items} />;
    if (viewMode === 'gallery') return <GalleryView items={items} />;
    if (viewMode === 'table')   return <TableView items={items} />;
    return <CardGrid items={items} />;
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Başlık */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasPersonalTab ? 0 : 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>📋 Gündemler</h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            {isAssignedByMeTab
              ? `${filteredAgendas.length} gündem · atadığım`
              : isAssignedToMeTab
                ? `${filteredAgendas.length} gündem · bana atanan`
                : isAssignedTasksTab
                  ? `${filteredAgendas.length} gündem · bana atanan görevler`
                  : isMyTasksTab
                    ? `${filteredAgendas.length} gündem · görevlerim`
                    : isMineTab
                      ? `${filteredAgendas.length} gündem · kişisel`
                      : canSeeAllUnits
                        ? `${agendas.filter(a => !a.is_personal && !a.assigned_to).length} gündem · tüm birimler`
                        : `${agendas.filter(a => !a.is_personal).length} gündem · ${myUnit || 'birimsiz'}`}
          </p>
        </div>
        {canCreate && !isAssignedToMeTab && !isAssignedByMeTab && !isAssignedTasksTab && !isMyTasksTab && !isPendingApprovalTab && (
          <button className="btn btn-primary" onClick={() => { setEditAgenda(null); setAgendaModal(true); }}>
            + Yeni Gündem
          </button>
        )}
      </div>

      {/* ── Direktör / Koordinatör ana tab ── */}
      {hasPersonalTab && (
        <div style={{ display: 'flex', gap: 4, margin: '16px 0 20px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 4, width: 'fit-content', flexWrap: 'wrap' }}>
          {[
            // Personel için özel sekmeler
            ...(isPersonel ? [
              { id: 'unit',            icon: '🏗', label: 'Birim Gündemleri' },
              { id: 'assigned_to_me',  icon: '📥', label: 'Bana Atanan Gündemler' },
              { id: 'assigned_tasks',  icon: '📌', label: 'Bana Atanan Görevler' },
              { id: 'my_tasks',        icon: '✅', label: 'Görevlerim' },
              { id: 'mine',            icon: '📋', label: 'Gündemlerim' },
            ] : [
              // Diğer roller için mevcut sekmeler
              { id: 'unit',           icon: unitTabIcon, label: unitTabLabel },
              ...((isKoordinator || isAsistan) ? [{ id: 'assigned_to_me',  icon: '📥', label: 'Bana Atanan' }] : []),
              ...((isDirektor || isKoordinator) ? [{ id: 'assigned_by_me',  icon: '📤', label: 'Atadığım Gündemler' }] : []),
              ...((isDirektor || isKoordinator) ? [{ id: 'pending_approval', icon: '⏳', label: 'Onay Bekleyenler' }] : []),
              { id: 'mine',           icon: '📋',        label: 'Gündemlerim' },
            ]),
          ].map(tab => {
            const isActive = personalTab === tab.id;
            // Badge sayıları
            let assignedCount = 0;
            if (tab.id === 'assigned_to_me') {
              assignedCount = agendas.filter(a => a.assigned_to === myId && a.created_by !== myId && !a.is_personal).length;
            } else if (tab.id === 'assigned_by_me') {
              assignedCount = agendas.filter(a => a.assigned_to && a.assigned_to !== myId && a.created_by === myId && !a.is_personal).length;
            } else if (tab.id === 'assigned_tasks') {
              assignedCount = agendas.reduce((sum, a) => sum + (a.agenda_tasks || []).filter(t => t.assigned_to === myId && t.created_by !== myId).length, 0);
            } else if (tab.id === 'my_tasks') {
              assignedCount = agendas.reduce((sum, a) => sum + (a.agenda_tasks || []).filter(t => t.assigned_to === myId && t.created_by === myId).length, 0);
            } else if (tab.id === 'pending_approval') {
              assignedCount = pendingApprovalCount;
            }
            return (
              <button key={tab.id} onClick={() => { setPersonalTab(tab.id); setFilterUnit('all'); setFilterType('all'); setFilterStatus('all'); setSearchQ(''); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  fontSize: 13.5, fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  background: isActive ? 'var(--navy)' : 'transparent',
                  boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.18)' : 'none',
                  transition: 'all 0.15s',
                }}>
                <span>{tab.icon}</span> {tab.label}
                {assignedCount > 0 && (
                  <span style={{ background: '#6366f1', color: '#fff', borderRadius: 20, fontSize: 11, fontWeight: 700, padding: '1px 7px', marginLeft: 2 }}>
                    {assignedCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Birim sekmeleri — departman tabında direktör */}
      {canSeeAllUnits && !isMineTab && !isAssignedToMeTab && !isAssignedByMeTab && availableUnits.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4, flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterUnit('all')}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer', flexShrink: 0,
              border: `2px solid ${filterUnit === 'all' ? 'var(--navy)' : 'var(--border)'}`,
              background: filterUnit === 'all' ? 'var(--navy)' : 'var(--bg-card)',
              color: filterUnit === 'all' ? '#fff' : 'var(--text)', fontWeight: filterUnit === 'all' ? 700 : 400,
            }}>
            🏢 Tüm Birimler ({agendas.length})
          </button>
          {availableUnits.map(u => {
            const cnt = agendas.filter(a => a.unit === u).length;
            const isActive = filterUnit === u;
            return (
              <button key={u} onClick={() => setFilterUnit(isActive ? 'all' : u)}
                style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer', flexShrink: 0,
                  border: `2px solid ${isActive ? '#6366f1' : 'var(--border)'}`,
                  background: isActive ? '#6366f1' : 'var(--bg-card)',
                  color: isActive ? '#fff' : 'var(--text)', fontWeight: isActive ? 700 : 400,
                }}>
                🏗 {u} ({cnt})
              </button>
            );
          })}
        </div>
      )}

      {/* Tür + durum + arama filtreleri + görünüm seçici */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-input" style={{ width: 200, fontSize: 13 }} placeholder="🔍 Ara…"
          value={searchQ} onChange={e => setSearchQ(e.target.value)} />

        <select className="form-select" style={{ width: 155, fontSize: 13 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">Tüm Türler</option>
          {agendaTypes.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
        </select>

        <select className="form-select" style={{ width: 155, fontSize: 13 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">Tüm Durumlar</option>
          {AGENDA_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        {/* Görünüm seçici */}
        <div style={{ marginLeft:'auto', display:'flex', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:2, gap:2 }}>
          {[
            { id:'grid',    icon:'▦', tip:'Grid' },
            { id:'list',    icon:'☰', tip:'Liste' },
            { id:'gallery', icon:'▬', tip:'Galeri' },
            { id:'table',   icon:'▤', tip:'Tablo' },
          ].map(v => (
            <button key={v.id} title={v.tip} onClick={()=>setViewMode(v.id)}
              style={{
                width:32, height:30, display:'flex', alignItems:'center', justifyContent:'center',
                borderRadius:8, border:'none', cursor:'pointer', fontSize:15,
                background: viewMode===v.id ? 'var(--navy)' : 'transparent',
                color: viewMode===v.id ? '#fff' : 'var(--text-muted)',
                transition:'all 0.15s', fontWeight:700,
              }}>
              {v.icon}
            </button>
          ))}
        </div>

        {(filterType !== 'all' || filterStatus !== 'all' || searchQ || filterUnit !== 'all') && (
          <button className="btn btn-outline btn-sm" onClick={() => { setFilterType('all'); setFilterStatus('all'); setSearchQ(''); setFilterUnit('all'); }}>
            ✕ Temizle
          </button>
        )}
      </div>

      {/* Tür pill filtreleri */}
      {agendaTypes.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
          <button onClick={() => setFilterType('all')}
            style={{ padding: '5px 13px', borderRadius: 20, fontSize: 12, cursor: 'pointer', flexShrink: 0,
              border: `2px solid ${filterType === 'all' ? 'var(--accent)' : 'var(--border)'}`,
              background: filterType === 'all' ? 'var(--accent)' : 'var(--bg-card)',
              color: filterType === 'all' ? '#fff' : 'var(--text)', fontWeight: filterType === 'all' ? 700 : 400 }}>
            Tümü ({filteredAgendas.length})
          </button>
          {agendaTypes.map(t => {
            const cnt = filteredAgendas.filter(a => a.type_id === t.id).length;
            const isActive = filterType === t.id;
            return (
              <button key={t.id} onClick={() => setFilterType(isActive ? 'all' : t.id)}
                style={{ padding: '5px 13px', borderRadius: 20, fontSize: 12, cursor: 'pointer', flexShrink: 0,
                  border: `2px solid ${isActive ? t.color : 'var(--border)'}`,
                  background: isActive ? t.color : 'var(--bg-card)',
                  color: isActive ? '#fff' : 'var(--text)', fontWeight: isActive ? 700 : 400 }}>
                {t.icon} {t.name} ({cnt})
              </button>
            );
          })}
        </div>
      )}

      {/* İçerik */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="loading-spinner" />
        </div>
      ) : filteredAgendas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{isAssignedTasksTab || isMyTasksTab ? '📌' : '📋'}</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
            {isAssignedTasksTab ? 'Bana atanan görev yok'
              : isMyTasksTab ? 'Henüz görev oluşturmadınız'
              : isAssignedToMeTab ? 'Bana atanan gündem yok'
              : isMineTab ? 'Henüz kişisel gündem yok'
              : agendas.length === 0 ? 'Henüz gündem yok' : 'Filtre ile eşleşen gündem yok'}
          </div>
          <div style={{ fontSize: 13.5 }}>
            {isMineTab && canCreate ? '+ Yeni Gündem düğmesiyle ekleyebilirsiniz.'
              : isAssignedTasksTab ? 'Size görev atandığında burada görünecek.'
              : isMyTasksTab ? 'Gündem detayından kendinize görev ekleyebilirsiniz.'
              : canCreate ? '+ Yeni Gündem düğmesiyle ekleyebilirsiniz.'
              : 'Henüz atanmış bir gündem bulunmuyor.'}
          </div>
        </div>
      ) : (isAssignedTasksTab || isMyTasksTab) ? (
        /* Personel: görev bazlı görünüm — ilgili görevleri gündem başlıkları altında listele */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {filteredAgendas.map(agenda => {
            const tasks = (agenda.agenda_tasks || []).filter(t =>
              isAssignedTasksTab
                ? (t.assigned_to === myId && t.created_by !== myId)
                : (t.assigned_to === myId && t.created_by === myId)
            );
            const type = agenda.agenda_types;
            const typeColor = type?.color || '#6366f1';
            return (
              <div key={agenda.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Gündem başlığı */}
                <div onClick={() => { setDetailAgenda(agenda); setDetailIsMine(isMyTasksTab); }}
                  style={{
                    padding: '12px 20px', background: typeColor + '08', borderBottom: '1px solid var(--border)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                  <span style={{ fontSize: 18 }}>{type?.icon || '📋'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{agenda.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {type?.name || 'Gündem'} {agenda.unit ? `· 🏗 ${agenda.unit}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 11.5, color: typeColor, fontWeight: 600 }}>{tasks.length} görev</span>
                </div>
                {/* Görevler */}
                {tasks.map((task, i) => {
                  const prio = prioMeta(task.priority);
                  return (
                    <div key={task.id} style={{
                      padding: '10px 20px 10px 36px', display: 'flex', alignItems: 'center', gap: 10,
                      borderBottom: i < tasks.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <TaskStatusBadge status={task.status} completionStatus={task.completion_status} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                          <PriorityBadge value={task.priority} />
                          {task.due_date && <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>📅 {new Date(task.due_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>}
                        </div>
                      </div>
                      {/* Tamamla butonu — sadece devam eden görevler */}
                      {task.status !== 'tamamlandi' && task.completion_status !== 'pending_review' && task.completion_status !== 'approved' && (
                        <button className="btn btn-sm btn-primary" style={{ fontSize: 11, padding: '4px 10px' }}
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (isMyTasksTab || agenda.is_personal) {
                              // Kendi görevi: direkt tamamla
                              await markAgendaTaskDoneSelf(task.id);
                            } else {
                              // Birim gündemi: onay bekliyor
                              await markAgendaTaskDone(task.id);
                              const notifyTo = task.created_by && task.created_by !== myId ? task.created_by : (agenda.created_by && agenda.created_by !== myId ? agenda.created_by : null);
                              if (notifyTo) { try { await createNotification({ userId: notifyTo, type: 'task_status', title: `"${task.title}" görevi onay bekliyor`, body: `${agenda.title} gündeminde`, linkType: 'agenda', linkId: agenda.id, createdBy: myId, createdByName: myName || '' }); } catch (e) { console.error('Notification error:', e); } }
                            }
                            loadAll();
                          }}>
                          ✓ Tamamla
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : isAssignedByMeTab ? (
        /* Direktör/Koordinatör: atanan kişiye göre gruplu "Atadığım Gündemler" görünümü */
        (() => {
          const byAssignee = {};
          filteredAgendas.forEach(a => {
            const key = a.assigned_to_name || 'Bilinmiyor';
            if (!byAssignee[key]) byAssignee[key] = [];
            byAssignee[key].push(a);
          });
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {Object.entries(byAssignee).sort(([a], [b]) => a.localeCompare(b)).map(([assigneeName, items]) => (
                <div key={assigneeName}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 16 }}>👤</span>
                      {assigneeName}
                    </div>
                    <span style={{ background: '#6366f118', color: '#6366f1', borderRadius: 20, padding: '2px 10px', fontSize: 11.5, fontWeight: 600 }}>
                      {items.length} gündem
                    </span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  </div>
                  <RenderItems items={items} />
                </div>
              ))}
            </div>
          );
        })()
      ) : canSeeAllUnits && groupedByUnit && filterUnit === 'all' ? (
        /* Direktör: birime göre gruplu görünüm */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {Object.entries(groupedByUnit)
            .sort(([a], [b]) => (a === '—' ? 1 : b === '—' ? -1 : a.localeCompare(b)))
            .map(([unit, items]) => (
              <div key={unit}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 16 }}>🏗</span>
                    {unit === '—' ? 'Birimi Belirtilmemiş' : unit}
                  </div>
                  <span style={{ background: '#6366f118', color: '#6366f1', borderRadius: 20, padding: '2px 10px', fontSize: 11.5, fontWeight: 600 }}>
                    {items.length} gündem
                  </span>
                  <button
                    onClick={() => setFilterUnit(unit === '—' ? 'all' : unit)}
                    style={{ fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                    sadece bunu göster
                  </button>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
                <RenderItems items={items} />
              </div>
            ))}
        </div>
      ) : (
        /* Normal / filtreli görünüm */
        <RenderItems items={filteredAgendas} />
      )}

      {/* Gündem Oluştur/Düzenle Modal */}
      {agendaModal && (
        <AgendaModal
          agenda={editAgenda}
          agendaTypes={agendaTypes}
          myId={myId}
          myName={myName}
          myUnit={myUnit}
          canSeeAllUnits={canSeeAllUnits}
          availableUnits={availableUnits}
          isDirektor={isDirektor}
          isKoordinator={isKoordinator}
          role={role}
          allProfiles={allProfiles}
          onSave={handleSaveAgenda}
          onClose={() => { setAgendaModal(false); setEditAgenda(null); }}
        />
      )}

      {/* Gündem Detay */}
      {detailAgenda && (
        <AgendaDetailView
          agenda={detailAgenda}
          myId={myId}
          myName={myName}
          myUnit={myUnit}
          role={role}
          profiles={allProfiles}
          allProfiles={allProfiles}
          isMineTab={detailIsMine}
          onClose={() => { setDetailAgenda(null); setDetailIsMine(false); }}
          onRefresh={loadAll}
        />
      )}
    </div>
  );
}
