import { useCallback, useEffect, useState } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Circle, Svg } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { Badge } from '../design/Badge';
import { EmptyState } from '../design/EmptyState';
import { LoadingState } from '../design/LoadingState';
import { ScreenContainer } from '../design/ScreenContainer';
import { SectionHeader } from '../design/SectionHeader';
import { colors } from '../design/theme';
import { fetchRecentWorkoutInfo, type RecentWorkoutInfo } from '../dashboard/recentWorkoutInfo';
import { getGreeting, greetingName } from '../dashboard/greeting';
import { getMyProfile, type ProfileResponse } from '../lib/api';
import { fromKg, roundWeight } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import { fetchTodaysFoodLogs, type FoodLogRow } from '../nutrition/foodLogQueries';
import { sumDailyTotals } from '../nutrition/nutritionCalculations';
import { fetchNutritionGoals, type NutritionGoals } from '../nutrition/nutritionGoalQueries';
import { compareToPrevious } from '../workouts/progressiveOverload';
import { fetchActiveWorkout, type WorkoutSummary } from '../workouts/workoutQueries';
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

function formatWeight(kg: number, unit: 'kg' | 'lb'): string {
  const value = roundWeight(fromKg(kg, unit));
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

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

function CalorieRing({ percent, active }: { percent: number; active: boolean }) {
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
            stroke={colors.accent}
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
}: {
  testID: string;
  label: string;
  consumed: number;
  goal: number | null;
  unit: string;
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
        <View style={[styles.macroBarFill, { width: `${percent * 100}%` }]} />
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

  const [mode, setMode] = useState<Mode>('workout');

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [activeWorkout, setActiveWorkout] = useState<WorkoutSummary | null>(null);
  const [activeWorkoutError, setActiveWorkoutError] = useState<string | null>(null);

  const [recentWorkout, setRecentWorkout] = useState<RecentWorkoutInfo | null>(null);
  const [recentWorkoutError, setRecentWorkoutError] = useState<string | null>(null);

  const [nutritionLogs, setNutritionLogs] = useState<FoodLogRow[]>([]);
  const [nutritionGoals, setNutritionGoals] = useState<NutritionGoals>(EMPTY_GOALS);
  const [nutritionError, setNutritionError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId || !accessToken) return;
    setLoading(true);
    setProfileError(null);
    setActiveWorkoutError(null);
    setRecentWorkoutError(null);
    setNutritionError(null);

    const [profileResult, activeResult, recentResult, nutritionResult] = await Promise.allSettled([
      getMyProfile(accessToken),
      fetchActiveWorkout(userId),
      fetchRecentWorkoutInfo(userId),
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

    if (recentResult.status === 'fulfilled') {
      setRecentWorkout(recentResult.value);
    } else {
      setRecentWorkoutError(errorMessage(recentResult.reason));
    }

    if (nutritionResult.status === 'fulfilled') {
      setNutritionLogs(nutritionResult.value[0]);
      setNutritionGoals(nutritionResult.value[1]);
    } else {
      setNutritionError(errorMessage(nutritionResult.reason));
    }

    setLoading(false);
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

  const weightUnit = profile?.weightUnit ?? 'kg';
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

  const insight = recentWorkout
    ? compareToPrevious(
        recentWorkout.topExerciseSets,
        recentWorkout.previousExerciseSets,
        (kg) => `${formatWeight(kg, weightUnit)}${weightUnit}`,
      )
    : null;

  return (
    <ScreenContainer testID="dashboard-screen">
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
          <Text style={styles.wordmark}>PROGRESSO</Text>
        </View>
        <View style={styles.iconButton}>
          <Feather name="bell" size={18} color={colors.textSecondary} />
        </View>
      </View>

      <View style={styles.modeToggle}>
        <TouchableOpacity
          testID="dashboard-mode-workout"
          style={[styles.modeSegment, mode === 'workout' && styles.modeSegmentActive]}
          onPress={() => setMode('workout')}
        >
          <Feather
            name="activity"
            size={16}
            color={mode === 'workout' ? colors.onAccent : colors.textSecondary}
          />
          <Text
            style={[styles.modeSegmentText, mode === 'workout' && styles.modeSegmentTextActive]}
          >
            Workout
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="dashboard-mode-nutrition"
          style={[styles.modeSegment, mode === 'nutrition' && styles.modeSegmentActive]}
          onPress={() => setMode('nutrition')}
        >
          <Feather
            name="pie-chart"
            size={16}
            color={mode === 'nutrition' ? colors.onAccent : colors.textSecondary}
          />
          <Text
            style={[styles.modeSegmentText, mode === 'nutrition' && styles.modeSegmentTextActive]}
          >
            Nutrition
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.greetingRow}>
        <View style={styles.greetingBlock}>
          <Text testID="dashboard-greeting" style={styles.greeting}>
            {greeting}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'workout' ? 'Consistency builds progress.' : 'Fuel your goals.'}
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
            ) : activeWorkout ? (
              <AppCard
                hero
                testID="dashboard-resume-workout"
                onPress={() =>
                  navigation.navigate('ActiveWorkout', { workoutId: activeWorkout.id })
                }
              >
                <View style={styles.listRow}>
                  <View style={styles.listThumb}>
                    <Feather name="activity" size={18} color={colors.accent} />
                  </View>
                  <View style={styles.listRowBody}>
                    <Text style={styles.listRowTitle}>{activeWorkout.name}</Text>
                    <Text style={styles.listRowMeta}>In progress · tap to resume</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={colors.textMuted} />
                </View>
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

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <SectionHeader label="Recent Top Sets" />
              <TouchableOpacity
                testID="dashboard-view-workouts"
                onPress={() => navigation.navigate('WorkoutHistory')}
              >
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            {recentWorkoutError ? (
              <Text testID="dashboard-recent-workout-error" style={styles.errorText}>
                {recentWorkoutError}
              </Text>
            ) : recentWorkout ? (
              <AppCard
                testID="dashboard-recent-workout"
                onPress={() =>
                  navigation.navigate('WorkoutDetail', { workoutId: recentWorkout.workout.id })
                }
              >
                <Text style={styles.cardTitle}>{recentWorkout.workout.name}</Text>
                <Text style={styles.cardMeta}>
                  {recentWorkout.musclesTrained}
                  {recentWorkout.durationMinutes !== null
                    ? ` · ${recentWorkout.durationMinutes} min`
                    : ''}
                </Text>

                {recentWorkout.topSet && recentWorkout.topExerciseName ? (
                  <View testID="dashboard-top-set" style={styles.topSetRow}>
                    <Text style={styles.topSetText}>
                      {recentWorkout.topExerciseName}:{' '}
                      <Text style={styles.topSetValue}>
                        {formatWeight(recentWorkout.topSet.weightKg, weightUnit)}
                        {weightUnit}×{recentWorkout.topSet.reps}
                      </Text>
                    </Text>
                    {recentWorkout.prLabel ? <Badge label={recentWorkout.prLabel} /> : null}
                  </View>
                ) : null}

                {insight ? (
                  <Text testID="dashboard-insight" style={styles.insight}>
                    {insight.message}
                  </Text>
                ) : null}
              </AppCard>
            ) : (
              <AppCard
                testID="dashboard-start-first-workout"
                onPress={() => navigation.navigate('NewWorkout')}
              >
                <EmptyState
                  testID="dashboard-recent-workout-empty"
                  icon={<Feather name="activity" size={24} color={colors.textMuted} />}
                  title="Start your first workout"
                />
              </AppCard>
            )}
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
            ) : (
              <AppCard
                testID="dashboard-nutrition"
                onPress={() => navigation.navigate('Nutrition')}
              >
                <View style={styles.ringCardTop}>
                  <CalorieRing percent={caloriePercent} active={nutritionGoals.calories !== null} />
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
                  />
                  <MacroCard
                    testID="dashboard-carbs"
                    label="Carbs"
                    consumed={consumed.carbsG}
                    goal={nutritionGoals.carbsG}
                    unit="g"
                  />
                  <MacroCard
                    testID="dashboard-fat"
                    label="Fat"
                    consumed={consumed.fatG}
                    goal={nutritionGoals.fatG}
                    unit="g"
                  />
                </View>
              </AppCard>
            )}
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
                <Text style={styles.viewAllText}>View All</Text>
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
                    <Text style={styles.listRowValue}>{log.calories} kcal</Text>
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
                  <Feather name="target" size={16} color={colors.accent} />
                  <Text style={styles.cardTitle}>Nutrition Goals</Text>
                </View>
                <View style={styles.goalsTitleRow}>
                  <Text style={styles.viewAllText}>View / Edit</Text>
                  <Feather name="chevron-right" size={16} color={colors.textMuted} />
                </View>
              </View>
              {hasAnyNutritionGoal ? (
                <View style={styles.goalsProgressTrack}>
                  <View style={[styles.goalsProgressFill, { width: `${caloriePercent * 100}%` }]} />
                </View>
              ) : (
                <Text style={styles.noGoalsText}>Set your nutrition goals</Text>
              )}
            </AppCard>
          </View>
        </>
      )}

      <View
        style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8) }]}
        testID="dashboard-bottom-bar"
      >
        <View style={styles.bottomBarItem}>
          <Feather name="home" size={20} color={colors.accent} />
          <Text style={[styles.bottomBarLabel, { color: colors.accent }]}>Home</Text>
        </View>
        <View style={styles.bottomBarItem}>
          <Feather
            name={mode === 'workout' ? 'activity' : 'pie-chart'}
            size={20}
            color={colors.textMuted}
          />
          <Text style={[styles.bottomBarLabel, { color: colors.textMuted }]}>
            {mode === 'workout' ? 'Workouts' : 'Food'}
          </Text>
        </View>
        <View style={styles.bottomBarCenter}>
          <Feather name="plus" size={22} color={colors.onAccent} />
        </View>
        <View style={styles.bottomBarItem}>
          <Feather
            name={mode === 'workout' ? 'trending-up' : 'target'}
            size={20}
            color={colors.textMuted}
          />
          <Text style={[styles.bottomBarLabel, { color: colors.textMuted }]}>
            {mode === 'workout' ? 'Progress' : 'Goals'}
          </Text>
        </View>
        <View style={styles.bottomBarItem}>
          <Feather name="user" size={20} color={colors.textMuted} />
          <Text style={[styles.bottomBarLabel, { color: colors.textMuted }]}>Profile</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}
