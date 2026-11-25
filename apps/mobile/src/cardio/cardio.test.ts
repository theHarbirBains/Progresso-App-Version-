import {
  activitiesInOrder,
  CARDIO_ACTIVITIES,
  CARDIO_INFO,
  cardioDetails,
  cardioFieldsOf,
  cardioFigures,
  cardioKey,
  cardioName,
  cardioTotals,
  lastTimeFor,
  cardioReadout,
  cardioValues,
  draftFromCardio,
  emptyCardioDraft,
  formatKm,
  formatRate,
  parseCardioTime,
  sameCardio,
  type CardioDraft,
  type CardioValues,
} from './cardioActivities';
import { workoutTimes } from './workoutTime';

const values = (extra: Partial<CardioValues> = {}): CardioValues => ({
  activity: 'treadmill',
  name: null,
  durationSeconds: 1200,
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
});

const draft = (activity: CardioValues['activity'], typed: Partial<CardioDraft>): CardioDraft => ({
  ...emptyCardioDraft(activity),
  ...typed,
});

function saved(typed: CardioDraft, original: CardioValues | null = null): CardioValues {
  const result = cardioValues(typed, original);
  if (!('values' in result)) throw new Error(`expected values, got: ${result.problem}`);
  return result.values;
}

describe('workoutTimes', () => {
  const start = '2026-11-20T10:00:00Z';

  it("splits the workout's total time into its cardio and the strength training", () => {
    // Harbir's example: 25 minutes on the treadmill in a workout that took an hour in all.
    const times = workoutTimes({
      performedAt: start,
      completedAt: '2026-11-20T11:00:00Z',
      hasStrength: true,
      cardio: [{ durationSeconds: 25 * 60 }],
    });
    expect(times).toEqual({
      totalSeconds: 60 * 60,
      strengthSeconds: 35 * 60,
      cardioSeconds: 25 * 60,
    });
  });

  it('counts every activity toward the cardio, wherever in the workout it was done', () => {
    // 10 min on the bike first and 20 on the treadmill after the lifting; finished at 70.
    expect(
      workoutTimes({
        performedAt: start,
        completedAt: '2026-11-20T11:10:00Z',
        hasStrength: true,
        cardio: [{ durationSeconds: 600 }, { durationSeconds: 1200 }],
      }),
    ).toEqual({ totalSeconds: 70 * 60, strengthSeconds: 40 * 60, cardioSeconds: 30 * 60 });
  });

  it("is a strength-only workout's own duration, as before", () => {
    expect(
      workoutTimes({
        performedAt: start,
        completedAt: '2026-11-20T11:00:00Z',
        hasStrength: true,
        cardio: [],
      }),
    ).toEqual({ totalSeconds: 3600, strengthSeconds: 3600, cardioSeconds: 0 });
  });

  it('takes the cardio as the total where it comes to more than the workout lasted', () => {
    // Started, then finished 20 minutes later with 30 minutes of cardio typed in.
    expect(
      workoutTimes({
        performedAt: start,
        completedAt: '2026-11-20T10:20:00Z',
        hasStrength: true,
        cardio: [{ durationSeconds: 1800 }],
      }),
    ).toEqual({ totalSeconds: 1800, strengthSeconds: 0, cardioSeconds: 1800 });
  });

  it('is only the cardio for a workout of cardio alone', () => {
    expect(
      workoutTimes({
        performedAt: start,
        completedAt: '2026-11-20T10:50:00Z',
        hasStrength: false,
        cardio: [{ durationSeconds: 1800 }],
      }),
    ).toEqual({ totalSeconds: 1800, strengthSeconds: null, cardioSeconds: 1800 });
  });

  it('knows no total for a workout with strength training logged with no duration', () => {
    expect(
      workoutTimes({
        performedAt: start,
        completedAt: start,
        hasStrength: true,
        cardio: [{ durationSeconds: 900 }],
      }),
    ).toEqual({ totalSeconds: null, strengthSeconds: null, cardioSeconds: 900 });
  });
});

describe('each activity asks for its own figures', () => {
  it('is the brief: a time for every one, and only what fits each', () => {
    const asked = Object.fromEntries(
      CARDIO_ACTIVITIES.map((activity) => [
        activity,
        { primary: CARDIO_INFO[activity].primary, optional: CARDIO_INFO[activity].optional },
      ]),
    );
    expect(asked).toEqual({
      treadmill: { primary: ['distance', 'speedSetting'], optional: ['incline'] },
      outdoor_run: { primary: ['distance'], optional: ['pace'] },
      walking: { primary: ['distance'], optional: ['pace'] },
      cycling: { primary: ['distance'], optional: ['avgSpeed', 'resistance'] },
      stairmaster: { primary: [], optional: ['level', 'floors', 'steps'] },
      elliptical: { primary: [], optional: ['distance', 'resistance', 'speedSetting'] },
      rowing: { primary: ['distance'], optional: ['split', 'strokeRate'] },
      swimming: { primary: ['distance'], optional: ['poolLength', 'laps'] },
      other: { primary: ['name'], optional: ['distance', 'notes'] },
    });
  });

  it('never asks for or shows calories', () => {
    for (const activity of CARDIO_ACTIVITIES) {
      expect(cardioFieldsOf(activity).join(' ')).not.toMatch(/calor/i);
    }
    // An activity saved with calories, before they went, shows without them.
    const old = { ...values({ durationSeconds: 1800 }), calories: 300 } as CardioValues;
    expect(cardioDetails(old)).toBe('30 min');
  });
});

describe('typing an activity in', () => {
  it('needs a time, and says which field to fix', () => {
    expect(cardioValues(emptyCardioDraft())).toEqual({
      problem: expect.stringMatching(/how long it took/),
      field: 'duration',
    });
    expect(cardioValues(draft('treadmill', { duration: '20', distance: 'far' }))).toEqual({
      problem: 'Enter the distance in kilometres, like 5 or 5.2.',
      field: 'distance',
    });
    expect(cardioValues(draft('treadmill', { duration: '20', incline: '55' }))).toMatchObject({
      field: 'incline',
    });
    expect(cardioValues(draft('outdoor_run', { duration: '20', pace: '5:75' }))).toMatchObject({
      field: 'pace',
    });
    expect(cardioValues(draft('stairmaster', { duration: '20', level: '2.5' }))).toMatchObject({
      field: 'level',
    });
  });

  it('reads a time as minutes, or minutes and seconds', () => {
    expect(parseCardioTime('20')).toBe(1200);
    expect(parseCardioTime('20.5')).toBe(1230);
    expect(parseCardioTime('20:30')).toBe(1230);
    expect(parseCardioTime('1:05:00')).toBe(3900);
    expect(parseCardioTime('0')).toBeNull();
    expect(parseCardioTime('20:75')).toBeNull();
    expect(parseCardioTime('')).toBeNull();
  });

  it('logs a treadmill with its distance in km, the speed on the machine and its incline', () => {
    const treadmill = saved(
      draft('treadmill', { duration: '30', distance: '4.8', speedSetting: '6.5', incline: '2' }),
    );
    expect(treadmill).toEqual(
      values({
        durationSeconds: 1800,
        distanceM: 4800,
        speedSetting: 6.5,
        inclinePercent: 2,
      }),
    );
    // The machine's number, with no unit -- never a km/h or mph.
    expect(cardioDetails(treadmill)).toBe('30 min · 4.8 km · Speed 6.5 · 2% incline');
  });

  it("shows an outdoor run's pace, worked out from its distance and time", () => {
    const run = saved(draft('outdoor_run', { duration: '30', distance: '5' }));
    expect(run).toMatchObject({ distanceM: 5000, speedKmh: null });
    expect(cardioDetails(run)).toBe('30 min · 5 km · 6:00 /km');
  });

  it('logs a walk with nothing optional', () => {
    const walk = saved(draft('walking', { duration: '45' }));
    expect(walk).toEqual(values({ activity: 'walking', durationSeconds: 2700 }));
    expect(cardioDetails(walk)).toBe('45 min');
  });

  it('keeps a pace that was typed, as the speed it stands for', () => {
    const run = saved(draft('outdoor_run', { duration: '30', distance: '5', pace: '5:45' }));
    expect(run.speedKmh).toBeCloseTo(10.43, 2);
    expect(cardioDetails(run)).toBe('30 min · 5 km · 5:45 /km');
    expect(draftFromCardio(run)).toMatchObject({ pace: '5:45', distance: '5' });
  });

  it("logs a ride's distance and average speed -- the speed typed over the one worked out", () => {
    const ride = saved(draft('cycling', { duration: '45', distance: '20', avgSpeed: '27.5' }));
    expect(ride).toMatchObject({ distanceM: 20_000, speedKmh: 27.5 });
    expect(cardioDetails(ride)).toBe('45 min · 20 km · 27.5 km/h');
    expect(cardioDetails({ ...ride, speedKmh: null })).toBe('45 min · 20 km · 26.7 km/h');
  });

  it('logs a StairMaster with its floors, and its level and steps when given', () => {
    const climb = saved(draft('stairmaster', { duration: '20', floors: '60' }));
    expect(climb).toMatchObject({ floors: 60, resistanceLevel: null, steps: null });
    expect(cardioDetails(climb)).toBe('20 min · 60 floors');
    expect(
      cardioDetails(saved(draft('stairmaster', { duration: '20', level: '8', steps: '1500' }))),
    ).toBe('20 min · Level 8 · 1,500 steps');
  });

  it("logs a swim's distance, time and laps, and works its distance out from its laps", () => {
    const swim = saved(draft('swimming', { duration: '30', distance: '1.5', laps: '60' }));
    expect(swim).toMatchObject({ distanceM: 1500, laps: 60 });
    expect(cardioDetails(swim)).toBe('30 min · 1.5 km · 2:00 /100 m · 60 laps');

    const counted = saved(draft('swimming', { duration: '30', poolLength: '25', laps: '40' }));
    expect(counted.distanceM).toBe(1000);
    expect(cardioDetails(counted)).toBe('30 min · 1 km · 3:00 /100 m · 40 laps of 25 m');
    // Its distance stays worked out from its laps when it's changed.
    expect(draftFromCardio(counted)).toMatchObject({ distance: '', laps: '40', poolLength: '25' });
  });

  it("logs a row's split and stroke rate, a split to a tenth of a second", () => {
    const row = saved(
      draft('rowing', { duration: '8', distance: '2', split: '1:47.3', strokeRate: '28' }),
    );
    expect(row).toMatchObject({ distanceM: 2000, strokeRate: 28 });
    expect(cardioDetails(row)).toBe('8 min · 2 km · 1:47.3 /500 m · 28 spm');
    expect(draftFromCardio(row).split).toBe('1:47.3');
    // Without a split, it's worked out: 2 km in 8 minutes is 2:00 a 500 m.
    expect(cardioDetails({ ...row, speedKmh: null, strokeRate: null })).toBe(
      '8 min · 2 km · 2:00 /500 m',
    );
  });

  it('names an "Other" activity by what it was, and keeps its note', () => {
    const rope = saved(
      draft('other', { duration: '10', name: 'Jump Rope', notes: '  Double unders  ' }),
    );
    expect(cardioName(rope)).toBe('Jump Rope');
    expect(rope.notes).toBe('Double unders');
    expect(cardioName(values({ activity: 'stairmaster' }))).toBe('StairMaster');
  });

  it('keeps only what the activity asks for -- a figure typed for another is left out', () => {
    // Typed as a treadmill, then switched to a swim: no incline, no machine speed on a swim.
    const swim = saved(
      draft('swimming', { duration: '30', distance: '1', incline: '3', speedSetting: '6' }),
    );
    expect(swim).toEqual(values({ activity: 'swimming', durationSeconds: 1800, distanceM: 1000 }));
  });

  it('uses kilometres, km/h and minutes per km for everyone', () => {
    expect(formatKm(4828.03)).toBe('4.83 km');
    expect(formatKm(1_609_344)).toBe('1,609.34 km');
    expect(formatRate(12, 'pace')).toBe('5:00 /km');
    expect(formatRate(24.5, 'speed')).toBe('24.5 km/h');
  });
});

describe('changing a saved activity', () => {
  it('keeps what its activity no longer asks for -- an older rower damper, an older treadmill speed', () => {
    const oldRow = values({ activity: 'rowing', durationSeconds: 600, resistanceLevel: 6 });
    expect(cardioDetails(oldRow)).toBe('10 min · Damper 6');
    const changed = saved({ ...draftFromCardio(oldRow), duration: '12' }, oldRow);
    expect(changed).toMatchObject({ durationSeconds: 720, resistanceLevel: 6 });

    // A treadmill speed typed in km/h before speeds were the machine's own number.
    const oldTreadmill = values({ durationSeconds: 1200, speedKmh: 9.5, inclinePercent: 1 });
    expect(cardioDetails(oldTreadmill)).toBe('20 min · 9.5 km/h · 1% incline');
    expect(saved(draftFromCardio(oldTreadmill), oldTreadmill)).toEqual(oldTreadmill);
  });

  it('drops them once the activity itself is changed', () => {
    const oldRow = values({ activity: 'rowing', durationSeconds: 600, resistanceLevel: 6 });
    const nowCycling = saved({ ...draftFromCardio(oldRow), activity: 'cycling' }, oldRow);
    expect(nowCycling.resistanceLevel).toBeNull();
  });

  it('opens with what was typed, and saves nothing new when nothing changed', () => {
    const treadmill = values({
      durationSeconds: 1830,
      distanceM: 4800,
      speedSetting: 6.5,
      inclinePercent: 2.5,
    });
    expect(draftFromCardio(treadmill)).toMatchObject({
      duration: '30:30',
      distance: '4.8',
      speedSetting: '6.5',
      incline: '2.5',
    });
    expect(sameCardio(saved(draftFromCardio(treadmill), treadmill), treadmill)).toBe(true);
  });

  it('carries a figure both activities ask for when switching, as the draft keeps it', () => {
    const typed = draft('outdoor_run', { duration: '30', distance: '5', pace: '6:00' });
    expect(saved({ ...typed, activity: 'walking' })).toMatchObject({
      activity: 'walking',
      distanceM: 5000,
      speedKmh: 10,
    });
  });
});

describe('what the typed figures work out to', () => {
  it("says a run's pace and speed as they're typed", () => {
    expect(cardioReadout(draft('outdoor_run', { duration: '30', distance: '5' }))).toBe(
      'Pace 6:00 /km · 10 km/h',
    );
    expect(cardioReadout(draft('outdoor_run', { duration: '30' }))).toBeNull();
  });

  it("says a swim's distance from its laps before its time is in", () => {
    expect(cardioReadout(draft('swimming', { poolLength: '25', laps: '40' }))).toBe(
      '1 km from your laps',
    );
  });

  it('says nothing for an activity with no rate and no laps', () => {
    expect(cardioReadout(draft('stairmaster', { duration: '20', floors: '40' }))).toBeNull();
  });
});

describe('an activity from an older API', () => {
  it("shows what it has -- a figure it doesn't know is left out, never 'undefined'", () => {
    const older = {
      activity: 'treadmill',
      name: null,
      durationSeconds: 1200,
      distanceM: 3000,
      speedKmh: null,
      inclinePercent: 2,
      resistanceLevel: null,
      floors: null,
    } as unknown as CardioValues;
    expect(cardioDetails(older)).toBe('20 min · 3 km · 2% incline');
  });
});

describe('the order Add Cardio offers them in', () => {
  it('puts the ones done last first, then the rest as usual', () => {
    expect(activitiesInOrder(['rowing', 'outdoor_run', 'rowing']).slice(0, 4)).toEqual([
      'rowing',
      'outdoor_run',
      'treadmill',
      'walking',
    ]);
    expect(activitiesInOrder([])).toEqual(CARDIO_ACTIVITIES);
  });
});

describe('cardio figures, totals and last time', () => {
  it('labels each saved figure, its time first, in the order the line reads', () => {
    expect(
      cardioFigures(
        values({ distanceM: 3000, speedSetting: 6.5, inclinePercent: 2.5, resistanceLevel: null }),
      ),
    ).toEqual([
      { key: 'time', label: 'Time', value: '20 min' },
      { key: 'distance', label: 'Distance', value: '3 km' },
      { key: 'speed', label: 'Speed', value: '6.5' },
      { key: 'incline', label: 'Incline', value: '2.5%' },
    ]);
    // A run tells its pace; a swim its laps and pool.
    expect(
      cardioFigures(values({ activity: 'outdoor_run', durationSeconds: 1800, distanceM: 5000 })),
    ).toContainEqual({ key: 'rate', label: 'Pace', value: '6:00 /km' });
    expect(
      cardioFigures(values({ activity: 'swimming', laps: 40, poolLengthM: 25 })).map((f) => f.key),
    ).toEqual(['time', 'laps', 'pool']);
  });

  it("adds a workout's cardio up, a distance only from the ones that have one", () => {
    expect(
      cardioTotals([values({ distanceM: 3000 }), values({ activity: 'stairmaster' })]),
    ).toEqual({ seconds: 2400, distanceM: 3000, count: 2 });
    expect(cardioTotals([values({ activity: 'stairmaster' })]).distanceM).toBeNull();
  });

  it('finds the last time of the same activity -- an Other by its name', () => {
    const recent = [
      values({ activity: 'other', name: 'Jump Rope', durationSeconds: 600 }),
      values({ activity: 'rowing' }),
    ];
    expect(lastTimeFor(recent, { activity: 'rowing' })).toBe(recent[1]);
    expect(lastTimeFor(recent, { activity: 'other', name: ' jump rope ' })).toBe(recent[0]);
    expect(lastTimeFor(recent, { activity: 'other', name: 'Sled Push' })).toBeNull();
    expect(lastTimeFor(recent, { activity: 'cycling' })).toBeNull();
    expect(cardioKey({ activity: 'other', name: 'Jump Rope' })).toBe('other:jump rope');
  });
});
