import type { BottomNavDestination } from '../design/BottomNavBar';
import type { RootStackParamList } from './types';

/**
 * Which of the persistent bottom nav's five tabs a given route belongs to --
 * so a secondary/nested screen (e.g. ActiveWorkout, AccountSettings) keeps
 * its parent section's tab highlighted instead of showing no selection.
 * Feed is the landing screen and the fallback for anything unlisted.
 * Onboarding is deliberately absent: it never shows the bottom nav at all
 * (see App.tsx).
 */
const ROUTE_TABS: Partial<Record<keyof RootStackParamList, BottomNavDestination>> = {
  Feed: 'feed',
  ExerciseLibrary: 'train',
  WorkoutHistory: 'train',
  WorkoutDetail: 'train',
  ShareWorkout: 'train',
  NewWorkout: 'train',
  ActiveWorkout: 'train',
  WorkoutSplits: 'train',
  WorkoutSplitView: 'train',
  WorkoutSplitForm: 'train',
  ChooseWorkoutSplit: 'train',
  Nutrition: 'nutrition',
  FoodLibrary: 'nutrition',
  FoodSearch: 'nutrition',
  BarcodeScanner: 'nutrition',
  NutritionGoals: 'nutrition',
  CalorieEstimation: 'nutrition',
  PRHistory: 'progress',
  ExerciseProgress: 'progress',
  ProgressOverview: 'progress',
  ProgressExerciseDetail: 'progress',
  AccountSettings: 'you',
  WorkoutColorSettings: 'you',
  NutritionColorSettings: 'you',
  BackgroundThemeSettings: 'you',
  Profile: 'you',
};

export function routeToBottomNavTab(routeName: string | undefined): BottomNavDestination {
  if (routeName && routeName in ROUTE_TABS) {
    return ROUTE_TABS[routeName as keyof RootStackParamList]!;
  }
  return 'feed';
}
