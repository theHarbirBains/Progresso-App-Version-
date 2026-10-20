import type { BottomNavDestination } from '../design/BottomNavBar';
import type { RootStackParamList } from './types';

/**
 * Which of the persistent bottom nav's tabs a given route belongs to -- the
 * five personal ones, or the Trainer Workspace's three --
 * so a secondary/nested screen (e.g. ActiveWorkout, AccountSettings) keeps
 * its parent section's tab highlighted instead of showing no selection.
 * Feed is the landing screen and the fallback for anything unlisted.
 * Onboarding is deliberately absent: it never shows the bottom nav at all
 * (see App.tsx).
 */
const ROUTE_TABS: Partial<Record<keyof RootStackParamList, BottomNavDestination | null>> = {
  Feed: 'feed',
  ExerciseLibrary: 'train',
  WorkoutHistory: 'train',
  WorkoutDetail: 'train',
  ShareWorkout: 'train',
  NewWorkout: 'train',
  LogPastWorkout: 'train',
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
  Phases: 'nutrition',
  PhaseForm: 'nutrition',
  CalorieEstimation: 'nutrition',
  PRHistory: 'progress',
  ExerciseProgress: 'progress',
  ProgressOverview: 'progress',
  ProgressExerciseDetail: 'progress',
  AccountSettings: 'you',
  SettingsPersonalInfo: 'you',
  SettingsWorkoutPreferences: 'you',
  SettingsNutrition: 'you',
  SettingsNotifications: 'you',
  SettingsAccountSecurity: 'you',
  SettingsChangePassword: 'you',
  SettingsBlockedPeople: 'you',
  SettingsSupport: 'you',
  Profile: 'you',
  // The Trainer Workspace's pages, under its own three tabs.
  TrainerClients: 'clients',
  TrainerClientDetail: 'clients',
  TrainerClientForm: 'clients',
  TrainerEditClient: 'clients',
  TrainerClaimCode: 'clients',
  TrainerActivity: 'activity',
  TrainerSessions: 'sessions',
  TrainerLogWorkout: 'sessions',
  TrainerLiveWorkout: 'sessions',
};

export function routeToBottomNavTab(routeName: string | undefined): BottomNavDestination | null {
  if (routeName && routeName in ROUTE_TABS) {
    return ROUTE_TABS[routeName as keyof RootStackParamList] ?? null;
  }
  return 'feed';
}
