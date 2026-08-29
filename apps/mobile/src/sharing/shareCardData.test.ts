import { fetchOneRepMax, fetchRepPRs } from '../workouts/prQueries';
import { fetchWorkoutDetail } from '../workouts/workoutQueries';
import { fetchShareCardData } from './shareCardData';

jest.mock('../workouts/workoutQueries', () => ({
  fetchWorkoutDetail: jest.fn(),
}));

jest.mock('../workouts/prQueries', () => ({
  fetchRepPRs: jest.fn(),
  fetchOneRepMax: jest.fn(),
}));

const mockFetchWorkoutDetail = fetchWorkoutDetail as jest.Mock;
const mockFetchRepPRs = fetchRepPRs as jest.Mock;
const mockFetchOneRepMax = fetchOneRepMax as jest.Mock;

function exercise(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'we1',
    exerciseId: 'ex1',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest' as const,
    orderIndex: 1,
    sets: [{ id: 's1', setIndex: 1, weightKg: 100, reps: 8 }],
    ...overrides,
  };
}

function workoutDetail(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'w1',
    name: 'Push Day',
    performedAt: '2026-01-01T10:00:00Z',
    completedAt: '2026-01-01T11:00:00Z',
    exercises: [exercise()],
    ...overrides,
  };
}

beforeEach(() => {
  mockFetchWorkoutDetail.mockReset().mockResolvedValue(workoutDetail());
  mockFetchRepPRs.mockReset().mockResolvedValue([]);
  mockFetchOneRepMax.mockReset().mockResolvedValue(null);
});

describe('fetchShareCardData', () => {
  it('rejects an incomplete (active) workout', async () => {
    mockFetchWorkoutDetail.mockResolvedValue(workoutDetail({ completedAt: null }));

    await expect(fetchShareCardData('w1', 'user-1')).rejects.toThrow(
      'Only completed workouts can be shared',
    );
  });

  it('returns the workout name, date, and muscles trained', async () => {
    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.workoutName).toBe('Push Day');
    expect(result.performedAt).toBe('2026-01-01T10:00:00Z');
    expect(result.musclesTrained).toBe('Chest');
  });

  it('dedupes muscle groups across exercises', async () => {
    mockFetchWorkoutDetail.mockResolvedValue(
      workoutDetail({
        exercises: [
          exercise({ id: 'we1', exerciseId: 'ex1', muscleGroup: 'chest' }),
          exercise({ id: 'we2', exerciseId: 'ex2', muscleGroup: 'chest' }),
          exercise({ id: 'we3', exerciseId: 'ex3', muscleGroup: 'triceps' }),
        ],
      }),
    );

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.musclesTrained).toBe('Chest, Triceps');
  });

  it('computes duration from performedAt/completedAt', async () => {
    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.durationMinutes).toBe(60);
  });

  it('returns null duration when completedAt is not after performedAt', async () => {
    mockFetchWorkoutDetail.mockResolvedValue(
      workoutDetail({ performedAt: '2026-01-01T10:00:00Z', completedAt: '2026-01-01T10:00:00Z' }),
    );

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.durationMinutes).toBeNull();
  });

  it('picks the heaviest set per exercise as its top set', async () => {
    mockFetchWorkoutDetail.mockResolvedValue(
      workoutDetail({
        exercises: [
          exercise({
            sets: [
              { id: 's1', setIndex: 1, weightKg: 100, reps: 10 },
              { id: 's2', setIndex: 2, weightKg: 110, reps: 8 },
            ],
          }),
        ],
      }),
    );

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.topSets).toEqual([
      { exerciseName: 'Bench Press', weightKg: 110, reps: 8, prLabel: null },
    ]);
  });

  it('shows all exercises when there are 5 or fewer', async () => {
    const exercises = Array.from({ length: 5 }, (_, i) =>
      exercise({ id: `we${i}`, exerciseId: `ex${i}`, exerciseName: `Exercise ${i}` }),
    );
    mockFetchWorkoutDetail.mockResolvedValue(workoutDetail({ exercises }));

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.topSets).toHaveLength(5);
  });

  it('caps at the first 5 exercises in existing workout order when there are more than 5', async () => {
    const exercises = Array.from({ length: 8 }, (_, i) =>
      exercise({ id: `we${i}`, exerciseId: `ex${i}`, exerciseName: `Exercise ${i}` }),
    );
    mockFetchWorkoutDetail.mockResolvedValue(workoutDetail({ exercises }));

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.topSets.map((s) => s.exerciseName)).toEqual([
      'Exercise 0',
      'Exercise 1',
      'Exercise 2',
      'Exercise 3',
      'Exercise 4',
    ]);
  });

  it('skips an exercise with no sets rather than crashing', async () => {
    mockFetchWorkoutDetail.mockResolvedValue(
      workoutDetail({ exercises: [exercise({ sets: [] })] }),
    );

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.topSets).toEqual([]);
  });

  it('labels a rep-count PR only when the top set is the current source', async () => {
    mockFetchRepPRs.mockResolvedValue([
      { reps: 8, bestWeightKg: 100, sourceSetId: 's1', achievedAt: '2026-01-01T00:00:00Z' },
    ]);

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.topSets[0].prLabel).toBe('8 Rep PR');
  });

  it('does not label a PR when a different set holds the current record', async () => {
    mockFetchRepPRs.mockResolvedValue([
      {
        reps: 8,
        bestWeightKg: 120,
        sourceSetId: 'some-other-set',
        achievedAt: '2026-01-01T00:00:00Z',
      },
    ]);

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.topSets[0].prLabel).toBeNull();
  });

  it('labels a true 1RM only for a 1-rep top set that is the current source', async () => {
    mockFetchWorkoutDetail.mockResolvedValue(
      workoutDetail({
        exercises: [exercise({ sets: [{ id: 's9', setIndex: 1, weightKg: 140, reps: 1 }] })],
      }),
    );
    mockFetchOneRepMax.mockResolvedValue({
      weightKg: 140,
      sourceSetId: 's9',
      achievedAt: '2026-01-01T00:00:00Z',
    });

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.topSets[0].prLabel).toBe('1RM');
  });

  it('returns an empty topSets array for a workout with no qualifying sets', async () => {
    mockFetchWorkoutDetail.mockResolvedValue(workoutDetail({ exercises: [] }));

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.topSets).toEqual([]);
    expect(result.musclesTrained).toBe('');
  });

  it('handles unusually large weights and reps without altering the definition', async () => {
    mockFetchWorkoutDetail.mockResolvedValue(
      workoutDetail({
        exercises: [exercise({ sets: [{ id: 's1', setIndex: 1, weightKg: 500.5, reps: 50 }] })],
      }),
    );

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.topSets[0]).toEqual({
      exerciseName: 'Bench Press',
      weightKg: 500.5,
      reps: 50,
      prLabel: null,
    });
  });
});
