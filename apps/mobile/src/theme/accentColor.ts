import { colors } from '../design/theme';

// A per-mode accent theme, derived entirely from one base hex color (see
// buildAccentTheme below). Shape is deliberately unchanged from the earlier
// Dashboard-only static version so every existing consumption site in
// DashboardScreen.tsx keeps working -- only the *source* of the hex is new
// (a user-chosen, persisted color instead of a hardcoded constant).
export interface AccentTheme {
  /** The base accent color itself. */
  accent: string;
  /** Text/icon color for content sitting on top of a filled `accent` surface -- contrast-safe for any accent. */
  onAccent: string;
  /** Low-opacity accent tint, e.g. badge/highlight backgrounds. */
  accentBg: string;
  /** Low-opacity accent border, e.g. outlined highlights. */
  accentBorder: string;
  /** A desaturated, opaque variant blended toward the app's surface -- subtle icon backgrounds, secondary emphasis. */
  accentMuted: string;
  /** Progress-indicator fill. Same as `accent` today, kept distinct so callers can diverge later without a shape change. */
  progress: string;
}

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function isValidHex(value: string): boolean {
  return HEX_PATTERN.test(value.trim());
}

/** Accepts "2F80FF" or "#2f80ff"; returns a normalized "#2F80FF", or null if not a valid 6-digit hex. */
export function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return HEX_PATTERN.test(withHash) ? withHash.toUpperCase() : null;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Blends two hex colors; t=0 is hexA, t=1 is hexB. */
export function mixHex(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
}

// WCAG relative luminance/contrast -- used to pick whichever of the app's two
// ink colors (near-black `colors.background` or near-white `colors.textPrimary`)
// gives better contrast against an arbitrary accent, rather than assuming a
// dark accent always wants light text. This is what keeps e.g. a bright
// yellow accent from ending up with pale, unreadable text on top of it.
function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function buildAccentTheme(hex: string): AccentTheme {
  const accent = normalizeHex(hex) ?? hex;
  const accentLuminance = relativeLuminance(accent);
  const darkInkContrast = contrastRatio(accentLuminance, relativeLuminance(colors.background));
  const lightInkContrast = contrastRatio(accentLuminance, relativeLuminance(colors.textPrimary));
  const onAccent = darkInkContrast >= lightInkContrast ? colors.background : colors.textPrimary;

  return {
    accent,
    onAccent,
    accentBg: withAlpha(accent, 0.14),
    accentBorder: withAlpha(accent, 0.35),
    accentMuted: mixHex(accent, colors.surfaceRaised, 0.5),
    progress: accent,
  };
}

export const DEFAULT_WORKOUT_COLOR = '#2F80FF';
export const DEFAULT_NUTRITION_COLOR = '#10B981';

export const DEFAULT_WORKOUT_THEME = buildAccentTheme(DEFAULT_WORKOUT_COLOR);
export const DEFAULT_NUTRITION_THEME = buildAccentTheme(DEFAULT_NUTRITION_COLOR);
