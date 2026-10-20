import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { ProfileProvider } from '../profile/ProfileProvider';
import {
  fetchLastWorkoutSplitDayId,
  fetchWorkoutSplitDetail,
} from '../workouts/workoutSplitQueries';
import { fetchPlansForDays } from '../workouts/splitPlanQueries';
import { WorkoutSplitViewScreen } from './WorkoutSplitViewScreen';
import { fetchMyProfile } from '../profile/profileQueries';

jest.mock('../profile/profileQueries', () => ({
  fetchMyProfile: jest.fn(),
}));

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../workouts/workoutSplitQueries', () => ({
  fetchWorkoutSplitDetail: jest.fn(),
  fetchLastWorkoutSplitDayId: jest.fn(),
}));

jest.mock('../workouts/splitPlanQueries', () => ({
  fetchPlansForDays: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockFetchMyProfile = fetchMyProfile as jest.Mock;
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
  mockFetchMyProfile.mockReset().mockResolvedValue({
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
  (fetchPlansForDays as jest.Mock).mockReset().mockResolvedValue(new Map());
  (fetchLastWorkoutSplitDayId as jest.Mock).mockReset().mockResolvedValue(null);
  mockNavigate.mockClear();
  mockGoBack.mockClear();
});

describe('WorkoutSplitViewScreen', () => {
  it('shows the split name and every day with its real muscle groups, read-only', async () => {
    render(<WorkoutSplitViewScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

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
    render(<WorkoutSplitViewScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('workout-split-view-day-day-2-no-groups')).toHaveTextContent(
      'No muscle groups set',
    );
  });

  it('renders no editable inputs -- this is a read-only view', async () => {
    render(<WorkoutSplitViewScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByText('PPL - Hypertrophy');

    expect(screen.queryByTestId('workout-split-day-name-day-1')).toBeNull();
  });

  it('shows an empty state for a split with no days', async () => {
    mockFetchWorkoutSplitDetail.mockResolvedValue({ ...detail, days: [] });

    render(<WorkoutSplitViewScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('workout-split-view-empty')).toHaveTextContent(
      'This split has no days yet.',
    );
  });

  it('navigates to the edit form when the edit button is pressed', async () => {
    render(<WorkoutSplitViewScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    fireEvent.press(await screen.findByTestId('workout-split-view-edit'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutSplitForm', { splitId: 'split-1' });
  });

  it('goes back when Back is pressed', async () => {
    render(<WorkoutSplitViewScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    fireEvent.press(await screen.findByTestId('workout-split-view-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows a load error without crashing', async () => {
    mockFetchWorkoutSplitDetail.mockRejectedValue(new Error('network down'));

    render(<WorkoutSplitViewScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('workout-split-view-error')).toHaveTextContent('network down');
  });

  it('re-loads on focus so an edit made elsewhere is reflected when returning', async () => {
    render(<WorkoutSplitViewScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
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
    render(<WorkoutSplitViewScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
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

describe('WorkoutSplitViewScreen -- a widget per day, plain muscle text, no chips', () => {
  it('shows each day as its own widget', async () => {
    render(<WorkoutSplitViewScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByText('PPL - Hypertrophy');

    const cards = screen.UNSAFE_queryAllByType(AppCard);
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(
      within(screen.getByTestId('workout-split-view-day-day-1')).getByText('Push'),
    ).toBeTruthy();
  });

  it("shows a day's muscle groups as one line of plain text separated by dots, not filled chips", async () => {
    render(<WorkoutSplitViewScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    const day = within(await screen.findByTestId('workout-split-view-day-day-1'));

    expect(day.getAllByText('·')).toHaveLength(2);
    for (const group of ['chest', 'shoulders', 'triceps']) {
      const style = StyleSheet.flatten(
        screen.getByTestId(`workout-split-view-day-day-1-muscle-${group}`).props.style,
      );
      expect(style.backgroundColor).toBeUndefined();
      expect(style.borderWidth).toBeUndefined();
    }
  });

  it('puts Back and Edit in the shared header, each named for assistive tech', async () => {
    render(<WorkoutSplitViewScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByText('PPL - Hypertrophy');

    expect(screen.getByTestId('workout-split-view-back').props.accessibilityLabel).toBe('Back');
    expect(screen.getByTestId('workout-split-view-edit').props.accessibilityLabel).toBe(
      'Edit split',
    );
  });
});

describe('WorkoutSplitViewScreen -- day plans and the next day', () => {
  it("shows each day's planned exercises and opens the plan", async () => {
    (fetchPlansForDays as jest.Mock).mockResolvedValue(
      new Map([
        [
          'day-1',
          [
            { id: 'p1', exerciseId: 'bench', exerciseName: 'Bench', targetSets: 4, position: 0 },
            { id: 'p2', exerciseId: 'ohp', exerciseName: 'OHP', targetSets: 3, position: 1 },
          ],
        ],
        ['day-2', []],
      ]),
    );
    render(<WorkoutSplitViewScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('workout-split-view-day-day-1-plan')).toHaveTextContent(
      /2 exercises · 7 sets/,
    );
    expect(screen.getByTestId('workout-split-view-day-day-2-plan')).toHaveTextContent(
      /No exercises planned/,
    );
    fireEvent.press(screen.getByTestId('workout-split-view-day-day-1-plan'));
    expect(mockNavigate).toHaveBeenCalledWith('SplitDayPlan', { dayId: 'day-1', dayName: 'Push' });
  });

  it('marks the next day on the active split: the one after the last done', async () => {
    mockFetchMyProfile.mockResolvedValue({
      id: 'user-1',
      weightUnit: 'kg',
      activeWorkoutSplitId: 'split-1',
    });
    (fetchLastWorkoutSplitDayId as jest.Mock).mockResolvedValue('day-1');
    render(<WorkoutSplitViewScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('workout-split-view-day-day-2-next')).toHaveTextContent(
      'Next',
    );
    expect(screen.queryByTestId('workout-split-view-day-day-1-next')).toBeNull();
  });

  it('marks no day on a split that is not active', async () => {
    render(<WorkoutSplitViewScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('workout-split-view-day-day-1-plan');

    expect(screen.queryByTestId(/-next$/)).toBeNull();
    expect(fetchLastWorkoutSplitDayId).not.toHaveBeenCalled();
  });
});
