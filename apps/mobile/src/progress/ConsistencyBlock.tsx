import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { StatBlock } from '../design/StatBlock';
import { Text } from '../design/Text';
import { widgetGap } from '../design/theme';
import { progressStyles as styles } from './progressStyles';
import { computeWeeklyWorkoutCounts } from './trainingOverTime';

const WEEKS = 12;

interface Props {
  workouts: { performedAt: string }[];
  /** How many days a week the person means to train; null when not set. */
  weeklyGoal: number | null;
  accentColor: string;
  /** Opens Workout History, where the workouts behind the figures are. */
  onOpenHistory: () => void;
}

/**
 * Progress Overview's consistency: workouts per week over the last 12 weeks, from completed
 * workouts only, with how many of those weeks reached the weekly goal when one is set, then this
 * week's workouts and the weekly average as two figures (no line graph). A quiet week is a zero,
 * never skipped; the workouts behind it are in Workout History.
 */
export function ConsistencyBlock({ workouts, weeklyGoal, accentColor, onOpenHistory }: Props) {
  const points = computeWeeklyWorkoutCounts(workouts, WEEKS);
  const metGoal =
    weeklyGoal !== null ? points.filter((point) => point.value >= weeklyGoal).length : null;
  const thisWeek = points[points.length - 1]?.value ?? 0;
  const average =
    Math.round((points.reduce((sum, point) => sum + point.value, 0) / WEEKS) * 10) / 10;

  return (
    <View testID="progress-consistency" style={styles.overviewCard}>
      <View style={styles.overviewCardHeader}>
        <View style={styles.overviewCardTitleColumn}>
          <Text style={styles.overviewCardTitle}>Consistency</Text>
          <Text testID="progress-consistency-goal" style={styles.overviewCardSubtitle}>
            {metGoal !== null
              ? `${metGoal} of the last ${WEEKS} weeks reached your goal of ${weeklyGoal} a week`
              : `Workouts a week, the last ${WEEKS} weeks`}
          </Text>
        </View>
        <TouchableOpacity
          testID="progress-consistency-history"
          onPress={onOpenHistory}
          accessibilityRole="button"
          accessibilityLabel="See the workouts in Workout History"
        >
          <Text style={[styles.viewAllText, { color: accentColor }]}>Workouts</Text>
        </TouchableOpacity>
      </View>
      <View style={local.figures}>
        <StatBlock
          testID="progress-consistency-this-week"
          value={String(thisWeek)}
          label="This Week"
          valueColor={accentColor}
        />
        <StatBlock
          testID="progress-consistency-average"
          value={String(average)}
          label="Weekly Average"
        />
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  figures: {
    flexDirection: 'row',
    gap: widgetGap,
  },
});
