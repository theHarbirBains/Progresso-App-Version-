// What Progresso reads from Apple Health for Health (Phase 3 of the Health & Wearables brief): each
// metric the server stores (apps/api/src/health-data/health-metrics.ts), the HealthKit type it
// comes from, how a day's figure is made, the unit it's read in and the unit the server is told.
// A day's figure is HealthKit's own statistics query -- which merges iPhone and Apple Watch, so
// nothing is counted twice -- a total for what adds up (steps), an average for what doesn't.

export interface AppleHealthQuantity {
  metric: string;
  identifier:
    | 'HKQuantityTypeIdentifierStepCount'
    | 'HKQuantityTypeIdentifierDistanceWalkingRunning'
    | 'HKQuantityTypeIdentifierActiveEnergyBurned'
    | 'HKQuantityTypeIdentifierAppleExerciseTime'
    | 'HKQuantityTypeIdentifierHeartRate'
    | 'HKQuantityTypeIdentifierRestingHeartRate'
    | 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN'
    | 'HKQuantityTypeIdentifierRespiratoryRate'
    | 'HKQuantityTypeIdentifierOxygenSaturation'
    | 'HKQuantityTypeIdentifierAppleSleepingWristTemperature'
    | 'HKQuantityTypeIdentifierVO2Max'
    | 'HKQuantityTypeIdentifierHeartRateRecoveryOneMinute';
  statistic: 'cumulativeSum' | 'discreteAverage';
  /** The unit HealthKit is asked for. */
  healthKitUnit: string;
  /** The same unit as the server names it. */
  unit: string;
  /** How Health names it. */
  name: string;
}

export const APPLE_HEALTH_QUANTITIES: readonly AppleHealthQuantity[] = [
  {
    metric: 'steps',
    identifier: 'HKQuantityTypeIdentifierStepCount',
    statistic: 'cumulativeSum',
    healthKitUnit: 'count',
    unit: 'count',
    name: 'Steps',
  },
  {
    metric: 'distance_m',
    identifier: 'HKQuantityTypeIdentifierDistanceWalkingRunning',
    statistic: 'cumulativeSum',
    healthKitUnit: 'm',
    unit: 'm',
    name: 'Distance',
  },
  {
    metric: 'active_energy_kcal',
    identifier: 'HKQuantityTypeIdentifierActiveEnergyBurned',
    statistic: 'cumulativeSum',
    healthKitUnit: 'kcal',
    unit: 'kcal',
    name: 'Active Calories',
  },
  {
    metric: 'exercise_min',
    identifier: 'HKQuantityTypeIdentifierAppleExerciseTime',
    statistic: 'cumulativeSum',
    healthKitUnit: 'min',
    unit: 'min',
    name: 'Exercise',
  },
  {
    metric: 'heart_rate_avg_bpm',
    identifier: 'HKQuantityTypeIdentifierHeartRate',
    statistic: 'discreteAverage',
    healthKitUnit: 'count/min',
    unit: 'bpm',
    name: 'Heart Rate',
  },
  {
    metric: 'resting_hr_bpm',
    identifier: 'HKQuantityTypeIdentifierRestingHeartRate',
    statistic: 'discreteAverage',
    healthKitUnit: 'count/min',
    unit: 'bpm',
    name: 'Resting Heart Rate',
  },
  {
    metric: 'hrv_sdnn_ms',
    identifier: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
    statistic: 'discreteAverage',
    healthKitUnit: 'ms',
    unit: 'ms',
    name: 'HRV (SDNN)',
  },
  {
    metric: 'respiratory_rate',
    identifier: 'HKQuantityTypeIdentifierRespiratoryRate',
    statistic: 'discreteAverage',
    healthKitUnit: 'count/min',
    unit: 'breaths/min',
    name: 'Respiratory Rate',
  },
  // HealthKit's percent is a fraction (0.97).
  {
    metric: 'spo2_pct',
    identifier: 'HKQuantityTypeIdentifierOxygenSaturation',
    statistic: 'discreteAverage',
    healthKitUnit: '%',
    unit: 'fraction',
    name: 'Blood Oxygen',
  },
  {
    metric: 'wrist_temp_c',
    identifier: 'HKQuantityTypeIdentifierAppleSleepingWristTemperature',
    statistic: 'discreteAverage',
    healthKitUnit: 'degC',
    unit: 'degC',
    name: 'Wrist Temperature',
  },
  {
    metric: 'vo2max',
    identifier: 'HKQuantityTypeIdentifierVO2Max',
    statistic: 'discreteAverage',
    healthKitUnit: 'ml/kg*min',
    unit: 'ml/kg/min',
    name: 'VO₂ Max',
  },
  {
    metric: 'hr_recovery_bpm',
    identifier: 'HKQuantityTypeIdentifierHeartRateRecoveryOneMinute',
    statistic: 'discreteAverage',
    healthKitUnit: 'count/min',
    unit: 'bpm',
    name: 'Heart Rate Recovery',
  },
];

export const APPLE_HEALTH_SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis' as const;

/** Everything Health asks to read: each quantity and sleep. Never anything to write. */
export const APPLE_HEALTH_READ_TYPES = [
  ...APPLE_HEALTH_QUANTITIES.map((q) => q.identifier),
  APPLE_HEALTH_SLEEP,
] as const;

/**
 * What HealthKit wakes Progresso for in the background (at most about hourly): a night's sleep and
 * the day's main figures. The rest are read with them, so a wake-up brings everything in.
 */
export const APPLE_HEALTH_BACKGROUND_TYPES: readonly string[] = [
  APPLE_HEALTH_SLEEP,
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
];

/** Health's name for a metric the server stores, Apple Health's or a night's sleep. */
export function appleHealthMetricName(metric: string): string {
  if (metric === 'sleep_asleep_s') return 'Time Asleep';
  if (metric === 'sleep_in_bed_s') return 'Time in Bed';
  return APPLE_HEALTH_QUANTITIES.find((q) => q.metric === metric)?.name ?? metric;
}

/** A stored value as Health shows it, in its canonical unit. */
export function formatHealthValue(metric: string, value: number): string {
  const whole = (n: number) => Math.round(n).toLocaleString('en-US');
  switch (metric) {
    case 'steps':
      return whole(value);
    case 'distance_m':
      return `${(value / 1000).toFixed(1)} km`;
    case 'active_energy_kcal':
      return `${whole(value)} cal`;
    case 'exercise_min':
      return `${whole(value)} min`;
    case 'heart_rate_avg_bpm':
    case 'resting_hr_bpm':
    case 'hr_recovery_bpm':
      return `${whole(value)} bpm`;
    case 'hrv_sdnn_ms':
      return `${whole(value)} ms`;
    case 'respiratory_rate':
      return `${value.toFixed(1)} /min`;
    case 'spo2_pct':
      return `${Math.round(value)}%`;
    case 'wrist_temp_c':
      return `${value.toFixed(1)} °C`;
    case 'vo2max':
      return value.toFixed(1);
    case 'sleep_asleep_s':
    case 'sleep_in_bed_s': {
      const minutes = Math.round(value / 60);
      return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    }
    default:
      return String(value);
  }
}
