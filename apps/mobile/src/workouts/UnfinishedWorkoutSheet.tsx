import { StyleSheet, View } from 'react-native';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { BottomSheet } from '../design/BottomSheet';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';
import type { UnfinishedWorkoutAssessment } from './unfinishedWorkoutState';
import { formatCardDuration } from './workoutFormat';

interface Props {
  visible: boolean;
  workoutName: string;
  assessment: UnfinishedWorkoutAssessment;
  finishing: boolean;
  onFinish: () => void;
  onResume: () => void;
  onNotNow: () => void;
}

// The recovery prompt for a workout that has likely been finished but never
// tapped Finish on. Nothing here writes on its own: Finish is the only action
// that completes the workout, and it ends the workout at the last completed
// set rather than at the time of this tap. There is no Discard here -- that
// stays in the existing cancel flow, never in an automatic prompt.
export function UnfinishedWorkoutSheet({
  visible,
  workoutName,
  assessment,
  finishing,
  onFinish,
  onResume,
  onNotNow,
}: Props) {
  const canFinish = assessment.suggestedDurationMinutes !== null;

  return (
    <BottomSheet visible={visible} onClose={onNotNow} testID="unfinished-workout-sheet">
      <View style={styles.content}>
        <Text style={styles.title}>Did you finish this workout?</Text>
        <Text style={styles.name} numberOfLines={1}>
          {workoutName}
        </Text>
        <Text testID="unfinished-workout-summary" style={styles.summary}>
          {`${assessment.completedExerciseCount} exercises · ${assessment.completedSetCount} sets · ${formatCardDuration(assessment.suggestedDurationMinutes)}`}
        </Text>
        {assessment.plannedBlankSetCount > 0 ? (
          <Text testID="unfinished-workout-blank-note" style={styles.note}>
            {`${assessment.plannedBlankSetCount} unfilled ${assessment.plannedBlankSetCount === 1 ? 'set' : 'sets'} will be left out.`}
          </Text>
        ) : null}
        {canFinish ? (
          <Text style={styles.note}>
            Ends at your last logged set. You can adjust the duration afterwards.
          </Text>
        ) : null}

        <View style={styles.actions}>
          {canFinish ? (
            <PrimaryButton
              testID="unfinished-workout-finish"
              label="Finish Workout"
              loading={finishing}
              disabled={finishing}
              onPress={onFinish}
            />
          ) : null}
          <SecondaryButton
            testID="unfinished-workout-resume"
            label="Resume Workout"
            disabled={finishing}
            onPress={onResume}
          />
          <TextButton testID="unfinished-workout-not-now" label="Not now" onPress={onNotNow} />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  title: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  name: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  summary: {
    ...typeScale.statMedium,
    color: colors.textPrimary,
  },
  note: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
