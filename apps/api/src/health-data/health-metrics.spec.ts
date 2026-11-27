import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HEALTH_METRICS, HEALTH_PROVIDERS, healthMetric, toCanonical } from './health-metrics';

const MIGRATION = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'supabase',
  'migrations',
  '20261224100000_health_data.sql',
);

/** health_metric_definitions as the migration inserts it. */
function migrationMetrics() {
  const sql = readFileSync(MIGRATION, 'utf8');
  const rows = [
    ...sql.matchAll(
      /\('([a-z0-9_]+)',\s*'([^']+)',\s*(-?\d+),\s*(-?\d+),\s*array\[([^\]]+)\],\s*(true|false)\)/g,
    ),
  ];
  return rows.map(([, metric, unit, min, max, sources, overnight]) => ({
    metric,
    unit,
    min: Number(min),
    max: Number(max),
    sources: sources!.split(',').map((s) => s.trim().replace(/'/g, '')),
    overnight: overnight === 'true',
  }));
}

describe('the health metrics', () => {
  it('are exactly the database’s: each unit, range, source and overnight flag', () => {
    const fromDatabase = migrationMetrics();
    expect(fromDatabase).toHaveLength(17);
    expect(HEALTH_METRICS.map((d) => ({ ...d, sources: [...d.sources] }))).toEqual(fromDatabase);
  });

  it('and the database’s providers', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    const domain = sql.match(
      /create domain public\.health_provider as text\s+check \(value in \(([^)]+)\)\)/,
    );
    expect(domain?.[1]?.split(',').map((s) => s.trim().replace(/'/g, ''))).toEqual([
      ...HEALTH_PROVIDERS,
    ]);
  });

  it('keep different measurements apart: Apple’s HRV is SDNN, Oura’s RMSSD', () => {
    expect(healthMetric('hrv_sdnn_ms')?.sources).toEqual(['apple_health']);
    expect(healthMetric('hrv_rmssd_ms')?.sources).toEqual(['oura']);
    expect(healthMetric('oura_readiness')?.sources).toEqual(['oura']);
  });
});

describe('toCanonical', () => {
  const metric = (name: string) => healthMetric(name)!;

  it('takes a value in its canonical unit as it is, whole where it counts', () => {
    expect(toCanonical(metric('steps'), 8412.4)).toEqual({ value: 8412 });
    expect(toCanonical(metric('resting_hr_bpm'), 52.456, 'bpm')).toEqual({ value: 52.46 });
  });

  it('converts what a source sends: kJ, km, a fraction, Fahrenheit', () => {
    expect(toCanonical(metric('active_energy_kcal'), 4184, 'kJ')).toEqual({ value: 1000 });
    expect(toCanonical(metric('distance_m'), 6.1, 'km')).toEqual({ value: 6100 });
    expect(toCanonical(metric('spo2_pct'), 0.97, 'fraction')).toEqual({ value: 97 });
    expect(toCanonical(metric('wrist_temp_c'), 96.8, 'degF')).toEqual({ value: 36 });
    expect(toCanonical(metric('sleep_asleep_s'), 7.5, 'h')).toEqual({ value: 27000 });
  });

  it('converts a difference in temperature without an offset', () => {
    expect(toCanonical(metric('temp_deviation_c'), 0.9, 'degF')).toEqual({ value: 0.5 });
  });

  it('refuses a value outside its range -- a resting heart rate of 400 is never stored', () => {
    expect(toCanonical(metric('resting_hr_bpm'), 400)).toEqual({
      reason: 'resting_hr_bpm of 400 is outside 20 to 200',
    });
    expect(toCanonical(metric('steps'), -5)).toHaveProperty('reason');
  });

  it('refuses a unit its metric can’t be in', () => {
    expect(toCanonical(metric('steps'), 10, 'kg')).toEqual({ reason: "steps can't be in kg" });
    expect(toCanonical(metric('steps'), Number.NaN)).toHaveProperty('reason');
  });
});
