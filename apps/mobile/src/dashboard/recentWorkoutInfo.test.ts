import { fetchOneRepMax, fetchRepPRs } from '../workouts/prQueries';
import {
  fetchPreviousPerformance,
  fetchWorkoutDetail,
  fetchWorkoutHistory,
} from '../workouts/workoutQueries';
import { fetchRecentWorkoutInfo } from './recentWorkoutInfo';

jest.mock('../workouts/workoutQueries', () => ({
  fetchWorkoutHistory: jest.fn(),
  fetchWorkoutDetail: jest.fn(),
  fetchPreviousPerformance: jest.fn(),
}));

jest.mock('../workouts/prQueries', () => ({
  fetchRepPRs: jest.fn(),
  fetchOneRepMax: jest.fn(),
}));

const mockFetchWorkoutHistory = fetchWorkoutHistory as jest.Mock;
const mockFetchWorkoutDetail = fetchWorkoutDetail as jest.Mock;
const mockFetchPreviousPerformance = fetchPreviousPerformance as jest.Mock;
const mockFetchRepPRs = fetchRepPRs as jest.Mock;
const mockFetchOneRepMax = fetchOneRepMax as jest.Mock;

const workoutSummary = {
  id: 'w1',
  name: 'Push Day',
  performedAt: '2026-01-01T10:00:00Z',
  completedAt: '2026-01-01T11:15:00Z',
};

const workoutDetail = {
  ...workoutSummary,
  exercises: [
    {
      id: 'we1',
      exerciseId: 'ex1',
      exerciseName: 'Bench Press',
      muscleGroup: 'chest' as const,
      orderIndex: 1,
      sets: [
        { id: 's1', setIndex: 1, weightKg: 100, reps: 10 },
        { id: 's2', setIndex: 2, weightKg: 110, reps: 8 },
      ],
    },
    {
      id: 'we2',
      exerciseId: 'ex2',
      exerciseName: 'Overhead Press',
      muscleGroup: 'shoulders' as const,
      orderIndex: 2,
      sets: [{ id: 's3', setIndex: 1, weightKg: 60, reps: 8 }],
    },
  ],
};

beforeEach(() => {
  mockFetchWorkoutHistory.mockReset().mockResolvedValue({ rows: [workoutSummary], hasMore: false });
  mockFetchWorkoutDetail.mockReset().mockResolvedValue(workoutDetail);
  mockFetchPreviousPerformance.mockReset().mockResolvedValue(null);
  mockFetchRepPRs.mockReset().mockResolvedValue([]);
  mockFetchOneRepMax.mockReset().mockResolvedValue(null);
});

describe('fetchRecentWorkoutInfo', () => {
  it('returns null when the user has no completed workout yet', async () => {
    mockFetchWorkoutHistory.mockResolvedValue({ rows: [], hasMore: false });

    await expect(fetchRecentWorkoutInfo('user-1')).resolves.toBeNull();
    expect(mockFetchWorkoutDetail).not.toHaveBeenCalled();
  });

  it('picks the heaviest set across all exercises as the top set', async () => {
    const result = await fetchRecentWorkoutInfo('user-1');

    expect(result?.topExerciseName).toBe('Bench Press');
    expect(result?.topSet).toEqual({ id: 's2', setIndex: 2, weightKg: 110, reps: 8 });
  });

  it('joins distinct muscle groups trained, without duplicates', async () => {
    const result = await fetchRecentWorkoutInfo('user-1');

    expect(result?.musclesTrained).toBe('Chest, Shoulders');
  });

  it('computes duration from performedAt/completedAt', async () => {
    const result = await fetchRecentWorkoutInfo('user-1');

    expect(result?.durationMinutes).toBe(75);
  });

  it('returns null duration when the workout has no completedAt', async () => {
    mockFetchWorkoutDetail.mockResolvedValue({ ...workoutDetail, completedAt: null });

    const result = await fetchRecentWorkoutInfo('user-1');

    expect(result?.durationMinutes).toBeNull();
  });

  it('labels a rep-count PR only when the top set is the current source', async () => {
    mockFetchRepPRs.mockResolvedValue([
      { reps: 8, bestWeightKg: 110, sourceSetId: 's2', achievedAt: '2026-01-01T00:00:00Z' },
    ]);

    const result = await fetchRecentWorkoutInfo('user-1');

    expect(result?.prLabel).toBe('8 Rep PR');
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

    const result = await fetchRecentWorkoutInfo('user-1');

    expect(result?.prLabel).toBeNull();
  });

  it('labels a true 1RM only for a 1-rep top set that is the current source', async () => {
    const oneRepDetail = {
      ...workoutDetail,
      exercises: [
        {
          ...workoutDetail.exercises[0],
          sets: [{ id: 's9', setIndex: 1, weightKg: 140, reps: 1 }],
        },
      ],
    };
    mockFetchWorkoutDetail.mockResolvedValue(oneRepDetail);
    mockFetchOneRepMax.mockResolvedValue({
      weightKg: 140,
      sourceSetId: 's9',
      achievedAt: '2026-01-01T00:00:00Z',
    });

    const result = await fetchRecentWorkoutInfo('user-1');

    expect(result?.prLabel).toBe('1RM');
  });

  it('returns raw current and previous sets for the top exercise, unformatted', async () => {
    mockFetchPreviousPerformance.mockResolvedValue({
      performedAt: '2025-12-25T00:00:00Z',
      sets: [{ id: 'p1', setIndex: 1, weightKg: 100, reps: 8 }],
    });

    const result = await fetchRecentWorkoutInfo('user-1');

    expect(result?.topExerciseSets).toEqual(workoutDetail.exercises[0].sets);
    expect(result?.previousExerciseSets).toEqual([
      { id: 'p1', setIndex: 1, weightKg: 100, reps: 8 },
    ]);
    expect(mockFetchPreviousPerformance).toHaveBeenCalledWith('user-1', 'ex1', 'w1');
  });

  it('returns an empty previous-sets array when there is no previous occurrence', async () => {
    const result = await fetchRecentWorkoutInfo('user-1');

    expect(result?.previousExerciseSets).toEqual([]);
  });
});
