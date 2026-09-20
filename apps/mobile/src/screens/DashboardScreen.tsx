import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, ScrollView, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { Circle, Svg } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { Badge } from '../design/Badge';
import { PrimaryButton, TextButton } from '../design/Button';
import { GlassBackground } from '../design/GlassBackground';
import { IconButton } from '../design/IconButton';
import { LoadingState } from '../design/LoadingState';
import { ListRow } from '../design/ListRow';
import { ModeToggle } from '../design/ModeToggle';
import { Section } from '../design/Section';
import { colors, spacing } from '../design/theme';
import { DashboardStat } from '../dashboard/DashboardStat';
import { formatWorkoutDate } from '../dashboard/formatWorkoutDate';
import { NutritionForegroundLayer } from '../dashboard/NutritionForegroundLayer';
import { fetchRecentWorkoutInfo, type RecentWorkoutInfo } from '../dashboard/recentWorkoutInfo';
import { RecentWorkoutCard } from '../dashboard/RecentWorkoutCard';
import { computeWeeklyProgress, getCurrentWeekRange } from '../dashboard/weeklyProgress';
import { getMyProfile, type ProfileResponse } from '../lib/api';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import {
  fetchTodaysFoodLogs,
  fetchWeeklyFoodLogs,
  type FoodLogRow,
} from '../nutrition/foodLogQueries';
import {
  calculateRemaining,
  computeWeeklyCalorieSummary,
  sumDailyTotals,
} from '../nutrition/nutritionCalculations';
import { fetchNutritionGoals, type NutritionGoals } from '../nutrition/nutritionGoalQueries';
import { computeLifetimeStats } from '../progress/lifetimeStats';
import { fetchAllCompletedWorkouts } from '../progress/progressStatsQueries';
import {
  fetchAllExerciseHistory,
  type HistoricalSetWithExercise,
} from '../workouts/allExerciseHistoryQueries';
import { computeNextWorkout, type NextWorkoutPlan } from '../workouts/nextWorkout';
import { splitBadgeText } from '../workouts/splitBadge';
import { SPLIT_MUSCLE_GROUP_LABELS } from '../workouts/splitMuscleGroups';
import {
  fetchActiveWorkout,
  fetchWorkoutsForDateRange,
  type WorkoutSummary,
} from '../workouts/workoutQueries';
import {
  fetchLastWorkoutSplitDayId,
  fetchWorkoutSplitDetail,
} from '../workouts/workoutSplitQueries';
import {
  buildAccentTheme,
  DEFAULT_NUTRITION_THEME,
  DEFAULT_WORKOUT_THEME,
} from '../theme/accentColor';
import { dashboardStyles as styles } from './dashboardStyles';

const logo = require('../../assets/progresso-mark.png');

type Props = RootStackScreenProps<'Dashboard'>;
type Mode = 'workout' | 'nutrition';

const EMPTY_GOALS: NutritionGoals = { calories: null, proteinG: null, carbsG: null, fatG: null };

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Something went wrong';
}

// A ring fill percentage is a plain ratio of two already-computed real
// numbers (consumed / goal) -- the same values already shown as text
// elsewhere, not a new nutrition calculation.
function ratio(consumed: number, goal: number | null): number {
  if (!goal) return 0;
  return Math.min(consumed / goal, 1);
}

// Plain progress ring -- the consumed-calories number lives once, in the
// bold readout beside it (dashboard-calories), not duplicated inside the
// ring itself (an earlier pass added a second, tiny number inside the ring,
// which read as clutter once the reference design put one clear big number
// next to it instead).
function CalorieRing({
  percent,
  active,
  accentColor,
}: {
  percent: number;
  active: boolean;
  accentColor: string;
}) {
  const size = 48;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.surfaceRaised}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {active ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={accentColor}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - percent)}
            strokeLinecap="round"
            fill="none"
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        ) : null}
      </Svg>
    </View>
  );
}

// Icon per macro (DESIGN.md's Feather-only rule -- there's no literal
// dumbbell/grain icon in the set, so these are the closest honest
// substitutes: droplet is an exact match for Fat, "activity"/"feather" are
// the closest available stand-ins for Protein/Carbs). Distinct from the
// Calories row's own icon (zap) and from icons already meaningful
// elsewhere on this screen (e.g. Weekly Goal's target).
const MACRO_ICONS: Record<'Protein' | 'Carbs' | 'Fat', keyof typeof Feather.glyphMap> = {
  Protein: 'activity',
  Carbs: 'feather',
  Fat: 'droplet',
};

function MacroCard({
  testID,
  label,
  consumed,
  goal,
  unit,
  accentColor,
  last,
}: {
  testID: string;
  label: 'Protein' | 'Carbs' | 'Fat';
  consumed: number;
  goal: number | null;
  unit: string;
  accentColor: string;
  /** Last column in the row gets no trailing divider. */
  last?: boolean;
}) {
  const percent = ratio(consumed, goal);
  return (
    <View testID={testID} style={[styles.macroCard, !last && styles.macroCardDivider]}>
      <View style={styles.macroLabelRow}>
        <Feather name={MACRO_ICONS[label]} size={12} color={accentColor} />
        <Text style={styles.macroName}>{label}</Text>
      </View>
      <Text style={styles.macroAmount}>
        {consumed}
        {unit}
      </Text>
      <View style={styles.macroBarTrack}>
        <View
          style={[
            styles.macroBarFill,
            { width: `${percent * 100}%`, backgroundColor: accentColor },
          ]}
        />
      </View>
    </View>
  );
}

// The post-sign-in landing screen. Data/state logic is unchanged from the
// Design Phase pass -- every section still reuses the same
// query/derivation function, and each section still fails independently
// (Promise.allSettled). This pass reorganizes presentation into a
// Workout/Nutrition segmented layout (visual only -- mode is local
// component state, never persisted or sent anywhere). Anything without a
// real data source today (workout counts/volume, "Create Your Story",
// quick actions, the decorative bottom bar) renders as an explicit empty
// state or inert visual, never invented numbers.
export function DashboardScreen({ navigation }: Props) {
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;
  const insets = useSafeAreaInsets();

  const { openMenu, reportMode, currentMode } = useAppMenu();
  // `currentMode` (App.tsx's Root, via AppMenuContext) is the single source
  // of truth for this screen's mode, not a separate local useState -- unlike
  // the other mode-agnostic root screens (Progress/Profile), Dashboard is
  // never unmounted when the user switches mode elsewhere and navigates
  // back to it (native stack `navigate('Dashboard')` just pops back to the
  // existing instance already on the stack). A local default of 'workout'
  // would silently outlive that pop, so Dashboard would keep rendering
  // Workout content -- and briefly re-report 'workout' as the shared mode --
  // even after the user had just switched to Nutrition somewhere else. See
  // the fixed regression test below.
  const mode: Mode = currentMode;
  const [profile, setProfile] = useState<ProfileResponse | null>(null);

  // Each user's own chosen accent color per mode (Settings > Appearance),
  // falling back to the app defaults (Electric Blue / Emerald) until they've
  // customized one. DEFAULT_*_THEME is reused as-is rather than recomputed
  // every render whenever no override is set.
  const workoutTheme = profile?.workoutAccentColor
    ? buildAccentTheme(profile.workoutAccentColor)
    : DEFAULT_WORKOUT_THEME;
  const nutritionTheme = profile?.nutritionAccentColor
    ? buildAccentTheme(profile.nutritionAccentColor)
    : DEFAULT_NUTRITION_THEME;
  const theme = mode === 'workout' ? workoutTheme : nutritionTheme;

  // The Workout<->Nutrition accent crossfade for the bottom navigation now
  // lives in the shared BottomNavBar (see design/BottomNavBar.tsx); the mode
  // toggle animates itself. Nothing on this screen needs to drive it.

  // Measured (not hardcoded) height of the fixed header, so the scrollable
  // content's own top padding always matches whatever actually renders on
  // this device -- safe-area inset, font scaling, etc. The fallback value
  // only covers the first frame or two before onLayout reports a real
  // measurement. There is no footer to measure: the bottom navigation is an
  // in-flow sibling of the navigator (App.tsx), so this screen's content
  // area already ends above it.
  const [headerHeight, setHeaderHeight] = useState(160);
  const onHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    setHeaderHeight(event.nativeEvent.layout.height);
  }, []);

  const [profileError, setProfileError] = useState<string | null>(null);

  const [activeWorkout, setActiveWorkout] = useState<WorkoutSummary | null>(null);
  const [activeWorkoutError, setActiveWorkoutError] = useState<string | null>(null);

  const [nextWorkoutPlan, setNextWorkoutPlan] = useState<NextWorkoutPlan | null>(null);

  const [allWorkouts, setAllWorkouts] = useState<WorkoutSummary[]>([]);
  const [allSetHistory, setAllSetHistory] = useState<HistoricalSetWithExercise[]>([]);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [weekWorkouts, setWeekWorkouts] = useState<WorkoutSummary[]>([]);
  const [weekWorkoutsError, setWeekWorkoutsError] = useState<string | null>(null);

  const [recentWorkout, setRecentWorkout] = useState<RecentWorkoutInfo | null>(null);
  const [recentWorkoutError, setRecentWorkoutError] = useState<string | null>(null);

  const [nutritionLogs, setNutritionLogs] = useState<FoodLogRow[]>([]);
  const [weeklyNutritionLogs, setWeeklyNutritionLogs] = useState<FoodLogRow[]>([]);
  const [nutritionGoals, setNutritionGoals] = useState<NutritionGoals>(EMPTY_GOALS);
  const [nutritionError, setNutritionError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  // Only the very first load should replace the whole screen with
  // LoadingState. Every later call to `load` (e.g. the focus listener below,
  // firing each time the user returns to this screen) is a background
  // refresh: the previously loaded dashboard stays on screen the whole time,
  // and each section's own state just updates in place as its request
  // resolves -- never re-blanked mid-refresh.
  const hasLoadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!userId || !accessToken) return;
    if (!hasLoadedOnce.current) {
      setLoading(true);
    }
    setProfileError(null);
    setActiveWorkoutError(null);
    setStatsError(null);
    setWeekWorkoutsError(null);
    setRecentWorkoutError(null);
    setNutritionError(null);

    const { start: weekStart, end: weekEnd } = getCurrentWeekRange();

    const [
      profileResult,
      activeResult,
      statsResult,
      weekWorkoutsResult,
      recentWorkoutResult,
      nutritionResult,
    ] = await Promise.allSettled([
      getMyProfile(accessToken),
      fetchActiveWorkout(userId),
      Promise.all([fetchAllCompletedWorkouts(userId), fetchAllExerciseHistory(userId)]),
      fetchWorkoutsForDateRange(userId, weekStart, weekEnd),
      fetchRecentWorkoutInfo(userId),
      Promise.all([
        fetchTodaysFoodLogs(userId),
        fetchWeeklyFoodLogs(userId),
        fetchNutritionGoals(userId),
      ]),
    ]);

    if (profileResult.status === 'fulfilled') {
      setProfile(profileResult.value);
    } else {
      setProfileError(errorMessage(profileResult.reason));
    }

    if (activeResult.status === 'fulfilled') {
      setActiveWorkout(activeResult.value);
    } else {
      setActiveWorkoutError(errorMessage(activeResult.reason));
    }

    if (statsResult.status === 'fulfilled') {
      setAllWorkouts(statsResult.value[0]);
      setAllSetHistory(statsResult.value[1]);
    } else {
      setStatsError(errorMessage(statsResult.reason));
    }

    if (weekWorkoutsResult.status === 'fulfilled') {
      setWeekWorkouts(weekWorkoutsResult.value);
    } else {
      setWeekWorkoutsError(errorMessage(weekWorkoutsResult.reason));
    }

    if (recentWorkoutResult.status === 'fulfilled') {
      setRecentWorkout(recentWorkoutResult.value);
    } else {
      setRecentWorkoutError(errorMessage(recentWorkoutResult.reason));
    }

    // Depends on profileResult (need activeWorkoutSplitId first), so this
    // can't join the Promise.allSettled batch above. Never blocks the rest
    // of the dashboard: a missing/failed split just means no Next Workout
    // card, falling back to the existing plain "start a workout" placeholder.
    const activeSplitId =
      profileResult.status === 'fulfilled' ? profileResult.value.activeWorkoutSplitId : null;
    if (activeSplitId) {
      try {
        const [splitDetail, lastDayId] = await Promise.all([
          fetchWorkoutSplitDetail(activeSplitId),
          fetchLastWorkoutSplitDayId(userId),
        ]);
        setNextWorkoutPlan(computeNextWorkout(splitDetail, lastDayId));
      } catch {
        setNextWorkoutPlan(null);
      }
    } else {
      setNextWorkoutPlan(null);
    }

    if (nutritionResult.status === 'fulfilled') {
      setNutritionLogs(nutritionResult.value[0]);
      setWeeklyNutritionLogs(nutritionResult.value[1]);
      setNutritionGoals(nutritionResult.value[2]);
    } else {
      setNutritionError(errorMessage(nutritionResult.reason));
    }

    setLoading(false);
    hasLoadedOnce.current = true;
  }, [userId, accessToken]);

  useEffect(() => {
    // Re-load on every focus, not just mount, so returning here after
    // logging a set/food or completing a workout shows current data.
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  if (loading) {
    return <LoadingState testID="dashboard-loading" />;
  }

  const consumed = sumDailyTotals(nutritionLogs);
  const hasAnyNutritionGoal =
    nutritionGoals.calories !== null ||
    nutritionGoals.proteinG !== null ||
    nutritionGoals.carbsG !== null ||
    nutritionGoals.fatG !== null;
  const caloriePercent = ratio(consumed.calories, nutritionGoals.calories);
  const caloriesRemaining = calculateRemaining(consumed, nutritionGoals).calories;
  const weeklyConsumedCalories = sumDailyTotals(weeklyNutritionLogs).calories;
  const weeklyCalorieSummary = computeWeeklyCalorieSummary(
    weeklyConsumedCalories,
    nutritionGoals.calories,
  );

  const lifetimeStats = computeLifetimeStats(allWorkouts);
  const weeklyProgress = computeWeeklyProgress(
    weekWorkouts.map((w) => new Date(w.performedAt)),
    profile?.workoutFrequencyDays ?? null,
  );

  return (
    <View style={styles.screen} testID="dashboard-screen">
      <View
        testID="dashboard-fixed-header"
        onLayout={onHeaderLayout}
        style={[styles.fixedHeader, { paddingTop: insets.top + spacing.md }]}
      >
        <GlassBackground bordered={false} />
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <IconButton
              testID="dashboard-open-menu"
              icon="menu"
              onPress={() => openMenu(mode)}
              accessibilityLabel="Open menu"
              color={colors.textSecondaryBright}
            />
            <View style={styles.brandRow}>
              <Image source={logo} style={styles.logo} resizeMode="contain" />
              <Text style={styles.wordmark}>PROGRESSO</Text>
            </View>
          </View>
        </View>

        <View style={styles.modeToggleWrap}>
          <ModeToggle
            mode={mode}
            onChange={(next) => reportMode?.(next)}
            workoutTheme={workoutTheme}
            nutritionTheme={nutritionTheme}
            testIDPrefix="dashboard"
          />
        </View>
      </View>

      <View testID="dashboard-reveal-content" style={styles.scrollArea}>
        {mode === 'workout' ? (
          <ScrollView
            testID="dashboard-scroll"
            style={styles.scrollAreaInner}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: headerHeight + spacing.md },
              // Every widget is a direct child of this container, separated
              // by exactly `widgetGap` -- see widgetStack's comment. Scrolls
              // only when the stack genuinely exceeds the viewport; when it
              // doesn't, the widgets themselves share the spare height so
              // they fill from the mode switcher to the bottom navigation --
              // see workoutStackFill and the grow* styles.
              styles.widgetStack,
              styles.workoutStackFill,
            ]}
          >
            {profileError ? (
              <Text testID="dashboard-profile-error" style={styles.errorText}>
                {profileError}
              </Text>
            ) : null}

            {/* Only a real Next Workout card grows to take spare height; the
                one-line resume / "no upcoming workout" rows stay compact. */}
            <View style={!activeWorkout && nextWorkoutPlan ? styles.growHero : undefined}>
              {activeWorkoutError ? (
                <Text testID="dashboard-active-workout-error" style={styles.errorText}>
                  {activeWorkoutError}
                </Text>
              ) : null}
              {activeWorkout ? (
                <AppCard
                  hero
                  testID="dashboard-resume-workout"
                  onPress={() =>
                    navigation.navigate('ActiveWorkout', { workoutId: activeWorkout.id })
                  }
                >
                  <ListRow
                    icon="activity"
                    title={activeWorkout.name}
                    subtitle="In progress · tap to resume"
                    chevron
                  />
                </AppCard>
              ) : nextWorkoutPlan ? (
                <AppCard hero testID="dashboard-next-workout" style={styles.nextWorkoutCard}>
                  <View>
                    <View style={styles.nextWorkoutHeaderRow}>
                      <Text style={styles.nextWorkoutEyebrow}>Your Next Workout</Text>
                      {splitBadgeText(nextWorkoutPlan.splitName) ? (
                        <Badge
                          testID="dashboard-next-workout-badge"
                          label={splitBadgeText(nextWorkoutPlan.splitName)!}
                          color={theme.accent}
                          backgroundColor={theme.accentBg}
                        />
                      ) : null}
                    </View>
                    <Text style={styles.nextWorkoutDayName}>{nextWorkoutPlan.day.name}</Text>
                    <Text style={styles.nextWorkoutMeta}>{nextWorkoutPlan.splitName}</Text>
                    {nextWorkoutPlan.day.muscleGroups.length > 0 ? (
                      <Text testID="dashboard-next-workout-muscles" style={styles.nextWorkoutMeta}>
                        {nextWorkoutPlan.day.muscleGroups
                          .map((group) => SPLIT_MUSCLE_GROUP_LABELS[group])
                          .join(' • ')}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.nextWorkoutActions}>
                    <PrimaryButton
                      testID="dashboard-start-next-workout"
                      label="Start Workout"
                      accentColor={theme.accent}
                      onAccentColor={theme.onAccent}
                      onPress={() => navigation.navigate('NewWorkout')}
                    />
                    <TextButton
                      testID="dashboard-change-split"
                      label="Change Workout"
                      onPress={() => navigation.navigate('WorkoutSplits')}
                    />
                  </View>
                </AppCard>
              ) : (
                <AppCard
                  testID="dashboard-start-workout"
                  onPress={() => navigation.navigate('NewWorkout')}
                >
                  <ListRow
                    icon="calendar"
                    title="No upcoming workout"
                    subtitle="Tap to start a new workout"
                    chevron
                  />
                </AppCard>
              )}
            </View>

            {/* Activity: this week and the four headline stats, in ONE card --
                a set of facts that belong together -- with a hairline between
                the two groups instead of five separate cards. */}
            <View style={styles.growActivity}>
              {weekWorkoutsError ? (
                <Text testID="dashboard-weekly-error" style={styles.errorText}>
                  {weekWorkoutsError}
                </Text>
              ) : null}
              {statsError ? (
                <Text testID="dashboard-stats-error" style={styles.errorText}>
                  {statsError}
                </Text>
              ) : null}
              <AppCard testID="dashboard-activity" style={styles.activityCard}>
                <View testID="dashboard-weekly-progress">
                  <Section
                    title="This week"
                    titleTestID="dashboard-weekly-count"
                    action={{
                      label: 'View Details',
                      onPress: () => navigation.navigate('WorkoutHistory'),
                      testID: 'dashboard-weekly-view-details',
                    }}
                    actionColor={theme.accent}
                  >
                    <View style={styles.weeklyDaysRow}>
                      {weeklyProgress.days.map((day) => (
                        <View
                          key={day.label}
                          style={styles.weeklyDay}
                          accessible
                          accessibilityLabel={`${day.label}, ${
                            day.completed
                              ? 'completed'
                              : day.isRestDay
                                ? 'rest day'
                                : 'not completed'
                          }`}
                        >
                          <View
                            style={[
                              styles.weeklyDayCircle,
                              day.completed && {
                                backgroundColor: theme.accent,
                                borderColor: theme.accent,
                              },
                            ]}
                          >
                            {day.completed ? (
                              <Feather name="check" size={14} color={theme.onAccent} />
                            ) : day.isRestDay ? (
                              <Feather name="moon" size={12} color={colors.textMuted} />
                            ) : null}
                          </View>
                          <Text style={styles.weeklyDayLabel}>{day.label}</Text>
                        </View>
                      ))}
                    </View>
                  </Section>
                </View>
                <View style={styles.statGrid} testID="dashboard-stat-grid">
                  <View style={styles.statRow}>
                    <DashboardStat
                      testID="dashboard-stat-sets"
                      value={String(allSetHistory.length)}
                      title="Sets Done"
                      subtitle="All Time"
                      onPress={() => navigation.navigate('ProgressOverview')}
                    />
                    <DashboardStat
                      testID="dashboard-stat-workouts-month"
                      value={String(lifetimeStats.workoutsThisMonth)}
                      title="Workouts"
                      subtitle="This Month"
                      onPress={() => navigation.navigate('ProgressOverview')}
                    />
                  </View>
                  <View style={styles.statRow}>
                    <DashboardStat
                      testID="dashboard-stat-steps"
                      value="--"
                      title="Steps"
                      subtitle="Not connected"
                    />
                    {/* Last Workout: the most recent completed workout, read from
                        the same fetchRecentWorkoutInfo result the Recent Workout
                        card below already uses -- no second fetch. Tapping it
                        opens that workout, exactly like the card does. With no
                        completed workout yet it shows the same "--" empty
                        treatment as Steps, never a made-up workout. */}
                    {recentWorkout ? (
                      <DashboardStat
                        testID="dashboard-stat-last-workout"
                        valueKind="text"
                        value={recentWorkout.workout.name}
                        title="Last Workout"
                        subtitle={formatWorkoutDate(recentWorkout.workout.performedAt)}
                        onPress={() =>
                          navigation.navigate('WorkoutDetail', {
                            workoutId: recentWorkout.workout.id,
                          })
                        }
                      />
                    ) : (
                      <DashboardStat
                        testID="dashboard-stat-last-workout"
                        value="--"
                        title="Last Workout"
                        subtitle="No workouts yet"
                      />
                    )}
                  </View>
                </View>
              </AppCard>
            </View>
            {/* The user's most recent completed workout, straight from
                fetchRecentWorkoutInfo -- no completed workout yet simply
                renders nothing (Next Workout above already covers "start
                one"), never a placeholder card. */}
            {recentWorkoutError || recentWorkout ? (
              <View testID="dashboard-recent-workout-section" style={styles.growRecent}>
                {recentWorkoutError ? (
                  <Text testID="dashboard-recent-workout-error" style={styles.errorText}>
                    {recentWorkoutError}
                  </Text>
                ) : null}
                {recentWorkout ? (
                  <RecentWorkoutCard
                    info={recentWorkout}
                    weightUnit={profile?.weightUnit ?? 'kg'}
                    accentColor={theme.accent}
                    accentBg={theme.accentBg}
                    onPress={() =>
                      navigation.navigate('WorkoutDetail', { workoutId: recentWorkout.workout.id })
                    }
                  />
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        ) : (
          // A ScrollView, like Workout mode: this screen used to be a fixed,
          // non-scrolling View whose widgets were squeezed to fit, which
          // clips at larger Dynamic Type sizes (the layout can't grow to fit
          // its text). Widgets now keep their natural size and the stack
          // scrolls only if it genuinely exceeds the viewport.
          <ScrollView
            testID="dashboard-nutrition-content"
            style={styles.scrollAreaInner}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: headerHeight + spacing.md, paddingBottom: spacing.lg },
              styles.widgetStack,
            ]}
          >
            {profileError ? (
              <Text testID="dashboard-profile-error" style={styles.errorText}>
                {profileError}
              </Text>
            ) : null}

            <View testID="dashboard-nutrition-hero-section">
              {nutritionError ? (
                <Text testID="dashboard-nutrition-error" style={styles.errorText}>
                  {nutritionError}
                </Text>
              ) : null}
              <AppCard
                hero
                testID="dashboard-nutrition"
                style={styles.compactCard}
                onPress={() => navigation.navigate('Nutrition')}
              >
                <View style={styles.ringCardTop}>
                  <CalorieRing
                    percent={caloriePercent}
                    active={nutritionGoals.calories !== null}
                    accentColor={theme.accent}
                  />
                  <View style={styles.calorieNumbers}>
                    <View style={styles.calorieHeaderRow}>
                      <Feather name="zap" size={13} color={theme.accent} />
                      <Text style={styles.calorieLabel}>Calories</Text>
                    </View>
                    <Text testID="dashboard-calories" style={styles.calorieBigValue}>
                      {consumed.calories.toLocaleString()}
                      {nutritionGoals.calories !== null ? (
                        <Text style={styles.calorieBigGoal}>
                          {' '}
                          / {nutritionGoals.calories.toLocaleString()}
                        </Text>
                      ) : null}
                    </Text>
                    {caloriesRemaining !== null ? (
                      <Text
                        testID="dashboard-calories-remaining"
                        style={[
                          styles.calorieRemaining,
                          caloriesRemaining >= 0 && { color: theme.accent },
                        ]}
                      >
                        {caloriesRemaining >= 0
                          ? `${caloriesRemaining.toLocaleString()} kcal left`
                          : `${Math.abs(caloriesRemaining).toLocaleString()} kcal over`}
                      </Text>
                    ) : null}
                    {!hasAnyNutritionGoal ? (
                      <Text testID="dashboard-nutrition-no-goals" style={styles.noGoalsText}>
                        Set your nutrition goals
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.heroDivider}>
                  <View style={styles.macroRow}>
                    <MacroCard
                      testID="dashboard-protein"
                      label="Protein"
                      consumed={consumed.proteinG}
                      goal={nutritionGoals.proteinG}
                      unit="g"
                      accentColor={theme.accent}
                    />
                    <MacroCard
                      testID="dashboard-carbs"
                      label="Carbs"
                      consumed={consumed.carbsG}
                      goal={nutritionGoals.carbsG}
                      unit="g"
                      accentColor={theme.accent}
                    />
                    <MacroCard
                      testID="dashboard-fat"
                      label="Fat"
                      consumed={consumed.fatG}
                      goal={nutritionGoals.fatG}
                      unit="g"
                      accentColor={theme.accent}
                      last
                    />
                  </View>
                </View>
              </AppCard>
            </View>

            <View testID="dashboard-nutrition-quick-actions-section">
              {/* One card, three actions, hairline-separated -- not three cards. */}
              <AppCard style={styles.compactCard}>
                <View style={styles.quickActionsRow}>
                  <TouchableOpacity
                    testID="dashboard-quick-search"
                    style={styles.quickAction}
                    onPress={() => navigation.navigate('FoodSearch')}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Search Food"
                  >
                    <Feather name="search" size={20} color={theme.accent} />
                    <Text style={styles.quickActionTitle}>Search Food</Text>
                  </TouchableOpacity>
                  <View style={styles.quickActionDivider} />
                  {/* Quick Add has no action behind it yet, so it is a plain view --
                      not announced as a button, and never a control that silently does nothing. */}
                  <View testID="dashboard-quick-add" style={styles.quickAction}>
                    <Feather name="plus-circle" size={20} color={theme.accent} />
                    <Text style={styles.quickActionTitle}>Quick Add</Text>
                  </View>
                  <View style={styles.quickActionDivider} />
                  <TouchableOpacity
                    testID="dashboard-quick-scan"
                    style={styles.quickAction}
                    onPress={() => navigation.navigate('BarcodeScanner')}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Scan Barcode"
                  >
                    <Feather name="camera" size={20} color={theme.accent} />
                    <Text style={styles.quickActionTitle}>Scan Barcode</Text>
                  </TouchableOpacity>
                </View>
              </AppCard>
            </View>

            <View testID="dashboard-nutrition-meals-section">
              <AppCard testID="dashboard-todays-meals" style={styles.compactCard}>
                <TouchableOpacity
                  testID="dashboard-view-meals"
                  style={styles.mealsHeaderRow}
                  onPress={() => navigation.navigate('Nutrition')}
                  accessibilityRole="button"
                  accessibilityLabel="View all of today's meals"
                >
                  <Text style={styles.mealsHeaderTitle}>{"Today's Meals"}</Text>
                  <Feather name="chevron-right" size={18} color={colors.textMuted} />
                </TouchableOpacity>
                {nutritionLogs.length === 0 ? (
                  <Text testID="dashboard-meals-empty" style={styles.mealsEmptyText}>
                    No meals logged today
                  </Text>
                ) : (
                  // The header row above reaches the full list; this is the
                  // most recent handful. (Capped at 3 back when this screen
                  // was a fixed-height layout that had to fit; it scrolls now.)
                  nutritionLogs
                    .slice(0, 4)
                    .map((log) => (
                      <ListRow
                        key={log.id}
                        divider
                        icon="coffee"
                        title={log.foodNameSnapshot}
                        subtitle={`${log.servingSize}${log.servingUnit} × ${log.quantity}`}
                        value={`${log.calories} kcal`}
                      />
                    ))
                )}
              </AppCard>
            </View>
            <View>
              {/* The week's target is always the user's own saved daily
                  calorie target (Nutrition Goals) x7 -- see
                  computeWeeklyCalorieSummary. No goal set yet still shows an
                  honest empty state, never a fabricated number. This is the
                  last Nutrition-mode widget; it's sized by its own content
                  like every other one. */}
              <AppCard testID="dashboard-weekly-calories-card" style={styles.compactCard}>
                <View style={styles.goalsHeaderRow}>
                  <Text style={styles.cardTitle}>Weekly Calories</Text>
                </View>
                <View
                  testID="dashboard-weekly-calories-content"
                  style={styles.weeklyCaloriesContentFill}
                >
                  {weeklyCalorieSummary ? (
                    <>
                      <Text
                        testID="dashboard-weekly-calories-target"
                        style={styles.weeklyCaloriesValue}
                      >
                        {weeklyCalorieSummary.target.toLocaleString()}
                      </Text>
                      <Text style={styles.weeklyCaloriesUnit}>kcal / week</Text>
                      <View style={styles.weeklyCaloriesBarTrack}>
                        <View
                          style={[
                            styles.weeklyCaloriesBarFill,
                            {
                              width: `${weeklyCalorieSummary.percent * 100}%`,
                              backgroundColor: theme.accent,
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.weeklyCaloriesStatsRow}>
                        <View style={styles.weeklyCaloriesStatBlock}>
                          <Text style={styles.weeklyCaloriesStatLabel}>Consumed</Text>
                          <Text
                            testID="dashboard-weekly-calories-consumed"
                            style={styles.weeklyCaloriesStatValue}
                          >
                            {weeklyCalorieSummary.consumed.toLocaleString()}
                          </Text>
                        </View>
                        <View style={styles.weeklyCaloriesStatDivider} />
                        <View style={styles.weeklyCaloriesStatBlock}>
                          <Text style={styles.weeklyCaloriesStatLabel}>Remaining</Text>
                          <Text
                            testID="dashboard-weekly-calories-remaining"
                            style={[styles.weeklyCaloriesStatValue, { color: theme.accent }]}
                          >
                            {weeklyCalorieSummary.remaining.toLocaleString()}
                          </Text>
                        </View>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.noGoalsText}>Set your weekly calorie goal</Text>
                  )}
                </View>
              </AppCard>
            </View>
          </ScrollView>
        )}
      </View>

      <NutritionForegroundLayer visible={mode === 'nutrition'} />
    </View>
  );
}
