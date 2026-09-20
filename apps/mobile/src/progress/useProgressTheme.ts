import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import {
  buildAccentTheme,
  DEFAULT_NUTRITION_THEME,
  DEFAULT_WORKOUT_THEME,
  type AccentTheme,
} from '../theme/accentColor';

/**
 * Progress is workout-performance analytics, so its own content always
 * follows the user's Workout Mode accent color (never Nutrition's), read
 * the exact same way DashboardScreen.tsx does -- fetch the profile, build
 * the theme from workoutAccentColor if set, else the default. Centralized
 * here so every Progress screen shares one implementation instead of
 * repeating it.
 *
 * Also exposes `nutritionTheme`, built from the same already-fetched
 * profile at no extra query cost -- needed by any screen that renders the
 * shared `ModeToggle` (its crossfade needs both themes, not just its own),
 * not by every caller of this hook.
 */
export function useProgressTheme(): {
  theme: AccentTheme;
  nutritionTheme: AccentTheme;
  weightUnit: 'kg' | 'lb';
  activeWorkoutSplitId: string | null;
  themeLoading: boolean;
} {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const [theme, setTheme] = useState<AccentTheme>(DEFAULT_WORKOUT_THEME);
  const [nutritionTheme, setNutritionTheme] = useState<AccentTheme>(DEFAULT_NUTRITION_THEME);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [activeWorkoutSplitId, setActiveWorkoutSplitId] = useState<string | null>(null);
  const [themeLoading, setThemeLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!accessToken) return;
      try {
        const profile = await getMyProfile(accessToken);
        if (!mounted) return;
        setTheme(
          profile.workoutAccentColor
            ? buildAccentTheme(profile.workoutAccentColor)
            : DEFAULT_WORKOUT_THEME,
        );
        setNutritionTheme(
          profile.nutritionAccentColor
            ? buildAccentTheme(profile.nutritionAccentColor)
            : DEFAULT_NUTRITION_THEME,
        );
        setWeightUnit(profile.weightUnit);
        setActiveWorkoutSplitId(profile.activeWorkoutSplitId);
      } catch {
        // Profile fetch failed (network error, stale session, etc.) --
        // theme/weightUnit/activeWorkoutSplitId simply keep their existing
        // (initially default) values rather than this becoming an
        // unhandled rejection.
      } finally {
        if (mounted) setThemeLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [accessToken]);

  return { theme, nutritionTheme, weightUnit, activeWorkoutSplitId, themeLoading };
}
