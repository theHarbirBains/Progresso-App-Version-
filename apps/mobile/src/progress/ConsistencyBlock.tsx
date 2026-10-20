import { TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { progressStyles as styles } from './progressStyles';
import { computeWeeklyWorkoutCounts } from './trainingOverTime';
import { WeeklyTrendChart } from './WeeklyTrendChart';

const WEEKS = 12;

interface Props {
  workouts: { performedAt: string }[];
  /** How many days a week the person means to train; null when not set. */
  weeklyGoal: number | null;
  accentColor: string;
  /** Opens Workout History, where the workouts behind the chart are. */
  onOpenHistory: () => void;
}

/**
 * Progress Overview's consistency: workouts per week over the last 12 weeks, from completed
 * workouts only, with how many of those weeks reached the weekly goal when one is set. A quiet
 * week is a zero, never skipped; the workouts behind it are in Workout History.
 */
export function ConsistencyBlock({ workouts, weeklyGoal, accentColor, onOpenHistory }: Props) {
  const points = computeWeeklyWorkoutCounts(workouts, WEEKS);
  const metGoal =
    weeklyGoal !== null ? points.filter((point) => point.value >= weeklyGoal).length : null;

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
      <WeeklyTrendChart
        testID="progress-consistency-chart"
        label="Workouts per week"
        points={points}
        accentColor={accentColor}
        formatTotal={(total) => `${total} ${total === 1 ? 'workout' : 'workouts'}`}
        emptyMessage="No workouts in the last 12 weeks."
      />
    </View>
  );
}
