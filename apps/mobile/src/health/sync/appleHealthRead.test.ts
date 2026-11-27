import {
  queryCategorySamples,
  queryStatisticsCollectionForQuantity,
} from '@kingstinct/react-native-healthkit';
import { readAppleHealth, windowDays } from './appleHealthRead';

const now = new Date(2026, 10, 27, 15, 0);
const from = new Date(2026, 10, 25);
const day = (d: number) => new Date(2026, 10, d);

function stats(byIdentifier: Record<string, { day: number; sum?: number; avg?: number }[]>) {
  jest.mocked(queryStatisticsCollectionForQuantity).mockImplementation((async (
    identifier: string,
  ) =>
    (byIdentifier[identifier] ?? []).map((entry) => ({
      startDate: day(entry.day),
      sumQuantity: entry.sum === undefined ? undefined : { quantity: entry.sum, unit: 'count' },
      averageQuantity: entry.avg === undefined ? undefined : { quantity: entry.avg, unit: 'x' },
      sources: [{ name: 'Sam’s Apple Watch', bundleIdentifier: 'com.apple.health.abc' }],
    }))) as never);
}

afterEach(() => {
  jest
    .mocked(queryStatisticsCollectionForQuantity)
    .mockReset()
    .mockResolvedValue([] as never);
  jest
    .mocked(queryCategorySamples)
    .mockReset()
    .mockResolvedValue([] as never);
});

describe('readAppleHealth', () => {
  it('reads each day’s figure in the unit the server is told, and what measured it', async () => {
    stats({
      HKQuantityTypeIdentifierStepCount: [
        { day: 25, sum: 8000 },
        { day: 27, sum: 4210 },
      ],
      HKQuantityTypeIdentifierOxygenSaturation: [{ day: 26, avg: 0.97 }],
    });
    const read = await readAppleHealth(from, now);
    expect(read.values).toEqual([
      { day: '2026-11-25', metric: 'steps', value: 8000, unit: 'count' },
      { day: '2026-11-26', metric: 'spo2_pct', value: 0.97, unit: 'fraction' },
      { day: '2026-11-27', metric: 'steps', value: 4210, unit: 'count' },
    ]);
    // A device's own name ("Sam’s Apple Watch") is personal: only its kind is kept.
    expect(read.devices).toEqual(['iPhone', 'Apple Watch']);
  });

  it('clears a day that’s gone, but never a metric with nothing at all -- that’s not allowed, not deleted', async () => {
    stats({ HKQuantityTypeIdentifierStepCount: [{ day: 25, sum: 8000 }] });
    const read = await readAppleHealth(from, now);
    expect(read.cleared).toEqual([
      { day: '2026-11-26', metric: 'steps' },
      { day: '2026-11-27', metric: 'steps' },
    ]);
  });

  it('reads each night, and clears the window’s nights that are gone', async () => {
    jest.mocked(queryCategorySamples).mockResolvedValue([
      {
        value: 3,
        startDate: new Date(2026, 10, 25, 23),
        endDate: new Date(2026, 10, 26, 7),
        sourceRevision: {
          source: { name: 'Sam’s Apple Watch', bundleIdentifier: 'com.apple.health.abc' },
          productType: 'Watch7,1',
        },
      },
    ] as never);
    const read = await readAppleHealth(from, now);
    expect(read.sleep).toEqual([
      expect.objectContaining({
        sourceRef: 'night:2026-11-26',
        asleepS: 8 * 3600,
        device: 'Apple Watch',
      }),
    ]);
    expect(read.clearedSleep).toEqual(['night:2026-11-25', 'night:2026-11-27']);
  });

  it('carries on past a type that can’t be read, saying which', async () => {
    jest.mocked(queryStatisticsCollectionForQuantity).mockImplementation((async (
      identifier: string,
    ) => {
      if (identifier === 'HKQuantityTypeIdentifierVO2Max') throw new Error('nope');
      return [];
    }) as never);
    const read = await readAppleHealth(from, now);
    expect(read.failed).toEqual(['HKQuantityTypeIdentifierVO2Max']);
  });

  it('fails when nothing at all can be read', async () => {
    jest.mocked(queryStatisticsCollectionForQuantity).mockRejectedValue(new Error('locked'));
    jest.mocked(queryCategorySamples).mockRejectedValue(new Error('locked'));
    await expect(readAppleHealth(from, now)).rejects.toThrow('Apple Health couldn’t be read');
  });
});

describe('windowDays', () => {
  it('is each of the phone’s days from the first to today', () => {
    expect(windowDays(from, now)).toEqual(['2026-11-25', '2026-11-26', '2026-11-27']);
  });
});
