import { Alert } from 'react-native';
import {
  claimTrainerHistory,
  registerPushToken,
  updateMyProfile,
  type ActivityLevel,
  type AverageWorkoutLength,
  type FitnessGoal,
  type Gender,
  type HeightUnit,
  type MembershipTier,
  type ProfileResponse,
  type ReferralSource,
  type TrainingComfort,
  type UpdateProfileInput,
} from '../lib/api';
import { requestPushToken } from '../lib/pushNotifications';
import { includesNutrition } from '../membership/membershipTiers';
import { ageFromBirthday } from '../nutrition/calorieEstimationInput';
import { saveNutritionGoals } from '../nutrition/nutritionGoalQueries';
import type { TargetValues } from '../nutrition/targetMath';
import { openCustomSplitBuilderSoon } from './customSplitAfterSignUp';
import { toDateStringUTC } from './dateWheelValues';
import { materializeWorkoutSplitPreset } from '../workouts/workoutSplitQueries';
import { WORKOUT_SPLIT_PRESETS } from '../workouts/workoutSplitPresets';
import { defaultRepRange } from '../workouts/progression';

/**
 * Everything onboarding collects, held entirely in local/draft state --
 * account creation is the LAST step now (see CreateAccountStep), so there
 * is no signed-in profile to save each answer against as the user goes
 * (that's the old, pre-restructure model). Nothing here touches the
 * network until submitOnboardingDraft runs, once, right after the account
 * is created.
 */
export interface OnboardingDraft {
  referralSource: ReferralSource | null;
  /** ISO 3166-1 alpha-2. */
  country: string | null;
  gender: Gender | null;
  birthday: string | null;
  weightValue: number | null;
  weightUnit: 'kg' | 'lb';
  heightValue: number | null;
  heightUnit: HeightUnit;
  /** Up to MAX_FITNESS_GOALS, in the order picked. */
  fitnessGoals: FitnessGoal[];
  /** Which parts of the app they'll use (membership/membershipTiers.ts). */
  membershipTier: MembershipTier | null;
  /** How active they are -- for the calorie estimate, with Nutrition in the membership. */
  activityLevel: ActivityLevel | null;
  /** The daily targets they chose to use (with Nutrition in the membership), saved as their
   * nutrition goals once the account exists; null until chosen, or when skipped. */
  nutritionTargets: TargetValues | null;
  skippedNutritionTargets: boolean;
  /** Went past How ranks work. */
  ranksSeen: boolean;
  /** Answered the Apple Health question: true if they asked to connect, false for Not Now. Kept
   * only here -- Apple Health itself remembers what they allowed. */
  appleHealthAsked: boolean | null;
  /** Also sets the starting rep range: see defaultRepRange. */
  trainingComfort: TrainingComfort | null;
  workoutFrequencyDays: number | null;
  averageWorkoutLength: AverageWorkoutLength | null;
  /** A WORKOUT_SPLIT_PRESETS id -- not yet materialized into a real,
   * user-owned split row (that needs a real user id, so it only happens
   * inside submitOnboardingDraft, after the account exists). */
  selectedSplitPresetId: string | null;
  /** Set when the user picks "Build My Own Split" instead of a preset --
   * building a real custom split (naming days, adding exercises) needs a
   * real account the same way materializing a preset does, so this only
   * records the intent. submitOnboardingDraft then has the split builder
   * open as the app first shows (customSplitAfterSignUp.ts); until a split
   * is saved the new profile has no active split, the same already-supported
   * state NewWorkoutScreen's own "no active split" gate handles. */
  wantsCustomSplit: boolean;
  /** Skipped choosing a split for now: like Create Your Own, the account starts with no split --
   * Start Workout asks for one the first time it's needed. */
  skippedSplit: boolean;
  emailOptIn: boolean | null;
  pushNotificationsOptIn: boolean | null;
  /** Whether a trainer has been logging their workouts: true with the code the trainer gave
   * them, which claims that history once the account exists; false if not. */
  hasTrainerCode: boolean | null;
  trainerCode: string | null;
  /** Set by CreateAccountStep's own form, right as it submits -- kept here
   * (not just local component state) so they survive the one gap this
   * whole draft exists for: a project that requires email confirmation, so
   * the account exists but submitOnboardingDraft can't run until a real
   * session shows up later (see App.tsx's Root and this file's own
   * submitOnboardingDraft comment). */
  pendingUsername: string | null;
  pendingDisplayName: string | null;
  pendingLastName: string | null;
  /** E.164. */
  pendingPhoneNumber: string | null;
}

// Height and birthday are wheel pickers -- they always show *some* value
// (there's no empty state for a wheel), so their draft fields start
// pre-filled with that same displayed default rather than null, the same
// way the old profile-backed onboarding's local wheel state always had a
// real starting value ready to save even before the user touched it.
// Matches HeightWheelPicker's own fallback default. Weight is typed into a
// box (WeightField), so it starts empty: the step waits for a real weight.
const DEFAULT_BIRTH_YEAR = new Date().getFullYear() - 25;

export const EMPTY_DRAFT: OnboardingDraft = {
  referralSource: null,
  country: null,
  gender: null,
  birthday: toDateStringUTC(0, 1, DEFAULT_BIRTH_YEAR),
  weightValue: null,
  weightUnit: 'lb',
  heightValue: 170,
  heightUnit: 'cm',
  fitnessGoals: [],
  membershipTier: null,
  activityLevel: null,
  nutritionTargets: null,
  skippedNutritionTargets: false,
  ranksSeen: false,
  appleHealthAsked: null,
  trainingComfort: null,
  workoutFrequencyDays: null,
  averageWorkoutLength: null,
  selectedSplitPresetId: null,
  wantsCustomSplit: false,
  skippedSplit: false,
  emailOptIn: null,
  pushNotificationsOptIn: null,
  hasTrainerCode: null,
  trainerCode: null,
  pendingUsername: null,
  pendingDisplayName: null,
  pendingLastName: null,
  pendingPhoneNumber: null,
};

// No separate terminal "completion" step: the instant createAccount
// succeeds, the app's own auth state flips to signed-in (see AuthProvider)
// and App.tsx's Root swaps this whole pre-auth flow for the real,
// signed-in app -- so a local completion screen rendered by this same
// component would never actually be reachable. createAccount is the last
// step there is.
export const STEP_ORDER = [
  'referralSource',
  'country',
  'gender',
  'birthday',
  'weight',
  'height',
  'fitnessGoal',
  'trainingComfort',
  'workoutFrequency',
  'averageWorkoutLength',
  'membership',
  // With Nutrition in the membership: how active they are, then their daily targets.
  'activityLevel',
  'nutritionTargets',
  'workoutSplit',
  'ranks',
  'emailPreference',
  'pushNotifications',
  // Where Apple Health is there to ask.
  'appleHealth',
  'trainerCode',
  'createAccount',
] as const;

/**
 * The parts onboarding is grouped into, each named, so every step says where it is ("About You
 * · 2 of 6") and the progress bar has a part for each instead of a dash per question. Every step
 * of STEP_ORDER is in exactly one, in the same order.
 */
export const STEP_SECTIONS: readonly { title: string; steps: readonly OnboardingStep[] }[] = [
  {
    title: 'About You',
    steps: ['referralSource', 'country', 'gender', 'birthday', 'weight', 'height'],
  },
  {
    title: 'Your Training',
    steps: ['fitnessGoal', 'trainingComfort', 'workoutFrequency', 'averageWorkoutLength'],
  },
  {
    title: 'Your Plan',
    steps: ['membership', 'activityLevel', 'nutritionTargets', 'workoutSplit', 'ranks'],
  },
  { title: 'Staying in Touch', steps: ['emailPreference', 'pushNotifications', 'appleHealth'] },
  { title: 'Your Account', steps: ['trainerCode', 'createAccount'] },
];

/** Where a step sits: its part, its place in that part, and how far through each part it is. */
export interface StepPlace {
  section: string;
  /** 1-based, among the steps of its part that are asked. */
  stepInSection: number;
  stepsInSection: number;
  /** One per part with a step asked: how many it asks, and how many are done or showing. */
  progress: { steps: number; done: number }[];
}

/** Where `step` sits among the steps asked, by part. */
export function stepPlace(step: OnboardingStep, asked: readonly OnboardingStep[]): StepPlace {
  const askedSet = new Set(asked);
  const parts = STEP_SECTIONS.map((part) => ({
    title: part.title,
    steps: part.steps.filter((s) => askedSet.has(s)),
  })).filter((part) => part.steps.length > 0);
  const current = parts.findIndex((part) => part.steps.includes(step));
  const here = parts[Math.max(0, current)]!;
  return {
    section: here.title,
    stepInSection: here.steps.indexOf(step) + 1,
    stepsInSection: here.steps.length,
    progress: parts.map((part, index) => ({
      steps: part.steps.length,
      done:
        index < current ? part.steps.length : index === current ? part.steps.indexOf(step) + 1 : 0,
    })),
  };
}

/** Progresso is for people this old and up (the Privacy Policy says so). */
export const MIN_SIGNUP_AGE = 13;

/** Whether someone with this birthday is old enough for Progresso. */
export function isOldEnough(birthday: string | null, now: Date = new Date()): boolean {
  if (!birthday) return false;
  const age = ageFromBirthday(birthday, now);
  return age !== null && age >= MIN_SIGNUP_AGE;
}

/** What the phone can do, for the steps that depend on it. */
export interface StepContext {
  /** Apple Health is on this phone, in this copy of the app. */
  healthAvailable: boolean;
}

/** Whether a step is asked at all: Nutrition's only with it in the membership, Apple Health's
 * only where it's there to ask. */
export function stepApplies(
  step: OnboardingStep,
  draft: OnboardingDraft,
  context: StepContext,
): boolean {
  switch (step) {
    case 'activityLevel':
    case 'nutritionTargets':
      return draft.membershipTier !== null && includesNutrition(draft.membershipTier);
    case 'appleHealth':
      return context.healthAvailable;
    default:
      return true;
  }
}

/** The steps asked, in order. */
export function stepsAsked(draft: OnboardingDraft, context: StepContext): OnboardingStep[] {
  return STEP_ORDER.filter((step) => stepApplies(step, draft, context));
}

/** The step to go to from `from`, a way: the nearest one asked, or `from` itself at either end. */
export function nextStepIndex(
  from: number,
  direction: 1 | -1,
  draft: OnboardingDraft,
  context: StepContext,
): number {
  for (let index = from + direction; index >= 0 && index < STEP_ORDER.length; index += direction) {
    if (stepApplies(STEP_ORDER[index], draft, context)) return index;
  }
  return from;
}

/** A trainer's claim code as the API takes it: 8 to 12 letters and numbers, dashes and spaces allowed. */
const TRAINER_CODE_PATTERN = /^[A-Za-z0-9 -]{8,12}$/;

/** The most fitness goals a person picks -- enough to say what matters, few enough to mean it. */
export const MAX_FITNESS_GOALS = 3;

export type OnboardingStep = (typeof STEP_ORDER)[number];

/** Whether the draft already carries an answer for this step -- used to
 * resume a local, in-progress draft (see onboardingDraftStorage) at the
 * right place, the same way the old profile-backed resumability worked. */
export function isStepAnswered(step: OnboardingStep, draft: OnboardingDraft): boolean {
  switch (step) {
    case 'referralSource':
      return draft.referralSource != null;
    case 'country':
      return draft.country != null;
    case 'gender':
      return draft.gender != null;
    case 'birthday':
      return isOldEnough(draft.birthday);
    case 'weight':
      return draft.weightValue != null;
    case 'height':
      return draft.heightValue != null;
    case 'fitnessGoal':
      return draft.fitnessGoals.length > 0;
    case 'membership':
      return draft.membershipTier != null;
    case 'activityLevel':
      return draft.activityLevel != null;
    case 'nutritionTargets':
      return draft.nutritionTargets != null || draft.skippedNutritionTargets;
    case 'ranks':
      return draft.ranksSeen;
    case 'appleHealth':
      return draft.appleHealthAsked != null;
    case 'trainingComfort':
      return draft.trainingComfort != null;
    case 'workoutFrequency':
      return draft.workoutFrequencyDays != null;
    case 'averageWorkoutLength':
      return draft.averageWorkoutLength != null;
    case 'workoutSplit':
      return draft.selectedSplitPresetId != null || draft.wantsCustomSplit || draft.skippedSplit;
    case 'emailPreference':
      return draft.emailOptIn != null;
    case 'pushNotifications':
      return draft.pushNotificationsOptIn != null;
    case 'trainerCode':
      return (
        draft.hasTrainerCode === false ||
        (draft.hasTrainerCode === true && TRAINER_CODE_PATTERN.test(draft.trainerCode ?? ''))
      );
    case 'createAccount':
      return false;
  }
}

/** The first unanswered step asked -- always createAccount once every real
 * question is done, since it's never itself "answered" (it's a terminal
 * action, not a stored field). */
export function computeStartStepIndex(
  draft: OnboardingDraft,
  context: StepContext = { healthAvailable: false },
): number {
  const index = STEP_ORDER.findIndex(
    (step) => stepApplies(step, draft, context) && !isStepAnswered(step, draft),
  );
  return index === -1 ? STEP_ORDER.length - 1 : index;
}

function draftToProfileInput(draft: OnboardingDraft): UpdateProfileInput {
  const input: UpdateProfileInput = {};
  if (draft.referralSource != null) input.referralSource = draft.referralSource;
  if (draft.country != null) input.country = draft.country;
  if (draft.gender != null) input.gender = draft.gender;
  if (draft.birthday != null) input.birthday = draft.birthday;
  if (draft.weightValue != null) input.weightValue = draft.weightValue;
  input.weightUnit = draft.weightUnit;
  if (draft.heightValue != null) input.heightValue = draft.heightValue;
  input.heightUnit = draft.heightUnit;
  if (draft.fitnessGoals.length > 0) input.fitnessGoals = draft.fitnessGoals;
  if (draft.membershipTier != null) input.membershipTier = draft.membershipTier;
  if (draft.activityLevel != null) input.activityLevel = draft.activityLevel;
  if (draft.trainingComfort != null) {
    input.trainingComfort = draft.trainingComfort;
    const range = defaultRepRange(draft.trainingComfort);
    input.repRangeMin = range.min;
    input.repRangeMax = range.max;
  }
  if (draft.workoutFrequencyDays != null) input.workoutFrequencyDays = draft.workoutFrequencyDays;
  if (draft.averageWorkoutLength != null) input.averageWorkoutLength = draft.averageWorkoutLength;
  if (draft.emailOptIn != null) input.emailOptIn = draft.emailOptIn;
  if (draft.pushNotificationsOptIn != null) {
    input.pushNotificationsOptIn = draft.pushNotificationsOptIn;
  }
  if (draft.pendingUsername != null) input.username = draft.pendingUsername;
  if (draft.pendingDisplayName != null) input.displayName = draft.pendingDisplayName;
  if (draft.pendingLastName != null) input.lastName = draft.pendingLastName;
  if (draft.pendingPhoneNumber != null) input.phoneNumber = draft.pendingPhoneNumber;
  return input;
}

/**
 * Turns a finished local draft into the real, persisted profile -- the one
 * point where onboarding actually touches the network (plus whatever
 * signUpWithPassword itself just did to create the account). Materializes
 * the chosen split preset into a real, user-owned split first (it needs a
 * real userId, which only exists from this point on), then a single
 * profile PATCH with every other answer plus onboardingCompleted: true.
 *
 * Also the reconciliation path for the one edge case where account
 * creation and draft submission can't happen in the same instant: a
 * project that requires email confirmation returns no session, so this
 * can't run yet at signup time. App.tsx's Root calls this again once such
 * a session actually appears (a pending local draft still on disk, profile
 * not yet onboardingCompleted) -- same function, same result either way.
 *
 * When notifications were allowed during onboarding, this device's push
 * token is registered here too: it needs the account that only now exists.
 */
export async function submitOnboardingDraft(
  accessToken: string,
  userId: string,
  draft: OnboardingDraft,
): Promise<ProfileResponse> {
  const input = draftToProfileInput(draft);

  if (draft.selectedSplitPresetId) {
    const preset = WORKOUT_SPLIT_PRESETS.find((p) => p.id === draft.selectedSplitPresetId);
    if (preset) {
      const split = await materializeWorkoutSplitPreset(userId, preset);
      input.activeWorkoutSplitId = split.id;
    }
  }

  input.onboardingCompleted = true;
  const profile = await updateMyProfile(accessToken, input);
  if (
    draft.nutritionTargets &&
    draft.membershipTier !== null &&
    includesNutrition(draft.membershipTier)
  ) {
    await saveTargets(userId, draft.nutritionTargets);
  }
  if (draft.pushNotificationsOptIn) await registerThisDevice(accessToken);
  if (draft.hasTrainerCode && draft.trainerCode)
    await claimTrainerCode(accessToken, draft.trainerCode);
  // Build My Own Split: the builder opens as the app does (customSplitAfterSignUp.ts).
  if (draft.wantsCustomSplit && !draft.selectedSplitPresetId) openCustomSplitBuilderSoon();
  return profile;
}

/**
 * The history a trainer logged, claimed with the code they gave -- it becomes the person's own,
 * and the trainer keeps seeing it. A code that doesn't work never fails sign-up, which has
 * already been saved: the person is told why, and where to try it again.
 */
async function claimTrainerCode(accessToken: string, code: string): Promise<void> {
  try {
    await claimTrainerHistory(accessToken, code);
  } catch (error) {
    Alert.alert(
      "Your trainer's code didn't work",
      `${error instanceof Error ? error.message : String(error)}\n\nYou can enter it again in Settings > Trainer Code.`,
    );
  }
}

/** The daily targets they chose, as their nutrition goals. A failure never fails sign-up, which has
 * already been saved: they're told, and can set them in Nutrition Goals. */
async function saveTargets(userId: string, targets: TargetValues): Promise<void> {
  try {
    await saveNutritionGoals(userId, targets);
  } catch {
    Alert.alert(
      "Your daily targets didn't save",
      'You can set them any time in Settings > Nutrition & Goals.',
    );
  }
}

async function registerThisDevice(accessToken: string): Promise<void> {
  try {
    // Permission was granted at the notifications step, so iOS doesn't prompt again here.
    const token = await requestPushToken();
    if (token) await registerPushToken(accessToken, token, 'ios');
  } catch {
    // Best effort: a failed registration must not fail onboarding, which has already been saved.
  }
}
