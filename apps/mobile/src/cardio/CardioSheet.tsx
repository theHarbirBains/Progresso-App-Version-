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
import { formatRecentDate } from '../workouts/workoutFormat';
import {
  activitiesInOrder,
  CARDIO_FIELDS,
  CARDIO_INFO,
  cardioDetails,
  cardioReadout,
  cardioValues,
  draftFromCardio,
  emptyCardioDraft,
  lastTimeFor,
  type CardioActivity,
  type CardioDraft,
  type CardioField,
  type CardioProblem,
  type CardioValues,
} from './cardioActivities';
import { GlyphWell } from '../design/GlyphWell';
import type { CardioHistoryEntry } from './cardioQueries';

interface Props {
  visible: boolean;
  /** The activity being changed, or null to add one. */
  entry: CardioValues | null;
  /**
   * Adding, the figures to start from -- "do it again" from the Cardio page's recent ones: it
   * opens straight on them, to change and add.
   */
  initial?: CardioValues | null;
  /**
   * The last time the person did each activity, most recent first (useRecentCardio): offered
   * first, and shown on its figures as Last Time, with Use These to start from them.
   */
  recent?: CardioHistoryEntry[];
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
 * a grid of tiles -- the ones used last first -- and a tap goes straight to its figures, with the
 * last time it was done above them and Use These to start from those; changing one, or doing a
 * recent one again, opens on its figures. The figures are only the activity's own (cardio/cardioActivities.ts):
 * its time -- the one figure it needs -- with its main ones beside it, what they work out to
 * under them ("Pace 5:30 /km"), and the rest, never required, under Optional. A level, a
 * resistance or an incline can be nudged with − and +. Change goes back to the tiles keeping
 * what's typed, so a figure both activities ask for carries over. Typed in, never read from GPS
 * or Apple Health, and never calories.
 */
export function CardioSheet({
  visible,
  entry,
  initial = null,
  recent = NO_RECENT,
  accentColor,
  onAccentColor,
  onSave,
  onRemove,
  onClose,
  testID = 'cardio-sheet',
}: Props) {
  const [step, setStep] = useState<'pick' | 'form'>('pick');
  const [draft, setDraft] = useState<CardioDraft>(() => emptyCardioDraft());
  const [order, setOrder] = useState<CardioActivity[]>(() =>
    activitiesInOrder(recent.map((done) => done.activity)),
  );
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

  // Each time it opens: on the activity being changed (or the figures to start from), or on the
  // tiles, in the order of the moment (so they never move under a finger).
  useEffect(() => {
    if (!visible) return;
    const from = entry ?? initial;
    setDraft(from ? draftFromCardio(from) : emptyCardioDraft());
    setStep(from ? 'form' : 'pick');
    setPicked(from !== null);
    setOrder(activitiesInOrder(recent.map((done) => done.activity)));
    setProblem(null);
    setError(null);
    setSaving(false);
    // Opened afresh, not on every change to `recent` while it's showing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, entry, initial]);

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
  // The last time this activity was done (an "Other" once it's named), to start from.
  const last =
    step === 'form' && (draft.activity !== 'other' || draft.name.trim())
      ? lastTimeFor(recent, { activity: draft.activity, name: draft.name })
      : null;
  const useLast = () => {
    if (!last) return;
    setDraft(draftFromCardio(last));
    setProblem(null);
  };

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
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <Text style={styles.caption}>{entry ? 'Edit Cardio' : 'Add Cardio'}</Text>
          <View testID={id('heading')} style={styles.heading}>
            <GlyphWell icon={info.icon} accentColor={accentColor} />
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
          {last ? (
            <View testID={id('last')} style={styles.last}>
              <View style={styles.lastText}>
                <Text style={styles.lastLabel}>
                  Last time · {formatRecentDate(last.performedAt)}
                </Text>
                <Text testID={id('last-figures')} style={styles.lastFigures}>
                  {cardioDetails(last)}
                </Text>
              </View>
              {entry ? null : (
                <TextButton
                  testID={id('use-last')}
                  label="Use These"
                  accessibilityLabel="Fill in last time's figures"
                  onPress={useLast}
                />
              )}
            </View>
          ) : null}
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

const NO_RECENT: CardioHistoryEntry[] = [];

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
  // Last time's figures, on a quiet raised block, as a live exercise's Last Time is.
  last: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLift,
  },
  lastText: {
    flex: 1,
    gap: 2,
  },
  lastLabel: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  lastFigures: {
    ...typeScale.callout,
    fontFamily: fonts.mono,
    color: colors.textPrimary,
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
