import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getAgendaTypes,
  createAgendaType,
  updateAgendaType,
  deleteAgendaType,
  getAgendasV2,
  getAgendaDetail,
  createAgenda,
  updateAgenda,
  deleteAgenda,
  createAgendaTask,
  updateAgendaTask,
  deleteAgendaTask,
  markAgendaTaskDoneSelf,
  addAgendaComment,
  deleteAgendaComment,
  getAllProfiles,
  notifyTaskAssigned,
  createNotification,
  awardXP,
} from '../lib/supabase';
import { ROLE_LABELS } from '../lib/constants';
import MentionInput, { extractMentions, renderMentionText } from '../components/MentionInput';

// ── Yardımcılar ──────────────────────────────────────────────────────────────
function linkifyText(text) {
  if (!text || typeof text !== 'string') return text;
  const re = /(https?:\/\/[^\s<]+)/g;
  const parts = text.split(re);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    /^https?:\/\//.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline', wordBreak: 'break-all' }}>{part}</a>
      : part
  );
}

// ── SABİTLER ──────────────────────────────────────────────────────────────────
const AGENDA_STATUSES = [
  { value: 'devam',      label: 'Devam Ediyor' },
  { value: 'tamamlandi', label: 'Tamamlandı' },
  { value: 'arsiv',      label: 'Arşiv' },
];

// Rol + sahiplik bazlı izin verilen statü geçişleri
// - Herkes tamamlandı işaretleyebilir
// - Koordinatör tamamlanan bir gündemi devam'a veya arşive alabilir
function getAllowedStatuses(role, agenda, myId /*, allProfiles = [] */) {
  const isOwn      = agenda.created_by === myId;
  const isAssigned = agenda.assigned_to === myId;

  if (role === 'direktor' || role === 'direktor_yardimcisi') {
    return ['devam', 'tamamlandi', 'arsiv'];
  }
  if (role === 'koordinator') {
    // Koordinatör her gündemi yönetebilir (kendi, personelinin, atanan)
    return ['devam', 'tamamlandi', 'arsiv'];
  }
  if (role === 'asistan') {
    return ['devam', 'tamamlandi', 'arsiv'];
  }
  if (role === 'personel') {
    // Personel kendi gündemini / atandığı gündemi tamamlandı işaretleyebilir
    // Tamamlandıktan sonra geri alamaz — koordinatör devreye girer
    if (isOwn || isAssigned) {
      if (agenda.status === 'tamamlandi' || agenda.status === 'arsiv') return [];
      return ['devam', 'tamamlandi'];
    }
    return [];
  }
  return ['devam', 'tamamlandi', 'arsiv'];
}

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

function TaskStatusBadge({ status }) {
  if (status === 'tamamlandi')
    return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, color: 'var(--green)', background: 'var(--green-pale)' }}>✅ Tamamlandı</span>;
  if (status === 'devam_ediyor')
    return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, color: 'var(--primary)', background: 'var(--primary-light)' }}>🔵 Devam Ediyor</span>;
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, color: 'var(--text-light)', background: 'var(--bg-hover)' }}>⚪ Bekliyor</span>;
}

// ── YORUM BALONU ──────────────────────────────────────────────────────────────
function CommentBubble({ comment, myId, onDelete, profiles = [] }) {
  const isMe = comment.created_by === myId;
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
      {!isMe && <Avatar name={comment.created_by_name} url={comment.avatar_url} size={28} />}
      <div style={{ maxWidth: '75%' }}>
        {!isMe && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 3 }}>
            {comment.created_by_name}
          </div>
        )}
        <div style={{
          background: isMe ? 'var(--primary)' : 'var(--bg-hover)',
          color: isMe ? '#ffffff' : 'var(--text)',  // keep #ffffff for contrast in dark primary bg
          border: isMe ? 'none' : '1px solid var(--border)',
          borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          padding: '9px 14px',
          fontSize: 13.5,
          fontWeight: 400,
          lineHeight: 1.55,
          wordBreak: 'break-word',
        }}>
          {renderMentionText(comment.content, profiles).map((part, i) =>
            part.isMention ? (
              <span key={i} style={{ fontWeight: 700, color: isMe ? 'var(--primary-light)' : 'var(--primary)' }}>
                {part.text}
              </span>
            ) : (
              <span key={i}>{linkifyText(part.text)}</span>
            )
          )}
        </div>
        <div style={{
          fontSize: 11, color: 'var(--text-light)', marginTop: 3,
          display: 'flex', gap: 6,
          justifyContent: isMe ? 'flex-end' : 'flex-start',
        }}>
          {new Date(comment.created_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          {isMe && (
            <button onClick={() => onDelete(comment.id)}
              style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 11, padding: 0, fontWeight: 600 }}>
              sil
            </button>
          )}
        </div>
      </div>
      {isMe && <Avatar name={comment.created_by_name} url={comment.avatar_url} size={28} />}
    </div>
  );
}

// ── GÖREV KARTI ───────────────────────────────────────────────────────────────
function TaskCard({ task, myId, myName, role, profiles, onRefresh, agendaCreatedBy, onNotify, agendaId, agendaTitle, isPersonalAgenda = false }) {
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);

  const isAssigned = task.assigned_to === myId;
  const isKoord    = ['direktor', 'direktor_yardimcisi', 'asistan', 'koordinator'].includes(role);
  const canMarkDone = isAssigned && task.status !== 'tamamlandi';
  const canNotifyTask = onNotify && task.assigned_to && task.assigned_to !== myId && isKoord;

  const assigneeProfile = profiles.find(p => p.user_id === task.assigned_to);

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
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <TaskStatusBadge status={task.status} />
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
        {task.created_at && (
          <span style={{ fontSize: 9.5, color: 'var(--text-muted)', opacity: 0.55, marginLeft: 'auto' }}>
            {new Date(task.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {canMarkDone && (
          <button className="btn btn-sm btn-primary" disabled={saving}
            onClick={() => {
              act(async () => {
                await markAgendaTaskDoneSelf(task.id);
                // XP: sadece personel
                if (role === 'personel') {
                  await awardXP(myId, 'task_complete', `Görev tamamlandı: ${task.title}`, task.id);
                  // Zamanında tamamlama bonusu
                  if (task.due_date && new Date() <= new Date(task.due_date)) {
                    await awardXP(myId, 'on_time_bonus', `Zamanında tamamlandı: ${task.title}`, task.id);
                  }
                }
              }, null);
            }}>
            ✅ Tamamlandı İşaretle
          </button>
        )}
        {canNotifyTask && (
          <button
            disabled={notifying}
            onClick={handleNotify}
            title={`${task.assigned_to_name || ''} adresine mail gönder`}
            style={{ background: 'var(--green-pale)', color: 'var(--green)', border: '1px solid var(--green)', fontSize: 12, padding: '4px 10px', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }}>
            {notifying ? '…' : '📧 Mail Gönder'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── GÜNDEM KARTININ DETAY GÖRÜNÜMERİ ─────────────────────────────────────────
function AgendaDetailView({ agenda, myId, myName, myUnit, role, profiles, allProfiles, onClose, onRefresh, onStatusChange, isMineTab = false }) {
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
    // XP: yorum yazma (sadece personel)
    if (role === 'personel') {
      try {
        await awardXP(myId, 'comment', `Yorum yazıldı: ${agenda.title}`, agenda.id);
        // @mention ile işbirliği bonusu
        if (mentionedIds.length > 0) {
          await awardXP(myId, 'collaboration', `İşbirliği: ${mentionedIds.length} kişi etiketlendi`, agenda.id);
        }
      } catch (e) { console.error('[XP] comment error:', e); }
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

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 720, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.4, textTransform: 'uppercase' }}>
                  {type?.name || 'Gündem'}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  padding: '2px 8px', borderRadius: 20,
                }}>
                  {AGENDA_STATUSES.find(s => s.value === agenda.status)?.label || '—'}
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

          {/* Statü aksiyon butonları */}
          {(() => {
            const allowed = getAllowedStatuses(role, agenda, myId).filter(s => s !== agenda.status);
            if (!allowed.length) return null;
            const statusColors = {
              devam: '#3b82f6', tamamlandi: '#10b981', arsiv: '#6b7280',
            };
            const statusLabels = {
              devam: 'Devam Ediyor\'a Al', tamamlandi: 'Tamamlandı', arsiv: 'Arşive Al',
            };
            return (
              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                {allowed.map(s => {
                  const color = statusColors[s] || '#6366f1';
                  return (
                    <button key={s} onClick={async () => {
                      await updateAgenda(agenda.id, { status: s });
                      onStatusChange?.(agenda.id, s);
                      onRefresh?.();
                    }} style={{
                      padding: '5px 14px', borderRadius: 20, border: `1.5px solid ${color}`,
                      background: color + '15', color: color, fontWeight: 700, fontSize: 12,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      {statusLabels[s] || s}
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Body scroll */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>

          {/* Görevler */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
                            <button className="btn btn-sm btn-outline" style={{ color: 'var(--red)' }} onClick={() => handleDeleteTask(task.id)}>🗑 Sil</button>
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
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
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
        <div className="form-group">
          <label className="form-label">Bitiş Tarihi</label>
          <input className="form-input" type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
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
            <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>Atanabilecek kullanıcı bulunamadı.</div>
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
    status: agenda?.status || 'devam',
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
    // Direktör birim seçmediyse, atanan kişinin birimini otomatik doldur
    if (p?.unit && !form.unit) {
      set('unit', p.unit);
    }
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
            {agendaTypes.map(t => {
              const active = form.type_id === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => set('type_id', t.id)}
                  style={{
                    padding: '6px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                    border: `1.5px solid ${active ? 'var(--navy)' : 'var(--border)'}`,
                    background: active ? 'var(--navy)' : 'var(--bg)',
                    color: active ? '#fff' : 'var(--text)',
                    fontWeight: active ? 700 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  {t.name}
                </button>
              );
            })}
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
              {AGENDA_STATUSES.filter(s => {
                // Personel oluştururken arşive direkt gönderemez
                if (role === 'personel') return s.value !== 'arsiv';
                return true;
              }).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
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
              <div style={{ fontSize: 12, color: 'var(--primary)', marginTop: 4 }}>
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

// ── GÜNDEM ÇERÇEVESİ (ana kart — kompakt, beyaz, 4 sütuna sığar) ─────────────
function AgendaFrame({ agenda, myId, role, profiles, onEdit, onDelete, onOpen, onNotify, onAddTask, onEditTask }) {
  const type = agenda.agenda_types;
  const tasks = agenda.agenda_tasks || [];
  const doneTasks = tasks.filter(t => t.status === 'tamamlandi');
  const pctDone = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0;

  const statusMeta = AGENDA_STATUSES.find(s => s.value === agenda.status) || AGENDA_STATUSES[0];
  const canEdit = CREATOR_ROLES.includes(role) && (agenda.created_by === myId || ['direktor', 'direktor_yardimcisi'].includes(role));
  const canAddTask = canEdit;

  const iconBtn = {
    width: 22, height: 22, borderRadius: 5, border: '1px solid var(--border)',
    background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
    fontSize: 10.5, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0,
  };

  // Görev alt listesi — maksimum 4 göster, kalanını özet
  const visibleTasks = tasks.slice(0, 4);
  const hiddenCount = Math.max(0, tasks.length - visibleTasks.length);

  return (
    <div style={{
      borderRadius: 10, overflow: 'hidden',
      border: '1px solid var(--border)', background: '#fff',
      display: 'flex', flexDirection: 'column',
      transition: 'box-shadow 0.15s, transform 0.15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(15,23,42,0.06)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Başlık bloğu — nötr beyaz */}
      <div onClick={() => onOpen(agenda)} style={{
        padding: '10px 12px 8px', cursor: 'pointer',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
            {type?.name || 'Gündem'}
          </span>
          <span style={{
            marginLeft: 'auto', fontSize: 9.5, fontWeight: 600, color: 'var(--text-muted)',
            background: 'var(--bg)', border: '1px solid var(--border)',
            padding: '1px 6px', borderRadius: 10,
          }}>
            {statusMeta.label}
          </span>
        </div>
        <div style={{
          fontSize: 13.5, fontWeight: 700, lineHeight: 1.3, color: 'var(--text)',
          marginBottom: 4, wordBreak: 'break-word',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {agenda.title}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {agenda.date && (
            <span>📅 {new Date(agenda.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
          )}
          {agenda.assigned_to_name && <span>👤 {agenda.assigned_to_name.split(' ')[0]}</span>}
        </div>
      </div>

      {/* İlerleme + aksiyon şeridi */}
      <div style={{
        padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '1px solid var(--border)', background: 'var(--bg)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>
          {doneTasks.length}/{tasks.length}
        </div>
        <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--navy)', borderRadius: 999, width: `${pctDone}%`, transition: 'width 0.4s' }} />
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>%{pctDone}</div>
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          {onNotify && agenda.assigned_to && agenda.assigned_to !== myId && (
            <button onClick={() => onNotify(agenda)} title="Mail gönder" style={iconBtn}>📧</button>
          )}
          {canEdit && <button onClick={() => onEdit(agenda)} title="Düzenle" style={iconBtn}>✏️</button>}
          {canEdit && <button onClick={() => onDelete(agenda.id)} title="Sil" style={iconBtn}>🗑</button>}
        </div>
      </div>

      {/* Body — görev mini kartları */}
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.4, textTransform: 'uppercase' }}>
            Görevler
          </div>
          {canAddTask && onAddTask && (
            <button onClick={() => onAddTask(agenda)} title="Görev ekle" style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
              border: '1px solid var(--border)', background: '#fff',
              cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'inherit',
              lineHeight: 1.3,
            }}>+</button>
          )}
        </div>

        {tasks.length === 0 ? (
          <button
            onClick={() => canAddTask && onAddTask && onAddTask(agenda)}
            style={{
              width: '100%', padding: 10, borderRadius: 8,
              border: '1px dashed var(--border)', background: 'transparent',
              cursor: canAddTask ? 'pointer' : 'default',
              color: 'var(--text-muted)', fontSize: 11, fontFamily: 'inherit',
            }}>
            {canAddTask ? '+ ilk görevi ekle' : 'Görev yok'}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {visibleTasks.map(task => (
              <TaskMiniCard
                key={task.id}
                task={task}
                profiles={profiles}
                onClick={() => onEditTask && onEditTask(agenda, task)}
              />
            ))}
            {hiddenCount > 0 && (
              <button onClick={() => onOpen(agenda)} style={{
                fontSize: 10.5, fontWeight: 600, padding: '4px 8px', borderRadius: 6,
                border: '1px dashed var(--border)', background: 'transparent',
                cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'inherit', textAlign: 'center',
              }}>
                +{hiddenCount} görev daha →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── GÖREV MİNİ KARTI (beyaz, tek satır) ───────────────────────────────────────
function TaskMiniCard({ task, profiles = [], onClick }) {
  const assignee = profiles.find(p => p.user_id === task.assigned_to);
  const isDone = task.status === 'tamamlandi';
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  if (dueDate) dueDate.setHours(0, 0, 0, 0);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const overdue = !isDone && dueDate && dueDate < now;

  return (
    <div
      onClick={onClick}
      style={{
        padding: '6px 8px', borderRadius: 6,
        border: '1px solid var(--border)', background: '#fff',
        cursor: 'pointer', transition: 'background 0.1s',
        display: 'flex', alignItems: 'center', gap: 6,
        opacity: isDone ? 0.6 : 1,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
    >
      <span style={{
        fontSize: 11.5, fontWeight: 500, color: 'var(--text)', lineHeight: 1.3,
        textDecoration: isDone ? 'line-through' : 'none',
        flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{task.title}</span>
      {isDone && <span title="Tamamlandı" style={{ fontSize: 10 }}>✅</span>}
      {task.assigned_to_name && (
        <Avatar name={task.assigned_to_name} url={assignee?.avatar_url} size={16} />
      )}
      {task.due_date && (
        <span style={{
          fontSize: 9.5, color: overdue ? 'var(--red)' : 'var(--text-muted)',
          fontWeight: overdue ? 700 : 500, flexShrink: 0,
        }}>
          {overdue ? '🔴' : ''}
          {new Date(task.due_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
        </span>
      )}
    </div>
  );
}

// ── GÜNDEM TÜRÜ YÖNETİMİ ──────────────────────────────────────────────────────
const TYPE_COLOR_OPTIONS = [
  '#6366f1', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#84cc16',
];

const TYPE_ICON_OPTIONS = ['📋', '🎉', '👥', '🚀', '📚', '🤝', '🌍', '🏗️', '🎓', '💡', '📊', '🔬'];

function AgendaTypeManagement({ notify }) {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', icon: '📋', color: '#6366f1', fields: [] });
  const [saving, setSaving] = useState(false);
  const [newField, setNewField] = useState({ key: '', label: '', type: 'text', required: false, placeholder: '' });

  const load = async () => {
    setLoading(true);
    const { data } = await getAgendaTypes();
    setTypes(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ name: '', icon: '📋', color: '#6366f1', fields: [] });
    setModal(true);
  };

  const openEdit = (t) => {
    setEditItem(t);
    setForm({ name: t.name, icon: t.icon, color: t.color, fields: t.fields || [] });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editItem) {
      await updateAgendaType(editItem.id, { name: form.name.trim(), icon: form.icon, color: form.color, fields: form.fields });
      notify('Tür güncellendi ✓');
    } else {
      await createAgendaType({ name: form.name.trim(), icon: form.icon, color: form.color, fields: form.fields, sort_order: types.length });
      notify('Tür oluşturuldu ✓');
    }
    setSaving(false);
    setModal(false);
    load();
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`"${name}" türü silinsin mi? Bu türe bağlı gündemler etkilenmez.`)) return;
    await deleteAgendaType(id);
    notify('Tür silindi');
    load();
  };

  const addField = () => {
    if (!newField.key.trim() || !newField.label.trim()) return;
    setForm(prev => ({ ...prev, fields: [...prev.fields, { ...newField, key: newField.key.trim(), label: newField.label.trim() }] }));
    setNewField({ key: '', label: '', type: 'text', required: false, placeholder: '' });
  };

  const removeField = (idx) => {
    setForm(prev => ({ ...prev, fields: prev.fields.filter((_, i) => i !== idx) }));
  };

  return (
    <div className="card" style={{ marginTop: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="card-title" style={{ margin: 0 }}>📋 Gündem Türleri</div>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Yeni Tür</button>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center' }}><div className="loading-spinner" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {types.map(t => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)',
            }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: t.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {t.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {(t.fields || []).length > 0 ? `${t.fields.length} özel alan` : 'Özel alan yok'}
                  {' · '}
                  <span style={{ color: t.color }}>●</span> {t.color}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm btn-outline" onClick={() => openEdit(t)}>✏️ Düzenle</button>
                <button className="btn btn-sm btn-outline" style={{ color: 'var(--red)' }} onClick={() => handleDelete(t.id, t.name)}>🗑 Sil</button>
              </div>
            </div>
          ))}
          {types.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13.5 }}>
              Henüz gündem türü yok. + Yeni Tür ile ekleyin.
            </div>
          )}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <h2 className="modal-title">{editItem ? '✏️ Tür Düzenle' : '+ Yeni Gündem Türü'}</h2>

            <div className="form-group">
              <label className="form-label">Tür Adı *</label>
              <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Etkinlik, Proje, Misafir…" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">İkon</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {TYPE_ICON_OPTIONS.map(ic => (
                    <button key={ic} onClick={() => setForm(p => ({ ...p, icon: ic }))}
                      style={{ fontSize: 20, padding: '4px 8px', borderRadius: 8, cursor: 'pointer', border: `2px solid ${form.icon === ic ? 'var(--accent)' : 'var(--border)'}`, background: form.icon === ic ? 'var(--accent)22' : 'var(--bg)' }}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Renk</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {TYPE_COLOR_OPTIONS.map(c => (
                    <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                      style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: `3px solid ${form.color === c ? '#000' : 'transparent'}`, cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
            </div>

            {/* Özel Alanlar */}
            <div className="form-group">
              <label className="form-label" style={{ marginBottom: 8 }}>Özel Form Alanları</label>
              {form.fields.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                  {form.fields.map((f, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}>
                      <span style={{ flex: 1 }}><strong>{f.label}</strong> <span style={{ color: 'var(--text-muted)' }}>({f.type})</span> {f.required ? '· zorunlu' : ''}</span>
                      <button onClick={() => removeField(idx)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 120px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Alan Anahtarı</div>
                  <input className="form-input" style={{ fontSize: 12 }} placeholder="orn: lokasyon" value={newField.key} onChange={e => setNewField(p => ({ ...p, key: e.target.value }))} />
                </div>
                <div style={{ flex: '1 1 120px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Etiket</div>
                  <input className="form-input" style={{ fontSize: 12 }} placeholder="orn: Lokasyon" value={newField.label} onChange={e => setNewField(p => ({ ...p, label: e.target.value }))} />
                </div>
                <div style={{ flex: '0 1 100px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Tür</div>
                  <select className="form-select" style={{ fontSize: 12 }} value={newField.type} onChange={e => setNewField(p => ({ ...p, type: e.target.value }))}>
                    <option value="text">Metin</option>
                    <option value="textarea">Uzun Metin</option>
                    <option value="number">Sayı</option>
                    <option value="date">Tarih</option>
                    <option value="select">Seçim</option>
                  </select>
                </div>
                <div style={{ flex: '0 0 auto' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Zorunlu</div>
                  <input type="checkbox" checked={newField.required} onChange={e => setNewField(p => ({ ...p, required: e.target.checked }))} style={{ width: 18, height: 18, marginTop: 4 }} />
                </div>
                <button className="btn btn-sm btn-outline" style={{ flex: '0 0 auto', alignSelf: 'flex-end' }} onClick={addField}>+ Ekle</button>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(false)}>İptal</button>
              <button className="btn btn-primary" disabled={saving || !form.name.trim()} onClick={handleSave}>
                {saving ? '…' : (editItem ? 'Güncelle' : 'Oluştur')}
              </button>
            </div>
          </div>
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
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [inlineTask, setInlineTask] = useState(null); // { agenda, task } | null
  const [notification, setNotification] = useState(null);

  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

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
  const isArsivTab           = personalTab === 'arsiv';
  const isSettingsTab        = (isDirektor || isKoordinator) && personalTab === 'settings';

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
      // ── Arşiv sekmesi: sadece arsiv statülü gündemler ──
      if (isArsivTab) {
        if (a.status !== 'arsiv') return false;
        if (a.is_personal && a.created_by !== myId) return false;
        if (!canSeeAllUnits && a.unit && a.unit !== myUnit && a.created_by !== myId) return false;
        if (searchQ) {
          const q = searchQ.toLowerCase();
          if (!a.title?.toLowerCase().includes(q) && !a.description?.toLowerCase().includes(q)) return false;
        }
        return true;
      }
      // ── Diğer sekmeler: arşivlenmiş gündemleri gizle ──
      if (a.status === 'arsiv') return false;

      if (isAssignedByMeTab) {
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
  }, [agendas, filterType, filterStatus, filterUnit, searchQ, canSeeAllUnits, isMineTab, isAssignedToMeTab, isAssignedByMeTab, isAssignedTasksTab, isMyTasksTab, isArsivTab, myId, myUnit, isKoordinator, isDirektor, allProfiles]);

  // Departman tabında gündemleri birime göre grupla
  const groupedByUnit = useMemo(() => {
    if (!canSeeAllUnits || isMineTab || isAssignedToMeTab || isAssignedByMeTab || isArsivTab || filterUnit !== 'all') return null;
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
      const { error } = await updateAgenda(editAgenda.id, data);
      if (error) { alert('Gündem güncellenemedi: ' + error.message); return; }
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
        unit: isMineTab ? null : (data.unit || myUnit || (data.assigned_to ? (allProfiles.find(p => p.user_id === data.assigned_to)?.unit || null) : null)),
        is_personal: isMineTab,
      });
      if (result?.error) { alert('Gündem oluşturulamadı: ' + result.error.message); return; }
      // Yeni gündem atama bildirimi + mail
      if (data.assigned_to && data.assigned_to !== myId && result?.data?.[0]?.id) {
        try { await createNotification({ userId: data.assigned_to, type: 'agenda_assigned', title: `"${data.title}" gündemi size atandı`, body: '', linkType: 'agenda', linkId: result.data[0].id, createdBy: myId, createdByName: myName || '' }); } catch (e) { console.error('Notification error:', e); }
        // Otomatik mail
        try {
          await notifyTaskAssigned({ assignedToUserId: data.assigned_to, taskTitle: data.title, taskDescription: data.description || '', taskPriority: null, taskDueDate: data.date || null, taskUnit: isMineTab ? '' : (myUnit || data.unit || ''), createdByName: myName, isAgenda: true, tasks: [] });
        } catch (e) { console.error('Agenda mail error:', e); }
      }
    }
    // XP: gündem oluşturma (sadece personel, yeni gündem)
    if (!editAgenda && isPersonel) {
      try { await awardXP(myId, 'agenda_create', `Gündem oluşturuldu: ${data.title}`); } catch (e) { console.error('[XP] agenda_create error:', e); }
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

  // GRID — 4 sütuna sığan kompakt kartlar
  const CardGrid = ({ items }) => (
    <div style={{
      display: 'grid', gap: 12,
      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
      alignItems: 'stretch',
    }}>
      {items.map(agenda => (
        <AgendaFrame
          key={agenda.id}
          {...cardProps(agenda)}
          onAddTask={(a) => setInlineTask({ agenda: a, task: null })}
          onEditTask={(a, t) => setInlineTask({ agenda: a, task: t })}
        />
      ))}
    </div>
  );

  // LIST (kompakt liste)
  const ListView = ({ items }) => (
    <div className="card" style={{ padding:0, overflow:'hidden' }}>
      {items.map((agenda, i) => {
        const type = agenda.agenda_types;
        const tasks = agenda.agenda_tasks || [];
        const doneTasks = tasks.filter(t => t.status === 'tamamlandi');
        const statusMeta = AGENDA_STATUSES.find(s => s.value === agenda.status) || AGENDA_STATUSES[0];
        const canEdit = CREATOR_ROLES.includes(role) && (agenda.created_by === myId || ['direktor','direktor_yardimcisi'].includes(role));
        return (
          <div key={agenda.id} onClick={() => { setDetailAgenda(agenda); setDetailIsMine(isMineTab); }}
            style={{
              display:'flex', alignItems:'center', gap:14, padding:'12px 20px', cursor:'pointer',
              borderBottom: i<items.length-1 ? '1px solid var(--border)' : 'none',
              transition:'background 0.1s',
            }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--bg)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}
          >
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                <span style={{ fontWeight:700, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{agenda.title}</span>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ fontSize:10.5, fontWeight:700, color:'var(--text-muted)', letterSpacing:0.4, textTransform:'uppercase' }}>{type?.name||'Gündem'}</span>
                <span style={{ fontSize:10.5, color:'var(--text-muted)' }}>· {statusMeta.label}</span>
                {agenda.date && <span style={{ fontSize:10.5, color:'var(--text-muted)' }}>· {new Date(agenda.date).toLocaleDateString('tr-TR',{day:'numeric',month:'short'})}</span>}
                {agenda.assigned_to_name && <span style={{ fontSize:10.5, color:'var(--text-muted)' }}>· {agenda.assigned_to_name}</span>}
              </div>
            </div>
            {/* Görev sayacı */}
            <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
              <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600 }}>{doneTasks.length}/{tasks.length}</span>
              {tasks.length > 0 && (
                <div style={{ width:48, height:4, background:'var(--border)', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${(doneTasks.length/tasks.length)*100}%`, background:'var(--navy)', borderRadius:4 }} />
                </div>
              )}
            </div>
            {/* Aksiyon butonları */}
            <div style={{ display:'flex', gap:4, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
              {canEdit && (
                <>
                  <button className="btn btn-sm btn-outline" onClick={()=>handleEdit(agenda)} title="Düzenle" style={{ padding:'3px 8px' }}>✏️</button>
                  <button className="btn btn-sm btn-outline" onClick={()=>handleDeleteAgenda(agenda.id)} title="Sil" style={{ padding:'3px 8px', color:'var(--red)' }}>🗑</button>
                </>
              )}
            </div>
            <span style={{ color:'var(--gray-mid)', fontSize:16, flexShrink:0 }}>›</span>
          </div>
        );
      })}
    </div>
  );

  // Genel render yardımcısı — seçilen viewMode'a göre
  const RenderItems = ({ items }) => {
    if (viewMode === 'list') return <ListView items={items} />;
    return <CardGrid items={items} />;
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Başlık */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasPersonalTab ? 0 : 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>📋 Gündemler</h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            {isSettingsTab
              ? 'Gündem türlerini ve özel alanları yönetin'
              : isAssignedByMeTab
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
        {canCreate && !isSettingsTab && !isAssignedToMeTab && !isAssignedByMeTab && !isAssignedTasksTab && !isMyTasksTab && !isArsivTab && (
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
              { id: 'arsiv',           icon: '📦', label: 'Arşiv' },
            ] : [
              // Diğer roller için mevcut sekmeler
              { id: 'unit',           icon: unitTabIcon, label: unitTabLabel },
              ...((isKoordinator || isAsistan) ? [{ id: 'assigned_to_me',  icon: '📥', label: 'Bana Atanan' }] : []),
              ...((isDirektor || isKoordinator) ? [{ id: 'assigned_by_me',  icon: '📤', label: 'Atadığım Gündemler' }] : []),
              { id: 'mine',           icon: '📋',        label: 'Gündemlerim' },
              { id: 'arsiv',          icon: '📦',        label: 'Arşiv' },
              ...((isDirektor || isKoordinator) ? [{ id: 'settings', icon: '⚙️', label: 'Tür Ayarları' }] : []),
            ]),
          ].map(tab => {
            const isActive = personalTab === tab.id;
            // Badge sayıları
            let assignedCount = 0;
            if (tab.id === 'assigned_to_me') {
              assignedCount = agendas.filter(a => a.status !== 'arsiv' && a.assigned_to === myId && a.created_by !== myId && !a.is_personal).length;
            } else if (tab.id === 'assigned_by_me') {
              assignedCount = agendas.filter(a => a.status !== 'arsiv' && a.assigned_to && a.assigned_to !== myId && a.created_by === myId && !a.is_personal).length;
            } else if (tab.id === 'assigned_tasks') {
              assignedCount = agendas.filter(a => a.status !== 'arsiv').reduce((sum, a) => sum + (a.agenda_tasks || []).filter(t => t.assigned_to === myId && t.created_by !== myId).length, 0);
            } else if (tab.id === 'my_tasks') {
              assignedCount = agendas.filter(a => a.status !== 'arsiv').reduce((sum, a) => sum + (a.agenda_tasks || []).filter(t => t.assigned_to === myId && t.created_by === myId).length, 0);
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
                  <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: 20, fontSize: 11, fontWeight: 700, padding: '1px 7px', marginLeft: 2 }}>
                    {assignedCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Notification toast */}
      {notification && (
        <div style={{
          position:'fixed', top:20, right:20, zIndex:9999,
          padding:'12px 20px', borderRadius:10, fontWeight:500, fontSize:13.5,
          background: notification.type === 'error' ? 'var(--red)' : 'var(--navy)',
          color:'white', boxShadow:'0 8px 24px rgba(0,0,0,0.25)',
          animation:'slideIn 0.2s ease',
        }}>
          {notification.msg}
        </div>
      )}

      {/* Gündem Türleri Ayarları */}
      {isSettingsTab && (
        <AgendaTypeManagement notify={notify} />
      )}

      {/* Birim sekmeleri — departman tabında direktör */}
      {!isSettingsTab && canSeeAllUnits && !isMineTab && !isAssignedToMeTab && !isAssignedByMeTab && availableUnits.length > 1 && (
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
                  border: `2px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
                  background: isActive ? 'var(--primary)' : 'var(--bg-card)',
                  color: isActive ? '#fff' : 'var(--text)', fontWeight: isActive ? 700 : 400,
                }}>
                🏗 {u} ({cnt})
              </button>
            );
          })}
        </div>
      )}

      {!isSettingsTab && <>
      {/* Tür + durum + arama filtreleri + görünüm seçici */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-input" style={{ width: 200, fontSize: 13 }} placeholder="🔍 Ara…"
          value={searchQ} onChange={e => setSearchQ(e.target.value)} />

        <select className="form-select" style={{ width: 155, fontSize: 13 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">Tüm Türler</option>
          {agendaTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        <select className="form-select" style={{ width: 155, fontSize: 13 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">Tüm Durumlar</option>
          {AGENDA_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        {/* Görünüm seçici */}
        <div style={{ marginLeft:'auto', display:'flex', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:2, gap:2 }}>
          {[
            { id:'grid', icon:'▦', tip:'Kartlar' },
            { id:'list', icon:'☰', tip:'Liste' },
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
            return (
              <div key={agenda.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Gündem başlığı */}
                <div onClick={() => { setDetailAgenda(agenda); setDetailIsMine(isMyTasksTab); }}
                  style={{
                    padding: '12px 20px', background: 'var(--bg)', borderBottom: '1px solid var(--border)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{agenda.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {type?.name || 'Gündem'}
                    </div>
                  </div>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>{tasks.length} görev</span>
                </div>
                {/* Görevler */}
                {tasks.map((task, i) => {
                  return (
                    <div key={task.id} style={{
                      padding: '10px 20px 10px 36px', display: 'flex', alignItems: 'center', gap: 10,
                      borderBottom: i < tasks.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <TaskStatusBadge status={task.status} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                          {task.due_date && <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>📅 {new Date(task.due_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>}
                        </div>
                      </div>
                      {/* Tamamla butonu — sadece devam eden görevler */}
                      {task.status !== 'tamamlandi' && (
                        <button className="btn btn-sm btn-primary" style={{ fontSize: 11, padding: '4px 10px' }}
                          onClick={async (e) => {
                            e.stopPropagation();
                            await markAgendaTaskDoneSelf(task.id);
                            // XP: sadece personel
                            if (isPersonel) {
                              try {
                                await awardXP(myId, 'task_complete', `Görev tamamlandı: ${task.title}`, task.id);
                                if (task.due_date && new Date() <= new Date(task.due_date)) {
                                  await awardXP(myId, 'on_time_bonus', `Zamanında tamamlandı: ${task.title}`, task.id);
                                }
                              } catch (e) { console.error('[XP] task error:', e); }
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
                    <span style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', borderRadius: 20, padding: '2px 10px', fontSize: 11.5, fontWeight: 600 }}>
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
                  <span style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', borderRadius: 20, padding: '2px 10px', fontSize: 11.5, fontWeight: 600 }}>
                    {items.length} gündem
                  </span>
                  <button
                    onClick={() => setFilterUnit(unit === '—' ? 'all' : unit)}
                    style={{ fontSize: 11, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
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
          onStatusChange={(agendaId, newStatus) => {
            setDetailAgenda(prev => prev ? { ...prev, status: newStatus } : null);
            setAgendas(prev => prev.map(a => a.id === agendaId ? { ...a, status: newStatus } : a));
          }}
        />
      )}

      {/* Inline Görev Modal (AgendaFrame üzerinden + Görev / görev kartı düzenle) */}
      {inlineTask && (
        <TaskModal
          task={inlineTask.task}
          agendaId={inlineTask.agenda.id}
          myId={myId}
          myName={profile?.full_name || ''}
          myUnit={myUnit}
          role={role}
          allProfiles={allProfiles}
          allowSelfAssign={personalTab === 'mine'}
          onSave={async (data) => {
            const ag = inlineTask.agenda;
            const myFullName = profile?.full_name || myName;
            try {
              if (inlineTask.task) {
                await updateAgendaTask(inlineTask.task.id, data);
                if (data.assigned_to && data.assigned_to !== myId && data.assigned_to !== inlineTask.task.assigned_to) {
                  try { await createNotification({ userId: data.assigned_to, type: 'task_assigned', title: `"${data.title}" görevi size atandı`, body: `${ag.title} gündeminde`, linkType: 'agenda', linkId: ag.id, createdBy: myId, createdByName: myFullName }); } catch (e) { console.error('Task assign notif error:', e); }
                  try { await notifyTaskAssigned({ assignedToUserId: data.assigned_to, taskTitle: data.title, taskDescription: `Bağlı Gündem: ${ag.title}${data.description ? '\n\n' + data.description : ''}`, taskPriority: data.priority, taskDueDate: data.due_date, taskUnit: ag.unit || '', createdByName: myFullName }); } catch (e) { console.error('Task mail error:', e); }
                }
              } else {
                await createAgendaTask({ ...data, agenda_id: ag.id, created_by: myId, created_by_name: myFullName });
                if (data.assigned_to && data.assigned_to !== myId) {
                  try { await createNotification({ userId: data.assigned_to, type: 'task_assigned', title: `"${data.title}" görevi size atandı`, body: `${ag.title} gündeminde`, linkType: 'agenda', linkId: ag.id, createdBy: myId, createdByName: myFullName }); } catch (e) { console.error('Task assign notif error:', e); }
                  try { await notifyTaskAssigned({ assignedToUserId: data.assigned_to, taskTitle: data.title, taskDescription: `Bağlı Gündem: ${ag.title}${data.description ? '\n\n' + data.description : ''}`, taskPriority: data.priority, taskDueDate: data.due_date, taskUnit: ag.unit || '', createdByName: myFullName }); } catch (e) { console.error('Task mail error:', e); }
                }
              }
              setInlineTask(null);
              await loadAll();
              notify(inlineTask.task ? 'Görev güncellendi' : 'Görev oluşturuldu');
            } catch (e) {
              console.error('Task save error:', e);
              notify('Görev kaydedilemedi', 'error');
            }
          }}
          onClose={() => setInlineTask(null)}
        />
      )}
      </>}
    </div>
  );
}
