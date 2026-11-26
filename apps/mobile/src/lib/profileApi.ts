import type { EquipmentAccess, PriorityArea, TrainingExclusion } from '../programs/programTypes';
import { request } from './apiClient';

// Thin client for the backend API — the only place profile writes go
// through (see PATCH /users/me), never a direct Supabase client update,
// so username uniqueness/validation stays centrally enforced server-side.
export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type HeightUnit = 'cm' | 'ft_in';
export type FitnessGoal =
  | 'build_muscle'
  | 'get_stronger'
  | 'lose_fat'
  | 'improve_fitness'
  | 'improve_athletic_performance'
  | 'maintain_fitness'
  | 'general_health'
  | 'other';
export type TrainingExperience = 'beginner' | 'intermediate' | 'advanced';
export type TrainingStylePreference = 'guided' | 'build_your_own';
/** How comfortable someone is planning and progressing their workouts -- see onboardingOptions' TRAINING_COMFORT_OPTIONS. */
export type TrainingComfort =
  'still_learning' | 'knows_basics' | 'plans_and_progresses' | 'follows_method';
export type AppleHealthPreference = 'connected' | 'not_now';
/** The 5 Mifflin-St Jeor activity-multiplier tiers -- see
 * nutrition/calorieEstimationInput.ts's ACTIVITY_LEVELS for the labeled/
 * described catalog built on this same type. */
export type ActivityLevel =
  'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active';
export type ReferralSource =
  'tiktok' | 'instagram' | 'friend' | 'app_store' | 'google_search' | 'creator' | 'other';
export type AverageWorkoutLength = '20_30' | '30_45' | '45_60' | '60_plus';
/** Which parts of the app a person uses -- see membership/membershipTiers.ts. Free, theirs to change. */
export type MembershipTier = 'workouts' | 'workouts_nutrition' | 'everything';

export interface ProfileResponse {
  id: string;
  /** Their first name. */
  displayName: string | null;
  /** Their last name, after their first on their profile -- null for anyone who hasn't added one. */
  lastName: string | null;
  username: string | null;
  /** A line about themselves on their profile, for anyone who opens it -- null with none. */
  bio: string | null;
  weightUnit: 'kg' | 'lb';
  workoutAccentColor: string | null;
  nutritionAccentColor: string | null;
  backgroundTheme: string | null;
  avatarUrl: string | null;
  activeWorkoutSplitId: string | null;
  gender: Gender | null;
  birthday: string | null;
  weightValue: number | null;
  heightValue: number | null;
  heightUnit: HeightUnit;
  fitnessGoal: FitnessGoal | null;
  /** Up to three, in the order picked; fitnessGoal is the first of them. */
  fitnessGoals: FitnessGoal[];
  membershipTier: MembershipTier;
  trainingExperience: TrainingExperience | null;
  workoutFrequencyDays: number | null;
  trainingStylePreference: TrainingStylePreference | null;
  emailOptIn: boolean | null;
  pushNotificationsOptIn: boolean | null;
  appleHealthPreference: AppleHealthPreference | null;
  onboardingCompletedAt: string | null;
  activityLevel: ActivityLevel | null;
  referralSource: ReferralSource | null;
  /** ISO 3166-1 alpha-2, e.g. "CA" -- purely informational, nothing else reads it. */
  country: string | null;
  averageWorkoutLength: AverageWorkoutLength | null;
  /** Null until answered (onboarding, or Settings for accounts made before the question). */
  trainingComfort: TrainingComfort | null;
  /** The rep range every exercise is trained to -- see workouts/progression.ts. */
  repRangeMin: number;
  repRangeMax: number;
  /** Whether the live workout suggests when to go heavier or make an exercise harder. */
  progressionCuesEnabled: boolean;
  /** Up to three areas they want to prioritize in the gym (or Balanced Development alone), for
   * program recommendations -- empty until answered. */
  trainingPriorities: PriorityArea[];
  /** Where they train, for program recommendations -- null until answered. */
  equipmentAccess: EquipmentAccess | null;
  /** What they'd rather not train directly, for program recommendations. */
  trainingExclusions: TrainingExclusion[];
  /** Push for social activity (Settings > Notifications > Social), each on unless turned off. */
  notifyFollows: boolean;
  notifyLikes: boolean;
  notifyComments: boolean;
  /** Whether people with their email in their contacts can find them. */
  findableByEmail: boolean;
  /** Their phone number (E.164) -- only ever their own; null for an account from before it was asked. */
  phoneNumber: string | null;
  /** Whether people with their phone number in their contacts can find them. */
  findableByPhone: boolean;
  /** Whether people who open their profile see their achievement rank. */
  showRank: boolean;
  /** Who sees their profile's training: accepted followers (private, the default) or everyone
   * signed in (public) -- Settings > Account & Security > Privacy. */
  profileVisibility: 'private' | 'public';
  /** Whether a workout invite, and the answer to one they sent, is pushed to them. */
  notifyGroupInvites: boolean;
  /** What they have at home, for home programs (programs/homeEquipment.ts); empty when not
   * answered. */
  homeEquipment: string[];
}

export interface UpdateProfileInput {
  displayName?: string;
  lastName?: string;
  /** 80 characters at most; blank or null clears it. */
  bio?: string | null;
  username?: string;
  weightUnit?: 'kg' | 'lb';
  workoutAccentColor?: string;
  nutritionAccentColor?: string;
  backgroundTheme?: string;
  /** Explicit null clears the picture (reverts to the fallback avatar); omit to leave it untouched. */
  avatarUrl?: string | null;
  activeWorkoutSplitId?: string;
  gender?: Gender;
  birthday?: string;
  weightValue?: number;
  heightValue?: number;
  heightUnit?: HeightUnit;
  fitnessGoal?: FitnessGoal;
  fitnessGoals?: FitnessGoal[];
  membershipTier?: MembershipTier;
  trainingExperience?: TrainingExperience;
  workoutFrequencyDays?: number;
  trainingStylePreference?: TrainingStylePreference;
  emailOptIn?: boolean;
  pushNotificationsOptIn?: boolean;
  appleHealthPreference?: AppleHealthPreference;
  onboardingCompleted?: boolean;
  activityLevel?: ActivityLevel;
  referralSource?: ReferralSource;
  country?: string;
  averageWorkoutLength?: AverageWorkoutLength;
  trainingComfort?: TrainingComfort;
  repRangeMin?: number;
  repRangeMax?: number;
  progressionCuesEnabled?: boolean;
  /** Up to three, or ['balanced'] alone; never one of trainingExclusions. */
  trainingPriorities?: PriorityArea[];
  equipmentAccess?: EquipmentAccess;
  trainingExclusions?: TrainingExclusion[];
  notifyFollows?: boolean;
  notifyLikes?: boolean;
  notifyComments?: boolean;
  findableByEmail?: boolean;
  /** E.164 (lib/phoneNumbers.ts). Changed, never cleared. */
  phoneNumber?: string;
  findableByPhone?: boolean;
  showRank?: boolean;
  profileVisibility?: 'private' | 'public';
  notifyGroupInvites?: boolean;
  homeEquipment?: string[];
}

export function updateMyProfile(
  accessToken: string,
  updates: UpdateProfileInput,
): Promise<ProfileResponse> {
  return request<ProfileResponse>('/api/v1/users/me', accessToken, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/**
 * Deletes the signed-in account and everything it owns, for good -- see the API's
 * AccountDeletionService. The server only ever deletes the account the token belongs to.
 */
export function deleteMyAccount(accessToken: string): Promise<{ success: true }> {
  return request<{ success: true }>('/api/v1/users/me', accessToken, { method: 'DELETE' });
}
