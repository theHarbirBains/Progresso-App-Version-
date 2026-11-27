// The Apple Health library, loaded the first time it's needed rather than when the app starts: it
// sets up its native side as it loads. Shared by today's steps (steps.ts) and Apple Health sync
// (sync/), so it's loaded once. Callers check hasHealthKitNative() first (lib/nativeModules.ts):
// Expo Go has no Apple Health, and Metro treats a file that fails while it loads after startup as
// fatal, so loading it there would stop the app.

export type HealthKit = typeof import('@kingstinct/react-native-healthkit');

let healthKit: HealthKit | null = null;

export async function loadHealthKit(): Promise<HealthKit> {
  // A require inside a function is what defers loading it to here.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  healthKit ??= require('@kingstinct/react-native-healthkit') as HealthKit;
  return healthKit;
}
