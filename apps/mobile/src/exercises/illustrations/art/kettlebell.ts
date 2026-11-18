import { add, scale, type V3 } from '../geometry';
import { heldKettlebell, kettlebells } from '../gym';
import {
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
import type { SceneSpec } from '../render';
import type { LimbTarget, PoseSpec, Side } from '../rig';
import { CORE_ART } from './core';
import { LEGS_ART } from './legs';

// The kettlebell exercises. Where a dumbbell exercise moves the same way (the goblet squat, the
// windmill, the get-up, the carry), its poses are used with a kettlebell in the hand.

const STAND: V3 = [0, 94, 0];
const SWING_FEET = stance(18, 0, 14);
const ON_HIP: LimbTarget = { at: [-4, 100, -24], pole: [-0.6, -0.2, -1] };

/** Hinged with the bell hiked back between the legs. */
const HIKED: Pick<PoseSpec, 'pelvis' | 'pitch'> = { pelvis: [-16, 84, 0], pitch: 60 };

function swing(single: boolean): SceneSpec {
  const pose = (base: Pick<PoseSpec, 'pelvis' | 'pitch'>, h: V3): PoseSpec => ({
    ...base,
    feet: SWING_FEET,
    hands: single
      ? { r: { at: h, pole: [0, -1, 0.2] }, l: ON_HIP }
      : hands({ at: h, pole: [0, -1, 0.2] }),
  });
  return scene(
    [
      pose(HIKED, [-2, 62, single ? 6 : 4]),
      pose({ pelvis: STAND, pitch: 0 }, [50, 124, single ? 8 : 5]),
    ],
    {
      view: SIDE,
      props: [single ? kettlebells(['r'], 'arm') : heldKettlebell('arm')],
      motion: single ? motion.hand : motion.hands,
    },
  );
}

/** From the bell hiked between the legs to the rack at the shoulder, or locked out overhead. */
function fromHike(to: 'rack' | 'overhead'): SceneSpec {
  const pose = (base: Pick<PoseSpec, 'pelvis' | 'pitch'>, h: LimbTarget): PoseSpec => ({
    ...base,
    feet: SWING_FEET,
    hands: { r: h, l: ON_HIP },
  });
  const top: LimbTarget =
    to === 'rack'
      ? { at: [12, 140, 14], pole: [0, -1, 0.2] }
      : { at: [0, 202, 20], pole: [-0.2, -1, 0.4] };
  return scene(
    [pose(HIKED, { at: [-2, 62, 6], pole: [0, -1, 0.2] }), pose({ pelvis: STAND, pitch: 0 }, top)],
    {
      view: THREE_QUARTER,
      props: [kettlebells(['r'], 'auto')],
      motion: motion.hand,
    },
  );
}

function press(): SceneSpec {
  const pose = (h: LimbTarget): PoseSpec => ({
    pelvis: STAND,
    feet: stance(14),
    hands: { r: h, l: ON_HIP },
  });
  return scene(
    [
      pose({ at: [12, 140, 14], pole: [0, -1, 0.2] }),
      pose({ at: [0, 200, 20], pole: [-0.2, -1, 0.4] }),
    ],
    {
      view: THREE_QUARTER,
      props: [kettlebells(['r'], 'auto')],
      motion: motion.hand,
    },
  );
}

function deadlift(): SceneSpec {
  const legs = stance(16, 0, 14);
  return scene(
    [
      {
        pelvis: [-22, 64, 0],
        pitch: 64,
        feet: legs,
        hands: hands({ at: [14, 34, 4], pole: [0, -1, 0.3] }),
      },
      { pelvis: STAND, feet: legs, hands: hands({ at: [6, 86, 4], pole: [0, -1, 0.3] }) },
    ],
    { view: SIDE, props: [heldKettlebell('down')], motion: motion.hips },
  );
}

function row(): SceneSpec {
  const pose = (h: V3, pole: V3): PoseSpec => ({
    pelvis: [-10, 88, 0],
    pitch: 55,
    feet: feet({ at: [-22, 8, 13], toe: toeOut(4) }, { at: [22, 8, -13], toe: toeOut(-6) }),
    hands: { r: { at: h, pole }, l: { at: [22, 58, -14], pole: [0, -1, -0.3] } },
  });
  return scene([pose([30, 62, 18], [-0.2, -1, 0.5]), pose([6, 92, 20], [-1, -0.3, 0.4])], {
    view: SIDE,
    props: [kettlebells(['r'], 'down')],
    motion: motion.hand,
  });
}

/** Two kettlebells racked at the shoulders, elbows tucked down in front of the ribs. */
function frontSquat(): SceneSpec {
  const legs = stance(16, 0, 18);
  const pose = (pelvis: V3, pitch: number): PoseSpec => {
    const s = torsoOf({ pelvis, pitch });
    const f = s.frameAt(1);
    const at = (side: Side) =>
      add(
        add(add(s.shoulders[side], scale(f.forward, 14)), scale(f.up, -10)),
        scale(f.right, side === 'r' ? -6 : 6),
      );
    return {
      pelvis,
      pitch,
      feet: legs,
      hands: {
        r: { at: at('r'), pole: [0.3, -1, 0.3] },
        l: { at: at('l'), pole: [0.3, -1, -0.3] },
      },
    };
  };
  return scene([pose([0, 93, 0], 4), pose([-20, 48, 0], 22)], {
    view: FACING,
    props: [kettlebells(['r', 'l'], 'rack')],
    motion: motion.hips,
  });
}

function highPull(): SceneSpec {
  const legs = stance(24, 0, 30);
  return scene(
    [
      {
        pelvis: [-10, 60, 0],
        pitch: 20,
        feet: legs,
        hands: hands({ at: [10, 50, 4], pole: [0, -1, 0.5] }),
      },
      { pelvis: STAND, feet: legs, hands: hands({ at: [14, 146, 4], pole: [-0.3, 1, 1] }) },
    ],
    { view: FRONT, props: [heldKettlebell('down')], motion: motion.hands },
  );
}

export const KETTLEBELL_ART: Record<string, SceneSpec> = {
  'kb-swing': swing(false),
  'kb-single-arm-swing': swing(true),
  'kb-goblet-squat': regear(LEGS_ART['db-goblet-squat'], [heldKettlebell('down')]),
  'kb-deadlift': deadlift(),
  'kb-clean': fromHike('rack'),
  'kb-press': press(),
  'kb-snatch': fromHike('overhead'),
  'kb-row': row(),
  'kb-front-squat': frontSquat(),
  'kb-windmill': regear(CORE_ART['db-windmill'], [kettlebells(['r'], 'auto')]),
  'kb-turkish-get-up': regear(CORE_ART['db-turkish-get-up'], [kettlebells(['r'], 'auto')]),
  'kb-farmers-carry': regear(CORE_ART['db-farmers-carry'], [kettlebells(['r', 'l'], 'down')]),
  'kb-high-pull': highPull(),
};
