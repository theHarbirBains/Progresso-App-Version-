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
export type AppleHealthPreference = 'connected' | 'not_now';
/** The 5 Mifflin-St Jeor activity-multiplier tiers -- see
 * nutrition/calorieEstimationInput.ts's ACTIVITY_LEVELS for the labeled/
 * described catalog built on this same type. */
export type ActivityLevel =
  'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active';
export type ReferralSource =
  'tiktok' | 'instagram' | 'friend' | 'app_store' | 'google_search' | 'creator' | 'other';
export type AverageWorkoutLength = '20_30' | '30_45' | '45_60' | '60_plus';

export interface ProfileResponse {
  id: string;
  email: string;
  role: string;
  displayName: string | null;
  username: string | null;
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
}

export interface UpdateProfileInput {
  displayName?: string;
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
}

export function getMyProfile(accessToken: string): Promise<ProfileResponse> {
  return request<ProfileResponse>('/api/v1/users/me', accessToken);
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
