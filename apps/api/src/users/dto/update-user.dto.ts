import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const USERNAME_PATTERN = /^[a-z0-9_]+$/;
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'] as const;
const FITNESS_GOALS = [
  'build_muscle',
  'get_stronger',
  'lose_fat',
  'improve_fitness',
  'improve_athletic_performance',
  'maintain_fitness',
  'general_health',
  'other',
] as const;
const TRAINING_EXPERIENCES = ['beginner', 'intermediate', 'advanced'] as const;
const TRAINING_STYLE_PREFERENCES = ['guided', 'build_your_own'] as const;
const APPLE_HEALTH_PREFERENCES = ['connected', 'not_now'] as const;

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  displayName?: string;

  // Lowercased before validation so "Harbir" is accepted and normalized
  // rather than rejected for not already being lowercase — Instagram-style
  // usernames are conventionally case-insensitive from the user's point of
  // view, not case-rejecting.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(USERNAME_PATTERN, {
    message: 'username may only contain lowercase letters, numbers, and underscores',
  })
  username?: string;

  @IsOptional()
  @IsIn(['kg', 'lb'])
  weightUnit?: 'kg' | 'lb';

  @IsOptional()
  @Matches(HEX_COLOR_PATTERN, { message: 'workoutAccentColor must be a hex color like #2F80FF' })
  workoutAccentColor?: string;

  @IsOptional()
  @Matches(HEX_COLOR_PATTERN, { message: 'nutritionAccentColor must be a hex color like #10B981' })
  nutritionAccentColor?: string;

  // Ownership (does this split actually belong to the caller?) is enforced
  // by RLS + the workout_splits foreign key, not here -- an id for a split
  // that doesn't exist or belongs to someone else simply fails at the DB
  // layer, matching how every other cross-table reference in this app works.
  @IsOptional()
  @IsUUID()
  activeWorkoutSplitId?: string;

  @IsOptional()
  @IsIn(GENDERS)
  gender?: (typeof GENDERS)[number];

  @IsOptional()
  @IsDateString()
  birthday?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  weightValue?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  heightValue?: number;

  @IsOptional()
  @IsIn(['cm', 'ft_in'])
  heightUnit?: 'cm' | 'ft_in';

  @IsOptional()
  @IsIn(FITNESS_GOALS)
  fitnessGoal?: (typeof FITNESS_GOALS)[number];

  @IsOptional()
  @IsIn(TRAINING_EXPERIENCES)
  trainingExperience?: (typeof TRAINING_EXPERIENCES)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  workoutFrequencyDays?: number;

  @IsOptional()
  @IsIn(TRAINING_STYLE_PREFERENCES)
  trainingStylePreference?: (typeof TRAINING_STYLE_PREFERENCES)[number];

  @IsOptional()
  @IsBoolean()
  emailOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  pushNotificationsOptIn?: boolean;

  @IsOptional()
  @IsIn(APPLE_HEALTH_PREFERENCES)
  appleHealthPreference?: (typeof APPLE_HEALTH_PREFERENCES)[number];

  // Set by the onboarding completion screen only, via a dedicated
  // "complete onboarding" write -- see UsersService.updateProfile. Not
  // meant to be set to an arbitrary value by the client; a boolean toggle
  // (rather than accepting a caller-supplied timestamp) keeps this
  // impossible to spoof to an unintended date.
  @IsOptional()
  @IsBoolean()
  onboardingCompleted?: boolean;
}
