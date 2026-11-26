import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Alert, StyleSheet } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { updateMyProfile } from '../lib/api';
import { AppCard } from '../design/AppCard';
import { AppMenuContext } from '../navigation/AppMenuContext';
import { ProfileProvider } from '../profile/ProfileProvider';
import { DEFAULT_WORKOUT_THEME } from '../theme/accentColor';
import {
  deleteWorkoutSplit,
  duplicateWorkoutSplit,
  fetchWorkoutSplits,
} from '../workouts/workoutSplitQueries';
import { WorkoutSplitsScreen } from './WorkoutSplitsScreen';
import { fetchMyProfile } from '../profile/profileQueries';
import { TEST_PROGRAM } from '../programs/__fixtures__/programs';
import type { WorkoutProgram } from '../programs/programTypes';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  updateMyProfile: jest.fn(),
}));

jest.mock('../profile/profileQueries', () => ({
  fetchMyProfile: jest.fn(),
}));

// The catalogue is empty until the programs are written; a test stands one in.
let mockPrograms: WorkoutProgram[] = [];
// The Split Library open, as it will be once Harbir's programs are in; a test can close it.
let mockProgramsOpen = true;
jest.mock('../programs/programsAvailability', () => ({
  get PROGRAMS_OPEN() {
    return mockProgramsOpen;
  },
}));

jest.mock('../programs/programCatalog', () => ({
  PROGRAM_CATALOG: jest.requireActual('../programs/programCatalog').PROGRAM_CATALOG,
  get WORKOUT_PROGRAMS() {
    return mockPrograms;
  },
}));

jest.mock('../workouts/workoutSplitQueries', () => ({
  fetchWorkoutSplits: jest.fn(),
  duplicateWorkoutSplit: jest.fn(),
  deleteWorkoutSplit: jest.fn(),
}));

// Isolates this screen's own split-list logic from the preset picker's own
// (separately tested) rendering/materialize behavior. babel-plugin-jest-
// hoist forbids referencing outer-scope variables inside jest.mock()
// factories, so react-native/react are require()'d inside it instead of
// relying on the file's top-level import.
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
jest.mock('../workouts/WorkoutSplitPresetPicker', () => {
  const react = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  return {
    WorkoutSplitPresetPicker: (props: any) =>
      react.createElement(
        TouchableOpacity,
        { testID: props.testID, onPress: () => props.onPresetActivated('split-preset-new') },
        react.createElement(Text, null, 'presets'),
      ),
  };
});
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */

const mockUseAuth = useAuth as jest.Mock;
const mockFetchMyProfile = fetchMyProfile as jest.Mock;
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
let route = {} as never;

const mockOpenMenu = jest.fn();

// WorkoutSplitsScreen now opens the app-level side menu (via
// AppMenuContext) from its own header, same as Dashboard -- this stands in
// for that root-level provider.
function renderScreen() {
  return render(
    <ProfileProvider>
      <AppMenuContext.Provider value={{ openMenu: mockOpenMenu, currentMode: 'workout' }}>
        <WorkoutSplitsScreen navigation={navigation} route={route} />
      </AppMenuContext.Provider>
    </ProfileProvider>,
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
  mockProgramsOpen = true;
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockFetchMyProfile.mockReset().mockResolvedValue(baseProfile);
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
  mockPrograms = [];
  route = {} as never;
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
    fireEvent(await screen.findByTestId('workout-split-activate-split-2'), 'valueChange', true);

    expect(alertSpy).toHaveBeenCalled();
    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
      activeWorkoutSplitId: 'split-2',
    });
    expect(await screen.findByTestId('workout-split-split-2')).toHaveTextContent(/ACTIVE/);
    alertSpy.mockRestore();
  });

  it("disables the active split's own toggle -- it can only be superseded by activating another, never turned off in place", async () => {
    renderScreen();
    await screen.findByTestId('workout-split-split-1');

    expect(screen.getByTestId('workout-split-activate-split-1').props.value).toBe(true);
    expect(screen.getByTestId('workout-split-activate-split-1').props.disabled).toBe(true);
    expect(screen.getByTestId('workout-split-activate-split-2').props.value).toBe(false);
    expect(screen.getByTestId('workout-split-activate-split-2').props.disabled).toBe(false);
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

  it('shows Browse Splits below the create button, and activates a preset once materialized', async () => {
    renderScreen();
    await screen.findByTestId('workout-split-split-1');
    const callsBeforePress = mockFetchWorkoutSplits.mock.calls.length;

    fireEvent.press(screen.getByTestId('workout-splits-presets'));

    await waitFor(() =>
      expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
        activeWorkoutSplitId: 'split-preset-new',
      }),
    );
    await waitFor(() =>
      expect(mockFetchWorkoutSplits.mock.calls.length).toBe(callsBeforePress + 1),
    );
  });

  it('opens the app-level side menu when the header button is pressed', async () => {
    renderScreen();
    fireEvent.press(await screen.findByTestId('workout-splits-open-menu'));

    expect(mockOpenMenu).toHaveBeenCalledWith();
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

/** The split widgets: My Splits' widgets but the Split Library's. */
function splitCards() {
  return screen
    .UNSAFE_queryAllByType(AppCard)
    .filter((card) => String(card.props.testID ?? '').startsWith('workout-split-'));
}

describe('WorkoutSplitsScreen -- one widget per split', () => {
  it('shows each split as its own widget: a row with its actions beneath it', async () => {
    renderScreen();
    await screen.findByTestId('workout-split-split-1');

    // One widget per split.
    expect(splitCards()).toHaveLength(2);
    const block = within(screen.getByTestId('workout-split-split-1'));
    expect(block.getByTestId('workout-split-view-split-1')).toHaveTextContent(/PPL - Hypertrophy/);
    for (const action of ['edit', 'duplicate', 'delete']) {
      expect(block.getByTestId(`workout-split-${action}-split-1`)).toBeTruthy();
    }
  });

  it('makes the active split the hero widget and leaves the others as plain glass', async () => {
    renderScreen();
    await screen.findByTestId('workout-split-split-1');

    expect(splitCards().map((c) => Boolean(c.props.hero))).toEqual([true, false]);
  });

  it('bands only the active split in the Workout accent, never the others', async () => {
    renderScreen();
    await screen.findByTestId('workout-split-split-1');

    expect(screen.getByTestId('workout-split-split-1-top-accent')).toBeTruthy();
    expect(screen.queryByTestId('workout-split-split-2-top-accent')).toBeNull();
  });

  it('marks the active split with a quiet ACTIVE label in the mode accent, not a badge', async () => {
    renderScreen();
    const block = within(await screen.findByTestId('workout-split-split-1'));

    const label = block.getByText('ACTIVE');
    expect(StyleSheet.flatten(label.props.style).color).toBe(DEFAULT_WORKOUT_THEME.accent);
    expect(StyleSheet.flatten(label.props.style).backgroundColor).toBeUndefined();
  });

  it('shows Delete in the destructive color and Edit/Duplicate neutral, all with 44pt targets', async () => {
    renderScreen();
    await screen.findByTestId('workout-split-split-1');

    const color = (id: string) =>
      StyleSheet.flatten(
        within(screen.getByTestId(id)).getByText(
          id.includes('delete') ? 'Delete' : id.includes('edit') ? 'Edit' : 'Duplicate',
        ).props.style,
      ).color;
    expect(color('workout-split-delete-split-1')).toBe('#F0555C');
    expect(color('workout-split-edit-split-1')).not.toBe('#F0555C');
    // workout-split-activate-* is a native Switch now, not a TextButton --
    // its touch target is the platform's own fixed switch size, not
    // measured via a style.minHeight the way a text button's is.
    for (const id of [
      'workout-split-edit-split-1',
      'workout-split-duplicate-split-1',
      'workout-split-delete-split-1',
    ]) {
      expect(
        StyleSheet.flatten(screen.getByTestId(id).props.style).minHeight,
      ).toBeGreaterThanOrEqual(44);
    }
  });

  it('has one clear primary action: a filled Create Workout Split button in the mode accent', async () => {
    renderScreen();
    const create = await screen.findByTestId('workout-splits-create');

    const style = StyleSheet.flatten(create.props.style);
    expect(style.backgroundColor).toBe(DEFAULT_WORKOUT_THEME.accent);
    expect(create).toHaveTextContent('Create Workout Split');
  });

  it('keeps the primary action available on the empty state too', async () => {
    mockFetchWorkoutSplits.mockResolvedValue([]);
    renderScreen();

    expect(await screen.findByTestId('workout-splits-create')).toBeTruthy();
  });
});

describe('WorkoutSplitsScreen -- the page, top to bottom', () => {
  it('puts the active split first under its own heading, then the rest, then ways to find one', async () => {
    mockFetchMyProfile.mockResolvedValue({ ...baseProfile, activeWorkoutSplitId: 'split-2' });
    renderScreen();
    await screen.findByTestId('workout-split-split-2');

    await waitFor(() =>
      expect(splitCards().map((card) => card.props.testID)).toEqual([
        'workout-split-split-2',
        'workout-split-split-1',
      ]),
    );
    expect(screen.getByTestId('workout-splits-heading-active')).toHaveTextContent('Active Split');
    expect(screen.getByTestId('workout-splits-heading-others')).toHaveTextContent(
      'Your Other Splits',
    );
    expect(screen.getByTestId('workout-splits-library')).toHaveTextContent(
      /Split Library.*133 splits in 9 categories\. Workouts coming soon\./,
    );
    expect(screen.getByTestId('workout-splits-presets')).toBeTruthy();
  });

  it('calls them Your Splits while none is active', async () => {
    mockFetchMyProfile.mockResolvedValue({ ...baseProfile, activeWorkoutSplitId: null });
    renderScreen();
    await screen.findByTestId('workout-split-split-1');

    expect(screen.queryByTestId('workout-splits-heading-active')).toBeNull();
    await waitFor(() =>
      expect(screen.getByTestId('workout-splits-heading-others')).toHaveTextContent('Your Splits'),
    );
  });
});

describe('WorkoutSplitsScreen -- Split Library', () => {
  it('opens on My Splits, with the Split Library a tab away -- the browser, not a page of its own', async () => {
    renderScreen();
    await screen.findByTestId('workout-split-split-1');
    expect(screen.queryByTestId('workout-splits-programs')).toBeNull();

    fireEvent.press(screen.getByTestId('workout-splits-tabs-programs'));
    expect(screen.queryByTestId('workout-split-split-1')).toBeNull();
    expect(screen.queryByTestId('workout-splits-create')).toBeNull();
    // Every title listed, though nothing's written yet.
    expect(screen.getByTestId('workout-splits-programs-intro')).toHaveTextContent(
      /133 splits in 9 categories/,
    );
    expect(screen.getByTestId('workout-splits-programs-section-traditional')).toBeTruthy();
  });

  it("goes to the library from My Splits' Split Library widget", async () => {
    renderScreen();
    fireEvent.press(await screen.findByTestId('workout-splits-library'));

    expect(screen.getByTestId('workout-splits-programs-intro')).toBeTruthy();
    expect(screen.queryByTestId('workout-split-split-1')).toBeNull();
  });

  it('asks what to recommend from until they have said, from Workout Preferences', async () => {
    route = { params: { tab: 'programs' } } as never;
    renderScreen();

    fireEvent.press(await screen.findByTestId('workout-splits-preferences'));
    expect(mockNavigate).toHaveBeenCalledWith('SettingsWorkoutPreferences');
  });

  it('recommends from what they have said, and opens a program on its variation', async () => {
    mockPrograms = [TEST_PROGRAM];
    mockFetchMyProfile.mockResolvedValue({
      ...baseProfile,
      workoutFrequencyDays: 6,
      trainingPriorities: ['chest'],
      equipmentAccess: 'full_gym',
      trainingExclusions: [],
      fitnessGoals: ['build_muscle'],
    });
    route = { params: { tab: 'programs' } } as never;
    renderScreen();

    expect(
      await screen.findByTestId('workout-splits-programs-recommended-test-split'),
    ).toHaveTextContent(/Fits your 6 days a week/);
    expect(screen.queryByTestId('workout-splits-preferences')).toBeNull();
    fireEvent.press(screen.getByTestId('workout-splits-programs-recommended-test-split'));
    expect(mockNavigate).toHaveBeenCalledWith('ProgramDetail', {
      programId: 'test-split',
      variationId: 'six',
    });
  });
});

describe('WorkoutSplitsScreen -- programs Coming Soon', () => {
  beforeEach(() => {
    mockProgramsOpen = false;
    route = {} as never;
  });

  it('says Coming Soon in the Split Library tab, with no library or recommendations', async () => {
    route = { params: { tab: 'programs' } } as never;
    renderScreen();
    expect(await screen.findByTestId('workout-splits-programs-coming-soon')).toHaveTextContent(
      /Workout Programs.*Coming Soon/,
    );
    expect(screen.queryByTestId('workout-splits-programs-intro')).toBeNull();
    expect(screen.queryByTestId('workout-splits-preferences')).toBeNull();
  });

  it("says Coming Soon on My Splits' widget too, which opens nothing", async () => {
    renderScreen();
    const widget = await screen.findByTestId('workout-splits-library');
    expect(widget).toHaveTextContent(/Coming Soon/);
    // Not a button: nothing to open.
    expect(screen.queryByRole('button', { name: /Workout Programs/ })).toBeNull();
  });
});
