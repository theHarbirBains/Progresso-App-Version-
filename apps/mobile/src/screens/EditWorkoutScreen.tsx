import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { resolveClientExercise } from '../lib/api';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, TextButton } from '../design/Button';
import { colors } from '../design/theme';
import { Screen } from '../design/Screen';
import { RiseInStack } from '../design/RiseIn';
import type { ExerciseRow } from '../exercises/exerciseQueries';
import { measurementTypeOf } from '../exercises/movementTypes';
import { draftFromSet, draftValues } from '../workouts/setInputDrafts';
import type { RootStackScreenProps } from '../navigation/types';
import { useAllTimeStats } from '../progress/AllTimeStatsProvider';
import { useProgressTheme } from '../progress/useProgressTheme';
import { ExercisePickerModal } from '../workouts/ExercisePickerModal';
import {
  PastExerciseCard,
  PastWorkoutAddCard,
  PastWorkoutDateSheet,
  PastWorkoutDetailsCard,
} from '../workouts/PastWorkoutForm';
import {
  completedAtFor,
  detailsProblem,
  setsToSave,
  usePastWorkoutDate,
  usePastWorkoutDraft,
} from '../workouts/pastWorkoutDraft';
import { computeDurationMinutes } from '../workouts/topSetSummary';
import {
  addExerciseToWorkout,
  fetchNextExerciseOrderIndex,
  createCompletedSets,
  deleteSet,
  deleteWorkout,
  fetchWorkoutDetail,
  removeExerciseFromWorkout,
  updateSet,
  updateWorkout,
  type WorkoutDetail,
} from '../workouts/workoutQueries';
import { ExerciseFormScreen } from './ExerciseFormScreen';
import { liveWorkoutStyles } from './liveWorkoutStyles';
import { logPastWorkoutStyles as styles } from './logPastWorkoutStyles';

type Props = RootStackScreenProps<'EditWorkout'>;

/**
 * Edits every part of an already-logged workout: its name, its date, which
 * exercises it has, and each set's weight/reps -- nothing here is
 * provisional/in-progress the way ActiveWorkoutScreen's live tracking is, so
 * there's no "mark complete" step (every set is already something that
 * happened; PastSetRow/PastUnilateralSetRow, not ExerciseCard/SetRow, match
 * that). Unlike LogPastWorkoutScreen (which creates a brand new workout from
 * nothing, all at once, on "Save Workout"), this loads the real existing
 * rows first and diffs the draft against them on "Save Changes" -- updating
 * what changed, creating what's new, and soft-deleting what was removed,
 * rather than recreating the whole workout. Reordering exercises isn't
 * supported here (not asked for, and WorkoutDetailScreen's own list is the
 * read-only view of the result anyway).
 *
 * Changing the date is safe to do after the fact: the DB's own
 * workouts_recompute_prs trigger (see workoutQueries.updateWorkout) re-derives
 * every PR/1RM a moved workout's sets touch -- this screen never computes or
 * assumes PR state itself.
 */
export function EditWorkoutScreen({ navigation, route }: Props) {
  const { workoutId, clientId } = route.params;
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const { theme, weightUnit, themeLoading } = useProgressTheme();
  const { refetch: refetchAllTimeStats } = useAllTimeStats();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [original, setOriginal] = useState<WorkoutDetail | null>(null);

  const when = usePastWorkoutDate();
  const { date } = when;
  const [name, setName] = useState('');
  const [durationHours, setDurationHours] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const draft = usePastWorkoutDraft();
  const { exercises, newLocalId } = draft;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customExerciseOpen, setCustomExerciseOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for the weight unit to be known before seeding the editable text --
    // otherwise a user whose profile hasn't loaded yet gets their weights
    // written in the fallback unit, and they're never re-seeded.
    if (themeLoading) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const detail = await fetchWorkoutDetail(workoutId);
        if (cancelled) return;
        setOriginal(detail);
        setName(detail.name);
        const loadedDuration = computeDurationMinutes(detail.performedAt, detail.completedAt);
        if (loadedDuration !== null) {
          setDurationHours(String(Math.floor(loadedDuration / 60)));
          setDurationMinutes(String(loadedDuration % 60));
        }
        when.show(new Date(detail.performedAt));
        draft.setExercises(
          detail.exercises.map((ex) => ({
            localId: newLocalId(),
            id: ex.id,
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            muscleGroup: ex.muscleGroup,
            movementType: ex.movementType,
            measurementType: measurementTypeOf(ex),
            sets: ex.sets.map((s) => ({
              localId: newLocalId(),
              id: s.id,
              setIndex: s.setIndex,
              side: s.side,
              duration: '',
              ...draftFromSet(s, measurementTypeOf(ex), weightUnit),
            })),
          })),
        );
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load workout');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // weightUnit is only read once, at load, to seed the editable text --
    // re-running this on a later unit-preference change would stomp on
    // whatever the user has already typed this session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId, themeLoading]);

  function handleSelectExercise(exercise: ExerciseRow) {
    setPickerOpen(false);
    setError(null);
    draft.addExercise(exercise);
  }

  // A trainer removes a client's workout. It is cancelled, never logged, and the client's history drops it.
  function confirmDeleteWorkout() {
    Alert.alert(
      'Delete this workout?',
      'It will be removed from the client’s history. This cannot be undone.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteWorkout(workoutId)
              .then(() => navigation.goBack())
              .catch((err: unknown) =>
                setError(err instanceof Error ? err.message : 'Could not delete the workout'),
              );
          },
        },
      ],
    );
  }

  async function handleSave() {
    if (!userId || saving || !original) return;
    setError(null);

    const trimmedName = name.trim();
    const problem = detailsProblem(name, date);
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    try {
      const performedAtIso = date.toISOString();
      if (original.completedAt !== null) {
        // completedAt is always recomputed from the date plus the duration
        // together, so moving the date never silently skews a duration.
        // With no duration entered it goes back to equal performedAt --
        // the same "unknown duration" marker createLoggedWorkout uses.
        const completedAtIso =
          completedAtFor(date, durationHours, durationMinutes) ?? performedAtIso;
        if (
          trimmedName !== original.name ||
          performedAtIso !== original.performedAt ||
          completedAtIso !== original.completedAt
        ) {
          await updateWorkout(workoutId, {
            name: trimmedName,
            performedAt: performedAtIso,
            completedAt: completedAtIso,
          });
        }
      } else if (trimmedName !== original.name || performedAtIso !== original.performedAt) {
        // An unfinished workout has no duration to set -- never complete it here.
        await updateWorkout(workoutId, { name: trimmedName, performedAt: performedAtIso });
      }

      const originalExerciseIds = new Set(original.exercises.map((ex) => ex.id));
      const keptExerciseIds = new Set(
        exercises.filter((ex) => ex.id !== null).map((ex) => ex.id as string),
      );
      for (const originalExerciseId of originalExerciseIds) {
        if (!keptExerciseIds.has(originalExerciseId)) {
          await removeExerciseFromWorkout(originalExerciseId);
        }
      }

      const originalSetsById = new Map(
        original.exercises.flatMap((ex) => ex.sets.map((s) => [s.id, s] as const)),
      );

      // Starts from every order index this workout has ever used, not just the visible
      // exercises -- a removed one still holds its slot (see fetchNextExerciseOrderIndex).
      let nextOrderIndex = await fetchNextExerciseOrderIndex(workoutId);

      for (const exercise of exercises) {
        const type = exercise.measurementType;
        const validSets = setsToSave(exercise);
        if (validSets.length === 0) {
          if (exercise.id !== null) await removeExerciseFromWorkout(exercise.id);
          continue;
        }

        let workoutExerciseId = exercise.id;
        if (workoutExerciseId === null) {
          // A trainer editing a client's workout adds the client's copy of the exercise.
          const exerciseId =
            clientId && session?.access_token
              ? (await resolveClientExercise(session.access_token, clientId, exercise.exerciseId))
                  .exerciseId
              : exercise.exerciseId;
          workoutExerciseId = await addExerciseToWorkout(workoutId, exerciseId, nextOrderIndex);
          nextOrderIndex += 1;
        }

        const keptSetIds = new Set(validSets.filter((s) => s.id !== null).map((s) => s.id));
        const originalSetIdsForExercise =
          exercise.id !== null
            ? (original.exercises.find((ex) => ex.id === exercise.id)?.sets.map((s) => s.id) ?? [])
            : [];
        for (const originalSetId of originalSetIdsForExercise) {
          if (!keptSetIds.has(originalSetId)) await deleteSet(originalSetId);
        }

        // Sets added here are saved together, once the changed ones are.
        const added: Parameters<typeof createCompletedSets>[1] = [];
        for (const set of validSets) {
          const values = draftValues(set, type, weightUnit);
          if (set.id === null) {
            added.push({ setIndex: set.setIndex, side: set.side, ...values });
            continue;
          }
          const originalSet = originalSetsById.get(set.id);
          // A set left blank or un-ticked in the live workout is part of the workout once
          // it's saved here, so it's completed too -- otherwise it would stay out of the
          // workout's history and PRs while showing on this screen.
          const wasCompleted = originalSet?.completedAt != null;
          if (
            originalSet &&
            wasCompleted &&
            originalSet.weightKg === values.weightKg &&
            originalSet.reps === values.reps &&
            (originalSet.durationSeconds ?? null) === values.durationSeconds
          ) {
            continue;
          }
          await updateSet(
            set.id,
            wasCompleted ? values : { ...values, completedAt: performedAtIso },
          );
        }
        if (added.length > 0) await createCompletedSets(workoutExerciseId, added, performedAtIso);
      }

      void refetchAllTimeStats();
      navigation.replace('WorkoutDetail', { workoutId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
      setSaving(false);
    }
  }

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

  if (loading) {
    return (
      <Screen
        scroll={false}
        header={<AppHeader title="Edit Workout" onBack={() => navigation.goBack()} />}
      >
        <View style={liveWorkoutStyles.emptyWrap}>
          <ActivityIndicator
            testID="edit-workout-loading"
            size="large"
            color={colors.textPrimary}
          />
        </View>
      </Screen>
    );
  }

  if (loadError || !original) {
    return (
      <Screen
        scroll={false}
        header={<AppHeader title="Edit Workout" onBack={() => navigation.goBack()} />}
      >
        <Text testID="edit-workout-load-error" style={liveWorkoutStyles.errorText}>
          {loadError}
        </Text>
      </Screen>
    );
  }

  return (
    <>
      <Screen
        scroll={false}
        padded={false}
        keyboardAvoiding
        // Its widgets roll out from inside the list (RiseInStack), so the list doesn't also rise.
        rollout={false}
        header={
          <AppHeader
            testID="edit-workout-header"
            title="Edit Workout"
            onBack={() => navigation.goBack()}
          />
        }
      >
        <ScrollView
          style={liveWorkoutStyles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <RiseInStack>
            {error ? (
              <Text testID="edit-workout-error" style={liveWorkoutStyles.errorText}>
                {error}
              </Text>
            ) : null}

            <PastWorkoutDetailsCard
              testID="edit-workout"
              when={when}
              name={name}
              onChangeName={setName}
              duration={
                original.completedAt !== null
                  ? {
                      hours: durationHours,
                      minutes: durationMinutes,
                      onChangeHours: setDurationHours,
                      onChangeMinutes: setDurationMinutes,
                    }
                  : undefined
              }
            />

            {exercises.map((exercise) => (
              <PastExerciseCard
                key={exercise.localId}
                testID="edit-workout"
                exercise={exercise}
                draft={draft}
              />
            ))}

            <PastWorkoutAddCard
              testID="edit-workout"
              onAddExercise={() => setPickerOpen(true)}
              onCreateCustom={() => setCustomExerciseOpen(true)}
            />
          </RiseInStack>
        </ScrollView>

        <View style={liveWorkoutStyles.footer}>
          <PrimaryButton
            testID="edit-workout-save"
            label={saving ? 'Saving…' : 'Save Changes'}
            onPress={handleSave}
            disabled={saving}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />
          {clientId ? (
            <TextButton
              testID="edit-workout-delete"
              label="Delete Workout"
              destructive
              onPress={confirmDeleteWorkout}
            />
          ) : null}
        </View>
      </Screen>

      <ExercisePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelectExercise}
        userId={userId}
        alreadyAddedIds={exercises.map((ex) => ex.exerciseId)}
        onCreateCustom={() => {
          setPickerOpen(false);
          setCustomExerciseOpen(true);
        }}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
      />

      <PastWorkoutDateSheet
        testID="edit-workout"
        when={when}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
      />
    </>
  );
}
