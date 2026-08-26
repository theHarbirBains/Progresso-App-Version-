import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import {
  completeWorkout,
  createSet,
  deleteSet,
  fetchPreviousPerformance,
  fetchWorkoutDetail,
  updateSet,
} from '../workouts/workoutQueries';
import { ActiveWorkoutScreen } from './ActiveWorkoutScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
}));

jest.mock('../workouts/workoutQueries', () => ({
  fetchWorkoutDetail: jest.fn(),
  fetchPreviousPerformance: jest.fn(),
  createSet: jest.fn(),
  updateSet: jest.fn(),
  deleteSet: jest.fn(),
  completeWorkout: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockFetchWorkoutDetail = fetchWorkoutDetail as jest.Mock;
const mockFetchPreviousPerformance = fetchPreviousPerformance as jest.Mock;
const mockCreateSet = createSet as jest.Mock;
const mockUpdateSet = updateSet as jest.Mock;
const mockDeleteSet = deleteSet as jest.Mock;
const mockCompleteWorkout = completeWorkout as jest.Mock;

const mockGoBack = jest.fn();
const mockReset = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack, reset: mockReset };
const route = { params: { workoutId: 'w1' } } as never;

const baseWorkout = {
  id: 'w1',
  name: 'Push Day',
  performedAt: '2026-01-01T00:00:00Z',
  completedAt: null,
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
  ],
};

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockGetMyProfile.mockReset().mockResolvedValue({
    id: 'user-1',
    email: 'a@example.com',
    role: 'user',
    displayName: null,
    username: null,
    weightUnit: 'kg',
  });
  mockFetchWorkoutDetail.mockReset().mockResolvedValue(baseWorkout);
  mockFetchPreviousPerformance.mockReset().mockResolvedValue(null);
  mockCreateSet.mockReset();
  mockUpdateSet.mockReset();
  mockDeleteSet.mockReset();
  mockCompleteWorkout.mockReset();
  mockGoBack.mockClear();
  mockReset.mockClear();
});

describe('ActiveWorkoutScreen', () => {
  it('loads and displays the workout, its exercises, and sets', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);

    expect(await screen.findByText('Push Day')).toBeTruthy();
    expect(screen.getByTestId('exercise-card-we1')).toHaveTextContent(/Bench Press/);
    expect(screen.getByTestId('set-weight-s1').props.value).toBe('100');
    expect(screen.getByTestId('set-reps-s1').props.value).toBe('10');
  });

  it('shows the computed top set (heaviest logged weight)', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('top-set-we1')).toHaveTextContent('Top set: 110kg×8');
  });

  it('shows previous performance when available', async () => {
    mockFetchPreviousPerformance.mockResolvedValue({
      performedAt: '2025-12-25T00:00:00Z',
      sets: [{ id: 'old1', setIndex: 1, weightKg: 90, reps: 10 }],
    });

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);

    expect(await screen.findByText(/Last time: 90kg×10/)).toBeTruthy();
  });

  it('shows a message when there is no previous performance', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);

    expect(await screen.findByText('No previous performance recorded')).toBeTruthy();
  });

  it('adds a set, converting the input weight to kg for storage', async () => {
    mockCreateSet.mockResolvedValue({ id: 's3', setIndex: 3, weightKg: 120, reps: 6 });

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('exercise-card-we1');

    fireEvent.changeText(screen.getByTestId('new-set-weight-we1'), '120');
    fireEvent.changeText(screen.getByTestId('new-set-reps-we1'), '6');
    await act(async () => {
      fireEvent.press(screen.getByTestId('add-set-we1'));
    });

    expect(mockCreateSet).toHaveBeenCalledWith('we1', 3, 120, 6);
    expect(await screen.findByTestId('set-weight-s3')).toBeTruthy();
  });

  it('converts lb input to kg when the user prefers lb', async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      role: 'user',
      displayName: null,
      username: null,
      weightUnit: 'lb',
    });
    mockCreateSet.mockResolvedValue({ id: 's3', setIndex: 3, weightKg: 45.36, reps: 6 });

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('exercise-card-we1');

    fireEvent.changeText(screen.getByTestId('new-set-weight-we1'), '100');
    fireEvent.changeText(screen.getByTestId('new-set-reps-we1'), '6');
    await act(async () => {
      fireEvent.press(screen.getByTestId('add-set-we1'));
    });

    expect(mockCreateSet).toHaveBeenCalledWith('we1', 3, 45.36, 6);
  });

  it('rejects a non-positive weight or rep count without calling createSet', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('exercise-card-we1');

    fireEvent.changeText(screen.getByTestId('new-set-weight-we1'), '-5');
    fireEvent.changeText(screen.getByTestId('new-set-reps-we1'), '6');
    fireEvent.press(screen.getByTestId('add-set-we1'));

    expect(await screen.findByTestId('active-workout-inline-error')).toBeTruthy();
    expect(mockCreateSet).not.toHaveBeenCalled();
  });

  it('updates a set when its weight input loses focus', async () => {
    mockUpdateSet.mockResolvedValue({ id: 's1', setIndex: 1, weightKg: 105, reps: 10 });

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('exercise-card-we1');

    fireEvent.changeText(screen.getByTestId('set-weight-s1'), '105');
    await act(async () => {
      fireEvent(screen.getByTestId('set-weight-s1'), 'endEditing');
    });

    expect(mockUpdateSet).toHaveBeenCalledWith('s1', { weightKg: 105, reps: 10 });
  });

  it('deletes a set', async () => {
    mockDeleteSet.mockResolvedValue(undefined);

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('exercise-card-we1');

    await act(async () => {
      fireEvent.press(screen.getByTestId('delete-set-s1'));
    });

    expect(mockDeleteSet).toHaveBeenCalledWith('s1');
    await waitFor(() => expect(screen.queryByTestId('set-row-s1')).toBeNull());
  });

  it('completes the workout and resets navigation to WorkoutHistory', async () => {
    mockCompleteWorkout.mockResolvedValue(undefined);

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('exercise-card-we1');

    await act(async () => {
      fireEvent.press(screen.getByTestId('complete-workout'));
    });

    expect(mockCompleteWorkout).toHaveBeenCalledWith('w1');
    expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'WorkoutHistory' }] });
  });

  it('shows an error message when loading the workout fails', async () => {
    mockFetchWorkoutDetail.mockRejectedValue(new Error('network error'));

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('active-workout-error')).toHaveTextContent('network error');
  });

  it('goes back when Back is pressed', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(screen.getByTestId('active-workout-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });
});
