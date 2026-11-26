import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { ProfileProvider } from '../profile/ProfileProvider';
import { fetchExerciseSetHistory } from '../workouts/exerciseHistoryQueries';
import { fetchOneRepMax, fetchRepPRs } from '../workouts/prQueries';
import { ProgressExerciseDetailScreen } from './ProgressExerciseDetailScreen';
import { fetchMyProfile } from '../profile/profileQueries';
import { updateSet } from '../workouts/workoutQueries';
import { fetchExerciseDetails } from '../exercises/exerciseQueries';
import { forgetBuiltinExtras, setBuiltinSources } from '../exercises/builtinExtras';

jest.mock('../exercises/exerciseQueries', () => ({
  fetchExerciseDetails: jest.fn(async () => null),
}));

jest.mock('../profile/profileQueries', () => ({
  fetchMyProfile: jest.fn(),
}));

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../workouts/exerciseHistoryQueries', () => ({
  fetchExerciseSetHistory: jest.fn(),
}));

jest.mock('../workouts/workoutQueries', () => ({
  updateSet: jest.fn(),
}));

const mockRefetchAllTimeStats = jest.fn();
jest.mock('../progress/AllTimeStatsProvider', () => ({
  useAllTimeStats: () => ({ refetch: mockRefetchAllTimeStats }),
}));

jest.mock('../workouts/prQueries', () => ({
  fetchRepPRs: jest.fn(),
  fetchOneRepMax: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockFetchMyProfile = fetchMyProfile as jest.Mock;
const mockFetchExerciseSetHistory = fetchExerciseSetHistory as jest.Mock;
const mockFetchRepPRs = fetchRepPRs as jest.Mock;
const mockFetchOneRepMax = fetchOneRepMax as jest.Mock;

const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  goBack: mockGoBack,
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};
const route = { params: { exerciseId: 'ex-1', exerciseName: 'Bench Press' } } as never;

/** Its History tab: each workout's top set. */
async function openHistory() {
  fireEvent.press(await screen.findByTestId('progress-exercise-detail-tabs-history'));
}

const twoSessionHistory = [
  {
    setId: 'set-1',
    weightKg: 100,
    reps: 8,
    performedAt: '2026-01-01T12:00:00Z',
    workoutExerciseId: 'we1',
  },
  {
    setId: 'set-2',
    weightKg: 110,
    reps: 8,
    performedAt: '2026-02-01T12:00:00Z',
    workoutExerciseId: 'we2',
  },
];

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-03-01T00:00:00Z'));
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
  mockFetchExerciseSetHistory.mockReset().mockResolvedValue([]);
  mockFetchRepPRs.mockReset().mockResolvedValue([]);
  mockFetchOneRepMax.mockReset().mockResolvedValue(null);
  mockGoBack.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ProgressExerciseDetailScreen', () => {
  it('shows the exercise name and an empty state with no history', async () => {
    render(<ProgressExerciseDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByText('Bench Press')).toBeTruthy();
    expect(await screen.findByTestId('progress-exercise-detail-empty')).toHaveTextContent(
      'Complete a workout to start tracking this exercise.',
    );
  });

  it('shows the current top set and lifetime improvement', async () => {
    mockFetchExerciseSetHistory.mockResolvedValue(twoSessionHistory);

    render(<ProgressExerciseDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('progress-exercise-detail-current')).toHaveTextContent(
      '110kg × 8',
    );
    expect(screen.getByTestId('progress-exercise-detail-delta')).toHaveTextContent(
      '+10kg since first recorded',
    );
  });

  it("lists each workout's top set, newest first", async () => {
    mockFetchExerciseSetHistory.mockResolvedValue([
      ...twoSessionHistory,
      // A lighter set in the same workout as the 110kg one isn't its top set.
      { weightKg: 90, reps: 10, performedAt: '2026-02-01T12:00:00Z', workoutExerciseId: 'we2' },
    ]);

    render(<ProgressExerciseDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    await openHistory();
    expect(await screen.findByText('Top Sets')).toBeTruthy();
    // With how many sets each workout had.
    expect(screen.getByTestId('progress-exercise-detail-top-set-0')).toHaveTextContent(/2 sets/);
    expect(screen.getByTestId('progress-exercise-detail-top-set-0')).toHaveTextContent(/110kg × 8/);
    expect(screen.getByTestId('progress-exercise-detail-top-set-1')).toHaveTextContent(/100kg × 8/);
    expect(screen.queryByTestId('progress-exercise-detail-top-set-2')).toBeNull();
  });

  it("lists only the latest ten workouts' top sets", async () => {
    mockFetchExerciseSetHistory.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => ({
        weightKg: 60 + i,
        reps: 5,
        performedAt: new Date(Date.UTC(2026, 0, 1 + i, 12)).toISOString(),
        workoutExerciseId: `we-${i}`,
      })),
    );

    render(<ProgressExerciseDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    await openHistory();
    expect(await screen.findByTestId('progress-exercise-detail-top-set-0')).toHaveTextContent(
      /71kg × 5/,
    );
    expect(screen.getByTestId('progress-exercise-detail-top-set-9')).toHaveTextContent(/62kg × 5/);
    expect(screen.queryByTestId('progress-exercise-detail-top-set-10')).toBeNull();
    // Every one, a tap away.
    fireEvent.press(screen.getByTestId('progress-exercise-detail-top-sets-all'));
    expect(screen.getByTestId('progress-exercise-detail-top-set-11')).toHaveTextContent(/60kg × 5/);
  });

  it('draws no line graph and no time range', async () => {
    mockFetchExerciseSetHistory.mockResolvedValue(twoSessionHistory);

    render(<ProgressExerciseDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('progress-exercise-detail-current');

    expect(screen.queryByTestId('progress-exercise-detail-chart')).toBeNull();
    expect(screen.queryByTestId('progress-exercise-detail-chart-card')).toBeNull();
    expect(screen.queryByText('4W')).toBeNull();
  });

  it('shows the true 1RM and rep PR count when present', async () => {
    mockFetchExerciseSetHistory.mockResolvedValue(twoSessionHistory);
    mockFetchOneRepMax.mockResolvedValue({
      weightKg: 140,
      sourceSetId: 'set-1',
      achievedAt: '2026-02-01T12:00:00Z',
    });
    mockFetchRepPRs.mockResolvedValue([
      { reps: 8, bestWeightKg: 110, sourceSetId: 'set-2', achievedAt: '2026-02-01T12:00:00Z' },
    ]);

    render(<ProgressExerciseDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('progress-exercise-detail-metric-1rm')).toHaveTextContent(
      /140/,
    );
    expect(screen.getByTestId('progress-exercise-detail-metric-prs')).toHaveTextContent(/1/);
    // From the sets themselves: the heaviest, and the most weight x reps in one set.
    expect(screen.getByTestId('progress-exercise-detail-record-heaviest')).toHaveTextContent(
      /110kg/,
    );
    expect(screen.getByTestId('progress-exercise-detail-record-best-set')).toHaveTextContent(
      /880kg/,
    );
  });

  it('goes back when the back button is pressed', async () => {
    render(<ProgressExerciseDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('progress-exercise-detail-back');

    fireEvent.press(screen.getByTestId('progress-exercise-detail-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows a load error without crashing', async () => {
    mockFetchExerciseSetHistory.mockRejectedValue(new Error('network down'));

    render(<ProgressExerciseDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('progress-exercise-detail-error')).toHaveTextContent(
      'network down',
    );
  });
});

// Regression coverage for a reported bug: returning to this screen briefly
// blanked it with a full-screen spinner before the refreshed data arrived.
// `load()` only sets `loading` true on the very first call now (see
// `hasLoadedOnce`) -- every later focus-triggered call is a silent
// background refresh.
describe('ProgressExerciseDetailScreen background refresh on focus', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }

  it('does not show the full-screen loading indicator on a focus-triggered refresh', async () => {
    render(<ProgressExerciseDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('progress-exercise-detail-empty');

    const refresh = deferred<unknown[]>();
    mockFetchExerciseSetHistory.mockReturnValue(refresh.promise);

    const calls = navigation.addListener.mock.calls;
    const [, focusCallback] = calls[calls.length - 1];
    act(() => {
      focusCallback();
    });

    expect(screen.queryByTestId('progress-exercise-detail-loading')).toBeNull();
    expect(screen.getByTestId('progress-exercise-detail-empty')).toBeTruthy();

    await act(async () => {
      refresh.resolve([]);
      await refresh.promise;
    });
  });
});

describe('ProgressExerciseDetailScreen -- which machine', () => {
  it('shows its photo, muscle, gym, handle, loading and pulley at the top', async () => {
    jest.mocked(fetchExerciseDetails).mockResolvedValueOnce({
      muscleGroup: 'back',
      movementType: 'bilateral',
      photoUrl: 'https://example.com/row.jpg',
      gym: 'Fit4Less Downtown',
      attachment: 'V-handle',
      loadType: 'double_stack',
      pulley: 'lighter',
      equipment: null,
      grip: null,
      pulleyPosition: null,
    });
    mockFetchExerciseSetHistory.mockResolvedValue(twoSessionHistory);
    render(<ProgressExerciseDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('progress-exercise-detail-details-muscles')).toHaveTextContent(
      /Back/,
    );
    expect(screen.getByTestId('progress-exercise-detail-details-fact-gym')).toHaveTextContent(
      /Fit4Less Downtown/,
    );
    expect(
      screen.getByTestId('progress-exercise-detail-details-fact-attachment'),
    ).toHaveTextContent(/V-handle/);
    expect(screen.getByTestId('progress-exercise-detail-details-fact-load')).toHaveTextContent(
      /Double stack/,
    );
    expect(screen.getByTestId('progress-exercise-detail-details-fact-oldPulley')).toHaveTextContent(
      /Lighter pulley/,
    );
    expect(fetchExerciseDetails).toHaveBeenCalledWith('user-1', 'ex-1');
    // The photo is the picture at the top, and opens full size.
    fireEvent.press(screen.getByTestId('progress-exercise-detail-details-photo'));
    expect(screen.getByTestId('progress-exercise-detail-details-lightbox')).toBeTruthy();
    // One of their own has no guide: no (i).
    expect(screen.queryByTestId('progress-exercise-detail-info')).toBeNull();
  });

  it('names the machine when a top set is opened to fix', async () => {
    jest.mocked(fetchExerciseDetails).mockResolvedValueOnce({
      muscleGroup: 'back',
      movementType: 'bilateral',
      photoUrl: null,
      gym: 'Fit4Less Downtown',
      attachment: null,
      loadType: null,
      pulley: null,
      equipment: null,
      grip: null,
      pulleyPosition: null,
    });
    mockFetchExerciseSetHistory.mockResolvedValue(twoSessionHistory);
    render(<ProgressExerciseDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    await screen.findByTestId('progress-exercise-detail-details');
    await openHistory();
    fireEvent.press(screen.getByTestId('progress-exercise-detail-top-set-0'));
    expect(screen.getByTestId('edit-top-set-summary')).toHaveTextContent(
      /^Bench Press · Fit4Less Downtown, /,
    );
  });

  it('shows the page whole when its details cannot be read', async () => {
    jest.mocked(fetchExerciseDetails).mockRejectedValueOnce(new Error('offline'));
    mockFetchExerciseSetHistory.mockResolvedValue(twoSessionHistory);
    render(<ProgressExerciseDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('progress-exercise-detail-current')).toBeTruthy();
    expect(screen.queryByTestId('progress-exercise-detail-details')).toBeNull();
    expect(screen.queryByTestId('progress-exercise-detail-error')).toBeNull();
  });
});

describe('ProgressExerciseDetailScreen -- editing a top set', () => {
  it("opens a workout's top set, saves the fix to that set, and reads everything again", async () => {
    mockFetchExerciseSetHistory.mockResolvedValue(twoSessionHistory);
    jest.mocked(updateSet).mockResolvedValue({} as never);
    render(<ProgressExerciseDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    // Newest first: February's 110 kg x 8.
    await openHistory();
    fireEvent.press(await screen.findByTestId('progress-exercise-detail-top-set-0'));
    expect(screen.getByTestId('edit-top-set-weight').props.value).toBe('110');
    expect(screen.getByTestId('edit-top-set-reps').props.value).toBe('8');

    fireEvent.changeText(screen.getByTestId('edit-top-set-weight'), '100');
    fireEvent.changeText(screen.getByTestId('edit-top-set-reps'), '6');
    mockFetchExerciseSetHistory.mockClear();
    await act(async () => {
      fireEvent.press(screen.getByTestId('edit-top-set-save'));
    });

    expect(updateSet).toHaveBeenCalledWith('set-2', { weightKg: 100, reps: 6 });
    expect(mockFetchExerciseSetHistory).toHaveBeenCalledWith('user-1', 'ex-1');
    expect(mockRefetchAllTimeStats).toHaveBeenCalled();
  });

  it('keeps the sheet open with a message when the figures are not a set', async () => {
    mockFetchExerciseSetHistory.mockResolvedValue(twoSessionHistory);
    jest.mocked(updateSet).mockClear();
    render(<ProgressExerciseDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    await openHistory();
    fireEvent.press(await screen.findByTestId('progress-exercise-detail-top-set-0'));
    fireEvent.changeText(screen.getByTestId('edit-top-set-reps'), '');
    await act(async () => {
      fireEvent.press(screen.getByTestId('edit-top-set-save'));
    });

    expect(screen.getByTestId('edit-top-set-error')).toHaveTextContent(/rep count/);
    expect(updateSet).not.toHaveBeenCalled();
  });
});

describe('ProgressExerciseDetailScreen -- its tabs', () => {
  it('opens on Summary, with History beside it -- and no How To for an exercise with no guide', async () => {
    mockFetchExerciseSetHistory.mockResolvedValue(twoSessionHistory);
    render(<ProgressExerciseDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    expect(await screen.findByTestId('progress-exercise-detail-tabs-summary')).toBeTruthy();
    expect(screen.getByTestId('progress-exercise-detail-tabs-history')).toBeTruthy();
    expect(screen.queryByTestId('progress-exercise-detail-tabs-howto')).toBeNull();
    expect(screen.queryByTestId('progress-exercise-detail-info')).toBeNull();
    // Summary has the records; History has the top sets.
    expect(screen.getByTestId('progress-exercise-detail-records')).toBeTruthy();
    expect(screen.queryByTestId('progress-exercise-detail-top-set-0')).toBeNull();
    await openHistory();
    expect(screen.getByTestId('progress-exercise-detail-top-set-0')).toBeTruthy();
    expect(screen.queryByTestId('progress-exercise-detail-records')).toBeNull();
  });

  it("gives a built-in a How To tab -- its guide inline -- that the header's (i) opens too", async () => {
    forgetBuiltinExtras();
    setBuiltinSources({
      extras: async () =>
        new Map([
          [
            'ex-1',
            {
              slug: 'bb-bench-press',
              secondaryMuscleGroups: ['shoulders', 'triceps'],
              searchAliases: [],
              movementPattern: 'horizontal_push',
              illustrationUrl: null,
            },
          ],
        ]),
      guide: async () => ({
        name: 'Bench Press',
        muscleGroup: 'chest',
        equipment: 'barbell',
        movementType: 'bilateral',
        measurementType: 'weight_reps',
        slug: 'bb-bench-press',
        secondaryMuscleGroups: ['shoulders', 'triceps'],
        movementPattern: 'horizontal_push',
        summary: 'A flat-bench press.',
        setupSteps: ['Lie back under the bar.'],
        executionSteps: ['Lower it to your chest.', 'Press it up.'],
        commonMistakes: ['Bouncing it.'],
        illustrationUrl: null,
      }),
    });
    try {
      render(<ProgressExerciseDetailScreen navigation={navigation} route={route} />, {
        wrapper: ProfileProvider,
      });
      expect(await screen.findByTestId('progress-exercise-detail-tabs-howto')).toBeTruthy();
      fireEvent.press(screen.getByTestId('progress-exercise-detail-info'));
      expect(await screen.findByTestId('progress-exercise-detail-howto')).toBeTruthy();
      expect(await screen.findByTestId('progress-exercise-detail-guide-pages')).toBeTruthy();
      // Back to Summary.
      fireEvent.press(screen.getByTestId('progress-exercise-detail-tabs-summary'));
      expect(screen.queryByTestId('progress-exercise-detail-howto')).toBeNull();
    } finally {
      forgetBuiltinExtras();
      setBuiltinSources(null);
    }
  });
});
