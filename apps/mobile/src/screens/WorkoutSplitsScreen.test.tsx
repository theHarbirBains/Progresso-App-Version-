import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile, updateMyProfile } from '../lib/api';
import { AppMenuContext } from '../navigation/AppMenuContext';
import {
  deleteWorkoutSplit,
  duplicateWorkoutSplit,
  fetchWorkoutSplits,
} from '../workouts/workoutSplitQueries';
import { WorkoutSplitsScreen } from './WorkoutSplitsScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
  updateMyProfile: jest.fn(),
}));

jest.mock('../workouts/workoutSplitQueries', () => ({
  fetchWorkoutSplits: jest.fn(),
  duplicateWorkoutSplit: jest.fn(),
  deleteWorkoutSplit: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockUpdateMyProfile = updateMyProfile as jest.Mock;
const mockFetchWorkoutSplits = fetchWorkoutSplits as jest.Mock;
const mockDuplicateWorkoutSplit = duplicateWorkoutSplit as jest.Mock;
const mockDeleteWorkoutSplit = deleteWorkoutSplit as jest.Mock;

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
const route = {} as never;

const mockOpenMenu = jest.fn();

// WorkoutSplitsScreen now opens the app-level side menu (via
// AppMenuContext) from its own header, same as Dashboard -- this stands in
// for that root-level provider.
function renderScreen() {
  return render(
    <AppMenuContext.Provider value={{ openMenu: mockOpenMenu, currentMode: 'workout' }}>
      <WorkoutSplitsScreen navigation={navigation} route={route} />
    </AppMenuContext.Provider>,
  );
}

const baseProfile = {
  id: 'user-1',
  email: 'a@example.com',
  role: 'user',
  displayName: null,
  username: null,
  weightUnit: 'kg' as const,
  workoutAccentColor: null,
  nutritionAccentColor: null,
  activeWorkoutSplitId: 'split-1',
};

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockGetMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockUpdateMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockFetchWorkoutSplits.mockReset().mockResolvedValue([
    { id: 'split-1', name: 'PPL - Hypertrophy' },
    { id: 'split-2', name: 'Upper/Lower' },
  ]);
  mockDuplicateWorkoutSplit.mockReset().mockResolvedValue({ id: 'split-3', name: 'Copy' });
  mockDeleteWorkoutSplit.mockReset().mockResolvedValue(undefined);
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockOpenMenu.mockClear();
});

describe('WorkoutSplitsScreen', () => {
  it('shows the empty state with no splits', async () => {
    mockFetchWorkoutSplits.mockResolvedValue([]);

    renderScreen();

    expect(await screen.findByTestId('workout-splits-empty')).toHaveTextContent(
      'Create a split to plan your training days.',
    );
  });

  it('lists every split and marks the active one', async () => {
    renderScreen();

    expect(await screen.findByTestId('workout-split-split-1')).toHaveTextContent(/ACTIVE/);
    expect(screen.getByTestId('workout-split-split-2')).not.toHaveTextContent(/ACTIVE/);
  });

  it('navigates to the edit form when Edit is pressed', async () => {
    renderScreen();
    fireEvent.press(await screen.findByTestId('workout-split-edit-split-2'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutSplitForm', { splitId: 'split-2' });
  });

  it('navigates to the read-only view when the split card is tapped', async () => {
    renderScreen();
    fireEvent.press(await screen.findByTestId('workout-split-view-split-2'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutSplitView', { splitId: 'split-2' });
  });

  it('navigates to the create form when Create Workout Split is pressed', async () => {
    renderScreen();
    fireEvent.press(await screen.findByTestId('workout-splits-create'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutSplitForm', {});
  });

  it('asks for confirmation before switching the active split, and applies it on confirm', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
      buttons?.find((b) => b.text === 'Make Active')?.onPress?.();
    });

    renderScreen();
    fireEvent.press(await screen.findByTestId('workout-split-activate-split-2'));

    expect(alertSpy).toHaveBeenCalled();
    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
      activeWorkoutSplitId: 'split-2',
    });
    expect(await screen.findByTestId('workout-split-split-2')).toHaveTextContent(/ACTIVE/);
    alertSpy.mockRestore();
  });

  it('shows an explicit "Set Active" control only for inactive splits, never the already-active one', async () => {
    renderScreen();
    await screen.findByTestId('workout-split-split-1');

    expect(screen.queryByTestId('workout-split-activate-split-1')).toBeNull();
    expect(screen.getByTestId('workout-split-activate-split-2')).toBeTruthy();
  });

  it('duplicates a split and reloads the list', async () => {
    renderScreen();
    fireEvent.press(await screen.findByTestId('workout-split-duplicate-split-2'));

    expect(mockDuplicateWorkoutSplit).toHaveBeenCalledWith('user-1', 'split-2');
    await waitFor(() => expect(mockFetchWorkoutSplits).toHaveBeenCalledTimes(2));
  });

  it('asks for confirmation before deleting, and deletes on confirm', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
      buttons?.find((b) => b.text === 'Delete')?.onPress?.();
    });

    renderScreen();
    fireEvent.press(await screen.findByTestId('workout-split-delete-split-2'));

    expect(mockDeleteWorkoutSplit).toHaveBeenCalledWith('split-2');
    await waitFor(() => expect(mockFetchWorkoutSplits).toHaveBeenCalledTimes(2));
    alertSpy.mockRestore();
  });

  it('opens the app-level side menu (workout mode) when the header button is pressed', async () => {
    renderScreen();
    fireEvent.press(await screen.findByTestId('workout-splits-open-menu'));

    expect(mockOpenMenu).toHaveBeenCalledWith('workout');
  });

  it('renders the hamburger and the "Workout Splits" title on the shared AppHeader row', async () => {
    renderScreen();

    expect(await screen.findByTestId('workout-splits-header')).toBeTruthy();
    expect(screen.getByTestId('workout-splits-open-menu')).toBeTruthy();
    expect(screen.getByText('Workout Splits')).toBeTruthy();
  });

  it('shows a load error without crashing', async () => {
    mockFetchWorkoutSplits.mockRejectedValue(new Error('network down'));

    renderScreen();

    expect(await screen.findByTestId('workout-splits-error')).toHaveTextContent('network down');
  });
});

// Regression coverage for a reported bug: returning to this screen briefly
// blanked it with a full-screen spinner before the refreshed data arrived.
// `load()` only sets `loading` true on the very first call now (see
// `hasLoadedOnce`) -- every later focus-triggered call is a silent
// background refresh.
describe('WorkoutSplitsScreen background refresh on focus', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }

  it('does not show the full-screen loading indicator on a focus-triggered refresh', async () => {
    renderScreen();
    await screen.findByTestId('workout-split-split-1');

    const refresh = deferred<unknown[]>();
    mockFetchWorkoutSplits.mockReturnValue(refresh.promise);

    const calls = navigation.addListener.mock.calls;
    const [, focusCallback] = calls[calls.length - 1];
    act(() => {
      focusCallback();
    });

    expect(screen.queryByTestId('workout-splits-loading')).toBeNull();
    expect(screen.getByTestId('workout-split-split-1')).toBeTruthy();

    await act(async () => {
      refresh.resolve([]);
      await refresh.promise;
    });
  });
});
