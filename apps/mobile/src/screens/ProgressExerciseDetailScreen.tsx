import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { LoadingState } from '../design/LoadingState';
import { SectionHeader } from '../design/SectionHeader';
import { colors } from '../design/theme';
import { fromKg, roundWeight } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import { ChartPointDetail } from '../progress/ChartPointDetail';
import { MetricCard } from '../progress/MetricCard';
import { ProgressEmptyState } from '../progress/ProgressEmptyState';
import { ProgressionChart } from '../progress/ProgressionChart';
import { progressStyles as styles } from '../progress/progressStyles';
import { TimeRangeSelector } from '../progress/TimeRangeSelector';
import { useProgressTheme } from '../progress/useProgressTheme';
import { fetchExerciseSetHistory, type HistoricalSet } from '../workouts/exerciseHistoryQueries';
import {
  filterByTimeRange,
  summarizeProgress,
  topSetProgressionDetailed,
  type TimeRange,
} from '../workouts/exerciseProgress';
import { fetchOneRepMax, fetchRepPRs, type OneRepMax, type RepPR } from '../workouts/prQueries';
import { deriveMilestones } from '../workouts/progressMilestones';

type Props = RootStackScreenProps<'ProgressExerciseDetail'>;

function formatWeight(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

// The shared "how has this one exercise progressed" destination, reached
// from Overview's "Exercises Improving", Top Sets, 1 Rep Max, PRs, and
// Exercises -- one implementation, reusing the exact same ProgressionChart
// component rather than a bespoke chart per entry point.
export function ProgressExerciseDetailScreen({ route, navigation }: Props) {
  const { exerciseId, exerciseName } = route.params;
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { theme, weightUnit, themeLoading } = useProgressTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoricalSet[]>([]);
  const [repPRs, setRepPRs] = useState<RepPR[]>([]);
  const [oneRepMax, setOneRepMax] = useState<OneRepMax | null>(null);
  const [range, setRange] = useState<TimeRange>('3m');
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  // Only the very first load for this exerciseId should replace the whole
  // screen with a spinner -- every later call (the focus listener below) is
  // a background refresh, same pattern as DashboardScreen/ProfileScreen.
  // Reset when exerciseId itself changes since that's genuinely new data (a
  // real edge case: navigation.setParams onto an already-mounted instance,
  // rather than the usual fresh push/fresh mount).
  const hasLoadedOnce = useRef(false);
  useEffect(() => {
    hasLoadedOnce.current = false;
  }, [exerciseId]);

  const load = useCallback(async () => {
    if (!userId) return;
    if (!hasLoadedOnce.current) setLoading(true);
    setError(null);
    try {
      const [fetchedHistory, prs, orm] = await Promise.all([
        fetchExerciseSetHistory(userId, exerciseId),
        fetchRepPRs(userId, exerciseId),
        fetchOneRepMax(userId, exerciseId),
      ]);
      setHistory(fetchedHistory);
      setRepPRs(prs);
      setOneRepMax(orm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load progress');
    } finally {
      setLoading(false);
      hasLoadedOnce.current = true;
    }
  }, [userId, exerciseId]);

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  const allTimePoints = useMemo(() => topSetProgressionDetailed(history), [history]);
  const rangeFilteredSets = useMemo(() => filterByTimeRange(history, range), [history, range]);
  const chartDetailPoints = useMemo(
    () => topSetProgressionDetailed(rangeFilteredSets),
    [rangeFilteredSets],
  );
  const chartPoints = useMemo(
    () =>
      chartDetailPoints.map((p) => ({
        x: new Date(p.performedAt).getTime(),
        y: roundWeight(fromKg(p.weightKg, weightUnit)),
      })),
    [chartDetailPoints, weightUnit],
  );
  const summary = useMemo(() => summarizeProgress(allTimePoints), [allTimePoints]);
  const milestones = useMemo(
    () => deriveMilestones(allTimePoints, weightUnit),
    [allTimePoints, weightUnit],
  );

  useEffect(() => {
    setSelectedPointIndex(null);
  }, [range]);

  if (loading || themeLoading) {
    return <LoadingState testID="progress-exercise-detail-loading" />;
  }

  const latest = allTimePoints[allTimePoints.length - 1] ?? null;
  const selectedDetail = selectedPointIndex !== null ? chartDetailPoints[selectedPointIndex] : null;
  const previousDetail =
    selectedPointIndex !== null && selectedPointIndex > 0
      ? chartDetailPoints[selectedPointIndex - 1]
      : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        testID="progress-exercise-detail-scroll"
      >
        <View style={styles.header}>
          <TouchableOpacity
            testID="progress-exercise-detail-back"
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back"
            accessibilityRole="button"
            style={styles.menuButton}
          >
            <Feather name="arrow-left" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{exerciseName}</Text>
        </View>

        {error ? (
          <Text testID="progress-exercise-detail-error" style={styles.errorText}>
            {error}
          </Text>
        ) : null}

        {allTimePoints.length === 0 ? (
          <ProgressEmptyState
            testID="progress-exercise-detail-empty"
            title="Complete a workout to start tracking this exercise."
            icon="trending-up"
          />
        ) : (
          <>
            {latest ? (
              <Text testID="progress-exercise-detail-current" style={styles.featuredCurrent}>
                {formatWeight(roundWeight(fromKg(latest.weightKg, weightUnit)))}
                {weightUnit} × {latest.reps}
              </Text>
            ) : null}
            {summary ? (
              <Text
                testID="progress-exercise-detail-delta"
                style={[
                  styles.featuredDelta,
                  { color: summary.deltaKg >= 0 ? theme.accent : colors.destructive },
                ]}
              >
                {summary.deltaKg >= 0 ? '+' : ''}
                {formatWeight(roundWeight(fromKg(summary.deltaKg, weightUnit)))}
                {weightUnit} since first recorded
              </Text>
            ) : null}

            <TimeRangeSelector
              value={range}
              onChange={setRange}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
            />

            {chartPoints.length > 0 ? (
              <ProgressionChart
                testID="progress-exercise-detail-chart"
                points={chartPoints}
                color={theme.accent}
                selectedIndex={selectedPointIndex}
                onSelectIndex={setSelectedPointIndex}
              />
            ) : (
              <ProgressEmptyState
                testID="progress-exercise-detail-chart-empty"
                title="Not enough data yet"
              />
            )}

            {selectedDetail ? (
              <ChartPointDetail
                testID="progress-exercise-detail-point-detail"
                accentColor={theme.accent}
                onDismiss={() => setSelectedPointIndex(null)}
                data={{
                  exerciseName,
                  weightDisplay: roundWeight(fromKg(selectedDetail.weightKg, weightUnit)),
                  reps: selectedDetail.reps,
                  performedAt: selectedDetail.performedAt,
                  unit: weightUnit,
                  volumeDisplay: roundWeight(
                    fromKg(selectedDetail.weightKg, weightUnit) * selectedDetail.reps,
                  ),
                  previous: previousDetail
                    ? {
                        weightDisplay: roundWeight(fromKg(previousDetail.weightKg, weightUnit)),
                        reps: previousDetail.reps,
                      }
                    : null,
                  trueOneRepMaxDisplay:
                    selectedDetail.reps === 1
                      ? roundWeight(fromKg(selectedDetail.weightKg, weightUnit))
                      : null,
                }}
              />
            ) : null}

            <View style={styles.section}>
              <SectionHeader label="Best Performances" />
              <View style={styles.metricsGrid}>
                <MetricCard
                  testID="progress-exercise-detail-metric-1rm"
                  label="1RM"
                  value={oneRepMax ? roundWeight(fromKg(oneRepMax.weightKg, weightUnit)) : null}
                  unit={weightUnit}
                  emptyLabel="No 1RM recorded yet"
                />
                <MetricCard
                  testID="progress-exercise-detail-metric-prs"
                  label="Rep PRs"
                  value={repPRs.length}
                />
              </View>
            </View>

            {milestones.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader label="Progression Journey" />
                {milestones.map((m, i) => (
                  <View
                    key={`${m.kind}-${m.achievedAt}-${i}`}
                    testID={`progress-exercise-detail-milestone-${i}`}
                    style={styles.milestoneRow}
                  >
                    <View style={[styles.milestoneDot, { backgroundColor: theme.accent }]} />
                    <View>
                      <Text style={styles.milestoneLabel}>{m.label}</Text>
                      <Text style={styles.milestoneDate}>
                        {new Date(m.achievedAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
