import AsyncStorage from '@react-native-async-storage/async-storage';

// Which reminders the person wants, and when -- Settings > Notifications. Kept on the phone,
// like the app theme: the reminders are scheduled on it (notifications/reminderPlan.ts), so
// another phone has its own. A time is minutes after midnight; a day is 0 (Sunday) to 6.

export interface ReminderSettings {
  /** Training nudges: after a couple of days without a workout, what's up next in their split
   * or a muscle they haven't trained in a while (reminderPlan.ts) -- no days or time to set. */
  workout: { on: boolean };
  /** Nutrition only: log the day's meals, unless something's logged already. */
  meals: { on: boolean; time: number };
  /** Nutrition only: the day's calories and protein against the targets. */
  checkIn: { on: boolean; time: number };
  /** Sundays: the week's summary is ready. */
  weekly: { on: boolean; time: number };
  /** On finishing a workout with a new PR, right away. */
  prCheers: { on: boolean };
}

/**
 * Every reminder on, at sensible times -- once someone has said yes to notifications, they get
 * the ones their membership covers, and can turn any off. The weekly summary comes as Sunday
 * starts, at 12:00 AM.
 */
export function defaultReminderSettings(): ReminderSettings {
  return {
    workout: { on: true },
    meals: { on: true, time: 12 * 60 + 30 },
    checkIn: { on: true, time: 20 * 60 },
    weekly: { on: true, time: 0 },
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
  const time = (kind: 'meals' | 'checkIn' | 'weekly') =>
    isTime(stored[kind]?.time) ? (stored[kind]!.time as number) : defaults[kind].time;
  // A workout reminder's days and time, saved before nudges replaced it, are left behind.
  return {
    workout: { on: on('workout') },
    meals: { on: on('meals'), time: time('meals') },
    checkIn: { on: on('checkIn'), time: time('checkIn') },
    weekly: { on: on('weekly'), time: time('weekly') },
    prCheers: { on: on('prCheers') },
  };
}

export async function loadReminderSettings(userId: string): Promise<ReminderSettings> {
  const defaults = defaultReminderSettings();
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
