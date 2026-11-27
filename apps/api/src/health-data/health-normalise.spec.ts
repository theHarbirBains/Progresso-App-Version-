import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AppleHealthImportDto } from './dto/health-import.dto';
import {
  dayProblem,
  localDay,
  normaliseCleared,
  normaliseSleep,
  normaliseValues,
} from './health-normalise';

const NOW = new Date('2026-11-27T15:00:00Z');

describe('normaliseValues', () => {
  it('stores each value in its canonical unit, with what measured it', () => {
    const { rows, refused } = normaliseValues(
      'apple_health',
      [
        { day: '2026-11-26', metric: 'steps', value: 8412, device: 'iPhone', sampleCount: 40 },
        { day: '2026-11-26', metric: 'active_energy_kcal', value: 2092, unit: 'kJ' },
      ],
      NOW,
    );
    expect(refused).toEqual([]);
    expect(rows).toEqual([
      expect.objectContaining({
        day: '2026-11-26',
        metric: 'steps',
        value: 8412,
        device: 'iPhone',
        sample_count: 40,
      }),
      expect.objectContaining({ metric: 'active_energy_kcal', value: 500 }),
    ]);
  });

  it('refuses one bad reading on its own -- the rest of the sync still goes in', () => {
    const { rows, refused } = normaliseValues(
      'apple_health',
      [
        { day: '2026-11-26', metric: 'resting_hr_bpm', value: 400 },
        { day: '2026-11-26', metric: 'hrv_rmssd_ms', value: 40 },
        { day: '2026-11-26', metric: 'sleep_asleep_s', value: 27000 },
        { day: '2026-11-26', metric: 'bench_press', value: 100 },
        { day: '2026-12-25', metric: 'steps', value: 100 },
        { day: '2026-11-26', metric: 'steps', value: 100 },
      ],
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(refused.map((r) => [r.index, r.reason])).toEqual([
      [0, 'resting_hr_bpm of 400 is outside 20 to 200'],
      [1, 'hrv_rmssd_ms never comes from apple_health'],
      [2, 'sleep_asleep_s comes from sleep sessions'],
      [3, "bench_press isn't a health metric"],
      [4, "2026-12-25 hasn't happened yet"],
    ]);
  });

  it('checks what’s cleared the same way', () => {
    const { rows, refused } = normaliseCleared(
      'apple_health',
      [
        { day: '2026-11-26', metric: 'steps' },
        { day: '2026-11-26', metric: 'oura_readiness' },
      ],
      NOW,
    );
    expect(rows).toEqual([{ day: '2026-11-26', metric: 'steps' }]);
    expect(refused).toHaveLength(1);
  });
});

describe('dayProblem', () => {
  it('takes today and tomorrow (time zones ahead of UTC), and the last two years', () => {
    expect(dayProblem('2026-11-27', NOW)).toBeNull();
    expect(dayProblem('2026-11-28', NOW)).toBeNull();
    expect(dayProblem('2025-01-01', NOW)).toBeNull();
  });

  it('refuses a day that isn’t one, is ahead, or is long ago', () => {
    expect(dayProblem('2026-02-30', NOW)).toBe("2026-02-30 isn't a day");
    expect(dayProblem('2026-11-29', NOW)).toBe("2026-11-29 hasn't happened yet");
    expect(dayProblem('2020-01-01', NOW)).toMatch(/days ago/);
  });
});

describe('normaliseSleep', () => {
  const night = {
    sourceRef: 'night-1',
    startedAt: '2026-11-27T06:10:00Z',
    endedAt: '2026-11-27T13:40:00Z',
    inBedS: 27000,
    asleepS: 25200,
  };

  it('gives a sleep the morning it ended, in their own time zone', () => {
    const { rows } = normaliseSleep([night], 'America/Vancouver', NOW);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        day: '2026-11-27',
        in_bed_s: 27000,
        asleep_s: 25200,
        is_nap: false,
      }),
    );
    // Ending at 1:40 AM UTC the next day is still the 27th in Vancouver.
    const late = normaliseSleep(
      [
        {
          ...night,
          startedAt: '2026-11-27T20:00:00Z',
          endedAt: '2026-11-28T01:40:00Z',
          inBedS: 20000,
          asleepS: 19000,
        },
      ],
      'America/Vancouver',
      NOW,
    );
    expect(late.rows[0]?.day).toBe('2026-11-27');
  });

  it('refuses a sleep that ends first, lasts over a day, or has more in it than it lasted', () => {
    const { refused } = normaliseSleep(
      [
        { ...night, endedAt: '2026-11-27T05:00:00Z' },
        { ...night, startedAt: '2026-11-25T06:00:00Z' },
        { ...night, inBedS: 40000 },
        { ...night, asleepS: 27001 },
      ],
      'UTC',
      NOW,
    );
    expect(refused.map((r) => r.reason)).toEqual([
      'it ends before it starts',
      'it lasts more than 24 hours',
      'a figure is longer than the sleep itself',
      'more time asleep than in bed',
    ]);
  });

  it('falls back to UTC for a time zone it doesn’t know', () => {
    expect(localDay(new Date('2026-11-27T23:30:00Z'), 'Not/AZone')).toBe('2026-11-27');
    expect(localDay(new Date('2026-11-27T23:30:00Z'), null)).toBe('2026-11-27');
  });
});

describe('AppleHealthImportDto', () => {
  const errorsFor = async (payload: Record<string, unknown>) =>
    (
      await validate(plainToInstance(AppleHealthImportDto, payload), {
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    ).map((error) => error.property);

  it('takes a sync’s values and sleeps', async () => {
    expect(
      await errorsFor({
        trigger: 'connect',
        values: [{ day: '2026-11-26', metric: 'steps', value: 8412 }],
        sleep: [
          { sourceRef: 'a', startedAt: '2026-11-26T06:00:00Z', endedAt: '2026-11-26T13:00:00Z' },
        ],
        devices: ['iPhone'],
      }),
    ).toEqual([]);
  });

  it('refuses a malformed sync, an unknown trigger and anything it doesn’t know', async () => {
    expect(await errorsFor({ trigger: 'whenever' })).toEqual(['trigger']);
    expect(
      await errorsFor({
        trigger: 'app_open',
        values: [{ day: 'yesterday', metric: 'steps', value: 1 }],
      }),
    ).toEqual(['values']);
    expect(
      await errorsFor({
        trigger: 'app_open',
        values: [{ day: '2026-11-26', metric: 'steps', value: 'lots' }],
      }),
    ).toEqual(['values']);
    expect(await errorsFor({ trigger: 'app_open', userId: 'someone-else' })).toEqual(['userId']);
  });
});
