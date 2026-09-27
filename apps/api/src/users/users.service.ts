import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { UpdateUserDto } from './dto/update-user.dto';

export interface UserProfile {
  weightUnit: 'kg' | 'lb';
  displayName: string | null;
  username: string | null;
  workoutAccentColor: string | null;
  nutritionAccentColor: string | null;
  backgroundTheme: string | null;
  avatarUrl: string | null;
  activeWorkoutSplitId: string | null;
  gender: string | null;
  birthday: string | null;
  weightValue: number | null;
  heightValue: number | null;
  heightUnit: 'cm' | 'ft_in';
  fitnessGoal: string | null;
  trainingExperience: string | null;
  workoutFrequencyDays: number | null;
  activityLevel: string | null;
  trainingStylePreference: string | null;
  emailOptIn: boolean | null;
  pushNotificationsOptIn: boolean | null;
  appleHealthPreference: string | null;
  onboardingCompletedAt: string | null;
  referralSource: string | null;
  country: string | null;
  averageWorkoutLength: string | null;
}

const USERNAME_UNIQUE_VIOLATION = '23505';

const PROFILE_COLUMNS =
  'weight_unit, display_name, username, workout_accent_color, nutrition_accent_color, ' +
  'background_theme, avatar_url, active_workout_split_id, gender, birthday, weight_value, ' +
  'height_value, height_unit, fitness_goal, training_experience, workout_frequency_days, ' +
  'training_style_preference, email_opt_in, push_notifications_opt_in, ' +
  'apple_health_preference, onboarding_completed_at, activity_level, ' +
  'referral_source, country, average_workout_length';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toProfile(data: any): UserProfile {
  return {
    weightUnit: data.weight_unit,
    displayName: data.display_name,
    username: data.username,
    workoutAccentColor: data.workout_accent_color,
    nutritionAccentColor: data.nutrition_accent_color,
    backgroundTheme: data.background_theme,
    avatarUrl: data.avatar_url,
    activeWorkoutSplitId: data.active_workout_split_id,
    gender: data.gender,
    birthday: data.birthday,
    weightValue: data.weight_value,
    heightValue: data.height_value,
    heightUnit: data.height_unit,
    fitnessGoal: data.fitness_goal,
    trainingExperience: data.training_experience,
    workoutFrequencyDays: data.workout_frequency_days,
    activityLevel: data.activity_level,
    trainingStylePreference: data.training_style_preference,
    emailOptIn: data.email_opt_in,
    pushNotificationsOptIn: data.push_notifications_opt_in,
    appleHealthPreference: data.apple_health_preference,
    onboardingCompletedAt: data.onboarding_completed_at,
    referralSource: data.referral_source,
    country: data.country,
    averageWorkoutLength: data.average_workout_length,
  };
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle();

    // A real query error (bad column, connectivity, RLS misconfiguration)
    // used to be reported identically to "no row for this user" -- the
    // exact same 404 "User profile not found" either way, which reads as a
    // missing-account problem even when the actual cause is a schema
    // mismatch (e.g. a migration not yet applied to this database). Logged
    // and surfaced as a real 500 now so the two are never confused again.
    if (error) {
      this.logger.error(`Failed to load profile for ${userId}: ${error.message}`);
      throw new InternalServerErrorException('Failed to load profile');
    }
    if (!data) {
      throw new NotFoundException('User profile not found');
    }

    return toProfile(data);
  }

  async updateProfile(userId: string, dto: UpdateUserDto): Promise<UserProfile> {
    const updatePayload: Record<string, unknown> = {};
    if (dto.displayName !== undefined) updatePayload.display_name = dto.displayName;
    if (dto.username !== undefined) updatePayload.username = dto.username;
    if (dto.weightUnit !== undefined) updatePayload.weight_unit = dto.weightUnit;
    if (dto.workoutAccentColor !== undefined) {
      updatePayload.workout_accent_color = dto.workoutAccentColor;
    }
    if (dto.nutritionAccentColor !== undefined) {
      updatePayload.nutrition_accent_color = dto.nutritionAccentColor;
    }
    if (dto.backgroundTheme !== undefined) {
      updatePayload.background_theme = dto.backgroundTheme;
    }
    if (dto.avatarUrl !== undefined) updatePayload.avatar_url = dto.avatarUrl;
    if (dto.activeWorkoutSplitId !== undefined) {
      updatePayload.active_workout_split_id = dto.activeWorkoutSplitId;
    }
    if (dto.gender !== undefined) updatePayload.gender = dto.gender;
    if (dto.birthday !== undefined) updatePayload.birthday = dto.birthday;
    if (dto.weightValue !== undefined) updatePayload.weight_value = dto.weightValue;
    if (dto.heightValue !== undefined) updatePayload.height_value = dto.heightValue;
    if (dto.heightUnit !== undefined) updatePayload.height_unit = dto.heightUnit;
    if (dto.fitnessGoal !== undefined) updatePayload.fitness_goal = dto.fitnessGoal;
    if (dto.trainingExperience !== undefined) {
      updatePayload.training_experience = dto.trainingExperience;
    }
    if (dto.workoutFrequencyDays !== undefined) {
      updatePayload.workout_frequency_days = dto.workoutFrequencyDays;
    }
    if (dto.activityLevel !== undefined) updatePayload.activity_level = dto.activityLevel;
    if (dto.trainingStylePreference !== undefined) {
      updatePayload.training_style_preference = dto.trainingStylePreference;
    }
    if (dto.emailOptIn !== undefined) updatePayload.email_opt_in = dto.emailOptIn;
    if (dto.pushNotificationsOptIn !== undefined) {
      updatePayload.push_notifications_opt_in = dto.pushNotificationsOptIn;
    }
    if (dto.appleHealthPreference !== undefined) {
      updatePayload.apple_health_preference = dto.appleHealthPreference;
    }
    // A boolean flag in the DTO, but a server-set timestamp in the DB --
    // the client can only ever mark onboarding done "now", never spoof a
    // specific completion date.
    if (dto.onboardingCompleted !== undefined) {
      updatePayload.onboarding_completed_at = dto.onboardingCompleted
        ? new Date().toISOString()
        : null;
    }
    if (dto.referralSource !== undefined) updatePayload.referral_source = dto.referralSource;
    if (dto.country !== undefined) updatePayload.country = dto.country;
    if (dto.averageWorkoutLength !== undefined) {
      updatePayload.average_workout_length = dto.averageWorkoutLength;
    }

    if (Object.keys(updatePayload).length === 0) {
      return this.getProfile(userId);
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .update(updatePayload)
      .eq('id', userId)
      .select(PROFILE_COLUMNS)
      .maybeSingle();

    if (error) {
      if (error.code === USERNAME_UNIQUE_VIOLATION) {
        throw new ConflictException('That username is already taken');
      }
      throw new InternalServerErrorException('Failed to update profile');
    }

    if (!data) {
      throw new NotFoundException('User profile not found');
    }

    return toProfile(data);
  }

  /** True when the username is free, or already belongs to this same user. */
  async isUsernameAvailable(username: string, currentUserId: string): Promise<boolean> {
    const normalized = username.toLowerCase().trim();

    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select('id')
      .eq('username', normalized)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException('Failed to check username availability');
    }

    return !data || data.id === currentUserId;
  }
}
