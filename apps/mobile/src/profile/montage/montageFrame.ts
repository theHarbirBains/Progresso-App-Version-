import type { MontageFrame } from '../../lib/api';

// Where a montage's photo sits in its panel. A panel leans, so its picture is drawn upright in a
// box wide enough to reach each slanted edge -- always the same shape, whatever the phone -- and
// the photo covers that box. Its owner can move and zoom it there (20261206100000): the frame is
// the point of the photo at the box's middle and how far it's zoomed in past just covering it,
// so it reads the same at any size, in the strip or the editor. With none, it's centred (a tall
// photo toward its top, where a face usually is).

/** The strip's height for its width -- the reference's proportions. */
export const HEIGHT_RATIO = 0.235;
/** How far each panel leans, degrees. */
export const SKEW = 12;
/** How far a photo can be zoomed in its panel. */
export const MAX_FRAME_ZOOM = 4;

/** How much wider a panel's picture box is than the panel, for its height. */
export function leanFor(height: number): number {
  return height * Math.tan((SKEW * Math.PI) / 180);
}

/** A panel's picture box, width over height: a quarter of the strip, and its lean. */
export const PICTURE_BOX_ASPECT = (0.25 + leanFor(HEIGHT_RATIO)) / HEIGHT_RATIO;

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Size {
  left: number;
  top: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** The photo's size just covering the box. */
function coverSize(box: Size, photo: Size): Size {
  const scale = Math.max(box.width / photo.width, box.height / photo.height);
  return { width: photo.width * scale, height: photo.height * scale };
}

/**
 * Where a photo sits in a panel's picture box: covering it, zoomed and centred on its frame's
 * point as near as it can be without leaving a gap -- or, with no frame, the automatic framing.
 */
export function framedRect(box: Size, photo: Size, frame: MontageFrame | null): Rect {
  const cover = coverSize(box, photo);
  if (!frame) {
    const tall = photo.height > photo.width * 1.1;
    return {
      ...cover,
      left: (box.width - cover.width) / 2,
      top: (box.height - cover.height) * (tall ? 0.25 : 0.5),
    };
  }
  const zoom = clamp(frame.zoom, 1, MAX_FRAME_ZOOM);
  const width = cover.width * zoom;
  const height = cover.height * zoom;
  return {
    width,
    height,
    left: clamp(box.width / 2 - frame.x * width, box.width - width, 0),
    top: clamp(box.height / 2 - frame.y * height, box.height - height, 0),
  };
}

/** The frame that puts the photo where `rect` has it, rounded as it's kept. */
export function frameOf(box: Size, photo: Size, rect: Rect): MontageFrame {
  const round = (value: number, places: number) => Number(value.toFixed(places));
  return {
    x: round(clamp((box.width / 2 - rect.left) / rect.width, 0, 1), 4),
    y: round(clamp((box.height / 2 - rect.top) / rect.height, 0, 1), 4),
    zoom: round(clamp(rect.width / coverSize(box, photo).width, 1, MAX_FRAME_ZOOM), 2),
  };
}

/** A photo's size as kept, when it's known. */
export function photoSize(item: { width: number | null; height: number | null }): Size | null {
  return item.width && item.height ? { width: item.width, height: item.height } : null;
}

/** The automatic framing, as a frame -- where moving or zooming a photo with none starts from. */
export function automaticFrame(box: Size, photo: Size): MontageFrame {
  return frameOf(box, photo, framedRect(box, photo, null));
}

/**
 * A frame moved by (dx, dy) on screen -- the photo following the finger -- and zoomed by `scale`
 * about the panel's middle, from `start`; never past the photo's edges or the zoom's limits.
 */
export function movedFrame(
  box: Size,
  photo: Size,
  start: MontageFrame,
  dx: number,
  dy: number,
  scale = 1,
): MontageFrame {
  const zoom = clamp(start.zoom * scale, 1, MAX_FRAME_ZOOM);
  const cover = coverSize(box, photo);
  const moved = {
    x: start.x - dx / (cover.width * zoom),
    y: start.y - dy / (cover.height * zoom),
    zoom,
  };
  return frameOf(box, photo, framedRect(box, photo, moved));
}
