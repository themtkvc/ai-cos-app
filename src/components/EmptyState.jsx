import React from 'react';

/**
 * Ortak "veri yok" bileşeni.
 *
 * Kullanım:
 *   <EmptyState icon="📭" title="Görev bulunamadı" sub="Yeni görev ekleyerek başlayın" />
 *   <EmptyState icon="✅" title="Açık aksiyon yok" />
 */
export default function EmptyState({ icon = '📭', title = 'Kayıt bulunamadı', sub, style }) {
  return (
    <div className="empty-state" style={{ padding: 32, textAlign: 'center', ...style }}>
      <div className="empty-state-icon" style={{ fontSize: 36, marginBottom: 8 }}>{icon}</div>
      <div className="empty-state-title" style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
      {sub && <div className="empty-state-sub" style={{ fontSize: 13, color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}
