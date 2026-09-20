import { TextButton } from '../design/Button';

interface Props {
  onPress: () => void;
  testID?: string;
}

// Creating a custom exercise is the less common path (the picker also offers
// it), so it is a quiet text action under Add Exercise, not a second button.
export function CreateCustomExerciseButton({ onPress, testID }: Props) {
  return <TextButton testID={testID} label="Create Custom Exercise" onPress={onPress} />;
}
