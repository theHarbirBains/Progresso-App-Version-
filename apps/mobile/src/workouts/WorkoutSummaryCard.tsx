import { Text, TouchableOpacity, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';
import { WorkoutTimer } from './WorkoutTimer';

interface Props {
  workoutName: string;
  /** Already joined by the caller (e.g. "Chest, Shoulders, Triceps"), or ''
   * when nothing has been added yet. */
  muscleGroupsLabel: string;
  /** Omitted when there's no split day to switch between. */
  onChangeDay?: () => void;
  /** Null before the workout has actually started -- Duration just shows a
   * static 00:00 rather than ticking against a start time that doesn't exist. */
  performedAt: string | null;
  active: boolean;
  totalSets: number;
  totalVolumeDisplay: string;
  accentColor: string;
  testID?: string;
}

export function WorkoutSummaryCard({
  workoutName,
  muscleGroupsLabel,
  onChangeDay,
  performedAt,
  active,
  totalSets,
  totalVolumeDisplay,
  accentColor,
  testID,
}: Props) {
  return (
    <AppCard hero testID={testID}>
      <View style={styles.summaryTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryName}>{workoutName}</Text>
          {muscleGroupsLabel ? (
            <Text style={styles.summaryMuscles}>{muscleGroupsLabel}</Text>
          ) : null}
        </View>
        {onChangeDay ? (
          <TouchableOpacity testID="workout-summary-change" onPress={onChangeDay}>
            <Text style={[styles.summaryChangeLink, { color: accentColor }]}>Change</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.summaryStatsRow}>
        <View style={styles.summaryStat}>
          {performedAt ? (
            <WorkoutTimer
              testID="workout-summary-duration"
              performedAt={performedAt}
              active={active}
              style={styles.summaryStatValue}
            />
          ) : (
            <Text testID="workout-summary-duration" style={styles.summaryStatValue}>
              00:00
            </Text>
          )}
          <Text style={styles.summaryStatLabel}>Duration</Text>
        </View>
        <View style={styles.summaryStat}>
          <Text testID="workout-summary-total-sets" style={styles.summaryStatValue}>
            {totalSets}
          </Text>
          <Text style={styles.summaryStatLabel}>Total Sets</Text>
        </View>
        <View style={styles.summaryStat}>
          <Text testID="workout-summary-total-volume" style={styles.summaryStatValue}>
            {totalVolumeDisplay}
          </Text>
          <Text style={styles.summaryStatLabel}>Total Volume</Text>
        </View>
      </View>
    </AppCard>
  );
}
