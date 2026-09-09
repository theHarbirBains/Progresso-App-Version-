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
import { EmptyState } from '../design/EmptyState';
import { LoadingState } from '../design/LoadingState';
import { QuickActionMenu } from '../design/QuickActionMenu';
import { SectionHeader } from '../design/SectionHeader';
import { colors, spacing } from '../design/theme';
import { getGreeting, greetingName } from '../dashboard/greeting';
import { getMyProfile, type ProfileResponse } from '../lib/api';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { fetchTodaysFoodLogs, type FoodLogRow } from '../nutrition/foodLogQueries';
import { sumDailyTotals } from '../nutrition/nutritionCalculations';
import { fetchNutritionGoals, type NutritionGoals } from '../nutrition/nutritionGoalQueries';
import { MuscleVisualization } from '../workouts/MuscleVisualization';
import { computeNextWorkout, type NextWorkoutPlan } from '../workouts/nextWorkout';
import { SPLIT_MUSCLE_GROUP_LABELS } from '../workouts/splitMuscleGroups';
import { fetchActiveWorkout, type WorkoutSummary } from '../workouts/workoutQueries';
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

const STAT_PLACEHOLDERS: { key: string; title: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'workouts', title: 'Workouts', icon: 'activity' },
  { key: 'volume', title: 'Training Volume', icon: 'trending-up' },
  { key: 'week', title: 'This Week', icon: 'calendar' },
  { key: 'duration', title: 'Avg Duration', icon: 'clock' },
];

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

function CalorieRing({
  percent,
  active,
  accentColor,
}: {
  percent: number;
  active: boolean;
  accentColor: string;
}) {
  const size = 72;
  const strokeWidth = 7;
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

function MacroCard({
  testID,
  label,
  consumed,
  goal,
  unit,
  accentColor,
}: {
  testID: string;
  label: string;
  consumed: number;
  goal: number | null;
  unit: string;
  accentColor: string;
}) {
  const percent = ratio(consumed, goal);
  return (
    <View testID={testID} style={styles.macroCard}>
      <Text style={styles.macroName}>{label}</Text>
      <Text style={styles.macroAmount}>
        {consumed}
        {unit}
        {goal !== null ? ` / ${goal}${unit}` : ''}
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

  const { openMenu } = useAppMenu();
  const [mode, setMode] = useState<Mode>('workout');
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

  const [nutritionLogs, setNutritionLogs] = useState<FoodLogRow[]>([]);
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
    setNutritionError(null);

    const [profileResult, activeResult, nutritionResult] = await Promise.allSettled([
      getMyProfile(accessToken),
      fetchActiveWorkout(userId),
      Promise.all([fetchTodaysFoodLogs(userId), fetchNutritionGoals(userId)]),
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
      setNutritionGoals(nutritionResult.value[1]);
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
  const greeting = name ? `${getGreeting()}, ${name}` : getGreeting();
  const avatarInitial = name ? name.charAt(0).toUpperCase() : null;

  const consumed = sumDailyTotals(nutritionLogs);
  const hasAnyNutritionGoal =
    nutritionGoals.calories !== null ||
    nutritionGoals.proteinG !== null ||
    nutritionGoals.carbsG !== null ||
    nutritionGoals.fatG !== null;
  const caloriePercent = ratio(consumed.calories, nutritionGoals.calories);

  return (
    <View style={styles.screen} testID="dashboard-screen">
      <View
        testID="dashboard-fixed-header"
        onLayout={onHeaderLayout}
        style={[styles.fixedHeader, { paddingTop: insets.top + spacing.lg }]}
      >
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <TouchableOpacity
              testID="dashboard-open-menu"
              style={styles.iconButton}
              onPress={openMenu}
              accessibilityLabel="Open menu"
              accessibilityRole="button"
            >
              <Feather name="menu" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            <View style={styles.brandRow}>
              <Image source={logo} style={styles.logo} resizeMode="contain" />
              <Text style={styles.wordmark}>PROGRESSO</Text>
            </View>
          </View>
          <View style={styles.iconButton}>
            <Feather name="bell" size={18} color={colors.textSecondary} />
          </View>
        </View>

        <View style={styles.modeToggle}>
          <TouchableOpacity
            testID="dashboard-mode-workout"
            style={styles.modeSegment}
            onPress={() => setMode('workout')}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.modeSegmentFill,
                { backgroundColor: workoutTheme.accent, opacity: workoutFillOpacity },
              ]}
            />
            <Feather
              name="activity"
              size={16}
              color={mode === 'workout' ? workoutTheme.onAccent : colors.textSecondary}
            />
            <Text
              style={[
                styles.modeSegmentText,
                mode === 'workout' && { color: workoutTheme.onAccent, fontWeight: '700' },
              ]}
            >
              Workout
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="dashboard-mode-nutrition"
            style={styles.modeSegment}
            onPress={() => setMode('nutrition')}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.modeSegmentFill,
                { backgroundColor: nutritionTheme.accent, opacity: nutritionFillOpacity },
              ]}
            />
            <Feather
              name="pie-chart"
              size={16}
              color={mode === 'nutrition' ? nutritionTheme.onAccent : colors.textSecondary}
            />
            <Text
              style={[
                styles.modeSegmentText,
                mode === 'nutrition' && { color: nutritionTheme.onAccent, fontWeight: '700' },
              ]}
            >
              Nutrition
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        testID="dashboard-scroll"
        style={styles.scrollArea}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + spacing.lg, paddingBottom: footerHeight + spacing.lg },
        ]}
      >
        <View style={styles.greetingRow}>
          <View style={styles.greetingBlock}>
            <Text testID="dashboard-greeting" style={styles.greeting}>
              {greeting}
            </Text>
          </View>
          <TouchableOpacity
            testID="open-account-settings"
            style={styles.avatar}
            onPress={() => navigation.navigate('AccountSettings')}
            accessibilityLabel="Settings"
            accessibilityRole="button"
          >
            {avatarInitial ? (
              <Text style={styles.avatarInitial}>{avatarInitial}</Text>
            ) : (
              <Feather name="user" size={18} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
        </View>

        {profileError ? (
          <Text testID="dashboard-profile-error" style={styles.errorText}>
            {profileError}
          </Text>
        ) : null}

        {mode === 'workout' ? (
          <>
            <View style={styles.section}>
              <SectionHeader label="Upcoming Workout" />
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
                <AppCard hero testID="dashboard-next-workout">
                  <Text style={styles.nextWorkoutEyebrow}>Your Next Workout</Text>
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
                  <Text style={styles.nextWorkoutMessage}>
                    {nextWorkoutPlan.previousDayName
                      ? `You completed ${nextWorkoutPlan.previousDayName} last. Time to hit ${nextWorkoutPlan.day.name}.`
                      : "Let's get started."}
                  </Text>

                  <View style={styles.nextWorkoutVisualization}>
                    <MuscleVisualization
                      testID="dashboard-muscle-visualization"
                      muscleGroups={nextWorkoutPlan.day.muscleGroups}
                      accentColor={theme.accent}
                      side="front"
                      scale={0.7}
                    />
                  </View>

                  <TouchableOpacity
                    testID="dashboard-start-next-workout"
                    style={[styles.nextWorkoutButton, { backgroundColor: theme.accent }]}
                    onPress={() => navigation.navigate('NewWorkout')}
                  >
                    <Text style={[styles.nextWorkoutButtonText, { color: theme.onAccent }]}>
                      Start {nextWorkoutPlan.day.name} Workout
                    </Text>
                    <Feather name="arrow-right" size={18} color={theme.onAccent} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="dashboard-change-split"
                    style={styles.nextWorkoutSecondaryButton}
                    onPress={() => navigation.navigate('WorkoutSplits')}
                  >
                    <Text style={styles.nextWorkoutSecondaryButtonText}>Change</Text>
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

            <View style={styles.section}>
              <AppCard testID="dashboard-create-story">
                <View style={styles.storyCard}>
                  <View style={styles.storyIconBox}>
                    <Feather name="camera" size={20} color={colors.textPrimary} />
                  </View>
                  <View style={styles.storyTextBlock}>
                    <Text style={styles.storyTitle}>Create Your Story</Text>
                    <Text style={styles.storySubtitle}>
                      Add a photo or create a progress slideshow
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={colors.textMuted} />
                </View>
              </AppCard>
            </View>

            <View style={styles.section}>
              <View style={styles.statsGrid}>
                {STAT_PLACEHOLDERS.map((stat) => (
                  <AppCard
                    key={stat.key}
                    testID={`dashboard-stat-${stat.key}`}
                    style={styles.statCard}
                  >
                    <View style={styles.statIconWrap}>
                      <Feather name={stat.icon} size={16} color={colors.textMuted} />
                    </View>
                    <Text style={styles.statTitle}>{stat.title}</Text>
                    <Text style={styles.statValue}>No data yet</Text>
                  </AppCard>
                ))}
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.section}>
              <SectionHeader label="Calories Today" />
              {nutritionError ? (
                <Text testID="dashboard-nutrition-error" style={styles.errorText}>
                  {nutritionError}
                </Text>
              ) : null}
              <AppCard
                testID="dashboard-nutrition"
                onPress={() => navigation.navigate('Nutrition')}
              >
                <View style={styles.ringCardTop}>
                  <CalorieRing
                    percent={caloriePercent}
                    active={nutritionGoals.calories !== null}
                    accentColor={theme.accent}
                  />
                  <View style={styles.calorieNumbers}>
                    <Text testID="dashboard-calories" style={styles.calorieText}>
                      Calories:{' '}
                      <Text style={styles.calorieValue}>
                        {consumed.calories}
                        {nutritionGoals.calories !== null ? ` / ${nutritionGoals.calories}` : ''}
                      </Text>
                    </Text>
                    {!hasAnyNutritionGoal ? (
                      <Text testID="dashboard-nutrition-no-goals" style={styles.noGoalsText}>
                        Set your nutrition goals
                      </Text>
                    ) : null}
                  </View>
                </View>

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
                  />
                </View>
              </AppCard>
            </View>

            <View style={styles.section}>
              <View style={styles.quickActionsRow}>
                <AppCard testID="dashboard-quick-search" style={styles.quickActionCard}>
                  <View style={styles.quickActionIcon}>
                    <Feather name="search" size={16} color={colors.textPrimary} />
                  </View>
                  <Text style={styles.quickActionTitle}>Search Food</Text>
                  <Text style={styles.quickActionSubtitle}>Find and log food</Text>
                </AppCard>
                <AppCard testID="dashboard-quick-add" style={styles.quickActionCard}>
                  <View style={styles.quickActionIcon}>
                    <Feather name="plus-circle" size={16} color={colors.textPrimary} />
                  </View>
                  <Text style={styles.quickActionTitle}>Quick Add</Text>
                  <Text style={styles.quickActionSubtitle}>Add a food item</Text>
                </AppCard>
                <AppCard testID="dashboard-quick-scan" style={styles.quickActionCard}>
                  <View style={styles.quickActionIcon}>
                    <Feather name="camera" size={16} color={colors.textPrimary} />
                  </View>
                  <Text style={styles.quickActionTitle}>Scan Barcode</Text>
                  <Text style={styles.quickActionSubtitle}>Log in seconds</Text>
                </AppCard>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <SectionHeader label="Recent Meals" />
                <TouchableOpacity
                  testID="dashboard-view-meals"
                  onPress={() => navigation.navigate('Nutrition')}
                >
                  <Text style={[styles.viewAllText, { color: theme.accent }]}>View All</Text>
                </TouchableOpacity>
              </View>
              <AppCard>
                {nutritionLogs.length === 0 ? (
                  <EmptyState
                    testID="dashboard-meals-empty"
                    icon={<Feather name="coffee" size={24} color={colors.textMuted} />}
                    title="No meals logged today"
                  />
                ) : (
                  nutritionLogs.slice(0, 4).map((log, index) => (
                    <View
                      key={log.id}
                      style={[styles.listRow, index > 0 ? styles.listRowDivider : null]}
                    >
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

            <View style={styles.section}>
              <AppCard
                testID="dashboard-nutrition-goals-card"
                onPress={() => navigation.navigate('NutritionGoals')}
              >
                <View style={styles.goalsHeaderRow}>
                  <View style={styles.goalsTitleRow}>
                    <Feather name="target" size={16} color={theme.accent} />
                    <Text style={styles.cardTitle}>Nutrition Goals</Text>
                  </View>
                  <View style={styles.goalsTitleRow}>
                    <Text style={[styles.viewAllText, { color: theme.accent }]}>View / Edit</Text>
                    <Feather name="chevron-right" size={16} color={colors.textMuted} />
                  </View>
                </View>
                {hasAnyNutritionGoal ? (
                  <View style={styles.goalsProgressTrack}>
                    <View
                      style={[
                        styles.goalsProgressFill,
                        { width: `${caloriePercent * 100}%`, backgroundColor: theme.accent },
                      ]}
                    />
                  </View>
                ) : (
                  <Text style={styles.noGoalsText}>Set your nutrition goals</Text>
                )}
              </AppCard>
            </View>
          </>
        )}
      </ScrollView>

      <View
        style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8) }]}
        testID="dashboard-bottom-bar"
        onLayout={onFooterLayout}
      >
        <View style={styles.bottomBarItem}>
          <Feather name="home" size={20} color={theme.accent} />
          <Text style={[styles.bottomBarLabel, { color: theme.accent }]}>Home</Text>
        </View>
        <TouchableOpacity
          testID="dashboard-bottom-workouts"
          style={styles.bottomBarItem}
          onPress={() => navigation.navigate(mode === 'workout' ? 'WorkoutHistory' : 'Nutrition')}
        >
          <Feather
            name={mode === 'workout' ? 'activity' : 'pie-chart'}
            size={20}
            color={colors.textMuted}
          />
          <Text style={[styles.bottomBarLabel, { color: colors.textMuted }]}>
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
            color={colors.textMuted}
          />
          <Text style={[styles.bottomBarLabel, { color: colors.textMuted }]}>
            {mode === 'workout' ? 'Progress' : 'Goals'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="dashboard-bottom-social"
          style={styles.bottomBarItem}
          onPress={() => navigation.navigate('Social')}
        >
          <Feather name="users" size={20} color={colors.textMuted} />
          <Text style={[styles.bottomBarLabel, { color: colors.textMuted }]}>Social</Text>
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
