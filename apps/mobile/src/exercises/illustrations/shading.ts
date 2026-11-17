import { dot, normalize, type P2, type V3 } from './geometry';
import type { Material } from './palette';

// The soft "clean 3D" light: every rounded thing (a limb, the torso, a handle, a plate's rim) is
// shaded across its width as a cylinder lit from the upper left and a little in front, and every
// ball (the head, a fist) as a sphere. Colours are mixed between a material's shadowed and lit
// tones; the result is an SVG gradient the shape is filled with.

export interface Gradient {
  kind: 'linear' | 'radial';
  /** Linear: from (x1, y1) to (x2, y2). Radial: centred on (x1, y1) with radius `r`. */
  x1: number;
  y1: number;
  x2?: number;
  y2?: number;
  r?: number;
  stops: readonly (readonly [number, string])[];
}

/** Where the light comes from, in view space (x right, y up, z toward the viewer). */
const LIGHT: V3 = normalize([-0.55, 0.7, 0.62]);
const AMBIENT = 0.14;

function channel(hex: string, i: number): number {
  return parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
}

/** A colour between `a` (t = 0) and `b` (t = 1), as #rrggbb. */
export function mix(a: string, b: string, t: number): string {
  const k = Math.min(1, Math.max(0, t));
  let out = '#';
  for (let i = 0; i < 3; i += 1) {
    const v = Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * k);
    out += v.toString(16).padStart(2, '0');
  }
  return out;
}

/** The tone of a material at a surface facing `normal` (view space). */
export function toneAt(material: Material, normal: V3): string {
  const lit = AMBIENT + (1 - AMBIENT) * Math.max(0, dot(normalize(normal), LIGHT));
  return mix(material.shadow, material.light, Math.pow(lit, 0.85));
}

/** A material in a single colour's own light and shadow (a muscle's red, say). */
export function materialOf(color: string): Material {
  return { light: mix(color, '#ffffff', 0.14), shadow: mix(color, '#000000', 0.3) };
}

/** The flat colour a shaded shape falls back to: its material half-lit. */
export function midTone(material: Material): string {
  return mix(material.shadow, material.light, 0.55);
}

/**
 * Shading across something long and round seen from the side (its axis from `a` to `b` on the
 * page), as wide as its outline `points` reach. Seen end-on, it's shaded as a ball instead.
 */
export function cylinderGradient(
  points: readonly P2[],
  a: P2,
  b: P2,
  material: Material,
): Gradient {
  const ax = b[0] - a[0];
  const ay = b[1] - a[1];
  const len = Math.hypot(ax, ay);
  const cx = (a[0] + b[0]) / 2;
  const cy = (a[1] + b[1]) / 2;
  if (len < 2) {
    let r = 1;
    for (const p of points) r = Math.max(r, Math.hypot(p[0] - cx, p[1] - cy));
    return sphereGradient([cx, cy], r, material);
  }
  // Across the axis, on the page.
  const px = -ay / len;
  const py = ax / len;
  let r = 1;
  for (const p of points) r = Math.max(r, Math.abs((p[0] - cx) * px + (p[1] - cy) * py));
  const stops: [number, string][] = [];
  for (const u of [-1, -0.75, -0.45, -0.15, 0.15, 0.45, 0.75, 1]) {
    // The page's y runs down; the view's up.
    const normal: V3 = [px * u, -py * u, Math.sqrt(Math.max(0, 1 - u * u))];
    stops.push([(u + 1) / 2, toneAt(material, normal)]);
  }
  return {
    kind: 'linear',
    x1: cx - px * r,
    y1: cy - py * r,
    x2: cx + px * r,
    y2: cy + py * r,
    stops,
  };
}

/** Shading on a ball: lit up and to the left, falling into shadow at its far edge. */
export function sphereGradient(center: P2, r: number, material: Material): Gradient {
  return {
    kind: 'radial',
    x1: center[0] - r * 0.35,
    y1: center[1] - r * 0.4,
    r: r * 1.45,
    stops: [
      [0, material.light],
      [0.45, mix(material.shadow, material.light, 0.72)],
      [1, material.shadow],
    ],
  };
}

/** Shading from top to bottom of an outline: lit above, darker below (shoes, flat-topped things). */
export function verticalGradient(points: readonly P2[], material: Material): Gradient {
  let top = Infinity;
  let bottom = -Infinity;
  let left = Infinity;
  for (const p of points) {
    top = Math.min(top, p[1]);
    bottom = Math.max(bottom, p[1]);
    left = Math.min(left, p[0]);
  }
  return {
    kind: 'linear',
    x1: left,
    y1: top,
    x2: left,
    y2: bottom,
    stops: [
      [0, material.light],
      [0.6, mix(material.shadow, material.light, 0.6)],
      [1, material.shadow],
    ],
  };
}
