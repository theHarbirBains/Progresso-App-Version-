import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { BottomSheet } from '../design/BottomSheet';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { addMonths, toLocalDateKey } from '../design/calendarGrid';
import { colors } from '../design/theme';
import { ListRow } from '../design/ListRow';
import { MonthCalendar } from '../design/MonthCalendar';
import { Screen } from '../design/Screen';
import { TextInput } from '../design/TextInput';
import type { ExerciseRow } from '../exercises/exerciseQueries';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import type { MovementType } from '../exercises/movementTypes';
import { formatWeightKg, isValidWeightIncrement, roundWeight, toKg } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import { useAllTimeStats } from '../progress/AllTimeStatsProvider';
import { useProgressTheme } from '../progress/useProgressTheme';
import { AddExerciseButton } from '../workouts/AddExerciseButton';
import { CreateCustomExerciseButton } from '../workouts/CreateCustomExerciseButton';
import { DurationInput } from '../workouts/DurationInput';
import { ExercisePickerModal } from '../workouts/ExercisePickerModal';
import { PastSetRow } from '../workouts/PastSetRow';
import { PastUnilateralSetRow } from '../workouts/PastUnilateralSetRow';
import { formatCardDate } from '../workouts/workoutFormat';
import { computeDurationMinutes } from '../workouts/topSetSummary';
import {
  addExerciseToWorkout,
  createSet,
  deleteSet,
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

// No per-day meaning to mark on the date picker here, same as LogPastWorkoutScreen.
const NO_MARKED_DATES = new Set<string>();

interface DraftSet {
  localId: string;
  /** The real set id, or null for a row added during this edit and not yet persisted. */
  id: string | null;
  setIndex: number;
  side: 'left' | 'right' | null;
  weight: string;
  reps: string;
}

interface DraftExercise {
  localId: string;
  /** The real workout_exercises id, or null for an exercise added during this edit. */
  id: string | null;
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  movementType: MovementType;
  sets: DraftSet[];
}

function isValidSet(set: DraftSet): boolean {
  const weightNum = Number(set.weight);
  const repsNum = Number(set.reps);
  return (
    Number.isFinite(weightNum) &&
    weightNum > 0 &&
    isValidWeightIncrement(weightNum) &&
    Number.isInteger(repsNum) &&
    repsNum > 0
  );
}

/** Pairs a unilateral exercise's flat sets into one row per logical set (left
 * + right sharing a setIndex) -- only pairs where both sides are present
 * render, same convention LogPastWorkoutScreen/ActiveWorkoutScreen use. */
function groupUnilateralSets(
  sets: DraftSet[],
): { setIndex: number; left: DraftSet; right: DraftSet }[] {
  const bySetIndex = new Map<number, { left?: DraftSet; right?: DraftSet }>();
  for (const set of sets) {
    if (set.side !== 'left' && set.side !== 'right') continue;
    const entry = bySetIndex.get(set.setIndex) ?? {};
    entry[set.side] = set;
    bySetIndex.set(set.setIndex, entry);
  }
  const rows: { setIndex: number; left: DraftSet; right: DraftSet }[] = [];
  for (const [setIndex, { left, right }] of bySetIndex) {
    if (!left || !right) continue;
    rows.push({ setIndex, left, right });
  }
  return rows.sort((a, b) => a.setIndex - b.setIndex);
}

function dateKeyToLocalDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

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
  const { workoutId } = route.params;
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { theme, weightUnit } = useProgressTheme();
  const { refetch: refetchAllTimeStats } = useAllTimeStats();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [original, setOriginal] = useState<WorkoutDetail | null>(null);

  const [date, setDate] = useState(() => new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [calendarYear, setCalendarYear] = useState(() => date.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => date.getMonth() + 1);

  const [name, setName] = useState('');
  const [durationHours, setDurationHours] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customExerciseOpen, setCustomExerciseOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextLocalId = useRef(0);
  function newLocalId(): string {
    nextLocalId.current += 1;
    return `local-${nextLocalId.current}`;
  }

  useEffect(() => {
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
        const loadedDate = new Date(detail.performedAt);
        setDate(loadedDate);
        setCalendarYear(loadedDate.getFullYear());
        setCalendarMonth(loadedDate.getMonth() + 1);
        setExercises(
          detail.exercises.map((ex) => ({
            localId: newLocalId(),
            id: ex.id,
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            muscleGroup: ex.muscleGroup,
            movementType: ex.movementType,
            sets: ex.sets.map((s) => ({
              localId: newLocalId(),
              id: s.id,
              setIndex: s.setIndex,
              side: s.side,
              weight: s.weightKg !== null ? formatWeightKg(s.weightKg, weightUnit) : '',
              reps: s.reps !== null ? String(s.reps) : '',
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
  }, [workoutId]);

  function blankSets(movementType: MovementType, setIndex: number): DraftSet[] {
    if (movementType === 'unilateral') {
      return [
        { localId: newLocalId(), id: null, setIndex, side: 'left', weight: '', reps: '' },
        { localId: newLocalId(), id: null, setIndex, side: 'right', weight: '', reps: '' },
      ];
    }
    return [{ localId: newLocalId(), id: null, setIndex, side: null, weight: '', reps: '' }];
  }

  function handleSelectExercise(exercise: ExerciseRow) {
    setPickerOpen(false);
    setError(null);
    setExercises((prev) => [
      ...prev,
      {
        localId: newLocalId(),
        id: null,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        muscleGroup: exercise.muscleGroup,
        movementType: exercise.movementType,
        sets: blankSets(exercise.movementType, 1),
      },
    ]);
  }

  function handleAddSet(exercise: DraftExercise) {
    const nextIndex = exercise.sets.reduce((max, s) => Math.max(max, s.setIndex), 0) + 1;
    const newSets = blankSets(exercise.movementType, nextIndex);
    setExercises((prev) =>
      prev.map((ex) =>
        ex.localId === exercise.localId ? { ...ex, sets: [...ex.sets, ...newSets] } : ex,
      ),
    );
  }

  function handleRemoveSet(exerciseLocalId: string, setLocalId: string) {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.localId === exerciseLocalId
          ? { ...ex, sets: ex.sets.filter((s) => s.localId !== setLocalId) }
          : ex,
      ),
    );
  }

  function handleRemoveUnilateralSet(exerciseLocalId: string, setIndex: number) {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.localId === exerciseLocalId
          ? { ...ex, sets: ex.sets.filter((s) => s.setIndex !== setIndex) }
          : ex,
      ),
    );
  }

  function handleChangeSetField(
    exerciseLocalId: string,
    setLocalId: string,
    field: 'weight' | 'reps',
    text: string,
  ) {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.localId === exerciseLocalId
          ? {
              ...ex,
              sets: ex.sets.map((s) => (s.localId === setLocalId ? { ...s, [field]: text } : s)),
            }
          : ex,
      ),
    );
  }

  function handleRemoveExercise(exerciseLocalId: string) {
    setExercises((prev) => prev.filter((ex) => ex.localId !== exerciseLocalId));
  }

  function handlePrevMonth() {
    const next = addMonths(calendarYear, calendarMonth, -1);
    setCalendarYear(next.year);
    setCalendarMonth(next.month);
  }

  function handleNextMonth() {
    const next = addMonths(calendarYear, calendarMonth, 1);
    setCalendarYear(next.year);
    setCalendarMonth(next.month);
  }

  function handleSelectDate(dateKey: string) {
    setDate(dateKeyToLocalDate(dateKey));
    setDatePickerOpen(false);
  }

  async function handleSave() {
    if (!userId || saving || !original) return;
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Enter a name for this workout');
      return;
    }
    if (toLocalDateKey(date) > toLocalDateKey(new Date())) {
      setError("Pick a date that's already happened");
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
        const totalDurationMinutes =
          (Number(durationHours) || 0) * 60 + (Number(durationMinutes) || 0);
        const completedAtIso =
          totalDurationMinutes > 0
            ? new Date(date.getTime() + totalDurationMinutes * 60000).toISOString()
            : performedAtIso;
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

      let nextOrderIndex =
        original.exercises.reduce((max, ex) => Math.max(max, ex.orderIndex), 0) + 1;

      for (const exercise of exercises) {
        const validSets =
          exercise.movementType === 'unilateral'
            ? groupUnilateralSets(exercise.sets.filter(isValidSet)).flatMap((p) => [
                p.left,
                p.right,
              ])
            : exercise.sets.filter(isValidSet);
        if (validSets.length === 0) {
          if (exercise.id !== null) await removeExerciseFromWorkout(exercise.id);
          continue;
        }

        let workoutExerciseId = exercise.id;
        if (workoutExerciseId === null) {
          workoutExerciseId = await addExerciseToWorkout(
            workoutId,
            exercise.exerciseId,
            nextOrderIndex,
          );
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

        for (const set of validSets) {
          const weightKg = roundWeight(toKg(Number(set.weight), weightUnit));
          const reps = Math.trunc(Number(set.reps));
          if (set.id === null) {
            const created = await createSet(workoutExerciseId, set.setIndex, set.side ?? undefined);
            await updateSet(created.id, { weightKg, reps, completedAt: performedAtIso });
            continue;
          }
          const originalSet = originalSetsById.get(set.id);
          if (originalSet && originalSet.weightKg === weightKg && originalSet.reps === reps) {
            continue;
          }
          await updateSet(set.id, { weightKg, reps });
        }
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
          {error ? (
            <Text testID="edit-workout-error" style={liveWorkoutStyles.errorText}>
              {error}
            </Text>
          ) : null}

          <ListRow
            testID="edit-workout-date"
            title="Date"
            value={formatCardDate(date.toISOString())}
            onPress={() => setDatePickerOpen(true)}
            accessibilityLabel={`Date, ${formatCardDate(date.toISOString())}`}
          />

          <TextInput
            testID="edit-workout-name"
            label="Workout name"
            placeholder="e.g. Push Day"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            returnKeyType="done"
          />

          {original.completedAt !== null ? (
            <DurationInput
              testID="edit-workout-duration"
              hours={durationHours}
              minutes={durationMinutes}
              onChangeHours={setDurationHours}
              onChangeMinutes={setDurationMinutes}
            />
          ) : null}

          {exercises.map((exercise, index) => {
            const isUnilateral = exercise.movementType === 'unilateral';
            const unilateralRows = isUnilateral ? groupUnilateralSets(exercise.sets) : [];
            const hasRows = isUnilateral ? unilateralRows.length > 0 : exercise.sets.length > 0;
            return (
              <View
                key={exercise.localId}
                testID={`edit-workout-exercise-${exercise.localId}`}
                style={[
                  liveWorkoutStyles.exerciseBlock,
                  index > 0 && liveWorkoutStyles.exerciseDivider,
                ]}
              >
                <View style={liveWorkoutStyles.exerciseHeader}>
                  <View style={liveWorkoutStyles.exerciseTitleBlock}>
                    <Text style={liveWorkoutStyles.exerciseName}>{exercise.exerciseName}</Text>
                    <Text style={liveWorkoutStyles.exerciseMuscle}>
                      {MUSCLE_GROUP_LABELS[exercise.muscleGroup]}
                    </Text>
                    {isUnilateral ? (
                      <Text style={liveWorkoutStyles.perSideNote}>Weight is per side</Text>
                    ) : null}
                  </View>
                  <View style={liveWorkoutStyles.exerciseActions}>
                    <TouchableOpacity
                      testID={`edit-workout-exercise-${exercise.localId}-remove`}
                      style={liveWorkoutStyles.exerciseAction}
                      onPress={() => handleRemoveExercise(exercise.localId)}
                      accessibilityRole="button"
                      accessibilityLabel="Remove exercise"
                    >
                      <Text style={styles.removeExerciseGlyph}>×</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {hasRows ? (
                  <View style={liveWorkoutStyles.setHeaderRow}>
                    <Text style={liveWorkoutStyles.setHeaderIndex}>Set</Text>
                    <Text style={liveWorkoutStyles.setHeaderInput}>Weight</Text>
                    <Text style={liveWorkoutStyles.setHeaderInput}>Reps</Text>
                    <View style={liveWorkoutStyles.setHeaderComplete} />
                  </View>
                ) : null}

                {isUnilateral
                  ? unilateralRows.map((row) => (
                      <PastUnilateralSetRow
                        key={row.setIndex}
                        testID={`edit-workout-exercise-${exercise.localId}-set-${row.setIndex}`}
                        setIndex={row.setIndex}
                        left={row.left}
                        right={row.right}
                        onChangeWeight={(side, text) =>
                          handleChangeSetField(
                            exercise.localId,
                            side === 'left' ? row.left.localId : row.right.localId,
                            'weight',
                            text,
                          )
                        }
                        onChangeReps={(side, text) =>
                          handleChangeSetField(
                            exercise.localId,
                            side === 'left' ? row.left.localId : row.right.localId,
                            'reps',
                            text,
                          )
                        }
                        onRemove={() => handleRemoveUnilateralSet(exercise.localId, row.setIndex)}
                      />
                    ))
                  : exercise.sets.map((set) => (
                      <PastSetRow
                        key={set.localId}
                        testID={`edit-workout-exercise-${exercise.localId}-set-${set.setIndex}`}
                        setIndex={set.setIndex}
                        weight={set.weight}
                        reps={set.reps}
                        onChangeWeight={(text) =>
                          handleChangeSetField(exercise.localId, set.localId, 'weight', text)
                        }
                        onChangeReps={(text) =>
                          handleChangeSetField(exercise.localId, set.localId, 'reps', text)
                        }
                        onRemove={() => handleRemoveSet(exercise.localId, set.localId)}
                      />
                    ))}

                <View style={liveWorkoutStyles.addSet}>
                  <SecondaryButton
                    testID={`edit-workout-exercise-${exercise.localId}-add-set`}
                    size="md"
                    label="+ Add Set"
                    accessibilityLabel="Add Set"
                    onPress={() => handleAddSet(exercise)}
                  />
                </View>
              </View>
            );
          })}

          <View style={liveWorkoutStyles.endActions}>
            <AddExerciseButton
              testID="edit-workout-add-exercise"
              onPress={() => setPickerOpen(true)}
            />
            <CreateCustomExerciseButton
              testID="edit-workout-create-custom"
              onPress={() => setCustomExerciseOpen(true)}
            />
          </View>
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

      <BottomSheet
        visible={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        testID="edit-workout-date-sheet"
      >
        <MonthCalendar
          testID="edit-workout-calendar"
          year={calendarYear}
          month={calendarMonth}
          markedDateKeys={NO_MARKED_DATES}
          markedDescription=""
          selectedDateKey={toLocalDateKey(date)}
          todayKey={toLocalDateKey(new Date())}
          accentColor={theme.accent}
          onAccentColor={theme.onAccent}
          onSelectDate={handleSelectDate}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
        />
      </BottomSheet>
    </>
  );
}
