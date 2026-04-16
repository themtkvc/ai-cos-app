import React from 'react';

/**
 * Ortak "veri yok" bileşeni.
 *
 * Kullanım:
 *   <EmptyState icon="📭" title="Görev bulunamadı" sub="Yeni görev ekleyerek başlayın" />
 *   <EmptyState icon="✅" title="Açık aksiyon yok" />
 *   <EmptyState icon="📊" title="Rapor yok" actionLabel="İlk Raporu Oluştur" onAction={() => ...} />
 */
export default function EmptyState({ icon = '📭', title = 'Kayıt bulunamadı', sub, actionLabel, onAction, style }) {
  return (
    <div className="empty-state" style={style}>
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title">{title}</div>
      {sub && <div className="empty-state-sub">{sub}</div>}
      {actionLabel && onAction && (
        <button className="btn btn-primary" onClick={onAction} style={{ marginTop: 16 }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
