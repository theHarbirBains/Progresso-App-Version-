import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
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
import { workoutStyles as styles } from './workoutStyles';

type Props = RootStackScreenProps<'Dashboard'>;

const EMPTY_GOALS: NutritionGoals = { calories: null, proteinG: null, carbsG: null, fatG: null };

function formatWeight(kg: number, unit: 'kg' | 'lb'): string {
  const value = roundWeight(fromKg(kg, unit));
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Something went wrong';
}

// The new post-sign-in landing screen (replacing AccountSettingsScreen in
// that role). Pure aggregation over data Phases 1-6 already produce --
// every section reuses an existing query/derivation function, and each
// section fails independently (Promise.allSettled) so one bad network call
// can't blank out sections that loaded fine.
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
    return (
      <View style={styles.container}>
        <ActivityIndicator testID="dashboard-loading" size="large" color="#FFFFFF" />
      </View>
    );
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
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text testID="dashboard-greeting" style={styles.title}>
          {greeting}
        </Text>
        <TouchableOpacity
          testID="open-account-settings"
          onPress={() => navigation.navigate('AccountSettings')}
        >
          <Text style={styles.backLink}>Settings</Text>
        </TouchableOpacity>
      </View>

      {profileError ? (
        <Text testID="dashboard-profile-error" style={styles.error}>
          {profileError}
        </Text>
      ) : null}

      {activeWorkoutError ? (
        <Text testID="dashboard-active-workout-error" style={styles.error}>
          {activeWorkoutError}
        </Text>
      ) : activeWorkout ? (
        <TouchableOpacity
          testID="dashboard-resume-workout"
          style={styles.button}
          onPress={() => navigation.navigate('ActiveWorkout', { workoutId: activeWorkout.id })}
        >
          <Text style={styles.buttonText}>Resume &quot;{activeWorkout.name}&quot;</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          testID="dashboard-start-workout"
          style={styles.button}
          onPress={() => navigation.navigate('NewWorkout')}
        >
          <Text style={styles.buttonText}>Start Workout</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.bannerTitle}>Recent Workout</Text>
      {recentWorkoutError ? (
        <Text testID="dashboard-recent-workout-error" style={styles.error}>
          {recentWorkoutError}
        </Text>
      ) : recentWorkout ? (
        <TouchableOpacity
          testID="dashboard-recent-workout"
          style={styles.card}
          onPress={() =>
            navigation.navigate('WorkoutDetail', { workoutId: recentWorkout.workout.id })
          }
        >
          <Text style={styles.cardTitle}>{recentWorkout.workout.name}</Text>
          <Text style={styles.cardMeta}>{recentWorkout.musclesTrained}</Text>
          {recentWorkout.durationMinutes !== null ? (
            <Text style={styles.cardMeta}>{recentWorkout.durationMinutes} min</Text>
          ) : null}
          {recentWorkout.topSet && recentWorkout.topExerciseName ? (
            <Text testID="dashboard-top-set" style={styles.cardMetaHighlight}>
              {recentWorkout.topExerciseName}:{' '}
              {formatWeight(recentWorkout.topSet.weightKg, weightUnit)}
              {weightUnit}×{recentWorkout.topSet.reps}
              {recentWorkout.prLabel ? ` · ${recentWorkout.prLabel}` : ''}
            </Text>
          ) : null}
          {insight ? (
            <Text testID="dashboard-insight" style={styles.cardMeta}>
              {insight.message}
            </Text>
          ) : null}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          testID="dashboard-start-first-workout"
          style={styles.card}
          onPress={() => navigation.navigate('NewWorkout')}
        >
          <Text testID="dashboard-recent-workout-empty" style={styles.emptyText}>
            Start your first workout
          </Text>
        </TouchableOpacity>
      )}

      <Text style={styles.bannerTitle}>Nutrition Today</Text>
      {nutritionError ? (
        <Text testID="dashboard-nutrition-error" style={styles.error}>
          {nutritionError}
        </Text>
      ) : (
        <TouchableOpacity
          testID="dashboard-nutrition"
          style={styles.card}
          onPress={() => navigation.navigate('Nutrition')}
        >
          <Text testID="dashboard-calories" style={styles.cardMetaHighlight}>
            Calories: {consumed.calories}
            {nutritionGoals.calories !== null ? ` / ${nutritionGoals.calories}` : ''}
          </Text>
          <Text testID="dashboard-protein" style={styles.cardMeta}>
            Protein: {consumed.proteinG}g
            {nutritionGoals.proteinG !== null ? ` / ${nutritionGoals.proteinG}g` : ''}
          </Text>
          <Text testID="dashboard-carbs" style={styles.cardMeta}>
            Carbs: {consumed.carbsG}g
            {nutritionGoals.carbsG !== null ? ` / ${nutritionGoals.carbsG}g` : ''}
          </Text>
          <Text testID="dashboard-fat" style={styles.cardMeta}>
            Fat: {consumed.fatG}g{nutritionGoals.fatG !== null ? ` / ${nutritionGoals.fatG}g` : ''}
          </Text>
          {!hasAnyNutritionGoal ? (
            <Text testID="dashboard-nutrition-no-goals" style={styles.cardMeta}>
              Set your nutrition goals
            </Text>
          ) : null}
        </TouchableOpacity>
      )}

      <TouchableOpacity
        testID="dashboard-view-workouts"
        style={styles.secondaryButton}
        onPress={() => navigation.navigate('WorkoutHistory')}
      >
        <Text style={styles.secondaryButtonText}>View All Workouts</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
