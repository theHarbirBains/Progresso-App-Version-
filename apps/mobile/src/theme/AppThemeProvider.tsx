import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { HeadingFontContext, headingFamilyMap } from '../design/headingFont';
import { useProfile } from '../profile/ProfileProvider';
import { buildAccentTheme } from './accentColor';
import { AppThemeContext, type AppThemeValue } from './appThemeContext';
import { DEFAULT_THEME_ID, isAppThemeId, seasonFor, themeById, type AppThemeId } from './appThemes';
import { isSnowSeason } from './snowSeason';

const STORAGE_KEY = '@progresso/appearance';

interface Saved {
  themeId: AppThemeId;
  followSeasons: boolean;
  /** Snow over the app through the holidays: on unless turned off. */
  snowfall: boolean;
  /** The holiday decorations (a Santa hat on titles, lights on the tab bar): on unless turned off. */
  decorations: boolean;
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
  const [saved, setSaved] = useState<Saved>({
    themeId: DEFAULT_THEME_ID,
    followSeasons: false,
    snowfall: true,
    decorations: true,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        if (!cancelled && parsed && typeof parsed === 'object') {
          const { themeId, followSeasons, snowfall, decorations } = parsed as Record<
            string,
            unknown
          >;
          setSaved({
            themeId: isAppThemeId(themeId) ? themeId : DEFAULT_THEME_ID,
            followSeasons: followSeasons === true,
            snowfall: snowfall !== false,
            decorations: decorations !== false,
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
    const now = new Date();
    const theme = saved.followSeasons
      ? themeById(seasonFor(now, country))
      : themeById(saved.themeId);
    const snowSeason = isSnowSeason(now);
    return {
      theme,
      accent: buildAccentTheme(theme.accent),
      chosenId: saved.themeId,
      followSeasons: saved.followSeasons,
      loaded,
      choose: (id) => save({ ...saved, themeId: id, followSeasons: false }),
      setFollowSeasons: (on) => save({ ...saved, followSeasons: on }),
      snowSeason,
      snowfall: saved.snowfall,
      snowing: snowSeason && saved.snowfall,
      setSnowfall: (on) => save({ ...saved, snowfall: on }),
      decorations: saved.decorations,
      decorating: snowSeason && saved.decorations,
      setDecorations: (on) => save({ ...saved, decorations: on }),
    };
  }, [saved, country, loaded, save]);

  // The theme's heading face, for the shared Text (design/headingFont.ts).
  const headings = useMemo(() => headingFamilyMap(value.theme.font), [value.theme.font]);
  return (
    <AppThemeContext.Provider value={value}>
      <HeadingFontContext.Provider value={headings}>{children}</HeadingFontContext.Provider>
    </AppThemeContext.Provider>
  );
}
