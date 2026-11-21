import { formatDuration } from '../lib/duration';

// Cardio in a workout (explicitly requested -- 20261208100000_workout_cardio.sql): the activities,
// what each asks for, and how its figures are typed and shown. Pure, so the live workout, Log/Edit
// Past Workout, a finished workout's page and the feed show cardio the same way. Everything is
// typed in by hand -- no GPS, Apple Health or other integration.
//
// Stored in canonical units (metres, km/h), as weights are kilograms; shown in the person's: a
// pounds person sees miles, mph and (in a pool) yards, a kilograms person kilometres, km/h and
// metres. A rower's distance is always metres, as every rowing machine counts it.

export type CardioActivity =
  | 'treadmill'
  | 'outdoor_run'
  | 'walking'
  | 'cycling'
  | 'stairmaster'
  | 'elliptical'
  | 'rowing'
  | 'swimming'
  | 'other';

/** A figure an activity can ask for, besides its time and calories (which every one does). */
export type CardioField = 'distance' | 'speed' | 'incline' | 'resistance' | 'floors' | 'name';

/** How an activity's distance is counted: on a road (mi/km), on a rower (m), in a pool (yd/m). */
type DistanceKind = 'road' | 'rower' | 'pool';

interface ActivityInfo {
  label: string;
  /** Only the figures that fit it, in the order asked. */
  fields: CardioField[];
  distance: DistanceKind;
  /** Pace (time per mile or km) is worked out from its distance and time and shown with it. */
  showsPace?: boolean;
  /** Resistance is called this on the machine ("Level", "Damper"). */
  resistanceLabel?: string;
}

export const CARDIO_ACTIVITIES: CardioActivity[] = [
  'treadmill',
  'outdoor_run',
  'walking',
  'cycling',
  'stairmaster',
  'elliptical',
  'rowing',
  'swimming',
  'other',
];

export const CARDIO_INFO: Record<CardioActivity, ActivityInfo> = {
  treadmill: { label: 'Treadmill', fields: ['distance', 'speed', 'incline'], distance: 'road' },
  outdoor_run: {
    label: 'Outdoor Running',
    fields: ['distance'],
    distance: 'road',
    showsPace: true,
  },
  walking: { label: 'Walking', fields: ['distance'], distance: 'road', showsPace: true },
  cycling: { label: 'Cycling', fields: ['distance', 'resistance'], distance: 'road' },
  stairmaster: {
    label: 'Stairmaster',
    fields: ['floors', 'resistance'],
    distance: 'road',
    resistanceLabel: 'Level',
  },
  elliptical: { label: 'Elliptical', fields: ['distance', 'resistance'], distance: 'road' },
  rowing: {
    label: 'Rowing',
    fields: ['distance', 'resistance'],
    distance: 'rower',
    resistanceLabel: 'Damper',
  },
  swimming: { label: 'Swimming', fields: ['distance'], distance: 'pool', showsPace: false },
  other: { label: 'Other', fields: ['name', 'distance'], distance: 'road' },
};

/** A cardio activity's figures, as saved. Null where it wasn't typed or doesn't apply. */
export interface CardioValues {
  activity: CardioActivity;
  /** What an "Other" activity was ("Jump Rope"). */
  name: string | null;
  durationSeconds: number;
  distanceM: number | null;
  calories: number | null;
  speedKmh: number | null;
  inclinePercent: number | null;
  resistanceLevel: number | null;
  floors: number | null;
}

/** A cardio activity as it's typed in. */
export interface CardioDraft {
  activity: CardioActivity;
  name: string;
  duration: string;
  distance: string;
  calories: string;
  speed: string;
  incline: string;
  resistance: string;
  floors: string;
}

type Unit = 'kg' | 'lb';

const METRES_PER_MILE = 1609.344;
const METRES_PER_YARD = 0.9144;
const KMH_PER_MPH = 1.609344;

/** The unit an activity's distance is typed and shown in. */
export function distanceUnit(activity: CardioActivity, unit: Unit): 'mi' | 'km' | 'm' | 'yd' {
  switch (CARDIO_INFO[activity].distance) {
    case 'rower':
      return 'm';
    case 'pool':
      return unit === 'lb' ? 'yd' : 'm';
    default:
      return unit === 'lb' ? 'mi' : 'km';
  }
}

export function speedUnit(unit: Unit): 'mph' | 'km/h' {
  return unit === 'lb' ? 'mph' : 'km/h';
}

const METRES_PER: Record<'mi' | 'km' | 'm' | 'yd', number> = {
  mi: METRES_PER_MILE,
  km: 1000,
  m: 1,
  yd: METRES_PER_YARD,
};

/** Metres, from a distance in an activity's unit. */
export function metresFrom(value: number, activity: CardioActivity, unit: Unit): number {
  return Math.round(value * METRES_PER[distanceUnit(activity, unit)] * 100) / 100;
}

function trimNumber(value: number, decimals: number): string {
  return String(Number(value.toFixed(decimals)));
}

/** A distance in an activity's unit, as typed back into its field ("3.1", "2000"). */
export function distanceInUnit(metres: number, activity: CardioActivity, unit: Unit): string {
  const shown = distanceUnit(activity, unit);
  return trimNumber(metres / METRES_PER[shown], shown === 'm' || shown === 'yd' ? 0 : 2);
}

/** "3.1 mi", "5 km", "2,000 m", "1,640 yd". */
export function formatDistance(metres: number, activity: CardioActivity, unit: Unit): string {
  const shown = distanceUnit(activity, unit);
  const value = metres / METRES_PER[shown];
  const figure =
    shown === 'm' || shown === 'yd'
      ? Math.round(value).toLocaleString('en-US')
      : trimNumber(value, 2);
  return `${figure} ${shown}`;
}

/** "6 mph", "9.5 km/h". */
export function formatSpeed(kmh: number, unit: Unit): string {
  return `${trimNumber(unit === 'lb' ? kmh / KMH_PER_MPH : kmh, 1)} ${speedUnit(unit)}`;
}

/** A speed in the person's unit, as typed back into its field. */
export function speedInUnit(kmh: number, unit: Unit): string {
  return trimNumber(unit === 'lb' ? kmh / KMH_PER_MPH : kmh, 1);
}

/** Time per mile or km ("8:03 /mi"), from a distance and a time; null without a distance. */
export function formatPace(
  metres: number | null,
  seconds: number,
  activity: CardioActivity,
  unit: Unit,
): string | null {
  if (!metres || metres <= 0) return null;
  const shown = distanceUnit(activity, unit);
  if (shown !== 'mi' && shown !== 'km') return null;
  const perUnit = seconds / (metres / METRES_PER[shown]);
  if (!Number.isFinite(perUnit) || perUnit <= 0 || perUnit > 86_400) return null;
  return `${formatDuration(perUnit)} /${shown}`;
}

/** "20 min", "20:30", "1h 5m" -- a whole number of minutes reads as minutes. */
export function formatCardioTime(seconds: number): string {
  if (seconds % 60 !== 0) return formatDuration(seconds);
  const minutes = seconds / 60;
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes} min`;
}

/** An activity's name as shown: its own for "Other", once one's given. */
export function cardioName(entry: { activity: CardioActivity; name?: string | null }): string {
  return entry.activity === 'other' && entry.name ? entry.name : CARDIO_INFO[entry.activity].label;
}

/**
 * Its figures in one line, in the order they matter ("20 min · 1.5 mi · 6 mph · 3% incline ·
 * 210 cal") -- only what was typed in.
 */
export function cardioDetails(entry: CardioValues, unit: Unit): string {
  const parts = [formatCardioTime(entry.durationSeconds)];
  if (entry.distanceM !== null) parts.push(formatDistance(entry.distanceM, entry.activity, unit));
  if (CARDIO_INFO[entry.activity].showsPace) {
    const pace = formatPace(entry.distanceM, entry.durationSeconds, entry.activity, unit);
    if (pace) parts.push(pace);
  }
  if (entry.speedKmh !== null) parts.push(formatSpeed(entry.speedKmh, unit));
  if (entry.inclinePercent !== null) parts.push(`${trimNumber(entry.inclinePercent, 1)}% incline`);
  if (entry.floors !== null)
    parts.push(`${entry.floors} ${entry.floors === 1 ? 'floor' : 'floors'}`);
  if (entry.resistanceLevel !== null) {
    parts.push(
      `${CARDIO_INFO[entry.activity].resistanceLabel ?? 'Level'} ${entry.resistanceLevel}`,
    );
  }
  if (entry.calories !== null) parts.push(`${entry.calories} cal`);
  return parts.join(' · ');
}

/**
 * The seconds a typed cardio time stands for: whole or part minutes ("20", "20.5"), or
 * minutes:seconds ("20:30"), hours too ("1:05:00"). Null when it isn't one.
 */
export function parseCardioTime(text: string): number | null {
  const trimmed = text.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const seconds = Math.round(Number(trimmed) * 60);
    return seconds > 0 && seconds <= 86_400 ? seconds : null;
  }
  if (!/^\d+(:\d{1,2}){1,2}$/.test(trimmed)) return null;
  const parts = trimmed.split(':').map(Number);
  if (parts.slice(1).some((part) => part > 59)) return null;
  // "20:30" is minutes and seconds; "1:05:00" hours, minutes and seconds.
  const seconds =
    parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
  return seconds > 0 && seconds <= 86_400 ? seconds : null;
}

/** Whether two activities' figures are the same -- an edit that changed nothing saves nothing. */
export function sameCardio(a: CardioValues, b: CardioValues): boolean {
  return (
    a.activity === b.activity &&
    a.name === b.name &&
    a.durationSeconds === b.durationSeconds &&
    a.distanceM === b.distanceM &&
    a.calories === b.calories &&
    a.speedKmh === b.speedKmh &&
    a.inclinePercent === b.inclinePercent &&
    a.resistanceLevel === b.resistanceLevel &&
    a.floors === b.floors
  );
}

/** An empty draft for an activity: what Add Cardio opens on. */
export function emptyCardioDraft(activity: CardioActivity = 'treadmill'): CardioDraft {
  return {
    activity,
    name: '',
    duration: '',
    distance: '',
    calories: '',
    speed: '',
    incline: '',
    resistance: '',
    floors: '',
  };
}

/** What a saved activity shows in its fields. */
export function draftFromCardio(entry: CardioValues, unit: Unit): CardioDraft {
  return {
    activity: entry.activity,
    name: entry.name ?? '',
    duration: formatDurationField(entry.durationSeconds),
    distance: entry.distanceM !== null ? distanceInUnit(entry.distanceM, entry.activity, unit) : '',
    calories: entry.calories !== null ? String(entry.calories) : '',
    speed: entry.speedKmh !== null ? speedInUnit(entry.speedKmh, unit) : '',
    incline: entry.inclinePercent !== null ? trimNumber(entry.inclinePercent, 1) : '',
    resistance: entry.resistanceLevel !== null ? String(entry.resistanceLevel) : '',
    floors: entry.floors !== null ? String(entry.floors) : '',
  };
}

/** A saved time as its field shows it: minutes when whole ("20"), else minutes:seconds. */
function formatDurationField(seconds: number): string {
  return seconds % 60 === 0 ? String(seconds / 60) : formatDuration(seconds);
}

type Parsed<T> = { ok: true; value: T } | { ok: false };

/** An optional number in [min, max]: blank is null, anything else must be one. */
function optionalNumber(
  text: string,
  min: number,
  max: number,
  whole: boolean,
): Parsed<number | null> {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return { ok: true, value: null };
  if (!(whole ? /^\d+$/ : /^-?\d+(\.\d+)?$/).test(trimmed)) return { ok: false };
  const value = Number(trimmed);
  return value >= min && value <= max ? { ok: true, value } : { ok: false };
}

/**
 * A draft's figures as saved, or why it can't be: a time is required, everything else is
 * optional, and only the figures its activity asks for are kept (switching activity leaves no
 * stray incline on a swim).
 */
export function cardioValues(
  draft: CardioDraft,
  unit: Unit,
): { values: CardioValues } | { problem: string } {
  const info = CARDIO_INFO[draft.activity];
  const asks = (field: CardioField) => info.fields.includes(field);
  const durationSeconds = parseCardioTime(draft.duration);
  if (durationSeconds === null) {
    return { problem: 'Enter how long it took, in minutes (20) or minutes and seconds (20:30).' };
  }
  const name = draft.name.trim();
  if (asks('name') && name.length > 60) return { problem: 'Keep the name to 60 characters.' };

  const distance = optionalNumber(draft.distance, 0, 1_000_000, false);
  const calories = optionalNumber(draft.calories, 1, 20_000, true);
  const speed = optionalNumber(draft.speed, 0, 100, false);
  const incline = optionalNumber(draft.incline, -10, 40, false);
  const resistance = optionalNumber(draft.resistance, 1, 50, true);
  const floors = optionalNumber(draft.floors, 1, 10_000, true);
  if (asks('distance') && (!distance.ok || distance.value === 0)) {
    return { problem: 'Enter the distance as a number, or leave it blank.' };
  }
  if (!calories.ok) return { problem: 'Enter calories as a whole number, or leave it blank.' };
  if (asks('speed') && (!speed.ok || speed.value === 0)) {
    return { problem: 'Enter the speed as a number, or leave it blank.' };
  }
  if (asks('incline') && !incline.ok) {
    return { problem: 'Enter the incline as a percentage (up to 40), or leave it blank.' };
  }
  if (asks('resistance') && !resistance.ok) {
    return {
      problem: `Enter the ${(info.resistanceLabel ?? 'level').toLowerCase()} as a whole number from 1 to 50, or leave it blank.`,
    };
  }
  if (asks('floors') && !floors.ok) {
    return { problem: 'Enter the floors as a whole number, or leave it blank.' };
  }

  const distanceValue = asks('distance') && distance.ok ? distance.value : null;
  const speedValue = asks('speed') && speed.ok ? speed.value : null;
  return {
    values: {
      activity: draft.activity,
      name: asks('name') && name !== '' ? name : null,
      durationSeconds,
      distanceM: distanceValue === null ? null : metresFrom(distanceValue, draft.activity, unit),
      calories: calories.ok ? calories.value : null,
      speedKmh:
        speedValue === null
          ? null
          : Math.round((unit === 'lb' ? speedValue * KMH_PER_MPH : speedValue) * 100) / 100,
      inclinePercent: asks('incline') && incline.ok ? incline.value : null,
      resistanceLevel: asks('resistance') && resistance.ok ? resistance.value : null,
      floors: asks('floors') && floors.ok ? floors.value : null,
    },
  };
}
