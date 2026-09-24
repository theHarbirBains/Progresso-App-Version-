import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { fetchAllExerciseHistory } from '../workouts/allExerciseHistoryQueries';
import { fetchAllOneRepMaxes, fetchAllRepPRs } from '../workouts/prSummaryQueries';
import { fetchAllCompletedWorkouts } from './progressStatsQueries';
import { AllTimeStatsProvider, useAllTimeStats } from './AllTimeStatsProvider';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('./progressStatsQueries', () => ({
  fetchAllCompletedWorkouts: jest.fn(),
}));

jest.mock('../workouts/allExerciseHistoryQueries', () => ({
  fetchAllExerciseHistory: jest.fn(),
}));

jest.mock('../workouts/prSummaryQueries', () => ({
  fetchAllRepPRs: jest.fn(),
  fetchAllOneRepMaxes: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockFetchAllCompletedWorkouts = fetchAllCompletedWorkouts as jest.Mock;
const mockFetchAllExerciseHistory = fetchAllExerciseHistory as jest.Mock;
const mockFetchAllRepPRs = fetchAllRepPRs as jest.Mock;
const mockFetchAllOneRepMaxes = fetchAllOneRepMaxes as jest.Mock;

const sampleWorkout = { id: 'w1', name: 'Push', performedAt: '2026-01-01T00:00:00Z' };
const sampleSet = { id: 's1', exerciseId: 'e1' };
const sampleRepPR = { id: 'pr1', exerciseId: 'e1' };
const sampleOneRepMax = { id: 'orm1', exerciseId: 'e1' };

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
  mockFetchAllCompletedWorkouts.mockReset().mockResolvedValue([sampleWorkout]);
  mockFetchAllExerciseHistory.mockReset().mockResolvedValue([sampleSet]);
  mockFetchAllRepPRs.mockReset().mockResolvedValue([sampleRepPR]);
  mockFetchAllOneRepMaxes.mockReset().mockResolvedValue([sampleOneRepMax]);
});

describe('AllTimeStatsProvider', () => {
  it('fetches all four queries once and exposes them', async () => {
    const { result } = renderHook(() => useAllTimeStats(), { wrapper: AllTimeStatsProvider });

    expect(result.current.statsLoading).toBe(true);
    expect(result.current.prsLoading).toBe(true);
    await waitFor(() => expect(result.current.statsLoading).toBe(false));
    await waitFor(() => expect(result.current.prsLoading).toBe(false));

    expect(result.current.allWorkouts).toEqual([sampleWorkout]);
    expect(result.current.allSetHistory).toEqual([sampleSet]);
    expect(result.current.repPRs).toEqual([sampleRepPR]);
    expect(result.current.oneRepMaxes).toEqual([sampleOneRepMax]);
    expect(mockFetchAllCompletedWorkouts).toHaveBeenCalledWith('user-1');
  });

  // The entire point of this provider: previously, ProfileScreen and
  // ProgressOverviewScreen each fetched the user's whole history
  // independently on every focus -- two consumers reading the same context
  // must only cost one fetch of each query.
  it('fetches only once, even with multiple consumers reading the same context', async () => {
    function ConsumerA() {
      useAllTimeStats();
      return null;
    }
    function ConsumerB() {
      useAllTimeStats();
      return null;
    }

    render(
      <AllTimeStatsProvider>
        <ConsumerA />
        <ConsumerB />
      </AllTimeStatsProvider>,
    );

    await waitFor(() => expect(mockFetchAllCompletedWorkouts).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(mockFetchAllCompletedWorkouts).toHaveBeenCalledTimes(1);
    expect(mockFetchAllRepPRs).toHaveBeenCalledTimes(1);
  });

  it('keeps stats and PRs independent -- a failure in one does not block the other', async () => {
    mockFetchAllCompletedWorkouts.mockRejectedValue(new Error('stats down'));

    const { result } = renderHook(() => useAllTimeStats(), { wrapper: AllTimeStatsProvider });

    await waitFor(() => expect(result.current.statsLoading).toBe(false));
    await waitFor(() => expect(result.current.prsLoading).toBe(false));

    expect(result.current.statsError).toBe('stats down');
    expect(result.current.allWorkouts).toEqual([]);
    expect(result.current.prsError).toBeNull();
    expect(result.current.repPRs).toEqual([sampleRepPR]);
  });

  it('does not fetch while signed out, and leaves everything empty', async () => {
    mockUseAuth.mockReturnValue({ user: null });

    const { result } = renderHook(() => useAllTimeStats(), { wrapper: AllTimeStatsProvider });

    expect(result.current.allWorkouts).toEqual([]);
    expect(mockFetchAllCompletedWorkouts).not.toHaveBeenCalled();
  });

  it('refetch re-fetches from the server -- this is what ActiveWorkoutScreen calls after completing a workout', async () => {
    const { result } = renderHook(() => useAllTimeStats(), { wrapper: AllTimeStatsProvider });
    await waitFor(() => expect(result.current.statsLoading).toBe(false));

    mockFetchAllCompletedWorkouts.mockResolvedValue([
      sampleWorkout,
      { ...sampleWorkout, id: 'w2' },
    ]);
    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.allWorkouts).toHaveLength(2);
  });

  it('throws a clear error when used outside an AllTimeStatsProvider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAllTimeStats())).toThrow(
      'useAllTimeStats must be used within an AllTimeStatsProvider',
    );
    consoleError.mockRestore();
  });
});
