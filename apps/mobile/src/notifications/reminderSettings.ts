import AsyncStorage from '@react-native-async-storage/async-storage';

// Which reminders the person wants, and when -- Settings > Notifications. Kept on the phone,
// like the app theme: the reminders are scheduled on it (notifications/reminderPlan.ts), so
// another phone has its own. A time is minutes after midnight; a day is 0 (Sunday) to 6.

export interface ReminderSettings {
  /** On the days they train: their next split day. */
  workout: { on: boolean; time: number; days: number[] };
  /** Nutrition only: log the day's meals, unless something's logged already. */
  meals: { on: boolean; time: number };
  /** Nutrition only: the day's calories and protein against the targets. */
  checkIn: { on: boolean; time: number };
  /** Sundays: the week's summary is ready. */
  weekly: { on: boolean; time: number };
  /** On finishing a workout with a new PR, right away. */
  prCheers: { on: boolean };
}

/** The days a reminder starts on for someone who trains this many days a week (Monday first). */
const DAYS_FOR_FREQUENCY: Record<number, number[]> = {
  1: [1],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

/**
 * Every reminder on, at sensible times -- once someone has said yes to notifications, they get
 * the ones their membership covers, and can turn any off. The workout days follow how often
 * they said they train (three a week if they didn't say).
 */
export function defaultReminderSettings(workoutsAWeek: number | null): ReminderSettings {
  const frequency =
    workoutsAWeek && workoutsAWeek >= 1 ? Math.min(7, Math.round(workoutsAWeek)) : 3;
  return {
    workout: { on: true, time: 17 * 60, days: DAYS_FOR_FREQUENCY[frequency] },
    meals: { on: true, time: 12 * 60 + 30 },
    checkIn: { on: true, time: 20 * 60 },
    weekly: { on: true, time: 18 * 60 },
    prCheers: { on: true },
  };
}

function storageKey(userId: string): string {
  return `progresso.reminders.${userId}`;
}

function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 24 * 60;
}

/** What was saved, filled out with the defaults for anything missing or unreadable. */
export function readStoredSettings(
  raw: string | null,
  defaults: ReminderSettings,
): ReminderSettings {
  if (!raw) return defaults;
  let stored: Partial<Record<keyof ReminderSettings, Record<string, unknown>>>;
  try {
    stored = JSON.parse(raw) as typeof stored;
  } catch {
    return defaults;
  }
  if (!stored || typeof stored !== 'object') return defaults;
  const on = (kind: keyof ReminderSettings) =>
    typeof stored[kind]?.on === 'boolean' ? (stored[kind]!.on as boolean) : defaults[kind].on;
  const time = (kind: 'workout' | 'meals' | 'checkIn' | 'weekly') =>
    isTime(stored[kind]?.time) ? (stored[kind]!.time as number) : defaults[kind].time;
  const storedDays = stored.workout?.days;
  const days =
    Array.isArray(storedDays) &&
    storedDays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      ? Array.from(new Set(storedDays as number[])).sort((a, b) => a - b)
      : defaults.workout.days;
  return {
    workout: { on: on('workout'), time: time('workout'), days },
    meals: { on: on('meals'), time: time('meals') },
    checkIn: { on: on('checkIn'), time: time('checkIn') },
    weekly: { on: on('weekly'), time: time('weekly') },
    prCheers: { on: on('prCheers') },
  };
}

export async function loadReminderSettings(
  userId: string,
  workoutsAWeek: number | null,
): Promise<ReminderSettings> {
  const defaults = defaultReminderSettings(workoutsAWeek);
  try {
    return readStoredSettings(await AsyncStorage.getItem(storageKey(userId)), defaults);
  } catch {
    return defaults;
  }
}

export async function saveReminderSettings(
  userId: string,
  settings: ReminderSettings,
): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(settings));
}

/** "5:00 PM". */
export function timeLabel(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Mon, Wed, Fri", "Every day", "Weekdays", or "No days". Monday first. */
export function daysLabel(days: number[]): string {
  if (days.length === 7) return 'Every day';
  if (days.length === 0) return 'No days';
  const set = new Set(days);
  if (days.length === 5 && [1, 2, 3, 4, 5].every((day) => set.has(day))) return 'Weekdays';
  return [1, 2, 3, 4, 5, 6, 0]
    .filter((day) => set.has(day))
    .map((day) => DAY_NAMES[day])
    .join(', ');
}
