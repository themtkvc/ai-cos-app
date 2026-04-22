import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  getCollaborations, createCollaboration, updateCollaboration, deleteCollaboration,
  uploadCollabImage, deleteCollabImage,
  uploadDocumentToDrive, deleteDocumentFromDrive,
  validateUploadFile, MAX_DOCUMENT_BYTES,
  getCollabLookups,
  bulkUpdateCollaborations, bulkDeleteCollaborations,
  createNetworkOrg,
  getCollabCompletionReport,
  COLLAB_TYPES, COLLAB_STATUSES, COLLAB_PARTNER_ROLES, COLLAB_MOU_STATUSES,
  DEFAULT_COLLAB_PAGE_LIMIT,
} from '../lib/supabase';
import { UNITS, resolveUnitName, fmtDisplayDate } from '../lib/constants';
import CompletionReportModal from '../components/CompletionReportModal';

// ── Drive dosya yardımcıları ────────────────────────────────────────────────
const ATTACH_FILE_ICONS = {
  pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗',
  ppt: '📙', pptx: '📙', png: '🖼', jpg: '🖼', jpeg: '🖼',
  gif: '🖼', webp: '🖼', svg: '🖼', txt: '📃', csv: '📊',
  zip: '🗜', rar: '🗜',
};
const attachIcon = (name = '') => {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return ATTACH_FILE_ICONS[ext] || '📎';
};
const formatFileSize = (bytes) => {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

// ── Yardımcılar ──────────────────────────────────────────────────────────────
const typeObj   = (id) => COLLAB_TYPES.find(t => t.id === id);
const statusObj = (id) => COLLAB_STATUSES.find(s => s.id === id);
const unitObj   = (name) => UNITS.find(u => u.name === resolveUnitName(name));

function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)    return `${Math.round(diff)} sn önce`;
  if (diff < 3600)  return `${Math.round(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.round(diff / 3600)} saat önce`;
  if (diff < 604800) return `${Math.round(diff / 86400)} gün önce`;
  return d.toLocaleDateString('tr-TR');
}

function canEdit(row, profile) {
  if (!profile || !row) return false;
  if (row.owner_id && profile.user_id && row.owner_id === profile.user_id) return true;
  if (profile.role === 'direktor' || profile.role === 'direktor_yardimcisi') return true;
  if (profile.role === 'koordinator' && resolveUnitName(profile.unit) === resolveUnitName(row.unit)) return true;
  return false;
}

// ── Ana Sayfa ────────────────────────────────────────────────────────────────
export default function Collaborations({ user, profile, onNavigate, editCollabId, onClearEditCollab }) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [viewMode, setViewMode]       = useState('cards'); // cards | list | by-unit | by-partner | by-type
  const [typeFilter, setTypeFilter]   = useState('all');
  const [unitFilter, setUnitFilter]   = useState('all');
  const [partnerFilter, setPartnerFilter] = useState('all');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState(null); // {} or {unit: 'X'} for new, row for edit
  const [viewId, setViewId]   = useState(null);
  const [toast, setToast]     = useState('');
  const [lookups, setLookups] = useState({ organizations: [], users: [], fundOpportunities: [], events: [] });

  // Tamamlandı olarak işaretlenen işbirlikleri için sonuç raporu modal'ı
  const [completionCtx, setCompletionCtx] = useState(null); // { collab, existingReport }

  // Bulk action mode
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  // Pagination
  const [limit, setLimit] = useState(DEFAULT_COLLAB_PAGE_LIMIT || 100);
  const [totalCount, setTotalCount] = useState(null);

  const load = async (overrideLimit) => {
    setLoading(true); setError('');
    try {
      const { data, error, count } = await getCollaborations({
        limit: overrideLimit || limit,
        offset: 0,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      if (error) throw error;
      setRows(data || []);
      setTotalCount(typeof count === 'number' ? count : null);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    const newLimit = (limit || DEFAULT_COLLAB_PAGE_LIMIT || 100) + (DEFAULT_COLLAB_PAGE_LIMIT || 100);
    setLimit(newLimit);
    await load(newLimit);
  };

  useEffect(() => {
    load();
    getCollabLookups().then(res => {
      if (!res.error) setLookups({
        organizations: res.organizations,
        users: res.users,
        fundOpportunities: res.fundOpportunities,
        events: res.events,
      });
    });
  }, []);

  // Date range değişince yeniden yükle
  useEffect(() => {
    const t = setTimeout(() => { load(); }, 250);
    return () => clearTimeout(t);
  }, [dateFrom, dateTo]);

  // Auto-open edit modal when editCollabId arrives via prop
  useEffect(() => {
    if (!editCollabId) return;
    const found = rows.find(r => r.id === editCollabId);
    if (found) {
      setEditing(found);
      if (typeof onClearEditCollab === 'function') onClearEditCollab();
    }
  }, [editCollabId, rows, onClearEditCollab]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (typeFilter !== 'all'    && r.type !== typeFilter) return false;
      if (unitFilter !== 'all'    && resolveUnitName(r.unit) !== unitFilter) return false;
      if (partnerFilter !== 'all' && (r.partner_name || '(Partnersiz)') !== partnerFilter) return false;
      if (statusFilter === 'active') {
        if (['tamamlandi', 'iptal'].includes(r.status)) return false;
      } else if (statusFilter !== 'all') {
        if (r.status !== statusFilter) return false;
      }
      if (q) {
        const hay = `${r.title || ''} ${r.description || ''} ${r.partner_name || ''} ${r.owner_name || ''} ${(r.tags || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, typeFilter, unitFilter, partnerFilter, statusFilter, search]);

  const counts = useMemo(() => {
    const c = { total: rows.length, active: 0 };
    COLLAB_STATUSES.forEach(s => { c[s.id] = 0; });
    rows.forEach(r => {
      c[r.status] = (c[r.status] || 0) + 1;
      if (!['tamamlandi', 'iptal'].includes(r.status)) c.active += 1;
    });
    return c;
  }, [rows]);

  const partnerOptions = useMemo(() => {
    const s = new Set();
    rows.forEach(r => s.add(r.partner_name || '(Partnersiz)'));
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [rows]);

  const viewing = rows.find(r => r.id === viewId);

  const handleSaved = (next, { isNew } = {}) => {
    const prev = rows.find(x => x.id === next.id);
    const becameCompleted =
      next.status === 'tamamlandi' && (isNew || prev?.status !== 'tamamlandi');

    setRows(xs => {
      const idx = xs.findIndex(x => x.id === next.id);
      if (idx >= 0) { const n = xs.slice(); n[idx] = next; return n; }
      return [next, ...xs];
    });
    setEditing(null);

    // Kayıt, mevcut filtrede görünmüyorsa filtreyi aç ki kullanıcı göstersin:
    // - Durum 'tamamlandi'/'iptal' ise 'active' filtresi gizler → 'all' yap
    // - Farklı birim / farklı tür / farklı partner ise → o filtreyi 'all' yap
    const willBeHidden =
      (statusFilter === 'active' && ['tamamlandi', 'iptal'].includes(next.status)) ||
      (statusFilter !== 'active' && statusFilter !== 'all' && statusFilter !== next.status);
    if (willBeHidden) setStatusFilter('all');
    if (typeFilter !== 'all' && typeFilter !== next.type) setTypeFilter('all');
    if (unitFilter !== 'all' && unitFilter !== resolveUnitName(next.unit)) setUnitFilter('all');
    const partnerKey = next.partner_name || '(Partnersiz)';
    if (partnerFilter !== 'all' && partnerFilter !== partnerKey) setPartnerFilter('all');

    setToast(isNew ? '✅ İşbirliği oluşturuldu' : '✅ Değişiklik kaydedildi');
    setTimeout(() => setToast(''), 2800);

    // Tamamlandı'ya geçildiyse sonuç raporu modal'ını aç
    // (mevcut rapor varsa edit modunda, yoksa yeni giriş için)
    if (becameCompleted) {
      (async () => {
        const { data: report } = await getCollabCompletionReport(next.id);
        setCompletionCtx({ collab: next, existingReport: report || null });
      })();
    }
  };

  const openCompletionReport = async (collab) => {
    if (!collab?.id) return;
    const { data: report } = await getCollabCompletionReport(collab.id);
    setCompletionCtx({ collab, existingReport: report || null });
  };

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🤝 İşbirlikleri</div>
          <div style={{ fontSize: 13, opacity: 0.7 }}>
            Tüm birimlerin ortak projeleri, etkinlikleri, fonları ve araştırmaları. Toplam {counts.total} · {counts.active} aktif.
          </div>
        </div>
        <button
          onClick={() => setEditing({})}
          style={{
            padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            border: 'none', background: 'var(--navy, #1a3a5c)', color: '#fff',
          }}
        >＋ Yeni İşbirliği</button>
      </div>

      {/* View mode tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.6, marginRight: 4 }}>GÖRÜNÜM:</span>
        <ViewChip active={viewMode === 'cards'}      onClick={() => setViewMode('cards')}      label="🎴 Kart" />
        <ViewChip active={viewMode === 'list'}       onClick={() => setViewMode('list')}       label="📋 Liste" />
        <ViewChip active={viewMode === 'by-unit'}    onClick={() => setViewMode('by-unit')}    label="🏛 Birim Bazlı" />
        <ViewChip active={viewMode === 'by-partner'} onClick={() => setViewMode('by-partner')} label="🤝 Kurum Bazlı" />
        <ViewChip active={viewMode === 'by-type'}    onClick={() => setViewMode('by-type')}    label="🗂 Tür Bazlı" />
        <span style={{ flex: 1 }} />
        <button
          onClick={() => { setBulkMode(v => !v); setSelectedIds(new Set()); }}
          style={{
            padding: '6px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: `1.5px solid ${bulkMode ? '#dc2626' : 'var(--border, rgba(0,0,0,0.15))'}`,
            background: bulkMode ? '#dc2626' : 'var(--bg, #fff)',
            color: bulkMode ? '#fff' : 'inherit',
          }}
        >{bulkMode ? '✕ Seçimi Kapat' : '☑ Toplu Seçim'}</button>
        <button
          onClick={() => exportCollabsToCSV(filtered)}
          title="Filtrelenmiş kayıtları CSV olarak indir"
          style={{
            padding: '6px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
            background: 'var(--bg, #fff)', color: 'inherit',
          }}
        >📥 CSV</button>
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <FilterChip active={statusFilter === 'active'} onClick={() => setStatusFilter('active')} label={`Aktif (${counts.active})`} />
        <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} label={`Tümü (${counts.total})`} />
        {COLLAB_STATUSES.map(s => (
          <FilterChip
            key={s.id}
            active={statusFilter === s.id}
            onClick={() => setStatusFilter(s.id)}
            label={`${s.label} (${counts[s.id] || 0})`}
            color={s.color}
          />
        ))}
      </div>

      {/* Type/unit/partner + search */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={selStyle}>
          <option value="all">Tüm türler</option>
          {COLLAB_TYPES.map(t => (<option key={t.id} value={t.id}>{t.icon} {t.label}</option>))}
        </select>
        <select value={unitFilter} onChange={e => setUnitFilter(e.target.value)} style={selStyle}>
          <option value="all">Tüm birimler</option>
          {UNITS.map(u => (<option key={u.name} value={u.name}>{u.icon} {u.name}</option>))}
        </select>
        <select value={partnerFilter} onChange={e => setPartnerFilter(e.target.value)} style={selStyle}>
          <option value="all">Tüm kurumlar</option>
          {partnerOptions.map(p => (<option key={p} value={p}>{p}</option>))}
        </select>
        <input
          type="search"
          placeholder="🔎 Ara (başlık, açıklama, partner, etiket…)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 220, padding: '7px 11px', borderRadius: 7, fontSize: 13,
            border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
            background: 'var(--bg, #fff)', color: 'inherit', outline: 'none',
          }}
        />
        <button onClick={() => load()} style={selStyle}>🔄 Yenile</button>
      </div>

      {/* Tarih aralığı filtresi */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.6 }}>TARİH ARALIĞI:</span>
        <input
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          style={{ ...selStyle, padding: '6px 10px' }}
          title="Başlangıç tarihi ≥"
        />
        <span style={{ fontSize: 12, opacity: 0.5 }}>→</span>
        <input
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          style={{ ...selStyle, padding: '6px 10px' }}
          title="Bitiş tarihi ≤"
        />
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo(''); }}
            style={{
              padding: '6px 10px', borderRadius: 7, fontSize: 11.5, cursor: 'pointer',
              border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
              background: 'transparent', color: 'inherit',
            }}
          >✕ Temizle</button>
        )}
        {totalCount != null && (
          <span style={{ marginLeft: 'auto', fontSize: 11.5, opacity: 0.6 }}>
            {rows.length} / {totalCount} kayıt yüklü
          </span>
        )}
      </div>

      {/* Toplu seçim araç çubuğu */}
      {bulkMode && (
        <BulkBar
          selectedIds={selectedIds}
          allFiltered={filtered}
          onSelectAll={() => setSelectedIds(new Set(filtered.map(r => r.id)))}
          onClear={() => setSelectedIds(new Set())}
          onBulkStatus={async (newStatus) => {
            if (!selectedIds.size) return;
            if (!window.confirm(`${selectedIds.size} kayda "${newStatus}" durumu uygulanacak. Onaylıyor musunuz?`)) return;
            const { error } = await bulkUpdateCollaborations([...selectedIds], { status: newStatus });
            if (error) return alert('Güncellenemedi: ' + error.message);
            setToast(`✅ ${selectedIds.size} kayıt güncellendi`);
            setTimeout(() => setToast(''), 2800);
            setSelectedIds(new Set());
            load();
          }}
          onBulkDelete={async () => {
            if (!selectedIds.size) return;
            if (!window.confirm(`${selectedIds.size} kayıt KALICI silinecek. Emin misiniz?`)) return;
            const { error } = await bulkDeleteCollaborations([...selectedIds]);
            if (error) return alert('Silinemedi: ' + error.message);
            setToast(`🗑 ${selectedIds.size} kayıt silindi`);
            setTimeout(() => setToast(''), 2800);
            setSelectedIds(new Set());
            load();
          }}
          onBulkExport={() => {
            const rowsToExport = filtered.filter(r => selectedIds.has(r.id));
            exportCollabsToCSV(rowsToExport);
          }}
        />
      )}

      {error && (
        <div style={{
          padding: 12, borderRadius: 8, marginBottom: 14,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#dc2626', fontSize: 13,
        }}>⚠️ {error}</div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', opacity: 0.6 }}>Yükleniyor…</div>
      ) : (
        <>
          {viewMode === 'cards'      && <CardsView      rows={filtered} onOpen={(id) => setViewId(id)} bulkMode={bulkMode} selectedIds={selectedIds} onToggleSelect={(id) => toggleSelect(selectedIds, setSelectedIds, id)} />}
          {viewMode === 'list'       && <ListView       rows={filtered} onOpen={(id) => setViewId(id)} bulkMode={bulkMode} selectedIds={selectedIds} onToggleSelect={(id) => toggleSelect(selectedIds, setSelectedIds, id)} />}
          {viewMode === 'by-unit'    && <ByUnitView     rows={filtered} onOpen={(id) => setViewId(id)}
                                                         onAddForUnit={(unitName) => setEditing({ _unitPrefill: unitName })} />}
          {viewMode === 'by-partner' && <ByPartnerView  rows={filtered} onOpen={(id) => setViewId(id)} />}
          {viewMode === 'by-type'    && <ByTypeView     rows={filtered} onOpen={(id) => setViewId(id)} />}

          {/* Pagination */}
          {totalCount != null && rows.length < totalCount && (
            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={loadMore}
                disabled={loading}
                style={{
                  padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  border: '1.5px solid var(--navy, #1a3a5c)', color: 'var(--navy, #1a3a5c)',
                  background: 'transparent',
                }}
              >↓ Daha Fazla Yükle ({totalCount - rows.length} kayıt daha)</button>
            </div>
          )}
        </>
      )}

      {editing !== null && (
        <CollabModal
          row={editing}
          profile={profile}
          user={user}
          lookups={lookups}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
          onOrgCreated={(org) => {
            setLookups(prev => ({
              ...prev,
              organizations: [org, ...(prev.organizations || [])]
                .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr')),
            }));
          }}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 11000, padding: '10px 18px', borderRadius: 10,
          background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 700,
          boxShadow: '0 10px 30px rgba(22,163,74,0.35)',
        }}>{toast}</div>
      )}

      {viewing && (
        <CollabDetailModal
          row={viewing}
          profile={profile}
          lookups={lookups}
          onClose={() => setViewId(null)}
          onEdit={() => { setViewId(null); setEditing(viewing); }}
          onOpenCompletion={() => openCompletionReport(viewing)}
          onOpenFullPage={onNavigate ? () => {
            const id = viewing.id;
            setViewId(null);
            onNavigate('collaborations', { collabId: id });
          } : null}
          onDeleted={() => {
            setRows(xs => xs.filter(x => x.id !== viewing.id));
            setViewId(null);
          }}
        />
      )}

      {completionCtx && completionCtx.collab && (
        <CompletionReportModal
          collaboration={completionCtx.collab}
          existingReport={completionCtx.existingReport}
          submittedBy={{
            user_id: user?.id || profile?.user_id,
            full_name: profile?.full_name || user?.email || '',
          }}
          onSaved={(saved) => {
            setCompletionCtx(null);
            setToast(saved?.id ? '✅ Sonuç raporu kaydedildi' : '✅ Kaydedildi');
            setTimeout(() => setToast(''), 2800);
          }}
          onClose={() => setCompletionCtx(null)}
        />
      )}
    </div>
  );
}

// ── Bulk toggle helper + CSV export ──────────────────────────────────────────
function toggleSelect(selectedIds, setSelectedIds, id) {
  setSelectedIds(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
}

function exportCollabsToCSV(rows) {
  if (!rows || !rows.length) {
    alert('Dışa aktarılacak kayıt yok');
    return;
  }
  const headers = [
    'ID', 'Başlık', 'Tür', 'Birim', 'Durum',
    'Partner', 'Partner Rolü', 'Sorumlu',
    'Başlangıç', 'Bitiş', 'Bütçe', 'Para Birimi',
    'MoU Durum', 'MoU Bitiş',
    'Hedef Beneficiary', 'Ulaşılan',
    'Konum', 'Etiketler', 'Oluşturulma',
  ];
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[,"\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [headers.join(',')];
  rows.forEach(r => {
    const t = COLLAB_TYPES.find(x => x.id === r.type);
    const s = COLLAB_STATUSES.find(x => x.id === r.status);
    lines.push([
      r.id, r.title, t?.label || r.type, r.unit, s?.label || r.status,
      r.partner_name, r.partner_role,
      r.owner_name,
      r.start_date, r.end_date, r.budget_amount, r.budget_currency,
      r.mou_status, r.mou_expires_at,
      r.target_beneficiaries, r.reached_beneficiaries,
      r.location, (r.tags || []).join('; '), r.created_at,
    ].map(esc).join(','));
  });
  const csv = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `isbirlikleri-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function BulkBar({ selectedIds, allFiltered, onSelectAll, onClear, onBulkStatus, onBulkDelete, onBulkExport }) {
  const count = selectedIds.size;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      padding: '10px 14px', borderRadius: 10, marginBottom: 12,
      background: 'linear-gradient(90deg, rgba(26,58,92,0.08), rgba(99,102,241,0.05))',
      border: '1.5px solid rgba(26,58,92,0.25)',
    }}>
      <span style={{ fontSize: 13, fontWeight: 700 }}>
        {count === 0 ? 'Hiçbir kayıt seçilmedi' : `${count} kayıt seçildi`}
      </span>
      <button onClick={onSelectAll} style={bulkBtn()}>
        Tümünü Seç ({allFiltered.length})
      </button>
      {count > 0 && <button onClick={onClear} style={bulkBtn()}>Seçimi Kaldır</button>}
      <span style={{ flex: 1 }} />
      {count > 0 && (
        <>
          <select
            onChange={e => { if (e.target.value) { onBulkStatus(e.target.value); e.target.value = ''; } }}
            style={{ ...bulkBtn(), padding: '6px 10px' }}
          >
            <option value="">Durum değiştir…</option>
            {COLLAB_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button onClick={onBulkExport} style={bulkBtn()}>📥 CSV</button>
          <button onClick={onBulkDelete} style={{ ...bulkBtn(), borderColor: '#dc2626', color: '#dc2626' }}>🗑 Sil</button>
        </>
      )}
    </div>
  );
}
function bulkBtn() {
  return {
    padding: '6px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    border: '1.5px solid var(--border, rgba(0,0,0,0.2))',
    background: 'var(--bg, #fff)', color: 'inherit',
  };
}

// ── Ortak stiller ────────────────────────────────────────────────────────────
const selStyle = {
  padding: '7px 11px', borderRadius: 7, fontSize: 12.5,
  border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
  background: 'var(--bg, #fff)', color: 'inherit', cursor: 'pointer',
};

function ViewChip({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 11px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        border: `1.5px solid ${active ? 'var(--navy, #1a3a5c)' : 'var(--border, rgba(0,0,0,0.15))'}`,
        background: active ? 'var(--navy, #1a3a5c)' : 'var(--bg, #fff)',
        color: active ? '#fff' : 'inherit',
      }}
    >{label}</button>
  );
}

function FilterChip({ active, onClick, label, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        border: `1.5px solid ${active ? (color || 'var(--navy, #1a3a5c)') : 'var(--border, rgba(0,0,0,0.15))'}`,
        background: active ? (color || 'var(--navy, #1a3a5c)') : 'var(--bg, #fff)',
        color: active ? '#fff' : 'inherit',
      }}
    >{label}</button>
  );
}

// ── Görünümler ───────────────────────────────────────────────────────────────
function EmptyState({ message }) {
  return (
    <div style={{
      padding: 40, textAlign: 'center',
      background: 'var(--bg-soft, rgba(0,0,0,0.02))',
      borderRadius: 12, border: '1px dashed var(--border, rgba(0,0,0,0.12))',
    }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>🤷</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{message}</div>
    </div>
  );
}

function CardsView({ rows, onOpen, bulkMode, selectedIds, onToggleSelect }) {
  if (rows.length === 0) return <EmptyState message="Bu filtreye uyan işbirliği yok" />;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
      {rows.map(r => (
        <CollabCard
          key={r.id}
          row={r}
          onOpen={() => onOpen(r.id)}
          bulkMode={bulkMode}
          selected={selectedIds?.has(r.id)}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}

function ListView({ rows, onOpen, bulkMode, selectedIds, onToggleSelect }) {
  if (rows.length === 0) return <EmptyState message="Bu filtreye uyan işbirliği yok" />;
  return (
    <div style={{
      background: 'var(--bg, #fff)',
      border: '1.5px solid var(--border, rgba(0,0,0,0.12))',
      borderRadius: 12, overflow: 'hidden',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1.8fr 0.9fr 1.3fr 1.3fr 0.9fr 1fr',
        padding: '10px 14px', fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', opacity: 0.6,
        background: 'var(--bg-soft, rgba(0,0,0,0.03))',
        borderBottom: '1.5px solid var(--border, rgba(0,0,0,0.08))',
      }}>
        <div>BAŞLIK</div><div>TÜR</div><div>BİRİM</div><div>PARTNER</div><div>DURUM</div><div>TARİH</div>
      </div>
      {rows.map(r => {
        const t = typeObj(r.type);
        const s = statusObj(r.status);
        const u = unitObj(r.unit);
        const checked = selectedIds?.has(r.id);
        return (
          <div
            key={r.id}
            onClick={(ev) => {
              if (bulkMode) { ev.stopPropagation(); onToggleSelect && onToggleSelect(r.id); return; }
              onOpen(r.id);
            }}
            style={{
              display: 'grid', gridTemplateColumns: '1.8fr 0.9fr 1.3fr 1.3fr 0.9fr 1fr',
              padding: '12px 14px', fontSize: 13, cursor: 'pointer', alignItems: 'center',
              borderBottom: '1px solid var(--border, rgba(0,0,0,0.06))',
              background: checked ? 'rgba(26,58,92,0.08)' : 'transparent',
            }}
            onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'var(--bg-soft, rgba(0,0,0,0.02))'; }}
            onMouseLeave={e => { e.currentTarget.style.background = checked ? 'rgba(26,58,92,0.08)' : 'transparent'; }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
              {bulkMode && (
                <input
                  type="checkbox"
                  checked={!!checked}
                  onChange={() => onToggleSelect && onToggleSelect(r.id)}
                  onClick={e => e.stopPropagation()}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
              )}
              {r.image_url && (
                <img src={r.image_url} alt="" style={{
                  width: 32, height: 32, objectFit: 'cover', borderRadius: 6, flexShrink: 0,
                }} />
              )}
              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.title}
              </span>
            </div>
            <div>{t && <span style={{ fontSize: 11.5, fontWeight: 600, color: t.color }}>{t.icon} {t.label}</span>}</div>
            <div>{u && <span style={{ fontSize: 12, fontWeight: 600, color: u.color }}>{u.icon} {u.name}</span>}</div>
            <div style={{ fontSize: 12, opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.partner_name || '—'}
            </div>
            <div>{s && <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 10,
              background: `${s.color}20`, color: s.color,
            }}>{s.label}</span>}</div>
            <div style={{ fontSize: 11.5, opacity: 0.7 }}>
              {r.start_date ? fmtDisplayDate(r.start_date) : timeAgo(r.created_at)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ByUnitView({ rows, onOpen, onAddForUnit }) {
  // Sırala UNITS'in sırasına göre + kayıtlarda olan ama UNITS'te yer almayan birim için ek
  const groups = useMemo(() => {
    const map = new Map();
    UNITS.forEach(u => map.set(u.name, []));
    rows.forEach(r => {
      const name = resolveUnitName(r.unit) || '— Birimsiz —';
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(r);
    });
    return Array.from(map.entries()); // [[unitName, rows[]], …]
  }, [rows]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {groups.map(([unitName, list]) => {
        const u = unitObj(unitName);
        const color = u?.color || '#6366f1';
        const icon  = u?.icon  || '🏛';
        return (
          <div
            key={unitName}
            style={{
              borderRadius: 14,
              background: `linear-gradient(180deg, ${color}0c 0%, transparent 80px)`,
              border: `1.5px solid ${color}33`,
              padding: 14,
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
              paddingBottom: 10, borderBottom: `1.5px dashed ${color}33`,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 20,
                background: `${color}20`, color,
              }}>{icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color }}>{unitName}</div>
                <div style={{ fontSize: 12, opacity: 0.65 }}>{list.length} işbirliği</div>
              </div>
              <button
                onClick={() => onAddForUnit(unitName)}
                style={{
                  padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  border: `1.5px solid ${color}60`, color, background: 'transparent',
                }}
              >＋ İşbirliği Ekle</button>
            </div>

            {list.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 13, opacity: 0.55 }}>
                Bu birime ait işbirliği yok. Sağ üstten ekleyebilirsiniz.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                {list.map(r => <CollabCard key={r.id} row={r} onOpen={() => onOpen(r.id)} compact />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ByPartnerView({ rows, onOpen }) {
  const groups = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      const key = r.partner_name?.trim() || '— Partnersiz —';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [rows]);

  if (groups.length === 0) return <EmptyState message="Bu filtreye uyan işbirliği yok" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {groups.map(([partnerName, list]) => {
        const first = list.find(r => r.partner_website || r.partner_email || r.partner_contact_person) || list[0];
        return (
          <div
            key={partnerName}
            style={{
              borderRadius: 14,
              background: 'var(--bg, #fff)',
              border: '1.5px solid var(--border, rgba(0,0,0,0.12))',
              padding: 14,
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap',
              paddingBottom: 10, borderBottom: '1.5px dashed var(--border, rgba(0,0,0,0.12))',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 20,
                background: 'rgba(99,102,241,0.12)', color: '#6366f1',
              }}>🤝</div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800 }}>{partnerName}</div>
                <div style={{ fontSize: 12, opacity: 0.65 }}>
                  {list.length} işbirliği
                  {first?.partner_contact_person && ` · 👤 ${first.partner_contact_person}`}
                </div>
              </div>
              {first?.partner_email && (
                <a href={`mailto:${first.partner_email}`} style={{
                  fontSize: 12, color: 'var(--navy, #1a3a5c)', textDecoration: 'none',
                  padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border, rgba(0,0,0,0.12))',
                }}>✉️ {first.partner_email}</a>
              )}
              {first?.partner_website && (
                <a href={first.partner_website} target="_blank" rel="noreferrer" style={{
                  fontSize: 12, color: 'var(--navy, #1a3a5c)', textDecoration: 'none',
                  padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border, rgba(0,0,0,0.12))',
                }}>🔗 Web</a>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {list.map(r => <CollabCard key={r.id} row={r} onOpen={() => onOpen(r.id)} compact />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ByTypeView({ rows, onOpen }) {
  const groups = useMemo(() => {
    const map = new Map();
    COLLAB_TYPES.forEach(t => map.set(t.id, []));
    rows.forEach(r => {
      const k = r.type || 'diger';
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    });
    return Array.from(map.entries()).filter(([, list]) => list.length > 0);
  }, [rows]);

  if (groups.length === 0) return <EmptyState message="Bu filtreye uyan işbirliği yok" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {groups.map(([typeId, list]) => {
        const t = typeObj(typeId);
        const color = t?.color || '#6366f1';
        const icon = t?.icon || '🏷';
        const label = t?.label || typeId;
        return (
          <div
            key={typeId}
            style={{
              borderRadius: 14,
              background: `linear-gradient(180deg, ${color}0c 0%, transparent 80px)`,
              border: `1.5px solid ${color}33`,
              padding: 14,
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
              paddingBottom: 10, borderBottom: `1.5px dashed ${color}33`,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 20,
                background: `${color}20`, color,
              }}>{icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color }}>{label}</div>
                <div style={{ fontSize: 12, opacity: 0.65 }}>{list.length} işbirliği</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {list.map(r => <CollabCard key={r.id} row={r} onOpen={() => onOpen(r.id)} compact />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Kart ─────────────────────────────────────────────────────────────────────
function formatBudget(row) {
  if (row.budget_amount == null || row.budget_amount === '') return null;
  const cur = row.budget_currency || 'TRY';
  const sym = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' }[cur] || cur;
  const n = Number(row.budget_amount);
  if (!Number.isFinite(n)) return null;
  return `${sym}${n.toLocaleString('tr-TR')}`;
}

function formatDateRange(row) {
  if (!row.start_date && !row.end_date) return null;
  if (row.start_date && row.end_date && row.start_date !== row.end_date) {
    return `${fmtDisplayDate(row.start_date)} → ${fmtDisplayDate(row.end_date)}`;
  }
  return fmtDisplayDate(row.start_date || row.end_date);
}

function CollabCard({ row, onOpen, compact = false, bulkMode = false, selected = false, onToggleSelect }) {
  const t = typeObj(row.type);
  const s = statusObj(row.status);
  const u = unitObj(row.unit);
  const budget = formatBudget(row);
  const dateStr = formatDateRange(row);
  const attachCount = Array.isArray(row.attachments) ? row.attachments.length : 0;
  return (
    <div
      onClick={(ev) => {
        if (bulkMode) { ev.stopPropagation(); onToggleSelect && onToggleSelect(row.id); return; }
        onOpen();
      }}
      style={{
        padding: 0, borderRadius: 12, cursor: 'pointer', overflow: 'hidden',
        background: 'var(--bg, #fff)',
        border: `1.5px solid ${selected ? 'var(--navy, #1a3a5c)' : 'var(--border, rgba(0,0,0,0.12))'}`,
        boxShadow: selected ? '0 0 0 3px rgba(26,58,92,0.15)' : 'none',
        transition: 'transform .1s ease, box-shadow .1s ease',
        display: 'flex', flexDirection: 'column', position: 'relative',
      }}
      onMouseEnter={e => { if (!bulkMode) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'; } }}
      onMouseLeave={e => { if (!bulkMode) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = selected ? '0 0 0 3px rgba(26,58,92,0.15)' : 'none'; } }}
    >
      {bulkMode && (
        <div style={{
          position: 'absolute', top: 8, left: 8, zIndex: 2,
          background: 'rgba(255,255,255,0.95)', borderRadius: 6, padding: '2px 4px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        }}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect && onToggleSelect(row.id)}
            onClick={e => e.stopPropagation()}
            style={{ width: 16, height: 16, cursor: 'pointer', margin: 0 }}
          />
        </div>
      )}
      {row.image_url ? (
        <div style={{
          width: '100%', height: compact ? 110 : 140, overflow: 'hidden',
          background: 'var(--bg-soft, rgba(0,0,0,0.04))',
        }}>
          <img src={row.image_url} alt="" style={{
            width: '100%', height: '100%', objectFit: 'cover', display: 'block',
          }} />
        </div>
      ) : (
        <div style={{
          width: '100%', height: compact ? 0 : 6,
          background: t ? `linear-gradient(90deg, ${t.color}, ${t.color}80)` : 'transparent',
        }} />
      )}
      <div style={{ padding: compact ? 12 : 14, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {t && (
            <span style={{
              fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 10,
              background: `${t.color}20`, color: t.color,
            }}>{t.icon} {t.label}</span>
          )}
          {s && (
            <span style={{
              fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 10,
              background: `${s.color}20`, color: s.color,
            }}>{s.label}</span>
          )}
        </div>
        <div style={{ fontSize: compact ? 14 : 15, fontWeight: 700, lineHeight: 1.3 }}>{row.title}</div>
        {!compact && row.partner_name && (
          <div style={{ fontSize: 12.5, opacity: 0.85 }}>
            🤝 <b>Partner:</b> {row.partner_name}
          </div>
        )}
        {u && (
          <div style={{ fontSize: 11.5, opacity: 0.85 }}>
            {u.icon} <span style={{ color: u.color, fontWeight: 600 }}>{u.name}</span>
          </div>
        )}

        {/* Meta bilgileri: bütçe, tarih, konum */}
        {(budget || dateStr || row.location || attachCount > 0) && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2,
          }}>
            {budget && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 7px', borderRadius: 8,
                background: 'rgba(22,163,74,0.12)', color: '#15803d',
              }}>💰 {budget}</span>
            )}
            {dateStr && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '3px 7px', borderRadius: 8,
                background: 'rgba(37,99,235,0.1)', color: '#1d4ed8',
              }}>📅 {dateStr}</span>
            )}
            {row.location && (
              <span
                title={row.location}
                style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 7px', borderRadius: 8,
                  background: 'rgba(147,51,234,0.1)', color: '#7e22ce',
                  maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >📍 {row.location}</span>
            )}
            {attachCount > 0 && (
              <span
                title={`${attachCount} ek dosya`}
                style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 7px', borderRadius: 8,
                  background: 'rgba(55,65,81,0.12)', color: '#374151',
                }}
              >📎 {attachCount}</span>
            )}
          </div>
        )}

        {!compact && row.owner_name && (
          <div style={{ fontSize: 11, opacity: 0.55, marginTop: 'auto' }}>
            👤 {row.owner_name}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Detay Modal ──────────────────────────────────────────────────────────────
function CollabDetailModal({ row, profile, lookups = {}, onClose, onEdit, onDeleted, onOpenFullPage, onOpenCompletion }) {
  const t = typeObj(row.type);
  const s = statusObj(row.status);
  const u = unitObj(row.unit);
  const editable = canEdit(row, profile);
  const [deleting, setDeleting] = useState(false);
  const [completionReport, setCompletionReport] = useState(null);
  const [completionLoaded, setCompletionLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (row?.status !== 'tamamlandi' || !row?.id) {
      setCompletionReport(null);
      setCompletionLoaded(true);
      return () => { cancelled = true; };
    }
    setCompletionLoaded(false);
    (async () => {
      const { data } = await getCollabCompletionReport(row.id);
      if (!cancelled) {
        setCompletionReport(data || null);
        setCompletionLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [row?.id, row?.status]);

  // Bağlantılı kayıtları lookup listelerinden çöz
  const linkedOrg   = row.partner_org_id
    ? (lookups.organizations || []).find(o => o.id === row.partner_org_id) : null;
  const linkedUser  = row.owner_id
    ? (lookups.users || []).find(x => x.user_id === row.owner_id) : null;
  const linkedFund  = row.related_fund_id
    ? (lookups.fundOpportunities || []).find(f => f.id === row.related_fund_id) : null;
  const linkedEvent = row.related_event_id
    ? (lookups.events || []).find(e => e.id === row.related_event_id) : null;

  const handleDelete = async () => {
    if (!window.confirm('Bu işbirliği kalıcı olarak silinecek. Emin misiniz?')) return;
    setDeleting(true);
    // Görsel varsa önce storage'dan sil (best-effort)
    if (row.image_url) { try { await deleteCollabImage(row.image_url); } catch {} }
    const { error } = await deleteCollaboration(row.id);
    setDeleting(false);
    if (error) return alert('Silinemedi: ' + error.message);
    onDeleted();
  };

  return (
    <ModalShell onClose={onClose} title={`${t?.icon || '🤝'} ${row.title}`}>
      {row.image_url && (
        <div style={{
          width: '100%', borderRadius: 10, overflow: 'hidden', marginBottom: 14,
          background: 'var(--bg-soft, rgba(0,0,0,0.04))',
        }}>
          <img src={row.image_url} alt="" style={{ width: '100%', display: 'block', maxHeight: 320, objectFit: 'cover' }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {t && <Chip color={t.color} label={`${t.icon} ${t.label}`} />}
        {s && <Chip color={s.color} label={s.label} />}
        {u && <Chip color={u.color} label={`${u.icon} ${u.name}`} />}
      </div>

      {row.description && (
        <Section title="Açıklama">
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.5 }}>{row.description}</div>
        </Section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {(linkedOrg || row.partner_name || row.partner_contact_person || row.partner_email || row.partner_website) && (
          <Section title="Partner Kurum">
            {linkedOrg && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
                padding: '8px 10px', borderRadius: 8,
                background: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.2)',
              }}>
                {linkedOrg.logo_url ? (
                  <img src={linkedOrg.logo_url} alt="" style={{
                    width: 34, height: 34, borderRadius: 6, objectFit: 'cover',
                  }} />
                ) : (
                  <div style={{
                    width: 34, height: 34, borderRadius: 6,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(99,102,241,0.2)', color: '#4338ca', fontSize: 18,
                  }}>🏢</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{linkedOrg.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>
                    {linkedOrg.org_type || 'Kurum'} · Network'te kayıtlı
                  </div>
                </div>
              </div>
            )}
            {row.partner_name && !linkedOrg  && <Field label="Kurum"   value={row.partner_name} />}
            {row.partner_contact_person      && <Field label="İlgili Kişi" value={row.partner_contact_person} />}
            {row.partner_email               && <Field label="E-posta" value={<a href={`mailto:${row.partner_email}`} style={{ color: 'var(--navy, #1a3a5c)' }}>{row.partner_email}</a>} />}
            {row.partner_website             && <Field label="Web"     value={<a href={row.partner_website} target="_blank" rel="noreferrer" style={{ color: 'var(--navy, #1a3a5c)' }}>{row.partner_website}</a>} />}
          </Section>
        )}

        <Section title="Sorumlu Kişi">
          {linkedUser ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 8,
              background: 'rgba(14,165,233,0.08)',
              border: '1px solid rgba(14,165,233,0.2)',
            }}>
              {linkedUser.avatar_url ? (
                <img src={linkedUser.avatar_url} alt="" style={{
                  width: 34, height: 34, borderRadius: '50%', objectFit: 'cover',
                }} />
              ) : (
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(14,165,233,0.2)', color: '#0369a1',
                  fontSize: 14, fontWeight: 700,
                }}>{(linkedUser.full_name || '?').charAt(0).toUpperCase()}</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{linkedUser.full_name}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  {linkedUser.unit ? `${linkedUser.unit} · ` : ''}{linkedUser.role || ''}
                </div>
              </div>
            </div>
          ) : (
            row.owner_name && <Field label="Atanan" value={row.owner_name} />
          )}
        </Section>

        <Section title="Zaman & Bütçe">
          {row.start_date && <Field label="Başlangıç" value={fmtDisplayDate(row.start_date)} />}
          {row.end_date   && <Field label="Bitiş"     value={fmtDisplayDate(row.end_date)} />}
          {row.location   && <Field label="Konum"     value={`📍 ${row.location}`} />}
          {row.budget_amount != null && (
            <Field label="Bütçe" value={`${Number(row.budget_amount).toLocaleString('tr-TR')} ${row.budget_currency || 'TRY'}`} />
          )}
        </Section>
      </div>

      {(linkedFund || linkedEvent) && (
        <Section title="Bağlantılı Kayıtlar">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {linkedFund && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8,
                background: 'rgba(234,179,8,0.08)',
                border: '1px solid rgba(234,179,8,0.25)',
              }}>
                <div style={{ fontSize: 20 }}>💰</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{linkedFund.title}</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>
                    {linkedFund.donor_organization || 'Fon Fırsatı'}
                    {linkedFund.deadline ? ` · ⏰ ${fmtDisplayDate(linkedFund.deadline)}` : ''}
                    {linkedFund.status ? ` · ${linkedFund.status}` : ''}
                  </div>
                </div>
              </div>
            )}
            {linkedEvent && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8,
                background: 'rgba(37,99,235,0.08)',
                border: '1px solid rgba(37,99,235,0.25)',
              }}>
                <div style={{ fontSize: 20 }}>📅</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{linkedEvent.title}</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>
                    {linkedEvent.event_type || 'Etkinlik'}
                    {linkedEvent.start_date ? ` · ${fmtDisplayDate(linkedEvent.start_date)}` : ''}
                    {linkedEvent.location_name ? ` · 📍 ${linkedEvent.location_name}` : ''}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {row.tags && row.tags.length > 0 && (
        <Section title="Etiketler">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {row.tags.map(tg => (
              <span key={tg} style={{
                fontSize: 11, padding: '3px 8px', borderRadius: 10,
                background: 'var(--bg-soft, rgba(0,0,0,0.05))',
              }}>#{tg}</span>
            ))}
          </div>
        </Section>
      )}

      {Array.isArray(row.attachments) && row.attachments.length > 0 && (
        <Section title={`Ek Dosyalar (${row.attachments.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {row.attachments.map((a) => (
              <a
                key={a.drive_file_id}
                href={a.web_view_link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 8,
                  border: '1px solid var(--border, rgba(0,0,0,0.1))',
                  background: 'var(--bg, #fff)', color: 'inherit',
                  textDecoration: 'none',
                }}
              >
                <div style={{ fontSize: 22 }}>{attachIcon(a.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    title={a.name}
                    style={{
                      fontSize: 13, fontWeight: 600,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >{a.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>
                    {formatFileSize(a.size)}
                    {a.uploaded_by_name ? ` · ${a.uploaded_by_name}` : ''}
                    {a.uploaded_at ? ` · ${fmtDisplayDate(a.uploaded_at)}` : ''}
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                  color: 'var(--navy, #1a3a5c)',
                  border: '1px solid var(--border, rgba(0,0,0,0.15))',
                }}>Drive'da Aç ↗</span>
              </a>
            ))}
          </div>
        </Section>
      )}

      {/* MoU / Partner Rolü / Beneficiary özeti */}
      {(row.partner_role || row.mou_status || row.target_beneficiaries != null || row.reached_beneficiaries != null) && (
        <Section title="İşbirliği Detayları">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
            {row.partner_role && (() => {
              const r = COLLAB_PARTNER_ROLES.find(x => x.id === row.partner_role);
              return <Field label="Partner Rolü" value={r ? `${r.icon || ''} ${r.label}` : row.partner_role} />;
            })()}
            {row.mou_status && (() => {
              const m = COLLAB_MOU_STATUSES.find(x => x.id === row.mou_status);
              return <Field label="MoU Durumu" value={m ? m.label : row.mou_status} />;
            })()}
            {row.mou_signed_at && <Field label="MoU İmza" value={fmtDisplayDate(row.mou_signed_at)} />}
            {row.mou_expires_at && <Field label="MoU Bitiş" value={fmtDisplayDate(row.mou_expires_at)} />}
            {row.mou_url && <Field label="MoU Dosyası" value={<a href={row.mou_url} target="_blank" rel="noreferrer" style={{ color: 'var(--navy, #1a3a5c)' }}>📄 Görüntüle</a>} />}
            {(row.target_beneficiaries != null || row.reached_beneficiaries != null) && (
              <Field
                label="Beneficiary"
                value={`${Number(row.reached_beneficiaries || 0).toLocaleString('tr-TR')} / ${Number(row.target_beneficiaries || 0).toLocaleString('tr-TR')}`}
              />
            )}
          </div>
        </Section>
      )}

      {row.status === 'tamamlandi' && completionLoaded && (
        <Section title="📝 Sonuç Raporu">
          {completionReport ? (
            <div style={{
              padding: '10px 12px', borderRadius: 8,
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.25)',
              display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#15803d', marginBottom: 2 }}>
                  ✓ Rapor doldurulmuş
                </div>
                <div style={{ fontSize: 11.5, opacity: 0.75 }}>
                  {completionReport.submitted_by_name || 'Kullanıcı'} ·{' '}
                  {completionReport.submitted_at ? fmtDisplayDate(completionReport.submitted_at) : ''}
                  {completionReport.achievement_level && (
                    <> · Başarı: <b>{completionReport.achievement_level}</b></>
                  )}
                </div>
              </div>
              {onOpenCompletion && (
                <button onClick={onOpenCompletion} style={{
                  padding: '7px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  border: '1.5px solid #16a34a', background: '#16a34a', color: '#fff',
                }}>Görüntüle / Düzenle</button>
              )}
            </div>
          ) : (
            <div style={{
              padding: '10px 12px', borderRadius: 8,
              background: 'rgba(234,179,8,0.10)',
              border: '1px solid rgba(234,179,8,0.30)',
              display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 220, fontSize: 12.5 }}>
                Bu işbirliği tamamlandı ama henüz sonuç raporu doldurulmadı.
              </div>
              {onOpenCompletion && (
                <button onClick={onOpenCompletion} style={{
                  padding: '7px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  border: '1.5px solid #ca8a04', background: '#ca8a04', color: '#fff',
                }}>＋ Rapor Doldur</button>
              )}
            </div>
          )}
        </Section>
      )}

      <div style={{ marginTop: 18, display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {onOpenFullPage && (
          <button onClick={onOpenFullPage} title="Notion tarzı tam sayfaya aç" style={{
            padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: '1.5px solid var(--navy, #1a3a5c)', color: 'var(--navy, #1a3a5c)',
            background: 'transparent',
          }}>↗ Tam Sayfaya Aç</button>
        )}
        {editable && (
          <>
            <button onClick={handleDelete} disabled={deleting} style={{
              padding: '9px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
              border: '1.5px solid rgba(239,68,68,0.3)',
              background: 'transparent', color: '#dc2626',
            }}>{deleting ? 'Siliniyor…' : '🗑 Sil'}</button>
            <button onClick={onEdit} style={{
              padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: 'none', background: 'var(--navy, #1a3a5c)', color: '#fff',
            }}>✎ Düzenle</button>
          </>
        )}
        <button onClick={onClose} style={{
          padding: '9px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
          border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
          background: 'var(--bg, #fff)', color: 'inherit',
        }}>Kapat</button>
      </div>
    </ModalShell>
  );
}

// ── Oluştur/Düzenle Modal ────────────────────────────────────────────────────
function CollabModal({ row, profile, user, lookups = {}, onClose, onSaved, onOrgCreated }) {
  const isNew = !row?.id;
  const initialUnit = row?.unit || row?._unitPrefill || resolveUnitName(profile?.unit) || UNITS[0].name;
  const [form, setForm] = useState({
    title:                   row?.title || '',
    description:             row?.description || '',
    type:                    row?.type || 'proje',
    unit:                    resolveUnitName(initialUnit),
    partner_org_id:          row?.partner_org_id || '',
    partner_name:            row?.partner_name || '',
    partner_role:            row?.partner_role || '',
    partner_contact_person:  row?.partner_contact_person || '',
    partner_email:           row?.partner_email || '',
    partner_website:         row?.partner_website || '',
    owner_id:                row?.owner_id || user?.id || '',
    owner_name:              row?.owner_name || profile?.full_name || user?.email || '',
    related_fund_id:         row?.related_fund_id || '',
    related_event_id:        row?.related_event_id || '',
    start_date:              row?.start_date || '',
    end_date:                row?.end_date || '',
    status:                  row?.status || 'planlaniyor',
    budget_amount:           row?.budget_amount ?? '',
    budget_currency:         row?.budget_currency || 'TRY',
    location:                row?.location || '',
    tags:                    (row?.tags || []).join(', '),
    image_url:               row?.image_url || '',
    // MoU / Sözleşme
    mou_status:              row?.mou_status || '',
    mou_signed_at:           row?.mou_signed_at || '',
    mou_expires_at:          row?.mou_expires_at || '',
    mou_url:                 row?.mou_url || '',
    // Beneficiary
    target_beneficiaries:    row?.target_beneficiaries ?? '',
    reached_beneficiaries:   row?.reached_beneficiaries ?? '',
  });
  const [attachments, setAttachments] = useState(
    Array.isArray(row?.attachments) ? row.attachments : []
  );
  // Bu oturumda yüklenen dosyalar (iptal edilirse Drive'dan temizlenir)
  const [sessionUploadedIds, setSessionUploadedIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadInfo, setUploadInfo] = useState('');
  const [attachUploading, setAttachUploading] = useState(false);
  const [attachProgress, setAttachProgress] = useState(0);
  const [attachErr, setAttachErr] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef(null);
  const attachFileRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handlePickImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErr('Lütfen bir görsel dosyası seçin (JPG/PNG/WEBP/GIF).');
      e.target.value = '';
      return;
    }
    setUploading(true); setErr(''); setUploadInfo('Görsel işleniyor…');
    try {
      const res = await uploadCollabImage(file, user?.id);
      set('image_url', res.url);
      const kb = Math.round(res.size / 1024);
      const origKb = Math.round(file.size / 1024);
      setUploadInfo(origKb === kb
        ? `✅ Yüklendi (${kb} KB)`
        : `✅ ${origKb} KB → ${kb} KB olarak küçültüldü & yüklendi`);
    } catch (ex) {
      console.error(ex);
      setErr(ex.message || 'Görsel yüklenemedi');
      setUploadInfo('');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleClearImage = async () => {
    // Mevcut görsel yeni yüklenmiş ve henüz kaydedilmemiş olabilir; en garantili
    // yaklaşım olarak sadece URL'i form'dan çıkarıyoruz. Storage temizliği sil'de yapılır.
    set('image_url', '');
    setUploadInfo('');
  };

  // ── Drive eki: dosya seçimi ────────────────────────────────────────────────
  const handlePickAttachment = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setAttachErr('');
    for (const file of files) {
      const v = validateUploadFile(file, { maxBytes: MAX_DOCUMENT_BYTES, kind: 'document' });
      if (!v.ok) {
        setAttachErr(`"${file.name}" yüklenemedi: ${v.error}`);
        continue;
      }
      setAttachUploading(true);
      setAttachProgress(0);
      try {
        const result = await uploadDocumentToDrive(file, {
          onProgress: (p) => setAttachProgress(Math.round(p * 100)),
        });
        const meta = {
          drive_file_id:    result.fileId,
          name:             result.name || file.name,
          mime_type:        result.mimeType || file.type || 'application/octet-stream',
          size:             result.size || file.size,
          web_view_link:    result.webViewLink,
          web_content_link: result.webContentLink || null,
          uploaded_at:      new Date().toISOString(),
          uploaded_by:      user?.id || null,
          uploaded_by_name: profile?.full_name || user?.email || '—',
        };
        setAttachments(prev => [...prev, meta]);
        setSessionUploadedIds(prev => {
          const n = new Set(prev); n.add(result.fileId); return n;
        });
      } catch (ex) {
        console.error('[collab-attach] upload failed:', ex);
        setAttachErr(`"${file.name}" yüklenemedi: ${ex.message || ex}`);
      } finally {
        setAttachUploading(false);
        setAttachProgress(0);
      }
    }
    e.target.value = '';
  };

  // ── Drive eki: kaldır ──────────────────────────────────────────────────────
  const handleRemoveAttachment = async (att) => {
    if (!window.confirm(`"${att.name}" kalıcı olarak silinecek (Drive dahil). Emin misiniz?`)) return;
    let driveWarn = null;
    try {
      if (att.web_view_link) await deleteDocumentFromDrive(att.web_view_link);
    } catch (ex) {
      driveWarn = ex?.message || String(ex);
      console.warn('[drive-delete] failed, proceeding with local removal:', driveWarn);
    }
    setAttachments(prev => prev.filter(a => a.drive_file_id !== att.drive_file_id));
    setSessionUploadedIds(prev => {
      const n = new Set(prev); n.delete(att.drive_file_id); return n;
    });
    if (driveWarn) {
      setAttachErr("Drive'dan silinemedi ama listeden kaldırıldı. Drive'dan manuel silmeniz gerekebilir.");
    }
  };

  // ── İptal: bu oturumda yüklenen ekleri Drive'dan temizle ───────────────────
  const handleCancel = async () => {
    const toClean = attachments.filter(a => sessionUploadedIds.has(a.drive_file_id));
    if (toClean.length > 0) {
      const msg = `Bu oturumda ${toClean.length} dosya yüklediniz. İptal ederseniz Drive'dan da silinecek. Devam edilsin mi?`;
      if (!window.confirm(msg)) return;
      for (const a of toClean) {
        try { if (a.web_view_link) await deleteDocumentFromDrive(a.web_view_link); } catch {}
      }
    }
    onClose();
  };

  const handleSave = async () => {
    if (!form.title.trim()) return setErr('Başlık zorunlu.');
    if (!form.type) return setErr('Tür seçin.');
    if (!form.unit) return setErr('Birim seçin.');

    setSaving(true); setErr('');

    const payload = {
      title:                  form.title.trim(),
      description:            form.description.trim() || null,
      type:                   form.type,
      unit:                   resolveUnitName(form.unit),
      partner_org_id:         form.partner_org_id || null,
      partner_name:           form.partner_name.trim() || null,
      partner_role:           form.partner_role || null,
      partner_contact_person: form.partner_contact_person.trim() || null,
      partner_email:          form.partner_email.trim() || null,
      partner_website:        form.partner_website.trim() || null,
      owner_id:               form.owner_id || null,
      owner_name:             (form.owner_name || '').trim() || null,
      related_fund_id:        form.related_fund_id || null,
      related_event_id:       form.related_event_id || null,
      start_date:             form.start_date || null,
      end_date:                form.end_date || null,
      status:                  form.status,
      budget_amount:           form.budget_amount === '' ? null : Number(form.budget_amount),
      budget_currency:         form.budget_currency || 'TRY',
      location:                form.location.trim() || null,
      tags:                    form.tags.split(',').map(x => x.trim()).filter(Boolean),
      image_url:               form.image_url || null,
      attachments:             attachments || [],
      // MoU
      mou_status:              form.mou_status || null,
      mou_signed_at:           form.mou_signed_at || null,
      mou_expires_at:          form.mou_expires_at || null,
      mou_url:                 (form.mou_url || '').trim() || null,
      // Beneficiary
      target_beneficiaries:    form.target_beneficiaries === '' ? null : Number(form.target_beneficiaries),
      reached_beneficiaries:   form.reached_beneficiaries === '' ? null : Number(form.reached_beneficiaries),
    };

    try {
      if (isNew) {
        // Yeni kayıtta sorumlu kişi seçilmediyse: oluşturan kişi default olsun
        if (!payload.owner_id) {
          payload.owner_id   = user?.id || profile?.user_id;
          payload.owner_name = profile?.full_name || user?.email || '—';
        }
        const { data, error } = await createCollaboration(payload);
        if (error) throw error;
        onSaved(data, { isNew: true });
      } else {
        const { data, error } = await updateCollaboration(row.id, payload);
        if (error) throw error;
        onSaved(data, { isNew: false });
      }
    } catch (e) {
      console.error(e);
      setErr(e.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={handleCancel} title={isNew ? '＋ Yeni İşbirliği' : '✎ İşbirliğini Düzenle'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Görsel alanı */}
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.7, marginBottom: 6 }}>
            KAPAK GÖRSELİ <span style={{ opacity: 0.55, fontWeight: 500 }}>(opsiyonel · 3MB üzeri otomatik küçültülür)</span>
          </div>
          {form.image_url ? (
            <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1.5px solid var(--border, rgba(0,0,0,0.12))' }}>
              <img src={form.image_url} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }} />
              <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
                <button onClick={() => fileRef.current?.click()} style={{
                  padding: '6px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                  border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff',
                }}>Değiştir</button>
                <button onClick={handleClearImage} style={{
                  padding: '6px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                  border: 'none', background: 'rgba(220,38,38,0.85)', color: '#fff',
                }}>Kaldır</button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{
                width: '100%', padding: '22px 14px', borderRadius: 10, cursor: 'pointer',
                border: '1.5px dashed var(--border, rgba(0,0,0,0.2))',
                background: 'var(--bg-soft, rgba(0,0,0,0.02))', color: 'inherit',
                fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6,
              }}
            >
              <div style={{ fontSize: 24 }}>🖼</div>
              <div style={{ fontWeight: 700 }}>{uploading ? 'Yükleniyor…' : 'Görsel Seç veya Sürükle'}</div>
              <div style={{ fontSize: 11.5, opacity: 0.6 }}>JPG / PNG / WEBP / GIF</div>
            </button>
          )}
          {uploadInfo && !err && (
            <div style={{ fontSize: 11.5, opacity: 0.7, marginTop: 4 }}>{uploadInfo}</div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handlePickImage}
            style={{ display: 'none' }}
          />
        </div>

        <LabeledInput label="Başlık *" value={form.title} onChange={v => set('title', v)} placeholder="Örn: UNICEF ile Gaziantep çocuk sağlığı projesi" />
        <LabeledTextarea label="Açıklama" value={form.description} onChange={v => set('description', v)} placeholder="Kısa özet, hedefler, kapsam…" rows={4} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <LabeledSelect label="Tür *" value={form.type} onChange={v => set('type', v)}>
            {COLLAB_TYPES.map(t => (<option key={t.id} value={t.id}>{t.icon} {t.label}</option>))}
          </LabeledSelect>
          <LabeledSelect label="Sorumlu Birim *" value={form.unit} onChange={v => set('unit', v)}>
            {UNITS.map(u => (<option key={u.name} value={u.name}>{u.icon} {u.name}</option>))}
          </LabeledSelect>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.6, marginTop: 6 }}>PARTNER KURUM</div>
        <OrgAutocomplete
          orgs={lookups.organizations || []}
          value={form.partner_org_id}
          legacyName={!form.partner_org_id ? form.partner_name : ''}
          unitHint={form.unit}
          onSelect={(org) => {
            if (!org) {
              setForm(f => ({
                ...f,
                partner_org_id: '',
                partner_name:   '',
                partner_email:   f.partner_email,
                partner_website: f.partner_website,
              }));
              return;
            }
            setForm(f => ({
              ...f,
              partner_org_id:  org.id,
              partner_name:    org.name || '',
              partner_email:   org.email || f.partner_email,
              partner_website: org.website || f.partner_website,
            }));
          }}
          onOrgCreated={(newOrg) => {
            if (typeof onOrgCreated === 'function') onOrgCreated(newOrg);
          }}
          creatorName={profile?.full_name || user?.email || null}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <LabeledSelect
            label="Partner Rolü"
            value={form.partner_role}
            onChange={v => set('partner_role', v)}
          >
            <option value="">— Belirtilmedi —</option>
            {COLLAB_PARTNER_ROLES.map(r => (
              <option key={r.id} value={r.id}>{r.icon ? `${r.icon} ` : ''}{r.label}</option>
            ))}
          </LabeledSelect>
          <LabeledInput label="İlgili Kişi" value={form.partner_contact_person} onChange={v => set('partner_contact_person', v)} placeholder="Ad Soyad" />
          <LabeledInput label="E-posta" value={form.partner_email} onChange={v => set('partner_email', v)} placeholder="kisi@kurum.org" />
          <LabeledInput label="Web / Link" value={form.partner_website} onChange={v => set('partner_website', v)} placeholder="https://…" />
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.6, marginTop: 6 }}>SORUMLU KİŞİ</div>
        <LabeledSelect
          label="Sistemdeki Kullanıcılardan Ata"
          value={form.owner_id}
          onChange={(v) => {
            const u = (lookups.users || []).find(x => x.user_id === v);
            setForm(f => ({
              ...f,
              owner_id:   v,
              owner_name: u?.full_name || f.owner_name,
            }));
          }}
        >
          <option value="">— Seçilmedi —</option>
          {(lookups.users || []).map(u => (
            <option key={u.user_id} value={u.user_id}>
              {u.full_name}{u.unit ? ` · ${u.unit}` : ''}{u.role ? ` (${u.role})` : ''}
            </option>
          ))}
        </LabeledSelect>

        <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.6, marginTop: 6 }}>BAĞLANTILI KAYITLAR</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <LabeledSelect
            label="Fon Fırsatı"
            value={form.related_fund_id}
            onChange={v => set('related_fund_id', v)}
          >
            <option value="">— Bağlı değil —</option>
            {(lookups.fundOpportunities || []).map(f => (
              <option key={f.id} value={f.id}>
                {f.title}{f.donor_organization ? ` · ${f.donor_organization}` : ''}
                {f.deadline ? ` · ⏰ ${fmtDisplayDate(f.deadline)}` : ''}
              </option>
            ))}
          </LabeledSelect>
          <LabeledSelect
            label="Etkinlik"
            value={form.related_event_id}
            onChange={v => set('related_event_id', v)}
          >
            <option value="">— Bağlı değil —</option>
            {(lookups.events || []).map(e => (
              <option key={e.id} value={e.id}>
                {e.title}{e.start_date ? ` · ${fmtDisplayDate(e.start_date)}` : ''}
              </option>
            ))}
          </LabeledSelect>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.6, marginTop: 6 }}>ZAMAN & BÜTÇE</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <LabeledInput type="date" label="Başlangıç" value={form.start_date} onChange={v => set('start_date', v)} />
          <LabeledInput type="date" label="Bitiş"     value={form.end_date}   onChange={v => set('end_date', v)} />
          <LabeledSelect label="Durum" value={form.status} onChange={v => set('status', v)}>
            {COLLAB_STATUSES.map(s => (<option key={s.id} value={s.id}>{s.label}</option>))}
          </LabeledSelect>
          <LabeledInput type="number" label="Bütçe" value={form.budget_amount} onChange={v => set('budget_amount', v)} placeholder="0" />
          <LabeledSelect label="Para Birimi" value={form.budget_currency} onChange={v => set('budget_currency', v)}>
            <option value="TRY">TRY (₺)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
          </LabeledSelect>
        </div>

        <LabeledInput label="Konum" value={form.location} onChange={v => set('location', v)} placeholder="Örn: İstanbul / Çevrimiçi / Gaziantep, Türkiye" />

        <LabeledInput label="Etiketler (virgülle ayırın)" value={form.tags} onChange={v => set('tags', v)} placeholder="çocuk, sağlık, gaziantep" />

        {/* ── MoU / Sözleşme ─────────────────────────────────────────────── */}
        <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.6, marginTop: 6 }}>MoU / SÖZLEŞME</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <LabeledSelect label="MoU Durumu" value={form.mou_status} onChange={v => set('mou_status', v)}>
            <option value="">— Belirtilmedi —</option>
            {COLLAB_MOU_STATUSES.map(m => (<option key={m.id} value={m.id}>{m.label}</option>))}
          </LabeledSelect>
          <LabeledInput label="MoU / Sözleşme URL" value={form.mou_url} onChange={v => set('mou_url', v)} placeholder="https://…" />
          <LabeledInput type="date" label="İmzalanma Tarihi" value={form.mou_signed_at} onChange={v => set('mou_signed_at', v)} />
          <LabeledInput type="date" label="Bitiş / Geçerlilik" value={form.mou_expires_at} onChange={v => set('mou_expires_at', v)} />
        </div>

        {/* ── Beneficiary Metrikleri ─────────────────────────────────────── */}
        <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.6, marginTop: 6 }}>BENEFİCİARY / ETKİ ÖLÇÜMÜ</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <LabeledInput type="number" label="Hedef Sayı" value={form.target_beneficiaries} onChange={v => set('target_beneficiaries', v)} placeholder="0" />
          <LabeledInput type="number" label="Ulaşılan" value={form.reached_beneficiaries} onChange={v => set('reached_beneficiaries', v)} placeholder="0" />
        </div>

        {/* ── Drive ek dosyalar ─────────────────────────────────────────── */}
        <div style={{ marginTop: 6 }}>
          <div style={{
            fontSize: 11.5, fontWeight: 700, opacity: 0.7, marginBottom: 6,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            EK DOSYALAR
            <span style={{ opacity: 0.55, fontWeight: 500 }}>
              · Google Drive'a yüklenir · Maks 100 MB
            </span>
            {attachments.length > 0 && (
              <span style={{
                fontSize: 10.5, padding: '2px 7px', borderRadius: 10,
                background: 'var(--bg-soft, rgba(0,0,0,0.05))',
              }}>{attachments.length}</span>
            )}
          </div>

          {attachments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
              {attachments.map((a) => (
                <div
                  key={a.drive_file_id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 8,
                    border: '1px solid var(--border, rgba(0,0,0,0.1))',
                    background: 'var(--bg, #fff)',
                  }}
                >
                  <div style={{ fontSize: 20 }}>{attachIcon(a.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      title={a.name}
                      style={{
                        fontSize: 13, fontWeight: 600,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >{a.name}</div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>
                      {formatFileSize(a.size)}{a.uploaded_by_name ? ` · ${a.uploaded_by_name}` : ''}
                    </div>
                  </div>
                  {a.web_view_link && (
                    <a
                      href={a.web_view_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 11.5, fontWeight: 600, padding: '5px 10px', borderRadius: 6,
                        textDecoration: 'none', color: 'var(--navy, #1a3a5c)',
                        border: '1px solid var(--border, rgba(0,0,0,0.12))',
                      }}
                    >Aç</a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(a)}
                    title="Kaldır"
                    style={{
                      padding: '5px 9px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                      border: '1px solid rgba(239,68,68,0.3)', color: '#dc2626',
                      background: 'transparent',
                    }}
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => attachFileRef.current?.click()}
            disabled={attachUploading}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
              border: '1.5px dashed var(--border, rgba(0,0,0,0.2))',
              background: 'var(--bg-soft, rgba(0,0,0,0.02))', color: 'inherit',
              fontSize: 12.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>📎</span>
            <span style={{ fontWeight: 700 }}>
              {attachUploading
                ? `Yükleniyor… %${attachProgress}`
                : 'Dosya Ekle (Google Drive)'}
            </span>
          </button>
          <input
            ref={attachFileRef}
            type="file"
            multiple
            onChange={handlePickAttachment}
            style={{ display: 'none' }}
          />
          {attachErr && (
            <div style={{ fontSize: 11.5, color: '#dc2626', marginTop: 6 }}>⚠️ {attachErr}</div>
          )}
        </div>

        {err && (
          <div style={{
            padding: 10, borderRadius: 8,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#dc2626', fontSize: 12.5,
          }}>⚠️ {err}</div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
          <button onClick={handleCancel} style={{
            padding: '9px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
            border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
            background: 'var(--bg, #fff)', color: 'inherit',
          }}>İptal</button>
          <button onClick={handleSave} disabled={saving || uploading || attachUploading} style={{
            padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            border: 'none', background: 'var(--navy, #1a3a5c)', color: '#fff',
            opacity: (saving || uploading || attachUploading) ? 0.6 : 1,
          }}>{saving ? 'Kaydediliyor…' : (isNew ? 'Oluştur' : 'Kaydet')}</button>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Küçük UI parçaları ───────────────────────────────────────────────────────
function ModalShell({ children, onClose, title }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10000, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg, #fff)', color: 'inherit',
          borderRadius: 14, padding: 22,
          maxWidth: 720, width: '100%', maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
          paddingBottom: 12, borderBottom: '1px solid var(--border, rgba(0,0,0,0.1))',
        }}>
          <div style={{ flex: 1, fontSize: 17, fontWeight: 800 }}>{title}</div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'var(--bg-soft, rgba(0,0,0,0.05))', fontSize: 16,
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Chip({ label, color }) {
  return (
    <span style={{
      fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 12,
      background: `${color}20`, color,
    }}>{label}</span>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', opacity: 0.6, marginBottom: 6 }}>
        {title.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ fontSize: 12.5, marginBottom: 4 }}>
      <span style={{ opacity: 0.6 }}>{label}:</span>{' '}
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function LabeledInput({ label, value, onChange, placeholder, type = 'text', listId }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.7 }}>{label}</span>
      <input
        type={type}
        value={value == null ? '' : value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        list={listId}
        style={{
          padding: '8px 11px', borderRadius: 7, fontSize: 13,
          border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
          background: 'var(--bg, #fff)', color: 'inherit', outline: 'none',
        }}
      />
    </label>
  );
}

function LabeledTextarea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.7 }}>{label}</span>
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          padding: '8px 11px', borderRadius: 7, fontSize: 13,
          border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
          background: 'var(--bg, #fff)', color: 'inherit', outline: 'none',
          resize: 'vertical', fontFamily: 'inherit',
        }}
      />
    </label>
  );
}

function LabeledSelect({ label, value, onChange, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.7 }}>{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          padding: '8px 11px', borderRadius: 7, fontSize: 13,
          border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
          background: 'var(--bg, #fff)', color: 'inherit', cursor: 'pointer',
        }}
      >{children}</select>
    </label>
  );
}

// ── Partner kurum autocomplete + inline create ────────────────────────────────
const ORG_TYPE_OPTIONS = [
  { id: 'ngo',       label: 'STK / NGO' },
  { id: 'govt',      label: 'Kamu' },
  { id: 'un',        label: 'BM / Ajans' },
  { id: 'academic',  label: 'Akademik' },
  { id: 'private',   label: 'Özel Sektör' },
  { id: 'donor',     label: 'Donor / Fon Veren' },
  { id: 'foundation',label: 'Vakıf' },
  { id: 'other',     label: 'Diğer' },
];

function OrgAutocomplete({ orgs = [], value, onSelect, onOrgCreated, creatorName, unitHint, legacyName }) {
  const selectedOrg = orgs.find(o => o.id === value) || null;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newOrg, setNewOrg] = useState({ name: '', org_type: 'ngo', website: '', email: '' });
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const hasLegacy = !selectedOrg && !!legacyName && legacyName.trim().length > 0;

  // Outside click closes dropdown
  useEffect(() => {
    const onDocClick = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) { setOpen(false); setCreating(false); }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const q = query.trim().toLocaleLowerCase('tr');
  const filtered = !q
    ? orgs.slice(0, 20)
    : orgs.filter(o =>
        (o.name || '').toLocaleLowerCase('tr').includes(q)
        || (o.org_type || '').toLocaleLowerCase('tr').includes(q)
      ).slice(0, 50);
  const exactMatch = q && filtered.some(o => (o.name || '').toLocaleLowerCase('tr') === q);
  const canCreate = !!q && !exactMatch;

  function pick(org) {
    onSelect(org);
    setQuery('');
    setOpen(false);
    setCreating(false);
  }

  function clear() {
    onSelect(null);
    setQuery('');
    setOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function startCreate(prefillName = '') {
    setNewOrg({ name: prefillName || query.trim(), org_type: 'ngo', website: '', email: '' });
    setCreating(true);
    setOpen(true);
  }

  async function handleCreate(e) {
    e?.preventDefault?.();
    const name = newOrg.name.trim();
    if (!name) return;
    setSaving(true);
    const payload = {
      name,
      org_type: newOrg.org_type || 'other',
      website: newOrg.website.trim() || null,
      email:   newOrg.email.trim() || null,
      unit:    unitHint || null,
    };
    const { data, error } = await createNetworkOrg(payload, creatorName);
    setSaving(false);
    if (error) {
      alert('Kurum eklenemedi: ' + (error.message || 'Bilinmeyen hata'));
      return;
    }
    if (typeof onOrgCreated === 'function') onOrgCreated(data);
    // Seç yeni ekleneni
    pick(data);
  }

  function onKeyDown(e) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(filtered.length - (canCreate ? 0 : 1), i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx < filtered.length) {
        pick(filtered[activeIdx]);
      } else if (canCreate) {
        startCreate();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.7 }}>
          Partner Kurum
        </span>

        {selectedOrg ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', borderRadius: 7,
            border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
            background: 'var(--bg, #fff)',
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '3px 9px', borderRadius: 999,
              background: 'rgba(99,102,241,0.12)', color: '#4338ca',
              fontSize: 12.5, fontWeight: 700,
            }}>
              🏛 {selectedOrg.name}
              {selectedOrg.org_type && (
                <span style={{ opacity: 0.7, fontWeight: 600 }}> · {selectedOrg.org_type}</span>
              )}
            </div>
            <button
              type="button"
              onClick={clear}
              style={{
                marginLeft: 'auto', padding: '3px 9px', borderRadius: 6,
                border: '1px solid var(--border, rgba(0,0,0,0.15))',
                background: 'transparent', cursor: 'pointer', fontSize: 12,
              }}
              title="Kurumu temizle"
            >× Temizle</button>
          </div>
        ) : (
          <>
          {hasLegacy && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', marginBottom: 6, borderRadius: 7,
              background: 'rgba(234,179,8,0.12)', color: '#854d0e',
              fontSize: 12, border: '1px solid rgba(234,179,8,0.35)',
            }}>
              <span style={{ fontSize: 14 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                Bu işbirliğindeki kurum <b>"{legacyName}"</b> sisteme bağlı değil.
              </div>
              <button
                type="button"
                onClick={() => { setQuery(legacyName.trim()); setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
                style={{
                  padding: '4px 9px', borderRadius: 6, fontSize: 11.5, fontWeight: 700,
                  cursor: 'pointer', background: 'var(--bg, #fff)',
                  border: '1px solid rgba(234,179,8,0.5)', color: '#854d0e',
                }}
              >Bağla →</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setOpen(true); setActiveIdx(0); setCreating(false); }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              placeholder="Kurum ara... (ör. UNICEF, TİKA, LSE)"
              style={{
                flex: 1, padding: '8px 11px', borderRadius: 7, fontSize: 13,
                border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
                background: 'var(--bg, #fff)', color: 'inherit', outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => startCreate(query.trim())}
              title="Sistemde yoksa yeni kurum ekle"
              style={{
                padding: '0 12px', borderRadius: 7, fontSize: 16, fontWeight: 800,
                border: '1.5px solid var(--navy, #1a3a5c)',
                background: 'var(--navy, #1a3a5c)', color: '#fff',
                cursor: 'pointer', minWidth: 42,
              }}
            >+</button>
          </div>
          </>
        )}
      </label>

      {!selectedOrg && open && !creating && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: 'var(--bg, #fff)', zIndex: 20,
          border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          maxHeight: 280, overflowY: 'auto',
        }}>
          {filtered.length === 0 && !canCreate && (
            <div style={{ padding: 14, fontSize: 13, opacity: 0.6, textAlign: 'center' }}>
              Kayıtlı kurum bulunamadı.
            </div>
          )}
          {filtered.map((o, idx) => (
            <div
              key={o.id}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}
              onMouseEnter={() => setActiveIdx(idx)}
              style={{
                padding: '9px 12px', cursor: 'pointer', fontSize: 13,
                background: activeIdx === idx ? 'rgba(99,102,241,0.08)' : 'transparent',
                borderBottom: '1px solid var(--border, rgba(0,0,0,0.05))',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <span style={{ fontSize: 14 }}>🏛</span>
              <span style={{ fontWeight: 600 }}>{o.name}</span>
              {o.org_type && (
                <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 'auto' }}>{o.org_type}</span>
              )}
            </div>
          ))}
          {canCreate && (
            <div
              onMouseDown={(e) => { e.preventDefault(); startCreate(query.trim()); }}
              style={{
                padding: '10px 12px', cursor: 'pointer', fontSize: 13,
                background: activeIdx === filtered.length ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.06)',
                color: '#15803d', fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              ➕ "{query.trim()}" adıyla yeni kurum ekle
            </div>
          )}
        </div>
      )}

      {!selectedOrg && creating && (
        <div style={{
          marginTop: 8,
          padding: 12, borderRadius: 8,
          border: '1.5px solid #22c55e',
          background: 'rgba(34,197,94,0.05)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#15803d' }}>
            ➕ YENİ PARTNER KURUM EKLE
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 8 }}>
            <input
              type="text"
              value={newOrg.name}
              onChange={e => setNewOrg(n => ({ ...n, name: e.target.value }))}
              placeholder="Kurum adı *"
              autoFocus
              style={inputStyle}
            />
            <select
              value={newOrg.org_type}
              onChange={e => setNewOrg(n => ({ ...n, org_type: e.target.value }))}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {ORG_TYPE_OPTIONS.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={newOrg.website}
              onChange={e => setNewOrg(n => ({ ...n, website: e.target.value }))}
              placeholder="Web (opsiyonel)"
              style={inputStyle}
            />
            <input
              type="email"
              value={newOrg.email}
              onChange={e => setNewOrg(n => ({ ...n, email: e.target.value }))}
              placeholder="E-posta (ops.)"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setCreating(false)}
              style={{
                padding: '7px 12px', borderRadius: 6, fontSize: 12.5, cursor: 'pointer',
                border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
                background: 'var(--bg, #fff)', color: 'inherit',
              }}
            >İptal</button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || !newOrg.name.trim()}
              style={{
                padding: '7px 14px', borderRadius: 6, fontSize: 12.5, fontWeight: 700,
                cursor: saving || !newOrg.name.trim() ? 'not-allowed' : 'pointer',
                border: 'none', background: '#22c55e', color: '#fff',
                opacity: saving || !newOrg.name.trim() ? 0.6 : 1,
              }}
            >{saving ? 'Ekleniyor…' : '✓ Ekle & Seç'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  padding: '7px 10px', borderRadius: 6, fontSize: 13,
  border: '1.5px solid var(--border, rgba(0,0,0,0.15))',
  background: 'var(--bg, #fff)', color: 'inherit', outline: 'none',
};
