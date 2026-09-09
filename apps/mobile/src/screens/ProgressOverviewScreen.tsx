import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { LoadingState } from '../design/LoadingState';
import type { RootStackScreenProps } from '../navigation/types';
import { computeFirstPRAt, computeLifetimeStats } from '../progress/lifetimeStats';
import { deriveGlobalMilestones } from '../progress/globalMilestones';
import {
  computeMuscleGroupSetCounts,
  muscleGroupsForVisualization,
} from '../progress/muscleGroupProgress';
import { ExercisesSection } from '../progress/ExercisesSection';
import { OneRepMaxSection } from '../progress/OneRepMaxSection';
import { OverviewSection } from '../progress/OverviewSection';
import { PRsSection } from '../progress/PRsSection';
import { ProgressHeader } from '../progress/ProgressHeader';
import { PROGRESS_SECTIONS, type ProgressSection } from '../progress/progressSections';
import { fetchAllCompletedWorkouts } from '../progress/progressStatsQueries';
import { progressStyles as styles } from '../progress/progressStyles';
import { StrengthSection } from '../progress/StrengthSection';
import { TopSetsSection } from '../progress/TopSetsSection';
import { useProgressTheme } from '../progress/useProgressTheme';
import { CategoryTabs } from '../settings/CategoryTabs';
import {
  fetchAllExerciseHistory,
  groupByExercise,
  type HistoricalSetWithExercise,
} from '../workouts/allExerciseHistoryQueries';
import { fetchAllOneRepMaxes, fetchAllRepPRs } from '../workouts/prSummaryQueries';
import type { OneRepMaxWithExercise, RepPRWithExercise } from '../workouts/prSummaryQueries';
import type { WorkoutSummary } from '../workouts/workoutQueries';

type Props = RootStackScreenProps<'ProgressOverview'>;

// Progress's shell: header + the horizontal section navigation (reusing
// Settings' own CategoryTabs component, not a second implementation) +
// whichever section is active. All Progress data is fetched once here and
// passed down as props -- switching sections never re-fetches, and no
// section duplicates another's data-loading logic. Individual exercise
// detail still opens its own dedicated screen (ProgressExerciseDetail),
// unaffected by this restructuring.
export function ProgressOverviewScreen({ navigation }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { theme, weightUnit, themeLoading } = useProgressTheme();
  const insets = useSafeAreaInsets();

  const [activeSection, setActiveSection] = useState<ProgressSection>('Overview');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoricalSetWithExercise[]>([]);
  const [repPRs, setRepPRs] = useState<RepPRWithExercise[]>([]);
  const [oneRepMaxes, setOneRepMaxes] = useState<OneRepMaxWithExercise[]>([]);
  const [completedWorkouts, setCompletedWorkouts] = useState<WorkoutSummary[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [allHistory, allRepPRs, allOneRepMaxes, allWorkouts] = await Promise.all([
        fetchAllExerciseHistory(userId),
        fetchAllRepPRs(userId),
        fetchAllOneRepMaxes(userId),
        fetchAllCompletedWorkouts(userId),
      ]);
      setHistory(allHistory);
      setRepPRs(allRepPRs);
      setOneRepMaxes(allOneRepMaxes);
      setCompletedWorkouts(allWorkouts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load progress');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  const groups = useMemo(() => groupByExercise(history), [history]);
  const lifetimeStats = useMemo(() => computeLifetimeStats(completedWorkouts), [completedWorkouts]);
  const totalPRs = repPRs.length + oneRepMaxes.length;
  const globalMilestones = useMemo(
    () =>
      deriveGlobalMilestones({
        totalWorkouts: lifetimeStats.totalWorkouts,
        totalCompletedSets: history.length,
        firstWorkoutAt: lifetimeStats.firstWorkoutAt,
        firstPRAt: computeFirstPRAt([
          ...repPRs.map((p) => p.achievedAt),
          ...oneRepMaxes.map((o) => o.achievedAt),
        ]),
      }),
    [lifetimeStats, history.length, repPRs, oneRepMaxes],
  );
  const muscleGroupCounts = useMemo(() => computeMuscleGroupSetCounts(history), [history]);
  const muscleGroupVisualization = useMemo(
    () => muscleGroupsForVisualization(muscleGroupCounts),
    [muscleGroupCounts],
  );

  if (loading || themeLoading) {
    return <LoadingState testID="progress-overview-loading" />;
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="progress-screen">
      <View style={{ paddingHorizontal: 24 }}>
        <ProgressHeader title="Progress" subtitle="Track how you're getting stronger." />

        <CategoryTabs
          testID="progress-tabs"
          categories={[...PROGRESS_SECTIONS]}
          active={activeSection}
          onSelect={setActiveSection}
          accentColor={theme.accent}
        />

        {error ? (
          <Text testID="progress-overview-error" style={styles.errorText}>
            {error}
          </Text>
        ) : null}
      </View>

      <View style={[styles.sectionFill, { paddingHorizontal: 24 }]}>
        {activeSection === 'Overview' ? (
          <OverviewSection
            groups={groups}
            weightUnit={weightUnit}
            theme={theme}
            oneRepMaxes={oneRepMaxes}
            repPRs={repPRs}
            lifetimeStats={lifetimeStats}
            totalCompletedSets={history.length}
            totalPRs={totalPRs}
            globalMilestones={globalMilestones}
            navigation={navigation}
          />
        ) : null}

        {activeSection === 'Strength' ? (
          <StrengthSection
            groups={groups}
            weightUnit={weightUnit}
            theme={theme}
            oneRepMaxes={oneRepMaxes}
            repPRs={repPRs}
            muscleGroupCounts={muscleGroupCounts}
            muscleGroupVisualization={muscleGroupVisualization}
          />
        ) : null}

        {activeSection === 'PRs' ? (
          <PRsSection
            repPRs={repPRs}
            oneRepMaxes={oneRepMaxes}
            weightUnit={weightUnit}
            accentColor={theme.accent}
            navigation={navigation}
          />
        ) : null}

        {activeSection === 'Exercises' ? (
          <ExercisesSection
            groups={groups}
            weightUnit={weightUnit}
            accentColor={theme.accent}
            navigation={navigation}
          />
        ) : null}

        {activeSection === 'TopSets' ? (
          <TopSetsSection
            groups={groups}
            weightUnit={weightUnit}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
            navigation={navigation}
          />
        ) : null}

        {activeSection === 'OneRepMax' ? (
          <OneRepMaxSection
            oneRepMaxes={oneRepMaxes}
            weightUnit={weightUnit}
            accentColor={theme.accent}
            navigation={navigation}
          />
        ) : null}
      </View>
    </View>
  );
}
