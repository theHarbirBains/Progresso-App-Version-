import { actionLabels, returnLabel } from './actionLabels';
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

/** Which way a phase moves on screen, for the arrow beside it. */
export type PhaseDirection = 'up' | 'down' | 'left' | 'right';

export interface GuidePhase {
  /** Its name in its pill ("Setup", "Lower", "Stand"). */
  label: string;
  /** Which of the illustration's frames shows it. */
  frame: number;
  /** Which way the movement goes to reach it; none for the setup, or a scene without motion. */
  direction?: PhaseDirection;
}

function directionBetween(
  from: readonly [number, number],
  to: readonly [number, number],
): PhaseDirection | undefined {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  if (Math.hypot(dx, dy) < 4) return undefined;
  if (Math.abs(dy) >= Math.abs(dx) * 0.6) return dy > 0 ? 'down' : 'up';
  return dx > 0 ? 'right' : 'left';
}

/**
 * How to Do It's three phases: the setup, the movement and the way back -- drawn from the first
 * position again -- or, for an exercise drawn in three positions, each of them.
 */
export function guidePhases(slug: string): GuidePhase[] {
  if (!hasIllustration(slug)) return [];
  const entry = BUILTIN_CATALOG[slug];
  const labels = frameLabels(slug);
  const points = illustrationFor(slug)?.motionPoints;
  const towards = (from: number, to: number) =>
    points ? directionBetween(points[from], points[to]) : undefined;
  if (labels.length >= 3) {
    return [
      { label: 'Setup', frame: 0 },
      { label: labels[1], frame: 1, direction: towards(0, 1) },
      { label: labels[2], frame: 2, direction: towards(1, 2) },
    ];
  }
  if (labels.length === 2) {
    // A first position with a name of its own (a walking lunge's Lunge) is the way back too.
    const back =
      labels[0] === 'Start'
        ? returnLabel(slug, entry.pattern, entry.equipment, labels[1])
        : labels[0];
    return [
      { label: 'Setup', frame: 0 },
      { label: labels[1], frame: 1, direction: towards(0, 1) },
      { label: back, frame: 0, direction: towards(1, 0) },
    ];
  }
  return [
    { label: 'Setup', frame: 0 },
    { label: 'Hold', frame: 0 },
    { label: 'Finish', frame: 0 },
  ];
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
