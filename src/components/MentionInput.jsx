import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * MentionInput — @mention destekli yorum/not girişi
 *
 * Props:
 *   value        : string (kontrollü değer)
 *   onChange      : (newVal: string) => void
 *   onSubmit      : () => void            — Enter basılınca
 *   profiles      : Array<{user_id, full_name, role, unit, avatar_url}>
 *   myId          : string                — kendi user_id'im (kendini gösterme)
 *   myUnit        : string|null           — kendi birimi
 *   isDirektor    : boolean               — true ise herkesi göster
 *   placeholder   : string
 *   disabled      : boolean
 *   style         : object
 */
export default function MentionInput({
  value = '',
  onChange,
  onSubmit,
  profiles = [],
  myId,
  myUnit,
  isDirektor = false,
  placeholder = 'Yorum yaz… @ ile etiketle',
  disabled = false,
  style = {},
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [cursorPos, setCursorPos] = useState(0);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Etiketlenebilecek kişiler: aynı birim veya direktör ise herkes
  const mentionableProfiles = useCallback(() => {
    if (!profiles.length) return [];
    return profiles.filter(p => {
      if (p.user_id === myId) return false;
      if (isDirektor) return true;
      // Aynı birim
      return myUnit && p.unit === myUnit;
    });
  }, [profiles, myId, myUnit, isDirektor]);

  const filteredProfiles = useCallback(() => {
    const base = mentionableProfiles();
    if (!search) return base.slice(0, 8);
    const q = search.toLowerCase();
    return base.filter(p => p.full_name?.toLowerCase().includes(q)).slice(0, 8);
  }, [mentionableProfiles, search]);

  // @ tetikleme kontrolü
  const handleChange = (e) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    onChange(val);
    setCursorPos(pos);

    // Son @ karakterinden sonrasını ara
    const before = val.substring(0, pos);
    const atIdx = before.lastIndexOf('@');

    if (atIdx !== -1) {
      // @ sonrası boşluk veya ] yoksa dropdown aç
      const afterAt = before.substring(atIdx + 1);
      if (!afterAt.includes(' ') && !afterAt.includes(']') && afterAt.length <= 20) {
        setSearch(afterAt);
        setShowDropdown(true);
        setSelectedIdx(0);
        return;
      }
    }
    setShowDropdown(false);
    setSearch('');
  };

  const insertMention = (profile) => {
    const before = value.substring(0, cursorPos);
    const after = value.substring(cursorPos);
    const atIdx = before.lastIndexOf('@');
    if (atIdx === -1) return;

    const mentionTag = `@${profile.full_name} `;
    const newVal = before.substring(0, atIdx) + mentionTag + after;
    onChange(newVal);
    setShowDropdown(false);
    setSearch('');

    // Cursor'u mention sonrasına taşı
    setTimeout(() => {
      if (inputRef.current) {
        const newPos = atIdx + mentionTag.length;
        inputRef.current.selectionStart = newPos;
        inputRef.current.selectionEnd = newPos;
        inputRef.current.focus();
      }
    }, 0);
  };

  const handleKeyDown = (e) => {
    if (showDropdown) {
      const list = filteredProfiles();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx(prev => Math.min(prev + 1, list.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter' && list.length > 0) {
        e.preventDefault();
        insertMention(list[selectedIdx]);
        return;
      }
      if (e.key === 'Escape') {
        setShowDropdown(false);
        return;
      }
    }
    // Normal Enter → submit
    if (e.key === 'Enter' && !e.shiftKey && !showDropdown && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  // Dışarı tıklayınca kapat
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const list = filteredProfiles();

  const ROLE_LABELS = {
    direktor: 'Direktör',
    direktor_yardimcisi: 'Dir. Yrd.',
    asistan: 'Asistan',
    koordinator: 'Koordinatör',
    personel: 'Personel',
  };

  return (
    <div style={{ position: 'relative', flex: 1, ...style }}>
      <input
        ref={inputRef}
        className="form-input"
        style={{ width: '100%', fontSize: 13 }}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />

      {showDropdown && list.length > 0 && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            marginBottom: 4,
            background: 'var(--bg-card, #fff)',
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            zIndex: 999,
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          <div style={{ padding: '6px 10px', fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Kişi Etiketle
          </div>
          {list.map((p, i) => {
            const initial = (p.full_name?.[0] || '?').toUpperCase();
            return (
              <div
                key={p.user_id}
                onMouseDown={(e) => { e.preventDefault(); insertMention(p); }}
                onMouseEnter={() => setSelectedIdx(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  background: i === selectedIdx ? 'var(--accent-light, #eef2ff)' : 'transparent',
                  transition: 'background 0.1s',
                }}
              >
                {/* Avatar */}
                {p.avatar_url ? (
                  <img
                    src={p.avatar_url}
                    alt=""
                    style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: '#6366f1', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>
                    {initial}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.full_name}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'flex', gap: 6 }}>
                    <span>{ROLE_LABELS[p.role] || p.role}</span>
                    {p.unit && <span>· {p.unit}</span>}
                  </div>
                </div>
              </div>
            );
          })}
          {list.length === 0 && search && (
            <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              Sonuç bulunamadı
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Yorumdaki @mention'ları tespit edip user_id listesi döner.
 * Metin formatı: "@Ad Soyad" — profiles listesinden eşleştir.
 */
export function extractMentions(text, profiles) {
  if (!text || !profiles?.length) return [];
  const mentionedIds = new Set();

  // @Ad Soyad formatını yakala
  const mentionRegex = /@([A-Za-zÇçĞğİıÖöŞşÜü\s]+?)(?=\s@|\s*$|[.,;:!?)])/g;
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    const name = match[1].trim();
    const profile = profiles.find(p =>
      p.full_name?.toLowerCase() === name.toLowerCase()
    );
    if (profile) {
      mentionedIds.add(profile.user_id);
    }
  }

  // Daha basit eşleştirme: tüm profillerin isimlerini kontrol et
  profiles.forEach(p => {
    if (p.full_name && text.includes(`@${p.full_name}`)) {
      mentionedIds.add(p.user_id);
    }
  });

  return Array.from(mentionedIds);
}

/**
 * Yorum metnindeki @mention'ları vurgulu hale getir (render için).
 * Returns: array of {text, isMention, userId, name}
 */
export function renderMentionText(text, profiles) {
  if (!text || !profiles?.length) return [{ text, isMention: false }];

  // Tüm mention'ları bul ve pozisyonlarını kaydet
  const mentions = [];
  profiles.forEach(p => {
    if (!p.full_name) return;
    const tag = `@${p.full_name}`;
    let idx = text.indexOf(tag);
    while (idx !== -1) {
      mentions.push({ start: idx, end: idx + tag.length, name: p.full_name, userId: p.user_id });
      idx = text.indexOf(tag, idx + 1);
    }
  });

  if (mentions.length === 0) return [{ text, isMention: false }];

  // Pozisyona göre sırala
  mentions.sort((a, b) => a.start - b.start);

  const parts = [];
  let lastIdx = 0;
  mentions.forEach(m => {
    if (m.start > lastIdx) {
      parts.push({ text: text.substring(lastIdx, m.start), isMention: false });
    }
    parts.push({ text: `@${m.name}`, isMention: true, userId: m.userId, name: m.name });
    lastIdx = m.end;
  });
  if (lastIdx < text.length) {
    parts.push({ text: text.substring(lastIdx), isMention: false });
  }

  return parts;
}
