import { useProfile } from '../profile/ProfileProvider';
import {
  DEFAULT_NUTRITION_THEME,
  DEFAULT_WORKOUT_THEME,
  type AccentTheme,
} from '../theme/accentColor';

/**
 * `theme`/`nutritionTheme` are the app's one fixed soft amber accent (Warm
 * Minimal) -- there is no color customization, so every screen, and the
 * bottom nav's highlight of the page you're on, always shows the same
 * accent. Any `workoutAccentColor`/`nutritionAccentColor` still stored on an
 * account from the old color pickers is deliberately ignored. Kept as two
 * fields so every existing `theme.accent`/`nutritionTheme.accent` call site
 * stays unchanged.
 *
 * Also exposes the identity fields (`displayName`, `username`,
 * `avatarUrl`) and `weightUnit`/`activeWorkoutSplitId` off the one shared
 * profile fetch `ProfileProvider` already makes -- no fetch of its own.
 * This used to be its own independent profile fetch (one per mount,
 * of which there were 20+ across the app -- see ProfileProvider's own
 * comment on why that was a real performance problem); it is now a pure
 * derivation over the shared cache, kept as a hook (rather than inlining
 * `useProfile()` at every call site) so every existing call site's shape
 * stays unchanged.
 */
export function useProgressTheme(): {
  theme: AccentTheme;
  nutritionTheme: AccentTheme;
  weightUnit: 'kg' | 'lb';
  activeWorkoutSplitId: string | null;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  themeLoading: boolean;
} {
  const { profile, loading } = useProfile();

  return {
    theme: DEFAULT_WORKOUT_THEME,
    nutritionTheme: DEFAULT_NUTRITION_THEME,
    weightUnit: profile?.weightUnit ?? 'lb',
    activeWorkoutSplitId: profile?.activeWorkoutSplitId ?? null,
    displayName: profile?.displayName ?? null,
    username: profile?.username ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    themeLoading: loading,
  };
}
