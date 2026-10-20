import type {
  AverageWorkoutLength,
  FitnessGoal,
  Gender,
  ReferralSource,
  TrainingComfort,
} from '../lib/api';

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export const FITNESS_GOAL_OPTIONS: { value: FitnessGoal; label: string }[] = [
  { value: 'build_muscle', label: 'Build Muscle' },
  { value: 'get_stronger', label: 'Get Stronger' },
  { value: 'lose_fat', label: 'Lose Fat' },
  { value: 'improve_fitness', label: 'Improve Fitness' },
  { value: 'improve_athletic_performance', label: 'Improve Athletic Performance' },
  { value: 'maintain_fitness', label: 'Maintain Fitness' },
  { value: 'general_health', label: 'General Health' },
  { value: 'other', label: 'Other' },
];

// "How comfortable are you with planning and progressing your workouts?" -- replaced the old
// experience (Beginner/Intermediate/Advanced) and training-style (Guided/Build My Own)
// questions, whose answers nothing used. It sets the starting rep range and whether
// progression suggestions come with a one-line why (workouts/progression.ts). Never locks a
// feature or labels anyone; it can be changed in Settings > Workout Preferences.
export const TRAINING_COMFORT_OPTIONS: {
  value: TrainingComfort;
  label: string;
  description: string;
}[] = [
  {
    value: 'still_learning',
    label: "I'm still learning",
    description:
      "I usually choose exercises based on what feels right, and I'm not sure how to track progress.",
  },
  {
    value: 'knows_basics',
    label: 'I know the basics, but need guidance',
    description:
      "I understand sets and reps, but I'm not always sure when to increase weight or change my approach.",
  },
  {
    value: 'plans_and_progresses',
    label: 'I can plan and progress my training',
    description:
      'I follow a structured routine, track my performance, and know when and how to progress.',
  },
  {
    value: 'follows_method',
    label: 'I follow a specific training method',
    description:
      'I use planned progression, RPE/RIR, percentages, periodization, or programming from a coach.',
  },
];

export const WORKOUT_FREQUENCY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '1-2 days' },
  { value: 3, label: '3 days' },
  { value: 4, label: '4 days' },
  { value: 5, label: '5 days' },
  { value: 6, label: '6 days' },
  { value: 7, label: '7 days' },
];

export const REFERRAL_SOURCE_OPTIONS: { value: ReferralSource; label: string }[] = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'friend', label: 'A friend' },
  { value: 'app_store', label: 'App Store' },
  { value: 'google_search', label: 'Google Search' },
  { value: 'creator', label: 'A creator' },
  { value: 'other', label: 'Somewhere else' },
];

export const AVERAGE_WORKOUT_LENGTH_OPTIONS: { value: AverageWorkoutLength; label: string }[] = [
  { value: '20_30', label: '20-30 min' },
  { value: '30_45', label: '30-45 min' },
  { value: '45_60', label: '45-60 min' },
  { value: '60_plus', label: '60+ min' },
];
