import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { TextButton } from '../design/Button';
import { ListRow } from '../design/ListRow';
import { SectionHeader } from '../design/SectionHeader';
import { Text } from '../design/Text';
import { colors, radii, spacing, typeScale } from '../design/theme';
import { MUSCLE_GROUP_LABELS } from '../exercises/muscleGroups';
import { withAlpha } from '../theme/accentColor';
import type { PlannedExercise } from './splitPlanQueries';
import type { WorkoutExerciseWithSets } from './workoutQueries';

// The guided workout's own pieces (guidedWorkout.ts): the exercises not being done, folded to a
// slim row each, and the Up Next card.

const setsText = (n: number) => `${n} ${n === 1 ? 'set' : 'sets'}`;

/** The exercises not being done right now, a slim row each; tapping one opens it again. */
export function FoldedExercises({
  exercises,
  onOpen,
  testID,
}: {
  exercises: WorkoutExerciseWithSets[];
  onOpen: (exerciseId: string) => void;
  testID: string;
}) {
  if (exercises.length === 0) return null;
  return (
    <AppCard testID={testID}>
      {exercises.map((exercise, index) => {
        const done = new Set(
          exercise.sets.filter((set) => set.completedAt !== null).map((set) => set.setIndex),
        ).size;
        return (
          <ListRow
            key={exercise.id}
            testID={`${testID}-${exercise.id}`}
            divider={index > 0}
            title={exercise.exerciseName}
            subtitle={done > 0 ? `${setsText(done)} done` : 'Not started'}
            chevron
            onPress={() => onOpen(exercise.id)}
            accessibilityLabel={`${exercise.exerciseName}, ${done > 0 ? `${setsText(done)} done` : 'not started'}, open`}
          />
        );
      })}
    </AppCard>
  );
}

/**
 * What's next in the plan: its next exercise and its sets, started with one tap -- or, from
 * "Choose another", any other exercise still to do in the plan.
 */
export function UpNextCard({
  remaining,
  onStart,
  busy = false,
  accentColor,
  testID,
}: {
  remaining: PlannedExercise[];
  onStart: (planned: PlannedExercise) => void;
  busy?: boolean;
  accentColor: string;
  testID: string;
}) {
  const [choosing, setChoosing] = useState(false);
  const [next, ...others] = remaining;
  if (!next) return null;
  return (
    <AppCard testID={testID}>
      <SectionHeader label="Up Next" />
      <TouchableOpacity
        testID={`${testID}-start`}
        onPress={() => onStart(next)}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`Start ${next.exerciseName}, ${setsText(next.targetSets)} planned`}
        style={styles.next}
      >
        <View style={styles.nextText}>
          <Text testID={`${testID}-name`} style={styles.nextName} numberOfLines={2}>
            {next.exerciseName}
          </Text>
          <Text style={styles.nextLine}>
            {`${setsText(next.targetSets)} planned · ${MUSCLE_GROUP_LABELS[next.muscleGroup]}`}
          </Text>
        </View>
        <View
          style={[
            styles.startPill,
            {
              backgroundColor: withAlpha(accentColor, 0.16),
              borderColor: withAlpha(accentColor, 0.5),
            },
          ]}
        >
          <Text style={[styles.startText, { color: accentColor }]}>
            {busy ? 'Starting…' : 'Start'}
          </Text>
        </View>
      </TouchableOpacity>
      {others.length > 0 ? (
        <>
          <TextButton
            testID={`${testID}-choose`}
            label={choosing ? 'Hide the rest of the plan' : 'Choose another'}
            onPress={() => setChoosing((open) => !open)}
          />
          {choosing
            ? others.map((planned, index) => (
                <ListRow
                  key={planned.id}
                  testID={`${testID}-other-${planned.id}`}
                  divider={index > 0}
                  title={planned.exerciseName}
                  subtitle={`${setsText(planned.targetSets)} planned`}
                  chevron
                  disabled={busy}
                  onPress={() => {
                    setChoosing(false);
                    onStart(planned);
                  }}
                />
              ))
            : null}
        </>
      ) : null}
    </AppCard>
  );
}

/** Everything in the plan is started: more from Add Exercise, or finish. */
export function PlanDone({ testID }: { testID: string }) {
  return (
    <Text testID={testID} style={styles.planDone}>
      {"That's everything in today's plan. Add an exercise, or finish when you're ready."}
    </Text>
  );
}

const styles = StyleSheet.create({
  planDone: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  nextText: {
    flex: 1,
    gap: 2,
  },
  nextName: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  nextLine: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  startPill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  startText: {
    ...typeScale.label,
  },
});
