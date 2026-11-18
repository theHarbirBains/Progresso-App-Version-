import { useEffect, useState } from 'react';

// A person's own photos of the machines they use for built-in exercises
// (20261203100000_builtin_exercise_photos.sql): each shown in place of that built-in's drawing
// wherever they see it -- the library, the picker, its page, the live workout. Held here, with no
// Supabase client of its own (like builtinExtras.ts), so the components that show them can be shown
// and tested anywhere; ownPhotoQueries.ts plugs the reads and writes in. Read once a sign-in,
// forgotten at sign-out; until it's plugged in or read, nothing changes.

export interface OwnPhotoSource {
  /** Every photo of the signed-in person's, by exercise id. */
  read: () => Promise<Map<string, string>>;
  /** Uploads a picked photo (a local file) and keeps it for this exercise; its URL. */
  save: (exerciseId: string, localUri: string) => Promise<string>;
  remove: (exerciseId: string) => Promise<void>;
}

let source: OwnPhotoSource | null = null;
let photos: Map<string, string> | null = null;
// Whether they could be read: until then (say, before the table exists) nothing offers to add one.
let readable = false;
let reading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Plugs in where the photos are read from and saved to (ownPhotoQueries.ts; a test's stand-in). */
export function setOwnPhotoSource(next: OwnPhotoSource | null): void {
  source = next;
  forgetOwnPhotos();
}

function load(): void {
  if (photos || reading || !source) return;
  const read = source.read;
  reading = (async () => {
    try {
      photos = await read();
      readable = true;
      notify();
    } catch {
      // Non-critical (say, before the table exists): built-ins show their drawings as always.
    } finally {
      reading = null;
    }
  })();
}

/** The person's own photo for a built-in, or null. */
export function useOwnPhoto(exerciseId: string | null | undefined): string | null {
  const [, setVersion] = useState(0);
  useEffect(() => {
    if (!exerciseId) return;
    const listener = () => setVersion((v) => v + 1);
    listeners.add(listener);
    load();
    return () => {
      listeners.delete(listener);
    };
  }, [exerciseId]);
  return exerciseId ? (photos?.get(exerciseId) ?? null) : null;
}

/** Whether a photo of your own can be added here: the source is plugged in and could be read. */
export function canKeepOwnPhotos(): boolean {
  return source !== null && readable;
}

/** Saves a picked photo as this built-in's, shown everywhere at once. */
export async function saveOwnPhoto(exerciseId: string, localUri: string): Promise<void> {
  if (!source) throw new Error('Photos are not available.');
  const url = await source.save(exerciseId, localUri);
  photos = new Map(photos ?? []);
  photos.set(exerciseId, url);
  notify();
}

/** Removes the built-in's photo; its drawing shows again. */
export async function removeOwnPhoto(exerciseId: string): Promise<void> {
  if (!source) throw new Error('Photos are not available.');
  await source.remove(exerciseId);
  photos = new Map(photos ?? []);
  photos.delete(exerciseId);
  notify();
}

/** Forgets everything read: at sign-out or sign-in, and for tests. */
export function forgetOwnPhotos(): void {
  photos = null;
  readable = false;
  reading = null;
  notify();
}
