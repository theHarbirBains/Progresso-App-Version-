import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { PrimaryButton, TextButton } from '../design/Button';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { StatBlock } from '../design/StatBlock';
import { colors } from '../design/theme';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { addMonths, isoToLocalDateKey, toLocalDateKey } from '../workouts/calendarGrid';
import { MonthCalendar } from '../workouts/MonthCalendar';
import { SPLIT_MUSCLE_GROUP_LABELS } from '../workouts/splitMuscleGroups';
import { formatCardDate, formatCardDuration } from '../workouts/workoutFormat';
import {
  enrichWorkoutSummaries,
  type EnrichedWorkoutSummary,
} from '../workouts/workoutHistoryEnrichment';
import { computeMonthSummary, formatTotalTime } from '../workouts/workoutMonthSummary';
import {
  fetchActiveWorkout,
  fetchWorkoutHistory,
  fetchWorkoutsForMonth,
  type WorkoutSummary,
} from '../workouts/workoutQueries';
import { workoutHistoryStyles as styles } from './workoutHistoryStyles';

const RECENT_PAGE_SIZE = 20;

type Props = RootStackScreenProps<'WorkoutHistory'>;

export interface WorkoutRowProps {
  workout: EnrichedWorkoutSummary;
  /** A hairline above the row -- every row but the first in a list. */
  divider?: boolean;
  onPress: () => void;
}

// One completed workout as a row (sat inside a widget): the split day (or the workout's own
// name), the muscles trained, and one muted line of date, duration and sets.
export function WorkoutRow({ workout, divider, onPress }: WorkoutRowProps) {
  const muscles = workout.muscleGroups.map((g) => SPLIT_MUSCLE_GROUP_LABELS[g]).join(' • ');
  return (
    <ListRow
      testID={`workout-item-${workout.id}`}
      title={workout.splitDayName ?? workout.name}
      subtitle={muscles || undefined}
      detail={`${formatCardDate(workout.performedAt)} · ${formatCardDuration(workout.durationMinutes)} · ${workout.completedSetCount} sets`}
      divider={divider}
      onPress={onPress}
    />
  );
}

export function WorkoutHistoryScreen({ navigation }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { theme } = useProgressTheme();
  const { openMenu } = useAppMenu();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const todayKey = toLocalDateKey(now);

  const [activeWorkout, setActiveWorkout] = useState<WorkoutSummary | null>(null);

  const [monthWorkouts, setMonthWorkouts] = useState<EnrichedWorkoutSummary[]>([]);
  const [monthLoading, setMonthLoading] = useState(true);
  const [monthError, setMonthError] = useState<string | null>(null);

  const [recentWorkouts, setRecentWorkouts] = useState<EnrichedWorkoutSummary[]>([]);
  const [recentPage, setRecentPage] = useState(0);
  const [recentHasMore, setRecentHasMore] = useState(false);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentLoadingMore, setRecentLoadingMore] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);

  const loadActive = useCallback(async () => {
    if (!userId) return;
    try {
      setActiveWorkout(await fetchActiveWorkout(userId));
    } catch {
      // The resume banner just stays hidden -- recent/month errors already surface a retry.
    }
  }, [userId]);

  // silent skips the setXLoading(true) that would otherwise blank the
  // calendar/list back to a spinner -- used only for the focus-listener's
  // background refresh below, once this screen has already loaded once.
  // Explicit user actions (switching months, "Load More") always pass the
  // default (loud) so they keep their own real loading feedback.
  const loadMonth = useCallback(
    async (targetYear: number, targetMonth: number, options: { silent?: boolean } = {}) => {
      if (!userId) return;
      if (!options.silent) setMonthLoading(true);
      setMonthError(null);
      try {
        const raw = await fetchWorkoutsForMonth(userId, targetYear, targetMonth);
        setMonthWorkouts(await enrichWorkoutSummaries(raw));
      } catch (err) {
        setMonthError(err instanceof Error ? err.message : 'Failed to load workouts');
      } finally {
        setMonthLoading(false);
      }
    },
    [userId],
  );

  const loadRecent = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!userId) return;
      if (!options.silent) setRecentLoading(true);
      setRecentError(null);
      try {
        const history = await fetchWorkoutHistory(userId, 0, RECENT_PAGE_SIZE);
        setRecentWorkouts(await enrichWorkoutSummaries(history.rows));
        setRecentHasMore(history.hasMore);
        setRecentPage(0);
      } catch (err) {
        setRecentError(err instanceof Error ? err.message : 'Failed to load workouts');
      } finally {
        setRecentLoading(false);
      }
    },
    [userId],
  );

  // Only the very first focus should replace the calendar/list with
  // spinners -- every later focus (returning here after starting/completing
  // a workout) is a background refresh, same pattern as
  // DashboardScreen/ProfileScreen. loadActive never blanks anything itself
  // (no loading flag of its own), so it isn't silenced.
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    // Re-load every time this screen gains focus, not just on mount -- same
    // established convention as before, now covering all three data sources
    // (active workout, the viewed month, and the recent list) so returning
    // here after starting/completing a workout shows current data.
    const unsubscribe = navigation.addListener('focus', () => {
      const silent = hasLoadedOnce.current;
      loadActive();
      loadMonth(year, month, { silent });
      loadRecent({ silent });
      hasLoadedOnce.current = true;
    });
    return unsubscribe;
  }, [navigation, loadActive, loadMonth, loadRecent, year, month]);

  function handlePrevMonth() {
    const next = addMonths(year, month, -1);
    setYear(next.year);
    setMonth(next.month);
    setSelectedDateKey(null);
    loadMonth(next.year, next.month);
  }

  function handleNextMonth() {
    const next = addMonths(year, month, 1);
    setYear(next.year);
    setMonth(next.month);
    setSelectedDateKey(null);
    loadMonth(next.year, next.month);
  }

  function handleSelectDate(dateKey: string) {
    setSelectedDateKey((prev) => (prev === dateKey ? null : dateKey));
  }

  async function handleLoadMoreRecent() {
    if (!userId || recentLoadingMore || !recentHasMore) return;
    setRecentLoadingMore(true);
    try {
      const next = recentPage + 1;
      const history = await fetchWorkoutHistory(userId, next, RECENT_PAGE_SIZE);
      const enriched = await enrichWorkoutSummaries(history.rows);
      setRecentWorkouts((prev) => [...prev, ...enriched]);
      setRecentHasMore(history.hasMore);
      setRecentPage(next);
    } catch (err) {
      setRecentError(err instanceof Error ? err.message : 'Failed to load workouts');
    } finally {
      setRecentLoadingMore(false);
    }
  }

  const completedDateKeys = new Set(monthWorkouts.map((w) => isoToLocalDateKey(w.performedAt)));
  const monthSummary = computeMonthSummary(monthWorkouts);
  const selectedDayWorkouts = selectedDateKey
    ? monthWorkouts.filter((w) => isoToLocalDateKey(w.performedAt) === selectedDateKey)
    : [];

  const hasAnyHistory = recentWorkouts.length > 0;
  const showEmptyState = !recentLoading && !recentError && !activeWorkout && !hasAnyHistory;

  return (
    <Screen
      contentContainerStyle={styles.content}
      header={
        <AppHeader
          testID="workout-history-header"
          title="Workouts"
          leftAction={{
            icon: 'menu',
            onPress: () => openMenu('workout'),
            accessibilityLabel: 'Open menu',
            testID: 'workout-history-open-menu',
          }}
        />
      }
    >
      {activeWorkout ? (
        <AppCard hero topAccent={theme.accent} testID="active-workout-banner">
          <Text style={styles.actionLine}>You have a workout in progress</Text>
          <PrimaryButton
            testID="resume-active-workout"
            label={`Resume "${activeWorkout.name}"`}
            onPress={() => navigation.navigate('ActiveWorkout', { workoutId: activeWorkout.id })}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />
        </AppCard>
      ) : (
        <AppCard hero topAccent={theme.accent} testID="workout-history-start">
          <Text style={styles.actionLine}>Ready to train?</Text>
          <PrimaryButton
            testID="start-new-workout"
            label="Start New Workout"
            onPress={() => navigation.navigate('NewWorkout')}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />
        </AppCard>
      )}

      <AppCard testID="workout-history-calendar-card">
        <MonthCalendar
          testID="workout-calendar"
          year={year}
          month={month}
          completedDateKeys={completedDateKeys}
          selectedDateKey={selectedDateKey}
          todayKey={todayKey}
          accentColor={theme.accent}
          onAccentColor={theme.onAccent}
          onSelectDate={handleSelectDate}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
        />

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.accent }]} />
            <Text style={styles.legendLabel}>Completed</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.accent }]} />
            <Text style={styles.legendLabel}>Today</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.border }]} />
            <Text style={styles.legendLabel}>No workout</Text>
          </View>
        </View>

        {monthError ? (
          <Text testID="workout-month-error" style={styles.errorText}>
            {monthError}
          </Text>
        ) : monthLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator
              testID="workout-month-loading"
              size="large"
              color={colors.textPrimary}
            />
          </View>
        ) : (
          <View testID="workout-month-summary" style={styles.summaryRow}>
            <StatBlock
              testID="workout-month-total"
              value={String(monthSummary.totalWorkouts)}
              label="Workouts"
            />
            <StatBlock
              testID="workout-month-time"
              value={formatTotalTime(monthSummary.totalMinutes)}
              label="Total Time"
            />
            <StatBlock
              testID="workout-month-sets"
              value={String(monthSummary.totalSets)}
              label="Total Sets"
            />
          </View>
        )}
      </AppCard>

      {selectedDateKey ? (
        <AppCard testID="selected-day-section">
          <SectionHeader
            label={new Date(selectedDateKey).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          />
          {selectedDayWorkouts.length > 0 ? (
            selectedDayWorkouts.map((workout, index) => (
              <WorkoutRow
                key={workout.id}
                workout={workout}
                divider={index > 0}
                onPress={() => navigation.navigate('WorkoutDetail', { workoutId: workout.id })}
              />
            ))
          ) : (
            <EmptyState testID="selected-day-empty" title="No workout on this day" />
          )}
        </AppCard>
      ) : null}

      <AppCard testID="workout-history-recent">
        <SectionHeader label="Recent Workouts" />

        {recentError ? (
          <ErrorState testID="workout-history-error" message={recentError} onRetry={loadRecent} />
        ) : recentLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator
              testID="workout-history-loading"
              size="large"
              color={colors.textPrimary}
            />
          </View>
        ) : showEmptyState ? (
          <EmptyState
            testID="workout-history-empty"
            title="No workouts yet. Complete your first workout and your training history will appear here."
          />
        ) : (
          recentWorkouts.map((workout, index) => (
            <WorkoutRow
              key={workout.id}
              workout={workout}
              divider={index > 0}
              onPress={() => navigation.navigate('WorkoutDetail', { workoutId: workout.id })}
            />
          ))
        )}

        {recentHasMore ? (
          <TextButton
            testID="workout-history-load-more"
            label="Load More"
            loading={recentLoadingMore}
            onPress={handleLoadMoreRecent}
          />
        ) : null}
      </AppCard>
    </Screen>
  );
}
