import { add, lerp3, scale, type V3 } from '../geometry';
import {
  backPad,
  footPlate,
  frame,
  grips,
  lever,
  movingPad,
  pad,
  roller,
  seat,
  rail,
  stack,
  type LeverOptions,
} from '../gym';
import {
  BACK_THREE_QUARTER,
  FACING,
  feet,
  hands,
  motion,
  scene,
  SIDE,
  THREE_QUARTER,
  toeOut,
  torsoOf,
} from '../poseKit';
import { bench, cylinder, METAL_END, platform, preacherBench } from '../props';
import { ART, MATERIALS } from '../palette';
import type { PropBuilder, SceneSpec } from '../render';
import type { FootTarget, PoseSpec, Side, Skeleton } from '../rig';

// The machines, selectorized (a weight stack beside or behind) and plate-loaded (plates on the
// lever's horns): the seat and pads where the body meets them, and the arms that move with it.

type Load = 'stack' | 'plates';

const mirrorZ = (p: V3): V3 => [p[0], p[1], -p[2]];
const mid = (a: V3, b: V3): V3 => lerp3(a, b, 0.5);

/** Both of a machine's arms, from pivots either side to the hands (or wherever `to` says). */
function arms(
  pivot: V3,
  load: Load,
  to: (s: Skeleton, side: Side) => V3 = (s, side) => s.arms[side].end,
  opts: LeverOptions = {},
): PropBuilder[] {
  const plates = load === 'plates' ? (opts.plates ?? 'out') : null;
  return [
    lever(pivot, (s) => to(s, 'r'), { ...opts, plates }),
    lever(mirrorZ(pivot), (s) => to(s, 'l'), { ...opts, plates }),
  ];
}

/** The weight stack, set back out of the way (selectorized machines only). */
function stackFor(load: Load, at: V3 = [-58, 0, -46]): PropBuilder[] {
  return load === 'stack' ? [stack(at)] : [];
}

function two(
  a: PoseSpec,
  b: PoseSpec,
  gear: PropBuilder[],
  view = SIDE,
  cue = motion.hand,
): SceneSpec {
  return scene([a, b], { view, props: gear, motion: cue });
}

// ----------------------------------------------------------------------------------- Seated work

const SEAT_TOP: V3 = [-2, 50, 0];
const SEAT_FEET = feet({ at: [38, 8, 16], toe: toeOut(8) });

/** Sitting against a back pad leaning `back` degrees. */
function chair(back = 10): PropBuilder[] {
  return [seat(SEAT_TOP), backPad([-20, 50, 0], back, 72)];
}

function sitting(
  r: V3,
  pole: V3,
  extra: Partial<PoseSpec> = {},
  l?: { at: V3; pole?: V3 },
): PoseSpec {
  return {
    pelvis: [-4, 56, 0],
    pitch: -8,
    feet: SEAT_FEET,
    hands: hands({ at: r, pole }, l),
    ...extra,
  };
}

interface PressSpec {
  start: V3;
  end: V3;
  pivot: V3;
  back?: number;
  pitch?: number;
  grip?: 'lr' | 'neutral';
  pole?: V3;
}

// Nearly side-on, so a chest press's arm reads from its pivot overhead down to the handles.
const PRESS_SIDE = { yaw: -16, tilt: 8 };

function press(load: Load, p: PressSpec, view = THREE_QUARTER): SceneSpec {
  const pole = p.pole ?? [-0.3, -0.7, 1];
  const extra = { pitch: p.pitch ?? -8 };
  return two(
    sitting(p.start, pole, extra),
    sitting(p.end, pole, extra),
    [...chair(p.back ?? 10), ...stackFor(load), ...arms(p.pivot, load), grips(p.grip ?? 'lr')],
    view,
  );
}

// Seated, the shoulders are about 106 cm up.
// The arms hang from pivots high behind the shoulders and out past them, clear of the head.
const CHEST: PressSpec = { start: [8, 98, 24], end: [44, 100, 22], pivot: [-26, 164, 42] };
const INCLINE: PressSpec = {
  start: [-6, 110, 22],
  end: [6, 146, 20],
  pivot: [64, 40, 32],
  back: 32,
  pitch: -28,
};
const DECLINE: PressSpec = {
  start: [12, 92, 24],
  end: [44, 84, 22],
  pivot: [-30, 170, 42],
  back: 4,
  pitch: -2,
};
const SHOULDER: PressSpec = {
  start: [2, 112, 30],
  end: [-4, 158, 24],
  pivot: [-40, 84, 34],
  back: 4,
  pitch: -6,
  pole: [-0.2, -1, 1],
};

function pecDeck(): SceneSpec {
  const pole: V3 = [0, -1, 0.2];
  return two(
    sitting([0, 108, 60], pole, { pitch: -6 }),
    sitting([30, 106, 10], pole, { pitch: -6 }),
    [...chair(6), ...stackFor('stack', [-60, 0, 0]), ...arms([-8, 168, 22], 'stack'), grips('ud')],
    FACING,
  );
}

function reversePecDeck(): SceneSpec {
  const pole: V3 = [0, -1, 0.1];
  return two(
    sitting([44, 108, 8], pole, { pitch: 6 }),
    sitting([0, 108, 62], pole, { pitch: 6 }),
    [
      seat(SEAT_TOP),
      pad([20, 92, 0], [3, 20, 16]),
      ...stackFor('stack', [70, 0, -40]),
      ...arms([22, 168, 18], 'stack'),
      grips('ud'),
    ],
    BACK_THREE_QUARTER,
  );
}

// ------------------------------------------------------------------------------------------ Rows

const REACH: V3 = [-0.2, -1, 0.5];
const PULLED: V3 = [-1, -0.3, 0.4];
const FLARED: V3 = [-0.6, 0.1, 1];
const CHEST_PAD = pad([24, 90, 0], [3, 18, 14]);

function machineRow(
  load: Load,
  start: V3,
  end: V3,
  pivot: V3,
  opts: { grip?: 'lr' | 'neutral'; flare?: boolean; chestPad?: boolean } = {},
): SceneSpec {
  const pose = (h: V3, pole: V3) => sitting(h, pole, { pitch: 6 });
  return two(pose(start, REACH), pose(end, opts.flare ? FLARED : PULLED), [
    seat(SEAT_TOP),
    ...(opts.chestPad === false ? [roller([20, 72, 0], 18)] : [CHEST_PAD]),
    ...stackFor(load),
    ...arms(pivot, load),
    grips(opts.grip ?? 'neutral'),
  ]);
}

function highRow(load: Load): SceneSpec {
  const pose = (h: V3, pole: V3) => sitting(h, pole, { pitch: 4 });
  return two(pose([26, 150, 26], [0, -1, 0.6]), pose([4, 104, 30], [-1, -0.5, 0.5]), [
    seat(SEAT_TOP),
    roller([20, 72, 0], 18),
    ...stackFor(load),
    ...arms([72, 186, 26], load),
    grips('neutral'),
  ]);
}

function pullover(): SceneSpec {
  const pose = (h: V3, pole: V3) => sitting(h, pole, { pitch: -6 });
  return two(pose([-12, 150, 14], [0.4, 1, 0.3]), pose([24, 86, 14], [-1, 0, 0.3]), [
    ...chair(6),
    ...stackFor('stack'),
    ...arms([-6, 108, 32], 'stack', (s, side) => s.arms[side].joint),
    roller((s) => s.arms.r.joint, 5, 4, [0, 0, 1]),
    roller((s) => s.arms.l.joint, 5, 4, [0, 0, 1]),
    grips('lr', ['r', 'l'], 10),
  ]);
}

/** Hands crossed on the chest, for a torso position. */
function onChest(
  pose: Pick<PoseSpec, 'pelvis' | 'pitch' | 'twist'>,
): Record<Side, { at: V3; pole: V3 }> {
  const s = torsoOf(pose);
  const f = s.frameAt(1);
  const at = (z: number) =>
    add(add(add(s.shoulderCenter, scale(f.forward, 13)), scale(f.up, -12)), scale(f.right, z));
  return { r: { at: at(-7), pole: [0, -1, 0.8] }, l: { at: at(7), pole: [0, -1, -0.8] } };
}

function backExtensionMachine(): SceneSpec {
  const pose = (pitch: number): PoseSpec => {
    const t = { pelvis: [-4, 56, 0] as V3, pitch };
    return { ...t, feet: feet({ at: [34, 14, 14], toe: toeOut(6) }), hands: onChest(t) };
  };
  const upperBack = (s: Skeleton): V3 =>
    add(s.shoulderCenter, add(scale(s.frameAt(1).forward, -12), scale(s.frameAt(1).up, -8)));
  return two(
    pose(42),
    pose(-8),
    [
      seat(SEAT_TOP),
      footPlate([40, 12, 0], [-0.3, 1, 0], { w: 22, h: 10 }),
      ...stackFor('stack'),
      lever([-8, 60, 24], upperBack),
      roller(upperBack, 18),
      roller([20, 64, 0], 18),
    ],
    SIDE,
    motion.head,
  );
}

/** Kneeling on an assist pad that rises with the body, hands on handles above or beside. */
function assisted(kind: 'pull-up' | 'dip'): SceneSpec {
  const pull = kind === 'pull-up';
  const pose = (pelvisY: number, h: V3, pitch = 0): PoseSpec => ({
    pelvis: [0, pelvisY, 0],
    pitch,
    feet: feet({ at: [-40, pelvisY - 46, 11], pole: [0.3, -1, 0], toe: [-0.3, -1, 0] }),
    hands: hands({ at: h, pole: pull ? [-0.2, -1, 0.9] : [-1, 0.2, 0.2] }),
  });
  const knees = (s: Skeleton): V3 => {
    const k = mid(s.legs.r.joint, s.legs.l.joint);
    return [k[0] - 6, k[1] - 6, 0];
  };
  const handle = pull ? 216 : 140;
  return two(
    pull ? pose(112, [4, handle, 30]) : pose(150, [4, handle, 28]),
    pull ? pose(148, [6, handle, 28]) : pose(118, [4, handle, 28], 10),
    [
      frame([-26, 0, 42], [-26, 236, 42], [-26, 236, -42], [-26, 0, -42]),
      rail([-26, handle, 30], [8, handle, 30]),
      rail([-26, handle, -30], [8, handle, -30]),
      ...stackFor('stack', [-62, 0, 0]),
      movingPad(knees, [12, 2.6, 20]),
      lever([-60, 50, 0], knees),
      grips(pull ? 'lr' : 'fb'),
    ],
    SIDE,
    motion.head,
  );
}

// ------------------------------------------------------------------------------- Shoulders, arms

function lateralRaiseMachine(): SceneSpec {
  const pose = (h: V3) => sitting(h, [0, -1, 0.2], { pitch: -4 });
  return two(
    pose([6, 74, 28]),
    pose([4, 106, 62]),
    [
      seat(SEAT_TOP),
      pad([14, 92, 0], [3, 20, 14]),
      ...stackFor('stack', [-60, 0, 0]),
      ...arms([-14, 112, 22], 'stack', (s, side) => s.arms[side].joint),
      roller((s) => s.arms.r.joint, 6, 4.2, [1, 0, 0]),
      roller((s) => s.arms.l.joint, 6, 4.2, [1, 0, 0]),
    ],
    FACING,
  );
}

function armMachine(kind: 'curl' | 'extension'): SceneSpec {
  // Placed as the free-weight preacher curl is (upper.ts).
  const pose = (h: V3): PoseSpec => ({
    pelvis: [-14, 64, 0],
    pitch: 18,
    feet: feet({ at: [24, 8, 16], toe: toeOut(8) }),
    hands: hands({ at: h, pole: [0.3, -1, 0.1] }),
  });
  const bent: V3 = [30, 142, 16];
  const straight: V3 = [52, 88, 16];
  return two(pose(kind === 'curl' ? straight : bent), pose(kind === 'curl' ? bent : straight), [
    preacherBench([20, 112, 0], [-14, 56, 0]),
    ...stackFor('stack', [-56, 0, -40]),
    ...arms([30, 100, 28], 'stack'),
    grips(kind === 'curl' ? 'lr' : 'neutral'),
  ]);
}

function seatedDip(): SceneSpec {
  return two(
    sitting([-2, 96, 28], [-1, 0.3, 0.4], { pitch: -4 }),
    sitting([2, 60, 30], [-1, 0, 0.2], { pitch: -4 }),
    [...chair(6), ...stackFor('stack'), ...arms([-46, 100, 34], 'stack'), grips('fb')],
  );
}

// ------------------------------------------------------------------------------------------ Legs

function legPressSeated(): SceneSpec {
  const pose = (x: number): PoseSpec => ({
    pelvis: [-6, 52, 0],
    pitch: -32,
    feet: feet({ at: [x, 74, 13], pole: [0.2, 1, 0.2], toe: [0.1, 1, 0] }),
    hands: hands({ at: [6, 54, 26], pole: [0, -1, 0.3] }),
  });
  const plateAt = (s: Skeleton): V3 => {
    const m = mid(s.legs.r.end, s.legs.l.end);
    return [m[0] + 5, m[1] + 6, 0];
  };
  return two(
    pose(32),
    pose(62),
    [
      seat(SEAT_TOP),
      backPad([-20, 50, 0], 32, 72),
      footPlate(plateAt, [-1, 0, 0], { w: 28, h: 22 }),
      lever([50, 20, 24], plateAt),
      frame([10, 1.5, 0], [96, 1.5, 0]),
      ...stackFor('stack', [100, 0, -30]),
      grips('fb'),
    ],
    SIDE,
    motion.foot,
  );
}

function legExtension(single: boolean): SceneSpec {
  const bentFoot: FootTarget = { at: [22, 14, 12], pole: [1, 0, 0], toe: [0.3, 1, 0] };
  const pose = (straight: boolean): PoseSpec => ({
    pelvis: [-4, 56, 0],
    pitch: -10,
    feet: single
      ? {
          r: straight ? { at: [44, 52, 12], pole: [0, 1, 0], toe: [0, 1, -0.2] } : bentFoot,
          l: { ...bentFoot, at: [20, 14, -12] },
        }
      : straight
        ? feet({ at: [44, 52, 12], pole: [0, 1, 0], toe: [0, 1, -0.2] })
        : feet(bentFoot),
    hands: hands({ at: [-2, 54, 24], pole: [0, -1, 0.3] }),
  });
  const shins = (s: Skeleton): V3 => {
    const a = single ? s.legs.r.end : mid(s.legs.r.end, s.legs.l.end);
    return [a[0] + 3, a[1] + 3, single ? 12 : 0];
  };
  return two(
    pose(false),
    pose(true),
    [
      seat(SEAT_TOP),
      backPad([-20, 50, 0], 12, 64),
      ...stackFor('stack', [-50, 0, -42]),
      lever([16, 50, 22], shins, { beyond: 4 }),
      roller(shins, single ? 9 : 16),
      grips('fb'),
    ],
    SIDE,
    motion.foot,
  );
}

function seatedLegCurl(): SceneSpec {
  const pose = (foot: V3, pole: V3): PoseSpec => ({
    pelvis: [-4, 56, 0],
    pitch: -12,
    feet: feet({ at: foot, pole, toe: [0.2, 1, 0] }),
    hands: hands({ at: [-2, 54, 24], pole: [0, -1, 0.3] }),
  });
  const heels = (s: Skeleton): V3 => {
    const a = mid(s.legs.r.end, s.legs.l.end);
    return [a[0] - 2, a[1] - 5, 0];
  };
  return two(
    pose([82, 50, 12], [0, 1, 0]),
    pose([30, 18, 12], [1, 0.3, 0]),
    [
      seat(SEAT_TOP),
      backPad([-20, 50, 0], 14, 64),
      roller([30, 74, 0], 16),
      ...stackFor('stack', [-50, 0, -42]),
      lever([40, 54, 22], heels),
      roller(heels, 16),
      grips('fb'),
    ],
    SIDE,
    motion.foot,
  );
}

function lyingLegCurl(): SceneSpec {
  const pose = (foot: V3): PoseSpec => ({
    pelvis: [0, 54, 0],
    pitch: 92,
    feet: feet({ at: foot, pole: [0, -1, 0], toe: [-0.2, -1, 0] }),
    hands: hands({ at: [60, 40, 20], pole: [0, -1, 0.4] }),
  });
  const ankles = (s: Skeleton): V3 => {
    const a = mid(s.legs.r.end, s.legs.l.end);
    return [a[0] - 3, a[1] + 5, 0];
  };
  return two(
    pose([-88, 50, 11]),
    pose([-52, 92, 11]),
    [
      bench({ at: [22, 46, 0], length: 92 }),
      ...stackFor('stack', [70, 0, -46]),
      lever([-46, 44, 22], ankles),
      roller(ankles, 16),
      grips('fb'),
    ],
    SIDE,
    motion.foot,
  );
}

function standingLegCurlMachine(): SceneSpec {
  const pose = (foot: V3, pole: V3): PoseSpec => ({
    pelvis: [-2, 93, 0],
    pitch: 10,
    feet: { r: { at: foot, pole }, l: { at: [-2, 8, -12], toe: toeOut(-4) } },
    hands: hands({ at: [32, 122, 18], pole: [-0.4, -1, 0.5] }),
  });
  const ankle = (s: Skeleton): V3 => add(s.legs.r.end, [-4, 3, 0]);
  return two(
    pose([-2, 10, 12], [1, 0, 0.1]),
    pose([-38, 58, 12], [1, -0.4, 0]),
    [
      pad([14, 60, 12], [3, 12, 8]),
      frame([30, 0, 0], [30, 124, 0]),
      ...stackFor('stack', [-44, 0, -46]),
      lever([4, 52, 20], ankle),
      roller(ankle, 7, 4.2),
      grips('lr'),
    ],
    SIDE,
    motion.foot,
  );
}

function hipMachine(kind: 'abduction' | 'adduction'): SceneSpec {
  const pose = (spread: number): PoseSpec => ({
    pelvis: [-4, 56, 0],
    pitch: -10,
    feet: feet({ at: [34, 30, spread], pole: [0.2, 1, spread > 20 ? 1 : 0.1], toe: [1, 0.1, 0] }),
    hands: hands({ at: [2, 54, 28], pole: [0, -1, 0.3] }),
  });
  const knee =
    (side: Side) =>
    (s: Skeleton): V3 =>
      add(s.legs[side].joint, [0, 0, (side === 'r' ? 1 : -1) * (kind === 'abduction' ? 5 : -5)]);
  const open = pose(34);
  const closed = pose(10);
  return two(
    kind === 'abduction' ? closed : open,
    kind === 'abduction' ? open : closed,
    [
      seat(SEAT_TOP),
      backPad([-20, 50, 0], 10, 66),
      ...stackFor('stack', [-56, 0, 0]),
      lever([10, 40, 8], knee('r')),
      lever([10, 40, -8], knee('l')),
      roller(knee('r'), 8, 4.4, [0, 1, 0]),
      roller(knee('l'), 8, 4.4, [0, 1, 0]),
    ],
    FACING,
    (s) => s.legs.r.joint,
  );
}

function kickbackMachine(): SceneSpec {
  const pose = (foot: V3, pole: V3): PoseSpec => ({
    pelvis: [-6, 88, 0],
    pitch: 55,
    feet: { r: { at: foot, pole }, l: { at: [-2, 8, -12], toe: toeOut(-4) } },
    hands: hands({ at: [42, 110, 16], pole: [0, -1, 0.4] }),
  });
  const sole = (s: Skeleton): V3 => add(s.legs.r.end, [-6, 0, 0]);
  return two(
    pose([8, 46, 12], [1, -0.2, 0]),
    pose([-58, 62, 12], [0.2, -1, 0]),
    [
      pad([36, 106, 0], [14, 3, 16], -24),
      frame([44, 0, 0], [44, 100, 0]),
      ...stackFor('stack', [-60, 0, -46]),
      lever([-8, 64, 20], sole),
      footPlate(sole, [1, 0, 0], { w: 12, h: 12 }),
      grips('fb'),
    ],
    SIDE,
    motion.foot,
  );
}

function thrustMachine(load: Load): SceneSpec {
  const pose = (pelvis: V3, pitch: number): PoseSpec => ({
    pelvis,
    pitch,
    feet: feet({ at: [30, 8, 15], pole: [0, 1, 0.25] }),
    hands: hands({ at: [pelvis[0] + 4, pelvis[1] + 10, 30], pole: [0, -0.3, 1] }),
  });
  const hips = (s: Skeleton): V3 => add(s.pelvis, scale(s.pelvisFrame.forward, 14));
  return two(
    pose([-14, 30, 0], -58),
    pose([-6, 54, 0], -92),
    [
      pad([-44, 46, 0], [18, 3.5, 18], -12),
      frame([-48, 0, 0], [-48, 42, 0]),
      ...stackFor(load, [-80, 0, -44]),
      lever([-40, 30, 30], hips, { plates: load === 'plates' ? 'out' : null }),
      lever([-40, 30, -30], hips, { plates: load === 'plates' ? 'out' : null }),
      movingPad(hips, [9, 4, 20]),
    ],
    THREE_QUARTER,
    motion.hips,
  );
}

const STEP = 8;
const FLAT_TOE: V3 = [0.97, 0.24, 0.05];
const TIPTOE: V3 = [0.62, -0.79, 0.05];

function standingCalfMachine(): SceneSpec {
  const pose = (y: number, toe: V3): PoseSpec => ({
    pelvis: [0, 94 + (y - (STEP + 8)), 0],
    feet: feet({ at: [0, y, 12], toe }),
    hands: hands({ at: [8, 150 + (y - (STEP + 8)), 28], pole: [0, -1, 0.6] }),
  });
  const shoulderPad =
    (side: Side) =>
    (s: Skeleton): V3 =>
      add(s.shoulders[side], [1, 6, 0]);
  return two(
    pose(STEP + 5, FLAT_TOE),
    pose(STEP + 19, TIPTOE),
    [
      platform([12, STEP, 0], { x: 26, z: 60 }),
      frame([-34, 0, 30], [-34, 230, 30]),
      frame([-34, 0, -30], [-34, 230, -30]),
      ...stackFor('stack', [-62, 0, 0]),
      lever([-34, 168, 20], shoulderPad('r')),
      lever([-34, 168, -20], shoulderPad('l')),
      movingPad(shoulderPad('r'), [8, 3, 7]),
      movingPad(shoulderPad('l'), [8, 3, 7]),
    ],
    THREE_QUARTER,
    motion.hips,
  );
}

function seatedCalfMachine(): SceneSpec {
  const pose = (lift: number, toe: V3): PoseSpec => ({
    pelvis: [-2, 53, 0],
    pitch: 8,
    feet: feet({ at: [42, STEP + 8 + lift, 12], toe }),
    hands: hands({ at: [30, 70 + lift, 24], pole: [-0.3, -1, 0.4] }),
  });
  const knees = (s: Skeleton): V3 => {
    const k = mid(s.legs.r.joint, s.legs.l.joint);
    return [k[0] - 2, k[1] + 6, 0];
  };
  return two(
    pose(-3, FLAT_TOE),
    pose(9, TIPTOE),
    [
      seat([-2, 46, 0]),
      platform([46, STEP, 0], { x: 26, z: 60 }),
      lever([-34, 40, 26], knees, { plates: 'out', beyond: 16 }),
      movingPad(knees, [9, 3, 18]),
    ],
    THREE_QUARTER,
    (s) => s.legs.r.joint,
  );
}

function abCrunchMachine(): SceneSpec {
  const pose = (pitch: number): PoseSpec => {
    const t = { pelvis: [-4, 56, 0] as V3, pitch };
    const s = torsoOf(t);
    const f = s.frameAt(1);
    const at = (z: number) => add(add(s.shoulders.r, scale(f.forward, 6)), [0, 6, z]);
    return {
      ...t,
      feet: feet({ at: [30, 14, 14], toe: toeOut(6) }),
      hands: hands({ at: at(-4), pole: [0, -1, 0.4] }),
    };
  };
  return two(
    pose(-6),
    pose(34),
    [
      ...chair(8),
      ...stackFor('stack'),
      ...arms([-16, 168, 26], 'stack'),
      grips('fb'),
      roller([30, 22, 0], 16),
    ],
    SIDE,
    motion.head,
  );
}

function rotaryTorso(): SceneSpec {
  const pose = (twist: number): PoseSpec => {
    const t = { pelvis: [-4, 56, 0] as V3, twist };
    const s = torsoOf(t);
    const f = s.frameAt(1);
    const at = (z: number) =>
      add(add(add(s.shoulderCenter, scale(f.forward, 24)), scale(f.up, -14)), scale(f.right, z));
    return {
      ...t,
      feet: feet({ at: [30, 14, 14], toe: toeOut(6) }),
      hands: { r: { at: at(16), pole: [0, -1, 0.5] }, l: { at: at(-16), pole: [0, -1, -0.5] } },
    };
  };
  const chestPad = (s: Skeleton): V3 =>
    add(add(s.shoulderCenter, scale(s.frameAt(1).forward, 14)), [0, -16, 0]);
  return two(
    pose(-40),
    pose(40),
    [
      seat(SEAT_TOP),
      ...stackFor('stack', [-56, 0, 0]),
      movingPad(chestPad, [3, 14, 16]),
      grips('ud'),
    ],
    FACING,
    (s) => s.arms.r.end,
  );
}

// --------------------------------------------------------------------------- Plate-loaded legs

function tBarRow(): SceneSpec {
  const pose = (h: V3, pole: V3): PoseSpec => ({
    pelvis: [-30, 76, 0],
    pitch: 50,
    feet: feet({ at: [-44, 20, 13], toe: toeOut(4) }),
    hands: hands({ at: h, pole }),
  });
  const grip = (s: Skeleton): V3 => mid(s.arms.r.end, s.arms.l.end);
  return two(pose([14, 56, 14], [-0.2, -1, 0.5]), pose([-4, 86, 18], PULLED), [
    pad([-4, 100, 0], [24, 3, 16], 38),
    platform([-44, 12, 0], { x: 30, z: 60 }),
    frame([-60, 1.5, 0], [30, 1.5, 0]),
    lever([-110, 14, 0], grip, { plates: 'out', beyond: 12 }),
    grips('neutral'),
  ]);
}

function plateLatPulldown(): SceneSpec {
  const pose = (h: V3, pole: V3, pitch: number): PoseSpec => ({
    pelvis: [-2, 56, 0],
    pitch,
    feet: feet({ at: [36, 8, 15], toe: toeOut(8) }),
    hands: hands({ at: h, pole }),
  });
  return two(pose([8, 156, 34], [-0.2, -1, 0.9], -6), pose([12, 122, 34], [-0.3, -1, 0.7], -14), [
    seat([-2, 50, 0]),
    roller([24, 70, 0], 20),
    frame([30, 0, 0], [30, 66, 0]),
    ...arms([46, 214, 32], 'plates'),
    grips('lr'),
  ]);
}

/** The 45-degree leg press: the reclined seat, the rails, the sled with its plates. */
const SLED_DIR: V3 = [0.7071, 0.7071, 0];
function legPress45(kind: 'press' | 'calf'): SceneSpec {
  const pose = (foot: V3, toe: V3): PoseSpec => ({
    pelvis: [-8, 40, 0],
    pitch: -62,
    feet: feet({ at: foot, pole: [0.2, 1, 0.2], toe }),
    hands: hands({ at: [0, 40, 28], pole: [0, -1, 0.3] }),
  });
  const sled = (s: Skeleton): V3 => {
    const m = mid(s.legs.r.end, s.legs.l.end);
    return add(m, scale(SLED_DIR, 5));
  };
  // A horn out of each side of the carriage, with plates on it.
  const sledPlates: PropBuilder = ({ cam, skeleton }) =>
    [-1, 1].flatMap((sign) => {
      const c = add(sled(skeleton), [10, -6, 0]);
      return [
        cylinder(
          cam,
          add(c, [0, 0, sign * 24]),
          add(c, [0, 0, sign * 42]),
          2.4,
          MATERIALS.metal,
          METAL_END,
        ),
        cylinder(
          cam,
          add(c, [0, 0, sign * 28]),
          add(c, [0, 0, sign * 32]),
          15,
          MATERIALS.iron,
          ART.plateFace,
          {
            hub: 2.4,
          },
        ),
        cylinder(
          cam,
          add(c, [0, 0, sign * 32.5]),
          add(c, [0, 0, sign * 35.5]),
          12,
          MATERIALS.iron,
          ART.plateFace,
          {
            hub: 2.4,
          },
        ),
      ];
    });
  // Feet flat on the plate, toes up along it; a calf press points them.
  const FLAT: V3 = [-0.6, 0.8, 0];
  const POINTED: V3 = [0.15, 1, 0];
  const start: [V3, V3] = kind === 'press' ? [[26, 74, 13], FLAT] : [[52, 97, 13], FLAT];
  const end: [V3, V3] = kind === 'press' ? [[53, 99, 13], FLAT] : [[50, 95, 13], POINTED];
  // Built like the real ones: the seat low and reclined with a handle either side; the sled riding
  // two rails that run under it (never through the legs) up to a rear post; the base frame along
  // the floor joining them.
  const RAIL_LOW: V3 = [6, 26, 0];
  const RAIL_HIGH: V3 = [128, 148, 0];
  const at = (p: V3, z: number): V3 => [p[0], p[1], z];
  return two(
    pose(...start),
    pose(...end),
    [
      pad([-36, 44, 0], [28, 3.6, 19], 152),
      pad([-2, 30, 0], [16, 3.6, 19], -14),
      frame([-4, 1.5, 0], [-4, 25, 0]),
      // The base along the floor, the rails' low mount and the rear post up to their top.
      frame([-62, 1.5, 22], [140, 1.5, 22]),
      frame([-62, 1.5, -22], [140, 1.5, -22]),
      frame([-50, 1.5, 22], [-50, 1.5, -22]),
      frame([140, 1.5, 22], [140, 1.5, -22]),
      frame(at(RAIL_LOW, 16), [RAIL_LOW[0], 0, 16]),
      frame(at(RAIL_LOW, -16), [RAIL_LOW[0], 0, -16]),
      frame([RAIL_HIGH[0], 0, 16], at(RAIL_HIGH, 16)),
      frame([RAIL_HIGH[0], 0, -16], at(RAIL_HIGH, -16)),
      frame(at(RAIL_HIGH, 16), at(RAIL_HIGH, -16)),
      rail(at(RAIL_LOW, 16), at(RAIL_HIGH, 16)),
      rail(at(RAIL_LOW, -16), at(RAIL_HIGH, -16)),
      // The handles beside the seat.
      frame([0, 1.5, 30], [0, 36, 30]),
      frame([0, 1.5, -30], [0, 36, -30]),
      grips('fb'),
      // The sled: its carriage on the rails, the plates on a horn either side, the foot plate.
      movingPad((s) => add(sled(s), [10, -6, 0]), [6, 22, 26], 45),
      sledPlates,
      footPlate(sled, [-0.7071, -0.7071, 0], { w: 32, h: 30 }),
    ],
    SIDE,
    motion.foot,
  );
}

/** A hack squat (sled moving along the back pad) or a pendulum squat (the pad swinging on its arm). */
function squatMachine(kind: 'hack' | 'pendulum'): SceneSpec {
  const pitch = kind === 'hack' ? -30 : -12;
  const pose = (pelvis: V3, p: number): PoseSpec => {
    const t = { pelvis, pitch: p };
    const s = torsoOf(t);
    return {
      ...t,
      feet: feet({ at: [kind === 'hack' ? 30 : 24, 20, 14], toe: toeOut(10) }),
      hands: hands({ at: add(s.shoulders.r, [6, 4, 8]), pole: [0, -1, 0.6] }),
    };
  };
  const backAt = (s: Skeleton): V3 =>
    add(mid(s.pelvis, s.shoulderCenter), scale(s.frameAt(1).forward, -11));
  const shoulderPad =
    (side: Side) =>
    (s: Skeleton): V3 =>
      add(s.shoulders[side], [0, 5, 0]);
  const props: PropBuilder[] = [
    platform([30, 18, 0], { x: 40, z: 60 }),
    movingPad(
      backAt,
      [4, 26, 16],
      (s) => (Math.atan2(s.frameAt(1).up[1], s.frameAt(1).up[0]) * 180) / Math.PI - 90,
    ),
    movingPad(shoulderPad('r'), [7, 3, 6]),
    movingPad(shoulderPad('l'), [7, 3, 6]),
  ];
  if (kind === 'hack') {
    // The angled rails the sled rides, on a base frame with a rear post and a brace across the top;
    // the handles by the shoulder pads.
    props.push(
      rail([30, 20, 34], [-76, 204, 34]),
      rail([30, 20, -34], [-76, 204, -34]),
      frame([-76, 204, 34], [-76, 204, -34]),
      frame([-76, 0, 34], [-76, 204, 34]),
      frame([-76, 0, -34], [-76, 204, -34]),
      frame([-76, 1.5, 34], [56, 1.5, 34]),
      frame([-76, 1.5, -34], [56, 1.5, -34]),
      movingPad((s) => add(shoulderPad('r')(s), [10, -4, 10]), [2, 2, 5]),
      movingPad((s) => add(shoulderPad('l')(s), [10, -4, -10]), [2, 2, 5]),
    );
  } else {
    props.push(
      lever([-70, 214, 30], backAt, { plates: 'out' }),
      lever([-70, 214, -30], backAt, { plates: 'out' }),
    );
    props.push(frame([-70, 0, 34], [-70, 216, 34]), frame([-70, 0, -34], [-70, 216, -34]));
  }
  return two(
    kind === 'hack' ? pose([-10, 94, 0], pitch) : pose([-6, 98, 0], pitch),
    kind === 'hack' ? pose([10, 60, 0], pitch - 4) : pose([-12, 58, 0], pitch - 6),
    props,
    THREE_QUARTER,
    motion.hips,
  );
}

function beltSquat(): SceneSpec {
  // Standing on the platform, 12 cm up.
  const legs = feet({ at: [0, 20, 18], toe: toeOut(14) });
  const belt = (s: Skeleton): V3 => add(s.pelvis, [0, -6, 0]);
  return two(
    { pelvis: [0, 104, 0], feet: legs, hands: hands({ at: [44, 120, 24], pole: [0, -1, 0.5] }) },
    {
      pelvis: [-14, 66, 0],
      pitch: 18,
      feet: legs,
      hands: hands({ at: [44, 112, 24], pole: [0, -1, 0.5] }),
    },
    [
      platform([0, 12, 0], { x: 70, z: 80 }),
      frame([50, 0, 0], [50, 112, 0]),
      rail([50, 112, 26], [50, 112, -26]),
      lever([-90, 24, 0], belt, { plates: 'out' }),
      grips('fb'),
    ],
    THREE_QUARTER,
    motion.hips,
  );
}

function gluteDrive(): SceneSpec {
  return thrustMachine('plates');
}

export const MACHINE_ART: Record<string, SceneSpec> = {
  // Chest
  'mc-chest-press': press('stack', CHEST, PRESS_SIDE),
  'mc-chest-press-neutral': press(
    'stack',
    {
      ...CHEST,
      start: [8, 98, 20],
      end: [44, 100, 19],
      grip: 'neutral',
      pole: [-0.6, -0.8, 0.5],
    },
    PRESS_SIDE,
  ),
  'mc-incline-chest-press': press('stack', INCLINE),
  'mc-decline-chest-press': press('stack', DECLINE, PRESS_SIDE),
  'mc-converging-chest-press': press(
    'stack',
    {
      ...CHEST,
      start: [6, 98, 34],
      end: [44, 100, 10],
      pivot: [-28, 164, 48],
    },
    PRESS_SIDE,
  ),
  'mc-pec-deck': pecDeck(),
  'mc-reverse-pec-deck': reversePecDeck(),
  // Back
  'mc-seated-row-neutral': machineRow('stack', [54, 100, 14], [12, 96, 18], [72, 24, 22]),
  'mc-seated-row-wide': machineRow('stack', [50, 104, 30], [16, 104, 38], [72, 24, 30], {
    grip: 'lr',
    flare: true,
  }),
  'mc-high-row': highRow('stack'),
  'mc-low-row': machineRow('stack', [54, 80, 16], [8, 80, 22], [76, 12, 22]),
  'mc-pullover': pullover(),
  'mc-back-extension': backExtensionMachine(),
  'mc-assisted-pull-up': assisted('pull-up'),
  // Shoulders and arms
  'mc-shoulder-press': press('stack', SHOULDER, FACING),
  'mc-shoulder-press-neutral': press(
    'stack',
    { ...SHOULDER, start: [4, 112, 22], end: [-2, 158, 18], grip: 'neutral', pole: [0.3, -1, 0.4] },
    FACING,
  ),
  'mc-lateral-raise': lateralRaiseMachine(),
  'mc-preacher-curl': armMachine('curl'),
  'mc-triceps-extension': armMachine('extension'),
  'mc-seated-dip': seatedDip(),
  'mc-assisted-dip': assisted('dip'),
  // Legs
  'mc-seated-leg-press': legPressSeated(),
  'mc-leg-extension': legExtension(false),
  'mc-single-leg-extension': legExtension(true),
  'mc-seated-leg-curl': seatedLegCurl(),
  'mc-lying-leg-curl': lyingLegCurl(),
  'mc-standing-leg-curl': standingLegCurlMachine(),
  'mc-hip-abduction': hipMachine('abduction'),
  'mc-hip-adduction': hipMachine('adduction'),
  'mc-glute-kickback': kickbackMachine(),
  'mc-hip-thrust': thrustMachine('stack'),
  'mc-standing-calf-raise': standingCalfMachine(),
  'mc-ab-crunch': abCrunchMachine(),
  'mc-rotary-torso': rotaryTorso(),
  // Plate-loaded
  'pl-chest-press': press('plates', { ...CHEST, pivot: [-28, 164, 44] }, PRESS_SIDE),
  'pl-incline-press': press('plates', INCLINE),
  'pl-decline-press': press('plates', DECLINE, PRESS_SIDE),
  'pl-shoulder-press': press('plates', SHOULDER, FACING),
  'pl-high-row': highRow('plates'),
  'pl-low-row': machineRow('plates', [54, 82, 16], [8, 82, 22], [80, 12, 24]),
  'pl-t-bar-row': tBarRow(),
  'pl-lat-pulldown': plateLatPulldown(),
  'pl-leg-press': legPress45('press'),
  'pl-leg-press-calf-raise': legPress45('calf'),
  'pl-hack-squat': squatMachine('hack'),
  'pl-pendulum-squat': squatMachine('pendulum'),
  'pl-belt-squat': beltSquat(),
  'pl-seated-calf-raise': seatedCalfMachine(),
  'pl-glute-drive': gluteDrive(),
};
