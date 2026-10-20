import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { LoadingState } from '../design/LoadingState';
import { DestructiveButton, PrimaryButton, SecondaryButton } from '../design/Button';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { SegmentedControl } from '../design/SegmentedControl';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';
import { formatWeight, fromKg, roundWeight, toKg } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import { useNutritionGoals } from '../nutrition/NutritionGoalsProvider';
import { draftFromTargets, parseTargets, type TargetDraft } from '../nutrition/targetMath';
import { TargetsEditor } from '../nutrition/TargetsEditor';
import { DateField, formatDayKey } from '../phases/DateField';
import { usePhases } from '../phases/PhaseProvider';
import { PhaseSummary } from '../phases/PhaseSummary';
import type { PhaseKind, TrainingPhase } from '../phases/phaseQueries';
import {
  PHASE_KIND_LABELS,
  dayBefore,
  dayKey,
  phaseLabel,
  validatePhase,
} from '../phases/phaseRules';
import { useProfile } from '../profile/ProfileProvider';
import { useProgressTheme } from '../progress/useProgressTheme';

type Props = RootStackScreenProps<'PhaseForm'>;

const KIND_OPTIONS = (Object.keys(PHASE_KIND_LABELS) as PhaseKind[]).map((kind) => ({
  label: PHASE_KIND_LABELS[kind],
  value: kind,
}));

function weightText(kg: number | null, unit: 'kg' | 'lb'): string {
  return kg === null ? '' : formatWeight(roundWeight(fromKg(kg, unit)));
}

function parseWeight(text: string, unit: 'kg' | 'lb'): number | null | 'invalid' {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0 || value > (unit === 'kg' ? 400 : 880))
    return 'invalid';
  return roundWeight(toKg(value, unit));
}

/**
 * Starts, edits, ends or deletes a phase. Its kind (Cut, Bulk, Maintenance or the person's own),
 * an optional name, a start date (today or before), an end date (blank while it's going), an
 * optional start and target weight, optional targets of its own and notes. A past phase opens
 * with how it went (PhaseSummary). Starting a new phase while another is going ends that one the
 * day before -- said before it's saved. Phases never share days; nothing here changes a
 * workout, a food log or the daily targets.
 */
export function PhaseFormScreen({ navigation, route }: Props) {
  const { phases, loading } = usePhases();
  // The fields start from the phase being edited, so they wait for the phases to be read.
  if (loading) return <LoadingState testID="phase-form-loading" />;
  const editing = phases.find((phase) => phase.id === route.params?.phaseId) ?? null;
  return (
    <PhaseForm key={editing?.id ?? 'new'} navigation={navigation} route={route} editing={editing} />
  );
}

function PhaseForm({ navigation, editing }: Props & { editing: TrainingPhase | null }) {
  const { nutritionTheme: theme } = useProgressTheme();
  const { profile } = useProfile();
  const { goals } = useNutritionGoals();
  const { phases, active, createPhase, updatePhase, endPhase, deletePhase } = usePhases();
  const weightUnit = profile?.weightUnit ?? 'lb';
  const today = dayKey(new Date());

  const [kind, setKind] = useState<PhaseKind>(editing?.kind ?? 'cut');
  const [name, setName] = useState(editing?.name ?? '');
  const [startDate, setStartDate] = useState<string>(editing?.startDate ?? today);
  const [endDate, setEndDate] = useState<string | null>(editing?.endDate ?? null);
  const [startWeight, setStartWeight] = useState(
    editing
      ? weightText(editing.startWeightKg, weightUnit)
      : weightText(profile?.weightValue ?? null, weightUnit),
  );
  const [targetWeight, setTargetWeight] = useState(
    weightText(editing?.targetWeightKg ?? null, weightUnit),
  );
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [targets, setTargets] = useState<TargetDraft>(() =>
    draftFromTargets(
      editing?.targets ?? { calories: null, proteinG: null, carbsG: null, fatG: null },
    ),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A new phase going on from today, while another is going: that one ends the day before.
  const endsActive =
    !editing && active !== null && endDate === null && startDate > active.startDate ? active : null;
  const others = phases.filter((phase) => phase.id !== editing?.id && phase.id !== endsActive?.id);
  const ruleError = validatePhase(
    { kind, name, startDate, endDate },
    endsActive ? [...others, { ...endsActive, endDate: dayBefore(startDate) }] : others,
  );
  const parsedTargets = parseTargets(targets);
  const startKg = parseWeight(startWeight, weightUnit);
  const targetKg = parseWeight(targetWeight, weightUnit);
  const canSave =
    !saving &&
    ruleError === null &&
    Object.keys(parsedTargets.errors).length === 0 &&
    startKg !== 'invalid' &&
    targetKg !== 'invalid' &&
    notes.length <= 1000;

  async function handleSave() {
    if (!canSave) return;
    setError(null);
    setSaving(true);
    const input = {
      kind,
      name: name.trim() || null,
      startDate,
      endDate,
      startWeightKg: startKg,
      targetWeightKg: targetKg,
      targets: parsedTargets.values,
      notes: notes.trim() || null,
    };
    try {
      if (editing) {
        await updatePhase(editing.id, input);
      } else {
        if (endsActive) await endPhase(endsActive.id, dayBefore(startDate));
        await createPhase(input);
      }
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the phase');
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!editing) return;
    Alert.alert(
      `Delete your ${phaseLabel(editing)}?`,
      'Only the phase goes. Your workouts, food logs and daily targets stay as they are.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Phase',
          style: 'destructive',
          onPress: () => {
            void deletePhase(editing.id)
              .then(() => navigation.goBack())
              .catch((err: unknown) =>
                setError(err instanceof Error ? err.message : 'Failed to delete the phase'),
              );
          },
        },
      ],
    );
  }

  return (
    <Screen
      keyboardAvoiding
      scrollTestID="phase-form"
      contentContainerStyle={styles.content}
      header={
        <AppHeader
          title={editing ? phaseLabel(editing) : 'Start a Phase'}
          onBack={() => navigation.goBack()}
          testID="phase-form-header"
        />
      }
    >
      {editing ? (
        <AppCard testID="phase-form-summary">
          <Section title="How it went">
            <PhaseSummary
              testID="phase-form-summary-figures"
              phase={editing}
              calorieTarget={editing.targets.calories ?? goals?.calories ?? null}
              weightUnit={weightUnit}
            />
          </Section>
        </AppCard>
      ) : null}

      <AppCard>
        <Section title="Phase">
          <View style={styles.group}>
            <SegmentedControl
              testID="phase-form-kind"
              options={KIND_OPTIONS}
              value={kind}
              onChange={setKind}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
            />
            <TextInput
              testID="phase-form-name"
              label={kind === 'custom' ? 'Name' : 'Name (optional)'}
              placeholder={
                kind === 'custom' ? 'e.g. Strength Block' : `e.g. Summer ${PHASE_KIND_LABELS[kind]}`
              }
              value={name}
              onChangeText={setName}
            />
            <DateField
              testID="phase-form-start"
              label="Start date"
              value={startDate}
              onChange={(value) => value && setStartDate(value)}
              maxKey={today}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
            />
            <DateField
              testID="phase-form-end"
              label="End date"
              value={endDate}
              onChange={setEndDate}
              emptyLabel="Still going"
              clearable
              maxKey={today}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
            />
            {endsActive ? (
              <Text testID="phase-form-ends-active" style={styles.notice}>
                Starting this ends your {phaseLabel(endsActive)} on{' '}
                {formatDayKey(dayBefore(startDate))}.
              </Text>
            ) : null}
            {ruleError ? (
              <Text testID="phase-form-rule-error" style={styles.error}>
                {ruleError}
              </Text>
            ) : null}
          </View>
        </Section>
      </AppCard>

      <AppCard>
        <Section title="Body Weight (optional)">
          <View style={styles.row}>
            <View style={styles.cell}>
              <TextInput
                testID="phase-form-start-weight"
                label={`Start (${weightUnit})`}
                keyboardType="decimal-pad"
                value={startWeight}
                onChangeText={setStartWeight}
                error={startKg === 'invalid' ? 'Enter a weight' : undefined}
              />
            </View>
            <View style={styles.cell}>
              <TextInput
                testID="phase-form-target-weight"
                label={`Target (${weightUnit})`}
                keyboardType="decimal-pad"
                value={targetWeight}
                onChangeText={setTargetWeight}
                error={targetKg === 'invalid' ? 'Enter a weight' : undefined}
              />
            </View>
          </View>
          <Text style={styles.caption}>
            Yours to set, if you want one. Progresso doesn&apos;t set a pace or promise a rate.
          </Text>
        </Section>
      </AppCard>

      <AppCard>
        <Section title="Phase Targets (optional)">
          <Text style={styles.caption}>
            While this phase is going, each target here is used in place of your daily target. Leave
            any blank to keep using your daily one. Your daily targets don&apos;t change.
          </Text>
          <View style={styles.editor}>
            <TargetsEditor
              draft={targets}
              onChange={setTargets}
              weightKg={
                startKg !== null && startKg !== 'invalid' ? startKg : (profile?.weightValue ?? null)
              }
              weightUnit={weightUnit}
              testIDPrefix="phase-targets"
            />
          </View>
        </Section>
      </AppCard>

      <AppCard>
        <Section title="Notes (optional)">
          <TextInput
            testID="phase-form-notes"
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            error={notes.length > 1000 ? 'Keep notes to 1,000 characters' : undefined}
          />
        </Section>
      </AppCard>

      {error ? (
        <Text testID="phase-form-error" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <PrimaryButton
        testID="phase-form-save"
        label={editing ? 'Save Phase' : 'Start Phase'}
        onPress={() => void handleSave()}
        loading={saving}
        disabled={!canSave && !saving}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
      />
      {editing && editing.endDate === null ? (
        <SecondaryButton
          testID="phase-form-end-today"
          label="End Phase Today"
          disabled={saving}
          onPress={() => {
            void endPhase(editing.id, today)
              .then(() => navigation.goBack())
              .catch((err: unknown) =>
                setError(err instanceof Error ? err.message : 'Failed to end the phase'),
              );
          }}
        />
      ) : null}
      {editing ? (
        <DestructiveButton
          testID="phase-form-delete"
          label="Delete Phase"
          onPress={handleDelete}
          disabled={saving}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: widgetGap,
  },
  group: {
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cell: {
    flex: 1,
  },
  editor: {
    marginTop: spacing.lg,
  },
  caption: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  notice: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  error: {
    ...typeScale.callout,
    color: colors.destructive,
  },
});
