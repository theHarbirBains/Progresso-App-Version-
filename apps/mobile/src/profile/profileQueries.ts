import type { ProfileResponse } from '../lib/api';
import { supabase } from '../lib/supabase';

// Same columns and mapping as the API's GET /users/me (apps/api/src/users/users.service.ts).
const PROFILE_COLUMNS =
  'weight_unit, display_name, last_name, username, workout_accent_color, nutrition_accent_color, ' +
  'background_theme, avatar_url, active_workout_split_id, gender, birthday, weight_value, ' +
  'height_value, height_unit, fitness_goal, training_experience, workout_frequency_days, ' +
  'training_style_preference, email_opt_in, push_notifications_opt_in, ' +
  'apple_health_preference, onboarding_completed_at, activity_level, ' +
  'referral_source, country, average_workout_length, training_comfort, rep_range_min, ' +
  'rep_range_max, progression_cues_enabled, fitness_goals, membership_tier, ' +
  'notify_follows, notify_likes, notify_comments, findable_by_email, bio, show_rank, ' +
  'phone_e164, findable_by_phone';

interface ProfileRow {
  weight_unit: ProfileResponse['weightUnit'];
  display_name: string | null;
  last_name: string | null;
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
  fitness_goals: ProfileResponse['fitnessGoals'] | null;
  membership_tier: ProfileResponse['membershipTier'] | null;
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
  training_comfort: ProfileResponse['trainingComfort'];
  rep_range_min: number;
  rep_range_max: number;
  progression_cues_enabled: boolean;
  notify_follows: boolean | null;
  notify_likes: boolean | null;
  notify_comments: boolean | null;
  findable_by_email: boolean | null;
  bio: string | null;
  show_rank: boolean | null;
  phone_e164: string | null;
  findable_by_phone: boolean | null;
}

function toProfile(userId: string, row: ProfileRow): ProfileResponse {
  return {
    id: userId,
    weightUnit: row.weight_unit,
    displayName: row.display_name,
    lastName: row.last_name ?? null,
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
    fitnessGoals: row.fitness_goals ?? [],
    // Every account has one; a missing value reads as the tier with everything.
    membershipTier: row.membership_tier ?? 'everything',
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
    trainingComfort: row.training_comfort,
    repRangeMin: row.rep_range_min,
    repRangeMax: row.rep_range_max,
    progressionCuesEnabled: row.progression_cues_enabled,
    // On unless turned off.
    notifyFollows: row.notify_follows !== false,
    notifyLikes: row.notify_likes !== false,
    notifyComments: row.notify_comments !== false,
    findableByEmail: row.findable_by_email !== false,
    bio: row.bio ?? null,
    showRank: row.show_rank !== false,
    phoneNumber: row.phone_e164 ?? null,
    findableByPhone: row.findable_by_phone !== false,
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
