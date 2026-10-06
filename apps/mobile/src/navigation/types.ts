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
  EditWorkout: { workoutId: string };
  ShareWorkout: { workoutId: string };
  NewWorkout: undefined;
  ActiveWorkout: { workoutId: string };
  LogPastWorkout: undefined;
  /** The same screen as LogPastWorkout, for a trainer logging a workout for one client. Saves through the trainer API, never the trainer's own data. */
  TrainerLogWorkout: { clientId: string; clientName?: string };
  /** Trainer mode (workouts only). Trainers manage their clients here. */
  TrainerClients: undefined;
  TrainerClientForm: undefined;
  /** The same form as TrainerClientForm, editing one managed client's details. */
  TrainerEditClient: { clientId: string };
  TrainerClientDetail: { clientId: string; clientName?: string };
  TrainerAccess: undefined;
  PRHistory: { exerciseId: string; exerciseName: string };
  ExerciseProgress: { exerciseId: string; exerciseName: string };
  Nutrition: undefined;
  /** `openCreate`/`barcode`: set by the Scan Barcode "Product not found" fallback so Food Library opens straight into creating a custom food, prefilled with the scanned barcode -- see BarcodeScannerScreen. */
  FoodLibrary: { openCreate?: boolean; barcode?: string } | undefined;
  FoodSearch: undefined;
  AiFoodSearch: undefined;
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
  FindPeople: undefined;
  Notifications: undefined;
};

export type RootStackScreenProps<Screen extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Screen
>;
