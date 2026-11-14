import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet } from '../design/BottomSheet';
import { PrimaryButton, TextButton } from '../design/Button';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors, spacing, typeScale } from '../design/theme';
import { machineLine } from '../exercises/machineDetails';
import { formatWeight, fromKg, roundWeight } from '../lib/units';
import { draftValues, isValidDraft } from '../workouts/setInputDrafts';
import { updateSet } from '../workouts/workoutQueries';

/** The set behind a top set: the one logged in a workout, which an edit changes. */
export interface TopSetToEdit {
  setId: string;
  exerciseName: string;
  /** Its exercise's gym and handle, when it has them: which machine the set was on. */
  gym?: string | null;
  attachment?: string | null;
  performedAt: string;
  weightKg: number;
  reps: number;
}

/** The weight as the sheet first shows it, in the page's unit. */
function shownWeight(target: TopSetToEdit, unit: 'kg' | 'lb'): string {
  return formatWeight(roundWeight(fromKg(target.weightKg, unit)));
}

interface Props {
  /** The top set being edited; null keeps the sheet closed. */
  target: TopSetToEdit | null;
  weightUnit: 'kg' | 'lb';
  accentColor: string;
  onAccentColor: string;
  onClose: () => void;
  /** Called once the set is saved, for the screen to read its figures again. */
  onSaved: () => void;
}

/**
 * Fixes a top set logged wrong: its weight and reps, saved to the set itself in the workout it
 * was logged in -- so the workout, its PRs and every figure built on it follow (the PR triggers
 * work them out again). A trainer editing a client's top set saves it the same way, under their
 * link, and the change is recorded for the client like any other trainer edit.
 */
export function EditTopSetSheet({
  target,
  weightUnit,
  accentColor,
  onAccentColor,
  onClose,
  onSaved,
}: Props) {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Each time a top set is opened, its fields start at what was logged.
  useEffect(() => {
    if (!target) return;
    setWeight(shownWeight(target, weightUnit));
    setReps(String(target.reps));
    setError(null);
  }, [target, weightUnit]);

  async function handleSave() {
    if (!target || saving) return;
    const draft = { weight, reps };
    if (!isValidDraft(draft, 'weight_reps')) {
      setError('Enter a weight (in steps of 0.25) and a rep count.');
      return;
    }
    const values = draftValues(draft, 'weight_reps', weightUnit);
    // A weight left as shown keeps exactly what was logged: shown in the other unit, it's
    // rounded, and saving the rounded figure back would nudge the set (100 kg as 220.5 lb is
    // 100.02 kg).
    const weightKg = weight === shownWeight(target, weightUnit) ? target.weightKg : values.weightKg;
    setError(null);
    setSaving(true);
    try {
      await updateSet(target.setId, { weightKg, reps: values.reps });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That set did not save');
    } finally {
      setSaving(false);
    }
  }

  const date = target
    ? new Date(target.performedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <BottomSheet visible={target !== null} onClose={onClose} testID="edit-top-set-sheet">
      <View style={styles.content}>
        <Text style={styles.title}>Edit Top Set</Text>
        <Text testID="edit-top-set-summary" style={styles.summary}>
          {target ? `${machineLine(target, target.exerciseName)}, ${date}` : ''}
        </Text>
        <Text style={styles.summary}>
          Logged it wrong? Fix it here. It changes the set in that workout, and your records update
          to match.
        </Text>
        <View style={styles.fields}>
          <View style={styles.field}>
            <TextInput
              testID="edit-top-set-weight"
              label={`Weight (${weightUnit})`}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              accessibilityLabel={`Weight in ${weightUnit}`}
            />
          </View>
          <View style={styles.field}>
            <TextInput
              testID="edit-top-set-reps"
              label="Reps"
              value={reps}
              onChangeText={setReps}
              keyboardType="number-pad"
              accessibilityLabel="Reps"
            />
          </View>
        </View>
        {error ? (
          <Text testID="edit-top-set-error" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <PrimaryButton
          testID="edit-top-set-save"
          label="Save"
          onPress={() => void handleSave()}
          loading={saving}
          accentColor={accentColor}
          onAccentColor={onAccentColor}
        />
        <TextButton testID="edit-top-set-cancel" label="Cancel" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  title: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  summary: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  fields: {
    flexDirection: 'row',
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  field: {
    flex: 1,
  },
  error: {
    ...typeScale.callout,
    color: colors.destructive,
  },
});
