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
});

export function useAppTheme(): AppThemeValue {
  return useContext(AppThemeContext);
}
