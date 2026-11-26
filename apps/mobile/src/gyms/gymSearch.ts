import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

// Gyms from Apple Maps, searched on the phone (modules/gym-search, MapKit): those near the phone,
// or those matching a name. The phone's position goes only to Apple's MapKit, never to
// Progresso; only the gym someone picks is saved (workoutGyms.ts). The native side is loaded on
// first use, never as the app starts, and there's none off iPhone or in Expo Go -- where a gym
// can still be typed in.

/** A gym as Apple Maps describes it. */
export interface GymPlace {
  name: string;
  /** "123 Main St, Vancouver, BC"; empty where Apple gives none. */
  address: string;
  latitude: number | null;
  longitude: number | null;
  /** How far from where it was searched from, metres -- only for a search from a point. */
  distanceMeters?: number;
  /** Apple Maps' own id for the place (iOS 18 and up). */
  placeId?: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

interface GymSearchNative {
  nearby(latitude: number, longitude: number, radiusMeters: number): Promise<unknown[]>;
  search(query: string, latitude: number | null, longitude: number | null): Promise<unknown[]>;
}

function native(): GymSearchNative | null {
  if (Platform.OS !== 'ios') return null;
  return requireOptionalNativeModule<GymSearchNative>('GymSearch');
}

/** Whether Apple Maps can be searched for gyms here (iPhone, a build with it). */
export function gymSearchAvailable(): boolean {
  return native() !== null;
}

/** Only what's well formed: a gym with a name, and coordinates only where both are numbers. */
export function toGymPlace(value: unknown): GymPlace | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) return null;
  const latitude =
    typeof raw.latitude === 'number' && Number.isFinite(raw.latitude) ? raw.latitude : null;
  const longitude =
    typeof raw.longitude === 'number' && Number.isFinite(raw.longitude) ? raw.longitude : null;
  return {
    name,
    address: typeof raw.address === 'string' ? raw.address : '',
    latitude: latitude !== null && longitude !== null ? latitude : null,
    longitude: latitude !== null && longitude !== null ? longitude : null,
    ...(typeof raw.distanceMeters === 'number' && Number.isFinite(raw.distanceMeters)
      ? { distanceMeters: raw.distanceMeters }
      : {}),
    ...(typeof raw.placeId === 'string' && raw.placeId ? { placeId: raw.placeId } : {}),
  };
}

/** How far around the phone "near you" looks. */
export const NEARBY_RADIUS_METERS = 5000;

/** Gyms near a point, nearest first. Throws when Apple Maps can't be reached. */
export async function nearbyGyms(at: Coordinates): Promise<GymPlace[]> {
  const search = native();
  if (!search) return [];
  const found = await search.nearby(at.latitude, at.longitude, NEARBY_RADIUS_METERS);
  return (found ?? []).map(toGymPlace).filter((gym): gym is GymPlace => gym !== null);
}

/** Gyms matching what's typed, near a point when there's one. */
export async function searchGyms(query: string, near: Coordinates | null): Promise<GymPlace[]> {
  const search = native();
  const typed = query.trim();
  if (!search || typed.length < 2) return [];
  const found = await search.search(typed, near?.latitude ?? null, near?.longitude ?? null);
  return (found ?? []).map(toGymPlace).filter((gym): gym is GymPlace => gym !== null);
}

/** "350 m", "1.2 km", "12 km" -- in kilometres for everyone, as the app's distances are. */
export function formatDistance(meters: number): string {
  if (meters < 950) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** Whether two places are the one gym: Apple's id, else the same name and address. */
export function sameGym(a: Pick<GymPlace, 'name' | 'address' | 'placeId'>, b: typeof a): boolean {
  if (a.placeId && b.placeId) return a.placeId === b.placeId;
  return (
    a.name.trim().toLowerCase() === b.name.trim().toLowerCase() &&
    a.address.trim().toLowerCase() === b.address.trim().toLowerCase()
  );
}
