import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { createGroup } from '../lib/api';
import { EmptyState } from '../design/EmptyState';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import type { ExerciseRow } from '../exercises/exerciseQueries';
import { MUSCLE_GROUP_LABELS } from '../exercises/muscleGroups';
import { roundWeight, toKg, formatWeightKg } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import { useAllTimeStats } from '../progress/AllTimeStatsProvider';
import { useProgressTheme } from '../progress/useProgressTheme';
import { AddExerciseButton } from '../workouts/AddExerciseButton';
import { CreateCustomExerciseButton } from '../workouts/CreateCustomExerciseButton';
import { ExerciseCard } from '../workouts/ExerciseCard';
import { ExercisePickerModal } from '../workouts/ExercisePickerModal';
import {
  buildPreviousSessionDisplay,
  computeUnilateralSets,
  isValidDraft,
  type SetInputDraft,
} from '../workouts/setInputDrafts';
import {
  addExerciseToWorkout,
  fetchNextExerciseOrderIndex,
  cancelWorkout,
  completeWorkout,
  createSet,
  fetchPreviousPerformance,
  fetchWorkoutDetail,
  removeExerciseFromWorkout,
  reorderExercises,
  updateSet,
  type SetRecord,
  type WorkoutDetail,
  type WorkoutExerciseWithSets,
} from '../workouts/workoutQueries';
import {
  clearLiveWorkoutDraft,
  loadLiveWorkoutDraft,
  mergeLiveWorkoutDrafts,
  pendingDraftsFor,
  saveLiveWorkoutDraft,
} from '../workouts/liveWorkoutDraft';
import { computeTotalSets } from '../workouts/workoutSummary';
import { WorkoutStats } from '../workouts/WorkoutStats';
import { ExerciseFormScreen } from './ExerciseFormScreen';
import { liveWorkoutStyles as styles } from './liveWorkoutStyles';

type Props = RootStackScreenProps<'ActiveWorkout'>;

// The live-tracking half of the Start Workout experience (see
// NewWorkoutScreen.tsx for the pre-start planning half), sharing the same
// "exactly one blank set per new exercise" rule.
//
// Layout, built for one-handed use between sets: the header carries the
// workout's name and muscles; under it a pinned strip keeps duration, total
// sets and volume in view; the exercises scroll as plain blocks (each with
// the last session's numbers right above the sets to log); and the one
// filled button, Finish Workout, is pinned at the bottom. Add Exercise /
// Create Custom / Cancel Workout come after the last exercise -- Cancel is
// deliberately out of thumb range of Finish, and still asks for confirmation.
// Every set write (create/update/reorder/remove) reuses the existing
// direct-to-Supabase workoutQueries functions; nothing here talks to a new
// endpoint.
export function ActiveWorkoutScreen({ route, navigation }: Props) {
  const { workoutId } = route.params;
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const { theme, weightUnit, themeLoading } = useProgressTheme();
  const { refetch: refetchAllTimeStats } = useAllTimeStats();

  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [startingGroup, setStartingGroup] = useState(false);

  // Starts a group from this workout: the group session includes it as this person's workout.
  async function handleStartGroup() {
    if (!session?.access_token || startingGroup || !workout) return;
    setStartingGroup(true);
    try {
      const { groupId } = await createGroup(session.access_token, {
        name: workout.name,
        workoutId,
      });
      navigation.navigate('GroupSession', { groupId });
    } catch (err) {
      Alert.alert('Could not start a group', err instanceof Error ? err.message : 'Try again');
    } finally {
      setStartingGroup(false);
    }
  }
  const [cancelling, setCancelling] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customExerciseOpen, setCustomExerciseOpen] = useState(false);

  const [setInputs, setSetInputs] = useState<Record<string, SetInputDraft>>({});
  // Mirrors what is typed into open sets to the device, so an app close or reset mid-set doesn't
  // lose it. Debounced so typing never waits on storage. Completed sets are saved on the server
  // instead, so only open sets are kept here.
  useEffect(() => {
    if (!workout || loading) return;
    const timer = setTimeout(() => {
      const openSetIds = new Set(
        workout.exercises.flatMap((exercise) =>
          exercise.sets.filter((set) => set.completedAt === null).map((set) => set.id),
        ),
      );
      void saveLiveWorkoutDraft(workout.id, pendingDraftsFor(setInputs, openSetIds));
    }, 400);
    return () => clearTimeout(timer);
  }, [setInputs, workout, loading]);
  // Every set from the user's last completed session with each exercise
  // already in THIS workout -- keyed by exerciseId, not workoutExerciseId,
  // so it reflects real history across past workouts. fetchPreviousPerformance
  // already excludes the in-progress workout itself (excludeWorkoutId), so
  // this never includes today's own not-yet-completed sets. Purely
  // informational context; failing to load it never blocks or errors the
  // workout itself.
  const [previousPerformance, setPreviousPerformance] = useState<
    Record<string, { performedAt: string; sets: SetRecord[] }>
  >({});

  async function loadPreviousPerformance(exerciseId: string) {
    if (!userId) return;
    try {
      const previous = await fetchPreviousPerformance(userId, exerciseId, workoutId);
      if (previous && previous.sets.length > 0) {
        setPreviousPerformance((prev) => ({ ...prev, [exerciseId]: previous }));
      }
    } catch {
      // Non-critical context -- leave this exercise's entry absent rather
      // than surfacing a workout-level error banner for it.
    }
  }

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

        const savedInputs: Record<string, SetInputDraft> = {};
        const openSetIds = new Set<string>();
        for (const exercise of detail.exercises) {
          for (const set of exercise.sets) {
            savedInputs[set.id] = {
              weight: set.weightKg !== null ? formatWeightKg(set.weightKg, weightUnit) : '',
              reps: set.reps !== null ? String(set.reps) : '',
            };
            if (set.completedAt === null) openSetIds.add(set.id);
          }
        }
        // Values typed into open sets before the app was closed or reset come back here.
        const drafts = await loadLiveWorkoutDraft(workoutId);
        const nextInputs = mergeLiveWorkoutDrafts(savedInputs, drafts, openSetIds);
        setSetInputs(nextInputs);

        // Last completed session per exercise already in this workout --
        // see previousPerformance's own comment. A failure for one
        // exercise's history never blocks the others or the workout load.
        const uniqueExerciseIds = Array.from(new Set(detail.exercises.map((ex) => ex.exerciseId)));
        const previousEntries = await Promise.all(
          uniqueExerciseIds.map(async (exerciseId) => {
            try {
              const previous = await fetchPreviousPerformance(userId, exerciseId, workoutId);
              return [exerciseId, previous] as const;
            } catch {
              return [exerciseId, null] as const;
            }
          }),
        );
        if (!cancelled) {
          const nextPreviousPerformance: Record<
            string,
            { performedAt: string; sets: SetRecord[] }
          > = {};
          for (const [exerciseId, previous] of previousEntries) {
            if (previous && previous.sets.length > 0)
              nextPreviousPerformance[exerciseId] = previous;
          }
          setPreviousPerformance(nextPreviousPerformance);
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
  }, [workoutId, themeLoading, weightUnit, userId]);

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
      if (exercise.movementType === 'unilateral') {
        // One logical set = two rows sharing this set_index, one per side --
        // never a single combined-weight row. Both sides are created
        // together so the UI always has a matching pair to render.
        const [left, right] = await Promise.all([
          createSet(exercise.id, nextIndex, 'left'),
          createSet(exercise.id, nextIndex, 'right'),
        ]);
        updateExerciseSets(exercise.id, (ex) => ({ ...ex, sets: [...ex.sets, left, right] }));
        setSetInputs((prev) => ({
          ...prev,
          [left.id]: { weight: '', reps: '' },
          [right.id]: { weight: '', reps: '' },
        }));
        return;
      }
      const created = await createSet(exercise.id, nextIndex);
      updateExerciseSets(exercise.id, (ex) => ({ ...ex, sets: [...ex.sets, created] }));
      setSetInputs((prev) => ({ ...prev, [created.id]: { weight: '', reps: '' } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add set');
    }
  }

  /** Completes/uncompletes exactly one set row. Shared by the bilateral
   * (one row per logical set) and unilateral (two rows per logical set)
   * completion handlers below, so the validation/save logic only exists
   * once. */
  async function completeOrUncompleteSet(
    exerciseId: string,
    set: SetRecord,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    if (set.completedAt) {
      const updated = await updateSet(set.id, { completedAt: null });
      updateExerciseSets(exerciseId, (ex) => ({
        ...ex,
        sets: ex.sets.map((s) => (s.id === set.id ? updated : s)),
      }));
      return { ok: true };
    }

    const draft = setInputs[set.id];
    if (!isValidDraft(draft)) {
      return { ok: false, error: 'Enter a valid weight (whole number or .5) and rep count' };
    }
    const weightKg = roundWeight(toKg(Number(draft.weight), weightUnit));
    const reps = Math.trunc(Number(draft.reps));
    const updated = await updateSet(set.id, {
      weightKg,
      reps,
      completedAt: new Date().toISOString(),
    });
    updateExerciseSets(exerciseId, (ex) => ({
      ...ex,
      sets: ex.sets.map((s) => (s.id === set.id ? updated : s)),
    }));
    return { ok: true };
  }

  async function handleToggleComplete(
    exercise: WorkoutExerciseWithSets,
    set: WorkoutExerciseWithSets['sets'][number],
  ) {
    setError(null);
    try {
      const result = await completeOrUncompleteSet(exercise.id, set);
      if (!result.ok) setError(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update set');
    }
  }

  /** Completes/uncompletes BOTH sides of one unilateral logical set
   * together -- it's one unit from the user's perspective (see
   * UnilateralSetRow), never two independent completions. */
  async function handleToggleUnilateralComplete(
    exercise: WorkoutExerciseWithSets,
    setIndex: number,
  ) {
    const left = exercise.sets.find((s) => s.setIndex === setIndex && s.side === 'left');
    const right = exercise.sets.find((s) => s.setIndex === setIndex && s.side === 'right');
    if (!left || !right) return;

    setError(null);
    if (!left.completedAt || !right.completedAt) {
      const leftDraft = setInputs[left.id];
      const rightDraft = setInputs[right.id];
      if (!isValidDraft(leftDraft) || !isValidDraft(rightDraft)) {
        setError('Enter a valid weight (whole number or .5) and rep count for both sides');
        return;
      }
    }

    try {
      const [leftResult, rightResult] = await Promise.all([
        completeOrUncompleteSet(exercise.id, left),
        completeOrUncompleteSet(exercise.id, right),
      ]);
      if (!leftResult.ok) setError(leftResult.error);
      else if (!rightResult.ok) setError(rightResult.error);
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

  // Keeps handleMoveExercise's latest closure (fresh `workout` etc. each
  // render) reachable from the stable per-position handlers below, without
  // those handlers themselves needing to change identity every render.
  const handleMoveExerciseRef = useRef(handleMoveExercise);
  handleMoveExerciseRef.current = handleMoveExercise;
  // ExerciseCard is memoized on its own props (see that file's own
  // comment) to stop a keystroke in one exercise from re-rendering every
  // other exercise's card -- which only works if onMoveUp/onMoveDown are
  // themselves stable across renders. They're position-based (move "whoever
  // is currently at this index"), so caching one handler per index/direction
  // pair is correct even across a reorder: the cached handler still means
  // "move whatever is at position N right now" for whichever exercise ends
  // up rendered there.
  // Set-row handlers, stable for the life of the screen. Weight and reps use functional updates
  // only, so they never need fresh state. Completion reads the latest workout and handler through
  // refs, so it can stay stable too. A stable reference is what lets SetRow's memo skip the other
  // rows while the user types into one.
  const changeSetWeight = useCallback(
    (setId: string, text: string) =>
      setSetInputs((prev) => ({
        ...prev,
        [setId]: { weight: text, reps: prev[setId]?.reps ?? '' },
      })),
    [],
  );
  const changeSetReps = useCallback(
    (setId: string, text: string) =>
      setSetInputs((prev) => ({
        ...prev,
        [setId]: { weight: prev[setId]?.weight ?? '', reps: text },
      })),
    [],
  );
  const workoutRef = useRef(workout);
  workoutRef.current = workout;
  const toggleCompleteRef = useRef(handleToggleComplete);
  toggleCompleteRef.current = handleToggleComplete;
  const toggleUnilateralRef = useRef(handleToggleUnilateralComplete);
  toggleUnilateralRef.current = handleToggleUnilateralComplete;
  const toggleSetComplete = useCallback((setId: string) => {
    const current = workoutRef.current;
    if (!current) return;
    for (const exercise of current.exercises) {
      const set = exercise.sets.find((candidate) => candidate.id === setId);
      if (set) {
        // A unilateral set completes as one unit, through its own path.
        if (exercise.movementType === 'unilateral') {
          void toggleUnilateralRef.current(exercise, set.setIndex);
        } else {
          void toggleCompleteRef.current(exercise, set);
        }
        return;
      }
    }
  }, []);

  const moveHandlersRef = useRef(new Map<string, () => void>());
  function getMoveHandler(index: number, direction: -1 | 1): () => void {
    const cacheKey = `${index}:${direction}`;
    const cached = moveHandlersRef.current.get(cacheKey);
    if (cached) return cached;
    const handler = () => handleMoveExerciseRef.current(index, direction);
    moveHandlersRef.current.set(cacheKey, handler);
    return handler;
  }

  async function handleSelectExercise(exercise: ExerciseRow) {
    if (!workout) return;
    setPickerOpen(false);
    setError(null);
    try {
      const nextOrderIndex = await fetchNextExerciseOrderIndex(workout.id);
      const workoutExerciseId = await addExerciseToWorkout(workout.id, exercise.id, nextOrderIndex);

      const isUnilateral = exercise.movementType === 'unilateral';
      const createdSets = isUnilateral
        ? await Promise.all([
            createSet(workoutExerciseId, 1, 'left'),
            createSet(workoutExerciseId, 1, 'right'),
          ])
        : [await createSet(workoutExerciseId, 1)];

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
                  photoUrl: exercise.photoUrl,
                  muscleGroup: exercise.muscleGroup,
                  movementType: exercise.movementType,
                  loggingStyle: exercise.loggingStyle,
                  orderIndex: nextOrderIndex,
                  sets: createdSets,
                },
              ],
            }
          : prev,
      );
      setSetInputs((prev) => {
        const next = { ...prev };
        for (const created of createdSets) {
          next[created.id] = { weight: '', reps: '' };
        }
        return next;
      });
      if (!(exercise.id in previousPerformance)) void loadPreviousPerformance(exercise.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add exercise');
    }
  }

  async function handleComplete() {
    if (!workout || completing) return;
    setError(null);
    setCompleting(true);
    try {
      await completeWorkout(workout.id);
      void clearLiveWorkoutDraft(workout.id);
      // The only thing that changes what AllTimeStatsProvider's cache holds
      // -- refreshes it now so Profile/Progress already have this workout's
      // stats and PRs the moment they're next visited, instead of a stale
      // cache from before it was completed. Not awaited: the provider
      // outlives this screen, so the fetch keeps going after the reset below.
      void refetchAllTimeStats();
      // Land on the Share screen -- the natural moment to share -- with Workout
      // History underneath, so Back (or finishing there) still ends in History.
      navigation.reset({
        index: 1,
        routes: [
          { name: 'WorkoutHistory' },
          { name: 'ShareWorkout', params: { workoutId: workout.id } },
        ],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete workout');
      setCompleting(false);
    }
  }

  async function performCancel() {
    if (!workout || cancelling) return;
    setError(null);
    setCancelling(true);
    try {
      // Soft-delete only -- never sets completed_at, so this workout never
      // enters history, never advances split progression, and never
      // affects PR/1RM data. See cancelWorkout's own comment.
      await cancelWorkout(workout.id);
      void clearLiveWorkoutDraft(workout.id);
      navigation.reset({ index: 0, routes: [{ name: 'Feed' }] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel workout');
      setCancelling(false);
    }
  }

  function handleCancelWorkout() {
    if (!workout || cancelling) return;
    Alert.alert(
      'Cancel Workout',
      'This discards the current workout and everything logged in it. This cannot be undone.',
      [
        { text: 'Keep Going', style: 'cancel' },
        { text: 'Cancel Workout', style: 'destructive', onPress: performCancel },
      ],
    );
  }

  if (!loading && error && !workout) {
    return (
      <Screen scroll={false} header={<AppHeader title="Workout" />}>
        <Text testID="active-workout-error" style={styles.errorText}>
          {error}
        </Text>
      </Screen>
    );
  }

  if (loading || themeLoading || !workout) {
    return <LoadingState testID="active-workout-loading" />;
  }

  // Creating a custom exercise mid-workout goes to the same full New
  // Exercise screen as the Exercise Library (machine/equipment/photo
  // included) rather than a lightweight sheet -- a full in-place swap of
  // this screen's own render, same pattern ExerciseLibraryScreen already
  // uses for its own create/edit modes.
  if (customExerciseOpen) {
    return (
      <ExerciseFormScreen
        mode="create"
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
        onDone={() => {
          setCustomExerciseOpen(false);
          setPickerOpen(true);
        }}
        onCancel={() => setCustomExerciseOpen(false)}
      />
    );
  }

  const muscleGroupsLabel = Array.from(
    new Set(workout.exercises.map((ex) => MUSCLE_GROUP_LABELS[ex.muscleGroup])),
  ).join(', ');
  const totalSets = computeTotalSets(workout.exercises);

  return (
    <>
      <Screen
        scroll={false}
        padded={false}
        keyboardAvoiding
        header={
          <View>
            <AppHeader
              testID="active-workout-header"
              title={workout.name}
              subtitle={muscleGroupsLabel || undefined}
            />
            <WorkoutStats
              testID="active-workout-summary"
              performedAt={workout.performedAt}
              active={!workout.completedAt}
              totalSets={totalSets}
              totalExercises={workout.exercises.length}
            />
          </View>
        }
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <Text testID="active-workout-error" style={styles.errorText}>
              {error}
            </Text>
          ) : null}

          {workout.exercises.length === 0 ? (
            <View style={styles.emptyWrap}>
              <EmptyState
                testID="active-workout-empty"
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
              movementType={exercise.movementType}
              previousSession={buildPreviousSessionDisplay(
                previousPerformance[exercise.exerciseId],
                weightUnit,
              )}
              onViewHistory={
                previousPerformance[exercise.exerciseId]
                  ? () =>
                      navigation.navigate('ProgressExerciseDetail', {
                        exerciseId: exercise.exerciseId,
                        exerciseName: exercise.exerciseName,
                      })
                  : undefined
              }
              sets={
                exercise.movementType === 'unilateral'
                  ? []
                  : exercise.sets.map((set) => ({
                      id: set.id,
                      setIndex: set.setIndex,
                      weight: setInputs[set.id]?.weight ?? '',
                      reps: setInputs[set.id]?.reps ?? '',
                      completed: set.completedAt !== null,
                      canComplete: isValidDraft(setInputs[set.id]),
                    }))
              }
              unilateralSets={
                exercise.movementType === 'unilateral'
                  ? computeUnilateralSets(exercise.sets, setInputs)
                  : []
              }
              onChangeWeight={changeSetWeight}
              onChangeReps={changeSetReps}
              onToggleComplete={toggleSetComplete}
              onAddSet={() => handleAddSet(exercise)}
              onRemoveExercise={() => handleRemoveExercise(exercise.id)}
              onMoveUp={index > 0 ? getMoveHandler(index, -1) : undefined}
              onMoveDown={
                index < workout.exercises.length - 1 ? getMoveHandler(index, 1) : undefined
              }
              divider={index > 0}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
            />
          ))}

          <View style={styles.endActions}>
            <AddExerciseButton
              testID="active-workout-add-exercise"
              onPress={() => setPickerOpen(true)}
            />
            <CreateCustomExerciseButton
              testID="active-workout-create-custom"
              onPress={() => setCustomExerciseOpen(true)}
            />
            <TextButton
              testID="cancel-workout"
              label={cancelling ? 'Cancelling…' : 'Cancel Workout'}
              destructive
              onPress={handleCancelWorkout}
              disabled={cancelling || completing}
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <SecondaryButton
            testID="start-group-from-workout"
            label={startingGroup ? 'Starting group…' : 'Start a Group From This Workout'}
            onPress={() => void handleStartGroup()}
            disabled={startingGroup}
          />
          <PrimaryButton
            testID="complete-workout"
            label={completing ? 'Completing…' : 'Finish Workout'}
            onPress={handleComplete}
            disabled={completing || cancelling}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />
        </View>
      </Screen>

      <ExercisePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelectExercise}
        userId={userId}
        alreadyAddedIds={workout.exercises.map((ex) => ex.exerciseId)}
        onCreateCustom={() => {
          setPickerOpen(false);
          setCustomExerciseOpen(true);
        }}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
      />
    </>
  );
}
