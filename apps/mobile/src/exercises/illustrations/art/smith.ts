import type { V3 } from '../geometry';
import { smith } from '../gym';
import {
  backBarPoint,
  barOnBack,
  FACING,
  feet,
  hands,
  LYING,
  motion,
  scene,
  shoulderAt,
  SIDE,
  stance,
  THREE_QUARTER,
} from '../poseKit';
import { bench, platform } from '../props';
import type { PropBuilder, SceneSpec } from '../render';
import type { FootTarget, PoseSpec, Side } from '../rig';

// The Smith machine: the bar runs straight up and down between its rails, so every pose here is
// placed for the bar to sit at the same distance forward in each frame.

const BACK_TOE: V3 = [0.55, -0.83, 0];

/** Moves the hips forward or back so a bar across the upper back sits at `x`. */
function hipsUnder(x: number, pelvis: V3, pitch: number): V3 {
  const bar = backBarPoint(pelvis, pitch);
  return [pelvis[0] + (x - bar[0]), pelvis[1], pelvis[2]];
}

/** A pose with the bar across the upper back, the hips moved so the bar is at `x`. */
function barBack(x: number, pelvis: V3, pitch: number, legs: Record<Side, FootTarget>): PoseSpec {
  const hips = hipsUnder(x, pelvis, pitch);
  return { pelvis: hips, pitch, feet: legs, hands: barOnBack(hips, pitch, 32) };
}

function onBack(
  x: number,
  poses: [V3, number, Record<Side, FootTarget>][],
  extra: PropBuilder[] = [],
  view = THREE_QUARTER,
): SceneSpec {
  return scene(
    poses.map(([pelvis, pitch, legs]) => barBack(x, pelvis, pitch, legs)),
    { view, props: [...extra, smith(x)], motion: motion.hips },
  );
}

// ------------------------------------------------------------------------------- Lying presses

function lyingPress(surface: 'flat' | 'incline', grip: 'normal' | 'close'): SceneSpec {
  const pelvis: V3 = surface === 'flat' ? [8, 54, 0] : [-9, 55, 0];
  const pitch = surface === 'flat' ? -90 : -60;
  const legs = feet({ at: surface === 'flat' ? [44, 8, 22] : [38, 8, 20], pole: [0.2, 1, 0.2] });
  const sh = shoulderAt(pelvis, pitch);
  const x = sh[0] + (surface === 'flat' ? (grip === 'close' ? 12 : 8) : 12);
  const z = grip === 'close' ? 12 : 26;
  const pole: V3 = grip === 'close' ? [0.7, -1, 0.25] : [0, -1, 0.75];
  const pose = (lift: number): PoseSpec => ({
    pelvis,
    pitch,
    feet: legs,
    hands: hands({ at: [x, sh[1] + lift, z], pole }),
  });
  return scene([pose(15), pose(56)], {
    view: LYING,
    props: [
      surface === 'flat' ? bench({ at: [-22, 44, 0] }) : bench({ at: [8, 44, 0], angle: 30 }),
      smith(x),
    ],
    motion: motion.hands,
  });
}

function seatedPress(): SceneSpec {
  const pose = (y: number): PoseSpec => ({
    pelvis: [-5, 53, 0],
    pitch: -6,
    feet: feet({ at: [40, 8, 17] }),
    hands: hands({ at: [10, y, 26], pole: [0.5, -1, 0.4] }),
  });
  return scene([pose(104), pose(154)], {
    view: FACING,
    props: [bench({ at: [6, 44, 0], angle: 82, length: 78 }), smith(10)],
    motion: motion.hands,
  });
}

// ------------------------------------------------------------------------------------------ Legs

const SQUAT_LEGS = stance(16, 8, 12);
const FRONT_FOOT: FootTarget = { at: [30, 8, 11] };
const BACK_FOOT: FootTarget = { at: [-40, 12, -11], pole: [0.3, -1, 0], toe: BACK_TOE };

function rdl(): SceneSpec {
  const x = 10;
  const pose = (pelvis: V3, pitch: number, y: number): PoseSpec => ({
    pelvis,
    pitch,
    feet: stance(13),
    hands: hands({ at: [x, y, 24], pole: [-1, -0.2, 0.3] }),
  });
  return scene([pose([0, 94, 0], 0, 86), pose([-22, 88, 0], 72, 50)], {
    view: SIDE,
    props: [smith(x)],
    motion: motion.hips,
  });
}

function hipThrust(): SceneSpec {
  const x = -6;
  const pose = (pelvis: V3, pitch: number): PoseSpec => ({
    pelvis,
    pitch,
    feet: feet({ at: [34, 8, 16], pole: [0, 1, 0.25] }),
    hands: hands({ at: [x, pelvis[1] + 15, 30], pole: [0, -0.3, 1] }),
  });
  return scene([pose([-12, 24, 0], -58), pose([-6, 52, 0], -93)], {
    view: THREE_QUARTER,
    props: [bench({ at: [-44, 44, 0], across: true, length: 110 }), smith(x)],
    motion: motion.hips,
  });
}

function calfRaise(): SceneSpec {
  const STEP = 8;
  const pose = (y: number, toe: V3): PoseSpec =>
    barBack(-2, [0, 94 + (y - (STEP + 8)), 0], 0, feet({ at: [0, y, 12], toe }));
  return scene([pose(STEP + 5, [0.97, 0.24, 0.05]), pose(STEP + 19, [0.62, -0.79, 0.05])], {
    view: THREE_QUARTER,
    props: [platform([12, STEP, 0], { x: 26, z: 60 }), smith(-2)],
    motion: motion.hips,
  });
}

function bentOverRow(): SceneSpec {
  const x = 20;
  const pose = (y: number, pole: V3): PoseSpec => ({
    pelvis: [-12, 90, 0],
    pitch: 60,
    feet: stance(14),
    hands: hands({ at: [x, y, 24], pole }),
  });
  return scene([pose(62, [-0.3, -1, 0.3]), pose(88, [-1, 0.6, 0.3])], {
    view: SIDE,
    props: [smith(x)],
    motion: motion.hands,
  });
}

function shrug(): SceneSpec {
  const pose = (y: number, lift: number): PoseSpec => ({
    pelvis: [0, 94, 0],
    feet: stance(13),
    shrug: lift,
    hands: hands({ at: [8, y, 24], pole: [-1, -0.2, 0.3] }),
  });
  return scene([pose(84, 0), pose(91, 7)], {
    view: THREE_QUARTER,
    props: [smith(8)],
    motion: motion.head,
  });
}

export const SMITH_ART: Record<string, SceneSpec> = {
  'sm-bench-press': lyingPress('flat', 'normal'),
  'sm-incline-bench-press': lyingPress('incline', 'normal'),
  'sm-close-grip-bench': lyingPress('flat', 'close'),
  'sm-shoulder-press': seatedPress(),
  'sm-squat': onBack(-6, [
    [[0, 93, 0], 4, SQUAT_LEGS],
    [[-20, 58, 0], 28, SQUAT_LEGS],
  ]),
  'sm-split-squat': onBack(
    -4,
    [
      [[-4, 86, 0], 2, { r: FRONT_FOOT, l: BACK_FOOT }],
      [[-4, 52, 0], 4, { r: FRONT_FOOT, l: BACK_FOOT }],
    ],
    [],
    SIDE,
  ),
  'sm-bulgarian-split-squat': onBack(
    -6,
    [
      [
        [-6, 86, 0],
        4,
        {
          r: { at: [30, 8, 11] },
          l: { at: [-62, 50, -11], pole: [0.3, -1, 0], toe: [-0.95, 0.2, 0] },
        },
      ],
      [
        [-12, 55, 0],
        10,
        {
          r: { at: [30, 8, 11] },
          l: { at: [-62, 50, -11], pole: [0.3, -1, 0], toe: [-0.95, 0.2, 0] },
        },
      ],
    ],
    [bench({ at: [-74, 44, 0], across: true, length: 70 })],
    SIDE,
  ),
  'sm-reverse-lunge': onBack(
    -2,
    [
      [[0, 93, 0], 0, feet({ at: [0, 8, 11] })],
      [[-4, 52, 0], 4, { r: { at: [26, 8, 11] }, l: { ...BACK_FOOT, at: [-44, 12, -11] } }],
    ],
    [],
    SIDE,
  ),
  'sm-romanian-deadlift': rdl(),
  'sm-hip-thrust': hipThrust(),
  'sm-calf-raise': calfRaise(),
  'sm-bent-over-row': bentOverRow(),
  'sm-shrug': shrug(),
};
