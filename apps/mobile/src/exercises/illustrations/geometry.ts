// The small amount of 3D maths the exercise illustrations need: vectors, rotations, and turning a
// cloud of projected points into an outline. Pure functions, no React Native, so the same drawing
// code runs in the app and in tests.

/** A point or direction in the figure's own space: x forward, y up, z to the figure's right. */
export type V3 = readonly [number, number, number];
/** A point on the drawing, in drawing units (y down). */
export type P2 = readonly [number, number];

export const v3 = (x: number, y: number, z: number): V3 => [x, y, z];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: V3): number => Math.sqrt(dot(a, a));
export function normalize(a: V3): V3 {
  const l = length(a);
  return l < 1e-9 ? [0, 0, 0] : scale(a, 1 / l);
}
export const lerp3 = (a: V3, b: V3, t: number): V3 => add(a, scale(sub(b, a), t));
/** Adds several vectors at once. */
export function sum(...vs: V3[]): V3 {
  return vs.reduce<V3>((acc, x) => add(acc, x), [0, 0, 0]);
}

export const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Rotates `vec` about the unit `axis` by `deg` degrees (right-handed). */
export function rotateAbout(vec: V3, axis: V3, deg: number): V3 {
  const k = normalize(axis);
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return sum(scale(vec, c), scale(cross(k, vec), s), scale(k, dot(k, vec) * (1 - c)));
}

/** Some unit vector at right angles to `a`. */
export function anyPerpendicular(a: V3): V3 {
  const helper: V3 = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  return normalize(cross(a, helper));
}

/** The part of `vec` at right angles to the unit `axis`. */
export function perpendicularPart(vec: V3, axis: V3): V3 {
  return sub(vec, scale(axis, dot(vec, axis)));
}

/** The convex hull of a set of 2D points, counter-clockwise (Andrew's monotone chain). */
export function convexHull(points: readonly P2[]): P2[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const turn = (o: P2, a: P2, b: P2) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: P2[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: P2[] = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const p = sorted[i];
    while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

const fmt = (n: number): string => {
  const r = Math.round(n * 10) / 10;
  return Object.is(r, -0) ? '0' : String(r);
};

/** A closed polygon as an SVG path. */
export function polygonPath(points: readonly P2[]): string {
  if (points.length === 0) return '';
  return `M${points.map((p) => `${fmt(p[0])} ${fmt(p[1])}`).join('L')}Z`;
}

/**
 * A closed outline drawn smoothly through a polygon's points -- each corner rounded by a quadratic
 * curve between the midpoints of its sides, so hulls of sampled circles read as soft shapes.
 */
export function smoothPath(points: readonly P2[]): string {
  const n = points.length;
  if (n < 3) return polygonPath(points);
  const mid = (a: P2, b: P2): P2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(points[n - 1], points[0]);
  let d = `M${fmt(start[0])} ${fmt(start[1])}`;
  for (let i = 0; i < n; i += 1) {
    const corner = points[i];
    const next = mid(points[i], points[(i + 1) % n]);
    d += `Q${fmt(corner[0])} ${fmt(corner[1])} ${fmt(next[0])} ${fmt(next[1])}`;
  }
  return `${d}Z`;
}

/** Points around a circle of radius `r` in the plane spanned by the unit vectors `u` and `w`. */
export function ring(center: V3, u: V3, w: V3, r: number, samples = 20): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < samples; i += 1) {
    const a = (i / samples) * Math.PI * 2;
    out.push(add(center, add(scale(u, Math.cos(a) * r), scale(w, Math.sin(a) * r))));
  }
  return out;
}
