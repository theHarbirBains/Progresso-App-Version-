import { View } from 'react-native';
import type { FitnessGoal } from '../lib/api';
import { FITNESS_GOAL_OPTIONS } from './onboardingOptions';
import { OnboardingOptionCard } from './OnboardingOptionCard';

interface Props {
  testID: string;
  value: FitnessGoal | null;
  onChange: (value: FitnessGoal) => void;
}

/** Single primary goal today -- the value type already allows extending to
 * multiple goals later without any UI rework here (see onboarding spec). */
export function GoalSelector({ testID, value, onChange }: Props) {
  return (
    <View testID={testID}>
      {FITNESS_GOAL_OPTIONS.map((option) => (
        <OnboardingOptionCard
          key={option.value}
          testID={`${testID}-${option.value}`}
          label={option.label}
          selected={value === option.value}
          onPress={() => onChange(option.value)}
        />
      ))}
    </View>
  );
}
