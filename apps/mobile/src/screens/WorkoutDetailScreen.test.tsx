import { fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import { fetchWorkoutDetail } from '../workouts/workoutQueries';
import { WorkoutDetailScreen } from './WorkoutDetailScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
}));

jest.mock('../workouts/workoutQueries', () => ({
  fetchWorkoutDetail: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockFetchWorkoutDetail = fetchWorkoutDetail as jest.Mock;

const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack };
const route = { params: { workoutId: 'w1' } } as never;

const workout = {
  id: 'w1',
  name: 'Push Day',
  performedAt: '2026-01-01T12:00:00Z',
  completedAt: '2026-01-01T13:00:00Z',
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
  mockUseAuth.mockReturnValue({ session: { access_token: 'token-123' } });
  mockGetMyProfile.mockReset().mockResolvedValue({
    id: 'user-1',
    email: 'a@example.com',
    role: 'user',
    displayName: null,
    username: null,
    weightUnit: 'kg',
  });
  mockFetchWorkoutDetail.mockReset().mockResolvedValue(workout);
  mockGoBack.mockClear();
});

describe('WorkoutDetailScreen', () => {
  it('loads and displays the workout with its exercises and sets', async () => {
    render(<WorkoutDetailScreen navigation={navigation} route={route} />);

    expect(await screen.findByText('Push Day')).toBeTruthy();
    expect(screen.getByTestId('exercise-card-we1')).toHaveTextContent(/Bench Press/);
    expect(screen.getByText(/Set 1: 100kg × 10/)).toBeTruthy();
    expect(screen.getByText(/Set 2: 110kg × 8/)).toBeTruthy();
  });

  it('shows the computed top set', async () => {
    render(<WorkoutDetailScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('top-set-we1')).toHaveTextContent('Top set: 110kg×8');
  });

  it("displays weights converted to the user's preferred unit", async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      role: 'user',
      displayName: null,
      username: null,
      weightUnit: 'lb',
    });

    render(<WorkoutDetailScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('top-set-we1')).toHaveTextContent(/lb/);
  });

  it('shows an error message when loading fails', async () => {
    mockFetchWorkoutDetail.mockRejectedValue(new Error('network error'));

    render(<WorkoutDetailScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('workout-detail-error')).toHaveTextContent('network error');
  });

  it('goes back when Back is pressed', async () => {
    render(<WorkoutDetailScreen navigation={navigation} route={route} />);
    await screen.findByText('Push Day');

    fireEvent.press(screen.getByTestId('workout-detail-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });
});
