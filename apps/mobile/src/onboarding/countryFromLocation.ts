import { hasLocationNative } from '../lib/nativeModules';

// The country someone's in, from where their phone is -- for onboarding's country list, which
// shows it first. Asked for once, while signing up, and only "while using the app" at reduced
// accuracy (app.json): the phone works out where it is, iPhone's own geocoder names the country,
// and only the country's two letters come back here. The position itself is never sent to
// Progresso or kept, and the country isn't saved unless it's the one they pick.
//
// expo-location is loaded the first time it's needed, not when the app starts.

type ExpoLocation = typeof import('expo-location');
let location: ExpoLocation | null = null;

function loadLocation(): ExpoLocation {
  // A require inside a function is what defers loading it to here.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  location ??= require('expo-location') as ExpoLocation;
  return location;
}

/** Whether this copy of the app can ask where the phone is. */
export function locationAvailable(): boolean {
  return hasLocationNative();
}

/** A position up to a day old is near enough to name the country. */
const LAST_KNOWN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** How long to wait for a fresh position before giving up on it. */
const POSITION_TIMEOUT_MS = 8000;

export type CountryLookup =
  | { status: 'found'; country: string }
  /** They didn't allow it. */
  | { status: 'denied' }
  /** Allowed, but no country came back (no position in time, or none named). */
  | { status: 'unknown' };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/** Asks to use the phone's location (iPhone's own prompt), then names the country it's in. */
export async function countryFromLocation(): Promise<CountryLookup> {
  const Location = loadLocation();
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) return { status: 'denied' };

  const position =
    (await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS })) ??
    (await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }),
      POSITION_TIMEOUT_MS,
    ));
  if (!position) return { status: 'unknown' };

  const places = await Location.reverseGeocodeAsync({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  });
  const code = places.find((place) => place.isoCountryCode)?.isoCountryCode?.toUpperCase();
  return code && /^[A-Z]{2}$/.test(code)
    ? { status: 'found', country: code }
    : { status: 'unknown' };
}
