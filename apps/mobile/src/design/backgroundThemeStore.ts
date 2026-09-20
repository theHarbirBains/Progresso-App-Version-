import { createContext, useContext } from 'react';
import {
  BACKGROUND_THEMES,
  DEFAULT_BACKGROUND_THEME,
  type BackgroundThemeDefinition,
  type BackgroundThemeId,
} from './backgroundThemes';

// Split out of BackgroundThemeContext.tsx so the context object and
// useBackgroundTheme() hook (used broadly by glass surfaces -- AppCard,
// BottomNavBar, SegmentedControl, ...) don't drag in BackgroundThemeContext
// .tsx's own imports (useAuth, lib/api) just to read the current theme.
// Those are needed only by BackgroundThemeProvider itself, which still
// lives in BackgroundThemeContext.tsx and re-exports everything here for
// existing callers.
export interface BackgroundThemeContextValue {
  themeId: BackgroundThemeId;
  theme: BackgroundThemeDefinition;
  /** True once the local cache (and, if signed in, the profile) has been
   * consulted at least once -- gates the app's first paint so it never
   * flashes the default theme before switching to the saved one. */
  ready: boolean;
  /** Applies immediately (optimistic local + cache), then persists to the
   * backend. Independent of Workout/Nutrition accent, which keep their own
   * existing save flow untouched. */
  setThemeId: (id: BackgroundThemeId) => Promise<void>;
}

export const BackgroundThemeContext = createContext<BackgroundThemeContextValue | null>(null);

// Falls back to the default (Obsidian) theme, rather than throwing, when
// there's no Provider in the tree. The real app always mounts
// BackgroundThemeProvider once at the root (App.tsx), so this only matters
// for isolated rendering -- component-level tests, storybook-style
// previews -- which is exactly the scenario glass surfaces need to keep
// working: GlassBackground (and so AppCard, BottomNavBar, SegmentedControl,
// etc.) reads the current theme via this hook, and none of those
// components' own tests should have to wrap every render in a Provider
// just to resolve a background tint.
const FALLBACK_CONTEXT_VALUE: BackgroundThemeContextValue = {
  themeId: DEFAULT_BACKGROUND_THEME,
  theme: BACKGROUND_THEMES[DEFAULT_BACKGROUND_THEME],
  ready: true,
  setThemeId: async () => {},
};

export function useBackgroundTheme(): BackgroundThemeContextValue {
  const ctx = useContext(BackgroundThemeContext);
  return ctx ?? FALLBACK_CONTEXT_VALUE;
}
