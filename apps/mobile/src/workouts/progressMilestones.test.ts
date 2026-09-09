import type { DetailedChartPoint } from './exerciseProgress';
import { deriveMilestones } from './progressMilestones';

function point(weightKg: number, reps: number, performedAt: string): DetailedChartPoint {
  return { weightKg, reps, performedAt, workoutExerciseId: `we-${performedAt}` };
}

describe('deriveMilestones', () => {
  it('returns an empty array for no points', () => {
    expect(deriveMilestones([], 'kg')).toEqual([]);
  });

  it('always includes the first recorded point', () => {
    const points = [point(100, 5, '2026-01-01T00:00:00Z')];

    const milestones = deriveMilestones(points, 'kg');

    expect(milestones).toEqual([
      {
        kind: 'first',
        label: 'First recorded: 100kg × 5',
        achievedAt: '2026-01-01T00:00:00Z',
        displayWeight: 100,
      },
    ]);
  });

  it('adds a milestone at each 10-unit improvement over the start, in the display unit', () => {
    const points = [
      point(100, 5, '2026-01-01T00:00:00Z'),
      point(105, 5, '2026-02-01T00:00:00Z'), // +5, no milestone yet
      point(112, 5, '2026-03-01T00:00:00Z'), // +12, crosses +10
      point(122, 5, '2026-04-01T00:00:00Z'), // +22, crosses +20
    ];

    const milestones = deriveMilestones(points, 'kg');

    expect(milestones.map((m) => m.kind)).toEqual(['first', 'improvement', 'improvement']);
    expect(milestones[1]).toEqual({
      kind: 'improvement',
      label: '+10kg improvement',
      achievedAt: '2026-03-01T00:00:00Z',
      displayWeight: 112,
    });
    expect(milestones[2]).toEqual({
      kind: 'improvement',
      label: '+20kg improvement',
      achievedAt: '2026-04-01T00:00:00Z',
      displayWeight: 122,
    });
  });

  it('emits multiple milestones from a single large jump, in order', () => {
    const points = [point(100, 5, '2026-01-01T00:00:00Z'), point(135, 5, '2026-02-01T00:00:00Z')];

    const milestones = deriveMilestones(points, 'kg');

    expect(milestones.map((m) => m.label)).toEqual([
      'First recorded: 100kg × 5',
      '+10kg improvement',
      '+20kg improvement',
      '+30kg improvement',
    ]);
    expect(milestones.slice(1).every((m) => m.achievedAt === '2026-02-01T00:00:00Z')).toBe(true);
  });

  it('never emits an improvement milestone for a regression', () => {
    const points = [point(150, 5, '2026-01-01T00:00:00Z'), point(140, 5, '2026-02-01T00:00:00Z')];

    const milestones = deriveMilestones(points, 'kg');

    expect(milestones).toHaveLength(1);
    expect(milestones[0].kind).toBe('first');
  });

  it('computes milestones in the requested display unit, not kg', () => {
    // 45.359237 kg ~= 100 lb; +4.5359237 kg ~= +10 lb.
    const points = [
      point(45.359237, 5, '2026-01-01T00:00:00Z'),
      point(45.359237 + 4.5359237, 5, '2026-02-01T00:00:00Z'),
    ];

    const milestones = deriveMilestones(points, 'lb');

    expect(milestones[1]).toEqual({
      kind: 'improvement',
      label: '+10lb improvement',
      achievedAt: '2026-02-01T00:00:00Z',
      displayWeight: 110,
    });
  });
});
