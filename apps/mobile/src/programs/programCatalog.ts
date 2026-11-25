import { assemblePrograms } from './programAssembly';
import { PROGRAM_CONTENT } from './programContent';
import type {
  CatalogProgram,
  CatalogVariation,
  PriorityArea,
  ProgramCategory,
  TrainingExclusion,
  VariationProfile,
  WorkoutProgram,
} from './programTypes';

// Every workout program and variation in Progresso -- what each one is, never its programming:
// Harbir's Workout Split Library, grouped so a genuine variation sits under its parent ("Glute-
// Focused PPL" is Push / Pull / Legs' Glute-Focused variations). How the library lists them --
// his nine sections, each title as he wrote it -- is programLibrary.ts, which points every title
// at its program and variations here. Days a week are the list's: one variation per day count a
// title names ("3 or 6 Days", "3-5 Days"). A variation's profile -- categories, style, goals,
// level, equipment, emphasis, what it leaves out -- is its program's unless it says otherwise;
// goals and style follow the list's own sections (Strength, Hypertrophy, ...), emphasis and
// exclusions the names, and level only where the program's name says who it's for. All of it is
// the author's to change.
//
// One program under two titles in the library (the same split by two names):
// - Chest & Back / Shoulders & Arms / Legs -- the Arnold Split, its No Direct Glutes too.
// - Chest / Back / Shoulders / Arms / Legs (No Direct Glutes) -- Bro Split (No Direct Glutes).
// - Lower Body / Upper Body (No Chest) -- Upper / Lower (No Chest).
// - Upper Body & Glutes -- Glutes & Upper Body.
// - Chest & Arm Specialization -- Chest & Arms Specialization.
// - Three-Day Upper / Lower / Full Body, Three-Day Push / Pull / Legs, Four-Day Upper / Lower and
//   Four-Day Torso / Limbs -- those splits' own schedules.
// - Calisthenics PPL, Upper / Lower and Full Body -- one Calisthenics program's variations.

/** A variation: its id, its days a week, and how it differs from its program. */
function v(id: string, daysPerWeek: number, changes: Partial<CatalogVariation> = {}) {
  return { id, daysPerWeek, ...changes };
}

/** One variation per day count ("3 or 6 Days"), all of one focus: `<prefix>-3-day`, ... */
function schedules(
  prefix: string,
  days: number[],
  changes: Partial<CatalogVariation> = {},
): CatalogVariation[] {
  return days.map((count) => v(prefix ? `${prefix}-${count}-day` : `${count}-day`, count, changes));
}

/** A program's own day counts ("3-4 Days"): `3-day`, `4-day`, the first shown first. */
function dayCounts(days: number[]): CatalogVariation[] {
  return days.map((count, i) => v(`${count}-day`, count, i === 0 ? { default: true } : {}));
}

const focus = (
  label: string,
  more: {
    emphasis?: PriorityArea[];
    excludes?: TrainingExclusion[];
    categories?: ProgramCategory[];
  } & Partial<VariationProfile> = {},
): Partial<CatalogVariation> => ({ focus: label, ...more });

const TRADITIONAL: Pick<VariationProfile, 'categories' | 'style' | 'goals'> = {
  categories: ['traditional'],
  style: 'general',
  goals: ['build_muscle', 'get_stronger', 'improve_fitness'],
};
const SPECIALIZATION: Pick<VariationProfile, 'categories' | 'style' | 'goals'> = {
  categories: ['specialization'],
  style: 'bodybuilding',
  goals: ['build_muscle'],
};
const STRENGTH: Pick<VariationProfile, 'categories' | 'style' | 'goals'> = {
  categories: ['strength'],
  style: 'strength',
  goals: ['get_stronger'],
};
const POWERBUILDING: Pick<VariationProfile, 'categories' | 'style' | 'goals'> = {
  categories: ['strength'],
  style: 'powerbuilding',
  goals: ['get_stronger', 'build_muscle'],
};
const HYPERTROPHY: Pick<VariationProfile, 'categories' | 'style' | 'goals'> = {
  categories: ['hypertrophy'],
  style: 'bodybuilding',
  goals: ['build_muscle'],
};
const TIME_EFFICIENT: Pick<VariationProfile, 'categories' | 'style' | 'goals'> = {
  categories: ['time_efficient'],
  style: 'general',
  goals: ['improve_fitness', 'maintain_fitness', 'lose_fat'],
};
const ATHLETIC: Pick<VariationProfile, 'categories' | 'style' | 'goals'> = {
  categories: ['athletic'],
  style: 'athletic',
  goals: ['improve_athletic_performance', 'improve_fitness'],
};
const HYBRID: Pick<VariationProfile, 'categories' | 'style' | 'goals'> = {
  categories: ['athletic'],
  style: 'hybrid',
  goals: ['improve_fitness', 'improve_athletic_performance'],
};

// A traditional split's variations in the list's other sections.
const asHypertrophy = (label = 'Hypertrophy') => focus(label, HYPERTROPHY);
const asStrength = (label = 'Strength') => focus(label, STRENGTH);
const asTimeEfficient: Partial<CatalogVariation> = {
  categories: ['traditional', 'time_efficient'],
};
const glutes = (label: string) =>
  focus(label, { emphasis: ['glutes'], ...SPECIALIZATION, categories: ['specialization'] });
const noDirectGlutes = (label = 'No Direct Glutes') =>
  focus(label, { excludes: ['glutes'], categories: ['traditional', 'specialization'] });

/** A program of one kind, with the day counts its title names. */
function single(
  id: string,
  name: string,
  profile: CatalogProgram['profile'],
  days: number[],
): CatalogProgram {
  return { id, name, profile, variations: dayCounts(days) };
}

export const PROGRAM_CATALOG: readonly CatalogProgram[] = [
  // ---- Traditional splits (and their variations elsewhere in the library) ----
  {
    id: 'push-pull-legs',
    name: 'Push / Pull / Legs',
    profile: TRADITIONAL,
    variations: [
      v('3-day', 3, { default: true, ...asTimeEfficient }),
      v('6-day', 6),
      v('ab-6-day', 6, focus('A / B')),
      ...schedules('glute-focused', [3, 6], glutes('Glute-Focused')),
      ...schedules('no-direct-glutes', [3, 6], noDirectGlutes()),
      v('high-volume', 6, asHypertrophy('High Volume')),
      ...schedules('low-volume', [3, 6], asHypertrophy('Low Volume')),
      ...schedules('hypertrophy', [3, 6], asHypertrophy()),
    ],
  },
  {
    id: 'arnold-split',
    name: 'Arnold Split',
    profile: TRADITIONAL,
    variations: [
      v('3-day', 3, { default: true }),
      v('6-day', 6),
      ...schedules('glute-focused', [3, 6], glutes('Glute-Focused')),
      ...schedules('no-direct-glutes', [3, 6], noDirectGlutes()),
      v('hypertrophy', 6, asHypertrophy()),
    ],
  },
  {
    id: 'upper-lower',
    name: 'Upper / Lower',
    profile: TRADITIONAL,
    variations: [
      v('2-day', 2, asTimeEfficient),
      v('4-day', 4, { default: true, ...asTimeEfficient }),
      v('ab-4-day', 4, focus('A / B')),
      // The Upper / Lower variations, every one 4 days a week.
      ...(
        [
          ['balanced-development', 'Balanced Development', [], []],
          ['chest-emphasis', 'Chest Emphasis', ['chest'], []],
          ['back-emphasis', 'Back Emphasis', ['back'], []],
          ['shoulder-emphasis', 'Shoulder Emphasis', ['shoulders'], []],
          ['arms-emphasis', 'Arms Emphasis', ['arms'], []],
          ['no-chest', 'No Chest', [], ['chest']],
          ['no-direct-glutes', 'No Direct Glutes', [], ['glutes']],
          ['no-direct-chest-or-glutes', 'No Direct Chest or Glutes', [], ['chest', 'glutes']],
          ['back-arms-emphasis', 'Back & Arms Emphasis', ['back', 'arms'], []],
          ['shoulders-arms-emphasis', 'Shoulders & Arms Emphasis', ['shoulders', 'arms'], []],
          ['lower-body-emphasis', 'Lower Body Emphasis', ['legs', 'glutes'], []],
          ['quad-emphasis', 'Quad Emphasis', ['legs'], []],
          ['hamstring-emphasis', 'Hamstring Emphasis', ['legs'], []],
          ['glute-emphasis', 'Glute Emphasis', ['glutes'], []],
          [
            'chest-emphasis-no-direct-glutes',
            'Chest Emphasis, No Direct Glutes',
            ['chest'],
            ['glutes'],
          ],
        ] as [string, string, PriorityArea[], TrainingExclusion[]][]
      ).map(([id, label, emphasis, excludes]) =>
        v(id, 4, focus(label, { emphasis, excludes, categories: ['upper_lower'] })),
      ),
      v('strength', 4, asStrength()),
      v('powerbuilding', 4, focus('Powerbuilding', POWERBUILDING)),
      v('hypertrophy', 4, asHypertrophy()),
      ...schedules('high-frequency', [5, 6], asHypertrophy('High Frequency')),
      v('athletic', 4, focus('Athletic', ATHLETIC)),
    ],
  },
  {
    id: 'full-body',
    name: 'Full Body',
    profile: {
      ...TRADITIONAL,
      goals: ['build_muscle', 'get_stronger', 'improve_fitness', 'lose_fat'],
    },
    variations: [
      v('2-day', 2, asTimeEfficient),
      v('3-day', 3, { default: true, ...asTimeEfficient }),
      v('4-day', 4),
      v('ab-2-day', 2, { ...focus('A / B'), ...asTimeEfficient }),
      v('ab-3-day', 3, focus('A / B')),
      v('abc-3-day', 3, focus('A / B / C')),
      v('strength', 3, asStrength()),
      v('hypertrophy', 3, asHypertrophy()),
      ...schedules('high-frequency', [4, 5], asHypertrophy('High Frequency')),
      v('athletic', 3, focus('Athletic', ATHLETIC)),
    ],
  },
  {
    id: 'bro-split',
    name: 'Bro Split',
    profile: TRADITIONAL,
    variations: [
      v('5-day', 5, { default: true }),
      v('no-direct-glutes', 5, noDirectGlutes()),
      v('hypertrophy', 5, asHypertrophy()),
    ],
  },
  {
    id: 'push-pull',
    name: 'Push / Pull',
    profile: TRADITIONAL,
    variations: [
      v('2-day', 2, asTimeEfficient),
      v('4-day', 4, { default: true }),
      v('strength', 4, asStrength()),
    ],
  },
  {
    id: 'upper-lower-full-body',
    name: 'Upper / Lower / Full Body',
    profile: TRADITIONAL,
    variations: [
      v('3-day', 3, { default: true, ...asTimeEfficient }),
      v('ab-5-day', 5, focus('A / B')),
    ],
  },
  single('push-pull-legs-upper-lower', 'Push / Pull / Legs / Upper / Lower', TRADITIONAL, [5]),
  {
    id: 'torso-limbs',
    name: 'Torso / Limbs',
    profile: TRADITIONAL,
    variations: [
      v('4-day', 4, { default: true, ...asTimeEfficient }),
      v('hypertrophy', 4, asHypertrophy()),
    ],
  },
  single('upper-lower-upper-full-body', 'Upper / Lower / Upper / Full Body', TRADITIONAL, [4]),

  // ---- Glute-focused, upper-body and preference-based, and muscle specialization ----
  ...(
    [
      ['glutes-upper-body', 'Glutes & Upper Body', ['glutes'], [], [3]],
      ['glutes-legs', 'Glutes & Legs Focus', ['glutes', 'legs'], [], [4]],
      ['glute-specialization', 'Glute Specialization', ['glutes'], [], [3, 4, 5]],
      ['glutes-hamstrings', 'Glutes & Hamstrings Focus', ['glutes', 'legs'], [], [4]],
      ['glutes-quads', 'Glutes & Quads Focus', ['glutes', 'legs'], [], [4]],
      ['glutes-back-arms', 'Glutes, Back & Arms', ['glutes', 'back', 'arms'], [], [4]],
      [
        'glutes-shoulders-arms',
        'Glutes, Shoulders & Arms',
        ['glutes', 'shoulders', 'arms'],
        [],
        [4],
      ],
      ['glutes-back', 'Glutes & Back Emphasis', ['glutes', 'back'], [], [4]],
      ['lower-body-dominant', 'Lower Body Dominant', ['legs', 'glutes'], [], [4]],
      ['legs-upper-body-no-chest', 'Legs & Upper Body (No Chest)', ['legs'], ['chest'], [4]],
      ['glutes-back-core', 'Glutes, Back & Core', ['glutes', 'back', 'core'], [], [4]],
      ['glutes-legs-core', 'Glutes, Legs & Core', ['glutes', 'legs', 'core'], [], [4]],
      ['glutes-upper-lower', 'Glutes / Upper / Lower', ['glutes'], [], [3]],
      [
        'glutes-back-arms-legs-shoulders-arms',
        'Glutes / Back & Arms / Legs / Shoulders & Arms',
        ['glutes', 'back', 'arms', 'shoulders'],
        [],
        [4],
      ],
      [
        'glutes-back-biceps-quads-hamstrings-shoulders-arms',
        'Glutes / Back & Biceps / Quads / Hamstrings & Glutes / Shoulders & Arms',
        ['glutes', 'back', 'arms', 'legs', 'shoulders'],
        [],
        [5],
      ],
      ['chest-back-emphasis', 'Chest & Back Emphasis', ['chest', 'back'], [], [4]],
      ['chest-shoulders-arms', 'Chest, Shoulders & Arms', ['chest', 'shoulders', 'arms'], [], [3]],
      ['back-arms-emphasis', 'Back & Arms Emphasis', ['back', 'arms'], [], [3]],
      ['chest-arms-specialization', 'Chest & Arms Specialization', ['chest', 'arms'], [], [4]],
      [
        'upper-body-specialization',
        'Upper Body Specialization',
        ['chest', 'back', 'shoulders', 'arms'],
        [],
        [4, 5],
      ],
      ['upper-body-only', 'Upper Body Only', ['chest', 'back', 'shoulders', 'arms'], [], [3, 4, 5]],
      [
        'chest-back-shoulders-arms',
        'Chest / Back / Shoulders / Arms',
        ['chest', 'back', 'shoulders', 'arms'],
        [],
        [4],
      ],
      ['chest-back-arms', 'Chest / Back / Arms', ['chest', 'back', 'arms'], [], [3]],
      [
        'push-pull-upper-no-direct-glutes',
        'Push / Pull / Upper (No Direct Glutes)',
        [],
        ['glutes'],
        [3],
      ],
      ['upper-body-quads-hamstrings', 'Upper Body / Quads & Hamstrings', ['legs'], [], [3]],
      [
        'chest-triceps-back-biceps-shoulders-legs',
        'Chest & Triceps / Back & Biceps / Shoulders / Legs',
        [],
        [],
        [4],
      ],
      ['back-chest-arms-shoulders-legs', 'Back & Chest / Arms / Shoulders / Legs', [], [], [4]],
      [
        'back-shoulders-arms-no-chest',
        'Back, Shoulders & Arms (No Chest)',
        ['back', 'shoulders', 'arms'],
        ['chest'],
        [3],
      ],
      ['quad-specialization', 'Quad Specialization', ['legs'], [], [3, 4]],
      ['hamstring-specialization', 'Hamstring Specialization', ['legs'], [], [3, 4]],
      ['calf-specialization', 'Calf Specialization', ['legs'], [], [3, 4]],
      ['chest-specialization', 'Chest Specialization', ['chest'], [], [3, 4]],
      ['back-specialization', 'Back Specialization', ['back'], [], [3, 4]],
      ['shoulder-specialization', 'Shoulder Specialization', ['shoulders'], [], [3, 4]],
      ['biceps-specialization', 'Biceps Specialization', ['arms'], [], [3, 4]],
      ['triceps-specialization', 'Triceps Specialization', ['arms'], [], [3, 4]],
      ['arm-specialization', 'Arm Specialization', ['arms'], [], [3, 4]],
      ['forearm-specialization', 'Forearm Specialization', ['arms'], [], [3]],
      ['core-specialization', 'Core Specialization', ['core'], [], [3, 4]],
      ['lower-body-specialization', 'Lower Body Specialization', ['legs', 'glutes'], [], [4, 5]],
      [
        'posterior-chain-specialization',
        'Posterior Chain Specialization',
        ['back', 'glutes', 'legs'],
        [],
        [3, 4],
      ],
      [
        'anterior-chain-specialization',
        'Anterior Chain Specialization',
        ['chest', 'core', 'legs'],
        [],
        [3, 4],
      ],
      ['v-taper-specialization', 'V-Taper Specialization', ['back', 'shoulders'], [], [4]],
      [
        'back-shoulder-specialization',
        'Back & Shoulder Specialization',
        ['back', 'shoulders'],
        [],
        [4],
      ],
    ] as [string, string, PriorityArea[], TrainingExclusion[], number[]][]
  ).map(([id, name, emphasis, excludes, days]): CatalogProgram =>
    single(id, name, { ...SPECIALIZATION, emphasis, excludes }, days),
  ),
  single(
    'pilates-strength-hybrid',
    'Pilates & Strength Hybrid',
    {
      categories: ['specialization', 'athletic'],
      style: 'hybrid',
      goals: ['improve_fitness', 'build_muscle'],
      emphasis: ['core'],
    },
    [4],
  ),

  // ---- Strength training ----
  single(
    'powerlifting-split',
    'Powerlifting Split',
    { ...STRENGTH, levels: ['intermediate', 'advanced'] },
    [3, 4],
  ),
  single('squat-bench-deadlift', 'Squat / Bench / Deadlift', STRENGTH, [3, 6]),
  ...(
    [
      ['powerbuilding', 'Powerbuilding', POWERBUILDING, [], [4, 5]],
      ['phul', 'PHUL', POWERBUILDING, ['intermediate', 'advanced'], [4]],
      ['phat', 'PHAT', POWERBUILDING, ['advanced'], [5]],
      ['five-three-one', '5/3/1-Inspired Training', STRENGTH, ['intermediate', 'advanced'], [3, 4]],
      ['stronglifts-full-body', 'StrongLifts-Inspired Full Body', STRENGTH, ['beginner'], [3]],
      [
        'starting-strength-full-body',
        'Starting Strength-Inspired Full Body',
        STRENGTH,
        ['beginner'],
        [3],
      ],
      ['texas-method', 'Texas Method-Inspired Training', STRENGTH, ['intermediate'], [3]],
      [
        'dup',
        'DUP (Daily Undulating Periodization)',
        STRENGTH,
        ['intermediate', 'advanced'],
        [3, 4, 5, 6],
      ],
      ['strength-hypertrophy-hybrid', 'Strength & Hypertrophy Hybrid', POWERBUILDING, [], [4, 5]],
    ] as [string, string, typeof STRENGTH, VariationProfile['levels'], number[]][]
  ).map(([id, name, profile, levels, days]): CatalogProgram =>
    single(id, name, { ...profile, levels }, days),
  ),

  // ---- Hypertrophy and bodybuilding ----
  ...(
    [
      ['classic-bodybuilding', 'Classic Bodybuilding Split', [], [5]],
      ['chest-back-legs-arms-shoulders', 'Chest & Back / Legs / Arms & Shoulders', [], [4]],
      ['upper-lower-arms', 'Upper / Lower / Arms', ['arms'], [5]],
      ['chest-back-legs-shoulders-arms', 'Chest / Back / Legs / Shoulders / Arms', [], [5]],
    ] as [string, string, PriorityArea[], number[]][]
  ).map(([id, name, emphasis, days]): CatalogProgram =>
    single(id, name, { ...HYPERTROPHY, emphasis }, days),
  ),

  // ---- Time-efficient training (the rest are their traditional splits' schedules) ----
  single('upper-body-lower-body-emphasis', 'Upper Body & Lower Body Emphasis', TIME_EFFICIENT, [3]),

  // ---- Athletic and hybrid ----
  ...(
    [
      [
        'strength-conditioning',
        'Strength & Conditioning',
        { ...ATHLETIC, goals: ['improve_athletic_performance', 'get_stronger'] },
        [3, 4],
      ],
      ['hybrid-athlete', 'Hybrid Athlete', HYBRID, [4, 5]],
      ['running-strength-hybrid', 'Running & Strength Hybrid', HYBRID, [4, 5]],
      ['cycling-strength-hybrid', 'Cycling & Strength Hybrid', HYBRID, [4, 5]],
      [
        'functional-fitness',
        'Functional Fitness',
        { ...ATHLETIC, goals: ['improve_fitness'] },
        [3, 4, 5],
      ],
      ['athletic-performance', 'Athletic Performance', ATHLETIC, [3, 4, 5]],
      [
        'strength-cardio',
        'Strength & Cardio',
        { ...HYBRID, goals: ['improve_fitness', 'lose_fat'] },
        [4, 5],
      ],
      [
        'mobility-strength-hybrid',
        'Mobility & Strength Hybrid',
        { ...HYBRID, goals: ['improve_fitness', 'maintain_fitness'] },
        [3, 4],
      ],
    ] as [string, string, typeof ATHLETIC, number[]][]
  ).map(([id, name, profile, days]): CatalogProgram => single(id, name, profile, days)),
  {
    id: 'calisthenics',
    name: 'Calisthenics',
    profile: {
      categories: ['athletic'],
      style: 'calisthenics',
      goals: ['build_muscle', 'improve_fitness'],
      equipment: 'bodyweight',
    },
    variations: [
      ...schedules('ppl', [3, 6], focus('Push / Pull / Legs')),
      v('upper-lower', 4, focus('Upper / Lower')),
      v('full-body', 3, { ...focus('Full Body'), default: true }),
    ],
  },
];

/** The programs the app shows: those with programming in (programAssembly.ts). */
export const WORKOUT_PROGRAMS: readonly WorkoutProgram[] = assemblePrograms(
  PROGRAM_CATALOG,
  PROGRAM_CONTENT,
);
