import { actionLabels } from './actionLabels';
import { BACK_ART } from './art/back';
import { CABLE_ART } from './art/cable';
import { CORE_ART } from './art/core';
import { EXTRAS_ART } from './art/extras';
import { KETTLEBELL_ART } from './art/kettlebell';
import { LEGS_ART } from './art/legs';
import { LYING_ART } from './art/lying';
import { MACHINE_ART } from './art/machines';
import { SMITH_ART } from './art/smith';
import { UPPER_ART } from './art/upper';
import { BUILTIN_CATALOG } from './builtinCatalog.generated';
import type { MuscleGroup } from '../muscleGroups';
import { legendGroups, legendNames, renderMuscleMap, type MuscleMapView } from './muscleMap';
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
  ...CABLE_ART,
  ...MACHINE_ART,
  ...SMITH_ART,
  ...KETTLEBELL_ART,
  ...EXTRAS_ART,
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

/** What each frame of an exercise's illustration is called under it ("Start", "Press"). */
export function frameLabels(slug: string): string[] {
  if (!hasIllustration(slug)) return [];
  const entry = BUILTIN_CATALOG[slug];
  return actionLabels(slug, entry.pattern, EXERCISE_ART[slug].frames.length, entry.action);
}

export interface MuscleMap {
  views: MuscleMapView[];
  /** The muscle groups it works, primary and secondary. */
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  /** What its key names, one per line ("Chest (Upper)", "Shoulders"). */
  primaryNames: string[];
  secondaryNames: string[];
}

const maps = new Map<string, MuscleMap>();

/** The grey anatomy figure with the exercise's worked muscles coloured, and its key. */
export function muscleMapFor(slug: string | null | undefined): MuscleMap | null {
  if (!hasIllustration(slug)) return null;
  let map = maps.get(slug);
  if (!map) {
    const entry = BUILTIN_CATALOG[slug];
    const names = legendNames(entry.highlight, entry.muscle as MuscleGroup, entry.name);
    map = {
      views: renderMuscleMap(entry.highlight),
      ...legendGroups(entry.highlight, entry.muscle as MuscleGroup),
      primaryNames: names.primary,
      secondaryNames: names.secondary,
    };
    maps.set(slug, map);
  }
  return map;
}
