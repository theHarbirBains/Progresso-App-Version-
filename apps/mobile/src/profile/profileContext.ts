import { createContext, useContext } from 'react';
import type { ProfileResponse, UpdateProfileInput } from '../lib/api';

// The profile's context on its own, with nothing but React behind it (like theme/appThemeContext.ts),
// so a shared component can read the profile where there is one without pulling in the provider's
// sign-in and Supabase reads. ProfileProvider fills it and re-exports both.

export interface ProfileContextValue {
  /** Null until the first fetch resolves, or if it fails before ever succeeding once. */
  profile: ProfileResponse | null;
  /** True only until the first fetch settles -- a later refetch/update never flips this back to true, so no screen should see a loading->loaded->loading flicker just from navigating around. */
  loading: boolean;
  error: string | null;
  /** Re-fetches from the server. Rarely needed directly -- prefer `updateProfile` after a write, which updates the cache from that write's own response instead of a second round trip. */
  refetch: () => Promise<boolean>;
  /** Saves via the same PATCH updateMyProfile already used, then updates the shared cache from the response -- every other screen reading `profile` sees the change immediately, with no extra fetch. */
  updateProfile: (updates: UpdateProfileInput) => Promise<ProfileResponse>;
}

export const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

/**
 * The signed-in person's profile where a ProfileProvider is above, else null -- for a widget that
 * shows more with it and still works without (a food's vitamins against the person's targets).
 */
export function useProfileIfAny(): ProfileContextValue['profile'] | null {
  return useContext(ProfileContext)?.profile ?? null;
}
