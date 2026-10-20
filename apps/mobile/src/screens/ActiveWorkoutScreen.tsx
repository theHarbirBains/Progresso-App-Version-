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
import { fetchAllExercises, type ExerciseRow } from '../exercises/exerciseQueries';
import { MUSCLE_GROUP_LABELS } from '../exercises/muscleGroups';
import { measurementTypeOf, type MeasurementType } from '../exercises/movementTypes';
import type { RootStackScreenProps } from '../navigation/types';
import { useAllTimeStats } from '../progress/AllTimeStatsProvider';
import { useProgressTheme } from '../progress/useProgressTheme';
import { useProfile } from '../profile/ProfileProvider';
import { AddExerciseButton } from '../workouts/AddExerciseButton';
import { CreateCustomExerciseButton } from '../workouts/CreateCustomExerciseButton';
import { ExerciseCard } from '../workouts/ExerciseCard';
import { ExercisePickerModal } from '../workouts/ExercisePickerModal';
import {
  effectiveRepRange,
  formatRepRange,
  progressionForExercise,
  wantsGuidance,
  type RepRange,
} from '../workouts/progression';
import { ExerciseProgressionSheet } from '../workouts/ExerciseProgressionSheet';
import {
  fetchExerciseSettings,
  saveExerciseSetting,
  type ExerciseProgressionSetting,
} from '../workouts/exerciseSettingsQueries';
import {
  buildPreviousSessionDisplay,
  computeCardSets,
  computeUnilateralSets,
  draftFromSet,
  draftValues,
  hasDraftInput,
  invalidDraftMessage,
  isValidDraft,
  withPrefilledSets,
  type SetInputDraft,
} from '../workouts/setInputDrafts';
import {
  addExerciseToWorkout,
  fetchNextExerciseOrderIndex,
  cancelWorkout,
  completeWorkout,
  createSet,
  deleteSet,
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
import { useSetInputDrafts } from '../workouts/useSetInputDrafts';
import { computeTotalSets } from '../workouts/workoutSummary';
import { WorkoutStats } from '../workouts/WorkoutStats';
import { ExerciseFormScreen } from './ExerciseFormScreen';
import { liveWorkoutStyles as styles } from './liveWorkoutStyles';

type Props = RootStackScreenProps<'ActiveWorkout'>;

// The live-tracking half of the Start Workout experience (see
// NewWorkoutScreen.tsx for the pre-start planning half), sharing the same
// "exactly one set per new exercise" rule. A new set's fields start filled
// in from the set before it or from last session (see withPrefilledSets);
// completing it still takes a tap.
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
  const { workoutId, planned } = route.params;
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const { theme, weightUnit, themeLoading } = useProgressTheme();
  const {
    refetch: refetchAllTimeStats,
    repPRs: allRepPRs,
    exerciseRecords: allExerciseRecords,
  } = useAllTimeStats();
  const { profile } = useProfile();
  // Progressive overload (workouts/progression.ts): the person's one rep range, and whether to
  // suggest anything. Read off the shared profile, so a change in Settings shows straight away.
  const progressionSettings = {
    range: { min: profile?.repRangeMin ?? 8, max: profile?.repRangeMax ?? 12 },
    enabled: profile?.progressionCuesEnabled ?? true,
    guided: wantsGuidance(profile?.trainingComfort ?? null),
    unit: weightUnit,
  };
  // The person's exercise library (already cached for the picker), to suggest the weighted
  // version of a bodyweight or timed exercise. Nothing breaks without it.
  const [library, setLibrary] = useState<ExerciseRow[]>([]);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchAllExercises({ userId, search: '', muscleGroup: null, source: 'all' })
      .then((rows) => {
        if (!cancelled) setLibrary(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Exercises with their own rep range or weight step (exerciseSettingsQueries.ts). An
  // exercise's own range wins over the person's; nothing breaks without them.
  const [exerciseSettings, setExerciseSettings] = useState<Map<string, ExerciseProgressionSetting>>(
    new Map(),
  );
  const [editingRangeFor, setEditingRangeFor] = useState<{
    exerciseId: string;
    exerciseName: string;
    measurementType: MeasurementType;
  } | null>(null);
  const [rangeSaving, setRangeSaving] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchExerciseSettings(userId)
      .then((settings) => {
        if (!cancelled) setExerciseSettings(settings);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function handleSaveExerciseRange(setting: {
    range: RepRange | null;
    incrementKg: number | null;
  }) {
    if (!userId || !editingRangeFor) return;
    setRangeError(null);
    setRangeSaving(true);
    try {
      const saved = await saveExerciseSetting(userId, editingRangeFor.exerciseId, setting);
      setExerciseSettings((prev) => {
        const next = new Map(prev);
        if (saved) next.set(editingRangeFor.exerciseId, saved);
        else next.delete(editingRangeFor.exerciseId);
        return next;
      });
      setEditingRangeFor(null);
    } catch (err) {
      setRangeError(err instanceof Error ? err.message : 'Failed to save the range');
    } finally {
      setRangeSaving(false);
    }
  }

  // One stable handler per exercise, so opening the range sheet never re-renders every card.
  const rangeHandlersRef = useRef(new Map<string, () => void>());
  function getRangeHandler(exercise: {
    exerciseId: string;
    exerciseName: string;
    measurementType: MeasurementType;
  }): () => void {
    const cached = rangeHandlersRef.current.get(exercise.exerciseId);
    if (cached) return cached;
    const handler = () => {
      setRangeError(null);
      setEditingRangeFor(exercise);
    };
    rangeHandlersRef.current.set(exercise.exerciseId, handler);
    return handler;
  }

  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Starting a planned day says here if not all of its plan made it into the workout. Kept apart
  // from `error`, which loading clears.
  const planError = route.params.planError ?? null;
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

  const {
    setInputs,
    setSetInputs,
    changeWeight: changeSetWeight,
    changeReps: changeSetReps,
    changeDuration: changeSetDuration,
  } = useSetInputDrafts();
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
    if (!userId) return null;
    try {
      const previous = await fetchPreviousPerformance(userId, exerciseId, workoutId);
      if (previous && previous.sets.length > 0) {
        setPreviousPerformance((prev) => ({ ...prev, [exerciseId]: previous }));
        return previous;
      }
    } catch {
      // Non-critical context -- leave this exercise's entry absent rather
      // than surfacing a workout-level error banner for it.
    }
    return null;
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
        // Only an open workout is tracked live. A link to one that has since been finished
        // opens its detail instead, where it can't be cancelled or changed by accident.
        if (detail.completedAt) {
          navigation.replace('WorkoutDetail', { workoutId });
          return;
        }
        setWorkout(detail);

        const savedInputs: Record<string, SetInputDraft> = {};
        const openSetIds = new Set<string>();
        for (const exercise of detail.exercises) {
          for (const set of exercise.sets) {
            savedInputs[set.id] = draftFromSet(set, measurementTypeOf(exercise), weightUnit);
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
          // A workout just started from a split day's plan: its sets were made ahead of time,
          // blank, and start from last time, as a set added with Add Set does. A set with
          // anything typed or ticked is left as it is.
          if (planned)
            setSetInputs((prev) => {
              let next = prev;
              for (const exercise of detail.exercises) {
                const indexes = Array.from(new Set(exercise.sets.map((set) => set.setIndex))).sort(
                  (a, b) => a - b,
                );
                for (const index of indexes) {
                  const rows = exercise.sets.filter((set) => set.setIndex === index);
                  if (rows.some((row) => row.completedAt !== null)) continue;
                  next = withPrefilledSets(
                    next,
                    rows,
                    exercise.sets.filter((set) => set.setIndex < index),
                    nextPreviousPerformance[exercise.exerciseId]?.sets,
                    weightUnit,
                    measurementTypeOf(exercise),
                  );
                }
              }
              return next;
            });
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
    // setSetInputs is useSetInputDrafts' own useState setter and navigation is the screen's own
    // (both stable for the life of the screen); listed for the linter, not because they change.
  }, [workoutId, planned, themeLoading, weightUnit, userId, setSetInputs, navigation]);

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
    const lastSession = previousPerformance[exercise.exerciseId]?.sets;
    const type = measurementTypeOf(exercise);
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
        setSetInputs((prev) =>
          withPrefilledSets(prev, [left, right], exercise.sets, lastSession, weightUnit, type),
        );
        return;
      }
      const created = await createSet(exercise.id, nextIndex);
      updateExerciseSets(exercise.id, (ex) => ({ ...ex, sets: [...ex.sets, created] }));
      setSetInputs((prev) =>
        withPrefilledSets(prev, [created], exercise.sets, lastSession, weightUnit, type),
      );
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
    type: MeasurementType,
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
    if (!isValidDraft(draft, type)) {
      return { ok: false, error: invalidDraftMessage(type) };
    }
    const updated = await updateSet(set.id, {
      ...draftValues(draft, type, weightUnit),
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
      const result = await completeOrUncompleteSet(exercise.id, set, measurementTypeOf(exercise));
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
    const type = measurementTypeOf(exercise);
    if (!left.completedAt || !right.completedAt) {
      const leftDraft = setInputs[left.id];
      const rightDraft = setInputs[right.id];
      if (!isValidDraft(leftDraft, type) || !isValidDraft(rightDraft, type)) {
        setError(invalidDraftMessage(type, true));
        return;
      }
    }

    try {
      const [leftResult, rightResult] = await Promise.all([
        completeOrUncompleteSet(exercise.id, left, type),
        completeOrUncompleteSet(exercise.id, right, type),
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

  function dropSetInputs(...setIds: string[]) {
    setSetInputs((prev) => {
      const next = { ...prev };
      for (const id of setIds) delete next[id];
      return next;
    });
  }

  async function handleRemoveSet(exerciseId: string, set: SetRecord) {
    setError(null);
    try {
      await deleteSet(set.id);
      updateExerciseSets(exerciseId, (ex) => ({
        ...ex,
        sets: ex.sets.filter((s) => s.id !== set.id),
      }));
      dropSetInputs(set.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove set');
    }
  }

  /** Removes both sides of one unilateral logical set together -- it's one unit, same as completion. */
  async function handleRemoveUnilateralSet(exercise: WorkoutExerciseWithSets, setIndex: number) {
    const left = exercise.sets.find((s) => s.setIndex === setIndex && s.side === 'left');
    const right = exercise.sets.find((s) => s.setIndex === setIndex && s.side === 'right');
    if (!left || !right) return;

    setError(null);
    try {
      await Promise.all([deleteSet(left.id), deleteSet(right.id)]);
      updateExerciseSets(exercise.id, (ex) => ({
        ...ex,
        sets: ex.sets.filter((s) => s.id !== left.id && s.id !== right.id),
      }));
      dropSetInputs(left.id, right.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove set');
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
  // Weight/reps change handlers come from useSetInputDrafts, already stable (functional
  // updates only, so they never need fresh state). Completion/removal read the latest
  // workout and handler through refs below, so they can stay stable too. A stable
  // reference is what lets SetRow's memo skip the other rows while the user types into one.
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

  const removeSetRef = useRef(handleRemoveSet);
  removeSetRef.current = handleRemoveSet;
  const removeUnilateralSetRef = useRef(handleRemoveUnilateralSet);
  removeUnilateralSetRef.current = handleRemoveUnilateralSet;
  const setInputsRef = useRef(setInputs);
  setInputsRef.current = setInputs;
  const removeSet = useCallback((setId: string) => {
    const current = workoutRef.current;
    if (!current) return;
    for (const exercise of current.exercises) {
      const set = exercise.sets.find((candidate) => candidate.id === setId);
      if (set) {
        const unilateral = exercise.movementType === 'unilateral';
        // A unilateral set is removed as one unit, same as completion above.
        const rows = unilateral
          ? exercise.sets.filter((candidate) => candidate.setIndex === set.setIndex)
          : [set];
        const remove = () => {
          if (unilateral) void removeUnilateralSetRef.current(exercise, set.setIndex);
          else void removeSetRef.current(exercise.id, set);
        };
        // A set with nothing in it goes straight away; one with numbers in it, or ticked, is
        // asked about first, so a stray tap never loses a logged set.
        const hasData = rows.some(
          (row) => row.completedAt !== null || hasDraftInput(setInputsRef.current[row.id]),
        );
        if (!hasData) {
          remove();
          return;
        }
        const indexes = Array.from(new Set(exercise.sets.map((row) => row.setIndex))).sort(
          (a, b) => a - b,
        );
        const number = indexes.indexOf(set.setIndex) + 1;
        const lastOne = indexes.length === 1;
        Alert.alert(
          `Remove set ${number}?`,
          lastOne
            ? `It's the only set of ${exercise.exerciseName}. The exercise stays in your workout, so you can add a set again.`
            : `What you entered for it is removed from this workout.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove Set', style: 'destructive', onPress: remove },
          ],
        );
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
    // Loads while the exercise and its first set are created; that set starts from it.
    const lastSessionLoad =
      exercise.id in previousPerformance
        ? Promise.resolve(previousPerformance[exercise.id])
        : loadPreviousPerformance(exercise.id);
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
                  measurementType: exercise.measurementType,
                  orderIndex: nextOrderIndex,
                  sets: createdSets,
                },
              ],
            }
          : prev,
      );
      const lastSession = await lastSessionLoad;
      // Anything typed into the new set while last session loaded is kept.
      setSetInputs((prev) =>
        withPrefilledSets(
          prev,
          createdSets,
          [],
          lastSession?.sets,
          weightUnit,
          exercise.measurementType,
        ),
      );
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
          {(error ?? planError) ? (
            <Text testID="active-workout-error" style={styles.errorText}>
              {error ?? planError}
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
              {...progressionForExercise({
                exercise,
                lastSessionSets: previousPerformance[exercise.exerciseId]?.sets,
                settings: progressionSettings,
                repPRs: allRepPRs,
                records: allExerciseRecords,
                library,
                override: exerciseSettings.get(exercise.exerciseId) ?? null,
              })}
              rangeText={
                measurementTypeOf(exercise) === 'timed'
                  ? null
                  : exerciseSettings.get(exercise.exerciseId)?.range
                    ? `Range ${formatRepRange(
                        effectiveRepRange(
                          progressionSettings.range,
                          exerciseSettings.get(exercise.exerciseId)?.range ?? null,
                        ),
                      )} · this exercise`
                    : `Range ${formatRepRange(progressionSettings.range)}`
              }
              onEditProgression={
                measurementTypeOf(exercise) === 'timed'
                  ? undefined
                  : getRangeHandler({
                      exerciseId: exercise.exerciseId,
                      exerciseName: exercise.exerciseName,
                      measurementType: measurementTypeOf(exercise),
                    })
              }
              key={exercise.id}
              testID={`exercise-card-${exercise.id}`}
              exerciseName={exercise.exerciseName}
              muscleGroup={exercise.muscleGroup}
              movementType={exercise.movementType}
              measurementType={measurementTypeOf(exercise)}
              previousSession={buildPreviousSessionDisplay(
                previousPerformance[exercise.exerciseId],
                weightUnit,
                measurementTypeOf(exercise),
              )}
              // Exercise progress charts weights; a bodyweight or timed exercise has none to show.
              onViewHistory={
                previousPerformance[exercise.exerciseId] &&
                measurementTypeOf(exercise) === 'weight_reps'
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
                  : computeCardSets(exercise.sets, setInputs, measurementTypeOf(exercise))
              }
              unilateralSets={
                exercise.movementType === 'unilateral'
                  ? computeUnilateralSets(exercise.sets, setInputs, measurementTypeOf(exercise))
                  : []
              }
              onChangeWeight={changeSetWeight}
              onChangeReps={changeSetReps}
              onChangeDuration={changeSetDuration}
              onToggleComplete={toggleSetComplete}
              onAddSet={() => handleAddSet(exercise)}
              onRemoveSet={removeSet}
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

      <ExerciseProgressionSheet
        visible={editingRangeFor !== null}
        exerciseName={editingRangeFor?.exerciseName ?? ''}
        measurementType={editingRangeFor?.measurementType ?? 'weight_reps'}
        personalRange={progressionSettings.range}
        current={
          editingRangeFor ? (exerciseSettings.get(editingRangeFor.exerciseId) ?? null) : null
        }
        unit={weightUnit}
        saving={rangeSaving}
        error={rangeError}
        onSave={(setting) => void handleSaveExerciseRange(setting)}
        onClose={() => setEditingRangeFor(null)}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
      />
    </>
  );
}
