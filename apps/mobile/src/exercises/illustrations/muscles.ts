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
  chest: both('torso', [0.6, 0.9], [7, 74]),
  frontDelts: [{ part: 'upperArm', t: [-0.14, 0.34], theta: [-40, 42] }],
  sideDelts: [{ part: 'upperArm', t: [-0.14, 0.32], theta: [26, 132] }],
  rearDelts: [{ part: 'upperArm', t: [-0.14, 0.32], theta: [138, 222] }],
  biceps: [{ part: 'upperArm', t: [0.34, 0.9], theta: [-48, 48] }],
  triceps: [{ part: 'upperArm', t: [0.3, 0.92], theta: [128, 232] }],
  forearms: [{ part: 'forearm', t: [0.04, 0.62], theta: [-180, 180] }],
  traps: [{ part: 'torso', t: [0.86, 1.08], theta: [105, 255] }],
  upperBack: [{ part: 'torso', t: [0.62, 0.88], theta: [150, 210] }],
  lats: both('torso', [0.42, 0.84], [104, 148]),
  lowerBack: [{ part: 'torso', t: [0.1, 0.46], theta: [158, 202] }],
  abs: [{ part: 'torso', t: [0.18, 0.58], theta: [-26, 26] }],
  obliques: both('torso', [0.2, 0.56], [34, 86]),
  glutes: [{ part: 'torso', t: [-0.2, 0.1], theta: [118, 242] }],
  quads: [{ part: 'thigh', t: [0.12, 0.9], theta: [-62, 70] }],
  hamstrings: [{ part: 'thigh', t: [0.14, 0.88], theta: [122, 238] }],
  adductors: [{ part: 'thigh', t: [0.06, 0.62], theta: [-128, -62] }],
  calves: [{ part: 'shin', t: [0.06, 0.56], theta: [112, 248] }],
  tibialis: [{ part: 'shin', t: [0.1, 0.62], theta: [-28, 34] }],
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

export interface MuscleHighlight {
  primary: readonly MuscleRegion[];
  secondary: readonly MuscleRegion[];
}
