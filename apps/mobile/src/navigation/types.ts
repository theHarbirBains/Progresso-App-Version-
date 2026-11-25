import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MontageItem } from '../lib/api';
import type { ProgressSection } from '../progress/progressSections';
import type { SplitMuscleGroup } from '../workouts/splitMuscleGroups';

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
  /** Your profile montage: up to four photos or videos, added, put in order and removed. */
  ProfileMontage: undefined;
  /** One of your montage's photos, moved and zoomed within its panel. */
  ProfileMontageFrame: { item: MontageItem };
  SettingsWorkoutPreferences: undefined;
  /** The person's rep range and the exercises they train outside it. */
  RepRangeExceptions: undefined;
  SettingsNutrition: undefined;
  SettingsNotifications: undefined;
  /** How the app looks on this phone: its theme, and following the seasons. */
  SettingsAppearance: undefined;
  SettingsMembership: undefined;
  SettingsAccountSecurity: undefined;
  SettingsChangePassword: undefined;
  SettingsBlockedPeople: undefined;
  SettingsSupport: undefined;
  /** Feedback & Suggestions: what the person has sent, each with its status, and sending more. */
  Feedback: undefined;
  /** A report can start filled in -- a food's figures, from that food's page. */
  FeedbackForm:
    | {
        category?: 'bug' | 'feature' | 'usability' | 'general';
        title?: string;
        description?: string;
      }
    | undefined;
  FeedbackDetail: { id: string };
  /** The feedback inbox, for support and full admins (the API refuses anyone else). */
  AdminFeedbackInbox: undefined;
  AdminFeedbackReview: { id: string };
  ExerciseLibrary: undefined;
  WorkoutHistory: undefined;
  /** clientId is set when a trainer opens one of a client’s workouts. */
  /**
   * `authorId`: someone else's workout, opened from the Friends feed or their profile -- read
   * through the API, read-only, with its likes and comments.
   */
  WorkoutDetail: {
    workoutId: string;
    clientId?: string;
    clientName?: string;
    authorId?: string;
    /** Opens scrolled to its likes and comments (a feed card's comment bubble). */
    focusComments?: boolean;
  };
  /** clientId is set when a trainer edits one of a client's workouts. */
  EditWorkout: { workoutId: string; clientId?: string; clientName?: string };
  /** `justFinished`: opened as the workout was finished -- a new PR in it is cheered. */
  ShareWorkout: { workoutId: string; justFinished?: boolean };
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
  /** Working out as a group; `invite`, a friend to have chosen already (from their profile). */
  GroupStart: { invite?: string } | undefined;
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
  /** `query` starts the search -- another entry for a food, from its page. */
  FoodSearch: { day?: string; query?: string } | undefined;
  AiFoodSearch: { day?: string } | undefined;
  BarcodeScanner: { day?: string } | undefined;
  /** Logging figures the person knows, without a food behind them. */
  QuickFoodEntry: { day?: string } | undefined;
  NutritionGoals: undefined;
  /** `date` ("YYYY-MM-DD"): opens on that day, from a day in Progress. */
  NutritionHistory: { date?: string } | undefined;
  CalorieEstimation: undefined;
  /** The day's vitamins and minerals (`day` "YYYY-MM-DD", today when absent), from Nutrition. */
  Micronutrients: { day?: string } | undefined;
  /** One nutrient: the day's intake (or the week's average) and what it does. */
  NutrientDetail: { nutrientId: string; day: string; range: 'day' | 'week' };
  /** Progress, on a section (Feed's Daily Steps widget opens Steps); Overview when absent. */
  ProgressOverview: { section?: ProgressSection } | undefined;
  ProgressExerciseDetail: { exerciseId: string; exerciseName: string };
  /** Workout Splits, on its My Splits or Programs tab (My Splits when absent). */
  WorkoutSplits: { tab?: 'splits' | 'programs' } | undefined;
  WorkoutSplitView: { splitId: string };
  /** One split day's planned exercises; `muscleGroups`, the day's, shown at its top. */
  SplitDayPlan: {
    dayId: string;
    dayName: string;
    muscleGroups?: SplitMuscleGroup[];
  };
  WorkoutSplitForm: { splitId?: string; activateOnCreate?: boolean };
  ChooseWorkoutSplit: undefined;
  /** Workout Programs on a page of their own: onboarding's programs sheet (in the app they're
   * Workout Splits' Programs tab). */
  WorkoutPrograms: undefined;
  /** One program, on the variation given (its default when absent) and the tab given. */
  ProgramDetail: {
    programId: string;
    variationId?: string;
    tab?: 'overview' | 'schedule' | 'workouts' | 'guidance';
  };
  /** One day of a program's variation: its exercises, as planned. */
  ProgramDay: { programId: string; variationId: string; dayIndex: number };
  /** A built-in exercise as a program shows it; with the program's place, its sets and reps,
   * alternatives and tips too. */
  ProgramExercise: {
    slug: string;
    programId?: string;
    variationId?: string;
    dayIndex?: number;
    exerciseIndex?: number;
  };
  /** One guidance topic of a program. */
  ProgramGuidance: { programId: string; topic: 'progression' | 'recovery' | 'exerciseSelection' };
  /** A program's variations on one schedule, to choose between. */
  ProgramVariations: { programId: string; variationId: string };
  /** A program used: the split made of it (null in onboarding, where it's made later). */
  ProgramAdded: { programId: string; variationId: string; splitId: string | null };
  Profile: undefined;
  /** Opens on Friends, or on the tab given (a profile's "2 requests" opens Requests). */
  FindPeople: { tab?: 'requests' } | undefined;
  Notifications: undefined;
  /** Someone's profile: who they are, who follows them, and -- following them -- their training. */
  PersonProfile: { userId: string };
  /** One exercise of theirs (or yours): each workout's top set and the records held on it. */
  PersonExercise: { userId: string; exerciseId: string; name?: string };
  /** Your achievements and lifetime rank, from the side menu. */
  Achievements: undefined;
  /** Every rank and division -- yours, or (from a profile) someone else's at `points`. */
  RankProgression: { points?: number; name?: string } | undefined;
  /** Who follows someone, or who they follow. */
  FollowList: { userId: string; which: 'followers' | 'following'; name?: string };
};

export type RootStackScreenProps<Screen extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Screen
>;
