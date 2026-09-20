import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import { fetchWorkoutSplitDetail } from '../workouts/workoutSplitQueries';
import { WorkoutSplitViewScreen } from './WorkoutSplitViewScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
}));

jest.mock('../workouts/workoutSplitQueries', () => ({
  fetchWorkoutSplitDetail: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockFetchWorkoutSplitDetail = fetchWorkoutSplitDetail as jest.Mock;

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
const route = { params: { splitId: 'split-1' } } as never;

const detail = {
  id: 'split-1',
  name: 'PPL - Hypertrophy',
  days: [
    { id: 'day-1', name: 'Push', orderIndex: 1, muscleGroups: ['chest', 'shoulders', 'triceps'] },
    { id: 'day-2', name: 'Rest Day', orderIndex: 2, muscleGroups: [] },
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
    workoutAccentColor: null,
    nutritionAccentColor: null,
  });
  mockFetchWorkoutSplitDetail.mockReset().mockResolvedValue(detail);
  mockNavigate.mockClear();
  mockGoBack.mockClear();
});

describe('WorkoutSplitViewScreen', () => {
  it('shows the split name and every day with its real muscle groups, read-only', async () => {
    render(<WorkoutSplitViewScreen navigation={navigation} route={route} />);

    expect(await screen.findByText('PPL - Hypertrophy')).toBeTruthy();
    expect(screen.getByTestId('workout-split-view-day-day-1')).toHaveTextContent(/Push/);
    expect(screen.getByTestId('workout-split-view-day-day-1-muscle-chest')).toHaveTextContent(
      'Chest',
    );
    expect(screen.getByTestId('workout-split-view-day-day-1-muscle-shoulders')).toHaveTextContent(
      'Shoulders',
    );
    expect(screen.getByTestId('workout-split-view-day-day-1-muscle-triceps')).toHaveTextContent(
      'Triceps',
    );
  });

  it('shows "No muscle groups set" for a day with none assigned', async () => {
    render(<WorkoutSplitViewScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('workout-split-view-day-day-2-no-groups')).toHaveTextContent(
      'No muscle groups set',
    );
  });

  it('renders no editable inputs -- this is a read-only view', async () => {
    render(<WorkoutSplitViewScreen navigation={navigation} route={route} />);
    await screen.findByText('PPL - Hypertrophy');

    expect(screen.queryByTestId('workout-split-day-name-day-1')).toBeNull();
  });

  it('shows an empty state for a split with no days', async () => {
    mockFetchWorkoutSplitDetail.mockResolvedValue({ ...detail, days: [] });

    render(<WorkoutSplitViewScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('workout-split-view-empty')).toHaveTextContent(
      'This split has no days yet.',
    );
  });

  it('navigates to the edit form when the edit button is pressed', async () => {
    render(<WorkoutSplitViewScreen navigation={navigation} route={route} />);
    fireEvent.press(await screen.findByTestId('workout-split-view-edit'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutSplitForm', { splitId: 'split-1' });
  });

  it('goes back when Back is pressed', async () => {
    render(<WorkoutSplitViewScreen navigation={navigation} route={route} />);
    fireEvent.press(await screen.findByTestId('workout-split-view-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows a load error without crashing', async () => {
    mockFetchWorkoutSplitDetail.mockRejectedValue(new Error('network down'));

    render(<WorkoutSplitViewScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('workout-split-view-error')).toHaveTextContent('network down');
  });

  it('re-loads on focus so an edit made elsewhere is reflected when returning', async () => {
    render(<WorkoutSplitViewScreen navigation={navigation} route={route} />);
    await screen.findByText('PPL - Hypertrophy');

    expect(mockFetchWorkoutSplitDetail).toHaveBeenCalledWith('split-1');
  });
});

// Regression coverage for a reported bug: returning to this screen briefly
// blanked it with a full-screen spinner before the refreshed data arrived.
// `load()` only sets `loading` true on the very first call now (see
// `hasLoadedOnce`) -- every later focus-triggered call is a silent
// background refresh.
describe('WorkoutSplitViewScreen background refresh on focus', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }

  it('does not show the full-screen loading indicator on a focus-triggered refresh', async () => {
    render(<WorkoutSplitViewScreen navigation={navigation} route={route} />);
    await screen.findByText('PPL - Hypertrophy');

    const refresh = deferred<typeof detail>();
    mockFetchWorkoutSplitDetail.mockReturnValue(refresh.promise);

    const calls = navigation.addListener.mock.calls;
    const [, focusCallback] = calls[calls.length - 1];
    act(() => {
      focusCallback();
    });

    expect(screen.queryByTestId('workout-split-view-loading')).toBeNull();
    expect(screen.getByText('PPL - Hypertrophy')).toBeTruthy();

    await act(async () => {
      refresh.resolve(detail);
      await refresh.promise;
    });
  });
});
