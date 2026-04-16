// ── MERKEZİ SABİTLER ─────────────────────────────────────────────────────────
// Tüm sabitler tek bir yerde yönetilir.
// Değişiklik gerektiğinde sadece bu dosyayı güncelleyin.

// ── BİRİM TANIMLARI ─────────────────────────────────────────────────────────
export const UNITS = [
  { name: 'Fonlar',                            key: 'fonlar',       coordinator: 'Yavuz Sofi', icon: '💎', color: '#EAB308', cssClass: 'unit-fonlar' },
  { name: 'Hibeler',                           key: 'hibeler',      coordinator: 'Yasir',      icon: '📝', color: '#DC2626', cssClass: 'unit-hibeler' },
  { name: 'İnsani İşler',                      key: 'insani_isler', coordinator: 'Gülsüm',     icon: '🌍', color: '#2563EB', cssClass: 'unit-insani' },
  { name: 'Partnerlikler',                     key: 'partnerlikler',coordinator: 'Hatice',      icon: '🤝', color: '#16A34A', cssClass: 'unit-partnerlikler' },
  { name: 'Politika, Yönetişim ve Güvence',    key: 'politika',     coordinator: 'Sezgin',      icon: '⚖️', color: '#EA580C', cssClass: 'unit-politika' },
];

// Eski İngilizce isimleri Türkçe'ye eşleme (geriye dönük uyumluluk)
export const UNIT_LEGACY_MAP = {
  'Partnerships':         'Partnerlikler',
  'Humanitarian Affairs': 'İnsani İşler',
  'Traditional Donors':   'Fonlar',
  'Grants':               'Hibeler',
  'Accreditations':       'Fonlar',
  'Policy & Governance':  'Politika, Yönetişim ve Güvence',
  // Profil birim adları (uzun form)
  'Ortaklıklar Birimi':                  'Partnerlikler',
  'Uluslararası İnsani İşler Birimi':    'İnsani İşler',
  'Geleneksel Donörler Birimi':          'Fonlar',
  'Uluslararası Hibeler Birimi':         'Hibeler',
  'Akreditasyonlar Birimi':              'Fonlar',
  'Politika, Yönetişim ve Güvence Birimi':'Politika, Yönetişim ve Güvence',
  'Fonlar Birimi':                       'Fonlar',
  'Hibeler Birimi':                      'Hibeler',
  'İnsani İşler Birimi':                 'İnsani İşler',
  'Partnerlikler Birimi':                'Partnerlikler',
};

/** Herhangi bir birim adını (eski/yeni/uzun) standart kısa isme çevirir */
export function resolveUnitName(raw) {
  if (!raw) return raw;
  // Zaten standart UNITS listesinde mi?
  if (UNITS.find(u => u.name === raw)) return raw;
  return UNIT_LEGACY_MAP[raw] || raw;
}

/** Birim adından renk döndürür */
export function getUnitColor(raw) {
  const name = resolveUnitName(raw);
  const unit = UNITS.find(u => u.name === name);
  return unit?.color || '#6366f1';
}

export const UNIT_NAMES     = UNITS.map(u => u.name);
export const UNIT_MAP       = Object.fromEntries(UNITS.map(u => [u.name, u]));
export const UNIT_CSS_MAP   = Object.fromEntries(UNITS.map(u => [u.name, u.cssClass]));
export const UNIT_ICON_MAP  = Object.fromEntries(UNITS.map(u => [u.name, u.icon]));
export const UNIT_COLOR_MAP = Object.fromEntries(UNITS.map(u => [u.name, u.color]));

// ── ROL TANIMLARI ────────────────────────────────────────────────────────────
export const ROLE_LABELS = {
  direktor:            'Direktör',
  direktor_yardimcisi: 'Direktör Yardımcısı (Hibeler)',
  asistan:             'Yönetici Asistanı',
  koordinator:         'Koordinatör',
  personel:            'Personel',
};

// ── DURUM SABİTLERİ (STATUS) ─────────────────────────────────────────────────
// Görev / deadline / toplantı aksiyonları için ortak durum listesi
export const TASK_STATUSES = [
  { value: 'not_started',  label: '⚪ Başlanmadı',    color: '#9ca3af' },
  { value: 'in_progress',  label: '🔵 Devam Ediyor',  color: '#2563eb' },
  { value: 'completed',    label: '✅ Tamamlandı',     color: '#16a34a' },
  { value: 'overdue',      label: '🔴 Gecikmiş',      color: '#dc2626' },
];
export const TASK_STATUS_MAP = Object.fromEntries(TASK_STATUSES.map(s => [s.value, s]));

// Öncelik sabitleri
export const PRIORITIES = [
  { value: 'critical', label: '🔴 Kritik',  color: '#dc2626' },
  { value: 'high',     label: '🟠 Yüksek',  color: '#ea580c' },
  { value: 'medium',   label: '🟡 Orta',    color: '#d97706' },
  { value: 'low',      label: '🟢 Düşük',   color: '#16a34a' },
];
export const PRIORITY_MAP = Object.fromEntries(PRIORITIES.map(p => [p.value, p]));

// ── AVATAR RENK PALETİ ──────────────────────────────────────────────────────
export const AVATAR_PALETTE = [
  '#7c3aed','#db2777','#16a34a','#2563eb',
  '#d97706','#dc2626','#0891b2','#65a30d',
  '#9333ea','#ea580c',
];

export function avatarColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

// ── TARİH FORMATLAMA ─────────────────────────────────────────────────────────
const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                   'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const DAYS_TR   = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];

/** YYYY-MM-DD formatında tarih string'i döndürür */
export function toLocalDateStr(d) {
  if (typeof d === 'string') d = new Date(d + 'T12:00:00');
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/** "23 Mart 2026" formatında kısa tarih */
export function fmtDateShort(str) {
  const d = new Date(str + 'T12:00:00');
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Pzt" gibi kısa gün adı */
export function fmtDayShort(str) {
  const d = new Date(str + 'T12:00:00');
  return DAYS_TR[d.getDay()];
}

/** Bugünün tarihini YYYY-MM-DD olarak döndürür */
export function todayStr() {
  return toLocalDateStr(new Date());
}

/** Görüntüleme amaçlı tarih: "23 Mart 2026" */
export function fmtDisplayDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'));
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`;
}

/** Kısa tarih-saat: "23.03 14:30" */
export function fmtDateTime(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  });
}
