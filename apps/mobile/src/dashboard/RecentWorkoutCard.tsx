import { View } from 'react-native';
import { Text } from '../design/Text';
import { AppCard } from '../design/AppCard';
import { Badge } from '../design/Badge';
import { fromKg, roundWeight } from '../lib/units';
import { dashboardStyles as styles } from '../screens/dashboardStyles';
import { formatWorkoutDate } from './formatWorkoutDate';
import type { RecentWorkoutInfo } from './recentWorkoutInfo';

interface Props {
  info: RecentWorkoutInfo;
  weightUnit: 'kg' | 'lb';
  accentColor: string;
  accentBg: string;
  onPress: () => void;
}

// Presentational only: every value comes from fetchRecentWorkoutInfo (the
// user's most recent completed workout, its real duration/muscles/top set,
// and a PR label only when that set is CURRENTLY the record). Nothing here
// is derived or estimated -- a missing duration or top set simply isn't
// rendered rather than shown as a placeholder.
export function RecentWorkoutCard({ info, weightUnit, accentColor, accentBg, onPress }: Props) {
  const { workout, durationMinutes, musclesTrained, topSet, topExerciseName, prLabel } = info;

  const date = formatWorkoutDate(workout.performedAt);
  const meta = [durationMinutes !== null ? `${durationMinutes} min` : null, musclesTrained || null]
    .filter((part): part is string => part !== null)
    .join(' · ');
  // A logged top set always has both, but SetRecord types them as nullable
  // (a set is created blank before it's filled in), so guard rather than
  // ever rendering "null kg".
  const topSetText =
    topSet && topSet.weightKg !== null && topSet.reps !== null && topExerciseName
      ? `${topExerciseName} · ${roundWeight(fromKg(topSet.weightKg, weightUnit))}${weightUnit} × ${topSet.reps}`
      : null;

  return (
    <AppCard
      testID="dashboard-recent-workout"
      style={styles.recentWorkoutCard}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Recent workout, ${workout.name}, ${date}. Open workout details`}
    >
      <View style={styles.recentWorkoutHeaderRow}>
        <Text style={styles.nextWorkoutEyebrow}>Recent Workout</Text>
        <Text style={styles.recentWorkoutDate}>{date}</Text>
      </View>
      <Text testID="dashboard-recent-workout-name" style={styles.recentWorkoutName}>
        {workout.name}
      </Text>
      {meta ? (
        <Text testID="dashboard-recent-workout-meta" style={styles.recentWorkoutMeta}>
          {meta}
        </Text>
      ) : null}
      {topSetText ? (
        <View style={styles.recentWorkoutTopSetRow}>
          <Text
            testID="dashboard-recent-workout-top-set"
            style={styles.recentWorkoutTopSetText}
            numberOfLines={1}
          >
            {topSetText}
          </Text>
          {prLabel ? (
            <Badge
              testID="dashboard-recent-workout-pr"
              label={prLabel}
              color={accentColor}
              backgroundColor={accentBg}
            />
          ) : null}
        </View>
      ) : null}
    </AppCard>
  );
}
