import type { V3 } from '../geometry';
import { cable, crossover, latPulldown, seatedRow, type Attachment, type Column } from '../gym';
import {
  FACING,
  FRONT,
  feet,
  hands,
  motion,
  scene,
  SIDE,
  stance,
  THREE_QUARTER,
  toeOut,
} from '../poseKit';
import { preacherBench } from '../props';
import type { PropBuilder, SceneSpec } from '../render';
import type { LimbTarget, PoseSpec } from '../rig';

// The cable exercises: the column, its pulley at the right height, and the exact attachment in the
// hands -- a V-handle row shows a V-handle, a rope pushdown a rope.

const STAND: V3 = [0, 94, 0];
const FEET = stance(13);
/** A split stance under hips at `x`: the right foot forward, the left back. */
const split = (x: number) =>
  feet({ at: [x + 19, 8, 13], toe: toeOut(6) }, { at: [x - 19, 8, -13], toe: toeOut(-4) });

type Hand = V3 | LimbTarget;
const limb = (h: Hand, pole?: V3): LimbTarget =>
  Array.isArray(h) ? { at: h as V3, pole } : (h as LimbTarget);

/** Standing, both hands mirrored from the right (or each given). */
function stand(r: Hand, extra: Partial<PoseSpec> = {}, l?: Hand): PoseSpec {
  return { pelvis: STAND, feet: FEET, hands: hands(limb(r), l ? limb(l) : undefined), ...extra };
}

/** One hand working, the other resting on the hip. */
function oneHand(r: LimbTarget, extra: Partial<PoseSpec> = {}): PoseSpec {
  return {
    pelvis: STAND,
    feet: FEET,
    hands: { r, l: { at: [-4, 100, -24], pole: [-0.6, -0.2, -1] } },
    ...extra,
  };
}

const front = (height: number, x = 60): Column => ({ at: [x, 0, 0], face: [-1, 0, 0], height });
const behind = (height: number, x = -62): Column => ({ at: [x, 0, 0], face: [1, 0, 0], height });
const leftSide = (height: number, z = -78): Column => ({ at: [-6, 0, z], face: [0, 0, 1], height });
const rightSide = (height: number, z = 78): Column => ({
  at: [-6, 0, z],
  face: [0, 0, -1],
  height,
});

function two(
  a: PoseSpec,
  b: PoseSpec,
  gear: PropBuilder[],
  view = SIDE,
  cue = motion.hand,
): SceneSpec {
  return scene([a, b], { view, props: gear, motion: cue });
}

// ------------------------------------------------------------------------------------ Seated rows

const ROW_SEAT = { pelvis: [-6, 48, 0] as V3, feet: feet({ at: [72, 22, 13], toe: [0.3, 1, 0] }) };
const REACH: V3 = [-0.2, -1, 0.5];
const BACK: V3 = [-1, -0.3, 0.4];
const FLARED: V3 = [-0.6, 0.1, 1];

function seatedCableRow(
  att: Attachment,
  w0: number,
  w1 = w0,
  opts: { flare?: boolean; to?: V3; single?: boolean } = {},
): SceneSpec {
  const end: V3 = opts.to ?? [10, 78, w1];
  const pose = (h: V3, pole: V3, pitch: number): PoseSpec => ({
    ...ROW_SEAT,
    pitch,
    hands: opts.single
      ? { r: { at: h, pole }, l: { at: [18, 62, -20], pole: [0, -1, -0.4] } }
      : hands({ at: h, pole }),
  });
  return two(pose([48, 70, w0], REACH, 12), pose(end, opts.flare ? FLARED : BACK, -4), [
    seatedRow(att, opts.single ? 'r' : 'both'),
  ]);
}

// ---------------------------------------------------------------------------------- Lat pulldowns

const PULLDOWN_SEAT = {
  pelvis: [-2, 56, 0] as V3,
  feet: feet({ at: [36, 8, 15], toe: toeOut(8) }),
};
const UP: V3 = [-0.2, -1, 0.9];
const DOWN: V3 = [-0.3, -1, 0.7];
const IN_FRONT: V3 = [0.4, -1, 0.3];

function pulldown(
  att: Attachment,
  start: V3,
  end: V3,
  poles: [V3, V3] = [UP, DOWN],
  single = false,
): SceneSpec {
  const pose = (h: V3, pole: V3, pitch: number): PoseSpec => ({
    ...PULLDOWN_SEAT,
    pitch,
    hands: single
      ? { r: { at: h, pole }, l: { at: [20, 66, -16], pole: [0, -1, -0.3] } }
      : hands({ at: h, pole }),
  });
  return two(pose(start, poles[0], -6), pose(end, poles[1], -14), [
    latPulldown(att, single ? 'r' : 'both'),
  ]);
}

// --------------------------------------------------------------------------------------- Triceps

const ELBOWS_BACK: V3 = [-1, -0.3, 0.2];

function pushdown(att: Attachment, w0: number, w1 = w0, single = false): SceneSpec {
  const gear = [cable({ column: front(200), attachment: att, hold: single ? 'r' : 'both' })];
  const pose = (h: V3, pole: V3) =>
    single ? oneHand({ at: h, pole }, { pitch: 8 }) : stand({ at: h, pole }, { pitch: 8 });
  return two(pose([26, 116, w0], ELBOWS_BACK), pose([20, 88, w1], [-1, 0.1, 0.2]), gear);
}

function overheadExtension(att: Attachment, w: number): SceneSpec {
  const pose = (h: V3): PoseSpec => ({
    pelvis: [4, 92, 0],
    pitch: 24,
    feet: split(4),
    hands: hands({ at: h, pole: [1, 0.7, 0.25] }),
  });
  return two(pose([-8, 160, w]), pose([44, 176, w]), [
    cable({ column: behind(176), attachment: att }),
  ]);
}

function singleOverheadExtension(): SceneSpec {
  const pose = (h: V3, pole: V3): PoseSpec => ({
    pelvis: [4, 93, 0],
    pitch: 6,
    feet: split(4),
    hands: { r: { at: h, pole }, l: { at: [-2, 100, -24], pole: [-0.6, -0.2, -1] } },
  });
  return two(
    pose([-10, 152, 8], [0.3, 1, 0.3]),
    pose([2, 202, 14], [0.2, 1, 0.3]),
    [cable({ column: behind(16), attachment: 'd-handle', hold: 'r' })],
    SIDE,
  );
}

function cableKickback(): SceneSpec {
  const pose = (h: V3, pole: V3): PoseSpec => ({
    pelvis: [-10, 88, 0],
    pitch: 62,
    feet: stance(14),
    hands: { r: { at: h, pole }, l: { at: [24, 64, -18], pole: [0, -1, -0.3] } },
  });
  return two(pose([12, 78, 22], [0, 1, 0.2]), pose([-20, 96, 22], [0, 1, 0.2]), [
    cable({ column: front(14, 66), attachment: 'd-handle', hold: 'r' }),
  ]);
}

// ---------------------------------------------------------------------------------------- Curls

const CURL_POLE: V3 = [-1, -0.2, 0.1];

function cableCurl(
  att: Attachment,
  w: number,
  opts: { single?: boolean; view?: typeof SIDE; top?: number; bottom?: number } = {},
): SceneSpec {
  const gear = [
    cable({ column: front(14, 62), attachment: att, hold: opts.single ? 'r' : 'both' }),
  ];
  const pose = (h: V3) =>
    opts.single ? oneHand({ at: h, pole: CURL_POLE }) : stand({ at: h, pole: CURL_POLE });
  return two(
    pose([10, opts.bottom ?? 84, w]),
    pose([20, opts.top ?? 134, w]),
    gear,
    opts.view ?? THREE_QUARTER,
  );
}

function dualCurl(): SceneSpec {
  return two(
    stand({ at: [6, 86, 26], pole: CURL_POLE }),
    stand({ at: [18, 134, 24], pole: CURL_POLE }),
    [crossover(14, 'd-handle', { back: -8 })],
    FACING,
  );
}

function highCurl(): SceneSpec {
  return two(
    stand({ at: [-2, 146, 74], pole: [0, -1, 0] }),
    stand({ at: [-4, 158, 30], pole: [0, -1, 0.3] }),
    [crossover(178, 'd-handle', { back: -6 })],
    FACING,
  );
}

function bayesianCurl(): SceneSpec {
  const pose = (h: V3): PoseSpec => ({
    pelvis: [6, 93, 0],
    feet: split(6),
    hands: {
      r: { at: h, pole: [-1, -0.3, 0.1] },
      l: { at: [2, 100, -24], pole: [-0.6, -0.2, -1] },
    },
  });
  return two(pose([-26, 90, 20]), pose([10, 132, 20]), [
    cable({ column: behind(16, -70), attachment: 'd-handle', hold: 'r' }),
  ]);
}

function cablePreacher(): SceneSpec {
  const pose = (h: V3): PoseSpec => ({
    pelvis: [-14, 64, 0],
    pitch: 18,
    feet: feet({ at: [24, 8, 16], toe: toeOut(8) }),
    hands: hands({ at: h, pole: [0.3, -1, 0.1] }),
  });
  return two(pose([52, 88, 14]), pose([30, 140, 14]), [
    preacherBench([20, 112, 0], [-14, 56, 0]),
    cable({ column: front(14, 80), attachment: 'ez-bar' }),
  ]);
}

// ----------------------------------------------------------------------------------------- Chest

function cableFly(height: number, start: V3, end: V3, pitch = 10): SceneSpec {
  return two(
    { pelvis: [2, 93, 0], pitch, feet: split(2), hands: hands({ at: start, pole: [0, -1, 0.3] }) },
    { pelvis: [2, 93, 0], pitch, feet: split(2), hands: hands({ at: end, pole: [0, -1, 0.7] }) },
    [crossover(height)],
    FACING,
  );
}

function singleFly(): SceneSpec {
  const pose = (h: V3, pole: V3): PoseSpec => ({
    pelvis: STAND,
    pitch: 6,
    feet: FEET,
    hands: { r: { at: h, pole }, l: { at: [-4, 100, -24], pole: [-0.6, -0.2, -1] } },
  });
  return two(
    pose([-4, 134, 66], [0, -1, 0.3]),
    pose([40, 126, -4], [0, -1, 0.7]),
    [cable({ column: rightSide(140, 86), attachment: 'd-handle', hold: 'r' })],
    FACING,
  );
}

function cablePress(): SceneSpec {
  return two(
    {
      pelvis: [4, 93, 0],
      pitch: 8,
      feet: split(4),
      hands: hands({ at: [10, 130, 26], pole: [-0.4, -0.6, 1] }),
    },
    {
      pelvis: [4, 93, 0],
      pitch: 8,
      feet: split(4),
      hands: hands({ at: [56, 132, 10], pole: [-0.2, -1, 0.8] }),
    },
    [crossover(130, 'd-handle', { back: -34 })],
    THREE_QUARTER,
  );
}

// ------------------------------------------------------------------------------------- Shoulders

function facePull(): SceneSpec {
  return two(
    {
      pelvis: [-4, 93, 0],
      pitch: -4,
      feet: split(-4),
      hands: hands({ at: [47, 150, 8], pole: [0, -1, 0.5] }),
    },
    {
      pelvis: [-4, 93, 0],
      pitch: -4,
      feet: split(-4),
      hands: hands({ at: [10, 158, 26], pole: [-0.3, 0.4, 1] }),
    },
    [cable({ column: front(162, 78), attachment: 'rope' })],
  );
}

function lateralRaise(): SceneSpec {
  const pose = (h: V3, pole: V3): PoseSpec => ({
    pelvis: STAND,
    lean: -6,
    feet: FEET,
    hands: { r: { at: h, pole }, l: { at: [-6, 120, -50], pole: [0, -1, -0.5] } },
  });
  return two(
    pose([10, 90, -4], [0, -1, 0.3]),
    pose([4, 140, 72], [0, -1, 0.2]),
    [cable({ column: leftSide(14, -86), attachment: 'd-handle', hold: 'r' })],
    FACING,
  );
}

function frontRaise(att: Attachment, w: number): SceneSpec {
  return two(
    stand({ at: [10, 86, w], pole: [-0.2, -1, 0.3] }),
    stand({ at: [54, 142, w], pole: [-0.2, -1, 0.3] }),
    [cable({ column: behind(14, -54), attachment: att })],
  );
}

function rearDeltFly(): SceneSpec {
  return two(
    stand(
      { at: [44, 140, -8], pole: [0, -1, -0.4] },
      { pitch: 4 },
      { at: [44, 142, 8], pole: [0, -1, 0.4] },
    ),
    stand({ at: [-2, 142, 72], pole: [0, -1, 0.2] }, { pitch: 4 }),
    [crossover(146, 'cable-end', { crossed: true, back: 6 })],
    FACING,
  );
}

function uprightRow(att: Attachment, w0: number, w1: number): SceneSpec {
  return two(
    stand({ at: [12, 86, w0], pole: [0, -1, 1] }),
    stand({ at: [14, 136, w1], pole: [-0.3, 1, 1] }),
    [cable({ column: front(14, 58), attachment: att })],
    THREE_QUARTER,
  );
}

function yRaise(): SceneSpec {
  return two(
    stand({ at: [22, 95, -8], pole: [0, -1, -0.4] }, {}, { at: [24, 97, 8], pole: [0, -1, 0.4] }),
    stand({ at: [6, 196, 46], pole: [0, -1, 0.3] }),
    [crossover(14, 'cable-end', { crossed: true, back: 8 })],
    FACING,
  );
}

function externalRotation(): SceneSpec {
  const pose = (h: V3): PoseSpec => ({
    pelvis: STAND,
    feet: FEET,
    hands: { r: { at: h, pole: [0, -1, 0.2] }, l: { at: [-4, 100, -24], pole: [-0.6, -0.2, -1] } },
  });
  return two(
    pose([24, 112, -2]),
    pose([12, 112, 46]),
    [cable({ column: leftSide(112, -82), attachment: 'd-handle', hold: 'r' })],
    FACING,
  );
}

// ------------------------------------------------------------------------------------------ Back

function straightArmPulldown(att: Attachment, w0: number, w1: number): SceneSpec {
  const pose = (h: V3): PoseSpec => ({
    pelvis: [-12, 92, 0],
    pitch: 22,
    feet: stance(14),
    hands: hands({ at: h, pole: [-0.2, 1, 0.4] }),
  });
  return two(pose([44, 148, w0]), pose([10, 90, w1]), [
    cable({ column: front(198, 66), attachment: att }),
  ]);
}

function cableShrug(): SceneSpec {
  return two(
    stand({ at: [8, 84, 16], pole: [-1, -0.2, 0.3] }),
    stand({ at: [8, 91, 16], pole: [-1, -0.2, 0.3] }, { shrug: 7 }),
    [cable({ column: front(14, 52), attachment: 'straight-bar' })],
    THREE_QUARTER,
    motion.head,
  );
}

function standingRow(): SceneSpec {
  const pose = (h: V3, pole: V3): PoseSpec => ({
    pelvis: [-4, 92, 0],
    pitch: 10,
    feet: feet({ at: [-24, 8, 13], toe: toeOut(4) }, { at: [21, 8, -13], toe: toeOut(-6) }),
    hands: { r: { at: h, pole }, l: { at: [8, 100, -24], pole: [-0.6, -0.2, -1] } },
  });
  return two(pose([52, 118, 16], REACH), pose([0, 112, 22], BACK), [
    cable({ column: front(118, 80), attachment: 'd-handle', hold: 'r' }),
  ]);
}

// -------------------------------------------------------------------------------- Legs and glutes

/** Hands on the column in front, holding on. */
const HOLD_ON = hands({ at: [44, 118, 14], pole: [-0.4, -1, 0.5] });

function gluteKickback(): SceneSpec {
  const pose = (foot: V3, pole: V3): PoseSpec => ({
    pelvis: [-4, 92, 0],
    pitch: 26,
    feet: { r: { at: foot, pole }, l: { at: [-2, 8, -12], toe: toeOut(-4) } },
    hands: HOLD_ON,
  });
  return two(
    pose([8, 12, 12], [1, 0, 0.2]),
    pose([-56, 46, 12], [0.2, -1, 0]),
    [cable({ column: front(12, 56), attachment: 'ankle-strap', hold: 'r' })],
    SIDE,
    motion.foot,
  );
}

function pullThrough(): SceneSpec {
  const legs = stance(19, 0, 16);
  return two(
    {
      pelvis: [-18, 86, 0],
      pitch: 70,
      feet: legs,
      hands: hands({ at: [8, 52, 4], pole: [0, -1, 0.3] }),
    },
    { pelvis: STAND, feet: legs, hands: hands({ at: [8, 92, 6], pole: [0, -1, 0.3] }) },
    [cable({ column: behind(14, -78), attachment: 'rope' })],
    SIDE,
    motion.hips,
  );
}

function hipAbduction(): SceneSpec {
  const pose = (foot: V3): PoseSpec => ({
    pelvis: STAND,
    lean: -6,
    feet: { r: { at: foot, pole: [1, 0, 0] }, l: { at: [0, 8, -12], toe: toeOut(-4) } },
    hands: {
      r: { at: [-2, 100, 26], pole: [-0.6, -0.2, 1] },
      l: { at: [-6, 120, -50], pole: [0, -1, -0.5] },
    },
  });
  return two(
    pose([6, 9, -4]),
    pose([0, 34, 52]),
    [cable({ column: leftSide(12, -74), attachment: 'ankle-strap', hold: 'r' })],
    FACING,
    motion.foot,
  );
}

function hipAdduction(): SceneSpec {
  const pose = (foot: V3): PoseSpec => ({
    pelvis: STAND,
    lean: 4,
    feet: { r: { at: foot, pole: [1, 0, 0] }, l: { at: [0, 8, -12], toe: toeOut(-4) } },
    hands: {
      r: { at: [-4, 120, 50], pole: [0, -1, 0.5] },
      l: { at: [-2, 100, -26], pole: [-0.6, -0.2, -1] },
    },
  });
  return two(
    pose([0, 28, 48]),
    pose([6, 9, -6]),
    [cable({ column: rightSide(12, 84), attachment: 'ankle-strap', hold: 'r' })],
    FACING,
    motion.foot,
  );
}

function cableRdl(): SceneSpec {
  return two(
    stand({ at: [8, 84, 14], pole: [-1, -0.2, 0.3] }),
    {
      pelvis: [-20, 88, 0],
      pitch: 74,
      feet: FEET,
      hands: hands({ at: [26, 46, 14], pole: [-1, -0.2, 0.3] }),
    },
    [cable({ column: front(14, 62), attachment: 'straight-bar' })],
    SIDE,
    motion.hips,
  );
}

function standingLegCurl(): SceneSpec {
  const pose = (foot: V3, pole: V3): PoseSpec => ({
    pelvis: [-2, 93, 0],
    pitch: 8,
    feet: { r: { at: foot, pole }, l: { at: [-2, 8, -12], toe: toeOut(-4) } },
    hands: HOLD_ON,
  });
  return two(
    pose([-2, 10, 12], [1, 0, 0.1]),
    pose([-38, 58, 12], [1, -0.4, 0]),
    [cable({ column: front(12, 56), attachment: 'ankle-strap', hold: 'r' })],
    SIDE,
    motion.foot,
  );
}

// ------------------------------------------------------------------------------------------ Core

function cableCrunch(): SceneSpec {
  const kneel = feet({ at: [-40, 8, 11], pole: [0.3, -1, 0], toe: [-0.3, -1, 0] });
  return two(
    {
      pelvis: [0, 62, 0],
      pitch: 22,
      feet: kneel,
      hands: hands({ at: [22, 132, 8], pole: [0.3, -1, 0.6] }),
    },
    {
      pelvis: [-2, 60, 0],
      pitch: 78,
      feet: kneel,
      hands: hands({ at: [38, 74, 8], pole: [0.3, -1, 0.6] }),
    },
    [cable({ column: front(198, 50), attachment: 'rope' })],
    SIDE,
    motion.head,
  );
}

function woodchop(high: boolean): SceneSpec {
  const legs = stance(22, 0, 12);
  // From up by the right shoulder down to the left hip, or from the right knee up past the left shoulder.
  const start: V3 = high ? [8, 166, 38] : [28, 86, 18];
  const end: V3 = high ? [18, 98, -22] : [10, 170, -32];
  const both = (h: V3) => hands({ at: h, pole: [0, -1, 0.2] }, { at: h, pole: [0, -1, -0.2] });
  return two(
    {
      pelvis: high ? STAND : [-6, 88, 0],
      feet: legs,
      twist: 30,
      pitch: high ? 0 : 30,
      hands: both(start),
    },
    { pelvis: STAND, feet: legs, twist: -36, hands: both(end) },
    [cable({ column: rightSide(high ? 196 : 18, 86), attachment: 'd-handle', hold: 'r' })],
    FRONT,
    motion.hand,
  );
}

function pallofPress(): SceneSpec {
  const both = (h: V3) => hands({ at: h, pole: [0, -1, 0.5] }, { at: h, pole: [0, -1, -0.5] });
  return two(
    { pelvis: STAND, feet: stance(16), hands: both([20, 124, 2]) },
    { pelvis: STAND, feet: stance(16), hands: both([50, 126, 2]) },
    [cable({ column: rightSide(124, 82), attachment: 'd-handle', hold: 'r' })],
    FACING,
  );
}

export const CABLE_ART: Record<string, SceneSpec> = {
  // Seated rows
  'cb-seated-row-v-handle': seatedCableRow('v-handle', 6),
  'cb-seated-row-wide-bar': seatedCableRow('lat-bar', 34, 32, { flare: true, to: [12, 94, 32] }),
  'cb-seated-row-narrow-neutral': seatedCableRow('narrow-neutral', 9),
  'cb-seated-row-wide-neutral': seatedCableRow('wide-neutral', 26, 26, { to: [10, 84, 26] }),
  'cb-seated-row-rope': seatedCableRow('rope', 8, 20),
  'cb-seated-row-single-arm': seatedCableRow('d-handle', 12, 20, { single: true }),
  'cb-seated-row-ez-bar': seatedCableRow('ez-bar', 14),
  // Lat pulldowns
  'cb-lat-pulldown-wide': pulldown('lat-bar', [4, 156, 44], [10, 122, 40]),
  'cb-lat-pulldown-v-handle': pulldown('v-handle', [8, 160, 6], [16, 122, 6], [UP, IN_FRONT]),
  'cb-lat-pulldown-neutral': pulldown('wide-neutral', [6, 158, 26], [12, 122, 26]),
  'cb-lat-pulldown-underhand': pulldown('lat-bar', [6, 159, 19], [14, 120, 18], [UP, IN_FRONT]),
  'cb-lat-pulldown-mag-pronated': pulldown('mag-pronated', [6, 158, 28], [12, 121, 27]),
  'cb-lat-pulldown-mag-neutral': pulldown(
    'mag-neutral',
    [7, 159, 17],
    [14, 121, 17],
    [UP, IN_FRONT],
  ),
  'cb-lat-pulldown-single-arm': pulldown('d-handle', [4, 160, 18], [10, 122, 24], [UP, DOWN], true),
  'cb-lat-pulldown-rope': pulldown('rope', [7, 160, 8], [12, 122, 22]),
  // Triceps
  'cb-pushdown-straight-bar': pushdown('straight-bar', 14),
  'cb-pushdown-ez-bar': pushdown('ez-bar', 12),
  'cb-pushdown-rope': pushdown('rope', 8, 17),
  'cb-pushdown-v-bar': pushdown('v-bar', 7),
  'cb-pushdown-single-arm': pushdown('d-handle', 20, 20, true),
  'cb-pushdown-reverse-grip': pushdown('straight-bar', 16, 17),
  'cb-overhead-extension-rope': overheadExtension('rope', 9),
  'cb-overhead-extension-straight-bar': overheadExtension('straight-bar', 14),
  'cb-overhead-extension-single-arm': singleOverheadExtension(),
  'cb-triceps-kickback': cableKickback(),
  // Biceps and forearms
  'cb-curl-straight-bar': cableCurl('straight-bar', 18),
  'cb-curl-ez-bar': cableCurl('ez-bar', 14),
  'cb-curl-rope': cableCurl('rope', 10, { top: 130, bottom: 87 }),
  'cb-curl-single-d': cableCurl('d-handle', 20, { single: true }),
  'cb-curl-dual-d': dualCurl(),
  'cb-high-cable-curl': highCurl(),
  'cb-bayesian-curl': bayesianCurl(),
  'cb-preacher-curl': cablePreacher(),
  'cb-reverse-curl': cableCurl('straight-bar', 17, { view: SIDE, top: 130 }),
  // Chest
  'cb-fly-mid': cableFly(142, [-2, 132, 64], [42, 124, 7]),
  'cb-fly-high-to-low': cableFly(198, [-6, 166, 60], [36, 102, 8], 16),
  'cb-fly-low-to-high': cableFly(16, [2, 92, 52], [36, 142, 8], 4),
  'cb-single-arm-fly': singleFly(),
  'cb-chest-press': cablePress(),
  // Shoulders
  'cb-face-pull': facePull(),
  'cb-lateral-raise': lateralRaise(),
  'cb-front-raise-rope': frontRaise('rope', 8),
  'cb-front-raise-bar': frontRaise('straight-bar', 16),
  'cb-rear-delt-fly': rearDeltFly(),
  'cb-upright-row-bar': uprightRow('straight-bar', 12, 14),
  'cb-upright-row-rope': uprightRow('rope', 8, 22),
  'cb-y-raise': yRaise(),
  'cb-external-rotation': externalRotation(),
  // Back
  'cb-straight-arm-pulldown-bar': straightArmPulldown('straight-bar', 15, 15),
  'cb-straight-arm-pulldown-rope': straightArmPulldown('rope', 8, 18),
  'cb-shrug': cableShrug(),
  'cb-standing-single-arm-row': standingRow(),
  // Legs and glutes
  'cb-glute-kickback': gluteKickback(),
  'cb-pull-through': pullThrough(),
  'cb-hip-abduction': hipAbduction(),
  'cb-hip-adduction': hipAdduction(),
  'cb-romanian-deadlift': cableRdl(),
  'cb-standing-leg-curl': standingLegCurl(),
  // Core
  'cb-crunch': cableCrunch(),
  'cb-woodchop-high': woodchop(true),
  'cb-woodchop-low': woodchop(false),
  'cb-pallof-press': pallofPress(),
};
