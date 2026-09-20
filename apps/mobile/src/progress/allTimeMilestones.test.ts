import type { HistoricalSetWithExercise } from '../workouts/allExerciseHistoryQueries';
import type { WorkoutSummary } from '../workouts/workoutQueries';
import { computeLifetimeMilestones } from './allTimeMilestones';

function workout(overrides: Partial<WorkoutSummary> = {}): WorkoutSummary {
  return {
    id: 'w1',
    name: 'Push Day',
    performedAt: '2026-01-01T00:00:00Z',
    completedAt: '2026-01-01T01:00:00Z',
    workoutSplitDayId: null,
    ...overrides,
  };
}

function set(overrides: Partial<HistoricalSetWithExercise> = {}): HistoricalSetWithExercise {
  return {
    weightKg: 100,
    reps: 5,
    performedAt: '2026-01-01T00:00:00Z',
    workoutExerciseId: 'we1',
    exerciseId: 'ex-1',
    exerciseName: 'Barbell Squat',
    muscleGroup: 'quadriceps',
    movementType: 'bilateral',
    ...overrides,
  };
}

describe('computeLifetimeMilestones', () => {
  it('returns nothing with no workouts and no history', () => {
    expect(computeLifetimeMilestones([], [], 'lb')).toEqual([]);
  });

  it('reports "First Workout" once a single workout exists', () => {
    const workouts = [workout({ performedAt: '2026-01-05T00:00:00Z' })];

    expect(computeLifetimeMilestones(workouts, [], 'lb')).toEqual([
      { key: 'workouts-1', label: 'First Workout', achievedAt: '2026-01-05T00:00:00Z' },
    ]);
  });

  it('only reports "First 100 Workouts" once the user has actually logged 100', () => {
    const under100 = Array.from({ length: 99 }, (_, i) =>
      workout({ performedAt: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z` }),
    );
    expect(computeLifetimeMilestones(under100, [], 'lb').map((m) => m.key)).not.toContain(
      'workouts-100',
    );

    const at100 = [...under100, workout({ performedAt: '2026-06-01T00:00:00Z' })];
    expect(computeLifetimeMilestones(at100, [], 'lb').map((m) => m.key)).toContain('workouts-100');
  });

  it('reports the highest lifetime-volume threshold crossed, in the display unit, with a real achieved date', () => {
    // 1 set of 500 lb-equivalent-ish weight x 100 reps performed once =
    // crosses the 50,000 lb threshold but not 100,000.
    const history = [
      set({ weightKg: 226.8, reps: 100, performedAt: '2026-02-01T00:00:00Z' }), // ~50,000 lb
    ];

    const milestones = computeLifetimeMilestones([], history, 'lb');
    expect(milestones).toEqual([
      { key: 'volume-50000', label: 'Hit 50,000 lb Volume', achievedAt: '2026-02-01T00:00:00Z' },
    ]);
  });

  it('never reports a volume threshold that was not actually reached', () => {
    const history = [set({ weightKg: 100, reps: 5, performedAt: '2026-01-01T00:00:00Z' })];

    expect(computeLifetimeMilestones([], history, 'lb')).toEqual([]);
  });

  it('sorts every milestone chronologically by when it was achieved', () => {
    const workouts = [
      workout({ performedAt: '2026-01-01T00:00:00Z' }), // First Workout
    ];
    const history = [
      set({ weightKg: 226.8, reps: 100, performedAt: '2025-12-01T00:00:00Z' }), // volume milestone, earlier
    ];

    const milestones = computeLifetimeMilestones(workouts, history, 'lb');
    expect(milestones.map((m) => m.key)).toEqual(['volume-50000', 'workouts-1']);
  });

  it('uses a parallel round-number ladder for kg so thresholds stay clean in either unit', () => {
    const history = [set({ weightKg: 25000, reps: 1, performedAt: '2026-01-01T00:00:00Z' })];

    const milestones = computeLifetimeMilestones([], history, 'kg');
    expect(milestones).toEqual([
      { key: 'volume-25000', label: 'Hit 25,000 kg Volume', achievedAt: '2026-01-01T00:00:00Z' },
    ]);
  });
});
