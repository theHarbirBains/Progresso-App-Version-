import { add, normalize, sub, type V3 } from '../geometry';
import { barbell, bench, dumbbellAt, dumbbells, heldDumbbell, post, preacherBench } from '../props';
import type { FrameSpec, PropBuilder, SceneSpec } from '../render';
import type { PoseSpec, Skeleton } from '../rig';
import {
  FRONT,
  hands,
  motion,
  scene,
  shoulderAt,
  SIDE,
  stance,
  STAND,
  THREE_QUARTER,
  feet,
  toeOut,
} from '../poseKit';

// Standing and seated upper-body exercises: curls, presses, raises, shrugs, upright rows,
// overhead triceps work and the forearm exercises.

const FEET = stance(13);

function stand(
  r: V3 | { at: V3; pole?: V3 },
  extra: Partial<PoseSpec> = {},
  l?: { at: V3; pole?: V3 },
): PoseSpec {
  return { pelvis: STAND, feet: FEET, hands: hands(r, l), ...extra };
}

/** Sitting on the end of a flat bench, facing along it. */
const SEAT: V3 = [-2, 53, 0];
const SEAT_FEET = feet({ at: [40, 8, 17], toe: toeOut(10) });
const seatBench = bench({ at: [-48, 44, 0] });
function sit(
  r: V3 | { at: V3; pole?: V3 },
  extra: Partial<PoseSpec> = {},
  l?: { at: V3; pole?: V3 },
): PoseSpec {
  return { pelvis: SEAT, feet: SEAT_FEET, hands: hands(r, l), ...extra };
}

/** Sitting against an upright back pad. */
const UPRIGHT: V3 = [-5, 53, 0];
const uprightBench = bench({ at: [6, 44, 0], angle: 82, length: 78 });
function sitUpright(r: V3 | { at: V3; pole?: V3 }, extra: Partial<PoseSpec> = {}): PoseSpec {
  return { pelvis: UPRIGHT, pitch: -6, feet: SEAT_FEET, hands: hands(r), ...extra };
}

const DOWN_BACK: V3 = [-1, -0.6, 0.15];
const ELBOWS_DOWN_OUT: V3 = [-0.15, -1, 0.9];
const ELBOWS_FORWARD: V3 = [0.5, -1, 0.25];
const ELBOWS_UP: V3 = [0.4, 1, 0.1];

function two(
  a: PoseSpec,
  b: PoseSpec,
  props: PropBuilder[],
  view = SIDE,
  m = motion.hand,
): SceneSpec {
  return scene([a, b], { view, props, motion: m });
}

// ------------------------------------------------------------------------------------------ Curls

function curl(
  gear: PropBuilder,
  width: number,
  x0: number,
  opts: { seated?: boolean; alternate?: boolean; view?: typeof SIDE; lowering?: boolean } = {},
): SceneSpec {
  const make = opts.seated ? sit : stand;
  const y0 = opts.seated ? 46 : 86;
  const y1 = opts.seated ? 96 : 136;
  const down = { at: [x0, y0, width] as V3, pole: DOWN_BACK };
  const up = { at: [17, y1, width - 1] as V3, pole: DOWN_BACK };
  const finish = opts.alternate
    ? make(up, {}, { at: [x0, y0, -width], pole: [-1, -0.6, -0.15] })
    : make(up);
  // A Zottman curl turns the palms down at the top and lowers slowly: a third step, halfway down.
  const halfway = make({ at: [21, (y0 + y1) / 2 + 6, width] as V3, pole: DOWN_BACK });
  return scene(opts.lowering ? [make(down), finish, halfway] : [make(down), finish], {
    view: opts.view ?? SIDE,
    props: [...(opts.seated ? [seatBench] : []), gear],
    motion: motion.hand,
  });
}

const db = (axis: 'lr' | 'fb' = 'lr', sides?: readonly ('r' | 'l')[]) => dumbbells(axis, sides);

function crossBody(): SceneSpec {
  return two(
    stand({ at: [4, 86, 21], pole: DOWN_BACK }),
    stand(
      { at: [16, 130, 3], pole: [-0.6, -0.8, 0.5] },
      {},
      { at: [4, 86, -21], pole: [-1, -0.6, -0.15] },
    ),
    [db('fb')],
    THREE_QUARTER,
  );
}

function dragCurl(gear: PropBuilder, width: number): SceneSpec {
  return two(
    stand({ at: [11, 86, width], pole: DOWN_BACK }),
    stand({ at: [9, 124, width], pole: [-1, -0.2, 0.25] }),
    [gear],
  );
}

/** One dumbbell held upright by its top plate, both palms under it. */
const waiter = heldDumbbell(
  () => [0, 1, 0],
  () => [0, -8, 0],
);

function cheatCurl(): SceneSpec {
  return two(
    {
      pelvis: [-6, 90, 0],
      pitch: 14,
      feet: FEET,
      hands: hands({ at: [16, 80, 19], pole: DOWN_BACK }),
    },
    stand({ at: [17, 136, 19], pole: DOWN_BACK }, { pitch: -4 }),
    [barbell()],
  );
}

function preacher(gear: PropBuilder, single: boolean): SceneSpec {
  const pad = preacherBench([20, 112, 0], [-14, 56, 0]);
  const seat: V3 = [-14, 64, 0];
  const legs = feet({ at: [24, 8, 16], toe: toeOut(8) });
  const pose = (hand: V3): PoseSpec => ({
    pelvis: seat,
    pitch: 18,
    feet: legs,
    hands: single
      ? { r: { at: hand, pole: [0.3, -1, 0.1] }, l: { at: [22, 112, -14], pole: [0, -1, -0.2] } }
      : hands({ at: hand, pole: [0.3, -1, 0.1] }),
  });
  return scene([pose([52, 88, 16]), pose([30, 142, 16])], {
    view: SIDE,
    props: [pad, gear],
    motion: motion.hand,
  });
}

/** Face-down on an incline bench, arms hanging straight down (spider curls, rear delt flies, rows). */
const PRONE: V3 = [-6, 64, 0];
const PRONE_PITCH = 50;
const proneBench = bench({ at: [-10, 46, 0], angle: -40, length: 84 });
const PRONE_FEET = feet({ at: [-56, 8, 14], toe: [0.4, -0.6, 0] });
function prone(r: V3 | { at: V3; pole?: V3 }): PoseSpec {
  return { pelvis: PRONE, pitch: PRONE_PITCH, feet: PRONE_FEET, hands: hands(r), headPitch: -20 };
}
const proneShoulder = shoulderAt(PRONE, PRONE_PITCH);

function spiderCurl(gear: PropBuilder): SceneSpec {
  return scene(
    [
      prone({ at: [proneShoulder[0] + 3, proneShoulder[1] - 57, 21], pole: [-1, 0, 0.1] }),
      prone({ at: [proneShoulder[0] + 18, proneShoulder[1] - 18, 20], pole: [-1, 0.2, 0.1] }),
    ],
    { view: SIDE, props: [proneBench, gear], motion: motion.hand },
  );
}

function concentration(): SceneSpec {
  const pelvis: V3 = [-6, 53, 0];
  const legs = feet({ at: [34, 8, 30], toe: toeOut(30) });
  const rest = { at: [24, 64, -22] as V3, pole: [0, -1, -0.3] as V3 };
  return scene(
    [
      {
        pelvis,
        pitch: 36,
        feet: legs,
        hands: { r: { at: [27, 38, 10], pole: [-0.4, 0.3, 1] }, l: rest },
      },
      {
        pelvis,
        pitch: 36,
        feet: legs,
        hands: { r: { at: [34, 72, 8], pole: [-0.4, -0.3, 1] }, l: rest },
      },
    ],
    { view: THREE_QUARTER, props: [seatBench, db('lr', ['r'])], motion: motion.hand },
  );
}

function inclineCurl(): SceneSpec {
  const pelvis: V3 = [-10, 55, 0];
  const legs = feet({ at: [36, 8, 18], pole: [0.4, 1, 0.2] });
  const s = shoulderAt(pelvis, -45);
  return scene(
    [
      {
        pelvis,
        pitch: -45,
        feet: legs,
        hands: hands({ at: [s[0] - 4, s[1] - 58, 22], pole: [0.2, 0, 1] }),
      },
      {
        pelvis,
        pitch: -45,
        feet: legs,
        hands: hands({ at: [s[0] + 14, s[1] - 16, 20], pole: [-0.6, -1, 0.2] }),
      },
    ],
    { view: SIDE, props: [bench({ at: [8, 44, 0], angle: 50 }), db('lr')], motion: motion.hand },
  );
}

// ---------------------------------------------------------------------------------------- Presses

function press(
  gear: PropBuilder,
  width: number,
  opts: { seated?: boolean; behind?: boolean; arnold?: boolean; bar?: boolean } = {},
): SceneSpec {
  const make = opts.seated ? sitUpright : (r: { at: V3; pole?: V3 }) => stand(r);
  const lift = opts.seated ? -41 : 0;
  const rack: V3 = opts.behind
    ? [-10, 150 + lift, width]
    : opts.arnold
      ? [11, 134 + lift, 11]
      : opts.bar
        ? [11, 143 + lift, width]
        : [5, 146 + lift, width + 6];
  const pole = opts.arnold
    ? ELBOWS_FORWARD
    : opts.bar && !opts.behind
      ? ([0.5, -1, 0.4] as V3)
      : ELBOWS_DOWN_OUT;
  const top: V3 = [-1, 200 + lift, opts.bar ? width : 17];
  return scene([make({ at: rack, pole }), make({ at: top, pole })], {
    view: SIDE,
    props: [...(opts.seated ? [uprightBench] : []), gear],
    motion: opts.bar ? motion.hands : motion.hand,
  });
}

function pushPress(): SceneSpec {
  const rack: V3 = [11, 143, 24];
  const pole: V3 = [0.5, -1, 0.4];
  return scene(
    [
      stand({ at: rack, pole }),
      { pelvis: [-3, 84, 0], feet: FEET, hands: hands({ at: [9, 133, 24], pole }) },
      {
        pelvis: [0, 95, 0],
        feet: feet({ at: [0, 10, 13], toe: [0.8, -0.5, 0.15] }),
        hands: hands({ at: [-1, 201, 24], pole }),
      },
    ],
    { view: SIDE, props: [barbell()], motion: motion.hands },
  );
}

function bradford(): SceneSpec {
  const pole: V3 = [0, -1, 0.6];
  return scene(
    [
      stand({ at: [11, 143, 24], pole }),
      stand({ at: [0, 178, 24], pole }),
      stand({ at: [-10, 150, 26], pole }),
    ],
    { view: SIDE, props: [barbell()], motion: motion.hands },
  );
}

// ----------------------------------------------------------------------------------------- Raises

function lateralRaise(seated = false): SceneSpec {
  const make = seated ? sit : (r: { at: V3; pole?: V3 }) => stand(r);
  const lift = seated ? -41 : 0;
  return scene(
    [
      make({ at: [3, 86 + lift, 24], pole: [-1, -0.4, 0.2] }),
      make({ at: [5, 139 + lift, 73], pole: [-1, -0.5, 0] }),
    ],
    { view: FRONT, props: [...(seated ? [seatBench] : []), db('fb')], motion: motion.hand },
  );
}

function leaningLateral(): SceneSpec {
  const hold = { at: [4, 132, -54] as V3, pole: [0, -1, -0.3] as V3 };
  const lean = -14;
  return scene(
    [
      {
        pelvis: [0, 93, -6],
        lean,
        feet: stance(12, 0),
        hands: { r: { at: [6, 90, 12], pole: [-1, -0.4, 0.3] }, l: hold },
      },
      {
        pelvis: [0, 93, -6],
        lean,
        feet: stance(12, 0),
        hands: { r: { at: [3, 156, 54], pole: [-1, -0.5, 0] }, l: hold },
      },
    ],
    { view: FRONT, props: [post([4, 0, -58]), db('fb', ['r'])], motion: motion.hand },
  );
}

function frontRaise(gear: PropBuilder, width: number, alternate = false): SceneSpec {
  const up = { at: [57, 140, width - 2] as V3, pole: [-0.2, -1, 0.1] as V3 };
  const down = { at: [8, 86, width] as V3, pole: [-0.2, -1, 0.1] as V3 };
  return two(
    stand(down),
    alternate ? stand(up, {}, { at: [8, 86, -width], pole: [-0.2, -1, -0.1] }) : stand(up),
    [gear],
  );
}

function uprightRow(gear: PropBuilder, width: number): SceneSpec {
  return two(
    stand({ at: [9, 87, width], pole: [0, 0.4, 1] }),
    stand({ at: [9, 133, width], pole: [-0.1, 0.5, 1] }),
    [gear],
    THREE_QUARTER,
  );
}

function highPull(width: number): SceneSpec {
  return scene(
    [
      {
        pelvis: [-8, 88, 0],
        pitch: 16,
        feet: stance(14),
        hands: hands({ at: [14, width > 30 ? 83 : 78, width], pole: [-0.3, 0, 1] }),
      },
      {
        pelvis: [0, 99, 0],
        feet: feet({ at: [0, 13, 14], toe: [0.75, -0.6, 0.1] }),
        hands: hands({ at: [10, 138, width], pole: [-0.2, 0.7, 1] }),
      },
    ],
    { view: THREE_QUARTER, props: [barbell()], motion: motion.hands },
  );
}

function cubanPress(): SceneSpec {
  const elbowsUp: V3 = [-0.3, 0.2, 1];
  return scene(
    [
      stand({ at: [5, 118, 44], pole: elbowsUp }),
      stand({ at: [0, 170, 44], pole: [-0.3, -0.3, 1] }),
      stand({ at: [-1, 200, 19], pole: [-0.2, -1, 0.6] }),
    ],
    { view: FRONT, props: [db('lr')], motion: motion.hand },
  );
}

function shrug(gear: PropBuilder, width: number, x = 3): SceneSpec {
  return scene(
    [
      stand({ at: [x, 86, width], pole: [-0.2, -1, 0.2] }),
      stand({ at: [x, 95, width], pole: [-0.2, -1, 0.2] }, { shrug: 8 }),
    ],
    { view: THREE_QUARTER, props: [gear], motion: motion.hand },
  );
}

// ---------------------------------------------------------------------------------------- Triceps

/** Overhead extensions: arms straight overhead, then the weight lowered behind the head. */
function overheadExtension(gear: 'dumbbell' | 'ez' | 'single', seated = false): SceneSpec {
  const lift = seated ? -41 : 0;
  const z = gear === 'ez' ? 8 : 4;
  const top = { at: [1, 201 + lift, z] as V3, pole: ELBOWS_UP };
  const low = { at: [-24, 158 + lift, z] as V3, pole: ELBOWS_UP };
  const make = seated
    ? (r: { at: V3; pole?: V3 }, l?: { at: V3; pole?: V3 }) => ({
        ...sitUpright(r),
        ...(l ? { hands: hands(r, l) } : {}),
      })
    : (r: { at: V3; pole?: V3 }, l?: { at: V3; pole?: V3 }) => stand(r, {}, l);
  const gearProp: PropBuilder =
    gear === 'ez'
      ? barbell({ kind: 'ez' })
      : gear === 'single'
        ? db('fb', ['r'])
        : heldDumbbell(
            () => [0, 1, 0],
            () => [0, -8, 0],
          );
  if (gear === 'single') {
    const rest = { at: [8, 100 + lift, -26] as V3, pole: [-0.3, -1, -0.5] as V3 };
    return scene(
      [
        make({ at: [1, 201 + lift, 16], pole: ELBOWS_UP }, rest),
        make({ at: [-22, 160 + lift, 6], pole: [0.3, 1, 0.3] }, rest),
      ],
      { view: SIDE, props: [...(seated ? [uprightBench] : []), gearProp], motion: motion.hand },
    );
  }
  return scene([make(top), make(low)], {
    view: SIDE,
    props: [...(seated ? [uprightBench] : []), gearProp],
    motion: motion.hand,
  });
}

function kickback(): SceneSpec {
  const pelvis: V3 = [-10, 88, 0];
  const pitch = 68;
  const s = shoulderAt(pelvis, pitch);
  const up: V3 = [Math.sin((pitch * Math.PI) / 180), Math.cos((pitch * Math.PI) / 180), 0];
  const elbow = sub(s, [up[0] * 29, up[1] * 29, 0]);
  return scene(
    [
      {
        pelvis,
        pitch,
        feet: stance(14),
        hands: hands({ at: [elbow[0] + 2, elbow[1] - 29, 21], pole: [-0.3, 1, 0.1] }),
      },
      {
        pelvis,
        pitch,
        feet: stance(14),
        hands: hands({ at: [s[0] - up[0] * 58, s[1] - up[1] * 58, 21], pole: [-0.3, 1, 0.1] }),
      },
    ],
    { view: SIDE, props: [db('fb')], motion: motion.hand },
  );
}

// --------------------------------------------------------------------------------------- Forearms

/**
 * Seated, forearms along the thighs: the weight lifted by the wrists alone -- palms up (a wrist
 * curl), palms down with a shorter reach (a reverse wrist curl), or rolled down to the fingertips
 * and back into the palm first (a finger curl).
 */
function wristCurl(
  gear: PropBuilder,
  width: number,
  kind: 'flex' | 'extend' | 'finger' = 'flex',
): SceneSpec {
  const pelvis: V3 = [-6, 53, 0];
  const legs = feet({ at: [36, 8, 14], toe: toeOut(6) });
  const at = (y: number, x = 50): PoseSpec => ({
    pelvis,
    pitch: 32,
    feet: legs,
    hands: hands({ at: [x, y, width], pole: [-0.4, 1, 0.3] }),
  });
  const poses =
    kind === 'finger'
      ? [at(46, 51), at(51), at(58)]
      : kind === 'extend'
        ? [at(51, 49), at(56, 49)]
        : [at(49), at(58)];
  return scene(poses, {
    view: kind === 'extend' ? THREE_QUARTER : SIDE,
    props: [seatBench, gear],
    motion: motion.hand,
  });
}

/** One dumbbell held by one end, turned from upright to over on its side. */
function forearmTurn(outward: boolean): SceneSpec {
  const pelvis: V3 = [-6, 53, 0];
  const legs = feet({ at: [36, 8, 14], toe: toeOut(6) });
  const hand: V3 = [48, 58, 13];
  const frame = (axis: V3): FrameSpec => ({
    pose: {
      pelvis,
      pitch: 30,
      feet: legs,
      hands: {
        r: { at: hand, pole: [-0.4, 1, 0.3] },
        l: { at: [30, 54, -14], pole: [0, -1, -0.3] },
      },
    },
    props: [
      seatBench,
      dumbbellAt(
        (s: Skeleton) => add(s.arms.r.end, [axis[0] * 9, axis[1] * 9, axis[2] * 9]),
        () => axis,
      ),
    ],
  });
  const tilt: V3 = normalize(outward ? [0, 0.15, 1] : [0, 0.15, -1]);
  return {
    view: THREE_QUARTER,
    motion: (s: Skeleton) => add(s.arms.r.end, [0, 8, 0]),
    frames: [frame([0, 1, 0]), frame(tilt)],
  };
}

function behindBackWristCurl(): SceneSpec {
  return two(
    stand({ at: [-13, 84, 20], pole: [1, -0.4, 0.2] }),
    stand({ at: [-14, 90, 20], pole: [1, -0.4, 0.2] }),
    [barbell()],
    THREE_QUARTER,
  );
}

function staticHold(gear: PropBuilder, width: number, x: number): SceneSpec {
  return {
    view: THREE_QUARTER,
    frames: [{ pose: stand({ at: [x, 85, width], pole: [-0.2, -1, 0.2] }), props: [gear] }],
  };
}

export const UPPER_ART: Record<string, SceneSpec> = {
  // Curls
  'db-curl': curl(db('lr'), 21, 4),
  'db-alternating-curl': curl(db('lr'), 21, 4, { alternate: true }),
  'db-seated-curl': curl(db('lr'), 22, 3, { seated: true }),
  'db-seated-alternating-supinating-curl': curl(db('lr'), 22, 3, { seated: true, alternate: true }),
  'db-hammer-curl': curl(db('fb'), 21, 4),
  'db-cross-body-hammer-curl': crossBody(),
  'db-zottman-curl': curl(db('lr'), 21, 4, { lowering: true }),
  'db-reverse-curl': curl(db('lr'), 21, 6, { view: THREE_QUARTER }),
  'db-drag-curl': dragCurl(db('lr'), 21),
  'db-waiter-curl': two(
    stand({ at: [11, 90, 4], pole: DOWN_BACK }),
    stand({ at: [19, 134, 4], pole: DOWN_BACK }),
    [waiter],
  ),
  'db-incline-curl': inclineCurl(),
  'db-concentration-curl': concentration(),
  'db-preacher-curl': preacher(db('lr', ['r']), true),
  'db-spider-curl': spiderCurl(db('lr')),
  'bb-curl': curl(barbell(), 19, 12),
  'bb-ez-bar-curl': curl(barbell({ kind: 'ez' }), 15, 12),
  'bb-wide-grip-curl': curl(barbell(), 29, 12),
  'bb-close-grip-curl': curl(barbell(), 10, 12),
  'bb-reverse-curl': curl(barbell(), 19, 12, { view: THREE_QUARTER }),
  'bb-drag-curl': dragCurl(barbell(), 19),
  'bb-preacher-curl': preacher(barbell({ kind: 'ez' }), false),
  'bb-spider-curl': spiderCurl(barbell({ kind: 'ez' })),
  'bb-seated-curl': (() => {
    const pose = (hand: V3): PoseSpec => sit({ at: hand, pole: DOWN_BACK });
    return scene([pose([30, 64, 19]), pose([18, 96, 19])], {
      view: SIDE,
      props: [seatBench, barbell()],
      motion: motion.hands,
    });
  })(),
  'bb-cheat-curl': cheatCurl(),

  // Presses
  'db-standing-shoulder-press': press(db('lr'), 21),
  'db-seated-shoulder-press': press(db('lr'), 21, { seated: true }),
  'db-arnold-press': press(db('lr'), 21, { seated: true, arnold: true }),
  'bb-overhead-press': press(barbell(), 24, { bar: true }),
  'bb-seated-shoulder-press': press(barbell(), 24, { bar: true, seated: true }),
  'bb-behind-the-neck-press': press(barbell(), 27, { bar: true, behind: true }),
  'bb-push-press': pushPress(),
  'bb-bradford-press': bradford(),

  // Raises, rows and shrugs
  'db-lateral-raise': lateralRaise(),
  'db-seated-lateral-raise': lateralRaise(true),
  'db-leaning-lateral-raise': leaningLateral(),
  'db-front-raise': frontRaise(db('lr'), 17),
  'db-alternating-front-raise': frontRaise(db('lr'), 17, true),
  'bb-front-raise': frontRaise(barbell(), 20),
  'db-upright-row': uprightRow(db('lr'), 8),
  'bb-upright-row': uprightRow(barbell(), 12),
  'bb-high-pull': highPull(22),
  'bb-snatch-grip-high-pull': highPull(40),
  'db-cuban-press': cubanPress(),
  'db-shrug': shrug(db('fb'), 22),
  'bb-shrug': shrug(barbell(), 22, 11),

  // Triceps
  'db-overhead-triceps-extension': overheadExtension('dumbbell'),
  'db-seated-triceps-extension': overheadExtension('dumbbell', true),
  'db-single-arm-overhead-extension': overheadExtension('single'),
  'bb-overhead-ez-triceps-extension': overheadExtension('ez'),
  'db-kickback': kickback(),

  // Forearms
  'db-wrist-curl': wristCurl(db('lr'), 13),
  'db-reverse-wrist-curl': wristCurl(db('lr'), 13, 'extend'),
  'db-finger-curl': wristCurl(db('lr'), 13, 'finger'),
  'bb-wrist-curl': wristCurl(barbell(), 13),
  'bb-reverse-wrist-curl': wristCurl(barbell(), 13, 'extend'),
  'bb-finger-curl': wristCurl(barbell(), 13, 'finger'),
  'db-pronation': forearmTurn(false),
  'db-supination': forearmTurn(true),
  'bb-behind-back-wrist-curl': behindBackWristCurl(),
  'db-static-hold': staticHold(db('fb'), 22, 3),
  'bb-static-hold': staticHold(barbell(), 21, 11),
};
