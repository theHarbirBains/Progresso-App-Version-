import { fetchFeedItems } from './feedQueries';
import { fetchWorkoutHistory } from '../workouts/workoutQueries';
import { enrichWorkoutSummaries } from '../workouts/workoutHistoryEnrichment';
import { fetchWeeklyFoodLogs } from '../nutrition/foodLogQueries';

jest.mock('../workouts/workoutQueries', () => ({
  fetchWorkoutHistory: jest.fn(),
}));
jest.mock('../workouts/workoutHistoryEnrichment', () => ({
  enrichWorkoutSummaries: jest.fn(),
}));
jest.mock('../nutrition/foodLogQueries', () => ({
  fetchWeeklyFoodLogs: jest.fn(),
}));

const mockFetchWorkoutHistory = fetchWorkoutHistory as jest.Mock;
const mockEnrichWorkoutSummaries = enrichWorkoutSummaries as jest.Mock;
const mockFetchWeeklyFoodLogs = fetchWeeklyFoodLogs as jest.Mock;

const workout = {
  id: 'w1',
  name: 'Push Day',
  performedAt: '2026-01-01T12:00:00Z',
  completedAt: '2026-01-01T13:00:00Z',
  splitDayName: 'Push',
  muscleGroups: ['chest' as const],
  completedSetCount: 12,
  totalVolumeKg: 1000,
  durationMinutes: 60,
};

const olderWorkout = {
  ...workout,
  id: 'w0',
  performedAt: '2025-12-01T12:00:00Z',
  completedAt: '2025-12-01T13:00:00Z',
};

const foodLog = {
  id: 'log-1',
  foodId: 'food-1',
  foodNameSnapshot: 'Chicken Breast',
  servingSize: 100,
  servingUnit: 'g',
  quantity: 1,
  calories: 165,
  proteinG: 31,
  carbsG: 0,
  fatG: 3.6,
  mealType: 'lunch' as const,
  loggedAt: '2026-01-01T18:00:00Z',
};

beforeEach(() => {
  mockFetchWorkoutHistory.mockReset().mockResolvedValue({ rows: [{ id: 'w1' }], hasMore: false });
  mockEnrichWorkoutSummaries.mockReset().mockResolvedValue([workout]);
  mockFetchWeeklyFoodLogs.mockReset().mockResolvedValue([foodLog]);
});

describe('fetchFeedItems', () => {
  it('merges completed workouts and food logs into one reverse-chronological list', async () => {
    const page = await fetchFeedItems('user-1');

    expect(page.items.map((i) => i.id)).toEqual(['foodLog-log-1', 'workout-w1']);
  });

  it('excludes a workout that has not been completed yet', async () => {
    mockEnrichWorkoutSummaries.mockResolvedValue([{ ...workout, completedAt: null }]);

    const page = await fetchFeedItems('user-1');

    expect(page.items).toHaveLength(1);
    expect(page.items[0].kind).toBe('foodLog');
  });

  it('still shows food logs when the workout history fetch fails', async () => {
    mockFetchWorkoutHistory.mockRejectedValue(new Error('network down'));

    const page = await fetchFeedItems('user-1');

    expect(page.items).toHaveLength(1);
    expect(page.items[0].kind).toBe('foodLog');
    expect(page.hasMore).toBe(false);
  });

  it('still shows workouts when the food log fetch fails', async () => {
    mockFetchWeeklyFoodLogs.mockRejectedValue(new Error('network down'));

    const page = await fetchFeedItems('user-1');

    expect(page.items).toHaveLength(1);
    expect(page.items[0].kind).toBe('workout');
  });

  it('returns an empty page, never throwing, when both sources fail', async () => {
    mockFetchWorkoutHistory.mockRejectedValue(new Error('a'));
    mockFetchWeeklyFoodLogs.mockRejectedValue(new Error('b'));

    await expect(fetchFeedItems('user-1')).resolves.toEqual({ items: [], hasMore: false });
  });

  it('reports hasMore straight from the workout page, for Load More to key off', async () => {
    mockFetchWorkoutHistory.mockResolvedValue({ rows: [{ id: 'w1' }], hasMore: true });

    const page = await fetchFeedItems('user-1');

    expect(page.hasMore).toBe(true);
  });

  it('requests the given page of workout history', async () => {
    await fetchFeedItems('user-1', 2);

    expect(mockFetchWorkoutHistory).toHaveBeenCalledWith('user-1', 2, 20);
  });

  it('only fetches food logs on the first page, so older pages are workouts only', async () => {
    mockFetchWorkoutHistory.mockResolvedValue({ rows: [{ id: 'w0' }], hasMore: false });
    mockEnrichWorkoutSummaries.mockResolvedValue([olderWorkout]);

    const page = await fetchFeedItems('user-1', 1);

    expect(mockFetchWeeklyFoodLogs).not.toHaveBeenCalled();
    expect(page.items).toEqual([expect.objectContaining({ kind: 'workout', id: 'workout-w0' })]);
  });
});
