import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// The signed-in app's navigation structure. Sign-in/up/forgot-password/reset
// stay on the pre-existing local-mode screen-state pattern (untouched by
// Phase 3) since they're a separate, already-working flow with nothing to
// gain from a stack navigator.
export type RootStackParamList = {
  Dashboard: undefined;
  Onboarding: undefined;
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
  FoodLibrary: undefined;
  NutritionGoals: undefined;
  WorkoutColorSettings: undefined;
  NutritionColorSettings: undefined;
  ProgressOverview: undefined;
  ProgressExerciseDetail: { exerciseId: string; exerciseName: string };
  WorkoutSplits: undefined;
  WorkoutSplitView: { splitId: string };
  WorkoutSplitForm: { splitId?: string; activateOnCreate?: boolean };
  ChooseWorkoutSplit: undefined;
  Social: undefined;
};

export type RootStackScreenProps<Screen extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Screen
>;
