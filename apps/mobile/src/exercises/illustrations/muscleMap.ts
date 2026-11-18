import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../muscleGroups';
import { REGION_GROUP, REGION_NAMES, type MuscleHighlight, type MuscleRegion } from './muscles';
import { hands, stance } from './poseKit';
import { renderScene, type RenderedFrame, type ViewBox } from './render';
import type { PoseSpec } from './rig';

// The anatomy figure beside an exercise's drawing: the instructor's own body, bare and grey, head
// to toe, standing easy with every muscle marked out and the worked ones coloured -- primary red,
// secondary yellow -- from the front and from behind, side by side.

const STANDING: PoseSpec = {
  pelvis: [0, 94, 0],
  hands: hands({ at: [2, 92, 31], pole: [-1, -0.2, 0.3] }),
  feet: stance(11, 0, 6),
};

export interface MuscleMapView {
  side: 'front' | 'back';
  frame: RenderedFrame;
  viewBox: ViewBox;
}

/**
 * The anatomy figure for a set of highlighted muscles, head to toe: from the front and from behind,
 * side by side, so every worked muscle shows on one or the other.
 */
export function renderMuscleMap(highlight: MuscleHighlight): MuscleMapView[] {
  return (['front', 'back'] as const).map((side) => {
    const drawn = renderScene(
      { view: { yaw: side === 'front' ? -90 : 90, tilt: 0 }, frames: [{ pose: STANDING }] },
      highlight,
      { anatomy: true },
    );
    return { side, frame: drawn.frames[0], viewBox: drawn.viewBox };
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

/**
 * The muscles the key names, one per line: the primary ones (those of the exercise's own muscle
 * group first), then the secondary ones not already named. An incline works the upper chest and a
 * decline the lower; the front and side delts together are the shoulders.
 */
export function legendNames(
  highlight: MuscleHighlight,
  muscle: MuscleGroup,
  exerciseName: string,
): { primary: string[]; secondary: string[] } {
  const nameOf = (region: MuscleRegion): string =>
    region === 'chest' && /incline/i.test(exerciseName)
      ? 'Chest (Upper)'
      : region === 'chest' && /decline/i.test(exerciseName)
        ? 'Chest (Lower)'
        : REGION_NAMES[region];
  const names = (regions: readonly MuscleRegion[], taken: readonly string[]): string[] => {
    const out: string[] = [];
    for (const region of regions) {
      const name = nameOf(region);
      const merged = region === 'sideDelts' && regions.includes('frontDelts');
      if (!merged && !out.includes(name) && !taken.includes(name)) out.push(name);
    }
    return out;
  };
  const own = highlight.primary.filter((r) => REGION_GROUP[r] === muscle);
  const rest = highlight.primary.filter((r) => REGION_GROUP[r] !== muscle);
  const primary = names([...own, ...rest], []);
  if (own.length === 0) primary.unshift(MUSCLE_GROUP_LABELS[muscle]);
  return { primary, secondary: names(highlight.secondary, primary) };
}
