import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { GlyphWell } from '../design/GlyphWell';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { Text } from '../design/Text';
import {
  colors,
  fonts,
  minTouchTarget,
  radii,
  spacing,
  typeScale,
  widgetGap,
} from '../design/theme';
import { ExercisePhoto } from '../exercises/ExercisePhoto';
import { MUSCLE_GROUP_LABELS } from '../exercises/muscleGroups';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { withAlpha } from '../theme/accentColor';
import { ExercisePickerModal } from '../workouts/ExercisePickerModal';
import { SPLIT_MUSCLE_GROUP_LABELS } from '../workouts/splitMuscleGroups';
import {
  addPlannedExercise,
  fetchDayPlan,
  removePlannedExercise,
  reorderPlan,
  setPlannedSets,
  type PlannedExercise,
} from '../workouts/splitPlanQueries';
import { usePreviousExercises } from '../workouts/usePreviousExercises';
import { ExerciseFormScreen } from './ExerciseFormScreen';

type Props = RootStackScreenProps<'SplitDayPlan'>;

const MAX_SETS = 20;

/**
 * A split day's plan: the exercises to do that day, in order, each with how many sets. Starting
 * the day (Start Workout) runs it as a guided workout (workouts/guidedWorkout.ts), one exercise
 * at a time with its sets adding themselves; the workout can still be changed freely, and
 * changing the plan never changes a workout already done. Each change saves at once, like the
 * split editor. Exercises come from the same picker the live workout uses, custom ones included
 * -- with its Last Time tab: what they did last for each muscle group, the day's own first.
 *
 * Layout: a hero widget with the day (its muscle groups, and how many exercises and sets are
 * planned, or that planning them is optional), one widget per planned exercise -- its picture,
 * name and muscle group, move and remove as bare glyph buttons, and its sets as a stepper pill --
 * then Add Exercise and Done.
 */
export function SplitDayPlanScreen({ navigation, route }: Props) {
  const { dayId, dayName, muscleGroups = [] } = route.params;
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { theme, weightUnit } = useProgressTheme();
  const previous = usePreviousExercises(userId || undefined, dayId);
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

  const sets = plan.reduce((sum, planned) => sum + planned.targetSets, 0);

  return (
    <>
      <Screen
        scrollTestID="split-day-plan"
        contentContainerStyle={styles.content}
        header={
          <AppHeader
            title={dayName}
            subtitle="Exercises & sets"
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

        <AppCard hero testID="split-day-plan-summary">
          <View style={styles.heroRow}>
            <GlyphWell icon="list" accentColor={theme.accent} size={44} />
            <View style={styles.flex}>
              <Text style={styles.heroTitle}>{dayName}</Text>
              {muscleGroups.length > 0 ? (
                <Text style={styles.heroMuscles}>
                  {muscleGroups.map((group) => SPLIT_MUSCLE_GROUP_LABELS[group]).join(' · ')}
                </Text>
              ) : null}
            </View>
          </View>
          <Text testID="split-day-plan-count" style={styles.heroCount}>
            {plan.length === 0
              ? 'Optional: plan the exercises you do on this day, and how many sets of each.'
              : `${plan.length} ${plan.length === 1 ? 'exercise' : 'exercises'} · ${sets} ${sets === 1 ? 'set' : 'sets'}`}
          </Text>
          <Text style={styles.heroLine}>
            Starting this day takes you through them one at a time, adding each set as you go.
          </Text>
        </AppCard>

        {plan.length === 0 ? (
          <View testID="split-day-plan-empty" style={styles.empty}>
            <Text style={styles.emptyTitle}>No exercises planned yet</Text>
            <Text style={styles.emptyLine}>
              Add the first below -- or go back, and choose them as you train.
            </Text>
          </View>
        ) : null}

        {plan.map((planned, index) => (
          <AppCard key={planned.id} testID={`split-day-plan-item-${planned.id}`}>
            <View style={styles.row}>
              <ExercisePhoto
                name={planned.exerciseName}
                exerciseId={planned.exerciseId}
                size={44}
              />
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
            <View style={styles.stepperRow}>
              <Text style={styles.meta}>Sets</Text>
              <View style={[styles.stepper, { borderColor: withAlpha(theme.accent, 0.35) }]}>
                <TouchableOpacity
                  testID={`split-day-plan-fewer-${planned.id}`}
                  style={styles.iconButton}
                  onPress={() => handleSets(planned, -1)}
                  disabled={planned.targetSets <= 1}
                  accessibilityRole="button"
                  accessibilityLabel={`One set fewer of ${planned.exerciseName}`}
                >
                  <Feather
                    name="minus"
                    size={18}
                    color={planned.targetSets <= 1 ? colors.textMuted : theme.accent}
                  />
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
                  <Feather
                    name="plus"
                    size={18}
                    color={planned.targetSets >= MAX_SETS ? colors.textMuted : theme.accent}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </AppCard>
        ))}

        <SecondaryButton
          testID="split-day-plan-add"
          label={plan.length === 0 ? 'Add an Exercise' : 'Add Another Exercise'}
          icon="plus"
          onPress={() => setPickerOpen(true)}
        />
        <PrimaryButton
          testID="split-day-plan-done"
          label="Done"
          onPress={() => navigation.goBack()}
          accentColor={theme.accent}
          onAccentColor={theme.onAccent}
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
        previous={{
          state: previous,
          addedGroups: plan.map((p) => p.muscleGroup),
          weightUnit,
          sessionName: dayName,
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
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroTitle: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
  },
  heroMuscles: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
    marginTop: 2,
  },
  heroCount: {
    ...typeScale.callout,
    fontFamily: fonts.display,
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  heroLine: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  emptyTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  emptyLine: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  name: {
    ...typeScale.callout,
    fontFamily: fonts.display,
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
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.pill,
  },
  sets: {
    ...typeScale.statSmall,
    color: colors.textPrimary,
    minWidth: 28,
    textAlign: 'center',
  },
  error: {
    ...typeScale.callout,
    color: colors.destructive,
  },
});
