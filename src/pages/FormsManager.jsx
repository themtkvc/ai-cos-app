import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getForms, getFormById, createForm, updateForm, deleteForm,
  getFormFields, upsertFormFields, deleteFormField, deleteFormFieldsByFormId,
  getFormResponses, getAllFormResponseData, submitFormResponse,
  supabase,
} from '../lib/supabase';

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════

const FIELD_TYPES = [
  { type: 'short_text',       label: 'Kısa Metin',        icon: '📝', group: 'text' },
  { type: 'long_text',        label: 'Uzun Metin',         icon: '📄', group: 'text' },
  { type: 'number',           label: 'Sayı',               icon: '🔢', group: 'text' },
  { type: 'email',            label: 'E-posta',            icon: '📧', group: 'text' },
  { type: 'phone',            label: 'Telefon',            icon: '📱', group: 'text' },
  { type: 'url',              label: 'URL / Link',         icon: '🔗', group: 'text' },
  { type: 'single_choice',    label: 'Tekli Seçim',        icon: '⭕', group: 'choice' },
  { type: 'multiple_choice',  label: 'Çoklu Seçim',        icon: '☑️', group: 'choice' },
  { type: 'dropdown',         label: 'Açılır Menü',        icon: '📋', group: 'choice' },
  { type: 'yes_no',           label: 'Evet / Hayır',       icon: '✅', group: 'choice' },
  { type: 'linear_scale',     label: 'Doğrusal Ölçek',     icon: '📏', group: 'scale' },
  { type: 'rating',           label: 'Yıldız Derecelendirme', icon: '⭐', group: 'scale' },
  { type: 'date',             label: 'Tarih',              icon: '📅', group: 'datetime' },
  { type: 'time',             label: 'Saat',               icon: '🕐', group: 'datetime' },
  { type: 'datetime',         label: 'Tarih & Saat',       icon: '📆', group: 'datetime' },
  { type: 'file_upload',      label: 'Dosya Yükleme',      icon: '📎', group: 'other' },
  { type: 'section_header',   label: 'Bölüm Başlığı',      icon: '📑', group: 'layout' },
  { type: 'description_text', label: 'Açıklama Metni',     icon: '💬', group: 'layout' },
  { type: 'matrix_single',    label: 'Matris (Tekli)',      icon: '▦',  group: 'advanced' },
  { type: 'matrix_multiple',  label: 'Matris (Çoklu)',      icon: '▣',  group: 'advanced' },
  { type: 'ranking',          label: 'Sıralama',           icon: '🏅', group: 'advanced' },
];

const FIELD_GROUPS = {
  text: 'Metin Alanları',
  choice: 'Seçim Alanları',
  scale: 'Ölçek & Derecelendirme',
  datetime: 'Tarih & Saat',
  layout: 'Düzen',
  advanced: 'Gelişmiş',
  other: 'Diğer',
};

const STATUS_CONFIG = {
  draft:    { label: 'Taslak',    color: 'var(--text-muted)', bg: 'var(--gray-light)', icon: '📝' },
  active:   { label: 'Aktif',     color: 'var(--green)',       bg: 'var(--green-pale)', icon: '🟢' },
  closed:   { label: 'Kapalı',    color: 'var(--orange)',      bg: 'var(--orange-pale)', icon: '🔒' },
  archived: { label: 'Arşiv',     color: 'var(--text-light)',  bg: 'var(--gray-light)', icon: '📦' },
};

const VIS_CONFIG = {
  internal: { label: 'İç Kullanım', icon: '🏢', desc: 'Sadece sisteme giriş yapanlar' },
  unit:     { label: 'Birime Özel', icon: '👥', desc: 'Belirli birim/departman' },
  public:   { label: 'Herkese Açık', icon: '🌐', desc: 'Link ile herkes doldurabilir' },
};

function generateSlug() {
  return Math.random().toString(36).substring(2, 10);
}

// ── Styles ────────────────────────────────────────────────────────────────────
const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1.5px solid var(--border)', background: 'var(--bg-input, var(--white))',
  color: 'var(--text)', fontSize: 13.5, fontFamily: 'inherit',
  outline: 'none', transition: 'border-color 0.15s',
};

const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: 'var(--text)', marginBottom: 5, letterSpacing: '0.01em',
};

const cardStyle = {
  background: 'var(--bg-card, var(--white))', border: '1px solid var(--border)',
  borderRadius: 14, padding: 20, boxShadow: 'var(--shadow-sm)',
};

// ══════════════════════════════════════════════════════════════════════════════
// FIELD EDITOR COMPONENT (used in FormBuilder)
// ══════════════════════════════════════════════════════════════════════════════
function FieldEditor({ field, index, totalFields, onChange, onDelete, onMoveUp, onMoveDown }) {
  const ft = FIELD_TYPES.find(f => f.type === field.field_type);
  const hasOptions = ['single_choice', 'multiple_choice', 'dropdown', 'ranking'].includes(field.field_type);
  const hasMatrix = ['matrix_single', 'matrix_multiple'].includes(field.field_type);
  const hasScale = ['linear_scale', 'rating'].includes(field.field_type);
  const isLayout = ['section_header', 'description_text'].includes(field.field_type);

  const updateField = (key, value) => onChange(index, { ...field, [key]: value });
  const updateProps = (key, value) => onChange(index, { ...field, properties: { ...field.properties, [key]: value } });

  const options = field.options || [];
  const addOption = () => onChange(index, { ...field, options: [...options, { label: `Seçenek ${options.length + 1}`, value: `opt_${options.length + 1}` }] });
  const updateOption = (i, label) => {
    const newOpts = [...options];
    newOpts[i] = { ...newOpts[i], label };
    onChange(index, { ...field, options: newOpts });
  };
  const removeOption = (i) => onChange(index, { ...field, options: options.filter((_, idx) => idx !== i) });

  // Matrix rows/cols
  const matrixRows = field.properties?.rows || [];
  const matrixCols = field.properties?.columns || [];

  return (
    <div style={{
      ...cardStyle, padding: 16, marginBottom: 10,
      borderLeft: `4px solid ${isLayout ? 'var(--gold)' : 'var(--primary)'}`,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>{ft?.icon || '❓'}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {ft?.label}
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={() => onMoveUp(index)} disabled={index === 0}
          style={{ background: 'none', border: 'none', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.3 : 1, fontSize: 14 }}>⬆</button>
        <button onClick={() => onMoveDown(index)} disabled={index === totalFields - 1}
          style={{ background: 'none', border: 'none', cursor: index === totalFields - 1 ? 'default' : 'pointer', opacity: index === totalFields - 1 ? 0.3 : 1, fontSize: 14 }}>⬇</button>
        <button onClick={() => onDelete(index)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 14 }}>🗑</button>
      </div>

      {/* Label */}
      <input value={field.label} onChange={e => updateField('label', e.target.value)}
        placeholder={isLayout ? 'Bölüm başlığı...' : 'Soru metni...'}
        style={{ ...inputStyle, fontWeight: 600, fontSize: 14, marginBottom: 8 }}
        onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />

      {/* Description */}
      {!isLayout && (
        <input value={field.description || ''} onChange={e => updateField('description', e.target.value)}
          placeholder="Açıklama (opsiyonel)"
          style={{ ...inputStyle, fontSize: 12.5, marginBottom: 8, color: 'var(--text-muted)' }}
          onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
      )}

      {/* Options for choice fields */}
      {hasOptions && (
        <div style={{ marginBottom: 8 }}>
          {options.map((opt, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--text-light)', width: 20, textAlign: 'center' }}>
                {field.field_type === 'single_choice' ? '○' : field.field_type === 'ranking' ? `${i + 1}.` : '☐'}
              </span>
              <input value={opt.label} onChange={e => updateOption(i, e.target.value)}
                style={{ ...inputStyle, padding: '6px 10px', fontSize: 12.5, flex: 1 }}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
              <button onClick={() => removeOption(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', fontSize: 12 }}>✕</button>
            </div>
          ))}
          <button onClick={addOption}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--primary)', fontSize: 12, fontWeight: 600, marginTop: 4,
            }}>+ Seçenek Ekle</button>
        </div>
      )}

      {/* Matrix rows & columns */}
      {hasMatrix && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Satırlar</div>
            {matrixRows.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 3 }}>
                <input value={r} onChange={e => {
                  const newRows = [...matrixRows]; newRows[i] = e.target.value;
                  updateProps('rows', newRows);
                }} style={{ ...inputStyle, padding: '5px 8px', fontSize: 12, flex: 1 }}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
                <button onClick={() => updateProps('rows', matrixRows.filter((_, idx) => idx !== i))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', fontSize: 11 }}>✕</button>
              </div>
            ))}
            <button onClick={() => updateProps('rows', [...matrixRows, `Satır ${matrixRows.length + 1}`])}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: 11, fontWeight: 600 }}>+ Satır</button>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Sütunlar</div>
            {matrixCols.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 3 }}>
                <input value={c} onChange={e => {
                  const newCols = [...matrixCols]; newCols[i] = e.target.value;
                  updateProps('columns', newCols);
                }} style={{ ...inputStyle, padding: '5px 8px', fontSize: 12, flex: 1 }}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
                <button onClick={() => updateProps('columns', matrixCols.filter((_, idx) => idx !== i))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', fontSize: 11 }}>✕</button>
              </div>
            ))}
            <button onClick={() => updateProps('columns', [...matrixCols, `Sütun ${matrixCols.length + 1}`])}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: 11, fontWeight: 600 }}>+ Sütun</button>
          </div>
        </div>
      )}

      {/* Scale settings */}
      {hasScale && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
          {field.field_type === 'linear_scale' && (
            <>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3 }}>Min</div>
                <input type="number" value={field.properties?.min ?? 1} onChange={e => updateProps('min', Number(e.target.value))}
                  style={{ ...inputStyle, padding: '5px 8px', fontSize: 12 }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3 }}>Max</div>
                <input type="number" value={field.properties?.max ?? 5} onChange={e => updateProps('max', Number(e.target.value))}
                  style={{ ...inputStyle, padding: '5px 8px', fontSize: 12 }} />
              </div>
              <div style={{ flex: 2 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3 }}>Min Etiket</div>
                <input value={field.properties?.minLabel || ''} onChange={e => updateProps('minLabel', e.target.value)}
                  placeholder="Ör: Hiç katılmıyorum" style={{ ...inputStyle, padding: '5px 8px', fontSize: 12 }}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
              </div>
              <div style={{ flex: 2 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3 }}>Max Etiket</div>
                <input value={field.properties?.maxLabel || ''} onChange={e => updateProps('maxLabel', e.target.value)}
                  placeholder="Ör: Tamamen katılıyorum" style={{ ...inputStyle, padding: '5px 8px', fontSize: 12 }}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
              </div>
            </>
          )}
          {field.field_type === 'rating' && (
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3 }}>Yıldız Sayısı</div>
              <select value={field.properties?.maxStars ?? 5} onChange={e => updateProps('maxStars', Number(e.target.value))}
                style={{ ...inputStyle, padding: '5px 8px', fontSize: 12, width: 80 }}>
                {[3, 4, 5, 7, 10].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Required toggle */}
      {!isLayout && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={field.required || false}
            onChange={e => updateField('required', e.target.checked)} />
          Zorunlu alan
        </label>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FIELD RENDERER (for FormFill)
// ══════════════════════════════════════════════════════════════════════════════
function FieldRenderer({ field, value, onChange }) {
  const props = field.properties || {};

  switch (field.field_type) {
    case 'section_header':
      return (
        <div style={{ marginTop: 20, marginBottom: 8, paddingBottom: 8, borderBottom: '2px solid var(--primary)' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{field.label}</div>
          {field.description && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{field.description}</div>}
        </div>
      );
    case 'description_text':
      return (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, padding: '8px 0' }}>
          {field.label}
        </div>
      );
    case 'short_text':
    case 'email':
    case 'phone':
    case 'url':
      return (
        <input type={field.field_type === 'email' ? 'email' : field.field_type === 'phone' ? 'tel' : field.field_type === 'url' ? 'url' : 'text'}
          value={value || ''} onChange={e => onChange(e.target.value)} required={field.required}
          placeholder={field.description || ''} style={inputStyle}
          onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
      );
    case 'long_text':
      return (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} required={field.required}
          placeholder={field.description || ''} rows={4}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
          onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
      );
    case 'number':
      return (
        <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
          required={field.required} placeholder={field.description || ''} style={{ ...inputStyle, width: 200 }}
          onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
      );
    case 'date':
      return <input type="date" value={value || ''} onChange={e => onChange(e.target.value)} required={field.required} style={inputStyle} />;
    case 'time':
      return <input type="time" value={value || ''} onChange={e => onChange(e.target.value)} required={field.required} style={inputStyle} />;
    case 'datetime':
      return <input type="datetime-local" value={value || ''} onChange={e => onChange(e.target.value)} required={field.required} style={inputStyle} />;
    case 'yes_no':
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ v: 'yes', l: '✅ Evet' }, { v: 'no', l: '❌ Hayır' }].map(opt => (
            <button key={opt.v} type="button" onClick={() => onChange(opt.v)}
              style={{
                padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                border: value === opt.v ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                background: value === opt.v ? 'var(--primary-light)' : 'var(--bg-card)',
                color: value === opt.v ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              }}>
              {opt.l}
            </button>
          ))}
        </div>
      );
    case 'single_choice':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(field.options || []).map((opt, i) => (
            <label key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
              border: value === opt.label ? '2px solid var(--primary)' : '1.5px solid var(--border)',
              background: value === opt.label ? 'var(--primary-light)' : 'var(--bg-card)',
            }}>
              <input type="radio" name={`field_${field.id}`} checked={value === opt.label}
                onChange={() => onChange(opt.label)} style={{ accentColor: 'var(--primary)' }} />
              <span style={{ fontSize: 13.5, color: 'var(--text)' }}>{opt.label}</span>
            </label>
          ))}
        </div>
      );
    case 'multiple_choice':
      const selected = Array.isArray(value) ? value : [];
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(field.options || []).map((opt, i) => {
            const isChecked = selected.includes(opt.label);
            return (
              <label key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                border: isChecked ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                background: isChecked ? 'var(--primary-light)' : 'var(--bg-card)',
              }}>
                <input type="checkbox" checked={isChecked}
                  onChange={() => {
                    if (isChecked) onChange(selected.filter(v => v !== opt.label));
                    else onChange([...selected, opt.label]);
                  }} style={{ accentColor: 'var(--primary)' }} />
                <span style={{ fontSize: 13.5, color: 'var(--text)' }}>{opt.label}</span>
              </label>
            );
          })}
        </div>
      );
    case 'dropdown':
      return (
        <select value={value || ''} onChange={e => onChange(e.target.value)} required={field.required} style={inputStyle}>
          <option value="">Seçiniz...</option>
          {(field.options || []).map((opt, i) => <option key={i} value={opt.label}>{opt.label}</option>)}
        </select>
      );
    case 'linear_scale': {
      const min = props.min ?? 1;
      const max = props.max ?? 5;
      const range = [];
      for (let i = min; i <= max; i++) range.push(i);
      return (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, justifyContent: 'center' }}>
            {props.minLabel && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 8 }}>{props.minLabel}</span>}
            {range.map(n => (
              <button key={n} type="button" onClick={() => onChange(n)}
                style={{
                  width: 40, height: 40, borderRadius: '50%', border: value === n ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                  background: value === n ? 'var(--primary)' : 'var(--bg-card)', color: value === n ? '#fff' : 'var(--text)',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer', margin: '0 3px', fontFamily: 'inherit', transition: 'all 0.15s',
                }}>
                {n}
              </button>
            ))}
            {props.maxLabel && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{props.maxLabel}</span>}
          </div>
        </div>
      );
    }
    case 'rating': {
      const maxStars = props.maxStars || 5;
      const currentVal = typeof value === 'number' ? value : 0;
      return (
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: maxStars }, (_, i) => i + 1).map(n => (
            <button key={n} type="button" onClick={() => onChange(n)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 28,
                color: n <= currentVal ? '#f59e0b' : 'var(--gray-mid)', transition: 'color 0.15s',
              }}>
              ★
            </button>
          ))}
        </div>
      );
    }
    case 'matrix_single':
    case 'matrix_multiple': {
      const rows = props.rows || [];
      const cols = props.columns || [];
      const matVal = (typeof value === 'object' && value) ? value : {};
      const isSingle = field.field_type === 'matrix_single';
      return (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid var(--border)' }}></th>
                {cols.map((c, i) => (
                  <th key={i} style={{ padding: 8, textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} style={{ borderBottom: '1px solid var(--border-light, var(--border))' }}>
                  <td style={{ padding: 8, fontSize: 13, color: 'var(--text)' }}>{r}</td>
                  {cols.map((c, ci) => (
                    <td key={ci} style={{ padding: 8, textAlign: 'center' }}>
                      <input
                        type={isSingle ? 'radio' : 'checkbox'}
                        name={`matrix_${field.id}_${ri}`}
                        checked={isSingle ? matVal[r] === c : (Array.isArray(matVal[r]) && matVal[r].includes(c))}
                        onChange={() => {
                          const newVal = { ...matVal };
                          if (isSingle) {
                            newVal[r] = c;
                          } else {
                            const arr = Array.isArray(newVal[r]) ? [...newVal[r]] : [];
                            if (arr.includes(c)) newVal[r] = arr.filter(v => v !== c);
                            else newVal[r] = [...arr, c];
                          }
                          onChange(newVal);
                        }}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case 'ranking': {
      const items = Array.isArray(value) ? value : (field.options || []).map(o => o.label);
      const moveItem = (from, to) => {
        const arr = [...items];
        const [item] = arr.splice(from, 1);
        arr.splice(to, 0, item);
        onChange(arr);
      };
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
              borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg-card)',
            }}>
              <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 14, width: 20 }}>{i + 1}.</span>
              <span style={{ flex: 1, fontSize: 13.5 }}>{item}</span>
              <button type="button" disabled={i === 0} onClick={() => moveItem(i, i - 1)}
                style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1, fontSize: 12 }}>⬆</button>
              <button type="button" disabled={i === items.length - 1} onClick={() => moveItem(i, i + 1)}
                style={{ background: 'none', border: 'none', cursor: i === items.length - 1 ? 'default' : 'pointer', opacity: i === items.length - 1 ? 0.3 : 1, fontSize: 12 }}>⬇</button>
            </div>
          ))}
        </div>
      );
    }
    case 'file_upload':
      return (
        <div style={{
          padding: 24, border: '2px dashed var(--border)', borderRadius: 12,
          textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📎</div>
          Dosya yükleme (gelecek sürümde aktif olacak)
        </div>
      );
    default:
      return <input value={value || ''} onChange={e => onChange(e.target.value)} style={inputStyle} />;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function FormsManager({ user, profile }) {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'builder' | 'fill' | 'responses'
  const [activeForm, setActiveForm] = useState(null);
  const [fields, setFields] = useState([]);
  const [saving, setSaving] = useState(false);

  // Form fill state
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  // Responses state
  const [responses, setResponses] = useState([]);
  const [responseData, setResponseData] = useState([]);

  // New form
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formVisibility, setFormVisibility] = useState('internal');
  const [formStatus, setFormStatus] = useState('draft');
  const [formAllowAnon, setFormAllowAnon] = useState(false);
  const [formAllowMultiple, setFormAllowMultiple] = useState(false);
  const [formConfirmMsg, setFormConfirmMsg] = useState('Yanıtınız kaydedildi. Teşekkürler!');

  const isDirektor = profile?.role === 'direktor';
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';

  const loadForms = useCallback(async () => {
    setLoading(true);
    const { data } = await getForms();
    // Auto-fix: public formlar draft ise otomatik aktif yap (anon RLS gereksinimi)
    if (data) {
      for (const f of data) {
        if (f.visibility === 'public' && f.status === 'draft' && f.created_by === user?.id) {
          await updateForm(f.id, { status: 'active' });
          f.status = 'active';
        }
      }
    }
    setForms(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadForms(); }, [loadForms]);

  // ── List helpers ──
  const myForms = useMemo(() => forms.filter(f => f.created_by === user?.id), [forms, user]);
  const otherForms = useMemo(() => forms.filter(f => f.created_by !== user?.id && f.status === 'active'), [forms, user]);

  // ── Open Builder ──
  const openBuilder = async (form = null) => {
    if (form) {
      setActiveForm(form);
      setFormTitle(form.title);
      setFormDesc(form.description || '');
      setFormVisibility(form.visibility || 'internal');
      setFormStatus(form.status || 'draft');
      setFormAllowAnon(form.allow_anonymous || false);
      setFormAllowMultiple(form.allow_multiple_responses || false);
      setFormConfirmMsg(form.confirmation_message || 'Yanıtınız kaydedildi. Teşekkürler!');
      const { data: flds } = await getFormFields(form.id);
      setFields((flds || []).map(f => ({ ...f, _existing: true })));
    } else {
      setActiveForm(null);
      setFormTitle('');
      setFormDesc('');
      setFormVisibility('internal');
      setFormStatus('draft');
      setFormAllowAnon(false);
      setFormAllowMultiple(false);
      setFormConfirmMsg('Yanıtınız kaydedildi. Teşekkürler!');
      setFields([]);
    }
    setView('builder');
  };

  // ── Open Fill ──
  const openFill = async (form) => {
    setActiveForm(form);
    const { data: flds } = await getFormFields(form.id);
    setFields(flds || []);
    setAnswers({});
    setSubmitted(false);
    setView('fill');
  };

  // ── Open Responses ──
  const openResponses = async (form) => {
    setActiveForm(form);
    const { data: flds } = await getFormFields(form.id);
    setFields(flds || []);
    const { data: respData } = await getAllFormResponseData(form.id);
    setResponseData(respData || []);
    setView('responses');
  };

  // ── Add Field ──
  const addField = (type) => {
    const ft = FIELD_TYPES.find(f => f.type === type);
    const newField = {
      id: crypto.randomUUID(),
      form_id: activeForm?.id || null,
      field_type: type,
      label: ft?.label || 'Yeni Soru',
      description: '',
      required: false,
      options: ['single_choice', 'multiple_choice', 'dropdown', 'ranking'].includes(type)
        ? [{ label: 'Seçenek 1', value: 'opt_1' }, { label: 'Seçenek 2', value: 'opt_2' }]
        : null,
      properties: ['matrix_single', 'matrix_multiple'].includes(type)
        ? { rows: ['Satır 1', 'Satır 2'], columns: ['Sütun 1', 'Sütun 2', 'Sütun 3'] }
        : ['linear_scale'].includes(type)
        ? { min: 1, max: 5, minLabel: '', maxLabel: '' }
        : ['rating'].includes(type)
        ? { maxStars: 5 }
        : {},
      validation: null,
      conditional: null,
      sort_order: fields.length,
      _new: true,
    };
    setFields(prev => [...prev, newField]);
  };

  const updateFieldAt = (index, updated) => {
    setFields(prev => prev.map((f, i) => i === index ? updated : f));
  };

  const deleteFieldAt = (index) => {
    const f = fields[index];
    if (f._existing && f.id) deleteFormField(f.id);
    setFields(prev => prev.filter((_, i) => i !== index));
  };

  const moveFieldUp = (index) => {
    if (index === 0) return;
    setFields(prev => {
      const arr = [...prev];
      [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
      return arr;
    });
  };

  const moveFieldDown = (index) => {
    if (index === fields.length - 1) return;
    setFields(prev => {
      const arr = [...prev];
      [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
      return arr;
    });
  };

  // ── Save Form ──
  const saveForm = async () => {
    if (!formTitle.trim()) return;
    setSaving(true);

    // Public formlar draft olamaz — anon RLS politikası status='active' gerektirir
    const effectiveStatus = (formVisibility === 'public' && formStatus === 'draft') ? 'active' : formStatus;

    const formRecord = {
      title: formTitle,
      description: formDesc,
      visibility: formVisibility,
      status: effectiveStatus,
      allow_anonymous: formAllowAnon,
      allow_multiple_responses: formAllowMultiple,
      confirmation_message: formConfirmMsg,
    };

    let formId = activeForm?.id;

    if (activeForm) {
      await updateForm(activeForm.id, formRecord);
    } else {
      formRecord.created_by = user.id;
      formRecord.created_by_name = profile?.full_name || user.email;
      if (formVisibility === 'public') formRecord.public_slug = generateSlug();
      const { data } = await createForm(formRecord);
      if (data?.[0]) {
        formId = data[0].id;
        setActiveForm(data[0]);
      }
    }

    // If changing to public and no slug exists
    if (formVisibility === 'public' && activeForm && !activeForm.public_slug) {
      await updateForm(formId, { public_slug: generateSlug() });
    }

    // Save fields
    if (formId && fields.length > 0) {
      const fieldsToSave = fields.map((f, i) => ({
        id: f._new ? undefined : f.id,
        form_id: formId,
        field_type: f.field_type,
        label: f.label,
        description: f.description || null,
        required: f.required || false,
        options: f.options || null,
        validation: f.validation || null,
        conditional: f.conditional || null,
        properties: f.properties || null,
        sort_order: i,
      }));
      // Delete removed fields and upsert
      await deleteFormFieldsByFormId(formId);
      await upsertFormFields(fieldsToSave);
    }

    setSaving(false);
    await loadForms();
    setView('list');
  };

  // ── Submit Response ──
  const handleSubmitResponse = async (e) => {
    e.preventDefault();
    setSaving(true);

    const response = {
      form_id: activeForm.id,
      respondent_id: user?.id || null,
      respondent_name: profile?.full_name || 'Anonim',
      respondent_email: user?.email || null,
      is_anonymous: activeForm.allow_anonymous && !user,
    };

    const answerRows = Object.entries(answers).map(([fieldId, val]) => ({
      field_id: fieldId,
      value: val,
    }));

    const { error } = await submitFormResponse(response, answerRows);
    setSaving(false);

    if (!error) {
      setSubmitted(true);
    }
  };

  // ── Delete Form ──
  const handleDeleteForm = async (id) => {
    if (!window.confirm('Bu formu silmek istediğinize emin misiniz? Tüm yanıtlar da silinecek.')) return;
    await deleteForm(id);
    await loadForms();
  };

  // ── Public URL ──
  const getPublicUrl = (form) => {
    if (!form?.public_slug) return null;
    const appUrl = window.location.origin;
    return `${appUrl}#form/${form.public_slug}`;
  };

  const copyPublicUrl = (form) => {
    const url = getPublicUrl(form);
    if (url) {
      navigator.clipboard.writeText(url);
      alert('Link kopyalandı!');
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  // ── FORM FILL VIEW ──
  if (view === 'fill' && activeForm) {
    if (submitted) {
      return (
        <div className="page" style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 32px' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Yanıtınız Kaydedildi</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>{activeForm.confirmation_message}</div>
            <button onClick={() => { setView('list'); setActiveForm(null); }}
              style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              ← Formlara Dön
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="page" style={{ maxWidth: 640, margin: '0 auto' }}>
        <button onClick={() => { setView('list'); setActiveForm(null); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: 13, fontWeight: 600, marginBottom: 16, fontFamily: 'inherit' }}>
          ← Geri Dön
        </button>

        <div style={{ ...cardStyle, padding: '28px 24px', borderTop: `5px solid ${activeForm.theme_color || 'var(--primary)'}` }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>{activeForm.title}</h1>
          {activeForm.description && <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>{activeForm.description}</p>}
          {fields.some(f => f.required) && (
            <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>* Zorunlu alanlar</div>
          )}
        </div>

        <form onSubmit={handleSubmitResponse}>
          {fields.map(field => {
            if (['section_header', 'description_text'].includes(field.field_type)) {
              return <div key={field.id}><FieldRenderer field={field} value={null} onChange={() => {}} /></div>;
            }
            return (
              <div key={field.id} style={{ ...cardStyle, padding: '18px 20px', marginTop: 12 }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                    {field.label}
                    {field.required && <span style={{ color: 'var(--red)', marginLeft: 4 }}>*</span>}
                  </div>
                  {field.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{field.description}</div>}
                </div>
                <FieldRenderer field={field} value={answers[field.id]}
                  onChange={val => setAnswers(prev => ({ ...prev, [field.id]: val }))} />
              </div>
            );
          })}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" disabled={saving}
              style={{
                padding: '12px 32px', borderRadius: 10, border: 'none',
                background: saving ? 'var(--gray-mid)' : 'var(--primary)', color: '#fff',
                fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}>
              {saving ? '⏳ Gönderiliyor...' : '📨 Gönder'}
            </button>
            <button type="button" onClick={() => setAnswers({})}
              style={{
                padding: '12px 20px', borderRadius: 10, border: '1px solid var(--border)',
                background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
              Formu Temizle
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ── RESPONSES VIEW ──
  if (view === 'responses' && activeForm) {
    const questionFields = fields.filter(f => !['section_header', 'description_text'].includes(f.field_type));

    return (
      <div className="page" style={{ maxWidth: 1100 }}>
        <button onClick={() => { setView('list'); setActiveForm(null); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: 13, fontWeight: 600, marginBottom: 16, fontFamily: 'inherit' }}>
          ← Geri Dön
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>📊 {activeForm.title} — Yanıtlar</h1>
          <span style={{
            fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
            background: 'var(--primary-light)', color: 'var(--primary)',
          }}>
            {responseData.length} yanıt
          </span>
        </div>

        {responseData.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Henüz yanıt yok</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Form paylaşıldığında yanıtlar burada görünecek</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, background: 'var(--bg-card)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <thead>
                <tr style={{ background: 'var(--gray-light)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>Yanıtlayan</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>Tarih</th>
                  {questionFields.map(f => (
                    <th key={f.id} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', maxWidth: 180 }}>
                      {f.label.length > 30 ? f.label.substring(0, 30) + '…' : f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {responseData.map((resp, ri) => {
                  const dataMap = {};
                  (resp.form_response_data || []).forEach(d => { dataMap[d.field_id] = d.value; });
                  return (
                    <tr key={resp.id} style={{ borderBottom: '1px solid var(--border-light, var(--border))' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{resp.respondent_name || 'Anonim'}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(resp.submitted_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      {questionFields.map(f => {
                        const val = dataMap[f.id];
                        let display = '—';
                        if (val !== undefined && val !== null) {
                          if (typeof val === 'object') {
                            if (Array.isArray(val)) display = val.join(', ');
                            else display = Object.entries(val).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ');
                          } else {
                            display = String(val);
                          }
                        }
                        return (
                          <td key={f.id} style={{ padding: '10px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={display}>{display}</td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary stats for choice/scale questions */}
        {questionFields.filter(f => ['single_choice', 'multiple_choice', 'dropdown', 'yes_no', 'linear_scale', 'rating'].includes(f.field_type)).length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>📈 Özet İstatistikler</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {questionFields.filter(f => ['single_choice', 'multiple_choice', 'dropdown', 'yes_no', 'linear_scale', 'rating'].includes(f.field_type)).map(field => {
                const allVals = responseData.map(r => {
                  const d = (r.form_response_data || []).find(d => d.field_id === field.id);
                  return d?.value;
                }).filter(v => v !== undefined && v !== null);

                // Count occurrences
                const counts = {};
                allVals.forEach(v => {
                  if (Array.isArray(v)) v.forEach(item => { counts[item] = (counts[item] || 0) + 1; });
                  else { const key = String(v); counts[key] = (counts[key] || 0) + 1; }
                });

                const total = allVals.length;
                const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

                return (
                  <div key={field.id} style={cardStyle}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>{field.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{total} yanıt</div>
                    {sorted.map(([label, count]) => {
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <div key={label} style={{ marginBottom: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                            <span style={{ color: 'var(--text-secondary, var(--text))' }}>{label}</span>
                            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{pct}% ({count})</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 3, background: 'var(--gray-light)', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: 'var(--primary)', transition: 'width 0.3s' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── BUILDER VIEW ──
  if (view === 'builder') {
    return (
      <div className="page" style={{ maxWidth: 900, margin: '0 auto' }}>
        <button onClick={() => { setView('list'); setActiveForm(null); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: 13, fontWeight: 600, marginBottom: 16, fontFamily: 'inherit' }}>
          ← Geri Dön
        </button>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>
          {activeForm ? '✏️ Formu Düzenle' : '➕ Yeni Form Oluştur'}
        </h1>

        {/* Form settings */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={labelStyle}>Form Başlığı *</label>
              <input value={formTitle} onChange={e => setFormTitle(e.target.value)} required
                placeholder="Ör: Personel Memnuniyet Anketi" style={{ ...inputStyle, fontWeight: 600, fontSize: 16 }}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
            </div>
            <div>
              <label style={labelStyle}>Açıklama</label>
              <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)}
                placeholder="Form hakkında kısa açıklama..." rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {/* Visibility */}
              <div>
                <label style={labelStyle}>Görünürlük</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {Object.entries(VIS_CONFIG).map(([key, cfg]) => (
                    <label key={key} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px',
                      borderRadius: 8, cursor: 'pointer', fontSize: 12, transition: 'all 0.15s',
                      border: formVisibility === key ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                      background: formVisibility === key ? 'var(--primary-light)' : 'var(--bg-card)',
                    }}>
                      <input type="radio" name="vis" checked={formVisibility === key}
                        onChange={() => {
                          setFormVisibility(key);
                          // Public form'lar otomatik olarak aktif yapılmalı (anon RLS gereksinimi)
                          if (key === 'public' && formStatus === 'draft') setFormStatus('active');
                        }} style={{ display: 'none' }} />
                      <span>{cfg.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, color: formVisibility === key ? 'var(--primary)' : 'var(--text)' }}>{cfg.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{cfg.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <label style={labelStyle}>Durum</label>
                <select value={formStatus} onChange={e => setFormStatus(e.target.value)} style={inputStyle}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
                {formVisibility === 'public' && formStatus === 'draft' && (
                  <div style={{ fontSize: 11, color: 'var(--orange)', marginTop: 4 }}>
                    ⚠️ Public formların çalışması için durumu "Aktif" yapmalısınız
                  </div>
                )}
              </div>

              {/* Options */}
              <div>
                <label style={labelStyle}>Seçenekler</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', marginBottom: 6 }}>
                  <input type="checkbox" checked={formAllowAnon} onChange={e => setFormAllowAnon(e.target.checked)} />
                  Anonim yanıtlara izin ver
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={formAllowMultiple} onChange={e => setFormAllowMultiple(e.target.checked)} />
                  Birden fazla yanıta izin ver
                </label>
              </div>
            </div>

            {/* Confirmation message */}
            <div>
              <label style={labelStyle}>Onay Mesajı</label>
              <input value={formConfirmMsg} onChange={e => setFormConfirmMsg(e.target.value)}
                style={inputStyle} placeholder="Yanıtınız kaydedildi. Teşekkürler!"
                onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
            </div>
          </div>
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Sorular ({fields.length})</h2>
        </div>

        {fields.map((field, i) => (
          <FieldEditor key={field.id || i} field={field} index={i} totalFields={fields.length}
            onChange={updateFieldAt} onDelete={deleteFieldAt} onMoveUp={moveFieldUp} onMoveDown={moveFieldDown} />
        ))}

        {/* Add field panel */}
        <div style={{ ...cardStyle, marginTop: 12, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            + Soru Ekle
          </div>
          {Object.entries(FIELD_GROUPS).map(([groupKey, groupLabel]) => {
            const groupTypes = FIELD_TYPES.filter(ft => ft.group === groupKey);
            if (groupTypes.length === 0) return null;
            return (
              <div key={groupKey} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-light)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{groupLabel}</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {groupTypes.map(ft => (
                    <button key={ft.type} onClick={() => addField(ft.type)}
                      style={{
                        padding: '5px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 600,
                        border: '1px solid var(--border)', background: 'var(--bg-card)',
                        color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 4,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                      <span>{ft.icon}</span> {ft.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Save bar */}
        <div style={{
          position: 'sticky', bottom: 16, display: 'flex', gap: 10, justifyContent: 'flex-end',
          padding: '14px 20px', borderRadius: 14, marginTop: 20,
          background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)',
        }}>
          <button onClick={() => { setView('list'); setActiveForm(null); }}
            style={{
              padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg-card)', color: 'var(--text)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            İptal
          </button>
          <button onClick={saveForm} disabled={saving || !formTitle.trim()}
            style={{
              padding: '10px 28px', borderRadius: 8, border: 'none',
              background: saving ? 'var(--gray-mid)' : 'var(--primary)', color: '#fff',
              fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}>
            {saving ? '⏳ Kaydediliyor...' : '💾 Formu Kaydet'}
          </button>
        </div>
      </div>
    );
  }

  // ── LIST VIEW (default) ──
  return (
    <div className="page" style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">📋 Formlar</h1>
          <p className="page-subtitle">Anket, başvuru ve değerlendirme formları oluşturun</p>
        </div>
        <button onClick={() => openBuilder()}
          style={{
            padding: '10px 18px', borderRadius: 8, border: 'none',
            background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
          }}>
          ➕ Yeni Form
        </button>
      </div>

      {/* My Forms */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          📁 Formlarım ({myForms.length})
        </h2>
        {myForms.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
            Henüz form oluşturmadınız
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {myForms.map(form => {
              const sc = STATUS_CONFIG[form.status] || STATUS_CONFIG.draft;
              const vc = VIS_CONFIG[form.visibility] || VIS_CONFIG.internal;
              return (
                <div key={form.id} style={{
                  ...cardStyle, padding: 0, overflow: 'hidden',
                  transition: 'box-shadow 0.2s, transform 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                  <div style={{ height: 4, background: form.theme_color || 'var(--primary)' }} />
                  <div style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text)', lineHeight: 1.3 }}>{form.title}</div>
                        {form.description && (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {form.description}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: sc.bg, color: sc.color }}>{sc.label}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: 'var(--gray-light)', color: 'var(--text-muted)' }}>{vc.icon} {vc.label}</span>
                      </div>
                    </div>

                    {/* Public + draft uyarısı */}
                    {form.visibility === 'public' && form.status === 'draft' && (
                      <div style={{ fontSize: 11, color: 'var(--orange)', background: 'var(--orange-pale)', padding: '6px 10px', borderRadius: 8, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        ⚠️ Public link çalışmaz — formu <strong>"Aktif"</strong> yapın
                      </div>
                    )}

                    <div style={{ fontSize: 11, color: 'var(--text-light)', marginBottom: 10 }}>
                      📊 {form.response_count || 0} yanıt · {new Date(form.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openBuilder(form)}
                        style={{ flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 11.5, fontWeight: 600, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit' }}>
                        ✏️ Düzenle
                      </button>
                      <button onClick={() => openFill(form)}
                        style={{ flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 11.5, fontWeight: 600, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                        📝 Doldur
                      </button>
                      <button onClick={() => openResponses(form)}
                        style={{ flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 11.5, fontWeight: 600, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit' }}>
                        📊 Yanıtlar
                      </button>
                      {form.visibility === 'public' && form.public_slug && (
                        <button onClick={() => copyPublicUrl(form)}
                          title="Public link kopyala"
                          style={{ padding: '6px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, border: '1px solid var(--green)', background: 'var(--green-pale)', color: 'var(--green)', cursor: 'pointer', fontFamily: 'inherit' }}>
                          🔗
                        </button>
                      )}
                      <button onClick={() => handleDeleteForm(form.id)}
                        style={{ padding: '6px 10px', borderRadius: 6, fontSize: 11.5, border: '1px solid var(--red)', background: 'var(--red-pale)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit' }}>
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Other active forms to fill */}
      {otherForms.length > 0 && (
        <div>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            📨 Doldurabileceğiniz Formlar ({otherForms.length})
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {otherForms.map(form => (
              <div key={form.id} style={{ ...cardStyle, padding: 0, overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 0.2s, transform 0.15s' }}
                onClick={() => openFill(form)}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                <div style={{ height: 4, background: form.theme_color || 'var(--primary)' }} />
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text)', marginBottom: 4 }}>{form.title}</div>
                  {form.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.4 }}>{form.description}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-light)' }}>👤 {form.created_by_name}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>Formu Doldur →</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
