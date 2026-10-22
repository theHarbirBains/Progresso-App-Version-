import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { SecondaryButton, TextButton } from '../design/Button';
import { ListRow } from '../design/ListRow';
import { Section } from '../design/Section';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';
import type { MeasurementType } from '../exercises/movementTypes';
import { formatWeightKg } from '../lib/units';
import { ExercisePickerModal } from './ExercisePickerModal';
import { ExerciseProgressionSheet } from './ExerciseProgressionSheet';
import { formatRepRange, type RepRange } from './progression';

/** One exercise trained outside the range: its own range and/or weight step. */
export interface RangeException {
  exerciseId: string;
  exerciseName: string;
  measurementType: MeasurementType;
  range: RepRange | null;
  incrementKg: number | null;
}

export interface ExceptionSetting {
  range: RepRange | null;
  incrementKg: number | null;
}

interface Props {
  /** The range every exercise without an exception follows. */
  range: RepRange;
  /** Whose ranges these are: the person's own, or a client's (for their trainer). */
  owner: 'self' | 'client';
  exceptions: RangeException[];
  weightUnit: 'kg' | 'lb';
  /** Whose exercise library the picker shows -- always the signed-in person's. */
  pickerUserId: string;
  onEditRange: () => void;
  /** Saves an exercise's exception; with neither a range nor a step, it's removed. */
  onSave: (
    exercise: Pick<RangeException, 'exerciseId' | 'exerciseName' | 'measurementType'>,
    setting: ExceptionSetting,
  ) => Promise<void>;
  accentColor: string;
  onAccentColor: string;
  testIDPrefix?: string;
}

interface Editing {
  exercise: Pick<RangeException, 'exerciseId' | 'exerciseName' | 'measurementType'>;
  /** What the sheet opens on, fixed when it opens (the sheet resets whenever this changes). */
  current: ExceptionSetting;
}

function describe(exception: RangeException, unit: 'kg' | 'lb'): string {
  return [
    exception.range ? `Range ${formatRepRange(exception.range)}` : null,
    exception.incrementKg !== null
      ? `Goes up ${formatWeightKg(exception.incrementKg, unit)} ${unit}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * A rep range and its exceptions, as two widgets: the range every exercise follows (with Edit),
 * then the exercises trained outside it -- each with its own range and/or weight step, opening
 * its sheet to change it, with Remove to put it back on the range -- and Add an Exception, which
 * picks an exercise and opens it on "Its Own". The person's own (Settings > Workout Preferences >
 * Rep Range Exceptions) and a trainer's for a client use the same widgets; only where they save
 * differs. A timed exercise has no range, so it can't be one.
 */
export function RepRangeExceptions({
  range,
  owner,
  exceptions,
  weightUnit,
  pickerUserId,
  onEditRange,
  onSave,
  accentColor,
  onAccentColor,
  testIDPrefix = 'rep-ranges',
}: Props) {
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const yours = owner === 'self';

  function open(exception: RangeException) {
    setError(null);
    setEditing({
      exercise: exception,
      current: { range: exception.range, incrementKg: exception.incrementKg },
    });
  }

  async function save(
    exercise: Editing['exercise'],
    setting: ExceptionSetting,
    close: () => void,
  ): Promise<void> {
    setError(null);
    setSaving(true);
    try {
      await onSave(exercise, setting);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the exception');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Section title="Rep Range" testID={`${testIDPrefix}-range`}>
        <ListRow
          testID={`${testIDPrefix}-range-row`}
          icon="repeat"
          title={yours ? 'Your rep range' : 'Their rep range'}
          subtitle="Every exercise without an exception"
          value={formatRepRange(range)}
          onPress={onEditRange}
          chevron
        />
      </Section>

      <Section title="Exceptions" testID={`${testIDPrefix}-exceptions`}>
        <Text style={styles.help}>
          {yours
            ? 'Exercises you train outside your range, or that go up by their own weight step.'
            : 'Exercises they train outside their range, or that go up by their own weight step.'}
        </Text>
        {exceptions.length === 0 ? (
          <Text testID={`${testIDPrefix}-empty`} style={styles.empty}>
            No exceptions yet: every exercise follows {formatRepRange(range)}.
          </Text>
        ) : (
          exceptions.map((exception, index) => (
            <ListRow
              key={exception.exerciseId}
              testID={`${testIDPrefix}-exception-${exception.exerciseId}`}
              title={exception.exerciseName}
              subtitle={describe(exception, weightUnit)}
              onPress={() => open(exception)}
              divider={index > 0}
              trailing={
                <TextButton
                  testID={`${testIDPrefix}-remove-${exception.exerciseId}`}
                  label="Remove"
                  accessibilityLabel={`Put ${exception.exerciseName} back on the range`}
                  onPress={() =>
                    void save(exception, { range: null, incrementKg: null }, () => undefined)
                  }
                />
              }
            />
          ))
        )}
        {error && !editing ? (
          <Text testID={`${testIDPrefix}-error`} style={styles.error}>
            {error}
          </Text>
        ) : null}
        <View style={styles.add}>
          <SecondaryButton
            testID={`${testIDPrefix}-add`}
            icon="plus"
            label="Add an Exception"
            onPress={() => {
              setError(null);
              setPicking(true);
            }}
          />
        </View>
      </Section>

      <ExercisePickerModal
        visible={picking}
        onClose={() => setPicking(false)}
        userId={pickerUserId}
        alreadyAddedIds={exceptions.map((exception) => exception.exerciseId)}
        onSelect={(exercise) => {
          setPicking(false);
          if (exercise.measurementType === 'timed') {
            Alert.alert('No rep range', `${exercise.name} is timed, so it has no rep range.`);
            return;
          }
          // A new exception opens on "Its Own", starting from the range it's an exception to.
          setEditing({
            exercise: {
              exerciseId: exercise.id,
              exerciseName: exercise.name,
              measurementType: exercise.measurementType,
            },
            current: { range, incrementKg: null },
          });
        }}
        accentColor={accentColor}
        onAccentColor={onAccentColor}
      />

      <ExerciseProgressionSheet
        visible={editing !== null}
        exerciseName={editing?.exercise.exerciseName ?? ''}
        measurementType={editing?.exercise.measurementType ?? 'weight_reps'}
        personalRange={range}
        current={editing?.current ?? null}
        unit={weightUnit}
        saving={saving}
        error={editing ? error : null}
        onSave={(setting) => {
          if (editing) void save(editing.exercise, setting, () => setEditing(null));
        }}
        onClose={() => setEditing(null)}
        accentColor={accentColor}
        onAccentColor={onAccentColor}
        personalLabel={yours ? 'My Range' : 'Their Range'}
      />
    </>
  );
}

const styles = StyleSheet.create({
  help: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  empty: {
    ...typeScale.secondary,
    color: colors.textMuted,
    paddingVertical: spacing.sm,
  },
  error: {
    ...typeScale.secondary,
    color: colors.destructive,
    marginTop: spacing.sm,
  },
  add: {
    marginTop: spacing.md,
  },
});
