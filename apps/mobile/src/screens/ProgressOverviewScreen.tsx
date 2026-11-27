import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../design/Text';
import { AppCard } from '../design/AppCard';
import { LoadingState } from '../design/LoadingState';
import { SkeletonCards } from '../design/Skeleton';
import { Screen } from '../design/Screen';
import { SegmentedControl } from '../design/SegmentedControl';
import { UnderlineTabs } from '../design/UnderlineTabs';
import { HealthOverview } from '../health/preview/HealthOverview';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { RiseIn, RiseInGroup } from '../design/RiseIn';
import { AllTimeSection } from '../progress/AllTimeSection';
import { useAllTimeStats } from '../progress/AllTimeStatsProvider';
import { computeLifetimeStats } from '../progress/lifetimeStats';
import { OverviewSection } from '../progress/OverviewSection';
import { useShowAllAtOnce } from '../lib/useShowAllAtOnce';
import { useWeeklySummaries } from '../progress/useWeeklySummaries';
import { WeeklySummaryBlock } from '../progress/WeeklySummaryBlock';
import { ConsistencyBlock } from '../progress/ConsistencyBlock';
import { NutritionProgressSection } from '../progress/NutritionProgressSection';
import { useProfile } from '../profile/ProfileProvider';
import { ProgressHeader } from '../progress/ProgressHeader';
import { ownProgressSections, type ProgressSection } from '../progress/progressSections';
import { progressStyles as styles } from '../progress/progressStyles';
import { useMembership } from '../membership/useMembership';
import { StepsSection } from '../progress/StepsSection';
import { CardioProgressSection } from '../progress/CardioProgressSection';
import { MuscleActivitySection } from '../progress/MuscleActivitySection';
import { TopSetsSection } from '../progress/TopSetsSection';
import { EditTopSetSheet, type TopSetToEdit } from '../progress/EditTopSetSheet';
import { useProgressTheme } from '../progress/useProgressTheme';
import { groupByExercise } from '../workouts/allExerciseHistoryQueries';
import { workingSets } from '../workouts/exerciseHistoryGrouping';

type Props = RootStackScreenProps<'ProgressOverview'>;

/** The section Progress opens on unless asked for another: the Muscles heat map (Harbir's call). */
const DEFAULT_SECTION: ProgressSection = 'Muscles';

// What the shared history works out to, kept for as long as the history itself is the same
// object. Progress opens fresh on every visit (a section page), but the history only changes
// when a workout is completed -- so a visit reuses these instead of working them out again in
// the frame the tab is tapped.
const groupsByHistory = new WeakMap<object, ReturnType<typeof groupByExercise>>();
const statsByWorkouts = new WeakMap<object, ReturnType<typeof computeLifetimeStats>>();

function remembered<K extends object, V>(cache: WeakMap<K, V>, key: K, make: () => V): V {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const value = make();
  cache.set(key, value);
  return value;
}

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
export function ProgressOverviewScreen({ navigation, route }: Props) {
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
    refetch,
  } = useAllTimeStats();
  const loading = statsLoading || prsLoading;
  const error = statsError ?? prsError;

  // Opened on the section asked for (Feed's Daily Steps widget asks for Steps), else the Muscles
  // heat map (Harbir's call) -- only one this person has (no Steps off iPhone).
  const asked = route?.params?.section;
  const offered = (section: ProgressSection | undefined) =>
    section !== undefined && ownProgressSections().some((s) => s.key === section);
  const [activeSection, setActiveSection] = useState<ProgressSection>(
    offered(asked) ? asked! : offered(DEFAULT_SECTION) ? DEFAULT_SECTION : 'Overview',
  );
  useEffect(() => {
    if (asked && offered(asked)) setActiveSection(asked);
  }, [asked]);
  // All Time's tab -- its workouts or its nutrition -- kept while other sections are visited.
  const [allTimeView, setAllTimeView] = useState<'workouts' | 'nutrition'>('workouts');
  const membership = useMembership();
  const { profile } = useProfile();
  // A top set opened to fix it (Top Sets' pencil); saving reads the history and PRs again.
  const [editing, setEditing] = useState<TopSetToEdit | null>(null);
  // This week's and last week's summaries, read once as Progress opens.
  const { summaries: weekSummaries, error: weekError } = useWeeklySummaries();

  const groups = remembered(groupsByHistory, history, () => groupByExercise(history));
  const lifetimeStats = remembered(statsByWorkouts, completedWorkouts, () =>
    computeLifetimeStats(completedWorkouts),
  );
  // The page -- header, tabs and the section's widget -- draws first, in the frame the tab is
  // tapped; the section's own content follows in the next one, so opening Progress never waits
  // on it.
  const [contentReady, setContentReady] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setContentReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  // Overview shows all at once: its section waits for the Weekly Summary too (or a few seconds,
  // if its read is slow), so the summary never drops in above what's already showing.
  const weekShown = useShowAllAtOnce(weekSummaries !== null || weekError !== null);
  const sectionReady = contentReady && (activeSection !== 'Overview' || weekShown);
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
              categories={ownProgressSections()}
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
            {!sectionReady ? (
              <SkeletonCards testID="progress-section-loading" heights={[132, 168, 112]} />
            ) : null}

            {sectionReady && activeSection === 'Overview' ? (
              <OverviewSection
                groups={groups}
                lifetimeStats={lifetimeStats}
                totalCompletedSets={workingSets(history).length}
                totalPRs={totalPRs}
                repPRs={repPRs}
                oneRepMaxes={oneRepMaxes}
                exerciseRecords={exerciseRecords}
                weightUnit={weightUnit}
                accentColor={theme.accent}
                navigation={navigation}
                onViewAllMilestones={() => {
                  setAllTimeView('workouts');
                  setActiveSection('AllTime');
                }}
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

            {contentReady && activeSection === 'TopSets' ? (
              <TopSetsSection
                history={history}
                weightUnit={weightUnit}
                accentColor={theme.accent}
                onAccentColor={theme.onAccent}
                navigation={navigation}
                onEdit={setEditing}
              />
            ) : null}

            {/* Muscles: Muscle Activity, from the person's own sets -- read as the tab opens. */}
            {contentReady && activeSection === 'Muscles' ? (
              <MuscleActivitySection
                accentColor={theme.accent}
                onAccentColor={theme.onAccent}
                weightUnit={weightUnit}
                onOpenExercise={(exerciseId, exerciseName) =>
                  navigation.navigate('ProgressExerciseDetail', { exerciseId, exerciseName })
                }
              />
            ) : null}

            {/* Cardio: the cardio in the person's finished workouts -- read as the tab opens. */}
            {contentReady && activeSection === 'Cardio' ? (
              <CardioProgressSection
                accentColor={theme.accent}
                onAccentColor={theme.onAccent}
                onOpenWorkout={(workoutId) => navigation.navigate('WorkoutDetail', { workoutId })}
              />
            ) : null}

            {/* Steps: the phone's own, from Apple Health -- read as the tab opens. */}
            {contentReady && activeSection === 'Steps' ? (
              <StepsSection accentColor={theme.accent} />
            ) : null}

            {/* Health: a Phase 1 prototype, sample data, development builds only. */}
            {contentReady && activeSection === 'Health' ? (
              <HealthOverview
                accent={theme.accent}
                onOpen={(page, metric, onboarding) =>
                  navigation.navigate('HealthPreview', { page, metric, onboarding })
                }
              />
            ) : null}

            {/* All Time: the workouts' all-time figures, or nutrition's -- two tabs of one section. */}
            {contentReady && activeSection === 'AllTime' ? (
              <View style={styles.allTimeTabs}>
                {/* Nutrition's tab only with a membership that includes it. */}
                {membership.nutrition ? (
                  <SegmentedControl
                    testID="progress-all-time-view"
                    options={[
                      { label: 'Workouts', value: 'workouts' },
                      { label: 'Nutrition', value: 'nutrition' },
                    ]}
                    value={allTimeView}
                    onChange={setAllTimeView}
                    accentColor={theme.accent}
                    onAccentColor={theme.onAccent}
                  />
                ) : null}
                {allTimeView === 'workouts' || !membership.nutrition ? (
                  <AllTimeSection
                    groups={groups}
                    history={history}
                    completedWorkouts={completedWorkouts}
                    lifetimeStats={lifetimeStats}
                    totalCompletedSets={workingSets(history).length}
                    totalPRs={totalPRs}
                    repPRs={repPRs}
                    oneRepMaxes={oneRepMaxes}
                    weightUnit={weightUnit}
                    accentColor={theme.accent}
                    navigation={navigation}
                  />
                ) : (
                  <NutritionProgressSection
                    accentColor={theme.accent}
                    onAccentColor={theme.onAccent}
                    onOpenDay={(date) => navigation.navigate('NutritionHistory', { date })}
                    onOpenHistory={() => navigation.navigate('NutritionHistory')}
                  />
                )}
              </View>
            ) : null}
          </AppCard>
        </RiseIn>
      </RiseInGroup>
      <EditTopSetSheet
        target={editing}
        weightUnit={weightUnit}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
        onClose={() => setEditing(null)}
        onSaved={() => void refetch()}
      />
    </Screen>
  );
}
