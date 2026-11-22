import type { Feather } from '@expo/vector-icons';
import type {
  ActivityLevel,
  AverageWorkoutLength,
  FitnessGoal,
  Gender,
  ReferralSource,
  TrainingComfort,
} from '../lib/api';

type Glyph = keyof typeof Feather.glyphMap;

// "What is your sex?" -- the two the calorie estimate's formula (Mifflin-St Jeor) works from, so
// the daily targets can always be worked out. A profile saved before with another answer keeps it.
export const SEX_OPTIONS: { value: Extract<Gender, 'male' | 'female'>; label: string }[] = [
  { value: 'male', label: 'Man' },
  { value: 'female', label: 'Woman' },
];

export const FITNESS_GOAL_OPTIONS: { value: FitnessGoal; label: string; icon: Glyph }[] = [
  { value: 'build_muscle', label: 'Build Muscle', icon: 'trending-up' },
  { value: 'get_stronger', label: 'Get Stronger', icon: 'zap' },
  { value: 'lose_fat', label: 'Lose Fat', icon: 'trending-down' },
  { value: 'improve_athletic_performance', label: 'Improve Athletic Performance', icon: 'wind' },
  { value: 'improve_fitness', label: 'Improve Overall Fitness', icon: 'activity' },
  { value: 'maintain_fitness', label: 'Maintain Fitness', icon: 'shield' },
];

/** Whether onboarding offers this goal (General Health and Other were taken out). */
export function isOfferedGoal(goal: FitnessGoal): boolean {
  return FITNESS_GOAL_OPTIONS.some((option) => option.value === goal);
}

// "How confident are you in planning and progressing your workouts?" -- replaced the old
// experience (Beginner/Intermediate/Advanced) and training-style (Guided/Build My Own)
// questions, whose answers nothing used. It sets the starting rep range and whether
// progression suggestions come with a one-line why (workouts/progression.ts). Never locks a
// feature; it can be changed in Settings > Workout Preferences.
export const TRAINING_COMFORT_OPTIONS: {
  value: TrainingComfort;
  label: string;
  description: string;
}[] = [
  {
    value: 'still_learning',
    label: "I'm a beginner",
    description: "I'm learning how to choose exercises, structure workouts and improve over time.",
  },
  {
    value: 'knows_basics',
    label: 'I understand the basics',
    description:
      "I know how sets and reps work, but I'm not always sure when to increase weight or adjust my training.",
  },
  {
    value: 'plans_and_progresses',
    label: "I'm confident with my training",
    description:
      'I follow a routine, track my performance and understand how to progressively improve.',
  },
  {
    value: 'follows_method',
    label: 'I follow structured programming',
    description:
      'I use planned progression, RPE/RIR, percentage-based training, periodization or a coach-designed program.',
  },
];

export const WORKOUT_FREQUENCY_OPTIONS: { value: number; label: string; figure: string }[] = [
  { value: 1, label: '1-2 days', figure: '1-2' },
  { value: 3, label: '3 days', figure: '3' },
  { value: 4, label: '4 days', figure: '4' },
  { value: 5, label: '5 days', figure: '5' },
  { value: 6, label: '6 days', figure: '6' },
  { value: 7, label: '7 days', figure: '7' },
];

export const REFERRAL_SOURCE_OPTIONS: { value: ReferralSource; label: string; icon: Glyph }[] = [
  { value: 'tiktok', label: 'TikTok', icon: 'music' },
  { value: 'instagram', label: 'Instagram', icon: 'instagram' },
  { value: 'friend', label: 'A friend', icon: 'users' },
  { value: 'app_store', label: 'App Store', icon: 'smartphone' },
  { value: 'google_search', label: 'Google Search', icon: 'search' },
  { value: 'creator', label: 'A creator', icon: 'video' },
  { value: 'other', label: 'Somewhere else', icon: 'more-horizontal' },
];

export const AVERAGE_WORKOUT_LENGTH_OPTIONS: {
  value: AverageWorkoutLength;
  label: string;
  figure: string;
}[] = [
  { value: '20_30', label: '20-30 min', figure: '20-30' },
  { value: '30_45', label: '30-45 min', figure: '30-45' },
  { value: '45_60', label: '45-60 min', figure: '45-60' },
  { value: '60_plus', label: '60+ min', figure: '60+' },
];

// "How active are you?" in everyday terms: about how many steps a day, and what a day like it
// looks like, beside each level (nutrition/calorieEstimationInput.ts's ACTIVITY_LEVELS). The
// steps follow the usual daily-step bands (under 5,000 sedentary, 5,000-7,499 low active,
// 7,500-9,999 somewhat active, 10,000 and up active, 12,500 and up highly active).
export const ACTIVITY_GUIDES: Record<
  ActivityLevel,
  { icon: Glyph; steps: string; examples: string }
> = {
  sedentary: {
    icon: 'monitor',
    steps: 'Under 5,000 steps a day',
    examples: 'Mostly sitting -- a desk job or studying -- and little or no exercise.',
  },
  lightly_active: {
    icon: 'coffee',
    steps: '5,000-7,500 steps a day',
    examples: 'Some walking through the day, and light workouts 1-3 days a week.',
  },
  moderately_active: {
    icon: 'activity',
    steps: '7,500-10,000 steps a day',
    examples: 'On your feet part of the day, and working out 3-5 days a week.',
  },
  very_active: {
    icon: 'zap',
    steps: '10,000-12,500 steps a day',
    examples: 'Hard training 6-7 days a week, or a job that keeps you moving.',
  },
  extra_active: {
    icon: 'tool',
    steps: 'Over 12,500 steps a day',
    examples: 'Hard daily training plus a physical job, like construction or coaching.',
  },
};
