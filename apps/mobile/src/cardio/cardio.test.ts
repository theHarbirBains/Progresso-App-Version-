import {
  cardioDetails,
  cardioName,
  cardioValues,
  draftFromCardio,
  emptyCardioDraft,
  formatDistance,
  formatPace,
  parseCardioTime,
  type CardioValues,
} from './cardioActivities';
import { workoutTimes } from './workoutTime';

const values = (extra: Partial<CardioValues> = {}): CardioValues => ({
  activity: 'treadmill',
  name: null,
  durationSeconds: 1200,
  distanceM: null,
  calories: null,
  speedKmh: null,
  inclinePercent: null,
  resistanceLevel: null,
  floors: null,
  ...extra,
});

describe('workoutTimes', () => {
  const start = '2026-11-20T10:00:00Z';

  it('takes cardio done before the strength part ended out of it, and adds every activity back', () => {
    // 10 min on the bike first, lifting until 45 min, then 20 on the treadmill; finished at 70.
    const times = workoutTimes({
      performedAt: start,
      completedAt: '2026-11-20T11:10:00Z',
      strengthEndedAt: '2026-11-20T10:45:00Z',
      hasStrength: true,
      cardio: [{ durationSeconds: 600 }, { durationSeconds: 1200, afterStrength: true }],
    });
    expect(times).toEqual({
      sessionSeconds: 70 * 60,
      strengthSeconds: 35 * 60,
      cardioSeconds: 30 * 60,
      activeSeconds: 65 * 60,
    });
  });

  it("is a strength-only workout's own duration, as before", () => {
    expect(
      workoutTimes({
        performedAt: start,
        completedAt: '2026-11-20T11:00:00Z',
        hasStrength: true,
        cardio: [],
      }),
    ).toEqual({
      sessionSeconds: 3600,
      strengthSeconds: 3600,
      cardioSeconds: 0,
      activeSeconds: 3600,
    });
  });

  it('is only the cardio for a workout of cardio alone -- never the session', () => {
    const times = workoutTimes({
      performedAt: start,
      completedAt: '2026-11-20T10:50:00Z',
      hasStrength: false,
      cardio: [{ durationSeconds: 1800 }],
    });
    expect(times.strengthSeconds).toBeNull();
    expect(times.activeSeconds).toBe(1800);
    expect(times.sessionSeconds).toBe(3000);
  });

  it('knows no strength time for a workout logged with no duration', () => {
    const times = workoutTimes({
      performedAt: start,
      completedAt: start,
      hasStrength: true,
      cardio: [{ durationSeconds: 900 }],
    });
    expect(times).toEqual({
      sessionSeconds: null,
      strengthSeconds: null,
      cardioSeconds: 900,
      activeSeconds: null,
    });
  });
});

describe('cardio figures', () => {
  it('reads a time as minutes, or minutes and seconds', () => {
    expect(parseCardioTime('20')).toBe(1200);
    expect(parseCardioTime('20.5')).toBe(1230);
    expect(parseCardioTime('20:30')).toBe(1230);
    expect(parseCardioTime('1:05:00')).toBe(3900);
    expect(parseCardioTime('0')).toBeNull();
    expect(parseCardioTime('20:75')).toBeNull();
    expect(parseCardioTime('')).toBeNull();
  });

  it('needs a time, and keeps only the figures its activity asks for', () => {
    expect(cardioValues(emptyCardioDraft(), 'lb')).toEqual({
      problem: expect.stringMatching(/how long it took/),
    });
    // A swim has no incline, whatever was typed before switching to it.
    const result = cardioValues(
      { ...emptyCardioDraft('swimming'), duration: '30', distance: '1000', incline: '3' },
      'lb',
    );
    expect(result).toEqual({
      values: values({
        activity: 'swimming',
        durationSeconds: 1800,
        // 1,000 yd for a pounds person.
        distanceM: 914.4,
      }),
    });
  });

  it("saves in canonical units and shows in the person's", () => {
    const result = cardioValues(
      {
        ...emptyCardioDraft('treadmill'),
        duration: '30',
        distance: '3',
        speed: '6',
        incline: '2.5',
      },
      'lb',
    );
    if (!('values' in result)) throw new Error('expected values');
    expect(result.values.distanceM).toBeCloseTo(4828.03, 1);
    expect(result.values.speedKmh).toBeCloseTo(9.66, 2);
    expect(cardioDetails(result.values, 'lb')).toBe('30 min · 3 mi · 6 mph · 2.5% incline');
    expect(cardioDetails(result.values, 'kg')).toBe('30 min · 4.83 km · 9.7 km/h · 2.5% incline');
    // And back into its fields as it was typed.
    expect(draftFromCardio(result.values, 'lb')).toMatchObject({ distance: '3', speed: '6' });
  });

  it("works out a run's pace, and counts a rower's distance in metres", () => {
    expect(formatPace(5000, 1500, 'outdoor_run', 'kg')).toBe('5:00 /km');
    expect(
      cardioDetails(
        values({ activity: 'walking', durationSeconds: 1800, distanceM: 3218.69 }),
        'lb',
      ),
    ).toBe('30 min · 2 mi · 15:00 /mi');
    expect(formatDistance(2000, 'rowing', 'lb')).toBe('2,000 m');
  });

  it('names an "Other" activity by what it was', () => {
    expect(cardioName(values({ activity: 'other', name: 'Jump Rope' }))).toBe('Jump Rope');
    expect(cardioName(values({ activity: 'stairmaster' }))).toBe('Stairmaster');
    expect(
      cardioDetails(values({ activity: 'stairmaster', floors: 40, resistanceLevel: 8 }), 'kg'),
    ).toBe('20 min · 40 floors · Level 8');
  });
});
