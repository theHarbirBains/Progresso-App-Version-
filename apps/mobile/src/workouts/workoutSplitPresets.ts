import type { SplitMuscleGroup } from './splitMuscleGroups';

export interface WorkoutSplitPresetDay {
  name: string;
  muscleGroups: SplitMuscleGroup[];
}

export interface WorkoutSplitPreset {
  /** Stable local identifier for this template -- never a database id. */
  id: string;
  name: string;
  days: WorkoutSplitPresetDay[];
}

// Reusable templates, not stored user data (see workoutSplitQueries.ts's
// materializeWorkoutSplitPreset, which deep-copies one of these into a real,
// editable, user-owned split). Names are deliberately generic -- no
// "Hypertrophy"/"Strength"/"Cutting"/"Bulking" -- since the same split can
// serve any of those goals. Each day lists a muscle group at most once
// (the general split_muscle_group vocabulary -- see splitMuscleGroups.ts).
export const WORKOUT_SPLIT_PRESETS: WorkoutSplitPreset[] = [
  {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    days: [
      { name: 'Push', muscleGroups: ['chest', 'shoulders', 'triceps'] },
      { name: 'Pull', muscleGroups: ['back', 'shoulders', 'biceps'] },
      { name: 'Legs', muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves'] },
    ],
  },
  {
    id: 'upper-lower',
    name: 'Upper / Lower',
    days: [
      {
        name: 'Upper',
        muscleGroups: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
      },
      { name: 'Lower', muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves'] },
    ],
  },
  {
    id: 'full-body',
    name: 'Full Body',
    days: [
      {
        name: 'Full Body',
        muscleGroups: [
          'chest',
          'back',
          'shoulders',
          'biceps',
          'triceps',
          'quads',
          'hamstrings',
          'glutes',
          'calves',
        ],
      },
    ],
  },
  {
    id: 'bro-split',
    name: 'Bro Split',
    days: [
      { name: 'Chest', muscleGroups: ['chest'] },
      { name: 'Back', muscleGroups: ['back'] },
      { name: 'Shoulders', muscleGroups: ['shoulders'] },
      { name: 'Arms', muscleGroups: ['biceps', 'triceps', 'forearms'] },
      { name: 'Legs', muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves'] },
    ],
  },
  {
    id: 'ppl-upper-lower',
    name: 'Push / Pull / Legs / Upper / Lower',
    days: [
      { name: 'Push', muscleGroups: ['chest', 'shoulders', 'triceps'] },
      { name: 'Pull', muscleGroups: ['back', 'shoulders', 'biceps'] },
      { name: 'Legs', muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves'] },
      {
        name: 'Upper',
        muscleGroups: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
      },
      { name: 'Lower', muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves'] },
    ],
  },
];
