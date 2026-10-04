import { useProfile } from '../profile/ProfileProvider';
import {
  buildAccentTheme,
  DEFAULT_NUTRITION_THEME,
  DEFAULT_WORKOUT_THEME,
  type AccentTheme,
} from '../theme/accentColor';

/**
 * `theme`/`nutritionTheme` are the user's own saved `workoutAccentColor`/
 * `nutritionAccentColor` (via AccentColorPickerScreen), falling back to the
 * app's fixed neutral white default when neither is set -- real,
 * user-visible color customization, applied wherever a screen reads
 * `theme.accent`/`nutritionTheme.accent` off this hook (Feed/Workout
 * History's hero cards, the bottom nav's Train/Nutrition tabs via App.tsx,
 * every other screen built on this hook).
 *
 * Also exposes the identity fields (`displayName`, `username`,
 * `avatarUrl`) and `weightUnit`/`activeWorkoutSplitId` off the one shared
 * profile fetch `ProfileProvider` already makes -- no fetch of its own.
 * This used to be its own independent `getMyProfile` call (one per mount,
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
    theme: profile?.workoutAccentColor
      ? buildAccentTheme(profile.workoutAccentColor)
      : DEFAULT_WORKOUT_THEME,
    nutritionTheme: profile?.nutritionAccentColor
      ? buildAccentTheme(profile.nutritionAccentColor)
      : DEFAULT_NUTRITION_THEME,
    weightUnit: profile?.weightUnit ?? 'lb',
    activeWorkoutSplitId: profile?.activeWorkoutSplitId ?? null,
    displayName: profile?.displayName ?? null,
    username: profile?.username ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    themeLoading: loading,
  };
}
