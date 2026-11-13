import { View } from 'react-native';
import type { FitnessGoal } from '../lib/api';
import { FITNESS_GOAL_OPTIONS } from './onboardingOptions';
import { OnboardingOptionCard } from './OnboardingOptionCard';

interface Props {
  testID: string;
  value: FitnessGoal[];
  onChange: (value: FitnessGoal[]) => void;
  /** The most that can be picked; the rest dim once that many are. */
  max: number;
}

/** Pick-several fitness goals, up to `max`, kept in the order picked. Tapping a picked one drops it. */
export function GoalSelector({ testID, value, onChange, max }: Props) {
  const full = value.length >= max;
  return (
    <View testID={testID}>
      {FITNESS_GOAL_OPTIONS.map((option) => {
        const selected = value.includes(option.value);
        return (
          <OnboardingOptionCard
            key={option.value}
            testID={`${testID}-${option.value}`}
            label={option.label}
            selected={selected}
            disabled={full && !selected}
            onPress={() =>
              onChange(
                selected ? value.filter((goal) => goal !== option.value) : [...value, option.value],
              )
            }
          />
        );
      })}
    </View>
  );
}
