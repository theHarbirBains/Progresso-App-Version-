import { add, type V3 } from '../geometry';
import {
  barbell,
  bench,
  dumbbellAt,
  dumbbells,
  heldDumbbell,
  landmine,
  platform,
  pullUpBar,
  rackPins,
} from '../props';
import type { PropBuilder, SceneSpec } from '../render';
import type { PoseSpec, Side, Skeleton } from '../rig';
import {
  BACK_THREE_QUARTER,
  barOnBack,
  feet,
  FRONT,
  hands,
  mirror,
  motion,
  scene,
  shoulderAt,
  SIDE,
  stance,
  THREE_QUARTER,
  toeOut,
} from '../poseKit';

// Rows, rear-delt work, pull-ups and hangs, and the hinges: deadlifts, RDLs and good mornings.

const FEET = stance(13);
const PULL: V3 = [-0.7, 1, 0.3];
const HANG: V3 = [-0.3, -1, 0.2];

// ------------------------------------------------------------------------------------------ Rows

function bentRow(
  gear: PropBuilder,
  pitch: number,
  width: number,
  opts: { from?: number; to?: V3; pelvis?: V3 } = {},
): SceneSpec {
  const pelvis: V3 = opts.pelvis ?? [-12, 90, 0];
  const s = shoulderAt(pelvis, pitch);
  const start: V3 = [opts.from !== undefined ? s[0] - 2 : s[0], opts.from ?? s[1] - 56, width];
  const end: V3 = opts.to ?? [10, 92 + (90 - pitch) * 0.12, width];
  const pose = (hand: V3, pole: V3): PoseSpec => ({
    pelvis,
    pitch,
    feet: stance(14),
    hands: hands({ at: hand, pole }),
  });
  return scene([pose(start, HANG), pose(end, PULL)], {
    view: SIDE,
    props: [gear],
    motion: motion.hand,
  });
}

function singleArmRow(): SceneSpec {
  const pelvis: V3 = [-8, 88, 0];
  const pitch = 80;
  const s = shoulderAt(pelvis, pitch);
  const legs = {
    r: { at: [-6, 8, 26] as V3, pole: [1, 0, 0.3] as V3 },
    l: { at: [-48, 50, -10] as V3, pole: [0.3, -1, 0] as V3, toe: [-1, -0.2, 0] as V3 },
  };
  const brace = { at: [s[0] + 3, 48, -17] as V3, pole: [-0.3, 0, -1] as V3 };
  const pose = (hand: V3, pole: V3): PoseSpec => ({
    pelvis,
    pitch,
    feet: legs,
    hands: { r: { at: hand, pole }, l: brace },
  });
  return scene([pose([s[0], s[1] - 56, 21], HANG), pose([14, 92, 21], PULL)], {
    view: SIDE,
    props: [bench({ at: [-4, 44, -14] }), dumbbells('fb', ['r'])],
    motion: motion.hand,
  });
}

/** Face-down on an incline bench. */
const PRONE: V3 = [-6, 64, 0];
const PRONE_PITCH = 50;
const proneBench = bench({ at: [-10, 46, 0], angle: -40, length: 84 });
const PRONE_FEET = feet({ at: [-56, 8, 14], toe: [0.4, -0.6, 0] });
const PS = shoulderAt(PRONE, PRONE_PITCH);
function prone(r: { at: V3; pole?: V3 }): PoseSpec {
  return { pelvis: PRONE, pitch: PRONE_PITCH, feet: PRONE_FEET, hands: hands(r), headPitch: -20 };
}

function chestSupportedRow(): SceneSpec {
  return scene(
    [
      prone({ at: [PS[0] + 1, PS[1] - 56, 21], pole: HANG }),
      prone({ at: [PS[0] - 20, PS[1] - 16, 22], pole: PULL }),
    ],
    { view: SIDE, props: [proneBench, dumbbells('fb')], motion: motion.hand },
  );
}

/** Raising the arms out wide from a bent-over (or face-down) position. */
const FLY_VIEW = { yaw: -64, tilt: 30 };
function rearDeltFly(): SceneSpec {
  const pelvis: V3 = [-14, 88, 0];
  const pitch = 76;
  const s = shoulderAt(pelvis, pitch);
  const pose = (hand: V3, pole: V3): PoseSpec => ({
    pelvis,
    pitch,
    feet: stance(14),
    hands: hands({ at: hand, pole }),
    headPitch: -10,
  });
  return scene(
    [pose([s[0] + 2, s[1] - 55, 10], [0, 0.2, 1]), pose([s[0] + 2, s[1] - 6, 74], [0, 0.6, 0.4])],
    {
      view: FLY_VIEW,
      props: [dumbbells('fb')],
      motion: motion.hand,
    },
  );
}

function inclineRearDeltFly(): SceneSpec {
  return scene(
    [
      prone({ at: [PS[0] + 2, PS[1] - 55, 10], pole: [0, 0.2, 1] }),
      prone({ at: [PS[0] + 2, PS[1] - 4, 74], pole: [0, 0.6, 0.4] }),
    ],
    { view: FLY_VIEW, props: [proneBench, dumbbells('fb')], motion: motion.hand },
  );
}

function yRaise(): SceneSpec {
  const up: V3 = [
    Math.sin((PRONE_PITCH * Math.PI) / 180),
    Math.cos((PRONE_PITCH * Math.PI) / 180),
    0,
  ];
  const reach = (d: number, out: number): V3 => [PS[0] + up[0] * d, PS[1] + up[1] * d, out];
  return scene(
    [
      prone({ at: [PS[0] + 1, PS[1] - 55, 21], pole: HANG }),
      prone({ at: reach(53, 42), pole: [0, -1, 0.2] }),
    ],
    { view: FLY_VIEW, props: [proneBench, dumbbells('fb')], motion: motion.hand },
  );
}

function renegadeRow(): SceneSpec {
  const ankle = -76;
  const base = (rHand: V3, rPole: V3): PoseSpec => ({
    pelvis: [ankle + 79, 44, 0],
    pitch: 68,
    hands: { r: { at: rHand, pole: rPole }, l: { at: [ankle + 128, 9, -20], pole: [-0.4, 0, -1] } },
    feet: feet({ at: [ankle, 9, 18], toe: [0.25, -1, 0] }),
    headPitch: -8,
  });
  return scene([base([ankle + 128, 9, 20], [-0.4, 0, 1]), base([ankle + 100, 44, 22], PULL)], {
    view: THREE_QUARTER,
    props: [dumbbells('fb')],
    motion: motion.hand,
  });
}

function tBarRow(): SceneSpec {
  const pelvis: V3 = [-12, 88, 0];
  const pitch = 58;
  const s = shoulderAt(pelvis, pitch);
  const legs = stance(20, 0, 15);
  return scene(
    [
      {
        pelvis,
        pitch,
        feet: legs,
        hands: hands({ at: [s[0] + 2, s[1] - 55, 5], pole: [-0.2, -0.4, 1] }),
      },
      { pelvis, pitch, feet: legs, hands: hands({ at: [14, 94, 5], pole: [-0.5, 0.6, 1] }) },
    ],
    { view: SIDE, props: [landmine([-112, 2, 0], 14)], motion: motion.hands },
  );
}

function meadowsRow(): SceneSpec {
  const pelvis: V3 = [-12, 88, 0];
  const pitch = 66;
  const s = shoulderAt(pelvis, pitch);
  const legs = { r: { at: [-14, 8, 22] as V3 }, l: { at: [22, 8, -12] as V3, toe: toeOut(-10) } };
  const brace = { at: [20, 56, -16] as V3, pole: [-0.3, 0, -1] as V3 };
  const pose = (hand: V3, pole: V3): PoseSpec => ({
    pelvis,
    pitch,
    feet: legs,
    hands: { r: { at: hand, pole }, l: brace },
  });
  return scene([pose([s[0], s[1] - 56, 21], HANG), pose([12, 96, 28], [-0.3, 1, 0.8])], {
    view: SIDE,
    props: [landmine([s[0] + 4, 2, -118], 12, 'r')],
    motion: motion.hand,
  });
}

// ---------------------------------------------------------------------------------- Pull-ups, hangs

const BAR_HEIGHT = 226;
function hangPose(shoulderY: number, handPole: V3, legs: PoseSpec['feet']): PoseSpec {
  const pelvis: V3 = [-2, shoulderY - 49, 0];
  return { pelvis, feet: legs, hands: hands({ at: [0, BAR_HEIGHT, 26], pole: handPole }) };
}

function pullUp(weighted: boolean): SceneSpec {
  const bottom = hangPose(
    BAR_HEIGHT - 57,
    [0, -1, 0.3],
    feet({ at: [-14, BAR_HEIGHT - 57 - 49 - 82, 10], toe: [0.3, -1, 0] }),
  );
  const top = hangPose(
    BAR_HEIGHT - 16,
    [0, -1, 0.8],
    feet({ at: [-14, BAR_HEIGHT - 16 - 49 - 82, 10], toe: [0.3, -1, 0] }),
  );
  const gear: PropBuilder[] = [pullUpBar(BAR_HEIGHT)];
  if (weighted) {
    gear.push(
      dumbbellAt(
        (s: Skeleton) => add(s.pelvis, [4, -24, 0]),
        () => [0, 1, 0],
      ),
    );
  }
  return scene([bottom, top], { view: BACK_THREE_QUARTER, props: gear, motion: motion.hips });
}

function deadHang(): SceneSpec {
  return {
    view: BACK_THREE_QUARTER,
    frames: [
      {
        pose: hangPose(
          BAR_HEIGHT - 59,
          [0, -1, 0.2],
          feet({ at: [-10, BAR_HEIGHT - 59 - 49 - 84, 10], toe: [0.3, -1, 0] }),
        ),
        props: [pullUpBar(BAR_HEIGHT)],
      },
    ],
  };
}

function hangingLegRaise(): SceneSpec {
  const shoulderY = BAR_HEIGHT - 58;
  const pelvisY = shoulderY - 49;
  return scene(
    [
      hangPose(shoulderY, [0, -1, 0.2], feet({ at: [-8, pelvisY - 84, 9], toe: [0.3, -1, 0] })),
      {
        ...hangPose(
          shoulderY,
          [0, -1, 0.2],
          feet({ at: [80, pelvisY + 6, 9], pole: [0, 1, 0], toe: [0.3, 0.2, 0] }),
        ),
        pitch: -12,
      },
    ],
    { view: SIDE, props: [pullUpBar(BAR_HEIGHT)], motion: motion.foot },
  );
}

// ---------------------------------------------------------------------------------------- Hinges

interface Hinge {
  pelvis: V3;
  pitch: number;
  hand: V3;
}

function hinge(
  gear: PropBuilder | PropBuilder[],
  start: Hinge,
  end: Hinge,
  opts: {
    width?: number;
    legs?: PoseSpec['feet'];
    view?: typeof SIDE;
    poles?: [V3, V3];
    motionAt?: (s: Skeleton) => V3;
  } = {},
): SceneSpec {
  const width = opts.width ?? 21;
  const legs = opts.legs ?? stance(13);
  const [p0, p1] = opts.poles ?? [HANG, HANG];
  // A wider grip holds the bar higher at the top.
  const lift = (h: Hinge) => (h.pitch < 20 ? Math.max(0, width - 21) * 0.32 : 0);
  const pose = (h: Hinge, pole: V3): PoseSpec => ({
    pelvis: h.pelvis,
    pitch: h.pitch,
    feet: legs,
    hands: hands({ at: [h.hand[0], h.hand[1] + lift(h), width], pole }),
  });
  return scene([pose(start, p0), pose(end, p1)], {
    view: opts.view ?? THREE_QUARTER,
    props: Array.isArray(gear) ? gear : [gear],
    motion: opts.motionAt ?? motion.hands,
  });
}

const TOP: Hinge = { pelvis: [0, 94, 0], pitch: 4, hand: [10, 85, 0] };
const FLOOR_BAR = 21;

const deadlift = (width = 21, legs?: PoseSpec['feet']) =>
  hinge(barbell(), { pelvis: [-30, 54, 0], pitch: 58, hand: [8, FLOOR_BAR, 0] }, TOP, {
    width,
    legs,
  });

function rdl(
  gear: PropBuilder | PropBuilder[],
  width = 21,
  depth = 46,
  legs?: PoseSpec['feet'],
): SceneSpec {
  return hinge(
    gear,
    TOP,
    { pelvis: [-28, 88, 0], pitch: 74, hand: [15, depth, 0] },
    { width, legs },
  );
}

function stiffLeg(gear: PropBuilder, width = 21): SceneSpec {
  return hinge(gear, { pelvis: [-26, 88, 0], pitch: 92, hand: [12, 28, 0] }, TOP, { width });
}

function singleLegRdl(gear: PropBuilder, oneHand: boolean): SceneSpec {
  const standing: V3 = [0, 8, 12];
  const pose = (pelvis: V3, pitch: number, back: V3, handY: number): PoseSpec => {
    const s = shoulderAt(pelvis, pitch);
    const reach: V3 = [s[0] + 2, handY, 20];
    return {
      pelvis,
      pitch,
      feet: { r: { at: standing }, l: { at: back, pole: [0, -1, 0], toe: [-0.3, -1, 0] } },
      hands: oneHand
        ? { r: { at: reach, pole: HANG }, l: { at: mirror(reach), pole: mirror(HANG) } }
        : hands({ at: reach, pole: HANG }),
    };
  };
  return scene(
    [pose([0, 94, 4], 2, [-16, 14, -12], 86), pose([-6, 92, 4], 82, [-86, 70, -12], 40)],
    { view: THREE_QUARTER, props: [gear], motion: motion.hips },
  );
}

function goodMorning(): SceneSpec {
  const top: PoseSpec = { pelvis: [0, 94, 0], feet: FEET, hands: barOnBack([0, 94, 0], 0) };
  const low: PoseSpec = {
    pelvis: [-22, 90, 0],
    pitch: 78,
    feet: FEET,
    hands: barOnBack([-22, 90, 0], 78),
  };
  return scene([top, low], { view: SIDE, props: [barbell()], motion: motion.hips });
}

function dumbbellGoodMorning(): SceneSpec {
  const chest = (pelvis: V3, pitch: number): V3 => {
    const p = (pitch * Math.PI) / 180;
    const s = shoulderAt(pelvis, pitch);
    return [
      s[0] + Math.cos(p) * 15 - Math.sin(p) * 10,
      s[1] - Math.sin(p) * 15 - Math.cos(p) * 10,
      4,
    ];
  };
  const make = (pelvis: V3, pitch: number): PoseSpec => ({
    pelvis,
    pitch,
    feet: FEET,
    hands: hands({ at: chest(pelvis, pitch), pole: [-0.2, -1, 0.6] }),
  });
  return scene([make([0, 94, 0], 2), make([-22, 90, 0], 76)], {
    view: SIDE,
    props: [
      heldDumbbell(
        (s: Skeleton) => s.frameAt(1).up,
        () => [0, 0, 0],
      ),
    ],
    motion: motion.hips,
  });
}

function sumoDeadlift(): SceneSpec {
  const legs = feet({ at: [2, 8, 34], toe: toeOut(38), pole: [0.7, 0, 0.8] });
  return hinge(
    barbell(),
    { pelvis: [-24, 46, 0], pitch: 50, hand: [8, FLOOR_BAR, 0] },
    { pelvis: [0, 90, 0], pitch: 3, hand: [10, 82, 0] },
    { width: 15, legs, view: FRONT },
  );
}

function dumbbellDeadlift(): SceneSpec {
  return hinge(
    dumbbells('lr'),
    { pelvis: [-34, 52, 0], pitch: 62, hand: [4, 18, 0] },
    { pelvis: [0, 94, 0], pitch: 2, hand: [4, 86, 0] },
    { width: 24 },
  );
}

export const BACK_ART: Record<string, SceneSpec> = {
  'db-bent-over-row': bentRow(dumbbells('fb'), 52, 21),
  'bb-bent-over-row': bentRow(barbell(), 52, 22),
  'bb-underhand-row': bentRow(barbell(), 50, 19),
  'bb-pendlay-row': bentRow(barbell(), 86, 24, {
    pelvis: [-40, 76, 0],
    from: FLOOR_BAR + 3,
    to: [-4, 62, 24],
  }),
  'bb-yates-row': bentRow(barbell(), 26, 20, { to: [14, 104, 20] }),
  'db-single-arm-row': singleArmRow(),
  'db-chest-supported-row': chestSupportedRow(),
  'db-renegade-row': renegadeRow(),
  'bb-t-bar-row': tBarRow(),
  'bb-meadows-row': meadowsRow(),
  'db-rear-delt-fly': rearDeltFly(),
  'db-incline-rear-delt-fly': inclineRearDeltFly(),
  'db-y-raise': yRaise(),
  'bw-pull-up': pullUp(false),
  'bw-weighted-pull-up': pullUp(true),
  'bw-dead-hang': deadHang(),
  'bw-hanging-leg-raise': hangingLegRaise(),

  'bb-deadlift': deadlift(),
  'bb-snatch-grip-deadlift': hinge(
    barbell(),
    { pelvis: [-32, 50, 0], pitch: 60, hand: [8, FLOOR_BAR, 0] },
    TOP,
    { width: 44 },
  ),
  'bb-deficit-deadlift': hinge(
    [platform([0, 7, 0], { x: 56, z: 64 }), barbell()],
    { pelvis: [-32, 54, 0], pitch: 62, hand: [8, FLOOR_BAR, 0] },
    { pelvis: [0, 101, 0], pitch: 4, hand: [10, 92, 0] },
    { legs: feet({ at: [0, 15, 13], toe: toeOut(8) }) },
  ),
  'bb-rack-pull': hinge(
    [rackPins(52, 10), barbell()],
    { pelvis: [-20, 77, 0], pitch: 48, hand: [10, 53, 0] },
    TOP,
  ),
  'bb-sumo-deadlift': sumoDeadlift(),
  'db-deadlift': dumbbellDeadlift(),
  'bb-romanian-deadlift': rdl(barbell()),
  'db-romanian-deadlift': rdl(dumbbells('lr'), 21, 46),
  'bb-snatch-grip-rdl': rdl(barbell(), 42, 50),
  'bb-deficit-rdl': hinge(
    [platform([0, 7, 0], { x: 56, z: 64 }), barbell()],
    { pelvis: [0, 101, 0], pitch: 4, hand: [10, 92, 0] },
    { pelvis: [-30, 94, 0], pitch: 92, hand: [18, 36, 0] },
    { legs: feet({ at: [0, 15, 13], toe: toeOut(8) }) },
  ),
  'bb-stiff-leg-deadlift': stiffLeg(barbell()),
  'db-stiff-leg-deadlift': stiffLeg(dumbbells('lr')),
  'db-single-leg-rdl': singleLegRdl(dumbbells('lr', ['l'] as Side[]), true),
  'bb-single-leg-rdl': singleLegRdl(barbell(), false),
  'bb-good-morning': goodMorning(),
  'db-good-morning': dumbbellGoodMorning(),
};
