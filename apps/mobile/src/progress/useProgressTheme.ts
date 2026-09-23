import { useProfile } from '../profile/ProfileProvider';
import { DEFAULT_NUTRITION_THEME, DEFAULT_WORKOUT_THEME, type AccentTheme } from '../theme/accentColor';

/**
 * `theme`/`nutritionTheme` are always the app's one fixed neutral default
 * (`DEFAULT_WORKOUT_THEME`/`DEFAULT_NUTRITION_THEME`, both the same white --
 * see accentColor.ts) -- the app-wide black-and-white redesign's own
 * explicit, unconditional call, deliberately NOT overridden by any
 * `workoutAccentColor`/`nutritionAccentColor` a profile might still have
 * saved from before that redesign (or via the still-functional-but-now-
 * visually-inert accent picker, AccentColorPickerScreen -- see its own
 * comment).
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
    // Fixed, not state -- see the hook comment above.
    theme: DEFAULT_WORKOUT_THEME,
    nutritionTheme: DEFAULT_NUTRITION_THEME,
    weightUnit: profile?.weightUnit ?? 'kg',
    activeWorkoutSplitId: profile?.activeWorkoutSplitId ?? null,
    displayName: profile?.displayName ?? null,
    username: profile?.username ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    themeLoading: loading,
  };
}
