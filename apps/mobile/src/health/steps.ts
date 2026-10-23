import { Platform } from 'react-native';
import { hasHealthKitNative } from '../lib/nativeModules';

// Today's steps from Apple Health -- the only thing Progresso reads from it, and it never writes
// to it. The count is read on the phone each time it's shown and kept nowhere: not in Supabase,
// not on our server. iPhone only.
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

type HealthKit = typeof import('@kingstinct/react-native-healthkit');
let healthKit: HealthKit | null = null;

async function loadHealthKit(): Promise<HealthKit> {
  // A require inside a function is what defers loading it to here.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  healthKit ??= require('@kingstinct/react-native-healthkit') as HealthKit;
  return healthKit;
}

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
