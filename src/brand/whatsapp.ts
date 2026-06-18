const FALLBACK_PRIMARY = '#075E54';
const HEX_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeHex(value: string | null, fallback: string): string {
  if (!value) return fallback;
  let hex = value.trim();
  if (!hex.startsWith('#')) hex = '#' + hex;
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return fallback;
}

export interface WhatsAppTheme {
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  templateBackground: string;
  textColor: string;
}

export function isLightColor(hex: string): boolean {
  const clean = hex.replace('#', '');
  if (clean.length < 6) return true;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 186;
}

export function lightenColor(hex: string, percent: number): string {
  const clean = hex.replace('#', '');
  if (clean.length < 6 || !HEX_REGEX.test('#' + clean)) return FALLBACK_PRIMARY;
  const r = Math.min(255, parseInt(clean.slice(0, 2), 16) + Math.round(255 * percent / 100));
  const g = Math.min(255, parseInt(clean.slice(2, 4), 16) + Math.round(255 * percent / 100));
  const b = Math.min(255, parseInt(clean.slice(4, 6), 16) + Math.round(255 * percent / 100));
  return `#${[r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

export function buildWhatsAppTheme(primaryColor: string | null, logoUrl: string | null): WhatsAppTheme {
  const TEMPLATE_BG = '#ECE5DD';

  const primary = normalizeHex(primaryColor, FALLBACK_PRIMARY);
  const accent = lightenColor(primary, 20);
  const textColor = isLightColor(primary) ? '#000000' : '#FFFFFF';

  return {
    primaryColor: primary,
    accentColor: accent,
    logoUrl,
    templateBackground: TEMPLATE_BG,
    textColor,
  };
}
