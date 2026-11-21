import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TextButton } from '../design/Button';
import { ListRow } from '../design/ListRow';
import { SectionHeader } from '../design/SectionHeader';
import { SkeletonRows } from '../design/Skeleton';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';
import { ExercisePhoto } from '../exercises/ExercisePhoto';
import type { ExerciseRow } from '../exercises/exerciseQueries';
import { machineLine } from '../exercises/machineDetails';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import { formatRecentDate } from './workoutFormat';
import { planPreviousExercises, type PreviousExercise } from './previousExercises';
import { formatSetValues } from './setValues';
import type { PreviousExercisesState } from './usePreviousExercises';

interface Props {
  previous: PreviousExercisesState;
  /** The muscle groups of the exercises already in the workout, in the order they were added. */
  addedGroups: MuscleGroup[];
  /** The exercises the picker can add, by id: a previous exercise shows only as one of these. */
  library: Map<string, ExerciseRow>;
  alreadyAddedIds: Set<string>;
  weightUnit: 'kg' | 'lb';
  onSelect: (exercise: ExerciseRow) => void;
  testID?: string;
}

/** "3 sets · Top set 80 kg × 8" -- "Best 12 reps", "Best 1:30" -- and who logged it. */
function performanceLine(previous: PreviousExercise, unit: 'kg' | 'lb'): string {
  const parts = [`${previous.setCount} ${previous.setCount === 1 ? 'set' : 'sets'}`];
  if (previous.best) {
    const values = formatSetValues(
      { ...previous.best, measurementType: previous.measurementType },
      unit,
    );
    parts.push(previous.measurementType === 'weight_reps' ? `Top set ${values}` : `Best ${values}`);
  }
  if (previous.byTrainer) parts.push('Logged by your trainer');
  return parts.join(' · ');
}

/**
 * The top of a live workout's Add Exercise: what the person did the last time they trained each
 * muscle group (previousExercises.ts) -- the split day's muscle groups, or every one they've
 * trained -- each exercise the very one they did, a tap from being added.
 */
export function PreviousExercisesSection({
  previous,
  addedGroups,
  library,
  alreadyAddedIds,
  weightUnit,
  onSelect,
  testID = 'previous-exercises',
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const plan = useMemo(
    () => planPreviousExercises(previous.groups, { dayGroups: previous.dayGroups, addedGroups }),
    [previous.groups, previous.dayGroups, addedGroups],
  );
  const shown = expanded ? plan.sections : plan.sections.slice(0, plan.initialCount);
  const hidden = plan.sections.length - shown.length;

  return (
    <View testID={testID} style={styles.wrap}>
      <SectionHeader testID={`${testID}-title`} label={plan.title} />
      {previous.status === 'loading' ? (
        <SkeletonRows testID={`${testID}-loading`} count={3} />
      ) : previous.status === 'error' ? (
        <View testID={`${testID}-error`} style={styles.errorRow}>
          <Text style={styles.muted}>Couldn’t load your previous exercises.</Text>
          <TextButton testID={`${testID}-retry`} label="Try Again" onPress={previous.retry} />
        </View>
      ) : plan.sections.length === 0 ? (
        <Text testID={`${testID}-first`} style={styles.muted}>
          Finish a workout and what you did for each muscle group shows here, so you can pick up
          where you left off.
        </Text>
      ) : (
        <>
          {shown.map((section) => {
            const label = MUSCLE_GROUP_LABELS[section.muscleGroup];
            const available = section.exercises.flatMap((done) => {
              const exercise = library.get(done.exerciseId);
              return exercise ? [{ done, exercise }] : [];
            });
            const groupID = `${testID}-group-${section.muscleGroup}`;
            return (
              <View key={section.muscleGroup} testID={groupID} style={styles.group}>
                <View style={styles.groupHeading}>
                  <Text style={styles.groupName}>{label}</Text>
                  {section.lastTrainedAt ? (
                    <Text testID={`${groupID}-date`} style={styles.groupDate}>
                      Last trained {formatRecentDate(section.lastTrainedAt)}
                    </Text>
                  ) : null}
                </View>
                {section.exercises.length === 0 ? (
                  <Text testID={`${groupID}-empty`} style={styles.muted}>
                    No {label} exercises logged yet.
                  </Text>
                ) : available.length === 0 ? (
                  <Text testID={`${groupID}-gone`} style={styles.muted}>
                    Those exercises are no longer in your library.
                  </Text>
                ) : (
                  available.map(({ done, exercise }, index) => {
                    const added = alreadyAddedIds.has(exercise.id);
                    const subtitle =
                      machineLine(exercise, MUSCLE_GROUP_LABELS[exercise.muscleGroup]) ?? undefined;
                    const detail = performanceLine(done, weightUnit);
                    const title = added ? `${exercise.name} (added)` : exercise.name;
                    return (
                      <ListRow
                        key={exercise.id}
                        testID={`${groupID}-${exercise.id}`}
                        divider={index > 0}
                        leading={
                          <ExercisePhoto
                            uri={exercise.photoUrl}
                            name={exercise.name}
                            size={40}
                            exerciseId={exercise.createdBy === null ? exercise.id : undefined}
                            slug={exercise.slug}
                          />
                        }
                        title={title}
                        subtitle={subtitle}
                        detail={detail}
                        disabled={added}
                        chevron={false}
                        onPress={() => onSelect(exercise)}
                        accessibilityLabel={[
                          title,
                          subtitle,
                          detail,
                          `last done ${formatRecentDate(done.performedAt)}`,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      />
                    );
                  })
                )}
              </View>
            );
          })}
          {plan.sections.length > plan.initialCount ? (
            <TextButton
              testID={`${testID}-more`}
              label={expanded ? 'Show Less' : `Show More (${hidden})`}
              accessibilityLabel={
                expanded ? 'Show fewer muscle groups' : `Show ${hidden} more muscle groups`
              }
              onPress={() => setExpanded((open) => !open)}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  group: {
    marginBottom: spacing.sm,
  },
  groupHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  groupName: {
    ...typeScale.label,
    color: colors.textSecondary,
  },
  groupDate: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  muted: {
    ...typeScale.secondary,
    color: colors.textMuted,
    paddingVertical: spacing.xs,
  },
  errorRow: {
    gap: spacing.xs,
    alignItems: 'flex-start',
  },
});
