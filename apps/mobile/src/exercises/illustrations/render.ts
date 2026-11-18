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
import { ART, MATERIALS, OUTLINE_WIDTH, type Material } from './palette';
import { BODY, solvePose, type Limb, type PoseSpec, type Skeleton } from './rig';
import {
  cylinderGradient,
  materialOf,
  midTone,
  sphereGradient,
  verticalGradient,
  type Gradient,
} from './shading';

// Draws a scene -- one exercise's poses and its equipment -- as softly shaded shapes, back to
// front. Everything is projected straight onto the page (no perspective), from a camera turned
// `yaw` degrees around the figure and tilted `tilt` degrees down. The instructor is drawn dressed;
// the same body drawn bare and grey, with the worked muscles coloured on it, is the anatomy figure
// beside the drawing (muscleMap.ts).

export interface ViewSpec {
  /** 0 sees the figure side-on facing right; -90 face-on; in between, three-quarters. */
  yaw: number;
  /** How far the camera looks down, degrees. */
  tilt: number;
}

export const DEFAULT_VIEW: ViewSpec = { yaw: -28, tilt: 9 };

export interface Shape {
  d: string;
  /** The flat colour; with a `gradient`, what's shown where gradients can't be. */
  fill: string;
  /** Soft shading across the shape (shading.ts). */
  gradient?: Gradient;
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
  /** Where the scene's moving point (`motion`) is in each frame, on screen; none without one. */
  motionPoints?: P2[];
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
  /** A point that moves between frames, drawn as an arrow when asked (the dumbbell, the bar, the hips). */
  motion?: (s: Skeleton) => V3;
}

export interface RenderOptions {
  /**
   * The bare grey anatomy figure with its worked muscles coloured, instead of the dressed
   * instructor (no clothes, hair or shoes).
   */
  anatomy?: boolean;
  /** Draw an arrow for the scene's `motion` between frames. */
  arrows?: boolean;
  /**
   * Flat colours with no rims or floor shadow -- for a list row's small picture, where the shading
   * can't be seen and the fewer, simpler shapes draw much faster.
   */
  flat?: boolean;
}

// ---------------------------------------------------------------------------------------------
// Body shapes

interface ProfileSample {
  t: number;
  r: number;
  /** How far the surface swells toward the limb's front (negative: its back). */
  off: number;
}

// Each limb's cross-sections from its root joint to its end: how thick it is and how far its
// surface swells toward its front (negative: its back) -- the deltoid's cap, the biceps' peak, the
// forearm's belly, the quads' sweep and the calf -- narrowing at every joint.
const PROFILES: Record<Exclude<BodyPartKey, 'torso'>, readonly ProfileSample[]> = {
  upperArm: [
    { t: -0.08, r: 6.4, off: 0.2 },
    { t: 0.06, r: 7.0, off: 0.5 },
    { t: 0.24, r: 6.1, off: 0.2 },
    { t: 0.52, r: 5.9, off: 0.9 },
    { t: 0.78, r: 5.0, off: 0.4 },
    { t: 1, r: 4.2, off: 0 },
  ],
  forearm: [
    { t: 0, r: 4.4, off: 0 },
    { t: 0.16, r: 5.2, off: 0.4 },
    { t: 0.42, r: 4.5, off: 0.2 },
    { t: 0.84, r: 3.0, off: 0 },
  ],
  thigh: [
    { t: 0, r: 9.4, off: 0 },
    { t: 0.2, r: 9.4, off: 0.6 },
    { t: 0.5, r: 8.4, off: 1.1 },
    { t: 0.8, r: 6.7, off: 0.6 },
    { t: 1, r: 5.5, off: 0 },
  ],
  shin: [
    { t: 0, r: 5.3, off: 0.3 },
    { t: 0.14, r: 5.9, off: -0.8 },
    { t: 0.32, r: 6.3, off: -1.8 },
    { t: 0.6, r: 4.6, off: -0.6 },
    { t: 1, r: 3.4, off: 0 },
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

// The torso's cross-sections from the seat (below the hip joints) to the top of the traps.
const TORSO_RINGS: readonly TorsoRing[] = [
  { h: -0.2, w: 11.2, d: 8.6, off: -3.0 },
  { h: -0.08, w: 15.2, d: 10.8, off: -1.8 },
  { h: 0.06, w: 14.8, d: 9.8, off: -0.4 },
  { h: 0.2, w: 13.6, d: 9.0, off: 0.2 },
  { h: 0.36, w: 13.4, d: 8.9, off: 0.6 },
  { h: 0.52, w: 15.2, d: 9.8, off: 1.4 },
  { h: 0.68, w: 17.4, d: 10.9, off: 2.1 },
  { h: 0.84, w: 19.4, d: 10.4, off: 1.6 },
  { h: 0.95, w: 17.6, d: 9.0, off: 0.2 },
  { h: 1.05, w: 11.5, d: 7.2, off: -1.0 },
];

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
    const k = 0.42 + 0.58 * Math.sqrt(Math.sin(Math.PI * Math.min(0.97, Math.max(0.03, s))));
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

/** A thin dark rim under a part's fills, so parts of the same colour read apart where they overlap. */
function outlineShapes(polys: readonly P2[][]): Shape[] {
  return polys.map((poly) => ({
    d: smoothPath(poly),
    fill: ART.rim,
    stroke: ART.rim,
    strokeWidth: OUTLINE_WIDTH * 2,
  }));
}

/** Fills shaded along an axis on the page (a limb's, the torso's), or as a ball. */
function shadedShapes(polys: readonly P2[][], material: Material, axis: [P2, P2] | null): Shape[] {
  const all = polys.flat();
  const c = centroid(all);
  return polys.map((poly) => ({
    d: smoothPath(poly),
    fill: midTone(material),
    gradient: axis
      ? cylinderGradient(all, axis[0], axis[1], material)
      : sphereGradient(c, radiusAbout(all, c), material),
  }));
}

function centroid(points: readonly P2[]): P2 {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p[0];
    y += p[1];
  }
  return [x / Math.max(1, points.length), y / Math.max(1, points.length)];
}

function radiusAbout(points: readonly P2[], c: P2): number {
  let r = 1;
  for (const p of points) r = Math.max(r, Math.hypot(p[0] - c[0], p[1] - c[1]));
  return r;
}

/** What a body is drawn in: the dressed instructor, or the grey anatomy figure. */
interface Look {
  skin: Material;
  skinFar: Material;
  /** The tee and shorts; null for the anatomy figure. */
  cloth: Material | null;
  clothFar: Material | null;
  shoe: Material | null;
  shoeFar: Material | null;
  hair: Material | null;
  muscles: boolean;
}

const DRESSED: Look = {
  skin: MATERIALS.skin,
  skinFar: MATERIALS.skinFar,
  cloth: MATERIALS.shirt,
  clothFar: MATERIALS.shirtFar,
  shoe: MATERIALS.shoe,
  shoeFar: MATERIALS.shoeFar,
  hair: MATERIALS.hair,
  muscles: false,
};

const ANATOMY: Look = {
  skin: MATERIALS.anatomy,
  skinFar: MATERIALS.anatomyFar,
  cloth: null,
  clothFar: null,
  shoe: null,
  shoeFar: null,
  hair: null,
  muscles: true,
};

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
  shade: { points: readonly P2[]; axis: [P2, P2] },
): Shape[] {
  const shapes: Shape[] = [];
  for (const { patch, tone } of musclesFor(part, muscles)) {
    const poly = patchPolygon(cam, surface, patch.t, patch.theta);
    if (poly) {
      // Shaded like the part it's on, in its own colour.
      shapes.push({
        d: smoothPath(poly),
        fill: MUSCLE_COLORS[tone],
        gradient: cylinderGradient(
          shade.points,
          shade.axis[0],
          shade.axis[1],
          materialOf(MUSCLE_COLORS[tone]),
        ),
        stroke: ART.muscleEdge,
        strokeWidth: 0.35,
        clipId,
      });
    }
  }
  return shapes;
}

let clipCounter = 0;

/** Points along an arc of a circle on the page, its two ends left out. */
function arc(c: P2, r: number, from: number, to: number, steps = 7): P2[] {
  const out: P2[] = [];
  for (let i = 1; i < steps; i += 1) {
    const a = from + ((to - from) * i) / steps;
    out.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
  }
  return out;
}

/**
 * Something long and round's outline on the page: its cross-sections swept along it, so it can
 * curve in and out with its muscles and narrow at its joints, rounded off at both ends. Seen nearly
 * end-on, it's the outline of its cross-sections instead.
 */
function sweepOutline(cam: Camera, spheres: readonly { c: V3; r: number }[]): P2[] {
  const centers = spheres.map((s) => cam.toScreen(s.c));
  const first = centers[0];
  const last = centers[centers.length - 1];
  const len = Math.hypot(last[0] - first[0], last[1] - first[1]);
  const widest = Math.max(...spheres.map((s) => s.r));
  if (len < widest * 0.8) return sphereHull(cam, spheres);
  const ux = (last[0] - first[0]) / len;
  const uy = (last[1] - first[1]) / len;
  // Across it: +90 degrees from along it.
  const px = -uy;
  const py = ux;
  const left = centers.map((c, i): P2 => [c[0] + px * spheres[i].r, c[1] + py * spheres[i].r]);
  const right = centers.map((c, i): P2 => [c[0] - px * spheres[i].r, c[1] - py * spheres[i].r]);
  const across = Math.atan2(py, px);
  const rLast = spheres[spheres.length - 1].r;
  return [
    ...left,
    // Round the far end, through the direction it points...
    ...arc(last, rLast, across, across - Math.PI),
    ...right.reverse(),
    // ...and the near end, through the other way.
    ...arc(first, spheres[0].r, across - Math.PI, across - 2 * Math.PI),
  ];
}

/** One part of a limb, drawn: its rim, its shaded fill, its muscles (on the anatomy figure). */
interface PartDrawing {
  depth: number;
  rims: Shape[];
  fills: Shape[];
  muscles: Shape[];
  clips: ClipDef[];
  points: P2[];
}

function limbDrawing(
  cam: Camera,
  limb: Limb,
  part: Exclude<BodyPartKey, 'torso'>,
  length: number,
  material: Material,
  muscles: MuscleHighlight | null,
  overlay?: { from: number; to: number; grow: number; material: Material },
): PartDrawing {
  const profile = PROFILES[part];
  const axis = normalize(sub(limb.joint, limb.root));
  const at = (p: ProfileSample) =>
    add(add(limb.root, scale(axis, p.t * length)), scale(limb.front, p.off));
  const outline = sweepOutline(
    cam,
    profile.map((p) => ({ c: at(p), r: p.r })),
  );
  const axis2: [P2, P2] = [cam.toScreen(limb.root), cam.toScreen(limb.joint)];
  const fills: Shape[] = shadedShapes([outline], material, axis2);
  const polys = [outline];
  if (overlay) {
    const samples = [
      ...profile.filter((p) => p.t >= overlay.from && p.t < overlay.to),
      interpolate(profile, 't', overlay.to),
    ];
    const sleeve = sweepOutline(
      cam,
      samples.map((p) => ({ c: at(p), r: p.r + overlay.grow })),
    );
    fills.push(...shadedShapes([sleeve], overlay.material, axis2));
    polys.push(sleeve);
  }
  const clipId = `c${(clipCounter += 1)}`;
  const surface = limbSurface(limb, profile, length);
  return {
    depth: (cam.toView(limb.root)[2] + cam.toView(limb.joint)[2]) / 2,
    rims: outlineShapes(polys),
    fills,
    muscles: muscles
      ? [
          ...definitionShapes(cam, part, surface, clipId, { points: outline, axis: axis2 }),
          ...muscleShapes(cam, part, surface, clipId, muscles, { points: outline, axis: axis2 }),
        ]
      : [],
    clips: [{ id: clipId, paths: polys.map((p) => smoothPath(p)) }],
    points: polys.flat(),
  };
}

/**
 * A whole arm or leg as one piece, so its elbow or knee has no seam: both parts' rims first, then
 * their fills, the nearer part last. Folded hard (a curl's top), the nearer part keeps its own rim,
 * so it reads apart from the part behind it.
 */
function jointedPiece(upper: PartDrawing, lower: PartDrawing, folded: boolean): Piece {
  const [back, front] = lower.depth >= upper.depth ? [upper, lower] : [lower, upper];
  const shapes = folded
    ? [
        ...back.rims,
        ...back.fills,
        ...back.muscles,
        ...front.rims,
        ...front.fills,
        ...front.muscles,
      ]
    : [
        ...back.rims,
        ...front.rims,
        ...back.fills,
        ...back.muscles,
        ...front.fills,
        ...front.muscles,
      ];
  return {
    depth: (upper.depth + lower.depth) / 2,
    layer: 1,
    shapes,
    clips: [...upper.clips, ...lower.clips],
    points: [...upper.points, ...lower.points],
  };
}

/** Whether a limb is bent past ~55 degrees at its middle joint. */
function isFolded(limb: Limb): boolean {
  const a = normalize(sub(limb.joint, limb.root));
  const b = normalize(sub(limb.end, limb.joint));
  return dot(a, b) < 0.57;
}

/** The torso's outline: its rings' outer edges swept from the seat to the traps, and both ends. */
function torsoOutline(cam: Camera, s: Skeleton, surface: Surface): P2[][] {
  const rings = TORSO_RINGS.map((r) =>
    Array.from({ length: 28 }, (_, i) => cam.toScreen(surface(r.h, (i / 28) * 360).p)),
  );
  const ends = [
    convexHull([...rings[0], ...rings[1]]),
    convexHull([...rings[rings.length - 2], ...rings[rings.length - 1]]),
  ];
  const a = cam.toScreen(s.pelvis);
  const b = cam.toScreen(s.shoulderCenter);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 14) {
    // Seen end-on: each pair of neighbouring rings' outline.
    return rings.slice(1).map((ring, i) => convexHull([...rings[i], ...ring]));
  }
  const px = -(b[1] - a[1]) / len;
  const py = (b[0] - a[0]) / len;
  const left: P2[] = [];
  const right: P2[] = [];
  for (const ring of rings) {
    let hi = ring[0];
    let lo = ring[0];
    for (const p of ring) {
      if (p[0] * px + p[1] * py > hi[0] * px + hi[1] * py) hi = p;
      if (p[0] * px + p[1] * py < lo[0] * px + lo[1] * py) lo = p;
    }
    left.push(hi);
    right.push(lo);
  }
  return [[...left, ...right.reverse()], ...ends];
}

/**
 * The skin a tank top leaves bare on the torso: a scooped neckline front and back, and the
 * shoulders beside its straps.
 */
const TANK_TOP_BARE: readonly Pick<MusclePatch, 't' | 'theta'>[] = [
  { t: [0.82, 1.1], theta: [-40, 40] },
  { t: [0.86, 1.12], theta: [146, 214] },
  { t: [0.9, 1.12], theta: [58, 128] },
  { t: [0.9, 1.12], theta: [-128, -58] },
];

function tankTopSkin(
  cam: Camera,
  surface: Surface,
  clipId: string,
  points: readonly P2[],
  axis: [P2, P2],
  skin: Material,
): Shape[] {
  const shapes: Shape[] = [];
  for (const { t, theta } of TANK_TOP_BARE) {
    const poly = patchPolygon(cam, surface, t, theta);
    if (poly) {
      shapes.push({
        d: smoothPath(poly),
        fill: midTone(skin),
        gradient: cylinderGradient(points, axis[0], axis[1], skin),
        clipId,
      });
    }
  }
  return shapes;
}

/**
 * Every muscle on a part of the anatomy figure, drawn faintly lighter than the body with a fine
 * edge, so it reads as an anatomy chart before the worked muscles are coloured over it.
 */
function definitionShapes(
  cam: Camera,
  part: BodyPartKey,
  surface: Surface,
  clipId: string,
  shade: { points: readonly P2[]; axis: [P2, P2] },
): Shape[] {
  const shapes: Shape[] = [];
  for (const region of Object.keys(REGION_PATCHES) as (keyof typeof REGION_PATCHES)[]) {
    for (const patch of REGION_PATCHES[region]) {
      if (patch.part !== part) continue;
      const poly = patchPolygon(cam, surface, patch.t, patch.theta);
      if (!poly) continue;
      shapes.push({
        d: smoothPath(poly),
        fill: midTone(MATERIALS.definition),
        gradient: cylinderGradient(
          shade.points,
          shade.axis[0],
          shade.axis[1],
          MATERIALS.definition,
        ),
        stroke: ART.muscleEdge,
        strokeWidth: 0.35,
        clipId,
      });
    }
  }
  return shapes;
}

/** A face when it's turned toward the viewer: eyes, brows and a mouth on the head's ball. */
function faceShapes(cam: Camera, s: Skeleton): Shape[] {
  const { up, forward, right } = s.headFrame;
  const r = BODY.headRadius;
  const onHead = (f: number, side: number, u: number): { p: V3; n: V3 } => {
    const n = normalize(add(add(scale(forward, f), scale(right, side)), scale(up, u)));
    return { p: add(s.head, scale(n, r)), n };
  };
  const shapes: Shape[] = [];
  for (const side of [1, -1]) {
    const eye = onHead(0.9, 0.36 * side, 0.08);
    if (cam.facing(eye.n) > 0.25) {
      const c = cam.toScreen(eye.p);
      shapes.push({
        d: polygonPath(
          Array.from({ length: 10 }, (_, i): P2 => {
            const a = (i / 10) * Math.PI * 2;
            return [c[0] + Math.cos(a) * 1.05, c[1] + Math.sin(a) * 0.7];
          }),
        ),
        fill: ART.feature,
      });
      const b0 = cam.toScreen(onHead(0.88, 0.22 * side, 0.3).p);
      const b1 = cam.toScreen(onHead(0.8, 0.52 * side, 0.27).p);
      shapes.push({
        d: `M${b0[0].toFixed(1)} ${b0[1].toFixed(1)}L${b1[0].toFixed(1)} ${b1[1].toFixed(1)}`,
        fill: 'none',
        stroke: ART.feature,
        strokeWidth: 0.8,
      });
    }
  }
  // The mouth, on the jaw.
  const jaw = add(add(s.head, scale(forward, 3.6)), scale(up, -5.2));
  const mouthN = normalize(add(scale(forward, 0.97), scale(up, -0.08)));
  if (cam.facing(mouthN) > 0.3) {
    const m = add(jaw, scale(mouthN, 7.3));
    const m0 = cam.toScreen(add(m, scale(right, 2)));
    const m1 = cam.toScreen(add(m, scale(right, -2)));
    shapes.push({
      d: `M${m0[0].toFixed(1)} ${m0[1].toFixed(1)}L${m1[0].toFixed(1)} ${m1[1].toFixed(1)}`,
      fill: 'none',
      stroke: ART.lips,
      strokeWidth: 0.7,
    });
  }
  return shapes;
}

function bodyPieces(cam: Camera, s: Skeleton, muscles: MuscleHighlight, look: Look): Piece[] {
  const shown = look.muscles ? muscles : null;
  const pieces: Piece[] = [];
  const midArms = cam.toView(s.shoulderCenter)[2];
  const midLegs = cam.toView(s.pelvis)[2];
  const isFar = (root: V3, mid: number) => cam.toView(root)[2] < mid - 3;

  const surface = torsoSurface(s);
  const torso = torsoOutline(cam, s, surface);
  const torsoClip = `c${(clipCounter += 1)}`;
  const torsoAxis: [P2, P2] = [cam.toScreen(s.pelvis), cam.toScreen(s.shoulderCenter)];
  // A little behind its middle, so arms and legs at the body's own depth draw over it.
  const torsoDepth = cam.toView(lerp3(s.pelvis, s.shoulderCenter, 0.5))[2];
  pieces.push({
    // The standing anatomy figure's hips and seat cover the tops of its thighs (its glutes show).
    depth: torsoDepth + (look.muscles ? 6 : -4),
    layer: 1,
    shapes: [
      ...outlineShapes(torso),
      // Dressed, the tank top and shorts cover the torso; bare, it's the figure's own grey.
      ...shadedShapes(torso, look.cloth ?? look.skin, torsoAxis),
      ...(look.cloth
        ? tankTopSkin(cam, surface, torsoClip, torso.flat(), torsoAxis, look.skin)
        : []),
      ...(look.muscles
        ? definitionShapes(cam, 'torso', surface, torsoClip, {
            points: torso.flat(),
            axis: torsoAxis,
          })
        : []),
      ...(shown
        ? muscleShapes(cam, 'torso', surface, torsoClip, shown, {
            points: torso.flat(),
            axis: torsoAxis,
          })
        : []),
    ],
    clips: [{ id: torsoClip, paths: torso.map((p) => smoothPath(p)) }],
    points: torso.flat(),
  });

  for (const side of ['r', 'l'] as const) {
    const arm = s.arms[side];
    lateralHints.set(arm, sub(s.shoulders[side], s.shoulderCenter));
    const farArm = isFar(arm.root, midArms);
    const armSkin = farArm ? look.skinFar : look.skin;
    // A tank top: the arms are bare.
    pieces.push(
      jointedPiece(
        limbDrawing(cam, arm, 'upperArm', BODY.upperArm, armSkin, shown),
        limbDrawing(cam, lowerLimb(arm), 'forearm', BODY.forearm, armSkin, shown),
        isFolded(arm),
      ),
    );
    // The hand closed around the handle: a mitten along the forearm.
    const along = normalize(sub(arm.end, arm.joint));
    const hand = sphereHull(cam, [
      { c: add(arm.end, scale(along, -2.4)), r: 3.6 },
      { c: add(arm.end, scale(along, 1.2)), r: 4.3 },
    ]);
    pieces.push({
      depth: cam.toView(arm.end)[2] + 0.8,
      layer: 1,
      shapes: [...outlineShapes([hand]), ...shadedShapes([hand], armSkin, null)],
      points: hand,
    });

    const leg = s.legs[side];
    lateralHints.set(leg, sub(s.hips[side], s.pelvis));
    const farLeg = isFar(leg.root, midLegs);
    const legSkin = farLeg ? look.skinFar : look.skin;
    const shorts = farLeg ? look.clothFar : look.cloth;
    pieces.push(
      jointedPiece(
        limbDrawing(
          cam,
          leg,
          'thigh',
          BODY.thigh,
          legSkin,
          shown,
          shorts ? { from: 0, to: 0.4, grow: 0.35, material: shorts } : undefined,
        ),
        limbDrawing(cam, lowerLimb(leg), 'shin', BODY.shin, legSkin, shown),
        isFolded(leg),
      ),
    );
    const foot = s.feet[side];
    const shoe = sphereHull(cam, [
      { c: foot.heel, r: 3.7 },
      { c: leg.end, r: 4.5 },
      { c: lerp3(foot.heel, foot.toe, 0.66), r: 4.1 },
      { c: foot.toe, r: 3.1 },
    ]);
    const shoeMaterial = (farLeg ? look.shoeFar : look.shoe) ?? legSkin;
    pieces.push({
      depth: (cam.toView(leg.end)[2] + cam.toView(foot.toe)[2]) / 2 + 0.5,
      layer: 1,
      shapes: [
        ...outlineShapes([shoe]),
        {
          d: smoothPath(shoe),
          fill: midTone(shoeMaterial),
          gradient: verticalGradient(shoe, shoeMaterial),
        },
      ],
      points: shoe,
      floor: [foot.heel, foot.toe],
    });
  }

  // The neck rises from behind the top of the torso.
  const neckTop = add(s.neckBase, scale(s.headFrame.up, BODY.neck));
  const neck = sweepOutline(cam, [
    { c: s.neckBase, r: 5.8 },
    { c: neckTop, r: 4.9 },
  ]);
  pieces.push({
    depth: torsoDepth - 5,
    layer: 1,
    shapes: [
      ...outlineShapes([neck]),
      ...shadedShapes([neck], look.skin, [cam.toScreen(s.neckBase), cam.toScreen(neckTop)]),
    ],
    points: neck,
  });

  // The head: a rounded cranium with a jaw, chin and nose -- a face's profile when seen side-on.
  const { up, forward, right } = s.headFrame;
  const at = (f: number, u: number): V3 => add(add(s.head, scale(forward, f)), scale(up, u));
  const headPoly = sphereHull(cam, [
    { c: s.head, r: BODY.headRadius },
    { c: at(3.6, -5.2), r: 7.4 },
    { c: at(6.2, -8.6), r: 3.6 },
    { c: at(10.1, -2.4), r: 1.6 },
  ]);
  const headCenter = cam.toScreen(s.head);
  // Short hair with some volume on top: a cap of a slightly larger ball, set up and back.
  const hairCenter = add(add(s.head, scale(up, 0.9)), scale(forward, -0.7));
  const hair = capPolygon(
    cam,
    hairCenter,
    BODY.headRadius + 0.9,
    normalize(add(scale(up, 0.82), scale(forward, -0.5))),
    74,
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
      {
        d: smoothPath(headPoly),
        fill: midTone(look.skin),
        gradient: sphereGradient(headCenter, BODY.headRadius * 1.15, look.skin),
      },
      ...(look.hair
        ? ears.map((ear) => ({
            d: smoothPath(ear),
            fill: ART.ear,
            opacity: 0.85,
            clipId: headClip,
          }))
        : []),
      ...(look.hair ? faceShapes(cam, s) : []),
      ...(hair && look.hair
        ? [
            {
              d: smoothPath(hair),
              fill: midTone(look.hair),
              gradient: sphereGradient(cam.toScreen(hairCenter), BODY.headRadius + 1, look.hair),
            },
          ]
        : []),
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
  // A soft shadow: three ellipses, each smaller and darker toward the middle.
  const shapes = [1.25, 1, 0.72].map((k): Shape => {
    const rx = ((maxX - minX) / 2 + 14) * k;
    const rz = ((maxZ - minZ) / 2 + 12) * k;
    const pts: P2[] = [];
    for (let i = 0; i < 32; i += 1) {
      const a = (i / 32) * Math.PI * 2;
      pts.push(cam.toScreen([cx + Math.cos(a) * rx, 0, cz + Math.sin(a) * rz]));
    }
    return { d: smoothPath(pts), fill: ART.shadow, opacity: 0.32 };
  });
  return { depth: -Infinity, layer: 0, shapes, points: [] };
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
export function renderScene(
  scene: SceneSpec,
  muscles: MuscleHighlight,
  options: RenderOptions = {},
): RenderedScene {
  const look = options.anatomy ? ANATOMY : DRESSED;
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
      ...bodyPieces(cam, skeleton, muscles, look),
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
    if (options.arrows && scene.motion && index > 0) {
      const from = cam.toScreen(scene.motion(skeletons[index - 1]));
      const to = cam.toScreen(scene.motion(skeleton));
      shapes.push(...motionShapes(from, to, cam.toScreen(skeleton.pelvis)));
    }
    if (options.flat) {
      return {
        shapes: shapes
          .filter((shape) => shape.fill !== ART.rim && shape.fill !== ART.shadow)
          .map(({ gradient: _gradient, ...shape }) => shape),
        clips,
      };
    }
    return { shapes, clips };
  });

  const pad = 7;
  const moving = scene.motion;
  return {
    frames,
    motionPoints: moving ? skeletons.map((skeleton) => cam.toScreen(moving(skeleton))) : undefined,
    viewBox: {
      x: minX - pad,
      y: minY - pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
    },
    warnings,
  };
}
