import {
  AuthorizationRequestStatus,
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import { Platform } from 'react-native';

// Today's steps from Apple Health -- the only thing Progresso reads from it, and it never writes
// to it. The count is read on the phone each time it's shown and kept nowhere: not in Supabase,
// not on our server. iPhone only.
//
// Apple Health never tells an app whether reading was allowed: someone who said no just gets no
// steps back. So the app can only know whether it has asked, and a count of 0 may mean either.

const STEPS = 'HKQuantityTypeIdentifierStepCount' as const;

/** 'unavailable': not on this device. 'notAsked': Progresso hasn't asked yet. 'asked': it has. */
export type StepsAccess = 'unavailable' | 'notAsked' | 'asked';

export async function stepsAccess(): Promise<StepsAccess> {
  if (Platform.OS !== 'ios' || !isHealthDataAvailable()) return 'unavailable';
  const status = await getRequestStatusForAuthorization({ toRead: [STEPS] });
  return status === AuthorizationRequestStatus.shouldRequest ? 'notAsked' : 'asked';
}

/** Shows Apple Health's own sheet asking to read steps. Resolves once it's been answered. */
export async function askForSteps(): Promise<void> {
  await requestAuthorization({ toRead: [STEPS] });
}

/** Steps since midnight today, from every source Apple Health has (phone, watch), without double counting. */
export async function stepsToday(now = new Date()): Promise<number> {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const result = await queryStatisticsForQuantity(STEPS, ['cumulativeSum'], {
    filter: { date: { startDate: startOfDay, endDate: now } },
    unit: 'count',
  });
  return Math.round(result.sumQuantity?.quantity ?? 0);
}
