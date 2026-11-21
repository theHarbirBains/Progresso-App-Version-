import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type TextInputInstance } from 'react-native';
import { BottomSheet } from '../design/BottomSheet';
import { PrimaryButton, TextButton } from '../design/Button';
import { ChoiceTile } from '../design/ChoiceTile';
import { SectionHeader } from '../design/SectionHeader';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors, fonts, minTouchTarget, radii, spacing, typeScale } from '../design/theme';
import { withAlpha } from '../theme/accentColor';
import {
  activitiesInOrder,
  CARDIO_FIELDS,
  CARDIO_INFO,
  cardioReadout,
  cardioValues,
  draftFromCardio,
  emptyCardioDraft,
  type CardioActivity,
  type CardioDraft,
  type CardioField,
  type CardioProblem,
  type CardioValues,
} from './cardioActivities';

interface Props {
  visible: boolean;
  /** The activity being changed, or null to add one. */
  entry: CardioValues | null;
  /** The activities the person did last, most recent first: offered first. */
  recent?: CardioActivity[];
  accentColor: string;
  onAccentColor: string;
  /** Saves it; a rejection's message is shown and the sheet stays open. */
  onSave: (values: CardioValues) => Promise<void> | void;
  /** Offered only for an activity already added. */
  onRemove?: () => Promise<void> | void;
  onClose: () => void;
  testID?: string;
}

const COLUMNS = 3;

/**
 * Adds or changes a cardio activity, in two steps in one sheet. Adding opens on the activities as
 * a grid of tiles -- the ones used last first -- and a tap goes straight to its figures; changing
 * one opens on its figures. The figures are only the activity's own (cardio/cardioActivities.ts):
 * its time -- the one figure it needs -- with its main ones beside it, what they work out to
 * under them ("Pace 5:30 /km"), and the rest, never required, under Optional. A level, a
 * resistance or an incline can be nudged with − and +. Change goes back to the tiles keeping
 * what's typed, so a figure both activities ask for carries over. Typed in, never read from GPS
 * or Apple Health, and never calories.
 */
export function CardioSheet({
  visible,
  entry,
  recent = [],
  accentColor,
  onAccentColor,
  onSave,
  onRemove,
  onClose,
  testID = 'cardio-sheet',
}: Props) {
  const [step, setStep] = useState<'pick' | 'form'>('pick');
  const [draft, setDraft] = useState<CardioDraft>(() => emptyCardioDraft());
  const [order, setOrder] = useState<CardioActivity[]>(() => activitiesInOrder(recent));
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<CardioProblem | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Whether an activity's been picked (or was being changed): the tiles then go Back to it.
  const [picked, setPicked] = useState(false);
  const timeRef = useRef<TextInputInstance>(null);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (focusTimer.current) clearTimeout(focusTimer.current);
    },
    [],
  );

  // Each time it opens: on the activity being changed, or on the tiles, in the order of the moment
  // (so they never move under a finger).
  useEffect(() => {
    if (!visible) return;
    setDraft(entry ? draftFromCardio(entry) : emptyCardioDraft());
    setStep(entry ? 'form' : 'pick');
    setPicked(entry !== null);
    setOrder(activitiesInOrder(recent));
    setProblem(null);
    setError(null);
    setSaving(false);
    // Opened afresh, not on every change to `recent` while it's showing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, entry]);

  const id = (suffix: string) => `${testID}-${suffix}`;
  const info = CARDIO_INFO[draft.activity];
  const change = (field: CardioField | 'duration') => (text: string) => {
    setDraft((prev) => ({ ...prev, [field]: text }));
    if (problem?.field === field) setProblem(null);
  };

  function pick(activity: CardioActivity) {
    setDraft((prev) => ({ ...prev, activity }));
    setProblem(null);
    setStep('form');
    // Adding: straight to its time, the one figure it needs (once the sheet has settled).
    if (!entry && !picked) {
      focusTimer.current = setTimeout(() => timeRef.current?.focus(), 350);
    }
    setPicked(true);
  }

  async function handleSave() {
    if (saving) return;
    const result = cardioValues(draft, entry);
    if (!('values' in result)) {
      setProblem(result);
      return;
    }
    setProblem(null);
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

  const fieldInput = (field: CardioField) => (
    <CardioFieldInput
      key={field}
      field={field}
      value={draft[field]}
      onChange={change(field)}
      error={problem?.field === field ? problem.problem : undefined}
      testID={id(field)}
    />
  );
  const primary = info.primary.filter((field) => field !== 'name');
  const optional = info.optional.filter((field) => field !== 'notes');
  const readout = step === 'form' ? cardioReadout(draft) : null;

  return (
    <BottomSheet visible={visible} onClose={onClose} testID={testID}>
      {step === 'pick' ? (
        <View testID={id('activities')} style={styles.content}>
          <Text style={styles.title}>Add Cardio</Text>
          <Text style={styles.caption}>What did you do?</Text>
          <View style={styles.grid}>
            {rowsOf(order, COLUMNS).map((row) => (
              <View key={row[0]} style={styles.gridRow}>
                {row.map((activity) => (
                  <ActivityTile
                    key={activity}
                    activity={activity}
                    selected={picked && draft.activity === activity}
                    onPress={() => pick(activity)}
                    accentColor={accentColor}
                    testID={id(`activity-${activity}`)}
                  />
                ))}
                {Array.from({ length: COLUMNS - row.length }, (_, i) => (
                  <View key={`gap-${i}`} style={styles.tileGap} />
                ))}
              </View>
            ))}
          </View>
          <TextButton
            testID={id('cancel')}
            label={picked ? 'Back' : 'Cancel'}
            onPress={picked ? () => setStep('form') : onClose}
          />
        </View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <Text style={styles.caption}>{entry ? 'Edit Cardio' : 'Add Cardio'}</Text>
          <View testID={id('heading')} style={styles.heading}>
            <View style={[styles.headingIcon, { backgroundColor: withAlpha(accentColor, 0.14) }]}>
              <Feather name={info.icon} size={18} color={accentColor} />
            </View>
            <Text testID={id('activity')} style={styles.title} numberOfLines={1}>
              {info.label}
            </Text>
            <TextButton
              testID={id('change')}
              label="Change"
              accessibilityLabel="Change the activity"
              onPress={() => setStep('pick')}
            />
          </View>

          {info.primary.includes('name') ? fieldInput('name') : null}
          <FieldGrid>
            {[
              <TextInput
                key="duration"
                testID={id('duration')}
                inputRef={timeRef}
                label="Time (min)"
                placeholder="20 or 20:30"
                value={draft.duration}
                onChangeText={change('duration')}
                keyboardType="numbers-and-punctuation"
                accessibilityLabel="Time, in minutes"
                error={problem?.field === 'duration' ? problem.problem : undefined}
              />,
              ...primary.map(fieldInput),
            ]}
          </FieldGrid>
          {readout ? (
            <Text testID={id('readout')} style={styles.readout}>
              {readout}
            </Text>
          ) : null}

          {optional.length > 0 || info.optional.includes('notes') ? (
            <View style={styles.optional}>
              <SectionHeader label="Optional" />
              {optional.length > 0 ? <FieldGrid>{optional.map(fieldInput)}</FieldGrid> : null}
              {info.optional.includes('notes') ? fieldInput('notes') : null}
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
        </ScrollView>
      )}
    </BottomSheet>
  );
}

function rowsOf<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

/** Fields two to a row; a last one alone keeps its half. */
function FieldGrid({ children }: { children: ReactNode[] }) {
  return (
    <View style={styles.fields}>
      {rowsOf(children, 2).map((row, index) => (
        <View key={index} style={styles.fieldRow}>
          {row.map((child, i) => (
            <View key={i} style={styles.field}>
              {child}
            </View>
          ))}
          {row.length === 1 ? <View style={styles.field} /> : null}
        </View>
      ))}
    </View>
  );
}

/** One activity: its glyph over its name, a raised tile. */
function ActivityTile({
  activity,
  selected,
  onPress,
  accentColor,
  testID,
}: {
  activity: CardioActivity;
  selected: boolean;
  onPress: () => void;
  accentColor: string;
  testID: string;
}) {
  const { label, icon } = CARDIO_INFO[activity];
  return (
    <ChoiceTile
      testID={testID}
      onPress={onPress}
      selected={selected || undefined}
      accentColor={accentColor}
      accessibilityLabel={label}
      style={styles.tile}
    >
      <View style={styles.tileBody}>
        <Feather name={icon} size={22} color={selected ? accentColor : colors.textSecondary} />
        <Text style={styles.tileLabel} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </ChoiceTile>
  );
}

/** One of an activity's figures, asked for as cardio/cardioActivities.ts says. */
function CardioFieldInput({
  field,
  value,
  onChange,
  error,
  testID,
}: {
  field: CardioField;
  value: string;
  onChange: (text: string) => void;
  error?: string;
  testID: string;
}) {
  const spec = CARDIO_FIELDS[field];
  const label = spec.unit ? `${spec.label} (${spec.unit})` : spec.label;
  // From blank, a step from nothing: an incline's first + is 0.5, a level's 1.
  const nudge = (by: number) => {
    const current = Number(value.replace(',', '.'));
    const start = value.trim() === '' || !Number.isFinite(current) ? 0 : current;
    const next = Math.min(spec.max ?? Infinity, Math.max(spec.min ?? -Infinity, start + by));
    onChange(String(Math.round(next * 10) / 10));
  };
  const stepper = (by: number) => (
    <Pressable
      testID={`${testID}-${by > 0 ? 'up' : 'down'}`}
      onPress={() => nudge(by)}
      hitSlop={6}
      style={styles.stepper}
      accessibilityRole="button"
      accessibilityLabel={`${by > 0 ? 'Raise' : 'Lower'} the ${spec.label.toLowerCase()}`}
    >
      <Feather name={by > 0 ? 'plus' : 'minus'} size={16} color={colors.textSecondary} />
    </Pressable>
  );
  return (
    <TextInput
      testID={testID}
      label={label}
      placeholder={spec.placeholder}
      value={value}
      onChangeText={onChange}
      keyboardType={spec.keyboard}
      autoCapitalize={
        field === 'name' ? 'words' : spec.keyboard === 'default' ? 'sentences' : 'none'
      }
      helperText={spec.hint}
      error={error}
      multiline={spec.multiline}
      maxLength={spec.maxLength}
      leftAccessory={spec.step ? stepper(-spec.step) : undefined}
      rightAccessory={spec.step ? stepper(spec.step) : undefined}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  title: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    flex: 1,
  },
  caption: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: -spacing.sm,
  },
  grid: {
    gap: spacing.sm,
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
  },
  tileGap: {
    flex: 1,
  },
  tileBody: {
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 64,
    justifyContent: 'center',
  },
  tileLabel: {
    ...typeScale.caption,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headingIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fields: {
    gap: spacing.md,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  field: {
    flex: 1,
  },
  readout: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: -spacing.xs,
  },
  optional: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  stepper: {
    width: 32,
    minHeight: minTouchTarget - 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    ...typeScale.callout,
    color: colors.destructive,
  },
});
