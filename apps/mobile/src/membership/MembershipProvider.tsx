import type { PropsWithChildren } from 'react';
import { useProfile } from '../profile/ProfileProvider';
import { MembershipContext } from './useMembership';

/**
 * The signed-in person's membership, from their profile, for useMembership. Until the profile is
 * read, everything -- so nothing they have flashes locked while it loads.
 */
export function MembershipProvider({ children }: PropsWithChildren) {
  const { profile } = useProfile();
  return (
    <MembershipContext.Provider value={profile?.membershipTier ?? 'everything'}>
      {children}
    </MembershipContext.Provider>
  );
}
