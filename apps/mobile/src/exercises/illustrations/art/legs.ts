import { add, lerp3, rad, type V3 } from '../geometry';
import {
  barbell,
  bench,
  dumbbellAt,
  dumbbells,
  heldDumbbell,
  platform,
  plyoBox,
  post,
  rackPins,
} from '../props';
import type { PropBuilder, SceneSpec } from '../render';
import type { FootTarget, LimbTarget, PoseSpec, Side, Skeleton } from '../rig';
import {
  barOnBack,
  feet,
  FRONT,
  FACING,
  hands,
  hanging,
  motion,
  scene,
  shoulderAt,
  SIDE,
  stance,
  THREE_QUARTER,
  toeOut,
} from '../poseKit';

// Squats, lunges, step-ups, hip thrusts and bridges, and calf raises.

type Hold =
  | 'back'
  | 'lowBack'
  | 'front'
  | 'goblet'
  | 'dumbbells'
  | 'shoulders'
  | 'zercher'
  | 'between'
  | 'behind';

/** The hands for a way of holding the weight, at a given hip position and bend. */
function holdHands(hold: Hold, pelvis: V3, pitch: number): Record<Side, LimbTarget> {
  const p = rad(pitch);
  const up: V3 = [Math.sin(p), Math.cos(p), 0];
  const fwd: V3 = [Math.cos(p), -Math.sin(p), 0];
  const s = shoulderAt(pelvis, pitch);
  const at = (u: number, f: number, z: number): V3 => [
    s[0] + up[0] * u + fwd[0] * f,
    s[1] + up[1] * u + fwd[1] * f,
    z,
  ];
  switch (hold) {
    case 'back':
      return barOnBack(pelvis, pitch, 32);
    case 'lowBack':
      return barOnBack(pelvis, pitch, 28, true);
    case 'front':
      return hands({ at: at(1, 12, 19), pole: [1, 0.3, 0.6] });
    case 'goblet':
      return hands({ at: at(-14, 17, 5), pole: [0.2, -1, 0.6] });
    case 'shoulders':
      return hands({ at: at(-1, 9, 21), pole: [1, -0.2, 0.4] });
    case 'zercher':
      return hands({ at: at(-20, 22, 6), pole: [0.3, -1, 0.5] });
    case 'between':
      return hands({ at: [pelvis[0] + 10, pelvis[1] - 6, 4], pole: [-0.2, -1, 0.4] });
    case 'behind':
      return hands({ at: [s[0] - 6, s[1] - 57, 21], pole: [1, -0.2, 0.2] });
    default:
      return hanging(pelvis, pitch, 4);
  }
}

function holdProps(hold: Hold): PropBuilder[] {
  switch (hold) {
    case 'goblet':
      return [
        heldDumbbell(
          (s: Skeleton) => s.frameAt(1).up,
          (s: Skeleton) => {
            const u = s.frameAt(1).up;
            return [u[0] * 4, u[1] * 4, u[2] * 4];
          },
        ),
      ];
    case 'between':
      return [
        heldDumbbell(
          () => [0, 1, 0],
          () => [0, -9, 0],
        ),
      ];
    case 'dumbbells':
      return [dumbbells('fb')];
    case 'shoulders':
      return [dumbbells('fb')];
    case 'zercher':
      return [
        barbell({
          place: (s: Skeleton) => ({
            center: add(lerp3(s.arms.r.joint, s.arms.l.joint, 0.5), [2, 2, 0]),
            axis: [0, 0, 1],
          }),
        }),
      ];
    default:
      return [barbell()];
  }
}

interface Squat {
  pelvis: V3;
  pitch: number;
}

function squat(
  hold: Hold,
  bottom: Squat,
  opts: {
    legs?: Record<Side, FootTarget>;
    top?: Squat;
    view?: typeof SIDE;
    extra?: PropBuilder[];
    topLegs?: Record<Side, FootTarget>;
  } = {},
): SceneSpec {
  const legs = opts.legs ?? stance(16, 0, 18);
  const top = opts.top ?? { pelvis: [0, 93, 0], pitch: 6 };
  const pose = (q: Squat, l: Record<Side, FootTarget>): PoseSpec => ({
    pelvis: q.pelvis,
    pitch: q.pitch,
    feet: l,
    hands: holdHands(hold, q.pelvis, q.pitch),
  });
  return scene([pose(top, opts.topLegs ?? legs), pose(bottom, legs)], {
    view: opts.view ?? SIDE,
    props: [...(opts.extra ?? []), ...holdProps(hold)],
    motion: motion.hips,
  });
}

const KNEES_OUT = (s: number): V3 => [1, 0, 0.45 * s];
const wide = feet({ at: [2, 8, 33], toe: toeOut(36), pole: KNEES_OUT(1) });
const HEELS_UP = feet({ at: [0, 13, 13], toe: [0.95, -0.28, 0.12] });
const NARROW_HEELS_UP = feet({ at: [0, 13, 7], toe: [0.97, -0.25, 0.05] });
const heelWedge = platform([-6, 5, 0], { x: 12, z: 44 });

// ------------------------------------------------------------------------------------- Lunges

interface Split {
  pelvis: V3;
  pitch?: number;
  front: FootTarget;
  back: FootTarget;
}

const BACK_TOE: V3 = [0.55, -0.83, 0];
const lungeBottom: Split = {
  pelvis: [-4, 52, 0],
  pitch: 4,
  front: { at: [38, 8, 11] },
  back: { at: [-48, 12, -11], pole: [0.3, -1, 0], toe: BACK_TOE },
};
const splitTop: Split = {
  pelvis: [-5, 84, 0],
  pitch: 2,
  front: { at: [38, 8, 11] },
  back: { at: [-48, 12, -11], pole: [0.3, -1, 0], toe: BACK_TOE },
};
const standTogether: Split = {
  pelvis: [0, 93, 0],
  front: { at: [0, 8, 11] },
  back: { at: [0, 8, -11] },
};
/** Standing where a reverse lunge's front foot stays. */
const STAND_FRONT: Split = {
  pelvis: [37, 93, 0],
  front: { at: [38, 8, 11] },
  back: { at: [38, 8, -11] },
};

function lunge(
  hold: Hold,
  frames: Split[],
  opts: { extra?: PropBuilder[]; view?: typeof SIDE; mirrorSecond?: boolean } = {},
): SceneSpec {
  const poses = frames.map((f, i): PoseSpec => {
    const swap = opts.mirrorSecond && i === 1;
    const front = swap
      ? { ...f.front, at: [f.front.at[0], f.front.at[1], -f.front.at[2]] as V3 }
      : f.front;
    const back = swap
      ? { ...f.back, at: [f.back.at[0], f.back.at[1], -f.back.at[2]] as V3 }
      : f.back;
    return {
      pelvis: f.pelvis,
      pitch: f.pitch ?? 0,
      feet: swap ? { r: back, l: front } : { r: front, l: back },
      hands: holdHands(hold, f.pelvis, f.pitch ?? 0),
    };
  });
  return scene(poses, {
    view: opts.view ?? SIDE,
    props: [...(opts.extra ?? []), ...holdProps(hold)],
    motion: motion.hips,
  });
}

function bulgarian(hold: Hold): SceneSpec {
  const back: FootTarget = { at: [-62, 50, -11], pole: [0.3, -1, 0], toe: [-0.95, 0.2, 0] };
  return lunge(
    hold,
    [
      { pelvis: [-6, 86, 0], pitch: 4, front: { at: [30, 8, 11] }, back },
      { pelvis: [-12, 55, 0], pitch: 10, front: { at: [30, 8, 11] }, back },
    ],
    { extra: [bench({ at: [-74, 44, 0], across: true, length: 70 })] },
  );
}

function stepUp(hold: Hold): SceneSpec {
  const top = 46;
  return scene(
    [
      {
        pelvis: [2, 80, 0],
        pitch: 12,
        feet: { r: { at: [34, top + 8, 11] }, l: { at: [-8, 8, -11] } },
        hands: holdHands(hold, [2, 80, 0], 12),
      },
      {
        pelvis: [28, 138, 0],
        pitch: 4,
        feet: { r: { at: [34, top + 8, 11] }, l: { at: [16, top + 26, -11], toe: [0.6, -0.8, 0] } },
        hands: holdHands(hold, [28, 138, 0], 4),
      },
    ],
    {
      view: SIDE,
      props: [plyoBox([38, top, 0], { x: 46, z: 50 }), ...holdProps(hold)],
      motion: motion.hips,
    },
  );
}

function curtsy(): SceneSpec {
  return lunge(
    'dumbbells',
    [
      standTogether,
      {
        pelvis: [-4, 54, -6],
        pitch: 6,
        front: { at: [24, 8, -12] },
        back: { at: [-36, 12, -34], pole: [0.3, -1, 0], toe: BACK_TOE },
      },
    ],
    { view: THREE_QUARTER },
  );
}

/** Stepping out to the side (lateral lunge) or sinking low over one leg (Cossack), seen face-on. */
function sideLunge(hold: Hold, deep: boolean): SceneSpec {
  const bent: FootTarget = { at: [4, 8, 58], toe: toeOut(20), pole: KNEES_OUT(1) };
  const straight: FootTarget = deep
    ? { at: [4, 8, -48], toe: [0.25, 0.97, -0.1], pole: [1, 0, -0.2] }
    : { at: [2, 8, -26], toe: toeOut(-12) };
  const low: V3 = deep ? [-12, 34, 24] : [-12, 58, 26];
  const pitch = deep ? 26 : 34;
  const start = deep
    ? { pelvis: [-4, 79, 4] as V3, pitch: 8, feet: { r: { ...bent }, l: { ...straight } } }
    : { pelvis: [0, 93, 0] as V3, pitch: 4, feet: stance(12) };
  return scene(
    [
      { ...start, hands: holdHands(hold, start.pelvis, start.pitch) },
      { pelvis: low, pitch, feet: { r: bent, l: straight }, hands: holdHands(hold, low, pitch) },
    ],
    { view: FRONT, props: holdProps(hold), motion: motion.hips },
  );
}

function singleLegSquat(): SceneSpec {
  const free = (x: number, y: number): FootTarget => ({
    at: [x, y, -9],
    toe: [0.9, 0.35, 0],
    pole: [0, 1, 0],
  });
  return scene(
    [
      {
        pelvis: [0, 93, 3],
        pitch: 4,
        feet: { r: { at: [0, 8, 11] }, l: free(30, 22) },
        hands: hands({ at: [34, 128, 5], pole: [-0.2, -1, 0.5] }),
      },
      {
        pelvis: [-26, 40, 3],
        pitch: 38,
        feet: { r: { at: [0, 8, 11] }, l: free(60, 30) },
        hands: hands({ at: [44, 82, 5], pole: [-0.2, -1, 0.5] }),
      },
    ],
    {
      view: SIDE,
      props: [
        heldDumbbell(
          () => [0, 0, 1],
          () => [0, 0, 0],
        ),
      ],
      motion: motion.hips,
    },
  );
}

// ------------------------------------------------------------------------------- Hip extension

function hipThrust(gear: 'barbell' | 'dumbbell', single = false): SceneSpec {
  const pose = (pelvis: V3, pitch: number): PoseSpec => {
    const p = rad(pitch);
    const fwd: V3 = [Math.cos(p), -Math.sin(p), 0];
    const onHips: V3 = [pelvis[0] + fwd[0] * 13, pelvis[1] + fwd[1] * 13, 0];
    const width = gear === 'barbell' ? 30 : 9;
    return {
      pelvis,
      pitch,
      feet: single
        ? {
            r: { at: [34, 8, 14], pole: [0, 1, 0.2] },
            l: { at: [pelvis[0] + 40, pelvis[1] + 50, -10], pole: [0.2, 1, 0] },
          }
        : feet({ at: [34, 8, 16], pole: [0, 1, 0.25] }),
      hands: hands({ at: [onHips[0], onHips[1] + 2, width], pole: [0, -0.3, 1] }),
    };
  };
  const gearProp =
    gear === 'barbell'
      ? barbell()
      : dumbbellAt(
          (s: Skeleton) => {
            const f = s.pelvisFrame.forward;
            return add(s.pelvis, [f[0] * 15, f[1] * 15, 0]);
          },
          () => [0, 0, 1],
        );
  return scene([pose([-12, 24, 0], -58), pose([-6, 52, 0], -93)], {
    view: THREE_QUARTER,
    props: [bench({ at: [-44, 44, 0], across: true, length: 110 }), gearProp],
    motion: motion.hips,
  });
}

function gluteBridge(gear: 'barbell' | 'dumbbell', single = false): SceneSpec {
  const pose = (pelvis: V3, pitch: number): PoseSpec => {
    const p = rad(pitch);
    const fwd: V3 = [Math.cos(p), -Math.sin(p), 0];
    const onHips: V3 = [pelvis[0] + fwd[0] * 13, pelvis[1] + fwd[1] * 13, 0];
    const width = gear === 'barbell' ? 30 : 9;
    return {
      pelvis,
      pitch,
      feet: single
        ? {
            r: { at: [40, 8, 14], pole: [0, 1, 0.2] },
            l: { at: [pelvis[0] + 70, pelvis[1] + 30, -10], pole: [0.2, 1, 0] },
          }
        : feet({ at: [40, 8, 15], pole: [0, 1, 0.2] }),
      hands: hands({ at: [onHips[0], onHips[1] + 2, width], pole: [0, -0.3, 1] }),
    };
  };
  const gearProp =
    gear === 'barbell'
      ? barbell()
      : dumbbellAt(
          (s: Skeleton) => {
            const f = s.pelvisFrame.forward;
            return add(s.pelvis, [f[0] * 15, f[1] * 15, 0]);
          },
          () => [0, 0, 1],
        );
  return scene([pose([8, 12, 0], -90), pose([6, 38, 0], -120)], {
    view: THREE_QUARTER,
    props: [gearProp],
    motion: motion.hips,
  });
}

// ---------------------------------------------------------------------------------------- Calves

const STEP = 8;
const stepPlate = platform([12, STEP, 0], { x: 26, z: 60 });
const FLAT_TOE: V3 = [0.97, 0.24, 0.05];
const TIPTOE: V3 = [0.62, -0.79, 0.05];

function calfRaise(hold: Hold, single = false): SceneSpec {
  const low = STEP + 8 - 3;
  const high = STEP + 8 + 11;
  const legsAt = (y: number, toe: V3): Record<Side, FootTarget> =>
    single
      ? {
          r: { at: [0, y, 11], toe },
          l: { at: [-18, y + 14, -6], toe: [0.4, -0.9, 0], pole: [0, -1, 0] },
        }
      : feet({ at: [0, y, 12], toe });
  const pose = (y: number, toe: V3): PoseSpec => {
    const pelvis: V3 = [0, 94 + (y - (STEP + 8)), single ? 4 : 0];
    return {
      pelvis,
      feet: legsAt(y, toe),
      hands:
        single && hold === 'dumbbells'
          ? {
              r: { at: [3, pelvis[1] - 8, 22], pole: [-0.2, -1, 0.2] },
              l: { at: [8, pelvis[1] + 36, -40], pole: [0, -1, -0.4] },
            }
          : holdHands(hold, pelvis, 0),
    };
  };
  const props = [
    stepPlate,
    ...(single && hold === 'dumbbells'
      ? [dumbbells('fb', ['r']), post([10, 0, -44])]
      : holdProps(hold)),
  ];
  return scene([pose(low, FLAT_TOE), pose(high, TIPTOE)], {
    view: THREE_QUARTER,
    props,
    motion: motion.hips,
  });
}

function seatedCalfRaise(gear: 'barbell' | 'dumbbell'): SceneSpec {
  const pose = (lift: number, toe: V3): PoseSpec => ({
    pelvis: [-2, 53, 0],
    pitch: 8,
    feet: feet({ at: [42, STEP + 8 + lift, 12], toe }),
    hands: hands({ at: [38, 62 + lift, gear === 'barbell' ? 24 : 12], pole: [-0.3, -1, 0.4] }),
  });
  const knees = (s: Skeleton): V3 => lerp3(s.legs.r.joint, s.legs.l.joint, 0.5);
  const gearProps: PropBuilder[] =
    gear === 'barbell'
      ? [
          barbell({
            place: (s: Skeleton) => ({ center: add(knees(s), [-2, 7, 0]), axis: [0, 0, 1] }),
          }),
        ]
      : [
          dumbbellAt(
            (s: Skeleton) => add(s.legs.r.joint, [-2, 8, 0]),
            () => [1, 0, 0],
          ),
          dumbbellAt(
            (s: Skeleton) => add(s.legs.l.joint, [-2, 8, 0]),
            () => [1, 0, 0],
          ),
        ];
  return scene([pose(-3, FLAT_TOE), pose(9, TIPTOE)], {
    view: THREE_QUARTER,
    props: [bench({ at: [-48, 44, 0] }), platform([46, STEP, 0], { x: 26, z: 60 }), ...gearProps],
    motion: (s: Skeleton) => s.legs.r.joint,
  });
}

function donkeyCalfRaise(gear: 'barbell' | 'dumbbell'): SceneSpec {
  const pose = (y: number, toe: V3): PoseSpec => {
    const pelvis: V3 = [-4, 94 + (y - (STEP + 8)), 0];
    return {
      pelvis,
      pitch: 88,
      feet: feet({ at: [0, y, 12], toe }),
      hands: hands({ at: [60, 62, 16], pole: [-0.4, -1, 0.3] }),
      headPitch: -15,
    };
  };
  const onBack = (s: Skeleton): V3 => {
    const u = s.pelvisFrame.up;
    const f = s.pelvisFrame.forward;
    return add(s.pelvis, [u[0] * 6 - f[0] * 13, u[1] * 6 - f[1] * 13, 0]);
  };
  const load: PropBuilder =
    gear === 'barbell'
      ? barbell({ place: (s: Skeleton) => ({ center: onBack(s), axis: [0, 0, 1] }) })
      : dumbbellAt(onBack, () => [0, 0, 1]);
  return scene([pose(STEP + 8 - 3, FLAT_TOE), pose(STEP + 8 + 11, TIPTOE)], {
    view: THREE_QUARTER,
    props: [stepPlate, bench({ at: [62, 48, 0], across: true, length: 60 }), load],
    motion: motion.hips,
  });
}

function tibialisRaise(): SceneSpec {
  const seat = 62;
  const pose = (toe: V3): PoseSpec => ({
    pelvis: [-2, seat + 9, 0],
    feet: feet({ at: [40, 22, 5], toe }),
    hands: hands({ at: [8, seat + 4, 24], pole: [-0.2, -1, 0.3] }),
  });
  const between = (s: Skeleton): V3 => {
    const t = lerp3(s.feet.r.toe, s.feet.l.toe, 0.5);
    return add(t, [-2, 0, 0]);
  };
  return scene([pose([0.55, -0.83, 0.02]), pose([0.92, 0.38, 0.02])], {
    view: THREE_QUARTER,
    props: [plyoBox([-8, seat, 0], { x: 44, z: 46 }), dumbbellAt(between, () => [0, 1, 0])],
    motion: (s: Skeleton) => lerp3(s.feet.r.toe, s.feet.l.toe, 0.5),
  });
}

export const LEGS_ART: Record<string, SceneSpec> = {
  // Squats
  'bb-back-squat': squat('back', { pelvis: [-28, 54, 0], pitch: 40 }),
  'bb-high-bar-squat': squat('back', { pelvis: [-20, 48, 0], pitch: 28 }, { view: THREE_QUARTER }),
  'bb-low-bar-squat': squat(
    'lowBack',
    { pelvis: [-34, 58, 0], pitch: 50 },
    { legs: stance(18, 0, 24) },
  ),
  'bb-front-squat': squat('front', { pelvis: [-20, 48, 0], pitch: 20 }),
  'bb-zercher-squat': squat('zercher', { pelvis: [-22, 50, 0], pitch: 26 }),
  'bb-box-squat': squat(
    'back',
    { pelvis: [-32, 56, 0], pitch: 36 },
    {
      legs: stance(22, 0, 25),
      extra: [plyoBox([-40, 46, 0], { x: 40, z: 44 })],
    },
  ),
  'bb-pause-squat': squat('back', { pelvis: [-24, 47, 0], pitch: 34 }, { view: THREE_QUARTER }),
  'bb-pin-squat': (() => {
    const s = squat('back', { pelvis: [-28, 54, 0], pitch: 40 }, { extra: [rackPins(99, -4)] });
    return { ...s, frames: [s.frames[1], s.frames[0]] };
  })(),
  'bb-hack-squat': squat(
    'behind',
    { pelvis: [-18, 52, 0], pitch: 18 },
    { legs: stance(13, 0, 10) },
  ),
  'bb-heels-elevated-squat': squat(
    'back',
    { pelvis: [-18, 50, 0], pitch: 22 },
    { legs: HEELS_UP, extra: [heelWedge] },
  ),
  'bb-sumo-squat': squat(
    'back',
    { pelvis: [-10, 56, 0], pitch: 18 },
    { legs: wide, top: { pelvis: [0, 90, 0], pitch: 4 }, view: FRONT },
  ),
  'db-goblet-squat': squat(
    'goblet',
    { pelvis: [-20, 46, 0], pitch: 24 },
    { legs: stance(18, 0, 22), view: FACING },
  ),
  'db-front-squat': squat('shoulders', { pelvis: [-20, 48, 0], pitch: 22 }, { view: FACING }),
  'db-sumo-squat': squat(
    'between',
    { pelvis: [-10, 56, 0], pitch: 14 },
    { legs: wide, top: { pelvis: [0, 90, 0], pitch: 4 }, view: FRONT },
  ),
  'db-heels-elevated-squat': squat(
    'dumbbells',
    { pelvis: [-16, 50, 0], pitch: 16 },
    { legs: HEELS_UP, extra: [heelWedge] },
  ),
  'db-cyclist-squat': squat(
    'dumbbells',
    { pelvis: [-8, 50, 0], pitch: 8 },
    { legs: NARROW_HEELS_UP, extra: [heelWedge] },
  ),
  'db-single-leg-squat': singleLegSquat(),

  // Lunges and split stances
  'db-forward-lunge': lunge('dumbbells', [standTogether, lungeBottom]),
  'db-reverse-lunge': lunge('dumbbells', [STAND_FRONT, lungeBottom]),
  'db-walking-lunge': lunge('dumbbells', [lungeBottom, lungeBottom], { mirrorSecond: true }),
  'db-split-squat': lunge('dumbbells', [splitTop, lungeBottom]),
  'bb-walking-lunge': lunge('back', [lungeBottom, lungeBottom], { mirrorSecond: true }),
  'bb-reverse-lunge': lunge('back', [STAND_FRONT, lungeBottom]),
  'bb-split-squat': lunge('back', [splitTop, lungeBottom]),
  'db-bulgarian-split-squat': bulgarian('dumbbells'),
  'bb-bulgarian-split-squat': bulgarian('back'),
  'db-step-up': stepUp('dumbbells'),
  'bb-step-up': stepUp('back'),
  'db-curtsy-lunge': curtsy(),
  'db-lateral-lunge': sideLunge('dumbbells', false),
  'db-goblet-lateral-lunge': sideLunge('goblet', false),
  'bb-lateral-lunge': sideLunge('back', false),
  'db-cossack-squat': sideLunge('goblet', true),
  'bb-cossack-squat': sideLunge('back', true),

  // Hip thrusts and bridges
  'bb-hip-thrust': hipThrust('barbell'),
  'db-hip-thrust': hipThrust('dumbbell'),
  'bb-single-leg-hip-thrust': hipThrust('barbell', true),
  'bb-glute-bridge': gluteBridge('barbell'),
  'db-glute-bridge': gluteBridge('dumbbell'),
  'db-single-leg-glute-bridge': gluteBridge('dumbbell', true),

  // Calves
  'db-standing-calf-raise': calfRaise('dumbbells'),
  'db-single-leg-calf-raise': calfRaise('dumbbells', true),
  'bb-standing-calf-raise': calfRaise('back'),
  'bb-single-leg-calf-raise': calfRaise('back', true),
  'db-seated-calf-raise': seatedCalfRaise('dumbbell'),
  'bb-seated-calf-raise': seatedCalfRaise('barbell'),
  'db-donkey-calf-raise': donkeyCalfRaise('dumbbell'),
  'bb-donkey-calf-raise': donkeyCalfRaise('barbell'),
  'db-tibialis-raise': tibialisRaise(),
};
