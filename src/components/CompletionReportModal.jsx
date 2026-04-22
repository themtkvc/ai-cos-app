// ─────────────────────────────────────────────────────────────────
// CompletionReportModal
// Bir işbirliği "tamamlandı" olarak işaretlendiğinde personelin dolduracağı
// yapılandırılmış sonuç raporu formunu gösterir. Düzenleme ve görüntüleme
// için de aynı modal kullanılır.
//
// Prop'lar:
// - collaboration:       { id, title, partner_name, reached_beneficiaries, ... }
// - existingReport:      (opsiyonel) mevcut rapor kaydı — düzenleme için
// - submittedBy:         { user_id, full_name }  — mevcut kullanıcı
// - onSaved(report):     kaydetme sonrası parent'a bildirir
// - onClose():           modal kapatma
// ─────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { upsertCollabCompletionReport } from '../lib/supabase';

// Çıktı tipleri (checkbox grubu) — işbirliği türüne göre sık rastlanan teslimatlar
const DELIVERABLE_OPTIONS = [
  { id: 'rapor',           label: 'Rapor' },
  { id: 'brosur',          label: 'Broşür' },
  { id: 'sunum',           label: 'Sunum' },
  { id: 'toplanti_kaydi',  label: 'Toplantı tutanağı' },
  { id: 'mou',             label: 'MoU / Protokol' },
  { id: 'liste',           label: 'Liste / Veri seti' },
  { id: 'web_icerigi',     label: 'Web içeriği' },
  { id: 'medya',           label: 'Medya / Sosyal medya' },
  { id: 'egitim',          label: 'Eğitim materyali' },
  { id: 'analiz',          label: 'Analiz / Araştırma' },
  { id: 'bagis_nakit',     label: 'Bağış / Nakit akışı' },
  { id: 'diger',           label: 'Diğer' },
];

const ACHIEVEMENT_LEVELS = [
  { id: 'tam',        label: 'Tam olarak ulaşıldı',      color: '#16a34a' },
  { id: 'cogunlukla', label: 'Çoğunlukla ulaşıldı',       color: '#22c55e' },
  { id: 'kismen',     label: 'Kısmen ulaşıldı',           color: '#eab308' },
  { id: 'sinirli',    label: 'Sınırlı ulaşıldı',          color: '#f97316' },
  { id: 'basarisiz',  label: 'Ulaşılamadı',               color: '#dc2626' },
];

const labelStyle = {
  fontSize: 11.5,
  fontWeight: 700,
  opacity: 0.72,
  textTransform: 'uppercase',
  letterSpacing: 0.3,
  marginBottom: 4,
  display: 'block',
};
const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  fontSize: 14,
  borderRadius: 8,
  border: '1.5px solid var(--border, rgba(0,0,0,0.14))',
  background: 'var(--bg-card, #fff)',
  color: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};
const textareaStyle = { ...inputStyle, minHeight: 72, resize: 'vertical', lineHeight: 1.45 };
const helpStyle = { fontSize: 11.5, opacity: 0.6, marginTop: 3 };
const rowStyle  = { display: 'grid', gap: 12 };

export default function CompletionReportModal({
  collaboration,
  existingReport = null,
  submittedBy,
  onSaved,
  onClose,
}) {
  const isEdit = !!existingReport?.id;

  const [form, setForm] = useState(() => ({
    summary:                existingReport?.summary                || '',
    objectives_planned:     existingReport?.objectives_planned     || '',
    objectives_achieved:    existingReport?.objectives_achieved    || '',
    achievement_level:      existingReport?.achievement_level      || '',
    quantitative_outputs:   existingReport?.quantitative_outputs   || '',
    reached_beneficiaries:  existingReport?.reached_beneficiaries ?? collaboration?.reached_beneficiaries ?? '',
    effort_hours:           existingReport?.effort_hours           ?? '',
    deliverables:           existingReport?.deliverables           || [],
    partner_feedback:       existingReport?.partner_feedback       || '',
    stakeholder_signoff:    !!existingReport?.stakeholder_signoff,
    what_worked:            existingReport?.what_worked            || '',
    challenges:             existingReport?.challenges             || '',
    lessons_learned:        existingReport?.lessons_learned        || '',
    follow_up_actions:      existingReport?.follow_up_actions      || '',
    attachment_urls:        existingReport?.attachment_urls        || [],
  }));

  const [attachInput, setAttachInput] = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const toggleDeliverable = (id) => {
    setForm((s) => {
      const have = s.deliverables.includes(id);
      return {
        ...s,
        deliverables: have ? s.deliverables.filter((x) => x !== id) : [...s.deliverables, id],
      };
    });
  };

  const addAttachment = () => {
    const u = attachInput.trim();
    if (!u) return;
    // Basit URL guard
    if (!/^https?:\/\//i.test(u)) {
      setError('Ek linki http(s):// ile başlamalı.');
      return;
    }
    setForm((s) => ({ ...s, attachment_urls: [...s.attachment_urls, u] }));
    setAttachInput('');
    setError('');
  };

  const removeAttachment = (idx) => {
    setForm((s) => ({
      ...s,
      attachment_urls: s.attachment_urls.filter((_, i) => i !== idx),
    }));
  };

  // Temel validasyonlar (ui layer)
  const missingRequired = useMemo(() => {
    if (!form.summary.trim()) return 'Özet alanı zorunludur.';
    if (!form.achievement_level) return 'Başarı seviyesi seçilmelidir.';
    return null;
  }, [form.summary, form.achievement_level]);

  const handleSave = async () => {
    if (missingRequired) { setError(missingRequired); return; }
    setError('');
    setSaving(true);
    try {
      const payload = {
        collaboration_id:      collaboration.id,
        summary:               form.summary.trim(),
        objectives_planned:    form.objectives_planned.trim() || null,
        objectives_achieved:   form.objectives_achieved.trim() || null,
        achievement_level:     form.achievement_level,
        quantitative_outputs:  form.quantitative_outputs.trim() || null,
        reached_beneficiaries: form.reached_beneficiaries === '' ? null : Number(form.reached_beneficiaries),
        effort_hours:          form.effort_hours === '' ? null : Number(form.effort_hours),
        deliverables:          form.deliverables,
        partner_feedback:      form.partner_feedback.trim() || null,
        stakeholder_signoff:   !!form.stakeholder_signoff,
        what_worked:           form.what_worked.trim() || null,
        challenges:            form.challenges.trim() || null,
        lessons_learned:       form.lessons_learned.trim() || null,
        follow_up_actions:     form.follow_up_actions.trim() || null,
        attachment_urls:       form.attachment_urls,
        // İlk kayıtta submitted_by/at set edilir; update'de değişmemeli.
        ...(isEdit ? {} : {
          submitted_by:        submittedBy?.user_id,
          submitted_by_name:   submittedBy?.full_name || null,
        }),
      };

      const { data, error: saveErr } = await upsertCollabCompletionReport(payload);
      if (saveErr) throw saveErr;
      onSaved?.(data);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Rapor kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  // ESC ile kapatma
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 16px', zIndex: 1000, overflowY: 'auto',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div style={{
        width: 'min(760px, 100%)', background: 'var(--bg-card, #fff)',
        color: 'inherit', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
        padding: 22, display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {/* Başlık */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, opacity: 0.6, textTransform: 'uppercase' }}>
              İşbirliği Sonuç Raporu
            </div>
            <div style={{ fontSize: 19, fontWeight: 700, marginTop: 2 }}>
              {collaboration?.title || '—'}
            </div>
            {collaboration?.partner_name && (
              <div style={{ fontSize: 12.5, opacity: 0.65, marginTop: 1 }}>
                Partner: {collaboration.partner_name}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            style={{
              border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer',
              opacity: 0.55, padding: '4px 8px', lineHeight: 1,
            }}
          >✕</button>
        </div>

        {/* Bilgi çubuğu */}
        <div style={{
          padding: '8px 12px', fontSize: 12.5, borderRadius: 8,
          background: 'rgba(37, 99, 235, 0.08)',
          border: '1px solid rgba(37, 99, 235, 0.18)',
          color: '#1d4ed8',
          lineHeight: 1.45,
        }}>
          Bu form, işbirliği tamamlandığında bir kerelik doldurulur. Koordinatör/direktör
          sonradan inceleyip not bırakabilir. Özet ve Başarı seviyesi zorunludur;
          diğer alanları boş bırakabilirsiniz.
        </div>

        {/* 1) Özet */}
        <div style={rowStyle}>
          <div>
            <label style={labelStyle}>Özet *</label>
            <textarea
              value={form.summary}
              onChange={(e) => set('summary', e.target.value)}
              placeholder="Ne yapıldı? 2-3 cümlelik kısa özet."
              style={textareaStyle}
            />
          </div>
        </div>

        {/* 2) Plan vs Gerçekleşen */}
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label style={labelStyle}>Planlanan Hedefler</label>
            <textarea
              value={form.objectives_planned}
              onChange={(e) => set('objectives_planned', e.target.value)}
              placeholder="İşbirliği başında ne hedeflenmişti?"
              style={textareaStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Ulaşılan Hedefler</label>
            <textarea
              value={form.objectives_achieved}
              onChange={(e) => set('objectives_achieved', e.target.value)}
              placeholder="Gerçekte nelere ulaşıldı?"
              style={textareaStyle}
            />
          </div>
        </div>

        {/* 3) Başarı seviyesi */}
        <div>
          <label style={labelStyle}>Başarı Seviyesi *</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ACHIEVEMENT_LEVELS.map((lvl) => {
              const active = form.achievement_level === lvl.id;
              return (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => set('achievement_level', lvl.id)}
                  style={{
                    padding: '7px 12px',
                    fontSize: 12.5,
                    borderRadius: 999,
                    border: `1.5px solid ${active ? lvl.color : 'rgba(0,0,0,0.14)'}`,
                    background: active ? lvl.color : 'transparent',
                    color: active ? '#fff' : 'inherit',
                    cursor: 'pointer',
                    fontWeight: active ? 700 : 500,
                  }}
                >{lvl.label}</button>
              );
            })}
          </div>
        </div>

        {/* 4) Ölçülebilir çıktılar */}
        <div>
          <label style={labelStyle}>Ölçülebilir Çıktılar</label>
          <textarea
            value={form.quantitative_outputs}
            onChange={(e) => set('quantitative_outputs', e.target.value)}
            placeholder="Örn. 4 bilet alındı, 2 otel rezervasyonu, 50 katılımcı, 3 rapor yayınlandı…"
            style={textareaStyle}
          />
        </div>

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label style={labelStyle}>Ulaşılan Kişi Sayısı</label>
            <input
              type="number"
              min="0"
              value={form.reached_beneficiaries}
              onChange={(e) => set('reached_beneficiaries', e.target.value)}
              placeholder="opsiyonel"
              style={inputStyle}
            />
            <div style={helpStyle}>İşbirliği kaydındaki değer otomatik doldurulur.</div>
          </div>
          <div>
            <label style={labelStyle}>Harcanan Toplam Saat (tahmini)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={form.effort_hours}
              onChange={(e) => set('effort_hours', e.target.value)}
              placeholder="örn. 48"
              style={inputStyle}
            />
          </div>
        </div>

        {/* 5) Deliverables */}
        <div>
          <label style={labelStyle}>Üretilen Çıktı Tipleri</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {DELIVERABLE_OPTIONS.map((opt) => {
              const on = form.deliverables.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleDeliverable(opt.id)}
                  style={{
                    padding: '6px 11px', fontSize: 12.5, borderRadius: 999,
                    border: `1.5px solid ${on ? '#2563eb' : 'rgba(0,0,0,0.14)'}`,
                    background: on ? 'rgba(37,99,235,0.12)' : 'transparent',
                    color: on ? '#1d4ed8' : 'inherit',
                    cursor: 'pointer', fontWeight: on ? 700 : 500,
                  }}
                >{on ? '✓ ' : ''}{opt.label}</button>
              );
            })}
          </div>
        </div>

        {/* 6) Partner / Stakeholder */}
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '2fr 1fr' }}>
          <div>
            <label style={labelStyle}>Partner / Paydaş Geri Bildirimi</label>
            <textarea
              value={form.partner_feedback}
              onChange={(e) => set('partner_feedback', e.target.value)}
              placeholder="Partnerden gelen memnuniyet/eleştiri/öneri notu."
              style={textareaStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Paydaş Onayı</label>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
              border: '1.5px solid var(--border, rgba(0,0,0,0.14))', borderRadius: 8,
              cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={form.stakeholder_signoff}
                onChange={(e) => set('stakeholder_signoff', e.target.checked)}
              />
              <span style={{ fontSize: 13 }}>Partner/paydaş bu kapanışı teyit etti</span>
            </label>
            <div style={helpStyle}>MoU süreci varsa imza teyidi dahildir.</div>
          </div>
        </div>

        {/* 7) Öğrenim */}
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div>
            <label style={labelStyle}>Neler İyi Gitti?</label>
            <textarea
              value={form.what_worked}
              onChange={(e) => set('what_worked', e.target.value)}
              placeholder="Tekrar edilecek/yayılacak güçlü pratikler."
              style={textareaStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Zorluklar / Darboğazlar</label>
            <textarea
              value={form.challenges}
              onChange={(e) => set('challenges', e.target.value)}
              placeholder="Aksi giden ya da geciken şeyler."
              style={textareaStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Öğrenilenler</label>
            <textarea
              value={form.lessons_learned}
              onChange={(e) => set('lessons_learned', e.target.value)}
              placeholder="Bir dahaki sefere farklı yapılacaklar."
              style={textareaStyle}
            />
          </div>
        </div>

        {/* 8) Takip */}
        <div>
          <label style={labelStyle}>Sonraki Adımlar / Takip İşleri</label>
          <textarea
            value={form.follow_up_actions}
            onChange={(e) => set('follow_up_actions', e.target.value)}
            placeholder="Bu işbirliğinden doğan açık işler — yeni gündem oluşturulacaksa kısaca yaz."
            style={textareaStyle}
          />
        </div>

        {/* 9) Ekler */}
        <div>
          <label style={labelStyle}>Ek Linkler (rapor, sunum, Drive bağlantısı)</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={attachInput}
              onChange={(e) => setAttachInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAttachment(); } }}
              placeholder="https://…"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              type="button"
              onClick={addAttachment}
              style={{
                padding: '9px 14px', borderRadius: 8, border: 'none',
                background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer',
                fontSize: 13,
              }}
            >Ekle</button>
          </div>
          {form.attachment_urls.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {form.attachment_urls.map((u, i) => (
                <li key={i} style={{
                  display: 'flex', justifyContent: 'space-between', gap: 8,
                  padding: '6px 10px', borderRadius: 6, background: 'rgba(0,0,0,0.04)',
                  fontSize: 12.5,
                }}>
                  <a href={u} target="_blank" rel="noreferrer"
                     style={{ color: '#1d4ed8', wordBreak: 'break-all' }}>
                    {u}
                  </a>
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    style={{
                      border: 'none', background: 'transparent', color: '#dc2626',
                      cursor: 'pointer', fontSize: 12,
                    }}
                  >Kaldır</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Hata alanı */}
        {error && (
          <div style={{
            background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.35)',
            color: '#991b1b', borderRadius: 8, padding: '8px 12px', fontSize: 13,
          }}>{error}</div>
        )}

        {/* Aksiyon çubuğu */}
        <div style={{
          display: 'flex', gap: 8, justifyContent: 'flex-end',
          borderTop: '1px solid var(--border, rgba(0,0,0,0.08))',
          paddingTop: 12, marginTop: 2,
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '9px 16px', borderRadius: 8,
              border: '1.5px solid var(--border, rgba(0,0,0,0.14))',
              background: 'transparent', color: 'inherit',
              cursor: 'pointer', fontSize: 13,
            }}
          >İptal</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '9px 18px', borderRadius: 8, border: 'none',
              background: '#16a34a', color: '#fff', fontWeight: 700,
              cursor: 'pointer', fontSize: 13, opacity: saving ? 0.6 : 1,
            }}
          >{saving ? 'Kaydediliyor…' : (isEdit ? 'Raporu Güncelle' : 'Raporu Kaydet')}</button>
        </div>
      </div>
    </div>
  );
}
