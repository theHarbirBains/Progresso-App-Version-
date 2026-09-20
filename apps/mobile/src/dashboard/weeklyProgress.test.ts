import { computeWeeklyProgress, getCurrentWeekRange } from './weeklyProgress';

describe('getCurrentWeekRange', () => {
  it('returns Monday..the following Monday for a mid-week date', () => {
    // 2026-09-09 is a Wednesday.
    const { start, end } = getCurrentWeekRange(new Date('2026-09-09T12:00:00'));

    expect(start.toDateString()).toBe(new Date('2026-09-07T00:00:00').toDateString()); // Monday
    expect(end.toDateString()).toBe(new Date('2026-09-14T00:00:00').toDateString()); // next Monday
  });

  it('treats Sunday as the last day of its week, not the start of the next one', () => {
    // 2026-09-13 is a Sunday.
    const { start, end } = getCurrentWeekRange(new Date('2026-09-13T12:00:00'));

    expect(start.toDateString()).toBe(new Date('2026-09-07T00:00:00').toDateString());
    expect(end.toDateString()).toBe(new Date('2026-09-14T00:00:00').toDateString());
  });

  it('starts exactly on Monday when `now` already is Monday', () => {
    const { start } = getCurrentWeekRange(new Date('2026-09-07T08:00:00'));

    expect(start.toDateString()).toBe(new Date('2026-09-07T00:00:00').toDateString());
  });
});

describe('computeWeeklyProgress', () => {
  const wednesday = new Date('2026-09-09T12:00:00');

  it('marks Mon/Tue/Wed as completed and leaves the rest of the week unmarked', () => {
    const performed = [
      new Date('2026-09-07T18:00:00'), // Monday
      new Date('2026-09-08T18:00:00'), // Tuesday
      new Date('2026-09-09T07:00:00'), // Wednesday
    ];

    const result = computeWeeklyProgress(performed, 5, wednesday);

    expect(result.days.map((d) => [d.label, d.completed])).toEqual([
      ['Mon', true],
      ['Tue', true],
      ['Wed', true],
      ['Thu', false],
      ['Fri', false],
      ['Sat', false],
      ['Sun', false],
    ]);
    expect(result.completedCount).toBe(3);
    expect(result.goalCount).toBe(5);
  });

  it('collapses multiple workouts on the same day to one completed day', () => {
    const performed = [new Date('2026-09-07T08:00:00'), new Date('2026-09-07T18:00:00')];

    const result = computeWeeklyProgress(performed, 5, wednesday);

    expect(result.completedCount).toBe(1);
  });

  it('ignores a workout performed in a different week', () => {
    const result = computeWeeklyProgress([new Date('2026-09-01T08:00:00')], 5, wednesday);

    expect(result.completedCount).toBe(0);
  });

  it('passes through a null goal without fabricating one', () => {
    const result = computeWeeklyProgress([], null, wednesday);

    expect(result.goalCount).toBeNull();
  });

  describe('isRestDay', () => {
    it('marks a past day with no workout as a rest day, but leaves completed days alone', () => {
      const performed = [new Date('2026-09-07T18:00:00')]; // Monday
      const result = computeWeeklyProgress(performed, 5, wednesday);

      const byLabel = Object.fromEntries(result.days.map((d) => [d.label, d.isRestDay]));
      expect(byLabel.Mon).toBe(false); // completed -- not a rest day
      expect(byLabel.Tue).toBe(true); // past, no workout -- rest day
    });

    it('never marks today as a rest day, even with no workout logged yet', () => {
      const result = computeWeeklyProgress([], 5, wednesday);

      const wed = result.days.find((d) => d.label === 'Wed');
      expect(wed?.isRestDay).toBe(false);
    });

    it('never marks a future day in the week as a rest day', () => {
      const result = computeWeeklyProgress([], 5, wednesday);

      const thu = result.days.find((d) => d.label === 'Thu');
      const sun = result.days.find((d) => d.label === 'Sun');
      expect(thu?.isRestDay).toBe(false);
      expect(sun?.isRestDay).toBe(false);
    });
  });
});
