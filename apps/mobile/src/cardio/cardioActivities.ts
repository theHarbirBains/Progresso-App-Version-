import type { Feather } from '@expo/vector-icons';
import { formatDuration } from '../lib/duration';

// Cardio in a workout (explicitly requested -- 20261208100000_workout_cardio.sql, and its metrics,
// 20261211100000_cardio_metrics.sql): the activities, what each asks for, and how its figures are
// typed and shown. The one place an activity's figures are defined, so the live workout, Log/Edit
// Past Workout, a finished workout's page, the feed and Progress all treat cardio the same way.
// Everything is typed in by hand -- no GPS, Apple Health or other integration -- and nothing is
// estimated: a pace or a speed is only ever what was typed, or worked out from the distance and
// time typed.
//
// Stored in canonical units (metres, km/h); shown in kilometres, km/h and minutes per km for
// everyone, whatever their weight unit. A treadmill's or an elliptical's speed is the number on the
// machine, with no unit. Cardio carries no calorie figure: what older activities had is kept in the
// database, never read or shown.

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

/** A figure an activity can ask for, besides its time (which every one does). */
export type CardioField =
  | 'name'
  | 'distance'
  | 'speedSetting'
  | 'pace'
  | 'avgSpeed'
  | 'split'
  | 'incline'
  | 'level'
  | 'resistance'
  | 'floors'
  | 'steps'
  | 'strokeRate'
  | 'poolLength'
  | 'laps'
  | 'notes';

/** How fast an activity went is told as time per km, per 500 m or per 100 m, or as a speed. */
export type CardioRate = 'pace' | 'speed' | 'split' | 'swimPace';

type FeatherGlyph = keyof typeof Feather.glyphMap;

interface ActivityInfo {
  label: string;
  /** A plain Feather glyph for it (the app's one icon set). */
  icon: FeatherGlyph;
  /** Asked for first, beside its time. */
  primary: CardioField[];
  /** Asked for after, under Optional. */
  optional: CardioField[];
  /** How its speed reads, where its distance and time make one worth telling. */
  rate: CardioRate | null;
  /** Whether its line of figures tells that rate ("5:30 /km"). */
  showsRate: boolean;
  /** What a resistance level saved with it is called. */
  levelLabel: string;
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
  treadmill: {
    label: 'Treadmill',
    icon: 'trending-up',
    primary: ['distance', 'speedSetting'],
    optional: ['incline'],
    rate: 'pace',
    showsRate: false,
    levelLabel: 'Level',
  },
  outdoor_run: {
    label: 'Outdoor Running',
    icon: 'wind',
    primary: ['distance'],
    optional: ['pace'],
    rate: 'pace',
    showsRate: true,
    levelLabel: 'Level',
  },
  walking: {
    label: 'Walking',
    icon: 'map',
    primary: ['distance'],
    optional: ['pace'],
    rate: 'pace',
    showsRate: true,
    levelLabel: 'Level',
  },
  cycling: {
    label: 'Cycling',
    icon: 'disc',
    primary: ['distance'],
    optional: ['avgSpeed', 'resistance'],
    rate: 'speed',
    showsRate: true,
    levelLabel: 'Resistance',
  },
  stairmaster: {
    label: 'StairMaster',
    icon: 'chevrons-up',
    primary: [],
    optional: ['level', 'floors', 'steps'],
    rate: null,
    showsRate: false,
    levelLabel: 'Level',
  },
  elliptical: {
    label: 'Elliptical',
    icon: 'refresh-cw',
    primary: [],
    optional: ['distance', 'resistance', 'speedSetting'],
    rate: null,
    showsRate: false,
    levelLabel: 'Resistance',
  },
  rowing: {
    label: 'Rowing',
    icon: 'anchor',
    primary: ['distance'],
    optional: ['split', 'strokeRate'],
    rate: 'split',
    showsRate: true,
    // Older rows asked for the damper setting.
    levelLabel: 'Damper',
  },
  swimming: {
    label: 'Swimming',
    icon: 'droplet',
    primary: ['distance'],
    optional: ['poolLength', 'laps'],
    rate: 'swimPace',
    showsRate: true,
    levelLabel: 'Level',
  },
  other: {
    label: 'Other',
    icon: 'more-horizontal',
    primary: ['name'],
    optional: ['distance', 'notes'],
    rate: null,
    showsRate: false,
    levelLabel: 'Level',
  },
};

/** Every figure an activity asks for, its own first. */
export function cardioFieldsOf(activity: CardioActivity): CardioField[] {
  const info = CARDIO_INFO[activity];
  return [...info.primary, ...info.optional];
}

export interface CardioFieldInfo {
  label: string;
  /** Shown after the label ("Distance (km)"). */
  unit?: string;
  placeholder: string;
  keyboard: 'decimal-pad' | 'number-pad' | 'numbers-and-punctuation' | 'default';
  /** A quiet line under it. */
  hint?: string;
  /** Nudged by this much with − and + (a level, a resistance, an incline). */
  step?: number;
  /** Lowest and highest the − and + go. */
  min?: number;
  max?: number;
  multiline?: boolean;
  maxLength?: number;
}

/** How each figure is asked for. */
export const CARDIO_FIELDS: Record<CardioField, CardioFieldInfo> = {
  name: {
    label: 'What was it?',
    placeholder: 'e.g. Jump Rope',
    keyboard: 'default',
    maxLength: 60,
  },
  distance: { label: 'Distance', unit: 'km', placeholder: '5.0', keyboard: 'decimal-pad' },
  speedSetting: {
    label: 'Speed',
    placeholder: '6.5',
    keyboard: 'decimal-pad',
    hint: 'As the machine shows it',
  },
  pace: {
    label: 'Avg pace',
    unit: 'min/km',
    placeholder: '5:30',
    keyboard: 'numbers-and-punctuation',
  },
  avgSpeed: { label: 'Avg speed', unit: 'km/h', placeholder: '25', keyboard: 'decimal-pad' },
  split: {
    label: 'Avg split',
    unit: '/500 m',
    placeholder: '2:05',
    keyboard: 'numbers-and-punctuation',
  },
  incline: {
    label: 'Incline',
    unit: '%',
    placeholder: '0',
    keyboard: 'numbers-and-punctuation',
    step: 0.5,
    min: -10,
    max: 40,
  },
  level: { label: 'Level', placeholder: '8', keyboard: 'number-pad', step: 1, min: 1, max: 50 },
  resistance: {
    label: 'Resistance',
    placeholder: '8',
    keyboard: 'number-pad',
    step: 1,
    min: 1,
    max: 50,
  },
  floors: { label: 'Floors', placeholder: '40', keyboard: 'number-pad' },
  steps: { label: 'Steps', placeholder: '1200', keyboard: 'number-pad' },
  strokeRate: { label: 'Stroke rate', unit: 'spm', placeholder: '24', keyboard: 'number-pad' },
  poolLength: { label: 'Pool length', unit: 'm', placeholder: '25', keyboard: 'decimal-pad' },
  laps: { label: 'Laps', placeholder: '40', keyboard: 'number-pad', hint: 'Lengths of the pool' },
  notes: {
    label: 'Notes',
    placeholder: 'Anything worth remembering',
    keyboard: 'default',
    multiline: true,
    maxLength: 500,
  },
};

/** A cardio activity's figures, as saved. Null where it wasn't typed or doesn't apply. */
export interface CardioValues {
  activity: CardioActivity;
  /** What an "Other" activity was ("Jump Rope"). */
  name: string | null;
  durationSeconds: number;
  distanceM: number | null;
  /** An average speed in km/h: typed as one, or as a pace or a split (an older machine speed). */
  speedKmh: number | null;
  /** The speed a treadmill or an elliptical was set to, as the machine shows it -- no unit. */
  speedSetting: number | null;
  inclinePercent: number | null;
  resistanceLevel: number | null;
  floors: number | null;
  steps: number | null;
  /** A rower's strokes a minute. */
  strokeRate: number | null;
  poolLengthM: number | null;
  /** Lengths of the pool. */
  laps: number | null;
  notes: string | null;
}

/** A cardio activity as it's typed in: its time and every figure any activity asks for. */
export type CardioDraft = { activity: CardioActivity; duration: string } & Record<
  CardioField,
  string
>;

/** The saved figure each typed one becomes. */
type CardioColumn = Exclude<keyof CardioValues, 'activity' | 'durationSeconds'>;

const FIELD_COLUMN: Record<CardioField, CardioColumn> = {
  name: 'name',
  distance: 'distanceM',
  speedSetting: 'speedSetting',
  pace: 'speedKmh',
  avgSpeed: 'speedKmh',
  split: 'speedKmh',
  incline: 'inclinePercent',
  level: 'resistanceLevel',
  resistance: 'resistanceLevel',
  floors: 'floors',
  steps: 'steps',
  strokeRate: 'strokeRate',
  poolLength: 'poolLengthM',
  laps: 'laps',
  notes: 'notes',
};

const COLUMNS: CardioColumn[] = [
  'name',
  'distanceM',
  'speedKmh',
  'speedSetting',
  'inclinePercent',
  'resistanceLevel',
  'floors',
  'steps',
  'strokeRate',
  'poolLengthM',
  'laps',
  'notes',
];

// A figure from an API that predates it arrives missing, not null: either way, it isn't known.
function known<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function trimNumber(value: number, decimals: number): string {
  return String(Number(value.toFixed(decimals)));
}

const round = (value: number, decimals: number) =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;

/** "5 km", "4.83 km", "1,609.34 km" -- kilometres for everyone. */
export function formatKm(metres: number): string {
  return `${(metres / 1000).toLocaleString('en-US', { maximumFractionDigits: 2 })} km`;
}

/** "20 min", "20:30", "1h 5m" -- a whole number of minutes reads as minutes. */
export function formatCardioTime(seconds: number): string {
  if (seconds % 60 !== 0) return formatDuration(seconds);
  const minutes = seconds / 60;
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes} min`;
}

/** An activity's average speed in km/h: as typed (a speed, pace or split), else from its distance and time. */
export function averageSpeedKmh(entry: {
  durationSeconds: number;
  distanceM?: number | null;
  speedKmh?: number | null;
}): number | null {
  if (known(entry.speedKmh) && entry.speedKmh > 0) return entry.speedKmh;
  if (!known(entry.distanceM) || entry.distanceM <= 0 || entry.durationSeconds <= 0) return null;
  return entry.distanceM / 1000 / (entry.durationSeconds / 3600);
}

/** How many seconds one length of a rate's distance takes at a speed. */
function secondsPer(kmh: number, metres: number): number | null {
  const seconds = metres / 1000 / (kmh / 3600);
  return Number.isFinite(seconds) && seconds > 0 && seconds <= 86_400 ? seconds : null;
}

const RATE_METRES: Record<Exclude<CardioRate, 'speed'>, number> = {
  pace: 1000,
  split: 500,
  swimPace: 100,
};

const RATE_SUFFIX: Record<Exclude<CardioRate, 'speed'>, string> = {
  pace: '/km',
  split: '/500 m',
  swimPace: '/100 m',
};

/** A time per distance as typed and shown: "5:30", a split to a tenth ("1:47.3"). */
function formatPer(seconds: number, tenths: boolean): string {
  if (!tenths) return formatDuration(seconds);
  const whole = Math.floor(round(seconds, 1));
  const tenth = Math.round((round(seconds, 1) - whole) * 10);
  return tenth === 0 ? formatDuration(whole) : `${formatDuration(whole)}.${tenth}`;
}

/** "24.5 km/h". */
export function formatKmh(kmh: number): string {
  return `${trimNumber(kmh, 1)} km/h`;
}

/** A speed told as its rate: "5:30 /km", "2:05 /500 m", "2:00 /100 m" or "24.5 km/h". */
export function formatRate(kmh: number, rate: CardioRate): string | null {
  if (!(kmh > 0)) return null;
  if (rate === 'speed') return formatKmh(kmh);
  const seconds = secondsPer(kmh, RATE_METRES[rate]);
  return seconds === null ? null : `${formatPer(seconds, rate === 'split')} ${RATE_SUFFIX[rate]}`;
}

/** What a rate is called: Pace, Speed or Split. */
export function rateLabel(rate: CardioRate): string {
  return rate === 'speed' ? 'Speed' : rate === 'split' ? 'Split' : 'Pace';
}

/** An activity's name as shown: its own for "Other", once one's given. */
export function cardioName(entry: { activity: CardioActivity; name?: string | null }): string {
  return entry.activity === 'other' && entry.name ? entry.name : CARDIO_INFO[entry.activity].label;
}

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/**
 * Its figures in one line, in the order they matter ("30 min · 5 km · 6:00 /km", "20 min ·
 * 4.8 km · Speed 6.5 · 2.5% incline") -- only what was saved, never calories. A figure an older
 * version of the activity asked for (a rower's damper) still shows.
 */
export function cardioDetails(entry: CardioValues): string {
  const info = CARDIO_INFO[entry.activity];
  const parts = [formatCardioTime(entry.durationSeconds)];
  if (known(entry.distanceM)) parts.push(formatKm(entry.distanceM));
  if (info.rate && info.showsRate) {
    const speed = averageSpeedKmh(entry);
    const rate = speed === null ? null : formatRate(speed, info.rate);
    if (rate) parts.push(rate);
  } else if (known(entry.speedKmh)) {
    // A machine speed typed in km/h or mph before speeds were the machine's own number.
    parts.push(formatKmh(entry.speedKmh));
  }
  if (known(entry.speedSetting)) parts.push(`Speed ${trimNumber(entry.speedSetting, 1)}`);
  if (known(entry.inclinePercent)) parts.push(`${trimNumber(entry.inclinePercent, 1)}% incline`);
  if (known(entry.resistanceLevel)) parts.push(`${info.levelLabel} ${entry.resistanceLevel}`);
  if (known(entry.floors)) parts.push(plural(entry.floors, 'floor', 'floors'));
  if (known(entry.steps)) parts.push(plural(entry.steps, 'step', 'steps'));
  if (known(entry.strokeRate)) parts.push(`${entry.strokeRate} spm`);
  if (known(entry.laps)) {
    parts.push(
      known(entry.poolLengthM)
        ? `${plural(entry.laps, 'lap', 'laps')} of ${trimNumber(entry.poolLengthM, 2)} m`
        : plural(entry.laps, 'lap', 'laps'),
    );
  } else if (known(entry.poolLengthM)) {
    parts.push(`${trimNumber(entry.poolLengthM, 2)} m pool`);
  }
  return parts.join(' · ');
}

/** One of an activity's figures as a page lays it out: "Distance" over "5 km". */
export interface CardioFigure {
  key: string;
  label: string;
  value: string;
}

/**
 * Its figures one by one, labelled, in the same order as `cardioDetails` -- its time first, then
 * only what was saved (a figure an older version of the activity asked for still shows).
 */
export function cardioFigures(entry: CardioValues): CardioFigure[] {
  const info = CARDIO_INFO[entry.activity];
  const figures: CardioFigure[] = [
    { key: 'time', label: 'Time', value: formatCardioTime(entry.durationSeconds) },
  ];
  if (known(entry.distanceM)) {
    figures.push({ key: 'distance', label: 'Distance', value: formatKm(entry.distanceM) });
  }
  if (info.rate && info.showsRate) {
    const speed = averageSpeedKmh(entry);
    const rate = speed === null ? null : formatRate(speed, info.rate);
    if (rate) figures.push({ key: 'rate', label: rateLabel(info.rate), value: rate });
  } else if (known(entry.speedKmh)) {
    figures.push({ key: 'rate', label: 'Speed', value: formatKmh(entry.speedKmh) });
  }
  if (known(entry.speedSetting)) {
    figures.push({ key: 'speed', label: 'Speed', value: trimNumber(entry.speedSetting, 1) });
  }
  if (known(entry.inclinePercent)) {
    figures.push({
      key: 'incline',
      label: 'Incline',
      value: `${trimNumber(entry.inclinePercent, 1)}%`,
    });
  }
  if (known(entry.resistanceLevel)) {
    figures.push({ key: 'level', label: info.levelLabel, value: String(entry.resistanceLevel) });
  }
  if (known(entry.floors)) {
    figures.push({ key: 'floors', label: 'Floors', value: entry.floors.toLocaleString('en-US') });
  }
  if (known(entry.steps)) {
    figures.push({ key: 'steps', label: 'Steps', value: entry.steps.toLocaleString('en-US') });
  }
  if (known(entry.strokeRate)) {
    figures.push({ key: 'strokeRate', label: 'Stroke rate', value: `${entry.strokeRate} spm` });
  }
  if (known(entry.laps)) {
    figures.push({ key: 'laps', label: 'Laps', value: entry.laps.toLocaleString('en-US') });
  }
  if (known(entry.poolLengthM)) {
    figures.push({ key: 'pool', label: 'Pool', value: `${trimNumber(entry.poolLengthM, 2)} m` });
  }
  return figures;
}

/** A workout's cardio all together: its time, the distance of the ones with one, and how many. */
export function cardioTotals(entries: CardioValues[]): {
  seconds: number;
  /** Null when none of them has a distance. */
  distanceM: number | null;
  count: number;
} {
  let seconds = 0;
  let distanceM: number | null = null;
  for (const entry of entries) {
    seconds += entry.durationSeconds;
    if (known(entry.distanceM)) distanceM = (distanceM ?? 0) + entry.distanceM;
  }
  return { seconds, distanceM, count: entries.length };
}

/** Which activity two entries are "the same" as: an "Other" by its name, the rest by their activity. */
export function cardioKey(entry: { activity: CardioActivity; name?: string | null }): string {
  return entry.activity === 'other'
    ? `other:${(entry.name ?? '').trim().toLowerCase()}`
    : entry.activity;
}

/**
 * The last time an activity like this one (an "Other" by its name) was done, from the activities
 * done lately, most recent first (useRecentCardio) -- if it ever was.
 */
export function lastTimeFor<T extends { activity: CardioActivity; name?: string | null }>(
  recent: T[],
  entry: { activity: CardioActivity; name?: string | null },
): T | null {
  const key = cardioKey(entry);
  return recent.find((candidate) => cardioKey(candidate) === key) ?? null;
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
    a.durationSeconds === b.durationSeconds &&
    COLUMNS.every((column) => (a[column] ?? null) === (b[column] ?? null))
  );
}

/** An empty draft for an activity: what Add Cardio opens on. */
export function emptyCardioDraft(activity: CardioActivity = 'treadmill'): CardioDraft {
  return {
    activity,
    duration: '',
    name: '',
    distance: '',
    speedSetting: '',
    pace: '',
    avgSpeed: '',
    split: '',
    incline: '',
    level: '',
    resistance: '',
    floors: '',
    steps: '',
    strokeRate: '',
    poolLength: '',
    laps: '',
    notes: '',
  };
}

/** A swim's distance from its laps and pool length; null without both. */
export function swimDistanceM(laps: number | null, poolLengthM: number | null): number | null {
  return known(laps) && known(poolLengthM) ? round(laps * poolLengthM, 2) : null;
}

/** A saved time as its field shows it: minutes when whole ("20"), else minutes:seconds. */
function formatDurationField(seconds: number): string {
  return seconds % 60 === 0 ? String(seconds / 60) : formatDuration(seconds);
}

/** A speed as a rate's field shows it ("5:30", "1:47.3", "24.5"). */
function rateField(kmh: number, rate: CardioRate): string {
  if (rate === 'speed') return trimNumber(kmh, 2);
  const seconds = secondsPer(kmh, RATE_METRES[rate]);
  return seconds === null ? '' : formatPer(seconds, rate === 'split');
}

/**
 * What a saved activity shows in its fields -- only the ones its activity asks for, so a figure an
 * older version of it held (a rower's damper) never carries into another activity when switching.
 */
export function draftFromCardio(entry: CardioValues): CardioDraft {
  const draft = emptyCardioDraft(entry.activity);
  const asks = new Set(cardioFieldsOf(entry.activity));
  const fill = (
    field: CardioField,
    value: number | string | null | undefined,
    text: () => string,
  ) => {
    if (asks.has(field) && known(value)) draft[field] = text();
  };
  draft.duration = formatDurationField(entry.durationSeconds);
  fill('name', entry.name, () => entry.name ?? '');
  // A swim's distance worked out from its laps stays worked out, so changing the laps moves it.
  const fromLaps = swimDistanceM(entry.laps ?? null, entry.poolLengthM ?? null);
  const derived =
    entry.activity === 'swimming' &&
    fromLaps !== null &&
    known(entry.distanceM) &&
    Math.abs(fromLaps - entry.distanceM) < 0.5;
  if (!derived) fill('distance', entry.distanceM, () => trimNumber(entry.distanceM! / 1000, 3));
  fill('speedSetting', entry.speedSetting, () => trimNumber(entry.speedSetting!, 1));
  fill('pace', entry.speedKmh, () => rateField(entry.speedKmh!, 'pace'));
  fill('avgSpeed', entry.speedKmh, () => rateField(entry.speedKmh!, 'speed'));
  fill('split', entry.speedKmh, () => rateField(entry.speedKmh!, 'split'));
  fill('incline', entry.inclinePercent, () => trimNumber(entry.inclinePercent!, 1));
  fill('level', entry.resistanceLevel, () => String(entry.resistanceLevel));
  fill('resistance', entry.resistanceLevel, () => String(entry.resistanceLevel));
  fill('floors', entry.floors, () => String(entry.floors));
  fill('steps', entry.steps, () => String(entry.steps));
  fill('strokeRate', entry.strokeRate, () => String(entry.strokeRate));
  fill('poolLength', entry.poolLengthM, () => trimNumber(entry.poolLengthM!, 2));
  fill('laps', entry.laps, () => String(entry.laps));
  fill('notes', entry.notes, () => entry.notes ?? '');
  return draft;
}

type Parsed = { ok: true; value: number | string | null } | { ok: false };

/** An optional number in [min, max] to `decimals` places: blank is null. */
function decimalIn(text: string, min: number, max: number, decimals: number): Parsed {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return { ok: true, value: null };
  if (!/^-?\d+(\.\d+)?$/.test(trimmed) && !/^-?\.\d+$/.test(trimmed)) return { ok: false };
  const value = round(Number(trimmed), decimals);
  return value >= min && value <= max ? { ok: true, value } : { ok: false };
}

/** An optional whole number in [min, max]: blank is null. */
function wholeIn(text: string, min: number, max: number): Parsed {
  const trimmed = text.trim().replace(/,/g, '');
  if (trimmed === '') return { ok: true, value: null };
  if (!/^\d+$/.test(trimmed)) return { ok: false };
  const value = Number(trimmed);
  return value >= min && value <= max ? { ok: true, value } : { ok: false };
}

/**
 * An optional time per distance ("5:30", or minutes "5.5"; a split to a tenth, "1:47.3") in
 * [min, max] seconds, as the km/h it stands for: blank is null.
 */
function rateIn(text: string, metres: number, min: number, max: number): Parsed {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, value: null };
  let seconds: number | null = null;
  const clock = /^(\d{1,2}):(\d{2})(\.\d)?$/.exec(trimmed);
  if (clock) {
    const secs = Number(clock[2]) + Number(clock[3] ?? 0);
    if (secs < 60) seconds = Number(clock[1]) * 60 + secs;
  } else if (/^\d+(\.\d+)?$/.test(trimmed)) {
    seconds = Number(trimmed) * 60;
  }
  if (seconds === null || seconds < min || seconds > max) return { ok: false };
  return { ok: true, value: round(metres / 1000 / (seconds / 3600), 2) };
}

/** A typed text, trimmed, up to `max` characters: blank is null. */
function textUpTo(text: string, max: number): Parsed {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, value: null };
  return trimmed.length <= max ? { ok: true, value: trimmed } : { ok: false };
}

/** How each typed figure is read, and what's said when it can't be. */
const READ: Record<CardioField, { read: (text: string) => Parsed; problem: string }> = {
  name: { read: (t) => textUpTo(t, 60), problem: 'Keep the name to 60 characters.' },
  distance: {
    read: (t) => {
      const km = decimalIn(t, 0.001, 1000, 3);
      return km.ok && typeof km.value === 'number'
        ? { ok: true, value: round(km.value * 1000, 2) }
        : km;
    },
    problem: 'Enter the distance in kilometres, like 5 or 5.2.',
  },
  speedSetting: {
    read: (t) => decimalIn(t, 0.1, 500, 1),
    problem: 'Enter the speed as the machine shows it, like 6.5.',
  },
  pace: {
    read: (t) => rateIn(t, 1000, 60, 3600),
    problem: 'Enter the pace as minutes and seconds per km, like 5:30.',
  },
  avgSpeed: {
    read: (t) => decimalIn(t, 0.1, 100, 2),
    problem: 'Enter the average speed in km/h, like 25.',
  },
  split: {
    read: (t) => rateIn(t, 500, 50, 600),
    problem: 'Enter the split as minutes and seconds per 500 m, like 2:05.',
  },
  incline: {
    read: (t) => decimalIn(t, -10, 40, 1),
    problem: 'Enter the incline as a percentage, from -10 to 40.',
  },
  level: {
    read: (t) => wholeIn(t, 1, 50),
    problem: 'Enter the level as a whole number from 1 to 50.',
  },
  resistance: {
    read: (t) => wholeIn(t, 1, 50),
    problem: 'Enter the resistance as a whole number from 1 to 50.',
  },
  floors: {
    read: (t) => wholeIn(t, 1, 10_000),
    problem: 'Enter the floors as a whole number.',
  },
  steps: {
    read: (t) => wholeIn(t, 1, 100_000),
    problem: 'Enter the steps as a whole number.',
  },
  strokeRate: {
    read: (t) => wholeIn(t, 1, 100),
    problem: 'Enter the stroke rate in strokes a minute, from 1 to 100.',
  },
  poolLength: {
    read: (t) => decimalIn(t, 5, 100, 2),
    problem: 'Enter the pool length in metres, from 5 to 100.',
  },
  laps: {
    read: (t) => wholeIn(t, 1, 10_000),
    problem: 'Enter the laps as a whole number.',
  },
  notes: { read: (t) => textUpTo(t, 500), problem: 'Keep the notes to 500 characters.' },
};

/** Why a draft can't be saved, and which field to fix ('duration' for its time). */
export interface CardioProblem {
  problem: string;
  field: CardioField | 'duration';
}

/**
 * A draft's figures as saved, or why it can't be: a time is required, everything else is
 * optional, and only the figures its activity asks for are taken from it -- switching activity
 * leaves no stray incline on a swim. Changing a saved activity (`original`) keeps what it holds
 * that its activity no longer asks for (an older rower's damper, an older treadmill's speed in
 * km/h), unless the activity itself changed. A swim's distance, left blank, is its laps times its
 * pool length.
 */
export function cardioValues(
  draft: CardioDraft,
  original: CardioValues | null = null,
): { values: CardioValues } | CardioProblem {
  const durationSeconds = parseCardioTime(draft.duration);
  if (durationSeconds === null) {
    return {
      problem: 'Enter how long it took, in minutes (20) or minutes and seconds (20:30).',
      field: 'duration',
    };
  }
  const kept = original && original.activity === draft.activity ? original : null;
  const values: CardioValues = {
    activity: draft.activity,
    durationSeconds,
    name: null,
    distanceM: null,
    speedKmh: null,
    speedSetting: null,
    inclinePercent: null,
    resistanceLevel: null,
    floors: null,
    steps: null,
    strokeRate: null,
    poolLengthM: null,
    laps: null,
    notes: null,
  };
  const asked = new Set<CardioColumn>();
  for (const field of cardioFieldsOf(draft.activity)) {
    const { read, problem } = READ[field];
    const parsed = read(draft[field]);
    if (!parsed.ok) return { problem, field };
    const column = FIELD_COLUMN[field];
    asked.add(column);
    (values as unknown as Record<CardioColumn, number | string | null>)[column] = parsed.value;
  }
  if (kept) {
    for (const column of COLUMNS) {
      if (!asked.has(column)) {
        (values as unknown as Record<CardioColumn, number | string | null>)[column] =
          kept[column] ?? null;
      }
    }
  }
  if (draft.activity === 'swimming' && values.distanceM === null) {
    values.distanceM = swimDistanceM(values.laps, values.poolLengthM);
  }
  return { values };
}

/**
 * What the typed figures work out to, said under them as they're typed ("Pace 5:30 /km ·
 * 10.9 km/h"; a swim's distance from its laps) -- only from what's typed, or nothing.
 */
export function cardioReadout(draft: CardioDraft): string | null {
  const info = CARDIO_INFO[draft.activity];
  const asks = new Set(cardioFieldsOf(draft.activity));
  // A figure as it's typed so far, or null while it isn't one.
  const typed = (field: CardioField): number | null => {
    if (!asks.has(field)) return null;
    const parsed = READ[field].read(draft[field]);
    return parsed.ok && typeof parsed.value === 'number' ? parsed.value : null;
  };
  const parts: string[] = [];
  let distanceM = typed('distance');
  if (draft.activity === 'swimming' && draft.distance.trim() === '') {
    distanceM = swimDistanceM(typed('laps'), typed('poolLength'));
    if (distanceM !== null) parts.push(`${formatKm(distanceM)} from your laps`);
  }
  const durationSeconds = parseCardioTime(draft.duration);
  const speed =
    typed('pace') ??
    typed('avgSpeed') ??
    typed('split') ??
    (durationSeconds === null ? null : averageSpeedKmh({ durationSeconds, distanceM }));
  if (info.rate && speed !== null) {
    const rate = formatRate(speed, info.rate);
    if (rate) parts.push(`${rateLabel(info.rate)} ${rate}`);
    if (info.rate !== 'speed') parts.push(formatKmh(speed));
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * The activities in the order Add Cardio offers them: the ones used last first (most recent
 * leading), then the rest in their usual order -- so the usual one is always the first tap.
 */
export function activitiesInOrder(recent: CardioActivity[]): CardioActivity[] {
  const first = [...new Set(recent)].filter((activity) => CARDIO_ACTIVITIES.includes(activity));
  return [...first, ...CARDIO_ACTIVITIES.filter((activity) => !first.includes(activity))];
}
