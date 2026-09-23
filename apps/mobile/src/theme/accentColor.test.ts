import {
  buildAccentTheme,
  DEFAULT_NUTRITION_COLOR,
  DEFAULT_WORKOUT_COLOR,
  hexToRgb,
  isValidHex,
  mixHex,
  normalizeHex,
  rgbToHex,
  withAlpha,
} from './accentColor';
import { colors } from '../design/theme';

describe('isValidHex', () => {
  it('accepts a 6-digit hex with a leading #', () => {
    expect(isValidHex('#2F80FF')).toBe(true);
  });

  it('rejects a value without a leading #', () => {
    expect(isValidHex('2F80FF')).toBe(false);
  });

  it('rejects a 3-digit shorthand hex', () => {
    expect(isValidHex('#2F8')).toBe(false);
  });

  it('rejects a non-hex string', () => {
    expect(isValidHex('blue')).toBe(false);
  });
});

describe('normalizeHex', () => {
  it('adds a missing leading # and uppercases', () => {
    expect(normalizeHex('2f80ff')).toBe('#2F80FF');
  });

  it('uppercases an already-hashed value', () => {
    expect(normalizeHex('#2f80ff')).toBe('#2F80FF');
  });

  it('returns null for an invalid value', () => {
    expect(normalizeHex('not-a-color')).toBeNull();
  });
});

describe('hexToRgb / rgbToHex', () => {
  it('round-trips a hex color through rgb and back', () => {
    expect(rgbToHex(47, 128, 255)).toBe('#2F80FF');
    expect(hexToRgb('#2F80FF')).toEqual({ r: 47, g: 128, b: 255 });
  });

  it('clamps out-of-range rgb values when converting back to hex', () => {
    expect(rgbToHex(-10, 300, 128)).toBe('#00FF80');
  });
});

describe('withAlpha', () => {
  it('produces an rgba string carrying the given alpha', () => {
    expect(withAlpha('#2F80FF', 0.14)).toBe('rgba(47, 128, 255, 0.14)');
  });
});

describe('mixHex', () => {
  it('returns hexA at t=0 and hexB at t=1', () => {
    expect(mixHex('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(mixHex('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
  });

  it('blends midway at t=0.5', () => {
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });
});

describe('buildAccentTheme', () => {
  it('normalizes the accent and derives bg/border tints from it', () => {
    const theme = buildAccentTheme('2f80ff');

    expect(theme.accent).toBe('#2F80FF');
    expect(theme.accentBg).toBe('rgba(47, 128, 255, 0.14)');
    expect(theme.accentBorder).toBe('rgba(47, 128, 255, 0.35)');
    expect(theme.progress).toBe(theme.accent);
  });

  it('picks the app-dark ink for a bright accent (contrast safety)', () => {
    // Bright Gold -- a bright, saturated yellow. Light text on top of it
    // would be unreadable, so this must resolve to the dark ink.
    const theme = buildAccentTheme('#FFD43B');

    expect(theme.onAccent).toBe(colors.background);
  });

  it('picks the app-light ink for a dark, saturated accent (contrast safety)', () => {
    // Deep Blue -- dark enough that dark-on-dark text would be unreadable.
    const theme = buildAccentTheme('#1D4ED8');

    expect(theme.onAccent).toBe(colors.textPrimary);
  });

  it('produces a muted variant distinct from the base accent', () => {
    const theme = buildAccentTheme(DEFAULT_WORKOUT_COLOR);

    expect(theme.accentMuted).not.toBe(theme.accent);
  });
});

describe('default colors', () => {
  it('are both the same neutral white -- the app-wide black-and-white redesign', () => {
    expect(DEFAULT_WORKOUT_COLOR).toBe('#FFFFFF');
    expect(DEFAULT_NUTRITION_COLOR).toBe('#FFFFFF');
  });
});
