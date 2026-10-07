import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { listTrainerClients, regenerateTrainerClaimCode } from '../lib/api';
import { fetchClientPersonalRecords, fetchClientWorkoutFeed } from '../trainer/clientQueries';
import { TrainerClientDetailScreen } from './TrainerClientDetailScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  endTrainerClient: jest.fn(),
  listTrainerClients: jest.fn(),
  regenerateTrainerClaimCode: jest.fn(),
  startLiveWorkout: jest.fn(),
}));

jest.mock('../trainer/clientQueries', () => ({
  fetchClientWorkoutFeed: jest.fn(),
  fetchClientPersonalRecords: jest.fn(),
  fetchOpenLiveSession: jest.fn(async () => null),
}));

jest.mock('../progress/useProgressTheme', () => ({
  useProgressTheme: () => ({ weightUnit: 'kg', theme: { accent: '#3DDC97', onAccent: '#000000' } }),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockListTrainerClients = listTrainerClients as jest.Mock;
const mockRegenerate = regenerateTrainerClaimCode as jest.Mock;
const mockFetchWorkouts = fetchClientWorkoutFeed as jest.Mock;
const mockFetchRecords = fetchClientPersonalRecords as jest.Mock;

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: mockNavigate, goBack: mockGoBack };

const client = {
  clientId: 'client-1',
  status: 'active',
  source: 'managed',
  displayName: 'Sam',
  birthday: null,
  heightValue: 180,
  heightUnit: 'cm',
  weightValue: 80,
  weightUnit: 'kg',
};

function workout(id: string, name: string) {
  return {
    id,
    name,
    performedAt: '2026-10-01T09:00:00.000Z',
    completedAt: '2026-10-01T10:00:00.000Z',
    durationMinutes: 60,
    exerciseCount: 2,
    completedExerciseCount: 2,
    completedSetCount: 6,
    totalVolumeKg: 1500,
    muscleGroups: [],
    splitDayName: null,
    topSets: [
      {
        exerciseId: 'e1',
        exerciseName: 'Barbell Back Squat',
        photoUrl: null,
        weightKg: 100,
        reps: 5,
      },
    ],
  };
}

function renderDetail() {
  return render(
    <TrainerClientDetailScreen
      navigation={navigation}
      route={{ params: { clientId: 'client-1', clientName: 'Sam' } } as never}
    />,
  );
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ session: { access_token: 'token-123' } });
  mockListTrainerClients.mockReset().mockResolvedValue([client]);
  mockFetchWorkouts.mockReset().mockResolvedValue({
    workouts: [workout('w1', 'Leg Day')],
    hasMore: false,
  });
  mockFetchRecords
    .mockReset()
    .mockResolvedValue([
      { id: 'r1', exerciseName: 'Barbell Back Squat', reps: 5, bestWeightKg: 100 },
    ]);
  mockNavigate.mockClear();
  mockGoBack.mockClear();
});

describe('TrainerClientDetailScreen', () => {
  it("shows the client's profile, workouts and records", async () => {
    renderDetail();

    expect(await screen.findByTestId('trainer-client-profile')).toHaveTextContent(
      /Managed account/,
    );
    expect(screen.getByTestId('trainer-client-height-value')).toHaveTextContent(/180 cm/);
    expect(screen.getByTestId('trainer-client-weight-value')).toHaveTextContent(/80 kg/);
    expect(screen.getByTestId('trainer-client-record-r1')).toHaveTextContent(/Barbell Back Squat/);
    expect(mockFetchWorkouts).toHaveBeenCalledWith('client-1', 0);
  });

  it('shows each workout as a feed card, with its stats and top sets', async () => {
    renderDetail();

    const card = await screen.findByTestId('trainer-client-workout-w1');
    expect(card).toHaveTextContent(/Leg Day/);
    expect(screen.getByTestId('trainer-client-workout-w1-duration')).toHaveTextContent(/1h/);
    expect(screen.getByTestId('trainer-client-workout-w1-exercises')).toHaveTextContent(/2/);
    expect(screen.getByTestId('trainer-client-workout-w1-sets')).toHaveTextContent(/6/);
    expect(screen.getByTestId('trainer-client-workout-w1-top-sets')).toHaveTextContent(
      /Barbell Back Squat/,
    );
  });

  it('loads the next page of workouts on Load More', async () => {
    mockFetchWorkouts
      .mockResolvedValueOnce({ workouts: [workout('w1', 'Leg Day')], hasMore: true })
      .mockResolvedValueOnce({ workouts: [workout('w2', 'Push')], hasMore: false });
    renderDetail();

    fireEvent.press(await screen.findByTestId('trainer-client-workouts-more'));

    expect(await screen.findByTestId('trainer-client-workout-w2')).toHaveTextContent(/Push/);
    expect(mockFetchWorkouts).toHaveBeenLastCalledWith('client-1', 1);
    expect(screen.queryByTestId('trainer-client-workouts-more')).toBeNull();
  });

  it('opens the logger for this client, on the trainer route that saves through the trainer API', async () => {
    renderDetail();

    fireEvent.press(await screen.findByTestId('trainer-client-log-workout'));
    expect(mockNavigate).toHaveBeenCalledWith('TrainerLogWorkout', {
      clientId: 'client-1',
      clientName: 'Sam',
    });
  });

  it('offers editing only for a managed client', async () => {
    mockListTrainerClients.mockResolvedValue([{ ...client, source: 'linked' }]);
    renderDetail();

    await screen.findByTestId('trainer-client-profile');
    expect(screen.queryByTestId('trainer-client-edit')).toBeNull();
  });

  it('gives a tracked client a claim code to hand over', async () => {
    mockListTrainerClients.mockResolvedValue([{ ...client, awaitingClaim: true }]);
    mockRegenerate.mockResolvedValue({
      claimCode: 'WXYZ-6789',
      expiresAt: '2026-11-01T00:00:00.000Z',
    });
    renderDetail();

    fireEvent.press(await screen.findByTestId('trainer-client-claim-code'));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('TrainerClaimCode', {
        code: 'WXYZ-6789',
        clientId: 'client-1',
        clientName: 'Sam',
      }),
    );
    expect(mockRegenerate).toHaveBeenCalledWith('token-123', 'client-1');
  });

  it('starts a live session for an active client, and opens it', async () => {
    const { startLiveWorkout } = jest.requireMock('../lib/api') as { startLiveWorkout: jest.Mock };
    startLiveWorkout.mockResolvedValue({ workoutId: 'live-1' });
    renderDetail();

    fireEvent.press(await screen.findByTestId('trainer-client-start-live'));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('TrainerLiveWorkout', {
        workoutId: 'live-1',
        clientId: 'client-1',
        clientName: 'Sam',
      }),
    );
    expect(startLiveWorkout).toHaveBeenCalledWith('token-123', 'client-1', 'Live session');
  });

  it('says so when the client is no longer linked, and shows none of their data', async () => {
    mockListTrainerClients.mockResolvedValue([]);
    renderDetail();

    expect(await screen.findByTestId('trainer-client-detail-gone')).toBeTruthy();
    await waitFor(() => expect(mockFetchWorkouts).not.toHaveBeenCalled());
  });
});
