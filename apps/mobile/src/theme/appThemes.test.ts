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
  it('has Golden Hour Gym -- the original look -- first, and as the default', () => {
    expect(APP_THEMES[0]).toMatchObject({ id: 'golden-hour-gym', name: 'Golden Hour Gym' });
    expect(DEFAULT_THEME_ID).toBe('golden-hour-gym');
    expect(APP_THEMES[0].accent).toBe(colors.accent);
  });

  it('has the eight themes, each with its own photo', () => {
    expect(APP_THEMES.map((t) => t.name)).toEqual([
      'Golden Hour Gym',
      'Forest',
      'Alpine',
      'Coast',
      'Spring',
      'Summer',
      'Autumn',
      'Winter',
    ]);
    expect(new Set(APP_THEMES.map((t) => t.photo)).size).toBe(8);
  });

  it('keeps every accent readable: as text on the dark, and with its ink on it', () => {
    for (const theme of APP_THEMES) {
      expect(contrast(theme.accent, colors.background)).toBeGreaterThanOrEqual(4.5);
      const accent = buildAccentTheme(theme.accent);
      expect(contrast(accent.onAccent, theme.accent)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('darkens every photo behind Feed’s hero at least as much as the measured gym photo', () => {
    for (const theme of APP_THEMES) {
      expect(theme.heroDarkness).toBeGreaterThanOrEqual(0.1);
      expect(theme.heroDarkness).toBeLessThan(0.62);
    }
  });

  it('credits every photo that isn’t Progresso’s own', () => {
    expect(APP_THEMES.filter((t) => t.id !== 'golden-hour-gym').every((t) => t.photographer)).toBe(
      true,
    );
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
