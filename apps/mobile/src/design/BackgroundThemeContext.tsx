import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile, updateMyProfile } from '../lib/api';
import { BackgroundThemeContext, type BackgroundThemeContextValue } from './backgroundThemeStore';
import {
  BACKGROUND_THEMES,
  DEFAULT_BACKGROUND_THEME,
  isBackgroundThemeId,
  resolveBackgroundTheme,
  type BackgroundThemeId,
} from './backgroundThemes';

const STORAGE_KEY = '@progresso/backgroundTheme';

export function BackgroundThemeProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const accessToken = session?.access_token;

  const [themeId, setThemeIdState] = useState<BackgroundThemeId>(DEFAULT_BACKGROUND_THEME);
  const [cacheChecked, setCacheChecked] = useState(false);
  // Guards against the cache-restore effect clobbering a value the profile
  // reconciliation effect already applied -- the two run independently and
  // aren't sequenced relative to each other, so without this a slow cache
  // read resolving *after* a fast profile fetch could overwrite the correct
  // (profile) value with a stale cached one.
  const profileAppliedRef = useRef(false);

  // Instant local restore, before any network round trip -- this is what
  // lets startup skip ever painting the default theme for a signed-in user
  // who already has a different one saved.
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((cached) => {
        if (mounted && !profileAppliedRef.current && isBackgroundThemeId(cached)) {
          setThemeIdState(cached);
        }
      })
      .finally(() => {
        if (mounted) setCacheChecked(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Backend profile is the long-term source of truth (e.g. a theme picked
  // on another device) -- reconciled once per sign-in, without blocking the
  // instant local restore above.
  useEffect(() => {
    if (!accessToken) return;
    let mounted = true;
    getMyProfile(accessToken)
      .then((profile) => {
        if (!mounted) return;
        if (isBackgroundThemeId(profile.backgroundTheme)) {
          profileAppliedRef.current = true;
          setThemeIdState(profile.backgroundTheme);
          AsyncStorage.setItem(STORAGE_KEY, profile.backgroundTheme).catch(() => {});
        }
      })
      .catch(() => {
        // Network/auth failure -- keep whatever the local cache already
        // resolved rather than surfacing an error for a purely cosmetic
        // preference.
      });
    return () => {
      mounted = false;
    };
  }, [accessToken]);

  const setThemeId = useCallback(
    async (id: BackgroundThemeId) => {
      setThemeIdState(id);
      AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {});
      if (!accessToken) return;
      await updateMyProfile(accessToken, { backgroundTheme: id });
    },
    [accessToken],
  );

  const value = useMemo<BackgroundThemeContextValue>(
    () => ({
      themeId,
      theme: resolveBackgroundTheme(themeId),
      ready: cacheChecked,
      setThemeId,
    }),
    [themeId, cacheChecked, setThemeId],
  );

  return (
    <BackgroundThemeContext.Provider value={value}>{children}</BackgroundThemeContext.Provider>
  );
}

// Re-exported so existing callers importing from this file (screens, which
// already depend on auth anyway) don't need to change their import path.
// Anything that only needs to *read* the current theme (glass surfaces --
// see GlassBackground.tsx) should import useBackgroundTheme from
// backgroundThemeStore directly instead, to avoid pulling in useAuth/lib/api.
export { useBackgroundTheme } from './backgroundThemeStore';
export { BACKGROUND_THEMES };
