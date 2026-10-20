import { View } from 'react-native';
import type { TrainingComfort } from '../lib/api';
import { TRAINING_COMFORT_OPTIONS } from './onboardingOptions';
import { OnboardingOptionCard } from './OnboardingOptionCard';

interface Props {
  testID: string;
  value: TrainingComfort | null;
  onChange: (value: TrainingComfort) => void;
}

/** The four answers to "How comfortable are you with planning and progressing your workouts?" */
export function TrainingComfortSelector({ testID, value, onChange }: Props) {
  return (
    <View testID={testID}>
      {TRAINING_COMFORT_OPTIONS.map((option) => (
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
