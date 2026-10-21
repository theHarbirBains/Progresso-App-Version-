import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../design/Text';
import { AppCard } from '../design/AppCard';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { UnderlineTabs } from '../design/UnderlineTabs';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { RiseIn, RiseInGroup } from '../design/RiseIn';
import { AllTimeSection } from '../progress/AllTimeSection';
import { useAllTimeStats } from '../progress/AllTimeStatsProvider';
import { computeLifetimeStats } from '../progress/lifetimeStats';
import { OverviewSection } from '../progress/OverviewSection';
import { useWeeklySummaries } from '../progress/useWeeklySummaries';
import { WeeklySummaryBlock } from '../progress/WeeklySummaryBlock';
import { ConsistencyBlock } from '../progress/ConsistencyBlock';
import { NutritionProgressSection } from '../progress/NutritionProgressSection';
import { useProfile } from '../profile/ProfileProvider';
import { ProgressHeader } from '../progress/ProgressHeader';
import { PROGRESS_SECTIONS, type ProgressSection } from '../progress/progressSections';
import { progressStyles as styles } from '../progress/progressStyles';
import { TopSetsSection } from '../progress/TopSetsSection';
import { useProgressTheme } from '../progress/useProgressTheme';
import { groupByExercise } from '../workouts/allExerciseHistoryQueries';

type Props = RootStackScreenProps<'ProgressOverview'>;

// Progress's shell: header + the section navigation (`UnderlineTabs` --
// Strava's own icon-over-label, underline-selected tab treatment, the same
// component Profile's Workouts/Stats/PRs switcher uses -- see DESIGN.md's
// You/Profile section) + whichever section is active, in its own widget
// (an AppCard filling the remaining screen height, matching the workout/
// nutrition tabs' AppCard-per-widget language). All Progress data is
// fetched once here and passed down as props -- switching sections never
// re-fetches, and no section duplicates another's data-loading logic.
// Individual exercise detail still opens its own dedicated screen
// (ProgressExerciseDetail), unaffected by this restructuring.
export function ProgressOverviewScreen({ navigation }: Props) {
  const { theme, weightUnit, themeLoading } = useProgressTheme();
  // Progress always shows the same real content (Overview/Top Sets/
  // Nutrition/All-Time) regardless of which
  // tab the user was on before -- there is no more Workout/Nutrition
  // toggle for it to follow, so it must not vary with navigation history
  // (see DESIGN.md §11; a dedicated Nutrition-side analytics screen, if
  // ever built, would be its own destination reachable from the app menu,
  // not a conditional variant of this one).
  const { openMenu } = useAppMenu();
  // The user's whole workout/set/PR history, shared with ProfileScreen via
  // AllTimeStatsProvider -- fetched once (refreshed only after a workout is
  // completed, not on every visit to this tab), same pattern as
  // profile/nutrition goals.
  const {
    allSetHistory: history,
    allWorkouts: completedWorkouts,
    repPRs,
    oneRepMaxes,
    exerciseRecords,
    statsLoading,
    statsError,
    prsLoading,
    prsError,
  } = useAllTimeStats();
  const loading = statsLoading || prsLoading;
  const error = statsError ?? prsError;

  const [activeSection, setActiveSection] = useState<ProgressSection>('Overview');
  const { profile } = useProfile();
  // This week's and last week's summaries, read once as Progress opens.
  const { summaries: weekSummaries, error: weekError } = useWeeklySummaries();

  const groups = useMemo(() => groupByExercise(history), [history]);
  const lifetimeStats = useMemo(() => computeLifetimeStats(completedWorkouts), [completedWorkouts]);
  const totalPRs = repPRs.length + oneRepMaxes.length + exerciseRecords.length;

  if (loading || themeLoading) {
    return <LoadingState testID="progress-overview-loading" />;
  }

  return (
    <Screen
      scroll={false}
      padded={false}
      rollout={false}
      testID="progress-screen"
      header={
        <ProgressHeader
          onOpenMenu={() => openMenu()}
          accentColor={theme.accent}
          // "Track Your Growth" + the supporting sentence are hidden on
          // every Progress tab now (Overview already shows its own "Your
          // Progress" card; Top Sets has its own section
          // titles right below) -- kept as a prop rather than deleted from
          // ProgressHeader in case a future section wants it back.
          showHeading={false}
        />
      }
    >
      <RiseInGroup>
        <RiseIn>
          <View style={styles.tabsWrap}>
            <UnderlineTabs
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
        </RiseIn>

        {/* Fills the rest of the screen, like the card inside it. */}
        <RiseIn style={styles.sectionRise}>
          <AppCard testID="progress-section-card" style={styles.sectionCard}>
            {activeSection === 'Overview' ? (
              <OverviewSection
                groups={groups}
                lifetimeStats={lifetimeStats}
                totalCompletedSets={history.length}
                totalPRs={totalPRs}
                repPRs={repPRs}
                oneRepMaxes={oneRepMaxes}
                exerciseRecords={exerciseRecords}
                weightUnit={weightUnit}
                accentColor={theme.accent}
                navigation={navigation}
                onViewAllMilestones={() => setActiveSection('AllTime')}
                top={
                  <>
                    <WeeklySummaryBlock
                      summaries={weekSummaries}
                      error={weekError}
                      weightUnit={weightUnit}
                      accentColor={theme.accent}
                      onAccentColor={theme.onAccent}
                    />
                    <ConsistencyBlock
                      workouts={completedWorkouts}
                      weeklyGoal={profile?.workoutFrequencyDays ?? null}
                      accentColor={theme.accent}
                      onOpenHistory={() => navigation.navigate('WorkoutHistory')}
                    />
                  </>
                }
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

            {activeSection === 'Nutrition' ? (
              <NutritionProgressSection
                accentColor={theme.accent}
                onAccentColor={theme.onAccent}
                onOpenDay={(date) => navigation.navigate('NutritionHistory', { date })}
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
          </AppCard>
        </RiseIn>
      </RiseInGroup>
    </Screen>
  );
}
