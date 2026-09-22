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
 *
 * Also exposes the identity fields (`displayName`, `username`,
 * `avatarUrl`) off that same already-fetched profile -- no second request
 * -- for any screen that needs to show "who this is" (e.g. Feed's
 * per-item byline) without re-fetching what this hook already has.
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
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const [theme, setTheme] = useState<AccentTheme>(DEFAULT_WORKOUT_THEME);
  const [nutritionTheme, setNutritionTheme] = useState<AccentTheme>(DEFAULT_NUTRITION_THEME);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [activeWorkoutSplitId, setActiveWorkoutSplitId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
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
        setDisplayName(profile.displayName);
        setUsername(profile.username);
        setAvatarUrl(profile.avatarUrl);
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

  return {
    theme,
    nutritionTheme,
    weightUnit,
    activeWorkoutSplitId,
    displayName,
    username,
    avatarUrl,
    themeLoading,
  };
}
