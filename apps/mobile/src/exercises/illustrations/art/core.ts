import { add, scale, type V3 } from '../geometry';
import {
  abWheel,
  barbell,
  dumbbellAt,
  dumbbells,
  heldDumbbell,
  landmine,
  legRoller,
  mat,
} from '../props';
import type { FrameSpec, PropBuilder, SceneSpec } from '../render';
import type { FootTarget, LimbTarget, PoseSpec, Side, Skeleton } from '../rig';
import {
  feet,
  FRONT,
  hands,
  hanging,
  motion,
  scene,
  SIDE,
  stance,
  THREE_QUARTER,
  toeOut,
  torsoOf,
} from '../poseKit';

// Core work, carries, get-ups and the floor exercises.

const BACK_TOE: V3 = [0.55, -0.83, 0];
const mirrorZ = (p: V3): V3 => [p[0], p[1], -p[2]];

/** A walking stride, the `lead` foot in front. */
function stride(lead: Side): Record<Side, FootTarget> {
  const front: FootTarget = { at: [22, 8, 11] };
  const back: FootTarget = { at: [-24, 12, -11], toe: BACK_TOE };
  return lead === 'r'
    ? { r: front, l: back }
    : { r: { ...back, at: mirrorZ(back.at) }, l: { ...front, at: mirrorZ(front.at) } };
}
const WALK: V3 = [0, 91, 0];

function carry(
  handsAt: Record<Side, LimbTarget>,
  props: PropBuilder[],
  view = THREE_QUARTER,
): SceneSpec {
  return scene(
    [
      { pelvis: WALK, feet: stride('r'), hands: handsAt },
      { pelvis: WALK, feet: stride('l'), hands: handsAt },
    ],
    { view, props, motion: motion.foot },
  );
}

const overhead = (half: number): Record<Side, LimbTarget> =>
  hands({ at: [-1, 199, half], pole: [-0.2, -1, 0.4] });

// --------------------------------------------------------------------------------------- Floor work

const LIE: V3 = [8, 12, 0];
const floorMat = mat([-14, 0, 0], { x: 190, z: 66 });
const KNEES_UP = feet({ at: [40, 8, 14], pole: [0, 1, 0.15] });

/** A point in front of the chest for a torso position: `out` cm in front, `down` cm below the shoulders. */
function chest(
  pose: Pick<PoseSpec, 'pelvis' | 'pitch' | 'lean' | 'twist'>,
  out = 13,
  down = 9,
  z = 0,
): V3 {
  const s = torsoOf(pose);
  const f = s.frameAt(1);
  return add(
    add(add(s.shoulderCenter, scale(f.forward, out)), scale(f.up, -down)),
    scale(f.right, z),
  );
}

function sitUp(kind: 'dumbbell' | 'crunch' | 'bodyweight'): SceneSpec {
  const low = { pelvis: LIE, pitch: -90 };
  const high =
    kind === 'crunch' ? { pelvis: LIE, pitch: -64 } : { pelvis: [6, 12, 0] as V3, pitch: -6 };
  const handsFor = (pose: { pelvis: V3; pitch: number }): Record<Side, LimbTarget> => {
    if (kind === 'bodyweight') {
      const s = torsoOf(pose);
      const f = s.frameAt(1);
      return {
        r: { at: add(s.shoulders.l, scale(f.forward, 7)), pole: [0, -1, 0.8] },
        l: { at: add(s.shoulders.r, scale(f.forward, 9)), pole: [0, -1, -0.8] },
      };
    }
    return hands({ at: chest(pose, 15, 10, 5), pole: [0, -0.5, 1] });
  };
  return scene(
    [
      { ...low, feet: KNEES_UP, hands: handsFor(low) },
      { ...high, feet: KNEES_UP, hands: handsFor(high) },
    ],
    {
      view: THREE_QUARTER,
      props: [
        floorMat,
        ...(kind === 'bodyweight'
          ? []
          : [
              heldDumbbell(
                () => [0, 0, 1],
                () => [0, 0, 0],
              ),
            ]),
      ],
      motion: (s: Skeleton) => s.head,
    },
  );
}

function russianTwist(kind: 'dumbbell' | 'landmine'): SceneSpec {
  const pelvis: V3 = [4, 12, 0];
  const legs = feet({ at: [46, 20, 10], pole: [0, 1, 0.1] });
  const pose = (twist: number, side: number): PoseSpec => ({
    pelvis,
    pitch: -40,
    twist,
    feet: legs,
    hands: hands(
      { at: [16, 34, 24 * side], pole: [0, -0.6, side] },
      { at: [18, 32, 14 * side], pole: [0, -0.6, side] },
    ),
  });
  const gear: PropBuilder =
    kind === 'dumbbell'
      ? heldDumbbell(
          () => [0, 1, 0],
          () => [0, 2, 0],
        )
      : landmine([170, 2, 0], 10);
  return scene([pose(38, 1), pose(-38, -1)], {
    view: { yaw: -40, tilt: 22 },
    props: [floorMat, gear],
    motion: motion.hands,
  });
}

function plank(): SceneSpec {
  const s = torsoOf({ pelvis: [0, 27, 0], pitch: 84 });
  const forearms = hands({ at: [s.shoulders.r[0] + 26, 4, 9], pole: [0, -1, 0.3] });
  return {
    view: { yaw: -24, tilt: 12 },
    frames: [
      // Set up on the forearms with the knees down, shoulders where the plank holds them...
      {
        pose: {
          pelvis: [2.7, 15, 0],
          pitch: 70,
          headPitch: -6,
          feet: feet({ at: [-83, 9, 9], pole: [0, -1, 0], toe: [-1, -0.3, 0] }),
          hands: forearms,
        },
        props: [mat([-14, 0, 0], { x: 190, z: 66 })],
      },
      // ...then the knees lift into the plank.
      {
        pose: {
          pelvis: [0, 27, 0],
          pitch: 84,
          headPitch: -6,
          feet: feet({ at: [-84, 9, 9], toe: [0.25, -1, 0] }),
          hands: forearms,
        },
        props: [mat([-14, 0, 0], { x: 190, z: 66 })],
      },
    ],
  };
}

function plankDrag(): SceneSpec {
  const ankle = -76;
  const pelvis: V3 = [ankle + 79, 44, 0];
  const pitch = 72;
  const legs = feet({ at: [ankle, 9, 20], toe: [0.25, -1, 0] });
  const left = { at: [ankle + 128, 2, -21] as V3, pole: [-0.4, 0, -1] as V3 };
  const reach: V3 = [ankle + 126, 8, -38];
  const restingDb = dumbbellAt(
    () => [reach[0], 7, reach[2]],
    () => [1, 0, 0],
  );
  const frames: FrameSpec[] = [
    {
      pose: {
        pelvis,
        pitch,
        headPitch: -8,
        feet: legs,
        hands: { r: { at: [ankle + 128, 2, 21], pole: [-0.4, 0, 1] }, l: left },
      },
      props: [restingDb],
    },
    {
      pose: {
        pelvis,
        pitch,
        headPitch: -8,
        feet: legs,
        hands: { r: { at: [ankle + 126, 12, -14], pole: [-0.2, 0.6, 1] }, l: left },
      },
      props: [dumbbells('fb', ['r'])],
    },
  ];
  return { view: THREE_QUARTER, frames, motion: motion.hand };
}

function deadBug(): SceneSpec {
  const up = torsoOf({ pelvis: LIE, pitch: -90 });
  const grip: V3 = [up.shoulderCenter[0] + 4, up.shoulderCenter[1] + 56, 0];
  const bent = (side: number): FootTarget => ({ at: [50, 55, 11 * side], pole: [0, 1, 0] });
  return scene(
    [
      {
        pelvis: LIE,
        pitch: -90,
        feet: { r: bent(1), l: bent(-1) },
        hands: hands({ at: [grip[0], grip[1], 5], pole: [0, -1, 0.6] }),
      },
      {
        pelvis: LIE,
        pitch: -90,
        feet: { r: { at: [94, 16, 11], pole: [0, 1, 0] }, l: bent(-1) },
        hands: hands({ at: [grip[0], grip[1], 5], pole: [0, -1, 0.6] }),
      },
    ],
    {
      view: THREE_QUARTER,
      props: [
        floorMat,
        heldDumbbell(
          () => [0, 1, 0],
          () => [0, 6, 0],
        ),
      ],
      motion: motion.foot,
    },
  );
}

function rollout(kind: 'wheel' | 'barbell'): SceneSpec {
  const kneel = feet({ at: [-42, 8, 10], pole: [0.3, -1, 0], toe: [-0.3, -1, 0] });
  const bar = kind === 'barbell';
  const y = bar ? 21 : 13;
  const half = bar ? 18 : 7;
  return scene(
    [
      {
        pelvis: [0, bar ? 56 : 48, 0],
        pitch: bar ? 66 : 70,
        feet: kneel,
        hands: hands({ at: [bar ? 48 : 50, y, half], pole: [-0.3, 0, 1] }),
      },
      {
        pelvis: [16, bar ? 38 : 30, 0],
        pitch: bar ? 80 : 84,
        feet: kneel,
        hands: hands({ at: [bar ? 118 : 116, y, half], pole: [-0.3, 0, 1] }),
      },
    ],
    {
      view: { yaw: -26, tilt: 12 },
      props: [mat([10, 0, 0], { x: 200, z: 66 }), bar ? barbell() : abWheel()],
      motion: motion.hands,
    },
  );
}

function nordic(): SceneSpec {
  const kneel = feet({ at: [-42, 8, 10], pole: [0.3, -1, 0], toe: [-0.3, -1, 0] });
  const lean = 50;
  const hip: V3 = [
    44 * Math.sin((lean * Math.PI) / 180),
    6 + 44 * Math.cos((lean * Math.PI) / 180),
    0,
  ];
  const forward = torsoOf({ pelvis: hip, pitch: lean });
  return scene(
    [
      {
        pelvis: [1, 50, 0],
        feet: kneel,
        hands: hands({ at: [8, 104, 12], pole: [-0.3, -1, 0.6] }),
      },
      {
        pelvis: hip,
        pitch: lean,
        feet: kneel,
        hands: hands({ at: [forward.shoulders.r[0] + 20, 10, 20], pole: [-0.5, -0.4, 1] }),
      },
    ],
    {
      view: SIDE,
      props: [mat([0, 0, 0], { x: 160, z: 66 }), legRoller([-44, 16, 0])],
      motion: motion.head,
    },
  );
}

// ---------------------------------------------------------------------------------- Standing core

function sideBend(kind: 'dumbbell' | 'barbell'): SceneSpec {
  const pelvis: V3 = [0, 92, 0];
  const pose = (lean: number): PoseSpec => {
    const s = torsoOf({ pelvis, lean });
    if (kind === 'barbell') {
      const f = s.frameAt(1);
      const bar = add(add(s.shoulderCenter, scale(f.up, 4)), scale(f.forward, -7));
      return {
        pelvis,
        lean,
        feet: stance(15),
        hands: {
          r: { at: add(bar, scale(f.right, 32)), pole: [-0.2, -1, 0.5] },
          l: { at: add(bar, scale(f.right, -32)), pole: [-0.2, -1, -0.5] },
        },
      };
    }
    const hip = add(pelvis, scale(s.pelvisFrame.right, -16));
    return {
      pelvis,
      lean,
      feet: stance(15),
      hands: {
        r: {
          at: [s.shoulders.r[0] + 2, s.shoulders.r[1] - 57, s.shoulders.r[2] + 2],
          pole: [-0.2, -1, 0.2],
        },
        l: { at: add(hip, [6, 6, -4]), pole: [-0.4, 0, -1] },
      },
    };
  };
  const gear = kind === 'barbell' ? barbell() : dumbbells('fb', ['r']);
  return scene([pose(18), pose(-14)], {
    view: FRONT,
    props: [gear],
    motion: kind === 'barbell' ? motion.hands : motion.hand,
  });
}

function woodchop(kind: 'dumbbell' | 'landmine'): SceneSpec {
  const high: PoseSpec = {
    pelvis: [0, 93, 0],
    twist: 34,
    feet: stance(18, 0, 12),
    hands: hands(
      { at: [6, 184, 30], pole: [-0.3, -1, 0.6] },
      { at: [8, 180, 22], pole: [-0.3, -1, 0.6] },
    ),
  };
  const low: PoseSpec = {
    pelvis: [-8, 80, 0],
    pitch: 26,
    twist: -42,
    feet: feet({ at: [0, 8, 18], toe: toeOut(12) }, { at: [0, 10, -18], toe: [0.8, -0.4, -0.35] }),
    hands: hands(
      { at: [22, 74, -22], pole: [-0.3, -1, -0.3] },
      { at: [22, 76, -14], pole: [-0.3, -1, -0.3] },
    ),
  };
  const gear: PropBuilder =
    kind === 'dumbbell'
      ? heldDumbbell(
          () => [0, 1, 0],
          () => [0, 0, 0],
        )
      : landmine([170, 2, 70], 10);
  return scene([high, low], { view: THREE_QUARTER, props: [gear], motion: motion.hands });
}

function landmineRotation(): SceneSpec {
  return scene(
    [
      {
        pelvis: [0, 93, 0],
        feet: stance(17),
        hands: hands(
          { at: [50, 150, 6], pole: [-0.3, -1, 0.4] },
          { at: [50, 150, -6], pole: [-0.3, -1, -0.4] },
        ),
      },
      {
        pelvis: [0, 90, 0],
        twist: 42,
        feet: {
          r: { at: [0, 8, 17], toe: toeOut(30) },
          l: { at: [0, 10, -17], toe: [0.85, -0.4, 0.3] },
        },
        hands: hands(
          { at: [24, 98, 30], pole: [-0.3, -1, 0.5] },
          { at: [26, 102, 22], pole: [-0.3, -1, 0.5] },
        ),
      },
    ],
    { view: THREE_QUARTER, props: [landmine([170, 2, 0], 10)], motion: motion.hands },
  );
}

function windmill(kind: 'dumbbell' | 'barbell'): SceneSpec {
  // Both feet turned away from the arm overhead.
  const legs = feet({ at: [4, 8, 22], toe: toeOut(-35) }, { at: [-4, 8, -22], toe: toeOut(-35) });
  const pose = (pelvis: V3, pitch: number, lean: number, twist: number, drop: number): PoseSpec => {
    const s = torsoOf({ pelvis, pitch, lean, twist });
    const reach: V3 = [s.shoulders.l[0] + 2, s.shoulders.l[1] - drop, s.shoulders.l[2]];
    return {
      pelvis,
      pitch,
      lean,
      twist,
      feet: legs,
      hands: {
        r: {
          at: [s.shoulders.r[0], s.shoulders.r[1] + 57, s.shoulders.r[2]],
          pole: [-0.3, -1, 0.3],
        },
        l: { at: reach, pole: [-0.2, -1, -0.3] },
      },
    };
  };
  const gear: PropBuilder =
    kind === 'dumbbell'
      ? dumbbells('lr', ['r'])
      : barbell({
          place: (s: Skeleton) => ({ center: s.arms.r.end, axis: [0, 0, 1] }),
          kind: 'ez',
        });
  return scene([pose([0, 93, 4], 0, 0, -20, 57), pose([-6, 86, 14], 52, -34, -40, 58)], {
    view: FRONT,
    props: [gear],
    motion: motion.leftHand,
  });
}

function getUp(kind: 'dumbbell' | 'barbell'): SceneSpec {
  const above = (pose: Pick<PoseSpec, 'pelvis' | 'pitch' | 'lean' | 'twist'>): V3 => {
    const s = torsoOf(pose);
    return [s.shoulders.r[0], s.shoulders.r[1] + 58, s.shoulders.r[2]];
  };
  const lying = { pelvis: LIE, pitch: -90 };
  const propped = { pelvis: [8, 12, -4] as V3, pitch: -36, lean: -12 };
  const standing = { pelvis: [0, 94, 0] as V3, pitch: 0 };
  const gear: PropBuilder =
    kind === 'dumbbell'
      ? dumbbells('lr', ['r'])
      : barbell({
          place: (s: Skeleton) => ({ center: s.arms.r.end, axis: [1, 0, 0] }),
          kind: 'ez',
        });
  return scene(
    [
      {
        ...lying,
        feet: { r: { at: [38, 8, 16], pole: [0, 1, 0.2] }, l: { at: [86, 8, -18] } },
        hands: {
          r: { at: above(lying), pole: [0, -1, 0.3] },
          l: { at: [-12, 4, -56], pole: [0, 1, -0.3] },
        },
      },
      {
        ...propped,
        feet: { r: { at: [38, 8, 16], pole: [0, 1, 0.2] }, l: { at: [86, 8, -18] } },
        hands: {
          r: { at: above(propped), pole: [0, -1, 0.3] },
          l: { at: [-28, 3, -40], pole: [-0.5, 0, -1] },
        },
      },
      {
        ...standing,
        feet: stance(13),
        hands: {
          r: { at: above(standing), pole: [-0.2, -1, 0.3] },
          l: hanging(standing.pelvis, 0).l,
        },
      },
    ],
    { view: THREE_QUARTER, props: [floorMat, gear], motion: motion.hand },
  );
}

export const CORE_ART: Record<string, SceneSpec> = {
  'db-farmers-carry': carry(hanging(WALK, 0, 4), [dumbbells('fb')]),
  'db-suitcase-carry': carry(
    { r: hanging(WALK, 0, 4).r, l: { at: [6, 90, -22], pole: [-0.3, -1, -0.3] } },
    [dumbbells('fb', ['r'])],
    FRONT,
  ),
  'db-overhead-carry': carry(overhead(19), [dumbbells('lr')]),
  'bb-overhead-carry': carry(overhead(27), [barbell()]),
  'db-russian-twist': russianTwist('dumbbell'),
  'bb-russian-twist': russianTwist('landmine'),
  'db-sit-up': sitUp('dumbbell'),
  'db-weighted-crunch': sitUp('crunch'),
  'bw-sit-up': sitUp('bodyweight'),
  'db-side-bend': sideBend('dumbbell'),
  'bb-side-bend': sideBend('barbell'),
  'db-woodchop': woodchop('dumbbell'),
  'bb-landmine-woodchop': woodchop('landmine'),
  'bb-landmine-rotation': landmineRotation(),
  'db-windmill': windmill('dumbbell'),
  'bb-windmill': windmill('barbell'),
  'db-turkish-get-up': getUp('dumbbell'),
  'bb-turkish-get-up': getUp('barbell'),
  'db-plank-drag': plankDrag(),
  'db-dead-bug': deadBug(),
  'bb-rollout': rollout('barbell'),
  'bw-ab-wheel-rollout': rollout('wheel'),
  'bw-plank': plank(),
  'bw-nordic-hamstring-curl': nordic(),
};
