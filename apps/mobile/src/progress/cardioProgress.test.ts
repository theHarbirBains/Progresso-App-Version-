import type { CardioValues } from '../cardio/cardioActivities';
import {
  activitiesDone,
  bestsOf,
  byActivity,
  figuresOf,
  inRange,
  totalsOf,
  trendOf,
  type CardioRecord,
} from './cardioProgress';

let nextId = 0;
function record(performedAt: string, extra: Partial<CardioValues> = {}): CardioRecord {
  nextId += 1;
  return {
    id: `c${nextId}`,
    workoutId: `w${nextId}`,
    performedAt,
    activity: 'outdoor_run',
    name: null,
    durationSeconds: 1800,
    distanceM: null,
    speedKmh: null,
    speedSetting: null,
    inclinePercent: null,
    resistanceLevel: null,
    floors: null,
    steps: null,
    strokeRate: null,
    poolLengthM: null,
    laps: null,
    notes: null,
    ...extra,
  };
}

// Saturday, November 21, 2026, mid-morning.
const now = new Date(2026, 10, 21, 10, 0, 0);
const at = (month: number, day: number, hour = 9) => new Date(2026, month, day, hour).toISOString();

describe('the cardio over a range', () => {
  const records = [
    record(at(10, 21), { distanceM: 5000 }),
    record(at(10, 15), { distanceM: 10_000, durationSeconds: 3600 }),
    record(at(9, 30), { activity: 'cycling', durationSeconds: 2700, distanceM: 20_000 }),
    record(at(7, 1), { activity: 'stairmaster', durationSeconds: 1200, floors: 50 }),
  ];

  it('counts the last 7, 30 or 90 days with today, or everything', () => {
    expect(inRange(records, 'week', now)).toHaveLength(2);
    expect(inRange(records, 'month', now)).toHaveLength(3);
    expect(inRange(records, 'quarter', now)).toHaveLength(3);
    expect(inRange(records, 'all', now)).toHaveLength(4);
  });

  it('totals its sessions and time, and its distance over those with one', () => {
    expect(totalsOf(records)).toEqual({
      sessions: 4,
      seconds: 1800 + 3600 + 2700 + 1200,
      distanceM: 35_000,
      withDistance: 3,
    });
  });

  it('breaks it down by activity, the most time first', () => {
    expect(
      byActivity(records).map((share) => [share.activity, share.sessions, share.seconds]),
    ).toEqual([
      ['outdoor_run', 2, 5400],
      ['cycling', 1, 2700],
      ['stairmaster', 1, 1200],
    ]);
    expect(activitiesDone(records)[0]).toBe('outdoor_run');
  });
});

describe("one activity's figures", () => {
  it("averages its pace over the time, and leaves out what wasn't recorded", () => {
    // 5 km in 30 min and 10 km in 60: 15 km in 90 min, 10 km/h -- a session with no distance
    // and no pace says nothing about speed.
    const runs = [
      record(at(10, 1), { distanceM: 5000 }),
      record(at(10, 2), { distanceM: 10_000, durationSeconds: 3600 }),
      record(at(10, 3)),
    ];
    const figures = figuresOf(runs);
    expect(figures.averageSpeedKmh).toBeCloseTo(10, 5);
    expect(figures.averageDistanceM).toBe(7500);
    expect(figures.averageSeconds).toBe(2400);
    expect(figures.averageIncline).toBeNull();
    expect(figures.floors).toBeNull();
  });

  it('weights a typed pace by its time, and adds up floors, steps and laps', () => {
    const figures = figuresOf([
      record(at(10, 1), { activity: 'stairmaster', floors: 40, steps: 800, resistanceLevel: 6 }),
      record(at(10, 2), {
        activity: 'stairmaster',
        floors: 60,
        resistanceLevel: 10,
        durationSeconds: 5400,
      }),
    ]);
    expect(figures.floors).toBe(100);
    expect(figures.steps).toBe(800);
    // Level 6 for 30 min and 10 for 90: 9 over the time.
    expect(figures.averageLevel).toBe(9);
    expect(figures.averageSpeedKmh).toBeNull();
  });

  it('finds its longest, farthest and fastest', () => {
    const slow = record(at(10, 1), { distanceM: 12_000, durationSeconds: 4200 });
    const quick = record(at(10, 2), { distanceM: 5000, durationSeconds: 1350 });
    const bests = bestsOf([slow, quick, record(at(10, 3))]);
    expect(bests.longest).toBe(slow);
    expect(bests.farthest).toBe(slow);
    expect(bests.fastest?.record).toBe(quick);
    expect(bests.fastest?.speedKmh).toBeCloseTo(13.33, 2);
  });
});

describe('trends', () => {
  it('lists the last 8 weeks, Monday to Sunday, this week first, an empty one as nothing', () => {
    const weeks = trendOf(
      [
        record(at(10, 21), { distanceM: 5000 }),
        record(at(10, 16), { distanceM: 8000 }),
        record(at(10, 15), { distanceM: 3000 }),
      ],
      'weekly',
      now,
    );
    expect(weeks).toHaveLength(8);
    // Monday the 16th to today; Sunday the 15th belongs to the week before.
    expect(weeks[0]).toMatchObject({ current: true, sessions: 2, distanceM: 13_000 });
    expect(weeks[0].start).toEqual(new Date(2026, 10, 16));
    expect(weeks[1]).toMatchObject({ sessions: 1, distanceM: 3000 });
    expect(weeks[2]).toMatchObject({ sessions: 0, seconds: 0, speedKmh: null });
  });

  it('lists the last 6 months, this one first, with each one’s average speed', () => {
    const months = trendOf(
      [
        record(at(10, 3), { distanceM: 5000 }),
        record(at(9, 12), { distanceM: 6000 }),
        record(at(9, 20), { distanceM: 6000 }),
      ],
      'monthly',
      now,
    );
    expect(months).toHaveLength(6);
    expect(months[0]).toMatchObject({ current: true, sessions: 1 });
    expect(months[1]).toMatchObject({ sessions: 2, distanceM: 12_000 });
    expect(months[1].speedKmh).toBeCloseTo(12, 5);
    expect(months[5].sessions).toBe(0);
  });
});
