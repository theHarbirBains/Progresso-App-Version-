import { BACK_ART } from './art/back';
import { CORE_ART } from './art/core';
import { LEGS_ART } from './art/legs';
import { LYING_ART } from './art/lying';
import { UPPER_ART } from './art/upper';
import { BUILTIN_CATALOG } from './builtinCatalog.generated';
import type { MuscleGroup } from '../muscleGroups';
import { legendGroups, renderMuscleMap, type MuscleMapView } from './muscleMap';
import { renderScene, type RenderedScene, type SceneSpec } from './render';

// Every built-in exercise's illustration, by its slug (`exercises.slug`): its poses and equipment
// here, its highlighted muscles in the generated catalogue. Drawn once each and remembered for the
// session -- a library list draws many small ones as it scrolls.

export const EXERCISE_ART: Record<string, SceneSpec> = {
  ...LYING_ART,
  ...UPPER_ART,
  ...BACK_ART,
  ...LEGS_ART,
  ...CORE_ART,
};

const drawn = new Map<string, RenderedScene>();
const thumbs = new Map<string, RenderedScene>();

/** Whether a slug has an illustration. */
export function hasIllustration(slug: string | null | undefined): slug is string {
  return !!slug && slug in EXERCISE_ART && slug in BUILTIN_CATALOG;
}

/** The whole illustration -- every frame, with its motion arrows -- or null when there's none. */
export function illustrationFor(slug: string | null | undefined): RenderedScene | null {
  if (!hasIllustration(slug)) return null;
  let scene = drawn.get(slug);
  if (!scene) {
    scene = renderScene(EXERCISE_ART[slug], BUILTIN_CATALOG[slug].highlight);
    drawn.set(slug, scene);
  }
  return scene;
}

/** Just the last frame (where the movement ends up), framed on its own, for a small thumbnail. */
export function thumbnailFor(slug: string | null | undefined): RenderedScene | null {
  if (!hasIllustration(slug)) return null;
  let scene = thumbs.get(slug);
  if (!scene) {
    const spec = EXERCISE_ART[slug];
    scene = renderScene(
      { ...spec, motion: undefined, frames: [spec.frames[spec.frames.length - 1]] },
      BUILTIN_CATALOG[slug].highlight,
      { flat: true },
    );
    thumbs.set(slug, scene);
  }
  return scene;
}

/** What each frame of an illustration is called under it. */
export function frameLabels(count: number): string[] {
  if (count <= 1) return ['Hold'];
  if (count === 2) return ['Start', 'Finish'];
  return Array.from({ length: count }, (_, i) =>
    i === 0 ? 'Start' : i === count - 1 ? 'Finish' : `Step ${i + 1}`,
  );
}

export interface MuscleMap {
  views: MuscleMapView[];
  /** The muscle groups its key names, primary and secondary. */
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
}

const maps = new Map<string, MuscleMap>();

/** The grey anatomy figure with the exercise's worked muscles coloured, and its key. */
export function muscleMapFor(slug: string | null | undefined): MuscleMap | null {
  if (!hasIllustration(slug)) return null;
  let map = maps.get(slug);
  if (!map) {
    const entry = BUILTIN_CATALOG[slug];
    map = {
      views: renderMuscleMap(entry.highlight),
      ...legendGroups(entry.highlight, entry.muscle as MuscleGroup),
    };
    maps.set(slug, map);
  }
  return map;
}
