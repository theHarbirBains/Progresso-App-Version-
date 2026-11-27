import { Platform } from 'react-native';
import { hasHealthKitNative } from '../../lib/nativeModules';
import { loadHealthKit } from '../healthKit';
import {
  APPLE_HEALTH_BACKGROUND_TYPES,
  APPLE_HEALTH_QUANTITIES,
  APPLE_HEALTH_READ_TYPES,
  APPLE_HEALTH_SLEEP,
} from './appleHealthMetrics';
import { localDayKey, sleepNights, type SleepNight, type SleepSample } from './sleepNights';

// Reading Apple Health for Health (Phase 3 of the Health & Wearables brief), on the phone. Nothing
// is written to Apple Health. Apple never tells an app whether reading was allowed -- someone who
// said no just gets nothing back -- so a type with nothing in it is left alone rather than taken
// as "nothing happened".

/** One day's figure for one metric, as the server takes it. */
export interface AppleHealthValue {
  day: string;
  metric: string;
  value: number;
  unit: string;
}

export interface AppleHealthRead {
  values: AppleHealthValue[];
  /** Days in the window a metric has nothing for any more (deleted in Apple Health). */
  cleared: { day: string; metric: string }[];
  sleep: SleepNight[];
  /** Nights in the window that are gone. */
  clearedSleep: string[];
  /** What's behind it: "iPhone", "Apple Watch", and the apps that wrote into Apple Health. */
  devices: string[];
  /** HealthKit types that couldn't be read this time. */
  failed: string[];
}

/** Whether Apple Health can be read here: an iPhone, in a build that has it (not Expo Go). */
export async function appleHealthAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !hasHealthKitNative()) return false;
  const hk = await loadHealthKit();
  return hk.isHealthDataAvailable();
}

/** Whether this iPhone has asked to read Health's types yet. */
export async function appleHealthAsked(): Promise<boolean> {
  const hk = await loadHealthKit();
  const status = await hk.getRequestStatusForAuthorization({ toRead: APPLE_HEALTH_READ_TYPES });
  return status !== hk.AuthorizationRequestStatus.shouldRequest;
}

/** Apple Health's own sheet, asking to read Health's types (never to write). */
export async function askForAppleHealth(): Promise<void> {
  const hk = await loadHealthKit();
  await hk.requestAuthorization({ toRead: APPLE_HEALTH_READ_TYPES });
}

/** Apple Health can't be read while the phone is locked -- a background wake-up then waits. */
export async function appleHealthReadable(): Promise<boolean> {
  const hk = await loadHealthKit();
  return hk.isProtectedDataAvailable();
}

/** HealthKit wakes Progresso, at most about hourly, when one of these has something new. */
export async function startBackgroundSync(): Promise<void> {
  const hk = await loadHealthKit();
  await hk.configureBackgroundTypes([...APPLE_HEALTH_BACKGROUND_TYPES], hk.UpdateFrequency.hourly);
}

export async function stopBackgroundSync(): Promise<void> {
  const hk = await loadHealthKit();
  await hk.clearBackgroundTypes();
}

/** Calls onChange whenever Apple Health has something new; returns how to stop. */
export async function watchAppleHealth(onChange: () => void): Promise<() => void> {
  const hk = await loadHealthKit();
  const subscriptions = APPLE_HEALTH_BACKGROUND_TYPES.map((type) =>
    hk.subscribeToChanges(type as typeof APPLE_HEALTH_SLEEP, () => onChange()),
  );
  return () => subscriptions.forEach((s) => s.remove());
}

/** Each day from `from` to `now`, "YYYY-MM-DD", the phone's own days. */
export function windowDays(from: Date, now: Date): string[] {
  const days: string[] = [];
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const last = localDayKey(now);
  for (;;) {
    const key = localDayKey(day);
    days.push(key);
    if (key >= last || days.length > 400) break;
    day.setDate(day.getDate() + 1);
  }
  return days;
}

const APPLE_BUNDLE = /^com\.apple\./;

/** What measured a sample, by kind -- never a phone's or watch's own name, which is personal. */
function deviceOf(sample: {
  device?: { model?: string } | null;
  sourceRevision?: { productType?: string; source?: { name?: string; bundleIdentifier?: string } };
}): string | null {
  const model = sample.device?.model ?? sample.sourceRevision?.productType ?? '';
  if (/watch/i.test(model)) return 'Apple Watch';
  if (/iphone/i.test(model)) return 'iPhone';
  const source = sample.sourceRevision?.source;
  if (source?.bundleIdentifier && !APPLE_BUNDLE.test(source.bundleIdentifier)) {
    return source.name?.slice(0, 80) || null;
  }
  return null;
}

/**
 * Health's figures from `from` to now: each day's value of every metric, each night's sleep, and
 * what's gone from days already sent. A metric with nothing at all in the window clears nothing:
 * that's a type not allowed (or not measured), not a deletion.
 */
export async function readAppleHealth(from: Date, now: Date): Promise<AppleHealthRead> {
  const hk = await loadHealthKit();
  const days = windowDays(from, now);
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const values: AppleHealthValue[] = [];
  const cleared: { day: string; metric: string }[] = [];
  const failed: string[] = [];
  const devices = new Set<string>(['iPhone']);

  await Promise.all(
    APPLE_HEALTH_QUANTITIES.map(async (quantity) => {
      try {
        const results = await hk.queryStatisticsCollectionForQuantity(
          quantity.identifier,
          [quantity.statistic],
          start,
          { day: 1 },
          { filter: { date: { startDate: start, endDate: now } }, unit: quantity.healthKitUnit },
        );
        const found = new Set<string>();
        for (const result of results) {
          if (!result.startDate) continue;
          const reading =
            quantity.statistic === 'cumulativeSum' ? result.sumQuantity : result.averageQuantity;
          const value = reading?.quantity;
          if (value === undefined || !Number.isFinite(value)) continue;
          const day = localDayKey(new Date(result.startDate));
          found.add(day);
          values.push({ day, metric: quantity.metric, value, unit: quantity.unit });
          for (const source of result.sources ?? []) {
            if (/watch/i.test(source.name) && APPLE_BUNDLE.test(source.bundleIdentifier)) {
              devices.add('Apple Watch');
            } else if (!APPLE_BUNDLE.test(source.bundleIdentifier) && source.name) {
              devices.add(source.name.slice(0, 80));
            }
          }
        }
        if (found.size > 0) {
          for (const day of days) {
            if (!found.has(day)) cleared.push({ day, metric: quantity.metric });
          }
        }
      } catch {
        failed.push(quantity.identifier);
      }
    }),
  );

  let sleep: SleepNight[] = [];
  const clearedSleep: string[] = [];
  try {
    // From the evening before the window's first day, for its first night.
    const sleepFrom = new Date(start.getTime() - 12 * 60 * 60 * 1000);
    const samples = await hk.queryCategorySamples(APPLE_HEALTH_SLEEP, {
      filter: { date: { startDate: sleepFrom, endDate: now } },
      limit: 0,
      ascending: true,
    });
    const sleepSamples: SleepSample[] = samples.map((sample) => ({
      value: Number(sample.value),
      start: new Date(sample.startDate),
      end: new Date(sample.endDate),
      source: sample.sourceRevision?.source?.bundleIdentifier ?? 'unknown',
      device: deviceOf(sample),
    }));
    for (const sample of sleepSamples) if (sample.device) devices.add(sample.device);
    sleep = sleepNights(sleepSamples, new Set(days));
    if (sleep.length > 0) {
      const nights = new Set(sleep.map((n) => n.day));
      for (const day of days) if (!nights.has(day)) clearedSleep.push(`night:${day}`);
    }
  } catch {
    failed.push(APPLE_HEALTH_SLEEP);
  }

  if (failed.length === APPLE_HEALTH_QUANTITIES.length + 1) {
    throw new Error('Apple Health couldn’t be read');
  }
  values.sort((a, b) => a.day.localeCompare(b.day) || a.metric.localeCompare(b.metric));
  return { values, cleared, sleep, clearedSleep, devices: [...devices].slice(0, 20), failed };
}
