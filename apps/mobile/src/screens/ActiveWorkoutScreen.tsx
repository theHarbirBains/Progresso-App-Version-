import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import { fromKg, roundWeight, toKg } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import { fetchOneRepMax, fetchRepPRs, type OneRepMax, type RepPR } from '../workouts/prQueries';
import { compareToPrevious } from '../workouts/progressiveOverload';
import {
  completeWorkout,
  createSet,
  deleteSet,
  fetchPreviousPerformance,
  fetchWorkoutDetail,
  updateSet,
  type SetRecord,
  type WorkoutDetail,
} from '../workouts/workoutQueries';
import { workoutStyles as styles } from './workoutStyles';

type Props = RootStackScreenProps<'ActiveWorkout'>;

interface PreviousPerformance {
  performedAt: string;
  sets: SetRecord[];
}

function formatWeight(kg: number, unit: 'kg' | 'lb'): string {
  const value = roundWeight(fromKg(kg, unit));
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function ActiveWorkoutScreen({ route, navigation }: Props) {
  const { workoutId } = route.params;
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;

  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [previous, setPrevious] = useState<Record<string, PreviousPerformance | null>>({});
  const [repPRs, setRepPRs] = useState<Record<string, RepPR[]>>({});
  const [oneRepMaxes, setOneRepMaxes] = useState<Record<string, OneRepMax | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  const [newSetInputs, setNewSetInputs] = useState<
    Record<string, { weight: string; reps: string }>
  >({});
  const [editInputs, setEditInputs] = useState<Record<string, { weight: string; reps: string }>>(
    {},
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!userId || !accessToken) return;
      setLoading(true);
      setError(null);
      try {
        const [detail, profile] = await Promise.all([
          fetchWorkoutDetail(workoutId),
          getMyProfile(accessToken),
        ]);
        if (cancelled) return;

        setWorkout(detail);
        setWeightUnit(profile.weightUnit);

        const nextEditInputs: Record<string, { weight: string; reps: string }> = {};
        for (const exercise of detail.exercises) {
          for (const set of exercise.sets) {
            nextEditInputs[set.id] = {
              weight: formatWeight(set.weightKg, profile.weightUnit),
              reps: String(set.reps),
            };
          }
        }
        setEditInputs(nextEditInputs);

        const previousEntries = await Promise.all(
          detail.exercises.map(async (exercise) => {
            const prev = await fetchPreviousPerformance(userId, exercise.exerciseId, workoutId);
            return [exercise.id, prev] as const;
          }),
        );
        if (!cancelled) {
          setPrevious(Object.fromEntries(previousEntries));
        }

        const prEntries = await Promise.all(
          detail.exercises.map(async (exercise) => {
            const [prs, orm] = await Promise.all([
              fetchRepPRs(userId, exercise.exerciseId),
              fetchOneRepMax(userId, exercise.exerciseId),
            ]);
            return [exercise.id, prs, orm] as const;
          }),
        );
        if (!cancelled) {
          setRepPRs(Object.fromEntries(prEntries.map(([id, prs]) => [id, prs])));
          setOneRepMaxes(Object.fromEntries(prEntries.map(([id, , orm]) => [id, orm])));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load workout');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [workoutId, userId, accessToken]);

  /**
   * Re-reads the database's already-recomputed PR/1RM state for one
   * exercise after a set write. This is a read-back, never a calculation --
   * the trigger in supabase/migrations/20260823100008_pr_infrastructure.sql
   * has already run, synchronously, before the write that triggered this
   * call even returned.
   */
  async function refreshPRs(workoutExerciseId: string, exerciseId: string) {
    const [prs, orm] = await Promise.all([
      fetchRepPRs(userId, exerciseId),
      fetchOneRepMax(userId, exerciseId),
    ]);
    setRepPRs((prev) => ({ ...prev, [workoutExerciseId]: prs }));
    setOneRepMaxes((prev) => ({ ...prev, [workoutExerciseId]: orm }));
  }

  function updateExerciseSets(exerciseId: string, updater: (sets: SetRecord[]) => SetRecord[]) {
    setWorkout((prev) =>
      prev
        ? {
            ...prev,
            exercises: prev.exercises.map((ex) =>
              ex.id === exerciseId ? { ...ex, sets: updater(ex.sets) } : ex,
            ),
          }
        : prev,
    );
  }

  async function handleAddSet(exercise: WorkoutDetail['exercises'][number]) {
    const draft = newSetInputs[exercise.id];
    const weightNum = Number(draft?.weight);
    const repsNum = Number(draft?.reps);
    if (
      !draft ||
      !Number.isFinite(weightNum) ||
      weightNum <= 0 ||
      !Number.isInteger(repsNum) ||
      repsNum <= 0
    ) {
      setError('Enter a valid weight and rep count');
      return;
    }
    setError(null);
    try {
      const nextIndex = exercise.sets.reduce((max, s) => Math.max(max, s.setIndex), 0) + 1;
      const weightKg = roundWeight(toKg(weightNum, weightUnit));
      const created = await createSet(exercise.id, nextIndex, weightKg, repsNum);
      updateExerciseSets(exercise.id, (sets) => [...sets, created]);
      setEditInputs((prev) => ({
        ...prev,
        [created.id]: {
          weight: formatWeight(created.weightKg, weightUnit),
          reps: String(created.reps),
        },
      }));
      setNewSetInputs((prev) => ({ ...prev, [exercise.id]: { weight: '', reps: '' } }));
      await refreshPRs(exercise.id, exercise.exerciseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add set');
    }
  }

  async function handleUpdateSet(exercise: WorkoutDetail['exercises'][number], set: SetRecord) {
    const draft = editInputs[set.id];
    const weightNum = Number(draft?.weight);
    const repsNum = Number(draft?.reps);
    if (
      !draft ||
      !Number.isFinite(weightNum) ||
      weightNum <= 0 ||
      !Number.isInteger(repsNum) ||
      repsNum <= 0
    ) {
      return;
    }
    const weightKg = roundWeight(toKg(weightNum, weightUnit));
    if (weightKg === set.weightKg && repsNum === set.reps) return;
    try {
      const updated = await updateSet(set.id, { weightKg, reps: repsNum });
      updateExerciseSets(exercise.id, (sets) => sets.map((s) => (s.id === set.id ? updated : s)));
      await refreshPRs(exercise.id, exercise.exerciseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update set');
    }
  }

  async function handleDeleteSet(exerciseId: string, setId: string) {
    try {
      await deleteSet(setId);
      updateExerciseSets(exerciseId, (sets) => sets.filter((s) => s.id !== setId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete set');
    }
  }

  async function handleComplete() {
    if (!workout) return;
    setError(null);
    setCompleting(true);
    try {
      await completeWorkout(workout.id);
      navigation.reset({ index: 0, routes: [{ name: 'WorkoutHistory' }] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete workout');
      setCompleting(false);
    }
  }

  if (loading || !workout) {
    return (
      <View style={styles.container}>
        {error ? (
          <Text testID="active-workout-error" style={styles.error}>
            {error}
          </Text>
        ) : (
          <ActivityIndicator testID="active-workout-loading" size="large" color="#FFFFFF" />
        )}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{workout.name}</Text>
        <TouchableOpacity testID="active-workout-back" onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>Back</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <Text testID="active-workout-inline-error" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {workout.exercises.map((exercise) => {
        const topSet = exercise.sets.reduce<SetRecord | null>(
          (max, s) => (!max || s.weightKg > max.weightKg ? s : max),
          null,
        );
        const prev = previous[exercise.id];
        const draft = newSetInputs[exercise.id] ?? { weight: '', reps: '' };
        const insight = prev
          ? compareToPrevious(
              exercise.sets,
              prev.sets,
              (kg) => `${formatWeight(kg, weightUnit)}${weightUnit}`,
            )
          : null;

        return (
          <View key={exercise.id} testID={`exercise-card-${exercise.id}`} style={styles.card}>
            <TouchableOpacity
              testID={`exercise-title-${exercise.id}`}
              onPress={() =>
                navigation.navigate('PRHistory', {
                  exerciseId: exercise.exerciseId,
                  exerciseName: exercise.exerciseName,
                })
              }
            >
              <Text style={styles.cardTitle}>{exercise.exerciseName}</Text>
            </TouchableOpacity>

            <Text style={styles.cardMeta}>
              {prev
                ? `Last time: ${prev.sets.map((s) => `${formatWeight(s.weightKg, weightUnit)}${weightUnit}×${s.reps}`).join(', ')}`
                : 'No previous performance recorded'}
            </Text>

            {insight ? (
              <Text testID={`insight-${exercise.id}`} style={styles.cardMeta}>
                {insight.message}
              </Text>
            ) : null}

            {topSet ? (
              <Text testID={`top-set-${exercise.id}`} style={styles.cardMetaHighlight}>
                Top set: {formatWeight(topSet.weightKg, weightUnit)}
                {weightUnit}
                {'×'}
                {topSet.reps}
              </Text>
            ) : null}

            {exercise.sets.map((set) => {
              const isNewRepPR =
                set.reps >= 2 &&
                repPRs[exercise.id]?.some(
                  (pr) => pr.reps === set.reps && pr.sourceSetId === set.id,
                );
              const isNewOneRepMax =
                set.reps === 1 && oneRepMaxes[exercise.id]?.sourceSetId === set.id;

              return (
                <View key={set.id} testID={`set-row-${set.id}`} style={styles.setRow}>
                  <Text style={styles.setIndexText}>{set.setIndex}</Text>
                  {isNewOneRepMax ? (
                    <Text testID={`pr-badge-${set.id}`} style={styles.cardMetaHighlight}>
                      New 1RM
                    </Text>
                  ) : isNewRepPR ? (
                    <Text testID={`pr-badge-${set.id}`} style={styles.cardMetaHighlight}>
                      New {set.reps} Rep PR
                    </Text>
                  ) : null}
                  <TextInput
                    testID={`set-weight-${set.id}`}
                    style={styles.numberInput}
                    keyboardType="decimal-pad"
                    value={editInputs[set.id]?.weight ?? ''}
                    onChangeText={(text) =>
                      setEditInputs((prev) => ({
                        ...prev,
                        [set.id]: { weight: text, reps: prev[set.id]?.reps ?? '' },
                      }))
                    }
                    onEndEditing={() => handleUpdateSet(exercise, set)}
                  />
                  <Text style={styles.setUnitText}>{weightUnit}</Text>
                  <TextInput
                    testID={`set-reps-${set.id}`}
                    style={styles.numberInput}
                    keyboardType="number-pad"
                    value={editInputs[set.id]?.reps ?? ''}
                    onChangeText={(text) =>
                      setEditInputs((prev) => ({
                        ...prev,
                        [set.id]: { weight: prev[set.id]?.weight ?? '', reps: text },
                      }))
                    }
                    onEndEditing={() => handleUpdateSet(exercise, set)}
                  />
                  <Text style={styles.setUnitText}>reps</Text>
                  <TouchableOpacity
                    testID={`delete-set-${set.id}`}
                    onPress={() => handleDeleteSet(exercise.id, set.id)}
                  >
                    <Text style={styles.setDeleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            <View style={styles.addSetRow}>
              <TextInput
                testID={`new-set-weight-${exercise.id}`}
                style={styles.numberInput}
                placeholder="0"
                placeholderTextColor="#6B6B75"
                keyboardType="decimal-pad"
                value={draft.weight}
                onChangeText={(text) =>
                  setNewSetInputs((prev) => ({
                    ...prev,
                    [exercise.id]: { weight: text, reps: prev[exercise.id]?.reps ?? '' },
                  }))
                }
              />
              <Text style={styles.setUnitText}>{weightUnit}</Text>
              <TextInput
                testID={`new-set-reps-${exercise.id}`}
                style={styles.numberInput}
                placeholder="0"
                placeholderTextColor="#6B6B75"
                keyboardType="number-pad"
                value={draft.reps}
                onChangeText={(text) =>
                  setNewSetInputs((prev) => ({
                    ...prev,
                    [exercise.id]: { weight: prev[exercise.id]?.weight ?? '', reps: text },
                  }))
                }
              />
              <Text style={styles.setUnitText}>reps</Text>
              <TouchableOpacity
                testID={`add-set-${exercise.id}`}
                style={styles.addSetButton}
                onPress={() => handleAddSet(exercise)}
              >
                <Text style={styles.addSetButtonText}>Add Set</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      <TouchableOpacity
        testID="complete-workout"
        style={styles.button}
        onPress={handleComplete}
        disabled={completing}
      >
        {completing ? (
          <ActivityIndicator color="#0B0B0F" />
        ) : (
          <Text style={styles.buttonText}>Complete Workout</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
