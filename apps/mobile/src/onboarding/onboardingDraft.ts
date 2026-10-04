import {
  updateMyProfile,
  type AppleHealthPreference,
  type AverageWorkoutLength,
  type FitnessGoal,
  type Gender,
  type HeightUnit,
  type ProfileResponse,
  type ReferralSource,
  type TrainingExperience,
  type TrainingStylePreference,
  type UpdateProfileInput,
} from '../lib/api';
import { toDateStringUTC } from './dateWheelValues';
import { materializeWorkoutSplitPreset } from '../workouts/workoutSplitQueries';
import { WORKOUT_SPLIT_PRESETS } from '../workouts/workoutSplitPresets';

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
  fitnessGoal: FitnessGoal | null;
  trainingExperience: TrainingExperience | null;
  workoutFrequencyDays: number | null;
  averageWorkoutLength: AverageWorkoutLength | null;
  trainingStylePreference: TrainingStylePreference | null;
  /** A WORKOUT_SPLIT_PRESETS id -- not yet materialized into a real,
   * user-owned split row (that needs a real user id, so it only happens
   * inside submitOnboardingDraft, after the account exists). */
  selectedSplitPresetId: string | null;
  /** Set when the user picks "Create Your Own" instead of a preset --
   * building a real custom split (naming days, adding exercises) needs a
   * real account the same way materializing a preset does, so this only
   * records the intent. submitOnboardingDraft does nothing with it: with no
   * selectedSplitPresetId, the new profile simply has no active split yet,
   * the same already-supported state NewWorkoutScreen's own "no active
   * split" gate sends a user to ChooseWorkoutSplitScreen's real, working
   * "Create Custom Split" from -- no separate post-signup routing needed. */
  wantsCustomSplit: boolean;
  appleHealthPreference: AppleHealthPreference | null;
  emailOptIn: boolean | null;
  pushNotificationsOptIn: boolean | null;
  /** Set by CreateAccountStep's own form, right as it submits -- kept here
   * (not just local component state) so they survive the one gap this
   * whole draft exists for: a project that requires email confirmation, so
   * the account exists but submitOnboardingDraft can't run until a real
   * session shows up later (see App.tsx's Root and this file's own
   * submitOnboardingDraft comment). */
  pendingUsername: string | null;
  pendingDisplayName: string | null;
}

// Weight/height/birthday are wheel pickers -- they always show *some*
// value (there's no empty state for a wheel), so their draft fields start
// pre-filled with that same displayed default rather than null, the same
// way the old profile-backed onboarding's local wheel state always had a
// real starting value ready to save even before the user touched it.
// Matches WeightWheelPicker/HeightWheelPicker's own fallback defaults.
const DEFAULT_BIRTH_YEAR = new Date().getFullYear() - 25;

export const EMPTY_DRAFT: OnboardingDraft = {
  referralSource: null,
  country: null,
  gender: null,
  birthday: toDateStringUTC(0, 1, DEFAULT_BIRTH_YEAR),
  weightValue: 70,
  weightUnit: 'lb',
  heightValue: 170,
  heightUnit: 'cm',
  fitnessGoal: null,
  trainingExperience: null,
  workoutFrequencyDays: null,
  averageWorkoutLength: null,
  trainingStylePreference: null,
  selectedSplitPresetId: null,
  wantsCustomSplit: false,
  appleHealthPreference: null,
  emailOptIn: null,
  pushNotificationsOptIn: null,
  pendingUsername: null,
  pendingDisplayName: null,
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
  'trainingExperience',
  'workoutFrequency',
  'averageWorkoutLength',
  'trainingStyle',
  'workoutSplit',
  'appleHealth',
  'emailPreference',
  'pushNotifications',
  'createAccount',
] as const;

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
      return draft.birthday != null;
    case 'weight':
      return draft.weightValue != null;
    case 'height':
      return draft.heightValue != null;
    case 'fitnessGoal':
      return draft.fitnessGoal != null;
    case 'trainingExperience':
      return draft.trainingExperience != null;
    case 'workoutFrequency':
      return draft.workoutFrequencyDays != null;
    case 'averageWorkoutLength':
      return draft.averageWorkoutLength != null;
    case 'trainingStyle':
      return draft.trainingStylePreference != null;
    case 'workoutSplit':
      return draft.selectedSplitPresetId != null || draft.wantsCustomSplit;
    case 'appleHealth':
      return draft.appleHealthPreference != null;
    case 'emailPreference':
      return draft.emailOptIn != null;
    case 'pushNotifications':
      return draft.pushNotificationsOptIn != null;
    case 'createAccount':
      return false;
  }
}

/** The first unanswered step -- always createAccount once every real
 * question is done, since it's never itself "answered" (it's a terminal
 * action, not a stored field). */
export function computeStartStepIndex(draft: OnboardingDraft): number {
  const index = STEP_ORDER.findIndex((step) => !isStepAnswered(step, draft));
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
  if (draft.fitnessGoal != null) input.fitnessGoal = draft.fitnessGoal;
  if (draft.trainingExperience != null) input.trainingExperience = draft.trainingExperience;
  if (draft.workoutFrequencyDays != null) input.workoutFrequencyDays = draft.workoutFrequencyDays;
  if (draft.averageWorkoutLength != null) input.averageWorkoutLength = draft.averageWorkoutLength;
  if (draft.trainingStylePreference != null) {
    input.trainingStylePreference = draft.trainingStylePreference;
  }
  if (draft.appleHealthPreference != null)
    input.appleHealthPreference = draft.appleHealthPreference;
  if (draft.emailOptIn != null) input.emailOptIn = draft.emailOptIn;
  if (draft.pushNotificationsOptIn != null) {
    input.pushNotificationsOptIn = draft.pushNotificationsOptIn;
  }
  if (draft.pendingUsername != null) input.username = draft.pendingUsername;
  if (draft.pendingDisplayName != null) input.displayName = draft.pendingDisplayName;
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
  return updateMyProfile(accessToken, input);
}
