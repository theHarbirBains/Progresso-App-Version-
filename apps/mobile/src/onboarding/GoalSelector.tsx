import type { FitnessGoal } from '../lib/api';
import { FITNESS_GOAL_OPTIONS } from './onboardingOptions';
import { OnboardingTiles } from './OnboardingTiles';

interface Props {
  testID: string;
  value: FitnessGoal[];
  onChange: (value: FitnessGoal[]) => void;
  /** The most that can be picked; the rest dim once that many are. */
  max: number;
}

/**
 * Pick-several fitness goals, up to `max`, kept in the order picked, as a grid of widget tiles.
 * Tapping a picked one drops it.
 */
export function GoalSelector({ testID, value, onChange, max }: Props) {
  const full = value.length >= max;
  return (
    <OnboardingTiles
      testID={testID}
      tilePrefix={testID}
      options={FITNESS_GOAL_OPTIONS}
      isSelected={(goal) => value.includes(goal)}
      isDisabled={(goal) => full && !value.includes(goal)}
      onPress={(goal) =>
        onChange(value.includes(goal) ? value.filter((g) => g !== goal) : [...value, goal])
      }
    />
  );
}
