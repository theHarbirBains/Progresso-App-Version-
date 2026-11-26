import { hasLocationNative } from '../lib/nativeModules';
import type { Coordinates } from './gymSearch';

// Where the phone is, for the gyms near it -- read as Choose Your Gym opens where location is
// already allowed (never asking), and asked for only when someone taps Find Gyms Near Me; while
// the app is in use (never Always, never in the background), and used there and then to search
// Apple Maps. Never kept or sent to Progresso. expo-location is loaded the first time it's needed,
// not when the app starts.

type ExpoLocation = typeof import('expo-location');
let location: ExpoLocation | null = null;

function loadLocation(): ExpoLocation {
  // A require inside a function is what defers loading it to here.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  location ??= require('expo-location') as ExpoLocation;
  return location;
}

/** How long to wait for the phone to say where it is. */
const POSITION_TIMEOUT_MS = 10000;

export type PhonePosition =
  { status: 'found'; coordinates: Coordinates } | { status: 'denied' } | { status: 'unavailable' };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** Whether location is allowed already -- never asking. */
export async function locationAllowed(): Promise<boolean> {
  if (!hasLocationNative()) return false;
  try {
    return (await loadLocation().getForegroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/**
 * The phone's position now, asking once where it hasn't been asked (unless `ask` is false). As
 * precise as the phone will give -- the gyms around the corner, not just the area.
 */
export async function phonePosition({
  ask = true,
}: { ask?: boolean } = {}): Promise<PhonePosition> {
  if (!hasLocationNative()) return { status: 'unavailable' };
  try {
    const Location = loadLocation();
    let permission = await Location.getForegroundPermissionsAsync();
    if (ask && !permission.granted && permission.canAskAgain) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (!permission.granted) return { status: 'denied' };
    const position = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      POSITION_TIMEOUT_MS,
    );
    if (!position) return { status: 'unavailable' };
    return {
      status: 'found',
      coordinates: { latitude: position.coords.latitude, longitude: position.coords.longitude },
    };
  } catch {
    return { status: 'unavailable' };
  }
}
