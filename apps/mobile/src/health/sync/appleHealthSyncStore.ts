import { useSyncExternalStore } from 'react';
import {
  disconnectAppleHealth,
  importAppleHealth,
  type AppleHealthImport,
  type AppleHealthTrigger,
} from '../../lib/healthDataApi';
import { supabase } from '../../lib/supabase';
import {
  appleHealthAsked,
  appleHealthAvailable,
  appleHealthReadable,
  askForAppleHealth,
  readAppleHealth,
  startBackgroundSync,
  stopBackgroundSync,
  type AppleHealthRead,
} from './appleHealthRead';
import { localDayKey } from './sleepNights';

// Apple Health sync (Phase 3 of the Health & Wearables brief, development builds only for now --
// APPLE_HEALTH_SYNC_ENABLED): what's read, when, and what Health shows of it. One store for the
// app: AppleHealthSync (mounted once) keeps it in step with sign-in, the app coming to the front
// and HealthKit's wake-ups; Connect Apple Health and Devices read it and act through it.
//
// - Connecting asks iPhone to read Health's types, then brings in the last 90 days.
// - After that each sync re-reads from two days before the last one (a watch can sync late), as
//   the app opens or comes back to the front (at most every 15 minutes) and when HealthKit wakes it
//   (at most every couple of minutes, never while the phone is locked -- Apple Health can't be read
//   then).
// - It only ever syncs on an iPhone that has asked: a new phone without permission would read
//   nothing and clear what's kept.
// - The server saves each sync whole and refuses a bad reading on its own; a retry never doubles.

export const DAYS_ON_CONNECT = 90;
/** How far before the last sync each sync looks again, for late watch syncs and edits. */
export const RECHECK_DAYS = 2;
const OPEN_SYNC_EVERY_MS = 15 * 60 * 1000;
const BACKGROUND_SYNC_EVERY_MS = 2 * 60 * 1000;

export interface AppleHealthConnection {
  status: 'connected' | 'syncing' | 'permission_required' | 'error' | 'disconnected';
  devices: string[];
  connectedAt: string;
  lastSyncedAt: string | null;
  lastError: string | null;
}

/** A metric's latest day, as stored from Apple Health. */
export interface LatestHealthValue {
  metric: string;
  day: string;
  value: number;
}

export interface AppleHealthSyncState {
  /** Whether Apple Health can be read here (null until checked). */
  available: boolean | null;
  /** Whether this iPhone has asked to read Health's types (null until checked). */
  asked: boolean | null;
  /** Their Apple Health connection on the server; null if they've never connected. */
  connection: AppleHealthConnection | null;
  loaded: boolean;
  phase: 'idle' | 'asking' | 'syncing' | 'disconnecting';
  lastSync: { at: string; upserted: number; refused: number; trigger: AppleHealthTrigger } | null;
  /** Why the last attempt failed, shown -- never hidden. */
  error: string | null;
  /** Each metric's latest value from the last week, as stored. */
  latest: LatestHealthValue[];
}

const INITIAL: AppleHealthSyncState = {
  available: null,
  asked: null,
  connection: null,
  loaded: false,
  phase: 'idle',
  lastSync: null,
  error: null,
  latest: [],
};

let state: AppleHealthSyncState = INITIAL;
const listeners = new Set<() => void>();

function set(patch: Partial<AppleHealthSyncState>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

export function appleHealthSyncState(): AppleHealthSyncState {
  return state;
}

export function useAppleHealthSync(): AppleHealthSyncState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

let auth: { userId: string; accessToken: string } | null = null;
let running: Promise<void> | null = null;
let queued: AppleHealthTrigger | null = null;
let lastFinished = 0;

/** Who's signed in; a different person (or none) starts from nothing. */
export function setAppleHealthAuth(next: { userId: string; accessToken: string } | null): void {
  if (next?.userId !== auth?.userId) {
    state = INITIAL;
    lastFinished = 0;
    queued = null;
    listeners.forEach((listener) => listener());
  }
  auth = next;
}

/** Connected, and on this iPhone: the only time it syncs by itself. */
export function connectedHere(s: AppleHealthSyncState = state): boolean {
  return (
    s.available === true &&
    s.asked === true &&
    s.connection !== null &&
    s.connection.status !== 'disconnected'
  );
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Where a sync starts reading: 90 days back on connecting, else two days before the last sync. */
export function syncFrom(
  trigger: AppleHealthTrigger,
  lastSyncedAt: string | null,
  now: Date,
): Date {
  const today = startOfDay(now);
  const earliest = addDays(today, -(DAYS_ON_CONNECT - 1));
  if (trigger === 'connect' || trigger === 'backfill' || !lastSyncedAt) return earliest;
  const fromLast = addDays(startOfDay(new Date(lastSyncedAt)), -RECHECK_DAYS);
  const latest = addDays(today, -RECHECK_DAYS);
  const from = fromLast < latest ? fromLast : latest;
  return from > earliest ? from : earliest;
}

/** What's read, as the server takes it (nothing unknown sent as a 0 or a null). */
export function toImport(trigger: AppleHealthTrigger, read: AppleHealthRead): AppleHealthImport {
  return {
    trigger,
    values: read.values,
    cleared: read.cleared,
    sleep: read.sleep.map((night) => ({
      sourceRef: night.sourceRef,
      startedAt: night.startedAt,
      endedAt: night.endedAt,
      inBedS: night.inBedS,
      ...(night.asleepS !== null ? { asleepS: night.asleepS } : {}),
      ...(night.awakeS !== null ? { awakeS: night.awakeS } : {}),
      ...(night.remS !== null ? { remS: night.remS } : {}),
      ...(night.lightS !== null ? { lightS: night.lightS } : {}),
      ...(night.deepS !== null ? { deepS: night.deepS } : {}),
      ...(night.device ? { device: night.device } : {}),
    })),
    clearedSleep: read.clearedSleep,
    devices: read.devices,
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message || error.name : String(error);
}

async function fetchConnection(): Promise<AppleHealthConnection | null> {
  const { data, error } = await supabase
    .from('health_connections')
    .select('status, devices, connected_at, last_synced_at, last_error')
    .eq('provider', 'apple_health')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    status: data.status,
    devices: data.devices ?? [],
    connectedAt: data.connected_at,
    lastSyncedAt: data.last_synced_at,
    lastError: data.last_error,
  };
}

async function fetchLatest(now = new Date()): Promise<LatestHealthValue[]> {
  const { data, error } = await supabase
    .from('health_daily_metrics')
    .select('metric, day, value')
    .eq('source', 'apple_health')
    .gte('day', localDayKey(addDays(now, -6)))
    .order('day', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const latest = new Map<string, LatestHealthValue>();
  for (const row of data ?? []) {
    if (!latest.has(row.metric)) {
      latest.set(row.metric, { metric: row.metric, day: row.day, value: Number(row.value) });
    }
  }
  return [...latest.values()];
}

/** What's there: whether Apple Health can be read here, whether it's asked, and what's kept. */
export async function refreshAppleHealth(): Promise<void> {
  const available = await appleHealthAvailable().catch(() => false);
  const asked = available ? await appleHealthAsked().catch(() => null) : null;
  try {
    const [connection, latest] = await Promise.all([fetchConnection(), fetchLatest()]);
    set({ available, asked, connection, latest, loaded: true });
  } catch (error) {
    set({ available, asked, loaded: true, error: messageOf(error) });
  }
}

/** One sync now. A sync asked for while one is going runs straight after it. */
export async function syncAppleHealth(trigger: AppleHealthTrigger): Promise<void> {
  if (!auth) return;
  if (running) {
    queued = trigger;
    return running;
  }
  const { accessToken } = auth;
  running = (async () => {
    try {
      if (!(await appleHealthAvailable())) {
        set({ available: false });
        return;
      }
      // Locked: Apple Health can't be read. The next wake-up or open picks it up.
      if (!(await appleHealthReadable())) return;
      set({ phase: 'syncing', error: null });
      const now = new Date();
      const read = await readAppleHealth(
        syncFrom(trigger, state.connection?.lastSyncedAt ?? null, now),
        now,
      );
      const result = await importAppleHealth(accessToken, toImport(trigger, read));
      set({
        lastSync: {
          at: now.toISOString(),
          upserted: result.upserted,
          refused: result.refused.length,
          trigger,
        },
      });
      await refreshAppleHealth();
    } catch (error) {
      set({ error: messageOf(error) });
    } finally {
      set({ phase: 'idle' });
      lastFinished = Date.now();
      running = null;
      const next = queued;
      queued = null;
      if (next) void syncAppleHealth(next);
    }
  })();
  return running;
}

/** A sync by itself -- as the app opens, or HealthKit wakes it -- only where it's due. */
export async function syncAppleHealthIfDue(trigger: 'app_open' | 'background'): Promise<void> {
  if (!connectedHere() || running) return;
  const every = trigger === 'background' ? BACKGROUND_SYNC_EVERY_MS : OPEN_SYNC_EVERY_MS;
  if (Date.now() - lastFinished < every) return;
  await syncAppleHealth(trigger);
}

/** Asks iPhone to read Health's types, then brings in the last 90 days. True once it's in. */
export async function connectAppleHealth(): Promise<boolean> {
  if (!auth) return false;
  set({ phase: 'asking', error: null });
  try {
    await askForAppleHealth();
    set({ asked: true });
  } catch (error) {
    set({ phase: 'idle', error: messageOf(error) });
    return false;
  }
  // Background delivery is a bonus: a failure there never stops connecting.
  await startBackgroundSync().catch(() => undefined);
  set({ phase: 'idle' });
  await syncAppleHealth('connect');
  return state.error === null;
}

/** Stops syncing, keeping what's kept or deleting it. True once done. */
export async function disconnectAppleHealthSync(deleteHistory: boolean): Promise<boolean> {
  if (!auth) return false;
  set({ phase: 'disconnecting', error: null });
  try {
    await disconnectAppleHealth(auth.accessToken, deleteHistory);
    await stopBackgroundSync().catch(() => undefined);
    await refreshAppleHealth();
    return true;
  } catch (error) {
    set({ error: messageOf(error) });
    return false;
  } finally {
    set({ phase: 'idle' });
  }
}
