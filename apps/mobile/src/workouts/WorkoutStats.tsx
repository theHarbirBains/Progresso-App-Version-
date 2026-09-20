import { View } from 'react-native';
import { Text } from '../design/Text';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';
import { WorkoutTimer } from './WorkoutTimer';

interface Props {
  /** Null before the workout has actually started -- Duration just shows a
   * static 00:00 rather than ticking against a start time that doesn't exist. */
  performedAt: string | null;
  active: boolean;
  totalSets: number;
  totalVolumeDisplay: string;
  testID?: string;
}

// The live workout's three running numbers -- duration, total sets, total
// volume -- as one quiet strip of mono readouts, neutral colour, no card.
// ActiveWorkoutScreen pins it under the header so all three stay in view while
// the exercise list scrolls.
export function WorkoutStats({
  performedAt,
  active,
  totalSets,
  totalVolumeDisplay,
  testID,
}: Props) {
  return (
    <View testID={testID} style={styles.statsBar}>
      <View style={styles.statCell}>
        {performedAt ? (
          <WorkoutTimer
            testID="workout-summary-duration"
            performedAt={performedAt}
            active={active}
            style={styles.statValue}
          />
        ) : (
          <Text testID="workout-summary-duration" style={styles.statValue}>
            00:00
          </Text>
        )}
        <Text style={styles.statLabel}>Duration</Text>
      </View>
      <View style={styles.statCell}>
        <Text testID="workout-summary-total-sets" style={styles.statValue}>
          {totalSets}
        </Text>
        <Text style={styles.statLabel}>Total Sets</Text>
      </View>
      <View style={styles.statCell}>
        <Text testID="workout-summary-total-volume" style={styles.statValue}>
          {totalVolumeDisplay}
        </Text>
        <Text style={styles.statLabel}>Total Volume</Text>
      </View>
    </View>
  );
}
