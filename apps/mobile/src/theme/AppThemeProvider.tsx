import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useProfile } from '../profile/ProfileProvider';
import { buildAccentTheme } from './accentColor';
import { AppThemeContext, type AppThemeValue } from './appThemeContext';
import { DEFAULT_THEME_ID, isAppThemeId, seasonFor, themeById, type AppThemeId } from './appThemes';

const STORAGE_KEY = '@progresso/appearance';

interface Saved {
  themeId: AppThemeId;
  followSeasons: boolean;
}

/**
 * The look the person chose in Settings > Appearance, kept on this phone (it's how the app looks
 * here, like a wallpaper -- not account data) and read before the first screen shows. While
 * following the seasons the season's theme shows -- by month, for the hemisphere of the country
 * on their profile -- and changes by itself only then: nothing changes a theme without the
 * person's say.
 */
export function AppThemeProvider({ children }: PropsWithChildren) {
  const { profile } = useProfile();
  const [saved, setSaved] = useState<Saved>({ themeId: DEFAULT_THEME_ID, followSeasons: false });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        if (!cancelled && parsed && typeof parsed === 'object') {
          const { themeId, followSeasons } = parsed as Record<string, unknown>;
          setSaved({
            themeId: isAppThemeId(themeId) ? themeId : DEFAULT_THEME_ID,
            followSeasons: followSeasons === true,
          });
        }
      } catch {
        // The original look, then.
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback((next: Saved) => {
    setSaved(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  const country = profile?.country ?? null;
  const value = useMemo<AppThemeValue>(() => {
    const theme = saved.followSeasons
      ? themeById(seasonFor(new Date(), country))
      : themeById(saved.themeId);
    return {
      theme,
      accent: buildAccentTheme(theme.accent),
      chosenId: saved.themeId,
      followSeasons: saved.followSeasons,
      loaded,
      choose: (id) => save({ themeId: id, followSeasons: false }),
      setFollowSeasons: (on) => save({ themeId: saved.themeId, followSeasons: on }),
    };
  }, [saved, country, loaded, save]);

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}
