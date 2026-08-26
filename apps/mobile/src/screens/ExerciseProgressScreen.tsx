import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from '../charts/LineChart';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import { fromKg, roundWeight } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
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
import { workoutStyles as styles } from './workoutStyles';

type Props = RootStackScreenProps<'ExerciseProgress'>;

function formatWeight(kg: number, unit: 'kg' | 'lb'): string {
  const value = roundWeight(fromKg(kg, unit));
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

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
  if (min === max) return `${formatWeight(min, unit)}${unit}`;
  return `${formatWeight(min, unit)}${unit} – ${formatWeight(max, unit)}${unit}`;
}

// Focused on three questions: am I getting stronger, how much have I
// improved, what are my best performances, and how consistently am I
// training this. Deliberately not a statistics-heavy dashboard -- every
// chart here is a direct, real-data reconstruction (see exerciseProgress.ts),
// never an estimate.
export function ExerciseProgressScreen({ route, navigation }: Props) {
  const { exerciseId, exerciseName } = route.params;
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;

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
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{exerciseName}</Text>
        <TouchableOpacity testID="exercise-progress-back" onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>Back</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <Text testID="exercise-progress-error" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {loading ? (
        <ActivityIndicator testID="exercise-progress-loading" size="large" color="#FFFFFF" />
      ) : (
        <>
          <View style={styles.chipRow}>
            {TIME_RANGES.map((r) => (
              <TouchableOpacity
                key={r.value}
                testID={`range-${r.value}`}
                style={[styles.chip, range === r.value ? styles.chipSelected : null]}
                onPress={() => setRange(r.value)}
              >
                <Text style={[styles.chipText, range === r.value ? styles.chipTextSelected : null]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Top Set Progression</Text>
            {topSets.length > 0 ? (
              <>
                <LineChart
                  testID="top-set-chart"
                  points={toChartPoints(topSets, weightUnit)}
                  width={280}
                  height={140}
                />
                <Text style={styles.cardMeta}>{rangeLabel(topSets, weightUnit)}</Text>
              </>
            ) : (
              <Text testID="top-set-chart-empty" style={styles.emptyText}>
                No sessions logged in this range
              </Text>
            )}
          </View>

          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>
              {commonReps !== null ? `${commonReps}-Rep PR Progression` : 'Rep PR Progression'}
            </Text>
            {repProgression.length > 0 ? (
              <>
                <LineChart
                  testID="rep-pr-chart"
                  points={toChartPoints(repProgression, weightUnit)}
                  width={280}
                  height={140}
                />
                <Text style={styles.cardMeta}>{rangeLabel(repProgression, weightUnit)}</Text>
              </>
            ) : (
              <Text testID="rep-pr-chart-empty" style={styles.emptyText}>
                No rep PR history in this range
              </Text>
            )}
          </View>

          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>True 1RM Progression</Text>
            {ormProgression.length > 0 ? (
              <>
                <LineChart
                  testID="one-rm-chart"
                  points={toChartPoints(ormProgression, weightUnit)}
                  width={280}
                  height={140}
                />
                <Text style={styles.cardMeta}>{rangeLabel(ormProgression, weightUnit)}</Text>
              </>
            ) : (
              <Text testID="one-rm-chart-empty" style={styles.emptyText}>
                No 1RM recorded yet — log a single-rep set to set one.
              </Text>
            )}
          </View>

          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Best Performances</Text>
            {oneRepMax ? (
              <Text testID="best-one-rm-value" style={styles.cardMetaHighlight}>
                1RM: {formatWeight(oneRepMax.weightKg, weightUnit)}
                {weightUnit}
              </Text>
            ) : (
              <Text testID="best-one-rm-empty" style={styles.cardMeta}>
                No 1RM recorded yet
              </Text>
            )}
            {bestRepPR ? (
              <Text testID="best-rep-pr-value" style={styles.cardMetaHighlight}>
                {bestRepPR.reps}-Rep PR: {formatWeight(bestRepPR.bestWeightKg, weightUnit)}
                {weightUnit}
              </Text>
            ) : (
              <Text testID="best-rep-pr-empty" style={styles.cardMeta}>
                No rep PR recorded yet
              </Text>
            )}
          </View>

          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Consistency</Text>
            <Text testID="session-frequency" style={styles.cardMetaHighlight}>
              {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'} in this period
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}
