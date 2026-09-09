import { View } from 'react-native';
import type { TrainingStylePreference } from '../lib/api';
import { TRAINING_STYLE_OPTIONS } from './onboardingOptions';
import { OnboardingOptionCard } from './OnboardingOptionCard';

interface Props {
  testID: string;
  value: TrainingStylePreference | null;
  onChange: (value: TrainingStylePreference) => void;
}

/** Stores a preference only -- no guided-workout generation is implemented
 * by this task (see onboarding spec). */
export function WorkoutPreferenceSelector({ testID, value, onChange }: Props) {
  return (
    <View testID={testID}>
      {TRAINING_STYLE_OPTIONS.map((option) => (
        <OnboardingOptionCard
          key={option.value}
          testID={`${testID}-${option.value}`}
          label={option.label}
          description={option.description}
          selected={value === option.value}
          onPress={() => onChange(option.value)}
        />
      ))}
    </View>
  );
}
