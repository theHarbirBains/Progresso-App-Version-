import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { colors } from '../design/theme';
import { EmptyState } from '../design/EmptyState';
import { LoadingState } from '../design/LoadingState';
import { SectionHeader } from '../design/SectionHeader';
import type { ExerciseRow } from '../exercises/exerciseQueries';
import { MUSCLE_GROUP_LABELS } from '../exercises/muscleGroups';
import { fromKg, roundWeight, toKg } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { AddExerciseButton } from '../workouts/AddExerciseButton';
import { CreateCustomExerciseButton } from '../workouts/CreateCustomExerciseButton';
import { ExerciseCard } from '../workouts/ExerciseCard';
import { ExercisePickerModal } from '../workouts/ExercisePickerModal';
import {
  addExerciseToWorkout,
  completeWorkout,
  createSet,
  fetchWorkoutDetail,
  removeExerciseFromWorkout,
  reorderExercises,
  updateSet,
  type WorkoutDetail,
  type WorkoutExerciseWithSets,
} from '../workouts/workoutQueries';
import { computeTotalSets, computeTotalVolumeKg } from '../workouts/workoutSummary';
import { WorkoutActionMenu } from '../workouts/WorkoutActionMenu';
import { WorkoutHeader } from '../workouts/WorkoutHeader';
import { WorkoutSummaryCard } from '../workouts/WorkoutSummaryCard';
import { ExerciseFormScreen } from './ExerciseFormScreen';
import { liveWorkoutStyles as styles } from './liveWorkoutStyles';

type Props = RootStackScreenProps<'ActiveWorkout'>;

interface SetInputDraft {
  weight: string;
  reps: string;
}

function formatWeight(kg: number, unit: 'kg' | 'lb'): string {
  const value = roundWeight(fromKg(kg, unit));
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function isValidDraft(draft: SetInputDraft | undefined): boolean {
  if (!draft) return false;
  const weightNum = Number(draft.weight);
  const repsNum = Number(draft.reps);
  return Number.isFinite(weightNum) && weightNum > 0 && Number.isInteger(repsNum) && repsNum > 0;
}

// The live-tracking half of the Start Workout experience (see
// NewWorkoutScreen.tsx for the pre-start planning half) -- both share the
// same WorkoutHeader/WorkoutSummaryCard/ExerciseCard/SetRow component
// library and the same "exactly one blank set per new exercise" rule.
// Every set write (create/update/reorder/remove) reuses the existing
// direct-to-Supabase workoutQueries functions; nothing here talks to a new
// endpoint.
export function ActiveWorkoutScreen({ route, navigation }: Props) {
  const { workoutId } = route.params;
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { theme, weightUnit, themeLoading } = useProgressTheme();

  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customExerciseOpen, setCustomExerciseOpen] = useState(false);

  const [setInputs, setSetInputs] = useState<Record<string, SetInputDraft>>({});

  useEffect(() => {
    // Wait for weightUnit to actually be known before seeding the display
    // inputs from already-logged sets -- otherwise a 'lb' user would
    // momentarily (and incorrectly) see their kg values seeded as-is.
    if (themeLoading) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const detail = await fetchWorkoutDetail(workoutId);
        if (cancelled) return;
        setWorkout(detail);

        const nextInputs: Record<string, SetInputDraft> = {};
        for (const exercise of detail.exercises) {
          for (const set of exercise.sets) {
            nextInputs[set.id] = {
              weight: set.weightKg !== null ? formatWeight(set.weightKg, weightUnit) : '',
              reps: set.reps !== null ? String(set.reps) : '',
            };
          }
        }
        setSetInputs(nextInputs);
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
  }, [workoutId, themeLoading, weightUnit]);

  function updateExerciseSets(
    exerciseId: string,
    updater: (exercise: WorkoutExerciseWithSets) => WorkoutExerciseWithSets,
  ) {
    setWorkout((prev) =>
      prev
        ? {
            ...prev,
            exercises: prev.exercises.map((ex) => (ex.id === exerciseId ? updater(ex) : ex)),
          }
        : prev,
    );
  }

  async function handleAddSet(exercise: WorkoutExerciseWithSets) {
    setError(null);
    try {
      const nextIndex = exercise.sets.reduce((max, s) => Math.max(max, s.setIndex), 0) + 1;
      const created = await createSet(exercise.id, nextIndex);
      updateExerciseSets(exercise.id, (ex) => ({ ...ex, sets: [...ex.sets, created] }));
      setSetInputs((prev) => ({ ...prev, [created.id]: { weight: '', reps: '' } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add set');
    }
  }

  async function handleToggleComplete(
    exercise: WorkoutExerciseWithSets,
    set: WorkoutExerciseWithSets['sets'][number],
  ) {
    setError(null);
    try {
      if (set.completedAt) {
        const updated = await updateSet(set.id, { completedAt: null });
        updateExerciseSets(exercise.id, (ex) => ({
          ...ex,
          sets: ex.sets.map((s) => (s.id === set.id ? updated : s)),
        }));
        return;
      }

      const draft = setInputs[set.id];
      if (!isValidDraft(draft)) {
        setError('Enter a valid weight and rep count');
        return;
      }
      const weightKg = roundWeight(toKg(Number(draft.weight), weightUnit));
      const reps = Math.trunc(Number(draft.reps));
      const updated = await updateSet(set.id, {
        weightKg,
        reps,
        completedAt: new Date().toISOString(),
      });
      updateExerciseSets(exercise.id, (ex) => ({
        ...ex,
        sets: ex.sets.map((s) => (s.id === set.id ? updated : s)),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update set');
    }
  }

  async function handleRemoveExercise(exerciseId: string) {
    setError(null);
    try {
      await removeExerciseFromWorkout(exerciseId);
      setWorkout((prev) =>
        prev ? { ...prev, exercises: prev.exercises.filter((ex) => ex.id !== exerciseId) } : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove exercise');
    }
  }

  async function handleMoveExercise(index: number, direction: -1 | 1) {
    if (!workout) return;
    const target = index + direction;
    if (target < 0 || target >= workout.exercises.length) return;
    const a = workout.exercises[index];
    const b = workout.exercises[target];
    setError(null);
    try {
      await reorderExercises([
        { id: a.id, workoutId: workout.id, exerciseId: a.exerciseId, orderIndex: b.orderIndex },
        { id: b.id, workoutId: workout.id, exerciseId: b.exerciseId, orderIndex: a.orderIndex },
      ]);
      setWorkout((prev) => {
        if (!prev) return prev;
        const exercises = [...prev.exercises];
        exercises[index] = { ...b, orderIndex: a.orderIndex };
        exercises[target] = { ...a, orderIndex: b.orderIndex };
        return { ...prev, exercises };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder exercises');
    }
  }

  async function handleSelectExercise(exercise: ExerciseRow) {
    if (!workout) return;
    setPickerOpen(false);
    setError(null);
    try {
      const nextOrderIndex =
        workout.exercises.reduce((max, ex) => Math.max(max, ex.orderIndex), 0) + 1;
      const workoutExerciseId = await addExerciseToWorkout(workout.id, exercise.id, nextOrderIndex);
      const created = await createSet(workoutExerciseId, 1);
      setWorkout((prev) =>
        prev
          ? {
              ...prev,
              exercises: [
                ...prev.exercises,
                {
                  id: workoutExerciseId,
                  exerciseId: exercise.id,
                  exerciseName: exercise.name,
                  muscleGroup: exercise.muscleGroup,
                  orderIndex: nextOrderIndex,
                  sets: [created],
                },
              ],
            }
          : prev,
      );
      setSetInputs((prev) => ({ ...prev, [created.id]: { weight: '', reps: '' } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add exercise');
    }
  }

  async function handleComplete() {
    if (!workout || completing) return;
    setMenuOpen(false);
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

  if (!loading && error && !workout) {
    return (
      <View style={styles.screen}>
        <Text testID="active-workout-error" style={styles.errorText}>
          {error}
        </Text>
      </View>
    );
  }

  if (loading || themeLoading || !workout) {
    return <LoadingState testID="active-workout-loading" />;
  }

  const muscleGroupsLabel = Array.from(
    new Set(workout.exercises.map((ex) => MUSCLE_GROUP_LABELS[ex.muscleGroup])),
  ).join(', ');
  const totalSets = computeTotalSets(workout.exercises);
  const totalVolumeKg = computeTotalVolumeKg(workout.exercises);
  const totalVolumeDisplay = `${formatWeight(totalVolumeKg, weightUnit)} ${weightUnit}`;

  return (
    <View style={styles.screen}>
      <WorkoutHeader
        title={workout.name}
        onBack={() => navigation.goBack()}
        onOpenOptions={() => setMenuOpen(true)}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {error ? (
          <Text testID="active-workout-error" style={styles.errorText}>
            {error}
          </Text>
        ) : null}

        <WorkoutSummaryCard
          testID="active-workout-summary"
          workoutName={workout.name}
          muscleGroupsLabel={muscleGroupsLabel}
          performedAt={workout.performedAt}
          active={!workout.completedAt}
          totalSets={totalSets}
          totalVolumeDisplay={totalVolumeDisplay}
          accentColor={theme.accent}
        />

        <View style={styles.sectionTitle}>
          <SectionHeader label="Exercises" />
        </View>

        <View style={styles.addExerciseRow}>
          <AddExerciseButton
            testID="active-workout-add-exercise"
            onPress={() => setPickerOpen(true)}
          />
          <CreateCustomExerciseButton
            testID="active-workout-create-custom"
            onPress={() => setCustomExerciseOpen(true)}
          />
        </View>

        {workout.exercises.length === 0 ? (
          <View style={styles.emptyExercisesWrap}>
            <EmptyState
              testID="active-workout-empty"
              icon={<Feather name="activity" size={24} color={colors.textMuted} />}
              title="Add your first exercise to get started."
            />
          </View>
        ) : null}

        {workout.exercises.map((exercise, index) => (
          <ExerciseCard
            key={exercise.id}
            testID={`exercise-card-${exercise.id}`}
            exerciseName={exercise.exerciseName}
            muscleGroup={exercise.muscleGroup}
            sets={exercise.sets.map((set) => ({
              id: set.id,
              setIndex: set.setIndex,
              weight: setInputs[set.id]?.weight ?? '',
              reps: setInputs[set.id]?.reps ?? '',
              completed: set.completedAt !== null,
              canComplete: isValidDraft(setInputs[set.id]),
            }))}
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
              const set = exercise.sets.find((s) => s.id === setId);
              if (set) handleToggleComplete(exercise, set);
            }}
            onAddSet={() => handleAddSet(exercise)}
            onRemoveExercise={() => handleRemoveExercise(exercise.id)}
            onMoveUp={index > 0 ? () => handleMoveExercise(index, -1) : undefined}
            onMoveDown={
              index < workout.exercises.length - 1 ? () => handleMoveExercise(index, 1) : undefined
            }
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />
        ))}
      </ScrollView>

      <WorkoutActionMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onCompleteWorkout={handleComplete}
      />

      <ExercisePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelectExercise}
        userId={userId}
        alreadyAddedIds={workout.exercises.map((ex) => ex.exerciseId)}
      />

      {customExerciseOpen ? (
        <ExerciseFormScreen
          mode="create"
          onDone={() => {
            setCustomExerciseOpen(false);
            setPickerOpen(true);
          }}
          onCancel={() => setCustomExerciseOpen(false)}
        />
      ) : null}
    </View>
  );
}
