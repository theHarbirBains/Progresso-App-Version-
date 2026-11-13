import {
  computeWeeklySetCounts,
  computeWeeklyVolumeKg,
  computeWeeklyWorkoutCounts,
} from './trainingOverTime';

// A fixed "now" that's itself a Wednesday, so the current week's Monday is
// unambiguous and every test date below is deliberately placed relative to
// it rather than relying on the real clock.
const NOW = new Date('2026-09-09T12:00:00'); // Wednesday

describe('computeWeeklyWorkoutCounts', () => {
  // Regression: weeks were counted back in fixed 7-day steps of hours, so after the clocks went
  // back (1 November 2026 in North America) every earlier Monday was an hour off local midnight
  // and the workouts in those weeks went uncounted. Where the test runs without clock changes
  // (UTC), this passes either way.
  it('counts weeks from before a clock change', () => {
    const now = new Date(2026, 10, 13, 12);
    const points = computeWeeklyWorkoutCounts(
      [
        { performedAt: new Date(2026, 10, 13, 9).toISOString() },
        { performedAt: new Date(2026, 9, 23, 12).toISOString() },
        { performedAt: new Date(2026, 8, 1, 18).toISOString() },
      ],
      12,
      now,
    );
    expect(points.reduce((sum, point) => sum + point.value, 0)).toBe(3);
    for (const point of points) {
      const monday = new Date(point.weekStart);
      expect([monday.getDay(), monday.getHours(), monday.getMinutes()]).toEqual([1, 0, 0]);
    }
  });

  it('returns exactly `weeks` points, oldest first, including weeks with zero workouts', () => {
    const points = computeWeeklyWorkoutCounts([], 4, NOW);

    expect(points).toHaveLength(4);
    expect(points.every((p) => p.value === 0)).toBe(true);
    // Ascending chronological order.
    const times = points.map((p) => new Date(p.weekStart).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('counts each workout in the Monday-start week it was performed', () => {
    const points = computeWeeklyWorkoutCounts(
      [
        { performedAt: '2026-09-07T08:00:00' }, // Monday of the current week
        { performedAt: '2026-09-09T08:00:00' }, // Wednesday, same week
        { performedAt: '2026-09-01T08:00:00' }, // previous Tuesday
      ],
      2,
      NOW,
    );

    expect(points).toHaveLength(2);
    expect(points[0].value).toBe(1); // previous week
    expect(points[1].value).toBe(2); // current week
  });

  it('does not count a workout outside the requested window', () => {
    const points = computeWeeklyWorkoutCounts([{ performedAt: '2026-01-01T00:00:00' }], 2, NOW);

    expect(points.reduce((sum, p) => sum + p.value, 0)).toBe(0);
  });
});

describe('computeWeeklyVolumeKg', () => {
  it('sums weight x reps for completed sets per week', () => {
    const points = computeWeeklyVolumeKg(
      [
        { performedAt: '2026-09-09T08:00:00', weightKg: 100, reps: 5 },
        { performedAt: '2026-09-08T08:00:00', weightKg: 60, reps: 10 },
      ],
      1,
      NOW,
    );

    expect(points).toHaveLength(1);
    expect(points[0].value).toBe(100 * 5 + 60 * 10);
  });
});

describe('computeWeeklySetCounts', () => {
  it('counts one per set in its own week', () => {
    const points = computeWeeklySetCounts(
      [{ performedAt: '2026-09-09T08:00:00' }, { performedAt: '2026-09-09T09:00:00' }],
      1,
      NOW,
    );

    expect(points[0].value).toBe(2);
  });
});
