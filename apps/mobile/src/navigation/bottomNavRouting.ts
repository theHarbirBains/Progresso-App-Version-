import type { BottomNavDestination } from '../design/BottomNavBar';
import type { RootStackParamList } from './types';

/**
 * Which of the persistent bottom nav's four tabs a given route belongs to --
 * so a secondary/nested screen (e.g. ActiveWorkout, AccountSettings) keeps
 * its parent section's tab highlighted instead of showing no selection.
 * Dashboard and Onboarding are deliberately absent: Dashboard renders its
 * own bottom bar (see DESIGN.md §11 -- it crossfades between the Workout/
 * Nutrition accent, which this static global bar doesn't need to do), and
 * Onboarding never shows the bottom nav at all. Nutrition/FoodLibrary/
 * NutritionGoals have no tab of their own in this 4-item bar (Home |
 * Workouts | + | Progress | Profile) -- Home is the closest parent, since
 * Dashboard's own nutrition mode is how they're reached.
 */
const ROUTE_TABS: Partial<Record<keyof RootStackParamList, BottomNavDestination>> = {
  AccountSettings: 'profile',
  ExerciseLibrary: 'workouts',
  WorkoutHistory: 'workouts',
  WorkoutDetail: 'workouts',
  ShareWorkout: 'workouts',
  NewWorkout: 'workouts',
  ActiveWorkout: 'workouts',
  PRHistory: 'progress',
  ExerciseProgress: 'progress',
  Nutrition: 'home',
  FoodLibrary: 'home',
  NutritionGoals: 'home',
  WorkoutColorSettings: 'profile',
  NutritionColorSettings: 'profile',
  BackgroundThemeSettings: 'profile',
  ProgressOverview: 'progress',
  ProgressExerciseDetail: 'progress',
  WorkoutSplits: 'workouts',
  WorkoutSplitView: 'workouts',
  WorkoutSplitForm: 'workouts',
  ChooseWorkoutSplit: 'workouts',
  Profile: 'profile',
};

export function routeToBottomNavTab(routeName: string | undefined): BottomNavDestination {
  if (routeName && routeName in ROUTE_TABS) {
    return ROUTE_TABS[routeName as keyof RootStackParamList]!;
  }
  return 'home';
}
