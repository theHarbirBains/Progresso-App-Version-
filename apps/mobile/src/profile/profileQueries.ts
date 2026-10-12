import type { ProfileResponse } from '../lib/api';
import { supabase } from '../lib/supabase';

// Same columns and mapping as the API's GET /users/me (apps/api/src/users/users.service.ts).
const PROFILE_COLUMNS =
  'weight_unit, display_name, username, workout_accent_color, nutrition_accent_color, ' +
  'background_theme, avatar_url, active_workout_split_id, gender, birthday, weight_value, ' +
  'height_value, height_unit, fitness_goal, training_experience, workout_frequency_days, ' +
  'training_style_preference, email_opt_in, push_notifications_opt_in, ' +
  'apple_health_preference, onboarding_completed_at, activity_level, ' +
  'referral_source, country, average_workout_length';

interface ProfileRow {
  weight_unit: ProfileResponse['weightUnit'];
  display_name: string | null;
  username: string | null;
  workout_accent_color: string | null;
  nutrition_accent_color: string | null;
  background_theme: string | null;
  avatar_url: string | null;
  active_workout_split_id: string | null;
  gender: ProfileResponse['gender'];
  birthday: string | null;
  weight_value: number | null;
  height_value: number | null;
  height_unit: ProfileResponse['heightUnit'];
  fitness_goal: ProfileResponse['fitnessGoal'];
  training_experience: ProfileResponse['trainingExperience'];
  workout_frequency_days: number | null;
  training_style_preference: ProfileResponse['trainingStylePreference'];
  email_opt_in: boolean | null;
  push_notifications_opt_in: boolean | null;
  apple_health_preference: ProfileResponse['appleHealthPreference'];
  onboarding_completed_at: string | null;
  activity_level: ProfileResponse['activityLevel'];
  referral_source: ProfileResponse['referralSource'];
  country: string | null;
  average_workout_length: ProfileResponse['averageWorkoutLength'];
}

function toProfile(userId: string, row: ProfileRow): ProfileResponse {
  return {
    id: userId,
    weightUnit: row.weight_unit,
    displayName: row.display_name,
    username: row.username,
    workoutAccentColor: row.workout_accent_color,
    nutritionAccentColor: row.nutrition_accent_color,
    backgroundTheme: row.background_theme,
    avatarUrl: row.avatar_url,
    activeWorkoutSplitId: row.active_workout_split_id,
    gender: row.gender,
    birthday: row.birthday,
    weightValue: row.weight_value,
    heightValue: row.height_value,
    heightUnit: row.height_unit,
    fitnessGoal: row.fitness_goal,
    trainingExperience: row.training_experience,
    workoutFrequencyDays: row.workout_frequency_days,
    trainingStylePreference: row.training_style_preference,
    emailOptIn: row.email_opt_in,
    pushNotificationsOptIn: row.push_notifications_opt_in,
    appleHealthPreference: row.apple_health_preference,
    onboardingCompletedAt: row.onboarding_completed_at,
    activityLevel: row.activity_level,
    referralSource: row.referral_source,
    country: row.country,
    averageWorkoutLength: row.average_workout_length,
  };
}

/**
 * The signed-in user's own profile row, read straight from Supabase under its own-row select
 * policy, so loading the app never waits on the API. Writes still go through PATCH /users/me.
 */
export async function fetchMyProfile(userId: string): Promise<ProfileResponse> {
  const { data, error } = await supabase
    .from('users')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('User profile not found');
  return toProfile(userId, data as unknown as ProfileRow);
}
