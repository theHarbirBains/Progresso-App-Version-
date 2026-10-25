import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// The signed-in app's navigation structure. Sign-in/forgot-password/reset
// (and now onboarding, which ends in account creation -- see
// onboarding/onboardingDraft.ts) stay on the pre-existing local-mode
// screen-state pattern instead, since they're a separate flow with nothing
// to gain from a stack navigator and no signed-in session to navigate yet.
export type RootStackParamList = {
  /** The app's landing screen: a personal activity feed, replacing the old Dashboard + Workout/Nutrition toggle. */
  Feed: undefined;
  /** Settings' own root: a compact list of category rows, each pushing one of the subpages below. */
  AccountSettings: undefined;
  SettingsPersonalInfo: undefined;
  SettingsWorkoutPreferences: undefined;
  /** The person's rep range and the exercises they train outside it. */
  RepRangeExceptions: undefined;
  SettingsNutrition: undefined;
  SettingsNotifications: undefined;
  /** How the app looks on this phone: its theme, and following the seasons. */
  SettingsAppearance: undefined;
  SettingsAccountSecurity: undefined;
  SettingsChangePassword: undefined;
  SettingsBlockedPeople: undefined;
  SettingsSupport: undefined;
  /** Feedback & Suggestions: what the person has sent, each with its status, and sending more. */
  Feedback: undefined;
  FeedbackForm: undefined;
  FeedbackDetail: { id: string };
  /** The feedback inbox, for support and full admins (the API refuses anyone else). */
  AdminFeedbackInbox: undefined;
  AdminFeedbackReview: { id: string };
  ExerciseLibrary: undefined;
  WorkoutHistory: undefined;
  /** clientId is set when a trainer opens one of a client’s workouts. */
  WorkoutDetail: { workoutId: string; clientId?: string; clientName?: string };
  /** clientId is set when a trainer edits one of a client's workouts. */
  EditWorkout: { workoutId: string; clientId?: string; clientName?: string };
  ShareWorkout: { workoutId: string };
  NewWorkout: undefined;
  /**
   * `planned`: just started from a split day's plan, so its blank sets start from last time.
   * `planError`: not all of the plan could be added; said on arrival.
   */
  ActiveWorkout: { workoutId: string; planned?: boolean; planError?: string };
  LogPastWorkout: undefined;
  /** The same screen as LogPastWorkout, for a trainer logging a workout for one client. Saves through the trainer API, never the trainer's own data. */
  TrainerLogWorkout: { clientId: string; clientName?: string };
  /** Trainer mode (workouts only). Trainers manage their clients here. */
  TrainerClients: undefined;
  TrainerClientForm: undefined;
  /** The same form as TrainerClientForm, editing one managed client's details. */
  TrainerEditClient: { clientId: string };
  TrainerClientDetail: { clientId: string; clientName?: string };
  /** A client's rep range and exceptions, set by their trainer. */
  TrainerClientRepRanges: { clientId: string; clientName?: string };
  /** The Trainer Workspace's Activity tab: every client's latest finished workouts, newest first. */
  TrainerActivity: undefined;
  /** The Trainer Workspace's Sessions tab: live sessions to resume, and Start / Log for each client. */
  TrainerSessions: undefined;
  TrainerAccess: undefined;
  /** Group workouts: start one, and see the live ones you are in. */
  Groups: undefined;
  /** One group session: every member's workout, editable by anyone in the group. */
  GroupSession: { groupId: string };
  /** A trainer picks several of their clients to add to the group. */
  /** Working out as a group: pick who is training, the workout, then start. */
  GroupStart: undefined;
  /** A live session a trainer runs for a client, finished by the trainer. */
  /** startedAt is when the session began, so its stats count from then. */
  TrainerLiveWorkout: {
    workoutId: string;
    clientId: string;
    clientName?: string;
    startedAt?: string;
  };
  /** The one-time code a trainer gets for a client they track before that client has an account. */
  TrainerClaimCode: { code: string; clientId: string; clientName?: string };
  /** The client's side: enter the code a trainer gave them to move their tracked history onto their account. */
  TrainerClaim: undefined;
  PRHistory: { exerciseId: string; exerciseName: string };
  ExerciseProgress: { exerciseId: string; exerciseName: string };
  /** The day to show ("YYYY-MM-DD"); today when absent. */
  Nutrition: { day?: string } | undefined;
  /** `openCreate`/`barcode`: set by the Scan Barcode "Product not found" fallback so Food Library opens straight into creating a custom food, prefilled with the scanned barcode -- see BarcodeScannerScreen. */
  /** `day` (here and in the other ways to log) logs to that past day; today when absent. */
  FoodLibrary: { openCreate?: boolean; barcode?: string; day?: string } | undefined;
  FoodSearch: { day?: string } | undefined;
  AiFoodSearch: { day?: string } | undefined;
  BarcodeScanner: { day?: string } | undefined;
  /** Logging figures the person knows, without a food behind them. */
  QuickFoodEntry: { day?: string } | undefined;
  NutritionGoals: undefined;
  /** `date` ("YYYY-MM-DD"): opens on that day, from a day in Progress. */
  NutritionHistory: { date?: string } | undefined;
  CalorieEstimation: undefined;
  ProgressOverview: undefined;
  ProgressExerciseDetail: { exerciseId: string; exerciseName: string };
  WorkoutSplits: undefined;
  WorkoutSplitView: { splitId: string };
  /** One split day's planned exercises. */
  SplitDayPlan: { dayId: string; dayName: string };
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
