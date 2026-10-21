import { StyleSheet, View } from 'react-native';
import { AutoCarousel } from '../design/AutoCarousel';
import { ExercisePhoto } from '../exercises/ExercisePhoto';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';
import type { WorkoutTopSet } from '../workouts/recentWorkoutTopSets';
import { formatSetValues } from '../workouts/setValues';

const PHOTO_SIZE = 56;

interface Props {
  topSets: WorkoutTopSet[];
  weightUnit: 'kg' | 'lb';
  testID?: string;
}

// A swipeable, self-advancing "Top Sets" strip for the most recent workout on
// Feed: one slide per exercise with a real top set (the shared AutoCarousel --
// paged by swipe, moving on by itself every few seconds, held still while the
// user is dragging or Feed isn't the page in view, not animated when Reduce
// Motion is on, with a quiet pagination indicator). Only the exercise name and
// its top-set readout are the visual focus. When an exercise has a machine
// photo it sits beside its readout, and tapping it opens the full-size picture
// (ExercisePhoto's zoom) -- the same for everyone's cards.
export function RecentWorkoutTopSets({ topSets, weightUnit, testID }: Props) {
  if (topSets.length === 0) {
    return (
      <View testID={testID} style={styles.wrap}>
        <Text style={styles.heading}>Top Sets</Text>
        <Text testID={testID ? `${testID}-empty` : undefined} style={styles.empty}>
          No top sets logged in this workout
        </Text>
      </View>
    );
  }

  return (
    <View testID={testID} style={styles.wrap}>
      <Text style={styles.heading}>Top Sets</Text>
      <AutoCarousel
        testID={testID}
        items={topSets}
        keyOf={(topSet) => topSet.exerciseId}
        renderSlide={(topSet) => (
          <View style={styles.slide}>
            {topSet.photoUrl ? (
              <ExercisePhoto
                testID={testID ? `${testID}-photo-${topSet.exerciseId}` : undefined}
                uri={topSet.photoUrl}
                name={topSet.exerciseName}
                size={PHOTO_SIZE}
              />
            ) : null}
            <View style={styles.slideText}>
              <Text style={styles.exerciseName} numberOfLines={1}>
                {topSet.exerciseName}
              </Text>
              <Text style={styles.topSetValue}>{formatSetValues(topSet, weightUnit)}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  heading: {
    ...typeScale.label,
    color: colors.textSecondary,
  },
  empty: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  slide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingRight: spacing.md,
  },
  slideText: {
    flex: 1,
    gap: spacing.xs,
  },
  exerciseName: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  topSetValue: {
    ...typeScale.statMedium,
    color: colors.textPrimary,
  },
});
