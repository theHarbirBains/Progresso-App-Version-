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
// Harbir's list, grouped so a genuine variation sits under its parent rather than being listed
// twice. Days a week are the ones the list names; where it names none, the variation's own days
// (programContent.ts) decide. A variation's profile -- categories, style, goals, level, equipment,
// emphasis, what it leaves out -- is its program's unless it says otherwise; goals and style follow
// the list's own sections (Strength, Hypertrophy, ...), emphasis and exclusions the names, and
// level only where the program's name says who it's for. All of it is the author's to change.
//
// Merged as one (the same program by two names in the list):
// - Chest & Back / Shoulders & Arms / Legs -- the Arnold Split's days; its No Direct Glutes too.
// - Chest / Back / Shoulders / Arms / Legs (No Direct Glutes) -- Bro Split (No Direct Glutes).
// - Upper / Lower (No Direct Glutes) and Lower Body / Upper Body (No Chest) -- Upper / Lower's own.
// - Back & Arms Emphasis (in both lists) -- Upper / Lower's.
// - Upper Body & Glutes (3-Day) -- Glutes & Upper Body, 3-day.
// - The Time-Efficient list's Three-Day PPL, Three-Day Upper / Lower / Full Body, Four-Day
//   Upper / Lower, Four-Day Torso / Limbs, Full Body (2, 3-Day), Upper / Lower (2-Day),
//   Push / Pull (2-Day), Full Body A / B (2-Day) -- the same variations, in that category too.
// - Calisthenics PPL, Upper / Lower and Full Body -- one Calisthenics program's variations.

/** A variation: its id, days a week where the list names them, and how it differs. */
function v(id: string, daysPerWeek?: number, changes: Partial<CatalogVariation> = {}) {
  return { id, ...(daysPerWeek !== undefined ? { daysPerWeek } : {}), ...changes };
}

/** One variation per schedule the list names ("3-Day, 6-Day"), all of one focus. */
function schedules(
  prefix: string,
  days: number[],
  changes: Partial<CatalogVariation> = {},
): CatalogVariation[] {
  return days.map((count) => v(prefix ? `${prefix}-${count}-day` : `${count}-day`, count, changes));
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

export const PROGRAM_CATALOG: readonly CatalogProgram[] = [
  // ---- Traditional splits (and their variations elsewhere in the list) ----
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
      v('high-volume', undefined, asHypertrophy('High Volume')),
      ...schedules('low-volume', [3, 6], asHypertrophy('Low Volume')),
      v('hypertrophy', undefined, asHypertrophy()),
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
      v('hypertrophy', undefined, asHypertrophy()),
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
      // The Upper / Lower variations.
      ...(
        [
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
          ['balanced-development', 'Balanced Development', [], []],
          [
            'chest-emphasis-no-direct-glutes',
            'Chest Emphasis, No Direct Glutes',
            ['chest'],
            ['glutes'],
          ],
        ] as [string, string, PriorityArea[], TrainingExclusion[]][]
      ).map(([id, label, emphasis, excludes]) =>
        v(id, undefined, focus(label, { emphasis, excludes, categories: ['upper_lower'] })),
      ),
      v('strength', undefined, asStrength()),
      v('powerbuilding', undefined, focus('Powerbuilding', POWERBUILDING)),
      v('hypertrophy', undefined, asHypertrophy()),
      v('high-frequency', undefined, asHypertrophy('High Frequency')),
      v('athletic', undefined, focus('Athletic', ATHLETIC)),
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
      v('strength', undefined, asStrength()),
      v('hypertrophy', undefined, asHypertrophy()),
      v('high-frequency', undefined, asHypertrophy('High Frequency')),
      v('athletic', undefined, focus('Athletic', ATHLETIC)),
    ],
  },
  {
    id: 'bro-split',
    name: 'Bro Split',
    profile: TRADITIONAL,
    variations: [
      v('5-day', 5, { default: true }),
      v('no-direct-glutes', undefined, noDirectGlutes()),
      v('hypertrophy', undefined, asHypertrophy()),
    ],
  },
  {
    id: 'push-pull',
    name: 'Push / Pull',
    profile: TRADITIONAL,
    variations: [
      v('2-day', 2, asTimeEfficient),
      v('4-day', 4, { default: true }),
      v('strength', undefined, asStrength()),
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
  {
    id: 'push-pull-legs-upper-lower',
    name: 'Push / Pull / Legs / Upper / Lower',
    profile: TRADITIONAL,
    variations: [v('5-day', 5, { default: true })],
  },
  {
    id: 'torso-limbs',
    name: 'Torso / Limbs',
    profile: TRADITIONAL,
    variations: [
      v('4-day', 4, { default: true, ...asTimeEfficient }),
      v('hypertrophy', undefined, asHypertrophy()),
    ],
  },
  {
    id: 'upper-lower-upper-full-body',
    name: 'Upper / Lower / Upper / Full Body',
    profile: TRADITIONAL,
    variations: [v('4-day', 4, { default: true })],
  },

  // ---- Muscle specialization and preference-based splits ----
  ...(
    [
      ['glutes-upper-body', 'Glutes & Upper Body', ['glutes'], [], [3]],
      ['glutes-legs', 'Glutes & Legs Focus', ['glutes', 'legs'], [], []],
      ['glute-specialization', 'Glute Specialization', ['glutes'], [], [3, 4, 5]],
      ['glutes-hamstrings', 'Glutes & Hamstrings Focus', ['glutes', 'legs'], [], []],
      ['glutes-quads', 'Glutes & Quads Focus', ['glutes', 'legs'], [], []],
      ['glutes-back-arms', 'Glutes, Back & Arms', ['glutes', 'back', 'arms'], [], []],
      [
        'glutes-shoulders-arms',
        'Glutes, Shoulders & Arms',
        ['glutes', 'shoulders', 'arms'],
        [],
        [],
      ],
      ['glutes-back', 'Glutes & Back Emphasis', ['glutes', 'back'], [], []],
      ['lower-body-dominant', 'Lower Body Dominant', ['legs', 'glutes'], [], []],
      ['legs-upper-body-no-chest', 'Legs & Upper Body (No Chest)', ['legs'], ['chest'], []],
      [
        'back-shoulders-arms-no-chest',
        'Back, Shoulders & Arms (No Chest)',
        ['back', 'shoulders', 'arms'],
        ['chest'],
        [],
      ],
      ['glutes-back-core', 'Glutes, Back & Core', ['glutes', 'back', 'core'], [], []],
      ['glutes-legs-core', 'Glutes, Legs & Core', ['glutes', 'legs', 'core'], [], []],
      ['glutes-upper-lower', 'Glutes / Upper / Lower', ['glutes'], [], []],
      [
        'glutes-back-arms-legs-shoulders-arms',
        'Glutes / Back & Arms / Legs / Shoulders & Arms',
        ['glutes', 'back', 'arms', 'shoulders'],
        [],
        [],
      ],
      [
        'glutes-back-biceps-quads-hamstrings-shoulders-arms',
        'Glutes / Back & Biceps / Quads / Hamstrings & Glutes / Shoulders & Arms',
        ['glutes', 'back', 'arms', 'legs', 'shoulders'],
        [],
        [],
      ],
      [
        'push-pull-upper-no-direct-glutes',
        'Push / Pull / Upper (No Direct Glutes)',
        [],
        ['glutes'],
        [],
      ],
      ['chest-back-emphasis', 'Chest & Back Emphasis', ['chest', 'back'], [], []],
      ['chest-shoulders-arms', 'Chest, Shoulders & Arms', ['chest', 'shoulders', 'arms'], [], []],
      ['chest-arms-specialization', 'Chest & Arms Specialization', ['chest', 'arms'], [], []],
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
        [],
      ],
      ['chest-back-arms', 'Chest / Back / Arms', ['chest', 'back', 'arms'], [], []],
      ['upper-body-quads-hamstrings', 'Upper Body / Quads & Hamstrings', ['legs'], [], []],
      [
        'chest-triceps-back-biceps-shoulders-legs',
        'Chest & Triceps / Back & Biceps / Shoulders / Legs',
        [],
        [],
        [],
      ],
      ['back-chest-arms-shoulders-legs', 'Back & Chest / Arms / Shoulders / Legs', [], [], []],
    ] as [string, string, PriorityArea[], TrainingExclusion[], number[]][]
  ).map(([id, name, emphasis, excludes, days]): CatalogProgram => ({
    id,
    name,
    profile: { ...SPECIALIZATION, emphasis, excludes },
    variations:
      days.length > 0
        ? days.map((count, i) => v(`${count}-day`, count, i === 0 ? { default: true } : {}))
        : [v('standard', undefined, { default: true })],
  })),
  {
    id: 'pilates-strength-hybrid',
    name: 'Pilates & Strength Hybrid',
    profile: {
      categories: ['specialization', 'athletic'],
      style: 'hybrid',
      goals: ['improve_fitness', 'build_muscle'],
      emphasis: ['core'],
    },
    variations: [v('4-day', 4, { default: true })],
  },

  // ---- Strength training ----
  {
    id: 'powerlifting-split',
    name: 'Powerlifting Split',
    profile: { ...STRENGTH, levels: ['intermediate', 'advanced'] },
    variations: [v('standard', undefined, { default: true })],
  },
  {
    id: 'squat-bench-deadlift',
    name: 'Squat / Bench / Deadlift',
    profile: STRENGTH,
    variations: [v('3-day', 3, { default: true }), v('6-day', 6)],
  },
  ...(
    [
      ['powerbuilding', 'Powerbuilding', POWERBUILDING, []],
      ['phul', 'PHUL', POWERBUILDING, ['intermediate', 'advanced']],
      ['phat', 'PHAT', POWERBUILDING, ['advanced']],
      ['five-three-one', '5/3/1-Inspired Training', STRENGTH, ['intermediate', 'advanced']],
      ['stronglifts-full-body', 'StrongLifts-Inspired Full Body', STRENGTH, ['beginner']],
      [
        'starting-strength-full-body',
        'Starting Strength-Inspired Full Body',
        STRENGTH,
        ['beginner'],
      ],
      ['texas-method', 'Texas Method-Inspired Training', STRENGTH, ['intermediate']],
      ['dup', 'DUP (Daily Undulating Periodization)', STRENGTH, ['intermediate', 'advanced']],
      ['strength-hypertrophy-hybrid', 'Strength & Hypertrophy Hybrid', POWERBUILDING, []],
    ] as [string, string, typeof STRENGTH, VariationProfile['levels']][]
  ).map(([id, name, profile, levels]): CatalogProgram => ({
    id,
    name,
    profile: { ...profile, levels },
    variations: [v('standard', undefined, { default: true })],
  })),

  // ---- Hypertrophy and bodybuilding ----
  ...(
    [
      ['classic-bodybuilding', 'Classic Bodybuilding Split', []],
      ['chest-back-legs-arms-shoulders', 'Chest & Back / Legs / Arms & Shoulders', []],
      ['upper-lower-arms', 'Upper / Lower / Arms', ['arms']],
      ['chest-back-legs-shoulders-arms', 'Chest / Back / Legs / Shoulders / Arms', []],
    ] as [string, string, PriorityArea[]][]
  ).map(([id, name, emphasis]): CatalogProgram => ({
    id,
    name,
    profile: { ...HYPERTROPHY, emphasis },
    variations: [v('standard', undefined, { default: true })],
  })),

  // ---- Time-efficient training (the rest are their traditional splits' variations) ----
  {
    id: 'upper-body-lower-body-emphasis',
    name: 'Upper Body & Lower Body Emphasis',
    profile: TIME_EFFICIENT,
    variations: [v('3-day', 3, { default: true })],
  },

  // ---- Athletic and hybrid ----
  ...(
    [
      [
        'strength-conditioning',
        'Strength & Conditioning',
        { ...ATHLETIC, goals: ['improve_athletic_performance', 'get_stronger'] },
      ],
      ['hybrid-athlete', 'Hybrid Athlete', HYBRID],
      ['running-strength-hybrid', 'Running & Strength Hybrid', HYBRID],
      ['cycling-strength-hybrid', 'Cycling & Strength Hybrid', HYBRID],
      ['functional-fitness', 'Functional Fitness', { ...ATHLETIC, goals: ['improve_fitness'] }],
      ['athletic-performance', 'Athletic Performance', ATHLETIC],
      [
        'strength-cardio',
        'Strength & Cardio',
        { ...HYBRID, goals: ['improve_fitness', 'lose_fat'] },
      ],
      [
        'mobility-strength-hybrid',
        'Mobility & Strength Hybrid',
        { ...HYBRID, goals: ['improve_fitness', 'maintain_fitness'] },
      ],
    ] as [string, string, typeof ATHLETIC][]
  ).map(([id, name, profile]): CatalogProgram => ({
    id,
    name,
    profile,
    variations: [v('standard', undefined, { default: true })],
  })),
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
      v('upper-lower', undefined, focus('Upper / Lower')),
      v('full-body', undefined, { ...focus('Full Body'), default: true }),
    ],
  },
];

/** The programs the app shows: those with programming in (programAssembly.ts). */
export const WORKOUT_PROGRAMS: readonly WorkoutProgram[] = assemblePrograms(
  PROGRAM_CATALOG,
  PROGRAM_CONTENT,
);
