import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useSyncExternalStore } from 'react';

// The live workout's set timers, for a timed exercise (a plank, a wall sit): start, pause,
// resume, and finish with the set's check. A timer is a moment and a total, never a counter
// that ticks: `startedAt` is the wall-clock time it last started (null while paused) and
// `elapsedMs` what it had run before that, so the time is right however long the app was in
// the background, the phone locked, or the page left -- and a screen that remounts finds its
// timers where they were. Kept on the device for the workout like the typed drafts
// (liveWorkoutDraft.ts), so a closed app carries on too. Nothing here is saved to the server:
// finishing a set saves its time as the set's duration, like a typed one.

export interface SetTimer {
  /** When it last started (ms since the epoch); null while paused. */
  startedAt: number | null;
  /** What it ran before it last started. */
  elapsedMs: number;
}

type Timers = Record<string, SetTimer>;

const keyFor = (workoutId: string) => `@progresso/setTimers/${workoutId}`;

let openWorkoutId: string | null = null;
let timers: Timers = {};
const listeners = new Set<() => void>();

function changed(next: Timers) {
  timers = next;
  for (const listener of listeners) listener();
  if (openWorkoutId) {
    const key = keyFor(openWorkoutId);
    void AsyncStorage.setItem(key, JSON.stringify(timers)).catch(() => undefined);
  }
}

function isTimer(value: unknown): value is SetTimer {
  if (!value || typeof value !== 'object') return false;
  const { startedAt, elapsedMs } = value as Record<string, unknown>;
  return (
    (startedAt === null || (typeof startedAt === 'number' && Number.isFinite(startedAt))) &&
    typeof elapsedMs === 'number' &&
    Number.isFinite(elapsedMs) &&
    elapsedMs >= 0
  );
}

/** Whole seconds a timer has run, as of `now`. */
export function timerSeconds(timer: SetTimer, now: number = Date.now()): number {
  const running = timer.startedAt !== null ? Math.max(0, now - timer.startedAt) : 0;
  return Math.floor((timer.elapsedMs + running) / 1000);
}

/**
 * Opens a live workout's timers, read back from the device: a set that was being timed when the
 * app closed is still being timed. Another workout's timers are let go (they stay on the device
 * until that workout is finished or cancelled).
 */
export async function openSetTimers(workoutId: string): Promise<void> {
  if (openWorkoutId === workoutId) return;
  openWorkoutId = workoutId;
  timers = {};
  for (const listener of listeners) listener();
  try {
    const raw = await AsyncStorage.getItem(keyFor(workoutId));
    if (!raw || openWorkoutId !== workoutId) return;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    const read: Timers = {};
    for (const [setId, timer] of Object.entries(parsed as Record<string, unknown>)) {
      if (isTimer(timer)) read[setId] = timer;
    }
    timers = { ...read, ...timers };
    for (const listener of listeners) listener();
  } catch {
    // Non-critical: a set's time can still be typed.
  }
}

/** Starts a set's timer, or resumes it from where it was paused. */
export function startSetTimer(setId: string, now: number = Date.now()): void {
  const timer = timers[setId];
  if (timer?.startedAt != null) return;
  changed({ ...timers, [setId]: { startedAt: now, elapsedMs: timer?.elapsedMs ?? 0 } });
}

/** Pauses a set's timer, keeping its time. Returns the seconds so far, or null with no timer. */
export function pauseSetTimer(setId: string, now: number = Date.now()): number | null {
  const timer = timers[setId];
  if (!timer) return null;
  if (timer.startedAt === null) return timerSeconds(timer, now);
  const elapsedMs = timer.elapsedMs + Math.max(0, now - timer.startedAt);
  changed({ ...timers, [setId]: { startedAt: null, elapsedMs } });
  return Math.floor(elapsedMs / 1000);
}

/** Ends a set's timer -- the set is finished with this time. Returns its seconds, or null with no timer. */
export function stopSetTimer(setId: string, now: number = Date.now()): number | null {
  const timer = timers[setId];
  if (!timer) return null;
  const { [setId]: _stopped, ...rest } = timers;
  changed(rest);
  return timerSeconds(timer, now);
}

/** Drops a set's timer without using its time: the set was removed, or its time typed instead. */
export function discardSetTimer(setId: string): void {
  if (!timers[setId]) return;
  const { [setId]: _dropped, ...rest } = timers;
  changed(rest);
}

/** Forgets a workout's timers once it's finished or cancelled. */
export async function clearSetTimers(workoutId: string): Promise<void> {
  if (openWorkoutId === workoutId) {
    openWorkoutId = null;
    timers = {};
    for (const listener of listeners) listener();
  }
  try {
    await AsyncStorage.removeItem(keyFor(workoutId));
  } catch {
    // Non-critical.
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A set's timer, if it has one; re-renders only when it starts, pauses or ends. */
export function useSetTimer(setId: string): SetTimer | undefined {
  return useSyncExternalStore(subscribe, () => timers[setId]);
}

/** The time now, moving on while `running` -- only to redraw a running timer; the time itself comes from the timer. */
export function useTimerClock(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return undefined;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [running]);
  return now;
}
