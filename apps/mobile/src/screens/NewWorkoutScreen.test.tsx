import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { BackgroundThemeProvider } from '../design/BackgroundThemeContext';
import { getMyProfile } from '../lib/api';
import { createWorkout } from '../workouts/workoutQueries';
import { fetchLastWorkoutSplitDayId, fetchWorkoutSplitDetail } from '../workouts/workoutSplitQueries';
import { NewWorkoutScreen } from './NewWorkoutScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
  updateMyProfile: jest.fn(),
}));

jest.mock('../workouts/workoutQueries', () => ({
  createWorkout: jest.fn(),
}));

jest.mock('../workouts/workoutSplitQueries', () => ({
  fetchWorkoutSplitDetail: jest.fn(),
  fetchLastWorkoutSplitDayId: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockCreateWorkout = createWorkout as jest.Mock;
const mockFetchWorkoutSplitDetail = fetchWorkoutSplitDetail as jest.Mock;
const mockFetchLastWorkoutSplitDayId = fetchLastWorkoutSplitDayId as jest.Mock;

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  navigate: mockNavigate,
  goBack: jest.fn(),
  replace: mockReplace,
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};
const route = {} as never;

// Deliberately not named Push/Pull/Legs/Upper/Lower -- proves nothing on
// screen is hardcoded, only ever rendered from the split data given here.
const splitDetail = {
  id: 'split-1',
  name: 'My Split',
  days: [
    { id: 'day-2', name: 'Recovery', orderIndex: 2, muscleGroups: ['abs' as const] },
    { id: 'day-1', name: 'Full Body', orderIndex: 1, muscleGroups: ['chest' as const, 'back' as const] },
    { id: 'day-3', name: 'Conditioning', orderIndex: 3, muscleGroups: [] },
  ],
};

function baseProfile(activeWorkoutSplitId: string | null) {
  return {
    id: 'user-1',
    email: 'a@example.com',
    role: 'user',
    displayName: null,
    username: null,
    weightUnit: 'kg',
    workoutAccentColor: null,
    nutritionAccentColor: null,
    activeWorkoutSplitId,
  };
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockGetMyProfile.mockReset().mockResolvedValue(baseProfile('split-1'));
  mockFetchWorkoutSplitDetail.mockReset().mockResolvedValue(splitDetail);
  mockFetchLastWorkoutSplitDayId.mockReset().mockResolvedValue(null);
  mockCreateWorkout.mockReset().mockResolvedValue({
    type: 'created',
    workout: { id: 'w1', name: 'Full Body', performedAt: '2026-01-01T00:00:00Z', completedAt: null },
  });
  mockNavigate.mockClear();
  mockReplace.mockClear();
});

describe('NewWorkoutScreen -- day selection only, no exercise UI', () => {
  it('shows the real next workout day (order 1, since nothing has been completed yet), not a hardcoded name', async () => {
    render(
      <BackgroundThemeProvider>
        <NewWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );

    const hero = await screen.findByTestId('start-workout-next');
    expect(hero).toBeTruthy();
    expect(await screen.findByText('Full Body')).toBeTruthy();
    expect(await screen.findByText(/Chest.*Back/)).toBeTruthy();
  });

  it('lists every other split day under All Workout Days, excluding the day already shown as next', async () => {
    render(
      <BackgroundThemeProvider>
        <NewWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('start-workout-next');

    expect(screen.queryByTestId('start-workout-day-day-1')).toBeNull();
    expect(await screen.findByTestId('start-workout-day-day-2')).toBeTruthy();
    expect(await screen.findByTestId('start-workout-day-day-3')).toBeTruthy();
    expect(screen.getByText('Recovery')).toBeTruthy();
    expect(screen.getByText('Conditioning')).toBeTruthy();
  });

  it('starting the next workout creates it tagged with that day and enters ActiveWorkout', async () => {
    render(
      <BackgroundThemeProvider>
        <NewWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );

    fireEvent.press(await screen.findByTestId('start-workout-next'));

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('ActiveWorkout', { workoutId: 'w1' }),
    );
    expect(mockCreateWorkout).toHaveBeenCalledWith('user-1', 'Full Body', 'day-1');
  });

  it('starting a different (non-recommended) split day tags the workout with THAT day, not the recommended one', async () => {
    render(
      <BackgroundThemeProvider>
        <NewWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );

    fireEvent.press(await screen.findByTestId('start-workout-day-day-2'));

    await waitFor(() => expect(mockCreateWorkout).toHaveBeenCalled());
    expect(mockCreateWorkout).toHaveBeenCalledWith('user-1', 'Recovery', 'day-2');
  });

  it('Do a Different Workout opens a naming sheet; confirming starts an untagged workout with the given name', async () => {
    render(
      <BackgroundThemeProvider>
        <NewWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );

    fireEvent.press(await screen.findByTestId('start-workout-custom'));
    fireEvent.changeText(await screen.findByTestId('start-workout-custom-name'), 'Arms + Abs');
    fireEvent.press(screen.getByTestId('start-workout-custom-confirm'));

    await waitFor(() => expect(mockCreateWorkout).toHaveBeenCalled());
    expect(mockCreateWorkout).toHaveBeenCalledWith('user-1', 'Arms + Abs', undefined);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('ActiveWorkout', { workoutId: 'w1' }),
    );
  });

  it('disables the custom-workout confirm button until a name is entered', async () => {
    render(
      <BackgroundThemeProvider>
        <NewWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    fireEvent.press(await screen.findByTestId('start-workout-custom'));

    const confirmButton = await screen.findByTestId('start-workout-custom-confirm');
    expect(confirmButton.props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('start-workout-custom-name'), 'Arms + Abs');
    expect(screen.getByTestId('start-workout-custom-confirm').props.accessibilityState.disabled).toBe(
      false,
    );
  });

  it('shows a resume option instead of creating a duplicate workout on conflict', async () => {
    mockCreateWorkout.mockResolvedValue({
      type: 'conflict',
      existingWorkout: {
        id: 'active-1',
        name: 'Leg Day',
        performedAt: '2026-01-01T00:00:00Z',
        completedAt: null,
      },
    });
    render(
      <BackgroundThemeProvider>
        <NewWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );

    fireEvent.press(await screen.findByTestId('start-workout-next'));
    fireEvent.press(await screen.findByTestId('resume-instead'));

    expect(mockReplace).toHaveBeenCalledWith('ActiveWorkout', { workoutId: 'active-1' });
  });

  it('never renders exercise selection, Add Exercise, or Create Custom Exercise on this screen', async () => {
    render(
      <BackgroundThemeProvider>
        <NewWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('start-workout-next');

    expect(screen.queryByTestId('new-workout-add-exercise')).toBeNull();
    expect(screen.queryByTestId('new-workout-create-custom')).toBeNull();
    expect(screen.queryByText(/Add Exercise/i)).toBeNull();
    expect(screen.queryByText(/Create Custom Exercise/i)).toBeNull();
  });

  it('has no back arrow in the header', async () => {
    render(
      <BackgroundThemeProvider>
        <NewWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('start-workout-next');

    expect(screen.queryByTestId('app-header-back')).toBeNull();
    expect(screen.queryByTestId('workout-header-back')).toBeNull();
  });

  it('recommends the day after whichever split day was actually last completed', async () => {
    mockFetchLastWorkoutSplitDayId.mockResolvedValue('day-1');
    render(
      <BackgroundThemeProvider>
        <NewWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );

    expect(await screen.findByText('Recovery')).toBeTruthy();
    const hero = screen.getByTestId('start-workout-next');
    expect(hero).toBeTruthy();
    expect(screen.queryByTestId('start-workout-day-day-1')).toBeTruthy();
    expect(screen.queryByTestId('start-workout-day-day-2')).toBeNull();
  });
});

describe('NewWorkoutScreen without an active split', () => {
  it('blocks with "Choose Your Workout Split" and shows no day rows or exercise UI', async () => {
    mockGetMyProfile.mockResolvedValue(baseProfile(null));

    render(
      <BackgroundThemeProvider>
        <NewWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );

    expect(await screen.findByTestId('new-workout-no-split')).toBeTruthy();
    expect(screen.queryByTestId('start-workout-next')).toBeNull();
    expect(screen.queryByTestId('start-workout-custom')).toBeNull();
  });

  it('navigates to ChooseWorkoutSplit when the button is pressed', async () => {
    mockGetMyProfile.mockResolvedValue(baseProfile(null));

    render(
      <BackgroundThemeProvider>
        <NewWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    fireEvent.press(await screen.findByTestId('new-workout-choose-split'));

    expect(mockNavigate).toHaveBeenCalledWith('ChooseWorkoutSplit');
  });
});

// Regression coverage for a reported bug: returning to this screen briefly
// blanked it with a full-screen spinner before the refreshed data arrived.
// `load()` only sets `loading` true on the very first call now (see
// `hasLoadedOnce`) -- every later focus-triggered call is a silent
// background refresh.
describe('NewWorkoutScreen background refresh on focus', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }

  it('does not show the full-screen loading indicator on a focus-triggered refresh', async () => {
    render(
      <BackgroundThemeProvider>
        <NewWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('start-workout-next');

    const refresh = deferred<ReturnType<typeof baseProfile>>();
    mockGetMyProfile.mockReturnValue(refresh.promise);

    const calls = navigation.addListener.mock.calls;
    const [, focusCallback] = calls[calls.length - 1];
    act(() => {
      focusCallback();
    });

    expect(screen.queryByTestId('new-workout-loading')).toBeNull();
    expect(screen.getByTestId('start-workout-next')).toBeTruthy();

    await act(async () => {
      refresh.resolve(baseProfile('split-1'));
      await refresh.promise;
    });
  });
});
