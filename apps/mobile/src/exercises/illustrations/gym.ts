import {
  add,
  cross,
  length,
  lerp3,
  normalize,
  polygonPath,
  rad,
  scale,
  sub,
  type P2,
  type V3,
} from './geometry';
import { ART, MATERIALS, type Material } from './palette';
import {
  barbell,
  box,
  cylinder,
  FRAME,
  handleDirection,
  METAL_END,
  PAD,
  solidsRecorder,
} from './props';
import type { Camera, Piece, PropBuilder } from './render';
import type { Side, Skeleton } from './rig';
import { midTone, sphereGradient } from './shading';

// The gym beyond free weights, drawn from the same shaded solids as props.ts: cable columns with
// their pulleys and every attachment clipped to them, the parts machines are made of (seats, back
// pads, weight stacks, levers, rollers, foot plates), the Smith machine, and the smaller kit --
// kettlebells, medicine balls, bands, suspension straps, battle ropes, sleds, a trap bar.

const X: V3 = [1, 0, 0];
const Y: V3 = [0, 1, 0];
const Z: V3 = [0, 0, 1];

type At = V3 | ((s: Skeleton) => V3);
const resolve = (at: At, s: Skeleton): V3 => (typeof at === 'function' ? at(s) : at);
const mid = (a: V3, b: V3): V3 => lerp3(a, b, 0.5);

/** Two directions at right angles to `u`, a horizontal one first where there is one. */
function across(u: V3): [V3, V3] {
  const p1 = Math.abs(u[1]) > 0.92 ? X : normalize(cross(Y, u));
  return [p1, normalize(cross(u, p1))];
}

/** A square tube from `a` to `b`: a machine's frame. */
export function tube(
  cam: Camera,
  a: V3,
  b: V3,
  half = 2.4,
  opts: { layer?: 0 | 1; bias?: number; floor?: boolean } = {},
): Piece {
  const u = normalize(sub(b, a));
  const [p1, p2] = across(u);
  return box(
    cam,
    mid(a, b),
    scale(u, length(sub(b, a)) / 2),
    scale(p1, half),
    scale(p2, half),
    FRAME,
    {
      layer: opts.layer ?? 0,
      bias: opts.bias,
      floor: opts.floor,
    },
  );
}

/** A metal rod (a guide rod, a cable) from `a` to `b`, in short lengths so each sits at its own depth. */
function rod(
  cam: Camera,
  a: V3,
  b: V3,
  r: number,
  material: Material = MATERIALS.metal,
  pieces = 4,
): Piece[] {
  return Array.from({ length: pieces }, (_, i) =>
    cylinder(cam, lerp3(a, b, i / pieces), lerp3(a, b, (i + 1) / pieces), r, material, METAL_END, {
      bias: -0.3,
    }),
  );
}

/** A ball: a kettlebell's bell, a medicine ball, a rope's knot. */
export function ball(cam: Camera, center: V3, r: number, material: Material, bias = 0): Piece {
  solidsRecorder()?.({ kind: 'ball', center, r, side: material });
  const c = cam.toScreen(center);
  const top = cam.toScreen(add(center, [0, r, 0]));
  const sr = Math.max(0.5, Math.abs(top[1] - c[1]));
  const outline: P2[] = Array.from({ length: 28 }, (_, i) => {
    const t = (i / 28) * Math.PI * 2;
    return [c[0] + Math.cos(t) * sr, c[1] + Math.sin(t) * sr];
  });
  return {
    depth: cam.toView(center)[2] + bias,
    layer: 1,
    shapes: [
      {
        d: polygonPath(outline),
        fill: midTone(material),
        gradient: sphereGradient(c, sr, material),
        stroke: ART.rim,
        strokeWidth: 0.5,
      },
    ],
    points: outline,
    anchor: center,
  };
}

// ---------------------------------------------------------------------------------------------
// Cables

/** What's clipped to a cable. */
export type Attachment =
  | 'straight-bar'
  | 'lat-bar'
  | 'ez-bar'
  | 'v-bar'
  | 'rope'
  | 'v-handle'
  | 'd-handle'
  | 'narrow-neutral'
  | 'wide-neutral'
  | 'mag-pronated'
  | 'mag-neutral'
  | 'ankle-strap'
  | 'cable-end';

/** A cable column: two uprights, the weight stack between them, and its pulley at `height`. */
export interface Column {
  /** Where it stands on the floor. */
  at: V3;
  /** The way its pulley faces (toward the lifter), level. */
  face: V3;
  height: number;
}

/** Where a column's pulley is. */
export function pulleyOf(column: Column): V3 {
  const face = normalize([column.face[0], 0, column.face[2]]);
  return add(add(column.at, scale(face, 9)), [0, column.height, 0]);
}

function columnPieces(cam: Camera, column: Column, top = 212): Piece[] {
  const face = normalize([column.face[0], 0, column.face[2]]);
  const side = normalize(cross(Y, face));
  const base = column.at;
  const pieces: Piece[] = [];
  for (const sign of [-1, 1]) {
    const foot = add(base, scale(side, sign * 13));
    pieces.push(tube(cam, foot, add(foot, [0, top, 0]), 2.6, { floor: true }));
  }
  pieces.push(
    tube(
      cam,
      add(base, add(scale(side, -15), [0, top, 0])),
      add(base, add(scale(side, 15), [0, top, 0])),
      2.6,
    ),
  );
  // The base, and the weight stack on it with its guide rods.
  pieces.push(
    box(cam, add(base, [0, 1.2, 0]), scale(face, 16), [0, 1.2, 0], scale(side, 17), FRAME, {
      layer: 0,
      floor: true,
    }),
  );
  pieces.push(
    box(
      cam,
      add(base, [0, 34, 0]),
      scale(face, 6),
      [0, 31, 0],
      scale(side, 10),
      { top: ART.plateFace, side: ART.plate, front: ART.plateFace },
      { layer: 0 },
    ),
  );
  for (const sign of [-1, 1]) {
    const r0 = add(base, add(scale(side, sign * 6), [0, 65, 0]));
    pieces.push(tube(cam, r0, add(r0, [0, top - 70, 0]), 0.8, { layer: 0 }));
  }
  // The pulley's carriage on the uprights, and the wheel.
  const pulley = pulleyOf(column);
  pieces.push(
    box(cam, add(base, [0, column.height, 0]), scale(face, 5), [0, 5, 0], scale(side, 15), FRAME, {
      layer: 0,
    }),
  );
  pieces.push(
    cylinder(
      cam,
      add(pulley, scale(side, -1.2)),
      add(pulley, scale(side, 1.2)),
      4.2,
      MATERIALS.iron,
      ART.plateHub,
      {
        bias: -1,
      },
    ),
  );
  return pieces;
}

/** The point a hand holds a grip at, and that grip's two ends. */
function grip(center: V3, axis: V3, half = 6): [V3, V3] {
  return [add(center, scale(axis, -half)), add(center, scale(axis, half))];
}

/** A rubber-covered handle. */
function handle(cam: Camera, a: V3, b: V3, r = 1.7): Piece {
  return cylinder(cam, a, b, r, MATERIALS.iron, ART.plateFace, { bias: 0.2 });
}

/** Across the fist for a neutral grip (palms in): at right angles to the forearm and the line between the hands. */
function neutralAxis(s: Skeleton, side: Side): V3 {
  const handLine = sub(s.arms.r.end, s.arms.l.end);
  const forearm = sub(s.arms[side].end, s.arms[side].joint);
  const a = cross(handLine, forearm);
  return length(a) < 1e-3 ? handleDirection(s, side, 'fb') : normalize(a);
}

/**
 * An attachment in the hands (or on an ankle), and the point its cable clips on, toward the
 * pulley `toward`.
 */
function attachmentPieces(
  cam: Camera,
  s: Skeleton,
  kind: Attachment,
  toward: V3,
  hold: 'both' | Side,
): { pieces: Piece[]; clip: V3 } {
  const r = s.arms.r.end;
  const l = s.arms.l.end;
  const hand = hold === 'both' ? mid(r, l) : s.arms[hold].end;
  const toPulley = normalize(sub(toward, hand));
  const pieces: Piece[] = [];
  const steel = (a: V3, b: V3, rr = 1.1) =>
    cylinder(cam, a, b, rr, MATERIALS.metal, METAL_END, { bias: -0.2 });
  switch (kind) {
    case 'straight-bar':
    case 'lat-bar':
    case 'ez-bar': {
      const axis = normalize(sub(r, l));
      const half = kind === 'lat-bar' ? 56 : kind === 'ez-bar' ? 27 : 29;
      const at = (t: number, lift = 0) => add(add(hand, scale(axis, t)), scale(toPulley, lift));
      const stops =
        kind === 'ez-bar'
          ? [-half, -18, -12, -6, 6, 12, 18, half]
          : [-half * 0.85, -half / 3, 0, half / 3, half * 0.85];
      const kink = (t: number) =>
        kind === 'ez-bar' && Math.abs(t) > 4 && Math.abs(t) < 20
          ? Math.round(Math.abs(t) / 6) % 2 === 1
            ? 2.2
            : 0
          : 0;
      for (let i = 0; i < stops.length - 1; i += 1) {
        pieces.push(steel(at(stops[i], kink(stops[i])), at(stops[i + 1], kink(stops[i + 1])), 1.3));
      }
      if (kind === 'lat-bar') {
        // The ends bend down, away from the pulley.
        for (const sign of [-1, 1]) {
          const from = at(sign * half * 0.85);
          pieces.push(steel(from, add(from, add(scale(axis, sign * 9), scale(toPulley, -6))), 1.3));
        }
      } else if (kind === 'straight-bar') {
        for (const sign of [-1, 1])
          pieces.push(handle(cam, at(sign * half * 0.85), at(sign * half), 1.6));
      }
      const clip = at(0, 4);
      pieces.push(steel(at(0), clip, 0.9));
      return { pieces, clip };
    }
    case 'v-bar': {
      // A short bar bent into a shallow upside-down V, a hand on each slope.
      const apex = add(hand, scale(toPulley, 6));
      for (const p of [r, l]) {
        const out = normalize(sub(p, apex));
        pieces.push(steel(apex, add(p, scale(out, 7)), 1.3));
      }
      pieces.push(steel(apex, add(apex, scale(toPulley, 3)), 0.9));
      return { pieces, clip: add(apex, scale(toPulley, 3)) };
    }
    case 'rope': {
      const clip = add(hand, scale(toPulley, 13));
      for (const side of hold === 'both' ? (['r', 'l'] as const) : [hold]) {
        const end = s.arms[side].end;
        const out = normalize(sub(end, clip));
        pieces.push(...rod(cam, clip, add(end, scale(out, 3)), 1.5, MATERIALS.rope, 3));
        pieces.push(ball(cam, add(end, scale(out, 5.5)), 2.6, MATERIALS.rope, 0.3));
      }
      pieces.push(ball(cam, clip, 1.8, MATERIALS.metal));
      return { pieces, clip };
    }
    case 'v-handle':
    case 'narrow-neutral':
    case 'wide-neutral':
    case 'mag-neutral': {
      const clip = add(hand, scale(toPulley, kind === 'v-handle' ? 15 : 8));
      const grips = (['r', 'l'] as const).map((side) =>
        grip(s.arms[side].end, neutralAxis(s, side), kind === 'v-handle' ? 6.5 : 6),
      );
      for (const [a, b] of grips) pieces.push(handle(cam, a, b));
      if (kind === 'v-handle') {
        for (const [a, b] of grips) {
          pieces.push(steel(a, clip), steel(b, clip));
        }
      } else {
        // A crossbar toward the pulley, a short riser to each grip's middle.
        const lift = scale(toPulley, 6);
        const axis = normalize(sub(r, l));
        const reach = kind === 'wide-neutral' ? 8 : 4;
        const ends = [
          add(add(r, lift), scale(axis, reach)),
          add(add(l, lift), scale(axis, -reach)),
        ];
        pieces.push(steel(ends[0], ends[1], 1.3));
        for (const [a, b] of grips) {
          const m = mid(a, b);
          pieces.push(steel(m, add(m, lift), 1));
        }
      }
      return { pieces, clip };
    }
    case 'mag-pronated': {
      const axis = normalize(sub(r, l));
      const lift = scale(toPulley, 6);
      pieces.push(handle(cam, add(r, scale(axis, -6)), add(r, scale(axis, 6))));
      pieces.push(handle(cam, add(l, scale(axis, -6)), add(l, scale(axis, 6))));
      pieces.push(
        steel(add(add(r, lift), scale(axis, 7)), add(add(l, lift), scale(axis, -7)), 1.3),
      );
      for (const p of [r, l]) {
        pieces.push(steel(add(p, scale(axis, 6)), add(add(p, lift), scale(axis, 7)), 1));
        pieces.push(steel(add(p, scale(axis, -6)), add(add(p, lift), scale(axis, -7)), 1));
      }
      return { pieces, clip: add(hand, scale(toPulley, 9)) };
    }
    case 'd-handle': {
      const sides = hold === 'both' ? (['r', 'l'] as const) : [hold];
      let clip = hand;
      for (const side of sides) {
        const p = s.arms[side].end;
        const [a, b] = grip(
          p,
          handleDirection(s, side, (sk, sd) => neutralOrAcross(sk, sd)),
          5.5,
        );
        const apex = add(p, scale(normalize(sub(toward, p)), 10));
        pieces.push(handle(cam, a, b), steel(a, apex, 0.9), steel(b, apex, 0.9));
        clip = apex;
      }
      return { pieces, clip };
    }
    case 'ankle-strap': {
      const side: Side = hold === 'l' ? 'l' : 'r';
      const ankle = s.legs[side].end;
      const shin = normalize(sub(s.legs[side].joint, ankle));
      pieces.push(
        cylinder(
          cam,
          add(ankle, scale(shin, 2)),
          add(ankle, scale(shin, 9)),
          4.6,
          MATERIALS.rope,
          ART.pad,
          {
            bias: 0.5,
          },
        ),
      );
      const clip = add(add(ankle, scale(shin, 5)), scale(normalize(sub(toward, ankle)), 6));
      return { pieces, clip };
    }
    case 'cable-end':
    default: {
      const sides = hold === 'both' ? (['r', 'l'] as const) : [hold];
      for (const side of sides) pieces.push(ball(cam, s.arms[side].end, 1.9, MATERIALS.metal, 0.5));
      return { pieces, clip: hand };
    }
  }
}

/** A single D-handle is turned across the fist, the way the hand holds it naturally. */
function neutralOrAcross(s: Skeleton, side: Side): V3 {
  const forearm = normalize(sub(s.arms[side].end, s.arms[side].joint));
  const out = scale(s.frameAt(1).right, side === 'r' ? 1 : -1);
  return normalize(cross(forearm, out));
}

export interface CableOptions {
  column: Column;
  attachment: Attachment;
  /** Both hands (the default), one hand, or -- for an ankle strap -- the ankle on that side. */
  hold?: 'both' | Side;
  /** Leave the column out (another builder draws it). */
  bare?: boolean;
}

/** A cable column, its cable, and what's clipped to it in the lifter's hands. */
export function cable(opts: CableOptions): PropBuilder {
  return ({ cam, skeleton }) => {
    const pulley = pulleyOf(opts.column);
    const { pieces, clip } = attachmentPieces(
      cam,
      skeleton,
      opts.attachment,
      pulley,
      opts.hold ?? 'both',
    );
    return [
      ...(opts.bare ? [] : columnPieces(cam, opts.column)),
      ...rod(cam, pulley, clip, 0.45, MATERIALS.metal, 6),
      ...pieces,
    ];
  };
}

/**
 * A cable crossover: a column either side, `span` from the middle and `back` behind the lifter, a
 * D-handle (or the cable's end) in each hand.
 */
export function crossover(
  height: number,
  attachment: Attachment = 'd-handle',
  opts: { span?: number; back?: number; crossed?: boolean } = {},
): PropBuilder {
  const span = opts.span ?? 82;
  const back = opts.back ?? -18;
  const columns: Record<Side, Column> = {
    r: { at: [back, 0, span], face: [0, 0, -1], height },
    l: { at: [back, 0, -span], face: [0, 0, 1], height },
  };
  // Crossed: each hand holds the cable from the far column (a rear delt fly, a Y-raise).
  const from = (side: Side): Side => (opts.crossed ? (side === 'r' ? 'l' : 'r') : side);
  return (ctx) =>
    (['r', 'l'] as const).flatMap((side) =>
      cable({ column: columns[from(side)], attachment, hold: side })(ctx),
    );
}

/** A lat pulldown station: the seat, the knee pad, and the pulley overhead from the stack in front. */
export function latPulldown(attachment: Attachment, hold: 'both' | Side = 'both'): PropBuilder {
  return ({ cam, skeleton }) => {
    const pieces: Piece[] = [];
    const stackAt: V3 = [66, 0, 0];
    pieces.push(...columnPieces(cam, { at: stackAt, face: [-1, 0, 0], height: 212 }, 226));
    // The overhead beam from the column to above the lifter, its pulley there.
    pieces.push(tube(cam, [66, 224, 0], [4, 224, 0], 2.6));
    const pulley: V3 = [6, 218, 0];
    pieces.push(
      cylinder(cam, [6, 218, -1.2], [6, 218, 1.2], 4.2, MATERIALS.iron, ART.plateHub, { bias: -1 }),
    );
    // Seat on its post, and the knee pad over the thighs.
    pieces.push(
      box(cam, [-2, 47, 0], [17, 0, 0], [0, 3, 0], [0, 0, 18], PAD, { layer: 0, bias: 1 }),
    );
    pieces.push(tube(cam, [-2, 0, 0], [-2, 44, 0], 3, { floor: true }));
    pieces.push(tube(cam, [-2, 1.5, 0], [60, 1.5, 0], 2.6, { floor: true }));
    pieces.push(tube(cam, [30, 0, 0], [30, 66, 0], 2.4));
    pieces.push(
      cylinder(cam, [24, 70, -20], [24, 70, 20], 5.2, MATERIALS.iron, ART.padTop, {
        layer: 0,
        bias: 3,
      }),
    );
    const { pieces: gear, clip } = attachmentPieces(cam, skeleton, attachment, pulley, hold);
    return [...pieces, ...rod(cam, pulley, clip, 0.45, MATERIALS.metal, 6), ...gear];
  };
}

/** A seated cable row: the long seat, the foot plate, and the low pulley in front. */
export function seatedRow(attachment: Attachment, hold: 'both' | Side = 'both'): PropBuilder {
  return ({ cam, skeleton }) => {
    const pieces: Piece[] = [];
    const column: Column = { at: [108, 0, 0], face: [-1, 0, 0], height: 28 };
    pieces.push(...columnPieces(cam, column));
    // The seat rail and pad, and the foot plate.
    pieces.push(
      box(cam, [10, 36, 0], [50, 0, 0], [0, 3, 0], [0, 0, 14], PAD, { layer: 0, bias: 1 }),
    );
    pieces.push(tube(cam, [-30, 1.5, 0], [100, 1.5, 0], 3, { floor: true }));
    for (const x of [-30, 40]) pieces.push(tube(cam, [x, 0, 0], [x, 33, 0], 2.4, { floor: true }));
    pieces.push(
      box(
        cam,
        [78, 22, 0],
        [2, 0, 0],
        [0, 18, 0],
        [0, 0, 22],
        { top: ART.frame, side: ART.frameDark, front: ART.padTop },
        { layer: 0 },
      ),
    );
    pieces.push(tube(cam, [80, 1.5, 0], [80, 10, 0], 2.4));
    const pulley = pulleyOf(column);
    const { pieces: gear, clip } = attachmentPieces(cam, skeleton, attachment, pulley, hold);
    return [...pieces, ...rod(cam, pulley, clip, 0.45, MATERIALS.metal, 6), ...gear];
  };
}

// ---------------------------------------------------------------------------------------------
// Machines

/** A padded box, `center` and its half sizes, tipped back `tilt` degrees about the left-right axis. */
export function pad(center: V3, half: V3, tilt = 0, layer: 0 | 1 = 0, bias = 1): PropBuilder {
  const t = rad(tilt);
  const ax: V3 = [Math.cos(t), Math.sin(t), 0];
  const ay: V3 = [-Math.sin(t), Math.cos(t), 0];
  return ({ cam }) => [
    box(cam, center, scale(ax, half[0]), scale(ay, half[1]), [0, 0, half[2]], PAD, { layer, bias }),
  ];
}

/** A machine's seat on a post: `at` is the middle of its top. */
export function seat(at: V3, half: { x: number; z: number } = { x: 18, z: 18 }): PropBuilder {
  return ({ cam }) => [
    box(cam, add(at, [0, -3.5, 0]), [half.x, 0, 0], [0, 3.5, 0], [0, 0, half.z], PAD, {
      layer: 0,
      bias: 1,
    }),
    // The seat's carriage and its post, standing on a foot.
    box(cam, add(at, [0, -8, 0]), [half.x * 0.7, 0, 0], [0, 1.2, 0], [0, 0, half.z * 0.7], FRAME, {
      layer: 0,
    }),
    tube(cam, [at[0], 0, at[2]], [at[0], at[1] - 8, at[2]], 3.4, { floor: true }),
    box(cam, [at[0], 1.2, at[2]], [14, 0, 0], [0, 1.2, 0], [0, 0, 12], FRAME, {
      layer: 0,
      floor: true,
    }),
  ];
}

/**
 * A back pad rising from `bottom` (the middle of its lower edge, against the seat), leaning back
 * `angle` degrees from upright.
 */
export function backPad(bottom: V3, angle = 10, length_ = 70, halfWidth = 17): PropBuilder {
  const t = rad(angle);
  const up: V3 = [-Math.sin(t), Math.cos(t), 0];
  const out: V3 = [Math.cos(t), Math.sin(t), 0];
  return ({ cam }) => {
    const center = add(add(bottom, scale(up, length_ / 2)), scale(out, -3.2));
    return [
      box(cam, center, scale(up, length_ / 2), scale(out, 3.2), [0, 0, halfWidth], PAD, {
        layer: 0,
        bias: 1.2,
      }),
      tube(cam, add(center, scale(out, -4)), [center[0] - 8, 0, 0], 2.6, { floor: true }),
    ];
  };
}

/** One straight length of a machine's frame (a rail, a handle bar), as a prop. */
export function rail(a: V3, b: V3, half = 2.6): PropBuilder {
  return ({ cam }) => [tube(cam, a, b, half, { layer: 1, bias: -30, floor: a[1] < 2 || b[1] < 2 })];
}

/** A machine's frame: tubes between the points given, in order. */
export function frame(...points: V3[]): PropBuilder {
  return ({ cam }) =>
    points
      .slice(1)
      .map((p, i) => tube(cam, points[i], p, 3, { floor: points[i][1] < 2 || p[1] < 2 }));
}

/**
 * A selectorized machine's weight stack, standing at `at` with its face toward `face`, drawn the way
 * the real towers are built: a base, four square uprights and a header with the pulley, the stack
 * of plates on its two guide rods with the selector's top plate, and the cable rising from it.
 */
export function stack(at: V3, face: V3 = [1, 0, 0], height = 150): PropBuilder {
  return ({ cam }) => {
    const f = normalize([face[0], 0, face[2]]);
    const side = normalize(cross(Y, f));
    const pieces: Piece[] = [];
    const point = (fwd: number, y: number, across_: number): V3 =>
      add(add(at, scale(f, fwd)), add([0, y, 0], scale(side, across_)));
    pieces.push(
      box(cam, point(0, 2, 0), scale(f, 15), [0, 2, 0], scale(side, 20), FRAME, {
        layer: 0,
        floor: true,
      }),
    );
    for (const a of [-17, 17]) {
      for (const fwd of [-9, 9]) {
        pieces.push(tube(cam, point(fwd, 0, a), point(fwd, height, a), 2.2, { floor: true }));
      }
    }
    pieces.push(
      box(cam, point(0, height + 3, 0), scale(f, 12), [0, 3, 0], scale(side, 20), FRAME, {
        layer: 0,
      }),
    );
    const plateHeight = 2.5;
    const gap = 0.7;
    const count = 14;
    for (let i = 0; i < count; i += 1) {
      const y = 5 + i * (plateHeight + gap) + plateHeight / 2;
      pieces.push(
        box(cam, point(0, y, 0), scale(f, 7.5), [0, plateHeight / 2, 0], scale(side, 12), {
          top: ART.plateFace,
          side: ART.plate,
          front: i % 2 ? ART.plateFace : ART.plate,
        }),
      );
    }
    const topPlate = 5 + count * (plateHeight + gap) + 1.6;
    pieces.push(
      box(cam, point(0, topPlate, 0), scale(f, 8), [0, 1.6, 0], scale(side, 12.5), FRAME, {
        layer: 0,
      }),
    );
    for (const a of [-8.5, 8.5]) {
      pieces.push(...rod(cam, point(0, 4, a), point(0, height, a), 0.7, MATERIALS.metal, 3));
    }
    pieces.push(...rod(cam, point(0, topPlate, 0), point(0, height, 0), 0.45, MATERIALS.metal, 2));
    pieces.push(
      cylinder(
        cam,
        point(-2, height - 4, 0),
        point(2, height - 4, 0),
        4.2,
        MATERIALS.iron,
        ART.plateHub,
      ),
    );
    return pieces;
  };
}

export interface LeverOptions {
  /** Plate-loaded: a horn near the end with a plate on it, on this side of the lever. */
  plates?: 'out' | 'in' | null;
  /** How far past `to` the lever runs. */
  beyond?: number;
  half?: number;
  /**
   * Whether the pivot stands on a post of its own (the default for one off the floor): false where
   * the scene's own frame already carries it.
   */
  mount?: boolean;
}

/**
 * A machine's arm, from its pivot to where the lifter moves it (a handle, a pad): a heavy square
 * tube on a bearing hub, the pivot carried on a post down to a foot on the floor -- set just
 * outside the arm, with an axle across -- so no arm hangs in the air.
 */
export function lever(pivot: V3, to: At, opts: LeverOptions = {}): PropBuilder {
  return ({ cam, skeleton }) => {
    const end = resolve(to, skeleton);
    const dir = normalize(sub(end, pivot));
    const tip = add(end, scale(dir, opts.beyond ?? 0));
    const pieces: Piece[] = [tube(cam, pivot, tip, opts.half ?? 2.9, { layer: 1, bias: -2 })];
    pieces.push(
      cylinder(
        cam,
        add(pivot, [0, 0, -5]),
        add(pivot, [0, 0, 5]),
        4.6,
        MATERIALS.iron,
        ART.plateHub,
        { bias: -2 },
      ),
    );
    if (opts.mount !== false && pivot[1] > 8) {
      const out = pivot[2] === 0 ? 0 : Math.sign(pivot[2]) * 7;
      const post: V3 = [pivot[0], 0, pivot[2] + out];
      pieces.push(tube(cam, post, [post[0], pivot[1] + 5, post[2]], 2.8, { floor: true }));
      pieces.push(
        box(cam, add(post, [0, 1.2, 0]), [10, 0, 0], [0, 1.2, 0], [0, 0, 6], FRAME, {
          layer: 0,
          floor: true,
        }),
      );
      if (out) {
        pieces.push(
          cylinder(cam, pivot, [pivot[0], pivot[1], post[2]], 2, MATERIALS.metal, METAL_END),
        );
      }
    }
    if (opts.plates) {
      const sign =
        opts.plates === 'out' ? Math.sign(pivot[2] || 1) || 1 : -(Math.sign(pivot[2] || 1) || 1);
      const hornAt = lerp3(pivot, tip, 0.7);
      const horn = add(hornAt, [0, 0, sign * 16]);
      pieces.push(cylinder(cam, hornAt, horn, 2.4, MATERIALS.metal, METAL_END));
      pieces.push(
        cylinder(
          cam,
          add(hornAt, [0, 0, sign * 6]),
          add(hornAt, [0, 0, sign * 10]),
          15.5,
          MATERIALS.iron,
          ART.plateFace,
          {
            hub: 2.4,
          },
        ),
      );
    }
    return pieces;
  };
}

/** Handles in the hands: a straight grip each, across the fist (`axis`), or neutral (palms in). */
export function grips(
  axis: 'lr' | 'fb' | 'ud' | 'neutral' = 'lr',
  sides: readonly Side[] = ['r', 'l'],
  half = 6,
): PropBuilder {
  return ({ cam, skeleton }) =>
    sides.map((side) => {
      const dir =
        axis === 'neutral' ? neutralAxis(skeleton, side) : handleDirection(skeleton, side, axis);
      const [a, b] = grip(skeleton.arms[side].end, dir, half);
      return handle(cam, a, b);
    });
}

/** A padded roller across the body at a point that moves with it (above the ankles, on the thighs). */
export function roller(at: At, halfWidth = 18, r = 4.8, axis: V3 = Z): PropBuilder {
  return ({ cam, skeleton }) => {
    const c = resolve(at, skeleton);
    return [
      cylinder(
        cam,
        add(c, scale(axis, -halfWidth)),
        add(c, scale(axis, halfWidth)),
        r,
        MATERIALS.iron,
        ART.padTop,
        {
          bias: 2,
        },
      ),
    ];
  };
}

/** A foot plate: its middle `center` (fixed, or moving with the feet), facing `normal`. */
export function footPlate(
  center: At,
  normal: V3,
  half: { w: number; h: number } = { w: 30, h: 26 },
): PropBuilder {
  return ({ cam, skeleton }) => {
    const n = normalize(normal);
    const [p1, p2] = across(n);
    const moving = typeof center === 'function';
    return [
      box(
        cam,
        resolve(center, skeleton),
        scale(n, 1.6),
        scale(p2, half.h),
        scale(p1, half.w),
        {
          top: ART.plateFace,
          side: ART.frameDark,
          front: ART.plateFace,
        },
        { layer: moving ? 1 : 0, bias: -1 },
      ),
    ];
  };
}

/** A pad that moves with the body (a sled's back pad, a lever's thigh pad): `center` and half sizes, tipped `tilt` degrees. */
export function movingPad(
  center: (s: Skeleton) => V3,
  half: V3,
  tilt: number | ((s: Skeleton) => number) = 0,
): PropBuilder {
  return ({ cam, skeleton }) => {
    const t = rad(typeof tilt === 'function' ? tilt(skeleton) : tilt);
    const ax: V3 = [Math.cos(t), Math.sin(t), 0];
    const ay: V3 = [-Math.sin(t), Math.cos(t), 0];
    return [
      box(cam, center(skeleton), scale(ax, half[0]), scale(ay, half[1]), [0, 0, half[2]], PAD, {
        layer: 1,
        bias: -1,
      }),
    ];
  };
}

/** A Smith machine: two rails either side of the bar's path (at `x`), the bar between the hands. */
export function smith(x: number, opts: { onBack?: (s: Skeleton) => V3 } = {}): PropBuilder {
  const bar = barbell({
    place: opts.onBack
      ? (s) => ({ center: opts.onBack!(s), axis: Z })
      : (s) => ({ center: mid(s.arms.r.end, s.arms.l.end), axis: Z }),
  });
  return (ctx) => {
    const { cam } = ctx;
    const pieces: Piece[] = [];
    for (const z of [-58, 58]) {
      pieces.push(tube(cam, [x, 0, z], [x, 214, z], 2.8, { layer: 1, bias: -50, floor: true }));
      pieces.push(tube(cam, [x - 26, 1.5, z], [x + 26, 1.5, z], 2.6, { floor: true }));
    }
    pieces.push(tube(cam, [x, 214, -60], [x, 214, 60], 2.8, { layer: 1, bias: -60 }));
    return [...pieces, ...bar(ctx)];
  };
}

// ---------------------------------------------------------------------------------------------
// Smaller kit

/**
 * Kettlebells in the hands, the bell hanging the way `dir` says: down, along the forearm (a
 * swing), behind the wrist (racked, or locked out overhead), or -- `auto` -- racked once the hand
 * is up near the shoulder and hanging below it.
 */
export function kettlebells(
  sides: readonly Side[] = ['r'],
  dir: 'down' | 'arm' | 'rack' | 'auto' = 'down',
): PropBuilder {
  return ({ cam, skeleton }) =>
    sides.flatMap((side) => {
      const h = skeleton.arms[side].end;
      const forearm = normalize(sub(h, skeleton.arms[side].joint));
      const racked = dir === 'rack' || (dir === 'auto' && h[1] > skeleton.shoulders[side][1] - 25);
      // Racked, the bell rests on the back of the forearm, behind and a little below the fist.
      const way: V3 = racked ? normalize([-0.7, -0.45, 0]) : dir === 'arm' ? forearm : [0, -1, 0];
      return kettlebellPieces(cam, h, way, handleDirection(skeleton, side, 'lr'));
    });
}

/** One kettlebell held in both hands by its horns (a goblet, a swing). */
export function heldKettlebell(dir: 'down' | 'arm' = 'down'): PropBuilder {
  return ({ cam, skeleton }) => {
    const h = mid(skeleton.arms.r.end, skeleton.arms.l.end);
    const forearm = normalize(sub(skeleton.arms.r.end, skeleton.arms.r.joint));
    const way: V3 = dir === 'down' ? [0, -1, 0] : forearm;
    return kettlebellPieces(cam, h, way, normalize(sub(skeleton.arms.r.end, skeleton.arms.l.end)));
  };
}

function kettlebellPieces(cam: Camera, h: V3, way: V3, across_: V3): Piece[] {
  const w = normalize(way);
  const bell = add(h, scale(w, 12));
  const pieces: Piece[] = [ball(cam, bell, 8.5, MATERIALS.iron)];
  // The handle: a bar across the fist and a horn down to the bell each side.
  const a = add(h, scale(across_, -6));
  const b = add(h, scale(across_, 6));
  pieces.push(cylinder(cam, a, b, 1.5, MATERIALS.iron, ART.plateFace, { bias: 0.3 }));
  for (const p of [a, b]) {
    const shoulder = add(add(bell, scale(sub(p, h), 0.55)), scale(w, -5));
    pieces.push(cylinder(cam, p, shoulder, 1.5, MATERIALS.iron, ART.plateFace));
  }
  return pieces;
}

/** A medicine ball between the hands (or at `at`). */
export function medicineBall(at?: (s: Skeleton) => V3, r = 11): PropBuilder {
  return ({ cam, skeleton }) => {
    const c = at ? at(skeleton) : mid(skeleton.arms.r.end, skeleton.arms.l.end);
    return [ball(cam, c, r, MATERIALS.medicineBall, 1)];
  };
}

/** A weight plate held flat in front, in both hands. */
export function heldPlate(
  face: (s: Skeleton) => V3 = (s) => s.frameAt(1).forward,
  r = 19,
): PropBuilder {
  return ({ cam, skeleton }) => {
    const c = mid(skeleton.arms.r.end, skeleton.arms.l.end);
    const n = normalize(face(skeleton));
    return [
      cylinder(
        cam,
        add(c, scale(n, -1.8)),
        add(c, scale(n, 1.8)),
        r,
        MATERIALS.iron,
        ART.plateFace,
        { hub: 2.6, bias: 0.5 },
      ),
    ];
  };
}

/** A resistance band from an anchor (or between two moving points) -- a flat, slightly stretched loop. */
export function band(from: At, to: At, r = 0.9): PropBuilder {
  return ({ cam, skeleton }) =>
    rod(cam, resolve(from, skeleton), resolve(to, skeleton), r, MATERIALS.band, 5);
}

/** A band anchored at `anchor` to each hand (rows, presses, pushdowns), with a small handle in each. */
export function bandToHands(
  anchor: V3,
  sides: readonly Side[] = ['r', 'l'],
  handles = true,
): PropBuilder {
  return ({ cam, skeleton }) =>
    sides.flatMap((side) => {
      const h = skeleton.arms[side].end;
      const pieces = rod(cam, anchor, h, 0.9, MATERIALS.band, 5);
      if (handles) {
        const [a, b] = grip(h, handleDirection(skeleton, side, 'lr'), 5);
        pieces.push(handle(cam, a, b, 1.5));
      }
      return pieces;
    });
}

/** A suspension trainer: two straps from an anchor overhead, a handle in each hand (or a foot cradle). */
export function suspension(anchor: V3, ends: 'hands' | 'feet' = 'hands'): PropBuilder {
  return ({ cam, skeleton }) => {
    const limbs = ends === 'hands' ? skeleton.arms : skeleton.legs;
    const pieces: Piece[] = [ball(cam, anchor, 2.2, MATERIALS.metal)];
    for (const side of ['r', 'l'] as const) {
      const p = limbs[side].end;
      pieces.push(...rod(cam, anchor, p, 1.2, MATERIALS.strap, 5));
      if (ends === 'hands') {
        const [a, b] = grip(p, handleDirection(skeleton, side, 'lr'), 5.5);
        pieces.push(handle(cam, a, b, 1.6));
      } else {
        pieces.push(
          cylinder(cam, add(p, [0, 4, -4]), add(p, [0, 4, 4]), 3.2, MATERIALS.strap, ART.pad, {
            bias: 0.5,
          }),
        );
      }
    }
    return pieces;
  };
}

/** Two battle ropes from an anchor on the floor, rippling up to the hands. */
export function battleRopes(anchor: V3, amplitude = 10): PropBuilder {
  return ({ cam, skeleton }) =>
    (['r', 'l'] as const).flatMap((side) => {
      const h = skeleton.arms[side].end;
      const start: V3 = [anchor[0], anchor[1], anchor[2] + (side === 'r' ? 6 : -6)];
      const n = 12;
      const pts = Array.from({ length: n + 1 }, (_, i): V3 => {
        const t = i / n;
        const p = lerp3(start, h, t);
        const wave =
          Math.sin(t * Math.PI * 3 + (side === 'r' ? 0 : Math.PI)) *
          amplitude *
          Math.sin(t * Math.PI) *
          (1 - t * 0.4);
        return [p[0], Math.max(2.5, p[1] + wave), p[2]];
      });
      return pts
        .slice(1)
        .map((p, i) => cylinder(cam, pts[i], p, 1.9, MATERIALS.rope, ART.pad, { bias: -0.3 }));
    });
}

/** A sled on the floor, its posts where the hands push (or its strap to the hands for a drag). */
export function sled(at: V3, mode: 'push' | 'drag' = 'push'): PropBuilder {
  return ({ cam, skeleton }) => {
    const pieces: Piece[] = [
      box(cam, add(at, [0, 3, 0]), [36, 0, 0], [0, 3, 0], [0, 0, 26], FRAME, {
        layer: 0,
        floor: true,
      }),
    ];
    // The plates loaded on its middle post.
    pieces.push(tube(cam, add(at, [0, 6, 0]), add(at, [0, 40, 0]), 2.2, { layer: 1, bias: 0 }));
    for (let i = 0; i < 2; i += 1) {
      pieces.push(
        cylinder(
          cam,
          add(at, [0, 8 + i * 4, 0]),
          add(at, [0, 11 + i * 4, 0]),
          21,
          MATERIALS.iron,
          ART.plateFace,
          { hub: 2.4 },
        ),
      );
    }
    if (mode === 'push') {
      for (const side of ['r', 'l'] as const) {
        const h = skeleton.arms[side].end;
        const base: V3 = [at[0] - 30, 6, h[2]];
        pieces.push(tube(cam, base, h, 2.2, { layer: 1 }));
      }
    } else {
      const h = mid(skeleton.arms.r.end, skeleton.arms.l.end);
      pieces.push(...rod(cam, add(at, [-36, 5, 0]), h, 1.2, MATERIALS.strap, 4));
      pieces.push(...grips('lr')({ cam, skeleton }));
    }
    return pieces;
  };
}

/** A trap (hex) bar between the hands, loaded. */
export function trapBar(): PropBuilder {
  return ({ cam, skeleton }) => {
    const c = mid(skeleton.arms.r.end, skeleton.arms.l.end);
    const at = (x: number, z: number): V3 => [c[0] + x, c[1], c[2] + z];
    const hex = [at(0, 42), at(30, 22), at(30, -22), at(0, -42), at(-30, -22), at(-30, 22)];
    const pieces: Piece[] = [];
    for (let i = 0; i < hex.length; i += 1) {
      pieces.push(
        cylinder(cam, hex[i], hex[(i + 1) % hex.length], 1.4, MATERIALS.metal, METAL_END, {
          bias: -0.4,
        }),
      );
    }
    for (const side of ['r', 'l'] as const) {
      const h = skeleton.arms[side].end;
      const z = h[2] > c[2] ? 1 : -1;
      pieces.push(handle(cam, add(h, [-9, 0, 0]), add(h, [9, 0, 0]), 1.7));
      pieces.push(
        cylinder(cam, add(h, [-9, 0, 0]), at(-30, 22 * z), 1.2, MATERIALS.metal, METAL_END),
      );
      pieces.push(
        cylinder(cam, add(h, [9, 0, 0]), at(30, 22 * z), 1.2, MATERIALS.metal, METAL_END),
      );
      const sleeve = at(0, 42 * z);
      pieces.push(
        cylinder(cam, sleeve, add(sleeve, [0, 0, 30 * z]), 2.5, MATERIALS.metal, METAL_END),
      );
      pieces.push(
        cylinder(
          cam,
          add(sleeve, [0, 0, 6 * z]),
          add(sleeve, [0, 0, 12 * z]),
          21,
          MATERIALS.iron,
          ART.plateFace,
          { hub: 3 },
        ),
      );
    }
    return pieces;
  };
}

/** A safety squat bar on the back: its yoke pad behind the neck and its handles forward to the hands. */
export function safetySquatBar(onBack: (s: Skeleton) => V3): PropBuilder {
  const bar = barbell({ place: (s) => ({ center: onBack(s), axis: Z }) });
  return (ctx) => {
    const { cam, skeleton } = ctx;
    const c = onBack(skeleton);
    const pieces: Piece[] = [
      box(cam, add(c, [2, 3, 0]), [5, 0, 0], [0, 3, 0], [0, 0, 16], PAD, { layer: 1, bias: 1 }),
    ];
    for (const side of ['r', 'l'] as const) {
      const h = skeleton.arms[side].end;
      const root = add(c, [3, 0, side === 'r' ? 10 : -10]);
      pieces.push(cylinder(cam, root, h, 1.5, MATERIALS.metal, METAL_END, { bias: 0.4 }));
      pieces.push(handle(cam, h, add(h, [6, -6, 0]), 1.7));
    }
    return [...bar(ctx), ...pieces];
  };
}

/** Parallel dip bars at `height`, running forward either side of the body. */
export function dipBars(height: number, halfSpan = 28, x = 0): PropBuilder {
  return ({ cam }) =>
    [-halfSpan, halfSpan].flatMap((z) => [
      cylinder(cam, [x - 30, height, z], [x + 30, height, z], 2, MATERIALS.metal, METAL_END, {
        bias: -0.5,
      }),
      tube(cam, [x - 26, 0, z], [x - 26, height, z], 2.6, { layer: 1, bias: -40, floor: true }),
      tube(cam, [x + 26, 0, z], [x + 26, height, z], 2.6, { layer: 1, bias: -40, floor: true }),
    ]);
}

/** A 45-degree back extension bench: the hip pad at `hip`, the foot plate and ankle roller below and behind. */
export function hyperextensionBench(hip: V3): PropBuilder {
  return ({ cam }) => [
    box(cam, hip, [6, 0, 0], [0, 3, 0], [0, 0, 16], PAD, { layer: 0, bias: 2 }),
    tube(cam, [hip[0] - 2, 0, 0], [hip[0] - 2, hip[1] - 3, 0], 3, { floor: true }),
    tube(cam, [hip[0] - 70, 1.5, 0], [hip[0] + 8, 1.5, 0], 2.6, { floor: true }),
    box(
      cam,
      [hip[0] - 62, 12, 0],
      [8, 0, 0],
      [0, 1.4, 0],
      [0, 0, 16],
      { top: ART.plateFace, side: ART.frameDark, front: ART.plateFace },
      { layer: 0 },
    ),
    tube(cam, [hip[0] - 66, 1.5, 0], [hip[0] - 56, 24, 0], 2.4),
    cylinder(cam, [hip[0] - 54, 26, -14], [hip[0] - 54, 26, 14], 4, MATERIALS.iron, ART.padTop, {
      layer: 0,
      bias: 2,
    }),
  ];
}
