import type { ActivityLevel, Gender } from '../lib/api';
import { ageFromBirthday } from './calorieEstimationInput';

// The Mifflin-St Jeor calorie-estimation formula -- already named as the
// intended method by CalorieEstimationScreen's own footnote and this
// feature's design reference, just not yet implemented as code anywhere in
// the app. This is the one place that formula lives; nothing else computes
// calorie targets.

/** Mifflin-St Jeor is only defined for male/female (it has no third term);
 * a user who selected 'other'/'prefer_not_to_say' simply can't get an
 * estimate from this formula -- never guessed. */
export type CalorieSex = Extract<Gender, 'male' | 'female'>;

export interface CalorieProfileInput {
  gender: CalorieSex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
}

/** Standard Mifflin-St Jeor activity multipliers, one per
 * calorieEstimationInput.ts's ACTIVITY_LEVELS tier. */
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

/** Basal metabolic rate (kcal/day), before any activity multiplier. */
export function computeBMR(
  input: Pick<CalorieProfileInput, 'gender' | 'age' | 'heightCm' | 'weightKg'>,
): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  return input.gender === 'male' ? base + 5 : base - 161;
}

/** Maintenance calories (kcal/day) -- BMR x this activity level's multiplier. */
export function computeMaintenanceCalories(input: CalorieProfileInput): number {
  return Math.round(computeBMR(input) * ACTIVITY_MULTIPLIERS[input.activityLevel]);
}

// Fixed adjustment amounts, matching the approved design reference exactly
// (+300 / -300 / -500 vs. maintenance) -- a mild surplus/deficit and an
// aggressive deficit, the same structure most general nutrition guidance
// uses. Not a per-user-tunable setting in this phase.
export const SURPLUS_DELTA = 300;
export const DEFICIT_DELTA = 300;
export const AGGRESSIVE_DEFICIT_DELTA = 500;

export interface CalorieTargets {
  maintenance: number;
  surplus: number;
  deficit: number;
  aggressiveDeficit: number;
}

export function computeCalorieTargets(input: CalorieProfileInput): CalorieTargets {
  const maintenance = computeMaintenanceCalories(input);
  return {
    maintenance,
    surplus: maintenance + SURPLUS_DELTA,
    deficit: maintenance - DEFICIT_DELTA,
    aggressiveDeficit: maintenance - AGGRESSIVE_DEFICIT_DELTA,
  };
}

/** The subset of the user's profile this calculation needs -- canonical
 * units only (height/weight in cm/kg, matching users.height_value/
 * weight_value), never the display-unit versions. */
export interface UserCalorieProfile {
  gender: Gender | null;
  birthday: string | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel | null;
}

/**
 * Builds the formula's input from the user's real, persisted profile --
 * returns null whenever anything required is missing or the profile's
 * gender isn't one Mifflin-St Jeor supports, so the caller can show an
 * honest "complete your profile" state instead of a fabricated estimate.
 */
export function buildCalorieProfileInput(
  profile: UserCalorieProfile,
  now: Date = new Date(),
): CalorieProfileInput | null {
  if (profile.gender !== 'male' && profile.gender !== 'female') return null;
  if (!profile.birthday) return null;
  const age = ageFromBirthday(profile.birthday, now);
  if (age === null) return null;
  if (profile.heightCm === null || profile.weightKg === null) return null;
  if (profile.activityLevel === null) return null;

  return {
    gender: profile.gender,
    age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    activityLevel: profile.activityLevel,
  };
}
