import type { MuscleGroup } from '../muscleGroups';

// Where each highlighted muscle sits on the instructor's body. A patch is a stretch of one body
// part's surface: `t` runs along it (0 at the joint nearest the body, 1 at the far end; for the
// torso, 0 at the hips and 1 at the shoulders), and `theta` around it, in degrees -- 0 at its front,
// 90 its outside (for the torso, the figure's right), 180 its back, -90 its inside.

export const MUSCLE_REGIONS = [
  'chest',
  'frontDelts',
  'sideDelts',
  'rearDelts',
  'biceps',
  'triceps',
  'forearms',
  'traps',
  'upperBack',
  'lats',
  'lowerBack',
  'abs',
  'obliques',
  'glutes',
  'quads',
  'hamstrings',
  'adductors',
  'calves',
  'tibialis',
] as const;
export type MuscleRegion = (typeof MUSCLE_REGIONS)[number];

export type BodyPartKey = 'torso' | 'upperArm' | 'forearm' | 'thigh' | 'shin';

export interface MusclePatch {
  part: BodyPartKey;
  t: readonly [number, number];
  theta: readonly [number, number];
}

const both = (part: BodyPartKey, t: [number, number], theta: [number, number]): MusclePatch[] => [
  { part, t, theta },
  { part, t, theta: [-theta[1], -theta[0]] },
];

export const REGION_PATCHES: Record<MuscleRegion, readonly MusclePatch[]> = {
  chest: both('torso', [0.56, 0.93], [4, 84]),
  frontDelts: [{ part: 'upperArm', t: [-0.16, 0.4], theta: [-58, 52] }],
  sideDelts: [{ part: 'upperArm', t: [-0.16, 0.38], theta: [18, 142] }],
  rearDelts: [{ part: 'upperArm', t: [-0.16, 0.38], theta: [128, 232] }],
  biceps: [{ part: 'upperArm', t: [0.3, 0.92], theta: [-62, 62] }],
  triceps: [{ part: 'upperArm', t: [0.26, 0.95], theta: [116, 244] }],
  forearms: [{ part: 'forearm', t: [0.02, 0.66], theta: [-180, 180] }],
  traps: [{ part: 'torso', t: [0.8, 1.12], theta: [98, 262] }],
  upperBack: [{ part: 'torso', t: [0.56, 0.9], theta: [138, 222] }],
  lats: both('torso', [0.36, 0.86], [98, 160]),
  lowerBack: [{ part: 'torso', t: [0.04, 0.5], theta: [148, 212] }],
  abs: [{ part: 'torso', t: [0.1, 0.62], theta: [-32, 32] }],
  obliques: both('torso', [0.14, 0.58], [30, 94]),
  glutes: [{ part: 'torso', t: [-0.24, 0.14], theta: [106, 254] }],
  quads: [{ part: 'thigh', t: [0.06, 0.93], theta: [-78, 82] }],
  hamstrings: [{ part: 'thigh', t: [0.1, 0.92], theta: [110, 250] }],
  adductors: [{ part: 'thigh', t: [0.02, 0.68], theta: [-145, -52] }],
  calves: [{ part: 'shin', t: [0.02, 0.62], theta: [102, 258] }],
  tibialis: [{ part: 'shin', t: [0.06, 0.68], theta: [-38, 42] }],
};

/** The app's muscle group each highlighted region belongs to. */
export const REGION_GROUP: Record<MuscleRegion, MuscleGroup> = {
  chest: 'chest',
  frontDelts: 'shoulders',
  sideDelts: 'shoulders',
  rearDelts: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  traps: 'back',
  upperBack: 'back',
  lats: 'back',
  lowerBack: 'back',
  abs: 'core',
  obliques: 'core',
  glutes: 'glutes',
  quads: 'quadriceps',
  hamstrings: 'hamstrings',
  adductors: 'adductors',
  calves: 'calves',
  tibialis: 'calves',
};

/** What the anatomy figure's key calls each region. */
export const REGION_NAMES: Record<MuscleRegion, string> = {
  chest: 'Chest',
  frontDelts: 'Shoulders',
  sideDelts: 'Shoulders (Lateral)',
  rearDelts: 'Rear Delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  traps: 'Traps',
  upperBack: 'Upper Back',
  lats: 'Back (Lats)',
  lowerBack: 'Lower Back',
  abs: 'Abs',
  obliques: 'Obliques',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  adductors: 'Adductors',
  calves: 'Calves',
  tibialis: 'Tibialis',
};

export interface MuscleHighlight {
  primary: readonly MuscleRegion[];
  secondary: readonly MuscleRegion[];
  /**
   * A colour of its own for each muscle given one, drawn over the two tones -- the anatomy figure
   * of a muscle group (the Exercise Library's Browse by Muscle) or of what's been trained lately
   * (Muscle Activity). An exercise's highlight never has one.
   */
  colors?: Partial<Record<MuscleRegion, string>>;
}
