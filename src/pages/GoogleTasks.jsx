import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  startGoogleTasksOAuth,
  disconnectGoogleTasks,
  getGoogleTasksStatus,
  listTasklists,
  listTasks,
  createTask,
  updateTask,
  completeTask,
  uncompleteTask,
  deleteTask,
  createTasklist,
  clearCompleted,
} from '../lib/googleTasks';

// ── Stil yardımcıları ────────────────────────────────────────────────
const card = {
  background: 'var(--card-bg, #fff)',
  border: '1px solid var(--border, #e5e7eb)',
  borderRadius: 12,
  padding: 14,
  minHeight: 96,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
};

const btn = {
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid var(--border, #d4d4d8)',
  background: 'var(--card-bg, #fff)',
  color: 'var(--text, #111)',
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const btnPrimary = {
  ...btn,
  background: 'var(--navy, #1a3a5c)',
  color: '#fff',
  border: 'none',
  fontWeight: 600,
};

const formatDue = (iso) => {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  } catch { return null; }
};

const isOverdue = (iso, status) => {
  if (!iso || status === 'completed') return false;
  try {
    const d = new Date(iso);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() < today.getTime();
  } catch { return false; }
};

// ── Bağlantı kur ekranı ──────────────────────────────────────────────
function ConnectScreen({ onConnect }) {
  return (
    <div style={{ maxWidth: 560, margin: '56px auto', padding: 32, textAlign: 'center',
      background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #e5e7eb)', borderRadius: 16 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Google Tasks'a Bağlan</div>
      <div style={{ color: 'var(--muted, #6b7280)', fontSize: 14, marginBottom: 22, lineHeight: 1.55 }}>
        Kendi Google hesabındaki Tasks listelerini IRDP içinden yönet. Notlar sunucuda saklanmaz —
        sadece senin Google hesabın ile konuşur. <br/>
        <span style={{ fontSize: 12, color: 'var(--muted, #9ca3af)' }}>
          Chrome açılınca doğru hesabı seçmek için @irdp.app hesabıyla giriş yapın.
        </span>
      </div>
      <button onClick={onConnect} style={{ ...btnPrimary, padding: '12px 22px', fontSize: 14 }}>
        🔗 Google Tasks'a Bağlan
      </button>
    </div>
  );
}

// ── Tek task kartı ──────────────────────────────────────────────────
function TaskCard({ task, onToggle, onEdit, onDelete }) {
  const [hover, setHover] = useState(false);
  const completed = task.status === 'completed';
  const overdue = isOverdue(task.due, task.status);
  const border = overdue ? '#ef4444' : completed ? '#10b981' : '#3b82f6';

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...card,
        borderLeft: `4px solid ${border}`,
        opacity: completed ? 0.65 : 1,
        transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover ? '0 6px 20px rgba(0,0,0,0.08)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <input
          type="checkbox"
          checked={completed}
          onChange={() => onToggle(task)}
          style={{ width: 18, height: 18, marginTop: 2, cursor: 'pointer', flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            onClick={() => onEdit(task)}
            style={{
              fontSize: 14, fontWeight: 600,
              color: 'var(--text, #111)',
              textDecoration: completed ? 'line-through' : 'none',
              cursor: 'pointer',
              wordBreak: 'break-word',
              lineHeight: 1.35,
            }}
          >
            {task.title || '(başlıksız)'}
          </div>
          {task.notes && (
            <div style={{
              fontSize: 12, color: 'var(--muted, #6b7280)',
              marginTop: 4,
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
              overflow: 'hidden', whiteSpace: 'pre-wrap',
            }}>
              {task.notes}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11.5, color: overdue ? '#ef4444' : 'var(--muted, #6b7280)', fontWeight: overdue ? 600 : 400 }}>
          {task.due ? `📅 ${formatDue(task.due)}${overdue ? ' · Gecikmiş' : ''}` : ''}
        </div>
        {(hover) && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onEdit(task)} style={{ ...btn, padding: '4px 8px', fontSize: 11 }}>✏️</button>
            <button onClick={() => onDelete(task)} style={{ ...btn, padding: '4px 8px', fontSize: 11, color: '#ef4444' }}>🗑</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Liste satır görünümü ────────────────────────────────────────────
function TaskRow({ task, onToggle, onEdit, onDelete }) {
  const completed = task.status === 'completed';
  const overdue = isOverdue(task.due, task.status);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
      borderBottom: '1px solid var(--border, #e5e7eb)', background: 'var(--card-bg, #fff)',
      opacity: completed ? 0.6 : 1,
    }}>
      <input type="checkbox" checked={completed} onChange={() => onToggle(task)} style={{ width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, cursor: 'pointer' }} onClick={() => onEdit(task)}>
        <div style={{ fontSize: 14, fontWeight: 500, textDecoration: completed ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {task.title || '(başlıksız)'}
        </div>
        {task.notes && (
          <div style={{ fontSize: 12, color: 'var(--muted, #6b7280)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.notes}</div>
        )}
      </div>
      {task.due && (
        <span style={{ fontSize: 11.5, color: overdue ? '#ef4444' : 'var(--muted, #6b7280)', fontWeight: overdue ? 600 : 400, whiteSpace: 'nowrap' }}>
          📅 {formatDue(task.due)}{overdue ? ' · Gecikmiş' : ''}
        </span>
      )}
      <button onClick={() => onDelete(task)} style={{ ...btn, padding: '4px 8px', fontSize: 11, color: '#ef4444' }}>🗑</button>
    </div>
  );
}

// ── Task düzenleme modal'ı ──────────────────────────────────────────
function TaskModal({ task, onSave, onCancel }) {
  const [title, setTitle] = useState(task?.title || '');
  const [notes, setNotes] = useState(task?.notes || '');
  const [due, setDue]     = useState(task?.due ? task.due.slice(0, 10) : '');

  const handleSave = () => {
    if (!title.trim()) return;
    const payload = { title: title.trim(), notes: notes.trim() || null };
    // Google Tasks due ISO 8601; RFC 3339 kabul eder. Date-only + T00:00:00 UTC
    payload.due = due ? new Date(due + 'T00:00:00.000Z').toISOString() : null;
    onSave(payload);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--card-bg, #fff)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>
          {task?.id ? 'Task Düzenle' : 'Yeni Task'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            autoFocus value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Başlık"
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border, #d4d4d8)', fontSize: 14, fontFamily: 'inherit' }}
          />
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Notlar (opsiyonel)"
            rows={4}
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border, #d4d4d8)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
          />
          <label style={{ fontSize: 12, color: 'var(--muted, #6b7280)' }}>Son Tarih</label>
          <input
            type="date" value={due} onChange={e => setDue(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border, #d4d4d8)', fontSize: 13, fontFamily: 'inherit' }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={onCancel} style={btn}>Vazgeç</button>
          <button onClick={handleSave} style={btnPrimary}>Kaydet</button>
        </div>
      </div>
    </div>
  );
}

// ── Ana sayfa ───────────────────────────────────────────────────────
export default function GoogleTasks({ profile }) {
  const [status, setStatus]       = useState(null); // null=loading, {connected, google_email}
  const [tasklists, setTasklists] = useState([]);
  const [activeList, setActiveList] = useState(null);
  const [tasks, setTasks]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const [viewMode, setViewMode]   = useState('card'); // 'card' | 'list'
  const [editTarget, setEditTarget] = useState(null); // {id?}
  const [modalOpen, setModalOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [error, setError]         = useState(null);
  const [newListName, setNewListName] = useState('');

  const loadStatus = useCallback(async () => {
    try {
      const s = await getGoogleTasksStatus();
      setStatus(s);
      return s;
    } catch (e) {
      console.error(e);
      setStatus({ connected: false });
      return { connected: false };
    }
  }, []);

  const loadTasklists = useCallback(async () => {
    try {
      const lists = await listTasklists();
      setTasklists(lists);
      if (lists.length && !activeList) setActiveList(lists[0].id);
      else if (lists.length && activeList && !lists.find(l => l.id === activeList)) {
        setActiveList(lists[0].id);
      }
      return lists;
    } catch (e) {
      if (e.status === 409) setStatus({ connected: false });
      else setError(e.message);
      return [];
    }
  }, [activeList]);

  const loadTasks = useCallback(async (listId) => {
    if (!listId) return;
    setLoading(true);
    setError(null);
    try {
      const items = await listTasks(listId, { show_completed: true });
      // Google düzeninde `position` ile sıralı — aktifler üstte, tamamlananlar altta
      const sorted = [...items].sort((a, b) => {
        const ca = a.status === 'completed';
        const cb = b.status === 'completed';
        if (ca !== cb) return ca ? 1 : -1;
        return (a.position || '').localeCompare(b.position || '');
      });
      setTasks(sorted);
    } catch (e) {
      if (e.status === 409) setStatus({ connected: false });
      else setError(e.message || 'Yüklenemedi');
    }
    setLoading(false);
  }, []);

  // İlk yükleme
  useEffect(() => {
    loadStatus().then(s => { if (s?.connected) loadTasklists(); });
  }, [loadStatus, loadTasklists]);

  // Liste değişince task'ları yeniden yükle
  useEffect(() => {
    if (activeList && status?.connected) loadTasks(activeList);
  }, [activeList, status?.connected, loadTasks]);

  // URL'de ?connected=1 varsa durumu yenile (OAuth dönüşü)
  useEffect(() => {
    const hash = window.location.hash || '';
    if (hash.includes('connected=1')) {
      loadStatus().then(s => { if (s?.connected) loadTasklists(); });
      // Temizle
      window.history.replaceState(null, '', '#google_tasks');
    }
  }, [loadStatus, loadTasklists]);

  // ── Aksiyonlar ───────────────────────────────────────────────────
  const handleConnect = () => { startGoogleTasksOAuth().catch(e => setError(e.message)); };

  const handleDisconnect = async () => {
    if (!window.confirm('Google Tasks bağlantısını kaldırmak istiyor musunuz? Google tarafındaki notlar silinmez, sadece IRDP erişimi kesilir.')) return;
    try { await disconnectGoogleTasks(); setStatus({ connected: false }); setTasks([]); setTasklists([]); setActiveList(null); }
    catch (e) { setError(e.message); }
  };

  const handleToggle = async (task) => {
    const wasCompleted = task.status === 'completed';
    // Optimistic update
    setTasks(ts => ts.map(t => t.id === task.id ? { ...t, status: wasCompleted ? 'needsAction' : 'completed' } : t));
    try {
      if (wasCompleted) await uncompleteTask(activeList, task.id);
      else await completeTask(activeList, task.id);
      loadTasks(activeList);
    } catch (e) { setError(e.message); loadTasks(activeList); }
  };

  const handleEdit = (task) => { setEditTarget(task); setModalOpen(true); };
  const handleNew  = () => { setEditTarget(null); setModalOpen(true); };

  const handleSave = async (payload) => {
    setModalOpen(false);
    try {
      if (editTarget?.id) await updateTask(activeList, editTarget.id, payload);
      else await createTask(activeList, payload);
      loadTasks(activeList);
    } catch (e) { setError(e.message); }
  };

  const handleDelete = async (task) => {
    if (!window.confirm(`"${task.title}" silinsin mi?`)) return;
    try { await deleteTask(activeList, task.id); loadTasks(activeList); }
    catch (e) { setError(e.message); }
  };

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    if (!quickTitle.trim() || !activeList) return;
    const title = quickTitle.trim();
    setQuickTitle('');
    try { await createTask(activeList, { title }); loadTasks(activeList); }
    catch (e) { setError(e.message); }
  };

  const handleNewList = async () => {
    const name = (newListName || '').trim();
    if (!name) return;
    try {
      const list = await createTasklist(name);
      setNewListName('');
      await loadTasklists();
      if (list?.id) setActiveList(list.id);
    } catch (e) { setError(e.message); }
  };

  const handleClearCompleted = async () => {
    if (!activeList) return;
    if (!window.confirm('Bu listedeki tamamlanan tüm görevleri gizlemek istiyor musunuz? (Silmez — Google Tasks\'te "clear" işlemi uygular.)')) return;
    try { await clearCompleted(activeList); loadTasks(activeList); }
    catch (e) { setError(e.message); }
  };

  const openTasks = useMemo(() => tasks.filter(t => t.status !== 'completed'), [tasks]);
  const doneTasks = useMemo(() => tasks.filter(t => t.status === 'completed'), [tasks]);

  // ── Render ───────────────────────────────────────────────────────
  if (status === null) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted, #6b7280)' }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
        <div>Google Tasks durumu yükleniyor…</div>
      </div>
    );
  }

  if (!status.connected) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 18 }}>✅ Google Tasks</div>
        <ConnectScreen onConnect={handleConnect} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Üst bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginRight: 'auto' }}>✅ Google Tasks</div>
        <div style={{ fontSize: 12, color: 'var(--muted, #6b7280)' }}>
          {status.google_email ? `🔗 ${status.google_email}` : 'Bağlı'}
        </div>
        <button onClick={() => loadTasks(activeList)} style={btn}>🔄 Yenile</button>
        <button onClick={handleDisconnect} style={{ ...btn, color: '#ef4444' }}>Bağlantıyı Kaldır</button>
      </div>

      {/* Tasklist sekmeleri + yeni liste ekle */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        {tasklists.map(l => (
          <button
            key={l.id}
            onClick={() => setActiveList(l.id)}
            style={{
              ...btn,
              background: l.id === activeList ? 'var(--navy, #1a3a5c)' : 'var(--card-bg, #fff)',
              color: l.id === activeList ? '#fff' : 'var(--text, #111)',
              fontWeight: l.id === activeList ? 600 : 400,
            }}
          >
            📋 {l.title}
          </button>
        ))}
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={newListName} onChange={e => setNewListName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleNewList()}
            placeholder="Yeni liste…"
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border, #d4d4d8)', fontSize: 12, width: 140 }}
          />
          <button onClick={handleNewList} style={{ ...btn, padding: '6px 10px' }}>+ Liste</button>
        </div>
      </div>

      {/* Görünüm toggle + filtreler */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', border: '1px solid var(--border, #d4d4d8)', borderRadius: 8, overflow: 'hidden' }}>
          <button onClick={() => setViewMode('card')} style={{ ...btn, border: 'none', borderRadius: 0,
            background: viewMode === 'card' ? 'var(--navy, #1a3a5c)' : 'transparent',
            color: viewMode === 'card' ? '#fff' : 'inherit' }}>🃏 Kart</button>
          <button onClick={() => setViewMode('list')} style={{ ...btn, border: 'none', borderRadius: 0,
            background: viewMode === 'list' ? 'var(--navy, #1a3a5c)' : 'transparent',
            color: viewMode === 'list' ? '#fff' : 'inherit' }}>📝 Liste</button>
        </div>
        <label style={{ fontSize: 12, color: 'var(--muted, #6b7280)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)} />
          Tamamlananları göster
        </label>
        <button onClick={handleClearCompleted} style={{ ...btn, marginLeft: 'auto' }}>🧹 Tamamlananları Temizle</button>
        <button onClick={handleNew} style={btnPrimary}>+ Yeni Task</button>
      </div>

      {error && (
        <div style={{ padding: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#b91c1c', marginBottom: 12, fontSize: 13 }}>
          ⚠️ {error} <button onClick={() => setError(null)} style={{ float: 'right', border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit' }}>×</button>
        </div>
      )}

      {/* Hızlı ekleme */}
      <form onSubmit={handleQuickAdd} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={quickTitle} onChange={e => setQuickTitle(e.target.value)}
          placeholder="Hızlı task ekle (Enter ile)…"
          style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border, #d4d4d8)', fontSize: 14, fontFamily: 'inherit' }}
        />
        <button type="submit" style={btnPrimary} disabled={!quickTitle.trim()}>Ekle</button>
      </form>

      {/* İçerik */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted, #6b7280)' }}>⏳ Yükleniyor…</div>
      ) : tasks.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted, #6b7280)', border: '2px dashed var(--border, #e5e7eb)', borderRadius: 12 }}>
          Bu listede henüz task yok — yukarıdan ekleyin.
        </div>
      ) : viewMode === 'card' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {openTasks.map(t => (
              <TaskCard key={t.id} task={t} onToggle={handleToggle} onEdit={handleEdit} onDelete={handleDelete} />
            ))}
          </div>
          {showCompleted && doneTasks.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted, #6b7280)', letterSpacing: '0.05em', margin: '20px 0 10px' }}>
                TAMAMLANANLAR ({doneTasks.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {doneTasks.map(t => (
                  <TaskCard key={t.id} task={t} onToggle={handleToggle} onEdit={handleEdit} onDelete={handleDelete} />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <div style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 10, overflow: 'hidden' }}>
          {openTasks.map(t => (
            <TaskRow key={t.id} task={t} onToggle={handleToggle} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
          {showCompleted && doneTasks.map(t => (
            <TaskRow key={t.id} task={t} onToggle={handleToggle} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {modalOpen && (
        <TaskModal
          task={editTarget}
          onSave={handleSave}
          onCancel={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
