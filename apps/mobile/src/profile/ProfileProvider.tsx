import { useContext, useMemo, type PropsWithChildren } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useSignedInResource } from '../lib/useSignedInResource';
import { updateMyProfile, type ProfileResponse, type UpdateProfileInput } from '../lib/api';
import { fetchMyProfile } from './profileQueries';
import { ProfileContext, type ProfileContextValue } from './profileContext';

export { useProfileIfAny, type ProfileContextValue } from './profileContext';

/**
 * The one shared fetch of the signed-in user's profile row. Previously,
 * every screen that needed any piece of it (accent colors, weight unit,
 * display name, avatar...) fetched its own copy independently --
 * useProgressTheme alone had 20+ call sites, each fetching the profile on
 * its own mount, so navigating Feed -> Train -> Progress -> You re-fetched
 * the identical row four times in a few seconds. Fetched once per session
 * here (on sign-in, cleared on sign-out) instead: useProgressTheme (and any
 * other consumer) now reads this cache rather than fetching, so a
 * navigation that doesn't change the profile costs zero extra requests.
 *
 * A screen that changes the profile calls this context's `updateProfile`
 * (not `updateMyProfile` from lib/api directly) so the shared cache updates
 * from that save's own response -- no second fetch, and every other screen
 * already on the account sees the change on its next render.
 *
 * Deliberately simple: fetch once, refresh only after a save. No
 * background/on-foreground re-fetch -- see DESIGN.md's note on this if that
 * tradeoff ever needs revisiting (e.g. multi-device edits shouldn't be
 * expected to show up without a manual refresh today).
 *
 * Keyed on the user id, so the hourly token refresh doesn't refetch it. The
 * read goes straight to Supabase (see fetchMyProfile); saves still go
 * through the API's PATCH /users/me.
 */
export function ProfileProvider({ children }: PropsWithChildren) {
  const { session, user } = useAuth();
  const accessToken = session?.access_token;

  const {
    data: profile,
    loading,
    error,
    refetch,
    setData: setProfile,
  } = useSignedInResource(
    user?.id,
    fetchMyProfile,
    null as ProfileResponse | null,
    'Failed to load profile',
  );

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile,
      loading,
      error,
      refetch,
      updateProfile: async (updates: UpdateProfileInput) => {
        if (!accessToken) throw new Error('Not signed in');
        const updated = await updateMyProfile(accessToken, updates);
        setProfile(updated);
        return updated;
      },
    }),
    [profile, loading, error, refetch, setProfile, accessToken],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return ctx;
}
