import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// The signed-in app's navigation structure. Sign-in/up/forgot-password/reset
// stay on the pre-existing local-mode screen-state pattern (untouched by
// Phase 3) since they're a separate, already-working flow with nothing to
// gain from a stack navigator.
export type RootStackParamList = {
  AccountSettings: undefined;
  ExerciseLibrary: undefined;
  WorkoutHistory: undefined;
  WorkoutDetail: { workoutId: string };
  NewWorkout: undefined;
  ActiveWorkout: { workoutId: string };
};

export type RootStackScreenProps<Screen extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Screen
>;
