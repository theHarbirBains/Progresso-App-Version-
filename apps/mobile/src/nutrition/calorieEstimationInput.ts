import type { ActivityLevel } from '../lib/api';

export type { ActivityLevel };

interface ActivityLevelOption {
  value: ActivityLevel;
  label: string;
  description: string;
}

/** The 5 Mifflin-St Jeor activity multiplier tiers -- exact labels/descriptions as specified for this screen. */
export const ACTIVITY_LEVELS: ActivityLevelOption[] = [
  { value: 'sedentary', label: 'Sedentary', description: 'Little to no exercise' },
  {
    value: 'lightly_active',
    label: 'Lightly active',
    description: 'Light exercise 1-3 days/week',
  },
  {
    value: 'moderately_active',
    label: 'Moderately active',
    description: 'Moderate exercise 3-5 days/week',
  },
  { value: 'very_active', label: 'Very active', description: 'Hard exercise 6-7 days/week' },
  {
    value: 'extra_active',
    label: 'Extra active',
    description: 'Very hard exercise + physical job',
  },
];

export const MIN_AGE = 13;
export const MAX_AGE = 100;

/**
 * Whole years between a birthdate and today -- used only to prefill the Age
 * field from the profile's existing onboarding birthday. This screen never
 * writes back to birthday; age is its own independently editable field once
 * prefilled, per this task's "collect, don't persist yet" scope.
 */
export function ageFromBirthday(birthday: string, now: Date = new Date()): number | null {
  // Parsed as plain Y-M-D components (same convention as
  // onboarding/dateWheelValues.ts's toDateStringUTC) rather than
  // `new Date(birthday)`, which would interpret the date-only string as UTC
  // midnight and can shift a day off in a local timezone behind UTC.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday);
  if (!match) return null;
  const [, yearStr, monthStr, dayStr] = match;
  const birthYear = Number(yearStr);
  const birthMonth = Number(monthStr) - 1;
  const birthDay = Number(dayStr);

  let age = now.getFullYear() - birthYear;
  const hasHadBirthdayThisYear =
    now.getMonth() > birthMonth || (now.getMonth() === birthMonth && now.getDate() >= birthDay);
  if (!hasHadBirthdayThisYear) age -= 1;

  return age;
}

export interface CalorieEstimationInput {
  gender: 'male' | 'female' | null;
  /** Raw text field value -- validated, not yet parsed. */
  age: string;
  activityLevel: ActivityLevel | null;
}

export interface CalorieEstimationErrors {
  gender?: string;
  age?: string;
  activityLevel?: string;
}

/**
 * Validates every field the (not-yet-built) Mifflin-St Jeor calculation will
 * need. Height and weight are deliberately not validated here: both are
 * entered through HeightWheelPicker/WeightWheelPicker, whose own value
 * ranges (30-250kg, 90-250cm) make an out-of-range selection impossible by
 * construction, rather than something to catch after the fact.
 */
export function validateCalorieEstimationInput(
  input: CalorieEstimationInput,
): CalorieEstimationErrors {
  const errors: CalorieEstimationErrors = {};

  if (input.gender === null) {
    errors.gender = 'Select a gender';
  }

  const trimmedAge = input.age.trim();
  if (trimmedAge === '') {
    errors.age = 'Enter your age';
  } else if (!/^\d+$/.test(trimmedAge)) {
    errors.age = 'Enter a whole number of years';
  } else if (Number(trimmedAge) < MIN_AGE || Number(trimmedAge) > MAX_AGE) {
    errors.age = `Age must be between ${MIN_AGE} and ${MAX_AGE}`;
  }

  if (input.activityLevel === null) {
    errors.activityLevel = 'Select an activity level';
  }

  return errors;
}

export function isCalorieEstimationInputValid(input: CalorieEstimationInput): boolean {
  return Object.keys(validateCalorieEstimationInput(input)).length === 0;
}
