import type { WorkoutProgram } from '../programTypes';

// Made-up programs for the tests only -- never part of the app's catalogue (programCatalog.ts),
// whose programs are written by hand. The exercises are real built-ins so every page can show
// them; the days, sets and reps mean nothing.

export const TEST_PROGRAM: WorkoutProgram = {
  id: 'test-split',
  name: 'Test Split',
  style: 'Balanced',
  description: 'A program made up for the tests.',
  levels: ['beginner', 'intermediate', 'advanced'],
  goals: ['build_muscle', 'get_stronger'],
  focuses: ['full_body'],
  tags: ['Tag One', 'Tag Two'],
  badge: 'Popular',
  benefits: ['Benefit one', 'Benefit two'],
  guidance: { progression: ['The program says this about progression.'] },
  variations: [
    {
      id: 'three-balanced',
      schedule: '3-Day',
      scheduleNote: 'Standard',
      focus: 'Balanced',
      focusNote: 'A note on the balanced focus.',
      default: true,
      note: 'A note on the three-day schedule.',
      days: [
        {
          name: 'Push',
          muscleGroups: ['chest', 'shoulders', 'triceps'],
          exercises: [
            {
              slug: 'bb-bench-press',
              sets: 3,
              reps: { min: 6, max: 8 },
              restSeconds: 120,
              note: 'A note on this exercise.',
              tips: ['A tip from the program.'],
              alternatives: ['db-bench-press'],
            },
            { slug: 'db-lateral-raise', sets: 3, reps: { min: 12, max: 15 } },
          ],
        },
        {
          name: 'Pull',
          muscleGroups: ['back', 'biceps'],
          exercises: [
            { slug: 'db-bent-over-row', sets: 4, reps: 10 },
            { slug: 'db-curl', sets: 2, seconds: { min: 30, max: 45 } },
          ],
        },
        {
          name: 'Legs',
          muscleGroups: ['quads', 'hamstrings', 'glutes'],
          exercises: [{ slug: 'db-goblet-squat', sets: 3, reps: 12 }],
        },
      ],
    },
    {
      id: 'three-strength',
      schedule: '3-Day',
      focus: 'Strength Focus',
      focusNote: 'A note on the strength focus.',
      days: [
        {
          name: 'Push',
          muscleGroups: ['chest'],
          exercises: [{ slug: 'bb-bench-press', sets: 5, reps: 5 }],
        },
        {
          name: 'Pull',
          muscleGroups: ['back'],
          exercises: [{ slug: 'db-bent-over-row', sets: 5, reps: 5 }],
        },
        {
          name: 'Legs',
          muscleGroups: ['quads'],
          exercises: [{ slug: 'bb-back-squat', sets: 5, reps: 5 }],
        },
      ],
    },
    {
      id: 'six',
      schedule: '6-Day',
      scheduleNote: 'High Volume',
      days: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'].map((name) => ({
        name,
        muscleGroups: ['chest' as const],
        exercises: [{ slug: 'db-bench-press', sets: 3, reps: 10 }],
      })),
    },
  ],
};

export const SECOND_PROGRAM: WorkoutProgram = {
  id: 'second-program',
  name: 'Second Program',
  style: 'Efficient',
  description: 'Another made-up program.',
  levels: ['beginner'],
  goals: ['lose_fat'],
  focuses: ['lower_body'],
  variations: [
    {
      id: 'four',
      schedule: '4-Day',
      days: ['A', 'B', 'C', 'D'].map((name) => ({
        name,
        muscleGroups: ['glutes' as const],
        exercises: [{ slug: 'db-goblet-squat', sets: 3, reps: 10 }],
      })),
    },
  ],
};
