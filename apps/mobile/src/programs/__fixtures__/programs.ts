import type { ProgramVariation, VariationProfile, WorkoutProgram } from '../programTypes';

// Made-up programs for the tests only -- never part of the app's catalogue (programCatalog.ts),
// whose programs are written by hand. The exercises are real built-ins so every page can show
// them; the days, sets and reps mean nothing.

const PROFILE: VariationProfile = {
  categories: ['traditional'],
  style: 'general',
  goals: ['build_muscle', 'get_stronger'],
  levels: ['beginner', 'intermediate', 'advanced'],
  equipment: 'full_gym',
  emphasis: [],
  excludes: [],
};

/** A variation with the fixture's profile, changed where given; its days a week its days. */
function variation(
  made: Omit<ProgramVariation, keyof VariationProfile | 'daysPerWeek'> & Partial<VariationProfile>,
): ProgramVariation {
  return { ...PROFILE, ...made, daysPerWeek: made.days.length };
}

export const TEST_PROGRAM: WorkoutProgram = {
  id: 'test-split',
  name: 'Test Split',
  description: 'A program made up for the tests.',
  tags: ['Tag One', 'Tag Two'],
  badge: 'Popular',
  benefits: ['Benefit one', 'Benefit two'],
  guidance: { progression: ['The program says this about progression.'] },
  variations: [
    variation({
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
    }),
    variation({
      id: 'three-strength',
      schedule: '3-Day',
      focus: 'Strength Focus',
      focusNote: 'A note on the strength focus.',
      style: 'strength',
      goals: ['get_stronger'],
      levels: ['intermediate', 'advanced'],
      categories: ['strength'],
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
    }),
    variation({
      id: 'six',
      schedule: '6-Day',
      scheduleNote: 'High Volume',
      days: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'].map((name) => ({
        name,
        muscleGroups: ['chest' as const],
        exercises: [{ slug: 'db-bench-press', sets: 3, reps: 10 }],
      })),
    }),
  ],
};

export const SECOND_PROGRAM: WorkoutProgram = {
  id: 'second-program',
  name: 'Second Program',
  description: 'Another made-up program.',
  variations: [
    variation({
      id: 'four',
      schedule: '4-Day',
      default: true,
      categories: ['specialization'],
      style: 'bodybuilding',
      goals: ['lose_fat', 'build_muscle'],
      levels: ['beginner'],
      equipment: 'dumbbells',
      emphasis: ['glutes'],
      excludes: ['chest'],
      sessionMinutes: { min: 45, max: 60 },
      days: ['A', 'B', 'C', 'D'].map((name) => ({
        name,
        muscleGroups: ['glutes' as const],
        exercises: [{ slug: 'db-goblet-squat', sets: 3, reps: 10 }],
      })),
    }),
  ],
};
