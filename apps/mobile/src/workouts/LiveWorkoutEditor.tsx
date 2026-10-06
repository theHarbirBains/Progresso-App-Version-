import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SecondaryButton, TextButton } from '../design/Button';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors, spacing, typeScale } from '../design/theme';
import type { ExerciseRow } from '../exercises/exerciseQueries';
import { formatWeightKg, roundWeight, toKg } from '../lib/units';
import { useProgressTheme } from '../progress/useProgressTheme';
import { ExercisePickerModal } from './ExercisePickerModal';
import {
  addExerciseToWorkout,
  createSet,
  deleteSet,
  fetchWorkoutDetail,
  removeExerciseFromWorkout,
  updateSet,
  type SetRecord,
  type WorkoutDetail,
  type WorkoutExerciseWithSets,
} from './workoutQueries';

interface Props {
  workoutId: string;
  /** Whose exercise library the picker lists: the signed-in person. */
  userId: string;
  /**
   * Turns a picked exercise into the one this workout should use. A trainer's live
   * session needs the client's copy of the trainer's own exercises.
   */
  resolveExerciseId?: (exerciseId: string) => Promise<string>;
  accentColor?: string;
  onAccentColor?: string;
  testID?: string;
}

/**
 * One workout's exercises and sets, editable by whoever the database lets edit it.
 * Group members and a trainer running a live session both use it. Every change goes
 * through the existing workout queries and then reloads, so each row shows what is
 * saved rather than what was typed.
 */
export function LiveWorkoutEditor({
  workoutId,
  userId,
  resolveExerciseId,
  accentColor = colors.accent,
  onAccentColor = colors.onAccent,
  testID = 'live-workout-editor',
}: Props) {
  const { weightUnit } = useProgressTheme();
  const [detail, setDetail] = useState<WorkoutDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail(await fetchWorkoutDetail(workoutId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this workout');
    }
  }, [workoutId]);

  useEffect(() => {
    void load();
  }, [load]);

  // One change, then a reload so every row shows what is saved.
  async function change(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That change did not save');
    }
  }

  async function addExercise(exercise: ExerciseRow) {
    setPickerOpen(false);
    await change(async () => {
      const exerciseId = resolveExerciseId ? await resolveExerciseId(exercise.id) : exercise.id;
      const order =
        (detail?.exercises.reduce((max, ex) => Math.max(max, ex.orderIndex), 0) ?? 0) + 1;
      await addExerciseToWorkout(workoutId, exerciseId, order);
    });
  }

  if (!detail) {
    return (
      <View testID={testID} style={styles.root}>
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <Text style={styles.muted}>Loading…</Text>
        )}
      </View>
    );
  }

  return (
    <View testID={testID} style={styles.root}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {detail.exercises.length === 0 ? <Text style={styles.muted}>No exercises yet</Text> : null}

      {detail.exercises.map((exercise) => (
        <ExerciseBlock
          key={exercise.id}
          exercise={exercise}
          testID={testID}
          weightUnit={weightUnit}
          onChange={change}
        />
      ))}

      <SecondaryButton
        testID={`${testID}-add-exercise`}
        label="Add Exercise"
        onPress={() => setPickerOpen(true)}
      />

      <ExercisePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(exercise) => void addExercise(exercise)}
        userId={userId}
        alreadyAddedIds={detail.exercises.map((ex) => ex.exerciseId)}
        onCreateCustom={() => setPickerOpen(false)}
        accentColor={accentColor}
        onAccentColor={onAccentColor}
      />
    </View>
  );
}

interface ExerciseBlockProps {
  exercise: WorkoutExerciseWithSets;
  testID: string;
  weightUnit: 'kg' | 'lb';
  onChange: (action: () => Promise<unknown>) => Promise<void>;
}

function ExerciseBlock({ exercise, testID, weightUnit, onChange }: ExerciseBlockProps) {
  const nextSetIndex = exercise.sets.reduce((max, set) => Math.max(max, set.setIndex), 0) + 1;
  return (
    <View style={styles.exercise} testID={`${testID}-exercise-${exercise.id}`}>
      <View style={styles.exerciseHeader}>
        <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
        <TextButton
          testID={`${testID}-remove-exercise-${exercise.id}`}
          label="Remove"
          destructive
          onPress={() => void onChange(() => removeExerciseFromWorkout(exercise.id))}
        />
      </View>

      {exercise.sets.map((set) => (
        <SetRowEditor
          key={set.id}
          set={set}
          testID={testID}
          weightUnit={weightUnit}
          onSave={(updates) => onChange(() => updateSet(set.id, updates))}
          onToggleDone={(done) =>
            onChange(() =>
              updateSet(set.id, { completedAt: done ? new Date().toISOString() : null }),
            )
          }
          onRemove={() => onChange(() => deleteSet(set.id))}
        />
      ))}

      <SecondaryButton
        testID={`${testID}-add-set-${exercise.id}`}
        label="Add Set"
        onPress={() => void onChange(() => createSet(exercise.id, nextSetIndex))}
      />
    </View>
  );
}

interface SetRowEditorProps {
  set: SetRecord;
  testID: string;
  weightUnit: 'kg' | 'lb';
  onSave: (updates: { weightKg?: number; reps?: number }) => Promise<void>;
  onToggleDone: (done: boolean) => Promise<void>;
  onRemove: () => Promise<void>;
}

/** A set's weight and reps save when the field loses focus, so typing never waits on the network. */
function SetRowEditor({
  set,
  testID,
  weightUnit,
  onSave,
  onToggleDone,
  onRemove,
}: SetRowEditorProps) {
  const [weight, setWeight] = useState(
    set.weightKg === null ? '' : formatWeightKg(set.weightKg, weightUnit),
  );
  const [reps, setReps] = useState(set.reps === null ? '' : String(set.reps));
  const done = set.completedAt !== null;

  function save() {
    const updates: { weightKg?: number; reps?: number } = {};
    const weightValue = Number(weight);
    if (weight.trim() !== '' && Number.isFinite(weightValue) && weightValue > 0) {
      updates.weightKg = roundWeight(toKg(weightValue, weightUnit));
    }
    const repsValue = Number(reps);
    if (reps.trim() !== '' && Number.isInteger(repsValue) && repsValue > 0) {
      updates.reps = repsValue;
    }
    if (Object.keys(updates).length > 0) void onSave(updates);
  }

  return (
    <View style={styles.setRow} testID={`${testID}-set-${set.id}`}>
      <Text style={styles.setIndex}>
        {set.setIndex}
        {set.side === 'left' ? ' L' : set.side === 'right' ? ' R' : ''}
      </Text>
      <View style={styles.setField}>
        <TextInput
          testID={`${testID}-set-${set.id}-weight`}
          accessibilityLabel={`Set ${set.setIndex} weight`}
          value={weight}
          onChangeText={setWeight}
          onBlur={save}
          keyboardType="decimal-pad"
          placeholder={weightUnit}
        />
      </View>
      <View style={styles.setField}>
        <TextInput
          testID={`${testID}-set-${set.id}-reps`}
          accessibilityLabel={`Set ${set.setIndex} reps`}
          value={reps}
          onChangeText={setReps}
          onBlur={save}
          keyboardType="number-pad"
          placeholder="reps"
        />
      </View>
      <TextButton
        testID={`${testID}-set-${set.id}-done`}
        label={done ? 'Undo' : 'Done'}
        onPress={() => void onToggleDone(!done)}
      />
      <TextButton
        testID={`${testID}-set-${set.id}-remove`}
        label="Remove"
        destructive
        onPress={() => void onRemove()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.md,
  },
  exercise: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseName: {
    ...typeScale.label,
    color: colors.textPrimary,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  setIndex: {
    width: 32,
    ...typeScale.caption,
    color: colors.textMuted,
  },
  setField: {
    flex: 1,
  },
  error: {
    ...typeScale.secondary,
    color: colors.destructive,
  },
  muted: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
});
