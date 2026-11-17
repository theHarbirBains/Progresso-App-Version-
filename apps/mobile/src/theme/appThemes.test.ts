import { colors } from '../design/theme';
import { buildAccentTheme, hexToRgb } from './accentColor';
import { APP_THEMES, DEFAULT_THEME_ID, isAppThemeId, seasonFor, themeById } from './appThemes';

function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('app themes', () => {
  it('has Golden Hour Gym -- the original look -- first, and Holiday Gym as the default', () => {
    expect(APP_THEMES[0]).toMatchObject({ id: 'golden-hour-gym', name: 'Golden Hour Gym' });
    expect(DEFAULT_THEME_ID).toBe('holiday-gym');
    expect(APP_THEMES[0].accent).toBe(colors.accent);
  });

  it('has the nine themes, each with its own photo (for the launch screen, share card and widgets)', () => {
    expect(APP_THEMES.map((t) => t.name)).toEqual([
      'Golden Hour Gym',
      'Forest',
      'Alpine',
      'Coast',
      'Spring',
      'Summer',
      'Autumn',
      'Winter',
      'Holiday Gym',
    ]);
    expect(new Set(APP_THEMES.map((t) => t.photo)).size).toBe(9);
  });

  it('gives every theme a plain background, a design and a heading face -- no two alike', () => {
    expect(new Set(APP_THEMES.map((t) => t.background)).size).toBe(9);
    expect(APP_THEMES[0]).toMatchObject({
      background: colors.background,
      pattern: 'none',
      font: 'jakarta',
    });
    expect(themeById('holiday-gym')).toMatchObject({ pattern: 'sparkles', font: 'fraunces' });
    expect(new Set(APP_THEMES.map((t) => t.font))).toEqual(
      new Set(['jakarta', 'fraunces', 'oswald', 'nunito']),
    );
  });

  it("keeps the app's text as readable on every background as on the original fill", () => {
    for (const theme of APP_THEMES) {
      expect(contrast(colors.textPrimary, theme.background)).toBeGreaterThanOrEqual(16);
      expect(contrast(colors.textSecondary, theme.background)).toBeGreaterThanOrEqual(8);
      // Muted text: within a hair of the original fill's 4.17.
      expect(contrast(colors.textMuted, theme.background)).toBeGreaterThanOrEqual(4);
    }
  });

  it('keeps every accent readable: as text on its own background, and with its ink on it', () => {
    for (const theme of APP_THEMES) {
      expect(contrast(theme.accent, theme.background)).toBeGreaterThanOrEqual(4.5);
      const accent = buildAccentTheme(theme.accent);
      expect(contrast(accent.onAccent, theme.accent)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('falls back to the default for a theme it doesn’t know', () => {
    expect(themeById('obsidian').id).toBe('golden-hour-gym');
    expect(themeById(null).id).toBe('golden-hour-gym');
    expect(isAppThemeId('forest')).toBe(true);
    expect(isAppThemeId('midnight')).toBe(false);
  });
});

describe('seasonFor', () => {
  it('follows the northern calendar by default', () => {
    expect(seasonFor(new Date(2026, 3, 10), 'CA')).toBe('spring');
    expect(seasonFor(new Date(2026, 6, 10), 'US')).toBe('summer');
    expect(seasonFor(new Date(2026, 9, 25), null)).toBe('autumn');
    expect(seasonFor(new Date(2026, 0, 5), 'GB')).toBe('winter');
    expect(seasonFor(new Date(2026, 11, 20), undefined)).toBe('winter');
  });

  it('runs the other way round in the southern hemisphere', () => {
    expect(seasonFor(new Date(2026, 9, 25), 'AU')).toBe('spring');
    expect(seasonFor(new Date(2026, 0, 5), 'nz')).toBe('summer');
    expect(seasonFor(new Date(2026, 3, 10), 'ZA')).toBe('autumn');
    expect(seasonFor(new Date(2026, 6, 10), 'AR')).toBe('winter');
  });
});
