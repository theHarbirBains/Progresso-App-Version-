import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { EmptyState } from '../design/EmptyState';
import { LoadingState } from '../design/LoadingState';
import { Text } from '../design/Text';
import { UnderlineTabs } from '../design/UnderlineTabs';
import { colors, spacing, typeScale } from '../design/theme';
import type { ExerciseRow } from '../exercises/exerciseQueries';
import { formatWeightKg, roundWeight, toKg } from '../lib/units';
import { useProgressTheme } from '../progress/useProgressTheme';
import { AddExerciseButton } from './AddExerciseButton';
import { ExerciseCard, type PreviousSessionDisplay } from './ExerciseCard';
import { ExercisePickerModal } from './ExercisePickerModal';
import {
  buildPreviousSessionDisplay,
  computeUnilateralSets,
  isValidDraft,
  type SetInputDraft,
} from './setInputDrafts';
import {
  addExerciseToWorkout,
  createSet,
  fetchPreviousPerformance,
  fetchWorkoutDetail,
  removeExerciseFromWorkout,
  updateSet,
  type SetRecord,
  type WorkoutDetail,
  type WorkoutExerciseWithSets,
} from './workoutQueries';

/** One person in the group and the workout that is theirs. */
export interface GroupWorkoutMember {
  userId: string;
  displayName: string | null;
  workoutId: string;
}

interface Props {
  members: GroupWorkoutMember[];
  /** The signed-in person: their tab reads "You", and their exercise library is the picker's. */
  userId: string;
  accentColor: string;
  onAccentColor: string;
  testID?: string;
}

/**
 * A group's live workout, laid out like the regular Active Workout. A tab per person
 * across the top; the exercises are the group's, so adding or removing one changes
 * every person's workout. Only the sets differ: the tab shows that person's own sets,
 * with the weight lifted and reps done, and anyone in the group can enter them.
 */
export function GroupWorkoutEditor({
  members,
  userId,
  accentColor,
  onAccentColor,
  testID = 'group-workout',
}: Props) {
  const { weightUnit } = useProgressTheme();
  const [details, setDetails] = useState<Record<string, WorkoutDetail>>({});
  const [selectedId, setSelectedId] = useState(userId);
  const [setInputs, setSetInputs] = useState<Record<string, SetInputDraft>>({});
  const [previous, setPrevious] = useState<
    Record<string, { performedAt: string; sets: SetRecord[] }>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const memberKey = members.map((m) => `${m.userId}:${m.workoutId}`).join('|');

  /** Loads one person's workout and seeds their set inputs without overwriting open drafts. */
  const loadMember = useCallback(
    async (member: GroupWorkoutMember) => {
      const detail = await fetchWorkoutDetail(member.workoutId);
      setDetails((prev) => ({ ...prev, [member.userId]: detail }));
      setSetInputs((prev) => {
        const next = { ...prev };
        for (const exercise of detail.exercises) {
          for (const set of exercise.sets) {
            if (set.completedAt !== null || next[set.id] === undefined) {
              next[set.id] = {
                weight: set.weightKg !== null ? formatWeightKg(set.weightKg, weightUnit) : '',
                reps: set.reps !== null ? String(set.reps) : '',
              };
            }
          }
        }
        return next;
      });
      return detail;
    },
    [weightUnit],
  );

  /**
   * Loads everyone, then makes sure each person has every exercise the group has. An
   * exercise someone is missing (added before they joined) is added to their workout.
   */
  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const loaded = await Promise.all(members.map((m) => loadMember(m)));
      const byExercise = new Map<string, WorkoutExerciseWithSets>();
      loaded.forEach((detail) => {
        for (const exercise of detail.exercises) {
          if (!byExercise.has(exercise.exerciseId)) byExercise.set(exercise.exerciseId, exercise);
        }
      });
      let added = false;
      for (let i = 0; i < members.length; i += 1) {
        const have = new Set(loaded[i].exercises.map((ex) => ex.exerciseId));
        for (const [exerciseId, shape] of byExercise) {
          if (have.has(exerciseId)) continue;
          await addToWorkout(members[i].workoutId, exerciseId, shape.movementType, loaded[i]);
          added = true;
        }
      }
      if (added) await Promise.all(members.map((m) => loadMember(m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the group workout');
    } finally {
      setLoading(false);
    }
    // members is tracked through memberKey so a new member loads without a re-render loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberKey, loadMember]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // One exercise into one workout: the next order, then its first set (both sides if unilateral).
  async function addToWorkout(
    workoutId: string,
    exerciseId: string,
    movementType: WorkoutExerciseWithSets['movementType'],
    detail: WorkoutDetail,
  ) {
    const order = detail.exercises.reduce((max, ex) => Math.max(max, ex.orderIndex), 0) + 1;
    const workoutExerciseId = await addExerciseToWorkout(workoutId, exerciseId, order);
    if (movementType === 'unilateral') {
      await createSet(workoutExerciseId, 1, 'left');
      await createSet(workoutExerciseId, 1, 'right');
    } else {
      await createSet(workoutExerciseId, 1);
    }
  }

  /** Runs one change, then reloads so each row shows what is saved. */
  async function change(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await Promise.all(members.map((m) => loadMember(m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That change did not save');
    }
  }

  // The group's exercises, in the order the first person has them, one entry per exercise.
  const exercises = useMemo(() => {
    const seen = new Map<string, WorkoutExerciseWithSets>();
    for (const member of members) {
      const detail = details[member.userId];
      if (!detail) continue;
      for (const exercise of [...detail.exercises].sort((a, b) => a.orderIndex - b.orderIndex)) {
        if (!seen.has(exercise.exerciseId)) seen.set(exercise.exerciseId, exercise);
      }
    }
    return Array.from(seen.values());
  }, [members, details]);

  const selected = members.find((m) => m.userId === selectedId) ?? members[0];
  const selectedDetail = selected ? details[selected.userId] : undefined;
  // Primitives for the previous-session effect, so it reruns only when the tab or its exercises change.
  const selectedMember = selected;
  const selectedExerciseIds = selectedDetail
    ? selectedDetail.exercises.map((ex) => ex.exerciseId).join(',')
    : '';

  /** The selected person's row for one of the group's exercises. */
  function rowFor(exerciseId: string): WorkoutExerciseWithSets | undefined {
    return selectedDetail?.exercises.find((ex) => ex.exerciseId === exerciseId);
  }

  // Last completed session for each exercise, for the person whose tab is open.
  useEffect(() => {
    if (!selectedMember || selectedExerciseIds === '') return;
    let cancelled = false;
    const member = selectedMember;
    const exerciseIds = selectedExerciseIds.split(',');
    void (async () => {
      const entries = await Promise.all(
        exerciseIds.map(async (exerciseId) => {
          const key = `${member.userId}:${exerciseId}`;
          try {
            const result = await fetchPreviousPerformance(
              member.userId,
              exerciseId,
              member.workoutId,
            );
            return [key, result] as const;
          } catch {
            return [key, null] as const;
          }
        }),
      );
      if (cancelled) return;
      setPrevious((prev) => {
        const next = { ...prev };
        for (const [key, result] of entries) {
          if (result && result.sets.length > 0) next[key] = result;
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedMember, selectedExerciseIds]);

  async function addExercise(exercise: ExerciseRow) {
    setPickerOpen(false);
    await change(async () => {
      for (const member of members) {
        const detail = details[member.userId];
        if (!detail) continue;
        await addToWorkout(member.workoutId, exercise.id, exercise.movementType, detail);
      }
    });
  }

  async function removeExercise(exerciseId: string) {
    await change(async () => {
      for (const member of members) {
        const row = details[member.userId]?.exercises.find((ex) => ex.exerciseId === exerciseId);
        if (row) await removeExerciseFromWorkout(row.id);
      }
    });
  }

  async function addSet(exercise: WorkoutExerciseWithSets) {
    if (!selected) return;
    const nextIndex = exercise.sets.reduce((max, s) => Math.max(max, s.setIndex), 0) + 1;
    await change(async () => {
      if (exercise.movementType === 'unilateral') {
        await createSet(exercise.id, nextIndex, 'left');
        await createSet(exercise.id, nextIndex, 'right');
      } else {
        await createSet(exercise.id, nextIndex);
      }
    });
  }

  /** Completes or reopens one set of the selected person. */
  async function toggleSet(set: SetRecord) {
    if (set.completedAt) {
      await change(() => updateSet(set.id, { completedAt: null }));
      return;
    }
    const draft = setInputs[set.id];
    if (!isValidDraft(draft)) {
      setError('Enter a valid weight (whole number or .5) and rep count');
      return;
    }
    await change(() =>
      updateSet(set.id, {
        weightKg: roundWeight(toKg(Number(draft.weight), weightUnit)),
        reps: Math.trunc(Number(draft.reps)),
        completedAt: new Date().toISOString(),
      }),
    );
  }

  /** Completes or reopens both sides of one unilateral set, as one unit. */
  async function toggleUnilateral(exercise: WorkoutExerciseWithSets, setIndex: number) {
    const left = exercise.sets.find((s) => s.setIndex === setIndex && s.side === 'left');
    const right = exercise.sets.find((s) => s.setIndex === setIndex && s.side === 'right');
    if (!left || !right) return;
    const reopening = left.completedAt !== null || right.completedAt !== null;
    if (!reopening && (!isValidDraft(setInputs[left.id]) || !isValidDraft(setInputs[right.id]))) {
      setError('Enter a valid weight (whole number or .5) and rep count for both sides');
      return;
    }
    await change(async () => {
      for (const set of [left, right]) {
        if (reopening) {
          await updateSet(set.id, { completedAt: null });
        } else {
          const draft = setInputs[set.id];
          await updateSet(set.id, {
            weightKg: roundWeight(toKg(Number(draft.weight), weightUnit)),
            reps: Math.trunc(Number(draft.reps)),
            completedAt: new Date().toISOString(),
          });
        }
      }
    });
  }

  function confirmRemove(exercise: WorkoutExerciseWithSets) {
    Alert.alert(
      'Remove exercise',
      `Remove ${exercise.exerciseName} from everyone’s workout? Their logged sets for it are removed too.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => void removeExercise(exercise.exerciseId),
        },
      ],
    );
  }

  if (loading) return <LoadingState testID={`${testID}-loading`} />;
  if (members.length === 0) return null;

  const tabs = members.map((m) => ({
    key: m.userId,
    label: m.userId === userId ? 'You' : firstName(m.displayName),
    icon: 'user' as const,
  }));

  return (
    <View testID={testID} style={styles.root}>
      <UnderlineTabs
        categories={tabs}
        active={selected?.userId ?? userId}
        onSelect={setSelectedId}
        accentColor={accentColor}
        testID={`${testID}-tabs`}
      />

      {error ? (
        <Text testID={`${testID}-error`} style={styles.error}>
          {error}
        </Text>
      ) : null}

      {exercises.length === 0 ? (
        <EmptyState testID={`${testID}-empty`} title="Add your first exercise to get started." />
      ) : null}

      {exercises.map((shape) => {
        const row = rowFor(shape.exerciseId);
        if (!row) return null;
        const prior = selected ? previous[`${selected.userId}:${row.exerciseId}`] : undefined;
        const previousSession: PreviousSessionDisplay | null = buildPreviousSessionDisplay(
          prior,
          weightUnit,
        );
        return (
          <ExerciseCard
            key={row.exerciseId}
            testID={`${testID}-exercise-${row.exerciseId}`}
            exerciseName={row.exerciseName}
            muscleGroup={row.muscleGroup}
            movementType={row.movementType}
            previousSession={previousSession}
            sets={
              row.movementType === 'unilateral'
                ? []
                : row.sets.map((set) => ({
                    id: set.id,
                    setIndex: set.setIndex,
                    weight: setInputs[set.id]?.weight ?? '',
                    reps: setInputs[set.id]?.reps ?? '',
                    completed: set.completedAt !== null,
                    canComplete: isValidDraft(setInputs[set.id]),
                  }))
            }
            unilateralSets={
              row.movementType === 'unilateral' ? computeUnilateralSets(row.sets, setInputs) : []
            }
            onChangeWeight={(setId, text) =>
              setSetInputs((prev) => ({
                ...prev,
                [setId]: { weight: text, reps: prev[setId]?.reps ?? '' },
              }))
            }
            onChangeReps={(setId, text) =>
              setSetInputs((prev) => ({
                ...prev,
                [setId]: { weight: prev[setId]?.weight ?? '', reps: text },
              }))
            }
            onToggleComplete={(setId) => {
              const set = row.sets.find((s) => s.id === setId);
              if (!set) return;
              if (row.movementType === 'unilateral') void toggleUnilateral(row, set.setIndex);
              else void toggleSet(set);
            }}
            onAddSet={() => void addSet(row)}
            onRemoveExercise={() => confirmRemove(row)}
            divider
            accentColor={accentColor}
            onAccentColor={onAccentColor}
          />
        );
      })}

      <AddExerciseButton testID={`${testID}-add-exercise`} onPress={() => setPickerOpen(true)} />

      <ExercisePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(exercise) => void addExercise(exercise)}
        userId={userId}
        alreadyAddedIds={exercises.map((ex) => ex.exerciseId)}
        onCreateCustom={() => setPickerOpen(false)}
        accentColor={accentColor}
        onAccentColor={onAccentColor}
      />
    </View>
  );
}

function firstName(name: string | null): string {
  return name?.trim().split(/\s+/)[0] || 'Member';
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.md,
  },
  error: {
    ...typeScale.secondary,
    color: colors.destructive,
  },
});
