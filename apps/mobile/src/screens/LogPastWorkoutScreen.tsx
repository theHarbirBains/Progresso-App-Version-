import { useRef, useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { BottomSheet } from '../design/BottomSheet';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { addMonths, toLocalDateKey } from '../design/calendarGrid';
import { ListRow } from '../design/ListRow';
import { MonthCalendar } from '../design/MonthCalendar';
import { Screen } from '../design/Screen';
import { TextInput } from '../design/TextInput';
import type { ExerciseRow } from '../exercises/exerciseQueries';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import type { MovementType } from '../exercises/movementTypes';
import { isValidWeightIncrement, roundWeight, toKg } from '../lib/units';
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
import {
  addExerciseToWorkout,
  createLoggedWorkout,
  createSet,
  updateSet,
} from '../workouts/workoutQueries';
import { ExerciseFormScreen } from './ExerciseFormScreen';
import { liveWorkoutStyles } from './liveWorkoutStyles';
import { logPastWorkoutStyles as styles } from './logPastWorkoutStyles';

type Props = RootStackScreenProps<'LogPastWorkout'>;

// The date picker has nothing to mark -- there's no per-day dot/meaning
// here the way Workout History's own calendar has completed-workout dots.
const NO_MARKED_DATES = new Set<string>();

interface DraftSet {
  localId: string;
  setIndex: number;
  side: 'left' | 'right' | null;
  weight: string;
  reps: string;
}

interface DraftExercise {
  localId: string;
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
 * render, same convention ActiveWorkoutScreen's own grouping uses. */
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

/** Drops any set that was never actually filled in, and any exercise left
 * with none -- a manual log is filled in one sitting, so a stray blank "Set
 * 3" row is just something the user didn't get to, not an error. */
function exercisesToSave(source: DraftExercise[]): DraftExercise[] {
  return source
    .map((ex) => {
      if (ex.movementType === 'unilateral') {
        const pairs = groupUnilateralSets(ex.sets.filter(isValidSet));
        return { ...ex, sets: pairs.flatMap((p) => [p.left, p.right]) };
      }
      return { ...ex, sets: ex.sets.filter(isValidSet) };
    })
    .filter((ex) => ex.sets.length > 0);
}

function dateKeyToLocalDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  // Noon, not midnight -- keeps this comfortably clear of any local
  // timezone's day boundary. completedAt is derived from this same instant
  // plus whatever duration is entered below (see handleSave) -- when no
  // duration is given, createLoggedWorkout's own default (completedAt =
  // performedAt) means computeDurationMinutes sees performedAt ===
  // completedAt and honestly reports "--" rather than a fabricated duration.
  return new Date(year, month - 1, day, 12, 0, 0);
}

/**
 * A workout that already happened, logged after the fact: pick a date, name
 * it, add exercises and their sets directly -- no live timer, no in-progress
 * state, nothing persisted until "Save Workout". This is deliberately a
 * different data model from ActiveWorkoutScreen's live tracking (which
 * persists every add/complete immediately against a real in-progress
 * workout row): here nothing touches the database until the very end, so
 * backing out of this screen at any point leaves no trace. Reuses
 * ExercisePickerModal/ExerciseFormScreen for exercise selection (identical
 * to the live flow) but not ExerciseCard/SetRow -- those are built around a
 * completed/incomplete distinction that doesn't apply when every row typed
 * in already represents something done; see PastSetRow's own comment.
 */
export function LogPastWorkoutScreen({ navigation }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { theme, weightUnit } = useProgressTheme();
  const { refetch: refetchAllTimeStats } = useAllTimeStats();

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

  function blankSets(movementType: MovementType, setIndex: number): DraftSet[] {
    if (movementType === 'unilateral') {
      return [
        { localId: newLocalId(), setIndex, side: 'left', weight: '', reps: '' },
        { localId: newLocalId(), setIndex, side: 'right', weight: '', reps: '' },
      ];
    }
    return [{ localId: newLocalId(), setIndex, side: null, weight: '', reps: '' }];
  }

  function handleSelectExercise(exercise: ExerciseRow) {
    setPickerOpen(false);
    setError(null);
    setExercises((prev) => [
      ...prev,
      {
        localId: newLocalId(),
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
    if (!userId || saving) return;
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
    const toSave = exercisesToSave(exercises);
    if (toSave.length === 0) {
      setError('Add at least one exercise with a weight and rep count');
      return;
    }

    setSaving(true);
    try {
      const performedAtIso = date.toISOString();
      const totalDurationMinutes =
        (Number(durationHours) || 0) * 60 + (Number(durationMinutes) || 0);
      // Omit entirely (rather than pass 0) when no duration was entered --
      // createLoggedWorkout's own default (completedAt = performedAt) is
      // what makes every existing duration readout show "--" instead of a
      // fabricated "0 min".
      const completedAtIso =
        totalDurationMinutes > 0
          ? new Date(date.getTime() + totalDurationMinutes * 60000).toISOString()
          : undefined;
      const workout = await createLoggedWorkout(
        userId,
        trimmedName,
        performedAtIso,
        completedAtIso,
      );

      let orderIndex = 1;
      for (const ex of toSave) {
        const workoutExerciseId = await addExerciseToWorkout(workout.id, ex.exerciseId, orderIndex);
        orderIndex += 1;
        for (const set of ex.sets) {
          const created = await createSet(workoutExerciseId, set.setIndex, set.side ?? undefined);
          await updateSet(created.id, {
            weightKg: roundWeight(toKg(Number(set.weight), weightUnit)),
            reps: Math.trunc(Number(set.reps)),
            completedAt: performedAtIso,
          });
        }
      }

      void refetchAllTimeStats();
      navigation.replace('WorkoutDetail', { workoutId: workout.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workout');
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

  return (
    <>
      <Screen
        scroll={false}
        padded={false}
        keyboardAvoiding
        header={
          <AppHeader
            testID="log-past-workout-header"
            title="Log a Past Workout"
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
            <Text testID="log-past-workout-error" style={liveWorkoutStyles.errorText}>
              {error}
            </Text>
          ) : null}

          <ListRow
            testID="log-past-workout-date"
            title="Date"
            value={formatCardDate(date.toISOString())}
            onPress={() => setDatePickerOpen(true)}
            accessibilityLabel={`Date, ${formatCardDate(date.toISOString())}`}
          />

          <TextInput
            testID="log-past-workout-name"
            label="Workout name"
            placeholder="e.g. Push Day"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            returnKeyType="done"
          />

          <DurationInput
            testID="log-past-workout-duration"
            hours={durationHours}
            minutes={durationMinutes}
            onChangeHours={setDurationHours}
            onChangeMinutes={setDurationMinutes}
          />

          {exercises.map((exercise, index) => {
            const isUnilateral = exercise.movementType === 'unilateral';
            const unilateralRows = isUnilateral ? groupUnilateralSets(exercise.sets) : [];
            const hasRows = isUnilateral ? unilateralRows.length > 0 : exercise.sets.length > 0;
            return (
              <View
                key={exercise.localId}
                testID={`log-past-workout-exercise-${exercise.localId}`}
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
                      testID={`log-past-workout-exercise-${exercise.localId}-remove`}
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
                        testID={`log-past-workout-exercise-${exercise.localId}-set-${row.setIndex}`}
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
                        testID={`log-past-workout-exercise-${exercise.localId}-set-${set.setIndex}`}
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
                    testID={`log-past-workout-exercise-${exercise.localId}-add-set`}
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
              testID="log-past-workout-add-exercise"
              onPress={() => setPickerOpen(true)}
            />
            <CreateCustomExerciseButton
              testID="log-past-workout-create-custom"
              onPress={() => setCustomExerciseOpen(true)}
            />
          </View>
        </ScrollView>

        <View style={liveWorkoutStyles.footer}>
          <PrimaryButton
            testID="log-past-workout-save"
            label={saving ? 'Saving…' : 'Save Workout'}
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
        testID="log-past-workout-date-sheet"
      >
        <MonthCalendar
          testID="log-past-workout-calendar"
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
