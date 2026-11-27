// The health metrics Progresso stores (Phase 2 of the Health & Wearables brief): each with one
// canonical unit, the range a real value falls in, the sources that measure it, and whether it's
// an overnight measurement. The same list is health_metric_definitions in the database
// (supabase/migrations/20261224100000_health_data.sql) -- health-metrics.spec.ts checks the two
// agree, so a metric is added to both, by migration.

export const HEALTH_PROVIDERS = ['apple_health', 'oura', 'manual'] as const;
export type HealthProvider = (typeof HEALTH_PROVIDERS)[number];

export interface HealthMetricDefinition {
  metric: string;
  unit: string;
  min: number;
  max: number;
  sources: readonly HealthProvider[];
  overnight: boolean;
}

export const HEALTH_METRICS = [
  {
    metric: 'steps',
    unit: 'count',
    min: 0,
    max: 200000,
    sources: ['apple_health', 'oura'],
    overnight: false,
  },
  {
    metric: 'distance_m',
    unit: 'm',
    min: 0,
    max: 500000,
    sources: ['apple_health', 'oura'],
    overnight: false,
  },
  {
    metric: 'active_energy_kcal',
    unit: 'kcal',
    min: 0,
    max: 15000,
    sources: ['apple_health', 'oura'],
    overnight: false,
  },
  {
    metric: 'exercise_min',
    unit: 'min',
    min: 0,
    max: 1440,
    sources: ['apple_health'],
    overnight: false,
  },
  {
    metric: 'heart_rate_avg_bpm',
    unit: 'bpm',
    min: 20,
    max: 250,
    sources: ['apple_health', 'oura'],
    overnight: false,
  },
  {
    metric: 'resting_hr_bpm',
    unit: 'bpm',
    min: 20,
    max: 200,
    sources: ['apple_health', 'oura'],
    overnight: true,
  },
  {
    metric: 'hrv_sdnn_ms',
    unit: 'ms',
    min: 1,
    max: 400,
    sources: ['apple_health'],
    overnight: true,
  },
  { metric: 'hrv_rmssd_ms', unit: 'ms', min: 1, max: 400, sources: ['oura'], overnight: true },
  {
    metric: 'respiratory_rate',
    unit: 'breaths/min',
    min: 4,
    max: 60,
    sources: ['apple_health', 'oura'],
    overnight: true,
  },
  {
    metric: 'spo2_pct',
    unit: '%',
    min: 50,
    max: 100,
    sources: ['apple_health', 'oura'],
    overnight: true,
  },
  {
    metric: 'wrist_temp_c',
    unit: 'degC',
    min: 30,
    max: 42,
    sources: ['apple_health'],
    overnight: true,
  },
  { metric: 'temp_deviation_c', unit: 'degC', min: -5, max: 5, sources: ['oura'], overnight: true },
  {
    metric: 'vo2max',
    unit: 'ml/kg/min',
    min: 10,
    max: 100,
    sources: ['apple_health'],
    overnight: false,
  },
  {
    metric: 'hr_recovery_bpm',
    unit: 'bpm',
    min: 0,
    max: 150,
    sources: ['apple_health'],
    overnight: false,
  },
  {
    metric: 'sleep_asleep_s',
    unit: 's',
    min: 0,
    max: 86400,
    sources: ['apple_health', 'oura', 'manual'],
    overnight: true,
  },
  {
    metric: 'sleep_in_bed_s',
    unit: 's',
    min: 0,
    max: 86400,
    sources: ['apple_health', 'oura', 'manual'],
    overnight: true,
  },
  { metric: 'oura_readiness', unit: 'score', min: 0, max: 100, sources: ['oura'], overnight: true },
] as const satisfies readonly HealthMetricDefinition[];

export type HealthMetric = (typeof HEALTH_METRICS)[number]['metric'];

const BY_METRIC = new Map<string, HealthMetricDefinition>(HEALTH_METRICS.map((d) => [d.metric, d]));

export function healthMetric(metric: string): HealthMetricDefinition | undefined {
  return BY_METRIC.get(metric);
}

/** A night's totals: worked out by the database from its sessions, never sent on their own. */
export const SLEEP_TOTAL_METRICS: readonly string[] = ['sleep_asleep_s', 'sleep_in_bed_s'];

// The units a value may arrive in, for each canonical unit, and how each becomes it. A value with
// no unit is taken to be in the canonical one.
const CONVERSIONS: Record<string, Record<string, (value: number) => number>> = {
  count: { count: (v) => v },
  m: { m: (v) => v, km: (v) => v * 1000, mi: (v) => v * 1609.344 },
  kcal: { kcal: (v) => v, kJ: (v) => v / 4.184 },
  min: { min: (v) => v, s: (v) => v / 60, h: (v) => v * 60 },
  bpm: { bpm: (v) => v, 'count/min': (v) => v },
  ms: { ms: (v) => v, s: (v) => v * 1000 },
  'breaths/min': { 'breaths/min': (v) => v, 'count/min': (v) => v },
  '%': { '%': (v) => v, fraction: (v) => v * 100 },
  degC: { degC: (v) => v, degF: (v) => ((v - 32) * 5) / 9 },
  'ml/kg/min': { 'ml/kg/min': (v) => v },
  s: { s: (v) => v, min: (v) => v * 60, h: (v) => v * 3600 },
  score: { score: (v) => v },
};

/** How finely each canonical unit is kept: whole counts, else hundredths. */
const WHOLE_UNITS = new Set(['count', 's', 'score']);

/**
 * A value in its metric's canonical unit, or why it can't be one: an unknown unit, or a value
 * outside the metric's range (a resting heart rate of 400 is refused, never stored).
 */
export function toCanonical(
  definition: HealthMetricDefinition,
  value: number,
  unit?: string,
): { value: number } | { reason: string } {
  if (!Number.isFinite(value)) return { reason: 'not a number' };
  const from = unit ?? definition.unit;
  let converted: number;
  // A difference in temperature has no offset: 1 degF of difference is 5/9 degC.
  if (definition.metric === 'temp_deviation_c' && from === 'degF') {
    converted = (value * 5) / 9;
  } else {
    const convert = CONVERSIONS[definition.unit]?.[from];
    if (!convert) return { reason: `${definition.metric} can't be in ${from}` };
    converted = convert(value);
  }
  const rounded = WHOLE_UNITS.has(definition.unit)
    ? Math.round(converted)
    : Math.round(converted * 100) / 100;
  if (rounded < definition.min || rounded > definition.max) {
    return {
      reason: `${definition.metric} of ${rounded} is outside ${definition.min} to ${definition.max}`,
    };
  }
  return { value: rounded };
}
