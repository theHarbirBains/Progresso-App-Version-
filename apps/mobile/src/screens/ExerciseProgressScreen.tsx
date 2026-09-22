import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '../design/Text';
import { LineChart } from '../charts/LineChart';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { SegmentedControl } from '../design/SegmentedControl';
import { Section } from '../design/Section';
import { colors } from '../design/theme';
import { getMyProfile } from '../lib/api';
import { fromKg, formatWeightKg } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { fetchExerciseSetHistory, type HistoricalSet } from '../workouts/exerciseHistoryQueries';
import {
  filterByTimeRange,
  mostCommonRepCount,
  repCountPRProgression,
  topSetProgression,
  trueOneRepMaxProgression,
  workoutFrequency,
  TIME_RANGES,
  type ChartPoint,
  type TimeRange,
} from '../workouts/exerciseProgress';
import { fetchOneRepMax, fetchRepPRs, type OneRepMax, type RepPR } from '../workouts/prQueries';
import { exerciseProgressStyles as styles } from './exerciseProgressStyles';

type Props = RootStackScreenProps<'ExerciseProgress'>;

// Short visible labels so all five fit on one row; each is read out in full.
const RANGE_LABELS: Record<TimeRange, { short: string; full: string }> = {
  '4w': { short: '4W', full: '4 Weeks' },
  '3m': { short: '3M', full: '3 Months' },
  '6m': { short: '6M', full: '6 Months' },
  '1y': { short: '1Y', full: '1 Year' },
  all: { short: 'All', full: 'All Time' },
};
const RANGE_OPTIONS = TIME_RANGES.map((r) => ({
  label: RANGE_LABELS[r.value].short,
  accessibilityLabel: RANGE_LABELS[r.value].full,
  value: r.value,
}));

function toChartPoints(points: ChartPoint[], unit: 'kg' | 'lb'): { x: number; y: number }[] {
  return points.map((p) => ({
    x: new Date(p.performedAt).getTime(),
    y: fromKg(p.weightKg, unit),
  }));
}

function rangeLabel(points: ChartPoint[], unit: 'kg' | 'lb'): string | null {
  if (points.length === 0) return null;
  const weights = points.map((p) => p.weightKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  if (min === max) return `${formatWeightKg(min, unit)}${unit}`;
  return `${formatWeightKg(min, unit)}${unit} – ${formatWeightKg(max, unit)}${unit}`;
}

// Focused on three questions: am I getting stronger, how much have I
// improved, what are my best performances, and how consistently am I
// training this. Deliberately not a statistics-heavy dashboard -- every
// chart here is a direct, real-data reconstruction (see exerciseProgress.ts),
// never an estimate.
//
// Layout: a time-range control, then a stack of widgets (chart + its range
// as a mono readout, best performances, consistency). The charts and the
// consistency line follow the selected range; Best Performances are
// all-time. The plotted line is the user's Workout accent.
export function ExerciseProgressScreen({ route, navigation }: Props) {
  const { exerciseId, exerciseName } = route.params;
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;
  const { theme } = useProgressTheme();

  const [history, setHistory] = useState<HistoricalSet[]>([]);
  const [repPRs, setRepPRs] = useState<RepPR[]>([]);
  const [oneRepMax, setOneRepMax] = useState<OneRepMax | null>(null);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [range, setRange] = useState<TimeRange>('3m');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!userId || !accessToken) return;
      setLoading(true);
      setError(null);
      try {
        const [fetchedHistory, prs, orm, profile] = await Promise.all([
          fetchExerciseSetHistory(userId, exerciseId),
          fetchRepPRs(userId, exerciseId),
          fetchOneRepMax(userId, exerciseId),
          getMyProfile(accessToken),
        ]);
        if (cancelled) return;
        setHistory(fetchedHistory);
        setRepPRs(prs);
        setOneRepMax(orm);
        setWeightUnit(profile.weightUnit);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load progress');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId, accessToken, exerciseId]);

  const filtered = useMemo(() => filterByTimeRange(history, range), [history, range]);
  const topSets = useMemo(() => topSetProgression(filtered), [filtered]);
  const commonReps = useMemo(() => mostCommonRepCount(filtered), [filtered]);
  const repProgression = useMemo(
    () => (commonReps !== null ? repCountPRProgression(filtered, commonReps) : []),
    [filtered, commonReps],
  );
  const ormProgression = useMemo(() => trueOneRepMaxProgression(filtered), [filtered]);
  const sessionCount = useMemo(() => workoutFrequency(filtered), [filtered]);

  const bestRepPR = commonReps !== null ? repPRs.find((pr) => pr.reps === commonReps) : undefined;

  return (
    <Screen
      scrollTestID="exercise-progress-scroll"
      contentContainerStyle={styles.content}
      header={
        <AppHeader
          title={exerciseName}
          leftAction={{
            icon: 'arrow-left',
            onPress: () => navigation.goBack(),
            accessibilityLabel: 'Back',
            testID: 'exercise-progress-back',
          }}
        />
      }
    >
      {error ? (
        <Text testID="exercise-progress-error" style={styles.errorText}>
          {error}
        </Text>
      ) : null}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator
            testID="exercise-progress-loading"
            size="large"
            color={colors.textPrimary}
          />
        </View>
      ) : (
        <>
          <SegmentedControl
            testID="range"
            options={RANGE_OPTIONS}
            value={range}
            onChange={setRange}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />

          <AppCard>
            <Section title="Top Set Progression">
              {topSets.length > 0 ? (
                <>
                  <ProgressChart
                    testID="top-set-chart"
                    points={toChartPoints(topSets, weightUnit)}
                    color={theme.accent}
                  />
                  <Text style={styles.chartCaption}>{rangeLabel(topSets, weightUnit)}</Text>
                </>
              ) : (
                <Text testID="top-set-chart-empty" style={styles.emptyText}>
                  No sessions logged in this range
                </Text>
              )}
            </Section>
          </AppCard>

          <AppCard>
            <Section
              title={
                commonReps !== null ? `${commonReps}-Rep PR Progression` : 'Rep PR Progression'
              }
            >
              {repProgression.length > 0 ? (
                <>
                  <ProgressChart
                    testID="rep-pr-chart"
                    points={toChartPoints(repProgression, weightUnit)}
                    color={theme.accent}
                  />
                  <Text style={styles.chartCaption}>{rangeLabel(repProgression, weightUnit)}</Text>
                </>
              ) : (
                <Text testID="rep-pr-chart-empty" style={styles.emptyText}>
                  No rep PR history in this range
                </Text>
              )}
            </Section>
          </AppCard>

          <AppCard>
            <Section title="True 1RM Progression">
              {ormProgression.length > 0 ? (
                <>
                  <ProgressChart
                    testID="one-rm-chart"
                    points={toChartPoints(ormProgression, weightUnit)}
                    color={theme.accent}
                  />
                  <Text style={styles.chartCaption}>{rangeLabel(ormProgression, weightUnit)}</Text>
                </>
              ) : (
                <Text testID="one-rm-chart-empty" style={styles.emptyText}>
                  No 1RM recorded yet — log a single-rep set to set one.
                </Text>
              )}
            </Section>
          </AppCard>

          <AppCard>
            <Section title="Best Performances">
              {oneRepMax ? (
                <ListRow
                  testID="best-one-rm-value"
                  title="1RM"
                  value={`${formatWeightKg(oneRepMax.weightKg, weightUnit)}${weightUnit}`}
                />
              ) : (
                <ListRow testID="best-one-rm-empty" title="1RM" subtitle="No 1RM recorded yet" />
              )}
              {bestRepPR ? (
                <ListRow
                  testID="best-rep-pr-value"
                  divider
                  title={`${bestRepPR.reps}-Rep PR`}
                  value={`${formatWeightKg(bestRepPR.bestWeightKg, weightUnit)}${weightUnit}`}
                />
              ) : (
                <ListRow
                  testID="best-rep-pr-empty"
                  divider
                  title="Rep PR"
                  subtitle="No rep PR recorded yet"
                />
              )}
            </Section>
          </AppCard>

          <AppCard>
            <Section title="Consistency">
              <Text testID="session-frequency" style={styles.consistencyText}>
                {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'} in this period
              </Text>
            </Section>
          </AppCard>
        </>
      )}
    </Screen>
  );
}

// A LineChart sized to the width it is given by the screen (it needs explicit
// pixel dimensions). Starts at a sensible default and snaps to the measured
// width on layout.
const CHART_HEIGHT = 140;
const DEFAULT_CHART_WIDTH = 280;

function ProgressChart({
  points,
  color,
  testID,
}: {
  points: { x: number; y: number }[];
  color: string;
  testID: string;
}) {
  const [width, setWidth] = useState(DEFAULT_CHART_WIDTH);
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <LineChart
        testID={testID}
        points={points}
        width={width}
        height={CHART_HEIGHT}
        color={color}
      />
    </View>
  );
}
