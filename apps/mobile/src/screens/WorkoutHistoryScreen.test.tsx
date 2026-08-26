import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { fetchActiveWorkout, fetchWorkoutHistory } from '../workouts/workoutQueries';
import { WorkoutHistoryScreen } from './WorkoutHistoryScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../workouts/workoutQueries', () => ({
  fetchActiveWorkout: jest.fn(),
  fetchWorkoutHistory: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockFetchActiveWorkout = fetchActiveWorkout as jest.Mock;
const mockFetchWorkoutHistory = fetchWorkoutHistory as jest.Mock;

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};

const completedWorkout = {
  id: 'w1',
  name: 'Push Day',
  performedAt: '2026-01-01T00:00:00Z',
  completedAt: '2026-01-01T01:00:00Z',
};

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
  mockFetchActiveWorkout.mockReset().mockResolvedValue(null);
  mockFetchWorkoutHistory
    .mockReset()
    .mockResolvedValue({ rows: [completedWorkout], hasMore: false });
  mockNavigate.mockClear();
  mockGoBack.mockClear();
});

// FlatList/VirtualizedList schedules a deferred internal setState (cell
// render bookkeeping) via a real setTimeout that can otherwise fire after a
// test ends. Calling this at the end of each test, while the component is
// still mounted, lets that pending timer settle inside act() before RNTL's
// automatic cleanup unmounts it (see ExerciseLibraryScreen.test.tsx for the
// original diagnosis of this pattern).
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
}

describe('WorkoutHistoryScreen', () => {
  it('loads and displays completed workouts', async () => {
    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);

    expect(await screen.findByTestId('workout-item-w1')).toHaveTextContent(/Push Day/);
    expect(screen.getByTestId('start-new-workout')).toBeTruthy();
    await settle();
  });

  it('shows a resume banner instead of "start new" when a draft is active', async () => {
    mockFetchActiveWorkout.mockResolvedValue({
      id: 'draft-1',
      name: 'Leg Day',
      performedAt: '2026-01-02T00:00:00Z',
      completedAt: null,
    });

    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);

    expect(await screen.findByTestId('resume-active-workout')).toHaveTextContent(/Leg Day/);
    expect(screen.queryByTestId('start-new-workout')).toBeNull();

    fireEvent.press(screen.getByTestId('resume-active-workout'));
    expect(mockNavigate).toHaveBeenCalledWith('ActiveWorkout', { workoutId: 'draft-1' });
    await settle();
  });

  it('navigates to NewWorkout when "Start New Workout" is pressed', async () => {
    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('start-new-workout');

    fireEvent.press(screen.getByTestId('start-new-workout'));

    expect(mockNavigate).toHaveBeenCalledWith('NewWorkout');
    await settle();
  });

  it('navigates to WorkoutDetail when a history item is pressed', async () => {
    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('workout-item-w1');

    fireEvent.press(screen.getByTestId('workout-item-w1'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutDetail', { workoutId: 'w1' });
    await settle();
  });

  it('goes back when Back is pressed', async () => {
    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('workout-item-w1');

    fireEvent.press(screen.getByTestId('workout-history-back'));

    expect(mockGoBack).toHaveBeenCalled();
    await settle();
  });

  it('loads more history on press and appends results', async () => {
    mockFetchWorkoutHistory
      .mockResolvedValueOnce({ rows: [completedWorkout], hasMore: true })
      .mockResolvedValueOnce({
        rows: [{ ...completedWorkout, id: 'w2', name: 'Pull Day' }],
        hasMore: false,
      });

    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('workout-item-w1');
    expect(screen.getByTestId('workout-history-load-more')).toBeTruthy();

    fireEvent.press(screen.getByTestId('workout-history-load-more'));

    expect(await screen.findByTestId('workout-item-w2')).toBeTruthy();
    expect(mockFetchWorkoutHistory).toHaveBeenLastCalledWith('user-1', 1, 20);
    await settle();
  });

  it('shows an error message when loading fails', async () => {
    mockFetchWorkoutHistory.mockRejectedValue(new Error('network error'));

    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);

    expect(await screen.findByTestId('workout-history-error')).toHaveTextContent('network error');
    await settle();
  });

  it('shows an empty state when there are no workouts', async () => {
    mockFetchWorkoutHistory.mockResolvedValue({ rows: [], hasMore: false });

    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);

    await waitFor(() => expect(screen.queryByTestId('workout-history-loading')).toBeNull());
    expect(screen.getByText('No workouts yet')).toBeTruthy();
    await settle();
  });
});
