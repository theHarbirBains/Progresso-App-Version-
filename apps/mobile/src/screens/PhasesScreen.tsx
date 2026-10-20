import { Alert, StyleSheet, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { Text } from '../design/Text';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { useNutritionGoals } from '../nutrition/NutritionGoalsProvider';
import { formatDayKey } from '../phases/DateField';
import { usePhases } from '../phases/PhaseProvider';
import { PhaseSummary } from '../phases/PhaseSummary';
import { dayKey, hasOwnTargets, phaseDays, phaseLabel } from '../phases/phaseRules';
import type { TrainingPhase } from '../phases/phaseQueries';
import { useProfile } from '../profile/ProfileProvider';
import { useProgressTheme } from '../progress/useProgressTheme';

type Props = RootStackScreenProps<'Phases'>;

function targetsLine(phase: TrainingPhase): string {
  if (!hasOwnTargets(phase)) return 'Uses your daily targets.';
  const { calories, proteinG, carbsG, fatG } = phase.targets;
  const parts = [
    calories !== null ? `${calories.toLocaleString()} cal` : null,
    proteinG !== null ? `${proteinG} g protein` : null,
    carbsG !== null ? `${carbsG} g carbs` : null,
    fatG !== null ? `${fatG} g fat` : null,
  ].filter(Boolean);
  return `Its own targets: ${parts.join(' · ')}. Any it leaves blank use your daily targets.`;
}

/**
 * Phases: a cut, a bulk, maintenance or the person's own kind, from a start date. The phase
 * going now is the hero -- its name, how long it has run, its targets (its own, or "uses your
 * daily targets"), and how it has gone so far (PhaseSummary) -- with Edit and End Phase. Then
 * every past phase, newest first, each opening to edit or review. With none going, an empty
 * state offers to start one. Nothing here changes a workout, a log or the daily targets.
 */
export function PhasesScreen({ navigation }: Props) {
  const { openMenu } = useAppMenu();
  const { nutritionTheme: theme } = useProgressTheme();
  const { profile } = useProfile();
  const { goals } = useNutritionGoals();
  const { phases, active, loading, error, endPhase } = usePhases();
  const weightUnit = profile?.weightUnit ?? 'lb';
  const past = phases.filter((phase) => phase.id !== active?.id);

  function confirmEnd(phase: TrainingPhase) {
    Alert.alert(`End your ${phaseLabel(phase)} today?`, 'It moves to your past phases.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Phase',
        style: 'destructive',
        onPress: () => {
          void endPhase(phase.id, dayKey(new Date())).catch((err: unknown) =>
            Alert.alert('Could not end the phase', err instanceof Error ? err.message : ''),
          );
        },
      },
    ]);
  }

  const header = (
    <AppHeader
      testID="phases-header"
      title="Phases"
      leftAction={{
        icon: 'menu',
        onPress: () => openMenu(),
        accessibilityLabel: 'Open menu',
        testID: 'phases-open-menu',
      }}
      rightAction={{
        icon: 'plus',
        onPress: () => navigation.navigate('PhaseForm'),
        accessibilityLabel: 'Start a phase',
        testID: 'phases-start',
      }}
    />
  );

  if (loading) return <LoadingState testID="phases-loading" />;

  return (
    <Screen header={header} contentContainerStyle={styles.content} scrollTestID="phases-scroll">
      {error ? <ErrorState testID="phases-error" message={error} /> : null}

      {active ? (
        <AppCard hero testID="phases-active">
          <Text style={styles.kicker}>Going now</Text>
          <Text testID="phases-active-name" style={styles.title}>
            {phaseLabel(active)}
          </Text>
          <Text testID="phases-active-since" style={styles.meta}>
            Day {phaseDays(active)} · since {formatDayKey(active.startDate)}
          </Text>
          <Text testID="phases-active-targets" style={styles.meta}>
            {targetsLine(active)}
          </Text>
          {active.notes ? <Text style={styles.meta}>{active.notes}</Text> : null}
          <View style={styles.summary}>
            <PhaseSummary
              testID="phases-active-summary"
              phase={active}
              calorieTarget={active.targets.calories ?? goals?.calories ?? null}
              weightUnit={weightUnit}
            />
          </View>
          <View style={styles.actions}>
            <SecondaryButton
              testID="phases-edit-active"
              label="Edit Phase"
              onPress={() => navigation.navigate('PhaseForm', { phaseId: active.id })}
            />
            <TextButton
              testID="phases-end-active"
              label="End Phase"
              destructive
              onPress={() => confirmEnd(active)}
            />
          </View>
        </AppCard>
      ) : (
        <AppCard testID="phases-none">
          <EmptyState
            testID="phases-empty"
            title="No phase going"
            description="Record a cut, a bulk, maintenance or your own kind of phase, with its own targets if you like."
          />
          <PrimaryButton
            testID="phases-start-button"
            label="Start a Phase"
            onPress={() => navigation.navigate('PhaseForm')}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />
        </AppCard>
      )}

      {past.length > 0 ? (
        <AppCard testID="phases-past">
          <Section title="Past Phases">
            {past.map((phase, index) => (
              <ListRow
                key={phase.id}
                testID={`phases-past-${phase.id}`}
                title={phaseLabel(phase)}
                subtitle={`${formatDayKey(phase.startDate)} – ${phase.endDate ? formatDayKey(phase.endDate) : 'now'} · ${phaseDays(phase)} days`}
                divider={index > 0}
                onPress={() => navigation.navigate('PhaseForm', { phaseId: phase.id })}
              />
            ))}
          </Section>
        </AppCard>
      ) : null}

      <Text style={styles.note}>
        While a phase is going, each target it has is used in place of your daily target; the rest
        use your daily targets, which never change on their own. Workouts and food logs stay as they
        are whatever you do with a phase.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: widgetGap,
  },
  kicker: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  title: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  meta: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  summary: {
    marginTop: spacing.lg,
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  note: {
    ...typeScale.caption,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
  },
});
