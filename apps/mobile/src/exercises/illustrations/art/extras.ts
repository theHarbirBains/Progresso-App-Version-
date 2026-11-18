import { add, lerp3, scale, type V3 } from '../geometry';
import {
  band,
  bandToHands,
  battleRopes,
  dipBars,
  grips,
  heldPlate,
  hyperextensionBench,
  medicineBall,
  pad,
  roller,
  safetySquatBar,
  sled,
  suspension,
  trapBar,
} from '../gym';
import { ART, MATERIALS } from '../palette';
import {
  BACK_THREE_QUARTER,
  FACING,
  FRONT,
  feet,
  hands,
  motion,
  regear,
  scene,
  SIDE,
  stance,
  THREE_QUARTER,
  toeOut,
  torsoOf,
} from '../poseKit';
import { barbell, bench, cylinder, landmine, mat, plyoBox, pullUpBar } from '../props';
import type { PropBuilder, SceneSpec } from '../render';
import type { FootTarget, LimbTarget, PoseSpec, Side, Skeleton } from '../rig';
import { CORE_ART } from './core';
import { LEGS_ART } from './legs';
import { LYING_ART } from './lying';

// The rest of the library: bodyweight work, resistance bands, the suspension trainer, medicine
// balls, battle ropes, the sled, the trap bar, specialty bars, plates and the landmine.

const STAND: V3 = [0, 94, 0];
const FEET = stance(13);
const ON_HIP: LimbTarget = { at: [-4, 100, -24], pole: [-0.6, -0.2, -1] };
const floorMat = mat([-14, 0, 0], { x: 190, z: 66 });
const mid = (a: V3, b: V3): V3 => lerp3(a, b, 0.5);

function two(
  a: PoseSpec,
  b: PoseSpec,
  gear: PropBuilder[],
  view = SIDE,
  cue = motion.hand,
): SceneSpec {
  return scene([a, b], { view, props: gear, motion: cue });
}

function stand(r: V3 | LimbTarget, extra: Partial<PoseSpec> = {}, l?: LimbTarget): PoseSpec {
  const right = Array.isArray(r) ? { at: r as V3 } : (r as LimbTarget);
  return { pelvis: STAND, feet: FEET, hands: hands(right, l), ...extra };
}

// ---------------------------------------------------------------------------------- Pulling

const BAR = 226;

/** Hanging from the bar, hands `width` either side, shoulders `drop` below it. */
function hang(width: number, drop: number, pole: V3, legs?: Record<Side, FootTarget>): PoseSpec {
  const pelvisY = BAR - drop - 49;
  return {
    pelvis: [-2, pelvisY, 0],
    feet: legs ?? feet({ at: [-14, pelvisY - 82, 10], toe: [0.3, -1, 0] }),
    hands: hands({ at: [0, BAR, width], pole }),
  };
}

function pullUp(width: number, gear: PropBuilder[] = [], view = BACK_THREE_QUARTER): SceneSpec {
  return two(
    hang(width, 57, [0, -1, 0.3]),
    hang(width, 16, [0, -1, 0.8]),
    [pullUpBar(BAR), ...gear],
    view,
    motion.hips,
  );
}

/** Under a bar at hip height, heels on the floor, body straight: head under the bar, feet out front. */
function invertedRow(): SceneSpec {
  const pose = (pelvis: V3, pitch: number, pole: V3): PoseSpec => ({
    pelvis,
    pitch,
    feet: feet({ at: [128, 8, 12], toe: [0.2, 1, 0] }),
    hands: hands({ at: [0, 96, 28], pole }),
  });
  return two(
    pose([45, 28, 0], -77, [0, -1, 0.4]),
    pose([53, 53, 0], -60, [0.3, -1, 0.9]),
    [pullUpBar(96, 0)],
    THREE_QUARTER,
    motion.hips,
  );
}

function kneeRaise(toes: boolean): SceneSpec {
  const shoulderY = BAR - 58;
  const pelvisY = shoulderY - 49;
  const base = hang(26, 58, [0, -1, 0.2], feet({ at: [-8, pelvisY - 84, 9], toe: [0.3, -1, 0] }));
  const up = toes
    ? {
        ...hang(
          26,
          52,
          [0, -1, 0.2],
          feet({ at: [40, BAR - 56, 9], pole: [0, 1, 0], toe: [0.2, 1, 0] }),
        ),
        pitch: -18,
      }
    : {
        ...hang(
          26,
          56,
          [0, -1, 0.2],
          feet({ at: [18, pelvisY - 4, 9], pole: [1, 0.4, 0], toe: [0.3, -1, 0] }),
        ),
        pitch: -16,
      };
  return two(base, up, [pullUpBar(BAR)], SIDE, motion.foot);
}

// ---------------------------------------------------------------------------------- Dips

function parallelDip(lean: number, gear: PropBuilder[] = []): SceneSpec {
  const pose = (pelvisY: number, pitch: number): PoseSpec => ({
    pelvis: [-4, pelvisY, 0],
    pitch,
    feet: feet({ at: [-24, pelvisY - 70, 10], pole: [1, 0, 0.1], toe: [0.4, -1, 0] }),
    hands: hands({ at: [4, 132, 26], pole: [-1, 0.1, 0.2] }),
  });
  return two(pose(132, lean / 2), pose(102, lean), [dipBars(132, 26), ...gear], SIDE, motion.head);
}

/** A plate hanging from a dip belt. */
const beltPlate: PropBuilder = ({ cam, skeleton }) => {
  const at = add(skeleton.pelvis, [6, -28, 0]);
  return [
    cylinder(cam, add(skeleton.pelvis, [4, -4, 0]), at, 0.6, MATERIALS.strap, ART.pad),
    cylinder(
      cam,
      add(at, [-1.5, -12, 0]),
      add(at, [1.5, -12, 0]),
      13,
      MATERIALS.iron,
      ART.plateFace,
      { hub: 2 },
    ),
  ];
};

function benchDip(): SceneSpec {
  const pose = (pelvisY: number): PoseSpec => ({
    pelvis: [6, pelvisY, 0],
    feet: feet({ at: [70, 8, 12], pole: [0, 1, 0.2] }),
    hands: hands({ at: [-12, 47, 18], pole: [-1, 0.1, 0.2] }),
  });
  return two(
    pose(50),
    pose(26),
    [bench({ at: [-40, 44, 0], across: true, length: 90 })],
    SIDE,
    motion.hips,
  );
}

// ---------------------------------------------------------------------------------- Push-ups

function pushUp(kind: 'diamond' | 'wide' | 'decline' | 'incline' | 'pike'): SceneSpec {
  const ankle = -72;
  const width = kind === 'diamond' ? 5 : kind === 'wide' ? 38 : 22;
  const toes: FootTarget = { at: [ankle, 9, 9], toe: [0.25, -1, 0] };
  if (kind === 'decline') {
    const pose = (pelvis: V3, pitch: number, pole: V3): PoseSpec => ({
      pelvis,
      pitch,
      feet: feet({ at: [ankle, 52, 9], toe: [0.25, -1, 0] }),
      hands: hands({ at: [ankle + 128, 2, 22], pole }),
      headPitch: -8,
    });
    return two(
      pose([ankle + 80, 58, 0], 86, [-0.4, 0, 1]),
      pose([ankle + 84, 40, 0], 98, [-0.5, 0.6, 1]),
      [bench({ at: [ankle - 4, 44, 0], length: 60 })],
      { yaw: -22, tilt: 14 },
      motion.hips,
    );
  }
  if (kind === 'incline') {
    // Hands on a bench in front, feet on the floor.
    const pose = (pelvis: V3, pitch: number, pole: V3): PoseSpec => ({
      pelvis,
      pitch,
      feet: feet({ at: [-60, 9, 9], toe: [0.25, -1, 0] }),
      hands: hands({ at: [68, 46, 22], pole }),
      headPitch: -8,
    });
    return two(
      pose([10, 60, 0], 50, [-0.4, 0, 1]),
      pose([14, 48, 0], 64, [-0.5, 0.6, 1]),
      [bench({ at: [72, 44, 0], length: 60, across: true })],
      { yaw: -22, tilt: 14 },
      motion.hips,
    );
  }
  if (kind === 'pike') {
    const pose = (pitch: number, pelvis: V3, pole: V3): PoseSpec => ({
      pelvis,
      pitch,
      feet: feet({ at: [-40, 9, 10], toe: [0.4, -1, 0] }),
      hands: hands({ at: [40, 2, 20], pole }),
      headPitch: -20,
    });
    return two(
      pose(132, [-12, 92, 0], [-0.4, 0, 1]),
      pose(118, [-6, 82, 0], [-0.5, 0.6, 1]),
      [floorMat],
      { yaw: -22, tilt: 10 },
      motion.head,
    );
  }
  const pose = (pelvis: V3, pitch: number, pole: V3): PoseSpec => ({
    pelvis,
    pitch,
    feet: feet(toes),
    hands: hands({ at: [ankle + 128, 2, width], pole }),
    headPitch: -8,
  });
  const tucked = kind === 'diamond';
  return two(
    pose([ankle + 82, kind === 'wide' ? 36 : 39, 0], 68, tucked ? [-1, 0, 0.3] : [-0.4, 0, 1]),
    pose([ankle + 85, 22, 0], 80, tucked ? [-1, 0.4, 0.3] : [-0.3, 0.5, 1]),
    [],
    { yaw: -22, tilt: 14 },
    motion.hips,
  );
}

// ---------------------------------------------------------------------------- Legs and hips

function airSquat(jump: boolean): SceneSpec {
  const legs = stance(16, 0, 14);
  const bottom: PoseSpec = {
    pelvis: [-20, 50, 0],
    pitch: 26,
    feet: legs,
    hands: hands({ at: [44, 120, 18], pole: [0, -1, 0.3] }),
  };
  const top: PoseSpec = jump
    ? {
        pelvis: [0, 112, 0],
        feet: feet({ at: [4, 24, 13], toe: [0.5, -0.86, 0] }),
        hands: hands({ at: [6, 196, 22], pole: [-0.2, -1, 0.3] }),
      }
    : { pelvis: STAND, feet: legs, hands: hands({ at: [46, 138, 18], pole: [0, -1, 0.3] }) };
  return two(jump ? bottom : top, jump ? top : bottom, [], FACING, motion.hips);
}

function boxJump(): SceneSpec {
  return two(
    {
      pelvis: [-12, 66, 0],
      pitch: 30,
      feet: stance(14),
      hands: hands({ at: [-30, 90, 22], pole: [0, -1, 0.3] }),
    },
    {
      pelvis: [56, 120, 0],
      pitch: 16,
      feet: feet({ at: [60, 68, 13] }),
      hands: hands({ at: [96, 128, 20], pole: [0, -1, 0.3] }),
    },
    [plyoBox([62, 60, 0])],
    SIDE,
    motion.hips,
  );
}

function wallSit(): SceneSpec {
  return {
    view: SIDE,
    frames: [
      {
        pose: {
          pelvis: [-14, 52, 0],
          pitch: -2,
          feet: feet({ at: [34, 8, 14], toe: toeOut(6) }),
          hands: hands({ at: [16, 56, 22], pole: [0, -1, 0.3] }),
        },
        props: [pad([-30, 92, 0], [2.5, 92, 50], 0)],
      },
    ],
  };
}

function glutHamRaise(): SceneSpec {
  const pose = (pitch: number): PoseSpec => {
    const t = { pelvis: [0, 86, 0] as V3, pitch };
    return {
      ...t,
      feet: feet({ at: [-40, 92, 10], pole: [0, -1, 0], toe: [-0.3, -1, 0] }),
      hands: crossedOnChest(t),
    };
  };
  return two(
    pose(-4),
    pose(88),
    [pad([-6, 74, 0], [10, 6, 18]), roller([-44, 100, 0], 12), roller([-44, 84, 0], 12)],
    SIDE,
    motion.head,
  );
}

function crossedOnChest(t: Pick<PoseSpec, 'pelvis' | 'pitch' | 'twist'>): Record<Side, LimbTarget> {
  const s = torsoOf(t);
  const f = s.frameAt(1);
  const at = (z: number) =>
    add(add(add(s.shoulderCenter, scale(f.forward, 13)), scale(f.up, -12)), scale(f.right, z));
  return { r: { at: at(-7), pole: [0, -1, 0.8] }, l: { at: at(7), pole: [0, -1, -0.8] } };
}

function backExtension(): SceneSpec {
  const pose = (pelvis: V3, pitch: number): PoseSpec => {
    const t = { pelvis, pitch };
    return {
      ...t,
      feet: feet({ at: [-56, 30, 10], pole: [0, 1, 0], toe: [0.4, -0.9, 0] }),
      hands: crossedOnChest(t),
    };
  };
  return two(
    pose([-2, 92, 0], 100),
    pose([-6, 90, 0], 44),
    [hyperextensionBench([8, 84, 0])],
    SIDE,
    motion.head,
  );
}

// -------------------------------------------------------------------------------- Core

const LIE: V3 = [8, 12, 0];

function lyingLegRaise(): SceneSpec {
  const pose = (foot: V3): PoseSpec => ({
    pelvis: LIE,
    pitch: -90,
    feet: feet({ at: foot, pole: [0, 1, 0], toe: [0.1, 1, 0] }),
    hands: hands({ at: [-6, 3, 24], pole: [0, 1, 0.3] }),
  });
  return two(pose([94, 14, 9]), pose([16, 98, 9]), [floorMat], THREE_QUARTER, motion.foot);
}

function bicycle(): SceneSpec {
  const pose = (twist: number, r: FootTarget, l: FootTarget): PoseSpec => {
    const t = { pelvis: LIE, pitch: -62, twist };
    const s = torsoOf(t);
    const behind = (side: Side) => add(s.head, [-4, 2, side === 'r' ? 9 : -9]);
    return {
      ...t,
      feet: { r, l },
      hands: {
        r: { at: behind('r'), pole: [0.5, 0.3, 1] },
        l: { at: behind('l'), pole: [0.5, 0.3, -1] },
      },
    };
  };
  const tucked = (z: number): FootTarget => ({ at: [52, 34, z], pole: [0, 1, 0] });
  const out = (z: number): FootTarget => ({ at: [94, 26, z], pole: [0, 1, 0] });
  return two(
    pose(-24, tucked(10), out(-10)),
    pose(24, out(10), tucked(-10)),
    [floorMat],
    THREE_QUARTER,
    motion.foot,
  );
}

/** On the left forearm and the side of the left foot, body in a straight line, the right hand on the hip. */
function sidePlank(): SceneSpec {
  return {
    view: FRONT,
    frames: [
      // Set up lying on the side, propped on the elbow, hips down...
      {
        pose: {
          pelvis: [0, 11, -8.6],
          lean: -52,
          feet: { r: { at: [0, 16, 75], toe: [1, 0, 0] }, l: { at: [0, 8, 72], toe: [1, 0, 0] } },
          hands: {
            r: { at: [4, 30, 0], pole: [-0.2, 1, 0.4] },
            l: { at: [26, 4, -46], pole: [-0.3, -1, 0] },
          },
        },
        props: [floorMat],
      },
      // ...then the hips lift into the hold.
      {
        pose: {
          pelvis: [0, 28, 0],
          lean: -74,
          feet: { r: { at: [0, 16, 86], toe: [1, 0, 0] }, l: { at: [0, 8, 84], toe: [1, 0, 0] } },
          hands: {
            r: { at: [4, 44, 4], pole: [-0.2, 1, 0.4] },
            l: { at: [26, 4, -46], pole: [-0.3, -1, 0] },
          },
        },
        props: [floorMat],
      },
    ],
  };
}

function hollowHold(): SceneSpec {
  return {
    view: THREE_QUARTER,
    frames: [
      // Lying flat, arms overhead...
      {
        pose: {
          pelvis: [8, 9, 0],
          pitch: -88,
          feet: feet({ at: [94, 8, 8], pole: [0, 1, 0], toe: [0.3, 1, 0] }),
          hands: hands({ at: [-92, 7, 14], pole: [0, 1, 0.1] }),
        },
        props: [floorMat],
      },
      // ...then the shoulders and legs lift into the hollow.
      {
        pose: {
          pelvis: [8, 12, 0],
          pitch: -74,
          feet: feet({ at: [94, 22, 8], pole: [0, 1, 0], toe: [0.8, 0.5, 0] }),
          hands: hands({ at: [-94, 30, 14], pole: [0, 1, 0.1] }),
        },
        props: [floorMat],
      },
    ],
  };
}

function mountainClimber(): SceneSpec {
  const ankle = -72;
  const pose = (r: FootTarget, l: FootTarget): PoseSpec => ({
    pelvis: [ankle + 80, 42, 0],
    pitch: 70,
    feet: { r, l },
    hands: hands({ at: [ankle + 128, 2, 20], pole: [-0.4, 0, 1] }),
    headPitch: -8,
  });
  const back = (z: number): FootTarget => ({ at: [ankle, 9, z], toe: [0.25, -1, 0] });
  const driven = (z: number): FootTarget => ({
    at: [ankle + 64, 14, z],
    pole: [0, -1, 0],
    toe: [0.25, -1, 0],
  });
  return two(
    pose(back(9), driven(-9)),
    pose(driven(9), back(-9)),
    [],
    { yaw: -22, tilt: 14 },
    motion.foot,
  );
}

function burpee(): SceneSpec {
  const ankle = -72;
  return scene(
    [
      { pelvis: STAND, feet: FEET, hands: hands({ at: [4, 86, 22], pole: [0, -1, 0.2] }) },
      {
        pelvis: [ankle + 82, 42, 0],
        pitch: 68,
        feet: feet({ at: [ankle, 9, 9], toe: [0.25, -1, 0] }),
        hands: hands({ at: [ankle + 128, 2, 22], pole: [-0.4, 0, 1] }),
        headPitch: -8,
      },
      {
        pelvis: [0, 112, 0],
        feet: feet({ at: [2, 24, 13], toe: [0.5, -0.86, 0] }),
        hands: hands({ at: [2, 198, 20], pole: [-0.2, -1, 0.3] }),
      },
    ],
    { view: { yaw: -26, tilt: 10 }, props: [], motion: motion.hips },
  );
}

// ------------------------------------------------------------------------------ Bands

/** The band's anchor on a post (`at`), drawn as a short stub so it reads as fixed. */
const anchorPost =
  (at: V3): PropBuilder =>
  ({ cam }) => [
    cylinder(
      cam,
      [at[0], 0, at[2]],
      [at[0], at[1] + 30, at[2]],
      2.6,
      MATERIALS.iron,
      ART.plateFace,
      { bias: -20 },
    ),
  ];

function bandPullApart(): SceneSpec {
  return two(
    stand({ at: [52, 140, 12], pole: [0, -1, 0.3] }),
    stand({ at: [12, 140, 64], pole: [0, -1, 0.2] }),
    [
      band(
        (s) => s.arms.r.end,
        (s) => s.arms.l.end,
        1.1,
      ),
    ],
    FACING,
  );
}

function bandFacePull(): SceneSpec {
  const anchor: V3 = [96, 160, 0];
  return two(
    stand({ at: [50, 152, 8], pole: [0, -1, 0.5] }),
    stand({ at: [10, 158, 26], pole: [-0.3, 0.4, 1] }),
    [anchorPost(anchor), bandToHands(anchor, ['r', 'l'], false)],
  );
}

function lateralWalk(): SceneSpec {
  const pose = (r: V3, l: V3): PoseSpec => ({
    pelvis: [-8, 78, 0],
    pitch: 20,
    feet: feet({ at: r, pole: [1, 0, 0.5] }, { at: l, pole: [1, 0, -0.5] }),
    hands: hands({ at: [26, 100, 14], pole: [0, -1, 0.3] }),
  });
  return two(
    pose([0, 8, 16], [0, 8, -16]),
    pose([0, 8, 38], [0, 8, -16]),
    [
      band(
        (s) => add(s.legs.r.end, [0, 6, 0]),
        (s) => add(s.legs.l.end, [0, 6, 0]),
        1.3,
      ),
    ],
    FACING,
    motion.foot,
  );
}

function bandRow(): SceneSpec {
  const anchor: V3 = [110, 112, 0];
  return two(
    {
      pelvis: [-4, 92, 0],
      pitch: 6,
      feet: stance(14),
      hands: hands({ at: [50, 116, 14], pole: [-0.2, -1, 0.5] }),
    },
    {
      pelvis: [-4, 92, 0],
      pitch: 6,
      feet: stance(14),
      hands: hands({ at: [2, 108, 20], pole: [-1, -0.3, 0.4] }),
    },
    [anchorPost(anchor), bandToHands(anchor)],
  );
}

function bandPress(): SceneSpec {
  const anchor: V3 = [-70, 124, 0];
  const split = feet({ at: [22, 8, 13], toe: toeOut(6) }, { at: [-18, 8, -13], toe: toeOut(-4) });
  return two(
    {
      pelvis: [2, 93, 0],
      pitch: 6,
      feet: split,
      hands: hands({ at: [10, 128, 26], pole: [-0.4, -0.6, 1] }),
    },
    {
      pelvis: [2, 93, 0],
      pitch: 6,
      feet: split,
      hands: hands({ at: [54, 130, 12], pole: [-0.2, -1, 0.8] }),
    },
    [anchorPost(anchor), bandToHands(anchor)],
    THREE_QUARTER,
  );
}

function bandCurl(): SceneSpec {
  const underFoot =
    (side: Side) =>
    (s: Skeleton): V3 =>
      add(s.legs[side].end, [3, -5, 0]);
  return two(
    stand({ at: [10, 84, 20], pole: [-1, -0.2, 0.1] }),
    stand({ at: [20, 134, 20], pole: [-1, -0.2, 0.1] }),
    [
      band(underFoot('r'), (s) => s.arms.r.end),
      band(underFoot('l'), (s) => s.arms.l.end),
      grips('lr', ['r', 'l'], 5),
    ],
    THREE_QUARTER,
  );
}

function bandPushdown(): SceneSpec {
  const anchor: V3 = [56, 214, 0];
  return two(
    stand({ at: [26, 116, 10], pole: [-1, -0.3, 0.2] }, { pitch: 8 }),
    stand({ at: [20, 88, 12], pole: [-1, 0.1, 0.2] }, { pitch: 8 }),
    [pullUpBar(214, 56), bandToHands(anchor, ['r', 'l'], false)],
  );
}

function bandedBridge(): SceneSpec {
  return regear(LEGS_ART['db-glute-bridge'], [
    band(
      (s) => add(s.legs.r.joint, [0, 0, 5]),
      (s) => add(s.legs.l.joint, [0, 0, -5]),
      1.3,
    ),
  ]);
}

function bandAssistedPullUp(): SceneSpec {
  const knee = (s: Skeleton): V3 => add(s.legs.r.joint, [0, -4, 0]);
  const pose = (drop: number, pole: V3): PoseSpec => {
    const h = hang(26, drop, pole);
    return {
      ...h,
      feet: feet({ at: [-34, h.pelvis[1] - 46, 10], pole: [1, 0, 0.1], toe: [0.3, -1, 0] }),
    };
  };
  return two(
    pose(57, [0, -1, 0.3]),
    pose(16, [0, -1, 0.8]),
    [pullUpBar(BAR), band([0, BAR, 4], knee, 1.1), band([0, BAR, -4], knee, 1.1)],
    BACK_THREE_QUARTER,
    motion.hips,
  );
}

// ---------------------------------------------------------------------- Suspension trainer

const TRX: V3 = [90, 236, 0];

/** Leaning back from the feet, body straight, arms reaching up to the straps' handles. */
function trxRow(curl: boolean): SceneSpec {
  const pose = (pelvis: V3, pitch: number, h: V3, pole: V3): PoseSpec => ({
    pelvis,
    pitch,
    feet: feet({ at: [37, 8, 12], toe: toeOut(6) }),
    hands: hands({ at: h, pole }),
  });
  return two(
    pose([-18, 77, 0], -40, [-7, 150, curl ? 14 : 18], [-0.2, -1, 0.5]),
    curl
      ? pose([12, 90, 0], -20, [8, 158, 14], [0.2, -1, 0.3])
      : pose([12, 90, 0], -20, [16, 130, 22], [-1, -0.3, 0.4]),
    [suspension(TRX)],
    SIDE,
    motion.hips,
  );
}

function trxPress(): SceneSpec {
  const anchor: V3 = [-70, 236, 0];
  const pose = (pelvis: V3, pitch: number, h: V3, pole: V3): PoseSpec => ({
    pelvis,
    pitch,
    feet: feet({ at: [-34, 8, 12], toe: [0.3, -1, 0] }),
    hands: hands({ at: h, pole }),
  });
  return two(
    pose([2, 88, 0], 26, [66, 118, 22], [-0.2, -1, 0.8]),
    pose([10, 74, 0], 38, [52, 108, 26], [-0.6, 0, 1]),
    [suspension(anchor)],
    THREE_QUARTER,
    motion.hips,
  );
}

function trxPike(): SceneSpec {
  const anchor: V3 = [-120, 210, 0];
  const pose = (pelvis: V3, pitch: number, foot: V3): PoseSpec => ({
    pelvis,
    pitch,
    feet: feet({ at: foot, toe: [0.25, -1, 0] }),
    hands: hands({ at: [56, 2, 20], pole: [-0.4, 0, 1] }),
  });
  return two(
    pose([12, 44, 0], 70, [-70, 40, 9]),
    pose([14, 96, 0], 140, [-20, 70, 9]),
    [suspension(anchor, 'feet')],
    { yaw: -22, tilt: 12 },
    motion.hips,
  );
}

function trxHamstringCurl(): SceneSpec {
  const anchor: V3 = [200, 210, 0];
  const pose = (pelvisY: number, foot: V3): PoseSpec => ({
    pelvis: [8, pelvisY, 0],
    pitch: -78,
    feet: feet({ at: foot, pole: [0, 1, 0], toe: [0.2, 1, 0] }),
    hands: hands({ at: [-4, 3, 28], pole: [0, 1, 0.3] }),
  });
  return two(
    pose(34, [96, 40, 10]),
    pose(40, [52, 44, 10]),
    [floorMat, suspension(anchor, 'feet')],
    THREE_QUARTER,
    motion.foot,
  );
}

// --------------------------------------------------------------------------- Medicine ball

function slam(): SceneSpec {
  return two(
    {
      pelvis: [0, 96, 0],
      feet: stance(16),
      hands: hands({ at: [-2, 200, 7], pole: [-0.2, -1, 0.3] }),
    },
    {
      pelvis: [-18, 74, 0],
      pitch: 54,
      feet: stance(16),
      hands: hands({ at: [30, 50, 7], pole: [0, -1, 0.3] }),
    },
    [medicineBall()],
    SIDE,
    motion.hands,
  );
}

function wallBall(): SceneSpec {
  const legs = stance(16, 0, 14);
  return two(
    {
      pelvis: [-20, 50, 0],
      pitch: 22,
      feet: legs,
      hands: hands({ at: [14, 110, 8], pole: [0, -1, 0.5] }),
    },
    { pelvis: STAND, feet: legs, hands: hands({ at: [16, 196, 8], pole: [0, -1, 0.4] }) },
    [medicineBall((s) => add(mid(s.arms.r.end, s.arms.l.end), [4, 6, 0]))],
    FACING,
    motion.hands,
  );
}

function chestPass(): SceneSpec {
  return two(
    stand({ at: [16, 128, 9], pole: [-0.4, -1, 0.9] }),
    stand({ at: [52, 132, 9], pole: [-0.2, -1, 0.6] }),
    [medicineBall((s) => add(mid(s.arms.r.end, s.arms.l.end), [7, 0, 0]))],
    THREE_QUARTER,
    motion.hands,
  );
}

// ------------------------------------------------------------------------ Ropes and the sled

function ropes(slams: boolean): SceneSpec {
  const legs = stance(18, 0, 12);
  const pose = (r: V3, l: V3): PoseSpec => ({
    pelvis: [-10, 78, 0],
    pitch: 18,
    feet: legs,
    hands: hands({ at: r, pole: [0, -1, 0.3] }, { at: l, pole: [0, -1, -0.3] }),
  });
  const anchor: V3 = [150, 10, 0];
  return slams
    ? two(
        pose([30, 150, 12], [30, 150, -12]),
        pose([34, 80, 12], [34, 80, -12]),
        [battleRopes(anchor, 4)],
        SIDE,
        motion.hands,
      )
    : two(
        pose([40, 116, 12], [40, 86, -12]),
        pose([40, 86, 12], [40, 116, -12]),
        [battleRopes(anchor, 12)],
        SIDE,
        motion.hand,
      );
}

function sledPush(): SceneSpec {
  const pose = (r: FootTarget, l: FootTarget): PoseSpec => ({
    pelvis: [-10, 80, 0],
    pitch: 52,
    feet: { r, l },
    hands: hands({ at: [52, 108, 20], pole: [-0.4, -1, 0.6] }),
  });
  const front = (z: number): FootTarget => ({ at: [12, 10, z], toe: [0.6, -0.8, 0] });
  const back = (z: number): FootTarget => ({ at: [-50, 12, z], toe: [0.55, -0.83, 0] });
  return two(
    pose(front(11), back(-11)),
    pose(back(11), front(-11)),
    [sled([98, 0, 0])],
    SIDE,
    motion.foot,
  );
}

function sledDrag(): SceneSpec {
  const pose = (r: FootTarget, l: FootTarget): PoseSpec => ({
    pelvis: [0, 74, 0],
    pitch: -6,
    feet: { r, l },
    hands: hands({ at: [42, 96, 8], pole: [0, -1, 0.3] }),
  });
  const front = (z: number): FootTarget => ({ at: [24, 8, z], toe: [1, 0.1, 0] });
  const back = (z: number): FootTarget => ({ at: [-30, 12, z], toe: [0.55, -0.83, 0] });
  return two(
    pose(front(11), back(-11)),
    pose(back(11), front(-11)),
    [sled([150, 0, 0], 'drag')],
    SIDE,
    motion.foot,
  );
}

// --------------------------------------------------------------- Trap bar, specialty bars, plates

function trapBarDeadlift(): SceneSpec {
  return two(
    {
      pelvis: [-10, 52, 0],
      pitch: 34,
      feet: stance(14),
      hands: hands({ at: [6, 40, 26], pole: [-1, -0.2, 0.2] }),
    },
    { pelvis: STAND, feet: stance(14), hands: hands({ at: [2, 88, 26], pole: [-1, -0.2, 0.2] }) },
    [trapBar()],
    THREE_QUARTER,
    motion.hips,
  );
}

function trapBarShrug(): SceneSpec {
  return two(
    { pelvis: STAND, feet: stance(14), hands: hands({ at: [-2, 84, 26], pole: [-1, -0.2, 0.2] }) },
    {
      pelvis: STAND,
      feet: stance(14),
      shrug: 7,
      hands: hands({ at: [-2, 91, 26], pole: [-1, -0.2, 0.2] }),
    },
    [trapBar()],
    THREE_QUARTER,
    motion.head,
  );
}

function ssbSquat(): SceneSpec {
  const legs = stance(16, 0, 18);
  const pose = (pelvis: V3, pitch: number): PoseSpec => {
    const s = torsoOf({ pelvis, pitch });
    const f = s.frameAt(1);
    const at = (side: Side) => add(add(s.shoulders[side], scale(f.forward, 30)), scale(f.up, -14));
    return {
      pelvis,
      pitch,
      feet: legs,
      hands: {
        r: { at: at('r'), pole: [0.2, -1, 0.5] },
        l: { at: at('l'), pole: [0.2, -1, -0.5] },
      },
    };
  };
  const yoke = (s: Skeleton): V3 =>
    add(s.shoulderCenter, add(scale(s.frameAt(1).forward, -6), scale(s.frameAt(1).up, 5)));
  return two(
    pose([0, 93, 0], 4),
    pose([-22, 54, 0], 26),
    [safetySquatBar(yoke)],
    SIDE,
    motion.hips,
  );
}

function plateFrontRaise(): SceneSpec {
  return two(
    stand({ at: [14, 90, 10], pole: [-0.2, -1, 0.3] }),
    stand({ at: [54, 150, 10], pole: [-0.2, -1, 0.3] }),
    [heldPlate(() => [1, 0, 0])],
  );
}

function pinchHold(): SceneSpec {
  const plates: PropBuilder = ({ cam, skeleton }) => {
    const h = skeleton.arms.r.end;
    const c = add(h, [0, -14, 0]);
    return [
      cylinder(cam, add(c, [0, 0, -2.6]), add(c, [0, 0, 0]), 15, MATERIALS.iron, ART.plateFace, {
        hub: 2,
      }),
      cylinder(cam, add(c, [0, 0, 0]), add(c, [0, 0, 2.6]), 15, MATERIALS.iron, ART.plateFace, {
        hub: 2,
      }),
    ];
  };
  return {
    view: THREE_QUARTER,
    frames: [
      {
        pose: {
          pelvis: STAND,
          feet: FEET,
          hands: { r: { at: [2, 90, 26], pole: [-1, -0.2, 0.3] }, l: ON_HIP },
        },
        props: [plates],
      },
    ],
  };
}

function svendPress(): SceneSpec {
  return two(
    stand({ at: [18, 128, 3], pole: [-0.3, -1, 1] }),
    stand({ at: [54, 132, 3], pole: [-0.2, -1, 0.8] }),
    [heldPlate(() => [0, 0, 1], 13)],
    THREE_QUARTER,
    motion.hands,
  );
}

function landminePress(): SceneSpec {
  const split = feet({ at: [-18, 8, 13], toe: toeOut(4) }, { at: [22, 8, -13], toe: toeOut(-6) });
  const pose = (h: V3, pole: V3): PoseSpec => ({
    pelvis: [0, 93, 0],
    pitch: 8,
    feet: split,
    hands: { r: { at: h, pole }, l: ON_HIP },
  });
  return two(
    pose([12, 140, 14], [0, -1, 0.3]),
    pose([46, 184, 8], [-0.2, -1, 0.3]),
    [landmine([170, 0, 0], 14, 'r')],
    THREE_QUARTER,
  );
}

function landmineSquat(): SceneSpec {
  const legs = stance(16, 0, 16);
  return two(
    {
      pelvis: [0, 93, 0],
      pitch: 8,
      feet: legs,
      hands: hands({ at: [20, 132, 5], pole: [0.2, -1, 0.6] }),
    },
    {
      pelvis: [-18, 54, 0],
      pitch: 24,
      feet: legs,
      hands: hands({ at: [16, 98, 5], pole: [0.2, -1, 0.6] }),
    },
    [landmine([170, 0, 0], 14)],
    THREE_QUARTER,
    motion.hips,
  );
}

export const EXTRAS_ART: Record<string, SceneSpec> = {
  // Pulling
  'bw-chin-up': pullUp(17, [], SIDE),
  'bw-neutral-grip-pull-up': pullUp(22, [grips('neutral')]),
  'bw-wide-grip-pull-up': pullUp(40),
  'bw-inverted-row': invertedRow(),
  'bw-weighted-dip': parallelDip(16, [beltPlate]),
  // Pushing
  'bw-chest-dip': parallelDip(24),
  'bw-triceps-dip': parallelDip(2),
  'bw-bench-dip': benchDip(),
  'bw-diamond-push-up': pushUp('diamond'),
  'bw-wide-push-up': pushUp('wide'),
  'bw-decline-push-up': pushUp('decline'),
  'bw-incline-push-up': pushUp('incline'),
  'bw-pike-push-up': pushUp('pike'),
  // Legs and hips
  'bw-squat': airSquat(false),
  'bw-lunge': regear(LEGS_ART['db-forward-lunge'], []),
  'bw-reverse-lunge': regear(LEGS_ART['db-reverse-lunge'], []),
  'bw-jump-squat': airSquat(true),
  'bw-box-jump': boxJump(),
  'bw-wall-sit': wallSit(),
  'bw-single-leg-glute-bridge': regear(LEGS_ART['db-single-leg-glute-bridge'], []),
  'bw-glute-bridge': regear(LEGS_ART['db-glute-bridge'], []),
  'bw-glute-ham-raise': glutHamRaise(),
  'bw-back-extension': backExtension(),
  // Core
  'bw-crunch': regear(CORE_ART['db-weighted-crunch'], []),
  'bw-bicycle-crunch': bicycle(),
  'bw-lying-leg-raise': lyingLegRaise(),
  'bw-hanging-knee-raise': kneeRaise(false),
  'bw-toes-to-bar': kneeRaise(true),
  'bw-side-plank': sidePlank(),
  'bw-hollow-hold': hollowHold(),
  'bw-mountain-climber': mountainClimber(),
  'bw-burpee': burpee(),
  'bw-russian-twist': regear(CORE_ART['db-russian-twist'], []),
  // Bands
  'bd-pull-apart': bandPullApart(),
  'bd-face-pull': bandFacePull(),
  'bd-lateral-walk': lateralWalk(),
  'bd-row': bandRow(),
  'bd-chest-press': bandPress(),
  'bd-curl': bandCurl(),
  'bd-pushdown': bandPushdown(),
  'bd-glute-bridge': bandedBridge(),
  'bd-assisted-pull-up': bandAssistedPullUp(),
  // Suspension trainer
  'st-row': trxRow(false),
  'st-chest-press': trxPress(),
  'st-biceps-curl': trxRow(true),
  'st-pike': trxPike(),
  'st-hamstring-curl': trxHamstringCurl(),
  // Medicine ball
  'mb-slam': slam(),
  'mb-wall-ball': wallBall(),
  'mb-russian-twist': regear(CORE_ART['db-russian-twist'], [medicineBall(undefined, 10)]),
  'mb-chest-pass': chestPass(),
  // Battle ropes and the sled
  'br-waves': ropes(false),
  'br-slams': ropes(true),
  'sl-push': sledPush(),
  'sl-drag': sledDrag(),
  // Trap bar, specialty bars, plates, landmine
  'tb-deadlift': trapBarDeadlift(),
  'tb-shrug': trapBarShrug(),
  'tb-farmers-carry': regear(CORE_ART['db-farmers-carry'], [trapBar()]),
  'sb-safety-squat': ssbSquat(),
  'sb-swiss-bar-bench': regear(LYING_ART['bb-bench-press'], [barbell(), grips('neutral')]),
  'pt-front-raise': plateFrontRaise(),
  'pt-pinch-hold': pinchHold(),
  'pt-svend-press': svendPress(),
  'bb-landmine-press': landminePress(),
  'bb-landmine-squat': landmineSquat(),
};
