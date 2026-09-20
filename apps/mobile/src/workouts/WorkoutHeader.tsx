import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../design/theme';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';

interface Props {
  title: string;
  testID?: string;
}

// No back button or "..." options menu -- Finish Workout/Cancel Workout
// already cover every action this screen exposes (the menu only ever
// offered a duplicate "Complete Workout"), so both were removed entirely
// rather than replaced with something else. Applies the device's real
// safe-area top inset directly (same insets.top + spacing pattern
// ScreenContainer uses) so the title never sits under the iOS status bar.
export function WorkoutHeader({ title, testID }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      testID={testID}
      style={[styles.workoutHeaderCentered, { paddingTop: insets.top + spacing.sm }]}
    >
      <Text style={styles.headerTitle}>{title}</Text>
    </View>
  );
}
