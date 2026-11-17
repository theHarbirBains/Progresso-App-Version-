import { add, lerp3, normalize, sub, type V3 } from '../geometry';
import { barbell, bench, dumbbells, heldDumbbell, legRoller, mat } from '../props';
import type { PropBuilder, SceneSpec } from '../render';
import type { PoseSpec, Side, Skeleton } from '../rig';
import { feet, hands, LYING, motion, scene, shoulderAt } from '../poseKit';

// Exercises lying on a bench or the floor: presses, flies, pullovers and lying triceps work.

type Surface = 'flat' | 'incline' | 'decline' | 'floor';

interface Lie {
  pelvis: V3;
  pitch: number;
  feet: PoseSpec['feet'];
  props: PropBuilder[];
}

/** Lying back on a bench (or the floor), head to the left, feet planted. */
function lie(surface: Surface, angle = 30): Lie {
  switch (surface) {
    case 'incline':
      return {
        pelvis: [-9, 55, 0],
        pitch: -(90 - angle),
        feet: feet({ at: [38, 8, 20], pole: [0.4, 1, 0.2] }),
        props: [bench({ at: [8, 44, 0], angle })],
      };
    case 'decline':
      return {
        pelvis: [6, 57, 0],
        pitch: -108,
        feet: feet({ at: [42, 30, 11], pole: [0.5, 1, 0], toe: [0.4, -0.9, 0] }),
        props: [bench({ at: [8, 46, 0], angle: -18, length: 92 }), legRoller([44, 34, 0])],
      };
    case 'floor':
      return {
        pelvis: [8, 12, 0],
        pitch: -90,
        feet: feet({ at: [42, 8, 16], pole: [0, 1, 0.15] }),
        props: [mat([-18, 0, 0], { x: 190, z: 64 })],
      };
    default:
      return {
        pelvis: [8, 54, 0],
        pitch: -90,
        feet: feet({ at: [44, 8, 22], pole: [0, 1, 0.2] }),
        props: [bench({ at: [-22, 44, 0] })],
      };
  }
}

/** A point measured from the right shoulder (mirrored for the left), in world directions. */
function off(l: Lie, o: V3, side: Side = 'r'): V3 {
  const s = shoulderAt(l.pelvis, l.pitch, side);
  return add(s, side === 'r' ? o : [o[0], o[1], -o[2]]);
}

function pose(
  l: Lie,
  r: V3,
  poleR: V3,
  extra: Partial<PoseSpec> = {},
  left?: { at: V3; pole: V3 },
): PoseSpec {
  return {
    pelvis: l.pelvis,
    pitch: l.pitch,
    feet: l.feet,
    hands: left
      ? { r: { at: off(l, r), pole: poleR }, l: left }
      : hands({ at: off(l, r), pole: poleR }),
    ...extra,
  };
}

const OUT_DOWN: V3 = [0, -1, 0.75];
const TUCKED: V3 = [0.7, -1, 0.25];

function press(
  surface: Surface,
  kind: 'dumbbell' | 'barbell' | 'squeeze' | 'close',
  angle?: number,
): SceneSpec {
  const l = lie(surface, angle);
  const bar = kind === 'barbell';
  const top: V3 = bar
    ? [5, 57, 8]
    : kind === 'squeeze' || kind === 'close'
      ? [5, 57, -10]
      : [3, 57, -2];
  const bottom: V3 = bar
    ? [10, 15, 8]
    : kind === 'squeeze'
      ? [10, 17, -10]
      : kind === 'close'
        ? [12, 15, -6]
        : [5, 14, 12];
  const pole = kind === 'close' ? TUCKED : OUT_DOWN;
  const gear = bar ? barbell() : dumbbells(kind === 'dumbbell' ? 'lr' : 'ud');
  return scene([pose(l, bottom, pole), pose(l, top, pole)], {
    view: LYING,
    props: [...l.props, gear],
    motion: bar ? motion.hands : motion.hand,
  });
}

function fly(surface: Surface, angle?: number): SceneSpec {
  const l = lie(surface, angle);
  return scene([pose(l, [8, 54, -10], [0, -1, 0.4]), pose(l, [6, 4, 42], [0, -1, 0.1])], {
    view: LYING,
    props: [...l.props, dumbbells('ud')],
    motion: motion.hand,
  });
}

/** The dumbbell held by its top plate in both hands, hanging along the forearms. */
const cupped = heldDumbbell(
  (s: Skeleton) =>
    sub(lerp3(s.arms.r.end, s.arms.l.end, 0.5), lerp3(s.arms.r.joint, s.arms.l.joint, 0.5)),
  (s: Skeleton) => {
    const along = normalize(
      sub(lerp3(s.arms.r.end, s.arms.l.end, 0.5), lerp3(s.arms.r.joint, s.arms.l.joint, 0.5)),
    );
    return [along[0] * 8, along[1] * 8, along[2] * 8];
  },
);

function pullover(kind: 'dumbbell' | 'barbell'): SceneSpec {
  const l = lie('flat');
  const z = kind === 'barbell' ? 6 : -14;
  return scene([pose(l, [6, 55, z], [0.3, -1, 0.5]), pose(l, [-52, 14, z], [0.4, -1, 0.5])], {
    view: LYING,
    props: [...l.props, kind === 'barbell' ? barbell({ kind: 'ez' }) : cupped],
    motion: motion.hands,
  });
}

/** Lying triceps extensions: arms up, then bent so the weight comes back beside or behind the head. */
function lyingExtension(
  surface: Surface,
  gear: 'dumbbells' | 'barbell' | 'ez',
  depth: 'forehead' | 'behind',
  angle?: number,
): SceneSpec {
  const l = lie(surface, angle);
  const z = gear === 'dumbbells' ? -3 : -6;
  const top: V3 = surface === 'incline' ? [-6, 57, z] : [3, 58, z];
  const bottom: V3 = depth === 'forehead' ? [-24, 22, z] : [-38, 18, z];
  const props = [
    ...l.props,
    gear === 'dumbbells' ? dumbbells('ud') : barbell({ kind: gear === 'ez' ? 'ez' : 'olympic' }),
  ];
  return scene([pose(l, top, [0.35, 1, 0.1]), pose(l, bottom, [0.35, 1, 0.1])], {
    view: LYING,
    props,
    motion: motion.hand,
  });
}

function floorPress(): SceneSpec {
  const l = lie('floor');
  return scene([pose(l, [12, 13, 8], OUT_DOWN), pose(l, [5, 57, 8], OUT_DOWN)], {
    view: LYING,
    props: [...l.props, barbell()],
    motion: motion.hands,
  });
}

function pushUp(): SceneSpec {
  const ankle = -72;
  const top: PoseSpec = {
    pelvis: [ankle + 82, 42, 0],
    pitch: 68,
    hands: hands({ at: [ankle + 128, 2, 22], pole: [-0.4, 0, 1] }),
    feet: feet({ at: [ankle, 9, 9], toe: [0.25, -1, 0] }),
    headPitch: -8,
  };
  const bottom: PoseSpec = {
    pelvis: [ankle + 85, 22, 0],
    pitch: 80,
    hands: hands({ at: [ankle + 128, 2, 22], pole: [-0.5, 0.6, 1] }),
    feet: feet({ at: [ankle, 9, 9], toe: [0.25, -1, 0] }),
    headPitch: -10,
  };
  return scene([top, bottom], { view: { yaw: -22, tilt: 14 }, motion: motion.hips });
}

export const LYING_ART: Record<string, SceneSpec> = {
  'db-bench-press': press('flat', 'dumbbell'),
  'db-incline-bench-press': press('incline', 'dumbbell'),
  'db-decline-bench-press': press('decline', 'dumbbell'),
  'db-squeeze-press': press('flat', 'squeeze'),
  'db-close-grip-press': press('flat', 'close'),
  'bb-bench-press': press('flat', 'barbell'),
  'bb-incline-bench-press': press('incline', 'barbell'),
  'bb-decline-bench-press': press('decline', 'barbell'),
  'bb-reverse-grip-bench-press': (() => {
    const l = lie('flat');
    return scene([pose(l, [13, 14, 6], TUCKED), pose(l, [4, 57, 6], TUCKED)], {
      view: LYING,
      props: [...l.props, barbell()],
      motion: motion.hands,
    });
  })(),
  'bb-close-grip-bench-press': (() => {
    const l = lie('flat');
    return scene([pose(l, [13, 14, -4], TUCKED), pose(l, [5, 57, -4], TUCKED)], {
      view: LYING,
      props: [...l.props, barbell()],
      motion: motion.hands,
    });
  })(),
  'bb-floor-press': floorPress(),
  'bb-guillotine-press': (() => {
    const l = lie('flat');
    return scene([pose(l, [-6, 16, 14], [0, -0.4, 1]), pose(l, [0, 56, 14], [0, -0.4, 1])], {
      view: LYING,
      props: [...l.props, barbell()],
      motion: motion.hands,
    });
  })(),
  'db-chest-fly': fly('flat'),
  'db-incline-chest-fly': fly('incline'),
  'db-decline-chest-fly': fly('decline'),
  'db-pullover': pullover('dumbbell'),
  'bb-pullover': pullover('barbell'),
  'db-skull-crusher': lyingExtension('flat', 'dumbbells', 'forehead'),
  'bb-skull-crusher': lyingExtension('flat', 'barbell', 'forehead'),
  'bb-ez-skull-crusher': lyingExtension('flat', 'ez', 'forehead'),
  'db-incline-triceps-extension': lyingExtension('incline', 'dumbbells', 'behind'),
  'bb-incline-ez-triceps-extension': lyingExtension('incline', 'ez', 'behind'),
  'db-tate-press': (() => {
    const l = lie('flat');
    return scene([pose(l, [6, 57, -6], [0, 0.3, 1]), pose(l, [12, 22, -12], [0, 0.3, 1])], {
      view: LYING,
      props: [...l.props, dumbbells('lr')],
      motion: motion.hand,
    });
  })(),
  'db-jm-press': (() => {
    const l = lie('flat');
    return scene(
      [pose(l, [4, 57, -6], [0.8, -0.3, 0.2]), pose(l, [-4, 26, -6], [0.8, -0.3, 0.2])],
      {
        view: LYING,
        props: [...l.props, dumbbells('ud')],
        motion: motion.hand,
      },
    );
  })(),
  'bb-jm-press': (() => {
    const l = lie('flat');
    return scene(
      [pose(l, [4, 57, -6], [0.8, -0.3, 0.2]), pose(l, [-4, 26, -6], [0.8, -0.3, 0.2])],
      {
        view: LYING,
        props: [...l.props, barbell()],
        motion: motion.hands,
      },
    );
  })(),
  'db-cross-body-triceps-extension': (() => {
    const l = lie('flat');
    const rest = { at: off(l, [10, 12, -10], 'l'), pole: [0, -1, -0.5] as V3 };
    return scene(
      [
        pose(l, [3, 58, 0], [0.3, 1, 0.1], {}, rest),
        pose(l, [-4, 24, -26], [0.3, 1, 0.3], {}, rest),
      ],
      { view: LYING, props: [...l.props, dumbbells('ud', ['r'])], motion: motion.hand },
    );
  })(),
  'bw-push-up': pushUp(),
};
