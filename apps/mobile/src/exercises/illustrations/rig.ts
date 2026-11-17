import {
  add,
  anyPerpendicular,
  cross,
  dot,
  length,
  normalize,
  perpendicularPart,
  rotateAbout,
  scale,
  sub,
  type V3,
} from './geometry';

// The illustrated instructor's skeleton. A pose says where the hips are, how the torso bends, and
// where each hand and ankle should be; the elbows and knees are solved to reach them (two-bone
// inverse kinematics), bending toward a "pole" direction. Units are centimetres in the figure's
// own space -- x forward, y up, z to the figure's right -- with the floor at y = 0.

export const BODY = {
  ankleHeight: 8,
  shin: 43,
  thigh: 44,
  /** Hip-joint centre to the point between the shoulder joints. */
  torso: 50,
  neck: 9,
  headRadius: 10.5,
  hipHalfWidth: 8.5,
  shoulderHalfWidth: 18,
  upperArm: 30,
  /** Elbow to the middle of the fist, where a handle sits. */
  forearm: 30,
  footForward: 18,
  footBack: 6,
} as const;

/** Standing hip height. */
export const HIP_HEIGHT = BODY.ankleHeight + BODY.shin + BODY.thigh;

export type Side = 'r' | 'l';

export interface LimbTarget {
  /** Where the hand's grip, or the ankle, should be. */
  at: V3;
  /** Which way the elbow or knee points as it bends. */
  pole?: V3;
}

export interface FootTarget extends LimbTarget {
  /** The direction the foot points, heel to toe (default forward and flat, toes a little out). */
  toe?: V3;
}

export interface PoseSpec {
  /** The point between the hip joints. */
  pelvis: V3;
  /** Forward bend of the torso, degrees: 0 upright, 90 face-down level, -90 lying on the back. */
  pitch?: number;
  /** Side bend toward the figure's right, degrees. */
  lean?: number;
  /** Turn of the chest toward the figure's right, degrees (the hips stay square). */
  twist?: number;
  /** Chin down (positive) or up (negative), degrees, relative to the torso. */
  headPitch?: number;
  /** How far the shoulders are lifted toward the ears, cm (a shrug). */
  shrug?: number;
  hands: Record<Side, LimbTarget>;
  feet: Record<Side, FootTarget>;
}

export interface TorsoFrame {
  up: V3;
  forward: V3;
  right: V3;
}

export interface Limb {
  root: V3;
  joint: V3;
  end: V3;
  /** The limb's front: the side away from the elbow's bend for an arm, the knee's side for a leg. */
  front: V3;
  /** +1 for the right limb, -1 for the left: which way is the outside of the body. */
  lateral: number;
  /** How far short of its target the limb fell, cm (0 when it reached). */
  shortfall: number;
}

export interface Skeleton {
  pelvis: V3;
  hips: Record<Side, V3>;
  shoulderCenter: V3;
  shoulders: Record<Side, V3>;
  /** The torso's frame at a height between the hips (0) and the shoulders (1) -- twist builds up the spine. */
  frameAt: (h: number) => TorsoFrame;
  pelvisFrame: TorsoFrame;
  arms: Record<Side, Limb>;
  legs: Record<Side, Limb>;
  feet: Record<Side, { heel: V3; toe: V3; direction: V3 }>;
  neckBase: V3;
  head: V3;
  headFrame: TorsoFrame;
  /** The pose's shrug, cm -- the top of the torso rises with it. */
  shrug: number;
}

const X: V3 = [1, 0, 0];
const Y: V3 = [0, 1, 0];
const Z: V3 = [0, 0, 1];

function baseFrame(pitch: number, lean: number): TorsoFrame {
  // Pitch turns the torso about the figure's right-hand axis: forward bend brings "up" toward "forward".
  let up = rotateAbout(Y, Z, -pitch);
  const forward = rotateAbout(X, Z, -pitch);
  let right: V3 = Z;
  if (lean) {
    up = rotateAbout(up, forward, lean);
    right = rotateAbout(right, forward, lean);
  }
  return { up, forward, right };
}

function twisted(frame: TorsoFrame, deg: number): TorsoFrame {
  if (!deg) return frame;
  return {
    up: frame.up,
    forward: rotateAbout(frame.forward, frame.up, -deg),
    right: rotateAbout(frame.right, frame.up, -deg),
  };
}

/** Two-bone IK: the middle joint and the reached end, bending toward `pole`. */
function solveLimb(
  root: V3,
  target: V3,
  a: number,
  b: number,
  pole: V3,
  lateral: number,
  frontFromPole: number,
): Limb {
  const toTarget = sub(target, root);
  const want = length(toTarget);
  const reach = Math.min(Math.max(want, Math.abs(a - b) + 0.5), a + b - 0.05);
  const dir = want < 1e-6 ? ([0, -1, 0] as V3) : normalize(toTarget);
  const end = add(root, scale(dir, reach));
  const cosA = Math.min(1, Math.max(-1, (a * a + reach * reach - b * b) / (2 * a * reach)));
  const sinA = Math.sqrt(1 - cosA * cosA);
  let bend = perpendicularPart(pole, dir);
  if (length(bend) < 1e-6) bend = anyPerpendicular(dir);
  bend = normalize(bend);
  const joint = add(add(root, scale(dir, a * cosA)), scale(bend, a * sinA));
  // An arm's front faces away from where its elbow points; a leg's front is the knee's side.
  const front = normalize(
    perpendicularPart(scale(bend, frontFromPole), normalize(sub(joint, root))),
  );
  return { root, joint, end, front, lateral, shortfall: Math.max(0, want - reach) };
}

const DEFAULT_TOE_OUT = 8;

/** Solves a pose into joint positions. */
export function solvePose(pose: PoseSpec): Skeleton {
  const pitch = pose.pitch ?? 0;
  const lean = pose.lean ?? 0;
  const twist = pose.twist ?? 0;
  const pelvisFrame = baseFrame(pitch, lean);
  const chestFrame = twisted(pelvisFrame, twist);
  const frameAt = (h: number): TorsoFrame =>
    twisted(pelvisFrame, twist * Math.min(1, Math.max(0, h)));

  const pelvis = pose.pelvis;
  const hips = {
    r: add(pelvis, scale(pelvisFrame.right, BODY.hipHalfWidth)),
    l: add(pelvis, scale(pelvisFrame.right, -BODY.hipHalfWidth)),
  };
  const shrug = pose.shrug ?? 0;
  const shoulderCenter = add(pelvis, scale(pelvisFrame.up, BODY.torso));
  const shoulderLine = add(
    add(shoulderCenter, scale(chestFrame.up, shrug)),
    scale(chestFrame.forward, -1.5),
  );
  const shoulders = {
    r: add(shoulderLine, scale(chestFrame.right, BODY.shoulderHalfWidth)),
    l: add(shoulderLine, scale(chestFrame.right, -BODY.shoulderHalfWidth)),
  };

  const armPole = (side: Side): V3 => {
    const s = side === 'r' ? 1 : -1;
    // By default elbows point back, down and a little out.
    return normalize(
      add(
        add(scale(chestFrame.forward, -1), scale(chestFrame.up, -0.4)),
        scale(chestFrame.right, 0.35 * s),
      ),
    );
  };
  const legPole = (side: Side): V3 => {
    const s = side === 'r' ? 1 : -1;
    return normalize(add(pelvisFrame.forward, scale(pelvisFrame.right, 0.12 * s)));
  };

  const arms = {
    r: solveLimb(
      shoulders.r,
      pose.hands.r.at,
      BODY.upperArm,
      BODY.forearm,
      pose.hands.r.pole ?? armPole('r'),
      1,
      -1,
    ),
    l: solveLimb(
      shoulders.l,
      pose.hands.l.at,
      BODY.upperArm,
      BODY.forearm,
      pose.hands.l.pole ?? armPole('l'),
      -1,
      -1,
    ),
  };
  const legs = {
    r: solveLimb(
      hips.r,
      pose.feet.r.at,
      BODY.thigh,
      BODY.shin,
      pose.feet.r.pole ?? legPole('r'),
      1,
      1,
    ),
    l: solveLimb(
      hips.l,
      pose.feet.l.at,
      BODY.thigh,
      BODY.shin,
      pose.feet.l.pole ?? legPole('l'),
      -1,
      1,
    ),
  };

  const footFor = (side: Side) => {
    const s = side === 'r' ? 1 : -1;
    const direction = normalize(pose.feet[side].toe ?? rotateAbout(X, Y, -DEFAULT_TOE_OUT * s));
    const ankle = legs[side].end;
    // The sole sits below the ankle: the heel behind and a little down, the toe ahead.
    const down = normalize(perpendicularPart(scale(Y, -1), direction));
    const soleDrop = scale(length(down) > 0.1 ? down : scale(Y, -1), BODY.ankleHeight * 0.55);
    return {
      direction,
      heel: add(add(ankle, scale(direction, -BODY.footBack)), soleDrop),
      toe: add(add(ankle, scale(direction, BODY.footForward)), scale(soleDrop, 0.85)),
    };
  };

  const neckBase = add(shoulderCenter, scale(chestFrame.up, 1 + shrug * 0.3));
  const headPitch = pose.headPitch ?? 0;
  const headUp = rotateAbout(chestFrame.up, chestFrame.right, -headPitch);
  const headForward = normalize(cross(headUp, chestFrame.right));
  const head = add(neckBase, scale(headUp, BODY.neck + BODY.headRadius * 0.55));

  return {
    pelvis,
    hips,
    shoulderCenter,
    shoulders,
    frameAt,
    pelvisFrame,
    arms,
    legs,
    feet: { r: footFor('r'), l: footFor('l') },
    neckBase,
    head,
    headFrame: {
      up: headUp,
      forward: dot(headForward, chestFrame.forward) < 0 ? scale(headForward, -1) : headForward,
      right: chestFrame.right,
    },
    shrug,
  };
}
