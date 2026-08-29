import { useCallback, useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { Badge } from '../design/Badge';
import { PrimaryButton, TextButton } from '../design/Button';
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

type Props = RootStackScreenProps<'Dashboard'>;

const EMPTY_GOALS: NutritionGoals = { calories: null, proteinG: null, carbsG: null, fatG: null };

function formatWeight(kg: number, unit: 'kg' | 'lb'): string {
  const value = roundWeight(fromKg(kg, unit));
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Something went wrong';
}

// The post-sign-in landing screen. Pure aggregation over data Phases 1-6
// already produce -- every section reuses an existing query/derivation
// function, and each section fails independently (Promise.allSettled) so
// one bad network call can't blank out sections that loaded fine. Visual
// presentation only was reworked for the Design & Product Polish phase
// (Concept B -- Dark + Electric); the data/state logic below is unchanged.
export function DashboardScreen({ navigation }: Props) {
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;

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

  const consumed = sumDailyTotals(nutritionLogs);
  const hasAnyNutritionGoal =
    nutritionGoals.calories !== null ||
    nutritionGoals.proteinG !== null ||
    nutritionGoals.carbsG !== null ||
    nutritionGoals.fatG !== null;

  const insight = recentWorkout
    ? compareToPrevious(
        recentWorkout.topExerciseSets,
        recentWorkout.previousExerciseSets,
        (kg) => `${formatWeight(kg, weightUnit)}${weightUnit}`,
      )
    : null;

  return (
    <ScreenContainer testID="dashboard-screen">
      <View style={styles.header}>
        <Text testID="dashboard-greeting" style={styles.greeting}>
          {greeting}
        </Text>
        <TouchableOpacity
          testID="open-account-settings"
          style={styles.settingsButton}
          onPress={() => navigation.navigate('AccountSettings')}
          accessibilityLabel="Settings"
          accessibilityRole="button"
        >
          <Feather name="settings" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {profileError ? (
        <Text testID="dashboard-profile-error" style={styles.errorText}>
          {profileError}
        </Text>
      ) : null}

      <View style={styles.primaryAction}>
        {activeWorkoutError ? (
          <Text testID="dashboard-active-workout-error" style={styles.errorText}>
            {activeWorkoutError}
          </Text>
        ) : activeWorkout ? (
          <PrimaryButton
            testID="dashboard-resume-workout"
            label={`Resume "${activeWorkout.name}"`}
            onPress={() => navigation.navigate('ActiveWorkout', { workoutId: activeWorkout.id })}
          />
        ) : (
          <PrimaryButton
            testID="dashboard-start-workout"
            label="Start Workout"
            onPress={() => navigation.navigate('NewWorkout')}
          />
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader label="Recent Workout" />
        {recentWorkoutError ? (
          <Text testID="dashboard-recent-workout-error" style={styles.errorText}>
            {recentWorkoutError}
          </Text>
        ) : recentWorkout ? (
          <AppCard
            hero
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

      <View style={styles.section}>
        <SectionHeader label="Nutrition Today" />
        {nutritionError ? (
          <Text testID="dashboard-nutrition-error" style={styles.errorText}>
            {nutritionError}
          </Text>
        ) : (
          <AppCard testID="dashboard-nutrition" onPress={() => navigation.navigate('Nutrition')}>
            <Text testID="dashboard-calories" style={styles.calorieText}>
              Calories:{' '}
              <Text style={styles.calorieValue}>
                {consumed.calories}
                {nutritionGoals.calories !== null ? ` / ${nutritionGoals.calories}` : ''}
              </Text>
            </Text>
            <Text testID="dashboard-protein" style={styles.macroText}>
              Protein: {consumed.proteinG}g
              {nutritionGoals.proteinG !== null ? ` / ${nutritionGoals.proteinG}g` : ''}
            </Text>
            <Text testID="dashboard-carbs" style={styles.macroText}>
              Carbs: {consumed.carbsG}g
              {nutritionGoals.carbsG !== null ? ` / ${nutritionGoals.carbsG}g` : ''}
            </Text>
            <Text testID="dashboard-fat" style={styles.macroText}>
              Fat: {consumed.fatG}g
              {nutritionGoals.fatG !== null ? ` / ${nutritionGoals.fatG}g` : ''}
            </Text>
            {!hasAnyNutritionGoal ? (
              <Text testID="dashboard-nutrition-no-goals" style={styles.noGoalsText}>
                Set your nutrition goals
              </Text>
            ) : null}
          </AppCard>
        )}
      </View>

      <View style={styles.footer}>
        <TextButton
          testID="dashboard-view-workouts"
          label="View All Workouts"
          onPress={() => navigation.navigate('WorkoutHistory')}
        />
      </View>
    </ScreenContainer>
  );
}
