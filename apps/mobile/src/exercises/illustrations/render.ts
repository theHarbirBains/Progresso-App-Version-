import {
  add,
  anyPerpendicular,
  convexHull,
  cross,
  dot,
  lerp3,
  normalize,
  polygonPath,
  rad,
  scale,
  smoothPath,
  sub,
  type P2,
  type V3,
} from './geometry';
import {
  REGION_PATCHES,
  type BodyPartKey,
  type MuscleHighlight,
  type MusclePatch,
} from './muscles';
import { ART, OUTLINE_WIDTH } from './palette';
import { BODY, solvePose, type Limb, type PoseSpec, type Skeleton } from './rig';

// Draws a scene -- one exercise's poses, the equipment, the highlighted muscles -- as flat shapes,
// back to front. Everything is projected straight onto the page (no perspective), from a camera
// turned `yaw` degrees around the figure and tilted `tilt` degrees down.

export interface ViewSpec {
  /** 0 sees the figure side-on facing right; -90 face-on; in between, three-quarters. */
  yaw: number;
  /** How far the camera looks down, degrees. */
  tilt: number;
}

export const DEFAULT_VIEW: ViewSpec = { yaw: -28, tilt: 9 };

export interface Shape {
  d: string;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  /** Clip to one of the frame's clip paths (a body part's outline). */
  clipId?: string;
  dash?: string;
}

export interface ClipDef {
  id: string;
  paths: string[];
}

export interface RenderedFrame {
  shapes: Shape[];
  clips: ClipDef[];
}

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderedScene {
  frames: RenderedFrame[];
  viewBox: ViewBox;
  /** Hands or feet that couldn't reach where the pose put them -- a pose to fix. */
  warnings: string[];
}

export interface Camera {
  toView: (p: V3) => V3;
  toScreen: (p: V3) => P2;
  /** How much a direction faces the camera (1 straight at it, below 0 away). */
  facing: (n: V3) => number;
}

export function makeCamera(view: ViewSpec): Camera {
  const cy = Math.cos(rad(view.yaw));
  const sy = Math.sin(rad(view.yaw));
  const ct = Math.cos(rad(view.tilt));
  const st = Math.sin(rad(view.tilt));
  const toView = (p: V3): V3 => {
    const x1 = p[0] * cy + p[2] * sy;
    const z1 = -p[0] * sy + p[2] * cy;
    return [x1, p[1] * ct - z1 * st, p[1] * st + z1 * ct];
  };
  return {
    toView,
    toScreen: (p) => {
      const q = toView(p);
      return [q[0], -q[1]];
    },
    facing: (n) => toView(n)[2],
  };
}

/** A piece of the picture, drawn in depth order: `layer` 0 (benches, the floor) always first. */
export interface Piece {
  depth: number;
  layer: 0 | 1;
  shapes: Shape[];
  /** Outlines this piece adds as clip paths, for shapes clipped to it. */
  clips?: ClipDef[];
  /** Every projected point, for the picture's bounds. */
  points: P2[];
  /** Where it rests on the floor, for the shadow. */
  floor?: V3[];
  /** For equipment: where it is, so a bar behind the body is drawn behind it. */
  anchor?: V3;
}

export interface PropContext {
  cam: Camera;
  skeleton: Skeleton;
}

export type PropBuilder = (ctx: PropContext) => Piece[];

export interface FrameSpec {
  pose: PoseSpec;
  props?: readonly PropBuilder[];
}

export interface SceneSpec {
  view?: Partial<ViewSpec>;
  frames: readonly FrameSpec[];
  /** A point that moves between frames, drawn as an arrow (the dumbbell, the bar, the hips). */
  motion?: (s: Skeleton) => V3;
}

// ---------------------------------------------------------------------------------------------
// Body shapes

interface ProfileSample {
  t: number;
  r: number;
  /** How far the surface swells toward the limb's front (negative: its back). */
  off: number;
}

const PROFILES: Record<Exclude<BodyPartKey, 'torso'>, readonly ProfileSample[]> = {
  upperArm: [
    { t: -0.07, r: 6.1, off: 0 },
    { t: 0.05, r: 5.8, off: 0 },
    { t: 0.48, r: 5.2, off: 0.5 },
    { t: 1, r: 4.1, off: 0 },
  ],
  forearm: [
    { t: 0, r: 4.5, off: 0 },
    { t: 0.28, r: 4.5, off: 0.4 },
    { t: 0.84, r: 2.9, off: 0 },
  ],
  thigh: [
    { t: 0, r: 8.9, off: 0 },
    { t: 0.38, r: 7.9, off: 0.7 },
    { t: 1, r: 5.5, off: 0 },
  ],
  shin: [
    { t: 0, r: 5.3, off: 0 },
    { t: 0.3, r: 5.6, off: -1.4 },
    { t: 1, r: 3.5, off: 0 },
  ],
};

interface TorsoRing {
  h: number;
  /** Half-width, side to side. */
  w: number;
  /** Half-depth, front to back. */
  d: number;
  off: number;
}

const TORSO_RINGS: readonly TorsoRing[] = [
  { h: -0.2, w: 11, d: 8.2, off: -2.8 },
  { h: -0.06, w: 15, d: 10.6, off: -1.5 },
  { h: 0.13, w: 14.4, d: 9.4, off: 0 },
  { h: 0.4, w: 13.1, d: 8.8, off: 0.6 },
  { h: 0.68, w: 16.4, d: 10.4, off: 1.8 },
  { h: 0.88, w: 18.4, d: 9.8, off: 1.1 },
  { h: 1.03, w: 13.5, d: 7.4, off: -0.6 },
];

/** Where the shorts stop, up the torso. */
const WAISTBAND = 0.13;

function interpolate<T extends Record<keyof T, number>>(
  samples: readonly T[],
  key: keyof T,
  at: number,
): T {
  if (at <= (samples[0][key] as number)) return samples[0];
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1];
    const b = samples[i];
    const ka = a[key] as number;
    const kb = b[key] as number;
    if (at <= kb) {
      const f = (at - ka) / (kb - ka);
      const out = { ...a };
      for (const k of Object.keys(a) as (keyof T)[]) {
        (out[k] as number) = (a[k] as number) + ((b[k] as number) - (a[k] as number)) * f;
      }
      return out;
    }
  }
  return samples[samples.length - 1];
}

interface SurfacePoint {
  p: V3;
  n: V3;
}

type Surface = (t: number, thetaDeg: number) => SurfacePoint;

function limbSurface(limb: Limb, profile: readonly ProfileSample[], length: number): Surface {
  const axis = normalize(sub(limb.joint, limb.root));
  let side = normalize(cross(axis, limb.front));
  // "Outside" is away from the body: the lateral side of a right limb is the figure's right.
  if (dot(side, sideHint(limb)) < 0) side = scale(side, -1);
  return (t, thetaDeg) => {
    const s = interpolate(profile, 't', t);
    const center = add(add(limb.root, scale(axis, t * length)), scale(limb.front, s.off));
    const dir = add(
      scale(limb.front, Math.cos(rad(thetaDeg))),
      scale(side, Math.sin(rad(thetaDeg))),
    );
    return { p: add(center, scale(dir, s.r)), n: dir };
  };
}

// Each limb remembers which way is outside through a hint set as it's built (see bodyPieces).
const lateralHints = new WeakMap<Limb, V3>();
function sideHint(limb: Limb): V3 {
  return lateralHints.get(limb) ?? [0, 0, limb.lateral];
}

/** The lower part of a limb runs from its joint to its end: re-root it there for drawing. */
function lowerLimb(limb: Limb): Limb {
  const lower: Limb = { ...limb, root: limb.joint, joint: limb.end };
  const hint = lateralHints.get(limb);
  if (hint) lateralHints.set(lower, hint);
  return lower;
}

function torsoSurface(s: Skeleton): Surface {
  return (h, thetaDeg) => {
    const ring = interpolate(TORSO_RINGS, 'h', h);
    const frame = s.frameAt(h);
    const lift = h > 0.84 ? s.shrug * Math.min(1, (h - 0.84) / 0.16) * 0.8 : 0;
    const center = add(
      add(s.pelvis, scale(frame.up, h * BODY.torso + lift)),
      scale(frame.forward, ring.off),
    );
    const c = Math.cos(rad(thetaDeg));
    const sn = Math.sin(rad(thetaDeg));
    const p = add(add(center, scale(frame.forward, ring.d * c)), scale(frame.right, ring.w * sn));
    const n = normalize(add(scale(frame.forward, c / ring.d), scale(frame.right, sn / ring.w)));
    return { p, n };
  };
}

function circlePoints(c: P2, r: number, samples = 20): P2[] {
  const out: P2[] = [];
  for (let i = 0; i < samples; i += 1) {
    const a = (i / samples) * Math.PI * 2;
    out.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
  }
  return out;
}

function sphereHull(cam: Camera, spheres: readonly { c: V3; r: number }[]): P2[] {
  const pts: P2[] = [];
  for (const s of spheres) pts.push(...circlePoints(cam.toScreen(s.c), s.r));
  return convexHull(pts);
}

/**
 * The visible part of a stretch of surface as one smooth outline -- a lens that narrows toward its
 * ends, following only the side facing the camera (null when it all faces away).
 */
function patchPolygon(
  cam: Camera,
  surface: Surface,
  t: readonly [number, number],
  theta: readonly [number, number],
): P2[] | null {
  const rows = 12;
  const left: P2[] = [];
  const right: P2[] = [];
  const center = (theta[0] + theta[1]) / 2;
  const halfSpan = (theta[1] - theta[0]) / 2;
  for (let i = 0; i <= rows; i += 1) {
    const s = i / rows;
    const at = t[0] + (t[1] - t[0]) * s;
    const k = 0.3 + 0.7 * Math.sqrt(Math.sin(Math.PI * Math.min(0.97, Math.max(0.03, s))));
    const from = center - halfSpan * k;
    const to = center + halfSpan * k;
    const steps = Math.max(8, Math.ceil((to - from) / 3));
    // The longest run of samples facing the camera.
    let best: [number, number] | null = null;
    let runStart: number | null = null;
    for (let j = 0; j <= steps; j += 1) {
      const a = from + ((to - from) * j) / steps;
      const visible = cam.facing(surface(at, a).n) > 0.02;
      if (visible && runStart === null) runStart = a;
      if ((!visible || j === steps) && runStart !== null) {
        const end = visible ? a : from + ((to - from) * (j - 1)) / steps;
        if (!best || end - runStart > best[1] - best[0]) best = [runStart, end];
        runStart = null;
      }
    }
    if (!best || best[1] - best[0] < 0.5) {
      if (left.length > 0) break;
      continue;
    }
    left.push(cam.toScreen(surface(at, best[0]).p));
    right.push(cam.toScreen(surface(at, best[1]).p));
  }
  if (left.length < 2) return null;
  return left.concat(right.reverse());
}

/**
 * The visible part of a cap of the head's sphere (the hair, an ear): everything facing the camera
 * within `angle` degrees of `axis`.
 */
function capPolygon(cam: Camera, center: V3, r: number, axis: V3, angle: number): P2[] | null {
  const toCamera: V3 = [cam.facing([1, 0, 0]), cam.facing([0, 1, 0]), cam.facing([0, 0, 1])];
  const c0 = Math.cos(rad(angle));
  const pts: V3[] = [];
  const u = anyPerpendicular(axis);
  const w = cross(axis, u);
  const rim = Math.sqrt(1 - c0 * c0);
  for (let i = 0; i < 48; i += 1) {
    const a = (i / 48) * Math.PI * 2;
    const dir = add(scale(axis, c0), add(scale(u, Math.cos(a) * rim), scale(w, Math.sin(a) * rim)));
    if (dot(dir, toCamera) >= 0) pts.push(add(center, scale(dir, r)));
  }
  const s1 = anyPerpendicular(toCamera);
  const s2 = cross(toCamera, s1);
  for (let i = 0; i < 64; i += 1) {
    const a = (i / 64) * Math.PI * 2;
    const dir = add(scale(s1, Math.cos(a)), scale(s2, Math.sin(a)));
    if (dot(dir, axis) >= c0) pts.push(add(center, scale(dir, r)));
  }
  if (pts.length < 3) return null;
  const flat = pts.map(cam.toScreen);
  const cx = flat.reduce((acc, p) => acc + p[0], 0) / flat.length;
  const cy = flat.reduce((acc, p) => acc + p[1], 0) / flat.length;
  return flat.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
}

function outlineShapes(polys: readonly P2[][]): Shape[] {
  return polys.map((poly) => ({
    d: smoothPath(poly),
    fill: ART.outline,
    stroke: ART.outline,
    strokeWidth: OUTLINE_WIDTH * 2,
  }));
}

function fillShapes(polys: readonly P2[][], color: string): Shape[] {
  return polys.map((poly) => ({ d: smoothPath(poly), fill: color }));
}

const MUSCLE_COLORS = { primary: ART.primary, secondary: ART.secondary } as const;

function musclesFor(
  part: BodyPartKey,
  muscles: MuscleHighlight,
): { patch: MusclePatch; tone: keyof typeof MUSCLE_COLORS }[] {
  const out: { patch: MusclePatch; tone: keyof typeof MUSCLE_COLORS }[] = [];
  for (const tone of ['secondary', 'primary'] as const) {
    for (const region of muscles[tone]) {
      for (const patch of REGION_PATCHES[region]) {
        if (patch.part === part) out.push({ patch, tone });
      }
    }
  }
  return out;
}

function muscleShapes(
  cam: Camera,
  part: BodyPartKey,
  surface: Surface,
  clipId: string,
  muscles: MuscleHighlight,
): Shape[] {
  const shapes: Shape[] = [];
  for (const { patch, tone } of musclesFor(part, muscles)) {
    const poly = patchPolygon(cam, surface, patch.t, patch.theta);
    if (poly) {
      shapes.push({
        d: smoothPath(poly),
        fill: MUSCLE_COLORS[tone],
        opacity: tone === 'primary' ? 0.92 : 0.86,
        clipId,
      });
    }
  }
  return shapes;
}

let clipCounter = 0;

function limbPiece(
  cam: Camera,
  limb: Limb,
  part: Exclude<BodyPartKey, 'torso'>,
  length: number,
  far: boolean,
  muscles: MuscleHighlight,
  extra?: { overlay?: { from: number; to: number; grow: number; color: string } },
): Piece {
  const profile = PROFILES[part];
  const axis = normalize(sub(limb.joint, limb.root));
  const spheres = profile.map((s) => ({
    c: add(add(limb.root, scale(axis, s.t * length)), scale(limb.front, s.off)),
    r: s.r,
  }));
  const hull = sphereHull(cam, spheres);
  const polys = [hull];
  const shapesFill: Shape[] = fillShapes([hull], far ? ART.skinFar : ART.skin);
  const outlinePolys = [hull];
  if (extra?.overlay) {
    const { from, to, grow, color } = extra.overlay;
    const samples = [
      ...profile.filter((p) => p.t >= from && p.t < to),
      interpolate(profile, 't', to),
    ];
    const sleeve = sphereHull(
      cam,
      samples.map((p) => ({
        c: add(add(limb.root, scale(axis, p.t * length)), scale(limb.front, p.off)),
        r: p.r + grow,
      })),
    );
    shapesFill.push(...fillShapes([sleeve], color));
    outlinePolys.push(sleeve);
    polys.push(sleeve);
  }
  const clipId = `c${(clipCounter += 1)}`;
  const surface = limbSurface(limb, profile, length);
  const z = (cam.toView(limb.root)[2] + cam.toView(limb.joint)[2]) / 2;
  return {
    depth: z,
    layer: 1,
    shapes: [
      ...outlineShapes(outlinePolys),
      ...shapesFill,
      ...muscleShapes(cam, part, surface, clipId, muscles),
    ],
    clips: [{ id: clipId, paths: polys.map((p) => smoothPath(p)) }],
    points: outlinePolys.flat(),
  };
}

function bodyPieces(cam: Camera, s: Skeleton, muscles: MuscleHighlight): Piece[] {
  const pieces: Piece[] = [];
  const midArms = cam.toView(s.shoulderCenter)[2];
  const midLegs = cam.toView(s.pelvis)[2];
  const isFar = (root: V3, mid: number) => cam.toView(root)[2] < mid - 3;

  // Torso: rings up the body, each neighbouring pair's hull together making its outline.
  const surface = torsoSurface(s);
  const rings = TORSO_RINGS.map((r) =>
    Array.from({ length: 24 }, (_, i) => cam.toScreen(surface(r.h, (i / 24) * 360).p)),
  );
  const pairHulls = (from: number, to: number) => {
    const out: P2[][] = [];
    for (let i = from; i < to; i += 1) out.push(convexHull([...rings[i], ...rings[i + 1]]));
    return out;
  };
  const allTorso = pairHulls(0, rings.length - 1);
  const waistIndex = TORSO_RINGS.findIndex((r) => r.h >= WAISTBAND);
  const shortsTorso = pairHulls(0, waistIndex);
  const torsoClip = `c${(clipCounter += 1)}`;
  // A little behind its middle, so arms and legs at the body's own depth draw over it.
  const torsoDepth = cam.toView(lerp3(s.pelvis, s.shoulderCenter, 0.5))[2];
  pieces.push({
    depth: torsoDepth - 4,
    layer: 1,
    shapes: [
      ...outlineShapes(allTorso),
      ...fillShapes(allTorso, ART.skin),
      ...fillShapes(shortsTorso, ART.shorts),
      ...muscleShapes(cam, 'torso', surface, torsoClip, muscles),
    ],
    clips: [{ id: torsoClip, paths: allTorso.map((p) => smoothPath(p)) }],
    points: allTorso.flat(),
  });

  // Arms and legs: upper and lower parts drawn separately, so a bent limb overlaps itself right.
  for (const side of ['r', 'l'] as const) {
    const arm = s.arms[side];
    lateralHints.set(arm, sub(s.shoulders[side], s.shoulderCenter));
    const farArm = isFar(arm.root, midArms);
    pieces.push(limbPiece(cam, arm, 'upperArm', BODY.upperArm, farArm, muscles));
    const fore = lowerLimb(arm);
    pieces.push(limbPiece(cam, fore, 'forearm', BODY.forearm, farArm, muscles));
    // The fist, around the handle.
    const fist = cam.toScreen(arm.end);
    const fistHull = circlePoints(fist, 4.6, 18);
    pieces.push({
      depth: cam.toView(arm.end)[2] + 0.8,
      layer: 1,
      shapes: [
        ...outlineShapes([fistHull]),
        ...fillShapes([fistHull], farArm ? ART.skinFar : ART.skin),
      ],
      points: fistHull,
    });

    const leg = s.legs[side];
    lateralHints.set(leg, sub(s.hips[side], s.pelvis));
    const farLeg = isFar(leg.root, midLegs);
    pieces.push(
      limbPiece(cam, leg, 'thigh', BODY.thigh, farLeg, muscles, {
        overlay: { from: 0, to: 0.42, grow: 0.7, color: farLeg ? ART.shortsFar : ART.shorts },
      }),
    );
    pieces.push(limbPiece(cam, lowerLimb(leg), 'shin', BODY.shin, farLeg, muscles));
    const foot = s.feet[side];
    const shoe = sphereHull(cam, [
      { c: foot.heel, r: 3.7 },
      { c: leg.end, r: 4.5 },
      { c: lerp3(foot.heel, foot.toe, 0.66), r: 4.1 },
      { c: foot.toe, r: 3.1 },
    ]);
    pieces.push({
      depth: (cam.toView(leg.end)[2] + cam.toView(foot.toe)[2]) / 2 + 0.5,
      layer: 1,
      shapes: [...outlineShapes([shoe]), ...fillShapes([shoe], farLeg ? ART.shoeFar : ART.shoe)],
      points: shoe,
      floor: [foot.heel, foot.toe],
    });
  }

  // Neck and head.
  const neckTop = add(s.neckBase, scale(s.headFrame.up, BODY.neck));
  const neck = sphereHull(cam, [
    { c: s.neckBase, r: 5.6 },
    { c: neckTop, r: 4.9 },
  ]);
  pieces.push({
    depth: cam.toView(s.neckBase)[2] - 3,
    layer: 1,
    shapes: [...outlineShapes([neck]), ...fillShapes([neck], ART.skin)],
    points: neck,
  });
  const headCenter = cam.toScreen(s.head);
  const headPoly = circlePoints(headCenter, BODY.headRadius, 28);
  const { up, forward, right } = s.headFrame;
  const hair = capPolygon(
    cam,
    s.head,
    BODY.headRadius,
    normalize(add(scale(up, 0.86), scale(forward, -0.52))),
    80,
  );
  const ears = [1, -1]
    .map((side) =>
      capPolygon(
        cam,
        s.head,
        BODY.headRadius,
        normalize(add(add(scale(right, side), scale(forward, -0.22)), scale(up, -0.08))),
        15,
      ),
    )
    .filter((ear): ear is P2[] => ear !== null);
  const headClip = `c${(clipCounter += 1)}`;
  pieces.push({
    depth: cam.toView(s.head)[2] - 1,
    layer: 1,
    shapes: [
      ...outlineShapes([headPoly]),
      ...fillShapes([headPoly], ART.skin),
      ...ears.map((ear) => ({ d: smoothPath(ear), fill: ART.skinShade, clipId: headClip })),
      ...(hair ? [{ d: smoothPath(hair), fill: ART.hair, clipId: headClip }] : []),
    ],
    clips: [{ id: headClip, paths: [smoothPath(headPoly)] }],
    points: headPoly,
  });
  return pieces;
}

// ---------------------------------------------------------------------------------------------
// Scene

function shadowPiece(cam: Camera, floor: V3[]): Piece | null {
  if (floor.length === 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of floor) {
    minX = Math.min(minX, p[0]);
    maxX = Math.max(maxX, p[0]);
    minZ = Math.min(minZ, p[2]);
    maxZ = Math.max(maxZ, p[2]);
  }
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const rx = (maxX - minX) / 2 + 14;
  const rz = (maxZ - minZ) / 2 + 12;
  const pts: P2[] = [];
  for (let i = 0; i < 32; i += 1) {
    const a = (i / 32) * Math.PI * 2;
    pts.push(cam.toScreen([cx + Math.cos(a) * rx, 0, cz + Math.sin(a) * rz]));
  }
  return {
    depth: -Infinity,
    layer: 0,
    shapes: [{ d: smoothPath(pts), fill: ART.shadow }],
    points: [],
  };
}

function motionShapes(from: P2, to: P2, away: P2): Shape[] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dist = Math.hypot(dx, dy);
  if (dist < 14) return [];
  // Keep the arrow clear of the hand at each end, and bowed away from the body.
  const ux = dx / dist;
  const uy = dy / dist;
  const a: P2 = [from[0] + ux * 7, from[1] + uy * 7];
  const b: P2 = [to[0] - ux * 7, to[1] - uy * 7];
  let nx = -uy;
  let ny = ux;
  const mid: P2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if ((mid[0] - away[0]) * nx + (mid[1] - away[1]) * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  const bow = Math.min(18, dist * 0.22);
  const c: P2 = [mid[0] + nx * bow + nx * 6, mid[1] + ny * bow + ny * 6];
  const a2: P2 = [a[0] + nx * 6, a[1] + ny * 6];
  const b2: P2 = [b[0] + nx * 6, b[1] + ny * 6];
  const tx = b2[0] - c[0];
  const ty = b2[1] - c[1];
  const tl = Math.hypot(tx, ty) || 1;
  const hx = tx / tl;
  const hy = ty / tl;
  const head: P2[] = [
    [b2[0] + hx * 2, b2[1] + hy * 2],
    [b2[0] - hx * 5 - hy * 3.6, b2[1] - hy * 5 + hx * 3.6],
    [b2[0] - hx * 5 + hy * 3.6, b2[1] - hy * 5 - hx * 3.6],
  ];
  const f = (n: number) => Math.round(n * 10) / 10;
  return [
    {
      d: `M${f(a2[0])} ${f(a2[1])}Q${f(c[0])} ${f(c[1])} ${f(b2[0])} ${f(b2[1])}`,
      fill: 'none',
      stroke: ART.motion,
      strokeWidth: 1.4,
      dash: '3.5 3',
    },
    { d: polygonPath(head), fill: ART.motion },
  ];
}

/** Draws every frame of a scene at one scale, inside one shared view box. */
export function renderScene(scene: SceneSpec, muscles: MuscleHighlight): RenderedScene {
  const view = { ...DEFAULT_VIEW, ...scene.view };
  const cam = makeCamera(view);
  const warnings: string[] = [];
  const skeletons = scene.frames.map((frame) => solvePose(frame.pose));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const frames = scene.frames.map((frame, index): RenderedFrame => {
    const skeleton = skeletons[index];
    for (const side of ['r', 'l'] as const) {
      if (skeleton.arms[side].shortfall > 1.5) {
        warnings.push(
          `frame ${index + 1}: ${side} hand ${skeleton.arms[side].shortfall.toFixed(1)}cm short`,
        );
      }
      if (skeleton.legs[side].shortfall > 1.5) {
        warnings.push(
          `frame ${index + 1}: ${side} foot ${skeleton.legs[side].shortfall.toFixed(1)}cm short`,
        );
      }
    }
    const pieces = [
      ...bodyPieces(cam, skeleton, muscles),
      ...(frame.props ?? []).flatMap((build) => build({ cam, skeleton })),
    ];
    // Equipment behind the body's middle and within its width (a bar across the upper back) goes
    // behind the torso and head, however near its own middle is.
    const chest = lerp3(skeleton.pelvis, skeleton.shoulderCenter, 0.65);
    const chestFrame = skeleton.frameAt(0.65);
    const torsoDepth = cam.toView(lerp3(skeleton.pelvis, skeleton.shoulderCenter, 0.5))[2] - 4;
    for (const piece of pieces) {
      if (!piece.anchor) continue;
      const rel = sub(piece.anchor, chest);
      if (
        dot(rel, chestFrame.forward) < -3 &&
        Math.abs(dot(rel, chestFrame.right)) < BODY.shoulderHalfWidth + 8
      ) {
        piece.depth = Math.min(piece.depth, torsoDepth - 2);
      }
    }
    const floor = pieces.flatMap((p) => p.floor ?? []).filter((p) => p[1] < 7);
    const shadow = shadowPiece(cam, floor);
    const ordered = [...(shadow ? [shadow] : []), ...pieces].sort(
      (a, b) => a.layer - b.layer || a.depth - b.depth,
    );
    const shapes: Shape[] = [];
    const clips: ClipDef[] = [];
    for (const piece of ordered) {
      shapes.push(...piece.shapes);
      if (piece.clips) clips.push(...piece.clips);
      for (const p of piece.points) {
        minX = Math.min(minX, p[0]);
        minY = Math.min(minY, p[1]);
        maxX = Math.max(maxX, p[0]);
        maxY = Math.max(maxY, p[1]);
      }
    }
    if (scene.motion && index > 0) {
      const from = cam.toScreen(scene.motion(skeletons[index - 1]));
      const to = cam.toScreen(scene.motion(skeleton));
      shapes.push(...motionShapes(from, to, cam.toScreen(skeleton.pelvis)));
    }
    return { shapes, clips };
  });

  const pad = 7;
  return {
    frames,
    viewBox: {
      x: minX - pad,
      y: minY - pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
    },
    warnings,
  };
}
