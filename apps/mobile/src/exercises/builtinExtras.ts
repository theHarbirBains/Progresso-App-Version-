import { useEffect, useState } from 'react';
import type { Equipment } from './equipment';
import type { MeasurementType, MovementType } from './movementTypes';
import type { MuscleGroup } from './muscleGroups';

// What the built-in library knows beyond a row: each built-in's illustration slug, the muscles it
// also works, its other names, and its guide. Held here, with no Supabase client of its own, so
// the components that show it (ExercisePhoto, the guide sheet) can be shown -- and tested --
// anywhere: the reads themselves are plugged in by exerciseGuide.ts (setBuiltinSources), which
// the exercise queries load. Until something is read, everything shows as it always did.

export interface BuiltinExtras {
  slug: string;
  secondaryMuscleGroups: MuscleGroup[];
  searchAliases: string[];
  movementPattern: string | null;
  /** A hosted image to show in place of the drawn illustration, when one has been added. */
  illustrationUrl: string | null;
}

export interface ExerciseGuide {
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment | null;
  movementType: MovementType;
  measurementType: MeasurementType;
  slug: string | null;
  secondaryMuscleGroups: MuscleGroup[];
  movementPattern: string | null;
  summary: string | null;
  setupSteps: string[];
  executionSteps: string[];
  commonMistakes: string[];
  illustrationUrl: string | null;
}

interface Sources {
  extras: () => Promise<Map<string, BuiltinExtras>>;
  guide: (exerciseId: string) => Promise<ExerciseGuide | null>;
}

let sources: Sources | null = null;
let extras: Map<string, BuiltinExtras> | null = null;
let reading: Promise<Map<string, BuiltinExtras>> | null = null;
const guides = new Map<string, ExerciseGuide>();
const listeners = new Set<() => void>();

/** Plugs in where the extras and guides are read from (exerciseGuide.ts; a test's stand-in). */
export function setBuiltinSources(next: Sources | null): void {
  sources = next;
}

/** Every built-in's extras by exercise id, read once a session (a failed read is tried again next time). */
export function loadBuiltinExtras(): Promise<Map<string, BuiltinExtras>> {
  if (extras) return Promise.resolve(extras);
  if (reading) return reading;
  if (!sources) return Promise.resolve(new Map());
  const read = sources.extras;
  reading = (async () => {
    try {
      const map = await read();
      extras = map;
      listeners.forEach((notify) => notify());
      return map;
    } catch {
      return new Map<string, BuiltinExtras>();
    } finally {
      reading = null;
    }
  })();
  return reading;
}

/** One exercise's extras (null for a person's own exercise, or until they're read). */
export function useBuiltinExtras(exerciseId: string | null | undefined): BuiltinExtras | null {
  const [, setVersion] = useState(0);
  useEffect(() => {
    if (!exerciseId) return;
    const notify = () => setVersion((v) => v + 1);
    listeners.add(notify);
    if (!extras) void loadBuiltinExtras();
    return () => {
      listeners.delete(notify);
    };
  }, [exerciseId]);
  return exerciseId ? (extras?.get(exerciseId) ?? null) : null;
}

/** One exercise's whole guide, kept for the session (built-ins only change with a release). */
export async function readExerciseGuide(exerciseId: string): Promise<ExerciseGuide | null> {
  const known = guides.get(exerciseId);
  if (known) return known;
  if (!sources) throw new Error('Guides are not available.');
  const guide = await sources.guide(exerciseId);
  if (guide) guides.set(exerciseId, guide);
  return guide;
}

/** For tests: forget everything read. */
export function forgetBuiltinExtras(): void {
  extras = null;
  reading = null;
  guides.clear();
}
