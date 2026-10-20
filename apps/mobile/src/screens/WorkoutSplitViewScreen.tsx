import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { Text } from '../design/Text';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { EmptyState } from '../design/EmptyState';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { SPLIT_MUSCLE_GROUP_LABELS } from '../workouts/splitMuscleGroups';
import { computeNextWorkout } from '../workouts/nextWorkout';
import { fetchPlansForDays, type PlannedExercise } from '../workouts/splitPlanQueries';
import {
  fetchLastWorkoutSplitDayId,
  fetchWorkoutSplitDetail,
  type WorkoutSplitDetail,
} from '../workouts/workoutSplitQueries';
import { workoutSplitStyles as styles } from './workoutSplitStyles';

type Props = RootStackScreenProps<'WorkoutSplitView'>;

/** "4 exercises · 14 sets", or that none are planned. */
function planSummary(plan: PlannedExercise[]): string {
  if (plan.length === 0) return 'No exercises planned';
  const sets = plan.reduce((sum, planned) => sum + planned.targetSets, 0);
  return `${plan.length} ${plan.length === 1 ? 'exercise' : 'exercises'} · ${sets} sets`;
}

// Read-only presentation of a split's days/muscle groups -- reached by
// tapping a split in WorkoutSplitsScreen. Deliberately not the same screen
// as WorkoutSplitFormScreen: that screen auto-saves every change
// immediately, so simply wanting to look at a split's structure shouldn't
// risk editing it. Editing is one explicit tap away via the header button.
//
// Layout: the days are plain blocks (name, then its muscle groups as one
// line of text, then its planned exercises -- "4 exercises · 14 sets" or "No
// exercises planned"), each opening its plan (SplitDayPlan). Muscle groups
// here are information, not controls, so they are not chips or badges. On
// the active split, the day Start Workout will suggest is marked "Next" --
// the day after the last one done, so a missed workout never moves it on.
export function WorkoutSplitViewScreen({ navigation, route }: Props) {
  const { splitId } = route.params;
  const { theme, themeLoading, activeWorkoutSplitId } = useProgressTheme();
  const { user } = useAuth();
  const userId = user?.id;

  const [detail, setDetail] = useState<WorkoutSplitDetail | null>(null);
  const [plans, setPlans] = useState<Map<string, PlannedExercise[]>>(new Map());
  const [nextDayId, setNextDayId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Only the very first load for this splitId should replace the whole
  // screen with a spinner -- every later call (the focus listener below) is
  // a background refresh, same pattern as DashboardScreen/ProfileScreen.
  const hasLoadedOnce = useRef(false);
  useEffect(() => {
    hasLoadedOnce.current = false;
  }, [splitId]);

  const load = useCallback(async () => {
    if (!hasLoadedOnce.current) setLoading(true);
    setError(null);
    try {
      const next = await fetchWorkoutSplitDetail(splitId);
      setDetail(next);
      // The plans and the next day are extras: a failure leaves the days as they are.
      const dayIds = next.days.map((day) => day.id);
      setPlans(await fetchPlansForDays(dayIds).catch(() => new Map()));
      if (userId && activeWorkoutSplitId === next.id) {
        const lastDayId = await fetchLastWorkoutSplitDayId(userId).catch(() => null);
        setNextDayId(computeNextWorkout(next, lastDayId)?.day.id ?? null);
      } else {
        setNextDayId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workout split');
    } finally {
      setLoading(false);
      hasLoadedOnce.current = true;
    }
  }, [splitId, userId, activeWorkoutSplitId]);

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  if (loading || themeLoading) {
    return <LoadingState testID="workout-split-view-loading" />;
  }

  return (
    <Screen
      scrollTestID="workout-split-view-scroll"
      contentContainerStyle={styles.listContent}
      header={
        <AppHeader
          title={detail?.name ?? 'Workout Split'}
          leftAction={{
            icon: 'arrow-left',
            onPress: () => navigation.goBack(),
            accessibilityLabel: 'Back',
            testID: 'workout-split-view-back',
          }}
          rightAction={
            detail
              ? {
                  icon: 'edit-2',
                  onPress: () => navigation.navigate('WorkoutSplitForm', { splitId: detail.id }),
                  accessibilityLabel: 'Edit split',
                  testID: 'workout-split-view-edit',
                }
              : undefined
          }
        />
      }
    >
      {error ? (
        <Text testID="workout-split-view-error" style={styles.errorText}>
          {error}
        </Text>
      ) : null}

      {detail && detail.days.length === 0 ? (
        <EmptyState testID="workout-split-view-empty" title="This split has no days yet." />
      ) : null}

      {detail?.days.map((day) => (
        <AppCard key={day.id} testID={`workout-split-view-day-${day.id}`}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayName}>{day.name}</Text>
            {day.id === nextDayId ? (
              <Text
                testID={`workout-split-view-day-${day.id}-next`}
                style={[styles.nextMark, { color: theme.accent }]}
              >
                Next
              </Text>
            ) : null}
          </View>
          {day.muscleGroups.length > 0 ? (
            <View style={styles.muscleLine}>
              {day.muscleGroups.map((group, groupIndex) => (
                <Fragment key={group}>
                  {groupIndex > 0 ? <Text style={styles.muscleSeparator}>·</Text> : null}
                  <Text
                    testID={`workout-split-view-day-${day.id}-muscle-${group}`}
                    style={styles.muscleLabel}
                  >
                    {SPLIT_MUSCLE_GROUP_LABELS[group]}
                  </Text>
                </Fragment>
              ))}
            </View>
          ) : (
            <Text testID={`workout-split-view-day-${day.id}-no-groups`} style={styles.noGroups}>
              No muscle groups set
            </Text>
          )}
          <TouchableOpacity
            testID={`workout-split-view-day-${day.id}-plan`}
            style={styles.planLink}
            onPress={() =>
              navigation.navigate('SplitDayPlan', { dayId: day.id, dayName: day.name })
            }
            accessibilityRole="button"
            accessibilityLabel={`Exercises for ${day.name}`}
          >
            <Text style={styles.planText}>{planSummary(plans.get(day.id) ?? [])}</Text>
            <Text style={[styles.planAction, { color: theme.accent }]}>Plan</Text>
          </TouchableOpacity>
        </AppCard>
      ))}
    </Screen>
  );
}
