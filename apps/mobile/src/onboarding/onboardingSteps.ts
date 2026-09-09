import type { ProfileResponse } from '../lib/api';

export const STEP_ORDER = [
  'appleHealth',
  'gender',
  'birthday',
  'weight',
  'height',
  'fitnessGoal',
  'trainingExperience',
  'workoutFrequency',
  'trainingStyle',
  'workoutSplit',
  'emailPreference',
  'pushNotifications',
  'completion',
] as const;

export type OnboardingStep = (typeof STEP_ORDER)[number];

/** Whether the profile already carries an answer for this step -- used both
 * to resume onboarding at the right place after the app closes mid-flow,
 * and to make sure a signed-in user is never asked the same question twice
 * (see the onboarding resumability requirement). */
export function isStepAnswered(step: OnboardingStep, profile: ProfileResponse): boolean {
  switch (step) {
    case 'appleHealth':
      return profile.appleHealthPreference != null;
    case 'gender':
      return profile.gender != null;
    case 'birthday':
      return profile.birthday != null;
    case 'weight':
      return profile.weightValue != null;
    case 'height':
      return profile.heightValue != null;
    case 'fitnessGoal':
      return profile.fitnessGoal != null;
    case 'trainingExperience':
      return profile.trainingExperience != null;
    case 'workoutFrequency':
      return profile.workoutFrequencyDays != null;
    case 'trainingStyle':
      return profile.trainingStylePreference != null;
    case 'workoutSplit':
      return profile.activeWorkoutSplitId != null;
    case 'emailPreference':
      return profile.emailOptIn != null;
    case 'pushNotifications':
      return profile.pushNotificationsOptIn != null;
    case 'completion':
      return false;
  }
}

/** The first unanswered step, or the completion step if every other step is already answered. */
export function computeStartStepIndex(profile: ProfileResponse): number {
  const index = STEP_ORDER.findIndex((step) => !isStepAnswered(step, profile));
  return index === -1 ? STEP_ORDER.length - 1 : index;
}
