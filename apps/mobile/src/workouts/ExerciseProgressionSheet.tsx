import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet } from '../design/BottomSheet';
import { PrimaryButton, TextButton } from '../design/Button';
import { SegmentedControl } from '../design/SegmentedControl';
import { Text } from '../design/Text';
import { WheelPicker } from '../design/WheelPicker';
import { colors, spacing, typeScale } from '../design/theme';
import type { MeasurementType } from '../exercises/movementTypes';
import { formatRepRange, type RepRange } from './progression';

const RANGE_VALUES = Array.from({ length: 50 }, (_, i) => String(i + 1));

type Source = 'personal' | 'own';

interface Props {
  visible: boolean;
  exerciseName: string;
  measurementType: MeasurementType;
  /** The person's own range (Settings > Workout Preferences). */
  personalRange: RepRange;
  /** This exercise's own range, when it has one (a weight step saved before steps went is ignored). */
  current: { range: RepRange | null; incrementKg: number | null } | null;
  saving: boolean;
  error: string | null;
  onSave: (setting: { range: RepRange | null; incrementKg: number | null }) => void;
  onClose: () => void;
  accentColor: string;
  onAccentColor: string;
  /** Whose range the exercise otherwise follows: "My Range", or a client's for their trainer. */
  personalLabel?: string;
}

/**
 * An exercise's own rep range, opened from its card in the live workout. Its own range wins over
 * the person's for this exercise only; with "My Range" it follows theirs. There's no weight step:
 * the suggestion once the top set reaches the top of the range says to go up, never by how much
 * -- and saving clears a step saved before. Nothing here changes a set, a record or a weight.
 */
export function ExerciseProgressionSheet({
  visible,
  exerciseName,
  measurementType,
  personalRange,
  current,
  saving,
  error,
  onSave,
  onClose,
  accentColor,
  onAccentColor,
  personalLabel = 'My Range',
}: Props) {
  const [source, setSource] = useState<Source>('personal');
  const [range, setRange] = useState<RepRange>(personalRange);

  // Starts from what's saved each time it opens. The person's range is read by value, since
  // the caller builds a new object for it on every render.
  const personalMin = personalRange.min;
  const personalMax = personalRange.max;
  useEffect(() => {
    if (!visible) return;
    setSource(current?.range ? 'own' : 'personal');
    setRange(current?.range ?? { min: personalMin, max: personalMax });
  }, [visible, current, personalMin, personalMax]);

  const rangeValid = source === 'personal' || range.min <= range.max;
  const canSave = rangeValid && !saving;

  function handleSave() {
    if (!canSave) return;
    onSave({ range: source === 'own' ? range : null, incrementKg: null });
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} testID="exercise-progression-sheet">
      <View style={styles.content}>
        <Text style={styles.title}>{exerciseName}</Text>
        <Text style={styles.help}>
          The rep range this exercise is judged against. When its top set reaches the top, it&apos;s
          time to go heavier.
        </Text>
        <SegmentedControl
          testID="exercise-progression-source"
          options={[
            { label: `${personalLabel} (${formatRepRange(personalRange)})`, value: 'personal' },
            { label: 'Its Own', value: 'own' },
          ]}
          value={source}
          onChange={setSource}
          accentColor={accentColor}
          onAccentColor={onAccentColor}
        />
        {source === 'own' ? (
          <View style={styles.wheels}>
            <View style={styles.wheel}>
              <Text style={styles.wheelLabel}>From</Text>
              <WheelPicker
                testID="exercise-range-min"
                values={RANGE_VALUES}
                selectedValue={String(range.min)}
                onChange={(value) => setRange((prev) => ({ ...prev, min: Number(value) }))}
              />
            </View>
            <View style={styles.wheel}>
              <Text style={styles.wheelLabel}>To</Text>
              <WheelPicker
                testID="exercise-range-max"
                values={RANGE_VALUES}
                selectedValue={String(range.max)}
                onChange={(value) => setRange((prev) => ({ ...prev, max: Number(value) }))}
              />
            </View>
          </View>
        ) : null}
        {!rangeValid ? (
          <Text testID="exercise-range-error" style={styles.error}>
            The bottom of the range can&apos;t be above the top.
          </Text>
        ) : null}
        {error ? (
          <Text testID="exercise-progression-error" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <PrimaryButton
          testID="exercise-progression-save"
          label="Save"
          onPress={handleSave}
          loading={saving}
          disabled={!canSave && !saving}
          accentColor={accentColor}
          onAccentColor={onAccentColor}
        />
        <TextButton testID="exercise-progression-cancel" label="Cancel" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  help: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  wheels: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  wheel: {
    flex: 1,
  },
  wheelLabel: {
    ...typeScale.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  error: {
    ...typeScale.callout,
    color: colors.destructive,
  },
});
