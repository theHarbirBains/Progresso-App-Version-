import { View } from 'react-native';
import { Text } from '../design/Text';
import type { MeasurementType } from '../exercises/movementTypes';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';

// The set columns' headings, by what the exercise measures -- the same two columns
// SetValueFields fills (a timed set's one time field spans both).
const COLUMN_LABELS: Record<MeasurementType, string[]> = {
  weight_reps: ['Weight', 'Reps'],
  bodyweight: ['', 'Reps'],
  timed: ['Time'],
};

/** What a unilateral exercise's per-side note says, by what it measures. */
export const PER_SIDE_NOTE: Record<MeasurementType, string> = {
  weight_reps: 'Weight is per side',
  bodyweight: 'Reps are per side',
  timed: 'Time is per side',
};

/** The heading row above an exercise's sets: Set, then its value columns. */
export function SetColumnHeader({
  measurementType = 'weight_reps',
}: {
  measurementType?: MeasurementType;
}) {
  const columns = COLUMN_LABELS[measurementType];
  return (
    <View style={styles.setHeaderRow}>
      <Text style={styles.setHeaderIndex}>Set</Text>
      {columns.map((column, index) => (
        <Text
          key={`${index}-${column}`}
          style={[styles.setHeaderInput, columns.length === 1 && styles.setInputWide]}
        >
          {column}
        </Text>
      ))}
      <View style={styles.setHeaderComplete} />
    </View>
  );
}
