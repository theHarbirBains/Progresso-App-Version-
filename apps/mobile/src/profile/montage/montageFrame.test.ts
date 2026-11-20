import {
  automaticFrame,
  framedRect,
  frameOf,
  MAX_FRAME_ZOOM,
  movedFrame,
  photoSize,
  PICTURE_BOX_ASPECT,
} from './montageFrame';

const box = { width: 128, height: 100 };
const wide = { width: 1600, height: 1200 };
const tall = { width: 1200, height: 1600 };

/** Whether a picture placed at `rect` covers the box with no gap. */
function covers(rect: { left: number; top: number; width: number; height: number }) {
  return (
    rect.left <= 0.001 &&
    rect.top <= 0.001 &&
    rect.left + rect.width >= box.width - 0.001 &&
    rect.top + rect.height >= box.height - 0.001
  );
}

describe('a montage photo in its panel', () => {
  it("is placed in a box of the panel's own shape, a quarter of the strip and its lean", () => {
    // 0.25 of the strip wide plus the lean, over 0.235 of it tall.
    expect(PICTURE_BOX_ASPECT).toBeCloseTo((0.25 + 0.235 * Math.tan((12 * Math.PI) / 180)) / 0.235);
  });

  it('is centred by itself, a tall photo toward its top, covering the panel', () => {
    const across = framedRect(box, wide, null);
    expect(covers(across)).toBe(true);
    expect(across.left).toBeCloseTo((box.width - across.width) / 2);
    expect(across.top).toBeCloseTo(0);

    const upright = framedRect(box, tall, null);
    expect(covers(upright)).toBe(true);
    expect(upright.top).toBeCloseTo((box.height - upright.height) * 0.25);
  });

  it("is placed on its frame's point, zoomed, never leaving a gap at an edge", () => {
    const placed = framedRect(box, tall, { x: 0.5, y: 0.5, zoom: 2 });
    expect(placed.width).toBeCloseTo(256);
    expect(placed.left + placed.width / 2).toBeCloseTo(box.width / 2);

    // Its point as far to a corner as can be: the photo's corner meets the panel's.
    const corner = framedRect(box, tall, { x: 0, y: 0, zoom: 1 });
    expect(corner.left).toBeCloseTo(0);
    expect(corner.top).toBeCloseTo(0);
    expect(covers(framedRect(box, tall, { x: 1, y: 1, zoom: 3 }))).toBe(true);
  });

  it('reads back as the frame that placed it', () => {
    const frame = { x: 0.4, y: 0.35, zoom: 1.5 };
    expect(frameOf(box, wide, framedRect(box, wide, frame))).toEqual(frame);
    // And at any size of the same shape: the strip's panel or the editor's.
    const large = { width: box.width * 3, height: box.height * 3 };
    expect(frameOf(large, wide, framedRect(large, wide, frame))).toEqual(frame);
  });

  it('follows a finger, zooms between its limits, and stops at the photo’s edges', () => {
    const start = { x: 0.5, y: 0.5, zoom: 2 };
    const before = framedRect(box, wide, start);
    const after = framedRect(box, wide, movedFrame(box, wide, start, 10, -6));
    expect(after.left - before.left).toBeCloseTo(10, 1);
    expect(after.top - before.top).toBeCloseTo(-6, 1);

    expect(movedFrame(box, wide, start, 0, 0, 10).zoom).toBe(MAX_FRAME_ZOOM);
    expect(movedFrame(box, wide, start, 0, 0, 0.1).zoom).toBe(1);
    expect(covers(framedRect(box, wide, movedFrame(box, wide, start, 5000, 5000)))).toBe(true);
  });

  it('starts from the automatic framing when it has none', () => {
    const automatic = automaticFrame(box, tall);
    expect(automatic.zoom).toBe(1);
    expect(framedRect(box, tall, automatic).top).toBeCloseTo(framedRect(box, tall, null).top, 1);
  });

  it('can only be framed with its size known', () => {
    expect(photoSize({ width: 10, height: 20 })).toEqual({ width: 10, height: 20 });
    expect(photoSize({ width: null, height: 20 })).toBeNull();
  });
});
