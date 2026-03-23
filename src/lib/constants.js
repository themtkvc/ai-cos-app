// ── MERKEZİ SABİTLER ─────────────────────────────────────────────────────────
// Birim tanımları tek bir yerde yönetilir.
// Değişiklik gerektiğinde sadece bu dosyayı güncelleyin.

export const UNITS = [
  { name: 'Partnerships',         coordinator: 'Hatice', icon: '🤝', cssClass: 'unit-partnerships' },
  { name: 'Humanitarian Affairs', coordinator: 'Gülsüm', icon: '🌍', cssClass: 'unit-humanitarian' },
  { name: 'Traditional Donors',   coordinator: 'Murat',  icon: '💰', cssClass: 'unit-traditional-donors' },
  { name: 'Grants',               coordinator: 'Yasir',  icon: '📝', cssClass: 'unit-grants' },
  { name: 'Accreditations',       coordinator: 'Yavuz',  icon: '✅', cssClass: 'unit-accreditations' },
  { name: 'Policy & Governance',  coordinator: 'Sezgin', icon: '⚖️', cssClass: 'unit-policy' },
];

// Hızlı erişim yardımcıları
export const UNIT_NAMES     = UNITS.map(u => u.name);
export const UNIT_MAP       = Object.fromEntries(UNITS.map(u => [u.name, u]));
export const UNIT_CSS_MAP   = Object.fromEntries(UNITS.map(u => [u.name, u.cssClass]));
export const UNIT_ICON_MAP  = Object.fromEntries(UNITS.map(u => [u.name, u.icon]));
