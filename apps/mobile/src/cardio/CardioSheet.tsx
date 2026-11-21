import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet } from '../design/BottomSheet';
import { PrimaryButton, TextButton } from '../design/Button';
import { FilterChips } from '../design/FilterChips';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors, spacing, typeScale } from '../design/theme';
import {
  CARDIO_ACTIVITIES,
  CARDIO_INFO,
  cardioValues,
  distanceUnit,
  draftFromCardio,
  emptyCardioDraft,
  formatPace,
  metresFrom,
  parseCardioTime,
  speedUnit,
  type CardioActivity,
  type CardioDraft,
  type CardioValues,
} from './cardioActivities';

interface Props {
  visible: boolean;
  /** The activity being changed, or null to add one. */
  entry: CardioValues | null;
  weightUnit: 'kg' | 'lb';
  accentColor: string;
  onAccentColor: string;
  /** Saves it; a rejection's message is shown and the sheet stays open. */
  onSave: (values: CardioValues) => Promise<void> | void;
  /** Offered only for an activity already added. */
  onRemove?: () => Promise<void> | void;
  onClose: () => void;
  testID?: string;
}

const OPTIONS = CARDIO_ACTIVITIES.map((value) => ({ value, label: CARDIO_INFO[value].label }));

/**
 * Adds or changes a cardio activity: what it was (a row of chips), how long it took -- the one
 * figure it needs -- and, only as the activity suits it, the distance, speed, incline, resistance
 * level or floors, and calories. A run or a walk shows its pace as the distance is typed. Typed in,
 * never read from GPS or Apple Health.
 */
export function CardioSheet({
  visible,
  entry,
  weightUnit,
  accentColor,
  onAccentColor,
  onSave,
  onRemove,
  onClose,
  testID = 'cardio-sheet',
}: Props) {
  const [draft, setDraft] = useState<CardioDraft>(() => emptyCardioDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Each time it opens, it starts from the activity being changed, or afresh.
  useEffect(() => {
    if (!visible) return;
    setDraft(entry ? draftFromCardio(entry, weightUnit) : emptyCardioDraft());
    setError(null);
    setSaving(false);
  }, [visible, entry, weightUnit]);

  const info = CARDIO_INFO[draft.activity];
  const asks = (field: (typeof info.fields)[number]) => info.fields.includes(field);
  const change = (field: keyof CardioDraft) => (text: string) =>
    setDraft((prev) => ({ ...prev, [field]: text }));
  const id = (suffix: string) => `${testID}-${suffix}`;

  // A run's or a walk's pace, as its distance and time are typed.
  const seconds = parseCardioTime(draft.duration);
  const distance = Number(draft.distance.replace(',', '.'));
  const pace =
    info.showsPace && seconds !== null && distance > 0
      ? formatPace(
          metresFrom(distance, draft.activity, weightUnit),
          seconds,
          draft.activity,
          weightUnit,
        )
      : null;

  async function handleSave() {
    if (saving) return;
    const result = cardioValues(draft, weightUnit);
    if ('problem' in result) {
      setError(result.problem);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(result.values);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That cardio did not save');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!onRemove || saving) return;
    setSaving(true);
    try {
      await onRemove();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That cardio was not removed');
    } finally {
      setSaving(false);
    }
  }

  const resistanceLabel = info.resistanceLabel ?? 'Resistance';
  return (
    <BottomSheet visible={visible} onClose={onClose} testID={testID}>
      <View style={styles.content}>
        <Text style={styles.title}>{entry ? 'Edit Cardio' : 'Add Cardio'}</Text>
        <FilterChips<CardioActivity>
          testID={id('activity')}
          options={OPTIONS}
          value={draft.activity}
          onChange={(activity) => setDraft((prev) => ({ ...prev, activity }))}
          accentColor={accentColor}
          onAccentColor={onAccentColor}
        />

        {asks('name') ? (
          <TextInput
            testID={id('name')}
            label="What was it?"
            placeholder="e.g. Jump Rope"
            value={draft.name}
            onChangeText={change('name')}
            autoCapitalize="words"
            maxLength={60}
          />
        ) : null}

        <View style={styles.row}>
          <View style={styles.field}>
            <TextInput
              testID={id('duration')}
              label="Time (min)"
              placeholder="20 or 20:30"
              value={draft.duration}
              onChangeText={change('duration')}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Time, in minutes"
            />
          </View>
          <View style={styles.field}>
            <TextInput
              testID={id('calories')}
              label="Calories"
              placeholder="Optional"
              value={draft.calories}
              onChangeText={change('calories')}
              keyboardType="number-pad"
            />
          </View>
        </View>

        {asks('distance') || asks('speed') ? (
          <View style={styles.row}>
            {asks('distance') ? (
              <View style={styles.field}>
                <TextInput
                  testID={id('distance')}
                  label={`Distance (${distanceUnit(draft.activity, weightUnit)})`}
                  placeholder="Optional"
                  value={draft.distance}
                  onChangeText={change('distance')}
                  keyboardType="decimal-pad"
                  helperText={pace ? `Pace ${pace}` : undefined}
                />
              </View>
            ) : null}
            {asks('speed') ? (
              <View style={styles.field}>
                <TextInput
                  testID={id('speed')}
                  label={`Speed (${speedUnit(weightUnit)})`}
                  placeholder="Optional"
                  value={draft.speed}
                  onChangeText={change('speed')}
                  keyboardType="decimal-pad"
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {asks('incline') || asks('resistance') || asks('floors') ? (
          <View style={styles.row}>
            {asks('floors') ? (
              <View style={styles.field}>
                <TextInput
                  testID={id('floors')}
                  label="Floors"
                  placeholder="Optional"
                  value={draft.floors}
                  onChangeText={change('floors')}
                  keyboardType="number-pad"
                />
              </View>
            ) : null}
            {asks('incline') ? (
              <View style={styles.field}>
                <TextInput
                  testID={id('incline')}
                  label="Incline (%)"
                  placeholder="Optional"
                  value={draft.incline}
                  onChangeText={change('incline')}
                  keyboardType="decimal-pad"
                />
              </View>
            ) : null}
            {asks('resistance') ? (
              <View style={styles.field}>
                <TextInput
                  testID={id('resistance')}
                  label={resistanceLabel}
                  placeholder="Optional"
                  value={draft.resistance}
                  onChangeText={change('resistance')}
                  keyboardType="number-pad"
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {error ? (
          <Text testID={id('error')} style={styles.error}>
            {error}
          </Text>
        ) : null}
        <PrimaryButton
          testID={id('save')}
          label={entry ? 'Save' : 'Add Cardio'}
          onPress={() => void handleSave()}
          loading={saving}
          accentColor={accentColor}
          onAccentColor={onAccentColor}
        />
        {entry && onRemove ? (
          <TextButton
            testID={id('remove')}
            label="Remove"
            destructive
            onPress={() => void handleRemove()}
          />
        ) : (
          <TextButton testID={id('cancel')} label="Cancel" onPress={onClose} />
        )}
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
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  field: {
    flex: 1,
  },
  error: {
    ...typeScale.callout,
    color: colors.destructive,
  },
});
