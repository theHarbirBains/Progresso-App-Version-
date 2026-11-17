import {
  add,
  anyPerpendicular,
  convexHull,
  cross,
  dot,
  length,
  lerp3,
  normalize,
  perpendicularPart,
  polygonPath,
  ring,
  scale,
  sub,
  type P2,
  type V3,
} from './geometry';
import { ART, MATERIALS, type Material } from './palette';
import type { Camera, Piece, PropBuilder, Shape } from './render';
import type { Side, Skeleton } from './rig';
import { cylinderGradient, midTone } from './shading';

// The equipment in the illustrations, built from two shaded solids -- cylinders (handles, bars,
// plates, posts), lit like the body, and boxes (benches, boxes, platforms), a tone per face -- and
// drawn in depth order with the body.

const EDGE = 0.5;

function edgeStyle(fill: string): Shape {
  return { d: '', fill, stroke: ART.rim, strokeWidth: EDGE };
}

/** The tone of a bar's end as it faces the viewer. */
const METAL_END = '#D9DCE0';

/** A solid cylinder from `a` to `b`. */
function cylinder(
  cam: Camera,
  a: V3,
  b: V3,
  r: number,
  side: Material,
  cap: string,
  opts: { layer?: 0 | 1; bias?: number; hub?: number; floor?: boolean } = {},
): Piece {
  const axis = normalize(sub(b, a));
  const u = anyPerpendicular(axis);
  const w = cross(axis, u);
  const samples = r > 8 ? 28 : 14;
  const ringA = ring(a, u, w, r, samples).map(cam.toScreen);
  const ringB = ring(b, u, w, r, samples).map(cam.toScreen);
  const hull = convexHull([...ringA, ...ringB]);
  const shapes: Shape[] = [
    {
      ...edgeStyle(midTone(side)),
      d: polygonPath(hull),
      gradient: cylinderGradient(hull, cam.toScreen(a), cam.toScreen(b), side),
    },
  ];
  const facingB = cam.facing(axis);
  const face =
    facingB > 0.12 ? { ring: ringB, at: b } : facingB < -0.12 ? { ring: ringA, at: a } : null;
  if (face) {
    shapes.push({ ...edgeStyle(cap), d: polygonPath(face.ring) });
    if (opts.hub) {
      const hub = ring(face.at, u, w, opts.hub, 12).map(cam.toScreen);
      shapes.push({ d: polygonPath(hub), fill: ART.plateHub });
    }
  }
  return {
    depth: cam.toView(lerp3(a, b, 0.5))[2] + (opts.bias ?? 0),
    layer: opts.layer ?? 1,
    shapes,
    points: hull,
    floor: opts.floor ? [a, b] : undefined,
    anchor: lerp3(a, b, 0.5),
  };
}

/** A solid box: `center` and three half-extent vectors at right angles. */
function box(
  cam: Camera,
  center: V3,
  hx: V3,
  hy: V3,
  hz: V3,
  colors: { top: string; side: string; front: string },
  opts: { layer?: 0 | 1; bias?: number; floor?: boolean } = {},
): Piece {
  const axes = [hx, hy, hz];
  const shapes: Shape[] = [];
  const pts: P2[] = [];
  const corners: V3[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1])
        corners.push(add(add(add(center, scale(hx, sx)), scale(hy, sy)), scale(hz, sz)));
    }
  }
  pts.push(...corners.map(cam.toScreen));
  const faces: { n: V3; poly: V3[] }[] = [];
  for (let i = 0; i < 3; i += 1) {
    const e = axes[i];
    const f = axes[(i + 1) % 3];
    const g = axes[(i + 2) % 3];
    for (const sign of [-1, 1]) {
      const c = add(center, scale(e, sign));
      faces.push({
        n: scale(normalize(e), sign),
        poly: [add(add(c, f), g), add(sub(c, f), g), sub(sub(c, f), g), sub(add(c, f), g)],
      });
    }
  }
  const visible = faces.filter((face) => cam.facing(face.n) > 0.01);
  const frontMost = visible.reduce<{ n: V3 } | null>(
    (best, face) =>
      face.n[1] < 0.7 && (!best || cam.facing(face.n) > cam.facing(best.n)) ? face : best,
    null,
  );
  for (const face of visible) {
    const color = face.n[1] > 0.7 ? colors.top : face === frontMost ? colors.front : colors.side;
    shapes.push({ ...edgeStyle(color), d: polygonPath(face.poly.map(cam.toScreen)) });
  }
  return {
    depth: cam.toView(center)[2] + (opts.bias ?? 0),
    layer: opts.layer ?? 0,
    shapes,
    points: pts,
    floor: opts.floor ? corners.filter((c) => c[1] < 1) : undefined,
  };
}

// ---------------------------------------------------------------------------------------------
// Hand-held weights

export type HandleAxis = 'lr' | 'fb' | 'ud' | ((s: Skeleton, side: Side) => V3);

function handleDirection(s: Skeleton, side: Side, axis: HandleAxis): V3 {
  const frame = s.frameAt(1);
  const raw =
    axis === 'lr'
      ? frame.right
      : axis === 'fb'
        ? frame.forward
        : axis === 'ud'
          ? frame.up
          : axis(s, side);
  // A handle always runs across the fist, at right angles to the forearm.
  const forearm = normalize(sub(s.arms[side].end, s.arms[side].joint));
  const across = perpendicularPart(raw, forearm);
  return length(across) < 0.2 ? anyPerpendicular(forearm) : normalize(across);
}

function dumbbellPieces(cam: Camera, grip: V3, axis: V3, plateR = 6.8): Piece[] {
  const half = 6.4;
  const thick = 4.6;
  const end = (sign: number) => add(grip, scale(axis, sign * half));
  const out: Piece[] = [
    cylinder(cam, end(-1), end(1), 1.5, MATERIALS.metal, METAL_END, { bias: -0.4 }),
  ];
  for (const sign of [-1, 1]) {
    out.push(
      cylinder(
        cam,
        end(sign),
        add(grip, scale(axis, sign * (half + thick))),
        plateR,
        MATERIALS.iron,
        ART.plateFace,
        {
          hub: 1.6,
        },
      ),
    );
  }
  return out;
}

/** A dumbbell in each hand (or only the hands named), its handle along `axis`. */
export function dumbbells(
  axis: HandleAxis = 'lr',
  sides: readonly Side[] = ['r', 'l'],
): PropBuilder {
  return ({ cam, skeleton }) =>
    sides.flatMap((side) =>
      dumbbellPieces(cam, skeleton.arms[side].end, handleDirection(skeleton, side, axis)),
    );
}

/** One dumbbell held in both hands -- upright at the chest (a goblet), or overhead. */
export function heldDumbbell(
  axisOf: (s: Skeleton) => V3 = (s) => s.frameAt(1).up,
  offset: (s: Skeleton) => V3 = () => [0, 0, 0],
): PropBuilder {
  return ({ cam, skeleton }) => {
    const center = add(lerp3(skeleton.arms.r.end, skeleton.arms.l.end, 0.5), offset(skeleton));
    return dumbbellPieces(cam, center, normalize(axisOf(skeleton)), 7.6);
  };
}

/** A dumbbell placed anywhere (resting on the hips, on the floor). */
export function dumbbellAt(at: (s: Skeleton) => V3, axisOf: (s: Skeleton) => V3): PropBuilder {
  return ({ cam, skeleton }) => dumbbellPieces(cam, at(skeleton), normalize(axisOf(skeleton)), 7.2);
}

export interface BarOptions {
  /** Olympic bar, or the shorter EZ curl bar with its bends. */
  kind?: 'olympic' | 'ez';
  /** Where the bar's middle is and which way it runs; default between the hands. */
  place?: (s: Skeleton) => { center: V3; axis: V3 };
  /** Plate radius (21 by default: a full-size plate, a little smaller so it hides less of the lifter). */
  plate?: number;
}

/** Where a bar in both hands sits. */
export function barBetweenHands(s: Skeleton): { center: V3; axis: V3 } {
  return {
    center: lerp3(s.arms.r.end, s.arms.l.end, 0.5),
    axis: normalize(sub(s.arms.r.end, s.arms.l.end)),
  };
}

export function barbell(opts: BarOptions = {}): PropBuilder {
  const ez = opts.kind === 'ez';
  return ({ cam, skeleton }) => {
    const { center, axis } = (opts.place ?? barBetweenHands)(skeleton);
    const half = ez ? 64 : 98;
    const sleeveFrom = ez ? 42 : 64;
    const plateR = opts.plate ?? (ez ? 15 : 21);
    const at = (s: number, lift: V3 = [0, 0, 0]) => add(add(center, scale(axis, s)), lift);
    const pieces: Piece[] = [];
    // The bar itself, in short lengths so each sits at its own depth.
    const stops = [
      -sleeveFrom,
      -sleeveFrom / 2,
      -sleeveFrom / 6,
      sleeveFrom / 6,
      sleeveFrom / 2,
      sleeveFrom,
    ];
    if (ez) {
      const bendDir = normalize(perpendicularPart(skeleton.frameAt(1).forward, axis));
      const kink = (s: number) =>
        Math.abs(s) > 22 ? 0 : Math.abs(Math.round(s / 6)) % 2 === 1 ? 2.4 : 0;
      const ezStops = [-sleeveFrom, -22, -16, -10, -4, 4, 10, 16, 22, sleeveFrom];
      for (let i = 0; i < ezStops.length - 1; i += 1) {
        const a = ezStops[i];
        const b = ezStops[i + 1];
        pieces.push(
          cylinder(
            cam,
            at(a, scale(bendDir, kink(a))),
            at(b, scale(bendDir, kink(b))),
            1.4,
            MATERIALS.metal,
            METAL_END,
            { bias: -0.4 },
          ),
        );
      }
    } else {
      for (let i = 0; i < stops.length - 1; i += 1) {
        pieces.push(
          cylinder(cam, at(stops[i]), at(stops[i + 1]), 1.4, MATERIALS.metal, METAL_END, {
            bias: -0.4,
          }),
        );
      }
    }
    for (const sign of [-1, 1]) {
      pieces.push(
        cylinder(cam, at(sign * sleeveFrom), at(sign * half), 2.5, MATERIALS.metal, METAL_END),
      );
      const p0 = sign * (sleeveFrom + 2);
      const p1 = sign * (sleeveFrom + (ez ? 5.5 : 7));
      pieces.push(
        cylinder(cam, at(p0), at(p1), plateR, MATERIALS.iron, ART.plateFace, { hub: ez ? 2.2 : 3 }),
      );
      pieces.push(
        cylinder(cam, at(p1), at(sign * (Math.abs(p1) + 1.6)), 3.6, MATERIALS.metal, METAL_END),
      );
    }
    return pieces;
  };
}

/** A bar anchored in a landmine on the floor, its loaded end in the hands. */
export function landmine(
  anchor: V3,
  endBeyondHands = 16,
  hold: 'both' | Side = 'both',
): PropBuilder {
  return ({ cam, skeleton }) => {
    const hands =
      hold === 'both'
        ? lerp3(skeleton.arms.r.end, skeleton.arms.l.end, 0.5)
        : skeleton.arms[hold].end;
    const dir = normalize(sub(hands, anchor));
    const tip = add(hands, scale(dir, endBeyondHands));
    const pieces: Piece[] = [];
    const n = 5;
    for (let i = 0; i < n; i += 1) {
      pieces.push(
        cylinder(
          cam,
          lerp3(anchor, hands, i / n),
          lerp3(anchor, hands, (i + 1) / n),
          1.6,
          MATERIALS.metal,
          METAL_END,
          { bias: -0.4 },
        ),
      );
    }
    pieces.push(
      cylinder(cam, hands, add(hands, scale(dir, 5)), 1.6, MATERIALS.metal, METAL_END, {
        bias: -0.4,
      }),
    );
    pieces.push(cylinder(cam, add(hands, scale(dir, 5)), tip, 2.5, MATERIALS.metal, METAL_END));
    pieces.push(
      cylinder(
        cam,
        add(hands, scale(dir, 7)),
        add(hands, scale(dir, 11)),
        17,
        MATERIALS.iron,
        ART.plateFace,
        { hub: 2.4 },
      ),
    );
    pieces.push(
      box(
        cam,
        add(anchor, [0, -1.5, 0]),
        [7, 0, 0],
        [0, 2.5, 0],
        [0, 0, 7],
        { top: ART.frame, side: ART.frameDark, front: ART.frameDark },
        { layer: 0, floor: true },
      ),
    );
    return pieces;
  };
}

// ---------------------------------------------------------------------------------------------
// Benches, boxes and the rest

const PAD = { top: ART.padTop, side: ART.padSide, front: ART.pad };
const FRAME = { top: ART.frame, side: ART.frameDark, front: ART.frame };
const WOOD = { top: ART.woodTop, side: ART.wood, front: ART.wood };
const PLATFORM = { top: ART.plateFace, side: ART.plate, front: ART.plate };

const X: V3 = [1, 0, 0];
const Y: V3 = [0, 1, 0];
const Z: V3 = [0, 0, 1];

function leg(cam: Camera, top: V3, height: number): Piece[] {
  const foot = [top[0], 0, top[2]] as V3;
  return [
    box(cam, lerp3(top, foot, 0.5), [2.2, 0, 0], [0, height / 2, 0], [0, 0, 2.2], FRAME, {
      layer: 0,
      floor: true,
    }),
    box(cam, add(foot, [0, 1, 0]), [2.6, 0, 0], [0, 1, 0], [0, 0, 13], FRAME, {
      layer: 0,
      floor: true,
    }),
  ];
}

export interface BenchOptions {
  /** Where the middle of the pad's top is (default 44 cm up). */
  at: V3;
  /** Pad length, cm. */
  length?: number;
  /**
   * Degrees the back pad rises behind the seat (incline), or falls (negative: decline). A flat
   * bench without it. The seat is at `at`; the back pad runs back (-x) from it.
   */
  angle?: number;
  /** Turn the bench to run across the picture (along z) instead of along x. */
  across?: boolean;
}

/** A gym bench: flat, incline or decline. */
export function bench(opts: BenchOptions): PropBuilder {
  return ({ cam }) => {
    const along = opts.across ? Z : X;
    const sideways = opts.across ? X : Z;
    const pieces: Piece[] = [];
    const padHalfH = 2.8;
    const angle = opts.angle ?? 0;
    if (!angle) {
      const len = opts.length ?? 118;
      const center = add(opts.at, [0, -padHalfH, 0]);
      pieces.push(
        box(cam, center, scale(along, len / 2), [0, padHalfH, 0], scale(sideways, 13), PAD, {
          layer: 0,
          bias: 1,
        }),
      );
      const legH = opts.at[1] - padHalfH * 2;
      pieces.push(
        ...leg(cam, add(add(center, scale(along, len / 2 - 12)), [0, -padHalfH, 0]), legH),
      );
      pieces.push(
        ...leg(cam, add(add(center, scale(along, -len / 2 + 12)), [0, -padHalfH, 0]), legH),
      );
      return pieces;
    }
    // Seat, then the back pad hinged at the seat's back edge.
    const seatLen = 34;
    const seatCenter = add(opts.at, [0, -padHalfH, 0]);
    pieces.push(
      box(cam, seatCenter, scale(along, seatLen / 2), [0, padHalfH, 0], scale(sideways, 13), PAD, {
        layer: 0,
        bias: 1,
      }),
    );
    const backLen = opts.length ?? 82;
    const rise = (angle * Math.PI) / 180;
    const backDir: V3 = add(scale(along, -Math.cos(rise)), scale(Y, Math.sin(rise)));
    const backUp = normalize(cross(sideways, backDir));
    const hinge = add(opts.at, scale(along, -seatLen / 2));
    const backCenter = add(
      add(hinge, scale(backDir, backLen / 2 + 1)),
      scale(backUp, dot(backUp, Y) < 0 ? padHalfH : -padHalfH),
    );
    pieces.push(
      box(
        cam,
        backCenter,
        scale(backDir, backLen / 2),
        scale(backUp, padHalfH),
        scale(sideways, 13),
        PAD,
        { layer: 0, bias: 1.2 },
      ),
    );
    const legH = opts.at[1] - padHalfH * 2;
    pieces.push(
      ...leg(cam, add(add(seatCenter, scale(along, seatLen / 2 - 6)), [0, -padHalfH, 0]), legH),
    );
    const backFoot = add(hinge, scale(backDir, backLen * 0.8));
    pieces.push(
      ...leg(
        cam,
        [backFoot[0], Math.max(4, backFoot[1] - 6), backFoot[2]],
        Math.max(4, backFoot[1] - 6),
      ),
    );
    return pieces;
  };
}

/** A padded roller to hook the legs under (a decline bench's leg hold), running across at `at`. */
export function legRoller(at: V3): PropBuilder {
  return ({ cam }) => [
    cylinder(cam, [at[0], at[1], -16], [at[0], at[1], 16], 4.5, MATERIALS.iron, ART.padTop, {
      layer: 0,
      bias: 4,
    }),
    box(
      cam,
      [at[0] - 4, (at[1] - 4) / 2, 0],
      [2.2, 0, 0],
      [0, (at[1] - 4) / 2, 0],
      [0, 0, 2.2],
      FRAME,
      { layer: 0, floor: true },
    ),
  ];
}

/** A sturdy box or step; `at` is the middle of its top. */
export function plyoBox(at: V3, size: { x: number; z: number } = { x: 46, z: 40 }): PropBuilder {
  return ({ cam }) => [
    box(
      cam,
      [at[0], at[1] / 2, at[2]],
      [size.x / 2, 0, 0],
      [0, at[1] / 2, 0],
      [0, 0, size.z / 2],
      WOOD,
      { layer: 0, floor: true },
    ),
  ];
}

/** A low platform under the feet (a deficit, a calf block); `at` is the middle of its top. */
export function platform(at: V3, size: { x: number; z: number } = { x: 60, z: 70 }): PropBuilder {
  return ({ cam }) => [
    box(
      cam,
      [at[0], at[1] / 2, at[2]],
      [size.x / 2, 0, 0],
      [0, at[1] / 2, 0],
      [0, 0, size.z / 2],
      PLATFORM,
      { layer: 0, floor: true },
    ),
  ];
}

/** A preacher bench's angled arm pad (its top edge at `top`), with its seat behind it. */
export function preacherBench(top: V3, seat: V3): PropBuilder {
  return ({ cam }) => {
    const tilt = (40 * Math.PI) / 180;
    const down: V3 = [Math.sin(tilt), -Math.cos(tilt), 0];
    const out: V3 = [Math.cos(tilt), Math.sin(tilt), 0];
    const padCenter = add(add(top, scale(down, 17)), scale(out, -2.6));
    return [
      box(cam, padCenter, scale(down, 17), scale(out, 2.6), [0, 0, 16], PAD, { layer: 0, bias: 3 }),
      box(
        cam,
        [padCenter[0] + 4, padCenter[1] / 2, 0],
        [2.4, 0, 0],
        [0, padCenter[1] / 2, 0],
        [0, 0, 2.4],
        FRAME,
        { layer: 0, floor: true },
      ),
      box(cam, add(seat, [0, -2.8, 0]), [14, 0, 0], [0, 2.8, 0], [0, 0, 14], PAD, { layer: 0 }),
      box(
        cam,
        [seat[0], (seat[1] - 5.6) / 2, seat[2]],
        [2.4, 0, 0],
        [0, (seat[1] - 5.6) / 2, 0],
        [0, 0, 2.4],
        FRAME,
        { layer: 0, floor: true },
      ),
    ];
  };
}

/** Rack posts with safety pins at `height`, the bar resting on them. */
export function rackPins(height: number, x: number, halfSpan = 58): PropBuilder {
  return ({ cam }) => {
    const pieces: Piece[] = [];
    for (const z of [-halfSpan, halfSpan]) {
      pieces.push(
        box(cam, [x - 4, 75, z], [2.6, 0, 0], [0, 75, 0], [0, 0, 2.6], FRAME, {
          layer: 1,
          bias: -30,
        }),
      );
      pieces.push(
        cylinder(
          cam,
          [x - 22, height - 2, z],
          [x + 22, height - 2, z],
          1.6,
          MATERIALS.metal,
          METAL_END,
          { bias: -1 },
        ),
      );
    }
    return pieces;
  };
}

/** An ab wheel rolling on the floor between the hands. */
export function abWheel(): PropBuilder {
  return ({ cam, skeleton }) => {
    const mid = lerp3(skeleton.arms.r.end, skeleton.arms.l.end, 0.5);
    const center: V3 = [mid[0], 9, mid[2]];
    return [
      cylinder(
        cam,
        add(center, [0, 0, -3.5]),
        add(center, [0, 0, 3.5]),
        9,
        MATERIALS.iron,
        ART.plateFace,
        { hub: 2.5, floor: true },
      ),
      cylinder(
        cam,
        skeleton.arms.l.end,
        add(center, [0, 0, -3.5]),
        1.3,
        MATERIALS.metal,
        METAL_END,
        {
          bias: -0.3,
        },
      ),
      cylinder(
        cam,
        add(center, [0, 0, 3.5]),
        skeleton.arms.r.end,
        1.3,
        MATERIALS.metal,
        METAL_END,
        {
          bias: -0.3,
        },
      ),
    ];
  };
}

/** An upright post to hold on to (a rack's upright), from the floor to `height`. */
export function post(at: V3, height = 190): PropBuilder {
  return ({ cam }) => [
    box(cam, [at[0], height / 2, at[2]], [3, 0, 0], [0, height / 2, 0], [0, 0, 3], FRAME, {
      layer: 1,
      bias: -40,
      floor: true,
    }),
  ];
}

/** A pull-up bar overhead, running across the figure. */
export function pullUpBar(height: number, x = 0): PropBuilder {
  return ({ cam }) => [
    cylinder(cam, [x, height, -60], [x, height, 60], 1.6, MATERIALS.metal, METAL_END, {
      bias: -0.5,
    }),
    box(cam, [x, height / 2, -62], [2.4, 0, 0], [0, height / 2, 0], [0, 0, 2.4], FRAME, {
      layer: 1,
      bias: -60,
      floor: true,
    }),
    box(cam, [x, height / 2, 62], [2.4, 0, 0], [0, height / 2, 0], [0, 0, 2.4], FRAME, {
      layer: 1,
      bias: -60,
      floor: true,
    }),
  ];
}

/** An exercise mat on the floor, centred under `at`. */
export function mat(at: V3, size: { x: number; z: number } = { x: 180, z: 60 }): PropBuilder {
  return ({ cam }) => [
    box(
      cam,
      [at[0], 0.6, at[2]],
      [size.x / 2, 0, 0],
      [0, 0.6, 0],
      [0, 0, size.z / 2],
      { top: '#4E3B33', side: '#3B2C26', front: '#3B2C26' },
      { layer: 0, floor: true },
    ),
  ];
}

/** Several props at once. */
export function props(...builders: PropBuilder[]): PropBuilder {
  return (ctx) => builders.flatMap((b) => b(ctx));
}
