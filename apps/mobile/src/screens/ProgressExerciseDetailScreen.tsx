import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { colors } from '../design/theme';
import { Card } from '../design/Card';
import { Section } from '../design/Section';
import { fromKg, roundWeight, formatWeight } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import { MetricCard } from '../progress/MetricCard';
import { ProgressEmptyState } from '../progress/ProgressEmptyState';
import { progressStyles as styles } from '../progress/progressStyles';
import { useProgressTheme } from '../progress/useProgressTheme';
import { fetchExerciseSetHistory, type HistoricalSet } from '../workouts/exerciseHistoryQueries';
import { summarizeProgress, topSetProgressionDetailed } from '../workouts/exerciseProgress';
import { fetchOneRepMax, fetchRepPRs, type OneRepMax, type RepPR } from '../workouts/prQueries';
import { deriveMilestones } from '../workouts/progressMilestones';

type Props = RootStackScreenProps<'ProgressExerciseDetail'>;

// The shared "how has this one exercise progressed" destination, reached
// from Overview's milestones, Top Sets, All Time and the live workout -- one
// implementation for every entry point: the latest top set and how far it has
// come, the best performances, and the progression journey. No line graph.
export function ProgressExerciseDetailScreen({ route, navigation }: Props) {
  const { exerciseId, exerciseName } = route.params;
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { theme, weightUnit, themeLoading } = useProgressTheme();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoricalSet[]>([]);
  const [repPRs, setRepPRs] = useState<RepPR[]>([]);
  const [oneRepMax, setOneRepMax] = useState<OneRepMax | null>(null);
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
  const summary = useMemo(() => summarizeProgress(allTimePoints), [allTimePoints]);
  const milestones = useMemo(
    () => deriveMilestones(allTimePoints, weightUnit),
    [allTimePoints, weightUnit],
  );

  if (loading || themeLoading) {
    return <LoadingState testID="progress-exercise-detail-loading" />;
  }

  const latest = allTimePoints[allTimePoints.length - 1] ?? null;

  return (
    <Screen
      scrollTestID="progress-exercise-detail-scroll"
      contentContainerStyle={styles.detailContent}
      header={
        <AppHeader
          title={exerciseName}
          leftAction={{
            icon: 'arrow-left',
            onPress: () => navigation.goBack(),
            accessibilityLabel: 'Back',
            testID: 'progress-exercise-detail-back',
          }}
        />
      }
    >
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
            <Card testID="progress-exercise-detail-current-card">
              <Text testID="progress-exercise-detail-current" style={styles.featuredCurrent}>
                {formatWeight(roundWeight(fromKg(latest.weightKg, weightUnit)))}
                {weightUnit} × {latest.reps}
              </Text>
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
            </Card>
          ) : null}

          <Section title="Best Performances">
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
          </Section>

          {milestones.length > 0 ? (
            <Section title="Progression Journey">
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
            </Section>
          ) : null}
        </>
      )}
    </Screen>
  );
}
