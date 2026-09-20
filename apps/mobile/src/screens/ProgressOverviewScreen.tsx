import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../design/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { LoadingState } from '../design/LoadingState';
import { ModeToggle } from '../design/ModeToggle';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { AllTimeSection } from '../progress/AllTimeSection';
import { computeLifetimeStats } from '../progress/lifetimeStats';
import { OverviewSection } from '../progress/OverviewSection';
import { ProgressEmptyState } from '../progress/ProgressEmptyState';
import { ProgressHeader } from '../progress/ProgressHeader';
import { PROGRESS_SECTIONS, type ProgressSection } from '../progress/progressSections';
import { fetchAllCompletedWorkouts } from '../progress/progressStatsQueries';
import { progressStyles as styles } from '../progress/progressStyles';
import { StrengthProgressSection } from '../progress/StrengthProgressSection';
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
  const { theme, nutritionTheme, weightUnit, themeLoading } = useProgressTheme();
  const insets = useSafeAreaInsets();
  const { openMenu, reportMode, currentMode } = useAppMenu();

  // Switching mode from a non-Dashboard root screen always goes to that
  // mode's Home (Dashboard) -- Dashboard is each mode's one true landing
  // page, not this screen's own in-place "coming soon" state (that only
  // ever shows when the user arrives here already in Nutrition mode via
  // the bottom nav/side menu, not from tapping this toggle). A no-op if
  // the tapped segment is already selected.
  function handleModeChange(next: 'workout' | 'nutrition') {
    if (next === currentMode) return;
    reportMode?.(next);
    navigation.navigate('Dashboard');
  }

  const [activeSection, setActiveSection] = useState<ProgressSection>('Overview');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoricalSetWithExercise[]>([]);
  const [repPRs, setRepPRs] = useState<RepPRWithExercise[]>([]);
  const [oneRepMaxes, setOneRepMaxes] = useState<OneRepMaxWithExercise[]>([]);
  const [completedWorkouts, setCompletedWorkouts] = useState<WorkoutSummary[]>([]);
  // Only the very first load should replace the whole screen with
  // LoadingState -- every later call (the focus listener below, firing each
  // time the user returns to this screen) is a background refresh: the
  // already-loaded screen stays on screen while it re-fetches, same pattern
  // as DashboardScreen/ProfileScreen.
  const hasLoadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!userId) return;
    if (!hasLoadedOnce.current) setLoading(true);
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
      hasLoadedOnce.current = true;
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

  if (loading || themeLoading) {
    return <LoadingState testID="progress-overview-loading" />;
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="progress-screen">
      <View style={{ paddingHorizontal: 24 }}>
        <ProgressHeader
          onOpenMenu={() => openMenu(currentMode)}
          accentColor={theme.accent}
          modeToggle={
            <ModeToggle
              mode={currentMode}
              onChange={handleModeChange}
              workoutTheme={theme}
              nutritionTheme={nutritionTheme}
              testIDPrefix="progress"
            />
          }
          // "Track Your Growth" + the supporting sentence are hidden on
          // every Progress tab now (Overview already shows its own "Your
          // Progress" card; Top Sets/Strength have their own section
          // titles right below) -- kept as a prop rather than deleted from
          // ProgressHeader in case a future section wants it back.
          showHeading={false}
        />

        {currentMode === 'workout' ? (
          <CategoryTabs
            testID="progress-tabs"
            categories={[...PROGRESS_SECTIONS]}
            active={activeSection}
            onSelect={setActiveSection}
            accentColor={theme.accent}
          />
        ) : null}

        {error ? (
          <Text testID="progress-overview-error" style={styles.errorText}>
            {error}
          </Text>
        ) : null}
      </View>

      {currentMode === 'nutrition' ? (
        <View style={styles.sectionFill}>
          <ProgressEmptyState
            testID="progress-nutrition-coming-soon"
            title="Nutrition progress is coming soon."
            icon="pie-chart"
          />
        </View>
      ) : (
        <View style={[styles.sectionFill, { paddingHorizontal: 24 }]}>
          {activeSection === 'Overview' ? (
            <OverviewSection
              groups={groups}
              lifetimeStats={lifetimeStats}
              totalCompletedSets={history.length}
              totalPRs={totalPRs}
              repPRs={repPRs}
              oneRepMaxes={oneRepMaxes}
              weightUnit={weightUnit}
              accentColor={theme.accent}
              navigation={navigation}
              onViewDetails={() => setActiveSection('Strength')}
              onViewAllMilestones={() => setActiveSection('Strength')}
            />
          ) : null}

          {activeSection === 'Strength' ? (
            <StrengthProgressSection
              history={history}
              groups={groups}
              weightUnit={weightUnit}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
              navigation={navigation}
            />
          ) : null}

          {activeSection === 'TopSets' ? (
            <TopSetsSection
              history={history}
              weightUnit={weightUnit}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
              navigation={navigation}
            />
          ) : null}

          {activeSection === 'AllTime' ? (
            <AllTimeSection
              groups={groups}
              history={history}
              completedWorkouts={completedWorkouts}
              lifetimeStats={lifetimeStats}
              totalCompletedSets={history.length}
              totalPRs={totalPRs}
              repPRs={repPRs}
              oneRepMaxes={oneRepMaxes}
              weightUnit={weightUnit}
              accentColor={theme.accent}
              navigation={navigation}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}
