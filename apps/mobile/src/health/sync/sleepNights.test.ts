import { SLEEP_VALUE, sleepNights, type SleepSample } from './sleepNights';

// Local times, so the phone's own day is the day written.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute);
const WATCH = 'com.apple.health.watch-uuid';
const PHONE = 'com.apple.health.phone-uuid';
const APP = 'com.example.sleepapp';

function sample(
  value: number,
  start: Date,
  end: Date,
  source = WATCH,
  device: string | null = 'Apple Watch',
): SleepSample {
  return { value, start, end, source, device };
}

const ALL_DAYS = new Set(['2026-11-25', '2026-11-26', '2026-11-27']);

/** A watch night: core, deep, REM and a wake, 11 PM to 7 AM ending on the 26th. */
const watchNight = [
  sample(SLEEP_VALUE.asleepCore, at(25, 23), at(26, 1)),
  sample(SLEEP_VALUE.asleepDeep, at(26, 1), at(26, 2)),
  sample(SLEEP_VALUE.awake, at(26, 2), at(26, 2, 30)),
  sample(SLEEP_VALUE.asleepREM, at(26, 2, 30), at(26, 4)),
  sample(SLEEP_VALUE.asleepCore, at(26, 4), at(26, 7)),
];

describe('sleepNights', () => {
  it('makes one night from a watch’s stages, on the morning it ended', () => {
    const [night, ...rest] = sleepNights(watchNight, ALL_DAYS);
    expect(rest).toEqual([]);
    expect(night).toEqual(
      expect.objectContaining({
        sourceRef: 'night:2026-11-26',
        day: '2026-11-26',
        inBedS: 8 * 3600,
        asleepS: 7.5 * 3600,
        awakeS: 1800,
        lightS: 5 * 3600,
        deepS: 3600,
        remS: 1.5 * 3600,
        device: 'Apple Watch',
      }),
    );
  });

  it('never adds two sources together: the one with stages is kept', () => {
    const phoneBedtime = [
      sample(SLEEP_VALUE.inBed, at(25, 22, 30), at(26, 7, 30), PHONE, 'iPhone'),
    ];
    const nights = sleepNights([...watchNight, ...phoneBedtime], ALL_DAYS);
    expect(nights).toHaveLength(1);
    expect(nights[0]?.asleepS).toBe(7.5 * 3600);
    expect(nights[0]?.device).toBe('Apple Watch');
  });

  it('without stages, keeps the source with the most time asleep', () => {
    const shortApp = [
      sample(SLEEP_VALUE.asleepUnspecified, at(26, 1), at(26, 6), APP, 'Sleep App'),
    ];
    const longApp = [
      sample(SLEEP_VALUE.asleepUnspecified, at(25, 23), at(26, 7), 'com.other', 'Other'),
    ];
    const [night] = sleepNights([...shortApp, ...longApp], ALL_DAYS);
    expect(night?.asleepS).toBe(8 * 3600);
    expect(night?.remS).toBeNull();
    expect(night?.lightS).toBeNull();
  });

  it('keeps an iPhone bedtime as time in bed only -- never as time asleep', () => {
    const [night] = sleepNights(
      [sample(SLEEP_VALUE.inBed, at(25, 23), at(26, 7), PHONE, 'iPhone')],
      ALL_DAYS,
    );
    expect(night?.inBedS).toBe(8 * 3600);
    expect(night?.asleepS).toBeNull();
  });

  it('counts overlapping samples once', () => {
    const [night] = sleepNights(
      [
        sample(SLEEP_VALUE.asleepUnspecified, at(25, 23), at(26, 5)),
        sample(SLEEP_VALUE.asleepUnspecified, at(26, 4), at(26, 7)),
      ],
      ALL_DAYS,
    );
    expect(night?.asleepS).toBe(8 * 3600);
  });

  it('a day’s sleep is its longest: an afternoon nap isn’t the night', () => {
    const nap = [sample(SLEEP_VALUE.asleepCore, at(26, 15), at(26, 16))];
    const nights = sleepNights([...watchNight, ...nap], ALL_DAYS);
    expect(nights).toHaveLength(1);
    expect(nights[0]?.asleepS).toBe(7.5 * 3600);
  });

  it('only the days asked for', () => {
    expect(sleepNights(watchNight, new Set(['2026-11-27']))).toEqual([]);
  });
});
