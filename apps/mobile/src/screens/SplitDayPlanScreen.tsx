import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { SecondaryButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { Text } from '../design/Text';
import { colors, minTouchTarget, spacing, typeScale, widgetGap } from '../design/theme';
import { MUSCLE_GROUP_LABELS } from '../exercises/muscleGroups';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { ExercisePickerModal } from '../workouts/ExercisePickerModal';
import {
  addPlannedExercise,
  fetchDayPlan,
  removePlannedExercise,
  reorderPlan,
  setPlannedSets,
  type PlannedExercise,
} from '../workouts/splitPlanQueries';
import { ExerciseFormScreen } from './ExerciseFormScreen';

type Props = RootStackScreenProps<'SplitDayPlan'>;

const MAX_SETS = 20;

/**
 * A split day's plan: the exercises to do that day, in order, each with how many sets. Starting
 * the day (Start Workout) adds them to the new workout, sets ready to fill from last time; the
 * workout can still be changed freely, and changing the plan never changes a workout already
 * done. Each change saves at once, like the split editor. Exercises come from the same picker
 * the live workout uses, custom ones included.
 *
 * Layout: one widget per planned exercise -- its name and muscle group, a sets stepper, and move
 * up/down and remove as the live workout's bare glyph buttons -- then Add Exercise.
 */
export function SplitDayPlanScreen({ navigation, route }: Props) {
  const { dayId, dayName } = route.params;
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { theme } = useProgressTheme();
  const [plan, setPlan] = useState<PlannedExercise[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creatingCustom, setCreatingCustom] = useState(false);

  const load = useCallback(async () => {
    try {
      setPlan(await fetchDayPlan(dayId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the plan');
      setPlan([]);
    }
  }, [dayId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<void>, failure: string) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : failure);
      void load();
    }
  }

  function handleAdd(exerciseId: string) {
    setPickerOpen(false);
    const position = (plan ?? []).reduce((max, p) => Math.max(max, p.position), -1) + 1;
    void run(async () => {
      const added = await addPlannedExercise(dayId, exerciseId, position);
      setPlan((prev) => [...(prev ?? []), added]);
    }, 'Failed to add the exercise');
  }

  function handleSets(planned: PlannedExercise, delta: number) {
    const next = Math.min(MAX_SETS, Math.max(1, planned.targetSets + delta));
    if (next === planned.targetSets) return;
    setPlan((prev) =>
      (prev ?? []).map((p) => (p.id === planned.id ? { ...p, targetSets: next } : p)),
    );
    void run(() => setPlannedSets(planned.id, next), 'Failed to change the sets');
  }

  function handleRemove(planned: PlannedExercise) {
    setPlan((prev) => (prev ?? []).filter((p) => p.id !== planned.id));
    void run(() => removePlannedExercise(planned.id), 'Failed to remove the exercise');
  }

  function handleMove(index: number, direction: -1 | 1) {
    if (!plan) return;
    const target = index + direction;
    if (target < 0 || target >= plan.length) return;
    const next = [...plan];
    [next[index], next[target]] = [next[target]!, next[index]!];
    const renumbered = next.map((p, i) => ({ ...p, position: i }));
    setPlan(renumbered);
    void run(
      () => reorderPlan(renumbered.map((p) => ({ id: p.id, position: p.position }))),
      'Failed to reorder the plan',
    );
  }

  if (creatingCustom) {
    return (
      <ExerciseFormScreen
        mode="create"
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
        onDone={() => {
          setCreatingCustom(false);
          setPickerOpen(true);
        }}
        onCancel={() => setCreatingCustom(false)}
      />
    );
  }

  if (plan === null) return <LoadingState testID="split-day-plan-loading" />;

  return (
    <>
      <Screen
        scrollTestID="split-day-plan"
        contentContainerStyle={styles.content}
        header={
          <AppHeader
            title={dayName}
            subtitle="Exercises for this day"
            onBack={() => navigation.goBack()}
            testID="split-day-plan-header"
          />
        }
      >
        {error ? (
          <Text testID="split-day-plan-error" style={styles.error}>
            {error}
          </Text>
        ) : null}

        {plan.length === 0 ? (
          <EmptyState
            testID="split-day-plan-empty"
            title="No exercises planned"
            description="Add the exercises you do on this day. Starting it then adds them for you, sets ready to fill."
          />
        ) : null}

        {plan.map((planned, index) => (
          <AppCard key={planned.id} testID={`split-day-plan-item-${planned.id}`}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.name}>{planned.exerciseName}</Text>
                <Text style={styles.meta}>{MUSCLE_GROUP_LABELS[planned.muscleGroup]}</Text>
              </View>
              <TouchableOpacity
                testID={`split-day-plan-up-${planned.id}`}
                style={styles.iconButton}
                onPress={() => handleMove(index, -1)}
                disabled={index === 0}
                accessibilityRole="button"
                accessibilityLabel={`Move ${planned.exerciseName} up`}
              >
                <Feather
                  name="chevron-up"
                  size={18}
                  color={index === 0 ? colors.textMuted : colors.textSecondary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                testID={`split-day-plan-down-${planned.id}`}
                style={styles.iconButton}
                onPress={() => handleMove(index, 1)}
                disabled={index === plan.length - 1}
                accessibilityRole="button"
                accessibilityLabel={`Move ${planned.exerciseName} down`}
              >
                <Feather
                  name="chevron-down"
                  size={18}
                  color={index === plan.length - 1 ? colors.textMuted : colors.textSecondary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                testID={`split-day-plan-remove-${planned.id}`}
                style={styles.iconButton}
                onPress={() => handleRemove(planned)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${planned.exerciseName} from this day`}
              >
                <Feather name="trash-2" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.stepper}>
              <Text style={styles.meta}>Sets</Text>
              <TouchableOpacity
                testID={`split-day-plan-fewer-${planned.id}`}
                style={styles.iconButton}
                onPress={() => handleSets(planned, -1)}
                disabled={planned.targetSets <= 1}
                accessibilityRole="button"
                accessibilityLabel={`One set fewer of ${planned.exerciseName}`}
              >
                <Feather name="minus" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <Text testID={`split-day-plan-sets-${planned.id}`} style={styles.sets}>
                {planned.targetSets}
              </Text>
              <TouchableOpacity
                testID={`split-day-plan-more-${planned.id}`}
                style={styles.iconButton}
                onPress={() => handleSets(planned, 1)}
                disabled={planned.targetSets >= MAX_SETS}
                accessibilityRole="button"
                accessibilityLabel={`One more set of ${planned.exerciseName}`}
              >
                <Feather name="plus" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </AppCard>
        ))}

        <SecondaryButton
          testID="split-day-plan-add"
          label="Add Exercise"
          icon="plus"
          onPress={() => setPickerOpen(true)}
        />
      </Screen>

      <ExercisePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(exercise) => handleAdd(exercise.id)}
        userId={userId}
        alreadyAddedIds={plan.map((p) => p.exerciseId)}
        onCreateCustom={() => {
          setPickerOpen(false);
          setCreatingCustom(true);
        }}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: widgetGap,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex: {
    flex: 1,
  },
  name: {
    ...typeScale.callout,
    color: colors.textPrimary,
  },
  meta: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  iconButton: {
    minWidth: minTouchTarget,
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  sets: {
    ...typeScale.statSmall,
    color: colors.textPrimary,
    minWidth: 24,
    textAlign: 'center',
  },
  error: {
    ...typeScale.callout,
    color: colors.destructive,
  },
});
