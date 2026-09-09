import type {
  AppleHealthPreference,
  FitnessGoal,
  Gender,
  TrainingExperience,
  TrainingStylePreference,
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

export const TRAINING_EXPERIENCE_OPTIONS: { value: TrainingExperience; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export const WORKOUT_FREQUENCY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '1-2 days' },
  { value: 3, label: '3 days' },
  { value: 4, label: '4 days' },
  { value: 5, label: '5 days' },
  { value: 6, label: '6 days' },
  { value: 7, label: '7 days' },
];

export const TRAINING_STYLE_OPTIONS: {
  value: TrainingStylePreference;
  label: string;
  description: string;
}[] = [
  {
    value: 'guided',
    label: 'Guided',
    description: 'Let Progresso help guide your workouts and training structure.',
  },
  {
    value: 'build_your_own',
    label: 'Build My Own',
    description: 'I want complete control over my workouts and exercises.',
  },
];

export const APPLE_HEALTH_PREFERENCE_VALUES: AppleHealthPreference[] = ['connected', 'not_now'];
