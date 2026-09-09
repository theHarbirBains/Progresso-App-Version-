import { useCallback, useEffect, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { BottomNavBar } from '../design/BottomNavBar';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { LoadingState } from '../design/LoadingState';
import { PrimaryButton } from '../design/Button';
import { QuickActionMenu } from '../design/QuickActionMenu';
import { SectionHeader } from '../design/SectionHeader';
import { StatValue } from '../design/StatValue';
import { colors } from '../design/theme';
import type { RootStackScreenProps } from '../navigation/types';
import { useQuickActions } from '../navigation/useQuickActions';
import { useProgressTheme } from '../progress/useProgressTheme';
import { addMonths, isoToLocalDateKey, toLocalDateKey } from '../workouts/calendarGrid';
import { MonthCalendar } from '../workouts/MonthCalendar';
import { SPLIT_MUSCLE_GROUP_LABELS } from '../workouts/splitMuscleGroups';
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

function formatCardDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCardDuration(minutes: number | null): string {
  if (minutes === null) return '--';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest} min`;
}

interface WorkoutCardProps {
  workout: EnrichedWorkoutSummary;
  accentColor: string;
  onPress: () => void;
}

function WorkoutCard({ workout, accentColor, onPress }: WorkoutCardProps) {
  const title = workout.splitDayName ?? workout.name;
  return (
    <AppCard
      testID={`workout-item-${workout.id}`}
      onPress={onPress}
      style={[styles.card, { borderLeftColor: accentColor }]}
    >
      <View style={styles.cardRow}>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{title}</Text>
          {workout.muscleGroups.length > 0 ? (
            <Text style={styles.cardMuscles}>
              {workout.muscleGroups.map((g) => SPLIT_MUSCLE_GROUP_LABELS[g]).join(' • ')}
            </Text>
          ) : null}
          <View style={styles.cardMetaRow}>
            <View style={styles.cardMetaItem}>
              <Feather name="calendar" size={12} color={colors.textMuted} />
              <Text style={styles.cardMetaText}>{formatCardDate(workout.performedAt)}</Text>
            </View>
            <View style={styles.cardMetaItem}>
              <Feather name="clock" size={12} color={colors.textMuted} />
              <Text style={styles.cardMetaText}>{formatCardDuration(workout.durationMinutes)}</Text>
            </View>
            <View style={styles.cardMetaItem}>
              <Feather name="check-square" size={12} color={colors.textMuted} />
              <Text style={styles.cardMetaText}>{workout.completedSetCount} sets</Text>
            </View>
          </View>
        </View>
        <Feather name="chevron-right" size={20} color={colors.textMuted} />
      </View>
    </AppCard>
  );
}

export function WorkoutHistoryScreen({ navigation }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { theme } = useProgressTheme();
  const insets = useSafeAreaInsets();
  const quickActions = useQuickActions(navigation);

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

  const loadMonth = useCallback(
    async (targetYear: number, targetMonth: number) => {
      if (!userId) return;
      setMonthLoading(true);
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

  const loadRecent = useCallback(async () => {
    if (!userId) return;
    setRecentLoading(true);
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
  }, [userId]);

  useEffect(() => {
    // Re-load every time this screen gains focus, not just on mount -- same
    // established convention as before, now covering all three data sources
    // (active workout, the viewed month, and the recent list) so returning
    // here after starting/completing a workout shows current data.
    const unsubscribe = navigation.addListener('focus', () => {
      loadActive();
      loadMonth(year, month);
      loadRecent();
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
    <View style={styles.screen}>
      <FlatList
        data={showEmptyState ? [] : recentWorkouts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 90 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
              <Text style={styles.title}>Workouts</Text>
              <Text style={styles.subtitle}>Your training history. Keep showing up.</Text>
            </View>

            {activeWorkout ? (
              <View style={styles.section}>
                <AppCard testID="active-workout-banner" style={styles.banner}>
                  <Text style={styles.bannerTitle}>You have a workout in progress</Text>
                  <PrimaryButton
                    testID="resume-active-workout"
                    label={`Resume "${activeWorkout.name}"`}
                    onPress={() =>
                      navigation.navigate('ActiveWorkout', { workoutId: activeWorkout.id })
                    }
                  />
                </AppCard>
              </View>
            ) : (
              <View style={styles.section}>
                <PrimaryButton
                  testID="start-new-workout"
                  label="Start New Workout"
                  onPress={() => navigation.navigate('NewWorkout')}
                  accentColor={theme.accent}
                  onAccentColor={theme.onAccent}
                />
              </View>
            )}

            <View style={styles.section}>
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
                <Text testID="workout-month-error" style={styles.summaryError}>
                  {monthError}
                </Text>
              ) : monthLoading ? (
                <LoadingState testID="workout-month-loading" />
              ) : (
                <View testID="workout-month-summary" style={styles.summaryRow}>
                  <View style={styles.summaryStat}>
                    <View style={[styles.summaryIconCircle, { backgroundColor: theme.accentBg }]}>
                      <Feather name="activity" size={16} color={theme.accent} />
                    </View>
                    <View>
                      <StatValue
                        testID="workout-month-total"
                        value={String(monthSummary.totalWorkouts)}
                        size="medium"
                        color={colors.textPrimary}
                      />
                      <Text style={styles.summaryLabel}>Workouts</Text>
                    </View>
                  </View>
                  <View style={styles.summaryStat}>
                    <View style={[styles.summaryIconCircle, { backgroundColor: theme.accentBg }]}>
                      <Feather name="clock" size={16} color={theme.accent} />
                    </View>
                    <View>
                      <StatValue
                        testID="workout-month-time"
                        value={formatTotalTime(monthSummary.totalMinutes)}
                        size="medium"
                        color={colors.textPrimary}
                      />
                      <Text style={styles.summaryLabel}>Total Time</Text>
                    </View>
                  </View>
                  <View style={styles.summaryStat}>
                    <View style={[styles.summaryIconCircle, { backgroundColor: theme.accentBg }]}>
                      <Feather name="check-square" size={16} color={theme.accent} />
                    </View>
                    <View>
                      <StatValue
                        testID="workout-month-sets"
                        value={String(monthSummary.totalSets)}
                        size="medium"
                        color={colors.textPrimary}
                      />
                      <Text style={styles.summaryLabel}>Total Sets</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {selectedDateKey ? (
              <View testID="selected-day-section" style={styles.section}>
                <SectionHeader
                  label={new Date(selectedDateKey).toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                />
                {selectedDayWorkouts.length > 0 ? (
                  selectedDayWorkouts.map((workout) => (
                    <WorkoutCard
                      key={workout.id}
                      workout={workout}
                      accentColor={theme.accent}
                      onPress={() =>
                        navigation.navigate('WorkoutDetail', { workoutId: workout.id })
                      }
                    />
                  ))
                ) : (
                  <EmptyState testID="selected-day-empty" title="No workout on this day" />
                )}
              </View>
            ) : null}

            <View style={[styles.section, styles.sectionHeaderRow]}>
              <SectionHeader label="Recent Workouts" />
            </View>

            {recentError ? (
              <View style={styles.section}>
                <ErrorState
                  testID="workout-history-error"
                  message={recentError}
                  onRetry={loadRecent}
                />
              </View>
            ) : recentLoading ? (
              <LoadingState testID="workout-history-loading" />
            ) : showEmptyState ? (
              <View style={styles.section}>
                <EmptyState
                  testID="workout-history-empty"
                  title="No workouts yet. Complete your first workout and your training history will appear here."
                />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.section}>
            <WorkoutCard
              workout={item}
              accentColor={theme.accent}
              onPress={() => navigation.navigate('WorkoutDetail', { workoutId: item.id })}
            />
          </View>
        )}
        ListFooterComponent={
          recentHasMore ? (
            <TouchableOpacity
              testID="workout-history-load-more"
              style={styles.loadMoreButton}
              onPress={handleLoadMoreRecent}
              disabled={recentLoadingMore}
            >
              {recentLoadingMore ? (
                <LoadingState testID="workout-history-load-more-loading" />
              ) : (
                <Text style={styles.loadMoreText}>Load More</Text>
              )}
            </TouchableOpacity>
          ) : null
        }
      />

      <BottomNavBar
        testID="workouts-bottom-bar"
        active="workouts"
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
        paddingBottom={Math.max(insets.bottom, 8)}
        onNavigateHome={() => navigation.navigate('Dashboard')}
        onNavigateWorkouts={() => {}}
        onNavigateProgress={() => navigation.navigate('ProgressOverview')}
        onNavigateSocial={() => navigation.navigate('Social')}
        onPressPlus={quickActions.open}
      />

      <QuickActionMenu
        visible={quickActions.visible}
        onClose={quickActions.close}
        onStartWorkout={quickActions.onStartWorkout}
        onLogFood={quickActions.onLogFood}
        accentColor={theme.accent}
      />
    </View>
  );
}
