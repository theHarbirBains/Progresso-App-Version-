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
  previous = false,
}: {
  measurementType?: MeasurementType;
  /** The quieter heading over last session's sets, rather than the sets being logged. */
  previous?: boolean;
}) {
  const columns = COLUMN_LABELS[measurementType];
  const columnStyle = previous ? styles.previousColumnInput : styles.setHeaderInput;
  return (
    <View style={previous ? styles.previousColumnHeader : styles.setHeaderRow}>
      <Text style={previous ? styles.previousColumnIndex : styles.setHeaderIndex}>Set</Text>
      {columns.map((column, index) => (
        <Text
          key={`${index}-${column}`}
          style={[columnStyle, columns.length === 1 && styles.setInputWide]}
        >
          {column}
        </Text>
      ))}
      <View style={styles.setHeaderComplete} />
    </View>
  );
}
