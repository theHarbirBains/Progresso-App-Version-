import type { MuscleGroup } from '../muscleGroups';
import { REGION_GROUP, type MuscleHighlight, type MuscleRegion } from './muscles';
import { hands, stance } from './poseKit';
import { renderScene, type RenderedFrame, type ViewBox } from './render';
import type { PoseSpec } from './rig';

// The anatomy figure beside an exercise's drawing: the instructor's own body, bare and grey,
// standing easy with its worked muscles coloured -- primary red, secondary yellow. It's seen from
// the front, from behind, or both, as the muscles need, and cropped to the upper or the lower body
// when they're all in one half (a bench press shows the chest and shoulders, like a bust).

const STANDING: PoseSpec = {
  pelvis: [0, 94, 0],
  hands: hands({ at: [2, 92, 31], pole: [-1, -0.2, 0.3] }),
  feet: stance(11, 0, 6),
};

/** Muscles that face the front, and the back (the side delts and forearms show from either). */
const FRONT: ReadonlySet<MuscleRegion> = new Set([
  'chest',
  'frontDelts',
  'sideDelts',
  'biceps',
  'forearms',
  'abs',
  'obliques',
  'quads',
  'adductors',
  'tibialis',
]);
const BACK: ReadonlySet<MuscleRegion> = new Set([
  'rearDelts',
  'triceps',
  'traps',
  'upperBack',
  'lats',
  'lowerBack',
  'glutes',
  'hamstrings',
  'calves',
]);
const LOWER_BODY: ReadonlySet<MuscleRegion> = new Set([
  'glutes',
  'quads',
  'hamstrings',
  'adductors',
  'calves',
  'tibialis',
]);
export interface MuscleMapView {
  side: 'front' | 'back';
  frame: RenderedFrame;
  viewBox: ViewBox;
}

/** The views a set of muscles shows in: from the front, from behind, or both. */
function sidesFor(regions: readonly MuscleRegion[]): ('front' | 'back')[] {
  const sides: ('front' | 'back')[] = [];
  if (regions.some((r) => FRONT.has(r))) sides.push('front');
  if (regions.some((r) => BACK.has(r))) sides.push('back');
  return sides;
}

/**
 * Which views to show and how much of the body: what the primary muscles need -- the views they
 * show in, and the upper or lower body alone when they're all in that half. The key names the rest.
 */
export function mapLayout(highlight: MuscleHighlight): {
  sides: ('front' | 'back')[];
  crop: 'upper' | 'lower' | 'full';
} {
  const regions = [...highlight.primary, ...highlight.secondary];
  const primarySides = sidesFor(highlight.primary);
  const sides = primarySides.length > 0 ? primarySides : sidesFor(regions);
  const lower = highlight.primary.some((r) => LOWER_BODY.has(r));
  const upper = highlight.primary.some((r) => !LOWER_BODY.has(r));
  return {
    sides: sides.length > 0 ? sides : ['front'],
    crop: lower && upper ? 'full' : lower ? 'lower' : 'upper',
  };
}

/** The anatomy figure for a set of highlighted muscles. */
export function renderMuscleMap(highlight: MuscleHighlight): MuscleMapView[] {
  const { sides, crop } = mapLayout(highlight);
  return sides.map((side) => {
    const drawn = renderScene(
      { view: { yaw: side === 'front' ? -90 : 90, tilt: 0 }, frames: [{ pose: STANDING }] },
      highlight,
      { anatomy: true },
    );
    const vb = drawn.viewBox;
    // Screen y runs down: the head is near -175, the hips near -90, the feet near 0.
    const top = crop === 'lower' ? -116 : vb.y;
    const bottom = crop === 'upper' ? -82 : vb.y + vb.height;
    return {
      side,
      frame: drawn.frames[0],
      viewBox: { x: vb.x, y: top, width: vb.width, height: bottom - top },
    };
  });
}

/** The muscle groups the key names: the primary ones, then the secondary ones not already named. */
export function legendGroups(
  highlight: MuscleHighlight,
  muscle: MuscleGroup,
): { primary: MuscleGroup[]; secondary: MuscleGroup[] } {
  const primary: MuscleGroup[] = [muscle];
  for (const region of highlight.primary) {
    const group = REGION_GROUP[region];
    if (!primary.includes(group)) primary.push(group);
  }
  const secondary: MuscleGroup[] = [];
  for (const region of highlight.secondary) {
    const group = REGION_GROUP[region];
    if (!primary.includes(group) && !secondary.includes(group)) secondary.push(group);
  }
  return { primary, secondary };
}
