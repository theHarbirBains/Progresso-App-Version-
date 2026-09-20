import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Circle, Svg } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { GlassBackground } from '../design/GlassBackground';
import { IconButton } from '../design/IconButton';
import { LoadingState } from '../design/LoadingState';
import { ModeToggle } from '../design/ModeToggle';
import { QuickActionMenu } from '../design/QuickActionMenu';
import { colors, spacing } from '../design/theme';
import { DashboardStatCard } from '../dashboard/DashboardStatCard';
import { NutritionForegroundLayer } from '../dashboard/NutritionForegroundLayer';
import { computeWeeklyProgress, getCurrentWeekRange } from '../dashboard/weeklyProgress';
import { firstName, getGreeting, greetingName } from '../dashboard/greeting';
import { getMyProfile, type ProfileResponse } from '../lib/api';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import {
  fetchTodaysFoodLogs,
  fetchWeeklyFoodLogs,
  type FoodLogRow,
} from '../nutrition/foodLogQueries';
import { computeWeeklyCalorieSummary, sumDailyTotals } from '../nutrition/nutritionCalculations';
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
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

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

  // Drives the Workout<->Nutrition accent crossfade. Only elements that
  // persist across a mode switch (the mode toggle's fill, the bottom bar's
  // accent) can meaningfully animate -- content inside the Workout/Nutrition
  // branches below unmounts and remounts on toggle, so it simply renders
  // with the new mode's theme already applied. Each theme's own accent is a
  // static, always-mounted layer whose *opacity* crossfades (rather than
  // interpolating a single color value) so the whole transition can run on
  // the native driver.
  const themeAnim = useRef(new Animated.Value(mode === 'workout' ? 0 : 1)).current;
  useEffect(() => {
    Animated.timing(themeAnim, {
      toValue: mode === 'workout' ? 0 : 1,
      duration: 260,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [mode, themeAnim]);
  const workoutFillOpacity = themeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const nutritionFillOpacity = themeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  // Measured (not hardcoded) heights of the fixed header/footer, so the
  // scrollable content's own top/bottom padding always matches whatever
  // actually renders on this device -- safe-area inset, font scaling, etc.
  // The fallback values only cover the first frame or two before onLayout
  // reports a real measurement.
  const [headerHeight, setHeaderHeight] = useState(160);
  const [footerHeight, setFooterHeight] = useState(90);
  const onHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    setHeaderHeight(event.nativeEvent.layout.height);
  }, []);
  const onFooterLayout = useCallback((event: LayoutChangeEvent) => {
    setFooterHeight(event.nativeEvent.layout.height);
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
    setNutritionError(null);

    const { start: weekStart, end: weekEnd } = getCurrentWeekRange();

    const [profileResult, activeResult, statsResult, weekWorkoutsResult, nutritionResult] =
      await Promise.allSettled([
        getMyProfile(accessToken),
        fetchActiveWorkout(userId),
        Promise.all([fetchAllCompletedWorkouts(userId), fetchAllExerciseHistory(userId)]),
        fetchWorkoutsForDateRange(userId, weekStart, weekEnd),
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

  const name = greetingName(profile?.displayName, profile?.username);
  const greetingEyebrow = `${getGreeting()},`.toUpperCase();
  const greetingDisplayName = name ? firstName(name) : '';

  const consumed = sumDailyTotals(nutritionLogs);
  const hasAnyNutritionGoal =
    nutritionGoals.calories !== null ||
    nutritionGoals.proteinG !== null ||
    nutritionGoals.carbsG !== null ||
    nutritionGoals.fatG !== null;
  const caloriePercent = ratio(consumed.calories, nutritionGoals.calories);
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
  const weeklyGoalValue =
    weeklyProgress.goalCount !== null
      ? `${weeklyProgress.completedCount}/${weeklyProgress.goalCount}`
      : String(weeklyProgress.completedCount);

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
              { paddingTop: headerHeight + spacing.md, paddingBottom: footerHeight + spacing.lg },
              // Workout mode's content (greeting + the three widgets) is
              // short enough on most phones to leave a large empty gap
              // below This Week -- flexGrow: 1 lets the content container
              // claim the ScrollView's full available height (standard RN
              // pattern for "fill the viewport, but still scroll if content
              // ever exceeds it" -- e.g. large accessibility text sizes),
              // and justifyContent: 'space-between' then distributes that
              // leftover space evenly between the greeting and the three
              // widgets, so gaps grow or shrink to whatever the device's
              // actual height allows rather than a fixed guess. This
              // ScrollView is Workout-mode only -- see the plain,
              // non-scrolling View in the Nutrition-mode branch below for
              // why Nutrition mode has no scrollable viewport at all.
              styles.workoutModeFillContent,
            ]}
          >
            <View style={styles.greetingRow}>
              <View style={styles.greetingBlock}>
                <GlassBackground bordered={false} />
                <Text testID="dashboard-greeting-eyebrow" style={styles.greetingEyebrow}>
                  {greetingEyebrow}
                </Text>
                <Text testID="dashboard-greeting" style={styles.greeting}>
                  {greetingDisplayName}
                </Text>
              </View>
            </View>

            {profileError ? (
              <Text testID="dashboard-profile-error" style={styles.errorText}>
                {profileError}
              </Text>
            ) : null}

            <View style={styles.section}>
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
                  <View style={styles.listRow}>
                    <View style={styles.listThumb}>
                      <Feather name="activity" size={18} color={theme.accent} />
                    </View>
                    <View style={styles.listRowBody}>
                      <Text style={styles.listRowTitle}>{activeWorkout.name}</Text>
                      <Text style={styles.listRowMeta}>In progress · tap to resume</Text>
                    </View>
                    <Feather name="chevron-right" size={20} color={colors.textMuted} />
                  </View>
                </AppCard>
              ) : nextWorkoutPlan ? (
                <AppCard hero testID="dashboard-next-workout" style={styles.condensedCard}>
                  <View style={styles.nextWorkoutHeaderRow}>
                    <Text style={styles.nextWorkoutEyebrow}>Your Next Workout</Text>
                    {splitBadgeText(nextWorkoutPlan.splitName) ? (
                      <View
                        testID="dashboard-next-workout-badge"
                        style={[
                          styles.splitBadge,
                          { backgroundColor: theme.accentBg, borderColor: theme.accentBorder },
                        ]}
                      >
                        <Text style={[styles.splitBadgeText, { color: theme.accent }]}>
                          {splitBadgeText(nextWorkoutPlan.splitName)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.nextWorkoutDayName}>{nextWorkoutPlan.day.name}</Text>
                  <Text style={styles.nextWorkoutSplitName}>{nextWorkoutPlan.splitName}</Text>
                  {nextWorkoutPlan.day.muscleGroups.length > 0 ? (
                    <Text
                      testID="dashboard-next-workout-muscles"
                      style={styles.nextWorkoutSplitName}
                    >
                      {nextWorkoutPlan.day.muscleGroups
                        .map((group) => SPLIT_MUSCLE_GROUP_LABELS[group])
                        .join(' • ')}
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    testID="dashboard-start-next-workout"
                    style={[styles.nextWorkoutButton, { backgroundColor: theme.accent }]}
                    onPress={() => navigation.navigate('NewWorkout')}
                  >
                    <Text style={[styles.nextWorkoutButtonText, { color: theme.onAccent }]}>
                      Start Workout
                    </Text>
                    <Feather name="arrow-right" size={18} color={theme.onAccent} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="dashboard-change-split"
                    style={styles.nextWorkoutSecondaryButton}
                    onPress={() => navigation.navigate('WorkoutSplits')}
                  >
                    <Text style={styles.nextWorkoutSecondaryButtonText}>Change Workout</Text>
                  </TouchableOpacity>
                </AppCard>
              ) : (
                <AppCard
                  testID="dashboard-start-workout"
                  onPress={() => navigation.navigate('NewWorkout')}
                >
                  <View style={styles.listRow}>
                    <View style={styles.listThumb}>
                      <Feather name="calendar" size={18} color={colors.textMuted} />
                    </View>
                    <View style={styles.listRowBody}>
                      <Text style={styles.listRowTitle}>No upcoming workout</Text>
                      <Text style={styles.listRowMeta}>Tap to start a new workout</Text>
                    </View>
                    <Feather name="chevron-right" size={20} color={colors.textMuted} />
                  </View>
                </AppCard>
              )}
            </View>

            <View style={styles.section} testID="dashboard-stat-grid">
              {statsError ? (
                <Text testID="dashboard-stats-error" style={styles.errorText}>
                  {statsError}
                </Text>
              ) : null}
              <View style={styles.statGridRow}>
                <DashboardStatCard
                  testID="dashboard-stat-sets"
                  icon="check-circle"
                  value={String(allSetHistory.length)}
                  title="Sets Done"
                  subtitle="All Time"
                  accentColor={theme.accent}
                  onPress={() => navigation.navigate('ProgressOverview')}
                />
                <DashboardStatCard
                  testID="dashboard-stat-workouts-month"
                  icon="calendar"
                  value={String(lifetimeStats.workoutsThisMonth)}
                  title="Workouts"
                  subtitle="This Month"
                  accentColor={theme.accent}
                  onPress={() => navigation.navigate('ProgressOverview')}
                />
              </View>
              <View style={[styles.statGridRow, { marginTop: spacing.xs }]}>
                <DashboardStatCard
                  testID="dashboard-stat-steps"
                  icon="activity"
                  value="--"
                  title="Steps"
                  subtitle="Not connected"
                  accentColor={theme.accent}
                />
                <DashboardStatCard
                  testID="dashboard-stat-weekly-goal"
                  icon="target"
                  value={weeklyGoalValue}
                  title="Weekly Goal"
                  subtitle="This Week"
                  accentColor={theme.accent}
                />
              </View>
            </View>

            <View style={styles.section}>
              {weekWorkoutsError ? (
                <Text testID="dashboard-weekly-error" style={styles.errorText}>
                  {weekWorkoutsError}
                </Text>
              ) : null}
              <AppCard testID="dashboard-weekly-progress" style={styles.condensedCard}>
                <View style={styles.weeklyHeaderRow}>
                  <Text testID="dashboard-weekly-count" style={styles.weeklyCountText}>
                    This week
                  </Text>
                  <TouchableOpacity
                    testID="dashboard-weekly-view-details"
                    onPress={() => navigation.navigate('WorkoutHistory')}
                  >
                    <Text style={[styles.viewAllText, { color: theme.accent }]}>View Details</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.weeklyDaysRow}>
                  {weeklyProgress.days.map((day) => (
                    <View
                      key={day.label}
                      style={styles.weeklyDay}
                      accessible
                      accessibilityLabel={`${day.label}, ${
                        day.completed ? 'completed' : day.isRestDay ? 'rest day' : 'not completed'
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
              </AppCard>
            </View>
          </ScrollView>
        ) : (
          <View
            testID="dashboard-nutrition-content"
            style={[
              styles.nutritionScreenArea,
              { paddingTop: headerHeight + spacing.md, paddingBottom: footerHeight + spacing.lg },
            ]}
          >
            <View testID="dashboard-nutrition-greeting-row" style={styles.nutritionGreetingRow}>
              <View style={styles.nutritionGreetingBlock}>
                <Text testID="dashboard-greeting-eyebrow" style={styles.greetingEyebrow}>
                  {greetingEyebrow}
                </Text>
                <Text testID="dashboard-greeting" style={styles.greeting}>
                  {greetingDisplayName}
                </Text>
              </View>
            </View>

            {profileError ? (
              <Text testID="dashboard-profile-error" style={styles.errorText}>
                {profileError}
              </Text>
            ) : null}

            <View testID="dashboard-nutrition-hero-section" style={styles.nutritionSection}>
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

            <View
              testID="dashboard-nutrition-quick-actions-section"
              style={[styles.nutritionSection, styles.nutritionQuickActionsSectionShrink]}
            >
              <View style={styles.quickActionsRow}>
                <AppCard
                  testID="dashboard-quick-search"
                  style={[styles.compactCard, styles.quickActionCard]}
                  onPress={() => navigation.navigate('FoodSearch')}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: theme.accentBg }]}>
                    <Feather name="search" size={16} color={theme.accent} />
                  </View>
                  <Text style={styles.quickActionTitle}>Search Food</Text>
                  <Text style={styles.quickActionSubtitle}>Find and log food</Text>
                </AppCard>
                <AppCard
                  testID="dashboard-quick-add"
                  style={[styles.compactCard, styles.quickActionCard]}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: theme.accentBg }]}>
                    <Feather name="plus-circle" size={16} color={theme.accent} />
                  </View>
                  <Text style={styles.quickActionTitle}>Quick Add</Text>
                  <Text style={styles.quickActionSubtitle}>Add a food item</Text>
                </AppCard>
                <AppCard
                  testID="dashboard-quick-scan"
                  style={[styles.compactCard, styles.quickActionCard]}
                  onPress={() => navigation.navigate('BarcodeScanner')}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: theme.accentBg }]}>
                    <Feather name="camera" size={16} color={theme.accent} />
                  </View>
                  <Text style={styles.quickActionTitle}>Scan Barcode</Text>
                  <Text style={styles.quickActionSubtitle}>Log in seconds</Text>
                </AppCard>
              </View>
            </View>

            <View
              testID="dashboard-nutrition-meals-section"
              style={[styles.nutritionSection, styles.nutritionMealsSection]}
            >
              <AppCard testID="dashboard-todays-meals" style={styles.compactCard}>
                <TouchableOpacity
                  testID="dashboard-view-meals"
                  style={styles.mealsHeaderRow}
                  onPress={() => navigation.navigate('Nutrition')}
                  accessibilityRole="button"
                  accessibilityLabel="View all of today's meals"
                >
                  <View style={[styles.mealsHeaderIcon, { backgroundColor: theme.accentBg }]}>
                    <Feather name="coffee" size={16} color={theme.accent} />
                  </View>
                  <Text style={styles.mealsHeaderTitle}>{"Today's Meals"}</Text>
                  <Feather name="chevron-right" size={18} color={colors.textMuted} />
                </TouchableOpacity>
                {nutritionLogs.length === 0 ? (
                  <Text testID="dashboard-meals-empty" style={styles.mealsEmptyText}>
                    No meals logged today
                  </Text>
                ) : (
                  // Capped to 3 (was 4) now that this card has to fit a
                  // fixed, non-scrolling layout alongside three other
                  // widgets -- the header row above already reaches the
                  // full list.
                  nutritionLogs.slice(0, 3).map((log) => (
                    <View key={log.id} style={[styles.listRow, styles.listRowDivider]}>
                      <View style={styles.listThumb}>
                        <Feather name="coffee" size={18} color={colors.textMuted} />
                      </View>
                      <View style={styles.listRowBody}>
                        <Text style={styles.listRowTitle}>{log.foodNameSnapshot}</Text>
                        <Text style={styles.listRowMeta}>
                          {log.servingSize}
                          {log.servingUnit} × {log.quantity}
                        </Text>
                      </View>
                      <Text style={[styles.listRowValue, { color: theme.accent }]}>
                        {log.calories} kcal
                      </Text>
                    </View>
                  ))
                )}
              </AppCard>
            </View>

            <View style={[styles.nutritionSection, styles.weeklyCaloriesSectionFill]}>
              {/* The week's target is always the user's own saved daily
                  calorie target (Nutrition Goals) x7 -- see
                  computeWeeklyCalorieSummary. No goal set yet still shows an
                  honest empty state, never a fabricated number. This is the
                  last Nutrition-mode widget; it's sized by its own content
                  like every other one, not stretched to fill leftover
                  screen space -- see weeklyCaloriesSectionFill's comment in
                  dashboardStyles.ts. */}
              <AppCard
                testID="dashboard-weekly-calories-card"
                style={[styles.compactCard, styles.weeklyCaloriesCardFill]}
              >
                <View style={styles.goalsHeaderRow}>
                  <View style={styles.goalsTitleRow}>
                    <Feather name="calendar" size={16} color={theme.accent} />
                    <Text style={styles.cardTitle}>Weekly Calories</Text>
                  </View>
                  <TouchableOpacity
                    testID="dashboard-weekly-calories-view-all"
                    onPress={() => navigation.navigate('Nutrition')}
                  >
                    <Text style={[styles.viewAllText, { color: theme.accent }]}>View All</Text>
                  </TouchableOpacity>
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
          </View>
        )}
      </View>

      <NutritionForegroundLayer visible={mode === 'nutrition'} />

      <View
        style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8) }]}
        testID="dashboard-bottom-bar"
        onLayout={onFooterLayout}
      >
        <GlassBackground variant="chrome" bordered={false} />
        <View style={styles.bottomBarItem}>
          <Feather name="home" size={20} color={theme.accent} />
          <Text style={[styles.bottomBarLabel, { color: theme.accent }]}>Home</Text>
        </View>
        <TouchableOpacity
          testID="dashboard-bottom-workouts"
          style={styles.bottomBarItem}
          onPress={() => navigation.navigate(mode === 'workout' ? 'WorkoutHistory' : 'FoodLibrary')}
        >
          <Feather
            name={mode === 'workout' ? 'activity' : 'pie-chart'}
            size={20}
            color={colors.textSecondary}
          />
          <Text style={[styles.bottomBarLabel, { color: colors.textSecondary }]}>
            {mode === 'workout' ? 'Workouts' : 'Food'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="dashboard-bottom-plus"
          style={styles.bottomBarCenter}
          onPress={() => setQuickActionsOpen(true)}
          accessibilityLabel="Quick actions"
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.bottomBarCenterFill,
              { backgroundColor: workoutTheme.accent, opacity: workoutFillOpacity },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.bottomBarCenterFill,
              { backgroundColor: nutritionTheme.accent, opacity: nutritionFillOpacity },
            ]}
          />
          <Feather name="plus" size={22} color={theme.onAccent} />
        </TouchableOpacity>
        <TouchableOpacity
          testID="dashboard-bottom-progress"
          style={styles.bottomBarItem}
          disabled={mode !== 'workout'}
          onPress={() => navigation.navigate('ProgressOverview')}
        >
          <Feather
            name={mode === 'workout' ? 'trending-up' : 'target'}
            size={20}
            color={colors.textSecondary}
          />
          <Text style={[styles.bottomBarLabel, { color: colors.textSecondary }]}>
            {mode === 'workout' ? 'Progress' : 'Goals'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="dashboard-bottom-profile"
          style={styles.bottomBarItem}
          onPress={() => navigation.navigate('Profile')}
        >
          <Feather name="user" size={20} color={colors.textSecondary} />
          <Text style={[styles.bottomBarLabel, { color: colors.textSecondary }]}>Profile</Text>
        </TouchableOpacity>
      </View>

      <QuickActionMenu
        visible={quickActionsOpen}
        onClose={() => setQuickActionsOpen(false)}
        onStartWorkout={() => {
          setQuickActionsOpen(false);
          navigation.navigate('NewWorkout');
        }}
        onLogFood={() => {
          setQuickActionsOpen(false);
          navigation.navigate('Nutrition');
        }}
        accentColor={theme.accent}
      />
    </View>
  );
}
