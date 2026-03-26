import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ── Styles ────────────────────────────────────────────────────────────────────
const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1.5px solid #e5e7eb', background: '#fff',
  color: '#111827', fontSize: 13.5, fontFamily: "'DM Sans', system-ui, sans-serif",
  outline: 'none', transition: 'border-color 0.15s', boxSizing: 'border-box',
};

// ── Field Renderer (standalone for public) ────────────────────────────────────
function FieldRenderer({ field, value, onChange }) {
  const props = field.properties || {};

  switch (field.field_type) {
    case 'section_header':
      return (
        <div style={{ marginTop: 20, marginBottom: 8, paddingBottom: 8, borderBottom: '2px solid #2563eb' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{field.label}</div>
          {field.description && <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{field.description}</div>}
        </div>
      );
    case 'description_text':
      return <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, padding: '8px 0' }}>{field.label}</div>;
    case 'short_text': case 'email': case 'phone': case 'url':
      return (
        <input type={field.field_type === 'email' ? 'email' : field.field_type === 'phone' ? 'tel' : field.field_type === 'url' ? 'url' : 'text'}
          value={value || ''} onChange={e => onChange(e.target.value)} required={field.required}
          placeholder={field.description || ''} style={inputStyle}
          onFocus={e => { e.target.style.borderColor = '#2563eb'; }}
          onBlur={e => { e.target.style.borderColor = '#e5e7eb'; }} />
      );
    case 'long_text':
      return (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} required={field.required}
          placeholder={field.description || ''} rows={4}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
          onFocus={e => { e.target.style.borderColor = '#2563eb'; }}
          onBlur={e => { e.target.style.borderColor = '#e5e7eb'; }} />
      );
    case 'number':
      return (
        <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
          required={field.required} placeholder={field.description || ''} style={{ ...inputStyle, width: 200 }}
          onFocus={e => { e.target.style.borderColor = '#2563eb'; }}
          onBlur={e => { e.target.style.borderColor = '#e5e7eb'; }} />
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
                border: value === opt.v ? '2px solid #2563eb' : '1.5px solid #e5e7eb',
                background: value === opt.v ? '#eff6ff' : '#fff',
                color: value === opt.v ? '#2563eb' : '#6b7280',
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
              border: value === opt.label ? '2px solid #2563eb' : '1.5px solid #e5e7eb',
              background: value === opt.label ? '#eff6ff' : '#fff',
            }}>
              <input type="radio" name={`field_${field.id}`} checked={value === opt.label}
                onChange={() => onChange(opt.label)} style={{ accentColor: '#2563eb' }} />
              <span style={{ fontSize: 13.5, color: '#111827' }}>{opt.label}</span>
            </label>
          ))}
        </div>
      );
    case 'multiple_choice': {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(field.options || []).map((opt, i) => {
            const isChecked = selected.includes(opt.label);
            return (
              <label key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                border: isChecked ? '2px solid #2563eb' : '1.5px solid #e5e7eb',
                background: isChecked ? '#eff6ff' : '#fff',
              }}>
                <input type="checkbox" checked={isChecked}
                  onChange={() => {
                    if (isChecked) onChange(selected.filter(v => v !== opt.label));
                    else onChange([...selected, opt.label]);
                  }} style={{ accentColor: '#2563eb' }} />
                <span style={{ fontSize: 13.5, color: '#111827' }}>{opt.label}</span>
              </label>
            );
          })}
        </div>
      );
    }
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, justifyContent: 'center' }}>
          {props.minLabel && <span style={{ fontSize: 11, color: '#6b7280', marginRight: 8 }}>{props.minLabel}</span>}
          {range.map(n => (
            <button key={n} type="button" onClick={() => onChange(n)}
              style={{
                width: 40, height: 40, borderRadius: '50%', border: value === n ? '2px solid #2563eb' : '1.5px solid #e5e7eb',
                background: value === n ? '#2563eb' : '#fff', color: value === n ? '#fff' : '#111827',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', margin: '0 3px', fontFamily: 'inherit',
              }}>
              {n}
            </button>
          ))}
          {props.maxLabel && <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 8 }}>{props.maxLabel}</span>}
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
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 28, color: n <= currentVal ? '#f59e0b' : '#e5e7eb' }}>
              ★
            </button>
          ))}
        </div>
      );
    }
    case 'matrix_single': case 'matrix_multiple': {
      const rows = props.rows || [];
      const cols = props.columns || [];
      const matVal = (typeof value === 'object' && value) ? value : {};
      const isSingle = field.field_type === 'matrix_single';
      return (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}></th>
                {cols.map((c, i) => (
                  <th key={i} style={{ padding: 8, textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: 8, fontSize: 13, color: '#111827' }}>{r}</td>
                  {cols.map((c, ci) => (
                    <td key={ci} style={{ padding: 8, textAlign: 'center' }}>
                      <input type={isSingle ? 'radio' : 'checkbox'} name={`matrix_${field.id}_${ri}`}
                        checked={isSingle ? matVal[r] === c : (Array.isArray(matVal[r]) && matVal[r].includes(c))}
                        onChange={() => {
                          const newVal = { ...matVal };
                          if (isSingle) { newVal[r] = c; }
                          else {
                            const arr = Array.isArray(newVal[r]) ? [...newVal[r]] : [];
                            if (arr.includes(c)) newVal[r] = arr.filter(v => v !== c);
                            else newVal[r] = [...arr, c];
                          }
                          onChange(newVal);
                        }}
                        style={{ accentColor: '#2563eb' }} />
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
        const arr = [...items]; const [item] = arr.splice(from, 1); arr.splice(to, 0, item); onChange(arr);
      };
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff' }}>
              <span style={{ fontWeight: 800, color: '#2563eb', fontSize: 14, width: 20 }}>{i + 1}.</span>
              <span style={{ flex: 1, fontSize: 13.5 }}>{item}</span>
              <button type="button" disabled={i === 0} onClick={() => moveItem(i, i - 1)} style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1, fontSize: 12 }}>⬆</button>
              <button type="button" disabled={i === items.length - 1} onClick={() => moveItem(i, i + 1)} style={{ background: 'none', border: 'none', cursor: i === items.length - 1 ? 'default' : 'pointer', opacity: i === items.length - 1 ? 0.3 : 1, fontSize: 12 }}>⬇</button>
            </div>
          ))}
        </div>
      );
    }
    case 'file_upload':
      return (
        <div style={{ padding: 24, border: '2px dashed #e5e7eb', borderRadius: 12, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📎</div>
          Dosya yükleme (yakında aktif olacak)
        </div>
      );
    default:
      return <input value={value || ''} onChange={e => onChange(e.target.value)} style={inputStyle} />;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC FORM FILL — No login required
// ══════════════════════════════════════════════════════════════════════════════
export default function PublicFormFill({ slug }) {
  const [form, setForm] = useState(null);
  const [fields, setFields] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [respondentName, setRespondentName] = useState('');
  const [respondentEmail, setRespondentEmail] = useState('');

  const loadForm = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Fetch public form by slug (anon RLS allows this)
    const { data: formData, error: formErr } = await supabase
      .from('forms')
      .select('*')
      .eq('public_slug', slug)
      .eq('status', 'active')
      .eq('visibility', 'public')
      .single();

    if (formErr || !formData) {
      setError('Form bulunamadı veya artık aktif değil.');
      setLoading(false);
      return;
    }

    setForm(formData);

    // Fetch fields (anon RLS allows for public forms)
    const { data: fieldsData } = await supabase
      .from('form_fields')
      .select('*')
      .eq('form_id', formData.id)
      .order('sort_order');

    setFields(fieldsData || []);
    setLoading(false);
  }, [slug]);

  useEffect(() => { loadForm(); }, [loadForm]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    // Insert response (anon RLS allows for public forms)
    const { data: respData, error: respErr } = await supabase
      .from('form_responses')
      .insert({
        form_id: form.id,
        respondent_id: null,
        respondent_name: respondentName || 'Anonim',
        respondent_email: respondentEmail || null,
        is_anonymous: !respondentName,
      })
      .select();

    if (respErr || !respData?.[0]) {
      setSaving(false);
      alert('Gönderim sırasında bir hata oluştu. Lütfen tekrar deneyin.');
      return;
    }

    const responseId = respData[0].id;

    // Insert answers
    const answerRows = Object.entries(answers)
      .filter(([, val]) => val !== undefined && val !== null && val !== '')
      .map(([fieldId, val]) => ({
        response_id: responseId,
        field_id: fieldId,
        value: val,
      }));

    if (answerRows.length > 0) {
      const { error: dataErr } = await supabase
        .from('form_response_data')
        .insert(answerRows);
      if (dataErr) {
        console.error('Answer save error:', dataErr);
      }
    }

    setSaving(false);
    setSubmitted(true);
  };

  // ── Loading ──
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f7f8fa', fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p>Form yükleniyor...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f7f8fa', fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>
        <div style={{
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16,
          padding: '48px 32px', maxWidth: 420, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Form Bulunamadı</div>
          <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.5 }}>{error}</div>
        </div>
      </div>
    );
  }

  // ── Submitted ──
  if (submitted) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f7f8fa', fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>
        <div style={{
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16,
          padding: '48px 32px', maxWidth: 480, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Yanıtınız Kaydedildi</div>
          <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.5, marginBottom: 24 }}>
            {form.confirmation_message || 'Teşekkürler!'}
          </div>
          {form.allow_multiple_responses && (
            <button onClick={() => { setSubmitted(false); setAnswers({}); }}
              style={{
                padding: '10px 24px', borderRadius: 8, border: 'none',
                background: '#2563eb', color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
              Başka Bir Yanıt Gönder
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Form Fill ──
  return (
    <div style={{
      minHeight: '100vh', background: '#f7f8fa', padding: '32px 16px',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* Form header */}
        <div style={{
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14,
          padding: '28px 24px', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          borderTop: `5px solid ${form.theme_color || '#2563eb'}`,
        }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>
            {form.title}
          </h1>
          {form.description && (
            <p style={{ fontSize: 14, color: '#6b7280', marginTop: 8, lineHeight: 1.6, margin: '8px 0 0' }}>{form.description}</p>
          )}
          {fields.some(f => f.required) && (
            <div style={{ fontSize: 12, color: '#ef4444', marginTop: 10 }}>* Zorunlu alanlar</div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Respondent info (optional) */}
          {!form.allow_anonymous && (
            <div style={{
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14,
              padding: '18px 20px', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#111827', marginBottom: 5 }}>
                    Adınız <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input value={respondentName} onChange={e => setRespondentName(e.target.value)}
                    required placeholder="Adınız Soyadınız" style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = '#2563eb'; }}
                    onBlur={e => { e.target.style.borderColor = '#e5e7eb'; }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#111827', marginBottom: 5 }}>
                    E-posta
                  </label>
                  <input type="email" value={respondentEmail} onChange={e => setRespondentEmail(e.target.value)}
                    placeholder="ornek@email.com" style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = '#2563eb'; }}
                    onBlur={e => { e.target.style.borderColor = '#e5e7eb'; }} />
                </div>
              </div>
            </div>
          )}

          {/* Questions */}
          {fields.map(field => {
            if (['section_header', 'description_text'].includes(field.field_type)) {
              return <div key={field.id}><FieldRenderer field={field} value={null} onChange={() => {}} /></div>;
            }
            return (
              <div key={field.id} style={{
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14,
                padding: '18px 20px', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                    {field.label}
                    {field.required && <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>}
                  </div>
                  {field.description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{field.description}</div>}
                </div>
                <FieldRenderer field={field} value={answers[field.id]}
                  onChange={val => setAnswers(prev => ({ ...prev, [field.id]: val }))} />
              </div>
            );
          })}

          {/* Submit */}
          <div style={{ display: 'flex', gap: 10, marginTop: 8, marginBottom: 32 }}>
            <button type="submit" disabled={saving}
              style={{
                padding: '12px 32px', borderRadius: 10, border: 'none',
                background: saving ? '#d1d5db' : (form.theme_color || '#2563eb'), color: '#fff',
                fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', transition: 'all 0.15s',
              }}>
              {saving ? '⏳ Gönderiliyor...' : '📨 Gönder'}
            </button>
            <button type="button" onClick={() => setAnswers({})}
              style={{
                padding: '12px 20px', borderRadius: 10, border: '1px solid #e5e7eb',
                background: '#fff', color: '#6b7280', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
              Formu Temizle
            </button>
          </div>
        </form>

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', padding: '16px 0' }}>
          AI Chief of Staff ile oluşturuldu
        </div>
      </div>
    </div>
  );
}
