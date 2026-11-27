import { Platform } from 'react-native';
import { hasHealthKitNative } from '../lib/nativeModules';
import { loadHealthKit } from './healthKit';

// Today's steps from Apple Health, and it never writes to it. The count is read on the phone each
// time it's shown and kept nowhere: not in Supabase, not on our server. iPhone only. (Apple Health
// sync for Health -- sync/, Phase 3, development builds only for now -- reads more, and keeps it.)
//
// Apple Health never tells an app whether reading was allowed: someone who said no just gets no
// steps back. So the app can only know whether it has asked, and a count of 0 may mean either.
//
// The Apple Health library is loaded the first time steps are needed, not when the app starts:
// it sets up its native side as it loads. Once loaded, a failure from Apple Health surfaces as a
// rejected promise from these functions. A failure while the library itself loads can't be caught
// -- Metro treats a file that fails while it loads after startup as fatal -- so it's kept to the
// library's own setup, which has run on a real iPhone.

const STEPS = 'HKQuantityTypeIdentifierStepCount' as const;

/**
 * 'unavailable': not on this device, or not in this copy of the app (Expo Go has no Apple Health).
 * 'notAsked': Progresso hasn't asked yet. 'asked': it has.
 */
export type StepsAccess = 'unavailable' | 'notAsked' | 'asked';

export async function stepsAccess(): Promise<StepsAccess> {
  if (Platform.OS !== 'ios' || !hasHealthKitNative()) return 'unavailable';
  const hk = await loadHealthKit();
  if (!hk.isHealthDataAvailable()) return 'unavailable';
  const status = await hk.getRequestStatusForAuthorization({ toRead: [STEPS] });
  return status === hk.AuthorizationRequestStatus.shouldRequest ? 'notAsked' : 'asked';
}

/** Shows Apple Health's own sheet asking to read steps. Resolves once it's been answered. */
export async function askForSteps(): Promise<void> {
  const hk = await loadHealthKit();
  await hk.requestAuthorization({ toRead: [STEPS] });
}

/** Steps since midnight today, from every source Apple Health has (phone, watch), without double counting. */
export async function stepsToday(now = new Date()): Promise<number> {
  const hk = await loadHealthKit();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const result = await hk.queryStatisticsForQuantity(STEPS, ['cumulativeSum'], {
    filter: { date: { startDate: startOfDay, endDate: now } },
    unit: 'count',
  });
  return Math.round(result.sumQuantity?.quantity ?? 0);
}

/** One day's steps: the day as "YYYY-MM-DD" (local), and its count. */
export interface DaySteps {
  day: string;
  steps: number;
}

/**
 * Each of the last `days` days' steps, oldest first and today last (so far today), from every
 * source Apple Health has, without double counting -- read on the phone, kept nowhere.
 */
export async function stepsByDay(days: number, now = new Date()): Promise<DaySteps[]> {
  const hk = await loadHealthKit();
  const first = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const results = await hk.queryStatisticsCollectionForQuantity(
    STEPS,
    ['cumulativeSum'],
    first,
    { day: 1 },
    { filter: { date: { startDate: first, endDate: now } }, unit: 'count' },
  );
  const byDay = new Map<string, number>();
  for (const result of results) {
    if (!result.startDate) continue;
    byDay.set(dayKey(new Date(result.startDate)), Math.round(result.sumQuantity?.quantity ?? 0));
  }
  return Array.from({ length: days }, (_, i) => {
    const day = dayKey(new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
    return { day, steps: byDay.get(day) ?? 0 };
  });
}

function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
