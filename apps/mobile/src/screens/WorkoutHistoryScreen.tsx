import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { addMonths, isoToLocalDateKey, toLocalDateKey } from '../design/calendarGrid';
import { Card } from '../design/Card';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { MonthCalendar } from '../design/MonthCalendar';
import { PrimaryButton, TextButton } from '../design/Button';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { StatBlock } from '../design/StatBlock';
import { colors, radii } from '../design/theme';
import { FeedHeroCard } from '../feed/FeedHeroCard';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { Skeleton, SkeletonRows } from '../design/Skeleton';
import { recallShown, rememberShown } from '../lib/lastShown';
import { useAllTimeStats } from '../progress/AllTimeStatsProvider';
import { useProgressTheme } from '../progress/useProgressTheme';
import { computeNextWorkout, type NextWorkoutPlan } from '../workouts/nextWorkout';
import { SPLIT_MUSCLE_GROUP_LABELS } from '../workouts/splitMuscleGroups';
import { startPlannedWorkout } from '../workouts/startPlannedWorkout';
import { UnfinishedWorkoutSheet } from '../workouts/UnfinishedWorkoutSheet';
import {
  assessUnfinishedWorkout,
  toUnfinishedWorkoutInput,
  type UnfinishedWorkoutAssessment,
} from '../workouts/unfinishedWorkoutState';
import { formatCardDate, formatCardDuration } from '../workouts/workoutFormat';
import {
  enrichWorkoutSummaries,
  type EnrichedWorkoutSummary,
} from '../workouts/workoutHistoryEnrichment';
import { computeMonthSummary, formatTotalTime } from '../workouts/workoutMonthSummary';
import {
  completeWorkout,
  fetchActiveWorkout,
  fetchWorkoutDetail,
  fetchWorkoutHistory,
  fetchWorkoutsForMonth,
  type WorkoutSummary,
} from '../workouts/workoutQueries';
import {
  fetchLastWorkoutSplitDayId,
  fetchWorkoutSplitDetail,
} from '../workouts/workoutSplitQueries';
import { workoutHistoryStyles as styles } from './workoutHistoryStyles';

const RECENT_PAGE_SIZE = 20;

// "5 min ago", "1h 5m ago" -- the banner's idle indicator, how long since the last set.
function formatIdleMinutes(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min ago`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${hours}h ago` : `${formatCardDuration(rounded)} ago`;
}

type Props = RootStackScreenProps<'WorkoutHistory'>;

function musclesLabel(day: NextWorkoutPlan['day']): string {
  return day.muscleGroups.map((g) => SPLIT_MUSCLE_GROUP_LABELS[g]).join(' • ');
}

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
  const { theme, activeWorkoutSplitId, themeLoading } = useProgressTheme();
  const { openMenu } = useAppMenu();
  const { refetch: refetchAllTimeStats } = useAllTimeStats();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const todayKey = toLocalDateKey(now);

  const [activeWorkout, setActiveWorkout] = useState<WorkoutSummary | null>(null);

  // What this page showed last time (lib/lastShown.ts): a reopened Train page
  // starts from it -- no spinners -- and refreshes in the background as always.
  const [shown] = useState(() => ({
    month: recallShown<EnrichedWorkoutSummary[]>(userId, `history.month.${year}-${month}`),
    recent: recallShown<{ rows: EnrichedWorkoutSummary[]; hasMore: boolean }>(
      userId,
      'history.recent',
    ),
    nextPlan: recallShown<NextWorkoutPlan | null>(userId, 'history.nextPlan'),
  }));
  const [monthWorkouts, setMonthWorkouts] = useState<EnrichedWorkoutSummary[]>(shown.month ?? []);
  const [monthLoading, setMonthLoading] = useState(!shown.month);
  const [monthError, setMonthError] = useState<string | null>(null);

  const [recentWorkouts, setRecentWorkouts] = useState<EnrichedWorkoutSummary[]>(
    shown.recent?.rows ?? [],
  );
  const [recentPage, setRecentPage] = useState(0);
  const [recentHasMore, setRecentHasMore] = useState(shown.recent?.hasMore ?? false);
  const [recentLoading, setRecentLoading] = useState(!shown.recent);
  const [recentLoadingMore, setRecentLoadingMore] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);

  // The next workout of the active split -- worked out exactly as Feed's (computeNextWorkout:
  // the day after the last one done; a missed workout never moves it on). Undefined until known.
  const [nextPlan, setNextPlan] = useState<NextWorkoutPlan | null | undefined>(shown.nextPlan);
  const [startingNext, setStartingNext] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const [activeAssessment, setActiveAssessment] = useState<UnfinishedWorkoutAssessment | null>(
    null,
  );
  const [promptOpen, setPromptOpen] = useState(false);
  const [finishingSuggested, setFinishingSuggested] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  // Workouts the user already waved off with "Not now" this session. The
  // prompt is only ever raised once per workout per session -- a forgotten
  // workout still shows the banner, but never nags on every refocus.
  const dismissedPromptIdsRef = useRef(new Set<string>());

  const loadActive = useCallback(async () => {
    if (!userId) return;
    let active: WorkoutSummary | null;
    try {
      active = await fetchActiveWorkout(userId);
    } catch {
      // The resume banner just stays hidden -- recent/month errors already surface a retry.
      return;
    }
    setActiveWorkout(active);
    if (!active) {
      setActiveAssessment(null);
      setPromptOpen(false);
      return;
    }
    try {
      const detail = await fetchWorkoutDetail(active.id);
      const assessment = assessUnfinishedWorkout(toUnfinishedWorkoutInput(detail), new Date());
      setActiveAssessment(assessment);
      const shouldPrompt =
        assessment.state === 'suspected_complete' && !dismissedPromptIdsRef.current.has(active.id);
      setPromptOpen(shouldPrompt);
    } catch {
      // Assessment is an extra on top of the banner: if it can't load, the banner still works.
      setActiveAssessment(null);
      setPromptOpen(false);
    }
  }, [userId]);

  // Read on every focus, like this page's other lists: finishing a workout (one hop away) is
  // what moves it on.
  const loadNext = useCallback(async () => {
    if (!userId || !activeWorkoutSplitId) {
      setNextPlan(null);
      return;
    }
    try {
      const [detail, lastDayId] = await Promise.all([
        fetchWorkoutSplitDetail(activeWorkoutSplitId),
        fetchLastWorkoutSplitDayId(userId),
      ]);
      const plan = computeNextWorkout(detail, lastDayId);
      setNextPlan(plan);
      rememberShown(userId, 'history.nextPlan', plan);
    } catch {
      // Starting a workout is still one tap away (Start New Workout) -- not worth an error.
      setNextPlan(null);
    }
  }, [userId, activeWorkoutSplitId]);

  // The active split arrives with the profile, after the first focus.
  useEffect(() => {
    if (!themeLoading) void loadNext();
  }, [themeLoading, loadNext]);
  const loadNextRef = useRef(loadNext);
  loadNextRef.current = loadNext;

  // Starts the next day straight from here, its plan copied in, as Start Workout does.
  async function startNext(plan: NextWorkoutPlan) {
    if (!userId || startingNext) return;
    setStartError(null);
    setStartingNext(true);
    try {
      const result = await startPlannedWorkout(userId, plan.day.name, plan.day.id);
      if (result.type === 'conflict') {
        setStartError('You already have a workout going -- resume it above.');
        await loadActive();
        return;
      }
      navigation.navigate('ActiveWorkout', result.params);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Failed to start workout');
    } finally {
      setStartingNext(false);
    }
  }

  async function finishSuggested() {
    if (!activeWorkout || !activeAssessment?.suggestedEndAt || finishingSuggested) return;
    setFinishError(null);
    setFinishingSuggested(true);
    try {
      await completeWorkout(activeWorkout.id, activeAssessment.suggestedEndAt);
      // Same stats refresh as a live Finish in ActiveWorkoutScreen.
      void refetchAllTimeStats();
      navigation.reset({
        index: 1,
        routes: [
          { name: 'WorkoutHistory' },
          { name: 'ShareWorkout', params: { workoutId: activeWorkout.id } },
        ],
      });
    } catch (err) {
      setFinishError(err instanceof Error ? err.message : 'Failed to finish workout');
      setFinishingSuggested(false);
    }
  }

  function notNowSuggested() {
    if (activeWorkout) dismissedPromptIdsRef.current.add(activeWorkout.id);
    setPromptOpen(false);
  }

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
        const enriched = await enrichWorkoutSummaries(raw);
        setMonthWorkouts(enriched);
        rememberShown(userId, `history.month.${targetYear}-${targetMonth}`, enriched);
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
        const rows = await enrichWorkoutSummaries(history.rows);
        setRecentWorkouts(rows);
        setRecentHasMore(history.hasMore);
        setRecentPage(0);
        rememberShown(userId, 'history.recent', { rows, hasMore: history.hasMore });
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
  const hasLoadedOnce = useRef(Boolean(shown.month && shown.recent));

  useEffect(() => {
    // Re-load every time this screen gains focus, not just on mount -- same
    // established convention as before, now covering all three data sources
    // (active workout, the viewed month, and the recent list) so returning
    // here after starting/completing a workout shows current data.
    const unsubscribe = navigation.addListener('focus', () => {
      const silent = hasLoadedOnce.current;
      loadActive();
      void loadNextRef.current();
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

  const markedDateKeys = new Set(monthWorkouts.map((w) => isoToLocalDateKey(w.performedAt)));
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
            onPress: () => openMenu(),
            accessibilityLabel: 'Open menu',
            testID: 'workout-history-open-menu',
          }}
        />
      }
    >
      {activeWorkout ? (
        <Card hero testID="active-workout-banner">
          <Text style={[styles.actionLine, { color: colors.textPrimary }]}>
            You have a workout in progress
          </Text>
          {activeAssessment?.state === 'possibly_inactive' ? (
            <Text
              testID="active-workout-idle-indicator"
              style={[styles.actionLine, { color: colors.textPrimary }]}
            >
              {`Last set logged ${formatIdleMinutes(activeAssessment.idleMinutes)}`}
            </Text>
          ) : null}
          <PrimaryButton
            testID="resume-active-workout"
            label={`Resume "${activeWorkout.name}"`}
            onPress={() => navigation.navigate('ActiveWorkout', { workoutId: activeWorkout.id })}
            accentColor={colors.heroAction}
            onAccentColor={colors.onAccent}
          />
        </Card>
      ) : nextPlan ? (
        <FeedHeroCard
          testID="workout-history-next"
          eyebrow="Next Workout"
          title={nextPlan.day.name}
          muscles={nextPlan.day.muscleGroups.length > 0 ? musclesLabel(nextPlan.day) : null}
          meta={
            nextPlan.previousDayName
              ? `Up next after ${nextPlan.previousDayName}`
              : "Let's get started"
          }
          actionLabel={startingNext ? 'Starting…' : 'Start Workout'}
          onPress={() => void startNext(nextPlan)}
          accessibilityLabel={`Start ${nextPlan.day.name} workout${
            nextPlan.day.muscleGroups.length > 0 ? `, ${musclesLabel(nextPlan.day)}` : ''
          }`}
        />
      ) : nextPlan === undefined && (themeLoading || activeWorkoutSplitId) ? (
        <Skeleton testID="workout-history-next-loading" height={176} radius={radii.lg} />
      ) : (
        <Card hero testID="workout-history-start">
          <Text style={[styles.actionLine, { color: colors.textPrimary }]}>
            {activeWorkoutSplitId || themeLoading
              ? 'Ready to train?'
              : 'Choose a workout split, and the next day is always one tap away.'}
          </Text>
          <PrimaryButton
            testID="start-new-workout"
            label="Start New Workout"
            onPress={() => navigation.navigate('NewWorkout')}
            accentColor={colors.heroAction}
            onAccentColor={colors.onAccent}
          />
        </Card>
      )}

      {startError ? (
        <Text testID="workout-history-start-error" style={styles.startError}>
          {startError}
        </Text>
      ) : null}

      <View style={styles.logPastWorkoutWrap}>
        {/* The split's other days, a group, or something different: Start Workout's own page. */}
        {nextPlan && !activeWorkout ? (
          <TextButton
            testID="workout-history-other-workout"
            label="Choose a Different Workout"
            onPress={() => navigation.navigate('NewWorkout')}
          />
        ) : null}
        {!activeWorkout && !activeWorkoutSplitId && !themeLoading ? (
          <TextButton
            testID="workout-history-choose-split"
            label="Choose a Workout Split"
            onPress={() => navigation.navigate('ChooseWorkoutSplit')}
          />
        ) : null}
        <TextButton
          testID="workout-history-log-past"
          label="Log a Past Workout"
          onPress={() => navigation.navigate('LogPastWorkout')}
        />
      </View>

      <Card testID="workout-history-calendar-card">
        <MonthCalendar
          testID="workout-calendar"
          year={year}
          month={month}
          markedDateKeys={markedDateKeys}
          markedDescription="workout completed"
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
          <Skeleton testID="workout-month-loading" height={280} radius={radii.lg} />
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
      </Card>

      {selectedDateKey ? (
        <Card testID="selected-day-section">
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
        </Card>
      ) : null}

      <Card testID="workout-history-recent">
        <SectionHeader label="Recent Workouts" />

        {recentError ? (
          <ErrorState testID="workout-history-error" message={recentError} onRetry={loadRecent} />
        ) : recentLoading ? (
          <SkeletonRows testID="workout-history-loading" count={4} />
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
      </Card>
      {activeWorkout && activeAssessment ? (
        <UnfinishedWorkoutSheet
          visible={promptOpen}
          workoutName={activeWorkout.name}
          assessment={activeAssessment}
          finishing={finishingSuggested}
          onFinish={() => void finishSuggested()}
          onResume={() => {
            setPromptOpen(false);
            navigation.navigate('ActiveWorkout', { workoutId: activeWorkout.id });
          }}
          onNotNow={notNowSuggested}
        />
      ) : null}
      {finishError ? <Text testID="finish-suggested-error">{finishError}</Text> : null}
    </Screen>
  );
}
