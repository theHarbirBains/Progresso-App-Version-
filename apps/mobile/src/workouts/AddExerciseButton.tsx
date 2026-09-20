import { SecondaryButton } from '../design/Button';

interface Props {
  onPress: () => void;
  testID?: string;
}

// The one way to add an exercise mid-workout: a full-width secondary button
// (the filled button on this screen is reserved for Finish Workout).
export function AddExerciseButton({ onPress, testID }: Props) {
  return <SecondaryButton testID={testID} label="Add Exercise" onPress={onPress} />;
}
