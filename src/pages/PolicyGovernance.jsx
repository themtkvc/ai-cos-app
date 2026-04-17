import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  getPolicyPages, createPolicyPage, updatePolicyPage, deletePolicyPage,
  getPolicyDatabases, createPolicyDatabase, updatePolicyDatabase, deletePolicyDatabase,
  getPolicyColumns, createPolicyColumn, updatePolicyColumn, deletePolicyColumn,
  getPolicyRows, createPolicyRow, updatePolicyRow, deletePolicyRow,
  getAllUserProfiles,
} from '../lib/supabase';

// ── Sabitler ─────────────────────────────────────────────────────────
const COLUMN_TYPES = [
  { type: 'text',      label: 'Metin',         icon: 'Aa' },
  { type: 'number',    label: 'Sayı',          icon: '#' },
  { type: 'date',      label: 'Tarih',         icon: '📅' },
  { type: 'daterange', label: 'Tarih Aralığı', icon: '📆' },
  { type: 'select',    label: 'Durum',         icon: '●' },
  { type: 'priority',  label: 'Öncelik',       icon: '⚑' },
  { type: 'person',    label: 'Kişi',          icon: '👤' },
  { type: 'checkbox',  label: 'Checkbox',      icon: '☑' },
  { type: 'url',       label: 'URL / Dosya',   icon: '🔗' },
  { type: 'autoid',    label: 'ID',            icon: '№' },
];

// Önceden tanımlı Öncelik seçenekleri
const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Kritik', color: '#fecaca', text: '#991b1b' },
  { value: 'high',     label: 'High',   color: '#fed7aa', text: '#9a3412' },
  { value: 'medium',   label: 'Medium', color: '#fef3c7', text: '#92400e' },
  { value: 'low',      label: 'Low',    color: '#d1fae5', text: '#065f46' },
];

const STATUS_COLORS = [
  { color: '#e5e7eb', text: '#374151' },
  { color: '#fef3c7', text: '#92400e' },
  { color: '#dbeafe', text: '#1e40af' },
  { color: '#d1fae5', text: '#065f46' },
  { color: '#fecaca', text: '#991b1b' },
  { color: '#e9d5ff', text: '#6b21a8' },
  { color: '#fed7aa', text: '#9a3412' },
  { color: '#ccfbf1', text: '#115e59' },
];

const PAGE_ICONS = ['📄','📋','📊','📁','🗂','📌','📎','🎯','⚖️','🏛','📚','📝','💡','🔒','🌐','🧭'];

// ── Yardımcılar ──────────────────────────────────────────────────────
function buildTree(pages) {
  const map = {};
  pages.forEach(p => { map[p.id] = { ...p, children: [] }; });
  const roots = [];
  pages.forEach(p => {
    if (p.parent_id && map[p.parent_id]) {
      map[p.parent_id].children.push(map[p.id]);
    } else {
      roots.push(map[p.id]);
    }
  });
  return roots;
}

function fmtDate(d) {
  if (!d) return '';
  try {
    const date = new Date(d + (d.includes('T') ? '' : 'T12:00:00'));
    return date.toLocaleDateString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric' });
  } catch { return d; }
}

// ── Ana Bileşen ──────────────────────────────────────────────────────
export default function PolicyGovernance({ user, profile }) {
  const [pages, setPages] = useState([]);
  const [selectedPageId, setSelectedPageId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [people, setPeople] = useState([]);

  useEffect(() => {
    loadPages();
    getAllUserProfiles().then(({ data }) => setPeople(data || []));
  }, []);

  const loadPages = async () => {
    setLoading(true);
    const { data } = await getPolicyPages();
    setPages(data);
    setLoading(false);
    if (!selectedPageId && data.length > 0) setSelectedPageId(data[0].id);
  };

  const tree = useMemo(() => buildTree(pages), [pages]);
  const selected = pages.find(p => p.id === selectedPageId);

  const handleAddPage = async (parent_id = null) => {
    const { data } = await createPolicyPage({ parent_id });
    if (data?.[0]) {
      // Her sayfanın kendi tablosu olsun — sayfa ile birlikte otomatik oluştur
      await createPolicyDatabase({ page_id: data[0].id, name: data[0].title || 'Tablo', order_index: 0 });
      await loadPages();
      setSelectedPageId(data[0].id);
      if (parent_id) setExpanded(e => ({ ...e, [parent_id]: true }));
    }
  };

  const handleDeletePage = async (id) => {
    if (!window.confirm('Bu sayfayı ve tüm alt sayfalarını silmek istediğinize emin misiniz?')) return;
    await deletePolicyPage(id);
    await loadPages();
    if (selectedPageId === id) setSelectedPageId(pages.find(p => p.id !== id)?.id || null);
  };

  const handleUpdatePage = async (id, updates) => {
    await updatePolicyPage(id, updates);
    setPages(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  return (
    <div style={S.wrap}>
      <aside style={S.sidebar}>
        <div style={S.sidebarHeader}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>⚖️ Politikalar ve Yönetişim</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {profile?.full_name} · {profile?.role === 'direktor' ? 'Direktör' : 'Politika Birimi'}
          </div>
        </div>

        <button style={S.addRoot} onClick={() => handleAddPage(null)}>
          + Yeni Sayfa
        </button>

        <div style={S.tree}>
          {loading && <div style={S.empty}>Yükleniyor...</div>}
          {!loading && tree.length === 0 && (
            <div style={S.empty}>Henüz sayfa yok. Yukarıdan bir sayfa oluşturun.</div>
          )}
          {tree.map(node => (
            <PageNode
              key={node.id}
              node={node}
              depth={0}
              expanded={expanded}
              setExpanded={setExpanded}
              selectedId={selectedPageId}
              onSelect={setSelectedPageId}
              onAddChild={handleAddPage}
              onDelete={handleDeletePage}
              onUpdate={handleUpdatePage}
            />
          ))}
        </div>
      </aside>

      <main style={S.main}>
        {selected ? (
          <PageView
            page={selected}
            onUpdate={handleUpdatePage}
            user={user}
            profile={profile}
            people={people}
          />
        ) : (
          <div style={S.emptyMain}>
            <div style={{ fontSize: 48 }}>⚖️</div>
            <div style={{ fontWeight: 700, fontSize: 20, marginTop: 16 }}>
              Politika ve Yönetişim alanı
            </div>
            <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>
              Sol taraftan bir sayfa seçin veya yeni bir sayfa oluşturun.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Sayfa Ağacı Node ─────────────────────────────────────────────────
function PageNode({ node, depth, expanded, setExpanded, selectedId, onSelect, onAddChild, onDelete, onUpdate }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(node.title);
  const [iconPicker, setIconPicker] = useState(false);
  const isExpanded = expanded[node.id];
  const isSelected = selectedId === node.id;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        style={{
          ...S.treeRow,
          paddingLeft: 8 + depth * 16,
          background: isSelected ? 'var(--bg-secondary)' : 'transparent',
        }}
      >
        <span
          style={S.chevron}
          onClick={() => hasChildren && setExpanded(e => ({ ...e, [node.id]: !isExpanded }))}
        >
          {hasChildren ? (isExpanded ? '▾' : '▸') : '·'}
        </span>
        <span
          style={{ cursor: 'pointer', position: 'relative' }}
          onClick={(e) => { e.stopPropagation(); setIconPicker(v => !v); }}
          title="İkon değiştir"
        >
          {node.icon || '📄'}
          {iconPicker && (
            <div style={S.iconPicker} onClick={e => e.stopPropagation()}>
              {PAGE_ICONS.map(ic => (
                <button
                  key={ic}
                  style={S.iconBtn}
                  onClick={() => { onUpdate(node.id, { icon: ic }); setIconPicker(false); }}
                >{ic}</button>
              ))}
            </div>
          )}
        </span>
        {editing ? (
          <input
            autoFocus
            style={S.treeInput}
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onBlur={() => { onUpdate(node.id, { title: editTitle || 'Yeni Sayfa' }); setEditing(false); }}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setEditTitle(node.title); setEditing(false); } }}
          />
        ) : (
          <span
            style={{ flex: 1, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            onClick={() => onSelect(node.id)}
            onDoubleClick={() => setEditing(true)}
          >
            {node.title}
          </span>
        )}
        <span style={{ position: 'relative' }}>
          <button
            style={S.treeMenu}
            onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
            title="Seçenekler"
          >⋯</button>
          {menuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setMenuOpen(false)} />
              <div style={S.menuPop}>
                <button style={S.menuItem} onClick={() => { setMenuOpen(false); setEditing(true); }}>
                  ✏️ Yeniden adlandır
                </button>
                <button style={S.menuItem} onClick={() => { setMenuOpen(false); onAddChild(node.id); }}>
                  ➕ Alt sayfa ekle
                </button>
                <button style={{ ...S.menuItem, color: 'var(--red, #dc2626)' }} onClick={() => { setMenuOpen(false); onDelete(node.id); }}>
                  🗑️ Sil
                </button>
              </div>
            </>
          )}
        </span>
      </div>
      {isExpanded && node.children.map(child => (
        <PageNode
          key={child.id}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          setExpanded={setExpanded}
          selectedId={selectedId}
          onSelect={onSelect}
          onAddChild={onAddChild}
          onDelete={onDelete}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}

// ── Sayfa Görünümü (her sayfada tek tablo, tam sayfa) ────────────────
function PageView({ page, onUpdate, user, profile, people }) {
  const [title, setTitle] = useState(page.title);
  const [database, setDatabase] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTitle(page.title);
    loadDatabase();
    // eslint-disable-next-line
  }, [page.id]);

  // Her sayfada TEK tablo olacak — yoksa otomatik oluştur
  const loadDatabase = async () => {
    setLoading(true);
    const { data } = await getPolicyDatabases(page.id);
    if (data && data.length > 0) {
      setDatabase(data[0]);
    } else {
      const { data: created } = await createPolicyDatabase({ page_id: page.id, name: page.title || 'Tablo', order_index: 0 });
      setDatabase(created?.[0] || null);
    }
    setLoading(false);
  };

  const saveTitle = () => {
    if (title !== page.title) {
      onUpdate(page.id, { title: title || 'Yeni Sayfa' });
      // Tablo adını da otomatik senkronize et (eğer kullanıcı özelleştirmediyse)
      if (database && (database.name === page.title || database.name === 'Tablo' || database.name === 'Yeni Tablo')) {
        updatePolicyDatabase(database.id, { name: title });
        setDatabase(d => ({ ...d, name: title }));
      }
    }
  };

  return (
    <div style={S.pageViewFull}>
      <div style={S.pageHeaderCompact}>
        <div style={{ fontSize: 28, lineHeight: 1 }}>{page.icon || '📄'}</div>
        <input
          style={S.pageTitleCompact}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
          placeholder="Başlıksız"
        />
      </div>

      {loading ? (
        <div style={{ padding: 24, color: 'var(--text-muted)' }}>Yükleniyor...</div>
      ) : database ? (
        <DatabaseView
          db={database}
          people={people}
          fullPage
          onRename={(name) => updatePolicyDatabase(database.id, { name }).then(() => setDatabase(d => ({ ...d, name })))}
          onChangeView={(v) => updatePolicyDatabase(database.id, { default_view: v }).then(() => setDatabase(d => ({ ...d, default_view: v })))}
          // Tek tablo olduğundan silme butonu gösterilmez
          onDelete={null}
        />
      ) : (
        <div style={{ padding: 24, color: 'var(--text-muted)' }}>Tablo yüklenemedi.</div>
      )}
    </div>
  );
}

// ── Gömülü Tablo Görünümü ────────────────────────────────────────────
function DatabaseView({ db, people, onRename, onChangeView, onDelete, fullPage = false }) {
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [view, setView] = useState(db.default_view || 'table');
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(db.name);
  const [groupBy, setGroupBy] = useState(() => {
    try { return localStorage.getItem(`policy_group_${db.id}`) || null; } catch { return null; }
  });
  const changeGroupBy = (val) => {
    setGroupBy(val);
    try { val ? localStorage.setItem(`policy_group_${db.id}`, val) : localStorage.removeItem(`policy_group_${db.id}`); } catch {}
  };

  useEffect(() => {
    setName(db.name);
    setView(db.default_view || 'table');
  }, [db.id, db.name, db.default_view]);

  const loadAll = async () => {
    setLoading(true);
    const [c, r] = await Promise.all([getPolicyColumns(db.id), getPolicyRows(db.id)]);
    setColumns(c.data);
    setRows(r.data);
    setLoading(false);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [db.id]);

  // PGA Task Tracker şablonu — tek tıkla tablo sütunlarını kurar
  const applyPgaTemplate = async () => {
    const statusOpts = [
      { value: 'not_started', label: 'Not started', color: '#e5e7eb', text: '#374151' },
      { value: 'general',     label: 'General',     color: '#e9d5ff', text: '#6b21a8' },
      { value: 'in_progress', label: 'In progress', color: '#dbeafe', text: '#1e40af' },
      { value: 'postponed',   label: 'Postponed',   color: '#fed7aa', text: '#9a3412' },
      { value: 'done',        label: 'Done',        color: '#d1fae5', text: '#065f46' },
    ];
    const tpl = [
      { name: 'Done',           type: 'checkbox',  width: 70 },
      { name: 'Status',         type: 'select',    width: 140, options: statusOpts },
      { name: 'Task',           type: 'text',      width: 280 },
      { name: 'Priority',       type: 'priority',  width: 100 },
      { name: 'Notes',          type: 'text',      width: 240 },
      { name: 'Sub-Task Notes', type: 'text',      width: 200 },
      { name: 'Due Date',       type: 'daterange', width: 240 },
      { name: 'Files & Media',  type: 'url',       width: 180 },
      { name: 'Done Date',      type: 'date',      width: 130 },
      { name: 'Done By',        type: 'person',    width: 160 },
      { name: '№ ID',           type: 'autoid',    width: 80, options: { prefix: 'TT' } },
      { name: 'Reminder Date',  type: 'date',      width: 130 },
    ];
    for (let i = 0; i < tpl.length; i++) {
      await createPolicyColumn({
        database_id: db.id, name: tpl[i].name, type: tpl[i].type,
        order_index: i, width: tpl[i].width,
        options: tpl[i].options || [],
      });
    }
    await loadAll();
  };

  const addColumn = async (type) => {
    const ord = columns.length;
    const defaultName = {
      text: 'Metin', number: 'Sayı', date: 'Tarih', daterange: 'Tarih Aralığı',
      select: 'Durum', priority: 'Öncelik', person: 'Kişi', checkbox: 'Tamam?',
      url: 'Link', autoid: 'ID',
    }[type] || 'Sütun';
    let options = [];
    let width = 200;
    if (type === 'select') {
      options = [
        { value: 'not_started', label: 'Not started', color: STATUS_COLORS[0].color, text: STATUS_COLORS[0].text },
        { value: 'in_progress', label: 'In progress', color: STATUS_COLORS[2].color, text: STATUS_COLORS[2].text },
        { value: 'done',        label: 'Done',        color: STATUS_COLORS[3].color, text: STATUS_COLORS[3].text },
        { value: 'postponed',   label: 'Postponed',   color: STATUS_COLORS[4].color, text: STATUS_COLORS[4].text },
      ];
    }
    if (type === 'autoid') { options = { prefix: 'TT' }; width = 70; }
    if (type === 'checkbox') { width = 80; }
    if (type === 'daterange') { width = 240; }
    await createPolicyColumn({ database_id: db.id, name: `${defaultName}${type === 'autoid' || type === 'checkbox' ? '' : ' ' + (ord + 1)}`, type, order_index: ord, options, width });
    await loadAll();
  };

  const updateColumnLocal = (id, patch) => {
    setColumns(cols => cols.map(c => c.id === id ? { ...c, ...patch } : c));
  };

  const saveColumn = async (id, patch) => {
    updateColumnLocal(id, patch);
    await updatePolicyColumn(id, patch);
  };

  const removeColumn = async (id) => {
    if (!window.confirm('Bu sütunu silmek istediğinize emin misiniz? (tüm değerler silinir)')) return;
    await deletePolicyColumn(id);
    await loadAll();
  };

  const addRow = async () => {
    await createPolicyRow({ database_id: db.id, data: {}, order_index: rows.length });
    await loadAll();
  };

  const updateCellLocal = (rowId, colId, value) => {
    setRows(rs => rs.map(r => r.id === rowId ? { ...r, data: { ...r.data, [colId]: value } } : r));
  };

  const saveCell = async (rowId, colId, value) => {
    const row = rows.find(r => r.id === rowId);
    const col = columns.find(c => c.id === colId);
    let newData = { ...(row?.data || {}), [colId]: value };
    // Done checkbox işaretlenince "Done Date" ve "Done By" otomatik doldur
    if (col && col.type === 'checkbox' && /done|tamam/i.test(col.name)) {
      const dateCol = columns.find(c => c.type === 'date' && /done|tamam/i.test(c.name));
      const personCol = columns.find(c => c.type === 'person' && /done|tamam/i.test(c.name));
      if (value === true) {
        const today = new Date().toISOString().slice(0, 10);
        if (dateCol && !newData[dateCol.id]) newData[dateCol.id] = today;
        if (personCol && !newData[personCol.id]) {
          const { data: { user } } = await (await import('../lib/supabase')).supabase.auth.getUser();
          if (user) newData[personCol.id] = user.id;
        }
      } else {
        if (dateCol) newData[dateCol.id] = null;
      }
    }
    setRows(rs => rs.map(r => r.id === rowId ? { ...r, data: newData } : r));
    await updatePolicyRow(rowId, { data: newData });
  };

  const removeRow = async (id) => {
    await deletePolicyRow(id);
    setRows(rs => rs.filter(r => r.id !== id));
  };

  return (
    <div style={fullPage ? S.dbFull : S.db}>
      <div style={S.dbHeader}>
        {editingName ? (
          <input
            autoFocus
            style={S.dbNameInput}
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => { setEditingName(false); onRename(name || 'Yeni Tablo'); }}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
          />
        ) : (
          <div style={S.dbName} onDoubleClick={() => setEditingName(true)}>
            <span style={{ fontSize: 18 }}>{db.icon || '📋'}</span>
            <span>{name}</span>
          </div>
        )}

        <div style={S.viewSwitcher}>
          {[
            { key: 'table',    label: 'Tablo',   icon: '☰' },
            { key: 'kanban',   label: 'Kanban',  icon: '▤' },
            { key: 'calendar', label: 'Takvim',  icon: '📅' },
          ].map(v => (
            <button
              key={v.key}
              onClick={() => { setView(v.key); onChangeView(v.key); }}
              style={{
                ...S.viewBtn,
                background: view === v.key ? 'var(--navy, #1a3a5c)' : 'transparent',
                color: view === v.key ? '#fff' : 'var(--text)',
              }}
            >
              {v.icon} {v.label}
            </button>
          ))}
          {onDelete && <button style={S.dbDelBtn} onClick={onDelete} title="Tabloyu sil">🗑</button>}
        </div>
      </div>

      <div style={fullPage ? { flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' } : {}}>
        {loading ? (
          <div style={{ padding: 20, color: 'var(--text-muted)' }}>Yükleniyor...</div>
        ) : view === 'table' ? (
          <TableView
            columns={columns}
            rows={rows}
            people={people}
            onAddColumn={addColumn}
            onSaveColumn={saveColumn}
            onRemoveColumn={removeColumn}
            onAddRow={addRow}
            onSaveCell={saveCell}
            onRemoveRow={removeRow}
            groupBy={groupBy}
            onGroupByChange={changeGroupBy}
            onApplyTemplate={applyPgaTemplate}
          />
        ) : view === 'kanban' ? (
          <KanbanView columns={columns} rows={rows} people={people} onSaveCell={saveCell} onAddRow={addRow} />
        ) : (
          <CalendarView columns={columns} rows={rows} people={people} />
        )}
      </div>
    </div>
  );
}

// ── Tablo Görünümü (grupsuz + gruplu) ────────────────────────────────
function TableView({ columns, rows, people, onAddColumn, onSaveColumn, onRemoveColumn, onAddRow, onSaveCell, onRemoveRow, groupBy, onGroupByChange, onApplyTemplate }) {
  const [addColOpen, setAddColOpen] = useState(false);
  const [collapsed, setCollapsed] = useState({});

  if (columns.length === 0) {
    return (
      <div style={{ padding: 28, textAlign: 'center' }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: 14 }}>
          Tabloyu kullanmak için sütun ekleyin veya bir şablon uygulayın
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            style={{ ...S.btnPrimary, padding: '10px 18px' }}
            onClick={onApplyTemplate}
            title="Done · Status · Task · Priority · Notes · Due Date · Done Date · Done By · ID · Reminder"
          >📋 PGA Task Tracker Şablonu Uygula</button>
          <AddColumnBtn open={addColOpen} setOpen={setAddColOpen} onAdd={onAddColumn} />
        </div>
      </div>
    );
  }

  const groupableCols = columns.filter(c => c.type === 'select' || c.type === 'priority');
  const groupCol = groupBy ? columns.find(c => c.id === groupBy) : null;

  const renderRow = (row, idx) => (
    <tr key={row.id} style={S.tr}>
      {columns.map(col => (
        <td key={col.id} style={{ ...S.td, width: col.width || 200 }}>
          <CellEditor
            column={col}
            value={row.data?.[col.id]}
            people={people}
            rowNumber={String(idx + 1).padStart(2, '0')}
            onSave={(v) => onSaveCell(row.id, col.id, v)}
          />
        </td>
      ))}
      <td style={S.td}>
        <button style={S.rowDel} onClick={() => onRemoveRow(row.id)} title="Sil">×</button>
      </td>
    </tr>
  );

  // Grup bilgisi hesapla
  let groups = [];
  if (groupCol) {
    const opts = groupCol.type === 'priority'
      ? PRIORITY_OPTIONS
      : (groupCol.options || []);
    const buckets = {};
    rows.forEach((r, idx) => {
      const val = r.data?.[groupCol.id] || '';
      if (!buckets[val]) buckets[val] = [];
      buckets[val].push({ row: r, idx });
    });
    const ordered = [...opts, { value: '', label: '— Atanmadı —', color: '#e5e7eb', text: '#374151' }];
    groups = ordered
      .map(o => ({ ...o, rows: buckets[o.value] || [] }))
      .filter(g => g.rows.length > 0);
  }

  return (
    <div>
      <div style={S.tvToolbar}>
        <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Gruplama:</label>
        <select
          value={groupBy || ''}
          onChange={e => onGroupByChange(e.target.value || null)}
          style={S.tvSelect}
        >
          <option value="">Grup yok</option>
          {groupableCols.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={S.table}>
          <thead>
            <tr>
              {columns.map(col => (
                <ColumnHeader
                  key={col.id}
                  column={col}
                  onSave={(patch) => onSaveColumn(col.id, patch)}
                  onRemove={() => onRemoveColumn(col.id)}
                />
              ))}
              <th style={{ ...S.th, width: 60, position: 'relative' }}>
                <AddColumnBtn open={addColOpen} setOpen={setAddColOpen} onAdd={onAddColumn} compact />
              </th>
            </tr>
          </thead>
          <tbody>
            {groupCol ? groups.map(g => {
              const isOpen = !collapsed[g.value];
              return (
                <React.Fragment key={g.value || '_none_'}>
                  <tr>
                    <td colSpan={columns.length + 1} style={{ ...S.groupHead, background: g.color, color: g.text }}>
                      <button
                        onClick={() => setCollapsed(c => ({ ...c, [g.value]: isOpen }))}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}
                      >
                        {isOpen ? '▾' : '▸'} <span style={{ padding: '2px 8px', borderRadius: 12, background: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{g.label}</span>
                        <span style={{ marginLeft: 8, opacity: 0.7, fontSize: 12 }}>({g.rows.length})</span>
                      </button>
                    </td>
                  </tr>
                  {isOpen && g.rows.map(({ row, idx }) => renderRow(row, idx))}
                </React.Fragment>
              );
            }) : rows.map((row, idx) => renderRow(row, idx))}
            <tr>
              <td colSpan={columns.length + 1} style={S.tdFooter}>
                <button style={S.addRowBtn} onClick={onAddRow}>+ Yeni satır</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sütun Başlığı (Düzenleme) ────────────────────────────────────────
function ColumnHeader({ column, onSave, onRemove }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(column.name);
  const [optsOpen, setOptsOpen] = useState(false);

  useEffect(() => { setName(column.name); }, [column.name]);

  const typeLabel = COLUMN_TYPES.find(t => t.type === column.type);

  return (
    <th style={{ ...S.th, width: column.width || 200, minWidth: 120, position: 'relative' }}>
      {editing ? (
        <input
          autoFocus
          style={S.colNameInput}
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={() => { setEditing(false); onSave({ name: name || 'Sütun' }); }}
          onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
        />
      ) : (
        <div style={S.colHeader}>
          <span style={{ opacity: 0.6, fontSize: 11, fontWeight: 500 }}>{typeLabel?.icon}</span>
          <span
            style={{ flex: 1, cursor: 'pointer' }}
            onDoubleClick={() => setEditing(true)}
          >{column.name}</span>
          <button
            style={S.colMenu}
            onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
          >⋯</button>
        </div>
      )}
      {menuOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setMenuOpen(false)} />
          <div style={{ ...S.menuPop, right: 0, top: '100%' }}>
            <button style={S.menuItem} onClick={() => { setMenuOpen(false); setEditing(true); }}>✏️ Yeniden adlandır</button>
            {column.type === 'select' && (
              <button style={S.menuItem} onClick={() => { setMenuOpen(false); setOptsOpen(true); }}>🎨 Seçenekleri düzenle</button>
            )}
            <button style={{ ...S.menuItem, color: '#dc2626' }} onClick={() => { setMenuOpen(false); onRemove(); }}>🗑️ Sütunu sil</button>
          </div>
        </>
      )}
      {optsOpen && (
        <SelectOptionsEditor
          options={column.options || []}
          onSave={(options) => { onSave({ options }); setOptsOpen(false); }}
          onClose={() => setOptsOpen(false)}
        />
      )}
    </th>
  );
}

// ── Select Seçenekleri Editor ────────────────────────────────────────
function SelectOptionsEditor({ options, onSave, onClose }) {
  const [opts, setOpts] = useState(options);
  const addOpt = () => {
    const c = STATUS_COLORS[opts.length % STATUS_COLORS.length];
    setOpts([...opts, { value: `opt_${Date.now()}`, label: 'Yeni', color: c.color, text: c.text }]);
  };
  const updateOpt = (i, patch) => setOpts(opts.map((o, idx) => idx === i ? { ...o, ...patch } : o));
  const removeOpt = (i) => setOpts(opts.filter((_, idx) => idx !== i));

  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <div style={{ fontWeight: 700 }}>Durum Seçenekleri</div>
          <button style={S.modalClose} onClick={onClose}>×</button>
        </div>
        <div style={{ padding: 16, maxHeight: 400, overflowY: 'auto' }}>
          {opts.map((o, i) => (
            <div key={i} style={S.optRow}>
              <input
                value={o.label}
                onChange={e => updateOpt(i, { label: e.target.value })}
                style={S.optInput}
                placeholder="Etiket"
              />
              <div style={S.colorDots}>
                {STATUS_COLORS.map((c, ci) => (
                  <button
                    key={ci}
                    style={{ ...S.colorDot, background: c.color, border: o.color === c.color ? '2px solid #000' : '1px solid #ccc' }}
                    onClick={() => updateOpt(i, { color: c.color, text: c.text })}
                  />
                ))}
              </div>
              <button style={S.optDel} onClick={() => removeOpt(i)}>×</button>
            </div>
          ))}
          <button style={S.addRowBtn} onClick={addOpt}>+ Seçenek ekle</button>
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnSecondary} onClick={onClose}>İptal</button>
          <button style={S.btnPrimary} onClick={() => onSave(opts)}>Kaydet</button>
        </div>
      </div>
    </div>
  );
}

// ── Sütun Ekle Butonu ────────────────────────────────────────────────
function AddColumnBtn({ open, setOpen, onAdd, compact = false }) {
  return (
    <>
      <button
        style={compact ? S.colAddCompact : S.btnPrimary}
        onClick={() => setOpen(true)}
        title="Sütun ekle"
      >{compact ? '+' : '+ Sütun ekle'}</button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
          <div style={{ ...S.menuPop, right: 0, top: '100%', width: 180 }}>
            {COLUMN_TYPES.map(t => (
              <button
                key={t.type}
                style={S.menuItem}
                onClick={() => { onAdd(t.type); setOpen(false); }}
              >
                <span style={{ display: 'inline-block', width: 22, textAlign: 'center', opacity: 0.6 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ── Hücre Editörü (tüm tipler) ───────────────────────────────────────
function CellEditor({ column, value, people, onSave, rowNumber, compact = false }) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => { setV(value ?? ''); }, [value]);

  if (column.type === 'autoid') {
    const prefix = (column.options && column.options.prefix) || 'TT';
    return <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{prefix}-{rowNumber}</span>;
  }
  if (column.type === 'url') {
    return (
      <UrlCell
        value={v}
        onChange={setV}
        onSave={() => { if (v !== value) onSave(v); }}
      />
    );
  }
  if (column.type === 'daterange') {
    const val = (typeof v === 'object' && v) ? v : {};
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="date"
          value={val.start || ''}
          onChange={e => { const nv = { ...val, start: e.target.value || null }; setV(nv); onSave(nv); }}
          style={{ ...S.cellInput, width: '45%' }}
        />
        <span style={{ opacity: 0.5 }}>→</span>
        <input
          type="date"
          value={val.end || ''}
          onChange={e => { const nv = { ...val, end: e.target.value || null }; setV(nv); onSave(nv); }}
          style={{ ...S.cellInput, width: '45%' }}
        />
      </div>
    );
  }
  if (column.type === 'priority') {
    const opt = PRIORITY_OPTIONS.find(o => o.value === v);
    return (
      <select
        value={v || ''}
        onChange={e => { setV(e.target.value); onSave(e.target.value || null); }}
        style={{
          ...S.cellInput,
          background: opt?.color || 'transparent',
          color: opt?.text || 'var(--text)',
          fontWeight: 600, borderRadius: 6, textAlign: 'center',
        }}
      >
        <option value="">—</option>
        {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  if (column.type === 'text') {
    return (
      <input
        style={S.cellInput}
        value={v}
        onChange={e => setV(e.target.value)}
        onBlur={() => { if (v !== value) onSave(v); }}
        placeholder="—"
      />
    );
  }
  if (column.type === 'number') {
    return (
      <input
        type="number"
        style={S.cellInput}
        value={v}
        onChange={e => setV(e.target.value)}
        onBlur={() => { if (v !== value) onSave(v === '' ? null : Number(v)); }}
        placeholder="—"
      />
    );
  }
  if (column.type === 'date') {
    return (
      <input
        type="date"
        style={S.cellInput}
        value={v || ''}
        onChange={e => { setV(e.target.value); onSave(e.target.value || null); }}
      />
    );
  }
  if (column.type === 'checkbox') {
    return (
      <input
        type="checkbox"
        style={{ width: 18, height: 18, cursor: 'pointer' }}
        checked={!!v}
        onChange={e => { setV(e.target.checked); onSave(e.target.checked); }}
      />
    );
  }
  if (column.type === 'select') {
    const opts = column.options || [];
    const selected = opts.find(o => o.value === v);
    return (
      <select
        value={v || ''}
        onChange={e => { setV(e.target.value); onSave(e.target.value); }}
        style={{
          ...S.cellInput,
          background: selected?.color || 'transparent',
          color: selected?.text || 'var(--text)',
          fontWeight: 600,
          borderRadius: 6,
          textAlign: 'center',
        }}
      >
        <option value="">—</option>
        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  if (column.type === 'person') {
    return (
      <select
        value={v || ''}
        onChange={e => { setV(e.target.value); onSave(e.target.value || null); }}
        style={S.cellInput}
      >
        <option value="">—</option>
        {people.map(p => (
          <option key={p.user_id} value={p.user_id}>{p.full_name}</option>
        ))}
      </select>
    );
  }
  return null;
}

// ── URL Hücresi (tıkla-düzenle / tıkla-aç) ───────────────────────────
function UrlCell({ value, onChange, onSave }) {
  const [editing, setEditing] = useState(false);
  if (!editing && value) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 6px' }}>
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--navy, #1a3a5c)', textDecoration: 'underline', fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >🔗 {value.replace(/^https?:\/\//, '').slice(0, 40)}</a>
        <button
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}
          onClick={() => setEditing(true)}
        >✏️</button>
      </div>
    );
  }
  return (
    <input
      autoFocus={editing}
      style={S.cellInput}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      onBlur={() => { setEditing(false); onSave(); }}
      placeholder="https://..."
    />
  );
}

// ── Kanban Görünümü ──────────────────────────────────────────────────
function KanbanView({ columns, rows, people, onSaveCell, onAddRow }) {
  const selectCol = columns.find(c => c.type === 'select') || columns.find(c => c.type === 'priority');
  const titleCol = columns.find(c => c.type === 'text') || columns[0];

  if (!selectCol) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
        Kanban görünümü için bir <b>Durum</b> veya <b>Öncelik</b> sütunu ekleyin.
      </div>
    );
  }

  const baseOpts = selectCol.type === 'priority' ? PRIORITY_OPTIONS : (selectCol.options || []);
  const opts = [{ value: '', label: 'Atanmadı', color: '#e5e7eb', text: '#374151' }, ...baseOpts];

  return (
    <div style={S.kanbanWrap}>
      {opts.map(opt => {
        const cardsInCol = rows.filter(r => (r.data?.[selectCol.id] || '') === opt.value);
        return (
          <div key={opt.value} style={S.kanbanCol}>
            <div style={{ ...S.kanbanHead, background: opt.color, color: opt.text }}>
              <span>{opt.label}</span>
              <span style={{ opacity: 0.7, fontSize: 12 }}>{cardsInCol.length}</span>
            </div>
            <div style={S.kanbanBody}>
              {cardsInCol.map(row => (
                <div key={row.id} style={S.kanbanCard}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                    {row.data?.[titleCol?.id] || '—'}
                  </div>
                  {columns.filter(c => c.id !== titleCol?.id && c.id !== selectCol.id && c.type !== 'autoid').slice(0, 4).map(c => {
                    const val = row.data?.[c.id];
                    if (val === null || val === undefined || val === '') return null;
                    let display = val;
                    if (c.type === 'date') display = fmtDate(val);
                    if (c.type === 'daterange') display = `${fmtDate(val?.start)} → ${fmtDate(val?.end)}`;
                    if (c.type === 'person') display = people.find(p => p.user_id === val)?.full_name || '';
                    if (c.type === 'checkbox') display = val ? '✅' : '';
                    if (c.type === 'select') {
                      const o = (c.options || []).find(o => o.value === val);
                      display = o?.label || val;
                    }
                    if (c.type === 'priority') {
                      const o = PRIORITY_OPTIONS.find(o => o.value === val);
                      display = o?.label || val;
                    }
                    if (c.type === 'url') display = '🔗 bağlantı';
                    return (
                      <div key={c.id} style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                        <span style={{ opacity: 0.6 }}>{c.name}:</span> {display}
                      </div>
                    );
                  })}
                  <select
                    value={row.data?.[selectCol.id] || ''}
                    onChange={e => onSaveCell(row.id, selectCol.id, e.target.value)}
                    style={S.kanbanMove}
                  >
                    {baseOpts.map(o => (
                      <option key={o.value} value={o.value}>→ {o.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div style={{ ...S.kanbanCol, minWidth: 120, background: 'transparent' }}>
        <button style={S.addRowBtn} onClick={onAddRow}>+ Kart Ekle</button>
      </div>
    </div>
  );
}

// ── Takvim Görünümü ──────────────────────────────────────────────────
function CalendarView({ columns, rows, people }) {
  const dateCol = columns.find(c => c.type === 'date') || columns.find(c => c.type === 'daterange');
  const titleCol = columns.find(c => c.type === 'text') || columns[0];
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  if (!dateCol) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
        Takvim görünümü için bir <b>Tarih</b> sütunu ekleyin.
      </div>
    );
  }

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7; // pzt = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthStr = cursor.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  const prev = () => setCursor(new Date(year, month - 1, 1));
  const next = () => setCursor(new Date(year, month + 1, 1));

  const rowsByDay = {};
  rows.forEach(r => {
    const raw = r.data?.[dateCol.id];
    if (!raw) return;
    const d = typeof raw === 'object' ? raw.start : raw;
    if (d) {
      const key = d.substring(0, 10);
      if (!rowsByDay[key]) rowsByDay[key] = [];
      rowsByDay[key].push(r);
    }
  });

  const selectCol = columns.find(c => c.type === 'select');

  return (
    <div style={{ padding: 16 }}>
      <div style={S.calHead}>
        <button style={S.btnSecondary} onClick={prev}>‹</button>
        <div style={{ fontWeight: 700, fontSize: 16, textTransform: 'capitalize' }}>{monthStr}</div>
        <button style={S.btnSecondary} onClick={next}>›</button>
      </div>
      <div style={S.calGrid}>
        {['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'].map(d => (
          <div key={d} style={S.calDayHead}>{d}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} style={S.calCellEmpty} />;
          const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const events = rowsByDay[key] || [];
          const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();
          return (
            <div key={i} style={S.calCell}>
              <div style={{ fontSize: 11, fontWeight: isToday ? 800 : 500, color: isToday ? 'var(--navy, #1a3a5c)' : 'var(--text-muted)' }}>{d}</div>
              {events.map(ev => {
                const statusVal = selectCol && ev.data?.[selectCol.id];
                const opt = selectCol ? (selectCol.options || []).find(o => o.value === statusVal) : null;
                return (
                  <div
                    key={ev.id}
                    style={{
                      ...S.calEvent,
                      background: opt?.color || '#dbeafe',
                      color: opt?.text || '#1e40af',
                    }}
                    title={ev.data?.[titleCol?.id] || '—'}
                  >
                    {ev.data?.[titleCol?.id] || '—'}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Stiller ──────────────────────────────────────────────────────────
const S = {
  wrap: { display: 'flex', height: 'calc(100vh - 0px)', background: 'var(--bg-secondary)' },
  sidebar: {
    width: 280, minWidth: 220, maxWidth: 320, borderRight: '1px solid var(--border)',
    background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  sidebarHeader: { padding: '14px 16px', borderBottom: '1px solid var(--border)' },
  addRoot: {
    margin: '10px 12px', padding: '8px 10px', border: '1px dashed var(--border)',
    background: 'transparent', color: 'var(--text)', borderRadius: 8, cursor: 'pointer',
    fontSize: 13, fontWeight: 600,
  },
  tree: { flex: 1, overflowY: 'auto', padding: '4px 4px 60px' },
  empty: { padding: 20, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' },
  treeRow: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6,
    fontSize: 13, cursor: 'default',
  },
  chevron: { width: 14, display: 'inline-block', textAlign: 'center', fontSize: 10, opacity: 0.5, cursor: 'pointer' },
  treeMenu: { background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: 2 },
  treeInput: {
    flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4,
    padding: '2px 6px', fontSize: 13, color: 'var(--text)', outline: 'none',
  },
  menuPop: {
    position: 'absolute', top: '100%', right: 0, minWidth: 180,
    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
    boxShadow: '0 6px 24px rgba(0,0,0,0.18)', zIndex: 100, padding: 4,
  },
  menuItem: {
    display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
    padding: '8px 10px', borderRadius: 4, fontSize: 13, cursor: 'pointer', color: 'var(--text)',
  },
  iconPicker: {
    position: 'absolute', top: '110%', left: 0, zIndex: 100,
    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
    boxShadow: '0 6px 24px rgba(0,0,0,0.18)', padding: 6,
    display: 'grid', gridTemplateColumns: 'repeat(8, 28px)', gap: 2, width: 244,
  },
  iconBtn: {
    width: 28, height: 28, border: 'none', background: 'transparent', fontSize: 16,
    cursor: 'pointer', borderRadius: 4,
  },
  main: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  emptyMain: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    height: '100%', textAlign: 'center', color: 'var(--text)', padding: 40,
  },
  pageView: { maxWidth: 960, margin: '0 auto', padding: '32px 48px 80px' },
  pageViewFull: {
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    padding: 0, overflow: 'hidden',
  },
  pageHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
  pageHeaderCompact: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 20px', borderBottom: '1px solid var(--border)',
    background: 'var(--bg-card)', flexShrink: 0,
  },
  pageTitle: {
    flex: 1, fontSize: 34, fontWeight: 800, background: 'transparent', border: 'none',
    outline: 'none', color: 'var(--text)', padding: '4px 0',
  },
  pageTitleCompact: {
    flex: 1, fontSize: 22, fontWeight: 800, background: 'transparent', border: 'none',
    outline: 'none', color: 'var(--text)', padding: 0,
  },
  dbFull: {
    flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-card)',
    borderRadius: 0, border: 'none', overflow: 'hidden',
  },
  toolbar: {
    display: 'flex', gap: 4, padding: 6, marginBottom: 8,
    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
    position: 'sticky', top: 0, zIndex: 5,
  },
  tbBtn: {
    padding: '4px 10px', background: 'transparent', border: 'none', borderRadius: 4,
    cursor: 'pointer', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit',
  },
  tbSep: { width: 1, background: 'var(--border)', margin: '0 4px' },
  content: {
    minHeight: 200, padding: '12px 4px', fontSize: 15, lineHeight: 1.6, color: 'var(--text)',
    outline: 'none',
  },
  addDbBtn: {
    marginTop: 24, padding: '10px 14px', background: 'transparent', color: 'var(--text-muted)',
    border: '1px dashed var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  db: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 24, overflow: 'hidden' },
  dbHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 14px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8,
  },
  dbName: { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15 },
  dbNameInput: {
    fontSize: 15, fontWeight: 700, border: '1px solid var(--border)', borderRadius: 6,
    padding: '4px 8px', background: 'var(--bg-secondary)', color: 'var(--text)', outline: 'none',
  },
  viewSwitcher: { display: 'flex', gap: 4, alignItems: 'center' },
  viewBtn: {
    padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 6,
    cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text)',
  },
  dbDelBtn: {
    padding: '5px 8px', background: 'transparent', border: 'none',
    color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14,
  },
  tvToolbar: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
    borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)',
  },
  tvSelect: {
    padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6,
    background: 'var(--bg-card)', color: 'var(--text)', fontSize: 12, fontWeight: 600, outline: 'none',
  },
  groupHead: {
    padding: '10px 14px', fontWeight: 700, fontSize: 13,
    borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left', padding: '8px 12px', background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)', fontWeight: 600, color: 'var(--text-muted)',
    position: 'relative',
  },
  colHeader: { display: 'flex', alignItems: 'center', gap: 4 },
  colMenu: { background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 },
  colNameInput: {
    width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 4, padding: '4px 6px', fontSize: 13, color: 'var(--text)',
    outline: 'none', fontWeight: 600,
  },
  colAddCompact: {
    width: 26, height: 26, background: 'transparent', border: '1px dashed var(--border)',
    borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14,
  },
  tr: { borderBottom: '1px solid var(--border)' },
  td: { padding: '4px 8px', verticalAlign: 'middle' },
  tdFooter: { padding: '8px 12px', textAlign: 'left', background: 'var(--bg-secondary)' },
  cellInput: {
    width: '100%', background: 'transparent', border: 'none', padding: '6px 6px',
    fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
  },
  rowDel: {
    background: 'transparent', border: 'none', color: 'var(--text-muted)',
    cursor: 'pointer', fontSize: 16, padding: 2,
  },
  addRowBtn: {
    padding: '6px 12px', background: 'transparent', border: 'none',
    color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  btnPrimary: {
    padding: '6px 14px', background: 'var(--navy, #1a3a5c)', color: '#fff',
    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  btnSecondary: {
    padding: '6px 14px', background: 'transparent', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  modalBackdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    background: 'var(--bg-card)', borderRadius: 12, width: 440, maxWidth: '92vw',
    border: '1px solid var(--border)', boxShadow: '0 12px 48px rgba(0,0,0,0.25)',
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)' },
  modalClose: { background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)' },
  modalFooter: { display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid var(--border)' },
  optRow: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 },
  optInput: {
    flex: 1, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6,
    fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text)', outline: 'none',
  },
  colorDots: { display: 'flex', gap: 3 },
  colorDot: { width: 18, height: 18, borderRadius: '50%', cursor: 'pointer' },
  optDel: { background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: 4 },
  kanbanWrap: { display: 'flex', gap: 12, padding: 14, overflowX: 'auto', minHeight: 320 },
  kanbanCol: { minWidth: 240, maxWidth: 280, background: 'var(--bg-secondary)', borderRadius: 8, display: 'flex', flexDirection: 'column', maxHeight: 600 },
  kanbanHead: { padding: '8px 12px', fontWeight: 700, fontSize: 13, borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between' },
  kanbanBody: { padding: 8, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 },
  kanbanCard: {
    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6,
    padding: 10, fontSize: 13,
  },
  kanbanMove: {
    marginTop: 8, width: '100%', padding: '3px 4px', fontSize: 11,
    background: 'transparent', border: '1px solid var(--border)', borderRadius: 4,
    color: 'var(--text-muted)', outline: 'none',
  },
  calHead: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginBottom: 12 },
  calGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 },
  calDayHead: { padding: 6, textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' },
  calCell: {
    minHeight: 90, padding: 6, background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 2,
  },
  calCellEmpty: { minHeight: 90, background: 'transparent' },
  calEvent: {
    padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
};
