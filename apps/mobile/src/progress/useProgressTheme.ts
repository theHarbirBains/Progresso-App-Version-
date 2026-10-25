import { useProfile } from '../profile/ProfileProvider';
import type { AccentTheme } from '../theme/accentColor';
import { useAppTheme } from '../theme/appThemeContext';

/**
 * `theme`/`nutritionTheme` are the app theme's one accent (Settings >
 * Appearance -- theme/AppThemeProvider.tsx; soft amber in the default,
 * Golden Hour Gym), the same in both modes, so every screen, and the bottom
 * nav's highlight of the page you're on, shows the same accent. There is no
 * free colour picking: a theme's accent is chosen with its photo. Any
 * `workoutAccentColor`/`nutritionAccentColor` still stored on an account
 * from the old color pickers is deliberately ignored. Kept as two fields so
 * every existing `theme.accent`/`nutritionTheme.accent` call site stays
 * unchanged.
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
  const { accent } = useAppTheme();

  return {
    theme: accent,
    nutritionTheme: accent,
    weightUnit: profile?.weightUnit ?? 'lb',
    activeWorkoutSplitId: profile?.activeWorkoutSplitId ?? null,
    displayName: profile?.displayName ?? null,
    username: profile?.username ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    themeLoading: loading,
  };
}
