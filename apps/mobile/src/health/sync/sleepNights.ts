// Each night's sleep from Apple Health's sleep samples -- Apple Watch's stages, an iPhone's
// bedtime, another app's -- as one sleep a night, from one source, never added together.
//
// Apple Health keeps every source's samples side by side (a watch and a sleep app both record the
// same night), so a night is made from one source alone: the one with stages, else the one with
// the most time asleep. Within that source, samples less than two hours apart are one sleep, and a
// day's sleep is its longest that ended that day (the morning it ended, on the phone's own day).
// Naps are left for later; a day's sleep totals never count them anyway.

/** Apple Health's sleep values (HKCategoryValueSleepAnalysis). */
export const SLEEP_VALUE = {
  inBed: 0,
  asleepUnspecified: 1,
  awake: 2,
  asleepCore: 3,
  asleepDeep: 4,
  asleepREM: 5,
} as const;

export interface SleepSample {
  value: number;
  start: Date;
  end: Date;
  /** The app or device that wrote it (its bundle id). */
  source: string;
  /** What measured it, as Health names it ("Apple Watch"), where known. */
  device?: string | null;
}

export interface SleepNight {
  /** "night:YYYY-MM-DD": the same night keeps the same one as more of it comes in. */
  sourceRef: string;
  day: string;
  startedAt: string;
  endedAt: string;
  inBedS: number;
  /** Null for a source that only knows when someone was in bed (an iPhone's bedtime). */
  asleepS: number | null;
  awakeS: number | null;
  remS: number | null;
  lightS: number | null;
  deepS: number | null;
  device: string | null;
}

/** Samples less than this apart are one sleep (a wake in the night isn't a new one). */
const SAME_SLEEP_GAP_MS = 2 * 60 * 60 * 1000;
/** Longer than this is no one sleep the server would take. */
const LONGEST_SLEEP_MS = 24 * 60 * 60 * 1000;

const ASLEEP: ReadonlySet<number> = new Set([
  SLEEP_VALUE.asleepUnspecified,
  SLEEP_VALUE.asleepCore,
  SLEEP_VALUE.asleepDeep,
  SLEEP_VALUE.asleepREM,
]);
const STAGES: ReadonlySet<number> = new Set([
  SLEEP_VALUE.asleepCore,
  SLEEP_VALUE.asleepDeep,
  SLEEP_VALUE.asleepREM,
]);

/** The phone's own calendar day of a moment, "YYYY-MM-DD". */
export function localDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Seconds covered by intervals, overlaps counted once. */
function coveredSeconds(intervals: { start: number; end: number }[]): number {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  let total = 0;
  let current: { start: number; end: number } | null = null;
  for (const interval of sorted) {
    if (!current || interval.start > current.end) {
      if (current) total += current.end - current.start;
      current = { ...interval };
    } else {
      current.end = Math.max(current.end, interval.end);
    }
  }
  if (current) total += current.end - current.start;
  return Math.round(total / 1000);
}

interface Session {
  source: string;
  samples: SleepSample[];
  start: number;
  end: number;
}

function sessionsOf(samples: SleepSample[]): Session[] {
  const sorted = [...samples].sort((a, b) => a.start.getTime() - b.start.getTime());
  const sessions: Session[] = [];
  for (const sample of sorted) {
    const start = sample.start.getTime();
    const end = sample.end.getTime();
    if (!(end > start)) continue;
    const last = sessions[sessions.length - 1];
    if (last && start - last.end < SAME_SLEEP_GAP_MS) {
      last.samples.push(sample);
      last.end = Math.max(last.end, end);
    } else {
      sessions.push({ source: sample.source, samples: [sample], start, end });
    }
  }
  return sessions;
}

function seconds(samples: SleepSample[], values: ReadonlySet<number>): number {
  return coveredSeconds(
    samples
      .filter((s) => values.has(s.value))
      .map((s) => ({ start: s.start.getTime(), end: s.end.getTime() })),
  );
}

function nightOf(session: Session): SleepNight {
  const { samples } = session;
  const hasStages = samples.some((s) => STAGES.has(s.value));
  const asleep = seconds(samples, ASLEEP);
  const awake = samples.some((s) => s.value === SLEEP_VALUE.awake)
    ? seconds(samples, new Set([SLEEP_VALUE.awake]))
    : null;
  const ended = new Date(session.end);
  const day = localDayKey(ended);
  return {
    sourceRef: `night:${day}`,
    day,
    startedAt: new Date(session.start).toISOString(),
    endedAt: ended.toISOString(),
    // Time in bed: everything the source recorded for that sleep, overlaps once.
    inBedS: coveredSeconds(
      samples.map((s) => ({ start: s.start.getTime(), end: s.end.getTime() })),
    ),
    asleepS: asleep > 0 ? asleep : null,
    awakeS: awake,
    remS: hasStages ? seconds(samples, new Set([SLEEP_VALUE.asleepREM])) : null,
    lightS: hasStages ? seconds(samples, new Set([SLEEP_VALUE.asleepCore])) : null,
    deepS: hasStages ? seconds(samples, new Set([SLEEP_VALUE.asleepDeep])) : null,
    device: samples.find((s) => s.device)?.device ?? null,
  };
}

/** Which of two candidate nights for one day is the one kept: stages first, then time asleep. */
function better(a: SleepNight, b: SleepNight): SleepNight {
  const stages = (n: SleepNight) => (n.remS !== null ? 1 : 0);
  if (stages(a) !== stages(b)) return stages(a) > stages(b) ? a : b;
  if ((a.asleepS ?? 0) !== (b.asleepS ?? 0)) return (a.asleepS ?? 0) > (b.asleepS ?? 0) ? a : b;
  return a.inBedS >= b.inBedS ? a : b;
}

/** One sleep a day, the days in `days` only, oldest first. */
export function sleepNights(samples: SleepSample[], days: ReadonlySet<string>): SleepNight[] {
  const bySource = new Map<string, SleepSample[]>();
  for (const sample of samples) {
    const list = bySource.get(sample.source) ?? [];
    list.push(sample);
    bySource.set(sample.source, list);
  }
  const byDay = new Map<string, SleepNight>();
  for (const sourceSamples of bySource.values()) {
    // Each source's longest sleep a day.
    const longest = new Map<string, Session>();
    for (const session of sessionsOf(sourceSamples)) {
      if (session.end - session.start > LONGEST_SLEEP_MS) continue;
      const day = localDayKey(new Date(session.end));
      const kept = longest.get(day);
      if (!kept || session.end - session.start > kept.end - kept.start) longest.set(day, session);
    }
    for (const [day, session] of longest) {
      if (!days.has(day)) continue;
      const night = nightOf(session);
      const kept = byDay.get(day);
      byDay.set(day, kept ? better(kept, night) : night);
    }
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}
