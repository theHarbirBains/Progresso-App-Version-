import { createContext, useContext } from 'react';
import { buildAccentTheme, type AccentTheme } from './accentColor';
import { DEFAULT_THEME_ID, themeById, type AppTheme, type AppThemeId } from './appThemes';

// The app theme as every component reads it. Kept apart from AppThemeProvider (which needs the
// profile, for the seasons' hemisphere), so a component that only reads the accent never pulls
// the profile and its database client in with it.

export interface AppThemeValue {
  /** The theme showing now: the one chosen, or the season's while following the seasons. */
  theme: AppTheme;
  /** The theme's accent, with its ink and tints worked out (buildAccentTheme). */
  accent: AccentTheme;
  /** The theme the person picked -- what shows when they aren't following the seasons. */
  chosenId: AppThemeId;
  followSeasons: boolean;
  /** Whether the saved choice has been read. The app waits for it, so it never shows the default first. */
  loaded: boolean;
  /** Picks a theme -- which also stops following the seasons, or the pick would never show. */
  choose: (id: AppThemeId) => void;
  setFollowSeasons: (on: boolean) => void;
  /** Whether it's the holidays (theme/snowSeason.ts), when Snowfall and Decorations can be switched on and off. */
  snowSeason: boolean;
  /** The person's Snowfall switch -- on unless they turned it off. */
  snowfall: boolean;
  /** Whether snow is falling over the app now: in season, with the switch on. */
  snowing: boolean;
  setSnowfall: (on: boolean) => void;
  /** The person's Holiday Decorations switch -- on unless they turned it off. */
  decorations: boolean;
  /** Whether the decorations show now (design/HolidayDecorations.tsx): in season, with the switch on. */
  decorating: boolean;
  setDecorations: (on: boolean) => void;
}

const defaultTheme = themeById(DEFAULT_THEME_ID);

// Without a provider (a test, a component on its own), the original look.
export const AppThemeContext = createContext<AppThemeValue>({
  theme: defaultTheme,
  accent: buildAccentTheme(defaultTheme.accent),
  chosenId: defaultTheme.id,
  followSeasons: false,
  loaded: true,
  choose: () => undefined,
  setFollowSeasons: () => undefined,
  snowSeason: false,
  snowfall: true,
  snowing: false,
  setSnowfall: () => undefined,
  decorations: true,
  decorating: false,
  setDecorations: () => undefined,
});

export function useAppTheme(): AppThemeValue {
  return useContext(AppThemeContext);
}
