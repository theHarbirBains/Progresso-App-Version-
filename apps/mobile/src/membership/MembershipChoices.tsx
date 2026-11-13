import { View } from 'react-native';
import type { MembershipTier } from '../lib/api';
import { OnboardingOptionCard } from '../onboarding/OnboardingOptionCard';
import { MEMBERSHIP_OPTIONS } from './membershipTiers';

interface Props {
  testID: string;
  value: MembershipTier | null;
  onChange: (tier: MembershipTier) => void;
}

/** The three memberships as pick-one cards: each one's name, what it is, and what it includes. */
export function MembershipChoices({ testID, value, onChange }: Props) {
  return (
    <View testID={testID}>
      {MEMBERSHIP_OPTIONS.map((option) => (
        <OnboardingOptionCard
          key={option.tier}
          testID={`${testID}-${option.tier}`}
          label={option.name}
          description={`${option.summary}\n${option.includes.join(' · ')}`}
          selected={value === option.tier}
          onPress={() => onChange(option.tier)}
        />
      ))}
    </View>
  );
}
