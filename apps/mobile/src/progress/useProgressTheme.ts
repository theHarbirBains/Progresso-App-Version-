import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import { DEFAULT_NUTRITION_THEME, DEFAULT_WORKOUT_THEME, type AccentTheme } from '../theme/accentColor';

/**
 * `theme`/`nutritionTheme` are always the app's one fixed neutral default
 * (`DEFAULT_WORKOUT_THEME`/`DEFAULT_NUTRITION_THEME`, both the same white --
 * see accentColor.ts) -- the app-wide black-and-white redesign's own
 * explicit, unconditional call, deliberately NOT overridden by any
 * `workoutAccentColor`/`nutritionAccentColor` a profile might still have
 * saved from before that redesign (or via the still-functional-but-now-
 * visually-inert accent picker, AccentColorPickerScreen -- see its own
 * comment). Kept as a hook (rather than importing the constants directly)
 * so every existing call site's shape stays unchanged.
 *
 * Also exposes the identity fields (`displayName`, `username`,
 * `avatarUrl`) off the profile fetch this hook already makes for
 * `weightUnit`/`activeWorkoutSplitId` -- no second request -- for any
 * screen that needs to show "who this is" (e.g. Feed's per-item byline).
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
  // Fixed, not state -- see the hook comment above.
  const theme = DEFAULT_WORKOUT_THEME;
  const nutritionTheme = DEFAULT_NUTRITION_THEME;
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
