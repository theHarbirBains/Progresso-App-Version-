import { add, rad, type V3 } from './geometry';
import {
  solvePose,
  type FootTarget,
  type LimbTarget,
  type PoseSpec,
  type Side,
  type Skeleton,
} from './rig';
import type { FrameSpec, PropBuilder, SceneSpec, ViewSpec } from './render';

// Shorthand for writing the exercise scenes: where the shoulders end up for a given hip position
// and bend, the usual stances, and the camera angles the library uses.

export const STAND: V3 = [0, 94, 0];
/** Pad-top height of a flat bench. */
export const BENCH_TOP = 44;

/** Side-on, turned a little toward the viewer: most standing exercises. */
export const SIDE: Partial<ViewSpec> = { yaw: -30, tilt: 9 };
/** Nearly face-on: raises out to the sides, side bends, wide stances. */
export const FRONT: Partial<ViewSpec> = { yaw: -76, tilt: 7 };
/** Three-quarters from the front. */
export const THREE_QUARTER: Partial<ViewSpec> = { yaw: -48, tilt: 10 };
/** Three-quarters from behind: what the back, glutes and hamstrings do. */
export const BACK_THREE_QUARTER: Partial<ViewSpec> = { yaw: 34, tilt: 12 };
/** From the foot end, three-quarters and from above: someone lying head-left on a bench or the floor. */
export const LYING: Partial<ViewSpec> = { yaw: -50, tilt: 26 };

export const mirror = (p: V3): V3 => [p[0], p[1], -p[2]];

/** Both hands: the right at `r`, the left mirrored across the body (unless given). */
export function hands(r: V3 | LimbTarget, l?: V3 | LimbTarget): Record<Side, LimbTarget> {
  const right = Array.isArray(r) ? { at: r as V3 } : (r as LimbTarget);
  const left = l
    ? Array.isArray(l)
      ? { at: l as V3 }
      : (l as LimbTarget)
    : { at: mirror(right.at), pole: right.pole ? mirror(right.pole) : undefined };
  return { r: right, l: left };
}

/** Both feet, the right at `r` and the left mirrored (unless given). */
export function feet(r: V3 | FootTarget, l?: V3 | FootTarget): Record<Side, FootTarget> {
  const right = Array.isArray(r) ? { at: r as V3 } : (r as FootTarget);
  const left = l
    ? Array.isArray(l)
      ? { at: l as V3 }
      : (l as FootTarget)
    : {
        at: mirror(right.at),
        pole: right.pole ? mirror(right.pole) : undefined,
        toe: right.toe ? mirror(right.toe) : undefined,
      };
  return { r: right, l: left };
}

/** Toes pointing forward and turned out `deg` degrees (the right foot's; mirrored for the left). */
export function toeOut(deg: number): V3 {
  return [Math.cos(rad(deg)), 0, Math.sin(rad(deg))];
}

/** Standing feet `halfWidth` either side of the middle, toes a little out. */
export function stance(halfWidth = 13, x = 0, turnOut = 8): Record<Side, FootTarget> {
  return feet({ at: [x, 8, halfWidth], toe: toeOut(turnOut) });
}

/** Where a shoulder joint is for hips at `pelvis` bent forward `pitch` degrees (as rig.ts works it out). */
export function shoulderAt(pelvis: V3, pitch = 0, side: Side = 'r', shrug = 0): V3 {
  const p = rad(pitch);
  const up: V3 = [Math.sin(p), Math.cos(p), 0];
  const fwd: V3 = [Math.cos(p), -Math.sin(p), 0];
  const center: V3 = [
    pelvis[0] + up[0] * (50 + shrug) - fwd[0] * 1.5,
    pelvis[1] + up[1] * (50 + shrug) - fwd[1] * 1.5,
    0,
  ];
  return [center[0], center[1], pelvis[2] + (side === 'r' ? 18 : -18)];
}

/** A point offset from a shoulder. */
export function fromShoulder(pelvis: V3, pitch: number, offset: V3, side: Side = 'r'): V3 {
  const s = shoulderAt(pelvis, pitch, side);
  return add(s, side === 'r' ? offset : mirror(offset));
}

/** Arms hanging straight down from the shoulders (a little bent), `out` cm wider. */
export function hanging(
  pelvis: V3,
  pitch = 0,
  out = 3,
  forward = 0,
  drop = 57,
): Record<Side, LimbTarget> {
  return {
    r: { at: fromShoulder(pelvis, pitch, [forward, -drop, out], 'r') },
    l: { at: fromShoulder(pelvis, pitch, [forward, -drop, out], 'l') },
  };
}

/** Where a bar rests across the upper back (on the traps; `low` for low-bar, across the rear delts). */
export function backBarPoint(pelvis: V3, pitch = 0, low = false): V3 {
  const p = rad(pitch);
  const up: V3 = [Math.sin(p), Math.cos(p), 0];
  const fwd: V3 = [Math.cos(p), -Math.sin(p), 0];
  const center = shoulderAt(pelvis, pitch);
  const lift = low ? -3 : 4;
  const back = low ? 10.5 : 7;
  return [center[0] + up[0] * lift - fwd[0] * back, center[1] + up[1] * lift - fwd[1] * back, 0];
}

/** Hands gripping a bar across the upper back, `halfGrip` either side of the middle. */
export function barOnBack(
  pelvis: V3,
  pitch = 0,
  halfGrip = 32,
  low = false,
): Record<Side, LimbTarget> {
  const bar = backBarPoint(pelvis, pitch, low);
  return hands({ at: [bar[0], bar[1], halfGrip], pole: [-0.2, -1, 0.5] });
}

/** The solved shoulders (and torso frame) for a hip position and bend, lean or twist -- exact, from the rig. */
export function torsoOf(
  pose: Pick<PoseSpec, 'pelvis' | 'pitch' | 'lean' | 'twist' | 'shrug'>,
): Skeleton {
  const nowhere = { at: pose.pelvis };
  return solvePose({
    ...pose,
    hands: { r: nowhere, l: nowhere },
    feet: { r: nowhere, l: nowhere },
  });
}

export interface SceneParts {
  view?: Partial<ViewSpec>;
  props?: readonly PropBuilder[];
  motion?: (s: Skeleton) => V3;
}

/** A scene of poses sharing the same equipment. */
export function scene(poses: readonly PoseSpec[], parts: SceneParts = {}): SceneSpec {
  return {
    view: parts.view,
    motion: parts.motion,
    frames: poses.map((pose): FrameSpec => ({ pose, props: parts.props })),
  };
}

/** The usual motion cues: a hand (the right, nearest the viewer), both hands' middle, the hips. */
export const motion = {
  hand: (s: Skeleton): V3 => s.arms.r.end,
  leftHand: (s: Skeleton): V3 => s.arms.l.end,
  hands: (s: Skeleton): V3 => [
    (s.arms.r.end[0] + s.arms.l.end[0]) / 2,
    (s.arms.r.end[1] + s.arms.l.end[1]) / 2,
    (s.arms.r.end[2] + s.arms.l.end[2]) / 2,
  ],
  hips: (s: Skeleton): V3 => s.pelvis,
  head: (s: Skeleton): V3 => s.head,
  foot: (s: Skeleton): V3 => s.legs.r.end,
};
