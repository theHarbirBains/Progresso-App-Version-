import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// The signed-in app's navigation structure. Sign-in/forgot-password/reset
// (and now onboarding, which ends in account creation -- see
// onboarding/onboardingDraft.ts) stay on the pre-existing local-mode
// screen-state pattern instead, since they're a separate flow with nothing
// to gain from a stack navigator and no signed-in session to navigate yet.
export type RootStackParamList = {
  /** The app's landing screen: a personal activity feed, replacing the old Dashboard + Workout/Nutrition toggle. */
  Feed: undefined;
  AccountSettings: undefined;
  ExerciseLibrary: undefined;
  WorkoutHistory: undefined;
  WorkoutDetail: { workoutId: string };
  ShareWorkout: { workoutId: string };
  NewWorkout: undefined;
  ActiveWorkout: { workoutId: string };
  PRHistory: { exerciseId: string; exerciseName: string };
  ExerciseProgress: { exerciseId: string; exerciseName: string };
  Nutrition: undefined;
  /** `openCreate`/`barcode`: set by the Scan Barcode "Product not found" fallback so Food Library opens straight into creating a custom food, prefilled with the scanned barcode -- see BarcodeScannerScreen. */
  FoodLibrary: { openCreate?: boolean; barcode?: string } | undefined;
  FoodSearch: undefined;
  BarcodeScanner: undefined;
  NutritionGoals: undefined;
  NutritionHistory: undefined;
  CalorieEstimation: undefined;
  WorkoutColorSettings: undefined;
  NutritionColorSettings: undefined;
  BackgroundThemeSettings: undefined;
  ProgressOverview: undefined;
  ProgressExerciseDetail: { exerciseId: string; exerciseName: string };
  WorkoutSplits: undefined;
  WorkoutSplitView: { splitId: string };
  WorkoutSplitForm: { splitId?: string; activateOnCreate?: boolean };
  ChooseWorkoutSplit: undefined;
  Profile: undefined;
};

export type RootStackScreenProps<Screen extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Screen
>;
