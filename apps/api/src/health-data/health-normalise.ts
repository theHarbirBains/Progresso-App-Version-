import type { ClearedValueDto, HealthValueDto, SleepSessionDto } from './dto/health-import.dto';
import {
  healthMetric,
  SLEEP_TOTAL_METRICS,
  toCanonical,
  type HealthProvider,
} from './health-metrics';

// Turning what a source sent into what's stored: each value checked and put in its canonical
// unit, each sleep given its day. Anything that can't be stored is refused on its own, with why,
// so one bad reading never costs the rest of a sync.

/** How far back a day may be: a sync edits recent days; nothing older than this is real news. */
export const MAX_DAYS_BACK = 730;

export interface MetricRow {
  day: string;
  metric: string;
  value: number;
  device: string | null;
  sample_count: number | null;
  measured_at: string | null;
  source_ref: string | null;
}

export interface SleepRow {
  source_ref: string;
  device: string | null;
  started_at: string;
  ended_at: string;
  day: string;
  in_bed_s: number | null;
  asleep_s: number | null;
  awake_s: number | null;
  rem_s: number | null;
  light_s: number | null;
  deep_s: number | null;
  is_nap: boolean;
}

export interface Refused {
  kind: 'value' | 'cleared' | 'sleep';
  index: number;
  reason: string;
}

/** A real calendar day, no later than tomorrow (time zones ahead of UTC) nor too long ago. */
export function dayProblem(day: string, now: Date): string | null {
  const [y = NaN, m = NaN, d = NaN] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return `${day} isn't a day`;
  }
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.round((date.getTime() - today) / 86_400_000);
  if (days > 1) return `${day} hasn't happened yet`;
  if (days < -MAX_DAYS_BACK) return `${day} is more than ${MAX_DAYS_BACK} days ago`;
  return null;
}

/** A metric this source may send: known, measured by it, and not a sleep total. */
function metricProblem(metric: string, provider: HealthProvider): string | null {
  const definition = healthMetric(metric);
  if (!definition) return `${metric} isn't a health metric`;
  if (!definition.sources.includes(provider)) return `${metric} never comes from ${provider}`;
  if (SLEEP_TOTAL_METRICS.includes(metric)) return `${metric} comes from sleep sessions`;
  return null;
}

export function normaliseValues(
  provider: HealthProvider,
  values: HealthValueDto[],
  now: Date,
): { rows: MetricRow[]; refused: Refused[] } {
  const rows: MetricRow[] = [];
  const refused: Refused[] = [];
  values.forEach((input, index) => {
    const problem = metricProblem(input.metric, provider) ?? dayProblem(input.day, now);
    if (problem) {
      refused.push({ kind: 'value', index, reason: problem });
      return;
    }
    const canonical = toCanonical(healthMetric(input.metric)!, input.value, input.unit);
    if ('reason' in canonical) {
      refused.push({ kind: 'value', index, reason: canonical.reason });
      return;
    }
    rows.push({
      day: input.day,
      metric: input.metric,
      value: canonical.value,
      device: input.device ?? null,
      sample_count: input.sampleCount ?? null,
      measured_at: input.measuredAt ? new Date(input.measuredAt).toISOString() : null,
      source_ref: input.sourceRef ?? null,
    });
  });
  return { rows, refused };
}

export function normaliseCleared(
  provider: HealthProvider,
  cleared: ClearedValueDto[],
  now: Date,
): { rows: { day: string; metric: string }[]; refused: Refused[] } {
  const rows: { day: string; metric: string }[] = [];
  const refused: Refused[] = [];
  cleared.forEach((input, index) => {
    const problem = metricProblem(input.metric, provider) ?? dayProblem(input.day, now);
    if (problem) refused.push({ kind: 'cleared', index, reason: problem });
    else rows.push({ day: input.day, metric: input.metric });
  });
  return { rows, refused };
}

/** The person's own calendar day for a moment, in their time zone (UTC where it isn't known). */
export function localDay(at: Date, timeZone: string | null): string {
  const format = (zone: string) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(at);
  if (timeZone) {
    try {
      return format(timeZone);
    } catch {
      // An unknown zone: UTC below.
    }
  }
  return format('UTC');
}

/** How much longer than its own span a sleep's figure may be (clock rounding). */
const SPAN_TOLERANCE_S = 60;

export function normaliseSleep(
  sessions: SleepSessionDto[],
  timeZone: string | null,
  now: Date,
): { rows: SleepRow[]; refused: Refused[] } {
  const rows: SleepRow[] = [];
  const refused: Refused[] = [];
  sessions.forEach((input, index) => {
    const started = new Date(input.startedAt);
    const ended = new Date(input.endedAt);
    const span = (ended.getTime() - started.getTime()) / 1000;
    const refuse = (reason: string) => refused.push({ kind: 'sleep', index, reason });
    if (!(span > 0)) return refuse('it ends before it starts');
    if (span > 86_400) return refuse('it lasts more than 24 hours');
    // The morning it ended, in their own day.
    const day = localDay(ended, timeZone);
    const dayIssue = dayProblem(day, now);
    if (dayIssue) return refuse(dayIssue);
    const figures = [
      input.inBedS,
      input.asleepS,
      input.awakeS,
      input.remS,
      input.lightS,
      input.deepS,
    ];
    if (figures.some((s) => s !== undefined && s > span + SPAN_TOLERANCE_S)) {
      return refuse('a figure is longer than the sleep itself');
    }
    if (input.asleepS !== undefined && input.inBedS !== undefined && input.asleepS > input.inBedS) {
      return refuse('more time asleep than in bed');
    }
    rows.push({
      source_ref: input.sourceRef,
      device: input.device ?? null,
      started_at: started.toISOString(),
      ended_at: ended.toISOString(),
      day,
      in_bed_s: input.inBedS ?? null,
      asleep_s: input.asleepS ?? null,
      awake_s: input.awakeS ?? null,
      rem_s: input.remS ?? null,
      light_s: input.lightS ?? null,
      deep_s: input.deepS ?? null,
      is_nap: input.isNap ?? false,
    });
  });
  return { rows, refused };
}
