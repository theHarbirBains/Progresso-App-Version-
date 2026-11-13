import { createContext, useContext } from 'react';
import type { MembershipTier } from '../lib/api';
import { includesNutrition, includesTrainerMode } from './membershipTiers';

// The signed-in person's membership as every component reads it. Kept apart from
// MembershipProvider (which reads the profile), so a component that only asks what's included
// never pulls the profile and its database client in with it -- the same split as the app theme.

export interface Membership {
  tier: MembershipTier;
  nutrition: boolean;
  trainerMode: boolean;
}

/** Without a provider (a test, a component on its own), or until the profile is read: everything. */
export const MembershipContext = createContext<MembershipTier>('everything');

export function useMembership(): Membership {
  const tier = useContext(MembershipContext);
  return { tier, nutrition: includesNutrition(tier), trainerMode: includesTrainerMode(tier) };
}
